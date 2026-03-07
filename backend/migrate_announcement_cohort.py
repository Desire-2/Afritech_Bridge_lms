"""
Migration: Add cohort_id column to announcements table.

This allows announcements to be targeted to specific cohorts.
NULL cohort_id means the announcement is for all cohorts in the course.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from main import app
from src.models.user_models import db
from sqlalchemy import text, inspect

def migrate():
    with app.app_context():
        inspector = inspect(db.engine)
        columns = [col['name'] for col in inspector.get_columns('announcements')]

        if 'cohort_id' in columns:
            print("✅ Column 'cohort_id' already exists in 'announcements' table. Skipping.")
            return

        print("🔄 Adding 'cohort_id' column to 'announcements' table...")

        dialect = db.engine.dialect.name
        if dialect == 'sqlite':
            db.session.execute(text(
                "ALTER TABLE announcements ADD COLUMN cohort_id INTEGER REFERENCES application_windows(id)"
            ))
        else:
            db.session.execute(text(
                "ALTER TABLE announcements ADD COLUMN cohort_id INTEGER REFERENCES application_windows(id) ON DELETE SET NULL"
            ))

        db.session.commit()
        print("✅ Migration complete: 'cohort_id' added to 'announcements' table.")

if __name__ == '__main__':
    migrate()
