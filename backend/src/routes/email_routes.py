"""
Email preference and unsubscribe routes for Afritech Bridge LMS.

Provides tokenized unsubscribe endpoints that work without authentication
(accessed directly from email links).
"""
import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..models.user_models import db, User
from ..models.notification_models import NotificationPreference

logger = logging.getLogger(__name__)

email_bp = Blueprint('email', __name__, url_prefix='/api/v1/email')


@email_bp.route('/unsubscribe', methods=['POST'])
def unsubscribe():
    """
    One-click unsubscribe via token (no auth required).
    Called from the unsubscribe link in emails.

    Body: { "token": "...", "category": "all" | "grades" | "announcements" | ... }
    """
    data = request.get_json(silent=True) or {}
    token = data.get('token', '').strip()
    category = data.get('category', 'all').strip().lower()

    if not token:
        return jsonify({'error': 'Missing unsubscribe token'}), 400

    user = User.query.filter_by(email_unsubscribe_token=token).first()
    if not user:
        return jsonify({'error': 'Invalid unsubscribe token'}), 404

    if category == 'all':
        # Disable all email notifications
        user.email_notifications = False
        user.marketing_emails = False
        user.weekly_digest = False

        # Also update NotificationPreference if it exists
        pref = NotificationPreference.query.filter_by(user_id=user.id).first()
        if pref:
            pref.email_enabled = False
        
        db.session.commit()
        logger.info(f"User {user.id} unsubscribed from ALL email notifications")
        return jsonify({
            'message': 'You have been unsubscribed from all email notifications.',
            'category': 'all'
        }), 200
    else:
        # Disable a specific category
        pref = NotificationPreference.query.filter_by(user_id=user.id).first()
        if not pref:
            pref = NotificationPreference(user_id=user.id)
            db.session.add(pref)

        settings = pref.category_settings or {}
        settings[category] = False
        pref.category_settings = settings
        db.session.commit()

        logger.info(f"User {user.id} unsubscribed from '{category}' emails")
        return jsonify({
            'message': f'You have been unsubscribed from {category} notifications.',
            'category': category
        }), 200


@email_bp.route('/unsubscribe/status', methods=['POST'])
def unsubscribe_status():
    """
    Get current email preferences for a token holder (no auth needed).
    Used by the frontend unsubscribe page to show current settings.

    Body: { "token": "..." }
    """
    data = request.get_json(silent=True) or {}
    token = data.get('token', '').strip()

    if not token:
        return jsonify({'error': 'Missing token'}), 400

    user = User.query.filter_by(email_unsubscribe_token=token).first()
    if not user:
        return jsonify({'error': 'Invalid token'}), 404

    pref = NotificationPreference.query.filter_by(user_id=user.id).first()
    category_settings = pref.category_settings if pref else {}

    return jsonify({
        'email': _mask_email(user.email),
        'email_notifications': user.email_notifications,
        'marketing_emails': user.marketing_emails,
        'weekly_digest': user.weekly_digest,
        'email_enabled': pref.email_enabled if pref else True,
        'category_settings': category_settings,
        'available_categories': [
            'announcements', 'grades', 'forum',
            'enrollment', 'achievement', 'system'
        ]
    }), 200


@email_bp.route('/resubscribe', methods=['POST'])
def resubscribe():
    """
    Re-enable email notifications via token.

    Body: { "token": "...", "category": "all" | "<category_name>" }
    """
    data = request.get_json(silent=True) or {}
    token = data.get('token', '').strip()
    category = data.get('category', 'all').strip().lower()

    if not token:
        return jsonify({'error': 'Missing token'}), 400

    user = User.query.filter_by(email_unsubscribe_token=token).first()
    if not user:
        return jsonify({'error': 'Invalid token'}), 404

    if category == 'all':
        user.email_notifications = True

        pref = NotificationPreference.query.filter_by(user_id=user.id).first()
        if pref:
            pref.email_enabled = True

        db.session.commit()
        logger.info(f"User {user.id} resubscribed to ALL email notifications")
        return jsonify({
            'message': 'You have been resubscribed to email notifications.',
            'category': 'all'
        }), 200
    else:
        pref = NotificationPreference.query.filter_by(user_id=user.id).first()
        if not pref:
            pref = NotificationPreference(user_id=user.id)
            db.session.add(pref)

        settings = pref.category_settings or {}
        settings[category] = True
        pref.category_settings = settings
        db.session.commit()

        logger.info(f"User {user.id} resubscribed to '{category}' emails")
        return jsonify({
            'message': f'You have been resubscribed to {category} notifications.',
            'category': category
        }), 200


@email_bp.route('/preferences', methods=['PUT'])
@jwt_required()
def update_email_preferences():
    """
    Authenticated endpoint — update multiple email preferences at once.
    
    Body: {
        "email_notifications": true/false,
        "marketing_emails": true/false,
        "weekly_digest": true/false,
        "category_settings": { "grades": true, "forum": false, ... }
    }
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json(silent=True) or {}

    if 'email_notifications' in data:
        user.email_notifications = bool(data['email_notifications'])
    if 'marketing_emails' in data:
        user.marketing_emails = bool(data['marketing_emails'])
    if 'weekly_digest' in data:
        user.weekly_digest = bool(data['weekly_digest'])

    if 'category_settings' in data and isinstance(data['category_settings'], dict):
        pref = NotificationPreference.query.filter_by(user_id=user.id).first()
        if not pref:
            pref = NotificationPreference(user_id=user.id)
            db.session.add(pref)
        
        settings = pref.category_settings or {}
        allowed = {'announcements', 'grades', 'forum', 'enrollment', 'achievement', 'system'}
        for cat, enabled in data['category_settings'].items():
            if cat in allowed:
                settings[cat] = bool(enabled)
        pref.category_settings = settings

    db.session.commit()
    return jsonify({'message': 'Email preferences updated'}), 200


def _mask_email(email: str) -> str:
    """Mask email for display: j***@gmail.com"""
    if not email or '@' not in email:
        return '***'
    local, domain = email.split('@', 1)
    if len(local) <= 2:
        masked = local[0] + '***'
    else:
        masked = local[0] + '***' + local[-1]
    return f"{masked}@{domain}"
