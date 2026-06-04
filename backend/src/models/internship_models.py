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
