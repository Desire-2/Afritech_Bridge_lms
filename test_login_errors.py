#!/usr/bin/env python3
"""
Test script to verify enhanced login error handling
"""

import requests
import json
import sys
import os

# Add the backend directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

def test_login_errors():
    base_url = "http://localhost:5000/api/v1/auth"
    
    print("🧪 Testing Enhanced Login Error Handling")
    print("=" * 50)
    
    test_cases = [
        {
            "name": "Empty credentials",
            "data": {},
            "expected_status": 400,
            "expected_error_type": "validation_error"
        },
        {
            "name": "Missing password",
            "data": {"identifier": "test@example.com"},
            "expected_status": 400,
            "expected_error_type": "validation_error"
        },
        {
            "name": "Missing identifier",
            "data": {"password": "password123"},
            "expected_status": 400,
            "expected_error_type": "validation_error"
        },
        {
            "name": "Invalid email format",
            "data": {"identifier": "invalid@", "password": "password123"},
            "expected_status": 400,
            "expected_error_type": "validation_error"
        },
        {
            "name": "Non-existent user",
            "data": {"identifier": "nonexistent@example.com", "password": "password123"},
            "expected_status": 401,
            "expected_error_type": "authentication_error"
        },
        {
            "name": "Valid user, wrong password (if test user exists)",
            "data": {"identifier": "admin@afritec.edu", "password": "wrongpassword"},
            "expected_status": 401,
            "expected_error_type": "authentication_error"
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{i}. {test_case['name']}")
        print("-" * 30)
        
        try:
            response = requests.post(
                f"{base_url}/login",
                json=test_case["data"],
                headers={"Content-Type": "application/json"},
                timeout=5
            )
            
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == test_case["expected_status"]:
                print("✅ Status code matches expected")
            else:
                print(f"❌ Status code mismatch. Expected: {test_case['expected_status']}")
            
            response_data = response.json()
            print(f"Message: {response_data.get('message', 'No message')}")
            
            if "error_type" in response_data:
                print(f"Error Type: {response_data['error_type']}")
                if response_data['error_type'] == test_case.get("expected_error_type"):
                    print("✅ Error type matches expected")
                else:
                    print(f"❌ Error type mismatch. Expected: {test_case.get('expected_error_type')}")
            
            if "details" in response_data:
                print(f"Details: {json.dumps(response_data['details'], indent=2)}")
                
        except requests.exceptions.ConnectionError:
            print("❌ Connection failed - Backend server not running")
            print("   Start the backend with: cd backend && python main.py")
            break
        except Exception as e:
            print(f"❌ Error during test: {str(e)}")
    
    print("\n" + "=" * 50)
    print("Test completed! Start the backend server to see results.")

if __name__ == "__main__":
    test_login_errors()