"""
Course and Module Generation Module
Handles AI-powered generation of course outlines and module content
"""

import logging
from typing import Dict, List, Optional, Any

from .ai_providers import ai_provider_manager
from .json_parser import json_parser
from .rate_limit_handler import rate_limit_handler

logger = logging.getLogger(__name__)


class CourseGenerator:
    """Generates course outlines and module content using AI"""
    
    def __init__(self, provider_manager=None):
        self.provider = provider_manager or ai_provider_manager
    
    def _build_course_context_text(self, course_context: Optional[List[Dict[str, Any]]] = None) -> str:
        """Build a detailed text block of the full course structure including lesson-level details.
        This enables module generation to be aware of what lessons already exist to avoid overlap."""
        if not course_context:
            return ""
        
        text = "\n\n===== FULL COURSE STRUCTURE (learning hierarchy — build on this, never duplicate it) ====="
        for mod in course_context:
            text += f"\n\nModule {mod.get('order', '?')}: {mod.get('title', 'Untitled')}"
            if mod.get('description'):
                text += f"\n  Description: {mod['description'][:250]}"
            if mod.get('learning_objectives'):
                text += f"\n  Objectives: {mod['learning_objectives'][:250]}"
            lessons = mod.get('lessons', [])
            if lessons:
                for les in lessons:
                    text += f"\n    • Lesson {les.get('order', '?')}: {les.get('title', 'Untitled')}"
                    if les.get('description'):
                        text += f" — {les['description'][:100]}"
                    has_content = les.get('has_content')
                    if has_content is True:
                        text += " [PRIOR KNOWLEDGE — already taught]"
                    elif has_content is False:
                        text += " [UPCOMING — planned, not yet written]"
                    topics = les.get('covered_topics')
                    if topics:
                        text += "\n      Topics: " + "; ".join(topics[:12])
                    elif les.get('content_summary'):
                        text += f"\n      Topics: {les['content_summary'][:180]}"
            else:
                text += "\n    (no lessons yet)"
        text += ("\n\n[HIERARCHY RULES — the sequence above is what the learner studies in order:"
                 "\n1. Modules/lessons marked PRIOR KNOWLEDGE were already taught — new content builds on them by reference, never by restating them."
                 "\n2. Items marked UPCOMING are planned but unwritten — reserve their topics; do not create lessons for them."
                 "\n3. Any topic listed under Topics was already taught — a NEW module covering it is a duplication. If partially covered, go deeper on a genuinely new angle or omit it."
                 "\n4. Avoid topic overlap at BOTH the module level and the individual lesson level.]")
        return text

    def generate_course_outline(self, topic: str, target_audience: str = "",
                               learning_objectives: str = "",
                               session_id: str = None, task_id: str = None) -> Dict[str, Any]:
        """
        Generate a complete course outline based on topic and requirements
        
        Args:
            topic: The main course topic
            target_audience: Description of target learners
            learning_objectives: Desired learning outcomes
            session_id: Optional session ID for rate-limit progress tracking
            task_id: Optional task ID for rate-limit progress tracking
            
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
        
        result, provider = rate_limit_handler.execute_with_retry(
            self.provider.make_ai_request,
            prompt,
            session_id=session_id,
            task_id=task_id,
            step_label="Generating course outline",
            temperature=0.7,
            max_tokens=4096,
        )
        if result:
            parsed = json_parser.parse_json_response(result, "course outline")
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
                                  existing_modules: Optional[List[Dict[str, Any]]] = None,
                                  course_context: Optional[List[Dict[str, Any]]] = None,
                                  session_id: str = None, task_id: str = None) -> Dict[str, Any]:
        """
        Generate multiple module outlines at once for a course
        
        Args:
            course_title: The parent course title
            course_description: Course description for context
            course_objectives: Course learning objectives
            num_modules: Number of modules to generate
            existing_modules: List of existing modules with their details for context
            course_context: Full course structure with all modules/lessons for cross-reference
            
        Returns:
            Dict containing list of modules with their details
        """
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
                # Include suggested_lessons if available
                if module.get('suggested_lessons'):
                    existing_modules_text += f"  Lessons in this module:\n"
                    for les in module['suggested_lessons']:
                        existing_modules_text += f"    - {les.get('title', 'Untitled')}"
                        if les.get('description'):
                            existing_modules_text += f": {les['description'][:80]}"
                        existing_modules_text += "\n"
            start_module_num = len(existing_modules) + 1
            existing_modules_text += f"\n[IMPORTANT: Generate {num_modules} NEW modules (starting from Module {start_module_num}) that build upon these existing modules]"
        
        # Full course structure with lesson-level detail for deduplication
        course_context_text = self._build_course_context_text(course_context)
        
        prompt = f"""You are an expert instructional designer creating multiple modules for an online course.

Course Title: {course_title}
Course Description: {course_description}
Course Objectives: {course_objectives}{existing_modules_text}{course_context_text}

===== HIERARCHY CONTRACT — NEW MODULES CONTINUE THE COURSE =====
Modules/lessons listed above are the learning sequence: PRIOR KNOWLEDGE items were already taught, UPCOMING items are planned but unwritten.
Before generating each module, you MUST:
1. Review ALL existing module titles, descriptions, objectives and the Topics listed per lesson
2. The FIRST new module builds on the LAST existing module — name what it continues from
   in its description, and make its first suggested lesson bridge from the prior module's
   final lesson by title (e.g., "Building on '<last lesson>' …")
3. No suggested lesson may repeat or paraphrase any topic listed above
4. Topics reserved by UPCOMING lessons are off-limits for the new modules
5. If a topic is partially covered, go DEEPER on a genuinely new angle — never rehash
6. New module objectives and lesson descriptions assume the earlier sequence's knowledge
   rather than restating it — continuity in descriptions, no re-teaching

Create {num_modules} detailed module outlines that:
1. Have clear, progressive module titles (Module {start_module_num} through Module {start_module_num + num_modules - 1})
2. Each has a comprehensive module description (1-2 paragraphs)
3. Each has 3-5 specific learning objectives
4. Each includes 4-8 suggested lesson titles with brief descriptions and duration estimates
5. Progress logically from fundamentals to advanced topics
{f"6. Build upon the existing {len(existing_modules)} module(s) — strictly NO content duplication at module or lesson level" if existing_modules and len(existing_modules) > 0 else "6. Form a complete, coherent curriculum"}
7. Each new module's suggested lessons must have UNIQUE titles distinct from all other suggested lessons

IMPORTANT: Return ONLY valid JSON.

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
        
        result, provider = rate_limit_handler.execute_with_retry(
            self.provider.make_ai_request,
            prompt,
            session_id=session_id,
            task_id=task_id,
            step_label=f"Generating {num_modules} modules for {course_title}",
            temperature=0.7,
            max_tokens=8192,
        )
        if result:
            parsed = json_parser.parse_json_response(result, "multiple modules")
            if parsed:
                logger.info(f"Multiple modules generated successfully using {provider}")
                return parsed
        
        logger.warning("Using fallback multiple modules response")
        return {"modules": []}
    
    def generate_module_content(self, course_title: str, course_description: str,
                               course_objectives: str, module_title: str = "",
                               existing_modules: Optional[List[Dict[str, Any]]] = None,
                               course_context: Optional[List[Dict[str, Any]]] = None,
                               session_id: str = None, task_id: str = None) -> Dict[str, Any]:
        """
        Generate module details based on course context
        
        Args:
            course_title: The parent course title
            course_description: Course description for context
            course_objectives: Course learning objectives
            module_title: Optional pre-defined module title
            existing_modules: List of existing modules with their details for context
            course_context: Full course structure with all modules/lessons for cross-reference
            
        Returns:
            Dict containing module title, description, objectives, and lesson suggestions
        """
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
                # Include suggested_lessons if available
                if module.get('suggested_lessons'):
                    existing_modules_text += f"  Lessons in this module:\n"
                    for les in module['suggested_lessons']:
                        existing_modules_text += f"    - {les.get('title', 'Untitled')}"
                        if les.get('description'):
                            existing_modules_text += f": {les['description'][:80]}"
                        existing_modules_text += "\n"
            existing_modules_text += f"\n[IMPORTANT: Generate the NEXT module (Module {len(existing_modules) + 1}) that builds upon these existing modules and avoids content duplication at both module and lesson level]"
        
        # Full course structure with lesson-level detail for deduplication
        course_context_text = self._build_course_context_text(course_context)
        
        prompt = f"""You are an expert instructional designer creating a module for an online course.

Course Title: {course_title}
Course Description: {course_description}
Course Objectives: {course_objectives}{existing_modules_text}{course_context_text}
{'Module Title: ' + module_title if module_title else 'Generate a suitable module title'}

===== HIERARCHY CONTRACT — THIS MODULE CONTINUES THE COURSE =====
The modules/lessons listed above are the learning sequence: PRIOR KNOWLEDGE items were already taught, UPCOMING items are planned but unwritten.
Before generating, you MUST:
1. Review ALL existing module titles, descriptions, objectives, and the Topics listed per lesson
2. This new module (the NEXT module) builds on the LAST existing module — name the module
   it continues from in its description, and make its first suggested lesson bridge from
   the prior module's final lesson by title (e.g., "Building on '<last lesson>' …")
3. Ensure suggested lessons do NOT overlap with any topic listed above
4. Topics reserved by UPCOMING lessons are off-limits — reserve them, do not claim them
5. If a topic is partially covered somewhere, go DEEPER on a genuinely new angle
6. The module assumes the earlier sequence's knowledge — objectives reference continuity
   rather than restating what came before

Create a detailed module outline that:
1. {"Uses the provided module title" if module_title else "Suggests a clear, descriptive module title"}
2. Provides a comprehensive module description (1-2 paragraphs)
3. Lists 3-5 specific learning objectives for this module
4. Suggests 4-8 lesson titles that progressively build knowledge
5. Estimates duration for each lesson
{f"6. Complements and builds upon the existing {len(existing_modules)} module(s) — strictly NO duplication" if existing_modules and len(existing_modules) > 0 else ""}
{f"7. Considers the logical progression from previous modules" if existing_modules and len(existing_modules) > 0 else ""}

IMPORTANT: Return ONLY valid JSON.

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
        
        result, provider = rate_limit_handler.execute_with_retry(
            self.provider.make_ai_request,
            prompt,
            session_id=session_id,
            task_id=task_id,
            step_label=f"Generating module content: {module_title or 'Untitled'}",
            temperature=0.7,
            max_tokens=4096,
        )
        if result:
            parsed = json_parser.parse_json_response(result, "module content")
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


# Singleton instance
course_generator = CourseGenerator()
