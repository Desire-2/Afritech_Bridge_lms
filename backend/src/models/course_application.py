from datetime import datetime
from .user_models import db


class CourseApplication(db.Model):
    __tablename__ = "course_applications"

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)

    # ========== SECTION 1: Applicant Information ==========
    full_name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(120), nullable=False, index=True)
    phone = db.Column(db.String(30), nullable=False)  # Include country code
    whatsapp_number = db.Column(db.String(30), nullable=True)  # Can be same as phone
    gender = db.Column(
        db.Enum("male", "female", "other", "prefer_not_to_say", name="gender_type"),
        nullable=True
    )
    age_range = db.Column(
        db.Enum("under_18", "18_24", "25_34", "35_44", "45_54", "55_plus", name="age_range_type"),
        nullable=True
    )
    country = db.Column(db.String(100), nullable=True)
    city = db.Column(db.String(100), nullable=True)

    # ========== SECTION 2: Education & Background ==========
    education_level = db.Column(
        db.Enum(
            "high_school", "diploma", "bachelors", "masters", 
            "phd", "other", name="education_level_type"
        ),
        nullable=True
    )
    current_status = db.Column(
        db.Enum(
            "student", "employed", "self_employed", "unemployed", 
            "freelancer", "other", name="current_status_type"
        ),
        nullable=True
    )
    field_of_study = db.Column(db.String(150), nullable=True)  # e.g., Finance, Marketing

    # ========== SECTION 3: Excel & Computer Skills Assessment ==========
    has_used_excel = db.Column(db.Boolean, default=False)
    excel_skill_level = db.Column(
        db.Enum("never_used", "beginner", "intermediate", "advanced", "expert", name="excel_skill_level_type"),
        nullable=True
    )
    # Store as JSON array of tasks: ["basic_formulas", "pivot_tables", "charts", etc.]
    excel_tasks_done = db.Column(db.Text, nullable=True)  # JSON array

    # ========== SECTION 4: Learning Goals ==========
    motivation = db.Column(db.Text, nullable=False)  # Why join this course
    learning_outcomes = db.Column(db.Text, nullable=True)  # What to achieve
    career_impact = db.Column(db.Text, nullable=True)  # How Excel helps career/business

    # ========== SECTION 5: Access & Availability ==========
    has_computer = db.Column(db.Boolean, nullable=False, default=False)
    internet_access_type = db.Column(
        db.Enum(
            "stable_broadband", "mobile_data", "limited_access", 
            "public_wifi", "other", name="internet_access_type"
        ),
        nullable=True
    )
    preferred_learning_mode = db.Column(
        db.Enum("self_paced", "live_sessions", "hybrid", name="learning_mode_type"),
        nullable=True
    )
    # Store as JSON array: ["morning", "afternoon", "evening", "weekend"]
    available_time = db.Column(db.Text, nullable=True)  # JSON array

    # ========== SECTION 6: Commitment & Agreement ==========
    committed_to_complete = db.Column(db.Boolean, default=False)
    agrees_to_assessments = db.Column(db.Boolean, default=False)
    referral_source = db.Column(db.String(200), nullable=True)  # How did you hear about us

    # ========== LEGACY FIELDS (for backward compatibility) ==========
    first_name = db.Column(db.String(50), nullable=True)  # Derived from full_name
    last_name = db.Column(db.String(50), nullable=True)   # Derived from full_name
    primary_device = db.Column(
        db.Enum("laptop", "desktop", "tablet", "mobile", name="device_type"),
        nullable=True
    )
    digital_skill_level = db.Column(
        db.Enum("beginner", "intermediate", "advanced", name="skill_level"),
        nullable=True
    )
    online_learning_experience = db.Column(db.Boolean, default=False)
    available_for_live_sessions = db.Column(db.Boolean, default=True)
    has_internet = db.Column(db.Boolean, nullable=False, default=False)

    # ========== Evaluation & Scoring ==========
    risk_score = db.Column(db.Integer, default=0)
    is_high_risk = db.Column(db.Boolean, default=False)
    application_score = db.Column(db.Integer, default=0)
    final_rank_score = db.Column(db.Float, default=0.0)
    readiness_score = db.Column(db.Integer, default=0)  # New: Overall readiness
    commitment_score = db.Column(db.Integer, default=0)  # New: Commitment level

    # ========== Payment Tracking ==========
    payment_method = db.Column(db.String(30), nullable=True)   # 'paypal' | 'mobile_money' | 'bank_transfer' | 'stripe'
    payment_status = db.Column(db.String(30), nullable=True)   # 'pending' | 'completed' | 'failed' | 'pending_bank_transfer' | 'confirmed'
    payment_reference = db.Column(db.String(150), nullable=True)  # Gateway order_id / transfer reference
    amount_paid = db.Column(db.Float, nullable=True)            # Actual amount charged (from course price/partial)
    payment_currency = db.Column(db.String(10), nullable=True)  # e.g. 'USD', 'XAF', 'GHS'

    # ========== Workflow ==========
    status = db.Column(
        db.Enum("pending", "approved", "rejected", "waitlisted", name="application_status"),
        default="pending"
    )
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    rejection_reason = db.Column(db.Text, nullable=True)
    admin_notes = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime, nullable=True)

    # ========== Draft Flag ==========
    # When True, the application was saved by the student but not yet fully submitted.
    # Used for the "Save & Proceed to Payment" flow — drafts are hidden from admin review.
    is_draft = db.Column(db.Boolean, default=False, nullable=False, server_default='0')

    # Cohort snapshot
    application_window_id = db.Column(db.Integer, db.ForeignKey('application_windows.id'), nullable=True)
    cohort_label = db.Column(db.String(120), nullable=True)
    cohort_start_date = db.Column(db.DateTime, nullable=True)
    cohort_end_date = db.Column(db.DateTime, nullable=True)

    # ========== Waitlist Migration Tracking ==========
    original_window_id = db.Column(db.Integer, db.ForeignKey('application_windows.id'), nullable=True)  # Original cohort before migration
    migrated_to_window_id = db.Column(db.Integer, db.ForeignKey('application_windows.id'), nullable=True)  # Target cohort after migration
    migrated_at = db.Column(db.DateTime, nullable=True)  # When migration happened
    migration_notes = db.Column(db.Text, nullable=True)  # Admin notes about migration

    # ========== Relationships ==========
    course = db.relationship('Course', backref=db.backref('course_applications', lazy='dynamic'))
    approver = db.relationship('User', foreign_keys=[approved_by], backref=db.backref('approved_applications', lazy='dynamic'))
    application_window = db.relationship('ApplicationWindow', foreign_keys=[application_window_id], backref=db.backref('applications', lazy='dynamic'))
    original_window = db.relationship('ApplicationWindow', foreign_keys=[original_window_id])
    migrated_to_window = db.relationship('ApplicationWindow', foreign_keys=[migrated_to_window_id])

    def to_dict(self, include_sensitive=False):
        """Convert application to dictionary for API responses"""
        base_dict = {
            "id": self.id,
            "course_id": self.course_id,
            "full_name": self.full_name,
            "email": self.email,
            "phone": self.phone,
            "gender": self.gender,
            "age_range": self.age_range,
            "country": self.country,
            "city": self.city,
            
            # Education & Background
            "education_level": self.education_level,
            "current_status": self.current_status,
            "field_of_study": self.field_of_study,
            
            # Excel Skills
            "has_used_excel": self.has_used_excel,
            "excel_skill_level": self.excel_skill_level,
            
            # Access & Availability
            "has_computer": self.has_computer,
            "internet_access_type": self.internet_access_type,
            "preferred_learning_mode": self.preferred_learning_mode,
            
            # Commitment
            "committed_to_complete": self.committed_to_complete,
            "agrees_to_assessments": self.agrees_to_assessments,
            "referral_source": self.referral_source,
            
            # Scores & Status
            "risk_score": self.risk_score,
            "application_score": self.application_score,
            "final_rank_score": self.final_rank_score,
            "readiness_score": self.readiness_score,
            "commitment_score": self.commitment_score,
            "is_high_risk": self.is_high_risk,
            "status": self.status,
            "is_draft": self.is_draft,
            "payment_method": self.payment_method,
            "payment_status": self.payment_status,
            "payment_reference": self.payment_reference,
            "amount_paid": self.amount_paid,
            "payment_currency": self.payment_currency,
            "application_window_id": self.application_window_id,
            "cohort_label": self.cohort_label,
            "cohort_start_date": self.cohort_start_date.isoformat() if self.cohort_start_date else None,
            "cohort_end_date": self.cohort_end_date.isoformat() if self.cohort_end_date else None,
            
            # Migration tracking
            "original_window_id": self.original_window_id,
            "migrated_to_window_id": self.migrated_to_window_id,
            "migrated_at": self.migrated_at.isoformat() if self.migrated_at else None,
            "migration_notes": self.migration_notes,
            
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        
        # Include sensitive data for admin views
        if include_sensitive:
            base_dict.update({
                "motivation": self.motivation,
                "learning_outcomes": self.learning_outcomes,
                "career_impact": self.career_impact,
                "excel_tasks_done": self.excel_tasks_done,
                "available_time": self.available_time,
                "whatsapp_number": self.whatsapp_number,
                "admin_notes": self.admin_notes,
                "rejection_reason": self.rejection_reason,
                "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            })
        
        return base_dict

    def split_name(self):
        """Split full_name into first_name and last_name for backward compatibility"""
        if self.full_name:
            parts = self.full_name.strip().split()
            self.first_name = parts[0] if parts else ""
            self.last_name = " ".join(parts[1:]) if len(parts) > 1 else ""
