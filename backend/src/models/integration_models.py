"""Integration-layer models: external API credentials, outbound webhooks,
event log, idempotency keys and audit trail.

These tables are additive — no existing table is modified. They are created by
the Alembic revision ``add_integration_tables`` and are also covered by the
boot-time ``db.metadata.create_all(checkfirst=True)`` bootstrap in ``main.py``.

Security notes
-------------
* ``ApiKey.key_hash`` stores the SHA-256 of the full secret; the secret itself
  is returned exactly once, at creation time. ``key_prefix`` exists only to
  locate a candidate row without an unbounded scan; verification is a constant
  time digest comparison.
* ``WebhookSubscription.secret`` must remain recoverable because it is the HMAC
  signing key for every delivery; it is returned once (creation / rotation) and
  never again by any read endpoint.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import uuid
from datetime import datetime
from typing import Iterable, List, Optional

from ..models.user_models import db
from ..utils.time_utils import now_local

KEY_PREFIX = "atb_sk_"
SECRET_PREFIX = "whsec_"


def _uuid() -> str:
    return uuid.uuid4().hex


def _new_api_key_secret() -> str:
    """Full API key secret: ``atb_sk_`` + 40 url-safe random chars."""
    return KEY_PREFIX + secrets.token_urlsafe(30)[:40]


def _new_webhook_secret() -> str:
    return SECRET_PREFIX + secrets.token_urlsafe(32)[:40]


def hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def verify_secret(secret: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_secret(secret), stored_hash or "")


class ApiClient(db.Model):
    """An external integration (main website backend, jobs portal, mobile BFF…).

    One client owns many API keys. Clients are created and disabled by
    administrators only — API keys can never mint or revoke credentials.
    """

    __tablename__ = "api_clients"

    id = db.Column(db.String(32), primary_key=True, default=_uuid)
    name = db.Column(db.String(160), nullable=False)
    slug = db.Column(db.String(80), unique=True, nullable=False, index=True)
    contact_email = db.Column(db.String(255), nullable=True)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default="active", index=True)
    created_by = db.Column(db.Integer, nullable=True)  # user id of the admin
    created_at = db.Column(db.DateTime, nullable=False, default=now_local)
    updated_at = db.Column(db.DateTime, nullable=False, default=now_local,
                           onupdate=now_local)
    disabled_at = db.Column(db.DateTime, nullable=True)

    keys = db.relationship("ApiKey", backref="client", lazy="select",
                           cascade="all, delete-orphan",
                           order_by="ApiKey.created_at.desc()")

    def is_active(self) -> bool:
        return self.status == "active"

    def to_dict(self, include_keys: bool = False) -> dict:
        data = {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "contact_email": self.contact_email,
            "description": self.description,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "disabled_at": self.disabled_at.isoformat() if self.disabled_at else None,
        }
        if include_keys:
            data["keys"] = [k.to_dict() for k in self.keys]
        return data

    @staticmethod
    def slugify(name: str) -> str:
        cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in (name or ""))
        cleaned = "-".join(part for part in cleaned.split("-") if part)[:64]
        return cleaned or "client"


class ApiKey(db.Model):
    """A revocable, scoped, expiring credential belonging to an :class:`ApiClient`."""

    __tablename__ = "api_keys"

    id = db.Column(db.String(32), primary_key=True, default=_uuid)
    client_id = db.Column(db.String(32), db.ForeignKey("api_clients.id"),
                          nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False, default="default")
    key_prefix = db.Column(db.String(20), unique=True, nullable=False, index=True)
    key_hash = db.Column(db.String(64), nullable=False)
    scopes = db.Column(db.JSON, nullable=False, default=list)
    created_by = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=now_local)
    expires_at = db.Column(db.DateTime, nullable=True)
    revoked_at = db.Column(db.DateTime, nullable=True)
    last_used_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self) -> dict:
        """Never includes the secret or the hash."""
        return {
            "id": self.id,
            "client_id": self.client_id,
            "name": self.name,
            "prefix": self.key_prefix,
            "scopes": list(self.scopes or []),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "revoked_at": self.revoked_at.isoformat() if self.revoked_at else None,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
            "status": self.status(),
        }

    def status(self) -> str:
        if self.revoked_at:
            return "revoked"
        if self.expires_at and self.expires_at < now_local():
            return "expired"
        return "active"

    def is_active(self) -> bool:
        return self.status() == "active"

    def has_scope(self, scope: str) -> bool:
        return scope in (self.scopes or [])

    def allows_scopes(self, scopes: Iterable[str]) -> bool:
        granted = set(self.scopes or [])
        return all(scope in granted for scope in scopes)

    @staticmethod
    def issue(client_id: str, *, name: str = "default",
              scopes: Optional[List[str]] = None,
              expires_at: Optional[datetime] = None,
              created_by: Optional[int] = None):
        """Create an :class:`ApiKey` row and return ``(row, full_secret)``.

        The secret is available only from this return value.
        """
        secret = _new_api_key_secret()
        prefix = secret[:len(KEY_PREFIX) + 8]
        # Guard against the astronomically unlikely prefix collision.
        while ApiKey.query.filter_by(key_prefix=prefix).first() is not None:
            secret = _new_api_key_secret()
            prefix = secret[:len(KEY_PREFIX) + 8]
        row = ApiKey(
            client_id=client_id,
            name=name,
            key_prefix=prefix,
            key_hash=hash_secret(secret),
            scopes=list(scopes or []),
            expires_at=expires_at,
            created_by=created_by,
        )
        return row, secret

    @staticmethod
    def authenticate(secret: Optional[str]):
        """Resolve a raw key secret to ``(key, client)`` or ``(None, None)``.

        Performs prefix lookup, digest comparison, revocation/expiry checks and
        client status checks. Never raises on malformed input.
        """
        if not secret or not isinstance(secret, str):
            return None, None
        if not secret.startswith(KEY_PREFIX):
            return None, None
        prefix = secret[:len(KEY_PREFIX) + 8]
        key = ApiKey.query.filter_by(key_prefix=prefix).first()
        if key is None or not verify_secret(secret, key.key_hash):
            return None, None
        if not key.is_active():
            return None, None
        client = key.client
        if client is None or not client.is_active():
            return None, None
        return key, client


class ApiEvent(db.Model):
    """Append-only integration event log (webhook source + reconciliation)."""

    __tablename__ = "api_events"

    id = db.Column(db.String(32), primary_key=True, default=_uuid)
    type = db.Column(db.String(80), nullable=False, index=True)
    subject_type = db.Column(db.String(40), nullable=True)
    subject_id = db.Column(db.String(32), nullable=True, index=True)
    payload = db.Column(db.JSON, nullable=False, default=dict)
    actor_user_id = db.Column(db.Integer, nullable=True)
    source_client_id = db.Column(db.String(32), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=now_local, index=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "subject": {"type": self.subject_type, "id": self.subject_id},
            "data": self.payload or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class WebhookSubscription(db.Model):
    """Outbound webhook endpoint registered by an integration client."""

    __tablename__ = "webhook_subscriptions"

    id = db.Column(db.String(32), primary_key=True, default=_uuid)
    client_id = db.Column(db.String(32), db.ForeignKey("api_clients.id"),
                          nullable=False, index=True)
    url = db.Column(db.String(500), nullable=False)
    events = db.Column(db.JSON, nullable=False, default=list)  # ["*"] or types
    secret = db.Column(db.String(80), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="active", index=True)
    description = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=now_local)
    updated_at = db.Column(db.DateTime, nullable=False, default=now_local,
                           onupdate=now_local)
    disabled_at = db.Column(db.DateTime, nullable=True)
    last_delivery_at = db.Column(db.DateTime, nullable=True)

    def matches(self, event_type: str) -> bool:
        subscribed = self.events or []
        return "*" in subscribed or event_type in subscribed

    def rotate_secret(self) -> str:
        self.secret = _new_webhook_secret()
        return self.secret

    @staticmethod
    def create_subscription(client_id: str, url: str, events: List[str],
                            description: Optional[str] = None):
        row = WebhookSubscription(
            client_id=client_id, url=url, events=list(events),
            secret=_new_webhook_secret(), description=description,
        )
        return row

    def to_dict(self) -> dict:
        """Never includes the signing secret."""
        return {
            "id": self.id,
            "client_id": self.client_id,
            "url": self.url,
            "events": list(self.events or []),
            "status": self.status,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "disabled_at": self.disabled_at.isoformat() if self.disabled_at else None,
            "last_delivery_at": self.last_delivery_at.isoformat() if self.last_delivery_at else None,
        }


class WebhookDelivery(db.Model):
    """One delivery attempt lifecycle for (subscription, event)."""

    __tablename__ = "webhook_deliveries"

    id = db.Column(db.String(32), primary_key=True, default=_uuid)
    subscription_id = db.Column(db.String(32), db.ForeignKey("webhook_subscriptions.id"),
                                nullable=False, index=True)
    event_id = db.Column(db.String(32), db.ForeignKey("api_events.id"),
                         nullable=False, index=True)
    status = db.Column(db.String(20), nullable=False, default="pending", index=True)
    attempts = db.Column(db.Integer, nullable=False, default=0)
    response_status = db.Column(db.Integer, nullable=True)
    last_error = db.Column(db.String(500), nullable=True)
    next_attempt_at = db.Column(db.DateTime, nullable=True, index=True)
    last_attempt_at = db.Column(db.DateTime, nullable=True)
    delivered_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=now_local, index=True)

    subscription = db.relationship("WebhookSubscription", backref="deliveries",
                                   lazy="select")
    event = db.relationship("ApiEvent", backref="deliveries", lazy="select")

    def to_dict(self, include_payload: bool = False) -> dict:
        data = {
            "id": self.id,
            "subscription_id": self.subscription_id,
            "event_id": self.event_id,
            "event_type": self.event.type if self.event else None,
            "status": self.status,
            "attempts": self.attempts,
            "response_status": self.response_status,
            "last_error": self.last_error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_attempt_at": self.last_attempt_at.isoformat() if self.last_attempt_at else None,
            "delivered_at": self.delivered_at.isoformat() if self.delivered_at else None,
            "next_attempt_at": self.next_attempt_at.isoformat() if self.next_attempt_at else None,
        }
        if include_payload:
            data["payload"] = (self.event.to_dict() if self.event else None)
        return data


class ApiIdempotencyKey(db.Model):
    """Stored 2xx responses for retryable POSTs (``Idempotency-Key`` header)."""

    __tablename__ = "api_idempotency_keys"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    scope_key = db.Column(db.String(200), nullable=False, index=True)
    idempotency_key = db.Column(db.String(120), nullable=False)
    request_hash = db.Column(db.String(64), nullable=False)
    response_status = db.Column(db.Integer, nullable=False)
    response_body = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=now_local, index=True)

    __table_args__ = (
        db.UniqueConstraint("scope_key", "idempotency_key", name="uq_api_idem_scope_key"),
    )

    RETENTION_DAYS = 24

    @staticmethod
    def find(scope_key: str, idempotency_key: str):
        return ApiIdempotencyKey.query.filter_by(
            scope_key=scope_key, idempotency_key=idempotency_key
        ).first()

    @staticmethod
    def purge_old() -> int:
        cutoff = now_local()
        from datetime import timedelta
        cutoff = cutoff - timedelta(days=ApiIdempotencyKey.RETENTION_DAYS)
        deleted = ApiIdempotencyKey.query.filter(
            ApiIdempotencyKey.created_at < cutoff
        ).delete(synchronize_session=False)
        return deleted or 0


class ApiAuditLog(db.Model):
    """Audit trail for credential and webhook administration."""

    __tablename__ = "api_audit_log"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    action = db.Column(db.String(80), nullable=False, index=True)
    actor_type = db.Column(db.String(20), nullable=False)  # user | api_key
    actor_id = db.Column(db.String(64), nullable=True)
    target_type = db.Column(db.String(40), nullable=True)
    target_id = db.Column(db.String(64), nullable=True)
    request_id = db.Column(db.String(36), nullable=True)
    ip_address = db.Column(db.String(64), nullable=True)
    detail = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=now_local, index=True)

    @staticmethod
    def record(action: str, *, actor_type: str, actor_id: Optional[str] = None,
               target_type: Optional[str] = None, target_id: Optional[str] = None,
               request_id: Optional[str] = None, ip_address: Optional[str] = None,
               detail: Optional[dict] = None) -> "ApiAuditLog":
        row = ApiAuditLog(
            action=action, actor_type=actor_type, actor_id=actor_id,
            target_type=target_type, target_id=target_id,
            request_id=request_id, ip_address=ip_address, detail=detail,
        )
        db.session.add(row)
        return row

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "action": self.action,
            "actor": {"type": self.actor_type, "id": self.actor_id},
            "target": {"type": self.target_type, "id": self.target_id},
            "request_id": self.request_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


__all__ = [
    "ApiClient", "ApiKey", "ApiEvent", "WebhookSubscription", "WebhookDelivery",
    "ApiIdempotencyKey", "ApiAuditLog", "hash_secret", "verify_secret",
    "KEY_PREFIX", "SECRET_PREFIX",
]
