"""HTTP coverage for the shared grading-detail dispatch endpoints.

AAGE is the only engine. These tests assert that every assignment/project
submission enqueues AAGE, spreadsheet files are only a specialist hint, course
ownership is preserved, and no second Excel pipeline is started.
"""

import hashlib
import uuid
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from flask_jwt_extended import create_access_token

from src.models.aage_models import EvaluationResult, EvaluationRun, GradingJob
from src.models.course_models import (
    Assignment,
    AssignmentSubmission,
    Course,
    Project,
    ProjectSubmission,
)
from src.models.user_models import Role, User, db
from src.routes import aage_routes
from src.services.aage import jobs


def _role(name):
    role = Role.query.filter_by(name=name).first()
    if role is None:
        role = Role(name=name)
        db.session.add(role)
        db.session.flush()
    return role


def _user(role_name, tag):
    user = User(
        username=f"unified_{role_name}_{tag}",
        email=f"unified_{role_name}_{tag}@afritech.test",
        password_hash=hashlib.sha256(b"x").hexdigest(),
        role_id=_role(role_name).id,
    )
    db.session.add(user)
    db.session.flush()
    return user


def _env():
    tag = uuid.uuid4().hex[:8]
    instructor = _user("instructor", tag)
    other = _user("instructor", tag + "other")
    student = _user("student", tag)
    course = Course(
        title=f"Unified Grading {tag}",
        description="dispatch tests",
        instructor_id=instructor.id,
    )
    db.session.add(course)
    db.session.flush()
    assignment = Assignment(
        title=f"Assignment {tag}",
        description="dispatch tests",
        course_id=course.id,
        instructor_id=instructor.id,
        points_possible=100.0,
    )
    db.session.add(assignment)
    db.session.flush()
    submission = AssignmentSubmission(
        assignment_id=assignment.id,
        student_id=student.id,
        content="answer",
    )
    db.session.add(submission)
    db.session.flush()
    project = Project(
        title=f"Project {tag}",
        description="dispatch tests",
        course_id=course.id,
        module_ids="[]",
        due_date=datetime.utcnow() + timedelta(days=7),
        points_possible=100.0,
    )
    db.session.add(project)
    db.session.flush()
    project_submission = ProjectSubmission(
        project_id=project.id,
        student_id=student.id,
        text_content="answer",
    )
    db.session.add(project_submission)
    db.session.flush()
    return {
        "instructor": instructor,
        "other": other,
        "student": student,
        "course": course,
        "assignment": assignment,
        "submission": submission,
        "project": project,
        "project_submission": project_submission,
    }


def _auth(app, user):
    with app.app_context():
        token = create_access_token(identity=str(user.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def env(app):
    with app.app_context():
        db.create_all()
        data = _env()
        db.session.commit()
        for key in ("instructor", "other", "student", "course", "assignment",
                    "submission", "project", "project_submission"):
            db.session.refresh(data[key])
        return data


def test_status_reports_selected_engine_and_existing_aage_rows(app, client, env,
                                                              monkeypatch):
    monkeypatch.setattr(aage_routes, "uses_excel_grader", lambda *a, **k: False)
    expected_job_id = None
    with app.app_context():
        job = GradingJob(
            submission_type="assignment",
            submission_id=env["submission"].id,
            job_type="grade_submission",
            assessment_kind="assignment",
            assessment_id=env["assignment"].id,
            course_id=env["course"].id,
            student_id=env["student"].id,
            status="succeeded",
        )
        db.session.add(job)
        db.session.flush()
        run = EvaluationRun(job_id=job.id, status="succeeded")
        db.session.add(run)
        db.session.flush()
        result = EvaluationResult(
            run_id=run.id,
            job_id=job.id,
            submission_type="assignment",
            submission_id=env["submission"].id,
            assessment_kind="assignment",
            assessment_id=env["assignment"].id,
            course_id=env["course"].id,
            student_id=env["student"].id,
            total_awarded=80,
            total_possible=100,
            final_score=80,
            confidence=90,
            status="published",
            is_official=True,
        )
        db.session.add(result)
        db.session.commit()
        expected_job_id = job.id

    response = client.get(
        f"/api/v1/aage/grading/unified/status/assignment/{env['submission'].id}",
        headers=_auth(app, env["instructor"]),
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["data"]["selected_engine"] == "aage"
    assert body["data"]["aage_job"]["id"] == expected_job_id
    assert body["data"]["aage_result"]["final_score"] == 80


def test_spreadsheet_submission_uses_native_aage_specialist(app, client, env,
                                                            monkeypatch):
    captured = {}
    monkeypatch.setattr(aage_routes, "uses_excel_grader", lambda *a, **k: True)
    monkeypatch.setattr(jobs, "active_job", lambda *a, **k: None)
    monkeypatch.setattr(
        jobs,
        "enqueue_grade_job",
        lambda **kwargs: (captured.update(kwargs)
                          or SimpleNamespace(
                              id=125, status="queued",
                              to_dict=lambda: {
                                  "id": 125, "status": "queued",
                                  "submission_type": "assignment",
                                  "submission_id": env["submission"].id,
                              })),
    )

    response = client.post(
        "/api/v1/aage/grading/unified/start",
        json={
            "submission_type": "assignment",
            "submission_id": env["submission"].id,
            "force": True,
        },
        headers=_auth(app, env["instructor"]),
    )
    assert response.status_code == 201
    body = response.get_json()["data"]
    assert body["engine"] == "aage"
    assert body["specialist"] == "spreadsheet"
    assert body["job"]["id"] == 125
    assert captured["submission_id"] == env["submission"].id
    assert captured["force"] is True


def test_non_excel_submission_uses_existing_aage_queue(app, client, env,
                                                      monkeypatch):
    captured = {}

    class FakeJob:
        id = 123
        status = "queued"

        def to_dict(self):
            return {"id": self.id, "status": self.status,
                    "submission_type": "assignment",
                    "submission_id": env["submission"].id}

    monkeypatch.setattr(aage_routes, "uses_excel_grader", lambda *a, **k: False)
    monkeypatch.setattr(jobs, "active_job", lambda *a, **k: None)
    monkeypatch.setattr(
        jobs,
        "enqueue_grade_job",
        lambda **kwargs: (captured.update(kwargs) or FakeJob()),
    )

    response = client.post(
        "/api/v1/aage/grading/unified/start",
        json={"submission_type": "assignment",
              "submission_id": env["submission"].id},
        headers=_auth(app, env["instructor"]),
    )
    assert response.status_code == 201
    body = response.get_json()
    assert body["data"]["engine"] == "aage"
    assert body["data"]["job"]["id"] == 123
    assert captured["course_id"] == env["course"].id
    assert captured["requested_by"] == env["instructor"].id


def test_project_submission_uses_existing_aage_queue(app, client, env,
                                                    monkeypatch):
    captured = {}

    class FakeJob:
        id = 124
        status = "queued"

        def to_dict(self):
            return {"id": self.id, "status": self.status,
                    "submission_type": "project",
                    "submission_id": env["project_submission"].id}

    monkeypatch.setattr(aage_routes, "uses_excel_grader", lambda *a, **k: False)
    monkeypatch.setattr(jobs, "active_job", lambda *a, **k: None)
    monkeypatch.setattr(
        jobs,
        "enqueue_grade_job",
        lambda **kwargs: (captured.update(kwargs) or FakeJob()),
    )

    response = client.post(
        "/api/v1/aage/grading/unified/start",
        json={"submission_type": "project",
              "submission_id": env["project_submission"].id},
        headers=_auth(app, env["instructor"]),
    )
    assert response.status_code == 201
    body = response.get_json()
    assert body["data"]["engine"] == "aage"
    assert body["data"]["job"]["id"] == 124
    assert captured["assessment_kind"] == "project"
    assert captured["assessment_id"] == env["project"].id


def test_aage_has_no_excel_fallback_path(app, client, env, monkeypatch):
    """There is no engine fallback because there is no second engine."""
    captured = {}
    monkeypatch.setattr(aage_routes, "uses_excel_grader", lambda *a, **k: True)
    monkeypatch.setattr(jobs, "active_job", lambda *a, **k: None)
    monkeypatch.setattr(
        jobs,
        "enqueue_grade_job",
        lambda **kwargs: (captured.update(kwargs)
                          or SimpleNamespace(
                              id=91, status="queued",
                              to_dict=lambda: {
                                  "id": 91, "status": "queued",
                                  "submission_type": "assignment",
                                  "submission_id": env["submission"].id,
                              })),
    )

    response = client.post(
        "/api/v1/aage/grading/unified/start",
        json={"submission_type": "assignment",
              "submission_id": env["submission"].id},
        headers=_auth(app, env["instructor"]),
    )
    assert response.status_code == 201
    body = response.get_json()["data"]
    assert body["engine"] == "aage"
    assert body["specialist"] == "spreadsheet"
    assert "fallback_from" not in body
    assert "fallback_reason" not in body
    assert captured["submission_id"] == env["submission"].id


def test_unified_status_enforces_course_ownership(app, client, env, monkeypatch):
    monkeypatch.setattr(aage_routes, "uses_excel_grader", lambda *a, **k: False)
    response = client.get(
        f"/api/v1/aage/grading/unified/status/assignment/{env['submission'].id}",
        headers=_auth(app, env["other"]),
    )
    assert response.status_code == 403
    assert response.get_json()["error"]["code"] == "forbidden"
