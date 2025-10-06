# Student Profile Routes - Student profile management
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps

from ..models.user_models import User, db
from ..models.course_models import Enrollment

# Helper decorator for student access
def student_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        if not user or not user.role or user.role.name != 'student':
            return jsonify({"message": "Student access required"}), 403
        return f(*args, **kwargs)
    return decorated_function

profile_bp = Blueprint("student_profile", __name__, url_prefix="/api/v1/student/profile")

@profile_bp.route("/", methods=["GET"])
@student_required
def get_student_profile():
    """Get student profile with learning statistics"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({"message": "User not found"}), 404
    
    # Get enrollment statistics
    enrollments = Enrollment.query.filter_by(student_id=current_user_id).all()
    completed_courses = sum(1 for e in enrollments if e.progress >= 1.0)
    total_progress = sum(e.progress for e in enrollments)
    avg_progress = total_progress / len(enrollments) if enrollments else 0
    
    profile_data = user.to_dict()
    profile_data.update({
        'learning_stats': {
            'total_enrollments': len(enrollments),
            'completed_courses': completed_courses,
            'in_progress_courses': len(enrollments) - completed_courses,
            'average_progress': round(avg_progress * 100, 2)
        }
    })
    
    return jsonify(profile_data), 200

@profile_bp.route("/", methods=["PUT"])
@student_required
def update_student_profile():
    """Update student profile information"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({"message": "User not found"}), 404
    
    data = request.get_json()
    
    # Update allowed fields
    if 'first_name' in data:
        user.first_name = data['first_name']
    if 'last_name' in data:
        user.last_name = data['last_name']
    if 'bio' in data:
        user.bio = data['bio']
    if 'profile_picture_url' in data:
        user.profile_picture_url = data['profile_picture_url']
    
    db.session.commit()
    
    return jsonify(user.to_dict()), 200