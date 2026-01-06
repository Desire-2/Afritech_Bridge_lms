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
                return json.loads(cleaned_result)
            except json.JSONDecodeError as e:
                # Try to fix common JSON issues
                logger.warning(f"Initial JSON parse failed for {context}: {e}. Attempting to fix...")
                
                # Log response for debugging (limit to first 1000 chars)
                logger.error(f"Raw {context} (first 1000 chars): {result[:1000]}")
                
                # Try multiple recovery strategies
                fixed_json = JSONResponseParser._attempt_json_recovery(cleaned_result)
                if fixed_json:
                    return fixed_json
                
                # Last resort: try to extract just the JSON object
                extracted_json = JSONResponseParser._extract_json_object(cleaned_result)
                if extracted_json:
                    return extracted_json
                        
        except Exception as e:
            logger.error(f"Failed to parse AI {context} as JSON: {e}")
            
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


# Singleton instance
json_parser = JSONResponseParser()
