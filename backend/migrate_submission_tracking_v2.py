#!/usr/bin/env python3
"""
Migration script to add submission tracking fields to PostgreSQL database.
Adds:
- assignment_submissions.is_resubmission (BOOLEAN)
- assignment_submissions.original_submission_id (INTEGER)
- assignment_submissions.resubmission_count (INTEGER)
- assignment_submissions.submission_notes (TEXT)
- project_submissions.is_resubmission (BOOLEAN)
- project_submissions.original_submission_id (INTEGER)  
- project_submissions.resubmission_count (INTEGER)
- project_submissions.submission_notes (TEXT)
"""
import sys
from sqlalchemy import text
from main import app, db

def run_migration():
    """Add submission tracking columns to the database"""
    with app.app_context():
        try:
            print("=" * 80)
            print("ADDING SUBMISSION TRACKING COLUMNS")
            print("=" * 80)
            
            # Assignment submission columns
            assignment_columns = [
                ('is_resubmission', 'BOOLEAN DEFAULT FALSE', 'Track if this is a resubmission'),
                ('original_submission_id', 'INTEGER REFERENCES assignment_submissions(id)', 'Link to original submission'),
                ('resubmission_count', 'INTEGER DEFAULT 0', 'Count of resubmissions'),
                ('submission_notes', 'TEXT', 'Notes about resubmission reason')
            ]
            
            print("\n🔄 Processing assignment_submissions table...")
            for column_name, column_def, description in assignment_columns:
                print(f"   Checking {column_name}...")
                result = db.session.execute(text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name='assignment_submissions' AND column_name=:col_name
                """), {"col_name": column_name})
                
                if result.fetchone() is None:
                    print(f"   ➜ Adding {column_name}: {description}")
                    db.session.execute(text(f"""
                        ALTER TABLE assignment_submissions 
                        ADD COLUMN {column_name} {column_def}
                    """))
                else:
                    print(f"   ✓ {column_name} already exists")
            
            # Project submission columns
            project_columns = [
                ('is_resubmission', 'BOOLEAN DEFAULT FALSE', 'Track if this is a resubmission'),
                ('original_submission_id', 'INTEGER REFERENCES project_submissions(id)', 'Link to original submission'),
                ('resubmission_count', 'INTEGER DEFAULT 0', 'Count of resubmissions'),
                ('submission_notes', 'TEXT', 'Notes about resubmission reason')
            ]
            
            print("\n🔄 Processing project_submissions table...")
            for column_name, column_def, description in project_columns:
                print(f"   Checking {column_name}...")
                result = db.session.execute(text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name='project_submissions' AND column_name=:col_name
                """), {"col_name": column_name})
                
                if result.fetchone() is None:
                    print(f"   ➜ Adding {column_name}: {description}")
                    db.session.execute(text(f"""
                        ALTER TABLE project_submissions 
                        ADD COLUMN {column_name} {column_def}
                    """))
                else:
                    print(f"   ✓ {column_name} already exists")
            
            # Commit all changes
            db.session.commit()
            print("\n✅ All submission tracking columns added successfully!")
            
            # Verify the migration
            print("\n🔍 Verifying migration...")
            verify_migration()
            
        except Exception as e:
            print(f"\n❌ Error during migration: {str(e)}")
            db.session.rollback()
            raise

def verify_migration():
    """Verify that all columns were added correctly"""
    tables_and_columns = [
        ('assignment_submissions', ['is_resubmission', 'original_submission_id', 'resubmission_count', 'submission_notes']),
        ('project_submissions', ['is_resubmission', 'original_submission_id', 'resubmission_count', 'submission_notes'])
    ]
    
    for table_name, columns in tables_and_columns:
        print(f"   Checking {table_name}...")
        for column in columns:
            result = db.session.execute(text("""
                SELECT column_name, data_type, column_default
                FROM information_schema.columns 
                WHERE table_name=:table AND column_name=:col
            """), {"table": table_name, "col": column})
            
            row = result.fetchone()
            if row:
                print(f"     ✓ {column} ({row.data_type})")
            else:
                print(f"     ❌ {column} missing!")
                return False
    
    print("   ✅ All columns verified successfully!")
    return True

if __name__ == '__main__':
    try:
        run_migration()
        print("\n🎉 Migration completed successfully!")
        print("\nSubmission tracking features are now available:")
        print("• First-time vs resubmission detection")
        print("• Resubmission count tracking")
        print("• Submission notes for modification reasons")
        print("• Links between original and resubmitted work")
    except Exception as e:
        print(f"\n💥 Migration failed: {str(e)}")
        sys.exit(1)