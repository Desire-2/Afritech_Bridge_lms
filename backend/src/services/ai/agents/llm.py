"""Shared LLM client used by every agent.

Built ONCE per agent instance (created per task-execution) and handed an
already-resolved set of provider credentials for the CURRENT user/task. The
client wraps :func:`run_with_fallback`, enforcing retry-then-fallback and
task-aware reasoning budgets from ``providers/config``.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from ..providers.factory import run_with_fallback, build_provider
from ..providers import config
from ..providers.base import AIResponse, ProviderError

logger = logging.getLogger(__name__)


class LLMClient:
    """Run generation with fallback for one task/user context."""

    def __init__(self, user_id: Optional[int] = None, provider: Optional[str] = None,
                 override_model: Optional[str] = None,
                 task_id: Optional[str] = None):
        self.user_id = user_id
        self.provider = provider
        self.override_model = override_model
        self.task_id = task_id

    def _extra(self, profile: str) -> Dict[str, Any]:
        return {
            "enable_thinking": config.NVIDIA_AI_ENABLE_THINKING,
            "reasoning_budget": config.reasoning_budget_for(profile),
            "default_temperature": config.temperature_for(profile),
        }

    def generate(self, messages: List[Dict[str, str]], *, profile: str = "planning",
                 max_tokens: Optional[int] = None, temperature: Optional[float] = None,
                 **kwargs: Any) -> AIResponse:
        budget = config.reasoning_budget_for(profile)
        temp = temperature if temperature is not None else config.temperature_for(profile)
        extra = self._extra(profile)
        extra["default_temperature"] = temp
        extra["reasoning_budget"] = budget
        if max_tokens:
            extra["default_max_tokens"] = max_tokens

        def _call(provider_instance):
            return provider_instance.generate(
                messages,
                temperature=temp,
                reasoning_budget=budget,
                max_tokens=max_tokens or config.NVIDIA_AI_MAX_TOKENS,
            )

        result, provider_name, model = run_with_fallback(
            _call, user_id=self.user_id, provider=self.provider,
            override_model=self.override_model, extra=extra,
        )
        return result

    def generate_structured(self, messages: List[Dict[str, str]], *,
                            profile: str = "planning",
                            max_tokens: Optional[int] = None,
                            temperature: Optional[float] = None,
                            **kwargs: Any) -> AIResponse:
        budget = config.reasoning_budget_for(profile)
        temp = temperature if temperature is not None else config.temperature_for(profile)
        extra = self._extra(profile)
        extra["default_temperature"] = temp
        extra["reasoning_budget"] = budget
        if max_tokens:
            extra["default_max_tokens"] = max_tokens

        def _call(provider_instance):
            return provider_instance.generate_structured(
                messages,
                temperature=temp,
                reasoning_budget=budget,
                max_tokens=max_tokens or config.NVIDIA_AI_MAX_TOKENS,
            )

        result, provider_name, model = run_with_fallback(
            _call, user_id=self.user_id, provider=self.provider,
            override_model=self.override_model, extra=extra,
        )
        return result

    def healthcheck(self) -> Dict[str, Any]:
        """Report which providers are configured (no secrets)."""
        return {
            "configured_providers": config_presence(self.user_id),
            "default_provider": config.DEFAULT_AI_PROVIDER,
            "nvidia": {
                "model": config.NVIDIA_AI_MODEL,
                "thinking": config.NVIDIA_AI_ENABLE_THINKING,
            },
        }


def config_presence(user_id: Optional[int] = None) -> Dict[str, bool]:
    from ..providers.resolver import is_provider_configured
    return {p: is_provider_configured(p, user_id=user_id)
            for p in ("nvidia", "openrouter", "gemini")}