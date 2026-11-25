"""Verify the Talent Passport Alembic revision end to end.

The script creates an isolated SQLite database, simulates an existing database
still stamped at the previous Alembic head with the Passport tables absent, and
exercises the real Flask CLI:

    upgrade head -> downgrade previous -> upgrade head -> upgrade head again

It prints one PASS line per stage and raises on any mismatch.
"""
import importlib.util
import os
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKDIR = Path(tempfile.mkdtemp(prefix="tp_migration_verify_"))
DB_PATH = WORKDIR / "verify.db"

os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH}"
os.environ["FLASK_APP"] = "main.py"
os.environ.setdefault("FLASK_ENV", "development")
os.environ.setdefault("FLASK_SECRET_KEY", "talent-passport-migration-verify")

sys.path.insert(0, str(ROOT))
import main  # noqa: E402
from src.models.user_models import db  # noqa: E402
from sqlalchemy import text  # noqa: E402

def _load_migration(filename, name):
    path = ROOT / "migrations" / "versions" / filename
    loaded = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(loaded)
    loaded.loader.exec_module(module)
    return module


migration = _load_migration(
    "f7a2b9c3d4e5_add_talent_passport.py", "tp_migration_probe"
)
document_migration = _load_migration(
    "c4e8b7a1d9f3_add_talent_passport_documents.py", "tp_document_migration_probe"
)
TABLES = list(migration.TABLES) + [document_migration.TABLE]
HEAD_REVISION = document_migration.revision

# Provision the full current schema, remove only the Passport tables, then
# stamp the previous head. This avoids the fresh-database auto-stamp branch.
with main.app.app_context():
    db.create_all()
    for table in TABLES:
        db.session.execute(text(f'DROP TABLE IF EXISTS "{table}"'))
    db.session.execute(text("DROP TABLE IF EXISTS alembic_version"))
    db.session.execute(
        text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
    )
    db.session.execute(text("INSERT INTO alembic_version VALUES ('a7a8e1c3f5b2')"))
    db.session.commit()


def run(*args):
    result = subprocess.run(
        [sys.executable, "-m", "flask", "db", *args],
        cwd=str(ROOT),
        env=os.environ.copy(),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=180,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"flask db {' '.join(args)} failed:\n{result.stdout[-6000:]}"
        )
    return result.stdout


def state():
    con = sqlite3.connect(str(DB_PATH))
    try:
        revision = con.execute("SELECT version_num FROM alembic_version").fetchone()[0]
        names = {
            row[0]
            for row in con.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        return revision, names
    finally:
        con.close()


def expect(revision_value, tables_present):
    revision, names = state()
    assert revision == revision_value, revision
    if tables_present:
        assert set(TABLES) <= names, sorted(set(TABLES) - names)
    else:
        assert not (set(TABLES) & names), sorted(
            set(TABLES) & names
        )


run("upgrade", "head")
expect(HEAD_REVISION, True)
print("PASS: upgrade created all Talent Passport tables from previous head")

run("downgrade", "a7a8e1c3f5b2")
expect("a7a8e1c3f5b2", False)
print("PASS: downgrade removed only Talent Passport tables")

run("upgrade", "head")
run("upgrade", "head")
expect(HEAD_REVISION, True)
print("PASS: repeated upgrade is safe")
