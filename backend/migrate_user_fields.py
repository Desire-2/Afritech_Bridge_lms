#!/usr/bin/env python3
"""
Migration script to add phone_number and is_active columns to users table
Run this script to update the database schema without losing existing data
"""

import sqlite3
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent / "instance" / "afritec_lms_db.db"

def check_column_exists(cursor, table_name, column_name):
    """Check if a column exists in a table"""
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [row[1] for row in cursor.fetchall()]
    return column_name in columns

def migrate_database():
    """Add missing columns to users table"""
    
    if not DB_PATH.exists():
        print(f"❌ Database not found at: {DB_PATH}")
        print("   Please run the backend first to create the database")
        sys.exit(1)
    
    print(f"📁 Database found at: {DB_PATH}")
    print("🔄 Starting migration...\n")
    
    try:
        # Connect to database
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        
        # Check and add phone_number column
        if not check_column_exists(cursor, 'users', 'phone_number'):
            print("➕ Adding 'phone_number' column...")
            cursor.execute("ALTER TABLE users ADD COLUMN phone_number VARCHAR(20)")
            print("   ✅ phone_number column added")
        else:
            print("   ℹ️  phone_number column already exists")
        
        # Check and add is_active column
        if not check_column_exists(cursor, 'users', 'is_active'):
            print("➕ Adding 'is_active' column...")
            cursor.execute("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1")
            print("   ✅ is_active column added")
            
            # Set all existing users to active
            cursor.execute("UPDATE users SET is_active = 1 WHERE is_active IS NULL")
            print("   ✅ Set all existing users to active")
        else:
            print("   ℹ️  is_active column already exists")
        
        # Commit changes
        conn.commit()
        print("\n✅ Migration completed successfully!")
        
        # Verify changes
        print("\n🔍 Verifying changes...")
        cursor.execute("PRAGMA table_info(users)")
        columns = cursor.fetchall()
        
        phone_number_found = False
        is_active_found = False
        
        for col in columns:
            if col[1] == 'phone_number':
                phone_number_found = True
                print(f"   ✅ phone_number: {col[2]} (nullable)")
            elif col[1] == 'is_active':
                is_active_found = True
                print(f"   ✅ is_active: {col[2]} (default: {col[4]})")
        
        if phone_number_found and is_active_found:
            print("\n🎉 All columns verified successfully!")
        else:
            print("\n⚠️  Warning: Some columns may not have been added correctly")
        
        # Close connection
        cursor.close()
        conn.close()
        
    except sqlite3.Error as e:
        print(f"\n❌ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("=" * 70)
    print("  User Fields Migration Script")
    print("  Adding: phone_number, is_active")
    print("=" * 70)
    print()
    
    migrate_database()
    
    print("\n" + "=" * 70)
    print("  Migration Complete - Please restart the backend server")
    print("=" * 70)
