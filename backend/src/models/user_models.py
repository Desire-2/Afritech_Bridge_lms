# User Models for Afritec Bridge LMS

from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import secrets

# It's assumed that 'db' is initialized in main.py and passed around or imported.
# For now, we'll define a placeholder db instance. If your main app structure differs,
# this import will need to be adjusted.
# from src import db # Assuming db is initialized in src/__init__.py or main.py

# Placeholder for db until actual app structure is fully integrated
# In a real Flask app, db = SQLAlchemy() would be initialized in the main app file.
# For the purpose of this file, we'll assume 'db' will be available in the context it's used.
# We will define the models assuming 'db' is an SQLAlchemy instance.

db = SQLAlchemy() # This line is a placeholder for model definition purposes.
                 # It should be replaced with the actual db instance from the Flask app.

class Role(db.Model):
    __tablename__ = 'roles'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), unique=True, nullable=False)
    users = db.relationship('User', backref='role', lazy='dynamic')

    def __repr__(self):
        return f'<Role {self.name}>'

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    first_name = db.Column(db.String(50), nullable=True)
    last_name = db.Column(db.String(50), nullable=True)
    profile_picture_url = db.Column(db.String(255), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    phone_number = db.Column(db.String(20), nullable=True)
    role_id = db.Column(db.Integer, db.ForeignKey('roles.id'), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Enhanced profile fields
    portfolio_url = db.Column(db.String(255), nullable=True)
    github_username = db.Column(db.String(100), nullable=True)
    linkedin_url = db.Column(db.String(255), nullable=True)
    twitter_username = db.Column(db.String(100), nullable=True)
    website_url = db.Column(db.String(255), nullable=True)
    location = db.Column(db.String(100), nullable=True)
    timezone = db.Column(db.String(50), nullable=True, default='UTC')
    
    # Career & Skills
    job_title = db.Column(db.String(100), nullable=True)
    company = db.Column(db.String(100), nullable=True)
    industry = db.Column(db.String(100), nullable=True)
    experience_level = db.Column(db.String(20), nullable=True)  # beginner, intermediate, advanced, expert
    skills = db.Column(db.JSON, nullable=True)  # Array of skills
    interests = db.Column(db.JSON, nullable=True)  # Array of interests
    
    # Learning preferences
    learning_goals = db.Column(db.Text, nullable=True)
    preferred_learning_style = db.Column(db.String(20), nullable=True)  # visual, auditory, kinesthetic, reading
    daily_learning_time = db.Column(db.Integer, nullable=True)  # minutes per day
    
    # Notification preferences
    email_notifications = db.Column(db.Boolean, default=True, nullable=False)
    push_notifications = db.Column(db.Boolean, default=True, nullable=False)
    marketing_emails = db.Column(db.Boolean, default=False, nullable=False)
    weekly_digest = db.Column(db.Boolean, default=True, nullable=False)
    
    # Privacy settings
    profile_visibility = db.Column(db.String(20), default='public', nullable=False)  # public, private, friends_only
    show_email = db.Column(db.Boolean, default=False, nullable=False)
    show_progress = db.Column(db.Boolean, default=True, nullable=False)
    
    # Gamification settings
    enable_gamification = db.Column(db.Boolean, default=True, nullable=False)
    show_leaderboard = db.Column(db.Boolean, default=True, nullable=False)
    
    # Password reset fields
    reset_token = db.Column(db.String(100), nullable=True)
    reset_token_expires_at = db.Column(db.DateTime, nullable=True)
    
    # Force password change on first login (for auto-created accounts)
    must_change_password = db.Column(db.Boolean, default=False, nullable=False)
    
    # Activity tracking
    last_login = db.Column(db.DateTime, nullable=True)
    last_activity = db.Column(db.DateTime, nullable=True)
    
    # Deletion tracking (soft delete)
    deleted_at = db.Column(db.DateTime, nullable=True)
    deleted_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    deletion_reason = db.Column(db.String(255), nullable=True)

    # Relationships (placeholders, to be expanded with other models)
    # enrollments = db.relationship('Enrollment', backref='student', lazy='dynamic')
    # submissions = db.relationship('Submission', backref='student', lazy='dynamic')
    # courses_authored = db.relationship('Course', backref='author', lazy='dynamic', foreign_keys='Course.instructor_id')
    deleter = db.relationship('User', remote_side=[id], backref='deleted_users')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
        
    def generate_reset_token(self):
        """Generate a secure token for password reset"""
        self.reset_token = secrets.token_urlsafe(32)
        # Token expires in 3 days
        self.reset_token_expires_at = datetime.utcnow() + timedelta(days=3)
        return self.reset_token
        
    def verify_reset_token(self, token):
        """Verify if the reset token is valid and not expired"""
        if self.reset_token != token:
            return False
        if not self.reset_token_expires_at or datetime.utcnow() > self.reset_token_expires_at:
            return False
        return True
        
    def clear_reset_token(self):
        """Clear the reset token after it's been used"""
        self.reset_token = None
        self.reset_token_expires_at = None
    
    def update_last_login(self):
        """Update last login timestamp"""
        self.last_login = datetime.utcnow()
        self.last_activity = datetime.utcnow()
    
    def update_last_activity(self):
        """Update last activity timestamp"""
        self.last_activity = datetime.utcnow()
        
    def get_days_since_last_activity(self):
        """Get number of days since last activity"""
        if not self.last_activity:
            return None
        return (datetime.utcnow() - self.last_activity).days
    
    def is_inactive(self, days_threshold=7):
        """Check if user is inactive based on threshold"""
        days_inactive = self.get_days_since_last_activity()
        return days_inactive is not None and days_inactive >= days_threshold

    @property
    def full_name(self):
        """Get user's full name by combining first and last name"""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        elif self.first_name:
            return self.first_name
        elif self.last_name:
            return self.last_name
        else:
            return self.username
    
    def get_display_name(self):
        """Get user's display name (same as full_name, but as method for consistency)"""
        return self.full_name

    def __repr__(self):
        return f'<User {self.username}>'

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'profile_picture_url': self.profile_picture_url,
            'bio': self.bio,
            'phone_number': self.phone_number,
            'role': self.role.name if self.role else None,
            'is_active': self.is_active,
            'must_change_password': self.must_change_password,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            # Enhanced profile fields
            'portfolio_url': self.portfolio_url,
            'github_username': self.github_username,
            'linkedin_url': self.linkedin_url,
            'twitter_username': self.twitter_username,
            'website_url': self.website_url,
            'location': self.location,
            'timezone': self.timezone,
            # Career & Skills
            'job_title': self.job_title,
            'company': self.company,
            'industry': self.industry,
            'experience_level': self.experience_level,
            'skills': self.skills or [],
            'interests': self.interests or [],
            # Learning preferences
            'learning_goals': self.learning_goals,
            'preferred_learning_style': self.preferred_learning_style,
            'daily_learning_time': self.daily_learning_time,
            # Notification preferences
            'email_notifications': self.email_notifications,
            'push_notifications': self.push_notifications,
            'marketing_emails': self.marketing_emails,
            'weekly_digest': self.weekly_digest,
            # Privacy settings
            'profile_visibility': self.profile_visibility,
            'show_email': self.show_email,
            'show_progress': self.show_progress,
            # Gamification settings
            'enable_gamification': self.enable_gamification,
            'show_leaderboard': self.show_leaderboard,
            # Activity tracking
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'last_activity': self.last_activity.isoformat() if self.last_activity else None,
            # Deletion tracking
            'deleted_at': self.deleted_at.isoformat() if self.deleted_at else None,
            'deleted_by': self.deleted_by,
            'deletion_reason': self.deletion_reason
        }

