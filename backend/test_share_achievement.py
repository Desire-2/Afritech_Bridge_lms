#!/usr/bin/env python3
"""
Test script for achievement sharing API
"""
import requests
import json

# Test configuration
BASE_URL = "http://localhost:5000/api/v1"

def test_share_achievement():
    """Test the share achievement endpoint"""
    
    # Test data - Use achievement ID 1 which user 5 has
    achievement_id = 1
    platform = "twitter"
    
    # You would need to get a valid JWT token for user 5
    # For now, let's just test the endpoint structure
    headers = {
        "Content-Type": "application/json",
        # "Authorization": "Bearer YOUR_JWT_TOKEN_HERE"
    }
    
    data = {
        "platform": platform
    }
    
    try:
        # Test the share endpoint
        response = requests.post(
            f"{BASE_URL}/achievements/{achievement_id}/share",
            headers=headers,
            json=data
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            print("✅ Share tracking successful!")
        elif response.status_code == 404:
            print("❌ Achievement not found or not earned by user")
        elif response.status_code == 401:
            print("❌ Authentication required (need JWT token)")
        else:
            print(f"❌ Unexpected status code: {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to backend. Make sure the backend server is running.")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("Testing Achievement Sharing API")
    print("=" * 40)
    test_share_achievement()