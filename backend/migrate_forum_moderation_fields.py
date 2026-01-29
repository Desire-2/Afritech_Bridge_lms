"""
Migration script to add missing moderation fields to forum_posts table
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.models.user_models import db
from main import app

def add_moderation_fields():
    """Add missing moderation fields to forum_posts table"""
    try:
        with app.app_context():
            # Check if the fields exist before adding them
            inspector = db.inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('forum_posts')]
            
            alterations = []
            
            # Check and add missing columns
            if 'is_flagged' not in columns:
                alterations.append('ADD COLUMN is_flagged BOOLEAN DEFAULT FALSE')
            
            if 'flag_reason' not in columns:
                alterations.append('ADD COLUMN flag_reason TEXT')
            
            if 'moderated_by' not in columns:
                alterations.append('ADD COLUMN moderated_by INTEGER REFERENCES users(id)')
            
            if 'moderated_at' not in columns:
                alterations.append('ADD COLUMN moderated_at DATETIME')
            
            if 'is_edited' not in columns:
                alterations.append('ADD COLUMN is_edited BOOLEAN DEFAULT FALSE')
            
            if 'dislike_count' not in columns:
                alterations.append('ADD COLUMN dislike_count INTEGER DEFAULT 0')
            
            if alterations:
                print(f"Adding {len(alterations)} missing columns to forum_posts table...")
                for alteration in alterations:
                    try:
                        query = f"ALTER TABLE forum_posts {alteration}"
                        print(f"Executing: {query}")
                        db.engine.execute(query)
                        print(f"✓ Added column: {alteration}")
                    except Exception as col_error:
                        print(f"Error adding column {alteration}: {col_error}")
                        # Continue with other columns
                        
                print("✓ Forum moderation fields migration completed!")
            else:
                print("All moderation fields already exist in forum_posts table")
                
    except Exception as e:
        print(f"Error during migration: {e}")
        return False
    
    return True

if __name__ == '__main__':
    print("Starting forum moderation fields migration...")
    if add_moderation_fields():
        print("Migration completed successfully!")
    else:
        print("Migration failed!")