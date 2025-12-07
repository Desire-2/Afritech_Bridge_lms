# Enhanced Course Creation API Routes for Instructors

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError
import json
import os
from werkzeug.utils import secure_filename

from ..models.user_models import db, User, Role
from ..models.course_models import (
    Course, Module, Lesson, Quiz, Question, Answer, 
    Assignment, AssignmentSubmission, Project, ProjectSubmission, 
    Enrollment, Submission, Announcement
)

# Helper for role checking
from functools import wraps

def get_user_id():
    """Helper function to get user ID as integer from JWT"""
    try:
        user_id = get_jwt_identity()
        return int(user_id) if user_id is not None else None
    except (ValueError, TypeError) as e:
        print(f"ERROR in get_user_id: {e}")
        return None

def instructor_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        # Debug logging
        print(f"DEBUG - User ID: {current_user_id}")
        print(f"DEBUG - User: {user}")
        if user:
            print(f"DEBUG - User role: {user.role}")
            if user.role:
                print(f"DEBUG - Role name: {user.role.name}")
        
        if not user or not user.role or user.role.name not in ['instructor', 'admin']:
            print(f"DEBUG - Access denied for user {current_user_id}")
            return jsonify({"message": "Instructor access required"}), 403
        return f(*args, **kwargs)
    return decorated_function

def course_ownership_required(f):
    @wraps(f)
    @instructor_required
    def decorated_function(*args, **kwargs):
        current_user_id = get_user_id()
        course_id = kwargs.get('course_id') or request.json.get('course_id')
        
        # Debug logging
        print(f"DEBUG OWNERSHIP - User ID: {current_user_id} (type: {type(current_user_id)})")
        print(f"DEBUG OWNERSHIP - Course ID: {course_id}")
        print(f"DEBUG OWNERSHIP - kwargs: {kwargs}")
        
        if course_id:
            course = Course.query.get(course_id)
            print(f"DEBUG OWNERSHIP - Course found: {course}")
            if course:
                print(f"DEBUG OWNERSHIP - Course instructor_id: {course.instructor_id} (type: {type(course.instructor_id)})")
                print(f"DEBUG OWNERSHIP - Match: {course.instructor_id == current_user_id}")
            
            if not course or course.instructor_id != current_user_id:
                print(f"DEBUG OWNERSHIP - Access denied!")
                return jsonify({"message": "Access denied to this course"}), 403
        
        return f(*args, **kwargs)
    return decorated_function

course_creation_bp = Blueprint("course_creation_bp", __name__, url_prefix="/api/v1/instructor/courses")

# =====================
# COURSE MANAGEMENT
# =====================

@course_creation_bp.route("", methods=["POST"])
@instructor_required
def create_course():
    """Create a new course"""
    try:
        data = request.get_json()
        current_user_id = get_user_id()
        
        # Validate required fields
        required_fields = ['title', 'description']
        for field in required_fields:
            if not data.get(field):
                return jsonify({"message": f"{field} is required"}), 400
        
        # Check for duplicate course title
        existing_course = Course.query.filter_by(title=data['title']).first()
        if existing_course:
            return jsonify({"message": "Course with this title already exists"}), 400
        
        course = Course(
            title=data['title'],
            description=data['description'],
            learning_objectives=data.get('learning_objectives', ''),
            target_audience=data.get('target_audience', ''),
            estimated_duration=data.get('estimated_duration', ''),
            instructor_id=current_user_id,  # Already converted to int by helper
            is_published=data.get('is_published', False)
        )
        
        db.session.add(course)
        db.session.commit()
        
        try:
            course_dict = course.to_dict()
        except Exception as e:
            print(f"ERROR in course.to_dict() after creation: {str(e)}")
            import traceback
            traceback.print_exc()
            # Return basic course info without to_dict
            return jsonify({
                "message": "Course created successfully",
                "course": {
                    "id": course.id,
                    "title": course.title,
                    "description": course.description
                }
            }), 201
        
        return jsonify({
            "message": "Course created successfully",
            "course": course_dict
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to create course", "error": str(e)}), 500

@course_creation_bp.route("/<int:course_id>", methods=["PUT"])
@course_ownership_required
def update_course(course_id):
    """Update an existing course"""
    try:
        course = Course.query.get_or_404(course_id)
        data = request.get_json()
        
        # Update course fields
        if 'title' in data:
            course.title = data['title']
        if 'description' in data:
            course.description = data['description']
        if 'learning_objectives' in data:
            course.learning_objectives = data['learning_objectives']
        if 'target_audience' in data:
            course.target_audience = data['target_audience']
        if 'estimated_duration' in data:
            course.estimated_duration = data['estimated_duration']
        if 'is_published' in data:
            course.is_published = data['is_published']
        
        db.session.commit()
        
        return jsonify({
            "message": "Course updated successfully",
            "course": course.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to update course", "error": str(e)}), 500

@course_creation_bp.route("/<int:course_id>", methods=["GET"])
@course_ownership_required
def get_course_details(course_id):
    """Get detailed course information with modules and lessons"""
    try:
        print(f"DEBUG ENDPOINT - Getting course details for course_id: {course_id}")
        course = Course.query.get_or_404(course_id)
        print(f"DEBUG ENDPOINT - Course found: {course}")
        
        print(f"DEBUG ENDPOINT - Converting course to dict...")
        try:
            course_data = course.to_dict(include_modules=True)
            print(f"DEBUG ENDPOINT - Course data converted successfully")
        except Exception as e:
            print(f"ERROR in course.to_dict(): {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({"message": "Error converting course data", "error": str(e)}), 500
        
        # Include assignments, quizzes, and projects
        print(f"DEBUG ENDPOINT - Getting assignments...")
        try:
            assignments = Assignment.query.filter_by(course_id=course_id).all()
            print(f"DEBUG ENDPOINT - Getting quizzes...")
            quizzes = Quiz.query.filter_by(course_id=course_id).all()
            print(f"DEBUG ENDPOINT - Getting projects...")
            projects = Project.query.filter_by(course_id=course_id).all()
        except Exception as e:
            print(f"ERROR getting assessments: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({"message": "Error getting assessments", "error": str(e)}), 500
        
        print(f"DEBUG ENDPOINT - Building final response...")
        try:
            course_data.update({
                'assignments': [assignment.to_dict() for assignment in assignments],
                'quizzes': [quiz.to_dict() for quiz in quizzes],
                'projects': [project.to_dict(include_modules=True) for project in projects]
            })
        except Exception as e:
            print(f"ERROR building response: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({"message": "Error building response", "error": str(e)}), 500
        
        print(f"DEBUG ENDPOINT - Returning response...")
        return jsonify(course_data), 200
        
    except Exception as e:
        return jsonify({"message": "Failed to fetch course details", "error": str(e)}), 500

# =====================
# MODULE MANAGEMENT
# =====================

@course_creation_bp.route("/<int:course_id>/modules", methods=["POST"])
@course_ownership_required
def create_module(course_id):
    """Create a new module in a course"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('title'):
            return jsonify({"message": "Module title is required"}), 400
        
        # Get the next order number
        last_module = Module.query.filter_by(course_id=course_id).order_by(Module.order.desc()).first()
        next_order = (last_module.order + 1) if last_module else 1
        
        module = Module(
            title=data['title'],
            description=data.get('description', ''),
            learning_objectives=data.get('learning_objectives', ''),
            course_id=course_id,
            order=data.get('order', next_order),
            is_published=data.get('is_published', False)
        )
        
        db.session.add(module)
        db.session.commit()
        
        return jsonify({
            "message": "Module created successfully",
            "module": module.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to create module", "error": str(e)}), 500

@course_creation_bp.route("/<int:course_id>/modules/<int:module_id>", methods=["PUT"])
@course_ownership_required
def update_module(course_id, module_id):
    """Update a module"""
    try:
        module = Module.query.filter_by(id=module_id, course_id=course_id).first_or_404()
        data = request.get_json()
        
        # Update module fields
        if 'title' in data:
            module.title = data['title']
        if 'description' in data:
            module.description = data['description']
        if 'learning_objectives' in data:
            module.learning_objectives = data['learning_objectives']
        if 'order' in data:
            module.order = data['order']
        if 'is_published' in data:
            module.is_published = data['is_published']
        
        db.session.commit()
        
        return jsonify({
            "message": "Module updated successfully",
            "module": module.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to update module", "error": str(e)}), 500

@course_creation_bp.route("/<int:course_id>/modules/reorder", methods=["PUT"])
@course_ownership_required
def reorder_modules(course_id):
    """Reorder modules in a course"""
    try:
        data = request.get_json()
        module_orders = data.get('module_orders', [])  # List of {"id": module_id, "order": new_order}
        
        for item in module_orders:
            module = Module.query.filter_by(id=item['id'], course_id=course_id).first()
            if module:
                module.order = item['order']
        
        db.session.commit()
        
        return jsonify({"message": "Modules reordered successfully"}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to reorder modules", "error": str(e)}), 500

@course_creation_bp.route("/<int:course_id>/modules/<int:module_id>", methods=["DELETE"])
@course_ownership_required
def delete_module(course_id, module_id):
    """Delete a module"""
    try:
        module = Module.query.filter_by(id=module_id, course_id=course_id).first_or_404()
        db.session.delete(module)
        db.session.commit()
        
        return jsonify({"message": "Module deleted successfully"}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to delete module", "error": str(e)}), 500

# =====================
# LESSON MANAGEMENT
# =====================

@course_creation_bp.route("/<int:course_id>/modules/<int:module_id>/lessons", methods=["POST"])
@course_ownership_required
def create_lesson(course_id, module_id):
    """Create a new lesson in a module"""
    try:
        print(f"DEBUG LESSON - Creating lesson for course_id: {course_id}, module_id: {module_id}")
        
        # Verify module belongs to course
        module = Module.query.filter_by(id=module_id, course_id=course_id).first()
        if not module:
            print(f"ERROR LESSON - Module not found: module_id={module_id}, course_id={course_id}")
            return jsonify({
                "message": f"Module with ID {module_id} not found in course {course_id}. Please create a module first before adding lessons.",
                "error": "MODULE_NOT_FOUND"
            }), 404
        print(f"DEBUG LESSON - Module found: {module}")
        
        data = request.get_json()
        print(f"DEBUG LESSON - Request data: {data}")
        
        # Validate required fields
        required_fields = ['title', 'content_type', 'content_data']
        for field in required_fields:
            if not data.get(field):
                print(f"DEBUG LESSON - Missing field: {field}")
                return jsonify({"message": f"{field} is required"}), 400
        
        # Get the next order number
        last_lesson = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order.desc()).first()
        next_order = (last_lesson.order + 1) if last_lesson else 1
        print(f"DEBUG LESSON - Next order: {next_order}")
        
        print(f"DEBUG LESSON - Creating lesson object...")
        lesson = Lesson(
            title=data['title'],
            content_type=data['content_type'],
            content_data=data['content_data'],
            description=data.get('description', ''),
            learning_objectives=data.get('learning_objectives', ''),
            module_id=module_id,
            order=data.get('order', next_order),
            duration_minutes=data.get('duration_minutes'),
            is_published=data.get('is_published', False)
        )
        
        print(f"DEBUG LESSON - Adding to session...")
        db.session.add(lesson)
        print(f"DEBUG LESSON - Committing...")
        db.session.commit()
        print(f"DEBUG LESSON - Success!")
        
        return jsonify({
            "message": "Lesson created successfully",
            "lesson": lesson.to_dict()
        }), 201
        
    except Exception as e:
        print(f"ERROR LESSON - Exception occurred: {e}")
        print(f"ERROR LESSON - Exception type: {type(e)}")
        import traceback
        print(f"ERROR LESSON - Traceback: {traceback.format_exc()}")
        db.session.rollback()
        return jsonify({"message": "Failed to create lesson", "error": str(e)}), 500

@course_creation_bp.route("/<int:course_id>/modules/<int:module_id>/lessons/<int:lesson_id>", methods=["PUT"])
@course_ownership_required
def update_lesson(course_id, module_id, lesson_id):
    """Update a lesson"""
    try:
        # Verify lesson belongs to module and course
        lesson = Lesson.query.join(Module).filter(
            Lesson.id == lesson_id,
            Lesson.module_id == module_id,
            Module.course_id == course_id
        ).first_or_404()
        
        data = request.get_json()
        
        # Update lesson fields
        if 'title' in data:
            lesson.title = data['title']
        if 'content_type' in data:
            lesson.content_type = data['content_type']
        if 'content_data' in data:
            lesson.content_data = data['content_data']
        if 'description' in data:
            lesson.description = data['description']
        if 'learning_objectives' in data:
            lesson.learning_objectives = data['learning_objectives']
        if 'order' in data:
            lesson.order = data['order']
        if 'duration_minutes' in data:
            lesson.duration_minutes = data['duration_minutes']
        if 'is_published' in data:
            lesson.is_published = data['is_published']
        
        db.session.commit()
        
        return jsonify({
            "message": "Lesson updated successfully",
            "lesson": lesson.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to update lesson", "error": str(e)}), 500

@course_creation_bp.route("/<int:course_id>/modules/<int:module_id>/lessons/reorder", methods=["PUT"])
@course_ownership_required
def reorder_lessons(course_id, module_id):
    """Reorder lessons in a module"""
    try:
        # Verify module belongs to course
        module = Module.query.filter_by(id=module_id, course_id=course_id).first_or_404()
        
        data = request.get_json()
        lesson_orders = data.get('lesson_orders', [])  # List of {"id": lesson_id, "order": new_order}
        
        for item in lesson_orders:
            lesson = Lesson.query.filter_by(id=item['id'], module_id=module_id).first()
            if lesson:
                lesson.order = item['order']
        
        db.session.commit()
        
        return jsonify({"message": "Lessons reordered successfully"}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to reorder lessons", "error": str(e)}), 500

@course_creation_bp.route("/<int:course_id>/modules/<int:module_id>/lessons/<int:lesson_id>", methods=["DELETE"])
@course_ownership_required
def delete_lesson(course_id, module_id, lesson_id):
    """Delete a lesson"""
    try:
        # Verify lesson belongs to module and course
        lesson = Lesson.query.join(Module).filter(
            Lesson.id == lesson_id,
            Lesson.module_id == module_id,
            Module.course_id == course_id
        ).first_or_404()
        
        db.session.delete(lesson)
        db.session.commit()
        
        return jsonify({"message": "Lesson deleted successfully"}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to delete lesson", "error": str(e)}), 500