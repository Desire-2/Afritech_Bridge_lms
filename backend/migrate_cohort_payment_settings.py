"""
Migration: Add cohort-level payment override fields to application_windows table.

This migration adds columns that allow each cohort (ApplicationWindow) to override
the course-level payment settings. Supports per-cohort:
- Enrollment type (free / paid / scholarship)
- Scholarship type (full / partial) and percentage
- Price override, currency override
- Payment mode, partial payment, installment settings
- Max students capacity
- Description

Run: python migrate_cohort_payment_settings.py
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app, db
from sqlalchemy import text, inspect


def get_existing_columns(inspector, table_name):
    """Get set of existing column names for a table."""
    try:
        columns = inspector.get_columns(table_name)
        return {col['name'] for col in columns}
    except Exception:
        return set()


def add_column_if_missing(connection, table_name, column_name, column_type, existing_columns):
    """Add a column to a table if it doesn't already exist."""
    if column_name in existing_columns:
        print(f"  ✓ Column '{column_name}' already exists in '{table_name}'")
        return False

    sql = f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"
    connection.execute(text(sql))
    print(f"  + Added column '{column_name}' ({column_type}) to '{table_name}'")
    return True


def run_migration():
    with app.app_context():
        inspector = inspect(db.engine)

        # Check if application_windows table exists
        tables = inspector.get_table_names()
        if 'application_windows' not in tables:
            print("ERROR: 'application_windows' table does not exist. Run previous migrations first.")
            sys.exit(1)

        existing = get_existing_columns(inspector, 'application_windows')
        print(f"\nExisting columns in application_windows: {sorted(existing)}\n")

        new_columns = [
            ("description", "TEXT"),
            ("max_students", "INTEGER"),
            ("enrollment_type", "VARCHAR(20)"),
            ("price", "FLOAT"),
            ("currency", "VARCHAR(10)"),
            ("scholarship_type", "VARCHAR(20)"),
            ("scholarship_percentage", "FLOAT"),
            ("payment_mode", "VARCHAR(20)"),
            ("partial_payment_amount", "FLOAT"),
            ("partial_payment_percentage", "FLOAT"),
            ("payment_methods", "TEXT"),
            ("payment_deadline_days", "INTEGER"),
            ("require_payment_before_application", "BOOLEAN"),
            ("installment_enabled", "BOOLEAN"),
            ("installment_count", "INTEGER"),
            ("installment_interval_days", "INTEGER"),
        ]

        added_count = 0
        with db.engine.begin() as connection:
            for col_name, col_type in new_columns:
                if add_column_if_missing(connection, 'application_windows', col_name, col_type, existing):
                    added_count += 1

        print(f"\n{'='*50}")
        if added_count > 0:
            print(f"Migration complete: {added_count} new columns added to application_windows.")
        else:
            print("Migration complete: No changes needed (all columns already exist).")
        print(f"{'='*50}\n")


if __name__ == "__main__":
    run_migration()
