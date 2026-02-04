#!/usr/bin/env python3
"""
Migration script to add missing resubmission fields to assignments table in PostgreSQL.
"""

import os
import sys
import psycopg2
from urllib.parse import urlparse

def get_db_connection():
    """Get PostgreSQL connection using DATABASE_URL from environment"""
    
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL environment variable not set")
    
    # Parse the URL
    parsed = urlparse(database_url)
    
    # Create connection
    connection = psycopg2.connect(
        host=parsed.hostname,
        database=parsed.path[1:],  # Remove leading slash
        user=parsed.username,
        password=parsed.password,
        port=parsed.port
    )
    
    return connection

def check_and_add_resubmission_fields():
    """Check if resubmission fields exist in assignments table and add them if missing"""
    
    print("🔄 Checking assignments table for missing resubmission fields...")
    
    try:
        # Get database connection
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check which columns exist
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'assignments' 
            AND table_schema = 'public'
        """)
        
        existing_columns = [row[0] for row in cursor.fetchall()]
        
        # Check for missing columns
        required_fields = ['can_resubmit', 'max_resubmissions', 'resubmission_count']
        missing_columns = [field for field in required_fields if field not in existing_columns]
        
        if not missing_columns:
            print("✅ All resubmission fields already exist in assignments table.")
            cursor.close()
            conn.close()
            return True
        
        print(f"⚠️ Missing columns found: {missing_columns}")
        print("🔄 Adding missing columns to assignments table...")
        
        # Add missing columns
        try:
            for field in missing_columns:
                if field == 'can_resubmit':
                    cursor.execute("ALTER TABLE assignments ADD COLUMN can_resubmit BOOLEAN DEFAULT FALSE NOT NULL")
                    print("✅ Added can_resubmit column")
                elif field == 'max_resubmissions':
                    cursor.execute("ALTER TABLE assignments ADD COLUMN max_resubmissions INTEGER DEFAULT 3 NOT NULL")
                    print("✅ Added max_resubmissions column")
                elif field == 'resubmission_count':
                    cursor.execute("ALTER TABLE assignments ADD COLUMN resubmission_count INTEGER DEFAULT 0 NOT NULL")
                    print("✅ Added resubmission_count column")
            
            conn.commit()
            print("🎉 All missing columns added successfully!")
            
        except Exception as e:
            conn.rollback()
            print(f"❌ Error adding columns: {str(e)}")
            raise e
        finally:
            cursor.close()
            conn.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        return False

def main():
    """Main migration function"""
    print("🚀 Starting PostgreSQL migration to add assignment resubmission fields...")
    
    # Load environment variables
    try:
        from dotenv import load_dotenv
        load_dotenv()
        
        success = check_and_add_resubmission_fields()
        
        if success:
            print("✨ Migration completed successfully!")
            print("🔄 Restarting the server should now resolve the error.")
            return True
        else:
            print("❌ Migration failed! Please check the error messages above.")
            return False
            
    except Exception as e:
        print(f"❌ Migration setup failed: {str(e)}")
        return False

if __name__ == "__main__":
    main()