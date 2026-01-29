#!/usr/bin/env python3

import requests
import json

BASE_URL = "http://localhost:5001/api/v1"

def test_analytics_clean():
    """Test the analytics endpoint to verify database errors are resolved"""
    
    # Login first
    login_url = f"{BASE_URL}/auth/login"
    login_data = {
        "identifier": "instructor@afritecbridge.com",
        "password": "Instructor@123"
    }
    
    response = requests.post(login_url, json=login_data)
    if response.status_code != 200:
        print(f"Login failed: {response.status_code}")
        return
    
    token = response.json()['access_token']
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Test analytics endpoint
    print("Testing analytics endpoint for database errors...")
    analytics_url = f"{BASE_URL}/instructor/students/analytics"
    
    response = requests.get(analytics_url, headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Analytics working! Keys: {list(data.keys())}")
    else:
        print(f"❌ Analytics failed: {response.text}")

if __name__ == "__main__":
    test_analytics_clean()