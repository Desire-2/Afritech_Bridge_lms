# Assignment Modification Request System Database Migration

"""
Add modification request system to assignments
"""

from src.models import db
from src.models.course_models import Assignment, Project
from sqlalchemy import text

def migrate_add_modification_request_columns():
    """Add modification request columns to assignments and projects"""
    try:
        # Check if columns exist before adding them
        inspector = db.inspect(db.engine)
        
        # Get existing columns for assignments table
        assignment_columns = [col['name'] for col in inspector.get_columns('assignments')]
        
        # Add modification request columns to assignments if they don't exist
        if 'modification_requested' not in assignment_columns:
            db.session.execute(text('ALTER TABLE assignments ADD COLUMN modification_requested BOOLEAN DEFAULT FALSE'))
            print("✅ Added modification_requested column to assignments")
        
        if 'modification_request_reason' not in assignment_columns:
            db.session.execute(text('ALTER TABLE assignments ADD COLUMN modification_request_reason TEXT'))
            print("✅ Added modification_request_reason column to assignments")
        
        if 'modification_requested_at' not in assignment_columns:
            db.session.execute(text('ALTER TABLE assignments ADD COLUMN modification_requested_at TIMESTAMP'))
            print("✅ Added modification_requested_at column to assignments")
        
        if 'modification_requested_by' not in assignment_columns:
            db.session.execute(text('ALTER TABLE assignments ADD COLUMN modification_requested_by INTEGER REFERENCES users(id)'))
            print("✅ Added modification_requested_by column to assignments")
        
        if 'resubmission_count' not in assignment_columns:
            db.session.execute(text('ALTER TABLE assignments ADD COLUMN resubmission_count INTEGER DEFAULT 0'))
            print("✅ Added resubmission_count column to assignments")
        
        if 'max_resubmissions' not in assignment_columns:
            db.session.execute(text('ALTER TABLE assignments ADD COLUMN max_resubmissions INTEGER DEFAULT 3'))
            print("✅ Added max_resubmissions column to assignments")
        
        # Check for assignment_submissions table
        try:
            submission_columns = [col['name'] for col in inspector.get_columns('assignment_submissions')]
            
            if 'is_resubmission' not in submission_columns:
                db.session.execute(text('ALTER TABLE assignment_submissions ADD COLUMN is_resubmission BOOLEAN DEFAULT FALSE'))
                print("✅ Added is_resubmission column to assignment_submissions")
            
            if 'original_submission_id' not in submission_columns:
                db.session.execute(text('ALTER TABLE assignment_submissions ADD COLUMN original_submission_id INTEGER REFERENCES assignment_submissions(id)'))
                print("✅ Added original_submission_id column to assignment_submissions")
            
            if 'resubmission_reason' not in submission_columns:
                db.session.execute(text('ALTER TABLE assignment_submissions ADD COLUMN resubmission_reason TEXT'))
                print("✅ Added resubmission_reason column to assignment_submissions")
            
        except Exception as e:
            print(f"Assignment submissions table not found or error: {e}")
        
        # Check for project_submissions table
        try:
            project_submission_columns = [col['name'] for col in inspector.get_columns('project_submissions')]
            
            if 'is_resubmission' not in project_submission_columns:
                db.session.execute(text('ALTER TABLE project_submissions ADD COLUMN is_resubmission BOOLEAN DEFAULT FALSE'))
                print("✅ Added is_resubmission column to project_submissions")
            
            if 'original_submission_id' not in project_submission_columns:
                db.session.execute(text('ALTER TABLE project_submissions ADD COLUMN original_submission_id INTEGER REFERENCES project_submissions(id)'))
                print("✅ Added original_submission_id column to project_submissions")
            
            if 'resubmission_reason' not in project_submission_columns:
                db.session.execute(text('ALTER TABLE project_submissions ADD COLUMN resubmission_reason TEXT'))
                print("✅ Added resubmission_reason column to project_submissions")
            
        except Exception as e:
            print(f"Project submissions table not found or error: {e}")
        
        # Get existing columns for projects table
        try:
            project_columns = [col['name'] for col in inspector.get_columns('projects')]
            
            # Add modification request columns to projects if they don't exist
            if 'modification_requested' not in project_columns:
                db.session.execute(text('ALTER TABLE projects ADD COLUMN modification_requested BOOLEAN DEFAULT FALSE'))
                print("✅ Added modification_requested column to projects")
            
            if 'modification_request_reason' not in project_columns:
                db.session.execute(text('ALTER TABLE projects ADD COLUMN modification_request_reason TEXT'))
                print("✅ Added modification_request_reason column to projects")
            
            if 'modification_requested_at' not in project_columns:
                db.session.execute(text('ALTER TABLE projects ADD COLUMN modification_requested_at TIMESTAMP'))
                print("✅ Added modification_requested_at column to projects")
            
            if 'modification_requested_by' not in project_columns:
                db.session.execute(text('ALTER TABLE projects ADD COLUMN modification_requested_by INTEGER REFERENCES users(id)'))
                print("✅ Added modification_requested_by column to projects")
            
            if 'resubmission_count' not in project_columns:
                db.session.execute(text('ALTER TABLE projects ADD COLUMN resubmission_count INTEGER DEFAULT 0'))
                print("✅ Added resubmission_count column to projects")
            
            if 'max_resubmissions' not in project_columns:
                db.session.execute(text('ALTER TABLE projects ADD COLUMN max_resubmissions INTEGER DEFAULT 3'))
                print("✅ Added max_resubmissions column to projects")
                
        except Exception as e:
            print(f"Projects table not found or error: {e}")
        
        db.session.commit()
        print("✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration error: {e}")
        db.session.rollback()
        raise

if __name__ == "__main__":
    from main import app
    with app.app_context():
        migrate_add_modification_request_columns()