"""NVIDIA Nemotron provider (OpenAI-compatible API).

Implements the ``AIProvider`` interface. Supports:

* non-streaming chat completion
* streaming with ``reasoning_content`` separated from ``content``
  (Nemotron / `enable_thinking`)
* task-scoped credentials (no global mutable state)
* cooperative cancellation
* bounded retries with exponential backoff + jitter
* Retry-After (seconds) and HTTP-date Retry-After parsing

Two transports are supported:
  1. the official ``openai`` SDK when installed;
  2. a small ``requests``-based fallback with identical behavior.

The provider NEVER exposes the API key in logs or metadata.
"""

from __future__ import annotations

import re
import json
import time
import email.utils
import random
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Iterator, List, Optional

from .base import (
    AIProvider,
    AIResponse,
    StreamEvent,
    StreamEventType,
    ProviderError,
    ProviderRateLimitError,
    ProviderTimeoutError,
    ProviderTemporaryError,
    ProviderAuthError,
    ProviderInvalidRequestError,
    ProviderContextOverflowError,
    ProviderMalformedResponseError,
    ProviderCancelledError,
    ProviderUnavailableError,
)
from . import config

logger = logging.getLogger(__name__)

try:  # optional dependency – fall back to raw requests when missing
    from openai import OpenAI  # type: ignore
    OPENAI_SDK_AVAILABLE = True
except Exception:  # pragma: no cover - import guard
    OpenAI = None  # type: ignore
    OPENAI_SDK_AVAILABLE = False

import requests


def _parse_retry_after(value: Optional[str], *, minimum: float) -> float:
    """Parse ``Retry-After`` as integer seconds or an HTTP-date.

    Never returns an absurd value: results are clamped to a sane upper bound
    (10 minutes) so a malformed millisecond-epoch header can never produce a
    ~54,000-year wait (the bug previously present in the codebase).
    """
    if not value:
        return minimum
    value = value.strip()
    try:
        seconds = float(value)
    except (TypeError, ValueError):
        try:
            date = email.utils.parsedate_to_datetime(value)
            if date is None:
                return minimum
            seconds = max(0.0, (date - datetime.now(timezone.utc)).total_seconds())
        except Exception:
            return minimum
    MAX_RETRY_AFTER = 600.0  # 10 minutes, never more
    return min(MAX_RETRY_AFTER, max(minimum, seconds))


def _safe_err(exc: Exception) -> str:
    """A user-safe one-liner; never leaks internals."""
    return str(exc)[:200]


class NVIDIAProvider(AIProvider):
    """Nemotron via NVIDIA's OpenAI-compatible chat completions endpoint."""

    name = "nvidia"

    def __init__(self, model: Optional[str] = None, api_key: Optional[str] = None, *,
                 base_url: Optional[str] = None, user_id: Optional[int] = None,
                 timeout: Optional[float] = None, max_retries: Optional[int] = None,
                 enable_thinking: Optional[bool] = None,
                 reasoning_budget: Optional[int] = None,
                 default_temperature: Optional[float] = None,
                 default_top_p: Optional[float] = None,
                 default_max_tokens: Optional[int] = None):
        if not api_key:
            raise ProviderAuthError(
                "NVIDIA API key is not configured. Ask an administrator to set it.",
                human_review=True,
            )
        model = model or config.NVIDIA_AI_MODEL
        super().__init__(
            model=model,
            api_key=api_key,
            user_id=user_id,
            timeout=timeout or config.NVIDIA_AI_TIMEOUT_SECONDS,
            max_retries=max_retries or config.NVIDIA_AI_MAX_RETRIES,
        )
        self.base_url = base_url or config.NVIDIA_AI_BASE_URL
        self.enable_thinking = (
            config.NVIDIA_AI_ENABLE_THINKING
            if enable_thinking is None else enable_thinking
        )
        self.reasoning_budget = (
            config.NVIDIA_AI_REASONING_BUDGET
            if reasoning_budget is None else reasoning_budget
        )
        self.default_temperature = (
            config.NVIDIA_AI_TEMPERATURE
            if default_temperature is None else default_temperature
        )
        self.default_top_p = config.NVIDIA_AI_TOP_P if default_top_p is None else default_top_p
        self.default_max_tokens = (
            config.NVIDIA_AI_MAX_TOKENS if default_max_tokens is None else default_max_tokens
        )
        self._http = requests.Session()
        self._client: Any = None
        if OPENAI_SDK_AVAILABLE:
            self._client = OpenAI(base_url=self.base_url, api_key=api_key)
        else:  # pragma: no cover - depends on environment
            logger.warning(
                "openai SDK not installed for NVIDIA provider — using requests transport."
            )

    # ------------------------------------------------------------------
    # internals
    # ------------------------------------------------------------------
    def _extra_body(self, enable_thinking: bool, reasoning_budget: Optional[int],
                    max_tokens: int) -> Dict[str, Any]:
        """Build the Nemotron thinking configuration (harmless when ignored)."""
        body: Dict[str, Any] = {}
        if enable_thinking:
            body["chat_template_kwargs"] = {"enable_thinking": True}
        budget = reasoning_budget or self.reasoning_budget
        if enable_thinking and budget:
            body["reasoning_budget"] = min(budget, max_tokens)
        return body

    def _build_payload(self, messages, temperature, top_p, max_tokens,
                       stream, enable_thinking, reasoning_budget) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": max_tokens,
            "stream": stream,
        }
        extra = self._extra_body(enable_thinking, reasoning_budget, max_tokens)
        if extra:
            payload.update(extra)
        return payload

    def _normalize_error(self, exc: Exception) -> ProviderError:
        """Map a transport/model error to a normalized ProviderError."""
        if isinstance(exc, ProviderError):
            return exc
        status = getattr(exc, "status_code", None)
        if status is None:
            response = getattr(exc, "response", None)
            status = getattr(response, "status_code", None)
        body = getattr(exc, "body", "") or ""
        message = str(exc)
        msg_lower = (message + str(body)).lower()

        if status == 429 or "rate limit" in msg_lower or "429" in msg_lower:
            retry_after = None
            resp = getattr(exc, "response", None)
            if resp is not None and hasattr(resp, "headers"):
                retry_after = _parse_retry_after(
                    (resp.headers or {}).get("Retry-After"), minimum=1.0
                )
            return ProviderRateLimitError(
                "The NVIDIA API rate limited the request. It will be retried.",
                retry_after=retry_after, provider=self.name, original=exc,
            )
        if status in (401, 403):
            return ProviderAuthError(
                "The NVIDIA API rejected the API key.",
                provider=self.name, original=exc,
            )
        if status == 400 or "context" in msg_lower or "max_tokens" in msg_lower:
            if "context" in msg_lower or "too large" in msg_lower or "token" in msg_lower:
                return ProviderContextOverflowError(
                    "The request exceeded the model context window.",
                    provider=self.name, original=exc,
                )
            return ProviderInvalidRequestError(
                "The NVIDIA API rejected the request payload.",
                provider=self.name, original=exc,
            )
        if status and status >= 500:
            return ProviderTemporaryError(
                "The NVIDIA API returned a temporary server error.",
                provider=self.name, original=exc,
            )
        if isinstance(exc, (requests.exceptions.Timeout, TimeoutError)):
            return ProviderTimeoutError(
                "The NVIDIA API timed out.", provider=self.name, original=exc,
            )
        if isinstance(exc, requests.exceptions.ConnectionError):
            return ProviderTemporaryError(
                "Could not reach the NVIDIA API.", provider=self.name, original=exc,
            )
        return ProviderTemporaryError(
            "The NVIDIA API request failed.", provider=self.name, original=exc,
        )

    def _extract_usage(self, chunk_usage: Any) -> Dict[str, int]:
        if not chunk_usage:
            return {}
        try:
            return {
                "prompt_tokens": int(getattr(chunk_usage, "prompt_tokens", 0) or 0),
                "completion_tokens": int(getattr(chunk_usage, "completion_tokens", 0) or 0),
                "total_tokens": int(getattr(chunk_usage, "total_tokens", 0) or 0),
                "reasoning_tokens": int(
                    getattr(chunk_usage, "completion_tokens_details", None).reasoning_tokens
                    if getattr(chunk_usage, "completion_tokens_details", None) else 0
                ),
            }
        except Exception:
            return {}

    # ------------------------------------------------------------------
    # requests transport
    # ------------------------------------------------------------------
    def _requests_completion(self, messages, temperature, top_p, max_tokens,
                             stream: bool, enable_thinking, reasoning_budget):
        from requests.exceptions import Timeout as ReqTimeout

        payload = self._build_payload(messages, temperature, top_p, max_tokens,
                                      stream, enable_thinking, reasoning_budget)
        url = self.base_url.rstrip("/") + "/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        try:
            self._check_cancelled()
            resp = self._http.post(
                url, headers=headers, json=payload,
                timeout=self.timeout, stream=stream,
            )
            if resp.status_code >= 400:
                detail = (resp.text or "")[:500]
                err = self._normalize_error(
                    ProviderTemporaryError(f"HTTP {resp.status_code}: {detail}")
                    if resp.status_code >= 500
                    else ProviderInvalidRequestError(f"HTTP {resp.status_code}: {detail}")
                )
                raise err
            if stream:
                return resp  # caller iterates lines
            data = resp.json()
        except ProviderError:
            raise
        except ReqTimeout:
            raise ProviderTimeoutError(
                "The NVIDIA API timed out.", provider=self.name,
            ) from None
        except requests.exceptions.RequestException as exc:
            raise self._normalize_error(exc) from None
        except ValueError as exc:
            raise ProviderMalformedResponseError(
                "The NVIDIA API returned a malformed response.",
                provider=self.name, original=exc,
            ) from None
        return data

    # ------------------------------------------------------------------
    # openai SDK transport
    # ------------------------------------------------------------------
    def _sdk_completion(self, messages, temperature, top_p, max_tokens,
                        stream: bool, enable_thinking, reasoning_budget) -> Any:
        self._check_cancelled()
        kwargs: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": max_tokens,
            "stream": stream,
        }
        extra = self._extra_body(enable_thinking, reasoning_budget, max_tokens)
        if extra:
            kwargs["extra_body"] = extra
        try:
            return self._client.chat.completions.create(**kwargs)
        except Exception as exc:  # noqa: BLE001 - normalize any SDK error
            raise self._normalize_error(exc) from None

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------
    def generate(self, messages: List[Dict[str, str]], *,
                 temperature: Optional[float] = None, top_p: Optional[float] = None,
                 max_tokens: Optional[int] = None,
                 reasoning_budget: Optional[int] = None,
                 enable_thinking: Optional[bool] = None,
                 **kwargs: Any) -> AIResponse:
        temp = self.default_temperature if temperature is None else temperature
        top = self.default_top_p if top_p is None else top_p
        mx = self.default_max_tokens if max_tokens is None else max_tokens
        thinking = self.enable_thinking if enable_thinking is None else enable_thinking

        started = time.monotonic()
        attempt = 0
        delay = 0.5
        last_err: Optional[ProviderError] = None
        while True:
            self._check_cancelled()
            if attempt > 0:
                time.sleep(delay)
                # exponential backoff with jitter
                delay = min(10.0, delay * 2) + random.uniform(0, 0.5)
            try:
                if self._client is not None:
                    data = self._sdk_completion(
                        messages, temp, top, mx, False, thinking, reasoning_budget
                    )
                    choice = data.choices[0]
                    message = getattr(choice, "message", None)
                    reasoning = getattr(message, "reasoning_content", None) or ""
                    content = getattr(message, "content", None) or ""
                    if content is None:
                        content = ""
                    return AIResponse(
                        content=content,
                        reasoning=reasoning or "",
                        provider=self.name,
                        model=self.model,
                        usage=self._extract_usage(getattr(data, "usage", None)),
                        finish_reason=getattr(choice, "finish_reason", None),
                        request_id=getattr(data, "id", None),
                        latency_ms=int((time.monotonic() - started) * 1000),
                    )
                raw = self._requests_completion(
                    messages, temp, top, mx, False, thinking, reasoning_budget
                )
                choice = raw["choices"][0]
                message = choice.get("message", {}) or {}
                reasoning = message.get("reasoning_content") or ""
                content = message.get("content") or ""
                return AIResponse(
                    content=content,
                    reasoning=reasoning,
                    provider=self.name,
                    model=self.model,
                    usage=raw.get("usage") or {},
                    finish_reason=choice.get("finish_reason"),
                    request_id=raw.get("id"),
                    latency_ms=int((time.monotonic() - started) * 1000),
                )
            except ProviderCancelledError:
                raise
            except ProviderError as err:
                last_err = err
                if not err.retryable or attempt >= self.max_retries:
                    raise
                attempt += 1
                logger.info(
                    "NVIDIA attempt %d/%d failed (%s); retrying",
                    attempt, self.max_retries, err.code,
                )
            except Exception as exc:  # pragma: no cover - defensive
                last_err = self._normalize_error(exc)
                if attempt >= self.max_retries:
                    raise last_err from exc
                attempt += 1
        raise last_err or ProviderUnavailableError("NVIDIA generation failed")  # pragma: no cover

    def generate_structured(self, messages: List[Dict[str, str]], *,
                            temperature: Optional[float] = None, top_p: Optional[float] = None,
                            max_tokens: Optional[int] = None,
                            reasoning_budget: Optional[int] = None,
                            enable_thinking: Optional[bool] = None,
                            **kwargs: Any) -> AIResponse:
        """Generate and verify a JSON response. Raises malformed on bad JSON."""
        resp = self.generate(
            messages, temperature=temperature, top_p=top_p, max_tokens=max_tokens,
            reasoning_budget=reasoning_budget, enable_thinking=enable_thinking,
            **kwargs,
        )
        text = resp.content.strip()
        if not text:
            raise ProviderMalformedResponseError(
                "The NVIDIA API returned an empty response.", provider=self.name,
            )
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        try:
            json.loads(cleaned)
        except (json.JSONDecodeError, TypeError) as exc:
            raise ProviderMalformedResponseError(
                "The NVIDIA API returned a non-JSON response.",
                provider=self.name, original=exc,
            ) from None
        return resp

    def stream(self, messages: List[Dict[str, str]], *,
               temperature: Optional[float] = None, top_p: Optional[float] = None,
               max_tokens: Optional[int] = None,
               reasoning_budget: Optional[int] = None,
               enable_thinking: Optional[bool] = None,
               task_id: Optional[str] = None,
               **kwargs: Any):
        temp = self.default_temperature if temperature is None else temperature
        top = self.default_top_p if top_p is None else top_p
        mx = self.default_max_tokens if max_tokens is None else max_tokens
        thinking = self.enable_thinking if enable_thinking is None else enable_thinking

        self._check_cancelled()
        started = time.monotonic()
        content_parts: List[str] = []
        reasoning_parts: List[str] = []
        usage: Dict[str, int] = {}
        finish_reason: Optional[str] = None
        request_id: Optional[str] = None

        if self._client is not None:
            stream_obj = self._sdk_completion(
                messages, temp, top, mx, True, thinking, reasoning_budget
            )
            try:
                for chunk in stream_obj:
                    self._check_cancelled()
                    if not chunk.choices:
                        continue
                    delta = chunk.choices[0].delta
                    if delta is None:
                        continue
                    reasoning = getattr(delta, "reasoning_content", None)
                    content = getattr(delta, "content", None)
                    if reasoning:
                        reasoning_parts.append(reasoning)
                        yield StreamEvent(StreamEventType.REASONING, reasoning, task_id=task_id)
                    if content:
                        content_parts.append(content)
                        yield StreamEvent(StreamEventType.CONTENT, content, task_id=task_id)
                    if getattr(chunk, "usage", None):
                        usage = self._extract_usage(chunk.usage)
                    fr = getattr(chunk.choices[0], "finish_reason", None)
                    if fr:
                        finish_reason = fr
                    request_id = request_id or getattr(chunk, "id", None)
            except ProviderCancelledError:
                raise
            except ProviderError:
                raise
            except Exception as exc:  # noqa: BLE001
                if self._cancelled:
                    raise ProviderCancelledError(
                        "NVIDIA stream cancelled", provider=self.name,
                    ) from None
                raise self._normalize_error(exc) from None
        else:  # requests-based SSE transport
            raw = self._requests_completion(
                messages, temp, top, mx, True, thinking, reasoning_budget
            )
            try:
                for line in raw.iter_lines(decode_unicode=True):
                    self._check_cancelled()
                    if not line:
                        continue
                    text = line.decode() if isinstance(line, bytes) else line
                    if text.startswith(":"):
                        continue
                    if text.startswith("data:"):
                        text = text[len("data:"):].strip()
                    if text == "[DONE]":
                        break
                    try:
                        chunk = json.loads(text)
                    except (json.JSONDecodeError, TypeError):
                        continue
                    if not chunk.get("choices"):
                        continue
                    delta = (chunk["choices"][0].get("delta") or {})
                    reasoning = delta.get("reasoning_content")
                    content = delta.get("content")
                    if reasoning:
                        reasoning_parts.append(reasoning)
                        yield StreamEvent(StreamEventType.REASONING, reasoning, task_id=task_id)
                    if content:
                        content_parts.append(content)
                        yield StreamEvent(StreamEventType.CONTENT, content, task_id=task_id)
                    if chunk.get("usage"):
                        usage = chunk["usage"]
                    fr = chunk["choices"][0].get("finish_reason")
                    if fr:
                        finish_reason = fr
                    request_id = request_id or chunk.get("id")
            except ProviderError:
                raise
            except Exception as exc:  # noqa: BLE001
                if self._cancelled:
                    raise ProviderCancelledError(
                        "NVIDIA stream cancelled", provider=self.name,
                    ) from None
                raise self._normalize_error(exc) from None

        if self._cancelled:
            raise ProviderCancelledError("NVIDIA stream cancelled", provider=self.name)

        yield StreamEvent(
            StreamEventType.COMPLETE, "", task_id=task_id,
            metadata=AIResponse(
                content="".join(content_parts),
                reasoning="".join(reasoning_parts),
                provider=self.name,
                model=self.model,
                usage=usage,
                finish_reason=finish_reason,
                request_id=request_id,
                latency_ms=int((time.monotonic() - started) * 1000),
            ).to_dict(),
        )

    def health_check(self) -> bool:
        """Best-effort check using an empty completion (safe, cheap)."""
        try:
            self.generate(
                [{"role": "user", "content": "ping: reply with the single word ok"}],
                max_tokens=8, enable_thinking=False,
            )
            return True
        except ProviderError:
            return False
        except Exception:  # pragma: no cover
            return False

    def close(self) -> None:
        try:
            self._http.close()
        except Exception:  # pragma: no cover
            pass


def _safe_err_unused(exc: Exception) -> str:  # pragma: no cover
    return _safe_err(exc)