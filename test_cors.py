#!/usr/bin/env python3
"""
Simple script to test CORS and forgot-password endpoint
"""

import requests
import json

def test_cors_and_forgot_password():
    """Test CORS headers and forgot-password endpoint"""
    
    # Test URLs
    base_url = "https://afritech-bridge-lms.onrender.com"
    health_url = f"{base_url}/health"
    forgot_password_url = f"{base_url}/api/v1/auth/forgot-password"
    
    # Headers that would be sent by the frontend
    headers = {
        'Origin': 'https://study.afritechbridge.online',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
    
    print("🔍 Testing CORS and API endpoints...")
    print(f"Backend URL: {base_url}")
    print(f"Frontend Origin: {headers['Origin']}")
    print("-" * 50)
    
    # Test 1: Health check
    try:
        print("1. Testing health endpoint...")
        response = requests.get(health_url, headers=headers)
        print(f"   Status: {response.status_code}")
        print(f"   CORS Headers:")
        cors_headers = {k: v for k, v in response.headers.items() if 'access-control' in k.lower()}
        for header, value in cors_headers.items():
            print(f"     {header}: {value}")
        
        if response.status_code == 200:
            print(f"   Response: {response.json()}")
        print()
        
    except Exception as e:
        print(f"   ❌ Health check failed: {e}")
        print()
    
    # Test 2: OPTIONS preflight request
    try:
        print("2. Testing OPTIONS preflight request...")
        response = requests.options(forgot_password_url, headers=headers)
        print(f"   Status: {response.status_code}")
        print(f"   CORS Headers:")
        cors_headers = {k: v for k, v in response.headers.items() if 'access-control' in k.lower()}
        for header, value in cors_headers.items():
            print(f"     {header}: {value}")
        print()
        
    except Exception as e:
        print(f"   ❌ OPTIONS request failed: {e}")
        print()
    
    # Test 3: Forgot password request
    try:
        print("3. Testing forgot-password endpoint...")
        payload = {"email": "test@example.com"}
        response = requests.post(forgot_password_url, headers=headers, json=payload)
        print(f"   Status: {response.status_code}")
        print(f"   CORS Headers:")
        cors_headers = {k: v for k, v in response.headers.items() if 'access-control' in k.lower()}
        for header, value in cors_headers.items():
            print(f"     {header}: {value}")
        
        try:
            print(f"   Response: {response.json()}")
        except:
            print(f"   Response (text): {response.text}")
        print()
        
    except Exception as e:
        print(f"   ❌ Forgot password request failed: {e}")
        print()
    
    print("🎯 CORS Test Complete!")
    print("\n💡 Tips:")
    print("- If CORS headers are missing, the backend needs to be redeployed")
    print("- If you get 502 errors, the backend server might be down")
    print("- Check that FLASK_ENV=production and ALLOWED_ORIGINS are set correctly")

if __name__ == "__main__":
    test_cors_and_forgot_password()