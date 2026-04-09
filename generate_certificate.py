#!/usr/bin/env python3
"""
Generate certificate for student 42 who completed course 1
"""
import sys
import hashlib
import random
from datetime import datetime

# Load .env
env = {}
with open('backend/.env') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")

try:
    import psycopg2
    from urllib.parse import urlparse
except ImportError as e:
    print(f"❌ Missing module: {e}")
    sys.exit(1)

db_url = env.get('DATABASE_URL', '')
if not db_url:
    print("❌ DATABASE_URL not set")
    sys.exit(1)

try:
    parsed = urlparse(db_url)
    conn = psycopg2.connect(
        host=parsed.hostname,
        port=parsed.port or 5432,
        user=parsed.username,
        password=parsed.password,
        database=parsed.path.lstrip('/')
    )
    conn.autocommit = False
    cursor = conn.cursor()
    print("✓ Connected to PostgreSQL")
    sys.stdout.flush()
    
    # Get student info
    cursor.execute("SELECT id, first_name, last_name FROM users WHERE id = 42")
    student = cursor.fetchone()
    if not student:
        print("❌ Student 42 not found")
        sys.exit(1)
    
    student_id, first_name, last_name = student
    print(f"✓ Student: {first_name} {last_name}")
    sys.stdout.flush()
    
    # Get course info
    cursor.execute("SELECT id, title FROM courses WHERE id = 1")
    course = cursor.fetchone()
    if not course:
        print("❌ Course 1 not found")
        sys.exit(1)
    
    course_id, course_title = course
    print(f"✓ Course: {course_title}")
    sys.stdout.flush()
    
    # Get enrollment
    cursor.execute("""
        SELECT id, progress, status FROM enrollments 
        WHERE student_id = 42 AND course_id = 1 AND cohort_label = 'Cohort 1 EXC'
    """)
    enrollment = cursor.fetchone()
    if not enrollment:
        print("❌ Enrollment not found")
        sys.exit(1)
    
    enrollment_id, progress, status = enrollment
    print(f"✓ Enrollment: ID={enrollment_id}, progress={progress*100:.1f}%, status={status}")
    sys.stdout.flush()
    
    if progress < 1.0 or status != 'completed':
        print("⚠️  Warning: Enrollment is not marked as completed")
        if progress < 1.0:
            print(f"   Progress is only {progress*100:.1f}%, expected 100%")
    
    # Calculate overall score from modules
    cursor.execute("""
        SELECT AVG(cumulative_score) FROM module_progress
        WHERE student_id = 42 AND enrollment_id = 1
    """)
    score_row = cursor.fetchone()
    overall_score = score_row[0] if score_row and score_row[0] else 100.0
    
    print(f"✓ Overall score: {overall_score:.1f}%")
    sys.stdout.flush()
    
    # Calculate grade based on score
    if overall_score >= 90:
        grade = 'A'
    elif overall_score >= 80:
        grade = 'B'
    elif overall_score >= 70:
        grade = 'C'
    elif overall_score >= 60:
        grade = 'D'
    else:
        grade = 'F'
    
    print(f"✓ Grade: {grade}")
    sys.stdout.flush()
    
    # Check if certificate already exists
    cursor.execute("""
        SELECT id FROM certificates 
        WHERE student_id = 42 AND course_id = 1 AND enrollment_id = %s
    """, (enrollment_id,))
    
    existing = cursor.fetchone()
    if existing:
        print(f"⚠️  Certificate already exists (ID: {existing[0]})")
        print("   Skipping creation")
        cursor.close()
        conn.close()
        sys.exit(0)
    
    # Generate certificate number
    year = datetime.now().year
    random_num = random.randint(100000, 999999)
    certificate_number = f"ABC-{year}-{random_num}"
    
    # Generate verification hash
    now = datetime.utcnow()
    hash_string = f"{student_id}{course_id}{certificate_number}{now}"
    verification_hash = hashlib.sha256(hash_string.encode()).hexdigest()
    
    print(f"✓ Certificate number: {certificate_number}")
    print(f"✓ Verification hash: {verification_hash[:16]}...")
    sys.stdout.flush()
    
    # Insert certificate with is_active set to true
    cursor.execute("""
        INSERT INTO certificates 
        (student_id, course_id, enrollment_id, certificate_number, overall_score, grade, verification_hash, issued_at, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (student_id, course_id, enrollment_id, certificate_number, overall_score, grade, verification_hash, now, True))
    
    # Get the inserted certificate ID
    cursor.execute("SELECT CURRVAL(pg_get_serial_sequence('certificates', 'id'))")
    cert_id = cursor.fetchone()[0]
    
    # Commit
    print("\nCommitting certificate...")
    sys.stdout.flush()
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"\n✅ SUCCESS: Certificate generated for student 42!")
    print(f"   Certificate ID: {cert_id}")
    print(f"   Certificate Number: {certificate_number}")
    print(f"   Overall Score: {overall_score:.1f}%")
    sys.stdout.flush()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
