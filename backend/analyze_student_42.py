#!/usr/bin/env python3
import sqlite3

conn = sqlite3.connect('instance/afritec_lms_db.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

# Get student info
c.execute('SELECT id, first_name, last_name, email FROM users WHERE id = 42')
student = c.fetchone()
if student:
    print(f'Student: {student["first_name"]} {student["last_name"]} (ID: 42)')
    print(f'Email: {student["email"]}')
    print()
    
    # Get enrollments
    c.execute('SELECT e.id, c.id, c.title, e.progress FROM enrollment e JOIN course c ON e.course_id = c.id WHERE e.student_id = 42')
    enrollments = c.fetchall()
    
    for enr in enrollments:
        print(f'Course: {enr["title"]} (ID: {enr[2]})')
        print(f'Progress: {(enr["progress"] or 0)*100:.1f}%')
        print()
        
        # Get modules
        c.execute('SELECT id, title FROM module WHERE course_id = ? ORDER BY "order"', (enr[2],))
        modules = c.fetchall()
        print(f'Modules ({len(modules)} total):')
        
        module_scores = []
        completed = 0
        failed = 0
        failures_list = []
        incomplete_list = []
        
        for mod in modules:
            c.execute('SELECT cumulative_score FROM module_progress WHERE student_id = 42 AND module_id = ? LIMIT 1', (mod[0],))
            mp = c.fetchone()
            if mp and mp[0]:
                score = mp[0]
                if score >= 80:
                    print(f'  ✅ {mod["title"]}: {score:.1f}%')
                    module_scores.append(score)
                    completed += 1
                else:
                    gap = 80 - score
                    print(f'  ❌ {mod["title"]}: {score:.1f}% (gap: {gap:.1f}%)')
                    module_scores.append(score)
                    failed += 1
                    failures_list.append((mod["title"], score, gap))
            else:
                print(f'  ⏳ {mod["title"]}: No progress')
                incomplete_list.append(mod["title"])
        
        print()
        overall = sum(module_scores) / len(module_scores) if module_scores else 0
        
        print('='*60)
        print('CERTIFICATE REQUIREMENTS CHECK:')
        print('='*60)
        issues = []
        
        if overall >= 80:
            print(f'✅ Overall Score: {overall:.1f}%')
        else:
            gap = 80 - overall
            print(f'❌ Overall Score: {overall:.1f}% (need {gap:.1f}% more)')
            issues.append(f'Score {gap:.1f}% below target')
        
        if completed == len(modules):
            print(f'✅ Module Completion: {completed}/{len(modules)}')
        else:
            rem = len(modules) - completed - failed
            print(f'❌ Module Completion: {completed}/{len(modules)} ({rem} incomplete, {failed} failing)')
            issues.append(f'{rem + failed} module(s) not meeting standards')
        
        if failed == 0:
            print(f'✅ All Modules Passing (>= 80%)')
        else:
            print(f'❌ {failed} module(s) below 80%:')
            for fname, fscore, fgap in failures_list:
                print(f'   • {fname}: {fscore:.1f}%')
            issues.append(f'{failed} module(s) below 80%')
        
        print()
        if issues:
            print('NOT ELIGIBLE - Issues:')
            for i, iss in enumerate(issues, 1):
                print(f'  {i}. {iss}')
        else:
            print('✅ ELIGIBLE FOR CERTIFICATE!')
        print('='*60)
else:
    print('Student 42 not found')

conn.close()
