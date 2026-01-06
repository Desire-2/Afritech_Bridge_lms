#!/usr/bin/env python3
"""
Script to find all foreign key references to lessons table in the database
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

def check_lesson_references():
    try:
        from models.user_models import db
        from main import app
        
        with app.app_context():
            # Query to find all foreign key constraints referencing lessons table
            result = db.session.execute("""
                SELECT 
                    name as table_name,
                    sql
                FROM sqlite_master 
                WHERE type = 'table' 
                AND sql LIKE '%lesson%'
            """)
            
            print("📋 Tables that reference lessons:")
            for row in result:
                print(f"  - {row.table_name}")
                if 'FOREIGN KEY' in row.sql and 'lesson' in row.sql.lower():
                    print(f"    SQL: {row.sql}")
            
            print("\n🔍 Checking specific table constraints...")
            # Check for any records that would prevent lesson deletion
            test_lesson_id = 229
            
            from models.student_models import LessonCompletion, StudentNote, UserProgress
            from models.course_models import Quiz, Assignment, Project
            from models.quiz_progress_models import QuizAttempt
            
            print(f"\nFor lesson ID {test_lesson_id}:")
            print(f"  LessonCompletion: {LessonCompletion.query.filter_by(lesson_id=test_lesson_id).count()}")
            print(f"  StudentNote: {StudentNote.query.filter_by(lesson_id=test_lesson_id).count()}")
            print(f"  UserProgress (current_lesson): {UserProgress.query.filter_by(current_lesson_id=test_lesson_id).count()}")
            print(f"  Quiz: {Quiz.query.filter_by(lesson_id=test_lesson_id).count()}")
            print(f"  Assignment: {Assignment.query.filter_by(lesson_id=test_lesson_id).count()}")
            print(f"  Project: {Project.query.filter_by(lesson_id=test_lesson_id).count()}")
            
            # Check for quiz attempts on lesson quizzes
            quiz_ids = [q.id for q in Quiz.query.filter_by(lesson_id=test_lesson_id).all()]
            if quiz_ids:
                quiz_attempts = QuizAttempt.query.filter(QuizAttempt.quiz_id.in_(quiz_ids)).count()
                print(f"  QuizAttempt (for lesson quizzes): {quiz_attempts}")
                
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_lesson_references()