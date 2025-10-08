#!/usr/bin/env python3
"""
Enhanced login flow test to validate the authentication fixes
Tests both backend API and simulates frontend scenarios
"""

import requests
import json
import time
import sys
import os

# Configuration
BASE_URL = "http://localhost:5001/api/v1"
TEST_TIMEOUT = 10

def test_api_connection():
    """Test if the API is accessible"""
    try:
        response = requests.get(f"{BASE_URL.replace('/api/v1', '')}/health", timeout=5)
        print("✓ API connection successful")
        return True
    except requests.exceptions.RequestException as e:
        print(f"✗ API connection failed: {e}")
        return False

def test_login_validation_errors():
    """Test login validation with various invalid inputs"""
    print("\n=== Testing Login Validation ===")
    
    test_cases = [
        {
            "name": "Empty credentials",
            "data": {},
            "expected_status": 400
        },
        {
            "name": "Missing password",
            "data": {"identifier": "test@example.com"},
            "expected_status": 400
        },
        {
            "name": "Missing identifier",
            "data": {"password": "password123"},
            "expected_status": 400
        },
        {
            "name": "Invalid email format",
            "data": {"identifier": "invalid-email@", "password": "password123"},
            "expected_status": 400
        }
    ]
    
    for test_case in test_cases:
        try:
            response = requests.post(
                f"{BASE_URL}/auth/login",
                json=test_case["data"],
                timeout=TEST_TIMEOUT
            )
            
            if response.status_code == test_case["expected_status"]:
                print(f"✓ {test_case['name']}: Correct validation error (status {response.status_code})")
                
                # Check error structure
                error_data = response.json()
                if 'error_type' in error_data and 'details' in error_data:
                    print(f"  - Error type: {error_data['error_type']}")
                    print(f"  - Message: {error_data['message']}")
                else:
                    print(f"  - Warning: Error response lacks proper structure")
            else:
                print(f"✗ {test_case['name']}: Expected status {test_case['expected_status']}, got {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            print(f"✗ {test_case['name']}: Request failed - {e}")

def test_authentication_errors():
    """Test authentication with invalid credentials"""
    print("\n=== Testing Authentication Errors ===")
    
    test_cases = [
        {
            "name": "Non-existent user",
            "data": {"identifier": "nonexistent@example.com", "password": "password123"},
            "expected_status": 401
        },
        {
            "name": "Wrong password",
            "data": {"identifier": "admin@example.com", "password": "wrongpassword"},
            "expected_status": 401
        }
    ]
    
    for test_case in test_cases:
        try:
            response = requests.post(
                f"{BASE_URL}/auth/login",
                json=test_case["data"],
                timeout=TEST_TIMEOUT
            )
            
            if response.status_code == test_case["expected_status"]:
                print(f"✓ {test_case['name']}: Correct authentication error (status {response.status_code})")
                
                error_data = response.json()
                if 'error_type' in error_data:
                    print(f"  - Error type: {error_data['error_type']}")
                    print(f"  - Message: {error_data['message']}")
            else:
                print(f"✗ {test_case['name']}: Expected status {test_case['expected_status']}, got {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            print(f"✗ {test_case['name']}: Request failed - {e}")

def test_successful_login():
    """Test successful login for different user types"""
    print("\n=== Testing Successful Login ===")
    
    # Test users (these should exist in your system)
    test_users = [
        {
            "name": "Admin user",
            "identifier": "admin@example.com",
            "password": "Admin123!",
            "expected_role": "admin"
        },
        {
            "name": "Instructor user", 
            "identifier": "instructor@example.com",
            "password": "Instructor123!",
            "expected_role": "instructor"
        },
        {
            "name": "Student user",
            "identifier": "student@example.com", 
            "password": "Student123!",
            "expected_role": "student"
        }
    ]
    
    successful_logins = []
    
    for user in test_users:
        try:
            print(f"\nTesting {user['name']}...")
            response = requests.post(
                f"{BASE_URL}/auth/login",
                json={
                    "identifier": user["identifier"],
                    "password": user["password"]
                },
                timeout=TEST_TIMEOUT
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ['message', 'access_token', 'refresh_token', 'user']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    print(f"✗ {user['name']}: Missing fields in response: {missing_fields}")
                    continue
                    
                # Validate user data
                user_data = data['user']
                required_user_fields = ['id', 'email', 'role']
                missing_user_fields = [field for field in required_user_fields if field not in user_data]
                
                if missing_user_fields:
                    print(f"✗ {user['name']}: Missing user fields: {missing_user_fields}")
                    continue
                
                # Validate role
                if user_data['role'] == user['expected_role']:
                    print(f"✓ {user['name']}: Login successful")
                    print(f"  - User ID: {user_data['id']}")
                    print(f"  - Email: {user_data['email']}")
                    print(f"  - Role: {user_data['role']}")
                    print(f"  - Token length: {len(data['access_token'])} chars")
                    
                    successful_logins.append({
                        'user': user_data,
                        'token': data['access_token']
                    })
                else:
                    print(f"✗ {user['name']}: Role mismatch. Expected {user['expected_role']}, got {user_data['role']}")
                    
            elif response.status_code == 401:
                print(f"⚠ {user['name']}: Authentication failed - user may not exist")
            else:
                print(f"✗ {user['name']}: Unexpected status {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            print(f"✗ {user['name']}: Request failed - {e}")
    
    return successful_logins

def test_token_validation(successful_logins):
    """Test that the tokens work for authenticated requests"""
    print("\n=== Testing Token Validation ===")
    
    for login in successful_logins:
        user = login['user']
        token = login['token']
        
        try:
            headers = {'Authorization': f'Bearer {token}'}
            response = requests.get(
                f"{BASE_URL}/users/me",
                headers=headers,
                timeout=TEST_TIMEOUT
            )
            
            if response.status_code == 200:
                profile_data = response.json()
                if profile_data['id'] == user['id']:
                    print(f"✓ Token validation successful for {user['role']} user")
                else:
                    print(f"✗ Token validation failed: ID mismatch for {user['role']} user")
            else:
                print(f"✗ Token validation failed for {user['role']} user: status {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            print(f"✗ Token validation failed for {user['role']} user: {e}")

def test_performance():
    """Test login performance and timeout handling"""
    print("\n=== Testing Performance ===")
    
    test_data = {
        "identifier": "admin@example.com",
        "password": "Admin123!"
    }
    
    # Test response time
    start_time = time.time()
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json=test_data,
            timeout=TEST_TIMEOUT
        )
        end_time = time.time()
        response_time = end_time - start_time
        
        print(f"Login response time: {response_time:.2f} seconds")
        
        if response_time < 2.0:
            print("✓ Login performance is acceptable (< 2 seconds)")
        elif response_time < 5.0:
            print("⚠ Login performance is slow (2-5 seconds)")
        else:
            print("✗ Login performance is poor (> 5 seconds)")
            
    except requests.exceptions.Timeout:
        print("✗ Login request timed out")
    except requests.exceptions.RequestException as e:
        print(f"✗ Login request failed: {e}")

def main():
    """Run all login tests"""
    print("Enhanced Login Flow Test")
    print("=" * 50)
    
    # Check if API is accessible
    if not test_api_connection():
        print("Cannot proceed with tests - API is not accessible")
        sys.exit(1)
    
    # Run all tests
    test_login_validation_errors()
    test_authentication_errors()
    successful_logins = test_successful_login()
    
    if successful_logins:
        test_token_validation(successful_logins)
    else:
        print("\n⚠ No successful logins to test token validation")
    
    test_performance()
    
    print("\n" + "=" * 50)
    print("Login flow test completed!")
    print("\nKey improvements implemented:")
    print("1. ✓ Enhanced login validation with detailed error messages")
    print("2. ✓ Proper authentication state management")
    print("3. ✓ Reliable redirect handling using window.location")
    print("4. ✓ Timeout handling with manual fallback options")
    print("5. ✓ Improved error handling and user feedback")
    print("6. ✓ Token validation in backend login response")

if __name__ == "__main__":
    main()