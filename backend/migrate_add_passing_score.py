"""
Migration: Add passing_score column to assignments and projects tables.

This column stores the passing percentage threshold set during assignment/project creation.
Default value is 60.0 (60%). Scores below this threshold trigger automatic modification requests.
"""
import sys
import os

# Add the parent directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
from src.models.user_models import db
from sqlalchemy import text, inspect

def migrate():
    with app.app_context():
        inspector = inspect(db.engine)
        
        # ---- assignments table ----
        assignment_columns = [col['name'] for col in inspector.get_columns('assignments')]
        
        if 'passing_score' not in assignment_columns:
            print("Adding 'passing_score' column to 'assignments' table...")
            db.session.execute(text(
                "ALTER TABLE assignments ADD COLUMN passing_score FLOAT DEFAULT 60.0"
            ))
            db.session.commit()
            print("✅ Added 'passing_score' to assignments table (default: 60.0)")
        else:
            print("ℹ️  'passing_score' column already exists in assignments table")
        
        # ---- projects table ----
        project_columns = [col['name'] for col in inspector.get_columns('projects')]
        
        if 'passing_score' not in project_columns:
            print("Adding 'passing_score' column to 'projects' table...")
            db.session.execute(text(
                "ALTER TABLE projects ADD COLUMN passing_score FLOAT DEFAULT 60.0"
            ))
            db.session.commit()
            print("✅ Added 'passing_score' to projects table (default: 60.0)")
        else:
            print("ℹ️  'passing_score' column already exists in projects table")
        
        print("\n✅ Migration complete!")


if __name__ == '__main__':
    migrate()
