"""
Content Auto-Save Service for Afritec Bridge LMS

Automatically persists AI-generated content to the database after background tasks
complete, and creates user notifications.

Called by BackgroundTaskManager's on_complete callback.
"""

import logging
import json
from datetime import datetime
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def handle_task_completion(task_id: str, task_type: str, result: Any,
                           task_meta: Dict[str, Any], user_id: int,
                           error: str = None):
    """
    Central callback invoked by BackgroundTaskManager after every background task.

    - On SUCCESS: auto-saves generated content to the DB, then creates a
      success notification for the user.
    - On FAILURE: creates a failure notification so the user knows something
      went wrong without having to stay on the page.

    Requires Flask app context — the caller (task_manager._run_task) runs in
    a daemon thread, so we push an app context here.
    """
    from flask import current_app
    from ..models.user_models import db
    from ..models.notification_models import Notification
    from ..models.course_models import Course, Module, Lesson

    # We need the Flask app to push an app context in the background thread
    app = task_meta.get('_flask_app')
    if not app:
        try:
            app = current_app._get_current_object()
        except RuntimeError:
            logger.error(f"Task {task_id[:8]}... auto-save skipped: no Flask app context")
            return

    with app.app_context():
        if error:
            _create_failure_notification(
                db, Notification, user_id, task_id, task_type, task_meta, error
            )
            return

        if not result:
            logger.warning(f"Task {task_id[:8]}... completed but result is empty")
            _create_failure_notification(
                db, Notification, user_id, task_id, task_type, task_meta,
                "Task completed but returned no data"
            )
            return

        try:
            saved_info = _auto_save_content(
                db, Course, Module, Lesson,
                task_type, result, task_meta
            )
            _create_success_notification(
                db, Notification, user_id, task_id, task_type, task_meta, saved_info
            )
        except Exception as e:
            logger.error(f"Task {task_id[:8]}... auto-save failed: {e}", exc_info=True)
            _create_failure_notification(
                db, Notification, user_id, task_id, task_type, task_meta,
                f"Auto-save failed: {str(e)}"
            )


# =============================================================================
# AUTO-SAVE LOGIC
# =============================================================================

def _auto_save_content(db, Course, Module, Lesson,
                       task_type: str, result: Dict[str, Any],
                       meta: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parse the AI result dict and create DB records.
    Returns a summary dict of what was saved.
    """
    course_id = meta.get('course_id')
    module_id = meta.get('module_id')
    auto_save = meta.get('auto_save', True)

    if not auto_save:
        logger.info(f"Auto-save disabled for task type {task_type}")
        return {'saved': False, 'reason': 'auto_save disabled'}

    # Extract the data payload from AIResponse.to_dict() format
    data = result.get('data', result) if isinstance(result, dict) else {}
    success = result.get('success', True) if isinstance(result, dict) else True
    
    if not success:
        raise ValueError(result.get('message', 'Task returned unsuccessful result'))

    if task_type in ('generate-multiple-lessons',):
        return _save_multiple_lessons(db, Lesson, module_id, data)
    
    elif task_type in ('generate-lesson-content', 'generate-comprehensive-lesson'):
        return _save_single_lesson(db, Lesson, module_id, data)
    
    elif task_type in ('generate-multiple-modules',):
        return _save_multiple_modules(db, Module, course_id, data)
    
    elif task_type in ('generate-module-content',):
        return _save_single_module(db, Module, course_id, data)
    
    elif task_type in ('generate-course-outline',):
        # Course outlines are informational — no direct DB save needed
        return {'saved': False, 'reason': 'course_outline is advisory only',
                'title': data.get('title', 'Course Outline')}
    
    else:
        logger.info(f"No auto-save handler for task type: {task_type}")
        return {'saved': False, 'reason': f'unhandled task_type: {task_type}'}


def _save_multiple_lessons(db, Lesson, module_id: int,
                           data: Dict[str, Any]) -> Dict[str, Any]:
    """Save multiple AI-generated lessons to the DB"""
    lessons_data = data.get('lessons', [])
    if not lessons_data:
        return {'saved': False, 'reason': 'no lessons in result'}

    if not module_id:
        return {'saved': False, 'reason': 'no module_id provided'}

    # Get current max order in this module
    last_lesson = Lesson.query.filter_by(module_id=module_id)\
        .order_by(Lesson.order.desc()).first()
    next_order = (last_lesson.order + 1) if last_lesson else 1

    created = []
    for i, lesson_data in enumerate(lessons_data):
        lesson = Lesson(
            title=lesson_data.get('title', f'Lesson {next_order + i}'),
            content_type=lesson_data.get('content_type', 'text'),
            content_data=lesson_data.get('content_data', ''),
            description=lesson_data.get('description', ''),
            learning_objectives=lesson_data.get('learning_objectives', ''),
            module_id=module_id,
            order=lesson_data.get('order', next_order + i),
            duration_minutes=lesson_data.get('duration_minutes'),
            is_published=False,  # Draft by default
        )
        db.session.add(lesson)
        created.append(lesson_data.get('title', f'Lesson {next_order + i}'))

    db.session.commit()
    logger.info(f"Auto-saved {len(created)} lessons to module {module_id}")
    return {
        'saved': True,
        'type': 'lessons',
        'count': len(created),
        'titles': created,
        'module_id': module_id,
    }


def _save_single_lesson(db, Lesson, module_id: int,
                         data: Dict[str, Any]) -> Dict[str, Any]:
    """Save a single AI-generated lesson to the DB"""
    if not module_id:
        return {'saved': False, 'reason': 'no module_id provided'}

    # The data might be the lesson directly, or wrapped in a lessons list
    lesson_data = data
    if 'lessons' in data and isinstance(data['lessons'], list) and data['lessons']:
        lesson_data = data['lessons'][0]

    title = lesson_data.get('title', 'AI Generated Lesson')
    if not lesson_data.get('content_data') and not lesson_data.get('description'):
        return {'saved': False, 'reason': 'lesson has no content or description'}

    last_lesson = Lesson.query.filter_by(module_id=module_id)\
        .order_by(Lesson.order.desc()).first()
    next_order = (last_lesson.order + 1) if last_lesson else 1

    lesson = Lesson(
        title=title,
        content_type=lesson_data.get('content_type', 'text'),
        content_data=lesson_data.get('content_data', ''),
        description=lesson_data.get('description', ''),
        learning_objectives=lesson_data.get('learning_objectives', ''),
        module_id=module_id,
        order=lesson_data.get('order', next_order),
        duration_minutes=lesson_data.get('duration_minutes'),
        is_published=False,
    )
    db.session.add(lesson)
    db.session.commit()
    logger.info(f"Auto-saved lesson '{title}' to module {module_id}")
    return {
        'saved': True,
        'type': 'lesson',
        'count': 1,
        'titles': [title],
        'module_id': module_id,
        'lesson_id': lesson.id,
    }


def _save_multiple_modules(db, Module, course_id: int,
                           data: Dict[str, Any]) -> Dict[str, Any]:
    """Save multiple AI-generated modules to the DB"""
    modules_data = data.get('modules', [])
    if not modules_data:
        return {'saved': False, 'reason': 'no modules in result'}

    if not course_id:
        return {'saved': False, 'reason': 'no course_id provided'}

    last_module = Module.query.filter_by(course_id=course_id)\
        .order_by(Module.order.desc()).first()
    next_order = (last_module.order + 1) if last_module else 1

    created = []
    for i, mod_data in enumerate(modules_data):
        module = Module(
            title=mod_data.get('title', f'Module {next_order + i}'),
            description=mod_data.get('description', ''),
            learning_objectives=mod_data.get('learning_objectives', ''),
            course_id=course_id,
            order=mod_data.get('order', next_order + i),
            is_published=False,
        )
        db.session.add(module)
        created.append(mod_data.get('title', f'Module {next_order + i}'))

    db.session.commit()
    logger.info(f"Auto-saved {len(created)} modules to course {course_id}")
    return {
        'saved': True,
        'type': 'modules',
        'count': len(created),
        'titles': created,
        'course_id': course_id,
    }


def _save_single_module(db, Module, course_id: int,
                         data: Dict[str, Any]) -> Dict[str, Any]:
    """Save a single AI-generated module to the DB"""
    if not course_id:
        return {'saved': False, 'reason': 'no course_id provided'}

    title = data.get('title', 'AI Generated Module')

    last_module = Module.query.filter_by(course_id=course_id)\
        .order_by(Module.order.desc()).first()
    next_order = (last_module.order + 1) if last_module else 1

    module = Module(
        title=title,
        description=data.get('description', ''),
        learning_objectives=data.get('learning_objectives', ''),
        course_id=course_id,
        order=data.get('order', next_order),
        is_published=False,
    )
    db.session.add(module)
    db.session.commit()
    logger.info(f"Auto-saved module '{title}' to course {course_id}")
    return {
        'saved': True,
        'type': 'module',
        'count': 1,
        'titles': [title],
        'course_id': course_id,
        'module_id': module.id,
    }


# =============================================================================
# NOTIFICATION CREATION
# =============================================================================

def _create_success_notification(db, Notification, user_id: int, task_id: str,
                                  task_type: str, meta: Dict[str, Any],
                                  saved_info: Dict[str, Any]):
    """Create a success notification for the user"""
    course_name = meta.get('course_title', 'your course')
    saved = saved_info.get('saved', False)
    count = saved_info.get('count', 0)
    titles = saved_info.get('titles', [])
    content_type = saved_info.get('type', task_type)

    if saved and count > 0:
        title = f"AI Content Ready — {count} {content_type} saved"
        titles_preview = ", ".join(titles[:3])
        if len(titles) > 3:
            titles_preview += f" (+{len(titles) - 3} more)"
        message = (
            f"Successfully generated and saved {count} {content_type} "
            f"for {course_name}. Items: {titles_preview}. "
            f"Review them in your course editor."
        )
    else:
        title = "AI Content Generated"
        reason = saved_info.get('reason', 'Content generated but not auto-saved')
        message = (
            f"AI generation completed for {course_name}. "
            f"{reason}. Check the task result for details."
        )

    notification = Notification(
        user_id=user_id,
        notification_type='ai_task_completed',
        title=title,
        message=message,
        task_id=task_id,
        task_type=task_type,
        course_id=meta.get('course_id'),
        module_id=meta.get('module_id'),
        lesson_id=saved_info.get('lesson_id'),
    )
    notification.meta = {
        'saved_info': saved_info,
        'course_title': course_name,
    }
    db.session.add(notification)
    db.session.commit()
    logger.info(f"Created success notification for user {user_id}, task {task_id[:8]}...")


def _create_failure_notification(db, Notification, user_id: int, task_id: str,
                                  task_type: str, meta: Dict[str, Any],
                                  error: str):
    """Create a failure notification for the user"""
    course_name = meta.get('course_title', 'your course')

    notification = Notification(
        user_id=user_id,
        notification_type='ai_task_failed',
        title="AI Generation Failed",
        message=(
            f"Content generation for {course_name} encountered an error: "
            f"{error[:200]}. Please try again."
        ),
        task_id=task_id,
        task_type=task_type,
        course_id=meta.get('course_id'),
        module_id=meta.get('module_id'),
    )
    notification.meta = {
        'error': error[:500],
        'course_title': course_name,
    }
    db.session.add(notification)
    db.session.commit()
    logger.info(f"Created failure notification for user {user_id}, task {task_id[:8]}...")
