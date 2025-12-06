#!/usr/bin/env python3
"""
Test the progress API endpoint to see what data is being returned.
"""

import sys
from pathlib import Path
import json

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from main import app, db
from src.models.student_models import ModuleProgress
from src.models.course_models import Module

def test_progress_endpoint():
    """Test what the progress endpoint returns."""
    with app.app_context():
        print("\n" + "="*60)
        print("TESTING PROGRESS API RESPONSE")
        print("="*60)
        
        # Get a sample module progress
        progress = ModuleProgress.query.first()
        if not progress:
            print("No module progress found!")
            return
        
        print(f"\nModule Progress ID: {progress.id}")
        print(f"Module ID: {progress.module_id}")
        print(f"Student ID: {progress.student_id}")
        
        # Get the module
        module = db.session.get(Module, progress.module_id)
        if module:
            print(f"Module Title: {module.title}")
        
        print("\n" + "-"*60)
        print("DATABASE VALUES:")
        print("-"*60)
        print(f"course_contribution_score: {progress.course_contribution_score}")
        print(f"quiz_score: {progress.quiz_score}")
        print(f"assignment_score: {progress.assignment_score}")
        print(f"final_assessment_score: {progress.final_assessment_score}")
        
        print("\n" + "-"*60)
        print("CALCULATED VALUES:")
        print("-"*60)
        lessons_avg = progress.calculate_lessons_average_score()
        cumulative = progress.calculate_cumulative_score()
        print(f"calculate_lessons_average_score(): {lessons_avg}%")
        print(f"calculate_cumulative_score(): {cumulative}%")
        
        print("\n" + "-"*60)
        print("API RESPONSE (to_dict()):")
        print("-"*60)
        response = progress.to_dict()
        print(json.dumps(response, indent=2))
        
        print("\n" + "="*60)

if __name__ == "__main__":
    test_progress_endpoint()
