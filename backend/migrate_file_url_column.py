#!/usr/bin/env python3
"""
Migration: Expand file_url column to support JSON metadata
Date: 2026-01-08
Purpose: Fix StringDataRightTruncation error by changing file_url from VARCHAR(255) to TEXT
"""

import sys
import os
from datetime import datetime

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app, db
from src.models.course_models import AssignmentSubmission
from sqlalchemy import text

def migrate_file_url_column():
    """Expand file_url column from VARCHAR(255) to TEXT"""
    
    with app.app_context():
        try:
            # Check current column definition
            print("Checking current file_url column definition...")
            
            # Use SQLAlchemy engine to detect database type
            engine_name = db.engine.name
            print(f"SQLAlchemy engine name: {engine_name}")
            
            if engine_name == 'postgresql':
                # PostgreSQL migration
                print("Detected PostgreSQL - using ALTER COLUMN...")
                db.session.execute(text("""
                    ALTER TABLE assignment_submissions 
                    ALTER COLUMN file_url TYPE TEXT
                """))
                
            else:
                # SQLite migration - need to recreate table
                print("Detected SQLite - recreating table with TEXT column...")
                
                # Step 1: Create backup table
                db.session.execute(text("""
                    CREATE TABLE assignment_submissions_backup AS 
                    SELECT * FROM assignment_submissions
                """))
                
                # Step 2: Drop original table
                db.session.execute(text("DROP TABLE assignment_submissions"))
                
                # Step 3: Create new table with TEXT column
                db.session.execute(text("""
                    CREATE TABLE assignment_submissions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        assignment_id INTEGER NOT NULL,
                        student_id INTEGER NOT NULL,
                        content TEXT,
                        file_url TEXT,
                        submitted_at TIMESTAMP,
                        is_late BOOLEAN DEFAULT 0,
                        feedback TEXT,
                        grade FLOAT,
                        graded_at TIMESTAMP,
                        graded_by INTEGER,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        original_submission_id INTEGER,
                        FOREIGN KEY (assignment_id) REFERENCES assignments (id),
                        FOREIGN KEY (student_id) REFERENCES users (id),
                        FOREIGN KEY (graded_by) REFERENCES users (id),
                        FOREIGN KEY (original_submission_id) REFERENCES assignment_submissions (id)
                    )
                """))
                
                # Step 4: Restore data
                db.session.execute(text("""
                    INSERT INTO assignment_submissions 
                    SELECT * FROM assignment_submissions_backup
                """))
                
                # Step 5: Drop backup table
                db.session.execute(text("DROP TABLE assignment_submissions_backup"))
            
            # Commit the changes
            db.session.commit()
            print("✅ Successfully expanded file_url column to TEXT")
            
            # Verify the change
            print("Verifying column change...")
            
            if engine_name == 'postgresql':
                result = db.session.execute(text("""
                    SELECT column_name, data_type, character_maximum_length
                    FROM information_schema.columns
                    WHERE table_name = 'assignment_submissions' 
                    AND column_name = 'file_url'
                """)).fetchone()
                
                if result:
                    print(f"Column info - Name: {result[0]}, Type: {result[1]}, Max Length: {result[2]}")
                else:
                    print("Could not verify column info")
            else:
                result = db.session.execute(text("""
                    PRAGMA table_info(assignment_submissions)
                """)).fetchall()
                
                file_url_col = [col for col in result if col[1] == 'file_url']
                if file_url_col:
                    print(f"file_url column: {file_url_col[0]}")
                else:
                    print("Could not find file_url column info")
                    
        except Exception as e:
            db.session.rollback()
            print(f"❌ Migration failed: {str(e)}")
            raise
        finally:
            db.session.close()

if __name__ == '__main__':
    print("Starting file_url column migration...")
    print(f"Timestamp: {datetime.now()}")
    
    migrate_file_url_column()
    
    print("Migration completed!")