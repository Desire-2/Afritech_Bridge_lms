import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from src.models.user_models import db
from src.models.course_models import Course, Quiz
from src import create_app

app = create_app()

with app.app_context():
    # Get quiz 16
    quiz = Quiz.query.get(16)
    if quiz:
        print(f"Quiz ID: {quiz.id}")
        print(f"Quiz course_id: {quiz.course_id} (type: {type(quiz.course_id)})")
        
        if quiz.course:
            print(f"\nCourse found: {quiz.course.title}")
            print(f"Course instructor_id: {quiz.course.instructor_id} (type: {type(quiz.course.instructor_id)})")
            
            # Test various comparisons
            user_id_as_string = "3"
            user_id_as_int = 3
            
            print(f"\nComparison tests:")
            print(f"quiz.course.instructor_id == 3 (int): {quiz.course.instructor_id == user_id_as_int}")
            print(f"quiz.course.instructor_id == '3' (str): {quiz.course.instructor_id == user_id_as_string}")
            print(f"int('3') == quiz.course.instructor_id: {int(user_id_as_string) == quiz.course.instructor_id}")
            
            # Check if instructor_id could be None
            print(f"\ninstructor_id is None: {quiz.course.instructor_id is None}")
            print(f"instructor_id value: {repr(quiz.course.instructor_id)}")
    else:
        print("Quiz 16 not found")
