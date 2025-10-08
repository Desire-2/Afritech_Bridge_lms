# Enhanced Student API Routes for Afritec Bridge LMS

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import json
from sqlalchemy import or_

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
@student_bp.route("/dashboard", methods=["GET"])
@student_required
def get_student_dashboard():
    """Get comprehensive dashboard data for student"""
    current_user_id = int(get_jwt_identity())  # Convert string back to int
    
    # Get enrolled courses with progress
    enrollments = Enrollment.query.filter_by(student_id=current_user_id).all()
    enrolled_courses = []
    
    for enrollment in enrollments:
        course_data = enrollment.course.to_dict()
        course_data['progress'] = enrollment.progress * 100
        course_data['enrollment_date'] = enrollment.enrollment_date.isoformat()
        
        # Get current lesson
        user_progress = UserProgress.query.filter_by(
            user_id=current_user_id, 
            course_id=enrollment.course_id
        ).first()
        
        if user_progress and user_progress.current_lesson:
            course_data['current_lesson'] = user_progress.current_lesson.title
        else:
            # Get first incomplete lesson
            first_module = enrollment.course.modules.order_by(Module.order).first()
            if first_module:
                first_lesson = first_module.lessons.order_by(Lesson.order).first()
                if first_lesson:
                    course_data['current_lesson'] = first_lesson.title
        
        enrolled_courses.append(course_data)
    
    # Get statistics
    total_courses = len(enrolled_courses)
    completed_courses = len([c for c in enrolled_courses if c['progress'] >= 100])
    
    # Get total study time
    total_time = db.session.query(db.func.sum(UserProgress.total_time_spent)).filter_by(
        user_id=current_user_id
    ).scalar() or 0
    
    # Get achievements/badges
    user_badges = UserBadge.query.filter_by(user_id=current_user_id).all()
    achievements = [ub.to_dict() for ub in user_badges]
    
    # Get recent activity (recent lesson completions)
    recent_completions = LessonCompletion.query.filter_by(
        student_id=current_user_id
    ).order_by(LessonCompletion.completed_at.desc()).limit(5).all()
    
    recent_activity = []
    for completion in recent_completions:
        recent_activity.append({
            'type': 'lesson_completion',
            'lesson_title': completion.lesson.title,
            'course_title': completion.lesson.module.course.title,
            'completed_at': completion.completed_at.isoformat()
        })
    
    return jsonify({
        'enrolled_courses': enrolled_courses,
        'stats': {
            'total_courses': total_courses,
            'completed_courses': completed_courses,
            'hours_spent': total_time // 3600,  # Convert seconds to hours
            'achievements': len(achievements)
        },
        'achievements': achievements,
        'recent_activity': recent_activity
    }), 200

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

# --- Enhanced Progress and Analytics Routes ---
@student_bp.route("/progress/detailed", methods=["GET"])
@student_required
def get_detailed_progress():
    """Get comprehensive progress analytics including skills, trends, and weak areas"""
    current_user_id = int(get_jwt_identity())
    
    try:
        # Overall statistics
        enrollments = Enrollment.query.filter_by(student_id=current_user_id).all()
        completed_courses = [e for e in enrollments if e.progress >= 1.0]
        in_progress_courses = [e for e in enrollments if 0 < e.progress < 1.0]
        
        total_time = db.session.query(db.func.sum(UserProgress.total_time_spent)).filter_by(
            user_id=current_user_id
        ).scalar() or 0
        
        # Calculate average score across all courses
        avg_score = db.session.query(db.func.avg(Enrollment.grade)).filter_by(
            student_id=current_user_id
        ).filter(Enrollment.grade.isnot(None)).scalar() or 0
        
        # Get recent activities for streak calculation (mock for now)
        learning_streak = 7  # This would be calculated from actual activity logs
        
        # Skills progress (derived from course categories and progress)
        skills_data = []
        course_categories = {}
        for enrollment in enrollments:
            course = enrollment.course
            category = course.category or "General"
            if category not in course_categories:
                course_categories[category] = {
                    'courses': [],
                    'total_progress': 0,
                    'badges': 0
                }
            course_categories[category]['courses'].append(course.title)
            course_categories[category]['total_progress'] += enrollment.progress or 0
        
        skill_id = 1
        for category, data in course_categories.items():
            avg_progress = data['total_progress'] / len(data['courses']) if data['courses'] else 0
            current_level = min(int(avg_progress * 5), 5)  # Convert to 1-5 scale
            
            skills_data.append({
                'id': skill_id,
                'name': category,
                'category': 'Technical Skills',
                'currentLevel': current_level,
                'maxLevel': 5,
                'pointsEarned': int(avg_progress * 1000),
                'pointsRequired': 1000,
                'courses': data['courses'][:2],  # Show first 2 courses
                'badgesEarned': data['badges'],
                'lastActivity': datetime.now().isoformat()
            })
            skill_id += 1
        
        # Performance trends (mock data for last 7 days)
        performance_trends = []
        for i in range(7):
            date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            date = date.replace(day=date.day - i)
            performance_trends.insert(0, {
                'date': date.isoformat(),
                'score': min(85 + (i * 2), 95),  # Mock increasing trend
                'hoursStudied': 6 + (i % 3),
                'lessonsCompleted': 3 + (i % 2)
            })
        
        # Weak areas (courses with low scores)
        weak_areas = []
        for enrollment in enrollments:
            if enrollment.grade and enrollment.grade < 80:
                weak_areas.append({
                    'topic': enrollment.course.title,
                    'score': int(enrollment.grade),
                    'attempts': 1,  # This would come from actual attempt tracking
                    'recommendedResources': [
                        f"Review {enrollment.course.title} materials",
                        "Practice exercises for this topic"
                    ]
                })
        
        # Recent achievements (mock data)
        achievements = [
            {
                'id': 1,
                'title': 'Course Starter',
                'description': 'Enrolled in your first course',
                'icon': '🎯',
                'dateEarned': datetime.now().isoformat(),
                'rarity': 'common'
            },
            {
                'id': 2,
                'title': 'Dedicated Learner',
                'description': 'Studied for 7 consecutive days',
                'icon': '🔥',
                'dateEarned': datetime.now().isoformat(),
                'rarity': 'rare'
            }
        ]
        
        response_data = {
            'overallStats': {
                'totalHours': int(total_time // 3600),
                'coursesCompleted': len(completed_courses),
                'coursesInProgress': len(in_progress_courses),
                'averageScore': int(avg_score),
                'streak': learning_streak,
                'rank': 45,  # Mock rank
                'totalStudents': 1250  # Mock total students
            },
            'skills': skills_data,
            'performanceTrends': performance_trends,
            'weakAreas': weak_areas[:3],  # Limit to 3 weak areas
            'achievements': achievements,
            'weeklyGoals': {
                'hoursTarget': 15,
                'hoursCompleted': 12,
                'lessonsTarget': 10,
                'lessonsCompleted': 8
            }
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        return jsonify({"message": "Error fetching detailed progress", "error": str(e)}), 500

@student_bp.route("/courses/browse", methods=["GET"])
@student_required  
def browse_courses():
    """Get all available courses with enrollment status and pricing info"""
    current_user_id = int(get_jwt_identity())
    
    try:
        print(f"[DEBUG] Browse courses called by user: {current_user_id}")
        
        # Get query parameters for filtering
        category = request.args.get('category', 'all')
        level = request.args.get('level', 'all')
        price_filter = request.args.get('price', 'all')
        search = request.args.get('search', '')
        
        print(f"[DEBUG] Filters: category={category}, level={level}, price={price_filter}, search={search}")
        
        # Base query - only published courses
        query = Course.query.filter(Course.is_published == True)
        
        # Apply search filter if provided
        if search:
            query = query.filter(
                or_(
                    Course.title.ilike(f'%{search}%'),
                    Course.description.ilike(f'%{search}%')
                )
            )
        
        courses = query.all()
        print(f"[DEBUG] Found {len(courses)} courses")
        
        # Get student's enrollments
        enrollments = {e.course_id: e for e in Enrollment.query.filter_by(student_id=current_user_id).all()}
        print(f"[DEBUG] User has {len(enrollments)} enrollments")
        
        courses_data = []
        for course in courses:
            print(f"[DEBUG] Processing course {course.id}: {course.title}")
            
            instructor = User.query.get(course.instructor_id)
            enrollment = enrollments.get(course.id)
            
            # Mock pricing and scholarship info (would come from course model in real implementation)
            is_free = course.id % 3 == 0  # Mock: every 3rd course is free
            is_scholarship = course.id % 4 == 0  # Mock: every 4th course requires scholarship
            price = 0 if is_free else (199 + (course.id * 50))
            
            # Derive category from target_audience or use default
            category = course.target_audience if course.target_audience else 'General'
            
            # Determine level based on course ID for now (mock)
            level_options = ['Beginner', 'Intermediate', 'Advanced']
            course_level = level_options[course.id % 3]
            
            # Apply level filtering
            if level and level.lower() != 'all' and course_level != level:
                print(f"[DEBUG] Skipping course {course.id} due to level filter")
                continue
            
            # Apply category filtering  
            if category and category.lower() != 'all' and category.lower() != category.lower():
                # For now, skip category filtering since we don't have proper categories
                pass
            
            course_data = {
                'id': course.id,
                'title': course.title,
                'description': course.description,
                'instructor': instructor.first_name + " " + instructor.last_name if instructor else "Unknown",
                'instructorAvatar': None,  # TODO: Add when user profile images are implemented
                'duration': course.estimated_duration or '8 weeks',
                'studentsCount': len(list(course.enrollments)) if course.enrollments else 0,
                'rating': 4.5 + (course.id % 10) * 0.05,  # Mock rating
                'reviewsCount': 200 + (course.id * 20),  # Mock reviews
                'price': price,
                'originalPrice': price + 100 if not is_free else None,
                'isScholarshipRequired': is_scholarship and not is_free,
                'isFree': is_free,
                'tags': ['Programming', 'Backend', 'Python'],  # Mock tags
                'level': course_level,
                'category': category,
                'thumbnail': None,  # TODO: Add when course images are implemented
                'isEnrolled': enrollment is not None,
                'prerequisites': ['Basic programming knowledge'] if course.id % 2 == 0 else [],
                'learningOutcomes': course.learning_objectives.split('\n') if course.learning_objectives else [
                    f'Master {course.title} concepts',
                    'Build real-world projects',
                    'Gain practical experience'
                ],
                'modules': course.modules.count() if course.modules else 0,
                'certificateAvailable': True,
            }
            
            print(f"[DEBUG] Course {course.id} data prepared")
            
            # Apply price filtering
            if price_filter == 'free' and not is_free:
                print(f"[DEBUG] Skipping course {course.id} due to price filter (free)")
                continue
            elif price_filter == 'paid' and (is_free or is_scholarship):
                print(f"[DEBUG] Skipping course {course.id} due to price filter (paid)")
                continue
            elif price_filter == 'scholarship' and not is_scholarship:
                print(f"[DEBUG] Skipping course {course.id} due to price filter (scholarship)")
                continue
                
            courses_data.append(course_data)
        
        print(f"[DEBUG] Returning {len(courses_data)} courses")
        return jsonify(courses_data), 200
        
    except Exception as e:
        print(f"[ERROR] Exception in browse_courses: {str(e)}")
        print(f"[ERROR] Exception type: {type(e)}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        return jsonify({"message": "Error browsing courses", "error": str(e)}), 500

@student_bp.route("/courses/<int:course_id>/enroll", methods=["POST"])
@student_required
def enroll_in_course(course_id):
    """Enroll student in a course"""
    current_user_id = int(get_jwt_identity())
    
    try:
        course = Course.query.get_or_404(course_id)
        
        # Check if already enrolled
        existing_enrollment = Enrollment.query.filter_by(
            student_id=current_user_id,
            course_id=course_id
        ).first()
        
        if existing_enrollment:
            return jsonify({"message": "Already enrolled in this course"}), 400
        
        # Create enrollment
        enrollment = Enrollment(
            student_id=current_user_id,
            course_id=course_id,
            enrollment_date=datetime.utcnow(),
            progress=0.0
        )
        
        db.session.add(enrollment)
        db.session.commit()
        
        return jsonify({
            "message": "Successfully enrolled in course",
            "enrollment": enrollment.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error enrolling in course", "error": str(e)}), 500

@student_bp.route("/modules/<int:module_id>/complete", methods=["POST"])
@student_required
def complete_module(module_id):
    """Mark a module as completed and update progress"""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    try:
        module = Module.query.get_or_404(module_id)
        
        # Check enrollment
        enrollment = Enrollment.query.filter_by(
            student_id=current_user_id,
            course_id=module.course_id
        ).first()
        
        if not enrollment:
            return jsonify({"message": "Not enrolled in this course"}), 403
        
        # Get or create progress record
        progress = UserProgress.query.filter_by(
            user_id=current_user_id,
            course_id=module.course_id
        ).first()
        
        if not progress:
            progress = UserProgress(
                user_id=current_user_id,
                course_id=module.course_id,
                modules_completed=0,
                lessons_completed=0,
                total_time_spent=0,
                last_accessed=datetime.utcnow()
            )
            db.session.add(progress)
        
        # Update module completion
        score = data.get('score', 0)
        if score >= 80:  # Required passing score
            progress.modules_completed += 1
            progress.last_accessed = datetime.utcnow()
            
            # Update enrollment progress
            total_modules = len(module.course.modules) if module.course.modules else 1
            enrollment.progress = min(progress.modules_completed / total_modules, 1.0)
            
            if score > (enrollment.grade or 0):
                enrollment.grade = score
        
        db.session.commit()
        
        return jsonify({
            "message": "Module progress updated",
            "progress": progress.to_dict() if hasattr(progress, 'to_dict') else {
                'modules_completed': progress.modules_completed,
                'lessons_completed': progress.lessons_completed,
                'total_time_spent': progress.total_time_spent
            },
            "enrollment_progress": enrollment.progress,
            "passed": score >= 80
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error updating module progress", "error": str(e)}), 500

@student_bp.route("/certificates", methods=["GET"])
@student_required
def get_certificates():
    """Get all certificates earned by the student"""
    current_user_id = int(get_jwt_identity())
    
    try:
        # Get completed courses
        completed_enrollments = Enrollment.query.filter_by(
            student_id=current_user_id
        ).filter(Enrollment.progress >= 1.0).all()
        
        certificates = []
        for enrollment in completed_enrollments:
            course = enrollment.course
            certificates.append({
                'id': f"cert_{enrollment.id}",
                'course_title': course.title,
                'completion_date': enrollment.completion_date.isoformat() if enrollment.completion_date else None,
                'final_grade': enrollment.grade,
                'certificate_url': f"/certificates/{enrollment.id}",
                'skills_earned': [course.category] if course.category else ['General Programming'],
                'instructor': course.instructor.first_name + " " + course.instructor.last_name if course.instructor else "Unknown"
            })
        
        return jsonify(certificates), 200
        
    except Exception as e:
        return jsonify({"message": "Error fetching certificates", "error": str(e)}), 500

@student_bp.route("/goals", methods=["GET", "POST"])
@student_required
def manage_goals():
    """Get or set weekly learning goals"""
    current_user_id = int(get_jwt_identity())
    
    if request.method == "POST":
        data = request.get_json()
        
        try:
            # In a real implementation, this would be stored in a UserGoals table
            # For now, we'll return success with the provided goals
            goals = {
                'hours_target': data.get('hours_target', 15),
                'lessons_target': data.get('lessons_target', 10),
                'courses_target': data.get('courses_target', 1)
            }
            
            return jsonify({
                "message": "Goals updated successfully",
                "goals": goals
            }), 200
            
        except Exception as e:
            return jsonify({"message": "Error updating goals", "error": str(e)}), 500
    
    else:
        try:
            # Mock current goals and progress
            goals = {
                'hours_target': 15,
                'hours_completed': 12,
                'lessons_target': 10,
                'lessons_completed': 8,
                'courses_target': 1,
                'courses_completed': 0
            }
            
            return jsonify(goals), 200
            
        except Exception as e:
            return jsonify({"message": "Error fetching goals", "error": str(e)}), 500

# --- Assessment and Quiz Management Routes ---
@student_bp.route("/quizzes/<int:quiz_id>", methods=["GET"])
@student_required
def get_quiz(quiz_id):
    """Get quiz details and questions"""
    current_user_id = int(get_jwt_identity())
    
    try:
        quiz = Quiz.query.get_or_404(quiz_id)
        
        # Check if student is enrolled in the course
        enrollment = Enrollment.query.filter_by(
            student_id=current_user_id,
            course_id=quiz.course_id
        ).first()
        
        if not enrollment:
            return jsonify({"message": "Not enrolled in this course"}), 403
        
        # Get quiz attempts
        attempts = QuizAttempt.query.filter_by(
            user_id=current_user_id,
            quiz_id=quiz_id
        ).all()
        
        quiz_data = {
            'id': quiz.id,
            'title': quiz.title,
            'description': quiz.description,
            'time_limit': quiz.time_limit,
            'passing_score': quiz.passing_score,
            'max_attempts': quiz.max_attempts,
            'attempts_used': len(attempts),
            'best_score': max([a.score for a in attempts]) if attempts else None,
            'questions': [
                {
                    'id': q.id,
                    'question': q.question,
                    'type': q.question_type,
                    'options': q.options if hasattr(q, 'options') else [],
                    'points': q.points
                } for q in quiz.questions
            ] if hasattr(quiz, 'questions') else []
        }
        
        return jsonify(quiz_data), 200
        
    except Exception as e:
        return jsonify({"message": "Error fetching quiz", "error": str(e)}), 500

@student_bp.route("/quizzes/<int:quiz_id>/submit", methods=["POST"])
@student_required
def submit_quiz(quiz_id):
    """Submit quiz answers and calculate score"""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    try:
        quiz = Quiz.query.get_or_404(quiz_id)
        answers = data.get('answers', {})
        
        # Check enrollment
        enrollment = Enrollment.query.filter_by(
            student_id=current_user_id,
            course_id=quiz.course_id
        ).first()
        
        if not enrollment:
            return jsonify({"message": "Not enrolled in this course"}), 403
        
        # Check attempt limit
        existing_attempts = QuizAttempt.query.filter_by(
            user_id=current_user_id,
            quiz_id=quiz_id
        ).count()
        
        if existing_attempts >= quiz.max_attempts:
            return jsonify({"message": "Maximum attempts exceeded"}), 400
        
        # Calculate score (simplified calculation)
        total_points = len(answers) * 10  # Assuming 10 points per question
        earned_points = len(answers) * 8   # Mock scoring - 80% average
        score = (earned_points / total_points * 100) if total_points > 0 else 0
        
        # Create quiz attempt
        attempt = QuizAttempt(
            user_id=current_user_id,
            quiz_id=quiz_id,
            score=score,
            answers=str(answers),  # Store as JSON string
            completed_at=datetime.utcnow()
        )
        
        db.session.add(attempt)
        
        # Update enrollment grade if this is the best score
        if not enrollment.grade or score > enrollment.grade:
            enrollment.grade = score
        
        db.session.commit()
        
        return jsonify({
            "message": "Quiz submitted successfully",
            "score": score,
            "passed": score >= quiz.passing_score,
            "attempt_number": existing_attempts + 1,
            "remaining_attempts": quiz.max_attempts - (existing_attempts + 1)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error submitting quiz", "error": str(e)}), 500

@student_bp.route("/assignments/<int:assignment_id>/details", methods=["GET"])
@student_required
def get_assignment_details(assignment_id):
    """Get detailed assignment information"""
    current_user_id = int(get_jwt_identity())
    
    try:
        assignment = Assignment.query.get_or_404(assignment_id)
        
        # Check enrollment
        enrollment = Enrollment.query.filter_by(
            student_id=current_user_id,
            course_id=assignment.course_id
        ).first()
        
        if not enrollment:
            return jsonify({"message": "Not enrolled in this course"}), 403
        
        # Get submission
        submission = AssignmentSubmission.query.filter_by(
            student_id=current_user_id,
            assignment_id=assignment_id
        ).first()
        
        assignment_data = {
            'id': assignment.id,
            'title': assignment.title,
            'description': assignment.description,
            'due_date': assignment.due_date.isoformat() if assignment.due_date else None,
            'max_points': assignment.max_points,
            'submission_type': assignment.submission_type,
            'requirements': assignment.requirements if hasattr(assignment, 'requirements') else [],
            'resources': assignment.resources if hasattr(assignment, 'resources') else [],
            'submission': {
                'id': submission.id,
                'submitted_at': submission.submitted_at.isoformat(),
                'content': submission.content,
                'file_path': submission.file_path,
                'grade': submission.grade,
                'feedback': submission.feedback,
                'status': submission.status
            } if submission else None,
            'is_overdue': assignment.due_date < datetime.utcnow() if assignment.due_date else False
        }
        
        return jsonify(assignment_data), 200
        
    except Exception as e:
        return jsonify({"message": "Error fetching assignment details", "error": str(e)}), 500

@student_bp.route("/learning-path", methods=["GET"])
@student_required
def get_learning_path():
    """Get personalized learning path recommendations"""
    current_user_id = int(get_jwt_identity())
    
    try:
        # Get student's enrolled courses and progress
        enrollments = Enrollment.query.filter_by(student_id=current_user_id).all()
        
        # Calculate skill levels based on completed courses
        skill_levels = {}
        for enrollment in enrollments:
            course = enrollment.course
            category = course.category or "General"
            
            if category not in skill_levels:
                skill_levels[category] = 0
            
            # Add progress to skill level
            skill_levels[category] += enrollment.progress or 0
        
        # Generate recommended next steps
        recommendations = []
        
        # If no courses taken, recommend beginner courses
        if not enrollments:
            beginner_courses = Course.query.filter_by(
                is_published=True
            ).limit(3).all()
            
            for course in beginner_courses:
                recommendations.append({
                    'type': 'course',
                    'id': course.id,
                    'title': course.title,
                    'description': course.description,
                    'reason': 'Perfect for beginners',
                    'priority': 'high',
                    'estimated_duration': '8 weeks'
                })
        else:
            # Recommend courses based on completed ones
            completed_categories = [e.course.category for e in enrollments if e.progress >= 0.8]
            
            for category in completed_categories:
                advanced_courses = Course.query.filter(
                    Course.category.ilike(f'%{category}%'),
                    Course.is_published == True
                ).limit(2).all()
                
                for course in advanced_courses:
                    if not any(e.course_id == course.id for e in enrollments):
                        recommendations.append({
                            'type': 'course',
                            'id': course.id,
                            'title': course.title,
                            'description': course.description,
                            'reason': f'Continue your {category} journey',
                            'priority': 'medium',
                            'estimated_duration': '8 weeks'
                        })
        
        learning_path = {
            'current_level': 'Intermediate' if len(enrollments) > 2 else 'Beginner',
            'completed_courses': len([e for e in enrollments if e.progress >= 1.0]),
            'skill_levels': skill_levels,
            'recommendations': recommendations[:5],  # Limit to top 5
            'next_milestone': 'Complete 5 courses to unlock advanced track'
        }
        
        return jsonify(learning_path), 200
        
    except Exception as e:
        return jsonify({"message": "Error generating learning path", "error": str(e)}), 500