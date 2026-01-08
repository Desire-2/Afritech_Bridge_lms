#!/usr/bin/env python3
"""
Migration Script: Add Submission Tracking Fields
Adds submission status tracking fields to support first-time vs. resubmission detection.
"""

import sys
import os

# Add the backend directory to Python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

from main import app, db
from src.models.course_models import AssignmentSubmission, ProjectSubmission

def migrate_submission_tracking_fields():
    """Add submission tracking fields to assignment and project submissions"""
    
    print("🚀 Starting submission tracking fields migration...")
    
    with app.app_context():
        try:
            # Get database engine
            engine = db.engine
            
            print("📊 Adding submission tracking fields to assignment_submissions...")
            
            # Add columns to assignment_submissions table
            assignment_submission_columns = [
                "ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS is_resubmission BOOLEAN DEFAULT FALSE",
                "ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS original_submission_id INTEGER REFERENCES assignment_submissions(id)",
                "ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS resubmission_count INTEGER DEFAULT 0",
                "ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS submission_notes TEXT"
            ]
            
            for query in assignment_submission_columns:
                try:
                    engine.execute(query)
                    print(f"✅ Executed: {query[:50]}...")
                except Exception as e:
                    print(f"⚠️  Column might already exist: {str(e)[:100]}...")
            
            print("📊 Adding submission tracking fields to project_submissions...")
            
            # Add columns to project_submissions table
            project_submission_columns = [
                "ALTER TABLE project_submissions ADD COLUMN IF NOT EXISTS is_resubmission BOOLEAN DEFAULT FALSE",
                "ALTER TABLE project_submissions ADD COLUMN IF NOT EXISTS original_submission_id INTEGER REFERENCES project_submissions(id)",
                "ALTER TABLE project_submissions ADD COLUMN IF NOT EXISTS resubmission_count INTEGER DEFAULT 0",
                "ALTER TABLE project_submissions ADD COLUMN IF NOT EXISTS submission_notes TEXT"
            ]
            
            for query in project_submission_columns:
                try:
                    engine.execute(query)
                    print(f"✅ Executed: {query[:50]}...")
                except Exception as e:
                    print(f"⚠️  Column might already exist: {str(e)[:100]}...")
            
            # Commit the changes
            db.session.commit()
            print("✅ Database schema updated successfully!")
            
            # Verify the changes
            print("\n🔍 Verifying migration...")
            
            # Check if we can create instances with the new fields
            try:
                # This will fail if the columns don't exist
                test_query = db.session.query(AssignmentSubmission.is_resubmission).first()
                test_query = db.session.query(ProjectSubmission.is_resubmission).first()
                print("✅ New fields are accessible!")
            except Exception as e:
                print(f"❌ Verification failed: {str(e)}")
                return False
            
            return True
            
        except Exception as e:
            print(f"❌ Migration failed: {str(e)}")
            db.session.rollback()
            return False

def main():
    """Main migration function"""
    print("=" * 60)
    print("SUBMISSION TRACKING FIELDS MIGRATION")
    print("=" * 60)
    
    success = migrate_submission_tracking_fields()
    
    if success:
        print("\n🎉 Migration completed successfully!")
        print("\nNew features available:")
        print("• Track first-time submissions vs. resubmissions")
        print("• Count number of resubmissions")
        print("• Store notes about resubmission reasons")
        print("• Link resubmissions to original submissions")
    else:
        print("\n❌ Migration failed. Please check the errors above.")
        sys.exit(1)

if __name__ == '__main__':
    main()