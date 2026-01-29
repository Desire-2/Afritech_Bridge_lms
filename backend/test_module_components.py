#!/usr/bin/env python3

import requests
import json

BASE_URL = "http://localhost:5001/api/v1"

def test_module_components():
    """Test the module components endpoint specifically"""
    
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
    
    # Test module 5 components (the one failing)
    print("Testing module 5 components endpoint...")
    components_url = f"{BASE_URL}/instructor/modules/5/components"
    
    response = requests.get(components_url, headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")

if __name__ == "__main__":
    test_module_components()