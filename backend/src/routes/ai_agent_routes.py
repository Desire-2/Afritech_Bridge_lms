"""
AI Agent API Routes for Afritec Bridge LMS
Provides endpoints for AI-assisted course content generation
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
import logging

from ..models.user_models import db, User
from ..models.course_models import Course, Module, Lesson, Quiz
from ..services.ai_agent_service import ai_agent_service
from ..services.ai.task_manager import task_manager
from ..services.content_auto_save import handle_task_completion

logger = logging.getLogger(__name__)

def instructor_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        try:
            current_user_id = get_jwt_identity()
            logger.info(f"instructor_required check: user_id={current_user_id}")
            
            user = User.query.get(current_user_id)
            if not user:
                logger.warning(f"User not found: {current_user_id}")
                return jsonify({"message": "User not found"}), 403
            
            if not user.role:
                logger.warning(f"User {current_user_id} has no role assigned")
                return jsonify({"message": "No role assigned to user"}), 403
            
            if user.role.name not in ['instructor', 'admin']:
                logger.warning(f"User {current_user_id} has role '{user.role.name}', requires instructor/admin")
                return jsonify({"message": f"Instructor access required. Current role: {user.role.name}"}), 403
            
            logger.info(f"Access granted for user {current_user_id} with role {user.role.name}")
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Error in instructor_required: {str(e)}")
            return jsonify({"message": f"Authentication error: {str(e)}"}), 403
    return decorated_function

ai_agent_bp = Blueprint("ai_agent_bp", __name__, url_prefix="/api/v1/ai-agent")


def _gather_course_context(course_id: int, exclude_module_id: int = None) -> list:
    """
    Gather full course structure with all modules and their lessons for cross-reference.
    Returns a list of dicts suitable for passing to generators as course_context.
    This prevents content duplication across modules and lessons.
    """
    modules = Module.query.filter_by(course_id=course_id).order_by(Module.order).all()
    context = []
    for mod in modules:
        mod_data = {
            'title': mod.title,
            'description': (mod.description or '')[:300],
            'learning_objectives': (mod.learning_objectives or '')[:300],
            'order': mod.order,
            'lessons': [],
        }
        lessons = Lesson.query.filter_by(module_id=mod.id).order_by(Lesson.order).all()
        for les in lessons:
            # Extract a brief content summary from lesson content
            content_summary = ''
            if les.content_data:
                import re
                headers = re.findall(r'^##\s+(.+)$', les.content_data, re.MULTILINE)
                if headers:
                    content_summary = "; ".join(headers[:6])
                else:
                    content_summary = les.content_data[:200].replace('\n', ' ')
            
            mod_data['lessons'].append({
                'title': les.title,
                'description': (les.description or '')[:150],
                'order': les.order,
                'duration_minutes': les.duration_minutes or 0,
                'content_summary': content_summary,
            })
        context.append(mod_data)
    return context


def _make_task_meta(course_id: int = None, module_id: int = None,
                    course_title: str = '', **extra) -> dict:
    """
    Build the metadata dict passed to the on_complete callback.
    Includes the Flask app reference so the callback can push an app context
    in the background thread.
    """
    from flask import current_app
    meta = {
        '_flask_app': current_app._get_current_object(),
        'course_id': course_id,
        'module_id': module_id,
        'course_title': course_title,
        'auto_save': True,
    }
    meta.update(extra)
    return meta


# =====================
# ENHANCED HEALTH & STATUS
# =====================

@ai_agent_bp.route("/health", methods=["GET"])
def health_check():
    """
    Enhanced health check for AI Agent services with detailed status information
    """
    try:
        # Get comprehensive provider statistics
        stats = ai_agent_service.get_provider_stats()
        
        # Check if providers are configured
        openrouter_configured = bool(ai_agent_service.provider.openrouter_api_key)
        gemini_configured = bool(ai_agent_service.provider.gemini_api_key)
        
        # Determine overall health status
        if openrouter_configured or gemini_configured:
            status = "healthy"
            message = "AI Agent service is operational"
            api_configured = True
        else:
            status = "degraded"
            message = "No AI providers configured"
            api_configured = False
        
        return jsonify({
            "status": status,
            "api_configured": api_configured,
            "message": message,
            "providers": {
                "openrouter": {
                    "configured": openrouter_configured,
                    "current": ai_agent_service.provider.current_provider == 'openrouter'
                },
                "gemini": {
                    "configured": gemini_configured,
                    "current": ai_agent_service.provider.current_provider == 'gemini'
                }
            },
            "statistics": stats,
            "features": {
                "smart_caching": True,
                "progress_tracking": True,
                "quality_validation": True,
                "retry_logic": True
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            "status": "unhealthy",
            "api_configured": False,
            "message": f"Health check failed: {str(e)}",
            "error": str(e)
        }), 500

@ai_agent_bp.route("/progress/<session_id>", methods=["GET"])
def get_progress(session_id):
    """
    Get progress for a specific generation session
    """
    try:
        progress = ai_agent_service.get_progress(session_id)
        if progress:
            return jsonify({
                "success": True,
                "data": progress
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": "Session not found"
            }), 404
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Failed to get progress: {str(e)}"
        }), 500

@ai_agent_bp.route("/active-sessions", methods=["GET"])
@instructor_required
def get_active_sessions():
    """
    Get all active generation sessions for monitoring
    """
    try:
        sessions = ai_agent_service.get_all_active_sessions()
        return jsonify({
            "success": True,
            "data": sessions,
            "count": len(sessions)
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Failed to get sessions: {str(e)}"
        }), 500

@ai_agent_bp.route("/cancel-session/<session_id>", methods=["DELETE"])
@instructor_required
def cancel_session(session_id):
    """
    Cancel a specific generation session
    """
    try:
        cancelled = ai_agent_service.cancel_session(session_id)
        if cancelled:
            return jsonify({
                "success": True,
                "message": "Session cancelled successfully"
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": "Session not found"
            }), 404
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Failed to cancel session: {str(e)}"
        }), 500

@ai_agent_bp.route("/cache/stats", methods=["GET"])
@instructor_required
def get_cache_stats():
    """
    Get detailed cache statistics
    """
    try:
        stats = ai_agent_service.get_provider_stats()
        return jsonify({
            "success": True,
            "data": stats
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Failed to get cache stats: {str(e)}"
        }), 500

@ai_agent_bp.route("/cache/clear", methods=["POST"])
@instructor_required
def clear_cache():
    """
    Clear all caches
    """
    try:
        ai_agent_service.clear_cache()
        return jsonify({
            "success": True,
            "message": "All caches cleared successfully"
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Failed to clear cache: {str(e)}"
        }), 500

@ai_agent_bp.route("/provider/force", methods=["POST"])
@instructor_required
def force_provider():
    """
    Force switch to a specific AI provider
    
    Request body:
    {
        "provider": "openrouter" | "gemini"
    }
    """
    try:
        data = request.get_json()
        provider = data.get('provider')
        
        if provider not in ['openrouter', 'gemini']:
            return jsonify({
                "success": False,
                "message": "Invalid provider. Use 'openrouter' or 'gemini'"
            }), 400
        
        ai_agent_service.force_provider(provider)
        return jsonify({
            "success": True,
            "message": f"Switched to provider: {provider}"
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Failed to switch provider: {str(e)}"
        }), 500

# =====================
# BACKGROUND TASK MANAGEMENT
# =====================

@ai_agent_bp.route("/task/<task_id>/status", methods=["GET"])
@instructor_required
def get_task_status(task_id):
    """Poll status/progress of a background generation task"""
    try:
        status = task_manager.get_task_status(task_id)
        if not status:
            return jsonify({"success": False, "message": "Task not found"}), 404
        return jsonify({"success": True, "data": status}), 200
    except Exception as e:
        logger.error(f"Error getting task status: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@ai_agent_bp.route("/task/<task_id>/result", methods=["GET"])
@instructor_required
def get_task_result(task_id):
    """Get the final result of a completed background task"""
    try:
        status_info = task_manager.get_task_status(task_id)
        if not status_info:
            return jsonify({"success": False, "message": "Task not found"}), 404
        
        task_status = status_info.get('status')
        
        if task_status == 'completed':
            result = task_manager.get_task_result(task_id)
            if result:
                return jsonify(result), 200
            return jsonify({"success": False, "message": "Result not available"}), 404
        elif task_status == 'failed':
            return jsonify({
                "success": False, "status": "error",
                "message": status_info.get('error', 'Task failed'),
            }), 500
        elif task_status == 'cancelled':
            return jsonify({
                "success": False, "status": "cancelled",
                "message": "Task was cancelled",
            }), 200
        else:
            return jsonify({
                "success": False, "status": task_status,
                "message": "Task is still running",
                "progress": status_info.get('progress', 0),
            }), 202
    except Exception as e:
        logger.error(f"Error getting task result: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@ai_agent_bp.route("/task/<task_id>/cancel", methods=["POST"])
@instructor_required
def cancel_task(task_id):
    """Cancel a running background task"""
    try:
        cancelled = task_manager.cancel_task(task_id)
        if cancelled:
            return jsonify({"success": True, "message": "Task cancelled"}), 200
        return jsonify({"success": False, "message": "Task not found"}), 404
    except Exception as e:
        logger.error(f"Error cancelling task: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@ai_agent_bp.route("/task/active", methods=["GET"])
@instructor_required
def get_user_active_tasks():
    """Get all active tasks for the current user"""
    try:
        current_user_id = get_jwt_identity()
        tasks = task_manager.get_user_tasks(current_user_id)
        return jsonify({"success": True, "data": tasks, "count": len(tasks)}), 200
    except Exception as e:
        logger.error(f"Error getting active tasks: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# =====================
# COURSE GENERATION
# =====================

@ai_agent_bp.route("/generate-course-outline", methods=["POST"])
@instructor_required
def generate_course_outline():
    """
    Generate AI-powered course outline based on topic and requirements
    
    Request body:
    {
        "topic": "Machine Learning Basics",
        "target_audience": "Beginners with programming background",
        "learning_objectives": "Understand ML algorithms and implement them",
        "background": true  // optional: run in background, returns task_id
    }
    """
    try:
        data = request.get_json()
        
        if not data or not data.get('topic'):
            return jsonify({"message": "Topic is required"}), 400
        
        topic = data['topic']
        target_audience = data.get('target_audience', '')
        learning_objectives = data.get('learning_objectives', '')
        background = data.get('background', False)
        
        logger.info(f"Generating course outline for topic: {topic} (background={background})")
        
        # Background mode: return task_id immediately
        if background:
            current_user_id = get_jwt_identity()
            task_id = task_manager.submit_task(
                task_type='generate-course-outline',
                task_func=ai_agent_service.run_single_step_background,
                kwargs={
                    'method_name': 'generate_course_outline',
                    'method_kwargs': {
                        'topic': topic,
                        'target_audience': target_audience,
                        'learning_objectives': learning_objectives,
                    }
                },
                total_steps=1,
                user_id=current_user_id,
                on_complete=handle_task_completion,
                task_meta=_make_task_meta(course_title=topic),
            )
            return jsonify({
                "success": True, "background": True,
                "task_id": task_id, "status": "pending",
                "message": "Course outline generation started in background"
            }), 202
        
        ai_response = ai_agent_service.generate_course_outline(
            topic=topic,
            target_audience=target_audience,
            learning_objectives=learning_objectives
        )
        
        # Convert AIResponse to API response format
        response_data = ai_response.to_dict()
        
        if ai_response.status.value in ['success', 'partial_success']:
            return jsonify(response_data), 200
        else:
            return jsonify(response_data), 500
        
    except Exception as e:
        logger.error(f"Error generating course outline: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate course outline",
            "error": str(e)
        }), 500


# =====================
# MODULE GENERATION
# =====================

@ai_agent_bp.route("/generate-multiple-modules", methods=["POST"])
@instructor_required
def generate_multiple_modules():
    """
    Generate AI-powered multiple module outlines for a course
    
    Request body:
    {
        "course_id": 1,
        "num_modules": 5 (optional, defaults based on course)
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id'):
            return jsonify({"message": "Course ID is required"}), 400
        
        course_id = data['course_id']
        num_modules = data.get('num_modules', 5)
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Fetch existing modules for context
        existing_modules = Module.query.filter_by(course_id=course_id).order_by(Module.order).all()
        existing_modules_context = [{
            "title": module.title,
            "description": module.description or "",
            "learning_objectives": module.learning_objectives or "",
            "order": module.order
        } for module in existing_modules]
        
        logger.info(f"Generating {num_modules} modules for course: {course.title} with {len(existing_modules)} existing modules")
        
        # Gather full course context including lesson-level details for deduplication
        course_context = _gather_course_context(course_id)
        
        background = data.get('background', False)
        
        # Background mode: stepwise generation with delays
        if background:
            task_id = task_manager.submit_task(
                task_type='generate-multiple-modules',
                task_func=ai_agent_service.generate_multiple_modules_stepwise,
                kwargs={
                    'course_title': course.title,
                    'course_description': course.description or '',
                    'course_objectives': course.learning_objectives or '',
                    'num_modules': num_modules,
                    'existing_modules': existing_modules_context,
                    'course_context': course_context,
                },
                total_steps=num_modules,
                user_id=current_user_id,
                on_complete=handle_task_completion,
                task_meta=_make_task_meta(course_id=course_id, course_title=course.title),
            )
            return jsonify({
                "success": True, "background": True,
                "task_id": task_id, "status": "pending",
                "message": f"Generating {num_modules} modules step by step in background"
            }), 202
        
        ai_response = ai_agent_service.generate_multiple_modules(
            course_title=course.title,
            course_description=course.description or '',
            course_objectives=course.learning_objectives or '',
            num_modules=num_modules,
            existing_modules=existing_modules_context,
            course_context=course_context
        )
        
        # Convert AIResponse to API response format
        response_data = ai_response.to_dict()
        
        if ai_response.status.value in ['success', 'partial_success']:
            return jsonify(response_data), 200
        else:
            return jsonify(response_data), 500
        
    except Exception as e:
        logger.error(f"Error generating multiple modules: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate multiple modules",
            "error": str(e)
        }), 500

@ai_agent_bp.route("/generate-module-content", methods=["POST"])
@instructor_required
def generate_module_content():
    """
    Generate AI-powered module content based on course context
    
    Request body:
    {
        "course_id": 1,
        "module_title": "Introduction to Python" (optional)
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id'):
            return jsonify({"message": "Course ID is required"}), 400
        
        course_id = data['course_id']
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        module_title = data.get('module_title', '')
        
        # Fetch existing modules for context
        existing_modules = Module.query.filter_by(course_id=course_id).order_by(Module.order).all()
        existing_modules_context = [{
            "title": module.title,
            "description": module.description or "",
            "learning_objectives": module.learning_objectives or "",
            "order": module.order
        } for module in existing_modules]
        
        logger.info(f"Generating module content for course: {course.title} with {len(existing_modules)} existing modules")
        
        # Gather full course context including lesson-level details for deduplication
        course_context = _gather_course_context(course_id)
        
        background = data.get('background', False)
        
        if background:
            current_user_id_bg = get_jwt_identity()
            task_id = task_manager.submit_task(
                task_type='generate-module-content',
                task_func=ai_agent_service.run_single_step_background,
                kwargs={
                    'method_name': 'generate_module_content',
                    'method_kwargs': {
                        'course_title': course.title,
                        'course_description': course.description or '',
                        'course_objectives': course.learning_objectives or '',
                        'module_title': module_title,
                        'existing_modules': existing_modules_context,
                        'course_context': course_context,
                    }
                },
                total_steps=1,
                user_id=current_user_id_bg,
                on_complete=handle_task_completion,
                task_meta=_make_task_meta(course_id=course_id, course_title=course.title),
            )
            return jsonify({
                "success": True, "background": True,
                "task_id": task_id, "status": "pending",
                "message": "Module content generation started in background"
            }), 202
        
        ai_response = ai_agent_service.generate_module_content(
            course_title=course.title,
            course_description=course.description or '',
            course_objectives=course.learning_objectives or '',
            module_title=module_title,
            existing_modules=existing_modules_context,
            course_context=course_context
        )
        
        # Convert AIResponse to API response format
        response_data = ai_response.to_dict()
        
        if ai_response.status.value in ['success', 'partial_success']:
            return jsonify(response_data), 200
        else:
            return jsonify(response_data), 500
        
    except Exception as e:
        logger.error(f"Error generating module content: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate module content",
            "error": str(e)
        }), 500


# =====================
# LESSON GENERATION
# =====================

@ai_agent_bp.route("/generate-multiple-lessons", methods=["POST"])
@instructor_required
def generate_multiple_lessons():
    """
    Generate AI-powered multiple lesson outlines for a module
    
    Request body:
    {
        "course_id": 1,
        "module_id": 2,
        "num_lessons": 5 (optional, defaults to 5)
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id') or not data.get('module_id'):
            return jsonify({"message": "Course ID and Module ID are required"}), 400
        
        course_id = data['course_id']
        module_id = data['module_id']
        num_lessons = data.get('num_lessons', 5)
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Get module
        module = Module.query.filter_by(id=module_id, course_id=course_id).first()
        if not module:
            return jsonify({"message": "Module not found"}), 404
        
        # Get existing lessons in this module for context
        existing_lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
        existing_lessons_data = [{
            'title': lesson.title,
            'description': lesson.description or '',
            'order': lesson.order,
            'duration_minutes': lesson.duration_minutes or 0
        } for lesson in existing_lessons]
        
        # Gather full course context for cross-module awareness
        course_context = _gather_course_context(course_id)
        
        logger.info(f"Generating {num_lessons} lessons for module: {module.title} (existing lessons: {len(existing_lessons)}, course modules: {len(course_context)})")
        
        background = data.get('background', False)
        
        # Background mode: deep stepwise generation with cross-module context
        if background:
            task_id = task_manager.submit_task(
                task_type='generate-multiple-lessons',
                task_func=ai_agent_service.generate_multiple_lessons_deep_stepwise,
                kwargs={
                    'course_title': course.title,
                    'module_title': module.title,
                    'module_description': module.description or '',
                    'module_objectives': module.learning_objectives or '',
                    'num_lessons': num_lessons,
                    'existing_lessons': existing_lessons_data,
                    'course_context': course_context,
                },
                total_steps=num_lessons,
                user_id=current_user_id,
                on_complete=handle_task_completion,
                task_meta=_make_task_meta(course_id=course_id, module_id=module_id, course_title=course.title),
            )
            return jsonify({
                "success": True, "background": True,
                "task_id": task_id, "status": "pending",
                "message": f"Generating {num_lessons} lessons step by step with cross-module context"
            }), 202
        
        result = ai_agent_service.generate_multiple_lessons(
            course_title=course.title,
            module_title=module.title,
            module_description=module.description or '',
            module_objectives=module.learning_objectives or '',
            num_lessons=num_lessons,
            existing_lessons=existing_lessons_data,
            course_context=course_context,
        )
        
        # Convert AIResponse to dict for JSON serialization
        response_data = result.to_dict()
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error generating multiple lessons: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate multiple lessons",
            "error": str(e)
        }), 500

@ai_agent_bp.route("/generate-lesson-content", methods=["POST"])
@instructor_required
def generate_lesson_content():
    """
    Generate AI-powered lesson content based on module context
    
    Request body:
    {
        "course_id": 1,
        "module_id": 2,
        "lesson_title": "Variables and Data Types" (optional),
        "lesson_description": "Learn about Python variables" (optional)
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id') or not data.get('module_id'):
            return jsonify({"message": "Course ID and Module ID are required"}), 400
        
        course_id = data['course_id']
        module_id = data['module_id']
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Get module
        module = Module.query.filter_by(id=module_id, course_id=course_id).first()
        if not module:
            return jsonify({"message": "Module not found"}), 404
        
        # Get existing lessons in this module for context
        existing_lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
        existing_lessons_data = [{
            'title': lesson.title,
            'description': lesson.description or '',
            'order': lesson.order,
            'duration_minutes': lesson.duration_minutes or 0
        } for lesson in existing_lessons]
        
        lesson_title = data.get('lesson_title', '')
        lesson_description = data.get('lesson_description', '')
        
        logger.info(f"Generating lesson content for module: {module.title} (existing lessons: {len(existing_lessons)})")
        
        # Gather cross-module course context for deduplication
        course_context = _gather_course_context(course_id)
        
        background = data.get('background', False)
        
        if background:
            # Use deep stepwise generation for higher quality
            task_id = task_manager.submit_task(
                task_type='generate-lesson-content',
                task_func=ai_agent_service.generate_lesson_content_deep_stepwise,
                kwargs={
                    'course_title': course.title,
                    'module_title': module.title,
                    'module_description': module.description or '',
                    'module_objectives': module.learning_objectives or '',
                    'lesson_title': lesson_title,
                    'lesson_description': lesson_description,
                    'existing_lessons': existing_lessons_data,
                    'course_context': course_context,
                },
                total_steps=5,
                user_id=current_user_id,
                on_complete=handle_task_completion,
                task_meta=_make_task_meta(course_id=course_id, module_id=module_id, course_title=course.title),
            )
            return jsonify({
                "success": True, "background": True,
                "task_id": task_id, "status": "pending",
                "message": "Deep lesson content generation started in background (outline → sections → enhance)"
            }), 202
        
        ai_response = ai_agent_service.generate_lesson_content(
            course_title=course.title,
            module_title=module.title,
            module_description=module.description or '',
            module_objectives=module.learning_objectives or '',
            lesson_title=lesson_title,
            lesson_description=lesson_description,
            existing_lessons=existing_lessons_data,
            course_context=course_context,
        )
        
        # Convert AIResponse to API response format
        response_data = ai_response.to_dict()
        
        if ai_response.status.value in ['success', 'partial_success']:
            return jsonify(response_data), 200
        else:
            return jsonify(response_data), 500
        
    except Exception as e:
        logger.error(f"Error generating lesson content: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate lesson content",
            "error": str(e)
        }), 500


@ai_agent_bp.route("/generate-comprehensive-lesson", methods=["POST"])
@instructor_required
def generate_comprehensive_lesson():
    """
    Generate AI-powered COMPREHENSIVE professor-level lesson with step-by-step generation and validation
    
    This endpoint generates a complete, academically rigorous lesson with:
    - Detailed lesson outline and structure
    - Engaging introduction
    - Comprehensive theoretical foundation
    - Practical applications and examples
    - Practice exercises and assessments
    - Summary and additional resources
    
    Each section is generated separately with quality validation.
    
    Request body:
    {
        "course_id": 1,
        "module_id": 2,
        "lesson_title": "Advanced Python Decorators",
        "lesson_description": "Master the art of Python decorators" (optional),
        "difficulty_level": "intermediate" (optional: "beginner", "intermediate", "advanced")
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id') or not data.get('module_id'):
            return jsonify({"message": "Course ID and Module ID are required"}), 400
        
        if not data.get('lesson_title'):
            return jsonify({"message": "Lesson title is required"}), 400
        
        course_id = data['course_id']
        module_id = data['module_id']
        lesson_title = data['lesson_title']
        lesson_description = data.get('lesson_description', '')
        difficulty_level = data.get('difficulty_level', 'intermediate')
        
        # Validate difficulty level
        if difficulty_level not in ['beginner', 'intermediate', 'advanced']:
            return jsonify({"message": "Invalid difficulty_level. Must be 'beginner', 'intermediate', or 'advanced'"}), 400
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Get module
        module = Module.query.filter_by(id=module_id, course_id=course_id).first()
        if not module:
            return jsonify({"message": "Module not found"}), 404
        
        # Get existing lessons in this module for context
        existing_lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
        existing_lessons_data = [{
            'title': lesson.title,
            'description': lesson.description or '',
            'order': lesson.order,
            'duration_minutes': lesson.duration_minutes or 0
        } for lesson in existing_lessons]
        
        logger.info(f"Generating COMPREHENSIVE lesson: {lesson_title} for module: {module.title} (difficulty: {difficulty_level}, existing lessons: {len(existing_lessons)})")
        
        # Gather cross-module course context for deduplication
        course_context = _gather_course_context(course_id)
        
        background = data.get('background', False)
        
        if background:
            # Use deep stepwise for comprehensive generation
            task_id = task_manager.submit_task(
                task_type='generate-comprehensive-lesson',
                task_func=ai_agent_service.generate_lesson_content_deep_stepwise,
                kwargs={
                    'course_title': course.title,
                    'module_title': module.title,
                    'module_description': module.description or '',
                    'module_objectives': module.learning_objectives or '',
                    'lesson_title': lesson_title,
                    'lesson_description': lesson_description,
                    'existing_lessons': existing_lessons_data,
                    'course_context': course_context,
                },
                total_steps=6,
                user_id=current_user_id,
                on_complete=handle_task_completion,
                task_meta=_make_task_meta(course_id=course_id, module_id=module_id, course_title=course.title),
            )
            return jsonify({
                "success": True, "background": True,
                "task_id": task_id, "status": "pending",
                "message": "Comprehensive lesson generation started in background (deep stepwise)"
            }), 202
        
        # Sync mode: use the enhanced generation method with validation
        result = ai_agent_service.generate_comprehensive_lesson_with_validation(
            course_title=course.title,
            module_title=module.title,
            module_description=module.description or '',
            module_objectives=module.learning_objectives or '',
            lesson_title=lesson_title,
            lesson_description=lesson_description,
            difficulty_level=difficulty_level,
            existing_lessons=existing_lessons_data
        )
        
        # Convert AIResponse to dict for JSON serialization
        response_data = result.to_dict()
        if result.data and 'quality_metrics' in result.data:
            response_data['message'] = f"Comprehensive lesson generated successfully with quality score: {result.data.get('quality_metrics', {}).get('average_score', 0):.1f}/100"
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error generating comprehensive lesson: {e}", exc_info=True)
        return jsonify({
            "success": False,
            "message": "Failed to generate comprehensive lesson",
            "error": str(e)
        }), 500


# =====================
# QUIZ GENERATION
# =====================

@ai_agent_bp.route("/generate-quiz-questions", methods=["POST"])
@instructor_required
def generate_quiz_questions():
    """
    Generate AI-powered quiz questions based on lesson content
    
    Request body:
    {
        "course_id": 1,
        "module_id": 2,
        "lesson_id": 3,
        "num_questions": 5,
        "question_types": ["multiple_choice", "true_false"]
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id') or not data.get('module_id'):
            return jsonify({"message": "Course ID and Module ID are required"}), 400
        
        course_id = data['course_id']
        module_id = data['module_id']
        lesson_id = data.get('lesson_id')
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Get module
        module = Module.query.filter_by(id=module_id, course_id=course_id).first()
        if not module:
            return jsonify({"message": "Module not found"}), 404
        
        # Get lesson content if lesson_id provided
        lesson = None
        lesson_content = ""
        if lesson_id:
            lesson = Lesson.query.filter_by(id=lesson_id, module_id=module_id).first()
            if lesson:
                lesson_content = lesson.content_data or ""
        
        # If no specific lesson, use module description as context
        if not lesson_content:
            lesson_content = f"{module.description}\n\nLearning Objectives:\n{module.learning_objectives}"
        
        num_questions = data.get('num_questions', 5)
        question_types = data.get('question_types', ['multiple_choice', 'true_false'])
        
        logger.info(f"Generating {num_questions} quiz questions for module: {module.title}")
        
        background = data.get('background', False)
        
        if background:
            task_id = task_manager.submit_task(
                task_type='generate-quiz-questions',
                task_func=ai_agent_service.run_single_step_background,
                kwargs={
                    'method_name': 'generate_quiz_questions',
                    'method_kwargs': {
                        'course_title': course.title,
                        'module_title': module.title,
                        'lesson_title': lesson.title if lesson else module.title,
                        'lesson_content': lesson_content,
                        'num_questions': num_questions,
                        'question_types': question_types,
                    }
                },
                total_steps=1,
                user_id=current_user_id,
                on_complete=handle_task_completion,
                task_meta=_make_task_meta(course_id=course_id, module_id=module_id, course_title=course.title),
            )
            return jsonify({
                "success": True, "background": True,
                "task_id": task_id, "status": "pending",
                "message": f"Generating {num_questions} quiz questions in background"
            }), 202
        
        result = ai_agent_service.generate_quiz_questions(
            course_title=course.title,
            module_title=module.title,
            lesson_title=lesson.title if lesson else module.title,
            lesson_content=lesson_content,
            num_questions=num_questions,
            question_types=question_types
        )
        
        # Convert AIResponse to dict for JSON serialization
        response_data = result.to_dict()
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error generating quiz questions: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate quiz questions",
            "error": str(e)
        }), 500


# =====================
# ASSIGNMENT GENERATION
# =====================

@ai_agent_bp.route("/generate-assignment", methods=["POST"])
@instructor_required
def generate_assignment():
    """
    Generate AI-powered assignment based on module content
    
    Request body:
    {
        "course_id": 1,
        "module_id": 2
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id') or not data.get('module_id'):
            return jsonify({"message": "Course ID and Module ID are required"}), 400
        
        course_id = data['course_id']
        module_id = data['module_id']
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Get module
        module = Module.query.filter_by(id=module_id, course_id=course_id).first()
        if not module:
            return jsonify({"message": "Module not found"}), 404
        
        # Get lessons summary
        lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
        lessons_summary = "\n".join([f"- {lesson.title}: {lesson.description or 'No description'}" 
                                    for lesson in lessons]) if lessons else "No lessons yet"
        
        logger.info(f"Generating assignment for module: {module.title}")
        
        background = data.get('background', False)
        
        if background:
            task_id = task_manager.submit_task(
                task_type='generate-assignment',
                task_func=ai_agent_service.run_single_step_background,
                kwargs={
                    'method_name': 'generate_assignment',
                    'method_kwargs': {
                        'course_title': course.title,
                        'module_title': module.title,
                        'module_description': module.description or '',
                        'lessons_summary': lessons_summary,
                    }
                },
                total_steps=1,
                user_id=current_user_id,
                on_complete=handle_task_completion,
                task_meta=_make_task_meta(course_id=course_id, module_id=module_id, course_title=course.title),
            )
            return jsonify({
                "success": True, "background": True,
                "task_id": task_id, "status": "pending",
                "message": "Assignment generation started in background"
            }), 202
        
        result = ai_agent_service.generate_assignment(
            course_title=course.title,
            module_title=module.title,
            module_description=module.description or '',
            lessons_summary=lessons_summary
        )
        
        # Convert AIResponse to dict for JSON serialization
        response_data = result.to_dict()
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error generating assignment: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate assignment",
            "error": str(e)
        }), 500


# =====================
# FINAL PROJECT GENERATION
# =====================

@ai_agent_bp.route("/generate-final-project", methods=["POST"])
@instructor_required
def generate_final_project():
    """
    Generate AI-powered final/capstone project for entire course
    
    Request body:
    {
        "course_id": 1
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id'):
            return jsonify({"message": "Course ID is required"}), 400
        
        course_id = data['course_id']
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Get modules summary
        modules = Module.query.filter_by(course_id=course_id).order_by(Module.order).all()
        modules_summary = "\n".join([f"- {module.title}: {module.description or 'No description'}" 
                                    for module in modules]) if modules else "No modules yet"
        
        logger.info(f"Generating final project for course: {course.title}")
        
        background = data.get('background', False)
        
        if background:
            task_id = task_manager.submit_task(
                task_type='generate-final-project',
                task_func=ai_agent_service.run_single_step_background,
                kwargs={
                    'method_name': 'generate_final_project',
                    'method_kwargs': {
                        'course_title': course.title,
                        'course_description': course.description or '',
                        'course_objectives': course.learning_objectives or '',
                        'modules_summary': modules_summary,
                    }
                },
                total_steps=1,
                user_id=current_user_id,
                on_complete=handle_task_completion,
                task_meta=_make_task_meta(course_id=course_id, course_title=course.title),
            )
            return jsonify({
                "success": True, "background": True,
                "task_id": task_id, "status": "pending",
                "message": "Final project generation started in background"
            }), 202
        
        result = ai_agent_service.generate_final_project(
            course_title=course.title,
            course_description=course.description or '',
            course_objectives=course.learning_objectives or '',
            modules_summary=modules_summary
        )
        
        # Convert AIResponse to dict for JSON serialization
        response_data = result.to_dict()
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error generating final project: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate final project",
            "error": str(e)
        }), 500


# =====================
# CONTENT ENHANCEMENT
# =====================

@ai_agent_bp.route("/generate-quiz-from-content", methods=["POST"])
@instructor_required
def generate_quiz_from_content():
    """
    Generate quiz based on actual lesson or module content
    
    Request body:
    {
        "course_id": 1,
        "content_type": "lesson" or "module",
        "lesson_id": 3 (if content_type is lesson),
        "module_id": 2 (if content_type is module),
        "num_questions": 10,
        "difficulty": "mixed" (easy, medium, hard, or mixed)
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id'):
            return jsonify({"message": "Course ID is required"}), 400
        
        course_id = data['course_id']
        content_type = data.get('content_type', 'lesson')
        num_questions = data.get('num_questions', 10)
        difficulty = data.get('difficulty', 'mixed')
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        content_text = ""
        content_title = ""
        
        if content_type == 'lesson':
            lesson_id = data.get('lesson_id')
            if not lesson_id:
                return jsonify({"message": "Lesson ID is required for lesson-based quiz"}), 400
            
            lesson = Lesson.query.get(lesson_id)
            if not lesson or lesson.module.course_id != course_id:
                return jsonify({"message": "Lesson not found or access denied"}), 404
            
            content_text = lesson.content_data or ""
            content_title = lesson.title
            
            if not content_text:
                return jsonify({"message": "Lesson has no content to generate quiz from"}), 400
        
        elif content_type == 'module':
            module_id = data.get('module_id')
            if not module_id:
                return jsonify({"message": "Module ID is required for module-based quiz"}), 400
            
            module = Module.query.filter_by(id=module_id, course_id=course_id).first()
            if not module:
                return jsonify({"message": "Module not found"}), 404
            
            # Combine all lessons content from the module
            lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
            if not lessons:
                return jsonify({"message": "Module has no lessons to generate quiz from"}), 400
            
            content_parts = [f"# Module: {module.title}\n\n{module.description or ''}\n\nLearning Objectives:\n{module.learning_objectives or ''}"]
            for lesson in lessons:
                if lesson.content_data:
                    content_parts.append(f"\n\n## {lesson.title}\n\n{lesson.content_data}")
            
            content_text = "\n".join(content_parts)
            content_title = module.title
        
        else:
            return jsonify({"message": "Invalid content_type. Must be 'lesson' or 'module'"}), 400
        
        logger.info(f"Generating quiz from {content_type}: {content_title} ({num_questions} questions, {difficulty} difficulty)")
        
        # Always use background task to avoid Gunicorn worker timeout
        task_id = task_manager.submit_task(
            task_type='generate-quiz-from-content',
            task_func=ai_agent_service.run_single_step_background,
            kwargs={
                'method_name': 'generate_quiz_from_content',
                'method_kwargs': {
                    'lesson_or_module_content': content_text,
                    'content_title': content_title,
                    'content_type': content_type,
                    'num_questions': num_questions,
                    'difficulty': difficulty,
                }
            },
            total_steps=1,
            user_id=current_user_id,
            on_complete=handle_task_completion,
            task_meta=_make_task_meta(course_id=course_id, module_id=data.get('module_id'), course_title=course.title),
        )
        return jsonify({
            "success": True, "background": True,
            "task_id": task_id, "status": "pending",
            "message": f"Generating {num_questions} quiz questions in background"
        }), 202
        
    except Exception as e:
        logger.error(f"Error generating quiz from content: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate quiz from content",
            "error": str(e)
        }), 500


@ai_agent_bp.route("/generate-assignment-from-content", methods=["POST"])
@instructor_required
def generate_assignment_from_content():
    """
    Generate assignment based on actual lesson or module content
    
    Request body:
    {
        "course_id": 1,
        "content_type": "lesson" or "module",
        "lesson_id": 3 (if content_type is lesson),
        "module_id": 2 (if content_type is module),
        "assignment_type": "practical" (practical, theoretical, project, or mixed)
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id'):
            return jsonify({"message": "Course ID is required"}), 400
        
        course_id = data['course_id']
        content_type = data.get('content_type', 'lesson')
        assignment_type = data.get('assignment_type', 'practical')
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        content_text = ""
        content_title = ""
        
        if content_type == 'lesson':
            lesson_id = data.get('lesson_id')
            if not lesson_id:
                return jsonify({"message": "Lesson ID is required for lesson-based assignment"}), 400
            
            lesson = Lesson.query.get(lesson_id)
            if not lesson or lesson.module.course_id != course_id:
                return jsonify({"message": "Lesson not found or access denied"}), 404
            
            content_text = lesson.content_data or ""
            content_title = lesson.title
            
            if not content_text:
                return jsonify({"message": "Lesson has no content to generate assignment from"}), 400
        
        elif content_type == 'module':
            module_id = data.get('module_id')
            if not module_id:
                return jsonify({"message": "Module ID is required for module-based assignment"}), 400
            
            module = Module.query.filter_by(id=module_id, course_id=course_id).first()
            if not module:
                return jsonify({"message": "Module not found"}), 404
            
            # Combine all lessons content from the module
            lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
            if not lessons:
                return jsonify({"message": "Module has no lessons to generate assignment from"}), 400
            
            content_parts = [f"# Module: {module.title}\n\n{module.description or ''}\n\nLearning Objectives:\n{module.learning_objectives or ''}"]
            for lesson in lessons:
                if lesson.content_data:
                    content_parts.append(f"\n\n## {lesson.title}\n\n{lesson.content_data}")
            
            content_text = "\n".join(content_parts)
            content_title = module.title
        
        else:
            return jsonify({"message": "Invalid content_type. Must be 'lesson' or 'module'"}), 400
        
        logger.info(f"Generating {assignment_type} assignment from {content_type}: {content_title}")
        
        # Always use background task to avoid Gunicorn worker timeout
        task_id = task_manager.submit_task(
            task_type='generate-assignment-from-content',
            task_func=ai_agent_service.run_single_step_background,
            kwargs={
                'method_name': 'generate_assignment_from_content',
                'method_kwargs': {
                    'lesson_or_module_content': content_text,
                    'content_title': content_title,
                    'content_type': content_type,
                    'assignment_type': assignment_type,
                }
            },
            total_steps=1,
            user_id=current_user_id,
            on_complete=handle_task_completion,
            task_meta=_make_task_meta(course_id=course_id, module_id=data.get('module_id'), course_title=course.title),
        )
        return jsonify({
            "success": True, "background": True,
            "task_id": task_id, "status": "pending",
            "message": f"Generating {assignment_type} assignment in background"
        }), 202
        
    except Exception as e:
        logger.error(f"Error generating assignment from content: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate assignment from content",
            "error": str(e)
        }), 500


@ai_agent_bp.route("/generate-project-from-content", methods=["POST"])
@instructor_required
def generate_project_from_content():
    """
    Generate project based on actual module content
    
    Request body:
    {
        "course_id": 1,
        "module_id": 2
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id') or not data.get('module_id'):
            return jsonify({"message": "Course ID and Module ID are required"}), 400
        
        course_id = data['course_id']
        module_id = data['module_id']
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        module = Module.query.filter_by(id=module_id, course_id=course_id).first()
        if not module:
            return jsonify({"message": "Module not found"}), 404
        
        # Get all lessons with content
        lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
        if not lessons:
            return jsonify({"message": "Module has no lessons to generate project from"}), 400
        
        module_contents = []
        for lesson in lessons:
            if lesson.content_data:
                module_contents.append({
                    "title": lesson.title,
                    "content": lesson.content_data
                })
        
        if not module_contents:
            return jsonify({"message": "Module lessons have no content to generate project from"}), 400
        
        logger.info(f"Generating project from module: {module.title} ({len(module_contents)} lessons)")
        
        # Always use background task to avoid Gunicorn worker timeout
        task_id = task_manager.submit_task(
            task_type='generate-project-from-content',
            task_func=ai_agent_service.run_single_step_background,
            kwargs={
                'method_name': 'generate_project_from_content',
                'method_kwargs': {
                    'module_contents': module_contents,
                    'module_title': module.title,
                    'course_title': course.title,
                }
            },
            total_steps=1,
            user_id=current_user_id,
            on_complete=handle_task_completion,
            task_meta=_make_task_meta(course_id=course_id, module_id=module_id, course_title=course.title),
        )
        return jsonify({
            "success": True, "background": True,
            "task_id": task_id, "status": "pending",
            "message": f"Generating project from {module.title} in background"
        }), 202
        
    except Exception as e:
        logger.error(f"Error generating project from content: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate project from content",
            "error": str(e)
        }), 500


# =====================
# ORIGINAL CONTENT ENHANCEMENT
# =====================

@ai_agent_bp.route("/enhance-content", methods=["POST"])
@instructor_required
def enhance_content():
    """
    Enhance existing content using AI
    
    Request body:
    {
        "content_type": "lesson",
        "current_content": "...",
        "enhancement_type": "improve" | "expand" | "simplify" | "add_examples",
        "course_id": 1 (optional - for cross-module context),
        "course_title": "Python Programming" (optional),
        "module_title": "Module 1" (optional),
        "lesson_title": "Lesson 1" (optional),
        "background": true (optional - for background processing)
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('content_type') or not data.get('current_content'):
            return jsonify({"message": "content_type and current_content are required"}), 400
        
        content_type = data['content_type']
        current_content = data['current_content']
        enhancement_type = data.get('enhancement_type', 'improve')
        course_id = data.get('course_id')
        course_title = data.get('course_title', '')
        module_title = data.get('module_title', '')
        lesson_title = data.get('lesson_title', '')
        background = data.get('background', False)
        
        # Gather course context if course_id provided
        course_context = None
        if course_id:
            course_context = _gather_course_context(course_id)
            # Also get course title from DB if not provided
            if not course_title:
                course = Course.query.get(course_id)
                if course:
                    course_title = course.title
        
        logger.info(f"Enhancing {content_type} content with {enhancement_type} (background={background})")
        
        if background:
            task_id = task_manager.submit_task(
                task_type='enhance-content',
                task_func=ai_agent_service.enhance_lesson_content_stepwise,
                kwargs={
                    'content_type': content_type,
                    'current_content': current_content,
                    'enhancement_type': enhancement_type,
                    'course_title': course_title,
                    'module_title': module_title,
                    'lesson_title': lesson_title,
                    'course_context': course_context,
                },
                total_steps=3,
                user_id=current_user_id,
                on_complete=handle_task_completion,
                task_meta=_make_task_meta(course_id=data.get('course_id'), course_title=course_title),
            )
            return jsonify({
                "success": True, "background": True,
                "task_id": task_id, "status": "pending",
                "message": "Content enhancement started in background (analyze → enhance → cross-reference)"
            }), 202
        
        result = ai_agent_service.enhance_content(
            content_type=content_type,
            current_content=current_content,
            enhancement_type=enhancement_type
        )
        
        # Convert AIResponse to API response format
        response_data = result.to_dict()
        
        if result.status.value in ['success', 'partial_success']:
            return jsonify(response_data), 200
        else:
            return jsonify(response_data), 500
        
    except Exception as e:
        logger.error(f"Error enhancing content: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to enhance content",
            "error": str(e)
        }), 500


# =====================
# MIXED CONTENT GENERATION
# =====================

@ai_agent_bp.route("/generate-mixed-content", methods=["POST"])
@instructor_required
def generate_mixed_content():
    """
    Generate AI-powered mixed content lesson with template support
    
    Request body:
    {
        "course_id": 1,
        "module_id": 1,
        "lesson_title": "Introduction to Variables",
        "lesson_description": "Learn about variables in Python",
        "template_id": "intro-video-summary" (optional),
        "existing_sections": [] (optional - for enhancement/append mode)
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id') or not data.get('module_id'):
            return jsonify({"message": "Course ID and Module ID are required"}), 400
        
        course_id = data['course_id']
        module_id = data['module_id']
        lesson_title = data.get('lesson_title', '')
        lesson_description = data.get('lesson_description', '')
        template_id = data.get('template_id')
        existing_sections = data.get('existing_sections', [])
        
        # Verify access
        course = Course.query.get(course_id)
        if not course:
            logger.warning(f"Course not found: {course_id}")
            return jsonify({"message": "Course not found"}), 404
        
        # Check if user is the course instructor or an admin
        user = User.query.get(current_user_id)
        is_admin = user and user.role and user.role.name == 'admin'
        is_course_instructor = course.instructor_id == int(current_user_id)
        
        if not (is_course_instructor or is_admin):
            logger.warning(f"User {current_user_id} attempted to access course {course_id} (instructor: {course.instructor_id})")
            return jsonify({"message": "Unauthorized - You are not the instructor of this course"}), 403
        
        logger.info(f"Access granted to course {course_id} for user {current_user_id}")
        
        module = Module.query.get(module_id)
        if not module or module.course_id != course_id:
            return jsonify({"message": "Module not found"}), 404
        
        logger.info(f"Generating mixed content for lesson: {lesson_title} with template: {template_id}")
        
        # Always use background task to avoid Gunicorn worker timeout
        task_id = task_manager.submit_task(
            task_type='generate-mixed-content',
            task_func=ai_agent_service.run_single_step_background,
            kwargs={
                'method_name': 'generate_mixed_content',
                'method_kwargs': {
                    'course_title': course.title,
                    'module_title': module.title,
                    'module_description': module.description or '',
                    'lesson_title': lesson_title,
                    'lesson_description': lesson_description,
                    'template_id': template_id,
                    'existing_sections': existing_sections,
                }
            },
            total_steps=1,
            user_id=current_user_id,
            on_complete=handle_task_completion,
            task_meta=_make_task_meta(course_id=course_id, module_id=module_id, course_title=course.title),
        )
        return jsonify({
            "success": True, "background": True,
            "task_id": task_id, "status": "pending",
            "message": f"Generating mixed content for {lesson_title} in background"
        }), 202
        
    except Exception as e:
        logger.error(f"Error generating mixed content: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate mixed content",
            "error": str(e)
        }), 500


@ai_agent_bp.route("/enhance-section-content", methods=["POST"])
@instructor_required
def enhance_section_content():
    """
    Enhance a specific section of mixed content using AI
    
    Request body:
    {
        "section_type": "text",
        "section_content": "Brief content...",
        "context": {
            "lesson_title": "Variables in Python",
            "section_position": "introduction",
            "previous_section": "..."
        },
        "course_id": 1 (optional - for cross-module context),
        "background": true (optional)
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('section_type'):
            return jsonify({"message": "Section type is required"}), 400
        
        section_type = data['section_type']
        section_content = data.get('section_content', '')
        context = data.get('context', {})
        course_id = data.get('course_id')
        background = data.get('background', False)
        
        logger.info(f"Enhancing {section_type} section content (background={background})")
        
        if background:
            # Gather course context for cross-module awareness
            course_context = None
            course_title = context.get('course_title', '')
            module_title = context.get('module_title', '')
            lesson_title = context.get('lesson_title', '')
            
            if course_id:
                course_context = _gather_course_context(course_id)
                if not course_title:
                    course = Course.query.get(course_id)
                    if course:
                        course_title = course.title
            
            task_id = task_manager.submit_task(
                task_type='enhance-section-content',
                task_func=ai_agent_service.enhance_lesson_content_stepwise,
                kwargs={
                    'content_type': section_type,
                    'current_content': section_content,
                    'enhancement_type': 'expand',
                    'course_title': course_title,
                    'module_title': module_title,
                    'lesson_title': lesson_title,
                    'course_context': course_context,
                },
                total_steps=3,
                user_id=current_user_id,
                on_complete=handle_task_completion,
                task_meta=_make_task_meta(course_title=course_title),
            )
            return jsonify({
                "success": True, "background": True,
                "task_id": task_id, "status": "pending",
                "message": "Section enhancement started in background"
            }), 202
        
        result = ai_agent_service.enhance_section_content(
            section_type=section_type,
            section_content=section_content,
            context=context
        )
        
        # Convert AIResponse to dict for JSON serialization
        response_data = result.to_dict()
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error enhancing section content: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to enhance section content",
            "error": str(e)
        }), 500


# =====================
# TASK-BASED LESSON GENERATION
# =====================

@ai_agent_bp.route("/task-based/create-session", methods=["POST"])
@instructor_required
def create_task_session():
    """
    Create a new task-based lesson generation session.
    Returns a session ID that can be used to start/resume/monitor generation.
    
    Request body:
    {
        "course_id": 1,
        "module_id": 2,
        "lesson_title": "Variables and Data Types",
        "lesson_description": "Learn about Python variables",
        "depth_level": "comprehensive"  // basic, standard, comprehensive, expert
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id') or not data.get('module_id'):
            return jsonify({"message": "Course ID and Module ID are required"}), 400
        
        if not data.get('lesson_title'):
            return jsonify({"message": "Lesson title is required"}), 400
        
        course_id = data['course_id']
        module_id = data['module_id']
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Get module
        module = Module.query.filter_by(id=module_id, course_id=course_id).first()
        if not module:
            return jsonify({"message": "Module not found"}), 404
        
        # Get existing lessons
        existing_lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
        existing_lessons_data = [{
            'title': lesson.title,
            'description': lesson.description or '',
            'order': lesson.order,
            'duration_minutes': lesson.duration_minutes or 0
        } for lesson in existing_lessons]
        
        depth_level = data.get('depth_level', 'comprehensive')
        if depth_level not in ['basic', 'standard', 'comprehensive', 'expert']:
            depth_level = 'comprehensive'
        
        logger.info(f"Creating task-based session for lesson: {data.get('lesson_title')} (depth: {depth_level})")
        
        # Create session using task-based generator
        session_id = ai_agent_service.task_based_gen.create_session(
            course_title=course.title,
            module_title=module.title,
            module_description=module.description or '',
            module_objectives=module.learning_objectives or '',
            lesson_title=data.get('lesson_title'),
            lesson_description=data.get('lesson_description', ''),
            difficulty_level=data.get('difficulty_level', 'intermediate'),
            existing_lessons=existing_lessons_data,
            depth_level=depth_level
        )
        
        # Get initial status
        status = ai_agent_service.task_based_gen.get_session_status(session_id)
        
        return jsonify({
            "success": True,
            "session_id": session_id,
            "status": status
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating task session: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to create task session",
            "error": str(e)
        }), 500


@ai_agent_bp.route("/task-based/session/<session_id>", methods=["GET"])
@instructor_required
def get_task_session_status(session_id):
    """
    Get the current status of a task-based generation session.
    
    Returns task progress, completed/pending tasks, and timing info.
    """
    try:
        status = ai_agent_service.task_based_gen.get_session_status(session_id)
        
        if not status:
            return jsonify({
                "success": False,
                "message": "Session not found"
            }), 404
        
        return jsonify({
            "success": True,
            "data": status
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting session status: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to get session status",
            "error": str(e)
        }), 500


@ai_agent_bp.route("/task-based/execute/<session_id>", methods=["POST"])
@instructor_required
def execute_task_session(session_id):
    """
    Execute or resume a task-based generation session.
    
    Request body (optional):
    {
        "parallel": true  // Whether to run independent tasks in parallel
    }
    
    Returns the complete generated lesson when finished.
    """
    try:
        data = request.get_json() or {}
        parallel = data.get('parallel', True)
        
        logger.info(f"Executing session {session_id} (parallel: {parallel})")
        
        # Resume/execute the session
        result = ai_agent_service.task_based_gen.resume_session(
            session_id=session_id,
            parallel=parallel
        )
        
        # Convert AIResponse to dict for JSON serialization
        response_data = result.to_dict()
        
        return jsonify(response_data), 200
        
    except ValueError as e:
        return jsonify({
            "success": False,
            "message": str(e)
        }), 404
    except Exception as e:
        logger.error(f"Error executing session: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to execute session",
            "error": str(e)
        }), 500


@ai_agent_bp.route("/task-based/generate", methods=["POST"])
@instructor_required
def generate_lesson_with_tasks():
    """
    Generate a lesson using task-based approach (one-shot: creates and executes session).
    For real-time progress, use create-session + execute-stream instead.
    
    Request body:
    {
        "course_id": 1,
        "module_id": 2,
        "lesson_title": "Variables and Data Types",
        "lesson_description": "Learn about Python variables",
        "depth_level": "comprehensive",  // basic, standard, comprehensive, expert
        "parallel": true
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id') or not data.get('module_id'):
            return jsonify({"message": "Course ID and Module ID are required"}), 400
        
        if not data.get('lesson_title'):
            return jsonify({"message": "Lesson title is required"}), 400
        
        course_id = data['course_id']
        module_id = data['module_id']
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Get module
        module = Module.query.filter_by(id=module_id, course_id=course_id).first()
        if not module:
            return jsonify({"message": "Module not found"}), 404
        
        # Get existing lessons
        existing_lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
        existing_lessons_data = [{
            'title': lesson.title,
            'description': lesson.description or '',
            'order': lesson.order,
            'duration_minutes': lesson.duration_minutes or 0
        } for lesson in existing_lessons]
        
        depth_level = data.get('depth_level', 'comprehensive')
        if depth_level not in ['basic', 'standard', 'comprehensive', 'expert']:
            depth_level = 'comprehensive'
        
        parallel = data.get('parallel', True)
        
        logger.info(f"Generating lesson with tasks: {data.get('lesson_title')} (depth: {depth_level}, parallel: {parallel})")
        
        result = ai_agent_service.generate_lesson_with_tasks(
            course_title=course.title,
            module_title=module.title,
            module_description=module.description or '',
            module_objectives=module.learning_objectives or '',
            lesson_title=data.get('lesson_title'),
            lesson_description=data.get('lesson_description', ''),
            difficulty_level=data.get('difficulty_level', 'intermediate'),
            existing_lessons=existing_lessons_data,
            depth_level=depth_level,
            parallel=parallel
        )
        
        # Convert AIResponse to dict for JSON serialization
        response_data = result.to_dict()
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error generating lesson with tasks: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate lesson",
            "error": str(e)
        }), 500


@ai_agent_bp.route("/task-based/stream/<session_id>", methods=["GET"])
@instructor_required
def stream_task_progress(session_id):
    """
    Stream task progress using Server-Sent Events (SSE).
    Connect to this endpoint to receive real-time updates during generation.
    
    SSE Events:
    - status: Session status update (percentage, current task)
    - task_complete: A task has completed
    - task_failed: A task has failed
    - complete: Generation finished
    - error: An error occurred
    
    Usage:
    const eventSource = new EventSource('/api/v1/ai-agent/task-based/stream/{session_id}');
    eventSource.onmessage = (e) => console.log(JSON.parse(e.data));
    """
    from flask import Response
    import json
    import time
    
    def generate_events():
        last_completed = 0
        last_status = ""
        check_count = 0
        max_checks = 600  # 10 minutes timeout (at 1 check/sec)
        
        while check_count < max_checks:
            status = ai_agent_service.task_based_gen.get_session_status(session_id)
            
            if not status:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Session not found'})}\n\n"
                break
            
            current_completed = status['progress'].get('completed_tasks', 0)
            current_status = status['status']
            
            # Send update if progress changed
            if current_completed != last_completed or current_status != last_status:
                event_data = {
                    'type': 'status',
                    'session_id': session_id,
                    'status': current_status,
                    'progress': status['progress'],
                    'current_task': status['progress'].get('current_task'),
                    'tasks_summary': {
                        task_id: {
                            'title': task_info['title'],
                            'status': task_info['status']
                        }
                        for task_id, task_info in status.get('tasks', {}).items()
                    }
                }
                yield f"data: {json.dumps(event_data)}\n\n"
                
                last_completed = current_completed
                last_status = current_status
            
            # Check if complete
            if current_status == 'completed':
                yield f"data: {json.dumps({'type': 'complete', 'session_id': session_id, 'progress': status['progress']})}\n\n"
                break
            
            if current_status == 'failed':
                yield f"data: {json.dumps({'type': 'error', 'session_id': session_id, 'message': 'Generation failed'})}\n\n"
                break
            
            time.sleep(1)
            check_count += 1
        
        if check_count >= max_checks:
            yield f"data: {json.dumps({'type': 'timeout', 'message': 'Stream timeout'})}\n\n"
    
    return Response(
        generate_events(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no'  # Disable nginx buffering
        }
    )


@ai_agent_bp.route("/task-based/generate-deep", methods=["POST"])
@instructor_required
def generate_deep_lesson():
    """
    Generate a deeply comprehensive lesson (expert depth level).
    Uses 30+ tasks for maximum detail.
    
    Request body:
    {
        "course_id": 1,
        "module_id": 2,
        "lesson_title": "Variables and Data Types",
        "lesson_description": "Learn about Python variables"
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id') or not data.get('module_id'):
            return jsonify({"message": "Course ID and Module ID are required"}), 400
        
        if not data.get('lesson_title'):
            return jsonify({"message": "Lesson title is required"}), 400
        
        course_id = data['course_id']
        module_id = data['module_id']
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Get module
        module = Module.query.filter_by(id=module_id, course_id=course_id).first()
        if not module:
            return jsonify({"message": "Module not found"}), 404
        
        # Get existing lessons
        existing_lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
        existing_lessons_data = [{
            'title': lesson.title,
            'description': lesson.description or '',
            'order': lesson.order,
            'duration_minutes': lesson.duration_minutes or 0
        } for lesson in existing_lessons]
        
        logger.info(f"Generating deep lesson: {data.get('lesson_title')}")
        
        result = ai_agent_service.generate_deep_lesson(
            course_title=course.title,
            module_title=module.title,
            module_description=module.description or '',
            module_objectives=module.learning_objectives or '',
            lesson_title=data.get('lesson_title'),
            lesson_description=data.get('lesson_description', ''),
            existing_lessons=existing_lessons_data
        )
        
        # Convert AIResponse to dict for JSON serialization
        response_data = result.to_dict()
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error generating deep lesson: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate deep lesson",
            "error": str(e)
        }), 500


# =====================
# CHAPTER-BASED LESSON GENERATION
# =====================

@ai_agent_bp.route("/chapter-based/create-session", methods=["POST"])
@instructor_required
def create_chapter_session():
    """
    Create a chapter-based lesson generation session.
    
    This approach generates lessons chapter-by-chapter for deeper content.
    
    Request body:
    {
        "course_id": 1,
        "module_id": 2,
        "lesson_title": "Variables and Data Types",
        "lesson_description": "Learn about Python variables",
        "target_chapters": 5,  // Number of chapters to generate
        "chapter_depth": "deep"  // shallow, standard, deep
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id') or not data.get('module_id'):
            return jsonify({"message": "Course ID and Module ID are required"}), 400
        
        if not data.get('lesson_title'):
            return jsonify({"message": "Lesson title is required"}), 400
        
        course_id = data['course_id']
        module_id = data['module_id']
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Get module
        module = Module.query.filter_by(id=module_id, course_id=course_id).first()
        if not module:
            return jsonify({"message": "Module not found"}), 404
        
        # Get existing lessons
        existing_lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
        existing_lessons_data = [{
            'title': lesson.title,
            'description': lesson.description or '',
            'order': lesson.order
        } for lesson in existing_lessons]
        
        target_chapters = data.get('target_chapters', 5)
        chapter_depth = data.get('chapter_depth', 'deep')
        if chapter_depth not in ['shallow', 'standard', 'deep']:
            chapter_depth = 'deep'
        
        logger.info(f"Creating chapter-based session for: {data.get('lesson_title')}")
        
        session_id = ai_agent_service.create_chapter_session(
            course_title=course.title,
            module_title=module.title,
            module_description=module.description or '',
            module_objectives=module.learning_objectives or '',
            lesson_title=data.get('lesson_title'),
            lesson_description=data.get('lesson_description', ''),
            difficulty_level=data.get('difficulty_level', 'intermediate'),
            existing_lessons=existing_lessons_data,
            target_chapters=target_chapters,
            chapter_depth=chapter_depth
        )
        
        status = ai_agent_service.get_chapter_session_status(session_id)
        
        return jsonify({
            "success": True,
            "session_id": session_id,
            "status": status
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating chapter session: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to create chapter session",
            "error": str(e)
        }), 500


@ai_agent_bp.route("/chapter-based/outline/<session_id>", methods=["POST"])
@instructor_required
def outline_lesson_chapters(session_id):
    """
    Generate chapter outlines for a lesson.
    This is the first step - determines the lesson structure.
    
    Returns chapter titles, descriptions, and learning objectives.
    """
    try:
        logger.info(f"Generating chapter outlines for session: {session_id}")
        
        outlines = ai_agent_service.outline_lesson_chapters(session_id)
        
        return jsonify({
            "success": True,
            "session_id": session_id,
            "chapters": outlines,
            "total_chapters": len(outlines)
        }), 200
        
    except ValueError as e:
        return jsonify({
            "success": False,
            "message": str(e)
        }), 404
    except Exception as e:
        logger.error(f"Error outlining chapters: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to outline chapters",
            "error": str(e)
        }), 500


@ai_agent_bp.route("/chapter-based/generate-chapter/<session_id>/<chapter_id>", methods=["POST"])
@instructor_required
def generate_single_chapter(session_id, chapter_id):
    """
    Generate content for a single chapter.
    
    This generates deep content for one chapter including:
    - Introduction
    - Theory with subsections
    - Examples
    - Exercises
    - Summary and key takeaways
    
    Call this for each chapter after outlining.
    """
    try:
        logger.info(f"Generating chapter {chapter_id} for session {session_id}")
        
        content = ai_agent_service.generate_chapter(session_id, chapter_id)
        
        return jsonify({
            "success": True,
            "session_id": session_id,
            "chapter": content
        }), 200
        
    except ValueError as e:
        return jsonify({
            "success": False,
            "message": str(e)
        }), 404
    except Exception as e:
        logger.error(f"Error generating chapter: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate chapter",
            "error": str(e)
        }), 500


@ai_agent_bp.route("/chapter-based/session/<session_id>", methods=["GET"])
@instructor_required
def get_chapter_session_status(session_id):
    """
    Get the current status of a chapter-based generation session.
    
    Returns:
    - Session status
    - Chapter list with completion status
    - Progress percentage
    """
    try:
        status = ai_agent_service.get_chapter_session_status(session_id)
        
        if not status:
            return jsonify({
                "success": False,
                "message": "Session not found"
            }), 404
        
        return jsonify({
            "success": True,
            "data": status
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting chapter session status: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to get session status",
            "error": str(e)
        }), 500


@ai_agent_bp.route("/chapter-based/generate", methods=["POST"])
@instructor_required
def generate_lesson_by_chapters():
    """
    Generate a complete lesson using chapter-by-chapter approach.
    
    This is the most thorough lesson generation method:
    1. Analyzes topic and determines optimal chapter structure
    2. Creates detailed outline with objectives per chapter
    3. Generates each chapter with deep content, examples, exercises
    4. Builds lesson progressively
    
    Request body:
    {
        "course_id": 1,
        "module_id": 2,
        "lesson_title": "Variables and Data Types",
        "lesson_description": "Learn about Python variables",
        "target_chapters": 5,
        "chapter_depth": "deep"
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id') or not data.get('module_id'):
            return jsonify({"message": "Course ID and Module ID are required"}), 400
        
        if not data.get('lesson_title'):
            return jsonify({"message": "Lesson title is required"}), 400
        
        course_id = data['course_id']
        module_id = data['module_id']
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Get module
        module = Module.query.filter_by(id=module_id, course_id=course_id).first()
        if not module:
            return jsonify({"message": "Module not found"}), 404
        
        # Get existing lessons
        existing_lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
        existing_lessons_data = [{
            'title': lesson.title,
            'description': lesson.description or '',
            'order': lesson.order
        } for lesson in existing_lessons]
        
        target_chapters = data.get('target_chapters', 5)
        chapter_depth = data.get('chapter_depth', 'deep')
        if chapter_depth not in ['shallow', 'standard', 'deep']:
            chapter_depth = 'deep'
        
        logger.info(f"Generating lesson by chapters: {data.get('lesson_title')}")
        
        result = ai_agent_service.generate_lesson_by_chapters(
            course_title=course.title,
            module_title=module.title,
            module_description=module.description or '',
            module_objectives=module.learning_objectives or '',
            lesson_title=data.get('lesson_title'),
            lesson_description=data.get('lesson_description', ''),
            difficulty_level=data.get('difficulty_level', 'intermediate'),
            existing_lessons=existing_lessons_data,
            target_chapters=target_chapters,
            chapter_depth=chapter_depth
        )
        
        # Convert AIResponse to dict for JSON serialization
        response_data = result.to_dict()
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error generating lesson by chapters: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate lesson",
            "error": str(e)
        }), 500


@ai_agent_bp.route("/chapter-based/stream/<session_id>", methods=["GET"])
@instructor_required
def stream_chapter_progress(session_id):
    """
    Stream chapter generation progress using Server-Sent Events (SSE).
    
    SSE Events:
    - outline: Chapter outline generated
    - chapter_start: Starting a new chapter
    - chapter_progress: Progress within a chapter
    - chapter_complete: A chapter has been completed
    - complete: All chapters generated
    - error: An error occurred
    """
    from flask import Response
    import json
    import time
    
    def generate_events():
        last_completed = 0
        last_phase = ""
        check_count = 0
        max_checks = 1200  # 20 minutes timeout
        
        while check_count < max_checks:
            status = ai_agent_service.get_chapter_session_status(session_id)
            
            if not status:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Session not found'})}\n\n"
                break
            
            current_completed = status['progress'].get('completed_chapters', 0)
            current_phase = status['progress'].get('phase', '')
            current_chapter = status['progress'].get('current_chapter')
            
            # Send update if progress changed
            if current_completed != last_completed or current_phase != last_phase:
                event_data = {
                    'type': 'progress',
                    'session_id': session_id,
                    'phase': current_phase,
                    'progress': status['progress'],
                    'current_chapter': current_chapter,
                    'chapters': status.get('chapters', [])
                }
                yield f"data: {json.dumps(event_data)}\n\n"
                
                last_completed = current_completed
                last_phase = current_phase
            
            # Check if complete
            if status['status'] == 'completed':
                yield f"data: {json.dumps({'type': 'complete', 'session_id': session_id, 'progress': status['progress']})}\n\n"
                break
            
            if status['status'] == 'failed':
                yield f"data: {json.dumps({'type': 'error', 'session_id': session_id, 'message': 'Generation failed'})}\n\n"
                break
            
            time.sleep(1)
            check_count += 1
        
        if check_count >= max_checks:
            yield f"data: {json.dumps({'type': 'timeout', 'message': 'Stream timeout'})}\n\n"
    
    return Response(
        generate_events(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no'
        }
    )
