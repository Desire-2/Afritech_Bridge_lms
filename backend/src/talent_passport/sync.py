"""Backfill helpers for Talent Passport.

Interactive/targeted updates live in :mod:`evidence`; this module is the
operational entry point for administrative backfills.
"""

from __future__ import annotations

from typing import Iterable, Optional

from ..models.course_models import Enrollment
from ..models.student_models import Certificate
from ..models.user_models import db
from .evidence import handle_event, sync_student


def backfill_students(student_ids: Optional[Iterable[int]] = None,
                      course_id: Optional[int] = None,
                      commit: bool = True) -> int:
    """Reconcile supplied students (or all students with LMS records)."""
    if student_ids is None:
        ids = {
            row.student_id for row in Enrollment.query.with_entities(Enrollment.student_id).all()
        } | {
            row.student_id for row in Certificate.query.with_entities(Certificate.student_id).all()
        }
    else:
        ids = {int(value) for value in student_ids}

    count = 0
    for student_id in sorted(ids):
        sync_student(student_id, course_id)
        count += 1
    if commit:
        db.session.commit()
    return count


__all__ = ["backfill_students", "handle_event", "sync_student"]
