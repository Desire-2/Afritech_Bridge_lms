# Enhanced Student Progress and Learning Models for Afritec Bridge LMS

from datetime import datetime
import json
from .user_models import db, User
from .course_models import Course, Module, Lesson, Quiz, Enrollment

class LessonCompletion(db.Model):
    """Track completion status of individual lessons by students"""
    __tablename__ = 'lesson_completions'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=False)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)
    time_spent = db.Column(db.Integer, default=0)  # in seconds
    
    # Enhanced progress tracking fields
    completed = db.Column(db.Boolean, default=False)
    reading_progress = db.Column(db.Float, default=0.0)  # 0-100 percentage
    engagement_score = db.Column(db.Float, default=0.0)  # 0-100 engagement score
    scroll_progress = db.Column(db.Float, default=0.0)  # 0-100 scroll percentage
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_accessed = db.Column(db.DateTime, default=datetime.utcnow)
    
    student = db.relationship('User', backref=db.backref('lesson_completions', lazy='dynamic'))
    lesson = db.relationship('Lesson', backref=db.backref('completions', lazy='dynamic'))
    
    __table_args__ = (db.UniqueConstraint('student_id', 'lesson_id', name='_student_lesson_completion_uc'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'lesson_id': self.lesson_id,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'time_spent': self.time_spent,
            'completed': self.completed,
            'reading_progress': self.reading_progress,
            'engagement_score': self.engagement_score,
            'scroll_progress': self.scroll_progress,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'last_accessed': self.last_accessed.isoformat() if self.last_accessed else None
        }

class UserProgress(db.Model):
    """Track overall progress for students in courses"""
    __tablename__ = 'user_progress'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    completion_percentage = db.Column(db.Float, default=0.0)
    total_time_spent = db.Column(db.Integer, default=0)  # in seconds
    last_accessed = db.Column(db.DateTime, default=datetime.utcnow)
    current_lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=True)
    
    user = db.relationship('User', backref=db.backref('course_progress', lazy='dynamic'))
    course = db.relationship('Course', backref=db.backref('student_progress', lazy='dynamic'))
    current_lesson = db.relationship('Lesson')
    
    __table_args__ = (db.UniqueConstraint('user_id', 'course_id', name='_user_course_progress_uc'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'course_id': self.course_id,
            'completion_percentage': self.completion_percentage,
            'total_time_spent': self.total_time_spent,
            'last_accessed': self.last_accessed.isoformat(),
            'current_lesson_id': self.current_lesson_id,
            'course_title': self.course.title if self.course else None
        }

class StudentNote(db.Model):
    """Allow students to take notes during lessons"""
    __tablename__ = 'student_notes'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    student = db.relationship('User', backref=db.backref('notes', lazy='dynamic'))
    lesson = db.relationship('Lesson', backref=db.backref('student_notes', lazy='dynamic'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'lesson_id': self.lesson_id,
            'content': self.content,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'lesson_title': self.lesson.title if self.lesson else None
        }

class Badge(db.Model):
    """Achievement badges for students"""
    __tablename__ = 'badges'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    icon_url = db.Column(db.String(255), nullable=True)
    criteria = db.Column(db.Text, nullable=True)  # JSON string describing criteria
    points = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'icon_url': self.icon_url,
            'criteria': self.criteria,
            'points': self.points,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat()
        }

class UserBadge(db.Model):
    """Track badges earned by users"""
    __tablename__ = 'user_badges'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    badge_id = db.Column(db.Integer, db.ForeignKey('badges.id'), nullable=False)
    earned_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('user_badges', lazy='dynamic'))
    badge = db.relationship('Badge', backref=db.backref('awarded_to', lazy='dynamic'))
    
    __table_args__ = (db.UniqueConstraint('user_id', 'badge_id', name='_user_badge_uc'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'badge_id': self.badge_id,
            'earned_at': self.earned_at.isoformat(),
            'badge': self.badge.to_dict() if self.badge else None
        }

class StudentBookmark(db.Model):
    """Bookmarked courses by students"""
    __tablename__ = 'student_bookmarks'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    student = db.relationship('User', backref=db.backref('bookmarks', lazy='dynamic'))
    course = db.relationship('Course', backref=db.backref('bookmarked_by', lazy='dynamic'))
    
    __table_args__ = (db.UniqueConstraint('student_id', 'course_id', name='_student_course_bookmark_uc'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'course_id': self.course_id,
            'created_at': self.created_at.isoformat(),
            'course': self.course.to_dict() if self.course else None
        }

class StudentForum(db.Model):
    """Discussion forums for courses"""
    __tablename__ = 'student_forums'
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    course = db.relationship('Course', backref=db.backref('forums', lazy='dynamic'))
    creator = db.relationship('User', backref=db.backref('created_forums', lazy='dynamic'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'course_id': self.course_id,
            'title': self.title,
            'description': self.description,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat(),
            'is_active': self.is_active,
            'course_title': self.course.title if self.course else None,
            'creator_name': f"{self.creator.first_name} {self.creator.last_name}" if self.creator else None
        }

class ForumPost(db.Model):
    """Posts in course forums"""
    __tablename__ = 'forum_posts'
    id = db.Column(db.Integer, primary_key=True)
    forum_id = db.Column(db.Integer, db.ForeignKey('student_forums.id'), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    parent_post_id = db.Column(db.Integer, db.ForeignKey('forum_posts.id'), nullable=True)  # For replies
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    forum = db.relationship('StudentForum', backref=db.backref('posts', lazy='dynamic'))
    author = db.relationship('User', backref=db.backref('forum_posts', lazy='dynamic'))
    parent_post = db.relationship('ForumPost', remote_side=[id], backref='replies')
    
    def to_dict(self):
        return {
            'id': self.id,
            'forum_id': self.forum_id,
            'author_id': self.author_id,
            'title': self.title,
            'content': self.content,
            'parent_post_id': self.parent_post_id,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'is_active': self.is_active,
            'author_name': f"{self.author.first_name} {self.author.last_name}" if self.author else None,
            'reply_count': len(self.replies) if hasattr(self, 'replies') else 0
        }

# ===== NEW ENHANCED MODELS FOR COMPREHENSIVE LMS FEATURES =====

class CourseEnrollmentApplication(db.Model):
    """Handle scholarship course applications and enrollment workflow"""
    __tablename__ = 'course_enrollment_applications'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    application_type = db.Column(db.String(20), nullable=False)  # 'scholarship', 'paid', 'free'
    status = db.Column(db.String(20), default='pending')  # 'pending', 'approved', 'rejected', 'enrolled'
    motivation_letter = db.Column(db.Text, nullable=True)
    prerequisites_met = db.Column(db.Boolean, default=False)
    payment_status = db.Column(db.String(20), nullable=True)  # 'pending', 'completed', 'failed'
    payment_reference = db.Column(db.String(100), nullable=True)
    reviewed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    review_notes = db.Column(db.Text, nullable=True)
    applied_at = db.Column(db.DateTime, default=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    enrolled_at = db.Column(db.DateTime, nullable=True)
    
    student = db.relationship('User', foreign_keys=[student_id], backref=db.backref('enrollment_applications', lazy='dynamic'))
    course = db.relationship('Course', backref=db.backref('applications', lazy='dynamic'))
    reviewer = db.relationship('User', foreign_keys=[reviewed_by])
    
    __table_args__ = (db.UniqueConstraint('student_id', 'course_id', name='_student_course_application_uc'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'course_id': self.course_id,
            'application_type': self.application_type,
            'status': self.status,
            'motivation_letter': self.motivation_letter,
            'prerequisites_met': self.prerequisites_met,
            'payment_status': self.payment_status,
            'payment_reference': self.payment_reference,
            'reviewed_by': self.reviewed_by,
            'review_notes': self.review_notes,
            'applied_at': self.applied_at.isoformat(),
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'enrolled_at': self.enrolled_at.isoformat() if self.enrolled_at else None,
            'course_title': self.course.title if self.course else None,
            'student_name': f"{self.student.first_name} {self.student.last_name}" if self.student else None
        }

class ModuleProgress(db.Model):
    """Track detailed progress through course modules with strict progression"""
    __tablename__ = 'module_progress'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    module_id = db.Column(db.Integer, db.ForeignKey('modules.id'), nullable=False)
    enrollment_id = db.Column(db.Integer, db.ForeignKey('enrollments.id'), nullable=False)
    
    # Scoring breakdown (80% total required to pass)
    course_contribution_score = db.Column(db.Float, default=0.0)  # 10% - forums, help, tracking
    quiz_score = db.Column(db.Float, default=0.0)  # 30% - knowledge checks
    assignment_score = db.Column(db.Float, default=0.0)  # 40% - hands-on work
    final_assessment_score = db.Column(db.Float, default=0.0)  # 20% - module assessment
    
    cumulative_score = db.Column(db.Float, default=0.0)  # Total weighted score
    attempts_count = db.Column(db.Integer, default=0)
    max_attempts = db.Column(db.Integer, default=3)
    
    status = db.Column(db.String(20), default='locked')  # 'locked', 'unlocked', 'in_progress', 'completed', 'failed'
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    failed_at = db.Column(db.DateTime, nullable=True)
    
    # Unlock logic
    unlocked_at = db.Column(db.DateTime, nullable=True)
    prerequisites_met = db.Column(db.Boolean, default=False)
    
    student = db.relationship('User', backref=db.backref('module_progress', lazy='dynamic'))
    module = db.relationship('Module', backref=db.backref('student_progress', lazy='dynamic'))
    enrollment = db.relationship('Enrollment', backref=db.backref('module_progress', lazy='dynamic'))
    
    __table_args__ = (db.UniqueConstraint('student_id', 'module_id', 'enrollment_id', name='_student_module_progress_uc'),)
    
    def calculate_cumulative_score(self):
        """Calculate the weighted cumulative score"""
        # Ensure all scores default to 0.0 if None
        course_contrib = self.course_contribution_score or 0.0
        quiz = self.quiz_score or 0.0
        assignment = self.assignment_score or 0.0
        final = self.final_assessment_score or 0.0
        
        self.cumulative_score = (
            (course_contrib * 0.10) +
            (quiz * 0.30) +
            (assignment * 0.40) +
            (final * 0.20)
        )
        return self.cumulative_score
    
    def can_proceed_to_next(self):
        """Check if student can proceed to next module"""
        return self.cumulative_score >= 80.0 and self.status == 'completed'
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'module_id': self.module_id,
            'enrollment_id': self.enrollment_id,
            'course_contribution_score': self.course_contribution_score or 0.0,
            'quiz_score': self.quiz_score or 0.0,
            'assignment_score': self.assignment_score or 0.0,
            'final_assessment_score': self.final_assessment_score or 0.0,
            'cumulative_score': self.cumulative_score or 0.0,
            'attempts_count': self.attempts_count or 0,
            'max_attempts': self.max_attempts or 3,
            'status': self.status or 'locked',
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'failed_at': self.failed_at.isoformat() if self.failed_at else None,
            'unlocked_at': self.unlocked_at.isoformat() if self.unlocked_at else None,
            'prerequisites_met': self.prerequisites_met or False,
            'module_title': self.module.title if self.module else None
        }

class AssessmentAttempt(db.Model):
    """Track multiple attempts at quizzes, assignments, and assessments"""
    __tablename__ = 'assessment_attempts'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    assessment_type = db.Column(db.String(20), nullable=False)  # 'quiz', 'assignment', 'project', 'final_assessment'
    assessment_id = db.Column(db.Integer, nullable=False)  # Generic ID for different assessment types
    module_id = db.Column(db.Integer, db.ForeignKey('modules.id'), nullable=False)
    
    attempt_number = db.Column(db.Integer, nullable=False)
    score = db.Column(db.Float, default=0.0)
    max_score = db.Column(db.Float, nullable=False)
    percentage = db.Column(db.Float, default=0.0)
    
    submission_data = db.Column(db.Text, nullable=True)  # JSON data of submission
    feedback = db.Column(db.Text, nullable=True)
    graded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    submitted_at = db.Column(db.DateTime, nullable=True)
    graded_at = db.Column(db.DateTime, nullable=True)
    
    status = db.Column(db.String(20), default='in_progress')  # 'in_progress', 'submitted', 'graded', 'failed'
    
    student = db.relationship('User', foreign_keys=[student_id], backref=db.backref('assessment_attempts', lazy='dynamic'))
    module = db.relationship('Module', backref=db.backref('assessment_attempts', lazy='dynamic'))
    grader = db.relationship('User', foreign_keys=[graded_by])
    
    def calculate_percentage(self):
        """Calculate percentage score"""
        if self.max_score > 0:
            self.percentage = (self.score / self.max_score) * 100
        return self.percentage
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'assessment_type': self.assessment_type,
            'assessment_id': self.assessment_id,
            'module_id': self.module_id,
            'attempt_number': self.attempt_number,
            'score': self.score,
            'max_score': self.max_score,
            'percentage': self.percentage,
            'submission_data': self.submission_data,
            'feedback': self.feedback,
            'graded_by': self.graded_by,
            'started_at': self.started_at.isoformat(),
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'graded_at': self.graded_at.isoformat() if self.graded_at else None,
            'status': self.status,
            'module_title': self.module.title if self.module else None
        }

class Certificate(db.Model):
    """Course completion certificates"""
    __tablename__ = 'certificates'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    enrollment_id = db.Column(db.Integer, db.ForeignKey('enrollments.id'), nullable=False)
    
    certificate_number = db.Column(db.String(100), unique=True, nullable=False)
    overall_score = db.Column(db.Float, nullable=False)
    grade = db.Column(db.String(10), nullable=False)  # 'A', 'B', 'C', etc.
    
    skills_acquired = db.Column(db.Text, nullable=True)  # JSON list of skills
    portfolio_items = db.Column(db.Text, nullable=True)  # JSON list of portfolio work
    
    issued_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    
    # Digital signature/verification
    verification_hash = db.Column(db.String(256), nullable=False)
    
    student = db.relationship('User', backref=db.backref('certificates', lazy='dynamic'))
    course = db.relationship('Course', backref=db.backref('certificates', lazy='dynamic'))
    enrollment = db.relationship('Enrollment', backref=db.backref('certificate', uselist=False))
    
    def generate_certificate_number(self):
        """Generate unique certificate number"""
        from datetime import datetime
        import hashlib
        import random
        
        # Format: ABC-YYYY-NNNNNN
        year = datetime.now().year
        random_num = random.randint(100000, 999999)
        self.certificate_number = f"ABC-{year}-{random_num}"
        
        # Generate verification hash
        hash_string = f"{self.student_id}{self.course_id}{self.certificate_number}{self.issued_at}"
        self.verification_hash = hashlib.sha256(hash_string.encode()).hexdigest()
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'course_id': self.course_id,
            'enrollment_id': self.enrollment_id,
            'certificate_number': self.certificate_number,
            'overall_score': self.overall_score,
            'grade': self.grade,
            'skills_acquired': json.loads(self.skills_acquired) if self.skills_acquired else [],
            'portfolio_items': json.loads(self.portfolio_items) if self.portfolio_items else [],
            'issued_at': self.issued_at.isoformat(),
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'is_active': self.is_active,
            'verification_hash': self.verification_hash,
            'student_name': f"{self.student.first_name} {self.student.last_name}" if self.student else None,
            'course_title': self.course.title if self.course else None
        }

class SkillBadge(db.Model):
    """Skill-based micro-certifications"""
    __tablename__ = 'skill_badges'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=False)
    icon_url = db.Column(db.String(255), nullable=True)
    criteria = db.Column(db.Text, nullable=False)  # JSON criteria for earning
    category = db.Column(db.String(50), nullable=False)  # 'technical', 'soft_skills', 'project', etc.
    difficulty_level = db.Column(db.String(20), nullable=False)  # 'beginner', 'intermediate', 'advanced'
    points_value = db.Column(db.Integer, default=10)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'icon_url': self.icon_url,
            'criteria': json.loads(self.criteria) if self.criteria else {},
            'category': self.category,
            'difficulty_level': self.difficulty_level,
            'points_value': self.points_value,
            'created_at': self.created_at.isoformat(),
            'is_active': self.is_active
        }

class StudentSkillBadge(db.Model):
    """Track badges earned by students"""
    __tablename__ = 'student_skill_badges'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    badge_id = db.Column(db.Integer, db.ForeignKey('skill_badges.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=True)  # Optional course context
    module_id = db.Column(db.Integer, db.ForeignKey('modules.id'), nullable=True)  # Optional module context
    
    earned_at = db.Column(db.DateTime, default=datetime.utcnow)
    evidence_data = db.Column(db.Text, nullable=True)  # JSON evidence of achievement
    verified = db.Column(db.Boolean, default=False)
    verified_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    verified_at = db.Column(db.DateTime, nullable=True)
    
    student = db.relationship('User', foreign_keys=[student_id], backref=db.backref('earned_badges', lazy='dynamic'))
    badge = db.relationship('SkillBadge', backref=db.backref('earned_by', lazy='dynamic'))
    course = db.relationship('Course', backref=db.backref('badges_earned', lazy='dynamic'))
    module = db.relationship('Module', backref=db.backref('badges_earned', lazy='dynamic'))
    verifier = db.relationship('User', foreign_keys=[verified_by])
    
    __table_args__ = (db.UniqueConstraint('student_id', 'badge_id', 'course_id', 'module_id', name='_student_badge_context_uc'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'badge_id': self.badge_id,
            'course_id': self.course_id,
            'module_id': self.module_id,
            'earned_at': self.earned_at.isoformat(),
            'evidence_data': json.loads(self.evidence_data) if self.evidence_data else {},
            'verified': self.verified,
            'verified_by': self.verified_by,
            'verified_at': self.verified_at.isoformat() if self.verified_at else None,
            'badge': self.badge.to_dict() if self.badge else None,
            'course_title': self.course.title if self.course else None,
            'module_title': self.module.title if self.module else None
        }

class StudentTranscript(db.Model):
    """Comprehensive academic transcript for students"""
    __tablename__ = 'student_transcripts'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Overall statistics
    total_courses_enrolled = db.Column(db.Integer, default=0)
    total_courses_completed = db.Column(db.Integer, default=0)
    total_certificates = db.Column(db.Integer, default=0)
    total_badges = db.Column(db.Integer, default=0)
    overall_gpa = db.Column(db.Float, default=0.0)
    
    # Time tracking
    total_learning_hours = db.Column(db.Integer, default=0)  # in minutes
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Skills mapping
    skills_acquired = db.Column(db.Text, nullable=True)  # JSON skills array
    competency_levels = db.Column(db.Text, nullable=True)  # JSON competency mapping
    
    student = db.relationship('User', backref=db.backref('transcript', uselist=False))
    
    def update_statistics(self):
        """Update transcript statistics"""
        # Count completed courses through enrollments
        completed_enrollments = db.session.query(Enrollment).filter(
            Enrollment.student_id == self.student_id,
            Enrollment.completed_at.isnot(None)
        ).count()
        
        # Count certificates
        certificates_count = db.session.query(Certificate).filter_by(
            student_id=self.student_id, 
            is_active=True
        ).count()
        
        # Count badges
        badges_count = db.session.query(StudentSkillBadge).filter_by(student_id=self.student_id).count()
        
        # Update statistics
        self.total_courses_completed = completed_enrollments
        self.total_certificates = certificates_count
        self.total_badges = badges_count
        
        # Calculate GPA based on certificates
        certificates = db.session.query(Certificate).filter_by(
            student_id=self.student_id, 
            is_active=True
        ).all()
        
        if certificates:
            total_score = sum(cert.overall_score for cert in certificates if cert.overall_score)
            self.overall_gpa = (total_score / len(certificates)) / 25 if total_score > 0 else 0.0  # Convert to 4.0 scale
        else:
            self.overall_gpa = 0.0
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'total_courses_enrolled': self.total_courses_enrolled,
            'total_courses_completed': self.total_courses_completed,
            'total_certificates': self.total_certificates,
            'total_badges': self.total_badges,
            'overall_gpa': self.overall_gpa,
            'total_learning_hours': self.total_learning_hours,
            'last_updated': self.last_updated.isoformat(),
            'skills_acquired': json.loads(self.skills_acquired) if self.skills_acquired else [],
            'competency_levels': json.loads(self.competency_levels) if self.competency_levels else {},
            'student_name': f"{self.student.first_name} {self.student.last_name}" if self.student else None
        }

class LearningAnalytics(db.Model):
    """Detailed learning analytics and performance tracking"""
    __tablename__ = 'learning_analytics'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    
    # Time analytics
    daily_learning_minutes = db.Column(db.Text, nullable=True)  # JSON time tracking per day
    weekly_learning_minutes = db.Column(db.Text, nullable=True)  # JSON weekly aggregates
    peak_learning_hours = db.Column(db.Text, nullable=True)  # JSON hours when most active
    
    # Performance trends
    quiz_performance_trend = db.Column(db.Text, nullable=True)  # JSON performance over time
    assignment_performance_trend = db.Column(db.Text, nullable=True)
    engagement_score = db.Column(db.Float, default=0.0)  # 0-100 engagement score
    
    # Weak areas identification
    weak_topics = db.Column(db.Text, nullable=True)  # JSON array of struggling topics
    recommended_reviews = db.Column(db.Text, nullable=True)  # JSON recommended review materials
    
    # Learning patterns
    preferred_content_types = db.Column(db.Text, nullable=True)  # JSON content type preferences
    learning_velocity = db.Column(db.Float, default=0.0)  # Lessons per week
    
    last_calculated = db.Column(db.DateTime, default=datetime.utcnow)
    
    student = db.relationship('User', backref=db.backref('learning_analytics', lazy='dynamic'))
    course = db.relationship('Course', backref=db.backref('student_analytics', lazy='dynamic'))
    
    __table_args__ = (db.UniqueConstraint('student_id', 'course_id', name='_student_course_analytics_uc'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'course_id': self.course_id,
            'daily_learning_minutes': json.loads(self.daily_learning_minutes) if self.daily_learning_minutes else {},
            'weekly_learning_minutes': json.loads(self.weekly_learning_minutes) if self.weekly_learning_minutes else {},
            'peak_learning_hours': json.loads(self.peak_learning_hours) if self.peak_learning_hours else {},
            'quiz_performance_trend': json.loads(self.quiz_performance_trend) if self.quiz_performance_trend else [],
            'assignment_performance_trend': json.loads(self.assignment_performance_trend) if self.assignment_performance_trend else [],
            'engagement_score': self.engagement_score,
            'weak_topics': json.loads(self.weak_topics) if self.weak_topics else [],
            'recommended_reviews': json.loads(self.recommended_reviews) if self.recommended_reviews else [],
            'preferred_content_types': json.loads(self.preferred_content_types) if self.preferred_content_types else {},
            'learning_velocity': self.learning_velocity,
            'last_calculated': self.last_calculated.isoformat(),
            'course_title': self.course.title if self.course else None
        }

class StudentSuspension(db.Model):
    """Track student suspensions from courses due to excessive failed attempts"""
    __tablename__ = 'student_suspensions'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    enrollment_id = db.Column(db.Integer, db.ForeignKey('enrollments.id'), nullable=False)
    
    # Suspension details
    suspended_at = db.Column(db.DateTime, default=datetime.utcnow)
    reason = db.Column(db.String(255), default='Maximum retake attempts exceeded')
    failed_module_id = db.Column(db.Integer, db.ForeignKey('modules.id'), nullable=False)
    total_attempts_made = db.Column(db.Integer, nullable=False)
    
    # Appeal and reinstatement
    can_appeal = db.Column(db.Boolean, default=True)
    appeal_deadline = db.Column(db.DateTime, nullable=True)
    appeal_submitted = db.Column(db.Boolean, default=False)
    appeal_text = db.Column(db.Text, nullable=True)
    appeal_submitted_at = db.Column(db.DateTime, nullable=True)
    
    # Review status
    review_status = db.Column(db.String(20), default='pending')  # 'pending', 'approved', 'denied'
    reviewed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    review_notes = db.Column(db.Text, nullable=True)
    
    # Reinstatement
    reinstated = db.Column(db.Boolean, default=False)
    reinstated_at = db.Column(db.DateTime, nullable=True)
    additional_attempts_granted = db.Column(db.Integer, default=0)
    
    # Relationships
    student = db.relationship('User', foreign_keys=[student_id], backref=db.backref('suspensions', lazy='dynamic'))
    course = db.relationship('Course', backref=db.backref('suspended_students', lazy='dynamic'))
    enrollment = db.relationship('Enrollment', backref=db.backref('suspension', uselist=False))
    failed_module = db.relationship('Module', backref=db.backref('suspensions_caused', lazy='dynamic'))
    reviewer = db.relationship('User', foreign_keys=[reviewed_by])
    
    __table_args__ = (db.UniqueConstraint('student_id', 'course_id', 'enrollment_id', name='_student_course_suspension_uc'),)
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Set appeal deadline to 30 days from suspension
        from datetime import timedelta
        self.appeal_deadline = self.suspended_at + timedelta(days=30)
    
    def can_submit_appeal(self):
        """Check if student can still submit an appeal"""
        from datetime import datetime
        return (
            self.can_appeal and 
            not self.appeal_submitted and 
            self.appeal_deadline and 
            datetime.utcnow() <= self.appeal_deadline
        )
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'course_id': self.course_id,
            'enrollment_id': self.enrollment_id,
            'suspended_at': self.suspended_at.isoformat(),
            'reason': self.reason,
            'failed_module_id': self.failed_module_id,
            'total_attempts_made': self.total_attempts_made,
            'can_appeal': self.can_appeal,
            'appeal_deadline': self.appeal_deadline.isoformat() if self.appeal_deadline else None,
            'appeal_submitted': self.appeal_submitted,
            'appeal_text': self.appeal_text,
            'appeal_submitted_at': self.appeal_submitted_at.isoformat() if self.appeal_submitted_at else None,
            'review_status': self.review_status,
            'reviewed_by': self.reviewed_by,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'review_notes': self.review_notes,
            'reinstated': self.reinstated,
            'reinstated_at': self.reinstated_at.isoformat() if self.reinstated_at else None,
            'additional_attempts_granted': self.additional_attempts_granted,
            'can_submit_appeal': self.can_submit_appeal(),
            'course_title': self.course.title if self.course else None,
            'failed_module_title': self.failed_module.title if self.failed_module else None,
            'student_name': f"{self.student.first_name} {self.student.last_name}" if self.student else None
        }