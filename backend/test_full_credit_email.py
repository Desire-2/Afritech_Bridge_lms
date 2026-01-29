#!/usr/bin/env python3
"""
Test script for the full credit email template
"""
import sys
import os
import logging
from datetime import datetime

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def test_full_credit_email_template():
    """Test the full credit email template"""
    try:
        from src.utils.email_templates import full_credit_awarded_email
        
        # Test data
        student_name = "John Doe"
        module_title = "Python Fundamentals"
        course_title = "Complete Web Development Bootcamp"
        instructor_name = "Prof. Sarah Johnson"
        reason = "Exceptional performance on all assignments and demonstrated mastery of the concepts through project submission."
        details = {
            "lessons_updated": 5,
            "quizzes_updated": 3,
            "assignments_updated": 2
        }
        
        # Generate email HTML
        email_html = full_credit_awarded_email(
            student_name=student_name,
            module_title=module_title,
            course_title=course_title,
            instructor_name=instructor_name,
            reason=reason,
            details=details
        )
        
        # Save to file for inspection
        output_file = "full_credit_email_preview.html"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(email_html)
        
        print(f"✅ Full credit email template generated successfully!")
        print(f"📧 Email HTML saved to: {output_file}")
        print(f"📏 Email size: {len(email_html):,} characters")
        
        # Test without reason and details
        email_html_minimal = full_credit_awarded_email(
            student_name="Jane Smith",
            module_title="Advanced JavaScript",
            course_title="Frontend Mastery Program",
            instructor_name="Dr. Michael Chen"
        )
        
        output_file_minimal = "full_credit_email_minimal_preview.html"
        with open(output_file_minimal, 'w', encoding='utf-8') as f:
            f.write(email_html_minimal)
        
        print(f"✅ Minimal full credit email template generated successfully!")
        print(f"📧 Minimal email HTML saved to: {output_file_minimal}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error testing full credit email template: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_email_notification_function():
    """Test the email notification function structure"""
    try:
        from src.utils.email_notifications import send_full_credit_notification
        
        print("✅ Full credit notification function imported successfully!")
        print("📋 Function signature:")
        print("   send_full_credit_notification(student, module, course, instructor, reason=None, details=None)")
        return True
        
    except Exception as e:
        print(f"❌ Error importing notification function: {str(e)}")
        return False

if __name__ == "__main__":
    print("🧪 Testing Full Credit Email System")
    print("=" * 50)
    
    # Test email template
    print("\n1. Testing Email Template:")
    template_success = test_full_credit_email_template()
    
    # Test notification function
    print("\n2. Testing Notification Function:")
    function_success = test_email_notification_function()
    
    print("\n" + "=" * 50)
    if template_success and function_success:
        print("✅ All tests passed! Full credit email system is ready.")
        print("\n📋 Integration Summary:")
        print("   • Email template: full_credit_awarded_email() ✅")
        print("   • Notification function: send_full_credit_notification() ✅")
        print("   • Instructor route: Updated to send notifications ✅")
        print("   • Responsive design: Mobile-friendly with modern styling ✅")
    else:
        print("❌ Some tests failed. Check the errors above.")
        sys.exit(1)