#!/usr/bin/env python3
"""
Migration script to add missing columns to assignments table
Run this script to update the database schema for assignment late submission features
"""

import sqlite3
import sys
import os

def migrate_assignment_table():
    """Add missing columns to assignments table"""
    # Get the database path
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'afritec_lms_db.db')
    
    if not os.path.exists(db_path):
        print(f"Database not found at: {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(assignments)")
        columns = [column[1] for column in cursor.fetchall()]
        
        migrations_applied = []
        
        # Add allow_late_submission column if it doesn't exist
        if 'allow_late_submission' not in columns:
            cursor.execute("""
                ALTER TABLE assignments 
                ADD COLUMN allow_late_submission BOOLEAN DEFAULT 1
            """)
            migrations_applied.append('allow_late_submission')
        
        # Add late_penalty column if it doesn't exist
        if 'late_penalty' not in columns:
            cursor.execute("""
                ALTER TABLE assignments 
                ADD COLUMN late_penalty REAL DEFAULT 0.0
            """)
            migrations_applied.append('late_penalty')
        
        conn.commit()
        
        if migrations_applied:
            print(f"Successfully added columns: {', '.join(migrations_applied)}")
        else:
            print("No migrations needed - all columns already exist")
        
        return True
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    print("Running assignment table migration...")
    if migrate_assignment_table():
        print("Migration completed successfully!")
        sys.exit(0)
    else:
        print("Migration failed!")
        sys.exit(1)