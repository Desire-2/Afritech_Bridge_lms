#!/usr/bin/env python3

"""
Check quiz and assignment content for lessons
"""

import sqlite3
import os

DB_PATH = "/home/desire/My_Project/AB/afritec_bridge_lms/backend/instance/afritec_lms_db.db"

def check_lesson_content():
    """Check which lessons have quizzes and assignments"""
    
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found at {DB_PATH}")
        return
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        print("Lesson Content Analysis")
        print("=" * 50)
        
        # Get all lessons
        cursor.execute("SELECT id, title, module_id FROM LESSONS ORDER BY id")
        lessons = cursor.fetchall()
        
        print(f"📖 Found {len(lessons)} lessons:")
        print()
        
        for lesson in lessons:
            lesson_id, lesson_title, module_id = lesson
            print(f"🔸 Lesson {lesson_id}: {lesson_title} (Module {module_id})")
            
            # Check for quizzes
            cursor.execute("SELECT id, title FROM QUIZZES WHERE lesson_id = ?", (lesson_id,))
            quizzes = cursor.fetchall()
            
            if quizzes:
                print(f"   📝 Quizzes ({len(quizzes)}):")
                for quiz in quizzes:
                    print(f"      - Quiz {quiz[0]}: {quiz[1]}")
            else:
                print(f"   📝 Quizzes: None")
            
            # Check for assignments
            cursor.execute("SELECT id, title FROM ASSIGNMENTS WHERE lesson_id = ?", (lesson_id,))
            assignments = cursor.fetchall()
            
            if assignments:
                print(f"   📋 Assignments ({len(assignments)}):")
                for assignment in assignments:
                    print(f"      - Assignment {assignment[0]}: {assignment[1]}")
            else:
                print(f"   📋 Assignments: None")
            
            print()
        
        # Summary of content
        print("📊 Content Summary")
        print("-" * 30)
        
        cursor.execute("SELECT COUNT(*) FROM QUIZZES WHERE lesson_id IS NOT NULL")
        lesson_quizzes = cursor.fetchone()[0]
        print(f"📝 Lesson-specific quizzes: {lesson_quizzes}")
        
        cursor.execute("SELECT COUNT(*) FROM ASSIGNMENTS WHERE lesson_id IS NOT NULL")
        lesson_assignments = cursor.fetchone()[0]
        print(f"📋 Lesson-specific assignments: {lesson_assignments}")
        
        cursor.execute("SELECT COUNT(*) FROM QUIZZES WHERE module_id IS NOT NULL AND lesson_id IS NULL")
        module_quizzes = cursor.fetchone()[0]
        print(f"📝 Module-only quizzes: {module_quizzes}")
        
        cursor.execute("SELECT COUNT(*) FROM ASSIGNMENTS WHERE module_id IS NOT NULL AND lesson_id IS NULL")
        module_assignments = cursor.fetchone()[0]
        print(f"📋 Module-only assignments: {module_assignments}")
        
        # Show sample of available content
        print("\n🎯 Sample Available Content:")
        print("-" * 30)
        
        cursor.execute("SELECT id, title, lesson_id FROM QUIZZES WHERE lesson_id IS NOT NULL LIMIT 3")
        sample_quizzes = cursor.fetchall()
        for quiz in sample_quizzes:
            print(f"📝 Quiz {quiz[0]} '{quiz[1]}' for Lesson {quiz[2]}")
        
        cursor.execute("SELECT id, title, lesson_id FROM ASSIGNMENTS WHERE lesson_id IS NOT NULL LIMIT 3")
        sample_assignments = cursor.fetchall()
        for assignment in sample_assignments:
            print(f"📋 Assignment {assignment[0]} '{assignment[1]}' for Lesson {assignment[2]}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Database error: {e}")

if __name__ == "__main__":
    check_lesson_content()