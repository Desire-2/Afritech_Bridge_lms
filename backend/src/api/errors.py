"""Error handling for the /api/v2 integration API.

``ApiError`` is raised anywhere inside a v2 route (validators, auth, services)
and is rendered by the blueprint-level error handlers in ``__init__.py`` into
the standard envelope::

    {"error": {"code": "...", "message": "...", "details": [...], "request_id": "..."}}

Legacy (/api/v1) error shapes are untouched — handlers are registered on the
v2 blueprint only.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


class ApiError(Exception):
    def __init__(self, code: str, message: str, status: int = 400,
                 details: Optional[List[Any]] = None,
                 headers: Optional[Dict[str, str]] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.details = details or []
        self.headers = headers or {}


# Convenience constructors -------------------------------------------------

def validation_error(message: str = "The request contains invalid fields.",
                     details: Optional[List[Any]] = None) -> ApiError:
    return ApiError("VALIDATION_ERROR", message, 400, details)


def unauthenticated(message: str = "Authentication is required.",
                    details: Optional[List[Any]] = None) -> ApiError:
    return ApiError("UNAUTHENTICATED", message, 401, details)


def forbidden(message: str = "You do not have permission to perform this action.",
              details: Optional[List[Any]] = None) -> ApiError:
    return ApiError("FORBIDDEN", message, 403, details)


def not_found(message: str = "The requested resource was not found.") -> ApiError:
    return ApiError("NOT_FOUND", message, 404)


def conflict(code: str = "CONFLICT", message: str = "The request conflicts with the current state.",
             details: Optional[List[Any]] = None) -> ApiError:
    return ApiError(code, message, 409, details)


#: HTTP status -> error code used when translating legacy/HTTP exceptions.
STATUS_CODES = {
    400: "VALIDATION_ERROR",
    401: "UNAUTHENTICATED",
    # Legacy lesson-completion gating uses 402 to signal "a quiz must be
    # submitted before this lesson can be completed".
    402: "ASSESSMENT_REQUIRED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    415: "UNSUPPORTED_MEDIA_TYPE",
    422: "UNPROCESSABLE_ENTITY",
    429: "RATE_LIMITED",
    500: "INTERNAL_ERROR",
    503: "SERVICE_UNAVAILABLE",
}
