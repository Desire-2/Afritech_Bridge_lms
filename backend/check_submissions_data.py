#!/usr/bin/env python3
"""
Check if there are any assignment/project submissions in the database
"""

import sys
import os

# Add the backend directory to the path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from src.models.user_models import db, User
from src.models.course_models import AssignmentSubmission, ProjectSubmission, Assignment, Project, Course
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_submissions_data():
    """Check the submissions data in the database"""
    
    try:
        # Check assignment submissions
        assignment_count = AssignmentSubmission.query.count()
        project_count = ProjectSubmission.query.count()
        assignments_count = Assignment.query.count()
        projects_count = Project.query.count()
        courses_count = Course.query.count()
        users_count = User.query.count()
        
        print(f"📊 Database Status:")
        print(f"   Users: {users_count}")
        print(f"   Courses: {courses_count}")
        print(f"   Assignments: {assignments_count}")
        print(f"   Projects: {projects_count}")
        print(f"   Assignment Submissions: {assignment_count}")
        print(f"   Project Submissions: {project_count}")
        
        # Check for instructors
        instructors = User.query.join(User.role).filter(User.role.has(name='instructor')).all()
        print(f"   Instructors: {len(instructors)}")
        
        if len(instructors) > 0:
            instructor = instructors[0]
            print(f"   Sample instructor: {instructor.first_name} {instructor.last_name} ({instructor.email})")
            
            # Check courses by this instructor
            instructor_courses = Course.query.filter_by(instructor_id=instructor.id).all()
            print(f"   Courses by instructor: {len(instructor_courses)}")
            
            for course in instructor_courses[:3]:  # Show first 3 courses
                print(f"     - {course.title}")
                
                # Check assignments in this course
                assignments = Assignment.query.filter_by(course_id=course.id).all()
                print(f"       Assignments: {len(assignments)}")
                
                for assignment in assignments[:2]:  # Show first 2 assignments
                    print(f"         - {assignment.title}")
                    submissions = AssignmentSubmission.query.filter_by(assignment_id=assignment.id).all()
                    print(f"           Submissions: {len(submissions)}")
                    
                    for submission in submissions[:3]:  # Show details of first 3 submissions
                        print(f"             * Student: {submission.student.first_name} {submission.student.last_name}")
                        print(f"               Grade: {submission.grade}")
                        print(f"               Resubmission: {submission.is_resubmission}")
                        print(f"               Submitted: {submission.submitted_at}")
        
        # Check if we have sample assignment submissions to analyze
        if assignment_count > 0:
            print(f"\n📝 Sample Assignment Submissions:")
            samples = AssignmentSubmission.query.limit(5).all()
            for sub in samples:
                print(f"   - ID: {sub.id}, Assignment: {sub.assignment.title if sub.assignment else 'N/A'}")
                print(f"     Student: {sub.student.first_name} {sub.student.last_name if sub.student else 'N/A'}")
                print(f"     Grade: {sub.grade}, Resubmission: {sub.is_resubmission}")
                print(f"     Submitted: {sub.submitted_at}")
        
        if project_count > 0:
            print(f"\n📋 Sample Project Submissions:")
            samples = ProjectSubmission.query.limit(5).all()
            for sub in samples:
                print(f"   - ID: {sub.id}, Project: {sub.project.title if sub.project else 'N/A'}")
                print(f"     Student: {sub.student.first_name} {sub.student.last_name if sub.student else 'N/A'}")
                print(f"     Grade: {sub.grade}, Resubmission: {sub.is_resubmission}")
                print(f"     Submitted: {sub.submitted_at}")
        
    except Exception as e:
        logger.error(f"Error checking submissions data: {str(e)}")
        raise

if __name__ == '__main__':
    from main import app
    
    with app.app_context():
        check_submissions_data()