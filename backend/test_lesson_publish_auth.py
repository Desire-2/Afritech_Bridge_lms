#!/usr/bin/env python3
"""
Test script to debug lesson publishing issues
"""

import requests
import json

def test_lesson_publish_with_auth():
    """Test lesson publish with proper authentication"""
    
    base_url = "http://localhost:5001/api/v1"
    
    # First, let's try to login to get a token
    print("1. Testing Login...")
    login_data = {
        "identifier": "instructor",
        "password": "Instructor@123"
    }
    
    try:
        login_response = requests.post(
            f"{base_url}/auth/login", 
            json=login_data,
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        
        print(f"Login Status: {login_response.status_code}")
        
        if login_response.status_code == 200:
            token_data = login_response.json()
            token = token_data.get('access_token')
            print(f"✅ Login successful, token received")
            
            # Now test lesson update
            print("\n2. Testing Lesson Update...")
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            lesson_update_data = {"is_published": True}
            
            lesson_response = requests.put(
                f"{base_url}/instructor/courses/1/modules/1/lessons/1",
                json=lesson_update_data,
                headers=headers,
                timeout=5
            )
            
            print(f"Lesson Update Status: {lesson_response.status_code}")
            print(f"Response: {lesson_response.text[:500]}")
            
            if lesson_response.status_code == 200:
                print("✅ Lesson update successful!")
                return True
            else:
                print(f"❌ Lesson update failed: {lesson_response.status_code}")
                return False
                
        else:
            print(f"❌ Login failed: {login_response.status_code}")
            print(f"Response: {login_response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed - Backend not running?")
        return False
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def test_course_creation_routes():
    """Test if course creation routes are accessible"""
    print("\n3. Testing Course Creation Routes...")
    
    routes_to_test = [
        "/instructor/courses",
        "/courses/1/modules/1/lessons/1"
    ]
    
    for route in routes_to_test:
        try:
            response = requests.put(
                f"http://localhost:5001/api/v1{route}",
                json={"test": "data"},
                timeout=5
            )
            print(f"Route {route}: Status {response.status_code}")
        except Exception as e:
            print(f"Route {route}: Error - {str(e)}")

if __name__ == "__main__":
    print("Testing Lesson Publishing with Authentication")
    print("=" * 50)
    
    success = test_lesson_publish_with_auth()
    test_course_creation_routes()
    
    if success:
        print("\n🎉 Lesson publishing works with proper authentication!")
    else:
        print("\n❌ Issues found with lesson publishing")