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
        else:
            # Refresh the module progress to ensure we get the latest data
            db.session.refresh(module_progress)
            from flask import current_app
            current_app.logger.info(f"📊 GET module progress: module_id={module_id}, status={module_progress.status}, cumulative_score={module_progress.cumulative_score}, completed_at={module_progress.completed_at}")
        
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
    """Get detailed score breakdown with dynamic weights based on available assessments"""
    try:
        student_id = int(get_jwt_identity())
        
        from ..models.student_models import ModuleProgress, LessonCompletion
        from ..models.course_models import Module, Enrollment, Lesson, Quiz, Assignment
        
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
        
        # Check what assessments exist in this module
        lesson_ids = [lesson.id for lesson in module.lessons]
        
        # Check for lesson-level quizzes
        has_quizzes = Quiz.query.filter(Quiz.lesson_id.in_(lesson_ids)).first() is not None if lesson_ids else False
        
        # Check for lesson-level assignments
        has_assignments = Assignment.query.filter(Assignment.lesson_id.in_(lesson_ids)).first() is not None if lesson_ids else False
        
        # Check for module-level final assessment quiz (quiz with module_id but no lesson_id)
        # This correctly identifies if a final assessment EXISTS, not just if one has been taken
        has_final_assessment = Quiz.query.filter(
            Quiz.module_id == module_id,
            Quiz.lesson_id.is_(None),
            Quiz.is_published == True
        ).first() is not None
        
        # Calculate dynamic weights based on available assessments
        # Base weights: Reading & Engagement 10%, Quizzes 30%, Assignments 40%, Final 20%
        # If component is missing, redistribute its weight proportionally to others
        
        available_components = []
        if True:  # Reading & Engagement is always available
            available_components.append('course_contribution')
        if has_quizzes:
            available_components.append('quizzes')
        if has_assignments:
            available_components.append('assignments')
        if has_final_assessment:
            available_components.append('final_assessment')
        
        # Default weights
        base_weights = {
            'course_contribution': 10.0,
            'quizzes': 30.0,
            'assignments': 40.0,
            'final_assessment': 20.0
        }
        
        # Calculate dynamic weights
        if not has_quizzes and not has_assignments and not has_final_assessment:
            # No assessments - Reading & Engagement is 100%
            weights = {
                'course_contribution': 100.0,
                'quizzes': 0.0,
                'assignments': 0.0,
                'final_assessment': 0.0
            }
        elif not has_quizzes and not has_assignments:
            # Only final assessment exists
            weights = {
                'course_contribution': 40.0,
                'quizzes': 0.0,
                'assignments': 0.0,
                'final_assessment': 60.0
            }
        elif not has_quizzes and not has_final_assessment:
            # Only assignments exist
            weights = {
                'course_contribution': 30.0,
                'quizzes': 0.0,
                'assignments': 70.0,
                'final_assessment': 0.0
            }
        elif not has_assignments and not has_final_assessment:
            # Only quizzes exist
            weights = {
                'course_contribution': 30.0,
                'quizzes': 70.0,
                'assignments': 0.0,
                'final_assessment': 0.0
            }
        elif not has_quizzes:
            # Assignments and final exist, no quizzes
            weights = {
                'course_contribution': 15.0,
                'quizzes': 0.0,
                'assignments': 55.0,
                'final_assessment': 30.0
            }
        elif not has_assignments:
            # Quizzes and final exist, no assignments
            weights = {
                'course_contribution': 15.0,
                'quizzes': 55.0,
                'assignments': 0.0,
                'final_assessment': 30.0
            }
        elif not has_final_assessment:
            # Quizzes and assignments exist, no final
            weights = {
                'course_contribution': 15.0,
                'quizzes': 40.0,
                'assignments': 45.0,
                'final_assessment': 0.0
            }
        else:
            # All components exist - use default weights
            weights = base_weights.copy()
        
        # Calculate weighted scores with dynamic weights
        course_contribution_weighted = (module_progress.course_contribution_score or 0.0) * (weights['course_contribution'] / 100)
        quiz_weighted = (module_progress.quiz_score or 0.0) * (weights['quizzes'] / 100)
        assignment_weighted = (module_progress.assignment_score or 0.0) * (weights['assignments'] / 100)
        final_weighted = (module_progress.final_assessment_score or 0.0) * (weights['final_assessment'] / 100)
        
        # Calculate cumulative score with dynamic weights
        cumulative_score = course_contribution_weighted + quiz_weighted + assignment_weighted + final_weighted
        
        # Update module progress with recalculated score
        module_progress.cumulative_score = cumulative_score
        db.session.commit()
        
        # Build breakdown with dynamic weights
        breakdown = {
            "course_contribution": {
                "score": module_progress.course_contribution_score or 0.0,
                "weight": weights['course_contribution'],
                "weighted_score": course_contribution_weighted,
                "description": "Lesson completion and engagement" if weights['course_contribution'] == 100 else "Reading & engagement score",
                "available": True
            },
            "quizzes": {
                "score": module_progress.quiz_score or 0.0,
                "weight": weights['quizzes'],
                "weighted_score": quiz_weighted,
                "description": "Best quiz performance" if has_quizzes else "No quizzes in this module",
                "available": has_quizzes
            },
            "assignments": {
                "score": module_progress.assignment_score or 0.0,
                "weight": weights['assignments'],
                "weighted_score": assignment_weighted,
                "description": "Assignment completion & quality" if has_assignments else "No assignments in this module",
                "available": has_assignments
            },
            "final_assessment": {
                "score": module_progress.final_assessment_score or 0.0,
                "weight": weights['final_assessment'],
                "weighted_score": final_weighted,
                "description": "Final module assessment" if weights['final_assessment'] > 0 else "No final assessment for this module",
                "available": weights['final_assessment'] > 0
            }
        }
        
        # Calculate what's needed to pass
        passing_threshold = 80.0
        points_needed = max(0, passing_threshold - cumulative_score)
        
        # Generate dynamic recommendations based on available components
        recommendations = []
        
        if weights['assignments'] > 0 and (module_progress.assignment_score or 0) < 70:
            recommendations.append({
                "priority": "high",
                "area": "assignments",
                "message": f"Focus on improving assignment quality ({weights['assignments']:.0f}% of total grade)"
            })
        if weights['quizzes'] > 0 and (module_progress.quiz_score or 0) < 70:
            recommendations.append({
                "priority": "medium",
                "area": "quizzes",
                "message": f"Review quiz material and retake if possible ({weights['quizzes']:.0f}% of total grade)"
            })
        if weights['final_assessment'] > 0 and (module_progress.final_assessment_score or 0) < 70:
            recommendations.append({
                "priority": "high",
                "area": "final_assessment",
                "message": f"Prepare thoroughly for final assessment ({weights['final_assessment']:.0f}% of total grade)"
            })
        if (module_progress.course_contribution_score or 0) < 90:
            recommendations.append({
                "priority": "low" if weights['course_contribution'] <= 15 else "high",
                "area": "course_contribution",
                "message": f"Complete all lessons with high engagement ({weights['course_contribution']:.0f}% of total grade)"
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
                "can_proceed": cumulative_score >= passing_threshold and module_progress.status == 'completed',
                "assessment_info": {
                    "has_quizzes": has_quizzes,
                    "has_assignments": has_assignments,
                    "has_final_assessment": weights['final_assessment'] > 0,
                    "is_reading_only": not has_quizzes and not has_assignments and weights['final_assessment'] == 0
                }
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