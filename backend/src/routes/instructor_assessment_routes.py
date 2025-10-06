# Instructor Assessment API Routes for Afritec Bridge LMS

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError
from datetime import datetime

from ..models.user_models import db, User, Role
from ..models.course_models import (
    Course, Module, Lesson, Quiz, Question, Answer, 
    Assignment, AssignmentSubmission, Project, ProjectSubmission, 
    Submission
)

# Helper for role checking
from functools import wraps

def instructor_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user or not user.role or user.role.name not in ['instructor', 'admin']:
            return jsonify({"message": "Instructor access required"}), 403
        return f(*args, **kwargs)
    return decorated_function

instructor_assessment_bp = Blueprint("instructor_assessment_bp", __name__, url_prefix="/api/v1/instructor/assessments")

# =====================
# QUIZ MANAGEMENT
# =====================

@instructor_assessment_bp.route("/quizzes", methods=["POST"])
@instructor_required
def create_quiz():
    """Create a new quiz for a course"""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        if not data or 'course_id' not in data:
            return jsonify({"message": "Course ID is required"}), 400
        
        course_id = data['course_id']
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Get module if specified
        module_id = data.get('module_id')
        module = None
        if module_id:
            module = Module.query.filter_by(id=module_id, course_id=course_id).first()
            if not module:
                return jsonify({"message": "Module not found"}), 404
        
        quiz = Quiz(
            title=data.get('title', ''),
            description=data.get('description', ''),
            course_id=course_id,
            module_id=module_id,
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

@instructor_assessment_bp.route("/quizzes/<int:quiz_id>", methods=["PUT"])
@instructor_required
def update_quiz(quiz_id):
    """Update an existing quiz"""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        quiz = Quiz.query.get(quiz_id)
        if not quiz:
            return jsonify({"message": "Quiz not found"}), 404
        
        # Verify instructor owns the course
        if quiz.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        # Update quiz fields
        if 'title' in data:
            quiz.title = data['title']
        if 'description' in data:
            quiz.description = data['description']
        if 'max_attempts' in data:
            quiz.max_attempts = data['max_attempts']
        if 'time_limit' in data:
            quiz.time_limit = data['time_limit']
        if 'passing_score' in data:
            quiz.passing_score = data['passing_score']
        if 'shuffle_questions' in data:
            quiz.shuffle_questions = data['shuffle_questions']
        if 'show_results' in data:
            quiz.show_results = data['show_results']
        if 'available_from' in data:
            quiz.available_from = datetime.fromisoformat(data['available_from']) if data['available_from'] else None
        if 'available_until' in data:
            quiz.available_until = datetime.fromisoformat(data['available_until']) if data['available_until'] else None
        
        db.session.commit()
        
        return jsonify({
            "message": "Quiz updated successfully",
            "quiz": quiz.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to update quiz", "error": str(e)}), 500

@instructor_assessment_bp.route("/quizzes/<int:quiz_id>", methods=["DELETE"])
@instructor_required
def delete_quiz(quiz_id):
    """Delete a quiz"""
    try:
        current_user_id = int(get_jwt_identity())
        
        quiz = Quiz.query.get(quiz_id)
        if not quiz:
            return jsonify({"message": "Quiz not found"}), 404
        
        # Verify instructor owns the course
        if quiz.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        db.session.delete(quiz)
        db.session.commit()
        
        return jsonify({"message": "Quiz deleted successfully"}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to delete quiz", "error": str(e)}), 500

@instructor_assessment_bp.route("/quizzes/<int:quiz_id>/questions", methods=["POST"])
@instructor_required
def add_quiz_question(quiz_id):
    """Add a question to a quiz"""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        quiz = Quiz.query.get(quiz_id)
        if not quiz:
            return jsonify({"message": "Quiz not found"}), 404
        
        # Verify instructor owns the course
        if quiz.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        if not data or 'question_text' not in data or 'answers' not in data:
            return jsonify({"message": "Question text and answers are required"}), 400
        
        question = Question(
            quiz_id=quiz_id,
            question_text=data['question_text'],
            question_type=data.get('question_type', 'multiple_choice'),
            points=data.get('points', 1),
            order=data.get('order', 1),
            explanation=data.get('explanation', '')
        )
        
        db.session.add(question)
        db.session.flush()  # Get the question ID
        
        # Add answers
        answers_data = data['answers']
        for answer_data in answers_data:
            answer = Answer(
                question_id=question.id,
                answer_text=answer_data['answer_text'],
                is_correct=answer_data.get('is_correct', False),
                order=answer_data.get('order', 1)
            )
            db.session.add(answer)
        
        db.session.commit()
        
        return jsonify({
            "message": "Question added successfully",
            "question": question.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to add question", "error": str(e)}), 500

# =====================
# ASSIGNMENT MANAGEMENT
# =====================

@instructor_assessment_bp.route("/assignments", methods=["POST"])
@instructor_required
def create_assignment():
    """Create a new assignment for a course"""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        if not data or 'course_id' not in data:
            return jsonify({"message": "Course ID is required"}), 400
        
        course_id = data['course_id']
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Handle date parsing
        due_date = None
        if data.get('due_date'):
            try:
                # Handle both ISO format and datetime-local format
                date_str = data['due_date']
                if 'T' in date_str and not date_str.endswith('Z') and '+' not in date_str:
                    # datetime-local format, add timezone info
                    due_date = datetime.fromisoformat(date_str)
                else:
                    # ISO format with timezone
                    due_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            except ValueError as e:
                return jsonify({"message": f"Invalid due_date format: {str(e)}"}), 400
        
        assignment = Assignment(
            title=data.get('title', ''),
            description=data.get('description', ''),
            instructions=data.get('instructions', ''),
            course_id=course_id,
            module_id=data.get('module_id'),
            lesson_id=data.get('lesson_id'),
            instructor_id=current_user_id,
            assignment_type=data.get('assignment_type', 'file_upload'),  # Map to model field
            max_file_size_mb=data.get('max_file_size_mb', 10),
            allowed_file_types=data.get('allowed_file_types', ''),
            due_date=due_date,
            points_possible=data.get('points_possible', 100.0),  # Map to model field
            is_published=data.get('is_published', False),
            allow_late_submission=data.get('allow_late_submission', True),
            late_penalty=data.get('late_penalty', 0.0)
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

@instructor_assessment_bp.route("/assignments/<int:assignment_id>", methods=["PUT"])
@instructor_required
def update_assignment(assignment_id):
    """Update an existing assignment"""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        assignment = Assignment.query.get(assignment_id)
        if not assignment:
            return jsonify({"message": "Assignment not found"}), 404
        
        # Verify instructor owns the course
        if assignment.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        # Update assignment fields
        if 'title' in data:
            assignment.title = data['title']
        if 'description' in data:
            assignment.description = data['description']
        if 'max_points' in data:
            assignment.max_points = data['max_points']
        if 'due_date' in data:
            assignment.due_date = datetime.fromisoformat(data['due_date']) if data['due_date'] else None
        if 'submission_type' in data:
            assignment.submission_type = data['submission_type']
        if 'instructions' in data:
            assignment.instructions = data['instructions']
        if 'allow_late_submission' in data:
            assignment.allow_late_submission = data['allow_late_submission']
        if 'late_penalty' in data:
            assignment.late_penalty = data['late_penalty']
        
        db.session.commit()
        
        return jsonify({
            "message": "Assignment updated successfully",
            "assignment": assignment.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to update assignment", "error": str(e)}), 500

@instructor_assessment_bp.route("/assignments/<int:assignment_id>", methods=["DELETE"])
@instructor_required
def delete_assignment(assignment_id):
    """Delete an assignment"""
    try:
        current_user_id = int(get_jwt_identity())
        
        assignment = Assignment.query.get(assignment_id)
        if not assignment:
            return jsonify({"message": "Assignment not found"}), 404
        
        # Verify instructor owns the course
        if assignment.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        db.session.delete(assignment)
        db.session.commit()
        
        return jsonify({"message": "Assignment deleted successfully"}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to delete assignment", "error": str(e)}), 500

# =====================
# PROJECT MANAGEMENT
# =====================

@instructor_assessment_bp.route("/projects", methods=["POST"])
@instructor_required
def create_project():
    """Create a new project for a course"""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        if not data or 'course_id' not in data:
            return jsonify({"message": "Course ID is required"}), 400
        
        course_id = data['course_id']
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Handle date parsing
        due_date = None
        if data.get('due_date'):
            try:
                # Handle both ISO format and datetime-local format
                date_str = data['due_date']
                if 'T' in date_str and not date_str.endswith('Z') and '+' not in date_str:
                    # datetime-local format, add timezone info
                    due_date = datetime.fromisoformat(date_str)
                else:
                    # ISO format with timezone
                    due_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            except ValueError as e:
                return jsonify({"message": f"Invalid due_date format: {str(e)}"}), 400
        
        # Handle module_ids as JSON string
        import json
        module_ids = json.dumps(data.get('module_ids', []))
        
        project = Project(
            title=data.get('title', ''),
            description=data.get('description', ''),
            objectives=data.get('objectives', ''),
            course_id=course_id,
            module_ids=module_ids,
            due_date=due_date,
            points_possible=data.get('points_possible', 100.0),
            is_published=data.get('is_published', False),
            submission_format=data.get('submission_format', 'file_upload'),
            max_file_size_mb=data.get('max_file_size_mb', 50),
            allowed_file_types=data.get('allowed_file_types', ''),
            collaboration_allowed=data.get('collaboration_allowed', False),
            max_team_size=data.get('max_team_size', 1)
        )
        
        db.session.add(project)
        db.session.commit()
        
        return jsonify({
            "message": "Project created successfully",
            "project": project.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to create project", "error": str(e)}), 500

@instructor_assessment_bp.route("/projects/<int:project_id>", methods=["PUT"])
@instructor_required
def update_project(project_id):
    """Update an existing project"""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        project = Project.query.get(project_id)
        if not project:
            return jsonify({"message": "Project not found"}), 404
        
        # Verify instructor owns the course
        if project.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        # Update project fields
        if 'title' in data:
            project.title = data['title']
        if 'description' in data:
            project.description = data['description']
        if 'max_points' in data:
            project.max_points = data['max_points']
        if 'due_date' in data:
            project.due_date = datetime.fromisoformat(data['due_date']) if data['due_date'] else None
        if 'requirements' in data:
            project.requirements = data['requirements']
        if 'deliverables' in data:
            project.deliverables = data['deliverables']
        if 'rubric' in data:
            project.rubric = data['rubric']
        if 'allow_group_work' in data:
            project.allow_group_work = data['allow_group_work']
        if 'max_group_size' in data:
            project.max_group_size = data['max_group_size']
        
        db.session.commit()
        
        return jsonify({
            "message": "Project updated successfully",
            "project": project.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to update project", "error": str(e)}), 500

@instructor_assessment_bp.route("/projects/<int:project_id>", methods=["DELETE"])
@instructor_required
def delete_project(project_id):
    """Delete a project"""
    try:
        current_user_id = int(get_jwt_identity())
        
        project = Project.query.get(project_id)
        if not project:
            return jsonify({"message": "Project not found"}), 404
        
        # Verify instructor owns the course
        if project.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        db.session.delete(project)
        db.session.commit()
        
        return jsonify({"message": "Project deleted successfully"}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to delete project", "error": str(e)}), 500

# =====================
# ASSESSMENT OVERVIEW
# =====================

@instructor_assessment_bp.route("/courses/<int:course_id>/overview", methods=["GET"])
@instructor_required
def get_assessments_overview(course_id):
    """Get overview of all assessments for a course"""
    try:
        current_user_id = int(get_jwt_identity())
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Get all assessments
        quizzes = Quiz.query.filter_by(course_id=course_id).all()
        assignments = Assignment.query.filter_by(course_id=course_id).all()
        projects = Project.query.filter_by(course_id=course_id).all()
        
        return jsonify({
            "quizzes": [quiz.to_dict() for quiz in quizzes],
            "assignments": [assignment.to_dict() for assignment in assignments],
            "projects": [project.to_dict() for project in projects]
        }), 200
        
    except Exception as e:
        return jsonify({"message": "Failed to fetch assessments overview", "error": str(e)}), 500