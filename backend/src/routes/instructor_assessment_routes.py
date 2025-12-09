# Instructor Assessment API Routes for Afritec Bridge LMS
# CODE UPDATED: 2025-11-02 09:56:00

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError
from datetime import datetime
import logging

# Setup logger
logger = logging.getLogger(__name__)
logger.info("instructor_assessment_routes.py MODULE LOADED - CODE VERSION 2025-11-02")

from ..models.user_models import db, User, Role
from ..models.course_models import (
    Course, Module, Lesson, Quiz, Question, Answer, 
    Assignment, AssignmentSubmission, Project, ProjectSubmission, 
    Submission
)

# Helper for role checking
from functools import wraps

def get_user_id():
    """Helper function to get user ID as integer from JWT"""
    try:
        user_id = get_jwt_identity()
        return int(user_id) if user_id is not None else None
    except (ValueError, TypeError) as e:
        logger.error(f"ERROR in get_user_id: {e}")
        return None

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

# Log that this module was loaded
print("=" * 80, flush=True)
print("INSTRUCTOR ASSESSMENT ROUTES LOADED - VERSION 2025-11-02 10:05", flush=True)
print("=" * 80, flush=True)
logger.info("=" * 80)
logger.info("INSTRUCTOR ASSESSMENT ROUTES LOADED - VERSION 2025-11-02 10:05")
logger.info("=" * 80)

# =====================
# QUIZ MANAGEMENT
# =====================

@instructor_assessment_bp.route("/quizzes", methods=["GET"])
@instructor_required
def get_instructor_quizzes():
    """Get all quizzes for instructor's courses"""
    try:
        current_user_id = get_user_id()
        
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
        current_user_id = get_user_id()
        data = request.get_json()
        
        # Debug logging using BOTH print and logger for visibility
        print("\n" + "="*80, flush=True)
        print("CREATE QUIZ ENDPOINT HIT - VERSION 2025-11-02 10:05", flush=True)
        print(f"Questions in request: {len(data.get('questions', []))}", flush=True)
        print("="*80 + "\n", flush=True)
        
        logger.info("="*80)
        logger.info("CREATE QUIZ ENDPOINT - VERSION 2025-11-02 10:05")
        logger.info(f"Received data keys: {list(data.keys())}")
        logger.info(f"Questions count in data: {len(data.get('questions', []))}")
        logger.info(f"Quiz settings: time_limit={data.get('time_limit')}, max_attempts={data.get('max_attempts')}, passing_score={data.get('passing_score')}")
        logger.info("="*80)
        
        # Test database connection before proceeding
        try:
            db.session.execute(db.text('SELECT 1'))
        except Exception as db_err:
            logger.error(f"Database connection error: {db_err}")
            db.session.rollback()
            # Try to reconnect
            try:
                db.session.remove()
                db.session.execute(db.text('SELECT 1'))
            except Exception as reconnect_err:
                logger.error(f"Database reconnection failed: {reconnect_err}")
                return jsonify({
                    "message": "Database connection error. Please try again.",
                    "error": "DATABASE_CONNECTION_ERROR"
                }), 500
        
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
        
        # Refresh quiz to get updated relationships
        db.session.refresh(quiz)
        
        # Debug: Check what was actually saved using BOTH print and logger
        print("\n" + "="*80, flush=True)
        print("QUIZ CREATED SUCCESSFULLY", flush=True)
        print(f"Quiz ID: {quiz.id}, Title: {quiz.title}", flush=True)
        
        # Get questions count properly (lazy='dynamic' returns query)
        questions_list = quiz.questions.all()
        print(f"Questions saved to DB: {len(questions_list)}", flush=True)
        print("="*80 + "\n", flush=True)
        
        logger.info("="*80)
        logger.info("QUIZ CREATED SUCCESSFULLY")
        logger.info(f"Quiz ID: {quiz.id}")
        logger.info(f"Quiz title: {quiz.title}")
        logger.info(f"Time limit: {quiz.time_limit}, Max attempts: {quiz.max_attempts}, Passing score: {quiz.passing_score}")
        logger.info(f"Shuffle: questions={quiz.shuffle_questions}, answers={quiz.shuffle_answers}")
        logger.info(f"Questions count: {len(questions_list)}")
        if questions_list:
            for q in questions_list:
                answers_list = q.answers.all()
                logger.info(f"  - Question {q.order}: {q.text[:30]}... ({len(answers_list)} answers)")
        logger.info("="*80)
        
        # Return quiz with questions
        return jsonify({
            "message": "Quiz created successfully",
            "quiz": quiz.to_dict(include_questions=True)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"ERROR creating quiz: {str(e)}")
        logger.exception(e)  # This will log the full stack trace
        print(f"\nERROR creating quiz: {str(e)}", flush=True)
        import traceback
        print(traceback.format_exc(), flush=True)
        return jsonify({
            "message": "Failed to create quiz", 
            "error": str(e),
            "error_type": type(e).__name__
        }), 500

@instructor_assessment_bp.route("/quizzes/<int:quiz_id>", methods=["PUT"])
@instructor_required
def update_quiz(quiz_id):
    """Update an existing quiz"""
    try:
        current_user_id = get_user_id()
        
        if current_user_id is None:
            logger.error("Could not extract user ID from JWT token")
            return jsonify({"message": "Authentication error"}), 401
        
        data = request.get_json()
        
        quiz = Quiz.query.get(quiz_id)
        if not quiz:
            return jsonify({"message": "Quiz not found"}), 404
        
        # Check if quiz has a course
        if not quiz.course:
            logger.error(f"Quiz {quiz_id} has no associated course (course_id={quiz.course_id})")
            return jsonify({
                "message": "Quiz has no associated course",
                "error": "invalid_quiz_state"
            }), 400
        
        # Log the comparison for debugging
        logger.info(f"Update quiz check: quiz.course.instructor_id={quiz.course.instructor_id}, current_user_id={current_user_id}")
        
        # Verify instructor owns the course
        if quiz.course.instructor_id != current_user_id:
            logger.warning(f"User {current_user_id} attempted to update quiz {quiz_id} owned by instructor {quiz.course.instructor_id}")
            return jsonify({
                "message": "Forbidden. You do not have permission to perform this action.",
                "error_type": "authorization_error",
                "details": {
                    "quiz_id": quiz_id,
                    "course_id": quiz.course_id,
                    "required_instructor_id": quiz.course.instructor_id,
                    "your_user_id": current_user_id
                }
            }), 403
        
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
        current_user_id = get_user_id()
        
        if current_user_id is None:
            logger.error("Could not extract user ID from JWT token")
            return jsonify({"message": "Authentication error"}), 401
        
        quiz = Quiz.query.get(quiz_id)
        if not quiz:
            return jsonify({"message": "Quiz not found"}), 404
        
        # Check if quiz has a course
        if not quiz.course:
            logger.error(f"Quiz {quiz_id} has no associated course (course_id={quiz.course_id})")
            return jsonify({
                "message": "Quiz has no associated course",
                "error": "invalid_quiz_state"
            }), 400
        
        # Log the comparison for debugging
        logger.info(f"Delete quiz check: quiz.course.instructor_id={quiz.course.instructor_id} (type: {type(quiz.course.instructor_id)}), current_user_id={current_user_id} (type: {type(current_user_id)})")
        
        # Verify instructor owns the course
        if quiz.course.instructor_id != current_user_id:
            logger.warning(f"User {current_user_id} attempted to delete quiz {quiz_id} owned by instructor {quiz.course.instructor_id}")
            return jsonify({
                "message": "Forbidden. You do not have permission to perform this action.",
                "error_type": "authorization_error",
                "details": {
                    "quiz_id": quiz_id,
                    "course_id": quiz.course_id,
                    "required_instructor_id": quiz.course.instructor_id,
                    "your_user_id": current_user_id
                }
            }), 403
        
        db.session.delete(quiz)
        db.session.commit()
        
        logger.info(f"Quiz {quiz_id} deleted successfully by user {current_user_id}")
        return jsonify({"message": "Quiz deleted successfully"}), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting quiz {quiz_id}: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to delete quiz", "error": str(e)}), 500

@instructor_assessment_bp.route("/quizzes/<int:quiz_id>/questions", methods=["POST"])
@instructor_required
def add_quiz_question(quiz_id):
    """Add a question to a quiz"""
    try:
        current_user_id = get_user_id()
        
        if current_user_id is None:
            logger.error("Could not extract user ID from JWT token")
            return jsonify({"message": "Authentication error"}), 401
        
        data = request.get_json()
        
        quiz = Quiz.query.get(quiz_id)
        if not quiz:
            return jsonify({"message": "Quiz not found"}), 404
        
        # Check if quiz has a course
        if not quiz.course:
            logger.error(f"Quiz {quiz_id} has no associated course")
            return jsonify({"message": "Quiz has no associated course"}), 400
        
        # Verify instructor owns the course
        if quiz.course.instructor_id != current_user_id:
            logger.warning(f"User {current_user_id} attempted to add question to quiz {quiz_id} owned by instructor {quiz.course.instructor_id}")
            return jsonify({
                "message": "Forbidden. You do not have permission to perform this action.",
                "error_type": "authorization_error"
            }), 403
        
        # Accept both 'question_text' and 'text' for compatibility
        question_text = data.get('question_text') or data.get('text')
        if not question_text:
            return jsonify({"message": "Question text is required"}), 400

        question_type = data.get('question_type', 'multiple_choice')
        is_answer_based = question_type in ('multiple_choice', 'true_false')
        answers_payload = data.get('answers') or []

        if is_answer_based:
            if not answers_payload:
                return jsonify({"message": "Answers are required for this question type"}), 400

            has_correct_answer = any(
                isinstance(answer_data, dict) and bool(answer_data.get('is_correct')) and (answer_data.get('answer_text') or answer_data.get('text'))
                for answer_data in answers_payload
            )
            if not has_correct_answer:
                return jsonify({"message": "At least one correct answer is required for this question type"}), 400
        
        # Get the next order number
        last_question = Question.query.filter_by(quiz_id=quiz_id).order_by(Question.order.desc()).first()
        next_order = (last_question.order + 1) if last_question else 1
        
        question = Question(
            quiz_id=quiz_id,
            text=question_text,
            question_type=question_type,
            order=data.get('order', next_order),
            points=float(data.get('points', 10.0)),
            explanation=data.get('explanation', '')
        )
        
        db.session.add(question)
        db.session.flush()  # Get the question ID
        
        if is_answer_based:
            # Add answers
            for answer_data in answers_payload:
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
            "question": question.to_dict(include_answers=True)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to add question", "error": str(e)}), 500

@instructor_assessment_bp.route("/quizzes/<int:quiz_id>/questions/bulk", methods=["POST"])
@instructor_required
def add_bulk_quiz_questions(quiz_id):
    """Add multiple questions to a quiz at once"""
    try:
        current_user_id = get_user_id()
        
        if current_user_id is None:
            logger.error("Could not extract user ID from JWT token")
            return jsonify({"message": "Authentication error"}), 401
        
        data = request.get_json()
        
        quiz = Quiz.query.get(quiz_id)
        if not quiz:
            return jsonify({"message": "Quiz not found"}), 404
        
        # Check if quiz has a course
        if not quiz.course:
            logger.error(f"Quiz {quiz_id} has no associated course")
            return jsonify({"message": "Quiz has no associated course"}), 400
        
        # Verify instructor owns the course
        if quiz.course.instructor_id != current_user_id:
            logger.warning(f"User {current_user_id} attempted to add bulk questions to quiz {quiz_id} owned by instructor {quiz.course.instructor_id}")
            return jsonify({
                "message": "Forbidden. You do not have permission to perform this action.",
                "error_type": "authorization_error"
            }), 403
        
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
            
            question_type = question_data.get('question_type', 'multiple_choice')
            is_answer_based = question_type in ('multiple_choice', 'true_false')

            answers_payload = question_data.get('answers') or []
            if is_answer_based:
                if not answers_payload:
                    logger.warning("Skipping question without answers for quiz %s", quiz_id)
                    continue  # Skip invalid question definitions

                has_correct_answer = any(
                    isinstance(answer_record, dict) and bool(answer_record.get('is_correct')) and (answer_record.get('answer_text') or answer_record.get('text'))
                    for answer_record in answers_payload
                )
                if not has_correct_answer:
                    logger.warning("Skipping question without a correct answer for quiz %s", quiz_id)
                    continue
            
            question = Question(
                quiz_id=quiz_id,
                text=question_text,
                question_type=question_type,
                order=next_order + idx,
                points=float(question_data.get('points', 10.0)),
                explanation=question_data.get('explanation', '')
            )
            
            db.session.add(question)
            db.session.flush()  # Get the question ID
            
            # Add answers
            if is_answer_based:
                for answer_data in answers_payload:
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

@instructor_assessment_bp.route("/quizzes/<int:quiz_id>/questions/<int:question_id>", methods=["PUT"])
@instructor_required
def update_quiz_question(quiz_id, question_id):
    """Update an existing quiz question and its answers"""
    try:
        current_user_id = get_user_id()

        if current_user_id is None:
            logger.error("Could not extract user ID from JWT token")
            return jsonify({"message": "Authentication error"}), 401

        data = request.get_json() or {}

        quiz = Quiz.query.get(quiz_id)
        if not quiz:
            return jsonify({"message": "Quiz not found"}), 404

        if not quiz.course:
            logger.error(f"Quiz {quiz_id} has no associated course")
            return jsonify({"message": "Quiz has no associated course"}), 400

        if quiz.course.instructor_id != current_user_id:
            logger.warning(
                "User %s attempted to update question %s on quiz %s owned by instructor %s",
                current_user_id,
                question_id,
                quiz_id,
                quiz.course.instructor_id
            )
            return jsonify({
                "message": "Forbidden. You do not have permission to perform this action.",
                "error_type": "authorization_error"
            }), 403

        question = Question.query.filter_by(id=question_id, quiz_id=quiz_id).first()
        if not question:
            return jsonify({"message": "Question not found"}), 404

        question_text = data.get('question_text') or data.get('text')
        if question_text:
            question.text = question_text

        if 'question_type' in data and data['question_type']:
            question.question_type = data['question_type']

        if 'points' in data and data['points'] is not None:
            try:
                question.points = float(data['points'])
            except (TypeError, ValueError):
                pass

        if 'explanation' in data:
            question.explanation = data['explanation'] or None

        if 'order' in data and data['order'] is not None:
            try:
                question.order = int(data['order'])
            except (TypeError, ValueError):
                pass
        elif 'order_index' in data and data['order_index'] is not None:
            try:
                question.order = int(data['order_index'])
            except (TypeError, ValueError):
                pass

        answers_payload = data.get('answers')
        if answers_payload is not None:
            target_question_type = data.get('question_type', question.question_type)
            is_answer_based = target_question_type in ('multiple_choice', 'true_false')

            if is_answer_based:
                has_correct_answer = any(
                    isinstance(answer_data, dict) and bool(answer_data.get('is_correct')) and (answer_data.get('answer_text') or answer_data.get('text'))
                    for answer_data in answers_payload
                )
                if not has_correct_answer:
                    return jsonify({"message": "At least one correct answer is required for this question type"}), 400

                existing_answers = {answer.id: answer for answer in question.answers.all()}
                processed_answer_ids = set()

                for answer_data in answers_payload:
                    if not isinstance(answer_data, dict):
                        continue

                    answer_id = answer_data.get('id')
                    answer_text = answer_data.get('answer_text') or answer_data.get('text')
                    if not answer_text:
                        continue

                    is_correct = bool(answer_data.get('is_correct', False))

                    if answer_id and answer_id in existing_answers:
                        answer = existing_answers[answer_id]
                        answer.text = answer_text
                        answer.is_correct = is_correct
                        processed_answer_ids.add(answer_id)
                    else:
                        answer = Answer(
                            question_id=question.id,
                            text=answer_text,
                            is_correct=is_correct
                        )
                        db.session.add(answer)

                # Remove answers that were not included in payload
                for answer_id, answer in existing_answers.items():
                    if answer_id not in processed_answer_ids:
                        db.session.delete(answer)
            else:
                # For non answer-based questions, clear any existing answers
                for answer in question.answers.all():
                    db.session.delete(answer)

        db.session.commit()

        return jsonify({
            "message": "Question updated successfully",
            "question": question.to_dict(include_answers=True)
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to update question {question_id} for quiz {quiz_id}: {e}", exc_info=True)
        return jsonify({"message": "Failed to update question", "error": str(e)}), 500

@instructor_assessment_bp.route("/quizzes/<int:quiz_id>/questions/<int:question_id>", methods=["DELETE"])
@instructor_required
def delete_quiz_question(quiz_id, question_id):
    """Delete a quiz question"""
    try:
        current_user_id = get_user_id()

        if current_user_id is None:
            logger.error("Could not extract user ID from JWT token")
            return jsonify({"message": "Authentication error"}), 401

        quiz = Quiz.query.get(quiz_id)
        if not quiz:
            return jsonify({"message": "Quiz not found"}), 404

        if not quiz.course:
            logger.error(f"Quiz {quiz_id} has no associated course")
            return jsonify({"message": "Quiz has no associated course"}), 400

        if quiz.course.instructor_id != current_user_id:
            logger.warning(
                "User %s attempted to delete question %s on quiz %s owned by instructor %s",
                current_user_id,
                question_id,
                quiz_id,
                quiz.course.instructor_id
            )
            return jsonify({
                "message": "Forbidden. You do not have permission to perform this action.",
                "error_type": "authorization_error"
            }), 403

        question = Question.query.filter_by(id=question_id, quiz_id=quiz_id).first()
        if not question:
            return jsonify({"message": "Question not found"}), 404

        db.session.delete(question)
        db.session.commit()

        return jsonify({"message": "Question deleted successfully"}), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to delete question {question_id} for quiz {quiz_id}: {e}", exc_info=True)
        return jsonify({"message": "Failed to delete question", "error": str(e)}), 500

@instructor_assessment_bp.route("/quizzes/<int:quiz_id>/questions/reorder", methods=["POST"])
@instructor_required
def reorder_quiz_questions(quiz_id):
    """Reorder quiz questions based on provided order"""
    try:
        current_user_id = get_user_id()

        if current_user_id is None:
            logger.error("Could not extract user ID from JWT token")
            return jsonify({"message": "Authentication error"}), 401

        data = request.get_json() or {}
        question_order = data.get('order') or data.get('question_ids')

        if not question_order or not isinstance(question_order, list):
            return jsonify({"message": "Order array is required"}), 400

        try:
            normalized_order = [int(question_id) for question_id in question_order]
        except (TypeError, ValueError):
            return jsonify({"message": "Order array must contain valid question IDs"}), 400

        quiz = Quiz.query.get(quiz_id)
        if not quiz:
            return jsonify({"message": "Quiz not found"}), 404

        if not quiz.course:
            logger.error(f"Quiz {quiz_id} has no associated course")
            return jsonify({"message": "Quiz has no associated course"}), 400

        if quiz.course.instructor_id != current_user_id:
            logger.warning(
                "User %s attempted to reorder questions on quiz %s owned by instructor %s",
                current_user_id,
                quiz_id,
                quiz.course.instructor_id
            )
            return jsonify({
                "message": "Forbidden. You do not have permission to perform this action.",
                "error_type": "authorization_error"
            }), 403

        questions = Question.query.filter_by(quiz_id=quiz_id).all()
        existing_ids = {q.id for q in questions}

        # Validate that all provided IDs are valid questions in this quiz
        provided_set = set(normalized_order)
        invalid_ids = provided_set - existing_ids
        if invalid_ids:
            return jsonify({
                "message": f"Invalid question IDs provided: {list(invalid_ids)}",
                "status": 400,
                "error_type": "validation_error"
            }), 400

        # If partial order provided, only update those questions; others keep existing order
        if len(normalized_order) != len(existing_ids):
            # Re-order only the provided questions at the beginning
            order_map = {question_id: index + 1 for index, question_id in enumerate(normalized_order)}
            # Shift remaining questions after the provided ones
            remaining_order = len(normalized_order) + 1
            for question in questions:
                if question.id in order_map:
                    question.order = order_map[question.id]
                elif question.id not in provided_set:
                    question.order = remaining_order
                    remaining_order += 1
        else:
            # Full reorder provided
            order_map = {question_id: index + 1 for index, question_id in enumerate(normalized_order)}
            for question in questions:
                question.order = order_map.get(question.id, question.order)

        db.session.commit()

        return jsonify({
            "message": "Questions reordered successfully",
            "questions": [q.to_dict(include_answers=True) for q in Question.query.filter_by(quiz_id=quiz_id).order_by(Question.order).all()]
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to reorder questions for quiz {quiz_id}: {e}", exc_info=True)
        return jsonify({"message": "Failed to reorder questions", "error": str(e)}), 500

# =====================
# ASSIGNMENT MANAGEMENT
# =====================

@instructor_assessment_bp.route("/assignments", methods=["POST"])
@instructor_required
def create_assignment():
    """Create a new assignment for a course"""
    try:
        current_user_id = get_user_id()
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
        print(f"UPDATE ASSIGNMENT - START - assignment_id={assignment_id}", flush=True)
        current_user_id = get_user_id()
        print(f"UPDATE ASSIGNMENT - current_user_id={current_user_id} (type: {type(current_user_id)})", flush=True)
        
        if current_user_id is None:
            logger.error("Could not extract user ID from JWT token")
            return jsonify({"message": "Authentication error"}), 401
        
        data = request.get_json()
        
        assignment = Assignment.query.get(assignment_id)
        if not assignment:
            return jsonify({"message": "Assignment not found"}), 404
        
        print(f"UPDATE ASSIGNMENT - assignment found: {assignment.title}", flush=True)
        print(f"UPDATE ASSIGNMENT - assignment.course_id={assignment.course_id}", flush=True)
        
        # Check if assignment has a course
        if not assignment.course:
            logger.error(f"Assignment {assignment_id} has no associated course (course_id={assignment.course_id})")
            return jsonify({
                "message": "Assignment has no associated course",
                "error": "invalid_assignment_state"
            }), 400
        
        print(f"UPDATE ASSIGNMENT - assignment.course.instructor_id={assignment.course.instructor_id} (type: {type(assignment.course.instructor_id)})", flush=True)
        
        # Log the comparison for debugging
        logger.info(f"Update assignment check: assignment.course.instructor_id={assignment.course.instructor_id}, current_user_id={current_user_id}")
        
        # Verify instructor owns the course
        if assignment.course.instructor_id != current_user_id:
            logger.warning(f"User {current_user_id} attempted to update assignment {assignment_id} owned by instructor {assignment.course.instructor_id}")
            return jsonify({
                "message": "Forbidden. You do not have permission to perform this action.",
                "error_type": "authorization_error",
                "details": {
                    "assignment_id": assignment_id,
                    "course_id": assignment.course_id,
                    "required_instructor_id": assignment.course.instructor_id,
                    "your_user_id": current_user_id
                }
            }), 403
        
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
        current_user_id = get_user_id()
        
        if current_user_id is None:
            logger.error("Could not extract user ID from JWT token")
            return jsonify({"message": "Authentication error"}), 401
        
        assignment = Assignment.query.get(assignment_id)
        if not assignment:
            return jsonify({"message": "Assignment not found"}), 404
        
        # Check if assignment has a course
        if not assignment.course:
            logger.error(f"Assignment {assignment_id} has no associated course (course_id={assignment.course_id})")
            return jsonify({
                "message": "Assignment has no associated course",
                "error": "invalid_assignment_state"
            }), 400
        
        # Log the comparison for debugging
        logger.info(f"Delete assignment check: assignment.course.instructor_id={assignment.course.instructor_id} (type: {type(assignment.course.instructor_id)}), current_user_id={current_user_id} (type: {type(current_user_id)})")
        
        # Verify instructor owns the course
        if assignment.course.instructor_id != current_user_id:
            logger.warning(f"User {current_user_id} attempted to delete assignment {assignment_id} owned by instructor {assignment.course.instructor_id}")
            return jsonify({
                "message": "Forbidden. You do not have permission to perform this action.",
                "error_type": "authorization_error",
                "details": {
                    "assignment_id": assignment_id,
                    "course_id": assignment.course_id,
                    "required_instructor_id": assignment.course.instructor_id,
                    "your_user_id": current_user_id
                }
            }), 403
        
        db.session.delete(assignment)
        db.session.commit()
        
        logger.info(f"Assignment {assignment_id} deleted successfully by user {current_user_id}")
        return jsonify({"message": "Assignment deleted successfully"}), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting assignment {assignment_id}: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to delete assignment", "error": str(e)}), 500

# =====================
# PROJECT MANAGEMENT
# =====================

@instructor_assessment_bp.route("/projects", methods=["POST"])
@instructor_required
def create_project():
    """Create a new project for a course"""
    try:
        current_user_id = get_user_id()
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
        current_user_id = get_user_id()
        
        if current_user_id is None:
            logger.error("Could not extract user ID from JWT token")
            return jsonify({"message": "Authentication error"}), 401
        
        data = request.get_json()
        
        project = Project.query.get(project_id)
        if not project:
            return jsonify({"message": "Project not found"}), 404
        
        # Check if project has a course
        if not project.course:
            logger.error(f"Project {project_id} has no associated course (course_id={project.course_id})")
            return jsonify({
                "message": "Project has no associated course",
                "error": "invalid_project_state"
            }), 400
        
        # Log the comparison for debugging
        logger.info(f"Update project check: project.course.instructor_id={project.course.instructor_id}, current_user_id={current_user_id}")
        
        # Verify instructor owns the course
        if project.course.instructor_id != current_user_id:
            logger.warning(f"User {current_user_id} attempted to update project {project_id} owned by instructor {project.course.instructor_id}")
            return jsonify({
                "message": "Forbidden. You do not have permission to perform this action.",
                "error_type": "authorization_error",
                "details": {
                    "project_id": project_id,
                    "course_id": project.course_id,
                    "required_instructor_id": project.course.instructor_id,
                    "your_user_id": current_user_id
                }
            }), 403
        
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
        current_user_id = get_user_id()
        
        if current_user_id is None:
            logger.error("Could not extract user ID from JWT token")
            return jsonify({"message": "Authentication error"}), 401
        
        project = Project.query.get(project_id)
        if not project:
            return jsonify({"message": "Project not found"}), 404
        
        # Check if project has a course
        if not project.course:
            logger.error(f"Project {project_id} has no associated course (course_id={project.course_id})")
            return jsonify({
                "message": "Project has no associated course",
                "error": "invalid_project_state"
            }), 400
        
        # Log the comparison for debugging
        logger.info(f"Delete project check: project.course.instructor_id={project.course.instructor_id} (type: {type(project.course.instructor_id)}), current_user_id={current_user_id} (type: {type(current_user_id)})")
        
        # Verify instructor owns the course
        if project.course.instructor_id != current_user_id:
            logger.warning(f"User {current_user_id} attempted to delete project {project_id} owned by instructor {project.course.instructor_id}")
            return jsonify({
                "message": "Forbidden. You do not have permission to perform this action.",
                "error_type": "authorization_error",
                "details": {
                    "project_id": project_id,
                    "course_id": project.course_id,
                    "required_instructor_id": project.course.instructor_id,
                    "your_user_id": current_user_id
                }
            }), 403
        
        db.session.delete(project)
        db.session.commit()
        
        logger.info(f"Project {project_id} deleted successfully by user {current_user_id}")
        return jsonify({"message": "Project deleted successfully"}), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting project {project_id}: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to delete project", "error": str(e)}), 500

# =====================
# ASSESSMENT OVERVIEW
# =====================

@instructor_assessment_bp.route("/courses/<int:course_id>/overview", methods=["GET"])
@instructor_required
def get_assessments_overview(course_id):
    """Get overview of all assessments for a course"""
    try:
        current_user_id = get_user_id()
        logger.info(f"[OVERVIEW] Fetching assessments for course {course_id} by user {current_user_id}")
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            logger.warning(f"[OVERVIEW] Course {course_id} not found or access denied for user {current_user_id}")
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Get all assessments
        quizzes = Quiz.query.filter_by(course_id=course_id).all()
        assignments = Assignment.query.filter_by(course_id=course_id).all()
        projects = Project.query.filter_by(course_id=course_id).all()
        
        logger.info(f"[OVERVIEW] Found {len(quizzes)} quizzes, {len(assignments)} assignments, {len(projects)} projects")
        
        # Build response with questions
        quizzes_data = []
        for quiz in quizzes:
            quiz_dict = quiz.to_dict(include_questions=True)
            question_count = len(quiz_dict.get('questions', []))
            logger.info(f"[OVERVIEW] Quiz {quiz.id} '{quiz.title}': {question_count} questions")
            logger.debug(f"[OVERVIEW] quiz_dict keys: {list(quiz_dict.keys())}")
            logger.debug(f"[OVERVIEW] quiz_dict['questions'] type: {type(quiz_dict.get('questions'))}")
            
            # Log first question details if available
            if quiz_dict.get('questions'):
                first_q = quiz_dict['questions'][0]
                logger.debug(f"[OVERVIEW] Quiz {quiz.id} first question: {first_q.get('question_text', 'N/A')} ({len(first_q.get('answers', []))} answers)")
            
            quizzes_data.append(quiz_dict)
        
        assignments_data = [assignment.to_dict() for assignment in assignments]
        projects_data = [project.to_dict() for project in projects]
        
        response_data = {
            "quizzes": quizzes_data,
            "assignments": assignments_data,
            "projects": projects_data
        }
        
        logger.info(f"[OVERVIEW] Response quizzes count: {len(response_data['quizzes'])}")
        if response_data['quizzes']:
            first_quiz = response_data['quizzes'][0]
            logger.info(f"[OVERVIEW] First quiz ID: {first_quiz.get('id')}, Title: {first_quiz.get('title')}")
            logger.info(f"[OVERVIEW] First quiz keys: {list(first_quiz.keys())}")
            logger.info(f"[OVERVIEW] First quiz has 'questions' key: {'questions' in first_quiz}")
            logger.info(f"[OVERVIEW] First quiz questions count: {len(first_quiz.get('questions', []))}")
        
        logger.info(f"[OVERVIEW] Sending response with {len(quizzes_data)} quizzes")
        logger.info(f"[OVERVIEW] Response data type: {type(response_data)}")
        
        result = jsonify(response_data)
        logger.info(f"[OVERVIEW] jsonify result type: {type(result)}")
        
        return result, 200
        
    except Exception as e:
        logger.error(f"[OVERVIEW] Failed to fetch assessments for course {course_id}: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to fetch assessments overview", "error": str(e)}), 500