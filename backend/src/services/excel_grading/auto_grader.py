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
import json
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# Excel file extensions (must match ExcelGradingService.ALLOWED_EXTENSIONS)
EXCEL_EXTENSIONS = {'.xlsx', '.xlsm', '.xls', '.csv'}

# Keywords to detect Excel courses (must match excel_grading_service.py)
EXCEL_COURSE_KEYWORDS = ['ms excel', 'microsoft excel', 'excel', 'spreadsheet']

# Auto-grading configuration
MAX_RETRIES = 2
RETRY_DELAY_SECONDS = 5
AUTO_GRADE_TIMEOUT = 120  # seconds


def _has_excel_files(files_data: Any) -> bool:
    """
    Check if the submission contains any Excel files.

    Args:
        files_data: Raw file_url/file_path field — could be JSON string,
                    list, dict, or plain URL string.

    Returns:
        True if at least one file has an Excel extension.
    """
    if not files_data:
        return False

    # Parse JSON string if needed
    if isinstance(files_data, str):
        try:
            files_data = json.loads(files_data)
        except (json.JSONDecodeError, TypeError):
            # Plain URL — check extension
            return any(files_data.lower().endswith(ext) for ext in EXCEL_EXTENSIONS)

    # Normalise to a list
    if isinstance(files_data, dict):
        files_data = [files_data]

    if not isinstance(files_data, list):
        return False

    for f in files_data:
        name = ''
        if isinstance(f, dict):
            name = (
                f.get('original_filename', '')
                or f.get('filename', '')
                or f.get('name', '')
                or f.get('file_name', '')
            ).lower()
        elif isinstance(f, str):
            name = f.lower()

        if any(name.endswith(ext) for ext in EXCEL_EXTENSIONS):
            return True

    return False


def _is_excel_course(course) -> bool:
    """Check if the course is an MS Excel course."""
    if not course:
        return False
    title = (getattr(course, 'title', '') or '').lower()
    description = (getattr(course, 'description', '') or '').lower()
    combined = f"{title} {description}"
    return any(kw in combined for kw in EXCEL_COURSE_KEYWORDS)


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
    Includes retry logic on transient failures.
    """
    with app.app_context():
        try:
            from . import ExcelGradingService

            logger.info(
                f"🤖 Auto-grading started: {submission_type} #{submission_id} "
                f"(attempt {attempt}/{MAX_RETRIES + 1})"
            )

            service = ExcelGradingService()
            result = service.grade_submission(
                submission_id,
                submission_type,
                force=(force or attempt > 1),  # Force on resubmission or retry
            )

            status = result.get('status', 'unknown')

            if status == 'completed':
                grade_data = result.get('result', {})
                total_score = grade_data.get('total_score', 0)
                max_score = grade_data.get('max_score', 100)

                logger.info(
                    f"✅ Auto-grading completed: {submission_type} #{submission_id} → "
                    f"{total_score}/{max_score} "
                    f"({grade_data.get('grade_letter', '?')})"
                )

                # ── Step A: Auto-approve the ExcelGradingResult ──────
                # Mark the AI result as reviewed/approved so both student
                # and instructor views treat it as a final grade.
                _auto_approve_grading_result(
                    app, submission_id, submission_type, grade_data,
                )

                # ── Step B: Write grade onto the actual submission record ──
                # This mirrors what the instructor grading endpoint does,
                # so the student sees the grade immediately in their UI.
                _apply_grade_to_submission(
                    app, submission_id, submission_type, student_id,
                    total_score, max_score, grade_data,
                )

                # ── Step C: Auto-request modification if below passing ──
                modification_requested = _auto_request_modification_if_needed(
                    app, submission_id, submission_type, student_id,
                    total_score, max_score, grade_data,
                )

                # ── Step D: Update module progress & lesson completion ──
                if not modification_requested:
                    _update_learning_progress(
                        app, submission_id, submission_type, student_id,
                        total_score, max_score,
                    )

                # ── Step E: Notify student ──
                _notify_student_auto_graded(
                    app, submission_id, submission_type, student_id, result,
                    modification_requested=modification_requested,
                )

            elif status == 'already_graded':
                logger.info(
                    f"ℹ️ Auto-grading skipped: {submission_type} #{submission_id} "
                    f"already graded"
                )

            elif status in ('failed', 'skipped'):
                reason = result.get('reason', result.get('message', 'unknown'))
                logger.warning(
                    f"⚠️ Auto-grading {status}: {submission_type} #{submission_id} — {reason}"
                )
                # Retry on transient failures
                if (
                    attempt <= MAX_RETRIES
                    and result.get('reason') in ('download_failed',)
                ):
                    logger.info(
                        f"🔄 Retrying auto-grade in {RETRY_DELAY_SECONDS}s…"
                    )
                    time.sleep(RETRY_DELAY_SECONDS)
                    _run_grading_in_background(
                        app, submission_id, submission_type,
                        student_id, attempt + 1, force=force,
                    )
            else:
                logger.warning(
                    f"❓ Auto-grading returned unexpected status '{status}' "
                    f"for {submission_type} #{submission_id}"
                )

        except Exception as e:
            logger.exception(
                f"❌ Auto-grading exception for {submission_type} #{submission_id}: {e}"
            )
            if attempt <= MAX_RETRIES:
                time.sleep(RETRY_DELAY_SECONDS)
                _run_grading_in_background(
                    app, submission_id, submission_type,
                    student_id, attempt + 1, force=force,
                )


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

        result.instructor_reviewed = True
        result.manual_review_required = False
        result.instructor_reviewed_at = datetime.utcnow()
        result.instructor_notes = 'Auto-approved by AI grading system'
        result.status = 'completed'

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


def _apply_grade_to_submission(
    app,
    submission_id: int,
    submission_type: str,
    student_id: int,
    total_score: float,
    max_score: float,
    grade_data: Dict[str, Any],
) -> bool:
    """
    Write the AI-generated grade directly onto the AssignmentSubmission or
    ProjectSubmission record, mirroring what the instructor grading endpoint
    does.  This makes the grade visible in the student's dashboard/API
    immediately after auto-grading completes.

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

        # Build a clean feedback string from the AI overall_feedback
        feedback = grade_data.get('overall_feedback', '')
        ai_note = (
            "\n\n---\n"
            "📊 *This grade was automatically generated and approved by AI analysis.*"
        )
        full_feedback = (feedback + ai_note) if feedback else ai_note.strip()

        submission.grade = scaled_grade
        submission.feedback = full_feedback
        submission.graded_at = datetime.utcnow()
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
                        lc.assignment_graded_at = datetime.utcnow()
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
            if getattr(parent, 'modification_requested', False):
                parent.modification_requested = False
                parent.modification_request_reason = None
                parent.modification_requested_at = None
                parent.modification_requested_by = None
                parent.can_resubmit = False
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


def _auto_request_modification_if_needed(
    app,
    submission_id: int,
    submission_type: str,
    student_id: int,
    total_score: float,
    max_score: float,
    grade_data: Dict[str, Any],
) -> bool:
    """
    If the auto-graded score is below the assignment/project passing score,
    automatically request modifications so the student can resubmit.

    Returns True if a modification request was created.
    """
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

        passing_score = getattr(parent, 'passing_score', None) or 60.0

        if score_pct >= passing_score:
            logger.info(
                f"✅ Score {score_pct:.1f}% meets passing threshold "
                f"{passing_score}% — no modification request needed"
            )
            return False

        # Check resubmission limits
        max_resubs = getattr(parent, 'max_resubmissions', 3) or 3
        current_resubs = getattr(parent, 'resubmission_count', 0) or 0
        if current_resubs >= max_resubs:
            logger.info(
                f"⚠️ Score {score_pct:.1f}% below passing ({passing_score}%) "
                f"but max resubmissions ({max_resubs}) already reached"
            )
            return False

        # Build a helpful reason from AI analysis
        weaknesses = grade_data.get('analysis_data', {}).get('weaknesses', [])
        strengths = grade_data.get('analysis_data', {}).get('strengths', [])
        feedback_text = grade_data.get('overall_feedback', '')

        reason_parts = [
            f"Your submission scored {total_score:.1f}/{max_score:.0f} "
            f"({score_pct:.1f}%), which is below the passing score of "
            f"{passing_score:.0f}%. Please review and resubmit.",
        ]
        if weaknesses:
            reason_parts.append("\n\n**Areas needing improvement:**")
            for w in weaknesses[:5]:
                reason_parts.append(f"• {w}")
        if strengths:
            reason_parts.append("\n\n**What you did well:**")
            for s in strengths[:3]:
                reason_parts.append(f"• {s}")
        if feedback_text:
            # Include a trimmed version of the full feedback
            trimmed = feedback_text[:500]
            if len(feedback_text) > 500:
                trimmed += "…"
            reason_parts.append(f"\n\n**AI Feedback:**\n{trimmed}")

        reason = "\n".join(reason_parts)

        # Set modification request flags on the parent (assignment/project)
        parent.modification_requested = True
        parent.modification_request_reason = reason
        parent.modification_requested_at = datetime.utcnow()
        parent.modification_requested_by = None  # System/AI initiated
        parent.can_resubmit = True

        # Clear the grade on the submission so the student sees "needs_revision"
        submission.grade = None
        submission.feedback = f"Modification requested (auto): {reason[:200]}"
        submission.graded_at = None
        submission.graded_by = None

        # Update lesson completion if applicable (assignments only)
        if submission_type == 'assignment':
            lesson_id = getattr(parent, 'lesson_id', None)
            if lesson_id:
                lc = LessonCompletion.query.filter_by(
                    student_id=student_id,
                    lesson_id=lesson_id,
                ).first()
                if lc:
                    lc.assignment_graded = False
                    lc.assignment_needs_resubmission = True
                    lc.modification_request_reason = reason[:500]

        db.session.commit()

        logger.info(
            f"🔄 Auto-modification requested: {submission_type} #{submission_id} — "
            f"score {score_pct:.1f}% < passing {passing_score}%"
        )
        return True

    except Exception as e:
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
):
    """
    Send a lightweight notification to the student that AI grading is ready.
    This is a preliminary grade; instructor review may adjust it.
    """
    try:
        from src.models.user_models import User
        from src.models.course_models import Assignment, AssignmentSubmission, Project, ProjectSubmission
        from src.utils.email_notifications import send_grade_notification, send_project_graded_notification

        student = User.query.get(student_id)
        if not student or not student.email:
            return

        grade_data = result.get('result', {})
        score = grade_data.get('total_score', 0)
        feedback = grade_data.get('overall_feedback', '')

        # Add a note that this is AI-generated preliminary feedback
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
            if submission:
                assignment = Assignment.query.get(submission.assignment_id)
                if assignment:
                    send_grade_notification(
                        submission=submission,
                        assignment=assignment,
                        student=student,
                        grade=score,
                        feedback=feedback_with_note,
                    )
                    logger.info(f"📧 Auto-grade notification sent to {student.email}")
        elif submission_type == 'project':
            submission = ProjectSubmission.query.get(submission_id)
            if submission:
                project = Project.query.get(submission.project_id)
                if project:
                    send_project_graded_notification(
                        submission=submission,
                        project=project,
                        student=student,
                        grade=score,
                        feedback=feedback_with_note,
                    )
                    logger.info(f"📧 Auto-grade notification sent to {student.email}")

    except Exception as e:
        logger.warning(f"⚠️ Auto-grade notification failed: {e}")


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
            return False

        # Guard 2: Must contain at least one Excel file
        if not _has_excel_files(files_data):
            logger.debug(
                f"Auto-grade skipped: no Excel files in {submission_type} #{submission_id}"
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
