#!/usr/bin/env python3
"""
Check current certificate eligibility for student 42
"""
import sys

# Load .env
env = {}
with open('backend/.env') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")

import psycopg2
from urllib.parse import urlparse

db_url = env.get('DATABASE_URL', '')
parsed = urlparse(db_url)
conn = psycopg2.connect(
    host=parsed.hostname,
    port=parsed.port or 5432,
    user=parsed.username,
    password=parsed.password,
    database=parsed.path.lstrip('/')
)
cursor = conn.cursor()

print("=" * 70)
print("CERTIFICATE ELIGIBILITY CHECK - STUDENT 42")
print("=" * 70)

# Get enrollment status
cursor.execute("""
    SELECT id, progress, status FROM enrollments
    WHERE student_id = 42 AND course_id = 1 AND cohort_label = 'Cohort 1 EXC'
""")
enr = cursor.fetchone()
enr_id, progress, status = enr

print(f"\n1. ENROLLMENT STATUS")
print(f"   ├─ Progress: {progress*100:.1f}%")
print(f"   ├─ Status: {status}")
if progress == 1.0 and status == 'completed':
    print(f"   └─ ✅ PASS (100%, completed)")
else:
    print(f"   └─ ❌ FAIL (need 100%, completed)")

# Get module scores
cursor.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN cumulative_score >= 80 THEN 1 END) as passing,
        AVG(cumulative_score) as avg_score
    FROM module_progress
    WHERE student_id = 42 AND enrollment_id = %s
""", (enr_id,))

mod = cursor.fetchone()
total, passing, avg_score = mod

print(f"\n2. MODULE PROGRESS")
print(f"   ├─ Total modules: {total}")
print(f"   ├─ Passing (>= 80%): {passing}")
print(f"   ├─ Average score: {avg_score:.1f}%")
if passing == total and avg_score >= 80:
    print(f"   └─ ✅ PASS (all modules >= 80%)")
else:
    print(f"   └─ ❌ FAIL ({total-passing} modules below 80%)")

# Check course score
cursor.execute("""
    SELECT AVG(cumulative_score) FROM module_progress
    WHERE student_id = 42 AND enrollment_id = %s
""", (enr_id,))

course_score = cursor.fetchone()[0]

print(f"\n3. OVERALL SCORE")
print(f"   ├─ Course average: {course_score:.1f}%")
if course_score >= 80:
    print(f"   └─ ✅ PASS (>= 80%)")
else:
    print(f"   └─ ❌ FAIL (< 80%)")

# Check certificate eligibility
print(f"\n4. CERTIFICATE ELIGIBILITY")
eligible = (progress == 1.0 and status == 'completed' and 
            passing == total and course_score >= 80)

if eligible:
    print(f"   └─ ✅ ELIGIBLE FOR CERTIFICATE")
else:
    print(f"   └─ ❌ NOT ELIGIBLE")
    if progress < 1.0:
        print(f"      • Enrollment progress incomplete ({progress*100:.1f}%)")
    if status != 'completed':
        print(f"      • Enrollment status not completed ({status})")
    if passing < total:
        print(f"      • {total-passing} modules below 80%")
    if course_score < 80:
        print(f"      • Overall score below 80% ({course_score:.1f}%)")

cursor.close()
conn.close()
