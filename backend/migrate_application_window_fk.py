#!/usr/bin/env python3
"""
Migration: Add application_window_id FK to course_applications table.

New column:
  - application_window_id  (FK → application_windows.id, nullable)

Backfill:
  - For each existing course_application, try to match by:
    1. Same course_id + matching cohort_label to an ApplicationWindow
    2. Same course_id + submission date within window opens_at/closes_at range
    3. Same course_id + first available window (fallback)

Safe to run multiple times; skips if column already exists.
"""
import sys
from sqlalchemy import inspect, text
from main import app, db


def run_migration():
    """Run the migration."""
    with app.app_context():
        inspector = inspect(db.engine)

        # ── 1. Add column if missing ──────────────────────────────
        try:
            existing_cols = {col["name"] for col in inspector.get_columns("course_applications")}
        except Exception as exc:
            print(f"❌ Unable to inspect course_applications: {exc}")
            return False

        if "application_window_id" not in existing_cols:
            print("➜ Adding application_window_id to course_applications ...")
            try:
                db.session.execute(text(
                    "ALTER TABLE course_applications "
                    "ADD COLUMN application_window_id INTEGER REFERENCES application_windows(id)"
                ))
                db.session.commit()
                print("  ✅ Column added.")
            except Exception as exc:
                db.session.rollback()
                print(f"  ❌ Failed to add column: {exc}")
                return False
        else:
            print("⏭  application_window_id already exists in course_applications")

        # ── 2. Backfill existing rows ─────────────────────────────
        print("\n➜ Backfilling application_window_id for existing applications ...")

        # Get all applications without a window_id set
        unlinked = db.session.execute(text(
            "SELECT id, course_id, cohort_label, created_at "
            "FROM course_applications "
            "WHERE application_window_id IS NULL"
        )).fetchall()

        if not unlinked:
            print("  ⏭  No unlinked applications to backfill.")
            return True

        print(f"  Found {len(unlinked)} applications to backfill.")

        # Load all windows indexed by course_id
        windows_rows = db.session.execute(text(
            "SELECT id, course_id, cohort_label, opens_at, closes_at "
            "FROM application_windows "
            "ORDER BY course_id, opens_at"
        )).fetchall()

        windows_by_course = {}
        for w in windows_rows:
            windows_by_course.setdefault(w.course_id, []).append(w)

        updated = 0
        skipped = 0

        for app_row in unlinked:
            app_id = app_row.id
            course_id = app_row.course_id
            cohort_label = app_row.cohort_label
            created_at = app_row.created_at

            course_windows = windows_by_course.get(course_id, [])
            if not course_windows:
                skipped += 1
                continue

            matched_window_id = None

            # Strategy 1: Match by cohort_label
            if cohort_label:
                for w in course_windows:
                    if w.cohort_label and w.cohort_label.strip().lower() == cohort_label.strip().lower():
                        matched_window_id = w.id
                        break

            # Strategy 2: Match by date range
            if not matched_window_id and created_at:
                for w in course_windows:
                    if w.opens_at and w.closes_at:
                        if w.opens_at <= created_at <= w.closes_at:
                            matched_window_id = w.id
                            break

            # Strategy 3: Fallback to first window for the course
            if not matched_window_id:
                matched_window_id = course_windows[0].id

            if matched_window_id:
                try:
                    db.session.execute(text(
                        "UPDATE course_applications "
                        "SET application_window_id = :wid "
                        "WHERE id = :aid"
                    ), {"wid": matched_window_id, "aid": app_id})
                    updated += 1
                except Exception as exc:
                    print(f"  ⚠️  Failed to update app {app_id}: {exc}")
                    skipped += 1

        db.session.commit()
        print(f"  ✅ Backfill complete: {updated} updated, {skipped} skipped (no matching window).")
        return True


if __name__ == "__main__":
    print("=" * 60)
    print("Migration: Add application_window_id FK to course_applications")
    print("=" * 60)

    success = run_migration()

    if success:
        print("\n✅ Migration completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Migration failed.")
        sys.exit(1)
