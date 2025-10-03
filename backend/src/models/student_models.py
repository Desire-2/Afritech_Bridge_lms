# Enhanced Student Progress and Learning Models for Afritec Bridge LMS

from datetime import datetime
from .user_models import db, User
from .course_models import Course, Module, Lesson, Quiz

class LessonCompletion(db.Model):
    """Track completion status of individual lessons by students"""
    __tablename__ = 'lesson_completions'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=False)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)
    time_spent = db.Column(db.Integer, default=0)  # in seconds
    
    student = db.relationship('User', backref=db.backref('lesson_completions', lazy='dynamic'))
    lesson = db.relationship('Lesson', backref=db.backref('completions', lazy='dynamic'))
    
    __table_args__ = (db.UniqueConstraint('student_id', 'lesson_id', name='_student_lesson_completion_uc'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'lesson_id': self.lesson_id,
            'completed_at': self.completed_at.isoformat(),
            'time_spent': self.time_spent
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

class Assignment(db.Model):
    """Assignments for courses/lessons"""
    __tablename__ = 'assignments'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=True)
    instructor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    due_date = db.Column(db.DateTime, nullable=True)
    max_points = db.Column(db.Float, default=100.0)
    submission_type = db.Column(db.String(50), default='text')  # text, file, url
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    course = db.relationship('Course', backref=db.backref('assignments', lazy='dynamic'))
    lesson = db.relationship('Lesson', backref=db.backref('assignments', lazy='dynamic'))
    instructor = db.relationship('User', backref=db.backref('created_assignments', lazy='dynamic'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'course_id': self.course_id,
            'lesson_id': self.lesson_id,
            'instructor_id': self.instructor_id,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'max_points': self.max_points,
            'submission_type': self.submission_type,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'course_title': self.course.title if self.course else None,
            'lesson_title': self.lesson.title if self.lesson else None
        }

class AssignmentSubmission(db.Model):
    """Student submissions for assignments"""
    __tablename__ = 'assignment_submissions'
    id = db.Column(db.Integer, primary_key=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey('assignments.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    content = db.Column(db.Text, nullable=True)  # Text submission
    file_url = db.Column(db.String(255), nullable=True)  # File submission
    external_url = db.Column(db.String(255), nullable=True)  # URL submission
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    grade = db.Column(db.Float, nullable=True)
    feedback = db.Column(db.Text, nullable=True)
    graded_at = db.Column(db.DateTime, nullable=True)
    graded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    assignment = db.relationship('Assignment', backref=db.backref('submissions', lazy='dynamic'))
    student = db.relationship('User', foreign_keys=[student_id], backref=db.backref('assignment_submissions', lazy='dynamic'))
    grader = db.relationship('User', foreign_keys=[graded_by])
    
    __table_args__ = (db.UniqueConstraint('assignment_id', 'student_id', name='_assignment_student_submission_uc'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'assignment_id': self.assignment_id,
            'student_id': self.student_id,
            'content': self.content,
            'file_url': self.file_url,
            'external_url': self.external_url,
            'submitted_at': self.submitted_at.isoformat(),
            'grade': self.grade,
            'feedback': self.feedback,
            'graded_at': self.graded_at.isoformat() if self.graded_at else None,
            'graded_by': self.graded_by,
            'assignment_title': self.assignment.title if self.assignment else None,
            'student_name': f"{self.student.first_name} {self.student.last_name}" if self.student else None
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