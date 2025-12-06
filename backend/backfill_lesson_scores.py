#!/usr/bin/env python3
"""
Backfill engagement_score for existing lesson completions.

This script updates all LessonCompletion records that have:
- engagement_score = 0 or NULL
- completed = True (or reading_progress > 0)

Sets engagement_score to reading_progress or 100 as fallback.
"""

import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from main import app, db
from src.models.student_models import LessonCompletion, ModuleProgress
from src.services.progression_service import ProgressionService
from sqlalchemy import or_, and_

def backfill_lesson_scores():
    """Backfill engagement_score for existing lesson completions."""
    with app.app_context():
        # Find all lesson completions with missing or zero engagement_score
        completions = LessonCompletion.query.filter(
            or_(
                LessonCompletion.engagement_score == None,
                LessonCompletion.engagement_score == 0
            ),
            or_(
                LessonCompletion.completed == True,
                LessonCompletion.reading_progress > 0
            )
        ).all()
        
        print(f"Found {len(completions)} lesson completions to update")
        
        updated_count = 0
        modules_to_recalculate = set()
        
        for completion in completions:
            # Set engagement_score based on reading_progress or default to 100
            old_score = completion.engagement_score or 0
            completion.engagement_score = completion.reading_progress or 100.0
            
            # Ensure completed flag is set if reading_progress > 0
            if completion.reading_progress and completion.reading_progress >= 100 and not completion.completed:
                completion.completed = True
            
            print(f"  Lesson ID {completion.lesson_id} (Student {completion.student_id}): {old_score:.1f}% → {completion.engagement_score:.1f}%")
            
            updated_count += 1
            
            # Track modules that need score recalculation
            lesson = completion.lesson
            if lesson:
                modules_to_recalculate.add((completion.student_id, lesson.module_id))
        
        # Commit lesson completion updates
        try:
            db.session.commit()
            print(f"\n✅ Updated {updated_count} lesson completions")
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Failed to update lesson completions: {str(e)}")
            return False
        
        # Recalculate module scores
        print(f"\nRecalculating scores for {len(modules_to_recalculate)} module progresses...")
        
        recalc_count = 0
        for user_id, module_id in modules_to_recalculate:
            module_progress = ModuleProgress.query.filter_by(
                student_id=user_id,
                module_id=module_id
            ).first()
            
            if module_progress:
                # Get enrollment_id
                from src.models.course_models import Module, Enrollment
                module = Module.query.get(module_id)
                if module:
                    enrollment = Enrollment.query.filter_by(
                        student_id=user_id,
                        course_id=module.course_id
                    ).first()
                    
                    if enrollment:
                        old_score = module_progress.course_contribution_score or 0
                        ProgressionService._update_course_contribution_score(
                            user_id, module_id, enrollment.id
                        )
                        new_score = module_progress.course_contribution_score or 0
                        print(f"  Module {module_id} (User {user_id}): {old_score:.1f}% → {new_score:.1f}%")
                        recalc_count += 1
        
        # Commit module score updates
        try:
            db.session.commit()
            print(f"\n✅ Recalculated {recalc_count} module scores")
            print("\n🎉 Backfill completed successfully!")
            return True
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Failed to recalculate module scores: {str(e)}")
            return False

if __name__ == "__main__":
    print("=" * 60)
    print("Starting Lesson Score Backfill")
    print("=" * 60)
    print()
    
    success = backfill_lesson_scores()
    
    if success:
        print("\nBackfill completed successfully! ✅")
        sys.exit(0)
    else:
        print("\nBackfill failed ❌")
        sys.exit(1)
