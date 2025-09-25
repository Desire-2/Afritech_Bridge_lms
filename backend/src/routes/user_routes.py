# User and Authentication Routes for Afritec Bridge LMS

import os
from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity, get_jwt
from datetime import timedelta, datetime
from ..utils.email_utils import send_password_reset_email

# Assuming db and User, Role models are correctly set up and accessible.
# This might require adjustments based on the actual Flask app structure from create_flask_app
# from src import db # If db is in src/__init__.py
# from src.models.user_models import User, Role # If models are in src/models/

# Placeholder for db and models until actual app structure is fully integrated
# This is a common pattern, assuming db and models are imported from where they are defined.
# For now, we'll define them locally for structure, then integrate with the main app.
from ..models.user_models import db, User, Role # Adjusted import assuming this file is in src/routes

auth_bp = Blueprint('auth_bp', __name__, url_prefix='/api/v1/auth')
user_bp = Blueprint('user_bp', __name__, url_prefix='/api/v1/users')

# In-memory blocklist for JWT tokens (for logout)
# In a production environment, this should be a persistent store like Redis.
BLOCKLIST = set()

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    first_name = data.get('first_name')
    last_name = data.get('last_name')

    if not username or not email or not password:
        return jsonify({'message': 'Username, email, and password are required'}), 400

    if User.query.filter_by(username=username).first() or User.query.filter_by(email=email).first():
        return jsonify({'message': 'User already exists'}), 409

    # Default role to 'student' if not specified or if role system is more complex
    student_role = Role.query.filter_by(name='student').first()
    if not student_role:
        # Create student role if it doesn't exist (basic setup)
        student_role = Role(name='student')
        db.session.add(student_role)
        # Also create instructor and admin roles for completeness if they don't exist
        if not Role.query.filter_by(name='instructor').first():
            db.session.add(Role(name='instructor'))
        if not Role.query.filter_by(name='admin').first():
            db.session.add(Role(name='admin'))
        db.session.commit() # Commit roles first
        student_role = Role.query.filter_by(name='student').first() # Re-fetch after commit

    new_user = User(
        username=username,
        email=email,
        first_name=first_name,
        last_name=last_name,
        role_id=student_role.id
    )
    new_user.set_password(password)
    db.session.add(new_user)
    db.session.commit()

    return jsonify({'message': 'User registered successfully', 'user': new_user.to_dict()}), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    identifier = data.get('identifier') # Can be username or email
    password = data.get('password')

    if not identifier or not password:
        return jsonify({'message': 'Username/email and password are required'}), 400

    user = User.query.filter((User.username == identifier) | (User.email == identifier)).first()

    if user and user.check_password(password):
        access_token = create_access_token(identity=user.id, fresh=True, expires_delta=timedelta(hours=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES_HOURS', 1))))
        refresh_token = create_refresh_token(identity=user.id, expires_delta=timedelta(days=int(os.getenv('JWT_REFRESH_TOKEN_EXPIRES_DAYS', 30))))
        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': user.to_dict()
        }), 200
    else:
        return jsonify({'message': 'Invalid credentials'}), 401

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    current_user_id = get_jwt_identity()
    new_access_token = create_access_token(identity=current_user_id, fresh=False, expires_delta=timedelta(hours=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES_HOURS', 1))))
    return jsonify({'access_token': new_access_token}), 200

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    jti = get_jwt()['jti']
    BLOCKLIST.add(jti)
    return jsonify({'message': 'Successfully logged out'}), 200

@user_bp.route('/me', methods=['GET'])
@jwt_required()
def get_me():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404
    return jsonify(user.to_dict()), 200

# Additional user management routes (e.g., update profile, list users for admin) can be added here.
# Example: Update user profile
@user_bp.route('/me', methods=['PUT'])
@jwt_required()
def update_me():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404

    data = request.get_json()
    user.first_name = data.get('first_name', user.first_name)
    user.last_name = data.get('last_name', user.last_name)
    user.bio = data.get('bio', user.bio)
    user.profile_picture_url = data.get('profile_picture_url', user.profile_picture_url)
    # Email and username changes might require more complex handling (e.g., verification)
    # Password change should be a separate endpoint

    db.session.commit()
    return jsonify({'message': 'Profile updated successfully', 'user': user.to_dict()}), 200

# This function can be used by the main app to check if a token is blocklisted.
# It's needed for JWTManager configuration.
def token_in_blocklist_loader(jwt_header, jwt_payload):
    jti = jwt_payload['jti']
    return jti in BLOCKLIST

# Password reset routes
@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Request a password reset link"""
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({'message': 'Email is required'}), 400
    
    # Validate email format
    import re
    email_pattern = re.compile(r'^[\w\.-]+@[\w\.-]+\.\w+$')
    if not email_pattern.match(email):
        return jsonify({'message': 'Please enter a valid email address'}), 400
        
    # Check if user exists
    user = User.query.filter_by(email=email).first()
    if not user:
        # Now we'll be explicit about the user not existing
        current_app.logger.info(f"Password reset requested for non-existent email: {email}")
        return jsonify({
            'message': 'No account found with this email address',
            'status': 'user_not_found'  # Clear status for frontend to handle
        }), 404  # Using 404 status code for not found
        
    # Generate a reset token
    token = user.generate_reset_token()
    db.session.commit()
    
    # Create the reset URL
    frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:3000')
    reset_url = f"{frontend_url}/auth/reset-password?token={token}&email={email}"
    
    # Send the reset email
    email_sent = send_password_reset_email(user, reset_url)
    
    # Log the outcome for debugging
    if email_sent:
        current_app.logger.info(f"Password reset email sent to: {email}")
        return jsonify({
            'message': 'Password reset instructions have been sent to your email address',
            'status': 'email_sent'  # This is a hint for the frontend, but still ambiguous
        }), 200
    else:
        current_app.logger.error(f"Failed to send password reset email to: {email}")
        return jsonify({
            'message': 'Failed to send password reset email. Please try again later.',
            'status': 'email_error'  # This is a hint for the frontend, but still ambiguous
        }), 500

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Reset the password using the token"""
    data = request.get_json()
    email = data.get('email')
    token = data.get('token')
    new_password = data.get('password')
    
    if not email or not token or not new_password:
        return jsonify({'message': 'Email, token, and new password are required'}), 400
        
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'message': 'Invalid or expired reset token'}), 400
        
    if not user.verify_reset_token(token):
        return jsonify({'message': 'Invalid or expired reset token'}), 400
    
    # Reset the password
    user.set_password(new_password)
    user.clear_reset_token()  # Clear the token so it can't be used again
    db.session.commit()
    
    return jsonify({'message': 'Password has been reset successfully'}), 200

@auth_bp.route('/validate-reset-token', methods=['POST'])
def validate_reset_token():
    """Validate a password reset token"""
    data = request.get_json()
    email = data.get('email')
    token = data.get('token')
    
    if not email or not token:
        return jsonify({'message': 'Email and token are required'}), 400
        
    user = User.query.filter_by(email=email).first()
    if not user or not user.verify_reset_token(token):
        return jsonify({'message': 'Invalid or expired reset token'}), 400
    
    return jsonify({'message': 'Token is valid'}), 200

