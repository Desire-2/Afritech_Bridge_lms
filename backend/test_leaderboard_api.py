#!/usr/bin/env python3
"""
Test script for leaderboard API endpoints
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:5001/api/v1"
TEST_USER = {
    "identifier": "bikorimanadesire@yahoo.com",
    "password": "Desire@#1"
}

def test_leaderboard_api():
    """Test the leaderboard API endpoints"""
    print("🧪 Testing Leaderboard API Endpoints...")
    
    # Step 1: Login to get auth token
    print("\n1. 🔐 Getting authentication token...")
    try:
        login_response = requests.post(
            f"{BASE_URL}/auth/login",
            json=TEST_USER,
            timeout=10
        )
        
        if login_response.status_code == 200:
            token = login_response.json().get('access_token')
            print(f"   ✅ Login successful")
        else:
            print(f"   ❌ Login failed: {login_response.status_code}")
            return
    except Exception as e:
        print(f"   ❌ Login error: {e}")
        return
    
    headers = {'Authorization': f'Bearer {token}'}
    
    # Step 2: Test leaderboard list endpoint
    print("\n2. 📋 Testing leaderboards list...")
    try:
        response = requests.get(f"{BASE_URL}/achievements/leaderboards", headers=headers, timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Found {len(data.get('leaderboards', []))} leaderboards")
            for lb in data.get('leaderboards', []):
                print(f"      - {lb.get('name')}: {lb.get('title')}")
        else:
            print(f"   ❌ Error: {response.text}")
    except Exception as e:
        print(f"   ❌ Request error: {e}")
    
    # Step 3: Test points leaderboard endpoint
    print("\n3. 🏆 Testing points leaderboard...")
    try:
        response = requests.get(f"{BASE_URL}/achievements/leaderboards/points?limit=10", headers=headers, timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            rankings = data.get('rankings', [])
            print(f"   ✅ Found {len(rankings)} rankings")
            for ranking in rankings[:3]:  # Show top 3
                print(f"      {ranking.get('rank', 'N/A')}. {ranking.get('name', 'Unknown')} - {ranking.get('score', 0)} points")
        else:
            print(f"   ❌ Error: {response.text}")
    except Exception as e:
        print(f"   ❌ Request error: {e}")
    
    # Step 4: Test specific leaderboard by name
    print("\n4. 📊 Testing total_points_alltime leaderboard...")
    try:
        response = requests.get(f"{BASE_URL}/achievements/leaderboards/total_points_alltime?limit=5", headers=headers, timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            rankings = data.get('rankings', [])
            print(f"   ✅ Found {len(rankings)} rankings")
            print(f"   📈 Total participants: {data.get('total_participants', 0)}")
            if data.get('user_rank'):
                print(f"   👤 User rank: #{data['user_rank'].get('rank', 'Unranked')}")
        else:
            print(f"   ❌ Error: {response.text}")
    except Exception as e:
        print(f"   ❌ Request error: {e}")
    
    # Step 5: Check database for any issues
    print("\n5. 🔍 Checking database state...")
    print("   Run this SQL to check leaderboards:")
    print("   SELECT name, title, metric, is_active FROM leaderboards;")
    print("   ")
    print("   Run this SQL to check student points:")
    print("   SELECT COUNT(*) as student_count FROM student_points;")
    
    print("\n✅ Leaderboard API test complete!")

if __name__ == "__main__":
    test_leaderboard_api()