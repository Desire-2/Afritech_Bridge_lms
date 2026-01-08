#!/usr/bin/env python3

"""
Test script for modification request notifications
"""

import sys
import os
from datetime import datetime, timedelta

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import app
from src.utils.email_notifications import (
    send_modification_request_notification,
    send_resubmission_notification,
    send_admin_modification_alert,
    send_modification_digest
)

def test_modification_notification():
    """Test sending a modification request notification"""
    with app.app_context():
        print("🔍 Testing modification request notification...")
        
        due_date = (datetime.now() + timedelta(days=7)).strftime('%B %d, %Y')
        
        success = send_modification_request_notification(
            student_email="student@test.com",
            student_name="Test Student",
            assignment_title="Python Fundamentals Assignment",
            instructor_name="Dr. Smith",
            reason="Please improve the code structure and add more comments to explain your logic. Also, ensure all functions have proper docstrings.",
            course_title="Introduction to Programming",
            is_project=False,
            assignment_id=123,
            due_date=due_date,
            frontend_url="http://localhost:3000"
        )
        
        if success:
            print("✅ Modification request notification test passed")
        else:
            print("❌ Modification request notification test failed")
        
        return success

def test_resubmission_notification():
    """Test sending a resubmission notification"""
    with app.app_context():
        print("🔍 Testing resubmission notification...")
        
        success = send_resubmission_notification(
            instructor_email="instructor@test.com",
            instructor_name="Dr. Smith",
            student_name="Test Student",
            assignment_title="Python Fundamentals Assignment",
            course_title="Introduction to Programming",
            is_project=False,
            assignment_id=123,
            frontend_url="http://localhost:3000",
            submission_notes="I've improved the code structure as requested and added comprehensive comments and docstrings."
        )
        
        if success:
            print("✅ Resubmission notification test passed")
        else:
            print("❌ Resubmission notification test failed")
        
        return success

def test_admin_alert():
    """Test sending an admin alert"""
    with app.app_context():
        print("🔍 Testing admin alert notification...")
        
        success = send_admin_modification_alert(
            admin_email="admin@test.com",
            instructor_name="Dr. Smith",
            student_name="Test Student",
            assignment_title="Python Fundamentals Assignment",
            course_title="Introduction to Programming",
            reason="Code structure needs improvement and more comments",
            is_project=False
        )
        
        if success:
            print("✅ Admin alert notification test passed")
        else:
            print("❌ Admin alert notification test failed")
        
        return success

def test_digest_notification():
    """Test sending a modification digest"""
    with app.app_context():
        print("🔍 Testing modification digest notification...")
        
        modifications = [
            {
                'course_title': 'Introduction to Programming',
                'assignment_title': 'Python Fundamentals',
                'student_name': 'Test Student 1',
                'instructor_name': 'Dr. Smith',
                'status': 'Pending'
            },
            {
                'course_title': 'Web Development',
                'assignment_title': 'JavaScript Project',
                'student_name': 'Test Student 2',
                'instructor_name': 'Prof. Johnson',
                'status': 'Resubmitted'
            },
            {
                'course_title': 'Data Science',
                'assignment_title': 'Data Analysis Project',
                'student_name': 'Test Student 3',
                'instructor_name': 'Dr. Brown',
                'status': 'Completed'
            }
        ]
        
        success = send_modification_digest(
            recipient_email="admin@test.com",
            recipient_name="System Administrator",
            modifications=modifications,
            period="daily"
        )
        
        if success:
            print("✅ Modification digest test passed")
        else:
            print("❌ Modification digest test failed")
        
        return success

def run_all_tests():
    """Run all notification tests"""
    print("🧪 Testing Modification Request Notifications")
    print("=" * 50)
    
    tests = [
        test_modification_notification,
        test_resubmission_notification,
        test_admin_alert,
        test_digest_notification
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed successfully!")
        return True
    else:
        print("⚠️ Some tests failed. Check email configuration and logs.")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_type = sys.argv[1].lower()
        
        if test_type == "modification":
            test_modification_notification()
        elif test_type == "resubmission":
            test_resubmission_notification()
        elif test_type == "admin":
            test_admin_alert()
        elif test_type == "digest":
            test_digest_notification()
        else:
            print(f"Unknown test type: {test_type}")
            print("Available tests: modification, resubmission, admin, digest")
    else:
        run_all_tests()