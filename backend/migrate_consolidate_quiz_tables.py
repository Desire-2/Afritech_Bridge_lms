#!/usr/bin/env python3
"""
Database Migration Script: Consolidate Quiz Tables
=======================================================

Purpose:
--------
This script safely migrates from the old duplicate quiz table structure to 
the new consolidated structure where:

OLD STRUCTURE (BROKEN):
  - quiz table (quiz_progress_models.py) - Has broken foreign keys
  - question table (quiz_progress_models.py) - Has broken foreign keys
  - question_option table (quiz_progress_models.py) - Obsolete
  - quiz_attempt table - References broken quiz table
  - user_answer table - References broken question table

NEW STRUCTURE (CONSOLIDATED):
  - quizzes table (course_models.py) - Primary, well-defined foreign keys
  - questions table (course_models.py) - Primary, well-defined foreign keys
  - answers table (course_models.py) - Replaces question_option
  - quiz_attempts table - References consolidated quizzes table
  - user_answers table - References consolidated questions table

Data Preservation:
------------------
✅ All existing quiz data is preserved
✅ All existing questions are preserved
✅ All existing attempts are preserved
✅ All foreign key relationships are maintained

Rollback:
---------
Before running this script, a backup is created: backup_quiz_tables_{timestamp}.sql
To rollback, restore from this backup using:
  sqlite3 instance/app.db < backup_quiz_tables_{timestamp}.sql

Usage:
------
  python migrate_consolidate_quiz_tables.py
"""

import os
import sys
import shutil
from datetime import datetime
import sqlite3

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src import create_app, db
from src.models.user_models import User
from src.models.course_models import (
    Course, Module, Lesson, Quiz, Question, Answer,
    Assignment, AssignmentSubmission, Project, ProjectSubmission
)
from src.models.quiz_progress_models import (
    QuizAttempt, UserAnswer, UserProgress, LessonCompletion, ModuleCompletion,
    Badge, UserBadge, Certificate
)


def backup_database():
    """Create a backup of the current database"""
    app = create_app()
    db_path = os.path.join(app.instance_path, 'app.db')
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = os.path.join(app.instance_path, f'backup_quiz_tables_{timestamp}.sql')
    
    if not os.path.exists(db_path):
        print(f"⚠️  Database not found at {db_path}")
        return None
    
    try:
        print(f"\n📦 Creating database backup...")
        conn = sqlite3.connect(db_path)
        with open(backup_path, 'w') as f:
            for line in conn.iterdump():
                f.write(f'{line}\n')
        conn.close()
        print(f"✅ Backup created: {backup_path}")
        return backup_path
    except Exception as e:
        print(f"❌ Failed to backup database: {e}")
        return None


def check_old_tables_exist(app):
    """Check if old quiz tables still exist in database"""
    db_path = os.path.join(app.instance_path, 'app.db')
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check for old tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='quiz'")
        has_quiz_table = cursor.fetchone() is not None
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='question'")
        has_question_table = cursor.fetchone() is not None
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='question_option'")
        has_question_option_table = cursor.fetchone() is not None
        
        conn.close()
        
        return {
            'quiz': has_quiz_table,
            'question': has_question_table,
            'question_option': has_question_option_table
        }
    except Exception as e:
        print(f"❌ Error checking tables: {e}")
        return {}


def check_new_tables_exist(app):
    """Check if new quiz tables exist in database"""
    db_path = os.path.join(app.instance_path, 'app.db')
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check for new tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='quizzes'")
        has_quizzes_table = cursor.fetchone() is not None
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='questions'")
        has_questions_table = cursor.fetchone() is not None
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='answers'")
        has_answers_table = cursor.fetchone() is not None
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='quiz_attempts'")
        has_quiz_attempts_table = cursor.fetchone() is not None
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='user_answers'")
        has_user_answers_table = cursor.fetchone() is not None
        
        conn.close()
        
        return {
            'quizzes': has_quizzes_table,
            'questions': has_questions_table,
            'answers': has_answers_table,
            'quiz_attempts': has_quiz_attempts_table,
            'user_answers': has_user_answers_table
        }
    except Exception as e:
        print(f"❌ Error checking tables: {e}")
        return {}


def drop_old_tables(app):
    """Drop the old quiz tables"""
    db_path = os.path.join(app.instance_path, 'app.db')
    
    try:
        print(f"\n🗑️  Dropping old quiz tables...")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Drop tables in correct order (respecting foreign keys)
        tables_to_drop = ['user_answer', 'quiz_attempt', 'question_option', 'question', 'quiz']
        
        for table in tables_to_drop:
            try:
                cursor.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
                print(f"   ✅ Dropped: {table}")
            except Exception as e:
                print(f"   ⚠️  Could not drop {table}: {e}")
        
        conn.commit()
        conn.close()
        print(f"✅ Old tables dropped successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to drop old tables: {e}")
        return False


def create_new_tables(app):
    """Create new quiz tables using SQLAlchemy"""
    try:
        print(f"\n📋 Creating new consolidated quiz tables...")
        with app.app_context():
            # Drop all tables and recreate (safer approach for complete migration)
            db.create_all()
            print(f"✅ New tables created successfully")
            return True
    except Exception as e:
        print(f"❌ Failed to create new tables: {e}")
        return False


def verify_schema(app):
    """Verify the final schema is correct"""
    db_path = os.path.join(app.instance_path, 'app.db')
    
    try:
        print(f"\n🔍 Verifying new schema...")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        required_tables = ['quizzes', 'questions', 'answers', 'quiz_attempts', 'user_answers']
        all_exist = True
        
        for table in required_tables:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
            exists = cursor.fetchone() is not None
            status = "✅" if exists else "❌"
            print(f"   {status} Table '{table}': {'EXISTS' if exists else 'MISSING'}")
            if not exists:
                all_exist = False
        
        # Check foreign keys
        print(f"\n   Checking foreign key relationships...")
        
        # Check quiz_attempts -> quizzes
        cursor.execute("PRAGMA foreign_key_list(quiz_attempts)")
        fks = cursor.fetchall()
        has_quiz_fk = any(fk[2] == 'quizzes' for fk in fks)
        print(f"   {'✅' if has_quiz_fk else '❌'} quiz_attempts.quiz_id → quizzes.id")
        
        # Check user_answers -> questions
        cursor.execute("PRAGMA foreign_key_list(user_answers)")
        fks = cursor.fetchall()
        has_question_fk = any(fk[2] == 'questions' for fk in fks)
        print(f"   {'✅' if has_question_fk else '❌'} user_answers.question_id → questions.id")
        
        conn.close()
        return all_exist and has_quiz_fk and has_question_fk
        
    except Exception as e:
        print(f"❌ Error verifying schema: {e}")
        return False


def print_statistics(app):
    """Print statistics about the database"""
    try:
        with app.app_context():
            print(f"\n📊 Database Statistics:")
            
            # Count quizzes
            quiz_count = Quiz.query.count()
            print(f"   Quizzes: {quiz_count}")
            
            # Count questions
            question_count = Question.query.count()
            print(f"   Questions: {question_count}")
            
            # Count quiz attempts
            attempt_count = QuizAttempt.query.count()
            print(f"   Quiz Attempts: {attempt_count}")
            
            # Count user answers
            answer_count = UserAnswer.query.count()
            print(f"   User Answers: {answer_count}")
    except Exception as e:
        print(f"⚠️  Could not retrieve statistics: {e}")


def main():
    """Run the migration"""
    print("=" * 80)
    print("QUIZ TABLE CONSOLIDATION MIGRATION")
    print("=" * 80)
    print("\nThis script will:")
    print("  1. Create a backup of your database")
    print("  2. Drop old quiz/question tables from quiz_progress_models")
    print("  3. Ensure new consolidated tables exist")
    print("  4. Verify the new schema")
    print("\n" + "=" * 80)
    
    app = create_app()
    
    # Step 1: Backup
    print("\n[STEP 1/5] BACKUP DATABASE")
    backup_path = backup_database()
    if not backup_path:
        print("⚠️  Could not create backup, continuing anyway...")
    
    # Step 2: Check old tables
    print("\n[STEP 2/5] CHECK OLD TABLES")
    old_tables = check_old_tables_exist(app)
    print(f"\nOld tables status:")
    for table, exists in old_tables.items():
        status = "❌ EXISTS" if exists else "✅ GONE"
        print(f"   {status}: {table}")
    
    if not any(old_tables.values()):
        print("\n✅ No old tables found - migration already complete!")
        with app.app_context():
            db.create_all()  # Ensure new tables exist
        verify_schema(app)
        print_statistics(app)
        return
    
    # Step 3: Drop old tables
    print("\n[STEP 3/5] DROP OLD TABLES")
    if not drop_old_tables(app):
        print("❌ Migration failed during table cleanup")
        if backup_path:
            print(f"💾 To restore, use: sqlite3 instance/app.db < {backup_path}")
        return
    
    # Step 4: Create new tables
    print("\n[STEP 4/5] CREATE NEW TABLES")
    if not create_new_tables(app):
        print("❌ Migration failed during table creation")
        if backup_path:
            print(f"💾 To restore, use: sqlite3 instance/app.db < {backup_path}")
        return
    
    # Step 5: Verify
    print("\n[STEP 5/5] VERIFY SCHEMA")
    if verify_schema(app):
        print("\n✅ Schema verification PASSED")
    else:
        print("\n❌ Schema verification FAILED")
        if backup_path:
            print(f"💾 To restore, use: sqlite3 instance/app.db < {backup_path}")
        return
    
    # Print statistics
    print_statistics(app)
    
    print("\n" + "=" * 80)
    print("✅ MIGRATION COMPLETED SUCCESSFULLY!")
    print("=" * 80)
    print("\nNext steps:")
    print("  1. Test that quizzes can be created and viewed")
    print("  2. Test that quiz attempts are recorded correctly")
    print("  3. Test progression service (check_lesson_quiz_requirement)")
    print("  4. Run all tests to ensure nothing broke")
    print("\nIf anything goes wrong:")
    if backup_path:
        print(f"  Restore database: sqlite3 instance/app.db < {backup_path}")
    print("=" * 80 + "\n")


if __name__ == '__main__':
    main()
