"""One-off backfill: persist project scores into module_progress.

Project grading wrote to module_progress.project_score, but the model never
declared that column, so every grade was discarded. This recomputes each
student's best percentage per project from graded submissions and stores it
on the ModuleProgress rows of every module the project covers (whole-course
projects cover all course modules), then refreshes the cumulative score.

Idempotent: running it again keeps the max score and makes no further changes.

Usage:
    cd backend && ./venv/bin/python scripts/backfill_project_scores.py
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
        from src.models.course_models import (
            Enrollment, Module, Project, ProjectSubmission,
        )
        from src.models.student_models import ModuleProgress
        from src.services.progression_service import ProgressionService

        # Best graded percentage per (student, project)
        best = {}  # (student_id, project_id) -> (percentage, project)
        submissions = ProjectSubmission.query.filter(
            ProjectSubmission.grade.isnot(None)
        ).all()
        for submission in submissions:
            project = submission.project
            if not project:
                continue
            points = project.points_possible or 100
            if points <= 0:
                continue
            percentage = max(0.0, min(100.0, (submission.grade / points) * 100))
            key = (submission.student_id, project.id)
            current = best.get(key)
            if current is None or percentage > current[0]:
                best[key] = (percentage, project)

        print(f"Found {len(submissions)} graded submission(s), "
              f"{len(best)} best (student, project) pair(s)")

        updated = 0
        for (student_id, _project_id), (percentage, project) in best.items():
            enrollment = Enrollment.query.filter_by(
                student_id=student_id, course_id=project.course_id
            ).first()
            if not enrollment:
                continue

            module_ids = project.get_modules()
            if not module_ids:
                module_ids = [
                    m.id for m in Module.query.filter_by(course_id=project.course_id).all()
                ]

            for module_id in module_ids:
                progress = ModuleProgress.query.filter_by(
                    student_id=student_id,
                    module_id=module_id,
                    enrollment_id=enrollment.id,
                ).first()
                if not progress:
                    progress = ProgressionService._initialize_module_progress(
                        student_id, module_id, enrollment.id
                    )

                previous = progress.project_score or 0.0
                new_score = max(previous, percentage)
                if new_score != previous or previous == 0.0:
                    progress.project_score = new_score
                    progress.calculate_cumulative_score()
                    updated += 1
                    print(
                        f"  student {student_id} module {module_id} "
                        f"project {project.id}: {previous:.1f}% -> {new_score:.1f}% "
                        f"(cumulative {progress.cumulative_score:.1f}%)"
                    )

        app_module.db.session.commit()
        print(f"Done — updated {updated} module_progress row(s)")


if __name__ == '__main__':
    run()
