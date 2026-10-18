"""A project only holds a student back in the LAST module it is assigned to.

When one project spans several modules (``Project.module_ids``), counting it
toward every one of them meant a student could not clear an earlier module
until the project — which sits at the end of the sequence — was graded. The
rule under test:

  * the gate module is the last assigned module in course sequence order
    (``Module.order``, then id — not the order of the JSON list);
  * earlier assigned modules behave as if no project exists (no score blend,
    no weight change, no stale score carried from before this rule);
  * grading the project writes ``project_score`` only to that gate module;
  * retaking an earlier module never wipes the shared submission the gate
    module still counts, while retaking the gate module does.
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

        student = User(
            username=f"gt_{suffix}",
            email=f"gt_{suffix}@example.test",
            role_id=student_role.id,
        )
        student.set_password("Password123!")
        db.session.add(student)
        db.session.flush()

        instructor = User(
            username=f"gti_{suffix}",
            email=f"gti_{suffix}@example.test",
            role_id=instructor_role.id,
        )
        instructor.set_password("Password123!")
        db.session.add(instructor)
        db.session.flush()

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
        db.session.add(enrollment)
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
        )
        db.session.add(project)
        db.session.flush()

        submission = ProjectSubmission(
            project_id=project.id,
            student_id=student.id,
            text_content="my work",
            submitted_at=datetime.utcnow(),
        )
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
        db.session.add_all([progress_first, progress_last])
        db.session.flush()

        ids = {
            "student_id": student.id,
            "instructor_id": instructor.id,
            "course_id": course.id,
            "enrollment_id": enrollment.id,
            "m1_id": first.id,
            "m2_id": last.id,
            "project_id": project.id,
            "submission_id": submission.id,
            "mp1_id": progress_first.id,
            "mp2_id": progress_last.id,
        }
        db.session.commit()

    yield ids


def _load_progress(env, module_id):
    return ModuleProgress.query.filter_by(
        student_id=env["student_id"],
        module_id=module_id,
        enrollment_id=env["enrollment_id"],
    ).one()


def test_project_gates_only_its_last_assigned_module(env):
    from src.services import scoring_prefetch

    project = Project.query.get(env["project_id"])

    assert project.get_gate_module_id() == env["m2_id"]
    assert project.gates_module(env["m1_id"]) is False
    assert project.gates_module(env["m2_id"]) is True

    assert scoring_prefetch.module_has_projects(env["course_id"], env["m1_id"]) is False
    assert scoring_prefetch.module_has_projects(env["course_id"], env["m2_id"]) is True
    assert scoring_prefetch.gating_project_ids(env["course_id"], env["m1_id"]) == set()
    assert scoring_prefetch.gating_project_ids(
        env["course_id"], env["m2_id"]
    ) == {env["project_id"]}

    # End the fixture session's transaction: an open one survives context
    # teardown here and blocks every later test with "database is locked".
    db.session.rollback()

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
    assert reversed_project.gates_module(env["m1_id"]) is False
    db.session.commit()

    # End the fixture session's transaction: an open one survives context
    # teardown here and blocks every later test with "database is locked".
    db.session.rollback()

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

    # The first module stays project-free even with a whole-course project.
    assert scoring_prefetch.module_has_projects(env["course_id"], env["m1_id"]) is False

    # End the fixture session's transaction: an open one survives context
    # teardown here and blocks every later test with "database is locked".
    db.session.rollback()

def test_project_score_cannot_move_a_non_gate_module(env):
    progress_first = _load_progress(env, env["m1_id"])
    progress_last = _load_progress(env, env["m2_id"])

    # Earlier module: a (stale) project score must have zero effect on the
    # weighted module score — the module behaves as if no project exists.
    progress_first.project_score = 0.0
    clean = progress_first.calculate_module_weighted_score()
    progress_first.project_score = 100.0
    with_stale = progress_first.calculate_module_weighted_score()
    assert with_stale == pytest.approx(clean)

    # Gate module: the project score is blended in, so it must move the score.
    progress_last.project_score = 0.0
    without = progress_last.calculate_module_weighted_score()
    progress_last.project_score = 100.0
    with_score = progress_last.calculate_module_weighted_score()
    assert with_score > without

    # End the fixture session's transaction: an open one survives context
    # teardown here and blocks every later test with "database is locked".
    db.session.rollback()

def test_healing_keeps_only_the_gate_module_project_score(env):
    submission = ProjectSubmission.query.get(env["submission_id"])
    submission.grade = 90.0

    progress_first = _load_progress(env, env["m1_id"])
    progress_last = _load_progress(env, env["m2_id"])

    # Simulate a score stored before this rule (or by the old covered-all
    # propagation): the earlier module must shed it, the gate must gain it.
    progress_first.project_score = 55.0
    progress_last.project_score = 0.0
    db.session.flush()

    progress_first.sync_scores_from_assessments()
    progress_last.sync_scores_from_assessments()

    assert (progress_first.project_score or 0.0) == 0.0
    assert progress_last.project_score == pytest.approx(90.0)

    # End the fixture session's transaction: an open one survives context
    # teardown here and blocks every later test with "database is locked".
    db.session.rollback()

def test_grade_propagates_only_to_the_gate_module(env, client, app):
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

    progress_first = _load_progress(env, env["m1_id"])
    progress_last = _load_progress(env, env["m2_id"])

    assert progress_last.project_score == pytest.approx(90.0)
    assert (progress_first.project_score or 0.0) == 0.0
    # The earlier module's row was never touched by the grade.
    assert progress_first.cumulative_score in (None, 0.0)

    # End the fixture session's transaction: an open one survives context
    # teardown here and blocks every later test with "database is locked".
    db.session.rollback()

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

    # End the fixture session's transaction: an open one survives context
    # teardown here and blocks every later test with "database is locked".
    db.session.rollback()
