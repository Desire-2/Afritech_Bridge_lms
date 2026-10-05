"""Tests for the production-safe migration runner (scripts/migrate.py).

These are hermetic: everything either only *inspects* state or migrates a
throwaway SQLite file. No test may touch the database named in `.env`.
"""
import time

import pytest

from scripts import migrate
from sqlalchemy import create_engine, text


# ── target resolution ─────────────────────────────────────────────────────────


def test_refuses_when_database_url_is_unset(monkeypatch):
    import config  # noqa: F401  (runs load_dotenv once, so it cannot refill below)
    monkeypatch.delenv('DATABASE_URL', raising=False)
    with pytest.raises(migrate.RefusedError, match='DATABASE_URL is not set'):
        migrate.resolve_database_url()


def test_refuses_sqlite_without_allow_flag(monkeypatch, tmp_path):
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{tmp_path}/x.db')
    with pytest.raises(migrate.RefusedError, match='points at SQLite'):
        migrate.resolve_database_url()


def test_accepts_sqlite_with_allow_flag(monkeypatch, tmp_path):
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{tmp_path}/x.db')
    url = migrate.resolve_database_url(allow_sqlite=True)
    assert url.get_backend_name() == 'sqlite'


def test_refuses_url_without_host(monkeypatch):
    monkeypatch.setenv('DATABASE_URL', 'postgresql://user:pw@/mydb')
    with pytest.raises(migrate.RefusedError, match='no host'):
        migrate.resolve_database_url()


def test_refuses_url_without_database(monkeypatch):
    monkeypatch.setenv('DATABASE_URL', 'postgresql://user:pw@somehost:5432')
    with pytest.raises(migrate.RefusedError, match='names no database'):
        migrate.resolve_database_url()


def test_refuses_malformed_url(monkeypatch):
    monkeypatch.setenv('DATABASE_URL', 'not a url at all')
    with pytest.raises(migrate.RefusedError, match='not a valid database URL'):
        migrate.resolve_database_url()


def test_password_is_redacted(monkeypatch):
    monkeypatch.setenv('DATABASE_URL', 'postgresql://avnpwd:s3cr3t-here@db.example:5432/app')
    redacted = migrate.redact(migrate.resolve_database_url())
    assert 's3cr3t-here' not in redacted
    assert '***' in redacted
    assert 'db.example' in redacted


# ── alembic introspection ─────────────────────────────────────────────────────


def test_pending_revisions_ordered_oldest_first_on_empty_db():
    script = migrate.alembic_scripts()
    head, pending = migrate.pending_revisions(script, None)
    assert pending, 'expected a non-empty migration history'
    assert migrate.fmt(pending).split(', ')[0] == pending[-1]
    assert migrate.fmt(pending).split(', ')[-1] == head
    assert head in pending


def test_pending_revisions_empty_when_at_head():
    script = migrate.alembic_scripts()
    head = script.get_current_head()
    _, pending = migrate.pending_revisions(script, head)
    assert pending == []


# ── backup guards ─────────────────────────────────────────────────────────────


def test_pg_dump_refuses_sqlite(tmp_path):
    from sqlalchemy.engine import make_url

    url = make_url(f'sqlite:///{tmp_path}/x.db')
    with pytest.raises(migrate.MigrationError, match='only supports PostgreSQL'):
        migrate.pg_dump_schema(url, tmp_path / 'out.sql')


def test_pg_dump_refuses_when_client_missing(tmp_path, monkeypatch):
    from sqlalchemy.engine import make_url

    monkeypatch.setattr(migrate.shutil, 'which', lambda name: None)
    url = make_url('postgresql://user:pw@host:5432/app')
    with pytest.raises(migrate.MigrationError, match='needs the pg_dump client'):
        migrate.pg_dump_schema(url, tmp_path / 'out.sql')


# ── end to end against a throwaway SQLite database ────────────────────────────


def _migrate(monkeypatch, db_path, *extra):
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{db_path}')
    return migrate.main(['--allow-sqlite', *extra])


def test_full_apply_then_idempotent_rerun_and_status(monkeypatch, tmp_path):
    db_path = tmp_path / 'fresh.db'

    assert _migrate(monkeypatch, db_path, '--yes') == migrate.EXIT_OK

    engine = create_engine(f'sqlite:///{db_path}')
    with engine.connect() as conn:
        landed = conn.execute(text('select version_num from alembic_version')).scalar()
    assert landed == migrate.alembic_scripts().get_current_head()

    # A second run must be a no-op rather than re-applying DDL.
    assert _migrate(monkeypatch, db_path, '--yes') == migrate.EXIT_OK

    # --status reports at-head and exits 0.
    assert _migrate(monkeypatch, db_path, '--status') == migrate.EXIT_OK

    # --dry-run writes nothing and succeeds.
    assert _migrate(monkeypatch, db_path, '--dry-run') == migrate.EXIT_OK
    with engine.connect() as conn:
        assert conn.execute(text('select version_num from alembic_version')).scalar() == landed


def test_refuses_to_migrate_without_confirmation(monkeypatch, tmp_path):
    # pytest's stdin is not a TTY, so the runner must refuse rather than guess.
    assert _migrate(monkeypatch, tmp_path / 'never.db') == migrate.EXIT_REFUSED

    engine = create_engine(f'sqlite:///{tmp_path}/never.db')
    assert not migrate.current_version(engine), 'refusal must not create tables'


def test_status_exits_nonzero_when_behind_head(monkeypatch, tmp_path):
    assert _migrate(monkeypatch, tmp_path / 'behind.db', '--status') == migrate.EXIT_FAILED


def test_status_and_dry_run_are_mutually_exclusive(tmp_path, monkeypatch):
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{tmp_path}/x.db')
    with pytest.raises(SystemExit) as exc:
        migrate.main(['--allow-sqlite', '--status', '--dry-run'])
    assert exc.value.code == 2


def test_unknown_flag_rejected(monkeypatch, tmp_path):
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{tmp_path}/x.db')
    with pytest.raises(SystemExit) as exc:
        migrate.main(['--allow-sqlite', '--definitely-not-a-flag'])
    assert exc.value.code == 2


def test_lock_wait_gives_up_after_timeout(monkeypatch):
    class FakeConn:
        def execution_options(self, **kw):
            return self

        def execute(self, *a, **kw):
            return type('R', (), {'scalar': staticmethod(lambda: False)})()

        def close(self):
            return None

    class FakeEngine:
        def connect(self):
            return FakeConn()

    started = time.monotonic()
    with pytest.raises(migrate.MigrationError, match='gave up waiting'):
        migrate.acquire_lock(FakeEngine(), 1)
    assert time.monotonic() - started < 30
