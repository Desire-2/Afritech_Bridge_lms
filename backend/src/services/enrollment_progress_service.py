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
    def get_module_progress_map(
        student_id: int,
        module_ids: List[int],
        enrollment: Optional[Enrollment] = None,
    ) -> Dict[int, ModuleProgress]:
        """Resolve ONE canonical ModuleProgress row per module for a student.

        Every consumer of module state (content counts, certificate
        eligibility, overall course score, dashboard summaries) must read
        rows through this method, otherwise a learner with rows attached to
        an older/duplicate enrollment is reported complete by one surface and
        incomplete — with a 0.0 score — by another.

        Selection policy (deterministic, single query):
        1. the row belonging to ``enrollment`` when present (the canonical
           enrollment ``Enrollment.get_canonical`` already prefers),
        2. otherwise any row for that module, preferring ``status ==
           'completed'`` so legacy rows left behind by re-enrolment are never
           silently dropped,
        3. otherwise the newest row.
        """
        if not module_ids:
            return {}

        rows = (
            ModuleProgress.query
            .filter(
                ModuleProgress.student_id == student_id,
                ModuleProgress.module_id.in_(module_ids),
            )
            .order_by(ModuleProgress.id)
            .all()
        )
        preferred_id = enrollment.id if enrollment is not None else None

        chosen: Dict[int, ModuleProgress] = {}
        for row in rows:
            current = chosen.get(row.module_id)
            if current is None:
                chosen[row.module_id] = row
                continue

            if preferred_id is not None:
                cur_preferred = current.enrollment_id == preferred_id
                row_preferred = row.enrollment_id == preferred_id
                if row_preferred != cur_preferred:
                    if row_preferred:
                        chosen[row.module_id] = row
                    continue
                if row_preferred and cur_preferred:
                    # Both belong to the canonical enrollment (defensive:
                    # unique constraint should prevent this) — keep newest.
                    if row.id > current.id:
                        chosen[row.module_id] = row
                    continue

            # Same enrollment (or no enrollment given): completed beats any
            # other status, then the newest row wins.
            cur_completed = current.status == "completed"
            row_completed = row.status == "completed"
            if row_completed != cur_completed:
                if row_completed:
                    chosen[row.module_id] = row
            elif row.id > current.id:
                chosen[row.module_id] = row

        return chosen

    @staticmethod
    def live_completion(enrollment: Optional[Enrollment]) -> Dict:
        """Authoritative completion snapshot for read surfaces.

        Returns ``{"is_complete": bool, "progress": float 0.0-1.0}`` computed
        from published content — never from the cached ``enrollment.progress``
        / ``completed_at`` alone, which lag when content changes without a
        resync and made dashboards say "Course Completed!" while certificate
        surfaces (recomputed live) said otherwise.

        Falls back to the cached flags only when counts cannot be computed
        (e.g. a legacy course with no published modules), so such rows keep
        their previously reported state.
        """
        if enrollment is None:
            return {"is_complete": False, "progress": 0.0}

        counts = EnrollmentProgressService.get_progress_counts(
            enrollment.student_id, enrollment.course_id, enrollment
        )
        if counts.get("total_modules", 0) > 0:
            return {
                "is_complete": bool(counts["is_complete"]),
                "progress": float(counts["progress"] or 0.0),
            }

        cached_complete = bool(enrollment.completed_at) or enrollment.status == "completed"
        return {
            "is_complete": cached_complete,
            "progress": 1.0 if cached_complete else float(enrollment.progress or 0.0),
        }

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

            # Same canonical row resolution as certificate eligibility and
            # the overall course score — completion must never be computed
            # from a different row set than the surfaces that report it.
            progress_map = EnrollmentProgressService.get_module_progress_map(
                student_id, module_ids, enrollment
            )
            completed_module_ids = {
                module_id
                for module_id, row in progress_map.items()
                if row.status == "completed"
            }

            lesson_ids = [
                lid
                for (lid,) in db.session.query(Lesson.id)
                .filter(
                    Lesson.module_id.in_(module_ids),
                    # Published lessons only — drafts must not dilute progress
                    Lesson.is_published == True,  # noqa: E712
                )
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
        enrollment = Enrollment.get_canonical(student_id, course_id)
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

    # ------------------------------------------------------------------
    # Unenrollment cleanup (single source of truth — admin delete routes
    # must call this instead of ad-hoc partial cleanup)
    # ------------------------------------------------------------------
    @staticmethod
    def cleanup_enrollment_progress(
        student_id: int, course_id: int, enrollment_id: int
    ) -> Dict[str, int]:
        """Delete every progress artifact tied to one enrollment.

        Removes ModuleProgress, course LessonCompletion, QuizAttempt (lesson
        and module-level), AssignmentSubmission, and ProjectSubmission rows so
        a later re-enrollment starts from a clean state. Flushes but does NOT
        commit — the caller owns the transaction boundary.
        """
        from sqlalchemy import or_
        from ..models.course_models import (
            Quiz, Assignment, AssignmentSubmission, Project, ProjectSubmission
        )
        from ..models.quiz_progress_models import QuizAttempt

        module_ids = [
            mid for (mid,) in db.session.query(Module.id).filter(
                Module.course_id == course_id
            ).all()
        ]
        lesson_ids = [
            lid for (lid,) in db.session.query(Lesson.id).filter(
                Lesson.module_id.in_(module_ids) if module_ids else False
            ).all()
        ]

        deleted = {
            "module_progress": ModuleProgress.query.filter_by(
                student_id=student_id, enrollment_id=enrollment_id
            ).delete(synchronize_session='fetch'),
            "lesson_completions": 0,
            "quiz_attempts": 0,
            "assignment_submissions": 0,
            "project_submissions": 0,
        }

        if lesson_ids or module_ids:
            if lesson_ids:
                deleted["lesson_completions"] = LessonCompletion.query.filter(
                    LessonCompletion.student_id == student_id,
                    LessonCompletion.lesson_id.in_(lesson_ids)
                ).delete(synchronize_session='fetch')

            quiz_conditions = []
            if lesson_ids:
                quiz_conditions.append(Quiz.lesson_id.in_(lesson_ids))
            if module_ids:
                quiz_conditions.append(Quiz.module_id.in_(module_ids))
            quiz_ids = [
                qid for (qid,) in db.session.query(Quiz.id).filter(
                    or_(*quiz_conditions)
                ).all()
            ]
            if quiz_ids:
                deleted["quiz_attempts"] = QuizAttempt.query.filter(
                    QuizAttempt.user_id == student_id,
                    QuizAttempt.quiz_id.in_(quiz_ids)
                ).delete(synchronize_session='fetch')

            assignment_conditions = []
            if lesson_ids:
                assignment_conditions.append(Assignment.lesson_id.in_(lesson_ids))
            if module_ids:
                assignment_conditions.append(Assignment.module_id.in_(module_ids))
            assignment_conditions.append(Assignment.course_id == course_id)
            assignment_ids = [
                aid for (aid,) in db.session.query(Assignment.id).filter(
                    or_(*assignment_conditions)
                ).all()
            ]
            if assignment_ids:
                deleted["assignment_submissions"] = AssignmentSubmission.query.filter(
                    AssignmentSubmission.student_id == student_id,
                    AssignmentSubmission.assignment_id.in_(assignment_ids)
                ).delete(synchronize_session='fetch')

        project_ids = [
            pid for (pid,) in db.session.query(Project.id).filter(
                Project.course_id == course_id
            ).all()
        ]
        if project_ids:
            deleted["project_submissions"] = ProjectSubmission.query.filter(
                ProjectSubmission.student_id == student_id,
                ProjectSubmission.project_id.in_(project_ids)
            ).delete(synchronize_session='fetch')

        db.session.flush()
        return deleted
