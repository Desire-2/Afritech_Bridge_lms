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
        # Get some real data to test with
        
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
        \"\"\"))
        
        test_data = result.fetchone()
        
        if not test_data:
            print("❌ No test data found. Need at least one student enrolled in a course with modules.")
            return
        
        print(f"🧪 Testing with:")
        print(f"  Student: {test_data[1]} (ID: {test_data[0]})")
        print(f"  Module: {test_data[3]} (ID: {test_data[2]})")
        print(f"  Enrollment ID: {test_data[4]}")
        print(f"  Instructor ID: {test_data[5]}")
        
        # Test the full credit service
        try:
            result = FullCreditService.give_module_full_credit(
                student_id=test_data[0],
                module_id=test_data[2],
                instructor_id=test_data[5],
                enrollment_id=test_data[4]
            )
            
            print(f"\n📋 RESULT:")
            print(f"Success: {result.get('success')}")
            print(f"Message: {result.get('message')}")
            print(f"Details: {result.get('details')}")
            
            if result.get('success'):
                print("\n✅ Full credit service completed successfully!")
                
                # Verify the data was actually updated
                print("\n🔍 Verifying updates...")
                
                # Check lesson completions
                lesson_completions = db.session.execute(text("""
                    SELECT lc.lesson_id, lc.completed, lc.lesson_score
                    FROM lesson_completions lc
                    JOIN lessons l ON lc.lesson_id = l.id
                    WHERE lc.student_id = :student_id AND l.module_id = :module_id
                """), {"student_id": test_data[0], "module_id": test_data[2]}).fetchall()
                
                print(f"Lesson completions updated: {len(lesson_completions)}")
                for completion in lesson_completions:
                    print(f"  - Lesson {completion[0]}: completed={completion[1]}, score={completion[2]}")
                
                # Check quiz attempts
                quiz_attempts = db.session.execute(text("""
                    SELECT qa.quiz_id, qa.score, qa.status
                    FROM quiz_attempts qa
                    JOIN quizzes q ON qa.quiz_id = q.id
                    WHERE qa.user_id = :user_id AND q.module_id = :module_id
                """), {"user_id": test_data[0], "module_id": test_data[2]}).fetchall()
                
                print(f"Quiz attempts updated: {len(quiz_attempts)}")
                for attempt in quiz_attempts:
                    print(f"  - Quiz {attempt[0]}: score={attempt[1]}, status={attempt[2]}")
                
                # Check module progress
                module_progress = db.session.execute(text("""
                    SELECT status, cumulative_score, completed_at
                    FROM module_progress
                    WHERE student_id = :student_id AND module_id = :module_id
                """), {"student_id": test_data[0], "module_id": test_data[2]}).fetchone()
                
                if module_progress:
                    print(f"Module progress: status={module_progress[0]}, score={module_progress[1]}, completed={module_progress[2]}")
                else:
                    print("No module progress found")
                
            else:
                print("❌ Full credit service failed!")
                
        except Exception as e:
            print(f"💥 Exception during test: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    print("🔬 TESTING FIXED FULL CREDIT SERVICE")
    print("=" * 60)
    test_full_credit_with_real_data()