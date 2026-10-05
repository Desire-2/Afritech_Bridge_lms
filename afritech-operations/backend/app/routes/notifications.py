from datetime import datetime, timezone

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import Notification
from ..auth.auth import require_auth, require_permission, current_user
from ..services.notifications import (
    apply_visibility, preferences_to_dict, set_preferences,
)
from .helpers import paginate_response, json_error, parse_json

bp = Blueprint('notifications', __name__, url_prefix='/api/notifications')

# Hard ceiling on history pages: the feed is always paged, never loaded whole.
MAX_PER_PAGE = 100
DEFAULT_PER_PAGE = 50


def _visible_query(user):
    """Own notifications, filtered by the same rules that gate `notify()`."""
    return apply_visibility(Notification.query.filter_by(recipient_id=user.id), user)


@bp.get('')
@require_permission('notifications.view')
def list_notifications():
    user = current_user()
    q = _visible_query(user)
    unread_only = request.args.get('unread_only')
    if unread_only == 'true':
        q = q.filter_by(is_read=False)
    severity = request.args.get('severity')
    if severity:
        q = q.filter_by(severity=severity)
    q = q.order_by(Notification.created_at.desc())
    page, per_page = _page_args()
    p = q.paginate(page=page, per_page=per_page, error_out=False)
    return paginate_response([n.to_dict() for n in p.items], p)


def _page_args():
    page = request.args.get('page', 1, type=int) or 1
    per_page = request.args.get('per_page', DEFAULT_PER_PAGE, type=int) or DEFAULT_PER_PAGE
    return max(page, 1), min(max(per_page, 1), MAX_PER_PAGE)


@bp.get('/unread-count')
@require_auth
def unread_count():
    user = current_user()
    # Permission-filtered: a badge never counts a row the user may not see.
    count = _visible_query(user).filter_by(is_read=False).count()
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
    n = _visible_query(user).filter_by(id=notification_id).first()
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
    _visible_query(user).filter_by(is_read=False).update({'is_read': True})
    db.session.commit()
    return jsonify({'message': 'All notifications marked read'})
