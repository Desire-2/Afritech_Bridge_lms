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

# Registration endpoint disabled - users are created automatically upon course application approval
@auth_bp.route('/register', methods=['POST'])
def register():
    return jsonify({
        'message': 'Direct registration is disabled. Please apply for a course - user accounts are created automatically upon application approval.',
        'details': {
            'registration_disabled': True,
            'apply_url': '/courses'
        }
    }), 403

# Original registration code kept for reference (disabled)
# @auth_bp.route('/register', methods=['POST'])
# def register():
#     data = request.get_json()
#     username = data.get('username')
#     email = data.get('email')
#     password = data.get('password')
#     first_name = data.get('first_name')
#     last_name = data.get('last_name')
# 
#     if not username or not email or not password:
#         return jsonify({'message': 'Username, email, and password are required'}), 400
# 
#     # Check for existing username and email separately for better error messages
#     existing_user_by_username = User.query.filter_by(username=username).first()
#     existing_user_by_email = User.query.filter_by(email=email).first()
#     
#     if existing_user_by_username and existing_user_by_email:
#         return jsonify({
#             'message': 'Both username and email are already registered',
#             'details': {
#                 'username_taken': True,
#                 'email_taken': True
#             }
#         }), 409
#     elif existing_user_by_username:
#         return jsonify({
#             'message': 'Username is already taken',
#             'details': {
#                 'username_taken': True,
#                 'email_taken': False
#             }
#         }), 409
#     elif existing_user_by_email:
#         return jsonify({
#             'message': 'Email is already registered',
#             'details': {
#                 'username_taken': False,
#                 'email_taken': True
#             }
#         }), 409
# 
#     # Default role to 'student' if not specified or if role system is more complex
#     student_role = Role.query.filter_by(name='student').first()
#     if not student_role:
#         # Create student role if it doesn't exist (basic setup)
#         student_role = Role(name='student')
#         db.session.add(student_role)
#         # Also create instructor and admin roles for completeness if they don't exist
#         if not Role.query.filter_by(name='instructor').first():
#             db.session.add(Role(name='instructor'))
#         if not Role.query.filter_by(name='admin').first():
#             db.session.add(Role(name='admin'))
#         db.session.commit() # Commit roles first
#         student_role = Role.query.filter_by(name='student').first() # Re-fetch after commit
# 
#     new_user = User(
#         username=username,
#         email=email,
#         first_name=first_name,
#         last_name=last_name,
#         role_id=student_role.id
#     )
#     new_user.set_password(password)
#     db.session.add(new_user)
#     db.session.commit()
# 
#     return jsonify({'message': 'User registered successfully', 'user': new_user.to_dict()}), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    identifier = data.get('identifier') # Can be username or email
    password = data.get('password')

    # Log the login attempt (without password)
    print(f"Login attempt for identifier: {identifier}")

    # Input validation with specific error messages
    if not identifier and not password:
        print("Login failed: Both identifier and password missing")
        return jsonify({
            'message': 'Email/username and password are required',
            'error_type': 'validation_error',
            'details': {
                'identifier_missing': True,
                'password_missing': True
            }
        }), 400
    elif not identifier:
        print("Login failed: Identifier missing")
        return jsonify({
            'message': 'Email or username is required',
            'error_type': 'validation_error',
            'details': {
                'identifier_missing': True,
                'password_missing': False
            }
        }), 400
    elif not password:
        print("Login failed: Password missing")
        return jsonify({
            'message': 'Password is required',
            'error_type': 'validation_error',
            'details': {
                'identifier_missing': False,
                'password_missing': True
            }
        }), 400

    # Validate identifier format (basic email check)
    identifier = identifier.strip()
    if '@' in identifier:
        # If it contains @, treat as email and do basic validation
        if not identifier.count('@') == 1 or not identifier.split('@')[1]:
            print(f"Login failed: Invalid email format for {identifier}")
            return jsonify({
                'message': 'Please enter a valid email address',
                'error_type': 'validation_error',
                'details': {
                    'invalid_email_format': True
                }
            }), 400

    # Look for user by identifier
    user = User.query.filter((User.username == identifier) | (User.email == identifier)).first()

    if not user:
        print(f"Login failed: No user found for identifier {identifier}")
        return jsonify({
            'message': 'No account found with this email or username',
            'error_type': 'authentication_error',
            'details': {
                'user_not_found': True,
                'invalid_password': False
            }
        }), 401
    
    if not user.check_password(password):
        print(f"Login failed: Invalid password for user {user.email}")
        return jsonify({
            'message': 'Incorrect password. Please try again.',
            'error_type': 'authentication_error',
            'details': {
                'user_not_found': False,
                'invalid_password': True
            }
        }), 401

    # Successful login
    try:
        # Update last login and activity
        user.update_last_login()
        db.session.commit()
        
        access_token = create_access_token(identity=str(user.id), fresh=True, expires_delta=timedelta(hours=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES_HOURS', 1))))
        refresh_token = create_refresh_token(identity=str(user.id), expires_delta=timedelta(days=int(os.getenv('JWT_REFRESH_TOKEN_EXPIRES_DAYS', 30))))
        
        # Verify user data is properly serialized
        user_data = user.to_dict()
        if not user_data or 'id' not in user_data or 'role' not in user_data:
            print(f"Login error: User data validation failed for {user.email}")
            return jsonify({
                'message': 'User data validation failed',
                'error_type': 'server_error'
            }), 500
            
        # Log successful authentication
        print(f"✓ User {user.email} ({user.role}) logged in successfully")
        
        # Check if user must change password
        response_data = {
            'message': 'Login successful',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': user_data
        }
        
        # Add flag if password change is required
        if user.must_change_password:
            response_data['must_change_password'] = True
            response_data['message'] = 'Login successful. Please change your password to continue.'
        
        return jsonify(response_data), 200
        
    except Exception as e:
        print(f"Login error: Failed to generate tokens for user {user.email}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'message': 'Authentication tokens could not be generated',
            'error_type': 'server_error'
        }), 500

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
    
    # Send the reset email (with timeout protection)
    try:
        email_sent = send_password_reset_email(user, reset_url)
    except Exception as e:
        current_app.logger.error(f"Exception during password reset email for {email}: {str(e)}")
        email_sent = False
    
    # Always return success for security (don't reveal if user exists)
    # But log the actual outcome for debugging
    if email_sent:
        current_app.logger.info(f"Password reset email sent to: {email}")
    else:
        current_app.logger.error(f"Failed to send password reset email to: {email}")
    
    # Always return the same response for security
    return jsonify({
        'message': 'If an account with this email exists, password reset instructions have been sent',
        'status': 'processed'
    }), 200

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


@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """
    Change user password (authenticated users).
    Clears must_change_password flag if set.
    """
    user_id = get_jwt_identity()
    data = request.get_json()
    
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    
    if not current_password or not new_password:
        return jsonify({'message': 'Current password and new password are required'}), 400
    
    if len(new_password) < 6:
        return jsonify({'message': 'New password must be at least 6 characters long'}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404
    
    # Verify current password
    if not user.check_password(current_password):
        return jsonify({'message': 'Current password is incorrect'}), 401
    
    # Set new password
    user.set_password(new_password)
    
    # Clear must_change_password flag if it was set
    if user.must_change_password:
        user.must_change_password = False
    
    db.session.commit()
    
    return jsonify({
        'message': 'Password changed successfully',
        'must_change_password': False
    }), 200


@auth_bp.route('/validate-reset-token', methods=['POST'])
def validate_reset_token():
    """Validate if a password reset token is valid"""
    data = request.get_json()
    token = data.get('token')
    email = data.get('email')
    
    if not token or not email:
        return jsonify({'message': 'Email and token are required'}), 400
        
    user = User.query.filter_by(email=email).first()
    if not user or not user.verify_reset_token(token):
        return jsonify({'message': 'Invalid or expired reset token'}), 400
    
    return jsonify({'message': 'Token is valid'}), 200

