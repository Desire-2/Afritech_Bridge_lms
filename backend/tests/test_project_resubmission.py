"""Project revision requests and resubmissions are per student, not global.

The old flow stored ``modification_requested``/``can_resubmit`` on the shared
``Project`` row. One student's revision request therefore unlocked resubmission
for every student in the course, and the submit endpoints rejected any row with
a ``submitted_at`` timestamp even when a revision had been requested.

These tests cover the replacement: per-submission state, team-wide propagation
within one team, cleared grades/scores on resubmission, and the student submit
endpoint accepting an authorised resubmission.
"""

import json
import uuid
from datetime import datetime, timedelta

import pytest
from flask_jwt_extended import create_access_token

from src.models.course_models import Course, Enrollment, Module, Project, ProjectSubmission
from src.models.student_models import ModuleProgress
from src.models.user_models import User, Role, db


@pytest.fixture(autouse=True)
def _always_release_db(app):
    """Release SQLite write locks; tolerate clock drift in JWT iat checks."""
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

        student = make_user("prs", student_role)
        teammate = make_user("prt", student_role)
        other = make_user("pro", student_role)
        instructor = make_user("pri", instructor_role)

        course = Course(
            title=f"Resubmit {suffix}",
            description="project resubmission tests",
            instructor_id=instructor.id,
            is_published=True,
            enrollment_type="free",
        )
        db.session.add(course)
        db.session.flush()

        enrollments = {}
        for person in (student, teammate, other):
            enrollment = Enrollment(
                student_id=person.id, course_id=course.id, status="active"
            )
            db.session.add(enrollment)
            db.session.flush()
            enrollments[person.id] = enrollment.id

        modules = [
            Module(
                title=f"Module {i}", course_id=course.id, order=i,
                is_published=True,
            )
            for i in (1, 2)
        ]
        db.session.add_all(modules)
        db.session.flush()

        project = Project(
            title="Collaborative build",
            description="resubmission fixture",
            course_id=course.id,
            module_ids=json.dumps([m.id for m in modules]),
            due_date=datetime.utcnow() + timedelta(days=7),
            is_published=True,
            submission_format="text",
            points_possible=100,
            passing_score=60.0,
            collaboration_allowed=True,
            max_team_size=3,
            max_resubmissions=2,
        )
        db.session.add(project)
        db.session.flush()

        def submission_for(person, *, team=None):
            row = ProjectSubmission(
                project_id=project.id,
                student_id=person.id,
                text_content="first attempt",
                submitted_at=datetime.utcnow(),
                grade=40.0,
                feedback="Needs work",
            )
            if team:
                row.set_team_members(team)
            db.session.add(row)
            db.session.flush()
            return row

        primary = submission_for(student, team=[teammate.id])
        member = submission_for(teammate)
        outsider = submission_for(other)

        for person in (student, teammate, other):
            for module in modules:
                db.session.add(ModuleProgress(
                    student_id=person.id,
                    module_id=module.id,
                    enrollment_id=enrollments[person.id],
                    status="unlocked",
                    project_score=40.0,
                ))

        ids = {
            "student_id": student.id,
            "teammate_id": teammate.id,
            "other_id": other.id,
            "instructor_id": instructor.id,
            "course_id": course.id,
            "project_id": project.id,
            "primary_id": primary.id,
            "member_id": member.id,
            "other_submission_id": outsider.id,
            "m1_id": modules[0].id,
            "m2_id": modules[1].id,
            "enrollment_id": enrollments[student.id],
        }
        db.session.commit()

    yield ids


def _rollback():
    db.session.rollback()


def test_revision_request_is_per_team_not_global(env):
    from src.services.project_scoring_service import (
        request_project_modification, team_member_ids,
    )

    primary = ProjectSubmission.query.get(env["primary_id"])
    member = ProjectSubmission.query.get(env["member_id"])
    other = ProjectSubmission.query.get(env["other_submission_id"])
    project = Project.query.get(env["project_id"])

    rows = ProjectSubmission.query.filter(
        ProjectSubmission.project_id == project.id,
        ProjectSubmission.student_id.in_(team_member_ids(project, primary)),
    ).all()
    assert request_project_modification(rows, "Try again", env["instructor_id"]) == 2

    for row in (primary, member):
        state = row.modification_state()
        assert state["modification_requested"] is True
        assert state["can_resubmit"] is True
        assert row.resubmission_count == 1

    assert other.modification_state()["can_resubmit"] is False
    assert other.resubmission_count == 0
    assert project.modification_requested is False
    assert project.can_resubmit is False
    assert project.resubmission_count == 0

    _rollback()


def test_repeated_request_does_not_double_count(env):
    from src.services.project_scoring_service import request_project_modification

    primary = ProjectSubmission.query.get(env["primary_id"])
    request_project_modification([primary], "First", env["instructor_id"])
    request_project_modification([primary], "Still needed", env["instructor_id"])

    assert primary.resubmission_count == 1
    assert primary.modification_request_reason == "Still needed"

    _rollback()


def test_resubmission_check_enforces_request_and_limit(env):
    from src.services.project_scoring_service import (
        request_project_modification, resubmission_check,
    )

    project = Project.query.get(env["project_id"])
    primary = ProjectSubmission.query.get(env["primary_id"])

    allowed, reason = resubmission_check(project, primary)
    assert allowed is False
    assert "revision" in reason.lower()

    request_project_modification([primary], "Try again", None)
    allowed, _ = resubmission_check(project, primary)
    assert allowed is True

    primary.resubmission_count = project.max_resubmissions
    allowed, reason = resubmission_check(project, primary)
    assert allowed is False
    assert "Maximum resubmissions" in reason

    _rollback()


def test_preparing_resubmission_clears_team_grade_and_all_module_scores(env):
    from src.services.project_scoring_service import (
        prepare_project_resubmission, request_project_modification,
    )

    primary = ProjectSubmission.query.get(env["primary_id"])
    member = ProjectSubmission.query.get(env["member_id"])
    project = Project.query.get(env["project_id"])
    request_project_modification([primary], "Try again", None)

    prepare_project_resubmission(project, primary, {"resubmission_notes": "fixed bug"})

    for row in (primary, member):
        assert row.grade is None
        assert row.feedback is None
        assert row.modification_state()["can_resubmit"] is False

    assert primary.is_resubmission is True
    assert primary.original_submission_id == primary.id
    assert primary.submission_notes == "fixed bug"

    for student_id in (env["student_id"], env["teammate_id"]):
        for module_id in (env["m1_id"], env["m2_id"]):
            progress = ModuleProgress.query.filter_by(
                student_id=student_id, module_id=module_id
            ).one()
            assert progress.project_score == pytest.approx(0.0)

    _rollback()


def test_submit_endpoint_rejects_resubmission_without_request(
    env, client, app, monkeypatch
):
    monkeypatch.setattr(
        "src.routes.student_routes.enqueue_for_submission", lambda **kwargs: None
    )
    with app.app_context():
        token = create_access_token(identity=str(env["student_id"]))

    response = client.post(
        f"/api/v1/student/projects/{env['project_id']}/submit",
        json={"text_content": "second attempt"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
    assert "revision" in response.get_json()["message"].lower()

    _rollback()


def test_submit_endpoint_accepts_authorised_resubmission(
    env, client, app, monkeypatch
):
    monkeypatch.setattr(
        "src.routes.student_routes.enqueue_for_submission", lambda **kwargs: None
    )
    from src.services.project_scoring_service import request_project_modification

    primary = ProjectSubmission.query.get(env["primary_id"])
    request_project_modification([primary], "Please revise", None)
    db.session.commit()

    with app.app_context():
        token = create_access_token(identity=str(env["student_id"]))

    response = client.post(
        f"/api/v1/student/projects/{env['project_id']}/submit",
        json={
            "text_content": "revised write-up",
            "team_members": [env["teammate_id"]],
            "resubmission_notes": "incorporated feedback",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.get_json()
    body = response.get_json()
    assert "resubmitted" in body["message"].lower()
    assert body["submission"]["is_resubmission"] is True
    assert body["submission"]["grade"] is None
    assert body["submission"]["can_resubmit"] is False

    db.session.expire_all()
    member = ProjectSubmission.query.get(env["member_id"])
    assert member.grade is None

    teammate_progress = ModuleProgress.query.filter_by(
        student_id=env["teammate_id"], module_id=env["m1_id"]
    ).one()
    assert teammate_progress.project_score == pytest.approx(0.0)

    _rollback()
