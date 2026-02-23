"""
General-purpose Notification Model for Afritec Bridge LMS

Supports multiple notification types including AI task completion,
content updates, and system notifications.
"""

from datetime import datetime
import json
from .user_models import db


class Notification(db.Model):
    """General-purpose notification for all user-facing events"""
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Notification categorization
    notification_type = db.Column(db.String(50), nullable=False)
    # Types: ai_task_completed, ai_task_failed, content_saved, system, etc.

    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)

    # Link to a background task (optional)
    task_id = db.Column(db.String(64), nullable=True)
    task_type = db.Column(db.String(50), nullable=True)

    # Entity references so the frontend can navigate to the result
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=True)
    module_id = db.Column(db.Integer, nullable=True)
    lesson_id = db.Column(db.Integer, nullable=True)

    # Flexible JSON blob for extra data (e.g. summary of what was created)
    _metadata = db.Column('metadata', db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref=db.backref('notifications', lazy='dynamic'))
    course = db.relationship('Course', backref=db.backref('notifications', lazy='dynamic'))

    # ---- helpers ----

    @property
    def meta(self):
        """Parse the JSON metadata column"""
        if self._metadata:
            try:
                return json.loads(self._metadata)
            except (json.JSONDecodeError, TypeError):
                return {}
        return {}

    @meta.setter
    def meta(self, value):
        self._metadata = json.dumps(value) if value else None

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'notification_type': self.notification_type,
            'title': self.title,
            'message': self.message,
            'is_read': self.is_read,
            'task_id': self.task_id,
            'task_type': self.task_type,
            'course_id': self.course_id,
            'module_id': self.module_id,
            'lesson_id': self.lesson_id,
            'metadata': self.meta,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<Notification {self.id} type={self.notification_type} user={self.user_id}>'
