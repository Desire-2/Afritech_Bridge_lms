"""Authentication & authorization for the /api/v2 integration API.

Two credentials:

* **API key** (``X-API-Key: atb_sk_…``) — identifies the integration client.
  Required on every non-public endpoint together with the endpoint's scopes.
* **User JWT** (``Authorization: Bearer <access token>``) — identifies the
  person the request acts on. Tokens are the platform's existing JWTs
  (``POST /api/v1/auth/login`` or ``POST /api/v2/auth/token``).

The API-key resolution runs in a blueprint ``before_request`` hook (so an
invalid key presented to a *public* endpoint is still a 401), while
``require(...)`` enforces per-endpoint scopes, user presence and roles.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from functools import wraps
from typing import List, Optional, Sequence

from flask import g, request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from ..models.integration_models import ApiKey
from ..models.user_models import User
from ..utils.time_utils import now_local
from .errors import forbidden, unauthenticated

logger = logging.getLogger("api.v2.auth")

LAST_USED_THROTTLE = timedelta(minutes=5)


def api_key_secret_from_request() -> Optional[str]:
    secret = request.headers.get("X-API-Key")
    if secret:
        return secret.strip()
    return None


def resolve_api_key() -> None:
    """Populate ``g.api_key`` / ``g.api_client``; raise 401 on an invalid key.

    Called for every v2 request. A missing key leaves ``g.api_key = None`` —
    endpoint decorators decide whether that is acceptable.
    """
    secret = api_key_secret_from_request()
    if not secret:
        g.api_key = None
        g.api_client = None
        return

    key, client = ApiKey.authenticate(secret)
    if key is None:
        logger.info(
            "api_key_auth_failed request_id=%s ip=%s",
            getattr(g, "request_id", "-"), request.remote_addr,
        )
        raise unauthenticated(
            "The API key is invalid, has been revoked or expired, or its client is disabled.",
            details=[{"header": "X-API-Key", "issue": "invalid credentials"}],
        )
    g.api_key = key
    g.api_client = client
    _touch_last_used(key)


def _touch_last_used(key: ApiKey) -> None:
    try:
        now = now_local()
        if key.last_used_at is None or (now - key.last_used_at) > LAST_USED_THROTTLE:
            key.last_used_at = now
    except Exception:  # pragma: no cover - telemetry must never break a request
        pass


def authenticate_client_credentials(client_id: Optional[str], client_secret: Optional[str]) -> ApiKey:
    """Validate ``client_id``/``client_secret`` for the token endpoint.

    The client secret *is* the API key secret. Returns the matching active
    :class:`ApiKey` or raises 401.
    """
    if not client_secret:
        raise unauthenticated(
            "Client authentication failed.",
            details=[{"field": "client_secret", "issue": "required (your API key secret)"}],
        )
    key, client = ApiKey.authenticate(client_secret)
    if key is None:
        raise unauthenticated("Client authentication failed.",
                              details=[{"field": "client_secret", "issue": "invalid"}])
    if client_id and client.id != client_id:
        raise unauthenticated("Client authentication failed.",
                              details=[{"field": "client_id", "issue": "does not match the secret"}])
    return key


def resolve_user(required: bool, roles: Optional[Sequence[str]] = None) -> Optional[User]:
    """Resolve the optional/required user JWT into ``g.user``."""
    try:
        verify_jwt_in_request(optional=not required)
    except Exception as exc:  # expired, revoked, malformed, missing
        logger.info("user_jwt_failed request_id=%s reason=%s",
                    getattr(g, "request_id", "-"), type(exc).__name__)
        raise unauthenticated(
            "A valid user access token is required (Authorization: Bearer <token>).",
            details=[{"header": "Authorization", "issue": "missing, expired or revoked token"}],
        )

    identity = get_jwt_identity()
    if identity in (None, ""):
        if required:
            raise unauthenticated("A valid user access token is required.")
        g.user = None
        return None

    try:
        user_id = int(identity)
    except (TypeError, ValueError):
        raise unauthenticated("A valid user access token is required.")

    user = _load_user(user_id)
    if user is None or not user.is_active:
        raise unauthenticated("The account for this token no longer exists or is deactivated.")

    if roles:
        role_name = (user.role.name if user.role else "") or ""
        allowed = {r.lower() for r in roles}
        if role_name.lower() not in allowed:
            raise forbidden(
                "Your account role does not allow this operation.",
                details=[{"required_roles": sorted(allowed)}],
            )
    g.user = user
    return user


def _load_user(user_id: int) -> Optional[User]:
    from ..models.user_models import db
    return db.session.get(User, user_id)


def current_user() -> User:
    user = getattr(g, "user", None)
    if user is None:
        raise unauthenticated("A valid user access token is required.")
    return user


def current_api_key() -> Optional[ApiKey]:
    return getattr(g, "api_key", None)


def require(*, scopes: Sequence[str] = (), roles: Optional[Sequence[str]] = None,
            user: bool = True, api_key: bool = True):
    """Endpoint access decorator.

    * ``api_key=True`` — an active API key must be presented; its scopes must
      include every scope in ``scopes``.
    * ``user=True`` — a valid user JWT must be presented (and its role must be
      in ``roles`` when given). A key alone never satisfies ``user=True``.
    * ``api_key=False`` — used only by the credential-administration endpoints
      (a key can never mint or revoke keys); a *presented* key is still
      validated by the middleware, it is simply not required.
    """
    scope_list: List[str] = list(scopes)
    role_list = list(roles) if roles else None

    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            key = getattr(g, "api_key", None)
            if scope_list:
                if key is None:
                    raise unauthenticated(
                        "An API key is required for this endpoint (X-API-Key header).",
                        details=[{"header": "X-API-Key", "issue": "required"}],
                    )
                missing = [s for s in scope_list if not key.has_scope(s)]
                if missing:
                    raise forbidden(
                        "The API key does not carry the required scope(s).",
                        details=[{"missing_scopes": missing}],
                    )
            elif api_key and key is None:
                raise unauthenticated(
                    "An API key is required for this endpoint (X-API-Key header).",
                    details=[{"header": "X-API-Key", "issue": "required"}],
                )
            if user:
                resolve_user(required=True, roles=role_list)
            return f(*args, **kwargs)

        # Stamped for the OpenAPI document: the spec generator reads the
        # nearest guard on the view (walking ``__wrapped__``) so each path
        # advertises the scopes it really enforces.
        wrapper.__api_guard__ = {
            "scopes": list(scope_list),
            "roles": role_list,
            "api_key": api_key,
            "user": user,
        }
        return wrapper

    return decorator


def document_guard(*, scopes: Sequence[str] = (), api_key: bool = True,
                   user: bool = False, roles: Optional[Sequence[str]] = None):
    """Stamp ``require()``-style security metadata without enforcing it.

    For endpoints that validate credentials through a non-standard path —
    ``/auth/token`` reads the client secret from the request body, so it
    cannot go through ``require()`` — but must still advertise their
    requirements in the OpenAPI document. Enforcement stays in the view.
    """
    def _stamp(fn):
        fn.__api_guard__ = {
            "scopes": list(scopes),
            "roles": list(roles) if roles else None,
            "api_key": api_key,
            "user": user,
        }
        return fn

    return _stamp
