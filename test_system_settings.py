#!/usr/bin/env python3
"""
Comprehensive System Settings Test Script
Tests the complete settings functionality including validation, security, and audit features
"""

import sys
import os
import json
import requests
import traceback
from datetime import datetime

# Add the backend src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def get_admin_token():
    """Get admin authentication token"""
    try:
        # First try to login with default admin
        response = requests.post('http://localhost:5000/api/v1/auth/login', json={
            'email': 'admin@afritecbridge.com',
            'password': 'admin123'
        })
        
        if response.status_code == 200:
            return response.json()['access_token']
        
        # If no admin exists, create one
        print("Creating admin user...")
        from src.models.user_models import User, Role, db
        from src import create_app
        
        app = create_app()
        with app.app_context():
            # Create admin role if it doesn't exist
            admin_role = Role.query.filter_by(name='admin').first()
            if not admin_role:
                admin_role = Role(name='admin', description='System Administrator')
                db.session.add(admin_role)
                db.session.commit()
            
            # Create admin user if doesn't exist
            admin = User.query.filter_by(email='admin@afritecbridge.com').first()
            if not admin:
                admin = User(
                    first_name='Admin',
                    last_name='User',
                    email='admin@afritecbridge.com',
                    role_id=admin_role.id,
                    is_active=True,
                    email_verified=True
                )
                admin.set_password('admin123')
                db.session.add(admin)
                db.session.commit()
                print(f"Created admin user with ID: {admin.id}")
            
        # Now try to login again
        response = requests.post('http://localhost:5000/api/v1/auth/login', json={
            'email': 'admin@afritecbridge.com',
            'password': 'admin123'
        })
        
        if response.status_code == 200:
            return response.json()['access_token']
        else:
            print(f"Login failed: {response.text}")
            return None
            
    except Exception as e:
        print(f"Error getting admin token: {e}")
        traceback.print_exc()
        return None

def test_settings_api(token):
    """Test all settings API endpoints"""
    headers = {'Authorization': f'Bearer {token}'}
    base_url = 'http://localhost:5000/api/v1/admin/system-settings'
    
    print("\n" + "="*50)
    print("TESTING SYSTEM SETTINGS API")
    print("="*50)
    
    # Test 1: Initialize default settings
    print("\n1. Testing settings initialization...")
    try:
        response = requests.post(f'{base_url}/initialize', headers=headers)
        print(f"Initialize status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Initialization successful: {result.get('message')}")
        else:
            print(f"❌ Initialization failed: {response.text}")
    except Exception as e:
        print(f"❌ Initialize error: {e}")
    
    # Test 2: Get all settings
    print("\n2. Testing get all settings...")
    try:
        response = requests.get(base_url, headers=headers)
        print(f"Get settings status: {response.status_code}")
        if response.status_code == 200:
            settings = response.json()
            print(f"✅ Retrieved {len(settings)} settings")
            # Print sample settings
            for key, value in list(settings.items())[:3]:
                print(f"   - {key}: {value}")
        else:
            print(f"❌ Get settings failed: {response.text}")
    except Exception as e:
        print(f"❌ Get settings error: {e}")
    
    # Test 3: Update individual setting with validation
    print("\n3. Testing individual setting update with validation...")
    test_cases = [
        ('site_name', 'Afritec Bridge LMS Test', True),  # Valid
        ('site_name', '', False),  # Invalid - empty
        ('smtp_port', 587, True),  # Valid
        ('smtp_port', 99999, False),  # Invalid - out of range
        ('password_min_length', 8, True),  # Valid
        ('password_min_length', 2, False),  # Invalid - too short
        ('support_email', 'test@example.com', True),  # Valid
        ('support_email', 'invalid-email', False),  # Invalid - bad format
    ]
    
    for key, value, should_succeed in test_cases:
        try:
            response = requests.put(f'{base_url}/{key}', 
                headers=headers,
                json={'value': value, 'change_reason': f'Testing {key}'}
            )
            
            if should_succeed:
                if response.status_code == 200:
                    print(f"✅ {key} = {value} (valid) - SUCCESS")
                else:
                    print(f"❌ {key} = {value} (should be valid) - FAILED: {response.text}")
            else:
                if response.status_code == 400:
                    result = response.json()
                    print(f"✅ {key} = {value} (invalid) - CORRECTLY REJECTED: {result.get('details', {}).get('validation_errors', result.get('message'))}")
                else:
                    print(f"❌ {key} = {value} (should be invalid) - INCORRECTLY ACCEPTED")
                    
        except Exception as e:
            print(f"❌ Error testing {key}: {e}")
    
    # Test 4: Bulk update with validation
    print("\n4. Testing bulk settings update...")
    test_settings = {
        'site_name': 'Afritec Bridge LMS - Bulk Test',
        'support_email': 'support@afritecbridge.com',
        'max_students_per_course': 100,
        'session_timeout': 60,
        'password_min_length': 10
    }
    
    try:
        response = requests.put(base_url,
            headers=headers,
            json={
                'settings': test_settings,
                'change_reason': 'Bulk update test'
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Bulk update successful: {result.get('message')}")
            if result.get('data', {}).get('security_warnings'):
                print(f"⚠️  Security warnings: {result['data']['security_warnings']}")
        else:
            print(f"❌ Bulk update failed: {response.text}")
    except Exception as e:
        print(f"❌ Bulk update error: {e}")
    
    # Test 5: Test cross-field validation
    print("\n5. Testing cross-field validation...")
    invalid_settings = {
        'min_quiz_duration': 60,  # Higher than max
        'max_quiz_duration': 30   # Lower than min
    }
    
    try:
        response = requests.put(base_url,
            headers=headers,
            json={
                'settings': invalid_settings,
                'change_reason': 'Cross-field validation test'
            }
        )
        
        if response.status_code == 400:
            result = response.json()
            print(f"✅ Cross-field validation working: {result.get('details', {}).get('validation_errors')}")
        else:
            print(f"❌ Cross-field validation failed - should have been rejected")
    except Exception as e:
        print(f"❌ Cross-field validation error: {e}")
    
    # Test 6: Test audit logs
    print("\n6. Testing audit logs...")
    try:
        response = requests.get(f'{base_url}/audit-logs', headers=headers)
        if response.status_code == 200:
            logs = response.json()
            print(f"✅ Retrieved {len(logs)} audit log entries")
            if logs:
                latest = logs[0]
                print(f"   Latest: {latest.get('setting_key')} changed at {latest.get('changed_at')}")
        else:
            print(f"❌ Audit logs failed: {response.text}")
    except Exception as e:
        print(f"❌ Audit logs error: {e}")
    
    # Test 7: Test export/import
    print("\n7. Testing export/import...")
    try:
        # Export
        response = requests.get(f'{base_url}/export', headers=headers)
        if response.status_code == 200:
            exported_data = response.json()
            print(f"✅ Export successful: {len(exported_data.get('data', {}))} settings")
            
            # Import (same data - should work)
            response = requests.post(f'{base_url}/import',
                headers=headers,
                json={
                    'settings': exported_data.get('data', {}),
                    'change_reason': 'Import test'
                }
            )
            
            if response.status_code == 200:
                print(f"✅ Import successful")
            else:
                print(f"❌ Import failed: {response.text}")
        else:
            print(f"❌ Export failed: {response.text}")
    except Exception as e:
        print(f"❌ Export/Import error: {e}")

def test_backend_validation():
    """Test backend validation service directly"""
    print("\n" + "="*50)
    print("TESTING BACKEND VALIDATION")
    print("="*50)
    
    try:
        from src.utils.settings_validator import SettingsValidator, SettingsSecurityValidator
        
        # Test individual validations
        test_cases = [
            ('site_name', 'Valid Site Name', True),
            ('site_name', '', False),  # Required field
            ('smtp_port', 587, True),
            ('smtp_port', 99999, False),  # Out of range
            ('support_email', 'test@example.com', True),
            ('support_email', 'invalid-email', False),  # Invalid format
            ('password_min_length', 8, True),
            ('password_min_length', 2, False),  # Too short
        ]
        
        print("\nTesting individual validations:")
        for key, value, should_be_valid in test_cases:
            result = SettingsValidator.validate_setting(key, value)
            status = "✅" if result.is_valid == should_be_valid else "❌"
            print(f"{status} {key} = {value}: {'VALID' if result.is_valid else f'INVALID - {result.errors}'}")
        
        # Test cross-field validation
        print("\nTesting cross-field validation:")
        settings_with_conflict = {
            'min_quiz_duration': 60,
            'max_quiz_duration': 30
        }
        
        errors = SettingsValidator.validate_settings(settings_with_conflict)
        if errors:
            print(f"✅ Cross-field validation detected conflicts: {errors}")
        else:
            print(f"❌ Cross-field validation missed conflicts")
        
        # Test security implications
        print("\nTesting security validation:")
        risky_settings = {
            'password_min_length': 4,
            'max_login_attempts': 20,
            'maintenance_mode': True
        }
        
        warnings = SettingsSecurityValidator.validate_security_implications(risky_settings)
        if warnings:
            print(f"✅ Security validator found {len(warnings)} warnings:")
            for warning in warnings:
                print(f"   - {warning}")
        else:
            print(f"❌ Security validator missed potential issues")
            
    except Exception as e:
        print(f"❌ Backend validation test error: {e}")
        traceback.print_exc()

def test_frontend_validation():
    """Test frontend validation (if available)"""
    print("\n" + "="*50)
    print("TESTING FRONTEND VALIDATION")
    print("="*50)
    
    # This would require running the frontend, so just check if files exist
    frontend_path = os.path.join(os.path.dirname(__file__), 'frontend', 'src', 'utils', 'settingsValidator.ts')
    if os.path.exists(frontend_path):
        print("✅ Frontend validation service file exists")
        
        # Read and check basic structure
        with open(frontend_path, 'r') as f:
            content = f.read()
            if 'SettingsValidator' in content and 'validateSetting' in content:
                print("✅ Frontend validation service has required methods")
            else:
                print("❌ Frontend validation service missing required methods")
    else:
        print("❌ Frontend validation service file not found")

def main():
    """Main test runner"""
    print("AFRITEC BRIDGE LMS - SYSTEM SETTINGS COMPREHENSIVE TEST")
    print("=" * 60)
    print(f"Test started at: {datetime.now().isoformat()}")
    
    # Check if backend is running
    try:
        response = requests.get('http://localhost:5000/api/v1/health', timeout=5)
        if response.status_code != 200:
            print("❌ Backend is not running or not responding")
            print("   Please start the backend with: cd backend && python main.py")
            return
    except requests.exceptions.RequestException:
        print("❌ Cannot connect to backend at http://localhost:5000")
        print("   Please start the backend with: cd backend && python main.py")
        return
    
    print("✅ Backend is running")
    
    # Get admin token
    print("\nGetting admin authentication token...")
    token = get_admin_token()
    if not token:
        print("❌ Failed to get admin token")
        return
    
    print("✅ Admin token obtained")
    
    # Run tests
    test_backend_validation()
    test_settings_api(token)
    test_frontend_validation()
    
    print("\n" + "="*60)
    print("TESTING COMPLETE")
    print("="*60)
    print(f"Test completed at: {datetime.now().isoformat()}")
    
    print("\nNEXT STEPS:")
    print("1. Start frontend: cd frontend && npm run dev")
    print("2. Open http://localhost:3000/admin/settings")
    print("3. Test the settings interface manually")
    print("4. Verify validation works in the UI")

if __name__ == '__main__':
    main()