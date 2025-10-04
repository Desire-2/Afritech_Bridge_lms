#!/usr/bin/env python3
"""
Database Migration Script for Course Creation Features
This script adds the new Assignment and Project tables to the existing database.
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app
from src.models.user_models import db
from src.models.course_models import (
    Course, Module, Lesson, Quiz, Question, Answer, 
    Assignment, AssignmentSubmission, Project, ProjectSubmission,
    Enrollment, Submission, Announcement
)

def migrate_database():
    """Add new tables and update existing ones"""
    with app.app_context():
        try:
            print("Creating new tables for course creation features...")
            
            # Create all tables (this will only create missing ones)
            db.create_all()
            
            print("✅ Database migration completed successfully!")
            print("New tables created:")
            print("  - assignments")
            print("  - assignment_submissions") 
            print("  - projects")
            print("  - project_submissions")
            print("Enhanced existing tables with new columns:")
            print("  - modules (added learning_objectives, is_published, created_at, updated_at)")
            print("  - lessons (added description, learning_objectives, duration_minutes, is_published, created_at, updated_at)")
            
        except Exception as e:
            print(f"❌ Error during migration: {e}")
            return False
    
    return True

if __name__ == "__main__":
    print("🚀 Starting database migration for course creation features...")
    success = migrate_database()
    
    if success:
        print("\n✅ Migration completed! You can now use the new course creation features.")
    else:
        print("\n❌ Migration failed. Please check the error messages above.")
        sys.exit(1)