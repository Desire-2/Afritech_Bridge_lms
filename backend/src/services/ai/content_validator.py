"""
Content Validator Module
Handles validation of AI-generated content quality
"""

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class ContentValidator:
    """Validates quality and completeness of AI-generated content"""
    
    @staticmethod
    def validate_content_quality(content: str, content_type: str, min_length: int = 500) -> Dict[str, Any]:
        """
        Validate the quality and completeness of generated content
        
        Args:
            content: The generated content to validate
            content_type: Type of content ('introduction', 'theory', 'examples', etc.)
            min_length: Minimum expected length in characters
            
        Returns:
            Dict with validation results and quality metrics
        """
        validation_result = {
            "valid": True,
            "issues": [],
            "quality_score": 100,
            "metrics": {}
        }
        
        if not content or len(content.strip()) == 0:
            validation_result["valid"] = False
            validation_result["issues"].append("Content is empty")
            validation_result["quality_score"] = 0
            return validation_result
        
        content_length = len(content)
        validation_result["metrics"]["length"] = content_length
        
        # Check minimum length
        if content_length < min_length:
            validation_result["issues"].append(f"Content too short ({content_length} < {min_length} chars)")
            validation_result["quality_score"] -= 20
        
        # Check for markdown formatting
        has_headers = '#' in content
        has_bold = '**' in content
        has_lists = ('- ' in content or '1. ' in content or '* ' in content)
        
        validation_result["metrics"]["has_headers"] = has_headers
        validation_result["metrics"]["has_bold"] = has_bold
        validation_result["metrics"]["has_lists"] = has_lists
        
        if not has_headers:
            validation_result["issues"].append("Missing section headers")
            validation_result["quality_score"] -= 15
        
        if not (has_bold or has_lists):
            validation_result["issues"].append("Poor formatting (no emphasis or lists)")
            validation_result["quality_score"] -= 10
        
        # Content-type specific validation
        if content_type == 'theory':
            has_definition = any(word in content.lower() for word in ['definition', 'defined as', 'refers to', 'is a'])
            has_principle = any(word in content.lower() for word in ['principle', 'theorem', 'law', 'concept'])
            
            if not has_definition:
                validation_result["issues"].append("Theory section missing clear definitions")
                validation_result["quality_score"] -= 15
            
            if not has_principle:
                validation_result["issues"].append("Theory section missing core principles")
                validation_result["quality_score"] -= 10
        
        elif content_type == 'examples':
            has_code = '```' in content
            has_steps = any(f"{i}." in content for i in range(1, 6))
            
            validation_result["metrics"]["has_code"] = has_code
            validation_result["metrics"]["has_steps"] = has_steps
            
            if not (has_code or has_steps):
                validation_result["issues"].append("Examples section missing code or step-by-step demonstrations")
                validation_result["quality_score"] -= 20
        
        elif content_type == 'exercises':
            has_questions = '?' in content
            question_count = content.count('?')
            
            validation_result["metrics"]["question_count"] = question_count
            
            if question_count < 3:
                validation_result["issues"].append(f"Insufficient exercises (found {question_count}, expected 5+)")
                validation_result["quality_score"] -= 15
        
        # Check for common generation errors
        error_phrases = [
            "content to be generated",
            "[insert",
            "[add",
            "TODO",
            "placeholder",
            "coming soon"
        ]
        
        for phrase in error_phrases:
            if phrase.lower() in content.lower():
                validation_result["issues"].append(f"Content contains placeholder: '{phrase}'")
                validation_result["quality_score"] -= 25
                validation_result["valid"] = False
        
        # Determine overall validity
        if validation_result["quality_score"] < 60:
            validation_result["valid"] = False
        
        return validation_result


class ContentEnhancer:
    """Enhances existing content using AI"""
    
    def __init__(self, provider_manager):
        self.provider = provider_manager
    
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
        
        result, provider = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=4096)
        return result if result else current_content
    
    def enhance_section_content(self, section_type: str, section_content: str,
                               context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enhance a specific section of mixed content using AI
        
        Args:
            section_type: Type of section (text, heading, etc.)
            section_content: Current content of the section
            context: Additional context (lesson title, position, etc.)
            
        Returns:
            Dict with enhanced content
        """
        from .json_parser import json_parser
        
        lesson_title = context.get('lesson_title', 'the lesson')
        section_position = context.get('section_position', 'middle')
        previous_section = context.get('previous_section', '')
        
        if section_type == 'text':
            prompt = f"""You are an expert educational content writer.

Lesson: {lesson_title}
Section Position: {section_position}
{f'Previous Section Context: {previous_section[:200]}...' if previous_section else ''}

Current Content:
{section_content}

Enhance this content by:
1. Expanding with more detail and examples
2. Improving clarity and structure
3. Adding practical applications
4. Using better markdown formatting
5. Including code examples if relevant
6. Making it more engaging and educational

Target length: 300-500 words
Format: Markdown with headers (##, ###), lists, bold, code blocks, blockquotes

Return ONLY the enhanced markdown content, no JSON wrapper."""
            
            result, provider = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=4096)
            if result:
                return {"enhanced_content": result.strip()}
        
        elif section_type == 'heading':
            prompt = f"""Improve this heading for better clarity and engagement.

Lesson: {lesson_title}
Current Heading: {section_content}
Position: {section_position}

Return ONLY the improved heading text (no quotes, no explanation)."""
            
            result, provider = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=4096)
            if result:
                return {"enhanced_content": result.strip().strip('"').strip("'")}
        
        elif section_type in ['video', 'pdf', 'image']:
            prompt = f"""Suggest a better title and description for this {section_type}.

Lesson: {lesson_title}
Current Title: {section_content}

Return JSON:
{{
  "title": "Improved title",
  "description": "What this {section_type} should cover"
}}"""
            
            result, provider = self.provider.make_ai_request(prompt, temperature=0.7, max_tokens=4096)
            if result:
                parsed = json_parser.parse_json_response(result, "section enhancement")
                if parsed:
                    return parsed
        
        return {"enhanced_content": section_content}


# Singleton instances
content_validator = ContentValidator()
