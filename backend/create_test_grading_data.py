#!/usr/bin/env python3
"""
Create test resubmission and modification request data
"""

import sys
import os

# Add the backend directory to the path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from src.models.user_models import db, User
from src.models.course_models import AssignmentSubmission, Assignment
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_test_data():
    """Create test resubmission and modification request data"""
    
    try:
        # Get some existing submissions
        submissions = AssignmentSubmission.query.limit(5).all()
        
        if len(submissions) < 2:
            print("❌ Not enough submissions to create test data")
            return
        
        # Create a resubmission
        original_submission = submissions[0]
        if not original_submission.is_resubmission:
            print(f"📝 Creating resubmission for submission {original_submission.id}")
            
            # Mark the first submission as a resubmission
            original_submission.is_resubmission = True
            original_submission.resubmission_count = 1
            original_submission.submission_notes = "Fixed the calculations and added missing charts as requested."
            
            db.session.add(original_submission)
        
        # Set modification request on an assignment
        assignment_with_submissions = Assignment.query.join(AssignmentSubmission).first()
        if assignment_with_submissions and not assignment_with_submissions.modification_requested:
            print(f"✏️ Setting modification request on assignment: {assignment_with_submissions.title}")
            
            assignment_with_submissions.modification_requested = True
            assignment_with_submissions.modification_request_reason = "Please revise the data analysis section to include more detailed explanations of the formulas used and add proper charts to visualize the results."
            assignment_with_submissions.modification_requested_at = datetime.utcnow()
            
            # Set it to the instructor (get first instructor)
            instructor = User.query.join(User.role).filter(User.role.has(name='instructor')).first()
            if instructor:
                assignment_with_submissions.modification_requested_by = instructor.id
            
            assignment_with_submissions.can_resubmit = True
            
            db.session.add(assignment_with_submissions)
        
        # Create another resubmission from a different submission
        if len(submissions) > 1:
            second_submission = submissions[1]
            if not second_submission.is_resubmission:
                print(f"📝 Creating second resubmission for submission {second_submission.id}")
                
                second_submission.is_resubmission = True
                second_submission.resubmission_count = 2  # This is the second resubmission
                second_submission.submission_notes = "Corrected all the Excel formulas and added the requested pivot tables. Also improved the formatting as discussed."
                
                db.session.add(second_submission)
        
        # Commit all changes
        db.session.commit()
        print("✅ Test data created successfully!")
        
        # Show what we created
        print("\n📊 Updated Data Summary:")
        resubmission_count = AssignmentSubmission.query.filter_by(is_resubmission=True).count()
        modification_requests = Assignment.query.filter_by(modification_requested=True).count()
        
        print(f"   Resubmissions: {resubmission_count}")
        print(f"   Modification Requests: {modification_requests}")
        
        # Show details
        if resubmission_count > 0:
            print("\n📝 Resubmissions:")
            resubmissions = AssignmentSubmission.query.filter_by(is_resubmission=True).all()
            for resub in resubmissions:
                print(f"   - ID: {resub.id}, Student: {resub.student.first_name} {resub.student.last_name}")
                print(f"     Assignment: {resub.assignment.title}")
                print(f"     Notes: {resub.submission_notes}")
                print(f"     Count: {resub.resubmission_count}")
        
        if modification_requests > 0:
            print("\n✏️ Modification Requests:")
            mod_requests = Assignment.query.filter_by(modification_requested=True).all()
            for mod in mod_requests:
                print(f"   - Assignment: {mod.title}")
                print(f"     Reason: {mod.modification_request_reason}")
                print(f"     Can Resubmit: {mod.can_resubmit}")
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating test data: {str(e)}")
        raise

if __name__ == '__main__':
    from main import app
    
    with app.app_context():
        create_test_data()