"""``/api/v2`` course applications for the authenticated learner.

Applications in the platform are keyed by email (there is no direct user FK),
so "my applications" resolves the authenticated user's email. Submission
reuses the exact legacy application pipeline (scoring, cohort resolution,
payment kickoff, emails) via
``application_routes.submit_course_application``.
"""

from __future__ import annotations

from flask import Response, g, make_response, request
from sqlalchemy import func

from ...models.course_application import CourseApplication
from ...models.user_models import db
from .. import api_bp
from ..auth import current_user, require
from ..dispatch import adapt
from ..errors import ApiError, not_found, validation_error
from ..events import publish_event
from ..idempotency import idempotent
from ..pagination import paginate_query
from ..responses import ok, paginated
from ..serialization import serialize_application

APPLICATION_STATUS_FILTER = {"pending", "approved", "rejected", "waitlisted",
                             "under_review", "payment_pending"}


def _my_applications_query(user):
    return CourseApplication.query.filter(
        func.lower(func.trim(CourseApplication.email))
        == (user.email or "").strip().lower()
    )


def _status_filter(query, args):
    status = (args.get("status") or "").strip()
    if status:
        if status not in APPLICATION_STATUS_FILTER:
            raise validation_error("Invalid status filter.",
                                   [{"field": "status",
                                     "issue": f"must be one of: {', '.join(sorted(APPLICATION_STATUS_FILTER))}"}])
        query = query.filter_by(status=status)
    return query


@api_bp.route("/me/applications", methods=["GET"])
@require(scopes=["applications:read"], user=True)
def list_my_applications():
    """List the authenticated learner's course applications."""
    user = current_user()
    query = _my_applications_query(user).order_by(CourseApplication.id.desc())
    query = _status_filter(query, request.args)
    items, pagination = paginate_query(query, args=request.args)
    return paginated(
        [serialize_application(app, include_sensitive=False) for app in items],
        pagination,
    )


@api_bp.route("/me/applications/<int:application_id>", methods=["GET"])
@require(scopes=["applications:read"], user=True)
def get_my_application(application_id: int):
    """Read a single application owned by the authenticated learner."""
    user = current_user()
    application = db.session.get(CourseApplication, application_id)
    if application is None:
        raise not_found("Application not found.")
    if (application.email or "").strip().lower() != (user.email or "").strip().lower():
        raise not_found("Application not found.")
    return ok(serialize_application(application, include_sensitive=False))


@api_bp.route("/courses/<int:course_id>/applications", methods=["POST"])
@require(scopes=["applications:write"], user=True)
@idempotent
def submit_application(course_id: int):
    """Submit a course application on behalf of the authenticated learner.

    ``email``/``full_name`` default to the authenticated user; an explicit
    email must match the account (prevents applications under arbitrary
    addresses).
    """
    user = current_user()
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise validation_error("A JSON object body is required.")

    payload = dict(body)
    payload["course_id"] = course_id

    incoming_email = str(payload.get("email") or user.email or "").strip().lower()
    account_email = (user.email or "").strip().lower()
    if incoming_email and incoming_email != account_email:
        raise ApiError(
            "FORBIDDEN",
            "The application email must match the authenticated account.",
            403,
            details=[{"field": "email", "issue": "must match the authenticated user"}],
        )
    payload["email"] = account_email
    if not payload.get("full_name"):
        full_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
        payload["full_name"] = full_name or user.username
    if not payload.get("phone") and user.phone_number:
        payload["phone"] = user.phone_number

    from ...routes.application_routes import submit_course_application
    result = submit_course_application(payload)
    response: Response = make_response(result)

    if response.status_code == 201:
        body_json = response.get_json(silent=True) or {}
        application_id = body_json.get("application_id")
        publish_event(
            "application.submitted",
            {"application_id": application_id, "course_id": course_id,
             "email": account_email, "status": body_json.get("status")},
            subject_type="application", subject_id=application_id,
            actor_user_id=user.id,
            source_client_id=(getattr(g, "api_client", None).id
                              if getattr(g, "api_client", None) else None),
        )
        response.status_code = 201

    return adapt(response)
