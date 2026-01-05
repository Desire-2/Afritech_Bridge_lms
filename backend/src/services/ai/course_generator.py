"""
Course and Module Generation Module
Handles AI-powered generation of course outlines and module content
"""

import logging
from typing import Dict, List, Optional, Any

from .ai_providers import ai_provider_manager
from .json_parser import json_parser

logger = logging.getLogger(__name__)


class CourseGenerator:
    """Generates course outlines and module content using AI"""
    
    def __init__(self, provider_manager=None):
        self.provider = provider_manager or ai_provider_manager
    
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
        
        result, provider = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=4096)
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
        
        result, provider = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=8192)
        if result:
            parsed = json_parser.parse_json_response(result, "multiple modules")
            if parsed:
                logger.info(f"Multiple modules generated successfully using {provider}")
                return parsed
        
        logger.warning("Using fallback multiple modules response")
        return {"modules": []}
    
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
        
        result, provider = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=4096)
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
