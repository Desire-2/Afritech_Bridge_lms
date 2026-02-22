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
import concurrent.futures
from typing import Dict, List, Optional, Any, Tuple
from collections import deque
from datetime import datetime
import requests

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
    MODEL_CONFIGS = {
        'primary': {
            'name': 'meta-llama/llama-3.3-70b-instruct:free',
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
        # OpenRouter configuration
        self.openrouter_api_key = os.environ.get('OPENROUTER_API_KEY')
        self.openrouter_base_url = "https://openrouter.ai/api/v1/chat/completions"
        self.site_url = os.environ.get('SITE_URL', 'https://afritecbridge.com')
        self.site_name = os.environ.get('SITE_NAME', 'Afritec Bridge LMS')
        self.openrouter_timeout = int(os.environ.get('OPENROUTER_TIMEOUT_SECONDS', '60'))
        self.gemini_timeout = int(os.environ.get('GEMINI_TIMEOUT_SECONDS', '120'))
        self.gemini_max_output_tokens = int(os.environ.get('GEMINI_MAX_OUTPUT_TOKENS', '8192'))
        
        # Gemini configuration (fallback)
        self.gemini_api_key = os.environ.get('GEMINI_API_KEY')
        self.gemini_model = None
        
        # Provider state management
        self.current_provider = 'openrouter'
        self.provider_failure_counts = {'openrouter': 0, 'gemini': 0}
        self.provider_last_success = {'openrouter': time.time(), 'gemini': time.time()}
        self.max_provider_failures = 3
        
        # Rate limiting configuration (per provider)
        self.openrouter_max_rpm = int(os.environ.get('OPENROUTER_MAX_RPM', '200'))
        self.gemini_max_rpm = int(os.environ.get('GEMINI_MAX_RPM', '15'))
        self.request_timestamps = {'openrouter': deque(maxlen=200), 'gemini': deque(maxlen=15)}
        self.min_request_interval = 0.3
        self.last_request_time = {'openrouter': 0, 'gemini': 0}
        
        # Rate limit cooldown (set when 429 is received)
        self._rate_limit_cooldown_until = {'openrouter': 0, 'gemini': 0}
        
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
    
    def _initialize_providers(self):
        """Initialize OpenRouter and Gemini providers"""
        if self.openrouter_api_key:
            logger.info(f"OpenRouter AI initialized (Primary provider, Rate limit: {self.openrouter_max_rpm} RPM)")
        else:
            logger.warning("OPENROUTER_API_KEY not found. Will use Gemini as primary provider.")
            self.current_provider = 'gemini'
        
        if not self.gemini_api_key:
            logger.warning("GEMINI_API_KEY not found in environment variables")
        elif GENAI_AVAILABLE:
            try:
                genai.configure(api_key=self.gemini_api_key)
                model_name = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash-preview-09-2025')
                self.gemini_model = genai.GenerativeModel(model_name)
                logger.info(f"Gemini AI initialized (Fallback provider: {model_name}, Rate limit: {self.gemini_max_rpm} RPM)")
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
                        model_name = self.MODEL_CONFIGS[model_tier]['name']
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
    
    def _wait_for_rate_limit(self, provider: str = 'openrouter'):
        """Implement provider-specific rate limiting with cooldown awareness"""
        current_time = time.time()
        max_rpm = self.openrouter_max_rpm if provider == 'openrouter' else self.gemini_max_rpm
        timestamps = self.request_timestamps[provider]
        
        # Check rate-limit cooldown (set when 429 is received from the provider)
        cooldown_until = self._rate_limit_cooldown_until.get(provider, 0)
        cooldown_remaining = cooldown_until - current_time
        if cooldown_remaining > 0:
            logger.info(f"Rate limit cooldown active for {provider}: waiting {cooldown_remaining:.1f}s")
            time.sleep(cooldown_remaining)
            current_time = time.time()
        
        time_since_last = current_time - self.last_request_time[provider]
        if time_since_last < self.min_request_interval:
            sleep_time = self.min_request_interval - time_since_last
            logger.debug(f"Rate limiting ({provider}): waiting {sleep_time:.2f}s before next request")
            time.sleep(sleep_time)
            current_time = time.time()
        
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
            logger.warning(f"Provider {current} has {failures} consecutive failures. Switching provider.")
            return True
        return False
    
    def _switch_provider(self):
        """Switch to alternative provider"""
        if self.current_provider == 'openrouter':
            if self.gemini_model:
                self.current_provider = 'gemini'
                logger.info("Switched to Gemini provider")
            else:
                logger.error("Cannot switch provider: Gemini not available")
        else:
            if self.openrouter_api_key:
                self.current_provider = 'openrouter'
                logger.info("Switched to OpenRouter provider")
            else:
                logger.error("Cannot switch provider: OpenRouter not available")
    
    def _mark_provider_success(self, provider: str):
        """Mark successful request for provider"""
        self.provider_failure_counts[provider] = 0
        self.provider_last_success[provider] = time.time()
    
    def _mark_provider_failure(self, provider: str):
        """Mark failed request for provider"""
        self.provider_failure_counts[provider] += 1
        logger.warning(f"Provider {provider} failure count: {self.provider_failure_counts[provider]}")
    
    def reset_provider_failures(self, provider: str = None):
        """Reset failure counts for a provider or all providers"""
        if provider:
            self.provider_failure_counts[provider] = 0
            logger.info(f"Reset failure count for {provider}")
        else:
            for p in self.provider_failure_counts:
                self.provider_failure_counts[p] = 0
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
        model_name = model_config['name']
        
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
                    
                    # Check for Retry-After header from the provider
                    retry_after = None
                    if e.response is not None:
                        retry_after = e.response.headers.get('Retry-After') or e.response.headers.get('x-ratelimit-reset')
                    if retry_after:
                        try:
                            backoff_time = max(backoff_time, int(float(retry_after)) + 1)
                        except (ValueError, TypeError):
                            pass
                    
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
                        return None
                
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
                    
                    # Set cooldown for Gemini rate limiting
                    backoff_time = (attempt + 1) * 10
                    self._rate_limit_cooldown_until['gemini'] = time.time() + backoff_time
                    
                    if 'retry in' in error_msg.lower():
                        try:
                            match = re.search(r'retry in (\d+\.?\d*)s', error_msg)
                            if match:
                                retry_delay = float(match.group(1)) + 2
                                if attempt < retry_count:
                                    logger.info(f"Waiting {retry_delay}s before retry...")
                                    time.sleep(retry_delay)
                                    continue
                        except:
                            pass
                    
                    if attempt < retry_count:
                        logger.info(f"Backing off for {backoff_time}s before retry...")
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
                    
        self._mark_provider_failure('gemini')
        return None
    
    def make_ai_request(self, prompt: str, temperature: float = 0.7, 
                        max_tokens: int = 4096, prefer_fast: bool = False) -> Tuple[Optional[str], str]:
        """
        Unified AI request method with automatic provider switching
        
        Returns:
            Tuple of (response_text, provider_used)
        """
        if self._should_switch_provider():
            self._switch_provider()
        
        model_tier = 'fast' if prefer_fast else 'primary'
        
        if self.current_provider == 'openrouter':
            result = self._make_openrouter_request(prompt, model_tier, 2, temperature, max_tokens)
            if result:
                return result, 'openrouter'
            
            # Fallback to Gemini with fewer retries to avoid long waits
            logger.warning("OpenRouter failed, falling back to Gemini")
            result = self._make_gemini_request(prompt, 1, temperature)
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
        
        logger.error("All AI providers failed")
        return None, 'none'
    
    def get_provider_stats(self) -> Dict[str, Any]:
        """Get statistics about AI provider usage and performance"""
        return {
            "current_provider": self.current_provider,
            "openrouter": {
                "available": bool(self.openrouter_api_key),
                "failure_count": self.provider_failure_counts.get('openrouter', 0),
                "last_success": datetime.fromtimestamp(self.provider_last_success.get('openrouter', 0)).isoformat(),
                "requests_in_queue": len(self.request_timestamps['openrouter']),
                "max_rpm": self.openrouter_max_rpm,
            },
            "gemini": {
                "available": bool(self.gemini_model),
                "failure_count": self.provider_failure_counts.get('gemini', 0),
                "last_success": datetime.fromtimestamp(self.provider_last_success.get('gemini', 0)).isoformat(),
                "requests_in_queue": len(self.request_timestamps['gemini']),
                "max_rpm": self.gemini_max_rpm,
            },
            "cache": {
                "size": len(self.response_cache),
                "max_size": 100,
                "ttl_seconds": self.cache_ttl,
            }
        }


# Singleton instance
ai_provider_manager = AIProviderManager()
