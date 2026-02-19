#!/usr/bin/env python3
"""
Migration: Add cohort separation fields to enrollments table.

New columns:
  - application_window_id  (FK → application_windows.id)
  - application_id         (FK → course_applications.id)
  - cohort_label           (VARCHAR 120)
  - cohort_start_date      (TIMESTAMP)
  - cohort_end_date        (TIMESTAMP)

Constraint change:
  - Drop old UniqueConstraint (student_id, course_id)
  - Create new UniqueConstraint (student_id, course_id, application_window_id)

Backfill:
  - For each existing enrollment, try to resolve cohort data from the student's
    most recent approved CourseApplication → its ApplicationWindow, falling back
    to the course's flat cohort fields.

Safe to run multiple times; skips columns/constraints that already exist.
"""
import sys
from sqlalchemy import inspect, text
from main import app, db


ENROLLMENT_COLUMNS = [
    ("application_window_id", "INTEGER REFERENCES application_windows(id)"),
    ("application_id", "INTEGER REFERENCES course_applications(id)"),
    ("cohort_label", "VARCHAR(120)"),
    ("cohort_start_date", "TIMESTAMP"),
    ("cohort_end_date", "TIMESTAMP"),
]

OLD_CONSTRAINT = "_student_course_uc"
NEW_CONSTRAINT = "_student_course_cohort_uc"


def _add_columns(table_name, desired_columns):
    """Add missing columns to a table. Returns count of columns added."""
    inspector = inspect(db.engine)
    try:
        existing = {col["name"] for col in inspector.get_columns(table_name)}
    except Exception as exc:
        print(f"❌ Unable to inspect {table_name}: {exc}")
        return 0

    added = 0
    for column_name, column_type in desired_columns:
        if column_name in existing:
            print(f"  ⏭  {column_name} already exists in {table_name}")
            continue
        print(f"  ➜ Adding {column_name} to {table_name} ...")
        try:
            db.session.execute(
                text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")
            )
            db.session.commit()
            added += 1
            print(f"  ✅ Added {column_name}")
        except Exception as exc:
            db.session.rollback()
            print(f"  ⚠️  Failed to add {column_name}: {exc}")
    return added


def _get_dialect():
    """Return 'postgresql' or 'sqlite'."""
    return db.engine.dialect.name


def _constraint_exists(table_name, constraint_name):
    """Check if a unique constraint exists (best-effort)."""
    dialect = _get_dialect()
    try:
        if dialect == "postgresql":
            result = db.session.execute(text(
                "SELECT 1 FROM information_schema.table_constraints "
                "WHERE table_name = :table AND constraint_name = :cname AND constraint_type = 'UNIQUE'"
            ), {"table": table_name, "cname": constraint_name})
            return result.fetchone() is not None
        else:
            # SQLite: look in CREATE TABLE sql
            result = db.session.execute(text(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name = :table"
            ), {"table": table_name})
            row = result.fetchone()
            if row:
                return constraint_name in (row[0] or "")
    except Exception:
        pass
    return False


def _migrate_constraint():
    """Swap the unique constraint from (student, course) to (student, course, window)."""
    dialect = _get_dialect()
    print("\n── Constraint migration ──")

    if _constraint_exists("enrollments", NEW_CONSTRAINT):
        print(f"  ⏭  {NEW_CONSTRAINT} already exists — skipping")
        return

    try:
        if dialect == "postgresql":
            # Drop old constraint if it exists
            if _constraint_exists("enrollments", OLD_CONSTRAINT):
                print(f"  ➜ Dropping old constraint {OLD_CONSTRAINT} ...")
                db.session.execute(text(
                    f"ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS {OLD_CONSTRAINT}"
                ))
                db.session.commit()
                print(f"  ✅ Dropped {OLD_CONSTRAINT}")

            # Create new UNIQUE constraint  (NULLs in application_window_id
            # are treated as distinct in PostgreSQL, which is what we want:
            # a student can have one NULL-window enrollment + per-window ones)
            print(f"  ➜ Creating new constraint {NEW_CONSTRAINT} ...")
            db.session.execute(text(
                f"ALTER TABLE enrollments ADD CONSTRAINT {NEW_CONSTRAINT} "
                f"UNIQUE (student_id, course_id, application_window_id)"
            ))
            db.session.commit()
            print(f"  ✅ Created {NEW_CONSTRAINT}")
        else:
            # SQLite doesn't support ALTER TABLE … DROP/ADD CONSTRAINT.
            # Instead create a UNIQUE INDEX which is functionally equivalent.
            print(f"  ➜ Creating unique index for SQLite ...")
            try:
                # try dropping old index first (may not exist)
                db.session.execute(text(f"DROP INDEX IF EXISTS {OLD_CONSTRAINT}"))
                db.session.commit()
            except Exception:
                db.session.rollback()

            db.session.execute(text(
                f"CREATE UNIQUE INDEX IF NOT EXISTS {NEW_CONSTRAINT} "
                f"ON enrollments (student_id, course_id, application_window_id)"
            ))
            db.session.commit()
            print(f"  ✅ Created unique index {NEW_CONSTRAINT}")

    except Exception as exc:
        db.session.rollback()
        print(f"  ⚠️  Constraint migration failed: {exc}")


def _backfill():
    """
    Backfill cohort data for existing enrollments that have no cohort_label yet.
    
    Strategy per enrollment:
      1. Find approved CourseApplication for (student_id, course_id).
      2. If application has a cohort_label snapshot, try to match it to an
         ApplicationWindow. Use the window's data.
      3. Else fall back to the primary (is_primary=True) ApplicationWindow.
      4. Else fall back to application snapshot fields.
      5. Else fall back to course flat fields.
    """
    from src.models.course_models import Enrollment, ApplicationWindow, Course
    from src.models.course_application import CourseApplication
    from src.models.user_models import User

    print("\n── Backfill existing enrollments ──")
    enrollments = Enrollment.query.filter(
        Enrollment.cohort_label.is_(None)
    ).all()

    if not enrollments:
        print("  ⏭  No enrollments need backfilling")
        return

    print(f"  ➜ Found {len(enrollments)} enrollment(s) to backfill")

    updated = 0
    for enrollment in enrollments:
        course = db.session.get(Course, enrollment.course_id)
        if not course:
            continue

        # CourseApplication uses email, not student_id — resolve via user
        student = db.session.get(User, enrollment.student_id)
        if not student:
            continue

        # Try to find the student's application by email
        application = CourseApplication.query.filter_by(
            email=student.email,
            course_id=enrollment.course_id,
            status='approved'
        ).order_by(CourseApplication.created_at.desc()).first()

        window = None
        cohort_label = None
        cohort_start = None
        cohort_end = None

        if application:
            enrollment.application_id = application.id

            # Try to match application to a window via cohort_label
            if application.cohort_label:
                window = ApplicationWindow.query.filter_by(
                    course_id=enrollment.course_id,
                    cohort_label=application.cohort_label
                ).first()

            # Fallback: any window for this course (no is_primary field)
            if not window:
                window = ApplicationWindow.query.filter_by(
                    course_id=enrollment.course_id
                ).first()

            if window:
                enrollment.application_window_id = window.id
                cohort_label = window.cohort_label
                cohort_start = window.cohort_start  # field is cohort_start, not cohort_start_date
                cohort_end = window.cohort_end
            else:
                # Use application snapshot
                cohort_label = application.cohort_label
                cohort_start = getattr(application, 'cohort_start_date', None)
                cohort_end = getattr(application, 'cohort_end_date', None)
        
        # Final fallback: course flat fields
        if not cohort_label:
            cohort_label = getattr(course, 'cohort_label', None)
            cohort_start = cohort_start or getattr(course, 'cohort_start_date', None)
            cohort_end = cohort_end or getattr(course, 'cohort_end_date', None)

        if cohort_label:
            enrollment.cohort_label = cohort_label
            enrollment.cohort_start_date = cohort_start
            enrollment.cohort_end_date = cohort_end
            updated += 1

    try:
        db.session.commit()
        print(f"  ✅ Backfilled {updated}/{len(enrollments)} enrollment(s)")
    except Exception as exc:
        db.session.rollback()
        print(f"  ⚠️  Backfill commit failed: {exc}")


def migrate():
    with app.app_context():
        print("=" * 80)
        print("MIGRATION: ENROLLMENT COHORT SEPARATION FIELDS")
        print("=" * 80)

        # Step 1: Add columns
        print("\n── Step 1: Add columns ──")
        added = _add_columns("enrollments", ENROLLMENT_COLUMNS)
        print(f"  Added {added} column(s)")

        # Step 2: Migrate constraint
        _migrate_constraint()

        # Step 3: Backfill existing enrollments
        _backfill()

        print("\n" + "=" * 80)
        print("✅ ENROLLMENT COHORT MIGRATION COMPLETE")
        print("=" * 80)
        return True


if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)
