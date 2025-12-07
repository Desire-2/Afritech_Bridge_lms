#!/usr/bin/env python3
"""
Comprehensive migration script to sync database schema with models.
"""
import sys
from sqlalchemy import text
from main import app, db

def run_comprehensive_migration():
    """Add all missing columns to the database"""
    with app.app_context():
        try:
            print("=" * 80)
            print("COMPREHENSIVE DATABASE MIGRATION")
            print("=" * 80)
            
            migrations = [
                # Modules table
                ("modules", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
                ("modules", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
                ("modules", "is_published", "BOOLEAN DEFAULT FALSE"),
                
                # Quizzes table
                ("quizzes", "time_limit", "INTEGER"),
                ("quizzes", "max_attempts", "INTEGER"),
                ("quizzes", "passing_score", "INTEGER DEFAULT 70"),
                ("quizzes", "due_date", "TIMESTAMP"),
                ("quizzes", "points_possible", "FLOAT DEFAULT 100.0"),
                ("quizzes", "shuffle_questions", "BOOLEAN DEFAULT FALSE"),
                ("quizzes", "shuffle_answers", "BOOLEAN DEFAULT FALSE"),
                ("quizzes", "show_correct_answers", "BOOLEAN DEFAULT TRUE"),
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
                    db.session.execute(text(f"""
                        ALTER TABLE {table_name} 
                        ADD COLUMN {column_name} {column_type}
                    """))
                    db.session.commit()
                    print(f"   ✅ Added {table_name}.{column_name}")
                else:
                    print(f"   ✓ Column already exists")
            
            print("\n" + "=" * 80)
            print("✅ COMPREHENSIVE MIGRATION COMPLETED SUCCESSFULLY")
            print("=" * 80)
            
            return True
            
        except Exception as e:
            print(f"\n❌ Migration failed: {str(e)}")
            db.session.rollback()
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    success = run_comprehensive_migration()
    sys.exit(0 if success else 1)
