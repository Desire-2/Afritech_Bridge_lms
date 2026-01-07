#!/usr/bin/env python3
"""Quick script to test assignment submission lookup"""

import sys
import os
sys.path.append('.')

from main import app
from src.models.course_models import AssignmentSubmission, Assignment
from src.models.user_models import User

def test_assignment_lookup():
    with app.app_context():
        print("🔍 Testing assignment submission lookup...")
        
        # Test the specific assignment and student from the logs
        assignment_id = 3
        student_id = 42
        
        print(f"\n📋 Looking for assignment {assignment_id}, student {student_id}")
        
        # Check if assignment exists
        assignment = Assignment.query.filter_by(id=assignment_id).first()
        print(f"Assignment found: {assignment}")
        if assignment:
            print(f"  - Title: {assignment.title}")
            print(f"  - Course: {assignment.course_id}")
            print(f"  - Lesson: {assignment.lesson_id}")
        
        # Check if student exists
        student = User.query.filter_by(id=student_id).first()
        print(f"Student found: {student}")
        if student:
            print(f"  - Username: {student.username}")
            print(f"  - First name: {getattr(student, 'first_name', 'N/A')}")
            print(f"  - Last name: {getattr(student, 'last_name', 'N/A')}")
        
        # Check for assignment submission
        assignment_submission = AssignmentSubmission.query.filter_by(
            assignment_id=assignment_id,
            student_id=student_id
        ).first()
        print(f"Assignment submission found: {assignment_submission}")
        if assignment_submission:
            print(f"  - ID: {assignment_submission.id}")
            print(f"  - Submitted at: {assignment_submission.submitted_at}")
            print(f"  - Grade: {assignment_submission.grade}")
            print(f"  - Content length: {len(assignment_submission.content or '')}")
            print(f"  - File URL: {assignment_submission.file_url}")
        
        # List all submissions for this assignment
        all_submissions = AssignmentSubmission.query.filter_by(assignment_id=assignment_id).all()
        print(f"\n📊 Total submissions for assignment {assignment_id}: {len(all_submissions)}")
        for sub in all_submissions:
            print(f"  - Student {sub.student_id}: Grade {sub.grade}, Submitted {sub.submitted_at}")

if __name__ == "__main__":
    test_assignment_lookup()