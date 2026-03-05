"""
Notification Routes for Afritec Bridge LMS

Provides endpoints for managing user notifications including:
- Listing notifications (paginated, filterable by category / type)
- Unread count (overall + per-category)
- Mark as read / mark all read
- Batch delete & single delete
- Notification preferences (per-user)
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import logging

from ..models.user_models import db
from ..models.notification_models import (
    Notification,
    NotificationPreference,
    NOTIFICATION_CATEGORIES,
)

logger = logging.getLogger(__name__)

notification_bp = Blueprint("notification_bp", __name__, url_prefix="/api/v1/notifications")


# ══════════════════════════════════════════════════════════════════
#  LIST & COUNT
# ══════════════════════════════════════════════════════════════════

@notification_bp.route("", methods=["GET"])
@jwt_required()
def get_notifications():
    """
    Get paginated notifications for the current user.

    Query params:
        page (int): Page number (default 1)
        per_page (int): Items per page (default 20, max 100)
        unread_only (bool): If 'true', only return unread
        type (str): Filter by notification_type
        category (str): Filter by category (announcements, grades, forum, …)
    """
    try:
        current_user_id = get_jwt_identity()
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        unread_only = request.args.get('unread_only', 'false').lower() == 'true'
        notif_type = request.args.get('type', None)
        category = request.args.get('category', None)

        query = Notification.query.filter_by(user_id=current_user_id)

        if unread_only:
            query = query.filter_by(is_read=False)
        if notif_type:
            query = query.filter_by(notification_type=notif_type)
        if category:
            types_in_category = NOTIFICATION_CATEGORIES.get(category, [])
            if types_in_category:
                query = query.filter(Notification.notification_type.in_(types_in_category))

        query = query.order_by(Notification.created_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        # Unread count (across all types)
        unread_count = Notification.query.filter_by(
            user_id=current_user_id, is_read=False
        ).count()

        # Per-category unread counts for sidebar badges
        category_counts = {}
        for cat, types in NOTIFICATION_CATEGORIES.items():
            c = Notification.query.filter(
                Notification.user_id == current_user_id,
                Notification.is_read == False,
                Notification.notification_type.in_(types),
            ).count()
            if c > 0:
                category_counts[cat] = c

        return jsonify({
            "success": True,
            "data": [n.to_dict() for n in pagination.items],
            "unread_count": unread_count,
            "category_counts": category_counts,
            "total": pagination.total,
            "page": pagination.page,
            "per_page": pagination.per_page,
            "pages": pagination.pages,
        }), 200

    except Exception as e:
        logger.error(f"Error fetching notifications: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@notification_bp.route("/unread-count", methods=["GET"])
@jwt_required()
def get_unread_count():
    """Lightweight endpoint — returns total + per-category unread counts."""
    try:
        current_user_id = get_jwt_identity()
        total = Notification.query.filter_by(
            user_id=current_user_id, is_read=False
        ).count()

        category_counts = {}
        for cat, types in NOTIFICATION_CATEGORIES.items():
            c = Notification.query.filter(
                Notification.user_id == current_user_id,
                Notification.is_read == False,
                Notification.notification_type.in_(types),
            ).count()
            if c > 0:
                category_counts[cat] = c

        return jsonify({
            "success": True,
            "unread_count": total,
            "category_counts": category_counts,
        }), 200
    except Exception as e:
        logger.error(f"Error getting unread count: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ══════════════════════════════════════════════════════════════════
#  READ / MARK-READ
# ══════════════════════════════════════════════════════════════════

@notification_bp.route("/<int:notification_id>/read", methods=["PATCH"])
@jwt_required()
def mark_as_read(notification_id):
    """Mark a single notification as read"""
    try:
        current_user_id = get_jwt_identity()
        notification = Notification.query.filter_by(
            id=notification_id, user_id=current_user_id
        ).first()

        if not notification:
            return jsonify({"success": False, "message": "Notification not found"}), 404

        notification.is_read = True
        db.session.commit()
        return jsonify({"success": True, "data": notification.to_dict()}), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error marking notification as read: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@notification_bp.route("/mark-all-read", methods=["PATCH"])
@jwt_required()
def mark_all_read():
    """Mark all notifications as read. Optionally restrict to a category."""
    try:
        current_user_id = get_jwt_identity()
        category = request.args.get('category', None)

        query = Notification.query.filter_by(user_id=current_user_id, is_read=False)
        if category:
            types_in_category = NOTIFICATION_CATEGORIES.get(category, [])
            if types_in_category:
                query = query.filter(Notification.notification_type.in_(types_in_category))

        updated = query.update({"is_read": True}, synchronize_session='fetch')
        db.session.commit()
        return jsonify({
            "success": True,
            "message": f"Marked {updated} notification(s) as read",
            "updated_count": updated,
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error marking all notifications as read: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ══════════════════════════════════════════════════════════════════
#  DELETE
# ══════════════════════════════════════════════════════════════════

@notification_bp.route("/<int:notification_id>", methods=["DELETE"])
@jwt_required()
def delete_notification(notification_id):
    """Delete a notification"""
    try:
        current_user_id = get_jwt_identity()
        notification = Notification.query.filter_by(
            id=notification_id, user_id=current_user_id
        ).first()

        if not notification:
            return jsonify({"success": False, "message": "Notification not found"}), 404

        db.session.delete(notification)
        db.session.commit()
        return jsonify({"success": True, "message": "Notification deleted"}), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting notification: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@notification_bp.route("/batch-delete", methods=["POST"])
@jwt_required()
def batch_delete():
    """Delete multiple notifications by IDs."""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json() or {}
        ids = data.get('ids', [])
        if not ids:
            return jsonify({"success": False, "message": "No IDs provided"}), 400

        deleted = Notification.query.filter(
            Notification.id.in_(ids),
            Notification.user_id == current_user_id,
        ).delete(synchronize_session='fetch')
        db.session.commit()
        return jsonify({"success": True, "deleted_count": deleted}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error batch-deleting notifications: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@notification_bp.route("/clear-all", methods=["DELETE"])
@jwt_required()
def clear_all():
    """Delete all read notifications for current user (keeps unread)."""
    try:
        current_user_id = get_jwt_identity()
        deleted = Notification.query.filter_by(
            user_id=current_user_id, is_read=True
        ).delete()
        db.session.commit()
        return jsonify({"success": True, "deleted_count": deleted}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error clearing notifications: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ══════════════════════════════════════════════════════════════════
#  PREFERENCES
# ══════════════════════════════════════════════════════════════════

@notification_bp.route("/preferences", methods=["GET"])
@jwt_required()
def get_preferences():
    """Get current user's notification preferences."""
    try:
        current_user_id = get_jwt_identity()
        pref = NotificationPreference.query.filter_by(user_id=current_user_id).first()
        if not pref:
            # Return defaults
            return jsonify({
                "success": True,
                "data": {
                    "user_id": current_user_id,
                    "category_settings": {},
                    "in_app_enabled": True,
                    "email_enabled": True,
                    "quiet_start_hour": None,
                    "quiet_end_hour": None,
                },
                "available_categories": list(NOTIFICATION_CATEGORIES.keys()),
            }), 200

        return jsonify({
            "success": True,
            "data": pref.to_dict(),
            "available_categories": list(NOTIFICATION_CATEGORIES.keys()),
        }), 200
    except Exception as e:
        logger.error(f"Error fetching preferences: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@notification_bp.route("/preferences", methods=["PUT"])
@jwt_required()
def update_preferences():
    """Create or update notification preferences."""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json() or {}

        pref = NotificationPreference.query.filter_by(user_id=current_user_id).first()
        if not pref:
            pref = NotificationPreference(user_id=current_user_id)
            db.session.add(pref)

        if 'category_settings' in data:
            pref.category_settings = data['category_settings']
        if 'in_app_enabled' in data:
            pref.in_app_enabled = bool(data['in_app_enabled'])
        if 'email_enabled' in data:
            pref.email_enabled = bool(data['email_enabled'])
        if 'quiet_start_hour' in data:
            pref.quiet_start_hour = data['quiet_start_hour']
        if 'quiet_end_hour' in data:
            pref.quiet_end_hour = data['quiet_end_hour']

        db.session.commit()
        return jsonify({"success": True, "data": pref.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating preferences: {e}")
        return jsonify({"success": False, "message": str(e)}), 500
