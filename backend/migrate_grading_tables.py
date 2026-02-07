#!/usr/bin/env python3
"""
Migration script to create grading enhancement tables in PostgreSQL
Creates: rubrics, rubric_criteria, feedback_templates, grading_history, grading_sessions
"""

import sys
import os

# Add the parent directory to the path so we can import from src
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.models.user_models import db
from src.models.grading_models import (
    Rubric, 
    RubricCriterion, 
    FeedbackTemplate, 
    GradingHistory, 
    GradingSession,
    create_default_feedback_templates
)
from src.models.course_models import User
from main import app

def migrate():
    """Create grading tables and seed default data"""
    
    with app.app_context():
        print("\n" + "="*60)
        print("GRADING TABLES MIGRATION")
        print("="*60 + "\n")
        
        # Check if tables already exist
        inspector = db.inspect(db.engine)
        existing_tables = inspector.get_table_names()
        
        grading_tables = ['rubrics', 'rubric_criteria', 'feedback_templates', 'grading_history', 'grading_sessions']
        missing_tables = [t for t in grading_tables if t not in existing_tables]
        
        if not missing_tables:
            print("✅ All grading tables already exist!")
            print(f"📋 Existing tables: {', '.join(grading_tables)}\n")
        else:
            print(f"📋 Missing tables: {', '.join(missing_tables)}")
            print("🔨 Creating grading tables...\n")
            
            # Create the tables
            try:
                db.create_all()
                print("✅ Grading tables created successfully!\n")
            except Exception as e:
                print(f"❌ Error creating tables: {str(e)}\n")
                return False
        
        # Verify tables were created
        inspector = db.inspect(db.engine)
        existing_tables = inspector.get_table_names()
        created_tables = [t for t in grading_tables if t in existing_tables]
        
        print(f"📊 Grading tables in database: {', '.join(created_tables)}\n")
        
        # Check for existing feedback templates
        template_count = FeedbackTemplate.query.count()
        
        if template_count > 0:
            print(f"✅ {template_count} feedback templates already exist\n")
        else:
            print("📝 Creating default feedback templates...\n")
            
            # Find an instructor to assign templates to
            # First try to find an instructor role
            instructor = User.query.join(User.role).filter(
                db.or_(
                    db.text("roles.name = 'instructor'"),
                    db.text("roles.name = 'admin'")
                )
            ).first()
            
            if not instructor:
                # Fallback to first user
                instructor = User.query.first()
            
            if instructor:
                print(f"Using instructor: {instructor.username} (ID: {instructor.id})")
                
                # Create default templates
                templates = create_default_feedback_templates(instructor.id)
                
                for template in templates:
                    # Check if template already exists
                    existing = FeedbackTemplate.query.filter_by(
                        instructor_id=instructor.id,
                        title=template.title
                    ).first()
                    
                    if not existing:
                        db.session.add(template)
                
                try:
                    db.session.commit()
                    print("✅ Default feedback templates created\n")
                except Exception as e:
                    db.session.rollback()
                    print(f"❌ Error creating templates: {str(e)}\n")
                    return False
            else:
                print("⚠️  No instructor found to create templates for\n")
        
        # Final verification
        print("\n" + "="*60)
        print("MIGRATION SUMMARY")
        print("="*60 + "\n")
        
        # Count records in each table
        rubric_count = Rubric.query.count()
        criteria_count = RubricCriterion.query.count()
        template_count = FeedbackTemplate.query.count()
        history_count = GradingHistory.query.count()
        session_count = GradingSession.query.count()
        
        print(f"📊 Rubrics: {rubric_count}")
        print(f"📊 Rubric Criteria: {criteria_count}")
        print(f"📊 Feedback Templates: {template_count}")
        print(f"📊 Grading History: {history_count}")
        print(f"📊 Grading Sessions: {session_count}\n")
        
        # Show template categories
        if template_count > 0:
            print("📝 Feedback Template Categories:")
            templates = FeedbackTemplate.query.all()
            categories = {}
            for t in templates:
                if t.category not in categories:
                    categories[t.category] = []
                categories[t.category].append(t.title)
            
            for category, titles in sorted(categories.items()):
                print(f"  - [{category}] {', '.join(titles)}")
        
        print("\n✨ Migration complete!\n")
        return True

if __name__ == '__main__':
    success = migrate()
    sys.exit(0 if success else 1)
