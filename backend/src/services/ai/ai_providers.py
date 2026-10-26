"""
AI Provider Management Module
Handles NVIDIA, OpenRouter and Gemini API connections, rate limiting, caching, and provider switching
"""

import os
import json
import re
import time
import hashlib
import logging
import random
import contextlib
import concurrent.futures
import threading
from typing import Dict, List, Optional, Any, Tuple
from collections import deque
from datetime import datetime
import requests

from .rate_limit_handler import rate_limit_handler, TaskCancelledError, RateLimitExhaustedError

logger = logging.getLogger(__name__)

_UNSET = object()

# Default generation configuration used when the caller does not override it.
# Mirrors the NVIDIA Nemotron reference configuration.
DEFAULT_NVIDIA_MODEL = 'nvidia/nemotron-3.5-super-vl-120b-a12b'
DEFAULT_NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'

# Import Google Generative AI SDK
try:
    import google.generativeai as genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    logger.warning("google-generativeai package not installed. AI features will be limited.")


class AIProviderManager:
    """Manages AI provider connections, rate limiting, and request handling"""
    
    # OpenRouter model configurations with fallback chain
    # Updated Jun 2026 - verified available on openrouter.ai/models
    # The primary model name is now configurable via self.openrouter_model_name
    MODEL_CONFIGS = {
        'primary': {
            'max_tokens': 8000,
            'cost_per_1k_tokens': 0.0,
        },
        'secondary': {
            'name': 'nvidia/nemotron-3-ultra-550b-a55b:free',
            'max_tokens': 8000,
            'cost_per_1k_tokens': 0.0,
        },
        'fast': {
            'name': 'nvidia/nemotron-3-nano-30b-a3b:free',
            'max_tokens': 8000,
            'cost_per_1k_tokens': 0.0,
        },
    }

    # Mapping of stale/deprecated OpenRouter model names to their current replacements.
    # Any model name loaded from DB settings (per-user) that matches a key here
    # will be auto-upgraded to the replacement value.
    STALE_OPENROUTER_MODELS = {
        'deepseek/deepseek-r1-0528:free': 'nvidia/nemotron-3-super-120b-a12b:free',
        'sourceful/riverflow-v2.5-fast:free': 'nvidia/nemotron-3-nano-30b-a3b:free',
        'deepseek/deepseek-r1:free': 'nvidia/nemotron-3-super-120b-a12b:free',
        'meta-llama/llama-3.3-70b-instruct:free': 'nvidia/nemotron-3-super-120b-a12b:free',
    }

    # Mapping of stale/deprecated Gemini model names to their current replacements.
    # Any model name loaded from DB settings (global or per-user) that matches
    # a key here will be auto-upgraded to the replacement value.
    # Verified against the live Gemini API: retired names return HTTP 404.
    STALE_GEMINI_MODELS = {
        'gemini-3.8-flash-lite': 'gemini-3.8-flash',
        'gemini-2.5-flash-preview-09-2025': 'gemini-3.8-flash',
        'gemini-2.5-pro-preview-03-2025': 'gemini-2.5-flash',
        'gemini-2.5-pro': 'gemini-2.5-flash',
        'gemini-2.0-flash-exp': 'gemini-3.8-flash',
        'gemini-2.0-flash': 'gemini-3.8-flash',
        'gemini-2.0-pro': 'gemini-2.5-flash',
        'gemini-1.5-flash': 'gemini-3.8-flash',
        'gemini-1.5-pro': 'gemini-2.5-flash',
    }

    def _resolve_model_name(self, model_name: str, default: str = 'gemini-3.8-flash') -> str:
        """
        Check if a Gemini model name is stale/deprecated and return its replacement.
        If the model name is not in the stale list, return it unchanged.
        If the model name is None or empty, return the default.
        """
        if not model_name:
            return default
        replacement = self.STALE_GEMINI_MODELS.get(model_name)
        if replacement:
            logger.warning(f"[MODEL MIGRATION] Replaced stale Gemini model '{model_name}' with '{replacement}'")
            return replacement
        return model_name

    def _resolve_openrouter_model(self, model_name: str, default: str = 'nvidia/nemotron-3-super-120b-a12b:free') -> str:
        """
        Check if an OpenRouter model name is stale/deprecated and return its replacement.
        Handles broken model slugs from per-user DB settings that return 404.
        """
        if not model_name:
            return default
        replacement = self.STALE_OPENROUTER_MODELS.get(model_name)
        if replacement:
            logger.warning(f"[MODEL MIGRATION] Replaced stale OpenRouter model '{model_name}' with '{replacement}'")
            return replacement
        return model_name

    # ===== Thread-local provider context =====
    # API keys/model names resolved for a user are stored per-thread so that
    # concurrent requests (or background tasks) can never borrow another
    # user's credentials. Globals live on ``_global_*`` attributes.
    _THREAD_LOCAL_SETTINGS = (
        'openrouter_api_key', 'gemini_api_key', 'nvidia_api_key',
        'openrouter_model_name', 'gemini_model_name', 'nvidia_model_name',
        'current_provider',
    )

    def _get_setting(self, name: str) -> Optional[str]:
        tls = getattr(self, '_tls', None)
        if tls is not None:
            value = getattr(tls, name, _UNSET)
            if value is not _UNSET:
                return value
        return getattr(self, '_global_' + name, None)

    def _set_thread_setting(self, name: str, value: Optional[str]) -> None:
        setattr(self._tls, name, value)

    def _set_global_setting(self, name: str, value: Optional[str]) -> None:
        setattr(self, '_global_' + name, value)
        tls = getattr(self, '_tls', None)
        if tls is not None and hasattr(tls, name):
            delattr(tls, name)

    def _clear_thread_settings(self) -> None:
        for name in self._THREAD_LOCAL_SETTINGS:
            if hasattr(self._tls, name):
                delattr(self._tls, name)

    _REQUEST_OVERRIDE_KEYS = ('temperature', 'top_p', 'max_tokens', 'model', 'seed', 'enable_thinking')

    def set_request_overrides(self, **overrides) -> None:
        """Apply per-request generation parameters for the calling thread."""
        clean = {
            k: v for k, v in overrides.items()
            if k in self._REQUEST_OVERRIDE_KEYS and v is not None
        }
        if not clean:
            return
        current = getattr(self._tls, 'request_overrides', None) or {}
        current.update(clean)
        self._tls.request_overrides = current

    def clear_request_overrides(self) -> None:
        if hasattr(self._tls, 'request_overrides'):
            delattr(self._tls, 'request_overrides')

    def get_request_overrides(self) -> Dict[str, Any]:
        return dict(getattr(self._tls, 'request_overrides', None) or {})

    @contextlib.contextmanager
    def request_overrides(self, **overrides):
        previous = self.get_request_overrides()
        self.set_request_overrides(**overrides)
        try:
            yield
        finally:
            if previous:
                self._tls.request_overrides = previous
            else:
                self.clear_request_overrides()

    @property
    def openrouter_api_key(self) -> Optional[str]:
        return self._get_setting('openrouter_api_key')

    @openrouter_api_key.setter
    def openrouter_api_key(self, value: Optional[str]) -> None:
        self._set_thread_setting('openrouter_api_key', value)

    @property
    def gemini_api_key(self) -> Optional[str]:
        return self._get_setting('gemini_api_key')

    @gemini_api_key.setter
    def gemini_api_key(self, value: Optional[str]) -> None:
        self._set_thread_setting('gemini_api_key', value)

    @property
    def nvidia_api_key(self) -> Optional[str]:
        return self._get_setting('nvidia_api_key')

    @nvidia_api_key.setter
    def nvidia_api_key(self, value: Optional[str]) -> None:
        self._set_thread_setting('nvidia_api_key', value)

    @property
    def openrouter_model_name(self) -> str:
        return self._get_setting('openrouter_model_name')

    @openrouter_model_name.setter
    def openrouter_model_name(self, value: Optional[str]) -> None:
        self._set_thread_setting('openrouter_model_name', value)

    @property
    def gemini_model_name(self) -> str:
        return self._get_setting('gemini_model_name')

    @gemini_model_name.setter
    def gemini_model_name(self, value: Optional[str]) -> None:
        self._set_thread_setting('gemini_model_name', value)

    @property
    def nvidia_model_name(self) -> str:
        return self._get_setting('nvidia_model_name') or DEFAULT_NVIDIA_MODEL

    @nvidia_model_name.setter
    def nvidia_model_name(self, value: Optional[str]) -> None:
        self._set_thread_setting('nvidia_model_name', value)

    @property
    def _active_user_id(self) -> Optional[int]:
        return getattr(self._tls, 'active_user_id', None)

    @_active_user_id.setter
    def _active_user_id(self, value: Optional[int]) -> None:
        if value is None:
            if hasattr(self._tls, 'active_user_id'):
                delattr(self._tls, 'active_user_id')
        else:
            self._tls.active_user_id = value

    @property
    def current_provider(self) -> Optional[str]:
        """Active provider for this thread (falls back to the process default)."""
        return self._get_setting('current_provider')

    @current_provider.setter
    def current_provider(self, value: Optional[str]) -> None:
        # Plain assignment sets the process-wide default; per-request/task
        # switches go through force_provider(..., scope='thread') or _switch_provider.
        self._set_global_setting('current_provider', value)

    def __init__(self):
        # Thread-local context must exist before any provider setting is read.
        self._tls = threading.local()

        # Load API keys and model names — check DB settings first (if app context available), fall back to env
        self._load_api_keys_from_settings()

        # NVIDIA configuration (primary provider)
        self.nvidia_base_url = os.environ.get('NVIDIA_AI_BASE_URL', DEFAULT_NVIDIA_BASE_URL)
        self.nvidia_timeout = int(os.environ.get('NVIDIA_AI_TIMEOUT_SECONDS', '120'))
        self.nvidia_max_rpm = int(os.environ.get('NVIDIA_AI_MAX_RPM', '60'))
        self.nvidia_temperature = float(os.environ.get('NVIDIA_AI_TEMPERATURE', '1.0'))
        self.nvidia_top_p = float(os.environ.get('NVIDIA_AI_TOP_P', '0.95'))
        self.nvidia_max_tokens = int(os.environ.get('NVIDIA_AI_MAX_TOKENS', '16384'))
        self.nvidia_seed = int(os.environ.get('NVIDIA_AI_SEED', '42'))
        self.nvidia_enable_thinking = os.environ.get(
            'NVIDIA_AI_ENABLE_THINKING', 'true'
        ).strip().lower() in ('true', '1', 'yes', 'on')

        # OpenRouter configuration
        self.openrouter_base_url = "https://openrouter.ai/api/v1/chat/completions"
        self.site_url = os.environ.get('SITE_URL', 'https://afritecbridge.com')
        self.site_name = os.environ.get('SITE_NAME', 'Afritec Bridge LMS')
        self.openrouter_timeout = int(os.environ.get('OPENROUTER_TIMEOUT_SECONDS', '60'))
        self.gemini_timeout = int(os.environ.get('GEMINI_TIMEOUT_SECONDS', '120'))
        self.gemini_max_output_tokens = int(os.environ.get('GEMINI_MAX_OUTPUT_TOKENS', '8192'))

        # Gemini configuration (fallback)
        self.gemini_model = None

        # Provider state management
        self.provider_order = ['nvidia', 'openrouter', 'gemini']
        self.current_provider = self._default_provider()
        self.provider_failure_counts = {'nvidia': 0, 'openrouter': 0, 'gemini': 0}
        self.provider_last_success = {
            'nvidia': time.time(), 'openrouter': time.time(), 'gemini': time.time(),
        }
        self.max_provider_failures = 3

        # Enhanced provider state for rate-limit awareness (thread-safe)
        self._provider_lock = threading.Lock()
        self._provider_state = {
            provider: {
                'failure_count': 0,
                'last_429_at': None,
                'is_cooling_down': False,
            }
            for provider in self.provider_order
        }

        # Rate limiting configuration (per provider)
        self.openrouter_max_rpm = int(os.environ.get('OPENROUTER_MAX_RPM', '200'))
        self.gemini_max_rpm = int(os.environ.get('GEMINI_MAX_RPM', '15'))
        self.request_timestamps = {
            'nvidia': deque(maxlen=max(1, self.nvidia_max_rpm)),
            'openrouter': deque(maxlen=200),
            'gemini': deque(maxlen=15),
        }
        self.min_request_interval = 0.3
        self.last_request_time = {'nvidia': 0, 'openrouter': 0, 'gemini': 0}

        # Rate limit cooldown (set when 429 is received)
        self._rate_limit_cooldown_until = {'nvidia': 0, 'openrouter': 0, 'gemini': 0}

        # Proactive throttling threshold (fraction of RPM limit)
        self.proactive_threshold = float(os.environ.get(
            'RATE_LIMIT_PROACTIVE_THRESHOLD', '0.9'
        ))

        # Token/prompt optimization
        self.max_prompt_length = 100000

        # Response caching
        self.response_cache = {}
        self.cache_ttl = 3600

        # Initialize HTTP session — no custom Retry adapter
        # urllib3's default Retry with max_retries=0 can swallow response objects
        # on 429s, making e.response None. Use plain Session instead.
        self.session = requests.Session()

        self._initialize_providers()

    def _available_providers(self) -> List[str]:
        """Ordered list of providers that currently have credentials."""
        available = []
        if self.nvidia_api_key:
            available.append('nvidia')
        if self.openrouter_api_key:
            available.append('openrouter')
        if self.gemini_api_key and GENAI_AVAILABLE:
            available.append('gemini')
        return available

    def _default_provider(self) -> str:
        available = self._available_providers()
        return available[0] if available else 'gemini'

    def _load_api_keys_from_settings(self):
        """
        Load API keys and model names from DB system settings first, falling back
        to environment variables. This allows admin/instructors to configure
        providers via the settings UI — no .env edits needed.
        DB settings take precedence over .env values.
        """
        # Try loading from DB system settings (SystemSettingsManager)
        # If app context isn't available yet, this will gracefully fall back to env vars
        openrouter_from_db = None
        gemini_from_db = None
        nvidia_from_db = None
        gemini_model_from_db = None
        openrouter_model_from_db = None
        nvidia_model_from_db = None

        try:
            # Lazy import to avoid circular imports at module load time
            from ...models.system_settings_models import SystemSettingsManager
            openrouter_from_db = SystemSettingsManager.get_setting('openrouter_api_key')
            gemini_from_db = SystemSettingsManager.get_setting('gemini_api_key')
            nvidia_from_db = SystemSettingsManager.get_setting('nvidia_api_key')
            gemini_model_from_db = SystemSettingsManager.get_setting('gemini_model_name')
            openrouter_model_from_db = SystemSettingsManager.get_setting('openrouter_model_name')
            nvidia_model_from_db = SystemSettingsManager.get_setting('nvidia_model_name')
        except Exception:
            # No app context or DB not ready yet — fall through to env vars
            pass

        # Use DB value if non-empty, otherwise env var, otherwise None/default
        self._set_global_setting(
            'openrouter_api_key',
            openrouter_from_db if openrouter_from_db
            else os.environ.get('OPENROUTER_API_KEY')
        )
        self._set_global_setting(
            'gemini_api_key',
            gemini_from_db if gemini_from_db
            else os.environ.get('GEMINI_API_KEY')
        )
        self._set_global_setting(
            'nvidia_api_key',
            nvidia_from_db if nvidia_from_db
            else os.environ.get('NVIDIA_API_KEY')
        )
        raw_gemini_model = gemini_model_from_db if gemini_model_from_db else 'gemini-3.8-flash'
        self._set_global_setting(
            'gemini_model_name', self._resolve_model_name(raw_gemini_model)
        )
        raw_or_model = openrouter_model_from_db if openrouter_model_from_db else 'nvidia/nemotron-3-super-120b-a12b:free'
        self._set_global_setting(
            'openrouter_model_name', self._resolve_openrouter_model(raw_or_model)
        )
        raw_nvidia_model = nvidia_model_from_db if nvidia_model_from_db else os.environ.get(
            'NVIDIA_AI_MODEL', DEFAULT_NVIDIA_MODEL
        )
        self._set_global_setting('nvidia_model_name', raw_nvidia_model)

    def reload_config(self):
        """
        Reload API keys and model names from DB system settings and reinitialize providers.
        Call this after settings are updated via the admin/instructor UI.
        This is safe to call at runtime — no restart needed.
        """
        old_or_key = self._global_openrouter_api_key
        old_gem_key = self._global_gemini_api_key
        old_nvidia_key = self._global_nvidia_api_key
        old_gem_model = self._global_gemini_model_name
        old_or_model = self._global_openrouter_model_name
        old_nvidia_model = self._global_nvidia_model_name

        self._load_api_keys_from_settings()

        key_changed = (
            old_or_key != self._global_openrouter_api_key
            or old_gem_key != self._global_gemini_api_key
            or old_nvidia_key != self._global_nvidia_api_key
            or old_gem_model != self._global_gemini_model_name
            or old_or_model != self._global_openrouter_model_name
            or old_nvidia_model != self._global_nvidia_model_name
        )

        if not key_changed:
            logger.info("[RELOAD] AI provider settings unchanged — no reconfiguration needed")
            return False

        logger.info("[RELOAD] AI provider settings changed — reinitializing providers")
        self._initialize_providers()
        return True

    def set_active_user(self, user_id: int):
        """
        Activate a specific user's AI provider settings for the CALLING THREAD.
        All subsequent AI requests on this thread use this user's API keys and
        model names; other threads keep their own context.
        Call clear_active_user() to restore global defaults.
        """
        if user_id is None:
            return self.clear_active_user()

        logger.info(f"[USER CTX] Activating AI settings for user {user_id}")
        self._active_user_id = user_id
        self._clear_thread_settings()

        try:
            from ...models.system_settings_models import UserAISetting
            user_settings = UserAISetting.query.filter_by(user_id=user_id).first()
            # Check for ANY personal settings — API keys OR model name overrides
            has_personal_settings = (
                user_settings.openrouter_api_key or
                user_settings.gemini_api_key or
                user_settings.nvidia_api_key or
                user_settings.openrouter_model_name or
                user_settings.gemini_model_name or
                user_settings.nvidia_model_name
            ) if user_settings else False
            if has_personal_settings:
                # Use user's keys if they have any set, otherwise fall back to global
                self.openrouter_api_key = user_settings.openrouter_api_key or self._global_openrouter_api_key
                self.gemini_api_key = user_settings.gemini_api_key or self._global_gemini_api_key
                self.nvidia_api_key = user_settings.nvidia_api_key or self._global_nvidia_api_key
                # Resolve stale model names from per-user settings
                raw_user_or = user_settings.openrouter_model_name or self._global_openrouter_model_name
                self.openrouter_model_name = self._resolve_openrouter_model(raw_user_or)
                raw_user_gemini = user_settings.gemini_model_name or self._global_gemini_model_name
                self.gemini_model_name = self._resolve_model_name(raw_user_gemini)
                self.nvidia_model_name = (
                    user_settings.nvidia_model_name or self._global_nvidia_model_name or DEFAULT_NVIDIA_MODEL
                )
                logger.info(f"[USER CTX] User {user_id} has personal AI settings — activated")
            else:
                logger.info(f"[USER CTX] User {user_id} has no personal AI settings — using global defaults")
        except Exception as e:
            logger.warning(f"[USER CTX] Failed to load per-user settings for {user_id}: {e}")

        # Re-initialize providers (especially Gemini which needs genai.configure())
        self._initialize_providers()

    def clear_active_user(self):
        """
        Clear this thread's per-user context and restore global/env AI provider settings.
        """
        if self._active_user_id:
            logger.info(f"[USER CTX] Clearing active user {self._active_user_id} — restoring global defaults")
        self._clear_thread_settings()
        self._active_user_id = None
        self._initialize_providers()

    def update_api_key(self, provider: str, api_key: str) -> bool:
        """
        Dynamically update a single provider's API key at runtime (global scope).
        Does NOT persist to DB — settings routes handle that.
        Call reload_config() after persisting to DB for full reinitialization.

        Args:
            provider: 'nvidia', 'openrouter' or 'gemini'
            api_key: The new API key

        Returns:
            bool: True if the provider was successfully (re)initialized
        """
        if provider == 'nvidia':
            self._set_global_setting('nvidia_api_key', api_key)
            logger.info(f"[API KEY] NVIDIA API key updated in memory")
            return bool(api_key)
        elif provider == 'openrouter':
            self._set_global_setting('openrouter_api_key', api_key)
            logger.info(f"[API KEY] OpenRouter API key updated in memory")
            return True
        elif provider == 'gemini':
            self._set_global_setting('gemini_api_key', api_key)
            if api_key and GENAI_AVAILABLE:
                try:
                    genai.configure(api_key=api_key)
                    self.gemini_model = genai.GenerativeModel(self.gemini_model_name)
                    logger.info(f"[API KEY] Gemini configured with new key")
                    return True
                except Exception as e:
                    logger.error(f"[API KEY] Failed to reconfigure Gemini with new key: {e}")
                    self.gemini_model = None
                    return False
            else:
                self.gemini_model = None
                return False
        logger.error(f"[API KEY] Unknown provider: {provider}")
        return False

    def _initialize_providers(self):
        """Initialize NVIDIA, OpenRouter and Gemini providers"""
        available = self._available_providers()
        if not available:
            logger.warning(
                "No AI API keys configured (NVIDIA/OpenRouter/Gemini) — generation will use fallback content."
            )
        if self.current_provider not in available:
            self.current_provider = self._default_provider()

        if self.nvidia_api_key:
            logger.info(
                f"NVIDIA AI initialized (Primary provider: {self.nvidia_model_name}, "
                f"Rate limit: {self.nvidia_max_rpm} RPM)"
            )
        else:
            logger.warning("NVIDIA_API_KEY not found. NVIDIA provider disabled.")

        if self.openrouter_api_key:
            logger.info(f"OpenRouter AI initialized (Rate limit: {self.openrouter_max_rpm} RPM)")
        else:
            logger.warning("OPENROUTER_API_KEY not found.")

        if not self.gemini_api_key:
            logger.warning("GEMINI_API_KEY not found in environment variables or system settings")
        elif GENAI_AVAILABLE:
            try:
                genai.configure(api_key=self.gemini_api_key)
                self.gemini_model = genai.GenerativeModel(self.gemini_model_name)
                logger.info(f"Gemini AI initialized (Fallback provider: {self.gemini_model_name}, Rate limit: {self.gemini_max_rpm} RPM)")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini AI: {e}")
                self.gemini_model = None
        else:
            logger.warning("Google Generative AI SDK not available")
    
    # ===== Caching Methods =====
    
    def _get_cache_key(self, prompt: str, provider: str, model: str = None) -> str:
        """Generate cache key for response caching (scoped to the active request overrides)"""
        overrides = getattr(self._tls, 'request_overrides', None) or {}
        overrides_part = json.dumps(
            {k: overrides[k] for k in sorted(overrides)}, sort_keys=True, default=str
        )
        cache_str = f"{provider}:{model}:{overrides_part}:{prompt}"
        return hashlib.md5(cache_str.encode()).hexdigest()
    
    def _get_cached_response(self, cache_key: str) -> Optional[str]:
        """Retrieve cached response if available and not expired"""
        if cache_key in self.response_cache:
            cached_data = self.response_cache[cache_key]
            if time.time() - cached_data['timestamp'] < self.cache_ttl:
                logger.info("Using cached response")
                return cached_data['response']
            else:
                del self.response_cache[cache_key]
        return None
    
    def _cache_response(self, cache_key: str, response: str):
        """Cache response with timestamp"""
        self.response_cache[cache_key] = {
            'response': response,
            'timestamp': time.time()
        }
        if len(self.response_cache) > 100:
            oldest_key = min(self.response_cache.keys(), 
                           key=lambda k: self.response_cache[k]['timestamp'])
            del self.response_cache[oldest_key]
    
    def clear_cache(self):
        """Clear the response cache"""
        self.response_cache.clear()
        logger.info("Response cache cleared")

    def invalidate_cache_for_prompt(self, prompt: str):
        """Invalidate all cached responses for a given prompt (across all providers/models).

        Call this when a cached response is discovered to be unusable (e.g., wrong format).
        """
        combos = []
        for model_tier, cfg in self.MODEL_CONFIGS.items():
            model_name = (
                self.openrouter_model_name if model_tier == 'primary'
                else cfg.get('name', 'nvidia/nemotron-3-super-120b-a12b:free')
            )
            combos.append(('openrouter', model_name))
        combos.append(('gemini', self.gemini_model_name))
        combos.append(('nvidia', self.nvidia_model_name))

        expected_keys = {self._get_cache_key(prompt, p, m) for p, m in combos}
        removed = 0
        for key in expected_keys:
            if key in self.response_cache:
                del self.response_cache[key]
                removed += 1
        if removed:
            logger.info(f"Invalidated {removed} cached response(s) for prompt")

    # ===== Rate Limiting =====

    # Maximum seconds we'll ever sleep for a single rate-limit cooldown
    MAX_COOLDOWN_SLEEP = 120

    def _max_rpm_for(self, provider: str) -> int:
        if provider == 'nvidia':
            return self.nvidia_max_rpm
        if provider == 'openrouter':
            return self.openrouter_max_rpm
        return self.gemini_max_rpm

    def _wait_for_rate_limit(self, provider: str = 'openrouter'):
        """Implement provider-specific rate limiting with cooldown awareness and proactive throttling"""
        current_time = time.time()
        max_rpm = self._max_rpm_for(provider)
        timestamps = self.request_timestamps[provider]

        # === PROACTIVE THROTTLING ===
        # If we're approaching the RPM limit, proactively sleep before making the call
        requests_last_minute = len(timestamps)
        if max_rpm > 0 and requests_last_minute >= max_rpm * self.proactive_threshold:
            # Calculate how long until the oldest request falls out of the 60s window
            if timestamps:
                oldest = timestamps[0]
                window_elapsed = current_time - oldest
                if window_elapsed < 60:
                    wait_time = 60 - window_elapsed + 0.5
                    logger.warning(
                        f"[PROACTIVE] {provider} at {requests_last_minute}/{max_rpm} RPM. "
                        f"Pausing {wait_time:.1f}s for window reset."
                    )
                    time.sleep(wait_time)
                    current_time = time.time()

        # Check rate-limit cooldown (set when 429 is received from the provider)
        cooldown_until = self._rate_limit_cooldown_until.get(provider, 0)
        cooldown_remaining = cooldown_until - current_time
        if cooldown_remaining > 0:
            # Safety cap: never sleep longer than MAX_COOLDOWN_SLEEP
            if cooldown_remaining > self.MAX_COOLDOWN_SLEEP:
                logger.warning(f"Cooldown for {provider} was {cooldown_remaining:.1f}s — capping to {self.MAX_COOLDOWN_SLEEP}s")
                cooldown_remaining = self.MAX_COOLDOWN_SLEEP
                # Reset the stored value so next call isn't stuck too
                self._rate_limit_cooldown_until[provider] = current_time + cooldown_remaining
            logger.info(f"Rate limit cooldown active for {provider}: waiting {cooldown_remaining:.1f}s")
            time.sleep(cooldown_remaining)
            current_time = time.time()

        time_since_last = current_time - self.last_request_time[provider]
        if time_since_last < self.min_request_interval:
            sleep_time = self.min_request_interval - time_since_last
            logger.debug(f"Rate limiting ({provider}): waiting {sleep_time:.2f}s before next request")
            time.sleep(sleep_time)
            current_time = time.time()

        # Check if we've hit the RPM limit (legacy check)
        if len(timestamps) >= max_rpm and timestamps:
            oldest_request = timestamps[0]
            time_window = current_time - oldest_request
            if time_window < 60:
                sleep_time = 60 - time_window + 1
                logger.warning(f"Rate limit reached for {provider} ({max_rpm} requests/min). Waiting {sleep_time:.2f}s")
                time.sleep(sleep_time)
                current_time = time.time()

        timestamps.append(current_time)
        self.last_request_time[provider] = current_time
    
    # ===== Provider State Management =====
    
    def _should_switch_provider(self) -> bool:
        """Determine if we should switch to fallback provider"""
        current = self.current_provider
        failures = self.provider_failure_counts.get(current, 0)

        if failures >= self.max_provider_failures:
            logger.warning(
                f"[PROVIDER] {current} has {failures} consecutive failures. Switching provider."
            )
            return True
        return False

    def _switch_provider(self):
        """Switch to the next available provider in the fallback chain"""
        old_provider = self.current_provider
        available = self._available_providers()
        if not available:
            logger.error("Cannot switch provider: no providers are configured")
            return
        if old_provider in available:
            index = available.index(old_provider)
            new_provider = available[(index + 1) % len(available)]
        else:
            new_provider = available[0]
        if new_provider == old_provider:
            logger.warning(f"[PROVIDER] No alternative provider available (staying on {old_provider})")
            return
        # Thread-scoped so concurrent requests/tasks don't stomp each other's
        # provider choice; cleared with the thread-local context.
        self._set_thread_setting('current_provider', new_provider)
        logger.info(
            f"[PROVIDER] Switched from {old_provider} to {new_provider} "
            f"after {self.provider_failure_counts.get(old_provider, 0)} consecutive failures."
        )

    def alternative_provider(self) -> Optional[str]:
        """Next provider in the fallback chain after the currently active one."""
        available = self._available_providers()
        if not available:
            return None
        if self.current_provider in available:
            if len(available) == 1:
                return None
            index = available.index(self.current_provider)
            return available[(index + 1) % len(available)]
        return available[0]

    def _mark_provider_success(self, provider: str):
        """Mark successful request for provider"""
        self.provider_failure_counts[provider] = 0
        self.provider_last_success[provider] = time.time()
        with self._provider_lock:
            self._provider_state[provider]['failure_count'] = 0
            self._provider_state[provider]['is_cooling_down'] = False

    def _mark_provider_failure(self, provider: str):
        """Mark failed request for provider"""
        self.provider_failure_counts[provider] += 1
        with self._provider_lock:
            self._provider_state[provider]['failure_count'] = self.provider_failure_counts[provider]
        logger.warning(f"Provider {provider} failure count: {self.provider_failure_counts[provider]}")

    def _mark_provider_429(self, provider: str):
        """Mark a 429 rate-limit event for a provider"""
        now = time.time()
        with self._provider_lock:
            self._provider_state[provider]['last_429_at'] = now
            self._provider_state[provider]['is_cooling_down'] = True
            self._provider_state[provider]['failure_count'] = self.provider_failure_counts.get(provider, 0) + 1
        self.provider_failure_counts[provider] = self.provider_failure_counts.get(provider, 0) + 1
        logger.warning(
            f"[RATE LIMIT] {provider} → 429 recorded. "
            f"Provider cooling down."
        )

    def _mark_provider_cooling_done(self, provider: str):
        """Mark a provider as no longer cooling down from rate limits"""
        with self._provider_lock:
            self._provider_state[provider]['is_cooling_down'] = False

    def reset_provider_failures(self, provider: str = None):
        """Reset failure counts for a provider or all providers"""
        if provider:
            self.provider_failure_counts[provider] = 0
            with self._provider_lock:
                self._provider_state[provider]['failure_count'] = 0
                self._provider_state[provider]['is_cooling_down'] = False
            logger.info(f"Reset failure count for {provider}")
        else:
            for p in self.provider_failure_counts:
                self.provider_failure_counts[p] = 0
            with self._provider_lock:
                for p in self._provider_state:
                    self._provider_state[p]['failure_count'] = 0
                    self._provider_state[p]['is_cooling_down'] = False
            logger.info("Reset all provider failure counts")

    def force_provider(self, provider: Optional[str], scope: str = 'thread'):
        """Force use of a specific provider.

        scope='thread' pins the provider for the calling thread only (used by
        per-request retries and background tasks); scope='global' changes the
        process-wide default (used by the admin provider endpoint).
        """
        if provider is not None and provider not in ['nvidia', 'openrouter', 'gemini']:
            logger.error(f"Invalid provider: {provider}")
            return

        if scope == 'global':
            self.current_provider = provider
            self.reset_provider_failures()
            logger.info(f"Forced provider switch to {provider} (global)")
            return

        if provider is None:
            if hasattr(self._tls, 'current_provider'):
                delattr(self._tls, 'current_provider')
            logger.info("Cleared thread provider override")
            return

        self._set_thread_setting('current_provider', provider)
        logger.info(f"Forced provider switch to {provider} (thread)")
    
    # ===== Prompt Optimization =====
    
    def _optimize_prompt(self, prompt: str, max_length: int = None) -> str:
        """Optimize prompt length to stay within limits"""
        max_length = max_length or self.max_prompt_length
        if len(prompt) <= max_length:
            return prompt
        
        logger.warning(f"Prompt too long ({len(prompt)} chars). Truncating to {max_length} chars")
        
        truncated = prompt[:max_length]
        last_newline = truncated.rfind('\n')
        if last_newline > max_length * 0.8:
            truncated = truncated[:last_newline]
        
        truncated += "\n\n[Note: Some context was truncated due to length limits]"
        return truncated
    
    # ===== API Request Methods =====

    def _nvidia_payload(self, prompt: str, temperature: float, top_p: float,
                        max_tokens: int, model_name: str, stream: bool = False) -> Dict[str, Any]:
        overrides = self.get_request_overrides()
        enable_thinking = overrides.get('enable_thinking', self.nvidia_enable_thinking)
        seed = int(overrides.get('seed', self.nvidia_seed))
        payload = {
            "model": model_name,
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert instructional designer and course content creator. Provide detailed, well-structured, and engaging educational content. When the user asks for JSON output, you MUST respond with ONLY valid JSON — no markdown, no explanatory text, no code blocks."
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": max_tokens,
            "seed": seed,
            "parallel_tool_calls": True,
        }
        if enable_thinking:
            payload["chat_template_kwargs"] = {"enable_thinking": True}
        if stream:
            payload["stream"] = True
        return payload

    @staticmethod
    def _strip_thinking_tags(text: str) -> str:
        """Remove leaked thinking-mode tag wrappers from model output."""
        cleaned = re.sub(
            r'\s*<' + r'thinking' + r'>.*?</' + r'thinking' + r'>\s*',
            ' ', text, flags=re.DOTALL
        )
        cleaned = cleaned.strip()
        return cleaned or text

    def _make_nvidia_request(self, prompt: str, retry_count: int = 2,
                             temperature: float = None,
                             max_tokens: int = None) -> Optional[str]:
        """Make a request to the NVIDIA Nemotron chat completions API (primary provider)."""
        if not self.nvidia_api_key:
            logger.warning("NVIDIA API key not configured")
            return None

        overrides = self.get_request_overrides()
        model_name = overrides.get('model') or self.nvidia_model_name
        temp = float(
            overrides.get('temperature',
                          temperature if temperature is not None else self.nvidia_temperature)
        )
        top_p = float(overrides.get('top_p', self.nvidia_top_p))
        override_max = overrides.get('max_tokens')
        if override_max:
            mx = int(override_max)
        else:
            mx = max(int(max_tokens or 0), self.nvidia_max_tokens)
        optimized_prompt = self._optimize_prompt(prompt, max(20000, mx * 6))

        cache_key = self._get_cache_key(prompt, 'nvidia', model_name)
        cached = self._get_cached_response(cache_key)
        if cached:
            return cached

        for attempt in range(retry_count + 1):
            try:
                self._wait_for_rate_limit('nvidia')

                logger.info(
                    f"Making NVIDIA API request (model: {model_name}, attempt {attempt + 1}/{retry_count + 1}, "
                    f"prompt length: {len(optimized_prompt)} chars, temperature: {temp})"
                )

                response = self.session.post(
                    self.nvidia_base_url.rstrip('/') + '/chat/completions',
                    headers={
                        "Authorization": f"Bearer {self.nvidia_api_key}",
                        "Content-Type": "application/json",
                    },
                    json=self._nvidia_payload(optimized_prompt, temp, top_p, mx, model_name, stream=True),
                    timeout=self.nvidia_timeout,
                    stream=True,
                )
                # text/event-stream has no charset and requests defaults text/*
                # to ISO-8859-1 — decoding SSE lines that way corrupts every
                # symbol, accent and emoji (√ → â…, · → Â·). Force UTF-8 before
                # any .text/iter_lines(decode_unicode=True) use.
                response.encoding = 'utf-8'

                if response.status_code >= 400:
                    status_code = response.status_code
                    error_text = (response.text or '')[:500]

                    if status_code == 404:
                        logger.warning(f"NVIDIA model '{model_name}' not found (404)")
                        self._mark_provider_failure('nvidia')
                        return None

                    if status_code in (401, 402, 403):
                        logger.error(f"NVIDIA auth/billing error (status {status_code}): {error_text}")
                        self._mark_provider_failure('nvidia')
                        return None

                    if status_code == 429:
                        self._mark_provider_429('nvidia')
                        backoff_time = min(60, (2 ** attempt) * 5)
                        retry_after = response.headers.get('Retry-After')
                        if retry_after:
                            try:
                                backoff_time = max(backoff_time, float(retry_after) + 1)
                            except (TypeError, ValueError):
                                pass
                        backoff_time = min(backoff_time, self.MAX_COOLDOWN_SLEEP)
                        self._rate_limit_cooldown_until['nvidia'] = time.time() + backoff_time
                        logger.warning(
                            f"NVIDIA rate limit 429 (attempt {attempt + 1}/{retry_count + 1}). "
                            f"Backing off {backoff_time}s..."
                        )
                        if attempt < retry_count:
                            time.sleep(backoff_time)
                            continue
                        raise requests.exceptions.HTTPError(
                            f"{status_code} Client Error: rate limited", response=response
                        )

                    logger.error(f"NVIDIA HTTP error {status_code}: {error_text}")
                    if status_code >= 500 and attempt < retry_count:
                        time.sleep(2)
                        continue
                    self._mark_provider_failure('nvidia')
                    return None

                # Streaming response: the per-chunk timeout (nvidia_timeout)
                # applies between SSE events, so long thinking-model
                # generations no longer trip a whole-response read timeout.
                content_parts = []
                reasoning_parts = []
                chunk_count = 0
                finish_reason = None
                for line in response.iter_lines(decode_unicode=True):
                    if not line:
                        continue
                    line = line.strip()
                    if line.startswith('data:'):
                        line = line[5:].strip()
                    if not line or line == '[DONE]':
                        if line == '[DONE]':
                            break
                        continue
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    chunk_count += 1
                    choices = chunk.get('choices') or []
                    if not choices:
                        continue
                    if choices[0].get('finish_reason'):
                        finish_reason = choices[0]['finish_reason']
                    delta = choices[0].get('delta') or {}
                    piece = delta.get('content')
                    if piece:
                        content_parts.append(str(piece))
                    reasoning_piece = delta.get('reasoning_content') or delta.get('reasoning')
                    if reasoning_piece:
                        reasoning_parts.append(str(reasoning_piece))

                if chunk_count == 0:
                    logger.error("NVIDIA streaming response contained no chunks")
                    if attempt < retry_count:
                        time.sleep(2)
                        continue
                    return None

                content = ''.join(content_parts)
                if not content.strip():
                    # Thinking models (enable_thinking=True) sometimes stream
                    # the answer only in reasoning_content.
                    reasoning = ''.join(reasoning_parts)
                    if reasoning.strip():
                        logger.info(
                            "NVIDIA returned a reasoning-only completion; "
                            "using reasoning_content as the answer"
                        )
                        content = reasoning.strip()
                if not content.strip():
                    logger.warning("NVIDIA returned an empty completion")
                    if attempt < retry_count:
                        time.sleep(2)
                        continue
                    self._mark_provider_failure('nvidia')
                    return None

                content = self._strip_thinking_tags(content)

                if finish_reason is None:
                    logger.warning(
                        "NVIDIA stream ended without finish_reason "
                        f"(chunks={chunk_count}, chars={len(content)}) — possible premature end"
                    )
                elif finish_reason == 'length':
                    logger.warning(
                        f"NVIDIA output truncated by max_tokens={mx} "
                        f"(chunks={chunk_count}, chars={len(content)})"
                    )

                logger.info(
                    f"NVIDIA API request successful (model: {model_name}, "
                    f"chunks: {chunk_count}, chars: {len(content)}, "
                    f"finish_reason: {finish_reason})"
                )
                self._mark_provider_success('nvidia')
                self._cache_response(cache_key, content)
                return content

            except requests.exceptions.HTTPError as e:
                if e.response is not None and e.response.status_code == 429:
                    raise
                logger.error(f"NVIDIA request error (attempt {attempt + 1}): {e}")
                if attempt < retry_count:
                    time.sleep(2)
                    continue
            except requests.exceptions.Timeout as e:
                logger.warning(
                    f"NVIDIA request timed out after {self.nvidia_timeout}s "
                    f"(attempt {attempt + 1}/{retry_count + 1}): {e}"
                )
                if attempt < retry_count:
                    time.sleep(2)
                    continue
            except Exception as e:
                logger.error(f"NVIDIA request error (attempt {attempt + 1}): {e}")
                if attempt < retry_count:
                    time.sleep(2)
                    continue

        self._mark_provider_failure('nvidia')
        return None

    def _make_openrouter_request(self, prompt: str, model_tier: str = 'primary', 
                                 retry_count: int = 2, temperature: float = 0.7,
                                 max_tokens: int = 4096) -> Optional[str]:
        """Make a request to OpenRouter API with automatic model fallback"""
        if not self.openrouter_api_key:
            logger.warning("OpenRouter API key not configured")
            return None
        
        model_config = self.MODEL_CONFIGS.get(model_tier, self.MODEL_CONFIGS['primary'])
        # Primary model name is configurable via settings/UI; fallback tiers are hardcoded
        if model_tier == 'primary':
            model_name = self.openrouter_model_name
        else:
            model_name = model_config.get('name', 'nvidia/nemotron-3-super-120b-a12b:free')

        overrides = self.get_request_overrides()
        if overrides.get('model'):
            model_name = overrides['model']
        top_p = float(overrides.get('top_p', 0.9))
        
        cache_key = self._get_cache_key(prompt, 'openrouter', model_name)
        cached = self._get_cached_response(cache_key)
        if cached:
            return cached
        
        optimized_prompt = self._optimize_prompt(prompt, model_config['max_tokens'] * 3)
        
        for attempt in range(retry_count + 1):
            try:
                self._wait_for_rate_limit('openrouter')
                
                logger.info(f"Making OpenRouter API request (model: {model_name}, attempt {attempt + 1}/{retry_count + 1}, prompt length: {len(optimized_prompt)} chars)")
                
                headers = {
                    "Authorization": f"Bearer {self.openrouter_api_key}",
                    "HTTP-Referer": self.site_url,
                    "X-Title": self.site_name,
                    "Content-Type": "application/json",
                }
                
                payload = {
                    "model": model_name,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are an expert instructional designer and course content creator. Provide detailed, well-structured, and engaging educational content. When the user asks for JSON output, you MUST respond with ONLY valid JSON — no markdown, no explanatory text, no code blocks."
                        },
                        {
                            "role": "user",
                            "content": optimized_prompt
                        }
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "top_p": top_p,
                    "frequency_penalty": 0.1,
                    "presence_penalty": 0.1,
                }
                
                response = self.session.post(
                    self.openrouter_base_url,
                    headers=headers,
                    json=payload,
                    timeout=self.openrouter_timeout
                )
                
                response.raise_for_status()
                result = response.json()
                
                if 'choices' in result and len(result['choices']) > 0:
                    content = result['choices'][0]['message']['content']
                    logger.info(f"OpenRouter API request successful (model: {model_name}, tokens: {result.get('usage', {}).get('total_tokens', 'N/A')})")
                    
                    self._mark_provider_success('openrouter')
                    self._cache_response(cache_key, content)
                    return content
                else:
                    logger.error(f"Unexpected OpenRouter response format: {result}")
                    
            except requests.exceptions.HTTPError as e:
                error_msg = str(e)
                # Extract status code: prefer response object, fall back to parsing error string
                status_code = None
                if e.response is not None:
                    status_code = e.response.status_code
                elif '429' in error_msg:
                    status_code = 429
                elif '401' in error_msg:
                    status_code = 401
                elif '402' in error_msg:
                    status_code = 402  
                elif '403' in error_msg:
                    status_code = 403
                else:
                    # Try to extract any 4xx/5xx from error string
                    _match = re.search(r'\b(4\d{2}|5\d{2})\b', error_msg)
                    if _match:
                        status_code = int(_match.group(1))

                if status_code == 404:
                    # Model not found — don't retry, immediately try next tier
                    logger.warning(f"OpenRouter model '{model_name}' not found (404). Trying next tier.")
                    self._mark_provider_failure('openrouter')
                    if model_tier == 'primary':
                        return self._make_openrouter_request(prompt, 'secondary', 1, temperature, max_tokens)
                    elif model_tier == 'secondary':
                        return self._make_openrouter_request(prompt, 'fast', 1, temperature, max_tokens)
                    return None

                if status_code in [401, 402, 403]:
                    logger.error(f"OpenRouter auth/billing error (status {status_code}): {error_msg}")
                    self._mark_provider_failure('openrouter')
                    return None
                
                elif status_code == 429:
                    # Rate limit — exponential backoff: 5s, 10s, 20s (capped at 60s)
                    backoff_time = min(60, (2 ** attempt) * 5)
                    
                    # Check for Retry-After / x-ratelimit-reset headers
                    if e.response is not None:
                        retry_after = e.response.headers.get('Retry-After')
                        ratelimit_reset = e.response.headers.get('x-ratelimit-reset')
                        
                        if retry_after:
                            try:
                                ra_val = float(retry_after)
                                # Retry-After is typically a relative delay in seconds
                                backoff_time = max(backoff_time, int(ra_val) + 1)
                            except (ValueError, TypeError):
                                pass
                        elif ratelimit_reset:
                            try:
                                reset_val = float(ratelimit_reset)
                                now = time.time()
                                # x-ratelimit-reset is an ABSOLUTE Unix timestamp
                                # (if it's in the future and > 1 billion, it's a timestamp)
                                if reset_val > 1_000_000_000 and reset_val > now:
                                    backoff_time = max(backoff_time, int(reset_val - now) + 1)
                                else:
                                    # Treat as relative seconds (small values)
                                    backoff_time = max(backoff_time, int(reset_val) + 1)
                            except (ValueError, TypeError):
                                pass
                    
                    # Safety cap: never set a backoff larger than 120s
                    backoff_time = min(backoff_time, self.MAX_COOLDOWN_SLEEP)
                    
                    logger.warning(f"OpenRouter rate limit 429 (attempt {attempt + 1}/{retry_count + 1}). Backing off {backoff_time}s...")
                    
                    # Set cooldown so _wait_for_rate_limit also respects it
                    self._rate_limit_cooldown_until['openrouter'] = time.time() + backoff_time
                    
                    if attempt < retry_count:
                        time.sleep(backoff_time)
                        continue
                    else:
                        # All retries exhausted — try a different model tier
                        logger.warning(f"OpenRouter rate limit persists after {retry_count + 1} attempts on '{model_tier}' tier")
                        if model_tier == 'primary':
                            logger.info("Trying secondary model tier...")
                            return self._make_openrouter_request(prompt, 'secondary', 1, temperature, max_tokens)
                        elif model_tier == 'secondary':
                            logger.info("Trying fast model tier...")
                            return self._make_openrouter_request(prompt, 'fast', 1, temperature, max_tokens)
                        # Don't chain further — let make_ai_request fall back to Gemini
                        self._mark_provider_failure('openrouter')
                        # Raise so RateLimitHandler.execute_with_retry can catch and retry
                        raise  # re-raise the requests.HTTPError for 429
                
                else:
                    # Other HTTP errors (500, 502, etc.)
                    logger.error(f"OpenRouter HTTP error {status_code} (attempt {attempt + 1}/{retry_count + 1}): {error_msg}")
                    if attempt < retry_count:
                        time.sleep(2)
                        continue
                    
            except requests.exceptions.Timeout as e:
                logger.warning(f"OpenRouter request timed out after {self.openrouter_timeout}s (attempt {attempt + 1}/{retry_count + 1}): {e}")
                if attempt < retry_count:
                    time.sleep(2)
                    continue
                    
            except Exception as e:
                logger.error(f"OpenRouter request error (attempt {attempt + 1}): {e}")
                if attempt < retry_count:
                    time.sleep(2)
                    continue
        
        self._mark_provider_failure('openrouter')
        return None
    
    def _make_gemini_request(self, prompt: str, retry_count: int = 2, 
                            temperature: float = 0.7,
                            max_tokens: int = None) -> Optional[str]:
        """Make a request to Gemini API with rate limiting and retry logic"""
        if not self.gemini_model:
            logger.warning("Gemini model not initialized")
            return None
        
        cache_key = self._get_cache_key(prompt, 'gemini', self.gemini_model_name)
        cached = self._get_cached_response(cache_key)
        if cached:
            return cached
        
        optimized_prompt = self._optimize_prompt(prompt, 30000)
        
        last_error: Optional[Exception] = None
        for attempt in range(retry_count + 1):
            executor = None
            future = None
            try:
                self._wait_for_rate_limit('gemini')
                
                logger.info(f"Making Gemini API request (attempt {attempt + 1}/{retry_count + 1}, prompt length: {len(optimized_prompt)} chars)")
                
                generation_config = {
                    'temperature': temperature,
                    'top_p': float(self.get_request_overrides().get('top_p', 0.9)),
                    'top_k': 40,
                    'max_output_tokens': int(
                        self.get_request_overrides().get('max_tokens')
                        or max_tokens
                        or self.gemini_max_output_tokens
                    ),
                }

                # Use ThreadPoolExecutor WITHOUT 'with' to avoid blocking shutdown on timeout
                executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
                start_time = time.time()
                future = executor.submit(
                    self.gemini_model.generate_content,
                    optimized_prompt,
                    generation_config=generation_config
                )
                
                try:
                    response = future.result(timeout=self.gemini_timeout)
                except concurrent.futures.TimeoutError:
                    elapsed = time.time() - start_time
                    logger.error(f"Gemini request timed out after {elapsed:.1f}s (limit: {self.gemini_timeout}s, attempt {attempt + 1}/{retry_count + 1})")
                    future.cancel()
                    if attempt < retry_count:
                        time.sleep(2)
                        continue
                    break
                
                if not response or not hasattr(response, 'text') or not response.text:
                    logger.error(f"Gemini returned empty response (attempt {attempt + 1}/{retry_count + 1})")
                    if attempt < retry_count:
                        time.sleep(2)
                        continue
                    break
                
                logger.info(f"Gemini API request successful (attempt {attempt + 1}/{retry_count + 1})")
                self._mark_provider_success('gemini')
                self._cache_response(cache_key, response.text)
                return response.text
                
            except Exception as e:
                last_error = e
                error_msg = str(e)
                
                if '429' in error_msg or 'quota' in error_msg.lower() or 'rate limit' in error_msg.lower():
                    logger.error(f"Gemini quota/rate limit error on attempt {attempt + 1}: {error_msg}")
                    
                    # Default exponential backoff
                    backoff_time = min(self.MAX_COOLDOWN_SLEEP, (attempt + 1) * 15)
                    
                    # Try to parse the server-suggested retry delay
                    if 'retry in' in error_msg.lower():
                        try:
                            match = re.search(r'retry in (\d+\.?\d*)s', error_msg)
                            if match:
                                server_delay = float(match.group(1)) + 2
                                backoff_time = min(self.MAX_COOLDOWN_SLEEP, max(backoff_time, server_delay))
                        except Exception:
                            pass
                    
                    # Also try to parse retry_delay { seconds: N } from protobuf-style error
                    retry_seconds_match = re.search(r'retry_delay\s*\{\s*seconds:\s*(\d+)', error_msg)
                    if retry_seconds_match:
                        try:
                            server_delay = float(retry_seconds_match.group(1)) + 2
                            backoff_time = min(self.MAX_COOLDOWN_SLEEP, max(backoff_time, server_delay))
                        except Exception:
                            pass
                    
                    # Set cooldown so _wait_for_rate_limit also respects it
                    self._rate_limit_cooldown_until['gemini'] = time.time() + backoff_time
                    
                    if attempt < retry_count:
                        logger.info(f"Waiting {backoff_time:.1f}s before retry (server suggested delay respected)...")
                        time.sleep(backoff_time)
                        continue
                
                logger.error(f"Error calling Gemini API (attempt {attempt + 1}/{retry_count + 1}): {e}")
                if attempt < retry_count:
                    time.sleep(2)
                    continue
            finally:
                # Non-blocking cleanup — don't wait for running thread
                if executor:
                    executor.shutdown(wait=False)
                    
        # Re-raise the last real error. A bare `raise` here would fail with
        # RuntimeError("No active exception to reraise") because the exception
        # was already handled inside the loop — masking the actual failure.
        if last_error is not None:
            raise last_error
        # No exception captured (timeout/empty response on the final attempt):
        # report no content so make_ai_request can fall back to the other provider.
        return None
    
    def make_ai_request(self, prompt: str, temperature: float = 0.7, 
                        max_tokens: int = 4096, prefer_fast: bool = False,
                        _raise_on_rate_limit: bool = False) -> Tuple[Optional[str], str]:
        """
        Unified AI request method with automatic provider switching
        
        Args:
            prompt: The prompt to send to the AI
            temperature: Creativity level (0.0 - 1.0)
            max_tokens: Maximum response tokens
            prefer_fast: Use fast model tier if True
            _raise_on_rate_limit: If True, raise requests.HTTPError when all providers
                                   fail due to rate limits, instead of returning (None, 'none').
                                   This allows RateLimitHandler.execute_with_retry to catch
                                   and retry with proper 2-minute waits.
        
        Returns:
            Tuple of (response_text, provider_used)
        """
        if self._should_switch_provider():
            self._switch_provider()

        overrides = self.get_request_overrides()
        temperature = float(overrides.get('temperature', temperature))
        if overrides.get('max_tokens'):
            max_tokens = int(overrides['max_tokens'])

        model_tier = 'fast' if prefer_fast else 'primary'
        available = self._available_providers()
        if not available:
            logger.error("All AI providers failed: no API keys configured")
            return None, 'none'

        start = available.index(self.current_provider) if self.current_provider in available else 0
        chain = available[start:] + available[:start]

        for provider in chain:
            try:
                if provider == 'nvidia':
                    result = self._make_nvidia_request(prompt, 2, temperature, max_tokens)
                elif provider == 'openrouter':
                    result = self._make_openrouter_request(prompt, model_tier, 2, temperature, max_tokens)
                else:
                    result = self._make_gemini_request(prompt, 2, temperature, max_tokens)
            except requests.HTTPError as e:
                # Rate limit propagated from the provider request itself
                if _raise_on_rate_limit and e.response is not None and e.response.status_code == 429:
                    logger.warning(
                        f"[RATE LIMIT] All providers exhausted due to rate limits. "
                        f"Propagating to RateLimitHandler for retry with wait."
                    )
                    raise
                logger.warning(f"[PROVIDER] {provider} raised an HTTP error; trying next provider: {e}")
                continue
            except Exception as e:
                logger.warning(f"[PROVIDER] {provider} raised {type(e).__name__}; trying next provider: {e}")
                continue

            if result:
                return result, provider

            logger.warning(f"[PROVIDER] {provider} returned no content; trying next provider")

        logger.warning("All AI providers returned no content")
        return None, 'none'
    
    def get_provider_stats(self) -> Dict[str, Any]:
        """Get statistics about AI provider usage and performance"""
        with self._provider_lock:
            states = {name: dict(state) for name, state in self._provider_state.items()}

        models = {
            'nvidia': self.nvidia_model_name,
            'openrouter': self.openrouter_model_name,
            'gemini': self.gemini_model_name,
        }
        available = set(self._available_providers())

        stats: Dict[str, Any] = {
            "current_provider": self.current_provider,
            "active_model": models.get(self.current_provider),
            "provider_order": list(self.provider_order),
            "available_providers": [p for p in self.provider_order if p in available],
        }

        for name in self.provider_order:
            state = states.get(name, {})
            stats[name] = {
                "available": (bool(self.gemini_model) if name == 'gemini' else name in available),
                "model": models.get(name),
                "failure_count": self.provider_failure_counts.get(name, 0),
                "last_success": datetime.fromtimestamp(
                    min(self.provider_last_success.get(name, 0), time.time())
                ).isoformat(),
                "requests_this_minute": len(self.request_timestamps.get(name, [])),
                "rpm_limit": self._max_rpm_for(name),
                "is_cooling_down": state.get('is_cooling_down', False),
                "cooldown_remaining_seconds": self._get_cooldown_remaining(name),
            }

        stats["cache"] = {
            "size": len(self.response_cache),
            "max_size": 100,
            "ttl_seconds": self.cache_ttl,
        }
        return stats

    def _get_cooldown_remaining(self, provider: str) -> int:
        """Get remaining cooldown time in seconds for a provider"""
        cooldown_until = self._rate_limit_cooldown_until.get(provider, 0)
        remaining = cooldown_until - time.time()
        return max(0, int(remaining))


# Singleton instance
ai_provider_manager = AIProviderManager()
