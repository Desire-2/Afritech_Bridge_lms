#!/usr/bin/env python3
"""
Debug script to test and verify the full credit service is working properly
"""

import os
import sys

# Add the backend directory to Python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

from src.models.user_models import db, User
from src.models.course_models import Module, Lesson, Quiz, Assignment
from src.models.student_models import LessonCompletion, ModuleProgress
from src.models.quiz_progress_models import QuizAttempt
from src.services.full_credit_service import FullCreditService
from datetime import datetime
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def debug_module_components(module_id: int):
    """Debug what components exist in a module"""
    print(f"\n🔍 DEBUGGING MODULE {module_id} COMPONENTS")
    print("=" * 60)
    
    # Get module info
    module = Module.query.get(module_id)
    if not module:
        print(f"❌ Module {module_id} not found!")
        return None
        
    print(f"📚 Module: {module.title}")
    print(f"Course ID: {module.course_id}")
    
    # Get lessons
    lessons = Lesson.query.filter_by(module_id=module_id).all()
    print(f"\n📖 LESSONS ({len(lessons)}):")
    for lesson in lessons:
        print(f"  - Lesson {lesson.id}: {lesson.title}")
    
    # Get quizzes
    quizzes = Quiz.query.filter_by(module_id=module_id).all()
    print(f"\n🧪 QUIZZES ({len(quizzes)}):")
    for quiz in quizzes:
        print(f"  - Quiz {quiz.id}: {quiz.title}")
    
    # Get assignments
    assignments = Assignment.query.filter_by(module_id=module_id).all()
    print(f"\n📝 ASSIGNMENTS ({len(assignments)}):")
    for assignment in assignments:
        print(f"  - Assignment {assignment.id}: {assignment.title}")
    
    return {
        'lessons': lessons,
        'quizzes': quizzes, 
        'assignments': assignments
    }

def debug_student_progress_before(student_id: int, module_id: int):
    """Check student progress before full credit"""
    print(f"\n📊 BEFORE - Student {student_id} progress in Module {module_id}")
    print("=" * 60)
    
    # Check lesson completions
    lesson_completions = LessonCompletion.query.filter_by(student_id=student_id).join(
        Lesson, LessonCompletion.lesson_id == Lesson.id
    ).filter(Lesson.module_id == module_id).all()
    
    print(f"📖 Lesson Completions ({len(lesson_completions)}):")
    for completion in lesson_completions:
        print(f"  - Lesson {completion.lesson_id}: completed={completion.completed}, score={completion.lesson_score}")
    
    # Check quiz attempts
    quiz_attempts = QuizAttempt.query.filter_by(user_id=student_id).join(
        Quiz, QuizAttempt.quiz_id == Quiz.id
    ).filter(Quiz.module_id == module_id).all()
    
    print(f"\n🧪 Quiz Attempts ({len(quiz_attempts)}):")
    for attempt in quiz_attempts:
        print(f"  - Quiz {attempt.quiz_id}: score={attempt.score}, status={attempt.status}")
    
    # Check module progress
    module_progress = ModuleProgress.query.filter_by(
        student_id=student_id, 
        module_id=module_id
    ).first()
    
    print(f"\n📈 Module Progress:")
    if module_progress:
        print(f"  - Status: {getattr(module_progress, 'status', 'N/A')}")
        print(f"  - Cumulative Score: {getattr(module_progress, 'cumulative_score', 'N/A')}")
        print(f"  - Quiz Score: {getattr(module_progress, 'quiz_score', 'N/A')}")
        print(f"  - Assignment Score: {getattr(module_progress, 'assignment_score', 'N/A')}")
    else:
        print("  - No module progress found")

def debug_student_progress_after(student_id: int, module_id: int):
    """Check student progress after full credit"""
    print(f"\n📊 AFTER - Student {student_id} progress in Module {module_id}")
    print("=" * 60)
    
    # Refresh the session to get updated data
    db.session.expire_all()
    
    # Check lesson completions
    lesson_completions = LessonCompletion.query.filter_by(student_id=student_id).join(
        Lesson, LessonCompletion.lesson_id == Lesson.id
    ).filter(Lesson.module_id == module_id).all()
    
    print(f"📖 Lesson Completions ({len(lesson_completions)}):")
    for completion in lesson_completions:
        print(f"  - Lesson {completion.lesson_id}: completed={completion.completed}, score={completion.lesson_score}")
    
    # Check quiz attempts  
    quiz_attempts = QuizAttempt.query.filter_by(user_id=student_id).join(
        Quiz, QuizAttempt.quiz_id == Quiz.id
    ).filter(Quiz.module_id == module_id).all()
    
    print(f"\n🧪 Quiz Attempts ({len(quiz_attempts)}):")
    for attempt in quiz_attempts:
        print(f"  - Quiz {attempt.quiz_id}: score={attempt.score}, status={attempt.status}")
    
    # Check module progress
    module_progress = ModuleProgress.query.filter_by(
        student_id=student_id, 
        module_id=module_id
    ).first()
    
    print(f"\n📈 Module Progress:")
    if module_progress:
        print(f"  - Status: {getattr(module_progress, 'status', 'N/A')}")
        print(f"  - Cumulative Score: {getattr(module_progress, 'cumulative_score', 'N/A')}")
        print(f"  - Quiz Score: {getattr(module_progress, 'quiz_score', 'N/A')}")
        print(f"  - Assignment Score: {getattr(module_progress, 'assignment_score', 'N/A')}")
    else:
        print("  - No module progress found")

def test_full_credit_service(student_id: int, module_id: int, instructor_id: int, enrollment_id: int):
    """Test the full credit service with detailed debugging"""
    
    print(f"🧪 TESTING FULL CREDIT SERVICE")
    print("=" * 60)
    print(f"Student ID: {student_id}")
    print(f"Module ID: {module_id}")
    print(f"Instructor ID: {instructor_id}")
    print(f"Enrollment ID: {enrollment_id}")
    
    # Debug module components
    components = debug_module_components(module_id)
    if not components:
        return
    
    # Check progress before
    debug_student_progress_before(student_id, module_id)
    
    # Award full credit
    print(f"\n🎯 AWARDING FULL CREDIT...")
    print("-" * 40)
    
    try:
        result = FullCreditService.give_module_full_credit(
            student_id=student_id,
            module_id=module_id,
            instructor_id=instructor_id,
            enrollment_id=enrollment_id
        )
        
        print(f"📋 RESULT: {result}")
        
        if result.get('success'):
            print("✅ Full credit service reported SUCCESS")
            print(f"📊 Details: {result.get('details', {})}")
        else:
            print("❌ Full credit service reported FAILURE")
            print(f"Error: {result.get('message')}")
            return
            
    except Exception as e:
        print(f"💥 EXCEPTION during full credit: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # Check progress after
    debug_student_progress_after(student_id, module_id)

if __name__ == "__main__":
    print("🔬 FULL CREDIT DEBUG SCRIPT")
    print("=" * 60)
    
    # Get user input for test parameters
    try:
        student_id = int(input("Enter Student ID: "))
        module_id = int(input("Enter Module ID: "))
        instructor_id = int(input("Enter Instructor ID: "))
        enrollment_id = int(input("Enter Enrollment ID: "))
        
        # Set up Flask app context
        from main import app
        with app.app_context():
            test_full_credit_service(student_id, module_id, instructor_id, enrollment_id)
            
    except KeyboardInterrupt:
        print("\n👋 Debug cancelled by user")
    except Exception as e:
        print(f"💥 Debug script error: {e}")
        import traceback
        traceback.print_exc()