"""Administrative coordination models: meetings, activities, communication,
documents, requests, follow-ups and escalations.

These tables back the Company Secretary workspace. They are deliberately free
of any financial column — no amounts, no commissions, no payroll values.
"""

from datetime import date, datetime, timedelta, timezone

from ..extensions import db
from .user import TimestampMixin


# ── shared choices ───────────────────────────────────────────────────────────

ACTIVITY_CATEGORIES = (
    'Administration', 'Meeting', 'Employee Coordination', 'Management Follow-up',
    'Documentation', 'Planning', 'Communication', 'Event',
    'Department Coordination', 'Branch Coordination', 'Other',
)

ACTIVITY_STATUSES = ('planned', 'in_progress', 'completed', 'postponed', 'cancelled')

ACTIVITY_PRIORITIES = ('low', 'medium', 'high', 'urgent')

MEETING_STATUSES = ('scheduled', 'in_progress', 'completed', 'cancelled')

REQUEST_TYPES = (
    'administrative', 'document', 'schedule', 'equipment', 'leave', 'meeting', 'other',
)

REQUEST_STATUSES = (
    'submitted', 'in_review', 'more_info', 'forwarded', 'approved', 'rejected', 'closed',
)

DOCUMENT_CATEGORIES = (
    'administrative', 'meeting_minutes', 'activity_plan', 'schedule',
    'form', 'notice', 'company',
)

ANNOUNCEMENT_CATEGORIES = (
    'staff_announcement', 'meeting_notice', 'schedule_update',
    'administrative_instruction', 'training_reminder', 'office_notice',
    'internal_deadline', 'other',
)

AUDIENCES = ('all', 'department', 'branch', 'custom')

FOLLOWUP_STATUSES = ('open', 'waiting', 'done', 'escalated', 'cancelled')

ESCALATION_STATUSES = ('created', 'assigned', 'resolved', 'dismissed')

ACTION_ITEM_STATUSES = ('open', 'in_progress', 'done', 'cancelled')


def _time_str(value):
    return value.strftime('%H:%M') if value else None


def _date_str(value):
    return value.isoformat() if value else None


def _naive_utc(value):
    """Normalize a stored timestamp to naive UTC for arithmetic.

    SQLite ignores the timezone on ``DateTime(timezone=True)`` columns and hands
    back naive values, so comparing one directly against ``datetime.now(tz)``
    raises TypeError. Normalizing both sides keeps the comparison total.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _utcnow_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── meetings ─────────────────────────────────────────────────────────────────


class Meeting(TimestampMixin, db.Model):
    __tablename__ = 'meetings'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.String(2000))
    meeting_date = db.Column(db.Date, nullable=False, index=True)
    start_time = db.Column(db.Time)
    end_time = db.Column(db.Time)
    location = db.Column(db.String(255))
    online_link = db.Column(db.String(500))
    status = db.Column(db.String(16), default='scheduled', nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey('departments.id'))
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    organizer_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    organizer = db.relationship('User', foreign_keys=[organizer_id])
    creator = db.relationship('User', foreign_keys=[created_by])
    department = db.relationship('Department')
    branch = db.relationship('Branch')
    participants = db.relationship('MeetingParticipant', backref='meeting',
                                   cascade='all, delete-orphan', lazy='selectin')
    agenda = db.relationship('AgendaItem', backref='meeting',
                             cascade='all, delete-orphan', order_by='AgendaItem.position')
    minutes = db.relationship('MeetingMinute', backref='meeting',
                              cascade='all, delete-orphan')
    action_items = db.relationship('ActionItem', backref='meeting',
                                   cascade='all, delete-orphan')

    @property
    def starts_at(self):
        if not self.meeting_date:
            return None
        from datetime import datetime, time as _time
        return datetime.combine(self.meeting_date, self.start_time or _time(0, 0))

    def to_dict(self, with_children=False):
        data = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'meeting_date': _date_str(self.meeting_date),
            'start_time': _time_str(self.start_time),
            'end_time': _time_str(self.end_time),
            'location': self.location,
            'online_link': self.online_link,
            'status': self.status,
            'department_id': self.department_id,
            'department': self.department.name if self.department else None,
            'branch_id': self.branch_id,
            'branch': self.branch.name if self.branch else None,
            'organizer_id': self.organizer_id,
            'organizer': self.organizer.employee.full_name if self.organizer and self.organizer.employee else (self.organizer.email if self.organizer else None),
            'created_by': self.created_by,
            'participant_count': len(self.participants),
            'agenda_count': len(self.agenda),
            'action_item_count': len(self.action_items),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if with_children:
            data['participants'] = [p.to_dict() for p in self.participants]
            data['agenda'] = [a.to_dict() for a in self.agenda]
            data['minutes'] = [m.to_dict() for m in self.minutes]
            data['action_items'] = [a.to_dict() for a in self.action_items]
        return data


class MeetingParticipant(TimestampMixin, db.Model):
    __tablename__ = 'meeting_participants'

    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey('meetings.id'), nullable=False, index=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False, index=True)
    response = db.Column(db.String(16), default='invited')  # invited | accepted | declined
    attended = db.Column(db.Boolean, default=False, nullable=False)

    employee = db.relationship('Employee')

    def to_dict(self):
        return {
            'id': self.id,
            'meeting_id': self.meeting_id,
            'employee_id': self.employee_id,
            'employee_name': self.employee.full_name if self.employee else None,
            'position': self.employee.position if self.employee else None,
            'department': self.employee.department.name if self.employee and self.employee.department else None,
            'response': self.response,
            'attended': self.attended,
        }


class AgendaItem(TimestampMixin, db.Model):
    __tablename__ = 'agenda_items'

    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey('meetings.id'), nullable=False, index=True)
    position = db.Column(db.Integer, default=1, nullable=False)
    title = db.Column(db.String(255), nullable=False)
    notes = db.Column(db.String(2000))
    presenter_id = db.Column(db.Integer, db.ForeignKey('employees.id'))
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'))

    presenter = db.relationship('Employee')
    task = db.relationship('Task')

    def to_dict(self):
        return {
            'id': self.id,
            'meeting_id': self.meeting_id,
            'position': self.position,
            'title': self.title,
            'notes': self.notes,
            'presenter_id': self.presenter_id,
            'presenter': self.presenter.full_name if self.presenter else None,
            'task_id': self.task_id,
        }


class MeetingMinute(TimestampMixin, db.Model):
    __tablename__ = 'meeting_minutes'

    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey('meetings.id'), nullable=False, index=True)
    summary = db.Column(db.String(500))
    discussion = db.Column(db.Text)
    decisions = db.Column(db.Text)
    attachments = db.Column(db.Text)  # JSON list of document ids
    recorded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    recorder = db.relationship('User')

    def to_dict(self):
        import json
        try:
            attachment_ids = json.loads(self.attachments or '[]')
        except Exception:
            attachment_ids = []
        return {
            'id': self.id,
            'meeting_id': self.meeting_id,
            'meeting_title': self.meeting.title if self.meeting else None,
            'meeting_date': _date_str(self.meeting.meeting_date) if self.meeting else None,
            'summary': self.summary,
            'discussion': self.discussion,
            'decisions': self.decisions,
            'attachment_ids': attachment_ids,
            'recorded_by': self.recorded_by,
            'recorded_at': self.created_at.isoformat() if self.created_at else None,
        }


class ActionItem(TimestampMixin, db.Model):
    __tablename__ = 'action_items'

    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey('meetings.id'), index=True)
    minute_id = db.Column(db.Integer, db.ForeignKey('meeting_minutes.id'))
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.String(2000))
    responsible_id = db.Column(db.Integer, db.ForeignKey('employees.id'))
    deadline = db.Column(db.Date)
    status = db.Column(db.String(16), default='open', nullable=False)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'))
    completed_date = db.Column(db.DateTime(timezone=True))

    responsible = db.relationship('Employee')
    minute = db.relationship('MeetingMinute')
    task = db.relationship('Task')

    @property
    def is_overdue(self):
        return (self.deadline is not None and self.status in ('open', 'in_progress')
                and self.deadline < date.today())

    def to_dict(self):
        return {
            'id': self.id,
            'meeting_id': self.meeting_id,
            'meeting_title': self.meeting.title if self.meeting else None,
            'meeting_date': _date_str(self.meeting.meeting_date) if self.meeting else None,
            'minute_id': self.minute_id,
            'title': self.title,
            'description': self.description,
            'responsible_id': self.responsible_id,
            'responsible': self.responsible.full_name if self.responsible else None,
            'deadline': _date_str(self.deadline),
            'status': self.status,
            'task_id': self.task_id,
            'is_overdue': self.is_overdue,
            'completed_date': self.completed_date.isoformat() if self.completed_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ── activities (company + personal planner) ──────────────────────────────────


class Activity(TimestampMixin, db.Model):
    __tablename__ = 'activities'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.String(2000))
    activity_date = db.Column(db.Date, nullable=False, index=True)
    start_time = db.Column(db.Time)
    end_time = db.Column(db.Time)
    category = db.Column(db.String(48), default='Administration', nullable=False)
    priority = db.Column(db.String(16), default='medium', nullable=False)
    location = db.Column(db.String(255))
    expected_outcome = db.Column(db.String(500))
    status = db.Column(db.String(16), default='planned', nullable=False)
    notes = db.Column(db.String(2000))
    # 'company' = organisation-wide event, 'personal' = owner's own plan
    scope = db.Column(db.String(16), default='company', nullable=False, index=True)
    owner_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), index=True)
    organizer_id = db.Column(db.Integer, db.ForeignKey('employees.id'))
    department_id = db.Column(db.Integer, db.ForeignKey('departments.id'))
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    position = db.Column(db.Integer, default=0, nullable=False)  # daily planner order
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    owner = db.relationship('User', foreign_keys=[owner_user_id])
    creator = db.relationship('User', foreign_keys=[created_by])
    organizer = db.relationship('Employee')
    department = db.relationship('Department')
    branch = db.relationship('Branch')
    participants = db.relationship('ActivityParticipant', backref='activity',
                                   cascade='all, delete-orphan')
    checklist = db.relationship('ActivityChecklistItem', backref='activity',
                                cascade='all, delete-orphan',
                                order_by='ActivityChecklistItem.position')

    def to_dict(self, with_children=False):
        data = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'activity_date': _date_str(self.activity_date),
            'start_time': _time_str(self.start_time),
            'end_time': _time_str(self.end_time),
            'category': self.category,
            'priority': self.priority,
            'location': self.location,
            'expected_outcome': self.expected_outcome,
            'status': self.status,
            'notes': self.notes,
            'scope': self.scope,
            'owner_user_id': self.owner_user_id,
            'organizer_id': self.organizer_id,
            'organizer': self.organizer.full_name if self.organizer else None,
            'department_id': self.department_id,
            'department': self.department.name if self.department else None,
            'branch_id': self.branch_id,
            'branch': self.branch.name if self.branch else None,
            'position': self.position,
            'created_by': self.created_by,
            'participant_count': len(self.participants),
            'checklist_total': len(self.checklist),
            'checklist_done': sum(1 for c in self.checklist if c.is_done),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if with_children:
            data['participants'] = [p.to_dict() for p in self.participants]
            data['checklist'] = [c.to_dict() for c in self.checklist]
        return data


class ActivityParticipant(db.Model):
    __tablename__ = 'activity_participants'

    id = db.Column(db.Integer, primary_key=True)
    activity_id = db.Column(db.Integer, db.ForeignKey('activities.id'), nullable=False, index=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False, index=True)

    employee = db.relationship('Employee')

    def to_dict(self):
        return {
            'id': self.id,
            'activity_id': self.activity_id,
            'employee_id': self.employee_id,
            'employee_name': self.employee.full_name if self.employee else None,
            'department': self.employee.department.name if self.employee and self.employee.department else None,
        }


class ActivityChecklistItem(TimestampMixin, db.Model):
    __tablename__ = 'activity_checklist_items'

    id = db.Column(db.Integer, primary_key=True)
    activity_id = db.Column(db.Integer, db.ForeignKey('activities.id'), nullable=False, index=True)
    position = db.Column(db.Integer, default=1, nullable=False)
    title = db.Column(db.String(255), nullable=False)
    is_done = db.Column(db.Boolean, default=False, nullable=False)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'))
    completed_at = db.Column(db.DateTime(timezone=True))

    task = db.relationship('Task')

    def to_dict(self):
        return {
            'id': self.id,
            'activity_id': self.activity_id,
            'position': self.position,
            'title': self.title,
            'is_done': self.is_done,
            'task_id': self.task_id,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
        }


# ── internal communication ───────────────────────────────────────────────────


class Announcement(TimestampMixin, db.Model):
    __tablename__ = 'announcements'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(48), default='staff_announcement', nullable=False)
    audience = db.Column(db.String(16), default='all', nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey('departments.id'))
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    recipient_ids = db.Column(db.Text)  # JSON list when audience == 'custom'
    priority = db.Column(db.String(16), default='normal', nullable=False)
    publish_date = db.Column(db.Date, default=date.today, nullable=False, index=True)
    expiry_date = db.Column(db.Date)
    requires_ack = db.Column(db.Boolean, default=False, nullable=False)
    attachment_document_id = db.Column(db.Integer, db.ForeignKey('documents.id'))
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    creator = db.relationship('User')
    department = db.relationship('Department')
    branch = db.relationship('Branch')
    attachment = db.relationship('Document')
    acknowledgements = db.relationship('AnnouncementAck', backref='announcement',
                                       cascade='all, delete-orphan')

    @property
    def is_active(self):
        today = date.today()
        return self.publish_date <= today and (self.expiry_date is None or self.expiry_date >= today)

    def to_dict(self, with_stats=False):
        import json
        try:
            recipients = json.loads(self.recipient_ids or '[]')
        except Exception:
            recipients = []
        data = {
            'id': self.id,
            'title': self.title,
            'message': self.message,
            'category': self.category,
            'audience': self.audience,
            'department_id': self.department_id,
            'department': self.department.name if self.department else None,
            'branch_id': self.branch_id,
            'branch': self.branch.name if self.branch else None,
            'recipient_ids': recipients,
            'priority': self.priority,
            'publish_date': _date_str(self.publish_date),
            'expiry_date': _date_str(self.expiry_date),
            'requires_ack': self.requires_ack,
            'attachment_document_id': self.attachment_document_id,
            'attachment_name': self.attachment.file_name if self.attachment else None,
            'created_by': self.created_by,
            'is_active': self.is_active,
            'ack_count': len(self.acknowledgements),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if with_stats:
            data['acknowledged'] = [a.to_dict() for a in self.acknowledgements]
        return data


class AnnouncementAck(db.Model):
    __tablename__ = 'announcement_acks'

    id = db.Column(db.Integer, primary_key=True)
    announcement_id = db.Column(db.Integer, db.ForeignKey('announcements.id'), nullable=False, index=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    acknowledged_at = db.Column(db.DateTime(timezone=True), nullable=False)

    employee = db.relationship('Employee')
    user = db.relationship('User')

    def to_dict(self):
        return {
            'id': self.id,
            'announcement_id': self.announcement_id,
            'employee_id': self.employee_id,
            'employee_name': self.employee.full_name if self.employee else None,
            'acknowledged_at': self.acknowledged_at.isoformat() if self.acknowledged_at else None,
            'status': 'acknowledged',
        }


class Memo(TimestampMixin, db.Model):
    __tablename__ = 'memos'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(48), default='office_notice', nullable=False)
    audience = db.Column(db.String(16), default='all', nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey('departments.id'))
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    recipient_ids = db.Column(db.Text)
    attachment_document_id = db.Column(db.Integer, db.ForeignKey('documents.id'))
    published_at = db.Column(db.DateTime(timezone=True))
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    creator = db.relationship('User')
    department = db.relationship('Department')
    branch = db.relationship('Branch')
    attachment = db.relationship('Document')

    def to_dict(self):
        import json
        try:
            recipients = json.loads(self.recipient_ids or '[]')
        except Exception:
            recipients = []
        return {
            'id': self.id,
            'title': self.title,
            'message': self.message,
            'category': self.category,
            'audience': self.audience,
            'department_id': self.department_id,
            'department': self.department.name if self.department else None,
            'branch_id': self.branch_id,
            'branch': self.branch.name if self.branch else None,
            'recipient_ids': recipients,
            'attachment_document_id': self.attachment_document_id,
            'attachment_name': self.attachment.file_name if self.attachment else None,
            'published_at': self.published_at.isoformat() if self.published_at else None,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ── documents ────────────────────────────────────────────────────────────────


class Document(TimestampMixin, db.Model):
    __tablename__ = 'documents'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.String(1000))
    category = db.Column(db.String(32), default='administrative', nullable=False, index=True)
    file_name = db.Column(db.String(255), nullable=False)
    stored_name = db.Column(db.String(255), nullable=False)
    content_type = db.Column(db.String(128))
    size_bytes = db.Column(db.Integer, default=0)
    meeting_id = db.Column(db.Integer, db.ForeignKey('meetings.id'))
    activity_id = db.Column(db.Integer, db.ForeignKey('activities.id'))
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    uploader = db.relationship('User')

    @property
    def extension(self):
        return (self.file_name.rsplit('.', 1)[-1].lower() if '.' in self.file_name else '')

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'category': self.category,
            'file_name': self.file_name,
            'content_type': self.content_type,
            'size_bytes': self.size_bytes,
            'extension': self.extension,
            'meeting_id': self.meeting_id,
            'activity_id': self.activity_id,
            'uploaded_by': self.uploaded_by,
            'uploader': self.uploader.employee.full_name if self.uploader and self.uploader.employee else (self.uploader.email if self.uploader else None),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ── administrative requests ──────────────────────────────────────────────────


class AdminRequest(TimestampMixin, db.Model):
    __tablename__ = 'admin_requests'

    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(32), default='administrative', nullable=False, index=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.String(2000))
    requested_by = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False, index=True)
    assigned_to = db.Column(db.Integer, db.ForeignKey('employees.id'))
    department_id = db.Column(db.Integer, db.ForeignKey('departments.id'))
    status = db.Column(db.String(16), default='submitted', nullable=False, index=True)
    priority = db.Column(db.String(16), default='medium', nullable=False)
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    due_date = db.Column(db.Date)
    resolution = db.Column(db.String(2000))
    reviewed_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    reviewed_at = db.Column(db.DateTime(timezone=True))

    requester = db.relationship('Employee', foreign_keys=[requested_by])
    assignee = db.relationship('Employee', foreign_keys=[assigned_to])
    reviewer = db.relationship('User')
    department = db.relationship('Department')

    @property
    def is_stale(self):
        created = _naive_utc(self.created_at)
        if created is None:
            return False
        threshold = _utcnow_naive() - timedelta(days=2)
        return self.status in ('submitted', 'in_review', 'forwarded', 'more_info') \
            and created < threshold

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'title': self.title,
            'description': self.description,
            'requested_by': self.requested_by,
            'requester': self.requester.full_name if self.requester else None,
            'requester_department': self.requester.department.name if self.requester and self.requester.department else None,
            'assigned_to': self.assigned_to,
            'assignee': self.assignee.full_name if self.assignee else None,
            'department_id': self.department_id,
            'status': self.status,
            'priority': self.priority,
            'start_date': _date_str(self.start_date),
            'end_date': _date_str(self.end_date),
            'due_date': _date_str(self.due_date),
            'resolution': self.resolution,
            'reviewed_by': self.reviewed_by,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'is_stale': self.is_stale,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ── follow-ups ───────────────────────────────────────────────────────────────


class FollowUp(TimestampMixin, db.Model):
    __tablename__ = 'followups'

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False, index=True)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'))
    subject = db.Column(db.String(255), nullable=False)
    notes = db.Column(db.String(2000))
    last_update = db.Column(db.DateTime(timezone=True))
    next_follow_up = db.Column(db.Date)
    deadline = db.Column(db.Date)
    status = db.Column(db.String(16), default='open', nullable=False, index=True)
    priority = db.Column(db.String(16), default='medium', nullable=False)
    last_action = db.Column(db.String(255))
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    employee = db.relationship('Employee')
    task = db.relationship('Task')
    creator = db.relationship('User')

    @property
    def is_overdue(self):
        return self.next_follow_up is not None and self.next_follow_up < date.today() \
            and self.status in ('open', 'waiting')

    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'employee': self.employee.full_name if self.employee else None,
            'employee_position': self.employee.position if self.employee else None,
            'department': self.employee.department.name if self.employee and self.employee.department else None,
            'task_id': self.task_id,
            'task_title': self.task.title if self.task else None,
            'task_status': self.task.status if self.task else None,
            'task_due_date': _date_str(self.task.due_date) if self.task else None,
            'subject': self.subject,
            'notes': self.notes,
            'last_update': self.last_update.isoformat() if self.last_update else None,
            'next_follow_up': _date_str(self.next_follow_up),
            'deadline': _date_str(self.deadline),
            'status': self.status,
            'priority': self.priority,
            'last_action': self.last_action,
            'is_overdue': self.is_overdue,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ── escalations ──────────────────────────────────────────────────────────────


class Escalation(TimestampMixin, db.Model):
    __tablename__ = 'escalations'

    id = db.Column(db.Integer, primary_key=True)
    subject = db.Column(db.String(255), nullable=False)
    issue = db.Column(db.String(2000), nullable=False)
    reason = db.Column(db.String(2000))
    escalate_to = db.Column(db.String(16), default='manager', nullable=False)  # manager | super_admin
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id'))
    status = db.Column(db.String(16), default='created', nullable=False, index=True)
    priority = db.Column(db.String(16), default='high', nullable=False)
    related_type = db.Column(db.String(32))
    related_id = db.Column(db.Integer)
    resolution = db.Column(db.String(2000))
    resolved_at = db.Column(db.DateTime(timezone=True))
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    assignee = db.relationship('User', foreign_keys=[assigned_to])
    creator = db.relationship('User', foreign_keys=[created_by])

    def to_dict(self):
        return {
            'id': self.id,
            'subject': self.subject,
            'issue': self.issue,
            'reason': self.reason,
            'escalate_to': self.escalate_to,
            'assigned_to': self.assigned_to,
            'assignee': self.assignee.email if self.assignee else None,
            'status': self.status,
            'priority': self.priority,
            'related_type': self.related_type,
            'related_id': self.related_id,
            'resolution': self.resolution,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
