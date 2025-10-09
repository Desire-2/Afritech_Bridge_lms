#!/usr/bin/env python3

"""
Test script to verify content assignment API endpoints
"""

import requests
import json

BASE_URL = "http://localhost:8000/api"

def test_api_health():
    """Test if the API is running"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        print(f"API Health: {response.status_code}")
        return response.status_code == 200
    except Exception as e:
        print(f"API Health Check Failed: {e}")
        return False

def test_lesson_quiz(lesson_id):
    """Test lesson quiz endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/content-assignment/lessons/{lesson_id}/quiz", timeout=5)
        print(f"Lesson {lesson_id} Quiz: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  Quiz: {data.get('quiz', {}).get('title', 'No quiz')}")
        else:
            print(f"  Error: {response.text}")
        return response.status_code == 200
    except Exception as e:
        print(f"Lesson Quiz Test Failed: {e}")
        return False

def test_lesson_assignments(lesson_id):
    """Test lesson assignments endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/content-assignment/lessons/{lesson_id}/assignments", timeout=5)
        print(f"Lesson {lesson_id} Assignments: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            assignments = data.get('assignments', [])
            print(f"  Assignments: {len(assignments)} found")
            for i, assignment in enumerate(assignments[:3]):  # Show first 3
                print(f"    {i+1}. {assignment.get('title', 'Untitled')}")
        else:
            print(f"  Error: {response.text}")
        return response.status_code == 200
    except Exception as e:
        print(f"Lesson Assignments Test Failed: {e}")
        return False

def main():
    print("Testing Content Assignment API Endpoints")
    print("=" * 50)
    
    # Test API health
    if not test_api_health():
        print("❌ Backend API is not running or not accessible")
        return
    
    print("✅ Backend API is running")
    
    # Test with some example lesson IDs
    test_lesson_ids = [1, 2, 3]
    
    for lesson_id in test_lesson_ids:
        print(f"\nTesting Lesson ID: {lesson_id}")
        print("-" * 30)
        
        quiz_ok = test_lesson_quiz(lesson_id)
        assignments_ok = test_lesson_assignments(lesson_id)
        
        if quiz_ok and assignments_ok:
            print(f"✅ Lesson {lesson_id} content endpoints working")
        else:
            print(f"⚠️  Lesson {lesson_id} has some issues")

if __name__ == "__main__":
    main()