#!/usr/bin/env python3
"""Test modification request for specific assignment"""

import sys
import os
sys.path.append('.')

from main import app
from src.models.course_models import AssignmentSubmission, Assignment
from src.models.user_models import User
from src.models.student_models import LessonCompletion

def test_modification_logic():
    with app.app_context():
        print("🔍 Testing modification request logic...")
        
        assignment_id = 3
        student_id = 42
        user_id = 7  # instructor
        
        print(f"Testing: Assignment {assignment_id}, Student {student_id}, Instructor {user_id}")
        
        # Get assignment and verify instructor ownership
        assignment = Assignment.query.filter_by(id=assignment_id).first()
        print(f"1. Assignment found: {assignment}")
        
        if assignment:
            print(f"   Course ID: {assignment.course_id}")
            print(f"   Lesson ID: {assignment.lesson_id}")
            
            # Check course ownership
            from src.models.course_models import Course
            course = Course.query.filter_by(id=assignment.course_id, instructor_id=user_id).first()
            print(f"2. Course access check: {course}")
            
            # Get student
            student = User.query.filter_by(id=student_id).first()
            print(f"3. Student found: {student}")
            
            # Find lesson completion
            lesson_completion = LessonCompletion.query.filter_by(
                lesson_id=assignment.lesson_id,
                student_id=student_id
            ).first()
            print(f"4. Lesson completion: {lesson_completion}")
            
            # Check for assignment submission in AssignmentSubmission table
            assignment_submission = AssignmentSubmission.query.filter_by(
                assignment_id=assignment_id,
                student_id=student_id
            ).first()
            print(f"5. Assignment submission: {assignment_submission}")
            
            if assignment_submission:
                print(f"   ✅ SUBMISSION FOUND!")
                print(f"   - ID: {assignment_submission.id}")
                print(f"   - Grade: {assignment_submission.grade}")
                print(f"   - Submitted: {assignment_submission.submitted_at}")
                print(f"   - Content: {len(assignment_submission.content or '')} chars")
                
                print("\n🎯 MODIFICATION REQUEST SHOULD WORK!")
            else:
                print("   ❌ NO SUBMISSION FOUND - This explains the 400 error")
        
if __name__ == "__main__":
    test_modification_logic()