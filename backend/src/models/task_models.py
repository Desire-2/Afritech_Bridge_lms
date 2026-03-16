"""
Task tracking models for background operations
Allows task state to be shared across multiple Gunicorn workers via database
"""

from datetime import datetime, timedelta
from sqlalchemy import Enum as SQLEnum
import enum
import json

from .user_models import db


class TaskStatus(enum.Enum):
    """Task status enumeration"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class BackgroundTask(db.Model):
    """Model for tracking background tasks across worker processes"""
    __tablename__ = 'background_tasks'
    
    id = db.Column(db.String(36), primary_key=True)  # UUID
    status = db.Column(SQLEnum(TaskStatus), nullable=False, default=TaskStatus.PENDING)
    task_name = db.Column(db.String(255), nullable=False)  # Name of the task function
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    
    # Store result and error as JSON strings
    result_data = db.Column(db.Text, nullable=True)  # JSON string
    error_message = db.Column(db.Text, nullable=True)
    progress = db.Column(db.Integer, default=0)  # Progress percentage 0-100
    
    # Optional: track which user initiated the task
    user_id = db.Column(db.Integer, nullable=True)
    
    def __repr__(self):
        return f"<BackgroundTask {self.id} - {self.status.value}>"
    
    def set_result(self, result):
        """Set task result as JSON"""
        self.result_data = json.dumps(result) if result else None
    
    def get_result(self):
        """Get task result from JSON"""
        if self.result_data:
            try:
                return json.loads(self.result_data)
            except json.JSONDecodeError:
                return None
        return None
    
    def to_dict(self):
        """Convert task to dictionary"""
        return {
            'id': self.id,
            'status': self.status.value,
            'task_name': self.task_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'result': self.get_result(),
            'error': self.error_message,
            'progress': self.progress
        }
    
    @classmethod
    def cleanup_old_tasks(cls, hours=24):
        """Remove tasks older than specified hours"""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        completed_tasks = cls.query.filter(
            cls.status.in_([TaskStatus.COMPLETED, TaskStatus.FAILED]),
            cls.completed_at < cutoff_time
        ).all()
        
        count = len(completed_tasks)
        for task in completed_tasks:
            db.session.delete(task)
        
        db.session.commit()
        return count
