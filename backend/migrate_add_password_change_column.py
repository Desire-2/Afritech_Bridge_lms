#!/usr/bin/env python3
"""
Migration script to add must_change_password column to users table
This field enforces password change for users created through application approval
"""

from main import app, db
from sqlalchemy import text

def migrate():
    with app.app_context():
        try:
            # Add must_change_password column
            with db.engine.connect() as conn:
                # Check if column exists first
                result = conn.execute(text("""
                    SELECT COUNT(*) 
                    FROM pragma_table_info('users') 
                    WHERE name='must_change_password'
                """))
                
                if result.scalar() == 0:
                    print("Adding must_change_password column to users table...")
                    conn.execute(text("""
                        ALTER TABLE users 
                        ADD COLUMN must_change_password BOOLEAN DEFAULT 0 NOT NULL
                    """))
                    conn.commit()
                    print("✅ Successfully added must_change_password column")
                else:
                    print("ℹ️  Column must_change_password already exists")
            
            print("\n📊 Current users table schema:")
            with db.engine.connect() as conn:
                result = conn.execute(text("PRAGMA table_info(users)"))
                for row in result:
                    print(f"  - {row[1]} ({row[2]})")
            
            print("\n✅ Migration completed successfully!")
            
        except Exception as e:
            print(f"❌ Migration failed: {str(e)}")
            raise

if __name__ == "__main__":
    migrate()
