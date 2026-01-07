"""
Enhanced modification request service for better workflow management
"""
import logging
from datetime import datetime, timedelta
from sqlalchemy import and_, or_, func, desc
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Dict, Optional, Tuple

from ..models import db
from ..models.user_models import User
from ..models.course_models import Assignment, Project, Course, AssignmentSubmission, ProjectSubmission
from ..models.student_models import LessonCompletion
from ..utils.email_notifications import send_modification_request_notification, send_resubmission_notification
from ..utils.db_utils import safe_db_session, DatabaseManager

logger = logging.getLogger(__name__)

class ModificationRequestService:
    """Service class for handling modification requests with enhanced features"""
    
    @staticmethod
    def get_assignment_modification_stats(instructor_id: int) -> Dict:
        """Get modification request statistics for an instructor"""
        try:
            # Get all assignments by instructor
            assignments = Assignment.query.join(Course).filter(
                Course.instructor_id == instructor_id
            ).all()
            
            assignment_ids = [a.id for a in assignments]
            
            if not assignment_ids:
                return {
                    'total_assignments': 0,
                    'assignments_with_modifications': 0,
                    'total_modification_requests': 0,
                    'pending_resubmissions': 0,
                    'completed_resubmissions': 0,
                    'average_resubmissions_per_assignment': 0,
                    'modification_rate': 0
                }
            
            # Count assignments with modifications
            assignments_with_mods = Assignment.query.filter(
                Assignment.id.in_(assignment_ids),
                Assignment.modification_requested == True
            ).count()
            
            # Count total modification requests (sum of resubmission counts)
            total_modifications = db.session.query(
                func.sum(Assignment.resubmission_count)
            ).filter(Assignment.id.in_(assignment_ids)).scalar() or 0
            
            # Count pending resubmissions
            pending = LessonCompletion.query.join(Assignment).filter(
                Assignment.id.in_(assignment_ids),
                LessonCompletion.assignment_needs_resubmission == True
            ).count()
            
            # Count completed resubmissions
            completed = total_modifications - pending
            
            stats = {
                'total_assignments': len(assignments),
                'assignments_with_modifications': assignments_with_mods,
                'total_modification_requests': total_modifications,
                'pending_resubmissions': pending,
                'completed_resubmissions': completed,
                'average_resubmissions_per_assignment': round(total_modifications / len(assignments), 2) if assignments else 0,
                'modification_rate': round((assignments_with_mods / len(assignments)) * 100, 1) if assignments else 0
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting modification stats: {e}")
            return {}
    
    @staticmethod
    def get_student_modification_history(student_id: int, course_id: Optional[int] = None) -> List[Dict]:
        """Get modification request history for a student"""
        try:
            # Base query for assignments with modifications
            query = db.session.query(
                Assignment,
                LessonCompletion,
                Course.title.label('course_title'),
                Course.instructor_id.label('instructor_id'),
                User.full_name.label('instructor_name')
            ).join(
                LessonCompletion, Assignment.lesson_id == LessonCompletion.lesson_id
            ).join(
                Course, Assignment.course_id == Course.id
            ).join(
                User, Course.instructor_id == User.id
            ).filter(
                LessonCompletion.student_id == student_id,
                Assignment.modification_requested == True
            )
            
            # Filter by course if specified
            if course_id:
                query = query.filter(Assignment.course_id == course_id)
            
            # Order by most recent first
            query = query.order_by(desc(Assignment.modification_requested_at))
            
            results = query.all()
            
            history = []
            for assignment, lesson_completion, course_title, instructor_id, instructor_name in results:
                history.append({
                    'assignment_id': assignment.id,
                    'assignment_title': assignment.title,
                    'course_title': course_title,
                    'instructor_name': instructor_name,
                    'modification_reason': assignment.modification_request_reason,
                    'requested_at': assignment.modification_requested_at.isoformat() if assignment.modification_requested_at else None,
                    'resubmission_count': assignment.resubmission_count or 0,
                    'max_resubmissions': assignment.max_resubmissions or 3,
                    'needs_resubmission': lesson_completion.assignment_needs_resubmission,
                    'status': 'pending' if lesson_completion.assignment_needs_resubmission else 'resubmitted'
                })
            
            return history
            
        except Exception as e:
            logger.error(f"Error getting student modification history: {e}")
            return []
    
    @staticmethod
    def bulk_request_modifications(assignment_ids: List[int], instructor_id: int, 
                                 student_modifications: List[Dict]) -> Dict:
        """
        Bulk request modifications for multiple students/assignments
        
        Args:
            assignment_ids: List of assignment IDs
            instructor_id: ID of instructor making requests
            student_modifications: List of dicts with 'student_id' and 'reason'
        
        Returns:
            Dict with success/failure counts and details
        """
        results = {
            'successful': 0,
            'failed': 0,
            'errors': [],
            'details': []
        }
        
        try:
            for assignment_id in assignment_ids:
                for student_mod in student_modifications:
                    try:
                        # Use the existing request modification logic
                        result = ModificationRequestService._request_single_modification(
                            assignment_id=assignment_id,
                            instructor_id=instructor_id,
                            student_id=student_mod['student_id'],
                            reason=student_mod['reason']
                        )
                        
                        if result['success']:
                            results['successful'] += 1
                            results['details'].append({
                                'assignment_id': assignment_id,
                                'student_id': student_mod['student_id'],
                                'status': 'success'
                            })
                        else:
                            results['failed'] += 1
                            results['errors'].append(result['error'])
                            results['details'].append({
                                'assignment_id': assignment_id,
                                'student_id': student_mod['student_id'],
                                'status': 'failed',
                                'error': result['error']
                            })
                    
                    except Exception as e:
                        results['failed'] += 1
                        error_msg = f"Assignment {assignment_id}, Student {student_mod['student_id']}: {str(e)}"
                        results['errors'].append(error_msg)
                        results['details'].append({
                            'assignment_id': assignment_id,
                            'student_id': student_mod['student_id'],
                            'status': 'failed',
                            'error': error_msg
                        })
            
            return results
            
        except Exception as e:
            logger.error(f"Error in bulk modification request: {e}")
            results['failed'] += len(assignment_ids) * len(student_modifications)
            results['errors'].append(f"Bulk operation failed: {str(e)}")
            return results
    
    @staticmethod
    def _request_single_modification(assignment_id: int, instructor_id: int, 
                                   student_id: int, reason: str) -> Dict:
        """Internal method to request modification for a single assignment"""
        try:
            with safe_db_session():
                # Get assignment and verify instructor ownership
                assignment = Assignment.query.filter_by(id=assignment_id).first()
                if not assignment:
                    return {'success': False, 'error': 'Assignment not found'}
                
                # Verify instructor has access
                course = Course.query.filter_by(id=assignment.course_id, instructor_id=instructor_id).first()
                if not course:
                    return {'success': False, 'error': 'Access denied'}
                
                # Get student
                student = User.query.filter_by(id=student_id).first()
                if not student:
                    return {'success': False, 'error': 'Student not found'}
                
                # Check for submission
                assignment_submission = AssignmentSubmission.query.filter_by(
                    assignment_id=assignment_id,
                    student_id=student_id
                ).first()
                
                if not assignment_submission:
                    return {'success': False, 'error': 'No submission found'}
                
                # Check resubmission limits
                max_resubmissions = getattr(assignment, 'max_resubmissions', 3)
                current_resubmissions = getattr(assignment, 'resubmission_count', 0)
                
                if current_resubmissions >= max_resubmissions:
                    return {'success': False, 'error': f'Maximum resubmissions ({max_resubmissions}) reached'}
                
                # Update assignment and related records
                assignment.modification_requested = True
                assignment.modification_request_reason = reason
                assignment.modification_requested_at = datetime.utcnow()
                assignment.modification_requested_by = instructor_id
                assignment.resubmission_count = (assignment.resubmission_count or 0) + 1
                
                # Update assignment submission
                assignment_submission.grade = None
                assignment_submission.graded_at = None
                assignment_submission.graded_by = None
                assignment_submission.feedback = f"Modification requested: {reason}"
                
                # Update lesson completion
                lesson_completion = LessonCompletion.query.filter_by(
                    lesson_id=assignment.lesson_id,
                    student_id=student_id
                ).first()
                
                if lesson_completion:
                    lesson_completion.assignment_graded = False
                    lesson_completion.assignment_needs_resubmission = True
                    lesson_completion.modification_request_reason = reason
                
                return {'success': True, 'assignment': assignment, 'student': student, 'course': course}
                
        except Exception as e:
            logger.error(f"Error in single modification request: {e}")
            return {'success': False, 'error': str(e)}
    
    @staticmethod
    def get_modification_trends(instructor_id: int, days: int = 30) -> Dict:
        """Get modification request trends over time"""
        try:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days)
            
            # Get assignments by instructor
            assignments = Assignment.query.join(Course).filter(
                Course.instructor_id == instructor_id
            ).all()
            
            assignment_ids = [a.id for a in assignments]
            
            if not assignment_ids:
                return {'trends': [], 'summary': {}}
            
            # Query modification requests over time
            trends_query = db.session.query(
                func.date(Assignment.modification_requested_at).label('date'),
                func.count(Assignment.id).label('count')
            ).filter(
                Assignment.id.in_(assignment_ids),
                Assignment.modification_requested_at >= start_date,
                Assignment.modification_requested_at <= end_date
            ).group_by(
                func.date(Assignment.modification_requested_at)
            ).order_by('date')
            
            trends = []
            for date, count in trends_query.all():
                trends.append({
                    'date': date.isoformat(),
                    'modification_requests': count
                })
            
            # Summary statistics
            total_requests = sum(trend['modification_requests'] for trend in trends)
            avg_per_day = round(total_requests / days, 2) if days > 0 else 0
            
            summary = {
                'total_requests': total_requests,
                'average_per_day': avg_per_day,
                'peak_day': max(trends, key=lambda x: x['modification_requests']) if trends else None
            }
            
            return {'trends': trends, 'summary': summary}
            
        except Exception as e:
            logger.error(f"Error getting modification trends: {e}")
            return {'trends': [], 'summary': {}}
    
    @staticmethod
    def auto_remind_pending_resubmissions(instructor_id: int, days_overdue: int = 7) -> Dict:
        """Send automatic reminders for pending resubmissions"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days_overdue)
            
            # Find overdue resubmissions
            overdue_query = db.session.query(
                Assignment,
                LessonCompletion,
                User,
                Course
            ).join(
                LessonCompletion, Assignment.lesson_id == LessonCompletion.lesson_id
            ).join(
                User, LessonCompletion.student_id == User.id
            ).join(
                Course, Assignment.course_id == Course.id
            ).filter(
                Course.instructor_id == instructor_id,
                Assignment.modification_requested == True,
                LessonCompletion.assignment_needs_resubmission == True,
                Assignment.modification_requested_at <= cutoff_date
            )
            
            reminders_sent = 0
            errors = []
            
            for assignment, lesson_completion, student, course in overdue_query.all():
                try:
                    # Send reminder email
                    instructor = User.query.get(instructor_id)
                    send_modification_request_notification(
                        student_email=student.email,
                        student_name=student.full_name,
                        assignment_title=assignment.title,
                        instructor_name=instructor.full_name,
                        reason=f"REMINDER: {assignment.modification_request_reason}",
                        course_title=course.title
                    )
                    reminders_sent += 1
                    
                except Exception as e:
                    error_msg = f"Failed to send reminder to {student.email}: {str(e)}"
                    errors.append(error_msg)
                    logger.error(error_msg)
            
            return {
                'reminders_sent': reminders_sent,
                'errors': errors,
                'success': reminders_sent > 0
            }
            
        except Exception as e:
            logger.error(f"Error sending automatic reminders: {e}")
            return {
                'reminders_sent': 0,
                'errors': [str(e)],
                'success': False
            }

class ModificationRequestValidator:
    """Validator for modification request operations"""
    
    @staticmethod
    def validate_modification_request(assignment_id: int, instructor_id: int, student_id: int, reason: str) -> Tuple[bool, str]:
        """Validate a modification request before processing"""
        try:
            # Check assignment exists
            assignment = Assignment.query.filter_by(id=assignment_id).first()
            if not assignment:
                return False, "Assignment not found"
            
            # Check instructor access
            course = Course.query.filter_by(id=assignment.course_id, instructor_id=instructor_id).first()
            if not course:
                return False, "Instructor does not have access to this assignment"
            
            # Check student exists
            student = User.query.filter_by(id=student_id).first()
            if not student:
                return False, "Student not found"
            
            # Check submission exists
            submission = AssignmentSubmission.query.filter_by(
                assignment_id=assignment_id,
                student_id=student_id
            ).first()
            if not submission:
                return False, "No submission found for this student"
            
            # Check resubmission limits
            max_resubmissions = getattr(assignment, 'max_resubmissions', 3)
            current_resubmissions = getattr(assignment, 'resubmission_count', 0)
            
            if current_resubmissions >= max_resubmissions:
                return False, f"Maximum resubmissions ({max_resubmissions}) reached"
            
            # Check reason is provided
            if not reason or not reason.strip():
                return False, "Modification reason is required"
            
            # Check reason length
            if len(reason.strip()) < 10:
                return False, "Modification reason must be at least 10 characters"
            
            return True, "Validation successful"
            
        except Exception as e:
            logger.error(f"Error validating modification request: {e}")
            return False, f"Validation error: {str(e)}"