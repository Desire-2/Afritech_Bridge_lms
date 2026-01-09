#!/usr/bin/env python3
"""
Check which course has ID 1
"""

import os
import sys

# Add the project root to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.models.course_models import Course
from main import app

def check_course():
    with app.app_context():
        course = Course.query.get(1)
        if course:
            print(f"Course ID 1: {course.title}")
            print(f"Description: {course.description}")
        else:
            print("No course found with ID 1")

if __name__ == '__main__':
    check_course()