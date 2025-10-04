# Assessment and Project Management API Routes for Instructors

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError
import json
import os
from datetime import datetime
from werkzeug.utils import secure_filename

from ..models.user_models import db, User, Role
from ..models.course_models import (
    Course, Module, Lesson, Quiz, Question, Answer, 
    Assignment, AssignmentSubmission, Project, ProjectSubmission
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

assessment_bp = Blueprint("assessment_bp", __name__, url_prefix="/api/v1/instructor/assessments")

# =====================
# QUIZ MANAGEMENT
# =====================

@assessment_bp.route("/quizzes", methods=["POST"])
@instructor_required
def create_quiz():
    """Create a new quiz and attach it to a lesson, module, or course"""
    try:
        data = request.get_json()
        current_user_id = get_jwt_identity()
        
        # Validate required fields
        required_fields = ['title', 'course_id']
        for field in required_fields:
            if not data.get(field):
                return jsonify({"message": f"{field} is required"}), 400
        
        # Verify course ownership
        course = Course.query.get(data['course_id'])
        if not course or course.instructor_id != get_user_id():
            return jsonify({"message": "Access denied to this course"}), 403
        
        quiz = Quiz(
            title=data['title'],
            description=data.get('description', ''),
            course_id=data['course_id'],
            module_id=data.get('module_id'),
            lesson_id=data.get('lesson_id'),
            is_published=data.get('is_published', False)
        )
        
        db.session.add(quiz)
        db.session.commit()
        
        return jsonify({
            "message": "Quiz created successfully",
            "quiz": quiz.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to create quiz", "error": str(e)}), 500

@assessment_bp.route("/quizzes/<int:quiz_id>", methods=["PUT"])
@instructor_required
def update_quiz(quiz_id):
    """Update a quiz"""
    try:
        current_user_id = get_user_id()
        quiz = Quiz.query.get_or_404(quiz_id)
        
        # Verify course ownership
        if quiz.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied to this quiz"}), 403
        
        data = request.get_json()
        
        # Update quiz fields
        if 'title' in data:
            quiz.title = data['title']
        if 'description' in data:
            quiz.description = data['description']
        if 'module_id' in data:
            quiz.module_id = data['module_id']
        if 'lesson_id' in data:
            quiz.lesson_id = data['lesson_id']
        if 'is_published' in data:
            quiz.is_published = data['is_published']
        
        db.session.commit()
        
        return jsonify({
            "message": "Quiz updated successfully",
            "quiz": quiz.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to update quiz", "error": str(e)}), 500

@assessment_bp.route("/quizzes/<int:quiz_id>/questions", methods=["POST"])
@instructor_required
def add_quiz_question(quiz_id):
    """Add a question to a quiz"""
    try:
        current_user_id = get_jwt_identity()
        quiz = Quiz.query.get_or_404(quiz_id)
        
        # Verify course ownership
        if quiz.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied to this quiz"}), 403
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['text', 'question_type']
        for field in required_fields:
            if not data.get(field):
                return jsonify({"message": f"{field} is required"}), 400
        
        # Get the next order number
        last_question = Question.query.filter_by(quiz_id=quiz_id).order_by(Question.order.desc()).first()
        next_order = (last_question.order + 1) if last_question else 1
        
        question = Question(
            quiz_id=quiz_id,
            text=data['text'],
            question_type=data['question_type'],
            order=data.get('order', next_order)
        )
        
        db.session.add(question)
        db.session.flush()  # To get the question.id
        
        # Add answers if provided
        answers = data.get('answers', [])
        for answer_data in answers:
            answer = Answer(
                question_id=question.id,
                text=answer_data['text'],
                is_correct=answer_data.get('is_correct', False)
            )
            db.session.add(answer)
        
        db.session.commit()
        
        return jsonify({
            "message": "Question added successfully",
            "question": question.to_dict(include_answers=True)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to add question", "error": str(e)}), 500

@assessment_bp.route("/quizzes/<int:quiz_id>", methods=["DELETE"])
@instructor_required
def delete_quiz(quiz_id):
    """Delete a quiz"""
    try:
        current_user_id = get_jwt_identity()
        quiz = Quiz.query.get_or_404(quiz_id)
        
        # Verify course ownership
        if quiz.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied to this quiz"}), 403
        
        db.session.delete(quiz)
        db.session.commit()
        
        return jsonify({"message": "Quiz deleted successfully"}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to delete quiz", "error": str(e)}), 500

# =====================
# ASSIGNMENT MANAGEMENT
# =====================

@assessment_bp.route("/assignments", methods=["POST"])
@instructor_required
def create_assignment():
    """Create a new assignment and attach it to a lesson, module, or course"""
    try:
        data = request.get_json()
        current_user_id = get_jwt_identity()
        
        # Validate required fields
        required_fields = ['title', 'description', 'course_id']
        for field in required_fields:
            if not data.get(field):
                return jsonify({"message": f"{field} is required"}), 400
        
        # Verify course ownership
        course = Course.query.get(data['course_id'])
        if not course or course.instructor_id != get_user_id():
            return jsonify({"message": "Access denied to this course"}), 403
        
        # Parse due date if provided
        due_date = None
        if data.get('due_date'):
            try:
                due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
            except ValueError:
                return jsonify({"message": "Invalid due_date format. Use ISO format."}), 400
        
        assignment = Assignment(
            title=data['title'],
            description=data['description'],
            instructions=data.get('instructions', ''),
            course_id=data['course_id'],
            module_id=data.get('module_id'),
            lesson_id=data.get('lesson_id'),
            instructor_id=get_user_id(),
            assignment_type=data.get('assignment_type', 'file_upload'),
            max_file_size_mb=data.get('max_file_size_mb', 10),
            allowed_file_types=data.get('allowed_file_types'),
            due_date=due_date,
            points_possible=data.get('points_possible', 100.0),
            is_published=data.get('is_published', False)
        )
        
        db.session.add(assignment)
        db.session.commit()
        
        return jsonify({
            "message": "Assignment created successfully",
            "assignment": assignment.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to create assignment", "error": str(e)}), 500

@assessment_bp.route("/assignments/<int:assignment_id>", methods=["PUT"])
@instructor_required
def update_assignment(assignment_id):
    """Update an assignment"""
    try:
        current_user_id = get_jwt_identity()
        assignment = Assignment.query.get_or_404(assignment_id)
        
        # Verify course ownership
        if assignment.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied to this assignment"}), 403
        
        data = request.get_json()
        
        # Update assignment fields
        if 'title' in data:
            assignment.title = data['title']
        if 'description' in data:
            assignment.description = data['description']
        if 'instructions' in data:
            assignment.instructions = data['instructions']
        if 'module_id' in data:
            assignment.module_id = data['module_id']
        if 'lesson_id' in data:
            assignment.lesson_id = data['lesson_id']
        if 'assignment_type' in data:
            assignment.assignment_type = data['assignment_type']
        if 'max_file_size_mb' in data:
            assignment.max_file_size_mb = data['max_file_size_mb']
        if 'allowed_file_types' in data:
            assignment.allowed_file_types = data['allowed_file_types']
        if 'due_date' in data:
            if data['due_date']:
                try:
                    assignment.due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
                except ValueError:
                    return jsonify({"message": "Invalid due_date format. Use ISO format."}), 400
            else:
                assignment.due_date = None
        if 'points_possible' in data:
            assignment.points_possible = data['points_possible']
        if 'is_published' in data:
            assignment.is_published = data['is_published']
        
        db.session.commit()
        
        return jsonify({
            "message": "Assignment updated successfully",
            "assignment": assignment.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to update assignment", "error": str(e)}), 500

@assessment_bp.route("/assignments/<int:assignment_id>", methods=["DELETE"])
@instructor_required
def delete_assignment(assignment_id):
    """Delete an assignment"""
    try:
        current_user_id = get_jwt_identity()
        assignment = Assignment.query.get_or_404(assignment_id)
        
        # Verify course ownership
        if assignment.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied to this assignment"}), 403
        
        db.session.delete(assignment)
        db.session.commit()
        
        return jsonify({"message": "Assignment deleted successfully"}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to delete assignment", "error": str(e)}), 500

# =====================
# PROJECT MANAGEMENT
# =====================

@assessment_bp.route("/projects", methods=["POST"])
@instructor_required
def create_project():
    """Create a new multi-part project"""
    try:
        data = request.get_json()
        current_user_id = get_jwt_identity()
        
        # Validate required fields
        required_fields = ['title', 'description', 'course_id', 'module_ids', 'due_date']
        for field in required_fields:
            if not data.get(field):
                return jsonify({"message": f"{field} is required"}), 400
        
        # Verify course ownership
        course = Course.query.get(data['course_id'])
        if not course or course.instructor_id != get_user_id():
            return jsonify({"message": "Access denied to this course"}), 403
        
        # Validate module_ids belong to the course
        module_ids = data['module_ids']
        if not isinstance(module_ids, list) or not module_ids:
            return jsonify({"message": "module_ids must be a non-empty list"}), 400
        
        modules = Module.query.filter(
            Module.id.in_(module_ids),
            Module.course_id == data['course_id']
        ).all()
        
        if len(modules) != len(module_ids):
            return jsonify({"message": "Some module IDs are invalid or don't belong to this course"}), 400
        
        # Parse due date
        try:
            due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
        except ValueError:
            return jsonify({"message": "Invalid due_date format. Use ISO format."}), 400
        
        project = Project(
            title=data['title'],
            description=data['description'],
            objectives=data.get('objectives', ''),
            course_id=data['course_id'],
            due_date=due_date,
            points_possible=data.get('points_possible', 100.0),
            is_published=data.get('is_published', False),
            submission_format=data.get('submission_format', 'file_upload'),
            max_file_size_mb=data.get('max_file_size_mb', 50),
            allowed_file_types=data.get('allowed_file_types'),
            collaboration_allowed=data.get('collaboration_allowed', False),
            max_team_size=data.get('max_team_size', 1)
        )
        
        project.set_modules(module_ids)
        
        db.session.add(project)
        db.session.commit()
        
        return jsonify({
            "message": "Project created successfully",
            "project": project.to_dict(include_modules=True)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to create project", "error": str(e)}), 500

@assessment_bp.route("/projects/<int:project_id>", methods=["PUT"])
@instructor_required
def update_project(project_id):
    """Update a project"""
    try:
        current_user_id = get_jwt_identity()
        project = Project.query.get_or_404(project_id)
        
        # Verify course ownership
        if project.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied to this project"}), 403
        
        data = request.get_json()
        
        # Update project fields
        if 'title' in data:
            project.title = data['title']
        if 'description' in data:
            project.description = data['description']
        if 'objectives' in data:
            project.objectives = data['objectives']
        if 'module_ids' in data:
            # Validate module_ids belong to the course
            module_ids = data['module_ids']
            if not isinstance(module_ids, list) or not module_ids:
                return jsonify({"message": "module_ids must be a non-empty list"}), 400
            
            modules = Module.query.filter(
                Module.id.in_(module_ids),
                Module.course_id == project.course_id
            ).all()
            
            if len(modules) != len(module_ids):
                return jsonify({"message": "Some module IDs are invalid or don't belong to this course"}), 400
            
            project.set_modules(module_ids)
        
        if 'due_date' in data:
            try:
                project.due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
            except ValueError:
                return jsonify({"message": "Invalid due_date format. Use ISO format."}), 400
        
        if 'points_possible' in data:
            project.points_possible = data['points_possible']
        if 'is_published' in data:
            project.is_published = data['is_published']
        if 'submission_format' in data:
            project.submission_format = data['submission_format']
        if 'max_file_size_mb' in data:
            project.max_file_size_mb = data['max_file_size_mb']
        if 'allowed_file_types' in data:
            project.allowed_file_types = data['allowed_file_types']
        if 'collaboration_allowed' in data:
            project.collaboration_allowed = data['collaboration_allowed']
        if 'max_team_size' in data:
            project.max_team_size = data['max_team_size']
        
        db.session.commit()
        
        return jsonify({
            "message": "Project updated successfully",
            "project": project.to_dict(include_modules=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to update project", "error": str(e)}), 500

@assessment_bp.route("/projects/<int:project_id>", methods=["DELETE"])
@instructor_required
def delete_project(project_id):
    """Delete a project"""
    try:
        current_user_id = get_jwt_identity()
        project = Project.query.get_or_404(project_id)
        
        # Verify course ownership
        if project.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied to this project"}), 403
        
        db.session.delete(project)
        db.session.commit()
        
        return jsonify({"message": "Project deleted successfully"}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to delete project", "error": str(e)}), 500

# =====================
# ASSESSMENT OVERVIEW
# =====================

@assessment_bp.route("/courses/<int:course_id>/overview", methods=["GET"])
@course_ownership_required
def get_assessments_overview(course_id):
    """Get all assessments (quizzes, assignments, projects) for a course"""
    try:
        quizzes = Quiz.query.filter_by(course_id=course_id).all()
        assignments = Assignment.query.filter_by(course_id=course_id).all()
        projects = Project.query.filter_by(course_id=course_id).all()
        
        return jsonify({
            "quizzes": [quiz.to_dict() for quiz in quizzes],
            "assignments": [assignment.to_dict() for assignment in assignments],
            "projects": [project.to_dict(include_modules=True) for project in projects]
        }), 200
        
    except Exception as e:
        return jsonify({"message": "Failed to fetch assessments overview", "error": str(e)}), 500