"""
Lesson Generation Module
Handles AI-powered generation of lesson content including basic, comprehensive, and mixed content
"""

import re
import time
import json
import logging
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime

from .ai_providers import ai_provider_manager
from .json_parser import json_parser
from .content_validator import content_validator
from .fallback_generators import fallback_generators
from .rate_limit_handler import rate_limit_handler

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
        """Build a hierarchy-aware text block of the full course structure.

        Every lesson is rendered with the topics it actually teaches
        (covered_topics / content_summary) and a PRIOR KNOWLEDGE vs UPCOMING
        label from has_content, so generation prompts can both build on what
        the learner already studied and avoid repeating it.
        """
        if not course_context:
            return ""

        text = "\n\n===== FULL COURSE STRUCTURE (learning hierarchy — build on this, never duplicate it) ====="
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
                    has_content = les.get('has_content')
                    if has_content is True:
                        text += " [PRIOR KNOWLEDGE — already taught]"
                    elif has_content is False:
                        text += " [UPCOMING — planned, not yet written]"
                    topics = les.get('covered_topics')
                    if topics:
                        text += "\n    Topics covered: " + "; ".join(topics[:12])
                    elif les.get('content_summary'):
                        text += f"\n    Topics covered: {les['content_summary'][:240]}"
            else:
                text += "\n    (no lessons yet)"
        text += ("\n\n[HIERARCHY RULES — modules and lessons form a sequence the learner reads in order:"
                 "\n1. PRIOR KNOWLEDGE lessons were already studied — build on them by REFERENCE only; never re-teach their listed topics."
                 "\n2. UPCOMING lessons are planned but unwritten — do not preempt their topics; defer advanced material to them with a one-line forward reference."
                 "\n3. If content from another lesson is needed here, cite it in one sentence (\"covered in depth in <lesson>\") instead of repeating it."
                 "\n4. No section heading you write may repeat or paraphrase a topic listed above.]")
        return text

    def generate_lesson_content(self, course_title: str, module_title: str,
                               module_description: str, module_objectives: str,
                               lesson_title: str = "", lesson_description: str = "",
                               existing_lessons: Optional[List[Dict[str, Any]]] = None,
                               course_context: Optional[List[Dict[str, Any]]] = None,
                               difficulty_level: str = "intermediate",
                               session_id: str = None, task_id: str = None) -> Dict[str, Any]:
        """
        Generate detailed lesson content with markdown formatting
        
        Args:
            course_title: Parent course title
            module_title: Parent module title
            module_description: Module description for context
            module_objectives: Module learning objectives
            lesson_title: Lesson title (optional)
            lesson_description: Brief lesson description (optional)
            existing_lessons: Sequence context for the module — each dict may carry
                content_summary/covered_topics/has_content so prior-knowledge
                (has_content) lessons are built upon and upcoming stubs are not
                preempted
            course_context: Full course structure with covered_topics/has_content
                per lesson for cross-module hierarchy awareness
            
        Returns:
            Dict with lesson title, description, objectives, markdown content,
            plus builds_on / assumes_knowledge hierarchy metadata
        """
        existing_lessons_text = ""
        if existing_lessons and len(existing_lessons) > 0:
            # Exclude the lesson being (re)generated from its own prior knowledge
            target_key = (lesson_title or '').strip().lower()
            sequence = [
                les for les in existing_lessons
                if not (target_key and str(les.get('title', '')).strip().lower() == target_key)
            ]
            prior = [les for les in sequence if les.get('has_content', True)]
            upcoming = [les for les in sequence if not les.get('has_content', True)]

            def _lesson_line(lesson):
                line = f"\n{lesson.get('order', '?')}. {lesson['title']}"
                if lesson.get('description'):
                    line += f"\n   Description: {lesson['description']}"
                if lesson.get('duration_minutes'):
                    line += f"\n   Duration: {lesson['duration_minutes']} minutes"
                topics = lesson.get('covered_topics')
                if topics:
                    line += "\n   Topics covered: " + "; ".join(topics[:12])
                elif lesson.get('content_summary'):
                    line += f"\n   Topics covered: {lesson['content_summary'][:240]}"
                return line

            if prior:
                existing_lessons_text = "\n\nPRIOR KNOWLEDGE — lessons the learner has ALREADY STUDIED (read in this order):"
                for lesson in prior:
                    existing_lessons_text += _lesson_line(lesson)
            if upcoming:
                existing_lessons_text += "\n\nUPCOMING PLANNED LESSONS in this module (not yet written — do NOT cover their topics here):"
                for lesson in upcoming:
                    existing_lessons_text += f"\n{lesson.get('order', '?')}. {lesson['title']}"
                    if lesson.get('description'):
                        existing_lessons_text += f" — {lesson['description'][:160]}"
            if sequence:
                next_num = max(int(les.get('order') or 0) for les in sequence) + 1
                if lesson_title:
                    existing_lessons_text += (
                        f"\n\n[CONTEXT: the lesson you are writing sits AFTER the {len(prior)} prior-knowledge "
                        f"lesson(s) and BEFORE the {len(upcoming)} upcoming planned lesson(s) listed above. "
                        "It must continue from the prior knowledge without repeating it.]"
                    )
                else:
                    existing_lessons_text += f"\n\n[IMPORTANT: Generate the NEXT lesson (Lesson {next_num}) that:"
                    existing_lessons_text += "\n- Builds upon the PRIOR KNOWLEDGE lessons naturally (bridge to them, never re-teach them)"
                    existing_lessons_text += "\n- Covers NEW content not already taught"
                    existing_lessons_text += "\n- Fills gaps in the learning progression without preempting UPCOMING lessons"
                    existing_lessons_text += "\n- Maintains logical flow and difficulty progression]"
            else:
                existing_lessons_text += "\n\n[This is the FIRST lesson of the module — orient the learner and preview what follows.]"
        
        # Cross-module context
        course_context_text = self._build_course_context_text(course_context, module_title)
        
        prompt = f"""You are an expert professor and curriculum designer creating COMPREHENSIVE, UNIVERSITY-LEVEL lesson content.

Course: {course_title}
Module: {module_title}
Module Description: {module_description}
Module Objectives: {module_objectives}
Difficulty Level: {difficulty_level}{existing_lessons_text}{course_context_text}
{'Lesson Title: ' + lesson_title if lesson_title else 'You MUST generate a SPECIFIC, DESCRIPTIVE lesson title that clearly reflects the topic being taught. Do NOT use generic titles like "Course Lesson", "Lesson Title", or "Module Lesson".'}
{'Lesson Focus: ' + lesson_description if lesson_description else ''}

===== HIERARCHY CONTRACT — BUILD ON WHAT CAME BEFORE =====
Lessons are studied IN ORDER. PRIOR KNOWLEDGE lessons (listed above) are what this learner already knows; UPCOMING lessons are planned and must not be preempted; the FULL COURSE STRUCTURE shows every other module's taught topics.

MANDATORY:
1. BRIDGE: Start the Introduction with a "Building on previous lessons" paragraph —
   one sentence naming the prior lesson(s) this continues from (by title), then 2-3
   bullets of the exact concepts from those lessons this lesson assumes.
   (If there are no prior lessons, orient the learner at the start of the course
   and preview what follows instead.)
2. ASSUME, NEVER RETEACH: A concept listed as prior knowledge may appear at most
   once, as one recall sentence: "As covered in '<lesson title>', <one-sentence recap>."
   Never re-derive, re-explain, or re-list what a prior lesson already taught.
3. SIDEWAYS REFERENCE: If a needed subtopic already appears in ANY "Topics covered"
   list above (including other modules), do NOT teach it — cite it in one sentence
   ("covered in depth in '<lesson title>'") and continue.
4. ZERO REPEATED HEADINGS: no ## section heading may repeat or closely paraphrase a
   topic already listed above. If a topic was introduced elsewhere, go DEEPER into a
   specific aspect or cover a genuinely new angle.
5. SCOPE BOUNDARY: teach only THIS lesson's objectives. Material that belongs to an
   UPCOMING lesson or a later module gets a one-line forward reference
   ("we deepen this in '<lesson>'") — never full coverage here.

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
  "builds_on": ["Exact title of the prior lesson(s) this lesson continues from"],
  "assumes_knowledge": ["Specific concept the learner already has from those prior lessons"],
  "content_data": "# Introduction\\n\\n[400-500 word engaging introduction...]\\n\\n## Section 1: [Topic]\\n\\n[500-800 words of detailed content...]\\n\\n## Section 2: [Topic]\\n\\n[500-800 words...]\\n\\n[Continue for all sections...]\\n\\n## Worked Examples\\n\\n[Detailed examples with solutions...]\\n\\n## Key Takeaways\\n\\n[Specific actionable points...]\\n\\n## Discussion Questions\\n\\n[Thought-provoking questions...]"
}}"""
        
        # Request more tokens to accommodate comprehensive content (3000-4000 words)
        result, provider = rate_limit_handler.execute_with_retry(
            self.provider.make_ai_request,
            prompt,
            session_id=session_id,
            task_id=task_id,
            step_label=f"Generating lesson content: {lesson_title or module_title}",
            temperature=0.7,
            max_tokens=8192,
        )
        
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
            alternative = self.provider.alternative_provider()
            if alternative:
                self.provider.force_provider(alternative)
                logger.info(f"Switched to {alternative} for lesson generation retry")
            else:
                logger.warning("No alternative AI provider available for lesson generation retry")
            
            # Retry with alternative provider
            result, provider = rate_limit_handler.execute_with_retry(
                self.provider.make_ai_request,
                prompt,
                session_id=session_id,
                task_id=task_id,
                step_label=f"Generating lesson content (fallback provider): {lesson_title or module_title}",
                temperature=0.8,
                max_tokens=8192,
            )
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
                                  course_context: Optional[List[Dict[str, Any]]] = None,
                                  session_id: str = None, task_id: str = None) -> Dict[str, Any]:
        """
        Generate multiple lesson outlines at once for a module.
        
        OUTLINES ONLY — no content_data is generated. Content is generated
        separately via generate_lesson_content, generate_lesson_deep_section,
        or the content enhancement pipeline.
        
        This approach:
        - Plans the entire module's lesson structure in ONE API call
        - Reduces token waste (no content that may need to be regenerated)
        - Allows content generation to be customized per-lesson
        - Dramatically reduces rate limit hits
        
        Args:
            course_title: Parent course title
            module_title: Parent module title
            module_description: Module description for context
            module_objectives: Module learning objectives
            num_lessons: Number of lesson outlines to generate
            existing_lessons: List of existing lessons in the module for context
            course_context: Full course structure for cross-module awareness
            
        Returns:
            Dict containing list of lesson outlines (no content_data)
        """
        # Delegate to the dedicated outlines-only generator
        return self.generate_all_lesson_outlines(
            course_title=course_title,
            module_title=module_title,
            module_description=module_description,
            module_objectives=module_objectives,
            num_lessons=num_lessons,
            existing_lessons=existing_lessons,
            course_context=course_context,
            session_id=session_id,
            task_id=task_id,
        )
    
    def generate_mixed_content(self, course_title: str, module_title: str,
                              module_description: str, lesson_title: str,
                              lesson_description: str = "",
                              template_id: Optional[str] = None,
                              existing_sections: Optional[List[Dict[str, Any]]] = None,
                              session_id: str = None, task_id: str = None) -> Dict[str, Any]:
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
            existing_context = "\n\nExisting Content Sections:\n"
            for idx, section in enumerate(existing_sections, 1):
                existing_context += f"\n{idx}. {section.get('type', 'unknown').upper()}: "
                if section['type'] == 'heading':
                    existing_context += section.get('content', '')
                elif section['type'] in ['text']:
                    content_preview = section.get('content', '')[:100]
                    existing_context += f"{content_preview}..."
                elif section['type'] in ['video', 'pdf', 'image']:
                    existing_context += section.get('title', 'Untitled')
            existing_context += "\n\n[Generate sections that complement and extend this existing content]"

        template_structure = self.TEMPLATES.get(template_id, None) if template_id else None
        template_guidance = ""
        if template_structure:
            template_guidance = f"\n\nTEMPLATE STRUCTURE ({template_id}) — FOLLOW THIS EXACTLY:\n"
            for idx, section in enumerate(template_structure, 1):
                template_guidance += f"{idx}. {section['type'].upper()}: {section['role']}\n"
            template_guidance += (
                "\nYour \"sections\" array MUST contain, IN THIS ORDER, one entry for each numbered "
                "slot above (same type in the same position). After the required slots you MAY append "
                "extra sections (more text/heading/media blocks) if the lesson needs them.\n"
                "[Generate content following this exact structure]"
            )

        prompt = self._build_mixed_content_prompt(
            course_title, module_title, module_description,
            lesson_title, lesson_description, existing_context,
            template_guidance, template_id
        )

        result, provider = rate_limit_handler.execute_with_retry(
            self.provider.make_ai_request,
            prompt,
            session_id=session_id,
            task_id=task_id,
            step_label=f"Generating mixed content: {lesson_title}",
            temperature=0.7,
            max_tokens=16384,
        )
        sections = None
        if result:
            parsed = json_parser.parse_json_response(result, "mixed content")
            if parsed and isinstance(parsed.get('sections'), list) and parsed['sections']:
                sections = parsed['sections']

        if sections is not None:
            # Merge onto the selected template so slots stay filled in template
            # order and any extra AI sections are appended at the end.
            if template_structure:
                sections = self._merge_sections_with_template(template_structure, sections)
            sections = self._normalize_mixed_sections(sections)

            if not self._mixed_text_is_thin(sections) or not template_structure:
                return {
                    "sections": sections,
                    "lesson_title": lesson_title,
                    "template_used": template_id
                }

            # Text sections came back skeletal (e.g. truncated JSON recovery).
            # Ask once more, this time showing the model what it already wrote.
            retry_prompt = (
                f"{prompt}\n\n"
                "CRITICAL RETRY INSTRUCTION: Your previous attempt produced text sections "
                "that were far too short (learning-objectives-level stubs instead of full prose). "
                "Rewrite the FULL lesson. Every TEXT section must contain 300+ words of real, "
                "detailed prose with concrete examples — not bullet stubs. Keep the same JSON "
                "schema and the same template structure."
            )
            retry_result, _ = rate_limit_handler.execute_with_retry(
                self.provider.make_ai_request,
                retry_prompt,
                session_id=session_id,
                task_id=task_id,
                step_label=f"Expanding mixed content: {lesson_title}",
                temperature=0.7,
                max_tokens=16384,
            )
            if retry_result:
                retry_parsed = json_parser.parse_json_response(retry_result, "mixed content retry")
                if retry_parsed and isinstance(retry_parsed.get('sections'), list) and retry_parsed['sections']:
                    retry_sections = retry_parsed['sections']
                    if template_structure:
                        retry_sections = self._merge_sections_with_template(template_structure, retry_sections)
                    retry_sections = self._normalize_mixed_sections(retry_sections)
                    if not self._mixed_text_is_thin(retry_sections):
                        return {
                            "sections": retry_sections,
                            "lesson_title": lesson_title,
                            "template_used": template_id
                        }
            # First attempt's sections are better than the skeleton fallback.
            return {
                "sections": sections,
                "lesson_title": lesson_title,
                "template_used": template_id
            }

        return fallback_generators.generate_fallback_mixed_content(lesson_title, template_id)

    def _normalize_mixed_sections(self, sections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Coerce mixed-content sections into the flat block shape the builder expects."""
        normalized = []
        for section in sections or []:
            if not isinstance(section, dict):
                continue
            stype = str(section.get('type', 'text')).lower()
            if stype not in ('heading', 'text', 'video', 'pdf', 'image'):
                stype = 'text'
            content = section.get('content', '')
            if isinstance(content, (list, dict)):
                content = json.dumps(content)
            content = str(content or '')
            item: Dict[str, Any] = {'type': stype, 'content': content.strip()}
            title = section.get('title') or section.get('name') or ''
            if title:
                item['title'] = str(title)
            url = section.get('url', '')
            if url:
                item['url'] = str(url)
            caption = section.get('caption', '')
            if caption:
                item['caption'] = str(caption)
            normalized.append(item)
        return normalized

    def _mixed_text_is_thin(self, sections: List[Dict[str, Any]]) -> bool:
        """True when any text section has fewer than 30 words.

        A rich intro next to a stub takeaways section means generation was cut
        off mid-JSON — the salvage kept only complete sections, leaving template
        placeholders in the remaining text slots. That is incomplete, not
        skeleton-only, so it must count as thin (→ retry).
        """
        text_counts = []
        for section in sections or []:
            if section.get('type') != 'text':
                continue
            content = section.get('content', '') or ''
            text_counts.append(len(re.findall(r'\w+', content)))
        if not text_counts:
            return True
        return any(count < 30 for count in text_counts)

    def _merge_sections_with_template(
        self,
        template_structure: List[Dict[str, Any]],
        generated_sections: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Fill the selected template's slots (in order) from generated sections.

        Each template slot picks the best unused generated section of the same
        type: order-affinity (section appearing after the last match) and keyword
        overlap with the slot's role/content both count, so a misordered AI
        response still lands the right prose in the right slot. Generated
        sections beyond the template's length are appended at the end so the AI
        can extend the lesson when needed.
        """
        generated = [s for s in (generated_sections or []) if isinstance(s, dict)]
        used = [False] * len(generated)
        merged: List[Dict[str, Any]] = []
        cursor = 0

        for slot in template_structure:
            slot_type = slot.get('type', 'text')
            keywords = self._slot_keywords(slot)

            best_idx = None
            best_score = None
            for idx, gen in enumerate(generated):
                if used[idx] or gen.get('type') != slot_type:
                    continue
                haystack = f"{gen.get('content', '')} {gen.get('title', '')}".lower()
                score = 2 if idx >= cursor else 0
                for word in keywords:
                    if word in haystack:
                        score += 5
                if best_score is None or score > best_score:
                    best_score = score
                    best_idx = idx

            if best_idx is None:
                # No generated section of this type left — keep the template placeholder.
                merged.append(dict(slot))
                continue

            used[best_idx] = True
            cursor = best_idx + 1
            gen = generated[best_idx]
            filled: Dict[str, Any] = {'type': slot_type, 'content': gen.get('content', '')}
            title = gen.get('title') or slot.get('content') or slot.get('title', '')
            if title:
                filled['title'] = str(title)
            if gen.get('url'):
                filled['url'] = gen['url']
            if gen.get('caption'):
                filled['caption'] = gen['caption']
            merged.append(filled)

        # Append extra generated sections the template didn't account for.
        for idx, gen in enumerate(generated):
            if not used[idx]:
                extra: Dict[str, Any] = {'type': gen.get('type', 'text'), 'content': gen.get('content', '')}
                if gen.get('title'):
                    extra['title'] = gen['title']
                if gen.get('url'):
                    extra['url'] = gen['url']
                if gen.get('caption'):
                    extra['caption'] = gen['caption']
                merged.append(extra)

        return merged

    @staticmethod
    def _slot_keywords(slot: Dict[str, Any]) -> List[str]:
        """Extract meaningful keywords from a template slot's role/content hints."""
        raw = f"{slot.get('role', '')} {slot.get('content', '')}".lower()
        stop = {
            'text', 'video', 'heading', 'image', 'pdf', 'url', 'placeholder',
            'notes', 'about', 'content', 'section', 'type', 'insert', 'here',
        }
        return [
            token for token in re.findall(r'[a-z]{4,}', raw)
            if token not in stop
        ]
    
    def _build_mixed_content_prompt(self, course_title: str, module_title: str,
                                   module_description: str, lesson_title: str,
                                   lesson_description: str, existing_context: str,
                                   template_guidance: str, template_id: str) -> str:
        """Build the prompt for mixed content generation"""
        template_structure = self.TEMPLATES.get(template_id) if template_id else None
        if template_structure:
            example_block = self._template_example_json(template_structure)
            shape_note = (
                "The JSON example below lists EXACTLY the sections you must return, "
                "in this order, with these types. Fill each entry with real content. "
                "You MAY append extra sections after the last one if the lesson needs them."
            )
        else:
            example_block = self._generic_example_json()
            shape_note = (
                "The JSON example below shows the expected shape and level of detail. "
                "Adapt the section list to this lesson."
            )

        return f"""You are an expert professor and instructional designer creating COMPREHENSIVE, UNIVERSITY-LEVEL lesson content.

**Course Context:**
- Course: {course_title}
- Module: {module_title}
- Module Description: {module_description}
- Lesson Title: {lesson_title}
{f'- Lesson Description: {lesson_description}' if lesson_description else ''}{existing_context}{template_guidance}

===== CRITICAL REQUIREMENTS =====

Create a complete, professional lesson with RICH, DETAILED content (minimum 1400-1800 total words).

**TEXT SECTION REQUIREMENTS:**
Each TEXT section MUST be SUBSTANTIAL and COMPREHENSIVE (250-500 words of real prose each):

- Opening prose: hook, professional relevance, preview, specific learning objectives
- Main content: detailed theory, step-by-step procedures, SPECIFIC examples with
  actual data/numbers/formulas, real-world applications, common mistakes, best practices
- Closing prose: concrete actionable takeaways

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

CRITICAL: Return ONLY valid JSON — no markdown fences, no commentary, no reasoning before or after.
Inside the JSON strings, represent line breaks with the standard JSON newline escape `\n`
(single backslash). Do NOT use literal newlines inside string values and do NOT double-escape.

{shape_note}

{example_block}

The example shows `\\n` (escaped once for JSON) — in the string VALUE that becomes a real
newline. Emit exactly that: `\\n` inside the quoted content strings, nothing else."""

    def _template_example_json(self, template_structure: List[Dict[str, Any]]) -> str:
        """Build a JSON example that mirrors the selected template's slots exactly."""
        entries = []
        word_budgets = ['250-350', '350-500', '350-500', '300-400', '350-500', '300-400']
        text_idx = 0
        for slot in template_structure:
            stype = slot.get('type', 'text')
            if stype == 'heading':
                entry = {'type': 'heading', 'content': '[Your Section Title]', 'title': '[Your Section Title]'}
            elif stype == 'text':
                budget = word_budgets[min(text_idx, len(word_budgets) - 1)]
                text_idx += 1
                entry = {
                    'type': 'text',
                    'content': (
                        f'## [Your Section Title]\n\n[Write {budget} words of detailed, '
                        f'professor-quality prose for this section. '
                        f'Separate paragraphs with blank lines.]'
                    ),
                }
            else:
                placeholder = {
                    'video': '[INSERT_VIDEO_URL_HERE]',
                    'pdf': '[INSERT_PDF_URL_HERE]',
                    'image': '[INSERT_IMAGE_URL_HERE]',
                }.get(stype, '[INSERT_URL_HERE]')
                entry = {
                    'type': stype,
                    'url': placeholder,
                    'title': f'[What this {stype} shows]',
                    'description': f'[Describe what this {stype} covers...]',
                }
            # json.dumps escapes quotes/backslashes/newlines correctly so the
            # example is always valid JSON (and demonstrates real \n escapes).
            entries.append('    ' + json.dumps(entry, ensure_ascii=False))
        return '{\n  "sections": [\n' + ',\n'.join(entries) + '\n  ]\n}'

    def _generic_example_json(self) -> str:
        """JSON example used when no template is selected."""
        return '''{
  "sections": [
    {"type": "heading", "content": "Introduction", "title": "Introduction"},
    {"type": "text", "content": "## Introduction\\n\\nWrite 250-350 words of engaging, detailed introduction content here. Use \\n\\n between paragraphs."},
    {"type": "heading", "content": "Core Concepts", "title": "Core Concepts"},
    {"type": "text", "content": "## Core Concepts\\n\\nWrite 350-500 words of comprehensive theory with concrete examples."},
    {"type": "video", "url": "[INSERT_VIDEO_URL_HERE]", "title": "Video Tutorial", "description": "Detailed description of video content..."},
    {"type": "heading", "content": "Practical Application", "title": "Practical Application"},
    {"type": "text", "content": "## Practical Application\\n\\nWrite 300-400 words with detailed, worked examples."},
    {"type": "heading", "content": "Key Takeaways", "title": "Key Takeaways"},
    {"type": "text", "content": "## Key Takeaways\\n\\nWrite 150-250 words with specific, actionable points."}
  ]
}'''
    
    def generate_lesson_section(self, lesson_title: str, section_type: str,
                               section_context: Dict[str, Any],
                               difficulty_level: str = "intermediate",
                               session_id: str = None, task_id: str = None) -> str:
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
        
        result, _ = rate_limit_handler.execute_with_retry(
            self.provider.make_ai_request,
            prompt,
            session_id=session_id,
            task_id=task_id,
            step_label=f"Generating lesson section: {section_type}",
            temperature=0.7,
            max_tokens=4000,
        )
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
                                      course_context: Optional[List[Dict[str, Any]]] = None,
                                      difficulty_level: str = "intermediate",
                                      session_id: str = None, task_id: str = None) -> Optional[Dict[str, Any]]:
        """Step 1: Generate a detailed lesson outline with sections, topics, and structure."""
        existing_text = ""
        if existing_lessons:
            # Exclude the lesson being outlined from its own prior knowledge
            target_key = (lesson_title or '').strip().lower()
            sequence = [
                les for les in existing_lessons
                if not (target_key and str(les.get('title', '')).strip().lower() == target_key)
            ]
            prior = [les for les in sequence if les.get('has_content', True)]
            upcoming = [les for les in sequence if not les.get('has_content', True)]
            if prior:
                existing_text = "\n\nPRIOR KNOWLEDGE — lessons the learner has ALREADY STUDIED (in order):"
                for les in prior:
                    existing_text += f"\n  {les.get('order', '?')}. {les.get('title', 'Untitled')}"
                    if les.get('description'):
                        existing_text += f" — {les['description'][:120]}"
                    topics = les.get('covered_topics')
                    if topics:
                        existing_text += "\n      Topics: " + "; ".join(topics[:12])
                    elif les.get('content_summary'):
                        existing_text += f"\n      Topics: {les['content_summary'][:180]}"
            if upcoming:
                existing_text += "\n\nUPCOMING PLANNED LESSONS in this module (not yet written — reserve their topics, do NOT plan them here):"
                for les in upcoming:
                    existing_text += f"\n  {les.get('order', '?')}. {les.get('title', 'Untitled')}"
                    if les.get('description'):
                        existing_text += f" — {les['description'][:160]}"
            if not sequence:
                existing_text += "\n\n[This is the FIRST lesson of the module — orient the learner and preview what follows.]"

        course_ctx = self._build_course_context_text(course_context, module_title)

        prompt = f"""You are an expert professor designing a DETAILED lesson outline.

Course: {course_title}
Module: {module_title}
Module Description: {module_description}
Module Objectives: {module_objectives}
Difficulty Level: {difficulty_level}{existing_text}{course_ctx}
{'Lesson Title: ' + lesson_title if lesson_title else 'You MUST choose a SPECIFIC, DESCRIPTIVE lesson title that clearly indicates the topic (NOT generic like "Course Lesson", "Lesson Title", or "Module Lesson"). The title should reflect the actual subject matter being taught.'}
{'Lesson Focus: ' + lesson_description if lesson_description else ''}

Create a comprehensive lesson outline. This is ONLY the structure — content will be generated separately for each section.

Return ONLY valid JSON:
{{
  "title": "Specific lesson title",
  "description": "3-4 sentence description of what this lesson covers and its value",
  "learning_objectives": ["Objective 1 with action verb", "Objective 2", "Objective 3", "Objective 4", "Objective 5"],
  "duration_minutes": 60,
  "builds_on": ["Exact title of the prior lesson(s) this outline continues from (omit for the first lesson)"],
  "assumes_knowledge": ["Specific concept the learner already has from those prior lessons"],
  "sections": [
    {{
      "id": "introduction",
      "heading": "Introduction",
      "description": "The bridge from prior lessons (name them, state assumed concepts) plus what this section covers and its purpose",
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
- Ensure ZERO overlap with PRIOR KNOWLEDGE topics listed above — this lesson builds on them by reference, never repeats them
- The Introduction's description MUST specify the bridge: which prior lesson(s) it continues from (by title) and which concepts it assumes from them
- Each section should build on the previous one
- Do not preempt UPCOMING planned lessons — reserve their topics for them
- Include practical applications and real-world examples in the plan        CRITICAL: Return ONLY valid JSON. No markdown, no explanatory text, no code blocks — just the raw JSON object."""

        result, provider = rate_limit_handler.execute_with_retry(
            self.provider.make_ai_request,
            prompt,
            session_id=session_id,
            task_id=task_id,
            step_label=f"Generating deep lesson outline for {lesson_title or module_title}",
            temperature=0.6,
            max_tokens=4096,
        )
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
                                      course_context: Optional[List[Dict[str, Any]]] = None,
                                      difficulty_level: str = "intermediate",
                                      session_id: str = None, task_id: str = None,
                                      hierarchy: Optional[Dict[str, Any]] = None) -> Optional[str]:
        """Step 2+: Generate a single section of a lesson with full context.

        hierarchy: optional dict with builds_on / assumes_knowledge carried
        from the lesson outline, so each section continues the lesson's
        place in the course sequence instead of restating prior lessons.
        """
        course_ctx = self._build_course_context_text(course_context, module_title)
        
        prev_ctx = ""
        if previous_sections_content:
            # Truncate to avoid overly long context
            truncated = previous_sections_content[:3000]
            prev_ctx = f"\n\n--- CONTENT ALREADY WRITTEN IN THIS LESSON (for continuity) ---\n{truncated}\n--- END OF PREVIOUS CONTENT ---"

        hier_ctx = ""
        if hierarchy:
            builds_on = [str(b) for b in (hierarchy.get('builds_on') or []) if b]
            assumes = [str(a) for a in (hierarchy.get('assumes_knowledge') or []) if a]
            if builds_on or assumes:
                hier_ctx = "\n\n===== LESSON HIERARCHY (planned in the outline) ====="
                if builds_on:
                    hier_ctx += "\nBuilds on — continue from these, never re-teach: " + "; ".join(builds_on[:5])
                if assumes:
                    hier_ctx += "\nAssumes the learner already knows (one-sentence recall max each): " + "; ".join(assumes[:8])

        prompt = f"""You are an expert professor writing a SINGLE SECTION of a comprehensive lesson.

Course: {course_title}
Module: {module_title}
Lesson: {lesson_title}
Lesson Description: {lesson_description}
Difficulty Level: {difficulty_level}{course_ctx}{prev_ctx}{hier_ctx}

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
11. If hierarchy is shown above: when writing the Introduction, open with the bridge —
    name the prior lesson(s) by title and state the assumed concepts
12. Assume the listed prior knowledge: at most one recall sentence per concept
    ("As covered in '<lesson>', <one sentence>"), never a re-explanation

Return ONLY the markdown content for this section (no JSON wrapper, no extra explanation)."""

        result, provider = rate_limit_handler.execute_with_retry(
            self.provider.make_ai_request,
            prompt,
            session_id=session_id,
            task_id=task_id,
            step_label=f"Generating section: {section.get('heading', '')}",
            temperature=0.7,
            max_tokens=4096,
        )
        return result.strip() if result else None

    def generate_lesson_deep_enhance(self, lesson_title: str, full_content: str,
                                      learning_objectives: List[str],
                                      course_context: Optional[List[Dict[str, Any]]] = None,
                                      module_title: str = "",
                                      session_id: str = None, task_id: str = None) -> Optional[str]:
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

        result, provider = rate_limit_handler.execute_with_retry(
            self.provider.make_ai_request,
            prompt,
            session_id=session_id,
            task_id=task_id,
            step_label="Quality enhancement pass",
            temperature=0.6,
            max_tokens=4096,
        )
        if result:
            parsed = json_parser.parse_json_response(result, "enhancement pass")
            if parsed:
                return parsed
        return None

    # =====================================================================
    # BATCH LESSON OUTLINE GENERATION
    # Generates ALL lesson outlines (titles, descriptions, objectives) in
    # ONE API call. Content is generated separately later. This dramatically
    # reduces API calls from N to 1 for lesson planning.
    # =====================================================================

    def generate_all_lesson_outlines(self, course_title: str, module_title: str,
                                      module_description: str, module_objectives: str,
                                      num_lessons: int = 5,
                                      existing_lessons: Optional[List[Dict[str, Any]]] = None,
                                      course_context: Optional[List[Dict[str, Any]]] = None,
                                      session_id: str = None, task_id: str = None) -> Dict[str, Any]:
        """
        Generate ALL lesson outlines (titles, descriptions, objectives) for a module
        in a SINGLE API call. No content is generated — just the plan.
        
        This is 5-8x more efficient than stepwise generation for reducing
        rate limit hits.
        
        Args:
            course_title: Parent course title
            module_title: Parent module title
            module_description: Module description
            module_objectives: Module learning objectives
            num_lessons: Number of lesson outlines to generate
            existing_lessons: Existing lessons to avoid duplication
            course_context: Full course structure for cross-reference
            
        Returns:
            Dict with "lessons" list containing title, description, objectives, duration
        """
        existing_text = ""
        start_num = 1
        if existing_lessons and len(existing_lessons) > 0:
            existing_text = f"\n\nExisting Lessons ({len(existing_lessons)}):\n"
            for les in existing_lessons:
                existing_text += f"  {les.get('order', '?')}. {les.get('title', 'Untitled')}"
                if les.get('description'):
                    existing_text += f" — {les['description'][:100]}"
                if les.get('has_content') is True:
                    existing_text += " [PRIOR KNOWLEDGE — already taught]"
                elif les.get('has_content') is False:
                    existing_text += " [UPCOMING — planned]"
                topics = les.get('covered_topics')
                if topics:
                    existing_text += "\n      Topics: " + "; ".join(topics[:10])
                elif les.get('content_summary'):
                    existing_text += f"\n      Topics: {les['content_summary'][:180]}"
                existing_text += "\n"
            start_num = max(int(les.get('order') or 0) for les in existing_lessons) + 1
            existing_text += (f"\n[Generate {num_lessons} NEW lessons starting from Lesson {start_num}. "
                              "They continue the sequence: build on the prior-knowledge lessons and "
                              "overlap NONE of the topics listed above.]")
        
        course_ctx = self._build_course_context_text(course_context, module_title)
        
        prompt = f"""You are an expert curriculum designer. Plan {num_lessons} lesson outlines for a module.

Course: {course_title}
Module: {module_title}
Description: {module_description}
Objectives: {module_objectives}{existing_text}{course_ctx}

===== CRITICAL =====
- Each lesson title MUST be SPECIFIC and UNIQUE — no generic titles
- Ensure ZERO overlap between lessons — each covers a distinct sub-topic
- HIERARCHY: each lesson's description must state what it builds on — name the
  lesson it continues from (the first new lesson continues from the last existing
  lesson or prior module; every subsequent one continues from its predecessor),
  and set "builds_on" accordingly
- Do not cover topics already listed as Topics above — those were taught or planned
- Content will be generated SEPARATELY — just provide the outline here
- Progress from fundamentals to advanced topics

Return ONLY valid JSON:
{{
  "lessons": [
    {{
      "order": {start_num},
      "title": "Specific descriptive lesson title",
      "description": "2-3 sentences: what this lesson covers, what it continues from, and its value",
      "builds_on": ["Title of the previous lesson this continues from"],
      "learning_objectives": "• Objective 1\\n• Objective 2\\n• Objective 3",
      "duration_minutes": 60
    }}
  ]
}}"""
        
        result, provider = rate_limit_handler.execute_with_retry(
            self.provider.make_ai_request,
            prompt,
            session_id=session_id,
            task_id=task_id,
            step_label=f"Planning {num_lessons} lesson outlines for {module_title}",
            temperature=0.6,
            max_tokens=4096,
        )
        if result:
            parsed = json_parser.parse_json_response(result, "lesson outlines")
            if parsed and 'lessons' in parsed:
                lessons = parsed['lessons']
                # Collect existing lesson titles (case-insensitive) for deduplication
                # This includes:
                # 1) Lessons already in the current module (existing_lessons)
                # 2) Lessons from OTHER modules in the same course (course_context)
                existing_title_set = set()
                if existing_lessons:
                    existing_title_set = {les.get('title', '').strip().lower() for les in existing_lessons}

                # Also deduplicate against lessons in other modules (cross-module dedup)
                cross_module_count = 0
                if course_context:
                    for mod in course_context:
                        mod_title = mod.get('title', '')
                        for les in mod.get('lessons', []):
                            title_key = les.get('title', '').strip().lower()
                            if title_key:
                                existing_title_set.add(title_key)
                                cross_module_count += 1
                    if cross_module_count:
                        logger.info(f"Cross-module dedup: loaded {cross_module_count} lesson titles from {len(course_context)} modules in course {course_title}")

                # Validate and fix generic titles
                deduplicated = []
                seen_titles = set(existing_title_set)  # also track intra-batch duplicates
                for idx, lesson in enumerate(lessons):
                    lesson_num = lesson.get('order', idx + start_num)
                    if self._is_generic_title(lesson.get('title', '')):
                        lesson['title'] = self._generate_meaningful_title(
                            module_title, course_title, existing_lessons, lesson_num
                        )
                    lesson['order'] = lesson_num

                    # Deduplication: skip lessons whose titles already exist
                    title_key = lesson.get('title', '').strip().lower()
                    if title_key and title_key in seen_titles:
                        logger.info(f"Skipping duplicate lesson outline: '{lesson.get('title')}'")
                        continue
                    seen_titles.add(title_key)
                    deduplicated.append(lesson)

                # Validate and normalize order numbers
                for idx, lesson in enumerate(deduplicated):
                    lesson['order'] = idx + start_num

                logger.info(f"Batch generated {len(deduplicated)} lesson outlines using {provider} (removed {len(lessons) - len(deduplicated)} duplicates, cross-module dedup active)")
                if not deduplicated:
                    logger.warning("All generated lesson outlines already exist — nothing new to add")
                    return {
                        "lessons": [],
                        "reason": "All generated lesson titles already exist in this course",
                    }
                return {"lessons": deduplicated}
        
        logger.warning("Failed to generate lesson outlines, returning empty")
        return {"lessons": []}


# Singleton instance
lesson_generator = LessonGenerator()
