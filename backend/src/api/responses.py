"""Response envelope builders for the /api/v2 integration API."""

from __future__ import annotations

from typing import Any, Dict, Optional

from flask import Response, jsonify

from .constants import API_VERSION, API_VERSION_HEADER
from .errors import ApiError


def _request_id() -> Optional[str]:
    from flask import g
    return getattr(g, "request_id", None)


def _finalize(response: Response, status: int, headers: Optional[Dict[str, str]]) -> Response:
    response.status_code = status
    response.headers.setdefault("X-API-Version", API_VERSION)
    rid = _request_id()
    if rid:
        response.headers.setdefault("X-Request-Id", rid)
    if headers:
        for key, value in headers.items():
            response.headers[key] = value
    return response


def _meta(extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    meta: Dict[str, Any] = {"request_id": _request_id(), "api_version": API_VERSION}
    if extra:
        meta.update(extra)
    return meta


def ok(data: Any, status: int = 200, *, meta: Optional[Dict[str, Any]] = None,
       headers: Optional[Dict[str, str]] = None) -> Response:
    """Single-resource / action success: ``{"data": ..., "meta": {...}}``."""
    body = {"data": data, "meta": _meta(meta)}
    return _finalize(jsonify(body), status, headers)


def created(data: Any, *, meta: Optional[Dict[str, Any]] = None,
            location: Optional[str] = None,
            headers: Optional[Dict[str, str]] = None) -> Response:
    merged = dict(headers or {})
    if location:
        merged["Location"] = location
    return ok(data, 201, meta=meta, headers=merged)


def no_content(headers: Optional[Dict[str, str]] = None) -> Response:
    response = Response(status=204)
    response.headers.setdefault("X-API-Version", API_VERSION)
    rid = _request_id()
    if rid:
        response.headers.setdefault("X-Request-Id", rid)
    if headers:
        for key, value in headers.items():
            response.headers[key] = value
    return response


def paginated(items: Any, pagination: Dict[str, Any], *,
               meta: Optional[Dict[str, Any]] = None,
               headers: Optional[Dict[str, str]] = None) -> Response:
    """List success: ``{"data": [...], "pagination": {...}, "meta": {...}}``."""
    body = {"data": items, "pagination": pagination, "meta": _meta(meta)}
    return _finalize(jsonify(body), 200, headers)


def error_payload(code: str, message: str, details: Optional[list] = None) -> Dict[str, Any]:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details or [],
            "request_id": _request_id(),
        }
    }


def error_response(error: ApiError) -> Response:
    response = jsonify(error_payload(error.code, error.message, error.details))
    return _finalize(response, error.status, error.headers)


def api_version_header() -> Dict[str, str]:
    return {API_VERSION_HEADER: API_VERSION}
