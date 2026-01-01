#!/usr/bin/env python3
"""
Test Email Script for Afritec Bridge LMS
Sends a test email to verify SMTP configuration
"""

import os
import sys
from flask import Flask
from flask_mail import Mail, Message
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Create minimal Flask app
app = Flask(__name__)

# Configure Flask-Mail
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'True').lower() == 'true'
app.config['MAIL_USE_SSL'] = os.getenv('MAIL_USE_SSL', 'False').lower() == 'true'
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER')

# Initialize Mail
mail = Mail(app)

def send_test_email(recipient):
    """Send a test email"""
    
    print("\n" + "="*60)
    print("📧 SENDING TEST EMAIL")
    print("="*60)
    print(f"From: {app.config['MAIL_DEFAULT_SENDER']}")
    print(f"To: {recipient}")
    print(f"SMTP Server: {app.config['MAIL_SERVER']}:{app.config['MAIL_PORT']}")
    print(f"TLS: {app.config['MAIL_USE_TLS']}")
    print(f"Username: {app.config['MAIL_USERNAME']}")
    print("="*60 + "\n")
    
    # Create HTML email
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
                border-radius: 10px 10px 0 0;
            }
            .content {
                background: #f9fafb;
                padding: 30px;
                border-radius: 0 0 10px 10px;
            }
            .success-badge {
                display: inline-block;
                background: #10b981;
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: bold;
                margin: 20px 0;
            }
            .button {
                display: inline-block;
                background: #3b82f6;
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 5px;
                margin-top: 20px;
            }
            .footer {
                text-align: center;
                padding: 20px;
                color: #6b7280;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎓 Afritec Bridge LMS</h1>
                <p>Email System Test</p>
            </div>
            <div class="content">
                <h2>✅ Email Configuration Successful!</h2>
                
                <div class="success-badge">✓ TEST PASSED</div>
                
                <p>Congratulations! Your email system is working perfectly.</p>
                
                <h3>📊 Test Details:</h3>
                <ul>
                    <li><strong>SMTP Server:</strong> smtp.mail.yahoo.com</li>
                    <li><strong>Port:</strong> 587 (TLS)</li>
                    <li><strong>Sender:</strong> afritech.bridge@yahoo.com</li>
                    <li><strong>Status:</strong> <span style="color: #10b981; font-weight: bold;">Active</span></li>
                </ul>
                
                <h3>🎉 What's Next?</h3>
                <p>Your LMS email system is now ready to send:</p>
                <ul>
                    <li>✅ Application confirmations</li>
                    <li>✅ Approval notifications with credentials</li>
                    <li>✅ Assignment grade notifications</li>
                    <li>✅ Quiz result emails</li>
                    <li>✅ Course announcements</li>
                </ul>
                
                <p style="margin-top: 20px;">
                    <a href="http://localhost:5001" class="button">Visit LMS Dashboard</a>
                </p>
            </div>
            <div class="footer">
                <p>━━━━━━━━━━━━━━━━━━━━━━━━━━━</p>
                <p>This is an automated test email from Afritec Bridge LMS</p>
                <p>© 2026 Afritec Bridge LMS</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        with app.app_context():
            msg = Message(
                subject="✅ Test Email - Afritec Bridge LMS",
                recipients=[recipient],
                html=html_content
            )
            
            mail.send(msg)
            
        print("✅ SUCCESS! Email sent successfully!")
        print(f"📬 Check your inbox at: {recipient}")
        print(f"📧 Sent from: {app.config['MAIL_DEFAULT_SENDER']}")
        print("\n" + "="*60)
        return True
        
    except Exception as e:
        print(f"❌ ERROR: Failed to send email")
        print(f"Error details: {str(e)}")
        print("\n" + "="*60)
        print("\n💡 Troubleshooting Tips:")
        print("1. Verify Yahoo app password in .env file")
        print("2. Ensure 2-Step Verification is enabled on Yahoo account")
        print("3. Check if Yahoo email (afritech.bridge@yahoo.com) is correct")
        print("4. Verify internet connection")
        print("5. Check firewall settings for port 587")
        return False

if __name__ == "__main__":
    recipient = "bikorimanadesire@yahoo.com"
    
    if len(sys.argv) > 1:
        recipient = sys.argv[1]
    
    success = send_test_email(recipient)
    
    sys.exit(0 if success else 1)
