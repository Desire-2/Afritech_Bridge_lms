"""Integration events and outbound webhook delivery.

``publish_event`` is intentionally failure-isolated: it commits its own rows,
never raises, and never blocks the caller on network I/O. Deliveries run in a
daemon thread (or synchronously when ``API_WEBHOOKS_SYNC=1``, used by tests and
for deterministic manual replays) with exponential backoff up to
``API_WEBHOOKS_MAX_ATTEMPTS`` attempts.

Payload shape::

    {
      "id": "…", "type": "certificate.issued", "api_version": "v2",
      "created_at": "2026-10-18T14:03:05.123456+02:00",
      "subject": {"type": "certificate", "id": "…"},
      "data": { … }
    }

Signature: ``X-ATB-Signature: t=<unix>,v1=<hex>`` where ``hex`` is
``HMAC-SHA256(secret, "{t}.{raw_body}")``. Consumers must compare in constant
time and reject timestamps skewed more than 5 minutes.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import threading
import time
from typing import List, Optional

import requests

from ..models.integration_models import ApiEvent, WebhookDelivery, WebhookSubscription
from ..models.user_models import db
from ..utils.time_utils import now_local
from .ssrf import WebhookUrlRejected, assert_delivery_target_allowed

logger = logging.getLogger("api.v2.events")

USER_AGENT = "AfriTechBridge-Webhooks/2.0"
TIMEOUT_SECONDS = 10
SIGNATURE_TOLERANCE_SECONDS = 300
BACKOFF_SECONDS = [5, 30, 120, 600, 1800]

def _sync_mode() -> bool:
    return (os.getenv("API_WEBHOOKS_SYNC", "0") == "1"
            or os.getenv("API_WEBHOOK_DELIVERY_DISABLED", "0") == "1")


def _delivery_disabled() -> bool:
    return os.getenv("API_WEBHOOK_DELIVERY_DISABLED", "0") == "1"


def _max_attempts() -> int:
    try:
        return max(1, int(os.getenv("API_WEBHOOKS_MAX_ATTEMPTS", "5") or "5"))
    except ValueError:
        return 5


def publish_event(event_type: str, data: dict, *,
                  subject_type: Optional[str] = None,
                  subject_id: Optional[str] = None,
                  actor_user_id: Optional[int] = None,
                  source_client_id: Optional[str] = None) -> Optional[ApiEvent]:
    """Append an event and fan it out to matching subscriptions. Never raises."""
    app = None
    try:
        from flask import current_app
        app = current_app._get_current_object()
    except Exception:
        return None

    try:
        event = ApiEvent(
            type=event_type,
            subject_type=subject_type,
            subject_id=str(subject_id) if subject_id is not None else None,
            payload=data or {},
            actor_user_id=actor_user_id,
            source_client_id=source_client_id,
        )
        db.session.add(event)
        db.session.commit()

        delivery_ids: List[str] = []
        subscriptions = WebhookSubscription.query.filter_by(status="active").all()
        for sub in subscriptions:
            if not sub.matches(event_type):
                continue
            delivery = WebhookDelivery(
                subscription_id=sub.id,
                event_id=event.id,
                status="pending",
                next_attempt_at=now_local(),
            )
            db.session.add(delivery)
            db.session.commit()
            delivery_ids.append(delivery.id)

        if delivery_ids:
            if _sync_mode():
                deliver_now(event.id, delivery_ids, app)
            else:
                threading.Thread(
                    target=_background_deliver,
                    args=(app, event.id, delivery_ids),
                    daemon=True,
                ).start()
        return event
    except Exception:
        logger.exception("publish_event_failed type=%s", event_type)
        try:
            db.session.rollback()
        except Exception:  # pragma: no cover
            pass
        return None


def _background_deliver(app, event_id: str, delivery_ids: List[str]) -> None:
    with app.app_context():
        try:
            deliver_now(event_id, delivery_ids, app)
        finally:
            db.session.remove()


def deliver_now(event_id: str, delivery_ids: List[str], app=None) -> None:
    """Attempt each pending delivery (with retries in async mode)."""
    if _delivery_disabled():
        return
    for delivery_id in delivery_ids:
        _deliver_with_retries(delivery_id, sync=_sync_mode())


def _deliver_with_retries(delivery_id: str, *, sync: bool) -> None:
    max_attempts = 1 if sync else _max_attempts()
    backoff = BACKOFF_SECONDS
    attempt = 0
    while attempt < max_attempts:
        attempt += 1
        ok, _retryable = _attempt_once(delivery_id, attempt)
        if ok:
            return
        if attempt >= max_attempts:
            _mark_failed(delivery_id, "max attempts exhausted")
            return
        delay = 0 if sync else backoff[min(attempt - 1, len(backoff) - 1)]
        if delay:
            time.sleep(delay)


def _attempt_once(delivery_id: str, attempt: int):
    delivery = WebhookDelivery.query.get(delivery_id)
    if delivery is None or delivery.status == "delivered":
        return True, False
    subscription = delivery.subscription
    event = delivery.event
    if subscription is None or event is None:
        _mark_failed(delivery_id, "subscription or event missing")
        return False, False

    body = json.dumps({
        "id": event.id,
        "type": event.type,
        "api_version": "v2",
        "created_at": event.created_at.isoformat() if event.created_at else None,
        "subject": {"type": event.subject_type, "id": event.subject_id},
        "data": event.payload or {},
    }, default=str)

    try:
        assert_delivery_target_allowed(subscription.url)
    except WebhookUrlRejected as exc:
        _record_failure(delivery, attempt, None, f"url rejected: {exc}", None)
        return False, False  # do not retry blocked URLs

    timestamp = int(time.time())
    signature = hmac.new(
        (subscription.secret or "").encode("utf-8"),
        f"{timestamp}.{body}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    try:
        response = requests.post(
            subscription.url,
            data=body.encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "User-Agent": USER_AGENT,
                "X-ATB-Event-Id": event.id,
                "X-ATB-Event-Type": event.type,
                "X-ATB-Delivery-Id": delivery.id,
                "X-ATB-Attempt": str(attempt),
                "X-ATB-Signature": f"t={timestamp},v1={signature}",
            },
            timeout=TIMEOUT_SECONDS,
            allow_redirects=False,
        )
    except Exception as exc:
        _record_failure(delivery, attempt, None, str(exc)[:400], None)
        return False, True

    delivery = WebhookDelivery.query.get(delivery_id)  # refresh
    delivery.attempts = attempt
    delivery.response_status = response.status_code
    delivery.last_attempt_at = now_local()
    subscription.last_delivery_at = now_local()

    if 200 <= response.status_code < 300:
        delivery.status = "delivered"
        delivery.delivered_at = now_local()
        delivery.last_error = None
        delivery.next_attempt_at = None
        db.session.commit()
        return True, False

    _record_failure(delivery, attempt, response.status_code,
                    f"HTTP {response.status_code}", None)
    return False, True


def _record_failure(delivery: WebhookDelivery, attempt: int,
                    status: Optional[int], error: str, next_attempt_at) -> None:
    delivery.attempts = attempt
    delivery.response_status = status
    delivery.last_error = error[:500]
    delivery.last_attempt_at = now_local()
    delivery.status = "failed" if attempt >= _max_attempts() else "pending"
    delivery.next_attempt_at = next_attempt_at
    try:
        db.session.commit()
    except Exception:  # pragma: no cover
        db.session.rollback()


def _mark_failed(delivery_id: str, reason: str) -> None:
    delivery = WebhookDelivery.query.get(delivery_id)
    if delivery is None:
        return
    delivery.status = "failed"
    delivery.last_error = (reason or "failed")[:500]
    delivery.next_attempt_at = None
    try:
        db.session.commit()
    except Exception:  # pragma: no cover
        db.session.rollback()


def replay_delivery(delivery_id: str) -> WebhookDelivery:
    """Manual replay (``POST /api/v2/webhooks/deliveries/{id}/replay``)."""
    delivery = WebhookDelivery.query.get(delivery_id)
    if delivery is None:
        return None
    delivery.status = "pending"
    delivery.next_attempt_at = now_local()
    db.session.commit()
    app = None
    try:
        from flask import current_app
        app = current_app._get_current_object()
    except Exception:
        pass
    if _sync_mode() or app is None:
        _deliver_with_retries(delivery.id, sync=True)
    else:
        threading.Thread(target=_background_deliver,
                         args=(app, delivery.id, [delivery.id]),
                         daemon=True).start()
    db.session.refresh(delivery)
    return delivery


def verify_signature(secret: str, header: str, body: bytes,
                     tolerance: int = SIGNATURE_TOLERANCE_SECONDS) -> bool:
    """Reference verifier (also used by contract tests and developer docs)."""
    try:
        parts = dict(p.split("=", 1) for p in header.split(","))
        timestamp = int(parts["t"])
        received = parts["v1"]
    except (ValueError, KeyError):
        return False
    if abs(int(time.time()) - timestamp) > tolerance:
        return False
    expected = hmac.new(
        (secret or "").encode("utf-8"),
        f"{timestamp}.{body.decode('utf-8')}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, received)
