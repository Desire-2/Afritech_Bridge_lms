"""Project files use the same Vercel Blob metadata flow as assignment files.

The student surfaces now upload through the shared Next.js `/api/upload` route
and post the returned file records to Flask. Flask must persist the JSON array
in ``ProjectSubmission.file_path`` (assignment submissions use ``file_url``),
still accept a bare legacy URL, and expose parsed metadata in ``to_dict()`` and
``GET /uploads/projects/<id>/files``.
"""

import json
import uuid
from datetime import datetime, timedelta

import pytest
from flask_jwt_extended import create_access_token

from src.models.course_models import Course, Enrollment, Project, ProjectSubmission
from src.models.user_models import User, Role, db
from src.utils.submission_files import (
    parse_submission_files,
    serialize_submission_files,
)

BLOB_URL = (
    "https://acme.public.blob.vercel-storage.com/projects/12/34/"
    "report_abc123_final_report.pdf"
)


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
            username=f"blob_{suffix}",
            email=f"blob_{suffix}@example.test",
            role_id=role.id,
        )
        student.set_password("Password123!")
        db.session.add(student)
        db.session.flush()

        instructor = User(
            username=f"blob_i_{suffix}",
            email=f"blob_i_{suffix}@example.test",
            role_id=role.id,
        )
        instructor.set_password("Password123!")
        db.session.add(instructor)
        db.session.flush()

        course = Course(
            title=f"Blob Project {suffix}",
            description="blob file handling tests",
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
            title="Upload a report",
            description="Upload your report",
            course_id=course.id,
            module_ids="[]",
            due_date=datetime.utcnow() + timedelta(days=7),
            is_published=True,
            submission_format="file_upload",
            max_file_size_mb=25,
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

    with app.app_context():
        ProjectSubmission.query.filter_by(project_id=ids["project_id"]).delete()
        db.session.commit()


def _token(app, student_id):
    with app.app_context():
        return create_access_token(identity=str(student_id))


def _headers(app, student_id):
    return {"Authorization": f"Bearer {_token(app, student_id)}"}


def test_parse_and_serialize_assignment_shaped_metadata():
    files = [{
        "url": BLOB_URL,
        "filename": "report.pdf",
        "size": 4321,
        "contentType": "application/pdf",
        "uploadedAt": "2026-11-27T10:00:00.000Z",
        "storage": "vercel_blob",
    }]
    stored = serialize_submission_files({"files": files})
    assert json.loads(stored) == files

    parsed = parse_submission_files(stored)
    assert parsed[0]["url"] == BLOB_URL
    assert parsed[0]["filename"] == "report.pdf"
    assert parsed[0]["storage"] == "vercel_blob"


def test_legacy_single_url_and_name_key_are_still_read():
    records = parse_submission_files(
        json.dumps([{"url": BLOB_URL, "name": "old-name.pdf"}]),
        "fallback.pdf",
    )
    assert records[0]["filename"] == "old-name.pdf"

    bare = parse_submission_files(BLOB_URL)
    assert bare == [{"url": BLOB_URL, "filename": "report_abc123_final_report.pdf"}]

    stored = serialize_submission_files({"file_url": BLOB_URL})
    assert json.loads(stored)[0]["url"] == BLOB_URL


def test_project_submit_persists_blob_metadata_array(env, app, client, monkeypatch):
    monkeypatch.setattr(
        "src.routes.student_routes.enqueue_for_submission", lambda **kwargs: None
    )
    files = [{
        "url": BLOB_URL,
        "filename": "report.pdf",
        "size": 4321,
        "contentType": "application/pdf",
        "uploadedAt": "2026-11-27T10:00:00.000Z",
        "storage": "vercel_blob",
    }]
    response = client.post(
        f"/api/v1/student/projects/{env['project_id']}/submit",
        json={"text_content": "done", "files": files, "file_url": BLOB_URL},
        headers=_headers(app, env["student_id"]),
    )
    assert response.status_code in (200, 201), response.get_json()

    with app.app_context():
        row = ProjectSubmission.query.filter_by(
            project_id=env["project_id"], student_id=env["student_id"]
        ).one()
        assert json.loads(row.file_path) == files
        payload = row.to_dict()
        assert payload["files"] == files
        assert payload["files_count"] == 1

    files_response = client.get(
        f"/api/v1/uploads/projects/{env['project_id']}/files",
        headers=_headers(app, env["student_id"]),
    )
    assert files_response.status_code == 200
    body = files_response.get_json()
    assert body["files"][0]["url"] == BLOB_URL
    assert body["files"][0]["filename"] == "report.pdf"


def test_project_submit_accepts_legacy_file_url(env, app, client, monkeypatch):
    monkeypatch.setattr(
        "src.routes.student_routes.enqueue_for_submission", lambda **kwargs: None
    )
    response = client.post(
        f"/api/v1/student/projects/{env['project_id']}/submit",
        json={"text_content": "old client", "file_url": BLOB_URL},
        headers=_headers(app, env["student_id"]),
    )
    assert response.status_code in (200, 201), response.get_json()

    with app.app_context():
        row = ProjectSubmission.query.filter_by(
            project_id=env["project_id"], student_id=env["student_id"]
        ).one()
        assert json.loads(row.file_path)[0]["url"] == BLOB_URL
