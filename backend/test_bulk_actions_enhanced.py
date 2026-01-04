#!/usr/bin/env python3
"""
Test script for enhanced bulk user actions
Tests the improved bulk action endpoint with various scenarios
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:5001/api/v1"
ADMIN_TOKEN = None  # Will be set after login

def login_admin():
    """Login as admin and get JWT token"""
    global ADMIN_TOKEN
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "admin@afritechbridge.online",  # Update with your admin email
        "password": "admin123"  # Update with your admin password
    })
    
    if response.status_code == 200:
        ADMIN_TOKEN = response.json()["access_token"]
        print("✓ Admin login successful")
        return True
    else:
        print(f"✗ Login failed: {response.text}")
        return False

def get_headers():
    """Get request headers with auth token"""
    return {
        "Authorization": f"Bearer {ADMIN_TOKEN}",
        "Content-Type": "application/json"
    }

def test_bulk_activate():
    """Test bulk user activation"""
    print("\n=== Test: Bulk Activate Users ===")
    
    # First, get some users
    response = requests.get(
        f"{BASE_URL}/admin/users?per_page=5",
        headers=get_headers()
    )
    
    if response.status_code != 200:
        print(f"✗ Failed to fetch users: {response.text}")
        return
    
    users = response.json().get("users", [])
    if len(users) < 2:
        print("✗ Not enough users to test")
        return
    
    # Get user IDs
    user_ids = [user["id"] for user in users[:2]]
    
    # Perform bulk activate
    response = requests.post(
        f"{BASE_URL}/admin/users/bulk-action",
        headers=get_headers(),
        json={
            "user_ids": user_ids,
            "action": "activate"
        }
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"✓ Bulk activate successful")
        print(f"  Affected users: {result['affected_users']}/{result['total_requested']}")
        if result.get('warnings'):
            print(f"  Warnings: {result['warnings']}")
    else:
        print(f"✗ Bulk activate failed: {response.text}")

def test_bulk_deactivate():
    """Test bulk user deactivation"""
    print("\n=== Test: Bulk Deactivate Users ===")
    
    # Get some users (skip admin)
    response = requests.get(
        f"{BASE_URL}/admin/users?role=student&per_page=3",
        headers=get_headers()
    )
    
    if response.status_code != 200:
        print(f"✗ Failed to fetch users: {response.text}")
        return
    
    users = response.json().get("users", [])
    if len(users) < 1:
        print("✗ No student users to test")
        return
    
    user_ids = [user["id"] for user in users[:2]]
    
    # Perform bulk deactivate
    response = requests.post(
        f"{BASE_URL}/admin/users/bulk-action",
        headers=get_headers(),
        json={
            "user_ids": user_ids,
            "action": "deactivate"
        }
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"✓ Bulk deactivate successful")
        print(f"  Affected users: {result['affected_users']}/{result['total_requested']}")
        if result.get('warnings'):
            print(f"  Warnings: {result['warnings']}")
    else:
        print(f"✗ Bulk deactivate failed: {response.text}")

def test_bulk_change_role():
    """Test bulk role change"""
    print("\n=== Test: Bulk Change Role ===")
    
    # Get some student users
    response = requests.get(
        f"{BASE_URL}/admin/users?role=student&per_page=2",
        headers=get_headers()
    )
    
    if response.status_code != 200:
        print(f"✗ Failed to fetch users: {response.text}")
        return
    
    users = response.json().get("users", [])
    if len(users) < 1:
        print("✗ No student users to test")
        return
    
    user_ids = [users[0]["id"]]
    
    # Perform bulk role change
    response = requests.post(
        f"{BASE_URL}/admin/users/bulk-action",
        headers=get_headers(),
        json={
            "user_ids": user_ids,
            "action": "change_role",
            "role_name": "instructor"
        }
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"✓ Bulk role change successful")
        print(f"  Affected users: {result['affected_users']}/{result['total_requested']}")
        if result.get('warnings'):
            print(f"  Warnings: {result['warnings']}")
        
        # Change back to student
        requests.post(
            f"{BASE_URL}/admin/users/bulk-action",
            headers=get_headers(),
            json={
                "user_ids": user_ids,
                "action": "change_role",
                "role_name": "student"
            }
        )
        print("  (Reverted role back to student)")
    else:
        print(f"✗ Bulk role change failed: {response.text}")

def test_invalid_action():
    """Test invalid action handling"""
    print("\n=== Test: Invalid Action ===")
    
    response = requests.post(
        f"{BASE_URL}/admin/users/bulk-action",
        headers=get_headers(),
        json={
            "user_ids": [1, 2],
            "action": "invalid_action"
        }
    )
    
    if response.status_code == 400:
        result = response.json()
        print(f"✓ Invalid action rejected correctly")
        print(f"  Error: {result['error']}")
        if result.get('valid_actions'):
            print(f"  Valid actions: {result['valid_actions']}")
    else:
        print(f"✗ Expected 400 error for invalid action")

def test_self_deactivation():
    """Test prevention of self-deactivation"""
    print("\n=== Test: Self-Deactivation Prevention ===")
    
    # Get current admin user ID
    response = requests.get(
        f"{BASE_URL}/users/me",
        headers=get_headers()
    )
    
    if response.status_code != 200:
        print("✗ Failed to get current user")
        return
    
    current_user_id = response.json()["id"]
    
    # Try to deactivate self
    response = requests.post(
        f"{BASE_URL}/admin/users/bulk-action",
        headers=get_headers(),
        json={
            "user_ids": [current_user_id],
            "action": "deactivate"
        }
    )
    
    if response.status_code == 400:
        result = response.json()
        print(f"✓ Self-deactivation prevented correctly")
        print(f"  Error: {result['error']}")
    else:
        print(f"✗ Self-deactivation should have been prevented")

def test_export_csv():
    """Test CSV export"""
    print("\n=== Test: Export Users (CSV) ===")
    
    response = requests.get(
        f"{BASE_URL}/admin/users/export?format=csv&role=student",
        headers=get_headers()
    )
    
    if response.status_code == 200:
        print(f"✓ CSV export successful")
        print(f"  Content-Type: {response.headers.get('Content-Type')}")
        print(f"  Size: {len(response.content)} bytes")
        # Print first few lines
        lines = response.text.split('\n')[:3]
        print(f"  Preview:")
        for line in lines:
            print(f"    {line}")
    else:
        print(f"✗ CSV export failed: {response.text}")

def test_export_json():
    """Test JSON export"""
    print("\n=== Test: Export Users (JSON) ===")
    
    response = requests.get(
        f"{BASE_URL}/admin/users/export?format=json&per_page=5",
        headers=get_headers()
    )
    
    if response.status_code == 200:
        print(f"✓ JSON export successful")
        print(f"  Content-Type: {response.headers.get('Content-Type')}")
        data = response.json()
        print(f"  Number of users: {len(data)}")
        if data:
            print(f"  First user: {data[0].get('username')} ({data[0].get('email')})")
    else:
        print(f"✗ JSON export failed: {response.text}")

def test_bulk_limit():
    """Test bulk action limit"""
    print("\n=== Test: Bulk Action Limit ===")
    
    # Try to perform action on more than 100 users
    user_ids = list(range(1, 102))  # 101 IDs
    
    response = requests.post(
        f"{BASE_URL}/admin/users/bulk-action",
        headers=get_headers(),
        json={
            "user_ids": user_ids,
            "action": "activate"
        }
    )
    
    if response.status_code == 400:
        result = response.json()
        print(f"✓ Bulk limit enforced correctly")
        print(f"  Error: {result['error']}")
    else:
        print(f"✗ Bulk limit should have been enforced")

def main():
    """Run all tests"""
    print("=" * 60)
    print("Enhanced Bulk Actions Test Suite")
    print("=" * 60)
    print(f"Testing API: {BASE_URL}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Login first
    if not login_admin():
        print("\n✗ Cannot proceed without admin login")
        return
    
    # Run tests
    test_bulk_activate()
    test_bulk_deactivate()
    test_bulk_change_role()
    test_invalid_action()
    test_self_deactivation()
    test_export_csv()
    test_export_json()
    test_bulk_limit()
    
    print("\n" + "=" * 60)
    print("Tests completed!")
    print("=" * 60)

if __name__ == "__main__":
    main()
