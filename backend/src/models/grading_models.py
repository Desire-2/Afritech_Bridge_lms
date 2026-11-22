from ..utils.time_utils import now_local
"""
Grading Enhancement Models - Rubrics, Feedback Templates, Grading History
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, JSON, Table
from sqlalchemy.orm import relationship
from ..models.user_models import db

# ``Rubric.profile_id`` logically references ``grading_profiles``. The column
# is intentionally a plain integer in both the migration and the additive
# self-heal path so retrofitting a constraint onto legacy rows cannot fail on
# orphan ids. Importing the AAGE module registers the profile table even when
# only this module was imported.
from . import aage_models as _aage_models  # noqa: F401


class Rubric(db.Model):
    """Rubric template for assignments/projects

    Also serves as the AAGE ``GradingRubric`` entity: the grading engine adds
    lifecycle/approval metadata (``status``, ``version``, discipline, approval
    audit) on top of the original columns so ``Assignment.rubric_id`` and
    ``Project.rubric_id`` keep pointing at the same table.
    """
    __tablename__ = 'rubrics'
    
    id = Column(Integer, primary_key=True)
    # Legacy compatibility: pre-AAGE databases created this table with a NOT
    # NULL ``name`` column (and an ``is_active`` flag).  The AAGE model uses
    # ``title`` instead, but the ORM must still populate these legacy columns
    # on INSERT or those databases reject the row with
    # ``NOT NULL constraint failed: rubrics.name``.  They are intentionally not
    # part of to_dict()/the public contract.
    name = Column(String(200), nullable=False, default="")
    is_active = Column(Boolean, nullable=False, default=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    instructor_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    course_id = Column(Integer, ForeignKey('courses.id'))  # Optional: course-specific
    is_template = Column(Boolean, default=False)  # Global template vs personal
    total_points = Column(Float, nullable=False)
    created_at = Column(DateTime, default=now_local)
    updated_at = Column(DateTime, default=now_local, onupdate=now_local)

    # ── AAGE extensions (all nullable / additive) ────────────────────────
    status = Column(String(30), default='approved')   # draft|pending_approval|approved|archived
    version = Column(Integer, default=1)
    discipline = Column(String(60))                   # frontend|backend|data_science|...
    assessment_kind = Column(String(20))              # assignment|project
    assessment_id = Column(Integer)                   # owning assessment id (polymorphic)
    source = Column(String(20))                       # ai|instructor|profile
    generated_by_ai = Column(Boolean, default=False)
    summary = Column(Text)
    learning_objectives = Column(JSON)
    deliverables = Column(JSON)
    technologies = Column(JSON)
    evaluation_methods = Column(JSON)
    evaluator_recommendations = Column(JSON)          # ["frontend", "backend", ...]
    unverifiable_requirements = Column(JSON)          # [{requirement, reason}]
    parent_rubric_id = Column(Integer)                # lineage when forked
    profile_id = Column(Integer)                      # logical grading_profiles.id
    approved_by = Column(Integer)                     # logical users.id
    approved_at = Column(DateTime)
    criteria_weights_total = Column(Float)            # must be 100.0 when approved

    # Relationships
    criteria = relationship('RubricCriterion', backref='rubric', cascade='all, delete-orphan', lazy='dynamic')
    instructor = relationship('User', foreign_keys=[instructor_id])
    approver = relationship(
        'User',
        foreign_keys=[approved_by],
        primaryjoin='Rubric.approved_by == User.id',
    )

    def is_approved(self) -> bool:
        # Legacy rows pre-date the status column: treat them as approved so
        # existing graded assessments keep working.
        return (self.status or 'approved') == 'approved'

    def weights_total(self) -> float:
        return round(sum(float(c.weight or 0) for c in self.criteria.all()), 2)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'instructor_id': self.instructor_id,
            'course_id': self.course_id,
            'is_template': self.is_template,
            'total_points': self.total_points,
            'criteria': [c.to_dict() for c in self.criteria.all()],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            # AAGE fields
            'status': self.status or 'approved',
            'version': self.version or 1,
            'discipline': self.discipline,
            'assessment_kind': self.assessment_kind,
            'assessment_id': self.assessment_id,
            'source': self.source,
            'generated_by_ai': bool(self.generated_by_ai),
            'summary': self.summary,
            'learning_objectives': self.learning_objectives or [],
            'deliverables': self.deliverables or [],
            'technologies': self.technologies or [],
            'evaluation_methods': self.evaluation_methods or [],
            'evaluator_recommendations': self.evaluator_recommendations or [],
            'unverifiable_requirements': self.unverifiable_requirements or [],
            'profile_id': self.profile_id,
            'approved_by': self.approved_by,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'criteria_weights_total': self.criteria_weights_total,
        }


class RubricCriterion(db.Model):
    """Individual criterion within a rubric

    AAGE extends it with weighting (must total 100 across the rubric),
    required/optional marking, evidence requirements and per-evaluator
    instructions.
    """
    __tablename__ = 'rubric_criteria'
    
    id = Column(Integer, primary_key=True)
    rubric_id = Column(Integer, ForeignKey('rubrics.id'), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    max_points = Column(Float, nullable=False)
    order_index = Column(Integer, default=0)  # For ordering criteria
    
    # Performance levels (JSON array of {level, points, description})
    performance_levels = Column(JSON)

    # ── AAGE extensions ─────────────────────────────────────────────────
    weight = Column(Float, default=0)                 # percentage of the final score
    is_required = Column(Boolean, default=True)
    criterion_key = Column(String(80))                # stable id across rubric versions
    evidence_requirements = Column(JSON)              # ["source file", "screenshot", ...]
    evidence_category = Column(String(30))            # expected default category
    evaluator_hint = Column(String(120))              # which specialist evaluator to prefer
    evaluator_instructions = Column(Text)             # evaluator-specific guidance

    created_at = Column(DateTime, default=now_local)
    
    def to_dict(self):
        return {
            'id': self.id,
            'rubric_id': self.rubric_id,
            'name': self.name,
            'description': self.description,
            'max_points': self.max_points,
            'order_index': self.order_index,
            'performance_levels': self.performance_levels or [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'weight': self.weight or 0,
            'is_required': True if self.is_required is None else bool(self.is_required),
            'criterion_key': self.criterion_key,
            'evidence_requirements': self.evidence_requirements or [],
            'evidence_category': self.evidence_category,
            'evaluator_hint': self.evaluator_hint,
            'evaluator_instructions': self.evaluator_instructions,
        }


class FeedbackTemplate(db.Model):
    """Reusable feedback templates/comment bank"""
    __tablename__ = 'feedback_templates'
    
    id = Column(Integer, primary_key=True)
    instructor_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    category = Column(String(100), nullable=False)  # grammar, content, format, etc.
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    is_public = Column(Boolean, default=False)  # Shared with all instructors
    usage_count = Column(Integer, default=0)
    tags = Column(JSON)  # Array of tags for filtering
    created_at = Column(DateTime, default=now_local)
    updated_at = Column(DateTime, default=now_local, onupdate=now_local)
    
    # Relationships
    instructor = relationship('User', foreign_keys=[instructor_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'instructor_id': self.instructor_id,
            'category': self.category,
            'title': self.title,
            'content': self.content,
            'is_public': self.is_public,
            'usage_count': self.usage_count,
            'tags': self.tags or [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class GradingHistory(db.Model):
    """Audit trail for grading changes"""
    __tablename__ = 'grading_history'
    
    id = Column(Integer, primary_key=True)
    submission_id = Column(Integer, nullable=False)  # Can be assignment or project
    submission_type = Column(String(50), nullable=False)  # 'assignment' or 'project'
    instructor_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    action = Column(String(50), nullable=False)  # 'created', 'updated', 'deleted'
    
    previous_grade = Column(Float)
    new_grade = Column(Float)
    previous_feedback = Column(Text)
    new_feedback = Column(Text)
    
    change_reason = Column(Text)  # Optional: why the change was made
    rubric_data = Column(JSON)  # Rubric scores if applicable
    
    created_at = Column(DateTime, default=now_local)
    
    # Relationships
    instructor = relationship('User', foreign_keys=[instructor_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'submission_id': self.submission_id,
            'submission_type': self.submission_type,
            'instructor_id': self.instructor_id,
            'action': self.action,
            'previous_grade': self.previous_grade,
            'new_grade': self.new_grade,
            'previous_feedback': self.previous_feedback,
            'new_feedback': self.new_feedback,
            'change_reason': self.change_reason,
            'rubric_data': self.rubric_data,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'instructor_name': f"{self.instructor.first_name} {self.instructor.last_name}" if self.instructor else None
        }


class GradingSession(db.Model):
    """Track grading sessions for analytics"""
    __tablename__ = 'grading_sessions'
    
    id = Column(Integer, primary_key=True)
    instructor_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    started_at = Column(DateTime, default=now_local)
    ended_at = Column(DateTime)
    
    submissions_graded = Column(Integer, default=0)
    total_time_seconds = Column(Integer, default=0)
    average_time_per_submission = Column(Float)  # In seconds
    
    # Session metadata
    session_notes = Column(Text)
    graded_items = Column(JSON)  # Array of {submission_id, type, time_spent}
    
    # Relationships
    instructor = relationship('User', foreign_keys=[instructor_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'instructor_id': self.instructor_id,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'ended_at': self.ended_at.isoformat() if self.ended_at else None,
            'submissions_graded': self.submissions_graded,
            'total_time_seconds': self.total_time_seconds,
            'average_time_per_submission': self.average_time_per_submission,
            'graded_items': self.graded_items or [],
            'instructor_name': f"{self.instructor.first_name} {self.instructor.last_name}" if self.instructor else None
        }


# Helper function to create default templates
def create_default_feedback_templates(instructor_id):
    """Create default feedback templates for new instructors"""
    default_templates = [
        {
            'category': 'positive',
            'title': 'Excellent Work',
            'content': 'Excellent work! Your submission demonstrates a thorough understanding of the concepts and exceeds expectations.',
            'tags': ['praise', 'excellence']
        },
        {
            'category': 'positive',
            'title': 'Good Effort',
            'content': 'Good effort! Your work shows understanding of the key concepts. Consider the feedback below for further improvement.',
            'tags': ['encouragement', 'good']
        },
        {
            'category': 'improvement',
            'title': 'Needs More Detail',
            'content': 'Your response would benefit from more detailed explanations and examples to support your points.',
            'tags': ['detail', 'expansion']
        },
        {
            'category': 'improvement',
            'title': 'Check Citations',
            'content': 'Please ensure all sources are properly cited according to the required citation style.',
            'tags': ['citations', 'formatting']
        },
        {
            'category': 'technical',
            'title': 'Code Quality',
            'content': 'Consider improving code readability with better variable names and comments.',
            'tags': ['code', 'quality']
        },
        {
            'category': 'technical',
            'title': 'Test Coverage',
            'content': 'Good implementation, but please add unit tests to verify edge cases.',
            'tags': ['testing', 'quality']
        },
        {
            'category': 'grammar',
            'title': 'Proofreading Needed',
            'content': 'Please proofread for grammar, spelling, and punctuation errors.',
            'tags': ['grammar', 'writing']
        },
        {
            'category': 'format',
            'title': 'Follow Guidelines',
            'content': 'Please review the assignment formatting guidelines and adjust your submission accordingly.',
            'tags': ['format', 'guidelines']
        },
        {
            'category': 'late',
            'title': 'Late Submission',
            'content': 'Your submission was received after the due date. Please be mindful of deadlines for future assignments.',
            'tags': ['late', 'deadline']
        },
        {
            'category': 'resubmission',
            'title': 'Improvement Noted',
            'content': 'I can see significant improvement in your resubmission. Well done on addressing the feedback!',
            'tags': ['resubmission', 'improvement']
        }
    ]
    
    templates = []
    for template_data in default_templates:
        template = FeedbackTemplate(
            instructor_id=instructor_id,
            category=template_data['category'],
            title=template_data['title'],
            content=template_data['content'],
            tags=template_data['tags'],
            is_public=False
        )
        templates.append(template)
    
    return templates
