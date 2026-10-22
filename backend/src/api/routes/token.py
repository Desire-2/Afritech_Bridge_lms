"""``POST /api/v2/auth/token`` — OAuth2-style password & refresh grants for
integration clients.

Unlike ``/api/v1/auth/login`` (user-only), this endpoint requires **client
credentials** (the integration's API key) in addition to user credentials, and
grants a narrower, auditable path for partners to mint short-lived user
tokens. Refresh tokens minted here carry a ``cid`` claim binding them to the
client that created them — a stolen refresh token cannot be redeemed by a
different client.
"""

from __future__ import annotations

import os
from datetime import timedelta

from flask import request
from flask_jwt_extended import create_access_token, create_refresh_token, decode_token
from sqlalchemy import func

from ...models.user_models import User, db
from .. import api_bp
from ..auth import authenticate_client_credentials, require
from ..errors import ApiError, unauthenticated, validation_error
from ..idempotency import idempotent
from ..responses import ok


def _access_delta() -> timedelta:
    try:
        return timedelta(hours=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_HOURS", "1")))
    except ValueError:
        return timedelta(hours=1)


def _refresh_delta() -> timedelta:
    try:
        return timedelta(days=int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", "30")))
    except ValueError:
        return timedelta(days=30)


def _client_secret_from_request(body) -> str:
    header_key = request.headers.get("X-API-Key")
    return (body.get("client_secret") or header_key or "").strip()


def _issue_tokens(user, client_id):
    claims = {"cid": client_id}
    access = create_access_token(
        identity=str(user.id), fresh=True, expires_delta=_access_delta(),
        additional_claims=claims,
    )
    refresh = create_refresh_token(
        identity=str(user.id), expires_delta=_refresh_delta(),
        additional_claims=claims,
    )
    return access, refresh


def _resolve_user_credentials(body):
    identifier = (body.get("username") or body.get("email") or "").strip()
    password = body.get("password") or ""
    if not identifier or not password:
        raise validation_error("The request contains missing required fields.", [
            {"field": "username", "issue": "required (or email)"},
            {"field": "password", "issue": "required"},
        ])
    normalized = identifier.lower()
    user = User.query.filter(
        (User.username == identifier)
        | (func.lower(func.trim(User.email)) == normalized)
    ).first()
    if user is None or not user.check_password(password):
        raise unauthenticated("Invalid user credentials.",
                              details=[{"field": "password", "issue": "invalid"}])
    if not user.is_active:
        raise unauthenticated("This account is deactivated.")
    return user


def _resolve_refresh_token(body, client_id):
    token = (body.get("refresh_token") or "").strip()
    if not token:
        raise validation_error("The request contains missing required fields.", [
            {"field": "refresh_token", "issue": "required"},
        ])
    try:
        payload = decode_token(token)
    except Exception:
        raise unauthenticated("The refresh token is invalid or expired.")
    if payload.get("type") != "refresh":
        raise validation_error("The supplied token is not a refresh token.")
    token_cid = payload.get("cid")
    if token_cid and token_cid != client_id:
        raise unauthenticated(
            "This refresh token was issued to a different API client.")
    user = db.session.get(User, int(payload["sub"])) if payload.get("sub") else None
    if user is None or not user.is_active:
        raise unauthenticated("The account for this token no longer exists or is deactivated.")
    return user


@api_bp.route("/auth/token", methods=["POST"])
@idempotent
def issue_token():
    """Mint user access/refresh tokens for an integration client.

    Body: ``grant_type`` (``password`` or ``refresh_token``), client secret in
    ``client_secret`` or the ``X-API-Key`` header, plus grant-specific fields.
    Requires the ``auth:token`` scope.
    """
    body = request.get_json(silent=True) or {}
    client_secret = _client_secret_from_request(body)
    client_id_hint = (body.get("client_id") or "").strip() or None

    key = authenticate_client_credentials(client_id_hint, client_secret)
    if not key.has_scope("auth:token"):
        raise ApiError("FORBIDDEN", "The API key does not carry the required scope(s).",
                       403, details=[{"missing_scopes": ["auth:token"]}])

    grant_type = (body.get("grant_type") or "").strip()
    if grant_type == "password":
        user = _resolve_user_credentials(body)
    elif grant_type == "refresh_token":
        user = _resolve_refresh_token(body, key.client_id)
    else:
        raise validation_error("Unsupported grant_type.", [
            {"field": "grant_type", "issue": "must be 'password' or 'refresh_token'"},
        ])

    access, refresh = _issue_tokens(user, key.client_id)
    return ok({
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "Bearer",
        "expires_in": int(_access_delta().total_seconds()),
        "scope": list(key.scopes or []),
        "client_id": key.client_id,
    })
