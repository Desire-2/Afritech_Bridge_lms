"""Admin operations: organization reports and integration credential management.

Credential administration is deliberately **admin-JWT-only** (no API key): a
compromised API key can never mint or revoke credentials. Every mutation is
written to the ``api_audit_log``.
"""

from __future__ import annotations

from datetime import datetime

from flask import g, request

from ...models.course_models import Course, Enrollment
from ...models.course_application import CourseApplication
from ...models.integration_models import (ApiAuditLog, ApiClient, ApiKey)
from ...models.user_models import db
from .. import api_bp
from ..auth import current_user, require
from ..constants import SCOPES
from ..errors import ApiError, conflict, not_found, validation_error
from ..pagination import paginate_query
from ..responses import created, no_content, ok, paginated
from ..serialization import isoify, serialize_application, serialize_enrollment
from ...utils.time_utils import to_local


def _audit(action: str, *, target_type=None, target_id=None, detail=None):
    user = current_user()
    ApiAuditLog.record(
        action,
        actor_type="user",
        actor_id=str(user.id),
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        request_id=getattr(g, "request_id", None),
        ip_address=request.remote_addr,
        detail=detail,
    )


# ── Reports ────────────────────────────────────────────────────────────────

@api_bp.route("/admin/stats", methods=["GET"])
@require(scopes=["reports:read"], roles=["admin"], user=True)
def admin_stats():
    """Platform statistics (exact payload of the legacy admin dashboard)."""
    from ..dispatch import dispatch
    return dispatch("admin_routes.get_system_stats")


@api_bp.route("/admin/enrollments", methods=["GET"])
@require(scopes=["reports:read"], roles=["admin"], user=True)
def admin_enrollments():
    """All enrollments (filterable, paginated)."""
    query = Enrollment.query
    status = (request.args.get("status") or "").strip()
    if status:
        query = query.filter_by(status=status)
    course_id = request.args.get("course_id")
    if course_id:
        try:
            query = query.filter_by(course_id=int(course_id))
        except (TypeError, ValueError):
            raise validation_error("Invalid course_id filter.",
                                   [{"field": "course_id", "issue": "must be an integer"}])
    items, pagination = paginate_query(
        query.order_by(Enrollment.id.desc()), args=request.args)
    return paginated([serialize_enrollment(e) for e in items], pagination)


@api_bp.route("/admin/applications", methods=["GET"])
@require(scopes=["reports:read"], roles=["admin"], user=True)
def admin_applications():
    """All course applications (filterable, paginated)."""
    query = CourseApplication.query
    status = (request.args.get("status") or "").strip()
    if status:
        query = query.filter_by(status=status)
    course_id = request.args.get("course_id")
    if course_id:
        try:
            query = query.filter_by(course_id=int(course_id))
        except (TypeError, ValueError):
            raise validation_error("Invalid course_id filter.",
                                   [{"field": "course_id", "issue": "must be an integer"}])
    items, pagination = paginate_query(
        query.order_by(CourseApplication.id.desc()), args=request.args)
    return paginated(
        [serialize_application(a, include_sensitive=False) for a in items],
        pagination,
    )


# ── Integration clients ────────────────────────────────────────────────────

@api_bp.route("/admin/integration-clients", methods=["GET"])
@require(scopes=[], roles=["admin"], user=True, api_key=False)
def list_clients():
    """All integration clients (admin session only)."""
    query = ApiClient.query.order_by(ApiClient.created_at.desc())
    items, pagination = paginate_query(query, args=request.args)
    return paginated([c.to_dict(include_keys=True) for c in items], pagination)


@api_bp.route("/admin/integration-clients", methods=["POST"])
@require(scopes=[], roles=["admin"], user=True, api_key=False)
def create_client():
    """Create an integration client. No key is issued — issue one next."""
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        raise validation_error("The request contains missing required fields.",
                               [{"field": "name", "issue": "required"}])

    slug = (body.get("slug") or ApiClient.slugify(name)).strip().lower()
    if ApiClient.query.filter_by(slug=slug).first() is not None:
        raise conflict("CONFLICT", "A client with this slug already exists.",
                       [{"field": "slug", "issue": "already in use"}])

    user = current_user()
    client = ApiClient(
        name=name[:160],
        slug=slug,
        contact_email=(body.get("contact_email") or None),
        description=(body.get("description") or None),
        created_by=user.id,
    )
    db.session.add(client)
    _audit("api_client.created", target_type="api_client",
           target_id=client.id, detail={"slug": slug})
    db.session.commit()
    return created(client.to_dict(), location=f"/api/v2/admin/integration-clients/{client.id}")


@api_bp.route("/admin/integration-clients/<client_id>", methods=["GET"])
@require(scopes=[], roles=["admin"], user=True, api_key=False)
def get_client(client_id: str):
    """Read one integration client (including its keys' metadata)."""
    client = db.session.get(ApiClient, client_id)
    if client is None:
        raise not_found("Integration client not found.")
    return ok(client.to_dict(include_keys=True))


@api_bp.route("/admin/integration-clients/<client_id>", methods=["PATCH"])
@require(scopes=[], roles=["admin"], user=True, api_key=False)
def update_client(client_id: str):
    """Enable/disable a client or update its metadata."""
    client = db.session.get(ApiClient, client_id)
    if client is None:
        raise not_found("Integration client not found.")
    body = request.get_json(silent=True) or {}
    changed = {}
    for field in ("name", "contact_email", "description"):
        if field in body:
            setattr(client, field, (body.get(field) or None) if field != "name"
                    else (body.get(field) or client.name)[:160])
            changed[field] = body.get(field)
    status = body.get("status")
    if status is not None:
        if status not in ("active", "disabled"):
            raise validation_error("Invalid status.",
                                   [{"field": "status", "issue": "must be active or disabled"}])
        client.status = status
        from ...utils.time_utils import now_local
        client.disabled_at = None if status == "active" else now_local()
        changed["status"] = status
    _audit("api_client.updated", target_type="api_client", target_id=client.id,
           detail=changed)
    db.session.commit()
    return ok(client.to_dict(include_keys=True))


@api_bp.route("/admin/integration-clients/<client_id>/keys", methods=["POST"])
@require(scopes=[], roles=["admin"], user=True, api_key=False)
def issue_key(client_id: str):
    """Issue an API key. The secret is returned exactly once, here."""
    client = db.session.get(ApiClient, client_id)
    if client is None:
        raise not_found("Integration client not found.")

    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "default")[:120]
    scopes = body.get("scopes") or []
    if not isinstance(scopes, list) or not all(isinstance(s, str) for s in scopes):
        raise validation_error("Invalid scopes.",
                               [{"field": "scopes", "issue": "must be a list of strings"}])
    unknown = sorted(set(scopes) - set(SCOPES.keys()))
    if unknown:
        raise validation_error("Invalid scopes.",
                               [{"field": "scopes",
                                 "issue": f"unknown scopes: {', '.join(unknown)}"}])

    expires_at = None
    if body.get("expires_at"):
        try:
            expires_at = to_local(datetime.fromisoformat(
                str(body["expires_at"]).replace("Z", "+00:00")))
        except ValueError:
            raise validation_error("Invalid expires_at.",
                                   [{"field": "expires_at",
                                     "issue": "must be an ISO-8601 timestamp"}])

    user = current_user()
    key_row, secret = ApiKey.issue(
        client.id, name=name, scopes=scopes, expires_at=expires_at,
        created_by=user.id)
    db.session.add(key_row)
    _audit("api_key.issued", target_type="api_key", target_id=key_row.id,
           detail={"client_id": client.id, "scopes": scopes, "name": name})
    db.session.commit()

    payload = key_row.to_dict()
    payload["secret"] = secret  # shown once — never retrievable again
    payload["warning"] = "Store this secret now; it cannot be retrieved again."
    return created(payload,
                   location=f"/api/v2/admin/integration-clients/{client.id}")


@api_bp.route("/admin/integration-clients/<client_id>/keys/<key_id>",
              methods=["DELETE"])
@require(scopes=[], roles=["admin"], user=True, api_key=False)
def revoke_key(client_id: str, key_id: str):
    """Revoke an API key immediately."""
    key_row = db.session.get(ApiKey, key_id)
    if key_row is None or key_row.client_id != client_id:
        raise not_found("API key not found.")
    if key_row.revoked_at is None:
        from ...utils.time_utils import now_local
        key_row.revoked_at = now_local()
        _audit("api_key.revoked", target_type="api_key", target_id=key_row.id,
               detail={"client_id": client_id})
        db.session.commit()
    return no_content()
