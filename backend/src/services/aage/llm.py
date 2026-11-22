"""Schema-validated LLM access for AAGE.

Everything the engine asks a model to do goes through :func:`llm_json`, which

1. builds a prompt with **explicitly separated trust layers**
   (trusted instructions / assessment data / student content / output contract),
2. sends it through the existing provider abstraction
   (``ai_provider_manager.make_ai_request`` — Gemini / OpenRouter / NVIDIA with
   fallback and rate limiting),
3. parses the response with the project's hardened JSON parser,
4. validates it against an explicit :class:`~src.services.aage.validation.Schema`,
5. returns the *cleaned* payload or a structured failure.

The caller never sees unvalidated model JSON.
"""

from __future__ import annotations

import contextvars
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from ..ai.enhanced_json_parser import EnhancedJSONParser
from ..ai.ai_providers import ai_provider_manager
from .timeout import CallTimeout, call_with_timeout, remaining_seconds
from .validation import Schema, SchemaError, try_validate

logger = logging.getLogger("aage.llm")

OPEN_TAG = "<<<"
CLOSE_TAG = ">>>"

# Maximum attempts at getting a schema-valid response from the model.
MAX_REPAIR_ATTEMPTS = 2

#: Hard ceiling for one provider call.  Can be lowered per call or by the
#: owning job's deadline, but never raised above this.
DEFAULT_CALL_TIMEOUT_SECONDS = 60.0


# ---------------------------------------------------------------------------
# Honest per-correlation usage accumulator
# ---------------------------------------------------------------------------

@dataclass
class LLMUsage:
    """Measured facts about LLM calls in one correlation scope.

    Only *observed* values are recorded.  ``make_ai_request`` currently returns
    ``(text, provider)`` and exposes no token usage, so ``tokens_in`` /
    ``tokens_out`` / ``cost_estimate`` stay ``None``.  A future provider that
    returns a usage mapping as a third tuple element can be captured without
    changing any caller.  Dollar costs are **never** derived from an assumed
    price table.
    """

    correlation_id: str = ""
    llm_calls: int = 0
    prompt_chars: int = 0
    response_chars: int = 0
    providers: List[str] = field(default_factory=list)
    tokens_in: Optional[int] = None
    tokens_out: Optional[int] = None
    cost_estimate: Optional[float] = None

    def snapshot(self) -> Dict[str, Any]:
        providers = sorted({str(p) for p in self.providers if p})
        return {
            "provider": providers[0] if len(providers) == 1
                        else (",".join(providers) or None),
            "llm_calls": int(self.llm_calls),
            "prompt_chars": int(self.prompt_chars),
            "response_chars": int(self.response_chars),
            "tokens_in": self.tokens_in,
            "tokens_out": self.tokens_out,
            # Kept for forward compatibility; always None with the current
            # provider abstraction (no real cost signal is exposed).
            "cost_estimate": self.cost_estimate,
        }


_usage_var: contextvars.ContextVar[Optional[LLMUsage]] = contextvars.ContextVar(
    "aage_llm_usage", default=None)


def start_usage_window(correlation_id: str = "") -> contextvars.Token:
    """Begin a fresh correlation-scoped usage window; returns its reset token.

    The orchestrator calls this at the start of every evaluation and always
    resets it in a ``finally`` block, so one job's counts can never leak into
    the next one (including on failure paths).
    """
    return _usage_var.set(LLMUsage(correlation_id=correlation_id or ""))


def reset_usage_window(token: Optional[contextvars.Token] = None) -> None:
    """Restore the previous usage scope (or clear it when no token is given)."""
    if token is not None:
        try:
            _usage_var.reset(token)
            return
        except (ValueError, RuntimeError):  # token from another context
            pass
    _usage_var.set(None)


def get_usage() -> Dict[str, Any]:
    """Return a plain-dict snapshot of the current usage window.

    Always safe to call: with no active window it returns zeroed counts and
    ``None`` usage/cost fields, never fabricated numbers.
    """
    usage = _usage_var.get()
    if usage is None:
        return LLMUsage().snapshot()
    return usage.snapshot()


def _record_llm_call(*, prompt_chars: int, response_chars: int,
                     provider: Optional[str],
                     provider_usage: Any = None) -> None:
    """Record one completed provider call into the active window, if any."""
    usage = _usage_var.get()
    if usage is None:  # e.g. rubric/intelligence calls outside an evaluation
        return
    usage.llm_calls += 1
    usage.prompt_chars += max(0, int(prompt_chars or 0))
    usage.response_chars += max(0, int(response_chars or 0))
    if provider:
        usage.providers.append(str(provider))

    # Only capture genuinely reported usage.  Unknown/malformed fields are
    # ignored rather than guessed.
    if isinstance(provider_usage, dict):
        def _int_value(*keys: str) -> Optional[int]:
            for key in keys:
                value = provider_usage.get(key)
                if isinstance(value, bool):
                    continue
                if isinstance(value, (int, float)) and value >= 0:
                    return int(value)
            return None

        tokens_in = _int_value("tokens_in", "prompt_tokens", "input_tokens")
        tokens_out = _int_value("tokens_out", "completion_tokens",
                                "output_tokens")
        if tokens_in is not None:
            usage.tokens_in = (usage.tokens_in or 0) + tokens_in
        if tokens_out is not None:
            usage.tokens_out = (usage.tokens_out or 0) + tokens_out
        cost = provider_usage.get("cost_estimate")
        if isinstance(cost, (int, float)) and not isinstance(cost, bool):
            usage.cost_estimate = (usage.cost_estimate or 0.0) + float(cost)


def _bounded_timeout(timeout_hint: Optional[float]) -> float:
    """Pick a per-call timeout, capped by the calling job's deadline."""
    try:
        configured = float(
            os.environ.get("AAGE_LLM_CALL_TIMEOUT_SECONDS",
                           DEFAULT_CALL_TIMEOUT_SECONDS))
    except (TypeError, ValueError):
        configured = DEFAULT_CALL_TIMEOUT_SECONDS
    timeout = configured if timeout_hint is None else float(timeout_hint)
    timeout = max(0.001, min(timeout, DEFAULT_CALL_TIMEOUT_SECONDS
                             if configured <= 0 else configured))
    remaining = remaining_seconds()
    if remaining is not None:
        timeout = min(timeout, remaining)
    return max(0.001, timeout)


@dataclass
class LLMCall:
    """Outcome of one schema-validated model call."""

    ok: bool
    data: Optional[Dict[str, Any]] = None
    provider: Optional[str] = None
    raw: Optional[str] = None
    errors: List[Dict[str, str]] = field(default_factory=list)
    latency_ms: int = 0
    attempts: int = 0
    prompt_chars: int = 0
    failure: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ok": self.ok,
            "provider": self.provider,
            "errors": self.errors,
            "latency_ms": self.latency_ms,
            "attempts": self.attempts,
            "prompt_chars": self.prompt_chars,
            "failure": self.failure,
        }


def _layer(name: str, body: Any) -> str:
    """Render one trust layer with explicit begin/end markers.

    Every layer is JSON-encoded — including plain strings — so untrusted text
    cannot place a marker token on its own line and impersonate a trusted
    layer. :func:`_escape_markers` additionally neutralises inline marker
    tokens in student-controlled payloads.
    """
    rendered = json.dumps(body, ensure_ascii=False, indent=2, default=str)
    return f"{OPEN_TAG}{name}_BEGIN{CLOSE_TAG}\n{rendered}\n{OPEN_TAG}{name}_END{CLOSE_TAG}"


def _escape_markers(value: Any) -> Any:
    """Neutralise trust-layer delimiters inside untrusted content."""
    if isinstance(value, str):
        return value.replace(OPEN_TAG, "‹‹").replace(CLOSE_TAG, "››")
    if isinstance(value, list):
        return [_escape_markers(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _escape_markers(v) for k, v in value.items()}
    return value


def build_prompt(
    instructions: str,
    *,
    assessment: Optional[Any] = None,
    student_content: Optional[Any] = None,
    context: Optional[Any] = None,
    contract: Optional[Any] = None,
) -> str:
    """Assemble the four-layer prompt.

    ``instructions`` is trusted (developer-authored).  ``assessment`` is
    instructor-authored.  ``student_content`` is untrusted.  ``contract`` is
    the JSON shape the model must return.
    """
    layers = [_layer("SYSTEM", instructions)]
    if context is not None:
        layers.append(_layer("CONTEXT", context))
    if assessment is not None:
        layers.append(_layer("ASSESSMENT", assessment))
    if student_content is not None:
        layers.append(_layer("STUDENT_SUBMISSION", _escape_markers(student_content)))
    if contract is not None:
        layers.append(_layer("OUTPUT_CONTRACT", contract))
    layers.append(
        "Respond with ONE JSON object only. No prose, no markdown fences, "
        "no commentary before or after the JSON."
    )
    return "\n\n".join(layers)


def llm_json(
    instructions: str,
    schema: Schema,
    *,
    assessment: Optional[Any] = None,
    student_content: Optional[Any] = None,
    context: Optional[Any] = None,
    contract: Optional[Dict[str, Any]] = None,
    temperature: float = 0.2,
    max_tokens: int = 6000,
    max_attempts: int = MAX_REPAIR_ATTEMPTS,
    prefer_fast: bool = False,
    timeout_hint: Optional[float] = None,
) -> LLMCall:
    """Run a schema-validated JSON completion.

    On schema failure the model is re-prompted once with the validation errors
    appended (bounded repair), then the structured failure is returned.
    """
    started = time.time()
    contract = contract or {"type": "object"}
    prompt = build_prompt(
        instructions,
        assessment=assessment,
        student_content=student_content,
        context=context,
        contract=contract,
    )
    prompt_chars = len(prompt)
    attempts = 0
    provider: Optional[str] = None
    raw: Optional[str] = None
    last_errors: List[Dict[str, str]] = []

    repair_suffix = ""
    for attempt in range(1, max_attempts + 1):
        attempts = attempt
        call_timeout = _bounded_timeout(timeout_hint)
        if remaining_seconds() is not None and remaining_seconds() <= 0:
            last_errors = [{
                "path": "$", "code": "timeout",
                "message": "job deadline exceeded before the model call",
            }]
            break
        try:
            result = call_with_timeout(
                lambda: ai_provider_manager.make_ai_request(
                    prompt + repair_suffix,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    prefer_fast=prefer_fast,
                ),
                call_timeout,
                label="aage_llm",
            )
            # Current manager returns (text, provider).  Tolerate a future
            # third usage mapping without inventing token counts today.
            if isinstance(result, tuple) and len(result) >= 3:
                text, provider, provider_usage = result[0], result[1], result[2]
            elif isinstance(result, tuple) and len(result) == 2:
                text, provider, provider_usage = result[0], result[1], None
            else:  # pragma: no cover - defensive against provider changes
                text, provider, provider_usage = result, None, None
            _record_llm_call(
                prompt_chars=len(prompt + repair_suffix),
                response_chars=len(text) if isinstance(text, str) else 0,
                provider=provider, provider_usage=provider_usage)
        except CallTimeout as exc:
            logger.warning("AAGE LLM call exceeded its deadline: %s", exc)
            last_errors = [{
                "path": "$", "code": "timeout",
                "message": f"model call exceeded {call_timeout:g}s",
            }]
            break
        except Exception as exc:  # provider/rate-limit failures
            logger.warning("AAGE LLM request failed: %s", exc)
            last_errors = [{"path": "$", "code": "provider", "message": str(exc)[:300]}]
            break

        if not text:
            last_errors = [{"path": "$", "code": "provider", "message": "empty model response"}]
            break

        raw = text
        parsed = EnhancedJSONParser.parse_json_response(text, context="aage")
        if parsed is None:
            last_errors = [{"path": "$", "code": "json", "message": "response was not valid JSON"}]
            repair_suffix = ("\n\nYour previous reply could not be parsed as JSON. "
                             "Reply with a single valid JSON object only.")
            continue

        clean, errors = try_validate(parsed, schema)
        if errors:
            last_errors = errors
            repair_suffix = (
                "\n\nYour previous reply failed validation:\n"
                + json.dumps(errors[:8], indent=2)
                + "\nReply again with ONE corrected JSON object matching the contract."
            )
            continue

        return LLMCall(
            ok=True,
            data=clean,
            provider=provider,
            raw=raw,
            latency_ms=int((time.time() - started) * 1000),
            attempts=attempts,
            prompt_chars=prompt_chars,
        )

    codes = {str(err.get("code") or "") for err in last_errors}
    if "timeout" in codes:
        failure = "timeout"
    elif "provider" in codes or not last_errors:
        failure = "provider_failure"
    else:
        failure = "schema_validation"
    return LLMCall(
        ok=False,
        data=None,
        provider=provider,
        raw=raw,
        errors=last_errors,
        latency_ms=int((time.time() - started) * 1000),
        attempts=attempts,
        prompt_chars=prompt_chars,
        failure=failure,
    )


def truncate_for_prompt(text: str, limit: int) -> str:
    """Hard-cap untrusted text so prompts stay bounded and costs trackable."""
    if not text:
        return ""
    if len(text) <= limit:
        return text
    return text[:limit] + f"\n...[truncated {len(text) - limit} characters]"
