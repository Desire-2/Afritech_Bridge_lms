from datetime import date
from ..extensions import db
from .user import TimestampMixin, utcnow


class Attendance(TimestampMixin, db.Model):
    __tablename__ = 'attendance'

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False, index=True)
    attendance_date = db.Column(db.Date, default=date.today, nullable=False, index=True)
    clock_in = db.Column(db.DateTime(timezone=True))
    clock_out = db.Column(db.DateTime(timezone=True))
    status = db.Column(db.String(16), default='present', nullable=False)  # present | late | absent | leave | overtime
    total_hours = db.Column(db.Numeric(6, 2), default=0)
    overtime_hours = db.Column(db.Numeric(6, 2), default=0)
    note = db.Column(db.String(255))
    recorded_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    employee = db.relationship('Employee', backref='attendance')

    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'employee_name': self.employee.full_name if self.employee else None,
            'attendance_date': self.attendance_date.isoformat() if self.attendance_date else None,
            'clock_in': self.clock_in.isoformat() if self.clock_in else None,
            'clock_out': self.clock_out.isoformat() if self.clock_out else None,
            'status': self.status,
            'total_hours': float(self.total_hours or 0),
            'overtime_hours': float(self.overtime_hours or 0),
            'note': self.note,
        }


class WorkSchedule(TimestampMixin, db.Model):
    __tablename__ = 'work_schedules'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    late_threshold_minutes = db.Column(db.Integer, default=15)
    workdays = db.Column(db.String(16), default='mon-fri')  # mon-fri | mon-sat | daily | custom
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'start_time': self.start_time.strftime('%H:%M'),
            'end_time': self.end_time.strftime('%H:%M'),
            'late_threshold_minutes': self.late_threshold_minutes,
            'workdays': self.workdays,
            'is_active': self.is_active,
        }


class Task(TimestampMixin, db.Model):
    __tablename__ = 'tasks'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.String(1000))
    assigned_to = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False, index=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    priority = db.Column(db.String(16), default='medium', nullable=False)  # low | medium | high | urgent
    due_date = db.Column(db.Date)
    # todo -> in_progress -> submitted -> verified  (+ rejected | cancelled)
    status = db.Column(db.String(16), default='todo', nullable=False)
    completed_date = db.Column(db.DateTime(timezone=True))
    submitted_date = db.Column(db.DateTime(timezone=True))
    comments = db.Column(db.String(1000))
    attachments = db.Column(db.Text)  # JSON list of document ids
    meeting_id = db.Column(db.Integer, db.ForeignKey('meetings.id'))
    activity_id = db.Column(db.Integer, db.ForeignKey('activities.id'))

    assignee = db.relationship('Employee', foreign_keys=[assigned_to], backref='tasks')
    creator = db.relationship('User', foreign_keys=[created_by])

    OPEN_STATUSES = ('todo', 'in_progress', 'submitted')

    def to_dict(self):
        import json
        try:
            attachment_ids = json.loads(self.attachments or '[]')
        except Exception:
            attachment_ids = []
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'assigned_to': self.assigned_to,
            'assignee_name': self.assignee.full_name if self.assignee else None,
            'assignee_position': self.assignee.position if self.assignee else None,
            'created_by': self.created_by,
            'priority': self.priority,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'status': self.status,
            'completed_date': self.completed_date.isoformat() if self.completed_date else None,
            'submitted_date': self.submitted_date.isoformat() if self.submitted_date else None,
            'comments': self.comments,
            'attachment_ids': attachment_ids,
            'meeting_id': self.meeting_id,
            'activity_id': self.activity_id,
            'is_overdue': self.due_date is not None and self.status in self.OPEN_STATUSES and self.due_date < date.today(),
            'is_open': self.status in self.OPEN_STATUSES,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class TaskComment(TimestampMixin, db.Model):
    __tablename__ = 'task_comments'

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=False, index=True)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    body = db.Column(db.String(2000), nullable=False)

    task = db.relationship('Task', backref=db.backref('comment_rows', cascade='all, delete-orphan',
                                                      order_by='TaskComment.created_at'))
    author = db.relationship('User')

    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'author_id': self.author_id,
            'author': self.author.employee.full_name if self.author and self.author.employee else (self.author.email if self.author else None),
            'body': self.body,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }