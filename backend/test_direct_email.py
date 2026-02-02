#!/usr/bin/env python3
"""
Test direct email sending functionality
"""
import os
import sys

# Add the backend src to Python path
backend_path = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(backend_path, 'src'))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

from utils.email_utils import send_email
from utils.email_templates import course_announcement_email
from utils.brevo_email_service import brevo_service

def test_direct_email():
    print("🧪 Testing direct email sending...")
    
    try:
        # Initialize Brevo service with environment variables
        print("📡 Initializing Brevo email service...")
        
        # Check environment configuration
        api_key = os.environ.get('BREVO_API_KEY')
        sender_email = os.environ.get('BREVO_SENDER_EMAIL')
        
        if not api_key:
            print("❌ BREVO_API_KEY not found in environment")
            return
        
        if not sender_email:
            print("❌ BREVO_SENDER_EMAIL not found in environment")
            return
            
        print(f"✅ Found API key: {api_key[:10]}...")
        print(f"✅ Found sender email: {sender_email}")
        
        # Manually initialize the service (since we're not in Flask app context)
        class MockApp:
            def __init__(self):
                self.config = {}
        
        mock_app = MockApp()
        brevo_service.init_app(mock_app)
        
        if not brevo_service.is_configured:
            print("❌ Brevo service failed to initialize")
            return
            
        print("✅ Brevo service initialized successfully")
        
        # Create test email content
        email_html = course_announcement_email(
            student_name='Test Student',
            course_title='Test Course', 
            announcement_title='Test Announcement',
            announcement_content='This is a test announcement to verify email functionality.',
            instructor_name='Test Instructor'
        )
        
        print("📧 Email template created")
        
        # Test direct email sending using Brevo service directly
        print("📤 Attempting to send email via Brevo service...")
        result = brevo_service.send_email(
            to_emails=['afritech.bridge@yahoo.com'],  # Send to configured sender email for testing
            subject='Test Announcement Email - Direct Brevo Send',
            html_content=email_html
        )
        
        print(f"📬 Email send result: {result}")
        
        if result:
            print("✅ Email sending is working!")
            print("📧 Check the inbox at afritech.bridge@yahoo.com for the test email")
        else:
            print("❌ Email sending failed")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_direct_email()