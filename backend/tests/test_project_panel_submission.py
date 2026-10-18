"""A scaffolded team row must not count as a submitted project.

Instructor "assign teams" creates a ProjectSubmission row for the primary
student with no text, no file and (since the team-collab integrity migration)
no ``submitted_at``. ``GET /student/projects/<id>/details`` used to answer
``submitted: True`` for any existing row, so the learning interface showed the
student a "Submitted" badge with no Start/Submit area at all.
"""

import uuid
from datetime import datetime, timedelta

import pytest
from flask_jwt_extended import create_access_token

from src.models.course_models import Course, Enrollment, Project, ProjectSubmission
from src.models.user_models import User, Role, db


@pytest.fixture()
def env(app):
    with app.app_context():
        db.create_all()
        suffix = uuid.uuid4().hex[:10]

        role = Role.query.filter_by(name="student").first()
        if role is None:
            role = Role(name="student")
            db.session.add(role)
            db.session.flush()

        student = User(
            username=f"pp_{suffix}",
            email=f"pp_{suffix}@example.test",
            role_id=role.id,
        )
        student.set_password("Password123!")
        db.session.add(student)
        db.session.flush()

        instructor = User(
            username=f"ppi_{suffix}",
            email=f"ppi_{suffix}@example.test",
            role_id=role.id,
        )
        instructor.set_password("Password123!")
        db.session.add(instructor)
        db.session.flush()

        course = Course(
            title=f"Project Panel {suffix}",
            description="project panel tests",
            instructor_id=instructor.id,
            is_published=True,
            enrollment_type="free",
        )
        db.session.add(course)
        db.session.flush()

        db.session.add(
            Enrollment(student_id=student.id, course_id=course.id, status="active")
        )

        project = Project(
            title="Build a thing",
            description="**Describe** the thing",
            course_id=course.id,
            module_ids="[]",
            due_date=datetime.utcnow() + timedelta(days=7),
            is_published=True,
            submission_format="file_upload",
            max_file_size_mb=25,
            allowed_file_types=".pdf,.docx",
        )
        db.session.add(project)
        db.session.flush()

        ids = {
            "student_id": student.id,
            "course_id": course.id,
            "project_id": project.id,
        }
        db.session.commit()

    yield ids


def _get_details(client, app, student_id, project_id):
    with app.app_context():
        token = create_access_token(identity=str(student_id))
    return client.get(
        f"/api/v1/student/projects/{project_id}/details",
        headers={"Authorization": f"Bearer {token}"},
    )


def _scaffold(app, project_id, student_id, **kwargs):
    """Create the empty team row the instructor's assign-teams leaves behind."""
    with app.app_context():
        row = ProjectSubmission(
            project_id=project_id,
            student_id=student_id,
            submitted_at=kwargs.get("submitted_at"),
            text_content=kwargs.get("text_content"),
            file_path=kwargs.get("file_path"),
            grade=kwargs.get("grade"),
            feedback=kwargs.get("feedback"),
        )
        if kwargs.get("team_members") is not None:
            row.set_team_members(kwargs["team_members"])
        db.session.add(row)
        db.session.commit()
        return row.id


def test_scaffolded_team_row_is_not_submitted(env, client, app):
    """Empty instructor-assigned team row -> student can still start."""
    _scaffold(
        app,
        env["project_id"],
        env["student_id"],
        team_members=[991, 992],
        submitted_at=None,
    )

    response = _get_details(client, app, env["student_id"], env["project_id"])
    assert response.status_code == 200
    body = response.get_json()

    status = body["project"]["submission_status"]
    assert status["submitted"] is False
    assert status["status"] == "not_submitted"
    # The row is still handed back so the student fills the same team row in.
    assert body["submission"] is not None


def test_real_text_submission_counts(env, client, app):
    _scaffold(
        app,
        env["project_id"],
        env["student_id"],
        text_content="Here is my write-up",
        submitted_at=datetime.utcnow(),
    )

    status = _get_details(client, app, env["student_id"], env["project_id"]
                          ).get_json()["project"]["submission_status"]
    assert status["submitted"] is True
    assert status["status"] == "submitted"


def test_real_file_submission_counts(env, client, app):
    _scaffold(
        app,
        env["project_id"],
        env["student_id"],
        file_path="https://cdn.example.test/report.pdf",
        submitted_at=datetime.utcnow(),
    )

    status = _get_details(client, app, env["student_id"], env["project_id"]
                          ).get_json()["project"]["submission_status"]
    assert status["submitted"] is True


def test_legacy_scaffold_with_timestamp_but_no_content_is_not_submitted(
    env, client, app
):
    """Rows written before submitted_at became nullable still get to start."""
    _scaffold(
        app,
        env["project_id"],
        env["student_id"],
        submitted_at=datetime.utcnow(),
        team_members=[991],
    )

    status = _get_details(client, app, env["student_id"], env["project_id"]
                          ).get_json()["project"]["submission_status"]
    assert status["submitted"] is False


def test_graded_row_counts_even_without_content(env, client, app):
    _scaffold(app, env["project_id"], env["student_id"], grade=88.5,
              feedback="Nice work")

    status = _get_details(client, app, env["student_id"], env["project_id"]
                          ).get_json()["project"]["submission_status"]
    assert status["submitted"] is True
    assert status["status"] == "graded"
    assert status["grade"] == 88.5


def test_serialised_submission_exposes_file_path_not_file_url(env, client, app):
    """The panel links the attached file; to_dict() emits file_path."""
    _scaffold(
        app,
        env["project_id"],
        env["student_id"],
        file_path="https://cdn.example.test/report.pdf",
        submitted_at=datetime.utcnow(),
    )

    submission = _get_details(client, app, env["student_id"], env["project_id"]
                              ).get_json()["submission"]
    assert submission["file_path"] == "https://cdn.example.test/report.pdf"
    assert submission.get("file_url") is None
