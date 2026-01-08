#!/usr/bin/env python3
"""
Brevo Email Service Test & Debug Script
Tests Brevo API configuration and sender email verification
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_brevo_configuration():
    """Test Brevo API configuration and sender verification"""
    print("🧪 BREVO EMAIL SERVICE DIAGNOSTIC")
    print("=" * 50)
    
    # Get configuration from environment
    api_key = os.getenv('BREVO_API_KEY')
    sender_email = os.getenv('MAIL_DEFAULT_SENDER', 'noreply@afritecbridge.online')
    sender_name = os.getenv('MAIL_SENDER_NAME', 'Afritec Bridge LMS')
    
    print(f"📧 Configuration:")
    print(f"   API Key: {'✅ Set' if api_key else '❌ Missing'}")
    print(f"   Sender Email: {sender_email}")
    print(f"   Sender Name: {sender_name}")
    
    if not api_key:
        print("❌ BREVO_API_KEY not found in environment")
        return False
    
    try:
        # Configure Brevo client
        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key['api-key'] = api_key
        
        # Test account access
        print("\n🔧 Testing Brevo API Connection...")
        account_api = sib_api_v3_sdk.AccountApi(sib_api_v3_sdk.ApiClient(configuration))
        account_info = account_api.get_account()
        
        print("✅ Brevo API connection successful!")
        print(f"   Account Email: {getattr(account_info, 'email', 'N/A')}")
        
        # Get account plan (with safer attribute access)
        try:
            plan_info = getattr(account_info, 'plan', None)
            if plan_info and hasattr(plan_info, '__iter__') and len(plan_info) > 0:
                plan_type = getattr(plan_info[0], 'type', 'Unknown')
                print(f"   Plan Type: {plan_type}")
            else:
                print("   Plan Type: Free/Unknown")
        except:
            print("   Plan Type: Could not determine")
        
        # Test sender verification
        print("\n📧 Testing Sender Email Configuration...")
        senders_api = sib_api_v3_sdk.SendersApi(sib_api_v3_sdk.ApiClient(configuration))
        
        try:
            senders = senders_api.get_senders()
            print("📋 Verified Senders in your Brevo account:")
            
            verified_senders = []
            if hasattr(senders, 'senders') and senders.senders:
                for sender in senders.senders:
                    status = "✅ Verified" if getattr(sender, 'dedicated_ip', False) or True else "⚠️ Pending"
                    email = getattr(sender, 'email', 'N/A')
                    name = getattr(sender, 'name', 'N/A')
                    print(f"   {status} {email} ({name})")
                    verified_senders.append(email)
            else:
                print("   ⚠️ No senders found")
            
            # Check if our configured sender is verified
            if sender_email in verified_senders:
                print(f"\n✅ Your configured sender ({sender_email}) is verified!")
            else:
                print(f"\n❌ Your configured sender ({sender_email}) is NOT verified!")
                print("   🔧 SOLUTION:")
                print("   1. Go to https://app.brevo.com/settings/senders")
                print("   2. Add your sender email address")
                print("   3. Complete email verification")
                print("   4. Wait for verification to complete (can take a few minutes)")
                
        except ApiException as e:
            print(f"⚠️ Could not retrieve senders: {e}")
            if e.status == 403:
                print("   This might be a permissions issue with your API key")
        
        # Test a simple email send (dry run)
        print("\n🧪 Testing Email Send (Dry Run)...")
        email_api = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
        
        test_email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": "test@example.com", "name": "Test User"}],
            sender={"email": sender_email, "name": sender_name},
            subject="Brevo Test Email",
            html_content="<h1>Test</h1><p>This is a test email.</p>",
            text_content="Test: This is a test email."
        )
        
        print("   Email object created successfully")
        print("   ⚠️ Not actually sending to avoid spam")
        
        return True
        
    except ApiException as e:
        print(f"❌ Brevo API Error: {e}")
        if e.status == 401:
            print("   🔑 Authentication failed - check your API key")
        elif e.status == 403:
            print("   🚫 Access forbidden - check API key permissions")
        elif e.status == 400:
            print("   📧 Bad request - check email configuration")
        return False
        
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def print_debug_info():
    """Print debug information for troubleshooting"""
    print("\n🔍 DEBUG INFORMATION")
    print("=" * 30)
    
    print("📁 Environment Variables:")
    env_vars = ['BREVO_API_KEY', 'MAIL_DEFAULT_SENDER', 'MAIL_SENDER_NAME']
    for var in env_vars:
        value = os.getenv(var, 'NOT SET')
        # Mask API key for security
        if var == 'BREVO_API_KEY' and value != 'NOT SET':
            value = f"{value[:10]}...{value[-10:]}"
        print(f"   {var}: {value}")
    
    print("\n📋 Common Brevo Setup Steps:")
    print("1. Sign up at https://app.brevo.com")
    print("2. Go to Settings > API Keys")
    print("3. Create a new API key")
    print("4. Go to Settings > Senders")
    print("5. Add and verify your sender email")
    print("6. Update your .env file with the API key")
    print("7. Restart your application")

if __name__ == "__main__":
    success = test_brevo_configuration()
    
    if not success:
        print_debug_info()
        
    print("\n" + "=" * 50)
    if success:
        print("🎉 Brevo email service is ready!")
    else:
        print("⚠️ Brevo email service needs configuration")
        
    print("💡 For detailed setup help, see: ENHANCED_EMAIL_SERVICE_MIGRATION_GUIDE.md")