"""
Notification Routes for Afritec Bridge LMS

Provides endpoints for managing user notifications including:
- Listing notifications (paginated, filterable)
- Unread count
- Mark as read / mark all read
- Delete notification
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import logging

from ..models.user_models import db
from ..models.notification_models import Notification

logger = logging.getLogger(__name__)

notification_bp = Blueprint("notification_bp", __name__, url_prefix="/api/v1/notifications")


@notification_bp.route("", methods=["GET"])
@jwt_required()
def get_notifications():
    """
    Get paginated notifications for the current user.
    
    Query params:
        page (int): Page number (default 1)
        per_page (int): Items per page (default 20, max 100)
        unread_only (bool): If 'true', only return unread notifications
        type (str): Filter by notification_type (e.g. 'ai_task_completed')
    
    Returns:
        {
            "success": true,
            "data": [ ... notification dicts ... ],
            "unread_count": 5,
            "total": 42,
            "page": 1,
            "per_page": 20,
            "pages": 3
        }
    """
    try:
        current_user_id = get_jwt_identity()
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        unread_only = request.args.get('unread_only', 'false').lower() == 'true'
        notif_type = request.args.get('type', None)

        query = Notification.query.filter_by(user_id=current_user_id)

        if unread_only:
            query = query.filter_by(is_read=False)
        if notif_type:
            query = query.filter_by(notification_type=notif_type)

        query = query.order_by(Notification.created_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        # Always include unread count (across all types)
        unread_count = Notification.query.filter_by(
            user_id=current_user_id, is_read=False
        ).count()

        return jsonify({
            "success": True,
            "data": [n.to_dict() for n in pagination.items],
            "unread_count": unread_count,
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
    """Get unread notification count for the current user (lightweight endpoint for polling)"""
    try:
        current_user_id = get_jwt_identity()
        count = Notification.query.filter_by(
            user_id=current_user_id, is_read=False
        ).count()
        return jsonify({"success": True, "unread_count": count}), 200
    except Exception as e:
        logger.error(f"Error getting unread count: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


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
    """Mark all notifications as read for the current user"""
    try:
        current_user_id = get_jwt_identity()
        updated = Notification.query.filter_by(
            user_id=current_user_id, is_read=False
        ).update({"is_read": True})
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
