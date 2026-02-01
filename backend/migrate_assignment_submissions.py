#!/usr/bin/env python3
"""
Migration script to add missing resubmission tracking columns to assignment_submissions table.

This script adds the following columns:
- is_resubmission (BOOLEAN, default FALSE)
- original_submission_id (INTEGER, nullable)
- resubmission_count (INTEGER, default 0)
- submission_notes (TEXT, nullable)

Run this script if you get errors about missing assignment_submissions columns.
"""

import sqlite3
import os
import sys
from datetime import datetime

def get_db_path():
    """Get the path to the database file"""
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'afritec_lms_db.db')
    
    if not os.path.exists(db_path):
        print(f"Database file not found at: {db_path}")
        sys.exit(1)
    
    return db_path

def add_assignment_submission_columns():
    """Add missing columns to assignment_submissions table"""
    db_path = get_db_path()
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("Adding missing columns to assignment_submissions table...")
        
        # Check existing columns first
        cursor.execute("PRAGMA table_info(assignment_submissions);")
        existing_columns = [row[1] for row in cursor.fetchall()]
        print(f"Existing columns: {existing_columns}")
        
        columns_to_add = [
            ('is_resubmission', 'BOOLEAN DEFAULT 0 NOT NULL'),
            ('original_submission_id', 'INTEGER'),
            ('resubmission_count', 'INTEGER DEFAULT 0 NOT NULL'),
            ('submission_notes', 'TEXT')
        ]
        
        for column_name, column_def in columns_to_add:
            if column_name not in existing_columns:
                sql = f"ALTER TABLE assignment_submissions ADD COLUMN {column_name} {column_def};"
                print(f"Adding column: {column_name}")
                cursor.execute(sql)
                print(f"✓ Added {column_name}")
            else:
                print(f"✓ Column {column_name} already exists")
        
        # Add foreign key constraint for original_submission_id if it doesn't exist
        # Note: SQLite doesn't support adding foreign key constraints after table creation
        # We'll add this as a comment for future reference
        print("\nNote: Foreign key constraint for original_submission_id should be:")
        print("FOREIGN KEY (original_submission_id) REFERENCES assignment_submissions(id)")
        
        conn.commit()
        print("\n✓ Successfully added missing columns to assignment_submissions table")
        
        # Verify the changes
        cursor.execute("PRAGMA table_info(assignment_submissions);")
        updated_columns = [row[1] for row in cursor.fetchall()]
        print(f"Updated columns: {updated_columns}")
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

def main():
    print("=" * 60)
    print("Assignment Submissions Table Migration")
    print("=" * 60)
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    add_assignment_submission_columns()
    
    print()
    print("Migration completed successfully!")
    print("You can now restart your Flask application.")
    print("=" * 60)

if __name__ == "__main__":
    main()