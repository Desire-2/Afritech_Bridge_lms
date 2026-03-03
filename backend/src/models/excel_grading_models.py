"""
Excel AI Grading Models
Tracks AI-generated grades, analysis results, and audit trail for MS Excel submissions.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from .user_models import db


class ExcelGradingResult(db.Model):
    """Stores AI grading results for Excel assignment/project submissions."""
    __tablename__ = 'excel_grading_results'

    id = Column(Integer, primary_key=True)

    # Link to either an assignment submission or project submission
    submission_type = Column(String(50), nullable=False)  # 'assignment' or 'project'
    assignment_submission_id = Column(Integer, ForeignKey('assignment_submissions.id'), nullable=True)
    project_submission_id = Column(Integer, ForeignKey('project_submissions.id'), nullable=True)

    student_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    course_id = Column(Integer, ForeignKey('courses.id'), nullable=False)

    # Source file info
    file_id = Column(String(255), nullable=True)  # Google Drive file ID
    file_name = Column(String(255), nullable=True)
    file_size = Column(Integer, default=0)

    # Scores
    total_score = Column(Float, default=0.0)
    max_score = Column(Float, default=100.0)
    grade_letter = Column(String(5), nullable=True)

    # Rubric breakdown (JSON matching the strict output schema)
    rubric_breakdown = Column(JSON, nullable=True)

    # Full analysis data (detailed workbook structure, formula list, etc.)
    analysis_data = Column(JSON, nullable=True)

    # AI-generated feedback
    overall_feedback = Column(Text, nullable=True)

    # Confidence and flags
    confidence = Column(String(20), default='medium')  # high / medium / low
    manual_review_required = Column(Boolean, default=True)
    flagged_issues = Column(JSON, nullable=True)  # list of {type, description}

    # Audit
    graded_at = Column(DateTime, default=datetime.utcnow)
    ai_provider = Column(String(50), nullable=True)  # e.g. 'openrouter', 'gemini'
    processing_time_seconds = Column(Float, nullable=True)

    # Instructor review
    instructor_reviewed = Column(Boolean, default=False)
    instructor_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    instructor_reviewed_at = Column(DateTime, nullable=True)
    instructor_override_score = Column(Float, nullable=True)
    instructor_notes = Column(Text, nullable=True)

    # Status: pending, completed, failed, reviewed
    status = Column(String(30), default='pending')

    # Relationships
    student = relationship('User', foreign_keys=[student_id], backref=db.backref('excel_grading_results', lazy='dynamic'))
    instructor = relationship('User', foreign_keys=[instructor_id])
    assignment_submission = relationship('AssignmentSubmission', backref=db.backref('excel_grading_results', lazy='dynamic'))
    project_submission = relationship('ProjectSubmission', backref=db.backref('excel_grading_results', lazy='dynamic'))
    course = relationship('Course', backref=db.backref('excel_grading_results', lazy='dynamic'))

    def __repr__(self):
        return f'<ExcelGradingResult {self.id} score={self.total_score}/{self.max_score}>'

    def to_dict(self):
        return {
            'id': self.id,
            'submission_type': self.submission_type,
            'assignment_submission_id': self.assignment_submission_id,
            'project_submission_id': self.project_submission_id,
            'student_id': self.student_id,
            'course_id': self.course_id,
            'file_id': self.file_id,
            'file_name': self.file_name,
            'file_size': self.file_size,
            'total_score': self.total_score,
            'max_score': self.max_score,
            'grade_letter': self.grade_letter,
            'rubric_breakdown': self.rubric_breakdown,
            'analysis_data': self.analysis_data,
            'overall_feedback': self.overall_feedback,
            'confidence': self.confidence,
            'manual_review_required': self.manual_review_required,
            'flagged_issues': self.flagged_issues,
            'graded_at': self.graded_at.isoformat() if self.graded_at else None,
            'ai_provider': self.ai_provider,
            'processing_time_seconds': self.processing_time_seconds,
            'instructor_reviewed': self.instructor_reviewed,
            'instructor_id': self.instructor_id,
            'instructor_reviewed_at': self.instructor_reviewed_at.isoformat() if self.instructor_reviewed_at else None,
            'instructor_override_score': self.instructor_override_score,
            'instructor_notes': self.instructor_notes,
            'status': self.status,
            'student_name': f"{self.student.first_name} {self.student.last_name}" if self.student else None,
        }

    def to_strict_json(self):
        """Return the strict JSON output format specified in the requirements."""
        return {
            'student_id': str(self.student_id),
            'course': 'MS Excel',
            'assignment_title': self.file_name or '',
            'total_score': self.total_score,
            'max_score': self.max_score,
            'grade': self.grade_letter or '',
            'rubric_breakdown': self.rubric_breakdown or {},
            'overall_feedback': self.overall_feedback or '',
            'confidence': self.confidence,
            'manual_review_required': self.manual_review_required,
        }


class GradingExperience(db.Model):
    """
    Records instructor review outcomes so the AI can learn from experience.

    Each row = one grading result that was reviewed by an instructor.
    The ``score_delta`` (instructor_score - ai_score) is the key learning
    signal used for calibration.
    """
    __tablename__ = 'grading_experiences'

    id = Column(Integer, primary_key=True)

    grading_result_id = Column(Integer, ForeignKey('excel_grading_results.id'), nullable=False)
    assignment_id = Column(Integer, nullable=False, index=True)
    course_id = Column(Integer, ForeignKey('courses.id'), nullable=False, index=True)
    module_id = Column(Integer, nullable=True, index=True)

    # AI grading output
    ai_score = Column(Float, nullable=False)
    ai_max_score = Column(Float, default=100.0)

    # Instructor review
    instructor_action = Column(String(30), nullable=False)  # 'approve' | 'override'
    instructor_score = Column(Float, nullable=True)  # only set on override
    score_delta = Column(Float, default=0.0)  # instructor_score - ai_score
    instructor_notes = Column(Text, nullable=True)

    # Snapshots of what was used (for debugging / retraining)
    rubric_snapshot = Column(JSON, nullable=True)
    requirements_snapshot = Column(JSON, nullable=True)
    analysis_summary = Column(JSON, nullable=True)

    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    grading_result = relationship('ExcelGradingResult', backref=db.backref('experiences', lazy='dynamic'))
    course = relationship('Course', foreign_keys=[course_id])

    def __repr__(self):
        return f'<GradingExperience {self.id} delta={self.score_delta:+.1f}>'

    def to_dict(self):
        return {
            'id': self.id,
            'grading_result_id': self.grading_result_id,
            'assignment_id': self.assignment_id,
            'course_id': self.course_id,
            'module_id': self.module_id,
            'ai_score': self.ai_score,
            'ai_max_score': self.ai_max_score,
            'instructor_action': self.instructor_action,
            'instructor_score': self.instructor_score,
            'score_delta': self.score_delta,
            'instructor_notes': self.instructor_notes,
            'recorded_at': self.recorded_at.isoformat() if self.recorded_at else None,
        }


class GeneratedRubric(db.Model):
    """
    Caches AI-generated rubrics so they can be reused and improved.

    When an instructor approves a grade that used a generated rubric,
    the rubric is marked as ``approved`` and trusted for future use.
    """
    __tablename__ = 'generated_rubrics'

    id = Column(Integer, primary_key=True)

    assignment_id = Column(Integer, nullable=False, index=True)
    course_id = Column(Integer, ForeignKey('courses.id'), nullable=False)
    module_id = Column(Integer, nullable=True)

    # The generated rubric data (criteria, weights, scope, etc.)
    rubric_data = Column(JSON, nullable=False)

    # Hash of the assignment instructions — if instructions change, regenerate
    instructions_hash = Column(String(64), nullable=True, index=True)
    generation_method = Column(String(50), default='instruction_analysis')

    # Usage tracking
    times_used = Column(Integer, default=0)
    last_used_at = Column(DateTime, nullable=True)

    # Approval (implicit: instructor approved a grade using this rubric)
    approved = Column(Boolean, default=False)
    approved_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)

    course = relationship('Course', foreign_keys=[course_id])

    def __repr__(self):
        return f'<GeneratedRubric {self.id} assignment={self.assignment_id} approved={self.approved}>'

    def to_dict(self):
        return {
            'id': self.id,
            'assignment_id': self.assignment_id,
            'course_id': self.course_id,
            'module_id': self.module_id,
            'rubric_data': self.rubric_data,
            'instructions_hash': self.instructions_hash,
            'generation_method': self.generation_method,
            'times_used': self.times_used,
            'approved': self.approved,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
