"""
AI Agent Service for Afritec Bridge LMS
Uses Google Gemini API to assist instructors with course content generation
"""

import os
import json
from typing import Dict, List, Optional, Any
import logging
import time
from datetime import datetime, timedelta
from collections import deque

logger = logging.getLogger(__name__)

# Import Google Generative AI SDK
try:
    import google.generativeai as genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    logger.warning("google-generativeai package not installed. AI features will be limited.")

class AIAgentService:
    """Service to handle AI-assisted course content generation using Gemini API"""
    
    def __init__(self):
        self.api_key = os.environ.get('GEMINI_API_KEY')
        self.model = None
        
        # Rate limiting configuration
        self.max_requests_per_minute = int(os.environ.get('GEMINI_MAX_RPM', '15'))  # Conservative limit
        self.request_timestamps = deque(maxlen=self.max_requests_per_minute)
        self.min_request_interval = 1.0  # Minimum 1 second between requests
        self.last_request_time = 0
        
        # Token/prompt optimization
        self.max_prompt_length = 30000  # Characters (roughly 7500 tokens)
        
        if not self.api_key:
            logger.warning("GEMINI_API_KEY not found in environment variables")
        elif GENAI_AVAILABLE:
            try:
                genai.configure(api_key=self.api_key)
                # Using gemini-1.5-flash for better rate limits (1500 RPD free tier vs 20 RPD for 2.5-flash-lite)
                model_name = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash-preview-09-2025')
                self.model = genai.GenerativeModel(model_name)
                logger.info(f"Gemini AI initialized with model: {model_name} (Rate limit: {self.max_requests_per_minute} RPM)")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini AI: {e}")
                self.model = None
        else:
            logger.warning("Google Generative AI SDK not available")
    
    def _wait_for_rate_limit(self):
        """
        Implement rate limiting to prevent quota exhaustion
        """
        current_time = time.time()
        
        # Check minimum interval between requests
        time_since_last = current_time - self.last_request_time
        if time_since_last < self.min_request_interval:
            sleep_time = self.min_request_interval - time_since_last
            logger.info(f"Rate limiting: waiting {sleep_time:.2f}s before next request")
            time.sleep(sleep_time)
            current_time = time.time()
        
        # Check requests per minute limit
        if len(self.request_timestamps) >= self.max_requests_per_minute:
            oldest_request = self.request_timestamps[0]
            time_window = current_time - oldest_request
            if time_window < 60:
                sleep_time = 60 - time_window + 1  # Add 1 second buffer
                logger.warning(f"Rate limit reached ({self.max_requests_per_minute} requests/min). Waiting {sleep_time:.2f}s")
                time.sleep(sleep_time)
                current_time = time.time()
        
        # Record this request
        self.request_timestamps.append(current_time)
        self.last_request_time = current_time
    
    def _optimize_prompt(self, prompt: str) -> str:
        """
        Optimize prompt length to stay within limits
        """
        if len(prompt) <= self.max_prompt_length:
            return prompt
        
        logger.warning(f"Prompt too long ({len(prompt)} chars). Truncating to {self.max_prompt_length} chars")
        
        # Try to truncate at a natural break point
        truncated = prompt[:self.max_prompt_length]
        last_newline = truncated.rfind('\n')
        if last_newline > self.max_prompt_length * 0.8:  # If we can save 80%+, use newline
            truncated = truncated[:last_newline]
        
        truncated += "\n\n[Note: Some context was truncated due to length limits]"
        return truncated
    
    def _make_gemini_request(self, prompt: str, retry_count: int = 2) -> Optional[str]:
        """
        Make a request to Gemini API with rate limiting and retry logic
        
        Args:
            prompt: The prompt to send
            retry_count: Number of retries on quota errors
        """
        if not self.model:
            logger.warning("Gemini model not initialized. Returning placeholder.")
            return None
        
        # Optimize prompt length
        optimized_prompt = self._optimize_prompt(prompt)
        
        for attempt in range(retry_count + 1):
            try:
                # Apply rate limiting
                self._wait_for_rate_limit()
                
                logger.info(f"Making Gemini API request (attempt {attempt + 1}/{retry_count + 1}, prompt length: {len(optimized_prompt)} chars)")
                response = self.model.generate_content(optimized_prompt)
                logger.info(f"Gemini API request successful")
                return response.text
                
            except Exception as e:
                error_msg = str(e)
                
                # Check if it's a quota/rate limit error
                if '429' in error_msg or 'quota' in error_msg.lower() or 'rate limit' in error_msg.lower():
                    logger.error(f"Quota/rate limit error on attempt {attempt + 1}: {error_msg}")
                    
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
                        backoff_time = (attempt + 1) * 10  # 10s, 20s, etc.
                        logger.info(f"Backing off for {backoff_time}s before retry...")
                        time.sleep(backoff_time)
                        continue
                
                logger.error(f"Error calling Gemini API: {e}")
                if attempt < retry_count:
                    time.sleep(2)  # Short delay before retry
                    continue
                    
                return None
        
        return None
    
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
        
        result = self._make_gemini_request(prompt)
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
                logger.error(f"Failed to parse Gemini course outline response as JSON: {e}")
                logger.error(f"Raw response (first 500 chars): {result[:500]}")
        
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
        
        result = self._make_gemini_request(prompt)
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
                logger.error(f"Failed to parse Gemini multiple modules response as JSON: {e}")
                logger.error(f"Raw response (first 500 chars): {result[:500]}")
        
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
        
        result = self._make_gemini_request(prompt)
        if result:
            try:
                # Clean up the response - remove markdown code blocks if present
                cleaned_result = result.strip()
                if cleaned_result.startswith('```json'):
                    cleaned_result = cleaned_result[7:]  # Remove ```json
                elif cleaned_result.startswith('```'):
                    cleaned_result = cleaned_result[3:]   # Remove ```
                if cleaned_result.endswith('```'):
                    cleaned_result = cleaned_result[:-3]  # Remove trailing ```
                cleaned_result = cleaned_result.strip()
                
                return json.loads(cleaned_result)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse Gemini response as JSON: {e}")
                logger.error(f"Raw response (first 500 chars): {result[:500]}")
        
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
        
        result = self._make_gemini_request(prompt)
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
        
        result = self._make_gemini_request(prompt)
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
        
        result = self._make_gemini_request(prompt)
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
        
        result = self._make_gemini_request(prompt)
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
        
        result = self._make_gemini_request(prompt)
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
        
        result = self._make_gemini_request(prompt)
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
        
        result = self._make_gemini_request(prompt)
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
        
        result = self._make_gemini_request(prompt)
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
        
        result = self._make_gemini_request(prompt)
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


# Singleton instance
ai_agent_service = AIAgentService()
