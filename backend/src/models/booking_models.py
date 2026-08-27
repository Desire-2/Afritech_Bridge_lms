from ..utils.time_utils import now_local
"""
Booking Models for AfriTech Bridge LMS

Native one-to-one session booking system between students and instructors.

Models:
- InstructorAvailability: Recurring weekly availability schedules
- AvailabilityException: Specific date overrides (blocks or special hours)
- Booking: Student-instructor session appointments
"""

from datetime import datetime, date, time
from .user_models import db


class BookingStatus:
    PENDING = 'pending'
    CONFIRMED = 'confirmed'
    CANCELLED = 'cancelled'
    COMPLETED = 'completed'
    NO_SHOW = 'no_show'
    RESCHEDULED = 'rescheduled'
    DECLINED = 'declined'


class InstructorAvailability(db.Model):
    """Recurring weekly availability for an instructor."""
    __tablename__ = 'instructor_availability'

    id = db.Column(db.Integer, primary_key=True)
    instructor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    day_of_week = db.Column(db.Integer, nullable=False)  # 0=Monday ... 6=Sunday
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    timezone = db.Column(db.String(50), nullable=False, default='UTC')
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    effective_from = db.Column(db.Date, nullable=True)
    effective_until = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=now_local)
    updated_at = db.Column(db.DateTime, default=now_local, onupdate=now_local)

    instructor = db.relationship('User', backref=db.backref('availability_slots', lazy='dynamic'))

    __table_args__ = (
        db.CheckConstraint('day_of_week >= 0 AND day_of_week <= 6', name='ck_availability_day_range'),
        db.CheckConstraint('start_time < end_time', name='ck_availability_time_order'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'instructor_id': self.instructor_id,
            'day_of_week': self.day_of_week,
            'day_name': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][self.day_of_week],
            'start_time': self.start_time.strftime('%H:%M') if self.start_time else None,
            'end_time': self.end_time.strftime('%H:%M') if self.end_time else None,
            'timezone': self.timezone,
            'is_active': self.is_active,
            'effective_from': self.effective_from.isoformat() if self.effective_from else None,
            'effective_until': self.effective_until.isoformat() if self.effective_until else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class AvailabilityException(db.Model):
    """Specific date overrides: blocks or special hours for an instructor."""
    __tablename__ = 'availability_exceptions'

    id = db.Column(db.Integer, primary_key=True)
    instructor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, index=True)
    is_blocked = db.Column(db.Boolean, nullable=False, default=True)
    start_time = db.Column(db.Time, nullable=True)
    end_time = db.Column(db.Time, nullable=True)
    reason = db.Column(db.String(255), nullable=True)
    timezone = db.Column(db.String(50), nullable=False, default='UTC')
    created_at = db.Column(db.DateTime, default=now_local)
    updated_at = db.Column(db.DateTime, default=now_local, onupdate=now_local)

    instructor = db.relationship('User', backref=db.backref('availability_exceptions', lazy='dynamic'))

    __table_args__ = (
        db.UniqueConstraint('instructor_id', 'date', 'start_time', name='uq_exception_instructor_date_time'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'instructor_id': self.instructor_id,
            'date': self.date.isoformat() if self.date else None,
            'is_blocked': self.is_blocked,
            'start_time': self.start_time.strftime('%H:%M') if self.start_time else None,
            'end_time': self.end_time.strftime('%H:%M') if self.end_time else None,
            'reason': self.reason,
            'timezone': self.timezone,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class Booking(db.Model):
    """A one-to-one session booking between a student and an instructor."""
    __tablename__ = 'bookings'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    instructor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=True, index=True)

    start_datetime = db.Column(db.DateTime, nullable=False, index=True)
    end_datetime = db.Column(db.DateTime, nullable=False)
    timezone = db.Column(db.String(50), nullable=False, default='UTC')

    status = db.Column(db.String(20), nullable=False, default=BookingStatus.PENDING, index=True)

    session_topic = db.Column(db.String(255), nullable=False)
    student_notes = db.Column(db.Text, nullable=True)
    instructor_notes = db.Column(db.Text, nullable=True)
    cancellation_reason = db.Column(db.Text, nullable=True)
    cancelled_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    cancelled_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    no_show_marked_at = db.Column(db.DateTime, nullable=True)

    confirmed_at = db.Column(db.DateTime, nullable=True)
    confirmed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    declined_at = db.Column(db.DateTime, nullable=True)
    declined_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    meeting_url = db.Column(db.String(500), nullable=True)
    meeting_provider = db.Column(db.String(50), nullable=True)

    reminder_24h_sent = db.Column(db.Boolean, nullable=False, default=False)
    reminder_1h_sent = db.Column(db.Boolean, nullable=False, default=False)

    created_at = db.Column(db.DateTime, default=now_local)
    updated_at = db.Column(db.DateTime, default=now_local, onupdate=now_local)

    student = db.relationship('User', foreign_keys=[student_id], backref=db.backref('bookings_as_student', lazy='dynamic'))
    instructor = db.relationship('User', foreign_keys=[instructor_id], backref=db.backref('bookings_as_instructor', lazy='dynamic'))
    canceller = db.relationship('User', foreign_keys=[cancelled_by])
    confirmer = db.relationship('User', foreign_keys=[confirmed_by])
    decliner = db.relationship('User', foreign_keys=[declined_by])
    course = db.relationship('Course', backref=db.backref('bookings', lazy='dynamic'))

    __table_args__ = (
        db.CheckConstraint('start_datetime < end_datetime', name='ck_booking_time_order'),
        db.CheckConstraint("status IN ('pending','confirmed','cancelled','completed','no_show','rescheduled','declined')",
                           name='ck_booking_status_values'),
        db.Index('idx_booking_instructor_start', 'instructor_id', 'start_datetime'),
        db.Index('idx_booking_student_status', 'student_id', 'status'),
        db.Index('idx_booking_status_start', 'status', 'start_datetime'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'instructor_id': self.instructor_id,
            'course_id': self.course_id,
            'start_datetime': self.start_datetime.isoformat() if self.start_datetime else None,
            'end_datetime': self.end_datetime.isoformat() if self.end_datetime else None,
            'timezone': self.timezone,
            'status': self.status,
            'session_topic': self.session_topic,
            'student_notes': self.student_notes,
            'instructor_notes': self.instructor_notes,
            'cancellation_reason': self.cancellation_reason,
            'cancelled_by': self.cancelled_by,
            'cancelled_at': self.cancelled_at.isoformat() if self.cancelled_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'no_show_marked_at': self.no_show_marked_at.isoformat() if self.no_show_marked_at else None,
            'confirmed_at': self.confirmed_at.isoformat() if self.confirmed_at else None,
            'confirmed_by': self.confirmed_by,
            'declined_at': self.declined_at.isoformat() if self.declined_at else None,
            'declined_by': self.declined_by,
            'meeting_url': self.meeting_url,
            'meeting_provider': self.meeting_provider,
            'reminder_24h_sent': self.reminder_24h_sent,
            'reminder_1h_sent': self.reminder_1h_sent,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'student_name': f"{self.student.first_name} {self.student.last_name}" if self.student else None,
            'student_email': self.student.email if self.student else None,
            'student_avatar': self.student.profile_picture_url if self.student else None,
            'instructor_name': f"{self.instructor.first_name} {self.instructor.last_name}" if self.instructor else None,
            'instructor_email': self.instructor.email if self.instructor else None,
            'instructor_avatar': self.instructor.profile_picture_url if self.instructor else None,
            'course_name': self.course.title if self.course else None,
            'cancelled_by_name': f"{self.canceller.first_name} {self.canceller.last_name}" if self.canceller else None,
            'confirmed_by_name': f"{self.confirmer.first_name} {self.confirmer.last_name}" if self.confirmer else None,
            'declined_by_name': f"{self.decliner.first_name} {self.decliner.last_name}" if self.decliner else None,
        }

    def to_dict_minimal(self):
        return {
            'id': self.id,
            'start_datetime': self.start_datetime.isoformat() if self.start_datetime else None,
            'end_datetime': self.end_datetime.isoformat() if self.end_datetime else None,
            'status': self.status,
            'session_topic': self.session_topic,
            'student_name': f"{self.student.first_name} {self.student.last_name}" if self.student else None,
            'instructor_name': f"{self.instructor.first_name} {self.instructor.last_name}" if self.instructor else None,
        }
