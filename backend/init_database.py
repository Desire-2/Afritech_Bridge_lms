#!/usr/bin/env python3
"""
Complete database initialization script for Afritec Bridge LMS.
This script can be used to set up a fresh database or ensure an existing one is complete.

Usage:
  python init_database.py --fresh    # Drop all tables and recreate (WARNING: DATA LOSS)
  python init_database.py            # Add missing tables only (safe)
  python init_database.py --check    # Check status only, no changes
"""
import os
import sys
import argparse
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app, db

def drop_all_tables():
    """Drop all existing tables (WARNING: DELETES ALL DATA)"""
    with app.app_context():
        print("⚠️  DROPPING ALL TABLES - ALL DATA WILL BE LOST!")
        
        # Get all table names
        result = db.session.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
        tables = [row[0] for row in result.fetchall()]
        
        # Drop all tables
        for table in tables:
            if table != 'sqlite_sequence':  # Don't drop SQLite system table
                try:
                    db.session.execute(text(f"DROP TABLE IF EXISTS {table}"))
                    print(f"   🗑️  Dropped table: {table}")
                except Exception as e:
                    print(f"   ❌ Failed to drop {table}: {e}")
        
        db.session.commit()
        print("✅ All tables dropped successfully")

def create_all_tables():
    """Create all tables from models"""
    with app.app_context():
        print("🚀 Creating all tables from models...")
        
        # Import all models
        from src.models.user_models import User, Role
        from src.models.course_models import (
            Course, Module, Lesson, Enrollment, Quiz, Question, Answer,
            Submission, Assignment, AssignmentSubmission, Project, 
            ProjectSubmission, Announcement
        )
        from src.models.achievement_models import (
            Achievement, UserAchievement, LearningStreak, StudentPoints,
            Milestone, UserMilestone, Leaderboard, QuestChallenge, UserQuestProgress
        )
        from src.models.quiz_progress_models import (
            QuizAttempt, UserAnswer, LessonCompletion, ModuleCompletion, Certificate
        )
        from src.models.student_models import UserProgress, Badge, UserBadge
        from src.models.opportunity_models import Opportunity
        
        # Create all tables
        db.create_all()
        db.session.commit()
        
        table_count = len(db.metadata.tables)
        print(f"✅ Created {table_count} tables successfully")

def initialize_default_data():
    """Initialize essential default data"""
    with app.app_context():
        print("📋 Initializing default data...")
        
        from src.models.user_models import Role
        
        # Create default roles
        default_roles = [
            {'name': 'student', 'description': 'Student role with basic access'},
            {'name': 'instructor', 'description': 'Instructor role with course management access'},
            {'name': 'admin', 'description': 'Administrator role with full system access'}
        ]
        
        created_roles = 0
        for role_data in default_roles:
            existing_role = Role.query.filter_by(name=role_data['name']).first()
            if not existing_role:
                role = Role(
                    name=role_data['name'],
                    description=role_data.get('description', '')
                )
                db.session.add(role)
                created_roles += 1
                print(f"   ✅ Created role: {role_data['name']}")
            else:
                print(f"   ℹ️  Role already exists: {role_data['name']}")
        
        if created_roles > 0:
            db.session.commit()
            print(f"✅ Initialized {created_roles} default roles")
        else:
            print("ℹ️  All default roles already exist")

def create_indexes():
    """Create performance indexes"""
    with app.app_context():
        print("📊 Creating performance indexes...")
        
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
            "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
            "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id)",
            "CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id)",
            "CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id)",
            "CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status)",
            "CREATE INDEX IF NOT EXISTS idx_modules_course ON modules(course_id, order)",
            "CREATE INDEX IF NOT EXISTS idx_lessons_module ON lessons(module_id, order)",
            "CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id)",
            "CREATE INDEX IF NOT EXISTS idx_quiz_attempts_created ON quiz_attempts(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_user_achievements_earned ON user_achievements(earned_at)",
            "CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id)",
            "CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id)",
            "CREATE INDEX IF NOT EXISTS idx_lesson_completion_user ON lesson_completion(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_lesson_completion_lesson ON lesson_completion(lesson_id)",
            "CREATE INDEX IF NOT EXISTS idx_courses_instructor ON courses(instructor_id)",
            "CREATE INDEX IF NOT EXISTS idx_courses_published ON courses(is_published)",
            "CREATE INDEX IF NOT EXISTS idx_announcements_course ON announcements(course_id, created_at)"
        ]
        
        created_count = 0
        for index_sql in indexes:
            try:
                db.session.execute(text(index_sql))
                created_count += 1
            except Exception as e:
                # Index might already exist
                pass
        
        db.session.commit()
        print(f"✅ Created/verified {created_count} indexes")

def check_database_health():
    """Check database health and report status"""
    with app.app_context():
        print("🔍 Checking database health...")
        
        # Check if tables exist
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        existing_tables = inspector.get_table_names()
        expected_tables = list(db.metadata.tables.keys())
        
        missing_tables = set(expected_tables) - set(existing_tables)
        
        print(f"   📊 Tables: {len(existing_tables)} existing, {len(expected_tables)} expected")
        
        if missing_tables:
            print(f"   ⚠️  Missing tables: {list(missing_tables)}")
            return False
        else:
            print(f"   ✅ All tables present")
        
        # Check roles
        from src.models.user_models import Role
        roles = Role.query.all()
        role_names = [r.name for r in roles]
        expected_roles = ['student', 'instructor', 'admin']
        missing_roles = set(expected_roles) - set(role_names)
        
        if missing_roles:
            print(f"   ⚠️  Missing roles: {list(missing_roles)}")
            return False
        else:
            print(f"   ✅ All roles present: {role_names}")
        
        return True

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description='Initialize Afritec Bridge LMS Database')
    parser.add_argument('--fresh', action='store_true', 
                       help='Drop all tables and recreate (WARNING: DELETES ALL DATA)')
    parser.add_argument('--check', action='store_true',
                       help='Check database status only, make no changes')
    
    args = parser.parse_args()
    
    print("\n" + "=" * 70)
    print("AFRITEC BRIDGE LMS - DATABASE INITIALIZATION")
    print("=" * 70)
    
    try:
        if args.check:
            # Check only mode
            is_healthy = check_database_health()
            print(f"\n{'✅ DATABASE STATUS: HEALTHY' if is_healthy else '⚠️  DATABASE STATUS: NEEDS ATTENTION'}")
            return is_healthy
            
        elif args.fresh:
            # Fresh installation mode
            print("🔄 FRESH DATABASE SETUP MODE")
            print("⚠️  WARNING: This will DELETE ALL EXISTING DATA!")
            
            confirm = input("\\nType 'YES' to confirm: ")
            if confirm != 'YES':
                print("❌ Operation cancelled")
                return False
            
            drop_all_tables()
            create_all_tables()
            initialize_default_data()
            create_indexes()
            
        else:
            # Safe mode - add missing only
            print("🛠️  SAFE UPDATE MODE - Adding missing tables/data only")
            create_all_tables()
            initialize_default_data()
            create_indexes()
        
        # Final health check
        print("\\n" + "-" * 50)
        is_healthy = check_database_health()
        
        print("\\n" + "=" * 70)
        if is_healthy:
            print("🎉 DATABASE INITIALIZATION COMPLETED SUCCESSFULLY!")
            print("   Your database is ready for use.")
        else:
            print("⚠️  DATABASE INITIALIZATION COMPLETED WITH WARNINGS")
            print("   Some issues were detected. Check the output above.")
        print("=" * 70)
        
        return is_healthy
        
    except Exception as e:
        print(f"\\n❌ Database initialization failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)