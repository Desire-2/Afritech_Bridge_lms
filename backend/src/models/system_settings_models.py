# System Settings Models for Afritec Bridge LMS

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json
from sqlalchemy import text

# Assuming db is initialized elsewhere
from .user_models import db

class SystemSetting(db.Model):
    """
    Comprehensive system settings model with key-value storage
    Supports different data types and categories
    """
    __tablename__ = 'system_settings'
    
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text, nullable=False)  # JSON serialized value
    data_type = db.Column(db.String(20), nullable=False, default='string')  # string, integer, float, boolean, json
    category = db.Column(db.String(50), nullable=False)  # general, email, course, user, security, notification, ai
    description = db.Column(db.Text, nullable=True)
    is_public = db.Column(db.Boolean, default=False)  # Can be shown to non-admins
    is_editable = db.Column(db.Boolean, default=True)  # Can be modified via UI
    requires_restart = db.Column(db.Boolean, default=False)  # Requires system restart
    validation_rule = db.Column(db.String(255), nullable=True)  # JSON validation rules
    default_value = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    def __repr__(self):
        return f'<SystemSetting {self.key}: {self.value}>'
    
    @property
    def typed_value(self):
        """Return value in appropriate Python type"""
        if self.data_type == 'boolean':
            return self.value.lower() in ('true', '1', 'yes', 'on')
        elif self.data_type == 'integer':
            try:
                return int(self.value)
            except (ValueError, TypeError):
                return 0
        elif self.data_type == 'float':
            try:
                return float(self.value)
            except (ValueError, TypeError):
                return 0.0
        elif self.data_type == 'json':
            try:
                return json.loads(self.value)
            except (json.JSONDecodeError, TypeError):
                return {}
        else:
            return str(self.value)
    
    def set_value(self, value):
        """Set value with appropriate type conversion"""
        if self.data_type == 'json':
            self.value = json.dumps(value)
        else:
            self.value = str(value)
        self.updated_at = datetime.utcnow()
    
    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            'id': self.id,
            'key': self.key,
            'value': self.typed_value,
            'data_type': self.data_type,
            'category': self.category,
            'description': self.description,
            'is_public': self.is_public,
            'is_editable': self.is_editable,
            'requires_restart': self.requires_restart,
            'default_value': self.default_value,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class SettingAuditLog(db.Model):
    """
    Audit log for system settings changes
    Tracks who changed what when
    """
    __tablename__ = 'setting_audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    setting_key = db.Column(db.String(100), nullable=False)
    old_value = db.Column(db.Text, nullable=True)
    new_value = db.Column(db.Text, nullable=False)
    changed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    changed_at = db.Column(db.DateTime, default=datetime.utcnow)
    change_reason = db.Column(db.String(255), nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.Text, nullable=True)
    
    # Relationship to user
    changed_by_user = db.relationship('User', backref='setting_changes')
    
    def __repr__(self):
        return f'<SettingAuditLog {self.setting_key} by user {self.changed_by}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'setting_key': self.setting_key,
            'old_value': self.old_value,
            'new_value': self.new_value,
            'changed_by': self.changed_by,
            'changed_at': self.changed_at.isoformat() if self.changed_at else None,
            'change_reason': self.change_reason,
            'ip_address': self.ip_address
        }

class SystemSettingsManager:
    """
    Manager class for system settings with caching and validation
    """
    _cache = {}
    _cache_time = None
    CACHE_TIMEOUT = 300  # 5 minutes
    
    @classmethod
    def get_setting(cls, key, default=None):
        """Get a single setting value with caching"""
        cls._refresh_cache_if_needed()
        
        if key in cls._cache:
            return cls._cache[key]
        
        # If not in cache, query database
        setting = SystemSetting.query.filter_by(key=key).first()
        if setting:
            value = setting.typed_value
            cls._cache[key] = value
            return value
        
        return default
    
    @classmethod
    def set_setting(cls, key, value, user_id=None, change_reason=None):
        """Set a setting value and log the change"""
        setting = SystemSetting.query.filter_by(key=key).first()
        
        if setting:
            # Log the change
            old_value = setting.value
            audit_log = SettingAuditLog(
                setting_key=key,
                old_value=old_value,
                new_value=str(value),
                changed_by=user_id,
                change_reason=change_reason
            )
            db.session.add(audit_log)
            
            # Update the setting
            setting.set_value(value)
            if user_id:
                setting.updated_by = user_id
        else:
            # Create new setting (this should normally be done via migration)
            setting = SystemSetting(
                key=key,
                value=str(value),
                data_type='string',
                category='general',
                updated_by=user_id
            )
            db.session.add(setting)
            
            # Log the creation
            audit_log = SettingAuditLog(
                setting_key=key,
                old_value=None,
                new_value=str(value),
                changed_by=user_id,
                change_reason=change_reason or 'Setting created'
            )
            db.session.add(audit_log)
        
        db.session.commit()
        
        # Update cache
        cls._cache[key] = setting.typed_value if setting else value
    
    @classmethod
    def get_settings_by_category(cls, category):
        """Get all settings for a category"""
        settings = SystemSetting.query.filter_by(category=category).all()
        return {setting.key: setting.typed_value for setting in settings}
    
    @classmethod
    def get_all_settings(cls):
        """Get all settings organized by category"""
        settings = SystemSetting.query.all()
        result = {}
        
        for setting in settings:
            category = setting.category
            if category not in result:
                result[category] = {}
            result[category][setting.key] = setting.typed_value
        
        return result
    
    @classmethod
    def _refresh_cache_if_needed(cls):
        """Refresh cache if it's stale"""
        current_time = datetime.utcnow()
        
        if (cls._cache_time is None or 
            (current_time - cls._cache_time).seconds > cls.CACHE_TIMEOUT):
            cls._refresh_cache()
    
    @classmethod
    def _refresh_cache(cls):
        """Refresh the entire cache from database"""
        cls._cache = {}
        settings = SystemSetting.query.all()
        
        for setting in settings:
            cls._cache[setting.key] = setting.typed_value
        
        cls._cache_time = datetime.utcnow()
    
    @classmethod
    def clear_cache(cls):
        """Clear the settings cache"""
        cls._cache = {}
        cls._cache_time = None

def initialize_default_settings():
    """Initialize default system settings"""
    default_settings = [
        # General Settings
        {
            'key': 'site_name',
            'value': 'Afritec Bridge LMS',
            'data_type': 'string',
            'category': 'general',
            'description': 'Name of the learning management system',
            'is_public': True,
            'is_editable': True,
            'default_value': 'Afritec Bridge LMS'
        },
        {
            'key': 'site_url',
            'value': 'https://study.afritechbridge.online',
            'data_type': 'string',
            'category': 'general',
            'description': 'Base URL of the LMS website',
            'is_public': True,
            'is_editable': True,
            'default_value': 'https://study.afritechbridge.online'
        },
        {
            'key': 'support_email',
            'value': 'afritech.bridge@yahoo.com',
            'data_type': 'string',
            'category': 'general',
            'description': 'Support email address for user inquiries',
            'is_public': True,
            'is_editable': True,
            'default_value': 'afritech.bridge@yahoo.com'
        },
        {
            'key': 'maintenance_mode',
            'value': 'false',
            'data_type': 'boolean',
            'category': 'general',
            'description': 'Enable maintenance mode to restrict access',
            'is_public': False,
            'is_editable': True,
            'default_value': 'false'
        },
        {
            'key': 'maintenance_message',
            'value': 'The system is currently undergoing maintenance. We apologize for any inconvenience. Please check back later.',
            'data_type': 'string',
            'category': 'general',
            'description': 'Message displayed to users during maintenance',
            'is_public': True,
            'is_editable': True,
            'default_value': 'The system is currently undergoing maintenance. We apologize for any inconvenience. Please check back later.'
        },
        {
            'key': 'maintenance_start_time',
            'value': '',
            'data_type': 'string',
            'category': 'general',
            'description': 'Maintenance start time (ISO 8601 format)',
            'is_public': True,
            'is_editable': True,
            'default_value': ''
        },
        {
            'key': 'maintenance_end_time',
            'value': '',
            'data_type': 'string',
            'category': 'general',
            'description': 'Estimated maintenance end time (ISO 8601 format)',
            'is_public': True,
            'is_editable': True,
            'default_value': ''
        },
        {
            'key': 'maintenance_show_countdown',
            'value': 'true',
            'data_type': 'boolean',
            'category': 'general',
            'description': 'Show countdown timer on maintenance page',
            'is_public': True,
            'is_editable': True,
            'default_value': 'true'
        },
        {
            'key': 'analytics_enabled',
            'value': 'true',
            'data_type': 'boolean',
            'category': 'general',
            'description': 'Enable analytics tracking',
            'is_public': False,
            'is_editable': True,
            'default_value': 'true'
        },
        
        # Course Settings
        {
            'key': 'max_students_per_course',
            'value': '50',
            'data_type': 'integer',
            'category': 'course',
            'description': 'Maximum number of students allowed per course',
            'is_public': False,
            'is_editable': True,
            'default_value': '50'
        },
        {
            'key': 'min_quiz_duration',
            'value': '5',
            'data_type': 'integer',
            'category': 'course',
            'description': 'Minimum quiz duration in minutes',
            'is_public': False,
            'is_editable': True,
            'default_value': '5'
        },
        {
            'key': 'max_quiz_duration',
            'value': '120',
            'data_type': 'integer',
            'category': 'course',
            'description': 'Maximum quiz duration in minutes',
            'is_public': False,
            'is_editable': True,
            'default_value': '120'
        },
        {
            'key': 'require_certificate',
            'value': 'true',
            'data_type': 'boolean',
            'category': 'course',
            'description': 'Require certificate for course completion',
            'is_public': False,
            'is_editable': True,
            'default_value': 'true'
        },
        {
            'key': 'enable_forum_moderation',
            'value': 'true',
            'data_type': 'boolean',
            'category': 'course',
            'description': 'Enable forum post moderation',
            'is_public': False,
            'is_editable': True,
            'default_value': 'true'
        },
        
        # User Settings
        {
            'key': 'enable_user_registration',
            'value': 'true',
            'data_type': 'boolean',
            'category': 'user',
            'description': 'Allow new user registration',
            'is_public': True,
            'is_editable': True,
            'default_value': 'true'
        },
        {
            'key': 'require_email_verification',
            'value': 'true',
            'data_type': 'boolean',
            'category': 'user',
            'description': 'Require email verification for new accounts',
            'is_public': False,
            'is_editable': True,
            'default_value': 'true'
        },
        {
            'key': 'max_login_attempts',
            'value': '5',
            'data_type': 'integer',
            'category': 'user',
            'description': 'Maximum failed login attempts before lockout',
            'is_public': False,
            'is_editable': True,
            'default_value': '5'
        },
        {
            'key': 'session_timeout',
            'value': '30',
            'data_type': 'integer',
            'category': 'user',
            'description': 'User session timeout in minutes',
            'is_public': False,
            'is_editable': True,
            'default_value': '30'
        },
        {
            'key': 'enable_oauth',
            'value': 'false',
            'data_type': 'boolean',
            'category': 'user',
            'description': 'Enable OAuth/social login',
            'is_public': False,
            'is_editable': True,
            'default_value': 'false'
        },
        
        # Email Settings
        {
            'key': 'smtp_host',
            'value': 'smtp.mail.yahoo.com',
            'data_type': 'string',
            'category': 'email',
            'description': 'SMTP server hostname',
            'is_public': False,
            'is_editable': True,
            'default_value': 'smtp.mail.yahoo.com'
        },
        {
            'key': 'smtp_port',
            'value': '587',
            'data_type': 'integer',
            'category': 'email',
            'description': 'SMTP server port',
            'is_public': False,
            'is_editable': True,
            'default_value': '587'
        },
        {
            'key': 'from_email',
            'value': 'afritech.bridge@yahoo.com',
            'data_type': 'string',
            'category': 'email',
            'description': 'Default from email address',
            'is_public': False,
            'is_editable': True,
            'default_value': 'afritech.bridge@yahoo.com'
        },
        {
            'key': 'from_name',
            'value': 'Afritec Bridge LMS',
            'data_type': 'string',
            'category': 'email',
            'description': 'Default from name for emails',
            'is_public': False,
            'is_editable': True,
            'default_value': 'Afritec Bridge LMS'
        },
        {
            'key': 'enable_tls',
            'value': 'true',
            'data_type': 'boolean',
            'category': 'email',
            'description': 'Enable TLS for email sending',
            'is_public': False,
            'is_editable': True,
            'default_value': 'true'
        },
        
        # Security Settings
        {
            'key': 'password_min_length',
            'value': '8',
            'data_type': 'integer',
            'category': 'security',
            'description': 'Minimum password length',
            'is_public': False,
            'is_editable': True,
            'default_value': '8'
        },
        {
            'key': 'password_require_uppercase',
            'value': 'true',
            'data_type': 'boolean',
            'category': 'security',
            'description': 'Require uppercase letter in passwords',
            'is_public': False,
            'is_editable': True,
            'default_value': 'true'
        },
        {
            'key': 'password_require_numbers',
            'value': 'true',
            'data_type': 'boolean',
            'category': 'security',
            'description': 'Require numbers in passwords',
            'is_public': False,
            'is_editable': True,
            'default_value': 'true'
        },
        {
            'key': 'password_require_special',
            'value': 'true',
            'data_type': 'boolean',
            'category': 'security',
            'description': 'Require special characters in passwords',
            'is_public': False,
            'is_editable': True,
            'default_value': 'true'
        },
        {
            'key': 'enable_two_factor',
            'value': 'false',
            'data_type': 'boolean',
            'category': 'security',
            'description': 'Enable two-factor authentication',
            'is_public': False,
            'is_editable': True,
            'default_value': 'false'
        },
        
        # AI Agent Settings
        {
            'key': 'ai_agent_enabled',
            'value': 'true',
            'data_type': 'boolean',
            'category': 'ai',
            'description': 'Enable AI agent features',
            'is_public': False,
            'is_editable': True,
            'default_value': 'true'
        },
        {
            'key': 'ai_max_requests_per_day',
            'value': '100',
            'data_type': 'integer',
            'category': 'ai',
            'description': 'Maximum AI requests per user per day',
            'is_public': False,
            'is_editable': True,
            'default_value': '100'
        }
    ]
    
    created_count = 0
    for setting_data in default_settings:
        existing = SystemSetting.query.filter_by(key=setting_data['key']).first()
        if not existing:
            setting = SystemSetting(**setting_data)
            db.session.add(setting)
            created_count += 1
    
    if created_count > 0:
        try:
            db.session.commit()
            print(f"✅ Created {created_count} default system settings")
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error creating default settings: {str(e)}")
    else:
        print("ℹ️  All default system settings already exist")
    
    return created_count