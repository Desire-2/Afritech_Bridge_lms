from datetime import datetime, timezone

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import Notification
from ..auth.auth import require_auth, current_user
from ..services.notifications import preferences_to_dict, set_preferences
from .helpers import paginate, paginate_response, json_error, parse_json

bp = Blueprint('notifications', __name__, url_prefix='/api/notifications')


@bp.get('')
@require_auth
def list_notifications():
    user = current_user()
    q = Notification.query.filter_by(recipient_id=user.id)
    unread_only = request.args.get('unread_only')
    if unread_only == 'true':
        q = q.filter_by(is_read=False)
    severity = request.args.get('severity')
    if severity:
        q = q.filter_by(severity=severity)
    q = q.order_by(Notification.created_at.desc())
    p = paginate(q)
    return paginate_response([n.to_dict() for n in p.items], p)


@bp.get('/unread-count')
@require_auth
def unread_count():
    user = current_user()
    count = Notification.query.filter_by(recipient_id=user.id, is_read=False).count()
    return jsonify({'unread': count})


@bp.get('/preferences')
@require_auth
def get_preferences():
    user = current_user()
    return jsonify(preferences_to_dict(user))


@bp.put('/preferences')
@require_auth
def update_preferences():
    user = current_user()
    payload = parse_json()
    set_preferences(user, payload)
    db.session.commit()
    return jsonify(preferences_to_dict(user))


@bp.post('/<int:notification_id>/read')
@require_auth
def mark_read(notification_id):
    user = current_user()
    n = Notification.query.filter_by(id=notification_id, recipient_id=user.id).first()
    if not n:
        return json_error('Notification not found', 404)
    n.is_read = True
    n.read_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({'notification': n.to_dict()})


@bp.post('/read-all')
@require_auth
def mark_all_read():
    user = current_user()
    Notification.query.filter_by(recipient_id=user.id, is_read=False).update({'is_read': True})
    db.session.commit()
    return jsonify({'message': 'All notifications marked read'})