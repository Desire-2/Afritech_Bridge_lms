"""
Fix Enrollment Window Linkage
=============================
One-time migration script to link existing enrollments (that have
application_window_id = NULL) to their correct ApplicationWindow.

Resolution order per enrollment:
1. Via application_id → CourseApplication.application_window_id
2. Via matching CourseApplication (student_id/email + course_id, status=approved)
3. Via enrollment.cohort_label → matching window for the same course
4. Fallback: latest window for the course

Usage:
    cd backend
    python fix_enrollment_window_linkage.py          # dry-run (default)
    python fix_enrollment_window_linkage.py --apply   # actually write changes
"""

import os, sys
sys.path.insert(0, os.path.dirname(__file__))

def main():
    apply = '--apply' in sys.argv

    from main import app
    from src.models.user_models import db, User
    from src.models.course_models import ApplicationWindow, Enrollment, Course
    from src.models.course_application import CourseApplication

    with app.app_context():
        # Get all enrollments missing a window link
        orphans = Enrollment.query.filter(
            Enrollment.application_window_id.is_(None)
        ).all()

        print(f"Found {len(orphans)} enrollments without application_window_id\n")

        updated = 0
        skipped = 0

        for enrollment in orphans:
            course = enrollment.course
            if not course:
                print(f"  [SKIP] Enrollment {enrollment.id}: no course")
                skipped += 1
                continue

            window = None

            # 1) Via linked application
            if enrollment.application_id:
                try:
                    app_obj = CourseApplication.query.get(enrollment.application_id)
                    if app_obj and app_obj.application_window_id:
                        window = ApplicationWindow.query.get(app_obj.application_window_id)
                        if window:
                            print(f"  [1:app_id] Enrollment {enrollment.id} → Window {window.id} ({window.cohort_label})")
                except Exception:
                    pass

            # 2) Via matching application (student + course, status=approved)
            if not window:
                try:
                    student = User.query.get(enrollment.student_id)
                    if student:
                        matching_app = CourseApplication.query.filter_by(
                            course_id=enrollment.course_id,
                            status='approved'
                        ).filter(
                            db.or_(
                                CourseApplication.student_id == enrollment.student_id,
                                CourseApplication.email == student.email
                            )
                        ).order_by(CourseApplication.created_at.desc()).first()
                        if matching_app and matching_app.application_window_id:
                            window = ApplicationWindow.query.get(matching_app.application_window_id)
                            if window:
                                print(f"  [2:match] Enrollment {enrollment.id} → Window {window.id} ({window.cohort_label})")
                except Exception:
                    pass

            # 3) Via cohort_label on enrollment
            if not window and enrollment.cohort_label:
                window = ApplicationWindow.query.filter_by(
                    course_id=enrollment.course_id,
                    cohort_label=enrollment.cohort_label
                ).first()
                if window:
                    print(f"  [3:label] Enrollment {enrollment.id} → Window {window.id} ({window.cohort_label})")

            # 4) Fallback: latest window for the course
            if not window:
                window = ApplicationWindow.query.filter_by(
                    course_id=enrollment.course_id
                ).order_by(ApplicationWindow.id.desc()).first()
                if window:
                    print(f"  [4:latest] Enrollment {enrollment.id} → Window {window.id} ({window.cohort_label})")

            if window:
                if apply:
                    enrollment.application_window_id = window.id
                    if not enrollment.cohort_label and window.cohort_label:
                        enrollment.cohort_label = window.cohort_label
                    if not enrollment.cohort_start_date and window.cohort_start:
                        enrollment.cohort_start_date = window.cohort_start
                    if not enrollment.cohort_end_date and window.cohort_end:
                        enrollment.cohort_end_date = window.cohort_end
                updated += 1
            else:
                print(f"  [SKIP] Enrollment {enrollment.id}: no window found for course '{course.title}' (id={course.id})")
                skipped += 1

        if apply:
            db.session.commit()
            print(f"\n✅ APPLIED: Updated {updated} enrollments, skipped {skipped}")
        else:
            print(f"\n🔍 DRY RUN: Would update {updated} enrollments, skip {skipped}")
            print("   Re-run with --apply to write changes")


if __name__ == '__main__':
    main()
