"""``/api/v2/me`` — the authenticated user's account profile."""

from __future__ import annotations

from flask import request

from ...models.user_models import db
from .. import api_bp
from ..auth import current_user, require
from ..errors import validation_error
from ..pagination import optional_str
from ..responses import ok
from ..serialization import serialize_profile_patchable

#: Fields ``PUT /me`` may change. Anything else is rejected explicitly.
WRITABLE_FIELDS = {
    "first_name": 120,
    "last_name": 120,
    "bio": 2000,
    "phone_number": 40,
    "location": 200,
    "portfolio_url": 500,
    "github_username": 120,
    "linkedin_url": 500,
    "website_url": 500,
    "learning_goals": 2000,
}
_LIST_FIELDS = ("skills", "interests")


@api_bp.route("/me", methods=["GET"])
@require(scopes=["profile:read"], user=True)
def get_me():
    """Read the profile of the user the request acts on."""
    return ok(serialize_profile_patchable(current_user()))


@api_bp.route("/me", methods=["PUT"])
@require(scopes=["profile:write"], user=True)
def update_me():
    """Update the authenticated user's profile (whitelisted fields only)."""
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise validation_error("A JSON object body is required.")

    unknown = sorted(set(body.keys()) - set(WRITABLE_FIELDS) - set(_LIST_FIELDS))
    if unknown:
        raise validation_error("The request contains invalid fields.", [
            {"field": field, "issue": "field is not writable via this endpoint"}
            for field in unknown
        ])

    user = current_user()
    for field, max_length in WRITABLE_FIELDS.items():
        if field in body:
            value = optional_str(body, field, max_length=max_length)
            if value is not None:
                value = value.strip()
            setattr(user, field, value)

    for field in _LIST_FIELDS:
        if field in body:
            value = body[field]
            if value is None:
                setattr(user, field, [])
                continue
            if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
                raise validation_error("The request contains invalid fields.", [
                    {"field": field, "issue": "must be a list of strings"}
                ])
            if len(value) > 50 or any(len(v) > 120 for v in value):
                raise validation_error("The request contains invalid fields.", [
                    {"field": field, "issue": "at most 50 entries of 120 characters"}
                ])
            setattr(user, field, value)

    db.session.commit()
    return ok(serialize_profile_patchable(user))
