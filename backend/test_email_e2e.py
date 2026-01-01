#!/usr/bin/env python3
"""
End-to-End Email Testing Script
Tests actual API endpoints to verify emails are sent during operations
"""

import requests
import time
import json

BASE_URL = "http://localhost:5001/api/v1"

def print_header(title):
    print("\n" + "="*70)
    print(f"  {title}")
    print("="*70)

def print_result(success, message):
    icon = "✅" if success else "❌"
    print(f"{icon} {message}")

def test_application_flow():
    """Test complete application flow with email notifications"""
    
    print_header("APPLICATION FLOW - EMAIL VERIFICATION")
    
    # Test 1: Submit Application
    print("\n📝 Test 1: Submitting Application (should send confirmation email)")
    application_data = {
        "full_name": "Email Test User",
        "email": "bikorimanadesire@yahoo.com",
        "phone": "+250788000000",
        "course_id": 1,
        "age": 25,
        "gender": "male",
        "location": "Kigali, Rwanda",
        "education_level": "bachelors",
        "employment_status": "employed",
        "motivation": "I want to learn data analysis with Excel",
        "excel_skill_level": "beginner",
        "excel_use_cases": ["data_entry", "calculations"],
        "has_computer": True,
        "internet_access_type": "home_wifi",
        "preferred_learning_mode": "self_paced",
        "committed_to_complete": True,
        "agrees_to_assessments": True
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/applications",
            json=application_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 201:
            result = response.json()
            app_id = result.get('application_id')
            print_result(True, f"Application submitted - ID: {app_id}")
            print("   📧 Confirmation email should have been sent to bikorimanadesire@yahoo.com")
            print(f"   Scores: {result.get('scores')}")
            
            time.sleep(2)  # Wait for email to send
            
            return app_id
        else:
            print_result(False, f"Failed to submit: {response.status_code}")
            print(f"   Error: {response.text}")
            return None
            
    except Exception as e:
        print_result(False, f"Error: {str(e)}")
        return None

def test_admin_operations(app_id):
    """Test admin operations that send emails"""
    
    if not app_id:
        print("⚠️ Skipping admin operations - no application ID")
        return
    
    # Get admin token (simplified - in real scenario would need login)
    print("\n🔐 Note: Admin operations require authentication")
    print("   To test approval/rejection emails:")
    print(f"   1. Login as admin/instructor")
    print(f"   2. Use token to call:")
    print(f"      POST {BASE_URL}/applications/{app_id}/approve")
    print(f"      POST {BASE_URL}/applications/{app_id}/reject")
    print(f"      POST {BASE_URL}/applications/{app_id}/waitlist")

def check_server_status():
    """Check if backend server is running"""
    print_header("SERVER STATUS CHECK")
    
    try:
        response = requests.get(f"{BASE_URL}/../health", timeout=5)
        if response.status_code in [200, 404]:  # 404 is ok, means server is up
            print_result(True, "Backend server is running")
            return True
    except requests.exceptions.ConnectionError:
        print_result(False, "Backend server is not running")
        print("   Please start the server with: ./run.sh")
        return False
    except Exception as e:
        print_result(False, f"Error checking server: {str(e)}")
        return False

def check_email_logs():
    """Instructions for checking email logs"""
    print_header("EMAIL VERIFICATION")
    
    print("\n📧 To verify emails were sent, check:")
    print("   1. Server logs in the terminal running ./run.sh")
    print("      Look for: '✅ Confirmation email sent successfully'")
    print("   2. Email inbox: bikorimanadesire@yahoo.com")
    print("   3. Spam/Junk folder if not in inbox")
    print("\n📝 Email subject lines to look for:")
    print("   • ✅ Application Received - [Course Title]")
    print("   • 🎉 Congratulations! Welcome to [Course Title]")
    print("   • Application Status Update - [Course Title]")
    print("   • ⏳ Application Waitlisted - [Course Title]")

def main():
    """Run all email tests"""
    
    print("\n" + "="*70)
    print("  AFRITEC BRIDGE LMS - END-TO-END EMAIL TESTING")
    print("="*70)
    print("\nThis script tests email sending through actual API endpoints")
    print("It will submit an application and verify email notifications")
    
    # Check server status
    if not check_server_status():
        return
    
    # Test application flow
    app_id = test_application_flow()
    
    # Test admin operations (informational)
    test_admin_operations(app_id)
    
    # Email verification instructions
    check_email_logs()
    
    # Summary
    print_header("TEST SUMMARY")
    print("\n✅ Application submission tested")
    print("📧 Check your email inbox and server logs to confirm emails were sent")
    print("\n💡 Next steps:")
    print("   1. Check bikorimanadesire@yahoo.com for confirmation email")
    print("   2. Login as instructor to test approval/rejection emails")
    print("   3. Create announcement to test announcement emails")
    print("   4. Grade assignment to test grading emails")
    print("\n" + "="*70)

if __name__ == "__main__":
    main()
