#!/usr/bin/env python3
"""
Database migration script to add missing columns to existing tables
"""

import sqlite3
import sys
import os

def add_column_if_not_exists(cursor, table, column, column_type, default_value=None):
    """Add a column to a table if it doesn't already exist"""
    try:
        # Check if column exists
        cursor.execute(f"PRAGMA table_info({table})")
        columns = [col[1] for col in cursor.fetchall()]
        
        if column not in columns:
            default_clause = f" DEFAULT {default_value}" if default_value is not None else ""
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {column_type}{default_clause}")
            print(f"✅ Added column '{column}' to table '{table}'")
        else:
            print(f"⏭️  Column '{column}' already exists in table '{table}'")
    except Exception as e:
        print(f"❌ Error adding column '{column}' to table '{table}': {e}")

def main():
    # Database path
    db_path = 'instance/afritec_lms_db.db'
    
    if not os.path.exists(db_path):
        print(f"❌ Database file not found: {db_path}")
        sys.exit(1)
    
    print("🔧 Starting database migration...")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Add missing columns to modules table
        print("\n📋 Updating modules table...")
        add_column_if_not_exists(cursor, 'modules', 'learning_objectives', 'TEXT')
        add_column_if_not_exists(cursor, 'modules', 'created_at', 'DATETIME', 'CURRENT_TIMESTAMP')
        add_column_if_not_exists(cursor, 'modules', 'updated_at', 'DATETIME', 'CURRENT_TIMESTAMP')
        
        # Add missing columns to lessons table  
        print("\n📚 Updating lessons table...")
        add_column_if_not_exists(cursor, 'lessons', 'learning_objectives', 'TEXT')
        add_column_if_not_exists(cursor, 'lessons', 'order', 'INTEGER', '0')
        add_column_if_not_exists(cursor, 'lessons', 'duration_minutes', 'INTEGER')
        add_column_if_not_exists(cursor, 'lessons', 'is_published', 'BOOLEAN', 'FALSE')
        add_column_if_not_exists(cursor, 'lessons', 'created_at', 'DATETIME', 'CURRENT_TIMESTAMP')
        add_column_if_not_exists(cursor, 'lessons', 'updated_at', 'DATETIME', 'CURRENT_TIMESTAMP')
        
        # Check if tables exist and create if needed
        print("\n🗃️  Checking for missing tables...")
        
        # Check for assignments table
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='assignments'")
        if not cursor.fetchone():
            print("📝 Creating assignments table...")
            cursor.execute('''
                CREATE TABLE assignments (
                    id INTEGER PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    instructions TEXT,
                    due_date DATETIME,
                    course_id INTEGER NOT NULL,
                    module_id INTEGER,
                    lesson_id INTEGER,
                    max_points INTEGER DEFAULT 100,
                    attachment_allowed BOOLEAN DEFAULT TRUE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (course_id) REFERENCES courses (id),
                    FOREIGN KEY (module_id) REFERENCES modules (id),
                    FOREIGN KEY (lesson_id) REFERENCES lessons (id)
                )
            ''')
            print("✅ Created assignments table")
        else:
            print("⏭️  Assignments table already exists")
            
        # Check for projects table
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'")
        if not cursor.fetchone():
            print("🎯 Creating projects table...")
            cursor.execute('''
                CREATE TABLE projects (
                    id INTEGER PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    instructions TEXT,
                    due_date DATETIME,
                    course_id INTEGER NOT NULL,
                    spans_multiple_modules BOOLEAN DEFAULT FALSE,
                    max_points INTEGER DEFAULT 100,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (course_id) REFERENCES courses (id)
                )
            ''')
            print("✅ Created projects table")
        else:
            print("⏭️  Projects table already exists")
            
        # Check for assignment_submissions table
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='assignment_submissions'")
        if not cursor.fetchone():
            print("📤 Creating assignment_submissions table...")
            cursor.execute('''
                CREATE TABLE assignment_submissions (
                    id INTEGER PRIMARY KEY,
                    assignment_id INTEGER NOT NULL,
                    student_id INTEGER NOT NULL,
                    content TEXT,
                    attachment_path VARCHAR(500),
                    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    grade INTEGER,
                    feedback TEXT,
                    graded_at DATETIME,
                    graded_by INTEGER,
                    FOREIGN KEY (assignment_id) REFERENCES assignments (id),
                    FOREIGN KEY (student_id) REFERENCES users (id),
                    FOREIGN KEY (graded_by) REFERENCES users (id)
                )
            ''')
            print("✅ Created assignment_submissions table")
        else:
            print("⏭️  Assignment_submissions table already exists")
            
        # Check for project_submissions table
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='project_submissions'")
        if not cursor.fetchone():
            print("🎯 Creating project_submissions table...")
            cursor.execute('''
                CREATE TABLE project_submissions (
                    id INTEGER PRIMARY KEY,
                    project_id INTEGER NOT NULL,
                    student_id INTEGER NOT NULL,
                    content TEXT,
                    attachment_path VARCHAR(500),
                    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    grade INTEGER,
                    feedback TEXT,
                    graded_at DATETIME,
                    graded_by INTEGER,
                    FOREIGN KEY (project_id) REFERENCES projects (id),
                    FOREIGN KEY (student_id) REFERENCES users (id),
                    FOREIGN KEY (graded_by) REFERENCES users (id)
                )
            ''')
            print("✅ Created project_submissions table")
        else:
            print("⏭️  Project_submissions table already exists")
        
        # Commit all changes
        conn.commit()
        print("\n✅ Database migration completed successfully!")
        
        # Show final table structure
        print("\n📊 Current modules table structure:")
        cursor.execute("PRAGMA table_info(modules)")
        for col in cursor.fetchall():
            print(f"   {col[1]} ({col[2]})")
            
        print("\n📊 Current lessons table structure:")
        cursor.execute("PRAGMA table_info(lessons)")
        for col in cursor.fetchall():
            print(f"   {col[1]} ({col[2]})")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()