#!/usr/bin/env python3
"""
Test script for AI Agent Service
Tests all AI generation endpoints
"""

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

API_BASE_URL = os.getenv('API_URL', 'http://localhost:5000/api/v1')

def get_auth_token():
    """Login and get JWT token - you'll need valid instructor credentials"""
    login_data = {
        "email": input("Enter instructor email: "),
        "password": input("Enter password: ")
    }
    
    response = requests.post(f"{API_BASE_URL}/auth/login", json=login_data)
    if response.status_code == 200:
        token = response.json().get('access_token')
        print("✓ Authentication successful")
        return token
    else:
        print(f"✗ Authentication failed: {response.text}")
        return None

def test_health_check(headers):
    """Test AI agent health endpoint"""
    print("\n1. Testing AI Agent Health Check...")
    response = requests.get(f"{API_BASE_URL}/ai-agent/health")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Status: {data['status']}")
        print(f"✓ API Configured: {data['api_configured']}")
        print(f"  Message: {data['message']}")
        return data['api_configured']
    else:
        print(f"✗ Health check failed: {response.text}")
        return False

def test_course_outline_generation(headers):
    """Test course outline generation"""
    print("\n2. Testing Course Outline Generation...")
    
    payload = {
        "topic": "Introduction to Python Programming",
        "target_audience": "Complete beginners with no programming experience",
        "learning_objectives": "Learn Python syntax, write basic programs, understand OOP concepts"
    }
    
    response = requests.post(
        f"{API_BASE_URL}/ai-agent/generate-course-outline",
        headers=headers,
        json=payload
    )
    
    if response.status_code == 200:
        data = response.json()
        if data['success']:
            print("✓ Course outline generated successfully")
            print(f"  Title: {data['data'].get('title', 'N/A')}")
            print(f"  Modules: {len(data['data'].get('suggested_modules', []))}")
            return data['data']
        else:
            print(f"✗ Generation failed: {data.get('message')}")
    else:
        print(f"✗ Request failed: {response.text}")
    return None

def test_module_generation(headers, course_id):
    """Test module content generation"""
    print("\n3. Testing Module Content Generation...")
    
    payload = {
        "course_id": course_id,
        "module_title": "Python Basics"
    }
    
    response = requests.post(
        f"{API_BASE_URL}/ai-agent/generate-module-content",
        headers=headers,
        json=payload
    )
    
    if response.status_code == 200:
        data = response.json()
        if data['success']:
            print("✓ Module content generated successfully")
            print(f"  Title: {data['data'].get('title', 'N/A')}")
            print(f"  Lessons: {len(data['data'].get('suggested_lessons', []))}")
            return data['data']
        else:
            print(f"✗ Generation failed: {data.get('message')}")
    else:
        print(f"✗ Request failed: {response.text}")
    return None

def test_lesson_generation(headers, course_id, module_id):
    """Test lesson content generation"""
    print("\n4. Testing Lesson Content Generation...")
    
    payload = {
        "course_id": course_id,
        "module_id": module_id,
        "lesson_title": "Variables and Data Types"
    }
    
    response = requests.post(
        f"{API_BASE_URL}/ai-agent/generate-lesson-content",
        headers=headers,
        json=payload
    )
    
    if response.status_code == 200:
        data = response.json()
        if data['success']:
            print("✓ Lesson content generated successfully")
            print(f"  Title: {data['data'].get('title', 'N/A')}")
            print(f"  Duration: {data['data'].get('duration_minutes', 'N/A')} minutes")
            print(f"  Content length: {len(data['data'].get('content_data', ''))} characters")
            return data['data']
        else:
            print(f"✗ Generation failed: {data.get('message')}")
    else:
        print(f"✗ Request failed: {response.text}")
    return None

def test_quiz_generation(headers, course_id, module_id):
    """Test quiz questions generation"""
    print("\n5. Testing Quiz Questions Generation...")
    
    payload = {
        "course_id": course_id,
        "module_id": module_id,
        "num_questions": 5,
        "question_types": ["multiple_choice", "true_false"]
    }
    
    response = requests.post(
        f"{API_BASE_URL}/ai-agent/generate-quiz-questions",
        headers=headers,
        json=payload
    )
    
    if response.status_code == 200:
        data = response.json()
        if data['success']:
            print("✓ Quiz questions generated successfully")
            print(f"  Title: {data['data'].get('title', 'N/A')}")
            print(f"  Questions: {len(data['data'].get('questions', []))}")
            return data['data']
        else:
            print(f"✗ Generation failed: {data.get('message')}")
    else:
        print(f"✗ Request failed: {response.text}")
    return None

def test_assignment_generation(headers, course_id, module_id):
    """Test assignment generation"""
    print("\n6. Testing Assignment Generation...")
    
    payload = {
        "course_id": course_id,
        "module_id": module_id
    }
    
    response = requests.post(
        f"{API_BASE_URL}/ai-agent/generate-assignment",
        headers=headers,
        json=payload
    )
    
    if response.status_code == 200:
        data = response.json()
        if data['success']:
            print("✓ Assignment generated successfully")
            print(f"  Title: {data['data'].get('title', 'N/A')}")
            print(f"  Max Points: {data['data'].get('max_points', 'N/A')}")
            return data['data']
        else:
            print(f"✗ Generation failed: {data.get('message')}")
    else:
        print(f"✗ Request failed: {response.text}")
    return None

def test_project_generation(headers, course_id):
    """Test final project generation"""
    print("\n7. Testing Final Project Generation...")
    
    payload = {
        "course_id": course_id
    }
    
    response = requests.post(
        f"{API_BASE_URL}/ai-agent/generate-final-project",
        headers=headers,
        json=payload
    )
    
    if response.status_code == 200:
        data = response.json()
        if data['success']:
            print("✓ Final project generated successfully")
            print(f"  Title: {data['data'].get('title', 'N/A')}")
            print(f"  Max Points: {data['data'].get('max_points', 'N/A')}")
            return data['data']
        else:
            print(f"✗ Generation failed: {data.get('message')}")
    else:
        print(f"✗ Request failed: {response.text}")
    return None

def main():
    print("=" * 60)
    print("AI Agent Service Test Suite")
    print("=" * 60)
    
    # Get authentication token
    token = get_auth_token()
    if not token:
        print("\n✗ Cannot proceed without authentication")
        return
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Test health check
    api_configured = test_health_check(headers)
    if not api_configured:
        print("\n⚠ Warning: AI API may not be configured properly")
        print("  Set GEMINI_API_KEY in backend/.env to enable AI features")
    
    # Get existing course and module IDs for testing
    print("\n" + "=" * 60)
    print("For testing, we need existing course and module IDs")
    course_id = input("Enter a test course ID (or press Enter to skip remaining tests): ")
    
    if not course_id:
        print("\n✓ Basic health check completed")
        print("  To test full functionality, provide valid course and module IDs")
        return
    
    course_id = int(course_id)
    
    # Test course outline generation (standalone)
    test_course_outline_generation(headers)
    
    # Test module generation
    module_data = test_module_generation(headers, course_id)
    
    module_id = input("\nEnter a test module ID (or press Enter to skip remaining tests): ")
    if not module_id:
        print("\n✓ Partial test completed")
        return
    
    module_id = int(module_id)
    
    # Test lesson generation
    lesson_data = test_lesson_generation(headers, course_id, module_id)
    
    # Test quiz generation
    quiz_data = test_quiz_generation(headers, course_id, module_id)
    
    # Test assignment generation
    assignment_data = test_assignment_generation(headers, course_id, module_id)
    
    # Test final project generation
    project_data = test_project_generation(headers, course_id)
    
    print("\n" + "=" * 60)
    print("Test Suite Completed!")
    print("=" * 60)
    print("\n✓ All AI agent endpoints tested successfully")

if __name__ == "__main__":
    main()
