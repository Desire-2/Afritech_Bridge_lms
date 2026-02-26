"""
Database Migration: Add waitlist migration and payment verification fields.

Run this script to add the new columns to existing databases:
  cd backend
  python migrate_waitlist_payment_fields.py

New columns added:
  enrollments:
    - payment_status (VARCHAR 30)
    - payment_verified (BOOLEAN, default False)
    - payment_verified_at (DATETIME)
    - payment_verified_by (INTEGER FK -> users.id)
    - migrated_from_window_id (INTEGER FK -> application_windows.id)

  course_applications:
    - original_window_id (INTEGER FK -> application_windows.id)
    - migrated_to_window_id (INTEGER FK -> application_windows.id)
    - migrated_at (DATETIME)
    - migration_notes (TEXT)
"""

import os
import sys
import logging

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_migration():
    from main import app, db

    with app.app_context():
        from sqlalchemy import inspect, text

        inspector = inspect(db.engine)

        # ── Enrollment table columns ──
        enrollment_columns = {col['name'] for col in inspector.get_columns('enrollments')}

        enrollment_new_columns = [
            ("payment_status", "VARCHAR(30)"),
            ("payment_verified", "BOOLEAN DEFAULT FALSE"),
            ("payment_verified_at", "TIMESTAMP"),
            ("payment_verified_by", "INTEGER REFERENCES users(id)"),
            ("migrated_from_window_id", "INTEGER REFERENCES application_windows(id)"),
        ]

        for col_name, col_type in enrollment_new_columns:
            if col_name not in enrollment_columns:
                try:
                    sql = f"ALTER TABLE enrollments ADD COLUMN {col_name} {col_type}"
                    db.session.execute(text(sql))
                    logger.info(f"✅ Added enrollments.{col_name}")
                except Exception as e:
                    logger.warning(f"⚠️  enrollments.{col_name} may already exist: {e}")
                    db.session.rollback()
            else:
                logger.info(f"⏭️  enrollments.{col_name} already exists")

        # ── CourseApplication table columns ──
        app_columns = {col['name'] for col in inspector.get_columns('course_applications')}

        app_new_columns = [
            ("original_window_id", "INTEGER REFERENCES application_windows(id)"),
            ("migrated_to_window_id", "INTEGER REFERENCES application_windows(id)"),
            ("migrated_at", "TIMESTAMP"),
            ("migration_notes", "TEXT"),
        ]

        for col_name, col_type in app_new_columns:
            if col_name not in app_columns:
                try:
                    sql = f"ALTER TABLE course_applications ADD COLUMN {col_name} {col_type}"
                    db.session.execute(text(sql))
                    logger.info(f"✅ Added course_applications.{col_name}")
                except Exception as e:
                    logger.warning(f"⚠️  course_applications.{col_name} may already exist: {e}")
                    db.session.rollback()
            else:
                logger.info(f"⏭️  course_applications.{col_name} already exists")

        db.session.commit()

        # ── Set default payment_verified for existing free enrollments ──
        try:
            # Mark all existing enrollments in free courses as payment_verified
            result = db.session.execute(text("""
                UPDATE enrollments 
                SET payment_verified = TRUE, payment_status = 'not_required'
                WHERE payment_verified IS NULL 
                  AND payment_status IS NULL
                  AND course_id IN (
                    SELECT id FROM courses WHERE enrollment_type = 'free'
                  )
            """))
            count = result.rowcount
            if count:
                logger.info(f"✅ Set payment_verified=TRUE for {count} existing free enrollments")

            # Mark remaining as needing review
            result2 = db.session.execute(text("""
                UPDATE enrollments 
                SET payment_verified = FALSE, payment_status = 'pending'
                WHERE payment_verified IS NULL 
                  AND payment_status IS NULL
            """))
            count2 = result2.rowcount
            if count2:
                logger.info(f"⚠️  Set payment_status='pending' for {count2} enrollments needing review")

            db.session.commit()
        except Exception as e:
            logger.warning(f"⚠️  Could not update existing enrollment defaults: {e}")
            db.session.rollback()

        logger.info("🎉 Migration complete!")


if __name__ == '__main__':
    run_migration()
