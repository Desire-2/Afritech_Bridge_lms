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
        cleaned_result = result.strip()
        if cleaned_result.startswith('```json'):
            cleaned_result = cleaned_result[7:]
        elif cleaned_result.startswith('```'):
            cleaned_result = cleaned_result[3:]
        if cleaned_result.endswith('```'):
            cleaned_result = cleaned_result[:-3]
        return cleaned_result.strip()


# Singleton instance
json_parser = JSONResponseParser()
