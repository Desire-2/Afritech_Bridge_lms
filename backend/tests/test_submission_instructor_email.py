"""Instructor must receive an email when a student submits an assignment/project."""

import hashlib
import time
import uuid

import pytest
from flask_jwt_extended import create_access_token

import src.utils.email_notifications as email_notifications
from src.models.course_models import Assignment, AssignmentSubmission, Course, Enrollment, Project, ProjectSubmission
from src.models.user_models import Role, User, db
from src.utils.time_utils import now_local


@pytest.fixture()
def env(app):
    with app.app_context():
        db.create_all()

        tag = uuid.uuid4().hex[:8]

        def get_or_create_role(name):
            role = Role.query.filter_by(name=name).first()
            if role is None:
                role = Role(name=name)
                db.session.add(role)
                db.session.flush()
            return role

        instructor = User(
            username=f"inst_{tag}",
            email=f"instructor_{tag}@afritech.test",
            password_hash=hashlib.sha256(b"x").hexdigest(),
            role_id=get_or_create_role("instructor").id,
            first_name="Ines",
            last_name="Tructor",
        )
        student = User(
            username=f"stud_{tag}",
            email=f"student_{tag}@afritech.test",
            password_hash=hashlib.sha256(b"x").hexdigest(),
            role_id=get_or_create_role("student").id,
            first_name="Stu",
            last_name="Dent",
        )
        db.session.add_all([instructor, student])
        db.session.flush()

        course = Course(
            title=f"Course {tag}",
            description="Test course",
            instructor_id=instructor.id,
        )
        db.session.add(course)
        db.session.flush()

        assignment = Assignment(
            title=f"Assignment {tag}",
            description="Test assignment",
            course_id=course.id,
            instructor_id=instructor.id,
            assignment_type="both",
            is_published=True,
        )
        project = Project(
            title=f"Project {tag}",
            description="Test project",
            course_id=course.id,
            module_ids="[]",
            due_date=now_local(),
            is_published=True,
        )
        db.session.add_all([assignment, project])
        db.session.flush()

        db.session.add(Enrollment(student_id=student.id, course_id=course.id))
        db.session.commit()

        data = {
            "instructor_id": instructor.id,
            "instructor_email": instructor.email,
            "student_id": student.id,
            "course_title": course.title,
            "assignment_id": assignment.id,
            "assignment_title": assignment.title,
            "project_id": project.id,
            "project_title": project.title,
        }

    # Yield outside the app context so each test/request gets a fresh session
    # instead of reusing (and getting a stale snapshot from) this one.
    yield data


@pytest.fixture()
def sent_emails(monkeypatch):
    captured = []

    def fake_send_email(**kwargs):
        captured.append(kwargs)
        return True

    monkeypatch.setattr(email_notifications.brevo_service, "send_email", fake_send_email)
    return captured


def _wait_for_emails(captured, count, timeout=5.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if len(captured) >= count:
            return True
        time.sleep(0.05)
    return False


def test_assignment_submission_notifies_instructor(app, env, sent_emails):
    with app.app_context():
        submission = AssignmentSubmission(
            assignment_id=env["assignment_id"],
            student_id=env["student_id"],
            content="My answer",
        )
        db.session.add(submission)
        db.session.commit()
        submission_id = submission.id

        ok = email_notifications.notify_instructor_of_submission(
            submission, is_project=False, background=False
        )
        assert ok is True

    assert len(sent_emails) == 1
    email = sent_emails[0]
    assert email["to_emails"] == [env["instructor_email"]]
    assert env["assignment_title"] in email["subject"]
    assert "Stu Dent" in email["html_content"]
    assert env["course_title"] in email["html_content"]
    assert f"/instructor/grading/assignment/{submission_id}" in email["html_content"]


def test_project_submission_notifies_instructor(app, env, sent_emails):
    with app.app_context():
        submission = ProjectSubmission(
            project_id=env["project_id"],
            student_id=env["student_id"],
            text_content="Built an app",
        )
        db.session.add(submission)
        db.session.commit()
        submission_id = submission.id

        ok = email_notifications.notify_instructor_of_submission(
            submission, is_project=True, background=False
        )
        assert ok is True

    assert len(sent_emails) == 1
    email = sent_emails[0]
    assert email["to_emails"] == [env["instructor_email"]]
    assert env["project_title"] in email["subject"]
    assert "Stu Dent" in email["html_content"]
    assert f"/instructor/grading/project/{submission_id}" in email["html_content"]


def test_assignment_submit_endpoint_sends_instructor_email(app, env, sent_emails):
    token = create_access_token(identity=str(env["student_id"]))
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    resp = app.test_client().post(
        f"/api/v1/uploads/assignments/{env['assignment_id']}/submit-with-files",
        json={"content": "Submitted via endpoint"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.get_json()

    assert _wait_for_emails(sent_emails, 1), "instructor email was never sent"
    assert sent_emails[0]["to_emails"] == [env["instructor_email"]]
    assert env["assignment_title"] in sent_emails[0]["subject"]


def test_project_submit_endpoint_sends_instructor_email(app, env, sent_emails):
    token = create_access_token(identity=str(env["student_id"]))
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    resp = app.test_client().post(
        f"/api/v1/student/projects/{env['project_id']}/submit",
        json={"text_content": "Project deliverable"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.get_json()

    assert _wait_for_emails(sent_emails, 1), "instructor email was never sent"
    assert sent_emails[0]["to_emails"] == [env["instructor_email"]]
    assert env["project_title"] in sent_emails[0]["subject"]


def test_json_assignment_submit_endpoint_sends_instructor_email(app, env, sent_emails):
    """The alternate JSON endpoint must notify the instructor too."""
    token = create_access_token(identity=str(env["student_id"]))
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    resp = app.test_client().post(
        f"/api/v1/student/assignments/{env['assignment_id']}/submit",
        json={"content": "JSON endpoint answer"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.get_json()

    assert _wait_for_emails(sent_emails, 1), "instructor email was never sent"
    assert sent_emails[0]["to_emails"] == [env["instructor_email"]]
    assert env["assignment_title"] in sent_emails[0]["subject"]


def test_resubmit_endpoint_notifies_instructor(app, env, sent_emails):
    """A resubmission after a modification request also emails the instructor."""
    with app.app_context():
        assignment = db.session.get(Assignment, env["assignment_id"])
        assignment.modification_requested = True
        assignment.can_resubmit = True
        submission = AssignmentSubmission(
            assignment_id=env["assignment_id"],
            student_id=env["student_id"],
            content="First attempt",
        )
        db.session.add(submission)
        db.session.commit()

    token = create_access_token(identity=str(env["student_id"]))
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    resp = app.test_client().post(
        f"/api/v1/uploads/assignments/{env['assignment_id']}/resubmit-with-files",
        json={"content": "Fixed version"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.get_json()

    assert _wait_for_emails(sent_emails, 1), "instructor email was never sent"
    assert sent_emails[0]["to_emails"] == [env["instructor_email"]]
    assert "Resubmitted" in sent_emails[0]["subject"]


def test_opted_out_instructor_gets_no_email(app, env, sent_emails):
    with app.app_context():
        instructor = db.session.get(User, env["instructor_id"])
        instructor.email_notifications = False
        db.session.commit()

        submission = AssignmentSubmission(
            assignment_id=env["assignment_id"],
            student_id=env["student_id"],
            content="Answer",
        )
        db.session.add(submission)
        db.session.commit()

        ok = email_notifications.notify_instructor_of_submission(
            submission, is_project=False, background=False
        )
        assert ok is False

    assert sent_emails == []
