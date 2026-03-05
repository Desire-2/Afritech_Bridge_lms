"""
General-purpose Notification Model for Afritec Bridge LMS

Supports all notification types including:
- Announcements (new course announcement)
- Grading (assignment/project/quiz graded, modification requested)
- Forum (new reply, post liked, thread mention)
- Enrollment (enrolled, application status)
- Achievement (badge earned, streak milestone)
- AI tasks (content generation completed/failed)
- System (maintenance, policy updates)
"""

from datetime import datetime
import json
from .user_models import db


# ── Notification type constants ──────────────────────────────────

class NotificationType:
    """Central registry of all notification types"""
    # Announcements
    ANNOUNCEMENT_NEW = 'announcement_new'
    ANNOUNCEMENT_UPDATED = 'announcement_updated'

    # Grading
    GRADE_ASSIGNMENT = 'grade_assignment'
    GRADE_PROJECT = 'grade_project'
    GRADE_QUIZ = 'grade_quiz'
    GRADE_MODIFICATION_REQUESTED = 'grade_modification_requested'
    GRADE_RESUBMISSION_RECEIVED = 'grade_resubmission_received'
    GRADE_FULL_CREDIT = 'grade_full_credit'

    # Forum
    FORUM_NEW_REPLY = 'forum_new_reply'
    FORUM_POST_LIKED = 'forum_post_liked'
    FORUM_MENTION = 'forum_mention'
    FORUM_POST_FLAGGED = 'forum_post_flagged'
    FORUM_NEW_THREAD = 'forum_new_thread'

    # Enrollment
    ENROLLMENT_CONFIRMED = 'enrollment_confirmed'
    ENROLLMENT_APPLICATION_STATUS = 'enrollment_application_status'

    # Achievement
    ACHIEVEMENT_UNLOCKED = 'achievement_unlocked'
    STREAK_MILESTONE = 'streak_milestone'
    BADGE_EARNED = 'badge_earned'

    # AI tasks
    AI_TASK_COMPLETED = 'ai_task_completed'
    AI_TASK_FAILED = 'ai_task_failed'
    CONTENT_SAVED = 'content_saved'

    # System
    SYSTEM = 'system'
    COURSE_UPDATE = 'course_update'
    MODULE_RELEASED = 'module_released'


# ── Priority levels ──────────────────────────────────────────────

class NotificationPriority:
    LOW = 'low'
    NORMAL = 'normal'
    HIGH = 'high'
    URGENT = 'urgent'


# ── Category grouping for frontend filters ───────────────────────

NOTIFICATION_CATEGORIES = {
    'announcements': [NotificationType.ANNOUNCEMENT_NEW, NotificationType.ANNOUNCEMENT_UPDATED],
    'grades': [
        NotificationType.GRADE_ASSIGNMENT, NotificationType.GRADE_PROJECT,
        NotificationType.GRADE_QUIZ, NotificationType.GRADE_MODIFICATION_REQUESTED,
        NotificationType.GRADE_RESUBMISSION_RECEIVED, NotificationType.GRADE_FULL_CREDIT,
    ],
    'forum': [
        NotificationType.FORUM_NEW_REPLY, NotificationType.FORUM_POST_LIKED,
        NotificationType.FORUM_MENTION, NotificationType.FORUM_POST_FLAGGED,
        NotificationType.FORUM_NEW_THREAD,
    ],
    'enrollment': [NotificationType.ENROLLMENT_CONFIRMED, NotificationType.ENROLLMENT_APPLICATION_STATUS],
    'achievement': [NotificationType.ACHIEVEMENT_UNLOCKED, NotificationType.STREAK_MILESTONE, NotificationType.BADGE_EARNED],
    'ai': [NotificationType.AI_TASK_COMPLETED, NotificationType.AI_TASK_FAILED, NotificationType.CONTENT_SAVED],
    'system': [NotificationType.SYSTEM, NotificationType.COURSE_UPDATE, NotificationType.MODULE_RELEASED],
}


class Notification(db.Model):
    """General-purpose notification for all user-facing events"""
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Notification categorization
    notification_type = db.Column(db.String(50), nullable=False)
    category = db.Column(db.String(30), nullable=True)  # announcements, grades, forum, etc.
    priority = db.Column(db.String(10), default='normal')  # low, normal, high, urgent

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

    # Additional entity refs for cross-system linking
    assignment_id = db.Column(db.Integer, nullable=True)
    project_id = db.Column(db.Integer, nullable=True)
    quiz_id = db.Column(db.Integer, nullable=True)
    submission_id = db.Column(db.Integer, nullable=True)
    forum_id = db.Column(db.Integer, nullable=True)
    post_id = db.Column(db.Integer, nullable=True)
    announcement_id = db.Column(db.Integer, nullable=True)
    achievement_id = db.Column(db.Integer, nullable=True)

    # Who triggered this notification (e.g. instructor who graded)
    actor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    # Navigation hint – the frontend route to open
    action_url = db.Column(db.String(500), nullable=True)

    # Flexible JSON blob for extra data
    _metadata = db.Column('metadata', db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)  # Auto-cleanup old notifications

    # Relationships
    user = db.relationship('User', foreign_keys=[user_id], backref=db.backref('notifications', lazy='dynamic'))
    course = db.relationship('Course', backref=db.backref('notifications', lazy='dynamic'))
    actor = db.relationship('User', foreign_keys=[actor_id])

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
        actor_name = None
        if self.actor:
            actor_name = f"{self.actor.first_name} {self.actor.last_name}"

        return {
            'id': self.id,
            'user_id': self.user_id,
            'notification_type': self.notification_type,
            'category': self.category,
            'priority': self.priority,
            'title': self.title,
            'message': self.message,
            'is_read': self.is_read,
            'task_id': self.task_id,
            'task_type': self.task_type,
            'course_id': self.course_id,
            'module_id': self.module_id,
            'lesson_id': self.lesson_id,
            'assignment_id': self.assignment_id,
            'project_id': self.project_id,
            'quiz_id': self.quiz_id,
            'submission_id': self.submission_id,
            'forum_id': self.forum_id,
            'post_id': self.post_id,
            'announcement_id': self.announcement_id,
            'achievement_id': self.achievement_id,
            'actor_id': self.actor_id,
            'actor_name': actor_name,
            'action_url': self.action_url,
            'metadata': self.meta,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
        }

    def __repr__(self):
        return f'<Notification {self.id} type={self.notification_type} user={self.user_id}>'


class NotificationPreference(db.Model):
    """Per-user notification preferences"""
    __tablename__ = 'notification_preferences'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True)

    # Category-level toggles (JSON: {"grades": true, "forum": false, …})
    _category_settings = db.Column('category_settings', db.Text, nullable=True)

    # Delivery channel preferences
    in_app_enabled = db.Column(db.Boolean, default=True)
    email_enabled = db.Column(db.Boolean, default=True)

    # Quiet hours (UTC)
    quiet_start_hour = db.Column(db.Integer, nullable=True)  # 0-23
    quiet_end_hour = db.Column(db.Integer, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('notification_preferences', uselist=False))

    @property
    def category_settings(self):
        if self._category_settings:
            try:
                return json.loads(self._category_settings)
            except (json.JSONDecodeError, TypeError):
                return {}
        return {}

    @category_settings.setter
    def category_settings(self, value):
        self._category_settings = json.dumps(value) if value else None

    def is_category_enabled(self, category: str) -> bool:
        settings = self.category_settings
        return settings.get(category, True)  # Default: enabled

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'category_settings': self.category_settings,
            'in_app_enabled': self.in_app_enabled,
            'email_enabled': self.email_enabled,
            'quiet_start_hour': self.quiet_start_hour,
            'quiet_end_hour': self.quiet_end_hour,
        }
