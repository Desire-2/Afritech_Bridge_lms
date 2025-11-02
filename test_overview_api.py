#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:5001/api/v1"

# Login first
login_response = requests.post(
    f"{BASE_URL}/auth/login",
    json={"identifier": "instructor@afritecbridge.com", "password": "Instructor@123"}
)

if login_response.status_code != 200:
    print(f"Login failed: {login_response.status_code}")
    print(login_response.json())
    exit(1)

token = login_response.json()["access_token"]
print(f"✓ Logged in successfully. Token: {token[:20]}...")

# Get assessments overview
headers = {"Authorization": f"Bearer {token}"}
response = requests.get(
    f"{BASE_URL}/instructor/assessments/courses/7/overview",
    headers=headers
)

print(f"\n✓ API Response Status: {response.status_code}")
print(f"\nResponse Data:")

data = response.json()
print(json.dumps(data, indent=2))

# Analyze quizzes
if "quizzes" in data:
    print(f"\n📊 ANALYSIS:")
    print(f"Total Quizzes: {len(data['quizzes'])}")
    for idx, quiz in enumerate(data['quizzes'], 1):
        questions = quiz.get('questions', [])
        print(f"\n  Quiz {idx}: {quiz['title']} (ID: {quiz['id']})")
        print(f"  └─ Questions: {len(questions)}")
        if questions:
            for q_idx, q in enumerate(questions[:2], 1):  # Show first 2 questions
                text = q.get('question_text') or q.get('text', 'N/A')
                answers = q.get('answers', [])
                print(f"     Q{q_idx}: {text[:60]}... ({len(answers)} answers)")
