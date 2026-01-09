#!/usr/bin/env python3
"""
Enhanced Lesson Score Storage Migration
Adds columns for storing component scores and lesson scores in lesson_completions table.
"""

import sys
import os

# Add the backend directory to the path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

from src.models.user_models import db
from src.models.student_models import LessonCompletion
from sqlalchemy import text
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_lesson_score_storage():
    """
    Add enhanced lesson score storage columns to lesson_completions table
    """
    try:
        # Check if we're using SQLite or PostgreSQL
        engine = db.engine
        dialect = engine.dialect.name
        
        logger.info(f"Running migration for {dialect} database...")
        
        # Add the new columns
        columns_to_add = [
            ('reading_component_score', 'FLOAT DEFAULT 0.0'),
            ('engagement_component_score', 'FLOAT DEFAULT 0.0'),
            ('quiz_component_score', 'FLOAT DEFAULT 0.0'),
            ('assignment_component_score', 'FLOAT DEFAULT 0.0'),
            ('lesson_score', 'FLOAT DEFAULT 0.0'),
            ('score_last_updated', 'TIMESTAMP')
        ]
        
        for column_name, column_type in columns_to_add:
            try:
                # Check if column already exists
                if dialect == 'postgresql':
                    check_query = text(f"""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name='lesson_completions' AND column_name='{column_name}';
                    """)
                else:  # SQLite
                    check_query = text(f"PRAGMA table_info(lesson_completions);")
                
                result = db.session.execute(check_query)
                
                if dialect == 'postgresql':
                    exists = result.fetchone() is not None
                else:  # SQLite
                    columns = [row[1] for row in result.fetchall()]
                    exists = column_name in columns
                
                if not exists:
                    # Add the column
                    if dialect == 'postgresql':
                        alter_query = text(f"ALTER TABLE lesson_completions ADD COLUMN {column_name} {column_type};")
                    else:  # SQLite
                        alter_query = text(f"ALTER TABLE lesson_completions ADD COLUMN {column_name} {column_type};")
                    
                    db.session.execute(alter_query)
                    db.session.commit()
                    logger.info(f"✅ Added column {column_name} to lesson_completions table")
                else:
                    logger.info(f"⏭️ Column {column_name} already exists, skipping...")
                    
            except Exception as e:
                logger.error(f"❌ Error adding column {column_name}: {str(e)}")
                
        # Commit the changes
        db.session.commit()
        logger.info("🎉 Migration completed successfully!")
        
        # Calculate and store scores for existing lesson completions
        logger.info("🔄 Calculating scores for existing lesson completions...")
        
        existing_completions = LessonCompletion.query.filter(
            LessonCompletion.score_last_updated.is_(None)
        ).all()
        
        logger.info(f"📊 Found {len(existing_completions)} lesson completions to update")
        
        updated_count = 0
        for completion in existing_completions:
            try:
                # Calculate and store component scores
                completion.calculate_and_store_component_scores()
                updated_count += 1
                
                if updated_count % 50 == 0:
                    logger.info(f"🔄 Updated {updated_count}/{len(existing_completions)} lesson completions...")
                    
            except Exception as e:
                logger.error(f"❌ Error updating lesson completion {completion.id}: {str(e)}")
                
        logger.info(f"✅ Successfully updated {updated_count} lesson completions with component scores")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {str(e)}")
        db.session.rollback()
        return False

if __name__ == "__main__":
    # Import Flask app to get the application context
    from main import app
    
    with app.app_context():
        logger.info("🚀 Starting Enhanced Lesson Score Storage Migration...")
        success = migrate_lesson_score_storage()
        
        if success:
            logger.info("🎉 Migration completed successfully!")
            sys.exit(0)
        else:
            logger.error("❌ Migration failed!")
            sys.exit(1)