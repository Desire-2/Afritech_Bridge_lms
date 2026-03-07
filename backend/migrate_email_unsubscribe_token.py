"""
Migration: Add email_unsubscribe_token column to users table
For the email unsubscribe/preference management feature
"""
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
from src.models.user_models import db

def migrate():
    with app.app_context():
        from sqlalchemy import inspect, text
        
        inspector = inspect(db.engine)
        columns = [col['name'] for col in inspector.get_columns('users')]
        
        if 'email_unsubscribe_token' in columns:
            print("✅ Column 'email_unsubscribe_token' already exists in users table")
            return
        
        print("Adding 'email_unsubscribe_token' column to users table...")
        
        # Detect database type
        db_url = str(db.engine.url)
        is_postgresql = 'postgresql' in db_url
        
        if is_postgresql:
            db.session.execute(text(
                "ALTER TABLE users ADD COLUMN email_unsubscribe_token VARCHAR(64) UNIQUE"
            ))
        else:
            # SQLite
            db.session.execute(text(
                "ALTER TABLE users ADD COLUMN email_unsubscribe_token VARCHAR(64)"
            ))
        
        db.session.commit()
        
        # Create index
        try:
            if is_postgresql:
                db.session.execute(text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email_unsubscribe_token ON users (email_unsubscribe_token)"
                ))
            else:
                db.session.execute(text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email_unsubscribe_token ON users (email_unsubscribe_token)"
                ))
            db.session.commit()
            print("✅ Index created on email_unsubscribe_token")
        except Exception as e:
            print(f"⚠️ Index creation skipped (may already exist): {e}")
            db.session.rollback()
        
        print("✅ Migration complete: email_unsubscribe_token column added")

if __name__ == '__main__':
    migrate()
