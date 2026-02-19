#!/usr/bin/env python3
"""
Migration: create the `application_windows` table and seed it from existing
flat cohort fields on each course.

Safe to run multiple times; skips creation if the table already exists and
only seeds rows that haven't been created yet.
"""
import sys
from sqlalchemy import inspect, text
from main import app, db
from src.models.course_models import ApplicationWindow, Course


def run():
    with app.app_context():
        inspector = inspect(db.engine)
        existing_tables = inspector.get_table_names()

        # ── 1. Create table if it does not exist ──
        if "application_windows" not in existing_tables:
            print("➜ Creating application_windows table...")
            ApplicationWindow.__table__.create(db.engine)
            print("✅ Table created")
        else:
            print("ℹ️  application_windows table already exists — skipping creation")

        # ── 2. Seed from existing flat course fields ──
        courses = Course.query.all()
        seeded = 0
        skipped = 0

        for course in courses:
            # Only seed if the course has date data but NO window rows yet
            has_dates = any([
                course.application_start_date,
                course.application_end_date,
                course.cohort_start_date,
                course.cohort_end_date,
                course.cohort_label,
            ])

            existing_windows = ApplicationWindow.query.filter_by(course_id=course.id).count()

            if existing_windows > 0:
                skipped += 1
                continue

            if not has_dates:
                skipped += 1
                continue

            window = ApplicationWindow(
                course_id=course.id,
                cohort_label=course.cohort_label or "Primary Cohort",
                opens_at=course.application_start_date,
                closes_at=course.application_end_date,
                cohort_start=course.cohort_start_date,
                cohort_end=course.cohort_end_date,
            )
            db.session.add(window)
            seeded += 1

        if seeded:
            db.session.commit()

        print(f"✅ Seeded {seeded} window(s), skipped {skipped} course(s)")
        print("Migration complete.")


if __name__ == "__main__":
    run()
