"""
JSON Response Parser Module
Handles parsing and cleaning of JSON responses from AI providers
"""

import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class JSONResponseParser:
    """Utility class for parsing JSON responses from AI providers"""
    
    @staticmethod
    def parse_json_response(result: str, context: str = "response") -> Optional[Dict[str, Any]]:
        """
        Parse JSON response from AI with error recovery
        
        Args:
            result: The raw response text
            context: Description of what's being parsed (for logging)
            
        Returns:
            Parsed JSON dict or None if parsing fails
        """
        if not result:
            return None
            
        try:
            # Clean up the response - remove markdown code blocks and control characters
            cleaned_result = JSONResponseParser._clean_response(result)
            
            # Try to parse JSON
            try:
                parsed = json.loads(cleaned_result)
                return JSONResponseParser._ensure_dict(parsed, context)
            except json.JSONDecodeError as e:
                # Try to fix common JSON issues
                logger.warning(f"Initial JSON parse failed for {context}: {e}. Attempting to fix...")
                
                # Log response for debugging (limit to first 1000 chars)
                logger.error(f"Raw {context} (first 1000 chars): {result[:1000]}")
                
                # Try multiple recovery strategies
                fixed_json = JSONResponseParser._attempt_json_recovery(cleaned_result)
                if fixed_json:
                    return JSONResponseParser._ensure_dict(fixed_json, context)
                
                # Last resort: try to extract just the JSON object
                extracted_json = JSONResponseParser._extract_json_object(cleaned_result)
                if extracted_json:
                    return JSONResponseParser._ensure_dict(extracted_json, context)
                        
        except Exception as e:
            logger.error(f"Failed to parse AI {context} as JSON: {e}")
            
        return None
    
    @staticmethod
    def _ensure_dict(parsed: Any, context: str = "response") -> Optional[Dict[str, Any]]:
        """Ensure the parsed JSON is a dict. If it's a list, try to unwrap it."""
        if isinstance(parsed, dict):
            return parsed
        if isinstance(parsed, list):
            # AI returned a JSON array instead of an object
            if len(parsed) == 1 and isinstance(parsed[0], dict):
                # Single-element array — unwrap it
                logger.info(f"Unwrapped single-element JSON array for {context}")
                return parsed[0]
            elif len(parsed) > 1 and all(isinstance(item, dict) for item in parsed):
                # Multiple objects — determine if these are sections or lessons
                # by checking whether items have section-like keys
                first_item = parsed[0]
                is_sections = any(k in first_item for k in ('heading', 'key_topics', 'target_words', 'id'))
                is_lessons = any(k in first_item for k in ('content_data', 'content_type', 'learning_objectives'))
                
                if is_sections and not is_lessons:
                    # These are outline sections — wrap as sections
                    logger.info(f"Wrapped JSON array ({len(parsed)} items) as sections for {context}")
                    return {"sections": parsed}
                else:
                    # Default: wrap as lessons
                    logger.info(f"Wrapped JSON array ({len(parsed)} items) as lessons for {context}")
                    return {"lessons": parsed}
            elif len(parsed) > 0 and isinstance(parsed[0], dict):
                return parsed[0]
        logger.warning(f"Parsed {context} is not a dict (type: {type(parsed).__name__}), returning None")
        return None

    @staticmethod
    def clean_json_response(result: str) -> str:
        """
        Clean JSON response by removing markdown code blocks
        
        Args:
            result: The raw response text
            
        Returns:
            Cleaned string ready for JSON parsing
        """
        return JSONResponseParser._clean_response(result)
    
    @staticmethod
    def _clean_response(result: str) -> str:
        """
        Internal method to clean up AI response text
        
        Args:
            result: The raw response text
            
        Returns:
            Cleaned string ready for JSON parsing
        """
        # Remove leading/trailing whitespace
        cleaned = result.strip()
        
        # Remove markdown code blocks
        if cleaned.startswith('```json'):
            cleaned = cleaned[7:]
        elif cleaned.startswith('```'):
            cleaned = cleaned[3:]
        if cleaned.endswith('```'):
            cleaned = cleaned[:-3]
        
        # Clean up again after removing code blocks
        cleaned = cleaned.strip()
        
        # Simple but effective approach: replace problematic characters
        # Focus on the most common issue: unescaped newlines in strings
        
        # Step 1: Replace actual newlines with escaped newlines in the context where they appear
        # This is a simple replacement that works for most AI responses
        import re
        
        # Replace unescaped newlines with escaped newlines
        # Look for newlines that are inside quotes and not already escaped
        def fix_newlines_in_json(text):
            # Use a state machine approach
            result = []
            in_string = False
            i = 0
            while i < len(text):
                char = text[i]
                if char == '"' and (i == 0 or text[i-1] != '\\'):
                    # Quote that's not escaped
                    in_string = not in_string
                    result.append(char)
                elif char == '\n' and in_string:
                    # Newline inside a string - escape it
                    result.append('\\n')
                elif char == '\r':
                    # Skip carriage returns entirely
                    pass
                elif char == '\t' and in_string:
                    # Replace tabs in strings with spaces
                    result.append('    ')
                else:
                    result.append(char)
                i += 1
            return ''.join(result)
        
        cleaned = fix_newlines_in_json(cleaned)
        
        return cleaned
    
    @staticmethod
    def _attempt_json_recovery(cleaned_result: str) -> Optional[Dict[str, Any]]:
        """
        Attempt multiple strategies to recover valid JSON from malformed input
        
        Args:
            cleaned_result: Pre-cleaned JSON string
            
        Returns:
            Parsed JSON dict or None
        """
        import re
        
        # Strategy 1: Fix unescaped newlines in string values
        try:
            # More comprehensive newline fixing
            fixed = re.sub(r'"([^"]*?)\n([^"]*?)"', lambda m: '"' + m.group(1) + '\\n' + m.group(2) + '"', cleaned_result)
            return json.loads(fixed)
        except (json.JSONDecodeError, Exception):
            pass
        
        # Strategy 2: Fix trailing commas
        try:
            fixed = cleaned_result.replace(',}', '}').replace(',]', ']')
            # Also fix trailing commas before newlines
            fixed = re.sub(r',\s*\n\s*}', '}', fixed)
            fixed = re.sub(r',\s*\n\s*]', ']', fixed)
            return json.loads(fixed)
        except json.JSONDecodeError:
            pass
        
        # Strategy 3: Fix missing quotes on keys
        try:
            fixed = re.sub(r'(\w+):', r'"\1":', cleaned_result)
            return json.loads(fixed)
        except json.JSONDecodeError:
            pass
        
        # Strategy 4: Fix JSON structure issues in quiz format
        try:
            # Common issue: missing quotes around property names
            fixed = re.sub(r'(\s+)(\w+)(\s*):', r'\1"\2"\3:', cleaned_result)
            # Fix missing commas
            fixed = re.sub(r'}(\s*){', r'},\1{', fixed)
            fixed = re.sub(r'](\s*){', r'],\1{', fixed)
            return json.loads(fixed)
        except json.JSONDecodeError:
            pass
        
        # Strategy 5: More aggressive newline fixing for long content
        try:
            # Replace all literal newlines with escaped newlines in string contexts
            lines = cleaned_result.split('\n')
            in_string = False
            quote_char = None
            fixed_lines = []
            current_line = ""
            
            for line in lines:
                if not in_string:
                    fixed_lines.append(line)
                else:
                    # We're continuing a string from previous line
                    current_line += '\\n' + line
                    # Check if string ends in this line
                    if quote_char and quote_char in line and not line.endswith('\\'):
                        fixed_lines[-1] = current_line
                        in_string = False
                        current_line = ""
                
                # Check if this line starts a string that might continue
                if '"' in line and line.count('"') % 2 == 1:
                    in_string = True
                    quote_char = '"'
            
            fixed = '\n'.join(fixed_lines)
            return json.loads(fixed)
        except (json.JSONDecodeError, Exception):
            pass
        
        return None
    
    @staticmethod
    def _extract_json_object(cleaned_result: str) -> Optional[Dict[str, Any]]:
        """
        Try to extract JSON object from text that may contain extra content
        
        Args:
            cleaned_result: Text potentially containing JSON
            
        Returns:
            Parsed JSON dict or None
        """
        try:
            # Find the first { and last }
            start_idx = cleaned_result.find('{')
            end_idx = cleaned_result.rfind('}')
            
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                json_str = cleaned_result[start_idx:end_idx + 1]
                
                # Clean the extracted string
                json_str = JSONResponseParser._clean_response(json_str)
                
                # Try parsing the extracted JSON
                return json.loads(json_str)
                        
        except json.JSONDecodeError:
            logger.error("Failed to extract valid JSON from response")
        except Exception as e:
            logger.error(f"Error extracting JSON: {e}")
            
        return None
    
    @staticmethod
    def extract_outline_from_markdown(text: str) -> Optional[Dict[str, Any]]:
        """
        Last-resort recovery: extract a lesson outline structure from a markdown response
        when the AI returned markdown instead of JSON.
        
        This handles cases where the AI ignores the JSON format instruction and returns
        lesson outlines as markdown with headings, bullet points, etc.
        
        Args:
            text: Raw markdown text from AI response
            
        Returns:
            A dict matching the lesson outline schema, or None if extraction fails
        """
        import re
        
        if not text or not text.strip():
            return None
        
        # Only attempt this if the response looks like markdown (no JSON braces)
        if '{' in text and '}' in text:
            return None  # There's JSON in there — let other strategies handle it
        
        lines = text.strip().split('\\n')
        if len(lines) < 3:
            # Try actual newlines
            lines = text.strip().split('\n')
        
        if len(lines) < 3:
            return None
        
        # Extract title from first heading or bold text
        title = ""
        description = ""
        sections = []
        current_section_topics = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Extract title from markdown heading
            heading_match = re.match(r'^#{1,3}\s+(.+)', line)
            bold_match = re.match(r'^\*\*(.+?)\*\*', line)
            
            if not title:
                if heading_match:
                    title = heading_match.group(1).strip()
                    continue
                elif bold_match and len(bold_match.group(1)) > 10:
                    title = bold_match.group(1).strip()
                    continue
            
            # Extract sections from numbered items or sub-headings
            section_match = re.match(r'^(\d+)\.\s+\*\*(.+?)\*\*', line)
            sub_heading = re.match(r'^#{2,4}\s+(.+)', line)
            
            if section_match:
                section_title = section_match.group(2).strip()
                if current_section_topics and sections:
                    sections[-1]['key_topics'] = current_section_topics
                current_section_topics = []
                sections.append({
                    'id': f'section_{len(sections) + 1}',
                    'heading': section_title,
                    'description': section_title,
                    'target_words': 600,
                    'key_topics': [],
                })
            elif sub_heading and sections:
                # This is a sub-topic under the current section
                current_section_topics.append(sub_heading.group(1).strip())
            elif line.startswith('- ') or line.startswith('* '):
                topic = line.lstrip('-* ').strip()
                # Remove markdown formatting
                topic = re.sub(r'[`*_]', '', topic).strip()
                if topic and len(topic) > 3:
                    current_section_topics.append(topic)
        
        # Assign final topics
        if current_section_topics and sections:
            sections[-1]['key_topics'] = current_section_topics
        
        if not title or len(sections) < 2:
            return None
        
        # Clean title — remove prefixes like \"Lesson 3:\"
        title = re.sub(r'^(Lesson\\s*\\d+\\s*:\\s*)', '', title).strip()
        title = re.sub(r'^(Lesson\s*\d+\s*:\s*)', '', title).strip()
        
        # Build a valid outline structure
        outline = {
            'title': title,
            'description': f'This lesson covers {title} through {len(sections)} main sections.',
            'learning_objectives': [
                f'Understand key concepts of {title}',
                f'Apply {title} principles to practical scenarios',
                f'Analyze real-world applications',
                'Develop problem-solving skills in this domain',
            ],
            'duration_minutes': 60,
            'sections': sections if sections else [
                {
                    'id': 'section_1',
                    'heading': 'Core Concepts',
                    'description': f'Fundamental concepts of {title}',
                    'target_words': 700,
                    'key_topics': [title],
                },
                {
                    'id': 'section_2',
                    'heading': 'Practical Applications',
                    'description': f'Real-world applications of {title}',
                    'target_words': 600,
                    'key_topics': ['applications', 'examples'],
                },
                {
                    'id': 'worked_examples',
                    'heading': 'Worked Examples',
                    'description': 'Detailed examples with solutions',
                    'target_words': 600,
                    'key_topics': ['examples', 'practice'],
                },
            ],
        }
        
        logger.info(f"Recovered outline from markdown: '{title}' with {len(outline['sections'])} sections")
        return outline


# Singleton instance
json_parser = JSONResponseParser()
