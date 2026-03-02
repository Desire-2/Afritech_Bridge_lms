"""
Migration: Add cohort-aware module release support.

This migration:
1. Adds module_release_count, module_release_interval, module_release_interval_days
   columns to the application_windows table (cohort-level overrides).
2. Creates the cohort_module_releases table for per-cohort manual module releases.

Safe to run multiple times (checks for existing columns/tables before altering).
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
from src.models import db

def run_migration():
    with app.app_context():
        conn = db.engine.connect()

        # Detect dialect
        dialect = db.engine.dialect.name  # 'sqlite' or 'postgresql'
        print(f"Database dialect: {dialect}")

        # ── 1. Add columns to application_windows ──
        new_columns = [
            ('module_release_count', 'INTEGER'),
            ('module_release_interval', 'VARCHAR(50)'),
            ('module_release_interval_days', 'INTEGER'),
        ]

        for col_name, col_type in new_columns:
            try:
                if dialect == 'sqlite':
                    # SQLite: check pragma
                    result = conn.execute(db.text(
                        f"PRAGMA table_info('application_windows')"
                    ))
                    columns = [row[1] for row in result]
                    if col_name in columns:
                        print(f"  Column 'application_windows.{col_name}' already exists, skipping.")
                        continue
                else:
                    # PostgreSQL: check information_schema
                    result = conn.execute(db.text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_name = 'application_windows' AND column_name = :col"
                    ), {'col': col_name})
                    if result.fetchone():
                        print(f"  Column 'application_windows.{col_name}' already exists, skipping.")
                        continue

                conn.execute(db.text(
                    f"ALTER TABLE application_windows ADD COLUMN {col_name} {col_type}"
                ))
                conn.commit()
                print(f"  Added column 'application_windows.{col_name}' ({col_type}).")
            except Exception as e:
                print(f"  Warning adding column '{col_name}': {e}")

        # ── 2. Create cohort_module_releases table ──
        try:
            if dialect == 'sqlite':
                result = conn.execute(db.text(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='cohort_module_releases'"
                ))
                exists = result.fetchone() is not None
            else:
                result = conn.execute(db.text(
                    "SELECT to_regclass('public.cohort_module_releases')"
                ))
                exists = result.fetchone()[0] is not None

            if exists:
                print("  Table 'cohort_module_releases' already exists, skipping.")
            else:
                create_sql = """
                CREATE TABLE cohort_module_releases (
                    id SERIAL PRIMARY KEY,
                    cohort_id INTEGER NOT NULL REFERENCES application_windows(id),
                    module_id INTEGER NOT NULL REFERENCES modules(id),
                    is_released BOOLEAN NOT NULL DEFAULT TRUE,
                    released_at TIMESTAMP,
                    released_by INTEGER REFERENCES users(id),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT _cohort_module_release_uc UNIQUE (cohort_id, module_id)
                )
                """
                if dialect == 'sqlite':
                    # SQLite uses AUTOINCREMENT differently
                    create_sql = """
                    CREATE TABLE cohort_module_releases (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        cohort_id INTEGER NOT NULL REFERENCES application_windows(id),
                        module_id INTEGER NOT NULL REFERENCES modules(id),
                        is_released BOOLEAN NOT NULL DEFAULT 1,
                        released_at DATETIME,
                        released_by INTEGER REFERENCES users(id),
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE (cohort_id, module_id)
                    )
                    """
                conn.execute(db.text(create_sql))
                conn.commit()
                print("  Created table 'cohort_module_releases'.")
        except Exception as e:
            print(f"  Warning creating table 'cohort_module_releases': {e}")

        conn.close()
        print("\nMigration complete!")


if __name__ == '__main__':
    run_migration()
