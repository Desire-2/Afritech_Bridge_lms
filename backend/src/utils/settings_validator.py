# Settings Validation Service for Afritec Bridge LMS

import re
from typing import Any, Dict, List, Union, Optional, Tuple
from urllib.parse import urlparse
import json


class SettingsValidator:
    """
    Comprehensive validation service for system settings
    Provides validation rules for different setting types and categories
    """
    
    # Email regex pattern
    EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    
    # URL regex pattern  
    URL_PATTERN = re.compile(
        r'^https?://'  # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
        r'localhost|'  # localhost...
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
        r'(?::\d+)?'  # optional port
        r'(?:/?|[/?]\S+)$', re.IGNORECASE)
    
    # Setting validation rules by key
    VALIDATION_RULES = {
        # General settings
        'site_name': {
            'type': 'string',
            'required': True,
            'min_length': 1,
            'max_length': 100,
            'description': 'Site name must be between 1 and 100 characters'
        },
        'site_url': {
            'type': 'url',
            'required': True,
            'description': 'Site URL must be a valid HTTP/HTTPS URL'
        },
        'support_email': {
            'type': 'email',
            'required': True,
            'description': 'Support email must be a valid email address'
        },
        'maintenance_mode': {
            'type': 'boolean',
            'description': 'Maintenance mode must be true or false'
        },
        'analytics_enabled': {
            'type': 'boolean',
            'description': 'Analytics enabled must be true or false'
        },
        
        # Email settings
        'smtp_host': {
            'type': 'string',
            'required': False,
            'min_length': 3,
            'max_length': 255,
            'description': 'SMTP host must be between 3 and 255 characters'
        },
        'smtp_port': {
            'type': 'integer',
            'min': 1,
            'max': 65535,
            'description': 'SMTP port must be between 1 and 65535'
        },
        'from_email': {
            'type': 'email',
            'required': False,
            'description': 'From email must be a valid email address'
        },
        'from_name': {
            'type': 'string',
            'required': False,
            'min_length': 1,
            'max_length': 100,
            'description': 'From name must be between 1 and 100 characters'
        },
        'enable_tls': {
            'type': 'boolean',
            'description': 'Enable TLS must be true or false'
        },
        
        # Course settings
        'max_students_per_course': {
            'type': 'integer',
            'min': 1,
            'max': 10000,
            'description': 'Maximum students per course must be between 1 and 10000'
        },
        'min_quiz_duration': {
            'type': 'integer',
            'min': 1,
            'max': 1440,  # 24 hours in minutes
            'description': 'Minimum quiz duration must be between 1 and 1440 minutes'
        },
        'max_quiz_duration': {
            'type': 'integer',
            'min': 1,
            'max': 1440,  # 24 hours in minutes
            'description': 'Maximum quiz duration must be between 1 and 1440 minutes'
        },
        'require_certificate': {
            'type': 'boolean',
            'description': 'Require certificate must be true or false'
        },
        'enable_forum_moderation': {
            'type': 'boolean',
            'description': 'Enable forum moderation must be true or false'
        },
        
        # User settings
        'enable_user_registration': {
            'type': 'boolean',
            'description': 'Enable user registration must be true or false'
        },
        'require_email_verification': {
            'type': 'boolean',
            'description': 'Require email verification must be true or false'
        },
        'max_login_attempts': {
            'type': 'integer',
            'min': 1,
            'max': 100,
            'description': 'Maximum login attempts must be between 1 and 100'
        },
        'session_timeout': {
            'type': 'integer',
            'min': 1,
            'max': 10080,  # 7 days in minutes
            'description': 'Session timeout must be between 1 and 10080 minutes'
        },
        'enable_oauth': {
            'type': 'boolean',
            'description': 'Enable OAuth must be true or false'
        },
        
        # Security settings
        'password_min_length': {
            'type': 'integer',
            'min': 4,
            'max': 128,
            'description': 'Password minimum length must be between 4 and 128 characters'
        },
        'password_require_uppercase': {
            'type': 'boolean',
            'description': 'Password require uppercase must be true or false'
        },
        'password_require_numbers': {
            'type': 'boolean',
            'description': 'Password require numbers must be true or false'
        },
        'password_require_special': {
            'type': 'boolean',
            'description': 'Password require special characters must be true or false'
        },
        'enable_two_factor': {
            'type': 'boolean',
            'description': 'Enable two-factor authentication must be true or false'
        },
        
        # AI settings
        'ai_agent_enabled': {
            'type': 'boolean',
            'description': 'AI agent enabled must be true or false'
        },
        'ai_max_requests_per_day': {
            'type': 'integer',
            'min': 1,
            'max': 10000,
            'description': 'AI max requests per day must be between 1 and 10000'
        },
    }
    
    # Cross-field validation rules
    CROSS_FIELD_RULES = [
        {
            'fields': ['min_quiz_duration', 'max_quiz_duration'],
            'rule': 'min_quiz_duration <= max_quiz_duration',
            'message': 'Minimum quiz duration must be less than or equal to maximum quiz duration'
        },
    ]
    
    @classmethod
    def validate_setting(cls, key: str, value: Any) -> Tuple[bool, Optional[str]]:
        """
        Validate a single setting value
        
        Returns:
            Tuple[bool, Optional[str]]: (is_valid, error_message)
        """
        if key not in cls.VALIDATION_RULES:
            return True, None  # No validation rules defined
        
        rule = cls.VALIDATION_RULES[key]
        
        # Check required fields
        if rule.get('required', False) and (value is None or value == ''):
            return False, f"{key} is required"
        
        # Allow empty/null values for non-required fields
        if value is None or value == '':
            return True, None
        
        # Type-specific validation
        if rule['type'] == 'string':
            return cls._validate_string(value, rule)
        elif rule['type'] == 'integer':
            return cls._validate_integer(value, rule)
        elif rule['type'] == 'float':
            return cls._validate_float(value, rule)
        elif rule['type'] == 'boolean':
            return cls._validate_boolean(value, rule)
        elif rule['type'] == 'email':
            return cls._validate_email(value, rule)
        elif rule['type'] == 'url':
            return cls._validate_url(value, rule)
        elif rule['type'] == 'json':
            return cls._validate_json(value, rule)
        
        return True, None
    
    @classmethod
    def validate_settings(cls, settings: Dict[str, Any]) -> Dict[str, List[str]]:
        """
        Validate multiple settings and return all errors
        
        Returns:
            Dict[str, List[str]]: Dictionary of field errors
        """
        errors = {}
        
        # Validate individual settings
        for key, value in settings.items():
            is_valid, error_message = cls.validate_setting(key, value)
            if not is_valid:
                if key not in errors:
                    errors[key] = []
                errors[key].append(error_message)
        
        # Validate cross-field rules
        for rule in cls.CROSS_FIELD_RULES:
            fields = rule['fields']
            if all(field in settings for field in fields):
                if not cls._evaluate_cross_field_rule(settings, rule):
                    for field in fields:
                        if field not in errors:
                            errors[field] = []
                        errors[field].append(rule['message'])
        
        return errors
    
    @classmethod
    def _validate_string(cls, value: Any, rule: Dict) -> Tuple[bool, Optional[str]]:
        """Validate string values"""
        if not isinstance(value, str):
            try:
                value = str(value)
            except:
                return False, rule.get('description', 'Must be a string')
        
        if 'min_length' in rule and len(value) < rule['min_length']:
            return False, f"Must be at least {rule['min_length']} characters long"
        
        if 'max_length' in rule and len(value) > rule['max_length']:
            return False, f"Must be no more than {rule['max_length']} characters long"
        
        if 'pattern' in rule and not re.match(rule['pattern'], value):
            return False, rule.get('description', 'Invalid format')
        
        return True, None
    
    @classmethod
    def _validate_integer(cls, value: Any, rule: Dict) -> Tuple[bool, Optional[str]]:
        """Validate integer values"""
        try:
            value = int(value)
        except (TypeError, ValueError):
            return False, rule.get('description', 'Must be a valid integer')
        
        if 'min' in rule and value < rule['min']:
            return False, f"Must be at least {rule['min']}"
        
        if 'max' in rule and value > rule['max']:
            return False, f"Must be no more than {rule['max']}"
        
        return True, None
    
    @classmethod
    def _validate_float(cls, value: Any, rule: Dict) -> Tuple[bool, Optional[str]]:
        """Validate float values"""
        try:
            value = float(value)
        except (TypeError, ValueError):
            return False, rule.get('description', 'Must be a valid number')
        
        if 'min' in rule and value < rule['min']:
            return False, f"Must be at least {rule['min']}"
        
        if 'max' in rule and value > rule['max']:
            return False, f"Must be no more than {rule['max']}"
        
        return True, None
    
    @classmethod
    def _validate_boolean(cls, value: Any, rule: Dict) -> Tuple[bool, Optional[str]]:
        """Validate boolean values"""
        if isinstance(value, bool):
            return True, None
        
        # Try to convert string representations
        if isinstance(value, str):
            if value.lower() in ('true', '1', 'yes', 'on'):
                return True, None
            elif value.lower() in ('false', '0', 'no', 'off'):
                return True, None
        
        # Try to convert numeric representations
        if isinstance(value, (int, float)):
            return True, None
        
        return False, rule.get('description', 'Must be true or false')
    
    @classmethod
    def _validate_email(cls, value: Any, rule: Dict) -> Tuple[bool, Optional[str]]:
        """Validate email addresses"""
        if not isinstance(value, str):
            return False, rule.get('description', 'Must be a valid email address')
        
        if not cls.EMAIL_PATTERN.match(value):
            return False, rule.get('description', 'Must be a valid email address')
        
        return True, None
    
    @classmethod
    def _validate_url(cls, value: Any, rule: Dict) -> Tuple[bool, Optional[str]]:
        """Validate URLs"""
        if not isinstance(value, str):
            return False, rule.get('description', 'Must be a valid URL')
        
        if not cls.URL_PATTERN.match(value):
            return False, rule.get('description', 'Must be a valid HTTP/HTTPS URL')
        
        # Additional URL validation
        try:
            parsed = urlparse(value)
            if not parsed.scheme in ('http', 'https'):
                return False, 'URL must use HTTP or HTTPS protocol'
            if not parsed.netloc:
                return False, 'URL must include a domain name'
        except:
            return False, rule.get('description', 'Must be a valid URL')
        
        return True, None
    
    @classmethod
    def _validate_json(cls, value: Any, rule: Dict) -> Tuple[bool, Optional[str]]:
        """Validate JSON values"""
        if isinstance(value, (dict, list)):
            return True, None
        
        if isinstance(value, str):
            try:
                json.loads(value)
                return True, None
            except json.JSONDecodeError:
                return False, rule.get('description', 'Must be valid JSON')
        
        return False, rule.get('description', 'Must be valid JSON')
    
    @classmethod
    def _evaluate_cross_field_rule(cls, settings: Dict[str, Any], rule: Dict) -> bool:
        """Evaluate cross-field validation rules"""
        if rule['rule'] == 'min_quiz_duration <= max_quiz_duration':
            min_duration = settings.get('min_quiz_duration')
            max_duration = settings.get('max_quiz_duration')
            
            if min_duration is not None and max_duration is not None:
                try:
                    return int(min_duration) <= int(max_duration)
                except (TypeError, ValueError):
                    return False
        
        return True
    
    @classmethod
    def get_setting_rule(cls, key: str) -> Optional[Dict]:
        """Get validation rule for a specific setting"""
        return cls.VALIDATION_RULES.get(key)
    
    @classmethod
    def get_setting_description(cls, key: str) -> str:
        """Get human-readable description for a setting"""
        rule = cls.VALIDATION_RULES.get(key, {})
        return rule.get('description', f'Setting: {key}')
    
    @classmethod
    def is_valid_setting_key(cls, key: str) -> bool:
        """Check if a setting key has validation rules"""
        return key in cls.VALIDATION_RULES
    
    @classmethod
    def get_all_setting_keys(cls) -> List[str]:
        """Get list of all known setting keys"""
        return list(cls.VALIDATION_RULES.keys())
    
    @classmethod
    def validate_setting_type(cls, key: str, value: Any) -> bool:
        """Quick check if value matches expected type for setting"""
        if key not in cls.VALIDATION_RULES:
            return True
        
        rule = cls.VALIDATION_RULES[key]
        expected_type = rule['type']
        
        if expected_type == 'string':
            return isinstance(value, str) or value is None
        elif expected_type == 'integer':
            return isinstance(value, int) or (isinstance(value, str) and value.isdigit())
        elif expected_type == 'float':
            try:
                float(value)
                return True
            except:
                return False
        elif expected_type == 'boolean':
            return isinstance(value, bool) or value in [0, 1, '0', '1', 'true', 'false']
        elif expected_type in ['email', 'url']:
            return isinstance(value, str) or value is None
        elif expected_type == 'json':
            return isinstance(value, (dict, list, str)) or value is None
        
        return True


class SettingsSecurityValidator:
    """
    Security-focused validation for sensitive settings
    """
    
    SENSITIVE_SETTINGS = [
        'smtp_host', 'smtp_port', 'from_email',
        'password_min_length', 'max_login_attempts',
        'session_timeout', 'enable_two_factor'
    ]
    
    CRITICAL_SETTINGS = [
        'maintenance_mode', 'enable_user_registration',
        'require_email_verification', 'ai_agent_enabled'
    ]
    
    @classmethod
    def is_sensitive_setting(cls, key: str) -> bool:
        """Check if setting contains sensitive information"""
        return key in cls.SENSITIVE_SETTINGS
    
    @classmethod
    def is_critical_setting(cls, key: str) -> bool:
        """Check if setting is critical for system operation"""
        return key in cls.CRITICAL_SETTINGS
    
    @classmethod
    def validate_security_implications(cls, settings: Dict[str, Any]) -> List[str]:
        """
        Validate security implications of setting changes
        Returns list of security warnings
        """
        warnings = []
        
        # Check for weak security configurations
        if settings.get('password_min_length', 8) < 8:
            warnings.append("Password minimum length below 8 characters may compromise security")
        
        if settings.get('max_login_attempts', 5) > 10:
            warnings.append("High maximum login attempts may allow brute force attacks")
        
        if settings.get('session_timeout', 30) > 1440:  # 24 hours
            warnings.append("Long session timeout may increase security risk")
        
        if not settings.get('require_email_verification', True):
            warnings.append("Disabled email verification may allow fake accounts")
        
        if settings.get('maintenance_mode', False):
            warnings.append("Maintenance mode will prevent user access to the system")
        
        # Check password requirements
        if not settings.get('password_require_uppercase', True):
            warnings.append("Not requiring uppercase letters weakens password security")
        
        if not settings.get('password_require_numbers', True):
            warnings.append("Not requiring numbers weakens password security")
        
        if not settings.get('password_require_special', True):
            warnings.append("Not requiring special characters weakens password security")
        
        return warnings
    
    @classmethod
    def requires_admin_confirmation(cls, key: str, old_value: Any, new_value: Any) -> bool:
        """
        Check if setting change requires additional admin confirmation
        """
        if key == 'maintenance_mode' and new_value:
            return True
        
        if key == 'enable_user_registration' and not new_value:
            return True
        
        if key == 'max_login_attempts' and new_value < 3:
            return True
        
        if key == 'password_min_length' and new_value < 6:
            return True
        
        return False