#!/usr/bin/env python3
"""
Migration script for Module Release Settings feature.
Adds fields to courses and modules tables for controlled module release.
"""

import os
import sys
from datetime import datetime

# Add the project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app, db
from sqlalchemy import text, inspect

def check_column_exists(table_name, column_name):
    """Check if a column exists in a table."""
    inspector = inspect(db.engine)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns

def migrate_module_release():
    """Add module release settings columns to courses and modules tables."""
    
    with app.app_context():
        print("=" * 60)
        print("Module Release Settings Migration")
        print("=" * 60)
        
        # Detect database type
        db_url = str(db.engine.url)
        is_postgres = 'postgresql' in db_url.lower()
        
        # Set types based on database
        if is_postgres:
            datetime_type = 'TIMESTAMP'
            boolean_default = 'FALSE'
        else:
            datetime_type = 'DATETIME'
            boolean_default = '0'
        
        # Course table columns
        course_columns = [
            ('start_date', datetime_type),
            ('module_release_count', 'INTEGER'),
            ('module_release_interval', 'VARCHAR(50)'),
            ('module_release_interval_days', 'INTEGER')
        ]
        
        # Module table columns
        module_columns = [
            ('is_released', f'BOOLEAN DEFAULT {boolean_default}'),
            ('released_at', datetime_type)
        ]
        
        print("\n📋 Checking and adding Course table columns...")
        for column_name, column_type in course_columns:
            if not check_column_exists('courses', column_name):
                try:
                    sql = f"ALTER TABLE courses ADD COLUMN {column_name} {column_type}"
                    db.session.execute(text(sql))
                    db.session.commit()
                    print(f"  ✅ Added column 'courses.{column_name}'")
                except Exception as e:
                    db.session.rollback()
                    print(f"  ⚠️ Could not add 'courses.{column_name}': {e}")
            else:
                print(f"  ℹ️ Column 'courses.{column_name}' already exists")
        
        print("\n📋 Checking and adding Module table columns...")
        for column_name, column_type in module_columns:
            if not check_column_exists('modules', column_name):
                try:
                    sql = f"ALTER TABLE modules ADD COLUMN {column_name} {column_type}"
                    db.session.execute(text(sql))
                    db.session.commit()
                    print(f"  ✅ Added column 'modules.{column_name}'")
                except Exception as e:
                    db.session.rollback()
                    print(f"  ⚠️ Could not add 'modules.{column_name}': {e}")
            else:
                print(f"  ℹ️ Column 'modules.{column_name}' already exists")
        
        print("\n" + "=" * 60)
        print("✅ Migration completed successfully!")
        print("=" * 60)
        print("\nNew features available:")
        print("  - Course start date for module release calculations")
        print("  - Initial module release count setting")
        print("  - Time-based module release intervals")
        print("  - Manual module release override by instructors")
        print()

if __name__ == "__main__":
    migrate_module_release()
