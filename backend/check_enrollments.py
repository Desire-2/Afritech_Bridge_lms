#!/usr/bin/env python3
"""
Check what enrollments exist for student 42.
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

def check_enrollments(student_id):
    """Check enrollments for a student."""
    
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
        # Get enrollments for student
        query = """SELECT e.id, c.id, c.title, e.cohort_label, e.progress, e.status 
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        WHERE e.student_id = :student_id
        ORDER BY c.id"""
        
        enrollments = session.execute(text(query), {"student_id": student_id}).fetchall()
        
        if not enrollments:
            print(f"❌ No enrollments found for student {student_id}")
            return False
        
        print(f"✓ Found {len(enrollments)} enrollment(s) for student {student_id}:")
        print()
        
        for enr_id, course_id, course_title, cohort_label, progress, status in enrollments:
            print(f"  Enrollment ID: {enr_id}")
            print(f"    Course ID: {course_id}")
            print(f"    Course: {course_title}")
            print(f"    Cohort Label: {cohort_label}")
            print(f"    Progress: {(progress or 0)*100:.1f}%")
            print(f"    Status: {status}")
            print()
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        session.close()

if __name__ == '__main__':
    student_id = int(sys.argv[1]) if len(sys.argv) > 1 else 42
    check_enrollments(student_id)
