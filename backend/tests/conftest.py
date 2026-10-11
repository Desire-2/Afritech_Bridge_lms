"""Shared pytest fixtures for the AI workflow suite.

DATABASE_URL is pointed at a throwaway sqlite file BEFORE any app import so
``main.py`` builds the whole schema (incl. workflow tables + auto-migration)
against it — independent of the developer's local dev DB.

The schema is recreated on demand (``db.create_all``) so the workflow tests
stay reliable even when other suites (e.g. internship tests) run
``db.drop_all()`` on the shared engine mid-session.
"""

import os
import tempfile

_DB_FILE = tempfile.mktemp(suffix=".db", prefix="afritech_test_")
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE}"
os.environ.setdefault("FLASK_ENV", "development")
os.environ.setdefault("FLASK_SECRET_KEY", "test-secret-key")

import pytest  # noqa: E402

import main  # noqa: E402,F401  (constructs the app against the temp DB)


@pytest.fixture(scope="session")
def app():
    from main import app as flask_app

    # Allow pooled sqlite connections (created in scheduler worker threads) to
    # be reused by the main thread. Safe for tests; the pool is private here.
    opts = flask_app.config.setdefault("SQLALCHEMY_ENGINE_OPTIONS", {})
    ca = opts.setdefault("connect_args", {})
    ca["check_same_thread"] = False
    ca["timeout"] = 30

    with flask_app.app_context():
        from src.models.user_models import db
        from sqlalchemy import event

        @event.listens_for(db.engine, "connect")
        def _set_sqlite_pragmas(dbapi_connection, connection_record):
            """Long busy_timeout so worker threads block instead of aborting
            on SQLITE_BUSY during the concurrent scheduler test."""
            cursor = dbapi_connection.cursor()
            try:
                cursor.execute("PRAGMA busy_timeout=30000")
            finally:
                cursor.close()

        yield flask_app


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def instructor(app):
    """Function-scoped: recreate schema if a sibling suite dropped it, then
    create a unique instructor row."""
    from src.models.user_models import db, User, Role

    db.create_all()
    role = Role.query.filter_by(name="instructor").first()
    if role is None:
        role = Role(name="instructor")
        db.session.add(role)
        db.session.flush()

    import hashlib
    import uuid

    tag = uuid.uuid4().hex[:8]
    user = User(
        username=f"wf_test_{tag}",
        email=f"wf_test_{tag}@afritech.test",
        password_hash=hashlib.sha256(b"x").hexdigest(),
        role_id=role.id,
    )
    db.session.add(user)
    db.session.commit()
    db.session.refresh(user)
    return user