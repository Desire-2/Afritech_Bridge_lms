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
        
        result, provider = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        if result:
            parsed = json_parser.parse_json_response(result, "quiz questions")
            if parsed:
                return parsed
        
        return {
            "title": f"{lesson_title} Quiz",
            "description": f"Test your knowledge of {lesson_title}",
            "time_limit": 20,
            "passing_score": 70,
            "questions": []
        }
    
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
                return parsed
        
        return {
            "title": f"{content_title} Quiz",
            "description": f"Assessment based on {content_title}",
            "time_limit": max(15, num_questions * 2),
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

IMPORTANT: Base the assignment ONLY on concepts and skills taught in the content above.

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
        
        result, provider = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        if result:
            parsed = json_parser.parse_json_response(result, "assignment from content")
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


# Singleton instance
assessment_generator = AssessmentGenerator()
