from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import and_, or_, func, desc
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError
import logging
from datetime import datetime, timedelta
from functools import wraps

# Import models
from ..models import db
from ..models.user_models import User
from ..models.course_models import Assignment, Project, Course, Module, Lesson, AssignmentSubmission, ProjectSubmission
from ..models.student_models import LessonCompletion
from ..utils.email_notifications import send_modification_request_notification, send_resubmission_notification
from ..utils.db_utils import safe_db_session, DatabaseManager
from ..services.modification_analytics_service import ModificationAnalytics, ModificationInsights

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
        
        # Check resubmission limits
        max_resubmissions = getattr(assignment, 'max_resubmissions', 3)
        current_resubmissions = getattr(assignment, 'resubmission_count', 0)
        
        if current_resubmissions >= max_resubmissions:
            return jsonify({'error': f'Maximum resubmissions ({max_resubmissions}) reached'}), 400
        
        # Update assignment with modification request
        assignment.modification_requested = True
        assignment.modification_request_reason = reason
        assignment.modification_requested_at = datetime.utcnow()
        assignment.modification_requested_by = user_id
        
        logger.info(f"🔍 Debug: About to update assignment {assignment_id}")
        
        # Update assignment submission to allow resubmission
        # Clear the grade to indicate it needs to be resubmitted
        assignment_submission.grade = None
        assignment_submission.graded_at = None
        assignment_submission.graded_by = None
        assignment_submission.feedback = f"Modification requested: {reason}"
        
        # Update lesson completion to allow resubmission
        if lesson_completion:
            lesson_completion.assignment_graded = False  # Allow resubmission
            lesson_completion.assignment_needs_resubmission = True
            lesson_completion.modification_request_reason = reason
        
        logger.info(f"🔍 Debug: About to update assignment submission {assignment_submission.id}")
        
        # Increment resubmission count
        if not hasattr(assignment, 'resubmission_count'):
            assignment.resubmission_count = 1
        else:
            assignment.resubmission_count = (assignment.resubmission_count or 0) + 1
        
        logger.info(f"🔍 Debug: About to commit to database")
        db.session.commit()
        logger.info(f"🔍 Debug: Database commit successful")
        
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
                frontend_url=frontend_url
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
                'resubmissions_remaining': max_resubmissions - assignment.resubmission_count
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
        
        # Check resubmission limits
        max_resubmissions = getattr(project, 'max_resubmissions', 3)
        current_resubmissions = getattr(project, 'resubmission_count', 0)
        
        if current_resubmissions >= max_resubmissions:
            return jsonify({'error': f'Maximum resubmissions ({max_resubmissions}) reached'}), 400
        
        # Update project with modification request
        project.modification_requested = True
        project.modification_request_reason = reason
        project.modification_requested_at = datetime.utcnow()
        project.modification_requested_by = user_id
        
        # Increment resubmission count
        if not hasattr(project, 'resubmission_count'):
            project.resubmission_count = 1
        else:
            project.resubmission_count = (project.resubmission_count or 0) + 1
        
        db.session.commit()
        
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
                assignment_title=project.title,
                instructor_name=instructor.full_name,
                reason=reason,
                course_title=course.title,
                is_project=True,
                assignment_id=project_id,
                due_date=due_date,
                frontend_url=frontend_url
            )
            
            if success:
                logger.info(f"📧 Project modification request notification sent to {student.email}")
            else:
                logger.warning(f"⚠️ Failed to send project modification request notification to {student.email}")
            
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
                'requested_at': project.modification_requested_at.isoformat(),
                'resubmissions_remaining': max_resubmissions - project.resubmission_count
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
        
        # Check if modification was requested
        if not getattr(assignment, 'modification_requested', False):
            return jsonify({'error': 'No modification request found for this assignment'}), 400
        
        # Find the lesson completion record
        lesson_completion = LessonCompletion.query.filter_by(
            lesson_id=assignment.lesson_id,
            student_id=user_id
        ).first()
        
        if not lesson_completion:
            return jsonify({'error': 'Assignment record not found'}), 404
        
        # Check if resubmission is allowed and atomic lockout
        if not getattr(lesson_completion, 'assignment_needs_resubmission', False):
            return jsonify({'error': 'Resubmission not allowed for this assignment or already submitted.'}), 400

        # Double-check atomicity: if already resubmitted and flag cleared, block
        if lesson_completion.is_resubmission and not lesson_completion.assignment_needs_resubmission:
            return jsonify({'error': 'You have already submitted a response for this modification request.'}), 400
        
        # Validate submission data
        submission_text = data.get('submission_text', '').strip()
        file_url = data.get('file_url', '').strip()
        
        if not submission_text and not file_url:
            return jsonify({'error': 'Please provide either submission text or file'}), 400
        
        # Update lesson completion with resubmission
        lesson_completion.assignment_submission = submission_text or lesson_completion.assignment_submission
        lesson_completion.assignment_file_url = file_url or lesson_completion.assignment_file_url
        lesson_completion.assignment_submitted_at = datetime.utcnow()
        lesson_completion.assignment_graded = False  # Reset graded status
        lesson_completion.assignment_needs_resubmission = False
        lesson_completion.is_resubmission = True
        lesson_completion.resubmission_reason = data.get('resubmission_notes', '')
        
        # Clear modification request flags
        assignment.modification_requested = False
        assignment.modification_request_reason = None
        
        db.session.commit()
        
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
        
        # Get assignments with modification requests for this student
        assignments_with_modifications = db.session.query(
            Assignment,
            LessonCompletion,
            Course.title.label('course_title'),
            Lesson.title.label('lesson_title')
        ).join(
            LessonCompletion, Assignment.lesson_id == LessonCompletion.lesson_id
        ).join(
            Course, Assignment.course_id == Course.id
        ).join(
            Lesson, Assignment.lesson_id == Lesson.id
        ).filter(
            LessonCompletion.student_id == user_id,
            Assignment.modification_requested == True,
            LessonCompletion.assignment_needs_resubmission == True
        ).all()
        
        modification_requests = []
        for assignment, lesson_completion, course_title, lesson_title in assignments_with_modifications:
            modification_requests.append({
                'id': assignment.id,
                'title': assignment.title,
                'description': assignment.description,
                'course_title': course_title,
                'lesson_title': lesson_title,
                'modification_reason': assignment.modification_request_reason,
                'requested_at': assignment.modification_requested_at.isoformat() if assignment.modification_requested_at else None,
                'resubmissions_remaining': (assignment.max_resubmissions or 3) - (assignment.resubmission_count or 0),
                'type': 'assignment'
            })
        
        # Get projects with modification requests (if applicable)
        # This would need to be implemented based on your project submission model
        
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
        
        # Get assignments with modification requests made by this instructor
        assignments_with_modifications = db.session.query(
            Assignment,
            User.full_name.label('student_name'),
            User.email.label('student_email'),
            Course.title.label('course_title'),
            Lesson.title.label('lesson_title'),
            LessonCompletion
        ).join(
            LessonCompletion, Assignment.lesson_id == LessonCompletion.lesson_id
        ).join(
            User, LessonCompletion.student_id == User.id
        ).join(
            Course, Assignment.course_id == Course.id
        ).join(
            Lesson, Assignment.lesson_id == Lesson.id
        ).filter(
            Assignment.modification_requested_by == user_id,
            Course.instructor_id == user_id
        ).order_by(desc(Assignment.modification_requested_at)).all()
        
        modification_requests = []
        for assignment, student_name, student_email, course_title, lesson_title, lesson_completion in assignments_with_modifications:
            modification_requests.append({
                'id': assignment.id,
                'title': assignment.title,
                'course_title': course_title,
                'lesson_title': lesson_title,
                'student_name': student_name,
                'student_email': student_email,
                'student_id': lesson_completion.student_id,
                'modification_reason': assignment.modification_request_reason,
                'requested_at': assignment.modification_requested_at.isoformat() if assignment.modification_requested_at else None,
                'needs_resubmission': lesson_completion.assignment_needs_resubmission,
                'resubmission_count': assignment.resubmission_count or 0,
                'max_resubmissions': assignment.max_resubmissions or 3,
                'type': 'assignment',
                'status': 'pending_resubmission' if lesson_completion.assignment_needs_resubmission else 'resubmitted'
            })
        
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