"""Request/task-scoped credential resolution.

SECURITY: this module is the ONLY place where the search order for API keys is
defined. There is no process-wide mutable provider object holding keys; every
caller asks the resolver for a *snapshot* for a given user, then the factory
builds a provider instance for that single task. Providers are never shared
across users or threads (provider isolation / SEC-1).
"""

from __future__ import annotations

import os
import logging
from typing import Any, Dict, Optional

from . import config

logger = logging.getLogger(__name__)


def _user_setting_value(user_id: Optional[int], attr: str,
                        default: Optional[Any] = None) -> Any:
    """Read a per-user setting without raising when DB access fails.

    Returns ``default`` if the models aren't available (e.g. unit tests or a
    fresh environment before migrations).
    """
    if not user_id:
        return default
    try:
        from ....models.system_settings_models import UserAISetting

        setting = UserAISetting.query.filter_by(user_id=user_id).first()
        if setting is not None:
            value = getattr(setting, attr)
            if value:
                return value
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug("user setting lookup failed: %s", exc)
    return default


def _system_setting_value(key: str, default: Optional[Any] = None) -> Any:
    try:
        from ....models.system_settings_models import SystemSettingsManager

        value = SystemSettingsManager.get_setting(key, None)
        if value:
            return value
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug("system setting lookup failed: %s", exc)
    return default


def _resolve_key(env_var: str, setting_keys: str, user_attr: Optional[str],
                 user_id: Optional[int], ioc_field: Optional[str] = None) -> str:
    """Resolution order: per-user DB -> global DB -> environment."""
    if user_attr and user_id:
        user_value = _user_setting_value(user_id, user_attr)
        if user_value and str(user_value).strip():
            return str(user_value).strip()
    db_value = _system_setting_value(setting_keys)
    if db_value and str(db_value).strip():
        return str(db_value).strip()
    env_value = os.environ.get(env_var)
    if env_value and str(env_value).strip():
        return str(env_value).strip()
    # last resort: pre-configured injection (kept out of env for tests)
    if ioc_field:
        from flask import current_app
        try:
            if current_app:
                injected = current_app.config.get(ioc_field)
                if injected and str(injected).strip():
                    return str(injected).strip()
        except Exception:  # pragma: no cover - no app context
            pass
    return ""


class ProviderConfig(dict):
    """Resolved, snapshot provider credentials for one user/task."""

    @property
    def api_key(self) -> str:
        return self.get("api_key", "")


def resolve_provider_config(provider: str, user_id: Optional[int] = None,
                            override_model: Optional[str] = None) -> ProviderConfig:
    """Build a task-scoped provider configuration snapshot.

    Args:
        provider: "nvidia" | "openrouter" | "gemini"
        user_id: the acting user (whose own key wins over global/env keys).
        override_model: optional per-request model override.

    Returns a ProviderConfig dict; never holds secrets across call boundaries.
    """
    if provider == "nvidia":
        api_key = _resolve_key(
            env_var="NVIDIA_API_KEY",
            setting_keys="nvidia_api_key",
            user_attr="nvidia_api_key",
            user_id=user_id,
            ioc_field="NVIDIA_API_KEY",
        )
        model = override_model or _user_setting_value(
            user_id, "nvidia_model_name") or _system_setting_value(
            "nvidia_model_name") or config.NVIDIA_AI_MODEL
        return ProviderConfig(
            provider="nvidia", api_key=api_key, model=model,
            base_url=config.NVIDIA_AI_BASE_URL,
        )
    if provider == "openrouter":
        api_key = _resolve_key(
            env_var="OPENROUTER_API_KEY",
            setting_keys="openrouter_api_key",
            user_attr="openrouter_api_key",
            user_id=user_id,
        )
        model = override_model or _user_setting_value(
            user_id, "openrouter_model_name") or _system_setting_value(
            "openrouter_model_name") or config.OPENROUTER_AI_MODEL
        return ProviderConfig(
            provider="openrouter", api_key=api_key, model=model,
        )
    if provider == "gemini":
        api_key = _resolve_key(
            env_var="GEMINI_API_KEY",
            setting_keys="gemini_api_key",
            user_attr="gemini_api_key",
            user_id=user_id,
        )
        model = override_model or _user_setting_value(
            user_id, "gemini_model_name") or _system_setting_value(
            "gemini_model_name") or config.GEMINI_AI_MODEL
        return ProviderConfig(
            provider="gemini", api_key=api_key, model=model,
        )
    raise ValueError(f"Unknown provider: {provider}")


def is_provider_configured(provider: str, user_id: Optional[int] = None) -> bool:
    """True when at least one credential source is available for ``provider``."""
    return bool(resolve_provider_config(provider, user_id=user_id).get("api_key"))