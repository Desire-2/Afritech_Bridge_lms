"""Provider base types for the Afritec Bridge LMS AI agent system.

Defines the common `AIProvider` interface, the normalized `AIResponse`
envelope, and a normalized provider-error hierarchy.

Architecture note (SEC-1 / provider isolation):
    Provider configuration (API keys, model names) must NEVER live in a
    process-wide mutable singleton. Instances are request/task-scoped and are
    created by :class:`ProviderFactory` per task. The factory resolves the
    active user's credentials for the current thread only and hands the caller
    a fully-configured provider instance. No provider object is ever shared
    across users or threads.
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, AsyncIterator, Dict, Iterator, List, Optional


# ---------------------------------------------------------------------------
# Normalized AI response envelope
# ---------------------------------------------------------------------------
@dataclass
class AIResponse:
    """A provider-agnostic generation result.

    ``content`` is the produced artifact (markdown, JSON-as-string, text).
    ``reasoning`` carries reasoning/rethinking output from models that expose
    it (e.g. Nemotron with ``enable_thinking``). Reasoning is deliberately a
    SEPARATE field so it can never accidentally be saved as course content.
    """

    content: str
    provider: str
    model: str
    reasoning: str = ""
    usage: Optional[Dict[str, int]] = None
    finish_reason: Optional[str] = None
    request_id: Optional[str] = None
    latency_ms: int = 0
    cached: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_empty(self) -> bool:
        """True when the model returned no usable content."""
        return not self.content or not self.content.strip()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "content": self.content,
            "provider": self.provider,
            "model": self.model,
            "reasoning": self.reasoning,
            "usage": self.usage,
            "finish_reason": self.finish_reason,
            "request_id": self.request_id,
            "latency_ms": self.latency_ms,
            "cached": self.cached,
            "metadata": self.metadata,
        }


# ---------------------------------------------------------------------------
# Normalized provider errors
# ---------------------------------------------------------------------------
class ProviderError(Exception):
    """Base class for all normalized provider errors."""

    code = "AI_PROVIDER_ERROR"

    def __init__(self, message: str, *, retryable: bool = False,
                 fallback: bool = False, human_review: bool = False,
                 provider: Optional[str] = None, original: Optional[Exception] = None):
        super().__init__(message)
        self.message = message
        self.retryable = retryable          # safe & sensible to retry the SAME provider
        self.fallback = fallback            # safe to switch to a fallback provider
        self.human_review = human_review    # requires a human / NEEDS_REVIEW task
        self.provider = provider
        self.original = original            # original exception (never leaked to clients)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "code": self.code,
            "message": self.message,
            "retryable": self.retryable,
            "fallback": self.fallback,
            "human_review": self.human_review,
        }


class ProviderRateLimitError(ProviderError):
    code = "AI_PROVIDER_RATE_LIMITED"

    def __init__(self, message: str, retry_after: Optional[float] = None, **kw):
        # 429s are retried WITH BACKOFF on the SAME provider; they must never
        # cause a provider switch (anti-flapping), so fallback stays False.
        super().__init__(message, retryable=True, fallback=False, **kw)
        self.retry_after = retry_after


class ProviderTimeoutError(ProviderError):
    code = "AI_PROVIDER_TIMEOUT"

    def __init__(self, message: str, **kw):
        super().__init__(message, retryable=True, fallback=True, **kw)


class ProviderTemporaryError(ProviderError):
    """Network blips, 5xx, proxy errors, etc. Retry then fallback."""

    code = "AI_PROVIDER_TEMPORARY_ERROR"

    def __init__(self, message: str, **kw):
        super().__init__(message, retryable=True, fallback=True, **kw)


class ProviderAuthError(ProviderError):
    """Invalid/missing key, 401/403. Human review — do not retry blindly."""

    code = "AI_PROVIDER_AUTH_ERROR"

    def __init__(self, message: str, **kw):
        kw.setdefault("retryable", False)
        kw.setdefault("fallback", True)
        kw.setdefault("human_review", True)
        super().__init__(message, **kw)


class ProviderInvalidRequestError(ProviderError):
    """400, malformed body, invalid model slug. Do not retry."""

    code = "AI_PROVIDER_INVALID_REQUEST"

    def __init__(self, message: str, **kw):
        super().__init__(message, retryable=False, fallback=True, **kw)


class ProviderContextOverflowError(ProviderError):
    """Prompt exceeds the model context window."""

    code = "AI_PROVIDER_CONTEXT_OVERFLOW"

    def __init__(self, message: str, **kw):
        super().__init__(message, retryable=True, fallback=True, **kw)


class ProviderMalformedResponseError(ProviderError):
    """The provider returned unparsable/non-JSON payload."""

    code = "AI_PROVIDER_MALFORMED_RESPONSE"

    def __init__(self, message: str, **kw):
        super().__init__(message, retryable=True, fallback=True, **kw)


class ProviderUnavailableError(ProviderError):
    """No providers are configured / all providers exhausted."""

    code = "AI_PROVIDER_UNAVAILABLE"

    def __init__(self, message: str, **kw):
        super().__init__(message, retryable=True, fallback=False, **kw)


class ProviderCancelledError(ProviderError):
    """Task was cancelled mid-request."""

    code = "AI_PROVIDER_CANCELLED"

    def __init__(self, message: str, **kw):
        super().__init__(message, retryable=False, fallback=False, **kw)


# ---------------------------------------------------------------------------
# Streaming event types
# ---------------------------------------------------------------------------
class StreamEventType(str, Enum):
    REASONING = "reasoning"
    CONTENT = "content"
    PROGRESS = "progress"
    COMPLETE = "complete"
    ERROR = "error"


@dataclass
class StreamEvent:
    """One streaming event emitted by :meth:`AIProvider.stream`."""

    type: StreamEventType
    data: str = ""
    task_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value,
            "task_id": self.task_id,
            "data": self.data,
            "metadata": self.metadata,
        }


# ---------------------------------------------------------------------------
# Provider interface
# ---------------------------------------------------------------------------
class AIProvider(ABC):
    """Common interface every provider adapter implements."""

    #: canonical provider slug: "nvidia" | "openrouter" | "gemini"
    name: str = "base"

    def __init__(self, model: str, api_key: str, *, user_id: Optional[int] = None,
                 timeout: float = 60.0, max_retries: int = 2):
        self.model = model
        self.api_key = api_key
        self.user_id = user_id
        self.timeout = timeout
        self.max_retries = max_retries
        self._cancelled = False

    # -- lifecycle ----------------------------------------------------------
    def cancel(self) -> None:
        """Cooperatively request cancellation. A running call checks this flag."""
        self._cancelled = True

    def _check_cancelled(self) -> None:
        if self._cancelled:
            raise ProviderCancelledError(f"{self.name} request cancelled")

    # -- interface ----------------------------------------------------------
    @abstractmethod
    def generate(self, messages: List[Dict[str, str]], *,
                 temperature: float = 0.7, top_p: float = 0.95,
                 max_tokens: int = 4096, reasoning_budget: Optional[int] = None,
                 enable_thinking: Optional[bool] = None,
                 **kwargs: Any) -> AIResponse:
        """Non-streaming generation. Returns normalized AIResponse."""

    @abstractmethod
    def generate_structured(self, messages: List[Dict[str, str]], *,
                            temperature: float = 0.7, top_p: float = 0.95,
                            max_tokens: int = 4096,
                            reasoning_budget: Optional[int] = None,
                            enable_thinking: Optional[bool] = None,
                            **kwargs: Any) -> AIResponse:
        """Like :meth:`generate` but asserts the response is parseable JSON."""

    def stream(self, messages: List[Dict[str, str]], *,
               temperature: float = 0.7, top_p: float = 0.95,
               max_tokens: int = 4096, reasoning_budget: Optional[int] = None,
               enable_thinking: Optional[bool] = None,
               task_id: Optional[str] = None,
               **kwargs: Any) -> Iterator[StreamEvent]:
        """Default streaming = accumulate full response then emit events."""
        started = time.monotonic()
        resp = self.generate(
            messages, temperature=temperature, top_p=top_p,
            max_tokens=max_tokens, reasoning_budget=reasoning_budget,
            enable_thinking=enable_thinking, **kwargs,
        )
        resp.latency_ms = int((time.monotonic() - started) * 1000)
        if resp.reasoning:
            yield StreamEvent(StreamEventType.REASONING, resp.reasoning, task_id=task_id)
        if resp.content:
            yield StreamEvent(StreamEventType.CONTENT, resp.content, task_id=task_id)
        yield StreamEvent(StreamEventType.COMPLETE, "", task_id=task_id,
                          metadata=resp.to_dict())

    @abstractmethod
    def health_check(self) -> bool:
        """Lightweight connectivity/credentials check."""

    def close(self) -> None:
        """Release any pooled resources. Default no-op."""


# ---------------------------------------------------------------------------
# Utility: translated error messages (never expose internals)
# ---------------------------------------------------------------------------
SAFE_PROVIDER_MESSAGES = {
    "rate limit": "The AI provider rate limited the request. It will be retried.",
    "timeout": "The AI provider timed out. The request will be retried.",
}