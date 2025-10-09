#!/usr/bin/env python3
"""
Script to add questions directly to the created quizzes
Since the API has access control issues, we'll work directly with the database
"""

import sys
import os

# Add the backend directory to the Python path
backend_dir = "/home/desire/My_Project/AB/afritec_bridge_lms/backend"
sys.path.insert(0, backend_dir)

# Change to backend directory for proper imports
os.chdir(backend_dir)

from src.models.user_models import db
from src.models.course_models import Quiz, Question, Answer
from main import app

def add_quiz_questions():
    """Add questions to all the created quizzes"""
    
    with app.app_context():
        # Get all quizzes for course 7 (our web development course)
        quizzes = Quiz.query.filter_by(course_id=7).all()
        
        print(f"Found {len(quizzes)} quizzes to populate with questions:")
        for quiz in quizzes:
            print(f"  - {quiz.title} (ID: {quiz.id})")
        
        # Define questions for each quiz type
        quiz_questions = {
            "Web Development Fundamentals Quiz": [
                {
                    'text': 'What does HTML stand for?',
                    'type': 'multiple_choice',
                    'answers': [
                        {'text': 'HyperText Markup Language', 'is_correct': True},
                        {'text': 'High Tech Modern Language', 'is_correct': False},
                        {'text': 'Home Tool Markup Language', 'is_correct': False},
                        {'text': 'Hyperlink and Text Markup Language', 'is_correct': False}
                    ]
                },
                {
                    'text': 'Which protocol is used for secure web communication?',
                    'type': 'multiple_choice',
                    'answers': [
                        {'text': 'HTTP', 'is_correct': False},
                        {'text': 'HTTPS', 'is_correct': True},
                        {'text': 'FTP', 'is_correct': False},
                        {'text': 'SSH', 'is_correct': False}
                    ]
                },
                {
                    'text': 'A web browser is a client-side application.',
                    'type': 'true_false',
                    'answers': [
                        {'text': 'True', 'is_correct': True},
                        {'text': 'False', 'is_correct': False}
                    ]
                },
                {
                    'text': 'What is the purpose of a code editor in web development?',
                    'type': 'short_answer',
                    'answers': [
                        {'text': 'A code editor provides syntax highlighting, auto-completion, and debugging tools to help developers write and maintain code efficiently.', 'is_correct': True}
                    ]
                },
                {
                    'text': 'Which of the following are front-end technologies?',
                    'type': 'multiple_choice',
                    'answers': [
                        {'text': 'HTML', 'is_correct': True},
                        {'text': 'CSS', 'is_correct': True},
                        {'text': 'JavaScript', 'is_correct': True},
                        {'text': 'MySQL', 'is_correct': False}
                    ]
                }
            ],
            
            "HTML5 Fundamentals Quiz": [
                {
                    'text': 'Which HTML5 element is used for the main content of a document?',
                    'type': 'multiple_choice',
                    'answers': [
                        {'text': '<main>', 'is_correct': True},
                        {'text': '<content>', 'is_correct': False},
                        {'text': '<body>', 'is_correct': False},
                        {'text': '<section>', 'is_correct': False}
                    ]
                },
                {
                    'text': 'What is the correct HTML5 doctype declaration?',
                    'type': 'multiple_choice',
                    'answers': [
                        {'text': '<!DOCTYPE html>', 'is_correct': True},
                        {'text': '<!DOCTYPE HTML5>', 'is_correct': False},
                        {'text': '<DOCTYPE html>', 'is_correct': False},
                        {'text': '<!DOCTYPE html5>', 'is_correct': False}
                    ]
                },
                {
                    'text': 'Semantic HTML elements improve accessibility and SEO.',
                    'type': 'true_false',
                    'answers': [
                        {'text': 'True', 'is_correct': True},
                        {'text': 'False', 'is_correct': False}
                    ]
                },
                {
                    'text': 'Explain the difference between <div> and <section> elements.',
                    'type': 'short_answer',
                    'answers': [
                        {'text': '<section> is semantic and represents a distinct section of content, while <div> is generic and used for styling or grouping without semantic meaning.', 'is_correct': True}
                    ]
                }
            ],
            
            "Advanced HTML5 & Forms Quiz": [
                {
                    'text': 'Which HTML5 input type is used for email validation?',
                    'type': 'multiple_choice',
                    'answers': [
                        {'text': 'type="email"', 'is_correct': True},
                        {'text': 'type="text"', 'is_correct': False},
                        {'text': 'type="mail"', 'is_correct': False},
                        {'text': 'type="validate-email"', 'is_correct': False}
                    ]
                },
                {
                    'text': 'The required attribute can be used on form inputs for client-side validation.',
                    'type': 'true_false',
                    'answers': [
                        {'text': 'True', 'is_correct': True},
                        {'text': 'False', 'is_correct': False}
                    ]
                },
                {
                    'text': 'What is the purpose of the <label> element in forms?',
                    'type': 'short_answer',
                    'answers': [
                        {'text': 'The <label> element associates descriptive text with form controls, improving accessibility and usability by allowing users to click the label to focus the input.', 'is_correct': True}
                    ]
                },
                {
                    'text': 'Which attribute is used to specify the maximum length of text input?',
                    'type': 'multiple_choice',
                    'answers': [
                        {'text': 'maxlength', 'is_correct': True},
                        {'text': 'max-length', 'is_correct': False},
                        {'text': 'length', 'is_correct': False},
                        {'text': 'limit', 'is_correct': False}
                    ]
                }
            ],
            
            "CSS3 Fundamentals Quiz": [
                {
                    'text': 'Which CSS property is used to change the text color?',
                    'type': 'multiple_choice',
                    'answers': [
                        {'text': 'color', 'is_correct': True},
                        {'text': 'text-color', 'is_correct': False},
                        {'text': 'font-color', 'is_correct': False},
                        {'text': 'text-style', 'is_correct': False}
                    ]
                },
                {
                    'text': 'CSS stands for Cascading Style Sheets.',
                    'type': 'true_false',
                    'answers': [
                        {'text': 'True', 'is_correct': True},
                        {'text': 'False', 'is_correct': False}
                    ]
                },
                {
                    'text': 'Explain the CSS box model.',
                    'type': 'short_answer',
                    'answers': [
                        {'text': 'The CSS box model consists of content, padding, border, and margin. Content is the actual element, padding is space inside the border, border surrounds the padding, and margin is space outside the border.', 'is_correct': True}
                    ]
                },
                {
                    'text': 'Which CSS unit is relative to the font size of the element?',
                    'type': 'multiple_choice',
                    'answers': [
                        {'text': 'em', 'is_correct': True},
                        {'text': 'px', 'is_correct': False},
                        {'text': 'pt', 'is_correct': False},
                        {'text': 'cm', 'is_correct': False}
                    ]
                }
            ],
            
            "Advanced CSS & Layout Quiz": [
                {
                    'text': 'Which CSS property is used to create a flex container?',
                    'type': 'multiple_choice',
                    'answers': [
                        {'text': 'display: flex', 'is_correct': True},
                        {'text': 'flex: container', 'is_correct': False},
                        {'text': 'layout: flex', 'is_correct': False},
                        {'text': 'position: flex', 'is_correct': False}
                    ]
                },
                {
                    'text': 'CSS Grid is better than Flexbox for two-dimensional layouts.',
                    'type': 'true_false',
                    'answers': [
                        {'text': 'True', 'is_correct': True},
                        {'text': 'False', 'is_correct': False}
                    ]
                },
                {
                    'text': 'What is the purpose of media queries in responsive design?',
                    'type': 'short_answer',
                    'answers': [
                        {'text': 'Media queries allow CSS styles to be applied conditionally based on device characteristics like screen width, height, or orientation, enabling responsive design for different devices.', 'is_correct': True}
                    ]
                },
                {
                    'text': 'Which CSS property controls the space between flex items?',
                    'type': 'multiple_choice',
                    'answers': [
                        {'text': 'gap', 'is_correct': True},
                        {'text': 'space', 'is_correct': False},
                        {'text': 'margin', 'is_correct': False},
                        {'text': 'padding', 'is_correct': False}
                    ]
                }
            ],
            
            "JavaScript Fundamentals Quiz": [
                {
                    'text': 'Which keyword is used to declare a variable in modern JavaScript?',
                    'type': 'multiple_choice',
                    'answers': [
                        {'text': 'let', 'is_correct': True},
                        {'text': 'var', 'is_correct': False},
                        {'text': 'variable', 'is_correct': False},
                        {'text': 'declare', 'is_correct': False}
                    ]
                },
                {
                    'text': 'JavaScript is a statically typed language.',
                    'type': 'true_false',
                    'answers': [
                        {'text': 'True', 'is_correct': False},
                        {'text': 'False', 'is_correct': True}
                    ]
                },
                {
                    'text': 'Explain the difference between let, const, and var in JavaScript.',
                    'type': 'short_answer',
                    'answers': [
                        {'text': 'let has block scope and can be reassigned, const has block scope and cannot be reassigned, var has function scope and can be reassigned. let and const were introduced in ES6 and are preferred over var.', 'is_correct': True}
                    ]
                },
                {
                    'text': 'Which method is used to add an element to the end of an array?',
                    'type': 'multiple_choice',
                    'answers': [
                        {'text': 'push()', 'is_correct': True},
                        {'text': 'add()', 'is_correct': False},
                        {'text': 'append()', 'is_correct': False},
                        {'text': 'insert()', 'is_correct': False}
                    ]
                }
            ]
        }
        
        # Add questions to each quiz
        questions_added = 0
        
        for quiz in quizzes:
            if quiz.title in quiz_questions:
                questions_data = quiz_questions[quiz.title]
                print(f"\nAdding {len(questions_data)} questions to '{quiz.title}'...")
                
                for i, q_data in enumerate(questions_data, 1):
                    # Create question
                    question = Question(
                        quiz_id=quiz.id,
                        text=q_data['text'],
                        question_type=q_data['type'],
                        order=i
                    )
                    db.session.add(question)
                    db.session.flush()  # Get the question ID
                    
                    # Add answers
                    for answer_data in q_data['answers']:
                        answer = Answer(
                            question_id=question.id,
                            text=answer_data['text'],
                            is_correct=answer_data['is_correct']
                        )
                        db.session.add(answer)
                    
                    questions_added += 1
                    print(f"  ✅ Added question {i}: {q_data['text'][:50]}...")
        
        # Commit all changes
        db.session.commit()
        print(f"\n🎉 Successfully added {questions_added} questions to {len(quizzes)} quizzes!")
        
        # Verify the questions were added
        print("\n📊 Quiz Summary:")
        for quiz in quizzes:
            question_count = Question.query.filter_by(quiz_id=quiz.id).count()
            print(f"  - {quiz.title}: {question_count} questions")

if __name__ == "__main__":
    print("🎯 Adding Questions to Web Development Course Quizzes")
    print("=" * 55)
    
    try:
        add_quiz_questions()
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()