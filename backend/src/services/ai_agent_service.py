"""
AI Agent Service for Afritec Bridge LMS

This is the main facade that provides a unified interface to all AI services.
It delegates to specialized modules for:
- Provider management (OpenRouter and Gemini)
- Course and module generation
- Lesson generation (basic, comprehensive, task-based, chapter-based)
- Assessment generation (quizzes, assignments, projects)
- Content validation and enhancement

Uses OpenRouter AI (primary) and Google Gemini (fallback) for course content generation.
"""

import logging
from typing import Dict, List, Optional, Any, Tuple, Callable, Generator

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

logger = logging.getLogger(__name__)


class AIAgentService:
    """
    Unified service facade for AI-assisted course content generation.
    
    This class provides a clean interface to all AI generation capabilities
    while delegating to specialized modules for the actual implementation.
    
    Modules:
        - ai_providers: Handles API connections, rate limiting, caching
        - course_generator: Generates course outlines and modules
        - lesson_generator: Generates lesson content
        - comprehensive_lesson_generator: Step-by-step validated lesson generation
        - task_based_lesson_generator: Multi-task deep lesson generation
        - chapter_based_generator: Chapter-by-chapter deep lesson generation
        - assessment_generator: Generates quizzes, assignments, projects
        - content_validator: Validates and enhances content quality
    """
    
    def __init__(self):
        """Initialize AI Agent Service with all sub-components"""
        self.provider = ai_provider_manager
        self.course_gen = course_generator
        self.lesson_gen = lesson_generator
        self.comprehensive_gen = comprehensive_lesson_generator
        self.task_based_gen = task_based_lesson_generator
        self.chapter_gen = chapter_based_generator
        self.assessment_gen = assessment_generator
        self.content_enhancer = ContentEnhancer(ai_provider_manager)
        
        logger.info("AIAgentService initialized with modular components")
    
    # ===== Provider Management =====
    
    def get_provider_stats(self) -> Dict[str, Any]:
        """Get statistics about AI provider usage and performance"""
        return self.provider.get_provider_stats()
    
    def reset_provider_failures(self, provider: str = None):
        """Reset failure counts for a provider or all providers"""
        self.provider.reset_provider_failures(provider)
    
    def clear_cache(self):
        """Clear the response cache"""
        self.provider.clear_cache()
    
    def force_provider(self, provider: str):
        """Force use of a specific provider ('openrouter' or 'gemini')"""
        self.provider.force_provider(provider)
    
    # ===== Course Generation =====
    
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
        return self.course_gen.generate_course_outline(topic, target_audience, learning_objectives)
    
    def generate_multiple_modules(self, course_title: str, course_description: str,
                                  course_objectives: str, num_modules: int = 5,
                                  existing_modules: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """Generate multiple module outlines at once for a course"""
        return self.course_gen.generate_multiple_modules(
            course_title, course_description, course_objectives, num_modules, existing_modules
        )
    
    def generate_module_content(self, course_title: str, course_description: str,
                               course_objectives: str, module_title: str = "",
                               existing_modules: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """Generate module details based on course context"""
        return self.course_gen.generate_module_content(
            course_title, course_description, course_objectives, module_title, existing_modules
        )
    
    # ===== Lesson Generation =====
    
    def generate_lesson_content(self, course_title: str, module_title: str,
                               module_description: str, module_objectives: str,
                               lesson_title: str = "", lesson_description: str = "",
                               existing_lessons: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """Generate detailed lesson content with markdown formatting"""
        return self.lesson_gen.generate_lesson_content(
            course_title, module_title, module_description, module_objectives,
            lesson_title, lesson_description, existing_lessons
        )
    
    def generate_multiple_lessons(self, course_title: str, module_title: str,
                                  module_description: str, module_objectives: str,
                                  num_lessons: int = 5,
                                  existing_lessons: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """Generate multiple lesson outlines at once for a module"""
        return self.lesson_gen.generate_multiple_lessons(
            course_title, module_title, module_description, module_objectives,
            num_lessons, existing_lessons
        )
    
    def generate_mixed_content(self, course_title: str, module_title: str,
                              module_description: str, lesson_title: str,
                              lesson_description: str = "",
                              template_id: Optional[str] = None,
                              existing_sections: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """Generate mixed content lesson with intelligent template-aware structure"""
        return self.lesson_gen.generate_mixed_content(
            course_title, module_title, module_description, lesson_title,
            lesson_description, template_id, existing_sections
        )
    
    def generate_lesson_section(self, lesson_title: str, section_type: str,
                               section_context: Dict[str, Any],
                               difficulty_level: str = "intermediate") -> str:
        """Generate a specific section of a lesson"""
        return self.lesson_gen.generate_lesson_section(
            lesson_title, section_type, section_context, difficulty_level
        )
    
    # ===== Comprehensive Lesson Generation =====
    
    def generate_comprehensive_lesson_step_by_step(self, course_title: str, module_title: str,
                                                   module_description: str, module_objectives: str,
                                                   lesson_title: str, lesson_description: str = "",
                                                   difficulty_level: str = "intermediate",
                                                   existing_lessons: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """Generate a comprehensive, professor-level lesson in multiple steps"""
        return self.comprehensive_gen.generate_comprehensive_lesson_step_by_step(
            course_title, module_title, module_description, module_objectives,
            lesson_title, lesson_description, difficulty_level, existing_lessons
        )
    
    def generate_comprehensive_lesson_with_validation(self, course_title: str, module_title: str,
                                                      module_description: str, module_objectives: str,
                                                      lesson_title: str, lesson_description: str = "",
                                                      difficulty_level: str = "intermediate",
                                                      existing_lessons: Optional[List[Dict[str, Any]]] = None,
                                                      progress_callback: Optional[Callable] = None) -> Dict[str, Any]:
        """Generate a comprehensive lesson with validation at each step"""
        return self.comprehensive_gen.generate_comprehensive_lesson_with_validation(
            course_title, module_title, module_description, module_objectives,
            lesson_title, lesson_description, difficulty_level, existing_lessons, progress_callback
        )
    
    # ===== Task-Based Deep Lesson Generation =====
    
    def generate_lesson_with_tasks(self, course_title: str, module_title: str,
                                   module_description: str, module_objectives: str,
                                   lesson_title: str, lesson_description: str = "",
                                   difficulty_level: str = "intermediate",
                                   existing_lessons: Optional[List[Dict[str, Any]]] = None,
                                   depth_level: str = "comprehensive",
                                   progress_callback: Optional[Callable] = None,
                                   parallel: bool = True) -> Dict[str, Any]:
        """
        Generate a comprehensive lesson using a multi-task approach.
        
        This is the most advanced lesson generation method that breaks down
        content creation into discrete tasks (research, planning, generation,
        enhancement, validation) for maximum depth and quality.
        
        Args:
            course_title: Parent course title
            module_title: Parent module title
            module_description: Module description for context
            module_objectives: Module learning objectives
            lesson_title: Lesson title
            lesson_description: Brief lesson description
            difficulty_level: 'beginner', 'intermediate', or 'advanced'
            existing_lessons: List of existing lessons for context
            depth_level: How deep to go:
                - 'basic' (~5 tasks): Quick generation, essential content only
                - 'standard' (~12 tasks): Good balance of speed and depth
                - 'comprehensive' (~20 tasks): Full coverage with enhancements
                - 'expert' (~30+ tasks): Maximum depth with research, case studies
            progress_callback: Callback for progress updates (step, total, status, message)
            parallel: Whether to execute independent tasks in parallel
            
        Returns:
            Dict with complete lesson content, sections, and detailed generation report
        """
        return self.task_based_gen.generate_lesson_with_tasks(
            course_title, module_title, module_description, module_objectives,
            lesson_title, lesson_description, difficulty_level, existing_lessons,
            depth_level, progress_callback, parallel
        )
    
    def generate_deep_lesson(self, course_title: str, module_title: str,
                            module_description: str, module_objectives: str,
                            lesson_title: str, lesson_description: str = "",
                            difficulty_level: str = "intermediate",
                            existing_lessons: Optional[List[Dict[str, Any]]] = None,
                            progress_callback: Optional[Callable] = None) -> Dict[str, Any]:
        """
        Alias for generate_lesson_with_tasks with 'comprehensive' depth.
        
        This is a convenience method for generating professor-level lessons
        with full research, planning, and enhancement phases.
        """
        return self.task_based_gen.generate_lesson_with_tasks(
            course_title, module_title, module_description, module_objectives,
            lesson_title, lesson_description, difficulty_level, existing_lessons,
            depth_level="comprehensive", progress_callback=progress_callback
        )
    
    def generate_expert_lesson(self, course_title: str, module_title: str,
                              module_description: str, module_objectives: str,
                              lesson_title: str, lesson_description: str = "",
                              difficulty_level: str = "intermediate",
                              existing_lessons: Optional[List[Dict[str, Any]]] = None,
                              progress_callback: Optional[Callable] = None) -> Dict[str, Any]:
        """
        Generate the most detailed lesson possible with 30+ tasks.
        
        This includes:
        - Full research phase with topic analysis and concept mapping
        - Detailed planning with learning path design
        - Comprehensive content generation with all sub-sections
        - Enhancement phase with analogies and visual descriptions
        - Validation phase with quality assurance
        """
        return self.task_based_gen.generate_lesson_with_tasks(
            course_title, module_title, module_description, module_objectives,
            lesson_title, lesson_description, difficulty_level, existing_lessons,
            depth_level="expert", progress_callback=progress_callback
        )
    
    # ===== Chapter-Based Lesson Generation =====
    
    def create_chapter_session(
        self,
        course_title: str,
        module_title: str,
        module_description: str,
        module_objectives: str,
        lesson_title: str,
        lesson_description: str = "",
        difficulty_level: str = "intermediate",
        existing_lessons: Optional[List[Dict[str, Any]]] = None,
        target_chapters: int = 5,
        chapter_depth: str = "deep"
    ) -> str:
        """
        Create a chapter-based lesson generation session.
        
        This approach:
        1. First outlines lesson chapters dynamically
        2. Works on each chapter as a separate task
        3. Goes deep into each chapter with subsections
        4. Generates content incrementally
        
        Args:
            target_chapters: Target number of chapters (AI may adjust)
            chapter_depth: 'shallow', 'standard', or 'deep'
            
        Returns:
            Session ID for tracking and resumption
        """
        return self.chapter_gen.create_session(
            course_title, module_title, module_description, module_objectives,
            lesson_title, lesson_description, difficulty_level, existing_lessons,
            target_chapters, chapter_depth
        )
    
    def outline_lesson_chapters(
        self,
        session_id: str,
        progress_callback: Optional[Callable] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate chapter outlines for a lesson.
        First step in chapter-based generation.
        
        Returns:
            List of chapter outlines with titles, descriptions, objectives
        """
        outlines = self.chapter_gen.outline_chapters(session_id, progress_callback)
        return [o.to_dict() for o in outlines]
    
    def generate_chapter(
        self,
        session_id: str,
        chapter_id: str,
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Generate content for a single chapter.
        Call this for each chapter after outlining.
        
        Returns:
            Complete chapter content with subsections, examples, exercises
        """
        content = self.chapter_gen.generate_chapter(session_id, chapter_id, progress_callback)
        return content.to_dict()
    
    def generate_lesson_by_chapters(
        self,
        course_title: str,
        module_title: str,
        module_description: str,
        module_objectives: str,
        lesson_title: str,
        lesson_description: str = "",
        difficulty_level: str = "intermediate",
        existing_lessons: Optional[List[Dict[str, Any]]] = None,
        target_chapters: int = 5,
        chapter_depth: str = "deep",
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Generate a complete lesson using chapter-by-chapter approach.
        
        This is the most thorough lesson generation method:
        1. Analyzes the topic and determines optimal chapter structure
        2. Creates detailed outline with learning objectives per chapter
        3. Generates each chapter with deep content, examples, exercises
        4. Builds lesson progressively, chapter by chapter
        
        Args:
            target_chapters: Target number of chapters (5 recommended)
            chapter_depth: 'shallow', 'standard', or 'deep'
            
        Returns:
            Complete lesson with all chapters and generation report
        """
        return self.chapter_gen.generate_lesson(
            course_title, module_title, module_description, module_objectives,
            lesson_title, lesson_description, difficulty_level, existing_lessons,
            target_chapters, chapter_depth, progress_callback
        )
    
    def get_chapter_session_status(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a chapter-based generation session"""
        return self.chapter_gen.get_session_status(session_id)
    
    # ===== Assessment Generation =====
    
    def generate_quiz_questions(self, course_title: str, module_title: str,
                               lesson_title: str, lesson_content: str,
                               num_questions: int = 5,
                               question_types: Optional[List[str]] = None) -> Dict[str, Any]:
        """Generate quiz questions based on lesson content"""
        return self.assessment_gen.generate_quiz_questions(
            course_title, module_title, lesson_title, lesson_content,
            num_questions, question_types
        )
    
    def generate_quiz_from_content(self, lesson_or_module_content: str, 
                                   content_title: str, content_type: str = "lesson",
                                   num_questions: int = 10, difficulty: str = "mixed") -> Dict[str, Any]:
        """Generate a quiz based on actual lesson or module content"""
        return self.assessment_gen.generate_quiz_from_content(
            lesson_or_module_content, content_title, content_type, num_questions, difficulty
        )
    
    def generate_assignment(self, course_title: str, module_title: str,
                          module_description: str, lessons_summary: str) -> Dict[str, Any]:
        """Generate assignment based on module content"""
        return self.assessment_gen.generate_assignment(
            course_title, module_title, module_description, lessons_summary
        )
    
    def generate_assignment_from_content(self, lesson_or_module_content: str,
                                        content_title: str, content_type: str = "lesson",
                                        assignment_type: str = "practical") -> Dict[str, Any]:
        """Generate an assignment based on actual lesson or module content"""
        return self.assessment_gen.generate_assignment_from_content(
            lesson_or_module_content, content_title, content_type, assignment_type
        )
    
    def generate_final_project(self, course_title: str, course_description: str,
                              course_objectives: str, modules_summary: str) -> Dict[str, Any]:
        """Generate capstone project for entire course"""
        return self.assessment_gen.generate_final_project(
            course_title, course_description, course_objectives, modules_summary
        )
    
    def generate_project_from_content(self, module_contents: List[Dict[str, str]],
                                     module_title: str, course_title: str) -> Dict[str, Any]:
        """Generate a project based on multiple lessons/modules content"""
        return self.assessment_gen.generate_project_from_content(
            module_contents, module_title, course_title
        )
    
    # ===== Content Enhancement =====
    
    def enhance_content(self, content_type: str, current_content: str,
                       enhancement_type: str = "improve") -> str:
        """Enhance existing content (improve clarity, add examples, expand, etc.)"""
        return self.content_enhancer.enhance_content(content_type, current_content, enhancement_type)
    
    def enhance_section_content(self, section_type: str, section_content: str,
                               context: Dict[str, Any]) -> Dict[str, Any]:
        """Enhance a specific section of mixed content using AI"""
        return self.content_enhancer.enhance_section_content(section_type, section_content, context)
    
    # ===== Internal Methods (kept for backward compatibility) =====
    
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


# Singleton instance for backward compatibility
ai_agent_service = AIAgentService()
