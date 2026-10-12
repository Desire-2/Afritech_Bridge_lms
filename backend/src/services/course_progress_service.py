"""Canonical course progress, scoring, and certificate eligibility.

One authoritative computation consumed by every route and service that
reports a course score or decides certificate eligibility:

- CertificateService.evaluate_eligibility / generate_certificate
- GET /student/progress/course/<id>/completion-state
- GET /student/courses/<id>/detailed-progress
- Transcript generation and dashboard displays

Domain distinctions (never conflate these):
- Learning-content completion: every published module ``completed`` AND
  every published lesson has ``completed=True`` (EnrollmentProgressService
  counts). This sets enrollment status via sync_enrollment ONLY.
- Assessment passing: per-lesson 80% / module weighted 70% gates.
- Certificate eligibility: content complete AND overall weighted course
  score >= 70 AND every required module final assessment passed (>= 70).
  A course can be complete without being certificate-eligible (score gap).

Overall course score formula (single definition):
    overall = mean(weighted_cumulative_score(module) for EVERY published
    module), unattempted modules contributing 0.0. The weighted cumulative
    score is ModuleProgress.calculate_cumulative_score() — the same value
    module completion and unlocking use.
"""

from typing import Dict, List, Optional

from flask import current_app

from ..config.scoring import (
    CERTIFICATE_PASSING_SCORE,
    FINAL_ASSESSMENT_PASSING_SCORE,
    LESSON_PASSING_SCORE,
    MODULE_PASSING_SCORE,
    scoring_thresholds_payload,
)
from ..models.course_models import Course, Enrollment
from ..models.student_models import ModuleProgress


class CourseProgressService:
    """Single source of truth for course score + certificate eligibility."""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    @staticmethod
    def evaluate(student_id: int, course_id: int,
                 enrollment: Optional[Enrollment] = None,
                 course: Optional[Course] = None,
                 activate_prefetch: bool = True) -> Dict:
        """Evaluate progress, score, and certificate eligibility.

        Returns a flat dict (see _empty_result for the full shape). Safe to
        call from GET endpoints: never commits; ModuleProgress score fields
        may be healed in-session (same values the progression system would
        compute) but no enrollment state is written.
        """
        if enrollment is None:
            enrollment = Enrollment.get_canonical(student_id, course_id)

        if not enrollment or not course:
            if course is None and enrollment is not None:
                course = Course.query.get(enrollment.course_id) if course_id is None else Course.query.get(course_id)
            if course is None:
                course = Course.query.get(course_id) if course_id else None

        if not enrollment:
            return CourseProgressService._empty_result(
                error_code='NOT_ENROLLED',
                reason='Not enrolled in course',
                missing=['enrollment'],
            )
        if not course:
            return CourseProgressService._empty_result(
                error_code='COURSE_NOT_FOUND',
                reason='Course not found',
                missing=['course'],
            )

        from .enrollment_progress_service import EnrollmentProgressService

        published_modules = EnrollmentProgressService.get_published_modules(course)
        counts = EnrollmentProgressService.get_progress_counts(
            student_id, course_id, enrollment
        )

        if activate_prefetch:
            from . import scoring_prefetch
            scoring_prefetch.activate(student_id, [course_id])

        try:
            # ── module scores: authoritative weighted cumulative, all
            #    published modules in the denominator ──────────────────
            progress_by_module: Dict[int, ModuleProgress] = {}
            if published_modules:
                rows = (
                    ModuleProgress.query
                    .filter(
                        ModuleProgress.student_id == student_id,
                        ModuleProgress.module_id.in_([m.id for m in published_modules]),
                        ModuleProgress.enrollment_id == enrollment.id,
                    )
                    .all()
                )
                progress_by_module = {row.module_id: row for row in rows}

            module_breakdown: List[Dict] = []
            scores: List[float] = []
            completed_count = 0
            failed_count = 0
            pending_gradings: List[Dict] = []
            final_assessments: List[Dict] = []

            for module in published_modules:
                module_progress = progress_by_module.get(module.id)
                if module_progress:
                    # Heal stored assessment fields from graded attempts
                    # (only raises scores; matches write-path semantics).
                    try:
                        module_progress.sync_scores_from_assessments()
                    except Exception:  # healing must never block evaluation
                        current_app.logger.warning(
                            f"Score healing failed for module {module.id}",
                            exc_info=True,
                        )
                    score = float(module_progress.calculate_cumulative_score() or 0.0)
                    status = module_progress.status or 'locked'
                    attempts = module_progress.attempts_count
                    if module_progress.has_pending_assignment_grading():
                        pending_gradings.append({
                            'module_id': module.id,
                            'module_name': module.title,
                            'component': 'assignment',
                            'message': (
                                'An assignment in this module is waiting for '
                                'instructor grading. The score shown may rise '
                                'once it is graded.'
                            ),
                        })
                else:
                    score = 0.0
                    status = 'not_started'
                    attempts = 0

                scores.append(score)
                if status == 'completed':
                    completed_count += 1
                elif status == 'failed':
                    failed_count += 1

                module_breakdown.append({
                    'module_id': module.id,
                    'module_name': module.title,
                    'status': status,
                    'score': round(score, 1),
                    'raw_score': score,
                    'attempts': attempts,
                    'is_passing': score >= MODULE_PASSING_SCORE,
                    'has_progress': module.id in progress_by_module,
                })

                # ── Rule C data: module final assessment (module-level
                #    published quiz with lesson_id NULL) ────────────────
                final = CourseProgressService._module_final_status(
                    student_id, module.id, module_progress
                )
                if final is not None:
                    final['module_name'] = module.title
                    final_assessments.append(final)

            total_modules = len(published_modules)
            # Authoritative overall score: Enrollment.calculate_course_score
            # (mean of every published module's weighted cumulative score;
            # unattempted = 0). Prefetch is active here, so the model method
            # reuses the batched lookups.
            overall_score = float(enrollment.calculate_course_score() or 0.0)

            all_modules_completed = (
                total_modules > 0 and completed_count == total_modules
            )
            all_lessons_completed = (
                counts.get('total_lessons', 0) == 0
                if total_modules == 0
                else counts.get('completed_lessons', 0) == counts.get('total_lessons', 0)
            )
            content_complete = bool(counts.get('is_complete')) and all_modules_completed

            # ── Rule C evaluation ─────────────────────────────────────
            final_required = len(final_assessments) > 0
            if final_required:
                attempted = [f for f in final_assessments if f['attempted']]
                all_passed = all(f['passed'] for f in final_assessments)
                final_passed = all_passed and len(attempted) == len(final_assessments)
                final_score = (
                    min(f['best_score'] for f in final_assessments)
                    if attempted else None
                )
            else:
                final_passed = True  # N/A satisfies the requirement
                final_score = None

            score_ok = overall_score >= CERTIFICATE_PASSING_SCORE

            # ── Rules A + B + C ───────────────────────────────────────
            missing: List[str] = []
            if not all_modules_completed:
                missing.append('all_modules_completed')
            if not all_lessons_completed:
                missing.append('all_lessons_completed')
            if not score_ok:
                missing.append('overall_score')
            if final_required and not final_passed:
                missing.append('final_assessment')

            eligible = not missing

            return {
                'eligible': eligible,
                'error_code': None if eligible else CourseProgressService._primary_error_code(missing),
                'reason': (
                    'Eligible for certificate' if eligible
                    else CourseProgressService._summary_for(
                        missing, overall_score, completed_count, total_modules, final_required, final_score
                    )
                ),
                'summary': (
                    'Eligible for certificate' if eligible
                    else CourseProgressService._summary_for(
                        missing, overall_score, completed_count, total_modules, final_required, final_score
                    )
                ),
                'next_steps': [] if eligible else CourseProgressService._next_steps_for(
                    missing, module_breakdown, overall_score, final_required, final_assessments
                ),
                # Score (unrounded internally; rounded for display)
                'overall_score': round(overall_score, 1),
                'current_score': round(overall_score, 1),
                'required_score': CERTIFICATE_PASSING_SCORE,
                'passing_score': CERTIFICATE_PASSING_SCORE,
                'certificate_passing_threshold': CERTIFICATE_PASSING_SCORE,
                'thresholds': scoring_thresholds_payload(),
                # Completion (learning-content, NOT certificate score)
                'course_completed': content_complete,
                'all_modules_completed': all_modules_completed,
                'all_lessons_completed': all_lessons_completed,
                'content_complete': content_complete,
                'completed_modules': completed_count,
                'total_modules': total_modules,
                'failed_modules': failed_count,
                'locked_modules': max(0, total_modules - completed_count),
                'completed_lessons': counts.get('completed_lessons', 0),
                'total_lessons': counts.get('total_lessons', 0),
                'progress': counts.get('progress', 0.0),
                # Final assessment (Rule C)
                'final_assessment_required': final_required,
                'final_assessment_passed': final_passed,
                'final_assessment_score': (
                    round(final_score, 1) if final_score is not None else None
                ),
                'final_assessment_breakdown': final_assessments,
                # Breakdowns
                'module_breakdown': module_breakdown,
                'pending_gradings': pending_gradings,
                'missing_requirements': missing,
                'failure_reasons': list(missing),
                'incomplete_modules': [
                    {
                        'id': m['module_id'],
                        'title': m['module_name'],
                        'status': m['status'],
                        'score': m['score'],
                    }
                    for m in module_breakdown if m['status'] != 'completed'
                ],
                # Internal (routes must strip)
                'enrollment': enrollment,
            }
        finally:
            if activate_prefetch:
                from . import scoring_prefetch
                scoring_prefetch.deactivate()

    @staticmethod
    def overall_course_score(student_id: int, enrollment: Enrollment) -> float:
        """Thin accessor for the single overall-score formula."""
        return float(enrollment.calculate_course_score() or 0.0)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    @staticmethod
    def _module_final_status(student_id: int, module_id: int,
                             module_progress: Optional[ModuleProgress]) -> Optional[Dict]:
        """Rule C status for one module's final assessment, or None if the
        module has no published module-level final assessment."""
        from . import scoring_prefetch

        quiz = scoring_prefetch.get_module_final_quiz(module_id)
        if quiz is None:
            return None

        required_score = max(
            float(quiz.passing_score or 0.0),
            FINAL_ASSESSMENT_PASSING_SCORE,
        )

        best_score = 0.0
        attempted = False
        if module_progress and (module_progress.final_assessment_score or 0.0) > 0:
            best_score = float(module_progress.final_assessment_score or 0.0)
            attempted = True
        else:
            from ..models.quiz_progress_models import QuizAttempt
            best_attempt = (
                QuizAttempt.query
                .filter(
                    QuizAttempt.user_id == student_id,
                    QuizAttempt.quiz_id == quiz.id,
                    QuizAttempt.score_percentage.isnot(None),
                )
                .order_by(QuizAttempt.score_percentage.desc())
                .first()
            )
            if best_attempt is not None:
                best_score = min(100.0, float(best_attempt.score_percentage or 0.0))
                attempted = True

        return {
            'quiz_id': quiz.id,
            'title': quiz.title,
            'required': True,
            'required_score': required_score,
            'best_score': best_score,
            'attempted': attempted,
            'passed': attempted and best_score >= required_score,
        }

    @staticmethod
    def _primary_error_code(missing: List[str]) -> str:
        if 'enrollment' in missing:
            return 'NOT_ENROLLED'
        if 'course' in missing:
            return 'COURSE_NOT_FOUND'
        content_missing = {'all_modules_completed', 'all_lessons_completed'} & set(missing)
        if content_missing and 'overall_score' in missing:
            return 'REQUIREMENTS_NOT_MET'
        if content_missing:
            return 'INCOMPLETE_MODULES'
        if 'final_assessment' in missing and 'overall_score' not in missing:
            return 'FINAL_ASSESSMENT_FAILED'
        if 'overall_score' in missing and 'final_assessment' in missing:
            return 'REQUIREMENTS_NOT_MET'
        return 'INSUFFICIENT_SCORE'

    @staticmethod
    def _summary_for(missing, overall_score, completed_modules, total_modules,
                     final_required, final_score) -> str:
        parts = []
        if 'all_modules_completed' in missing or 'all_lessons_completed' in missing:
            parts.append(
                f"Complete all published content ({completed_modules}/{total_modules} modules done)"
            )
        if 'overall_score' in missing:
            gap = CERTIFICATE_PASSING_SCORE - overall_score
            parts.append(
                f"Improve your overall course score by {gap:.1f}% "
                f"(currently {overall_score:.1f}%, requires {CERTIFICATE_PASSING_SCORE:.0f}%)"
            )
        if 'final_assessment' in missing:
            if final_score is None:
                parts.append("Attempt and pass the required final assessment (70%)")
            else:
                parts.append(
                    f"Pass the required final assessment (currently {final_score:.1f}%, requires 70%)"
                )
        return ' and '.join(parts) if parts else 'Requirements not met'

    @staticmethod
    def _next_steps_for(missing, module_breakdown, overall_score,
                        final_required, final_assessments) -> List[str]:
        steps = []
        if {'all_modules_completed', 'all_lessons_completed'} & set(missing):
            not_done = [m for m in module_breakdown if m['status'] != 'completed']
            if not_done:
                names = ', '.join(m['module_name'] for m in not_done[:3])
                suffix = '…' if len(not_done) > 3 else ''
                steps.append(f"Finish module(s): {names}{suffix}")
            else:
                steps.append('Complete every published lesson and assessment in the course')
        if 'overall_score' in missing:
            steps.append(
                f"Raise your overall score to {CERTIFICATE_PASSING_SCORE:.0f}% "
                f"(currently {overall_score:.1f}%) by improving low-scoring modules"
            )
        if 'final_assessment' in missing:
            failed = [f for f in final_assessments if not f['passed']]
            if failed:
                names = ', '.join(f['module_name'] for f in failed[:3])
                steps.append(
                    f"Review the final assessment feedback for: {names} and retry when permitted"
                )
        return steps or ['Review the course requirements and continue learning']

    @staticmethod
    def _empty_result(error_code=None, reason='', missing=None) -> Dict:
        missing = missing or []
        return {
            'eligible': False,
            'error_code': error_code,
            'reason': reason,
            'summary': reason,
            'next_steps': [],
            'overall_score': 0.0,
            'current_score': 0.0,
            'required_score': CERTIFICATE_PASSING_SCORE,
            'passing_score': CERTIFICATE_PASSING_SCORE,
            'certificate_passing_threshold': CERTIFICATE_PASSING_SCORE,
            'thresholds': scoring_thresholds_payload(),
            'course_completed': False,
            'all_modules_completed': False,
            'all_lessons_completed': False,
            'content_complete': False,
            'completed_modules': 0,
            'total_modules': 0,
            'failed_modules': 0,
            'locked_modules': 0,
            'completed_lessons': 0,
            'total_lessons': 0,
            'progress': 0.0,
            'final_assessment_required': False,
            'final_assessment_passed': True,
            'final_assessment_score': None,
            'final_assessment_breakdown': [],
            'module_breakdown': [],
            'pending_gradings': [],
            'missing_requirements': missing,
            'failure_reasons': list(missing),
            'incomplete_modules': [],
            'enrollment': None,
        }
