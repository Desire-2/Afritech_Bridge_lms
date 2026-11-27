"""Project scoring and gating across multiple modules.

A project may cover several modules (``Project.module_ids``). Its grade is
distributed to *every* covered module and, for collaborative work, to every
team member. Progression is deliberately narrower: the project gates only the
LAST covered module in course sequence order (``Module.order``, then id — not
the order of the JSON list). An ungraded project therefore does not hold back
earlier modules it also appears in, but the final covered module cannot be
completed until the project has been graded at or above its passing score.

Retaking an earlier module never wipes the shared submission; retaking the
gate module does.
"""

import json
import uuid
from datetime import datetime, timedelta

import pytest
from flask_jwt_extended import create_access_token

from src.models.course_models import (
    Course,
    Enrollment,
    Module,
    Project,
    ProjectSubmission,
)
from src.models.student_models import ModuleProgress
from src.models.user_models import User, Role, db


@pytest.fixture(autouse=True)
def _always_release_db(app):
    """Release SQLite write locks even when an assertion fails mid-test.

    A failed assertion skips the per-test ``_rollback()``, leaving the scoped
    session in an open transaction that blocks every later fixture. A small
    JWT leeway avoids flaky ``iat`` rejections from clock drift in long runs.
    """
    old_leeway = app.config.get("JWT_DECODE_LEEWAY")
    app.config["JWT_DECODE_LEEWAY"] = 5
    yield
    with app.app_context():
        db.session.rollback()
        db.session.remove()
    if old_leeway is None:
        app.config.pop("JWT_DECODE_LEEWAY", None)
    else:
        app.config["JWT_DECODE_LEEWAY"] = old_leeway


@pytest.fixture()
def env(app):
    with app.app_context():
        db.create_all()
        suffix = uuid.uuid4().hex[:10]

        student_role = Role.query.filter_by(name="student").first()
        if student_role is None:
            student_role = Role(name="student")
            db.session.add(student_role)
            db.session.flush()

        instructor_role = Role.query.filter_by(name="instructor").first()
        if instructor_role is None:
            instructor_role = Role(name="instructor")
            db.session.add(instructor_role)
            db.session.flush()

        def make_user(prefix, role):
            person = User(
                username=f"{prefix}_{suffix}",
                email=f"{prefix}_{suffix}@example.test",
                role_id=role.id,
            )
            person.set_password("Password123!")
            db.session.add(person)
            db.session.flush()
            return person

        student = make_user("gt", student_role)
        teammate = make_user("gtt", student_role)
        instructor = make_user("gti", instructor_role)

        course = Course(
            title=f"Gating {suffix}",
            description="multi-module project gating tests",
            instructor_id=instructor.id,
            is_published=True,
            enrollment_type="free",
        )
        db.session.add(course)
        db.session.flush()

        enrollment = Enrollment(
            student_id=student.id, course_id=course.id, status="active"
        )
        teammate_enrollment = Enrollment(
            student_id=teammate.id, course_id=course.id, status="active"
        )
        db.session.add_all([enrollment, teammate_enrollment])
        db.session.flush()

        first = Module(
            title="First module", course_id=course.id, order=1, is_published=True
        )
        last = Module(
            title="Last module", course_id=course.id, order=2, is_published=True
        )
        db.session.add_all([first, last])
        db.session.flush()

        project = Project(
            title="Spans both modules",
            description="one project, two modules",
            course_id=course.id,
            module_ids=json.dumps([first.id, last.id]),
            due_date=datetime.utcnow() + timedelta(days=7),
            is_published=True,
            submission_format="text",
            points_possible=100,
            passing_score=60.0,
            collaboration_allowed=True,
        )
        db.session.add(project)
        db.session.flush()

        submission = ProjectSubmission(
            project_id=project.id,
            student_id=student.id,
            text_content="my work",
            submitted_at=datetime.utcnow(),
        )
        submission.set_team_members([teammate.id])
        db.session.add(submission)
        db.session.flush()

        progress_first = ModuleProgress(
            student_id=student.id,
            module_id=first.id,
            enrollment_id=enrollment.id,
            status="unlocked",
        )
        progress_last = ModuleProgress(
            student_id=student.id,
            module_id=last.id,
            enrollment_id=enrollment.id,
            status="unlocked",
        )
        teammate_first = ModuleProgress(
            student_id=teammate.id,
            module_id=first.id,
            enrollment_id=teammate_enrollment.id,
            status="unlocked",
        )
        teammate_last = ModuleProgress(
            student_id=teammate.id,
            module_id=last.id,
            enrollment_id=teammate_enrollment.id,
            status="unlocked",
        )
        db.session.add_all([
            progress_first, progress_last, teammate_first, teammate_last,
        ])
        db.session.flush()

        ids = {
            "student_id": student.id,
            "teammate_id": teammate.id,
            "instructor_id": instructor.id,
            "course_id": course.id,
            "enrollment_id": enrollment.id,
            "teammate_enrollment_id": teammate_enrollment.id,
            "m1_id": first.id,
            "m2_id": last.id,
            "project_id": project.id,
            "submission_id": submission.id,
            "mp1_id": progress_first.id,
            "mp2_id": progress_last.id,
        }
        db.session.commit()

    yield ids


def _load_progress(env, module_id, student_id=None):
    return ModuleProgress.query.filter_by(
        student_id=student_id or env["student_id"],
        module_id=module_id,
        enrollment_id=(
            env["teammate_enrollment_id"]
            if student_id == env["teammate_id"]
            else env["enrollment_id"]
        ),
    ).one()


def _rollback():
    # End the fixture session's transaction: an open one survives context
    # teardown here and blocks every later test with "database is locked".
    db.session.rollback()


def test_project_gates_only_its_last_assigned_module(env):
    from src.services import scoring_prefetch

    project = Project.query.get(env["project_id"])

    assert project.get_gate_module_id() == env["m2_id"]
    assert project.gates_module(env["m1_id"]) is False
    assert project.gates_module(env["m2_id"]) is True

    # The score reaches both modules, but only the last one gates progression.
    assert project.get_scoring_module_ids() == [env["m1_id"], env["m2_id"]]
    assert scoring_prefetch.covered_project_ids(
        env["course_id"], env["m1_id"]
    ) == {env["project_id"]}
    assert scoring_prefetch.covered_project_ids(
        env["course_id"], env["m2_id"]
    ) == {env["project_id"]}
    assert scoring_prefetch.gating_project_ids(env["course_id"], env["m1_id"]) == set()
    assert scoring_prefetch.gating_project_ids(
        env["course_id"], env["m2_id"]
    ) == {env["project_id"]}

    _rollback()


def test_course_sequence_beats_the_json_order(env):
    """module_ids listed last-first still gates the course-order last module."""
    reversed_project = Project(
        title="Listed backwards",
        description="json order must not decide the gate",
        course_id=env["course_id"],
        module_ids=json.dumps([env["m2_id"], env["m1_id"]]),
        due_date=datetime.utcnow() + timedelta(days=7),
        is_published=True,
        submission_format="text",
        points_possible=100,
    )
    db.session.add(reversed_project)
    db.session.flush()

    assert reversed_project.get_gate_module_id() == env["m2_id"]
    assert reversed_project.get_scoring_module_ids() == [env["m1_id"], env["m2_id"]]
    assert reversed_project.gates_module(env["m1_id"]) is False

    db.session.commit()
    _rollback()


def test_course_level_project_gates_the_final_module(env):
    from src.services import scoring_prefetch

    whole_course = Project(
        title="Whole course",
        description="no module assignment covers the course",
        course_id=env["course_id"],
        module_ids="[]",
        due_date=datetime.utcnow() + timedelta(days=7),
        is_published=True,
        submission_format="text",
        points_possible=100,
    )
    db.session.add(whole_course)
    db.session.flush()

    assert whole_course.get_gate_module_id() == env["m2_id"]
    assert whole_course.gates_module(env["m1_id"]) is False
    assert whole_course.gates_module(env["m2_id"]) is True
    assert whole_course.get_scoring_module_ids() == [env["m1_id"], env["m2_id"]]

    assert scoring_prefetch.gating_project_ids(env["course_id"], env["m1_id"]) == set()
    assert scoring_prefetch.gating_project_ids(
        env["course_id"], env["m2_id"]
    ) == {env["project_id"], whole_course.id}

    _rollback()


def test_ungraded_project_does_not_block_an_earlier_module(env):
    progress_first = _load_progress(env, env["m1_id"])
    submission = ProjectSubmission.query.get(env["submission_id"])
    assert submission.grade is None

    clean = progress_first.calculate_module_weighted_score()
    progress_first.project_score = 100.0
    with_stale = progress_first.calculate_module_weighted_score()

    # An ungraded shared project is not a hands-on component in module 1.
    assert with_stale == pytest.approx(clean)

    _rollback()


def test_graded_project_counts_in_every_covered_module(env):
    progress_first = _load_progress(env, env["m1_id"])
    progress_last = _load_progress(env, env["m2_id"])
    submission = ProjectSubmission.query.get(env["submission_id"])
    submission.grade = 90.0

    progress_first.project_score = 0.0
    first_without = progress_first.calculate_module_weighted_score()
    progress_first.project_score = 100.0
    first_with = progress_first.calculate_module_weighted_score()
    assert first_with > first_without

    progress_last.project_score = 0.0
    last_without = progress_last.calculate_module_weighted_score()
    progress_last.project_score = 100.0
    last_with = progress_last.calculate_module_weighted_score()
    assert last_with > last_without

    _rollback()


def test_healing_distributes_grade_to_every_covered_module(env):
    submission = ProjectSubmission.query.get(env["submission_id"])
    submission.grade = 90.0

    progress_first = _load_progress(env, env["m1_id"])
    progress_last = _load_progress(env, env["m2_id"])
    progress_first.project_score = 0.0
    progress_last.project_score = 0.0
    db.session.flush()

    progress_first.sync_scores_from_assessments()
    progress_last.sync_scores_from_assessments()

    assert progress_first.project_score == pytest.approx(90.0)
    assert progress_last.project_score == pytest.approx(90.0)

    _rollback()


def test_grade_propagates_to_every_module_and_teammate(env, client, app):
    submission = ProjectSubmission.query.get(env["submission_id"])
    submission.set_team_members([env["teammate_id"]])
    db.session.commit()

    with app.app_context():
        token = create_access_token(identity=str(env["instructor_id"]))

    response = client.post(
        f"/api/v1/grading/projects/submissions/{env['submission_id']}/grade",
        json={"grade": 90},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.get_json()

    # The route wrote through its own request-scoped session; drop any cached
    # identity-map copies before reading the stored scores back.
    db.session.expire_all()

    for module_id in (env["m1_id"], env["m2_id"]):
        assert _load_progress(env, module_id).project_score == pytest.approx(90.0)
        assert _load_progress(
            env, module_id, env["teammate_id"]
        ).project_score == pytest.approx(90.0)

    teammate_row = ProjectSubmission.query.filter_by(
        project_id=env["project_id"], student_id=env["teammate_id"]
    ).one()
    assert teammate_row.grade == pytest.approx(90.0)
    assert teammate_row.can_resubmit is False

    _rollback()


def test_project_gate_blocks_gate_module_until_graded(env):
    from src.services.project_scoring_service import project_gate_blocker

    assert project_gate_blocker(
        env["student_id"], env["m1_id"], env["course_id"]
    ) is None
    blocker = project_gate_blocker(
        env["student_id"], env["m2_id"], env["course_id"]
    )
    assert blocker and "project" in blocker.lower()

    submission = ProjectSubmission.query.get(env["submission_id"])
    submission.grade = 90.0
    db.session.flush()

    assert project_gate_blocker(
        env["student_id"], env["m2_id"], env["course_id"]
    ) is None
    # A teammate inherits the graded result for gate purposes too.
    assert project_gate_blocker(
        env["teammate_id"], env["m2_id"], env["course_id"]
    ) is None

    _rollback()


def test_project_gate_blocks_completion_even_when_score_passes(env):
    from src.services.progression_service import ProgressionService

    progress_last = _load_progress(env, env["m2_id"])
    progress_last.course_contribution_score = 100.0
    progress_last.quiz_score = 100.0
    progress_last.assignment_score = 100.0
    progress_last.final_assessment_score = 100.0
    # Modules in this fixture have no lessons/quizzes, so the weight formula
    # would recompute to 0 — set the cached score directly for the gate test.
    progress_last.cumulative_score = 100.0
    assert progress_last.cumulative_score >= 70.0
    db.session.flush()

    ok, reason = ProgressionService.check_module_completion(
        env["student_id"], env["m2_id"], env["enrollment_id"]
    )
    assert ok is False
    assert "project" in reason.lower()

    assert progress_last.status != "completed"

    _rollback()


def test_retaking_an_earlier_module_keeps_the_shared_submission(env):
    from src.services.progression_service import ProgressionService

    progress_first = _load_progress(env, env["m1_id"])
    progress_first.status = "failed"
    progress_first.attempts_count = 0
    db.session.flush()

    ok, message = ProgressionService.attempt_module_retake(
        env["student_id"], env["m1_id"], env["enrollment_id"]
    )
    assert ok, message

    submission = ProjectSubmission.query.filter_by(
        project_id=env["project_id"], student_id=env["student_id"]
    ).first()
    assert submission is not None, (
        "retaking the earlier module wiped the project the gate module counts"
    )

    progress_last = _load_progress(env, env["m2_id"])
    progress_last.status = "failed"
    progress_last.attempts_count = 0
    db.session.flush()

    ok, message = ProgressionService.attempt_module_retake(
        env["student_id"], env["m2_id"], env["enrollment_id"]
    )
    assert ok, message

    submission = ProjectSubmission.query.filter_by(
        project_id=env["project_id"], student_id=env["student_id"]
    ).first()
    assert submission is None, (
        "retaking the gate module must invalidate its project submission"
    )

    _rollback()
