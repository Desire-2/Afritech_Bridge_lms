#!/usr/bin/env python3
import os

# Load .env manually
with open('.env') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ[k.strip()] = v.strip().strip('"').strip("'")

from sqlalchemy import create_engine, text

db_url = os.getenv('DATABASE_URL')
if db_url.startswith('postgresql://'):
    db_url = db_url.replace('postgresql://', 'postgresql+psycopg2://', 1)

engine = create_engine(db_url)

with engine.connect() as conn:
    print("Enrollments for student 42:")
    rows = conn.execute(text("""
        SELECT e.id, e.student_id, e.course_id, c.title, e.cohort_label, e.progress, e.status
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        WHERE e.student_id = 42
        ORDER BY e.course_id
    """)).fetchall()
    
    for row in rows:
        enr_id, student_id, course_id, course_title, cohort, progress, status = row
        print(f"  Enrollment ID: {enr_id}")
        print(f"    Course: {course_title} (ID: {course_id})")
        print(f"    Cohort Label: '{cohort}'")
        print(f"    Progress: {(progress or 0)*100:.1f}%")
        print(f"    Status: {status}")
        print()
