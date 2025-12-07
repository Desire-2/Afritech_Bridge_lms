#!/usr/bin/env python3
"""
Migration script to add missing columns to PostgreSQL database.
Adds:
- modules.learning_objectives
- quizzes.is_published
"""
import sys
from sqlalchemy import text
from main import app, db

def run_migration():
    """Add missing columns to the database"""
    with app.app_context():
        try:
            print("=" * 80)
            print("ADDING MISSING DATABASE COLUMNS")
            print("=" * 80)
            
            # Check and add modules.learning_objectives
            print("\n1. Checking modules.learning_objectives...")
            result = db.session.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='modules' AND column_name='learning_objectives'
            """))
            
            if result.fetchone() is None:
                print("   ➜ Adding modules.learning_objectives column...")
                db.session.execute(text("""
                    ALTER TABLE modules 
                    ADD COLUMN learning_objectives TEXT
                """))
                db.session.commit()
                print("   ✅ Added modules.learning_objectives")
            else:
                print("   ✓ Column already exists")
            
            # Check and add quizzes.is_published
            print("\n2. Checking quizzes.is_published...")
            result = db.session.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='quizzes' AND column_name='is_published'
            """))
            
            if result.fetchone() is None:
                print("   ➜ Adding quizzes.is_published column...")
                db.session.execute(text("""
                    ALTER TABLE quizzes 
                    ADD COLUMN is_published BOOLEAN DEFAULT FALSE
                """))
                db.session.commit()
                print("   ✅ Added quizzes.is_published")
            else:
                print("   ✓ Column already exists")
            
            print("\n" + "=" * 80)
            print("✅ MIGRATION COMPLETED SUCCESSFULLY")
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
