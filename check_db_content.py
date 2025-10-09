#!/usr/bin/env python3

"""
Database content inspection for quiz and assignment records
"""

import sqlite3
import sys
import os

DB_PATH = "/home/desire/My_Project/AB/afritec_bridge_lms/backend/instance/afritec_lms_db.db"

def check_database():
    """Check database content for quizzes and assignments"""
    
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found at {DB_PATH}")
        return
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        print("Database Content Analysis")
        print("=" * 50)
        
        # Check quiz table
        try:
            cursor.execute("SELECT COUNT(*) FROM quiz")
            quiz_count = cursor.fetchone()[0]
            print(f"📝 Quizzes: {quiz_count} found")
            
            if quiz_count > 0:
                cursor.execute("SELECT id, title, lesson_id, module_id FROM quiz LIMIT 5")
                quizzes = cursor.fetchall()
                print("   Sample quizzes:")
                for quiz in quizzes:
                    lesson_id, module_id = quiz[2] if quiz[2] else "None", quiz[3] if quiz[3] else "None"
                    print(f"   - ID: {quiz[0]}, Title: {quiz[1]}, Lesson: {lesson_id}, Module: {module_id}")
        except Exception as e:
            print(f"❌ Quiz table error: {e}")
        
        # Check assignment table
        try:
            cursor.execute("SELECT COUNT(*) FROM assignment")
            assignment_count = cursor.fetchone()[0]
            print(f"📋 Assignments: {assignment_count} found")
            
            if assignment_count > 0:
                cursor.execute("SELECT id, title, lesson_id, module_id FROM assignment LIMIT 5")
                assignments = cursor.fetchall()
                print("   Sample assignments:")
                for assignment in assignments:
                    lesson_id, module_id = assignment[2] if assignment[2] else "None", assignment[3] if assignment[3] else "None"
                    print(f"   - ID: {assignment[0]}, Title: {assignment[1]}, Lesson: {lesson_id}, Module: {module_id}")
        except Exception as e:
            print(f"❌ Assignment table error: {e}")
        
        # Check lesson table
        try:
            cursor.execute("SELECT COUNT(*) FROM lesson")
            lesson_count = cursor.fetchone()[0]
            print(f"📖 Lessons: {lesson_count} found")
            
            if lesson_count > 0:
                cursor.execute("SELECT id, title, module_id FROM lesson LIMIT 5")
                lessons = cursor.fetchall()
                print("   Sample lessons:")
                for lesson in lessons:
                    print(f"   - ID: {lesson[0]}, Title: {lesson[1]}, Module: {lesson[2]}")
        except Exception as e:
            print(f"❌ Lesson table error: {e}")
        
        # Check for lesson-quiz relationships
        try:
            cursor.execute("""
                SELECT l.id, l.title, q.id, q.title 
                FROM lesson l 
                LEFT JOIN quiz q ON l.id = q.lesson_id 
                WHERE q.id IS NOT NULL 
                LIMIT 5
            """)
            lesson_quizzes = cursor.fetchall()
            print(f"🔗 Lesson-Quiz relationships: {len(lesson_quizzes)} found")
            for lq in lesson_quizzes:
                print(f"   - Lesson {lq[0]} '{lq[1]}' has Quiz {lq[2]} '{lq[3]}'")
        except Exception as e:
            print(f"❌ Lesson-Quiz relationship error: {e}")
        
        # Check for lesson-assignment relationships
        try:
            cursor.execute("""
                SELECT l.id, l.title, a.id, a.title 
                FROM lesson l 
                LEFT JOIN assignment a ON l.id = a.lesson_id 
                WHERE a.id IS NOT NULL 
                LIMIT 5
            """)
            lesson_assignments = cursor.fetchall()
            print(f"🔗 Lesson-Assignment relationships: {len(lesson_assignments)} found")
            for la in lesson_assignments:
                print(f"   - Lesson {la[0]} '{la[1]}' has Assignment {la[2]} '{la[3]}'")
        except Exception as e:
            print(f"❌ Lesson-Assignment relationship error: {e}")
        
        # Check table schema to see what columns exist
        try:
            print("\n📊 Database Schema Information:")
            for table in ['quiz', 'assignment', 'lesson']:
                cursor.execute(f"PRAGMA table_info({table})")
                columns = cursor.fetchall()
                print(f"   {table.upper()} table columns:")
                for col in columns:
                    print(f"     - {col[1]} ({col[2]})")
        except Exception as e:
            print(f"❌ Schema info error: {e}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Database connection error: {e}")

if __name__ == "__main__":
    check_database()