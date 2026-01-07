"""
Plagiarism Checker - Basic plagiarism detection utilities
In production, this would integrate with services like Turnitin, Copyscape, or custom ML models
"""

import re
import hashlib
import logging
from typing import Dict, List, Any, Tuple, Optional
from difflib import SequenceMatcher
import urllib.parse
from datetime import datetime

logger = logging.getLogger(__name__)

class PlagiarismChecker:
    """
    Basic plagiarism detection system for educational content.
    Provides text similarity analysis, pattern detection, and reporting.
    """
    
    # Common academic phrases that shouldn't be flagged
    COMMON_ACADEMIC_PHRASES = [
        "in conclusion", "in summary", "furthermore", "moreover", "however",
        "according to", "as stated by", "research shows", "studies indicate",
        "it can be argued", "on the other hand", "for example", "such as"
    ]
    
    # Suspicious patterns that might indicate copying
    SUSPICIOUS_PATTERNS = [
        r'\bcopy.*paste\b',
        r'\bctrl.*[cv]\b',
        r'\bcopied.*from\b',
        r'\bsource.*unknown\b',
        r'\bfound.*online\b',
        r'^\s*https?://',  # URLs at the beginning of lines
        r'\bwikipedia\b.*\bsays\b',
        r'\baccording to google\b'
    ]
    
    # Common copied content indicators
    COPY_INDICATORS = [
        "© copyright", "all rights reserved", "terms of use", "privacy policy",
        "click here", "subscribe", "download", "advertisement", "sponsored"
    ]
    
    @classmethod
    def analyze_text_for_plagiarism(cls, text: str, student_id: int, assignment_id: int) -> Dict[str, Any]:
        """
        Perform comprehensive plagiarism analysis on submitted text.
        """
        if not text or len(text.strip()) < 50:
            return {
                'risk_level': 'low',
                'confidence': 0.1,
                'flags': [],
                'suspicious_segments': [],
                'recommendations': []
            }
        
        analysis_results = {
            'risk_level': 'low',
            'confidence': 0.0,
            'flags': [],
            'suspicious_segments': [],
            'recommendations': [],
            'metadata': {
                'text_length': len(text),
                'word_count': len(text.split()),
                'analyzed_at': datetime.utcnow().isoformat()
            }
        }
        
        # Check for suspicious patterns
        pattern_flags = cls._check_suspicious_patterns(text)
        analysis_results['flags'].extend(pattern_flags)
        
        # Check for copy indicators
        copy_flags = cls._check_copy_indicators(text)
        analysis_results['flags'].extend(copy_flags)
        
        # Analyze text structure for anomalies
        structure_flags = cls._analyze_text_structure(text)
        analysis_results['flags'].extend(structure_flags)
        
        # Find potentially suspicious segments
        suspicious_segments = cls._identify_suspicious_segments(text)
        analysis_results['suspicious_segments'] = suspicious_segments
        
        # Calculate overall risk level
        risk_score = len(analysis_results['flags']) + len(suspicious_segments)
        if risk_score >= 5:
            analysis_results['risk_level'] = 'high'
            analysis_results['confidence'] = 0.8
        elif risk_score >= 2:
            analysis_results['risk_level'] = 'medium'
            analysis_results['confidence'] = 0.6
        else:
            analysis_results['risk_level'] = 'low'
            analysis_results['confidence'] = 0.3
        
        # Generate recommendations
        analysis_results['recommendations'] = cls._generate_recommendations(analysis_results)
        
        return analysis_results
    
    @classmethod
    def compare_submissions(cls, text1: str, text2: str, student1_id: int = None, student2_id: int = None) -> Dict[str, Any]:
        """
        Compare two submissions for similarity.
        """
        if not text1 or not text2:
            return {
                'similarity_score': 0.0,
                'matching_segments': [],
                'risk_assessment': 'low'
            }
        
        # Calculate overall similarity
        similarity = SequenceMatcher(None, text1.lower(), text2.lower()).ratio()
        
        # Find matching segments
        matching_segments = cls._find_matching_segments(text1, text2)
        
        # Assess risk based on similarity and matching segments
        if similarity > 0.7 or len(matching_segments) > 3:
            risk = 'high'
        elif similarity > 0.4 or len(matching_segments) > 1:
            risk = 'medium'
        else:
            risk = 'low'
        
        return {
            'similarity_score': round(similarity, 3),
            'matching_segments': matching_segments,
            'risk_assessment': risk,
            'detailed_analysis': {
                'character_similarity': similarity,
                'word_similarity': cls._calculate_word_similarity(text1, text2),
                'structure_similarity': cls._calculate_structure_similarity(text1, text2)
            }
        }
    
    @classmethod
    def batch_check_assignment(cls, submissions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Check all submissions for an assignment against each other.
        """
        results = {
            'total_submissions': len(submissions),
            'high_risk_pairs': [],
            'medium_risk_pairs': [],
            'individual_analyses': {},
            'summary': {
                'high_risk_count': 0,
                'medium_risk_count': 0,
                'clean_submissions': 0
            }
        }
        
        # Individual analysis for each submission
        for submission in submissions:
            if submission.get('submission_text'):
                analysis = cls.analyze_text_for_plagiarism(
                    submission['submission_text'],
                    submission.get('student_id'),
                    submission.get('assignment_id')
                )
                results['individual_analyses'][submission['id']] = analysis
                
                if analysis['risk_level'] == 'high':
                    results['summary']['high_risk_count'] += 1
                elif analysis['risk_level'] == 'medium':
                    results['summary']['medium_risk_count'] += 1
                else:
                    results['summary']['clean_submissions'] += 1
        
        # Cross-comparison between submissions
        for i, submission1 in enumerate(submissions):
            for j, submission2 in enumerate(submissions[i+1:], i+1):
                if not submission1.get('submission_text') or not submission2.get('submission_text'):
                    continue
                
                comparison = cls.compare_submissions(
                    submission1['submission_text'],
                    submission2['submission_text'],
                    submission1.get('student_id'),
                    submission2.get('student_id')
                )
                
                pair_info = {
                    'submission_1': {
                        'id': submission1['id'],
                        'student_id': submission1.get('student_id'),
                        'student_name': submission1.get('student_name')
                    },
                    'submission_2': {
                        'id': submission2['id'],
                        'student_id': submission2.get('student_id'),
                        'student_name': submission2.get('student_name')
                    },
                    'similarity_data': comparison
                }
                
                if comparison['risk_assessment'] == 'high':
                    results['high_risk_pairs'].append(pair_info)
                elif comparison['risk_assessment'] == 'medium':
                    results['medium_risk_pairs'].append(pair_info)
        
        return results
    
    @classmethod
    def _check_suspicious_patterns(cls, text: str) -> List[Dict[str, Any]]:
        """Check for suspicious patterns in text."""
        flags = []
        text_lower = text.lower()
        
        for pattern in cls.SUSPICIOUS_PATTERNS:
            matches = re.finditer(pattern, text_lower, re.IGNORECASE | re.MULTILINE)
            for match in matches:
                flags.append({
                    'type': 'suspicious_pattern',
                    'description': f'Suspicious pattern detected: {pattern}',
                    'location': match.span(),
                    'context': text[max(0, match.start()-20):match.end()+20],
                    'severity': 'medium'
                })
        
        return flags
    
    @classmethod
    def _check_copy_indicators(cls, text: str) -> List[Dict[str, Any]]:
        """Check for common copied content indicators."""
        flags = []
        text_lower = text.lower()
        
        for indicator in cls.COPY_INDICATORS:
            if indicator in text_lower:
                flags.append({
                    'type': 'copy_indicator',
                    'description': f'Found potential copied content indicator: {indicator}',
                    'severity': 'high'
                })
        
        return flags
    
    @classmethod
    def _analyze_text_structure(cls, text: str) -> List[Dict[str, Any]]:
        """Analyze text structure for anomalies."""
        flags = []
        
        # Check for sudden style changes
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        
        if len(paragraphs) > 2:
            # Analyze sentence length variations
            paragraph_sentence_counts = []
            for paragraph in paragraphs:
                sentences = re.split(r'[.!?]+', paragraph)
                sentence_count = len([s for s in sentences if s.strip()])
                paragraph_sentence_counts.append(sentence_count)
            
            # Flag if there's extreme variation in paragraph structure
            if paragraph_sentence_counts:
                avg_sentences = sum(paragraph_sentence_counts) / len(paragraph_sentence_counts)
                for i, count in enumerate(paragraph_sentence_counts):
                    if count > avg_sentences * 2.5 and count > 10:
                        flags.append({
                            'type': 'structure_anomaly',
                            'description': f'Paragraph {i+1} has unusually long structure ({count} sentences vs avg {avg_sentences:.1f})',
                            'severity': 'low'
                        })
        
        # Check for formatting inconsistencies
        if re.search(r'\n\s*\n\s*\n', text):  # Triple line breaks
            flags.append({
                'type': 'formatting_inconsistency',
                'description': 'Inconsistent paragraph spacing detected',
                'severity': 'low'
            })
        
        # Check for mixed writing styles (very basic)
        formal_indicators = len(re.findall(r'\b(furthermore|moreover|consequently|therefore)\b', text, re.IGNORECASE))
        informal_indicators = len(re.findall(r'\b(gonna|wanna|don\'t|can\'t|won\'t)\b', text, re.IGNORECASE))
        
        if formal_indicators > 0 and informal_indicators > formal_indicators:
            flags.append({
                'type': 'style_inconsistency',
                'description': 'Mixed formal and informal writing styles detected',
                'severity': 'low'
            })
        
        return flags
    
    @classmethod
    def _identify_suspicious_segments(cls, text: str) -> List[Dict[str, Any]]:
        """Identify potentially suspicious text segments."""
        segments = []
        
        # Look for segments with unusual characteristics
        sentences = re.split(r'[.!?]+', text)
        
        for i, sentence in enumerate(sentences):
            sentence = sentence.strip()
            if len(sentence) < 20:
                continue
            
            # Check for overly complex sentences (might indicate copying from academic sources)
            words = sentence.split()
            if len(words) > 40:  # Very long sentence
                segments.append({
                    'type': 'complex_sentence',
                    'content': sentence[:100] + '...' if len(sentence) > 100 else sentence,
                    'position': i,
                    'reason': 'Unusually complex sentence structure',
                    'risk_level': 'low'
                })
            
            # Check for technical jargon without context
            technical_words = re.findall(r'\b[a-z]*[A-Z][a-z]*[A-Z][a-z]*\b', sentence)  # CamelCase words
            if len(technical_words) > 3:
                segments.append({
                    'type': 'technical_jargon',
                    'content': sentence[:100] + '...' if len(sentence) > 100 else sentence,
                    'position': i,
                    'reason': 'High concentration of technical terms',
                    'risk_level': 'medium'
                })
        
        return segments[:5]  # Limit to top 5 suspicious segments
    
    @classmethod
    def _find_matching_segments(cls, text1: str, text2: str, min_length: int = 20) -> List[Dict[str, Any]]:
        """Find matching text segments between two submissions."""
        matching_segments = []
        
        # Split texts into sentences
        sentences1 = [s.strip() for s in re.split(r'[.!?]+', text1) if len(s.strip()) > min_length]
        sentences2 = [s.strip() for s in re.split(r'[.!?]+', text2) if len(s.strip()) > min_length]
        
        for i, sentence1 in enumerate(sentences1):
            for j, sentence2 in enumerate(sentences2):
                similarity = SequenceMatcher(None, sentence1.lower(), sentence2.lower()).ratio()
                
                if similarity > 0.8:  # High similarity threshold
                    matching_segments.append({
                        'similarity': round(similarity, 3),
                        'text1_segment': sentence1[:100] + '...' if len(sentence1) > 100 else sentence1,
                        'text2_segment': sentence2[:100] + '...' if len(sentence2) > 100 else sentence2,
                        'position_1': i,
                        'position_2': j,
                        'type': 'sentence_match'
                    })
        
        # Look for longer phrase matches
        words1 = text1.lower().split()
        words2 = text2.lower().split()
        
        for i in range(len(words1) - 4):  # Look for 5+ word matches
            phrase = ' '.join(words1[i:i+5])
            phrase_text = ' '.join(words2)
            if phrase in phrase_text and len(phrase) > 25:
                matching_segments.append({
                    'similarity': 1.0,
                    'text1_segment': phrase,
                    'text2_segment': phrase,
                    'type': 'phrase_match'
                })
        
        return matching_segments[:10]  # Limit results
    
    @classmethod
    def _calculate_word_similarity(cls, text1: str, text2: str) -> float:
        """Calculate word-level similarity between texts."""
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union)
    
    @classmethod
    def _calculate_structure_similarity(cls, text1: str, text2: str) -> float:
        """Calculate structural similarity between texts."""
        # Compare paragraph counts
        paragraphs1 = len([p for p in text1.split('\n\n') if p.strip()])
        paragraphs2 = len([p for p in text2.split('\n\n') if p.strip()])
        
        # Compare sentence counts
        sentences1 = len([s for s in re.split(r'[.!?]+', text1) if s.strip()])
        sentences2 = len([s for s in re.split(r'[.!?]+', text2) if s.strip()])
        
        # Simple structural similarity measure
        para_similarity = 1 - abs(paragraphs1 - paragraphs2) / max(paragraphs1, paragraphs2, 1)
        sent_similarity = 1 - abs(sentences1 - sentences2) / max(sentences1, sentences2, 1)
        
        return (para_similarity + sent_similarity) / 2
    
    @classmethod
    def _generate_recommendations(cls, analysis: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on plagiarism analysis."""
        recommendations = []
        
        risk_level = analysis.get('risk_level', 'low')
        flags = analysis.get('flags', [])
        
        if risk_level == 'high':
            recommendations.extend([
                "Manual review strongly recommended - multiple plagiarism indicators detected",
                "Consider discussing academic integrity with the student",
                "Request original sources and citations for questionable content"
            ])
        elif risk_level == 'medium':
            recommendations.extend([
                "Manual review recommended - some suspicious patterns detected",
                "Verify that all sources are properly cited",
                "Check if suspicious content represents common knowledge or standard terminology"
            ])
        else:
            recommendations.append("Content appears original - standard review process recommended")
        
        # Specific recommendations based on flags
        flag_types = [flag.get('type') for flag in flags]
        
        if 'copy_indicator' in flag_types:
            recommendations.append("Remove or properly attribute content that appears to be copied from web sources")
        
        if 'suspicious_pattern' in flag_types:
            recommendations.append("Review flagged sections for potential copying or inadequate paraphrasing")
        
        if 'style_inconsistency' in flag_types:
            recommendations.append("Ensure consistent writing style throughout the submission")
        
        return recommendations[:4]  # Limit to most important recommendations
    
    @classmethod
    def generate_plagiarism_report(cls, submission_data: Dict[str, Any], analysis_results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a comprehensive plagiarism report."""
        return {
            'submission_info': {
                'id': submission_data.get('id'),
                'student_id': submission_data.get('student_id'),
                'assignment_id': submission_data.get('assignment_id'),
                'submitted_at': submission_data.get('submitted_at'),
                'word_count': len(submission_data.get('submission_text', '').split())
            },
            'analysis_summary': {
                'risk_level': analysis_results.get('risk_level'),
                'confidence': analysis_results.get('confidence'),
                'total_flags': len(analysis_results.get('flags', [])),
                'suspicious_segments': len(analysis_results.get('suspicious_segments', []))
            },
            'detailed_findings': analysis_results.get('flags', []),
            'suspicious_content': analysis_results.get('suspicious_segments', []),
            'recommendations': analysis_results.get('recommendations', []),
            'next_steps': cls._get_next_steps(analysis_results.get('risk_level', 'low')),
            'report_generated_at': datetime.utcnow().isoformat()
        }
    
    @classmethod
    def _get_next_steps(cls, risk_level: str) -> List[str]:
        """Get recommended next steps based on risk level."""
        if risk_level == 'high':
            return [
                "Schedule meeting with student to discuss findings",
                "Request original research notes and draft materials",
                "Consider academic integrity policy enforcement",
                "Document findings for academic records"
            ]
        elif risk_level == 'medium':
            return [
                "Review submission more carefully during grading",
                "Provide feedback on proper citation practices",
                "Monitor future submissions from this student",
                "Consider offering writing support resources"
            ]
        else:
            return [
                "Proceed with normal grading process",
                "Provide standard feedback on content and writing",
                "No additional action required"
            ]