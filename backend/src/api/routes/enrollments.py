"""``/api/v2/me/enrollments`` — the authenticated learner's enrollments."""

from __future__ import annotations

from flask import g, request

from ...models.course_models import Course, Enrollment
from ...models.user_models import db
from ...services.enrollment_service import EnrollmentService
from .. import api_bp
from ..auth import current_user, require
from ..errors import ApiError, not_found, validation_error
from ..events import publish_event
from ..idempotency import idempotent
from ..pagination import paginate_query
from ..responses import created, paginated
from ..serialization import serialize_enrollment

ENROLLMENT_STATUS_FILTER = {"active", "completed", "terminated", "suspended",
                            "pending_payment"}


@api_bp.route("/me/enrollments", methods=["GET"])
@require(scopes=["enrollments:read"], user=True)
def list_my_enrollments():
    """List the authenticated learner's enrollments."""
    user = current_user()
    query = Enrollment.query.filter_by(student_id=user.id)

    status = (request.args.get("status") or "").strip()
    if status:
        if status not in ENROLLMENT_STATUS_FILTER:
            raise validation_error("Invalid status filter.",
                                   [{"field": "status",
                                     "issue": f"must be one of: {', '.join(sorted(ENROLLMENT_STATUS_FILTER))}"}])
        query = query.filter_by(status=status)

    course_id = request.args.get("course_id")
    if course_id:
        try:
            query = query.filter_by(course_id=int(course_id))
        except (TypeError, ValueError):
            raise validation_error("Invalid course_id filter.",
                                   [{"field": "course_id", "issue": "must be an integer"}])

    query = query.order_by(Enrollment.id.desc())
    items, pagination = paginate_query(query, args=request.args)
    return paginated([serialize_enrollment(e) for e in items], pagination)


@api_bp.route("/me/enrollments", methods=["POST"])
@require(scopes=["enrollments:write"], user=True)
@idempotent
def create_my_enrollment():
    """Directly enroll the authenticated learner in a free course.

    Paid/scholarship cohorts are intentionally rejected here — they flow
    through applications + payment verification.
    """
    body = request.get_json(silent=True) or {}
    course_id = body.get("course_id")
    if course_id in (None, ""):
        raise validation_error("The request contains missing required fields.",
                               [{"field": "course_id", "issue": "required"}])
    try:
        course_id = int(course_id)
    except (TypeError, ValueError):
        raise validation_error("The request contains invalid fields.",
                               [{"field": "course_id", "issue": "must be an integer"}])

    user = current_user()
    success, message, data = EnrollmentService.enroll_directly(user.id, course_id)

    if success:
        enrollment = db.session.get(Enrollment, data.get("enrollment_id"))
        publish_event(
            "enrollment.created",
            {"enrollment_id": data.get("enrollment_id"),
             "course_id": course_id, "student_id": user.id,
             "source": "api_v2_direct_enrollment"},
            subject_type="enrollment", subject_id=data.get("enrollment_id"),
            actor_user_id=user.id,
            source_client_id=(getattr(g, "api_client", None).id
                              if getattr(g, "api_client", None) else None),
        )
        return created(serialize_enrollment(enrollment) if enrollment else data)

    # Translate service messages into canonical v2 errors.
    if "not found" in message.lower():
        raise not_found(message)
    if "Already enrolled" in message:
        raise ApiError("CONFLICT", message, 409,
                       details=[{"enrollment_id": data.get("enrollment_id")}])
    if "free courses" in message:
        raise ApiError(
            "CONFLICT",
            "This course is not open for direct enrollment. Submit an application instead.",
            409,
            details=[{
                "hint": f"POST /api/v2/courses/{course_id}/applications",
                "enrollment_type": (db.session.get(Course, course_id).enrollment_type
                                    if db.session.get(Course, course_id) else None),
            }],
        )
    if "Prerequisites" in message:
        raise ApiError("PREREQUISITES_NOT_MET", message, 409)
    raise ApiError("VALIDATION_ERROR", message, 400)
