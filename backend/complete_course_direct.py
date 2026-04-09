#!/usr/bin/env python3
"""
Complete a course for a specific student in a specific cohort.
Direct database approach without Flask app initialization overhead.
"""
import sys
import os
from datetime import datetime
from pathlib import Path

# Load environment variables directly
def load_env():
    env_file = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_file):
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip().strip('"').strip("'")

load_env()

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import json

def complete_course(student_id, course_id, cohort_label=None):
    """Complete a course for a student."""
    
    # Get database URL from environment
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL environment variable not set")
        return False
    
    # Transform postgresql:// to postgresql+psycopg2://
    if database_url.startswith('postgresql://'):
        database_url = database_url.replace('postgresql://', 'postgresql+psycopg2://', 1)
    
    # Create engine
    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Get student
        student = session.execute(
            text("SELECT id, first_name, last_name FROM users WHERE id = :id"),
            {"id": student_id}
        ).first()
        
        if not student:
            print(f"❌ Student {student_id} not found")
            return False
        
        print(f"✓ Student: {student[1]} {student[2]} (ID: {student_id})")
        
        # Get course
        course = session.execute(
            text("SELECT id, title FROM courses WHERE id = :id"),
            {"id": course_id}
        ).first()
        
        if not course:
            print(f"❌ Course {course_id} not found")
            return False
        
        print(f"✓ Course: {course[1]} (ID: {course_id})")
        
        # Get enrollment
        query = "SELECT id, progress FROM enrollments WHERE student_id = :student_id AND course_id = :course_id"
        params = {"student_id": student_id, "course_id": course_id}
        
        if cohort_label:
            query += " AND cohort_label = :cohort_label"
            params["cohort_label"] = cohort_label
            print(f"✓ Cohort: {cohort_label}")
        
        enrollment = session.execute(text(query), params).first()
        
        if not enrollment:
            print(f"❌ Enrollment not found for student {student_id} in course {course_id}")
            if cohort_label:
                print(f"   (with cohort label: {cohort_label})")
            return False
        
        enrollment_id = enrollment[0]
        current_progress = enrollment[1]
        print(f"✓ Enrollment found (ID: {enrollment_id}, current progress: {(current_progress or 0)*100:.1f}%)")
        
        # Get all modules in the course
        modules = session.execute(
            text("SELECT id, title FROM modules WHERE course_id = :course_id ORDER BY \"order\""),
            {"course_id": course_id}
        ).fetchall()
        
        print(f"✓ Course has {len(modules)} module(s)")
        
        now = datetime.utcnow()
        
        # Mark all modules as completed
        for module_id, module_title in modules:
            # Check if module_progress exists
            mp = session.execute(
                text("SELECT id FROM module_progress WHERE student_id = :student_id AND module_id = :module_id AND enrollment_id = :enrollment_id"),
                {"student_id": student_id, "module_id": module_id, "enrollment_id": enrollment_id}
            ).first()
            
            if not mp:
                # Create module progress
                session.execute(
                    text("""INSERT INTO module_progress 
                    (student_id, module_id, enrollment_id, status, cumulative_score, 
                     quiz_score, assignment_score, final_assessment_score, course_contribution_score,
                     completed_at, prerequisites_met)
                    VALUES (:student_id, :module_id, :enrollment_id, 'completed', 100.0, 
                            100.0, 100.0, 100.0, 100.0, :now, true)"""),
                    {
                        "student_id": student_id,
                        "module_id": module_id,
                        "enrollment_id": enrollment_id,
                        "now": now
                    }
                )
            else:
                # Update existing module progress
                session.execute(
                    text("""UPDATE module_progress SET status = 'completed', 
                    cumulative_score = 100.0, quiz_score = 100.0, 
                    assignment_score = 100.0, final_assessment_score = 100.0,
                    course_contribution_score = 100.0, completed_at = :now,
                    prerequisites_met = true
                    WHERE student_id = :student_id AND module_id = :module_id AND enrollment_id = :enrollment_id"""),
                    {
                        "student_id": student_id,
                        "module_id": module_id,
                        "enrollment_id": enrollment_id,
                        "now": now
                    }
                )
            
            # Get all lessons in this module
            lessons = session.execute(
                text("SELECT id FROM lessons WHERE module_id = :module_id"),
                {"module_id": module_id}
            ).fetchall()
            
            # Mark all lessons as completed
            for (lesson_id,) in lessons:
                # Check if lesson completion exists
                lc = session.execute(
                    text("SELECT id FROM lesson_completions WHERE student_id = :student_id AND lesson_id = :lesson_id"),
                    {"student_id": student_id, "lesson_id": lesson_id}
                ).first()
                
                if not lc:
                    # Create lesson completion
                    session.execute(
                        text("""INSERT INTO lesson_completions 
                        (student_id, lesson_id, completed, completed_at, time_spent,
                         reading_progress, engagement_score, scroll_progress, video_progress,
                         video_completed, lesson_score)
                        VALUES (:student_id, :lesson_id, true, :now, 3600,
                                100.0, 100.0, 100.0, 100.0, true, 100.0)"""),
                        {
                            "student_id": student_id,
                            "lesson_id": lesson_id,
                            "now": now
                        }
                    )
                else:
                    # Update existing lesson completion
                    session.execute(
                        text("""UPDATE lesson_completions SET completed = true, completed_at = :now,
                        time_spent = 3600, reading_progress = 100.0, engagement_score = 100.0,
                        scroll_progress = 100.0, video_progress = 100.0, video_completed = true,
                        lesson_score = 100.0
                        WHERE student_id = :student_id AND lesson_id = :lesson_id"""),
                        {
                            "student_id": student_id,
                            "lesson_id": lesson_id,
                            "now": now
                        }
                    )
            
            print(f"  ✓ Module '{module_title}': marked as completed with all lessons")
        
        # Update enrollment
        session.execute(
            text("""UPDATE enrollments SET progress = 1.0, status = 'completed', completed_at = :now
            WHERE id = :id"""),
            {"id": enrollment_id, "now": now}
        )
        
        # Commit all changes
        session.commit()
        
        print(f"\n✅ SUCCESS: Course '{course[1]}' completed for {student[1]} {student[2]}")
        print(f"   • Course progress: 100%")
        print(f"   • Status: completed")
        print(f"   • Completed at: {now}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        session.rollback()
        return False
    finally:
        session.close()

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python complete_course_for_student_direct.py <student_id> <course_id> [cohort_label]")
        print("\nExample:")
        print("  python complete_course_for_student_direct.py 42 1 'Cohort 1 ABX'")
        sys.exit(1)
    
    student_id = int(sys.argv[1])
    course_id = int(sys.argv[2])
    cohort_label = sys.argv[3] if len(sys.argv) > 3 else None
    
    success = complete_course(student_id, course_id, cohort_label)
    sys.exit(0 if success else 1)
