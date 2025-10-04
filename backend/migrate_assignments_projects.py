#!/usr/bin/env python3

import sqlite3
import sys
import os

# Add the project root to Python path
sys.path.append('/home/desire/My_Project/AB/afritec_bridge_lms/backend')

def migrate_assignments_projects():
    """Add missing columns to assignments and projects tables"""
    
    # Database path
    db_path = '/home/desire/My_Project/AB/afritec_bridge_lms/backend/instance/afritec_lms_db.db'
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔧 Starting assignments and projects table migration...")
        
        # Get current assignments table columns
        cursor.execute("PRAGMA table_info(assignments)")
        assignments_columns = [row[1] for row in cursor.fetchall()]
        print(f"Current assignments columns: {assignments_columns}")
        
        # Add missing columns to assignments table
        assignments_migrations = [
            ("instructions", "TEXT"),
            ("assignment_type", "VARCHAR(50) DEFAULT 'essay'"),
            ("max_file_size_mb", "INTEGER DEFAULT 10"),
            ("allowed_file_types", "TEXT DEFAULT 'pdf,doc,docx'"),
            ("due_date", "DATETIME"),
            ("points_possible", "FLOAT DEFAULT 100.0"),
            ("is_published", "BOOLEAN DEFAULT 0")
        ]
        
        for column, definition in assignments_migrations:
            if column not in assignments_columns:
                try:
                    cursor.execute(f"ALTER TABLE assignments ADD COLUMN {column} {definition}")
                    print(f"✅ Added assignments.{column}")
                except sqlite3.OperationalError as e:
                    print(f"⚠️  Could not add assignments.{column}: {e}")
        
        # Get current projects table columns
        cursor.execute("PRAGMA table_info(projects)")
        projects_columns = [row[1] for row in cursor.fetchall()]
        print(f"Current projects columns: {projects_columns}")
        
        # Add missing columns to projects table
        projects_migrations = [
            ("requirements", "TEXT"),
            ("deliverables", "TEXT"),
            ("assessment_criteria", "TEXT"),
            ("max_file_size_mb", "INTEGER DEFAULT 50"),
            ("allowed_file_types", "TEXT DEFAULT 'pdf,doc,docx,zip,jpg,png'"),
            ("due_date", "DATETIME"),
            ("points_possible", "FLOAT DEFAULT 100.0"),
            ("is_published", "BOOLEAN DEFAULT 0")
        ]
        
        for column, definition in projects_migrations:
            if column not in projects_columns:
                try:
                    cursor.execute(f"ALTER TABLE projects ADD COLUMN {column} {definition}")
                    print(f"✅ Added projects.{column}")
                except sqlite3.OperationalError as e:
                    print(f"⚠️  Could not add projects.{column}: {e}")
        
        # Check if quiz table needs updates
        cursor.execute("PRAGMA table_info(quizzes)")
        quiz_columns = [row[1] for row in cursor.fetchall()]
        print(f"Current quiz columns: {quiz_columns}")
        
        # Add missing columns to quizzes table if needed
        quiz_migrations = [
            ("time_limit_minutes", "INTEGER"),
            ("max_attempts", "INTEGER DEFAULT 1"),
            ("points_possible", "FLOAT DEFAULT 100.0"),
            ("is_published", "BOOLEAN DEFAULT 0")
        ]
        
        for column, definition in quiz_migrations:
            if column not in quiz_columns:
                try:
                    cursor.execute(f"ALTER TABLE quizzes ADD COLUMN {column} {definition}")
                    print(f"✅ Added quizzes.{column}")
                except sqlite3.OperationalError as e:
                    print(f"⚠️  Could not add quizzes.{column}: {e}")
        
        conn.commit()
        conn.close()
        
        print("\n✅ Assignments and projects migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False

if __name__ == "__main__":
    success = migrate_assignments_projects()
    if success:
        print("\n🎉 Database migration successful!")
    else:
        print("\n💥 Database migration failed!")
        sys.exit(1)