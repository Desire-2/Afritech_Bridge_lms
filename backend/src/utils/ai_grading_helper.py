"""
AI Grading Helper - Provides AI-powered grading assistance and suggestions
This module would integrate with actual AI services in production
"""

import logging
import re
import statistics
from typing import Dict, List, Any, Tuple, Optional
from datetime import datetime, timedelta
import hashlib
import json

logger = logging.getLogger(__name__)

class AIGradingHelper:
    """
    AI-powered grading assistant that provides suggestions, feedback generation,
    and automated analysis of student submissions.
    """
    
    # Keywords for different performance categories
    EXCELLENT_KEYWORDS = [
        'comprehensive', 'thorough', 'insightful', 'analysis', 'critical thinking',
        'synthesis', 'evaluation', 'detailed', 'well-structured', 'innovative',
        'creative', 'original', 'evidence-based', 'scholarly', 'research'
    ]
    
    GOOD_KEYWORDS = [
        'clear', 'organized', 'relevant', 'accurate', 'appropriate', 'supported',
        'logical', 'coherent', 'understanding', 'examples', 'explanation'
    ]
    
    NEEDS_IMPROVEMENT_KEYWORDS = [
        'unclear', 'brief', 'superficial', 'incomplete', 'vague', 'unsupported',
        'repetitive', 'basic', 'minimal', 'generic', 'off-topic'
    ]
    
    # Common academic writing patterns
    STRONG_TRANSITION_WORDS = [
        'furthermore', 'moreover', 'consequently', 'therefore', 'however',
        'nevertheless', 'additionally', 'specifically', 'in contrast'
    ]
    
    WEAK_LANGUAGE_PATTERNS = [
        r'\bi think\b', r'\bi believe\b', r'\bi feel\b', r'\bin my opinion\b',
        r'\bkind of\b', r'\bsort of\b', r'\bretty much\b', r'\ba lot of\b'
    ]
    
    @classmethod
    def analyze_submission_content(cls, content: str) -> Dict[str, Any]:
        """
        Analyze submission content for various quality indicators.
        """
        if not content:
            return {
                'word_count': 0,
                'sentence_count': 0,
                'paragraph_count': 0,
                'avg_sentence_length': 0,
                'complexity_score': 1,
                'academic_language_score': 0,
                'structure_score': 0,
                'content_indicators': {
                    'excellent_indicators': 0,
                    'good_indicators': 0,
                    'improvement_needed': 0
                }
            }
        
        # Basic metrics
        words = content.lower().split()
        word_count = len(words)
        sentences = re.split(r'[.!?]+', content)
        sentence_count = len([s for s in sentences if s.strip()])
        paragraphs = content.split('\n\n')
        paragraph_count = len([p for p in paragraphs if p.strip()])
        
        avg_sentence_length = word_count / max(sentence_count, 1)
        
        # Content quality indicators
        content_lower = content.lower()
        excellent_count = sum(1 for keyword in cls.EXCELLENT_KEYWORDS if keyword in content_lower)
        good_count = sum(1 for keyword in cls.GOOD_KEYWORDS if keyword in content_lower)
        improvement_count = sum(1 for keyword in cls.NEEDS_IMPROVEMENT_KEYWORDS if keyword in content_lower)
        
        # Academic language analysis
        strong_transitions = sum(1 for word in cls.STRONG_TRANSITION_WORDS if word in content_lower)
        weak_patterns = sum(1 for pattern in cls.WEAK_LANGUAGE_PATTERNS if re.search(pattern, content_lower, re.IGNORECASE))
        
        academic_language_score = max(0, min(100, (strong_transitions * 10) - (weak_patterns * 5)))
        
        # Structure analysis
        has_introduction = any(word in content_lower[:200] for word in ['introduction', 'begin', 'start', 'first'])
        has_conclusion = any(word in content_lower[-200:] for word in ['conclusion', 'summary', 'finally', 'end'])
        has_transitions = strong_transitions > 0
        proper_paragraphs = paragraph_count >= 3 and word_count > 300
        
        structure_score = sum([has_introduction, has_conclusion, has_transitions, proper_paragraphs]) * 25
        
        # Overall complexity score (1-10)
        complexity_factors = [
            min(10, word_count / 100),  # Word count factor
            min(10, avg_sentence_length / 2),  # Sentence complexity
            min(10, excellent_count),  # Academic vocabulary
            min(10, structure_score / 10)  # Structure quality
        ]
        complexity_score = max(1, min(10, sum(complexity_factors) / len(complexity_factors)))
        
        return {
            'word_count': word_count,
            'sentence_count': sentence_count,
            'paragraph_count': paragraph_count,
            'avg_sentence_length': round(avg_sentence_length, 1),
            'complexity_score': round(complexity_score, 1),
            'academic_language_score': academic_language_score,
            'structure_score': structure_score,
            'content_indicators': {
                'excellent_indicators': excellent_count,
                'good_indicators': good_count,
                'improvement_needed': improvement_count
            },
            'readability_metrics': {
                'strong_transitions': strong_transitions,
                'weak_language_patterns': weak_patterns,
                'has_introduction': has_introduction,
                'has_conclusion': has_conclusion
            }
        }
    
    @classmethod
    def generate_grade_suggestion(cls, submission_data: Dict[str, Any], assignment_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate AI-powered grade suggestion based on submission analysis.
        """
        # Analyze content if text is available
        content_analysis = {}
        if submission_data.get('submission_text'):
            content_analysis = cls.analyze_submission_content(submission_data['submission_text'])
        
        # Base scoring factors
        factors = []
        base_score = 75  # Start with C+ grade
        confidence = 0.5
        
        # Content quality factor
        if content_analysis:
            word_count = content_analysis['word_count']
            complexity = content_analysis['complexity_score']
            academic_language = content_analysis['academic_language_score']
            structure = content_analysis['structure_score']
            
            # Word count assessment
            if word_count < 100:
                word_score_adjustment = -20
                word_factor_impact = 'negative'
            elif word_count < 300:
                word_score_adjustment = -10
                word_factor_impact = 'negative'
            elif word_count > 1000:
                word_score_adjustment = 5
                word_factor_impact = 'positive'
            else:
                word_score_adjustment = 0
                word_factor_impact = 'neutral'
            
            base_score += word_score_adjustment
            factors.append({
                'factor': 'Word Count',
                'weight': 0.25,
                'value': word_count,
                'impact': word_factor_impact,
                'adjustment': word_score_adjustment
            })
            
            # Complexity assessment
            complexity_adjustment = (complexity - 5) * 3  # -15 to +15 range
            base_score += complexity_adjustment
            factors.append({
                'factor': 'Content Complexity',
                'weight': 0.30,
                'value': complexity,
                'impact': 'positive' if complexity >= 6 else 'neutral' if complexity >= 4 else 'negative',
                'adjustment': complexity_adjustment
            })
            
            # Academic language assessment
            academic_adjustment = (academic_language / 100) * 10  # 0 to 10 range
            base_score += academic_adjustment
            factors.append({
                'factor': 'Academic Language',
                'weight': 0.20,
                'value': academic_language,
                'impact': 'positive' if academic_language >= 60 else 'neutral' if academic_language >= 30 else 'negative',
                'adjustment': academic_adjustment
            })
            
            # Structure assessment
            structure_adjustment = (structure / 100) * 8  # 0 to 8 range
            base_score += structure_adjustment
            factors.append({
                'factor': 'Structure & Organization',
                'weight': 0.15,
                'value': structure,
                'impact': 'positive' if structure >= 75 else 'neutral' if structure >= 50 else 'negative',
                'adjustment': structure_adjustment
            })
            
            confidence += 0.3  # Higher confidence with content analysis
        
        # Timeliness factor
        days_late = submission_data.get('days_late', 0)
        if days_late > 0:
            late_penalty = min(days_late * 2, 20)  # Max 20 point penalty
            base_score -= late_penalty
            factors.append({
                'factor': 'Submission Timeliness',
                'weight': 0.10,
                'value': days_late,
                'impact': 'negative',
                'adjustment': -late_penalty
            })
        else:
            factors.append({
                'factor': 'Submission Timeliness',
                'weight': 0.10,
                'value': 0,
                'impact': 'positive',
                'adjustment': 2  # Small bonus for on-time submission
            })
            base_score += 2
        
        # File attachments factor
        if submission_data.get('file_path'):
            factors.append({
                'factor': 'Supporting Materials',
                'weight': 0.05,
                'value': 1,
                'impact': 'positive',
                'adjustment': 3
            })
            base_score += 3
            confidence += 0.1
        
        # External URL factor
        if submission_data.get('external_url'):
            factors.append({
                'factor': 'External Resources',
                'weight': 0.05,
                'value': 1,
                'impact': 'positive',
                'adjustment': 2
            })
            base_score += 2
        
        # Ensure grade is within valid range
        suggested_grade = max(0, min(100, base_score))
        
        # Adjust confidence based on available data
        total_weight = sum(factor['weight'] for factor in factors)
        confidence = min(0.95, confidence * total_weight)
        
        # Generate reasoning
        reasoning_parts = []
        if content_analysis:
            reasoning_parts.append(f"Content analysis shows {content_analysis['word_count']} words")
            reasoning_parts.append(f"complexity score of {content_analysis['complexity_score']}/10")
        
        if days_late > 0:
            reasoning_parts.append(f"submission was {days_late:.1f} days late")
        else:
            reasoning_parts.append("submission was on time")
        
        reasoning = "Grade suggestion based on: " + ", ".join(reasoning_parts) + "."
        
        return {
            'suggested_grade': round(suggested_grade, 1),
            'confidence_score': round(confidence, 2),
            'reasoning': reasoning,
            'factors': factors,
            'content_analysis': content_analysis,
            'grade_breakdown': {
                'content_quality': round(base_score - suggested_grade + sum(f['adjustment'] for f in factors if f['factor'] != 'Content Complexity'), 1),
                'timeliness': -min(days_late * 2, 20) if days_late > 0 else 2,
                'completeness': 5 if submission_data.get('file_path') or submission_data.get('external_url') else 0
            }
        }
    
    @classmethod
    def generate_feedback_suggestions(cls, analysis: Dict[str, Any], grade_percentage: float) -> List[str]:
        """
        Generate contextual feedback suggestions based on submission analysis and grade.
        """
        suggestions = []
        
        if not analysis:
            return ["Please review the submission requirements and provide a more complete response."]
        
        content_analysis = analysis.get('content_analysis', {})
        
        # Grade-based feedback
        if grade_percentage >= 90:
            suggestions.extend([
                "Excellent work! Your submission demonstrates mastery of the subject matter.",
                "Your analysis is thorough and shows deep understanding.",
                "Keep up the outstanding academic performance."
            ])
        elif grade_percentage >= 80:
            suggestions.extend([
                "Good work! Your submission shows solid understanding.",
                "You've addressed the main requirements effectively.",
                "Consider expanding on some key points for even stronger analysis."
            ])
        elif grade_percentage >= 70:
            suggestions.extend([
                "Your submission meets the basic requirements.",
                "There are good ideas present that could be developed further.",
                "Focus on providing more detailed analysis and examples."
            ])
        else:
            suggestions.extend([
                "This submission needs significant improvement to meet the requirements.",
                "Please review the assignment guidelines and consider revising your approach.",
                "I recommend visiting office hours to discuss strategies for improvement."
            ])
        
        # Content-specific feedback
        if content_analysis:
            word_count = content_analysis.get('word_count', 0)
            structure_score = content_analysis.get('structure_score', 0)
            academic_score = content_analysis.get('academic_language_score', 0)
            
            if word_count < 300:
                suggestions.append("Consider expanding your response to provide more detailed analysis.")
            elif word_count > 2000:
                suggestions.append("Excellent depth! Consider focusing on the most important points for clarity.")
            
            if structure_score < 50:
                suggestions.append("Work on organizing your ideas with clear introduction, body, and conclusion.")
            elif structure_score > 75:
                suggestions.append("Excellent organization and structure throughout your response.")
            
            if academic_score < 30:
                suggestions.append("Try to use more formal academic language and avoid informal expressions.")
            elif academic_score > 70:
                suggestions.append("Great use of academic vocabulary and formal writing style.")
            
            readability = content_analysis.get('readability_metrics', {})
            if not readability.get('has_introduction'):
                suggestions.append("Consider adding a stronger introduction to set up your main points.")
            if not readability.get('has_conclusion'):
                suggestions.append("A concluding paragraph would help summarize your key insights.")
        
        return suggestions[:5]  # Limit to 5 most relevant suggestions
    
    @classmethod
    def generate_improvement_recommendations(cls, submission_data: Dict[str, Any], similar_submissions: List[Dict[str, Any]]) -> List[str]:
        """
        Generate specific improvement recommendations based on submission analysis and comparison.
        """
        recommendations = []
        
        # Analyze current submission
        content_analysis = cls.analyze_submission_content(submission_data.get('submission_text', ''))
        
        # Compare with similar high-performing submissions
        if similar_submissions:
            high_performers = [s for s in similar_submissions if s.get('grade', 0) > 85]
            if high_performers:
                avg_high_performer_words = statistics.mean([
                    len(s.get('submission_text', '').split()) for s in high_performers
                ])
                
                current_words = content_analysis.get('word_count', 0)
                if current_words < avg_high_performer_words * 0.7:
                    recommendations.append(
                        f"Top-performing submissions typically have {int(avg_high_performer_words)} words. "
                        f"Consider expanding your analysis to provide more depth."
                    )
        
        # Structure recommendations
        structure_score = content_analysis.get('structure_score', 0)
        if structure_score < 75:
            recommendations.extend([
                "Organize your response with a clear introduction, body paragraphs, and conclusion.",
                "Use transition words to connect your ideas more effectively.",
                "Consider creating topic sentences for each main point."
            ])
        
        # Content depth recommendations
        complexity_score = content_analysis.get('complexity_score', 0)
        if complexity_score < 6:
            recommendations.extend([
                "Provide more specific examples to support your arguments.",
                "Analyze the 'why' and 'how' behind your main points.",
                "Connect your ideas to broader concepts or theories from the course."
            ])
        
        # Academic writing recommendations
        academic_score = content_analysis.get('academic_language_score', 0)
        if academic_score < 50:
            recommendations.extend([
                "Use more formal academic language and avoid conversational phrases.",
                "Cite relevant sources to support your arguments where appropriate.",
                "Replace opinion-based statements with evidence-based analysis."
            ])
        
        return recommendations[:6]  # Limit to most important recommendations
    
    @classmethod
    def calculate_similarity_score(cls, text1: str, text2: str) -> float:
        """
        Calculate basic similarity score between two texts using simple hashing.
        In production, this would use more sophisticated NLP techniques.
        """
        if not text1 or not text2:
            return 0.0
        
        # Simple word-based similarity
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union) if union else 0.0
    
    @classmethod
    def find_similar_submissions(cls, target_submission: Dict[str, Any], all_submissions: List[Dict[str, Any]], threshold: float = 0.3) -> List[Dict[str, Any]]:
        """
        Find submissions similar to the target submission.
        """
        target_text = target_submission.get('submission_text', '')
        if not target_text:
            return []
        
        similar = []
        for submission in all_submissions:
            if submission['id'] == target_submission['id']:
                continue
            
            similarity = cls.calculate_similarity_score(
                target_text, 
                submission.get('submission_text', '')
            )
            
            if similarity >= threshold:
                similar.append({
                    **submission,
                    'similarity_score': similarity
                })
        
        # Sort by similarity score descending
        return sorted(similar, key=lambda x: x['similarity_score'], reverse=True)[:5]
    
    @classmethod
    def estimate_grading_time(cls, submission_data: Dict[str, Any]) -> int:
        """
        Estimate grading time in minutes based on submission complexity.
        """
        base_time = 8  # Base grading time in minutes
        
        # Word count factor
        word_count = len(submission_data.get('submission_text', '').split())
        if word_count > 500:
            base_time += (word_count // 500) * 2
        
        # Attachments factor
        if submission_data.get('file_path'):
            base_time += 5
        
        # External URL factor
        if submission_data.get('external_url'):
            base_time += 3
        
        # Complexity factor
        content_analysis = cls.analyze_submission_content(submission_data.get('submission_text', ''))
        complexity = content_analysis.get('complexity_score', 5)
        base_time += int((complexity - 5) * 1.5)
        
        # Late submission factor (might need more careful review)
        if submission_data.get('days_late', 0) > 0:
            base_time += 2
        
        return max(5, min(30, base_time))  # Cap between 5-30 minutes