"""
Background Task Service for Afritec Bridge LMS
Handles long-running operations asynchronously to prevent timeouts
"""

import threading
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Callable
import logging

logger = logging.getLogger(__name__)

class BackgroundTaskService:
    """Simple background task service for handling async operations"""
    
    def __init__(self):
        self._tasks = {}  # In-memory task storage (use Redis in production)
        self._lock = threading.Lock()
        self._cleanup_interval = 3600  # Cleanup completed tasks after 1 hour
        self._start_cleanup_thread()
    
    def create_task(self, task_func: Callable, *args, **kwargs) -> str:
        """Create a new background task and return task ID"""
        task_id = str(uuid.uuid4())
        
        task_info = {
            'id': task_id,
            'status': 'pending',
            'created_at': datetime.utcnow(),
            'started_at': None,
            'completed_at': None,
            'result': None,
            'error': None,
            'progress': 0
        }
        
        with self._lock:
            self._tasks[task_id] = task_info
            logger.info(f"Stored task {task_id} in memory. Total tasks: {len(self._tasks)}")
        
        # Start the task in a background thread
        thread = threading.Thread(
            target=self._execute_task,
            args=(task_id, task_func, args, kwargs),
            name=f"task-{task_id[:8]}"
        )
        thread.daemon = True
        thread.start()
        
        logger.info(f"Created and started background task {task_id}")
        return task_id
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get the current status of a task"""
        logger.debug(f"Getting task status for {task_id}")
        with self._lock:
            task = self._tasks.get(task_id, None)
            if task:
                logger.debug(f"Task {task_id} found with status: {task['status']}")
            else:
                logger.warning(f"Task {task_id} not found in {len(self._tasks)} stored tasks")
                logger.debug(f"Available task IDs: {list(self._tasks.keys())}")
            return task
    
    def _execute_task(self, task_id: str, task_func: Callable, args: tuple, kwargs: dict):
        """Execute a task in the background"""
        try:
            with self._lock:
                if task_id in self._tasks:
                    self._tasks[task_id]['status'] = 'running'
                    self._tasks[task_id]['started_at'] = datetime.utcnow()
                    logger.info(f"Marked task {task_id} as running")
            
            logger.info(f"Starting execution of task {task_id} with function {task_func.__name__}")
            
            # Execute the task function within Flask application context
            # Get the app instance from the current thread or import it
            try:
                from flask import current_app
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
                result = task_func(*args, **kwargs)
            
            with self._lock:
                if task_id in self._tasks:
                    self._tasks[task_id]['status'] = 'completed'
                    self._tasks[task_id]['completed_at'] = datetime.utcnow()
                    self._tasks[task_id]['result'] = result
                    self._tasks[task_id]['progress'] = 100
            
            logger.info(f"Task {task_id} completed successfully")
            
        except Exception as e:
            logger.error(f"Task {task_id} failed: {str(e)}")
            with self._lock:
                if task_id in self._tasks:
                    self._tasks[task_id]['status'] = 'failed'
                    self._tasks[task_id]['completed_at'] = datetime.utcnow()
                    self._tasks[task_id]['error'] = str(e)
    
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
        cutoff_time = datetime.utcnow() - timedelta(hours=6)
        
        with self._lock:
            tasks_to_remove = []
            for task_id, task_info in self._tasks.items():
                if (task_info['status'] in ['completed', 'failed'] and 
                    task_info['completed_at'] and 
                    task_info['completed_at'] < cutoff_time):
                    tasks_to_remove.append(task_id)
            
            for task_id in tasks_to_remove:
                del self._tasks[task_id]
                logger.info(f"Cleaned up old task {task_id}")

# Global instance
background_service = BackgroundTaskService()