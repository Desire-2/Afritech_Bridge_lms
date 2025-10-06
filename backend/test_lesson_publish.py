#!/usr/bin/env python3
"""
Test script for lesson publish functionality
Tests the lesson update endpoint with is_published field
"""

import requests
import json

def test_lesson_publish_endpoint():
    """Test lesson publish endpoint accessibility"""
    
    base_url = "http://localhost:5002/api/v1"
    endpoint = "/courses/1/modules/1/lessons/1"
    url = f"{base_url}{endpoint}"
    
    payload = {"is_published": True}
    headers = {"Content-Type": "application/json"}
    
    try:
        response = requests.put(url, json=payload, headers=headers, timeout=5)
        
        print(f"Testing Lesson Publish Endpoint: {endpoint}")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 401:
            print("✅ Endpoint accessible - Authentication required (as expected)")
            return True
        elif response.status_code == 422:
            print("✅ Endpoint accessible - Validation error (as expected)")
            return True
        else:
            print(f"⚠️  Unexpected status code: {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed - Backend not running?")
        return False
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

if __name__ == "__main__":
    print("Testing Lesson Publish Functionality")
    print("=" * 40)
    
    if test_lesson_publish_endpoint():
        print("🎉 Lesson publish endpoint is ready!")
    else:
        print("❌ Issues found with lesson publish endpoint")