#!/usr/bin/env python3
"""
Complete a course for a specific student in a specific cohort.
Usage: python complete_course_for_student.py <student_id> <course_id> <cohort_label>
"""
import sys
import os
from datetime import datetime

# Setup path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

from main import app, db
from src.models.user_models import User
from src.models.course_models import Course, Enrollment, Module
from src.models.student_models import LessonCompletion, ModuleProgress

def complete_course(student_id, course_id, cohort_label=None):
    """Complete a course for a student."""
    with app.app_context():
        # Get student
        student = User.query.get(student_id)
        if not student:
            print(f"❌ Student {student_id} not found")
            return False
        
        print(f"✓ Student: {student.first_name} {student.last_name} (ID: {student_id})")
        
        # Get course
        course = Course.query.get(course_id)
        if not course:
            print(f"❌ Course {course_id} not found")
            return False
        
        print(f"✓ Course: {course.title} (ID: {course_id})")
        
        # Get enrollment
        query = Enrollment.query.filter_by(student_id=student_id, course_id=course_id)
        if cohort_label:
            query = query.filter_by(cohort_label=cohort_label)
            print(f"✓ Cohort: {cohort_label}")
        
        enrollment = query.first()
        if not enrollment:
            print(f"❌ Enrollment not found for student {student_id} in course {course_id}")
            if cohort_label:
                print(f"   (with cohort label: {cohort_label})")
            return False
        
        print(f"✓ Enrollment found (current progress: {enrollment.progress*100:.1f}%)")
        
        # Get all modules in the course
        modules = Module.query.filter_by(course_id=course_id).all()
        print(f"✓ Course has {len(modules)} module(s)")
        
        # Mark all modules as completed
        for module in modules:
            # Update or create module progress
            module_progress = ModuleProgress.query.filter_by(
                student_id=student_id,
                module_id=module.id,
                enrollment_id=enrollment.id
            ).first()
            
            if not module_progress:
                # Create module progress if it doesn't exist
                module_progress = ModuleProgress(
                    student_id=student_id,
                    module_id=module.id,
                    enrollment_id=enrollment.id
                )
                db.session.add(module_progress)
            
            # Set module as completed
            module_progress.status = 'completed'
            module_progress.cumulative_score = 100.0
            module_progress.quiz_score = 100.0
            module_progress.assignment_score = 100.0
            module_progress.final_assessment_score = 100.0
            module_progress.course_contribution_score = 100.0
            module_progress.completed_at = datetime.utcnow()
            module_progress.prerequisites_met = True
            
            # Mark all lessons in this module as completed
            lessons = module.lessons.all()
            for lesson in lessons:
                lesson_completion = LessonCompletion.query.filter_by(
                    student_id=student_id,
                    lesson_id=lesson.id
                ).first()
                
                if not lesson_completion:
                    lesson_completion = LessonCompletion(
                        student_id=student_id,
                        lesson_id=lesson.id
                    )
                    db.session.add(lesson_completion)
                
                # Mark lesson as completed
                lesson_completion.completed = True
                lesson_completion.completed_at = datetime.utcnow()
                lesson_completion.reading_progress = 100.0
                lesson_completion.engagement_score = 100.0
                lesson_completion.scroll_progress = 100.0
                lesson_completion.video_progress = 100.0
                lesson_completion.video_completed = True
                lesson_completion.lesson_score = 100.0
                lesson_completion.time_spent = 3600  # 1 hour default
            
            print(f"  ✓ Module '{module.title}': marked as completed with all lessons")
        
        # Update enrollment
        enrollment.progress = 1.0  # 100% complete
        enrollment.status = 'completed'
        enrollment.completed_at = datetime.utcnow()
        
        # Save all changes
        db.session.commit()
        
        print(f"\n✅ SUCCESS: Course '{course.title}' completed for {student.first_name} {student.last_name}")
        print(f"   • Course progress: 100%")
        print(f"   • Status: completed")
        print(f"   • Completed at: {enrollment.completed_at}")
        
        return True

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python complete_course_for_student.py <student_id> <course_id> [cohort_label]")
        print("\nExample:")
        print("  python complete_course_for_student.py 42 1 'Cohort 1 ABX'")
        sys.exit(1)
    
    student_id = int(sys.argv[1])
    course_id = int(sys.argv[2])
    cohort_label = sys.argv[3] if len(sys.argv) > 3 else None
    
    success = complete_course(student_id, course_id, cohort_label)
    sys.exit(0 if success else 1)
