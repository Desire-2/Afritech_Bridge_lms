#!/usr/bin/env python3
"""
Quick test to verify application submission email works
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask
from flask_mail import Mail
from dotenv import load_dotenv
from src.utils.email_utils import send_email
from src.utils.email_templates import application_received_email
from datetime import datetime
import os

load_dotenv()

# Create Flask app
app = Flask(__name__)
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'True').lower() == 'true'
app.config['MAIL_USE_SSL'] = os.getenv('MAIL_USE_SSL', 'False').lower() == 'true'
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER')

# Initialize Mail
mail = Mail(app)

# Create mock application object
class MockApplication:
    def __init__(self):
        self.id = 123
        self.full_name = "Test Applicant"
        self.email = "bikorimanadesire@yahoo.com"
        self.created_at = datetime.now()

def test_application_email():
    """Test application confirmation email"""
    print("\n" + "="*60)
    print("📧 TESTING APPLICATION SUBMISSION EMAIL")
    print("="*60)
    
    # Create mock application
    application = MockApplication()
    course_title = "Excel for Data Analysis - Test Course"
    
    print(f"\nApplication Details:")
    print(f"  ID: #{application.id}")
    print(f"  Name: {application.full_name}")
    print(f"  Email: {application.email}")
    print(f"  Course: {course_title}")
    
    try:
        # Generate email HTML
        print("\n📝 Generating email template...")
        email_html = application_received_email(application, course_title)
        print(f"✅ Template generated ({len(email_html)} characters)")
        
        # Send email with Flask app context
        print(f"\n📤 Sending email to {application.email}...")
        with app.app_context():
            send_email(
                to=application.email,
                subject=f"✅ Application Received - {course_title}",
                template=email_html
            )
        
        print("✅ SUCCESS! Application confirmation email sent!")
        print(f"\n📬 Check inbox: {application.email}")
        print("\nEmail should contain:")
        print("  • Application ID and details")
        print("  • Course name")
        print("  • Review timeline (2-3 business days)")
        print("  • Next steps")
        print("  • Contact information")
        
        print("\n" + "="*60)
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        print("\n" + "="*60)
        return False

if __name__ == "__main__":
    success = test_application_email()
    sys.exit(0 if success else 1)
