#!/usr/bin/env python3
"""
Migration: add cohort/application window fields to courses and course_applications.
Safe to run multiple times; skips columns that already exist.
"""
import sys
from sqlalchemy import inspect, text
from main import app, db


COURSE_COLUMNS = [
    ("application_start_date", "TIMESTAMP"),
    ("application_end_date", "TIMESTAMP"),
    ("cohort_start_date", "TIMESTAMP"),
    ("cohort_end_date", "TIMESTAMP"),
    ("cohort_label", "VARCHAR(120)"),
    ("application_timezone", "VARCHAR(64) DEFAULT 'UTC'"),
]

APPLICATION_COLUMNS = [
    ("cohort_label", "VARCHAR(120)"),
    ("cohort_start_date", "TIMESTAMP"),
    ("cohort_end_date", "TIMESTAMP"),
]


def _add_columns(table_name, desired_columns):
    inspector = inspect(db.engine)
    try:
        existing = {col["name"] for col in inspector.get_columns(table_name)}
    except Exception as exc:  # pylint: disable=broad-except
        print(f"❌ Unable to inspect {table_name}: {exc}")
        return 0

    added = 0
    for column_name, column_type in desired_columns:
        if column_name in existing:
            continue
        print(f"➜ Adding {column_name} to {table_name}...")
        try:
            db.session.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"))
            db.session.commit()
            added += 1
            print(f"✅ Added {column_name}")
        except Exception as exc:  # pylint: disable=broad-except
            db.session.rollback()
            print(f"⚠️  Failed to add {column_name}: {exc}")
    return added


def migrate():
    with app.app_context():
        print("=" * 80)
        print("MIGRATION: ADD COHORT/APPLICATION FIELDS")
        print("=" * 80)

        added_courses = _add_columns("courses", COURSE_COLUMNS)
        added_applications = _add_columns("course_applications", APPLICATION_COLUMNS)

        print("=" * 80)
        print(
            f"✅ Migration complete (courses +{added_courses}, course_applications +{added_applications})"
        )
        print("=" * 80)
        return True


if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)