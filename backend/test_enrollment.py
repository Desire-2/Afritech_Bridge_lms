#!/usr/bin/env python3

import requests
import json

# Configuration
BASE_URL = "http://localhost:5001/api/v1"
STUDENT_EMAIL = "student@example.com"
STUDENT_PASSWORD = "password123"  # Default password from create_test_user.py

def login_student():
    """Login as a student and get JWT token"""
    print("Logging in student...")
    
    login_data = {
        "identifier": STUDENT_EMAIL,  # Use identifier instead of email
        "password": STUDENT_PASSWORD
    }
    
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    print(f"Login response status: {response.status_code}")
    print(f"Login response: {response.text}")
    
    if response.status_code == 200:
        data = response.json()
        # The token is in 'access_token' field
        return data.get('access_token')
    
    return None

def test_enrollment(token, course_id=1):
    """Test enrollment with the given token"""
    print(f"\nTesting enrollment for course {course_id}...")
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    enrollment_data = {
        "course_id": course_id
    }
    
    response = requests.post(f"{BASE_URL}/student/enrollment/enroll", 
                           headers=headers, 
                           json=enrollment_data)
    
    print(f"Enrollment response status: {response.status_code}")
    print(f"Enrollment response: {response.text}")
    
    return response.status_code == 200

def main():
    # Step 1: Login
    token = login_student()
    
    if not token:
        print("Failed to login! Check credentials.")
        return
    
    print(f"Successfully logged in. Token: {token[:50]}...")
    
    # Step 2: Test enrollment with course 1 
    success = test_enrollment(token, course_id=1)
    
    if success:
        print("\n✅ Enrollment test successful!")
    else:
        print("\n❌ Enrollment test failed!")

if __name__ == "__main__":
    main()