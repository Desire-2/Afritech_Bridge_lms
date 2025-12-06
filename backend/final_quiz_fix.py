#!/usr/bin/env python3
"""
Final Fix: Assign Quiz 2 to Lesson 14 and publish it
"""

import sys
sys.path.insert(0, '.')

from app import app
from src.models.course_models import Quiz, Lesson, db

def assign_quiz_2_to_lesson_14():
    """Assign Quiz 2 to the newly created Lesson 14"""
    print("\n📋 Assigning Quiz 2 to Lesson 14...\n")
    
    with app.app_context():
        quiz2 = Quiz.query.get(2)
        lesson14 = Lesson.query.get(14)
        
        if not quiz2:
            print("❌ Quiz 2 not found!")
            return False
            
        if not lesson14:
            print("❌ Lesson 14 not found!")
            return False
        
        try:
            # Assign quiz to lesson and publish
            quiz2.lesson_id = 14
            quiz2.is_published = True
            
            db.session.commit()
            
            print(f"✅ Quiz 2 assigned to Lesson 14")
            print(f"   Quiz Title: {quiz2.title}")
            print(f"   Lesson: {lesson14.title}")
            print(f"   Published: {quiz2.is_published}")
            
            return True
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error: {str(e)}")
            return False

if __name__ == "__main__":
    print("=" * 70)
    print("FINAL FIX - Assign Quiz 2 to Lesson 14")
    print("=" * 70)
    
    if assign_quiz_2_to_lesson_14():
        print("\n" + "=" * 70)
        print("✅ ALL QUIZZES NOW ASSIGNED!")
        print("=" * 70)
        print("\n📚 Lessons with Quizzes:")
        print("  • /learn/3  - 4 quizzes")
        print("  • /learn/11 - 2 quizzes")  
        print("  • /learn/14 - 1 quiz (new 'Getting Started' lesson)")
        print("  • /learn/15 - 0 quizzes (new 'Fundamentals' lesson)")
        print("=" * 70 + "\n")
    else:
        print("❌ Fix failed!")
        sys.exit(1)
