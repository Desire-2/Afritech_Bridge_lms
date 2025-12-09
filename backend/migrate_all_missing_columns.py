#!/usr/bin/env python3
"""
Comprehensive database migration to add all missing columns.
This script adds columns that exist in models but are missing in the PostgreSQL database.
"""
import os
import sys
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from src.models.user_models import db
from main import app

def safe_add_column(table, column, definition):
    """Safely add a column only if it doesn't exist"""
    try:
        # Check if column exists
        result = db.session.execute(text(f"""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='{table}' AND column_name='{column}'
        """))
        
        if result.fetchone() is None:
            # Column doesn't exist, add it
            db.session.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))
            db.session.commit()
            print(f"  ✓ Added column '{column}' to table '{table}'")
            return True
        else:
            print(f"  ℹ  Column '{column}' already exists in table '{table}'")
            return False
    except Exception as e:
        db.session.rollback()
        print(f"  ✗ Error adding column '{column}' to table '{table}': {e}")
        return False

def migrate_all_missing_columns():
    """Add all missing columns to database tables"""
    with app.app_context():
        print("\n" + "=" * 80)
        print("ADDING MISSING COLUMNS TO DATABASE")
        print("=" * 80)
        
        migrations = {
            'roles': [
                ('description', 'TEXT'),
                ('created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'),
            ],
            'user_progress': [
                ('student_id', 'INTEGER'),
                ('current_module_id', 'INTEGER'),
                ('overall_progress', 'FLOAT DEFAULT 0.0'),
                ('created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'),
                ('updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'),
            ],
            'badges': [
                ('requirements', 'TEXT'),
            ],
            'module_progress': [
                ('completed_lessons', 'INTEGER DEFAULT 0'),
                ('total_lessons', 'INTEGER DEFAULT 0'),
                ('completion_percentage', 'FLOAT DEFAULT 0.0'),
                ('last_accessed', 'TIMESTAMP'),
                ('updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'),
            ],
            'quiz_attempts': [
                ('started_at', 'TIMESTAMP'),
                ('completed_at', 'TIMESTAMP'),
                ('answers', 'TEXT'),
                ('time_taken', 'INTEGER'),
                ('is_submitted', 'BOOLEAN DEFAULT FALSE'),
            ],
            'achievements': [
                ('icon_url', 'VARCHAR(255)'),
                ('points_reward', 'INTEGER DEFAULT 0'),
            ],
            'learning_streaks': [
                ('streak_start_date', 'DATE'),
            ],
            'student_points': [
                ('level', 'INTEGER DEFAULT 1'),
            ],
            'milestones': [
                ('reward_points', 'INTEGER DEFAULT 0'),
                ('icon_url', 'VARCHAR(255)'),
            ],
            'user_milestones': [
                ('achieved_at', 'TIMESTAMP'),
                ('progress', 'FLOAT DEFAULT 0.0'),
            ],
            'leaderboards': [
                ('user_id', 'INTEGER'),
                ('score', 'FLOAT'),
                ('rank', 'INTEGER'),
                ('period', 'VARCHAR(50)'),
                ('updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'),
            ],
            'quest_challenges': [
                ('quest_type', 'VARCHAR(50)'),
                ('target_value', 'INTEGER'),
                ('reward_points', 'INTEGER DEFAULT 0'),
                ('time_limit_days', 'INTEGER'),
                ('expires_at', 'TIMESTAMP'),
            ],
            'user_quest_progress': [
                ('current_progress', 'INTEGER DEFAULT 0'),
                ('is_completed', 'BOOLEAN DEFAULT FALSE'),
            ],
            'opportunities': [
                ('company', 'VARCHAR(255)'),
                ('opportunity_type', 'VARCHAR(50)'),
                ('requirements', 'TEXT'),
                ('deadline', 'TIMESTAMP'),
                ('updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'),
                ('posted_by', 'INTEGER'),
            ],
            'forum_posts': [
                ('category_id', 'INTEGER'),
                ('user_id', 'INTEGER'),
                ('is_pinned', 'BOOLEAN DEFAULT FALSE'),
                ('is_locked', 'BOOLEAN DEFAULT FALSE'),
                ('view_count', 'INTEGER DEFAULT 0'),
            ],
        }
        
        total_added = 0
        for table, columns in migrations.items():
            print(f"\n📋 Table: {table}")
            for column, definition in columns:
                if safe_add_column(table, column, definition):
                    total_added += 1
        
        print("\n" + "=" * 80)
        print(f"✅ MIGRATION COMPLETE - Added {total_added} columns")
        print("=" * 80)

if __name__ == "__main__":
    try:
        migrate_all_missing_columns()
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
