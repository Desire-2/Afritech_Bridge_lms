# Enhanced Student API Routes for Afritec Bridge LMS

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import json

from ..models.user_models import db, User, Role
from ..models.course_models import Course, Module, Lesson, Enrollment, Quiz, Submission, Assignment, AssignmentSubmission
from ..models.student_models import (
    LessonCompletion, UserProgress, StudentNote, Badge, UserBadge,
    StudentBookmark, StudentForum, ForumPost
)

# Helper for role checking
from functools import wraps

def role_required(roles):
    def decorator(f):
        @wraps(f)
        @jwt_required()
        def decorated_function(*args, **kwargs):
            current_user_id = int(get_jwt_identity())  # Convert string back to int
            user = User.query.get(current_user_id)
            if not user or not user.role or user.role.name not in roles:
                return jsonify({"message": "User does not have the required role(s)"}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def student_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = int(get_jwt_identity())  # Convert string back to int
        user = User.query.get(current_user_id)
        if not user or not user.role or user.role.name != 'student':
            return jsonify({"message": "Student access required"}), 403
        return f(*args, **kwargs)
    return decorated_function

student_bp = Blueprint("student_bp", __name__, url_prefix="/api/v1/student")

# --- Student Dashboard Routes ---
@student_bp.route("/dashboard/", methods=["GET"])
@student_required
def get_dashboard():
    """Get comprehensive student dashboard data"""
    try:
        current_user_id = int(get_jwt_identity())
        print(f"DEBUG: Dashboard request for user {current_user_id}")
        
        # Test basic database connectivity
        user = User.query.get(current_user_id)
        if not user:
            print(f"DEBUG: User {current_user_id} not found")
            return jsonify({"error": "User not found"}), 404
        
        print(f"DEBUG: User found: {user.email}")
        
        # Get enrolled courses with progress - simplified approach
        print("DEBUG: Querying enrollments...")
        enrollments = Enrollment.query.filter_by(student_id=current_user_id).all()
        print(f"DEBUG: Found {len(enrollments)} enrollments")
        
        enrolled_courses = []
        for enrollment in enrollments:
            try:
                course_data = enrollment.course.to_dict()
                course_data['progress'] = enrollment.progress * 100
                course_data['enrollment_date'] = enrollment.enrollment_date.isoformat()
                enrolled_courses.append(course_data)
                print(f"DEBUG: Added course: {course_data.get('title', 'No title')}")
            except Exception as e:
                print(f"DEBUG: Error processing enrollment: {e}")
                continue
        
        # Calculate statistics
        total_courses = len(enrolled_courses)
        completed_courses = len([c for c in enrolled_courses if c['progress'] >= 100])
        
        # Get total study time (simplified)
        print("DEBUG: Querying user progress...")
        total_time = 0  # Simplified for now
        
        # Get achievements/badges (simplified)
        print("DEBUG: Querying badges...")
        user_badges = []  # Simplified for now
        achievements = []
        
        # Get recent activity (simplified)
        print("DEBUG: Querying recent activity...")
        recent_activity = []  # Simplified for now
        
        result = {
            'enrolled_courses': enrolled_courses,
            'stats': {
                'total_courses': total_courses,
                'completed_courses': completed_courses,
                'hours_spent': total_time // 3600 if total_time > 0 else 0,
                'achievements': len(achievements)
            },
            'achievements': achievements,
            'recent_activity': recent_activity
        }
        
        print(f"DEBUG: Returning result: {json.dumps(result, indent=2, default=str)}")
        return jsonify(result), 200
    
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"DEBUG: Exception in dashboard: {e}")
        print(f"DEBUG: Traceback: {error_details}")
        return jsonify({
            "error": "Failed to load dashboard data", 
            "details": str(e),
            "traceback": error_details.split('\n')
        }), 500

# --- My Learning Routes ---
@student_bp.route("/learning", methods=["GET"])
@student_required
def get_my_learning():
    """Get all enrolled courses with detailed progress"""
    current_user_id = int(get_jwt_identity())  # Convert string back to int
    
    enrollments = Enrollment.query.filter_by(student_id=current_user_id).all()
    courses = []
    
    for enrollment in enrollments:
        course = enrollment.course
        course_data = course.to_dict(include_modules=True)
        course_data['enrollment_id'] = enrollment.id
        course_data['progress'] = enrollment.progress * 100
        course_data['enrollment_date'] = enrollment.enrollment_date.isoformat()
        course_data['completed_at'] = enrollment.completed_at.isoformat() if enrollment.completed_at else None
        
        # Add module progress
        for module in course_data['modules']:
            module_lessons = Lesson.query.filter_by(module_id=module['id']).all()
            completed_lessons = LessonCompletion.query.filter_by(
                student_id=current_user_id
            ).join(Lesson).filter(Lesson.module_id == module['id']).count()
            
            module['total_lessons'] = len(module_lessons)
            module['completed_lessons'] = completed_lessons
            module['progress'] = (completed_lessons / len(module_lessons) * 100) if module_lessons else 0
        
        courses.append(course_data)
    
    return jsonify(courses), 200

@student_bp.route("/learning/<int:course_id>/progress", methods=["GET"])
@student_required
def get_course_progress(course_id):
    """Get detailed progress for a specific course"""
    current_user_id = int(get_jwt_identity())  # Convert string back to int
    
    # Check enrollment
    enrollment = Enrollment.query.filter_by(
        student_id=current_user_id, 
        course_id=course_id
    ).first()
    
    if not enrollment:
        return jsonify({"message": "Not enrolled in this course"}), 404
    
    course = Course.query.get_or_404(course_id)
    user_progress = UserProgress.query.filter_by(
        user_id=current_user_id, 
        course_id=course_id
    ).first()
    
    # Get completed lessons
    completed_lessons = LessonCompletion.query.filter_by(
        student_id=current_user_id
    ).join(Lesson).join(Module).filter(Module.course_id == course_id).all()
    
    completed_lesson_ids = [cl.lesson_id for cl in completed_lessons]
    
    # Build progress data
    modules_progress = []
    for module in course.modules.order_by(Module.order):
        lessons_progress = []
        for lesson in module.lessons.order_by(Lesson.order):
            lesson_data = lesson.to_dict()
            lesson_data['completed'] = lesson.id in completed_lesson_ids
            lesson_data['completion_date'] = None
            
            # Find completion date
            for cl in completed_lessons:
                if cl.lesson_id == lesson.id:
                    lesson_data['completion_date'] = cl.completed_at.isoformat()
                    lesson_data['time_spent'] = cl.time_spent
                    break
            
            lessons_progress.append(lesson_data)
        
        module_data = module.to_dict()
        module_data['lessons'] = lessons_progress
        module_data['completed_lessons'] = sum(1 for l in lessons_progress if l['completed'])
        module_data['total_lessons'] = len(lessons_progress)
        module_data['progress'] = (module_data['completed_lessons'] / module_data['total_lessons'] * 100) if module_data['total_lessons'] > 0 else 0
        
        modules_progress.append(module_data)
    
    return jsonify({
        'course': course.to_dict(),
        'overall_progress': enrollment.progress * 100,
        'total_time_spent': user_progress.total_time_spent if user_progress else 0,
        'last_accessed': user_progress.last_accessed.isoformat() if user_progress else None,
        'current_lesson_id': user_progress.current_lesson_id if user_progress else None,
        'modules': modules_progress
    }), 200

# --- Lesson Completion Routes ---
@student_bp.route("/lessons/<int:lesson_id>/complete", methods=["POST"])
@student_required
def complete_lesson(lesson_id):
    """Mark a lesson as completed"""
    current_user_id = int(get_jwt_identity())  # Convert string back to int
    data = request.get_json() or {}
    
    lesson = Lesson.query.get_or_404(lesson_id)
    
    # Check if student is enrolled in the course
    enrollment = Enrollment.query.filter_by(
        student_id=current_user_id,
        course_id=lesson.module.course_id
    ).first()
    
    if not enrollment:
        return jsonify({"message": "Not enrolled in this course"}), 403
    
    # Check if already completed
    existing_completion = LessonCompletion.query.filter_by(
        student_id=current_user_id,
        lesson_id=lesson_id
    ).first()
    
    if existing_completion:
        return jsonify({"message": "Lesson already completed"}), 400
    
    try:
        # Create completion record
        completion = LessonCompletion(
            student_id=current_user_id,
            lesson_id=lesson_id,
            time_spent=data.get('time_spent', 0)
        )
        db.session.add(completion)
        
        # Update user progress
        user_progress = UserProgress.query.filter_by(
            user_id=current_user_id,
            course_id=lesson.module.course_id
        ).first()
        
        if not user_progress:
            user_progress = UserProgress(
                user_id=current_user_id,
                course_id=lesson.module.course_id,
                total_time_spent=data.get('time_spent', 0)
            )
            db.session.add(user_progress)
        else:
            user_progress.total_time_spent += data.get('time_spent', 0)
            user_progress.last_accessed = datetime.utcnow()
        
        # Calculate overall course progress
        total_lessons = db.session.query(Lesson).join(Module).filter(
            Module.course_id == lesson.module.course_id
        ).count()
        
        completed_lessons = db.session.query(LessonCompletion).join(Lesson).join(Module).filter(
            Module.course_id == lesson.module.course_id,
            LessonCompletion.student_id == current_user_id
        ).count() + 1  # +1 for the current completion
        
        progress_percentage = completed_lessons / total_lessons if total_lessons > 0 else 0
        
        # Update enrollment progress
        enrollment.progress = progress_percentage
        if progress_percentage >= 1.0:
            enrollment.completed_at = datetime.utcnow()
        
        user_progress.completion_percentage = progress_percentage * 100
        
        db.session.commit()
        
        return jsonify({
            "message": "Lesson completed successfully",
            "progress": progress_percentage * 100,
            "completed_lessons": completed_lessons,
            "total_lessons": total_lessons
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error completing lesson", "error": str(e)}), 500

# --- Student Notes Routes ---
@student_bp.route("/notes", methods=["GET"])
@student_required
def get_student_notes():
    """Get all notes by the student"""
    current_user_id = int(get_jwt_identity())  # Convert string back to int
    lesson_id = request.args.get('lesson_id', type=int)
    
    query = StudentNote.query.filter_by(student_id=current_user_id)
    
    if lesson_id:
        query = query.filter_by(lesson_id=lesson_id)
    
    notes = query.order_by(StudentNote.updated_at.desc()).all()
    return jsonify([note.to_dict() for note in notes]), 200

@student_bp.route("/notes", methods=["POST"])
@student_required
def create_note():
    """Create a new note"""
    current_user_id = int(get_jwt_identity())  # Convert string back to int
    data = request.get_json()
    
    try:
        note = StudentNote(
            student_id=current_user_id,
            lesson_id=data['lesson_id'],
            content=data['content']
        )
        db.session.add(note)
        db.session.commit()
        
        return jsonify(note.to_dict()), 201
    except KeyError as e:
        return jsonify({"message": f"Missing field: {e}"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error creating note", "error": str(e)}), 500

@student_bp.route("/notes/<int:note_id>", methods=["PUT"])
@student_required
def update_note(note_id):
    """Update a note"""
    current_user_id = int(get_jwt_identity())  # Convert string back to int
    data = request.get_json()
    
    note = StudentNote.query.filter_by(
        id=note_id, 
        student_id=current_user_id
    ).first_or_404()
    
    try:
        note.content = data.get('content', note.content)
        note.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify(note.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error updating note", "error": str(e)}), 500

@student_bp.route("/notes/<int:note_id>", methods=["DELETE"])
@student_required
def delete_note(note_id):
    """Delete a note"""
    current_user_id = int(get_jwt_identity())  # Convert string back to int
    
    note = StudentNote.query.filter_by(
        id=note_id, 
        student_id=current_user_id
    ).first_or_404()
    
    try:
        db.session.delete(note)
        db.session.commit()
        return jsonify({"message": "Note deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error deleting note", "error": str(e)}), 500

# --- Bookmarks Routes ---
@student_bp.route("/bookmarks", methods=["GET"])
@student_required
def get_bookmarks():
    """Get all bookmarked courses"""
    current_user_id = int(get_jwt_identity())  # Convert string back to int
    
    bookmarks = StudentBookmark.query.filter_by(student_id=current_user_id).all()
    return jsonify([bookmark.to_dict() for bookmark in bookmarks]), 200

@student_bp.route("/bookmarks", methods=["POST"])
@student_required
def add_bookmark():
    """Add a course to bookmarks"""
    current_user_id = int(get_jwt_identity())  # Convert string back to int
    data = request.get_json()
    
    course_id = data.get('course_id')
    if not course_id:
        return jsonify({"message": "course_id is required"}), 400
    
    # Check if course exists
    course = Course.query.get_or_404(course_id)
    
    # Check if already bookmarked
    existing = StudentBookmark.query.filter_by(
        student_id=current_user_id,
        course_id=course_id
    ).first()
    
    if existing:
        return jsonify({"message": "Course already bookmarked"}), 400
    
    try:
        bookmark = StudentBookmark(
            student_id=current_user_id,
            course_id=course_id
        )
        db.session.add(bookmark)
        db.session.commit()
        
        return jsonify(bookmark.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error adding bookmark", "error": str(e)}), 500

@student_bp.route("/bookmarks/<int:course_id>", methods=["DELETE"])
@student_required
def remove_bookmark(course_id):
    """Remove a course from bookmarks"""
    current_user_id = int(get_jwt_identity())  # Convert string back to int
    
    bookmark = StudentBookmark.query.filter_by(
        student_id=current_user_id,
        course_id=course_id
    ).first_or_404()
    
    try:
        db.session.delete(bookmark)
        db.session.commit()
        return jsonify({"message": "Bookmark removed successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error removing bookmark", "error": str(e)}), 500

# --- Achievements/Badges Routes ---
@student_bp.route("/achievements", methods=["GET"])
@student_required
def get_achievements():
    """Get all achievements/badges earned by student"""
    current_user_id = int(get_jwt_identity())  # Convert string back to int
    
    user_badges = UserBadge.query.filter_by(user_id=current_user_id).all()
    achievements = [ub.to_dict() for ub in user_badges]
    
    # Also get available badges not yet earned
    earned_badge_ids = [ub.badge_id for ub in user_badges]
    available_badges = Badge.query.filter(
        Badge.is_active == True,
        ~Badge.id.in_(earned_badge_ids)
    ).all()
    
    return jsonify({
        'earned': achievements,
        'available': [badge.to_dict() for badge in available_badges]
    }), 200

# --- Assignments Routes ---
@student_bp.route("/assignments", methods=["GET"])
@student_required
def get_student_assignments():
    """Get all assignments for enrolled courses"""
    current_user_id = int(get_jwt_identity())  # Convert string back to int
    
    # Get enrolled course IDs
    enrolled_course_ids = db.session.query(Enrollment.course_id).filter_by(
        student_id=current_user_id
    ).subquery()
    
    assignments = Assignment.query.filter(
        Assignment.course_id.in_(enrolled_course_ids),
        Assignment.is_active == True
    ).order_by(Assignment.due_date.asc().nullslast()).all()
    
    assignments_data = []
    for assignment in assignments:
        assignment_data = assignment.to_dict()
        
        # Check if student has submitted
        submission = AssignmentSubmission.query.filter_by(
            assignment_id=assignment.id,
            student_id=current_user_id
        ).first()
        
        assignment_data['submitted'] = submission is not None
        if submission:
            assignment_data['submission'] = submission.to_dict()
        
        assignments_data.append(assignment_data)
    
    return jsonify(assignments_data), 200

@student_bp.route("/assignments/<int:assignment_id>/submit", methods=["POST"])
@student_required
def submit_assignment(assignment_id):
    """Submit an assignment"""
    current_user_id = int(get_jwt_identity())  # Convert string back to int
    data = request.get_json()
    
    assignment = Assignment.query.get_or_404(assignment_id)
    
    # Check if student is enrolled in the course
    enrollment = Enrollment.query.filter_by(
        student_id=current_user_id,
        course_id=assignment.course_id
    ).first()
    
    if not enrollment:
        return jsonify({"message": "Not enrolled in this course"}), 403
    
    # Check if already submitted
    existing = AssignmentSubmission.query.filter_by(
        assignment_id=assignment_id,
        student_id=current_user_id
    ).first()
    
    if existing:
        return jsonify({"message": "Assignment already submitted"}), 400
    
    try:
        submission = AssignmentSubmission(
            assignment_id=assignment_id,
            student_id=current_user_id,
            content=data.get('content'),
            file_url=data.get('file_url'),
            external_url=data.get('external_url')
        )
        db.session.add(submission)
        db.session.commit()
        
        return jsonify(submission.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error submitting assignment", "error": str(e)}), 500

# --- Student Profile/Settings Routes ---
@student_bp.route("/profile", methods=["GET"])
@student_required
def get_student_profile():
    """Get student profile with learning statistics"""
    current_user_id = int(get_jwt_identity())  # Convert string back to int
    user = User.query.get(current_user_id)
    
    # Get learning statistics
    total_enrollments = Enrollment.query.filter_by(student_id=current_user_id).count()
    completed_courses = Enrollment.query.filter_by(
        student_id=current_user_id
    ).filter(Enrollment.progress >= 1.0).count()
    
    total_time = db.session.query(db.func.sum(UserProgress.total_time_spent)).filter_by(
        user_id=current_user_id
    ).scalar() or 0
    
    badges_count = UserBadge.query.filter_by(user_id=current_user_id).count()
    
    profile_data = user.to_dict()
    profile_data['learning_stats'] = {
        'total_courses': total_enrollments,
        'completed_courses': completed_courses,
        'hours_spent': total_time // 3600,
        'badges_earned': badges_count
    }
    
    return jsonify(profile_data), 200