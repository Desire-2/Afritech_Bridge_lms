#!/usr/bin/env python3
"""
Fix Course Schema Migration Script
This script adds missing columns to the courses table to match the Course model definition.
"""

from main import app
from src.models.user_models import db
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_course_schema():
    """Add missing columns to courses table"""
    with app.app_context():
        try:
            # Check which columns exist
            result = db.session.execute(db.text('PRAGMA table_info(courses);'))
            existing_columns = {col[1] for col in result.fetchall()}
            logger.info(f"Existing columns: {existing_columns}")
            
            # Define required columns with their SQL definitions
            required_columns = {
                'enrollment_type': "VARCHAR(20) DEFAULT 'free'",
                'price': "FLOAT DEFAULT 0.0",
                'currency': "VARCHAR(10) DEFAULT 'USD'",
                'scholarship_available': "BOOLEAN DEFAULT 0",
                'max_scholarship_spots': "INTEGER DEFAULT 0",
                'current_scholarship_spots': "INTEGER DEFAULT 0",
                'prerequisites': "TEXT",
                'difficulty_level': "VARCHAR(20) DEFAULT 'beginner'",
                'strict_progression': "BOOLEAN DEFAULT 1",
                'passing_score': "FLOAT DEFAULT 80.0",
                'max_attempts_per_module': "INTEGER DEFAULT 3"
            }
            
            # Add missing columns
            for column_name, column_def in required_columns.items():
                if column_name not in existing_columns:
                    sql = f"ALTER TABLE courses ADD COLUMN {column_name} {column_def}"
                    logger.info(f"Adding column: {sql}")
                    db.session.execute(db.text(sql))
                    db.session.commit()
                    logger.info(f"Successfully added column: {column_name}")
                else:
                    logger.info(f"Column {column_name} already exists")
            
            logger.info("Course schema migration completed successfully!")
            
            # Verify all columns exist
            result = db.session.execute(db.text('PRAGMA table_info(courses);'))
            final_columns = {col[1] for col in result.fetchall()}
            logger.info(f"Final columns: {final_columns}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error during schema migration: {e}")
            db.session.rollback()
            return False

if __name__ == "__main__":
    success = fix_course_schema()
    if success:
        print("✅ Course schema migration completed successfully!")
    else:
        print("❌ Course schema migration failed!")