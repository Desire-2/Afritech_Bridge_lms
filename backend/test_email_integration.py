#!/usr/bin/env python3
"""
Comprehensive Email Integration Test
Tests all email scenarios in the application
"""

import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app, db
from src.models.user_models import User
from src.models.course_models import Course
from src.models.course_application import CourseApplication
from src.utils.email_utils import send_email
from src.utils.email_templates import (
    application_received_email,
    application_approved_email,
    application_rejected_email,
    application_waitlisted_email
)

def test_basic_email():
    """Test basic email sending"""
    print("\n" + "="*60)
    print("TEST 1: Basic Email Sending")
    print("="*60)
    
    with app.app_context():
        result = send_email(
            to="bikorimanadesire@yahoo.com",
            subject="✅ Test Email - Afritec Bridge LMS",
            body="This is a test email from the LMS system.",
            template="<h1>Test Email</h1><p>This is a test email from the LMS system.</p>"
        )
        
        if result:
            print("✅ Basic email sent successfully!")
        else:
            print("❌ Failed to send basic email")
        
        return result

def test_application_received_email():
    """Test application received confirmation email"""
    print("\n" + "="*60)
    print("TEST 2: Application Received Email")
    print("="*60)
    
    with app.app_context():
        # Get a test application from database
        application = CourseApplication.query.first()
        
        if not application:
            print("⚠️ No applications in database - creating mock application")
            # Create mock application for testing
            class MockApplication:
                id = 999
                full_name = "Test Applicant"
                email = "bikorimanadesire@yahoo.com"
                phone = "+250788000000"
                status = "pending"
                
                def formatted_submission_date(self):
                    return "January 1, 2026"
            
            application = MockApplication()
            course_title = "Excel for Data Analysis"
        else:
            print(f"✓ Found application #{application.id}")
            course = Course.query.get(application.course_id)
            course_title = course.title if course else "Test Course"
        
        # Generate email template
        print(f"📝 Generating email for: {application.email}")
        email_html = application_received_email(application, course_title)
        print(f"✓ Template generated ({len(email_html)} characters)")
        
        # Send email
        print(f"📤 Sending email...")
        result = send_email(
            to=application.email,
            subject=f"✅ Application Received - {course_title}",
            template=email_html
        )
        
        if result:
            print("✅ Application received email sent successfully!")
        else:
            print("❌ Failed to send application received email")
        
        return result

def test_application_approved_email():
    """Test application approval email"""
    print("\n" + "="*60)
    print("TEST 3: Application Approved Email")
    print("="*60)
    
    with app.app_context():
        # Get a test application
        application = CourseApplication.query.first()
        
        if not application:
            print("⚠️ No applications in database - skipping")
            return False
        
        course = Course.query.get(application.course_id)
        if not course:
            print("⚠️ Course not found - skipping")
            return False
        
        print(f"✓ Using application #{application.id} for course '{course.title}'")
        
        # Generate email template
        email_html = application_approved_email(
            application=application,
            course=course,
            username="testuser123",
            temp_password="TempPass123!",
            custom_message="Welcome to our course!"
        )
        print(f"✓ Template generated ({len(email_html)} characters)")
        
        # Send email
        result = send_email(
            to="bikorimanadesire@yahoo.com",  # Use test email
            subject=f"🎉 Congratulations! Welcome to {course.title}",
            template=email_html
        )
        
        if result:
            print("✅ Application approved email sent successfully!")
        else:
            print("❌ Failed to send application approved email")
        
        return result

def check_email_config():
    """Check if email configuration is properly set"""
    print("\n" + "="*60)
    print("EMAIL CONFIGURATION CHECK")
    print("="*60)
    
    with app.app_context():
        from flask import current_app
        
        config = {
            'MAIL_SERVER': current_app.config.get('MAIL_SERVER'),
            'MAIL_PORT': current_app.config.get('MAIL_PORT'),
            'MAIL_USE_TLS': current_app.config.get('MAIL_USE_TLS'),
            'MAIL_USE_SSL': current_app.config.get('MAIL_USE_SSL'),
            'MAIL_USERNAME': current_app.config.get('MAIL_USERNAME'),
            'MAIL_PASSWORD': '***' if current_app.config.get('MAIL_PASSWORD') else None,
            'MAIL_DEFAULT_SENDER': current_app.config.get('MAIL_DEFAULT_SENDER'),
        }
        
        print("\nCurrent Configuration:")
        for key, value in config.items():
            status = "✅" if value else "❌"
            print(f"{status} {key}: {value}")
        
        # Check if all required settings are present
        required = ['MAIL_SERVER', 'MAIL_PORT', 'MAIL_USERNAME', 'MAIL_PASSWORD']
        missing = [k for k in required if not current_app.config.get(k)]
        
        if missing:
            print(f"\n❌ Missing required settings: {', '.join(missing)}")
            return False
        else:
            print("\n✅ All required email settings are configured")
            return True

def main():
    """Run all email tests"""
    print("\n" + "="*60)
    print("AFRITEC BRIDGE LMS - EMAIL INTEGRATION TEST")
    print("="*60)
    
    # Check configuration first
    if not check_email_config():
        print("\n❌ Email configuration is incomplete. Please check your .env file.")
        return
    
    # Run tests
    results = {
        'basic_email': test_basic_email(),
        'application_received': test_application_received_email(),
        'application_approved': test_application_approved_email(),
    }
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All email tests passed! Email system is working correctly.")
    else:
        print(f"\n⚠️ {total - passed} test(s) failed. Check the errors above.")
    
    print("\n" + "="*60)

if __name__ == "__main__":
    main()
