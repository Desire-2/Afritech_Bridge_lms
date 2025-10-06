# Learning Routes - My Learning page API endpoints
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps

from ..models.user_models import User
from ..models.course_models import Course, Module, Enrollment
from ..models.student_models import ModuleProgress, AssessmentAttempt
from ..services.dashboard_service import DashboardService
from ..services.progression_service import ProgressionService

# Helper decorator for student access
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

learning_bp = Blueprint("student_learning", __name__, url_prefix="/api/v1/student/learning")

@learning_bp.route("/", methods=["GET"])
@student_required
def get_my_learning():
    """Get My Learning page data"""
    try:
        student_id = int(get_jwt_identity())
        learning_data = DashboardService.get_my_learning_page(student_id)
        
        if "error" in learning_data:
            return jsonify({"error": learning_data["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": learning_data
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load learning data"
        }), 500

@learning_bp.route("/active-courses", methods=["GET"])
@student_required
def get_active_courses():
    """Get active courses for student"""
    try:
        student_id = int(get_jwt_identity())
        learning_data = DashboardService.get_my_learning_page(student_id)
        
        if "error" in learning_data:
            return jsonify({"error": learning_data["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": {
                "active_courses": learning_data["active_courses"],
                "course_stats": learning_data["course_stats"]
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load active courses"
        }), 500

@learning_bp.route("/completed-courses", methods=["GET"])
@student_required
def get_completed_courses():
    """Get completed courses for student"""
    try:
        student_id = int(get_jwt_identity())
        learning_data = DashboardService.get_my_learning_page(student_id)
        
        if "error" in learning_data:
            return jsonify({"error": learning_data["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": {
                "completed_courses": learning_data["completed_courses"],
                "course_stats": learning_data["course_stats"]
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load completed courses"
        }), 500

@learning_bp.route("/continue-learning", methods=["GET"])
@student_required
def get_continue_learning():
    """Get continue learning recommendations"""
    try:
        student_id = int(get_jwt_identity())
        learning_data = DashboardService.get_my_learning_page(student_id)
        
        if "error" in learning_data:
            return jsonify({"error": learning_data["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": {
                "continue_learning": learning_data["continue_learning"],
                "current_focus": learning_data["current_focus"],
                "next_lessons": learning_data["next_lessons"]
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load continue learning data"
        }), 500

@learning_bp.route("/course/<int:course_id>/progress", methods=["GET"])
@student_required
def get_course_progress(course_id):
    """Get detailed progress for a specific course"""
    try:
        student_id = int(get_jwt_identity())
        progress_data = ProgressionService.get_student_course_progress(student_id, course_id)
        
        if "error" in progress_data:
            return jsonify({"error": progress_data["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": progress_data
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load course progress"
        }), 500

@learning_bp.route("/lesson/<int:lesson_id>/complete", methods=["POST"])
@student_required
def complete_lesson(lesson_id):
    """Mark a lesson as completed"""
    try:
        student_id = int(get_jwt_identity())
        data = request.get_json() or {}
        time_spent = data.get('time_spent', 0)
        
        success, message, completion_data = ProgressionService.complete_lesson(
            student_id, lesson_id, time_spent
        )
        
        if success:
            return jsonify({
                "success": True,
                "message": message,
                "data": completion_data
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": message
            }), 400
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to complete lesson"
        }), 500

@learning_bp.route("/next-lessons", methods=["GET"])
@student_required
def get_next_lessons():
    """Get next lessons across all courses"""
    try:
        student_id = int(get_jwt_identity())
        limit = request.args.get('limit', 10, type=int)
        
        learning_data = DashboardService.get_my_learning_page(student_id)
        
        if "error" in learning_data:
            return jsonify({"error": learning_data["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": {
                "next_lessons": learning_data["next_lessons"][:limit]
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load next lessons"
        }), 500

@learning_bp.route("/courses/<int:course_id>", methods=["GET"])
@student_required
def get_course_for_learning(course_id):
    """Get course details with student-specific learning data"""
    try:
        student_id = int(get_jwt_identity())
        
        # Import course models here to avoid circular imports
        from ..models.course_models import Course, Enrollment
        
        # Get course and check enrollment
        course = Course.query.get(course_id)
        if not course:
            return jsonify({"error": "Course not found"}), 404
        
        if not course.is_published:
            return jsonify({"error": "Course is not available"}), 404
        
        # Check if student is enrolled
        enrollment = Enrollment.query.filter_by(
            student_id=student_id,
            course_id=course_id
        ).first()
        
        if not enrollment:
            return jsonify({"error": "Not enrolled in this course"}), 403
        
        # Get course progress data
        try:
            progress_data = ProgressionService.get_student_course_progress(student_id, course_id)
            
            if "error" in progress_data:
                # If progression service fails, create basic progress data
                progress_data = {
                    "overall_progress": 0,
                    "current_module": None,
                    "modules": []
                }
        except Exception as e:
            print(f"ProgressionService error: {str(e)}")
            progress_data = {
                "overall_progress": 0,
                "current_module": None,
                "modules": []
            }
        
        # Format course data for learning interface
        try:
            course_data = course.to_dict(include_modules=True)
        except Exception as e:
            print(f"Error converting course to dict: {str(e)}")
            # Fallback to basic course data
            course_data = {
                "id": course.id,
                "title": course.title,
                "description": course.description,
                "modules": []
            }
        
        # Find current lesson based on progress
        current_lesson = None
        if progress_data.get("current_module") and progress_data["current_module"].get("current_lesson"):
            current_lesson = progress_data["current_module"]["current_lesson"]
        elif course_data.get("modules") and len(course_data["modules"]) > 0:
            # Fallback to first lesson of first module
            first_module = course_data["modules"][0]
            if first_module.get("lessons") and len(first_module["lessons"]) > 0:
                current_lesson = first_module["lessons"][0]
        
        return jsonify({
            "success": True,
            "course": course_data,
            "current_lesson": current_lesson,
            "progress": progress_data,
            "enrollment": {
                "enrolled_at": enrollment.enrollment_date.isoformat() if enrollment.enrollment_date else None,
                "completion_date": enrollment.completed_at.isoformat() if enrollment.completed_at else None,
                "is_completed": enrollment.completed_at is not None
            }
        }), 200
        
    except Exception as e:
        print(f"Error in get_course_for_learning: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to load course for learning"
        }), 500

@learning_bp.route("/learning-path/<int:course_id>", methods=["GET"])
@student_required
def get_learning_path(course_id):
    """Get learning path with module progression for a course"""
    try:
        student_id = int(get_jwt_identity())
        progress_data = ProgressionService.get_student_course_progress(student_id, course_id)
        
        if "error" in progress_data:
            return jsonify({"error": progress_data["error"]}), 400
        
        # Format for learning path visualization
        learning_path = {
            "course": progress_data["course"],
            "overall_progress": progress_data["overall_progress"],
            "current_module": progress_data["current_module"],
            "modules": []
        }
        
        for module_data in progress_data["modules"]:
            path_module = {
                "module": module_data["module"],
                "progress": module_data["progress"],
                "status": module_data["progress"]["status"],
                "lessons": module_data["lessons_completed"],
                "can_access": module_data["progress"]["status"] != "locked"
            }
            learning_path["modules"].append(path_module)
        
        return jsonify({
            "success": True,
            "data": learning_path
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load learning path"
        }), 500

@learning_bp.route("/course/<int:course_id>/modules", methods=["GET"])
@student_required
def get_course_modules(course_id):
    """Get all modules for a course with student progress"""
    try:
        student_id = int(get_jwt_identity())
        
        # Check enrollment
        enrollment = Enrollment.query.filter_by(
            student_id=student_id,
            course_id=course_id
        ).first()
        
        if not enrollment:
            return jsonify({"error": "Not enrolled in this course"}), 403
        
        # Get course and modules
        course = Course.query.get(course_id)
        if not course:
            return jsonify({"error": "Course not found"}), 404
        
        modules = course.modules.order_by(Module.order).all()
        
        # Get progress for each module
        modules_data = []
        for module in modules:
            module_progress = ModuleProgress.query.filter_by(
                student_id=student_id,
                module_id=module.id,
                enrollment_id=enrollment.id
            ).first()
            
            if not module_progress:
                # Initialize if missing
                module_progress = ProgressionService._initialize_module_progress(
                    student_id, module.id, enrollment.id
                )
            
            # Get assessment attempts for this module
            attempts = AssessmentAttempt.query.filter_by(
                student_id=student_id,
                module_id=module.id
            ).all()
            
            module_data = {
                "module": module.to_dict(include_lessons=True),
                "progress": module_progress.to_dict(),
                "assessment_attempts": [attempt.to_dict() for attempt in attempts],
                "can_retake": module_progress.status == 'failed' and module_progress.attempts_count < module_progress.max_attempts
            }
            
            modules_data.append(module_data)
        
        # Get suspension status
        suspension_status = ProgressionService.check_student_suspension_status(student_id, course_id)
        
        return jsonify({
            "success": True,
            "data": {
                "course": course.to_dict(),
                "modules": modules_data,
                "suspension_status": suspension_status
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load course modules"
        }), 500

@learning_bp.route("/module/<int:module_id>/retake", methods=["POST"])
@student_required
def retake_module(module_id):
    """Allow student to retake a failed module"""
    try:
        student_id = int(get_jwt_identity())
        
        # Get module and enrollment
        module = Module.query.get(module_id)
        if not module:
            return jsonify({"error": "Module not found"}), 404
        
        enrollment = Enrollment.query.filter_by(
            student_id=student_id,
            course_id=module.course_id
        ).first()
        
        if not enrollment:
            return jsonify({"error": "Not enrolled in this course"}), 403
        
        # Check suspension status
        suspension_status = ProgressionService.check_student_suspension_status(student_id, module.course_id)
        if suspension_status["is_suspended"]:
            return jsonify({
                "error": "Cannot retake module - you are suspended from this course",
                "suspension_details": suspension_status["suspension_details"]
            }), 403
        
        # Attempt retake
        success, message = ProgressionService.attempt_module_retake(
            student_id, module_id, enrollment.id
        )
        
        if success:
            return jsonify({
                "success": True,
                "message": message
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": message
            }), 400
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to initiate module retake"
        }), 500

@learning_bp.route("/module/<int:module_id>/check-completion", methods=["POST"])
@student_required
def check_module_completion(module_id):
    """Check if module can be marked as completed"""
    try:
        student_id = int(get_jwt_identity())
        
        # Get module and enrollment
        module = Module.query.get(module_id)
        if not module:
            return jsonify({"error": "Module not found"}), 404
        
        enrollment = Enrollment.query.filter_by(
            student_id=student_id,
            course_id=module.course_id
        ).first()
        
        if not enrollment:
            return jsonify({"error": "Not enrolled in this course"}), 403
        
        # Check completion
        can_complete, message = ProgressionService.check_module_completion(
            student_id, module_id, enrollment.id
        )
        
        if can_complete:
            return jsonify({
                "success": True,
                "message": message,
                "module_completed": True
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": message,
                "module_completed": False
            }), 200  # Not an error, just didn't meet requirements
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to check module completion"
        }), 500

@learning_bp.route("/course/<int:course_id>/suspension-status", methods=["GET"])
@student_required
def get_suspension_status(course_id):
    """Get suspension status for a course"""
    try:
        student_id = int(get_jwt_identity())
        
        suspension_status = ProgressionService.check_student_suspension_status(student_id, course_id)
        
        return jsonify({
            "success": True,
            "data": suspension_status
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to check suspension status"
        }), 500

@learning_bp.route("/course/<int:course_id>/submit-appeal", methods=["POST"])
@student_required
def submit_suspension_appeal(course_id):
    """Submit an appeal for course suspension"""
    try:
        student_id = int(get_jwt_identity())
        data = request.get_json()
        
        if not data or 'appeal_text' not in data:
            return jsonify({"error": "Appeal text is required"}), 400
        
        appeal_text = data['appeal_text'].strip()
        if not appeal_text:
            return jsonify({"error": "Appeal text cannot be empty"}), 400
        
        success, message = ProgressionService.submit_appeal(
            student_id, course_id, appeal_text
        )
        
        if success:
            return jsonify({
                "success": True,
                "message": message
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": message
            }), 400
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to submit appeal"
        }), 500