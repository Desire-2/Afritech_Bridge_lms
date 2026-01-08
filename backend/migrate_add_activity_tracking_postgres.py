#!/usr/bin/env python3
"""
Migration script to add activity and termination tracking fields for PostgreSQL
Adds to users table: last_login, last_activity, deleted_at, deleted_by, deletion_reason
Adds to enrollments table: status, terminated_at, termination_reason, terminated_by
"""

import os
import sys
import psycopg2
from urllib.parse import urlparse
from datetime import datetime

# Add current directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def get_database_url():
    """Get the database URL from environment"""
    from dotenv import load_dotenv
    
    # Load environment variables
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    load_dotenv(env_path)
    
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL not found in environment variables")
        sys.exit(1)
    
    # Transform postgres:// to postgresql:// if needed
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    
    return database_url

def check_column_exists(cursor, table_name, column_name):
    """Check if a column exists in a table"""
    cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = %s AND column_name = %s
    """, (table_name, column_name))
    return cursor.fetchone() is not None

def check_table_exists(cursor, table_name):
    """Check if a table exists"""
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = %s AND table_schema = 'public'
    """, (table_name,))
    return cursor.fetchone() is not None

def migrate_users_table(cursor, conn):
    """Add activity tracking fields to users table"""
    print("📊 Migrating users table...")
    
    # Check if users table exists
    if not check_table_exists(cursor, 'users'):
        print("❌ Users table not found!")
        return False
    
    migrations_applied = 0
    
    # Add last_login column
    if not check_column_exists(cursor, 'users', 'last_login'):
        print("  ➕ Adding last_login column...")
        cursor.execute("ALTER TABLE users ADD COLUMN last_login TIMESTAMP")
        migrations_applied += 1
        print("     ✅ last_login column added")
    else:
        print("     ℹ️  last_login column already exists")
    
    # Add last_activity column
    if not check_column_exists(cursor, 'users', 'last_activity'):
        print("  ➕ Adding last_activity column...")
        cursor.execute("ALTER TABLE users ADD COLUMN last_activity TIMESTAMP")
        migrations_applied += 1
        print("     ✅ last_activity column added")
    else:
        print("     ℹ️  last_activity column already exists")
    
    # Add deleted_at column
    if not check_column_exists(cursor, 'users', 'deleted_at'):
        print("  ➕ Adding deleted_at column...")
        cursor.execute("ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP")
        migrations_applied += 1
        print("     ✅ deleted_at column added")
    else:
        print("     ℹ️  deleted_at column already exists")
    
    # Add deleted_by column
    if not check_column_exists(cursor, 'users', 'deleted_by'):
        print("  ➕ Adding deleted_by column...")
        cursor.execute("ALTER TABLE users ADD COLUMN deleted_by INTEGER REFERENCES users(id)")
        migrations_applied += 1
        print("     ✅ deleted_by column added")
    else:
        print("     ℹ️  deleted_by column already exists")
    
    # Add deletion_reason column
    if not check_column_exists(cursor, 'users', 'deletion_reason'):
        print("  ➕ Adding deletion_reason column...")
        cursor.execute("ALTER TABLE users ADD COLUMN deletion_reason TEXT")
        migrations_applied += 1
        print("     ✅ deletion_reason column added")
    else:
        print("     ℹ️  deletion_reason column already exists")
    
    if migrations_applied > 0:
        conn.commit()
        print(f"  ✅ Users table migration completed ({migrations_applied} columns added)")
    else:
        print("  ✅ Users table already up to date")
    
    return True

def migrate_enrollments_table(cursor, conn):
    """Add termination tracking fields to enrollments table"""
    print("📊 Migrating enrollments table...")
    
    # Check if enrollments table exists
    if not check_table_exists(cursor, 'enrollments'):
        print("❌ Enrollments table not found!")
        return False
    
    migrations_applied = 0
    
    # Add status column (if not exists)
    if not check_column_exists(cursor, 'enrollments', 'status'):
        print("  ➕ Adding status column...")
        cursor.execute("ALTER TABLE enrollments ADD COLUMN status VARCHAR(20) DEFAULT 'active'")
        # Update existing records to 'active' status
        cursor.execute("UPDATE enrollments SET status = 'active' WHERE status IS NULL")
        migrations_applied += 1
        print("     ✅ status column added and set to 'active' for existing records")
    else:
        print("     ℹ️  status column already exists")
    
    # Add terminated_at column
    if not check_column_exists(cursor, 'enrollments', 'terminated_at'):
        print("  ➕ Adding terminated_at column...")
        cursor.execute("ALTER TABLE enrollments ADD COLUMN terminated_at TIMESTAMP")
        migrations_applied += 1
        print("     ✅ terminated_at column added")
    else:
        print("     ℹ️  terminated_at column already exists")
    
    # Add termination_reason column
    if not check_column_exists(cursor, 'enrollments', 'termination_reason'):
        print("  ➕ Adding termination_reason column...")
        cursor.execute("ALTER TABLE enrollments ADD COLUMN termination_reason TEXT")
        migrations_applied += 1
        print("     ✅ termination_reason column added")
    else:
        print("     ℹ️  termination_reason column already exists")
    
    # Add terminated_by column
    if not check_column_exists(cursor, 'enrollments', 'terminated_by'):
        print("  ➕ Adding terminated_by column...")
        cursor.execute("ALTER TABLE enrollments ADD COLUMN terminated_by INTEGER REFERENCES users(id)")
        migrations_applied += 1
        print("     ✅ terminated_by column added")
    else:
        print("     ℹ️  terminated_by column already exists")
    
    if migrations_applied > 0:
        conn.commit()
        print(f"  ✅ Enrollments table migration completed ({migrations_applied} columns added)")
    else:
        print("  ✅ Enrollments table already up to date")
    
    return True

def main():
    """Run the migration"""
    print("🚀 Starting Activity Tracking Migration for PostgreSQL")
    print("=" * 60)
    
    try:
        # Get database URL
        database_url = get_database_url()
        print(f"📊 Database URL: {database_url[:50]}...")
        
        # Parse connection parameters
        parsed_url = urlparse(database_url)
        
        # Connect to database
        print("🔗 Connecting to database...")
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        print("  ✅ Connected successfully")
        
        # Check database connection
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"  📊 PostgreSQL version: {version[0]}")
        
        # Run migrations
        success = True
        
        # Migrate users table
        if not migrate_users_table(cursor, conn):
            success = False
        
        # Migrate enrollments table
        if not migrate_enrollments_table(cursor, conn):
            success = False
        
        if success:
            print("\n" + "=" * 60)
            print("🎉 Migration completed successfully!")
            print("   All activity and termination tracking fields are now available")
            print("   You can now restart your Flask application")
        else:
            print("\n" + "=" * 60)
            print("❌ Migration completed with errors")
            print("   Please check the errors above and resolve them")
        
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)
    finally:
        if 'conn' in locals():
            cursor.close()
            conn.close()
            print("🔒 Database connection closed")

if __name__ == "__main__":
    main()