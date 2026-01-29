#!/usr/bin/env python3

import requests
import json
import sys

# Configuration
BASE_URL = "http://localhost:5001/api/v1"
INSTRUCTOR_USERNAME = "instructor@afritecbridge.com"  # Use one of the instructor users we found
INSTRUCTOR_PASSWORD = "Instructor@123"  # Try common password

def test_instructor_authentication():
    """Test instructor login and API access"""
    
    print("🔐 Testing instructor authentication...")
    
    # Step 1: Login
    login_url = f"{BASE_URL}/auth/login"
    login_data = {
        "identifier": INSTRUCTOR_USERNAME,
        "password": INSTRUCTOR_PASSWORD
    }
    
    try:
        print(f"Attempting login with username: {INSTRUCTOR_USERNAME}")
        response = requests.post(login_url, json=login_data)
        
        if response.status_code == 200:
            auth_data = response.json()
            token = auth_data.get('access_token')
            user_data = auth_data.get('user', {})
            
            print(f"✅ Login successful!")
            print(f"   User: {user_data.get('username')} (ID: {user_data.get('id')})")
            
            # Handle role data which might be string or dict
            role_data = user_data.get('role')
            if isinstance(role_data, dict):
                role_name = role_data.get('name', 'Unknown')
            elif isinstance(role_data, str):
                role_name = role_data
            else:
                role_name = 'Unknown'
            
            print(f"   Role: {role_name}")
            print(f"   Token: {token[:50] if token else 'No token'}...")
            
            # Step 2: Test protected endpoint
            if token:
                test_protected_endpoint(token)
            else:
                print("❌ No access token received")
                return False
            
        else:
            print(f"❌ Login failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend server. Is it running on port 5000?")
        return False
    except Exception as e:
        print(f"❌ Unexpected error during login: {e}")
        return False

def test_protected_endpoint(token):
    """Test accessing a protected instructor endpoint"""
    
    print("\n📊 Testing protected instructor endpoint...")
    
    # Test the dashboard endpoint first (more likely to work)
    dashboard_url = f"{BASE_URL}/instructor/dashboard"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        print("Testing dashboard endpoint first...")
        response = requests.get(dashboard_url, headers=headers)
        
        if response.status_code == 200:
            print(f"✅ Dashboard endpoint access successful!")
            data = response.json()
            print(f"   Dashboard data keys: {list(data.keys())}")
            
            # Now test the analytics endpoint
            test_analytics_endpoint(token)
            
            # Now test the full credit endpoints
            test_full_credit_endpoints(token)
            
        elif response.status_code == 403:
            print(f"❌ Access denied (403) to dashboard")
            print(f"   Response: {response.json()}")
        elif response.status_code == 500:
            print(f"❌ Server error (500) on dashboard")
            print(f"   Response: {response.text}")
        else:
            print(f"❌ Unexpected status on dashboard: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error accessing dashboard endpoint: {e}")

def test_analytics_endpoint(token):
    """Test the analytics endpoint that was recently added"""
    
    print("\n📈 Testing analytics endpoint...")
    
    analytics_url = f"{BASE_URL}/instructor/students/analytics"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(analytics_url, headers=headers)
        
        if response.status_code == 200:
            print(f"✅ Analytics endpoint access successful!")
            data = response.json()
            print(f"   Analytics data keys: {list(data.keys())}")
        elif response.status_code == 403:
            print(f"❌ Access denied (403) to analytics")
            print(f"   Response: {response.json()}")
        elif response.status_code == 500:
            print(f"❌ Server error (500) on analytics")
            print(f"   Response: {response.text}")
        else:
            print(f"❌ Unexpected status on analytics: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error accessing analytics endpoint: {e}")

def test_full_credit_endpoints(token):
    """Test the full credit management endpoints"""
    
    print("\n💳 Testing Full Credit Management endpoints...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # First, get some students and courses to work with
    try:
        # Get instructor's students
        students_url = f"{BASE_URL}/instructor/students"
        students_response = requests.get(students_url, headers=headers)
        
        if students_response.status_code == 200:
            students = students_response.json()
            print(f"✅ Found {len(students)} students")
            
            if students:
                student = students[0]  # Use first student
                student_id = student['id']
                print(f"   Testing with student: {student.get('username')} (ID: {student_id})")
                
                # Get instructor's courses
                courses_url = f"{BASE_URL}/instructor/courses"
                courses_response = requests.get(courses_url, headers=headers)
                
                if courses_response.status_code == 200:
                    courses = courses_response.json()
                    print(f"✅ Found {len(courses)} courses")
                    
                    if courses:
                        course = courses[0]  # Use first course
                        course_id = course['id']
                        print(f"   Testing with course: {course.get('title')} (ID: {course_id})")
                        
                        # Get modules for this course
                        modules_url = f"{BASE_URL}/instructor/courses/{course_id}/modules"
                        modules_response = requests.get(modules_url, headers=headers)
                        
                        if modules_response.status_code == 200:
                            modules = modules_response.json()
                            print(f"✅ Found {len(modules)} modules")
                            
                            if modules:
                                module = modules[0]  # Use first module
                                module_id = module['id']
                                print(f"   Testing with module: {module.get('title')} (ID: {module_id})")
                                
                                # Test the full credit endpoint
                                test_give_full_credit(token, student_id, module_id)
                            else:
                                print("⚠️  No modules found to test full credit")
                        else:
                            print(f"❌ Could not fetch modules: {modules_response.status_code}")
                    else:
                        print("⚠️  No courses found to test full credit")
                else:
                    print(f"❌ Could not fetch courses: {courses_response.status_code}")
            else:
                print("⚠️  No students found to test full credit")
        else:
            print(f"❌ Could not fetch students: {students_response.status_code}")
            print(f"   Response: {students_response.text}")
            
    except Exception as e:
        print(f"❌ Error testing full credit endpoints: {e}")

def test_give_full_credit(token, student_id, module_id):
    """Test giving full credit to a specific student for a specific module"""
    
    print(f"\n🏆 Testing full credit assignment for student {student_id}, module {module_id}...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    full_credit_url = f"{BASE_URL}/instructor/students/{student_id}/modules/{module_id}/full-credit"
    
    try:
        # Test the full credit endpoint
        response = requests.post(full_credit_url, headers=headers, json={})
        
        if response.status_code == 200:
            print("✅ Full credit assignment successful!")
            data = response.json()
            print(f"   Response: {data.get('message', 'No message')}")
            if 'details' in data:
                details = data['details']
                print(f"   Lessons updated: {details.get('lessons_updated', 0)}")
                print(f"   Quizzes updated: {details.get('quizzes_updated', 0)}")
                print(f"   Assignments updated: {details.get('assignments_updated', 0)}")
        elif response.status_code == 404:
            print(f"⚠️  Not found (404) - student or module might not exist or not enrolled")
            print(f"   Response: {response.text}")
        elif response.status_code == 403:
            print(f"❌ Access denied (403)")
            print(f"   Response: {response.json()}")
        elif response.status_code == 400:
            print(f"⚠️  Bad request (400) - might be validation error")
            print(f"   Response: {response.text}")
        elif response.status_code == 500:
            print(f"❌ Server error (500)")
            print(f"   Response: {response.text}")
        else:
            print(f"❌ Unexpected status: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing full credit assignment: {e}")

if __name__ == "__main__":
    test_instructor_authentication()