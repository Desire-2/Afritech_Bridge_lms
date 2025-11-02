"""
Database Migration: Add Quiz Settings Fields
Date: November 2, 2025
Description: Adds time_limit, max_attempts, passing_score, due_date, points_possible,
             shuffle_questions, shuffle_answers, and show_correct_answers to quizzes table
"""

import sqlite3
import os

def run_migration():
    # Get the database path
    db_path = os.path.join(os.path.dirname(__file__), 'instance/afritec_lms_db.db')
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at: {db_path}")
        return False
    
    print(f"📁 Database path: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(quizzes)")
        existing_columns = [col[1] for col in cursor.fetchall()]
        
        migrations = []
        
        # Define the columns to add
        new_columns = {
            'time_limit': 'INTEGER',
            'max_attempts': 'INTEGER',
            'passing_score': 'INTEGER DEFAULT 70',
            'due_date': 'DATETIME',
            'points_possible': 'REAL DEFAULT 100.0',
            'shuffle_questions': 'BOOLEAN DEFAULT 0',
            'shuffle_answers': 'BOOLEAN DEFAULT 0',
            'show_correct_answers': 'BOOLEAN DEFAULT 1'
        }
        
        print("\n🔍 Checking existing columns...")
        print(f"Existing columns: {existing_columns}")
        
        # Add each column if it doesn't exist
        for col_name, col_type in new_columns.items():
            if col_name not in existing_columns:
                sql = f"ALTER TABLE quizzes ADD COLUMN {col_name} {col_type}"
                migrations.append((col_name, sql))
            else:
                print(f"✅ Column '{col_name}' already exists")
        
        if not migrations:
            print("\n✅ All columns already exist. No migration needed.")
            return True
        
        # Execute migrations
        print(f"\n📝 Applying {len(migrations)} migrations...")
        for col_name, sql in migrations:
            print(f"   Adding column: {col_name}")
            cursor.execute(sql)
        
        conn.commit()
        
        # Verify the changes
        cursor.execute("PRAGMA table_info(quizzes)")
        updated_columns = [col[1] for col in cursor.fetchall()]
        
        print("\n✅ Migration completed successfully!")
        print(f"📊 Updated columns: {updated_columns}")
        
        # Show column details
        print("\n📋 Quiz table structure:")
        cursor.execute("PRAGMA table_info(quizzes)")
        for col in cursor.fetchall():
            print(f"   {col[1]:25} {col[2]:15} {'NOT NULL' if col[3] else ''} {f'DEFAULT {col[4]}' if col[4] else ''}")
        
        conn.close()
        return True
        
    except sqlite3.Error as e:
        print(f"\n❌ Migration failed: {e}")
        if conn:
            conn.rollback()
            conn.close()
        return False
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        if conn:
            conn.close()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("🔧 Quiz Settings Fields Migration")
    print("=" * 60)
    
    success = run_migration()
    
    if success:
        print("\n" + "=" * 60)
        print("🎉 Migration completed successfully!")
        print("=" * 60)
        print("\n📝 Next steps:")
        print("   1. Restart the backend server")
        print("   2. Test quiz creation with new settings")
        print("   3. Test quiz updates with new settings")
    else:
        print("\n" + "=" * 60)
        print("❌ Migration failed!")
        print("=" * 60)
        print("\n📝 Troubleshooting:")
        print("   1. Check if the database file exists")
        print("   2. Ensure no other process is using the database")
        print("   3. Check file permissions")
