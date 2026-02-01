"""
Enhanced file comment system for instructor feedback on submitted files
"""

from datetime import datetime
from ..models.user_models import db


class FileComment(db.Model):
    """Comments left by instructors on submitted files"""
    __tablename__ = 'file_comments'
    
    id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.String(255), nullable=False)  # Can be submission file ID or path
    submission_id = db.Column(db.Integer, db.ForeignKey('assignment_submissions.id'), nullable=True)
    project_submission_id = db.Column(db.Integer, db.ForeignKey('project_submissions.id'), nullable=True)
    instructor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    comment_text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_private = db.Column(db.Boolean, default=False)  # If True, only instructor can see
    
    # Relationships
    instructor = db.relationship('User', foreign_keys=[instructor_id], backref='file_comments')
    assignment_submission = db.relationship('AssignmentSubmission', backref='file_comments')
    project_submission = db.relationship('ProjectSubmission', backref='file_comments')
    
    def to_dict(self):
        return {
            'id': self.id,
            'file_id': self.file_id,
            'submission_id': self.submission_id,
            'project_submission_id': self.project_submission_id,
            'instructor_id': self.instructor_id,
            'instructor_name': f"{self.instructor.first_name} {self.instructor.last_name}" if self.instructor else None,
            'comment_text': self.comment_text,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'is_private': self.is_private
        }


class FileAnalysis(db.Model):
    """Automated analysis of submitted files"""
    __tablename__ = 'file_analyses'
    
    id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.String(255), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.Integer, nullable=True)
    mime_type = db.Column(db.String(100), nullable=True)
    file_category = db.Column(db.String(50), nullable=True)  # document, image, code, etc.
    is_viewable = db.Column(db.Boolean, default=False)
    
    # Content analysis
    word_count = db.Column(db.Integer, nullable=True)
    page_count = db.Column(db.Integer, nullable=True)
    has_images = db.Column(db.Boolean, default=False)
    has_tables = db.Column(db.Boolean, default=False)
    
    # Quality checks
    is_password_protected = db.Column(db.Boolean, default=False)
    is_corrupted = db.Column(db.Boolean, default=False)
    virus_scan_clean = db.Column(db.Boolean, default=True)
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    analyzed_at = db.Column(db.DateTime, nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'file_id': self.file_id,
            'filename': self.filename,
            'file_size': self.file_size,
            'mime_type': self.mime_type,
            'file_category': self.file_category,
            'is_viewable': self.is_viewable,
            'word_count': self.word_count,
            'page_count': self.page_count,
            'has_images': self.has_images,
            'has_tables': self.has_tables,
            'is_password_protected': self.is_password_protected,
            'is_corrupted': self.is_corrupted,
            'virus_scan_clean': self.virus_scan_clean,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'analyzed_at': self.analyzed_at.isoformat() if self.analyzed_at else None
        }