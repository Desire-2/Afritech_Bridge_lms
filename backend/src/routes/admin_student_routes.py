# admin_student_routes.py - Comprehensive Admin Student Management API

from flask import Blueprint, request, jsonify
from functools import wraps
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, or_, and_, desc, asc, case
from datetime import datetime, timedelta
from ..models.user_models import db, User, Role
from ..models.course_models import (
    Course, Module, Lesson, Enrollment, Quiz, Question, Answer,
    Submission, Assignment, AssignmentSubmission, Project, ProjectSubmission
)
from ..models.student_models import (
    LessonCompletion, UserProgress, ModuleProgress, StudentNote,
    StudentBookmark, Certificate, LearningAnalytics
)
import logging

logger = logging.getLogger(__name__)

admin_student_bp = Blueprint("admin_student_api", __name__, url_prefix="/api/v1/admin/students")


# --- Authorization Decorator ---
def admin_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        try:
            current_user_id = get_jwt_identity()
            current_user = User.query.get(current_user_id)
            if not current_user:
                return jsonify({"error": "User not found"}), 401
            if not current_user.role or current_user.role.name.lower() != "admin":
                return jsonify({"error": "Admin privileges required"}), 403
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Admin authorization error: {str(e)}")
            return jsonify({"error": "Authorization failed"}), 401
    return decorated_function


# ============================================================
# STUDENT LIST WITH ENRICHED DATA
# ============================================================
@admin_student_bp.route("", methods=["GET"])
@admin_required
def list_students():
    """
    List all students with enriched enrollment, progress, and performance data.
    Supports filtering, searching, sorting, and pagination.
    """
    try:
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)
        search = request.args.get("search", "").strip()
        status_filter = request.args.get("status")  # active, inactive
        course_filter = request.args.get("course_id", type=int)
        enrollment_status = request.args.get("enrollment_status")  # active, completed, terminated
        sort_by = request.args.get("sort_by", "created_at")
        sort_order = request.args.get("sort_order", "desc")
        performance = request.args.get("performance")  # high, medium, low
        date_from = request.args.get("date_from")
        date_to = request.args.get("date_to")

        # Get student role
        student_role = Role.query.filter_by(name="student").first()
        if not student_role:
            return jsonify({"error": "Student role not found"}), 500

        # Base query for students
        query = User.query.filter(User.role_id == student_role.id)

        # Search filter
        if search:
            pattern = f"%{search}%"
            query = query.filter(
                or_(
                    User.username.ilike(pattern),
                    User.email.ilike(pattern),
                    User.first_name.ilike(pattern),
                    User.last_name.ilike(pattern)
                )
            )

        # Status filter
        if status_filter == "active":
            query = query.filter(User.is_active == True)
        elif status_filter == "inactive":
            query = query.filter(User.is_active == False)

        # Course filter - only students enrolled in a specific course
        if course_filter:
            query = query.filter(
                User.id.in_(
                    db.session.query(Enrollment.student_id).filter(
                        Enrollment.course_id == course_filter
                    )
                )
            )

        # Enrollment status filter
        if enrollment_status:
            query = query.filter(
                User.id.in_(
                    db.session.query(Enrollment.student_id).filter(
                        Enrollment.status == enrollment_status
                    )
                )
            )

        # Date range filter
        if date_from:
            try:
                query = query.filter(User.created_at >= datetime.fromisoformat(date_from))
            except ValueError:
                pass
        if date_to:
            try:
                query = query.filter(User.created_at <= datetime.fromisoformat(date_to))
            except ValueError:
                pass

        # Sorting
        sort_map = {
            "username": User.username,
            "email": User.email,
            "created_at": User.created_at,
            "last_activity": User.last_activity,
            "last_login": User.last_login,
        }
        order_col = sort_map.get(sort_by, User.created_at)
        query = query.order_by(order_col.desc() if sort_order == "desc" else order_col.asc())

        # Paginate
        paginated = query.paginate(page=page, per_page=per_page, error_out=False)
        students = paginated.items

        # Enrich student data with enrollment/progress info
        student_list = []
        for student in students:
            enrollments = Enrollment.query.filter_by(student_id=student.id).all()
            total_enrollments = len(enrollments)
            active_enrollments = sum(1 for e in enrollments if e.status == "active")
            completed_enrollments = sum(1 for e in enrollments if e.status == "completed")
            
            # Calculate average progress
            avg_progress = 0.0
            if enrollments:
                total_progress = sum(e.progress or 0 for e in enrollments)
                avg_progress = round(total_progress / total_enrollments * 100, 1)

            # Get completed lessons count
            lessons_completed = LessonCompletion.query.filter_by(
                student_id=student.id, completed=True
            ).count()

            # Get quiz submissions count
            quiz_submissions = Submission.query.filter_by(student_id=student.id).count()

            # Get certificates count
            certificates = Certificate.query.filter_by(student_id=student.id).count()

            # Calculate average score from module progress (uses cumulative_score)
            module_progresses = ModuleProgress.query.filter_by(student_id=student.id).all()
            avg_score = 0.0
            if module_progresses:
                scores = [mp.cumulative_score or 0 for mp in module_progresses if mp.cumulative_score is not None]
                avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

            # Days since last activity
            days_inactive = None
            if student.last_activity:
                days_inactive = (datetime.utcnow() - student.last_activity).days

            student_data = {
                **student.to_dict(),
                "enrollment_summary": {
                    "total": total_enrollments,
                    "active": active_enrollments,
                    "completed": completed_enrollments,
                    "terminated": sum(1 for e in enrollments if e.status == "terminated"),
                },
                "progress_summary": {
                    "avg_progress": avg_progress,
                    "avg_score": avg_score,
                    "lessons_completed": lessons_completed,
                    "quiz_submissions": quiz_submissions,
                    "certificates": certificates,
                },
                "activity": {
                    "last_login": student.last_login.isoformat() if student.last_login else None,
                    "last_activity": student.last_activity.isoformat() if student.last_activity else None,
                    "days_inactive": days_inactive,
                }
            }
            
            # Performance classification
            if avg_score >= 80:
                student_data["performance_level"] = "high"
            elif avg_score >= 50:
                student_data["performance_level"] = "medium"
            else:
                student_data["performance_level"] = "low"

            student_list.append(student_data)

        # Apply performance filter on enriched data (post-query)
        if performance:
            student_list = [s for s in student_list if s.get("performance_level") == performance]

        # Summary statistics
        total_students = User.query.filter(User.role_id == student_role.id).count()
        active_students = User.query.filter(User.role_id == student_role.id, User.is_active == True).count()
        
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        recently_active = User.query.filter(
            User.role_id == student_role.id,
            User.last_activity >= seven_days_ago
        ).count()

        return jsonify({
            "students": student_list,
            "pagination": {
                "current_page": paginated.page,
                "per_page": paginated.per_page,
                "total_pages": paginated.pages,
                "total_items": paginated.total,
                "has_next": paginated.has_next,
                "has_prev": paginated.has_prev,
            },
            "summary": {
                "total_students": total_students,
                "active_students": active_students,
                "inactive_students": total_students - active_students,
                "recently_active_7d": recently_active,
            }
        }), 200

    except Exception as e:
        logger.error(f"Error listing students: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to retrieve students"}), 500


# ============================================================
# STUDENT DETAIL VIEW
# ============================================================
@admin_student_bp.route("/<int:student_id>", methods=["GET"])
@admin_required
def get_student_detail(student_id):
    """Get comprehensive student detail including all enrollments, progress, and analytics."""
    try:
        student = User.query.get_or_404(student_id)
        
        # Verify this is a student
        if not student.role or student.role.name.lower() != "student":
            return jsonify({"error": "User is not a student"}), 400

        student_data = student.to_dict()

        # --- Enrollments with course details ---
        enrollments = Enrollment.query.filter_by(student_id=student_id).all()
        enrollment_details = []
        for enrollment in enrollments:
            course = enrollment.course
            e_data = enrollment.to_dict()
            
            # Get module progress for this enrollment
            module_progresses = ModuleProgress.query.filter_by(
                student_id=student_id,
                enrollment_id=enrollment.id
            ).all()
            
            e_data["module_progress"] = []
            for mp in module_progresses:
                module = Module.query.get(mp.module_id)
                e_data["module_progress"].append({
                    "module_id": mp.module_id,
                    "module_title": module.title if module else "Unknown",
                    "module_score": mp.cumulative_score,
                    "is_completed": mp.status == "completed",
                    "completed_at": mp.completed_at.isoformat() if mp.completed_at else None,
                })
            
            # Count lessons completed for this course
            course_lessons = Lesson.query.join(Module).filter(Module.course_id == course.id).all()
            lesson_ids = [l.id for l in course_lessons]
            lessons_done = LessonCompletion.query.filter(
                LessonCompletion.student_id == student_id,
                LessonCompletion.lesson_id.in_(lesson_ids),
                LessonCompletion.completed == True
            ).count() if lesson_ids else 0
            
            e_data["lessons_completed"] = lessons_done
            e_data["total_lessons"] = len(lesson_ids)
            
            enrollment_details.append(e_data)

        # --- Quiz Performance ---
        quiz_submissions = Submission.query.filter_by(student_id=student_id).all()
        quiz_perf = []
        for sub in quiz_submissions:
            quiz = Quiz.query.get(sub.quiz_id) if sub.quiz_id else None
            quiz_perf.append({
                "id": sub.id,
                "quiz_id": sub.quiz_id,
                "quiz_title": quiz.title if quiz else "Unknown",
                "score": sub.score,
                "max_score": sub.max_score if hasattr(sub, 'max_score') else None,
                "submitted_at": sub.submitted_at.isoformat() if hasattr(sub, 'submitted_at') and sub.submitted_at else None,
                "created_at": sub.created_at.isoformat() if hasattr(sub, 'created_at') and sub.created_at else None,
            })

        # --- Certificates ---
        certificates = Certificate.query.filter_by(student_id=student_id).all()
        cert_list = []
        for cert in certificates:
            course = Course.query.get(cert.course_id)
            cert_list.append({
                "id": cert.id,
                "course_id": cert.course_id,
                "course_title": course.title if course else "Unknown",
                "issued_at": cert.issued_at.isoformat() if hasattr(cert, 'issued_at') and cert.issued_at else None,
                "created_at": cert.created_at.isoformat() if hasattr(cert, 'created_at') and cert.created_at else None,
                "certificate_url": cert.certificate_url if hasattr(cert, 'certificate_url') else None,
            })

        # --- Learning Analytics ---
        analytics = LearningAnalytics.query.filter_by(student_id=student_id).first()
        analytics_data = None
        if analytics:
            analytics_data = {
                "total_time_spent": analytics.total_time_spent if hasattr(analytics, 'total_time_spent') else 0,
                "avg_session_duration": analytics.avg_session_duration if hasattr(analytics, 'avg_session_duration') else 0,
                "login_count": analytics.login_count if hasattr(analytics, 'login_count') else 0,
            }

        # --- Achievement Data ---
        try:
            from ..models.achievement_models import UserAchievement, LearningStreak, StudentPoints
            achievements = UserAchievement.query.filter_by(user_id=student_id).count()
            streak = LearningStreak.query.filter_by(user_id=student_id).first()
            points = StudentPoints.query.filter_by(user_id=student_id).first()
            achievement_data = {
                "total_achievements": achievements,
                "current_streak": streak.current_streak if streak and hasattr(streak, 'current_streak') else 0,
                "longest_streak": streak.longest_streak if streak and hasattr(streak, 'longest_streak') else 0,
                "total_points": points.total_points if points and hasattr(points, 'total_points') else 0,
            }
        except (ImportError, Exception):
            achievement_data = {"total_achievements": 0, "current_streak": 0, "longest_streak": 0, "total_points": 0}

        # --- Notes & Bookmarks count ---
        notes_count = StudentNote.query.filter_by(student_id=student_id).count()
        bookmarks_count = StudentBookmark.query.filter_by(student_id=student_id).count()

        return jsonify({
            "student": student_data,
            "enrollments": enrollment_details,
            "quiz_performance": quiz_perf,
            "certificates": cert_list,
            "analytics": analytics_data,
            "achievements": achievement_data,
            "study_materials": {
                "notes_count": notes_count,
                "bookmarks_count": bookmarks_count,
            },
            "account_info": {
                "created_at": student.created_at.isoformat() if student.created_at else None,
                "last_login": student.last_login.isoformat() if student.last_login else None,
                "last_activity": student.last_activity.isoformat() if student.last_activity else None,
                "days_inactive": student.get_days_since_last_activity(),
                "is_active": student.is_active,
            }
        }), 200

    except Exception as e:
        logger.error(f"Error getting student detail {student_id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to retrieve student details"}), 500


# ============================================================
# STUDENT ENROLLMENTS MANAGEMENT
# ============================================================
@admin_student_bp.route("/<int:student_id>/enrollments", methods=["GET"])
@admin_required
def get_student_enrollments(student_id):
    """Get all enrollments for a specific student with detailed info."""
    try:
        student = User.query.get_or_404(student_id)
        enrollments = Enrollment.query.filter_by(student_id=student_id).order_by(
            Enrollment.enrollment_date.desc()
        ).all()

        return jsonify({
            "student": {"id": student.id, "username": student.username, "full_name": student.full_name},
            "enrollments": [e.to_dict() for e in enrollments],
            "total": len(enrollments),
        }), 200

    except Exception as e:
        logger.error(f"Error getting enrollments for student {student_id}: {str(e)}")
        return jsonify({"error": "Failed to retrieve enrollments"}), 500


@admin_student_bp.route("/<int:student_id>/enroll", methods=["POST"])
@admin_required
def enroll_student(student_id):
    """Admin enrolls a student into a course."""
    try:
        student = User.query.get_or_404(student_id)
        if not student.role or student.role.name.lower() != "student":
            return jsonify({"error": "User is not a student"}), 400

        data = request.get_json()
        course_id = data.get("course_id")
        if not course_id:
            return jsonify({"error": "course_id is required"}), 400

        course = Course.query.get_or_404(course_id)

        # Check for existing active enrollment
        existing = Enrollment.query.filter_by(
            student_id=student_id, course_id=course_id, status="active"
        ).first()
        if existing:
            return jsonify({"error": "Student is already enrolled in this course"}), 409

        enrollment = Enrollment(
            student_id=student_id,
            course_id=course_id,
            status="active",
            payment_status=data.get("payment_status", "not_required"),
            payment_verified=data.get("payment_verified", True),
            cohort_label=data.get("cohort_label"),
        )
        db.session.add(enrollment)
        db.session.commit()

        logger.info(f"Admin enrolled student {student.username} in course {course.title}")
        return jsonify({
            "message": f"Student enrolled in '{course.title}' successfully",
            "enrollment": enrollment.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error enrolling student {student_id}: {str(e)}")
        return jsonify({"error": "Failed to enroll student"}), 500


@admin_student_bp.route("/<int:student_id>/enrollments/<int:enrollment_id>", methods=["PUT"])
@admin_required
def update_enrollment(student_id, enrollment_id):
    """Update enrollment status (terminate, reactivate, complete, suspend)."""
    try:
        enrollment = Enrollment.query.filter_by(
            id=enrollment_id, student_id=student_id
        ).first_or_404()

        data = request.get_json()
        action = data.get("action")  # terminate, reactivate, complete, suspend

        current_user_id = get_jwt_identity()

        if action == "terminate":
            enrollment.status = "terminated"
            enrollment.terminated_at = datetime.utcnow()
            enrollment.terminated_by = current_user_id
            enrollment.termination_reason = data.get("reason", "Terminated by admin")
        elif action == "reactivate":
            enrollment.status = "active"
            enrollment.terminated_at = None
            enrollment.terminated_by = None
            enrollment.termination_reason = None
        elif action == "complete":
            enrollment.status = "completed"
            enrollment.completed_at = datetime.utcnow()
            enrollment.progress = 1.0
        elif action == "suspend":
            enrollment.status = "suspended"
        elif action == "update_payment":
            enrollment.payment_status = data.get("payment_status", enrollment.payment_status)
            enrollment.payment_verified = data.get("payment_verified", enrollment.payment_verified)
            if enrollment.payment_verified and not enrollment.payment_verified_at:
                enrollment.payment_verified_at = datetime.utcnow()
                enrollment.payment_verified_by = current_user_id
        else:
            return jsonify({
                "error": "Invalid action",
                "valid_actions": ["terminate", "reactivate", "complete", "suspend", "update_payment"]
            }), 400

        db.session.commit()
        logger.info(f"Enrollment {enrollment_id} updated: {action}")

        return jsonify({
            "message": f"Enrollment {action} successful",
            "enrollment": enrollment.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating enrollment {enrollment_id}: {str(e)}")
        return jsonify({"error": "Failed to update enrollment"}), 500


@admin_student_bp.route("/<int:student_id>/enrollments/<int:enrollment_id>", methods=["DELETE"])
@admin_required
def remove_enrollment(student_id, enrollment_id):
    """Remove a student enrollment and all associated progress data."""
    try:
        enrollment = Enrollment.query.filter_by(
            id=enrollment_id, student_id=student_id
        ).first_or_404()

        course_title = enrollment.course.title if enrollment.course else "Unknown"

        # Clean up progress data for this enrollment
        ModuleProgress.query.filter_by(
            student_id=student_id, enrollment_id=enrollment_id
        ).delete()

        # Remove lesson completions for lessons in this course
        course_lessons = Lesson.query.join(Module).filter(
            Module.course_id == enrollment.course_id
        ).all()
        lesson_ids = [l.id for l in course_lessons]
        if lesson_ids:
            LessonCompletion.query.filter(
                LessonCompletion.student_id == student_id,
                LessonCompletion.lesson_id.in_(lesson_ids)
            ).delete(synchronize_session='fetch')

        db.session.delete(enrollment)
        db.session.commit()

        logger.info(f"Enrollment {enrollment_id} removed for student {student_id}")
        return jsonify({
            "message": f"Enrollment in '{course_title}' removed successfully"
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error removing enrollment {enrollment_id}: {str(e)}")
        return jsonify({"error": "Failed to remove enrollment"}), 500


# ============================================================
# BULK ENROLLMENT
# ============================================================
@admin_student_bp.route("/bulk-enroll", methods=["POST"])
@admin_required
def bulk_enroll_students():
    """Bulk enroll multiple students into a course."""
    try:
        data = request.get_json()
        student_ids = data.get("student_ids", [])
        course_id = data.get("course_id")

        if not student_ids or not course_id:
            return jsonify({"error": "student_ids and course_id are required"}), 400

        if len(student_ids) > 200:
            return jsonify({"error": "Cannot enroll more than 200 students at once"}), 400

        course = Course.query.get_or_404(course_id)
        
        enrolled = 0
        skipped = 0
        errors = []

        for sid in student_ids:
            student = User.query.get(sid)
            if not student:
                errors.append(f"Student {sid} not found")
                continue
            if not student.role or student.role.name.lower() != "student":
                errors.append(f"User {sid} ({student.username}) is not a student")
                continue

            existing = Enrollment.query.filter_by(
                student_id=sid, course_id=course_id, status="active"
            ).first()
            if existing:
                skipped += 1
                continue

            enrollment = Enrollment(
                student_id=sid,
                course_id=course_id,
                status="active",
                payment_status=data.get("payment_status", "not_required"),
                payment_verified=data.get("payment_verified", True),
                cohort_label=data.get("cohort_label"),
            )
            db.session.add(enrollment)
            enrolled += 1

        db.session.commit()

        return jsonify({
            "message": f"Bulk enrollment completed",
            "enrolled": enrolled,
            "skipped": skipped,
            "errors": errors,
            "course": course.title,
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in bulk enrollment: {str(e)}")
        return jsonify({"error": "Bulk enrollment failed"}), 500


# ============================================================
# RESET STUDENT PROGRESS
# ============================================================
@admin_student_bp.route("/<int:student_id>/reset-progress", methods=["POST"])
@admin_required
def reset_student_progress(student_id):
    """Reset student's progress for a specific course or all courses."""
    try:
        student = User.query.get_or_404(student_id)
        data = request.get_json() or {}
        course_id = data.get("course_id")  # Optional: reset for specific course
        reset_type = data.get("reset_type", "progress")  # progress, full

        if course_id:
            # Reset for specific course
            course = Course.query.get_or_404(course_id)
            enrollment = Enrollment.query.filter_by(
                student_id=student_id, course_id=course_id
            ).first()
            
            if not enrollment:
                return jsonify({"error": "Student not enrolled in this course"}), 404

            # Reset module progress
            ModuleProgress.query.filter_by(
                student_id=student_id, enrollment_id=enrollment.id
            ).delete()

            # Reset lesson completions
            course_lessons = Lesson.query.join(Module).filter(
                Module.course_id == course_id
            ).all()
            lesson_ids = [l.id for l in course_lessons]
            if lesson_ids:
                LessonCompletion.query.filter(
                    LessonCompletion.student_id == student_id,
                    LessonCompletion.lesson_id.in_(lesson_ids)
                ).delete(synchronize_session='fetch')

            # Reset enrollment progress
            enrollment.progress = 0.0
            enrollment.completed_at = None
            if enrollment.status == "completed":
                enrollment.status = "active"

            if reset_type == "full":
                # Also reset quiz submissions
                course_quizzes = Quiz.query.filter(
                    or_(
                        Quiz.course_id == course_id,
                        Quiz.module_id.in_(
                            db.session.query(Module.id).filter(Module.course_id == course_id)
                        )
                    )
                ).all()
                quiz_ids = [q.id for q in course_quizzes]
                if quiz_ids:
                    Submission.query.filter(
                        Submission.student_id == student_id,
                        Submission.quiz_id.in_(quiz_ids)
                    ).delete(synchronize_session='fetch')
                
                # Reset certificates for this course
                Certificate.query.filter_by(
                    student_id=student_id, course_id=course_id
                ).delete()

            db.session.commit()
            return jsonify({
                "message": f"Progress reset for '{course.title}'",
                "reset_type": reset_type,
                "course": course.title
            }), 200
        else:
            # Reset all progress
            ModuleProgress.query.filter_by(student_id=student_id).delete()
            LessonCompletion.query.filter_by(student_id=student_id).delete()
            UserProgress.query.filter_by(user_id=student_id).delete()

            # Reset all enrollments progress
            enrollments = Enrollment.query.filter_by(student_id=student_id).all()
            for e in enrollments:
                e.progress = 0.0
                e.completed_at = None
                if e.status == "completed":
                    e.status = "active"

            if reset_type == "full":
                Submission.query.filter_by(student_id=student_id).delete()
                Certificate.query.filter_by(student_id=student_id).delete()
                StudentNote.query.filter_by(student_id=student_id).delete()
                StudentBookmark.query.filter_by(student_id=student_id).delete()

            db.session.commit()
            return jsonify({
                "message": "All progress reset successfully",
                "reset_type": reset_type,
            }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error resetting progress for student {student_id}: {str(e)}")
        return jsonify({"error": "Failed to reset progress"}), 500


# ============================================================
# STUDENT PERFORMANCE REPORT
# ============================================================
@admin_student_bp.route("/performance-report", methods=["GET"])
@admin_required
def student_performance_report():
    """Get aggregated student performance analytics."""
    try:
        course_id = request.args.get("course_id", type=int)
        period = request.args.get("period", "30d")  # 7d, 30d, 90d, all

        # Period calculation
        period_map = {
            "7d": timedelta(days=7),
            "30d": timedelta(days=30),
            "90d": timedelta(days=90),
        }
        start_date = None
        if period in period_map:
            start_date = datetime.utcnow() - period_map[period]

        student_role = Role.query.filter_by(name="student").first()
        if not student_role:
            return jsonify({"error": "Student role not found"}), 500

        # Total students
        total_students = User.query.filter(User.role_id == student_role.id).count()

        # Enrollment statistics
        enrollment_query = Enrollment.query
        if course_id:
            enrollment_query = enrollment_query.filter(Enrollment.course_id == course_id)
        if start_date:
            enrollment_query = enrollment_query.filter(Enrollment.enrollment_date >= start_date)

        total_enrollments = enrollment_query.count()
        active_enrollments = enrollment_query.filter(Enrollment.status == "active").count()
        completed_enrollments = enrollment_query.filter(Enrollment.status == "completed").count()
        terminated_enrollments = enrollment_query.filter(Enrollment.status == "terminated").count()

        # Average progress
        avg_progress = db.session.query(
            func.avg(Enrollment.progress)
        ).filter(
            Enrollment.status == "active"
        )
        if course_id:
            avg_progress = avg_progress.filter(Enrollment.course_id == course_id)
        avg_progress_val = avg_progress.scalar() or 0
        avg_progress_pct = round(float(avg_progress_val) * 100, 1)

        # Completion rate
        completion_rate = round(
            (completed_enrollments / total_enrollments * 100) if total_enrollments > 0 else 0, 1
        )

        # Lesson completion stats
        lesson_completions = LessonCompletion.query.filter(LessonCompletion.completed == True)
        if start_date:
            lesson_completions = lesson_completions.filter(LessonCompletion.completed_at >= start_date)
        total_lesson_completions = lesson_completions.count()

        # Top performing students (by average module score)
        top_students_query = db.session.query(
            User.id,
            User.username,
            User.first_name,
            User.last_name,
            User.email,
            func.avg(ModuleProgress.cumulative_score).label("avg_score"),
            func.count(ModuleProgress.id).label("modules_completed"),
        ).join(
            ModuleProgress, ModuleProgress.student_id == User.id
        ).filter(
            User.role_id == student_role.id,
            ModuleProgress.cumulative_score.isnot(None)
        ).group_by(User.id, User.username, User.first_name, User.last_name, User.email
        ).order_by(desc("avg_score")).limit(10).all()

        top_students = [{
            "id": s.id,
            "username": s.username,
            "full_name": f"{s.first_name or ''} {s.last_name or ''}".strip() or s.username,
            "email": s.email,
            "avg_score": round(float(s.avg_score), 1),
            "modules_completed": s.modules_completed,
        } for s in top_students_query]

        # Students needing attention (low progress, active enrollment)
        at_risk_query = db.session.query(
            User.id,
            User.username,
            User.first_name,
            User.last_name,
            User.email,
            Enrollment.progress,
            Course.title.label("course_title"),
            Enrollment.enrollment_date,
        ).join(
            Enrollment, Enrollment.student_id == User.id
        ).join(
            Course, Course.id == Enrollment.course_id
        ).filter(
            User.role_id == student_role.id,
            Enrollment.status == "active",
            Enrollment.progress < 0.2,
        ).order_by(Enrollment.enrollment_date.asc()).limit(20).all()

        at_risk = [{
            "id": s.id,
            "username": s.username,
            "full_name": f"{s.first_name or ''} {s.last_name or ''}".strip() or s.username,
            "email": s.email,
            "progress": round(float(s.progress or 0) * 100, 1),
            "course_title": s.course_title,
            "enrolled_since": s.enrollment_date.isoformat() if s.enrollment_date else None,
        } for s in at_risk_query]

        # Course-wise performance
        course_performance = db.session.query(
            Course.id,
            Course.title,
            func.count(Enrollment.id).label("enrolled"),
            func.sum(case((Enrollment.status == "completed", 1), else_=0)).label("completed"),
            func.avg(Enrollment.progress).label("avg_progress"),
        ).join(
            Enrollment, Enrollment.course_id == Course.id
        ).group_by(Course.id, Course.title).all()

        courses_perf = [{
            "course_id": c.id,
            "course_title": c.title,
            "enrolled": c.enrolled,
            "completed": int(c.completed or 0),
            "avg_progress": round(float(c.avg_progress or 0) * 100, 1),
            "completion_rate": round(int(c.completed or 0) / c.enrolled * 100, 1) if c.enrolled > 0 else 0,
        } for c in course_performance]

        return jsonify({
            "overview": {
                "total_students": total_students,
                "total_enrollments": total_enrollments,
                "active_enrollments": active_enrollments,
                "completed_enrollments": completed_enrollments,
                "terminated_enrollments": terminated_enrollments,
                "avg_progress": avg_progress_pct,
                "completion_rate": completion_rate,
                "total_lesson_completions": total_lesson_completions,
            },
            "top_students": top_students,
            "at_risk_students": at_risk,
            "course_performance": courses_perf,
            "period": period,
        }), 200

    except Exception as e:
        logger.error(f"Error generating performance report: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to generate performance report"}), 500


# ============================================================
# STUDENT STATS SUMMARY
# ============================================================
@admin_student_bp.route("/stats", methods=["GET"])
@admin_required
def student_stats():
    """Quick student statistics for dashboard cards."""
    try:
        student_role = Role.query.filter_by(name="student").first()
        if not student_role:
            return jsonify({"error": "Student role not found"}), 500

        total = User.query.filter(User.role_id == student_role.id).count()
        active = User.query.filter(User.role_id == student_role.id, User.is_active == True).count()

        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)

        new_7d = User.query.filter(
            User.role_id == student_role.id,
            User.created_at >= seven_days_ago
        ).count()
        new_30d = User.query.filter(
            User.role_id == student_role.id,
            User.created_at >= thirty_days_ago
        ).count()

        active_7d = User.query.filter(
            User.role_id == student_role.id,
            User.last_activity >= seven_days_ago
        ).count()

        total_enrollments = Enrollment.query.count()
        active_enrollments = Enrollment.query.filter_by(status="active").count()
        completed_enrollments = Enrollment.query.filter_by(status="completed").count()

        total_certificates = Certificate.query.count()
        total_lesson_completions = LessonCompletion.query.filter_by(completed=True).count()

        return jsonify({
            "total_students": total,
            "active_students": active,
            "inactive_students": total - active,
            "new_students_7d": new_7d,
            "new_students_30d": new_30d,
            "active_last_7d": active_7d,
            "enrollment_stats": {
                "total": total_enrollments,
                "active": active_enrollments,
                "completed": completed_enrollments,
            },
            "achievement_stats": {
                "certificates_issued": total_certificates,
                "lessons_completed": total_lesson_completions,
            }
        }), 200

    except Exception as e:
        logger.error(f"Error getting student stats: {str(e)}")
        return jsonify({"error": "Failed to get student stats"}), 500


# ============================================================
# TOGGLE STUDENT ACCOUNT STATUS
# ============================================================
@admin_student_bp.route("/<int:student_id>/toggle-status", methods=["POST"])
@admin_required
def toggle_student_status(student_id):
    """Activate or deactivate a student account."""
    try:
        student = User.query.get_or_404(student_id)
        student.is_active = not student.is_active
        db.session.commit()

        status = "activated" if student.is_active else "deactivated"
        logger.info(f"Student {student.username} {status} by admin")
        return jsonify({
            "message": f"Student {status} successfully",
            "is_active": student.is_active
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error toggling student status {student_id}: {str(e)}")
        return jsonify({"error": "Failed to toggle student status"}), 500


# ============================================================
# BULK STUDENT ACTIONS
# ============================================================
@admin_student_bp.route("/bulk-action", methods=["POST"])
@admin_required
def bulk_student_action():
    """Perform bulk actions on multiple students."""
    try:
        data = request.get_json()
        student_ids = data.get("student_ids", [])
        action = data.get("action")

        if not student_ids:
            return jsonify({"error": "No student IDs provided"}), 400
        if not action:
            return jsonify({"error": "No action specified"}), 400
        if len(student_ids) > 200:
            return jsonify({"error": "Cannot process more than 200 students at once"}), 400

        current_user_id = get_jwt_identity()
        affected = 0
        errors = []

        if action == "activate":
            students = User.query.filter(User.id.in_(student_ids), User.is_active == False).all()
            for s in students:
                s.is_active = True
                affected += 1

        elif action == "deactivate":
            students = User.query.filter(User.id.in_(student_ids), User.is_active == True).all()
            for s in students:
                s.is_active = False
                affected += 1

        elif action == "enroll":
            course_id = data.get("course_id")
            if not course_id:
                return jsonify({"error": "course_id required for enroll action"}), 400
            course = Course.query.get_or_404(course_id)
            for sid in student_ids:
                existing = Enrollment.query.filter_by(
                    student_id=sid, course_id=course_id, status="active"
                ).first()
                if existing:
                    continue
                enrollment = Enrollment(
                    student_id=sid, course_id=course_id, status="active",
                    payment_status="not_required", payment_verified=True
                )
                db.session.add(enrollment)
                affected += 1

        elif action == "unenroll":
            course_id = data.get("course_id")
            if not course_id:
                return jsonify({"error": "course_id required for unenroll action"}), 400
            enrollments = Enrollment.query.filter(
                Enrollment.student_id.in_(student_ids),
                Enrollment.course_id == course_id,
                Enrollment.status == "active"
            ).all()
            for e in enrollments:
                e.status = "terminated"
                e.terminated_at = datetime.utcnow()
                e.terminated_by = current_user_id
                e.termination_reason = "Bulk unenrolled by admin"
                affected += 1

        elif action == "reset_progress":
            course_id = data.get("course_id")
            for sid in student_ids:
                try:
                    if course_id:
                        enrollment = Enrollment.query.filter_by(
                            student_id=sid, course_id=course_id
                        ).first()
                        if enrollment:
                            ModuleProgress.query.filter_by(
                                student_id=sid, enrollment_id=enrollment.id
                            ).delete()
                            enrollment.progress = 0.0
                            enrollment.completed_at = None
                            affected += 1
                    else:
                        ModuleProgress.query.filter_by(student_id=sid).delete()
                        LessonCompletion.query.filter_by(student_id=sid).delete()
                        for e in Enrollment.query.filter_by(student_id=sid).all():
                            e.progress = 0.0
                            e.completed_at = None
                        affected += 1
                except Exception as ex:
                    errors.append(f"Error resetting student {sid}: {str(ex)}")

        else:
            return jsonify({
                "error": "Invalid action",
                "valid_actions": ["activate", "deactivate", "enroll", "unenroll", "reset_progress"]
            }), 400

        db.session.commit()
        return jsonify({
            "message": f"Bulk action '{action}' completed",
            "affected": affected,
            "total_requested": len(student_ids),
            "errors": errors if errors else None,
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in bulk student action: {str(e)}", exc_info=True)
        return jsonify({"error": "Bulk action failed"}), 500


# ============================================================
# SEND MESSAGE TO STUDENT
# ============================================================
@admin_student_bp.route("/<int:student_id>/send-message", methods=["POST"])
@admin_required
def send_message_to_student(student_id):
    """Send an email/notification message to a student from admin."""
    try:
        student = User.query.get_or_404(student_id)
        data = request.get_json()

        subject = data.get("subject", "").strip()
        message = data.get("message", "").strip()

        if not subject:
            return jsonify({"error": "subject is required"}), 400
        if not message:
            return jsonify({"error": "message is required"}), 400
        if len(subject) > 200:
            return jsonify({"error": "Subject is too long (max 200 chars)"}), 400
        if len(message) > 5000:
            return jsonify({"error": "Message is too long (max 5000 chars)"}), 400

        current_user_id = get_jwt_identity()
        sender = User.query.get(current_user_id)
        sender_name = sender.full_name if sender else "Admin"

        # Build HTML email
        html_content = f"""
        <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h2 style="margin:0;">Message from Afritec Bridge LMS</h2>
            </div>
            <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                <p>Dear <strong>{student.first_name or student.username}</strong>,</p>
                <div style="background: white; padding: 16px; border-left: 4px solid #2563eb; border-radius: 4px; margin: 16px 0;">
                    <p style="margin:0; white-space: pre-wrap;">{message}</p>
                </div>
                <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">
                    Sent by {sender_name} · Afritec Bridge LMS
                </p>
            </div>
        </html>
        """

        try:
            from ..utils.email_utils import send_email
            email_sent = send_email(
                to=student.email,
                subject=f"[Afritec Bridge] {subject}",
                template=html_content,
                body=message
            )
        except Exception:
            email_sent = False

        # Create in-app notification regardless of email success
        try:
            from ..models.notification_models import Notification
            notif = Notification(
                user_id=student_id,
                title=subject,
                message=message,
                notification_type="admin_message",
                is_read=False,
            )
            db.session.add(notif)
            db.session.commit()
            notification_sent = True
        except Exception as ne:
            logger.warning(f"Could not create notification: {ne}")
            notification_sent = False

        logger.info(f"Admin {sender_name} sent message to student {student.username}")
        return jsonify({
            "message": "Message sent successfully",
            "email_sent": email_sent,
            "notification_sent": notification_sent,
            "recipient": student.email,
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error sending message to student {student_id}: {str(e)}")
        return jsonify({"error": "Failed to send message"}), 500


# ============================================================
# EXPORT STUDENTS CSV
# ============================================================
@admin_student_bp.route("/export", methods=["GET"])
@admin_required
def export_students():
    """Export students list as CSV with enriched data."""
    import csv
    import io
    from flask import Response

    try:
        student_role = Role.query.filter_by(name="student").first()
        if not student_role:
            return jsonify({"error": "Student role not found"}), 500

        search = request.args.get("search", "").strip()
        status_filter = request.args.get("status")
        course_filter = request.args.get("course_id", type=int)
        student_ids_param = request.args.get("student_ids")

        query = User.query.filter(User.role_id == student_role.id)

        if student_ids_param:
            ids = [int(x) for x in student_ids_param.split(",") if x.strip().isdigit()]
            if ids:
                query = query.filter(User.id.in_(ids))

        if search:
            pattern = f"%{search}%"
            query = query.filter(
                or_(User.username.ilike(pattern), User.email.ilike(pattern),
                    User.first_name.ilike(pattern), User.last_name.ilike(pattern))
            )
        if status_filter == "active":
            query = query.filter(User.is_active == True)
        elif status_filter == "inactive":
            query = query.filter(User.is_active == False)
        if course_filter:
            query = query.filter(
                User.id.in_(db.session.query(Enrollment.student_id).filter(
                    Enrollment.course_id == course_filter
                ))
            )

        students = query.order_by(User.created_at.desc()).limit(5000).all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "ID", "Username", "First Name", "Last Name", "Email",
            "Status", "Registered", "Last Login", "Last Activity",
            "Total Enrollments", "Active Enrollments", "Completed Enrollments",
            "Avg Progress %", "Avg Score", "Lessons Completed", "Certificates"
        ])

        for student in students:
            enrollments = Enrollment.query.filter_by(student_id=student.id).all()
            total_enroll = len(enrollments)
            active_enroll = sum(1 for e in enrollments if e.status == "active")
            completed_enroll = sum(1 for e in enrollments if e.status == "completed")
            avg_progress = round(
                sum(e.progress or 0 for e in enrollments) / total_enroll * 100, 1
            ) if total_enroll > 0 else 0
            lessons = LessonCompletion.query.filter_by(student_id=student.id, completed=True).count()
            certs = Certificate.query.filter_by(student_id=student.id).count()
            mps = ModuleProgress.query.filter_by(student_id=student.id).all()
            scores = [mp.cumulative_score or 0 for mp in mps if mp.cumulative_score is not None]
            avg_score = round(sum(scores) / len(scores), 1) if scores else 0

            writer.writerow([
                student.id, student.username,
                student.first_name or "", student.last_name or "",
                student.email,
                "Active" if student.is_active else "Inactive",
                student.created_at.strftime("%Y-%m-%d") if student.created_at else "",
                student.last_login.strftime("%Y-%m-%d %H:%M") if student.last_login else "Never",
                student.last_activity.strftime("%Y-%m-%d %H:%M") if student.last_activity else "Never",
                total_enroll, active_enroll, completed_enroll,
                avg_progress, avg_score, lessons, certs
            ])

        output.seek(0)
        filename = f"students_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        logger.error(f"Error exporting students: {str(e)}")
        return jsonify({"error": "Failed to export students"}), 500


# ============================================================
# SEND BULK MESSAGE TO STUDENTS
# ============================================================
@admin_student_bp.route("/bulk-message", methods=["POST"])
@admin_required
def bulk_message_students():
    """Send a message to multiple students at once."""
    try:
        data = request.get_json()
        student_ids = data.get("student_ids", [])
        subject = data.get("subject", "").strip()
        message = data.get("message", "").strip()

        if not student_ids:
            return jsonify({"error": "No student IDs provided"}), 400
        if not subject or not message:
            return jsonify({"error": "subject and message are required"}), 400
        if len(student_ids) > 100:
            return jsonify({"error": "Cannot message more than 100 students at once"}), 400

        current_user_id = get_jwt_identity()
        sender = User.query.get(current_user_id)
        sender_name = sender.full_name if sender else "Admin"

        sent = 0
        errors = []

        for sid in student_ids:
            student = User.query.get(sid)
            if not student:
                errors.append(f"Student {sid} not found")
                continue

            try:
                from ..models.notification_models import Notification
                notif = Notification(
                    user_id=sid,
                    title=subject,
                    message=message,
                    notification_type="admin_message",
                    is_read=False,
                )
                db.session.add(notif)
                sent += 1
            except Exception as ne:
                errors.append(f"Failed to notify student {sid}: {str(ne)}")

        db.session.commit()
        return jsonify({
            "message": f"Message sent to {sent} students",
            "sent": sent,
            "total_requested": len(student_ids),
            "errors": errors if errors else None,
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in bulk message: {str(e)}")
        return jsonify({"error": "Bulk message failed"}), 500


# ============================================================
# AVAILABLE COURSES FOR ENROLLMENT
# ============================================================
@admin_student_bp.route("/available-courses", methods=["GET"])
@admin_required
def get_available_courses():
    """Get list of courses available for enrollment."""
    try:
        courses = Course.query.filter_by(is_published=True).order_by(Course.title).all()
        return jsonify({
            "courses": [{
                "id": c.id,
                "title": c.title,
                "instructor": c.instructor.full_name if c.instructor else "Unknown",
                "enrollment_type": c.enrollment_type,
                "enrollments_count": Enrollment.query.filter_by(course_id=c.id, status="active").count(),
            } for c in courses]
        }), 200
    except Exception as e:
        logger.error(f"Error getting available courses: {str(e)}")
        return jsonify({"error": "Failed to get courses"}), 500
