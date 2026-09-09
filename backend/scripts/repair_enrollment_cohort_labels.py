"""Repair stale/missing cohort metadata on enrollments.

An Enrollment is tied to an ApplicationWindow (the authoritative cohort) via
``application_window_id``. In some legacy paths the enrollment's free-text
``cohort_label`` (and cohort start/end dates) were set or migrated with a value
that disagrees with the linked window, or left NULL. That made instructor-side
cohort aggregation (which previously grouped by ``cohort_label`` text) report
different students than the admin cohort view for the same cohort.

This script aligns each enrollment's cohort fields to its linked window:
  - corpus to the enrollment_id with a mismatched/wrong label get corrected
  - NULL cohort_label / cohort_start_date / cohort_end_date are backfilled
  - enrollments with no linked window are left untouched (best-effort: a single
    matching window by cohort_label is linked, mirroring the runtime resolver)

Idempotent: running it again makes no changes.
"""
import os
import sqlite3
import sys

DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'instance', 'afritec_lms_db.db',
)

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row

# Map window_id -> (cohort_label, cohort_start, cohort_end)
window_meta = {}
for w in conn.execute('SELECT id, cohort_label, cohort_start, cohort_end FROM application_windows'):
    window_meta[w['id']] = (w['cohort_label'], w['cohort_start'], w['cohort_end'])

fixed_label = 0
fixed_dates = 0
linked = 0
unchanged = 0

for en in conn.execute('SELECT id, student_id, course_id, application_window_id, cohort_label, cohort_start_date, cohort_end_date FROM enrollments'):
    meta = None
    if en['application_window_id'] is not None:
        meta = window_meta.get(en['application_window_id'])
    else:
        # Best-effort link: single matching window for the same course by label
        if en['cohort_label']:
            matches = [
                (w['id'], w['cohort_label'], w['cohort_start'], w['cohort_end'])
                for w in conn.execute(
                    'SELECT id, cohort_label, cohort_start, cohort_end FROM application_windows WHERE course_id = ? AND cohort_label = ?',
                    (en['course_id'], en['cohort_label']),
                )
            ]
            if len(matches) == 1:
                meta = matches[0]

    if not meta:
        continue

    window_label, window_start, window_end = meta
    updates = []
    params = []

    label = en['cohort_label']
    if window_label and label != window_label:
        updates.append('cohort_label = ?')
        params.append(window_label)
        fixed_label += 1
    elif window_label and label is None:
        updates.append('cohort_label = ?')
        params.append(window_label)
        fixed_label += 1

    for col, current, value in (
        ('cohort_start_date', en['cohort_start_date'], window_start),
        ('cohort_end_date', en['cohort_end_date'], window_end),
    ):
        if value and not current:
            updates.append(f'{col} = ?')
            params.append(value)
            fixed_dates += 1

    if en['application_window_id'] is None and meta and en['application_window_id'] != meta[0] and updates:
        # Only set application_window_id when we are confident (single label match)
        updates.insert(0, 'application_window_id = ?')
        params.insert(0, meta[0])
        linked += 1

    if updates:
        params.append(en['id'])
        conn.execute(
            f'UPDATE enrollments SET {", ".join(updates)} WHERE id = ?',
            params,
        )
        print(
            f"  enrollment #{en['id']} (student {en['student_id']}, course {en['course_id']}): "
            f"label {en['cohort_label']!r} -> {updates}"
        )
    else:
        unchanged += 1

conn.commit()
print('----')
print(f'cohort_labels corrected: {fixed_label}')
print(f'cohort dates backfilled: {fixed_dates}')
print(f'legacy enrollments linked to window: {linked}')
print(f'unchanged: {unchanged}')
conn.close()
sys.exit(0)