#!/usr/bin/env python3
"""
Add modification request fields to Project model
Run this script to add the modification request functionality to projects
"""

import sys
import os

# Add the backend directory to the path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from src.models.user_models import db
from src.models.course_models import Project
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def add_project_modification_fields():
    """Add modification request fields to projects table"""
    
    try:
        # Check if fields already exist
        inspector = db.inspect(db.engine)
        columns = [col['name'] for col in inspector.get_columns('projects')]
        
        # List of fields to add
        fields_to_add = [
            ('modification_requested', 'BOOLEAN DEFAULT FALSE NOT NULL'),
            ('modification_request_reason', 'TEXT'),
            ('modification_requested_at', 'TIMESTAMP'),
            ('modification_requested_by', 'INTEGER REFERENCES users(id)'),
            ('can_resubmit', 'BOOLEAN DEFAULT FALSE NOT NULL')
        ]
        
        for field_name, field_definition in fields_to_add:
            if field_name not in columns:
                logger.info(f"Adding {field_name} field to projects table...")
                
                if 'postgres' in db.engine.url.drivername:
                    # PostgreSQL syntax
                    sql = f"ALTER TABLE projects ADD COLUMN {field_name} {field_definition};"
                else:
                    # SQLite syntax
                    sql = f"ALTER TABLE projects ADD COLUMN {field_name} {field_definition};"
                
                db.session.execute(text(sql))
                logger.info(f"Successfully added {field_name} field")
            else:
                logger.info(f"{field_name} field already exists, skipping...")
        
        # Commit all changes
        db.session.commit()
        logger.info("Successfully added all modification request fields to projects table")
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error adding modification request fields: {str(e)}")
        raise

if __name__ == '__main__':
    from main import app
    
    with app.app_context():
        add_project_modification_fields()
        print("Project modification request fields migration completed successfully!")