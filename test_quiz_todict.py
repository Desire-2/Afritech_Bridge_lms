#!/usr/bin/env python3
"""Test Quiz.to_dict() directly"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from src.models.course_models import Quiz
from main import app

with app.app_context():
    quiz = Quiz.query.filter_by(id=3).first()
    
    print(f"Quiz ID: {quiz.id}, Title: {quiz.title}")
    print(f"Total questions in DB: {quiz.questions.count()}")
    
    # Test without include_questions
    dict_without = quiz.to_dict(include_questions=False)
    print(f"\nto_dict(include_questions=False):")
    print(f"  Keys: {list(dict_without.keys())}")
    print(f"  Has 'questions': {'questions' in dict_without}")
    
    # Test with include_questions
    dict_with = quiz.to_dict(include_questions=True)
    print(f"\nto_dict(include_questions=True):")
    print(f"  Keys: {list(dict_with.keys())}")
    print(f"  Has 'questions': {'questions' in dict_with}")
    print(f"  Questions count: {len(dict_with.get('questions', []))}")
    
    if dict_with.get('questions'):
        first_q = dict_with['questions'][0]
        print(f"  First question keys: {list(first_q.keys())}")
        print(f"  First question text: {first_q.get('question_text', first_q.get('text', 'N/A'))[:60]}")
