"""
Assessment Generation Module
Handles AI-powered generation of quizzes, assignments, and projects
"""

import json
import logging
from typing import Dict, List, Optional, Any

from .ai_providers import ai_provider_manager
from .json_parser import json_parser

logger = logging.getLogger(__name__)


class AssessmentGenerator:
    """Generates quizzes, assignments, and projects using AI"""
    
    def __init__(self, provider_manager=None):
        self.provider = provider_manager or ai_provider_manager
    
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
4. Include exactly 4 options for multiple choice questions
5. Clearly mark the correct answer
6. Provide brief explanations for correct answers

CRITICAL FORMATTING REQUIREMENTS:
- Return ONLY valid JSON without any markdown formatting
- NO code blocks, NO extra text, ONLY JSON
- Use double quotes for all strings
- Use simple option structure with key and text

Return this exact JSON structure:
{{
  "title": "{lesson_title} Quiz",
  "description": "Assessment covering key concepts from {lesson_title}",
  "time_limit": 20,
  "passing_score": 70,
  "questions": [
    {{
      "question_text": "Question text here?",
      "question_type": "multiple_choice",
      "points": 10,
      "correct_answer": "B",
      "explanation": "Explanation of correct answer",
      "options": [
        {{"key": "A", "text": "Option A"}},
        {{"key": "B", "text": "Correct option"}},
        {{"key": "C", "text": "Option C"}},
        {{"key": "D", "text": "Option D"}}
      ]
    }}
  ]
}}"""
        
        result, provider = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        if result:
            parsed = json_parser.parse_json_response(result, "quiz questions")
            if parsed:
                # Validate and fix quiz structure
                parsed = self._validate_quiz_data(parsed, lesson_title, num_questions)
                return parsed
            else:
                logger.warning(f"Failed to parse AI response for quiz questions, using fallback")
        
        # Fallback if AI generation fails
        return self._generate_fallback_quiz(lesson_title, num_questions)
    
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

IMPORTANT: Base questions ONLY on information actually present in the content above.

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
        
        result, provider = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        if result:
            parsed = json_parser.parse_json_response(result, "quiz from content")
            if parsed:
                # Validate and fix quiz structure if needed
                parsed = self._validate_quiz_data(parsed, content_title, num_questions)
                return parsed
            else:
                logger.warning(f"Failed to parse AI response for quiz generation, using fallback")
        
        # Fallback if AI generation fails
        return self._generate_fallback_quiz(content_title, num_questions)
    
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
        
        result, provider = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        if result:
            parsed = json_parser.parse_json_response(result, "assignment")
            if parsed:
                return parsed
        
        return {
            "title": f"{module_title} Assignment",
            "description": f"Apply what you've learned in {module_title}",
            "instructions": "Complete the assignment according to the guidelines provided.",
            "max_points": 100,
            "due_date_days": 7,
            "grading_rubric": "• Completeness\n• Quality\n• Timeliness"
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

IMPORTANT: 
- Base the assignment ONLY on concepts and skills taught in the content above
- Return ONLY valid JSON without any markdown formatting
- Use \\n for line breaks in text fields
- Ensure all quotes are properly escaped

Return valid JSON in this exact format:
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
        
        result, provider = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        if result:
            parsed = json_parser.parse_json_response(result, "assignment from content")
            if parsed:
                # Validate required fields and add defaults if missing
                parsed = self._validate_assignment_data(parsed, content_title)
                return parsed
            else:
                logger.warning(f"Failed to parse AI response for assignment generation, using fallback")
        
        # Fallback if AI generation fails
        return self._generate_fallback_assignment(content_title, assignment_type)
    
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
        
        result, provider = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        if result:
            parsed = json_parser.parse_json_response(result, "final project")
            if parsed:
                return parsed
        
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
        combined_content = ""
        for idx, content_item in enumerate(module_contents[:5], 1):
            combined_content += f"\n\n=== {content_item.get('title', f'Item {idx}')} ===\n"
            item_content = content_item.get('content', '')
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
        
        result, provider = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        if result:
            parsed = json_parser.parse_json_response(result, "project from content")
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
    
    def _validate_assignment_data(self, parsed_data: Dict[str, Any], content_title: str) -> Dict[str, Any]:
        """
        Validate and ensure assignment data has all required fields with defaults
        
        Args:
            parsed_data: The parsed JSON data from AI
            content_title: Title of the content for fallbacks
            
        Returns:
            Validated assignment data with all required fields
        """
        defaults = {
            "title": f"{content_title} Assignment",
            "description": f"Apply concepts learned from {content_title}",
            "instructions": "Complete the assignment based on what you learned.",
            "deliverables": "• Completed assignment\\n• Documentation",
            "max_points": 100,
            "due_date_days": 7,
            "grading_rubric": "• Quality (50%)\\n• Completeness (50%)",
            "submission_format": "Submit as PDF or document file"
        }
        
        # Merge with defaults, keeping AI-generated values when available
        for key, default_value in defaults.items():
            if key not in parsed_data or not parsed_data[key]:
                parsed_data[key] = default_value
        
        # Ensure max_points is a number
        try:
            parsed_data["max_points"] = int(parsed_data["max_points"])
        except (ValueError, TypeError):
            parsed_data["max_points"] = 100
        
        # Ensure due_date_days is a number
        try:
            parsed_data["due_date_days"] = int(parsed_data["due_date_days"])
        except (ValueError, TypeError):
            parsed_data["due_date_days"] = 7
        
        return parsed_data
    
    def _generate_fallback_assignment(self, content_title: str, assignment_type: str) -> Dict[str, Any]:
        """
        Generate a fallback assignment when AI generation fails
        
        Args:
            content_title: Title of the content
            assignment_type: Type of assignment
            
        Returns:
            Basic assignment structure
        """
        assignment_types = {
            "practical": {
                "title": f"{content_title} - Practical Application",
                "description": f"Apply the practical skills and concepts you learned from {content_title} in real-world scenarios.",
                "instructions": "1. Review the lesson content\\n2. Complete the practical exercises\\n3. Apply concepts to solve problems\\n4. Document your work and findings",
                "deliverables": "• Completed exercises\\n• Problem solutions\\n• Reflection document"
            },
            "theoretical": {
                "title": f"{content_title} - Conceptual Analysis",
                "description": f"Demonstrate your understanding of theoretical concepts from {content_title} through analysis and explanation.",
                "instructions": "1. Analyze key concepts from the lesson\\n2. Explain relationships between ideas\\n3. Provide examples and applications\\n4. Write a comprehensive analysis",
                "deliverables": "• Conceptual analysis paper\\n• Examples and applications\\n• Summary of key insights"
            },
            "project": {
                "title": f"{content_title} - Project Work",
                "description": f"Create a comprehensive project that demonstrates mastery of concepts from {content_title}.",
                "instructions": "1. Plan your project approach\\n2. Apply lesson concepts in your project\\n3. Create documentation\\n4. Present your results",
                "deliverables": "• Project files\\n• Technical documentation\\n• Project presentation"
            },
            "mixed": {
                "title": f"{content_title} - Comprehensive Assessment",
                "description": f"Complete both practical and theoretical components to demonstrate full understanding of {content_title}.",
                "instructions": "1. Complete practical exercises\\n2. Write theoretical analysis\\n3. Apply concepts to new scenarios\\n4. Reflect on learning outcomes",
                "deliverables": "• Practical work samples\\n• Analysis document\\n• Application examples\\n• Learning reflection"
            }
        }
        
        template = assignment_types.get(assignment_type, assignment_types["mixed"])
        
        return {
            "title": template["title"],
            "description": template["description"],
            "instructions": template["instructions"],
            "deliverables": template["deliverables"],
            "max_points": 100,
            "due_date_days": 7,
            "grading_rubric": "• Quality and accuracy (40%)\\n• Completeness (30%)\\n• Presentation and organization (30%)",
            "submission_format": "Submit as PDF document or zip file with all components"
        }
    
    def _validate_quiz_data(self, parsed_data: Dict[str, Any], content_title: str, num_questions: int) -> Dict[str, Any]:
        """
        Validate and ensure quiz data has all required fields with defaults
        
        Args:
            parsed_data: The parsed JSON data from AI
            content_title: Title of the content for fallbacks
            num_questions: Expected number of questions
            
        Returns:
            Validated quiz data with all required fields
        """
        defaults = {
            "title": f"{content_title} Quiz",
            "description": f"Test your knowledge of {content_title}",
            "time_limit": max(15, num_questions * 2),
            "passing_score": 70,
            "questions": []
        }
        
        # Merge with defaults, keeping AI-generated values when available
        for key, default_value in defaults.items():
            if key not in parsed_data or not parsed_data[key]:
                parsed_data[key] = default_value
        
        # Validate questions array
        if not isinstance(parsed_data.get("questions"), list):
            parsed_data["questions"] = []
        
        # Validate each question structure
        validated_questions = []
        for i, question in enumerate(parsed_data["questions"]):
            if isinstance(question, dict):
                validated_question = self._validate_question_data(question, i + 1)
                validated_questions.append(validated_question)
        
        parsed_data["questions"] = validated_questions
        
        # Ensure numeric fields are properly typed
        try:
            parsed_data["time_limit"] = int(parsed_data["time_limit"])
        except (ValueError, TypeError):
            parsed_data["time_limit"] = max(15, num_questions * 2)
        
        try:
            parsed_data["passing_score"] = int(parsed_data["passing_score"])
        except (ValueError, TypeError):
            parsed_data["passing_score"] = 70
        
        return parsed_data
    
    def _validate_question_data(self, question: Dict[str, Any], question_num: int) -> Dict[str, Any]:
        """
        Validate individual question data structure
        
        Args:
            question: Question data dictionary
            question_num: Question number for fallback text
            
        Returns:
            Validated question data
        """
        defaults = {
            "question_text": f"Question {question_num}?",
            "question_type": "multiple_choice",
            "points": 10,
            "correct_answer": "A",
            "explanation": "Explanation for the correct answer.",
            "options": [
                {"key": "A", "text": "Option A"},
                {"key": "B", "text": "Option B"},
                {"key": "C", "text": "Option C"},
                {"key": "D", "text": "Option D"}
            ]
        }
        
        # Apply defaults for missing fields
        for key, default_value in defaults.items():
            if key not in question:
                question[key] = default_value
        
        # Validate options array
        if not isinstance(question.get("options"), list) or len(question["options"]) < 2:
            question["options"] = defaults["options"]
        
        # Ensure each option has key and text
        validated_options = []
        for i, option in enumerate(question["options"]):
            if isinstance(option, dict) and "key" in option and "text" in option:
                validated_options.append(option)
            else:
                # Create fallback option
                key = chr(65 + i) if i < 26 else f"Option {i+1}"
                validated_options.append({
                    "key": key,
                    "text": f"Option {key}"
                })
        
        question["options"] = validated_options
        
        # Ensure numeric fields
        try:
            question["points"] = int(question["points"])
        except (ValueError, TypeError):
            question["points"] = 10
        
        return question
    
    def _generate_fallback_quiz(self, content_title: str, num_questions: int) -> Dict[str, Any]:
        """
        Generate a fallback quiz when AI generation fails
        
        Args:
            content_title: Title of the content
            num_questions: Number of questions to generate
            
        Returns:
            Basic quiz structure
        """
        questions = []
        for i in range(min(num_questions, 5)):  # Limit fallback questions
            questions.append({
                "question_text": f"What is a key concept from {content_title}? (Question {i+1})",
                "question_type": "multiple_choice",
                "points": 100 // max(num_questions, 1),
                "correct_answer": "A",
                "explanation": f"This question tests your understanding of concepts from {content_title}.",
                "options": [
                    {"key": "A", "text": "Correct concept from the content"},
                    {"key": "B", "text": "Incorrect option B"},
                    {"key": "C", "text": "Incorrect option C"},
                    {"key": "D", "text": "Incorrect option D"}
                ]
            })
        
        return {
            "title": f"{content_title} - Knowledge Check",
            "description": f"Test your understanding of key concepts from {content_title}. This quiz was generated automatically.",
            "time_limit": max(15, num_questions * 2),
            "passing_score": 70,
            "questions": questions
        }


# Singleton instance
assessment_generator = AssessmentGenerator()
