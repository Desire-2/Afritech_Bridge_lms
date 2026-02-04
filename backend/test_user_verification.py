#!/usr/bin/env python3
import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:5002/api/v1"
TEST_CREDENTIALS = {
    'email': 'desire.bikorimana@student.co.rw',
    'password': '123456'
}

print("=" * 70)
print(f"TESTING USER VERIFICATION - {datetime.now()}")
print("=" * 70)

def test_user_verification():
    """Test the new user verification endpoint"""
    try:
        # Step 1: Login
        print("\n1. Logging in...")
        login_response = requests.post(f"{BASE_URL}/auth/login", json=TEST_CREDENTIALS)
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            print(f"Response: {login_response.text}")
            return
            
        access_token = login_response.json().get('access_token')
        print(f"✅ Login successful - Token starts with: {access_token[:20]}...")
        
        # Step 2: Test user verification endpoint
        print("\n2. Testing user verification endpoint...")
        headers = {'Authorization': f'Bearer {access_token}'}
        
        verify_response = requests.get(f"{BASE_URL}/achievements/debug/user-info", headers=headers)
        
        if verify_response.status_code == 200:
            user_info = verify_response.json()
            print("✅ User verification successful!")
            print(f"   User ID: {user_info.get('user_id')}")
            print(f"   Username: {user_info.get('username')}")
            print(f"   Email: {user_info.get('email')}")
            print(f"   Role: {user_info.get('role')}")
            print(f"   Achievements: {user_info.get('achievements')}")
            print(f"   Total: {user_info.get('total_achievements')}")
            
            # Step 3: Test sharing with one of the achievements
            achievements = user_info.get('achievements', [])
            if achievements:
                test_achievement = achievements[0]
                print(f"\n3. Testing share for achievement {test_achievement}...")
                
                share_response = requests.post(
                    f"{BASE_URL}/achievements/{test_achievement}/share",
                    json={'platform': 'test'},
                    headers=headers
                )
                
                if share_response.status_code == 200:
                    share_data = share_response.json()
                    print("✅ Share successful!")
                    print(f"   Share text: {share_data.get('share_text')}")
                    print(f"   Share count: {share_data.get('shared_count')}")
                else:
                    print(f"❌ Share failed: {share_response.status_code}")
                    print(f"Response: {share_response.text}")
            else:
                print("⚠️  No achievements found to test sharing")
                
        else:
            print(f"❌ User verification failed: {verify_response.status_code}")
            print(f"Response: {verify_response.text}")
            
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")

if __name__ == "__main__":
    test_user_verification()
    print("=" * 70)