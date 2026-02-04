#!/usr/bin/env python3
import requests
import json
from datetime import datetime

# Configuration 
BASE_URL = "http://localhost:5002/api/v1"
TEST_CREDENTIALS = {
    'identifier': 'desire.bikorimana@student.co.rw',
    'password': '123456'
}

print("=" * 80)
print(f"TESTING FIXED ACHIEVEMENT SHARING - {datetime.now()}")
print("=" * 80)

def test_achievement_sharing_fix():
    """Test that sharing works with the corrected data structure"""
    try:
        # Step 1: Login
        print("\n1. 🔐 Testing login...")
        login_response = requests.post(f"{BASE_URL}/auth/login", json=TEST_CREDENTIALS)
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            return
            
        access_token = login_response.json().get('access_token')
        user_data = login_response.json().get('user', {})
        print(f"✅ Login successful - User ID: {user_data.get('id')}")
        
        headers = {'Authorization': f'Bearer {access_token}'}
        
        # Step 2: Test earned achievements structure
        print("\n2. 📊 Testing earned achievements structure...")
        earned_response = requests.get(f"{BASE_URL}/achievements/earned", headers=headers)
        
        if earned_response.status_code != 200:
            print(f"❌ Failed to get earned achievements: {earned_response.status_code}")
            return
            
        earned_data = earned_response.json()
        print(f"✅ Got earned achievements: {len(earned_data.get('achievements', []))} total")
        
        # Analyze the data structure
        if earned_data.get('achievements'):
            first_user_achievement = earned_data['achievements'][0]
            print(f"\n📋 UserAchievement structure analysis:")
            print(f"   - UserAchievement ID: {first_user_achievement.get('id')}")
            print(f"   - Achievement nested: {bool(first_user_achievement.get('achievement'))}")
            if first_user_achievement.get('achievement'):
                achievement = first_user_achievement['achievement']
                print(f"   - Nested Achievement ID: {achievement.get('id')}")
                print(f"   - Title: {achievement.get('title')}")
                
                # Step 3: Test sharing with nested achievement ID
                achievement_id = achievement['id']
                print(f"\n3. 🚀 Testing share for nested Achievement ID: {achievement_id}")
                
                share_response = requests.post(
                    f"{BASE_URL}/achievements/{achievement_id}/share",
                    json={'platform': 'structure-test'},
                    headers=headers
                )
                
                if share_response.status_code == 200:
                    share_data = share_response.json()
                    print("✅ Share successful with corrected structure!")
                    print(f"   Share text: {share_data.get('share_text')}")
                    print(f"   Share count: {share_data.get('shared_count')}")
                    
                    print(f"\n🎉 SUCCESS: Data structure mismatch FIXED!")
                    print(f"   ✅ Frontend should now use: userAchievement.achievement.id === {achievement_id}")
                    print(f"   ✅ Instead of: userAchievement.id === {first_user_achievement.get('id')}")
                else:
                    print(f"❌ Share failed: {share_response.status_code}")
                    print(f"   Response: {share_response.text}")
            else:
                print("❌ No nested achievement found in UserAchievement structure")
        else:
            print("⚠️ No earned achievements found to test")
            
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_achievement_sharing_fix()
    print("=" * 80)