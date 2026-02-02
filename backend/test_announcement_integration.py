#!/usr/bin/env python3
"""
Test the full announcement creation with email sending
"""
import requests
import json
import os

def test_announcement_creation():
    """Test creating an announcement and verify emails are sent"""
    
    print("🧪 Testing announcement creation with email sending...")
    
    # Configuration
    base_url = "http://localhost:5001/api/v1"
    
    try:
        # Step 1: Login as instructor to get JWT token
        print("\n🔐 Step 1: Logging in as instructor...")
        
        login_response = requests.post(f"{base_url}/auth/login", json={
            "identifier": "instructor@afritecbridge.com",  # Use email
            "password": "Instructor@123"  # Correct password from create_instructor.py
        })
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            print(f"Response: {login_response.text}")
            return
            
        login_data = login_response.json()
        access_token = login_data.get('access_token')
        
        if not access_token:
            print("❌ No access token received")
            return
            
        print("✅ Logged in successfully")
        
        # Step 2: Get instructor courses
        print("\n📚 Step 2: Getting instructor courses...")
        
        headers = {"Authorization": f"Bearer {access_token}"}
        courses_response = requests.get(f"{base_url}/instructor/courses", headers=headers)
        
        if courses_response.status_code != 200:
            print(f"❌ Failed to get courses: {courses_response.status_code}")
            print(f"Response: {courses_response.text}")
            return
            
        courses_data = courses_response.json()
        # Handle both list and dict responses
        if isinstance(courses_data, list):
            courses = courses_data
        else:
            courses = courses_data.get('courses', [])
        
        if not courses:
            print("❌ No courses found for instructor")
            return
            
        course_id = courses[0]['id']
        course_title = courses[0]['title']
        print(f"✅ Found course: {course_title} (ID: {course_id})")
        
        # Step 3: Create announcement
        print("\n📢 Step 3: Creating announcement...")
        
        announcement_data = {
            "course_id": course_id,
            "title": "Email Test Announcement",
            "content": "This is a test announcement to verify that emails are being sent to enrolled students. The announcement feature includes automated email notifications to keep students informed."
        }
        
        announcement_response = requests.post(
            f"{base_url}/instructor/announcements", 
            headers=headers,
            json=announcement_data
        )
        
        if announcement_response.status_code != 201:
            print(f"❌ Failed to create announcement: {announcement_response.status_code}")
            print(f"Response: {announcement_response.text}")
            return
            
        announcement_result = announcement_response.json()
        print(f"✅ Announcement created successfully: {announcement_result.get('title')}")
        print(f"📧 Emails should be sending in the background...")
        
        # Step 4: Check for enrolled students (this gives us an idea of how many emails should be sent)
        print("\n👥 Step 4: Checking enrolled students...")
        
        students_response = requests.get(f"{base_url}/instructor/students?course_id={course_id}", headers=headers)
        
        if students_response.status_code == 200:
            students_data = students_response.json()
            # Handle both list and dict responses
            if isinstance(students_data, list):
                students = students_data
            else:
                students = students_data.get('students', [])
            print(f"📊 Found {len(students)} enrolled students who should receive emails")
            
            for student in students[:3]:  # Show first 3 students
                print(f"   • {student.get('first_name', '')} {student.get('last_name', '')} ({student.get('email', 'no email')})")
                
        else:
            print("⚠️  Could not retrieve student list")
        
        print("\n🎉 Announcement creation test completed!")
        print("📧 Check the email logs in the Flask server console for email sending status")
        print("💌 Check student email inboxes for the announcement notification")
        
    except requests.exceptions.ConnectionError:
        print("❌ Connection error: Is the Flask server running on localhost:5000?")
        print("💡 Start the server with: cd backend && ./run.sh")
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_announcement_creation()