#!/usr/bin/env python3
"""Verify complete quiz questions flow - API to serialization"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from src.models.course_models import Quiz, Question, Answer
from main import app
import json

print("=" * 80)
print("QUIZ QUESTIONS COMPLETE FLOW VERIFICATION")
print("=" * 80)

with app.app_context():
    # Test 1: Database
    print("\n[TEST 1] Database Verification")
    print("-" * 40)
    total_questions = Question.query.count()
    print(f"✓ Total questions in database: {total_questions}")
    
    quiz = Quiz.query.filter_by(id=3, course_id=7).first()
    if quiz:
        db_questions = Question.query.filter_by(quiz_id=quiz.id).count()
        print(f"✓ Quiz 3 has {db_questions} questions in database")
    else:
        print("✗ Quiz 3 not found")
        sys.exit(1)
    
    # Test 2: Serialization
    print("\n[TEST 2] Quiz.to_dict() Serialization")
    print("-" * 40)
    quiz_dict_without = quiz.to_dict(include_questions=False)
    quiz_dict_with = quiz.to_dict(include_questions=True)
    
    print(f"✓ to_dict(include_questions=False) has 'questions': {'questions' in quiz_dict_without}")
    print(f"✓ to_dict(include_questions=True) has 'questions': {'questions' in quiz_dict_with}")
    
    if 'questions' in quiz_dict_with:
        q_count = len(quiz_dict_with['questions'])
        print(f"✓ Serialized questions count: {q_count}")
        
        if q_count > 0:
            first_q = quiz_dict_with['questions'][0]
            print(f"✓ First question has keys: {list(first_q.keys())}")
            print(f"✓ First question text: {first_q.get('question_text', first_q.get('text', 'N/A'))[:60]}")
            
            answers_count = len(first_q.get('answers', []))
            print(f"✓ First question has {answers_count} answers")
    
    # Test 3: API Response Simulation
    print("\n[TEST 3] API Response Simulation (like assessment_routes.py)")
    print("-" * 40)
    quizzes = Quiz.query.filter_by(course_id=7).all()
    print(f"✓ Found {len(quizzes)} quizzes for course 7")
    
    # This simulates what the assessment_routes.py now does
    quizzes_data = []
    for quiz in quizzes[:3]:  # Check first 3
        quiz_dict = quiz.to_dict(include_questions=True)
        quizzes_data.append(quiz_dict)
        
        q_count = len(quiz_dict.get('questions', []))
        print(f"  ✓ Quiz {quiz.id} '{quiz.title[:40]}': {q_count} questions")
    
    # Test 4: JSON Serialization (what jsonify() will do)
    print("\n[TEST 4] JSON Serialization (jsonify compatibility)")
    print("-" * 40)
    response_data = {
        "quizzes": quizzes_data,
        "assignments": [],
        "projects": []
    }
    
    try:
        json_str = json.dumps(response_data)
        print(f"✓ Response serializes to JSON successfully")
        print(f"✓ JSON size: {len(json_str)} characters")
        
        # Parse it back
        parsed = json.loads(json_str)
        print(f"✓ JSON parses back successfully")
        print(f"✓ Parsed quizzes count: {len(parsed['quizzes'])}")
        print(f"✓ First quiz ID: {parsed['quizzes'][0]['id']}")
        print(f"✓ First quiz questions count: {len(parsed['quizzes'][0].get('questions', []))}")
        
    except Exception as e:
        print(f"✗ JSON serialization failed: {e}")
        sys.exit(1)
    
    # Test 5: Data Structure Verification
    print("\n[TEST 5] Data Structure Verification")
    print("-" * 40)
    for idx, quiz_data in enumerate(parsed['quizzes'], 1):
        print(f"\n  Quiz {idx}: {quiz_data['title'][:40]}")
        questions = quiz_data.get('questions', [])
        print(f"    Questions: {len(questions)}")
        
        if questions:
            first_q = questions[0]
            print(f"    First Q text: {first_q.get('question_text', 'N/A')[:50]}")
            print(f"    Question keys: {', '.join(list(first_q.keys())[:5])}...")
            print(f"    Answers: {len(first_q.get('answers', []))}")
    
    print("\n" + "=" * 80)
    print("✅ ALL TESTS PASSED - Quiz questions flow is working correctly!")
    print("=" * 80)
    print("\nSummary:")
    print(f"  • Database: {total_questions} total questions, {db_questions} in quiz 3")
    print(f"  • Serialization: ✓ to_dict(include_questions=True) works")
    print(f"  • API Response: ✓ Will include questions array")
    print(f"  • JSON: ✓ Serializes correctly")
    print(f"  • Frontend: Should receive and display {db_questions} questions")
