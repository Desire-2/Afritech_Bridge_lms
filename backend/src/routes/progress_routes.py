# Progress Routes - Student progress tracking and analytics API endpoints
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps

from ..models.user_models import User, db
from ..services.analytics_service import AnalyticsService
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

progress_bp = Blueprint("student_progress", __name__, url_prefix="/api/v1/student/progress")

@progress_bp.route("/", methods=["GET"])
@student_required
def get_progress_overview():
    """Get overall progress overview"""
    try:
        student_id = int(get_jwt_identity())
        dashboard_analytics = AnalyticsService.get_student_dashboard_analytics(student_id)
        
        if "error" in dashboard_analytics:
            return jsonify({"error": dashboard_analytics["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": {
                "overview": dashboard_analytics,
                "transcript": dashboard_analytics["transcript_summary"]
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load progress overview"
        }), 500

@progress_bp.route("/course/<int:course_id>", methods=["GET"])
@student_required
def get_course_progress(course_id):
    """Get detailed progress for a specific course"""
    try:
        student_id = int(get_jwt_identity())
        
        # Get detailed progress
        progress_data = ProgressionService.get_student_course_progress(student_id, course_id)
        
        if "error" in progress_data:
            return jsonify({"error": progress_data["error"]}), 400
        
        # Get analytics for the course
        course_analytics = AnalyticsService.get_course_analytics(student_id, course_id)
        
        return jsonify({
            "success": True,
            "data": {
                "progress": progress_data,
                "analytics": course_analytics
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load course progress"
        }), 500

@progress_bp.route("/module/<int:module_id>", methods=["GET"])
@student_required
def get_module_progress(module_id):
    """Get detailed progress for a specific module"""
    try:
        student_id = int(get_jwt_identity())
        
        from ..models.student_models import ModuleProgress
        from ..models.course_models import Module, Enrollment
        
        # Get module and enrollment
        module = Module.query.get(module_id)
        if not module:
            return jsonify({"error": "Module not found"}), 404
        
        enrollment = Enrollment.query.filter_by(
            student_id=student_id, course_id=module.course_id
        ).first()
        
        if not enrollment:
            return jsonify({"error": "Not enrolled in course"}), 403
        
        # Get module progress
        module_progress = ModuleProgress.query.filter_by(
            student_id=student_id,
            module_id=module_id,
            enrollment_id=enrollment.id
        ).first()
        
        # Initialize if missing (instead of returning 404)
        if not module_progress:
            from flask import current_app
            current_app.logger.info(f"Initializing module progress for student {student_id}, module {module_id}")
            module_progress = ProgressionService._initialize_module_progress(
                student_id, module_id, enrollment.id
            )
            db.session.commit()
        
        # Get time analytics for module
        time_analytics = AnalyticsService._get_module_time_analytics(student_id, module_id)
        
        return jsonify({
            "success": True,
            "data": {
                "module": module.to_dict(include_lessons=True),
                "progress": module_progress.to_dict(),
                "time_analytics": time_analytics
            }
        }), 200
        
    except Exception as e:
        from flask import current_app
        current_app.logger.error(f"Failed to load module progress: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to load module progress"
        }), 500

@progress_bp.route("/analytics", methods=["GET"])
@student_required
def get_progress_analytics():
    """Get comprehensive progress analytics"""
    try:
        student_id = int(get_jwt_identity())
        
        # Get dashboard analytics
        dashboard_analytics = AnalyticsService.get_student_dashboard_analytics(student_id)
        
        # Get progress report
        progress_report = AnalyticsService.get_progress_report(student_id)
        
        return jsonify({
            "success": True,
            "data": {
                "dashboard_analytics": dashboard_analytics,
                "progress_report": progress_report
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load progress analytics"
        }), 500

@progress_bp.route("/course/<int:course_id>/analytics", methods=["GET"])
@student_required
def get_course_analytics(course_id):
    """Get detailed analytics for a specific course"""
    try:
        student_id = int(get_jwt_identity())
        course_analytics = AnalyticsService.get_course_analytics(student_id, course_id)
        
        if "error" in course_analytics:
            return jsonify({"error": course_analytics["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": course_analytics
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load course analytics"
        }), 500

@progress_bp.route("/module/<int:module_id>/score-breakdown", methods=["GET"])
@student_required
def get_module_score_breakdown(module_id):
    """Get detailed score breakdown with requirements and recommendations"""
    try:
        student_id = int(get_jwt_identity())
        
        from ..models.student_models import ModuleProgress
        from ..models.course_models import Module, Enrollment
        
        # Get module and enrollment
        module = Module.query.get(module_id)
        if not module:
            return jsonify({"error": "Module not found"}), 404
        
        enrollment = Enrollment.query.filter_by(
            student_id=student_id, course_id=module.course_id
        ).first()
        
        if not enrollment:
            return jsonify({"error": "Not enrolled in course"}), 403
        
        # Get module progress
        module_progress = ModuleProgress.query.filter_by(
            student_id=student_id,
            module_id=module_id,
            enrollment_id=enrollment.id
        ).first()
        
        if not module_progress:
            module_progress = ProgressionService._initialize_module_progress(
                student_id, module_id, enrollment.id
            )
            db.session.commit()
        
        # Recalculate cumulative score
        cumulative_score = module_progress.calculate_cumulative_score()
        db.session.commit()
        
        # Calculate detailed breakdown
        breakdown = {
            "course_contribution": {
                "score": module_progress.course_contribution_score or 0.0,
                "weight": 10.0,
                "weighted_score": (module_progress.course_contribution_score or 0.0) * 0.10,
                "description": "Lesson completion and course engagement"
            },
            "quizzes": {
                "score": module_progress.quiz_score or 0.0,
                "weight": 30.0,
                "weighted_score": (module_progress.quiz_score or 0.0) * 0.30,
                "description": "Best quiz performance"
            },
            "assignments": {
                "score": module_progress.assignment_score or 0.0,
                "weight": 40.0,
                "weighted_score": (module_progress.assignment_score or 0.0) * 0.40,
                "description": "Best assignment quality"
            },
            "final_assessment": {
                "score": module_progress.final_assessment_score or 0.0,
                "weight": 20.0,
                "weighted_score": (module_progress.final_assessment_score or 0.0) * 0.20,
                "description": "Final module assessment"
            }
        }
        
        # Calculate what's needed to pass
        passing_threshold = 80.0
        points_needed = max(0, passing_threshold - cumulative_score)
        
        # Generate recommendations
        recommendations = []
        if module_progress.assignment_score < 70:
            recommendations.append({
                "priority": "high",
                "area": "assignments",
                "message": "Focus on improving assignment quality (40% of total grade)"
            })
        if module_progress.quiz_score < 70:
            recommendations.append({
                "priority": "medium",
                "area": "quizzes",
                "message": "Review quiz material and retake if possible (30% of total grade)"
            })
        if module_progress.final_assessment_score < 70:
            recommendations.append({
                "priority": "high",
                "area": "final_assessment",
                "message": "Prepare thoroughly for final assessment (20% of total grade)"
            })
        if module_progress.course_contribution_score < 90:
            recommendations.append({
                "priority": "low",
                "area": "course_contribution",
                "message": "Complete all lessons to maximize contribution score (10% of total grade)"
            })
        
        # Attempt tracking
        remaining_attempts = module_progress.max_attempts - module_progress.attempts_count
        is_last_attempt = remaining_attempts == 1
        
        return jsonify({
            "success": True,
            "data": {
                "cumulative_score": round(cumulative_score, 2),
                "passing_threshold": passing_threshold,
                "is_passing": cumulative_score >= passing_threshold,
                "points_needed": round(points_needed, 2),
                "breakdown": breakdown,
                "recommendations": recommendations,
                "attempts": {
                    "used": module_progress.attempts_count,
                    "max": module_progress.max_attempts,
                    "remaining": remaining_attempts,
                    "is_last_attempt": is_last_attempt
                },
                "status": module_progress.status,
                "can_proceed": cumulative_score >= passing_threshold and module_progress.status == 'completed'
            }
        }), 200
        
    except Exception as e:
        from flask import current_app
        current_app.logger.error(f"Failed to get module score breakdown: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to get module score breakdown"
        }), 500

@progress_bp.route("/module/<int:module_id>/recalculate-score", methods=["POST"])
@student_required
def recalculate_module_score(module_id):
    """Manually recalculate module score (useful for debugging)"""
    try:
        student_id = int(get_jwt_identity())
        
        from ..models.student_models import ModuleProgress
        from ..models.course_models import Module, Enrollment
        
        # Get module and enrollment
        module = Module.query.get(module_id)
        if not module:
            return jsonify({"error": "Module not found"}), 404
        
        enrollment = Enrollment.query.filter_by(
            student_id=student_id, course_id=module.course_id
        ).first()
        
        if not enrollment:
            return jsonify({"error": "Not enrolled in course"}), 403
        
        # Get module progress
        module_progress = ModuleProgress.query.filter_by(
            student_id=student_id,
            module_id=module_id,
            enrollment_id=enrollment.id
        ).first()
        
        if not module_progress:
            return jsonify({"error": "Module progress not found"}), 404
        
        # Recalculate scores
        lessons_avg = module_progress.calculate_lessons_average_score()
        module_progress.course_contribution_score = lessons_avg
        cumulative = module_progress.calculate_cumulative_score()
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "data": {
                "lessons_average_score": lessons_avg,
                "course_contribution_score": module_progress.course_contribution_score,
                "cumulative_score": cumulative,
                "message": "Score recalculated successfully"
            }
        }), 200
        
    except Exception as e:
        from flask import current_app
        current_app.logger.error(f"Failed to recalculate module score: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@progress_bp.route("/weak-areas/<int:course_id>", methods=["GET"])
@student_required
def get_weak_areas(course_id):
    """Get weak areas analysis for a course"""
    try:
        student_id = int(get_jwt_identity())
        weak_areas = AnalyticsService.get_weak_areas_analysis(student_id, course_id)
        
        if "error" in weak_areas:
            return jsonify({"error": weak_areas["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": weak_areas
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to analyze weak areas"
        }), 500

@progress_bp.route("/transcript", methods=["GET"])
@student_required
def get_transcript():
    """Get student transcript"""
    try:
        student_id = int(get_jwt_identity())
        
        from ..services.certificate_service import CertificateService
        transcript = CertificateService.generate_transcript(student_id)
        
        if "error" in transcript:
            return jsonify({"error": transcript["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": transcript
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to generate transcript"
        }), 500

@progress_bp.route("/module/<int:module_id>/retake", methods=["POST"])
@student_required
def attempt_module_retake(module_id):
    """Attempt to retake a failed module"""
    try:
        student_id = int(get_jwt_identity())
        
        from ..models.course_models import Module, Enrollment
        
        # Get module and enrollment
        module = Module.query.get(module_id)
        if not module:
            return jsonify({"error": "Module not found"}), 404
        
        enrollment = Enrollment.query.filter_by(
            student_id=student_id, course_id=module.course_id
        ).first()
        
        if not enrollment:
            return jsonify({"error": "Not enrolled in course"}), 403
        
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

@progress_bp.route("/learning-streak", methods=["GET"])
@student_required
def get_learning_streak():
    """Get learning streak information"""
    try:
        student_id = int(get_jwt_identity())
        streak = AnalyticsService._calculate_learning_streak(student_id)
        
        return jsonify({
            "success": True,
            "data": {
                "current_streak": streak,
                "streak_goal": 30,  # 30 day goal
                "progress_to_goal": min(100, (streak / 30) * 100)
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to get learning streak"
        }), 500

@progress_bp.route("/performance-trends", methods=["GET"])
@student_required
def get_performance_trends():
    """Get performance trends across courses"""
    try:
        student_id = int(get_jwt_identity())
        course_id = request.args.get('course_id', type=int)
        
        if course_id:
            trends = AnalyticsService._get_performance_trends(student_id, course_id)
        else:
            # Get trends for all courses
            from ..models.course_models import Enrollment
            enrollments = Enrollment.query.filter_by(student_id=student_id).all()
            trends = []
            
            for enrollment in enrollments:
                course_trends = AnalyticsService._get_performance_trends(
                    student_id, enrollment.course_id
                )
                trends.extend(course_trends)
            
            # Sort by date
            trends.sort(key=lambda x: x["date"], reverse=True)
        
        return jsonify({
            "success": True,
            "data": {
                "trends": trends
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to get performance trends"
        }), 500