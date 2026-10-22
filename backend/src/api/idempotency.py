"""Idempotency support for unsafe v2 operations (``Idempotency-Key`` header).

Behaviour (documented in ``docs/api/developer-guide.md``):

* Same key + same request body → the stored 2xx response is replayed with
  ``Idempotency-Replayed: true``.
* Same key + different body → ``409 CONFLICT``.
* A row with ``response_status == 0`` marks an in-flight duplicate → ``409``
  with ``Retry-After: 1``.
* Keys are scoped to ``key:<api_key_id>`` (or ``ip:<address>`` when the call is
  unauthenticated) so two clients can never collide.
* Expired rows (24h retention) are purged opportunistically on write.

Race safety: the row is inserted *before* the operation runs; a concurrent
duplicate hits the unique constraint and is reported as in-progress.
"""

from __future__ import annotations

import hashlib
import json
import logging
from functools import wraps

from flask import Response, g, request
from sqlalchemy.exc import IntegrityError

from ..models.integration_models import ApiIdempotencyKey
from ..models.user_models import db
from .errors import ApiError

logger = logging.getLogger("api.v2.idempotency")


def _scope_key() -> str:
    key = getattr(g, "api_key", None)
    if key is not None:
        return f"key:{key.id}"
    from .ratelimit import client_ip
    return f"ip:{client_ip()}"


def _payload_hash() -> str:
    raw = request.get_data(cache=True) or b""
    return hashlib.sha256(raw).hexdigest()


def idempotent(f):
    """Decorator for write endpoints that honour ``Idempotency-Key``."""

    @wraps(f)
    def wrapper(*args, **kwargs):
        idem_key = (request.headers.get("Idempotency-Key") or "").strip()
        if not idem_key:
            return f(*args, **kwargs)
        if len(idem_key) > 200:
            raise ApiError(
                "VALIDATION_ERROR",
                "Idempotency-Key must be at most 200 characters.",
                400,
                details=[{"header": "Idempotency-Key", "issue": "too long"}],
            )

        scope = _scope_key()
        payload_hash = _payload_hash()
        reserved = False

        row = ApiIdempotencyKey.find(scope, idem_key)
        if row is None:
            try:
                _purge_and_commit()
                row = ApiIdempotencyKey(
                    scope_key=scope,
                    idempotency_key=idem_key,
                    request_hash=payload_hash,
                    response_status=0,          # 0 = in flight
                    response_body=None,
                )
                db.session.add(row)
                db.session.commit()
                reserved = True                 # this request owns the reservation
            except IntegrityError:
                db.session.rollback()
                row = ApiIdempotencyKey.find(scope, idem_key)
                if row is None:
                    _in_progress_conflict()

        if row.request_hash != payload_hash:
            raise ApiError(
                "CONFLICT",
                "This Idempotency-Key was already used with a different request payload.",
                409,
                details=[{"header": "Idempotency-Key", "issue": "payload mismatch"}],
            )

        if reserved:
            try:
                response = f(*args, **kwargs)
            except Exception:
                # Release the reservation so the client may retry the key.
                try:
                    ApiIdempotencyKey.query.filter_by(
                        scope_key=scope, idempotency_key=idem_key
                    ).delete(synchronize_session=False)
                    db.session.commit()
                except Exception:  # pragma: no cover
                    db.session.rollback()
                raise
            row.response_status = response.status_code
            row.response_body = _body_of(response)
            db.session.commit()
            return response

        if row.response_status == 0:
            _in_progress_conflict()

        return _replay(row)

    return wrapper


def _in_progress_conflict() -> None:
    raise ApiError(
        "CONFLICT",
        "A request with this Idempotency-Key is currently in progress. Retry shortly.",
        409,
        details=[{"header": "Idempotency-Key", "issue": "request in progress"}],
        headers={"Retry-After": "1"},
    )


def _body_of(response: Response):
    try:
        return response.get_json(silent=True)
    except Exception:  # pragma: no cover
        return None


def _replay(row: ApiIdempotencyKey):
    response = Response(
        json.dumps(row.response_body if row.response_body is not None else {}),
        status=row.response_status,
        content_type="application/json",
    )
    response.headers["Idempotency-Replayed"] = "true"
    return response


def _purge_and_commit() -> None:
    try:
        ApiIdempotencyKey.purge_old()
        db.session.commit()
    except Exception:  # pragma: no cover - cleanup must never break a request
        db.session.rollback()
