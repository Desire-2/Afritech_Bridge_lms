"""Schema audit: the migrations must build exactly what the models describe.

Every check runs against a throwaway SQLite file built from revision ``base``
in a subprocess (``flask db upgrade``) — never ``dev.db`` / ``test.db``.

Catches the drift a fresh clone would hit:
  * a model table/column/index added without a matching migration,
  * a migration whose result no longer matches the models,
  * type / nullable / foreign-key drift between the two,
  * a downgrade that cannot be run back up.
"""
import os
import pathlib
import shutil
import sqlite3
import subprocess
import sys

import pytest
from alembic.autogenerate import compare_metadata
from alembic.config import Config as AlembicConfig
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine

import app.models  # noqa: F401 - populates db.metadata without an app instance
from app.extensions import db

BACKEND = pathlib.Path(__file__).resolve().parents[1]

# Indexes effee61c40c4 added; they must exist after every upgrade and vanish
# on downgrade (they are created by no other revision).
AUDIT_INDEXES = {
    'ix_shop_sales_created_at': 'shop_sales',
    'ix_shop_sales_branch_created_at': 'shop_sales',
    'ix_notifications_recipient_read': 'notifications',
    'ix_employees_branch_id': 'employees',
    'ix_shop_returns_branch_id': 'shop_returns',
}


# ── helpers ──────────────────────────────────────────────────────────────────

def _script_directory():
    cfg = AlembicConfig(str(BACKEND / 'migrations' / 'alembic.ini'))
    cfg.set_main_option('script_location', str(BACKEND / 'migrations'))
    return ScriptDirectory.from_config(cfg)


def _revision_chain():
    """Head first, then each parent, down to ``base``."""
    script = _script_directory()
    chain = []
    revision = script.get_revision(script.get_current_head())
    while revision is not None:
        chain.append(revision.revision)
        parent = revision.down_revision
        if isinstance(parent, (tuple, list)):
            parent = parent[0] if parent else None
        revision = script.get_revision(parent) if parent else None
    return chain


def _flask_db(*args, database):
    env = os.environ.copy()
    env.update({
        'DATABASE_URL': f'sqlite:///{database}',
        'FLASK_APP': 'app.py',
        'FLASK_CONFIG': 'development',
        'AUTOMATION_ENABLED': 'false',
    })
    # the test runner's DB must never be the migration target
    env.pop('TEST_DATABASE_URL', None)
    return subprocess.run(
        [sys.executable, '-m', 'flask', 'db', *args],
        cwd=BACKEND, env=env, capture_output=True, text=True,
    )


def _version(path):
    with sqlite3.connect(path) as conn:
        row = conn.execute('SELECT version_num FROM alembic_version').fetchone()
    return row[0] if row else None


def _indexes(path):
    with sqlite3.connect(path) as conn:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'index'").fetchall()
    return {name for (name,) in rows}


def _tables(path):
    with sqlite3.connect(path) as conn:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    return {name for (name,) in rows if not name.startswith('sqlite_')}


def _metadata_diffs(path, **opts):
    engine = create_engine(f'sqlite:///{path}')
    try:
        with engine.connect() as conn:
            ctx = MigrationContext.configure(
                conn, opts={'compare_type': True, 'user_module_prefix': None, **opts})
            return compare_metadata(ctx, db.metadata)
    finally:
        engine.dispose()


@pytest.fixture(scope='module')
def migrated(tmp_path_factory):
    """A SQLite database upgraded from nothing to the head revision."""
    path = tmp_path_factory.mktemp('alembic') / 'audit.db'
    proc = _flask_db('upgrade', database=path)
    assert proc.returncode == 0, f'stdout:\n{proc.stdout}\nstderr:\n{proc.stderr}'
    return path


# ── tests ────────────────────────────────────────────────────────────────────

def test_upgrade_from_zero_reaches_head(migrated):
    assert _version(migrated) == _script_directory().get_current_head()


def test_every_model_table_exists(migrated):
    db_tables = _tables(migrated)
    missing = set(db.metadata.tables) - db_tables
    assert not missing, f'model tables missing from the migrated DB: {sorted(missing)}'


def test_no_orphan_tables_in_migration(migrated):
    extra = _tables(migrated) - set(db.metadata.tables) - {'alembic_version'}
    assert not extra, f'tables created by migrations but absent from models: {sorted(extra)}'


def test_schema_matches_models(migrated):
    diffs = _metadata_diffs(migrated)
    assert diffs == [], f'structural drift between models and migrations: {diffs}'


def test_server_default_drift_is_benign(migrated):
    """The DB may carry a ``server_default`` the model omits (it never differs
    the other way), but nothing structural may hide behind it."""
    diffs = _metadata_diffs(migrated, compare_server_default=True)
    # alembic groups a column's changes in a one-element list
    flat = [item for group in diffs for item in
            (group if isinstance(group, list) else (group,))]
    unexpected = [d for d in flat if d[0] != 'modify_default']
    assert not unexpected, unexpected


def test_audit_indexes_exist(migrated):
    present = _indexes(migrated)
    missing = {name: table for name, table in AUDIT_INDEXES.items() if name not in present}
    assert not missing, f'missing indexes: {missing}'


def test_downgrade_then_upgrade_is_reversible(migrated, tmp_path):
    chain = _revision_chain()
    if len(chain) < 3:
        pytest.skip('fewer than three revisions — nothing to step back through')
    target = chain[2]
    path = tmp_path / 'roundtrip.db'
    shutil.copy(migrated, path)

    proc = _flask_db('downgrade', target, database=path)
    assert proc.returncode == 0, f'stdout:\n{proc.stdout}\nstderr:\n{proc.stderr}'
    assert _version(path) == target
    leftover = set(AUDIT_INDEXES) & _indexes(path)
    assert not leftover, f'indexes survived the downgrade: {sorted(leftover)}'

    proc = _flask_db('upgrade', database=path)
    assert proc.returncode == 0, f'stdout:\n{proc.stdout}\nstderr:\n{proc.stderr}'
    assert _version(path) == _script_directory().get_current_head()
    assert set(AUDIT_INDEXES) <= _indexes(path)
    assert _metadata_diffs(path) == []
