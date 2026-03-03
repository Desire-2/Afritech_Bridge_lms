"""
Migration: Add security_violation and violation_reason columns to quiz_attempts table.
These columns support blocking all remaining quiz attempts when a security violation is detected.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from main import app
from src.models.user_models import db

def migrate():
    with app.app_context():
        # Check database type
        db_url = str(db.engine.url)
        is_sqlite = 'sqlite' in db_url
        
        if is_sqlite:
            migrate_sqlite()
        else:
            migrate_postgresql()
        
        print("✅ Migration completed successfully!")

def migrate_sqlite():
    """SQLite migration - add columns one at a time"""
    from sqlalchemy import text
    
    with db.engine.connect() as conn:
        # Check if columns already exist
        result = conn.execute(text("PRAGMA table_info(quiz_attempts)"))
        existing_columns = [row[1] for row in result.fetchall()]
        
        if 'security_violation' not in existing_columns:
            conn.execute(text(
                "ALTER TABLE quiz_attempts ADD COLUMN security_violation BOOLEAN DEFAULT 0 NOT NULL"
            ))
            print("  ✅ Added 'security_violation' column")
        else:
            print("  ⏭️  'security_violation' column already exists")
        
        if 'violation_reason' not in existing_columns:
            conn.execute(text(
                "ALTER TABLE quiz_attempts ADD COLUMN violation_reason VARCHAR(500)"
            ))
            print("  ✅ Added 'violation_reason' column")
        else:
            print("  ⏭️  'violation_reason' column already exists")
        
        conn.commit()

def migrate_postgresql():
    """PostgreSQL migration"""
    from sqlalchemy import text
    
    with db.engine.connect() as conn:
        # Check if columns already exist
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'quiz_attempts'
        """))
        existing_columns = [row[0] for row in result.fetchall()]
        
        if 'security_violation' not in existing_columns:
            conn.execute(text(
                "ALTER TABLE quiz_attempts ADD COLUMN security_violation BOOLEAN DEFAULT FALSE NOT NULL"
            ))
            print("  ✅ Added 'security_violation' column")
        else:
            print("  ⏭️  'security_violation' column already exists")
        
        if 'violation_reason' not in existing_columns:
            conn.execute(text(
                "ALTER TABLE quiz_attempts ADD COLUMN violation_reason VARCHAR(500)"
            ))
            print("  ✅ Added 'violation_reason' column")
        else:
            print("  ⏭️  'violation_reason' column already exists")
        
        conn.commit()

if __name__ == '__main__':
    print("🔄 Running quiz security violation migration...")
    migrate()
