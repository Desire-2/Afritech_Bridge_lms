# Student Profile Routes - Student profile management
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
import re
from werkzeug.security import check_password_hash, generate_password_hash
from marshmallow import Schema, fields, ValidationError, validate

from ..models.user_models import User, db
from ..models.course_models import Enrollment
from ..models.student_models import UserBadge, UserProgress
from ..models.achievement_models import UserAchievement

# Validation schemas
class BasicProfileSchema(Schema):
    first_name = fields.Str(validate=validate.Length(min=1, max=50), allow_none=True)
    last_name = fields.Str(validate=validate.Length(min=1, max=50), allow_none=True)
    bio = fields.Str(validate=validate.Length(max=1000), allow_none=True)
    phone_number = fields.Str(validate=validate.Regexp(r'^$|^[\+]?[1-9][\d\s\-\(\)]{7,20}$'), allow_none=True)
    location = fields.Str(validate=validate.Length(max=100), allow_none=True)
    timezone = fields.Str(validate=validate.Length(max=50), allow_none=True)

class CareerProfileSchema(Schema):
    job_title = fields.Str(validate=validate.Length(max=100), allow_none=True)
    company = fields.Str(validate=validate.Length(max=100), allow_none=True)
    industry = fields.Str(validate=validate.Length(max=100), allow_none=True)
    experience_level = fields.Str(validate=validate.OneOf(['Entry', 'Mid', 'Senior', 'Lead', 'Executive']), allow_none=True)
    portfolio_url = fields.Url(allow_none=True)
    github_username = fields.Str(validate=validate.Regexp(r'^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$'), allow_none=True)
    linkedin_url = fields.Url(allow_none=True)
    twitter_username = fields.Str(validate=validate.Regexp(r'^[a-zA-Z0-9_]{1,15}$'), allow_none=True)
    website_url = fields.Url(allow_none=True)
    skills = fields.List(fields.Str(validate=validate.Length(min=1, max=50)), allow_none=True)
    interests = fields.List(fields.Str(validate=validate.Length(min=1, max=50)), allow_none=True)
    learning_goals = fields.Str(validate=validate.Length(max=1000), allow_none=True)
    preferred_learning_style = fields.Str(validate=validate.OneOf(['visual', 'auditory', 'kinesthetic', 'reading']), allow_none=True)
    daily_learning_time = fields.Int(validate=validate.Range(min=0, max=1440), allow_none=True)

class PreferencesSchema(Schema):
    notifications = fields.Nested({
        'email_notifications': fields.Bool(),
        'push_notifications': fields.Bool(),
        'marketing_emails': fields.Bool(),
        'weekly_digest': fields.Bool()
    }, allow_none=True)
    privacy = fields.Nested({
        'profile_visibility': fields.Str(validate=validate.OneOf(['public', 'private', 'friends_only'])),
        'show_email': fields.Bool(),
        'show_progress': fields.Bool()
    }, allow_none=True)
    gamification = fields.Nested({
        'enable_gamification': fields.Bool(),
        'show_leaderboard': fields.Bool()
    }, allow_none=True)
    learning = fields.Nested({
        'preferred_learning_style': fields.Str(validate=validate.OneOf(['visual', 'auditory', 'kinesthetic', 'reading'])),
        'daily_learning_time': fields.Int(validate=validate.Range(min=0, max=1440)),
        'timezone': fields.Str(validate=validate.Length(max=50))
    }, allow_none=True)

class PasswordChangeSchema(Schema):
    current_password = fields.Str(required=True, validate=validate.Length(min=1))
    new_password = fields.Str(required=True, validate=validate.Length(min=8, max=128))
    confirm_password = fields.Str(required=True, validate=validate.Length(min=8, max=128))

    def validate_passwords_match(self, data, **kwargs):
        if data.get('new_password') != data.get('confirm_password'):
            raise ValidationError('Passwords do not match')

# Validation helper
def validate_json_data(schema_class):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                data = request.get_json()
                if not data:
                    return jsonify({"success": False, "message": "No data provided"}), 400
                
                schema = schema_class()
                validated_data = schema.load(data)
                return f(validated_data, *args, **kwargs)
            except ValidationError as err:
                return jsonify({
                    "success": False,
                    "message": "Validation failed",
                    "errors": err.messages
                }), 400
            except Exception as e:
                return jsonify({
                    "success": False,
                    "message": "Invalid request data"
                }), 400
        return decorated_function
    return decorator

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
    """Get comprehensive student profile with learning statistics"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({"message": "User not found"}), 404
    
    # Get enrollment statistics
    enrollments = Enrollment.query.filter_by(student_id=current_user_id).all()
    completed_courses = sum(1 for e in enrollments if e.progress >= 1.0)
    in_progress_courses = sum(1 for e in enrollments if 0 < e.progress < 1.0)
    total_progress = sum(e.progress for e in enrollments)
    avg_progress = total_progress / len(enrollments) if enrollments else 0
    
    # Get total learning time
    total_time = db.session.query(db.func.sum(UserProgress.total_time_spent)).filter_by(
        user_id=current_user_id
    ).scalar() or 0
    
    # Get badges and achievements
    badges_count = UserBadge.query.filter_by(user_id=current_user_id).count()
    achievements_count = UserAchievement.query.filter_by(user_id=current_user_id).count()
    
    profile_data = user.to_dict()
    profile_data.update({
        'learning_stats': {
            'total_enrollments': len(enrollments),
            'completed_courses': completed_courses,
            'in_progress_courses': in_progress_courses,
            'average_progress': round(avg_progress * 100, 2),
            'total_learning_hours': round(total_time / 3600, 1),
            'badges_earned': badges_count,
            'achievements_earned': achievements_count
        }
    })
    
    return jsonify({
        "success": True,
        "data": profile_data
    }), 200

@profile_bp.route("/", methods=["PUT"])
@student_required
def update_student_profile():
    """Update student profile information"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
    
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "No data provided"}), 400
    
    print(f"Profile update data received: {data}")  # Debug logging
    
    # Validate data based on which fields are being updated
    errors = {}
    
    # Basic profile validation
    basic_fields = ['first_name', 'last_name', 'bio', 'phone_number', 'location', 'timezone']
    basic_data = {k: v for k, v in data.items() if k in basic_fields}
    
    # Remove empty strings to treat them as None for validation
    for key, value in list(basic_data.items()):
        if value == '':
            basic_data[key] = None
    
    if basic_data:
        try:
            schema = BasicProfileSchema()
            validated_basic = schema.load(basic_data)
            # Update basic fields
            for field, value in validated_basic.items():
                setattr(user, field, value)
        except ValidationError as err:
            print(f"Basic validation errors: {err.messages}")  # Debug logging
            errors.update(err.messages)
    
    # Career profile validation
    career_fields = ['job_title', 'company', 'industry', 'experience_level', 'portfolio_url', 'github_username', 
                     'linkedin_url', 'twitter_username', 'website_url', 'skills', 'interests', 
                     'learning_goals', 'preferred_learning_style', 'daily_learning_time']
    career_data = {k: v for k, v in data.items() if k in career_fields}
    
    # Remove empty strings to treat them as None for validation
    for key, value in list(career_data.items()):
        if value == '':
            career_data[key] = None
    
    if career_data:
        try:
            # Handle skills conversion from comma-separated string to list
            if 'skills' in career_data and isinstance(career_data['skills'], str):
                career_data['skills'] = [skill.strip() for skill in career_data['skills'].split(',') if skill.strip()]
            
            schema = CareerProfileSchema()
            validated_career = schema.load(career_data)
            # Update career fields
            for field, value in validated_career.items():
                setattr(user, field, value)
        except ValidationError as err:
            print(f"Career validation errors: {err.messages}")  # Debug logging
            errors.update(err.messages)
    
    # Handle profile picture URL separately (basic validation)
    if 'profile_picture_url' in data:
        profile_pic_url = data['profile_picture_url']
        if profile_pic_url and not re.match(r'^https?://', profile_pic_url):
            errors['profile_picture_url'] = ['Invalid URL format']
        else:
            user.profile_picture_url = profile_pic_url
    
    if errors:
        print(f"Validation errors: {errors}")  # Debug logging
        return jsonify({
            "success": False,
            "message": "Validation failed",
            "errors": errors
        }), 400
    
    print(f"About to commit profile updates for user {current_user_id}")  # Debug logging

    try:
        db.session.commit()
        print(f"Profile updated successfully for user {current_user_id}")  # Debug logging
        
        try:
            user_data = user.to_dict()
            print(f"User data serialized successfully")  # Debug logging
        except Exception as serialization_error:
            print(f"Error serializing user data: {str(serialization_error)}")  # Debug logging
            # Return success but with minimal data
            return jsonify({
                "success": True,
                "data": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name
                },
                "message": "Profile updated successfully"
            }), 200
        
        return jsonify({
            "success": True,
            "data": user_data,
            "message": "Profile updated successfully"
        }), 200
    except Exception as e:
        db.session.rollback()
        print(f"Database error during profile update: {str(e)}")  # Debug logging
        return jsonify({
            "success": False,
            "message": "Failed to update profile",
            "error": str(e)
        }), 500

@profile_bp.route("/preferences", methods=["GET"])
@student_required
def get_profile_preferences():
    """Get user preferences"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({"message": "User not found"}), 404
    
    preferences = {
        'notifications': {
            'email_notifications': user.email_notifications,
            'push_notifications': user.push_notifications,
            'marketing_emails': user.marketing_emails,
            'weekly_digest': user.weekly_digest
        },
        'privacy': {
            'profile_visibility': user.profile_visibility,
            'show_email': user.show_email,
            'show_progress': user.show_progress
        },
        'gamification': {
            'enable_gamification': user.enable_gamification,
            'show_leaderboard': user.show_leaderboard
        },
        'learning': {
            'preferred_learning_style': user.preferred_learning_style,
            'daily_learning_time': user.daily_learning_time,
            'timezone': user.timezone
        }
    }
    
    return jsonify({
        "success": True,
        "data": preferences
    }), 200

@profile_bp.route("/preferences", methods=["PUT"])
@student_required
@validate_json_data(PreferencesSchema)
def update_profile_preferences(validated_data):
    """Update user preferences"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
    
    try:
        # Notification preferences
        if 'notifications' in validated_data:
            notifications = validated_data['notifications']
            if 'email_notifications' in notifications:
                user.email_notifications = notifications['email_notifications']
            if 'push_notifications' in notifications:
                user.push_notifications = notifications['push_notifications']
            if 'marketing_emails' in notifications:
                user.marketing_emails = notifications['marketing_emails']
            if 'weekly_digest' in notifications:
                user.weekly_digest = notifications['weekly_digest']
        
        # Privacy preferences
        if 'privacy' in validated_data:
            privacy = validated_data['privacy']
            if 'profile_visibility' in privacy:
                user.profile_visibility = privacy['profile_visibility']
            if 'show_email' in privacy:
                user.show_email = privacy['show_email']
            if 'show_progress' in privacy:
                user.show_progress = privacy['show_progress']
        
        # Gamification preferences
        if 'gamification' in validated_data:
            gamification = validated_data['gamification']
            if 'enable_gamification' in gamification:
                user.enable_gamification = gamification['enable_gamification']
            if 'show_leaderboard' in gamification:
                user.show_leaderboard = gamification['show_leaderboard']
        
        # Learning preferences
        if 'learning' in validated_data:
            learning = validated_data['learning']
            if 'preferred_learning_style' in learning:
                user.preferred_learning_style = learning['preferred_learning_style']
            if 'daily_learning_time' in learning:
                user.daily_learning_time = learning['daily_learning_time']
            if 'timezone' in learning:
                user.timezone = learning['timezone']
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Preferences updated successfully"
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": "Failed to update preferences",
            "error": str(e)
        }), 500

@profile_bp.route("/change-password", methods=["POST"])
@student_required
@validate_json_data(PasswordChangeSchema)
def change_password(validated_data):
    """Change user password"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
    
    # Additional validation for password matching
    if validated_data['new_password'] != validated_data['confirm_password']:
        return jsonify({
            "success": False,
            "message": "New passwords do not match"
        }), 400
    
    # Verify current password
    if not user.check_password(validated_data['current_password']):
        return jsonify({
            "success": False,
            "message": "Current password is incorrect"
        }), 400
    
    # Check if new password is different from current
    if user.check_password(validated_data['new_password']):
        return jsonify({
            "success": False,
            "message": "New password must be different from current password"
        }), 400
    
    try:
        # Update password
        user.set_password(validated_data['new_password'])
        user.must_change_password = False
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Password changed successfully"
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": "Failed to change password",
            "error": str(e)
        }), 500

@profile_bp.route("/analytics", methods=["GET"])
@student_required
def get_profile_analytics():
    """Get detailed learning analytics for profile"""
    current_user_id = int(get_jwt_identity())
    
    # Get enrollment data
    enrollments = Enrollment.query.filter_by(student_id=current_user_id).all()
    
    # Calculate analytics
    total_courses = len(enrollments)
    completed_courses = sum(1 for e in enrollments if e.progress >= 1.0)
    in_progress_courses = sum(1 for e in enrollments if 0 < e.progress < 1.0)
    
    # Calculate learning streak and time
    total_time = db.session.query(db.func.sum(UserProgress.total_time_spent)).filter_by(
        user_id=current_user_id
    ).scalar() or 0
    
    # Get monthly progress
    monthly_stats = []
    for enrollment in enrollments[-12:]:  # Last 12 enrollments
        monthly_stats.append({
            'course': enrollment.course.title,
            'progress': round(enrollment.progress * 100, 1),
            'enrollment_date': enrollment.enrollment_date.isoformat()
        })
    
    # Get recent achievements
    recent_achievements = UserAchievement.query.filter_by(
        user_id=current_user_id
    ).order_by(UserAchievement.earned_at.desc()).limit(5).all()
    
    analytics_data = {
        'overview': {
            'total_courses': total_courses,
            'completed_courses': completed_courses,
            'in_progress_courses': in_progress_courses,
            'completion_rate': round((completed_courses / total_courses * 100) if total_courses > 0 else 0, 1),
            'total_hours': round(total_time / 3600, 1)
        },
        'progress_timeline': monthly_stats,
        'recent_achievements': [
            {
                'title': achievement.achievement.title,
                'description': achievement.achievement.description,
                'earned_at': achievement.earned_at.isoformat()
            } for achievement in recent_achievements
        ],
        'skills_progress': {
            'completed_skills': completed_courses,  # Use completed courses as skills mastered
            'learning_skills': in_progress_courses  # Use in-progress courses as skills learning
        },
        'streak': {
            'current_streak': 0,  # TODO: Implement streak tracking
            'longest_streak': 0   # TODO: Implement streak tracking
        },
        'recent_activities': [
            {
                'title': f"Completed {enrollment.course.title}",
                'date': enrollment.completed_at.strftime('%Y-%m-%d') if enrollment.completed_at else 'In Progress'
            } for enrollment in enrollments[:5]  # Show last 5 activities
        ]
    }
    
    return jsonify({
        "success": True,
        "data": analytics_data
    }), 200