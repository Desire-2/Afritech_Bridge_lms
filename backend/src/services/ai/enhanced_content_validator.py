"""
Enhanced Content Quality Validator
Comprehensive content validation with quality scoring and improvement suggestions
"""

import re
import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class ContentType(Enum):
    COURSE_OUTLINE = "course_outline"
    MODULE_CONTENT = "module_content" 
    LESSON_CONTENT = "lesson_content"
    MIXED_CONTENT = "mixed_content"
    QUIZ_QUESTIONS = "quiz_questions"
    ASSIGNMENT = "assignment"
    PROJECT = "project"


class QualityAspect(Enum):
    COMPLETENESS = "completeness"
    STRUCTURE = "structure"
    DEPTH = "depth"
    CLARITY = "clarity"
    EDUCATIONAL_VALUE = "educational_value"
    FORMATTING = "formatting"
    LENGTH = "length"


@dataclass
class QualityScore:
    aspect: QualityAspect
    score: float  # 0.0 to 1.0
    feedback: str
    suggestions: List[str]


@dataclass
class ContentValidationResult:
    overall_score: float
    quality_scores: List[QualityScore]
    is_valid: bool
    critical_issues: List[str]
    warnings: List[str]
    suggestions: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "overall_score": self.overall_score,
            "is_valid": self.is_valid,
            "quality_breakdown": {
                score.aspect.value: {
                    "score": score.score,
                    "feedback": score.feedback,
                    "suggestions": score.suggestions
                } for score in self.quality_scores
            },
            "critical_issues": self.critical_issues,
            "warnings": self.warnings,
            "suggestions": self.suggestions
        }


class EnhancedContentValidator:
    """Enhanced content validation with comprehensive quality assessment"""
    
    def __init__(self):
        self.minimum_scores = {
            QualityAspect.COMPLETENESS: 0.5,      # Reduced from 0.6
            QualityAspect.STRUCTURE: 0.5,         # Reduced from 0.7  
            QualityAspect.DEPTH: 0.4,             # Reduced from 0.5
            QualityAspect.CLARITY: 0.5,           # Reduced from 0.6
            QualityAspect.EDUCATIONAL_VALUE: 0.5, # Reduced from 0.6
            QualityAspect.FORMATTING: 0.5,        # Reduced from 0.7
            QualityAspect.LENGTH: 0.4             # Reduced from 0.5
        }
    
    def validate_content_comprehensive(self, content: Dict[str, Any], 
                                     content_type: ContentType) -> ContentValidationResult:
        """
        Perform comprehensive content validation with detailed scoring
        
        Args:
            content: The generated content to validate
            content_type: Type of content being validated
            
        Returns:
            ContentValidationResult with detailed analysis
        """
        quality_scores = []
        critical_issues = []
        warnings = []
        suggestions = []
        
        # Validate each quality aspect
        for aspect in QualityAspect:
            score = self._assess_quality_aspect(content, content_type, aspect)
            quality_scores.append(score)
            
            # More permissive thresholds for quiz questions
            critical_threshold = self.minimum_scores.get(aspect, 0.3 if content_type == ContentType.QUIZ_QUESTIONS else 0.5)
            warning_threshold = 0.6 if content_type == ContentType.QUIZ_QUESTIONS else 0.8
            
            if score.score < critical_threshold:
                critical_issues.append(f"Low {aspect.value} score: {score.feedback}")
            elif score.score < warning_threshold:
                warnings.append(f"Moderate {aspect.value}: {score.feedback}")
            
            suggestions.extend(score.suggestions)
        
        # Calculate overall score
        overall_score = sum(score.score for score in quality_scores) / len(quality_scores)
        
        # Determine if content is valid (more permissive for quiz questions)
        base_threshold = 0.4 if content_type == ContentType.QUIZ_QUESTIONS else 0.5
        is_valid = (
            overall_score >= base_threshold and  # More permissive for quizzes
            len(critical_issues) == 0 and
            all(score.score >= self.minimum_scores.get(score.aspect, 0.3 if content_type == ContentType.QUIZ_QUESTIONS else 0.4) 
                for score in quality_scores)
        )
        
        return ContentValidationResult(
            overall_score=overall_score,
            quality_scores=quality_scores,
            is_valid=is_valid,
            critical_issues=critical_issues,
            warnings=warnings,
            suggestions=list(set(suggestions))  # Remove duplicates
        )
    
    def _assess_quality_aspect(self, content: Dict[str, Any], 
                              content_type: ContentType, 
                              aspect: QualityAspect) -> QualityScore:
        """Assess a specific quality aspect of the content"""
        
        if aspect == QualityAspect.COMPLETENESS:
            return self._assess_completeness(content, content_type)
        elif aspect == QualityAspect.STRUCTURE:
            return self._assess_structure(content, content_type)
        elif aspect == QualityAspect.DEPTH:
            return self._assess_depth(content, content_type)
        elif aspect == QualityAspect.CLARITY:
            return self._assess_clarity(content, content_type)
        elif aspect == QualityAspect.EDUCATIONAL_VALUE:
            return self._assess_educational_value(content, content_type)
        elif aspect == QualityAspect.FORMATTING:
            return self._assess_formatting(content, content_type)
        elif aspect == QualityAspect.LENGTH:
            return self._assess_length(content, content_type)
        else:
            return QualityScore(aspect, 0.5, "Unknown aspect", [])
    
    def _assess_completeness(self, content: Dict[str, Any], content_type: ContentType) -> QualityScore:
        """Assess content completeness based on expected fields"""
        score = 0.0
        feedback = ""
        suggestions = []
        
        required_fields = self._get_required_fields(content_type)
        optional_fields = self._get_optional_fields(content_type)
        
        # Check required fields
        missing_required = [field for field in required_fields if not content.get(field)]
        present_required = len(required_fields) - len(missing_required)
        
        if required_fields:
            score += (present_required / len(required_fields)) * 0.7
        
        # Check optional fields for bonus points
        present_optional = sum(1 for field in optional_fields if content.get(field))
        if optional_fields:
            score += (present_optional / len(optional_fields)) * 0.3
        
        score = min(1.0, score)
        
        if missing_required:
            feedback = f"Missing required fields: {', '.join(missing_required)}"
            suggestions.extend([f"Add {field}" for field in missing_required[:3]])
        else:
            feedback = "All required fields present"
        
        if present_optional < len(optional_fields) / 2:
            suggestions.append("Consider adding more optional fields for richer content")
        
        return QualityScore(QualityAspect.COMPLETENESS, score, feedback, suggestions)
    
    def _assess_structure(self, content: Dict[str, Any], content_type: ContentType) -> QualityScore:
        """Assess content structure and organization"""
        score = 0.7  # Reduced base score for AI content
        feedback = "Good structure"
        suggestions = []
        
        # Check for proper nesting and hierarchy
        if content_type == ContentType.LESSON_CONTENT:
            if isinstance(content.get('content'), str):
                text = content['content']
                
                # Check for headings (more lenient)
                heading_count = len(re.findall(r'^#+\s', text, re.MULTILINE))
                if heading_count >= 2:  # Reduced from 3
                    score += 0.15  # Increased bonus
                elif heading_count >= 1:
                    score += 0.05  # Small bonus for any heading
                else:
                    score -= 0.1   # Reduced penalty
                    suggestions.append("Add section headings for better structure")
                
                # Check for bullet points or numbered lists (more lenient)
                list_count = len(re.findall(r'^\s*[-*+]\s|^\s*\d+\.\s', text, re.MULTILINE))
                if list_count >= 2:  # Reduced from 3
                    score += 0.15
                elif list_count >= 1:
                    score += 0.05
                else:
                    suggestions.append("Consider adding bullet points or numbered lists")
        
        elif content_type == ContentType.COURSE_OUTLINE:
            modules = content.get('suggested_modules', [])
            if isinstance(modules, list) and modules:
                # Check if modules have proper structure
                well_structured = all(
                    isinstance(module, dict) and 
                    module.get('title') and 
                    module.get('description')
                    for module in modules
                )
                if not well_structured:
                    score -= 0.3
                    suggestions.append("Ensure all modules have title and description")
        
        score = max(0.0, min(1.0, score))
        
        if score < 0.6:
            feedback = "Structure needs improvement"
        elif score >= 0.9:
            feedback = "Excellent structure"
        
        return QualityScore(QualityAspect.STRUCTURE, score, feedback, suggestions)
    
    def _assess_depth(self, content: Dict[str, Any], content_type: ContentType) -> QualityScore:
        """Assess content depth and detail level"""
        score = 0.6  # Higher base score for AI content
        feedback = ""
        suggestions = []
        
        # Assess based on content length and detail
        main_content = ""
        if content.get('content'):
            main_content = str(content['content'])
        elif content.get('description'):
            main_content = str(content['description'])
        
        # Word count analysis (more lenient thresholds)
        word_count = len(main_content.split())
        
        expected_lengths = {
            ContentType.COURSE_OUTLINE: (80, 250),    # Reduced from (100, 300)
            ContentType.MODULE_CONTENT: (120, 400),   # Reduced from (150, 500)
            ContentType.LESSON_CONTENT: (200, 1200),  # Reduced from (300, 2000)
            ContentType.MIXED_CONTENT: (150, 1000),   # Reduced from (200, 1500)
            ContentType.ASSIGNMENT: (80, 300)         # Reduced from (100, 400)
        }
        
        min_length, ideal_length = expected_lengths.get(content_type, (100, 500))
        
        if word_count >= ideal_length:
            score = 1.0
            feedback = "Excellent depth and detail"
        elif word_count >= min_length:
            score = 0.6 + (word_count - min_length) / (ideal_length - min_length) * 0.4
            feedback = "Good depth"
        else:
            score = max(0.1, word_count / min_length * 0.6)
            feedback = "Content lacks depth"
            suggestions.append("Add more detailed explanations and examples")
        
        # Check for examples and explanations
        example_indicators = ['example', 'for instance', 'such as', 'e.g.', 'consider']
        example_count = sum(main_content.lower().count(indicator) for indicator in example_indicators)
        
        if example_count >= 3:
            score += 0.1
        elif example_count == 0:
            suggestions.append("Add practical examples to improve depth")
        
        score = min(1.0, score)
        
        return QualityScore(QualityAspect.DEPTH, score, feedback, suggestions)
    
    def _assess_clarity(self, content: Dict[str, Any], content_type: ContentType) -> QualityScore:
        """Assess content clarity and readability"""
        score = 0.7  # Base score
        feedback = "Clear content"
        suggestions = []
        
        main_content = ""
        if content.get('content'):
            main_content = str(content['content'])
        elif content.get('description'):
            main_content = str(content['description'])
        
        if not main_content:
            return QualityScore(QualityAspect.CLARITY, 0.3, "No content to assess", ["Add main content"])
        
        # Sentence length analysis
        sentences = re.split(r'[.!?]+', main_content)
        sentence_lengths = [len(sentence.split()) for sentence in sentences if sentence.strip()]
        
        if sentence_lengths:
            avg_sentence_length = sum(sentence_lengths) / len(sentence_lengths)
            
            # Ideal sentence length is 10-20 words
            if 10 <= avg_sentence_length <= 20:
                score += 0.1
            elif avg_sentence_length > 25:
                score -= 0.2
                suggestions.append("Break down long sentences for better readability")
        
        # Check for technical jargon without explanation
        technical_terms = re.findall(r'\b[A-Z]{2,}\b|\b\w+(?:API|SDK|HTTP|SQL|JSON)\w*\b', main_content)
        if len(technical_terms) > len(main_content.split()) * 0.05:  # More than 5% technical terms
            score -= 0.1
            suggestions.append("Consider explaining technical terms for better clarity")
        
        # Check for transition words
        transition_words = ['however', 'therefore', 'furthermore', 'additionally', 'consequently']
        transition_count = sum(main_content.lower().count(word) for word in transition_words)
        
        if transition_count >= 2:
            score += 0.1
        elif transition_count == 0:
            suggestions.append("Add transition words to improve flow")
        
        score = max(0.0, min(1.0, score))
        
        if score < 0.5:
            feedback = "Content clarity needs improvement"
        elif score >= 0.9:
            feedback = "Excellent clarity"
        
        return QualityScore(QualityAspect.CLARITY, score, feedback, suggestions)
    
    def _assess_educational_value(self, content: Dict[str, Any], content_type: ContentType) -> QualityScore:
        """Assess educational value and learning potential"""
        score = 0.6  # Base score
        feedback = "Good educational value"
        suggestions = []
        
        # Check for learning objectives
        if content.get('learning_objectives'):
            score += 0.2
        else:
            suggestions.append("Add clear learning objectives")
        
        # Check for assessment elements
        main_content = str(content.get('content', ''))
        
        assessment_indicators = ['exercise', 'practice', 'quiz', 'question', 'assignment', 'project']
        assessment_count = sum(main_content.lower().count(indicator) for indicator in assessment_indicators)
        
        if assessment_count >= 2:
            score += 0.2
        elif assessment_count == 0:
            suggestions.append("Include practice exercises or assessments")
        
        # Check for real-world connections
        real_world_indicators = ['real-world', 'industry', 'practical', 'application', 'use case']
        real_world_count = sum(main_content.lower().count(indicator) for indicator in real_world_indicators)
        
        if real_world_count >= 1:
            score += 0.1
        else:
            suggestions.append("Add real-world applications and examples")
        
        score = min(1.0, score)
        
        return QualityScore(QualityAspect.EDUCATIONAL_VALUE, score, feedback, suggestions)
    
    def _assess_formatting(self, content: Dict[str, Any], content_type: ContentType) -> QualityScore:
        """Assess content formatting and presentation"""
        score = 0.7  # Base score
        feedback = "Good formatting"
        suggestions = []
        
        main_content = str(content.get('content', ''))
        
        if not main_content:
            return QualityScore(QualityAspect.FORMATTING, 0.5, "No content to format", [])
        
        # Check for markdown formatting
        has_headers = bool(re.search(r'^#+\s', main_content, re.MULTILINE))
        has_bold = bool(re.search(r'\*\*.*?\*\*|__.*?__', main_content))
        has_italic = bool(re.search(r'\*.*?\*|_.*?_', main_content))
        has_lists = bool(re.search(r'^\s*[-*+]\s|^\s*\d+\.\s', main_content, re.MULTILINE))
        has_code = bool(re.search(r'`.*?`|```.*?```', main_content, re.DOTALL))
        
        formatting_features = sum([has_headers, has_bold, has_italic, has_lists, has_code])
        
        if formatting_features >= 4:
            score = 1.0
            feedback = "Excellent formatting"
        elif formatting_features >= 2:
            score = 0.8
        elif formatting_features == 1:
            score = 0.6
            suggestions.append("Use more markdown formatting for better presentation")
        else:
            score = 0.4
            feedback = "Poor formatting"
            suggestions.extend([
                "Add headings to structure content",
                "Use bold/italic for emphasis",
                "Use lists for better organization"
            ])
        
        # Check for proper spacing
        lines = main_content.split('\n')
        empty_line_ratio = sum(1 for line in lines if line.strip() == '') / max(len(lines), 1)
        
        if 0.1 <= empty_line_ratio <= 0.3:  # Good spacing
            score += 0.1
        elif empty_line_ratio > 0.5:  # Too much spacing
            score -= 0.1
            suggestions.append("Reduce excessive blank lines")
        
        score = max(0.0, min(1.0, score))
        
        return QualityScore(QualityAspect.FORMATTING, score, feedback, suggestions)
    
    def _assess_length(self, content: Dict[str, Any], content_type: ContentType) -> QualityScore:
        """Assess content length appropriateness"""
        main_content = str(content.get('content', '') or content.get('description', ''))
        word_count = len(main_content.split())
        
        length_ranges = {
            ContentType.COURSE_OUTLINE: (60, 120, 350),      # Reduced minimums
            ContentType.MODULE_CONTENT: (100, 200, 550),     # More forgiving
            ContentType.LESSON_CONTENT: (180, 600, 2500),    # Lower minimum, higher max
            ContentType.MIXED_CONTENT: (150, 450, 1800),     # More lenient
            ContentType.ASSIGNMENT: (60, 150, 450)           # Reduced minimums
        }
        
        min_length, ideal_min, ideal_max = length_ranges.get(content_type, (80, 250, 900))
        
        if ideal_min <= word_count <= ideal_max:
            score = 1.0
            feedback = "Perfect length"
            suggestions = []
        elif word_count >= min_length:
            if word_count < ideal_min:
                score = 0.7 + (word_count - min_length) / (ideal_min - min_length) * 0.3  # Higher base
                feedback = "Good length but could be expanded"
                suggestions = ["Consider adding more detail"]
            else:  # word_count > ideal_max
                excess_ratio = (word_count - ideal_max) / ideal_max
                score = max(0.6, 1.0 - excess_ratio * 0.4)  # More forgiving for long content
                feedback = "Content is quite long"
                suggestions = ["Consider breaking into smaller sections"]
        else:
            score = max(0.3, word_count / min_length * 0.7)  # Higher minimum score
            feedback = "Content is too short"
            suggestions = ["Add significant content to meet minimum requirements"]
        
        return QualityScore(QualityAspect.LENGTH, score, feedback, suggestions)
    
    def _get_required_fields(self, content_type: ContentType) -> List[str]:
        """Get required fields for a content type"""
        field_map = {
            ContentType.COURSE_OUTLINE: ['title', 'description'],
            ContentType.MODULE_CONTENT: ['title', 'description'],
            ContentType.LESSON_CONTENT: ['title', 'content'],
            ContentType.MIXED_CONTENT: ['title', 'sections'],
            ContentType.QUIZ_QUESTIONS: ['questions'],
            ContentType.ASSIGNMENT: ['title', 'description'],
            ContentType.PROJECT: ['title', 'description']
        }
        return field_map.get(content_type, ['title'])
    
    def _get_optional_fields(self, content_type: ContentType) -> List[str]:
        """Get optional fields that enhance content quality"""
        field_map = {
            ContentType.COURSE_OUTLINE: ['learning_objectives', 'estimated_duration', 'prerequisites'],
            ContentType.MODULE_CONTENT: ['learning_objectives', 'estimated_duration', 'suggested_lessons'],
            ContentType.LESSON_CONTENT: ['learning_objectives', 'duration_minutes', 'difficulty_level'],
            ContentType.MIXED_CONTENT: ['learning_objectives', 'template_id'],
            ContentType.QUIZ_QUESTIONS: ['difficulty', 'time_limit'],
            ContentType.ASSIGNMENT: ['requirements', 'grading_criteria', 'due_date'],
            ContentType.PROJECT: ['requirements', 'deliverables', 'timeline']
        }
        return field_map.get(content_type, [])
    
    def suggest_improvements(self, content: Dict[str, Any], 
                           validation_result: ContentValidationResult) -> List[str]:
        """Generate specific improvement suggestions based on validation results"""
        improvements = []
        
        # Priority improvements based on critical issues
        if validation_result.critical_issues:
            improvements.append("Critical Issues (High Priority):")
            for issue in validation_result.critical_issues[:3]:  # Top 3 critical issues
                improvements.append(f"• {issue}")
        
        # Quality improvements
        low_scoring_aspects = [
            score for score in validation_result.quality_scores 
            if score.score < 0.7
        ]
        
        if low_scoring_aspects:
            improvements.append("Quality Improvements:")
            for score in sorted(low_scoring_aspects, key=lambda x: x.score)[:3]:
                improvements.append(f"• Improve {score.aspect.value}: {score.feedback}")
        
        # Specific suggestions
        unique_suggestions = list(set(validation_result.suggestions))
        if unique_suggestions:
            improvements.append("Specific Suggestions:")
            for suggestion in unique_suggestions[:5]:  # Top 5 suggestions
                improvements.append(f"• {suggestion}")
        
        return improvements


# Create singleton instance
enhanced_content_validator = EnhancedContentValidator()