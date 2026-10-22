"""Public course catalog (no API key required for reads)."""

from __future__ import annotations

from flask import request
from sqlalchemy import or_

from ...models.course_models import Course, Enrollment
from .. import api_bp
from ..auth import resolve_user
from ..errors import not_found, validation_error
from ..pagination import paginate_query
from ..responses import ok, paginated
from ..serialization import isoify, serialize_course

COURSE_SORT_FIELDS = {
    "id": Course.id,
    "title": Course.title,
    "created_at": Course.created_at,
    "price": Course.price,
    "difficulty_level": Course.difficulty_level,
}


def _optional_user():
    """Resolve a user when a JWT is present, without requiring one."""
    try:
        resolve_user(required=False)
        from flask import g
        return getattr(g, "user", None)
    except Exception:
        return None


@api_bp.route("/courses", methods=["GET"])
def list_courses():
    """Public catalog of published courses (paginated, filterable)."""
    query = Course.query.filter_by(is_published=True)

    search = (request.args.get("q") or "").strip()
    if search:
        if len(search) > 200:
            raise validation_error("The search term is too long.",
                                   [{"field": "q", "issue": "at most 200 characters"}])
        pattern = f"%{search}%"
        query = query.filter(or_(
            Course.title.ilike(pattern),
            Course.description.ilike(pattern),
        ))

    enrollment_type = (request.args.get("enrollment_type") or "").strip()
    if enrollment_type:
        if enrollment_type not in ("free", "paid", "scholarship"):
            raise validation_error("Invalid enrollment_type filter.",
                                   [{"field": "enrollment_type",
                                     "issue": "must be free, paid or scholarship"}])
        query = query.filter_by(enrollment_type=enrollment_type)

    difficulty = (request.args.get("difficulty_level") or "").strip()
    if difficulty:
        query = query.filter_by(difficulty_level=difficulty)

    items, pagination = paginate_query(query, args=request.args)
    return paginated(
        [serialize_course(course, include_modules=False) for course in items],
        pagination,
    )


@api_bp.route("/courses/<int:course_id>", methods=["GET"])
def get_course(course_id: int):
    """Public course detail, including released modules for the viewer."""
    course = Course.query.get(course_id)
    if course is None or not course.is_published:
        raise not_found("Course not found or not published.")

    cohort_id = None
    user = _optional_user()
    if user is not None:
        enrollment = Enrollment.get_canonical(user.id, course.id)
        if enrollment is not None:
            cohort_id = enrollment.application_window_id

    return ok(serialize_course(course, include_modules=True,
                               for_student=True, cohort_id=cohort_id))


@api_bp.route("/courses/<int:course_id>/modules", methods=["GET"])
def list_course_modules(course_id: int):
    """Public module outline (titles only — no lesson bodies)."""
    course = Course.query.get(course_id)
    if course is None or not course.is_published:
        raise not_found("Course not found or not published.")

    modules = [m for m in course.modules.filter_by(is_published=True)
               .order_by("order").all()]
    outline = isoify([
        {
            "id": module.id,
            "title": module.title,
            "order": module.order,
            "lesson_count": module.lessons.count(),
        }
        for module in modules
    ])
    return ok(outline, meta={"course_id": course.id})


@api_bp.route("/courses/<int:course_id>/eligibility", methods=["GET"])
def course_eligibility(course_id: int):
    """Enrollment/eligibility snapshot for a course.

    Unauthenticated callers learn whether the course accepts applications;
    authenticated callers additionally learn their enrollment state and
    certificate eligibility (computed by the canonical progress service).
    """
    course = Course.query.get(course_id)
    if course is None or not course.is_published:
        raise not_found("Course not found or not published.")

    window = course.get_primary_application_window()
    payload = {
        "course_id": course.id,
        "is_published": course.is_published,
        "enrollment_type": course.enrollment_type,
        "price": course.price,
        "currency": course.currency,
        "require_payment_before_application": course.require_payment_before_application,
        "application_window": isoify(window),
        "can_apply": window.get("status") == "open",
        "authenticated": False,
    }

    user = _optional_user()
    if user is not None:
        payload["authenticated"] = True
        enrollment = Enrollment.get_canonical(user.id, course.id)
        payload["enrolled"] = enrollment is not None
        if enrollment is not None:
            payload["enrollment"] = isoify({
                "id": enrollment.id,
                "status": enrollment.status,
                "progress": enrollment.progress,
                "payment_verified": enrollment.payment_verified,
                "cohort_label": enrollment.cohort_label,
            })
            from ...services.course_progress_service import CourseProgressService
            progress = CourseProgressService.evaluate(
                user.id, course.id, enrollment=enrollment, course=course)
            payload["certificate_eligible"] = bool(progress.get("eligible"))
            payload["progress"] = isoify({
                k: progress.get(k)
                for k in ("progress", "completed_modules",
                          "total_modules", "overall_score")
                if k in progress
            })
        else:
            payload["enrolled"] = False
            payload["certificate_eligible"] = False

    return ok(payload)
