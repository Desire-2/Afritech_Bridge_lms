# Course Management API Routes for Afritec Bridge LMS

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

# Assuming db and models are correctly set up and accessible.
from ..models.user_models import db, User, Role # For role checking
from ..models.course_models import Course, Module, Lesson, Enrollment, Quiz, Question, Answer, Submission

# Helper for role checking (decorator)
from functools import wraps

def role_required(roles):
    def decorator(f):
        @wraps(f)
        @jwt_required()
        def decorated_function(*args, **kwargs):
            current_user_id = get_jwt_identity()
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

# --- Course Routes ---
@course_bp.route("", methods=["POST"])
@role_required(["admin", "instructor"])
def create_course():
    data = request.get_json()
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    # Ensure instructor_id is the current user if they are an instructor, or allow admin to set it
    instructor_id_to_set = current_user_id
    if user.role.name == "admin" and data.get("instructor_id"):
        if User.query.get(data.get("instructor_id")):
             instructor_id_to_set = data.get("instructor_id")
        else:
            return jsonify({"message": "Specified instructor_id not found"}), 400

    try:
        new_course = Course(
            title=data["title"],
            description=data["description"],
            learning_objectives=data.get("learning_objectives"),
            target_audience=data.get("target_audience"),
            estimated_duration=data.get("estimated_duration"),
            instructor_id=instructor_id_to_set,
            is_published=data.get("is_published", False)
        )
        db.session.add(new_course)
        db.session.commit()
        return jsonify(new_course.to_dict()), 201
    except KeyError as e:
        return jsonify({"message": f"Missing field: {e}"}), 400
    except Exception as e:
        db.session.rollback()
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
    if not course.is_published:
        # Check if user is admin or instructor of this course to allow viewing unpublished
        try:
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            if not user or (user.role.name not in ["admin", "instructor"] or (user.role.name == "instructor" and course.instructor_id != user.id)):
                return jsonify({"message": "Course not found or not published"}), 404
        except Exception: # Catches if no JWT provided (anonymous user)
             return jsonify({"message": "Course not found or not published"}), 404

    return jsonify(course.to_dict(include_modules=True)), 200

@course_bp.route("/<int:course_id>", methods=["PUT"])
@role_required(["admin", "instructor"])
def update_course(course_id):
    course = Course.query.get_or_404(course_id)
    current_user_id = get_jwt_identity()
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
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to delete this course"}), 403

    try:
        db.session.delete(course)
        db.session.commit()
        return jsonify({"message": "Course deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not delete course", "error": str(e)}), 500

@course_bp.route("/<int:course_id>/publish", methods=["POST"])
@role_required(["admin", "instructor"])
def publish_course(course_id):
    course = Course.query.get_or_404(course_id)
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "Not authorized"}), 403
    course.is_published = True
    db.session.commit()
    return jsonify({"message": "Course published", "course": course.to_dict()}), 200

@course_bp.route("/<int:course_id>/unpublish", methods=["POST"])
@role_required(["admin", "instructor"])
def unpublish_course(course_id):
    course = Course.query.get_or_404(course_id)
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "Not authorized"}), 403
    course.is_published = False
    db.session.commit()
    return jsonify({"message": "Course unpublished", "course": course.to_dict()}), 200

# --- Module Routes (nested under courses for creation) ---
@course_bp.route("/<int:course_id>/modules", methods=["POST"])
@role_required(["admin", "instructor"])
def create_module_for_course(course_id):
    course = Course.query.get_or_404(course_id)
    current_user_id = get_jwt_identity()
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
    if not course.is_published:
        try:
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            if not user or (user.role.name not in ["admin", "instructor"] or (user.role.name == "instructor" and course.instructor_id != user.id)):
                return jsonify({"message": "Course not found or not published"}), 404
        except Exception:
             return jsonify({"message": "Course not found or not published"}), 404

    modules = Module.query.filter_by(course_id=course_id).order_by(Module.order).all()
    return jsonify([module.to_dict() for module in modules]), 200

@module_bp.route("/<int:module_id>", methods=["GET"])
# Similar visibility logic as get_modules_for_course based on parent course
def get_module(module_id):
    module = Module.query.get_or_404(module_id)
    course = Course.query.get_or_404(module.course_id)
    if not course.is_published:
        try:
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            if not user or (user.role.name not in ["admin", "instructor"] or (user.role.name == "instructor" and course.instructor_id != user.id)):
                return jsonify({"message": "Module not found or part of an unpublished course"}), 404
        except Exception:
             return jsonify({"message": "Module not found or part of an unpublished course"}), 404
    return jsonify(module.to_dict(include_lessons=True)), 200

@module_bp.route("/<int:module_id>", methods=["PUT"])
@role_required(["admin", "instructor"])
def update_module(module_id):
    module = Module.query.get_or_404(module_id)
    course = Course.query.get_or_404(module.course_id)
    current_user_id = get_jwt_identity()
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
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to delete this module"}), 403

    try:
        db.session.delete(module)
        db.session.commit()
        return jsonify({"message": "Module deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not delete module", "error": str(e)}), 500

# --- Lesson Routes (nested under modules for creation) ---
@module_bp.route("/<int:module_id>/lessons", methods=["POST"])
@role_required(["admin", "instructor"])
def create_lesson_for_module(module_id):
    module = Module.query.get_or_404(module_id)
    course = Course.query.get_or_404(module.course_id)
    current_user_id = get_jwt_identity()
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
            current_user_id = get_jwt_identity()
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
            current_user_id = get_jwt_identity()
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
    current_user_id = get_jwt_identity()
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