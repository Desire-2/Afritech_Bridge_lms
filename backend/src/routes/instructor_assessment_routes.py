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

@instructor_assessment_bp.route("/quizzes", methods=["GET"])
@instructor_required
def get_instructor_quizzes():
    """Get all quizzes for instructor's courses"""
    try:
        current_user_id = int(get_jwt_identity())
        
        # Get all courses taught by the instructor
        courses = Course.query.filter_by(instructor_id=current_user_id).all()
        course_ids = [course.id for course in courses]
        
        if not course_ids:
            return jsonify([]), 200
        
        # Get all quizzes for these courses
        quizzes = Quiz.query.filter(Quiz.course_id.in_(course_ids)).all()
        
        # Return quizzes with enhanced data
        quizzes_data = []
        for quiz in quizzes:
            quiz_dict = quiz.to_dict(include_questions=True)
            # Add course title for display
            course = next((c for c in courses if c.id == quiz.course_id), None)
            if course:
                quiz_dict['course_title'] = course.title
            quizzes_data.append(quiz_dict)
        
        return jsonify(quizzes_data), 200
        
    except Exception as e:
        return jsonify({"message": "Failed to fetch quizzes", "error": str(e)}), 500

@instructor_assessment_bp.route("/quizzes", methods=["POST"])
@instructor_required
def create_quiz():
    """Create a new quiz for a course with optional questions"""
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
        
        # Handle due_date parsing
        due_date = None
        if data.get('due_date'):
            try:
                date_str = data['due_date']
                if 'T' in date_str and not date_str.endswith('Z') and '+' not in date_str:
                    due_date = datetime.fromisoformat(date_str)
                else:
                    due_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                pass  # Invalid date format, keep as None
        
        quiz = Quiz(
            title=data.get('title', ''),
            description=data.get('description', ''),
            course_id=course_id,
            module_id=module_id,
            lesson_id=data.get('lesson_id'),
            is_published=data.get('is_published', False),
            time_limit=int(data['time_limit']) if data.get('time_limit') and str(data['time_limit']).strip() else None,
            max_attempts=int(data['max_attempts']) if data.get('max_attempts') and str(data['max_attempts']).strip() else None,
            passing_score=int(data.get('passing_score', 70)),
            due_date=due_date,
            points_possible=float(data.get('points_possible', 100.0)),
            shuffle_questions=bool(data.get('shuffle_questions', False)),
            shuffle_answers=bool(data.get('shuffle_answers', False)),
            show_correct_answers=bool(data.get('show_correct_answers', True))
        )
        
        db.session.add(quiz)
        db.session.flush()  # Get quiz ID before adding questions
        
        # Add questions if provided
        questions_data = data.get('questions', [])
        if questions_data:
            for idx, question_data in enumerate(questions_data):
                # Support both 'text' and 'question_text' field names
                question_text = question_data.get('text') or question_data.get('question_text')
                if not question_text:
                    continue  # Skip questions without text
                
                question = Question(
                    quiz_id=quiz.id,
                    text=question_text,
                    question_type=question_data.get('question_type', 'multiple_choice'),
                    order=idx + 1,  # Auto-increment order based on array position
                    points=float(question_data.get('points', 10.0)),
                    explanation=question_data.get('explanation', '')
                )
                
                db.session.add(question)
                db.session.flush()  # Get question ID
                
                # Add answers if provided
                answers_data = question_data.get('answers', [])
                for answer_data in answers_data:
                    # Support both 'text' and 'answer_text' field names
                    answer_text = answer_data.get('text') or answer_data.get('answer_text')
                    if not answer_text:
                        continue  # Skip empty answers
                    
                    answer = Answer(
                        question_id=question.id,
                        text=answer_text,
                        is_correct=answer_data.get('is_correct', False)
                    )
                    db.session.add(answer)
        
        db.session.commit()
        
        # Return quiz with questions
        return jsonify({
            "message": "Quiz created successfully",
            "quiz": quiz.to_dict(include_questions=True)
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
        
        # Update quiz fields that exist in the model
        if 'title' in data:
            quiz.title = data['title']
        if 'description' in data:
            quiz.description = data['description']
        if 'is_published' in data:
            quiz.is_published = data['is_published']
        if 'module_id' in data:
            quiz.module_id = data['module_id']
        if 'lesson_id' in data:
            quiz.lesson_id = data['lesson_id']
        
        # Update quiz settings fields
        if 'time_limit' in data:
            quiz.time_limit = int(data['time_limit']) if data['time_limit'] and str(data['time_limit']).strip() else None
        if 'max_attempts' in data:
            quiz.max_attempts = int(data['max_attempts']) if data['max_attempts'] and str(data['max_attempts']).strip() else None
        if 'passing_score' in data:
            quiz.passing_score = int(data['passing_score']) if data['passing_score'] else 70
        if 'due_date' in data:
            if data['due_date']:
                try:
                    date_str = data['due_date']
                    if 'T' in date_str and not date_str.endswith('Z') and '+' not in date_str:
                        quiz.due_date = datetime.fromisoformat(date_str)
                    else:
                        quiz.due_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                except (ValueError, AttributeError):
                    pass
            else:
                quiz.due_date = None
        if 'points_possible' in data:
            quiz.points_possible = float(data['points_possible']) if data['points_possible'] else 100.0
        if 'shuffle_questions' in data:
            quiz.shuffle_questions = bool(data['shuffle_questions'])
        if 'shuffle_answers' in data:
            quiz.shuffle_answers = bool(data['shuffle_answers'])
        if 'show_correct_answers' in data:
            quiz.show_correct_answers = bool(data['show_correct_answers'])
        
        db.session.commit()
        
        return jsonify({
            "message": "Quiz updated successfully",
            "quiz": quiz.to_dict(include_questions=True)
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
        
        # Accept both 'question_text' and 'text' for compatibility
        question_text = data.get('question_text') or data.get('text')
        if not question_text or 'answers' not in data:
            return jsonify({"message": "Question text and answers are required"}), 400
        
        # Get the next order number
        last_question = Question.query.filter_by(quiz_id=quiz_id).order_by(Question.order.desc()).first()
        next_order = (last_question.order + 1) if last_question else 1
        
        question = Question(
            quiz_id=quiz_id,
            text=question_text,
            question_type=data.get('question_type', 'multiple_choice'),
            order=data.get('order', next_order),
            points=float(data.get('points', 10.0)),
            explanation=data.get('explanation', '')
        )
        
        db.session.add(question)
        db.session.flush()  # Get the question ID
        
        # Add answers
        answers_data = data['answers']
        for answer_data in answers_data:
            # Accept both 'answer_text' and 'text' for compatibility
            answer_text = answer_data.get('answer_text') or answer_data.get('text')
            if not answer_text:
                continue  # Skip empty answers
                
            answer = Answer(
                question_id=question.id,
                text=answer_text,
                is_correct=answer_data.get('is_correct', False)
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

@instructor_assessment_bp.route("/quizzes/<int:quiz_id>/questions/bulk", methods=["POST"])
@instructor_required
def add_bulk_quiz_questions(quiz_id):
    """Add multiple questions to a quiz at once"""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        quiz = Quiz.query.get(quiz_id)
        if not quiz:
            return jsonify({"message": "Quiz not found"}), 404
        
        # Verify instructor owns the course
        if quiz.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        questions_data = data.get('questions', [])
        if not questions_data or not isinstance(questions_data, list):
            return jsonify({"message": "Questions array is required"}), 400
        
        # Get the next order number
        last_question = Question.query.filter_by(quiz_id=quiz_id).order_by(Question.order.desc()).first()
        next_order = (last_question.order + 1) if last_question else 1
        
        added_questions = []
        
        for idx, question_data in enumerate(questions_data):
            # Support both 'text' and 'question_text' field names
            question_text = question_data.get('text') or question_data.get('question_text')
            if not question_text:
                continue  # Skip questions without text
            
            if 'answers' not in question_data or not question_data['answers']:
                continue  # Skip questions without answers
            
            question = Question(
                quiz_id=quiz_id,
                text=question_text,
                question_type=question_data.get('question_type', 'multiple_choice'),
                order=next_order + idx,
                points=float(question_data.get('points', 10.0)),
                explanation=question_data.get('explanation', '')
            )
            
            db.session.add(question)
            db.session.flush()  # Get the question ID
            
            # Add answers
            answers_data = question_data['answers']
            for answer_data in answers_data:
                # Support both 'text' and 'answer_text' field names
                answer_text = answer_data.get('text') or answer_data.get('answer_text')
                if not answer_text:
                    continue  # Skip empty answers
                    
                answer = Answer(
                    question_id=question.id,
                    text=answer_text,
                    is_correct=answer_data.get('is_correct', False)
                )
                db.session.add(answer)
            
            added_questions.append(question)
        
        db.session.commit()
        
        return jsonify({
            "message": f"Successfully added {len(added_questions)} questions",
            "questions": [q.to_dict(include_answers=True) for q in added_questions]
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to add questions", "error": str(e)}), 500

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
            is_published=data.get('is_published', False)
            # Note: allow_late_submission and late_penalty fields don't exist in Assignment model
            # They would need to be added via database migration if needed
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
        # Support both 'max_points' and 'points_possible' field names
        if 'max_points' in data or 'points_possible' in data:
            assignment.points_possible = data.get('points_possible') or data.get('max_points')
        if 'due_date' in data:
            assignment.due_date = datetime.fromisoformat(data['due_date']) if data['due_date'] else None
        if 'assignment_type' in data:
            assignment.assignment_type = data['assignment_type']
        if 'instructions' in data:
            assignment.instructions = data['instructions']
        if 'module_id' in data:
            assignment.module_id = data['module_id']
        if 'lesson_id' in data:
            assignment.lesson_id = data['lesson_id']
        if 'max_file_size_mb' in data:
            assignment.max_file_size_mb = data['max_file_size_mb']
        if 'allowed_file_types' in data:
            assignment.allowed_file_types = data['allowed_file_types']
        if 'is_published' in data:
            assignment.is_published = data['is_published']
        # Note: allow_late_submission and late_penalty fields don't exist in Assignment model
        # They would need to be added via database migration if needed
        
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
        # Support both 'max_points' and 'points_possible' field names
        if 'max_points' in data or 'points_possible' in data:
            project.points_possible = data.get('points_possible') or data.get('max_points')
        if 'due_date' in data:
            project.due_date = datetime.fromisoformat(data['due_date']) if data['due_date'] else None
        if 'objectives' in data:
            project.objectives = data['objectives']
        if 'module_ids' in data:
            import json
            project.module_ids = json.dumps(data['module_ids']) if isinstance(data['module_ids'], list) else data['module_ids']
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
        if 'is_published' in data:
            project.is_published = data['is_published']
        
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
            "quizzes": [quiz.to_dict(include_questions=True) for quiz in quizzes],
            "assignments": [assignment.to_dict() for assignment in assignments],
            "projects": [project.to_dict() for project in projects]
        }), 200
        
    except Exception as e:
        return jsonify({"message": "Failed to fetch assessments overview", "error": str(e)}), 500