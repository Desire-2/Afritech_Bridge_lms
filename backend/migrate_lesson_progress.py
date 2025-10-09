#!/usr/bin/env python3
"""
Enhanced Lesson Progress Tracking Migration
Adds progress tracking fields to lesson_completions table
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app
from src.models.user_models import db
from src.models.student_models import LessonCompletion
from sqlalchemy import text

def migrate_lesson_progress():
    """Add progress tracking columns to lesson_completions table"""
    with app.app_context():
        try:
            print("🚀 Starting Enhanced Lesson Progress Migration...")
            
            # Check if we can connect to database
            with db.engine.connect() as connection:
                result = connection.execute(text("SELECT 1"))
                print("✅ Database connection successful")
            
            # Add new columns if they don't exist
            columns_to_add = [
                ("completed", "BOOLEAN DEFAULT FALSE"),
                ("reading_progress", "REAL DEFAULT 0.0"),
                ("engagement_score", "REAL DEFAULT 0.0"), 
                ("scroll_progress", "REAL DEFAULT 0.0"),
                ("updated_at", "TIMESTAMP"),  # No default for SQLite compatibility
                ("last_accessed", "TIMESTAMP")  # No default for SQLite compatibility
            ]
            
            for column_name, column_def in columns_to_add:
                try:
                    # Try to add column
                    with db.engine.connect() as connection:
                        connection.execute(text(f"ALTER TABLE lesson_completions ADD COLUMN {column_name} {column_def}"))
                        connection.commit()
                    print(f"✅ Added column: {column_name}")
                except Exception as e:
                    if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                        print(f"⚠️  Column {column_name} already exists, skipping")
                    else:
                        print(f"❌ Error adding column {column_name}: {e}")
            
            # Update existing records to set default values
            try:
                with db.engine.connect() as connection:
                    # First, check which columns exist
                    columns_info = connection.execute(text("PRAGMA table_info(lesson_completions)")).fetchall()
                    existing_columns = [col[1] for col in columns_info]
                    
                    # Build update query based on existing columns
                    update_parts = []
                    
                    if 'completed' in existing_columns:
                        update_parts.append("""completed = CASE 
                            WHEN completed_at IS NOT NULL THEN 1 
                            ELSE 0 
                        END""")
                    
                    if 'reading_progress' in existing_columns:
                        update_parts.append("""reading_progress = CASE 
                            WHEN completed_at IS NOT NULL THEN 100.0 
                            ELSE 0.0 
                        END""")
                    
                    if 'engagement_score' in existing_columns:
                        update_parts.append("""engagement_score = CASE 
                            WHEN completed_at IS NOT NULL THEN 75.0 
                            ELSE 0.0 
                        END""")
                    
                    if 'scroll_progress' in existing_columns:
                        update_parts.append("""scroll_progress = CASE 
                            WHEN completed_at IS NOT NULL THEN 100.0 
                            ELSE 0.0 
                        END""")
                    
                    if 'updated_at' in existing_columns:
                        update_parts.append("updated_at = COALESCE(completed_at, datetime('now'))")
                    
                    if 'last_accessed' in existing_columns:
                        update_parts.append("last_accessed = COALESCE(completed_at, datetime('now'))")
                    
                    if update_parts:
                        update_query = f"""
                            UPDATE lesson_completions 
                            SET {', '.join(update_parts)}
                            WHERE completed_at IS NOT NULL
                        """
                        connection.execute(text(update_query))
                        connection.commit()
                        print("✅ Updated existing completed lessons with default progress values")
                    else:
                        print("⚠️  No columns to update")
                        
            except Exception as e:
                print(f"⚠️  Could not update existing records: {e}")
            
            print("🎉 Lesson progress migration completed successfully!")
            print("Enhanced tracking fields added:")
            print("  - completed (boolean)")
            print("  - reading_progress (0-100%)")
            print("  - engagement_score (0-100%)")
            print("  - scroll_progress (0-100%)")
            print("  - updated_at (timestamp)")
            print("  - last_accessed (timestamp)")
            
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            return False
    
    return True

if __name__ == "__main__":
    migrate_lesson_progress()