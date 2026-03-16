"""
Background Task Service for Afritec Bridge LMS
Handles long-running operations asynchronously to prevent timeouts
Database-backed for multi-worker compatibility
"""

import threading
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Callable
import logging

logger = logging.getLogger(__name__)

class BackgroundTaskService:
    """
    Background task service with database persistence
    Works correctly with multiple Gunicorn workers
    """
    
    def __init__(self):
        self._lock = threading.Lock()
        self._cleanup_interval = 3600  # Cleanup completed tasks after 1 hour
        self._start_cleanup_thread()
    
    def create_task(self, task_func: Callable, *args, **kwargs) -> str:
        """Create a new background task and return task ID"""
        from flask import current_app
        from ..models.task_models import BackgroundTask, TaskStatus
        
        task_id = str(uuid.uuid4())
        
        try:
            # Create task record in database
            new_task = BackgroundTask(
                id=task_id,
                status=TaskStatus.PENDING,
                task_name=task_func.__name__
            )
            
            from ..models.user_models import db
            
            with current_app.app_context():
                db.session.add(new_task)
                db.session.commit()
                logger.info(f"Created background task {task_id} in database")
            
        except Exception as e:
            logger.error(f"Failed to create task in database: {str(e)}")
            raise
        
        # Start the task in a background thread
        thread = threading.Thread(
            target=self._execute_task,
            args=(task_id, task_func, args, kwargs),
            name=f"task-{task_id[:8]}"
        )
        thread.daemon = True
        thread.start()
        
        logger.info(f"Started background task {task_id}")
        return task_id
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get the current status of a task from database"""
        from flask import current_app
        from ..models.task_models import BackgroundTask
        
        try:
            with current_app.app_context():
                from ..models.user_models import db
                
                task = BackgroundTask.query.filter_by(id=task_id).first()
                
                if not task:
                    logger.warning(f"Task {task_id} not found in database")
                    return None
                
                logger.debug(f"Task {task_id} found with status: {task.status.value}")
                
                # Return in the same format used by calling code
                result = {
                    'id': task.id,
                    'status': task.status.value,
                    'created_at': task.created_at,
                    'started_at': task.started_at,
                    'completed_at': task.completed_at,
                    'result': task.get_result(),
                    'error': task.error_message,
                    'progress': task.progress
                }
                
                return result
        
        except Exception as e:
            logger.error(f"Failed to get task status: {str(e)}")
            return None
    
    def _execute_task(self, task_id: str, task_func: Callable, args: tuple, kwargs: dict):
        """Execute a task in the background"""
        from flask import current_app
        from ..models.task_models import BackgroundTask, TaskStatus
        from ..models.user_models import db
        
        try:
            # Get app context
            try:
                app = current_app._get_current_object()
            except RuntimeError:
                # If no app context, import the app directly
                import sys
                import os
                
                # Add the backend directory to the path
                backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
                if backend_dir not in sys.path:
                    sys.path.insert(0, backend_dir)
                
                from main import app
            
            with app.app_context():
                # Mark as running
                task = BackgroundTask.query.filter_by(id=task_id).first()
                if task:
                    task.status = TaskStatus.RUNNING
                    task.started_at = datetime.utcnow()
                    db.session.commit()
                    logger.info(f"Marked task {task_id} as running")
                
                # Execute the task function
                logger.info(f"Starting execution of task {task_id} with function {task_func.__name__}")
                result = task_func(*args, **kwargs)
                
                # Mark as completed
                task = BackgroundTask.query.filter_by(id=task_id).first()
                if task:
                    task.status = TaskStatus.COMPLETED
                    task.completed_at = datetime.utcnow()
                    task.set_result(result)
                    task.progress = 100
                    db.session.commit()
                
                logger.info(f"Task {task_id} completed successfully")
            
        except Exception as e:
            logger.error(f"Task {task_id} failed: {str(e)}")
            try:
                with app.app_context():
                    task = BackgroundTask.query.filter_by(id=task_id).first()
                    if task:
                        task.status = TaskStatus.FAILED
                        task.completed_at = datetime.utcnow()
                        task.error_message = str(e)
                        db.session.commit()
            except Exception as db_error:
                logger.error(f"Failed to update task error status: {str(db_error)}")
    
    def _start_cleanup_thread(self):
        """Start a background thread to clean up old completed tasks"""
        def cleanup():
            while True:
                try:
                    time.sleep(self._cleanup_interval)
                    self._cleanup_old_tasks()
                except Exception as e:
                    logger.error(f"Task cleanup error: {e}")
        
        cleanup_thread = threading.Thread(target=cleanup)
        cleanup_thread.daemon = True
        cleanup_thread.start()
    
    def _cleanup_old_tasks(self):
        """Remove tasks older than 6 hours"""
        from flask import current_app
        from ..models.task_models import BackgroundTask, TaskStatus
        
        try:
            with current_app.app_context():
                from ..models.user_models import db
                
                cutoff_time = datetime.utcnow() - timedelta(hours=6)
                
                deleted_count = BackgroundTask.query.filter(
                    BackgroundTask.status.in_([TaskStatus.COMPLETED, TaskStatus.FAILED]),
                    BackgroundTask.completed_at < cutoff_time
                ).delete(synchronize_session=False)
                
                db.session.commit()
                
                if deleted_count > 0:
                    logger.info(f"Cleaned up {deleted_count} old tasks")
        
        except Exception as e:
            logger.error(f"Error during task cleanup: {str(e)}")

# Global instance
background_service = BackgroundTaskService()