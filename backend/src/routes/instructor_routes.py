# Instructor API Routes for Afritec Bridge LMS

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, and_

# Assuming db and models are correctly set up and accessible.
from ..models.user_models import db, User, Role
from ..models.course_models import Course, Module, Lesson, Enrollment, Quiz, Question, Answer, Submission, Announcement

# Helper for role checking (decorator)
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

instructor_bp = Blueprint("instructor_bp", __name__, url_prefix="/api/v1/instructor")

# --- Dashboard Routes ---
@instructor_bp.route("/dashboard", methods=["GET"])
@instructor_required
def get_instructor_dashboard():
    """Get instructor dashboard data including courses, students, pending items, etc."""
    current_user_id = int(get_jwt_identity())  # Ensure integer comparison
    user = User.query.get(current_user_id)
    
    try:
        # Get instructor's courses
        courses = Course.query.filter_by(instructor_id=current_user_id).all()
        
        # Get total students across all courses
        total_students = db.session.query(func.count(Enrollment.id.distinct())).filter(
            Enrollment.course_id.in_([c.id for c in courses])
        ).scalar() or 0
        
        # Get pending submissions for grading
        pending_submissions = db.session.query(func.count(Submission.id)).filter(
            and_(
                Submission.quiz_id.in_(
                    db.session.query(Quiz.id).filter(
                        Quiz.module_id.in_(
                            db.session.query(Module.id).filter(
                                Module.course_id.in_([c.id for c in courses])
                            )
                        )
                    )
                ),
                Submission.grade.is_(None)
            )
        ).scalar() or 0
        
        # Get recent enrollments
        recent_enrollments = db.session.query(Enrollment).filter(
            Enrollment.course_id.in_([c.id for c in courses])
        ).order_by(Enrollment.enrollment_date.desc()).limit(10).all()
        
        # Get recent announcements
        recent_announcements = db.session.query(Announcement).filter(
            Announcement.course_id.in_([c.id for c in courses])
        ).order_by(Announcement.created_at.desc()).limit(5).all()
        
        dashboard_data = {
            "taughtCourses": [course.to_dict() for course in courses],
            "totalStudents": total_students,
            "pendingGradingItems": pending_submissions,
            "recentEnrollments": [enrollment.to_dict() for enrollment in recent_enrollments],
            "recentAnnouncements": [
                {
                    "id": ann.id,
                    "title": ann.title,
                    "course_title": ann.course.title if ann.course else "Unknown",
                    "created_at": ann.created_at.isoformat()
                } for ann in recent_announcements
            ]
        }
        
        return jsonify(dashboard_data), 200
        
    except Exception as e:
        return jsonify({"message": "Failed to fetch dashboard data", "error": str(e)}), 500

# --- Course Management Routes ---
@instructor_bp.route("/courses", methods=["GET"])
@instructor_required
def get_instructor_courses():
    """Get all courses taught by the current instructor."""
    current_user_id = int(get_jwt_identity())  # Ensure integer comparison
    
    try:
        courses = Course.query.filter_by(instructor_id=current_user_id).all()
        return jsonify([course.to_dict() for course in courses]), 200
    except Exception as e:
        return jsonify({"message": "Failed to fetch courses", "error": str(e)}), 500

@instructor_bp.route("/courses/<int:course_id>/analytics", methods=["GET"])
@instructor_required
def get_course_analytics(course_id):
    """Get analytics data for a specific course."""
    current_user_id = get_jwt_identity()
    
    # Verify instructor owns this course
    course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
    if not course:
        return jsonify({"message": "Course not found or access denied"}), 404
    
    try:
        # Get enrollment stats
        total_enrolled = db.session.query(func.count(Enrollment.id)).filter_by(course_id=course_id).scalar() or 0
        
        # Get active students (those who accessed in last 30 days)
        # This would require adding last_accessed field to enrollments or user activity tracking
        active_students = total_enrolled  # Placeholder
        
        # Get completion stats
        completed_enrollments = db.session.query(func.count(Enrollment.id)).filter(
            and_(Enrollment.course_id == course_id, Enrollment.completed_at.isnot(None))
        ).scalar() or 0
        
        completion_rate = (completed_enrollments / total_enrolled * 100) if total_enrolled > 0 else 0
        
        # Get quiz submission stats
        course_quizzes = db.session.query(Quiz.id).join(Module).filter(Module.course_id == course_id).all()
        quiz_ids = [q.id for q in course_quizzes]
        
        total_quiz_submissions = db.session.query(func.count(Submission.id)).filter(
            Submission.quiz_id.in_(quiz_ids)
        ).scalar() or 0
        
        pending_submissions = db.session.query(func.count(Submission.id)).filter(
            and_(Submission.quiz_id.in_(quiz_ids), Submission.grade.is_(None))
        ).scalar() or 0
        
        analytics = {
            "course_id": course_id,
            "total_enrolled": total_enrolled,
            "active_students": active_students,
            "completion_rate": round(completion_rate, 2),
            "average_progress": 50.0,  # Placeholder - would need progress tracking
            "total_quiz_submissions": total_quiz_submissions,
            "pending_submissions": pending_submissions
        }
        
        return jsonify(analytics), 200
        
    except Exception as e:
        return jsonify({"message": "Failed to fetch analytics", "error": str(e)}), 500

# --- Student Management Routes ---
@instructor_bp.route("/students", methods=["GET"])
@instructor_required
def get_instructor_students():
    """Get all students enrolled in instructor's courses."""
    current_user_id = get_jwt_identity()
    course_id = request.args.get('course_id', type=int)
    
    try:
        # Get instructor's courses
        course_query = Course.query.filter_by(instructor_id=current_user_id)
        if course_id:
            course_query = course_query.filter_by(id=course_id)
        
        courses = course_query.all()
        course_ids = [c.id for c in courses]
        
        # Get enrollments for these courses
        enrollments = db.session.query(Enrollment).filter(
            Enrollment.course_id.in_(course_ids)
        ).join(User).all()
        
        students_data = []
        for enrollment in enrollments:
            user = enrollment.user
            course = enrollment.course
            
            student_data = user.to_dict()
            student_data.update({
                "course_title": course.title,
                "enrollment_date": enrollment.enrollment_date.isoformat(),
                "progress": 0,  # Placeholder - would need progress tracking
                "last_accessed": None  # Placeholder - would need activity tracking
            })
            students_data.append(student_data)
        
        return jsonify(students_data), 200
        
    except Exception as e:
        return jsonify({"message": "Failed to fetch students", "error": str(e)}), 500

@instructor_bp.route("/courses/<int:course_id>/enrollments", methods=["GET"])
@instructor_required
def get_course_enrollments(course_id):
    """Get enrollments for a specific course."""
    current_user_id = get_jwt_identity()
    
    # Verify instructor owns this course
    course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
    if not course:
        return jsonify({"message": "Course not found or access denied"}), 404
    
    try:
        enrollments = Enrollment.query.filter_by(course_id=course_id).all()
        return jsonify([enrollment.to_dict() for enrollment in enrollments]), 200
    except Exception as e:
        return jsonify({"message": "Failed to fetch enrollments", "error": str(e)}), 500

# --- Submission and Grading Routes ---
@instructor_bp.route("/submissions/pending", methods=["GET"])
@instructor_required
def get_pending_submissions():
    """Get pending submissions for grading."""
    current_user_id = get_jwt_identity()
    course_id = request.args.get('course_id', type=int)
    
    try:
        # Get instructor's courses
        course_query = Course.query.filter_by(instructor_id=current_user_id)
        if course_id:
            course_query = course_query.filter_by(id=course_id)
        
        courses = course_query.all()
        course_ids = [c.id for c in courses]
        
        # Get quiz IDs for these courses
        quiz_ids = db.session.query(Quiz.id).join(Module).filter(
            Module.course_id.in_(course_ids)
        ).all()
        quiz_ids = [q.id for q in quiz_ids]
        
        # Get pending submissions
        pending_submissions = db.session.query(Submission).filter(
            and_(
                Submission.quiz_id.in_(quiz_ids),
                Submission.grade.is_(None)
            )
        ).all()
        
        submissions_data = []
        for submission in pending_submissions:
            submission_data = submission.to_dict()
            if submission.quiz and submission.quiz.module and submission.quiz.module.course:
                submission_data["course_title"] = submission.quiz.module.course.title
                submission_data["quiz_title"] = submission.quiz.title
            submissions_data.append(submission_data)
        
        return jsonify(submissions_data), 200
        
    except Exception as e:
        return jsonify({"message": "Failed to fetch pending submissions", "error": str(e)}), 500