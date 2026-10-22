"""Request ID, structured access logging, API-key resolution and rate limits.

Attached to the ``/api/v2`` blueprint only — the legacy ``/api/v1`` surface
keeps its existing behaviour untouched.
"""

from __future__ import annotations

import json
import logging
import re
import time
import uuid

from flask import Blueprint, g, request

from .auth import resolve_api_key
from .errors import ApiError
from .ratelimit import client_ip, enforce_rate_limit

logger = logging.getLogger("api.v2.access")

REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._\-]{8,64}$")

#: Headers whose values must never reach the logs.
_REDACT_HEADERS = {"authorization", "x-api-key", "cookie", "idempotency-key"}


def _incoming_request_id() -> str:
    candidate = request.headers.get("X-Request-Id", "").strip()
    if candidate and REQUEST_ID_RE.match(candidate):
        return candidate
    return uuid.uuid4().hex


def init_middleware(bp: Blueprint) -> None:
    @bp.before_request
    def _v2_before_request():  # noqa: D401
        g.request_id = _incoming_request_id()
        g.started_at = time.perf_counter()
        g.rate_limit = None
        resolve_api_key()          # validates X-API-Key when present
        enforce_rate_limit()       # may raise ApiError(429)
        return None

    @bp.after_request
    def _v2_after_request(response):
        # Envelope builders set these; guarantee them for every v2 response.
        response.headers.setdefault("X-Request-Id", getattr(g, "request_id", ""))
        response.headers.setdefault("X-API-Version", "v2")

        rate = getattr(g, "rate_limit", None)
        if rate:
            response.headers.setdefault("X-RateLimit-Limit", str(rate["limit"]))
            response.headers.setdefault("X-RateLimit-Remaining", str(rate["remaining"]))
            response.headers.setdefault("X-RateLimit-Reset", str(rate["reset_seconds"]))

        duration_ms = 0.0
        if getattr(g, "started_at", None):
            duration_ms = round((time.perf_counter() - g.started_at) * 1000, 2)

        key = getattr(g, "api_key", None)
        user = getattr(g, "user", None)
        record = {
            "event": "api_request",
            "request_id": getattr(g, "request_id", None),
            "method": request.method,
            "path": request.path,
            "status": response.status_code,
            "duration_ms": duration_ms,
            "client_id": getattr(g, "api_client", None).id if getattr(g, "api_client", None) else None,
            "api_key_id": key.id if key else None,
            "user_id": user.id if user else None,
            "ip": client_ip(),
        }
        level = logging.WARNING if response.status_code >= 500 else logging.INFO
        logger.log(level, json.dumps(record, default=str))
        return response

    @bp.app_errorhandler(ApiError)
    def _api_error_handler(error: ApiError):  # pragma: no cover - registered on app below
        from .responses import error_response
        return error_response(error)
