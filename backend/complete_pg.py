#!/usr/bin/env python3
"""
Direct PostgreSQL completion script using psycopg2
"""
import sys

# Load .env
env = {}
with open('.env') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")

try:
    import psycopg2
    from datetime import datetime
except ImportError as e:
    print(f"❌ Missing module: {e}")
    sys.exit(1)

db_url = env.get('DATABASE_URL', '')
if not db_url:
    print("❌ DATABASE_URL not set")
    sys.exit(1)

# Parse PostgreSQL URL
try:
    from urllib.parse import urlparse
    parsed = urlparse(db_url)
    
    conn = psycopg2.connect(
        host=parsed.hostname,
        port=parsed.port or 5432,
        user=parsed.username,
        password=parsed.password,
        database=parsed.path.lstrip('/')
    )
    cursor = conn.cursor()
    print("✓ Connected to PostgreSQL")
    
    # Verify student and course
    cursor.execute("SELECT id FROM users WHERE id = 42")
    if not cursor.fetchone():
        print("❌ Student 42 not found")
        sys.exit(1)
    
    cursor.execute("SELECT id FROM courses WHERE id = 1")
    if not cursor.fetchone():
        print("❌ Course 1 not found")
        sys.exit(1)
    
    # Get enrollment
    cursor.execute(
        "SELECT id FROM enrollments WHERE student_id = 42 AND course_id = 1 AND cohort_label = %s",
        ('Cohort 1 EXC',)
    )
    enr = cursor.fetchone()
    if not enr:
        print("❌ Enrollment not found for student 42 in course 1 with cohort 'Cohort 1 EXC'")
        sys.exit(1)
    
    enr_id = enr[0]
    print(f"✓ Found enrollment ID: {enr_id}")
    
    # Get all modules
    cursor.execute("SELECT id FROM modules WHERE course_id = 1")
    modules = cursor.fetchall()
    print(f"✓ Processing {len(modules)} modules")
    
    now = datetime.utcnow()
    
    # Mark modules and lessons complete
    total_lessons = 0
    for (mod_id,) in modules:
        # Insert or update module progress
        cursor.execute("""
            INSERT INTO module_progress (student_id, module_id, enrollment_id, status, cumulative_score, 
            quiz_score, assignment_score, final_assessment_score, course_contribution_score, 
            completed_at, prerequisites_met)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (student_id, module_id, enrollment_id) DO UPDATE SET
            status = 'completed', cumulative_score = 100.0, quiz_score = 100.0,
            assignment_score = 100.0, final_assessment_score = 100.0, course_contribution_score = 100.0,
            completed_at = %s, prerequisites_met = true
        """, (42, mod_id, enr_id, 'completed', 100.0, 100.0, 100.0, 100.0, 100.0, now, True, now))
        
        # Get all lessons in this module
        cursor.execute("SELECT id FROM lessons WHERE module_id = %s", (mod_id,))
        lessons = cursor.fetchall()
        total_lessons += len(lessons)
        
        for (lesson_id,) in lessons:
            cursor.execute("""
                INSERT INTO lesson_completions (student_id, lesson_id, completed, completed_at, 
                time_spent, reading_progress, engagement_score, scroll_progress, video_progress, 
                video_completed, lesson_score)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (student_id, lesson_id) DO UPDATE SET
                completed = true, completed_at = %s, time_spent = 3600, reading_progress = 100.0,
                engagement_score = 100.0, scroll_progress = 100.0, video_progress = 100.0,
                video_completed = true, lesson_score = 100.0
            """, (42, lesson_id, True, now, 3600, 100.0, 100.0, 100.0, 100.0, True, 100.0, now))
    
    print(f"✓ Completed {total_lessons} lessons")
    
    # Update enrollment
    cursor.execute(
        "UPDATE enrollments SET progress = 1.0, status = %s, completed_at = %s WHERE id = %s",
        ('completed', now, enr_id)
    )
    
    # Commit and close
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"\n✅ SUCCESS: Course 1 completed for student 42!")
    print(f"   Enrollment ID: {enr_id}")
    print(f"   Completed at: {now}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
