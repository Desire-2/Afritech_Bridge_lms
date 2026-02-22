"""
AI Agent Service for Afritec Bridge LMS

Enhanced AI service with:
- Standardized response handling across all endpoints
- Intelligent error recovery and fallback strategies  
- Real-time progress tracking for long operations
- Smart caching with TTL and content-based keys
- Comprehensive content quality validation
- Enhanced provider management with retry logic

Uses OpenRouter AI (primary) and Google Gemini (fallback) for course content generation.
"""

import json
import time
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple, Callable, Generator
from enum import Enum
from dataclasses import dataclass, asdict

# Import from modular components
logger = logging.getLogger(__name__)

from .ai import (
    ai_provider_manager,
    course_generator,
    lesson_generator,
    comprehensive_lesson_generator,
    task_based_lesson_generator,
    chapter_based_generator,
    assessment_generator,
    content_validator,
    ContentEnhancer,
    json_parser,
)

# Try to import enhanced content validator with fallback
try:
    from .ai.enhanced_content_validator import enhanced_content_validator, ContentType
    ENHANCED_VALIDATOR_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Enhanced content validator not available, using fallback: {e}")
    enhanced_content_validator = None
    ContentType = None
    ENHANCED_VALIDATOR_AVAILABLE = False


class ResponseStatus(Enum):
    """Standardized response status codes"""
    SUCCESS = "success"
    PARTIAL_SUCCESS = "partial_success" 
    ERROR = "error"
    TIMEOUT = "timeout"
    RATE_LIMITED = "rate_limited"


@dataclass
class AIResponse:
    """Standardized AI response structure"""
    status: ResponseStatus
    data: Optional[Dict[str, Any]] = None
    message: str = ""
    error_details: Optional[Dict[str, Any]] = None
    provider_used: Optional[str] = None
    generation_time: Optional[float] = None
    content_quality_score: Optional[float] = None
    cached: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API response"""
        result = {
            "success": self.status == ResponseStatus.SUCCESS,
            "status": self.status.value,
            "message": self.message
        }
        
        if self.data is not None:
            result["data"] = self.data
            
        if self.error_details:
            result["error_details"] = self.error_details
            
        result["metadata"] = {
            "provider_used": self.provider_used,
            "generation_time": self.generation_time,
            "content_quality_score": self.content_quality_score,
            "cached": self.cached,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return result


@dataclass 
class ProgressUpdate:
    """Progress tracking for long operations"""
    step: int
    total_steps: int
    current_task: str
    percentage: float
    elapsed_time: float
    estimated_remaining: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class SmartCache:
    """Enhanced caching with TTL and content-based keys"""
    
    def __init__(self, default_ttl: int = 3600):
        self.cache = {}
        self.default_ttl = default_ttl
        self.access_counts = {}
        self.max_cache_size = 1000
    
    def _generate_key(self, **kwargs) -> str:
        """Generate content-based cache key"""
        content = json.dumps(kwargs, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    def get(self, **kwargs) -> Optional[Any]:
        """Get cached item if not expired"""
        key = self._generate_key(**kwargs)
        
        if key in self.cache:
            item, expiry = self.cache[key]
            if time.time() < expiry:
                self.access_counts[key] = self.access_counts.get(key, 0) + 1
                return item
            else:
                # Expired - remove
                del self.cache[key]
                self.access_counts.pop(key, None)
        
        return None
    
    def set(self, data: Any, ttl: Optional[int] = None, **kwargs) -> None:
        """Cache data with TTL"""
        key = self._generate_key(**kwargs)
        expiry = time.time() + (ttl or self.default_ttl)
        
        # Evict old items if cache too large
        if len(self.cache) >= self.max_cache_size:
            self._evict_least_used()
        
        self.cache[key] = (data, expiry)
        self.access_counts[key] = 1
    
    def _evict_least_used(self):
        """Evict 20% of least used items"""
        if not self.access_counts:
            return
            
        # Sort by access count (ascending) and remove least used
        sorted_items = sorted(self.access_counts.items(), key=lambda x: x[1])
        to_remove = int(len(sorted_items) * 0.2) + 1
        
        for key, _ in sorted_items[:to_remove]:
            self.cache.pop(key, None)
            self.access_counts.pop(key, None)
    
    def clear(self):
        """Clear all cached items"""
        self.cache.clear()
        self.access_counts.clear()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        current_time = time.time()
        expired_count = sum(1 for _, expiry in self.cache.values() if current_time >= expiry)
        
        return {
            "total_items": len(self.cache),
            "expired_items": expired_count,
            "active_items": len(self.cache) - expired_count,
            "total_access_count": sum(self.access_counts.values()),
            "average_access_count": sum(self.access_counts.values()) / len(self.access_counts) if self.access_counts else 0
        }


class AIAgentService:
    """
    Enhanced AI service facade with standardized responses, smart caching, and progress tracking.
    
    Features:
    - Standardized AIResponse format across all endpoints
    - Smart caching with content-based keys and TTL
    - Real-time progress tracking for long operations
    - Intelligent error recovery and retry logic
    - Content quality scoring and validation
    - Provider performance monitoring
    """
    
    def __init__(self):
        """Initialize Enhanced AI Agent Service"""
        self.provider = ai_provider_manager
        self.course_gen = course_generator
        self.lesson_gen = lesson_generator
        self.comprehensive_gen = comprehensive_lesson_generator
        self.task_based_gen = task_based_lesson_generator
        self.chapter_gen = chapter_based_generator
        self.assessment_gen = assessment_generator
        self.content_enhancer = ContentEnhancer(ai_provider_manager)
        
        # Enhanced features
        self.smart_cache = SmartCache()
        self.progress_sessions = {}  # track progress for long operations
        self.quality_threshold = 0.5  # minimum content quality score (aligned with enhanced validator)
        self.retry_attempts = 3
        
        logger.info("Enhanced AIAgentService initialized with smart caching and progress tracking")
    
    # ===== Enhanced Management Methods =====
    
    def get_provider_stats(self) -> Dict[str, Any]:
        """Get comprehensive statistics about AI provider usage and performance"""
        provider_stats = self.provider.get_provider_stats()
        cache_stats = self.smart_cache.get_stats()
        
        return {
            "providers": provider_stats,
            "cache": cache_stats,
            "progress_sessions": len(self.progress_sessions),
            "quality_threshold": self.quality_threshold,
            "retry_attempts": self.retry_attempts
        }
    
    def reset_provider_failures(self, provider: str = None):
        """Reset failure counts for a provider or all providers"""
        self.provider.reset_provider_failures(provider)
        logger.info(f"Provider failure counts reset: {provider or 'all providers'}")
    
    def clear_cache(self):
        """Clear all caches"""
        self.provider.clear_cache()  # provider cache
        self.smart_cache.clear()     # smart cache
        logger.info("All caches cleared")
    
    def force_provider(self, provider: str):
        """Force use of a specific provider ('openrouter' or 'gemini')"""
        self.provider.force_provider(provider)
        logger.info(f"Forced provider switch to: {provider}")
    
    def set_quality_threshold(self, threshold: float):
        """Set minimum content quality threshold (0.0 - 1.0)"""
        self.quality_threshold = max(0.0, min(1.0, threshold))
        logger.info(f"Quality threshold set to: {self.quality_threshold}")
    
    # ===== Enhanced Generation Methods =====
    
    def _execute_with_retry_and_cache(self, cache_key: str, generation_func: Callable, 
                                    *args, skip_quality_check: bool = False, **kwargs) -> AIResponse:
        """Execute generation with retry logic, caching, and optional quality validation
        
        Args:
            cache_key: Key for caching results
            generation_func: The function to call for generation
            *args: Positional args passed to generation_func
            skip_quality_check: If True, skip quality threshold validation and always return SUCCESS
            **kwargs: Keyword args passed to generation_func
        """
        start_time = time.time()
        
        # Check cache first
        cached_result = self.smart_cache.get(cache_key=cache_key)
        if cached_result:
            return AIResponse(
                status=ResponseStatus.SUCCESS,
                data=cached_result,
                message="Content retrieved from cache",
                cached=True,
                generation_time=0.0
            )
        
        # Attempt generation with retry
        last_error = None
        for attempt in range(self.retry_attempts):
            try:
                result = generation_func(*args, **kwargs)
                
                if result and isinstance(result, dict):
                    # Assess quality (for logging) but skip threshold enforcement if requested
                    quality_score = self._assess_content_quality(result)
                    
                    if skip_quality_check or quality_score >= self.quality_threshold:
                        # Cache successful result
                        self.smart_cache.set(result, cache_key=cache_key)
                        
                        return AIResponse(
                            status=ResponseStatus.SUCCESS,
                            data=result,
                            message="Content generated successfully",
                            provider_used=getattr(self.provider, 'current_provider', 'unknown'),
                            generation_time=time.time() - start_time,
                            content_quality_score=quality_score
                        )
                    else:
                        current_provider = getattr(self.provider, 'current_provider', 'unknown')
                        logger.warning(f"Content quality below threshold: {quality_score:.2f} < {self.quality_threshold} (provider: {current_provider})")
                        
                        # If OpenRouter failed quality check and we're not on the last attempt, try Gemini
                        if current_provider == 'openrouter' and attempt < self.retry_attempts - 1:
                            logger.info("OpenRouter content failed quality check, trying Gemini for better results...")
                            
                            # Try with Gemini
                            try:
                                original_provider = self.provider.current_provider
                                self.provider.force_provider('gemini')
                                
                                gemini_result = generation_func(*args, **kwargs)
                                if gemini_result and isinstance(gemini_result, dict):
                                    gemini_quality = self._assess_content_quality(gemini_result)
                                    
                                    # Use a more lenient threshold for lesson content (0.45 vs 0.6)
                                    effective_threshold = 0.45 if "lesson" in cache_key.lower() else self.quality_threshold
                                    
                                    if gemini_quality >= effective_threshold:
                                        # Cache successful Gemini result
                                        self.smart_cache.set(gemini_result, cache_key=cache_key)
                                        logger.info(f"Gemini generated better quality content: {gemini_quality:.2f} (threshold: {effective_threshold:.2f})")
                                        
                                        return AIResponse(
                                            status=ResponseStatus.SUCCESS,
                                            data=gemini_result,
                                            message="Content generated successfully with Gemini fallback",
                                            provider_used='gemini',
                                            generation_time=time.time() - start_time,
                                            content_quality_score=gemini_quality
                                        )
                                    else:
                                        logger.warning(f"Gemini also produced low quality content: {gemini_quality:.2f}")
                                        # Use the better result of the two
                                        if gemini_quality > quality_score:
                                            result = gemini_result
                                            quality_score = gemini_quality
                            except Exception as gemini_error:
                                logger.error(f"Gemini fallback failed: {gemini_error}")
                            finally:
                                # Restore original provider
                                self.provider.force_provider(original_provider)
                        
                        if attempt == self.retry_attempts - 1:
                            # Last attempt - return with partial success
                            return AIResponse(
                                status=ResponseStatus.PARTIAL_SUCCESS,
                                data=result,
                                message=f"Content generated but quality below threshold ({quality_score:.2f})",
                                provider_used=current_provider,
                                generation_time=time.time() - start_time,
                                content_quality_score=quality_score
                            )
                        continue
                else:
                    raise ValueError("Generation returned empty or invalid result")
                    
            except Exception as e:
                last_error = e
                logger.warning(f"Generation attempt {attempt + 1} failed: {e}")
                if attempt < self.retry_attempts - 1:
                    time.sleep(1.5 ** attempt)  # exponential backoff
        
        # All attempts failed
        return AIResponse(
            status=ResponseStatus.ERROR,
            message=f"Generation failed after {self.retry_attempts} attempts",
            error_details={"last_error": str(last_error)},
            generation_time=time.time() - start_time
        )
    
    def _assess_content_quality(self, content: Dict[str, Any]) -> float:
        """Assess content quality using enhanced content validator with fallback"""
        try:
            # Use enhanced content validator if available
            if ENHANCED_VALIDATOR_AVAILABLE and enhanced_content_validator and ContentType:
                # Determine content type based on content structure
                if content.get('suggested_modules'):
                    content_type = ContentType.COURSE_OUTLINE
                elif content.get('modules') and isinstance(content.get('modules'), list):
                    # Handle {"modules": [...]} structure from generate_multiple_modules
                    content_type = ContentType.COURSE_OUTLINE
                elif content.get('suggested_lessons'):
                    content_type = ContentType.MODULE_CONTENT
                elif content.get('lessons') and isinstance(content.get('lessons'), list):
                    # Handle {"lessons": [...]} structure from generate_multiple_lessons
                    content_type = ContentType.MODULE_CONTENT
                elif content.get('content') and len(str(content.get('content', ''))) > 100:
                    content_type = ContentType.LESSON_CONTENT
                elif content.get('questions') and isinstance(content.get('questions'), list):
                    content_type = ContentType.QUIZ_QUESTIONS
                else:
                    content_type = ContentType.MIXED_CONTENT
                
                # Use enhanced content validator
                validation_result = enhanced_content_validator.validate_content_comprehensive(
                    content, content_type
                )
                
                logger.debug(f"Enhanced quality assessment: {validation_result.overall_score:.2f} (valid: {validation_result.is_valid}, type: {content_type.value})")
                return validation_result.overall_score
            else:
                # Fallback to basic quality assessment
                logger.debug("Using fallback quality assessment")
                return self._assess_content_quality_basic(content)
                
        except Exception as e:
            logger.warning(f"Quality assessment failed, using fallback: {e}")
            return self._assess_content_quality_basic(content)
    
    def _assess_content_quality_basic(self, content: Dict[str, Any]) -> float:
        """Basic content quality assessment fallback"""
        score = 0.5  # baseline score
        
        # Basic completeness checks
        if content.get('title'):
            score += 0.15
        if content.get('description') and len(str(content.get('description', ''))) > 50:
            score += 0.15
        if content.get('learning_objectives'):
            score += 0.1
        
        # Content depth checks — handle both direct arrays and nested structures
        if isinstance(content.get('modules'), list) and len(content['modules']) > 0:
            score += 0.2  # Multiple modules is a strong signal of completeness
        elif isinstance(content.get('suggested_modules'), list) and len(content['suggested_modules']) > 0:
            score += 0.15
        elif isinstance(content.get('lessons'), list) and len(content['lessons']) > 0:
            score += 0.2  # Multiple lessons is a strong signal
        elif isinstance(content.get('suggested_lessons'), list) and len(content['suggested_lessons']) > 0:
            score += 0.15
        elif content.get('content') and len(str(content.get('content', ''))) > 200:
            score += 0.15
        
        logger.debug(f"Basic quality score: {score:.2f}")
        return min(1.0, score)
    
    def generate_course_outline(self, topic: str, target_audience: str = "", 
                               learning_objectives: str = "") -> AIResponse:
        """
        Generate a complete course outline with enhanced error handling and caching.
        Quality threshold is skipped for outlines — always returns SUCCESS if content is generated.
        
        Returns:
            AIResponse with standardized format
        """
        cache_key = f"course_outline_{topic}_{target_audience}_{learning_objectives}"
        
        return self._execute_with_retry_and_cache(
            cache_key,
            self.course_gen.generate_course_outline,
            topic, target_audience, learning_objectives,
            skip_quality_check=True
        )

    def generate_multiple_modules(self, course_title: str, course_description: str,
                                  course_objectives: str, num_modules: int = 5,
                                  existing_modules: Optional[List[Dict[str, Any]]] = None,
                                  course_context: Optional[List[Dict[str, Any]]] = None) -> AIResponse:
        """Generate multiple module outlines with enhanced handling.
        Quality threshold is skipped for module outlines."""
        cache_key = f"modules_{course_title}_{num_modules}_{len(existing_modules or [])}"
        
        return self._execute_with_retry_and_cache(
            cache_key,
            self.course_gen.generate_multiple_modules,
            course_title, course_description, course_objectives, num_modules, existing_modules, course_context,
            skip_quality_check=True
        )

    def generate_module_content(self, course_title: str, course_description: str,
                               course_objectives: str, module_title: str = "",
                               existing_modules: Optional[List[Dict[str, Any]]] = None,
                               course_context: Optional[List[Dict[str, Any]]] = None) -> AIResponse:
        """Generate module details with enhanced handling.
        Quality threshold is skipped for module content."""
        cache_key = f"module_{course_title}_{module_title}_{len(existing_modules or [])}"
        
        return self._execute_with_retry_and_cache(
            cache_key,
            self.course_gen.generate_module_content,
            course_title, course_description, course_objectives, module_title, existing_modules, course_context,
            skip_quality_check=True
        )
    
    # ===== Enhanced Lesson Generation =====
    
    def generate_lesson_content(self, course_title: str, module_title: str,
                               module_description: str, module_objectives: str,
                               lesson_title: str = "", lesson_description: str = "",
                               existing_lessons: Optional[List[Dict[str, Any]]] = None,
                               course_context: Optional[List[Dict[str, Any]]] = None) -> AIResponse:
        """Generate detailed lesson content with enhanced handling and cross-module context"""
        cache_key = f"lesson_{course_title}_{module_title}_{lesson_title}_{len(existing_lessons or [])}"
        
        return self._execute_with_retry_and_cache(
            cache_key,
            self.lesson_gen.generate_lesson_content,
            course_title, module_title, module_description, module_objectives,
            lesson_title, lesson_description, existing_lessons, course_context
        )
    
    def generate_multiple_lessons(self, course_title: str, module_title: str,
                                  module_description: str, module_objectives: str,
                                  num_lessons: int = 5,
                                  existing_lessons: Optional[List[Dict[str, Any]]] = None,
                                  course_context: Optional[List[Dict[str, Any]]] = None) -> AIResponse:
        """Generate multiple lesson outlines with enhanced handling.
        Quality threshold is skipped for lesson outlines."""
        cache_key = f"lessons_{course_title}_{module_title}_{num_lessons}_{len(existing_lessons or [])}"
        
        return self._execute_with_retry_and_cache(
            cache_key,
            self.lesson_gen.generate_multiple_lessons,
            course_title, module_title, module_description, module_objectives,
            num_lessons, existing_lessons, course_context,
            skip_quality_check=True
        )
    
    def generate_mixed_content(self, course_title: str, module_title: str,
                              module_description: str, lesson_title: str,
                              lesson_description: str = "",
                              template_id: Optional[str] = None,
                              existing_sections: Optional[List[Dict[str, Any]]] = None) -> AIResponse:
        """Generate mixed content lesson with enhanced handling"""
        cache_key = f"mixed_{course_title}_{module_title}_{lesson_title}_{template_id}"
        
        return self._execute_with_retry_and_cache(
            cache_key,
            self.lesson_gen.generate_mixed_content,
            course_title, module_title, module_description, lesson_title,
            lesson_description, template_id, existing_sections
        )
    
    def generate_lesson_section(self, lesson_title: str, section_type: str,
                               section_context: Dict[str, Any],
                               difficulty_level: str = "intermediate") -> AIResponse:
        """Generate a specific section of a lesson with enhanced handling"""
        cache_key = f"section_{lesson_title}_{section_type}_{difficulty_level}"
        
        return self._execute_with_retry_and_cache(
            cache_key,
            self.lesson_gen.generate_lesson_section,
            lesson_title, section_type, section_context, difficulty_level
        )
    
    # ===== Enhanced Comprehensive Lesson Generation =====
    
    def generate_comprehensive_lesson_with_progress(self, course_title: str, module_title: str,
                                                   module_description: str, module_objectives: str,
                                                   lesson_title: str, lesson_description: str = "",
                                                   difficulty_level: str = "intermediate",
                                                   existing_lessons: Optional[List[Dict[str, Any]]] = None,
                                                   progress_callback: Optional[Callable] = None) -> AIResponse:
        """
        Generate comprehensive lesson with real-time progress tracking
        """
        import uuid
        session_id = str(uuid.uuid4())
        
        def internal_progress_callback(step: int, total: int, message: str):
            progress = ProgressUpdate(
                step=step,
                total_steps=total,
                current_task=message,
                percentage=(step / total) * 100,
                elapsed_time=time.time() - start_time
            )
            self.progress_sessions[session_id] = progress
            if progress_callback:
                progress_callback(progress.to_dict())
        
        start_time = time.time()
        cache_key = f"comprehensive_{course_title}_{module_title}_{lesson_title}_{difficulty_level}"
        
        # Check cache first
        cached_result = self.smart_cache.get(cache_key=cache_key)
        if cached_result:
            return AIResponse(
                status=ResponseStatus.SUCCESS,
                data=cached_result,
                message="Comprehensive lesson retrieved from cache",
                cached=True
            )
        
        try:
            result = self.comprehensive_gen.generate_comprehensive_lesson_with_validation(
                course_title, module_title, module_description, module_objectives,
                lesson_title, lesson_description, difficulty_level, existing_lessons,
                internal_progress_callback
            )
            
            if result:
                quality_score = self._assess_content_quality(result)
                self.smart_cache.set(result, cache_key=cache_key)
                
                # Clean up progress session
                self.progress_sessions.pop(session_id, None)
                
                return AIResponse(
                    status=ResponseStatus.SUCCESS,
                    data=result,
                    message="Comprehensive lesson generated successfully",
                    generation_time=time.time() - start_time,
                    content_quality_score=quality_score
                )
            else:
                raise ValueError("Comprehensive generation returned empty result")
                
        except Exception as e:
            self.progress_sessions.pop(session_id, None)
            return AIResponse(
                status=ResponseStatus.ERROR,
                message=f"Comprehensive lesson generation failed: {str(e)}",
                error_details={"error": str(e)},
                generation_time=time.time() - start_time
            )
    
    # ===== Progress Tracking Methods =====
    
    def get_progress(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get progress for a specific generation session"""
        if session_id in self.progress_sessions:
            return self.progress_sessions[session_id].to_dict()
        return None
    
    def get_all_active_sessions(self) -> Dict[str, Dict[str, Any]]:
        """Get all active progress sessions"""
        return {sid: progress.to_dict() for sid, progress in self.progress_sessions.items()}
    
    def cancel_session(self, session_id: str) -> bool:
        """Cancel an active generation session"""
        if session_id in self.progress_sessions:
            del self.progress_sessions[session_id]
            return True
        return False
    
    # ===== Enhanced Assessment Generation =====
    
    def generate_quiz_questions(self, course_title: str, module_title: str,
                               lesson_title: str, lesson_content: str,
                               num_questions: int = 5,
                               question_types: Optional[List[str]] = None) -> AIResponse:
        """Generate quiz questions with enhanced handling"""
        cache_key = f"quiz_{course_title}_{module_title}_{lesson_title}_{num_questions}"
        
        return self._execute_with_retry_and_cache(
            cache_key,
            self.assessment_gen.generate_quiz_questions,
            course_title, module_title, lesson_title, lesson_content,
            num_questions, question_types
        )
    
    def generate_quiz_from_content(self, lesson_or_module_content: str, 
                                   content_title: str, content_type: str = "lesson",
                                   num_questions: int = 10, difficulty: str = "mixed") -> AIResponse:
        """Generate a quiz based on actual content with enhanced handling"""
        cache_key = f"quiz_content_{content_title}_{content_type}_{num_questions}_{difficulty}"
        
        return self._execute_with_retry_and_cache(
            cache_key,
            self.assessment_gen.generate_quiz_from_content,
            lesson_or_module_content, content_title, content_type, num_questions, difficulty
        )
    
    def generate_assignment(self, course_title: str, module_title: str,
                          module_description: str, lessons_summary: str) -> AIResponse:
        """Generate assignment with enhanced handling"""
        cache_key = f"assignment_{course_title}_{module_title}"
        
        return self._execute_with_retry_and_cache(
            cache_key,
            self.assessment_gen.generate_assignment,
            course_title, module_title, module_description, lessons_summary
        )
    
    def generate_assignment_from_content(self, lesson_or_module_content: str,
                                       content_title: str, content_type: str = "lesson",
                                       assignment_type: str = "practical") -> AIResponse:
        """Generate assignment based on actual content with enhanced handling"""
        cache_key = f"assignment_content_{content_title}_{content_type}_{assignment_type}"
        
        return self._execute_with_retry_and_cache(
            cache_key,
            self.assessment_gen.generate_assignment_from_content,
            lesson_or_module_content, content_title, content_type, assignment_type
        )
    
    def generate_project_from_content(self, module_contents: list,
                                    module_title: str, course_title: str) -> AIResponse:
        """Generate project from module content with enhanced handling"""
        cache_key = f"project_content_{module_title}_{course_title}"
        
        return self._execute_with_retry_and_cache(
            cache_key,
            self.assessment_gen.generate_project_from_content,
            module_contents, module_title, course_title
        )
    
    # ===== Enhanced Content Enhancement =====
    
    def enhance_content(self, content_type: str, current_content: str,
                       enhancement_type: str = "improve") -> AIResponse:
        """Enhance existing content with validation"""
        cache_key = f"enhance_{content_type}_{enhancement_type}_{hashlib.md5(current_content.encode()).hexdigest()[:8]}"
        
        cached_result = self.smart_cache.get(cache_key=cache_key)
        if cached_result:
            return AIResponse(
                status=ResponseStatus.SUCCESS,
                data={"enhanced_content": cached_result},
                message="Enhanced content retrieved from cache",
                cached=True
            )
        
        try:
            enhanced = self.content_enhancer.enhance_content(content_type, current_content, enhancement_type)
            if enhanced and len(enhanced) > len(current_content) * 0.8:  # ensure meaningful enhancement
                self.smart_cache.set(enhanced, cache_key=cache_key)
                return AIResponse(
                    status=ResponseStatus.SUCCESS,
                    data={"enhanced_content": enhanced},
                    message="Content enhanced successfully"
                )
            else:
                return AIResponse(
                    status=ResponseStatus.PARTIAL_SUCCESS,
                    data={"enhanced_content": enhanced or current_content},
                    message="Content enhancement had limited improvement"
                )
        except Exception as e:
            return AIResponse(
                status=ResponseStatus.ERROR,
                message=f"Content enhancement failed: {str(e)}",
                error_details={"error": str(e)}
            )
    
    # ===== Comprehensive Lesson with Validation =====
    
    def generate_comprehensive_lesson_with_validation(self, course_title: str, module_title: str,
                                                      module_description: str, module_objectives: str,
                                                      lesson_title: str, lesson_description: str = "",
                                                      difficulty_level: str = "intermediate",
                                                      existing_lessons: Optional[List[Dict[str, Any]]] = None) -> AIResponse:
        """
        Generate comprehensive lesson with validation, wrapping result in AIResponse.
        Delegates to comprehensive_lesson_generator.generate_comprehensive_lesson_with_validation().
        """
        start_time = time.time()
        cache_key = f"comprehensive_validated_{course_title}_{module_title}_{lesson_title}_{difficulty_level}"
        
        # Check cache first
        cached_result = self.smart_cache.get(cache_key=cache_key)
        if cached_result:
            return AIResponse(
                status=ResponseStatus.SUCCESS,
                data=cached_result,
                message="Comprehensive lesson retrieved from cache",
                cached=True,
                generation_time=0.0
            )
        
        try:
            result = self.comprehensive_gen.generate_comprehensive_lesson_with_validation(
                course_title, module_title, module_description, module_objectives,
                lesson_title, lesson_description, difficulty_level, existing_lessons
            )
            
            if result and isinstance(result, dict):
                quality_score = self._assess_content_quality(result)
                self.smart_cache.set(result, cache_key=cache_key)
                
                return AIResponse(
                    status=ResponseStatus.SUCCESS,
                    data=result,
                    message="Comprehensive lesson generated successfully with validation",
                    provider_used=getattr(self.provider, 'current_provider', 'unknown'),
                    generation_time=time.time() - start_time,
                    content_quality_score=quality_score
                )
            else:
                raise ValueError("Comprehensive lesson generation returned empty result")
        except Exception as e:
            logger.error(f"Comprehensive lesson generation failed: {e}")
            return AIResponse(
                status=ResponseStatus.ERROR,
                message=f"Comprehensive lesson generation failed: {str(e)}",
                error_details={"error": str(e)},
                generation_time=time.time() - start_time
            )
    
    # ===== Final Project Generation =====
    
    def generate_final_project(self, course_title: str, course_description: str,
                              course_objectives: str, modules_summary: str) -> AIResponse:
        """Generate final/capstone project with enhanced handling"""
        cache_key = f"final_project_{course_title}"
        
        return self._execute_with_retry_and_cache(
            cache_key,
            self.assessment_gen.generate_final_project,
            course_title, course_description, course_objectives, modules_summary
        )
    
    # ===== Task-Based Lesson Generation =====
    
    def generate_lesson_with_tasks(self, course_title: str, module_title: str,
                                   module_description: str, module_objectives: str,
                                   lesson_title: str, lesson_description: str = "",
                                   difficulty_level: str = "intermediate",
                                   existing_lessons: Optional[List[Dict[str, Any]]] = None,
                                   depth_level: str = "comprehensive",
                                   parallel: bool = True) -> AIResponse:
        """Generate lesson using task-based approach, wrapping result in AIResponse."""
        start_time = time.time()
        cache_key = f"task_lesson_{course_title}_{module_title}_{lesson_title}_{depth_level}"
        
        cached_result = self.smart_cache.get(cache_key=cache_key)
        if cached_result:
            return AIResponse(
                status=ResponseStatus.SUCCESS,
                data=cached_result,
                message="Task-based lesson retrieved from cache",
                cached=True,
                generation_time=0.0
            )
        
        try:
            result = self.task_based_gen.generate_lesson_with_tasks(
                course_title=course_title,
                module_title=module_title,
                module_description=module_description,
                module_objectives=module_objectives,
                lesson_title=lesson_title,
                lesson_description=lesson_description,
                difficulty_level=difficulty_level,
                existing_lessons=existing_lessons,
                depth_level=depth_level,
                parallel=parallel
            )
            
            if result and isinstance(result, dict):
                quality_score = self._assess_content_quality(result)
                self.smart_cache.set(result, cache_key=cache_key)
                
                return AIResponse(
                    status=ResponseStatus.SUCCESS,
                    data=result,
                    message="Task-based lesson generated successfully",
                    provider_used=getattr(self.provider, 'current_provider', 'unknown'),
                    generation_time=time.time() - start_time,
                    content_quality_score=quality_score
                )
            else:
                raise ValueError("Task-based lesson generation returned empty result")
        except Exception as e:
            logger.error(f"Task-based lesson generation failed: {e}")
            return AIResponse(
                status=ResponseStatus.ERROR,
                message=f"Task-based lesson generation failed: {str(e)}",
                error_details={"error": str(e)},
                generation_time=time.time() - start_time
            )
    
    # ===== Deep Lesson Generation =====
    
    def generate_deep_lesson(self, course_title: str, module_title: str,
                            module_description: str, module_objectives: str,
                            lesson_title: str, lesson_description: str = "",
                            existing_lessons: Optional[List[Dict[str, Any]]] = None) -> AIResponse:
        """
        Generate a deeply comprehensive lesson using task-based approach with 'expert' depth.
        This is a convenience wrapper around generate_lesson_with_tasks with depth_level='expert'.
        """
        return self.generate_lesson_with_tasks(
            course_title=course_title,
            module_title=module_title,
            module_description=module_description,
            module_objectives=module_objectives,
            lesson_title=lesson_title,
            lesson_description=lesson_description,
            difficulty_level="advanced",
            existing_lessons=existing_lessons,
            depth_level="expert",
            parallel=True
        )
    
    # ===== Chapter-Based Lesson Generation =====
    
    def create_chapter_session(self, course_title: str, module_title: str,
                              module_description: str, module_objectives: str,
                              lesson_title: str, lesson_description: str = "",
                              difficulty_level: str = "intermediate",
                              existing_lessons: Optional[List[Dict[str, Any]]] = None,
                              target_chapters: int = 5,
                              chapter_depth: str = "deep") -> str:
        """Create a chapter-based lesson generation session. Returns session_id."""
        return self.chapter_gen.create_session(
            course_title=course_title,
            module_title=module_title,
            module_description=module_description,
            module_objectives=module_objectives,
            lesson_title=lesson_title,
            lesson_description=lesson_description,
            difficulty_level=difficulty_level,
            existing_lessons=existing_lessons,
            target_chapters=target_chapters,
            chapter_depth=chapter_depth
        )
    
    def get_chapter_session_status(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a chapter-based generation session."""
        return self.chapter_gen.get_session_status(session_id)
    
    def outline_lesson_chapters(self, session_id: str) -> List[Dict[str, Any]]:
        """Generate chapter outlines for a lesson session. Returns list of chapter outlines."""
        return self.chapter_gen.outline_chapters(session_id)
    
    def generate_chapter(self, session_id: str, chapter_id: str) -> Dict[str, Any]:
        """Generate content for a single chapter in a session."""
        return self.chapter_gen.generate_chapter(session_id, chapter_id)
    
    def generate_lesson_by_chapters(self, course_title: str, module_title: str,
                                    module_description: str, module_objectives: str,
                                    lesson_title: str, lesson_description: str = "",
                                    difficulty_level: str = "intermediate",
                                    existing_lessons: Optional[List[Dict[str, Any]]] = None,
                                    target_chapters: int = 5,
                                    chapter_depth: str = "deep") -> AIResponse:
        """Generate a complete lesson using chapter-by-chapter approach, wrapping in AIResponse."""
        start_time = time.time()
        cache_key = f"chapter_lesson_{course_title}_{module_title}_{lesson_title}_{target_chapters}_{chapter_depth}"
        
        cached_result = self.smart_cache.get(cache_key=cache_key)
        if cached_result:
            return AIResponse(
                status=ResponseStatus.SUCCESS,
                data=cached_result,
                message="Chapter-based lesson retrieved from cache",
                cached=True,
                generation_time=0.0
            )
        
        try:
            result = self.chapter_gen.generate_lesson(
                course_title=course_title,
                module_title=module_title,
                module_description=module_description,
                module_objectives=module_objectives,
                lesson_title=lesson_title,
                lesson_description=lesson_description,
                difficulty_level=difficulty_level,
                existing_lessons=existing_lessons,
                target_chapters=target_chapters,
                chapter_depth=chapter_depth
            )
            
            if result and isinstance(result, dict):
                quality_score = self._assess_content_quality(result)
                self.smart_cache.set(result, cache_key=cache_key)
                
                return AIResponse(
                    status=ResponseStatus.SUCCESS,
                    data=result,
                    message="Chapter-based lesson generated successfully",
                    provider_used=getattr(self.provider, 'current_provider', 'unknown'),
                    generation_time=time.time() - start_time,
                    content_quality_score=quality_score
                )
            else:
                raise ValueError("Chapter-based lesson generation returned empty result")
        except Exception as e:
            logger.error(f"Chapter-based lesson generation failed: {e}")
            return AIResponse(
                status=ResponseStatus.ERROR,
                message=f"Chapter-based lesson generation failed: {str(e)}",
                error_details={"error": str(e)},
                generation_time=time.time() - start_time
            )
    
    # ===== Section Content Enhancement =====
    
    def enhance_section_content(self, section_type: str, section_content: str,
                               context: Dict[str, Any]) -> AIResponse:
        """Enhance a specific section of mixed content, wrapping result in AIResponse."""
        start_time = time.time()
        try:
            result = self.content_enhancer.enhance_section_content(
                section_type=section_type,
                section_content=section_content,
                context=context
            )
            
            if result and isinstance(result, dict):
                return AIResponse(
                    status=ResponseStatus.SUCCESS,
                    data=result,
                    message="Section content enhanced successfully",
                    provider_used=getattr(self.provider, 'current_provider', 'unknown'),
                    generation_time=time.time() - start_time
                )
            else:
                return AIResponse(
                    status=ResponseStatus.PARTIAL_SUCCESS,
                    data={"enhanced_content": section_content},
                    message="Section enhancement had limited improvement",
                    generation_time=time.time() - start_time
                )
        except Exception as e:
            logger.error(f"Section content enhancement failed: {e}")
            return AIResponse(
                status=ResponseStatus.ERROR,
                message=f"Section enhancement failed: {str(e)}",
                error_details={"error": str(e)},
                generation_time=time.time() - start_time
            )
    
    # ===== Backwards Compatibility Methods =====
    
    def _make_ai_request(self, prompt: str, temperature: float = 0.7, 
                        max_tokens: int = 4096, prefer_fast: bool = False) -> Tuple[Optional[str], str]:
        """Make a unified AI request with automatic provider switching"""
        return self.provider.make_ai_request(prompt, temperature, max_tokens, prefer_fast)
    
    def _parse_json_response(self, result: str, context: str = "response") -> Optional[Dict[str, Any]]:
        """Parse JSON response from AI with error recovery"""
        return json_parser.parse_json_response(result, context)
    
    def _validate_content_quality(self, content: str, content_type: str, min_length: int = 500) -> Dict[str, Any]:
        """Validate the quality and completeness of generated content"""
        return content_validator.validate_content_quality(content, content_type, min_length)
    
    # =====================================================================
    # BACKGROUND TASK METHODS
    # These methods run in background threads via BackgroundTaskManager.
    # Each accepts task_id as a keyword argument for progress reporting.
    # =====================================================================
    
    def run_single_step_background(self, task_id: str = None,
                                    method_name: str = '',
                                    method_kwargs: dict = None) -> Dict[str, Any]:
        """
        Generic background wrapper for any single-step generation method.
        Runs the named method and returns its result as a dict.
        """
        from .ai.task_manager import task_manager
        
        method = getattr(self, method_name, None)
        if not method:
            raise ValueError(f"Unknown method: {method_name}")
        
        if task_id:
            task_manager.update_progress(task_id, 1, 1, "Generating content...")
        
        result = method(**(method_kwargs or {}))
        
        if task_id:
            task_manager.complete_step(task_id, 1, 1, "Content generated")
        
        if isinstance(result, AIResponse):
            return result.to_dict()
        return result
    
    def generate_multiple_lessons_stepwise(self, task_id: str = None,
                                            course_title: str = '',
                                            module_title: str = '',
                                            module_description: str = '',
                                            module_objectives: str = '',
                                            num_lessons: int = 5,
                                            existing_lessons: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Step-by-step lesson generation for background execution.
        
        Generates each lesson individually with delays between them to avoid rate limits.
        Each lesson prompt includes context from previously generated lessons for coherence.
        """
        from .ai.task_manager import task_manager
        
        all_lessons = []
        accumulated_context = list(existing_lessons or [])
        start_time = time.time()
        
        for i in range(num_lessons):
            if task_id and task_manager.is_cancelled(task_id):
                logger.info(f"Task {task_id[:8]}... cancelled at step {i + 1}")
                break
            
            lesson_num = len(accumulated_context) + 1
            
            if task_id:
                task_manager.update_progress(
                    task_id, i + 1, num_lessons,
                    f"Generating lesson {i + 1} of {num_lessons}..."
                )
            
            try:
                result = self.lesson_gen.generate_lesson_content(
                    course_title=course_title,
                    module_title=module_title,
                    module_description=module_description,
                    module_objectives=module_objectives,
                    lesson_title="",
                    lesson_description="",
                    existing_lessons=accumulated_context
                )
            except Exception as e:
                logger.error(f"Lesson step {i + 1} failed: {e}")
                result = None
            
            if result and isinstance(result, dict):
                result['order'] = lesson_num
                all_lessons.append(result)
                accumulated_context.append({
                    'title': result.get('title', f'Lesson {lesson_num}'),
                    'description': result.get('description', ''),
                    'order': lesson_num,
                    'duration_minutes': result.get('duration_minutes', 45)
                })
                if task_id:
                    task_manager.complete_step(
                        task_id, i + 1, num_lessons,
                        f"✓ Lesson {i + 1}: {result.get('title', f'Lesson {lesson_num}')}"
                    )
                logger.info(f"Step {i + 1}/{num_lessons}: Generated '{result.get('title', 'unknown')}'")
            else:
                if task_id:
                    task_manager.complete_step(
                        task_id, i + 1, num_lessons,
                        f"✗ Lesson {i + 1}: generation failed (continuing)"
                    )
                logger.warning(f"Step {i + 1}/{num_lessons}: Failed to generate lesson")
            
            # Delay between steps — sleep in 1s increments to allow quick cancellation
            if i < num_lessons - 1:
                if task_id and task_manager.is_cancelled(task_id):
                    break
                delay = task_manager.step_delay
                logger.info(f"Waiting {delay}s before next lesson (rate limit prevention)")
                for _ in range(delay):
                    if task_id and task_manager.is_cancelled(task_id):
                        break
                    time.sleep(1)
        
        status = ResponseStatus.SUCCESS if len(all_lessons) == num_lessons else (
            ResponseStatus.PARTIAL_SUCCESS if all_lessons else ResponseStatus.ERROR
        )
        return AIResponse(
            status=status,
            data={"lessons": all_lessons},
            message=f"Generated {len(all_lessons)} of {num_lessons} lessons step by step",
            provider_used=getattr(self.provider, 'current_provider', 'unknown'),
            generation_time=time.time() - start_time,
        ).to_dict()
    
    def generate_multiple_modules_stepwise(self, task_id: str = None,
                                            course_title: str = '',
                                            course_description: str = '',
                                            course_objectives: str = '',
                                            num_modules: int = 5,
                                            existing_modules: Optional[List[Dict[str, Any]]] = None,
                                            course_context: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Step-by-step module generation for background execution.
        Generates each module individually with delays between them.
        Maintains accumulated context (including suggested lessons) to prevent duplication.
        """
        from .ai.task_manager import task_manager
        
        all_modules = []
        accumulated_context = list(existing_modules or [])
        start_time = time.time()
        
        for i in range(num_modules):
            if task_id and task_manager.is_cancelled(task_id):
                logger.info(f"Task {task_id[:8]}... cancelled at step {i + 1}")
                break
            
            module_num = len(accumulated_context) + 1
            
            if task_id:
                task_manager.update_progress(
                    task_id, i + 1, num_modules,
                    f"Generating module {i + 1} of {num_modules}..."
                )
            
            try:
                result = self.course_gen.generate_module_content(
                    course_title=course_title,
                    course_description=course_description,
                    course_objectives=course_objectives,
                    module_title="",
                    existing_modules=accumulated_context,
                    course_context=course_context
                )
            except Exception as e:
                logger.error(f"Module step {i + 1} failed: {e}")
                result = None
            
            if result and isinstance(result, dict):
                result['order'] = module_num
                all_modules.append(result)
                # Include suggested_lessons in accumulated context so next module
                # can see what lesson topics have already been proposed
                accumulated_context.append({
                    'title': result.get('title', f'Module {module_num}'),
                    'description': result.get('description', ''),
                    'learning_objectives': result.get('learning_objectives', ''),
                    'order': module_num,
                    'suggested_lessons': result.get('suggested_lessons', []),
                })
                if task_id:
                    task_manager.complete_step(
                        task_id, i + 1, num_modules,
                        f"✓ Module {i + 1}: {result.get('title', f'Module {module_num}')}"
                    )
                logger.info(f"Step {i + 1}/{num_modules}: Generated '{result.get('title', 'unknown')}' with {len(result.get('suggested_lessons', []))} suggested lessons")
            else:
                if task_id:
                    task_manager.complete_step(
                        task_id, i + 1, num_modules,
                        f"✗ Module {i + 1}: generation failed (continuing)"
                    )
                logger.warning(f"Step {i + 1}/{num_modules}: Failed to generate module")
            
            if i < num_modules - 1:
                if task_id and task_manager.is_cancelled(task_id):
                    break
                delay = task_manager.step_delay
                logger.info(f"Waiting {delay}s before next module (rate limit prevention)")
                for _ in range(delay):
                    if task_id and task_manager.is_cancelled(task_id):
                        break
                    time.sleep(1)
        
        status = ResponseStatus.SUCCESS if len(all_modules) == num_modules else (
            ResponseStatus.PARTIAL_SUCCESS if all_modules else ResponseStatus.ERROR
        )
        return AIResponse(
            status=status,
            data={"modules": all_modules},
            message=f"Generated {len(all_modules)} of {num_modules} modules step by step",
            provider_used=getattr(self.provider, 'current_provider', 'unknown'),
            generation_time=time.time() - start_time,
        ).to_dict()

    # =====================================================================
    # DEEP STEPWISE LESSON GENERATION
    # Generates a single lesson in multiple steps for maximum quality:
    #   Step 1: Generate detailed outline
    #   Steps 2-N: Generate each section individually
    #   Final step: Quality enhancement pass
    # Each step is a separate AI call with delays to avoid rate limits.
    # =====================================================================

    def generate_lesson_content_deep_stepwise(self, task_id: str = None,
                                               course_title: str = '',
                                               module_title: str = '',
                                               module_description: str = '',
                                               module_objectives: str = '',
                                               lesson_title: str = '',
                                               lesson_description: str = '',
                                               existing_lessons: Optional[List[Dict[str, Any]]] = None,
                                               course_context: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Deep multi-step lesson generation for highest quality content.
        
        Steps:
          1. Generate lesson outline (sections + structure)
          2-N. Generate each section individually with full context
          N+1. Quality enhancement pass (transitions, depth, cross-refs)
        """
        from .ai.task_manager import task_manager
        
        start_time = time.time()
        
        # ----- Step 1: Generate outline -----
        if task_id:
            task_manager.update_progress(task_id, 1, 3, "Step 1: Designing lesson outline and structure...")
        
        outline = self.lesson_gen.generate_lesson_deep_outline(
            course_title=course_title,
            module_title=module_title,
            module_description=module_description,
            module_objectives=module_objectives,
            lesson_title=lesson_title,
            lesson_description=lesson_description,
            existing_lessons=existing_lessons,
            course_context=course_context,
        )
        
        if not outline:
            if task_id:
                task_manager.complete_step(task_id, 1, 1, "✗ Failed to generate outline")
            return AIResponse(
                status=ResponseStatus.ERROR,
                message="Failed to generate lesson outline",
                generation_time=time.time() - start_time,
            ).to_dict()
        
        sections = outline.get('sections', [])
        total_steps = 1 + len(sections) + 1  # outline + each section + enhancement
        
        if task_id:
            task_manager.complete_step(task_id, 1, total_steps,
                f"✓ Outline ready: {outline.get('title', lesson_title)} ({len(sections)} sections)")
        
        logger.info(f"Deep outline: {outline.get('title')} — {len(sections)} sections planned")
        
        # ----- Steps 2-N: Generate each section -----
        all_sections_content = []
        accumulated_content = ""
        
        for idx, section in enumerate(sections):
            step_num = idx + 2
            
            if task_id and task_manager.is_cancelled(task_id):
                logger.info(f"Task cancelled at section {idx + 1}")
                break
            
            if task_id:
                task_manager.update_progress(
                    task_id, step_num, total_steps,
                    f"Step {step_num}: Writing \"{section.get('heading', f'Section {idx+1}')}\"..."
                )
            
            # Delay between AI calls
            if idx > 0:
                delay = task_manager.step_delay
                for _ in range(delay):
                    if task_id and task_manager.is_cancelled(task_id):
                        break
                    time.sleep(1)
            
            try:
                section_content = self.lesson_gen.generate_lesson_deep_section(
                    course_title=course_title,
                    module_title=module_title,
                    lesson_title=outline.get('title', lesson_title),
                    lesson_description=outline.get('description', lesson_description),
                    section=section,
                    previous_sections_content=accumulated_content,
                    course_context=course_context,
                )
            except Exception as e:
                logger.error(f"Section generation failed for '{section.get('heading')}': {e}")
                section_content = None
            
            if section_content:
                all_sections_content.append(section_content)
                accumulated_content += f"\n\n{section_content}"
                if task_id:
                    task_manager.complete_step(
                        task_id, step_num, total_steps,
                        f"✓ Section {idx + 1}/{len(sections)}: {section.get('heading', '')}"
                    )
                logger.info(f"Section {idx + 1}/{len(sections)} generated: {section.get('heading')}")
            else:
                if task_id:
                    task_manager.complete_step(
                        task_id, step_num, total_steps,
                        f"✗ Section {idx + 1}/{len(sections)}: failed (continuing)"
                    )
                logger.warning(f"Section {idx + 1}/{len(sections)} failed: {section.get('heading')}")
        
        if not all_sections_content:
            return AIResponse(
                status=ResponseStatus.ERROR,
                message="All section generations failed",
                generation_time=time.time() - start_time,
            ).to_dict()
        
        # ----- Final step: Quality enhancement -----
        final_step = total_steps
        
        if task_id:
            if task_manager.is_cancelled(task_id):
                logger.info("Task cancelled before enhancement step")
            else:
                task_manager.update_progress(
                    task_id, final_step, total_steps,
                    "Final step: Quality enhancement — improving transitions and depth..."
                )
        
        # Delay before final step
        delay = task_manager.step_delay
        for _ in range(delay):
            if task_id and task_manager.is_cancelled(task_id):
                break
            time.sleep(1)
        
        full_content = "\n\n".join(all_sections_content)
        
        # Enhancement pass
        enhancements = None
        if not (task_id and task_manager.is_cancelled(task_id)):
            try:
                enhancements = self.lesson_gen.generate_lesson_deep_enhance(
                    lesson_title=outline.get('title', lesson_title),
                    full_content=full_content,
                    learning_objectives=outline.get('learning_objectives', []),
                    course_context=course_context,
                    module_title=module_title,
                )
            except Exception as e:
                logger.warning(f"Enhancement pass failed (non-critical): {e}")
        
        # Apply enhancements to the full content
        if enhancements:
            additions = []
            for transition in enhancements.get('transition_additions', []):
                if transition.get('content'):
                    additions.append(transition['content'])
            for depth in enhancements.get('depth_additions', []):
                if depth.get('additional_content'):
                    additions.append(depth['additional_content'])
            if enhancements.get('cross_references'):
                additions.append(f"\n\n## Connections to Other Course Material\n\n{enhancements['cross_references']}")
            if enhancements.get('additional_examples'):
                additions.append(f"\n\n## Additional Real-World Examples\n\n{enhancements['additional_examples']}")
            if enhancements.get('reference_summary'):
                additions.append(f"\n\n## Quick Reference\n\n{enhancements['reference_summary']}")
            
            if additions:
                full_content += "\n\n" + "\n\n".join(additions)
                logger.info(f"Applied {len(additions)} enhancement additions")
        
        if task_id:
            task_manager.complete_step(
                task_id, final_step, total_steps,
                "✓ Quality enhancement complete"
            )
        
        # Build final result
        objectives = outline.get('learning_objectives', [])
        if isinstance(objectives, list):
            objectives_text = "\n".join(f"• {obj}" for obj in objectives)
        else:
            objectives_text = str(objectives)
        
        # Ensure we have a meaningful title — never use empty or generic fallback
        final_title = outline.get('title', '') or lesson_title
        if not final_title or final_title.strip().lower() in (
            'course lesson', 'lesson title', 'untitled', 'new lesson', 'lesson',
            'title', 'module lesson', 'sample lesson', 'specific lesson title'
        ):
            final_title = self.lesson_gen._generate_meaningful_title(
                module_title, course_title, existing_lessons
            )
            logger.info(f"Replaced generic/empty deep stepwise title with: {final_title}")
        
        result_data = {
            "title": final_title,
            "description": outline.get('description', lesson_description),
            "learning_objectives": objectives_text,
            "duration_minutes": outline.get('duration_minutes', 60),
            "content_type": "text",
            "content_data": full_content,
            "generation_method": "deep_stepwise",
            "sections_generated": len(all_sections_content),
            "sections_planned": len(sections),
            "enhanced": enhancements is not None,
        }
        
        status = ResponseStatus.SUCCESS if len(all_sections_content) == len(sections) else ResponseStatus.PARTIAL_SUCCESS
        
        return AIResponse(
            status=status,
            data=result_data,
            message=f"Deep lesson generated: {len(all_sections_content)}/{len(sections)} sections, "
                    f"{'with' if enhancements else 'without'} enhancement pass",
            provider_used=getattr(self.provider, 'current_provider', 'unknown'),
            generation_time=time.time() - start_time,
        ).to_dict()

    # =====================================================================
    # DEEP STEPWISE CONTENT ENHANCEMENT
    # Enhances existing lesson content in multiple steps:
    #   Step 1: Analyze content + identify gaps vs course structure
    #   Step 2: Expand weak sections with more detail
    #   Step 3: Add unique examples and cross-references
    # =====================================================================

    def enhance_lesson_content_stepwise(self, task_id: str = None,
                                         content_type: str = 'lesson',
                                         current_content: str = '',
                                         enhancement_type: str = 'improve',
                                         course_title: str = '',
                                         module_title: str = '',
                                         lesson_title: str = '',
                                         course_context: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Multi-step content enhancement with cross-reference awareness.
        
        Steps:
          1. Analyze: identify gaps, duplications, and weak sections
          2. Enhance: expand and improve the content
          3. Cross-reference: add connections to other course material
        """
        from .ai.task_manager import task_manager
        
        start_time = time.time()
        total_steps = 3
        
        # Build course context text for prompts
        course_ctx = ""
        if course_context:
            course_ctx = "\n\n===== FULL COURSE STRUCTURE (for cross-reference) ====="
            for mod in course_context:
                is_current = mod.get('title', '') == module_title
                marker = " ← CURRENT MODULE" if is_current else ""
                course_ctx += f"\n\nModule {mod.get('order', '?')}: {mod.get('title', 'Untitled')}{marker}"
                for les in mod.get('lessons', []):
                    course_ctx += f"\n  - Lesson: {les.get('title', 'Untitled')}"
                    if les.get('content_summary'):
                        course_ctx += f" — Topics: {les['content_summary'][:150]}"
        
        # ----- Step 1: Analysis -----
        if task_id:
            task_manager.update_progress(task_id, 1, total_steps,
                "Step 1: Analyzing content quality and identifying gaps...")
        
        analysis_prompt = f"""You are a senior academic content analyst. Analyze this {content_type} content and identify specific improvements.

Content Type: {content_type}
Enhancement Goal: {enhancement_type}
Course: {course_title}
Module: {module_title}
Lesson: {lesson_title}
{course_ctx}

===== CURRENT CONTENT =====
{current_content[:5000]}
===== END CONTENT =====

Analyze and return ONLY valid JSON:
{{
  "quality_score": 75,
  "word_count": 2500,
  "weak_sections": ["section heading 1 — reason it's weak", "section heading 2 — reason"],
  "missing_topics": ["topic that should be covered but isn't"],
  "duplications_with_other_lessons": ["topic X overlaps with Module Y Lesson Z"],
  "improvement_priorities": [
    "Priority 1: What to fix first",
    "Priority 2: Second priority",
    "Priority 3: Third priority"
  ],
  "sections_to_expand": ["section heading that needs 200+ more words"],
  "examples_needed": ["topic that needs a practical example"]
}}"""

        try:
            analysis_result, _ = self.provider.make_ai_request(analysis_prompt, temperature=0.4, max_tokens=2048)
            analysis = json_parser.parse_json_response(analysis_result, "content analysis") if analysis_result else None
        except Exception as e:
            logger.warning(f"Analysis step failed: {e}")
            analysis = None
        
        if task_id:
            issues_found = len(analysis.get('improvement_priorities', [])) if analysis else 0
            task_manager.complete_step(task_id, 1, total_steps,
                f"✓ Analysis complete: {issues_found} improvement areas identified")
        
        # Delay
        delay = task_manager.step_delay
        for _ in range(delay):
            if task_id and task_manager.is_cancelled(task_id):
                break
            time.sleep(1)
        
        # ----- Step 2: Enhance content -----
        if task_id and task_manager.is_cancelled(task_id):
            return AIResponse(
                status=ResponseStatus.CANCELLED if hasattr(ResponseStatus, 'CANCELLED') else ResponseStatus.ERROR,
                message="Enhancement cancelled",
                generation_time=time.time() - start_time,
            ).to_dict()
        
        if task_id:
            task_manager.update_progress(task_id, 2, total_steps,
                "Step 2: Enhancing content with more detail and examples...")
        
        enhancements = {
            "improve": "Improve clarity, depth, structure, and professional quality. Make it professor-level.",
            "expand": "Significantly expand with more detail, examples, data, case studies. Double the depth.",
            "simplify": "Simplify language while adding more practical examples. Keep technical accuracy.",
            "add_examples": "Add 3-5 detailed real-world examples with specific companies, data, and step-by-step solutions."
        }
        enhancement_instruction = enhancements.get(enhancement_type, enhancements["improve"])
        
        analysis_context = ""
        if analysis:
            analysis_context = f"""

Based on the analysis, these are the priority improvements:
{chr(10).join(f'- {p}' for p in analysis.get('improvement_priorities', []))}

Sections to expand: {', '.join(analysis.get('sections_to_expand', ['general']))}
Missing topics: {', '.join(analysis.get('missing_topics', ['none identified']))}
Examples needed: {', '.join(analysis.get('examples_needed', ['general examples']))}

IMPORTANT: These topics overlap with other lessons — DO NOT expand on them:
{chr(10).join(f'- {d}' for d in analysis.get('duplications_with_other_lessons', ['none detected']))}"""
        
        enhance_prompt = f"""You are an expert professor and academic editor. {enhancement_instruction}

Course: {course_title}
Module: {module_title}
Lesson: {lesson_title}
{course_ctx}{analysis_context}

===== CURRENT CONTENT =====
{current_content[:6000]}
===== END CONTENT =====

REQUIREMENTS:
1. Return the COMPLETE enhanced content (not just the changes)
2. Maintain the same overall structure and markdown formatting
3. Add at least 30% more substantive content (specific data, examples, explanations)
4. Do NOT add content that duplicates other lessons in the course
5. Reference connections to other modules where natural
6. Use proper markdown: ## headers, **bold**, `code`, lists, tables, blockquotes
7. Write as a professor teaching — be thorough and detailed

Return ONLY the enhanced markdown content (no JSON wrapper, no explanation)."""
        
        try:
            enhanced_content, provider = self.provider.make_ai_request(enhance_prompt, temperature=0.7, max_tokens=8192)
        except Exception as e:
            logger.error(f"Enhancement step failed: {e}")
            enhanced_content = None
        
        if not enhanced_content or len(enhanced_content.strip()) < len(current_content) * 0.5:
            # Enhancement failed or returned less content — use original
            enhanced_content = current_content
            enhancement_applied = False
        else:
            enhanced_content = enhanced_content.strip()
            enhancement_applied = True
        
        if task_id:
            task_manager.complete_step(task_id, 2, total_steps,
                f"✓ Content {'enhanced' if enhancement_applied else 'unchanged (enhancement had limited effect)'}")
        
        # Delay
        for _ in range(delay):
            if task_id and task_manager.is_cancelled(task_id):
                break
            time.sleep(1)
        
        # ----- Step 3: Cross-reference additions -----
        if task_id and task_manager.is_cancelled(task_id):
            return AIResponse(
                status=ResponseStatus.ERROR,
                data={"enhanced_content": enhanced_content},
                message="Enhancement cancelled after step 2",
                generation_time=time.time() - start_time,
            ).to_dict()
        
        if task_id:
            task_manager.update_progress(task_id, 3, total_steps,
                "Step 3: Adding cross-references and final polish...")
        
        if course_context and len(course_context) > 1:
            cross_ref_prompt = f"""Add brief cross-reference notes to this lesson content. 
Add 2-3 short callout boxes (using markdown blockquotes > ) that reference related content in other modules.

Course Structure:
{course_ctx}

Current Lesson: {lesson_title} in Module: {module_title}

Return ONLY 2-3 callout boxes in markdown format like:
> **📌 Connection**: This topic relates to [specific topic] covered in [Module X: Lesson Y]. Together, they provide...

Keep each callout under 50 words. Return ONLY the callout boxes, not the full content."""
            
            try:
                cross_refs, _ = self.provider.make_ai_request(cross_ref_prompt, temperature=0.5, max_tokens=1024)
                if cross_refs and cross_refs.strip():
                    enhanced_content += f"\n\n---\n\n## Related Course Material\n\n{cross_refs.strip()}"
            except Exception as e:
                logger.warning(f"Cross-reference step failed (non-critical): {e}")
        
        if task_id:
            task_manager.complete_step(task_id, 3, total_steps, "✓ Cross-references and polish complete")
        
        return AIResponse(
            status=ResponseStatus.SUCCESS if enhancement_applied else ResponseStatus.PARTIAL_SUCCESS,
            data={
                "enhanced_content": enhanced_content,
                "analysis": analysis,
                "enhancement_applied": enhancement_applied,
            },
            message=f"Content enhanced in 3 steps ({enhancement_type})",
            provider_used=getattr(self.provider, 'current_provider', 'unknown'),
            generation_time=time.time() - start_time,
        ).to_dict()

    # =====================================================================
    # DEEP STEPWISE MULTIPLE LESSONS GENERATION  
    # Improved version that passes cross-module context and content summaries
    # =====================================================================

    def generate_multiple_lessons_deep_stepwise(self, task_id: str = None,
                                                 course_title: str = '',
                                                 module_title: str = '',
                                                 module_description: str = '',
                                                 module_objectives: str = '',
                                                 num_lessons: int = 5,
                                                 existing_lessons: Optional[List[Dict[str, Any]]] = None,
                                                 course_context: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Enhanced step-by-step lesson generation with cross-module context.
        
        Each lesson is generated individually. After each lesson, its content summary
        is added to the context for the next lesson, preventing duplication.
        """
        from .ai.task_manager import task_manager
        
        all_lessons = []
        accumulated_context = list(existing_lessons or [])
        start_time = time.time()
        
        for i in range(num_lessons):
            if task_id and task_manager.is_cancelled(task_id):
                logger.info(f"Task {task_id[:8]}... cancelled at step {i + 1}")
                break
            
            lesson_num = len(accumulated_context) + 1
            
            if task_id:
                task_manager.update_progress(
                    task_id, i + 1, num_lessons,
                    f"Generating lesson {i + 1} of {num_lessons} (with cross-module context)..."
                )
            
            try:
                result = self.lesson_gen.generate_lesson_content(
                    course_title=course_title,
                    module_title=module_title,
                    module_description=module_description,
                    module_objectives=module_objectives,
                    lesson_title="",
                    lesson_description="",
                    existing_lessons=accumulated_context,
                    course_context=course_context,
                )
            except Exception as e:
                logger.error(f"Lesson step {i + 1} failed: {e}")
                result = None
            
            if result and isinstance(result, dict):
                result['order'] = lesson_num
                
                # Validate title — replace generic titles with meaningful ones
                result_title = result.get('title', '')
                if self.lesson_gen._is_generic_title(result_title):
                    result['title'] = self.lesson_gen._generate_meaningful_title(
                        module_title, course_title, accumulated_context, lesson_num
                    )
                    logger.info(f"Replaced generic batch title with: {result['title']}")
                
                all_lessons.append(result)
                
                # Build a content summary from the generated content for future context
                content_data = result.get('content_data', '')
                # Extract key topics from headers
                import re
                headers = re.findall(r'^##\s+(.+)$', content_data, re.MULTILINE)
                content_summary = "; ".join(headers[:6]) if headers else content_data[:200]
                
                accumulated_context.append({
                    'title': result.get('title', f'Lesson {lesson_num}'),
                    'description': result.get('description', ''),
                    'order': lesson_num,
                    'duration_minutes': result.get('duration_minutes', 45),
                    'content_summary': content_summary,
                })
                if task_id:
                    task_manager.complete_step(
                        task_id, i + 1, num_lessons,
                        f"✓ Lesson {i + 1}: {result.get('title', f'Lesson {lesson_num}')}"
                    )
                logger.info(f"Step {i + 1}/{num_lessons}: Generated '{result.get('title', 'unknown')}'")
            else:
                if task_id:
                    task_manager.complete_step(
                        task_id, i + 1, num_lessons,
                        f"✗ Lesson {i + 1}: generation failed (continuing)"
                    )
                logger.warning(f"Step {i + 1}/{num_lessons}: Failed to generate lesson")
            
            # Delay between steps
            if i < num_lessons - 1:
                if task_id and task_manager.is_cancelled(task_id):
                    break
                delay = task_manager.step_delay
                logger.info(f"Waiting {delay}s before next lesson (rate limit prevention)")
                for _ in range(delay):
                    if task_id and task_manager.is_cancelled(task_id):
                        break
                    time.sleep(1)
        
        status = ResponseStatus.SUCCESS if len(all_lessons) == num_lessons else (
            ResponseStatus.PARTIAL_SUCCESS if all_lessons else ResponseStatus.ERROR
        )
        return AIResponse(
            status=status,
            data={"lessons": all_lessons},
            message=f"Generated {len(all_lessons)} of {num_lessons} lessons with cross-module context",
            provider_used=getattr(self.provider, 'current_provider', 'unknown'),
            generation_time=time.time() - start_time,
        ).to_dict()


# Enhanced singleton instance
ai_agent_service = AIAgentService()
