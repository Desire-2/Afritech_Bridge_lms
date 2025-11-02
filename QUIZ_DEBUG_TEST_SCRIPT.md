# Quick Test Script - Quiz Creation Debugging

## Run this to test quiz creation directly

```python
# In backend directory, run: python
from src.app import app, db
from src.models.course_models import Course, Quiz, Question, Answer
from datetime import datetime

with app.app_context():
    # Get the first course
    course = Course.query.first()
    print(f"Testing with course: {course.title} (ID: {course.id})")
    
    # Create a test quiz with all settings
    test_quiz = Quiz(
        title="DEBUG TEST QUIZ - DELETE ME",
        description="This is a test quiz for debugging",
        course_id=course.id,
        is_published=False,
        time_limit=30,
        max_attempts=3,
        passing_score=75,
        points_possible=100.0,
        shuffle_questions=True,
        shuffle_answers=True,
        show_correct_answers=True
    )
    
    db.session.add(test_quiz)
    db.session.flush()  # Get quiz ID
    
    print(f"Created quiz with ID: {test_quiz.id}")
    print(f"Settings:")
    print(f"  - time_limit: {test_quiz.time_limit}")
    print(f"  - max_attempts: {test_quiz.max_attempts}")
    print(f"  - passing_score: {test_quiz.passing_score}")
    print(f"  - shuffle_questions: {test_quiz.shuffle_questions}")
    
    # Add a test question
    question = Question(
        quiz_id=test_quiz.id,
        text="Is this a test question?",
        question_type="true_false",
        order=1,
        points=10.0
    )
    
    db.session.add(question)
    db.session.flush()  # Get question ID
    
    print(f"Created question with ID: {question.id}")
    
    # Add answers
    answer1 = Answer(
        question_id=question.id,
        text="True",
        is_correct=True
    )
    answer2 = Answer(
        question_id=question.id,
        text="False",
        is_correct=False
    )
    
    db.session.add(answer1)
    db.session.add(answer2)
    
    # Commit everything
    db.session.commit()
    
    print("Committed to database!")
    
    # Now retrieve and check
    retrieved_quiz = Quiz.query.get(test_quiz.id)
    print("\n=== RETRIEVED FROM DATABASE ===")
    print(f"Quiz: {retrieved_quiz.title}")
    print(f"Time limit: {retrieved_quiz.time_limit}")
    print(f"Max attempts: {retrieved_quiz.max_attempts}")
    print(f"Passing score: {retrieved_quiz.passing_score}")
    print(f"Questions count: {len(list(retrieved_quiz.questions))}")
    
    # Check to_dict output
    print("\n=== TO_DICT OUTPUT ===")
    quiz_dict = retrieved_quiz.to_dict(include_questions=True)
    print(f"time_limit: {quiz_dict.get('time_limit')}")
    print(f"max_attempts: {quiz_dict.get('max_attempts')}")
    print(f"passing_score: {quiz_dict.get('passing_score')}")
    print(f"questions: {len(quiz_dict.get('questions', []))}")
    
    # Cleanup
    print("\n=== CLEANUP ===")
    db.session.delete(retrieved_quiz)
    db.session.commit()
    print("Test quiz deleted!")
```

## Expected Output

If everything works correctly, you should see:

```
Testing with course: Introduction to Web Development (ID: 1)
Created quiz with ID: 42
Settings:
  - time_limit: 30
  - max_attempts: 3
  - passing_score: 75
  - shuffle_questions: True
Created question with ID: 123
Committed to database!

=== RETRIEVED FROM DATABASE ===
Quiz: DEBUG TEST QUIZ - DELETE ME
Time limit: 30
Max attempts: 3
Passing score: 75
Questions count: 1

=== TO_DICT OUTPUT ===
time_limit: 30
max_attempts: 3
passing_score: 75
questions: 1

=== CLEANUP ===
Test quiz deleted!
```

## If Settings Are NULL

If you see:
```
Time limit: None
Max attempts: None
Passing score: 70  # default
```

This means the database columns exist but values aren't being saved.

**Possible causes:**
1. Database migration issue (columns don't exist)
2. Model definition doesn't match database schema
3. Data type conversion fails silently

**Solution:**
```bash
# Check database schema
cd backend
flask shell
>>> from src.app import db
>>> from sqlalchemy import inspect
>>> inspector = inspect(db.engine)
>>> columns = inspector.get_columns('quizzes')
>>> for col in columns:
...     print(f"{col['name']}: {col['type']}")
```

## If Questions Count is 0

If you see:
```
Questions count: 0
questions: []
```

**Possible causes:**
1. Foreign key constraint issue
2. Relationship not configured properly
3. Questions not committed

**Solution:** Check if questions exist in database:
```python
from src.models.course_models import Question
questions = Question.query.filter_by(quiz_id=test_quiz.id).all()
print(f"Questions found: {len(questions)}")
for q in questions:
    print(f"  - {q.text}")
```

---

**Purpose**: Isolate whether the issue is in frontend/backend logic or in database/models

**Run this test** and share the output to identify where the problem is!
