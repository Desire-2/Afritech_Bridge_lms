#!/usr/bin/env python3
"""
Test the fixed full credit service
"""

import os
import sys

# Add the backend directory to Python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

from src.models.user_models import db
from src.services.full_credit_service import FullCreditService
from sqlalchemy import text

def test_full_credit_with_real_data():
    """Test with real data from the database"""
    # Set up Flask app context
    from main import app
    
    with app.app_context():
        try:
            # Find a student and module combination
            result = db.session.execute(text("""
                SELECT 
                    u.id as student_id,
                    u.username,
                    m.id as module_id,
                    m.title as module_title,
                    e.id as enrollment_id,
                    c.instructor_id
                FROM users u
                JOIN enrollments e ON u.id = e.student_id
                JOIN courses c ON e.course_id = c.id
                JOIN modules m ON c.id = m.course_id
                WHERE u.role_id = (SELECT id FROM roles WHERE name = 'student')
                LIMIT 1
            """))
            
            test_data = result.fetchone()
            
            if not test_data:
                print("❌ No test data found. Need at least one student enrolled in a course with modules.")
                return
            
            print(f"🧪 Testing with:")
            print(f"  Student: {test_data[1]} (ID: {test_data[0]})")
            print(f"  Module: {test_data[3]} (ID: {test_data[2]})")
            print(f"  Enrollment ID: {test_data[4]}")
            print()
            
            # Check before state
            print("📊 Before full credit award:")
            
            # Check current lesson completions
            lesson_before = db.session.execute(text("""
                SELECT COUNT(*) as total_lessons,
                       COUNT(lc.id) as completed_lessons,
                       AVG(lc.lesson_score) as avg_score
                FROM lessons l
                LEFT JOIN lesson_completions lc ON l.id = lc.lesson_id AND lc.student_id = :student_id AND lc.completed = true
                WHERE l.module_id = :module_id
            """), {"student_id": test_data[0], "module_id": test_data[2]}).fetchone()
            
            print(f"  Lessons: {lesson_before[1] or 0}/{lesson_before[0]} completed (avg score: {lesson_before[2] or 0:.1f})")
            
            # Check current quiz attempts
            quiz_before = db.session.execute(text("""
                SELECT COUNT(*) as total_quizzes,
                       COUNT(qa.id) as attempted_quizzes,
                       AVG(qa.score) as avg_score
                FROM quizzes q
                LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.user_id = :student_id
                WHERE q.module_id = :module_id
            """), {"student_id": test_data[0], "module_id": test_data[2]}).fetchone()
            
            print(f"  Quizzes: {quiz_before[1] or 0}/{quiz_before[0]} attempted (avg score: {quiz_before[2] or 0:.1f})")
            
            # Call the full credit service
            print("\n🎯 Calling FullCreditService...")
            result = FullCreditService.give_module_full_credit(
                student_id=test_data[0],
                module_id=test_data[2], 
                instructor_id=test_data[5],
                enrollment_id=test_data[4]
            )
            
            print(f"Result: {result}")
            
            if result.get('success'):
                print(f"✅ {result.get('message')}")
                details = result.get('details', {})
                print(f"Details: {details}")
                
                # Verify the data was actually updated
                print("\n🔍 After full credit award:")
                
                # Check lesson completions after
                lesson_after = db.session.execute(text("""
                    SELECT COUNT(*) as total_lessons,
                           COUNT(lc.id) as completed_lessons,
                           AVG(lc.lesson_score) as avg_score
                    FROM lessons l
                    LEFT JOIN lesson_completions lc ON l.id = lc.lesson_id AND lc.student_id = :student_id AND lc.completed = true
                    WHERE l.module_id = :module_id
                """), {"student_id": test_data[0], "module_id": test_data[2]}).fetchone()
                
                print(f"  Lessons: {lesson_after[1] or 0}/{lesson_after[0]} completed (avg score: {lesson_after[2] or 0:.1f})")
                
                # Check quiz attempts after
                quiz_after = db.session.execute(text("""
                    SELECT COUNT(*) as total_quizzes,
                           COUNT(qa.id) as attempted_quizzes,
                           AVG(qa.score) as avg_score
                    FROM quizzes q
                    LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.user_id = :student_id AND qa.score = 100.0
                    WHERE q.module_id = :module_id
                """), {"student_id": test_data[0], "module_id": test_data[2]}).fetchone()
                
                print(f"  Quizzes with 100%: {quiz_after[1] or 0}/{quiz_after[0]} attempted")
                
                # Check module progress
                module_progress = db.session.execute(text("""
                    SELECT status, cumulative_score, completed_at
                    FROM module_progress
                    WHERE student_id = :student_id AND module_id = :module_id
                """), {"student_id": test_data[0], "module_id": test_data[2]}).fetchone()
                
                if module_progress:
                    print(f"  Module: status={module_progress[0]}, score={module_progress[1]}, completed={module_progress[2]}")
                else:
                    print("  Module: No progress record found")
                
                # Analyze results
                print("\n📈 Analysis:")
                lesson_improvement = (lesson_after[1] or 0) - (lesson_before[1] or 0)
                quiz_improvement = (quiz_after[1] or 0) - (quiz_before[1] or 0)
                
                if lesson_improvement > 0:
                    print(f"✅ Lessons improved: +{lesson_improvement} completions")
                else:
                    print(f"⚠️  No lesson completion improvement")
                    
                if quiz_improvement > 0:
                    print(f"✅ Quizzes improved: +{quiz_improvement} perfect scores")
                else:
                    print(f"⚠️  No quiz score improvement")
                
            else:
                print(f"❌ Full credit service failed: {result.get('message')}")
                
        except Exception as e:
            print(f"💥 Exception during test: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    print("🔬 TESTING FIXED FULL CREDIT SERVICE")
    print("=" * 60)
    test_full_credit_with_real_data()