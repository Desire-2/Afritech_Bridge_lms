#!/usr/bin/env python3
"""
Test actual API submission to see if email is sent
Creates a NEW application with unique email
"""

import requests
import random
import string

BASE_URL = "http://localhost:5001/api/v1"

def generate_unique_email():
    """Generate a unique email for testing"""
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"test_{random_str}@example.com"

def test_new_application_submission():
    """Submit a completely new application and check if email is sent"""
    
    print("="*70)
    print("  TESTING APPLICATION SUBMISSION EMAIL")
    print("="*70)
    
    unique_email = generate_unique_email()
    print(f"\n📝 Creating new application with email: {unique_email}")
    
    application_data = {
        "full_name": "Test Email User",
        "email": unique_email,
        "phone": "+250788999999",
        "course_id": 1,
        "age": 28,
        "gender": "male",
        "location": "Kigali",
        "education_level": "bachelors",
        "employment_status": "employed",
        "motivation": "I want to learn Excel for work",
        "excel_skill_level": "beginner",
        "excel_use_cases": ["data_entry"],
        "has_computer": True,
        "internet_access_type": "stable_broadband",  # Fixed: valid enum value
        "preferred_learning_mode": "self_paced",
        "committed_to_complete": True,
        "agrees_to_assessments": True
    }
    
    try:
        print("\n📤 Sending POST request to /api/v1/applications...")
        response = requests.post(
            f"{BASE_URL}/applications",
            json=application_data,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"\n📥 Response Status: {response.status_code}")
        print(f"📄 Response Body:")
        print(json.dumps(response.json(), indent=2) if response.headers.get('content-type') == 'application/json' else response.text)
        
        if response.status_code == 201:
            print("\n✅ Application created successfully!")
            print("\n📧 Check server logs for:")
            print("   '📧 Preparing confirmation email for application #...'")
            print("   '✅ Confirmation email sent successfully to ...'")
            print(f"\n📬 Email should be sent to: {unique_email}")
            return True
        else:
            print(f"\n❌ Application creation failed with status {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Cannot connect to backend server")
        print("   Make sure the server is running: ./run.sh")
        return False
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        return False

if __name__ == "__main__":
    import json
    
    result = test_new_application_submission()
    
    print("\n" + "="*70)
    if result:
        print("✅ Test completed - Check server terminal for email logs")
        print("\nLook for these log messages:")
        print("  📧 Preparing confirmation email for application #X")
        print("  ✅ Confirmation email sent successfully to test_...@example.com")
    else:
        print("❌ Test failed - Application was not created")
    print("="*70)
