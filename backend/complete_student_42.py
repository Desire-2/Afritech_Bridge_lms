#!/usr/bin/env python3
import os
os.environ['FLASK_ENV'] = 'production'

# Load .env manually
with open('.env') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ[k.strip()] = v.strip().strip('"').strip("'")

from sqlalchemy import create_engine, text
from datetime import datetime

db_url = os.getenv('DATABASE_URL')
if db_url.startswith('postgresql://'):
    db_url = db_url.replace('postgresql://', 'postgresql+psycopg2://', 1)

engine = create_engine(db_url)

with engine.connect() as conn:
    # Check student
    r = conn.execute(text("SELECT id, first_name, last_name FROM users WHERE id = 42")).first()
    if not r:
        print("❌ Student 42 not found")
        exit(1)
    print(f"✓ Student: {r[1]} {r[2]} (ID: 42)")
    
    # Check course
    r = conn.execute(text("SELECT id, title FROM courses WHERE id = 1")).first()
    if not r:
        print("❌ Course 1 not found")
        exit(1)
    print(f"✓ Course: {r[1]} (ID: 1)")
    
    # Check enrollment
    r = conn.execute(text("SELECT id, cohort_label, progress FROM enrollments WHERE student_id = 42 AND course_id = 1 AND cohort_label = 'Cohort 1 EXC'")).first()
    if not r:
        print("❌ Enrollment not found")
        exit(1)
    enr_id = r[0]
    print(f"✓ Enrollment found (ID: {enr_id}, cohort: {r[1]}, progress: {(r[2] or 0)*100:.1f}%)")
    
    # Get modules
    modules = conn.execute(text("SELECT id, title FROM modules WHERE course_id = 1 ORDER BY \"order\"")).fetchall()
    print(f"✓ Course has {len(modules)} module(s)")
    
    now = datetime.utcnow()
    
    # Mark all modules and lessons complete
    for mod_id, mod_title in modules:
        # Check/create module progress
        mp = conn.execute(text("SELECT id FROM module_progress WHERE student_id = 42 AND module_id = :mid AND enrollment_id = :eid"), {"mid": mod_id, "eid": enr_id}).first()
        if not mp:
            conn.execute(text("""INSERT INTO module_progress 
                (student_id, module_id, enrollment_id, status, cumulative_score, quiz_score,
                 assignment_score, final_assessment_score, course_contribution_score, completed_at,
                 prerequisites_met)
                VALUES (42, :mid, :eid, 'completed', 100.0, 100.0, 100.0, 100.0, 100.0, :now, true)"""),
                {"mid": mod_id, "eid": enr_id, "now": now})
        else:
            conn.execute(text("""UPDATE module_progress SET status = 'completed', cumulative_score = 100.0,
                quiz_score = 100.0, assignment_score = 100.0, final_assessment_score = 100.0,
                course_contribution_score = 100.0, completed_at = :now, prerequisites_met = true
                WHERE id = :id"""), {"id": mp[0], "now": now})
        
        # Complete all lessons in module
        lessons = conn.execute(text("SELECT id FROM lessons WHERE module_id = :mid"), {"mid": mod_id}).fetchall()
        for (lesson_id,) in lessons:
            lc = conn.execute(text("SELECT id FROM lesson_completions WHERE student_id = 42 AND lesson_id = :lid"), {"lid": lesson_id}).first()
            if not lc:
                conn.execute(text("""INSERT INTO lesson_completions
                    (student_id, lesson_id, completed, completed_at, time_spent, reading_progress,
                     engagement_score, scroll_progress, video_progress, video_completed, lesson_score)
                    VALUES (42, :lid, true, :now, 3600, 100.0, 100.0, 100.0, 100.0, true, 100.0)"""),
                    {"lid": lesson_id, "now": now})
            else:
                conn.execute(text("""UPDATE lesson_completions SET completed = true, completed_at = :now,
                    time_spent = 3600, reading_progress = 100.0, engagement_score = 100.0,
                    scroll_progress = 100.0, video_progress = 100.0, video_completed = true, lesson_score = 100.0
                    WHERE id = :id"""), {"id": lc[0], "now": now})
        
        print(f"  ✓ Module '{mod_title}': completed")
    
    # Update enrollment
    conn.execute(text("UPDATE enrollments SET progress = 1.0, status = 'completed', completed_at = :now WHERE id = :id"),
                 {"id": enr_id, "now": now})
    
    # Commit
    conn.commit()

print("\n✅ SUCCESS: Course completed for student 42!")
