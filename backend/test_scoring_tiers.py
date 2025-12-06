#!/usr/bin/env python3
"""
Test the new three-tier scoring system:
1. Lesson Score = reading + engagement + quiz + assignment
2. Module Score = average of all lesson scores
3. Course Score = average of all module scores
"""

import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from main import app, db
from src.models.student_models import LessonCompletion, ModuleProgress
from src.models.course_models import Module, Lesson, Enrollment

def test_scoring_system():
    """Test the three-tier scoring system."""
    with app.app_context():
        print("\n" + "="*80)
        print("THREE-TIER SCORING SYSTEM TEST")
        print("="*80)
        
        # Get a sample lesson completion
        completion = LessonCompletion.query.first()
        if not completion:
            print("No lesson completion found!")
            return
        
        lesson = db.session.get(Lesson, completion.lesson_id)
        
        print("\n" + "-"*80)
        print("1. LESSON SCORE (Individual Lesson)")
        print("-"*80)
        print(f"Lesson: {lesson.title if lesson else 'Unknown'}")
        print(f"Student ID: {completion.student_id}")
        print(f"\nComponents:")
        print(f"  - Reading Progress: {completion.reading_progress:.2f}%")
        print(f"  - Engagement Score: {completion.engagement_score:.2f}%")
        
        # Calculate lesson score
        lesson_score = completion.calculate_lesson_score()
        print(f"\n📊 LESSON SCORE: {lesson_score:.2f}%")
        print(f"   Formula: (reading×25%) + (engagement×25%) + (quiz×25%) + (assignment×25%)")
        
        # Get module progress
        if lesson:
            module_progress = ModuleProgress.query.filter_by(
                student_id=completion.student_id,
                module_id=lesson.module_id
            ).first()
            
            if module_progress:
                module = db.session.get(Module, module_progress.module_id)
                
                print("\n" + "-"*80)
                print("2. MODULE SCORE (All Lessons in Module)")
                print("-"*80)
                print(f"Module: {module.title if module else 'Unknown'}")
                
                # Get all lessons in module
                lessons = module.lessons.all() if module else []
                print(f"Total Lessons: {len(lessons)}")
                
                print(f"\nLesson Breakdown:")
                total = 0.0
                count = 0
                for l in lessons:
                    lc = LessonCompletion.query.filter_by(
                        student_id=completion.student_id,
                        lesson_id=l.id
                    ).first()
                    if lc:
                        ls = lc.calculate_lesson_score()
                        print(f"  - {l.title}: {ls:.2f}%")
                        total += ls
                        count += 1
                    else:
                        print(f"  - {l.title}: Not started")
                
                module_score = module_progress.calculate_module_score()
                print(f"\n📊 MODULE SCORE: {module_score:.2f}%")
                print(f"   Formula: Average of all {count} lesson scores = {total:.2f} / {count}")
                
                # Weighted score for passing
                weighted_score = module_progress.calculate_module_weighted_score()
                print(f"\n📊 MODULE WEIGHTED SCORE (for passing): {weighted_score:.2f}%")
                print(f"   Formula: (lessons×10%) + (quizzes×30%) + (assignments×40%) + (final×20%)")
                print(f"   Components:")
                print(f"     - Lessons: {module_score:.2f}% × 10% = {module_score * 0.10:.2f}%")
                print(f"     - Quizzes: {module_progress.quiz_score:.2f}% × 30% = {module_progress.quiz_score * 0.30:.2f}%")
                print(f"     - Assignments: {module_progress.assignment_score:.2f}% × 40% = {module_progress.assignment_score * 0.40:.2f}%")
                print(f"     - Final: {module_progress.final_assessment_score:.2f}% × 20% = {module_progress.final_assessment_score * 0.20:.2f}%")
                
                # Get enrollment for course score
                enrollment = Enrollment.query.filter_by(
                    student_id=completion.student_id,
                    course_id=module.course_id
                ).first()
                
                if enrollment:
                    print("\n" + "-"*80)
                    print("3. COURSE SCORE (All Modules in Course)")
                    print("-"*80)
                    print(f"Course: {enrollment.course.title if enrollment.course else 'Unknown'}")
                    
                    # Get all modules in course
                    course_modules = enrollment.course.modules.all() if enrollment.course else []
                    print(f"Total Modules: {len(course_modules)}")
                    
                    print(f"\nModule Breakdown:")
                    total_module_score = 0.0
                    module_count = 0
                    for m in course_modules:
                        mp = ModuleProgress.query.filter_by(
                            student_id=completion.student_id,
                            module_id=m.id,
                            enrollment_id=enrollment.id
                        ).first()
                        if mp:
                            ms = mp.calculate_module_score()
                            print(f"  - {m.title}: {ms:.2f}%")
                            total_module_score += ms
                            module_count += 1
                        else:
                            print(f"  - {m.title}: Not started")
                    
                    course_score = enrollment.calculate_course_score()
                    print(f"\n📊 COURSE SCORE: {course_score:.2f}%")
                    print(f"   Formula: Average of all {module_count} module scores = {total_module_score:.2f} / {module_count}")
        
        print("\n" + "="*80)
        print("SUMMARY OF SCORING TIERS")
        print("="*80)
        print("1. LESSON SCORE:")
        print("   Components: Reading (25%) + Engagement (25%) + Quiz (25%) + Assignment (25%)")
        print("   Scope: Individual lesson performance")
        print()
        print("2. MODULE SCORE:")
        print("   Components: Average of all lesson scores in the module")
        print("   Scope: Overall module performance based on lessons only")
        print()
        print("3. MODULE WEIGHTED SCORE (for passing):")
        print("   Components: Lessons (10%) + Quizzes (30%) + Assignments (40%) + Final (20%)")
        print("   Scope: Determines if student can proceed to next module")
        print("   Requirement: Must be ≥80% to pass")
        print()
        print("4. COURSE SCORE:")
        print("   Components: Average of all module scores")
        print("   Scope: Overall course performance")
        print("="*80)

if __name__ == "__main__":
    test_scoring_system()
