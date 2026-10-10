"""Centralized AI provider configuration and task-aware reasoning budgets.

All provider constants live here and are overridable through the standard
12-factor environment (``dotenv``) mechanism. Nothing here hard-codes secrets.
"""

from __future__ import annotations

import os
from typing import Dict, Optional


def _env_int(key: str, default: int) -> int:
    try:
        return int(os.environ.get(key, default))
    except (TypeError, ValueError):
        return default


def _env_float(key: str, default: float) -> float:
    try:
        return float(os.environ.get(key, default))
    except (TypeError, ValueError):
        return default


def _env_bool(key: str, default: bool) -> bool:
    val = os.environ.get(key)
    if val is None:
        return default
    return val.strip().lower() in ("true", "1", "yes", "on")


# -- default provider --------------------------------------------------------
DEFAULT_AI_PROVIDER = os.environ.get("AI_DEFAULT_PROVIDER", "nvidia")


# -- NVIDIA ------------------------------------------------------------------
NVIDIA_AI_BASE_URL = os.environ.get(
    "NVIDIA_AI_BASE_URL", "https://integrate.api.nvidia.com/v1"
)
NVIDIA_AI_MODEL = os.environ.get(
    "NVIDIA_AI_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b"
)
NVIDIA_AI_TEMPERATURE = _env_float("NVIDIA_AI_TEMPERATURE", 1.0)
NVIDIA_AI_TOP_P = _env_float("NVIDIA_AI_TOP_P", 0.95)
NVIDIA_AI_MAX_TOKENS = _env_int("NVIDIA_AI_MAX_TOKENS", 16384)
NVIDIA_AI_REASONING_BUDGET = _env_int("NVIDIA_AI_REASONING_BUDGET", 16384)
NVIDIA_AI_ENABLE_THINKING = _env_bool("NVIDIA_AI_ENABLE_THINKING", True)
NVIDIA_AI_TIMEOUT_SECONDS = _env_int("NVIDIA_AI_TIMEOUT_SECONDS", 120)
NVIDIA_AI_MAX_RETRIES = _env_int("NVIDIA_AI_MAX_RETRIES", 2)
NVIDIA_AI_MAX_RPM = _env_int("NVIDIA_AI_MAX_RPM", 60)

# -- fallback providers ------------------------------------------------------
OPENROUTER_AI_BASE_URL = os.environ.get(
    "OPENROUTER_AI_BASE_URL", "https://openrouter.ai/api/v1"
)
OPENROUTER_AI_MODEL = os.environ.get(
    "OPENROUTER_AI_MODEL", "nvidia/nemotron-3-super-120b-a12b:free"
)
OPENROUTER_AI_TIMEOUT_SECONDS = _env_int("OPENROUTER_AI_TIMEOUT_SECONDS", 60)
OPENROUTER_AI_MAX_RETRIES = _env_int("OPENROUTER_AI_MAX_RETRIES", 2)

GEMINI_AI_MODEL = os.environ.get("GEMINI_AI_MODEL", "gemini-2.0-flash")
GEMINI_AI_TIMEOUT_SECONDS = _env_int("GEMINI_AI_TIMEOUT_SECONDS", 60)
GEMINI_AI_MAX_RETRIES = _env_int("GEMINI_AI_MAX_RETRIES", 2)

# -- fallback order ----------------------------------------------------------
# NVIDIA is primary; OpenRouter and Gemini are fallbacks.
FALLBACK_PROVIDER_ORDER = [p for p in
                           os.environ.get("AI_FALLBACK_PROVIDERS",
                                          "openrouter,gemini").split(",")
                           if p.strip()]


# -- reasoning budgets -------------------------------------------------------
# Higher-budget reasoning on planning/repair, low on mechanical tasks.
# Values are configurable via env: AI_REASONING_BUDGET_<PROFILE>.
_REASONING_BUDGETS = {
    "planning": 16384,
    "curriculum": 16384,
    "lesson_generation": 8192,
    "assessment_generation": 4096,
    "formatting": 1024,
    "validation": 4096,
    "repair": 16384,
    "research": 8192,
    "review": 4096,
    "consistency": 8192,
    "completion": 2048,
}

_TEMPERATURES = {
    "planning": 0.8,
    "curriculum": 0.8,
    "lesson_generation": 0.9,
    "assessment_generation": 0.7,
    "formatting": 0.3,
    "validation": 0.2,
    "repair": 0.7,
    "research": 0.7,
    "review": 0.2,
    "consistency": 0.2,
    "completion": 0.2,
}


def reasoning_budget_for(profile: str) -> int:
    """Return the reasoning budget for a task profile (env-overridable)."""
    key = f"AI_REASONING_BUDGET_{profile.upper()}"
    return _env_int(key, _REASONING_BUDGETS.get(profile, 4096))


def temperature_for(profile: str) -> float:
    """Return the temperature for a task profile (env-overridable)."""
    return _env_float(f"AI_TEMPERATURE_{profile.upper()}",
                      _TEMPERATURES.get(profile, 0.7))


def nvidia_defaults() -> Dict[str, object]:
    """Return the current NVIDIA environment defaults (no secrets)."""
    return {
        "provider": "nvidia",
        "model": NVIDIA_AI_MODEL,
        "base_url": NVIDIA_AI_BASE_URL,
        "temperature": NVIDIA_AI_TEMPERATURE,
        "top_p": NVIDIA_AI_TOP_P,
        "max_tokens": NVIDIA_AI_MAX_TOKENS,
        "reasoning_budget": NVIDIA_AI_REASONING_BUDGET,
        "enable_thinking": NVIDIA_AI_ENABLE_THINKING,
        "timeout": NVIDIA_AI_TIMEOUT_SECONDS,
        "max_retries": NVIDIA_AI_MAX_RETRIES,
        "max_rpm": NVIDIA_AI_MAX_RPM,
    }


def nvidia_public_metadata() -> Dict[str, object]:
    """Safe-to-expose metadata (never contains credentials)."""
    return {
        "provider": "nvidia",
        "model": NVIDIA_AI_MODEL,
        "thinking_enabled": NVIDIA_AI_ENABLE_THINKING,
        "base_url": NVIDIA_AI_BASE_URL,
        "temperature": NVIDIA_AI_TEMPERATURE,
        "top_p": NVIDIA_AI_TOP_P,
        "max_tokens": NVIDIA_AI_MAX_TOKENS,
    }