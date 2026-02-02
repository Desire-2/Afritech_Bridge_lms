#!/usr/bin/env python3
"""
Test script to verify announcement email functionality
"""
import os
import sys
from datetime import datetime

# Add the backend src to Python path
backend_path = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(backend_path, 'src'))

def test_announcement_email():
    """Test the announcement email template generation"""
    print("🧪 Testing announcement email template...")
    
    try:
        # Import email template function
        from utils.email_templates import course_announcement_email, get_email_header, get_email_footer
        
        print("\n📧 Testing email template generation...")
        
        email_html = course_announcement_email(
            student_name="John Doe",
            course_title="Introduction to Python Programming", 
            announcement_title="Assignment Due Date Extended",
            announcement_content="The deadline for Assignment 1 has been extended to next Friday due to technical difficulties. Please ensure you submit your work by 11:59 PM on the new due date. If you have any questions, please reach out to me during office hours.",
            instructor_name="Dr. Jane Smith"
        )
        
        print("✅ Email template generated successfully")
        print(f"📝 Email length: {len(email_html)} characters")
        
        # Save a sample email to file for inspection
        with open('/tmp/sample_announcement_email.html', 'w') as f:
            f.write(email_html)
        print("💾 Sample email saved to /tmp/sample_announcement_email.html")
        
        # Test that essential content is present
        required_content = [
            "New Announcement",
            "John Doe", 
            "Introduction to Python Programming",
            "Assignment Due Date Extended",
            "Dr. Jane Smith"
        ]
        
        missing_content = []
        for content in required_content:
            if content not in email_html:
                missing_content.append(content)
        
        if missing_content:
            print(f"⚠️  Missing content in email: {missing_content}")
        else:
            print("✅ All required content found in email template")
            
        # Check for basic HTML structure
        html_checks = [
            '<!DOCTYPE html>',
            '<html',
            '</html>',
            '<body',
            '</body>'
        ]
        
        structure_issues = []
        for check in html_checks:
            if check not in email_html:
                structure_issues.append(check)
                
        if structure_issues:
            print(f"⚠️  HTML structure issues: {structure_issues}")
        else:
            print("✅ HTML structure looks good")
            
        print("\n🎉 Email template test completed successfully!")
        print("ℹ️  To send actual emails, ensure email service is configured in the Flask app")
        
    except Exception as e:
        print(f"❌ Error during email template test: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_announcement_email()