"""
Maintenance Mode Routes for Afritec Bridge LMS

Public endpoints to check maintenance status and get details.
Admin endpoints for sending notifications.
"""

from flask import Blueprint, jsonify, request
from datetime import datetime
from functools import wraps
import logging

from ..models.system_settings_models import SystemSettingsManager
from ..models.user_models import User
from ..services.maintenance_notification_service import MaintenanceNotificationService
from flask_jwt_extended import jwt_required, get_jwt_identity

logger = logging.getLogger(__name__)

# Create blueprint - no auth required for public endpoints
maintenance_bp = Blueprint('maintenance', __name__, url_prefix='/api/v1/maintenance')

# Admin authorization decorator
def admin_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        try:
            current_user_id = get_jwt_identity()
            current_user = User.query.get(current_user_id)
            
            if not current_user:
                return jsonify({"error": "User not found"}), 401
            
            if not current_user.role or current_user.role.name.lower() != 'admin':
                return jsonify({"error": "Admin privileges required"}), 403
            
            return f(current_user, *args, **kwargs)
        except Exception as e:
            logger.error(f"Admin authorization error: {str(e)}")
            return jsonify({"error": "Authorization failed"}), 401
            
    return decorated_function

@maintenance_bp.route('/status', methods=['GET'])
def get_maintenance_status():
    """
    Get current maintenance mode status (public endpoint)
    
    Returns:
        - maintenance_mode: boolean
        - message: maintenance message if active
        - estimated_end_time: when maintenance is expected to end
        - start_time: when maintenance started
    """
    try:
        settings_manager = SystemSettingsManager()
        
        is_maintenance = settings_manager.get_setting('maintenance_mode', False)
        
        response_data = {
            'maintenance_mode': is_maintenance,
            'current_time': datetime.utcnow().isoformat()
        }
        
        if is_maintenance:
            response_data['message'] = settings_manager.get_setting(
                'maintenance_message',
                'The system is currently undergoing maintenance. Please check back later.'
            )
            response_data['start_time'] = settings_manager.get_setting(
                'maintenance_start_time', 
                None
            )
            response_data['estimated_end_time'] = settings_manager.get_setting(
                'maintenance_end_time',
                None
            )
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error getting maintenance status: {str(e)}")
        # Always return a valid response, default to not in maintenance
        return jsonify({
            'maintenance_mode': False,
            'current_time': datetime.utcnow().isoformat()
        }), 200


@maintenance_bp.route('/info', methods=['GET'])
def get_maintenance_info():
    """
    Get detailed maintenance information including schedule (public endpoint)
    """
    try:
        settings_manager = SystemSettingsManager()
        
        response_data = {
            'maintenance_mode': settings_manager.get_setting('maintenance_mode', False),
            'message': settings_manager.get_setting(
                'maintenance_message',
                'The system is currently undergoing maintenance. Please check back later.'
            ),
            'start_time': settings_manager.get_setting('maintenance_start_time', None),
            'estimated_end_time': settings_manager.get_setting('maintenance_end_time', None),
            'show_countdown': settings_manager.get_setting('maintenance_show_countdown', True),
            'allow_admin_bypass': True,  # Always true by design
            'current_time': datetime.utcnow().isoformat()
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error getting maintenance info: {str(e)}")
        return jsonify({
            'error': 'Failed to retrieve maintenance information',
            'maintenance_mode': False
        }), 500


@maintenance_bp.route('/notify-users', methods=['POST'])
@admin_required
def notify_users(current_user):
    """
    Send maintenance notification emails to users (admin only)
    
    Request body:
        - start_time: ISO format start time (required)
        - end_time: ISO format end time (required)
        - message: Custom message (required)
        - exclude_admins: Whether to exclude admins (optional, default: true)
        - roles: List of specific roles to notify (optional)
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        start_time_str = data.get('start_time')
        end_time_str = data.get('end_time')
        message = data.get('message')
        exclude_admins = data.get('exclude_admins', True)
        roles = data.get('roles')  # Optional: ['student', 'instructor']
        
        # Validation
        if not start_time_str or not end_time_str or not message:
            return jsonify({
                'error': 'Missing required fields: start_time, end_time, message'
            }), 400
        
        # Parse datetime strings
        try:
            from dateutil import parser as date_parser
            start_time = date_parser.parse(start_time_str)
            end_time = date_parser.parse(end_time_str)
        except Exception as e:
            logger.error(f"❌ Error parsing datetime: {str(e)}")
            return jsonify({
                'error': f'Invalid datetime format: {str(e)}'
            }), 400
        
        # Send notifications
        notification_service = MaintenanceNotificationService()
        
        if roles:
            result = notification_service.notify_specific_roles(
                roles=roles,
                start_time=start_time,
                end_time=end_time,
                message=message
            )
        else:
            result = notification_service.notify_all_users(
                start_time=start_time,
                end_time=end_time,
                message=message,
                exclude_admins=exclude_admins
            )
        
        if result.get('success'):
            logger.info(
                f"Admin {current_user.email} sent maintenance notifications: "
                f"{result.get('success_count')} sent, {result.get('failed_count')} failed"
            )
            
            return jsonify({
                'success': True,
                'message': f'Notifications sent successfully to {result.get("success_count")} users',
                'details': {
                    'total_users': result.get('total_users', 0),
                    'success_count': result.get('success_count', 0),
                    'failed_count': result.get('failed_count', 0),
                    'failed_emails': result.get('failed_emails', [])
                }
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Failed to send notifications')
            }), 500
            
    except Exception as e:
        logger.error(f"Error sending maintenance notifications: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
