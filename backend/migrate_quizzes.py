#!/usr/bin/env python3
"""
Database Migration Script - Add is_published column to quizzes table
"""

import os
import sys
import sqlite3
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

def migrate_quizzes_is_published():
    """Add is_published column to quizzes table"""
    print("🔧 Adding is_published column to quizzes table...")
    
    try:
        # Connect to SQLite database
        db_path = os.path.join(os.path.dirname(__file__), 'instance', 'afritec_lms_db.db')
        if not os.path.exists(db_path):
            print(f"❌ Database not found at {db_path}")
            return False
            
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if is_published column already exists
        cursor.execute("PRAGMA table_info(quizzes)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'is_published' in columns:
            print("✅ is_published column already exists in quizzes table")
            conn.close()
            return True
        
        # Add is_published column with default value False
        cursor.execute("ALTER TABLE quizzes ADD COLUMN is_published BOOLEAN DEFAULT FALSE")
        
        # Update all existing quizzes to have is_published = False
        cursor.execute("UPDATE quizzes SET is_published = FALSE WHERE is_published IS NULL")
        
        conn.commit()
        print("✅ Successfully added is_published column to quizzes table")
        
        # Verify the migration
        cursor.execute("PRAGMA table_info(quizzes)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'is_published' in columns:
            print("✅ Migration verified - is_published column exists")
        else:
            print("❌ Migration verification failed")
            return False
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Starting quizzes table migration...")
    success = migrate_quizzes_is_published()
    
    if success:
        print("\n✅ Migration completed successfully!")
    else:
        print("\n❌ Migration failed!")
        sys.exit(1)