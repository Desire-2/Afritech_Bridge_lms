#!/usr/bin/env python3
"""
Test lesson completion endpoint with various scenarios
"""

import requests
import json

# Test configuration
BASE_URL = "http://localhost:5001"
API_URL = f"{BASE_URL}/api/v1"

def test_lesson_completion_endpoint():
    """Test the lesson completion endpoint"""
    
    # Test data
    lesson_id = 1  # Use a lesson ID that exists
    completion_data = {
        "time_spent": 150,
        "reading_progress": 95.5,
        "engagement_score": 88.2,
        "scroll_progress": 92.1,
        "completion_method": "automatic"
    }
    
    print("🧪 Testing Lesson Completion Endpoint")
    print(f"URL: {API_URL}/student/lessons/{lesson_id}/complete")
    print(f"Data: {json.dumps(completion_data, indent=2)}")
    
    try:
        # Test POST request (complete lesson)
        response = requests.post(
            f"{API_URL}/student/lessons/{lesson_id}/complete",
            json=completion_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"\n📤 POST Response:")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ POST request successful!")
            result = response.json()
            if result.get('already_completed'):
                print("ℹ️  Lesson was already completed - updated with new progress data")
            else:
                print("🎉 Lesson completed successfully")
        elif response.status_code == 401:
            print("🔐 Authentication required (expected for this test)")
        elif response.status_code == 400:
            print("❌ Bad request - this should be fixed now")
            try:
                error_data = response.json()
                print(f"Error details: {error_data}")
            except:
                print("Could not parse error response")
        else:
            print(f"⚠️  Unexpected status code: {response.status_code}")
            
    except requests.ConnectionError:
        print("❌ Cannot connect to backend server")
        print("Make sure the backend is running on localhost:5001")
    except Exception as e:
        print(f"❌ Test failed: {e}")

if __name__ == "__main__":
    test_lesson_completion_endpoint()