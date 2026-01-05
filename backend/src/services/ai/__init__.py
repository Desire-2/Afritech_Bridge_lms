"""
AI Services Package for Afritec Bridge LMS

This package contains modular AI services for:
- Provider management (OpenRouter and Gemini)
- Course and module generation
- Lesson generation (basic, comprehensive, task-based, chapter-based)
- Assessment generation (quizzes, assignments, projects)
- Content validation and enhancement
"""

from .ai_providers import AIProviderManager, ai_provider_manager
from .json_parser import JSONResponseParser, json_parser
from .course_generator import CourseGenerator, course_generator
from .lesson_generator import LessonGenerator, lesson_generator
from .comprehensive_lesson_generator import ComprehensiveLessonGenerator, comprehensive_lesson_generator
from .task_based_lesson_generator import TaskBasedLessonGenerator, task_based_lesson_generator
from .chapter_based_lesson_generator import ChapterBasedLessonGenerator, chapter_based_generator
from .assessment_generator import AssessmentGenerator, assessment_generator
from .content_validator import ContentValidator, ContentEnhancer, content_validator
from .fallback_generators import FallbackGenerators, fallback_generators

__all__ = [
    # Provider Management
    'AIProviderManager',
    'ai_provider_manager',
    
    # JSON Parsing
    'JSONResponseParser',
    'json_parser',
    
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
    
    # Content Validation
    'ContentValidator',
    'ContentEnhancer',
    'content_validator',
    
    # Fallback Generators
    'FallbackGenerators',
    'fallback_generators',
]
