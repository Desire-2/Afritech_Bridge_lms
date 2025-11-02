#!/usr/bin/env python3
"""
Test script to verify quiz creation endpoint
"""
import requests
import json

BASE_URL = "http://localhost:5001/api/v1"

# You'll need to replace this with a valid instructor token
# Get it from the browser's localStorage after logging in
TOKEN = "YOUR_TOKEN_HERE"

def test_quiz_creation():
    """Test creating a quiz"""
    
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json"
    }
    
    quiz_data = {
        "title": "Test Quiz",
        "description": "Test Description",
        "course_id": 1,  # Replace with valid course ID
        "is_published": False,
        "questions": [
            {
                "question_text": "What is Python?",
                "question_type": "multiple_choice",
                "answers": [
                    {"answer_text": "A programming language", "is_correct": True},
                    {"answer_text": "A snake", "is_correct": False}
                ]
            }
        ]
    }
    
    print("=" * 50)
    print("Testing Quiz Creation Endpoint")
    print("=" * 50)
    print(f"\nURL: {BASE_URL}/instructor/assessments/quizzes")
    print(f"\nRequest Data:\n{json.dumps(quiz_data, indent=2)}")
    
    try:
        response = requests.post(
            f"{BASE_URL}/instructor/assessments/quizzes",
            headers=headers,
            json=quiz_data,
            timeout=10
        )
        
        print(f"\nResponse Status: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        print(f"\nResponse Body:\n{json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 201:
            print("\n✅ SUCCESS: Quiz created successfully!")
        else:
            print(f"\n❌ ERROR: Expected 201, got {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Cannot connect to backend. Is it running?")
    except requests.exceptions.Timeout:
        print("\n❌ ERROR: Request timed out")
    except Exception as e:
        print(f"\n❌ ERROR: {type(e).__name__}: {e}")

def test_endpoint_availability():
    """Test if the endpoint is registered"""
    print("\n" + "=" * 50)
    print("Testing Endpoint Availability")
    print("=" * 50)
    
    try:
        # Try without authentication to see if endpoint exists
        response = requests.get(
            f"{BASE_URL}/instructor/assessments/quizzes",
            timeout=5
        )
        
        if response.status_code == 401:
            print("\n✅ Endpoint exists (requires authentication)")
        elif response.status_code == 403:
            print("\n✅ Endpoint exists (requires instructor role)")
        elif response.status_code == 404:
            print("\n❌ ERROR: Endpoint not found (404)")
        else:
            print(f"\n✅ Endpoint accessible (status: {response.status_code})")
            
    except Exception as e:
        print(f"\n❌ ERROR: {e}")

if __name__ == "__main__":
    print("\n🔍 Quiz Backend Endpoint Tests\n")
    
    # First check if endpoint exists
    test_endpoint_availability()
    
    # Then try to create a quiz (requires valid token)
    if TOKEN != "YOUR_TOKEN_HERE":
        test_quiz_creation()
    else:
        print("\n⚠️  Skipping creation test - please set TOKEN variable with a valid instructor token")
        print("   You can get it from browser localStorage after logging in as instructor")
