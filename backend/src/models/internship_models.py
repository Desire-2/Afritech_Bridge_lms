# Internship Application System Models for Afritec Bridge LMS

from datetime import datetime
import uuid
from enum import Enum
from .user_models import db, User


class InternshipTrack(db.Model):
    """Internship tracks (e.g., mobile, frontend, backend, etc.)"""
    __tablename__ = 'internship_tracks'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False, unique=True)
    slug = db.Column(db.String(100), nullable=False, unique=True, index=True)
    description = db.Column(db.Text, nullable=True)
    icon_key = db.Column(db.String(50), nullable=True)  # e.g., "mobile", "web", "data" for icon mapping
    is_active = db.Column(db.Boolean, default=True, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    cohorts = db.relationship('InternshipCohort', backref='track', lazy='dynamic', cascade='all, delete-orphan')
    applications = db.relationship('InternshipApplication', backref='track', lazy='dynamic')
    
    def __repr__(self):
        return f'<InternshipTrack {self.name}>'
    
    def to_dict(self, include_cohorts=False):
        data = {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'description': self.description,
            'icon_key': self.icon_key,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }
        if include_cohorts:
            data['cohorts'] = [c.to_dict() for c in self.cohorts.all()]
        return data


class InternshipCohort(db.Model):
    """Internship cohorts (batches) for each track"""
    __tablename__ = 'internship_cohorts'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    track_id = db.Column(db.String(36), db.ForeignKey('internship_tracks.id'), nullable=False, index=True)
    cohort_name = db.Column(db.String(120), nullable=False)
    cohort_code = db.Column(db.String(50), nullable=False, unique=True, index=True)
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    capacity = db.Column(db.Integer, nullable=True)  # Max number of interns, None = unlimited
    is_accepting = db.Column(db.Boolean, default=True, nullable=False, index=True)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    applications = db.relationship('InternshipApplication', backref='cohort', lazy='dynamic', foreign_keys='InternshipApplication.cohort_id')
    
    def __repr__(self):
        return f'<InternshipCohort {self.cohort_code}>'
    
    def get_accepted_count(self):
        """Get count of accepted applications for this cohort"""
        return self.applications.filter_by(status='accepted').count()
    
    def is_full(self):
        """Check if cohort is at capacity"""
        if self.capacity is None:
            return False
        return self.get_accepted_count() >= self.capacity
    
    def to_dict(self, include_applications=False):
        data = {
            'id': self.id,
            'track_id': self.track_id,
            'track_name': self.track.name if self.track else None,
            'cohort_name': self.cohort_name,
            'cohort_code': self.cohort_code,
            'start_date': self.start_date.isoformat(),
            'end_date': self.end_date.isoformat(),
            'capacity': self.capacity,
            'is_accepting': self.is_accepting,
            'accepted_count': self.get_accepted_count(),
            'spots_available': max(0, self.capacity - self.get_accepted_count()) if self.capacity else None,
            'is_full': self.is_full(),
            'description': self.description,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }
        if include_applications:
            data['applications'] = [a.to_dict() for a in self.applications.all()]
        return data


class ApplicationStatusEnum(str, Enum):
    """Valid application status transitions"""
    PENDING = 'pending'
    REVIEWING = 'reviewing'
    SHORTLISTED = 'shortlisted'
    INTERVIEW_SCHEDULED = 'interview_scheduled'
    ACCEPTED = 'accepted'
    REJECTED = 'rejected'


class ApplicantTypeEnum(str, Enum):
    """Types of applicants"""
    GRADUATE = 'graduate'
    SHORT_COURSE_ALUMNI = 'short_course_alumni'
    EXTERNAL = 'external'


class InternshipApplication(db.Model):
    """Internship application submissions"""
    __tablename__ = 'internship_applications'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Applicant Info
    applicant_type = db.Column(db.Enum(ApplicantTypeEnum), nullable=False, index=True)
    full_name = db.Column(db.String(255), nullable=False, index=True)
    email = db.Column(db.String(255), nullable=False, index=True)
    phone = db.Column(db.String(20), nullable=False)
    national_id = db.Column(db.String(50), nullable=True)
    
    # Application Details
    track_id = db.Column(db.String(36), db.ForeignKey('internship_tracks.id'), nullable=False, index=True)
    cohort_id = db.Column(db.String(36), db.ForeignKey('internship_cohorts.id'), nullable=True, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)  # Link to existing user if available
    
    motivation_letter = db.Column(db.Text, nullable=False)
    portfolio_url = db.Column(db.String(500), nullable=True)
    github_url = db.Column(db.String(500), nullable=True)
    linkedin_url = db.Column(db.String(500), nullable=True)
    
    # CV File
    cv_file_path = db.Column(db.String(500), nullable=False)  # Path: uploads/internship_cvs/<uuid>/filename
    cv_original_name = db.Column(db.String(255), nullable=False)
    
    # Status & Review
    status = db.Column(db.Enum(ApplicationStatusEnum), default=ApplicationStatusEnum.PENDING, nullable=False, index=True)
    reviewer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    reviewer_notes = db.Column(db.Text, nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    
    # Interview
    interview_date = db.Column(db.DateTime, nullable=True)
    interview_notes = db.Column(db.Text, nullable=True)
    
    # Rejection
    rejection_reason = db.Column(db.Text, nullable=True)
    
    # Reference Code (human-readable format: ATB-YYYY-XXXX)
    reference_code = db.Column(db.String(20), nullable=False, unique=True, index=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    reviewer = db.relationship('User', foreign_keys=[reviewer_id], backref='applications_reviewed')
    user = db.relationship('User', foreign_keys=[user_id], backref='internship_applications')
    status_logs = db.relationship('ApplicationStatusLog', backref='application', lazy='dynamic', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<InternshipApplication {self.reference_code}>'
    
    def to_dict(self, include_logs=False):
        data = {
            'id': self.id,
            'reference_code': self.reference_code,
            'applicant_type': self.applicant_type.value if self.applicant_type else None,
            'full_name': self.full_name,
            'email': self.email,
            'phone': self.phone,
            'national_id': self.national_id,
            'track_id': self.track_id,
            'track_name': self.track.name if self.track else None,
            'cohort_id': self.cohort_id,
            'cohort_code': self.cohort.cohort_code if self.cohort else None,
            'user_id': self.user_id,
            'motivation_letter': self.motivation_letter[:500] + '...' if len(self.motivation_letter) > 500 else self.motivation_letter,  # Truncate for list view
            'portfolio_url': self.portfolio_url,
            'github_url': self.github_url,
            'linkedin_url': self.linkedin_url,
            'cv_original_name': self.cv_original_name,
            'status': self.status.value if self.status else None,
            'reviewer_id': self.reviewer_id,
            'reviewer_name': f"{self.reviewer.first_name} {self.reviewer.last_name}" if self.reviewer else None,
            'reviewer_notes': self.reviewer_notes,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'interview_date': self.interview_date.isoformat() if self.interview_date else None,
            'interview_notes': self.interview_notes,
            'rejection_reason': self.rejection_reason,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }
        if include_logs:
            data['status_logs'] = [log.to_dict() for log in self.status_logs.order_by(ApplicationStatusLog.changed_at.desc()).all()]
        return data



class InternshipTaskStatusEnum(str, Enum):
    """Task statuses"""
    PENDING = 'pending'
    ACTIVE = 'active'
    COMPLETED = 'completed'
    CANCELLED = 'cancelled'


class InternshipPriorityEnum(str, Enum):
    """Task priority levels"""
    LOW = 'low'
    MEDIUM = 'medium'
    HIGH = 'high'
    URGENT = 'urgent'


class InternshipTaskTypeEnum(str, Enum):
    """Types of tasks that can be assigned"""
    DOCUMENT = 'document'
    PRESENTATION = 'presentation'
    CODE = 'code'
    RESEARCH = 'research'
    ASSIGNMENT = 'assignment'
    PROJECT = 'project'
    REPORT = 'report'
    QUIZ = 'quiz'
    OTHER = 'other'


class InternshipTask(db.Model):
    """Tasks assigned to interns by instructors"""
    __tablename__ = 'internship_tasks'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    cohort_id = db.Column(db.String(36), db.ForeignKey('internship_cohorts.id'), nullable=True, index=True)
    assigned_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    task_type = db.Column(db.Enum(InternshipTaskTypeEnum), default=InternshipTaskTypeEnum.OTHER, nullable=False)
    priority = db.Column(db.Enum(InternshipPriorityEnum), default=InternshipPriorityEnum.MEDIUM, nullable=False)
    due_date = db.Column(db.DateTime, nullable=True)
    max_score = db.Column(db.Integer, nullable=True, default=100)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    cohort = db.relationship('InternshipCohort', backref='tasks')
    assigned_by = db.relationship('User', foreign_keys=[assigned_by_id], backref='tasks_assigned')
    assignments = db.relationship('InternshipTaskAssignment', backref='task', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<InternshipTask {self.title}>'

    def to_dict(self):
        total = self.assignments.count()
        completed = self.assignments.filter_by(status='approved').count()
        submitted = self.assignments.filter(InternshipTaskAssignment.status.in_(['submitted', 'approved'])).count()
        return {
            'id': self.id,
            'cohort_id': self.cohort_id,
            'cohort_name': self.cohort.cohort_name if self.cohort else None,
            'cohort_code': self.cohort.cohort_code if self.cohort else None,
            'assigned_by_id': self.assigned_by_id,
            'assigned_by_name': f"{self.assigned_by.first_name} {self.assigned_by.last_name}" if self.assigned_by else None,
            'title': self.title,
            'description': self.description,
            'task_type': self.task_type.value if self.task_type else None,
            'priority': self.priority.value if self.priority else None,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'max_score': self.max_score,
            'is_active': self.is_active,
            'total_interns': total,
            'completed_count': completed,
            'submitted_count': submitted,
            'progress_pct': round((completed / total * 100)) if total > 0 else 0,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }


class AssignmentStatusEnum(str, Enum):
    """Per-intern assignment progress status"""
    PENDING = 'pending'
    IN_PROGRESS = 'in_progress'
    SUBMITTED = 'submitted'
    APPROVED = 'approved'
    REJECTED = 'rejected'


class InternshipTaskAssignment(db.Model):
    """Links tasks to individual interns with progress tracking"""
    __tablename__ = 'internship_task_assignments'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id = db.Column(db.String(36), db.ForeignKey('internship_tasks.id'), nullable=False, index=True)
    intern_id = db.Column(db.String(36), db.ForeignKey('internship_applications.id'), nullable=False, index=True)
    status = db.Column(db.Enum(AssignmentStatusEnum), default=AssignmentStatusEnum.PENDING, nullable=False, index=True)
    submission_text = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(500), nullable=True)
    file_original_name = db.Column(db.String(255), nullable=True)
    score = db.Column(db.Integer, nullable=True)
    feedback = db.Column(db.Text, nullable=True)
    graded_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    graded_at = db.Column(db.DateTime, nullable=True)
    submitted_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    intern = db.relationship('InternshipApplication', backref='task_assignments')
    graded_by = db.relationship('User', foreign_keys=[graded_by_id], backref='task_grades')

    def __repr__(self):
        return f'<InternshipTaskAssignment task={self.task_id} intern={self.intern_id}>'

    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'task_title': self.task.title if self.task else None,
            'intern_id': self.intern_id,
            'intern_name': self.intern.full_name if self.intern else None,
            'intern_email': self.intern.email if self.intern else None,
            'intern_reference': self.intern.reference_code if self.intern else None,
            'status': self.status.value if self.status else None,
            'submission_text': self.submission_text,
            'file_path': self.file_path,
            'file_original_name': self.file_original_name,
            'score': self.score,
            'feedback': self.feedback,
            'graded_by_id': self.graded_by_id,
            'graded_by_name': f"{self.graded_by.first_name} {self.graded_by.last_name}" if self.graded_by else None,
            'graded_at': self.graded_at.isoformat() if self.graded_at else None,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }


class InternshipOfferLetter(db.Model):
    """
    Internship offer letters issued to accepted applicants.
    Stores the generated PDF path, SHA-256 hash for tamper-proofing,
    auto-generated credentials, and social sharing info.
    """
    __tablename__ = 'internship_offer_letters'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    application_id = db.Column(db.String(36), db.ForeignKey('internship_applications.id'), nullable=False, unique=True, index=True)

    # Generated content
    offer_number = db.Column(db.String(30), nullable=False, unique=True, index=True)  # e.g., OFR-2026-0001
    pdf_path = db.Column(db.String(500), nullable=True)  # Path to generated PDF on disk

    # Tamper-proofing — SHA-256 hash of the PDF binary
    pdf_hash = db.Column(db.String(64), nullable=True)
    verification_hash = db.Column(db.String(64), nullable=False, unique=True)  # Public-facing token for verification

    # Auto-generated user account for this intern
    generated_username = db.Column(db.String(80), nullable=True, unique=True)
    generated_password_hash = db.Column(db.String(256), nullable=True)  # Hashed password

    # Status tracking
    status = db.Column(db.String(20), default='sent', nullable=False)  # sent | accepted | declined | revoked
    sent_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    accepted_at = db.Column(db.DateTime, nullable=True)
    accepted_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    # Social sharing
    share_token = db.Column(db.String(64), nullable=True, unique=True)  # Token for public share page
    social_shares = db.Column(db.Integer, default=0)

    # Metadata
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    application = db.relationship('InternshipApplication', backref='offer_letter', uselist=False)
    created_by = db.relationship('User', foreign_keys=[created_by_id], backref='offer_letters_created')
    accepted_by_user = db.relationship('User', foreign_keys=[accepted_by_user_id], backref='offers_accepted')

    def __repr__(self):
        return f'<InternshipOfferLetter {self.offer_number}>'

    def to_dict(self, include_sensitive=False):
        data = {
            'id': self.id,
            'application_id': self.application_id,
            'offer_number': self.offer_number,
            'pdf_hash': self.pdf_hash,
            'verification_hash': self.verification_hash,
            'generated_username': self.generated_username,
            'status': self.status,
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
            'accepted_at': self.accepted_at.isoformat() if self.accepted_at else None,
            'accepted_by_user_id': self.accepted_by_user_id,
            'share_token': self.share_token,
            'social_shares': self.social_shares,
            'created_by_id': self.created_by_id,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }
        if include_sensitive:
            data['pdf_path'] = self.pdf_path
            data['generated_password_hash'] = self.generated_password_hash
        return data


class ApplicationStatusLog(db.Model):
    """Audit log for application status changes"""
    __tablename__ = 'application_status_logs'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    application_id = db.Column(db.String(36), db.ForeignKey('internship_applications.id'), nullable=False, index=True)
    changed_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    old_status = db.Column(db.Enum(ApplicationStatusEnum), nullable=True)
    new_status = db.Column(db.Enum(ApplicationStatusEnum), nullable=False)
    note = db.Column(db.Text, nullable=True)
    changed_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    changed_by = db.relationship('User', backref='status_changes_made')
    
    def __repr__(self):
        return f'<ApplicationStatusLog {self.application_id}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'application_id': self.application_id,
            'changed_by_id': self.changed_by_id,
            'changed_by_name': f"{self.changed_by.first_name} {self.changed_by.last_name}" if self.changed_by else 'System',
            'old_status': self.old_status.value if self.old_status else None,
            'new_status': self.new_status.value if self.new_status else None,
            'note': self.note,
            'changed_at': self.changed_at.isoformat(),
        }
