#!/usr/bin/env python3
"""
Test lesson publishing with existing course
"""

import requests
import json

def test_with_existing_course():
    """Test lesson publishing with course 7"""
    
    base_url = "http://localhost:5001/api/v1"
    
    # Login first
    print("1. Logging in...")
    login_data = {
        "identifier": "instructor",
        "password": "Instructor@123"
    }
    
    login_response = requests.post(
        f"{base_url}/auth/login", 
        json=login_data,
        headers={"Content-Type": "application/json"},
        timeout=5
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        return
        
    token_data = login_response.json()
    token = token_data.get('access_token')
    user = token_data.get('user')
    print(f"✅ Login successful - User ID: {user.get('id')}")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Get course 7 details to see its structure
    print("\n2. Getting course 7 details...")
    course_response = requests.get(
        f"{base_url}/instructor/courses/7",
        headers=headers,
        timeout=5
    )
    
    if course_response.status_code == 200:
        course_data = course_response.json()
        print(f"✅ Course 7 found: {course_data.get('title')}")
        print(f"Instructor ID: {course_data.get('instructor_id')}")
        
        modules = course_data.get('modules', [])
        print(f"Modules: {len(modules)}")
        
        if modules:
            module = modules[0]
            module_id = module.get('id')
            print(f"Using module ID: {module_id}")
            
            lessons = module.get('lessons', [])
            print(f"Lessons in module: {len(lessons)}")
            
            if lessons:
                lesson = lessons[0]
                lesson_id = lesson.get('id')
                print(f"Using lesson ID: {lesson_id}")
                print(f"Current lesson published status: {lesson.get('is_published')}")
                
                # Try to publish the lesson
                print(f"\n3. Testing lesson publishing...")
                publish_data = {"is_published": True}
                
                publish_response = requests.put(
                    f"{base_url}/instructor/courses/7/modules/{module_id}/lessons/{lesson_id}",
                    json=publish_data,
                    headers=headers,
                    timeout=5
                )
                
                print(f"Lesson publish status: {publish_response.status_code}")
                print(f"Response: {publish_response.text}")
                
                if publish_response.status_code == 200:
                    print("🎉 Lesson publishing works!")
                    return True
                else:
                    print("❌ Lesson publishing failed")
            else:
                print("No lessons found in module")
        else:
            print("No modules found in course")
    else:
        print(f"❌ Failed to get course 7: {course_response.text}")
    
    return False

if __name__ == "__main__":
    print("Testing Lesson Publishing with Existing Course")
    print("=" * 50)
    
    success = test_with_existing_course()
    
    if success:
        print("\n🎉 Lesson publishing works!")
    else:
        print("\n❌ Lesson publishing failed")