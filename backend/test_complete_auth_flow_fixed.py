#!/usr/bin/env python3
import requests
import json
from datetime import datetime

# Configuration - Now with correct port!
BASE_URL = "http://localhost:5002/api/v1"
TEST_CREDENTIALS = {
    'identifier': 'desire.bikorimana@student.co.rw',  # Changed to identifier like frontend
    'password': '123456'
}

print("=" * 70)
print(f"TESTING FIXED AUTHENTICATION FLOW - {datetime.now()}")
print("=" * 70)

def test_fixed_authentication():
    """Test the complete authentication flow with correct configuration"""
    try:
        # Step 1: Login with identifier (like frontend does)
        print(f"\n1. Testing login with identifier (instead of email)...")
        print(f"   URL: {BASE_URL}/auth/login")
        print(f"   Credentials: {TEST_CREDENTIALS}")
        
        login_response = requests.post(f"{BASE_URL}/auth/login", json=TEST_CREDENTIALS)
        
        print(f"   Status: {login_response.status_code}")
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.text}")
            # Try with email field instead
            print("   Trying with 'email' field instead of 'identifier'...")
            email_creds = {
                'email': 'desire.bikorimana@student.co.rw',
                'password': '123456'
            }
            login_response = requests.post(f"{BASE_URL}/auth/login", json=email_creds)
            print(f"   Email login status: {login_response.status_code}")
            if login_response.status_code != 200:
                print(f"   Email login response: {login_response.text}")
                return
            
        access_token = login_response.json().get('access_token')
        user_data = login_response.json().get('user', {})
        
        print("✅ Login successful!")
        print(f"   User ID: {user_data.get('id')}")
        print(f"   Email: {user_data.get('email')}")
        print(f"   Role: {user_data.get('role')}")
        print(f"   Token: {access_token[:20]}...")
        
        # Step 2: Test user verification endpoint
        print(f"\n2. Testing user verification endpoint...")
        headers = {'Authorization': f'Bearer {access_token}'}
        
        verify_response = requests.get(f"{BASE_URL}/achievements/debug/user-info", headers=headers)
        
        if verify_response.status_code == 200:
            user_info = verify_response.json()
            print("✅ User verification successful!")
            print(f"   Backend User ID: {user_info.get('user_id')}")
            print(f"   Frontend would use: {user_data.get('id')}")
            print(f"   Match: {user_info.get('user_id') == user_data.get('id')}")
            print(f"   Achievements: {user_info.get('achievements')}")
            
            # Step 3: Test earned achievements endpoint
            print(f"\n3. Testing earned achievements endpoint...")
            earned_response = requests.get(f"{BASE_URL}/achievements/earned", headers=headers)
            
            if earned_response.status_code == 200:
                earned_data = earned_response.json()
                print(f"✅ Earned achievements retrieved!")
                print(f"   Count: {len(earned_data.get('achievements', []))}")
                print(f"   Achievement IDs: {[a['id'] for a in earned_data.get('achievements', [])]}")
                
                # Step 4: Test sharing with proper authentication
                achievements = earned_data.get('achievements', [])
                if achievements:
                    test_achievement = achievements[0]
                    print(f"\n4. Testing share for achievement {test_achievement['id']}: {test_achievement['title']}...")
                    
                    share_response = requests.post(
                        f"{BASE_URL}/achievements/{test_achievement['id']}/share",
                        json={'platform': 'frontend-test'},
                        headers=headers
                    )
                    
                    if share_response.status_code == 200:
                        share_data = share_response.json()
                        print("✅ Share successful!")
                        print(f"   Share text: {share_data.get('share_text')}")
                        print(f"   Share count: {share_data.get('shared_count')}")
                        print("\n🎉 COMPLETE SUCCESS - All authentication and sharing work!")
                    else:
                        print(f"❌ Share failed: {share_response.status_code}")
                        print(f"   Response: {share_response.text}")
                else:
                    print("⚠️  No achievements found to test sharing")
            else:
                print(f"❌ Earned achievements failed: {earned_response.status_code}")
                print(f"   Response: {earned_response.text}")
        else:
            print(f"❌ User verification failed: {verify_response.status_code}")
            print(f"   Response: {verify_response.text}")
            
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_fixed_authentication()
    print("=" * 70)