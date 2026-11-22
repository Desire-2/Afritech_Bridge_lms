"""Auto-enqueue hook for assignment/project submissions.

Every ``assignment`` and ``project`` submission is graded by AAGE.  Spreadsheet
files are handled by the native :mod:`aage.evaluators.spreadsheet` specialist,
not by the legacy Excel engine, so there is no engine ownership branch here.

The hook deliberately fails open for the student request: a grading-enqueue
failure is logged and rolled back, never raised into the submission response.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from ...models.user_models import db
from . import jobs
from .constants import SUBMISSION_ASSIGNMENT, SUBMISSION_PROJECT

logger = logging.getLogger("aage.submission_dispatch")


def uses_excel_grader(course: Any, files_data: Any) -> bool:
    """Legacy *detection* helper, retained for status/compatibility views.

    It no longer decides engine ownership: AAGE always owns the grade.  The
    boolean only tells the UI whether the spreadsheet specialist is likely to
    be selected, so historical Excel results can still be displayed.
    """
    try:
        from ..excel_grading.auto_grader import (
            _has_excel_files,
            _is_excel_course,
        )
        return bool(_is_excel_course(course) and _has_excel_files(files_data))
    except Exception:  # pragma: no cover - defensive if Excel module changes
        return False


def enqueue_for_submission(
    *,
    submission_type: str,
    submission_id: int,
    student_id: Optional[int] = None,
    excel_grading_triggered: bool = False,
    force: bool = False,
    requested_by: Optional[int] = None,
) -> Optional[Any]:
    """Queue an AAGE job for a newly saved (or resubmitted) submission.

    ``excel_grading_triggered`` is accepted only so older callers keep working;
    it no longer suppresses AAGE, because Excel is a specialist evaluator
    inside AAGE rather than a competing engine.

    Returns the queued (or deduplicated active) ``GradingJob``, or ``None`` when
    the submission is not eligible or enqueueing failed.
    """
    if submission_type not in (SUBMISSION_ASSIGNMENT, SUBMISSION_PROJECT):
        return None

    try:
        job = jobs.enqueue_grade_job(
            submission_type=submission_type,
            submission_id=int(submission_id),
            student_id=student_id,
            requested_by=requested_by if requested_by is not None else student_id,
            force=force,
        )
        logger.info(
            "AAGE auto-enqueue submission=%s/%s job=%s (%s)",
            submission_type, submission_id, job.id, job.status,
        )
        return job
    except Exception:
        # A queue failure must never undo a submission the student already
        # made. The worker's recovery pass can still pick up partial state,
        # and instructors can start the job manually from the grading queue.
        try:
            db.session.rollback()
        except Exception:  # pragma: no cover - defensive
            pass
        logger.exception(
            "AAGE auto-enqueue failed for submission=%s/%s",
            submission_type, submission_id,
        )
        return None
