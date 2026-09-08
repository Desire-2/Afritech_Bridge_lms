from datetime import date
from ..extensions import db
from .user import TimestampMixin


class Instructor(TimestampMixin, db.Model):
    __tablename__ = 'instructors'

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False, unique=True)
    specialization = db.Column(db.String(255))
    bio = db.Column(db.String(1000))
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    weekly_plans = db.relationship('WeeklyPlan', backref='instructor')
    performance_scores = db.relationship('PerformanceScore', backref='instructor_obj')

    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'name': self.employee.full_name if self.employee else None,
            'specialization': self.specialization,
            'bio': self.bio,
            'is_active': self.is_active,
        }


class Course(TimestampMixin, db.Model):
    __tablename__ = 'courses'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(64), unique=True, nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.String(1000))
    lms_course_id = db.Column(db.String(64), index=True)  # remote LMS identifier
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    cohorts = db.relationship('Cohort', backref='course')

    def to_dict(self):
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'description': self.description,
            'lms_course_id': self.lms_course_id,
            'is_active': self.is_active,
        }


class Cohort(TimestampMixin, db.Model):
    __tablename__ = 'cohorts'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(64), unique=True, nullable=False)
    name = db.Column(db.String(255), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    lms_cohort_id = db.Column(db.String(64), index=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    assignments = db.relationship('Assignment', backref='cohort')
    learners = db.relationship('Learner', backref='cohort')

    def to_dict(self):
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'course_id': self.course_id,
            'course_name': self.course.name if self.course else None,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'lms_cohort_id': self.lms_cohort_id,
            'is_active': self.is_active,
        }


class InstructorAssignment(TimestampMixin, db.Model):
    __tablename__ = 'instructor_assignments'

    id = db.Column(db.Integer, primary_key=True)
    instructor_id = db.Column(db.Integer, db.ForeignKey('instructors.id'), nullable=False)
    cohort_id = db.Column(db.Integer, db.ForeignKey('cohorts.id'), nullable=False)
    is_primary = db.Column(db.Boolean, default=True)
    is_active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': self.id,
            'instructor_id': self.instructor_id,
            'cohort_id': self.cohort_id,
            'cohort': self.cohort.name if self.cohort else None,
            'course': self.cohort.course.name if self.cohort and self.cohort.course else None,
            'is_primary': self.is_primary,
            'is_active': self.is_active,
        }


class WeeklyPlan(TimestampMixin, db.Model):
    __tablename__ = 'weekly_plans'

    id = db.Column(db.Integer, primary_key=True)
    instructor_id = db.Column(db.Integer, db.ForeignKey('instructors.id'), nullable=False)
    week_start = db.Column(db.Date, nullable=False, index=True)
    week_end = db.Column(db.Date, nullable=False)
    title = db.Column(db.String(255))
    status = db.Column(db.String(16), default='planned', nullable=False)  # planned | in_progress | completed
    note = db.Column(db.String(1000))

    activities = db.relationship('WeeklyPlanActivity', backref='plan', cascade='all, delete-orphan', order_by='WeeklyPlanActivity.activity_date')

    def progress_percent(self):
        total = len(self.activities)
        if total == 0:
            return 0
        done = sum(1 for a in self.activities if a.status in ('done', 'completed', 'cancelled'))
        return round(done / total * 100)

    def to_dict(self):
        return {
            'id': self.id,
            'instructor_id': self.instructor_id,
            'instructor_name': self.instructor.employee.full_name if self.instructor and self.instructor.employee else None,
            'week_start': self.week_start.isoformat(),
            'week_end': self.week_end.isoformat(),
            'title': self.title,
            'status': self.status,
            'note': self.note,
            'activity_count': len(self.activities),
            'completed_count': sum(1 for a in self.activities if a.status in ('done', 'completed', 'cancelled')),
            'progress_percent': self.progress_percent(),
            'activities_details': [a.to_dict() for a in self.activities],
        }


class WeeklyPlanActivity(TimestampMixin, db.Model):
    __tablename__ = 'weekly_plan_activities'

    id = db.Column(db.Integer, primary_key=True)
    weekly_plan_id = db.Column(db.Integer, db.ForeignKey('weekly_plans.id'), nullable=False)
    activity_date = db.Column(db.Date, nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'))
    cohort_id = db.Column(db.Integer, db.ForeignKey('cohorts.id'))
    module = db.Column(db.String(255))
    lesson = db.Column(db.String(255))
    activity = db.Column(db.String(255), nullable=False)
    description = db.Column(db.String(1000))
    expected_outcome = db.Column(db.String(500))
    duration_hours = db.Column(db.Numeric(5, 2), default=1)
    status = db.Column(db.String(16), default='planned', nullable=False)  # planned | done | cancelled | missed
    completed_at = db.Column(db.DateTime(timezone=True))
    notes = db.Column(db.String(500))

    course = db.relationship('Course')
    cohort = db.relationship('Cohort')

    def to_dict(self):
        return {
            'id': self.id,
            'weekly_plan_id': self.weekly_plan_id,
            'activity_date': self.activity_date.isoformat() if self.activity_date else None,
            'course_id': self.course_id,
            'course_name': self.course.name if self.course else None,
            'cohort_id': self.cohort_id,
            'cohort_name': self.cohort.name if self.cohort else None,
            'module': self.module,
            'lesson': self.lesson,
            'activity': self.activity,
            'description': self.description,
            'expected_outcome': self.expected_outcome,
            'duration_hours': float(self.duration_hours or 0),
            'status': self.status,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'notes': self.notes,
        }


class Assignment(TimestampMixin, db.Model):
    __tablename__ = 'assignments'

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    cohort_id = db.Column(db.Integer, db.ForeignKey('cohorts.id'), nullable=False)
    instructor_id = db.Column(db.Integer, db.ForeignKey('instructors.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.String(1000))
    due_date = db.Column(db.Date)
    total_marks = db.Column(db.Numeric(6, 2), default=100)
    lms_assignment_id = db.Column(db.String(64), index=True)
    is_active = db.Column(db.Boolean, default=True)

    submissions = db.relationship('AssignmentSubmission', backref='assignment')

    def to_dict(self):
        return {
            'id': self.id,
            'course_id': self.course_id,
            'cohort_id': self.cohort_id,
            'cohort_name': self.cohort.name if self.cohort else None,
            'instructor_id': self.instructor_id,
            'title': self.title,
            'description': self.description,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'total_marks': float(self.total_marks or 0),
            'lms_assignment_id': self.lms_assignment_id,
            'submission_count': len(self.submissions),
            'graded_count': sum(1 for s in self.submissions if s.graded),
        }


class Learner(TimestampMixin, db.Model):
    __tablename__ = 'learners'

    id = db.Column(db.Integer, primary_key=True)
    cohort_id = db.Column(db.Integer, db.ForeignKey('cohorts.id'), nullable=False, index=True)
    lms_user_id = db.Column(db.String(64), index=True)
    name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255))
    phone = db.Column(db.String(32))
    enrollment_date = db.Column(db.Date)
    last_activity_at = db.Column(db.DateTime(timezone=True))
    is_active = db.Column(db.Boolean, default=True)

    enrolled_in = db.relationship('Enrollment', backref='learner')

    def to_dict(self):
        return {
            'id': self.id,
            'cohort_id': self.cohort_id,
            'lms_user_id': self.lms_user_id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'enrollment_date': self.enrollment_date.isoformat() if self.enrollment_date else None,
            'last_activity_at': self.last_activity_at.isoformat() if self.last_activity_at else None,
            'is_active': self.is_active,
        }


class Enrollment(TimestampMixin, db.Model):
    __tablename__ = 'enrollments'

    id = db.Column(db.Integer, primary_key=True)
    learner_id = db.Column(db.Integer, db.ForeignKey('learners.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    cohort_id = db.Column(db.Integer, db.ForeignKey('cohorts.id'), nullable=False)
    progress_percent = db.Column(db.Numeric(5, 2), default=0)
    average_score = db.Column(db.Numeric(6, 2), default=0)
    attendance_rate = db.Column(db.Numeric(5, 2), default=0)
    risk_status = db.Column(db.String(16), default='on_track')  # on_track | at_risk | behind | critical

    course = db.relationship('Course')

    def to_dict(self):
        return {
            'id': self.id,
            'learner_id': self.learner_id,
            'learner_name': self.learner.name if self.learner else None,
            'course_id': self.course_id,
            'course_name': self.course.name if self.course else None,
            'cohort_id': self.cohort_id,
            'progress_percent': float(self.progress_percent or 0),
            'average_score': float(self.average_score or 0),
            'attendance_rate': float(self.attendance_rate or 0),
            'risk_status': self.risk_status,
        }


class AssignmentSubmission(TimestampMixin, db.Model):
    __tablename__ = 'assignment_submissions'

    id = db.Column(db.Integer, primary_key=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey('assignments.id'), nullable=False)
    learner_id = db.Column(db.Integer, db.ForeignKey('learners.id'), nullable=False)
    submitted_at = db.Column(db.DateTime(timezone=True), nullable=False)
    content = db.Column(db.String(2000))
    marks_earned = db.Column(db.Numeric(6, 2))
    graded = db.Column(db.Boolean, default=False)
    graded_at = db.Column(db.DateTime(timezone=True))
    feedback = db.Column(db.String(1000))
    lms_submission_id = db.Column(db.String(64), index=True)

    learner = db.relationship('Learner', backref='submissions')

    def to_dict(self):
        return {
            'id': self.id,
            'assignment_id': self.assignment_id,
            'learner_id': self.learner_id,
            'learner_name': self.learner.name if self.learner else None,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'marks_earned': float(self.marks_earned) if self.marks_earned is not None else None,
            'graded': self.graded,
            'graded_at': self.graded_at.isoformat() if self.graded_at else None,
            'feedback': self.feedback,
        }


class LearnerAttendance(TimestampMixin, db.Model):
    __tablename__ = 'learner_attendance'

    id = db.Column(db.Integer, primary_key=True)
    learner_id = db.Column(db.Integer, db.ForeignKey('learners.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    cohort_id = db.Column(db.Integer, db.ForeignKey('cohorts.id'), nullable=False)
    attendance_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(16), default='present')  # present | absent | late | excused
    note = db.Column(db.String(255))

    learner = db.relationship('Learner')

    def to_dict(self):
        return {
            'id': self.id,
            'learner_id': self.learner_id,
            'learner_name': self.learner.name if self.learner else None,
            'course_id': self.course_id,
            'cohort_id': self.cohort_id,
            'attendance_date': self.attendance_date.isoformat() if self.attendance_date else None,
            'status': self.status,
            'note': self.note,
        }


class TeachingActivity(TimestampMixin, db.Model):
    __tablename__ = 'teaching_activities'

    id = db.Column(db.Integer, primary_key=True)
    instructor_id = db.Column(db.Integer, db.ForeignKey('instructors.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    cohort_id = db.Column(db.Integer, db.ForeignKey('cohorts.id'), nullable=False)
    activity_date = db.Column(db.Date, nullable=False)
    lesson_topic = db.Column(db.String(255), nullable=False)
    duration_hours = db.Column(db.Numeric(5, 2), default=1)
    learner_count = db.Column(db.Integer, default=0)
    notes = db.Column(db.String(500))
    source = db.Column(db.String(16), default='local')  # local | lms

    instructor = db.relationship('Instructor')
    course = db.relationship('Course')
    cohort = db.relationship('Cohort')

    def to_dict(self):
        return {
            'id': self.id,
            'instructor_id': self.instructor_id,
            'course_id': self.course_id,
            'cohort_id': self.cohort_id,
            'cohort_name': self.cohort.name if self.cohort else None,
            'activity_date': self.activity_date.isoformat() if self.activity_date else None,
            'lesson_topic': self.lesson_topic,
            'duration_hours': float(self.duration_hours or 0),
            'learner_count': self.learner_count,
            'notes': self.notes,
            'source': self.source,
        }