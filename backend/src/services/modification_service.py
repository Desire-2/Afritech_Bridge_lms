from ..utils.time_utils import now_local
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
from .grading_feedback import (
    aage_grade_data,
    assignment_revision_state,
    build_student_feedback,
    is_generic_reason,
    request_assignment_modification,
    resolve_modification_reason,
)
from .notification_service import notify_modification_requested

logger = logging.getLogger(__name__)


def _project_revision_rows(
    *,
    student_id: Optional[int] = None,
    instructor_id: Optional[int] = None,
    course_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    pending_only: bool = False,
):
    """Project revision rows, including legacy project-level flags."""
    query = db.session.query(
        ProjectSubmission,
        Project,
        Course.title.label('course_title'),
        User,
    ).join(
        Project, ProjectSubmission.project_id == Project.id
    ).join(
        Course, Project.course_id == Course.id
    ).join(
        User, Course.instructor_id == User.id
    ).filter(
        or_(
            ProjectSubmission.modification_requested.is_(True),
            # A legacy row has no per-submission count but inherits the old
            # shared project flag.
            and_(
                func.coalesce(ProjectSubmission.resubmission_count, 0) == 0,
                Project.modification_requested.is_(True),
            ),
        )
    )
    if student_id is not None:
        query = query.filter(ProjectSubmission.student_id == student_id)
    if instructor_id is not None:
        query = query.filter(Course.instructor_id == instructor_id)
    if course_id is not None:
        query = query.filter(Project.course_id == course_id)
    if start_date is not None:
        started = func.coalesce(
            ProjectSubmission.modification_requested_at,
            Project.modification_requested_at,
        )
        query = query.filter(started >= start_date)
    if end_date is not None:
        ended = func.coalesce(
            ProjectSubmission.modification_requested_at,
            Project.modification_requested_at,
        )
        query = query.filter(ended <= end_date)
    if pending_only:
        query = query.filter(ProjectSubmission.can_resubmit.is_(True))
    return [
        (submission, project, course_title, instructor.full_name if instructor else None)
        for submission, project, course_title, instructor in query.all()
    ]


def _project_revision_state(submission: ProjectSubmission, project: Project) -> Dict:
    state = submission.modification_state()
    if not state['modification_requested'] and project.modification_requested:
        state['modification_requested'] = True
        state['can_resubmit'] = bool(state['can_resubmit'] or project.can_resubmit)
        state['modification_request_reason'] = (
            state['modification_request_reason']
            or project.modification_request_reason
        )
        state['modification_requested_at'] = (
            state['modification_requested_at'] or project.modification_requested_at
        )
        state['modification_requested_by'] = (
            state['modification_requested_by'] or project.modification_requested_by
        )
    return state


class ModificationRequestService:
    """Service class for handling modification requests with enhanced features"""
    
    @staticmethod
    def get_assignment_modification_stats(instructor_id: int) -> Dict:
        """Get modification request statistics for an instructor.

        Returns both assignment and project metrics; the legacy keys remain
        aggregate totals so existing dashboards keep working.
        """
        try:
            assignments = Assignment.query.join(Course).filter(
                Course.instructor_id == instructor_id
            ).all()
            assignment_ids = [a.id for a in assignments]

            assignments_with_mods = 0
            assignment_requests = 0
            assignment_pending = 0
            if assignment_ids:
                assignments_with_mods = Assignment.query.filter(
                    Assignment.id.in_(assignment_ids),
                    Assignment.modification_requested.is_(True),
                ).count()
                assignment_requests = (
                    db.session.query(func.sum(AssignmentSubmission.resubmission_count))
                    .filter(AssignmentSubmission.assignment_id.in_(assignment_ids))
                    .scalar() or 0
                )
                assignment_pending = db.session.query(LessonCompletion).join(
                    Assignment, LessonCompletion.lesson_id == Assignment.lesson_id,
                ).filter(
                    Assignment.id.in_(assignment_ids),
                    LessonCompletion.assignment_needs_resubmission.is_(True),
                ).count()

            projects = Project.query.join(Course).filter(
                Course.instructor_id == instructor_id
            ).all()
            project_rows = _project_revision_rows(instructor_id=instructor_id)
            project_requests = sum(
                row.resubmission_count or 0 for row, _, _, _ in project_rows
            )
            project_pending = sum(
                1 for row, project, _, _ in project_rows
                if _project_revision_state(row, project)['can_resubmit']
            )
            projects_with_mods = len({row.project_id for row, _, _, _ in project_rows})

            total_items = len(assignments) + len(projects)
            total_requests = int(assignment_requests) + int(project_requests)
            pending = assignment_pending + project_pending

            return {
                'total_assignments': len(assignments),
                'assignments_with_modifications': assignments_with_mods,
                'total_projects': len(projects),
                'projects_with_modifications': projects_with_mods,
                'total_items': total_items,
                'total_modification_requests': total_requests,
                'pending_resubmissions': pending,
                'completed_resubmissions': max(0, total_requests - pending),
                'average_resubmissions_per_assignment': (
                    round(total_requests / total_items, 2) if total_items else 0
                ),
                'modification_rate': (
                    round(
                        (assignments_with_mods + projects_with_mods)
                        / total_items * 100, 1,
                    ) if total_items else 0
                ),
            }

        except Exception as e:
            logger.error(f"Error getting modification stats: {e}")
            return {}
    
    @staticmethod
    def get_student_modification_history(student_id: int, course_id: Optional[int] = None) -> List[Dict]:
        """Get assignment and project modification history for a student."""
        try:
            query = db.session.query(
                AssignmentSubmission,
                Assignment,
                LessonCompletion,
                Course.title.label('course_title'),
                User,
            ).join(
                Assignment, AssignmentSubmission.assignment_id == Assignment.id
            ).join(
                Course, Assignment.course_id == Course.id
            ).join(
                User, Course.instructor_id == User.id
            ).outerjoin(
                LessonCompletion,
                and_(
                    LessonCompletion.lesson_id == Assignment.lesson_id,
                    LessonCompletion.student_id == student_id,
                ),
            ).filter(
                AssignmentSubmission.student_id == student_id,
                or_(
                    Assignment.modification_requested.is_(True),
                    LessonCompletion.assignment_needs_resubmission.is_(True),
                ),
            )
            if course_id:
                query = query.filter(Assignment.course_id == course_id)
            query = query.order_by(desc(Assignment.modification_requested_at))

            history = []
            for submission, assignment, completion, course_title, instructor in query.all():
                instructor_name = instructor.full_name if instructor else None
                reason = (
                    getattr(completion, 'modification_request_reason', None)
                    or assignment.modification_request_reason
                )
                requested_at = assignment.modification_requested_at
                needs_resubmission = bool(
                    getattr(completion, 'assignment_needs_resubmission', False)
                )
                history.append({
                    'type': 'assignment',
                    'id': assignment.id,
                    'assignment_id': assignment.id,
                    'project_id': None,
                    'title': assignment.title,
                    'assignment_title': assignment.title,
                    'course_title': course_title,
                    'instructor_name': instructor_name,
                    'modification_reason': reason,
                    'requested_at': requested_at.isoformat() if requested_at else None,
                    'resubmission_count': submission.resubmission_count or 0,
                    'max_resubmissions': assignment.max_resubmissions or 3,
                    'needs_resubmission': needs_resubmission,
                    'status': 'pending' if needs_resubmission else 'resubmitted',
                })

            for submission, project, course_title, instructor_name in _project_revision_rows(
                student_id=student_id, course_id=course_id,
            ):
                state = _project_revision_state(submission, project)
                requested_at = state['modification_requested_at']
                history.append({
                    'type': 'project',
                    'id': project.id,
                    'assignment_id': None,
                    'project_id': project.id,
                    'title': project.title,
                    'assignment_title': project.title,
                    'course_title': course_title,
                    'instructor_name': instructor_name,
                    'modification_reason': state['modification_request_reason'],
                    'requested_at': requested_at.isoformat() if requested_at else None,
                    'resubmission_count': submission.resubmission_count or 0,
                    'max_resubmissions': project.max_resubmissions or 3,
                    'needs_resubmission': bool(state['can_resubmit']),
                    'status': 'pending' if state['can_resubmit'] else 'resubmitted',
                })

            history.sort(
                key=lambda row: row['requested_at'] or '',
                reverse=True,
            )
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
            result: Dict
            with safe_db_session():
                # Get assignment and verify instructor ownership
                assignment = Assignment.query.filter_by(id=assignment_id).first()
                if not assignment:
                    result = {'success': False, 'error': 'Assignment not found'}
                    return result
                
                # Verify instructor has access
                course = Course.query.filter_by(id=assignment.course_id, instructor_id=instructor_id).first()
                if not course:
                    result = {'success': False, 'error': 'Access denied'}
                    return result
                
                # Get student
                student = User.query.filter_by(id=student_id).first()
                if not student:
                    result = {'success': False, 'error': 'Student not found'}
                    return result
                
                # Check for submission
                assignment_submission = AssignmentSubmission.query.filter_by(
                    assignment_id=assignment_id,
                    student_id=student_id
                ).first()
                
                if not assignment_submission:
                    result = {'success': False, 'error': 'No submission found'}
                    return result
                
                # The attempt limit belongs to the student's submission.
                max_resubmissions = getattr(assignment, 'max_resubmissions', 3)
                current_resubmissions = (
                    getattr(assignment_submission, 'resubmission_count', 0) or 0
                )
                if (current_resubmissions >= max_resubmissions
                        and not assignment_revision_state(
                            assignment_submission, assignment,
                        )['modification_requested']):
                    result = {'success': False, 'error': f'Maximum resubmissions ({max_resubmissions}) reached'}
                    return result

                grade_data = aage_grade_data('assignment', assignment_submission.id)
                reason = resolve_modification_reason(
                    reason,
                    total_score=assignment_submission.grade,
                    max_score=getattr(assignment, 'points_possible', 100) or 100,
                    passing_score=getattr(assignment, 'passing_score', None),
                    grade_data=grade_data,
                    existing_feedback=assignment_submission.feedback,
                )

                # Keep the AI/rubric feedback on the submission. The reason is
                # stored separately and must not replace the evidence behind
                # the revision request.
                if (not assignment_submission.feedback
                        or is_generic_reason(assignment_submission.feedback)):
                    enriched = build_student_feedback(
                        grade_data, assignment_submission.feedback
                    )
                    assignment_submission.feedback = enriched or reason

                lesson_completion = LessonCompletion.query.filter_by(
                    lesson_id=assignment.lesson_id,
                    student_id=student_id
                ).first()
                request_assignment_modification(
                    assignment_submission, assignment, reason,
                    requested_by=instructor_id,
                    lesson_completion=lesson_completion,
                )
                result = {'success': True, 'assignment': assignment, 'student': student, 'course': course}

            if result.get('success'):
                try:
                    notify_modification_requested(
                        student_id, result['assignment'], reason,
                        actor_id=instructor_id,
                        course_id=result['assignment'].course_id,
                    )
                except Exception as notif_err:
                    logger.warning(
                        f"Bulk revision notification failed (non-blocking): {notif_err}"
                    )
            return result

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
            
            # Query modification requests over time (assignments + projects)
            assignment_trends = db.session.query(
                func.date(Assignment.modification_requested_at).label('date'),
                func.count(Assignment.id).label('count')
            ).filter(
                Assignment.id.in_(assignment_ids),
                Assignment.modification_requested_at >= start_date,
                Assignment.modification_requested_at <= end_date
            ).group_by(
                func.date(Assignment.modification_requested_at)
            ).all()

            counts: Dict[str, int] = {}
            for date, count in assignment_trends:
                if date is not None:
                    counts[str(date)] = counts.get(str(date), 0) + int(count or 0)

            project_trends = db.session.query(
                func.date(ProjectSubmission.modification_requested_at).label('date'),
                func.count(ProjectSubmission.id).label('count'),
            ).join(
                Project, ProjectSubmission.project_id == Project.id
            ).join(
                Course, Project.course_id == Course.id
            ).filter(
                Course.instructor_id == instructor_id,
                ProjectSubmission.modification_requested_at >= start_date,
                ProjectSubmission.modification_requested_at <= end_date,
            ).group_by(
                func.date(ProjectSubmission.modification_requested_at)
            ).all()
            for date, count in project_trends:
                if date is not None:
                    counts[str(date)] = counts.get(str(date), 0) + int(count or 0)

            trends = [
                {'date': date, 'modification_requests': count}
                for date, count in sorted(counts.items())
            ]
            
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
            
            instructor = User.query.get(instructor_id)
            for assignment, lesson_completion, student, course in overdue_query.all():
                try:
                    # Send reminder email
                    send_modification_request_notification(
                        student_email=student.email,
                        student_name=student.full_name,
                        assignment_title=assignment.title,
                        instructor_name=instructor.full_name,
                        reason=f"REMINDER: {assignment.modification_request_reason}",
                        course_title=course.title,
                        student=student
                    )
                    reminders_sent += 1

                except Exception as e:
                    error_msg = f"Failed to send reminder to {student.email}: {str(e)}"
                    errors.append(error_msg)
                    logger.error(error_msg)

            for submission, project, course_title, _ in _project_revision_rows(
                instructor_id=instructor_id, pending_only=True,
            ):
                state = _project_revision_state(submission, project)
                requested_at = state['modification_requested_at']
                if not requested_at or requested_at > cutoff_date:
                    continue
                student = User.query.get(submission.student_id)
                if not student:
                    continue
                try:
                    send_modification_request_notification(
                        student_email=student.email,
                        student_name=student.full_name,
                        assignment_title=project.title,
                        instructor_name=instructor.full_name if instructor else 'Instructor',
                        reason=f"REMINDER: {state['modification_request_reason']}",
                        course_title=course_title,
                        is_project=True,
                        student=student,
                    )
                    reminders_sent += 1
                except Exception as e:
                    error_msg = f"Failed to send project reminder to {student.email}: {str(e)}"
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
    def validate_modification_request(
        assignment_id: int, instructor_id: int, student_id: int,
        reason: str, *, item_type: str = 'assignment',
    ) -> Tuple[bool, str]:
        """Validate a modification request for an assignment or project."""
        try:
            if item_type == 'project':
                item = Project.query.filter_by(id=assignment_id).first()
                submission_model = ProjectSubmission
                id_column = 'project_id'
            else:
                item = Assignment.query.filter_by(id=assignment_id).first()
                submission_model = AssignmentSubmission
                id_column = 'assignment_id'
            if not item:
                return False, f"{item_type.title()} not found"

            course = Course.query.filter_by(
                id=item.course_id, instructor_id=instructor_id,
            ).first()
            if not course:
                return False, f"Instructor does not have access to this {item_type}"

            if not User.query.filter_by(id=student_id).first():
                return False, "Student not found"

            submission = submission_model.query.filter_by(
                **{id_column: assignment_id, 'student_id': student_id},
            ).first()
            if not submission:
                return False, "No submission found for this student"

            maximum = getattr(item, 'max_resubmissions', 3) or 3
            used = getattr(submission, 'resubmission_count', 0) or 0
            pending = (
                assignment_revision_state(submission, item)['modification_requested']
                if item_type == 'assignment' else bool(
                    getattr(submission, 'modification_requested', False)
                    or getattr(submission, 'can_resubmit', False)
                )
            )
            if used >= maximum and not pending:
                return False, f"Maximum resubmissions ({maximum}) reached"

            if not reason or not reason.strip():
                return False, "Modification reason is required"
            if len(reason.strip()) < 10:
                return False, "Modification reason must be at least 10 characters"

            return True, "Validation successful"

        except Exception as e:
            logger.error(f"Error validating modification request: {e}")
            return False, f"Validation error: {str(e)}"