#!/usr/bin/env python3
"""
Database Migration Script for Enhanced Module Progression System
Creates the StudentSuspension table and ensures all required tables exist.
"""

import sys
import os
from datetime import datetime

# Add the backend src directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend', 'src'))

from models.user_models import db
from models.student_models import StudentSuspension, ModuleProgress, AssessmentAttempt, LearningAnalytics

def create_suspension_table():
    """Create the StudentSuspension table if it doesn't exist"""
    try:
        # Create the table
        db.create_all()
        print("✅ StudentSuspension table created successfully")
        return True
    except Exception as e:
        print(f"❌ Error creating StudentSuspension table: {str(e)}")
        return False

def verify_existing_tables():
    """Verify that all required tables exist"""
    required_tables = [
        'users', 'courses', 'modules', 'lessons', 'enrollments',
        'module_progress', 'lesson_completions', 'assessment_attempts'
    ]
    
    try:
        inspector = db.inspect(db.engine)
        existing_tables = inspector.get_table_names()
        
        missing_tables = []
        for table in required_tables:
            if table not in existing_tables:
                missing_tables.append(table)
        
        if missing_tables:
            print(f"⚠️  Missing required tables: {', '.join(missing_tables)}")
            return False
        else:
            print("✅ All required tables exist")
            return True
    except Exception as e:
        print(f"❌ Error verifying tables: {str(e)}")
        return False

def add_sample_data():
    """Add some sample data for testing (optional)"""
    try:
        # This is optional - you can add sample courses, modules, etc. here
        # For now, we'll just ensure the tables are ready
        print("✅ Database is ready for sample data")
        return True
    except Exception as e:
        print(f"❌ Error adding sample data: {str(e)}")
        return False

def main():
    """Run the migration"""
    print("🚀 Starting Enhanced Module Progression Migration")
    print("=" * 50)
    
    # Step 1: Verify existing tables
    print("\n1. Verifying existing tables...")
    if not verify_existing_tables():
        print("❌ Migration failed: Missing required tables")
        return False
    
    # Step 2: Create suspension table
    print("\n2. Creating StudentSuspension table...")
    if not create_suspension_table():
        print("❌ Migration failed: Could not create StudentSuspension table")
        return False
    
    # Step 3: Ready for sample data
    print("\n3. Preparing database for sample data...")
    if not add_sample_data():
        print("⚠️  Warning: Could not prepare sample data")
    
    print("\n" + "=" * 50)
    print("✅ Migration completed successfully!")
    print("\nNext steps:")
    print("1. Start your backend server: cd backend && python app.py")
    print("2. Access the enhanced learning interface")
    print("3. Test module progression with sample data")
    
    return True

if __name__ == "__main__":
    # Make sure we're in the right directory
    if not os.path.exists('backend'):
        print("❌ Error: Please run this script from the project root directory")
        print("   (the directory containing both 'backend' and 'frontend' folders)")
        sys.exit(1)
    
    success = main()
    sys.exit(0 if success else 1)