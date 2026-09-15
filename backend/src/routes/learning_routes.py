from ..utils.time_utils import now_local
# Learning Routes - My Learning page API endpoints
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
from flask_sqlalchemy import SQLAlchemy
import uuid
import os
import logging

from ..models.user_models import User, db
from ..models.course_models import Course, Module, Enrollment, Lesson
from ..models.student_models import (
    ModuleProgress,
    AssessmentAttempt,
    LessonCompletion,
    UserProgress,
)
from ..services.dashboard_service import DashboardService
from ..services.progression_service import ProgressionService
from ..services.enhanced_learning_service import EnhancedLearningService
from ..services.enhanced_module_unlock_service import EnhancedModuleUnlockService

logger = logging.getLogger(__name__)

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

def _check_enrollment_access(enrollment):
    """Check if a student's enrollment allows access (cohort started + payment verified).

    Returns (access_ok, error_response) where error_response is (json, http_status)
    when access is denied, or (None, None) when access is granted.
    Instructors and admins should bypass this check.
    """
    from ..services.waitlist_service import WaitlistService
    access_allowed, access_reason = WaitlistService.is_enrollment_access_allowed(enrollment)
    if access_allowed:
        return True, None

    cohort_info = WaitlistService.get_enrollment_cohort_payment_info(enrollment)
    reason_lower = access_reason.lower()
    course = enrollment.course

    if 'cohort has not started' in reason_lower:
        error_type = 'cohort_not_started'
        error_label = 'Cohort has not started'
        http_status = 403
        _win = enrollment.application_window
        if _win is None and course:
            from ..models.course_models import ApplicationWindow as _AW
            _win = _AW.query.filter_by(course_id=course.id).order_by(_AW.id.desc()).first()
        _cs_dt = (
            getattr(_win, 'cohort_start', None)
            or getattr(enrollment, 'cohort_start_date', None)
            or getattr(course, 'cohort_start_date', None)
        )
    elif 'terminated' in reason_lower or 'suspended' in reason_lower:
        error_type = 'enrollment_blocked'
        error_label = 'Enrollment blocked'
        http_status = 403
    else:
        error_type = 'payment_required'
        error_label = 'Payment required'
        http_status = 402

    resp_data = {
        "error": error_label,
        "error_type": error_type,
        "message": access_reason,
        **cohort_info,
    }
    if error_type == 'cohort_not_started' and _cs_dt:
        resp_data["cohort_start"] = _cs_dt.isoformat()

    return False, (jsonify(resp_data), http_status)



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

        # ── Enrollment access gate (cohort start + payment verification) ──
        from ..models.course_models import Lesson as _Lesson
        _lesson = _Lesson.query.get(lesson_id)
        if _lesson:
            _mod = Module.query.get(_lesson.module_id)
            if _mod:
                _enrollment = Enrollment.query.filter_by(
                    student_id=student_id, course_id=_mod.course_id
                ).first()
                if _enrollment:
                    access_ok, err_resp = _check_enrollment_access(_enrollment)
                    if not access_ok:
                        return err_resp

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
        
        # Check for view_as_student parameter for instructor preview mode
        view_as_student = request.args.get('view_as_student') == 'true'
        
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
        
        # ── Enrollment access gate (cohort start + payment verification) ──
        if enrollment and not is_instructor and not is_admin:
            access_ok, err_resp = _check_enrollment_access(enrollment)
            if not access_ok:
                return err_resp
        
        # OPTIMIZED: Load modules and lessons in efficient batch queries
        # For students: only show published AND released modules
        # For instructors/admins: show all modules
        total_published_count = None  # Track for student sidebar "X of Y modules"
        if is_instructor or is_admin:
            # Instructors and admins see all modules
            modules = Module.query.filter_by(course_id=course_id).order_by(Module.order).all()
        else:
            # Students: use cohort-aware release logic
            cohort_id = enrollment.application_window_id if enrollment else None
            modules = course.get_released_modules(cohort_id=cohort_id)
            total_published_count = course.modules.filter_by(is_published=True).count()
        
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
        
        # Batch-load module progress and lesson completion records. The learning
        # page needs the status of every lesson on its first render; returning
        # only aggregate counts causes it to initialize an empty completion map
        # and incorrectly start at lesson one.
        existing_progress_map = {}
        if enrollment and module_ids:
            existing_progress_map = {
                mp.module_id: mp for mp in ModuleProgress.query.filter(
                    ModuleProgress.student_id == student_id,
                    ModuleProgress.module_id.in_(module_ids),
                    ModuleProgress.enrollment_id == enrollment.id
                ).all()
            }

            try:
                missing_modules = [m for m in modules if m.id not in existing_progress_map]
                if missing_modules:
                    current_app.logger.info(
                        f"Initializing {len(missing_modules)} missing module progress records"
                    )
                    for module in missing_modules:
                        ProgressionService._initialize_module_progress(
                            student_id, module.id, enrollment.id
                        )
                    db.session.commit()

                # Re-query after initialization so newly-created records are
                # included in the response.
                existing_progress_map = {
                    mp.module_id: mp for mp in ModuleProgress.query.filter(
                        ModuleProgress.student_id == student_id,
                        ModuleProgress.module_id.in_(module_ids),
                        ModuleProgress.enrollment_id == enrollment.id
                    ).all()
                }
            except Exception as init_error:
                current_app.logger.error(
                    f"Error initializing module progress: {str(init_error)}"
                )
                db.session.rollback()

        all_visible_lessons = [
            lesson
            for module in modules
            for lesson in lessons_by_module.get(module.id, [])
        ]
        lesson_ids = [lesson.id for lesson in all_visible_lessons]
        completion_map = {}
        if enrollment and lesson_ids:
            completion_map = {
                completion.lesson_id: completion
                for completion in LessonCompletion.query.filter(
                    LessonCompletion.student_id == student_id,
                    LessonCompletion.lesson_id.in_(lesson_ids)
                ).all()
            }

        # Repair legacy records where a module stayed locked even though the
        # learner has a saved (possibly incomplete) lesson record in it.
        # Without this, the resume lesson is returned but rejected by the
        # module-access check in the frontend.
        if enrollment and completion_map:
            history_module_ids = {
                lesson.module_id
                for lesson in all_visible_lessons
                if lesson.id in completion_map
            }
            restored_progress = False
            for module_id in history_module_ids:
                module_progress = existing_progress_map.get(module_id)
                if module_progress and module_progress.status == "locked":
                    module_progress.status = "in_progress"
                    module_progress.prerequisites_met = True
                    module_progress.started_at = module_progress.started_at or now_local()
                    module_progress.unlocked_at = module_progress.unlocked_at or now_local()
                    restored_progress = True
            if restored_progress:
                db.session.commit()

        user_progress = None
        if enrollment:
            user_progress = UserProgress.query.filter_by(
                user_id=student_id,
                course_id=course_id
            ).first()

        modules_progress = []
        completed_lessons_count = 0
        lesson_records = []
        for module in modules:
            module_lessons = lessons_by_module.get(module.id, [])
            lessons_progress = []
            module_completed_count = 0

            for lesson in module_lessons:
                completion = completion_map.get(lesson.id)
                is_completed = bool(completion and completion.completed)
                if is_completed:
                    module_completed_count += 1
                    completed_lessons_count += 1

                lesson_data = {
                    "id": lesson.id,
                    "title": lesson.title,
                    "description": lesson.description or "",
                    "content_type": lesson.content_type,
                    "order": lesson.order,
                    "duration_minutes": lesson.duration_minutes,
                    "is_published": lesson.is_published,
                    "completed": is_completed,
                    "completion_date": (
                        completion.completed_at.isoformat()
                        if completion and completion.completed_at else None
                    ),
                    "time_spent": completion.time_spent if completion else 0,
                    "reading_progress": completion.reading_progress if completion else 0,
                    "engagement_score": completion.engagement_score if completion else 0,
                    "last_accessed": (
                        completion.last_accessed.isoformat()
                        if completion and completion.last_accessed else None
                    ),
                }
                lessons_progress.append(lesson_data)
                lesson_records.append((module, lesson, completion, is_completed))

            module_progress = existing_progress_map.get(module.id)
            module_progress_data = None
            if module_progress:
                # Use cached module scores here. Calling ModuleProgress.to_dict()
                # recalculates every lesson/assessment score and makes the
                # initial learning request unnecessarily expensive.
                cached_score = module_progress.cumulative_score or 0.0
                module_progress_data = {
                    "id": module_progress.id,
                    "student_id": module_progress.student_id,
                    "module_id": module_progress.module_id,
                    "enrollment_id": module_progress.enrollment_id,
                    "course_contribution_score": module_progress.course_contribution_score or 0.0,
                    "quiz_score": module_progress.quiz_score or 0.0,
                    "assignment_score": module_progress.assignment_score or 0.0,
                    "final_assessment_score": module_progress.final_assessment_score or 0.0,
                    "module_score": cached_score,
                    "lessons_average_score": cached_score,
                    "weighted_score": cached_score,
                    "cumulative_score": cached_score,
                    "attempts_count": module_progress.attempts_count or 0,
                    "max_attempts": module_progress.max_attempts or 3,
                    "status": module_progress.status or "locked",
                    "started_at": module_progress.started_at.isoformat() if module_progress.started_at else None,
                    "completed_at": module_progress.completed_at.isoformat() if module_progress.completed_at else None,
                    "failed_at": module_progress.failed_at.isoformat() if module_progress.failed_at else None,
                    "unlocked_at": module_progress.unlocked_at.isoformat() if module_progress.unlocked_at else None,
                    "prerequisites_met": module_progress.prerequisites_met or False,
                    "module_title": module.title,
                }
            modules_progress.append({
                "module": module.to_dict(),
                "progress": module_progress_data,
                # Keep the historical key used by the frontend, but include
                # `lessons` as well for clients using the clearer name.
                "lessons_completed": lessons_progress,
                "lessons": lessons_progress,
                "completed_lessons": module_completed_count,
                "total_lessons": len(lessons_progress),
                "progress_percentage": (
                    module_completed_count / len(lessons_progress) * 100
                    if lessons_progress else 0
                ),
            })

        # Resume the last incomplete lesson saved by autosave. If it was
        # completed since the last visit, continue with the first incomplete
        # lesson instead of sending the learner back to lesson one.
        resume_record = None
        if user_progress and user_progress.current_lesson_id:
            resume_record = next(
                (
                    record for record in lesson_records
                    if record[1].id == user_progress.current_lesson_id and not record[3]
                ),
                None,
            )
        if resume_record is None:
            # Backfill resume behavior for learners who have lesson progress
            # but no UserProgress row yet: the most recently accessed partial
            # lesson is the best available representation of where they left
            # off.
            partial_records = [
                record for record in lesson_records
                if not record[3] and record[2] and (
                    record[2].last_accessed or record[2].updated_at
                )
            ]
            if partial_records:
                resume_record = max(
                    partial_records,
                    key=lambda record: (
                        record[2].last_accessed or record[2].updated_at
                    ).timestamp()
                )
        if resume_record is None:
            resume_record = next(
                (record for record in lesson_records if not record[3]),
                None,
            )
        if resume_record is None and lesson_records:
            resume_record = lesson_records[0]

        current_lesson_id = resume_record[1].id if resume_record else None
        if user_progress and current_lesson_id and user_progress.current_lesson_id != current_lesson_id:
            user_progress.current_lesson_id = current_lesson_id
            user_progress.last_accessed = now_local()
            db.session.commit()

        if enrollment:
            completed_modules = sum(
                1 for item in modules_progress
                if item["progress"] and item["progress"].get("status") == "completed"
            )
            progress_data = {
                "overall_progress": (
                    completed_modules / len(modules) * 100 if modules else 0
                ),
                "completed_modules": completed_modules,
                "total_modules": len(modules),
                "lessons_completed": completed_lessons_count,
                "total_lessons": len(all_visible_lessons),
                "current_lesson_id": current_lesson_id,
                "modules": modules_progress,
            }
        else:
            progress_data = {
                "overall_progress": 0,
                "completed_modules": 0,
                "total_modules": len(modules),
                "lessons_completed": 0,
                "total_lessons": len(all_visible_lessons),
                "current_lesson_id": None,
                "modules": modules_progress,
                "preview_mode": True,
            }
        
        # OPTIMIZED: Build lightweight course data
        course_data = {
            "id": course.id,
            "title": course.title,
            "description": course.description,
            "instructor_id": course.instructor_id,
            "total_module_count": total_published_count if total_published_count is not None else len(modules),
            "released_module_count": len(modules),
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
        
        # Resolve the current lesson from the same resume record used by the
        # progress payload so the UI and API never disagree.
        current_lesson = None
        if resume_record:
            module, lesson = resume_record[0], resume_record[1]
            current_lesson = {
                "id": lesson.id,
                "title": lesson.title,
                "module_id": module.id,
                "module_title": module.title,
            }
        
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
            "current_lesson_id": current_lesson_id,
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
        
        # Check for view_as_student parameter for instructor preview mode
        view_as_student = request.args.get('view_as_student') == 'true'
        
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
        
        # ── Enrollment access gate (cohort start + payment verification) ──
        if enrollment and not is_instructor and not is_admin:
            access_ok, err_resp = _check_enrollment_access(enrollment)
            if not access_ok:
                return err_resp
        
        # Filter modules based on user role and course settings
        if is_instructor or is_admin:
            # Instructors and admins see all modules
            modules = course.modules.order_by(Module.order).all()
        else:
            # Students: use cohort-aware release logic
            cohort_id = enrollment.application_window_id if enrollment else None
            modules = course.get_released_modules(cohort_id=cohort_id)
        
        # Preserve access to modules with previously saved partial lesson
        # progress, including legacy records whose module status is still
        # locked.
        history_module_ids = set()
        if enrollment and modules:
            history_module_ids = {
                row[0] for row in db.session.query(Lesson.module_id)
                .join(LessonCompletion, LessonCompletion.lesson_id == Lesson.id)
                .filter(
                    Lesson.module_id.in_([module.id for module in modules]),
                    LessonCompletion.student_id == student_id,
                )
                .distinct()
                .all()
            }
        restored_module_progress = False

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

                if (
                    module.id in history_module_ids
                    and module_progress.status == 'locked'
                    and not view_as_student
                ):
                    module_progress.status = 'in_progress'
                    module_progress.prerequisites_met = True
                    module_progress.started_at = module_progress.started_at or now_local()
                    module_progress.unlocked_at = module_progress.unlocked_at or now_local()
                    restored_module_progress = True
                
                # Override module status for instructor view_as_student mode
                if view_as_student and (is_instructor or is_admin):
                    # Set all modules as unlocked for instructor preview
                    if module_progress.status == 'locked':
                        module_progress.status = 'unlocked'
                        module_progress.unlocked_at = now_local()
                        # Don't commit to database - this is just for preview
                
                # Get assessment attempts for this module
                attempts = AssessmentAttempt.query.filter_by(
                    student_id=student_id,
                    module_id=module.id
                ).all()
                
                module_data = {
                    "module": module.to_dict(include_lessons=True),
                    "progress": module_progress.to_dict(),
                    "assessment_attempts": [attempt.to_dict() for attempt in attempts],
                    "can_retake": module_progress.status == 'failed' and module_progress.attempts_count < module_progress.max_attempts,
                    "instructor_preview": view_as_student and (is_instructor or is_admin)
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

        if restored_module_progress:
            db.session.commit()
        
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

        # ── Enrollment access gate (cohort start + payment verification) ──
        access_ok, err_resp = _check_enrollment_access(enrollment)
        if not access_ok:
            return err_resp
        
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

@learning_bp.route("/module/<int:module_id>/unlock-eligibility", methods=["GET"])
@student_required
def check_module_unlock_eligibility(module_id):
    """Check comprehensive module unlock eligibility with detailed feedback"""
    try:
        student_id = int(get_jwt_identity())
        
        # Get enrollment
        module = Module.query.get(module_id)
        if not module:
            return jsonify({"error": "Module not found"}), 404
        
        enrollment = Enrollment.query.filter_by(
            student_id=student_id,
            course_id=module.course_id
        ).first()
        
        if not enrollment:
            return jsonify({"error": "Not enrolled in this course"}), 403

        # ── Enrollment access gate (cohort start + payment verification) ──
        access_ok, err_resp = _check_enrollment_access(enrollment)
        if not access_ok:
            return err_resp
        
        # Use enhanced service for comprehensive check
        eligibility_result = EnhancedModuleUnlockService.check_module_unlock_eligibility(
            student_id, module_id, enrollment.id
        )
        
        return jsonify({
            "success": True,
            "eligibility": eligibility_result
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Module unlock eligibility error: {str(e)}")
        return jsonify({"error": "Failed to check unlock eligibility"}), 500

@learning_bp.route("/module/<int:module_id>/unlock", methods=["POST"])
@student_required
def attempt_enhanced_module_unlock(module_id):
    """Attempt enhanced module unlock with comprehensive validation and feedback"""
    try:
        student_id = int(get_jwt_identity())
        
        # Get enrollment
        module = Module.query.get(module_id)
        if not module:
            return jsonify({"error": "Module not found"}), 404
        
        enrollment = Enrollment.query.filter_by(
            student_id=student_id,
            course_id=module.course_id
        ).first()
        
        if not enrollment:
            return jsonify({"error": "Not enrolled in this course"}), 403

        # ── Enrollment access gate (cohort start + payment verification) ──
        access_ok, err_resp = _check_enrollment_access(enrollment)
        if not access_ok:
            return err_resp
        
        # Use enhanced service for unlock attempt
        unlock_result = EnhancedModuleUnlockService.attempt_module_unlock(
            student_id, module_id, enrollment.id
        )
        
        # Log the unlock attempt result for debugging
        current_app.logger.info(f"Module unlock attempt for module {module_id} by student {student_id}: {unlock_result.get('error') or 'success'}")
        
        if unlock_result["success"]:
            return jsonify({
                "success": True,
                "message": "Module unlocked successfully",
                "result": unlock_result
            }), 200
        else:
            current_app.logger.warning(f"Module unlock failed for module {module_id}: {unlock_result.get('error')}. Details: {unlock_result.get('details')}")
            return jsonify({
                "success": False,
                "error": unlock_result.get("error", "Unlock failed"),
                "details": unlock_result
            }), 400
        
    except Exception as e:
        current_app.logger.error(f"Enhanced module unlock error: {str(e)}")
        return jsonify({"error": "Failed to unlock module"}), 500

@learning_bp.route("/course/<int:course_id>/unlock-progress", methods=["GET"])
@student_required
def get_course_unlock_progress(course_id):
    """Get comprehensive unlock progress for entire course"""
    try:
        student_id = int(get_jwt_identity())
        
        enrollment = Enrollment.query.filter_by(
            student_id=student_id,
            course_id=course_id
        ).first()
        
        if not enrollment:
            return jsonify({"error": "Not enrolled in this course"}), 403
        
        # Get comprehensive progress
        progress_result = EnhancedModuleUnlockService.get_module_unlock_progress(
            student_id, enrollment.id
        )
        
        if "error" in progress_result:
            return jsonify({"error": progress_result["error"]}), 500
        
        return jsonify({
            "success": True,
            "progress": progress_result
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Course unlock progress error: {str(e)}")
        return jsonify({"error": "Failed to get unlock progress"}), 500

@learning_bp.route("/lesson/<int:lesson_id>/score-breakdown", methods=["GET"])
@jwt_required()
def get_lesson_score_breakdown(lesson_id):
    """Get detailed lesson score breakdown with component scores"""
    try:
        student_id = get_jwt_identity()
        
        from ..services.lesson_completion_service import LessonCompletionService
        
        # Get comprehensive score breakdown
        breakdown = LessonCompletionService.get_lesson_score_breakdown(student_id, lesson_id)
        
        # Get lesson info for context
        from ..models.course_models import Lesson
        lesson = Lesson.query.get_or_404(lesson_id)
        
        return jsonify({
            'success': True,
            'lesson': {
                'id': lesson.id,
                'title': lesson.title,
                'module_id': lesson.module_id
            },
            'score_breakdown': breakdown,
            'message': f'Score breakdown retrieved for lesson: {lesson.title}'
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error getting lesson score breakdown: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get lesson score breakdown',
            'message': str(e)
        }), 500


@learning_bp.route("/module/<int:module_id>/check-completion", methods=["POST"])
@student_required  
def check_module_completion(module_id):
    """Legacy endpoint - Check if module can be marked as completed and auto-unlock next module"""
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

        # ── Enrollment access gate (cohort start + payment verification) ──
        access_ok, err_resp = _check_enrollment_access(enrollment)
        if not access_ok:
            return err_resp
        
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
