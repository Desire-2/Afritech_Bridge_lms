#!/usr/bin/env python3
"""
Check quiz questions in database for course 7
"""

import sys
sys.path.insert(0, '/home/desire/My_Project/AB/afritec_bridge_lms/backend/src')

from models.user_models import db, User
from models.course_models import Course, Quiz, Question, Answer
from app import create_app

# Create app context
app = create_app()

with app.app_context():
    print("=" * 80)
    print("CHECKING QUIZ QUESTIONS FOR COURSE 7")
    print("=" * 80)
    
    # Check if course exists
    course = Course.query.get(7)
    if not course:
        print("\n❌ Course 7 not found")
        sys.exit(1)
    
    print(f"\n✅ Course Found: {course.title}")
    print(f"   Instructor ID: {course.instructor_id}")
    print(f"   Created: {course.created_at}")
    
    # Get all quizzes for course 7
    quizzes = Quiz.query.filter_by(course_id=7).all()
    print(f"\n📋 Total Quizzes in Course 7: {len(quizzes)}")
    
    if len(quizzes) == 0:
        print("   No quizzes found")
        sys.exit(0)
    
    for quiz in quizzes:
        print(f"\n{'─' * 80}")
        print(f"Quiz ID: {quiz.id}")
        print(f"Title: {quiz.title}")
        print(f"Description: {quiz.description[:50]}..." if quiz.description else "Description: N/A")
        print(f"Published: {quiz.is_published}")
        print(f"Created: {quiz.created_at}")
        
        # Get questions for this quiz
        questions = Question.query.filter_by(quiz_id=quiz.id).order_by(Question.order).all()
        print(f"\n   Questions: {len(questions)}")
        
        if len(questions) == 0:
            print("   ⚠️  NO QUESTIONS FOUND")
        else:
            for idx, question in enumerate(questions, 1):
                print(f"\n   Question {idx}:")
                print(f"      ID: {question.id}")
                print(f"      Text: {question.text[:60]}...")
                print(f"      Type: {question.question_type}")
                print(f"      Order: {question.order}")
                print(f"      Points: {question.points}")
                
                # Get answers for this question
                answers = Answer.query.filter_by(question_id=question.id).all()
                print(f"      Answers: {len(answers)}")
                
                if len(answers) == 0:
                    print(f"         ⚠️  NO ANSWERS")
                else:
                    for a_idx, answer in enumerate(answers, 1):
                        correct_mark = "✓ CORRECT" if answer.is_correct else "✗ incorrect"
                        print(f"         {a_idx}. {answer.text[:50]}... [{correct_mark}]")
    
    print(f"\n{'=' * 80}")
    print("SUMMARY")
    print("=" * 80)
    
    total_quizzes = len(quizzes)
    quizzes_with_questions = len([q for q in quizzes if Question.query.filter_by(quiz_id=q.id).first()])
    total_questions = sum(len(Question.query.filter_by(quiz_id=q.id).all()) for q in quizzes)
    total_answers = sum(len(Answer.query.filter_by(question_id=q.id).all()) for q in Question.query.filter_by(quiz_id__in=[q.id for q in quizzes]).all() for q in [q])
    
    print(f"\n✅ Course: {course.title}")
    print(f"   Total Quizzes: {total_quizzes}")
    print(f"   Quizzes with Questions: {quizzes_with_questions}")
    print(f"   Total Questions: {total_questions}")
    print(f"   Total Answers: {total_answers}")
    
    if total_questions == 0:
        print(f"\n⚠️  WARNING: No questions found in any quiz for course 7")
        print(f"   Questions may not be persisting to database")
    else:
        print(f"\n✅ Questions are being saved to database")
    
    print(f"\n{'=' * 80}\n")
