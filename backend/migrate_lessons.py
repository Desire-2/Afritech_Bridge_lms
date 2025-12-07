#!/usr/bin/env python3
"""
Migration script to add missing columns to lessons table.
"""
import sys
from sqlalchemy import text
from main import app, db

def run_migration():
    """Add all missing columns to lessons table"""
    with app.app_context():
        try:
            print("=" * 80)
            print("MIGRATING LESSONS TABLE")
            print("=" * 80)
            
            migrations = [
                ("lessons", "description", "TEXT"),
                ("lessons", "learning_objectives", "TEXT"),
                ("lessons", "duration_minutes", "INTEGER"),
                ("lessons", "is_published", "BOOLEAN DEFAULT FALSE"),
                ("lessons", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
                ("lessons", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
            ]
            
            for table_name, column_name, column_type in migrations:
                print(f"\n📋 Checking {table_name}.{column_name}...")
                
                # Check if column exists
                result = db.session.execute(text(f"""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name='{table_name}' AND column_name='{column_name}'
                """))
                
                if result.fetchone() is None:
                    print(f"   ➜ Adding {table_name}.{column_name}...")
                    try:
                        db.session.execute(text(f"""
                            ALTER TABLE {table_name} 
                            ADD COLUMN {column_name} {column_type}
                        """))
                        db.session.commit()
                        print(f"   ✅ Added {table_name}.{column_name}")
                    except Exception as e:
                        print(f"   ⚠️  Error adding column: {str(e)}")
                        db.session.rollback()
                else:
                    print(f"   ✓ Column already exists")
            
            print("\n" + "=" * 80)
            print("✅ MIGRATION COMPLETED")
            print("=" * 80)
            
            return True
            
        except Exception as e:
            print(f"\n❌ Migration failed: {str(e)}")
            db.session.rollback()
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
