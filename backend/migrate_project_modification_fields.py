#!/usr/bin/env python3
"""
Migration script to add missing modification request fields to projects table
"""

import os
import sys
import sqlite3
from datetime import datetime

# Add the parent directory to sys.path so we can import from src
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def add_modification_fields():
    """Add the missing modification request fields to projects table"""
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'afritec_lms_db.db')
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return False
        
    print(f"Connecting to database: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check current table structure
        cursor.execute('PRAGMA table_info(projects)')
        columns = [col[1] for col in cursor.fetchall()]
        print(f"Current columns in projects table: {columns}")
        
        # Add missing columns if they don't exist
        missing_columns = [
            ('modification_requested', 'BOOLEAN DEFAULT 0 NOT NULL'),
            ('modification_request_reason', 'TEXT'),
            ('modification_requested_at', 'DATETIME'),
            ('modification_requested_by', 'INTEGER'),
            ('can_resubmit', 'BOOLEAN DEFAULT 0 NOT NULL')
        ]
        
        added_columns = []
        for column_name, column_type in missing_columns:
            if column_name not in columns:
                try:
                    print(f"Adding column: {column_name}")
                    cursor.execute(f'ALTER TABLE projects ADD COLUMN {column_name} {column_type}')
                    added_columns.append(column_name)
                except sqlite3.Error as e:
                    print(f"Error adding column {column_name}: {e}")
                    continue
        
        if added_columns:
            # Add foreign key constraint for modification_requested_by if column was added
            if 'modification_requested_by' in added_columns:
                print("Note: Foreign key constraint for modification_requested_by will be handled by SQLAlchemy")
        
        conn.commit()
        print(f"Successfully added columns: {added_columns}")
        
        # Verify the changes
        cursor.execute('PRAGMA table_info(projects)')
        updated_columns = [col[1] for col in cursor.fetchall()]
        print(f"Updated columns in projects table: {updated_columns}")
        
        conn.close()
        return True
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        if 'conn' in locals():
            conn.close()
        return False

if __name__ == "__main__":
    print("Starting migration to add modification request fields to projects table...")
    success = add_modification_fields()
    
    if success:
        print("Migration completed successfully!")
        print("Please restart the Flask application for changes to take effect.")
    else:
        print("Migration failed!")
        sys.exit(1)