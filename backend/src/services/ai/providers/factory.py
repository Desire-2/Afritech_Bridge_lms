"""Task-scoped provider factory + fallback chain.

Instantiation decisions:

* A NEW provider instance is created for EVERY call site (per task). No
  provider is cached in a process-wide singleton, so a given user's key can
  never leak into another user's request (provider isolation / SEC-1).
* Fallback order is NVIDIA first, then the configured fallback providers. A
  provider is only skipped when it reports a *fallback-eligible* error; the
  provider itself already retried transient failures internally before
  surfacing them (retry-then-fallback semantics).
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Dict, List, Optional, Type, Union, Tuple

from . import config
from .base import AIProvider, ProviderError, ProviderUnavailableError, ProviderAuthError
from .nvidia import NVIDIAProvider
from .openrouter import OpenRouterProvider
from .gemini import GeminiProvider
from .resolver import resolve_provider_config, is_provider_configured

logger = logging.getLogger(__name__)

PROVIDER_CLASSES: Dict[str, Type[AIProvider]] = {
    "nvidia": NVIDIAProvider,
    "openrouter": OpenRouterProvider,
    "gemini": GeminiProvider,
}


def available_providers(user_id: Optional[int] = None,
                        preferred: Optional[str] = None) -> List[str]:
    """Ordered list of provider slugs, most-preferred first.

    NVIDIA defaults to first (unless a preferred provider is configured and
    usable). Providers that cannot resolve credentials are skipped with a log.
    """
    order = [preferred] if preferred else [config.DEFAULT_AI_PROVIDER]
    for p in config.FALLBACK_PROVIDER_ORDER:
        if p not in order:
            order.append(p)
    result = []
    for p in order:
        if p not in PROVIDER_CLASSES:
            continue
        if not is_provider_configured(p, user_id=user_id):
            logger.warning("provider '%s' has no credentials configured; skipped", p)
            continue
        result.append(p)
    return result


def build_provider(provider: str, user_id: Optional[int] = None, *,
                   override_model: Optional[str] = None,
                   extra: Optional[Dict[str, Any]] = None) -> AIProvider:
    """Construct one request/task-scoped provider instance."""
    cls = PROVIDER_CLASSES.get(provider)
    if cls is None:
        raise ProviderUnavailableError(f"Unknown provider: {provider}")
    cfg = resolve_provider_config(provider, user_id=user_id,
                                  override_model=override_model)
    if not cfg.get("api_key"):
        raise ProviderAuthError(
            f"{provider} API key is not configured for this user.",
            provider=provider, human_review=True,
        )
    kwargs: Dict[str, Any] = {"api_key": cfg.api_key, "user_id": user_id}
    if override_model or cfg.get("model"):
        kwargs["model"] = override_model or cfg["model"]
    if cfg.get("base_url"):
        kwargs["base_url"] = cfg["base_url"]
    if provider == "nvidia" and extra:
        for field in ("timeout", "max_retries", "enable_thinking",
                      "reasoning_budget", "default_temperature",
                      "default_top_p", "default_max_tokens"):
            if field in extra:
                kwargs[field] = extra[field]
    return cls(**kwargs)


def get_provider(provider: Optional[str] = None,
                 user_id: Optional[int] = None,
                 override_model: Optional[str] = None,
                 extra: Optional[Dict[str, Any]] = None) -> AIProvider:
    """Build the primary provider (first usable in the chain)."""
    providers = available_providers(user_id=user_id, preferred=provider)
    if not providers:
        raise ProviderUnavailableError(
            "No AI provider is configured. Add an NVIDIA/OpenRouter/Gemini API key.",
            human_review=True,
        )
    return build_provider(providers[0], user_id=user_id,
                          override_model=override_model, extra=extra)


def run_with_fallback(callable_fn: Callable[[AIProvider], Any],
                      user_id: Optional[int] = None,
                      provider: Optional[str] = None,
                      override_model: Optional[str] = None,
                      extra: Optional[Dict[str, Any]] = None) -> Tuple[Any, str, str]:
    """Run ``callable_fn(provider)`` with retry-then-fallback semantics.

    The provider receives the first *usable* provider. ``callable_fn`` is
    typically a closure that calls ``provider.generate(...)``. When a
    ProviderError is raised that is eligible for fallback (e.g. exhausted
    rate limit, auth error, server outage), the chain advances to the next
    configured provider. Non-fallback errors (malformed payloads that are
    provider-agnostic) propagate immediately.

    Returns ``(result, provider_name, model_name)``.
    """
    chain = available_providers(user_id=user_id, preferred=provider)
    if not chain:
        raise ProviderUnavailableError(
            "No AI provider is configured. Add an NVIDIA/OpenRouter/Gemini API key.",
            human_review=True,
        )
    last_error: Optional[ProviderError] = None
    for provider_name in chain:
        instance = build_provider(provider_name, user_id=user_id,
                                  override_model=override_model, extra=extra)
        try:
            result = callable_fn(instance)
            return result, provider_name, instance.model
        except ProviderError as err:
            last_error = err
            logger.warning(
                "provider '%s' failed with %s (fallback=%s): %s",
                provider_name, err.code, err.fallback, err.message,
            )
            if not err.fallback:
                raise
            continue
        finally:
            try:
                instance.close()
            except Exception:  # pragma: no cover
                pass
    if last_error is not None:
        raise last_error
    raise ProviderUnavailableError("Provider fallback chain exhausted")  # pragma: no cover