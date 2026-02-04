# System Settings Routes for Afritec Bridge LMS

from flask import Blueprint, request, jsonify, make_response
from functools import wraps
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError
from datetime import datetime
import logging

from ..models.user_models import User, db
from ..models.system_settings_models import (
    SystemSetting, SettingAuditLog, SystemSettingsManager,
    initialize_default_settings
)
from ..utils.settings_validator import SettingsValidator, SettingsSecurityValidator

logger = logging.getLogger(__name__)

# Create the blueprint
settings_bp = Blueprint("settings_api", __name__, url_prefix="/api/v1/admin/settings")

# Authorization decorator
def admin_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        try:
            current_user_id = get_jwt_identity()
            current_user = User.query.get(current_user_id)
            
            if not current_user:
                return jsonify({"error": "User not found"}), 401
            
            # Check if the user has the 'admin' role
            if not current_user.role or current_user.role.name.lower() != 'admin':
                return jsonify({"error": "Admin privileges required"}), 403
            
            return f(current_user, *args, **kwargs)
        except Exception as e:
            logger.error(f"Admin authorization error: {str(e)}")
            return jsonify({"error": "Authorization failed"}), 401
            
    return decorated_function

# Validation schemas
class SettingUpdateSchema(Schema):
    key = fields.Str(required=True, validate=validate.Length(min=1, max=100))
    value = fields.Raw(required=True)  # Can be any type
    change_reason = fields.Str(validate=validate.Length(max=255))

class BulkSettingUpdateSchema(Schema):
    settings = fields.Dict(required=True)
    change_reason = fields.Str(validate=validate.Length(max=255))

class SettingCreateSchema(Schema):
    key = fields.Str(required=True, validate=validate.Length(min=1, max=100))
    value = fields.Raw(required=True)
    data_type = fields.Str(validate=validate.OneOf(['string', 'integer', 'float', 'boolean', 'json']))
    category = fields.Str(required=True, validate=validate.OneOf([
        'general', 'email', 'course', 'user', 'security', 'notification', 'ai'
    ]))
    description = fields.Str(validate=validate.Length(max=500))
    is_public = fields.Bool()
    is_editable = fields.Bool()
    requires_restart = fields.Bool()

# Validation decorator
def validate_json_data(schema_class):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                data = request.get_json()
                if not data:
                    return jsonify({"error": "No JSON data provided"}), 400
                
                schema = schema_class()
                validated_data = schema.load(data)
                return f(*args, validated_data=validated_data, **kwargs)
            except ValidationError as e:
                return jsonify({
                    "error": "Validation failed",
                    "details": e.messages
                }), 400
            except Exception as e:
                logger.error(f"Validation error: {str(e)}")
                return jsonify({"error": "Invalid request data"}), 400
        return decorated_function
    return decorator

@settings_bp.route("", methods=["GET"])
@admin_required
def get_system_settings(current_user):
    """Get all system settings organized by category"""
    try:
        category_filter = request.args.get('category')
        include_audit = request.args.get('include_audit', 'false').lower() == 'true'
        
        if category_filter:
            # Get settings for specific category
            settings = SystemSetting.query.filter_by(category=category_filter).all()
            result = {setting.key: setting.to_dict() for setting in settings}
        else:
            # Get all settings organized by category
            all_settings = SystemSettingsManager.get_all_settings()
            
            # Get detailed setting information
            settings_objects = SystemSetting.query.all()
            settings_details = {s.key: s.to_dict() for s in settings_objects}
            
            result = {
                'settings': all_settings,
                'details': settings_details
            }
        
        # Include audit information if requested
        if include_audit:
            recent_changes = SettingAuditLog.query.order_by(
                SettingAuditLog.changed_at.desc()
            ).limit(50).all()
            result['recent_changes'] = [log.to_dict() for log in recent_changes]
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching system settings: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to fetch system settings",
            "details": str(e)
        }), 500

@settings_bp.route("/<setting_key>", methods=["GET"])
@admin_required
def get_setting(current_user, setting_key):
    """Get a specific setting"""
    try:
        setting = SystemSetting.query.filter_by(key=setting_key).first()
        
        if not setting:
            return jsonify({
                "success": False,
                "error": "Setting not found"
            }), 404
        
        return jsonify({
            "success": True,
            "data": setting.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching setting {setting_key}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to fetch setting"
        }), 500

@settings_bp.route("/<setting_key>", methods=["PUT"])
@admin_required
@validate_json_data(SettingUpdateSchema)
def update_setting(current_user, setting_key, validated_data):
    """Update a specific setting"""
    try:
        setting = SystemSetting.query.filter_by(key=setting_key).first()
        
        if not setting:
            return jsonify({
                "success": False,
                "error": "Setting not found"
            }), 404
        
        if not setting.is_editable:
            return jsonify({
                "success": False,
                "error": "This setting is not editable"
            }), 403
        
        # Validate value based on data type and business rules
        value = validated_data['value']
        is_valid, validation_error = SettingsValidator.validate_setting(setting_key, value)
        if not is_valid:
            return jsonify({
                "success": False,
                "error": f"Validation error: {validation_error}"
            }), 400
        
        # Check security implications
        security_warnings = SettingsSecurityValidator.validate_security_implications({setting_key: value})
        if security_warnings and SettingsSecurityValidator.requires_admin_confirmation(
            setting_key, setting.value, value
        ):
            return jsonify({
                "success": False,
                "error": "This change requires additional security confirmation",
                "security_warnings": security_warnings,
                "requires_confirmation": True
            }), 403
        
        # Update the setting
        SystemSettingsManager.set_setting(
            key=setting_key,
            value=value,
            user_id=current_user.id,
            change_reason=validated_data.get('change_reason')
        )
        
        # Get the updated setting
        updated_setting = SystemSetting.query.filter_by(key=setting_key).first()
        
        return jsonify({
            "success": True,
            "message": "Setting updated successfully",
            "data": updated_setting.to_dict(),
            "requires_restart": updated_setting.requires_restart
        }), 200
        
    except Exception as e:
        logger.error(f"Error updating setting {setting_key}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to update setting",
            "details": str(e)
        }), 500

@settings_bp.route("/bulk", methods=["PUT"])
@admin_required
@validate_json_data(BulkSettingUpdateSchema)
def update_settings_bulk(current_user, validated_data):
    """Update multiple settings at once"""
    try:
        settings_data = validated_data['settings']
        change_reason = validated_data.get('change_reason', 'Bulk update')
        
        # Validate all settings first
        validation_errors = SettingsValidator.validate_settings(settings_data)
        if validation_errors:
            return jsonify({
                "success": False,
                "error": "Validation failed",
                "validation_errors": validation_errors
            }), 400
        
        # Check for security implications
        security_warnings = SettingsSecurityValidator.validate_security_implications(settings_data)
        
        updated_settings = []
        requires_restart = False
        errors = []
        
        for key, value in settings_data.items():
            try:
                setting = SystemSetting.query.filter_by(key=key).first()
                
                if not setting:
                    errors.append(f"Setting '{key}' not found")
                    continue
                
                if not setting.is_editable:
                    errors.append(f"Setting '{key}' is not editable")
                    continue
                
                # Additional validation for individual setting (already done in bulk validation above)
                # Just check type compatibility here
                if not SettingsValidator.validate_setting_type(key, value):
                    errors.append(f"Invalid type for setting '{key}'")
                    continue
                
                # Update the setting
                SystemSettingsManager.set_setting(
                    key=key,
                    value=value,
                    user_id=current_user.id,
                    change_reason=change_reason
                )
                
                updated_setting = SystemSetting.query.filter_by(key=key).first()
                updated_settings.append(updated_setting.to_dict())
                
                if updated_setting.requires_restart:
                    requires_restart = True
                    
            except Exception as e:
                errors.append(f"Error updating '{key}': {str(e)}")
                logger.error(f"Error updating setting {key}: {str(e)}")
        
        return jsonify({
            "success": True,
            "message": f"Updated {len(updated_settings)} settings",
            "data": {
                "updated_settings": updated_settings,
                "errors": errors,
                "requires_restart": requires_restart,
                "security_warnings": security_warnings if security_warnings else []
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error in bulk settings update: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to update settings",
            "details": str(e)
        }), 500

@settings_bp.route("", methods=["POST"])
@admin_required
@validate_json_data(SettingCreateSchema)
def create_setting(current_user, validated_data):
    """Create a new system setting"""
    try:
        # Check if setting already exists
        existing = SystemSetting.query.filter_by(key=validated_data['key']).first()
        if existing:
            return jsonify({
                "success": False,
                "error": "Setting with this key already exists"
            }), 409
        
        # Create new setting
        setting = SystemSetting(
            key=validated_data['key'],
            value=str(validated_data['value']),
            data_type=validated_data.get('data_type', 'string'),
            category=validated_data['category'],
            description=validated_data.get('description'),
            is_public=validated_data.get('is_public', False),
            is_editable=validated_data.get('is_editable', True),
            requires_restart=validated_data.get('requires_restart', False),
            updated_by=current_user.id
        )
        
        db.session.add(setting)
        
        # Log the creation
        audit_log = SettingAuditLog(
            setting_key=validated_data['key'],
            old_value=None,
            new_value=str(validated_data['value']),
            changed_by=current_user.id,
            change_reason='Setting created'
        )
        db.session.add(audit_log)
        
        db.session.commit()
        
        # Clear cache to include new setting
        SystemSettingsManager.clear_cache()
        
        return jsonify({
            "success": True,
            "message": "Setting created successfully",
            "data": setting.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating setting: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to create setting",
            "details": str(e)
        }), 500

@settings_bp.route("/<setting_key>", methods=["DELETE"])
@admin_required
def delete_setting(current_user, setting_key):
    """Delete a system setting"""
    try:
        setting = SystemSetting.query.filter_by(key=setting_key).first()
        
        if not setting:
            return jsonify({
                "success": False,
                "error": "Setting not found"
            }), 404
        
        if not setting.is_editable:
            return jsonify({
                "success": False,
                "error": "This setting cannot be deleted"
            }), 403
        
        # Log the deletion
        audit_log = SettingAuditLog(
            setting_key=setting_key,
            old_value=setting.value,
            new_value=None,
            changed_by=current_user.id,
            change_reason='Setting deleted'
        )
        db.session.add(audit_log)
        
        # Delete the setting
        db.session.delete(setting)
        db.session.commit()
        
        # Clear cache
        SystemSettingsManager.clear_cache()
        
        return jsonify({
            "success": True,
            "message": "Setting deleted successfully"
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting setting {setting_key}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to delete setting"
        }), 500

@settings_bp.route("/export", methods=["GET"])
@admin_required
def export_settings(current_user):
    """Export all settings for backup"""
    try:
        settings = SystemSetting.query.all()
        
        export_data = {
            'export_date': datetime.utcnow().isoformat(),
            'exported_by': current_user.id,
            'settings': [setting.to_dict() for setting in settings]
        }
        
        return jsonify({
            "success": True,
            "data": export_data
        }), 200
        
    except Exception as e:
        logger.error(f"Error exporting settings: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to export settings"
        }), 500

@settings_bp.route("/import", methods=["POST"])
@admin_required
def import_settings(current_user):
    """Import settings from backup"""
    try:
        data = request.get_json()
        if not data or 'settings' not in data:
            return jsonify({
                "success": False,
                "error": "No settings data provided"
            }), 400
        
        settings_data = data['settings']
        imported_count = 0
        updated_count = 0
        errors = []
        
        for setting_dict in settings_data:
            try:
                existing = SystemSetting.query.filter_by(key=setting_dict['key']).first()
                
                if existing:
                    # Update existing setting
                    if existing.is_editable:
                        SystemSettingsManager.set_setting(
                            key=setting_dict['key'],
                            value=setting_dict['value'],
                            user_id=current_user.id,
                            change_reason='Imported from backup'
                        )
                        updated_count += 1
                    else:
                        errors.append(f"Setting '{setting_dict['key']}' is not editable")
                else:
                    # Create new setting
                    setting = SystemSetting(
                        key=setting_dict['key'],
                        value=str(setting_dict['value']),
                        data_type=setting_dict.get('data_type', 'string'),
                        category=setting_dict.get('category', 'general'),
                        description=setting_dict.get('description'),
                        is_public=setting_dict.get('is_public', False),
                        is_editable=setting_dict.get('is_editable', True),
                        requires_restart=setting_dict.get('requires_restart', False),
                        updated_by=current_user.id
                    )
                    db.session.add(setting)
                    imported_count += 1
                    
            except Exception as e:
                errors.append(f"Error importing '{setting_dict.get('key', 'unknown')}': {str(e)}")
        
        db.session.commit()
        SystemSettingsManager.clear_cache()
        
        return jsonify({
            "success": True,
            "message": f"Imported {imported_count} new settings, updated {updated_count} existing",
            "data": {
                "imported": imported_count,
                "updated": updated_count,
                "errors": errors
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error importing settings: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to import settings",
            "details": str(e)
        }), 500

@settings_bp.route("/reset", methods=["POST"])
@admin_required
def reset_settings(current_user):
    """Reset all settings to default values"""
    try:
        data = request.get_json() or {}
        confirm = data.get('confirm', False)
        
        if not confirm:
            return jsonify({
                "success": False,
                "error": "Reset confirmation required"
            }), 400
        
        # Get all editable settings
        settings = SystemSetting.query.filter_by(is_editable=True).all()
        reset_count = 0
        
        for setting in settings:
            if setting.default_value is not None:
                SystemSettingsManager.set_setting(
                    key=setting.key,
                    value=setting.default_value,
                    user_id=current_user.id,
                    change_reason='Reset to default'
                )
                reset_count += 1
        
        return jsonify({
            "success": True,
            "message": f"Reset {reset_count} settings to default values"
        }), 200
        
    except Exception as e:
        logger.error(f"Error resetting settings: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to reset settings"
        }), 500

@settings_bp.route("/initialize", methods=["POST"])
@admin_required
def initialize_settings(current_user):
    """Initialize default settings"""
    try:
        created_count = initialize_default_settings()
        
        return jsonify({
            "success": True,
            "message": f"Initialized {created_count} default settings"
        }), 200
        
    except Exception as e:
        logger.error(f"Error initializing settings: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to initialize settings"
        }), 500

@settings_bp.route("/audit", methods=["GET"])
@admin_required
def get_audit_logs(current_user):
    """Get setting change audit logs"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        setting_key = request.args.get('setting_key')
        
        query = SettingAuditLog.query
        
        if setting_key:
            query = query.filter_by(setting_key=setting_key)
        
        logs = query.order_by(SettingAuditLog.changed_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            "success": True,
            "data": {
                "logs": [log.to_dict() for log in logs.items],
                "pagination": {
                    "page": logs.page,
                    "pages": logs.pages,
                    "per_page": logs.per_page,
                    "total": logs.total
                }
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching audit logs: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to fetch audit logs"
        }), 500

@settings_bp.route("/cache/clear", methods=["POST"])
@admin_required
def clear_settings_cache(current_user):
    """Clear the settings cache"""
    try:
        SystemSettingsManager.clear_cache()
        
        return jsonify({
            "success": True,
            "message": "Settings cache cleared successfully"
        }), 200
        
    except Exception as e:
        logger.error(f"Error clearing settings cache: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to clear cache"
        }), 500

# Email settings specific routes
@settings_bp.route("/email/test", methods=["POST"])
@admin_required
def test_email_configuration(current_user):
    """Test the current email configuration"""
    try:
        # Get email settings
        smtp_host = SystemSettingsManager.get_setting('smtp_host')
        smtp_port = SystemSettingsManager.get_setting('smtp_port', 587)
        from_email = SystemSettingsManager.get_setting('from_email')
        from_name = SystemSettingsManager.get_setting('from_name')
        enable_tls = SystemSettingsManager.get_setting('enable_tls', True)
        
        if not all([smtp_host, from_email]):
            return jsonify({
                "success": False,
                "error": "Email configuration incomplete"
            }), 400
        
        # Import email service
        from ...utils.email_utils import send_test_email
        
        # Send test email
        test_result = send_test_email(
            to_email=current_user.email,
            smtp_host=smtp_host,
            smtp_port=smtp_port,
            from_email=from_email,
            from_name=from_name,
            enable_tls=enable_tls
        )
        
        if test_result['success']:
            return jsonify({
                "success": True,
                "message": "Test email sent successfully"
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Failed to send test email",
                "details": test_result.get('error')
            }), 500
            
    except Exception as e:
        logger.error(f"Error testing email configuration: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to test email configuration",
            "details": str(e)
        }), 500

# Helper functions
def _validate_setting_value(setting, value):
    """Validate a setting value based on its data type"""
    try:
        if setting.data_type == 'boolean':
            return isinstance(value, bool) or str(value).lower() in ['true', 'false', '1', '0']
        elif setting.data_type == 'integer':
            int(value)
            return True
        elif setting.data_type == 'float':
            float(value)
            return True
        elif setting.data_type == 'json':
            if isinstance(value, (dict, list)):
                return True
            # Try to parse as JSON string
            import json
            json.loads(str(value))
            return True
        else:  # string
            return True
    except (ValueError, TypeError):
        return False