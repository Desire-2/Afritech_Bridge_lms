#!/usr/bin/env python3
"""
Migration script to add resubmission fields to project_submissions table.
"""

import sqlite3
import os
from pathlib import Path

def get_db_path():
    """Get the database file path"""
    backend_dir = Path(__file__).parent
    db_path = backend_dir / "instance" / "afritec_lms_db.db"
    return str(db_path)

def add_project_submission_resubmission_fields():
    """Add resubmission fields to project_submissions table"""
    db_path = get_db_path()
    
    if not os.path.exists(db_path):
        print(f"❌ Database file not found: {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔄 Adding resubmission fields to project_submissions table...")
        
        # Check if columns already exist in project_submissions table
        cursor.execute("PRAGMA table_info(project_submissions)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'is_resubmission' not in columns:
            cursor.execute("ALTER TABLE project_submissions ADD COLUMN is_resubmission BOOLEAN NOT NULL DEFAULT 0")
            print("✅ Added is_resubmission column to project_submissions table")
        else:
            print("⚠️  is_resubmission column already exists in project_submissions table")
        
        if 'original_submission_id' not in columns:
            cursor.execute("ALTER TABLE project_submissions ADD COLUMN original_submission_id INTEGER REFERENCES project_submissions(id)")
            print("✅ Added original_submission_id column to project_submissions table")
        else:
            print("⚠️  original_submission_id column already exists in project_submissions table")
            
        if 'resubmission_count' not in columns:
            cursor.execute("ALTER TABLE project_submissions ADD COLUMN resubmission_count INTEGER NOT NULL DEFAULT 0")
            print("✅ Added resubmission_count column to project_submissions table")
        else:
            print("⚠️  resubmission_count column already exists in project_submissions table")
            
        if 'submission_notes' not in columns:
            cursor.execute("ALTER TABLE project_submissions ADD COLUMN submission_notes TEXT")
            print("✅ Added submission_notes column to project_submissions table")
        else:
            print("⚠️  submission_notes column already exists in project_submissions table")
        
        conn.commit()
        conn.close()
        
        print("🎉 Migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return False

if __name__ == "__main__":
    print("🚀 Starting migration to add resubmission fields to project_submissions...")
    success = add_project_submission_resubmission_fields()
    
    if success:
        print("✨ Migration completed! The grading interface should now work correctly.")
    else:
        print("❌ Migration failed! Please check the error messages above.")