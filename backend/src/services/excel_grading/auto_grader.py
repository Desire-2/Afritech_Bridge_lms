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
                force=(attempt > 1),  # Force on retry
            )

            status = result.get('status', 'unknown')

            if status == 'completed':
                logger.info(
                    f"✅ Auto-grading completed: {submission_type} #{submission_id} → "
                    f"{result.get('result', {}).get('total_score', '?')}/"
                    f"{result.get('result', {}).get('max_score', '?')} "
                    f"({result.get('result', {}).get('grade_letter', '?')})"
                )
                # Optionally notify student
                _notify_student_auto_graded(
                    app, submission_id, submission_type, student_id, result
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
                        student_id, attempt + 1,
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
                    student_id, attempt + 1,
                )


def _notify_student_auto_graded(
    app,
    submission_id: int,
    submission_type: str,
    student_id: int,
    result: Dict[str, Any],
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
        ai_note = (
            "\n\n---\n"
            "📊 *This is an AI-generated preliminary grade. "
            "Your instructor will review and may adjust the final score.*"
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
