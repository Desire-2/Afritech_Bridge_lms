#!/usr/bin/env python3
"""
Comprehensive migration script to ensure all model columns exist in the database.
Run this script whenever you see "UndefinedColumn" errors.
"""
import sys
from sqlalchemy import text, inspect
from main import app, db

def check_and_add_columns():
    """Check all important tables and add missing columns"""
    with app.app_context():
        try:
            print("=" * 80)
            print("COMPREHENSIVE DATABASE SCHEMA SYNC")
            print("=" * 80)
            
            # Define all expected columns for each table
            table_schemas = {
                "modules": [
                    ("learning_objectives", "TEXT"),
                    ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
                    ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
                    ("is_published", "BOOLEAN DEFAULT FALSE"),
                ],
                "lessons": [
                    ("description", "TEXT"),
                    ("learning_objectives", "TEXT"),
                    ("duration_minutes", "INTEGER"),
                    ("is_published", "BOOLEAN DEFAULT FALSE"),
                    ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
                    ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
                ],
                "quizzes": [
                    ("is_published", "BOOLEAN DEFAULT FALSE"),
                    ("time_limit", "INTEGER"),
                    ("max_attempts", "INTEGER"),
                    ("passing_score", "INTEGER DEFAULT 70"),
                    ("due_date", "TIMESTAMP"),
                    ("points_possible", "FLOAT DEFAULT 100.0"),
                    ("shuffle_questions", "BOOLEAN DEFAULT FALSE"),
                    ("shuffle_answers", "BOOLEAN DEFAULT FALSE"),
                    ("show_correct_answers", "BOOLEAN DEFAULT TRUE"),
                ],
                "assignments": [
                    ("instructions", "TEXT"),
                    ("module_id", "INTEGER REFERENCES modules(id)"),
                    ("assignment_type", "VARCHAR(50) DEFAULT 'file_upload'"),
                    ("max_file_size_mb", "INTEGER DEFAULT 10"),
                    ("allowed_file_types", "VARCHAR(255)"),
                    ("points_possible", "FLOAT DEFAULT 100.0"),
                    ("is_published", "BOOLEAN DEFAULT FALSE"),
                ],
                "projects": [
                    ("objectives", "TEXT"),
                    ("module_ids", "TEXT NOT NULL DEFAULT '[]'"),
                    ("due_date", "TIMESTAMP"),
                    ("points_possible", "FLOAT DEFAULT 100.0"),
                    ("is_published", "BOOLEAN DEFAULT FALSE"),
                    ("submission_format", "VARCHAR(50) DEFAULT 'file_upload'"),
                    ("max_file_size_mb", "INTEGER DEFAULT 50"),
                    ("allowed_file_types", "VARCHAR(255)"),
                    ("collaboration_allowed", "BOOLEAN DEFAULT FALSE"),
                    ("max_team_size", "INTEGER DEFAULT 1"),
                    ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
                    ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
                ],
            }
            
            added_count = 0
            existing_count = 0
            
            for table_name, columns in table_schemas.items():
                print(f"\n📋 Checking table: {table_name}")
                
                for column_name, column_type in columns:
                    # Check if column exists
                    result = db.session.execute(text(f"""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name='{table_name}' AND column_name='{column_name}'
                    """))
                    
                    if result.fetchone() is None:
                        print(f"   ➜ Adding {column_name}...")
                        try:
                            db.session.execute(text(f"""
                                ALTER TABLE {table_name} 
                                ADD COLUMN {column_name} {column_type}
                            """))
                            db.session.commit()
                            print(f"   ✅ Added {column_name}")
                            added_count += 1
                        except Exception as e:
                            print(f"   ⚠️  Error: {str(e)}")
                            db.session.rollback()
                    else:
                        existing_count += 1
            
            print("\n" + "=" * 80)
            print(f"✅ SYNC COMPLETED")
            print(f"   Added: {added_count} columns")
            print(f"   Already existed: {existing_count} columns")
            print("=" * 80)
            
            return True
            
        except Exception as e:
            print(f"\n❌ Sync failed: {str(e)}")
            db.session.rollback()
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    success = check_and_add_columns()
    sys.exit(0 if success else 1)
