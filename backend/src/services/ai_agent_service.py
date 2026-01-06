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

logger = logging.getLogger(__name__)


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
                                    *args, **kwargs) -> AIResponse:
        """Execute generation with retry logic, caching, and quality validation"""
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
                    # Validate content quality
                    quality_score = self._assess_content_quality(result)
                    
                    if quality_score >= self.quality_threshold:
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
                        logger.warning(f"Content quality below threshold: {quality_score} < {self.quality_threshold}")
                        if attempt == self.retry_attempts - 1:
                            # Last attempt - return with partial success
                            return AIResponse(
                                status=ResponseStatus.PARTIAL_SUCCESS,
                                data=result,
                                message=f"Content generated but quality below threshold ({quality_score:.2f})",
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
                elif content.get('suggested_lessons'):
                    content_type = ContentType.MODULE_CONTENT
                elif content.get('content') and len(str(content.get('content', ''))) > 100:
                    content_type = ContentType.LESSON_CONTENT
                else:
                    content_type = ContentType.MIXED_CONTENT
                
                # Use enhanced content validator
                validation_result = enhanced_content_validator.validate_content_comprehensive(
                    content, content_type
                )
                
                logger.info(f"Enhanced quality assessment: {validation_result.overall_score:.2f} (valid: {validation_result.is_valid})")
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
        
        # Content depth checks
        if isinstance(content.get('suggested_modules'), list) and len(content['suggested_modules']) > 0:
            score += 0.15
        elif isinstance(content.get('suggested_lessons'), list) and len(content['suggested_lessons']) > 0:
            score += 0.15
        elif content.get('content') and len(str(content.get('content', ''))) > 200:
            score += 0.15
        
        logger.debug(f"Basic quality score: {score:.2f}")
        return min(1.0, score)
    
    def generate_course_outline(self, topic: str, target_audience: str = "", 
                               learning_objectives: str = "") -> AIResponse:
        """
        Generate a complete course outline with enhanced error handling and caching
        
        Returns:
            AIResponse with standardized format
        """
        cache_key = f"course_outline_{topic}_{target_audience}_{learning_objectives}"
        
        return self._execute_with_retry_and_cache(
            cache_key,
            self.course_gen.generate_course_outline,
            topic, target_audience, learning_objectives
        )

    def generate_multiple_modules(self, course_title: str, course_description: str,
                                  course_objectives: str, num_modules: int = 5,
                                  existing_modules: Optional[List[Dict[str, Any]]] = None) -> AIResponse:
        """Generate multiple module outlines with enhanced handling"""
        cache_key = f"modules_{course_title}_{num_modules}_{len(existing_modules or [])}"
        
        return self._execute_with_retry_and_cache(
            cache_key,
            self.course_gen.generate_multiple_modules,
            course_title, course_description, course_objectives, num_modules, existing_modules
        )

    def generate_module_content(self, course_title: str, course_description: str,
                               course_objectives: str, module_title: str = "",
                               existing_modules: Optional[List[Dict[str, Any]]] = None) -> AIResponse:
        """Generate module details with enhanced handling"""
        cache_key = f"module_{course_title}_{module_title}_{len(existing_modules or [])}"
        
        return self._execute_with_retry_and_cache(
            cache_key,
            self.course_gen.generate_module_content,
            course_title, course_description, course_objectives, module_title, existing_modules
        )
    
    # ===== Enhanced Lesson Generation =====
    
    def generate_lesson_content(self, course_title: str, module_title: str,
                               module_description: str, module_objectives: str,
                               lesson_title: str = "", lesson_description: str = "",
                               existing_lessons: Optional[List[Dict[str, Any]]] = None) -> AIResponse:
        """Generate detailed lesson content with enhanced handling"""
        cache_key = f"lesson_{course_title}_{module_title}_{lesson_title}_{len(existing_lessons or [])}"
        
        return self._execute_with_retry_and_cache(
            cache_key,
            self.lesson_gen.generate_lesson_content,
            course_title, module_title, module_description, module_objectives,
            lesson_title, lesson_description, existing_lessons
        )
    
    def generate_multiple_lessons(self, course_title: str, module_title: str,
                                  module_description: str, module_objectives: str,
                                  num_lessons: int = 5,
                                  existing_lessons: Optional[List[Dict[str, Any]]] = None) -> AIResponse:
        """Generate multiple lesson outlines with enhanced handling"""
        cache_key = f"lessons_{course_title}_{module_title}_{num_lessons}_{len(existing_lessons or [])}"
        
        return self._execute_with_retry_and_cache(
            cache_key,
            self.lesson_gen.generate_multiple_lessons,
            course_title, module_title, module_description, module_objectives,
            num_lessons, existing_lessons
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


# Enhanced singleton instance
ai_agent_service = AIAgentService()
