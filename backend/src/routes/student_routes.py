# Enhanced Student API Routes for Afritec Bridge LMS

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import json
import logging
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from ..models.user_models import db, User, Role
from ..models.course_models import Course, Module, Lesson, Enrollment, Quiz, Submission, Assignment, AssignmentSubmission, Project, ProjectSubmission, Announcement
from ..models.quiz_progress_models import QuizAttempt, UserAnswer
from ..models.student_models import (
    LessonCompletion, UserProgress, StudentNote, Badge, UserBadge,
    StudentBookmark, StudentForum, ForumPost, ModuleProgress,
    Certificate, SkillBadge, StudentSkillBadge
)
from ..models.achievement_models import UserAchievement, Achievement

# Set up logging
logger = logging.getLogger(__name__)

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
    
    # Get achievements using new achievement system
    user_achievements = UserAchievement.query.filter_by(user_id=current_user_id)\
        .options(db.joinedload(UserAchievement.course))\
        .order_by(UserAchievement.earned_at.desc()).limit(10).all()
    achievements = [ua.to_dict() for ua in user_achievements]
    
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
        
        # Get user for role checking
        user = User.query.get(current_user_id)
        is_instructor = user.role.name == 'instructor' and course.instructor_id == current_user_id
        is_admin = user.role.name == 'admin'
        
        # Use for_student=True unless user is instructor/admin viewing their own course
        for_student = not (is_instructor or is_admin)
        course_data = course.to_dict(include_modules=True, for_student=for_student)
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
    
    # Build progress data - only show published and released modules to students
    modules_progress = []
    
    # Get user for role checking
    user = User.query.get(current_user_id)
    is_instructor = user.role.name == 'instructor' and course.instructor_id == current_user_id
    is_admin = user.role.name == 'admin'
    
    if is_instructor or is_admin:
        # Instructors and admins see all modules
        modules_to_show = course.modules.order_by(Module.order)
    else:
        # Students: filter for published modules and apply release settings
        published_modules = course.modules.filter_by(is_published=True).order_by(Module.order).all()
        
        # Apply course release settings to determine which published modules to show
        released_count = course.get_released_module_count()
        
        if released_count is None:
            # All published modules are released
            modules_to_show = published_modules
        else:
            # Apply release logic: show modules that are either manually released or within auto-release count
            modules_to_show = []
            auto_released_count = 0
            
            for module in published_modules:
                if module.is_released or auto_released_count < released_count:
                    modules_to_show.append(module)
                    if not module.is_released:
                        auto_released_count += 1
    
    for module in modules_to_show:
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

# --- Lesson Progress Routes ---
@student_bp.route("/lessons/<int:lesson_id>/progress", methods=["POST"])
@student_required
def update_lesson_progress(lesson_id):
    """Update lesson reading progress with auto-completion at 80% score"""
    current_user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    lesson = Lesson.query.get_or_404(lesson_id)
    
    # Check if student is enrolled in the course
    enrollment = Enrollment.query.filter_by(
        student_id=current_user_id,
        course_id=lesson.module.course_id
    ).first()
    
    if not enrollment:
        return jsonify({"message": "Not enrolled in this course"}), 403
    
    # Find or create lesson completion record
    lesson_completion = LessonCompletion.query.filter_by(
        student_id=current_user_id,
        lesson_id=lesson_id
    ).first()
    
    was_already_completed = lesson_completion.completed if lesson_completion else False
    
    if not lesson_completion:
        lesson_completion = LessonCompletion(
            student_id=current_user_id,
            lesson_id=lesson_id,
            completed=False
        )
        db.session.add(lesson_completion)
    
    # Update progress fields
    reading_or_engagement_updated = False
    if 'reading_progress' in data:
        old_reading = lesson_completion.reading_progress or 0.0
        lesson_completion.reading_progress = data['reading_progress']
        if old_reading != data['reading_progress']:
            reading_or_engagement_updated = True
    if 'engagement_score' in data:
        old_engagement = lesson_completion.engagement_score or 0.0
        lesson_completion.engagement_score = data['engagement_score']
        if old_engagement != data['engagement_score']:
            reading_or_engagement_updated = True
    if 'scroll_progress' in data:
        lesson_completion.scroll_progress = data['scroll_progress']
    if 'video_progress' in data:
        lesson_completion.video_progress = data['video_progress']
    if 'time_spent' in data:
        lesson_completion.time_spent = data['time_spent']
    
    # Enhanced video tracking fields
    if 'video_current_time' in data:
        lesson_completion.video_current_time = data['video_current_time']
    if 'video_duration' in data:
        lesson_completion.video_duration = data['video_duration']
    if 'video_completed' in data:
        old_completed = lesson_completion.video_completed
        lesson_completion.video_completed = data['video_completed']
        # Increment watch count when video completes for the first time or rewatches
        if data['video_completed'] and (not old_completed or lesson_completion.video_watch_count > 0):
            lesson_completion.video_watch_count = (lesson_completion.video_watch_count or 0) + 1
            lesson_completion.video_last_watched = datetime.utcnow()
    if 'playback_speed' in data:
        lesson_completion.playback_speed = data['playback_speed']
    if 'mixed_video_progress' in data:
        # Store mixed video progress as JSON string
        lesson_completion.mixed_video_progress = json.dumps(data['mixed_video_progress'])
    
    # Update timestamps
    lesson_completion.updated_at = datetime.utcnow()
    if data.get('auto_saved'):
        lesson_completion.last_accessed = datetime.utcnow()
    
    # Calculate lesson score and auto-complete if >= 80%
    lesson_score = lesson_completion.calculate_lesson_score()
    auto_completed = False
    next_lesson_unlocked = False
    next_lesson_info = None
    
    # Auto-complete lesson if score >= 80% and not already completed
    COMPLETION_THRESHOLD = 80.0
    if lesson_score >= COMPLETION_THRESHOLD and not was_already_completed:
        lesson_completion.completed = True
        lesson_completion.completed_at = datetime.utcnow()
        auto_completed = True
        
        # Update user progress
        user_progress = UserProgress.query.filter_by(
            user_id=current_user_id,
            course_id=lesson.module.course_id
        ).first()
        
        if user_progress:
            # Update last accessed time (lessons_completed is tracked via LessonCompletion table)
            user_progress.last_accessed = datetime.utcnow()
        
        # Update enrollment progress
        total_lessons = db.session.query(Lesson).join(Module).filter(
            Module.course_id == lesson.module.course_id
        ).count()
        
        completed_lessons = db.session.query(LessonCompletion).join(Lesson).join(Module).filter(
            Module.course_id == lesson.module.course_id,
            LessonCompletion.student_id == current_user_id,
            LessonCompletion.completed == True
        ).count()
        
        if total_lessons > 0:
            enrollment.progress = completed_lessons / total_lessons
            if enrollment.progress >= 1.0:
                enrollment.completed_at = datetime.utcnow()
        
        # Unlock next lesson in the module
        next_lesson_info = _unlock_next_lesson(lesson, current_user_id, enrollment.id)
        if next_lesson_info:
            next_lesson_unlocked = True
    
    # Update lesson component scores if reading/engagement changed
    if reading_or_engagement_updated:
        try:
            from ..services.lesson_completion_service import LessonCompletionService
            
            # Update stored lesson scores when reading/engagement changes
            lesson_completion.updated_at = datetime.utcnow()
            db.session.commit()  # Commit first to save the progress updates
            
            # Now update the component scores
            score_updated = LessonCompletionService.update_lesson_score_after_reading_engagement(
                current_user_id, lesson_id
            )
            
            if score_updated:
                current_app.logger.info(
                    f"✅ Lesson scores updated after reading/engagement change - Student: {current_user_id}, "
                    f"Lesson: {lesson_id}"
                )
                
        except Exception as e:
            current_app.logger.warning(f"❌ Error updating lesson scores after reading/engagement: {str(e)}")
    
    try:
        db.session.commit()
        
        # Refresh lesson completion to ensure we return fresh data
        db.session.refresh(lesson_completion)
        
        # Get enhanced score breakdown with component scores
        try:
            from ..services.lesson_completion_service import LessonCompletionService
            score_breakdown = LessonCompletionService.get_lesson_score_breakdown(current_user_id, lesson_id)
            lesson_score = score_breakdown['lesson_score']
        except Exception as e:
            # Fallback to old calculation if service fails
            current_app.logger.warning(f"Error getting score breakdown: {str(e)}")
            lesson_score = lesson_completion.calculate_lesson_score()
            score_breakdown = None
        
        response_data = {
            "message": "Lesson progress updated successfully",
            "progress": {
                "reading_progress": lesson_completion.reading_progress,
                "engagement_score": lesson_completion.engagement_score,
                "scroll_progress": lesson_completion.scroll_progress,
                "time_spent": lesson_completion.time_spent,
                "lesson_score": lesson_score,
                "completed": lesson_completion.completed,
                "last_updated": lesson_completion.updated_at.isoformat()
            },
            "auto_completed": auto_completed,
            "completion_threshold": COMPLETION_THRESHOLD
        }
        
        # Add component score breakdown if available
        if score_breakdown:
            response_data["score_breakdown"] = {
                "reading_component": score_breakdown['reading_component'],
                "engagement_component": score_breakdown['engagement_component'],
                "quiz_component": score_breakdown['quiz_component'],
                "assignment_component": score_breakdown['assignment_component'],
                "has_quiz": score_breakdown['has_quiz'],
                "has_assignment": score_breakdown['has_assignment'],
                "score_last_updated": score_breakdown.get('score_last_updated')
            }
        
        if auto_completed:
            response_data["completion_message"] = f"🎉 Lesson auto-completed! Score: {lesson_score:.1f}%"
            current_app.logger.info(f"✅ Lesson {lesson_id} auto-completed with score {lesson_score:.1f}%")
        
        if next_lesson_unlocked and next_lesson_info:
            response_data["next_lesson_unlocked"] = True
            response_data["next_lesson"] = next_lesson_info
        
        return jsonify(response_data), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Failed to update progress: {str(e)}"}), 500


def _unlock_next_lesson(current_lesson, student_id, enrollment_id):
    """
    Unlock the next lesson after completing the current one.
    Returns info about the next lesson if unlocked, None otherwise.
    """
    module = current_lesson.module
    
    # Get all lessons in the current module ordered by their position
    module_lessons = Lesson.query.filter_by(module_id=module.id).order_by(Lesson.order).all()
    
    # Find the current lesson's index
    current_index = None
    for i, lesson in enumerate(module_lessons):
        if lesson.id == current_lesson.id:
            current_index = i
            break
    
    if current_index is None:
        return None
    
    # Check if there's a next lesson in the same module
    if current_index < len(module_lessons) - 1:
        next_lesson = module_lessons[current_index + 1]
        return {
            "id": next_lesson.id,
            "title": next_lesson.title,
            "module_id": module.id,
            "module_title": module.title,
            "same_module": True
        }
    
    # If this was the last lesson in the module, check for next module
    course = module.course
    next_module = Module.query.filter(
        Module.course_id == course.id,
        Module.order > module.order
    ).order_by(Module.order).first()
    
    if next_module:
        # Get first lesson of next module
        first_lesson = Lesson.query.filter_by(module_id=next_module.id).order_by(Lesson.order).first()
        if first_lesson:
            return {
                "id": first_lesson.id,
                "title": first_lesson.title,
                "module_id": next_module.id,
                "module_title": next_module.title,
                "same_module": False,
                "new_module": True
            }
    
    # No more lessons
    return None

@student_bp.route("/lessons/<int:lesson_id>/progress", methods=["GET"])
@student_required
def get_lesson_progress(lesson_id):
    """Get lesson reading progress with dynamic score breakdown"""
    current_user_id = int(get_jwt_identity())
    
    lesson = Lesson.query.get_or_404(lesson_id)
    
    # Check if student is enrolled in the course
    enrollment = Enrollment.query.filter_by(
        student_id=current_user_id,
        course_id=lesson.module.course_id
    ).first()
    
    if not enrollment:
        return jsonify({"message": "Not enrolled in this course"}), 403
    
    # Check if lesson has quiz or assignment for score calculation
    from ..models.course_models import Quiz, Assignment
    has_quiz = Quiz.query.filter_by(lesson_id=lesson_id).first() is not None
    has_assignment = Assignment.query.filter_by(lesson_id=lesson_id).first() is not None
    
    # Get lesson completion record
    lesson_completion = LessonCompletion.query.filter_by(
        student_id=current_user_id,
        lesson_id=lesson_id
    ).first()
    
    # Refresh to get latest data from database
    if lesson_completion:
        db.session.refresh(lesson_completion)
        current_app.logger.info(f"📚 GET lesson progress: lesson_id={lesson_id}, completed={lesson_completion.completed}, reading_progress={lesson_completion.reading_progress}, engagement_score={lesson_completion.engagement_score}")
        score_breakdown = lesson_completion.get_score_breakdown()
        return jsonify({
            "lesson_id": lesson_id,
            "progress": {
                "reading_progress": lesson_completion.reading_progress or 0,
                "engagement_score": lesson_completion.engagement_score or 0,
                "scroll_progress": lesson_completion.scroll_progress or 0,
                "time_spent": lesson_completion.time_spent or 0,
                "completed": lesson_completion.completed,
                "last_updated": lesson_completion.updated_at.isoformat() if lesson_completion.updated_at else None,
                "lesson_score": score_breakdown['total_score'],
                "score_breakdown": score_breakdown,
                "has_quiz": has_quiz,
                "has_assignment": has_assignment
            }
        }), 200
    else:
        return jsonify({
            "lesson_id": lesson_id,
            "progress": {
                "reading_progress": 0,
                "engagement_score": 0,
                "scroll_progress": 0,
                "time_spent": 0,
                "completed": False,
                "last_updated": None,
                "lesson_score": 0,
                "score_breakdown": {
                    'scores': {'reading': 0, 'engagement': 0, 'quiz': 0, 'assignment': 0},
                    'weights': {'reading': 50 if not has_quiz and not has_assignment else 25, 
                               'engagement': 50 if not has_quiz and not has_assignment else 25, 
                               'quiz': 30 if has_quiz and not has_assignment else (25 if has_quiz else 0), 
                               'assignment': 30 if has_assignment and not has_quiz else (25 if has_assignment else 0)},
                    'has_quiz': has_quiz,
                    'has_assignment': has_assignment,
                    'total_score': 0
                },
                "has_quiz": has_quiz,
                "has_assignment": has_assignment
            }
        }), 200

# --- Lesson Completion Routes ---
@student_bp.route("/lessons/<int:lesson_id>/complete", methods=["POST"])
@student_required
def complete_lesson(lesson_id):
    """Mark a lesson as completed with enhanced requirement checking"""
    current_user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    lesson = Lesson.query.get_or_404(lesson_id)
    
    # Check if student is enrolled in the course
    enrollment = Enrollment.query.filter_by(
        student_id=current_user_id,
        course_id=lesson.module.course_id
    ).first()
    
    if not enrollment:
        return jsonify({"message": "Not enrolled in this course"}), 403
    
    # Update lesson progress first (reading, engagement, etc.)
    existing_completion = LessonCompletion.query.filter_by(
        student_id=current_user_id,
        lesson_id=lesson_id
    ).first()
    
    if not existing_completion:
        # Create new completion record
        existing_completion = LessonCompletion(
            student_id=current_user_id,
            lesson_id=lesson_id,
            completed=False,  # Don't mark as complete yet
            reading_progress=data.get('reading_progress', 0.0),
            engagement_score=data.get('engagement_score', 0.0),
            scroll_progress=data.get('scroll_progress', 0.0),
            time_spent=data.get('time_spent', 0),
            completed_at=None,  # Will be set when actually completed
            updated_at=datetime.utcnow(),
            last_accessed=datetime.utcnow()
        )
        db.session.add(existing_completion)
    else:
        # Update existing completion with better scores only
        updated = False
        
        if data.get('reading_progress') and data.get('reading_progress') > (existing_completion.reading_progress or 0):
            existing_completion.reading_progress = data.get('reading_progress')
            updated = True
        if data.get('engagement_score') and data.get('engagement_score') > (existing_completion.engagement_score or 0):
            existing_completion.engagement_score = data.get('engagement_score')
            updated = True
        if data.get('scroll_progress') and data.get('scroll_progress') > (existing_completion.scroll_progress or 0):
            existing_completion.scroll_progress = data.get('scroll_progress')
            updated = True
        if data.get('time_spent') and data.get('time_spent') > (existing_completion.time_spent or 0):
            existing_completion.time_spent = data.get('time_spent')
            updated = True
        
        # If engagement_score is 0 but lesson is completed, use reading_progress or default to 100
        if existing_completion.completed and (existing_completion.engagement_score or 0) == 0:
            existing_completion.engagement_score = existing_completion.reading_progress or 100.0
            updated = True
        
        if updated:
            existing_completion.updated_at = datetime.utcnow()
        existing_completion.last_accessed = datetime.utcnow()
    
    try:
        # Commit progress updates first
        db.session.commit()
        
        # Now check if lesson can be completed using the enhanced service
        from ..services.lesson_completion_service import LessonCompletionService
        
        # Check requirements
        can_complete, reason, requirements = LessonCompletionService.check_lesson_completion_requirements(
            current_user_id, lesson_id
        )
        
        if can_complete:
            # Attempt completion
            success, message, completion_data = LessonCompletionService.attempt_lesson_completion(
                current_user_id, lesson_id
            )
            
            if success:
                # Update module score after successful completion
                from ..services.progression_service import ProgressionService
                module_progress = ModuleProgress.query.filter_by(
                    student_id=current_user_id,
                    module_id=lesson.module_id
                ).first()
                
                if module_progress:
                    ProgressionService._update_course_contribution_score(
                        current_user_id, lesson.module_id, enrollment.id
                    )
                
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
                    LessonCompletion.student_id == current_user_id,
                    LessonCompletion.completed == True  # Only count truly completed lessons
                ).count()
                
                progress_percentage = completed_lessons / total_lessons if total_lessons > 0 else 0
                
                # Update enrollment progress
                enrollment.progress = progress_percentage
                if progress_percentage >= 1.0:
                    enrollment.completed_at = datetime.utcnow()
                
                user_progress.completion_percentage = progress_percentage * 100
                
                db.session.commit()
                
                # Trigger achievements after successful lesson completion
                try:
                    from ..services.achievement_service import AchievementService
                    
                    event_data = {
                        'lesson_id': lesson_id,
                        'course_id': lesson.module.course_id,
                        'module_id': lesson.module_id,
                        'time_spent': data.get('time_spent', 0),
                        'engagement_score': data.get('engagement_score', 75.0),
                        'reading_progress': data.get('reading_progress', 100.0),
                        'scroll_progress': data.get('scroll_progress', 100.0),
                        'completed_lessons': completed_lessons,
                        'total_lessons': total_lessons,
                        'course_progress': progress_percentage,
                        'lesson_title': lesson.title,
                        'lesson_score': completion_data.get('final_score', 0)
                    }
                    
                    new_achievements = AchievementService.check_and_award_achievements(
                        current_user_id, 'lesson_complete', event_data
                    )
                    new_achievements_payload = [
                        ach.to_dict() if hasattr(ach, 'to_dict') else ach
                        for ach in new_achievements
                    ]
                    
                    # Update learning streak
                    streak_current, streak_milestones = AchievementService.update_learning_streak(current_user_id)
                    
                    return jsonify({
                        "message": message,
                        "completed": True,
                        "completion": completion_data.get('completion', {}),
                        "final_score": completion_data.get('final_score', 0),
                        "requirements": requirements,
                        "new_achievements": new_achievements_payload,
                        "learning_streak": {
                            "current_streak": streak_current,
                            "new_milestones": streak_milestones,
                        } if streak_current is not None else None
                    }), 200
                    
                except Exception as e:
                    current_app.logger.warning(f"Achievement processing failed: {str(e)}")
                    return jsonify({
                        "message": message,
                        "completed": True,
                        "completion": completion_data.get('completion', {}),
                        "final_score": completion_data.get('final_score', 0),
                        "requirements": requirements
                    }), 200
            else:
                return jsonify({
                    "message": message,
                    "completed": False,
                    "requirements": requirements
                }), 400
        else:
            # Requirements not met - return detailed requirements
            return jsonify({
                "message": reason,
                "completed": False,
                "requirements": requirements,
                "progress_saved": True,
                "current_scores": {
                    "reading_progress": existing_completion.reading_progress or 0,
                    "engagement_score": existing_completion.engagement_score or 0,
                    "lesson_score": existing_completion.calculate_lesson_score()
                }
            }), 202  # 202 Accepted - progress saved but not complete
            
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Lesson completion error: {str(e)}")
        return jsonify({"message": f"Failed to complete lesson: {str(e)}"}), 500
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error completing lesson", "error": str(e)}), 500

# --- Enhanced Lesson Completion Status Route ---
@student_bp.route("/lessons/<int:lesson_id>/completion-status", methods=["GET"])
@student_required
def get_lesson_completion_status(lesson_id):
    """Get detailed completion status and requirements for a lesson"""
    current_user_id = int(get_jwt_identity())
    
    try:
        from ..services.lesson_completion_service import LessonCompletionService
        
        status = LessonCompletionService.get_lesson_completion_status(
            current_user_id, lesson_id
        )
        
        return jsonify({
            "lesson_id": lesson_id,
            "status": status
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error getting lesson completion status: {str(e)}")
        return jsonify({"message": f"Error getting status: {str(e)}"}), 500

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

# --- Announcements Routes ---
@student_bp.route("/announcements", methods=["GET"])
@student_required
def get_student_announcements():
    """Get all announcements from enrolled courses"""
    current_user_id = int(get_jwt_identity())
    
    try:
        # Get enrolled course IDs
        enrolled_course_ids = db.session.query(Enrollment.course_id).filter_by(
            student_id=current_user_id
        ).all()
        course_ids = [e.course_id for e in enrolled_course_ids]
        
        if not course_ids:
            return jsonify([]), 200
        
        # Get announcements from enrolled courses
        announcements = Announcement.query.filter(
            Announcement.course_id.in_(course_ids)
        ).order_by(Announcement.created_at.desc()).all()
        
        # Format announcements with course information
        announcements_data = []
        for announcement in announcements:
            ann_dict = announcement.to_dict()
            # Add course title for easier display
            ann_dict['course_title'] = announcement.course.title if announcement.course else "Unknown"
            announcements_data.append(ann_dict)
        
        return jsonify(announcements_data), 200
        
    except Exception as e:
        logger.error(f"Error fetching student announcements: {str(e)}")
        return jsonify({"message": "Failed to fetch announcements", "error": str(e)}), 500

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

@student_bp.route("/badges/check", methods=["POST"])
@student_required
def check_earned_badges():
    """Check for newly earned badges based on course progress"""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    course_id = data.get('course_id')
    
    try:
        # Get current progress for the course
        enrollment = Enrollment.query.filter_by(
            student_id=current_user_id,
            course_id=course_id
        ).first()
        
        if not enrollment:
            return jsonify({"message": "Enrollment not found"}), 404
        
        # Get completed lessons count
        completed_lessons = LessonCompletion.query.filter_by(
            student_id=current_user_id,
            completed=True
        ).join(Lesson).filter(Lesson.module_id.in_(
            db.session.query(Module.id).filter_by(course_id=course_id)
        )).count()
        
        new_badges = []
        
        # Check for lesson completion badges (every 3 lessons)
        if completed_lessons > 0 and completed_lessons % 3 == 0:
            # Create or find the "3 Lessons Complete" badge
            badge_name = f"Completed {completed_lessons} Lessons"
            existing_badge = SkillBadge.query.filter_by(name=badge_name).first()
            
            if not existing_badge:
                # Create the badge if it doesn't exist
                lesson_badge = SkillBadge(
                    name=badge_name,
                    description=f"Successfully completed {completed_lessons} lessons in the course",
                    criteria=json.dumps({"lessons_completed": completed_lessons}),
                    category="learning_progress",
                    difficulty_level="beginner",
                    points_value=10
                )
                db.session.add(lesson_badge)
                db.session.flush()
                badge_id = lesson_badge.id
            else:
                badge_id = existing_badge.id
            
            # Check if student already has this badge
            existing_student_badge = StudentSkillBadge.query.filter_by(
                student_id=current_user_id,
                badge_id=badge_id
            ).first()
            
            if not existing_student_badge:
                # Award the badge
                student_badge = StudentSkillBadge(
                    student_id=current_user_id,
                    badge_id=badge_id,
                    course_id=course_id,
                    evidence_data=json.dumps({
                        "lessons_completed": completed_lessons,
                        "course_id": course_id,
                        "earned_date": datetime.utcnow().isoformat()
                    })
                )
                db.session.add(student_badge)
                
                new_badges.append({
                    "id": badge_id,
                    "name": badge_name,
                    "description": f"Successfully completed {completed_lessons} lessons in the course",
                    "earned_date": datetime.utcnow().isoformat()
                })
        
        db.session.commit()
        return jsonify({"newBadges": new_badges}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error checking badges", "error": str(e)}), 500

@student_bp.route("/certificates/generate", methods=["POST"])
@student_required
def generate_certificate():
    """Generate certificate for completed course"""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    course_id = data.get('course_id')
    
    try:
        # Check if course is completed and eligible for certificate
        enrollment = Enrollment.query.filter_by(
            student_id=current_user_id,
            course_id=course_id
        ).first()
        
        if not enrollment:
            return jsonify({"message": "Enrollment not found"}), 404
        
        course = enrollment.course
        if not course:
            return jsonify({"message": "Course not found"}), 404
        
        # Check completion criteria
        total_lessons = db.session.query(Lesson).join(Module).filter(
            Module.course_id == course_id
        ).count()
        
        completed_lessons = LessonCompletion.query.filter_by(
            student_id=current_user_id,
            completed=True
        ).join(Lesson).join(Module).filter(
            Module.course_id == course_id
        ).count()
        
        # Get module scores using cumulative_score (the actual calculated score)
        module_scores = []
        modules = Module.query.filter_by(course_id=course_id).all()
        for module in modules:
            module_progress = ModuleProgress.query.filter_by(
                student_id=current_user_id,
                module_id=module.id
            ).first()
            if module_progress:
                # Use cumulative_score which is the properly calculated module score
                module_scores.append(module_progress.cumulative_score or 0)
        
        overall_score = sum(module_scores) / len(module_scores) if module_scores else 0
        
        # Check eligibility - require passing score (80%) for all modules
        # Lessons completion is tracked per-module, not globally
        all_modules_passing = all(score >= 80 for score in module_scores) if module_scores else False
        passing_overall = overall_score >= 80
        
        # For certificate eligibility, we check if the student has passed all modules
        # (each module requires 80% to unlock the next one)
        if not (all_modules_passing and passing_overall):
            return jsonify({
                "success": False,
                "message": "Course completion requirements not met",
                "requirements": {
                    "lessons_completed": f"{completed_lessons}/{total_lessons}",
                    "overall_score": f"{overall_score:.1f}%",
                    "all_modules_passing": all_modules_passing,
                    "module_scores": [f"{score:.1f}%" for score in module_scores],
                    "eligible": False
                }
            }), 400
        
        # Check if certificate already exists
        existing_certificate = Certificate.query.filter_by(
            student_id=current_user_id,
            course_id=course_id
        ).first()
        
        if existing_certificate:
            return jsonify({
                "success": True,
                "message": "Certificate already exists",
                "certificate": existing_certificate.to_dict()
            }), 200
        
        # Generate new certificate
        certificate = Certificate(
            student_id=current_user_id,
            course_id=course_id,
            enrollment_id=enrollment.id,
            overall_score=overall_score,
            grade="A" if overall_score >= 90 else "B" if overall_score >= 80 else "C",
            skills_acquired=json.dumps([course.title, "Problem Solving", "Critical Thinking"]),
            portfolio_items=json.dumps([])
        )
        certificate.generate_certificate_number()
        
        db.session.add(certificate)
        
        # Update enrollment completion
        enrollment.completion_date = datetime.utcnow()
        enrollment.grade = overall_score
        enrollment.progress = 1.0
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Certificate generated successfully",
            "certificate": certificate.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error generating certificate", "error": str(e)}), 500

@student_bp.route("/courses/<int:course_id>/detailed-progress", methods=["GET"])
@student_required
def get_detailed_course_progress(course_id):
    """Get detailed course progress including quizzes and assignments"""
    current_user_id = int(get_jwt_identity())
    
    try:
        # Get course modules and lessons
        course = Course.query.get_or_404(course_id)
        modules = Module.query.filter_by(course_id=course_id).all()
        
        total_lessons = 0
        completed_lessons = 0
        total_quizzes = 0
        completed_quizzes = 0
        total_assignments = 0
        completed_assignments = 0
        
        for module in modules:
            # Count lessons
            module_lessons = Lesson.query.filter_by(module_id=module.id).all()
            total_lessons += len(module_lessons)
            
            for lesson in module_lessons:
                lesson_progress = LessonCompletion.query.filter_by(
                    student_id=current_user_id,
                    lesson_id=lesson.id,
                    completed=True
                ).first()
                if lesson_progress:
                    completed_lessons += 1
            
            # Count quizzes (would need Quiz model - placeholder for now)
            # total_quizzes += Quiz.query.filter_by(module_id=module.id).count()
            
            # Count assignments (would need Assignment model - placeholder for now)
            # total_assignments += Assignment.query.filter_by(module_id=module.id).count()
        
        # Calculate overall score from module progress
        module_scores = []
        for module in modules:
            module_progress = ModuleProgress.query.filter_by(
                student_id=current_user_id,
                module_id=module.id
            ).first()
            if module_progress:
                score = (
                    module_progress.course_contribution_score * 0.10 +
                    module_progress.quiz_score * 0.30 +
                    module_progress.assignment_score * 0.40 +
                    module_progress.final_assessment_score * 0.20
                )
                module_scores.append(score)
        
        overall_score = sum(module_scores) / len(module_scores) if module_scores else 0
        
        return jsonify({
            "lessons_completed": completed_lessons,
            "total_lessons": total_lessons,
            "completed_quizzes": completed_quizzes,
            "total_quizzes": total_quizzes,
            "completed_assignments": completed_assignments,
            "total_assignments": total_assignments,
            "overall_score": overall_score
        }), 200
        
    except Exception as e:
        return jsonify({"message": "Error fetching course progress", "error": str(e)}), 500

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
        
        # Get quiz questions with answers
        questions_list = []
        if quiz.questions:
            for q in quiz.questions.all():
                answers_list = []
                if q.answers:
                    for ans in q.answers.all():
                        answers_list.append({
                            'id': ans.id,
                            'text': ans.text,
                            'answer_text': ans.text,  # For compatibility
                            'question_id': ans.question_id
                        })
                
                questions_list.append({
                    'id': q.id,
                    'text': q.text,
                    'question_text': q.text,  # For compatibility
                    'question': q.text,  # For backward compatibility
                    'question_type': q.question_type,
                    'order': q.order,
                    'order_index': q.order,  # For compatibility
                    'points': q.points,
                    'explanation': q.explanation,
                    'answers': answers_list
                })
        
        # Get best attempt score
        best_score = None
        if attempts:
            valid_scores = [a.score_percentage for a in attempts if hasattr(a, 'score_percentage') and a.score_percentage is not None]
            if not valid_scores:
                valid_scores = [a.score for a in attempts if hasattr(a, 'score') and a.score is not None]
            best_score = max(valid_scores) if valid_scores else None
        
        quiz_data = {
            'id': quiz.id,
            'title': quiz.title,
            'description': quiz.description,
            'time_limit': quiz.time_limit,
            'passing_score': quiz.passing_score,
            'max_attempts': quiz.max_attempts if quiz.max_attempts else -1,
            'attempts_used': len(attempts),
            'best_score': best_score,
            'points_possible': quiz.points_possible,
            'shuffle_questions': quiz.shuffle_questions,
            'shuffle_answers': quiz.shuffle_answers,
            'show_correct_answers': quiz.show_correct_answers,
            'questions': questions_list
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
        
        # Check if max attempts is set and exceeded (None or -1 means unlimited)
        if quiz.max_attempts and quiz.max_attempts > 0 and existing_attempts >= quiz.max_attempts:
            return jsonify({"message": "Maximum attempts exceeded"}), 400
        
        # Calculate score based on actual quiz questions
        total_points = 0
        earned_points = 0
        
        # Get all questions for this quiz
        questions = quiz.questions.all() if quiz.questions else []
        
        for question in questions:
            total_points += question.points
            
            # Get user's answer for this question
            user_answer = answers.get(str(question.id))
            if not user_answer:
                continue
            
            # Get correct answers for this question
            correct_answers = [ans for ans in question.answers.all() if ans.is_correct]
            
            if question.question_type == 'multiple_choice' or question.question_type == 'single_choice':
                # Check if user's answer matches a correct answer
                if any(str(ans.id) == str(user_answer) for ans in correct_answers):
                    earned_points += question.points
            elif question.question_type == 'true_false':
                # For true/false, check if answer matches 'true' or 'false'
                if correct_answers:
                    # Check if user_answer matches the correct answer's text (case-insensitive)
                    correct_value = correct_answers[0].text.lower()
                    if str(user_answer).lower() == correct_value or \
                       (str(user_answer).lower() == 'true' and correct_value in ['true', 't', 'yes', '1']) or \
                       (str(user_answer).lower() == 'false' and correct_value in ['false', 'f', 'no', '0']):
                        earned_points += question.points
            elif question.question_type in ['short_answer', 'essay']:
                # For text-based questions, award points if answer is provided
                # Note: These should be manually graded by instructor
                # For now, we'll award points for providing an answer
                if user_answer and str(user_answer).strip():
                    # Store for manual grading but award provisional points
                    # In production, these would need instructor review
                    earned_points += question.points
        
        score_percentage = (earned_points / total_points * 100) if total_points > 0 else 0
        
        # Create quiz attempt with attempt number
        attempt_number = existing_attempts + 1
        attempt = QuizAttempt(
            user_id=current_user_id,
            quiz_id=quiz_id,
            attempt_number=attempt_number,
            score=earned_points,
            score_percentage=score_percentage,
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow()
        )
        
        db.session.add(attempt)
        db.session.flush()  # Get attempt ID
        
        # Store individual answers
        for question_id_str, answer_data in answers.items():
            user_answer = UserAnswer(
                quiz_attempt_id=attempt.id,
                question_id=int(question_id_str),
                answer_data={'selected_answer': answer_data}
            )
            db.session.add(user_answer)
        
        db.session.commit()
        
        # ===== ENHANCED: Update module progress and lesson completion with quiz score =====
        # Get the module_id from either the quiz directly or via the lesson
        module_id = quiz.module_id
        lesson_id = quiz.lesson_id
        
        if not module_id and lesson_id:
            # Quiz is attached to a lesson, get module from lesson
            lesson = Lesson.query.get(lesson_id)
            if lesson:
                module_id = lesson.module_id
        
        if module_id:
            try:
                # Update module progress with the quiz score
                module_progress = ModuleProgress.query.filter_by(
                    student_id=current_user_id,
                    module_id=module_id,
                    enrollment_id=enrollment.id
                ).first()
                
                if module_progress:
                    # Use best quiz score (keep the higher score)
                    current_quiz_score = module_progress.quiz_score or 0.0
                    module_progress.quiz_score = max(current_quiz_score, score_percentage)
                    module_progress.calculate_cumulative_score()
                    db.session.commit()
                    print(f"✅ Updated module {module_id} quiz score: {module_progress.quiz_score}%")
                else:
                    print(f"⚠️ No module progress found for module {module_id}")
            except Exception as mp_error:
                print(f"⚠️ Error updating module progress: {str(mp_error)}")
                # Don't fail the whole request, just log the error
        
        # Update lesson completion if this quiz is attached to a lesson
        if lesson_id:
            try:
                from ..services.lesson_completion_service import LessonCompletionService
                
                # Update lesson score after quiz completion
                score_updated = LessonCompletionService.update_lesson_score_after_grading(
                    current_user_id, lesson_id
                )
                
                if score_updated:
                    print(f"✅ Lesson completion score updated after quiz submission")
                
                # Check if lesson can now be completed
                can_complete, reason, requirements = LessonCompletionService.check_lesson_completion_requirements(
                    current_user_id, lesson_id
                )
                
                if can_complete:
                    # Get current lesson completion
                    lesson_completion = LessonCompletion.query.filter_by(
                        student_id=current_user_id,
                        lesson_id=lesson_id
                    ).first()
                    
                    if lesson_completion and not lesson_completion.completed:
                        # Auto-complete the lesson since all requirements are met
                        success, message, completion_data = LessonCompletionService.attempt_lesson_completion(
                            current_user_id, lesson_id
                        )
                        if success:
                            print(f"✅ Lesson {lesson_id} auto-completed for student {current_user_id} after quiz submission: {message}")
                
            except Exception as lc_error:
                print(f"⚠️ Error updating lesson completion after quiz: {str(lc_error)}")
                # Don't fail the whole request, just log the error
        # ===== END ENHANCED FIX =====
        
        # Calculate remaining attempts
        if quiz.max_attempts and quiz.max_attempts > 0:
            remaining = quiz.max_attempts - attempt_number
        else:
            remaining = -1  # Unlimited
        
        return jsonify({
            "message": "Quiz submitted successfully",
            "score": score_percentage,
            "passed": score_percentage >= quiz.passing_score,
            "attempt_number": attempt_number,
            "total_attempts": attempt_number,
            "remaining_attempts": remaining
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
            'instructions': assignment.instructions,
            'assignment_type': assignment.assignment_type,
            'max_file_size_mb': assignment.max_file_size_mb,
            'allowed_file_types': assignment.allowed_file_types,
            'due_date': assignment.due_date.isoformat() if assignment.due_date else None,
            'points_possible': assignment.points_possible,
            'is_published': assignment.is_published,
            'created_at': assignment.created_at.isoformat(),
            'updated_at': assignment.updated_at.isoformat(),
            
            # Modification request fields
            'modification_requested': assignment.modification_requested,
            'modification_request_reason': assignment.modification_request_reason,
            'modification_request_at': assignment.modification_requested_at.isoformat() if assignment.modification_requested_at else None,
            'modification_requested_by': assignment.modification_requested_by,
            'can_resubmit': assignment.can_resubmit,
            
            'submission_status': {
                'submitted': submission is not None,
                'status': 'graded' if submission and submission.grade is not None else ('submitted' if submission else 'not_submitted'),
                'grade': submission.grade if submission else None,
                'feedback': submission.feedback if submission else None,
                'submitted_at': submission.submitted_at.isoformat() if submission else None,
                'graded_at': submission.graded_at.isoformat() if submission and submission.graded_at else None,
                'grader_name': submission.grader.name if submission and hasattr(submission, 'grader') and submission.grader else None,
            } if submission else {
                'submitted': False,
                'status': 'not_submitted',
                'grade': None,
                'feedback': None,
                'submitted_at': None,
                'graded_at': None,
                'grader_name': None,
            }
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


# --- Student Project Routes ---
@student_bp.route("/projects", methods=["GET"])
@student_required
def get_student_projects():
    """Get all projects for courses the student is enrolled in with submission status"""
    try:
        current_user_id = int(get_jwt_identity())
        
        # Get enrolled course IDs
        enrollments = Enrollment.query.filter_by(student_id=current_user_id).all()
        enrolled_course_ids = [e.course_id for e in enrollments]
        
        # Get all published projects for enrolled courses
        projects = Project.query.filter(
            Project.course_id.in_(enrolled_course_ids),
            Project.is_published == True
        ).order_by(Project.due_date.asc()).all()
        
        result = []
        for project in projects:
            # Get submission status
            submission = ProjectSubmission.query.filter_by(
                project_id=project.id,
                student_id=current_user_id
            ).first()
            
            # Build submission status
            submission_status = {
                'submitted': submission is not None,
                'status': 'not_submitted'
            }
            
            if submission:
                submission_status['id'] = submission.id
                submission_status['submitted_at'] = submission.submitted_at.isoformat()
                submission_status['is_late'] = submission.submitted_at > project.due_date if submission.submitted_at else False
                
                if submission.grade is not None:
                    submission_status['status'] = 'graded'
                    submission_status['grade'] = submission.grade
                    submission_status['feedback'] = submission.feedback
                    submission_status['graded_at'] = submission.graded_at.isoformat() if submission.graded_at else None
                    if submission.grader:
                        submission_status['grader_name'] = submission.grader.full_name
                else:
                    submission_status['status'] = 'submitted'
            else:
                # Check if overdue
                if project.due_date < datetime.utcnow():
                    submission_status['status'] = 'late'
                    days_late = (datetime.utcnow() - project.due_date).days
                    submission_status['days_late'] = days_late
                    submission_status['is_late'] = True
                else:
                    submission_status['is_late'] = False
            
            project_data = project.to_dict()
            project_data['course_title'] = project.course.title
            project_data['submission_status'] = submission_status
            result.append(project_data)
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({"message": "Error fetching projects", "error": str(e)}), 500


@student_bp.route("/projects/<int:project_id>/details", methods=["GET"])
@student_required
def get_student_project_details(project_id):
    """Get detailed project information with submission status"""
    try:
        current_user_id = int(get_jwt_identity())
        
        project = Project.query.get(project_id)
        if not project:
            return jsonify({"message": "Project not found"}), 404
        
        # Verify student is enrolled in the course
        enrollment = Enrollment.query.filter_by(
            student_id=current_user_id,
            course_id=project.course_id
        ).first()
        
        if not enrollment:
            return jsonify({"message": "You are not enrolled in this course"}), 403
        
        # Get submission
        submission = ProjectSubmission.query.filter_by(
            project_id=project_id,
            student_id=current_user_id
        ).first()
        
        result = {
            'project': project.to_dict(include_modules=True),
            'submission': None
        }
        
        result['project']['course_title'] = project.course.title
        
        if submission:
            submission_data = submission.to_dict()
            submission_data['is_late'] = submission.submitted_at > project.due_date if submission.submitted_at else False
            if submission.grader:
                submission_data['grader_name'] = submission.grader.full_name
            result['submission'] = submission_data
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({"message": "Error fetching project details", "error": str(e)}), 500


@student_bp.route("/projects/<int:project_id>/submit", methods=["POST"])
@student_required
def submit_project(project_id):
    """Submit a project"""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        project = Project.query.get(project_id)
        if not project:
            return jsonify({"message": "Project not found"}), 404
        
        # Verify student is enrolled in the course
        enrollment = Enrollment.query.filter_by(
            student_id=current_user_id,
            course_id=project.course_id
        ).first()
        
        if not enrollment:
            return jsonify({"message": "You are not enrolled in this course"}), 403
        
        # Check if already submitted
        existing_submission = ProjectSubmission.query.filter_by(
            project_id=project_id,
            student_id=current_user_id
        ).first()
        
        if existing_submission:
            return jsonify({"message": "Project already submitted"}), 400
        
        # Create submission
        submission = ProjectSubmission(
            project_id=project_id,
            student_id=current_user_id,
            text_content=data.get('text_content'),
            file_path=data.get('file_url')  # Frontend should handle file upload
        )
        
        # Handle team members if collaboration allowed
        if project.collaboration_allowed and data.get('team_members'):
            submission.set_team_members(data['team_members'])
        
        db.session.add(submission)
        db.session.commit()
        
        return jsonify({
            "message": "Project submitted successfully",
            "submission": submission.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error submitting project", "error": str(e)}), 500