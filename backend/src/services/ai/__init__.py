"""
AI Services Package for Afritec Bridge LMS

Enhanced AI services with:
- Provider management with intelligent failover
- Course and module generation with quality validation
- Lesson generation (basic, comprehensive, task-based, chapter-based)
- Assessment generation with educational value scoring
- Enhanced content validation and quality assessment
- Smart caching and response handling
"""

from .ai_providers import AIProviderManager, ai_provider_manager
from .json_parser import JSONResponseParser, json_parser
from .enhanced_json_parser import EnhancedJSONParser, enhanced_json_parser
from .course_generator import CourseGenerator, course_generator
from .lesson_generator import LessonGenerator, lesson_generator
from .comprehensive_lesson_generator import ComprehensiveLessonGenerator, comprehensive_lesson_generator
from .task_based_lesson_generator import TaskBasedLessonGenerator, task_based_lesson_generator
from .chapter_based_lesson_generator import ChapterBasedLessonGenerator, chapter_based_generator
from .assessment_generator import AssessmentGenerator, assessment_generator
from .content_validator import ContentValidator, ContentEnhancer, content_validator
from .enhanced_content_validator import EnhancedContentValidator, enhanced_content_validator, ContentType, QualityAspect
from .fallback_generators import FallbackGenerators, fallback_generators
from .task_manager import BackgroundTaskManager, task_manager

__all__ = [
    # Provider Management
    'AIProviderManager',
    'ai_provider_manager',
    
    # JSON Parsing (Original + Enhanced)
    'JSONResponseParser',
    'json_parser',
    'EnhancedJSONParser', 
    'enhanced_json_parser',
    
    # Course Generation
    'CourseGenerator',
    'course_generator',
    
    # Lesson Generation
    'LessonGenerator',
    'lesson_generator',
    'ComprehensiveLessonGenerator',
    'comprehensive_lesson_generator',
    'TaskBasedLessonGenerator',
    'task_based_lesson_generator',
    'ChapterBasedLessonGenerator',
    'chapter_based_generator',
    
    # Assessment Generation
    'AssessmentGenerator',
    'assessment_generator',
    
    # Content Validation (Original + Enhanced)
    'ContentValidator',
    'ContentEnhancer',
    'content_validator',
    'EnhancedContentValidator',
    'enhanced_content_validator',
    'ContentType',
    'QualityAspect',
    'ContentValidator',
    'ContentEnhancer',
    'content_validator',
    
    # Fallback Generators
    'FallbackGenerators',
    'fallback_generators',
    
    # Background Task Manager
    'BackgroundTaskManager',
    'task_manager',
]
