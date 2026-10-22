"""v2 response serialization helpers.

All timestamps are emitted as ISO-8601 with the platform timezone offset
(``+02:00`` — Africa/Kigali). The application stores *naive local* wall-clock
times (see ``src/utils/time_utils.py``), so naive ISO strings coming out of
model ``to_dict()`` methods are re-attached to the local offset here rather
than being converted to UTC — this keeps v2 timestamps identical to what the
LMS UI displays while still being unambiguous for integrators.
"""

from __future__ import annotations

import re
from datetime import date, datetime, time
from typing import Any, Dict, Iterable, Optional

from ..utils.time_utils import make_aware_local

_NAIVE_DT_RE = re.compile(r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?)$")


def isoify(value: Any) -> Any:
    """Recursively normalize datetimes and naive ISO strings to ``+02:00``."""
    if isinstance(value, datetime):
        if value.tzinfo is None:
            try:
                return make_aware_local(value).isoformat()
            except Exception:
                return value.isoformat() + "+02:00"
        return value.isoformat()
    if isinstance(value, (date, time)):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: isoify(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [isoify(v) for v in value]
    if isinstance(value, str):
        m = _NAIVE_DT_RE.match(value)
        if m:
            return value + "+02:00"
        return value
    return value


def _pick(data: Dict[str, Any], keys: Iterable[str]) -> Dict[str, Any]:
    return {k: data.get(k) for k in keys if k in data}


def serialize_user(user) -> Dict[str, Any]:
    """Public account profile projection (never emits private/secrets)."""
    return isoify({
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username,
        "role": user.role.name if user.role else None,
        "is_active": user.is_active,
        "profile_picture_url": user.profile_picture_url,
        "job_title": getattr(user, "job_title", None),
        "timezone": getattr(user, "timezone", None),
        "created_at": user.created_at,
    })


def serialize_profile_patchable(user) -> Dict[str, Any]:
    """Fields ``PUT /api/v2/me`` may read/write."""
    data = serialize_user(user)
    data.update(isoify({
        "bio": user.bio,
        "phone_number": user.phone_number,
        "location": getattr(user, "location", None),
        "portfolio_url": getattr(user, "portfolio_url", None),
        "github_username": getattr(user, "github_username", None),
        "linkedin_url": getattr(user, "linkedin_url", None),
        "website_url": getattr(user, "website_url", None),
        "skills": getattr(user, "skills", None) or [],
        "interests": getattr(user, "interests", None) or [],
        "learning_goals": getattr(user, "learning_goals", None),
    }))
    return data


def serialize_course(course, *, include_modules: bool = False,
                     for_student: bool = True, cohort_id: Optional[int] = None) -> Dict[str, Any]:
    return isoify(course.to_dict(
        include_modules=include_modules, for_student=for_student, cohort_id=cohort_id,
    ))


def serialize_module(module, include_lessons: bool = True) -> Dict[str, Any]:
    return isoify(module.to_dict(include_lessons=include_lessons))


def serialize_lesson(lesson) -> Dict[str, Any]:
    return isoify(lesson.to_dict())


def serialize_enrollment(enrollment) -> Dict[str, Any]:
    course = enrollment.course
    return isoify({
        "id": enrollment.id,
        "course_id": enrollment.course_id,
        "course_title": course.title if course else None,
        "student_id": enrollment.student_id,
        "status": enrollment.status,
        "progress": enrollment.progress,
        "enrolled_at": enrollment.enrollment_date,
        "completed_at": enrollment.completed_at,
        "cohort_label": enrollment.cohort_label,
        "application_window_id": enrollment.application_window_id,
        "payment_status": enrollment.payment_status,
        "payment_verified": enrollment.payment_verified,
    })


def serialize_application(application, include_sensitive: bool = False) -> Dict[str, Any]:
    return isoify(application.to_dict(include_sensitive=include_sensitive))


def serialize_submission(submission) -> Dict[str, Any]:
    """Duck-typed: quiz ``Submission``, ``AssignmentSubmission`` and
    ``ProjectSubmission`` each expose ``to_dict`` with different signatures."""
    try:
        data = submission.to_dict(include_answers=False, for_student=True)
    except TypeError:
        data = submission.to_dict()
    return isoify(data)


def serialize_certificate(certificate) -> Dict[str, Any]:
    if hasattr(certificate, "to_dict"):
        return isoify(certificate.to_dict())
    return isoify(dict(certificate or {}))
