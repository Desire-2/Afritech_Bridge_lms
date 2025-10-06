#!/usr/bin/env python3
"""
Debug script to check course ownership and lesson publishing
"""

import requests
import json

def debug_course_ownership():
    """Debug course ownership and lesson structure"""
    
    base_url = "http://localhost:5001/api/v1"
    
    # Login first
    print("1. Logging in...")
    login_data = {
        "identifier": "instructor",
        "password": "Instructor@123"
    }
    
    try:
        login_response = requests.post(
            f"{base_url}/auth/login", 
            json=login_data,
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            print(f"Response: {login_response.text}")
            return
            
        token_data = login_response.json()
        token = token_data.get('access_token')
        user = token_data.get('user')
        print(f"✅ Login successful")
        print(f"User ID: {user.get('id')}, Username: {user.get('username')}, Role: {user.get('role')}")
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # Check instructor's courses
        print(f"\n2. Getting instructor's courses...")
        courses_response = requests.get(
            f"{base_url}/instructor/courses",
            headers=headers,
            timeout=5
        )
        
        print(f"Courses endpoint status: {courses_response.status_code}")
        if courses_response.status_code == 200:
            courses = courses_response.json()
            print(f"Found {len(courses)} courses:")
            for course in courses:
                print(f"  - Course ID: {course.get('id')}, Title: {course.get('title')}, Instructor ID: {course.get('instructor_id')}")
        else:
            print(f"Courses response: {courses_response.text}")
        
        # Check all courses (if accessible)
        print(f"\n3. Getting all courses...")
        all_courses_response = requests.get(
            f"{base_url}/courses",
            headers=headers,
            timeout=5
        )
        
        print(f"All courses endpoint status: {all_courses_response.status_code}")
        if all_courses_response.status_code == 200:
            all_courses = all_courses_response.json()
            print(f"Found {len(all_courses)} total courses:")
            for course in all_courses:
                print(f"  - Course ID: {course.get('id')}, Title: {course.get('title')}, Instructor ID: {course.get('instructor_id')}")
        
        # Try to get course 1 details
        print(f"\n4. Getting course 1 details...")
        course_response = requests.get(
            f"{base_url}/instructor/courses/1",
            headers=headers,
            timeout=5
        )
        
        print(f"Course 1 details status: {course_response.status_code}")
        if course_response.status_code == 200:
            course_data = course_response.json()
            print(f"Course 1 data: {json.dumps(course_data, indent=2)[:500]}...")
        else:
            print(f"Course 1 response: {course_response.text}")
            
        # Create a test course if needed
        print(f"\n5. Creating a test course...")
        create_course_data = {
            "title": "Test Course for Lesson Publishing",
            "description": "A test course to debug lesson publishing"
        }
        
        create_response = requests.post(
            f"{base_url}/instructor/courses",
            json=create_course_data,
            headers=headers,
            timeout=5
        )
        
        print(f"Create course status: {create_response.status_code}")
        if create_response.status_code == 201:
            new_course = create_response.json()
            course_id = new_course.get('course', {}).get('id')
            print(f"✅ Created test course with ID: {course_id}")
            
            # Create a module
            print(f"\n6. Creating a test module...")
            create_module_data = {
                "title": "Test Module",
                "description": "A test module"
            }
            
            module_response = requests.post(
                f"{base_url}/instructor/courses/{course_id}/modules",
                json=create_module_data,
                headers=headers,
                timeout=5
            )
            
            print(f"Create module status: {module_response.status_code}")
            if module_response.status_code == 201:
                module_data = module_response.json()
                module_id = module_data.get('module', {}).get('id')
                print(f"✅ Created test module with ID: {module_id}")
                
                # Create a lesson
                print(f"\n7. Creating a test lesson...")
                create_lesson_data = {
                    "title": "Test Lesson",
                    "content_type": "text",
                    "content_data": "This is a test lesson content"
                }
                
                lesson_response = requests.post(
                    f"{base_url}/instructor/courses/{course_id}/modules/{module_id}/lessons",
                    json=create_lesson_data,
                    headers=headers,
                    timeout=5
                )
                
                print(f"Create lesson status: {lesson_response.status_code}")
                if lesson_response.status_code == 201:
                    lesson_data = lesson_response.json()
                    lesson_id = lesson_data.get('lesson', {}).get('id')
                    print(f"✅ Created test lesson with ID: {lesson_id}")
                    
                    # Now try to publish the lesson
                    print(f"\n8. Testing lesson publishing...")
                    publish_data = {"is_published": True}
                    
                    publish_response = requests.put(
                        f"{base_url}/instructor/courses/{course_id}/modules/{module_id}/lessons/{lesson_id}",
                        json=publish_data,
                        headers=headers,
                        timeout=5
                    )
                    
                    print(f"Lesson publish status: {publish_response.status_code}")
                    if publish_response.status_code == 200:
                        print("🎉 Lesson publishing works!")
                        print(f"Response: {publish_response.text[:200]}")
                        return True
                    else:
                        print(f"❌ Lesson publishing failed: {publish_response.text}")
                else:
                    print(f"❌ Failed to create lesson: {lesson_response.text}")
            else:
                print(f"❌ Failed to create module: {module_response.text}")
        else:
            print(f"❌ Failed to create course: {create_response.text}")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False
    
    return False

if __name__ == "__main__":
    print("Debugging Course Ownership and Lesson Publishing")
    print("=" * 55)
    
    success = debug_course_ownership()
    
    if success:
        print("\n🎉 Lesson publishing debug successful!")
    else:
        print("\n❌ Issues found during debugging")