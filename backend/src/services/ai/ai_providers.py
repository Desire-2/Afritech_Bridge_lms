"""
AI Provider Management Module
Handles OpenRouter and Gemini API connections, rate limiting, caching, and provider switching
"""

import os
import json
import re
import time
import hashlib
import logging
import random
import concurrent.futures
import threading
from typing import Dict, List, Optional, Any, Tuple
from collections import deque
from datetime import datetime
import requests

from .rate_limit_handler import rate_limit_handler, TaskCancelledError, RateLimitExhaustedError

logger = logging.getLogger(__name__)

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
    # Updated Feb 2026 - verified available on openrouter.ai/models
    # The primary model name is now configurable via self.openrouter_model_name
    MODEL_CONFIGS = {
        'primary': {
            'max_tokens': 8000,
            'cost_per_1k_tokens': 0.0,
        },
        'secondary': {
            'name': 'deepseek/deepseek-r1-0528:free',
            'max_tokens': 8000,
            'cost_per_1k_tokens': 0.0,
        },
        'fast': {
            'name': 'nvidia/nemotron-3-nano-30b-a3b:free',
            'max_tokens': 8000,
            'cost_per_1k_tokens': 0.0,
        },
    }

    def __init__(self):
        # Load API keys and model names — check DB settings first (if app context available), fall back to env
        self._load_api_keys_from_settings()
        
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
        self.current_provider = 'openrouter'
        self.provider_failure_counts = {'openrouter': 0, 'gemini': 0}
        self.provider_last_success = {'openrouter': time.time(), 'gemini': time.time()}
        self.max_provider_failures = 3

        # Enhanced provider state for rate-limit awareness (thread-safe)
        self._provider_lock = threading.Lock()
        self._provider_state = {
            'openrouter': {
                'failure_count': 0,
                'last_429_at': None,
                'is_cooling_down': False,
            },
            'gemini': {
                'failure_count': 0,
                'last_429_at': None,
                'is_cooling_down': False,
            },
        }
        
        # Rate limiting configuration (per provider)
        self.openrouter_max_rpm = int(os.environ.get('OPENROUTER_MAX_RPM', '200'))
        self.gemini_max_rpm = int(os.environ.get('GEMINI_MAX_RPM', '15'))
        self.request_timestamps = {'openrouter': deque(maxlen=200), 'gemini': deque(maxlen=15)}
        self.min_request_interval = 0.3
        self.last_request_time = {'openrouter': 0, 'gemini': 0}

        # Rate limit cooldown (set when 429 is received)
        self._rate_limit_cooldown_until = {'openrouter': 0, 'gemini': 0}

        # Proactive throttling threshold (fraction of RPM limit)
        self.proactive_threshold = float(os.environ.get(
            'RATE_LIMIT_PROACTIVE_THRESHOLD', '0.9'
        ))
        
        # Token/prompt optimization
        self.max_prompt_length = 100000
        
        # Response caching
        self.response_cache = {}
        self.cache_ttl = 3600

        # Per-user context: active_user_id stores which user's keys are active.
        # When set, keys are loaded from UserAISetting table.
        self._active_user_id = None
        
        # Initialize HTTP session — no custom Retry adapter
        # urllib3's default Retry with max_retries=0 can swallow response objects
        # on 429s, making e.response None. Use plain Session instead.
        self.session = requests.Session()
        
        self._initialize_providers()

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
        gemini_model_from_db = None
        openrouter_model_from_db = None

        try:
            # Lazy import to avoid circular imports at module load time
            from ..models.system_settings_models import SystemSettingsManager
            openrouter_from_db = SystemSettingsManager.get_setting('openrouter_api_key')
            gemini_from_db = SystemSettingsManager.get_setting('gemini_api_key')
            gemini_model_from_db = SystemSettingsManager.get_setting('gemini_model_name')
            openrouter_model_from_db = SystemSettingsManager.get_setting('openrouter_model_name')
        except Exception:
            # No app context or DB not ready yet — fall through to env vars
            pass

        # Use DB value if non-empty, otherwise env var, otherwise None/default
        self.openrouter_api_key = (
            openrouter_from_db if openrouter_from_db
            else os.environ.get('OPENROUTER_API_KEY')
        )
        self.gemini_api_key = (
            gemini_from_db if gemini_from_db
            else os.environ.get('GEMINI_API_KEY')
        )
        self.gemini_model_name = (
            gemini_model_from_db if gemini_model_from_db
            else os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash-preview-09-2025')
        )
        self.openrouter_model_name = (
            openrouter_model_from_db if openrouter_model_from_db
            else os.environ.get('OPENROUTER_MODEL', 'meta-llama/llama-3.3-70b-instruct:free')
        )

        # Store copies of global values for fallback when user context is cleared
        self._global_openrouter_api_key = self.openrouter_api_key
        self._global_gemini_api_key = self.gemini_api_key
        self._global_gemini_model_name = self.gemini_model_name
        self._global_openrouter_model_name = self.openrouter_model_name

    def reload_config(self):
        """
        Reload API keys and model names from DB system settings and reinitialize providers.
        Call this after settings are updated via the admin/instructor UI.
        This is safe to call at runtime — no restart needed.
        """
        old_or_key = self.openrouter_api_key
        old_gem_key = self.gemini_api_key
        old_gem_model = self.gemini_model_name
        old_or_model = self.openrouter_model_name

        self._load_api_keys_from_settings()

        key_changed = (
            old_or_key != self.openrouter_api_key
            or old_gem_key != self.gemini_api_key
            or old_gem_model != self.gemini_model_name
            or old_or_model != self.openrouter_model_name
        )

        if not key_changed:
            logger.info("[RELOAD] AI provider settings unchanged — no reconfiguration needed")
            return False

        logger.info("[RELOAD] AI provider settings changed — reinitializing providers")
        self._initialize_providers()
        return True

    def set_active_user(self, user_id: int):
        """
        Activate a specific user's AI provider settings.
        All subsequent AI requests will use this user's API keys and model names.
        Call clear_active_user() to restore global defaults.
        """
        if user_id is None:
            return self.clear_active_user()

        logger.info(f"[USER CTX] Activating AI settings for user {user_id}")
        self._active_user_id = user_id

        try:
            from ..models.system_settings_models import UserAISetting
            user_settings = UserAISetting.query.filter_by(user_id=user_id).first()
            if user_settings and (user_settings.openrouter_api_key or user_settings.gemini_api_key):
                # Use user's keys if they have any set
                self.openrouter_api_key = user_settings.openrouter_api_key or self._global_openrouter_api_key
                self.gemini_api_key = user_settings.gemini_api_key or self._global_gemini_api_key
                self.openrouter_model_name = user_settings.openrouter_model_name or self._global_openrouter_model_name
                self.gemini_model_name = user_settings.gemini_model_name or self._global_gemini_model_name
                logger.info(f"[USER CTX] User {user_id} has personal AI settings — activated")
            else:
                # User has no personal settings, use global defaults
                self.openrouter_api_key = self._global_openrouter_api_key
                self.gemini_api_key = self._global_gemini_api_key
                self.openrouter_model_name = self._global_openrouter_model_name
                self.gemini_model_name = self._global_gemini_model_name
                logger.info(f"[USER CTX] User {user_id} has no personal AI settings — using global defaults")
        except Exception as e:
            logger.warning(f"[USER CTX] Failed to load per-user settings for {user_id}: {e}")
            self.openrouter_api_key = self._global_openrouter_api_key
            self.gemini_api_key = self._global_gemini_api_key
            self.openrouter_model_name = self._global_openrouter_model_name
            self.gemini_model_name = self._global_gemini_model_name

        # Re-initialize providers (especially Gemini which needs genai.configure())
        self._initialize_providers()

    def clear_active_user(self):
        """
        Clear the per-user context and restore global/env AI provider settings.
        """
        if self._active_user_id:
            logger.info(f"[USER CTX] Clearing active user {self._active_user_id} — restoring global defaults")
        self._active_user_id = None
        self.openrouter_api_key = self._global_openrouter_api_key
        self.gemini_api_key = self._global_gemini_api_key
        self.openrouter_model_name = self._global_openrouter_model_name
        self.gemini_model_name = self._global_gemini_model_name
        self._initialize_providers()

    def update_api_key(self, provider: str, api_key: str) -> bool:
        """
        Dynamically update a single provider's API key at runtime.
        Does NOT persist to DB — settings routes handle that.
        Call reload_config() after persisting to DB for full reinitialization.

        Args:
            provider: 'openrouter' or 'gemini'
            api_key: The new API key

        Returns:
            bool: True if the provider was successfully (re)initialized
        """
        if provider == 'openrouter':
            self.openrouter_api_key = api_key
            logger.info(f"[API KEY] OpenRouter API key updated in memory")
            return True
        elif provider == 'gemini':
            self.gemini_api_key = api_key
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
        """Initialize OpenRouter and Gemini providers"""
        if self.openrouter_api_key:
            logger.info(f"OpenRouter AI initialized (Primary provider, Rate limit: {self.openrouter_max_rpm} RPM)")
        else:
            logger.warning("OPENROUTER_API_KEY not found. Will use Gemini as primary provider.")
            self.current_provider = 'gemini'
        
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
        """Generate cache key for response caching"""
        cache_str = f"{provider}:{model}:{prompt}"
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
        keys_to_remove = []
        prompt_hash_fragment = hashlib.md5(prompt.encode()).hexdigest()[:8]
        for key in list(self.response_cache.keys()):
            # Rebuild cache key for each provider/model combo and check
            cached_data = self.response_cache.get(key)
            if cached_data:
                # Check if response contains the same prompt hash
                # Since we can't reverse the hash, iterate all and check by re-computing
                for provider in ['openrouter', 'gemini']:
                    for model_tier in self.MODEL_CONFIGS:
                        if model_tier == 'primary':
                            model_name = self.openrouter_model_name
                        else:
                            model_name = self.MODEL_CONFIGS[model_tier].get('name', 'meta-llama/llama-3.3-70b-instruct:free')
                        expected_key = self._get_cache_key(prompt, provider, model_name)
                        if expected_key == key:
                            keys_to_remove.append(key)
                    # Also check gemini model
                    expected_key = self._get_cache_key(prompt, 'gemini', 'gemini-2.5-flash')
                    if expected_key == key:
                        keys_to_remove.append(key)
        
        removed = 0
        for key in set(keys_to_remove):
            if key in self.response_cache:
                del self.response_cache[key]
                removed += 1
        if removed:
            logger.info(f"Invalidated {removed} cached response(s) for prompt")
    
    # ===== Rate Limiting =====
    
    # Maximum seconds we'll ever sleep for a single rate-limit cooldown
    MAX_COOLDOWN_SLEEP = 120

    def _wait_for_rate_limit(self, provider: str = 'openrouter'):
        """Implement provider-specific rate limiting with cooldown awareness and proactive throttling"""
        current_time = time.time()
        max_rpm = self.openrouter_max_rpm if provider == 'openrouter' else self.gemini_max_rpm
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
        if len(timestamps) >= max_rpm:
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
        failures = self.provider_failure_counts[current]

        if failures >= self.max_provider_failures:
            logger.warning(
                f"[PROVIDER] {current} has {failures} consecutive failures. Switching provider."
            )
            return True
        return False

    def _switch_provider(self):
        """Switch to alternative provider"""
        old_provider = self.current_provider
        if self.current_provider == 'openrouter':
            if self.gemini_model:
                self.current_provider = 'gemini'
                logger.info(
                    f"[PROVIDER] Switched from {old_provider} to gemini "
                    f"after {self.provider_failure_counts.get(old_provider, 0)} consecutive failures."
                )
            else:
                logger.error("Cannot switch provider: Gemini not available")
        else:
            if self.openrouter_api_key:
                self.current_provider = 'openrouter'
                logger.info(
                    f"[PROVIDER] Switched from {old_provider} to openrouter "
                    f"after {self.provider_failure_counts.get(old_provider, 0)} consecutive failures."
                )
            else:
                logger.error("Cannot switch provider: OpenRouter not available")

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

    def force_provider(self, provider: str):
        """Force use of a specific provider"""
        if provider in ['openrouter', 'gemini']:
            self.current_provider = provider
            self.reset_provider_failures()
            logger.info(f"Forced provider switch to {provider}")
        else:
            logger.error(f"Invalid provider: {provider}")
    
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
            model_name = model_config.get('name', 'meta-llama/llama-3.3-70b-instruct:free')
        
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
                    "top_p": 0.9,
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
                            temperature: float = 0.7) -> Optional[str]:
        """Make a request to Gemini API with rate limiting and retry logic"""
        if not self.gemini_model:
            logger.warning("Gemini model not initialized")
            return None
        
        cache_key = self._get_cache_key(prompt, 'gemini', 'gemini-2.5-flash')
        cached = self._get_cached_response(cache_key)
        if cached:
            return cached
        
        optimized_prompt = self._optimize_prompt(prompt, 30000)
        
        for attempt in range(retry_count + 1):
            executor = None
            future = None
            try:
                self._wait_for_rate_limit('gemini')
                
                logger.info(f"Making Gemini API request (attempt {attempt + 1}/{retry_count + 1}, prompt length: {len(optimized_prompt)} chars)")
                
                generation_config = {
                    'temperature': temperature,
                    'top_p': 0.9,
                    'top_k': 40,
                    'max_output_tokens': self.gemini_max_output_tokens,
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
                    
        # If we get here, all retries exhausted on a rate limit — propagate
        raise  # re-raise the last rate-limit exception
    
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
        
        model_tier = 'fast' if prefer_fast else 'primary'
        
        try:
            if self.current_provider == 'openrouter':
                result = self._make_openrouter_request(prompt, model_tier, 2, temperature, max_tokens)
                if result:
                    return result, 'openrouter'
                
                # Fallback to Gemini — give it enough retries to wait out rate limits
                logger.warning("OpenRouter failed, falling back to Gemini")
                result = self._make_gemini_request(prompt, 2, temperature)
                if result:
                    return result, 'gemini'
            else:
                result = self._make_gemini_request(prompt, 2, temperature)
                if result:
                    return result, 'gemini'
                
                # Fallback to OpenRouter with fewer retries
                logger.warning("Gemini failed, falling back to OpenRouter")
                result = self._make_openrouter_request(prompt, model_tier, 1, temperature, max_tokens)
                if result:
                    return result, 'openrouter'
        except requests.HTTPError as e:
            # Rate limit propagated from _make_openrouter_request or _make_gemini_request
            if _raise_on_rate_limit and e.response and e.response.status_code == 429:
                logger.warning(
                    f"[RATE LIMIT] All providers exhausted due to rate limits. "
                    f"Propagating to RateLimitHandler for retry with wait."
                )
                raise
            # For direct callers without _raise_on_rate_limit, return None as before
            logger.error("All AI providers failed")
            return None, 'none'
        
        logger.warning("All AI providers returned no content")
        return None, 'none'
    
    def get_provider_stats(self) -> Dict[str, Any]:
        """Get statistics about AI provider usage and performance"""
        with self._provider_lock:
            or_state = dict(self._provider_state.get('openrouter', {}))
            gem_state = dict(self._provider_state.get('gemini', {}))

        return {
            "current_provider": self.current_provider,
            "openrouter": {
                "available": bool(self.openrouter_api_key),
                "failure_count": self.provider_failure_counts.get('openrouter', 0),
                "last_success": datetime.fromtimestamp(min(self.provider_last_success.get('openrouter', 0), time.time())).isoformat(),
                "requests_this_minute": len(self.request_timestamps['openrouter']),
                "rpm_limit": self.openrouter_max_rpm,
                "is_cooling_down": or_state.get('is_cooling_down', False),
                "cooldown_remaining_seconds": self._get_cooldown_remaining('openrouter'),
            },
            "gemini": {
                "available": bool(self.gemini_model),
                "failure_count": self.provider_failure_counts.get('gemini', 0),
                "last_success": datetime.fromtimestamp(min(self.provider_last_success.get('gemini', 0), time.time())).isoformat(),
                "requests_this_minute": len(self.request_timestamps['gemini']),
                "rpm_limit": self.gemini_max_rpm,
                "is_cooling_down": gem_state.get('is_cooling_down', False),
                "cooldown_remaining_seconds": self._get_cooldown_remaining('gemini'),
            },
            "cache": {
                "size": len(self.response_cache),
                "max_size": 100,
                "ttl_seconds": self.cache_ttl,
            }
        }

    def _get_cooldown_remaining(self, provider: str) -> int:
        """Get remaining cooldown time in seconds for a provider"""
        cooldown_until = self._rate_limit_cooldown_until.get(provider, 0)
        remaining = cooldown_until - time.time()
        return max(0, int(remaining))


# Singleton instance
ai_provider_manager = AIProviderManager()
