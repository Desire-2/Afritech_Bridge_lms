"""
Maintenance Mode Middleware for Afritec Bridge LMS

This middleware checks if the system is in maintenance mode and restricts access accordingly.
Admins can bypass maintenance mode to configure settings.
"""

from flask import jsonify, request, g
from functools import wraps
from datetime import datetime
import logging

from ..models.system_settings_models import SystemSettingsManager
from ..models.user_models import User
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

logger = logging.getLogger(__name__)

class MaintenanceMode:
    """Maintenance Mode Handler"""
    
    # Routes that are always accessible even in maintenance mode
    EXEMPT_ROUTES = {
        '/api/v1/auth/login',
        '/api/v1/auth/refresh',
        '/api/v1/auth/logout',  # Allow logout
        '/api/v1/maintenance/status',
        '/api/v1/maintenance/info',  # Must be accessible to show maintenance page
    }
    
    # Route prefixes that are always accessible (checked before admin bypass)
    EXEMPT_PREFIXES = (
        '/static/',
        '/api/v1/admin/',  # All admin routes are accessible
        '/api/v1/maintenance/',  # All maintenance endpoints
    )
    
    def __init__(self, app=None):
        self.app = app
        if app is not None:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize maintenance mode with Flask app"""
        app.before_request(self.check_maintenance_mode)
        logger.info("Maintenance mode middleware initialized")
    
    def check_maintenance_mode(self):
        """Check if system is in maintenance mode before processing request"""
        # Always allow OPTIONS requests (CORS preflight)
        if request.method == 'OPTIONS':
            return None
        
        # Skip for exempt routes FIRST (before checking maintenance status)
        if self._is_exempt_route():
            logger.debug(f"Route {request.path} is exempt from maintenance mode")
            return None
        
        # Check if user is admin BEFORE checking maintenance (admins always bypass)
        if self._is_admin_user():
            logger.debug(f"Admin user bypassing maintenance mode for {request.path}")
            return None
        
        # Check if maintenance mode is enabled
        settings_manager = SystemSettingsManager()
        is_maintenance = settings_manager.get_setting('maintenance_mode', False)
        
        if not is_maintenance:
            return None  # Not in maintenance mode, allow request
        
        # Get maintenance details
        maintenance_message = settings_manager.get_setting(
            'maintenance_message', 
            'The system is currently undergoing maintenance. Please check back later.'
        )
        maintenance_start = settings_manager.get_setting('maintenance_start_time', None)
        maintenance_end = settings_manager.get_setting('maintenance_end_time', None)
        
        # Build response
        response_data = {
            'error': 'System is in maintenance mode',
            'message': maintenance_message,
            'maintenance_mode': True,
            'estimated_end_time': maintenance_end,
            'start_time': maintenance_start,
        }
        
        logger.warning(f"Blocking request to {request.path} due to maintenance mode")
        return jsonify(response_data), 503
    
    def _is_exempt_route(self):
        """Check if current route is exempt from maintenance mode"""
        path = request.path
        
        # Check prefixes FIRST (more flexible)
        if path.startswith(self.EXEMPT_PREFIXES):
            logger.debug(f"Path {path} matches exempt prefix")
            return True
        
        # Check exact matches
        if path in self.EXEMPT_ROUTES:
            logger.debug(f"Path {path} matches exempt route")
            return True
        
        logger.debug(f"Path {path} is NOT exempt (checking against {self.EXEMPT_ROUTES})")
        return False
    
    def _is_admin_user(self):
        """Check if current user is an admin"""
        try:
            # Try to verify JWT token
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            
            if not user_id:
                return False
            
            user = User.query.get(user_id)
            if user and user.role and user.role.name.lower() == 'admin':
                return True
            
        except Exception as e:
            logger.debug(f"Could not verify admin status: {str(e)}")
        
        return False


def maintenance_mode_exempt(f):
    """
    Decorator to exempt specific routes from maintenance mode checks
    Usage: @maintenance_mode_exempt
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        g.maintenance_exempt = True
        return f(*args, **kwargs)
    return decorated_function
