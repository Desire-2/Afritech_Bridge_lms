# Enhanced Grading Routes - Advanced functionality for instructor grading
# Includes AI-powered suggestions, bulk operations, analytics, and workflow automation

from flask import Blueprint, request, jsonify, stream_template
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, and_, or_, desc, text, case
from datetime import datetime, timedelta
import logging
import json
import math
import statistics
import hashlib
from typing import List, Dict, Any, Optional, Tuple

from ..models.user_models import db, User, Role
from ..models.course_models import (
    Course, Module, Assignment, AssignmentSubmission, 
    Project, ProjectSubmission, Quiz, Submission, Enrollment, Lesson
)
from ..models.student_models import AssessmentAttempt, LessonCompletion, ModuleProgress
from ..utils.email_notifications import send_grade_notification, send_project_graded_notification
# from ..utils.ai_grading_helper import AIGradingHelper
# from ..utils.plagiarism_checker import PlagiarismChecker

logger = logging.getLogger(__name__)

# Helper for role checking
from functools import wraps

def instructor_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user or not user.role or user.role.name not in ['instructor', 'admin']:
            return jsonify({"message": "Instructor access required"}), 403
        return f(*args, **kwargs)
    return decorated_function

enhanced_grading_bp = Blueprint("enhanced_grading_bp", __name__, url_prefix="/api/v1/grading")

# =====================
# ENHANCED SUBMISSION RETRIEVAL
# =====================

@enhanced_grading_bp.route("/assignments/submissions/enhanced", methods=["GET"])
@instructor_required
def get_enhanced_assignment_submissions():
    """
    Get enhanced assignment submissions with AI insights, analytics, and suggestions.
    Supports advanced filtering, sorting, and performance optimization.
    """
    try:
        current_user_id = int(get_jwt_identity())
        
        # Enhanced filter parameters
        course_id = request.args.get('course_id', type=int)
        assignment_id = request.args.get('assignment_id', type=int)
        status = request.args.get('status', 'pending')
        student_id = request.args.get('student_id', type=int)
        search_query = request.args.get('search_query', '')
        priority = request.args.get('priority')  # low, medium, high
        sort_by = request.args.get('sort_by', 'submitted_at')
        sort_order = request.args.get('sort_order', 'desc')
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        
        # Date range filtering
        date_start = request.args.get('date_start')
        date_end = request.args.get('date_end')
        
        # Build enhanced query with optimized joins
        query = db.session.query(AssignmentSubmission).join(Assignment).join(Course)
        query = query.options(
            db.joinedload(AssignmentSubmission.assignment),
            db.joinedload(AssignmentSubmission.student)
        )
        
        # Filter by instructor's courses
        query = query.filter(Course.instructor_id == current_user_id)
        
        # Apply filters
        if course_id:
            query = query.filter(Assignment.course_id == course_id)
        if assignment_id:
            query = query.filter(AssignmentSubmission.assignment_id == assignment_id)
        if student_id:
            query = query.filter(AssignmentSubmission.student_id == student_id)
        
        # Status filtering with enhanced logic
        if status == 'pending':
            query = query.filter(AssignmentSubmission.grade.is_(None))
        elif status == 'graded':
            query = query.filter(AssignmentSubmission.grade.isnot(None))
        elif status == 'overdue':
            query = query.filter(
                and_(
                    Assignment.due_date < datetime.utcnow(),
                    AssignmentSubmission.grade.is_(None)
                )
            )
        
        # Search functionality
        if search_query:
            search_filter = or_(
                User.first_name.ilike(f'%{search_query}%'),
                User.last_name.ilike(f'%{search_query}%'),
                User.email.ilike(f'%{search_query}%'),
                Assignment.title.ilike(f'%{search_query}%'),
                AssignmentSubmission.submission_text.ilike(f'%{search_query}%')
            )
            query = query.join(User, User.id == AssignmentSubmission.student_id)
            query = query.filter(search_filter)
        
        # Date range filtering
        if date_start:
            query = query.filter(AssignmentSubmission.submitted_at >= datetime.fromisoformat(date_start))
        if date_end:
            query = query.filter(AssignmentSubmission.submitted_at <= datetime.fromisoformat(date_end))
        
        # Calculate priority scores for sorting
        priority_score = case(
            [
                (and_(Assignment.due_date < datetime.utcnow(), AssignmentSubmission.grade.is_(None)), 3),  # Overdue
                (Assignment.due_date < datetime.utcnow() + timedelta(days=1), 2),  # Due soon
            ],
            else_=1
        )
        
        # Enhanced sorting options
        sort_mapping = {
            'submitted_at': AssignmentSubmission.submitted_at,
            'due_date': Assignment.due_date,
            'student_name': User.last_name,
            'grade': AssignmentSubmission.grade,
            'priority': priority_score,
            'days_late': func.greatest(0, func.date_part('day', AssignmentSubmission.submitted_at - Assignment.due_date))
        }
        
        if sort_by in sort_mapping:
            sort_column = sort_mapping[sort_by]
            if sort_order == 'desc':
                query = query.order_by(desc(sort_column))
            else:
                query = query.order_by(sort_column)
        
        # Secondary sort by priority for consistent ordering
        query = query.order_by(desc(priority_score), desc(AssignmentSubmission.submitted_at))
        
        # Pagination
        total_count = query.count()
        submissions = query.offset((page - 1) * per_page).limit(per_page).all()
        
        # Enhanced submission data with AI insights
        enhanced_submissions = []
        for submission in submissions:
            # Calculate enhanced metrics
            word_count = len(submission.submission_text.split()) if submission.submission_text else 0
            reading_time = max(1, word_count // 200)  # Assume 200 words per minute
            
            # Calculate days late with precision
            days_late = 0
            if submission.assignment.due_date and submission.submitted_at:
                time_diff = submission.submitted_at - submission.assignment.due_date
                days_late = max(0, time_diff.days + (time_diff.seconds / 86400))
            
            # Priority calculation
            priority_level = 'low'
            if days_late > 0:
                priority_level = 'high'
            elif submission.assignment.due_date and submission.assignment.due_date < datetime.utcnow() + timedelta(days=1):
                priority_level = 'medium'
            
            # Estimated grading time
            estimated_time = 10  # Base time
            if word_count > 500:
                estimated_time += (word_count // 500) * 2
            if submission.file_path:
                estimated_time += 5
            if submission.external_url:
                estimated_time += 3
            
            # Complexity score (1-10)
            complexity_score = min(10, max(1, (
                (word_count // 100) + 
                (3 if submission.file_path else 0) +
                (2 if submission.external_url else 0) +
                (days_late * 0.5)
            )))
            
            enhanced_data = {
                'id': submission.id,
                'assignment_id': submission.assignment_id,
                'assignment_title': submission.assignment.title,
                'assignment_description': submission.assignment.description,
                'assignment_points': submission.assignment.points_possible or 100,
                'course_id': submission.assignment.course_id,
                'course_title': submission.assignment.course.title,
                'student_id': submission.student_id,
                'student_name': f"{submission.student.first_name} {submission.student.last_name}",
                'student_email': submission.student.email,
                'submitted_at': submission.submitted_at.isoformat(),
                'submission_text': submission.submission_text,
                'file_path': submission.file_path,
                'file_name': submission.file_name,
                'external_url': submission.external_url,
                'due_date': submission.assignment.due_date.isoformat() if submission.assignment.due_date else None,
                'days_late': round(days_late, 2),
                'grade': submission.grade,
                'percentage': round((submission.grade / (submission.assignment.points_possible or 100)) * 100, 2) if submission.grade else None,
                'feedback': submission.feedback,
                'graded_at': submission.graded_at.isoformat() if submission.graded_at else None,
                'graded_by': submission.graded_by,
                
                # Enhanced metrics
                'word_count': word_count,
                'reading_time': reading_time,
                'priority_level': priority_level,
                'estimated_grading_time': estimated_time,
                'complexity_score': complexity_score,
                'attempt_number': 1,  # TODO: Calculate actual attempt number
                'previous_attempts': 0,  # TODO: Count previous attempts
            }
            
            enhanced_submissions.append(enhanced_data)
        
        # Generate analytics
        analytics = generate_grading_analytics(submissions, current_user_id, course_id)
        
        # Generate AI suggestions for top priority items
        suggestions = []
        high_priority_submissions = [s for s in enhanced_submissions if s['priority_level'] == 'high'][:3]
        for sub in high_priority_submissions:
            try:
                suggestion = generate_ai_grading_suggestion(sub)
                suggestions.append(suggestion)
            except Exception as e:
                logger.warning(f"Failed to generate AI suggestion for submission {sub['id']}: {str(e)}")
        
        return jsonify({
            'submissions': enhanced_submissions,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total_count,
                'pages': math.ceil(total_count / per_page)
            },
            'analytics': analytics,
            'suggestions': suggestions
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error in enhanced assignment submissions: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to retrieve submissions", "error": str(e)}), 500

# =====================
# AI-POWERED GRADING SUGGESTIONS
# =====================

@enhanced_grading_bp.route("/assignments/submissions/<int:submission_id>/ai-suggestions", methods=["GET"])
@instructor_required
def get_ai_grading_suggestions(submission_id):
    """
    Get AI-powered grading suggestions for a specific submission.
    """
    try:
        current_user_id = int(get_jwt_identity())
        
        submission = AssignmentSubmission.query.get(submission_id)
        if not submission:
            return jsonify({"message": "Submission not found"}), 404
        
        # Verify instructor owns the course
        if submission.assignment.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        # Get suggestion parameters
        include_similar = request.args.get('include_similar', 'true').lower() == 'true'
        confidence_threshold = request.args.get('confidence_threshold', 0.7, type=float)
        explanation_detail = request.args.get('explanation_detail', 'detailed')
        
        # Generate comprehensive AI suggestion
        suggestion = generate_comprehensive_ai_suggestion(
            submission, 
            include_similar, 
            confidence_threshold, 
            explanation_detail
        )
        
        return jsonify({
            'suggestion': suggestion
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error generating AI suggestions: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to generate suggestions", "error": str(e)}), 500

@enhanced_grading_bp.route("/assignments/submissions/<int:submission_id>/ai-feedback", methods=["POST"])
@instructor_required
def generate_ai_feedback(submission_id):
    """
    Generate AI-powered feedback for a submission.
    """
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        submission = AssignmentSubmission.query.get(submission_id)
        if not submission:
            return jsonify({"message": "Submission not found"}), 404
        
        # Verify instructor owns the course
        if submission.assignment.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        # Generate AI feedback
        tone = data.get('tone', 'constructive')
        focus_areas = data.get('focus_areas', [])
        include_suggestions = data.get('include_suggestions', True)
        personalization_level = data.get('personalization_level', 'medium')
        
        feedback_result = generate_ai_feedback_content(
            submission, tone, focus_areas, include_suggestions, personalization_level
        )
        
        return jsonify(feedback_result), 200
        
    except Exception as e:
        logger.error(f"❌ Error generating AI feedback: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to generate feedback", "error": str(e)}), 500

# =====================
# BULK OPERATIONS
# =====================

@enhanced_grading_bp.route("/assignments/submissions/bulk-grade-enhanced", methods=["POST"])
@instructor_required
def bulk_grade_enhanced():
    """
    Enhanced bulk grading with curve application, validation, and analytics.
    """
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        submissions_data = data.get('submissions', [])
        apply_curve = data.get('apply_curve')
        late_penalty_policy = data.get('late_penalty_policy')
        
        if not submissions_data:
            return jsonify({"message": "No submissions provided"}), 400
        
        graded_count = 0
        errors = []
        graded_submissions = []
        
        # Process each submission
        for item in submissions_data:
            try:
                submission_id = item.get('id')
                grade = item.get('grade')
                feedback = item.get('feedback', '')
                rubric_scores = item.get('rubric_scores', {})
                tags = item.get('tags', [])
                
                if submission_id is None or grade is None:
                    errors.append(f"Submission {submission_id}: Missing grade or id")
                    continue
                
                submission = AssignmentSubmission.query.get(submission_id)
                if not submission:
                    errors.append(f"Submission {submission_id}: Not found")
                    continue
                
                # Verify instructor owns the course
                if submission.assignment.course.instructor_id != current_user_id:
                    errors.append(f"Submission {submission_id}: Access denied")
                    continue
                
                # Apply late penalty if policy specified
                original_grade = float(grade)
                final_grade = original_grade
                
                if late_penalty_policy and submission.assignment.due_date:
                    days_late = max(0, (submission.submitted_at - submission.assignment.due_date).days)
                    grace_period = late_penalty_policy.get('grace_period_days', 0)
                    
                    if days_late > grace_period:
                        penalty_days = days_late - grace_period
                        per_day_penalty = late_penalty_policy.get('per_day_penalty', 5)
                        max_penalty = late_penalty_policy.get('max_penalty', 50)
                        
                        total_penalty = min(penalty_days * per_day_penalty, max_penalty)
                        final_grade = max(0, original_grade - total_penalty)
                
                # Update submission
                submission.grade = final_grade
                submission.feedback = feedback
                submission.graded_at = datetime.utcnow()
                submission.graded_by = current_user_id
                
                # Store rubric scores if provided
                if rubric_scores:
                    submission.rubric_scores = json.dumps(rubric_scores)
                
                # Update lesson completion and module progress
                update_learning_progress(submission, final_grade)
                
                graded_submissions.append({
                    'id': submission.id,
                    'original_grade': original_grade,
                    'final_grade': final_grade,
                    'penalty_applied': original_grade - final_grade if original_grade != final_grade else 0
                })
                
                graded_count += 1
                
            except Exception as e:
                errors.append(f"Submission {submission_id}: {str(e)}")
                continue
        
        # Apply grading curve if specified
        if apply_curve and graded_submissions:
            try:
                apply_grading_curve_to_submissions(graded_submissions, apply_curve)
            except Exception as e:
                logger.warning(f"Failed to apply grading curve: {str(e)}")
        
        # Commit changes
        db.session.commit()
        
        # Send notifications (async in production)
        for submission_data in graded_submissions:
            try:
                submission = AssignmentSubmission.query.get(submission_data['id'])
                send_grade_notification(
                    submission.student.email,
                    submission.assignment.title,
                    submission_data['final_grade'],
                    submission.feedback or "Your assignment has been graded."
                )
            except Exception as e:
                logger.warning(f"Failed to send notification for submission {submission_data['id']}: {str(e)}")
        
        return jsonify({
            'success_count': graded_count,
            'error_count': len(errors),
            'errors': errors,
            'graded_submissions': graded_submissions
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"❌ Error in enhanced bulk grading: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to bulk grade assignments", "error": str(e)}), 500

@enhanced_grading_bp.route("/curve/apply", methods=["POST"])
@instructor_required
def apply_grading_curve():
    """
    Apply grading curve to selected submissions.
    """
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        submission_ids = data.get('submission_ids', [])
        curve_config = data.get('curve_config', {})
        
        if not submission_ids:
            return jsonify({"message": "No submissions provided"}), 400
        
        # Get submissions
        submissions = AssignmentSubmission.query.filter(
            AssignmentSubmission.id.in_(submission_ids)
        ).all()
        
        # Verify instructor access
        for submission in submissions:
            if submission.assignment.course.instructor_id != current_user_id:
                return jsonify({"message": "Access denied"}), 403
        
        # Store original grades
        original_grades = [{'id': s.id, 'grade': s.grade} for s in submissions]
        
        # Apply curve
        adjusted_grades = apply_curve_algorithm(submissions, curve_config)
        
        # Update submissions
        for submission, new_grade in zip(submissions, adjusted_grades):
            submission.grade = new_grade
            submission.graded_at = datetime.utcnow()
            submission.graded_by = current_user_id
        
        db.session.commit()
        
        return jsonify({
            'original_grades': original_grades,
            'adjusted_grades': [{'id': s.id, 'grade': s.grade} for s in submissions],
            'curve_applied': curve_config
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"❌ Error applying grading curve: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to apply curve", "error": str(e)}), 500

# =====================
# RUBRIC-BASED GRADING
# =====================

@enhanced_grading_bp.route("/assignments/submissions/<int:submission_id>/grade-rubric", methods=["POST"])
@instructor_required
def grade_with_rubric(submission_id):
    """
    Grade a submission using rubric criteria.
    """
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        submission = AssignmentSubmission.query.get(submission_id)
        if not submission:
            return jsonify({"message": "Submission not found"}), 404
        
        # Verify instructor owns the course
        if submission.assignment.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        rubric_scores = data.get('rubric_scores', {})
        feedback = data.get('feedback', '')
        private_notes = data.get('private_notes', '')
        
        # Calculate total score from rubric
        total_score = sum(rubric_scores.values())
        
        # Update submission
        submission.grade = total_score
        submission.feedback = feedback
        submission.rubric_scores = json.dumps(rubric_scores)
        submission.graded_at = datetime.utcnow()
        submission.graded_by = current_user_id
        
        # Store private notes (instructor only)
        if private_notes:
            submission.private_notes = private_notes
        
        # Update learning progress
        update_learning_progress(submission, total_score)
        
        db.session.commit()
        
        # Generate rubric breakdown
        rubric_breakdown = generate_rubric_breakdown(rubric_scores)
        
        return jsonify({
            'submission': serialize_submission(submission),
            'total_score': total_score,
            'rubric_breakdown': rubric_breakdown
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"❌ Error grading with rubric: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to grade with rubric", "error": str(e)}), 500

# =====================
# ANALYTICS & INSIGHTS
# =====================

@enhanced_grading_bp.route("/analytics/comprehensive", methods=["GET"])
@instructor_required
def get_comprehensive_analytics():
    """
    Get comprehensive grading analytics with insights and predictions.
    """
    try:
        current_user_id = int(get_jwt_identity())
        
        course_id = request.args.get('course_id', type=int)
        assignment_id = request.args.get('assignment_id', type=int)
        include_predictions = request.args.get('include_predictions', 'false').lower() == 'true'
        
        # Date range
        date_start = request.args.get('date_start')
        date_end = request.args.get('date_end')
        
        if not date_end:
            date_end = datetime.utcnow()
        else:
            date_end = datetime.fromisoformat(date_end)
        
        if not date_start:
            date_start = date_end - timedelta(days=30)
        else:
            date_start = datetime.fromisoformat(date_start)
        
        # Get instructor's courses
        courses_query = Course.query.filter_by(instructor_id=current_user_id)
        if course_id:
            courses_query = courses_query.filter_by(id=course_id)
        
        course_ids = [c.id for c in courses_query.all()]
        
        # Build submissions query
        submissions_query = db.session.query(AssignmentSubmission).join(Assignment).filter(
            Assignment.course_id.in_(course_ids),
            AssignmentSubmission.submitted_at.between(date_start, date_end)
        )
        
        if assignment_id:
            submissions_query = submissions_query.filter(AssignmentSubmission.assignment_id == assignment_id)
        
        submissions = submissions_query.all()
        
        # Generate comprehensive analytics
        analytics = generate_comprehensive_analytics(submissions, course_ids, include_predictions)
        
        return jsonify(analytics), 200
        
    except Exception as e:
        logger.error(f"❌ Error generating comprehensive analytics: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to generate analytics", "error": str(e)}), 500

# =====================
# FEEDBACK TEMPLATES
# =====================

@enhanced_grading_bp.route("/feedback/templates", methods=["GET"])
@instructor_required
def get_feedback_templates():
    """
    Get personalized feedback templates based on context.
    """
    try:
        assignment_type = request.args.get('assignment_type')
        grade_min = request.args.get('grade_min', type=float)
        grade_max = request.args.get('grade_max', type=float)
        performance_history = request.args.get('student_performance_history')
        
        # Generate contextual templates
        templates = generate_feedback_templates(assignment_type, grade_min, grade_max, performance_history)
        
        return jsonify({'templates': templates}), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting feedback templates: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to get templates", "error": str(e)}), 500

# =====================
# HELPER FUNCTIONS
# =====================

def generate_grading_analytics(submissions: List[AssignmentSubmission], instructor_id: int, course_id: Optional[int] = None) -> Dict[str, Any]:
    """Generate basic grading analytics for submissions."""
    if not submissions:
        return {
            'summary': {
                'total_pending': 0,
                'total_graded': 0,
                'average_grade': 0,
                'completion_rate': 0
            }
        }
    
    graded = [s for s in submissions if s.grade is not None]
    pending = [s for s in submissions if s.grade is None]
    
    average_grade = statistics.mean([s.grade for s in graded]) if graded else 0
    
    return {
        'summary': {
            'total_pending': len(pending),
            'total_graded': len(graded),
            'average_grade': round(average_grade, 2),
            'completion_rate': round((len(graded) / len(submissions)) * 100, 2) if submissions else 0
        }
    }

def generate_ai_grading_suggestion(submission_data: Dict[str, Any]) -> Dict[str, Any]:
    """Generate AI-powered grading suggestion for a submission."""
    # Simplified AI suggestion logic
    word_count = submission_data.get('word_count', 0)
    complexity = submission_data.get('complexity_score', 1)
    days_late = submission_data.get('days_late', 0)
    
    # Basic scoring algorithm
    base_score = 85  # Default good score
    
    # Adjust based on word count
    if word_count < 100:
        base_score -= 20
    elif word_count > 1000:
        base_score += 5
    
    # Adjust for complexity
    base_score += (complexity - 5) * 2
    
    # Late penalty
    if days_late > 0:
        base_score -= min(days_late * 5, 30)
    
    suggested_grade = max(0, min(100, base_score))
    
    return {
        'submission_id': submission_data['id'],
        'suggested_grade': round(suggested_grade, 1),
        'confidence_score': 0.75,
        'reasoning': f"Based on word count ({word_count}), complexity score ({complexity}), and submission timing.",
        'factors': [
            {'factor': 'Word Count', 'weight': 0.3, 'value': word_count, 'impact': 'positive' if word_count >= 300 else 'negative'},
            {'factor': 'Complexity', 'weight': 0.4, 'value': complexity, 'impact': 'positive' if complexity >= 5 else 'neutral'},
            {'factor': 'Timeliness', 'weight': 0.3, 'value': days_late, 'impact': 'negative' if days_late > 0 else 'positive'}
        ]
    }

def generate_comprehensive_ai_suggestion(submission: AssignmentSubmission, include_similar: bool, confidence_threshold: float, explanation_detail: str) -> Dict[str, Any]:
    """Generate comprehensive AI suggestion with detailed analysis."""
    # This would integrate with actual AI services in production
    # For now, provide a structured response
    
    word_count = len(submission.submission_text.split()) if submission.submission_text else 0
    has_file = bool(submission.file_path)
    has_url = bool(submission.external_url)
    
    # Calculate suggestion
    suggestion = generate_ai_grading_suggestion({
        'id': submission.id,
        'word_count': word_count,
        'complexity_score': 5 + (2 if has_file else 0) + (1 if has_url else 0),
        'days_late': max(0, (submission.submitted_at - submission.assignment.due_date).days) if submission.assignment.due_date else 0
    })
    
    # Add detailed analysis
    suggestion.update({
        'improvement_areas': [
            "Consider providing more specific examples" if word_count < 500 else "Well-developed response",
            "Include references to course materials",
            "Proofread for clarity and grammar"
        ],
        'strengths': [
            "Submitted on time" if suggestion['factors'][2]['impact'] == 'positive' else "Addresses assignment requirements",
            "Good effort demonstrated",
            "Shows understanding of key concepts"
        ]
    })
    
    return suggestion

def generate_ai_feedback_content(submission: AssignmentSubmission, tone: str, focus_areas: List[str], include_suggestions: bool, personalization_level: str) -> Dict[str, Any]:
    """Generate AI-powered feedback content."""
    # This would integrate with actual AI services in production
    
    feedback_templates = {
        'encouraging': "Great work on this assignment! Your effort shows through in your response.",
        'constructive': "This submission demonstrates good understanding with room for improvement.",
        'detailed': "Your response shows thorough engagement with the assignment requirements.",
        'brief': "Good work. See specific comments below."
    }
    
    base_feedback = feedback_templates.get(tone, feedback_templates['constructive'])
    
    highlights = [
        "Clear writing style",
        "Good use of examples",
        "Demonstrates understanding"
    ]
    
    improvement_areas = [
        "Expand on key points",
        "Include more specific details",
        "Consider alternative perspectives"
    ]
    
    next_steps = [
        "Review instructor feedback",
        "Apply suggestions to future assignments",
        "Reach out during office hours if questions"
    ]
    
    return {
        'feedback': base_feedback,
        'highlights': highlights,
        'improvement_areas': improvement_areas,
        'next_steps': next_steps,
        'confidence_score': 0.8
    }

def update_learning_progress(submission: AssignmentSubmission, grade: float):
    """Update lesson completion and module progress based on graded assignment."""
    try:
        assignment = submission.assignment
        student_id = submission.student_id
        percentage_score = (grade / (assignment.points_possible or 100)) * 100
        
        # Update lesson completion if assignment is tied to a lesson
        if hasattr(assignment, 'lesson_id') and assignment.lesson_id:
            lesson_completion = LessonCompletion.query.filter_by(
                student_id=student_id,
                lesson_id=assignment.lesson_id
            ).first()
            
            if not lesson_completion:
                lesson_completion = LessonCompletion(
                    student_id=student_id,
                    lesson_id=assignment.lesson_id,
                    completed=True,
                    reading_progress=min(100.0, max(70.0, 70.0 + (percentage_score * 0.3))),
                    engagement_score=min(100.0, max(60.0, 60.0 + (percentage_score * 0.4))),
                    scroll_progress=min(100.0, max(70.0, 70.0 + (percentage_score * 0.3))),
                    time_spent=300,
                    completed_at=datetime.utcnow()
                )
                db.session.add(lesson_completion)
            else:
                # Update with better scores if grade improved
                lesson_completion.reading_progress = max(lesson_completion.reading_progress or 0, min(100.0, 70.0 + (percentage_score * 0.3)))
                lesson_completion.engagement_score = max(lesson_completion.engagement_score or 0, min(100.0, 60.0 + (percentage_score * 0.4)))
        
        # Update module progress
        if hasattr(assignment, 'module_id') and assignment.module_id:
            enrollment = Enrollment.query.filter_by(
                student_id=student_id,
                course_id=assignment.course_id
            ).first()
            
            if enrollment:
                module_progress = ModuleProgress.query.filter_by(
                    student_id=student_id,
                    module_id=assignment.module_id,
                    enrollment_id=enrollment.id
                ).first()
                
                if module_progress:
                    # Keep the best assignment score
                    current_score = module_progress.assignment_score or 0.0
                    module_progress.assignment_score = max(current_score, percentage_score)
                    
                    # Recalculate cumulative score
                    module_progress.calculate_cumulative_score()
                    
    except Exception as e:
        logger.warning(f"Error updating learning progress: {str(e)}")

def apply_curve_algorithm(submissions: List[AssignmentSubmission], curve_config: Dict[str, Any]) -> List[float]:
    """Apply grading curve algorithm to submissions."""
    curve_type = curve_config.get('type', 'linear')
    target_average = curve_config.get('target_average', 80)
    minimum_grade = curve_config.get('minimum_grade', 0)
    maximum_grade = curve_config.get('maximum_grade', 100)
    
    grades = [s.grade for s in submissions if s.grade is not None]
    if not grades:
        return []
    
    current_average = statistics.mean(grades)
    
    if curve_type == 'linear':
        # Linear curve: add/subtract same amount to all grades
        adjustment = target_average - current_average
        adjusted = [max(minimum_grade, min(maximum_grade, grade + adjustment)) for grade in grades]
    
    elif curve_type == 'bell':
        # Bell curve: normalize to target distribution
        mean = statistics.mean(grades)
        stdev = statistics.stdev(grades) if len(grades) > 1 else 1
        target_stdev = curve_config.get('target_stdev', 15)
        
        adjusted = []
        for grade in grades:
            z_score = (grade - mean) / stdev if stdev > 0 else 0
            new_grade = target_average + (z_score * target_stdev)
            adjusted.append(max(minimum_grade, min(maximum_grade, new_grade)))
    
    else:  # square_root curve
        # Square root curve: helps lower grades more
        max_original = max(grades)
        adjusted = []
        for grade in grades:
            normalized = grade / max_original
            curved = math.sqrt(normalized)
            new_grade = curved * maximum_grade
            adjusted.append(max(minimum_grade, min(maximum_grade, new_grade)))
    
    return adjusted

def generate_comprehensive_analytics(submissions: List[AssignmentSubmission], course_ids: List[int], include_predictions: bool) -> Dict[str, Any]:
    """Generate comprehensive analytics with insights and trends."""
    if not submissions:
        return {'summary': {}, 'distribution': {}, 'trends': {}, 'insights': {}}
    
    graded = [s for s in submissions if s.grade is not None]
    pending = [s for s in submissions if s.grade is None]
    
    # Basic summary
    summary = {
        'total_pending': len(pending),
        'total_graded': len(graded),
        'average_grade': round(statistics.mean([s.grade for s in graded]), 2) if graded else 0,
        'median_grade': round(statistics.median([s.grade for s in graded]), 2) if graded else 0,
        'completion_rate': round((len(graded) / len(submissions)) * 100, 2) if submissions else 0
    }
    
    # Grade distribution
    grade_ranges = [
        {'range': 'A (90-100)', 'count': 0, 'percentage': 0},
        {'range': 'B (80-89)', 'count': 0, 'percentage': 0},
        {'range': 'C (70-79)', 'count': 0, 'percentage': 0},
        {'range': 'D (60-69)', 'count': 0, 'percentage': 0},
        {'range': 'F (0-59)', 'count': 0, 'percentage': 0}
    ]
    
    for submission in graded:
        grade = submission.grade
        if grade >= 90:
            grade_ranges[0]['count'] += 1
        elif grade >= 80:
            grade_ranges[1]['count'] += 1
        elif grade >= 70:
            grade_ranges[2]['count'] += 1
        elif grade >= 60:
            grade_ranges[3]['count'] += 1
        else:
            grade_ranges[4]['count'] += 1
    
    # Calculate percentages
    total_graded = len(graded)
    for range_data in grade_ranges:
        range_data['percentage'] = round((range_data['count'] / total_graded) * 100, 1) if total_graded > 0 else 0
    
    # Generate insights
    insights = generate_grading_insights(submissions, graded, pending)
    
    return {
        'summary': summary,
        'distribution': {'grade_ranges': grade_ranges},
        'trends': {'daily_grading': [], 'student_performance': []},  # TODO: Implement
        'insights': insights
    }

def generate_grading_insights(submissions: List[AssignmentSubmission], graded: List[AssignmentSubmission], pending: List[AssignmentSubmission]) -> Dict[str, Any]:
    """Generate actionable insights from grading data."""
    suggested_actions = []
    outliers = []
    
    # Check for overdue items
    overdue_count = len([s for s in pending if s.assignment.due_date and s.assignment.due_date < datetime.utcnow()])
    if overdue_count > 0:
        suggested_actions.append(f"You have {overdue_count} overdue submissions to grade")
    
    # Check grade distribution
    if graded:
        avg_grade = statistics.mean([s.grade for s in graded])
        if avg_grade < 70:
            suggested_actions.append("Consider reviewing assignment difficulty or providing additional support")
        elif avg_grade > 95:
            suggested_actions.append("Consider increasing assignment challenge level")
    
    # Efficiency metrics
    efficiency = {
        'average_time_per_submission': 15,  # TODO: Calculate actual time
        'fastest_graded': 5,
        'slowest_graded': 30,
        'efficiency_score': 85
    }
    
    return {
        'suggested_actions': suggested_actions,
        'outliers': outliers,
        'grading_efficiency': efficiency
    }

def generate_feedback_templates(assignment_type: Optional[str], grade_min: Optional[float], grade_max: Optional[float], performance_history: Optional[str]) -> List[Dict[str, Any]]:
    """Generate contextual feedback templates."""
    templates = [
        {
            'id': 1,
            'name': 'Excellent Work',
            'content': 'Excellent work! Your response demonstrates a deep understanding of the concepts and shows creative thinking. Keep up the outstanding effort.',
            'category': 'excellent',
            'grade_range': {'min': 90, 'max': 100}
        },
        {
            'id': 2,
            'name': 'Good Job',
            'content': 'Good job on this assignment. You show a solid understanding of the material. Consider expanding on a few points for even stronger responses.',
            'category': 'positive',
            'grade_range': {'min': 80, 'max': 89}
        },
        {
            'id': 3,
            'name': 'Needs Improvement',
            'content': 'This assignment shows effort, but there are areas that need improvement. Please see my specific comments and consider revising your approach.',
            'category': 'needs_improvement',
            'grade_range': {'min': 60, 'max': 79}
        },
        {
            'id': 4,
            'name': 'Revision Required',
            'content': 'This submission needs significant revision. Please review the assignment requirements and my feedback, then resubmit for a better grade.',
            'category': 'revision_required',
            'grade_range': {'min': 0, 'max': 59}
        }
    ]
    
    # Filter templates based on grade range if provided
    if grade_min is not None and grade_max is not None:
        filtered_templates = []
        for template in templates:
            range_min = template['grade_range']['min']
            range_max = template['grade_range']['max']
            if not (grade_max < range_min or grade_min > range_max):  # Ranges overlap
                filtered_templates.append(template)
        return filtered_templates
    
    return templates

def serialize_submission(submission: AssignmentSubmission) -> Dict[str, Any]:
    """Serialize submission for JSON response."""
    return {
        'id': submission.id,
        'assignment_title': submission.assignment.title,
        'student_name': f"{submission.student.first_name} {submission.student.last_name}",
        'grade': submission.grade,
        'feedback': submission.feedback,
        'submitted_at': submission.submitted_at.isoformat(),
        'graded_at': submission.graded_at.isoformat() if submission.graded_at else None
    }

def generate_rubric_breakdown(rubric_scores: Dict[str, float]) -> Dict[str, Any]:
    """Generate rubric breakdown from scores."""
    total_score = sum(rubric_scores.values())
    breakdown = {
        'total_score': total_score,
        'criteria_scores': rubric_scores,
        'percentage': round((total_score / max(1, len(rubric_scores) * 10)) * 100, 2)  # Assuming 10 points per criterion
    }
    return breakdown