#!/usr/bin/env python3
"""
Inspect existing lesson completion data to understand the database state.
"""

import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from main import app, db
from src.models.student_models import LessonCompletion, ModuleProgress
from src.models.course_models import Module, Lesson
from sqlalchemy import func

def inspect_data():
    """Inspect lesson completion and module progress data."""
    with app.app_context():
        print("\n" + "="*60)
        print("LESSON COMPLETION ANALYSIS")
        print("="*60)
        
        # Total lesson completions
        total_completions = LessonCompletion.query.count()
        print(f"\n📊 Total lesson completions: {total_completions}")
        
        # Completions by engagement_score status
        null_engagement = LessonCompletion.query.filter(
            LessonCompletion.engagement_score == None
        ).count()
        zero_engagement = LessonCompletion.query.filter(
            LessonCompletion.engagement_score == 0
        ).count()
        nonzero_engagement = LessonCompletion.query.filter(
            LessonCompletion.engagement_score > 0
        ).count()
        
        print(f"\n📈 Engagement Score Distribution:")
        print(f"  - NULL: {null_engagement}")
        print(f"  - Zero (0): {zero_engagement}")
        print(f"  - Non-zero (>0): {nonzero_engagement}")
        
        # Completions by completed flag
        completed_true = LessonCompletion.query.filter(
            LessonCompletion.completed == True
        ).count()
        completed_false = LessonCompletion.query.filter(
            LessonCompletion.completed == False
        ).count()
        
        print(f"\n✅ Completed Flag Distribution:")
        print(f"  - True: {completed_true}")
        print(f"  - False: {completed_false}")
        
        # Sample records
        print(f"\n📋 Sample Records (first 10):")
        samples = LessonCompletion.query.limit(10).all()
        for completion in samples:
            lesson = db.session.get(Lesson, completion.lesson_id)
            print(f"\n  Lesson {completion.lesson_id} (Student {completion.student_id}):")
            if lesson:
                print(f"    - Lesson Title: {lesson.title}")
            print(f"    - Completed: {completion.completed}")
            print(f"    - Reading Progress: {completion.reading_progress}%")
            print(f"    - Engagement Score: {completion.engagement_score}%")
            print(f"    - Time Spent: {completion.time_spent}s")
        
        print("\n" + "="*60)
        print("MODULE PROGRESS ANALYSIS")
        print("="*60)
        
        # Total module progresses
        total_progresses = ModuleProgress.query.count()
        print(f"\n📊 Total module progresses: {total_progresses}")
        
        # Module progress scores
        print(f"\n📈 Module Scores:")
        progresses = ModuleProgress.query.all()
        for progress in progresses:
            module = db.session.get(Module, progress.module_id)
            print(f"\n  Module {progress.module_id} (Student {progress.student_id}):")
            if module:
                print(f"    - Module Title: {module.title}")
            print(f"    - Course Contribution: {progress.course_contribution_score}%")
            print(f"    - Quiz Score: {progress.quiz_score}%")
            print(f"    - Assignment Score: {progress.assignment_score}%")
            print(f"    - Final Assessment Score: {progress.final_assessment_score}%")
            
            # Calculate lessons average manually
            cumulative = progress.calculate_cumulative_score()
            lessons_avg = progress.calculate_lessons_average_score()
            print(f"    - Cumulative Score: {cumulative}%")
            print(f"    - Lessons Average (manual calc): {lessons_avg}%")
        
        print("\n" + "="*60)

if __name__ == "__main__":
    inspect_data()
