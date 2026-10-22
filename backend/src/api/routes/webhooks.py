"""Outbound webhook subscriptions and delivery management."""

from __future__ import annotations

from flask import g, request

from ...models.integration_models import (ApiAuditLog, WebhookDelivery,
                                          WebhookSubscription)
from ...models.user_models import db
from .. import api_bp
from ..auth import current_api_key, current_user, require
from ..constants import SUPPORTED_EVENT_TYPES
from ..errors import ApiError, forbidden, not_found, validation_error
from ..events import replay_delivery
from ..pagination import paginate_query
from ..responses import created, no_content, ok, paginated
from ..ssrf import WebhookUrlRejected, validate_webhook_url


def _own_client_id() -> str:
    key = current_api_key()
    if key is None:
        raise forbidden("Webhook management requires an API key.")
    return key.client_id


def _validate_events(events):
    if not isinstance(events, list) or not events:
        raise validation_error("Invalid events.",
                               [{"field": "events", "issue": "must be a non-empty list"}])
    if not all(isinstance(e, str) for e in events):
        raise validation_error("Invalid events.",
                               [{"field": "events", "issue": "must be strings"}])
    unknown = sorted({e for e in events if e != "*" and e not in SUPPORTED_EVENT_TYPES})
    if unknown:
        raise validation_error("Invalid events.",
                               [{"field": "events",
                                 "issue": f"unsupported event types: {', '.join(unknown)}"}])
    return events


def _audit(action: str, *, target_type=None, target_id=None, detail=None):
    user = getattr(g, "user", None)
    ApiAuditLog.record(
        action,
        actor_type="user" if user else "api_key",
        actor_id=str(user.id if user else (current_api_key().id if current_api_key() else "")),
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        request_id=getattr(g, "request_id", None),
        ip_address=request.remote_addr,
        detail=detail,
    )


@api_bp.route("/webhooks/subscriptions", methods=["GET"])
@require(scopes=["webhooks:manage"], user=True)
def list_subscriptions():
    """Webhook subscriptions belonging to the calling API key's client."""
    client_id = _own_client_id()
    query = WebhookSubscription.query.filter_by(client_id=client_id) \
        .order_by(WebhookSubscription.created_at.desc())
    items, pagination = paginate_query(query, args=request.args)
    return paginated([s.to_dict() for s in items], pagination)


@api_bp.route("/webhooks/subscriptions", methods=["POST"])
@require(scopes=["webhooks:manage"], user=True)
def create_subscription():
    """Register a webhook endpoint. The signing secret is returned once."""
    client_id = _own_client_id()
    body = request.get_json(silent=True) or {}
    url = (body.get("url") or "").strip()
    try:
        validate_webhook_url(url)
    except WebhookUrlRejected as exc:
        raise validation_error(exc.message, [{"field": "url", "issue": exc.message}])

    events = _validate_events(body.get("events"))
    subscription = WebhookSubscription.create_subscription(
        client_id, url, events, description=(body.get("description") or None))
    db.session.add(subscription)
    _audit("webhook_subscription.created", target_type="webhook_subscription",
           target_id=subscription.id, detail={"url": url, "events": events})
    db.session.commit()

    payload = subscription.to_dict()
    payload["secret"] = subscription.secret  # shown once
    payload["warning"] = "Store this signing secret now; it cannot be retrieved again."
    return created(payload,
                   location=f"/api/v2/webhooks/subscriptions/{subscription.id}")


@api_bp.route("/webhooks/subscriptions/<subscription_id>", methods=["GET"])
@require(scopes=["webhooks:manage"], user=True)
def get_subscription(subscription_id: str):
    """Read one of your subscriptions (never includes the secret)."""
    subscription = _own_or_403(subscription_id)
    return ok(subscription.to_dict())


def _own_or_403(subscription_id: str) -> WebhookSubscription:
    subscription = db.session.get(WebhookSubscription, subscription_id)
    if subscription is None:
        raise not_found("Webhook subscription not found.")
    if subscription.client_id != _own_client_id():
        raise forbidden("This subscription belongs to a different client.")
    return subscription


@api_bp.route("/webhooks/subscriptions/<subscription_id>", methods=["DELETE"])
@require(scopes=["webhooks:manage"], user=True)
def disable_subscription(subscription_id: str):
    """Disable a subscription (soft delete — deliveries stop immediately)."""
    subscription = _own_or_403(subscription_id)
    if subscription.status != "disabled":
        from ...utils.time_utils import now_local
        subscription.status = "disabled"
        subscription.disabled_at = now_local()
        _audit("webhook_subscription.disabled",
               target_type="webhook_subscription", target_id=subscription.id)
        db.session.commit()
    return no_content()


@api_bp.route("/webhooks/subscriptions/<subscription_id>/rotate-secret",
              methods=["POST"])
@require(scopes=["webhooks:manage"], user=True)
def rotate_secret(subscription_id: str):
    """Rotate the signing secret. The new value is returned once."""
    subscription = _own_or_403(subscription_id)
    new_secret = subscription.rotate_secret()
    _audit("webhook_subscription.secret_rotated",
           target_type="webhook_subscription", target_id=subscription.id)
    db.session.commit()
    payload = subscription.to_dict()
    payload["secret"] = new_secret
    payload["warning"] = "Store this signing secret now; it cannot be retrieved again."
    return ok(payload)


@api_bp.route("/webhooks/deliveries", methods=["GET"])
@require(scopes=["webhooks:manage"], user=True)
def list_deliveries():
    """Delivery attempts for your subscriptions (reconciliation aid)."""
    client_id = _own_client_id()
    sub_ids = [row[0] for row in WebhookSubscription.query
               .with_entities(WebhookSubscription.id)
               .filter_by(client_id=client_id).all()]
    query = WebhookDelivery.query
    if sub_ids:
        query = query.filter(WebhookDelivery.subscription_id.in_(sub_ids))
    else:
        query = query.filter(WebhookDelivery.id.is_(None))
    status = (request.args.get("status") or "").strip()
    if status:
        if status not in ("pending", "delivered", "failed"):
            raise validation_error("Invalid status filter.",
                                   [{"field": "status",
                                     "issue": "must be pending, delivered or failed"}])
        query = query.filter_by(status=status)
    items, pagination = paginate_query(
        query.order_by(WebhookDelivery.created_at.desc(), WebhookDelivery.id.desc()),
        args=request.args)
    include_payload = request.args.get("include_payload") == "true"
    return paginated([d.to_dict(include_payload=include_payload) for d in items],
                     pagination)


@api_bp.route("/webhooks/deliveries/<delivery_id>/replay", methods=["POST"])
@require(scopes=["webhooks:manage"], user=True)
def replay(delivery_id: str):
    """Replay one delivery attempt immediately."""
    delivery = db.session.get(WebhookDelivery, delivery_id)
    if delivery is None:
        raise not_found("Delivery not found.")
    subscription = db.session.get(WebhookSubscription, delivery.subscription_id)
    if subscription is None or subscription.client_id != _own_client_id():
        raise forbidden("This delivery belongs to a different client.")

    replayed = replay_delivery(delivery_id)
    if replayed is None:
        raise not_found("Delivery not found.")
    _audit("webhook_delivery.replayed", target_type="webhook_delivery",
           target_id=delivery_id)
    db.session.commit()
    return ok(replayed.to_dict(include_payload=True))
