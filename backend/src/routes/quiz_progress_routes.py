# quiz_progress_routes.py

from flask import Blueprint, request, jsonify
from .. import db
from ..models.user_models import User
from ..models.course_models import Course, Lesson, Module # Assuming these are in course_models
from ..models.quiz_progress_models import (
    Quiz, Question, QuestionOption, QuizAttempt, UserAnswer,
    UserProgress, LessonCompletion, ModuleCompletion, Badge, UserBadge, Certificate,
    QuizFeedbackPolicy, QuizPublishStatus, QuestionType, QuizAttemptStatus
)
from datetime import datetime
from sqlalchemy.exc import IntegrityError

# Placeholder for authentication and authorization
# In a real app, you would use Flask-Login, JWT, or similar
# and decorators like @login_required and role checks.

# For now, we might simulate a current_user or pass user_id if needed for routes
# For simplicity in this example, we'll assume user_id is passed or handled by a mock auth layer.

quiz_progress_bp = Blueprint("quiz_progress_api", __name__, url_prefix="/api")

# --- Helper Functions (example) ---
def get_current_user_id():
    # This is a placeholder. In a real app, get this from session or token.
    # For testing, you might allow it to be passed in request headers or args.
    # return request.headers.get("X-User-Id", 1) # Example: default to user 1
    # For now, let's assume some routes will require user_id explicitly if not an admin/instructor context
    user = User.query.first() # Fallback for now, REMOVE in production
    return user.id if user else 1

def is_instructor_or_admin(user_id, course_id=None):
    # Placeholder: Check if user_id is an instructor for the course or an admin
    user = User.query.get(user_id)
    if not user:
        return False
    if user.role == "admin": # Assuming User model has a 'role' field
        return True
    if course_id and user.role == "instructor":
        # Add logic to check if user is instructor for this specific course
        # e.g., through a CourseInstructorLink table
        course = Course.query.get(course_id)
        if course and user in course.instructors: # Assuming 'instructors' relationship on Course
             return True
    return False # Default to false

# --- Quiz Management API Routes (Instructors/Admins) ---

@quiz_progress_bp.route("/courses/<int:course_id>/quizzes", methods=["POST"])
def create_quiz(course_id):
    # auth_user_id = get_current_user_id()
    # if not is_instructor_or_admin(auth_user_id, course_id):
    #     return jsonify({"error": "Unauthorized"}), 403
    data = request.get_json()
    if not data or not data.get("title"):
        return jsonify({"error": "Missing required fields (title)"}), 400

    course = Course.query.get(course_id)
    if not course:
        return jsonify({"error": "Course not found"}), 404

    new_quiz = Quiz(
        course_id=course_id,
        title=data["title"],
        description=data.get("description"),
        time_limit_minutes=data.get("time_limit_minutes"),
        attempts_allowed=data.get("attempts_allowed"),
        passing_score_percentage=data.get("passing_score_percentage"),
        feedback_policy=QuizFeedbackPolicy[data.get("feedback_policy", "IMMEDIATE_SCORE_ONLY").upper()],
        shuffle_questions=data.get("shuffle_questions", False),
        shuffle_options=data.get("shuffle_options", False),
        publish_status=QuizPublishStatus[data.get("publish_status", "DRAFT").upper()],
        due_date=datetime.fromisoformat(data["due_date"]) if data.get("due_date") else None
    )
    db.session.add(new_quiz)
    db.session.commit()
    return jsonify({"message": "Quiz created successfully", "quiz_id": new_quiz.id}), 201

@quiz_progress_bp.route("/courses/<int:course_id>/quizzes", methods=["GET"])
def list_quizzes_for_course(course_id):
    course = Course.query.get(course_id)
    if not course:
        return jsonify({"error": "Course not found"}), 404
    
    quizzes = Quiz.query.filter_by(course_id=course_id).all()
    return jsonify([{
        "id": q.id, "title": q.title, "description": q.description, 
        "publish_status": q.publish_status.value, "due_date": q.due_date.isoformat() if q.due_date else None
    } for q in quizzes]), 200

@quiz_progress_bp.route("/quizzes/<int:quiz_id>", methods=["GET"])
def get_quiz_details(quiz_id):
    quiz = Quiz.query.get_or_404(quiz_id)
    # Add more details, potentially questions if requested by query param
    return jsonify({
        "id": quiz.id, "title": quiz.title, "description": quiz.description,
        "time_limit_minutes": quiz.time_limit_minutes, 
        "attempts_allowed": quiz.attempts_allowed,
        "publish_status": quiz.publish_status.value,
        # ... other fields
    }), 200

@quiz_progress_bp.route("/quizzes/<int:quiz_id>", methods=["PUT"])
def update_quiz(quiz_id):
    # auth_user_id = get_current_user_id()
    quiz = Quiz.query.get_or_404(quiz_id)
    # if not is_instructor_or_admin(auth_user_id, quiz.course_id):
    #     return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    for key, value in data.items():
        if hasattr(quiz, key):
            if key in ["feedback_policy", "publish_status"] and value:
                enum_class = QuizFeedbackPolicy if key == "feedback_policy" else QuizPublishStatus
                setattr(quiz, key, enum_class[value.upper()])
            elif key == "due_date" and value:
                setattr(quiz, key, datetime.fromisoformat(value))
            else:
                setattr(quiz, key, value)
    
    db.session.commit()
    return jsonify({"message": "Quiz updated successfully", "quiz_id": quiz.id}), 200

@quiz_progress_bp.route("/quizzes/<int:quiz_id>", methods=["DELETE"])
def delete_quiz(quiz_id):
    # auth_user_id = get_current_user_id()
    quiz = Quiz.query.get_or_404(quiz_id)
    # if not is_instructor_or_admin(auth_user_id, quiz.course_id):
    #     return jsonify({"error": "Unauthorized"}), 403

    db.session.delete(quiz)
    db.session.commit()
    return jsonify({"message": "Quiz deleted successfully"}), 200


# --- Questions & Options Management (within Quiz context) ---

@quiz_progress_bp.route("/quizzes/<int:quiz_id>/questions", methods=["POST"])
def add_question_to_quiz(quiz_id):
    # auth_user_id = get_current_user_id()
    quiz = Quiz.query.get_or_404(quiz_id)
    # if not is_instructor_or_admin(auth_user_id, quiz.course_id):
    #     return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json()
    if not data or not data.get("question_text") or not data.get("question_type") or data.get("order_in_quiz") is None:
        return jsonify({"error": "Missing required fields (question_text, question_type, order_in_quiz)"}), 400

    new_question = Question(
        quiz_id=quiz_id,
        question_text=data["question_text"],
        question_type=QuestionType[data["question_type"].upper()],
        points=data.get("points", 1),
        order_in_quiz=data["order_in_quiz"],
        image_url=data.get("image_url"),
        explanation_text=data.get("explanation_text")
    )
    db.session.add(new_question)
    db.session.flush() # To get new_question.id for options

    options_data = data.get("options", [])
    for opt_data in options_data:
        new_option = QuestionOption(
            question_id=new_question.id,
            option_text=opt_data.get("option_text", ""),
            is_correct=opt_data.get("is_correct"),
            order_value=opt_data.get("order_value"),
            match_value=opt_data.get("match_value"),
            feedback_if_selected=opt_data.get("feedback_if_selected")
        )
        db.session.add(new_option)
    
    db.session.commit()
    return jsonify({"message": "Question added successfully", "question_id": new_question.id}), 201

@quiz_progress_bp.route("/quizzes/<int:quiz_id>/questions", methods=["GET"])
def list_questions_for_quiz(quiz_id):
    quiz = Quiz.query.get_or_404(quiz_id)
    questions = Question.query.filter_by(quiz_id=quiz_id).order_by(Question.order_in_quiz).all()
    
    result = []
    for q in questions:
        options = [{
            "id": opt.id, "option_text": opt.option_text, "is_correct": opt.is_correct, 
            "order_value": opt.order_value, "match_value": opt.match_value
        } for opt in q.options]
        result.append({
            "id": q.id, "question_text": q.question_text, "question_type": q.question_type.value,
            "points": q.points, "order_in_quiz": q.order_in_quiz, "options": options
        })
    return jsonify(result), 200

@quiz_progress_bp.route("/questions/<int:question_id>", methods=["PUT"])
def update_question(question_id):
    # auth_user_id = get_current_user_id()
    question = Question.query.get_or_404(question_id)
    # quiz = Quiz.query.get_or_404(question.quiz_id)
    # if not is_instructor_or_admin(auth_user_id, quiz.course_id):
    #     return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Update question fields
    for key, value in data.items():
        if key == "options": continue # Handle options separately
        if hasattr(question, key):
            if key == "question_type" and value:
                setattr(question, key, QuestionType[value.upper()])
            else:
                setattr(question, key, value)

    # Update options (more complex: delete existing and recreate, or match by ID)
    if "options" in data:
        # Simple approach: delete old options, add new ones
        QuestionOption.query.filter_by(question_id=question.id).delete()
        for opt_data in data["options"]:
            new_option = QuestionOption(
                question_id=question.id,
                option_text=opt_data.get("option_text", ""),
                is_correct=opt_data.get("is_correct"),
                order_value=opt_data.get("order_value"),
                match_value=opt_data.get("match_value"),
                feedback_if_selected=opt_data.get("feedback_if_selected")
            )
            db.session.add(new_option)

    db.session.commit()
    return jsonify({"message": "Question updated successfully", "question_id": question.id}), 200

@quiz_progress_bp.route("/questions/<int:question_id>", methods=["DELETE"])
def delete_question(question_id):
    # auth_user_id = get_current_user_id()
    question = Question.query.get_or_404(question_id)
    # quiz = Quiz.query.get_or_404(question.quiz_id)
    # if not is_instructor_or_admin(auth_user_id, quiz.course_id):
    #     return jsonify({"error": "Unauthorized"}), 403

    db.session.delete(question)
    db.session.commit()
    return jsonify({"message": "Question deleted successfully"}), 200

# --- Quiz Taking API Routes (Students) ---

@quiz_progress_bp.route("/quizzes/<int:quiz_id>/attempts", methods=["POST"])
def start_quiz_attempt(quiz_id):
    user_id = get_current_user_id() # Assumes authentication
    quiz = Quiz.query.get_or_404(quiz_id)

    if quiz.publish_status != QuizPublishStatus.PUBLISHED:
        return jsonify({"error": "Quiz is not published"}), 403

    # Check attempt limits
    existing_attempts_count = QuizAttempt.query.filter_by(user_id=user_id, quiz_id=quiz_id).count()
    if quiz.attempts_allowed is not None and existing_attempts_count >= quiz.attempts_allowed:
        return jsonify({"error": "Maximum attempts reached"}), 403

    new_attempt = QuizAttempt(
        user_id=user_id,
        quiz_id=quiz_id,
        attempt_number=existing_attempts_count + 1,
        status=QuizAttemptStatus.IN_PROGRESS
    )
    db.session.add(new_attempt)
    db.session.commit()

    # Return questions (without answers for student)
    questions = Question.query.filter_by(quiz_id=quiz.id).order_by(Question.order_in_quiz if not quiz.shuffle_questions else db.func.random()).all()
    questions_data = []
    for q in questions:
        options = [{
            "id": opt.id, "option_text": opt.option_text, 
            "order_value": opt.order_value # For ordering/matching display
        } for opt in q.options]
        questions_data.append({
            "id": q.id, "question_text": q.question_text, "question_type": q.question_type.value,
            "points": q.points, "image_url": q.image_url, "options": options
        })

    return jsonify({
        "message": "Quiz attempt started", 
        "attempt_id": new_attempt.id, 
        "start_time": new_attempt.start_time.isoformat(),
        "time_limit_minutes": quiz.time_limit_minutes,
        "questions": questions_data
    }), 201

@quiz_progress_bp.route("/quiz_attempts/<int:attempt_id>/answers", methods=["POST"])
def submit_quiz_answer(attempt_id):
    user_id = get_current_user_id()
    attempt = QuizAttempt.query.filter_by(id=attempt_id, user_id=user_id).first_or_404()

    if attempt.status != QuizAttemptStatus.IN_PROGRESS:
        return jsonify({"error": "Attempt is not in progress"}), 403

    data = request.get_json()
    if not data or not isinstance(data.get("answers"), list):
        return jsonify({"error": "Invalid payload, expected 'answers' list"}), 400

    # Store or update answers
    for ans_data in data["answers"]:
        question_id = ans_data.get("question_id")
        answer_content = ans_data.get("answer_data")
        if question_id is None:
            continue

        user_answer = UserAnswer.query.filter_by(quiz_attempt_id=attempt.id, question_id=question_id).first()
        if user_answer:
            user_answer.answer_data = answer_content
            user_answer.updated_at = datetime.utcnow() # if you add updated_at to UserAnswer
        else:
            user_answer = UserAnswer(
                quiz_attempt_id=attempt.id,
                question_id=question_id,
                answer_data=answer_content
            )
            db.session.add(user_answer)
    
    db.session.commit()
    return jsonify({"message": "Answers saved"}), 200

@quiz_progress_bp.route("/quiz_attempts/<int:attempt_id>/submit", methods=["POST"])
def submit_quiz_attempt(attempt_id):
    user_id = get_current_user_id()
    attempt = QuizAttempt.query.filter_by(id=attempt_id, user_id=user_id).first_or_404()

    if attempt.status != QuizAttemptStatus.IN_PROGRESS:
        return jsonify({"error": "Attempt is not in progress or already submitted"}), 403

    attempt.end_time = datetime.utcnow()
    attempt.status = QuizAttemptStatus.SUBMITTED # Will be changed after grading

    # --- Auto-Grading Logic --- #
    total_points_possible = 0
    total_points_awarded = 0
    all_auto_graded = True

    user_answers = UserAnswer.query.filter_by(quiz_attempt_id=attempt.id).all()
    for ua in user_answers:
        question = Question.query.get(ua.question_id)
        total_points_possible += question.points
        
        # Auto-gradable types
        if question.question_type in [QuestionType.MULTIPLE_CHOICE_SINGLE, QuestionType.MULTIPLE_CHOICE_MULTIPLE, QuestionType.TRUE_FALSE, QuestionType.FILL_IN_BLANKS]:
            correct_options = QuestionOption.query.filter_by(question_id=question.id, is_correct=True).all()
            ua.is_correct = False # Default
            awarded_for_q = 0

            if question.question_type == QuestionType.MULTIPLE_CHOICE_SINGLE:
                selected_option_id = ua.answer_data.get("selected_option_id") if ua.answer_data else None
                if selected_option_id and any(opt.id == selected_option_id for opt in correct_options):
                    ua.is_correct = True
                    awarded_for_q = question.points
            
            elif question.question_type == QuestionType.MULTIPLE_CHOICE_MULTIPLE:
                selected_option_ids = set(ua.answer_data.get("selected_option_ids", [])) if ua.answer_data else set()
                correct_option_ids = {opt.id for opt in correct_options}
                # Strict: all correct and no incorrect selected
                if selected_option_ids == correct_option_ids:
                    ua.is_correct = True
                    awarded_for_q = question.points
            
            elif question.question_type == QuestionType.TRUE_FALSE:
                user_tf_answer = ua.answer_data.get("answer") if ua.answer_data else None # Expects True/False
                # Assuming one correct option stores the True/False value as its text or a flag
                if correct_options and str(user_tf_answer).lower() == str(correct_options[0].option_text).lower():
                    ua.is_correct = True
                    awarded_for_q = question.points

            elif question.question_type == QuestionType.FILL_IN_BLANKS:
                user_text_answer = ua.answer_data.get("text_answer", "").strip() if ua.answer_data else ""
                # Assuming correct answer is stored in the first option's text for simplicity
                if correct_options and user_text_answer.lower() == correct_options[0].option_text.strip().lower():
                    ua.is_correct = True
                    awarded_for_q = question.points

            ua.points_awarded = awarded_for_q
            total_points_awarded += awarded_for_q
            ua.graded_at = datetime.utcnow()
        else:
            all_auto_graded = False # Requires manual grading
            ua.points_awarded = None # To be filled by instructor

    attempt.score = (total_points_awarded / total_points_possible) * 100 if total_points_possible > 0 else 0
    
    if all_auto_graded:
        attempt.status = QuizAttemptStatus.AUTO_GRADED
    else:
        attempt.status = QuizAttemptStatus.MANUAL_GRADING_PENDING

    db.session.commit()
    # Trigger progress update if needed
    update_course_progress(user_id, attempt.quiz.course_id)

    return jsonify({
        "message": "Quiz submitted successfully", 
        "attempt_id": attempt.id, 
        "status": attempt.status.value,
        "score": attempt.score
    }), 200

@quiz_progress_bp.route("/quiz_attempts/<int:attempt_id>/results", methods=["GET"])
def get_quiz_attempt_results(attempt_id):
    user_id = get_current_user_id()
    attempt = QuizAttempt.query.filter_by(id=attempt_id, user_id=user_id).first_or_404()
    quiz = Quiz.query.get(attempt.quiz_id)

    # Check feedback policy
    can_view_results = False
    if attempt.status in [QuizAttemptStatus.GRADED, QuizAttemptStatus.AUTO_GRADED]:
        if quiz.feedback_policy == QuizFeedbackPolicy.IMMEDIATE_FULL or quiz.feedback_policy == QuizFeedbackPolicy.IMMEDIATE_SCORE_ONLY:
            can_view_results = True
        elif quiz.feedback_policy == QuizFeedbackPolicy.AFTER_DUE_DATE and quiz.due_date and datetime.utcnow() > quiz.due_date:
            can_view_results = True
        elif quiz.feedback_policy == QuizFeedbackPolicy.MANUAL_RELEASE and attempt.feedback_viewed_at: # Simplified, needs proper flag
             can_view_results = True # This needs a better flag like `feedback_released` by instructor
    
    if not can_view_results and attempt.status != QuizAttemptStatus.MANUAL_GRADING_PENDING : # Allow seeing score if only score is allowed
         if quiz.feedback_policy == QuizFeedbackPolicy.IMMEDIATE_SCORE_ONLY and attempt.status in [QuizAttemptStatus.GRADED, QuizAttemptStatus.AUTO_GRADED]:
              return jsonify({"attempt_id": attempt.id, "score": attempt.score, "status": attempt.status.value, "message": "Only score is available currently."}),200
         return jsonify({"error": "Results not yet available based on feedback policy"}), 403

    answers_data = []
    for ua in attempt.user_answers:
        question = Question.query.get(ua.question_id)
        options_data = [{ "id": opt.id, "option_text": opt.option_text, "is_correct": opt.is_correct if quiz.feedback_policy == QuizFeedbackPolicy.IMMEDIATE_FULL else None} for opt in question.options]
        answers_data.append({
            "question_id": ua.question_id,
            "question_text": question.question_text,
            "question_type": question.question_type.value,
            "user_answer_data": ua.answer_data,
            "is_correct": ua.is_correct if quiz.feedback_policy == QuizFeedbackPolicy.IMMEDIATE_FULL else None,
            "points_awarded": ua.points_awarded,
            "instructor_feedback": ua.instructor_feedback if quiz.feedback_policy == QuizFeedbackPolicy.IMMEDIATE_FULL else None,
            "explanation_text": question.explanation_text if quiz.feedback_policy == QuizFeedbackPolicy.IMMEDIATE_FULL else None,
            "options": options_data if quiz.feedback_policy == QuizFeedbackPolicy.IMMEDIATE_FULL else None
        })

    return jsonify({
        "attempt_id": attempt.id,
        "quiz_id": attempt.quiz_id,
        "score": attempt.score,
        "status": attempt.status.value,
        "start_time": attempt.start_time.isoformat(),
        "end_time": attempt.end_time.isoformat() if attempt.end_time else None,
        "answers": answers_data
    }), 200

# --- Progress Tracking API Routes ---

@quiz_progress_bp.route("/progress/lessons/<int:lesson_id>/complete", methods=["POST"])
def mark_lesson_complete(lesson_id):
    user_id = get_current_user_id()
    lesson = Lesson.query.get_or_404(lesson_id)
    course_id = lesson.module.course_id # Assuming Lesson -> Module -> Course relationship

    existing_completion = LessonCompletion.query.filter_by(user_id=user_id, lesson_id=lesson_id).first()
    if not existing_completion:
        completion = LessonCompletion(user_id=user_id, lesson_id=lesson_id)
        db.session.add(completion)
        db.session.commit()
        update_course_progress(user_id, course_id)
        return jsonify({"message": "Lesson marked as complete"}), 200
    return jsonify({"message": "Lesson already marked as complete"}), 200

@quiz_progress_bp.route("/progress/courses/<int:course_id>", methods=["GET"])
def get_course_progress(course_id):
    user_id = get_current_user_id()
    course = Course.query.get_or_404(course_id)
    user_progress = UserProgress.query.filter_by(user_id=user_id, course_id=course_id).first()

    if not user_progress:
        # Calculate initial progress if not exists (e.g. 0% or based on current completions)
        update_course_progress(user_id, course_id) # This will create if not exists
        user_progress = UserProgress.query.filter_by(user_id=user_id, course_id=course_id).first()
        if not user_progress: # Should not happen if update_course_progress works correctly
             return jsonify({"error": "Could not retrieve or initialize progress"}), 500


    # Get completed lessons for this user in this course
    completed_lessons_count = db.session.query(LessonCompletion.lesson_id)\
        .join(Lesson, LessonCompletion.lesson_id == Lesson.id)\
        .join(Module, Lesson.module_id == Module.id)\
        .filter(LessonCompletion.user_id == user_id, Module.course_id == course_id)\
        .count()

    total_lessons_count = Lesson.query.join(Module).filter(Module.course_id == course_id).count()

    return jsonify({
        "course_id": course_id,
        "user_id": user_id,
        "completion_percentage": user_progress.completion_percentage if user_progress else 0,
        "completed_lessons": completed_lessons_count,
        "total_lessons": total_lessons_count,
        "last_accessed_lesson_id": user_progress.last_accessed_lesson_id if user_progress else None,
        "completed_at": user_progress.completed_at.isoformat() if user_progress and user_progress.completed_at else None
    }), 200

def update_course_progress(user_id, course_id):
    course = Course.query.get(course_id)
    if not course:
        return

    total_lessons = Lesson.query.join(Module).filter(Module.course_id == course_id).count()
    if total_lessons == 0:
        completion_percentage = 100.0 # Or 0.0, depends on definition for empty course
    else:
        completed_lessons = db.session.query(LessonCompletion.lesson_id)\
            .join(Lesson, LessonCompletion.lesson_id == Lesson.id)\
            .join(Module, Lesson.module_id == Module.id)\
            .filter(LessonCompletion.user_id == user_id, Module.course_id == course_id)\
            .count()
        completion_percentage = (completed_lessons / total_lessons) * 100 if total_lessons > 0 else 0

    user_progress = UserProgress.query.filter_by(user_id=user_id, course_id=course_id).first()
    if not user_progress:
        user_progress = UserProgress(user_id=user_id, course_id=course_id)
        db.session.add(user_progress)
    
    user_progress.completion_percentage = completion_percentage
    if completion_percentage >= 100.0 and not user_progress.completed_at:
        user_progress.completed_at = datetime.utcnow()
        # Potentially issue certificate here
        # issue_certificate_if_eligible(user_id, course_id)
    
    user_progress.updated_at = datetime.utcnow()
    db.session.commit()

    # Update module completions (can be more complex if modules have own criteria)
    modules = Module.query.filter_by(course_id=course_id).all()
    for module in modules:
        total_lessons_in_module = Lesson.query.filter_by(module_id=module.id).count()
        if total_lessons_in_module > 0:
            completed_lessons_in_module = LessonCompletion.query\
                .join(Lesson, LessonCompletion.lesson_id == Lesson.id)\
                .filter(LessonCompletion.user_id == user_id, Lesson.module_id == module.id)\
                .count()
            if completed_lessons_in_module == total_lessons_in_module:
                existing_mc = ModuleCompletion.query.filter_by(user_id=user_id, module_id=module.id).first()
                if not existing_mc:
                    mc = ModuleCompletion(user_id=user_id, module_id=module.id)
                    db.session.add(mc)
    db.session.commit()


# --- Badge and Certificate Routes (Simplified) ---

@quiz_progress_bp.route("/badges", methods=["POST"])
# @admin_required # Placeholder
def create_badge():
    data = request.get_json()
    # Add validation
    badge = Badge(name=data["name"], description=data["description"], criteria_description=data["criteria_description"], icon_url=data["icon_url"])
    db.session.add(badge)
    db.session.commit()
    return jsonify({"message": "Badge created", "badge_id": badge.id}), 201

@quiz_progress_bp.route("/users/<int:user_id>/badges", methods=["GET"])
def get_user_badges(user_id):
    user_badges = UserBadge.query.filter_by(user_id=user_id).all()
    badges_data = []
    for ub in user_badges:
        badge = Badge.query.get(ub.badge_id)
        badges_data.append({"id": badge.id, "name": badge.name, "description": badge.description, "icon_url": badge.icon_url, "awarded_at": ub.awarded_at.isoformat()})
    return jsonify(badges_data), 200

# More routes for awarding badges, managing certificates would be needed.
# Example: POST /users/<user_id>/badges/<badge_id>/award
# Example: POST /courses/<course_id>/users/<user_id>/issue_certificate

# Placeholder for registering this blueprint in app.py:
# from .routes.quiz_progress_routes import quiz_progress_bp
# app.register_blueprint(quiz_progress_bp)

