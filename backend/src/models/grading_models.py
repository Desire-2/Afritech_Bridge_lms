"""
Grading Enhancement Models - Rubrics, Feedback Templates, Grading History
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, JSON, Table
from sqlalchemy.orm import relationship
from ..models.user_models import db


class Rubric(db.Model):
    """Rubric template for assignments/projects"""
    __tablename__ = 'rubrics'
    
    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    instructor_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    course_id = Column(Integer, ForeignKey('courses.id'))  # Optional: course-specific
    is_template = Column(Boolean, default=False)  # Global template vs personal
    total_points = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    criteria = relationship('RubricCriterion', backref='rubric', cascade='all, delete-orphan', lazy='dynamic')
    instructor = relationship('User', foreign_keys=[instructor_id])
    
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
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class RubricCriterion(db.Model):
    """Individual criterion within a rubric"""
    __tablename__ = 'rubric_criteria'
    
    id = Column(Integer, primary_key=True)
    rubric_id = Column(Integer, ForeignKey('rubrics.id'), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    max_points = Column(Float, nullable=False)
    order_index = Column(Integer, default=0)  # For ordering criteria
    
    # Performance levels (JSON array of {level, points, description})
    performance_levels = Column(JSON)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'rubric_id': self.rubric_id,
            'name': self.name,
            'description': self.description,
            'max_points': self.max_points,
            'order_index': self.order_index,
            'performance_levels': self.performance_levels or [],
            'created_at': self.created_at.isoformat() if self.created_at else None
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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
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
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
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
    started_at = Column(DateTime, default=datetime.utcnow)
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
