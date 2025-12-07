#!/usr/bin/env python3
"""
Migration script to add missing columns to assignments and projects tables.
"""
import sys
from sqlalchemy import text
from main import app, db

def run_migration():
    """Add all missing columns to assignments and projects tables"""
    with app.app_context():
        try:
            print("=" * 80)
            print("MIGRATING ASSIGNMENTS AND PROJECTS TABLES")
            print("=" * 80)
            
            migrations = [
                # Assignments table
                ("assignments", "instructions", "TEXT"),
                ("assignments", "course_id", "INTEGER REFERENCES courses(id)"),
                ("assignments", "module_id", "INTEGER REFERENCES modules(id)"),
                ("assignments", "lesson_id", "INTEGER REFERENCES lessons(id)"),
                ("assignments", "instructor_id", "INTEGER REFERENCES users(id)"),
                ("assignments", "assignment_type", "VARCHAR(50) DEFAULT 'file_upload'"),
                ("assignments", "max_file_size_mb", "INTEGER DEFAULT 10"),
                ("assignments", "allowed_file_types", "VARCHAR(255)"),
                ("assignments", "due_date", "TIMESTAMP"),
                ("assignments", "points_possible", "FLOAT DEFAULT 100.0"),
                ("assignments", "is_published", "BOOLEAN DEFAULT FALSE"),
                ("assignments", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
                ("assignments", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
                
                # Projects table
                ("projects", "objectives", "TEXT"),
                ("projects", "module_ids", "TEXT NOT NULL DEFAULT '[]'"),
                ("projects", "due_date", "TIMESTAMP"),
                ("projects", "points_possible", "FLOAT DEFAULT 100.0"),
                ("projects", "is_published", "BOOLEAN DEFAULT FALSE"),
                ("projects", "submission_format", "VARCHAR(50) DEFAULT 'file_upload'"),
                ("projects", "max_file_size_mb", "INTEGER DEFAULT 50"),
                ("projects", "allowed_file_types", "VARCHAR(255)"),
                ("projects", "collaboration_allowed", "BOOLEAN DEFAULT FALSE"),
                ("projects", "max_team_size", "INTEGER DEFAULT 1"),
                ("projects", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
                ("projects", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
            ]
            
            for table_name, column_name, column_type in migrations:
                print(f"\n📋 Checking {table_name}.{column_name}...")
                
                # Check if column exists
                result = db.session.execute(text(f"""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name='{table_name}' AND column_name='{column_name}'
                """))
                
                if result.fetchone() is None:
                    print(f"   ➜ Adding {table_name}.{column_name}...")
                    try:
                        db.session.execute(text(f"""
                            ALTER TABLE {table_name} 
                            ADD COLUMN {column_name} {column_type}
                        """))
                        db.session.commit()
                        print(f"   ✅ Added {table_name}.{column_name}")
                    except Exception as e:
                        print(f"   ⚠️  Error adding column: {str(e)}")
                        db.session.rollback()
                else:
                    print(f"   ✓ Column already exists")
            
            print("\n" + "=" * 80)
            print("✅ MIGRATION COMPLETED")
            print("=" * 80)
            
            return True
            
        except Exception as e:
            print(f"\n❌ Migration failed: {str(e)}")
            db.session.rollback()
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
