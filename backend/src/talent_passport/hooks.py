"""Failure-isolated hooks from LMS writes into Talent Passport.

Hooks run inside a SAVEPOINT so a Passport failure can never roll back the
original LMS grade/submission/certificate write. They are idempotent and do
not commit; the caller's transaction remains authoritative.
"""

from __future__ import annotations

import logging
from typing import Optional

from ..models.user_models import db
from .evidence import handle_event

logger = logging.getLogger(__name__)


def notify_talent_passport(event_type: str, student_id: Optional[int],
                           source_type: str, source_id: Optional[int],
                           course_id: Optional[int] = None,
                           suffix: str = "") -> Optional[dict]:
    """Notify the Passport about an LMS change. Never raises to the caller."""
    if not student_id or not source_id:
        return None
    try:
        with db.session.begin_nested():
            return handle_event(
                event_type=event_type,
                student_id=int(student_id),
                source_type=source_type,
                source_id=int(source_id),
                course_id=course_id,
                suffix=suffix,
            )
    except Exception:
        # The SAVEPOINT has been rolled back; the LMS write remains intact.
        logger.warning(
            "Talent Passport hook failed for %s/%s/%s",
            event_type, source_type, source_id, exc_info=True,
        )
        return None
