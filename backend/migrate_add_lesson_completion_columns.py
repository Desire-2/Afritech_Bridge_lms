#!/usr/bin/env python3
"""
Migration script to add missing columns to lesson_completions table in PostgreSQL
This adds the enhanced progress tracking columns that were added to the model.
"""

import os
import sys
from sqlalchemy import create_engine, text, inspect
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def migrate_lesson_completions():
    """Add missing columns to lesson_completions table"""
    
    # Get database URL from environment
    database_url = os.getenv('SQLALCHEMY_DATABASE_URI') or os.getenv('DATABASE_URL')
    
    if not database_url:
        print("❌ No database URL found in environment variables")
        return False
    
    # Transform postgres:// to postgresql://
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql+psycopg2://', 1)
    elif database_url.startswith('postgresql://') and '+psycopg2' not in database_url:
        database_url = database_url.replace('postgresql://', 'postgresql+psycopg2://', 1)
    
    print(f"🔄 Connecting to database...")
    
    try:
        engine = create_engine(database_url)
        
        with engine.connect() as conn:
            # Check which columns exist
            inspector = inspect(engine)
            existing_columns = [col['name'] for col in inspector.get_columns('lesson_completions')]
            
            print(f"📋 Existing columns: {existing_columns}")
            
            # Define columns to add with their SQL definitions
            columns_to_add = {
                'completed': 'BOOLEAN DEFAULT FALSE',
                'reading_progress': 'FLOAT DEFAULT 0.0',
                'engagement_score': 'FLOAT DEFAULT 0.0',
                'scroll_progress': 'FLOAT DEFAULT 0.0',
                'updated_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                'last_accessed': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
            }
            
            # Add missing columns
            for column_name, column_def in columns_to_add.items():
                if column_name not in existing_columns:
                    print(f"➕ Adding column: {column_name}")
                    try:
                        sql = text(f"ALTER TABLE lesson_completions ADD COLUMN {column_name} {column_def}")
                        conn.execute(sql)
                        conn.commit()
                        print(f"✅ Added column: {column_name}")
                    except Exception as e:
                        print(f"⚠️  Error adding {column_name}: {e}")
                        conn.rollback()
                else:
                    print(f"✓ Column already exists: {column_name}")
            
            # Verify all columns now exist
            inspector = inspect(engine)
            final_columns = [col['name'] for col in inspector.get_columns('lesson_completions')]
            print(f"\n📋 Final columns: {final_columns}")
            
            # Update existing records to set completed=true where completed_at is not null
            print(f"\n🔄 Updating existing records...")
            try:
                sql = text("""
                    UPDATE lesson_completions 
                    SET completed = TRUE 
                    WHERE completed_at IS NOT NULL AND completed IS FALSE
                """)
                result = conn.execute(sql)
                conn.commit()
                print(f"✅ Updated {result.rowcount} existing records")
            except Exception as e:
                print(f"⚠️  Error updating records: {e}")
                conn.rollback()
            
        print("\n✅ Migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    print("=" * 80)
    print("LESSON COMPLETIONS TABLE MIGRATION")
    print("=" * 80)
    success = migrate_lesson_completions()
    sys.exit(0 if success else 1)
