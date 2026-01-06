"""
Enhanced JSON Response Parser Module
Improved parsing and cleaning of JSON responses from AI providers with better error recovery
"""

import json
import logging
import re
from typing import Dict, Any, Optional, Union

logger = logging.getLogger(__name__)


class EnhancedJSONParser:
    """Enhanced utility class for parsing JSON responses from AI providers"""
    
    @staticmethod
    def parse_json_response(result: str, context: str = "response") -> Optional[Dict[str, Any]]:
        """
        Parse JSON response from AI with enhanced error recovery
        
        Args:
            result: The raw response text
            context: Description of what's being parsed (for logging)
            
        Returns:
            Parsed JSON dict or None if parsing fails
        """
        if not result or not isinstance(result, str):
            logger.warning(f"Empty or invalid {context} received")
            return None
            
        try:
            # Step 1: Basic cleanup
            cleaned = EnhancedJSONParser._initial_cleanup(result)
            
            # Step 2: Try direct parsing first
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                pass
            
            # Step 3: Progressive fixing strategies
            for strategy_name, strategy_func in [
                ("newline_fix", EnhancedJSONParser._fix_newlines),
                ("comma_fix", EnhancedJSONParser._fix_trailing_commas),
                ("quote_fix", EnhancedJSONParser._fix_unescaped_quotes),
                ("structure_fix", EnhancedJSONParser._fix_structure_issues),
                ("content_extraction", EnhancedJSONParser._extract_json_content)
            ]:
                try:
                    fixed = strategy_func(cleaned)
                    if fixed != cleaned:  # Something was changed
                        parsed = json.loads(fixed)
                        logger.info(f"JSON parsed successfully using {strategy_name} for {context}")
                        return parsed
                except (json.JSONDecodeError, Exception) as e:
                    logger.debug(f"Strategy {strategy_name} failed for {context}: {e}")
                    continue
            
            # Step 4: Last resort - partial content extraction
            partial_content = EnhancedJSONParser._extract_partial_content(result)
            if partial_content:
                logger.warning(f"Using partial content extraction for {context}")
                return partial_content
                        
        except Exception as e:
            logger.error(f"Critical error parsing {context}: {e}")
            
        logger.error(f"All JSON parsing strategies failed for {context}")
        return None
    
    @staticmethod
    def _initial_cleanup(result: str) -> str:
        """Initial cleanup of the response"""
        # Remove leading/trailing whitespace
        cleaned = result.strip()
        
        # Remove markdown code blocks
        if cleaned.startswith('```json'):
            cleaned = cleaned[7:]
        elif cleaned.startswith('```'):
            cleaned = cleaned[3:]
        
        if cleaned.endswith('```'):
            cleaned = cleaned[:-3]
        
        # Remove common prefixes
        prefixes_to_remove = [
            'Here is the JSON response:',
            'Here\'s the JSON:',
            'JSON:',
            'Response:',
            'Here is the result:',
            'Result:',
        ]
        
        for prefix in prefixes_to_remove:
            if cleaned.lower().startswith(prefix.lower()):
                cleaned = cleaned[len(prefix):].strip()
        
        return cleaned.strip()
    
    @staticmethod
    def _fix_newlines(text: str) -> str:
        """Fix unescaped newlines within JSON strings"""
        result = []
        in_string = False
        escape_next = False
        
        for i, char in enumerate(text):
            if escape_next:
                result.append(char)
                escape_next = False
                continue
                
            if char == '\\':
                escape_next = True
                result.append(char)
            elif char == '"' and not escape_next:
                in_string = not in_string
                result.append(char)
            elif char == '\n':
                if in_string:
                    result.append('\\n')  # Escape newline in string
                else:
                    result.append(char)   # Keep newline outside string
            elif char == '\r':
                continue  # Skip carriage returns
            elif char == '\t' and in_string:
                result.append('\\t')  # Escape tabs in strings
            else:
                result.append(char)
        
        return ''.join(result)
    
    @staticmethod
    def _fix_trailing_commas(text: str) -> str:
        """Fix trailing commas in JSON"""
        # Remove trailing commas before closing brackets
        text = re.sub(r',\s*}', '}', text)
        text = re.sub(r',\s*]', ']', text)
        
        # Remove trailing commas before newlines followed by closing brackets
        text = re.sub(r',\s*\n\s*}', '\n}', text)
        text = re.sub(r',\s*\n\s*]', '\n]', text)
        
        return text
    
    @staticmethod
    def _fix_unescaped_quotes(text: str) -> str:
        """Fix unescaped quotes within JSON strings"""
        # This is a simple approach - more sophisticated logic could be added
        # Fix common cases where quotes are not escaped
        
        # Pattern to find strings with unescaped quotes
        # This is a simplified approach and might need refinement
        def escape_inner_quotes(match):
            full_match = match.group(0)
            # If there are odd number of quotes, try to escape inner ones
            if full_match.count('"') > 2:
                # Simple strategy: escape quotes that are not at the beginning/end
                content = full_match[1:-1]  # Remove outer quotes
                content = content.replace('"', '\\"')  # Escape inner quotes
                return f'"{content}"'
            return full_match
        
        # Apply to quoted strings
        text = re.sub(r'"[^"]*"', escape_inner_quotes, text)
        
        return text
    
    @staticmethod
    def _fix_structure_issues(text: str) -> str:
        """Fix common JSON structure issues"""
        # Fix missing quotes around property names
        text = re.sub(r'(\s+)(\w+)(\s*):', r'\1"\2"\3:', text)
        
        # Fix missing commas between objects
        text = re.sub(r'}(\s*){', r'},\1{', text)
        text = re.sub(r'](\s*){', r'],\1{', text)
        
        # Fix missing commas between array elements
        text = re.sub(r'}(\s*)"', r'},\1"', text)
        text = re.sub(r'](\s*)"', r'],\1"', text)
        
        return text
    
    @staticmethod
    def _extract_json_content(text: str) -> str:
        """Try to extract JSON content from mixed text"""
        # Find content between first { and last }
        first_brace = text.find('{')
        last_brace = text.rfind('}')
        
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            potential_json = text[first_brace:last_brace + 1]
            return potential_json
        
        # Find content between first [ and last ]
        first_bracket = text.find('[')
        last_bracket = text.rfind(']')
        
        if first_bracket != -1 and last_bracket != -1 and last_bracket > first_bracket:
            potential_json = text[first_bracket:last_bracket + 1]
            return potential_json
        
        return text
    
    @staticmethod
    def _extract_partial_content(text: str) -> Optional[Dict[str, Any]]:
        """Extract partial content when JSON parsing fails completely"""
        try:
            # Try to extract basic information using regex patterns
            content = {}
            
            # Extract title
            title_match = re.search(r'"title"\s*:\s*"([^"]*)"', text)
            if title_match:
                content['title'] = title_match.group(1)
            
            # Extract description
            desc_match = re.search(r'"description"\s*:\s*"([^"]*)"', text)
            if desc_match:
                content['description'] = desc_match.group(1)
            
            # Extract learning objectives
            obj_match = re.search(r'"learning_objectives"\s*:\s*"([^"]*)"', text)
            if obj_match:
                content['learning_objectives'] = obj_match.group(1)
            
            # Only return if we found something meaningful
            if len(content) >= 2:
                content['_partial_extraction'] = True
                logger.warning("Used partial content extraction - content may be incomplete")
                return content
                
        except Exception as e:
            logger.debug(f"Partial extraction failed: {e}")
        
        return None
    
    @staticmethod
    def validate_json_structure(data: Dict[str, Any], expected_keys: Optional[list] = None) -> bool:
        """
        Validate that parsed JSON has expected structure
        
        Args:
            data: Parsed JSON data
            expected_keys: List of keys that should be present
            
        Returns:
            True if structure is valid
        """
        if not isinstance(data, dict):
            return False
        
        if expected_keys:
            for key in expected_keys:
                if key not in data:
                    logger.warning(f"Missing expected key: {key}")
                    return False
        
        return True
    
    @staticmethod
    def clean_content_for_display(content: str) -> str:
        """Clean content for safe display in UI"""
        if not content:
            return ""
        
        # Remove any remaining escape sequences
        content = content.replace('\\n', '\n')
        content = content.replace('\\t', '\t')
        content = content.replace('\\"', '"')
        
        # Ensure proper line endings
        content = content.replace('\r\n', '\n')
        content = content.replace('\r', '\n')
        
        return content.strip()


# Create singleton instance
enhanced_json_parser = EnhancedJSONParser()