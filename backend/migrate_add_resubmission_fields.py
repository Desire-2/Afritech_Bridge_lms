#!/usr/bin/env python3
"""
Migration script to add max_resubmissions and resubmission_count fields 
to assignments and projects tables.
"""

import sqlite3
import os
from pathlib import Path

def get_db_path():
    """Get the database file path"""
    backend_dir = Path(__file__).parent
    db_path = backend_dir / "instance" / "afritec_lms_db.db"
    return str(db_path)

def add_resubmission_fields():
    """Add max_resubmissions and resubmission_count columns to assignments and projects tables"""
    db_path = get_db_path()
    
    if not os.path.exists(db_path):
        print(f"❌ Database file not found: {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔄 Adding resubmission fields to assignments table...")
        
        # Check if columns already exist in assignments table
        cursor.execute("PRAGMA table_info(assignments)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'max_resubmissions' not in columns:
            cursor.execute("ALTER TABLE assignments ADD COLUMN max_resubmissions INTEGER NOT NULL DEFAULT 3")
            print("✅ Added max_resubmissions column to assignments table")
        else:
            print("⚠️  max_resubmissions column already exists in assignments table")
        
        if 'resubmission_count' not in columns:
            cursor.execute("ALTER TABLE assignments ADD COLUMN resubmission_count INTEGER NOT NULL DEFAULT 0")
            print("✅ Added resubmission_count column to assignments table")
        else:
            print("⚠️  resubmission_count column already exists in assignments table")
        
        print("🔄 Adding resubmission fields to projects table...")
        
        # Check if columns already exist in projects table
        cursor.execute("PRAGMA table_info(projects)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'max_resubmissions' not in columns:
            cursor.execute("ALTER TABLE projects ADD COLUMN max_resubmissions INTEGER NOT NULL DEFAULT 3")
            print("✅ Added max_resubmissions column to projects table")
        else:
            print("⚠️  max_resubmissions column already exists in projects table")
        
        if 'resubmission_count' not in columns:
            cursor.execute("ALTER TABLE projects ADD COLUMN resubmission_count INTEGER NOT NULL DEFAULT 0")
            print("✅ Added resubmission_count column to projects table")
        else:
            print("⚠️  resubmission_count column already exists in projects table")
        
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
    print("🚀 Starting migration to add resubmission fields...")
    success = add_resubmission_fields()
    
    if success:
        print("✨ Migration completed! The Flask server should now work correctly.")
    else:
        print("❌ Migration failed! Please check the error messages above.")