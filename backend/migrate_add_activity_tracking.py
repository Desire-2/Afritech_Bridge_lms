#!/usr/bin/env python3
"""
Migration script to add activity and termination tracking fields
Adds to users table: last_login, last_activity, deleted_at, deleted_by, deletion_reason
Adds to enrollments table: status, terminated_at, termination_reason, terminated_by
"""

import sqlite3
import os
from datetime import datetime

def migrate_add_tracking_fields():
    """Add activity and termination tracking fields to users and enrollments tables"""
    
    # Get database path
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(backend_dir, 'instance', 'afritec_lms_db.db')
    
    print(f"🔍 Looking for database at: {db_path}")
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at {db_path}")
        print("   Please run the Flask app first to create the database")
        return False
    
    try:
        print("🚀 Starting activity and termination tracking fields migration...")
        
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("📊 Checking current users table structure...")
        
        # Check current table structure
        cursor.execute("PRAGMA table_info(users)")
        columns = cursor.fetchall()
        existing_columns = [col[1] for col in columns]
        
        print(f"   Current columns: {', '.join(existing_columns)}")
        
        # Check if fields already exist
        needs_last_login = 'last_login' not in existing_columns
        needs_last_activity = 'last_activity' not in existing_columns
        needs_deleted_at = 'deleted_at' not in existing_columns
        needs_deleted_by = 'deleted_by' not in existing_columns
        needs_deletion_reason = 'deletion_reason' not in existing_columns
        
        if not (needs_last_login or needs_last_activity or needs_deleted_at or needs_deleted_by or needs_deletion_reason):
            print("✅ All tracking fields already exist in users table!")
        
        # Check enrollments table
        print("📊 Checking enrollments table structure...")
        cursor.execute("PRAGMA table_info(enrollments)")
        enrollment_columns = cursor.fetchall()
        enrollment_existing_columns = [col[1] for col in enrollment_columns]
        
        needs_enrollment_status = 'status' not in enrollment_existing_columns
        needs_terminated_at = 'terminated_at' not in enrollment_existing_columns
        needs_termination_reason = 'termination_reason' not in enrollment_existing_columns
        needs_terminated_by = 'terminated_by' not in enrollment_existing_columns
        
        if not (needs_enrollment_status or needs_terminated_at or needs_termination_reason or needs_terminated_by):
            print("✅ All tracking fields already exist in enrollments table!")
        
        if not any([needs_last_login, needs_last_activity, needs_deleted_at, needs_deleted_by, 
                   needs_deletion_reason, needs_enrollment_status, needs_terminated_at, 
                   needs_termination_reason, needs_terminated_by]):
            conn.close()
            return True
        
        print("📝 Adding tracking fields to users table...")
        
        # Add last_login field
        if needs_last_login:
            cursor.execute("ALTER TABLE users ADD COLUMN last_login DATETIME")
            print("   ✅ last_login column added")
        else:
            print("   ℹ️  last_login column already exists")
        
        # Add last_activity field
        if needs_last_activity:
            cursor.execute("ALTER TABLE users ADD COLUMN last_activity DATETIME")
            print("   ✅ last_activity column added")
        else:
            print("   ℹ️  last_activity column already exists")
        
        # Add deleted_at field
        if needs_deleted_at:
            cursor.execute("ALTER TABLE users ADD COLUMN deleted_at DATETIME")
            print("   ✅ deleted_at column added")
        else:
            print("   ℹ️  deleted_at column already exists")
            
        # Add deleted_by field
        if needs_deleted_by:
            cursor.execute("ALTER TABLE users ADD COLUMN deleted_by INTEGER")
            print("   ✅ deleted_by column added")
        else:
            print("   ℹ️  deleted_by column already exists")
            
        # Add deletion_reason field
        if needs_deletion_reason:
            cursor.execute("ALTER TABLE users ADD COLUMN deletion_reason VARCHAR(255)")
            print("   ✅ deletion_reason column added")
        else:
            print("   ℹ️  deletion_reason column already exists")
        
        print("📝 Adding tracking fields to enrollments table...")
        
        # Add status field
        if needs_enrollment_status:
            cursor.execute("ALTER TABLE enrollments ADD COLUMN status VARCHAR(20) DEFAULT 'active'")
            print("   ✅ status column added")
        else:
            print("   ℹ️  status column already exists")
        
        # Add terminated_at field
        if needs_terminated_at:
            cursor.execute("ALTER TABLE enrollments ADD COLUMN terminated_at DATETIME")
            print("   ✅ terminated_at column added")
        else:
            print("   ℹ️  terminated_at column already exists")
            
        # Add termination_reason field
        if needs_termination_reason:
            cursor.execute("ALTER TABLE enrollments ADD COLUMN termination_reason VARCHAR(255)")
            print("   ✅ termination_reason column added")
        else:
            print("   ℹ️  termination_reason column already exists")
            
        # Add terminated_by field
        if needs_terminated_by:
            cursor.execute("ALTER TABLE enrollments ADD COLUMN terminated_by INTEGER")
            print("   ✅ terminated_by column added")
        else:
            print("   ℹ️  terminated_by column already exists")
        
        # Set initial values for existing users (last_activity = created_at)
        if needs_last_activity:
            cursor.execute("""
                UPDATE users 
                SET last_activity = created_at 
                WHERE last_activity IS NULL
            """)
            print("   ✅ Set last_activity = created_at for existing users")
        
        # Set initial status for existing enrollments
        if needs_enrollment_status:
            cursor.execute("""
                UPDATE enrollments 
                SET status = CASE 
                    WHEN completed_at IS NOT NULL THEN 'completed'
                    ELSE 'active'
                END
                WHERE status IS NULL
            """)
            print("   ✅ Set initial status for existing enrollments")
        
        # Commit changes
        conn.commit()
        print("\n✅ All tracking fields migration completed successfully!")
        
        # Verify changes
        print("\n🔍 Verifying changes...")
        
        # Check users table
        cursor.execute("PRAGMA table_info(users)")
        columns = cursor.fetchall()
        
        tracking_fields = ['last_login', 'last_activity', 'deleted_at', 'deleted_by', 'deletion_reason']
        found_fields = []
        
        for col in columns:
            if col[1] in tracking_fields:
                found_fields.append(col[1])
                print(f"   ✅ users.{col[1]}: {col[2]} (nullable)")
        
        # Check enrollments table
        cursor.execute("PRAGMA table_info(enrollments)")
        enrollment_columns = cursor.fetchall()
        
        enrollment_fields = ['status', 'terminated_at', 'termination_reason', 'terminated_by']
        found_enrollment_fields = []
        
        for col in enrollment_columns:
            if col[1] in enrollment_fields:
                found_enrollment_fields.append(col[1])
                print(f"   ✅ enrollments.{col[1]}: {col[2]} (nullable)")
        
        if len(found_fields) == len(tracking_fields) and len(found_enrollment_fields) == len(enrollment_fields):
            print("✅ All tracking fields verified successfully!")
        else:
            print("❌ Some tracking fields are missing!")
            return False
        
        # Show sample data
        cursor.execute("""
            SELECT id, username, last_login, last_activity, created_at 
            FROM users 
            LIMIT 3
        """)
        users = cursor.fetchall()
        
        print(f"\n📋 Sample user data (first 3 users):")
        for user in users:
            print(f"   User {user[1]}: last_login={user[2]}, last_activity={user[3]}")
        
        cursor.execute("""
            SELECT id, student_id, course_id, status, terminated_at
            FROM enrollments 
            LIMIT 3
        """)
        enrollments = cursor.fetchall()
        
        print(f"\n📋 Sample enrollment data (first 3 enrollments):")
        for enrollment in enrollments:
            print(f"   Enrollment {enrollment[0]}: student={enrollment[1]}, status={enrollment[3]}, terminated_at={enrollment[4]}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return False

if __name__ == "__main__":
    success = migrate_add_tracking_fields()
    if success:
        print("\n🎉 Migration completed successfully! Restart your Flask app to use the new fields.")
    else:
        print("\n💥 Migration failed! Please check the errors above.")
        exit(1)