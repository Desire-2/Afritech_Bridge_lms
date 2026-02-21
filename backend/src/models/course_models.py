# Course Management Models for Afritec Bridge LMS

from datetime import datetime, timezone
# Assuming db is initialized in main.py or a central extensions file and imported here
from .user_models import db, User # Assuming user_models.py is in the same directory and has db

class Course(db.Model):
    __tablename__ = 'courses'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=False)
    learning_objectives = db.Column(db.Text, nullable=True)
    target_audience = db.Column(db.String(255), nullable=True)
    estimated_duration = db.Column(db.String(100), nullable=True)
    instructor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_published = db.Column(db.Boolean, default=False, nullable=False)

    # Payment & Enrollment Settings
    enrollment_type = db.Column(db.String(20), nullable=False, default='free')  # 'free', 'paid', 'scholarship'
    price = db.Column(db.Float, nullable=True)
    currency = db.Column(db.String(10), nullable=False, default='USD')
    
    # Enhanced Payment Settings
    payment_mode = db.Column(db.String(20), nullable=False, default='full')  # 'full' (full tuition) or 'partial' (partial payment)
    partial_payment_amount = db.Column(db.Float, nullable=True)  # Fixed partial amount (if payment_mode is 'partial')
    partial_payment_percentage = db.Column(db.Float, nullable=True)  # Percentage for partial (e.g. 50.0 for 50%)
    payment_methods = db.Column(db.Text, nullable=True)  # JSON array of enabled methods: ["paypal","mobile_money","bank_transfer"]
    payment_deadline_days = db.Column(db.Integer, nullable=True)  # Days before cohort start when payment must be done
    require_payment_before_application = db.Column(db.Boolean, default=False, nullable=False)  # Must pay before submitting application
    paypal_enabled = db.Column(db.Boolean, default=True, nullable=False)  # PayPal payment toggle
    mobile_money_enabled = db.Column(db.Boolean, default=True, nullable=False)  # Mobile Money toggle
    bank_transfer_enabled = db.Column(db.Boolean, default=False, nullable=False)  # Bank transfer toggle
    kpay_enabled = db.Column(db.Boolean, default=True, nullable=False)  # K-Pay gateway toggle (MTN/Airtel MoMo, Visa, SPENN)
    bank_transfer_details = db.Column(db.Text, nullable=True)  # Bank account info for manual transfer
    installment_enabled = db.Column(db.Boolean, default=False, nullable=False)  # Allow installment payments
    installment_count = db.Column(db.Integer, nullable=True)  # Number of installments (2, 3, 4, etc.)
    installment_interval_days = db.Column(db.Integer, nullable=True)  # Days between installments

    # Application & Cohort Settings
    application_start_date = db.Column(db.DateTime, nullable=True)
    application_end_date = db.Column(db.DateTime, nullable=True)
    cohort_start_date = db.Column(db.DateTime, nullable=True)
    cohort_end_date = db.Column(db.DateTime, nullable=True)
    cohort_label = db.Column(db.String(120), nullable=True)
    application_timezone = db.Column(db.String(64), nullable=False, default='UTC')
    
    # Module Release Settings
    start_date = db.Column(db.DateTime, nullable=True)  # Course start date for module release calculations
    module_release_count = db.Column(db.Integer, nullable=True)  # Number of modules to release initially (None = all)
    module_release_interval = db.Column(db.String(50), nullable=True)  # Future: 'weekly', 'bi-weekly', 'monthly', None for manual
    module_release_interval_days = db.Column(db.Integer, nullable=True)  # Custom interval in days

    instructor = db.relationship('User', backref=db.backref('courses_authored', lazy='dynamic'))
    modules = db.relationship('Module', backref='course', lazy='dynamic', cascade="all, delete-orphan")
    enrollments = db.relationship('Enrollment', backref='course', lazy='dynamic', cascade="all, delete-orphan")
    application_windows = db.relationship(
        'ApplicationWindow',
        backref='course',
        lazy='dynamic',
        cascade="all, delete-orphan",
        order_by='ApplicationWindow.opens_at'
    )

    def __repr__(self):
        return f'<Course {self.title}>'

    def _get_payment_methods(self):
        """Return enabled payment methods as a list.

        Priority:
        1. Saved JSON (payment_methods column) — fully authoritative.
           This is written by CourseSettings whenever the instructor saves,
           so it reflects exactly which toggles are on.
        2. Boolean flags fallback — used only when no JSON exists yet
           (brand-new course or courses created before this feature).
        """
        import json

        # --- authoritative path: JSON saved by instructor ---
        if self.payment_methods:
            try:
                parsed = json.loads(self.payment_methods)
                if isinstance(parsed, list) and parsed:
                    return parsed   # respect exactly what the instructor chose
            except (json.JSONDecodeError, TypeError):
                pass

        # --- fallback: build from individual boolean columns ---
        methods = []
        kpay_on = getattr(self, 'kpay_enabled', True)
        if kpay_on:
            methods.append('kpay')
        if self.paypal_enabled:
            methods.append('paypal')
        if self.mobile_money_enabled:
            methods.append('mobile_money')
        if self.bank_transfer_enabled:
            methods.append('bank_transfer')

        return methods if methods else ['kpay']

    def get_payment_summary(self):
        """Return a payment summary for the course (used in application forms)."""
        needs_payment = (self.enrollment_type == 'paid') or bool(self.require_payment_before_application)
        if not needs_payment:
            return {'required': False}
        
        summary = {
            'required': True,
            'total_price': self.price,
            'currency': self.currency or 'USD',
            'payment_mode': self.payment_mode or 'full',
            'require_payment_before_application': self.require_payment_before_application,
            'enabled_methods': self._get_payment_methods(),
            'installment_enabled': self.installment_enabled,
        }
        
        if self.payment_mode == 'partial':
            if self.partial_payment_amount:
                summary['amount_due_now'] = self.partial_payment_amount
            elif self.partial_payment_percentage and self.price:
                summary['amount_due_now'] = round(self.price * self.partial_payment_percentage / 100, 2)
            else:
                summary['amount_due_now'] = self.price
            summary['remaining_balance'] = round((self.price or 0) - summary['amount_due_now'], 2)
            summary['partial_payment_percentage'] = self.partial_payment_percentage
        else:
            summary['amount_due_now'] = self.price
            summary['remaining_balance'] = 0
        
        if self.installment_enabled and self.installment_count and self.installment_count > 1:
            installment_amount = round((self.price or 0) / self.installment_count, 2)
            summary['installment_count'] = self.installment_count
            summary['installment_amount'] = installment_amount
            summary['installment_interval_days'] = self.installment_interval_days or 30
        
        if self.bank_transfer_enabled and self.bank_transfer_details:
            summary['bank_transfer_details'] = self.bank_transfer_details
            
        if self.payment_deadline_days:
            summary['payment_deadline_days'] = self.payment_deadline_days
        
        return summary

    def get_released_module_count(self):
        """
        Calculate how many modules should be released based on settings and current date.
        Returns None if all modules should be released.
        """
        from datetime import datetime
        
        # If no release count set, all modules are released
        if self.module_release_count is None:
            return None
        
        # If no start date, use course creation date or release all
        start_date = self.start_date or self.created_at
        if not start_date:
            return None
        
        now = datetime.utcnow()
        
        # If course hasn't started yet, return 0
        if now < start_date:
            return 0
        
        # Start with the initial release count
        released_count = self.module_release_count
        
        # If time-based release is configured, calculate additional releases
        if self.module_release_interval_days and self.module_release_interval_days > 0:
            days_since_start = (now - start_date).days
            additional_releases = days_since_start // self.module_release_interval_days
            released_count += additional_releases
        
        return released_count

    def get_released_modules(self):
        """
        Get the list of modules that should be visible to students.
        Takes into account publication status, release settings and manually released modules.
        """
        # First filter for published modules only
        published_modules = list(self.modules.filter_by(is_published=True).order_by(Module.order).all())
        released_count = self.get_released_module_count()
        
        # If no limit, return all published modules
        if released_count is None:
            return published_modules
        
        released_modules = []
        auto_released_count = 0
        
        for module in published_modules:
            # Module is released if it's manually released OR within the auto-release count
            if module.is_released or auto_released_count < released_count:
                released_modules.append(module)
                if not module.is_released:
                    auto_released_count += 1
            else:
                # Check if manually released
                if module.is_released:
                    released_modules.append(module)
        
        return released_modules

    def get_application_window_status(self, now=None):
        """Return application window/cohort status with a structured payload."""
        current_time = now or datetime.now(timezone.utc)

        # Normalize stored datetimes to aware UTC for comparison
        def _to_utc(dt):
            if not dt:
                return None
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

        start = _to_utc(self.application_start_date)
        end = _to_utc(self.application_end_date)
        cohort_start = _to_utc(self.cohort_start_date)
        cohort_end = _to_utc(self.cohort_end_date)

        # Defaults
        status = "open"
        reason = None

        if start and current_time < start:
            status = "upcoming"
            reason = "applications_not_open"
        elif end and current_time > end:
            status = "closed"
            reason = "application_window_closed"
        elif cohort_end and current_time > cohort_end:
            status = "closed"
            reason = "cohort_ended"
        elif cohort_start and current_time < cohort_start and end and current_time > end:
            status = "closed"
            reason = "application_window_closed"

        return {
            "status": status,
            "reason": reason,
            "now": current_time.isoformat(),
            "opens_at": start.isoformat() if start else None,
            "closes_at": end.isoformat() if end else None,
            "cohort_start": cohort_start.isoformat() if cohort_start else None,
            "cohort_end": cohort_end.isoformat() if cohort_end else None,
            "cohort_label": self.cohort_label,
        }

    def get_all_application_windows_list(self, now=None):
        """Return all application windows as list of dicts with computed status."""
        current_time = now or datetime.now(timezone.utc)

        def _to_utc(dt):
            if not dt:
                return None
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

        windows = list(self.application_windows.order_by(ApplicationWindow.opens_at).all())  # type: ignore[attr-defined]

        if windows:
            return [w.to_dict(now=current_time) for w in windows]

        # Fallback: synthesize a single window from the legacy flat fields
        if self.application_start_date or self.application_end_date or self.cohort_start_date or self.cohort_label:
            return [self.get_application_window_status(now=current_time)]

        return []

    def get_primary_application_window(self, now=None):
        """Return the most relevant (open > upcoming > first) window, or legacy fallback."""
        current_time = now or datetime.now(timezone.utc)
        windows = self.get_all_application_windows_list(now=current_time)

        if not windows:
            return self.get_application_window_status(now=current_time)

        for win in windows:
            if win.get("status") == "open":
                return win
        for win in windows:
            if win.get("status") == "upcoming":
                return win
        return windows[0]

    def to_dict(self, include_modules=False, include_announcements=False, for_student=False):
        data = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'learning_objectives': self.learning_objectives,
            'target_audience': self.target_audience,
            'estimated_duration': self.estimated_duration,
            'instructor_id': self.instructor_id,
            'instructor_name': f"{self.instructor.first_name} {self.instructor.last_name}" if self.instructor else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'is_published': self.is_published,
            'enrollment_type': self.enrollment_type,
            'price': self.price,
            'currency': self.currency,
            'payment_mode': self.payment_mode or 'full',
            'partial_payment_amount': self.partial_payment_amount,
            'partial_payment_percentage': self.partial_payment_percentage,
            'payment_methods': self._get_payment_methods(),
            'payment_deadline_days': self.payment_deadline_days,
            'require_payment_before_application': self.require_payment_before_application,
            'paypal_enabled': self.paypal_enabled,
            'mobile_money_enabled': self.mobile_money_enabled,
            'bank_transfer_enabled': self.bank_transfer_enabled,
            'kpay_enabled': getattr(self, 'kpay_enabled', True),
            'bank_transfer_details': self.bank_transfer_details,
            'installment_enabled': self.installment_enabled,
            'installment_count': self.installment_count,
            'installment_interval_days': self.installment_interval_days,
            'application_start_date': self.application_start_date.isoformat() if self.application_start_date else None,
            'application_end_date': self.application_end_date.isoformat() if self.application_end_date else None,
            'cohort_start_date': self.cohort_start_date.isoformat() if self.cohort_start_date else None,
            'cohort_end_date': self.cohort_end_date.isoformat() if self.cohort_end_date else None,
            'cohort_label': self.cohort_label,
            'application_timezone': self.application_timezone,
            'application_window': self.get_primary_application_window(),
            'application_windows': self.get_all_application_windows_list(),
            # Module release settings
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'module_release_count': self.module_release_count,
            'module_release_interval': self.module_release_interval,
            'module_release_interval_days': self.module_release_interval_days,
            # Computed payment summary for frontend convenience
            'payment_summary': self.get_payment_summary() if (self.enrollment_type == 'paid' or self.require_payment_before_application) else None
        }
        
        if include_modules:
            # For students, only show released modules; for instructors, show all
            if for_student:
                released_modules = self.get_released_modules()
                all_published_modules = list(self.modules.filter_by(is_published=True).order_by('order').all())
                data['modules'] = [module.to_dict(include_lessons=True) for module in released_modules]
                data['total_module_count'] = len(all_published_modules)
                data['released_module_count'] = len(released_modules)
            else:
                # Order modules by their 'order' field to preserve reordering after refresh
                data['modules'] = [module.to_dict(include_lessons=True) for module in self.modules.order_by('order')]
        
        if include_announcements:
            data['announcements'] = [ann.to_dict() for ann in self.announcements.order_by(Announcement.created_at.desc())]
        return data


class ApplicationWindow(db.Model):
    """
    Represents a single application/cohort window for a course.
    A course can have multiple windows (e.g., Jan cohort, Mar cohort).
    """
    __tablename__ = 'application_windows'

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    cohort_label = db.Column(db.String(120), nullable=True)
    opens_at = db.Column(db.DateTime, nullable=True)
    closes_at = db.Column(db.DateTime, nullable=True)
    cohort_start = db.Column(db.DateTime, nullable=True)
    cohort_end = db.Column(db.DateTime, nullable=True)
    status_override = db.Column(db.String(20), nullable=True)  # manual override: 'open', 'closed', 'upcoming'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<ApplicationWindow {self.cohort_label} for course {self.course_id}>'

    def compute_status(self, now=None):
        """Compute the window status based on dates and optional override."""
        if self.status_override:
            return self.status_override

        current_time = now or datetime.now(timezone.utc)

        def _to_utc(dt):
            if not dt:
                return None
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

        opens = _to_utc(self.opens_at)
        closes = _to_utc(self.closes_at)
        c_end = _to_utc(self.cohort_end)

        if opens and current_time < opens:
            return "upcoming"
        if closes and current_time > closes:
            return "closed"
        if c_end and current_time > c_end:
            return "closed"
        return "open"

    def to_dict(self, now=None):
        current_time = now or datetime.now(timezone.utc)

        def _iso(dt):
            if not dt:
                return None
            return dt.isoformat() if not dt.tzinfo else dt.isoformat()

        status = self.compute_status(now=current_time)
        reason = None
        if status == "upcoming":
            reason = "applications_not_open"
        elif status == "closed":
            reason = "application_window_closed"

        return {
            "id": self.id,
            "course_id": self.course_id,
            "status": status,
            "reason": reason,
            "cohort_label": self.cohort_label,
            "opens_at": _iso(self.opens_at),
            "closes_at": _iso(self.closes_at),
            "cohort_start": _iso(self.cohort_start),
            "cohort_end": _iso(self.cohort_end),
            "status_override": self.status_override,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Module(db.Model):
    __tablename__ = 'modules'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    learning_objectives = db.Column(db.Text, nullable=True)  # What students should learn in this module
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    order = db.Column(db.Integer, nullable=False, default=0) # For sequencing
    is_published = db.Column(db.Boolean, default=False)
    is_released = db.Column(db.Boolean, default=False)  # Manual release override by instructor
    released_at = db.Column(db.DateTime, nullable=True)  # When the module was manually released
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lessons = db.relationship('Lesson', backref='module', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Module {self.title}>'

    def to_dict(self, include_lessons=False):
        data = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'learning_objectives': self.learning_objectives,
            'course_id': self.course_id,
            'order': self.order,
            'is_published': self.is_published,
            'is_released': self.is_released,
            'released_at': self.released_at.isoformat() if self.released_at else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
        if include_lessons:
            # Use string 'order' column name for ordering to avoid forward reference issues
            data['lessons'] = [lesson.to_dict() for lesson in self.lessons.order_by('order')]
        return data

class Lesson(db.Model):
    __tablename__ = 'lessons'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    content_type = db.Column(db.String(50), nullable=False)  # "text", "video", "pdf", "mixed"
    content_data = db.Column(db.Text, nullable=False) # Stores rich text, video URL, file paths, or JSON for mixed content
    description = db.Column(db.Text, nullable=True)  # Brief description of the lesson
    learning_objectives = db.Column(db.Text, nullable=True)  # What students should learn
    module_id = db.Column(db.Integer, db.ForeignKey('modules.id'), nullable=False)
    order = db.Column(db.Integer, nullable=False, default=0) # For sequencing
    duration_minutes = db.Column(db.Integer, nullable=True)  # Estimated duration
    is_published = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Lesson {self.title}>'

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'content_type': self.content_type,
            'content_data': self.content_data,
            'description': self.description,
            'learning_objectives': self.learning_objectives,
            'module_id': self.module_id,
            'order': self.order,
            'duration_minutes': self.duration_minutes,
            'is_published': self.is_published,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class Enrollment(db.Model):
    __tablename__ = 'enrollments'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    enrollment_date = db.Column(db.DateTime, default=datetime.utcnow)
    progress = db.Column(db.Float, default=0.0) # Percentage completion, 0.0 to 1.0
    completed_at = db.Column(db.DateTime, nullable=True)
    
    # ── Cohort separation ──
    application_window_id = db.Column(
        db.Integer, db.ForeignKey('application_windows.id'), nullable=True
    )
    application_id = db.Column(
        db.Integer, db.ForeignKey('course_applications.id'), nullable=True
    )
    cohort_label = db.Column(db.String(120), nullable=True)
    cohort_start_date = db.Column(db.DateTime, nullable=True)
    cohort_end_date = db.Column(db.DateTime, nullable=True)

    # Enrollment status and termination tracking
    status = db.Column(db.String(20), default='active')  # 'active', 'completed', 'terminated', 'suspended'
    terminated_at = db.Column(db.DateTime, nullable=True)
    termination_reason = db.Column(db.String(255), nullable=True)
    terminated_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    student = db.relationship('User', foreign_keys=[student_id], backref=db.backref('enrollments', lazy='dynamic'))
    terminator = db.relationship('User', foreign_keys=[terminated_by])
    application_window = db.relationship('ApplicationWindow', backref=db.backref('enrollments', lazy='dynamic'))
    application = db.relationship('CourseApplication', foreign_keys=[application_id], backref=db.backref('enrollment', uselist=False))
    # Course relationship is already defined in Course model via backref

    __table_args__ = (
        # Allow same student in different cohorts of the same course
        db.UniqueConstraint('student_id', 'course_id', 'application_window_id', name='_student_course_cohort_uc'),
    )

    def __repr__(self):
        return f'<Enrollment User {self.student_id} in Course {self.course_id}>'
    
    def calculate_course_score(self):
        """
        Calculate the overall course score as the average of all module scores.
        Returns a score from 0-100.
        """
        from ..models.student_models import ModuleProgress
        
        # Get all modules in this course
        course_modules = self.course.modules.all()
        if not course_modules:
            return 0.0
        
        total_score = 0.0
        scored_modules = 0
        
        for module in course_modules:
            # Get module progress for this student
            module_progress = ModuleProgress.query.filter_by(
                student_id=self.student_id,
                module_id=module.id,
                enrollment_id=self.id
            ).first()
            
            if module_progress:
                # Use the module score (average of all lesson scores)
                module_score = module_progress.calculate_module_score()
                total_score += module_score
                scored_modules += 1
        
        # Calculate average, or return 0 if no modules
        return (total_score / scored_modules) if scored_modules > 0 else 0.0

    def to_dict(self):
        student_data = None
        if self.student:
            student_data = {
                'id': self.student.id,
                'username': self.student.username,
                'email': self.student.email,
                'first_name': self.student.first_name,
                'last_name': self.student.last_name,
                'full_name': f"{self.student.first_name} {self.student.last_name}".strip() if self.student.first_name or self.student.last_name else self.student.username
            }
        
        window_data = None
        if self.application_window:
            window_data = self.application_window.to_dict()

        return {
            'id': self.id,
            'student_id': self.student_id,
            'course_id': self.course_id,
            'enrollment_date': self.enrollment_date.isoformat(),
            'progress': self.progress,
            'course_score': self.calculate_course_score(),  # Overall course score
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'status': self.status,
            'terminated_at': self.terminated_at.isoformat() if self.terminated_at else None,
            'termination_reason': self.termination_reason,
            'terminated_by': self.terminated_by,
            'student_username': self.student.username if self.student else None,
            'student': student_data,
            'course_title': self.course.title if self.course else None,
            # ── Cohort fields ──
            'cohort_label': self.cohort_label,
            'cohort_start_date': self.cohort_start_date.isoformat() if self.cohort_start_date else None,
            'cohort_end_date': self.cohort_end_date.isoformat() if self.cohort_end_date else None,
            'application_window_id': self.application_window_id,
            'application_id': self.application_id,
            'application_window': window_data,
        }

class Quiz(db.Model):
    __tablename__ = 'quizzes'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=True)
    module_id = db.Column(db.Integer, db.ForeignKey('modules.id'), nullable=True)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=True) # Quiz can be linked to a lesson
    is_published = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Quiz settings fields
    time_limit = db.Column(db.Integer, nullable=True)  # Time limit in minutes
    max_attempts = db.Column(db.Integer, nullable=True)  # Maximum number of attempts
    passing_score = db.Column(db.Integer, default=70)  # Passing score percentage
    due_date = db.Column(db.DateTime, nullable=True)  # Due date for the quiz
    points_possible = db.Column(db.Float, default=100.0)  # Total points possible
    shuffle_questions = db.Column(db.Boolean, default=False)  # Shuffle questions for each student
    shuffle_answers = db.Column(db.Boolean, default=False)  # Shuffle answer choices
    show_correct_answers = db.Column(db.Boolean, default=True)  # Show correct answers after submission

    questions = db.relationship('Question', backref='quiz', lazy='dynamic', cascade="all, delete-orphan")
    # Relationships to Course, Module, Lesson if needed for direct linking
    course = db.relationship('Course', backref=db.backref('quizzes', lazy='dynamic', cascade="all, delete-orphan"))
    module = db.relationship('Module', backref=db.backref('quizzes', lazy='dynamic', cascade="all, delete-orphan"))
    lesson = db.relationship('Lesson', backref=db.backref('quiz', uselist=False, cascade="all, delete-orphan")) # A lesson might have one quiz directly
    # Note: quiz_attempts relationship is added via backref from QuizAttempt model to avoid circular imports

    def __repr__(self):
        return f'<Quiz {self.title}>'

    def to_dict(self, include_questions=False):
        data = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'course_id': self.course_id,
            'module_id': self.module_id,
            'lesson_id': self.lesson_id,
            'is_published': self.is_published,
            'created_at': self.created_at.isoformat(),
            'time_limit': self.time_limit,
            'max_attempts': self.max_attempts,
            'passing_score': self.passing_score,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'points_possible': self.points_possible,
            'shuffle_questions': self.shuffle_questions,
            'shuffle_answers': self.shuffle_answers,
            'show_correct_answers': self.show_correct_answers
        }
        if include_questions:
            # Use .all() because questions relationship is lazy='dynamic'
            data['questions'] = [q.to_dict(include_answers=True) for q in self.questions.all()]
        return data

class Question(db.Model):
    __tablename__ = 'questions'
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)
    question_type = db.Column(db.String(50), nullable=False) # e.g., "multiple_choice", "true_false", "short_answer"
    order = db.Column(db.Integer, nullable=False, default=0)
    points = db.Column(db.Float, default=10.0)
    explanation = db.Column(db.Text, nullable=True)

    answers = db.relationship('Answer', backref='question', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Question {self.text[:50]}>'

    def to_dict(self, include_answers=False, for_student=False):
        data = {
            'id': self.id,
            'quiz_id': self.quiz_id,
            'text': self.text,
            'question_text': self.text,
            'question_type': self.question_type,
            'order': self.order,
            'order_index': self.order,
            'points': self.points,
            'explanation': self.explanation
        }
        if include_answers:
            # Use .all() because answers relationship is lazy='dynamic'
            data['answers'] = [ans.to_dict(for_student=for_student) for ans in self.answers.all()]
        return data

class Answer(db.Model):
    __tablename__ = 'answers'
    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)
    is_correct = db.Column(db.Boolean, default=False, nullable=False)

    def __repr__(self):
        return f'<Answer {self.text[:50]}>'

    def to_dict(self, for_student=False):
        data = {
            'id': self.id,
            'question_id': self.question_id,
            'text': self.text,
            'answer_text': self.text
        }
        if not for_student:
            data['is_correct'] = self.is_correct
        return data

class Submission(db.Model):
    __tablename__ = 'submissions'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    # Link to what is being submitted, e.g., quiz or a general assignment (lesson)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=True)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=True) # For general assignment submissions
    submission_content = db.Column(db.Text, nullable=True) # e.g., JSON of answers for quiz, link to project for assignment
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    grade = db.Column(db.Float, nullable=True)
    feedback = db.Column(db.Text, nullable=True)

    student = db.relationship('User', backref=db.backref('submissions', lazy='dynamic'))
    quiz = db.relationship('Quiz', backref=db.backref('submissions', lazy='dynamic'))
    lesson = db.relationship('Lesson', backref=db.backref('submissions', lazy='dynamic'))

    def __repr__(self):
        return f'<Submission {self.id} by User {self.student_id}>'

    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'quiz_id': self.quiz_id,
            'lesson_id': self.lesson_id,
            'submission_content': self.submission_content,
            'submitted_at': self.submitted_at.isoformat(),
            'grade': self.grade,
            'feedback': self.feedback,
            'student_username': self.student.username if self.student else None,
            'quiz_title': self.quiz.title if self.quiz else None,
            'lesson_title': self.lesson.title if self.lesson else None
        }

class Assignment(db.Model):
    __tablename__ = 'assignments'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=False)
    instructions = db.Column(db.Text, nullable=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=True)
    module_id = db.Column(db.Integer, db.ForeignKey('modules.id'), nullable=True)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=True)
    instructor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    assignment_type = db.Column(db.String(50), nullable=False, default='file_upload')  # 'file_upload', 'text_response', 'both'
    max_file_size_mb = db.Column(db.Integer, default=10)  # Maximum file size in MB
    allowed_file_types = db.Column(db.String(255), nullable=True)  # JSON string of allowed extensions
    due_date = db.Column(db.DateTime, nullable=True)
    points_possible = db.Column(db.Float, default=100.0)
    is_published = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Modification request fields
    modification_requested = db.Column(db.Boolean, default=False, nullable=False)
    modification_request_reason = db.Column(db.Text, nullable=True)
    modification_requested_at = db.Column(db.DateTime, nullable=True)
    modification_requested_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    can_resubmit = db.Column(db.Boolean, default=False, nullable=False)
    
    # Resubmission tracking
    max_resubmissions = db.Column(db.Integer, default=3, nullable=False)
    resubmission_count = db.Column(db.Integer, default=0, nullable=False)

    # Relationships
    course = db.relationship('Course', backref=db.backref('assignments', lazy='dynamic', cascade="all, delete-orphan"))
    module = db.relationship('Module', backref=db.backref('assignments', lazy='dynamic', cascade="all, delete-orphan"))
    lesson = db.relationship('Lesson', backref=db.backref('assignments', lazy='dynamic', cascade="all, delete-orphan"))
    submissions = db.relationship('AssignmentSubmission', backref='assignment', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Assignment {self.title}>'

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'instructions': self.instructions,
            'course_id': self.course_id,
            'module_id': self.module_id,
            'lesson_id': self.lesson_id,
            'instructor_id': self.instructor_id,
            'assignment_type': self.assignment_type,
            'max_file_size_mb': self.max_file_size_mb,
            'allowed_file_types': self.allowed_file_types,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'points_possible': self.points_possible,
            'is_published': self.is_published,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            # Modification request fields
            'modification_requested': self.modification_requested,
            'modification_request_reason': self.modification_request_reason,
            'modification_request_at': self.modification_requested_at.isoformat() if self.modification_requested_at else None,
            'modification_requested_by': self.modification_requested_by,
            'can_resubmit': self.can_resubmit,
            'max_resubmissions': self.max_resubmissions,
            'resubmission_count': self.resubmission_count
        }

class AssignmentSubmission(db.Model):
    __tablename__ = 'assignment_submissions'
    id = db.Column(db.Integer, primary_key=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey('assignments.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    content = db.Column(db.Text, nullable=True)  # For text responses (matches DB schema)
    file_url = db.Column(db.Text, nullable=True)  # JSON metadata for uploaded files
    external_url = db.Column(db.String(255), nullable=True)  # External URL submission
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    grade = db.Column(db.Float, nullable=True)
    feedback = db.Column(db.Text, nullable=True)
    graded_at = db.Column(db.DateTime, nullable=True)
    graded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # Submission tracking fields
    is_resubmission = db.Column(db.Boolean, default=False, nullable=False)
    original_submission_id = db.Column(db.Integer, db.ForeignKey('assignment_submissions.id'), nullable=True)
    resubmission_count = db.Column(db.Integer, default=0, nullable=False)
    submission_notes = db.Column(db.Text, nullable=True)  # Notes about why this is a resubmission

    # Relationships
    student = db.relationship('User', foreign_keys=[student_id], backref=db.backref('assignment_submissions', lazy='dynamic'))
    grader = db.relationship('User', foreign_keys=[graded_by], backref=db.backref('graded_assignments', lazy='dynamic'))
    original_submission = db.relationship('AssignmentSubmission', remote_side=[id], backref='resubmissions')
    
    # Add unique constraint for assignment-student combination
    __table_args__ = (db.UniqueConstraint('assignment_id', 'student_id', name='_assignment_student_submission_uc'),)

    def __repr__(self):
        return f'<AssignmentSubmission {self.id} for Assignment {self.assignment_id}>'

    def to_dict(self):
        # Parse files data if available
        files_data = []
        if self.file_url:
            try:
                import json
                files_data = json.loads(self.file_url) if self.file_url else []
                if not isinstance(files_data, list):
                    files_data = []
            except (json.JSONDecodeError, TypeError):
                files_data = []
        
        return {
            'id': self.id,
            'assignment_id': self.assignment_id,
            'student_id': self.student_id,
            'content': self.content,
            'text_content': self.content,  # Alias for backward compatibility
            'file_url': self.file_url,
            'file_path': self.file_url,  # Alias for backward compatibility
            'files': files_data,  # Parsed file metadata
            'files_count': len(files_data),
            'external_url': self.external_url,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'grade': self.grade,
            'feedback': self.feedback,
            'graded_at': self.graded_at.isoformat() if self.graded_at else None,
            'graded_by': self.graded_by,
            'student_name': f"{self.student.first_name} {self.student.last_name}" if self.student else None,
            'grader_name': f"{self.grader.first_name} {self.grader.last_name}" if self.grader else None,
            # Submission tracking fields
            'is_resubmission': self.is_resubmission,
            'original_submission_id': self.original_submission_id,
            'resubmission_count': self.resubmission_count,
            'submission_notes': self.submission_notes
        }
    
    def get_files(self):
        """Get parsed file metadata"""
        if not self.file_url:
            return []
        
        try:
            import json
            files_data = json.loads(self.file_url)
            return files_data if isinstance(files_data, list) else []
        except (json.JSONDecodeError, TypeError):
            return []
    
    def set_files(self, files_data):
        """Set file metadata as JSON string"""
        if not files_data:
            self.file_url = None
            return
        
        try:
            import json
            self.file_url = json.dumps(files_data)
        except (TypeError, ValueError):
            self.file_url = None
    
    def add_file(self, file_metadata):
        """Add a file to the submission"""
        files = self.get_files()
        files.append(file_metadata)
        self.set_files(files)
    
    def remove_file(self, file_url_or_index):
        """Remove a file from the submission by URL or index"""
        files = self.get_files()
        
        if isinstance(file_url_or_index, int):
            # Remove by index
            if 0 <= file_url_or_index < len(files):
                files.pop(file_url_or_index)
        else:
            # Remove by URL
            files = [f for f in files if f.get('url') != file_url_or_index]
        
        self.set_files(files)
    
    def get_total_file_size(self):
        """Get total size of all uploaded files"""
        files = self.get_files()
        return sum(file.get('size', 0) for file in files)
    
    def get_submission_status(self):
        """Get comprehensive submission status information"""
        status = {
            'is_first_submission': not self.is_resubmission,
            'is_resubmission': self.is_resubmission,
            'resubmission_count': self.resubmission_count,
            'submission_type': 'resubmission' if self.is_resubmission else 'first_submission',
            'modification_requested': self.assignment.modification_requested if self.assignment else False,
            'can_resubmit': self.assignment.can_resubmit if self.assignment else False,
            'submission_notes': self.submission_notes
        }
        
        # Add modification request details if applicable
        if self.assignment and self.assignment.modification_requested:
            status.update({
                'modification_request_reason': self.assignment.modification_request_reason,
                'modification_requested_at': self.assignment.modification_requested_at.isoformat() if self.assignment.modification_requested_at else None,
                'modification_requested_by': self.assignment.modification_requested_by
            })
        
        return status
    
    def get_submission_status(self):
        """Get comprehensive submission status information"""
        status = {
            'is_first_submission': not self.is_resubmission,
            'is_resubmission': self.is_resubmission,
            'resubmission_count': self.resubmission_count,
            'submission_type': 'resubmission' if self.is_resubmission else 'first_submission',
            'modification_requested': self.assignment.modification_requested if self.assignment else False,
            'can_resubmit': self.assignment.can_resubmit if self.assignment else False,
            'submission_notes': self.submission_notes
        }
        
        # Add modification request details if applicable
        if self.assignment and self.assignment.modification_requested:
            status.update({
                'modification_request_reason': self.assignment.modification_request_reason,
                'modification_requested_at': self.assignment.modification_requested_at.isoformat() if self.assignment.modification_requested_at else None,
                'modification_requested_by': self.assignment.modification_requested_by
            })
        
        return status

class Project(db.Model):
    __tablename__ = 'projects'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=False)
    objectives = db.Column(db.Text, nullable=True)  # Learning objectives for the project
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    module_ids = db.Column(db.Text, nullable=False)  # JSON string of module IDs that the project covers
    due_date = db.Column(db.DateTime, nullable=False)
    points_possible = db.Column(db.Float, default=100.0)
    is_published = db.Column(db.Boolean, default=False)
    submission_format = db.Column(db.String(50), default='file_upload')  # 'file_upload', 'text_response', 'both', 'presentation'
    max_file_size_mb = db.Column(db.Integer, default=50)  # Larger for projects
    allowed_file_types = db.Column(db.String(255), nullable=True)  # JSON string of allowed extensions
    collaboration_allowed = db.Column(db.Boolean, default=False)
    max_team_size = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Modification request fields
    modification_requested = db.Column(db.Boolean, default=False, nullable=False)
    modification_request_reason = db.Column(db.Text, nullable=True)
    modification_requested_at = db.Column(db.DateTime, nullable=True)
    modification_requested_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    can_resubmit = db.Column(db.Boolean, default=False, nullable=False)
    
    # Resubmission tracking
    max_resubmissions = db.Column(db.Integer, default=3, nullable=False)
    resubmission_count = db.Column(db.Integer, default=0, nullable=False)

    # Relationships
    course = db.relationship('Course', backref=db.backref('projects', lazy='dynamic', cascade="all, delete-orphan"))
    submissions = db.relationship('ProjectSubmission', backref='project', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Project {self.title}>'

    def get_modules(self):
        """Get the list of module IDs this project covers"""
        import json
        try:
            return json.loads(self.module_ids) if self.module_ids else []
        except:
            return []

    def set_modules(self, module_list):
        """Set the list of module IDs this project covers"""
        import json
        self.module_ids = json.dumps(module_list)

    def to_dict(self, include_modules=False):
        data = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'objectives': self.objectives,
            'course_id': self.course_id,
            'module_ids': self.get_modules(),
            'due_date': self.due_date.isoformat(),
            'points_possible': self.points_possible,
            'is_published': self.is_published,
            'submission_format': self.submission_format,
            'max_file_size_mb': self.max_file_size_mb,
            'allowed_file_types': self.allowed_file_types,
            'collaboration_allowed': self.collaboration_allowed,
            'max_team_size': self.max_team_size,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            # Modification request fields
            'modification_requested': self.modification_requested,
            'modification_request_reason': self.modification_request_reason,
            'modification_requested_at': self.modification_requested_at.isoformat() if self.modification_requested_at else None,
            'modification_requested_by': self.modification_requested_by,
            'can_resubmit': self.can_resubmit,
            'max_resubmissions': self.max_resubmissions,
            'resubmission_count': self.resubmission_count
        }
        if include_modules:
            module_ids = self.get_modules()
            modules = Module.query.filter(Module.id.in_(module_ids)).all() if module_ids else []
            data['modules'] = [module.to_dict() for module in modules]
        return data

class ProjectSubmission(db.Model):
    __tablename__ = 'project_submissions'
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    team_members = db.Column(db.Text, nullable=True)  # JSON string of team member IDs if collaboration allowed
    text_content = db.Column(db.Text, nullable=True)  # For text responses or project descriptions
    file_path = db.Column(db.String(500), nullable=True)  # Path to uploaded file
    file_name = db.Column(db.String(255), nullable=True)  # Original filename
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    grade = db.Column(db.Float, nullable=True)
    feedback = db.Column(db.Text, nullable=True)
    graded_at = db.Column(db.DateTime, nullable=True)
    graded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # Submission tracking fields
    is_resubmission = db.Column(db.Boolean, default=False, nullable=False)
    original_submission_id = db.Column(db.Integer, db.ForeignKey('project_submissions.id'), nullable=True)
    resubmission_count = db.Column(db.Integer, default=0, nullable=False)
    submission_notes = db.Column(db.Text, nullable=True)  # Notes about why this is a resubmission

    # Relationships
    student = db.relationship('User', foreign_keys=[student_id], backref=db.backref('project_submissions', lazy='dynamic'))
    grader = db.relationship('User', foreign_keys=[graded_by], backref=db.backref('graded_projects', lazy='dynamic'))
    original_submission = db.relationship('ProjectSubmission', remote_side=[id], backref='resubmissions')

    def __repr__(self):
        return f'<ProjectSubmission {self.id} for Project {self.project_id}>'

    def get_team_members(self):
        """Get the list of team member IDs"""
        import json
        try:
            return json.loads(self.team_members) if self.team_members else []
        except:
            return []

    def set_team_members(self, member_list):
        """Set the list of team member IDs"""
        import json
        self.team_members = json.dumps(member_list)

    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'student_id': self.student_id,
            'team_members': self.get_team_members(),
            'text_content': self.text_content,
            'file_path': self.file_path,
            'file_name': self.file_name,
            'submitted_at': self.submitted_at.isoformat(),
            'grade': self.grade,
            'feedback': self.feedback,
            'graded_at': self.graded_at.isoformat() if self.graded_at else None,
            'graded_by': self.graded_by,
            'student_name': f"{self.student.first_name} {self.student.last_name}" if self.student else None,
            'grader_name': f"{self.grader.first_name} {self.grader.last_name}" if self.grader else None,
            'is_resubmission': self.is_resubmission,
            'resubmission_count': self.resubmission_count,
            'submission_notes': self.submission_notes,
            'submission_status': self.get_submission_status()
        }

    def get_submission_status(self):
        """Get comprehensive submission status information"""
        status = {
            'is_first_submission': not self.is_resubmission,
            'is_resubmission': self.is_resubmission,
            'resubmission_count': self.resubmission_count,
            'submission_type': 'resubmission' if self.is_resubmission else 'first_submission',
            'modification_requested': self.project.modification_requested if self.project else False,
            'can_resubmit': self.project.can_resubmit if self.project else False,
            'submission_notes': self.submission_notes
        }
        
        # Add modification request details if applicable
        if self.project and self.project.modification_requested:
            status.update({
                'modification_request_reason': self.project.modification_request_reason,
                'modification_requested_at': self.project.modification_requested_at.isoformat() if self.project.modification_requested_at else None,
                'modification_requested_by': self.project.modification_requested_by
            })
        
        return status

class Announcement(db.Model):
    __tablename__ = 'announcements'
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    instructor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    course = db.relationship('Course', backref=db.backref('announcements', lazy='dynamic', cascade="all, delete-orphan"))
    instructor = db.relationship('User', backref=db.backref('announcements', lazy='dynamic'))

    def __repr__(self):
        return f'<Announcement {self.title}>'

    def to_dict(self):
        return {
            'id': self.id,
            'course_id': self.course_id,
            'instructor_id': self.instructor_id,
            'title': self.title,
            'content': self.content,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'instructor_name': f"{self.instructor.first_name} {self.instructor.last_name}" if self.instructor else None
        }

