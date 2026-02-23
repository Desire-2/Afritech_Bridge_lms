"""
Background Task Manager for AI Generation

Runs AI tasks in background threads to avoid HTTP session timeouts.
Supports step-by-step execution with progress tracking, cancellation, and auto-cleanup.

Usage:
    from .ai.task_manager import task_manager

    task_id = task_manager.submit_task(
        task_type='generate-multiple-lessons',
        task_func=my_func,          # must accept task_id keyword arg
        kwargs={'course_title': '...', 'num_lessons': 5},
        total_steps=5,
        user_id=123,
    )
    # Returns immediately — task runs in background thread
    
    status = task_manager.get_task_status(task_id)   # poll
    result = task_manager.get_task_result(task_id)    # get completed result
    task_manager.cancel_task(task_id)                 # cancel
"""

import os
import threading
import uuid
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Callable, List
from enum import Enum
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


class TaskStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class StepInfo:
    """Information about a single step in a multi-step task"""
    step_number: int
    total_steps: int
    description: str
    status: str = "pending"  # pending, in_progress, completed, failed
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


@dataclass
class TaskInfo:
    """Complete task information"""
    task_id: str
    task_type: str
    status: TaskStatus
    created_at: str
    user_id: Optional[int] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    progress: float = 0.0
    current_step: int = 0
    total_steps: int = 1
    current_step_description: str = "Waiting to start..."
    steps: List[StepInfo] = field(default_factory=list)
    result: Optional[Any] = None
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "task_type": self.task_type,
            "status": self.status.value,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "progress": round(self.progress, 1),
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "current_step_description": self.current_step_description,
            "steps": [
                {
                    "step_number": s.step_number,
                    "total_steps": s.total_steps,
                    "description": s.description,
                    "status": s.status,
                    "started_at": s.started_at,
                    "completed_at": s.completed_at,
                }
                for s in self.steps
            ],
            "error": self.error,
        }


class BackgroundTaskManager:
    """
    Thread-based background task manager for AI generation.
    
    - Singleton pattern (one instance across the app)
    - Runs tasks in daemon threads — won't block server shutdown
    - Tracks per-step progress for multi-step tasks
    - Configurable delay between steps (AI_STEP_DELAY_SECONDS env var)
    - Auto-cleans expired tasks after 2 hours
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self.tasks: Dict[str, TaskInfo] = {}
        self.task_results: Dict[str, Any] = {}
        self.cancel_flags: Dict[str, threading.Event] = {}
        self._task_ttl = 7200       # 2 hours
        self._cleanup_interval = 1800  # 30 min
        self._step_delay = int(os.environ.get('AI_STEP_DELAY_SECONDS', '10'))

        # Start background cleanup thread
        cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        cleanup_thread.start()
        logger.info(f"BackgroundTaskManager initialized (step_delay={self._step_delay}s)")

    @property
    def step_delay(self) -> int:
        """Delay in seconds between steps (configurable via AI_STEP_DELAY_SECONDS)"""
        return self._step_delay

    # ===== Task Lifecycle =====

    def submit_task(self, task_type: str, task_func: Callable,
                    args: tuple = (), kwargs: dict = None,
                    total_steps: int = 1, user_id: int = None,
                    on_complete: Callable = None,
                    task_meta: dict = None) -> str:
        """
        Submit a task for background execution. Returns task_id immediately.
        
        The task_func MUST accept a `task_id` keyword argument:
            def my_func(arg1, arg2, task_id=None, **kwargs): ...

        on_complete: optional callback(task_id, task_type, result, task_meta)
                     called after successful completion (for auto-save, notifications, etc.)
        task_meta:   arbitrary dict passed through to on_complete (e.g. course_id, module_id)
        """
        task_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        task_info = TaskInfo(
            task_id=task_id,
            task_type=task_type,
            status=TaskStatus.PENDING,
            created_at=now,
            total_steps=total_steps,
            user_id=user_id,
        )
        self.tasks[task_id] = task_info
        self.cancel_flags[task_id] = threading.Event()

        thread = threading.Thread(
            target=self._run_task,
            args=(task_id, task_func, args, kwargs or {},
                  on_complete, task_meta or {}),
            daemon=True,
        )
        thread.start()

        logger.info(f"Task {task_id[:8]}... submitted: {task_type} (steps={total_steps})")
        return task_id

    def _run_task(self, task_id: str, task_func: Callable, args: tuple, kwargs: dict,
                  on_complete: Callable = None, task_meta: dict = None):
        """Execute a task in a background thread"""
        task = self.tasks.get(task_id)
        if not task:
            return

        task.status = TaskStatus.IN_PROGRESS
        task.started_at = datetime.utcnow().isoformat()

        try:
            # Pass task_id to the function so it can report progress
            result = task_func(*args, task_id=task_id, **kwargs)

            # Check if cancelled during execution
            if self.cancel_flags.get(task_id, threading.Event()).is_set():
                task.status = TaskStatus.CANCELLED
                task.completed_at = datetime.utcnow().isoformat()
                logger.info(f"Task {task_id[:8]}... was cancelled")
                return

            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.utcnow().isoformat()
            task.progress = 100.0
            task.current_step_description = "Completed"
            task.result = result
            self.task_results[task_id] = result
            logger.info(f"Task {task_id[:8]}... completed successfully")

            # Fire completion callback (auto-save, notifications, etc.)
            if on_complete:
                try:
                    on_complete(task_id, task.task_type, result,
                                task_meta or {}, task.user_id)
                except Exception as cb_err:
                    logger.error(f"Task {task_id[:8]}... on_complete callback failed: {cb_err}")

        except Exception as e:
            task.status = TaskStatus.FAILED
            task.completed_at = datetime.utcnow().isoformat()
            task.error = str(e)
            logger.error(f"Task {task_id[:8]}... failed: {e}")

            # Fire on_complete for failures too (so we can send failure notifications)
            if on_complete:
                try:
                    on_complete(task_id, task.task_type, None,
                                task_meta or {}, task.user_id,
                                error=str(e))
                except Exception as cb_err:
                    logger.error(f"Task {task_id[:8]}... failure callback failed: {cb_err}")

    # ===== Progress Tracking =====

    def update_progress(self, task_id: str, step: int, total: int,
                        description: str, step_status: str = "in_progress"):
        """Update task progress from within the task function"""
        task = self.tasks.get(task_id)
        if not task:
            return

        task.current_step = step
        task.total_steps = total
        task.progress = round((step / total) * 100.0, 1) if total > 0 else 0
        task.current_step_description = description

        now = datetime.utcnow().isoformat()
        step_info = StepInfo(
            step_number=step,
            total_steps=total,
            description=description,
            status=step_status,
            started_at=now if step_status == "in_progress" else None,
            completed_at=now if step_status == "completed" else None,
        )

        # Pad steps list if needed, then set
        while len(task.steps) < step:
            task.steps.append(StepInfo(
                step_number=len(task.steps) + 1,
                total_steps=total,
                description="Pending..."
            ))
        if step <= len(task.steps):
            task.steps[step - 1] = step_info
        else:
            task.steps.append(step_info)

    def complete_step(self, task_id: str, step: int, total: int, description: str):
        """Mark a step as completed"""
        self.update_progress(task_id, step, total, description, step_status="completed")

    # ===== Cancellation =====

    def is_cancelled(self, task_id: str) -> bool:
        """Check if a task has been cancelled"""
        return self.cancel_flags.get(task_id, threading.Event()).is_set()

    def cancel_task(self, task_id: str) -> bool:
        """Cancel a running task"""
        if task_id in self.cancel_flags:
            self.cancel_flags[task_id].set()
            task = self.tasks.get(task_id)
            if task and task.status in (TaskStatus.PENDING, TaskStatus.IN_PROGRESS):
                task.status = TaskStatus.CANCELLED
                task.completed_at = datetime.utcnow().isoformat()
                task.current_step_description = "Cancelled"
            logger.info(f"Task {task_id[:8]}... cancelled")
            return True
        return False

    # ===== Query =====

    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get current task status dict"""
        task = self.tasks.get(task_id)
        if not task:
            return None
        return task.to_dict()

    def get_task_result(self, task_id: str) -> Optional[Any]:
        """Get task result (only available when status == completed)"""
        task = self.tasks.get(task_id)
        if not task:
            return None
        if task.status == TaskStatus.COMPLETED:
            return task.result or self.task_results.get(task_id)
        return None

    def get_user_tasks(self, user_id: int) -> List[Dict[str, Any]]:
        """Get active (pending/in_progress) tasks for a specific user"""
        return [
            t.to_dict()
            for t in self.tasks.values()
            if t.user_id == user_id
            and t.status in (TaskStatus.PENDING, TaskStatus.IN_PROGRESS)
        ]

    # ===== Cleanup =====

    def _cleanup_loop(self):
        """Periodically clean up expired tasks"""
        while True:
            time.sleep(self._cleanup_interval)
            self._cleanup_old_tasks()

    def _cleanup_old_tasks(self):
        """Remove tasks older than TTL"""
        cutoff = (datetime.utcnow() - timedelta(seconds=self._task_ttl)).isoformat()
        to_remove = [
            tid
            for tid, task in self.tasks.items()
            if task.completed_at and task.completed_at < cutoff
        ]
        for tid in to_remove:
            self.tasks.pop(tid, None)
            self.task_results.pop(tid, None)
            self.cancel_flags.pop(tid, None)

        if to_remove:
            logger.info(f"Cleaned up {len(to_remove)} expired tasks")


# Singleton instance
task_manager = BackgroundTaskManager()
