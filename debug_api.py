#!/usr/bin/env python3
"""Debug API response for questions"""
import requests
import json
import sys

BASE_URL = "http://localhost:5001/api/v1"

try:
    # Login
    print("[1] Logging in...")
    login_response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"identifier": "instructor@afritecbridge.com", "password": "Instructor@123"},
        timeout=5
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        print(f"Response: {login_response.text[:200]}")
        sys.exit(1)
    
    token = login_response.json().get("access_token")
    print(f"✓ Logged in, token: {token[:20]}...")
    
    # Get overview
    print("\n[2] Getting assessments overview...")
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(
        f"{BASE_URL}/instructor/assessments/courses/7/overview",
        headers=headers,
        timeout=5
    )
    
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Request failed")
        print(f"Response: {response.text[:500]}")
        sys.exit(1)
    
    data = response.json()
    
    # Analyze
    print(f"\n[3] Analyzing response...")
    quizzes = data.get("quizzes", [])
    print(f"Total quizzes: {len(quizzes)}")
    
    if quizzes:
        quiz = quizzes[0]
        print(f"\nFirst quiz (ID {quiz['id']}):")
        print(f"  Title: {quiz['title']}")
        print(f"  Keys: {list(quiz.keys())}")
        print(f"  Has 'questions' key: {'questions' in quiz}")
        
        if 'questions' in quiz:
            qs = quiz['questions']
            print(f"  Questions: {len(qs)}")
            if qs:
                first_q = qs[0]
                print(f"    First Q keys: {list(first_q.keys())}")
                print(f"    First Q text: {first_q.get('text', first_q.get('question_text', 'N/A'))[:60]}")
        else:
            print("  ⚠️ NO QUESTIONS KEY!")
            
            # Check if we can access via GET /quizzes instead
            print(f"\n[4] Trying GET /quizzes endpoint...")
            response2 = requests.get(
                f"{BASE_URL}/instructor/assessments/quizzes",
                headers=headers,
                timeout=5
            )
            
            if response2.status_code == 200:
                data2 = response2.json()
                if isinstance(data2, list) and data2:
                    quiz2 = data2[0]
                    print(f"  First quiz from GET /quizzes: {quiz2.get('title', 'N/A')}")
                    print(f"  Has 'questions' key: {'questions' in quiz2}")
                    print(f"  Questions: {len(quiz2.get('questions', []))}")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n✓ Debug complete")
