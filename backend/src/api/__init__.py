"""``/api/v2`` integration API — the versioned, documented external surface.

This package exposes the platform's existing capabilities to authorized
integration partners (main website, jobs portal, mobile BFF) behind API keys
and user JWTs. It reuses the same services and, where behaviour only exists in
legacy route functions, dispatches into those exact functions (see
``dispatch.py``) so the LMS UI and the API can never diverge.

Layering::

    routes/    thin HTTP adapters (validate -> call -> envelope)
    auth.py    principal resolution (API key + user JWT + scopes + roles)
    dispatch.py  bridge into existing /api/v1 view functions
    events.py  integration events + signed outbound webhooks
    errors.py  ApiError -> {"error": {...}} (blueprint-scoped handlers)

The legacy ``/api/v1`` surface is untouched.
"""

from __future__ import annotations

import logging

from flask import Blueprint, jsonify
from werkzeug.exceptions import HTTPException

from .errors import STATUS_CODES, ApiError
from .responses import error_response

logger = logging.getLogger("api.v2")

api_bp = Blueprint(
    "api_v2",
    __name__,
    url_prefix="/api/v2",
)


@api_bp.errorhandler(ApiError)
def _handle_api_error(error: ApiError):
    return error_response(error)


@api_bp.errorhandler(HTTPException)
def _handle_http_exception(error: HTTPException):
    """Wrap Werkzeug HTTP exceptions (404/405/415/…) in the v2 envelope."""
    code = STATUS_CODES.get(error.code or 0, "HTTP_ERROR")
    message = error.description or error.name or "Request failed."
    return error_response(ApiError(code, message, error.code or 500))


@api_bp.errorhandler(Exception)
def _handle_unexpected(error: Exception):  # pragma: no cover - safety net
    logger.exception("unhandled_api_v2_error")
    return error_response(ApiError(
        "INTERNAL_ERROR",
        "An unexpected error occurred. Quote the request_id when contacting support.",
        500,
    ))


# Route modules — imported after ``api_bp`` exists to avoid circularity.
from . import (  # noqa: E402,F401
    docs as _docs,
    health as _health,
    token as _token,
    me as _me,
    courses as _courses,
    enrollments as _enrollments,
    applications as _applications,
    progress as _progress,
    assessments as _assessments,
    certificates as _certificates,
    instructor as _instructor,
    admin as _admin,
    webhooks as _webhooks,
    events as _events,
)
