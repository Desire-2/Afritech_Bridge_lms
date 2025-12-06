#!/usr/bin/env python3
"""
Recalculate all module scores using the new lesson-based scoring system.
"""

import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from main import app, db
from src.models.student_models import ModuleProgress
from src.services.progression_service import ProgressionService

def recalculate_all_module_scores():
    """Recalculate scores for all existing module progresses."""
    with app.app_context():
        print("\n" + "="*60)
        print("RECALCULATING ALL MODULE SCORES")
        print("="*60)
        
        # Get all module progresses
        all_progresses = ModuleProgress.query.all()
        print(f"\nFound {len(all_progresses)} module progresses to recalculate")
        
        updated_count = 0
        
        for progress in all_progresses:
            print(f"\nModule {progress.module_id} (Student {progress.student_id}):")
            
            # Get old scores
            old_course_contribution = progress.course_contribution_score or 0
            old_cumulative = progress.calculate_cumulative_score()
            
            # Recalculate using the service
            ProgressionService._update_course_contribution_score(
                progress.student_id,
                progress.module_id,
                progress.enrollment_id
            )
            
            # Refresh from database to get updated values
            db.session.refresh(progress)
            
            # Get new scores
            new_course_contribution = progress.course_contribution_score or 0
            new_cumulative = progress.calculate_cumulative_score()
            
            print(f"  Course Contribution: {old_course_contribution:.2f}% → {new_course_contribution:.2f}%")
            print(f"  Cumulative Score: {old_cumulative:.2f}% → {new_cumulative:.2f}%")
            
            if old_course_contribution != new_course_contribution:
                updated_count += 1
        
        print(f"\n✅ Updated {updated_count} module scores")
        print("\n🎉 Recalculation completed successfully!")
        return True

if __name__ == "__main__":
    print("=" * 60)
    print("Starting Module Score Recalculation")
    print("=" * 60)
    print()
    
    success = recalculate_all_module_scores()
    
    if success:
        print("\nRecalculation completed successfully! ✅")
        sys.exit(0)
    else:
        print("\nRecalculation failed ❌")
        sys.exit(1)
