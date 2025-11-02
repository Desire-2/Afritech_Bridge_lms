#!/usr/bin/env python3
import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
from src.models.user_models import db, User
from src.models.course_models import Quiz, Course

with app.app_context():
    quiz = Quiz.query.get(16)
    if quiz:
        print(f'Quiz ID: {quiz.id}')
        print(f'Quiz title: {quiz.title}')
        print(f'Course ID: {quiz.course_id}')
        print(f'Module ID: {quiz.module_id}')
        print(f'Lesson ID: {quiz.lesson_id}')
        
        # Check if course relationship works
        try:
            course = quiz.course
            print(f'Course object: {course}')
            if course:
                print(f'Course title: {course.title}')
                print(f'Course instructor_id: {course.instructor_id}')
            else:
                print('ERROR: Course is None!')
                print('This means quiz.course_id is NULL or points to non-existent course')
        except Exception as e:
            print(f'ERROR accessing quiz.course: {e}')
    else:
        print('Quiz 16 not found')
