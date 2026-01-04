#!/usr/bin/env python3
"""
Migration: Add enhanced video progress tracking fields to lesson_completions table

This adds:
- video_current_time: Resume playback functionality
- video_duration: Track total video length
- video_completed: Boolean flag for 90%+ completion
- video_watch_count: Analytics for rewatch behavior
- video_last_watched: Timestamp of last video interaction
- playback_speed: User's preferred speed setting
- mixed_video_progress: JSON field for tracking multiple videos in mixed content
"""

import os
import sys
from sqlalchemy import text

# Add the parent directory to the path to import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app, db

def migrate():
    """Add video progress fields to lesson_completions table"""
    
    with app.app_context():
        print("🔄 Starting video progress fields migration...")
        
        try:
            # Check if fields already exist (PostgreSQL compatible)
            result = db.session.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'lesson_completions'
            """))
            existing_columns = {row[0] for row in result}
            
            fields_to_add = {
                'video_current_time': 'ALTER TABLE lesson_completions ADD COLUMN IF NOT EXISTS video_current_time REAL DEFAULT 0.0',
                'video_duration': 'ALTER TABLE lesson_completions ADD COLUMN IF NOT EXISTS video_duration REAL DEFAULT 0.0',
                'video_completed': 'ALTER TABLE lesson_completions ADD COLUMN IF NOT EXISTS video_completed BOOLEAN DEFAULT false',
                'video_watch_count': 'ALTER TABLE lesson_completions ADD COLUMN IF NOT EXISTS video_watch_count INTEGER DEFAULT 0',
                'video_last_watched': 'ALTER TABLE lesson_completions ADD COLUMN IF NOT EXISTS video_last_watched TIMESTAMP',
                'playback_speed': 'ALTER TABLE lesson_completions ADD COLUMN IF NOT EXISTS playback_speed REAL DEFAULT 1.0',
                'mixed_video_progress': 'ALTER TABLE lesson_completions ADD COLUMN IF NOT EXISTS mixed_video_progress TEXT'
            }
            
            added_count = 0
            for field_name, sql_statement in fields_to_add.items():
                if field_name not in existing_columns:
                    print(f"  ➕ Adding {field_name}...")
                    db.session.execute(text(sql_statement))
                    added_count += 1
                else:
                    print(f"  ✓ {field_name} already exists")
            
            if added_count > 0:
                db.session.commit()
                print(f"✅ Migration complete! Added {added_count} new field(s).")
            else:
                print("✅ All fields already exist. No migration needed.")
                
        except Exception as e:
            db.session.rollback()
            print(f"❌ Migration failed: {str(e)}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

if __name__ == '__main__':
    migrate()
