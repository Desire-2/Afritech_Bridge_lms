#!/usr/bin/env python3
"""
Database migration script to add video_progress column to lesson_completions table
"""

import sys
import os
from datetime import datetime

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app, db
from src.models.student_models import LessonCompletion

def add_video_progress_column():
    """Add video_progress column if it doesn't exist"""
    with app.app_context():
        print("🔄 Checking for video_progress column...")
        
        # Check if column exists by trying to query it
        try:
            # Try to access video_progress to see if it exists
            test_query = db.session.query(LessonCompletion.video_progress).limit(1).all()
            print("✅ video_progress column already exists!")
            return True
        except Exception as e:
            error_str = str(e).lower()
            if "no such column" in error_str or "unknown column" in error_str or "does not exist" in error_str:
                print("➕ Adding video_progress column...")
                
                # Add the column using raw SQL
                try:
                    # Try PostgreSQL syntax first (for production)
                    db.session.execute(db.text(
                        "ALTER TABLE lesson_completions ADD COLUMN video_progress DOUBLE PRECISION DEFAULT 0.0"
                    ))
                    db.session.commit()
                    print("✅ Successfully added video_progress column (PostgreSQL)!")
                    return True
                except Exception as pg_error:
                    print(f"⚠️  PostgreSQL syntax failed: {pg_error}")
                    db.session.rollback()
                    
                    # Try SQLite syntax if PostgreSQL fails
                    try:
                        db.session.execute(db.text(
                            "ALTER TABLE lesson_completions ADD COLUMN video_progress FLOAT DEFAULT 0.0"
                        ))
                        db.session.commit()
                        print("✅ Successfully added video_progress column (SQLite)!")
                        return True
                    except Exception as sqlite_error:
                        print(f"❌ SQLite syntax also failed: {sqlite_error}")
                        db.session.rollback()
                        return False
            else:
                print(f"❌ Unexpected error: {e}")
                return False

def verify_column():
    """Verify the column was added successfully"""
    with app.app_context():
        try:
            # Query a few records to verify
            completions = LessonCompletion.query.limit(5).all()
            print(f"\n📊 Verified {len(completions)} lesson completion records")
            for completion in completions:
                print(f"  - Lesson {completion.lesson_id}: video_progress={completion.video_progress}%")
            return True
        except Exception as e:
            print(f"❌ Verification failed: {e}")
            return False

if __name__ == "__main__":
    print("=" * 60)
    print("Video Progress Column Migration")
    print("=" * 60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    success = add_video_progress_column()
    
    if success:
        print("\n" + "=" * 60)
        print("Verifying Migration")
        print("=" * 60)
        verify_column()
    
    print("\n" + "=" * 60)
    print("✅ Migration Complete!" if success else "❌ Migration Failed!")
    print("=" * 60)
    print(f"Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
