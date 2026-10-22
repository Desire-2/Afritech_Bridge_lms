"""Dispatch to existing platform view functions and adapt their responses.

Several platform behaviours (quiz submission, lesson completion with all of its
gates, instructor grading with score propagation, certificate issuance) exist
only inside legacy route functions. To guarantee that the integration API
exercises **exactly** the same code path as the LMS UI — rather than a second,
divergent implementation — ``dispatch`` invokes the registered view function
inside the current request context (JWT decorators re-validate harmlessly) and
rewrites the JSON response into the v2 envelope.

Legacy error bodies are translated to canonical v2 error codes derived from
the HTTP status; the legacy message is preserved for operators.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from flask import Response, current_app, make_response

from .errors import ApiError, STATUS_CODES, forbidden, not_found, validation_error
from .responses import ok

#: Keys tolerated in a legacy success body alongside ``data`` before it is
#: treated as "envelope-ish" rather than a raw payload.
_ENVELOPE_KEYS = {"data", "message", "celebration", "quiz_info", "warning"}


def dispatch(endpoint: str, *, view_args: Optional[Dict[str, Any]] = None,
             label: Optional[str] = None) -> Response:
    """Run an existing platform view and return the v2-envelope response."""
    view = current_app.view_functions.get(endpoint)
    if view is None:  # pragma: no cover - programming error
        raise ApiError("INTERNAL_ERROR", "Upstream operation is unavailable.", 503)

    result = view(**(view_args or {}))
    response: Response = make_response(result)
    return adapt(response, label=label)


#: Legacy 400s whose semantics are conflicts — upgraded to 409 for the v2
#: contract so integrators can retry logic correctly.
_CONFLICT_MESSAGES = {
    "assignment already submitted",
    "project already submitted",
}


def adapt(response: Response, *, label: Optional[str] = None) -> Response:
    status = response.status_code
    body: Any
    if status == 204:
        body = None
    else:
        body = response.get_json(silent=True)

    if status >= 400:
        from .responses import error_response
        message, details = _extract_error(body)
        if status == 400 and message.strip().lower() in _CONFLICT_MESSAGES:
            status, code = 409, "CONFLICT"
        else:
            code = STATUS_CODES.get(status, "VALIDATION_ERROR")
        err = ApiError(code, message, status, details=details)
        return error_response(err)

    data, meta_extra = _split_success(body)
    return ok(data, status, meta=meta_extra or None)


def _split_success(body: Any):
    if not isinstance(body, dict):
        return body, None
    body = dict(body)
    body.pop("success", None)
    if "data" in body and set(body.keys()) <= _ENVELOPE_KEYS:
        extras = {k: v for k, v in body.items() if k != "data"}
        return body["data"], (extras or None)
    return body, None


def _extract_error(body: Any):
    """Return ``(message, details)`` from a legacy error body."""
    if isinstance(body, dict):
        message = body.get("message") or body.get("error") or body.get("detail")
        if isinstance(message, dict):
            message = str(message)
        if not message:
            message = "The request could not be completed."
        details = []
        for key in ("missing", "error_code", "quiz_required", "quiz_info",
                    "window", "all_windows", "requirements"):
            if key in body and body[key] not in (None, "", [], {}):
                details.append({"platform": {key: body[key]}})
        # Stringly-typed "details" fields in legacy 500s can leak internals —
        # never forward them; only structured values are safe.
        raw_details = body.get("details")
        if isinstance(raw_details, dict):
            details.append({"platform": {"details": raw_details}})
        return str(message)[:1000], details
    if isinstance(body, str) and body.strip():
        return body.strip()[:1000], []
    return "The request could not be completed.", []
