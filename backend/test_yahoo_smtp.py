#!/usr/bin/env python3
"""
Test Yahoo SMTP Connection
Debug script to test Yahoo email settings
"""

import smtplib
import os
from dotenv import load_dotenv
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

load_dotenv()

def test_yahoo_connection():
    """Test Yahoo SMTP connection with detailed debugging"""
    
    mail_server = os.getenv('MAIL_SERVER')
    mail_port = int(os.getenv('MAIL_PORT', 587))
    mail_username = os.getenv('MAIL_USERNAME')
    mail_password = os.getenv('MAIL_PASSWORD')
    
    print("\n" + "="*60)
    print("🔍 TESTING YAHOO SMTP CONNECTION")
    print("="*60)
    print(f"Server: {mail_server}")
    print(f"Port: {mail_port}")
    print(f"Username: {mail_username}")
    print(f"Password: {'*' * len(mail_password) if mail_password else 'NOT SET'}")
    print("="*60 + "\n")
    
    try:
        # Step 1: Connect
        print("Step 1: Connecting to SMTP server...")
        server = smtplib.SMTP(mail_server, mail_port, timeout=30)
        print("✅ Connection established")
        
        # Step 2: Say hello
        print("\nStep 2: SMTP handshake...")
        server.ehlo()
        print("✅ SMTP handshake successful")
        
        # Step 3: Start TLS
        print("\nStep 3: Starting TLS encryption...")
        server.starttls()
        server.ehlo()
        print("✅ TLS encryption enabled")
        
        # Step 4: Login
        print(f"\nStep 4: Logging in as {mail_username}...")
        server.login(mail_username, mail_password)
        print("✅ Login successful!")
        
        # Step 5: Send test email
        print("\nStep 5: Sending test email...")
        
        msg = MIMEMultipart('alternative')
        msg['From'] = mail_username
        msg['To'] = "bikorimanadesire@yahoo.com"
        msg['Subject'] = "✅ Yahoo SMTP Test - Afritec Bridge LMS"
        
        html = """
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px;">
                <h1>🎓 Afritec Bridge LMS</h1>
                <p>Yahoo Email Test Successful!</p>
            </div>
            <div style="padding: 30px; background: #f9fafb; margin-top: 20px; border-radius: 10px;">
                <h2>✅ Connection Verified</h2>
                <p>Your Yahoo email configuration is working correctly!</p>
                <ul>
                    <li><strong>Server:</strong> smtp.mail.yahoo.com</li>
                    <li><strong>Port:</strong> 587 (TLS)</li>
                    <li><strong>Status:</strong> <span style="color: #10b981;">Active ✓</span></li>
                </ul>
                <p style="margin-top: 20px;">The LMS email system is now ready to send notifications.</p>
            </div>
            <div style="text-align: center; padding: 20px; color: #6b7280;">
                <p>© 2026 Afritec Bridge LMS</p>
            </div>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(html, 'html'))
        
        server.send_message(msg)
        print("✅ Email sent successfully!")
        
        # Step 6: Close connection
        print("\nStep 6: Closing connection...")
        server.quit()
        print("✅ Connection closed cleanly")
        
        print("\n" + "="*60)
        print("🎉 SUCCESS! All tests passed!")
        print("="*60)
        print(f"\n📬 Check your inbox at: bikorimanadesire@yahoo.com")
        print(f"📧 Sent from: {mail_username}\n")
        
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"\n❌ AUTHENTICATION FAILED")
        print(f"Error: {e}")
        print("\n💡 Solutions:")
        print("1. Go to: https://login.yahoo.com/account/security")
        print("2. Enable 'Two-step verification'")
        print("3. Generate 'App password' for 'Other App'")
        print("4. Update MAIL_PASSWORD in .env with the app password")
        return False
        
    except smtplib.SMTPException as e:
        print(f"\n❌ SMTP ERROR")
        print(f"Error: {e}")
        return False
        
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR")
        print(f"Error type: {type(e).__name__}")
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    success = test_yahoo_connection()
    exit(0 if success else 1)
