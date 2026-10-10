"""OpenRouter provider adapter (fallback tier).

OpenRouter exposes an OpenAI-compatible endpoint. This adapter uses the same
retry/backoff/error-normalization helpers as the NVIDIA provider through the
`openai` transport when available, otherwise raw requests.
"""

from __future__ import annotations

import re
import json
import time
import random
import logging
from typing import Any, Dict, Iterator, List, Optional

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
    ProviderContextOverflowError,
    ProviderMalformedResponseError,
    ProviderCancelledError,
    ProviderUnavailableError,
)

logger = logging.getLogger(__name__)

try:
    from openai import OpenAI  # type: ignore
    OPENAI_SDK_AVAILABLE = True
except Exception:  # pragma: no cover
    OpenAI = None  # type: ignore
    OPENAI_SDK_AVAILABLE = False


class OpenRouterProvider(AIProvider):
    """OpenRouter OpenAI-compatible provider (fallback tier)."""

    name = "openrouter"

    def __init__(self, model: Optional[str] = None, api_key: Optional[str] = None, *,
                 base_url: Optional[str] = None, user_id: Optional[int] = None,
                 timeout: Optional[float] = None, max_retries: Optional[int] = None):
        if not api_key:
            raise ProviderAuthError(
                "OpenRouter API key is not configured.",
                human_review=True,
            )
        model = model or config.OPENROUTER_AI_MODEL
        super().__init__(
            model=model, api_key=api_key, user_id=user_id,
            timeout=timeout or config.OPENROUTER_AI_TIMEOUT_SECONDS,
            max_retries=max_retries or config.OPENROUTER_AI_MAX_RETRIES,
        )
        self.base_url = base_url or config.OPENROUTER_AI_BASE_URL.rstrip("/")
        self._http = requests.Session()
        self._client: Any = None
        if OPENAI_SDK_AVAILABLE:
            self._client = OpenAI(
                base_url=self.base_url, api_key=api_key,
                default_headers={"HTTP-Referer": "", "X-Title": "AfritecBridgeLMS"},
            )

    # ------------------------------------------------------------------
    def _normalize_error(self, exc: Exception) -> ProviderError:
        if isinstance(exc, ProviderError):
            return exc
        status = getattr(exc, "status_code", None)
        if status is None:
            response = getattr(exc, "response", None)
            status = getattr(response, "status_code", None)
        message = str(exc)
        msg_lower = message.lower()
        if status == 429 or "rate limit" in msg_lower:
            return ProviderRateLimitError(
                "OpenRouter rate limited the request. It will be retried.",
                provider=self.name, original=exc,
            )
        if status in (401, 403):
            return ProviderAuthError(
                "OpenRouter rejected the API key.",
                provider=self.name, original=exc,
            )
        if status == 400 and ("context" in msg_lower or "token" in msg_lower):
            return ProviderContextOverflowError(
                "The request exceeded the OpenRouter model context window.",
                provider=self.name, original=exc,
            )
        if status and status >= 500:
            return ProviderTemporaryError(
                "OpenRouter returned a temporary server error.",
                provider=self.name, original=exc,
            )
        return ProviderTemporaryError(
            "OpenRouter request failed.", provider=self.name, original=exc,
        )

    def _call(self, messages, temperature, top_p, max_tokens, stream):
        self._check_cancelled()
        if self._client is not None:
            try:
                return self._client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=temperature,
                    top_p=top_p,
                    max_tokens=max_tokens,
                    stream=stream,
                )
            except ProviderError:
                raise
            except Exception as exc:  # noqa: BLE001
                raise self._normalize_error(exc) from None
        # requests transport
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": max_tokens,
            "stream": stream,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "",
            "X-Title": "AfritecBridgeLMS",
        }
        try:
            self._check_cancelled()
            resp = self._http.post(
                self.base_url + "/chat/completions", headers=headers,
                json=payload, timeout=self.timeout, stream=stream,
            )
            if resp.status_code >= 400:
                err: ProviderError
                if resp.status_code >= 500:
                    err = ProviderTemporaryError(
                        f"OpenRouter HTTP {resp.status_code}", provider=self.name)
                elif resp.status_code in (401, 403):
                    err = ProviderAuthError(
                        "OpenRouter rejected the API key.", provider=self.name)
                else:
                    err = ProviderInvalidRequestError(
                        f"OpenRouter HTTP {resp.status_code}", provider=self.name)
                raise err
            if stream:
                return resp
            return resp.json()
        except ProviderError:
            raise
        except requests.exceptions.Timeout:
            raise ProviderTimeoutError("OpenRouter timed out.", provider=self.name) from None
        except requests.exceptions.RequestException as exc:
            raise self._normalize_error(exc) from None

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
                time.sleep(delay)
                delay = min(10.0, delay * 2) + random.uniform(0, 0.5)
            try:
                result = self._call(messages, temperature, top_p, max_tokens, False)
                if self._client is not None:
                    choice = result.choices[0]
                    message = getattr(choice, "message", None)
                    content = getattr(message, "content", None) or ""
                    reasoning = getattr(message, "reasoning_content", None) or ""
                    return AIResponse(
                        content=content, reasoning=reasoning, provider=self.name,
                        model=self.model, latency_ms=int((time.monotonic() - started) * 1000),
                        finish_reason=getattr(choice, "finish_reason", None),
                        request_id=getattr(result, "id", None),
                    )
                choice = result["choices"][0]
                message = choice.get("message", {}) or {}
                return AIResponse(
                    content=message.get("content") or "",
                    reasoning=message.get("reasoning_content") or "",
                    provider=self.name, model=self.model,
                    finish_reason=choice.get("finish_reason"),
                    request_id=result.get("id"),
                    latency_ms=int((time.monotonic() - started) * 1000),
                )
            except ProviderCancelledError:
                raise
            except ProviderError as err:
                if not err.retryable or attempt >= self.max_retries:
                    raise
                attempt += 1
            except Exception as exc:  # pragma: no cover - defensive
                err = self._normalize_error(exc)
                if attempt >= self.max_retries:
                    raise err from exc
                attempt += 1
        raise ProviderUnavailableError("OpenRouter generation failed")  # pragma: no cover

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
        cleaned = resp.content.strip()
        if not cleaned:
            raise ProviderMalformedResponseError(
                "OpenRouter returned an empty response.", provider=self.name)
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        try:
            json.loads(cleaned)
        except (json.JSONDecodeError, TypeError) as exc:
            raise ProviderMalformedResponseError(
                "OpenRouter returned a non-JSON response.",
                provider=self.name, original=exc) from None
        return resp

    def stream(self, messages: List[Dict[str, str]], *,
               temperature: float = 0.7, top_p: float = 0.95,
               max_tokens: int = 4096,
               reasoning_budget: Optional[int] = None,
               enable_thinking: Optional[bool] = None,
               task_id: Optional[str] = None, **kwargs: Any):
        result = self._call(messages, temperature, top_p, max_tokens, True)
        content_parts: List[str] = []
        if self._client is not None:
            for chunk in result:
                self._check_cancelled()
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                if delta is None:
                    continue
                content = getattr(delta, "content", None)
                if content:
                    content_parts.append(content)
                    yield StreamEvent(StreamEventType.CONTENT, content, task_id=task_id)
        else:
            for line in result.iter_lines():
                self._check_cancelled()
                line = line.decode() if isinstance(line, bytes) else line
                if not line or not line.startswith("data:"):
                    continue
                data = line[len("data:"):].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                except (json.JSONDecodeError, TypeError):
                    continue
                if not chunk.get("choices"):
                    continue
                delta = chunk["choices"][0].get("delta") or {}
                content = delta.get("content")
                if content:
                    content_parts.append(content)
                    yield StreamEvent(StreamEventType.CONTENT, content, task_id=task_id)
        if self._cancelled:
            raise ProviderCancelledError("OpenRouter stream cancelled", provider=self.name)
        yield StreamEvent(
            StreamEventType.COMPLETE, "", task_id=task_id,
            metadata=AIResponse(
                content="".join(content_parts), provider=self.name,
                model=self.model,
            ).to_dict(),
        )

    def health_check(self) -> bool:
        try:
            self.generate(
                [{"role": "user", "content": "ping: reply ok"}],
                max_tokens=8,
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