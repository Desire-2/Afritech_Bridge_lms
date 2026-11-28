from ...utils.time_utils import now_local
"""
Auto-Grading Trigger

Automatically grades Excel submissions when students submit assignments
or projects that contain Excel files in Excel courses.

Runs grading in a background thread to avoid blocking the HTTP response.
Includes retry logic, status tracking, and notification on completion.
"""

import logging
import threading
import time
from typing import Optional, Dict, Any, List

from .excel_file_detection import (
    course_is_excel,
    has_excel_files as _has_detected_excel_files,
)
from ..grading_feedback import (
    build_revision_reason, build_student_feedback,
    request_assignment_modification,
)

logger = logging.getLogger(__name__)

# Auto-grading configuration
MAX_RETRIES = 2
RETRY_DELAY_SECONDS = 5
AUTO_GRADE_TIMEOUT = 120  # seconds


def _has_excel_files(files_data: Any) -> bool:
    """Compatibility wrapper used by the AAGE dispatcher and tests."""
    return _has_detected_excel_files(files_data)


def _is_excel_course(course) -> bool:
    """Compatibility wrapper used by the AAGE dispatcher and tests."""
    return course_is_excel(course)


def _run_grading_in_background(
    app,
    submission_id: int,
    submission_type: str,
    student_id: int,
    attempt: int = 1,
    force: bool = False,
):
    """
    Run grading inside a Flask app context in a background thread.
    Uses a loop for retry logic to avoid recursive nested app contexts.
    """
    max_attempts = MAX_RETRIES + 1
    current_attempt = attempt

    while current_attempt <= max_attempts:
        with app.app_context():
            try:
                from . import ExcelGradingService

                logger.info(
                    f"🤖 Auto-grading started: {submission_type} #{submission_id} "
                    f"(attempt {current_attempt}/{max_attempts})"
                )

                service = ExcelGradingService()
                result = service.grade_submission(
                    submission_id,
                    submission_type,
                    force=(force or current_attempt > 1),
                )

                status = str(result.get('status') or 'unknown')

                if status == 'completed':
                    grade_data = result.get('result') or {}
                    total_score = grade_data.get('total_score', 0)
                    max_score = grade_data.get('max_score', 100)

                    logger.info(
                        "🤖 Auto-grading result: %s #%s → %s/%s (%s)",
                        submission_type, submission_id, total_score, max_score,
                        grade_data.get('grade_letter', '?'),
                    )

                    # One finalisation path is shared by the auto-grader, the
                    # full Excel endpoint and the unified dispatcher.  Creating
                    # an ExcelGradingResult alone has never been enough to make
                    # the grade visible to the student.
                    outcome = finalize_excel_grade(
                        app, submission_id, submission_type, student_id, result,
                    )
                    publication_status = outcome.get('status')
                    if str(publication_status).startswith('published'):
                        logger.info(
                            "✅ Auto-grade %s for %s #%s%s",
                            publication_status, submission_type, submission_id,
                            (
                                f" (warnings: {', '.join(outcome.get('warnings', []))})"
                                if outcome.get('warnings') else ""
                            ),
                        )
                    elif publication_status == 'pending_review':
                        logger.info(
                            "⏸️ Auto-grade pending instructor review: %s #%s",
                            submission_type, submission_id,
                        )
                    else:
                        logger.info(
                            "Auto grade not applied for %s #%s: %s",
                            submission_type, submission_id,
                            outcome.get('reason') or publication_status,
                        )
                    return

                if status in ('already_graded', 'pending_review'):
                    logger.info(
                        "ℹ️ Auto-grading skipped: %s #%s (%s)",
                        submission_type, submission_id, status,
                    )
                    return

                if status in ('failed', 'skipped'):
                    reason = result.get('reason', result.get('message', 'unknown'))
                    logger.warning(
                        "⚠️ Auto-grading %s: %s #%s — %s",
                        status, submission_type, submission_id, reason,
                    )
                    if (
                        current_attempt < max_attempts
                        and result.get('reason') == 'download_failed'
                    ):
                        logger.info("🔄 Retrying auto-grade in %ss…", RETRY_DELAY_SECONDS)
                        current_attempt += 1
                        # Sleep outside app context to release DB connections
                        break  # Break inner with-block, sleep below
                    # The trigger returned True before the thread ran, so the
                    # submission hook suppressed AAGE.  Hand a genuinely failed
                    # Excel job to AAGE now instead of leaving it ungraded.
                    _queue_aage_fallback(
                        submission_id, submission_type, student_id,
                        force=force, reason=reason,
                    )
                    return

                logger.warning(
                    "❓ Auto-grading returned unexpected status '%s' for %s #%s",
                    status, submission_type, submission_id,
                )
                _queue_aage_fallback(
                    submission_id, submission_type, student_id,
                    force=force, reason='unexpected_status',
                )
                return

            except Exception as e:
                logger.exception(
                    "❌ Auto-grading exception for %s #%s: %s",
                    submission_type, submission_id, e,
                )
                if current_attempt < max_attempts:
                    current_attempt += 1
                    break  # Break inner with-block, sleep below
                _queue_aage_fallback(
                    submission_id, submission_type, student_id,
                    force=force, reason='exception',
                )
                return

        # Sleep between retries (outside app context)
        time.sleep(RETRY_DELAY_SECONDS)


def _auto_approve_grading_result(
    app,
    submission_id: int,
    submission_type: str,
    grade_data: Dict[str, Any],
) -> bool:
    """
    Mark the ExcelGradingResult as auto-approved so the grade is treated
    as final rather than a preliminary result waiting for instructor review.
    """
    try:
        from src.models.excel_grading_models import ExcelGradingResult
        from src.models.user_models import db
        from datetime import datetime

        if submission_type == 'assignment':
            result = ExcelGradingResult.query.filter_by(
                assignment_submission_id=submission_id,
                submission_type='assignment',
            ).order_by(ExcelGradingResult.graded_at.desc()).first()
        else:
            result = ExcelGradingResult.query.filter_by(
                project_submission_id=submission_id,
                submission_type='project',
            ).order_by(ExcelGradingResult.graded_at.desc()).first()

        if not result:
            return False

        # AI may only approve a result when every critical path is sufficiently
        # evidenced.  Theory, low confidence, analyzer failures, and critical
        # requirement anomalies remain preliminary until an instructor acts.
        confidence = str(grade_data.get('confidence', 'low')).lower()
        if grade_data.get('manual_review_required') or confidence == 'low' or grade_data.get('critical_failures'):
            result.instructor_reviewed = False
            result.manual_review_required = True
            result.instructor_reviewed_at = None
            result.instructor_notes = 'Preliminary AI assessment — instructor review required'
            result.status = 'completed'

            from ...talent_passport.hooks import notify_talent_passport
            graded_marker = (result.graded_at.isoformat()
                             if result.graded_at else str(result.id))
            notify_talent_passport(
                "excel.graded", result.student_id,
                "excel_grading_result", result.id,
                course_id=result.course_id,
                suffix=f"preliminary:{graded_marker}",
            )
            db.session.commit()
            return False

        result.instructor_reviewed = True
        result.manual_review_required = False
        result.instructor_reviewed_at = now_local()
        result.instructor_notes = 'Auto-approved by AI grading system'
        result.status = 'completed'

        from ...talent_passport.hooks import notify_talent_passport
        reviewed_marker = (result.instructor_reviewed_at.isoformat()
                           if result.instructor_reviewed_at
                           else (result.graded_at.isoformat()
                                 if result.graded_at else str(result.id)))
        notify_talent_passport(
            "excel.reviewed", result.student_id,
            "excel_grading_result", result.id,
            course_id=result.course_id,
            suffix=f"{result.instructor_reviewed}:{reviewed_marker}",
        )

        db.session.commit()

        logger.info(
            f"✅ Auto-approved ExcelGradingResult for "
            f"{submission_type} #{submission_id}"
        )
        return True

    except Exception as e:
        logger.exception(
            f"❌ Failed to auto-approve grading result for "
            f"{submission_type} #{submission_id}: {e}"
        )
        try:
            from src.models.user_models import db
            db.session.rollback()
        except Exception:
            pass
        return False


def _mark_excel_result_preliminary(
    submission_id: int,
    submission_type: str,
    reason: str,
):
    """Keep a result out of student grades when publication did not happen.

    Auto-approval marks the result final before the grade is written. If the
    write is then refused (for example because an older published grade is
    higher), leaving that flag set would expose the lower AI score in the
    student result API even though the authoritative grade was retained.
    """
    try:
        from src.models.excel_grading_models import ExcelGradingResult
        from src.models.user_models import db

        column = (
            ExcelGradingResult.assignment_submission_id
            if submission_type == 'assignment'
            else ExcelGradingResult.project_submission_id
        )
        result = (ExcelGradingResult.query
                  .filter(ExcelGradingResult.submission_type == submission_type,
                          column == submission_id)
                  .order_by(ExcelGradingResult.graded_at.desc())
                  .first())
        if result is None:
            return

        result.instructor_reviewed = False
        result.instructor_reviewed_at = None
        result.manual_review_required = True
        result.status = 'completed'
        result.instructor_notes = (
            f"Not published: {reason}. Instructor review required."
        )
        db.session.commit()
    except Exception:
        logger.exception(
            "Failed to keep Excel result preliminary for %s #%s (%s)",
            submission_type, submission_id, reason,
        )
        try:
            from src.models.user_models import db
            db.session.rollback()
        except Exception:
            pass


def _apply_grade_to_submission(
    app,
    submission_id: int,
    submission_type: str,
    student_id: int,
    total_score: float,
    max_score: float,
    grade_data: Dict[str, Any],
    *,
    allow_lower: bool = False,
    keep_feedback_on_lower: bool = False,
) -> bool:
    """
    Write the AI-generated grade directly onto the AssignmentSubmission or
    ProjectSubmission record, mirroring what the instructor grading endpoint
    does.  This makes the grade visible in the student's dashboard/API
    immediately after auto-grading completes.

    ``allow_lower`` is reserved for deliberate human decisions (an instructor
    approving a reviewed score). Automatic/re-graded AI runs must never replace
    an existing, higher published grade for the same submission — otherwise a
    non-deterministic re-grade silently reduces the student's score.

    ``keep_feedback_on_lower`` lets an AAGE publication record the new AI
    feedback (and therefore the reason a revision was requested) even when the
    higher published grade is retained.  Legacy callers leave it False, so a
    lower re-grade still reports "kept_higher_grade" and skips notifications.

    Returns True on success.
    """
    try:
        from src.models.course_models import (
            Assignment, AssignmentSubmission,
            Project, ProjectSubmission,
        )
        from src.models.user_models import db
        from datetime import datetime

        if submission_type == 'assignment':
            submission = AssignmentSubmission.query.get(submission_id)
        elif submission_type == 'project':
            submission = ProjectSubmission.query.get(submission_id)
        else:
            return False

        if not submission:
            return False

        # Scale the AI score to the assignment's points_possible
        parent = None
        if submission_type == 'assignment':
            parent = Assignment.query.get(submission.assignment_id)
        elif submission_type == 'project':
            parent = Project.query.get(submission.project_id)

        points_possible = (getattr(parent, 'points_possible', None) or 100) if parent else 100

        # Scale: if AI graded out of max_score, map to points_possible
        if max_score > 0:
            scaled_grade = round((total_score / max_score) * points_possible, 2)
        else:
            scaled_grade = 0

        # Clamp
        scaled_grade = max(0, min(points_possible, scaled_grade))

        # An AI re-grade must not silently lower a grade that is already on the
        # submission.  A resubmission clears the grade first, so genuine new
        # work is still free to receive any score.  Manual approval passes
        # allow_lower=True because that is an explicit instructor decision.
        existing_grade = getattr(submission, "grade", None)
        lower_grade_retained = False
        if not allow_lower and existing_grade is not None:
            try:
                if scaled_grade < float(existing_grade) - 0.01:
                    logger.info(
                        "Auto grade kept existing score for %s #%s: new %.2f "
                        "is lower than published %.2f",
                        submission_type, submission_id, scaled_grade,
                        float(existing_grade),
                    )
                    if not keep_feedback_on_lower:
                        return False
                    lower_grade_retained = True
            except (TypeError, ValueError):
                pass

        # The AAGE narrative alone can be a short summary. Append the rubric
        # breakdown so the student sees why each criterion lost marks, exactly
        # as the assignment detail view does.
        feedback = build_student_feedback(grade_data, submission.feedback)
        ai_note = (
            "\n\n---\n"
            "📊 *This grade was automatically generated and approved by AI analysis.*"
        )
        if lower_grade_retained:
            # The student must still see why a revision was requested; only the
            # numeric grade is protected, never the explanatory feedback.
            ai_note = (
                "\n\n---\n"
                "📊 *AI re-grading scored this work lower than the grade already "
                "on record. The higher grade was kept, but the feedback below "
                "explains why a revision is needed.*"
            )
        full_feedback = (feedback + ai_note) if feedback else ai_note.strip()

        if lower_grade_retained:
            submission.feedback = full_feedback
            db.session.commit()
            return True

        submission.grade = scaled_grade
        submission.feedback = full_feedback
        submission.graded_at = now_local()
        submission.graded_by = None  # System/AI — no instructor yet

        db.session.commit()

        logger.info(
            f"📝 Grade written to {submission_type} submission #{submission_id}: "
            f"{scaled_grade}/{points_possible}"
        )
        return True

    except Exception as e:
        logger.exception(
            f"❌ Failed to apply grade to {submission_type} "
            f"#{submission_id}: {e}"
        )
        try:
            from src.models.user_models import db
            db.session.rollback()
        except Exception:
            pass
        return False


def _update_learning_progress(
    app,
    submission_id: int,
    submission_type: str,
    student_id: int,
    total_score: float,
    max_score: float,
    *,
    allow_lower: bool = False,
) -> bool:
    """
    After a passing auto-grade, update module progress and lesson completion
    exactly like the instructor grading endpoint does:

    1. Update ModuleProgress.assignment_score (keep the best score)
    2. Recalculate cumulative module score
    3. Update lesson composite score via LessonCompletionService
    4. Auto-complete the lesson if all requirements are now met

    Returns True on success.
    """
    try:
        from src.models.course_models import (
            Assignment, AssignmentSubmission,
            Project, ProjectSubmission,
            Lesson, Enrollment,
        )
        from src.models.student_models import ModuleProgress, LessonCompletion
        from src.models.user_models import db
        from datetime import datetime

        # Resolve the submission + parent
        if submission_type == 'assignment':
            submission = AssignmentSubmission.query.get(submission_id)
            if not submission:
                return False
            parent = Assignment.query.get(submission.assignment_id)
        elif submission_type == 'project':
            submission = ProjectSubmission.query.get(submission_id)
            if not submission:
                return False
            parent = Project.query.get(submission.project_id)
        else:
            return False

        if not parent:
            return False

        points_possible = getattr(parent, 'points_possible', None) or 100
        if max_score > 0:
            percentage_score = round((total_score / max_score) * 100, 2)
        else:
            percentage_score = 0
        percentage_score = max(0, min(100, percentage_score))

        # Projects have ``module_ids`` (not ``module_id``) and can cover
        # several modules and several students. Use the shared distributor
        # instead of the assignment-only single-module path below.
        if submission_type == 'project':
            from src.services.project_scoring_service import (
                distribute_project_score, team_member_ids,
            )
            distributed = distribute_project_score(
                parent,
                team_member_ids(parent, submission),
                percentage_score,
                allow_lower=allow_lower,
            )
            db.session.commit()
            logger.info(
                f"📊 Project {parent.id} score {percentage_score:.1f}% distributed "
                f"to modules {distributed} for the whole team"
            )
            return True

        # ── 1. Update ModuleProgress ──────────────────────────────
        module_id = getattr(parent, 'module_id', None)
        if not module_id:
            lesson_id = getattr(parent, 'lesson_id', None)
            if lesson_id:
                lesson = Lesson.query.get(lesson_id)
                if lesson:
                    module_id = getattr(lesson, 'module_id', None)

        if module_id:
            course_id = getattr(parent, 'course_id', None)
            if course_id:
                enrollment = Enrollment.query.filter_by(
                    student_id=student_id,
                    course_id=course_id,
                ).first()

                if enrollment:
                    mp = ModuleProgress.query.filter_by(
                        student_id=student_id,
                        module_id=module_id,
                        enrollment_id=enrollment.id,
                    ).first()

                    if not mp:
                        mp = ModuleProgress(
                            student_id=student_id,
                            module_id=module_id,
                            enrollment_id=enrollment.id,
                        )
                        db.session.add(mp)
                        logger.info(
                            f"📦 Created ModuleProgress for student {student_id}, "
                            f"module {module_id}"
                        )

                    current_score = mp.assignment_score or 0.0
                    new_score = max(current_score, percentage_score)
                    mp.assignment_score = new_score

                    if hasattr(mp, 'calculate_cumulative_score'):
                        mp.calculate_cumulative_score()

                    db.session.commit()
                    logger.info(
                        f"📊 Module {module_id} assignment score updated "
                        f"for student {student_id}: {new_score:.1f}%"
                    )
                else:
                    logger.warning(
                        f"⚠️ No enrollment found for student {student_id}, "
                        f"course {course_id} — skipping ModuleProgress update"
                    )

        # ── 2. Update LessonCompletion (assignments only) ─────────
        if submission_type == 'assignment':
            lesson_id = getattr(parent, 'lesson_id', None)
            if lesson_id:
                try:
                    from src.services.lesson_completion_service import LessonCompletionService

                    # Mark assignment as graded on the LessonCompletion record
                    # (mirrors what the instructor grading endpoint does)
                    lc = LessonCompletion.query.filter_by(
                        student_id=student_id,
                        lesson_id=lesson_id,
                    ).first()

                    if lc:
                        lc.assignment_graded = True
                        lc.assignment_grade = percentage_score
                        lc.assignment_graded_at = now_local()
                        lc.assignment_needs_resubmission = False
                        lc.modification_request_reason = None
                        db.session.commit()
                        logger.info(
                            f"📝 LessonCompletion updated — assignment_graded=True, "
                            f"grade={percentage_score:.1f}% for student {student_id}, "
                            f"lesson {lesson_id}"
                        )

                    # Update the composite lesson score
                    score_updated = LessonCompletionService.update_lesson_score_after_assignment_grading(
                        student_id, lesson_id,
                    )
                    if score_updated:
                        logger.info(
                            f"✅ Lesson score updated after auto-grade — "
                            f"Student {student_id}, Lesson {lesson_id}"
                        )

                    # Check whether the lesson can now be auto-completed
                    can_complete, reason, _ = (
                        LessonCompletionService.check_lesson_completion_requirements(
                            student_id, lesson_id,
                        )
                    )

                    # Re-fetch lc in case it was created by the service above
                    if not lc:
                        lc = LessonCompletion.query.filter_by(
                            student_id=student_id,
                            lesson_id=lesson_id,
                        ).first()

                    if can_complete and lc and not lc.completed:
                        success, message, _ = (
                            LessonCompletionService.attempt_lesson_completion(
                                student_id, lesson_id,
                            )
                        )
                        if success:
                            logger.info(
                                f"🎯 Lesson {lesson_id} auto-completed for "
                                f"student {student_id} after auto-grading"
                            )
                    else:
                        logger.debug(
                            f"📋 Lesson {lesson_id} completion status: "
                            f"can_complete={can_complete}, reason={reason}"
                        )

                except Exception as lc_err:
                    logger.warning(
                        f"⚠️ LessonCompletion update failed: {lc_err}"
                    )

        # ── 3. Clear modification flags if passing ────────────────
        passing_score = getattr(parent, 'passing_score', None) or 60.0
        if percentage_score >= passing_score:
            cleared = False
            if submission_type == 'project':
                # Per-submission state: clearing one student's request must not
                # depend on (or touch) the legacy shared-project flags.
                from src.services.project_scoring_service import (
                    clear_project_modification, team_member_ids,
                )
                rows = ProjectSubmission.query.filter(
                    ProjectSubmission.project_id == parent.id,
                    ProjectSubmission.student_id.in_(team_member_ids(parent, submission)),
                ).all()
                cleared = bool(rows)
                clear_project_modification(rows)
            elif getattr(parent, 'modification_requested', False):
                parent.modification_requested = False
                parent.modification_request_reason = None
                parent.modification_requested_at = None
                parent.modification_requested_by = None
                parent.can_resubmit = False
                cleared = True
            if cleared:
                db.session.commit()
                logger.info(
                    f"✅ Cleared modification request — score "
                    f"{percentage_score:.1f}% >= passing {passing_score}%"
                )

        return True

    except Exception as e:
        logger.exception(
            f"❌ Failed to update learning progress for {submission_type} "
            f"#{submission_id}: {e}"
        )
        try:
            from src.models.user_models import db
            db.session.rollback()
        except Exception:
            pass
        return False


def _set_auto_modification_error(details: Optional[Dict[str, Any]], error: str) -> None:
    if details is not None:
        details.update({"status": "failed", "error": error})


def _auto_request_modification_if_needed(
    app,
    submission_id: int,
    submission_type: str,
    student_id: int,
    total_score: float,
    max_score: float,
    grade_data: Dict[str, Any],
    details: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    If the auto-graded score is below the assignment/project passing score,
    automatically request modifications so the student can resubmit.

    Returns True if a modification request was created. ``details`` receives
    ``status`` and ``error`` so publication can distinguish "not needed" from
    a genuine side-effect failure without changing legacy callers.
    """
    if details is not None:
        details.update({"status": "not_applicable", "error": None})
    try:
        from src.models.course_models import (
            Assignment, AssignmentSubmission,
            Project, ProjectSubmission,
        )
        from src.models.student_models import LessonCompletion
        from src.models.user_models import db
        from datetime import datetime

        # Calculate percentage score
        score_pct = (total_score / max_score * 100) if max_score > 0 else 0

        if submission_type == 'assignment':
            submission = AssignmentSubmission.query.get(submission_id)
            if not submission:
                _set_auto_modification_error(details, "submission_not_found")
                return False
            parent = Assignment.query.get(submission.assignment_id)
        elif submission_type == 'project':
            submission = ProjectSubmission.query.get(submission_id)
            if not submission:
                _set_auto_modification_error(details, "submission_not_found")
                return False
            parent = Project.query.get(submission.project_id)
        else:
            _set_auto_modification_error(details, "unsupported_submission_type")
            return False

        if not parent:
            _set_auto_modification_error(details, "parent_not_found")
            return False

        passing_score = getattr(parent, 'passing_score', None) or 60.0

        if score_pct >= passing_score:
            logger.info(
                f"✅ Score {score_pct:.1f}% meets passing threshold "
                f"{passing_score}% — no modification request needed"
            )
            if details is not None:
                details["status"] = "not_needed"
            return False

        # Check resubmission limits — use submission-level count (per-student)
        max_resubs = getattr(parent, 'max_resubmissions', 3) or 3
        current_resubs = getattr(submission, 'resubmission_count', 0) or 0
        if current_resubs >= max_resubs:
            # An existing pending revision is not a new attempt: refreshing
            # its rubric-based reason must stay possible at the limit.
            already_pending = bool(
                getattr(submission, 'modification_requested', False)
                or getattr(submission, 'can_resubmit', False)
            )
            if submission_type == 'assignment':
                lc = LessonCompletion.query.filter_by(
                    student_id=student_id,
                    lesson_id=getattr(parent, 'lesson_id', None),
                ).first()
                already_pending = already_pending or bool(
                    lc and (
                        lc.assignment_needs_resubmission
                        or lc.modification_request_reason
                    )
                )
            if already_pending:
                if details is not None:
                    details["status"] = "already_pending"
                return True
            logger.info(
                f"⚠️ Score {score_pct:.1f}% below passing ({passing_score}%) "
                f"but max resubmissions ({max_resubs}) already reached"
            )
            if details is not None:
                details.update({
                    "status": "limit_reached",
                    "error": "max_resubmissions_reached",
                })
            return False

        # Build the reason from the rubric marks and AAGE criterion feedback.
        # A generic "does not meet the requirements" note is never enough: the
        # student needs the specific criteria that caused the failed grade.
        reason = build_revision_reason(
            total_score=total_score,
            max_score=max_score,
            passing_score=passing_score,
            grade_data=grade_data,
            existing_feedback=submission.feedback,
        )

        # Keep the AI grade on the submission so the instructor can see the
        # score that triggered the modification request, and keep the full AI
        # feedback (plus the threshold explanation) visible to the student.
        detailed_feedback = build_student_feedback(grade_data, submission.feedback)
        threshold_note = (
            f"⚠️ *Score {score_pct:.1f}% is below the passing threshold "
            f"({passing_score:.0f}%). A modification request was created "
            f"automatically. The student has been asked to resubmit.*"
        )
        if threshold_note not in (submission.feedback or ''):
            submission.feedback = (
                f"{detailed_feedback}\n\n---\n{threshold_note}"
                if detailed_feedback else threshold_note
            )
        else:
            submission.feedback = detailed_feedback or submission.feedback

        # Revision state is per student. Setting it on the shared parent would
        # give every student in the course a resubmission pass for one
        # student's failed work.
        if submission_type == 'project':
            from src.services.project_scoring_service import (
                request_project_modification, team_member_ids,
            )
            from src.models.course_models import ProjectSubmission
            rows = ProjectSubmission.query.filter(
                ProjectSubmission.project_id == parent.id,
                ProjectSubmission.student_id.in_(team_member_ids(parent, submission)),
            ).all()
            # A team shares one result: mirror the failing grade and its
            # feedback to every member's row so no teammate gets a revision
            # notice with a blank grade/feedback panel.
            request_project_modification(
                rows, reason, None,
                grade=submission.grade,
                feedback=submission.feedback,
                graded_at=submission.graded_at,
                graded_by=submission.graded_by,
            )
        else:
            # Per-student revision state plus the legacy cohort flags. The
            # helper increments the submission's attempt count only when the
            # revision first becomes pending.
            request_assignment_modification(
                submission, parent, reason, requested_by=None,
            )

        db.session.commit()

        # In-app notification is part of the revision workflow, not a nice-to-
        # have: email can be disabled, but the student still needs the alert.
        try:
            from src.services.notification_service import notify_modification_requested
            if submission_type == 'project':
                notified_ids = sorted({int(row.student_id) for row in rows if row.student_id})
            else:
                notified_ids = [student_id]
            for notified_id in notified_ids:
                notify_modification_requested(
                    notified_id, parent, reason, actor_id=None,
                    course_id=getattr(parent, 'course_id', None),
                    is_project=submission_type == 'project',
                )
        except Exception as notif_err:
            logger.warning(
                f"In-app auto-revision notification failed (non-blocking): {notif_err}"
            )

        if details is not None:
            details["status"] = "created"
        logger.info(
            f"🔄 Auto-modification requested: {submission_type} #{submission_id} — "
            f"score {score_pct:.1f}% < passing {passing_score}%"
        )
        return True

    except Exception as e:
        _set_auto_modification_error(details, str(e))
        logger.exception(
            f"❌ Failed to auto-request modification for {submission_type} "
            f"#{submission_id}: {e}"
        )
        try:
            from src.models.user_models import db
            db.session.rollback()
        except Exception:
            pass
        return False


def _notify_student_auto_graded(
    app,
    submission_id: int,
    submission_type: str,
    student_id: int,
    result: Dict[str, Any],
    modification_requested: bool = False,
) -> bool:
    """
    Send a lightweight notification that AI grading is ready.

    Returns True only when at least one notification was actually sent. This
    lets publication report a notification failure instead of claiming success.
    """
    sent = False
    try:
        from src.models.user_models import User
        from src.models.course_models import Assignment, AssignmentSubmission, Project, ProjectSubmission
        from src.services.project_scoring_service import team_member_ids
        from src.utils.email_notifications import send_grade_notification, send_project_graded_notification

        grade_data = result.get('result', {})
        score = grade_data.get('total_score', 0)
        feedback = grade_data.get('overall_feedback', '')

        if modification_requested:
            ai_note = (
                "\n\n---\n"
                "⚠️ *Your score is below the passing threshold. "
                "A modification request has been created automatically. "
                "Please review the feedback above and resubmit your work.*\n\n"
                "📊 *This grade was automatically generated and approved by AI analysis.*"
            )
        else:
            ai_note = (
                "\n\n---\n"
                "📊 *This grade was automatically generated and approved by AI analysis.*"
            )
        feedback_with_note = (feedback + ai_note) if feedback else ai_note

        if submission_type == 'assignment':
            submission = AssignmentSubmission.query.get(submission_id)
            if not submission:
                return False
            assignment = Assignment.query.get(submission.assignment_id)
            student = User.query.get(student_id)
            if assignment and student and student.email:
                send_grade_notification(
                    submission=submission,
                    assignment=assignment,
                    student=student,
                    grade=score,
                    feedback=feedback_with_note,
                )
                sent = True
                logger.info(f"📧 Auto-grade notification sent to {student.email}")
        elif submission_type == 'project':
            submission = ProjectSubmission.query.get(submission_id)
            if not submission:
                return False
            project = Project.query.get(submission.project_id)
            if not project:
                return False
            # A team result belongs to every teammate, not just the row the
            # grader happened to look at.
            member_ids = team_member_ids(project, submission) or {student_id}
            for member_id in sorted(int(mid) for mid in member_ids):
                member = User.query.get(member_id)
                if not member or not member.email:
                    continue
                send_project_graded_notification(
                    submission=submission,
                    project=project,
                    student=member,
                    grade=score,
                    feedback=feedback_with_note,
                )
                sent = True
                logger.info(f"📧 Auto-grade notification sent to {member.email}")
    except Exception as e:
        logger.warning(f"⚠️ Auto-grade notification failed: {e}")

    return sent


def _resolve_student_id(submission_id: int, submission_type: str) -> Optional[int]:
    """Best-effort lookup used by callers that do not have the submission loaded."""
    try:
        from src.models.course_models import AssignmentSubmission, ProjectSubmission

        if submission_type == 'assignment':
            submission = AssignmentSubmission.query.get(submission_id)
        elif submission_type == 'project':
            submission = ProjectSubmission.query.get(submission_id)
        else:
            return None
        return getattr(submission, 'student_id', None) if submission else None
    except Exception:
        return None


def finalize_excel_grade(
    app,
    submission_id: int,
    submission_type: str,
    student_id: Optional[int],
    result: Dict[str, Any],
    *,
    allow_lower: bool = False,
    notify: bool = True,
) -> Dict[str, Any]:
    """Apply the existing Excel approval/publication pipeline to a saved result.

    ``ExcelGradingService.grade_submission`` only creates an ``ExcelGradingResult``.
    Every caller that should produce a student-visible grade must go through this
    function so auto-grading, manual grading and the unified dispatcher cannot
    drift apart.  It adds no new scoring logic.
    """
    grade_data = (result or {}).get('result') or {}
    total_score = grade_data.get('total_score', 0)
    max_score = grade_data.get('max_score', 100)
    if student_id is None:
        student_id = _resolve_student_id(submission_id, submission_type)

    publication: Dict[str, Any] = {
        "status": "pending_review",
        "approved": False,
        "applied": False,
        "reason": "manual_review_required",
        "modification_requested": False,
        "learning_progress_updated": False,
        "notified": False,
        # Tri-state side effects: callers can tell "not needed" from "failed".
        "modification_state": "not_applicable",
        "learning_progress_state": "not_applicable",
        "errors": [],
        "warnings": [],
    }

    eligible = _auto_approve_grading_result(
        app, submission_id, submission_type, grade_data,
    )
    if not eligible:
        return publication

    publication.update({"approved": True, "reason": None})
    if not student_id:
        publication.update({
            "status": "failed", "reason": "student_not_found",
            "errors": ["student_not_found"],
        })
        return publication

    applied = _apply_grade_to_submission(
        app, submission_id, submission_type, student_id,
        total_score, max_score, grade_data, allow_lower=allow_lower,
    )
    if not applied:
        # Auto-approval already marked the result final. Undo that so the
        # student result endpoints cannot show the lower score that was just
        # refused by the canonical submission grade.
        _mark_excel_result_preliminary(
            submission_id, submission_type, "higher_published_grade_retained",
        )
        publication.update({
            "status": "kept_higher_grade",
            "reason": "higher_published_grade_retained",
            "errors": ["higher_published_grade_retained"],
        })
        return publication

    publication["applied"] = True
    modification_details: Dict[str, Any] = {}
    modification_requested = _auto_request_modification_if_needed(
        app, submission_id, submission_type, student_id,
        total_score, max_score, grade_data, details=modification_details,
    )
    publication["modification_requested"] = bool(modification_requested)
    publication["modification_state"] = (
        modification_details.get("status")
        or ("created" if modification_requested else "not_applicable")
    )
    if publication["modification_state"] == "failed":
        error = modification_details.get("error") or "revision_request_failed"
        publication["errors"].append(f"revision_request_failed:{error}")

    if publication["modification_state"] != "failed" and not modification_requested:
        progress_ok = bool(_update_learning_progress(
            app, submission_id, submission_type, student_id,
            total_score, max_score,
        ))
        publication["learning_progress_updated"] = progress_ok
        publication["learning_progress_state"] = (
            "success" if progress_ok else "failed"
        )
        if not progress_ok:
            publication["warnings"].append("learning_progress_not_updated")

    if notify:
        notified = bool(_notify_student_auto_graded(
            app, submission_id, submission_type, student_id, result,
            modification_requested=modification_requested,
        ))
        publication["notified"] = notified
        if not notified:
            publication["warnings"].append("notification_not_sent")

    publication["status"] = (
        "published" if not publication["errors"] and not publication["warnings"]
        else "published_with_warnings"
    )
    return publication


def _queue_aage_fallback(
    submission_id: int,
    submission_type: str,
    student_id: Optional[int],
    *,
    force: bool = False,
    reason: Optional[str] = None,
):
    """Hand a failed Excel auto-grade to AAGE without running both at once.

    The submission hook suppresses AAGE as soon as the Excel thread starts.
    This callback restores the fallback only when Excel definitively fails, so
    a student never ends up with no grading engine at all.
    """
    try:
        from ..aage.submission_dispatch import enqueue_for_submission

        job = enqueue_for_submission(
            submission_type=submission_type,
            submission_id=submission_id,
            student_id=student_id,
            excel_grading_triggered=False,
            force=force,
            requested_by=student_id,
        )
        if job is not None:
            logger.info(
                "AAGE fallback queued for %s #%s after Excel failure (%s): job=%s",
                submission_type, submission_id, reason, job.id,
            )
    except Exception:
        logger.exception(
            "AAGE fallback failed for %s #%s after Excel failure (%s)",
            submission_type, submission_id, reason,
        )


def trigger_auto_excel_grading(
    submission_id: int,
    submission_type: str,
    student_id: int,
    course,
    files_data: Any,
    force: bool = False,
) -> bool:
    """
    Check if auto-grading should run and trigger it in the background.

    Call this after a submission is saved to the database.

    Args:
        submission_id: ID of the AssignmentSubmission or ProjectSubmission
        submission_type: 'assignment' or 'project'
        student_id: Student user ID
        course: The Course ORM object (to check if it's an Excel course)
        files_data: The raw file_url / file_path field value
        force: If True, re-grade even if a previous result exists (for resubmissions)

    Returns:
        True if auto-grading was triggered, False if skipped.
    """
    try:
        # Guard 1: Must be an Excel course
        if not _is_excel_course(course):
            logger.info(
                "Auto-grade skipped: course %s is not an Excel course (%s #%s)",
                getattr(course, 'id', '?'), submission_type, submission_id,
            )
            return False

        # Guard 2: Must contain at least one Excel file
        if not _has_excel_files(files_data):
            logger.info(
                "Auto-grade skipped: no Excel files in %s #%s",
                submission_type, submission_id,
            )
            return False

        # Get the Flask app for context in the background thread
        from flask import current_app
        app = current_app._get_current_object()

        # Launch background grading thread
        thread = threading.Thread(
            target=_run_grading_in_background,
            args=(app, submission_id, submission_type, student_id),
            kwargs={'force': force},
            name=f"auto-grade-{submission_type}-{submission_id}",
            daemon=True,
        )
        thread.start()

        logger.info(
            f"🚀 Auto-grading triggered for {submission_type} #{submission_id} "
            f"(student={student_id})"
        )
        return True

    except Exception as e:
        logger.error(f"Failed to trigger auto-grading: {e}")
        return False
