# Instructor API Routes for Afritec Bridge LMS

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, and_
from datetime import datetime
import logging
import threading

# Assuming db and models are correctly set up and accessible.
from ..models.user_models import db, User, Role
from ..models.course_models import Course, Module, Lesson, Enrollment, Quiz, Question, Answer, Submission, Announcement, Assignment
from ..services.background_service import background_service
from ..utils.email_utils import send_email
from ..utils.email_templates import course_announcement_email

# Set up logger
logger = logging.getLogger(__name__)

# Helper for role checking (decorator)
from functools import wraps

def instructor_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        # Debug logging
        logger.info(f"Instructor access check - User ID: {current_user_id}")
        if user:
            logger.info(f"User found: {user.username}, Role: {user.role.name if user.role else 'None'}")
        else:
            logger.info("No user found for the provided token")
        
        if not user or not user.role or user.role.name not in ['instructor', 'admin']:
            logger.warning(f"Access denied for user {current_user_id} - Role: {user.role.name if user and user.role else 'None'}")
            return jsonify({"message": "Instructor access required"}), 403
        return f(*args, **kwargs)
    return decorated_function

instructor_bp = Blueprint("instructor_bp", __name__, url_prefix="/api/v1/instructor")

# Helper function for sending announcement emails
def _send_announcement_emails(announcement, course):
    """Send announcement emails to all enrolled students in a course"""
    try:
        # Get all enrolled students for this course
        enrollments = Enrollment.query.filter_by(course_id=course.id).filter(
            Enrollment.status.in_(['active', 'completed'])
        ).all()
        
        # Get the instructor information
        instructor = User.query.get(announcement.instructor_id)
        instructor_name = f"{instructor.first_name} {instructor.last_name}".strip() if instructor else "Your Instructor"
        
        # Extract data from SQLAlchemy objects before threading to avoid DetachedInstanceError
        course_title = course.title
        announcement_title = announcement.title
        announcement_content = announcement.content
        
        # Extract student data before threading
        students_data = []
        for enrollment in enrollments:
            student = enrollment.student
            if student and student.email:
                student_name = f"{student.first_name} {student.last_name}".strip() if student.first_name else student.username
                students_data.append({
                    'email': student.email,
                    'name': student_name
                })
        
        # Capture the Flask app instance before threading
        app_instance = current_app._get_current_object()
        
        # Send emails in a separate thread to avoid blocking the main request
        def send_emails():
            with app_instance.app_context():
                for student_info in students_data:
                    try:
                        # Generate email content
                        email_html = course_announcement_email(
                            student_name=student_info['name'],
                            course_title=course_title,
                            announcement_title=announcement_title,
                            announcement_content=announcement_content,
                            instructor_name=instructor_name
                        )
                        
                        # Send email
                        send_email(
                            to=student_info['email'],
                            subject=f"New Announcement: {announcement_title}",
                            template=email_html
                        )
                        
                        logger.info(f"Announcement email sent to student {student_info['email']} for course {course_title}")
                        
                    except Exception as e:
                        logger.error(f"Failed to send announcement email to student {student_info['email']}: {str(e)}")
                        continue
                        
                logger.info(f"Announcement email broadcast completed for {len(students_data)} students in course {course_title}")
        
        # Start email sending in background thread
        email_thread = threading.Thread(target=send_emails)
        email_thread.daemon = True
        email_thread.start()
        
    except Exception as e:
        logger.error(f"Failed to initiate announcement email broadcast: {str(e)}")

# --- Dashboard Routes ---
@instructor_bp.route("/dashboard", methods=["GET"])
@instructor_required
def get_instructor_dashboard():
    """Get instructor dashboard data including courses, students, pending items, etc."""
    current_user_id = int(get_jwt_identity())  # Ensure integer comparison
    user = User.query.get(current_user_id)
    
    try:
        # Get instructor's courses
        courses = Course.query.filter_by(instructor_id=current_user_id).all()
        
        # Get total students across all courses
        total_students = db.session.query(func.count(Enrollment.id.distinct())).filter(
            Enrollment.course_id.in_([c.id for c in courses])
        ).scalar() or 0
        
        # Get pending submissions for grading
        pending_submissions = db.session.query(func.count(Submission.id)).filter(
            and_(
                Submission.quiz_id.in_(
                    db.session.query(Quiz.id).filter(
                        Quiz.module_id.in_(
                            db.session.query(Module.id).filter(
                                Module.course_id.in_([c.id for c in courses])
                            )
                        )
                    )
                ),
                Submission.grade.is_(None)
            )
        ).scalar() or 0
        
        # Get recent enrollments
        recent_enrollments = db.session.query(Enrollment).filter(
            Enrollment.course_id.in_([c.id for c in courses])
        ).order_by(Enrollment.enrollment_date.desc()).limit(10).all()
        
        # Get recent announcements
        recent_announcements = db.session.query(Announcement).filter(
            Announcement.course_id.in_([c.id for c in courses])
        ).order_by(Announcement.created_at.desc()).limit(5).all()
        
        dashboard_data = {
            "taughtCourses": [course.to_dict() for course in courses],
            "totalStudents": total_students,
            "pendingGradingItems": pending_submissions,
            "recentEnrollments": [enrollment.to_dict() for enrollment in recent_enrollments],
            "recentAnnouncements": [
                {
                    "id": ann.id,
                    "title": ann.title,
                    "course_title": ann.course.title if ann.course else "Unknown",
                    "created_at": ann.created_at.isoformat()
                } for ann in recent_announcements
            ]
        }
        
        return jsonify(dashboard_data), 200
        
    except Exception as e:
        return jsonify({"message": "Failed to fetch dashboard data", "error": str(e)}), 500

# --- Course Management Routes ---
@instructor_bp.route("/courses", methods=["GET"])
@jwt_required()
def get_instructor_courses():
    """Get all courses taught by the current instructor."""
    try:
        current_user_id = int(get_jwt_identity())
        print(f"DEBUG: User ID from JWT: {current_user_id}")
        
        user = User.query.get(current_user_id)
        print(f"DEBUG: User found: {user}")
        print(f"DEBUG: User role: {user.role.name if user and user.role else 'None'}")
        
        if not user or not user.role or user.role.name not in ['instructor', 'admin']:
            return jsonify({"message": "Instructor access required"}), 403
        
        courses = Course.query.filter_by(instructor_id=current_user_id).all()
        print(f"DEBUG: Found {len(courses)} courses for instructor {current_user_id}")
        # Return courses array directly for consistency with frontend
        return jsonify([course.to_dict() for course in courses]), 200
    except Exception as e:
        print(f"ERROR in get_instructor_courses: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": "Failed to fetch courses", "error": str(e)}), 500

@instructor_bp.route("/courses/<int:course_id>/analytics", methods=["GET"])
@instructor_required
def get_course_analytics(course_id):
    """Get analytics data for a specific course."""
    current_user_id = get_jwt_identity()
    
    # Verify instructor owns this course
    course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
    if not course:
        return jsonify({"message": "Course not found or access denied"}), 404
    
    try:
        # Get enrollment stats
        total_enrolled = db.session.query(func.count(Enrollment.id)).filter_by(course_id=course_id).scalar() or 0
        
        # Get active students (those who accessed in last 30 days)
        # This would require adding last_accessed field to enrollments or user activity tracking
        active_students = total_enrolled  # Placeholder
        
        # Get completion stats
        completed_enrollments = db.session.query(func.count(Enrollment.id)).filter(
            and_(Enrollment.course_id == course_id, Enrollment.completed_at.isnot(None))
        ).scalar() or 0
        
        completion_rate = (completed_enrollments / total_enrolled * 100) if total_enrolled > 0 else 0
        
        # Get quiz submission stats
        course_quizzes = db.session.query(Quiz.id).join(Module).filter(Module.course_id == course_id).all()
        quiz_ids = [q.id for q in course_quizzes]
        
        total_quiz_submissions = db.session.query(func.count(Submission.id)).filter(
            Submission.quiz_id.in_(quiz_ids)
        ).scalar() or 0
        
        pending_submissions = db.session.query(func.count(Submission.id)).filter(
            and_(Submission.quiz_id.in_(quiz_ids), Submission.grade.is_(None))
        ).scalar() or 0
        
        analytics = {
            "course_id": course_id,
            "total_enrolled": total_enrolled,
            "active_students": active_students,
            "completion_rate": round(completion_rate, 2),
            "average_progress": 50.0,  # Placeholder - would need progress tracking
            "total_quiz_submissions": total_quiz_submissions,
            "pending_submissions": pending_submissions
        }
        
        return jsonify(analytics), 200
        
    except Exception as e:
        return jsonify({"message": "Failed to fetch analytics", "error": str(e)}), 500

# --- Announcement Management Routes ---
@instructor_bp.route("/announcements", methods=["GET"])
@instructor_required
def get_instructor_announcements():
    """Get all announcements for courses taught by the instructor."""
    current_user_id = int(get_jwt_identity())
    
    try:
        # Get instructor's courses
        courses = Course.query.filter_by(instructor_id=current_user_id).all()
        course_ids = [c.id for c in courses]
        
        # Get all announcements for these courses
        announcements = db.session.query(Announcement).filter(
            Announcement.course_id.in_(course_ids)
        ).order_by(Announcement.created_at.desc()).all()
        
        # Return formatted announcements
        announcements_data = []
        for ann in announcements:
            ann_dict = ann.to_dict()
            # Add course title for easier display
            ann_dict['course_title'] = ann.course.title if ann.course else "Unknown"
            announcements_data.append(ann_dict)
        
        return jsonify(announcements_data), 200
        
    except Exception as e:
        logger.error(f"Error fetching instructor announcements: {str(e)}")
        return jsonify({"message": "Failed to fetch announcements", "error": str(e)}), 500

@instructor_bp.route("/announcements", methods=["POST"])
@instructor_required  
def create_announcement():
    """Create a new announcement for a specific course."""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['course_id', 'title', 'content']
    for field in required_fields:
        if not data.get(field):
            return jsonify({"message": f"Field '{field}' is required"}), 400
    
    try:
        # Verify instructor owns the course
        course = Course.query.filter_by(id=data['course_id'], instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Create announcement
        new_announcement = Announcement(
            course_id=data['course_id'],
            instructor_id=current_user_id,
            title=data['title'].strip(),
            content=data['content'].strip()
        )
        
        db.session.add(new_announcement)
        db.session.commit()
        
        # Send email notifications to enrolled students
        _send_announcement_emails(new_announcement, course)
        
        # Return the created announcement
        ann_dict = new_announcement.to_dict()
        ann_dict['course_title'] = course.title
        
        logger.info(f"Announcement created by instructor {current_user_id} for course {course.id}")
        return jsonify(ann_dict), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating announcement: {str(e)}")
        return jsonify({"message": "Failed to create announcement", "error": str(e)}), 500

# --- Student Management Routes ---
@instructor_bp.route("/students", methods=["GET"])
@instructor_required
def get_instructor_students():
    """Get all students enrolled in instructor's courses."""
    current_user_id = get_jwt_identity()
    course_id = request.args.get('course_id', type=int)
    
    try:
        # Get instructor's courses
        course_query = Course.query.filter_by(instructor_id=current_user_id)
        if course_id:
            course_query = course_query.filter_by(id=course_id)
        
        courses = course_query.all()
        course_ids = [c.id for c in courses]
        
        # Get enrollments for these courses
        enrollments = db.session.query(Enrollment).filter(
            Enrollment.course_id.in_(course_ids)
        ).join(User, Enrollment.student_id == User.id).all()
        
        students_data = []
        for enrollment in enrollments:
            user = enrollment.student  # Enrollment model uses 'student' relationship, not 'user'
            course = enrollment.course
            
            student_data = user.to_dict()
            student_data.update({
                "enrollment_id": enrollment.id,  # Include enrollment_id for unenroll action
                "course_id": course.id,
                "course_title": course.title,
                "enrollment_date": enrollment.enrollment_date.isoformat(),
                "progress": 0,  # Placeholder - would need progress tracking
                "last_accessed": None  # Placeholder - would need activity tracking
            })
            students_data.append(student_data)
        
        return jsonify(students_data), 200
        
    except Exception as e:
        return jsonify({"message": "Failed to fetch students", "error": str(e)}), 500

@instructor_bp.route("/courses/<int:course_id>/enrollments", methods=["GET"])
@instructor_required
def get_course_enrollments(course_id):
    """Get enrollments for a specific course."""
    current_user_id = get_jwt_identity()
    
    # Verify instructor owns this course
    course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
    if not course:
        return jsonify({"message": "Course not found or access denied"}), 404
    
    try:
        enrollments = Enrollment.query.filter_by(course_id=course_id).all()
        return jsonify([enrollment.to_dict() for enrollment in enrollments]), 200
    except Exception as e:
        return jsonify({"message": "Failed to fetch enrollments", "error": str(e)}), 500

@instructor_bp.route("/enrollments/<int:enrollment_id>", methods=["DELETE"])
@instructor_required
def unenroll_student(enrollment_id):
    """Unenroll a student from a course."""
    current_user_id = get_jwt_identity()
    
    try:
        # Get the enrollment
        enrollment = Enrollment.query.get(enrollment_id)
        if not enrollment:
            return jsonify({"message": "Enrollment not found"}), 404
        
        # Verify instructor owns this course
        course = Course.query.filter_by(id=enrollment.course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Access denied. You do not own this course."}), 403
        
        # Store info for response
        student_name = enrollment.student.username
        course_title = course.title
        student_id = enrollment.student_id
        course_id = enrollment.course_id
        
        # Import related models that need cleanup
        from ..models.student_models import (
            ModuleProgress, LessonCompletion, 
            UserProgress, StudentNote, StudentBookmark, StudentSuspension, Certificate
        )
        
        # Delete all related records for this enrollment
        # This must be done before deleting the enrollment due to foreign key constraints
        
        # Delete module progress records
        ModuleProgress.query.filter_by(enrollment_id=enrollment_id).delete()
        
        # Delete suspension records if any
        StudentSuspension.query.filter_by(enrollment_id=enrollment_id).delete()
        
        # Delete certificates if any
        Certificate.query.filter_by(enrollment_id=enrollment_id).delete()
        
        # Delete lesson completions for this student in this course
        lesson_ids = db.session.query(Lesson.id).join(Module).filter(Module.course_id == course_id).all()
        lesson_ids = [lid[0] for lid in lesson_ids]
        if lesson_ids:
            LessonCompletion.query.filter(
                LessonCompletion.student_id == student_id,
                LessonCompletion.lesson_id.in_(lesson_ids)
            ).delete(synchronize_session=False)
        
        # Delete user progress for this course
        UserProgress.query.filter_by(user_id=student_id, course_id=course_id).delete()
        
        # Delete student notes for lessons in this course
        if lesson_ids:
            StudentNote.query.filter(
                StudentNote.student_id == student_id,
                StudentNote.lesson_id.in_(lesson_ids)
            ).delete(synchronize_session=False)
        
        # Delete student bookmarks for this course
        StudentBookmark.query.filter_by(student_id=student_id, course_id=course_id).delete()
        
        # Delete submissions for quizzes in this course
        quiz_ids = db.session.query(Quiz.id).join(Module).filter(Module.course_id == course_id).all()
        quiz_ids = [qid[0] for qid in quiz_ids]
        if quiz_ids:
            Submission.query.filter(
                Submission.student_id == student_id,
                Submission.quiz_id.in_(quiz_ids)
            ).delete(synchronize_session=False)
        
        # Now delete the enrollment
        db.session.delete(enrollment)
        db.session.commit()
        
        return jsonify({
            "message": f"Successfully unenrolled {student_name} from {course_title}",
            "success": True
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to unenroll student", "error": str(e)}), 500

# --- Submission and Grading Routes ---
@instructor_bp.route("/submissions/pending", methods=["GET"])
@instructor_required
def get_pending_submissions():
    """Get pending submissions for grading."""
    current_user_id = get_jwt_identity()
    course_id = request.args.get('course_id', type=int)
    
    try:
        # Get instructor's courses
        course_query = Course.query.filter_by(instructor_id=current_user_id)
        if course_id:
            course_query = course_query.filter_by(id=course_id)
        
        courses = course_query.all()
        course_ids = [c.id for c in courses]
        
        # Get quiz IDs for these courses
        quiz_ids = db.session.query(Quiz.id).join(Module).filter(
            Module.course_id.in_(course_ids)
        ).all()
        quiz_ids = [q.id for q in quiz_ids]
        
        # Get pending submissions
        pending_submissions = db.session.query(Submission).filter(
            and_(
                Submission.quiz_id.in_(quiz_ids),
                Submission.grade.is_(None)
            )
        ).all()
        
        submissions_data = []
        for submission in pending_submissions:
            submission_data = submission.to_dict()
            if submission.quiz and submission.quiz.module and submission.quiz.module.course:
                submission_data["course_title"] = submission.quiz.module.course.title
                submission_data["quiz_title"] = submission.quiz.title
            submissions_data.append(submission_data)
        
        return jsonify(submissions_data), 200
        
    except Exception as e:
        return jsonify({"message": "Failed to fetch pending submissions", "error": str(e)}), 500

# --- Student Activity Management Routes ---

@instructor_bp.route("/students/analytics", methods=["GET"])
@instructor_required
def get_student_performance_analytics():
    """Get comprehensive student performance analytics for instructor"""
    current_user_id = get_jwt_identity()
    course_id = request.args.get('course_id', type=int)
    
    try:
        from ..services.analytics_service import AnalyticsService
        
        analytics_data = AnalyticsService.get_instructor_student_analytics(
            instructor_id=current_user_id,
            course_id=course_id
        )
        
        return jsonify(analytics_data), 200
        
    except Exception as e:
        return jsonify({
            "message": "Failed to fetch student analytics", 
            "error": str(e)
        }), 500

@instructor_bp.route("/students/<int:student_id>/modules/<int:module_id>/full-credit", methods=["POST"])
@jwt_required()
@instructor_required
def give_module_full_credit(student_id, module_id):
    """Give full credit to a student for all components of a specific module"""
    current_user_id = get_jwt_identity()
    
    try:
        logger.info(f"Full credit request - Student: {student_id}, Module: {module_id}, Instructor: {current_user_id}")
        
        # Verify instructor owns the course containing this module
        module = Module.query.get(module_id)
        if not module:
            logger.warning(f"Module {module_id} not found")
            return jsonify({"message": "Module not found"}), 404
        
        logger.info(f"Module found: {module.title}, Course ID: {module.course_id}")
        
        course = Course.query.filter_by(id=module.course_id, instructor_id=current_user_id).first()
        if not course:
            logger.warning(f"Instructor {current_user_id} does not own course {module.course_id}")
            return jsonify({"message": "Access denied. You do not own this course."}), 403
        
        logger.info(f"Course access verified: {course.title}")
        
        # Verify student is enrolled in the course
        enrollment = Enrollment.query.filter_by(student_id=student_id, course_id=course.id).first()
        if not enrollment:
            logger.warning(f"Student {student_id} not enrolled in course {course.id}")
            return jsonify({"message": "Student is not enrolled in this course"}), 404
        
        logger.info(f"Student enrollment verified: {enrollment.id}")
        
        # Get optional reason from request body - handle missing Content-Type gracefully
        try:
            request_data = request.get_json(force=True) or {}
        except Exception:
            # If no JSON data or wrong content type, just use empty dict
            request_data = {}
        
        reason = request_data.get('reason', '').strip() or None
        logger.info(f"Full credit reason: {reason}")
        
        # Import and call the FullCreditService
        try:
            from ..services.full_credit_service import FullCreditService
            logger.info("FullCreditService imported successfully")
            
            result = FullCreditService.give_module_full_credit(
                student_id=student_id,
                module_id=module_id,
                instructor_id=current_user_id,
                enrollment_id=enrollment.id
            )
            logger.info(f"FullCreditService result: {result}")
            
        except Exception as service_error:
            logger.error(f"FullCreditService error: {str(service_error)}")
            logger.error(f"Service error traceback:", exc_info=True)
            return jsonify({
                "message": "Failed to award full credit due to service error",
                "error": str(service_error)
            }), 500
        
        if result.get('success'):
            # Send email notification to student
            try:
                from ..utils.email_notifications import send_full_credit_notification
                
                student = User.query.get(student_id)
                instructor = User.query.get(current_user_id)
                
                if student and instructor:
                    email_result = send_full_credit_notification(
                        student=student,
                        module=module,
                        course=course,
                        instructor=instructor,
                        reason=reason,
                        details=result.get('details', {})
                    )
                    logger.info(f"📧 Email notification result: {email_result}")
                    if email_result:
                        logger.info(f"📧 Full credit email notification sent to {student.email}")
                    else:
                        logger.warning(f"📧 Failed to send email notification to {student.email}")
                else:
                    logger.warning(f"Could not send email notification - missing student or instructor data")
            except Exception as email_error:
                # Don't fail the full credit award if email fails
                logger.error(f"Email notification error: {str(email_error)}")
                logger.error(f"Email error traceback:", exc_info=True)
            
            return jsonify({
                "message": f"Full credit awarded to student for module '{module.title}'",
                "success": True,
                "details": result.get('details', {})
            }), 200
        else:
            logger.error(f"FullCreditService returned failure: {result}")
            return jsonify({
                "message": result.get('message', 'Failed to award full credit'),
                "success": False
            }), 400
        
    except Exception as e:
        logger.error(f"Full credit route error: {str(e)}")
        logger.error(f"Full error traceback:", exc_info=True)
        return jsonify({
            "message": "Failed to award full credit", 
            "error": str(e)
        }), 500

@instructor_bp.route("/students/analysis", methods=["GET"])
@instructor_required
def get_student_analysis():
    """Get comprehensive analysis of student activity and progress (async version)"""
    current_user_id = int(get_jwt_identity())
    
    # Check if there's a running or recent task
    task_id = request.args.get('task_id')
    if task_id:
        task_status = background_service.get_task_status(task_id)
        if task_status:
            if task_status['status'] == 'completed':
                return jsonify({
                    "success": True,
                    "analysis": task_status['result']
                }), 200
            elif task_status['status'] == 'failed':
                return jsonify({
                    "success": False,
                    "message": "Analysis failed",
                    "error": task_status['error']
                }), 500
            else:
                return jsonify({
                    "success": True,
                    "status": task_status['status'],
                    "progress": task_status['progress'],
                    "message": "Analysis in progress"
                }), 202
    
    # Create new background task
    try:
        task_id = background_service.create_task(
            _perform_student_analysis,
            current_user_id
        )
        
        return jsonify({
            "success": True,
            "task_id": task_id,
            "status": "started",
            "message": "Analysis started in background",
            "poll_url": f"/api/v1/instructor/students/analysis?task_id={task_id}"
        }), 202
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": "Failed to start analysis",
            "error": str(e)
        }), 500

@instructor_bp.route("/students/inactive", methods=["GET"])
@instructor_required
def get_inactive_students():
    """Get students who are inactive in instructor's courses (async version)"""
    current_user_id = int(get_jwt_identity())
    
    # Check if there's a running or recent task
    task_id = request.args.get('task_id')
    if task_id:
        task_status = background_service.get_task_status(task_id)
        if task_status:
            if task_status['status'] == 'completed':
                return jsonify({
                    "success": True,
                    "inactive_students": task_status['result']['inactive_students'],
                    "threshold_days": task_status['result']['threshold_days'],
                    "total_count": task_status['result']['total_count']
                }), 200
            elif task_status['status'] == 'failed':
                return jsonify({
                    "success": False,
                    "message": "Failed to fetch inactive students",
                    "error": task_status['error']
                }), 500
            else:
                return jsonify({
                    "success": True,
                    "status": task_status['status'],
                    "progress": task_status['progress'],
                    "message": "Fetching inactive students"
                }), 202
    
    # Create new background task
    try:
        threshold_days = request.args.get('threshold_days', 7, type=int)
        
        task_id = background_service.create_task(
            _fetch_inactive_students,
            current_user_id,
            threshold_days
        )
        
        return jsonify({
            "success": True,
            "task_id": task_id,
            "status": "started", 
            "message": "Fetching inactive students in background",
            "poll_url": f"/api/v1/instructor/students/inactive?task_id={task_id}"
        }), 202
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": "Failed to start inactive students fetch",
            "error": str(e)
        }), 500


@instructor_bp.route("/students/analysis/status/<task_id>", methods=["GET"])
@instructor_required
def get_student_analysis_status(task_id):
    """Check status of student analysis background task"""
    try:
        task_status = background_service.get_task_status(task_id)
        if not task_status:
            return jsonify({
                "success": False,
                "message": "Task not found"
            }), 404
        
        if task_status['status'] == 'completed':
            return jsonify({
                "success": True,
                "status": "completed",
                "analysis": task_status['result']
            }), 200
        elif task_status['status'] == 'failed':
            return jsonify({
                "success": False,
                "status": "failed",
                "error": task_status['error']
            }), 500
        else:
            return jsonify({
                "success": True,
                "status": task_status['status'],
                "progress": task_status.get('progress', 0)
            }), 200
            
    except Exception as e:
        return jsonify({
            "success": False,
            "message": "Failed to check task status",
            "error": str(e)
        }), 500


@instructor_bp.route("/students/inactive/status/<task_id>", methods=["GET"])
@instructor_required
def get_inactive_students_status(task_id):
    """Check status of inactive students background task"""
    try:
        task_status = background_service.get_task_status(task_id)
        if not task_status:
            return jsonify({
                "success": False,
                "message": "Task not found"
            }), 404
        
        if task_status['status'] == 'completed':
            return jsonify({
                "success": True,
                "status": "completed",
                "inactive_students": task_status['result']['inactive_students'],
                "threshold_days": task_status['result']['threshold_days'],
                "total_count": task_status['result']['total_count']
            }), 200
        elif task_status['status'] == 'failed':
            return jsonify({
                "success": False,
                "status": "failed",
                "error": task_status['error']
            }), 500
        else:
            return jsonify({
                "success": True,
                "status": task_status['status'],
                "progress": task_status.get('progress', 0)
            }), 200
            
    except Exception as e:
        return jsonify({
            "success": False,
            "message": "Failed to check task status",
            "error": str(e)
        }), 500


def _perform_student_analysis(instructor_id: int):
    """Background task function for student analysis"""
    from ..services.inactivity_service import InactivityService
    from ..services.analytics_service import AnalyticsService
    
    # Get all students in instructor's courses
    courses = Course.query.filter_by(instructor_id=instructor_id).all()
    course_ids = [c.id for c in courses]
    
    if not course_ids:
        return {
            "total_students": 0,
            "active_students": 0,
            "inactive_students": 0,
            "at_risk_students": 0,
            "students_by_course": {},
            "activity_trends": [],
            "recommendations": []
        }
    
    # Get enrollments for instructor's courses
    enrollments = Enrollment.query.filter(
        Enrollment.course_id.in_(course_ids),
        Enrollment.status == 'active'
    ).all()
    
    total_students = len(enrollments)
    
    # Get inactive students (7+ days)
    inactive_students = InactivityService.get_inactive_students(
        instructor_id=instructor_id,
        threshold_days=7
    )
    
    # Get at-risk students (5-6 days inactive)
    at_risk_students = InactivityService.get_inactive_students(
        instructor_id=instructor_id,
        threshold_days=5
    )
    # Filter out already inactive students by student_id
    inactive_student_ids = {s['student_id'] for s in inactive_students}
    at_risk_students = [s for s in at_risk_students if s['student_id'] not in inactive_student_ids]
    
    # Calculate active students
    active_students = total_students - len(inactive_students)
    
    # Group students by course
    students_by_course = {}
    for course in courses:
        course_enrollments = [e for e in enrollments if e.course_id == course.id]
        course_inactive = [s for s in inactive_students if any(
            c['course_id'] == course.id for c in s['enrolled_courses']
        )]
        
        students_by_course[course.title] = {
            'course_id': course.id,
            'total': len(course_enrollments),
            'active': len(course_enrollments) - len(course_inactive),
            'inactive': len(course_inactive),
            'inactive_rate': (len(course_inactive) / len(course_enrollments) * 100) if course_enrollments else 0
        }
    
    # Generate recommendations
    recommendations = []
    if len(inactive_students) > 0:
        recommendations.append({
            'type': 'warning',
            'title': 'Inactive Students Detected',
            'message': f'{len(inactive_students)} students have been inactive for 7+ days',
            'action': 'Consider sending reminders or checking in with these students'
        })
    
    if len(at_risk_students) > 0:
        recommendations.append({
            'type': 'info',
            'title': 'At-Risk Students',
            'message': f'{len(at_risk_students)} students are showing decreased activity',
            'action': 'Proactive engagement may prevent these students from becoming inactive'
        })
    
    if len(inactive_students) / total_students > 0.2 if total_students > 0 else False:
        recommendations.append({
            'type': 'urgent',
            'title': 'High Inactivity Rate',
            'message': 'More than 20% of students are inactive',
            'action': 'Review course content and engagement strategies'
        })
    
    return {
        "total_students": total_students,
        "active_students": active_students,
        "inactive_students": len(inactive_students),
        "at_risk_students": len(at_risk_students),
        "activity_rate": (active_students / total_students * 100) if total_students > 0 else 0,
        "students_by_course": students_by_course,
        "recommendations": recommendations,
        "last_updated": datetime.utcnow().isoformat()
    }

def _fetch_inactive_students(instructor_id: int, threshold_days: int):
    """Background task function for fetching inactive students"""
    from ..services.inactivity_service import InactivityService
    
    # Get inactive students for this instructor
    inactive_students = InactivityService.get_inactive_students(
        instructor_id=instructor_id,
        threshold_days=threshold_days
    )
    
    return {
        "inactive_students": inactive_students,
        "threshold_days": threshold_days,
        "total_count": len(inactive_students)
    }


def _send_warnings_task(instructor_id: int, threshold_days: int):
    """Background task function for sending inactivity warnings"""
    import time
    import logging
    from ..services.inactivity_service import InactivityService
    from ..models.user_models import User  # Import User model in function scope
    
    # Create logger for this task
    logger = logging.getLogger(__name__)
    logger.info(f"Starting _send_warnings_task for instructor {instructor_id}, threshold {threshold_days}")
    
    try:
        # Get at-risk students for this instructor
        at_risk_students = InactivityService.get_inactive_students(
            instructor_id=instructor_id,
            threshold_days=threshold_days
        )
        
        warnings_sent = 0
        total_students = len(at_risk_students)
        
        logger.info(f"Found {total_students} at-risk students for instructor {instructor_id}")
        
        for i, student_data in enumerate(at_risk_students):
            try:
                student = User.query.get(student_data['student_id'])
                if student:
                    InactivityService._send_inactivity_warning(student, student_data)
                    warnings_sent += 1
                    logger.info(f"Sent warning {warnings_sent}/{total_students} to {student.email}")
                else:
                    logger.warning(f"Student with ID {student_data['student_id']} not found")
                
                # Add 30-second delay between emails to avoid server overload
                # Skip delay for the last email
                if i < total_students - 1:
                    logger.info(f"Sent warning {warnings_sent}/{total_students}. Waiting 30 seconds before next email...")
                    time.sleep(30)
                    
            except Exception as e:
                logger.error(f"Failed to send warning to student {student_data['student_id']}: {str(e)}")
        
        result = {
            "warnings_sent": warnings_sent,
            "total_at_risk": len(at_risk_students),
            "threshold_days": threshold_days
        }
        
        logger.info(f"Completed _send_warnings_task. Result: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Error in _send_warnings_task: {str(e)}")
        raise


@instructor_bp.route("/students/<int:student_id>/terminate", methods=["POST"])
@instructor_required
def terminate_student(student_id):
    """Terminate a student from instructor's courses due to inactivity"""
    current_user_id = int(get_jwt_identity())
    
    try:
        from ..services.inactivity_service import InactivityService
        
        data = request.get_json() or {}
        reason = data.get('reason', 'Inactivity')
        
        # Terminate student
        result = InactivityService.terminate_inactive_student(
            student_id=student_id,
            instructor_id=current_user_id,
            reason=reason
        )
        
        if result['success']:
            return jsonify({
                "success": True,
                "message": result['message'],
                "terminated_courses": result['terminated_courses']
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": result['message']
            }), 400
            
    except Exception as e:
        return jsonify({
            "success": False,
            "message": "Failed to terminate student",
            "error": str(e)
        }), 500

@instructor_bp.route("/students/bulk-terminate", methods=["POST"])
@instructor_required
def bulk_terminate_students():
    """Terminate multiple inactive students"""
    current_user_id = int(get_jwt_identity())
    
    try:
        from ..services.inactivity_service import InactivityService
        
        data = request.get_json() or {}
        student_ids = data.get('student_ids', [])
        reason = data.get('reason', 'Bulk inactivity termination')
        
        if not student_ids:
            return jsonify({
                "success": False,
                "message": "No student IDs provided"
            }), 400
        
        results = {
            "successful": [],
            "failed": [],
            "total_requested": len(student_ids)
        }
        
        for student_id in student_ids:
            result = InactivityService.terminate_inactive_student(
                student_id=student_id,
                instructor_id=current_user_id,
                reason=reason
            )
            
            if result['success']:
                results["successful"].append({
                    "student_id": student_id,
                    "terminated_courses": result['terminated_courses']
                })
            else:
                results["failed"].append({
                    "student_id": student_id,
                    "error": result['message']
                })
        
        return jsonify({
            "success": True,
            "message": f"Processed {len(student_ids)} students",
            "results": results
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": "Failed to bulk terminate students",
            "error": str(e)
        }), 500

@instructor_bp.route("/students/send-warnings", methods=["POST"])
@instructor_required
def send_inactivity_warnings():
    """Send inactivity warnings to at-risk students (async version)"""
    current_user_id = int(get_jwt_identity())
    
    try:
        data = request.get_json() or {}
        threshold_days = data.get('threshold_days', 5)  # Warn students inactive for 5+ days
        
        logger.info(f"Starting warning email task for instructor {current_user_id}, threshold: {threshold_days} days")
        
        # Start background task
        task_id = background_service.create_task(
            _send_warnings_task,
            current_user_id,
            threshold_days
        )
        
        logger.info(f"Created warning email task with ID: {task_id}")
        
        return jsonify({
            "success": True,
            "task_id": task_id,
            "status": "started",
            "message": "Warning emails are being sent in background",
            "poll_url": f"/api/v1/instructor/students/send-warnings/status/{task_id}"
        }), 202
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": "Failed to start warning process",
            "error": str(e)
        }), 500


@instructor_bp.route("/students/send-warnings/status/<task_id>", methods=["GET"])
@instructor_required
def get_send_warnings_status(task_id):
    """Check status of send warnings background task"""
    logger.info(f"Checking status for warning task {task_id}")
    try:
        task_status = background_service.get_task_status(task_id)
        if not task_status:
            logger.warning(f"Warning task {task_id} not found")
            return jsonify({
                "success": False,
                "message": "Task not found",
                "task_id": task_id
            }), 404
        
        if task_status['status'] == 'completed':
            return jsonify({
                "success": True,
                "status": "completed",
                "warnings_sent": task_status['result']['warnings_sent'],
                "total_at_risk": task_status['result']['total_at_risk'],
                "message": f"Sent {task_status['result']['warnings_sent']} warning emails"
            }), 200
        elif task_status['status'] == 'failed':
            return jsonify({
                "success": False,
                "status": "failed",
                "error": task_status['error']
            }), 500
        else:
            return jsonify({
                "success": True,
                "status": task_status['status'],
                "progress": task_status.get('progress', 0)
            }), 200
            
    except Exception as e:
        return jsonify({
            "success": False,
            "message": "Failed to check task status",
            "error": str(e)
        }), 500
@instructor_bp.route("/debug/tasks", methods=["GET"])
@instructor_required
def debug_tasks():
    """Debug endpoint to list all active background tasks"""
    try:
        # Get all tasks from background service for debugging
        with background_service._lock:
            all_tasks = {}
            for task_id, task_info in background_service._tasks.items():
                all_tasks[task_id] = {
                    "id": task_id,
                    "status": task_info["status"],
                    "created_at": task_info["created_at"].isoformat() if task_info["created_at"] else None,
                    "started_at": task_info["started_at"].isoformat() if task_info["started_at"] else None,
                    "completed_at": task_info["completed_at"].isoformat() if task_info["completed_at"] else None,
                    "progress": task_info.get("progress", 0)
                }
        
        return jsonify({
            "success": True,
            "total_tasks": len(all_tasks),
            "tasks": all_tasks
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting debug tasks: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to get debug tasks",
            "error": str(e)
        }), 500@instructor_bp.route("/debug/test-task", methods=["POST"])
@instructor_required
def test_background_task():
    """Test endpoint to verify background task system is working"""
    def simple_test_task(test_value):
        import time
        time.sleep(2)  # Simple 2-second delay
        return {"test_result": f"Task completed with value: {test_value}"}
    
    try:
        task_id = background_service.create_task(simple_test_task, "test123")
        
        return jsonify({
            "success": True,
            "task_id": task_id,
            "message": "Test task created",
            "poll_url": f"/api/v1/instructor/debug/test-task/status/{task_id}"
        }), 202
        
    except Exception as e:
        logger.error(f"Error creating test task: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to create test task",
            "error": str(e)
        }), 500


@instructor_bp.route("/debug/test-task/status/<task_id>", methods=["GET"])
@instructor_required
def get_test_task_status(task_id):
    """Check status of test background task"""
    try:
        task_status = background_service.get_task_status(task_id)
        
        if not task_status:
            return jsonify({
                "success": False,
                "message": "Test task not found",
                "task_id": task_id
            }), 404
        
        return jsonify({
            "success": True,
            "task_id": task_id,
            "status": task_status['status'],
            "progress": task_status.get('progress', 0),
            "result": task_status.get('result'),
            "error": task_status.get('error'),
            "created_at": task_status["created_at"].isoformat() if task_status["created_at"] else None,
            "started_at": task_status["started_at"].isoformat() if task_status["started_at"] else None,
            "completed_at": task_status["completed_at"].isoformat() if task_status["completed_at"] else None
        }), 200
        
    except Exception as e:
        logger.error(f"Error checking test task status: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to check test task status",
            "error": str(e)
        }), 500

@instructor_bp.route("/courses/<int:course_id>/students", methods=["GET"])
@jwt_required()
@instructor_required
def get_enrolled_students(course_id):
    """Get all students enrolled in a specific course"""
    try:
        instructor_id = get_jwt_identity()
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=instructor_id).first()
        if not course:
            return jsonify({"error": "Course not found or access denied"}), 404
        
        # Get all enrollments for this course
        enrollments = Enrollment.query.filter_by(course_id=course_id, status='active').all()
        
        students = []
        for enrollment in enrollments:
            user = User.query.get(enrollment.student_id)
            if user:
                students.append({
                    "id": user.id,
                    "name": f"{user.first_name} {user.last_name}".strip() or user.username,
                    "email": user.email,
                    "enrollment_date": enrollment.enrollment_date.isoformat() if enrollment.enrollment_date else None,
                    "progress": getattr(enrollment, 'progress', 0) or 0
                })
        
        return jsonify(students), 200
        
    except Exception as e:
        current_app.logger.error(f"Error getting course students: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@instructor_bp.route("/courses/<int:course_id>/modules", methods=["GET"])
@jwt_required()
@instructor_required
def get_course_module_list(course_id):
    """Get all modules for a specific course"""
    try:
        instructor_id = get_jwt_identity()
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=instructor_id).first()
        if not course:
            return jsonify({"error": "Course not found or access denied"}), 404
        
        # Get all modules for this course
        modules = Module.query.filter_by(course_id=course_id).order_by(Module.order).all()
        
        module_list = []
        for module in modules:
            # Count components
            lessons_count = Lesson.query.filter_by(module_id=module.id).count()
            quizzes_count = Quiz.query.filter_by(module_id=module.id).count()
            assignments_count = Assignment.query.filter_by(module_id=module.id).count()
            
            module_list.append({
                "id": module.id,
                "title": module.title,
                "description": module.description,
                "order": module.order,
                "lessons_count": lessons_count,
                "quizzes_count": quizzes_count,
                "assignments_count": assignments_count,
                "total_components": lessons_count + quizzes_count + assignments_count
            })
        
        return jsonify(module_list), 200
        
    except Exception as e:
        current_app.logger.error(f"Error getting course modules: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@instructor_bp.route("/modules/<int:module_id>/components", methods=["GET"])
@jwt_required()
@instructor_required
def get_module_component_summary(module_id):
    """Get summary of components in a module"""
    try:
        instructor_id = get_jwt_identity()
        
        # Get module and verify instructor ownership
        module = Module.query.get_or_404(module_id)
        course = Course.query.get_or_404(module.course_id)
        
        # Debug logging
        logger.info(f"Module access check - Module {module_id}: '{module.title}'")
        logger.info(f"  Course {course.id}: '{course.title}'")
        logger.info(f"  Course instructor_id: {course.instructor_id} (type: {type(course.instructor_id)})")
        logger.info(f"  Current instructor_id: {instructor_id} (type: {type(instructor_id)})")
        logger.info(f"  Match: {course.instructor_id == instructor_id}")
        
        # Ensure integer comparison
        if int(course.instructor_id) != int(instructor_id):
            logger.warning(f"Authorization failed: course instructor {course.instructor_id} != current instructor {instructor_id}")
            return jsonify({"error": "Not authorized to access this module"}), 403
        
        # Get components summary
        from ..services.full_credit_service import FullCreditService
        summary = FullCreditService.get_module_components_summary(module_id)
        
        logger.info(f"Module components summary generated successfully for module {module_id}")
        return jsonify(summary), 200
        
    except Exception as e:
        logger.error(f"Error getting module components: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500