"""Regressions for production boot/runtime failures seen on PostgreSQL.

* A boolean backfill written as the integer 0 aborted the shared schema
  connection, silently skipping every later self-heal table.
* The per-submission project revision columns were never added on a deployment
  that does not run ``flask db upgrade``, so scoring endpoints 500'd.
* ``time_spent`` NULLs broke the module-progress endpoint.
* Service-account JSON with escaped PEM newlines broke Google Drive.
"""

import json

import pytest
import sqlalchemy as sa


def test_module_time_analytics_ignores_null_time_spent(app):
    from src.models.user_models import db, User, Role
    from src.models.course_models import Course, Module, Lesson
    from src.models.student_models import LessonCompletion
    from src.services.analytics_service import AnalyticsService

    with app.app_context():
        tag = "prod_fix_analytics"
        role = Role.query.filter_by(name="student").first()
        if role is None:
            role = Role(name="student")
            db.session.add(role)
            db.session.flush()
        student = User(
            username=tag,
            email=f"{tag}@example.test",
            password_hash="x",
            role_id=role.id,
        )
        instructor = User(
            username=f"{tag}_t",
            email=f"{tag}_t@example.test",
            password_hash="x",
            role_id=role.id,
        )
        db.session.add_all([student, instructor])
        db.session.flush()

        course = Course(
            title=f"{tag} course", description="d", instructor_id=instructor.id
        )
        db.session.add(course)
        db.session.flush()
        module = Module(title=f"{tag} module", course_id=course.id, order=1)
        db.session.add(module)
        db.session.flush()
        lessons = [
            Lesson(
                title=f"{tag} lesson {n}",
                content_type="text",
                content_data="body",
                module_id=module.id,
                order=n,
            )
            for n in (1, 2)
        ]
        db.session.add_all(lessons)
        db.session.flush()

        db.session.add_all([
            LessonCompletion(student_id=student.id, lesson_id=lessons[0].id, time_spent=None),
            LessonCompletion(student_id=student.id, lesson_id=lessons[1].id, time_spent=120),
        ])
        db.session.commit()

        result = AnalyticsService._get_module_time_analytics(student.id, module.id)
        assert result["total_minutes"] == 2
        assert result["sessions"] == 2

        db.session.rollback()
        db.session.remove()


def test_aage_schema_backfills_legacy_boolean_columns(app):
    from src.models.aage_models import ensure_aage_schema

    engine = sa.create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(sa.text(
            "CREATE TABLE rubrics ("
            "id INTEGER PRIMARY KEY, name VARCHAR(200), "
            "created_by INTEGER, max_score FLOAT, "
            "is_active BOOLEAN, is_template BOOLEAN)"
        ))
        conn.execute(sa.text(
            "INSERT INTO rubrics "
            "(name, created_by, max_score, is_active, is_template) "
            "VALUES ('legacy', 1, 100, NULL, NULL)"
        ))

    ensure_aage_schema(engine, None)

    with engine.connect() as conn:
        row = conn.execute(sa.text(
            "SELECT title, instructor_id, total_points, is_template, is_active "
            "FROM rubrics"
        )).one()
    assert row.title == "legacy"
    assert row.instructor_id == 1
    assert row.total_points == 100
    assert row.is_template == 0
    assert row.is_active == 1


def test_auto_migration_adds_project_submission_revision_columns(monkeypatch):
    import main
    from main import _auto_migrate_missing_columns

    engine = sa.create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(sa.text(
            "CREATE TABLE project_submissions ("
            "id INTEGER PRIMARY KEY, project_id INTEGER, student_id INTEGER)"
        ))

    class _DB:
        pass

    _DB.engine = engine
    monkeypatch.setattr(main, "db", _DB)
    _auto_migrate_missing_columns(engine)

    with engine.connect() as conn:
        columns = {c["name"] for c in sa.inspect(conn).get_columns("project_submissions")}
        rows = conn.execute(sa.text(
            "SELECT modification_requested, can_resubmit FROM project_submissions"
        )).fetchall()
    assert {
        "modification_requested", "modification_request_reason",
        "modification_requested_at", "modification_requested_by", "can_resubmit",
    } <= columns
    assert rows == []


def test_google_drive_normalizes_escaped_private_key(monkeypatch):
    from src.utils import google_drive_service as gds

    payload = {
        "type": "service_account",
        "project_id": "p",
        "private_key_id": "kid",
        "private_key": "-----BEGIN PRIVATE KEY-----\\nABC=\\n-----END PRIVATE KEY-----\\n",
        "client_email": "bot@p.iam.gserviceaccount.com",
        "client_id": "1",
        "token_uri": "https://oauth2.googleapis.com/token",
    }
    monkeypatch.setenv("GOOGLE_SERVICE_ACCOUNT_JSON", json.dumps(payload))
    monkeypatch.delenv("GOOGLE_DRIVE_DELEGATED_USER", raising=False)

    captured = {}

    def _fake_from_info(info, scopes=None, subject=None):
        captured["key"] = info["private_key"]
        return object()

    monkeypatch.setattr(gds.Credentials, "from_service_account_info", _fake_from_info)
    monkeypatch.setattr(gds, "build", lambda *a, **kw: object())

    service = gds.GoogleDriveService()
    assert service.is_configured is True
    assert "\n" in captured["key"]
    assert "\\n" not in captured["key"]
