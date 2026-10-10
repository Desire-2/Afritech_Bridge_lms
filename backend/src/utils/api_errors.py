"""Normalized API error envelope shared by the AI routes.

Envelope shape:
    {"success": False,
     "error": {"code": str, "message": str, "retryable": bool,
               "human_review": bool},
     "task_id": ..., "workflow_id": ...}

Never includes exception internals, API keys, or provider credentials.
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from flask import Request, jsonify


def api_error(message: str, *, code: str = "AI_ERROR", status: int = 400,
              retryable: bool = False, human_review: bool = False,
              task_id: Optional[str] = None,
              workflow_id: Optional[str] = None) -> Tuple[Any, int]:
    body: Dict[str, Any] = {
        "success": False,
        "error": {
            "code": code,
            "message": message,
            "retryable": retryable,
            "human_review": human_review,
        },
    }
    if task_id:
        body["task_id"] = task_id
    if workflow_id:
        body["workflow_id"] = workflow_id
    return jsonify(body), status


def require_json(request: Request) -> Tuple[Dict[str, Any], Tuple[Any, int]]:
    """Return ``(json_dict, None)`` or ``(None, error_response)`` when the
    body is missing / not JSON. A bare ``request.get_json()`` returning None
    must never be treated as an empty dict (audit)."""
    if request.is_json is not True and not request.data:
        return {}, api_error("A JSON body is required.",
                             code="VALIDATION", status=400)
    data = request.get_json(silent=True)
    if data is None:
        return {}, api_error("Request body must be valid JSON.",
                             code="VALIDATION", status=400)
    if not isinstance(data, dict):
        return {}, api_error("JSON body must be an object.",
                             code="VALIDATION", status=400)
    return data, None


def error_from_provider_error(exc: Exception, *,
                              task_id: Optional[str] = None,
                              workflow_id: Optional[str] = None) -> Tuple[Any, int]:
    """Translate a normalized provider error into the API envelope."""
    from ..services.ai.providers import ProviderError

    if isinstance(exc, ProviderError):
        return api_error(
            exc.message, code=exc.code, status=503 if exc.retryable else 400,
            retryable=exc.retryable, human_review=exc.human_review,
            task_id=task_id, workflow_id=workflow_id,
        )
    return api_error("The AI service could not complete the request.",
                     code="AI_ERROR", status=500,
                     task_id=task_id, workflow_id=workflow_id)