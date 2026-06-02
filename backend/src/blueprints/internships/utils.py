# Utility functions for Internship Application System

import re
import os
import uuid
from datetime import datetime
from functools import wraps
from werkzeug.utils import secure_filename
from flask import jsonify
from flask_jwt_extended import get_jwt_identity

from src.models.user_models import User
from src.models.internship_models import (
    ApplicationStatusEnum,
    InternshipApplication,
    ApplicationStatusLog,
    InternshipCohort,
)


# ============= STATUS TRANSITION MACHINE =============

VALID_STATUS_TRANSITIONS = {
    ApplicationStatusEnum.PENDING: [
        ApplicationStatusEnum.REVIEWING,
        ApplicationStatusEnum.REJECTED,
    ],
    ApplicationStatusEnum.REVIEWING: [
        ApplicationStatusEnum.SHORTLISTED,
        ApplicationStatusEnum.REJECTED,
    ],
    ApplicationStatusEnum.SHORTLISTED: [
        ApplicationStatusEnum.INTERVIEW_SCHEDULED,
        ApplicationStatusEnum.REJECTED,
    ],
    ApplicationStatusEnum.INTERVIEW_SCHEDULED: [
        ApplicationStatusEnum.ACCEPTED,
        ApplicationStatusEnum.REJECTED,
    ],
    ApplicationStatusEnum.ACCEPTED: [],  # Terminal state
    ApplicationStatusEnum.REJECTED: [],  # Terminal state
}


def is_valid_status_transition(from_status, to_status):
    """Validate if a status transition is allowed"""
    if from_status not in VALID_STATUS_TRANSITIONS:
        return False
    return to_status in VALID_STATUS_TRANSITIONS[from_status]


# ============= REFERENCE CODE GENERATION =============

def generate_reference_code():
    """
    Generate unique reference code in format: ATB-YYYY-XXXX
    ATB = Afritec Bridge
    YYYY = Year
    XXXX = Random hex (2048 possible values)
    """
    year = datetime.utcnow().year % 100  # Last 2 digits of year
    # Generate random 4-digit hex (0000-FFFF)
    random_part = '{:04X}'.format(uuid.uuid4().fields[0] % 0x10000)
    return f'ATB-{year:02d}-{random_part}'


def get_next_available_reference_code():
    """Get a unique reference code, retrying if collision occurs (very rare)"""
    max_retries = 10
    for attempt in range(max_retries):
        code = generate_reference_code()
        # Check if code already exists
        if not InternshipApplication.query.filter_by(reference_code=code).first():
            return code
    raise Exception("Failed to generate unique reference code after max retries")


# ============= PHONE VALIDATION =============

def validate_phone_number(phone):
    """
    Validate phone number in E.164 or local RW format.
    Accepted formats:
    - E.164: +1234567890 (up to 15 digits with country code)
    - Local RW: 0788123456 or 788123456
    """
    if not phone:
        return False
    
    # Remove whitespace and hyphens for validation
    cleaned = re.sub(r'[\s\-\(\)]', '', phone)
    
    # E.164 format: +1 to +999 followed by 7-15 digits
    if re.match(r'^\+[1-9]\d{6,14}$', cleaned):
        return True
    
    # Local format: 7-15 digits
    if re.match(r'^[0-9]{7,15}$', cleaned):
        return True
    
    return False


# ============= TEXT SANITIZATION =============

def sanitize_text(text, max_length=None):
    """
    Basic text sanitization - remove leading/trailing whitespace,
    collapse multiple spaces, optionally truncate.
    """
    if not text:
        return text
    
    # Strip whitespace and collapse multiple spaces
    sanitized = ' '.join(text.split())
    
    if max_length and len(sanitized) > max_length:
        sanitized = sanitized[:max_length].rstrip()
    
    return sanitized


# ============= FILE HANDLING =============

ALLOWED_CV_EXTENSIONS = {'pdf', 'doc', 'docx'}
MAX_CV_SIZE_MB = 5
MAX_CV_SIZE_BYTES = MAX_CV_SIZE_MB * 1024 * 1024


def allowed_cv_file(filename):
    """Check if file has allowed extension"""
    if not filename or '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in ALLOWED_CV_EXTENSIONS


def get_mime_type(filename):
    """Get MIME type from filename extension"""
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    mime_types = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }
    return mime_types.get(ext, 'application/octet-stream')


def save_cv_file(file_obj, original_filename):
    """
    Save CV file to uploads/internship_cvs/<uuid>/<original_name>
    Returns: (file_path, original_name) tuple
    """
    # Validate file extension
    if not allowed_cv_file(original_filename):
        raise ValueError(f"File type not allowed. Allowed: {', '.join(ALLOWED_CV_EXTENSIONS)}")
    
    # Check file size (for file objects, we check when reading)
    if hasattr(file_obj, 'seek'):
        file_obj.seek(0, 2)  # Seek to end
        file_size = file_obj.tell()
        file_obj.seek(0)  # Seek back to start
        
        if file_size > MAX_CV_SIZE_BYTES:
            raise ValueError(f"File size exceeds maximum of {MAX_CV_SIZE_MB}MB")
    
    # Create directory structure: uploads/internship_cvs/<uuid>/
    file_uuid = str(uuid.uuid4())
    upload_dir = os.path.join('uploads', 'internship_cvs', file_uuid)
    os.makedirs(upload_dir, exist_ok=True)
    
    # Secure the filename and save
    secure_name = secure_filename(original_filename)
    file_path = os.path.join(upload_dir, secure_name)
    
    # Store full path relative to backend root
    file_obj.save(file_path)
    
    return file_path, original_filename


# ============= DECORATORS =============

def role_required(allowed_roles):
    """Decorator to check if user has required role"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                user_id = int(get_jwt_identity())
                user = User.query.get(user_id)
                
                if not user or not user.role:
                    return jsonify({'message': 'User not found'}), 401
                
                if user.role.name not in allowed_roles:
                    return jsonify({'message': f'Access denied. Required roles: {", ".join(allowed_roles)}'}), 403
                
                return f(*args, **kwargs)
            except Exception as e:
                return jsonify({'message': 'Authentication failed', 'error': str(e)}), 401
        return decorated_function
    return decorator


def internship_admin_required(f):
    """Decorator to check if user is admin or staff"""
    return role_required(['admin', 'staff'])(f)


# ============= PAGINATION HELPERS =============

def paginate_query(query, page=1, per_page=20):
    """Paginate a SQLAlchemy query"""
    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    
    pages = (total + per_page - 1) // per_page  # Ceiling division
    
    return {
        'data': items,
        'page': page,
        'per_page': per_page,
        'total': total,
        'pages': pages,
    }


# ============= ERROR RESPONSE HELPERS =============

def error_response(message, errors=None, status_code=400):
    """Format error response"""
    response = {
        'success': False,
        'message': message,
    }
    if errors:
        response['errors'] = errors
    return jsonify(response), status_code


def success_response(message, data=None, status_code=200):
    """Format success response"""
    response = {
        'success': True,
        'message': message,
    }
    if data is not None:
        response['data'] = data
    return jsonify(response), status_code


# ============= COHORT HELPERS =============

def get_accepting_cohorts(track_id=None):
    """Get all accepting cohorts, optionally filtered by track"""
    query = InternshipCohort.query.filter_by(is_accepting=True)
    
    if track_id:
        query = query.filter_by(track_id=track_id)
    
    # Filter by current date
    now = datetime.utcnow()
    cohorts = query.all()
    
    # Only return cohorts that haven't ended and haven't hit capacity
    accepting = [c for c in cohorts if c.end_date > now and not c.is_full()]
    return accepting
