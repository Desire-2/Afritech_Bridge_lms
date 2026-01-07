# Migration to add assignment submission and modification request fields

from sqlalchemy import text
from src.models import db

def migrate_add_assignment_fields():
    """Add assignment submission and modification request fields to lesson_completions"""
    try:
        # Check if columns exist before adding them
        inspector = db.inspect(db.engine)
        
        # Get existing columns for lesson_completions table
        lesson_completion_columns = [col['name'] for col in inspector.get_columns('lesson_completions')]
        
        # Add assignment submission fields if they don't exist
        assignment_fields = {
            'assignment_submitted': 'BOOLEAN DEFAULT FALSE',
            'assignment_submission': 'TEXT',
            'assignment_file_url': 'VARCHAR(500)',
            'assignment_submitted_at': 'TIMESTAMP',
            'assignment_graded': 'BOOLEAN DEFAULT FALSE',
            'assignment_grade': 'FLOAT',
            'assignment_feedback': 'TEXT',
            'assignment_graded_at': 'TIMESTAMP',
            'assignment_needs_resubmission': 'BOOLEAN DEFAULT FALSE',
            'modification_request_reason': 'TEXT',
            'is_resubmission': 'BOOLEAN DEFAULT FALSE',
            'resubmission_reason': 'TEXT'
        }
        
        for field_name, field_type in assignment_fields.items():
            if field_name not in lesson_completion_columns:
                db.session.execute(text(f'ALTER TABLE lesson_completions ADD COLUMN {field_name} {field_type}'))
                print(f"✅ Added {field_name} column to lesson_completions")
        
        db.session.commit()
        print("✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration error: {e}")
        db.session.rollback()
        raise

if __name__ == "__main__":
    from main import app
    with app.app_context():
        migrate_add_assignment_fields()