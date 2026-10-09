from ..utils.time_utils import now_local
# Enrollment Progress Service - single source of truth for course progress.
#
# Progress and completion must ALWAYS be measured against the full published
# course, never against the subset of modules that happen to be released so
# far. Module release settings only control *when* a learner may start a
# module; they must not shrink the denominator used for progress, otherwise a
# learner who finishes the currently released modules is reported as 100%
# complete while most of the course is still locked.

from typing import Dict, List, Optional

from flask import current_app

from ..models.user_models import db
from ..models.course_models import Course, Module, Lesson, Enrollment
from ..models.student_models import ModuleProgress, LessonCompletion, UserProgress


class EnrollmentProgressService:
    """Compute and persist authoritative progress for an enrollment."""

    # ------------------------------------------------------------------
    # Counting helpers
    # ------------------------------------------------------------------
    @staticmethod
    def get_published_modules(course: Course) -> List[Module]:
        """All modules a learner is ultimately expected to complete."""
        if not course:
            return []
        return course.modules.filter_by(is_published=True).order_by(Module.order).all()

    @staticmethod
    def get_progress_counts(
        student_id: int,
        course_id: int,
        enrollment: Optional[Enrollment] = None,
    ) -> Dict:
        """
        Count published-course progress for a student.

        Returns a dict with:
            total_modules / completed_modules
            total_lessons  / completed_lessons   (lessons inside published modules)
            progress       (0.0 - 1.0)
            is_complete    (every published module completed)
            released_modules (modules currently visible under release settings)
        """
        empty = {
            "total_modules": 0,
            "completed_modules": 0,
            "total_lessons": 0,
            "completed_lessons": 0,
            "progress": 0.0,
            "is_complete": False,
            "released_modules": 0,
        }

        try:
            course = Course.query.get(course_id)
            if not course:
                return empty

            published_modules = EnrollmentProgressService.get_published_modules(course)
            module_ids = [m.id for m in published_modules]

            if not module_ids:
                return empty

            completed_module_ids = {
                row[0]
                for row in db.session.query(ModuleProgress.module_id)
                .filter(
                    ModuleProgress.student_id == student_id,
                    ModuleProgress.module_id.in_(module_ids),
                    ModuleProgress.status == "completed",
                )
                .distinct()
                .all()
            }

            lesson_ids = [
                lid
                for (lid,) in db.session.query(Lesson.id)
                .filter(Lesson.module_id.in_(module_ids))
                .all()
            ]

            completed_lesson_count = 0
            if lesson_ids:
                completed_lesson_count = (
                    db.session.query(LessonCompletion.lesson_id)
                    .filter(
                        LessonCompletion.student_id == student_id,
                        LessonCompletion.lesson_id.in_(lesson_ids),
                        LessonCompletion.completed == True,  # noqa: E712
                    )
                    .distinct()
                    .count()
                )

            total_modules = len(published_modules)
            completed_modules = len(completed_module_ids)
            total_lessons = len(lesson_ids)

            if total_lessons > 0:
                progress = completed_lesson_count / total_lessons
            elif total_modules > 0:
                progress = completed_modules / total_modules
            else:
                progress = 0.0

            cohort_id = None
            if enrollment is not None:
                cohort_id = enrollment.application_window_id
            released = course.get_released_modules(cohort_id=cohort_id)

            # A course is complete only when EVERY published module is completed
            # and every lesson inside them is done. Requiring both keeps
            # status and progress consistent (completed <=> 100%) and forces
            # learners to finish lessons added to already-completed modules.
            modules_done = total_modules > 0 and completed_modules == total_modules
            if total_lessons > 0:
                is_complete = modules_done and completed_lesson_count == total_lessons
            else:
                is_complete = modules_done

            return {
                "total_modules": total_modules,
                "completed_modules": completed_modules,
                "total_lessons": total_lessons,
                "completed_lessons": completed_lesson_count,
                "progress": max(0.0, min(1.0, progress)),
                "is_complete": is_complete,
                "released_modules": len(released),
            }
        except Exception as e:
            current_app.logger.error(f"Progress count error: {str(e)}")
            return empty

    # ------------------------------------------------------------------
    # Synchronisation
    # ------------------------------------------------------------------
    @staticmethod
    def sync_enrollment(enrollment: Optional[Enrollment], commit: bool = False) -> Dict:
        """
        Recompute and store enrollment.progress / status / completion date.

        Content changes (new modules, published assessments, changed release
        settings) can move progress in either direction, so completion is
        re-evaluated instead of being latched on forever.
        """
        if enrollment is None:
            return {}

        try:
            counts = EnrollmentProgressService.get_progress_counts(
                enrollment.student_id, enrollment.course_id, enrollment
            )

            enrollment.progress = counts["progress"]

            if counts["is_complete"]:
                if not enrollment.completed_at:
                    enrollment.completed_at = now_local()
                if enrollment.status != "completed":
                    enrollment.status = "completed"
            else:
                # Course is no longer fully complete (content grew, an
                # assessment was published, ...) - reopen so downstream
                # consumers stop reporting 100%.
                if enrollment.status == "completed":
                    enrollment.status = "active"
                enrollment.completed_at = None

            # Keep the dashboard percentage in step with the same numbers.
            user_progress = UserProgress.query.filter_by(
                user_id=enrollment.student_id, course_id=enrollment.course_id
            ).first()
            if user_progress:
                user_progress.completion_percentage = counts["progress"] * 100

            if commit:
                db.session.commit()

            return counts
        except Exception as e:
            if commit:
                db.session.rollback()
            current_app.logger.error(f"Enrollment progress sync error: {str(e)}")
            return {}

    @staticmethod
    def sync_course(course_id: int, commit: bool = True) -> int:
        """Recompute progress for every enrollment of a course."""
        try:
            enrollments = Enrollment.query.filter_by(course_id=course_id).all()
            for enrollment in enrollments:
                EnrollmentProgressService.sync_enrollment(enrollment, commit=False)
            if commit:
                db.session.commit()
            return len(enrollments)
        except Exception as e:
            if commit:
                db.session.rollback()
            current_app.logger.error(f"Course progress sync error: {str(e)}")
            return 0

    @staticmethod
    def sync_student_course(student_id: int, course_id: int, commit: bool = True) -> Dict:
        enrollment = Enrollment.query.filter_by(
            student_id=student_id, course_id=course_id
        ).first()
        if not enrollment:
            return {}
        return EnrollmentProgressService.sync_enrollment(enrollment, commit=commit)

    # ------------------------------------------------------------------
    # Release helpers
    # ------------------------------------------------------------------
    @staticmethod
    def is_module_released(module: Module, enrollment: Optional[Enrollment]) -> bool:
        """True when the learner's cohort is allowed to access this module."""
        if module is None:
            return False
        if enrollment is None:
            # Instructor/admin preview: treat everything as released.
            return True
        course = module.course
        if not course:
            return False
        released = course.get_released_modules(cohort_id=enrollment.application_window_id)
        return any(m.id == module.id for m in released)
