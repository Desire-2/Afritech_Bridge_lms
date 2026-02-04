#!/usr/bin/env python3
"""
Migration Script: Make course_id nullable in student_forums table
This allows creating general forums that are not tied to a specific course
"""

import os
import sys
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_database_url():
    """Get the database URL from environment or use default"""
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        # Convert postgres:// to postgresql:// for SQLAlchemy 2.0 compatibility
        if database_url.startswith('postgres://'):
            database_url = database_url.replace('postgres://', 'postgresql+psycopg2://', 1)
        logger.info(f"Using database: {database_url.split('@')[0] if '@' in database_url else 'local'}@***")
        return database_url
    else:
        # Fallback to SQLite for local development
        db_path = os.path.join(os.path.dirname(__file__), 'instance', 'afritec_lms_db.db')
        database_url = f'sqlite:///{db_path}'
        logger.info(f"Using SQLite database: {db_path}")
        return database_url

def run_migration():
    """Make course_id nullable in student_forums table"""
    database_url = get_database_url()
    engine = create_engine(database_url)
    
    with engine.connect() as connection:
        try:
            # Check if this is PostgreSQL
            is_postgres = 'postgresql' in str(connection.engine.url)
            
            if is_postgres:
                # PostgreSQL: ALTER COLUMN to drop NOT NULL constraint
                logger.info("Checking current column constraint...")
                
                # Check if the column is currently NOT NULL
                result = connection.execute(text("""
                    SELECT is_nullable 
                    FROM information_schema.columns 
                    WHERE table_name = 'student_forums' AND column_name = 'course_id'
                """))
                row = result.fetchone()
                
                if row:
                    is_nullable = row[0]
                    logger.info(f"Current is_nullable value: {is_nullable}")
                    
                    if is_nullable == 'NO':
                        logger.info("Making course_id column nullable...")
                        connection.execute(text("""
                            ALTER TABLE student_forums 
                            ALTER COLUMN course_id DROP NOT NULL
                        """))
                        connection.commit()
                        logger.info("✅ Successfully made course_id nullable")
                    else:
                        logger.info("✅ course_id is already nullable, no changes needed")
                else:
                    logger.warning("Could not find course_id column in student_forums table")
            else:
                # SQLite: Column is already defined as nullable in the model
                # SQLite doesn't support ALTER COLUMN to change nullability easily
                logger.info("SQLite database detected - schema changes handled by SQLAlchemy model")
                logger.info("✅ No migration needed for SQLite")
                
        except SQLAlchemyError as e:
            logger.error(f"Migration failed: {e}")
            connection.rollback()
            raise
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            raise

if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Forum course_id Nullable Migration")
    logger.info("=" * 60)
    
    try:
        run_migration()
        logger.info("=" * 60)
        logger.info("Migration completed successfully!")
        logger.info("=" * 60)
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)
