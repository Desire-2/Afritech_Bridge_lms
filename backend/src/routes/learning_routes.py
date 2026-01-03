# Learning Routes - My Learning page API endpoints
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
from flask_sqlalchemy import SQLAlchemy

from ..models.user_models import User
from ..models.course_models import Course, Module, Enrollment
from ..models.student_models import ModuleProgress, AssessmentAttempt
from ..services.dashboard_service import DashboardService
from ..services.progression_service import ProgressionService
from ..services.enhanced_learning_service import EnhancedLearningService

# Get db from the extensions - avoid circular import
def get_db():
    from main import db
    return db

# Helper decorator for student access
def student_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        if not user or not user.role or user.role.name not in ['student', 'instructor', 'admin']:
            return jsonify({"message": "Access denied"}), 403
        return f(*args, **kwargs)
    return decorated_function

learning_bp = Blueprint("student_learning", __name__, url_prefix="/api/v1/student/learning")

@learning_bp.route("/", methods=["GET"])
@student_required
def get_my_learning():
    """Get My Learning page data"""
    try:
        student_id = int(get_jwt_identity())
        learning_data = DashboardService.get_my_learning_page(student_id)
        
        if "error" in learning_data:
            return jsonify({"error": learning_data["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": learning_data
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load learning data"
        }), 500

@learning_bp.route("/active-courses", methods=["GET"])
@student_required
def get_active_courses():
    """Get active courses for student"""
    try:
        student_id = int(get_jwt_identity())
        learning_data = DashboardService.get_my_learning_page(student_id)
        
        if "error" in learning_data:
            return jsonify({"error": learning_data["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": {
                "active_courses": learning_data["active_courses"],
                "course_stats": learning_data["course_stats"]
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load active courses"
        }), 500

@learning_bp.route("/completed-courses", methods=["GET"])
@student_required
def get_completed_courses():
    """Get completed courses for student"""
    try:
        student_id = int(get_jwt_identity())
        learning_data = DashboardService.get_my_learning_page(student_id)
        
        if "error" in learning_data:
            return jsonify({"error": learning_data["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": {
                "completed_courses": learning_data["completed_courses"],
                "course_stats": learning_data["course_stats"]
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load completed courses"
        }), 500

@learning_bp.route("/continue-learning", methods=["GET"])
@student_required
def get_continue_learning():
    """Get continue learning recommendations"""
    try:
        student_id = int(get_jwt_identity())
        learning_data = DashboardService.get_my_learning_page(student_id)
        
        if "error" in learning_data:
            return jsonify({"error": learning_data["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": {
                "continue_learning": learning_data["continue_learning"],
                "current_focus": learning_data["current_focus"],
                "next_lessons": learning_data["next_lessons"]
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load continue learning data"
        }), 500

@learning_bp.route("/course/<int:course_id>/progress", methods=["GET"])
@student_required
def get_course_progress(course_id):
    """Get detailed progress for a specific course"""
    try:
        student_id = int(get_jwt_identity())
        progress_data = ProgressionService.get_student_course_progress(student_id, course_id)
        
        if "error" in progress_data:
            return jsonify({"error": progress_data["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": progress_data
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load course progress"
        }), 500

@learning_bp.route("/lesson/<int:lesson_id>/complete", methods=["POST"])
@student_required
def complete_lesson(lesson_id):
    """Mark a lesson as completed with quiz requirement checking"""
    try:
        student_id = int(get_jwt_identity())
        data = request.get_json() or {}
        time_spent = data.get('time_spent', 0)
        
        success, message, completion_data = ProgressionService.complete_lesson(
            student_id, lesson_id, time_spent
        )
        
        # Expire session to ensure fresh data on subsequent queries
        if success:
            get_db().session.expire_all()
            
            # Check for celebration milestone
            celebration = EnhancedLearningService.create_celebration_milestone(
                student_id, "lesson_complete", {"lesson_id": lesson_id}
            )
            
            return jsonify({
                "success": True,
                "message": message,
                "data": completion_data,
                "celebration": celebration
            }), 200
        else:
            # Check if failure is due to quiz requirement
            if message == "Quiz required" and completion_data.get("quiz_required"):
                quiz_redirect = EnhancedLearningService.auto_redirect_to_quiz_if_required(
                    lesson_id, student_id
                )
                
                return jsonify({
                    "success": False,
                    "error": message,
                    "quiz_required": True,
                    "quiz_info": completion_data,
                    "quiz_redirect": quiz_redirect
                }), 402  # Use 402 Payment Required as a special code for quiz requirement
            else:
                return jsonify({
                    "success": False,
                    "error": message,
                    "data": completion_data
                }), 400
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to complete lesson"
        }), 500

@learning_bp.route("/next-lessons", methods=["GET"])
@student_required
def get_next_lessons():
    """Get next lessons across all courses"""
    try:
        student_id = int(get_jwt_identity())
        limit = request.args.get('limit', 10, type=int)
        
        learning_data = DashboardService.get_my_learning_page(student_id)
        
        if "error" in learning_data:
            return jsonify({"error": learning_data["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": {
                "next_lessons": learning_data["next_lessons"][:limit]
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load next lessons"
        }), 500

@learning_bp.route("/courses/<int:course_id>", methods=["GET"])
@student_required
def get_course_for_learning(course_id):
    """Get course details with student-specific learning data (optimized)"""
    try:
        student_id = int(get_jwt_identity())
        
        # Import course models here to avoid circular imports
        from ..models.course_models import Course, Enrollment, Module, Lesson
        from ..models.student_models import ModuleProgress, LessonCompletion
        from ..models.user_models import db
        from flask import current_app
        
        # Get course (simple query, then load related data separately)
        course = Course.query.get(course_id)
        
        if not course:
            return jsonify({"error": "Course not found"}), 404
        
        # Get current user
        user = User.query.get(student_id)
        is_instructor = user.role.name == 'instructor' and course.instructor_id == student_id
        is_admin = user.role.name == 'admin'
        
        # Check if course is published (allow instructors and admins to view unpublished courses)
        if not course.is_published and not is_instructor and not is_admin:
            return jsonify({"error": "Course is not available"}), 404
        
        # Check if student is enrolled (not required for instructors viewing their own courses or admins)
        enrollment = Enrollment.query.filter_by(
            student_id=student_id,
            course_id=course_id
        ).first()
        
        if not enrollment and not is_instructor and not is_admin:
            return jsonify({"error": "Not enrolled in this course"}), 403
        
        # OPTIMIZED: Load modules and lessons in efficient batch queries
        modules = Module.query.filter_by(course_id=course_id).order_by(Module.order).all()
        module_ids = [m.id for m in modules]
        
        # Batch load all lessons for these modules
        if module_ids:
            lessons_by_module = {}
            all_lessons = Lesson.query.filter(
                Lesson.module_id.in_(module_ids)
            ).order_by(Lesson.module_id, Lesson.order).all()
            
            for lesson in all_lessons:
                if lesson.module_id not in lessons_by_module:
                    lessons_by_module[lesson.module_id] = []
                lessons_by_module[lesson.module_id].append(lesson)
        else:
            lessons_by_module = {}
        
        # OPTIMIZED: Batch query for all module progress (only if enrolled)
        existing_progress_map = {}
        if enrollment and module_ids:
            existing_progress_map = {
                mp.module_id: mp for mp in ModuleProgress.query.filter(
                    ModuleProgress.student_id == student_id,
                    ModuleProgress.module_id.in_(module_ids),
                    ModuleProgress.enrollment_id == enrollment.id
                ).all()
            }
        
        # Initialize missing progress records (only if enrolled and needed)
        if enrollment:
            try:
                missing_modules = [m for m in modules if m.id not in existing_progress_map]
                if missing_modules:
                    current_app.logger.info(f"Initializing {len(missing_modules)} missing module progress records")
                    for module in missing_modules:
                        ProgressionService._initialize_module_progress(
                            student_id, module.id, enrollment.id
                        )
                    db.session.commit()
            except Exception as init_error:
                current_app.logger.error(f"Error initializing module progress: {str(init_error)}")
                db.session.rollback()
            finally:
                # Ensure session is cleaned up
                db.session.close()
        
        # OPTIMIZED: Get lightweight progress data (only if enrolled)
        if enrollment:
            try:
                # Quick progress calculation without full ProgressionService
                completed_modules = ModuleProgress.query.filter(
                    ModuleProgress.student_id == student_id,
                    ModuleProgress.enrollment_id == enrollment.id,
                    ModuleProgress.status == 'completed'
                ).count()
                
                overall_progress = (completed_modules / len(modules) * 100) if modules else 0
                
                progress_data = {
                    "overall_progress": overall_progress,
                    "completed_modules": completed_modules,
                    "total_modules": len(modules)
                }
            except Exception as e:
                current_app.logger.error(f"Progress calculation error: {str(e)}")
                progress_data = {
                    "overall_progress": 0,
                    "completed_modules": 0,
                    "total_modules": len(modules)
                }
        else:
            # Preview mode - no progress
            progress_data = {
                "overall_progress": 0,
                "completed_modules": 0,
                "total_modules": len(modules),
                "preview_mode": True
            }
        
        # OPTIMIZED: Build lightweight course data
        course_data = {
            "id": course.id,
            "title": course.title,
            "description": course.description,
            "instructor_id": course.instructor_id,
            "modules": [{
                "id": m.id,
                "title": m.title,
                "description": m.description,
                "order": m.order,
                "lessons": [{
                    "id": l.id,
                    "title": l.title,
                    "description": l.description or "",
                    "content_type": l.content_type,
                    "content_data": l.content_data or "",
                    "learning_objectives": l.learning_objectives or "",
                    "order": l.order,
                    "duration_minutes": l.duration_minutes,
                    "is_published": l.is_published
                } for l in lessons_by_module.get(m.id, [])]
            } for m in modules]
        }
        
        # Find first incomplete lesson as current lesson (only if enrolled)
        current_lesson = None
        if enrollment:
            for module in modules:
                for lesson in lessons_by_module.get(module.id, []):
                    completion = LessonCompletion.query.filter_by(
                        student_id=student_id,
                        lesson_id=lesson.id
                    ).first()
                    if not completion:
                        current_lesson = {
                            "id": lesson.id,
                            "title": lesson.title,
                            "module_id": module.id,
                            "module_title": module.title
                        }
                        break
                if current_lesson:
                    break
        
        # If all complete or preview mode, default to first lesson
        if not current_lesson and course_data["modules"] and course_data["modules"][0]["lessons"]:
            first_lesson = course_data["modules"][0]["lessons"][0]
            current_lesson = {
                "id": first_lesson["id"],
                "title": first_lesson["title"],
                "module_id": course_data["modules"][0]["id"],
                "module_title": course_data["modules"][0]["title"]
            }
        
        # Build enrollment data only if enrollment exists
        enrollment_data = None
        if enrollment:
            enrollment_data = {
                "enrolled_at": enrollment.enrollment_date.isoformat() if enrollment.enrollment_date else None,
                "completion_date": enrollment.completed_at.isoformat() if enrollment.completed_at else None,
                "is_completed": enrollment.completed_at is not None
            }
        
        return jsonify({
            "success": True,
            "course": course_data,
            "current_lesson": current_lesson,
            "progress": progress_data,
            "enrollment": enrollment_data
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error in get_course_for_learning: {str(e)}")
        import traceback
        current_app.logger.error(traceback.format_exc())
        return jsonify({
            "success": False,
            "error": "Failed to load course for learning"
        }), 500

@learning_bp.route("/learning-path/<int:course_id>", methods=["GET"])
@student_required
def get_learning_path(course_id):
    """Get learning path with module progression for a course"""
    try:
        student_id = int(get_jwt_identity())
        progress_data = ProgressionService.get_student_course_progress(student_id, course_id)
        
        if "error" in progress_data:
            return jsonify({"error": progress_data["error"]}), 400
        
        # Format for learning path visualization
        learning_path = {
            "course": progress_data["course"],
            "overall_progress": progress_data["overall_progress"],
            "current_module": progress_data["current_module"],
            "modules": []
        }
        
        for module_data in progress_data["modules"]:
            path_module = {
                "module": module_data["module"],
                "progress": module_data["progress"],
                "status": module_data["progress"]["status"],
                "lessons": module_data["lessons_completed"],
                "can_access": module_data["progress"]["status"] != "locked"
            }
            learning_path["modules"].append(path_module)
        
        return jsonify({
            "success": True,
            "data": learning_path
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load learning path"
        }), 500

@learning_bp.route("/course/<int:course_id>/modules", methods=["GET"])
@student_required
def get_course_modules(course_id):
    """Get all modules for a course with student progress"""
    try:
        student_id = int(get_jwt_identity())
        
        # Get course and user
        course = Course.query.get(course_id)
        if not course:
            return jsonify({"error": "Course not found"}), 404
        
        user = User.query.get(student_id)
        is_instructor = user.role.name == 'instructor' and course.instructor_id == student_id
        is_admin = user.role.name == 'admin'
        
        # Check enrollment (not required for instructors viewing their own courses or admins)
        enrollment = Enrollment.query.filter_by(
            student_id=student_id,
            course_id=course_id
        ).first()
        
        if not enrollment and not is_instructor and not is_admin:
            return jsonify({"error": "Not enrolled in this course"}), 403
        
        modules = course.modules.order_by(Module.order).all()
        
        # Get progress for each module
        modules_data = []
        for module in modules:
            # For instructors/admins without enrollment, show module structure without progress
            if enrollment:
                module_progress = ModuleProgress.query.filter_by(
                    student_id=student_id,
                    module_id=module.id,
                    enrollment_id=enrollment.id
                ).first()
                
                if not module_progress:
                    # Initialize if missing
                    module_progress = ProgressionService._initialize_module_progress(
                        student_id, module.id, enrollment.id
                    )
                
                # Get assessment attempts for this module
                attempts = AssessmentAttempt.query.filter_by(
                    student_id=student_id,
                    module_id=module.id
                ).all()
                
                module_data = {
                    "module": module.to_dict(include_lessons=True),
                    "progress": module_progress.to_dict(),
                    "assessment_attempts": [attempt.to_dict() for attempt in attempts],
                    "can_retake": module_progress.status == 'failed' and module_progress.attempts_count < module_progress.max_attempts
                }
            else:
                # Instructor/admin preview mode - no progress data
                module_data = {
                    "module": module.to_dict(include_lessons=True),
                    "progress": None,
                    "assessment_attempts": [],
                    "can_retake": False,
                    "preview_mode": True
                }
            
            modules_data.append(module_data)
        
        # Get suspension status (only for enrolled students)
        suspension_status = None
        if enrollment:
            suspension_status = ProgressionService.check_student_suspension_status(student_id, course_id)
        
        return jsonify({
            "success": True,
            "data": {
                "course": course.to_dict(),
                "modules": modules_data,
                "suspension_status": suspension_status
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load course modules"
        }), 500

@learning_bp.route("/module/<int:module_id>/retake", methods=["POST"])
@student_required
def retake_module(module_id):
    """Allow student to retake a failed module"""
    try:
        student_id = int(get_jwt_identity())
        
        # Get module and enrollment
        module = Module.query.get(module_id)
        if not module:
            return jsonify({"error": "Module not found"}), 404
        
        enrollment = Enrollment.query.filter_by(
            student_id=student_id,
            course_id=module.course_id
        ).first()
        
        if not enrollment:
            return jsonify({"error": "Not enrolled in this course"}), 403
        
        # Check suspension status
        suspension_status = ProgressionService.check_student_suspension_status(student_id, module.course_id)
        if suspension_status["is_suspended"]:
            return jsonify({
                "error": "Cannot retake module - you are suspended from this course",
                "suspension_details": suspension_status["suspension_details"]
            }), 403
        
        # Attempt retake
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

@learning_bp.route("/module/<int:module_id>/check-completion", methods=["POST"])
@student_required
def check_module_completion(module_id):
    """Check if module can be marked as completed and auto-unlock next module"""
    try:
        student_id = int(get_jwt_identity())
        
        print(f"🔍 check_module_completion called for module_id={module_id}, student_id={student_id}")
        
        # Get module and enrollment
        module = Module.query.get(module_id)
        if not module:
            return jsonify({"error": "Module not found"}), 404
        
        enrollment = Enrollment.query.filter_by(
            student_id=student_id,
            course_id=module.course_id
        ).first()
        
        if not enrollment:
            return jsonify({"error": "Not enrolled in this course"}), 403
        
        # Get module progress for score breakdown
        from ..models.student_models import ModuleProgress
        module_progress = ModuleProgress.query.filter_by(
            student_id=student_id,
            module_id=module_id,
            enrollment_id=enrollment.id
        ).first()
        
        # Calculate cumulative score first
        cumulative_score = 0.0
        breakdown = {
            "course_contribution": 0.0,
            "quizzes": 0.0,
            "assignments": 0.0,
            "final_assessment": 0.0
        }
        
        if module_progress:
            # Recalculate the score from lessons first
            lessons_avg = module_progress.calculate_lessons_average_score()
            module_progress.course_contribution_score = lessons_avg
            cumulative_score = module_progress.calculate_cumulative_score()
            
            breakdown = {
                "course_contribution": module_progress.course_contribution_score or 0.0,
                "quizzes": module_progress.quiz_score or 0.0,
                "assignments": module_progress.assignment_score or 0.0,
                "final_assessment": module_progress.final_assessment_score or 0.0
            }
            
            print(f"📊 Module {module_id} score breakdown: {breakdown}")
            print(f"📊 Module {module_id} cumulative_score: {cumulative_score}")
            
            # Commit score updates and expire session to ensure fresh data
            get_db().session.commit()
            get_db().session.expire_all()
        else:
            print(f"⚠️ No module_progress found for module_id={module_id}, student_id={student_id}")
        
        # Check completion (this will read fresh data from DB)
        can_complete, message = ProgressionService.check_module_completion(
            student_id, module_id, enrollment.id
        )
        
        # Refresh module_progress after check_module_completion
        if module_progress:
            get_db().session.refresh(module_progress)
            cumulative_score = module_progress.cumulative_score or cumulative_score
        
        print(f"✅ check_module_completion result: can_complete={can_complete}, message={message}")
        
        # Find next module
        next_module = module.course.modules.filter(
            Module.order > module.order
        ).order_by(Module.order).first()
        
        next_module_info = None
        if next_module:
            next_module_info = {
                "id": next_module.id,
                "title": next_module.title
            }
        
        # Return frontend-compatible response
        return jsonify({
            "success": True,
            "passed": can_complete,
            "cumulative_score": cumulative_score,
            "breakdown": breakdown,
            "can_proceed": can_complete,
            "next_module": next_module_info,
            "message": message,
            "module_completed": can_complete
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "passed": False,
            "can_proceed": False,
            "error": f"Failed to check module completion: {str(e)}"
        }), 500

@learning_bp.route("/course/<int:course_id>/suspension-status", methods=["GET"])
@student_required
def get_suspension_status(course_id):
    """Get suspension status for a course"""
    try:
        student_id = int(get_jwt_identity())
        
        suspension_status = ProgressionService.check_student_suspension_status(student_id, course_id)
        
        return jsonify({
            "success": True,
            "data": suspension_status
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to check suspension status"
        }), 500

@learning_bp.route("/course/<int:course_id>/submit-appeal", methods=["POST"])
@student_required
def submit_suspension_appeal(course_id):
    """Submit an appeal for course suspension"""
    try:
        student_id = int(get_jwt_identity())
        data = request.get_json()
        
        if not data or 'appeal_text' not in data:
            return jsonify({"error": "Appeal text is required"}), 400
        
        appeal_text = data['appeal_text'].strip()
        if not appeal_text:
            return jsonify({"error": "Appeal text cannot be empty"}), 400
        
        success, message = ProgressionService.submit_appeal(
            student_id, course_id, appeal_text
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
            "error": "Failed to submit appeal"
        }), 500

# ✅ ENHANCED LEARNING FEATURES

@learning_bp.route("/course/<int:course_id>/next-lessons-enhanced", methods=["GET"])
@student_required
def get_next_lessons_enhanced(course_id):
    """Get next lessons with quiz information and recommendations"""
    try:
        student_id = int(get_jwt_identity())
        
        # Get next lessons with quiz info
        next_lessons = EnhancedLearningService.get_next_lessons_with_quiz_info(
            student_id, course_id, limit=10
        )
        
        return jsonify({
            "success": True,
            "data": next_lessons
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load enhanced lessons"
        }), 500

@learning_bp.route("/analytics/course/<int:course_id>", methods=["GET"])
@student_required
def get_course_analytics(course_id):
    """Get comprehensive learning analytics for a course"""
    try:
        student_id = int(get_jwt_identity())
        
        analytics = EnhancedLearningService.get_course_learning_analytics(
            student_id, course_id
        )
        
        if "error" in analytics:
            return jsonify({"error": analytics["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": analytics
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load analytics"
        }), 500

@learning_bp.route("/achievements", methods=["GET"])
@student_required
def get_achievements():
    """Get student learning achievements and milestones"""
    try:
        student_id = int(get_jwt_identity())
        course_id = request.args.get('course_id', type=int)
        
        achievements = EnhancedLearningService.get_learning_achievements(
            student_id, course_id
        )
        
        return jsonify({
            "success": True,
            "data": achievements
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load achievements"
        }), 500

@learning_bp.route("/streak", methods=["GET"])
@student_required
def get_learning_streak():
    """Get learning streak information"""
    try:
        student_id = int(get_jwt_identity())
        course_id = request.args.get('course_id', type=int)
        
        streak = EnhancedLearningService.get_learning_streak(
            student_id, course_id
        )
        
        return jsonify({
            "success": True,
            "data": streak
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load streak"
        }), 500

@learning_bp.route("/recommendations/<int:course_id>", methods=["GET"])
@student_required
def get_learning_recommendations(course_id):
    """Get adaptive learning recommendations"""
    try:
        student_id = int(get_jwt_identity())
        
        recommendations = EnhancedLearningService.get_adaptive_learning_recommendations(
            student_id, course_id
        )
        
        return jsonify({
            "success": True,
            "data": recommendations
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load recommendations"
        }), 500

@learning_bp.route("/lesson/<int:lesson_id>/quiz-redirect-check", methods=["GET"])
@student_required
def check_quiz_redirect(lesson_id):
    """Check if lesson has required quiz and return redirect info"""
    try:
        student_id = int(get_jwt_identity())
        
        quiz_redirect = EnhancedLearningService.auto_redirect_to_quiz_if_required(
            lesson_id, student_id
        )
        
        if quiz_redirect:
            return jsonify({
                "success": True,
                "data": quiz_redirect
            }), 200
        else:
            return jsonify({
                "success": True,
                "data": {"should_redirect": False}
            }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to check quiz requirement"
        }), 500