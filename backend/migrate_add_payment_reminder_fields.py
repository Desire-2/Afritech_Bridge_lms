"""
Database Migration: Add Payment Reminder Tracking Fields to CourseApplication

This migration adds fields to track payment reminders sent to applicants:
- last_payment_reminder_sent: timestamp of last reminder
- last_payment_reminder_type: type of last reminder ('first', 'urgent', 'final')
- payment_reminder_count: total count of reminders sent

Run this script to add the new columns to existing database.
"""
from sqlalchemy import text
from datetime import datetime
import logging
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate_add_payment_reminder_fields():
    """Add payment reminder tracking fields to course_applications table"""
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
            logger.info("🔧 Starting migration: Add payment reminder tracking fields")
            
            # Check database type
            database_url = app.config['SQLALCHEMY_DATABASE_URI']
            is_postgresql = database_url.startswith('postgresql')
            
            # Check if columns already exist
            inspector = db.inspect(db.engine)
            existing_columns = [col['name'] for col in inspector.get_columns('course_applications')]
            
            columns_to_add = []
            
            if 'last_payment_reminder_sent' not in existing_columns:
                columns_to_add.append('last_payment_reminder_sent')
            else:
                logger.info("ℹ️ Column 'last_payment_reminder_sent' already exists")
            
            if 'last_payment_reminder_type' not in existing_columns:
                columns_to_add.append('last_payment_reminder_type')
            else:
                logger.info("ℹ️ Column 'last_payment_reminder_type' already exists")
            
            if 'payment_reminder_count' not in existing_columns:
                columns_to_add.append('payment_reminder_count')
            else:
                logger.info("ℹ️ Column 'payment_reminder_count' already exists")
            
            if not columns_to_add:
                logger.info("✅ All payment reminder tracking columns already exist. No migration needed.")
                return
            
            # Add missing columns
            if is_postgresql:
                # PostgreSQL syntax
                if 'last_payment_reminder_sent' in columns_to_add:
                    logger.info("➕ Adding column: last_payment_reminder_sent")
                    db.session.execute(text("""
                        ALTER TABLE course_applications 
                        ADD COLUMN IF NOT EXISTS last_payment_reminder_sent TIMESTAMP
                    """))
                
                if 'last_payment_reminder_type' in columns_to_add:
                    logger.info("➕ Adding column: last_payment_reminder_type")
                    db.session.execute(text("""
                        ALTER TABLE course_applications 
                        ADD COLUMN IF NOT EXISTS last_payment_reminder_type VARCHAR(20)
                    """))
                
                if 'payment_reminder_count' in columns_to_add:
                    logger.info("➕ Adding column: payment_reminder_count")
                    db.session.execute(text("""
                        ALTER TABLE course_applications 
                        ADD COLUMN IF NOT EXISTS payment_reminder_count INTEGER DEFAULT 0
                    """))
            else:
                # SQLite syntax
                if 'last_payment_reminder_sent' in columns_to_add:
                    logger.info("➕ Adding column: last_payment_reminder_sent")
                    db.session.execute(text("""
                        ALTER TABLE course_applications 
                        ADD COLUMN last_payment_reminder_sent DATETIME
                    """))
                
                if 'last_payment_reminder_type' in columns_to_add:
                    logger.info("➕ Adding column: last_payment_reminder_type")
                    db.session.execute(text("""
                        ALTER TABLE course_applications 
                        ADD COLUMN last_payment_reminder_type VARCHAR(20)
                    """))
                
                if 'payment_reminder_count' in columns_to_add:
                    logger.info("➕ Adding column: payment_reminder_count")
                    db.session.execute(text("""
                        ALTER TABLE course_applications 
                        ADD COLUMN payment_reminder_count INTEGER DEFAULT 0
                    """))
            
            # Commit changes
            db.session.commit()
            logger.info("✅ Migration completed successfully!")
            
            # Update existing records to set default values
            if 'payment_reminder_count' in columns_to_add:
                logger.info("🔄 Setting default values for existing records...")
                db.session.execute(text("""
                    UPDATE course_applications 
                    SET payment_reminder_count = 0 
                    WHERE payment_reminder_count IS NULL
                """))
                db.session.commit()
                logger.info("✅ Default values set")
            
            logger.info("🎉 Payment reminder tracking migration complete!")
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"❌ Migration failed: {str(e)}")
            import traceback
            traceback.print_exc()
            raise


if __name__ == "__main__":
    migrate_add_payment_reminder_fields()
