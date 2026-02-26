#!/usr/bin/env python3
"""
Database Migration: Add ALL Missing Columns to CourseApplication

This migration adds all columns that are defined in the model but missing from the database schema.
Run this script after model updates to sync the database.
"""
from sqlalchemy import text
import logging
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate_add_all_missing_columns():
    """Add all missing columns to course_applications table"""
    from src.models.user_models import db
    from flask import Flask
    
    # Create Flask app context
    app = Flask(__name__)
    
    # Get database URL from environment or use SQLite default with absolute path
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        # Use absolute path for SQLite (matches main.py logic)
        db_path = os.path.join(os.path.dirname(__file__), 'instance', 'afritec_lms_db.db')
        database_url = f"sqlite:///{db_path}"
        
        # Ensure instance directory exists
        instance_dir = os.path.dirname(db_path)
        if not os.path.exists(instance_dir):
            os.makedirs(instance_dir)
    
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Transform postgres:// to postgresql+psycopg2:// for SQLAlchemy 2.0
    if app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgres://'):
        app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI'].replace(
            'postgres://', 'postgresql+psycopg2://', 1
        )
    
    db.init_app(app)
    
    with app.app_context():
        try:
            logger.info("🔧 Starting migration: Add all missing columns")
            
            # Check database type
            database_url = app.config['SQLALCHEMY_DATABASE_URI']
            is_postgresql = database_url.startswith('postgresql')
            
            # Check existing columns
            inspector = db.inspect(db.engine)
            existing_columns = [col['name'] for col in inspector.get_columns('course_applications')]
            
            logger.info(f"📋 Found {len(existing_columns)} existing columns")
            
            # Define all columns that should exist
            columns_to_check = {
                'payment_slip_url': 'TEXT',
                'payment_slip_filename': 'VARCHAR(255)',
                'original_window_id': 'INTEGER',
                'migrated_to_window_id': 'INTEGER',
                'migrated_at': 'DATETIME',
                'migration_notes': 'TEXT',
            }
            
            # Add missing columns
            added_count = 0
            for col_name, col_type in columns_to_check.items():
                if col_name not in existing_columns:
                    logger.info(f"➕ Adding column: {col_name} ({col_type})")
                    
                    if is_postgresql:
                        # PostgreSQL syntax - need to convert types
                        pg_type = col_type.replace('DATETIME', 'TIMESTAMP').replace('TEXT', 'TEXT').replace('VARCHAR', 'VARCHAR')
                        alter_query = text(f"""
                            ALTER TABLE course_applications 
                            ADD COLUMN IF NOT EXISTS {col_name} {pg_type}
                        """)
                    else:
                        # SQLite syntax
                        alter_query = text(f"""
                            ALTER TABLE course_applications 
                            ADD COLUMN {col_name} {col_type}
                        """)
                    
                    try:
                        db.session.execute(alter_query)
                        db.session.commit()
                        added_count += 1
                        logger.info(f"✅ Added: {col_name}")
                    except Exception as e:
                        logger.warning(f"⚠️ Could not add {col_name}: {str(e)}")
                        db.session.rollback()
                else:
                    logger.info(f"✓ Column {col_name} already exists - skipping")
            
            if added_count > 0:
                logger.info(f"✅ Migration completed! Added {added_count} columns")
            else:
                logger.info("✅ All columns already exist - nothing to add")
            
            # Add foreign key constraints if needed (PostgreSQL only)
            if is_postgresql:
                logger.info("🔗 Checking foreign keys...")
                
                fk_queries = []
                if 'original_window_id' in existing_columns:
                    fk_queries.append("""
                        ALTER TABLE course_applications 
                        ADD CONSTRAINT IF NOT EXISTS fk_original_window 
                        FOREIGN KEY (original_window_id) REFERENCES application_windows(id)
                    """)
                
                if 'migrated_to_window_id' in existing_columns:
                    fk_queries.append("""
                        ALTER TABLE course_applications 
                        ADD CONSTRAINT IF NOT EXISTS fk_migrated_to_window 
                        FOREIGN KEY (migrated_to_window_id) REFERENCES application_windows(id)
                    """)
                
                for fk_query in fk_queries:
                    try:
                        db.session.execute(text(fk_query))
                        db.session.commit()
                    except Exception as e:
                        logger.warning(f"⚠️ FK constraint already exists or error: {str(e)}")
                        db.session.rollback()
            
            logger.info("🎉 Schema migration complete!")
            
        except Exception as e:
            logger.error(f"❌ Migration failed: {str(e)}")
            db.session.rollback()
            import traceback
            traceback.print_exc()
            raise


if __name__ == '__main__':
    try:
        migrate_add_all_missing_columns()
    except Exception as e:
        logger.error(f"Migration script failed: {str(e)}")
        sys.exit(1)
