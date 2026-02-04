#!/usr/bin/env python3
"""
Test script to verify authentication and achievement sharing flow
"""

import requests
import json
from datetime import datetime

def test_authentication_flow():
    """Test the complete authentication and sharing flow"""
    
    BASE_URL = "http://localhost:5001/api/v1"
    
    print("=" * 60)
    print(f"TESTING ACHIEVEMENT SHARING - {datetime.now()}")
    print("=" * 60)
    
    # Step 1: Test login for user 5 (has achievements)
    print("\n1. Testing login for user with achievements...")
    login_data = {
        "identifier": "bikorimanadesire@yahoo.com",  # User 5
        "password": "Desire@#1"  # Assuming default password
    }
    
    try:
        login_response = requests.post(
            f"{BASE_URL}/auth/login",
            json=login_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Login status: {login_response.status_code}")
        login_result = login_response.json()
        
        if login_response.status_code == 200 and 'access_token' in login_result:
            access_token = login_result['access_token']
            user_id = login_result.get('user', {}).get('id')
            print(f"✅ Login successful for user {user_id}")
            
            # Step 2: Test getting earned achievements
            print("\n2. Testing earned achievements endpoint...")
            auth_headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            earned_response = requests.get(
                f"{BASE_URL}/achievements/earned",
                headers=auth_headers
            )
            
            print(f"Earned achievements status: {earned_response.status_code}")
            if earned_response.status_code == 200:
                earned_data = earned_response.json()
                achievements = earned_data.get('achievements', [])
                print(f"✅ Found {len(achievements)} earned achievements")
                
                if achievements:
                    # Step 3: Test sharing the first achievement
                    test_achievement = achievements[0]
                    achievement_id = test_achievement['achievement']['id']
                    print(f"\n3. Testing share for achievement {achievement_id}: {test_achievement['achievement']['title']}")
                    
                    share_response = requests.post(
                        f"{BASE_URL}/achievements/{achievement_id}/share",
                        json={"platform": "test"},
                        headers=auth_headers
                    )
                    
                    print(f"Share status: {share_response.status_code}")
                    if share_response.status_code == 200:
                        share_data = share_response.json()
                        print(f"✅ Share successful!")
                        print(f"   Share text: {share_data.get('share_text', 'N/A')}")
                        print(f"   Share count: {share_data.get('shared_count', 0)}")
                    else:
                        print(f"❌ Share failed: {share_response.text}")
                else:
                    print("❌ No earned achievements found")
            else:
                print(f"❌ Failed to get earned achievements: {earned_response.text}")
                
        else:
            print(f"❌ Login failed: {login_result}")
            
    except Exception as e:
        print(f"❌ Test error: {e}")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    test_authentication_flow()