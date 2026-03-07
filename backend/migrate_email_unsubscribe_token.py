"""
Migration: Add email_unsubscribe_token column to users table
For the email unsubscribe/preference management feature
"""
import os
import re
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text

load_dotenv()

def get_database_url():
    url = os.environ.get('DATABASE_URL', '')
    if not url:
        # Fall back to local SQLite
        base_dir = os.path.dirname(os.path.abspath(__file__))
        return f"sqlite:///{os.path.join(base_dir, 'instance', 'afritec_lms_db.db')}"
    # Transform postgres:// to postgresql+psycopg2://
    url = re.sub(r'^postgres://', 'postgresql+psycopg2://', url)
    if url.startswith('postgresql://'):
        url = url.replace('postgresql://', 'postgresql+psycopg2://', 1)
    return url

def migrate():
    db_url = get_database_url()
    is_postgresql = 'postgresql' in db_url
    print(f"Database: {'PostgreSQL' if is_postgresql else 'SQLite'}")

    engine = create_engine(db_url)

    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns('users')]

    if 'email_unsubscribe_token' in columns:
        print("✅ Column 'email_unsubscribe_token' already exists in users table")
        return

    print("Adding 'email_unsubscribe_token' column to users table...")

    with engine.begin() as conn:
        if is_postgresql:
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN email_unsubscribe_token VARCHAR(64) UNIQUE"
            ))
        else:
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN email_unsubscribe_token VARCHAR(64)"
            ))

    # Create index
    try:
        with engine.begin() as conn:
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email_unsubscribe_token "
                "ON users (email_unsubscribe_token)"
            ))
        print("✅ Index created on email_unsubscribe_token")
    except Exception as e:
        print(f"⚠️ Index creation skipped (may already exist): {e}")

    print("✅ Migration complete: email_unsubscribe_token column added")

if __name__ == '__main__':
    migrate()
