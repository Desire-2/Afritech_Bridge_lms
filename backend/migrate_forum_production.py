#!/usr/bin/env python3
"""
Comprehensive Forum Migration Script for Production Deployment
Ensures all forum-related tables and fields are properly created/updated
"""

import os
import sys
import logging
from datetime import datetime
from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String, DateTime, Boolean, Text, ForeignKey, text
from sqlalchemy.exc import SQLAlchemyError

# Add src to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '.'))

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
        logger.info(f"Using production database: {database_url.split('@')[0]}@***")
        return database_url
    else:
        logger.error("No DATABASE_URL found in environment. Please set DATABASE_URL for production migration.")
        raise ValueError("DATABASE_URL environment variable is required for production migration")
        # Fallback to SQLite for local development (commented out for production)
        # db_path = os.path.join(os.path.dirname(__file__), 'instance', 'afritec_lms_db.db')
        # database_url = f'sqlite:///{db_path}'
        # logger.info(f"Using SQLite database: {db_path}")
        # return database_url

def column_exists(connection, table_name, column_name):
    """Check if a column exists in a table"""
    try:
        if 'sqlite' in str(connection.engine.url):
            # SQLite
            result = connection.execute(text(f"PRAGMA table_info({table_name})"))
            columns = [row[1] for row in result]
        else:
            # PostgreSQL
            result = connection.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = :table_name
            """), {'table_name': table_name})
            columns = [row[0] for row in result]
        
        return column_name in columns
    except Exception as e:
        logger.warning(f"Error checking column {column_name} in {table_name}: {e}")
        return False

def table_exists(connection, table_name):
    """Check if a table exists"""
    try:
        if 'sqlite' in str(connection.engine.url):
            result = connection.execute(text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name = :table_name
            """), {'table_name': table_name})
        else:
            result = connection.execute(text("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_name = :table_name
            """), {'table_name': table_name})
        
        return result.fetchone() is not None
    except Exception as e:
        logger.warning(f"Error checking table {table_name}: {e}")
        return False

def add_column_if_not_exists(connection, table_name, column_definition):
    """Add a column if it doesn't exist"""
    column_name = column_definition.split()[0]
    
    if column_exists(connection, table_name, column_name):
        logger.info(f"✓ Column {table_name}.{column_name} already exists")
        return True
    
    try:
        sql = f"ALTER TABLE {table_name} ADD COLUMN {column_definition}"
        connection.execute(text(sql))
        connection.commit()
        logger.info(f"✅ Added column {table_name}.{column_name}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to add column {table_name}.{column_name}: {e}")
        return False

def create_table_if_not_exists(connection, table_name, table_sql):
    """Create a table if it doesn't exist"""
    if table_exists(connection, table_name):
        logger.info(f"✓ Table {table_name} already exists")
        return True
    
    try:
        connection.execute(text(table_sql))
        connection.commit()
        logger.info(f"✅ Created table {table_name}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to create table {table_name}: {e}")
        return False

def run_migration():
    """Run the comprehensive forum migration"""
    logger.info("🚀 Starting Forum Migration for Production Deployment")
    
    try:
        # Connect to database
        database_url = get_database_url()
        engine = create_engine(database_url)
        
        logger.info("📊 Connected to database successfully")
        
        with engine.connect() as connection:
            # Determine database type for appropriate SQL syntax
            is_postgres = 'postgresql' in str(engine.url)
            is_sqlite = 'sqlite' in str(engine.url)
            
            # Define column types based on database
            if is_postgres:
                INTEGER_TYPE = "INTEGER"
                BOOLEAN_TYPE = "BOOLEAN DEFAULT FALSE"
                TEXT_TYPE = "TEXT"
                DATETIME_TYPE = "TIMESTAMP"
                VARCHAR_TYPE = lambda length: f"VARCHAR({length})"
            else:  # SQLite
                INTEGER_TYPE = "INTEGER"
                BOOLEAN_TYPE = "BOOLEAN DEFAULT 0"
                TEXT_TYPE = "TEXT"
                DATETIME_TYPE = "DATETIME"
                VARCHAR_TYPE = lambda length: f"VARCHAR({length})"
            
            success_count = 0
            total_operations = 0
            
            # ============= CREATE FORUM TABLES =============
            
            # 1. Create forum_subscriptions table
            forum_subscriptions_sql = f"""
            CREATE TABLE forum_subscriptions (
                id {INTEGER_TYPE} PRIMARY KEY {'AUTOINCREMENT' if is_sqlite else ''},
                user_id {INTEGER_TYPE} NOT NULL,
                forum_id {INTEGER_TYPE} NOT NULL,
                subscribed_at {DATETIME_TYPE} DEFAULT {'CURRENT_TIMESTAMP' if is_sqlite else 'NOW()'},
                is_active {BOOLEAN_TYPE},
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (forum_id) REFERENCES student_forums (id)
            )
            """
            
            # 2. Create forum_post_likes table  
            forum_post_likes_sql = f"""
            CREATE TABLE forum_post_likes (
                id {INTEGER_TYPE} PRIMARY KEY {'AUTOINCREMENT' if is_sqlite else ''},
                user_id {INTEGER_TYPE} NOT NULL,
                post_id {INTEGER_TYPE} NOT NULL,
                is_like {BOOLEAN_TYPE},
                created_at {DATETIME_TYPE} DEFAULT {'CURRENT_TIMESTAMP' if is_sqlite else 'NOW()'},
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (post_id) REFERENCES forum_posts (id),
                UNIQUE(user_id, post_id)
            )
            """
            
            # Create tables
            tables_to_create = [
                ("forum_subscriptions", forum_subscriptions_sql),
                ("forum_post_likes", forum_post_likes_sql)
            ]
            
            for table_name, sql in tables_to_create:
                total_operations += 1
                if create_table_if_not_exists(connection, table_name, sql):
                    success_count += 1
            
            # ============= UPDATE STUDENT_FORUMS TABLE =============
            
            student_forums_columns = [
                f"category {VARCHAR_TYPE(100)} DEFAULT 'General'",
                f"is_pinned {BOOLEAN_TYPE}",
                f"is_locked {BOOLEAN_TYPE}",
                f"view_count {INTEGER_TYPE} DEFAULT 0",
                f"allow_anonymous {BOOLEAN_TYPE}",
                f"moderated {BOOLEAN_TYPE}",
                f"post_count {INTEGER_TYPE} DEFAULT 0",
                f"thread_count {INTEGER_TYPE} DEFAULT 0",
                f"subscriber_count {INTEGER_TYPE} DEFAULT 0",
                f"last_post_id {INTEGER_TYPE}",
                f"last_post_at {DATETIME_TYPE}",
            ]
            
            logger.info("📝 Updating student_forums table...")
            for column_def in student_forums_columns:
                total_operations += 1
                if add_column_if_not_exists(connection, "student_forums", column_def):
                    success_count += 1
            
            # ============= UPDATE FORUM_POSTS TABLE =============
            
            forum_posts_columns = [
                f"is_pinned {BOOLEAN_TYPE}",
                f"is_locked {BOOLEAN_TYPE}",
                f"is_approved {BOOLEAN_TYPE}",
                f"is_edited {BOOLEAN_TYPE}",
                f"like_count {INTEGER_TYPE} DEFAULT 0",
                f"dislike_count {INTEGER_TYPE} DEFAULT 0",
                f"view_count {INTEGER_TYPE} DEFAULT 0",
                f"is_flagged {BOOLEAN_TYPE}",
                f"flag_reason {TEXT_TYPE}",
                f"moderated_by {INTEGER_TYPE}",
                f"moderated_at {DATETIME_TYPE}",
                f"reply_count {INTEGER_TYPE} DEFAULT 0",
                f"edit_count {INTEGER_TYPE} DEFAULT 0",
                f"last_edited_at {DATETIME_TYPE}",
                f"last_edited_by {INTEGER_TYPE}",
            ]
            
            logger.info("📝 Updating forum_posts table...")
            for column_def in forum_posts_columns:
                total_operations += 1
                if add_column_if_not_exists(connection, "forum_posts", column_def):
                    success_count += 1
            
            # ============= CREATE INDEXES FOR PERFORMANCE =============
            
            indexes = [
                "CREATE INDEX IF NOT EXISTS idx_forum_posts_forum_id ON forum_posts(forum_id)",
                "CREATE INDEX IF NOT EXISTS idx_forum_posts_author_id ON forum_posts(author_id)",
                "CREATE INDEX IF NOT EXISTS idx_forum_posts_parent_id ON forum_posts(parent_post_id)",
                "CREATE INDEX IF NOT EXISTS idx_forum_posts_created_at ON forum_posts(created_at)",
                "CREATE INDEX IF NOT EXISTS idx_forum_posts_is_active ON forum_posts(is_active)",
                "CREATE INDEX IF NOT EXISTS idx_forum_posts_is_approved ON forum_posts(is_approved)",
                "CREATE INDEX IF NOT EXISTS idx_forum_posts_is_flagged ON forum_posts(is_flagged)",
                "CREATE INDEX IF NOT EXISTS idx_student_forums_category ON student_forums(category)",
                "CREATE INDEX IF NOT EXISTS idx_student_forums_is_active ON student_forums(is_active)",
                "CREATE INDEX IF NOT EXISTS idx_student_forums_course_id ON student_forums(course_id)",
                "CREATE INDEX IF NOT EXISTS idx_forum_subscriptions_user_forum ON forum_subscriptions(user_id, forum_id)",
                "CREATE INDEX IF NOT EXISTS idx_forum_post_likes_user_post ON forum_post_likes(user_id, post_id)",
            ]
            
            logger.info("⚡ Creating performance indexes...")
            for index_sql in indexes:
                total_operations += 1
                try:
                    connection.execute(text(index_sql))
                    connection.commit()
                    success_count += 1
                    logger.info(f"✅ Created index: {index_sql.split()[-1]}")
                except Exception as e:
                    logger.warning(f"⚠️  Index creation warning: {e}")
            
            # ============= INSERT DEFAULT DATA =============
            
            logger.info("💾 Ensuring default forum data...")
            
            # Check if general forum exists
            try:
                result = connection.execute(text("""
                    SELECT COUNT(*) FROM student_forums 
                    WHERE title = 'General Discussion' AND course_id IS NULL
                """))
                count = result.fetchone()[0]
                
                if count == 0:
                    # Create default general forum
                    default_forum_sql = """
                    INSERT INTO student_forums (
                        title, description, category, course_id, created_by, 
                        created_at, updated_at, is_active, allow_anonymous, moderated
                    ) VALUES (
                        'General Discussion', 
                        'A place for general community discussions and announcements',
                        'General',
                        NULL,
                        1,
                        :created_at,
                        :created_at,
                        1,
                        0,
                        0
                    )
                    """
                    
                    connection.execute(text(default_forum_sql), {
                        'created_at': datetime.utcnow()
                    })
                    connection.commit()
                    logger.info("✅ Created default General Discussion forum")
                    success_count += 1
                else:
                    logger.info("✓ General Discussion forum already exists")
                
                total_operations += 1
                
            except Exception as e:
                logger.error(f"❌ Failed to create default forum: {e}")
            
            # ============= MIGRATION SUMMARY =============
            
            logger.info("=" * 60)
            logger.info("🎯 FORUM MIGRATION SUMMARY")
            logger.info("=" * 60)
            logger.info(f"Total operations: {total_operations}")
            logger.info(f"Successful operations: {success_count}")
            logger.info(f"Failed operations: {total_operations - success_count}")
            logger.info(f"Success rate: {(success_count/total_operations)*100:.1f}%")
            
            if success_count == total_operations:
                logger.info("🎉 ALL FORUM MIGRATIONS COMPLETED SUCCESSFULLY!")
            else:
                logger.warning("⚠️  Some operations failed. Check logs above.")
            
            logger.info("=" * 60)
            
            return success_count == total_operations
        
    except Exception as e:
        logger.error(f"💥 Migration failed with error: {e}")
        return False
    
    finally:
        try:
            engine.dispose()
            logger.info("🔌 Database connection closed")
        except:
            pass

if __name__ == "__main__":
    logger.info("🏗️  Forum Production Migration Script")
    logger.info("=" * 60)
    
    success = run_migration()
    
    if success:
        logger.info("✅ Migration completed successfully!")
        sys.exit(0)
    else:
        logger.error("❌ Migration failed!")
        sys.exit(1)