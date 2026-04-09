#!/usr/bin/env python3
import sys

# Load .env manually
env = {}
with open('.env') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")

try:
    from sqlalchemy import create_engine, text
except ImportError:
    print("❌ sqlalchemy not found")
    sys.exit(1)

db_url = env.get('DATABASE_URL', '')
if db_url.startswith('postgresql://'):
    db_url = db_url.replace('postgresql://', 'postgresql+psycopg2://', 1)

if not db_url:
    print("❌ DATABASE_URL not configured")
    sys.exit(1)

try:
    engine = create_engine(db_url, echo=False)
    conn = engine.connect()
    
    # Get current time
    result = conn.execute(text("SELECT NOW()")).first()
    now = result[0] if result else None
    
    # Verify student and course exist
    student = conn.execute(text("SELECT id FROM users WHERE id = 42")).first()
    if not student:
        print("❌ Student 42 not found"); sys.exit(1)
    
    course = conn.execute(text("SELECT id FROM courses WHERE id = 1")).first()
    if not course:
        print("❌ Course 1 not found"); sys.exit(1)
    
    # Get enrollment ID
    enr = conn.execute(text("SELECT id FROM enrollments WHERE student_id = 42 AND course_id = 1 AND cohort_label = 'Cohort 1 EXC'")).first()
    if not enr:
        print("❌ Enrollment not found"); sys.exit(1)
    
    enr_id = enr[0]
    print(f"✓ Found enrollment ID: {enr_id}")
    
    # Get all modules
    modules = conn.execute(text("SELECT id FROM modules WHERE course_id = 1")).fetchall()
    print(f"✓ Processing {len(modules)} modules")
    
    # Mark modules and lessons complete
    for (mod_id,) in modules:
        # Insert or update module progress
        conn.execute(text("""
            INSERT INTO module_progress (student_id, module_id, enrollment_id, status, cumulative_score, 
            quiz_score, assignment_score, final_assessment_score, course_contribution_score, 
            completed_at, prerequisites_met)
            VALUES (42, :mid, :eid, 'completed', 100.0, 100.0, 100.0, 100.0, 100.0, :now, true)
            ON CONFLICT (student_id, module_id, enrollment_id) DO UPDATE SET
            status = 'completed', cumulative_score = 100.0, quiz_score = 100.0,
            assignment_score = 100.0, final_assessment_score = 100.0, course_contribution_score = 100.0,
            completed_at = :now, prerequisites_met = true
        """), {"mid": mod_id, "eid": enr_id, "now": now})
        
        # Complete all lessons in module
        lessons = conn.execute(text("SELECT id FROM lessons WHERE module_id = :mid"), {"mid": mod_id}).fetchall()
        for (lesson_id,) in lessons:
            conn.execute(text("""
                INSERT INTO lesson_completions (student_id, lesson_id, completed, completed_at, 
                time_spent, reading_progress, engagement_score, scroll_progress, video_progress, 
                video_completed, lesson_score)
                VALUES (42, :lid, true, :now, 3600, 100.0, 100.0, 100.0, 100.0, true, 100.0)
                ON CONFLICT (student_id, lesson_id) DO UPDATE SET
                completed = true, completed_at = :now, time_spent = 3600, reading_progress = 100.0,
                engagement_score = 100.0, scroll_progress = 100.0, video_progress = 100.0,
                video_completed = true, lesson_score = 100.0
            """), {"lid": lesson_id, "now": now})
    
    # Update enrollment
    conn.execute(text("""
        UPDATE enrollments SET progress = 1.0, status = 'completed', completed_at = :now
        WHERE id = :eid
    """), {"eid": enr_id, "now": now})
    
    # Commit
    conn.commit()
    conn.close()
    
    print(f"\n✅ SUCCESS: Course 1 completed for student 42 (enrollment {enr_id})!")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
