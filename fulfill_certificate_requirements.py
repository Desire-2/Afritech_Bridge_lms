#!/usr/bin/env python3
"""
Fulfill all certificate requirements for student 42.
Certificate requirements:
1. Overall course score >= 80%
2. All modules completed
3. All modules have score >= 80%
4. Enrollment status = 'completed'
5. Enrollment progress = 1.0 (100%)
"""
import sys
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
    print("=" * 70)
    print("FULFILLING CERTIFICATE REQUIREMENTS FOR STUDENT 42")
    print("=" * 70)
    sys.stdout.flush()
    
    # Get student and course info
    cursor.execute("SELECT id, first_name, last_name FROM users WHERE id = 42")
    student = cursor.fetchone()
    student_id, first_name, last_name = student
    
    cursor.execute("SELECT id, title FROM courses WHERE id = 1")
    course = cursor.fetchone()
    course_id, course_title = course
    
    # Get enrollment
    cursor.execute("""
        SELECT id, progress, status FROM enrollments 
        WHERE student_id = 42 AND course_id = 1 AND cohort_label = 'Cohort 1 EXC'
    """)
    enrollment = cursor.fetchone()
    enrollment_id, progress, status = enrollment
    
    print(f"\nStudent: {first_name} {last_name} (ID: {student_id})")
    print(f"Course: {course_title} (ID: {course_id})")
    print(f"Enrollment: ID={enrollment_id}, Progress={progress*100:.1f}%, Status={status}")
    print()
    sys.stdout.flush()
    
    # Get all modules in course
    cursor.execute("""
        SELECT id, title FROM modules WHERE course_id = 1 ORDER BY "order"
    """)
    modules = cursor.fetchall()
    print(f"REQUIREMENT 1: All modules completed and >= 80% score")
    print(f"─" * 70)
    print(f"Found {len(modules)} modules in course\n")
    sys.stdout.flush()
    
    now = datetime.utcnow()
    module_scores = []
    
    for mod_id, mod_title in modules:
        # Get or create module progress
        cursor.execute("""
            SELECT id, cumulative_score FROM module_progress
            WHERE student_id = 42 AND module_id = %s AND enrollment_id = %s
        """, (mod_id, enrollment_id))
        
        mp = cursor.fetchone()
        if mp:
            mp_id, current_score = mp
            print(f"  ✓ {mod_title}: Current score = {current_score:.1f}%", end="")
        else:
            print(f"  ↳ {mod_title}: Not yet started", end="")
            mp_id = None
            current_score = 0
        
        # Ensure score is >= 80%
        if current_score < 80.0:
            target_score = 90.0  # Set to 90% to exceed requirement
            print(f" → Setting to {target_score}%")
            
            if mp_id:
                # Update existing
                cursor.execute("""
                    UPDATE module_progress SET 
                    cumulative_score = %s, quiz_score = %s, assignment_score = %s,
                    final_assessment_score = %s, course_contribution_score = %s,
                    status = 'completed', completed_at = %s, prerequisites_met = true
                    WHERE id = %s
                """, (target_score, target_score, target_score, target_score, 
                      target_score, now, mp_id))
            else:
                # Create new
                cursor.execute("""
                    INSERT INTO module_progress 
                    (student_id, module_id, enrollment_id, cumulative_score, quiz_score,
                     assignment_score, final_assessment_score, course_contribution_score,
                     status, completed_at, prerequisites_met)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (42, mod_id, enrollment_id, target_score, target_score, target_score,
                      target_score, target_score, 'completed', now, True))
            module_scores.append(target_score)
        else:
            print()
            module_scores.append(current_score)
        
        sys.stdout.flush()
    
    print()
    avg_score = sum(module_scores) / len(module_scores) if module_scores else 0
    print(f"  Module Average: {avg_score:.1f}%")
    if avg_score >= 80:
        print(f"  ✅ PASSED: Average score {avg_score:.1f}% >= 80%")
    else:
        print(f"  ❌ FAILED: Average score {avg_score:.1f}% < 80%")
    sys.stdout.flush()
    
    # Requirement 2: Update enrollment to fully completed
    print(f"\nREQUIREMENT 2: Enrollment fully completed (100%, status='completed')")
    print(f"─" * 70)
    print(f"  Current: Progress={progress*100:.1f}%, Status='{status}'")
    print(f"  Updating to: Progress=100%, Status='completed'")
    
    cursor.execute("""
        UPDATE enrollments SET progress = 1.0, status = 'completed', completed_at = %s
        WHERE id = %s
    """, (now, enrollment_id))
    
    print(f"  ✅ Updated")
    sys.stdout.flush()
    
    # Verify requirements
    print(f"\nVERIFYING ALL CERTIFICATE REQUIREMENTS")
    print(f"─" * 70)
    
    # Check 1: All modules >= 80%
    cursor.execute("""
        SELECT COUNT(*) FROM module_progress
        WHERE student_id = 42 AND enrollment_id = %s AND cumulative_score >= 80.0
    """, (enrollment_id,))
    passing_modules = cursor.fetchone()[0]
    print(f"  ✓ Modules with score >= 80%: {passing_modules}/{len(modules)}")
    if passing_modules == len(modules):
        print(f"    ✅ All modules passing")
    sys.stdout.flush()
    
    # Check 2: Enrollment status
    cursor.execute("""
        SELECT progress, status FROM enrollments WHERE id = %s
    """, (enrollment_id,))
    final_progress, final_status = cursor.fetchone()
    print(f"  ✓ Enrollment Status: progress={final_progress*100:.1f}%, status='{final_status}'")
    if final_progress == 1.0 and final_status == 'completed':
        print(f"    ✅ Enrollment fully completed")
    sys.stdout.flush()
    
    # Check 3: Certificate eligibility
    cursor.execute("""
        SELECT AVG(cumulative_score) FROM module_progress
        WHERE student_id = 42 AND enrollment_id = %s
    """, (enrollment_id,))
    final_avg = cursor.fetchone()[0]
    print(f"  ✓ Final Average Score: {final_avg:.1f}%")
    if final_avg >= 80:
        print(f"    ✅ Score >= 80% (eligible for certificate)")
    sys.stdout.flush()
    
    # Commit all changes
    print(f"\nCommitting all changes...")
    sys.stdout.flush()
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"\n" + "=" * 70)
    print(f"✅ ALL CERTIFICATE REQUIREMENTS FULFILLED!")
    print(f"=" * 70)
    print(f"\nStudent {first_name} {last_name} is now eligible for certificate.")
    print(f"Final Score: {final_avg:.1f}%")
    print(f"Next step: Generate PR PDF certificate")
    sys.stdout.flush()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
