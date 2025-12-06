#!/usr/bin/env python3
"""
Fix Quiz Display Issue - Create Missing Lessons and Assign Quizzes
Run this script to populate the database with lessons 1-2 and assign unassigned quizzes
"""

import sys
sys.path.insert(0, '.')

from app import app
from src.models.course_models import Lesson, Module, Quiz, db
from datetime import datetime

def create_missing_lessons():
    """Create Lessons 1 and 2 that are missing from the database"""
    print("\n🔧 Creating Missing Lessons...\n")
    
    with app.app_context():
        # Get first module
        module = Module.query.first()
        if not module:
            print("❌ No module found! Cannot create lessons without a module.")
            return False
        
        print(f"Using Module: {module.id} - {module.title}")
        
        try:
            # Create Lesson 1
            lesson1 = Lesson(
                title="Getting Started",
                description="Introduction and course overview",
                module_id=module.id,
                content_type="text",
                content_data="Welcome to this course! In this lesson, we'll cover the basics and what you'll learn.",
                order=1,
                is_published=True,
                created_at=datetime.utcnow()
            )
            
            # Create Lesson 2
            lesson2 = Lesson(
                title="Fundamentals & Basics",
                description="Learn the fundamental concepts",
                module_id=module.id,
                content_type="text",
                content_data="Understanding the fundamental concepts is key to success. Let's explore...",
                order=2,
                is_published=True,
                created_at=datetime.utcnow()
            )
            
            db.session.add(lesson1)
            db.session.add(lesson2)
            db.session.commit()
            
            print(f"✅ Lesson 1 created: ID={lesson1.id}, Title='{lesson1.title}'")
            print(f"✅ Lesson 2 created: ID={lesson2.id}, Title='{lesson2.title}'")
            
            return True
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error creating lessons: {str(e)}")
            return False

def assign_quizzes_to_lessons():
    """Assign orphaned quizzes to existing lessons and publish them"""
    print("\n📋 Assigning Quizzes to Lessons...\n")
    
    with app.app_context():
        assignments = [
            (2, 1, "Lesson 1"),   # Quiz 2 → Lesson 1
            (5, 3, "Lesson 3"),   # Quiz 5 → Lesson 3
            (6, 11, "Lesson 11"), # Quiz 6 → Lesson 11
        ]
        
        success_count = 0
        for quiz_id, lesson_id, lesson_name in assignments:
            quiz = Quiz.query.get(quiz_id)
            lesson = Lesson.query.get(lesson_id)
            
            if not quiz:
                print(f"❌ Quiz {quiz_id} not found")
                continue
                
            if not lesson:
                print(f"❌ {lesson_name} (ID {lesson_id}) not found")
                continue
            
            # Assign quiz to lesson
            quiz.lesson_id = lesson_id
            quiz.is_published = True
            
            try:
                db.session.commit()
                print(f"✅ Quiz {quiz_id} assigned to {lesson_name}")
                success_count += 1
            except Exception as e:
                db.session.rollback()
                print(f"❌ Error assigning Quiz {quiz_id}: {str(e)}")
        
        return success_count == len(assignments)

def list_all_quizzes_and_lessons():
    """List all quizzes and lessons for verification"""
    print("\n📚 Current Database State:\n")
    
    with app.app_context():
        print("LESSONS:")
        lessons = Lesson.query.all()
        for lesson in lessons:
            quiz_count = Quiz.query.filter_by(lesson_id=lesson.id).count()
            print(f"  • Lesson {lesson.id}: '{lesson.title}' - {quiz_count} quizzes")
        
        print("\nQUIZZES:")
        quizzes = Quiz.query.all()
        for quiz in quizzes:
            lesson_name = quiz.lesson.title if quiz.lesson else "NOT ASSIGNED"
            lesson_id = quiz.lesson_id if quiz.lesson_id else "None"
            published = "✅" if quiz.is_published else "❌"
            print(f"  • Quiz {quiz.id}: '{quiz.title}' → {lesson_name} (published={published})")

if __name__ == "__main__":
    print("=" * 70)
    print("QUIZ DISPLAY FIX - Database Setup Script")
    print("=" * 70)
    
    # List current state
    list_all_quizzes_and_lessons()
    
    # Ask user what to do
    print("\n" + "=" * 70)
    print("AVAILABLE FIXES:")
    print("=" * 70)
    print("1. Create missing Lessons 1-2")
    print("2. Assign orphaned Quizzes (2, 5, 6) to existing lessons")
    print("3. Both (Recommended)")
    print("4. Just list current state (no changes)")
    print("=" * 70)
    
    choice = input("\nEnter choice (1-4) [default=3]: ").strip() or "3"
    
    if choice == "1":
        if create_missing_lessons():
            print("\n✅ Lessons created successfully!")
        else:
            print("\n❌ Failed to create lessons")
            sys.exit(1)
    
    elif choice == "2":
        if assign_quizzes_to_lessons():
            print("\n✅ Quizzes assigned successfully!")
        else:
            print("\n⚠️  Some quizzes failed to assign")
    
    elif choice == "3":
        if create_missing_lessons():
            print("\n✅ Lessons created successfully!")
            if assign_quizzes_to_lessons():
                print("\n✅ Quizzes assigned successfully!")
            else:
                print("\n⚠️  Some quizzes failed to assign")
        else:
            print("\n❌ Failed to create lessons")
            sys.exit(1)
    
    elif choice == "4":
        pass
    
    else:
        print("❌ Invalid choice!")
        sys.exit(1)
    
    # Show final state
    print("\n" + "=" * 70)
    print("FINAL DATABASE STATE:")
    print("=" * 70)
    list_all_quizzes_and_lessons()
    
    print("\n" + "=" * 70)
    print("✅ Setup complete! You can now view quizzes in the lessons:")
    print("   Frontend: Navigate to /learn/1, /learn/3, or /learn/11")
    print("   API: GET /api/content-assignment/lessons/1/quiz (with auth token)")
    print("=" * 70 + "\n")
