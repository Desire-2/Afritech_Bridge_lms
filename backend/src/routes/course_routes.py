# Course Management API Routes for Afritec Bridge LMS

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

# Assuming db and models are correctly set up and accessible.
from ..models.user_models import db, User, Role # For role checking
from ..models.course_models import Course, Module, Lesson, Enrollment, Quiz, Question, Answer, Submission, Announcement
from ..utils.email_notifications import send_announcement_notification

# Helper for role checking (decorator)
from functools import wraps
import logging

logger = logging.getLogger(__name__)

def get_user_id():
    """Helper function to get user ID as integer from JWT"""
    try:
        user_id = get_jwt_identity()
        return int(user_id) if user_id is not None else None
    except (ValueError, TypeError) as e:
        logger.error(f"ERROR in get_user_id: {e}")
        return None

def role_required(roles):
    def decorator(f):
        @wraps(f)
        @jwt_required()
        def decorated_function(*args, **kwargs):
            current_user_id = get_user_id()
            user = User.query.get(current_user_id)
            if not user or not user.role or user.role.name not in roles:
                return jsonify({"message": "User does not have the required role(s)"}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

course_bp = Blueprint("course_bp", __name__, url_prefix=
"/api/v1/courses")
module_bp = Blueprint("module_bp", __name__, url_prefix="/api/v1/modules")
lesson_bp = Blueprint("lesson_bp", __name__, url_prefix="/api/v1/lessons")
enrollment_bp = Blueprint("enrollment_bp", __name__, url_prefix="/api/v1/enrollments")
quiz_bp = Blueprint("quiz_bp", __name__, url_prefix="/api/v1/quizzes")
submission_bp = Blueprint("submission_bp", __name__, url_prefix="/api/v1/submissions")
announcement_bp = Blueprint("announcement_bp", __name__, url_prefix="/api/v1/announcements")

# --- Course Routes ---
@course_bp.route("", methods=["POST"])
@role_required(["admin", "instructor"])
def create_course():
    try:
        data = request.get_json()
        logger.info(f"[CREATE_COURSE] Received data: {data}")
        
        current_user_id = get_user_id()  # Ensure integer
        logger.info(f"[CREATE_COURSE] Current user ID: {current_user_id}")
        
        user = User.query.get(current_user_id)
        if not user:
            logger.error(f"[CREATE_COURSE] User not found for ID: {current_user_id}")
            return jsonify({"message": "User not found"}), 404
        
        logger.info(f"[CREATE_COURSE] User role: {user.role.name}")

        # Ensure instructor_id is the current user if they are an instructor, or allow admin to set it
        instructor_id_to_set = current_user_id
        if user.role.name == "admin" and data.get("instructor_id"):
            if User.query.get(int(data.get("instructor_id"))):  # Ensure integer
                instructor_id_to_set = int(data.get("instructor_id"))
            else:
                logger.error(f"[CREATE_COURSE] Specified instructor_id not found: {data.get('instructor_id')}")
                return jsonify({"message": "Specified instructor_id not found"}), 400

        logger.info(f"[CREATE_COURSE] Creating course with instructor_id: {instructor_id_to_set}")
        
        # Validate required fields
        if not data.get("title"):
            logger.error("[CREATE_COURSE] Missing required field: title")
            return jsonify({"message": "Missing required field: title"}), 400
        if not data.get("description"):
            logger.error("[CREATE_COURSE] Missing required field: description")
            return jsonify({"message": "Missing required field: description"}), 400
        
        # Check for duplicate title
        existing_course = Course.query.filter_by(title=data["title"]).first()
        if existing_course:
            logger.error(f"[CREATE_COURSE] Course with title '{data['title']}' already exists")
            return jsonify({
                "message": "A course with this title already exists. Please choose a different title.",
                "existing_course_id": existing_course.id
            }), 409  # 409 Conflict

        enrollment_type = data.get("enrollment_type", "free")
        price = data.get("price")
        currency = data.get("currency", "USD")

        if enrollment_type == "paid":
            try:
                if price is None or float(price) <= 0:
                    return jsonify({"message": "Paid courses must have a price greater than 0"}), 400
            except (TypeError, ValueError):
                return jsonify({"message": "Price must be a valid number"}), 400
        
        new_course = Course(
            title=data["title"],
            description=data["description"],
            learning_objectives=data.get("learning_objectives"),
            target_audience=data.get("target_audience"),
            estimated_duration=data.get("estimated_duration"),
            instructor_id=instructor_id_to_set,
            is_published=data.get("is_published", False),
            enrollment_type=enrollment_type,
            price=price,
            currency=currency
        )
        logger.info(f"[CREATE_COURSE] Course object created: {new_course.title}")
        
        db.session.add(new_course)
        logger.info("[CREATE_COURSE] Course added to session")
        
        db.session.commit()
        logger.info(f"[CREATE_COURSE] Course committed with ID: {new_course.id}")
        
        return jsonify(new_course.to_dict()), 201
        
    except KeyError as e:
        logger.error(f"[CREATE_COURSE] KeyError - Missing field: {e}")
        return jsonify({"message": f"Missing field: {e}"}), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"[CREATE_COURSE] Exception occurred: {str(e)}")
        logger.error(f"[CREATE_COURSE] Exception type: {type(e).__name__}")
        import traceback
        logger.error(f"[CREATE_COURSE] Traceback: {traceback.format_exc()}")
        
        # Handle specific database errors
        error_message = str(e)
        if "duplicate key value violates unique constraint" in error_message.lower():
            if "courses_title_key" in error_message:
                return jsonify({
                    "message": "A course with this title already exists. Please choose a different title."
                }), 409
        
        return jsonify({"message": "Could not create course", "error": str(e)}), 500

@course_bp.route("", methods=["GET"])
def get_courses():
    # Add pagination and filtering later
    courses = Course.query.filter_by(is_published=True).all()
    return jsonify([course.to_dict() for course in courses]), 200

@course_bp.route("/all", methods=["GET"])
@role_required(["admin", "instructor"])
def get_all_courses_admin(): # Endpoint for admins/instructors to see all courses (published/unpublished)
    courses = Course.query.all()
    return jsonify([course.to_dict() for course in courses]), 200

@course_bp.route("/<int:course_id>", methods=["GET"])
def get_course(course_id):
    course = Course.query.get_or_404(course_id)
    is_instructor_or_admin = False
    
    try:
        current_user_id = get_user_id()
        user = User.query.get(current_user_id)
        if user and (user.role.name == "admin" or (user.role.name == "instructor" and course.instructor_id == user.id)):
            is_instructor_or_admin = True
    except Exception:
        pass  # Anonymous user or no JWT
    
    if not course.is_published and not is_instructor_or_admin:
        return jsonify({"message": "Course not found or not published"}), 404

    # For students, filter modules based on release settings; instructors see all
    return jsonify(course.to_dict(include_modules=True, for_student=not is_instructor_or_admin)), 200

@course_bp.route("/<int:course_id>", methods=["PUT"])
@role_required(["admin", "instructor"])
def update_course(course_id):
    course = Course.query.get_or_404(course_id)
    current_user_id = get_user_id()  # Ensure integer comparison
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to update this course"}), 403

    data = request.get_json()
    try:
        course.title = data.get("title", course.title)
        course.description = data.get("description", course.description)
        course.learning_objectives = data.get("learning_objectives", course.learning_objectives)
        course.target_audience = data.get("target_audience", course.target_audience)
        course.estimated_duration = data.get("estimated_duration", course.estimated_duration)
        course.is_published = data.get("is_published", course.is_published)

        # Payment & Enrollment settings
        if "enrollment_type" in data:
            enrollment_type = data.get("enrollment_type")
            if enrollment_type not in ["free", "paid", "scholarship"]:
                return jsonify({"message": "Invalid enrollment_type. Use free, paid, or scholarship."}), 400
            course.enrollment_type = enrollment_type

        if "price" in data:
            try:
                course.price = float(data["price"]) if data["price"] is not None else None
            except (TypeError, ValueError):
                return jsonify({"message": "Price must be a valid number"}), 400

        if "currency" in data:
            course.currency = data.get("currency") or course.currency

        if course.enrollment_type == "paid":
            if course.price is None or course.price <= 0:
                return jsonify({"message": "Paid courses must have a price greater than 0"}), 400
        
        # Module release settings
        if "start_date" in data:
            from datetime import datetime
            if data["start_date"]:
                course.start_date = datetime.fromisoformat(data["start_date"].replace('Z', '+00:00'))
            else:
                course.start_date = None
        
        if "module_release_count" in data:
            course.module_release_count = data["module_release_count"]
        
        if "module_release_interval" in data:
            course.module_release_interval = data["module_release_interval"]
        
        if "module_release_interval_days" in data:
            course.module_release_interval_days = data["module_release_interval_days"]
        
        # Admin can change instructor, instructor cannot
        if user.role.name == "admin" and "instructor_id" in data:
            if User.query.get(data["instructor_id"]):
                course.instructor_id = data["instructor_id"]
            else:
                 return jsonify({"message": "Specified instructor_id not found"}), 400

        db.session.commit()
        return jsonify(course.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not update course", "error": str(e)}), 500

@course_bp.route("/<int:course_id>", methods=["DELETE"])
@role_required(["admin", "instructor"])
def delete_course(course_id):
    course = Course.query.get_or_404(course_id)
    current_user_id = get_user_id()
    
    if current_user_id is None:
        logger.error("Could not extract user ID from JWT token")
        return jsonify({"message": "Authentication error"}), 401
    
    user = User.query.get(current_user_id)

    # Log for debugging
    logger.info(f"Delete course check: course.instructor_id={course.instructor_id} (type: {type(course.instructor_id)}), current_user_id={current_user_id} (type: {type(current_user_id)})")
    
    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        logger.warning(f"User {current_user_id} attempted to delete course {course_id} owned by instructor {course.instructor_id}")
        return jsonify({
            "message": "Forbidden. You do not have permission to perform this action.",
            "error_type": "authorization_error",
            "details": {
                "course_id": course_id,
                "required_instructor_id": course.instructor_id,
                "your_user_id": current_user_id
            }
        }), 403

    try:
        db.session.delete(course)
        db.session.commit()
        logger.info(f"Course {course_id} deleted successfully by user {current_user_id}")
        return jsonify({"message": "Course deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting course {course_id}: {str(e)}", exc_info=True)
        return jsonify({"message": "Could not delete course", "error": str(e)}), 500

@course_bp.route("/<int:course_id>/publish", methods=["POST", "PATCH"])
@role_required(["admin", "instructor"])
def publish_course(course_id):
    course = Course.query.get_or_404(course_id)
    current_user_id = get_user_id()  # Ensure integer comparison
    user = User.query.get(current_user_id)
    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "Not authorized"}), 403
    course.is_published = True
    db.session.commit()
    return jsonify({"message": "Course published", "course": course.to_dict()}), 200

@course_bp.route("/<int:course_id>/unpublish", methods=["POST", "PATCH"])
@role_required(["admin", "instructor"])
def unpublish_course(course_id):
    course = Course.query.get_or_404(course_id)
    current_user_id = get_user_id()  # Ensure integer comparison
    user = User.query.get(current_user_id)
    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "Not authorized"}), 403
    course.is_published = False
    db.session.commit()
    return jsonify({"message": "Course unpublished", "course": course.to_dict()}), 200

@course_bp.route("/<int:course_id>/module-release-status", methods=["GET"])
@role_required(["admin", "instructor"])
def get_module_release_status(course_id):
    """Get the module release status for instructor dashboard."""
    course = Course.query.get_or_404(course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to view this course"}), 403

    all_modules = list(course.modules.order_by(Module.order).all())
    released_modules = course.get_released_modules()
    released_module_ids = [m.id for m in released_modules]
    
    modules_status = []
    for module in all_modules:
        is_auto_released = module.id in released_module_ids and not module.is_released
        modules_status.append({
            'id': module.id,
            'title': module.title,
            'order': module.order,
            'is_released': module.id in released_module_ids,
            'is_manually_released': module.is_released,
            'is_auto_released': is_auto_released,
            'released_at': module.released_at.isoformat() if module.released_at else None,
            'lesson_count': module.lessons.count()
        })
    
    return jsonify({
        'course_id': course_id,
        'start_date': course.start_date.isoformat() if course.start_date else None,
        'module_release_count': course.module_release_count,
        'module_release_interval': course.module_release_interval,
        'module_release_interval_days': course.module_release_interval_days,
        'total_modules': len(all_modules),
        'released_modules_count': len(released_modules),
        'modules': modules_status
    }), 200

@course_bp.route("/<int:course_id>/module-release-settings", methods=["PUT", "PATCH"])
@role_required(["admin", "instructor"])
def update_module_release_settings(course_id):
    """Update module release settings for a course."""
    from datetime import datetime
    
    course = Course.query.get_or_404(course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to update this course"}), 403

    data = request.get_json()
    try:
        if "start_date" in data:
            if data["start_date"]:
                course.start_date = datetime.fromisoformat(data["start_date"].replace('Z', '+00:00'))
            else:
                course.start_date = None
        
        if "module_release_count" in data:
            course.module_release_count = data["module_release_count"]
        
        if "module_release_interval" in data:
            course.module_release_interval = data["module_release_interval"]
        
        if "module_release_interval_days" in data:
            course.module_release_interval_days = data["module_release_interval_days"]

        db.session.commit()
        logger.info(f"Module release settings updated for course {course_id} by user {current_user_id}")
        return jsonify({
            "message": "Module release settings updated",
            "course": course.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not update settings", "error": str(e)}), 500

@course_bp.route("/<int:course_id>/instructor-details", methods=["GET"])
@role_required(["admin", "instructor"])
def get_course_instructor_details(course_id):
    course = Course.query.get_or_404(course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to view details for this course"}), 403

    # Get enrolled students with progress
    enrollments = Enrollment.query.filter_by(course_id=course_id).all()
    enrolled_students = []
    for enrollment in enrollments:
        student_data = {
            'id': enrollment.student.id,
            'name': f"{enrollment.student.first_name} {enrollment.student.last_name}",
            'username': enrollment.student.username,
            'progress': enrollment.progress * 100,  # Convert to percentage
            'enrollment_date': enrollment.enrollment_date.isoformat(),
            'completed_at': enrollment.completed_at.isoformat() if enrollment.completed_at else None
        }
        enrolled_students.append(student_data)

    # Get course data with modules and announcements
    course_data = course.to_dict(include_modules=True, include_announcements=True)
    course_data['enrolled_students'] = enrolled_students
    course_data['enrollment_count'] = len(enrolled_students)

    return jsonify(course_data), 200

# --- Module Routes (nested under courses for creation) ---
@course_bp.route("/<int:course_id>/modules", methods=["POST"])
@role_required(["admin", "instructor"])
def create_module_for_course(course_id):
    course = Course.query.get_or_404(course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to add modules to this course"}), 403

    data = request.get_json()
    try:
        new_module = Module(
            title=data["title"],
            description=data.get("description"),
            course_id=course_id,
            order=data.get("order", 0)
        )
        db.session.add(new_module)
        db.session.commit()
        return jsonify(new_module.to_dict()), 201
    except KeyError as e:
        return jsonify({"message": f"Missing field: {e}"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not create module", "error": str(e)}), 500

@course_bp.route("/<int:course_id>/modules", methods=["GET"])
# Publicly accessible if course is published, or if user is admin/instructor
def get_modules_for_course(course_id):
    course = Course.query.get_or_404(course_id)
    is_instructor_or_admin = False
    
    try:
        current_user_id = get_user_id()
        user = User.query.get(current_user_id)
        if user and (user.role.name == "admin" or (user.role.name == "instructor" and course.instructor_id == user.id)):
            is_instructor_or_admin = True
    except Exception:
        pass  # Anonymous user or no JWT
    
    if not course.is_published and not is_instructor_or_admin:
        return jsonify({"message": "Course not found or not published"}), 404

    # For students, return only released modules; for instructors, return all
    if is_instructor_or_admin:
        modules = Module.query.filter_by(course_id=course_id).order_by(Module.order).all()
    else:
        modules = course.get_released_modules()
    
    result = [module.to_dict() for module in modules]
    
    # Add metadata for students about total vs released modules
    if not is_instructor_or_admin:
        all_modules = Module.query.filter_by(course_id=course_id).all()
        return jsonify({
            "modules": result,
            "total_module_count": len(all_modules),
            "released_module_count": len(modules)
        }), 200
    
    return jsonify(result), 200

@module_bp.route("/<int:module_id>", methods=["GET"])
# Similar visibility logic as get_modules_for_course based on parent course
def get_module(module_id):
    module = Module.query.get_or_404(module_id)
    course = Course.query.get_or_404(module.course_id)
    is_instructor_or_admin = False
    
    try:
        current_user_id = get_user_id()
        user = User.query.get(current_user_id)
        if user and (user.role.name == "admin" or (user.role.name == "instructor" and course.instructor_id == user.id)):
            is_instructor_or_admin = True
    except Exception:
        pass  # Anonymous user or no JWT
    
    if not course.is_published and not is_instructor_or_admin:
        return jsonify({"message": "Module not found or part of an unpublished course"}), 404
    
    # For students, check if this module is released
    if not is_instructor_or_admin:
        released_modules = course.get_released_modules()
        released_module_ids = [m.id for m in released_modules]
        if module.id not in released_module_ids:
            return jsonify({"message": "This module is not available yet"}), 403
    
    return jsonify(module.to_dict(include_lessons=True)), 200

@module_bp.route("/<int:module_id>/release", methods=["POST", "PATCH"])
@role_required(["admin", "instructor"])
def release_module(module_id):
    """Manually release a module, making it available to students."""
    from datetime import datetime
    
    module = Module.query.get_or_404(module_id)
    course = Course.query.get_or_404(module.course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to release this module"}), 403

    try:
        module.is_released = True
        module.released_at = datetime.utcnow()
        db.session.commit()
        logger.info(f"Module {module_id} manually released by user {current_user_id}")
        return jsonify({
            "message": "Module released successfully",
            "module": module.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not release module", "error": str(e)}), 500

@module_bp.route("/<int:module_id>/unrelease", methods=["POST", "PATCH"])
@role_required(["admin", "instructor"])
def unrelease_module(module_id):
    """Revoke manual release of a module."""
    module = Module.query.get_or_404(module_id)
    course = Course.query.get_or_404(module.course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to modify this module"}), 403

    try:
        module.is_released = False
        module.released_at = None
        db.session.commit()
        logger.info(f"Module {module_id} release revoked by user {current_user_id}")
        return jsonify({
            "message": "Module release revoked",
            "module": module.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not unrelease module", "error": str(e)}), 500

@module_bp.route("/<int:module_id>", methods=["PUT"])
@role_required(["admin", "instructor"])
def update_module(module_id):
    module = Module.query.get_or_404(module_id)
    course = Course.query.get_or_404(module.course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to update this module"}), 403

    data = request.get_json()
    try:
        module.title = data.get("title", module.title)
        module.description = data.get("description", module.description)
        module.order = data.get("order", module.order)
        db.session.commit()
        return jsonify(module.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not update module", "error": str(e)}), 500

@module_bp.route("/<int:module_id>", methods=["DELETE"])
@role_required(["admin", "instructor"])
def delete_module(module_id):
    module = Module.query.get_or_404(module_id)
    course = Course.query.get_or_404(module.course_id)
    current_user_id = get_user_id()
    
    if current_user_id is None:
        logger.error("Could not extract user ID from JWT token")
        return jsonify({"message": "Authentication error"}), 401
    
    user = User.query.get(current_user_id)

    # Log for debugging
    logger.info(f"Delete module check: course.instructor_id={course.instructor_id} (type: {type(course.instructor_id)}), current_user_id={current_user_id} (type: {type(current_user_id)})")
    
    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        logger.warning(f"User {current_user_id} attempted to delete module {module_id} from course {course.id} owned by instructor {course.instructor_id}")
        return jsonify({
            "message": "Forbidden. You do not have permission to perform this action.",
            "error_type": "authorization_error",
            "details": {
                "module_id": module_id,
                "course_id": course.id,
                "required_instructor_id": course.instructor_id,
                "your_user_id": current_user_id
            }
        }), 403

    try:
        db.session.delete(module)
        db.session.commit()
        logger.info(f"Module {module_id} deleted successfully by user {current_user_id}")
        return jsonify({"message": "Module deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting module {module_id}: {str(e)}", exc_info=True)
        return jsonify({"message": "Could not delete module", "error": str(e)}), 500

# --- Lesson Routes (nested under modules for creation) ---
@module_bp.route("/<int:module_id>/lessons", methods=["POST"])
@role_required(["admin", "instructor"])
def create_lesson_for_module(module_id):
    module = Module.query.get_or_404(module_id)
    course = Course.query.get_or_404(module.course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to add lessons to this module"}), 403

    data = request.get_json()
    try:
        new_lesson = Lesson(
            title=data["title"],
            content_type=data["content_type"],
            content_data=data["content_data"],
            module_id=module_id,
            order=data.get("order", 0)
        )
        db.session.add(new_lesson)
        db.session.commit()
        return jsonify(new_lesson.to_dict()), 201
    except KeyError as e:
        return jsonify({"message": f"Missing field: {e}"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not create lesson", "error": str(e)}), 500

@module_bp.route("/<int:module_id>/lessons", methods=["GET"])
# Similar visibility logic as get_module based on parent course
def get_lessons_for_module(module_id):
    module = Module.query.get_or_404(module_id)
    course = Course.query.get_or_404(module.course_id)
    if not course.is_published:
        try:
            current_user_id = get_user_id()
            user = User.query.get(current_user_id)
            if not user or (user.role.name not in ["admin", "instructor"] or (user.role.name == "instructor" and course.instructor_id != user.id)):
                return jsonify({"message": "Module not found or part of an unpublished course"}), 404
        except Exception:
             return jsonify({"message": "Module not found or part of an unpublished course"}), 404

    lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
    return jsonify([lesson.to_dict() for lesson in lessons]), 200

@lesson_bp.route("/<int:lesson_id>", methods=["GET"])
# Similar visibility logic
def get_lesson(lesson_id):
    lesson = Lesson.query.get_or_404(lesson_id)
    module = Module.query.get_or_404(lesson.module_id)
    course = Course.query.get_or_404(module.course_id)
    if not course.is_published:
        try:
            current_user_id = get_user_id()
            user = User.query.get(current_user_id)
            if not user or (user.role.name not in ["admin", "instructor"] or (user.role.name == "instructor" and course.instructor_id != user.id)):
                return jsonify({"message": "Lesson not found or part of an unpublished course"}), 404
        except Exception:
             return jsonify({"message": "Lesson not found or part of an unpublished course"}), 404
    return jsonify(lesson.to_dict()), 200

@lesson_bp.route("/<int:lesson_id>", methods=["PUT"])
@role_required(["admin", "instructor"])
def update_lesson(lesson_id):
    lesson = Lesson.query.get_or_404(lesson_id)
    module = Module.query.get_or_404(lesson.module_id)
    course = Course.query.get_or_404(module.course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to update this lesson"}), 403

    data = request.get_json()
    try:
        lesson.title = data.get("title", lesson.title)
        lesson.content_type = data.get("content_type", lesson.content_type)
        lesson.content_data = data.get("content_data", lesson.content_data)
        lesson.order = data.get("order", lesson.order)
        db.session.commit()
        return jsonify(lesson.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not update lesson", "error": str(e)}), 500

# --- Announcement Routes ---
@course_bp.route("/<int:course_id>/announcements", methods=["POST"])
@role_required(["admin", "instructor"])
def create_announcement_for_course(course_id):
    course = Course.query.get_or_404(course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to create announcements for this course"}), 403

    data = request.get_json()
    try:
        new_announcement = Announcement(
            course_id=course_id,
            instructor_id=current_user_id,
            title=data["title"],
            content=data["content"]
        )
        db.session.add(new_announcement)
        db.session.commit()
        
        # Send email notification to all enrolled students
        email_results = {"sent": 0, "failed": 0, "total": 0}
        try:
            enrollments = Enrollment.query.filter_by(course_id=course_id).all()
            students = [User.query.get(enrollment.student_id) for enrollment in enrollments]
            students = [s for s in students if s and s.email]  # Filter out None and no email
            
            if students:
                logger.info(f"📧 Preparing announcement notification for {len(students)} students")
                logger.info(f"   Course: {course.title}")
                logger.info(f"   Title: {new_announcement.title}")
                
                email_results = send_announcement_notification(
                    announcement=new_announcement,
                    course=course,
                    students=students
                )
                
                logger.info(f"✅ Announcement emails: {email_results['sent']} sent, {email_results['failed']} failed out of {email_results['total']} students")
                
                if email_results['failed'] > 0:
                    logger.warning(f"⚠️ {email_results['failed']} announcement emails failed to send")
            else:
                logger.info(f"🔕 No students with email addresses found for course {course_id}")
        except Exception as email_error:
            logger.error(f"❌ Error sending announcement notifications: {str(email_error)}")
            # Don't fail the request if emails fail
        
        return jsonify(new_announcement.to_dict()), 201
    except KeyError as e:
        return jsonify({"message": f"Missing field: {e}"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not create announcement", "error": str(e)}), 500

@course_bp.route("/<int:course_id>/announcements", methods=["GET"])
def get_announcements_for_course(course_id):
    course = Course.query.get_or_404(course_id)
    if not course.is_published:
        try:
            current_user_id = get_user_id()
            user = User.query.get(current_user_id)
            if not user or (user.role.name not in ["admin", "instructor"] or (user.role.name == "instructor" and course.instructor_id != user.id)):
                return jsonify({"message": "Course not found or not published"}), 404
        except Exception:
             return jsonify({"message": "Course not found or not published"}), 404

    announcements = Announcement.query.filter_by(course_id=course_id).order_by(Announcement.created_at.desc()).all()
    return jsonify([ann.to_dict() for ann in announcements]), 200

@announcement_bp.route("/<int:announcement_id>", methods=["PUT"])
@role_required(["admin", "instructor"])
def update_announcement(announcement_id):
    announcement = Announcement.query.get_or_404(announcement_id)
    course = Course.query.get_or_404(announcement.course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to update this announcement"}), 403

    data = request.get_json()
    try:
        announcement.title = data.get("title", announcement.title)
        announcement.content = data.get("content", announcement.content)
        db.session.commit()
        return jsonify(announcement.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not update announcement", "error": str(e)}), 500

@announcement_bp.route("/<int:announcement_id>", methods=["DELETE"])
@role_required(["admin", "instructor"])
def delete_announcement(announcement_id):
    announcement = Announcement.query.get_or_404(announcement_id)
    course = Course.query.get_or_404(announcement.course_id)
    current_user_id = get_user_id()
    
    if current_user_id is None:
        logger.error("Could not extract user ID from JWT token")
        return jsonify({"message": "Authentication error"}), 401
    
    user = User.query.get(current_user_id)

    # Log for debugging
    logger.info(f"Delete announcement check: course.instructor_id={course.instructor_id} (type: {type(course.instructor_id)}), current_user_id={current_user_id} (type: {type(current_user_id)})")
    
    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        logger.warning(f"User {current_user_id} attempted to delete announcement {announcement_id} from course {course.id} owned by instructor {course.instructor_id}")
        return jsonify({
            "message": "Forbidden. You do not have permission to perform this action.",
            "error_type": "authorization_error",
            "details": {
                "announcement_id": announcement_id,
                "course_id": course.id,
                "required_instructor_id": course.instructor_id,
                "your_user_id": current_user_id
            }
        }), 403

    try:
        db.session.delete(announcement)
        db.session.commit()
        logger.info(f"Announcement {announcement_id} deleted successfully by user {current_user_id}")
        return jsonify({"message": "Announcement deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting announcement {announcement_id}: {str(e)}", exc_info=True)
        return jsonify({"message": "Could not delete announcement", "error": str(e)}), 500


# --- ENROLLMENT ROUTES (Enhanced) ---

@enrollment_bp.route("", methods=["GET"])
@jwt_required()
def get_my_enrollments():
    """
    Get all enrollments for the current user with detailed course and progress information.
    """
    current_user_id = get_user_id()
    if not current_user_id:
        return jsonify({"error": "Authentication error"}), 401
    
    try:
        enrollments = Enrollment.query.filter_by(student_id=current_user_id).all()
        
        result = []
        for enrollment in enrollments:
            course = enrollment.course
            
            # Get module count and completion
            total_modules = course.modules.count()
            from ..models.student_models import ModuleProgress
            completed_modules = ModuleProgress.query.filter_by(
                student_id=current_user_id,
                enrollment_id=enrollment.id
            ).filter(ModuleProgress.progress >= 1.0).count()
            
            # Get overall course score
            course_score = enrollment.calculate_course_score()
            
            result.append({
                "id": enrollment.id,
                "course": {
                    "id": course.id,
                    "title": course.title,
                    "description": course.description,
                    "instructor_name": f"{course.instructor.first_name} {course.instructor.last_name}",
                    "is_published": course.is_published
                },
                "enrollment_date": enrollment.enrollment_date.isoformat(),
                "progress": enrollment.progress,
                "course_score": round(course_score, 2),
                "total_modules": total_modules,
                "completed_modules": completed_modules,
                "completed_at": enrollment.completed_at.isoformat() if enrollment.completed_at else None,
                "is_completed": enrollment.completed_at is not None
            })
        
        return jsonify({
            "success": True,
            "enrollments": result,
            "total": len(result)
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching enrollments: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to fetch enrollments", "details": str(e)}), 500


@enrollment_bp.route("/check/<int:course_id>", methods=["GET"])
@jwt_required()
def check_enrollment(course_id):
    """
    Check if current user is enrolled in a specific course.
    """
    current_user_id = get_user_id()
    if not current_user_id:
        return jsonify({"error": "Authentication error"}), 401
    
    enrollment = Enrollment.query.filter_by(
        student_id=current_user_id,
        course_id=course_id
    ).first()
    
    if enrollment:
        return jsonify({
            "enrolled": True,
            "enrollment_id": enrollment.id,
            "enrollment_date": enrollment.enrollment_date.isoformat(),
            "progress": enrollment.progress,
            "course_score": round(enrollment.calculate_course_score(), 2)
        }), 200
    else:
        return jsonify({
            "enrolled": False
        }), 200


@enrollment_bp.route("/statistics", methods=["GET"])
@jwt_required()
def get_enrollment_statistics():
    """
    Get enrollment statistics for the current user.
    """
    current_user_id = get_user_id()
    if not current_user_id:
        return jsonify({"error": "Authentication error"}), 401
    
    try:
        total_enrollments = Enrollment.query.filter_by(student_id=current_user_id).count()
        completed_enrollments = Enrollment.query.filter_by(
            student_id=current_user_id
        ).filter(Enrollment.completed_at.isnot(None)).count()
        
        in_progress = total_enrollments - completed_enrollments
        
        # Calculate average score across all enrollments
        enrollments = Enrollment.query.filter_by(student_id=current_user_id).all()
        total_score = sum(enrollment.calculate_course_score() for enrollment in enrollments)
        average_score = (total_score / total_enrollments) if total_enrollments > 0 else 0
        
        return jsonify({
            "success": True,
            "statistics": {
                "total_enrollments": total_enrollments,
                "completed_courses": completed_enrollments,
                "in_progress": in_progress,
                "average_score": round(average_score, 2),
                "completion_rate": round((completed_enrollments / total_enrollments * 100), 1) if total_enrollments > 0 else 0
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error calculating statistics: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to calculate statistics"}), 500


@enrollment_bp.route("/<int:enrollment_id>", methods=["GET"])
@jwt_required()
def get_enrollment_detail(enrollment_id):
    """
    Get detailed information about a specific enrollment.
    """
    current_user_id = get_user_id()
    if not current_user_id:
        return jsonify({"error": "Authentication error"}), 401
    
    enrollment = Enrollment.query.get_or_404(enrollment_id)
    
    # Verify ownership
    if enrollment.student_id != current_user_id:
        user = User.query.get(current_user_id)
        if not user or user.role.name not in ["admin", "instructor"]:
            return jsonify({"error": "Unauthorized access"}), 403
    
    course = enrollment.course
    from ..models.student_models import ModuleProgress
    
    # Get module progress details
    module_progress_list = []
    for module in course.modules.order_by(Module.order).all():
        progress = ModuleProgress.query.filter_by(
            student_id=enrollment.student_id,
            module_id=module.id,
            enrollment_id=enrollment.id
        ).first()
        
        module_progress_list.append({
            "module_id": module.id,
            "module_title": module.title,
            "module_order": module.order,
            "progress": progress.progress if progress else 0.0,
            "module_score": round(progress.calculate_module_score(), 2) if progress else 0.0,
            "completed": progress.progress >= 1.0 if progress else False
        })
    
    return jsonify({
        "success": True,
        "enrollment": {
            "id": enrollment.id,
            "course_id": course.id,
            "course_title": course.title,
            "enrollment_date": enrollment.enrollment_date.isoformat(),
            "progress": enrollment.progress,
            "course_score": round(enrollment.calculate_course_score(), 2),
            "completed_at": enrollment.completed_at.isoformat() if enrollment.completed_at else None,
            "modules": module_progress_list
        }
    }), 200