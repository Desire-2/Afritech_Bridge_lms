#!/usr/bin/env python3
"""
Migration script for CourseApplication model updates.
Adds new comprehensive fields to match the 6-section application form.
"""
import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import after path is set
from src.models.user_models import db
from src.models.course_application import CourseApplication
from sqlalchemy import text


def migrate_applications():
    """Add new columns to course_applications table"""
    # Import here to avoid circular imports
    from main import app
    
    with app.app_context():
        print("Starting CourseApplication migration...")
        
        # List of all new columns to add
        migrations = [
            # Section 1: Applicant Information
            ("full_name", "VARCHAR(150)"),
            ("whatsapp_number", "VARCHAR(30)"),
            ("gender", "VARCHAR(50)"),
            ("age_range", "VARCHAR(50)"),
            ("country", "VARCHAR(100)"),
            ("city", "VARCHAR(100)"),
            
            # Section 2: Education & Background
            ("education_level", "VARCHAR(50)"),
            ("current_status", "VARCHAR(50)"),
            ("field_of_study", "VARCHAR(150)"),
            
            # Section 3: Excel Skills
            ("has_used_excel", "BOOLEAN DEFAULT 0"),
            ("excel_skill_level", "VARCHAR(50)"),
            ("excel_tasks_done", "TEXT"),
            
            # Section 4: Learning Goals
            ("learning_outcomes", "TEXT"),
            ("career_impact", "TEXT"),
            
            # Section 5: Access & Availability
            ("internet_access_type", "VARCHAR(50)"),
            ("preferred_learning_mode", "VARCHAR(50)"),
            ("available_time", "TEXT"),
            
            # Section 6: Commitment
            ("committed_to_complete", "BOOLEAN DEFAULT 0"),
            ("agrees_to_assessments", "BOOLEAN DEFAULT 0"),
            ("referral_source", "VARCHAR(200)"),
            
            # New scoring fields
            ("readiness_score", "INTEGER DEFAULT 0"),
            ("commitment_score", "INTEGER DEFAULT 0"),
            
            # Workflow fields
            ("rejection_reason", "TEXT"),
            ("admin_notes", "TEXT"),
            ("updated_at", "DATETIME"),
            ("reviewed_at", "DATETIME"),
        ]
        
        for column_name, column_type in migrations:
            try:
                # Check if column exists
                result = db.session.execute(
                    text(f"PRAGMA table_info(course_applications)")
                ).fetchall()
                
                existing_columns = [row[1] for row in result]
                
                if column_name not in existing_columns:
                    print(f"Adding column: {column_name}")
                    db.session.execute(
                        text(f"ALTER TABLE course_applications ADD COLUMN {column_name} {column_type}")
                    )
                    db.session.commit()
                    print(f"✅ Added {column_name}")
                else:
                    print(f"⏭️  Column {column_name} already exists")
                    
            except Exception as e:
                print(f"❌ Error adding {column_name}: {str(e)}")
                db.session.rollback()
        
        # Migrate existing data
        print("\nMigrating existing application data...")
        applications = CourseApplication.query.all()
        
        for app in applications:
            try:
                # Combine first_name and last_name into full_name if not set
                if not app.full_name and (app.first_name or app.last_name):
                    app.full_name = f"{app.first_name or ''} {app.last_name or ''}".strip()
                
                # Set whatsapp to phone if not set
                if not app.whatsapp_number and app.phone:
                    app.whatsapp_number = app.phone
                
                # Map digital_skill_level to excel_skill_level
                if not app.excel_skill_level and app.digital_skill_level:
                    app.excel_skill_level = app.digital_skill_level
                
                # Set has_used_excel based on skill level
                if app.excel_skill_level and app.excel_skill_level != "never_used":
                    app.has_used_excel = True
                
                # Set default commitments for existing apps
                if app.committed_to_complete is None:
                    app.committed_to_complete = True  # Assume existing are committed
                if app.agrees_to_assessments is None:
                    app.agrees_to_assessments = True
                
                # Set updated_at
                if not app.updated_at:
                    app.updated_at = app.created_at
                
                db.session.add(app)
                
            except Exception as e:
                print(f"Error migrating application {app.id}: {str(e)}")
        
        try:
            db.session.commit()
            print(f"\n✅ Successfully migrated {len(applications)} applications")
        except Exception as e:
            print(f"❌ Error committing migrations: {str(e)}")
            db.session.rollback()
        
        # Add indexes for better performance
        print("\nAdding indexes...")
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_applications_email ON course_applications(email)",
            "CREATE INDEX IF NOT EXISTS idx_applications_status ON course_applications(status)",
            "CREATE INDEX IF NOT EXISTS idx_applications_course_status ON course_applications(course_id, status)",
            "CREATE INDEX IF NOT EXISTS idx_applications_rank_score ON course_applications(final_rank_score DESC)",
        ]
        
        for index_sql in indexes:
            try:
                db.session.execute(text(index_sql))
                db.session.commit()
                print(f"✅ Index created")
            except Exception as e:
                print(f"Index might already exist: {str(e)}")
                db.session.rollback()
        
        print("\n" + "="*60)
        print("Migration completed successfully!")
        print("="*60)


if __name__ == "__main__":
    migrate_applications()
