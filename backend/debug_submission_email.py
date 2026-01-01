#!/usr/bin/env python3
"""
Debug application submission email issue
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app, db
from src.models.course_application import CourseApplication
from src.models.course_models import Course
from src.utils.email_templates import application_received_email
from src.utils.email_utils import send_email

def test_submission_email():
    """Test the exact flow that happens during application submission"""
    
    with app.app_context():
        print("="*60)
        print("APPLICATION SUBMISSION EMAIL DEBUG")
        print("="*60)
        
        # Get a test application
        application = CourseApplication.query.first()
        
        if not application:
            print("❌ No applications found in database")
            return
        
        print(f"\n✓ Using application #{application.id}")
        print(f"  Email: {application.email}")
        print(f"  Course ID: {application.course_id}")
        
        # Simulate the exact code from submit_application
        try:
            print("\n1️⃣ Fetching course...")
            course = Course.query.get(application.course_id)
            course_title = course.title if course else "our course"
            print(f"   ✓ Course: {course_title}")
            
            print(f"\n2️⃣ Preparing confirmation email for application #{application.id}")
            print(f"   Recipient: {application.email}")
            
            print("\n3️⃣ Generating email template...")
            email_html = application_received_email(application, course_title)
            print(f"   ✓ Template generated ({len(email_html)} characters)")
            
            print(f"\n4️⃣ Sending email to {application.email}...")
            email_sent = send_email(
                to=application.email,
                subject=f"✅ Application Received - {course_title}",
                template=email_html
            )
            
            if email_sent:
                print(f"   ✅ Confirmation email sent successfully!")
            else:
                print(f"   ❌ Email failed to send")
                
            return email_sent
            
        except Exception as email_error:
            print(f"\n❌ ERROR: {str(email_error)}")
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    result = test_submission_email()
    
    print("\n" + "="*60)
    if result:
        print("✅ TEST PASSED - Email would be sent on application submission")
    else:
        print("❌ TEST FAILED - Email would NOT be sent on application submission")
    print("="*60)
