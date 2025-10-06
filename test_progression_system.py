#!/usr/bin/env python3
"""
Test Script for Enhanced Module Progression System
Tests module progression, scoring, retakes, and suspension functionality.
"""

import sys
import os
import requests
import json
from datetime import datetime, timedelta

# Configuration
API_BASE_URL = "http://localhost:5001/api/v1"
TEST_USER_CREDENTIALS = {
    "email": "student@test.com",
    "password": "testpass123"
}

class ProgressionTester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.test_course_id = None
        self.test_modules = []
        
    def authenticate(self):
        """Authenticate and get JWT token"""
        try:
            response = self.session.post(f"{API_BASE_URL}/auth/login", json=TEST_USER_CREDENTIALS)
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('access_token')
                self.session.headers.update({'Authorization': f'Bearer {self.token}'})
                print("✅ Authentication successful")
                return True
            else:
                print(f"❌ Authentication failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return False
    
    def test_enrolled_courses(self):
        """Test getting enrolled courses"""
        try:
            response = self.session.get(f"{API_BASE_URL}/student/learning/")
            if response.status_code == 200:
                data = response.json()
                courses = data.get('data', {}).get('active_courses', [])
                if courses:
                    self.test_course_id = courses[0]['id']
                    print(f"✅ Found {len(courses)} enrolled courses")
                    print(f"   Using course: {courses[0]['title']} (ID: {self.test_course_id})")
                    return True
                else:
                    print("⚠️  No enrolled courses found")
                    return False
            else:
                print(f"❌ Failed to get courses: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Error getting courses: {str(e)}")
            return False
    
    def test_course_modules(self):
        """Test getting course modules with progression data"""
        if not self.test_course_id:
            print("❌ No test course available")
            return False
            
        try:
            response = self.session.get(f"{API_BASE_URL}/student/learning/course/{self.test_course_id}/modules")
            if response.status_code == 200:
                data = response.json()
                modules = data.get('data', {}).get('modules', [])
                self.test_modules = modules
                
                print(f"✅ Found {len(modules)} modules in course")
                for i, module_data in enumerate(modules):
                    module = module_data['module']
                    progress = module_data['progress']
                    print(f"   Module {i+1}: {module['title']}")
                    print(f"   Status: {progress['status']}")
                    print(f"   Score: {progress['cumulative_score']:.1f}%")
                    print(f"   Attempts: {progress['attempts_count']}/{progress['max_attempts']}")
                    print()
                
                return True
            else:
                print(f"❌ Failed to get modules: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Error getting modules: {str(e)}")
            return False
    
    def test_suspension_status(self):
        """Test checking suspension status"""
        if not self.test_course_id:
            print("❌ No test course available")
            return False
            
        try:
            response = self.session.get(f"{API_BASE_URL}/student/learning/course/{self.test_course_id}/suspension-status")
            if response.status_code == 200:
                data = response.json()
                suspension_data = data.get('data', {})
                
                if suspension_data.get('is_suspended'):
                    details = suspension_data.get('suspension_details', {})
                    print("⚠️  Student is suspended from course")
                    print(f"   Reason: {details.get('reason')}")
                    print(f"   Can appeal: {details.get('can_submit_appeal')}")
                else:
                    print("✅ Student is not suspended")
                
                return True
            else:
                print(f"❌ Failed to check suspension: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Error checking suspension: {str(e)}")
            return False
    
    def test_module_retake(self):
        """Test module retake functionality"""
        if not self.test_modules:
            print("❌ No test modules available")
            return False
        
        # Find a failed module that can be retaken
        retakable_module = None
        for module_data in self.test_modules:
            if (module_data['progress']['status'] == 'failed' and 
                module_data['can_retake']):
                retakable_module = module_data
                break
        
        if not retakable_module:
            print("ℹ️  No failed modules available for retake test")
            return True
        
        try:
            module_id = retakable_module['module']['id']
            response = self.session.post(f"{API_BASE_URL}/student/learning/module/{module_id}/retake")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Module retake initiated: {data.get('message')}")
                return True
            else:
                print(f"❌ Failed to initiate retake: {response.status_code}")
                print(f"   Response: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Error testing retake: {str(e)}")
            return False
    
    def test_module_completion_check(self):
        """Test module completion checking"""
        if not self.test_modules:
            print("❌ No test modules available")
            return False
        
        # Find an in-progress module
        active_module = None
        for module_data in self.test_modules:
            if module_data['progress']['status'] in ['unlocked', 'in_progress']:
                active_module = module_data
                break
        
        if not active_module:
            print("ℹ️  No active modules available for completion test")
            return True
        
        try:
            module_id = active_module['module']['id']
            response = self.session.post(f"{API_BASE_URL}/student/learning/module/{module_id}/check-completion")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('module_completed'):
                    print(f"✅ Module completion check passed: {data.get('message')}")
                else:
                    print(f"ℹ️  Module completion check: {data.get('message')}")
                return True
            else:
                print(f"❌ Failed completion check: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Error testing completion check: {str(e)}")
            return False
    
    def test_appeal_submission(self):
        """Test suspension appeal submission (if suspended)"""
        if not self.test_course_id:
            print("❌ No test course available")
            return False
        
        # First check if suspended
        try:
            response = self.session.get(f"{API_BASE_URL}/student/learning/course/{self.test_course_id}/suspension-status")
            if response.status_code != 200:
                print("❌ Could not check suspension status for appeal test")
                return False
            
            data = response.json()
            suspension_data = data.get('data', {})
            
            if not suspension_data.get('is_suspended'):
                print("ℹ️  Student not suspended - skipping appeal test")
                return True
            
            details = suspension_data.get('suspension_details', {})
            if not details.get('can_submit_appeal'):
                print("ℹ️  Cannot submit appeal - skipping test")
                return True
            
            # Submit test appeal
            appeal_data = {
                "appeal_text": "This is a test appeal submission for module progression system testing."
            }
            
            response = self.session.post(
                f"{API_BASE_URL}/student/learning/course/{self.test_course_id}/submit-appeal",
                json=appeal_data
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Appeal submitted successfully: {data.get('message')}")
                return True
            else:
                print(f"❌ Failed to submit appeal: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error testing appeal: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🧪 Enhanced Module Progression System Test Suite")
        print("=" * 60)
        
        tests = [
            ("Authentication", self.authenticate),
            ("Enrolled Courses", self.test_enrolled_courses),
            ("Course Modules", self.test_course_modules),
            ("Suspension Status", self.test_suspension_status),
            ("Module Retake", self.test_module_retake),
            ("Module Completion Check", self.test_module_completion_check),
            ("Appeal Submission", self.test_appeal_submission),
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            print(f"\n🔍 Testing: {test_name}")
            print("-" * 30)
            
            try:
                if test_func():
                    passed += 1
                    print(f"✅ {test_name}: PASSED")
                else:
                    print(f"❌ {test_name}: FAILED")
            except Exception as e:
                print(f"💥 {test_name}: ERROR - {str(e)}")
        
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed! Enhanced progression system is working correctly.")
        else:
            print("⚠️  Some tests failed. Please check the issues above.")
        
        return passed == total

def main():
    """Main test function"""
    print("🚀 Starting Enhanced Module Progression System Tests")
    print("📝 Note: Make sure your backend server is running on localhost:5001")
    print("👤 Using test credentials:", TEST_USER_CREDENTIALS)
    print()
    
    # Check if backend is accessible
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=5)
        if response.status_code != 200:
            print("❌ Backend server is not responding correctly")
            print("   Please ensure the Flask app is running on localhost:5001")
            return False
    except requests.exceptions.RequestException:
        print("❌ Cannot connect to backend server")
        print("   Please ensure the Flask app is running on localhost:5001")
        return False
    
    # Run tests
    tester = ProgressionTester()
    return tester.run_all_tests()

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)