#!/usr/bin/env python3
"""
Database Migration: Add payment_slip_url column to CourseApplication

This migration adds the payment_slip_url column that was missing from the schema.
Run this script to add the column to the existing database.
"""
from sqlalchemy import text
import logging
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate_add_payment_slip_url():
    """Add payment_slip_url column to course_applications table"""
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
            logger.info("🔧 Starting migration: Add payment_slip_url column")
            
            # Check database type
            database_url = app.config['SQLALCHEMY_DATABASE_URI']
            is_postgresql = database_url.startswith('postgresql')
            
            # Check if column already exists
            inspector = db.inspect(db.engine)
            existing_columns = [col['name'] for col in inspector.get_columns('course_applications')]
            
            if 'payment_slip_url' in existing_columns:
                logger.info("✓ Column payment_slip_url already exists - skipping")
                return
            
            # Add column
            logger.info("➕ Adding column: payment_slip_url")
            
            if is_postgresql:
                # PostgreSQL syntax
                alter_query = text("""
                    ALTER TABLE course_applications 
                    ADD COLUMN IF NOT EXISTS payment_slip_url TEXT
                """)
            else:
                # SQLite syntax
                alter_query = text("""
                    ALTER TABLE course_applications 
                    ADD COLUMN payment_slip_url TEXT
                """)
            
            db.session.execute(alter_query)
            db.session.commit()
            
            logger.info("✅ Migration completed successfully!")
            logger.info("🎉 payment_slip_url column added to course_applications table!")
            
        except Exception as e:
            logger.error(f"❌ Migration failed: {str(e)}")
            db.session.rollback()
            raise


if __name__ == '__main__':
    try:
        migrate_add_payment_slip_url()
    except Exception as e:
        logger.error(f"Migration script failed: {str(e)}")
        sys.exit(1)
