from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import and_, or_, func, desc
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError
import logging
from datetime import datetime, timedelta
from functools import wraps
from ..utils.time_utils import now_local

# Import models
from ..models import db
from ..models.user_models import User
from ..models.course_models import Assignment, Project, Course, Module, Lesson, AssignmentSubmission, ProjectSubmission
from ..models.student_models import LessonCompletion
from ..utils.email_notifications import send_modification_request_notification, send_resubmission_notification
from ..utils.db_utils import safe_db_session, DatabaseManager
from ..services.modification_analytics_service import ModificationAnalytics, ModificationInsights
from ..services.grading_feedback import (
    aage_grade_data,
    assignment_revision_state,
    build_student_feedback,
    can_resubmit_assignment,
    complete_assignment_resubmission,
    is_generic_reason,
    request_assignment_modification as apply_assignment_modification,
    resolve_modification_reason,
)
from ..services.modification_service import (
    _project_revision_rows, _project_revision_state,
)
from ..services.notification_service import (
    notify_modification_requested, notify_resubmission_received,
)
from ..services.project_scoring_service import team_member_ids

logger = logging.getLogger(__name__)

# Local decorator definitions
def instructor_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        if not user or not user.role or user.role.name != 'instructor':
            return jsonify({"message": "Instructor access required"}), 403
        return f(*args, **kwargs)
    return decorated_function

def student_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        if not user or not user.role or user.role.name != 'student':
            return jsonify({"message": "Student access required"}), 403
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        if not user or not user.role or user.role.name != 'admin':
            return jsonify({"message": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated_function

# Create blueprint for modification requests
modification_bp = Blueprint('modification', __name__)

@modification_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for modification system"""
    try:
        from ..utils.db_utils import check_db_health, get_pool_status
        
        db_healthy, db_message = check_db_health()
        pool_status = get_pool_status()
        
        return jsonify({
            'status': 'healthy' if db_healthy else 'unhealthy',
            'database': {
                'healthy': db_healthy,
                'message': db_message
            },
            'connection_pool': pool_status,
            'timestamp': datetime.utcnow().isoformat()
        }), 200 if db_healthy else 503
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 500

@modification_bp.route('/assignments/<int:assignment_id>/request-modification', methods=['POST'])
def request_assignment_modification(assignment_id):
    """Request modification for an assignment submission"""
    logger.info(f"🔍 Debug: Route hit - assignment_id: {assignment_id}")
    logger.info(f"🔍 Debug: Request headers: {dict(request.headers)}")
    logger.info(f"🔍 Debug: Request data: {request.get_json()}")
    
    try:
        # Manual JWT verification with better error handling
        from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
        verify_jwt_in_request()
        user_id = get_jwt_identity()
        logger.info(f"🔍 Debug: JWT verified, user_id: {user_id}")
        
        # Manual instructor check
        user = User.query.get(user_id)
        if not user or not user.role or user.role.name != 'instructor':
            logger.error(f"❌ User {user_id} is not an instructor")
            return jsonify({"message": "Instructor access required"}), 403
        logger.info(f"🔍 Debug: User {user_id} is verified instructor")
        
        data = request.get_json()
    except Exception as jwt_error:
        logger.error(f"❌ JWT authentication error: {jwt_error}")
        logger.error(f"❌ JWT error type: {type(jwt_error).__name__}")
        return jsonify({'error': 'Authentication failed', 'details': str(jwt_error)}), 401
    
    try:
        
        logger.info(f"🔍 Debug: Request data: {data}")
        logger.info(f"🔍 Debug: Assignment ID: {assignment_id}")
        logger.info(f"🔍 Debug: User ID: {user_id}")
        
        # Validate required fields
        if not data or 'student_id' not in data or 'reason' not in data:
            logger.error(f"❌ Missing required fields in request: {data}")
            return jsonify({'error': 'Student ID and reason are required'}), 400
        
        student_id = data['student_id']
        reason = data['reason']
        
        # Get assignment and verify instructor ownership
        assignment = Assignment.query.filter_by(id=assignment_id).first()
        logger.info(f"🔍 Debug: Assignment found: {assignment}")
        if not assignment:
            logger.error(f"❌ Assignment {assignment_id} not found")
            return jsonify({'error': 'Assignment not found'}), 404
        
        # Verify instructor has access to this assignment
        course = Course.query.filter_by(id=assignment.course_id, instructor_id=user_id).first()
        logger.info(f"🔍 Debug: Course found: {course}")
        if not course:
            logger.error(f"❌ Instructor {user_id} doesn't have access to assignment {assignment_id}")
            return jsonify({'error': 'Access denied'}), 403
        
        # Get student
        student = User.query.filter_by(id=student_id).first()
        logger.info(f"🔍 Debug: Student found: {student}")
        if not student:
            logger.error(f"❌ Student {student_id} not found")
            return jsonify({'error': 'Student not found'}), 404
        
        # Find the lesson completion record for this assignment
        lesson_completion = LessonCompletion.query.filter_by(
            lesson_id=assignment.lesson_id,
            student_id=student_id
        ).first()
        logger.info(f"🔍 Debug: Lesson completion found: {lesson_completion}")
        
        if not lesson_completion:
            logger.error(f"❌ No lesson completion found for student {student_id}, lesson {assignment.lesson_id}")
            return jsonify({'error': 'No submission found for this student'}), 404
        
        # Check for assignment submission in AssignmentSubmission table
        assignment_submission = AssignmentSubmission.query.filter_by(
            assignment_id=assignment_id,
            student_id=student_id
        ).first()
        logger.info(f"🔍 Debug: Assignment submission found: {assignment_submission}")
        
        if not assignment_submission:
            logger.error(f"❌ Student {student_id} has not submitted assignment {assignment_id} yet")
            return jsonify({'error': 'Student has not submitted this assignment yet'}), 400
        
        # The limit belongs to this student's submission, not to the shared
        # assignment row (which counts requests across the whole cohort).
        max_resubmissions = getattr(assignment, 'max_resubmissions', 3)
        current_resubmissions = getattr(assignment_submission, 'resubmission_count', 0)
        if current_resubmissions is None:
            current_resubmissions = getattr(assignment, 'resubmission_count', 0) or 0

        existing_revision = assignment_revision_state(
            assignment_submission, assignment,
        )
        if (current_resubmissions >= max_resubmissions
                and not existing_revision['modification_requested']):
            return jsonify({'error': f'Maximum resubmissions ({max_resubmissions}) reached'}), 400
        
        # A generic quick-select reason must never hide the rubric feedback
        # that actually caused the revision. Derive it from the published AAGE
        # result or the stored AI/instructor feedback when needed.
        grade_data = aage_grade_data('assignment', assignment_submission.id)
        reason = resolve_modification_reason(
            reason,
            total_score=assignment_submission.grade,
            max_score=getattr(assignment, 'points_possible', 100) or 100,
            passing_score=getattr(assignment, 'passing_score', None),
            grade_data=grade_data,
            existing_feedback=assignment_submission.feedback,
        )

        # Apply the revision to this student only. The helper increments the
        # per-student attempt count on the transition into the pending state,
        # so an updated reason does not consume another attempt.
        apply_assignment_modification(
            assignment_submission, assignment, reason,
            requested_by=user_id, lesson_completion=lesson_completion,
        )

        logger.info(f"🔍 Debug: About to update assignment {assignment_id}")

        # A revision changes the status, not the recorded grade/feedback. The
        # student needs both the score and the rubric explanation while fixing
        # the work, and the reason stays in its own field.
        if (not assignment_submission.feedback
                or is_generic_reason(assignment_submission.feedback)):
            enriched = build_student_feedback(grade_data, assignment_submission.feedback)
            assignment_submission.feedback = enriched or reason

        logger.info(f"🔍 Debug: About to commit to database")
        db.session.commit()
        logger.info(f"🔍 Debug: Database commit successful")

        try:
            notify_modification_requested(
                student_id, assignment, reason, actor_id=user_id,
                course_id=assignment.course_id,
            )
        except Exception as notif_err:
            logger.warning(f"In-app revision notification failed (non-blocking): {notif_err}")

        # Send email notification to student
        try:
            instructor = User.query.get(user_id)
            
            # Get frontend URL from environment or config
            frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:3000')
            
            # Calculate resubmission deadline (7 days from now)
            due_date = (datetime.now() + timedelta(days=7)).strftime('%B %d, %Y')
            
            success = send_modification_request_notification(
                student_email=student.email,
                student_name=student.full_name,
                assignment_title=assignment.title,
                instructor_name=instructor.full_name,
                reason=reason,
                course_title=course.title,
                is_project=False,
                assignment_id=assignment_id,
                due_date=due_date,
                frontend_url=frontend_url,
                student=student
            )
            
            if success:
                logger.info(f"📧 Modification request notification sent to {student.email}")
            else:
                logger.warning(f"⚠️ Failed to send modification request notification to {student.email}")
            
            # Send admin alert if configured
            admin_email = current_app.config.get('ADMIN_EMAIL')
            if admin_email:
                try:
                    from ..utils.email_notifications import send_admin_modification_alert
                    send_admin_modification_alert(
                        admin_email=admin_email,
                        instructor_name=instructor.full_name,
                        student_name=student.full_name,
                        assignment_title=assignment.title,
                        course_title=course.title,
                        reason=reason,
                        is_project=False
                    )
                except Exception as admin_e:
                    logger.warning(f"⚠️ Could not send admin alert: {admin_e}")
            
        except Exception as e:
            logger.error(f"Failed to send modification request email: {e}")
        
        logger.info(f"✅ Modification requested for assignment {assignment_id} by instructor {user_id} for student {student_id}")
        
        return jsonify({
            'success': True,
            'message': 'Modification request sent to student',
            'data': {
                'assignment_id': assignment_id,
                'student_id': student_id,
                'reason': reason,
                'requested_at': assignment.modification_requested_at.isoformat(),
                'resubmissions_remaining': max_resubmissions - assignment_submission.resubmission_count
            }
        }), 200
        
    except ValueError as e:
        db.session.rollback()
        logger.error(f"❌ Validation error in assignment modification: {e}")
        return jsonify({'error': str(e)}), 422
    except Exception as e:
        db.session.rollback()
        logger.error(f"❌ Error requesting assignment modification: {e}")
        logger.error(f"❌ Error type: {type(e).__name__}")
        import traceback
        logger.error(f"❌ Traceback: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

@modification_bp.route('/projects/<int:project_id>/request-modification', methods=['POST'])
@jwt_required()
@instructor_required
def request_project_modification(project_id):
    """Request modification for a project submission"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate required fields
        if not data or 'student_id' not in data or 'reason' not in data:
            return jsonify({'error': 'Student ID and reason are required'}), 400
        
        student_id = data['student_id']
        reason = data['reason']
        
        # Get project and verify instructor ownership
        project = Project.query.filter_by(id=project_id).first()
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        # Verify instructor has access to this project
        course = Course.query.filter_by(id=project.course_id, instructor_id=user_id).first()
        if not course:
            return jsonify({'error': 'Access denied'}), 403
        
        # Get student
        student = User.query.filter_by(id=student_id).first()
        if not student:
            return jsonify({'error': 'Student not found'}), 404
        
        # Check if there's a submission for this project
        # Note: This would need to be adapted based on your actual project submission model
        # For now, we'll update the project record directly
        
        # Revision state belongs to this student's submission (and their
        # teammates), never to the shared project row.
        from ..models.course_models import ProjectSubmission
        from ..services.project_scoring_service import (
            request_project_modification, team_member_ids,
        )
        primary = ProjectSubmission.query.filter_by(
            project_id=project_id, student_id=student_id
        ).first()
        if not primary:
            return jsonify({'error': 'No project submission found for this student'}), 404

        member_rows = ProjectSubmission.query.filter(
            ProjectSubmission.project_id == project_id,
            ProjectSubmission.student_id.in_(team_member_ids(project, primary)),
        ).all()

        max_resubmissions = getattr(project, 'max_resubmissions', 3)
        current_resubmissions = max(
            (row.resubmission_count or 0) for row in member_rows
        )
        if current_resubmissions >= max_resubmissions:
            return jsonify({'error': f'Maximum resubmissions ({max_resubmissions}) reached'}), 400

        grade_data = aage_grade_data('project', primary.id)
        reason = resolve_modification_reason(
            reason,
            total_score=primary.grade,
            max_score=getattr(project, 'points_possible', 100) or 100,
            passing_score=getattr(project, 'passing_score', None),
            grade_data=grade_data,
            existing_feedback=primary.feedback,
        )
        shared_feedback = build_student_feedback(grade_data, primary.feedback) or reason
        for row in member_rows:
            if not row.feedback or is_generic_reason(row.feedback):
                row.feedback = shared_feedback

        # Mirror the team's grade metadata so teammates do not see a revision
        # reason that cites a score while their own grade card stays empty.
        request_project_modification(
            member_rows,
            reason,
            user_id,
            grade=primary.grade,
            graded_at=primary.graded_at,
            graded_by=primary.graded_by,
        )
        db.session.commit()

        member_ids = sorted({
            int(row.student_id) for row in member_rows if row.student_id
        })
        for member_id in member_ids:
            try:
                notify_modification_requested(
                    member_id, project, reason, actor_id=user_id,
                    course_id=project.course_id, is_project=True,
                )
            except Exception as notif_err:
                logger.warning(
                    f"In-app project revision notification failed "
                    f"(non-blocking): {notif_err}"
                )

        # Send email notification to every teammate whose row was marked.
        try:
            instructor = User.query.get(user_id)
            
            # Get frontend URL from environment or config
            frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:3000')
            
            # Calculate resubmission deadline (7 days from now)
            due_date = (datetime.now() + timedelta(days=7)).strftime('%B %d, %Y')
            
            for member_id in member_ids:
                member = User.query.get(member_id)
                if not member:
                    continue
                success = send_modification_request_notification(
                    student_email=member.email,
                    student_name=member.full_name,
                    assignment_title=project.title,
                    instructor_name=instructor.full_name,
                    reason=reason,
                    course_title=course.title,
                    is_project=True,
                    assignment_id=project_id,
                    due_date=due_date,
                    frontend_url=frontend_url,
                    student=member
                )

                if success:
                    logger.info(f"📧 Project modification request notification sent to {member.email}")
                else:
                    logger.warning(f"⚠️ Failed to send project modification request notification to {member.email}")
            
            # Send admin alert if configured
            admin_email = current_app.config.get('ADMIN_EMAIL')
            if admin_email:
                try:
                    from ..utils.email_notifications import send_admin_modification_alert
                    send_admin_modification_alert(
                        admin_email=admin_email,
                        instructor_name=instructor.full_name,
                        student_name=student.full_name,
                        assignment_title=project.title,
                        course_title=course.title,
                        reason=reason,
                        is_project=True
                    )
                except Exception as admin_e:
                    logger.warning(f"⚠️ Could not send admin alert: {admin_e}")
                    
        except Exception as e:
            logger.error(f"Failed to send project modification request email: {e}")
        
        logger.info(f"✅ Modification requested for project {project_id} by instructor {user_id} for student {student_id}")
        
        return jsonify({
            'success': True,
            'message': 'Modification request sent to student',
            'data': {
                'project_id': project_id,
                'student_id': student_id,
                'reason': reason,
                'requested_at': primary.modification_requested_at.isoformat(),
                'resubmissions_remaining': max_resubmissions - (primary.resubmission_count or 0)
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error requesting project modification: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@modification_bp.route('/assignments/<int:assignment_id>/resubmit', methods=['POST'])
@jwt_required()
@student_required
def resubmit_assignment(assignment_id):
    """Allow student to resubmit an assignment after modification request"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Get assignment
        assignment = Assignment.query.filter_by(id=assignment_id).first()
        if not assignment:
            return jsonify({'error': 'Assignment not found'}), 404
        
        # This legacy endpoint still writes LessonCompletion, but the gate
        # must be the same per-student state used by the canonical submission
        # endpoints.
        assignment_submission = AssignmentSubmission.query.filter_by(
            assignment_id=assignment_id, student_id=user_id,
        ).first()
        if not can_resubmit_assignment(assignment_submission, assignment):
            return jsonify({'error': 'Resubmission not allowed for this assignment or already submitted.'}), 400

        used = (getattr(assignment_submission, 'resubmission_count', 0) or 0)
        if used > (getattr(assignment, 'max_resubmissions', 3) or 3):
            return jsonify({'error': f'Maximum resubmissions ({assignment.max_resubmissions or 3}) reached'}), 400

        # Find the lesson completion record
        lesson_completion = LessonCompletion.query.filter_by(
            lesson_id=assignment.lesson_id,
            student_id=user_id
        ).first()
        
        if not lesson_completion:
            return jsonify({'error': 'Assignment record not found'}), 404


        # Validate submission data
        submission_text = data.get('submission_text', '').strip()
        file_url = data.get('file_url', '').strip()
        
        if not submission_text and not file_url:
            return jsonify({'error': 'Please provide either submission text or file'}), 400
        
        # Update lesson completion with resubmission
        lesson_completion.assignment_submission = submission_text or lesson_completion.assignment_submission
        lesson_completion.assignment_file_url = file_url or lesson_completion.assignment_file_url
        lesson_completion.assignment_submitted_at = now_local()
        lesson_completion.assignment_graded = False  # Reset graded status

        if assignment_submission is not None:
            assignment_submission.content = submission_text or assignment_submission.content
            if file_url:
                assignment_submission.file_url = file_url
            assignment_submission.submission_notes = data.get('resubmission_notes', '')
            assignment_submission.submitted_at = now_local()
            assignment_submission.is_resubmission = True
            assignment_submission.original_submission_id = (
                assignment_submission.original_submission_id or assignment_submission.id
            )
            assignment_submission.grade = None
            assignment_submission.feedback = None
            assignment_submission.graded_at = None
            assignment_submission.graded_by = None

        complete_assignment_resubmission(
            assignment_submission, assignment,
            lesson_completion=lesson_completion,
            notes=data.get('resubmission_notes', ''),
        )

        db.session.commit()

        if assignment_submission is not None:
            try:
                from ..services.aage.submission_dispatch import enqueue_for_submission
                enqueue_for_submission(
                    submission_type='assignment',
                    submission_id=assignment_submission.id,
                    student_id=user_id,
                    force=True,
                )
            except Exception as enqueue_err:
                logger.warning(f"Could not enqueue resubmitted assignment (non-blocking): {enqueue_err}")

        try:
            student = User.query.get(user_id)
            owner = User.query.get(assignment.instructor_id or getattr(assignment.course, 'instructor_id', None))
            if student and owner:
                notify_resubmission_received(
                    owner.id, student, assignment,
                    course_id=assignment.course_id,
                )
        except Exception as notif_err:
            logger.warning(f"In-app resubmission notification failed (non-blocking): {notif_err}")

        # Send notification to instructor
        try:
            course = Course.query.get(assignment.course_id)
            instructor = User.query.get(course.instructor_id)
            student = User.query.get(user_id)
            
            # Get frontend URL from environment or config
            frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:3000')
            
            # Get submission notes from request data
            submission_notes = data.get('resubmission_notes', '')
            
            success = send_resubmission_notification(
                instructor_email=instructor.email,
                instructor_name=instructor.full_name,
                student_name=student.full_name,
                assignment_title=assignment.title,
                course_title=course.title,
                is_project=False,
                assignment_id=assignment_id,
                frontend_url=frontend_url,
                submission_notes=submission_notes
            )
            
            if success:
                logger.info(f"📧 Resubmission notification sent to instructor {instructor.email}")
            else:
                logger.warning(f"⚠️ Failed to send resubmission notification to instructor {instructor.email}")
        except Exception as e:
            logger.error(f"Failed to send resubmission notification: {e}")
        
        logger.info(f"✅ Assignment {assignment_id} resubmitted by student {user_id}")
        
        return jsonify({
            'success': True,
            'message': 'Assignment resubmitted successfully',
            'data': {
                'assignment_id': assignment_id,
                'submitted_at': lesson_completion.assignment_submitted_at.isoformat(),
                'is_resubmission': True
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error resubmitting assignment: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@modification_bp.route('/student/modification-requests', methods=['GET'])
@jwt_required()
@student_required
def get_student_modification_requests():
    """Get modification requests for a student"""
    try:
        user_id = get_jwt_identity()
        
        # Assignment revision state is per student; never show another
        # learner's cohort-level flag as this student's pending work.
        rows = db.session.query(
            AssignmentSubmission,
            Assignment,
            Course.title.label('course_title'),
            Lesson.title.label('lesson_title'),
        ).join(
            Assignment, AssignmentSubmission.assignment_id == Assignment.id
        ).join(
            Course, Assignment.course_id == Course.id
        ).join(
            Lesson, Assignment.lesson_id == Lesson.id
        ).filter(
            AssignmentSubmission.student_id == user_id,
            Assignment.modification_requested.is_(True),
        ).all()

        modification_requests = []
        for submission, assignment, course_title, lesson_title in rows:
            revision = assignment_revision_state(submission, assignment)
            if not revision['modification_requested']:
                continue
            requested_at = revision['modification_requested_at']
            modification_requests.append({
                'id': assignment.id,
                'submission_id': submission.id,
                'title': assignment.title,
                'description': assignment.description,
                'course_title': course_title,
                'lesson_title': lesson_title,
                'modification_reason': revision['modification_request_reason'],
                'requested_at': requested_at.isoformat() if requested_at else None,
                'resubmissions_remaining': (
                    (assignment.max_resubmissions or 3)
                    - (submission.resubmission_count or 0)
                ),
                'type': 'assignment',
                'assignment_type': assignment.assignment_type,
                'max_file_size_mb': assignment.max_file_size_mb,
                'allowed_file_types': assignment.allowed_file_types,
                'due_date': assignment.due_date.isoformat() if assignment.due_date else None,
            })

        for submission, project, course_title, _ in _project_revision_rows(
            student_id=user_id,
        ):
            state = _project_revision_state(submission, project)
            requested_at = state['modification_requested_at']
            modification_requests.append({
                'id': project.id,
                'submission_id': submission.id,
                'title': project.title,
                'description': project.description,
                'course_title': course_title,
                'lesson_title': None,
                'modification_reason': state['modification_request_reason'],
                'requested_at': requested_at.isoformat() if requested_at else None,
                'resubmissions_remaining': (
                    (project.max_resubmissions or 3)
                    - (submission.resubmission_count or 0)
                ),
                'type': 'project',
                'submission_format': project.submission_format,
                'max_file_size_mb': project.max_file_size_mb,
                'allowed_file_types': project.allowed_file_types,
                'due_date': project.due_date.isoformat() if project.due_date else None,
            })

        return jsonify({
            'success': True,
            'data': {
                'modification_requests': modification_requests,
                'total': len(modification_requests)
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting student modification requests: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@modification_bp.route('/assignments/bulk-request-modification', methods=['POST'])
@jwt_required()
@instructor_required
def bulk_request_modification():
    """Request modifications for multiple assignments/students"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate request data
        if not data or 'assignment_ids' not in data or 'student_modifications' not in data:
            return jsonify({'error': 'Missing required fields'}), 400
        
        assignment_ids = data['assignment_ids']
        student_modifications = data['student_modifications']
        
        # Import the service
        from ..services.modification_service import ModificationRequestService
        
        # Perform bulk modification request
        results = ModificationRequestService.bulk_request_modifications(
            assignment_ids=assignment_ids,
            instructor_id=user_id,
            student_modifications=student_modifications
        )
        
        return jsonify({
            'success': True,
            'message': f'Processed {results["successful"]} successful and {results["failed"]} failed requests',
            'data': results
        }), 200
        
    except Exception as e:
        logger.error(f"Error in bulk modification request: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@modification_bp.route('/instructor/modification-stats', methods=['GET'])
@jwt_required()
@instructor_required
def get_modification_stats():
    """Get modification request statistics for instructor"""
    try:
        user_id = get_jwt_identity()
        
        from ..services.modification_service import ModificationRequestService
        
        stats = ModificationRequestService.get_assignment_modification_stats(user_id)
        
        return jsonify({
            'success': True,
            'data': stats
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting modification stats: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@modification_bp.route('/instructor/send-reminders', methods=['POST'])
@jwt_required()
@instructor_required
def send_resubmission_reminders():
    """Send automatic reminders for overdue resubmissions"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        days_overdue = data.get('days_overdue', 7) if data else 7
        
        from ..services.modification_service import ModificationRequestService
        
        results = ModificationRequestService.auto_remind_pending_resubmissions(user_id, days_overdue)
        
        return jsonify({
            'success': results['success'],
            'message': f"Sent {results['reminders_sent']} reminders",
            'data': results
        }), 200
        
    except Exception as e:
        logger.error(f"Error sending reminders: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@modification_bp.route('/student/modification-history', methods=['GET'])
@jwt_required()
@student_required
def get_student_modification_history():
    """Get modification request history for student"""
    try:
        user_id = get_jwt_identity()
        course_id = request.args.get('course_id', type=int)
        
        from ..services.modification_service import ModificationRequestService
        
        history = ModificationRequestService.get_student_modification_history(user_id, course_id)
        
        return jsonify({
            'success': True,
            'data': {
                'modification_history': history,
                'total': len(history)
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting student modification history: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@modification_bp.route('/instructor/modification-requests', methods=['GET'])
@jwt_required()
@instructor_required
def get_instructor_modification_requests():
    """Get modification requests made by an instructor"""
    try:
        user_id = get_jwt_identity()
        
        # Include manual and auto requests for every student in the
        # instructor's courses; filtering by requested_by hides AI requests.
        rows = db.session.query(
            AssignmentSubmission,
            Assignment,
            User,
            User.email.label('student_email'),
            Course.title.label('course_title'),
            Lesson.title.label('lesson_title'),
        ).join(
            Assignment, AssignmentSubmission.assignment_id == Assignment.id
        ).join(
            User, AssignmentSubmission.student_id == User.id
        ).join(
            Course, Assignment.course_id == Course.id
        ).outerjoin(
            Lesson, Assignment.lesson_id == Lesson.id
        ).outerjoin(
            LessonCompletion,
            and_(
                LessonCompletion.lesson_id == Assignment.lesson_id,
                LessonCompletion.student_id == AssignmentSubmission.student_id,
            ),
        ).filter(
            Course.instructor_id == user_id,
            or_(
                Assignment.modification_requested.is_(True),
                LessonCompletion.assignment_needs_resubmission.is_(True),
            ),
        ).all()

        modification_requests = []
        for submission, assignment, student, student_email, course_title, lesson_title in rows:
            student_name = student.full_name if student else None
            revision = assignment_revision_state(submission, assignment)
            if not revision['modification_requested']:
                continue
            requested_at = revision['modification_requested_at']
            modification_requests.append({
                'id': assignment.id,
                'submission_id': submission.id,
                'title': assignment.title,
                'course_title': course_title,
                'lesson_title': lesson_title,
                'student_name': student_name,
                'student_email': student_email,
                'student_id': submission.student_id,
                'modification_reason': revision['modification_request_reason'],
                'requested_at': requested_at.isoformat() if requested_at else None,
                'needs_resubmission': bool(revision['can_resubmit']),
                'resubmission_count': submission.resubmission_count or 0,
                'max_resubmissions': assignment.max_resubmissions or 3,
                'type': 'assignment',
                'status': (
                    'pending_resubmission' if revision['can_resubmit']
                    else 'resubmitted'
                ),
            })

        for submission, project, course_title, _ in _project_revision_rows(
            instructor_id=user_id,
        ):
            state = _project_revision_state(submission, project)
            student = User.query.get(submission.student_id)
            requested_at = state['modification_requested_at']
            modification_requests.append({
                'id': project.id,
                'submission_id': submission.id,
                'title': project.title,
                'course_title': course_title,
                'lesson_title': None,
                'student_name': student.full_name if student else None,
                'student_email': student.email if student else None,
                'student_id': submission.student_id,
                'modification_reason': state['modification_request_reason'],
                'requested_at': requested_at.isoformat() if requested_at else None,
                'needs_resubmission': bool(state['can_resubmit']),
                'resubmission_count': submission.resubmission_count or 0,
                'max_resubmissions': project.max_resubmissions or 3,
                'type': 'project',
                'status': (
                    'pending_resubmission' if state['can_resubmit']
                    else 'resubmitted'
                ),
            })

        modification_requests.sort(
            key=lambda row: row['requested_at'] or '', reverse=True,
        )

        return jsonify({
            'success': True,
            'data': {
                'modification_requests': modification_requests,
                'total': len(modification_requests)
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting instructor modification requests: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@modification_bp.route('/analytics/instructor', methods=['GET'])
@instructor_required
def get_instructor_modification_analytics():
    """Get comprehensive analytics for instructor's modification requests"""
    try:
        current_user_id = int(get_jwt_identity())
        
        # Get query parameters
        course_id = request.args.get('course_id', type=int)
        days_back = request.args.get('days_back', default=90, type=int)
        
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days_back)
        
        # Get analytics
        analytics = ModificationAnalytics.get_instructor_modification_analytics(
            instructor_id=current_user_id,
            course_id=course_id,
            start_date=start_date,
            end_date=end_date
        )
        
        # Generate insights
        insights = ModificationInsights.generate_instructor_insights(analytics)
        improvement_plan = ModificationInsights.generate_improvement_plan(analytics)
        
        return jsonify({
            'success': True,
            'data': {
                'analytics': analytics,
                'insights': insights,
                'improvement_plan': improvement_plan
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting instructor analytics: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@modification_bp.route('/analytics/platform', methods=['GET'])
@admin_required
def get_platform_modification_analytics():
    """Get platform-wide modification analytics (admin only)"""
    try:
        # Get query parameters
        days_back = request.args.get('days_back', default=30, type=int)
        
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days_back)
        
        # Get analytics
        analytics = ModificationAnalytics.get_platform_modification_analytics(
            start_date=start_date,
            end_date=end_date
        )
        
        return jsonify({
            'success': True,
            'data': analytics
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting platform analytics: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@modification_bp.route('/analytics/trends', methods=['GET'])
@instructor_required
def get_modification_trends():
    """Get modification trends over time"""
    try:
        current_user_id = int(get_jwt_identity())
        
        # Get query parameters
        course_id = request.args.get('course_id', type=int)
        period = request.args.get('period', default='weekly')  # daily, weekly, monthly
        weeks_back = request.args.get('weeks_back', default=12, type=int)
        
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(weeks=weeks_back)
        
        # Base query
        base_query = db.session.query(Assignment).join(Course).filter(
            Course.instructor_id == current_user_id,
            Assignment.modification_requested_at.between(start_date, end_date)
        )
        
        if course_id:
            base_query = base_query.filter(Assignment.course_id == course_id)
        
        # Group by time period
        if period == 'daily':
            time_format = '%Y-%m-%d'
            delta = timedelta(days=1)
        elif period == 'weekly':
            time_format = '%Y-%W'
            delta = timedelta(weeks=1)
        else:  # monthly
            time_format = '%Y-%m'
            delta = timedelta(days=30)
        
        # Get data
        modifications = base_query.filter(Assignment.modification_requested == True).all()
        
        # Process trends
        trends = {}
        current = start_date
        
        while current <= end_date:
            period_key = current.strftime(time_format)
            trends[period_key] = {
                'date': current.isoformat(),
                'modifications': 0,
                'resubmissions': 0,
                'success_rate': 0
            }
            current += delta
        
        # Count modifications by period
        for mod in modifications:
            if mod.modification_requested_at:
                period_key = mod.modification_requested_at.strftime(time_format)
                if period_key in trends:
                    trends[period_key]['modifications'] += 1
                    
                    # Check for successful resubmission
                    completion = LessonCompletion.query.filter(
                        LessonCompletion.lesson_id == mod.lesson_id,
                        LessonCompletion.assignment_needs_resubmission == False,
                        LessonCompletion.is_resubmission == True
                    ).first()
                    
                    if completion:
                        trends[period_key]['resubmissions'] += 1

        project_rows = _project_revision_rows(
            instructor_id=current_user_id, course_id=course_id,
            start_date=start_date, end_date=end_date,
        )
        for submission, project, _, _ in project_rows:
            state = _project_revision_state(submission, project)
            requested_at = state['modification_requested_at']
            if not requested_at:
                continue
            period_key = requested_at.strftime(time_format)
            if period_key not in trends:
                continue
            trends[period_key]['modifications'] += 1
            if submission.is_resubmission and not state['can_resubmit']:
                trends[period_key]['resubmissions'] += 1

        # Calculate success rates
        for period_data in trends.values():
            if period_data['modifications'] > 0:
                period_data['success_rate'] = round(
                    (period_data['resubmissions'] / period_data['modifications']) * 100, 1
                )
        
        # Convert to list and sort
        trend_list = [
            {
                'period': period,
                **data
            }
            for period, data in sorted(trends.items())
        ]
        
        return jsonify({
            'success': True,
            'data': {
                'trends': trend_list,
                'period': period,
                'date_range': {
                    'start': start_date.isoformat(),
                    'end': end_date.isoformat()
                }
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting modification trends: {e}")
        return jsonify({'error': 'Internal server error'}), 500