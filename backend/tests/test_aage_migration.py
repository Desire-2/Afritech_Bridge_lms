"""Regression tests for the additive AAGE Alembic migration."""

import importlib.util
import os
import subprocess
import sys
from pathlib import Path

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "migrations"
    / "versions"
    / "a7a8e1c3f5b2_add_aage_engine_tables.py"
)

AAGE_TABLES = {
    "grading_profiles",
    "rubric_versions",
    "grading_jobs",
    "submission_artifacts",
    "evaluation_runs",
    "evaluation_results",
    "criterion_scores",
    "evaluation_evidence",
    "grading_reviews",
    "learning_examples",
    "evaluator_versions",
    "calibration_runs",
    "calibration_cases",
    "grading_audit_logs",
}


def test_models_package_exports_shared_rubric_and_aage_models():
    import src.models as models

    assert models.Rubric.__tablename__ == "rubrics"
    assert models.RubricCriterion.__tablename__ == "rubric_criteria"
    assert models.GradingJob.__tablename__ == "grading_jobs"
    assert models.EvaluationResult.__tablename__ == "evaluation_results"


def _load_migration():
    spec = importlib.util.spec_from_file_location("aage_migration_under_test", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _base_schema(conn):
    conn.execute(sa.text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))
    conn.execute(sa.text("CREATE TABLE courses (id INTEGER PRIMARY KEY)"))
    conn.execute(sa.text("CREATE TABLE rubrics (id INTEGER PRIMARY KEY, title VARCHAR(200))"))
    conn.execute(sa.text(
        "CREATE TABLE rubric_criteria "
        "(id INTEGER PRIMARY KEY, rubric_id INTEGER, name VARCHAR(200), max_points FLOAT)"
    ))


def test_aage_migration_is_idempotent_and_schema_matches_models():
    engine = sa.create_engine("sqlite:///:memory:")
    migration = _load_migration()

    with engine.begin() as conn:
        _base_schema(conn)
        migration.op = Operations(MigrationContext.configure(conn))

        migration.upgrade()
        migration.upgrade()  # safe against partial installs / create_all databases

        inspector = sa.inspect(conn)
        tables = set(inspector.get_table_names())
        assert AAGE_TABLES <= tables

        rubric_columns = {c["name"] for c in inspector.get_columns("rubrics")}
        assert {"status", "version", "discipline", "profile_id",
                "criteria_weights_total"} <= rubric_columns

        indexes = {i["name"] for i in inspector.get_indexes("grading_jobs")}
        assert "ix_grading_jobs_created" in indexes
        assert "ix_grading_jobs_created_at" not in indexes

        result_indexes = {i["name"] for i in inspector.get_indexes("evaluation_results")}
        assert "ix_evaluation_results_course_id" in result_indexes
        assert "ix_evaluation_results_course" not in result_indexes

        profile_indexes = {i["name"] for i in inspector.get_indexes("grading_profiles")}
        assert "ix_grading_profiles_course_id" in profile_indexes

        job_fks = inspector.get_foreign_keys("grading_jobs")
        assert any(fk["referred_table"] == "rubric_versions" for fk in job_fks)
        assert any(fk["referred_table"] == "users" for fk in job_fks)

        migration.downgrade()
        migration.downgrade()  # safe to re-run
        assert not AAGE_TABLES & set(sa.inspect(conn).get_table_names())


def test_fresh_flask_db_upgrade_bootstraps_and_stamps_model_schema(tmp_path):
    backend_root = Path(__file__).resolve().parents[1]
    db_path = tmp_path / "fresh.db"
    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite:///{db_path}"
    env["FLASK_APP"] = "main.py"

    result = subprocess.run(
        [sys.executable, "-m", "flask", "db", "upgrade"],
        cwd=str(backend_root),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, result.stdout[-4000:]

    inspector = sa.inspect(sa.create_engine(f"sqlite:///{db_path}"))
    tables = set(inspector.get_table_names())
    assert AAGE_TABLES <= tables
    assert "alembic_version" in tables

    with sa.create_engine(f"sqlite:///{db_path}").connect() as conn:
        revision = conn.execute(
            sa.text("SELECT version_num FROM alembic_version")
        ).scalar()
    # Head advances with the additive Talent Passport document snapshot migration.
    assert revision == "c4e8b7a1d9f3"


def test_older_evaluation_runs_table_gains_cost_column_on_upgrade():
    """Existing databases created before cost instrumentation must be repaired."""
    engine = sa.create_engine("sqlite:///:memory:")
    migration = _load_migration()

    with engine.begin() as conn:
        conn.execute(sa.text(
            "CREATE TABLE evaluation_runs ("
            "id INTEGER PRIMARY KEY, job_id INTEGER NOT NULL, "
            "correlation_id VARCHAR(36), status VARCHAR(20) NOT NULL, "
            "started_at DATETIME NOT NULL)"
        ))
        migration.op = Operations(MigrationContext.configure(conn))
        migration.upgrade()

        columns = {c["name"] for c in sa.inspect(conn).get_columns("evaluation_runs")}
        assert "cost" in columns

        # Re-running must remain idempotent.
        migration.upgrade()
        columns = {c["name"] for c in sa.inspect(conn).get_columns("evaluation_runs")}
        assert "cost" in columns


def test_runtime_self_heal_adds_missing_evaluation_runs_cost_column():
    """The app-startup self-heal repairs legacy databases without a new Alembic revision."""
    from src.models.aage_models import ensure_aage_schema

    engine = sa.create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(sa.text(
            "CREATE TABLE evaluation_runs ("
            "id INTEGER PRIMARY KEY, job_id INTEGER NOT NULL, "
            "status VARCHAR(20) NOT NULL, started_at DATETIME NOT NULL)"
        ))

    ensure_aage_schema(engine)

    with engine.connect() as conn:
        columns = {c["name"] for c in sa.inspect(conn).get_columns("evaluation_runs")}
    assert "cost" in columns


def _legacy_rubric_table(conn, insert_sql):
    conn.execute(sa.text(
        "CREATE TABLE rubrics (id INTEGER PRIMARY KEY, name VARCHAR(200) NOT NULL, "
        "created_by INTEGER, max_score FLOAT, is_active BOOLEAN NOT NULL DEFAULT 1, "
        "assignment_type VARCHAR(50), criteria_count INTEGER)"
    ))
    conn.execute(sa.text(insert_sql))


def test_legacy_rubric_base_columns_repaired_by_runtime_self_heal():
    """Old create_all() rubric tables must stop raising 'no such column: rubrics.title'."""
    from src.models.aage_models import ensure_aage_schema

    engine = sa.create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        _legacy_rubric_table(
            conn,
            "INSERT INTO rubrics (name, created_by, max_score) "
            "VALUES ('Legacy rubric', 3, 80.0)",
        )

    ensure_aage_schema(engine)
    # Idempotent: a second pass must not duplicate columns or overwrite values.
    ensure_aage_schema(engine)

    with engine.connect() as conn:
        cols = {c["name"] for c in sa.inspect(conn).get_columns("rubrics")}
        row = conn.execute(sa.text(
            "SELECT title, instructor_id, total_points, is_template FROM rubrics"
        )).one()
    assert {"title", "instructor_id", "course_id", "is_template",
            "total_points"} <= cols
    assert row.title == "Legacy rubric"
    assert row.instructor_id == 3
    assert row.total_points == 80.0
    assert row.is_template == 0


def test_legacy_rubric_base_columns_repaired_by_migration():
    """The Alembic path must backfill renamed base columns just like the self-heal."""
    engine = sa.create_engine("sqlite:///:memory:")
    migration = _load_migration()
    with engine.begin() as conn:
        _legacy_rubric_table(
            conn,
            "INSERT INTO rubrics (name, created_by, max_score) "
            "VALUES ('Migrated rubric', 7, 50.0)",
        )
        migration.op = Operations(MigrationContext.configure(conn))
        migration.upgrade()

        row = conn.execute(sa.text(
            "SELECT title, instructor_id, total_points FROM rubrics"
        )).one()
    assert row.title == "Migrated rubric"
    assert row.instructor_id == 7
    assert row.total_points == 50.0


def test_legacy_rubrics_table_accepts_orm_insert_after_self_heal():
    """Unmapped legacy NOT NULL columns must not reject new ORM rows."""
    from sqlalchemy.orm import sessionmaker

    from src.models.aage_models import ensure_aage_schema
    from src.models.grading_models import Rubric

    engine = sa.create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        _legacy_rubric_table(conn, "SELECT 1 WHERE 0")  # empty legacy table
    ensure_aage_schema(engine)

    session = sessionmaker(bind=engine)()
    try:
        rubric = Rubric(title="Generated rubric", instructor_id=1,
                        total_points=100.0, course_id=9)
        session.add(rubric)
        session.commit()
        row = session.execute(sa.text(
            "SELECT name, title, is_active FROM rubrics"
        )).one()
    finally:
        session.close()
    assert row.title == "Generated rubric"
    assert row.name == ""          # legacy NOT NULL satisfied by model default
    assert row.is_active == 1      # legacy flag satisfied by model default


def test_rubric_criteria_created_at_repaired_by_self_heal_and_migration():
    """The model maps created_at; legacy tables must gain it on both paths."""
    from src.models.aage_models import ensure_aage_schema

    ddl = ("CREATE TABLE rubric_criteria "
           "(id INTEGER PRIMARY KEY, rubric_id INTEGER, name VARCHAR(200), "
           "max_points FLOAT)")

    engine = sa.create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(sa.text(ddl))
    ensure_aage_schema(engine)
    with engine.connect() as conn:
        cols = {c["name"] for c in sa.inspect(conn).get_columns("rubric_criteria")}
    assert "created_at" in cols

    engine2 = sa.create_engine("sqlite:///:memory:")
    migration = _load_migration()
    with engine2.begin() as conn:
        conn.execute(sa.text(ddl))
        migration.op = Operations(MigrationContext.configure(conn))
        migration.upgrade()
        cols = {c["name"] for c in sa.inspect(conn).get_columns("rubric_criteria")}
    assert "created_at" in cols


def test_general_reconciliation_adds_any_missing_mapped_column():
    """The startup sweep closes drift for tables beyond the named rubric repairs."""
    from src.models.aage_models import reconcile_model_columns

    engine = sa.create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(sa.text(
            "CREATE TABLE grading_sessions (id INTEGER PRIMARY KEY)"
        ))
    reconcile_model_columns(engine)
    # Idempotent.
    reconcile_model_columns(engine)

    with engine.connect() as conn:
        cols = {c["name"] for c in sa.inspect(conn).get_columns("grading_sessions")}
    assert {"graded_items", "session_notes", "total_time_seconds"} <= cols
