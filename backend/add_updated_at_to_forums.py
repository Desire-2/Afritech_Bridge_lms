#!/usr/bin/env python3
"""
Migration script to add updated_at column to student_forums table.
"""

import sqlite3
import os
from pathlib import Path
from datetime import datetime

def add_updated_at_to_forums():
    # Get the database path
    backend_dir = Path(__file__).parent
    db_path = backend_dir / "instance" / "afritec_lms_db.db"
    
    if not db_path.exists():
        print(f"❌ Database file not found: {db_path}")
        return False
    
    print(f"📊 Adding updated_at column to student_forums table...")
    
    # Connect to database
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    try:
        # Check if updated_at column already exists
        cursor.execute("PRAGMA table_info(student_forums)")
        columns = cursor.fetchall()
        
        has_updated_at = any(col[1] == 'updated_at' for col in columns)
        
        if has_updated_at:
            print("✅ updated_at column already exists")
            return True
        
        # Add the updated_at column
        current_time = datetime.utcnow().isoformat()
        cursor.execute(f"""
            ALTER TABLE student_forums 
            ADD COLUMN updated_at DATETIME DEFAULT '{current_time}'
        """)
        
        # Update existing records to have the same updated_at as created_at
        cursor.execute("""
            UPDATE student_forums 
            SET updated_at = created_at 
            WHERE updated_at IS NULL
        """)
        
        # Commit changes
        conn.commit()
        
        print("✅ Successfully added updated_at column to student_forums table")
        return True
        
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        conn.rollback()
        return False
        
    finally:
        conn.close()

if __name__ == "__main__":
    add_updated_at_to_forums()