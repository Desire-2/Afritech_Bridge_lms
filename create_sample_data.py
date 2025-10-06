#!/usr/bin/env python3
"""
Sample Data Generator for Student Features Testing
Creates realistic test data for all student features including:
- Courses with different enrollment types
- Student enrollments and progress
- Assessment attempts and results
- Certificates and badges
"""

import sys
import os
from datetime import datetime, timedelta
import random

# Add the backend directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from flask import Flask
from src.models import db
from src.models.user_models import User
from src.models.course_models import Course, Module, Lesson, Quiz, QuizQuestion, Enrollment
from src.models.student_models import *

def create_app():
    """Create and configure the Flask app."""
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///backend/instance/afritec_lms_db.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    return app

def create_sample_data():
    """Create comprehensive sample data for testing."""
    print("🌱 Creating Sample Data for Student Features")
    print("=" * 50)
    
    app = create_app()
    
    with app.app_context():
        try:
            # Create sample courses with different enrollment types
            print("📚 Creating sample courses...")
            
            courses_data = [
                {
                    'title': 'Python Programming Fundamentals',
                    'description': 'Learn Python from scratch with hands-on projects',
                    'enrollment_type': 'free',
                    'price': 0.00,
                    'strict_progression': True,
                    'passing_score': 80,
                    'duration_weeks': 8
                },
                {
                    'title': 'Advanced Web Development with Django',
                    'description': 'Build professional web applications',
                    'enrollment_type': 'paid',
                    'price': 299.99,
                    'strict_progression': True,
                    'passing_score': 80,
                    'duration_weeks': 12
                },
                {
                    'title': 'Data Science and Machine Learning',
                    'description': 'Master data science with Python and ML algorithms',
                    'enrollment_type': 'scholarship',
                    'price': 499.99,
                    'strict_progression': True,
                    'passing_score': 85,
                    'duration_weeks': 16
                }
            ]
            
            courses = []
            for course_data in courses_data:
                # Check if course already exists
                existing_course = Course.query.filter_by(title=course_data['title']).first()
                if not existing_course:
                    course = Course(
                        title=course_data['title'],
                        description=course_data['description'],
                        instructor_id=1,  # Assuming admin/instructor exists
                        enrollment_type=course_data['enrollment_type'],
                        price=course_data['price'],
                        strict_progression=course_data['strict_progression'],
                        passing_score=course_data['passing_score'],
                        duration_weeks=course_data['duration_weeks']
                    )
                    db.session.add(course)
                    db.session.flush()  # Get the ID
                    courses.append(course)
                    print(f"✅ Created course: {course.title}")
                else:
                    courses.append(existing_course)
                    print(f"📋 Using existing course: {existing_course.title}")
            
            # Create sample students
            print("\n👥 Creating sample students...")
            students_data = [
                {
                    'username': 'student1',
                    'email': 'student1@example.com',
                    'first_name': 'Alice',
                    'last_name': 'Johnson',
                    'role': 'student'
                },
                {
                    'username': 'student2',
                    'email': 'student2@example.com',
                    'first_name': 'Bob',
                    'last_name': 'Smith',
                    'role': 'student'
                },
                {
                    'username': 'student3',
                    'email': 'student3@example.com',
                    'first_name': 'Carol',
                    'last_name': 'Davis',
                    'role': 'student'
                }
            ]
            
            students = []
            for student_data in students_data:
                existing_student = User.query.filter_by(username=student_data['username']).first()
                if not existing_student:
                    student = User(
                        username=student_data['username'],
                        email=student_data['email'],
                        first_name=student_data['first_name'],
                        last_name=student_data['last_name'],
                        role=student_data['role']
                    )
                    student.set_password('password123')  # Default password
                    db.session.add(student)
                    db.session.flush()
                    students.append(student)
                    print(f"✅ Created student: {student.username}")
                else:
                    students.append(existing_student)
                    print(f"📋 Using existing student: {existing_student.username}")
            
            # Create sample modules and lessons for each course
            print("\n📖 Creating sample modules and lessons...")
            for course in courses:
                # Check if modules already exist for this course
                existing_modules = Module.query.filter_by(course_id=course.id).count()
                if existing_modules == 0:
                    for i in range(3):  # 3 modules per course
                        module = Module(
                            title=f"Module {i+1}: Core Concepts",
                            description=f"Module {i+1} covers fundamental concepts",
                            course_id=course.id,
                            order_index=i
                        )
                        db.session.add(module)
                        db.session.flush()
                        
                        # Create lessons for each module
                        for j in range(4):  # 4 lessons per module
                            lesson = Lesson(
                                title=f"Lesson {j+1}: Topic {j+1}",
                                content=f"This is the content for lesson {j+1}",
                                module_id=module.id,
                                order_index=j,
                                duration_minutes=30
                            )
                            db.session.add(lesson)
                        
                        # Create a quiz for each module
                        quiz = Quiz(
                            title=f"Module {i+1} Quiz",
                            description=f"Test your knowledge of Module {i+1}",
                            module_id=module.id,
                            time_limit_minutes=30,
                            max_attempts=3,
                            passing_score=80
                        )
                        db.session.add(quiz)
                        db.session.flush()
                        
                        # Create quiz questions
                        for k in range(5):  # 5 questions per quiz
                            question = QuizQuestion(
                                quiz_id=quiz.id,
                                question_text=f"What is the answer to question {k+1}?",
                                question_type='multiple_choice',
                                options=['Option A', 'Option B', 'Option C', 'Option D'],
                                correct_answer='Option A',
                                points=2
                            )
                            db.session.add(question)
                    
                    print(f"✅ Created modules and lessons for: {course.title}")
            
            # Create sample enrollments
            print("\n🎓 Creating sample enrollments...")
            for student in students:
                # Enroll each student in 1-2 courses
                num_enrollments = random.randint(1, 2)
                enrolled_courses = random.sample(courses, num_enrollments)
                
                for course in enrolled_courses:
                    existing_enrollment = Enrollment.query.filter_by(
                        student_id=student.id,
                        course_id=course.id
                    ).first()
                    
                    if not existing_enrollment:
                        enrollment = Enrollment(
                            student_id=student.id,
                            course_id=course.id,
                            enrollment_date=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
                            status='active',
                            progress_percentage=random.randint(10, 80)
                        )
                        db.session.add(enrollment)
                        print(f"✅ Enrolled {student.username} in {course.title}")
            
            # Create sample enrollment applications
            print("\n📝 Creating sample enrollment applications...")
            scholarship_course = next((c for c in courses if c.enrollment_type == 'scholarship'), None)
            if scholarship_course:
                for student in students[:2]:  # First 2 students apply for scholarship
                    existing_app = CourseEnrollmentApplication.query.filter_by(
                        student_id=student.id,
                        course_id=scholarship_course.id
                    ).first()
                    
                    if not existing_app:
                        application = CourseEnrollmentApplication(
                            student_id=student.id,
                            course_id=scholarship_course.id,
                            application_type='scholarship',
                            personal_statement=f"I am passionate about learning {scholarship_course.title}...",
                            financial_need_statement="I need financial assistance to pursue this course...",
                            status='pending',
                            application_date=datetime.utcnow() - timedelta(days=random.randint(1, 7))
                        )
                        db.session.add(application)
                        print(f"✅ Created scholarship application for {student.username}")
            
            # Create sample skill badges
            print("\n🏆 Creating sample skill badges...")
            skills_data = [
                {'name': 'Python Basics', 'description': 'Fundamental Python programming skills'},
                {'name': 'Web Development', 'description': 'Web application development skills'},
                {'name': 'Database Design', 'description': 'Database modeling and optimization'},
                {'name': 'API Development', 'description': 'RESTful API design and implementation'},
                {'name': 'Data Analysis', 'description': 'Data manipulation and visualization'}
            ]
            
            badges = []
            for skill_data in skills_data:
                existing_badge = SkillBadge.query.filter_by(name=skill_data['name']).first()
                if not existing_badge:
                    badge = SkillBadge(
                        name=skill_data['name'],
                        description=skill_data['description'],
                        icon_url=f'/static/badges/{skill_data["name"].lower().replace(" ", "_")}.png',
                        criteria={'min_score': 85, 'required_assessments': 3}
                    )
                    db.session.add(badge)
                    db.session.flush()
                    badges.append(badge)
                    print(f"✅ Created badge: {badge.name}")
                else:
                    badges.append(existing_badge)
            
            # Commit all changes
            db.session.commit()
            
            # Create sample progress and analytics data
            print("\n📊 Creating sample progress data...")
            for student in students:
                enrollments = Enrollment.query.filter_by(student_id=student.id).all()
                
                for enrollment in enrollments:
                    course = enrollment.course
                    modules = Module.query.filter_by(course_id=course.id).all()
                    
                    for i, module in enumerate(modules):
                        # Create module progress
                        progress = ModuleProgress(
                            student_id=student.id,
                            module_id=module.id,
                            status='completed' if i < len(modules) - 1 else 'in_progress',
                            completion_percentage=100 if i < len(modules) - 1 else random.randint(20, 80),
                            time_spent_minutes=random.randint(180, 480),
                            cumulative_score=random.randint(75, 95) if i < len(modules) - 1 else None,
                            last_accessed=datetime.utcnow() - timedelta(days=random.randint(1, 10))
                        )
                        db.session.add(progress)
                        
                        # Create quiz attempts
                        quiz = Quiz.query.filter_by(module_id=module.id).first()
                        if quiz and i < len(modules) - 1:  # Only for completed modules
                            attempt = AssessmentAttempt(
                                student_id=student.id,
                                assessment_id=quiz.id,
                                assessment_type='quiz',
                                attempt_number=1,
                                score=random.randint(80, 100),
                                max_score=100,
                                submitted_at=datetime.utcnow() - timedelta(days=random.randint(1, 15)),
                                time_taken_minutes=random.randint(15, 30),
                                responses={'q1': 'A', 'q2': 'B', 'q3': 'A', 'q4': 'C', 'q5': 'A'}
                            )
                            db.session.add(attempt)
                    
                    # Create learning analytics
                    analytics = LearningAnalytics(
                        student_id=student.id,
                        course_id=course.id,
                        total_time_spent_minutes=random.randint(1200, 3600),
                        average_session_duration=random.randint(45, 120),
                        total_assessments_taken=random.randint(5, 15),
                        average_score=random.randint(78, 92),
                        streak_count=random.randint(3, 21),
                        weak_areas=['Database queries', 'API design'] if random.choice([True, False]) else [],
                        strong_areas=['Python basics', 'Problem solving'],
                        last_activity=datetime.utcnow() - timedelta(days=random.randint(1, 5))
                    )
                    db.session.add(analytics)
            
            # Award some badges to students
            print("\n🎖️ Awarding sample badges...")
            for student in students:
                # Award 1-2 random badges
                num_badges = random.randint(1, 2)
                awarded_badges = random.sample(badges, min(num_badges, len(badges)))
                
                for badge in awarded_badges:
                    existing_award = StudentSkillBadge.query.filter_by(
                        student_id=student.id,
                        badge_id=badge.id
                    ).first()
                    
                    if not existing_award:
                        award = StudentSkillBadge(
                            student_id=student.id,
                            badge_id=badge.id,
                            earned_date=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
                            verification_code=f"BADGE_{badge.id}_{student.id}_{random.randint(1000, 9999)}"
                        )
                        db.session.add(award)
                        print(f"✅ Awarded {badge.name} to {student.username}")
            
            # Final commit
            db.session.commit()
            
            print(f"\n🎉 Sample data creation completed successfully!")
            print(f"📊 Summary:")
            print(f"  - Courses: {len(courses)}")
            print(f"  - Students: {len(students)}")
            print(f"  - Modules: {Module.query.count()}")
            print(f"  - Lessons: {Lesson.query.count()}")
            print(f"  - Quizzes: {Quiz.query.count()}")
            print(f"  - Enrollments: {Enrollment.query.count()}")
            print(f"  - Applications: {CourseEnrollmentApplication.query.count()}")
            print(f"  - Skill Badges: {len(badges)}")
            print(f"  - Badge Awards: {StudentSkillBadge.query.count()}")
            
            print(f"\n🔐 Test Login Credentials:")
            print(f"  - student1@example.com / password123")
            print(f"  - student2@example.com / password123") 
            print(f"  - student3@example.com / password123")
            
        except Exception as e:
            print(f"❌ Sample data creation failed: {str(e)}")
            import traceback
            traceback.print_exc()
            db.session.rollback()
            return False
    
    return True

if __name__ == "__main__":
    success = create_sample_data()
    if success:
        print("\n✨ Sample data created successfully! Ready for testing.")
        exit(0)
    else:
        print("\n💥 Sample data creation failed.")
        exit(1)