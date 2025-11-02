#!/usr/bin/env python3
"""Add sample questions to a quiz to test the overview API"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from src.models.course_models import db, Quiz, Question, Answer
from main import app

QUIZ_ID = 3  # Quiz ID to add questions to
COURSE_ID = 7

def add_sample_questions():
    """Add sample questions to the quiz"""
    with app.app_context():
        # Check if quiz exists
        quiz = Quiz.query.filter_by(id=QUIZ_ID, course_id=COURSE_ID).first()
        if not quiz:
            print(f"❌ Quiz {QUIZ_ID} not found for course {COURSE_ID}")
            return
        
        # Check how many questions already exist
        existing_count = Question.query.filter_by(quiz_id=QUIZ_ID).count()
        print(f"📊 Quiz '{quiz.title}' currently has {existing_count} questions")
        
        if existing_count > 0:
            print("✓ Questions already exist. Displaying first 3:")
            questions = Question.query.filter_by(quiz_id=QUIZ_ID).limit(3).all()
            for q in questions:
                answers = Answer.query.filter_by(question_id=q.id).all()
                print(f"  Q: {q.text[:60]}")
                for a in answers[:2]:
                    print(f"    A: {a.text} (correct: {a.is_correct})")
            return
        
        # Add sample questions
        sample_questions = [
            {
                "text": "What does HTML stand for?",
                "type": "multiple_choice",
                "answers": [
                    ("HyperText Markup Language", True),
                    ("High Tech Modern Language", False),
                    ("Home Tool Markup Language", False),
                    ("Hyperlinks and Text Markup Language", False)
                ]
            },
            {
                "text": "Which HTML5 element is used for the main content of a page?",
                "type": "multiple_choice",
                "answers": [
                    ("<main>", True),
                    ("<content>", False),
                    ("<section>", False),
                    ("<article>", False)
                ]
            },
            {
                "text": "CSS stands for Cascading Style Sheets.",
                "type": "true_false",
                "answers": [
                    ("True", True),
                    ("False", False)
                ]
            },
            {
                "text": "What is the correct syntax for linking an external CSS file?",
                "type": "multiple_choice",
                "answers": [
                    ('<link rel="stylesheet" href="style.css">', True),
                    ('<css file="style.css">', False),
                    ('<style src="style.css">', False),
                    ('<import css="style.css">', False)
                ]
            },
            {
                "text": "JavaScript is primarily used for server-side development.",
                "type": "true_false",
                "answers": [
                    ("False", True),
                    ("True", False)
                ]
            }
        ]
        
        print(f"\n📝 Adding {len(sample_questions)} sample questions to quiz {QUIZ_ID}...")
        
        for idx, q_data in enumerate(sample_questions, 1):
            question = Question(
                quiz_id=QUIZ_ID,
                text=q_data["text"],
                question_type=q_data["type"],
                order=idx,
                points=10.0
            )
            db.session.add(question)
            db.session.flush()  # Get the ID
            
            print(f"  ✓ Added Q{idx}: {q_data['text'][:50]}...")
            
            # Add answers
            for answer_text, is_correct in q_data["answers"]:
                answer = Answer(
                    question_id=question.id,
                    text=answer_text,
                    is_correct=is_correct
                )
                db.session.add(answer)
        
        db.session.commit()
        print(f"\n✅ Successfully added {len(sample_questions)} questions with answers!")
        
        # Verify
        final_count = Question.query.filter_by(quiz_id=QUIZ_ID).count()
        print(f"📊 Quiz now has {final_count} questions")
        
        # Test the to_dict() method
        quiz = Quiz.query.get(QUIZ_ID)
        quiz_dict = quiz.to_dict(include_questions=True)
        print(f"\n✓ to_dict(include_questions=True) returned {len(quiz_dict.get('questions', []))} questions")
        
        if quiz_dict.get('questions'):
            first_q = quiz_dict['questions'][0]
            print(f"  First question: {first_q.get('question_text', first_q.get('text', 'N/A'))[:60]}")
            print(f"  Answers: {len(first_q.get('answers', []))}")

if __name__ == "__main__":
    add_sample_questions()
