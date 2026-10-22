"""Unauthenticated liveness/readiness endpoint."""

from __future__ import annotations

from sqlalchemy import text

from ...models.user_models import db
from .. import api_bp
from ..responses import ok


@api_bp.route("/health", methods=["GET"])
def health():
    """Liveness/readiness probe — exempt from rate limiting."""
    database = "ok"
    try:
        db.session.execute(text("SELECT 1"))
    except Exception:
        database = "unavailable"

    status = 200 if database == "ok" else 503
    return ok(
        {
            "status": "ok" if database == "ok" else "degraded",
            "api_version": "v2",
            "checks": {"database": database},
        },
        status,
    )
