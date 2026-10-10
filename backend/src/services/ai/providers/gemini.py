"""Google Gemini provider adapter (fallback tier).

Wraps the `google-generativeai` SDK. IMPORTANT: unlike the legacy provider in
`ai_providers.py` there is deliberately NO bare ``raise`` inside an ``except``
block (that historical bug produced a ``RuntimeError: No active exception to
re-raise`` in every handled failure), and every error is normalized into the
shared :class:`ProviderError` hierarchy.
"""

from __future__ import annotations

import re
import json
import time
from typing import Any, Dict, List, Optional

import requests

from . import config
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
    ProviderMalformedResponseError,
    ProviderCancelledError,
    ProviderUnavailableError,
)

try:
    import google.generativeai as genai  # type: ignore
    GOOGLE_SDK_AVAILABLE = True
except Exception:  # pragma: no cover
    genai = None  # type: ignore
    GOOGLE_SDK_AVAILABLE = False


class GeminiProvider(AIProvider):
    """Gemini (Google Generative Language API) adapter."""

    name = "gemini"

    def __init__(self, model: Optional[str] = None, api_key: Optional[str] = None, *,
                 user_id: Optional[int] = None, timeout: Optional[float] = None,
                 max_retries: Optional[int] = None):
        if not api_key:
            raise ProviderAuthError(
                "Gemini API key is not configured.",
                human_review=True,
            )
        model = model or config.GEMINI_AI_MODEL
        super().__init__(
            model=model, api_key=api_key, user_id=user_id,
            timeout=timeout or config.GEMINI_AI_TIMEOUT_SECONDS,
            max_retries=max_retries or config.GEMINI_AI_MAX_RETRIES,
        )

    def _normalize_error(self, exc: Exception) -> ProviderError:
        if isinstance(exc, ProviderError):
            return exc
        message = str(exc)
        msg_lower = message.lower()
        status = getattr(exc, "status_code", None) or getattr(
            getattr(exc, "response", None), "status_code", None)
        if status == 429 or "rate limit" in msg_lower or "resource exhausted" in msg_lower:
            return ProviderRateLimitError(
                "Gemini rate limited the request. It will be retried.",
                provider=self.name, original=exc,
            )
        if status in (400, 403) or "api key not valid" in msg_lower or "permission" in msg_lower:
            return ProviderAuthError(
                "Gemini rejected the API key or permission.",
                provider=self.name, original=exc,
            )
        if "maximum concurrency" in msg_lower and "quota" not in msg_lower:
            return ProviderRateLimitError(
                "Gemini concurrency limit hit. It will be retried.",
                provider=self.name, original=exc,
            )
        if status and status >= 500:
            return ProviderTemporaryError(
                "Gemini returned a temporary error.",
                provider=self.name, original=exc,
            )
        if isinstance(exc, (requests.exceptions.Timeout, TimeoutError)):
            return ProviderTimeoutError(
                "Gemini timed out.", provider=self.name, original=exc,
            )
        return ProviderTemporaryError(
            "Gemini request failed.", provider=self.name, original=exc,
        )

    def generate(self, messages: List[Dict[str, str]], *,
                 temperature: float = 0.7, top_p: float = 0.95,
                 max_tokens: int = 4096,
                 reasoning_budget: Optional[int] = None,
                 enable_thinking: Optional[bool] = None,
                 **kwargs: Any) -> AIResponse:
        started = time.monotonic()
        attempt = 0
        delay = 0.5
        while True:
            self._check_cancelled()
            if attempt > 0:
                import random
                time.sleep(delay)
                delay = min(10.0, delay * 2) + random.uniform(0, 0.5)
            try:
                return self._single_generate(
                    messages, temperature, top_p, max_tokens, started)
            except ProviderCancelledError:
                raise
            except ProviderError as err:
                if not err.retryable or attempt >= self.max_retries:
                    raise
                attempt += 1
            except Exception as exc:  # noqa: BLE001 - normalize everything
                err = self._normalize_error(exc)
                if not err.retryable or attempt >= self.max_retries:
                    raise err from exc
                attempt += 1
        raise ProviderUnavailableError("Gemini generation failed")  # pragma: no cover

    def _single_generate(self, messages, temperature, top_p, max_tokens, started):
        if not GOOGLE_SDK_AVAILABLE:
            raise ProviderUnavailableError(
                "Google Generative AI SDK is not installed.",
                provider=self.name,
            )
        genai.configure(api_key=self.api_key)
        client = genai.GenerativeModel(
            self.model,
            generation_config=genai.types.GenerationConfig(
                temperature=temperature,
                top_p=top_p,
                max_output_tokens=max_tokens,
            ),
        )
        prompt = self._conversation_to_prompt(messages)
        response = client.generate_content(prompt, stream=False)
        text = getattr(response, "text", "") or ""
        if not text and response.parts:
            text = "".join(
                (p.text or "") if hasattr(p, "text") else (p or "")
                for p in response.parts
            )
        finish_reason = None
        try:
            fr = response.candidates[0].finish_reason
            finish_reason = str(fr.name if hasattr(fr, "name") else fr)
        except Exception:  # pragma: no cover
            pass
        return AIResponse(
            content=text,
            provider=self.name,
            model=self.model,
            finish_reason=finish_reason,
            latency_ms=int((time.monotonic() - started) * 1000),
        )

    @staticmethod
    def _conversation_to_prompt(messages):
        last = messages[-1]
        if last.get("role") == "user":
            return last.get("content", "")
        parts = []
        for m in messages:
            role = "Assistant" if m.get("role") in ("assistant", "system") else "User"
            parts.append(f"{role}: {m.get('content', '')}")
        return "\n\n".join(parts)

    def generate_structured(self, messages: List[Dict[str, str]], *,
                            temperature: float = 0.7, top_p: float = 0.95,
                            max_tokens: int = 4096,
                            reasoning_budget: Optional[int] = None,
                            enable_thinking: Optional[bool] = None,
                            **kwargs: Any) -> AIResponse:
        resp = self.generate(
            messages, temperature=temperature, top_p=top_p, max_tokens=max_tokens,
            reasoning_budget=reasoning_budget, enable_thinking=enable_thinking, **kwargs,
        )
        text = resp.content.strip()
        if not text:
            raise ProviderMalformedResponseError(
                "Gemini returned an empty response.", provider=self.name)
        # google SDK returns code-block-wrapped JSON frequently
        cleaned = text.strip().removeprefix("```json").removeprefix("```").strip()
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].rstrip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        try:
            json.loads(cleaned)
        except (json.JSONDecodeError, TypeError) as exc:
            raise ProviderMalformedResponseError(
                "Gemini returned a non-JSON response.",
                provider=self.name, original=exc) from None
        return resp

    def stream(self, messages: List[Dict[str, str]], *,
               temperature: float = 0.7, top_p: float = 0.95,
               max_tokens: int = 4096,
               reasoning_budget: Optional[int] = None,
               enable_thinking: Optional[bool] = None,
               task_id: Optional[str] = None, **kwargs: Any):
        # Gemini streaming is a full-response accumulator; keep it simple.
        resp = self.generate(
            messages, temperature=temperature, top_p=top_p, max_tokens=max_tokens,
            reasoning_budget=reasoning_budget, enable_thinking=enable_thinking, **kwargs,
        )
        if resp.content:
            yield StreamEvent(StreamEventType.CONTENT, resp.content, task_id=task_id)
        yield StreamEvent(StreamEventType.COMPLETE, "", task_id=task_id,
                          metadata=resp.to_dict())

    def health_check(self) -> bool:
        try:
            self.generate([{"role": "user", "content": "ping"}], max_tokens=8)
            return True
        except ProviderError:
            return False
        except Exception:  # pragma: no cover
            return False