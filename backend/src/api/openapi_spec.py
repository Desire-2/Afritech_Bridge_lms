"""OpenAPI 3.1 document for ``/api/v2``, generated from the live routes.

The spec is derived from the registered blueprint — rule, methods, path
parameters, each view's docstring and the scopes ``require()`` stamped on it —
so it cannot drift from the implementation the way a hand-written contract
does. Adding a route updates ``/api/v2/openapi.json`` with no extra step.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from flask import current_app

from .constants import API_VERSION, MAX_PER_PAGE, SCOPES, SUPPORTED_EVENT_TYPES

SPEC_VERSION = "2026-10-18"

_WERKZEUG_PARAM = re.compile(
    r"<(?:(?P<converter>[a-zA-Z_][a-zA-Z0-9_]*):)?(?P<name>[a-zA-Z_][a-zA-Z0-9_]*)>"
)

_CONVERTER_TYPES = {
    "int": {"type": "integer"},
    "float": {"type": "number", "format": "double"},
    "uuid": {"type": "string", "format": "uuid"},
    "path": {"type": "string"},
}

_SUCCESS_METHODS = {"GET": "200", "DELETE": "200"}
_CREATE_METHODS = {"POST": "201", "PUT": "200", "PATCH": "200"}


def _guard(view):
    """Nearest ``require()`` stamp on ``view``, walking ``__wrapped__``.

    Endpoints with no stamp (health, token, docs, public verify) are open.
    """
    fn = view
    while fn is not None:
        guard = getattr(fn, "__api_guard__", None)
        if guard:
            return guard
        fn = getattr(fn, "__wrapped__", None)
    return None


def _to_openapi_path(rule: str) -> str:
    return _WERKZEUG_PARAM.sub(lambda m: "{%s}" % m.group("name"), rule)


def _path_parameters(rule) -> List[Dict[str, Any]]:
    params = []
    for match in _WERKZEUG_PARAM.finditer(rule.rule):
        name = match.group("name")
        schema = dict(_CONVERTER_TYPES.get(match.group("converter") or "", {"type": "string"}))
        params.append({
            "name": name,
            "in": "path",
            "required": True,
            "schema": schema,
        })
    return params


def _security(guard) -> List[Dict[str, List[str]]]:
    """Security requirements for a guarded endpoint.

    An API key and a user JWT are independent credentials: the spec offers
    both where the endpoint accepts either shape, with the key carrying the
    scopes it must present.
    """
    if guard is None:
        return []
    scopes = list(guard.get("scopes") or [])
    requirements: List[Dict[str, List[str]]] = []
    if guard.get("api_key", True):
        requirements.append({"ApiKeyHeader": scopes})
    if guard.get("user", False):
        requirements.append({"BearerAuth": scopes})
    return requirements


def _summary_and_description(view) -> tuple:
    doc = (view.__doc__ or "").strip()
    if not doc:
        return "Undocumented endpoint.", None
    first, _, rest = doc.partition("\n")
    summary = first.strip().rstrip(".")
    description = rest.strip() or None
    return summary or "Undocumented endpoint.", description


def _error_responses() -> Dict[str, Dict[str, Any]]:
    def err(description: str) -> Dict[str, Any]:
        return {
            "description": description,
            "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ErrorEnvelope"}}},
        }

    return {
        "400": err("Validation failed — ``error.details`` lists the fields."),
        "401": err("Missing or invalid credentials."),
        "403": err("Authenticated, but the key lacks the scope (or the role)."),
        "404": err("No such resource for this principal."),
        "429": err("Rate limit exceeded — retry after ``Retry-After`` seconds."),
    }


def _success_response() -> Dict[str, Any]:
    return {
        "description": "Success.",
        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/SuccessEnvelope"}}},
    }


def _request_body(method: str) -> Optional[Dict[str, Any]]:
    if method not in {"POST", "PUT", "PATCH"}:
        return None
    return {
        "required": True,
        "content": {"application/json": {"schema": {"type": "object"}}},
    }


def _collect_paths() -> Dict[str, Dict[str, Any]]:
    paths: Dict[str, Dict[str, Any]] = {}
    prefix = "/api/v2"
    for rule in current_app.url_map.iter_rules():
        if not rule.rule.startswith(prefix + "/") and rule.rule != prefix:
            continue
        if any(alias in rule.rule for alias in ("/docs", "/redoc", "/openapi.json")):
            # Human documentation pages are not part of the contract.
            continue
        path = _to_openapi_path(rule.rule[len(prefix):] or "/")
        view = current_app.view_functions.get(rule.endpoint)
        if view is None:
            continue
        guard = _guard(view)
        summary, description = _summary_and_description(view)
        methods = sorted(rule.methods - {"HEAD", "OPTIONS"})
        params = _path_parameters(rule)
        security = _security(guard)
        for method in methods:
            status = _CREATE_METHODS.get(method) or _SUCCESS_METHODS.get(method, "200")
            operation: Dict[str, Any] = {
                "operationId": f"{rule.endpoint}:{method.lower()}",
                "summary": summary,
                "tags": [path.strip("/").split("/")[0] or "misc"],
                "responses": {
                    **_error_responses(),
                    status: _success_response(),
                },
            }
            if description:
                operation["description"] = description
            if params:
                operation["parameters"] = params
            if security:
                operation["security"] = security
                operation["x-required-scopes"] = list(guard.get("scopes") or [])
            else:
                operation["security"] = []
            body = _request_body(method)
            if body:
                operation["requestBody"] = body
            paths.setdefault(path, {})[method.lower()] = operation
    return paths


def build_spec() -> Dict[str, Any]:
    """The OpenAPI 3.1 document for the integration API."""
    return {
        "openapi": "3.1.0",
        "info": {
            "title": "AfriTech Bridge LMS — Integration API",
            "version": SPEC_VERSION,
            "summary": "Versioned, key-and-JWT authenticated surface for "
                       "partners integrating with the LMS.",
            "description": (
                "Every endpoint reuses the same services as the LMS itself, so "
                "business rules can never diverge between the two surfaces. "
                "Authenticate with an API key (``X-API-Key``) plus, where the "
                "endpoint reads or writes a user's data, a user access token "
                "from ``POST /api/v2/auth/token``."
            ),
        },
        "servers": [{"url": "/", "description": "This deployment."}],
        "security": [],
        "tags": [
            {"name": "auth", "description": "Client-credential token minting."},
            {"name": "me", "description": "The authenticated learner."},
            {"name": "courses", "description": "Public catalogue and course structure."},
            {"name": "enrollments", "description": "Enrollment state for the learner."},
            {"name": "applications", "description": "Course applications."},
            {"name": "progress", "description": "Lesson and video progress."},
            {"name": "assessments", "description": "Quizzes and attempts."},
            {"name": "certificates", "description": "Certificates and verification."},
            {"name": "instructor", "description": "Teaching queues and grading."},
            {"name": "admin", "description": "Organization-level administration."},
            {"name": "webhooks", "description": "Outbound webhook subscriptions."},
            {"name": "events", "description": "Integration event log."},
        ],
        "paths": _collect_paths(),
        "components": {
            "securitySchemes": {
                "ApiKeyHeader": {
                    "type": "apiKey",
                    "in": "header",
                    "name": "X-API-Key",
                    "description": "Partner key issued by an administrator. "
                                   "Carries the scopes listed in the operation.",
                },
                "BearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                    "description": "User access token minted at /api/v2/auth/token.",
                },
            },
            "schemas": {
                "SuccessEnvelope": {
                    "type": "object",
                    "required": ["data", "meta"],
                    "properties": {
                        "data": {"description": "The resource, action result or page."},
                        "meta": {
                            "type": "object",
                            "properties": {
                                "request_id": {"type": ["string", "null"]},
                                "api_version": {"type": "string", "const": API_VERSION},
                            },
                        },
                    },
                },
                "ErrorEnvelope": {
                    "type": "object",
                    "required": ["error"],
                    "properties": {
                        "error": {
                            "type": "object",
                            "required": ["code", "message"],
                            "properties": {
                                "code": {"type": "string"},
                                "message": {"type": "string"},
                                "details": {"type": "array", "items": {"type": "object"}},
                                "request_id": {"type": "string"},
                            },
                        },
                    },
                },
            },
        },
        "x-scopes": SCOPES,
        "x-pagination": {
            "max_per_page": MAX_PER_PAGE,
            "parameters": ["page", "per_page"],
        },
        "x-event-types": SUPPORTED_EVENT_TYPES,
    }
