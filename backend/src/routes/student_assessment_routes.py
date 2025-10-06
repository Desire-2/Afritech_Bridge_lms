# Assessment Routes - Student assessment API endpoints
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps

from ..models.user_models import User
from ..services.assessment_service import AssessmentService

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

assessment_bp = Blueprint("student_assessment", __name__, url_prefix="/api/v1/student/assessment")

@assessment_bp.route("/quiz/<int:quiz_id>/start", methods=["POST"])
@student_required
def start_quiz(quiz_id):
    """Start a new quiz attempt"""
    try:
        student_id = int(get_jwt_identity())
        success, message, quiz_data = AssessmentService.start_quiz_attempt(student_id, quiz_id)
        
        if success:
            return jsonify({
                "success": True,
                "message": message,
                "data": quiz_data
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": message
            }), 400
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to start quiz"
        }), 500

@assessment_bp.route("/quiz/attempt/<int:attempt_id>/submit", methods=["POST"])
@student_required
def submit_quiz_legacy(attempt_id):
    """Legacy submit quiz attempt endpoint (for backward compatibility)"""
    try:
        student_id = int(get_jwt_identity())
        data = request.get_json()
        answers = data.get('answers', {})
        
        success, message, result = AssessmentService.submit_quiz_attempt_by_id(student_id, attempt_id, answers)
        
        if success:
            return jsonify({
                "success": True,
                "message": message,
                "result": result
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": message
            }), 400
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to submit quiz"
        }), 500
def submit_quiz(attempt_id):
    """Submit quiz answers"""
    try:
        data = request.get_json()
        
        if not data or 'answers' not in data:
            return jsonify({
                "success": False,
                "error": "Quiz answers are required"
            }), 400
        
        answers = data['answers']
        success, message, result_data = AssessmentService.submit_quiz_attempt(attempt_id, answers)
        
        if success:
            return jsonify({
                "success": True,
                "message": message,
                "data": result_data
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": message
            }), 400
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to submit quiz"
        }), 500

@assessment_bp.route("/assignment/<int:assignment_id>/start", methods=["POST"])
@student_required
def start_assignment(assignment_id):
    """Start working on an assignment"""
    try:
        student_id = int(get_jwt_identity())
        success, message, assignment_data = AssessmentService.start_assignment(student_id, assignment_id)
        
        if success:
            return jsonify({
                "success": True,
                "message": message,
                "data": assignment_data
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": message
            }), 400
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to start assignment"
        }), 500

@assessment_bp.route("/assignment/attempt/<int:attempt_id>/submit", methods=["POST"])
@student_required
def submit_assignment_attempt(attempt_id):
    """Submit assignment work"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "Submission data is required"
            }), 400
        
        submission_data = {
            'files': data.get('files', []),
            'text_submission': data.get('text_submission'),
            'urls': data.get('urls', []),
            'notes': data.get('notes'),
            'submitted_at': data.get('submitted_at')
        }
        
        success, message, submission_result = AssessmentService.submit_assignment(
            attempt_id, submission_data
        )
        
        if success:
            return jsonify({
                "success": True,
                "message": message,
                "data": submission_result
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": message
            }), 400
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to submit assignment"
        }), 500

@assessment_bp.route("/final-assessment/module/<int:module_id>/start", methods=["POST"])
@student_required
def start_final_assessment(module_id):
    """Start final module assessment"""
    try:
        student_id = int(get_jwt_identity())
        success, message, assessment_data = AssessmentService.start_final_assessment(
            student_id, module_id
        )
        
        if success:
            return jsonify({
                "success": True,
                "message": message,
                "data": assessment_data
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": message
            }), 400
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to start final assessment"
        }), 500

@assessment_bp.route("/final-assessment/attempt/<int:attempt_id>/submit", methods=["POST"])
@student_required
def submit_final_assessment(attempt_id):
    """Submit final assessment"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "Assessment submission data is required"
            }), 400
        
        submission_data = {
            'essay_answers': data.get('essay_answers', {}),
            'practical_work': data.get('practical_work', {}),
            'project_files': data.get('project_files', []),
            'reflection': data.get('reflection'),
            'time_spent': data.get('time_spent', 0)
        }
        
        success, message, result = AssessmentService.submit_final_assessment(
            attempt_id, submission_data
        )
        
        if success:
            return jsonify({
                "success": True,
                "message": message,
                "data": result
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": message
            }), 400
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to submit final assessment"
        }), 500

@assessment_bp.route("/history", methods=["GET"])
@student_required
def get_assessment_history():
    """Get student's assessment history"""
    try:
        student_id = int(get_jwt_identity())
        module_id = request.args.get('module_id', type=int)
        
        history = AssessmentService.get_student_assessment_history(student_id, module_id)
        
        return jsonify({
            "success": True,
            "data": {
                "assessment_history": history
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load assessment history"
        }), 500

@assessment_bp.route("/attempt/<int:attempt_id>", methods=["GET"])
@student_required
def get_attempt_details(attempt_id):
    """Get details of a specific assessment attempt"""
    try:
        student_id = int(get_jwt_identity())
        
        from ..models.student_models import AssessmentAttempt
        
        attempt = AssessmentAttempt.query.filter_by(
            id=attempt_id, student_id=student_id
        ).first()
        
        if not attempt:
            return jsonify({
                "success": False,
                "error": "Assessment attempt not found"
            }), 404
        
        return jsonify({
            "success": True,
            "data": {
                "attempt": attempt.to_dict()
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load attempt details"
        }), 500

@assessment_bp.route("/module/<int:module_id>/assessments", methods=["GET"])
@student_required
def get_module_assessments(module_id):
    """Get all assessments for a module"""
    try:
        student_id = int(get_jwt_identity())
        
        from ..models.course_models import Module, Quiz
        from ..models.student_models import AssessmentAttempt
        
        module = Module.query.get(module_id)
        if not module:
            return jsonify({
                "success": False,
                "error": "Module not found"
            }), 404
        
        # Get quizzes for the module
        quizzes = Quiz.query.filter_by(module_id=module_id).all()
        
        # Get student's attempts for this module
        attempts = AssessmentAttempt.query.filter_by(
            student_id=student_id, module_id=module_id
        ).all()
        
        assessments_data = {
            "module": module.to_dict(),
            "quizzes": [quiz.to_dict() for quiz in quizzes],
            "attempts": [attempt.to_dict() for attempt in attempts],
            "summary": {
                "total_assessments": len(quizzes),
                "completed_assessments": len([a for a in attempts if a.status == 'graded']),
                "average_score": 0
            }
        }
        
        # Calculate average score
        graded_attempts = [a for a in attempts if a.status == 'graded']
        if graded_attempts:
            assessments_data["summary"]["average_score"] = sum(
                a.percentage for a in graded_attempts
            ) / len(graded_attempts)
        
        return jsonify({
            "success": True,
            "data": assessments_data
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load module assessments"
        }), 500

@assessment_bp.route("/quiz/<int:quiz_id>/attempts", methods=["GET"])
@student_required
def get_quiz_attempts(quiz_id):
    """Get student's attempts for a specific quiz"""
    try:
        student_id = int(get_jwt_identity())
        
        from ..models.student_models import AssessmentAttempt
        
        attempts = AssessmentAttempt.query.filter_by(
            student_id=student_id,
            assessment_type='quiz',
            assessment_id=quiz_id
        ).order_by(AssessmentAttempt.started_at.desc()).all()
        
        return jsonify({
            "success": True,
            "data": {
                "attempts": [attempt.to_dict() for attempt in attempts],
                "best_score": max((a.percentage for a in attempts if a.status == 'graded'), default=0),
                "total_attempts": len(attempts)
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load quiz attempts"
        }), 500

@assessment_bp.route("/upcoming", methods=["GET"])
@student_required
def get_upcoming_assessments():
    """Get upcoming assessments across all enrolled courses"""
    try:
        student_id = int(get_jwt_identity())
        
        from ..models.course_models import Enrollment
        from ..models.student_models import ModuleProgress
        
        # Get active enrollments
        enrollments = Enrollment.query.filter_by(
            user_id=student_id, completed=False
        ).all()
        
        upcoming_assessments = []
        
        for enrollment in enrollments:
            # Get unlocked modules that haven't been completed
            module_progresses = ModuleProgress.query.filter_by(
                student_id=student_id,
                enrollment_id=enrollment.id
            ).filter(ModuleProgress.status.in_(['unlocked', 'in_progress'])).all()
            
            for mp in module_progresses:
                module = mp.module
                
                # Check if module has assessments available
                quizzes = module.quizzes.all()
                for quiz in quizzes:
                    # Check if student has completed this quiz
                    existing_attempts = AssessmentAttempt.query.filter_by(
                        student_id=student_id,
                        assessment_type='quiz',
                        assessment_id=quiz.id,
                        status='graded'
                    ).count()
                    
                    if existing_attempts == 0:  # Not yet completed
                        upcoming_assessments.append({
                            "type": "quiz",
                            "title": quiz.title,
                            "module": module.title,
                            "course": enrollment.course.title,
                            "id": quiz.id,
                            "available": True
                        })
                
                # Check for final assessment eligibility
                prerequisites_met = AssessmentService._check_final_assessment_prerequisites(
                    student_id, module.id
                )
                
                if prerequisites_met:
                    final_attempts = AssessmentAttempt.query.filter_by(
                        student_id=student_id,
                        assessment_type='final_assessment',
                        module_id=module.id,
                        status='graded'
                    ).count()
                    
                    if final_attempts == 0:
                        upcoming_assessments.append({
                            "type": "final_assessment",
                            "title": f"Final Assessment - {module.title}",
                            "module": module.title,
                            "course": enrollment.course.title,
                            "id": module.id,
                            "available": True
                        })
        
        return jsonify({
            "success": True,
            "data": {
                "upcoming_assessments": upcoming_assessments
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load upcoming assessments"
        }), 500