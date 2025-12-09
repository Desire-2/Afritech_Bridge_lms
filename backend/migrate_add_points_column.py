#!/usr/bin/env python3
"""
Migration script to add missing 'points' and 'explanation' columns to questions table
"""
import os
import sys
from sqlalchemy import text

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from src.models.user_models import db
from main import app

def migrate_add_points_column():
    """Add points and explanation columns to questions table if they don't exist"""
    with app.app_context():
        try:
            # Check if points column exists
            result = db.session.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='questions' AND column_name='points'
            """))
            
            if result.fetchone() is None:
                print("Adding 'points' column to questions table...")
                
                # Add the points column with default value
                db.session.execute(text("""
                    ALTER TABLE questions 
                    ADD COLUMN points FLOAT DEFAULT 10.0
                """))
                
                db.session.commit()
                print("✓ Successfully added 'points' column to questions table")
            else:
                print("✓ Column 'points' already exists in questions table")
            
            # Check if explanation column exists
            result = db.session.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='questions' AND column_name='explanation'
            """))
            
            if result.fetchone() is None:
                print("Adding 'explanation' column to questions table...")
                
                # Add the explanation column
                db.session.execute(text("""
                    ALTER TABLE questions 
                    ADD COLUMN explanation TEXT
                """))
                
                db.session.commit()
                print("✓ Successfully added 'explanation' column to questions table")
            else:
                print("✓ Column 'explanation' already exists in questions table")
                
        except Exception as e:
            db.session.rollback()
            print(f"✗ Error during migration: {e}")
            raise

if __name__ == "__main__":
    print("=" * 80)
    print("DATABASE MIGRATION: Add 'points' and 'explanation' columns to questions table")
    print("=" * 80)
    migrate_add_points_column()
    print("=" * 80)
    print("Migration completed successfully!")
    print("=" * 80)
