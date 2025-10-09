#!/usr/bin/env python3
"""
Test lesson progress update endpoint
"""

import requests
import json

# Test configuration
BASE_URL = "http://localhost:5001"
API_URL = f"{BASE_URL}/api/v1"

def test_lesson_progress_endpoint():
    """Test the lesson progress update endpoint"""
    
    # Test data
    lesson_id = 1  # Use a lesson ID that exists
    progress_data = {
        "reading_progress": 75.5,
        "engagement_score": 82.3,
        "scroll_progress": 68.9,
        "time_spent": 120,
        "auto_saved": True
    }
    
    print("🧪 Testing Lesson Progress Update Endpoint")
    print(f"URL: {API_URL}/student/lessons/{lesson_id}/progress")
    print(f"Data: {json.dumps(progress_data, indent=2)}")
    
    try:
        # Test POST request (update progress)
        response = requests.post(
            f"{API_URL}/student/lessons/{lesson_id}/progress",
            json=progress_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"\n📤 POST Response:")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ POST request successful!")
        elif response.status_code == 401:
            print("🔐 Authentication required (expected for this test)")
        elif response.status_code == 405:
            print("❌ Method not allowed - endpoint might not exist")
        else:
            print(f"⚠️  Unexpected status code: {response.status_code}")
        
        # Test GET request (get progress)
        response = requests.get(f"{API_URL}/student/lessons/{lesson_id}/progress")
        
        print(f"\n📥 GET Response:")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ GET request successful!")
        elif response.status_code == 401:
            print("🔐 Authentication required (expected for this test)")
        else:
            print(f"⚠️  Unexpected status code: {response.status_code}")
            
    except requests.ConnectionError:
        print("❌ Cannot connect to backend server")
        print("Make sure the backend is running on localhost:5001")
    except Exception as e:
        print(f"❌ Test failed: {e}")

if __name__ == "__main__":
    test_lesson_progress_endpoint()