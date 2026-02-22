"""
Lesson Generation Module
Handles AI-powered generation of lesson content including basic, comprehensive, and mixed content
"""

import time
import json
import logging
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime

from .ai_providers import ai_provider_manager
from .json_parser import json_parser
from .content_validator import content_validator
from .fallback_generators import fallback_generators

logger = logging.getLogger(__name__)


class LessonGenerator:
    """Generates lesson content using AI"""
    
    # Template structure definitions for mixed content
    TEMPLATES = {
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
    
    # Generic/meaningless titles to detect and replace
    GENERIC_TITLES = {
        "course lesson", "lesson title", "untitled", "new lesson",
        "lesson", "title", "module lesson", "sample lesson",
        "lesson content", "course content", "specific lesson title",
    }

    def __init__(self, provider_manager=None):
        self.provider = provider_manager or ai_provider_manager

    def _generate_meaningful_title(self, module_title: str, course_title: str = "",
                                     existing_lessons: Optional[List[Dict[str, Any]]] = None,
                                     lesson_number: int = 0) -> str:
        """Generate a meaningful lesson title from context when AI fails to provide one."""
        num = lesson_number or (len(existing_lessons) + 1 if existing_lessons else 1)
        
        # Create varied titles based on lesson position in the module
        title_patterns = [
            f"Foundations of {module_title}",
            f"Core Principles in {module_title}",
            f"Applied Concepts: {module_title}",
            f"Advanced Topics in {module_title}",
            f"Practical Applications of {module_title}",
            f"{module_title}: Analysis and Practice",
            f"Deep Dive into {module_title}",
            f"{module_title}: Case Studies and Examples",
        ]
        # Pick a pattern based on lesson number (cycling through options)
        idx = (num - 1) % len(title_patterns)
        return title_patterns[idx]

    def _is_generic_title(self, title: str) -> bool:
        """Check if a title is generic/meaningless and should be replaced."""
        if not title or not title.strip():
            return True
        cleaned = title.strip().lower()
        # Remove leading "Lesson N:" prefix before checking
        import re
        cleaned = re.sub(r'^lesson\s*\d*\s*:?\s*', '', cleaned).strip()
        return cleaned in self.GENERIC_TITLES or len(cleaned) < 3

    def _ensure_meaningful_title(self, title: str, module_title: str, course_title: str = "",
                                   existing_lessons: Optional[List[Dict[str, Any]]] = None,
                                   lesson_number: int = 0) -> str:
        """Validate a title and replace it if generic/meaningless."""
        if self._is_generic_title(title):
            return self._generate_meaningful_title(module_title, course_title, existing_lessons, lesson_number)
        return title.strip()
    
    def _generate_default_sections(self, lesson_title: str, module_title: str) -> List[Dict[str, Any]]:
        """Generate default outline sections when AI fails to provide them.
        
        These provide a reasonable structure for the deep stepwise generator
        to fill in with actual AI-generated content per section.
        """
        topic = lesson_title or module_title
        return [
            {
                'id': 'introduction',
                'heading': 'Introduction',
                'description': f'Introduction to {topic} — context, relevance, and learning objectives',
                'target_words': 500,
                'key_topics': ['overview', 'learning objectives', 'relevance'],
            },
            {
                'id': 'section_1',
                'heading': f'Core Concepts of {topic}',
                'description': f'Fundamental principles, definitions, and theoretical framework for {topic}',
                'target_words': 700,
                'key_topics': ['definitions', 'principles', 'framework'],
            },
            {
                'id': 'section_2',
                'heading': f'Key Techniques and Methods',
                'description': f'Step-by-step techniques, methodologies, and best practices in {topic}',
                'target_words': 700,
                'key_topics': ['techniques', 'methods', 'best practices'],
            },
            {
                'id': 'section_3',
                'heading': f'Practical Applications',
                'description': f'Real-world applications and implementation of {topic}',
                'target_words': 600,
                'key_topics': ['applications', 'implementation', 'examples'],
            },
            {
                'id': 'worked_examples',
                'heading': 'Worked Examples and Case Studies',
                'description': f'Detailed worked examples with step-by-step solutions for {topic}',
                'target_words': 800,
                'key_topics': ['examples', 'case studies', 'solutions'],
            },
            {
                'id': 'summary',
                'heading': 'Key Takeaways and Discussion Questions',
                'description': 'Summary of key points and thought-provoking questions',
                'target_words': 400,
                'key_topics': ['takeaways', 'discussion', 'review'],
            },
        ]

    def _build_course_context_text(self, course_context: Optional[List[Dict[str, Any]]] = None,
                                     current_module_title: str = "") -> str:
        """Build a text block describing the full course structure for cross-module awareness."""
        if not course_context:
            return ""
        
        text = "\n\n===== FULL COURSE STRUCTURE (for cross-reference — DO NOT duplicate content) ====="
        for mod in course_context:
            is_current = mod.get('title', '') == current_module_title
            marker = " ← CURRENT MODULE" if is_current else ""
            text += f"\n\nModule {mod.get('order', '?')}: {mod.get('title', 'Untitled')}{marker}"
            if mod.get('description'):
                text += f"\n  Description: {mod['description'][:200]}"
            if mod.get('learning_objectives'):
                text += f"\n  Objectives: {mod['learning_objectives'][:200]}"
            lessons = mod.get('lessons', [])
            if lessons:
                for les in lessons:
                    text += f"\n  - Lesson {les.get('order', '?')}: {les.get('title', 'Untitled')}"
                    if les.get('description'):
                        text += f" — {les['description'][:120]}"
                    if les.get('content_summary'):
                        text += f"\n    Topics covered: {les['content_summary'][:200]}"
        text += "\n\n[CRITICAL: Reference this structure. Do NOT repeat topics already covered in other modules/lessons. Focus on NEW, UNIQUE content that adds value and builds on what came before.]"
        return text

    def generate_lesson_content(self, course_title: str, module_title: str,
                               module_description: str, module_objectives: str,
                               lesson_title: str = "", lesson_description: str = "",
                               existing_lessons: Optional[List[Dict[str, Any]]] = None,
                               course_context: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
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
            course_context: Full course structure with all modules/lessons for cross-reference
            
        Returns:
            Dict with lesson title, description, objectives, and markdown content
        """
        existing_lessons_text = ""
        if existing_lessons and len(existing_lessons) > 0:
            existing_lessons_text = "\n\nExisting Lessons in this Module:\n"
            for lesson in existing_lessons:
                existing_lessons_text += f"\n{lesson['order']}. {lesson['title']}"
                if lesson.get('description'):
                    existing_lessons_text += f"\n   Description: {lesson['description']}"
                if lesson.get('duration_minutes'):
                    existing_lessons_text += f"\n   Duration: {lesson['duration_minutes']} minutes"
                if lesson.get('content_summary'):
                    existing_lessons_text += f"\n   Topics covered: {lesson['content_summary'][:200]}"
            existing_lessons_text += f"\n\n[IMPORTANT: Analyze the existing {len(existing_lessons)} lesson(s) above. Generate the NEXT lesson (Lesson {len(existing_lessons) + 1}) that:"
            existing_lessons_text += "\n- Builds upon previous lessons naturally"
            existing_lessons_text += "\n- Covers NEW content not already taught"
            existing_lessons_text += "\n- Fills gaps in the learning progression"
            existing_lessons_text += "\n- Maintains logical flow and difficulty progression]"
        
        # Cross-module context
        course_context_text = self._build_course_context_text(course_context, module_title)
        
        prompt = f"""You are an expert professor and curriculum designer creating COMPREHENSIVE, UNIVERSITY-LEVEL lesson content.

Course: {course_title}
Module: {module_title}
Module Description: {module_description}
Module Objectives: {module_objectives}{existing_lessons_text}{course_context_text}
{'Lesson Title: ' + lesson_title if lesson_title else 'You MUST generate a SPECIFIC, DESCRIPTIVE lesson title that clearly reflects the topic being taught. Do NOT use generic titles like "Course Lesson", "Lesson Title", or "Module Lesson".'}
{'Lesson Focus: ' + lesson_description if lesson_description else ''}

===== DUPLICATE AVOIDANCE CHECKLIST =====
Before generating, you MUST:
1. Review ALL existing lesson titles, descriptions, and topics covered (listed above)
2. Review the FULL COURSE STRUCTURE (if provided) including other modules' lessons
3. Ensure this lesson's content does NOT repeat topics already taught
4. If a topic was introduced elsewhere, go DEEPER into a specific aspect or cover a new angle
5. Cross-reference section headers — avoid reusing the same heading topics

===== CRITICAL REQUIREMENTS =====

You MUST create EXTENSIVE, DETAILED lesson content (minimum 3000-4000 words total). This is NOT a summary or outline - it is a FULL LESSON that a student will read and study from.

The content_data field MUST contain:

1. **INTRODUCTION SECTION** (400-500 words):
   - Hook with a compelling real-world scenario, problem, or question
   - Context explaining why this topic matters in professional practice
   - Clear preview of what will be covered
   - Connection to previous knowledge{" (referencing prior lessons)" if existing_lessons and len(existing_lessons) > 0 else ""}
   - Specific learning objectives stated clearly

2. **5-7 MAIN CONTENT SECTIONS** (500-800 words EACH section):
   Each section MUST include:
   - Clear ## Header for the section
   - Detailed theoretical explanation (not just definitions)
   - Step-by-step procedures or processes where applicable
   - SPECIFIC examples with actual data, numbers, formulas, or code
   - Real-world applications with named companies or scenarios
   - Common mistakes or misconceptions addressed
   - Best practices and professional tips
   - Visual descriptions (describe what charts/diagrams would show)

3. **WORKED EXAMPLES SECTION** (600-800 words):
   Include 2-3 DETAILED worked examples with:
   - Realistic scenario context (100+ words per example)
   - Given data with specific numbers
   - Complete step-by-step solutions
   - All calculations shown with formulas
   - Explanation of why each step is necessary
   - Final answer with proper units and interpretation

4. **CASE STUDY OR APPLICATION** (400-500 words):
   - Real-world scenario with named company or detailed situation
   - How the concepts apply to solve a practical problem
   - Analysis of outcomes or results

5. **KEY TAKEAWAYS SECTION** (200-300 words):
   - 6-8 specific, actionable takeaways (not generic statements)
   - Quick reference formulas or procedures
   - Common pitfalls to avoid

6. **DISCUSSION QUESTIONS** (150-200 words):
   - 4-5 thought-provoking questions
   - Mix of comprehension and application questions
   - Questions that encourage critical thinking

===== CONTENT QUALITY STANDARDS =====
- Write as a professor teaching the subject, not summarizing it
- Include SPECIFIC data, numbers, formulas, statistics
- Explain the "how" and "why", not just the "what"
- Use professional terminology with explanations
- Reference industry standards and best practices
- Make content immediately applicable to real work
- Use proper markdown: ## headers, **bold**, `code`, lists, tables
- DO NOT write vague, generic, or placeholder content
- Every section must have substantive, educational content

IMPORTANT: Return ONLY valid JSON. No markdown, no explanatory text, no code blocks — just the raw JSON object. Escape all special characters properly.

Format as JSON:
{{
  "title": "Descriptive Topic-Specific Title Here",
  "description": "3-4 sentence description covering scope and value of this lesson",
  "learning_objectives": "• Specific measurable objective 1\\n• Specific measurable objective 2\\n• Specific measurable objective 3\\n• Specific measurable objective 4",
  "duration_minutes": 60,
  "content_type": "text",
  "content_data": "# Introduction\\n\\n[400-500 word engaging introduction...]\\n\\n## Section 1: [Topic]\\n\\n[500-800 words of detailed content...]\\n\\n## Section 2: [Topic]\\n\\n[500-800 words...]\\n\\n[Continue for all sections...]\\n\\n## Worked Examples\\n\\n[Detailed examples with solutions...]\\n\\n## Key Takeaways\\n\\n[Specific actionable points...]\\n\\n## Discussion Questions\\n\\n[Thought-provoking questions...]"
}}"""
        
        # Request more tokens to accommodate comprehensive content (3000-4000 words)
        result, provider = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=8192)
        
        # If first attempt failed or returned low quality, try with alternative provider
        if result:
            parsed = json_parser.parse_json_response(result, "lesson content")
            if parsed:
                # Validate and fix generic titles
                if self._is_generic_title(parsed.get('title', '')):
                    parsed['title'] = self._generate_meaningful_title(
                        module_title, course_title, existing_lessons
                    )
                    logger.info(f"Replaced generic AI title with: {parsed['title']}")
                logger.info(f"Lesson content generated successfully using {provider}")
                return parsed
            else:
                logger.warning(f"Failed to parse JSON response from {provider}, trying alternative approach")
                # Invalidate bad cached response so it's not served again
                self.provider.invalidate_cache_for_prompt(prompt)
        else:
            logger.warning(f"No result from {provider}, content generation failed")
        
        # If primary generation failed, try with the alternative provider explicitly
        logger.info("Attempting lesson generation with alternative AI provider...")
        original_provider = self.provider.current_provider
        
        try:
            # Switch to alternative provider
            if original_provider == 'openrouter':
                self.provider.force_provider('gemini')
                logger.info("Switched to Gemini for lesson generation retry")
            else:
                self.provider.force_provider('openrouter')
                logger.info("Switched to OpenRouter for lesson generation retry")
            
            # Retry with alternative provider
            result, provider = self.provider.make_ai_request(prompt, temperature=0.8, max_tokens=8192)
            if result:
                parsed = json_parser.parse_json_response(result, "lesson content")
                if parsed:
                    # Validate and fix generic titles from alternative provider
                    if self._is_generic_title(parsed.get('title', '')):
                        parsed['title'] = self._generate_meaningful_title(
                            module_title, course_title, existing_lessons
                        )
                        logger.info(f"Replaced generic alt-provider title with: {parsed['title']}")
                    logger.info(f"Alternative provider ({provider}) successfully generated lesson content")
                    return parsed
        except Exception as e:
            logger.error(f"Alternative provider attempt failed: {e}")
        finally:
            # Restore original provider
            self.provider.force_provider(original_provider)
        
        # Final fallback - return structured template
        logger.warning("All AI providers failed, using fallback template")
        fallback_title = self._ensure_meaningful_title(
            lesson_title, module_title, course_title, existing_lessons
        )
        fallback_content = self._generate_fallback_lesson_content(
            course_title, module_title, fallback_title, 
            lesson_description or f"This lesson covers key concepts in {module_title}."
        )
        return fallback_content
    
    def generate_multiple_lessons(self, course_title: str, module_title: str,
                                  module_description: str, module_objectives: str,
                                  num_lessons: int = 5,
                                  existing_lessons: Optional[List[Dict[str, Any]]] = None,
                                  course_context: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
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
                if lesson.get('content_summary'):
                    existing_lessons_text += f"\n   Topics covered: {lesson['content_summary'][:200]}"
            start_lesson_num = len(existing_lessons) + 1
            existing_lessons_text += f"\n\n[IMPORTANT: Generate {num_lessons} NEW lessons (starting from Lesson {start_lesson_num}) that build upon these existing lessons. DO NOT repeat any topics already covered.]"
        
        # Cross-module context
        course_context_text = self._build_course_context_text(course_context, module_title)
        
        prompt = f"""You are an expert professor and curriculum designer creating COMPREHENSIVE, UNIVERSITY-LEVEL lesson content for a learning management system.

Course: {course_title}
Module: {module_title}
Module Description: {module_description}
Module Objectives: {module_objectives}{existing_lessons_text}{course_context_text}

===== DUPLICATE AVOIDANCE CHECKLIST =====
Before generating each lesson, you MUST:
1. Review ALL existing lesson titles, descriptions, and topics covered above
2. Review the FULL COURSE STRUCTURE (if provided) to see what other modules/lessons cover
3. Ensure each new lesson's title is DISTINCT from all existing titles
4. Ensure each new lesson's content covers topics NOT already handled
5. If a topic is partially covered, go DEEPER into a specific sub-topic — never rehash
6. Each lesson within this batch must also be unique from each other

===== CRITICAL REQUIREMENTS =====

Create {num_lessons} COMPREHENSIVE lessons (each with 2500-3500 words of content) that form a complete learning sequence.

For EACH lesson, you MUST provide:

1. **Title**: Clear, specific, descriptive title that reflects the ACTUAL TOPIC being taught. Do NOT use generic titles like \"Course Lesson\", \"Lesson Title\", \"Module Lesson\", or \"Untitled\". Each title must be unique and descriptive.

2. **Description**: 3-4 sentences explaining scope and value

3. **Learning Objectives**: 3-5 SPECIFIC, MEASURABLE objectives with action verbs

4. **Content (content_data)** - MINIMUM 2500 words per lesson with this structure:

   A. **Introduction** (300-400 words):
      - Hook with real-world scenario or question
      - Why this topic matters professionally
      - Preview of what will be covered
      - Connection to previous lesson (if not first)

   B. **4-6 Main Content Sections** (400-600 words EACH):
      - Each with clear ## Header
      - Detailed explanations with step-by-step procedures
      - SPECIFIC examples with real data/numbers/formulas
      - Practical applications
      - Common mistakes and how to avoid them
      - Professional tips and best practices

   C. **Worked Examples Section** (400-500 words):
      - 2-3 detailed examples with complete solutions
      - All steps and calculations shown
      - Explanation of reasoning

   D. **Key Takeaways** (150-200 words):
      - 5-7 specific actionable points
      - Quick reference formulas if applicable

   E. **Discussion Questions** (100-150 words):
      - 3-4 thought-provoking questions

5. **Duration**: Realistic estimate (typically 45-75 minutes per comprehensive lesson)

===== LESSON PROGRESSION REQUIREMENTS =====
- Lesson {start_lesson_num}: Foundation - Core concepts, definitions, fundamentals
- Middle lessons: Build complexity progressively
- Final lesson: Advanced topics, integration, practical application
{f"- Build upon and reference the {len(existing_lessons)} existing lesson(s) - DO NOT repeat their content" if existing_lessons and len(existing_lessons) > 0 else ""}

===== CONTENT QUALITY STANDARDS =====
- Write as a professor teaching, not summarizing
- Include SPECIFIC data, numbers, formulas, examples
- Use proper markdown formatting
- Make content immediately applicable to real work
- DO NOT write generic or placeholder content

IMPORTANT: Return ONLY valid JSON. No markdown, no explanatory text, no code blocks — just the raw JSON object.

Format as JSON:
{{
  "lessons": [
    {{
      "title": "Specific Lesson Title",
      "description": "3-4 sentence comprehensive description...",
      "learning_objectives": "• Specific objective 1\\n• Specific objective 2\\n• Specific objective 3\\n• Specific objective 4",
      "duration_minutes": 60,
      "order": {start_lesson_num},
      "content_type": "text",
      "content_data": "# Introduction\\n\\n[300-400 words...]\\n\\n## Section 1: [Topic]\\n\\n[400-600 words...]\\n\\n## Section 2: [Topic]\\n\\n[400-600 words...]\\n\\n[Continue with all sections...]\\n\\n## Worked Examples\\n\\n[Detailed examples...]\\n\\n## Key Takeaways\\n\\n[Actionable points...]\\n\\n## Discussion Questions\\n\\n[Thought-provoking questions...]"
    }}
  ]
}}"""
        
        # Increase tokens significantly for multiple comprehensive lessons
        result, provider = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=16000)
        if result:
            parsed = json_parser.parse_json_response(result, "multiple lessons")
            if parsed:
                # Validate and fix generic titles in each lesson
                lessons = parsed.get('lessons', [])
                for idx, lesson in enumerate(lessons):
                    lesson_num = lesson.get('order', idx + start_lesson_num)
                    if self._is_generic_title(lesson.get('title', '')):
                        lesson['title'] = self._generate_meaningful_title(
                            module_title, course_title, existing_lessons, lesson_num
                        )
                        logger.info(f"Replaced generic batch lesson title #{lesson_num} with: {lesson['title']}")
                return parsed
        
        return {"lessons": []}
    
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
        
        template_structure = self.TEMPLATES.get(template_id, None) if template_id else None
        template_guidance = ""
        if template_structure:
            template_guidance = f"\\n\\nTemplate Structure ({template_id}):\\n"
            for idx, section in enumerate(template_structure, 1):
                template_guidance += f"{idx}. {section['type'].upper()}: {section['role']}\\n"
            template_guidance += "\\n[Generate content following this exact structure]"
        
        prompt = self._build_mixed_content_prompt(
            course_title, module_title, module_description, 
            lesson_title, lesson_description, existing_context, 
            template_guidance, template_id
        )
        
        result, provider = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        if result:
            parsed = json_parser.parse_json_response(result, "mixed content")
            if parsed and 'sections' in parsed:
                return {
                    "sections": parsed['sections'],
                    "lesson_title": lesson_title,
                    "template_used": template_id
                }
        
        return fallback_generators.generate_fallback_mixed_content(lesson_title, template_id)
    
    def _build_mixed_content_prompt(self, course_title: str, module_title: str,
                                   module_description: str, lesson_title: str,
                                   lesson_description: str, existing_context: str,
                                   template_guidance: str, template_id: str) -> str:
        """Build the prompt for mixed content generation"""
        return f"""You are an expert professor and instructional designer creating COMPREHENSIVE, UNIVERSITY-LEVEL lesson content.

**Course Context:**
- Course: {course_title}
- Module: {module_title}
- Module Description: {module_description}
- Lesson Title: {lesson_title}
{f'- Lesson Description: {lesson_description}' if lesson_description else ''}{existing_context}{template_guidance}

===== CRITICAL REQUIREMENTS =====

Create a complete, professional lesson with RICH, DETAILED content (minimum 2500-3500 total words).

**TEXT SECTION REQUIREMENTS:**
Each TEXT section MUST be SUBSTANTIAL and COMPREHENSIVE:

1. **Introduction Section** (400-500 words):
   - Hook with compelling real-world scenario or question
   - Context explaining professional relevance
   - Clear preview of what will be covered
   - Specific learning objectives

2. **Main Content Sections** (500-800 words EACH):
   - Detailed theoretical explanations (not just definitions)
   - Step-by-step procedures where applicable
   - SPECIFIC examples with actual data, numbers, formulas
   - Real-world applications with named companies/scenarios
   - Common mistakes and how to avoid them
   - Professional tips and best practices

3. **Practical Examples Section** (400-600 words):
   - 2-3 detailed worked examples
   - Complete step-by-step solutions
   - All calculations and reasoning shown

4. **Summary/Takeaways Section** (200-300 words):
   - 5-7 specific actionable takeaways
   - Quick reference formulas if applicable

**MEDIA PLACEHOLDERS:**
- VIDEO: Use [INSERT_VIDEO_URL_HERE]
- PDF: Use [INSERT_PDF_URL_HERE]  
- IMAGE: Use [INSERT_IMAGE_URL_HERE]

**CONTENT QUALITY STANDARDS:**
- Write as a professor teaching, not summarizing
- Include SPECIFIC data, numbers, formulas, statistics
- Explain the "how" and "why", not just the "what"
- Make content immediately applicable to real work
- Use proper markdown: ## headers, **bold**, `code`, lists
- DO NOT write vague, generic, or placeholder text content

CRITICAL: Return ONLY valid JSON. Use \\\\n for newlines.

{{
  "sections": [
    {{"type": "heading", "content": "Introduction", "title": "Introduction"}},
    {{"type": "text", "content": "## Introduction\\\\n\\\\n[400-500 words of engaging, detailed introduction content...]"}},
    {{"type": "heading", "content": "Core Concepts", "title": "Core Concepts"}},
    {{"type": "text", "content": "## Core Concepts\\\\n\\\\n[500-800 words of comprehensive theory...]"}},
    {{"type": "video", "url": "[INSERT_VIDEO_URL_HERE]", "title": "Video Tutorial", "description": "Detailed description of video content..."}},
    {{"type": "heading", "content": "Practical Application", "title": "Practical Application"}},
    {{"type": "text", "content": "## Practical Application\\\\n\\\\n[500-800 words with detailed examples...]"}},
    {{"type": "heading", "content": "Key Takeaways", "title": "Key Takeaways"}},
    {{"type": "text", "content": "## Key Takeaways\\\\n\\\\n[200-300 words with specific, actionable points...]"}}
  ]
}}"""
    
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
            "introduction": f"""Write a COMPREHENSIVE, ENGAGING introduction for the lesson '{lesson_title}' as an expert professor.

REQUIREMENTS (500-700 words minimum):

1. **Opening Hook** (100+ words):
   - Start with a compelling real-world scenario, surprising fact, or thought-provoking question
   - Make the reader immediately understand why this topic matters
   - Include a specific industry example or statistic

2. **Context and Relevance** (150+ words):
   - Explain where this topic fits in the broader field
   - Describe real-world applications and professional use cases
   - Explain why mastering this is essential for professionals

3. **Chapter Overview** (150+ words):
   - Clearly state what will be covered in detail
   - Preview the main sections and key concepts
   - Set clear expectations for skills gained

4. **Learning Objectives** (100+ words):
   - List 4-5 specific, measurable learning objectives
   - Connect objectives to practical applications
   - Use action verbs (analyze, create, evaluate, apply)

Use markdown formatting with **bold** for emphasis. Write in professional yet engaging tone.""",
            
            "theory": f"""Write COMPREHENSIVE theoretical content for '{lesson_title}' with academic rigor and practical depth.

REQUIREMENTS (1000-1500 words minimum):

1. **Core Concepts** (300+ words):
   - Define all key terms with clear explanations
   - Explain fundamental principles in detail
   - Include the theoretical foundation

2. **Detailed Explanations** (400+ words):
   - Break down complex concepts step-by-step
   - Explain the "how" and "why", not just "what"
   - Include SPECIFIC data, formulas, or code examples
   - Address common misconceptions

3. **Professional Context** (200+ words):
   - How this applies in real industry settings
   - Best practices and standards
   - Expert tips and insights

4. **Connections** (150+ words):
   - How concepts relate to each other
   - Prerequisites and building blocks
   - Advanced applications

Use markdown with ## headers for subsections, **bold** for key terms, `code` for technical content, and lists where appropriate.""",
            
            "examples": f"""Create DETAILED, COMPREHENSIVE practical examples for '{lesson_title}'.

REQUIREMENTS (1000-1500 words minimum):

Provide 3-4 FULLY WORKED examples:

For EACH example:
1. **Scenario** (100+ words):
   - Realistic professional context with named company or specific situation
   - Clear problem statement

2. **Given Data**:
   - Specific numbers, values, inputs
   - All relevant information

3. **Step-by-Step Solution** (200+ words per example):
   - Show ALL steps explicitly
   - Include formulas or code with explanations
   - Explain the reasoning behind each step

4. **Result and Interpretation** (50+ words):
   - Final answer with proper units
   - What the result means in context

5. **Key Insight**:
   - One important takeaway from this example

Progress from simpler to more complex examples. Include variations or edge cases where relevant.""",
            
            "exercises": f"""Create COMPREHENSIVE practice exercises for '{lesson_title}' at {difficulty_level} level.

REQUIREMENTS (800-1200 words minimum):

Provide 6-8 exercises with COMPLETE solutions:

For EACH exercise:
1. **Problem Statement** (50+ words):
   - Clear, specific question or task
   - Realistic scenario context

2. **Given Data**:
   - All necessary information

3. **Hints** (2-3 per exercise):
   - Helpful clues without giving away the answer

4. **Complete Solution** (100+ words per exercise):
   - Step-by-step approach
   - All calculations shown
   - Final answer

5. **Learning Point**:
   - What concept this reinforces

Include:
- Mix of difficulty levels (2 easy, 3 medium, 2-3 hard)
- Various types (calculation, analysis, application, critical thinking)
- Progressive complexity""",
            
            "summary": f"""Write a COMPREHENSIVE summary and conclusion for '{lesson_title}'.

REQUIREMENTS (600-800 words minimum):

1. **Lesson Recap** (150+ words):
   - Summarize all main concepts covered
   - Highlight how concepts connect together
   - Reference specific topics and techniques

2. **Key Takeaways** (200+ words):
   - 6-8 specific, actionable points
   - What the learner can now DO
   - Quick reference for important formulas or procedures

3. **Common Pitfalls** (100+ words):
   - Mistakes to avoid
   - Tips for success

4. **Practical Application** (100+ words):
   - How to apply this knowledge immediately
   - Real scenarios where these skills are valuable

5. **Next Steps** (100+ words):
   - Reflection questions (3-4)
   - Suggestions for further learning
   - Additional resources to explore"""
        }
        
        prompt = section_prompts.get(section_type, f"""Generate a COMPREHENSIVE {section_type} section for '{lesson_title}'.
Write at least 600-800 words of detailed, educational content.
Include specific examples, explanations, and practical applications.
Use markdown formatting.""")
        
        if section_context:
            prompt += f"\n\nContext: {json.dumps(section_context)}"
        
        result, _ = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=4000)
        return result.strip() if result else f"## {section_type.capitalize()}\n\nContent to be generated..."
    
    def _generate_fallback_lesson_content(self, course_title: str, module_title: str, 
                                         lesson_title: str, lesson_description: str) -> Dict[str, Any]:
        """Generate structured fallback lesson content when AI providers fail"""
        return {
            "title": lesson_title,
            "description": lesson_description,
            "learning_objectives": f"""• Understand key concepts related to {lesson_title}
• Apply theoretical knowledge to practical scenarios  
• Analyze real-world applications and case studies
• Develop problem-solving skills in {module_title}
• Build foundation for advanced topics in {course_title}""",
            "duration_minutes": 60,
            "content_type": "text",
            "content_data": f"""# {lesson_title}

## Introduction

Welcome to this comprehensive lesson on **{lesson_title}** as part of the {module_title} module in {course_title}. This lesson will provide you with a solid foundation in the key concepts, practical applications, and real-world relevance of this important topic.

{lesson_description}

In today's rapidly evolving professional landscape, understanding {lesson_title.lower()} has become increasingly critical for success. This lesson will equip you with both the theoretical knowledge and practical skills needed to excel in this area.

## Learning Objectives

By the end of this lesson, you will be able to:
- Understand the fundamental principles and concepts
- Apply knowledge to solve practical problems
- Analyze real-world scenarios and case studies
- Identify best practices and common pitfalls
- Connect this topic to broader professional contexts

## Core Concepts

### Understanding the Fundamentals

{lesson_title} encompasses several key principles that form the foundation of professional practice in this area. These concepts are essential for building expertise and making informed decisions in real-world situations.

**Key Definition**: {lesson_title} refers to the systematic approach and methodologies used to address specific challenges and opportunities in {module_title}.

### Theoretical Framework

The theoretical foundation of {lesson_title.lower()} is built upon established principles that have been refined through years of research and practical application. Understanding this framework is crucial for:

1. **Conceptual Clarity**: Establishing clear definitions and boundaries
2. **Systematic Approach**: Following proven methodologies
3. **Quality Assurance**: Ensuring consistent and reliable outcomes
4. **Continuous Improvement**: Building upon existing knowledge

### Practical Applications

In professional practice, {lesson_title.lower()} is applied across various contexts and industries. Common applications include:

- **Project Management**: Organizing and executing complex initiatives
- **Problem Solving**: Addressing challenges systematically
- **Decision Making**: Evaluating options and choosing optimal solutions
- **Quality Control**: Ensuring standards and requirements are met

## Real-World Case Study

### Company Example: TechCorp Implementation

TechCorp, a mid-size technology company, faced significant challenges in their approach to {lesson_title.lower()}. Here's how they addressed the situation:

**Background**: TechCorp struggled with inconsistent results and inefficient processes in their {module_title} operations.

**Challenge**: The company needed to standardize their approach while maintaining flexibility for different project requirements.

**Solution**: They implemented a comprehensive framework based on the principles covered in this lesson, including:
1. Standardized procedures and protocols
2. Clear roles and responsibilities
3. Regular monitoring and evaluation
4. Continuous improvement processes

**Results**: Within six months, TechCorp achieved:
- 35% improvement in efficiency
- 50% reduction in errors
- Higher client satisfaction ratings
- Better team collaboration

## Best Practices and Guidelines

### Industry Standards

Professional practice in {lesson_title.lower()} follows established industry standards and guidelines. Key recommendations include:

1. **Planning and Preparation**
   - Thoroughly assess requirements and constraints
   - Develop clear objectives and success criteria
   - Allocate appropriate resources and timeframes

2. **Implementation**
   - Follow proven methodologies and frameworks
   - Maintain clear documentation and communication
   - Monitor progress and adjust as needed

3. **Evaluation and Improvement**
   - Regularly assess outcomes and performance
   - Gather feedback from stakeholders
   - Implement lessons learned in future projects

### Common Pitfalls to Avoid

Based on industry experience, common mistakes include:
- Insufficient planning and preparation
- Poor communication and coordination
- Neglecting quality assurance measures
- Failing to adapt to changing circumstances

## Worked Example: Step-by-Step Process

Let's work through a practical example to demonstrate the application of these concepts:

**Scenario**: You are tasked with implementing a {lesson_title.lower()} solution for a client project.

**Step 1: Assessment and Planning**
- Identify client requirements and constraints
- Analyze existing processes and systems
- Develop project timeline and resource allocation

**Step 2: Design and Development**
- Create detailed specifications and requirements
- Develop solution architecture and design
- Establish quality assurance protocols

**Step 3: Implementation and Testing**
- Execute implementation plan systematically
- Conduct thorough testing and validation
- Address any issues or concerns promptly

**Step 4: Deployment and Monitoring**
- Deploy solution to production environment
- Monitor performance and user feedback
- Provide ongoing support and maintenance

## Key Takeaways

1. **Foundation Matters**: Strong understanding of fundamentals is essential
2. **Systematic Approach**: Following proven methodologies improves outcomes
3. **Quality Focus**: Consistent attention to quality prevents major issues
4. **Continuous Learning**: Stay updated with industry trends and best practices
5. **Practical Application**: Theory must be combined with hands-on experience
6. **Stakeholder Engagement**: Clear communication is critical for success

## Discussion Questions

1. How would you adapt the concepts from this lesson to your specific industry or role?
2. What challenges might organizations face when implementing these approaches?
3. How do current technology trends impact the application of these principles?
4. What role does organizational culture play in successful implementation?
5. How would you measure the success of a {lesson_title.lower()} initiative?

## Next Steps

To further develop your expertise in {lesson_title}:
- Practice applying these concepts to real-world scenarios
- Research current industry trends and developments
- Seek mentorship from experienced professionals
- Consider additional training or certification programs
- Join professional communities and networks

This lesson has provided you with a comprehensive foundation in {lesson_title}. In our next lesson, we will explore advanced applications and emerging trends in this important area.
"""
        }

    # =====================================================================
    # DEEP MULTI-STEP LESSON GENERATION
    # Generates each section separately for higher quality and detail.
    # Each step references previous steps + full course context.
    # =====================================================================

    def generate_lesson_deep_outline(self, course_title: str, module_title: str,
                                      module_description: str, module_objectives: str,
                                      lesson_title: str = "", lesson_description: str = "",
                                      existing_lessons: Optional[List[Dict[str, Any]]] = None,
                                      course_context: Optional[List[Dict[str, Any]]] = None) -> Optional[Dict[str, Any]]:
        """Step 1: Generate a detailed lesson outline with sections, topics, and structure."""
        existing_text = ""
        if existing_lessons:
            existing_text = "\n\nExisting Lessons in this Module:\n"
            for les in existing_lessons:
                existing_text += f"  {les.get('order', '?')}. {les.get('title', 'Untitled')}"
                if les.get('content_summary'):
                    existing_text += f" — Topics: {les['content_summary'][:150]}"
                existing_text += "\n"

        course_ctx = self._build_course_context_text(course_context, module_title)

        prompt = f"""You are an expert professor designing a DETAILED lesson outline.

Course: {course_title}
Module: {module_title}
Module Description: {module_description}
Module Objectives: {module_objectives}{existing_text}{course_ctx}
{'Lesson Title: ' + lesson_title if lesson_title else 'You MUST choose a SPECIFIC, DESCRIPTIVE lesson title that clearly indicates the topic (NOT generic like "Course Lesson", "Lesson Title", or "Module Lesson"). The title should reflect the actual subject matter being taught.'}
{'Lesson Focus: ' + lesson_description if lesson_description else ''}

Create a comprehensive lesson outline. This is ONLY the structure — content will be generated separately for each section.

Return ONLY valid JSON:
{{
  "title": "Specific lesson title",
  "description": "3-4 sentence description of what this lesson covers and its value",
  "learning_objectives": ["Objective 1 with action verb", "Objective 2", "Objective 3", "Objective 4", "Objective 5"],
  "duration_minutes": 60,
  "sections": [
    {{
      "id": "introduction",
      "heading": "Introduction",
      "description": "What this section covers and its purpose",
      "target_words": 500,
      "key_topics": ["topic1", "topic2"]
    }},
    {{
      "id": "section_1",
      "heading": "Core Concepts: [Specific Topic]",
      "description": "Detailed description of section content",
      "target_words": 700,
      "key_topics": ["topic1", "topic2", "topic3"]
    }},
    {{
      "id": "section_2",
      "heading": "Advanced Analysis: [Specific Topic]",
      "description": "Detailed description",
      "target_words": 700,
      "key_topics": ["topic1", "topic2"]
    }},
    {{
      "id": "section_3",
      "heading": "Practical Applications: [Specific Topic]",
      "description": "Real-world applications and implementation",
      "target_words": 600,
      "key_topics": ["topic1", "topic2"]
    }},
    {{
      "id": "worked_examples",
      "heading": "Worked Examples and Case Studies",
      "description": "3 detailed worked examples with step-by-step solutions",
      "target_words": 800,
      "key_topics": ["example1", "example2", "case_study"]
    }},
    {{
      "id": "exercises",
      "heading": "Practice Exercises",
      "description": "Hands-on exercises with solutions",
      "target_words": 500,
      "key_topics": ["exercise1", "exercise2"]
    }},
    {{
      "id": "summary",
      "heading": "Key Takeaways and Discussion Questions",
      "description": "Summary and reflection",
      "target_words": 400,
      "key_topics": ["takeaway1", "takeaway2"]
    }}
  ],
  "unique_value": "Explain what makes THIS lesson unique vs other lessons in the course — what NEW knowledge/skills it adds"
}}

REQUIREMENTS:
- Plan 5-7 main sections plus intro and summary
- Each section must have SPECIFIC, unique topics (not generic)
- Ensure NO overlap with existing lessons listed above
- Each section should build on the previous one
- Include practical applications and real-world examples in the plan

CRITICAL: Return ONLY valid JSON. No markdown, no explanatory text, no code blocks — just the raw JSON object."""

        result, provider = self.provider.make_ai_request(prompt, temperature=0.6, max_tokens=4096)
        if result:
            parsed = json_parser.parse_json_response(result, "lesson outline")
            if parsed:
                # Validate and fix generic titles in outline
                if self._is_generic_title(parsed.get('title', '')):
                    parsed['title'] = self._generate_meaningful_title(
                        module_title, course_title, existing_lessons
                    )
                    logger.info(f"Replaced generic outline title with: {parsed['title']}")
                
                # Validate outline has sections — critical for deep stepwise to work
                sections = parsed.get('sections', [])
                if not sections or not isinstance(sections, list) or len(sections) < 2:
                    logger.warning(f"Outline has {len(sections) if isinstance(sections, list) else 0} sections (need ≥2). Generating default sections...")
                    # Invalidate this bad cached response
                    self.provider.invalidate_cache_for_prompt(prompt)
                    # Generate default sections based on title and module
                    parsed['sections'] = self._generate_default_sections(
                        parsed.get('title', module_title), module_title
                    )
                    logger.info(f"Generated {len(parsed['sections'])} default sections for outline")
                
                logger.info(f"Deep outline generated: {parsed.get('title', 'untitled')} with {len(parsed.get('sections', []))} sections")
                return parsed
            else:
                # JSON parse failed — the AI returned non-JSON (e.g., markdown)
                logger.warning(f"Outline response from {provider} was not valid JSON. Invalidating cache and attempting recovery...")
                
                # Invalidate the cached bad response so future requests get a fresh one
                self.provider.invalidate_cache_for_prompt(prompt)
                
                # Recovery strategy 1: Try to extract outline from markdown
                markdown_outline = json_parser.extract_outline_from_markdown(result)
                if markdown_outline:
                    if self._is_generic_title(markdown_outline.get('title', '')):
                        markdown_outline['title'] = self._generate_meaningful_title(
                            module_title, course_title, existing_lessons
                        )
                    logger.info(f"Recovered outline from markdown: {markdown_outline.get('title')} with {len(markdown_outline.get('sections', []))} sections")
                    return markdown_outline
                
                # Recovery strategy 2: Retry with Gemini directly (if different from original provider)
                if provider != 'gemini' and self.provider.gemini_model:
                    logger.info("Retrying outline generation with Gemini...")
                    retry_result = self.provider._make_gemini_request(prompt, retry_count=1, temperature=0.6)
                    if retry_result:
                        retry_parsed = json_parser.parse_json_response(retry_result, "lesson outline (gemini retry)")
                        if retry_parsed:
                            if self._is_generic_title(retry_parsed.get('title', '')):
                                retry_parsed['title'] = self._generate_meaningful_title(
                                    module_title, course_title, existing_lessons
                                )
                            logger.info(f"Gemini retry succeeded: {retry_parsed.get('title')}")
                            return retry_parsed
                        # Also try markdown extraction on Gemini response
                        md_outline = json_parser.extract_outline_from_markdown(retry_result)
                        if md_outline:
                            if self._is_generic_title(md_outline.get('title', '')):
                                md_outline['title'] = self._generate_meaningful_title(
                                    module_title, course_title, existing_lessons
                                )
                            return md_outline
        
        return None

    def generate_lesson_deep_section(self, course_title: str, module_title: str,
                                      lesson_title: str, lesson_description: str,
                                      section: Dict[str, Any],
                                      previous_sections_content: str = "",
                                      course_context: Optional[List[Dict[str, Any]]] = None) -> Optional[str]:
        """Step 2+: Generate a single section of a lesson with full context."""
        course_ctx = self._build_course_context_text(course_context, module_title)
        
        prev_ctx = ""
        if previous_sections_content:
            # Truncate to avoid overly long context
            truncated = previous_sections_content[:3000]
            prev_ctx = f"\n\n--- CONTENT ALREADY WRITTEN IN THIS LESSON (for continuity) ---\n{truncated}\n--- END OF PREVIOUS CONTENT ---"

        prompt = f"""You are an expert professor writing a SINGLE SECTION of a comprehensive lesson.

Course: {course_title}
Module: {module_title}
Lesson: {lesson_title}
Lesson Description: {lesson_description}{course_ctx}{prev_ctx}

===== SECTION TO WRITE =====
Heading: {section.get('heading', 'Section')}
Purpose: {section.get('description', 'Generate educational content')}
Target Length: {section.get('target_words', 600)} words
Key Topics to Cover: {', '.join(section.get('key_topics', []))}

===== REQUIREMENTS =====
1. Write EXACTLY this one section — start with ## {section.get('heading', 'Section')}
2. Write at least {section.get('target_words', 600)} words of SUBSTANTIVE content
3. Include SPECIFIC examples, data, numbers, formulas where applicable
4. Reference real-world applications with specific companies or scenarios
5. Use professional terminology with clear explanations
6. Use proper markdown: ## headers, ### sub-headers, **bold**, `code`, lists, tables, blockquotes
7. DO NOT repeat content from previous sections (shown above)
8. DO NOT repeat content from other lessons in the course (shown in course structure)
9. Build naturally on what came before — reference previous sections where relevant
10. Write as a professor teaching, not summarizing

Return ONLY the markdown content for this section (no JSON wrapper, no extra explanation)."""

        result, provider = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        return result.strip() if result else None

    def generate_lesson_deep_enhance(self, lesson_title: str, full_content: str,
                                      learning_objectives: List[str],
                                      course_context: Optional[List[Dict[str, Any]]] = None,
                                      module_title: str = "") -> Optional[str]:
        """Final step: Quality enhancement pass — fix gaps, improve transitions, add depth."""
        course_ctx = self._build_course_context_text(course_context, module_title)

        # Only pass first 6000 chars to avoid token limits
        content_excerpt = full_content[:6000]
        objectives_text = "\n".join(f"- {obj}" for obj in learning_objectives) if learning_objectives else "Not specified"

        prompt = f"""You are a senior academic editor performing a FINAL QUALITY ENHANCEMENT pass on a lesson.

Lesson: {lesson_title}
Learning Objectives:
{objectives_text}
{course_ctx}

===== CURRENT CONTENT (may be truncated) =====
{content_excerpt}
===== END CONTENT =====

===== YOUR TASK =====
Review the content above and provide SPECIFIC ENHANCEMENTS ONLY where needed:

1. **Transitions**: Write 2-3 improved transition paragraphs between sections (specify which sections)
2. **Missing Depth**: Identify 2-3 sections that need more detail — provide the additional content
3. **Cross-References**: Add 2-3 references to how this lesson connects to other modules/lessons in the course
4. **Practical Value**: Add 1-2 additional real-world examples or case studies that are DIFFERENT from existing ones
5. **Key Formulas/Frameworks**: If applicable, summarize key frameworks in a reference table

Return ONLY a JSON object:
{{
  "transition_additions": [
    {{"after_section": "section heading", "content": "transition paragraph in markdown"}}
  ],
  "depth_additions": [
    {{"section": "section heading", "additional_content": "extra content to append in markdown"}}
  ],
  "cross_references": "A brief paragraph referencing connections to other course content",
  "additional_examples": "1-2 new real-world examples in markdown",
  "reference_summary": "Optional: summary table or framework reference in markdown"
}}"""

        result, provider = self.provider.make_ai_request(prompt, temperature=0.6, max_tokens=4096)
        if result:
            parsed = json_parser.parse_json_response(result, "enhancement pass")
            if parsed:
                return parsed
        return None


# Singleton instance
lesson_generator = LessonGenerator()
