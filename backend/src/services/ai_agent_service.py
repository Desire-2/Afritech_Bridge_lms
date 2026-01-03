"""
AI Agent Service for Afritec Bridge LMS
Uses OpenRouter AI (primary) and Google Gemini (fallback) for course content generation
"""

import os
import json
from typing import Dict, List, Optional, Any, Tuple
import logging
import time
from datetime import datetime, timedelta
from collections import deque
from functools import wraps
import requests
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

# Import Google Generative AI SDK
try:
    import google.generativeai as genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    logger.warning("google-generativeai package not installed. AI features will be limited.")

class AIAgentService:
    """Service to handle AI-assisted course content generation using OpenRouter (primary) and Gemini (fallback)"""
    
    # OpenRouter model configurations with fallback chain
    # Using FREE models to avoid payment errors
    MODEL_CONFIGS = {
        'primary': {
            'name': 'meta-llama/llama-3.3-70b-instruct:free',  # FREE - High quality Meta Llama
            'max_tokens': 8000,
            'cost_per_1k_tokens': 0.0,
        },
        'secondary': {
            'name': 'google/gemini-2.0-flash-exp:free',  # FREE - Fast Gemini via OpenRouter
            'max_tokens': 8192,
            'cost_per_1k_tokens': 0.0,
        },
        'fast': {
            'name': 'meta-llama/llama-3.2-3b-instruct:free',  # FREE - Ultra fast smaller model
            'max_tokens': 8000,
            'cost_per_1k_tokens': 0.0,
        },
        'free': {
            'name': 'meta-llama/llama-3.3-70b-instruct:free',  # FREE - Backup
            'max_tokens': 8000,
            'cost_per_1k_tokens': 0.0,
        }
    }
    
    def __init__(self):
        # OpenRouter configuration
        self.openrouter_api_key = os.environ.get('OPENROUTER_API_KEY')
        self.openrouter_base_url = "https://openrouter.ai/api/v1/chat/completions"
        self.site_url = os.environ.get('SITE_URL', 'https://afritecbridge.com')
        self.site_name = os.environ.get('SITE_NAME', 'Afritec Bridge LMS')
        
        # Gemini configuration (fallback)
        self.gemini_api_key = os.environ.get('GEMINI_API_KEY')
        self.gemini_model = None
        
        # Provider state management
        self.current_provider = 'openrouter'  # Start with OpenRouter
        self.provider_failure_counts = {'openrouter': 0, 'gemini': 0}
        self.provider_last_success = {'openrouter': time.time(), 'gemini': time.time()}
        self.max_provider_failures = 3  # Switch provider after 3 consecutive failures
        
        # Rate limiting configuration (per provider)
        self.openrouter_max_rpm = int(os.environ.get('OPENROUTER_MAX_RPM', '200'))  # OpenRouter has high limits
        self.gemini_max_rpm = int(os.environ.get('GEMINI_MAX_RPM', '15'))
        self.request_timestamps = {'openrouter': deque(maxlen=200), 'gemini': deque(maxlen=15)}
        self.min_request_interval = 0.3  # 300ms between requests
        self.last_request_time = {'openrouter': 0, 'gemini': 0}
        
        # Token/prompt optimization
        self.max_prompt_length = 100000  # Characters (roughly 25000 tokens)
        
        # Response caching for identical requests
        self.response_cache = {}
        self.cache_ttl = 3600  # Cache for 1 hour
        
        # Initialize HTTP session with retry logic for OpenRouter
        self.session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["POST"]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)
        
        # Initialize OpenRouter
        if self.openrouter_api_key:
            logger.info(f"OpenRouter AI initialized (Primary provider, Rate limit: {self.openrouter_max_rpm} RPM)")
        else:
            logger.warning("OPENROUTER_API_KEY not found. Will use Gemini as primary provider.")
            self.current_provider = 'gemini'
        
        # Initialize Gemini (fallback)
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
    
    def _get_cache_key(self, prompt: str, provider: str, model: str = None) -> str:
        """Generate cache key for response caching"""
        import hashlib
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
        # Limit cache size
        if len(self.response_cache) > 100:
            oldest_key = min(self.response_cache.keys(), 
                           key=lambda k: self.response_cache[k]['timestamp'])
            del self.response_cache[oldest_key]
    
    def _wait_for_rate_limit(self, provider: str = 'openrouter'):
        """
        Implement provider-specific rate limiting to prevent quota exhaustion
        """
        current_time = time.time()
        max_rpm = self.openrouter_max_rpm if provider == 'openrouter' else self.gemini_max_rpm
        timestamps = self.request_timestamps[provider]
        
        # Check minimum interval between requests
        time_since_last = current_time - self.last_request_time[provider]
        if time_since_last < self.min_request_interval:
            sleep_time = self.min_request_interval - time_since_last
            logger.debug(f"Rate limiting ({provider}): waiting {sleep_time:.2f}s before next request")
            time.sleep(sleep_time)
            current_time = time.time()
        
        # Check requests per minute limit
        if len(timestamps) >= max_rpm:
            oldest_request = timestamps[0]
            time_window = current_time - oldest_request
            if time_window < 60:
                sleep_time = 60 - time_window + 1  # Add 1 second buffer
                logger.warning(f"Rate limit reached for {provider} ({max_rpm} requests/min). Waiting {sleep_time:.2f}s")
                time.sleep(sleep_time)
                current_time = time.time()
        
        # Record this request
        timestamps.append(current_time)
        self.last_request_time[provider] = current_time
    
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
    
    def _optimize_prompt(self, prompt: str, max_length: int = None) -> str:
        """
        Optimize prompt length to stay within limits
        """
        max_length = max_length or self.max_prompt_length
        if len(prompt) <= max_length:
            return prompt
        
        logger.warning(f"Prompt too long ({len(prompt)} chars). Truncating to {max_length} chars")
        
        # Try to truncate at a natural break point
        truncated = prompt[:max_length]
        last_newline = truncated.rfind('\n')
        if last_newline > max_length * 0.8:  # If we can save 80%+, use newline
            truncated = truncated[:last_newline]
        
        truncated += "\n\n[Note: Some context was truncated due to length limits]"
        return truncated
    
    def _make_openrouter_request(self, prompt: str, model_tier: str = 'primary', 
                                 retry_count: int = 2, temperature: float = 0.7,
                                 max_tokens: int = 4096) -> Optional[str]:
        """
        Make a request to OpenRouter API with automatic model fallback
        
        Args:
            prompt: The prompt to send
            model_tier: Model tier to use ('primary', 'secondary', 'fast', 'free')
            retry_count: Number of retries on errors
            temperature: Sampling temperature (0.0-2.0)
            max_tokens: Maximum tokens in response
        """
        if not self.openrouter_api_key:
            logger.warning("OpenRouter API key not configured")
            return None
        
        model_config = self.MODEL_CONFIGS.get(model_tier, self.MODEL_CONFIGS['primary'])
        model_name = model_config['name']
        
        # Check cache first
        cache_key = self._get_cache_key(prompt, 'openrouter', model_name)
        cached = self._get_cached_response(cache_key)
        if cached:
            return cached
        
        # Optimize prompt
        optimized_prompt = self._optimize_prompt(prompt, model_config['max_tokens'] * 3)
        
        for attempt in range(retry_count + 1):
            try:
                # Apply rate limiting
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
                            "content": "You are an expert instructional designer and course content creator. Provide detailed, well-structured, and engaging educational content."
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
                    timeout=90  # 90 second timeout
                )
                
                response.raise_for_status()
                result = response.json()
                
                if 'choices' in result and len(result['choices']) > 0:
                    content = result['choices'][0]['message']['content']
                    logger.info(f"OpenRouter API request successful (model: {model_name}, tokens: {result.get('usage', {}).get('total_tokens', 'N/A')})")
                    
                    # Mark success and cache response
                    self._mark_provider_success('openrouter')
                    self._cache_response(cache_key, content)
                    return content
                else:
                    logger.error(f"Unexpected OpenRouter response format: {result}")
                    
            except requests.exceptions.HTTPError as e:
                error_msg = str(e)
                status_code = e.response.status_code if e.response else None
                
                # Handle rate limiting
                if status_code == 429:
                    logger.warning(f"OpenRouter rate limit hit (attempt {attempt + 1}): {error_msg}")
                    if attempt < retry_count:
                        backoff_time = (attempt + 1) * 15  # 15s, 30s, 45s
                        logger.info(f"Backing off for {backoff_time}s before retry...")
                        time.sleep(backoff_time)
                        continue
                    else:
                        # Try fallback model tier
                        if model_tier == 'primary':
                            logger.info("Trying secondary model tier...")
                            return self._make_openrouter_request(prompt, 'secondary', 1, temperature, max_tokens)
                        elif model_tier == 'secondary':
                            logger.info("Trying fast model tier...")
                            return self._make_openrouter_request(prompt, 'fast', 1, temperature, max_tokens)
                        elif model_tier == 'fast':
                            logger.info("Trying free model tier...")
                            return self._make_openrouter_request(prompt, 'free', 1, temperature, max_tokens)
                
                # Handle other errors
                logger.error(f"OpenRouter HTTP error (attempt {attempt + 1}): {error_msg}")
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
        """
        Make a request to Gemini API with rate limiting and retry logic
        
        Args:
            prompt: The prompt to send
            retry_count: Number of retries on quota errors
            temperature: Sampling temperature (0.0-2.0)
        """
        if not self.gemini_model:
            logger.warning("Gemini model not initialized")
            return None
        
        # Check cache first
        cache_key = self._get_cache_key(prompt, 'gemini', 'gemini-2.5-flash')
        cached = self._get_cached_response(cache_key)
        if cached:
            return cached
        
        # Optimize prompt length (Gemini has smaller context)
        optimized_prompt = self._optimize_prompt(prompt, 30000)
        
        for attempt in range(retry_count + 1):
            try:
                # Apply rate limiting
                self._wait_for_rate_limit('gemini')
                
                logger.info(f"Making Gemini API request (attempt {attempt + 1}/{retry_count + 1}, prompt length: {len(optimized_prompt)} chars)")
                
                # Configure generation parameters
                generation_config = {
                    'temperature': temperature,
                    'top_p': 0.9,
                    'top_k': 40,
                    'max_output_tokens': 8192,
                }
                
                response = self.gemini_model.generate_content(
                    optimized_prompt,
                    generation_config=generation_config
                )
                
                logger.info(f"Gemini API request successful")
                self._mark_provider_success('gemini')
                self._cache_response(cache_key, response.text)
                return response.text
                
            except Exception as e:
                error_msg = str(e)
                
                # Check if it's a quota/rate limit error
                if '429' in error_msg or 'quota' in error_msg.lower() or 'rate limit' in error_msg.lower():
                    logger.error(f"Gemini quota/rate limit error on attempt {attempt + 1}: {error_msg}")
                    
                    # Extract retry delay if available
                    if 'retry in' in error_msg.lower():
                        try:
                            import re
                            match = re.search(r'retry in (\d+\.?\d*)s', error_msg)
                            if match:
                                retry_delay = float(match.group(1)) + 2  # Add 2s buffer
                                if attempt < retry_count:
                                    logger.info(f"Waiting {retry_delay}s before retry...")
                                    time.sleep(retry_delay)
                                    continue
                        except:
                            pass
                    
                    # Default backoff
                    if attempt < retry_count:
                        backoff_time = (attempt + 1) * 10  # 10s, 20s, 30s
                        logger.info(f"Backing off for {backoff_time}s before retry...")
                        time.sleep(backoff_time)
                        continue
                
                logger.error(f"Error calling Gemini API: {e}")
                if attempt < retry_count:
                    time.sleep(2)  # Short delay before retry
                    continue
                    
        self._mark_provider_failure('gemini')
        return None
    
    def _make_ai_request(self, prompt: str, temperature: float = 0.7, 
                        max_tokens: int = 4096, prefer_fast: bool = False) -> Tuple[Optional[str], str]:
        """
        Unified AI request method with automatic provider switching
        
        Args:
            prompt: The prompt to send
            temperature: Sampling temperature (0.0-2.0)
            max_tokens: Maximum tokens in response
            prefer_fast: Whether to prefer faster/cheaper models
            
        Returns:
            Tuple of (response_text, provider_used)
        """
        # Check if we should switch provider
        if self._should_switch_provider():
            self._switch_provider()
        
        # Determine model tier for OpenRouter
        model_tier = 'fast' if prefer_fast else 'primary'
        
        # Try current provider
        if self.current_provider == 'openrouter':
            result = self._make_openrouter_request(prompt, model_tier, 2, temperature, max_tokens)
            if result:
                return result, 'openrouter'
            
            # Fallback to Gemini if OpenRouter fails
            logger.warning("OpenRouter failed, falling back to Gemini")
            result = self._make_gemini_request(prompt, 2, temperature)
            if result:
                return result, 'gemini'
        else:
            # Current provider is Gemini
            result = self._make_gemini_request(prompt, 2, temperature)
            if result:
                return result, 'gemini'
            
            # Fallback to OpenRouter if Gemini fails
            logger.warning("Gemini failed, falling back to OpenRouter")
            result = self._make_openrouter_request(prompt, model_tier, 2, temperature, max_tokens)
            if result:
                return result, 'openrouter'
        
        logger.error("All AI providers failed")
        return None, 'none'
    
    def _parse_json_response(self, result: str, context: str = "response") -> Optional[Dict[str, Any]]:
        """
        Parse JSON response from Gemini with error recovery
        
        Args:
            result: The raw response text
            context: Description of what's being parsed (for logging)
            
        Returns:
            Parsed JSON dict or None if parsing fails
        """
        if not result:
            return None
            
        try:
            # Clean up the response - remove markdown code blocks if present
            cleaned_result = result.strip()
            if cleaned_result.startswith('```json'):
                cleaned_result = cleaned_result[7:]
            elif cleaned_result.startswith('```'):
                cleaned_result = cleaned_result[3:]
            if cleaned_result.endswith('```'):
                cleaned_result = cleaned_result[:-3]
            cleaned_result = cleaned_result.strip()
            
            # Try to parse JSON
            try:
                return json.loads(cleaned_result)
            except json.JSONDecodeError as e:
                # Try to fix common JSON issues
                logger.warning(f"Initial JSON parse failed for {context}: {e}. Attempting to fix...")
                
                # Log response for debugging
                logger.error(f"Raw {context} (first 1000 chars): {result[:1000]}")
                
                # Try to extract just the JSON object
                start_idx = cleaned_result.find('{')
                end_idx = cleaned_result.rfind('}')
                if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                    json_str = cleaned_result[start_idx:end_idx + 1]
                    
                    # Try parsing the extracted JSON
                    try:
                        return json.loads(json_str)
                    except json.JSONDecodeError:
                        logger.error(f"Failed to extract valid JSON from {context}")
                        return None
                        
        except Exception as e:
            logger.error(f"Failed to parse Gemini {context} as JSON: {e}")
            
        return None
    
    def generate_course_outline(self, topic: str, target_audience: str = "", 
                               learning_objectives: str = "") -> Dict[str, Any]:
        """
        Generate a complete course outline based on topic and requirements
        
        Args:
            topic: The main course topic
            target_audience: Description of target learners
            learning_objectives: Desired learning outcomes
            
        Returns:
            Dict containing course title, description, objectives, and module suggestions
        """
        prompt = f"""You are an expert instructional designer. Create a comprehensive course outline for the following:

Topic: {topic}
Target Audience: {target_audience or "General learners"}
Learning Objectives: {learning_objectives or "To be determined"}

Please provide:
1. A compelling course title
2. A detailed course description (2-3 paragraphs)
3. Refined learning objectives (3-5 bullet points)
4. Suggested course duration (in hours)
5. Prerequisites (if any)
6. 5-8 module titles with brief descriptions

Format your response as JSON with the following structure:
{{
  "title": "Course Title",
  "description": "Detailed description...",
  "learning_objectives": "• Objective 1\\n• Objective 2\\n• Objective 3",
  "estimated_duration": "40 hours",
  "target_audience": "Refined audience description",
  "prerequisites": "List of prerequisites or 'None'",
  "suggested_modules": [
    {{"title": "Module 1 Title", "description": "Module description", "order": 1}},
    {{"title": "Module 2 Title", "description": "Module description", "order": 2}}
  ]
}}"""
        
        result, provider = self._make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        if result:
            parsed = self._parse_json_response(result, "course outline")
            if parsed:
                logger.info(f"Course outline generated successfully using {provider}")
                return parsed
        
        logger.warning("Using fallback course outline")
        return {
            "title": f"Introduction to {topic}",
            "description": f"A comprehensive course covering {topic}.",
            "learning_objectives": "• Understand core concepts\n• Apply practical skills\n• Build confidence",
            "estimated_duration": "20 hours",
            "target_audience": target_audience or "General learners",
            "suggested_modules": []
        }
    
    def generate_multiple_modules(self, course_title: str, course_description: str,
                                  course_objectives: str, num_modules: int = 5,
                                  existing_modules: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Generate multiple module outlines at once for a course
        
        Args:
            course_title: The parent course title
            course_description: Course description for context
            course_objectives: Course learning objectives
            num_modules: Number of modules to generate
            existing_modules: List of existing modules with their details for context
            
        Returns:
            Dict containing list of modules with their details
        """
        # Build existing modules context string
        existing_modules_text = ""
        start_module_num = 1
        if existing_modules and len(existing_modules) > 0:
            existing_modules_text = f"\n\nExisting Modules in this Course ({len(existing_modules)}):\n"
            for idx, module in enumerate(existing_modules, 1):
                existing_modules_text += f"\nModule {idx}: {module['title']}\n"
                if module.get('description'):
                    existing_modules_text += f"  Description: {module['description']}\n"
                if module.get('learning_objectives'):
                    existing_modules_text += f"  Learning Objectives:\n"
                    for obj in module['learning_objectives'].split('\n'):
                        if obj.strip():
                            existing_modules_text += f"    {obj}\n"
            start_module_num = len(existing_modules) + 1
            existing_modules_text += f"\n[Note: Generate {num_modules} NEW modules (starting from Module {start_module_num}) that build upon these existing modules]"
        
        prompt = f"""You are an expert instructional designer creating multiple modules for an online course.

Course Title: {course_title}
Course Description: {course_description}
Course Objectives: {course_objectives}{existing_modules_text}

Create {num_modules} detailed module outlines that:
1. Have clear, progressive module titles (Module {start_module_num} through Module {start_module_num + num_modules - 1})
2. Each has a comprehensive module description (1-2 paragraphs)
3. Each has 3-5 specific learning objectives
4. Each includes 4-8 suggested lesson titles with brief descriptions and duration estimates
5. Progress logically from fundamentals to advanced topics
{f"6. Build upon and complement the existing {len(existing_modules)} module(s) without duplicating content" if existing_modules and len(existing_modules) > 0 else "6. Form a complete, coherent curriculum"}

Format as JSON:
{{
  "modules": [
    {{
      "title": "Module Title",
      "description": "Detailed module description...",
      "learning_objectives": "• Objective 1\\n• Objective 2\\n• Objective 3",
      "order": {start_module_num},
      "suggested_lessons": [
        {{"title": "Lesson 1 Title", "description": "Brief description", "duration_minutes": 30, "order": 1}},
        {{"title": "Lesson 2 Title", "description": "Brief description", "duration_minutes": 45, "order": 2}}
      ]
    }}
  ]
}}"""
        
        result, provider = self._make_ai_request(prompt, temperature=0.7, max_tokens=8192)
        if result:
            parsed = self._parse_json_response(result, "multiple modules")
            if parsed:
                logger.info(f"Multiple modules generated successfully using {provider}")
                return parsed
        
        logger.warning("Using fallback multiple modules response")
        return {
            "modules": []
        }
    
    def generate_module_content(self, course_title: str, course_description: str,
                               course_objectives: str, module_title: str = "",
                               existing_modules: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Generate module details based on course context
        
        Args:
            course_title: The parent course title
            course_description: Course description for context
            course_objectives: Course learning objectives
            module_title: Optional pre-defined module title
            existing_modules: List of existing modules with their details for context
            
        Returns:
            Dict containing module title, description, objectives, and lesson suggestions
        """
        # Build existing modules context string
        existing_modules_text = ""
        if existing_modules and len(existing_modules) > 0:
            existing_modules_text = "\n\nExisting Modules in this Course:\n"
            for idx, module in enumerate(existing_modules, 1):
                existing_modules_text += f"\nModule {idx}: {module['title']}\n"
                if module.get('description'):
                    existing_modules_text += f"  Description: {module['description']}\n"
                if module.get('learning_objectives'):
                    existing_modules_text += f"  Learning Objectives:\n"
                    for obj in module['learning_objectives'].split('\n'):
                        if obj.strip():
                            existing_modules_text += f"    {obj}\n"
            existing_modules_text += f"\n[Note: Generate the NEXT module (Module {len(existing_modules) + 1}) that builds upon these existing modules and avoids content duplication]"
        
        prompt = f"""You are an expert instructional designer creating a module for an online course.

Course Title: {course_title}
Course Description: {course_description}
Course Objectives: {course_objectives}{existing_modules_text}
{'Module Title: ' + module_title if module_title else 'Generate a suitable module title'}

Create a detailed module outline that:
1. {"Uses the provided module title" if module_title else "Suggests a clear, descriptive module title"}
2. Provides a comprehensive module description (1-2 paragraphs)
3. Lists 3-5 specific learning objectives for this module
4. Suggests 4-8 lesson titles that progressively build knowledge
5. Estimates duration for each lesson
{f"6. Ensures this new module complements and builds upon the existing {len(existing_modules)} module(s) without duplicating content" if existing_modules and len(existing_modules) > 0 else ""}
{f"7. Considers the logical progression from the previous modules" if existing_modules and len(existing_modules) > 0 else ""}

Format as JSON:
{{
  "title": "Module Title",
  "description": "Detailed module description...",
  "learning_objectives": "• Objective 1\\n• Objective 2\\n• Objective 3",
  "suggested_lessons": [
    {{"title": "Lesson 1 Title", "description": "Brief description", "duration_minutes": 30, "order": 1}},
    {{"title": "Lesson 2 Title", "description": "Brief description", "duration_minutes": 45, "order": 2}}
  ]
}}"""
        
        result, provider = self._make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        if result:
            parsed = self._parse_json_response(result, "module content")
            if parsed:
                logger.info(f"Module content generated successfully using {provider}")
                return parsed
        
        logger.warning("Using fallback module content")
        return {
            "title": module_title or "Course Module",
            "description": f"This module covers key concepts related to {course_title}.",
            "learning_objectives": "• Understand foundational concepts\n• Practice key skills",
            "suggested_lessons": []
        }
    
    def generate_lesson_content(self, course_title: str, module_title: str,
                               module_description: str, module_objectives: str,
                               lesson_title: str = "", lesson_description: str = "",
                               existing_lessons: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Generate detailed lesson content with markdown formatting
        
        Args:
            course_title: Parent course title
            module_title: Parent module title
            module_description: Module description for context
            module_objectives: Module learning objectives
            lesson_title: Lesson title (optional)
            lesson_description: Brief lesson description (optional)
            existing_lessons: List of existing lessons in the module for context
            
        Returns:
            Dict with lesson title, description, objectives, and markdown content
        """
        # Build existing lessons context string
        existing_lessons_text = ""
        if existing_lessons and len(existing_lessons) > 0:
            existing_lessons_text = "\n\nExisting Lessons in this Module:\n"
            for lesson in existing_lessons:
                existing_lessons_text += f"\n{lesson['order']}. {lesson['title']}"
                if lesson.get('description'):
                    existing_lessons_text += f"\n   Description: {lesson['description']}"
                if lesson.get('duration_minutes'):
                    existing_lessons_text += f"\n   Duration: {lesson['duration_minutes']} minutes"
            existing_lessons_text += f"\n\n[IMPORTANT: Analyze the existing {len(existing_lessons)} lesson(s) above. Generate the NEXT lesson (Lesson {len(existing_lessons) + 1}) that:"
            existing_lessons_text += "\n- Builds upon previous lessons naturally"
            existing_lessons_text += "\n- Covers NEW content not already taught"
            existing_lessons_text += "\n- Fills gaps in the learning progression"
            existing_lessons_text += "\n- Maintains logical flow and difficulty progression]"
        
        prompt = f"""You are an expert course creator developing engaging lesson content.

Course: {course_title}
Module: {module_title}
Module Description: {module_description}
Module Objectives: {module_objectives}{existing_lessons_text}
{'Lesson Title: ' + lesson_title if lesson_title else 'Generate a lesson title'}
{'Lesson Focus: ' + lesson_description if lesson_description else ''}

Create comprehensive lesson content including:
1. {"Use the provided lesson title" if lesson_title else "A clear, engaging lesson title that complements existing lessons"}
2. Brief lesson description (2-3 sentences)
3. 2-4 specific learning objectives for this lesson
4. Full lesson content in Markdown format with:
   - Introduction section{" (referencing previous lessons if applicable)" if existing_lessons and len(existing_lessons) > 0 else ""}
   - 3-5 main content sections with headers
   - Code examples (if relevant)
   - Practical examples or case studies
   - Key takeaways or summary
   - Discussion questions or reflections
5. Estimated duration in minutes
{f"6. Ensure the lesson builds progressively on the {len(existing_lessons)} existing lesson(s) without repeating content" if existing_lessons and len(existing_lessons) > 0 else ""}

The content should be detailed, educational, and engaging. Use proper markdown formatting:
- Headers (##, ###)
- Bold and italic text
- Bullet points and numbered lists
- Code blocks with syntax highlighting
- Blockquotes for important notes
- Tables where appropriate

IMPORTANT: Return ONLY valid JSON. Escape all special characters properly (quotes, newlines, etc.).
Use \\n for newlines in strings. Ensure all quotes inside strings are escaped as \\".

Format as JSON:
{{
  "title": "Lesson Title",
  "description": "Brief description...",
  "learning_objectives": "• Objective 1\\n• Objective 2\\n• Objective 3",
  "duration_minutes": 45,
  "content_type": "text",
  "content_data": "# Introduction\\n\\nDetailed markdown content..."
}}"""
        
        result, provider = self._make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        if result:
            parsed = self._parse_json_response(result, "lesson content")
            if parsed:
                return parsed
        
        return {
            "title": lesson_title or "Course Lesson",
            "description": lesson_description or "This lesson covers important concepts.",
            "learning_objectives": "• Learn key concepts\n• Apply knowledge practically",
            "duration_minutes": 30,
            "content_type": "text",
            "content_data": f"## Introduction\n\nWelcome to this lesson on {lesson_title or 'the topic'}.\n\n## Main Content\n\nContent to be developed..."
        }
    
    def generate_multiple_lessons(self, course_title: str, module_title: str,
                                  module_description: str, module_objectives: str,
                                  num_lessons: int = 5,
                                  existing_lessons: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Generate multiple lesson outlines at once for a module
        
        Args:
            course_title: Parent course title
            module_title: Parent module title
            module_description: Module description for context
            module_objectives: Module learning objectives
            num_lessons: Number of lessons to generate
            existing_lessons: List of existing lessons in the module for context
            
        Returns:
            Dict containing list of lessons with their details
        """
        # Build existing lessons context string
        existing_lessons_text = ""
        start_lesson_num = 1
        if existing_lessons and len(existing_lessons) > 0:
            existing_lessons_text = f"\n\nExisting Lessons in this Module ({len(existing_lessons)}):\n"
            for lesson in existing_lessons:
                existing_lessons_text += f"\n{lesson['order']}. {lesson['title']}"
                if lesson.get('description'):
                    existing_lessons_text += f"\n   Description: {lesson['description']}"
                if lesson.get('duration_minutes'):
                    existing_lessons_text += f"\n   Duration: {lesson['duration_minutes']} minutes"
            start_lesson_num = len(existing_lessons) + 1
            existing_lessons_text += f"\n\n[Note: Generate {num_lessons} NEW lessons (starting from Lesson {start_lesson_num}) that build upon these existing lessons and fill any gaps]"
        
        prompt = f"""You are an expert course creator developing multiple engaging lessons for a module.

Course: {course_title}
Module: {module_title}
Module Description: {module_description}
Module Objectives: {module_objectives}{existing_lessons_text}

Create {num_lessons} comprehensive lessons that:
1. Have clear, progressive lesson titles (Lesson {start_lesson_num} through Lesson {start_lesson_num + num_lessons - 1})
2. Each has a brief description (2-3 sentences)
3. Each has 2-4 specific learning objectives
4. Each includes full lesson content in Markdown format with:
   - Introduction section
   - 3-5 main content sections with headers
   - Code examples (if relevant to the subject)
   - Practical examples or case studies
   - Key takeaways or summary
   - Discussion questions or reflections
5. Each has estimated duration in minutes
6. Progress logically from fundamentals to advanced topics
{f"7. Build upon and complement the existing {len(existing_lessons)} lesson(s) without duplicating content" if existing_lessons and len(existing_lessons) > 0 else "7. Form a complete, coherent learning sequence"}

The content should be detailed, educational, and engaging. Use proper markdown formatting:
- Headers (##, ###)
- Bold and italic text
- Bullet points and numbered lists
- Code blocks with syntax highlighting (if applicable)
- Blockquotes for important notes
- Tables where appropriate

IMPORTANT: Return ONLY valid JSON. Escape all special characters properly (quotes, newlines, etc.).
Use \\n for newlines in strings. Ensure all quotes inside strings are escaped as \\".

Format as JSON:
{{
  "lessons": [
    {{
      "title": "Lesson Title",
      "description": "Brief description...",
      "learning_objectives": "• Objective 1\\n• Objective 2\\n• Objective 3",
      "duration_minutes": 45,
      "order": {start_lesson_num},
      "content_type": "text",
      "content_data": "# Introduction\\n\\nDetailed markdown content..."
    }}
  ]
}}"""
        
        result, provider = self._make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        if result:
            parsed = self._parse_json_response(result, "multiple lessons")
            if parsed:
                return parsed
        
        return {
            "lessons": []
        }
    
    def generate_quiz_questions(self, course_title: str, module_title: str,
                               lesson_title: str, lesson_content: str,
                               num_questions: int = 5,
                               question_types: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Generate quiz questions based on lesson content
        
        Args:
            course_title: Parent course title
            module_title: Parent module title
            lesson_title: The lesson this quiz is for
            lesson_content: Full lesson content to base questions on
            num_questions: Number of questions to generate (default 5)
            question_types: List of question types to include
            
        Returns:
            Dict with quiz title, description, and questions array
        """
        if question_types is None:
            question_types = ["multiple_choice", "true_false"]
        
        # Truncate lesson content if too long (keep first 2000 chars for context)
        content_sample = lesson_content[:2000] + "..." if len(lesson_content) > 2000 else lesson_content
        
        prompt = f"""You are an expert assessment designer creating quiz questions.

Course: {course_title}
Module: {module_title}
Lesson: {lesson_title}

Lesson Content Summary:
{content_sample}

Create {num_questions} assessment questions that:
1. Test understanding of key concepts from the lesson
2. Use these question types: {', '.join(question_types)}
3. Have varying difficulty levels (easy, medium, hard)
4. Include 4 answer options for multiple choice
5. Clearly mark the correct answer
6. Provide brief explanations for correct answers

Format as JSON:
{{
  "title": "{lesson_title} Quiz",
  "description": "Assessment covering key concepts from {lesson_title}",
  "time_limit": 20,
  "passing_score": 70,
  "questions": [
    {{
      "text": "Question text here?",
      "question_type": "multiple_choice",
      "points": 10,
      "explanation": "Explanation of correct answer",
      "answers": [
        {{"text": "Option A", "is_correct": false}},
        {{"text": "Option B", "is_correct": true}},
        {{"text": "Option C", "is_correct": false}},
        {{"text": "Option D", "is_correct": false}}
      ]
    }}
  ]
}}"""
        
        result, provider = self._make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        if result:
            try:
                # Clean up the response - remove markdown code blocks if present
                cleaned_result = result.strip()
                if cleaned_result.startswith('```json'):
                    cleaned_result = cleaned_result[7:]
                elif cleaned_result.startswith('```'):
                    cleaned_result = cleaned_result[3:]
                if cleaned_result.endswith('```'):
                    cleaned_result = cleaned_result[:-3]
                cleaned_result = cleaned_result.strip()
                
                return json.loads(cleaned_result)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse Gemini quiz response as JSON: {e}")
                logger.error(f"Raw response (first 500 chars): {result[:500]}")
        
        return {
            "title": f"{lesson_title} Quiz",
            "description": f"Test your knowledge of {lesson_title}",
            "time_limit": 20,
            "passing_score": 70,
            "questions": []
        }
    
    def generate_assignment(self, course_title: str, module_title: str,
                          module_description: str, lessons_summary: str) -> Dict[str, Any]:
        """
        Generate assignment based on module content
        
        Args:
            course_title: Parent course title
            module_title: Parent module title
            module_description: Module description
            lessons_summary: Summary of lessons in the module
            
        Returns:
            Dict with assignment details
        """
        prompt = f"""You are an expert instructional designer creating a practical assignment.

Course: {course_title}
Module: {module_title}
Module Description: {module_description}
Lessons Covered: {lessons_summary}

Create a comprehensive assignment that:
1. Has a clear, engaging title
2. Provides detailed instructions (3-5 paragraphs)
3. Lists specific deliverables
4. Includes grading criteria/rubric
5. Sets realistic due date (suggest days from now)
6. Estimates required time

The assignment should be practical, challenging, and directly tied to module objectives.

Format as JSON:
{{
  "title": "Assignment Title",
  "description": "Detailed assignment instructions with:\\n- What to do\\n- How to do it\\n- What to submit",
  "instructions": "Step-by-step instructions...",
  "max_points": 100,
  "due_date_days": 7,
  "grading_rubric": "• Criterion 1 (30%)\\n• Criterion 2 (40%)\\n• Criterion 3 (30%)"
}}"""
        
        result, provider = self._make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        if result:
            try:
                # Clean up the response - remove markdown code blocks if present
                cleaned_result = result.strip()
                if cleaned_result.startswith('```json'):
                    cleaned_result = cleaned_result[7:]
                elif cleaned_result.startswith('```'):
                    cleaned_result = cleaned_result[3:]
                if cleaned_result.endswith('```'):
                    cleaned_result = cleaned_result[:-3]
                cleaned_result = cleaned_result.strip()
                
                return json.loads(cleaned_result)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse Gemini assignment response as JSON: {e}")
                logger.error(f"Raw response (first 500 chars): {result[:500]}")
        
        return {
            "title": f"{module_title} Assignment",
            "description": f"Apply what you've learned in {module_title}",
            "instructions": "Complete the assignment according to the guidelines provided.",
            "max_points": 100,
            "due_date_days": 7,
            "grading_rubric": "• Completeness\n• Quality\n• Timeliness"
        }
    
    def generate_final_project(self, course_title: str, course_description: str,
                              course_objectives: str, modules_summary: str) -> Dict[str, Any]:
        """
        Generate capstone project for entire course
        
        Args:
            course_title: Course title
            course_description: Full course description
            course_objectives: Course learning objectives
            modules_summary: Summary of all modules
            
        Returns:
            Dict with project details
        """
        prompt = f"""You are an expert instructional designer creating a comprehensive capstone project.

Course: {course_title}
Description: {course_description}
Learning Objectives: {course_objectives}
Modules Covered: {modules_summary}

Create a capstone project that:
1. Has an inspiring, professional title
2. Provides comprehensive description and context
3. Clearly outlines project requirements and deliverables
4. Integrates concepts from across the entire course
5. Includes detailed grading rubric
6. Suggests realistic timeline
7. Lists required resources/tools

The project should be challenging, real-world applicable, and demonstrate mastery of course objectives.

Format as JSON:
{{
  "title": "Final Project Title",
  "description": "Comprehensive project overview (3-4 paragraphs)",
  "requirements": "Detailed requirements:\\n1. Requirement 1\\n2. Requirement 2\\n3. Requirement 3",
  "deliverables": "• Deliverable 1\\n• Deliverable 2\\n• Deliverable 3",
  "max_points": 200,
  "due_date_days": 14,
  "grading_rubric": "Detailed rubric with weights",
  "resources": "• Resource 1\\n• Resource 2"
}}"""
        
        result, provider = self._make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        if result:
            try:
                # Clean up the response - remove markdown code blocks if present
                cleaned_result = result.strip()
                if cleaned_result.startswith('```json'):
                    cleaned_result = cleaned_result[7:]
                elif cleaned_result.startswith('```'):
                    cleaned_result = cleaned_result[3:]
                if cleaned_result.endswith('```'):
                    cleaned_result = cleaned_result[:-3]
                cleaned_result = cleaned_result.strip()
                
                return json.loads(cleaned_result)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse Gemini project response as JSON: {e}")
                logger.error(f"Raw response (first 500 chars): {result[:500]}")
        
        return {
            "title": f"{course_title} - Final Project",
            "description": f"Capstone project for {course_title}",
            "requirements": "Complete a comprehensive project demonstrating course mastery.",
            "deliverables": "• Project documentation\n• Implementation\n• Presentation",
            "max_points": 200,
            "due_date_days": 14,
            "grading_rubric": "• Technical quality (40%)\n• Documentation (30%)\n• Presentation (30%)",
            "resources": "Use course materials and approved external resources"
        }
    
    def enhance_content(self, content_type: str, current_content: str,
                       enhancement_type: str = "improve") -> str:
        """
        Enhance existing content (improve clarity, add examples, expand, etc.)
        
        Args:
            content_type: Type of content (course, module, lesson, quiz, etc.)
            current_content: The current content to enhance
            enhancement_type: Type of enhancement (improve, expand, simplify, add_examples)
            
        Returns:
            Enhanced content string
        """
        enhancements = {
            "improve": "Improve clarity, grammar, and flow",
            "expand": "Expand with more details and depth",
            "simplify": "Simplify language for better understanding",
            "add_examples": "Add practical examples and use cases"
        }
        
        enhancement_desc = enhancements.get(enhancement_type, "Improve overall quality")
        
        prompt = f"""You are an expert content editor. {enhancement_desc} of the following {content_type} content:

Current Content:
{current_content}

Provide the enhanced version maintaining the original structure and format.
"""
        
        result, provider = self._make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        return result if result else current_content

    def generate_quiz_from_content(self, lesson_or_module_content: str, 
                                   content_title: str, content_type: str = "lesson",
                                   num_questions: int = 10, difficulty: str = "mixed") -> Dict[str, Any]:
        """
        Generate a quiz based on actual lesson or module content
        
        Args:
            lesson_or_module_content: The full content (markdown) of the lesson/module
            content_title: Title of the lesson/module
            content_type: "lesson" or "module"
            num_questions: Number of questions to generate (default 10)
            difficulty: "easy", "medium", "hard", or "mixed"
            
        Returns:
            Dict with quiz title, description, and questions with answers
        """
        # Optimize content length to avoid token limits
        optimized_content = lesson_or_module_content[:15000] if len(lesson_or_module_content) > 15000 else lesson_or_module_content
        
        difficulty_desc = {
            "easy": "focus on recall and basic understanding",
            "medium": "balance recall with application and analysis",
            "hard": "emphasize analysis, synthesis, and critical thinking",
            "mixed": "include a mix of difficulty levels (easy, medium, hard)"
        }
        difficulty_instruction = difficulty_desc.get(difficulty, difficulty_desc["mixed"])
        
        prompt = f"""You are an expert assessment designer creating a quiz based on specific content.

Content Type: {content_type.capitalize()}
{content_type.capitalize()} Title: {content_title}

{content_type.capitalize()} Content:
{optimized_content}

Create a comprehensive quiz with {num_questions} multiple-choice questions that:
1. Test understanding of KEY concepts from the {content_type} content above
2. {difficulty_instruction.capitalize()}
3. Include 4 answer options per question (A, B, C, D)
4. Clearly mark the correct answer
5. Provide brief explanations for correct answers
6. Cover different topics/sections from the content
7. Use clear, unambiguous question wording

IMPORTANT: Base questions ONLY on information actually present in the content above. Do NOT add questions about topics not covered in the content.

Format as JSON:
{{
  "title": "Quiz Title based on {content_title}",
  "description": "Assessment covering key concepts from {content_title}",
  "time_limit": {max(15, num_questions * 2)},
  "passing_score": 70,
  "questions": [
    {{
      "question_text": "Clear, specific question based on content?",
      "question_type": "multiple_choice",
      "points": {100 // num_questions},
      "correct_answer": "B",
      "explanation": "Brief explanation of why this is correct",
      "options": [
        {{"key": "A", "text": "Option A"}},
        {{"key": "B", "text": "Correct option"}},
        {{"key": "C", "text": "Option C"}},
        {{"key": "D", "text": "Option D"}}
      ]
    }}
  ]
}}"""
        
        result, provider = self._make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        if result:
            parsed = self._parse_json_response(result, "quiz from content")
            if parsed:
                return parsed
        
        return {
            "title": f"{content_title} Quiz",
            "description": f"Assessment based on {content_title}",
            "time_limit": max(15, num_questions * 2),
            "passing_score": 70,
            "questions": []
        }

    def generate_assignment_from_content(self, lesson_or_module_content: str,
                                        content_title: str, content_type: str = "lesson",
                                        assignment_type: str = "practical") -> Dict[str, Any]:
        """
        Generate an assignment based on actual lesson or module content
        
        Args:
            lesson_or_module_content: The full content of the lesson/module
            content_title: Title of the lesson/module  
            content_type: "lesson" or "module"
            assignment_type: "practical", "theoretical", "project", or "mixed"
            
        Returns:
            Dict with assignment details
        """
        optimized_content = lesson_or_module_content[:15000] if len(lesson_or_module_content) > 15000 else lesson_or_module_content
        
        assignment_focus = {
            "practical": "hands-on exercises and real-world application",
            "theoretical": "analysis, explanation, and conceptual understanding",
            "project": "comprehensive project-based work",
            "mixed": "combination of practical exercises and theoretical analysis"
        }
        focus_desc = assignment_focus.get(assignment_type, assignment_focus["mixed"])
        
        prompt = f"""You are an expert instructional designer creating an assignment based on specific content.

Content Type: {content_type.capitalize()}
{content_type.capitalize()} Title: {content_title}

{content_type.capitalize()} Content:
{optimized_content}

Create a comprehensive assignment that:
1. Focuses on {focus_desc}
2. Directly applies concepts from the {content_type} content above
3. Has clear, detailed instructions (4-6 paragraphs)
4. Lists specific deliverables
5. Includes detailed grading rubric with criteria and weights
6. Sets realistic timeline
7. Provides guidance on what to submit

IMPORTANT: Base the assignment ONLY on concepts and skills taught in the content above. Ensure learners can complete it using what they learned.

Format as JSON:
{{
  "title": "Engaging assignment title related to {content_title}",
  "description": "Overview of what students will accomplish (2-3 paragraphs)",
  "instructions": "Detailed step-by-step instructions:\\n1. First step...\\n2. Second step...\\n3. Third step...",
  "deliverables": "• Deliverable 1\\n• Deliverable 2\\n• Deliverable 3",
  "max_points": 100,
  "due_date_days": 7,
  "grading_rubric": "• Criterion 1 (XX%)\\n• Criterion 2 (XX%)\\n• Criterion 3 (XX%)",
  "submission_format": "Description of how to submit (file type, format, etc.)"
}}"""
        
        result, provider = self._make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        if result:
            parsed = self._parse_json_response(result, "assignment from content")
            if parsed:
                return parsed
        
        return {
            "title": f"{content_title} Assignment",
            "description": f"Apply concepts from {content_title}",
            "instructions": "Complete the assignment based on what you learned.",
            "deliverables": "• Completed assignment\\n• Documentation",
            "max_points": 100,
            "due_date_days": 7,
            "grading_rubric": "• Quality (50%)\\n• Completeness (50%)",
            "submission_format": "Submit as PDF or document file"
        }

    def generate_project_from_content(self, module_contents: List[Dict[str, str]],
                                     module_title: str, course_title: str) -> Dict[str, Any]:
        """
        Generate a project based on multiple lessons/modules content
        
        Args:
            module_contents: List of dicts with 'title' and 'content' keys
            module_title: Title of the module
            course_title: Title of the parent course
            
        Returns:
            Dict with project details
        """
        # Combine and optimize content
        combined_content = ""
        for idx, content_item in enumerate(module_contents[:5], 1):  # Limit to 5 items
            combined_content += f"\n\n=== {content_item.get('title', f'Item {idx}')} ===\n"
            item_content = content_item.get('content', '')
            # Take first 3000 chars of each
            combined_content += item_content[:3000] if len(item_content) > 3000 else item_content
        
        optimized_content = combined_content[:15000] if len(combined_content) > 15000 else combined_content
        
        prompt = f"""You are an expert instructional designer creating a comprehensive project.

Course: {course_title}
Module: {module_title}

Module Content Summary:
{optimized_content}

Create a capstone-style project that:
1. Integrates concepts from across the module content
2. Has a clear, professional project title
3. Provides comprehensive description and context (3-4 paragraphs)
4. Lists specific project requirements
5. Defines clear deliverables
6. Includes detailed grading rubric with weights
7. Suggests realistic timeline (days)
8. Lists required resources/tools

The project should be challenging, real-world applicable, and demonstrate mastery of module concepts.

IMPORTANT: Base the project ONLY on skills and knowledge covered in the module content above.

Format as JSON:
{{
  "title": "Professional project title",
  "description": "Comprehensive project overview explaining what, why, and how",
  "requirements": "Detailed project requirements:\\n1. Requirement 1\\n2. Requirement 2\\n3. Requirement 3",
  "deliverables": "• Deliverable 1\\n• Deliverable 2\\n• Deliverable 3\\n• Deliverable 4",
  "max_points": 150,
  "due_date_days": 14,
  "grading_rubric": "• Criterion 1 (XX%)\\n• Criterion 2 (XX%)\\n• Criterion 3 (XX%)\\n• Criterion 4 (XX%)",
  "resources": "• Resource/tool 1\\n• Resource/tool 2",
  "submission_format": "What to submit and how"
}}"""
        
        result, provider = self._make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        if result:
            parsed = self._parse_json_response(result, "project from content")
            if parsed:
                return parsed
        
        return {
            "title": f"{module_title} Project",
            "description": f"Comprehensive project for {module_title}",
            "requirements": "Apply concepts from the module",
            "deliverables": "• Project files\\n• Documentation\\n• Presentation",
            "max_points": 150,
            "due_date_days": 14,
            "grading_rubric": "• Technical quality (40%)\\n• Documentation (30%)\\n• Presentation (30%)",
            "resources": "Use module materials",
            "submission_format": "Submit as zip file with all deliverables"
        }
    
    def generate_mixed_content(self, course_title: str, module_title: str,
                              module_description: str, lesson_title: str,
                              lesson_description: str = "",
                              template_id: Optional[str] = None,
                              existing_sections: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Generate mixed content lesson with intelligent template-aware structure
        
        Args:
            course_title: Parent course title
            module_title: Parent module title
            module_description: Module description for context
            lesson_title: Lesson title
            lesson_description: Brief lesson description
            template_id: Template to use (intro-video-summary, multi-video-notes, etc.)
            existing_sections: Existing sections if appending/enhancing
            
        Returns:
            Dict containing structured mixed content sections
        """
        # Template structure definitions
        templates = {
            'intro-video-summary': [
                {'type': 'heading', 'role': 'introduction', 'content': 'Introduction'},
                {'type': 'text', 'role': 'intro_text', 'content': 'introduction paragraph'},
                {'type': 'video', 'role': 'main_video', 'content': 'video URL placeholder'},
                {'type': 'heading', 'role': 'takeaways', 'content': 'Key Takeaways'},
                {'type': 'text', 'role': 'summary', 'content': 'bullet point summary'}
            ],
            'multi-video-notes': [
                {'type': 'heading', 'role': 'part1', 'content': 'Part 1: Getting Started'},
                {'type': 'video', 'role': 'video1', 'content': 'video URL placeholder'},
                {'type': 'text', 'role': 'notes1', 'content': 'notes about part 1'},
                {'type': 'heading', 'role': 'part2', 'content': 'Part 2: Advanced Concepts'},
                {'type': 'video', 'role': 'video2', 'content': 'video URL placeholder'},
                {'type': 'text', 'role': 'notes2', 'content': 'notes about part 2'}
            ],
            'reading-exercises': [
                {'type': 'text', 'role': 'overview', 'content': 'overview with markdown'},
                {'type': 'pdf', 'role': 'study_material', 'content': 'PDF URL placeholder'},
                {'type': 'heading', 'role': 'exercises', 'content': 'Practice Exercises'},
                {'type': 'text', 'role': 'questions', 'content': 'exercise questions'}
            ],
            'visual-guide': [
                {'type': 'heading', 'role': 'guide', 'content': 'Step-by-Step Guide'},
                {'type': 'text', 'role': 'intro', 'content': 'guide introduction'},
                {'type': 'image', 'role': 'step1', 'content': 'image URL placeholder'},
                {'type': 'text', 'role': 'explanation1', 'content': 'step 1 explanation'},
                {'type': 'image', 'role': 'step2', 'content': 'image URL placeholder'},
                {'type': 'text', 'role': 'explanation2', 'content': 'step 2 explanation'}
            ]
        }
        
        # Build context from existing sections if provided
        existing_context = ""
        if existing_sections and len(existing_sections) > 0:
            existing_context = "\\n\\nExisting Content Sections:\\n"
            for idx, section in enumerate(existing_sections, 1):
                existing_context += f"\\n{idx}. {section.get('type', 'unknown').upper()}: "
                if section['type'] == 'heading':
                    existing_context += section.get('content', '')
                elif section['type'] in ['text']:
                    content_preview = section.get('content', '')[:100]
                    existing_context += f"{content_preview}..."
                elif section['type'] in ['video', 'pdf', 'image']:
                    existing_context += section.get('title', 'Untitled')
            existing_context += "\\n\\n[Generate sections that complement and extend this existing content]"
        
        # Build template guidance
        template_structure = templates.get(template_id, None) if template_id else None
        template_guidance = ""
        if template_structure:
            template_guidance = f"\\n\\nTemplate Structure ({template_id}):\\n"
            for idx, section in enumerate(template_structure, 1):
                template_guidance += f"{idx}. {section['type'].upper()}: {section['role']}\\n"
            template_guidance += "\\n[Generate content following this exact structure]"
        
        prompt = f"""You are an expert instructional designer and educator creating comprehensive, professional lesson content.

**Course Context:**
- Course: {course_title}
- Module: {module_title}
- Module Description: {module_description}
- Lesson Title: {lesson_title}
{f'- Lesson Description: {lesson_description}' if lesson_description else ''}{existing_context}{template_guidance}

**Your Task:**
Create a complete, professional lesson with rich, detailed content that thoroughly covers the topic "{lesson_title}".

**Content Requirements:**

1. **COMPREHENSIVE COVERAGE**: 
   - Cover the topic in depth with multiple perspectives
   - Include beginner-friendly explanations and advanced concepts
   - Provide step-by-step instructions where applicable
   - Add real-world examples and use cases

2. **TEXT SECTIONS** (Main Content):
   - Write FULL, DETAILED content (400-800 words per major section)
   - Use proper Markdown formatting:
     * ## for main headers, ### for subheaders
     * **bold** for emphasis, *italic* for terms
     * Numbered lists for steps: 1. Step one
     * Bullet points for features: - Feature item
     * Code blocks with syntax highlighting: ```language
     * Blockquotes for tips: > **Tip:** Important note
     * Tables for comparisons when relevant
   - Include practical examples with code snippets
   - Add "Key Concepts" sections with clear definitions
   - Include "Common Mistakes" or "Best Practices" subsections
   - End major sections with "Quick Review" bullet points

3. **STRUCTURED LEARNING FLOW**:
   - Start with Introduction (overview, learning objectives, prerequisites)
   - Core Content sections (main concepts, detailed explanations)
   - Practical Application (examples, exercises, hands-on activities)
   - Summary & Next Steps (key takeaways, further resources)

4. **VIDEO PLACEHOLDERS**:
   - Use: [INSERT_VIDEO_URL_HERE]
   - Provide descriptive titles like "Video Tutorial: Step-by-Step Guide"
   - Add 2-3 sentence description of what video should demonstrate

5. **PDF PLACEHOLDERS**:
   - Use: [INSERT_PDF_URL_HERE]
   - Title: "Reference Guide: [Topic]" or "Worksheet: [Activity]"
   - Description of PDF contents

6. **IMAGE PLACEHOLDERS**:
   - Use: [INSERT_IMAGE_URL_HERE]
   - Descriptive captions explaining what should be shown
   - Indicate diagrams, screenshots, or infographics

**Structure to Follow:**
{f'CRITICAL: Use the {template_id} template structure with these sections:' if template_id else 'Create 5-8 well-organized sections:'}
{template_guidance if template_guidance else '''
1. Introduction heading + intro text (include learning objectives)
2. Core Concept 1 heading + detailed text
3. Core Concept 2 heading + detailed text  
4. Video tutorial placeholder (optional)
5. Practical Application heading + examples/exercises
6. Summary heading + key takeaways
'''}

**Content Quality Standards:**
- Write as an expert educator with years of teaching experience
- Use clear, engaging language appropriate for learners
- Break complex topics into digestible chunks
- Include transitional phrases between sections
- Add motivational elements to encourage learning
- Use active voice and direct address ("you will learn")
- Incorporate analogies and metaphors for complex concepts

**Example Text Section Structure:**
## [Section Title]

[Opening paragraph introducing the concept - 2-3 sentences]

### Key Concepts

- **Concept 1**: Clear definition and explanation
- **Concept 2**: Clear definition and explanation

### Detailed Explanation

[3-4 paragraphs diving deep into the topic with examples]

```language
// Code example if applicable
example_code_here()
```

### Practical Application

1. **Step 1**: Detailed instruction
2. **Step 2**: Detailed instruction
3. **Step 3**: Detailed instruction

> **Pro Tip:** [Helpful advice or best practice]

### Common Mistakes to Avoid

- **Mistake 1**: Why it's wrong and what to do instead
- **Mistake 2**: Why it's wrong and what to do instead

### Quick Review

✓ Key point learned
✓ Another important concept
✓ Practical skill gained

CRITICAL: Return ONLY valid JSON. Properly escape all special characters.
Use \\\\n for newlines, \\\\" for quotes within strings.

{{
  "sections": [
    {{
      "type": "heading",
      "content": "Introduction",
      "title": "Introduction"
    }},
    {{
      "type": "text",
      "content": "## Introduction\\\\n\\\\n[Full detailed content here...]\\\\n\\\\n### Learning Objectives\\\\n\\\\nBy the end of this lesson, you will:\\\\n\\\\n1. **Objective 1**\\\\n2. **Objective 2**\\\\n3. **Objective 3**"
    }},
    {{
      "type": "heading",  
      "content": "Core Concepts",
      "title": "Core Concepts"
    }},
    {{
      "type": "text",
      "content": "## Core Concepts\\\\n\\\\n[800+ words of comprehensive content with examples, code blocks, lists, tips, etc.]"
    }},
    {{
      "type": "video",
      "url": "[INSERT_VIDEO_URL_HERE]",
      "title": "Video Tutorial: Hands-On Demonstration",
      "description": "This video demonstrates the key concepts in action..."
    }},
    {{
      "type": "heading",
      "content": "Practical Application",
      "title": "Practical Application"
    }},
    {{
      "type": "text",
      "content": "## Practical Application\\\\n\\\\n[Detailed step-by-step examples and exercises]"
    }},
    {{
      "type": "pdf",
      "url": "[INSERT_PDF_URL_HERE]",
      "title": "Document Title",
      "description": "What this document contains..."
    }},
    {{
      "type": "image",
      "url": "[INSERT_IMAGE_URL_HERE]",
      "caption": "Image description",
      "title": "What to show"
    }}
  ]
}}"""
        
        result, provider = self._make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        if result:
            parsed = self._parse_json_response(result, "mixed content")
            if parsed and 'sections' in parsed:
                return {
                    "sections": parsed['sections'],
                    "lesson_title": lesson_title,
                    "template_used": template_id
                }
        
        # Fallback: Return minimal template-based structure
        fallback_sections = []
        if template_structure:
            for section in template_structure:
                fallback_sections.append({
                    "type": section['type'],
                    "content": section['content'],
                    "title": section.get('content', '')
                })
        else:
            fallback_sections = [
                {"type": "heading", "content": "Introduction", "title": "Introduction"},
                {"type": "text", "content": f"## Introduction\\n\\nWelcome to {lesson_title}. In this lesson, you will learn key concepts.\\n\\n### Learning Objectives\\n\\n- Understand the fundamentals\\n- Apply knowledge practically\\n- Build real-world skills"},
                {"type": "video", "url": "[INSERT_VIDEO_URL_HERE]", "title": "Main Lecture Video"},
                {"type": "heading", "content": "Summary", "title": "Summary"},
                {"type": "text", "content": "## Key Takeaways\\n\\n- Important point 1\\n- Important point 2\\n- Important point 3"}
            ]
        
        return {
            "sections": fallback_sections,
            "lesson_title": lesson_title,
            "template_used": template_id
        }
    
    def enhance_section_content(self, section_type: str, section_content: str,
                               context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enhance a specific section of mixed content using AI
        
        Args:
            section_type: Type of section (text, heading, etc.)
            section_content: Current content of the section
            context: Additional context (lesson title, position, etc.)
            
        Returns:
            Dict with enhanced content
        """
        lesson_title = context.get('lesson_title', 'the lesson')
        section_position = context.get('section_position', 'middle')
        previous_section = context.get('previous_section', '')
        
        if section_type == 'text':
            prompt = f"""You are an expert educational content writer.

Lesson: {lesson_title}
Section Position: {section_position}
{f'Previous Section Context: {previous_section[:200]}...' if previous_section else ''}

Current Content:
{section_content}

Enhance this content by:
1. Expanding with more detail and examples
2. Improving clarity and structure
3. Adding practical applications
4. Using better markdown formatting
5. Including code examples if relevant
6. Making it more engaging and educational

Target length: 300-500 words
Format: Markdown with headers (##, ###), lists, bold, code blocks, blockquotes

Return ONLY the enhanced markdown content, no JSON wrapper."""
            
            result, provider = self._make_ai_request(prompt, temperature=0.7, max_tokens=4096)
            if result:
                return {"enhanced_content": result.strip()}
        
        elif section_type == 'heading':
            prompt = f"""Improve this heading for better clarity and engagement.

Lesson: {lesson_title}
Current Heading: {section_content}
Position: {section_position}

Return ONLY the improved heading text (no quotes, no explanation)."""
            
            result, provider = self._make_ai_request(prompt, temperature=0.7, max_tokens=4096)
            if result:
                return {"enhanced_content": result.strip().strip('"').strip("'")}
        
        # For video/pdf/image, suggest better titles and descriptions
        elif section_type in ['video', 'pdf', 'image']:
            prompt = f"""Suggest a better title and description for this {section_type}.

Lesson: {lesson_title}
Current Title: {section_content}

Return JSON:
{{
  "title": "Improved title",
  "description": "What this {section_type} should cover"
}}"""
            
            result, provider = self._make_ai_request(prompt, temperature=0.7, max_tokens=4096)
            if result:
                parsed = self._parse_json_response(result, "section enhancement")
                if parsed:
                    return parsed
        
        # Fallback: Return original content
        return {"enhanced_content": section_content}
    
    def generate_comprehensive_lesson_step_by_step(self, course_title: str, module_title: str,
                                                   module_description: str, module_objectives: str,
                                                   lesson_title: str, lesson_description: str = "",
                                                   difficulty_level: str = "intermediate",
                                                   existing_lessons: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Generate a comprehensive, professor-level lesson in multiple steps with progress tracking
        
        This method generates lessons in stages:
        1. Lesson outline and structure
        2. Introduction and learning objectives
        3. Main content sections (theory)
        4. Practical examples and case studies
        5. Exercises and assessments
        6. Summary and additional resources
        
        Args:
            course_title: Parent course title
            module_title: Parent module title
            module_description: Module description for context
            module_objectives: Module learning objectives
            lesson_title: Lesson title
            lesson_description: Brief lesson description
            difficulty_level: 'beginner', 'intermediate', or 'advanced'
            existing_lessons: List of existing lessons for context
            
        Returns:
            Dict with complete lesson content and generation progress
        """
        logger.info(f"Starting comprehensive lesson generation: {lesson_title}")
        
        # Build context from existing lessons
        existing_context = ""
        if existing_lessons and len(existing_lessons) > 0:
            existing_context = f"\n\nPREVIOUS LESSONS ({len(existing_lessons)}):\n"
            for idx, lesson in enumerate(existing_lessons, 1):
                existing_context += f"{idx}. {lesson['title']}\n"
                if lesson.get('description'):
                    existing_context += f"   - {lesson['description']}\n"
            existing_context += f"\nThis lesson should build upon these previous lessons and cover NEW content."
        
        todo_steps = []
        generated_content = {
            "title": lesson_title,
            "description": lesson_description,
            "difficulty_level": difficulty_level,
            "sections": {},
            "metadata": {
                "estimated_duration_minutes": 0,
                "prerequisites": [],
                "learning_outcomes": [],
                "key_concepts": []
            }
        }
        
        # STEP 1: Generate lesson outline and structure
        logger.info("Step 1/6: Generating lesson outline and structure...")
        todo_steps.append("✓ Generate lesson outline")
        
        outline_prompt = f"""You are a distinguished university professor with decades of teaching experience. 
Create a comprehensive lesson outline with academic rigor.

COURSE CONTEXT:
- Course: {course_title}
- Module: {module_title}
- Module Description: {module_description}
- Module Objectives: {module_objectives}{existing_context}

LESSON DETAILS:
- Title: {lesson_title}
- Description: {lesson_description or "To be determined"}
- Difficulty: {difficulty_level}

As an academic professor, create a detailed lesson outline that includes:

1. **Refined Lesson Description** (2-3 academic-style sentences)
2. **Prerequisites** (knowledge students should have before this lesson)
3. **Learning Outcomes** (4-6 specific, measurable outcomes using Bloom's Taxonomy)
4. **Key Concepts** (5-8 main concepts to be covered)
5. **Lesson Structure** (ordered sections with timing):
   - Introduction (timing)
   - Theoretical Foundation (timing)
   - Practical Applications (timing)
   - Examples & Case Studies (timing)
   - Exercises & Activities (timing)
   - Summary & Review (timing)
   - Additional Resources (timing)
6. **Estimated Total Duration** (in minutes)
7. **Assessment Methods** (how learning will be evaluated)

Format as JSON:
{{
  "description": "Academic-style lesson description",
  "prerequisites": ["Prerequisite 1", "Prerequisite 2"],
  "learning_outcomes": ["Outcome 1", "Outcome 2", "Outcome 3", "Outcome 4"],
  "key_concepts": ["Concept 1", "Concept 2", "Concept 3"],
  "structure": [
    {{"section": "Introduction", "duration_minutes": 5, "topics": ["Topic 1", "Topic 2"]}},
    {{"section": "Theoretical Foundation", "duration_minutes": 15, "topics": ["Theory 1", "Theory 2"]}}
  ],
  "total_duration_minutes": 60,
  "assessment_methods": ["Quiz", "Practical exercise", "Discussion"]
}}"""
        
        outline_result, _ = self._make_ai_request(outline_prompt, temperature=0.7, max_tokens=2048)
        outline_data = self._parse_json_response(outline_result, "lesson outline") if outline_result else None
        
        if outline_data:
            generated_content["description"] = outline_data.get("description", lesson_description)
            generated_content["metadata"]["prerequisites"] = outline_data.get("prerequisites", [])
            generated_content["metadata"]["learning_outcomes"] = outline_data.get("learning_outcomes", [])
            generated_content["metadata"]["key_concepts"] = outline_data.get("key_concepts", [])
            generated_content["metadata"]["estimated_duration_minutes"] = outline_data.get("total_duration_minutes", 60)
            generated_content["metadata"]["assessment_methods"] = outline_data.get("assessment_methods", [])
            lesson_structure = outline_data.get("structure", [])
        else:
            logger.warning("Failed to generate outline, using default structure")
            lesson_structure = [
                {"section": "Introduction", "duration_minutes": 5},
                {"section": "Theoretical Foundation", "duration_minutes": 20},
                {"section": "Practical Applications", "duration_minutes": 15},
                {"section": "Summary", "duration_minutes": 5}
            ]
        
        # STEP 2: Generate Introduction
        logger.info("Step 2/6: Generating introduction...")
        todo_steps.append("✓ Generate introduction")
        
        intro_prompt = f"""You are a distinguished professor beginning a lesson. Write an engaging, scholarly introduction.

LESSON: {lesson_title}
DESCRIPTION: {generated_content['description']}
LEARNING OUTCOMES: {', '.join(generated_content['metadata']['learning_outcomes'])}
KEY CONCEPTS: {', '.join(generated_content['metadata']['key_concepts'])}

Write a comprehensive introduction (400-600 words) in Markdown format that:

1. **Hook**: Start with an engaging question, scenario, or real-world relevance
2. **Context**: Explain why this topic matters in the broader field{f" and how it builds on previous lessons" if existing_lessons else ""}
3. **Overview**: Preview what will be covered and how it connects to learning outcomes
4. **Motivation**: Inspire students about practical applications and career relevance
5. **Roadmap**: Brief outline of the lesson structure

Use academic language but remain accessible. Include:
- **Bold** for emphasis on key terms
- *Italics* for important concepts
- > Blockquotes for notable insights
- Proper paragraphs with logical flow

Return the markdown content only (no JSON wrapper)."""
        
        intro_result, _ = self._make_ai_request(intro_prompt, temperature=0.8, max_tokens=1500)
        if intro_result:
            generated_content["sections"]["introduction"] = intro_result.strip()
        
        # STEP 3: Generate Theoretical Foundation
        logger.info("Step 3/6: Generating theoretical foundation...")
        todo_steps.append("✓ Generate theoretical content")
        
        theory_prompt = f"""You are a professor teaching the theoretical foundations of a topic. Provide comprehensive, academic-level content.

LESSON: {lesson_title}
KEY CONCEPTS: {', '.join(generated_content['metadata']['key_concepts'])}
DIFFICULTY: {difficulty_level}

Write detailed theoretical content (800-1200 words) covering the fundamental concepts and principles.

Structure your content with:

## Theoretical Foundation

### Core Concepts
Explain each key concept with:
- **Definition**: Clear, precise academic definition
- **Explanation**: Detailed explanation with context
- **Significance**: Why this concept matters
- **Related Concepts**: How it connects to other ideas

### Fundamental Principles
Present the underlying principles and theories:
- State principles clearly
- Provide mathematical formulations (if applicable)
- Explain the reasoning and derivation
- Discuss assumptions and limitations

### Historical Context (if relevant)
- Evolution of the concept
- Key contributors and their work
- Paradigm shifts and breakthroughs

### Current State of Knowledge
- Latest research and developments
- Ongoing debates or challenges
- Future directions

Use:
- Proper markdown headers (##, ###)
- **Bold** for definitions and key terms
- *Italics* for emphasis
- `Code blocks` for technical notation or formulas
- > Blockquotes for important theorems or principles
- Bullet points and numbered lists
- Tables for comparisons (if appropriate)

Return the markdown content only."""
        
        theory_result, _ = self._make_ai_request(theory_prompt, temperature=0.7, max_tokens=3000)
        if theory_result:
            generated_content["sections"]["theoretical_foundation"] = theory_result.strip()
        
        # STEP 4: Generate Practical Applications & Examples
        logger.info("Step 4/6: Generating practical applications...")
        todo_steps.append("✓ Generate practical applications")
        
        practical_prompt = f"""You are a professor demonstrating how theory applies in practice. Provide concrete, detailed examples.

LESSON: {lesson_title}
CONCEPTS: {', '.join(generated_content['metadata']['key_concepts'])}
DIFFICULTY: {difficulty_level}

Write comprehensive practical content (800-1200 words) with real-world applications and examples.

Structure your content with:

## Practical Applications

### Real-World Use Cases
Present 3-4 detailed real-world scenarios where these concepts apply:
- **Scenario Description**: Set the context
- **Application of Concepts**: How the theory applies
- **Step-by-Step Process**: Detailed walkthrough
- **Outcomes & Results**: What this achieves

### Detailed Examples
Provide 2-3 comprehensive, worked examples:
- **Example Setup**: Clear problem statement
- **Solution Approach**: Strategy and methodology
- **Detailed Steps**: Complete solution with explanations
- **Analysis**: Interpretation of results
- **Variations**: Alternative approaches or edge cases

### Case Studies (if applicable)
Present industry or research case studies:
- Background and context
- Problem or challenge
- Solution implementation
- Results and impact
- Lessons learned

### Code Examples (if applicable to subject)
```python
# Provide well-commented, professional code
# Include multiple examples showing different aspects
# Explain each section thoroughly
```

### Common Pitfalls & Best Practices
- **Mistakes to Avoid**: Common errors students make
- **Best Practices**: Professional standards and guidelines
- **Tips & Tricks**: Expert insights from experience

Use:
- Clear section headers
- Code blocks with syntax highlighting
- Tables for comparisons
- Numbered steps for processes
- Diagrams descriptions (in markdown)

Return the markdown content only."""
        
        practical_result, _ = self._make_ai_request(practical_prompt, temperature=0.7, max_tokens=3000)
        if practical_result:
            generated_content["sections"]["practical_applications"] = practical_result.strip()
        
        # STEP 5: Generate Exercises & Assessments
        logger.info("Step 5/6: Generating exercises and assessments...")
        todo_steps.append("✓ Generate exercises and assessments")
        
        exercises_prompt = f"""You are a professor designing exercises to reinforce learning. Create challenging, thought-provoking activities.

LESSON: {lesson_title}
LEARNING OUTCOMES: {', '.join(generated_content['metadata']['learning_outcomes'])}
DIFFICULTY: {difficulty_level}

Create comprehensive exercises and assessment activities (600-800 words):

## Practice Exercises

### Concept Check Questions
5-7 questions testing understanding of key concepts:
1. **Question**: Thought-provoking question
   - **Difficulty**: Easy/Medium/Hard
   - **Hint**: Guiding hint for students
   - **Key Points**: What a good answer should include

### Applied Problems
3-4 practical problems requiring application of concepts:
1. **Problem Statement**: Clear, realistic problem
   - **Required**: What students must demonstrate
   - **Suggested Approach**: Strategy hint
   - **Expected Outcome**: What solution should achieve

### Critical Thinking Challenges
2-3 advanced problems for deeper understanding:
1. **Challenge**: Complex, open-ended problem
   - **Context**: Real-world relevance
   - **Goals**: What students should explore
   - **Discussion Points**: Key issues to consider

### Hands-On Activities
Practical activities students can do:
- **Activity Description**: What to do
- **Materials/Tools Needed**: Resources required
- **Instructions**: Step-by-step guide
- **Learning Goal**: What this develops
- **Time Required**: Estimated duration

### Self-Assessment Checklist
Can-do statements for students:
- [ ] I can explain [concept] clearly
- [ ] I can apply [principle] to new situations
- [ ] I can analyze [problem type]
- [ ] I can evaluate [approach]

Return the markdown content only."""
        
        exercises_result, _ = self._make_ai_request(exercises_prompt, temperature=0.7, max_tokens=2048)
        if exercises_result:
            generated_content["sections"]["exercises"] = exercises_result.strip()
        
        # STEP 6: Generate Summary & Additional Resources
        logger.info("Step 6/6: Generating summary and resources...")
        todo_steps.append("✓ Generate summary and resources")
        
        summary_prompt = f"""You are a professor concluding a lesson. Provide a comprehensive summary and guide students to further learning.

LESSON: {lesson_title}
KEY CONCEPTS: {', '.join(generated_content['metadata']['key_concepts'])}
LEARNING OUTCOMES: {', '.join(generated_content['metadata']['learning_outcomes'])}

Write a conclusion section (500-700 words):

## Summary & Key Takeaways

### Lesson Recap
Concise summary of what was covered:
- Briefly revisit each major section
- Highlight the most important points
- Emphasize connections between concepts

### Key Takeaways
5-7 essential points students should remember:
1. **Takeaway 1**: Critical insight with brief explanation
2. **Takeaway 2**: Important principle to remember
3. **Takeaway 3**: Practical application to retain
[continue...]

### Connection to Next Steps
- How this lesson connects to upcoming content
- Prerequisites met for future lessons
- Skills gained for advanced topics

## Reflection Questions
3-4 deep reflection questions:
1. How does this relate to your previous knowledge?
2. Where might you apply this in your own context?
3. What questions do you still have?

## Additional Resources

### Recommended Reading
**Essential:**
- [Resource 1]: Brief description and why it's valuable
- [Resource 2]: What students will gain from this

**For Deeper Exploration:**
- [Advanced resource]: For students wanting more depth

### Online Resources
- **Interactive Tools**: Relevant online tools or simulations
- **Video Lectures**: Supplementary video content
- **Practice Platforms**: Where to practice skills

### Further Study
- Related topics to explore
- Advanced concepts that build on this
- Interdisciplinary connections

### Academic References
Key papers, books, or articles (in academic citation format):
- Author. (Year). Title. Journal/Book.

Return the markdown content only."""
        
        summary_result, _ = self._make_ai_request(summary_prompt, temperature=0.7, max_tokens=1800)
        if summary_result:
            generated_content["sections"]["summary"] = summary_result.strip()
        
        # Compile all sections into complete lesson content
        complete_content = f"""# {lesson_title}

{generated_content['description']}

---

**Duration:** {generated_content['metadata']['estimated_duration_minutes']} minutes  
**Difficulty:** {difficulty_level.capitalize()}

## Prerequisites
{chr(10).join(f"- {prereq}" for prereq in generated_content['metadata']['prerequisites'])}

## Learning Outcomes
By the end of this lesson, you will be able to:
{chr(10).join(f"{i}. {outcome}" for i, outcome in enumerate(generated_content['metadata']['learning_outcomes'], 1))}

---

{generated_content['sections'].get('introduction', '')}

---

{generated_content['sections'].get('theoretical_foundation', '')}

---

{generated_content['sections'].get('practical_applications', '')}

---

{generated_content['sections'].get('exercises', '')}

---

{generated_content['sections'].get('summary', '')}

---

## Lesson Complete! 🎓

You've completed this comprehensive lesson. Make sure to:
- Review the key takeaways
- Complete the practice exercises
- Explore the additional resources
- Prepare for the next lesson

Questions? Discussion forum is open for queries and discussions."""
        
        logger.info(f"Lesson generation complete: {lesson_title}")
        
        return {
            "title": lesson_title,
            "description": generated_content['description'],
            "learning_objectives": "\n".join(f"• {outcome}" for outcome in generated_content['metadata']['learning_outcomes']),
            "duration_minutes": generated_content['metadata']['estimated_duration_minutes'],
            "difficulty_level": difficulty_level,
            "prerequisites": generated_content['metadata']['prerequisites'],
            "key_concepts": generated_content['metadata']['key_concepts'],
            "assessment_methods": generated_content['metadata']['assessment_methods'],
            "content_type": "text",
            "content_data": complete_content,
            "sections": generated_content['sections'],
            "generation_steps": todo_steps,
            "metadata": generated_content['metadata']
        }
    
    def generate_lesson_section(self, lesson_title: str, section_type: str,
                               section_context: Dict[str, Any],
                               difficulty_level: str = "intermediate") -> str:
        """
        Generate a specific section of a lesson with professor-level quality
        
        Args:
            lesson_title: Title of the lesson
            section_type: Type of section ('introduction', 'theory', 'examples', 'exercises', 'summary')
            section_context: Context dictionary with relevant information
            difficulty_level: Difficulty level of content
            
        Returns:
            Markdown content for the section
        """
        section_prompts = {
            "introduction": f"""Write an engaging introduction for the lesson '{lesson_title}' as a distinguished professor.
Include: hook, context, overview, motivation, and roadmap. (400-600 words in markdown)""",
            
            "theory": f"""Explain the theoretical foundations for '{lesson_title}' with academic rigor.
Include: core concepts, fundamental principles, historical context, current state. (800-1200 words in markdown)""",
            
            "examples": f"""Provide detailed practical examples and applications for '{lesson_title}'.
Include: real-world use cases, worked examples, case studies, code examples. (800-1200 words in markdown)""",
            
            "exercises": f"""Create comprehensive exercises for '{lesson_title}' at {difficulty_level} level.
Include: concept checks, applied problems, critical thinking challenges, activities. (600-800 words in markdown)""",
            
            "summary": f"""Write a comprehensive summary and conclusion for '{lesson_title}'.
Include: lesson recap, key takeaways, reflection questions, additional resources. (500-700 words in markdown)"""
        }
        
        prompt = section_prompts.get(section_type, f"Generate {section_type} section for {lesson_title}")
        
        if section_context:
            prompt += f"\n\nContext: {json.dumps(section_context)}"
        
        result, _ = self._make_ai_request(prompt, temperature=0.7, max_tokens=3000)
        return result.strip() if result else f"## {section_type.capitalize()}\n\nContent to be generated..."
    
    def get_provider_stats(self) -> Dict[str, Any]:
        """
        Get statistics about AI provider usage and performance
        
        Returns:
            Dict with provider statistics including current provider, failure counts, request counts
        """
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
    
    def reset_provider_failures(self, provider: str = None):
        """
        Reset failure counts for a provider or all providers
        
        Args:
            provider: Specific provider to reset ('openrouter' or 'gemini'), or None for all
        """
        if provider:
            self.provider_failure_counts[provider] = 0
            logger.info(f"Reset failure count for {provider}")
        else:
            for p in self.provider_failure_counts:
                self.provider_failure_counts[p] = 0
            logger.info("Reset all provider failure counts")
    
    def clear_cache(self):
        """Clear the response cache"""
        self.response_cache.clear()
        logger.info("Response cache cleared")
    
    def force_provider(self, provider: str):
        """
        Force use of a specific provider
        
        Args:
            provider: 'openrouter' or 'gemini'
        """
        if provider in ['openrouter', 'gemini']:
            self.current_provider = provider
            self.reset_provider_failures()
            logger.info(f"Forced provider switch to {provider}")
        else:
            logger.error(f"Invalid provider: {provider}")
    
    def _validate_content_quality(self, content: str, content_type: str, min_length: int = 500) -> Dict[str, Any]:
        """
        Validate the quality and completeness of generated content
        
        Args:
            content: The generated content to validate
            content_type: Type of content ('introduction', 'theory', 'examples', etc.)
            min_length: Minimum expected length in characters
            
        Returns:
            Dict with validation results and quality metrics
        """
        validation_result = {
            "valid": True,
            "issues": [],
            "quality_score": 100,
            "metrics": {}
        }
        
        if not content or len(content.strip()) == 0:
            validation_result["valid"] = False
            validation_result["issues"].append("Content is empty")
            validation_result["quality_score"] = 0
            return validation_result
        
        content_length = len(content)
        validation_result["metrics"]["length"] = content_length
        
        # Check minimum length
        if content_length < min_length:
            validation_result["issues"].append(f"Content too short ({content_length} < {min_length} chars)")
            validation_result["quality_score"] -= 20
        
        # Check for markdown formatting
        has_headers = '#' in content
        has_bold = '**' in content
        has_lists = ('- ' in content or '1. ' in content or '* ' in content)
        
        validation_result["metrics"]["has_headers"] = has_headers
        validation_result["metrics"]["has_bold"] = has_bold
        validation_result["metrics"]["has_lists"] = has_lists
        
        if not has_headers:
            validation_result["issues"].append("Missing section headers")
            validation_result["quality_score"] -= 15
        
        if not (has_bold or has_lists):
            validation_result["issues"].append("Poor formatting (no emphasis or lists)")
            validation_result["quality_score"] -= 10
        
        # Content-type specific validation
        if content_type == 'theory':
            # Theory should have definitions, principles, explanations
            has_definition = any(word in content.lower() for word in ['definition', 'defined as', 'refers to', 'is a'])
            has_principle = any(word in content.lower() for word in ['principle', 'theorem', 'law', 'concept'])
            
            if not has_definition:
                validation_result["issues"].append("Theory section missing clear definitions")
                validation_result["quality_score"] -= 15
            
            if not has_principle:
                validation_result["issues"].append("Theory section missing core principles")
                validation_result["quality_score"] -= 10
        
        elif content_type == 'examples':
            # Examples should have code blocks or numbered steps
            has_code = '```' in content
            has_steps = any(f"{i}." in content for i in range(1, 6))
            
            validation_result["metrics"]["has_code"] = has_code
            validation_result["metrics"]["has_steps"] = has_steps
            
            if not (has_code or has_steps):
                validation_result["issues"].append("Examples section missing code or step-by-step demonstrations")
                validation_result["quality_score"] -= 20
        
        elif content_type == 'exercises':
            # Exercises should have questions or problems
            has_questions = '?' in content
            question_count = content.count('?')
            
            validation_result["metrics"]["question_count"] = question_count
            
            if question_count < 3:
                validation_result["issues"].append(f"Insufficient exercises (found {question_count}, expected 5+)")
                validation_result["quality_score"] -= 15
        
        # Check for common generation errors
        error_phrases = [
            "content to be generated",
            "[insert",
            "[add",
            "TODO",
            "placeholder",
            "coming soon"
        ]
        
        for phrase in error_phrases:
            if phrase.lower() in content.lower():
                validation_result["issues"].append(f"Content contains placeholder: '{phrase}'")
                validation_result["quality_score"] -= 25
                validation_result["valid"] = False
        
        # Determine overall validity
        if validation_result["quality_score"] < 60:
            validation_result["valid"] = False
        
        return validation_result
    
    def generate_comprehensive_lesson_with_validation(self, course_title: str, module_title: str,
                                                      module_description: str, module_objectives: str,
                                                      lesson_title: str, lesson_description: str = "",
                                                      difficulty_level: str = "intermediate",
                                                      existing_lessons: Optional[List[Dict[str, Any]]] = None,
                                                      progress_callback: Optional[callable] = None) -> Dict[str, Any]:
        """
        Generate a comprehensive, professor-level lesson with validation at each step
        
        This is an enhanced version that generates content step-by-step with quality validation,
        ensuring each section meets academic standards before proceeding.
        
        Args:
            course_title: Parent course title
            module_title: Parent module title
            module_description: Module description for context
            module_objectives: Module learning objectives
            lesson_title: Lesson title
            lesson_description: Brief lesson description
            difficulty_level: 'beginner', 'intermediate', or 'advanced'
            existing_lessons: List of existing lessons for context
            progress_callback: Optional callback function(step_num, total_steps, status, message)
            
        Returns:
            Dict with complete lesson content, validation results, and generation metadata
        """
        logger.info(f"Starting ENHANCED comprehensive lesson generation: {lesson_title}")
        
        total_steps = 7
        current_step = 0
        
        def update_progress(status: str, message: str):
            nonlocal current_step
            current_step += 1
            logger.info(f"Step {current_step}/{total_steps}: {message}")
            if progress_callback:
                progress_callback(current_step, total_steps, status, message)
        
        generation_report = {
            "steps_completed": [],
            "steps_failed": [],
            "validation_results": {},
            "total_generation_time": 0,
            "quality_scores": {}
        }
        
        start_time = time.time()
        
        # Build context from existing lessons
        existing_context = ""
        prerequisite_knowledge = []
        if existing_lessons and len(existing_lessons) > 0:
            existing_context = f"\n\nPREVIOUS LESSONS ({len(existing_lessons)}): Building upon previous knowledge\n"
            for idx, lesson in enumerate(existing_lessons, 1):
                existing_context += f"{idx}. {lesson['title']}\n"
                if lesson.get('description'):
                    existing_context += f"   Key focus: {lesson['description']}\n"
            existing_context += f"\n✓ This is Lesson {len(existing_lessons) + 1} - Build upon prior lessons, introduce NEW concepts, avoid repetition.\n"
            prerequisite_knowledge = [f"Completion of: {lesson['title']}" for lesson in existing_lessons[-3:]]  # Last 3 lessons
        
        generated_content = {
            "title": lesson_title,
            "description": lesson_description,
            "difficulty_level": difficulty_level,
            "sections": {},
            "metadata": {
                "estimated_duration_minutes": 0,
                "prerequisites": prerequisite_knowledge,
                "learning_outcomes": [],
                "key_concepts": [],
                "assessment_methods": []
            }
        }
        
        # ===== STEP 1: Generate Comprehensive Lesson Outline =====
        update_progress("running", "Designing lesson architecture and learning framework...")
        
        outline_prompt = f"""You are a DISTINGUISHED UNIVERSITY PROFESSOR with PhD-level expertise and 20+ years of teaching experience.
Your mission: Design a rigorous, academically excellent lesson that would be worthy of a top-tier university.

COURSE CONTEXT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Course: {course_title}
Module: {module_title}
Module Description: {module_description}
Module Learning Objectives: {module_objectives}{existing_context}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LESSON DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Title: {lesson_title}
Focus: {lesson_description or "To be determined based on module progression"}
Academic Level: {difficulty_level.capitalize()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

As an expert professor, create a DETAILED lesson blueprint following these academic standards:

1. **REFINED LESSON DESCRIPTION** (3-4 sentences)
   - Write in formal academic language
   - Clearly state what students will learn
   - Explain the significance and real-world relevance
   - Connect to broader field of study

2. **PREREQUISITES** (3-5 specific requirements)
   - Prior knowledge students MUST have
   - Concepts that should already be understood
   - Skills required before starting this lesson

3. **LEARNING OUTCOMES** (5-7 outcomes using Bloom's Taxonomy)
   - Use action verbs: Analyze, Evaluate, Create, Apply, Synthesize
   - Make outcomes specific, measurable, and rigorous
   - Progress from lower to higher-order thinking
   - Example: "Analyze complex algorithms to determine computational complexity"
   - Example: "Synthesize multiple design patterns to create robust software architectures"

4. **KEY CONCEPTS** (6-10 concepts)
   - Fundamental theoretical concepts
   - Technical terminology to be mastered
   - Important principles and frameworks
   - Each should be a single, clear concept

5. **DETAILED LESSON STRUCTURE** (8-10 sections with timing)
   Include these sections:
   - Introduction & Motivation (5-8 min): Hook, relevance, overview
   - Theoretical Foundations (15-20 min): Core concepts, principles, definitions
   - Deep Dive & Analysis (15-25 min): Detailed exploration, proofs, derivations
   - Practical Applications (15-20 min): Real-world use cases, industry applications
   - Worked Examples (15-20 min): Step-by-step demonstrations, code examples
   - Hands-On Practice (10-15 min): Guided exercises, problem-solving
   - Critical Thinking & Discussion (10-15 min): Advanced problems, debates, analysis
   - Summary & Integration (5-10 min): Key takeaways, connections, next steps
   - Assessment Activities (10-15 min): Questions, problems, projects
   - Additional Resources (5 min): Further reading, tools, references

6. **TOTAL DURATION** (sum all sections, typically 60-90 minutes for comprehensive lesson)

7. **ASSESSMENT METHODS** (4-6 methods)
   - Formative assessments during lesson
   - Summative assessments after lesson
   - Self-assessment opportunities
   - Practical demonstrations

IMPORTANT: Return ONLY valid JSON. No extra text before or after.

Format as JSON:
{{
  "description": "Comprehensive academic description of the lesson",
  "prerequisites": ["Prerequisite 1", "Prerequisite 2", "Prerequisite 3"],
  "learning_outcomes": [
    "Analyze [concept] to determine [specific outcome]",
    "Evaluate [approach] using [criteria]",
    "Create [solution] that demonstrates [skill]",
    "Apply [principle] to solve [problem type]",
    "Synthesize [elements] to develop [product]"
  ],
  "key_concepts": ["Concept 1", "Concept 2", "Concept 3", "Concept 4", "Concept 5"],
  "structure": [
    {{"section": "Introduction & Motivation", "duration_minutes": 7, "topics": ["Hook question", "Real-world relevance", "Lesson overview"]}},
    {{"section": "Theoretical Foundations", "duration_minutes": 18, "topics": ["Core definitions", "Fundamental principles", "Theoretical framework"]}},
    {{"section": "Deep Dive & Analysis", "duration_minutes": 20, "topics": ["Detailed exploration", "Mathematical proofs", "Conceptual analysis"]}},
    {{"section": "Practical Applications", "duration_minutes": 18, "topics": ["Industry use cases", "Real-world implementations", "Case studies"]}},
    {{"section": "Worked Examples", "duration_minutes": 18, "topics": ["Example 1 walkthrough", "Example 2 demonstration", "Code implementation"]}},
    {{"section": "Hands-On Practice", "duration_minutes": 12, "topics": ["Guided exercise", "Problem-solving activity"]}},
    {{"section": "Critical Thinking", "duration_minutes": 12, "topics": ["Advanced problem", "Discussion question", "Analysis challenge"]}},
    {{"section": "Summary & Integration", "duration_minutes": 8, "topics": ["Key takeaways", "Concept connections", "Preview next lesson"]}},
    {{"section": "Assessment", "duration_minutes": 12, "topics": ["Quiz questions", "Practical problem", "Self-evaluation"]}},
    {{"section": "Additional Resources", "duration_minutes": 5, "topics": ["Recommended reading", "Online tools", "Practice platforms"]}}
  ],
  "total_duration_minutes": 130,
  "assessment_methods": ["Concept check questions", "Practical coding exercises", "Quiz", "Project assignment", "Peer review", "Self-assessment checklist"]
}}"""
        
        outline_result, _ = self._make_ai_request(outline_prompt, temperature=0.7, max_tokens=3000)
        outline_data = self._parse_json_response(outline_result, "lesson outline") if outline_result else None
        
        if not outline_data:
            generation_report["steps_failed"].append("Lesson outline generation failed")
            update_progress("error", "Failed to generate lesson outline")
            # Return fallback structure
            return self._generate_fallback_lesson(lesson_title, lesson_description, difficulty_level, generation_report)
        
        # Populate metadata from outline
        generated_content["description"] = outline_data.get("description", lesson_description)
        generated_content["metadata"]["prerequisites"].extend(outline_data.get("prerequisites", []))
        generated_content["metadata"]["learning_outcomes"] = outline_data.get("learning_outcomes", [])
        generated_content["metadata"]["key_concepts"] = outline_data.get("key_concepts", [])
        generated_content["metadata"]["estimated_duration_minutes"] = outline_data.get("total_duration_minutes", 90)
        generated_content["metadata"]["assessment_methods"] = outline_data.get("assessment_methods", [])
        lesson_structure = outline_data.get("structure", [])
        
        generation_report["steps_completed"].append("Lesson outline")
        generation_report["quality_scores"]["outline"] = 100
        
        # Build learning outcomes string for context
        learning_outcomes_str = "\n".join(f"{i}. {outcome}" for i, outcome in enumerate(generated_content['metadata']['learning_outcomes'], 1))
        key_concepts_str = ", ".join(generated_content['metadata']['key_concepts'])
        
        # ===== STEP 2: Generate Introduction =====
        update_progress("running", "Crafting engaging introduction with academic rigor...")
        
        intro_prompt = f"""You are a DISTINGUISHED PROFESSOR beginning an important lesson. 
Write an introduction that captures attention while maintaining academic excellence.

LESSON: {lesson_title}
LEVEL: {difficulty_level.capitalize()}
DESCRIPTION: {generated_content['description']}

LEARNING OUTCOMES:
{learning_outcomes_str}

KEY CONCEPTS: {key_concepts_str}

{existing_context}

Write a COMPREHENSIVE INTRODUCTION (600-900 words) in Markdown format following this structure:

## Introduction

### Opening Hook (1-2 paragraphs)
Start with ONE of these approaches:
- A thought-provoking question that challenges assumptions
- A compelling real-world scenario or recent event
- A surprising statistic or research finding
- A historical anecdote that illustrates the concept's importance
- A common misconception to debunk

Make it engaging and relevant to students' lives or careers.

### Why This Matters (2-3 paragraphs)
Explain the significance:
- **Academic Importance**: Why this is fundamental to the field
- **Professional Relevance**: How experts use this in their work
- **Real-World Impact**: Practical applications and consequences
- **Career Value**: How mastering this helps students' careers
{"- **Building on Previous Knowledge**: Connect to prior lessons explicitly" if existing_lessons else ""}

### What You'll Learn (1-2 paragraphs)
Preview the lesson journey:
- Brief overview of main topics
- How concepts build upon each other
- What students will be able to DO after completing this lesson
- Expected challenges and how we'll overcome them

### Roadmap (1 paragraph or bullet list)
Clear structure of what's ahead:
- Section 1: [Brief description]
- Section 2: [Brief description]
- Section 3: [Brief description]
[etc.]

END with a motivational statement that energizes students for the learning ahead.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATTING REQUIREMENTS:
- Use markdown headers (##, ###)
- **Bold** for key terms and emphasis
- *Italics* for important concepts
- > Blockquotes for powerful insights or quotes
- Proper paragraphs with logical flow
- Academic yet accessible language

Return ONLY the markdown content (no JSON, no code fences)."""
        
        intro_result, _ = self._make_ai_request(intro_prompt, temperature=0.8, max_tokens=2000)
        
        if intro_result:
            # Validate introduction
            validation = self._validate_content_quality(intro_result, "introduction", min_length=600)
            generation_report["validation_results"]["introduction"] = validation
            generation_report["quality_scores"]["introduction"] = validation["quality_score"]
            
            if validation["valid"]:
                generated_content["sections"]["introduction"] = intro_result.strip()
                generation_report["steps_completed"].append("Introduction")
                logger.info(f"Introduction validated successfully (score: {validation['quality_score']})")
            else:
                logger.warning(f"Introduction validation failed: {validation['issues']}")
                # Retry once with more explicit instructions
                intro_result, _ = self._make_ai_request(
                    intro_prompt + "\n\nIMPORTANT: Previous attempt was too short or poorly formatted. Generate AT LEAST 600 words with proper markdown formatting.",
                    temperature=0.8, max_tokens=2000
                )
                if intro_result:
                    generated_content["sections"]["introduction"] = intro_result.strip()
                    generation_report["steps_completed"].append("Introduction (retry)")
                else:
                    generated_content["sections"]["introduction"] = self._generate_fallback_introduction(lesson_title)
                    generation_report["steps_failed"].append("Introduction")
        else:
            generated_content["sections"]["introduction"] = self._generate_fallback_introduction(lesson_title)
            generation_report["steps_failed"].append("Introduction")
        
        # ===== STEP 3: Generate Theoretical Foundation =====
        update_progress("running", "Developing comprehensive theoretical foundation...")
        
        theory_prompt = f"""You are a RENOWNED PROFESSOR teaching theoretical foundations with exceptional clarity and depth.

LESSON: {lesson_title}
DIFFICULTY: {difficulty_level.capitalize()}
KEY CONCEPTS TO COVER: {key_concepts_str}

LEARNING OUTCOMES TO ADDRESS:
{learning_outcomes_str}

Write COMPREHENSIVE THEORETICAL CONTENT (1200-1800 words) that would be appropriate for a {difficulty_level}-level university course.

## Theoretical Foundation

### Foundational Concepts
For EACH key concept, provide:

#### [Concept Name]
- **Academic Definition**: Precise, formal definition (as would appear in a textbook)
- **Detailed Explanation**: 2-3 paragraphs explaining:
  * What it is and why it matters
  * How it works or functions
  * Its role in the broader field
  * Common misconceptions to avoid
- **Mathematical/Formal Representation** (if applicable):
  * Formulas, notation, or formal expressions
  * Variable explanations
  * Constraints or assumptions
- **Relationships**: How it connects to other concepts

### Core Principles & Theories
Present the fundamental principles systematically:

1. **[Principle/Theory Name]**
   - **Statement**: Clear articulation of the principle
   - **Explanation**: Why this principle holds true
   - **Derivation/Proof** (if applicable): Logical reasoning or mathematical proof
   - **Scope & Limitations**: When it applies and when it doesn't
   - **Significance**: Why experts consider this important

### Theoretical Framework
Explain the overarching theoretical framework:
- How concepts fit together into a cohesive system
- The logical progression from basics to advanced ideas
- Different perspectives or schools of thought (if applicable)
- Current debates or unresolved questions in the field

### Historical Context & Evolution
Brief but informative history:
- **Origins**: Who developed these ideas and when
- **Key Milestones**: Major breakthroughs and discoveries
- **Paradigm Shifts**: How understanding has evolved
- **Current State**: Where the field stands today

### Advanced Considerations
For {difficulty_level} level:
- Edge cases and special scenarios
- Advanced variations or extensions
- Research frontiers and open questions
- Connections to other fields or disciplines

═══════════════════════════════════════════════════════════════
FORMATTING REQUIREMENTS:
- Use proper markdown headers (##, ###, ####)
- **Bold** for all definitions, principle names, and key terms
- *Italics* for emphasis and technical terms
- `Inline code` for variables, formulas, or technical notation
- ```math blocks for complex equations
- > Blockquotes for important theorems, principles, or notable insights
- Tables for comparisons or categorizations
- Bullet points for lists
- Numbered lists for sequential concepts

ACADEMIC RIGOR:
- Use precise, formal language
- Define all terms before using them
- Provide citations style references (Author, Year) where appropriate
- Include multiple perspectives when relevant
- Acknowledge limitations and assumptions

Return ONLY the markdown content (no JSON, no code fences)."""
        
        theory_result, _ = self._make_ai_request(theory_prompt, temperature=0.7, max_tokens=4000)
        
        if theory_result:
            validation = self._validate_content_quality(theory_result, "theory", min_length=1200)
            generation_report["validation_results"]["theory"] = validation
            generation_report["quality_scores"]["theory"] = validation["quality_score"]
            
            if validation["valid"]:
                generated_content["sections"]["theoretical_foundation"] = theory_result.strip()
                generation_report["steps_completed"].append("Theoretical Foundation")
            else:
                # Retry with emphasis
                logger.warning(f"Theory validation failed, retrying: {validation['issues']}")
                theory_result, _ = self._make_ai_request(
                    theory_prompt + "\\n\\nCRITICAL: Generate AT LEAST 1200 words. Include clear definitions, principles, and explanations for ALL key concepts.",
                    temperature=0.7, max_tokens=4000
                )
                if theory_result:
                    generated_content["sections"]["theoretical_foundation"] = theory_result.strip()
                    generation_report["steps_completed"].append("Theoretical Foundation (retry)")
                else:
                    generated_content["sections"]["theoretical_foundation"] = self._generate_fallback_theory(key_concepts_str)
                    generation_report["steps_failed"].append("Theoretical Foundation")
        else:
            generated_content["sections"]["theoretical_foundation"] = self._generate_fallback_theory(key_concepts_str)
            generation_report["steps_failed"].append("Theoretical Foundation")
        
        # ===== STEP 4: Generate Practical Applications & Examples =====
        update_progress("running", "Creating detailed practical applications and examples...")
        
        practical_prompt = f"""You are an EXPERT PRACTITIONER and professor demonstrating how theory translates into practice.

LESSON: {lesson_title}
CONCEPTS: {key_concepts_str}
DIFFICULTY: {difficulty_level.capitalize()}

Write COMPREHENSIVE PRACTICAL CONTENT (1200-1800 words) with concrete, detailed examples.

## Practical Applications & Examples

### Industry Applications
Present 3-4 real-world scenarios:

#### Application 1: [Real-World Context]
- **Industry/Domain**: Where this is used
- **Problem Being Solved**: What need this addresses
- **How Concepts Apply**: Specific application of theoretical concepts
- **Implementation Details**: Technical specifics
- **Results & Benefits**: What this achieves
- **Challenges & Considerations**: Practical limitations

[Repeat for Applications 2, 3, 4]

### Comprehensive Worked Examples

#### Example 1: [Detailed Problem]
**Problem Statement**: Clear, realistic problem scenario

**Given Information**:
- Parameter 1: [value/description]
- Parameter 2: [value/description]
- Constraints: [any limitations]

**Solution Approach**:
1. **Analysis**: Break down the problem
2. **Strategy**: Explain the approach and why
3. **Step-by-Step Solution**:
   
   Step 1: [Detailed action with explanation]
   ```
   [Code, formula, or technical implementation]
   ```
   *Explanation*: Why this step is necessary
   
   Step 2: [Next action with explanation]
   ```
   [Implementation]
   ```
   *Explanation*: What this accomplishes
   
   [Continue for all steps...]

4. **Result Analysis**: Interpret the outcome
5. **Verification**: How to check if solution is correct
6. **Alternative Approaches**: Other ways to solve this

#### Example 2: [Different Scenario]
[Follow same structure as Example 1]

#### Example 3: [Advanced/Complex Example]
[Follow same structure with higher complexity]

### Code Demonstrations (if applicable)
```python
# EXAMPLE: [Brief description]
# 
# Purpose: [What this code demonstrates]
# Complexity: [Time/Space complexity if applicable]

def example_function(parameters):
    \"\"\"
    Detailed docstring explaining:
    - What this function does
    - Parameters and their types
    - Return value
    - Example usage
    \"\"\"
    # Step 1: [Explanation]
    step1_result = operation1(parameters)
    
    # Step 2: [Explanation]
    step2_result = operation2(step1_result)
    
    # Continue with detailed comments
    return final_result

# Usage Example:
input_data = [example_data]
output = example_function(input_data)
print(f\"Result: {output}\")  # Expected output: [explanation]

# Edge Cases:
# Case 1: [Description and handling]
# Case 2: [Description and handling]
```

### Case Study: [Real-World Success Story]
**Background**: Company/Organization and their challenge

**The Challenge**: Detailed problem description

**Solution Implementation**:
- Technologies/Approaches used
- How theoretical concepts were applied
- Implementation timeline and process
- Team structure and roles

**Results**:
- Quantifiable outcomes (metrics, percentages, etc.)
- Qualitative improvements
- Lessons learned

**Key Takeaways**: What we can learn from this case

### Common Pitfalls & Best Practices

#### Common Mistakes to Avoid
1. **Mistake**: [Description]
   - *Why it's wrong*: [Explanation]
   - *Correct approach*: [Solution]
   - *Example*: [Illustration]

[List 5-7 common mistakes]

#### Professional Best Practices
1. **Best Practice**: [Description]
   - *Rationale*: Why this is important
   - *Implementation*: How to apply it
   - *Example*: Real-world illustration

[List 5-7 best practices]

### Practical Tips & Expert Insights
- **Tip**: [Actionable advice from experience]
- **Insight**: [Deep understanding gained through practice]
- **Optimization**: [How to improve efficiency/effectiveness]

═══════════════════════════════════════════════════════════════
FORMATTING:
- Clear section headers
- Code blocks with language specification and comments
- Tables for comparisons (e.g., approaches, pros/cons)
- Numbered steps for processes
- Diagrams described in markdown
- Callout boxes using blockquotes for warnings/tips

> **⚠️ Warning**: Critical considerations
> **💡 Tip**: Helpful advice
> **🎯 Best Practice**: Recommended approach

Return ONLY the markdown content."""
        
        practical_result, _ = self._make_ai_request(practical_prompt, temperature=0.7, max_tokens=4000)
        
        if practical_result:
            validation = self._validate_content_quality(practical_result, "examples", min_length=1200)
            generation_report["validation_results"]["practical"] = validation
            generation_report["quality_scores"]["practical"] = validation["quality_score"]
            
            if validation["valid"]:
                generated_content["sections"]["practical_applications"] = practical_result.strip()
                generation_report["steps_completed"].append("Practical Applications")
            else:
                logger.warning(f"Practical content validation failed, retrying: {validation['issues']}")
                practical_result, _ = self._make_ai_request(
                    practical_prompt + "\\n\\nCRITICAL: Include code examples, step-by-step solutions, and AT LEAST 1200 words of content.",
                    temperature=0.7, max_tokens=4000
                )
                if practical_result:
                    generated_content["sections"]["practical_applications"] = practical_result.strip()
                    generation_report["steps_completed"].append("Practical Applications (retry)")
                else:
                    generated_content["sections"]["practical_applications"] = self._generate_fallback_practical(lesson_title)
                    generation_report["steps_failed"].append("Practical Applications")
        else:
            generated_content["sections"]["practical_applications"] = self._generate_fallback_practical(lesson_title)
            generation_report["steps_failed"].append("Practical Applications")
        
        # ===== STEP 5: Generate Practice Exercises & Assessment =====
        update_progress("running", "Designing comprehensive practice exercises and assessments...")
        
        exercises_prompt = f"""You are an EXPERT ASSESSMENT DESIGNER creating challenging, thought-provoking exercises.

LESSON: {lesson_title}
DIFFICULTY: {difficulty_level.capitalize()}

LEARNING OUTCOMES TO ASSESS:
{learning_outcomes_str}

Create COMPREHENSIVE ASSESSMENT CONTENT (1000-1500 words) that thoroughly tests understanding.

## Practice Exercises & Assessment

### Quick Concept Checks (Formative Assessment)
Test immediate understanding with 7-10 questions:

**Question 1**: [Thoughtful question testing conceptual understanding]
- *Difficulty*: Easy
- *Concept Tested*: [Which concept]
- *Hint*: [Guiding hint without giving away answer]
- *What a good answer includes*: [Key points expected]

**Question 2**: [More challenging conceptual question]
- *Difficulty*: Medium
- *Concept Tested*: [Which concept]
- *Hint*: [Guiding hint]
- *What a good answer includes*: [Key points expected]

[Continue through Question 7-10, increasing difficulty]

### Applied Problems
4-5 practical problems requiring application of concepts:

#### Problem 1: [Realistic Scenario]
**Context**: [Real-world or realistic setup]

**Problem Statement**: [Clear description of what needs to be solved]

**Requirements**:
- Must demonstrate: [Specific skills/knowledge]
- Must include: [Required elements]
- Constraints: [Any limitations]

**Suggested Approach**:
1. [Strategic hint for step 1]
2. [Strategic hint for step 2]
3. [Strategic hint for step 3]

**Expected Outcome**: [What the solution should achieve]

**Evaluation Criteria**:
- Correctness: [How to judge if correct]
- Completeness: [What must be included]
- Quality: [Additional quality factors]

[Continue for Problems 2-5, increasing complexity]

### Critical Thinking Challenges
2-3 advanced, open-ended problems:

#### Challenge 1: [Complex Problem]
**Scenario**: [Detailed, realistic context requiring deep thinking]

**Your Task**: [Multi-part challenge that requires:
- Analysis of the situation
- Evaluation of different approaches
- Creation of a solution
- Justification of choices]

**Guidelines**:
- Consider multiple perspectives
- Address potential objections
- Justify your reasoning
- Propose alternatives

**Discussion Points**:
- What are the tradeoffs?
- How would you handle edge cases?
- What assumptions are you making?
- How could this be extended or improved?

[Continue for Challenges 2-3]

### Hands-On Activity
Practical activity students can complete:

#### Activity: [Engaging Title]
**Objective**: [What students will build/create/explore]

**Materials/Tools Needed**:
- [Tool/resource 1]
- [Tool/resource 2]
- [Tool/resource 3]

**Instructions**:
1. **Setup**: [Preparation steps]
2. **Implementation**: [Step-by-step guide]
   - Step 1: [Detailed instruction]
   - Step 2: [Detailed instruction]
   - Step 3: [Detailed instruction]
   [Continue...]
3. **Testing/Verification**: [How to check your work]
4. **Extension**: [Optional advanced features]

**Learning Goals**: What this activity develops

**Time Required**: [Estimated duration]

**Submission/Demonstration**: [What to submit or demonstrate]

### Self-Assessment Checklist
Students evaluate their own mastery:

**Core Understanding**:
- [ ] I can clearly explain [concept 1] in my own words
- [ ] I understand the relationship between [concept A] and [concept B]
- [ ] I can identify when to use [principle/method]

**Application Skills**:
- [ ] I can apply [concept] to solve [problem type]
- [ ] I can implement [technique] in [context]
- [ ] I can analyze [scenario] using [framework]

**Higher-Order Thinking**:
- [ ] I can evaluate different [approaches] and justify the best choice
- [ ] I can create [solution] that demonstrates [advanced skill]
- [ ] I can synthesize [multiple concepts] to solve complex problems

**Practical Competence**:
- [ ] I can complete [task] independently
- [ ] I can troubleshoot [common issues]
- [ ] I can explain my reasoning to others

### Reflection Prompts
Deep thinking questions:

1. **Connection to Prior Knowledge**: 
   \"How does this lesson relate to or build upon what you already knew? What surprised you?\"

2. **Real-World Application**: 
   \"Where do you see potential to apply these concepts in your own projects or career?\"

3. **Challenges & Growth**: 
   \"What was most challenging in this lesson? How did working through difficulties enhance your understanding?\"

4. **Gaps & Questions**: 
   \"What aspects would you like to explore more deeply? What questions do you still have?\"

### Recommended Practice Problems
Additional resources for extra practice:
- [Resource 1]: [Description and why it's valuable]
- [Resource 2]: [Description and what skill it develops]
- [Resource 3]: [Description and difficulty level]

═══════════════════════════════════════════════════════════════
FORMATTING:
- Clear, numbered problems and questions
- Difficulty indicators
- Proper markdown formatting
- Code templates where applicable
- Checkboxes for self-assessment

Return ONLY the markdown content."""
        
        exercises_result, _ = self._make_ai_request(exercises_prompt, temperature=0.7, max_tokens=3500)
        
        if exercises_result:
            validation = self._validate_content_quality(exercises_result, "exercises", min_length=1000)
            generation_report["validation_results"]["exercises"] = validation
            generation_report["quality_scores"]["exercises"] = validation["quality_score"]
            
            if validation["valid"]:
                generated_content["sections"]["exercises"] = exercises_result.strip()
                generation_report["steps_completed"].append("Practice Exercises")
            else:
                logger.warning(f"Exercises validation failed, retrying: {validation['issues']}")
                exercises_result, _ = self._make_ai_request(
                    exercises_prompt + "\\n\\nCRITICAL: Include AT LEAST 7 concept check questions, 4 applied problems, and self-assessment checklist.",
                    temperature=0.7, max_tokens=3500
                )
                if exercises_result:
                    generated_content["sections"]["exercises"] = exercises_result.strip()
                    generation_report["steps_completed"].append("Practice Exercises (retry)")
                else:
                    generated_content["sections"]["exercises"] = self._generate_fallback_exercises(lesson_title)
                    generation_report["steps_failed"].append("Practice Exercises")
        else:
            generated_content["sections"]["exercises"] = self._generate_fallback_exercises(lesson_title)
            generation_report["steps_failed"].append("Practice Exercises")
        
        # ===== STEP 6: Generate Summary & Resources =====
        update_progress("running", "Compiling summary, key takeaways, and resources...")
        
        summary_prompt = f"""You are a DISTINGUISHED PROFESSOR concluding an important lesson and guiding students forward.

LESSON: {lesson_title}
KEY CONCEPTS: {key_concepts_str}

LEARNING OUTCOMES ACHIEVED:
{learning_outcomes_str}

Write COMPREHENSIVE CONCLUSION (800-1200 words) that reinforces learning and inspires continued study.

## Summary & Synthesis

### Lesson Recap
Concise but thorough summary (200-300 words):
- **What We Covered**: Brief overview of each major section
  * Introduction: [Key points]
  * Theoretical Foundation: [Core concepts]
  * Applications: [Main examples]
  * Practice: [What we worked on]
  
- **Key Connections**: How concepts relate and build on each other

- **From Theory to Practice**: How we moved from abstract ideas to concrete applications

### Essential Takeaways
7-10 critical points students MUST remember:

1. **[Takeaway 1]**: [Concise statement]
   - *Why it matters*: [Significance]
   - *How to apply*: [Practical tip]

2. **[Takeaway 2]**: [Concise statement]
   - *Why it matters*: [Significance]
   - *How to apply*: [Practical tip]

[Continue through all takeaways]

### Concept Map / Knowledge Integration
Show how concepts fit together:

```
[Main Topic]
├── [Core Concept 1]
│   ├── Sub-concept A
│   └── Sub-concept B
├── [Core Concept 2]
│   ├── Sub-concept C
│   └── Sub-concept D
└── [Core Concept 3]
    ├── Applications
    └── Advanced Topics
```

*How these connect*: [Explanation of relationships]

### Looking Ahead
**Prerequisites Met**: Skills/knowledge gained for future lessons
- ✓ [Skill 1]: [How it will be used next]
- ✓ [Skill 2]: [How it will be used next]

**What's Next**: Preview of upcoming content
- *Next Lesson*: [Topic and how it builds on this]
- *Future Applications*: [Where these concepts lead]
- *Advanced Topics*: [Optional deeper exploration]

### Deep Reflection Questions
4-5 thought-provoking questions:

1. **Connecting to Experience**: 
   \"Think about a project or problem you've worked on. How could you have applied these concepts to improve your approach or solution?\"

2. **Critical Analysis**: 
   \"What are the strengths and limitations of [key approach/method]? In what scenarios would you choose alternative approaches?\"

3. **Creative Application**: 
   \"How might you combine these concepts with knowledge from other domains to create something innovative?\"

4. **Meta-Learning**: 
   \"What was your learning process like? What strategies helped you understand difficult concepts? How can you apply these learning strategies to future topics?\"

5. **Future Vision**: 
   \"Where do you see this field headed in the next 5-10 years? How might emerging trends impact these concepts?\"

## Additional Resources & Further Study

### Essential Reading
**Core Resources** (Must-read for solid understanding):
- 📚 **[Resource Title]** by [Author]
  - *What it covers*: [Description]
  - *Why it's valuable*: [Benefits]
  - *Best for*: [Target audience]
  - *Time investment*: [How long to read/complete]

[List 3-4 core resources]

**Deep Dives** (For advanced understanding):
- 📖 **[Advanced Resource]**
  - *Focus*: [Specific topics]
  - *Difficulty*: Advanced
  - *Value*: [What you'll gain]

[List 2-3 advanced resources]

### Online Resources & Tools
**Interactive Learning**:
- 🔧 **[Tool/Platform Name]**: [URL description]
  - *Use for*: [Purpose]
  - *Highlights*: [Key features]

**Video Content**:
- 🎥 **[Video Series/Channel]**: [Description]
  - *Best videos*: [Specific recommendations]
  - *Complement to*: [Which lesson sections]

**Practice Platforms**:
- 💻 **[Platform Name]**: [Description]
  - *Practice problems*: [What's available]
  - *Skill level*: [Beginner/Intermediate/Advanced]

### Academic References
Key papers and publications (in academic format):

**Foundational Papers**:
- Author1, A. & Author2, B. (Year). \"Title of Paper.\" *Journal Name*, Volume(Issue), pages. [Brief description of contribution]

**Recent Research**:
- Author, A. (Year). \"Title.\" *Conference/Journal*. [What's new/important]

**Survey/Review Articles**:
- Author, A. et al. (Year). \"Survey of [Topic].\" *Journal*. [Comprehensive overview value]

### Community & Discussion
- **Forums**: [Where to ask questions]
- **Study Groups**: [How to find peers]
- **Office Hours**: [When/how to get help]
- **Discussion Topics**: Suggested topics for peer discussion

### Projects & Challenges
Suggested projects to cement your understanding:
1. **Beginner Project**: [Description and goals]
2. **Intermediate Project**: [Description and goals]
3. **Advanced Challenge**: [Description and goals]

### Career Pathways
How this knowledge applies professionally:
- **Roles that use these skills**: [Job titles]
- **Industries**: [Relevant sectors]
- **Next steps for career development**: [Recommendations]

═══════════════════════════════════════════════════════════════
INSPIRATIONAL CLOSING:
End with a motivating paragraph that:
- Celebrates what students have accomplished
- Encourages continued learning
- Reinforces the value and impact of mastering this material
- Invites students to the next stage of their journey

Return ONLY the markdown content."""
        
        summary_result, _ = self._make_ai_request(summary_prompt, temperature=0.7, max_tokens=3000)
        
        if summary_result:
            validation = self._validate_content_quality(summary_result, "summary", min_length=800)
            generation_report["validation_results"]["summary"] = validation
            generation_report["quality_scores"]["summary"] = validation["quality_score"]
            
            if validation["valid"]:
                generated_content["sections"]["summary"] = summary_result.strip()
                generation_report["steps_completed"].append("Summary & Resources")
            else:
                logger.warning(f"Summary validation failed, retrying: {validation['issues']}")
                summary_result, _ = self._make_ai_request(
                    summary_prompt + "\\n\\nCRITICAL: Generate AT LEAST 800 words including takeaways, resources, and reflection questions.",
                    temperature=0.7, max_tokens=3000
                )
                if summary_result:
                    generated_content["sections"]["summary"] = summary_result.strip()
                    generation_report["steps_completed"].append("Summary & Resources (retry)")
                else:
                    generated_content["sections"]["summary"] = self._generate_fallback_summary(lesson_title, key_concepts_str)
                    generation_report["steps_failed"].append("Summary & Resources")
        else:
            generated_content["sections"]["summary"] = self._generate_fallback_summary(lesson_title, key_concepts_str)
            generation_report["steps_failed"].append("Summary & Resources")
        
        # ===== STEP 7: Compile Complete Lesson =====
        update_progress("running", "Compiling complete lesson document...")
        
        # Calculate average quality score
        quality_scores = list(generation_report["quality_scores"].values())
        avg_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0
        
        # Assemble complete lesson content
        complete_content = self._assemble_complete_lesson(lesson_title, generated_content, difficulty_level)
        
        # Final statistics
        generation_report["total_generation_time"] = time.time() - start_time
        generation_report["average_quality_score"] = avg_quality
        generation_report["sections_generated"] = len(generated_content["sections"])
        generation_report["total_word_count"] = len(complete_content.split())
        
        logger.info(f"Lesson generation complete: {lesson_title} - Time: {generation_report['total_generation_time']:.1f}s, Quality: {avg_quality:.1f}/100")
        
        update_progress("completed", f"Lesson generated successfully! Quality score: {avg_quality:.1f}/100")
        
        return {
            "title": lesson_title,
            "description": generated_content['description'],
            "learning_objectives": "\n".join(f"• {outcome}" for outcome in generated_content['metadata']['learning_outcomes']),
            "duration_minutes": generated_content['metadata']['estimated_duration_minutes'],
            "difficulty_level": difficulty_level,
            "prerequisites": generated_content['metadata']['prerequisites'],
            "key_concepts": generated_content['metadata']['key_concepts'],
            "assessment_methods": generated_content['metadata']['assessment_methods'],
            "content_type": "text",
            "content_data": complete_content,
            "sections": generated_content['sections'],
            "generation_report": generation_report,
            "metadata": generated_content['metadata'],
            "quality_metrics": {
                "average_score": avg_quality,
                "individual_scores": generation_report["quality_scores"],
                "validation_passed": avg_quality >= 70
            }
        }
    
    def _assemble_complete_lesson(self, lesson_title: str, content: Dict[str, Any], difficulty: str) -> str:
        """Assemble all sections into a complete, polished lesson document"""
        
        duration = content['metadata']['estimated_duration_minutes']
        outcomes = content['metadata']['learning_outcomes']
        prerequisites = content['metadata']['prerequisites']
        key_concepts = content['metadata']['key_concepts']
        
        # Build lesson header
        lesson_doc = f"""# {lesson_title}

{content['description']}

---

## 📋 Lesson Overview

**Duration**: {duration} minutes ({duration // 60}h {duration % 60}min)  
**Difficulty Level**: {difficulty.capitalize()}  
**Last Updated**: {datetime.now().strftime('%B %d, %Y')}

### Prerequisites
Before starting this lesson, you should have:
{chr(10).join(f"- {prereq}" for prereq in prerequisites)}

### Learning Outcomes
By the end of this lesson, you will be able to:
{chr(10).join(f"{i}. {outcome}" for i, outcome in enumerate(outcomes, 1))}

### Key Concepts Covered
{', '.join(f"**{concept}**" for concept in key_concepts)}

---

"""
        
        # Add all sections
        sections = content['sections']
        
        if 'introduction' in sections:
            lesson_doc += sections['introduction'] + "\n\n---\n\n"
        
        if 'theoretical_foundation' in sections:
            lesson_doc += sections['theoretical_foundation'] + "\n\n---\n\n"
        
        if 'practical_applications' in sections:
            lesson_doc += sections['practical_applications'] + "\n\n---\n\n"
        
        if 'exercises' in sections:
            lesson_doc += sections['exercises'] + "\n\n---\n\n"
        
        if 'summary' in sections:
            lesson_doc += sections['summary'] + "\n\n---\n\n"
        
        # Add completion footer
        lesson_doc += """
## 🎓 Lesson Complete!

Congratulations on completing this comprehensive lesson! You've covered significant ground and developed important skills.

### Next Steps
1. ✅ Review the key takeaways above
2. 📝 Complete all practice exercises
3. 🔍 Explore the additional resources
4. 💬 Participate in discussions with peers
5. 🚀 Apply these concepts in your own projects

### Need Help?
- Review sections you found challenging
- Attempt practice problems with hints
- Consult additional resources
- Ask questions in the discussion forum
- Attend office hours or study groups

### Keep Learning!
This lesson is part of your larger learning journey. Stay curious, practice regularly, and don't hesitate to dig deeper into topics that interest you.

---

*Remember: Mastery comes through practice and application. Keep pushing forward!* 🌟
"""
        
        return lesson_doc
    
    def _generate_fallback_lesson(self, title: str, description: str, difficulty: str, report: Dict) -> Dict:
        """Generate a basic fallback lesson when AI generation fails"""
        logger.error("Generating fallback lesson due to generation failures")
        report["steps_failed"].append("Full generation failed - using fallback")
        
        return {
            "title": title,
            "description": description or f"An introduction to {title}",
            "learning_objectives": "• Understand core concepts\n• Apply basic principles\n• Practice fundamental skills",
            "duration_minutes": 60,
            "difficulty_level": difficulty,
            "content_type": "text",
            "content_data": f"# {title}\n\nThis lesson is under development. Please check back soon for complete content.",
            "generation_report": report,
            "metadata": {
                "error": "Generation failed",
                "fallback_used": True
            }
        }
    
    def _generate_fallback_introduction(self, title: str) -> str:
        """Generate basic introduction when AI fails"""
        return f"""## Introduction

Welcome to this lesson on {title}. In this comprehensive lesson, we will explore the fundamental concepts, practical applications, and hands-on exercises to build your understanding and skills.

### What You'll Learn

This lesson covers the essential knowledge and practical skills needed to master {title}. We'll progress from foundational concepts to advanced applications, ensuring you gain both theoretical understanding and practical competence.

### Why This Matters

Understanding {title} is crucial for your development in this field. These concepts form the foundation for more advanced topics and have wide-ranging applications in real-world scenarios.

Let's begin our learning journey!"""
    
    def _generate_fallback_theory(self, concepts: str) -> str:
        """Generate basic theory section when AI fails"""
        return f"""## Theoretical Foundation

### Core Concepts

This section covers the fundamental theoretical concepts: {concepts}.

Each concept builds upon previous knowledge and contributes to your overall understanding of the subject matter.

### Key Principles

The core principles governing these concepts include:
- Fundamental definitions and terminology
- Relationships between concepts
- Theoretical frameworks and models
- Mathematical or logical foundations

### Further Study

Additional theoretical content will be provided. Please refer to the course materials and additional resources for comprehensive coverage."""
    
    def _generate_fallback_practical(self, title: str) -> str:
        """Generate basic practical section when AI fails"""
        return f"""## Practical Applications

### Real-World Use Cases

The concepts in {title} have numerous practical applications across various domains and industries.

### Examples

Practical examples and demonstrations will help you understand how to apply theoretical knowledge in real situations.

### Best Practices

Following industry best practices ensures effective application of these concepts in professional settings.

### Hands-On Practice

Practice problems and exercises are available to reinforce your learning and build practical skills."""
    
    def _generate_fallback_exercises(self, title: str) -> str:
        """Generate basic exercises section when AI fails"""
        return f"""## Practice Exercises

### Concept Check Questions

1. What are the key concepts covered in {title}?
2. How do these concepts relate to each other?
3. What are the main applications of these concepts?

### Applied Problems

1. Apply the concepts learned to solve a practical problem in your domain.
2. Design a solution that demonstrates your understanding.
3. Explain your reasoning and approach.

### Self-Assessment

Evaluate your understanding:
- [ ] I can explain the core concepts
- [ ] I can apply concepts to new situations
- [ ] I can solve related problems independently
- [ ] I understand the practical applications"""
    
    def _generate_fallback_summary(self, title: str, concepts: str) -> str:
        """Generate basic summary when AI fails"""
        return f"""## Summary & Key Takeaways

### Lesson Recap

In this lesson on {title}, we covered: {concepts}.

### Essential Takeaways

1. Understanding the fundamental concepts is crucial
2. Practical application reinforces theoretical knowledge
3. Regular practice leads to mastery
4. Connecting concepts helps build comprehensive understanding

### Reflection Questions

1. How can you apply what you've learned?
2. What aspects would you like to explore further?
3. How does this connect to your previous knowledge?

### Additional Resources

Continue your learning journey by exploring:
- Recommended textbooks and academic papers
- Online courses and tutorials
- Practice platforms and coding challenges
- Community forums and discussion groups

Keep practicing and exploring!"""


# Singleton instance
ai_agent_service = AIAgentService()
