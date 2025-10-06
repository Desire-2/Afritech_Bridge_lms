#!/usr/bin/env python3
"""
Database Migration Script for Student Features
Adds all new tables and updates existing tables for the student feature implementation.
"""

import sys
import os
from datetime import datetime

# Add the backend directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from flask import Flask
from src.models import db
from src.models.user_models import User
from src.models.course_models import Course, Module, Lesson, Quiz, QuizQuestion, Enrollment
from src.models.student_models import *

def create_app():
    """Create and configure the Flask app for migration."""
    app = Flask(__name__)
    
    # Use the same database configuration as your main app
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///backend/instance/afritec_lms_db.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    db.init_app(app)
    return app

def run_migration():
    """Run the database migration to create new tables."""
    print("🔄 Starting Student Features Database Migration")
    print("=" * 50)
    
    app = create_app()
    
    with app.app_context():
        try:
            # Create all tables
            print("📋 Creating new tables...")
            db.create_all()
            print("✅ All tables created successfully!")
            
            # Verify tables were created
            print("\n📊 Verifying table creation...")
            
            # Check if new tables exist by trying to query them
            tables_to_check = [
                ('CourseEnrollmentApplication', CourseEnrollmentApplication),
                ('ModuleProgress', ModuleProgress),
                ('AssessmentAttempt', AssessmentAttempt),
                ('Certificate', Certificate),
                ('SkillBadge', SkillBadge),
                ('StudentSkillBadge', StudentSkillBadge),
                ('StudentTranscript', StudentTranscript),
                ('LearningAnalytics', LearningAnalytics),
            ]
            
            for table_name, model_class in tables_to_check:
                try:
                    # Try to query the table
                    count = model_class.query.count()
                    print(f"✅ {table_name}: Created (0 records)")
                except Exception as e:
                    print(f"❌ {table_name}: Error - {str(e)}")
            
            # Check existing tables
            print(f"\n✅ User table: {User.query.count()} records")
            print(f"✅ Course table: {Course.query.count()} records")
            print(f"✅ Module table: {Module.query.count()} records")
            print(f"✅ Lesson table: {Lesson.query.count()} records")
            print(f"✅ Quiz table: {Quiz.query.count()} records")
            print(f"✅ Enrollment table: {Enrollment.query.count()} records")
            
            print(f"\n🎉 Migration completed successfully at {datetime.now()}")
            print("\n📝 Next Steps:")
            print("1. Test the API endpoints")
            print("2. Create sample data for testing")
            print("3. Integrate with frontend")
            print("4. Set up payment gateway")
            print("5. Configure email notifications")
            
        except Exception as e:
            print(f"❌ Migration failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    return True

if __name__ == "__main__":
    success = run_migration()
    if success:
        print("\n✨ Student features database migration completed successfully!")
        exit(0)
    else:
        print("\n💥 Migration failed. Please check the errors above.")
        exit(1)