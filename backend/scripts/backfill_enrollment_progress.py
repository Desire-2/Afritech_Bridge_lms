"""One-off backfill: recompute enrollment progress from published content.

Progress/completion used to be measured against only the currently released
modules, so a student who finished the released part was marked 100% complete
(and issued a certificate) while most of the course was still locked.

This script re-derives ``enrollments.progress`` / ``status`` / ``completed_at``
(and the matching ``user_progress.completion_percentage``) for every existing
enrollment using the authoritative published-course counts.

Idempotent: running it again makes no further changes.

Usage:
    cd backend && ./venv/bin/python scripts/backfill_enrollment_progress.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Default to the local dev SQLite DB when DATABASE_URL is not configured.
_DEFAULT_DB = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'instance', 'afritec_lms_db.db',
)
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_DEFAULT_DB}")

import main as app_module  # noqa: E402,F401  (constructs the app)


def run():
    app = app_module.app
    with app.app_context():
        from src.models.course_models import Enrollment
        from src.services.enrollment_progress_service import EnrollmentProgressService

        enrollments = Enrollment.query.all()
        print(f"Found {len(enrollments)} enrollment(s) to reconcile")

        changed = 0
        for enrollment in enrollments:
            before = (
                enrollment.progress,
                enrollment.status,
                enrollment.completed_at.isoformat() if enrollment.completed_at else None,
            )
            counts = EnrollmentProgressService.sync_enrollment(enrollment, commit=False)
            after = (
                enrollment.progress,
                enrollment.status,
                enrollment.completed_at.isoformat() if enrollment.completed_at else None,
            )
            if before != after:
                changed += 1
                print(
                    f"  enrollment {enrollment.id} (student {enrollment.student_id}, course {enrollment.course_id}): "
                    f"{before[0]:.3f}/{before[1]}/{before[2]} -> {after[0]:.3f}/{after[1]}/{after[2]}"
                )
            if counts:
                print(
                    f"    modules {counts['completed_modules']}/{counts['total_modules']}, "
                    f"lessons {counts['completed_lessons']}/{counts['total_lessons']}"
                )

        from src.models.user_models import db
        db.session.commit()
        print(f"Done. {changed} enrollment(s) updated.")


if __name__ == "__main__":
    run()
