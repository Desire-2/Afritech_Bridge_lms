#!/usr/bin/env python3
"""
Test script for bulk application actions endpoint
Tests the /api/v1/applications/bulk-action endpoint
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:5000/api/v1"
# BASE_URL = "https://afritech-bridge-lms-pc6f.onrender.com/api/v1"

# Test credentials (update with actual admin credentials)
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"

def get_auth_token():
    """Login and get JWT token"""
    print("🔐 Logging in...")
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
    )
    
    if response.status_code == 200:
        token = response.json().get("access_token")
        print(f"✅ Login successful. Token: {token[:20]}...")
        return token
    else:
        print(f"❌ Login failed: {response.status_code}")
        print(response.json())
        return None

def test_bulk_action_validation(token):
    """Test input validation"""
    print("\n" + "="*60)
    print("TEST 1: Input Validation")
    print("="*60)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 1: Missing action
    print("\n1️⃣ Testing missing action...")
    response = requests.post(
        f"{BASE_URL}/applications/bulk-action",
        headers=headers,
        json={"application_ids": [1, 2, 3]}
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 400, "Should return 400 for missing action"
    
    # Test 2: Invalid action
    print("\n2️⃣ Testing invalid action...")
    response = requests.post(
        f"{BASE_URL}/applications/bulk-action",
        headers=headers,
        json={
            "action": "delete",
            "application_ids": [1, 2, 3]
        }
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 400, "Should return 400 for invalid action"
    
    # Test 3: Empty application_ids
    print("\n3️⃣ Testing empty application_ids...")
    response = requests.post(
        f"{BASE_URL}/applications/bulk-action",
        headers=headers,
        json={
            "action": "approve",
            "application_ids": []
        }
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 400, "Should return 400 for empty IDs"
    
    # Test 4: Too many applications
    print("\n4️⃣ Testing too many applications...")
    response = requests.post(
        f"{BASE_URL}/applications/bulk-action",
        headers=headers,
        json={
            "action": "approve",
            "application_ids": list(range(1, 102))  # 101 IDs
        }
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 400, "Should return 400 for too many IDs"
    
    # Test 5: Reject without reason
    print("\n5️⃣ Testing reject without reason...")
    response = requests.post(
        f"{BASE_URL}/applications/bulk-action",
        headers=headers,
        json={
            "action": "reject",
            "application_ids": [1, 2]
        }
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 400, "Should return 400 for reject without reason"
    
    print("\n✅ All validation tests passed!")

def test_bulk_approve(token, application_ids):
    """Test bulk approve action"""
    print("\n" + "="*60)
    print("TEST 2: Bulk Approve")
    print("="*60)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n📝 Approving applications: {application_ids}")
    response = requests.post(
        f"{BASE_URL}/applications/bulk-action",
        headers=headers,
        json={
            "action": "approve",
            "application_ids": application_ids,
            "custom_message": "Welcome to our program! We're excited to have you.",
            "send_emails": False  # Disable for testing
        }
    )
    
    print(f"Status: {response.status_code}")
    result = response.json()
    print(json.dumps(result, indent=2))
    
    if response.status_code == 200:
        print(f"\n✅ Successful: {result['successful']}")
        print(f"❌ Failed: {result['failed']}")
        if result['failed'] > 0:
            print("\nFailed applications:")
            for fail in result['results']['failed']:
                print(f"  - ID {fail['id']}: {fail['error']}")
    
    return response.status_code == 200

def test_bulk_reject(token, application_ids):
    """Test bulk reject action"""
    print("\n" + "="*60)
    print("TEST 3: Bulk Reject")
    print("="*60)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n📝 Rejecting applications: {application_ids}")
    response = requests.post(
        f"{BASE_URL}/applications/bulk-action",
        headers=headers,
        json={
            "action": "reject",
            "application_ids": application_ids,
            "rejection_reason": "Course prerequisites not met. Please review requirements.",
            "send_emails": False  # Disable for testing
        }
    )
    
    print(f"Status: {response.status_code}")
    result = response.json()
    print(json.dumps(result, indent=2))
    
    if response.status_code == 200:
        print(f"\n✅ Successful: {result['successful']}")
        print(f"❌ Failed: {result['failed']}")
    
    return response.status_code == 200

def test_bulk_waitlist(token, application_ids):
    """Test bulk waitlist action"""
    print("\n" + "="*60)
    print("TEST 4: Bulk Waitlist")
    print("="*60)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n📝 Waitlisting applications: {application_ids}")
    response = requests.post(
        f"{BASE_URL}/applications/bulk-action",
        headers=headers,
        json={
            "action": "waitlist",
            "application_ids": application_ids,
            "custom_message": "We will contact you if a spot opens up.",
            "send_emails": False  # Disable for testing
        }
    )
    
    print(f"Status: {response.status_code}")
    result = response.json()
    print(json.dumps(result, indent=2))
    
    if response.status_code == 200:
        print(f"\n✅ Successful: {result['successful']}")
        print(f"❌ Failed: {result['failed']}")
    
    return response.status_code == 200

def get_pending_applications(token):
    """Get list of pending applications"""
    print("\n🔍 Fetching pending applications...")
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(
        f"{BASE_URL}/applications?status=pending",
        headers=headers
    )
    
    if response.status_code == 200:
        data = response.json()
        applications = data.get('applications', [])
        print(f"Found {len(applications)} pending applications")
        return [app['id'] for app in applications[:5]]  # Return first 5 IDs
    else:
        print(f"Failed to fetch applications: {response.status_code}")
        return []

def main():
    """Run all tests"""
    print("🚀 Starting Bulk Actions Test Suite")
    print(f"Base URL: {BASE_URL}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Get auth token
    token = get_auth_token()
    if not token:
        print("❌ Failed to get auth token. Exiting.")
        sys.exit(1)
    
    # Run validation tests
    try:
        test_bulk_action_validation(token)
    except Exception as e:
        print(f"❌ Validation tests failed: {e}")
        sys.exit(1)
    
    # Get some pending applications for testing
    pending_ids = get_pending_applications(token)
    
    if not pending_ids:
        print("\n⚠️  No pending applications found. Skipping action tests.")
        print("Create some test applications first.")
        sys.exit(0)
    
    # Run action tests with real data
    print(f"\n📋 Using application IDs: {pending_ids}")
    
    # Test bulk approve (use first 2 IDs)
    if len(pending_ids) >= 2:
        test_bulk_approve(token, pending_ids[:2])
    
    # Test bulk waitlist (use next 2 IDs)
    if len(pending_ids) >= 4:
        test_bulk_waitlist(token, pending_ids[2:4])
    
    # Test bulk reject (use last ID)
    if len(pending_ids) >= 5:
        test_bulk_reject(token, [pending_ids[4]])
    
    print("\n" + "="*60)
    print("🎉 All tests completed!")
    print("="*60)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Test suite failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
