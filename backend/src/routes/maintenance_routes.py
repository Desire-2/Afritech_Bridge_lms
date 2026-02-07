"""
Maintenance Mode Routes for Afritec Bridge LMS

Public endpoints to check maintenance status and get details.
"""

from flask import Blueprint, jsonify
from datetime import datetime
import logging

from ..models.system_settings_models import SystemSettingsManager

logger = logging.getLogger(__name__)

# Create blueprint - no auth required, public endpoints
maintenance_bp = Blueprint('maintenance', __name__, url_prefix='/api/v1/maintenance')

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
