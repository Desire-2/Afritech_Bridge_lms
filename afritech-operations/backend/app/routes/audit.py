from flask import Blueprint, request, jsonify

from ..models import AuditLog
from ..auth.auth import require_permission, current_user
from .helpers import paginate, paginate_response

bp = Blueprint('audit', __name__, url_prefix='/api/audit')


@bp.get('')
@require_permission('audit.view')
def list_audit():
    user = current_user()
    if not user.has_permission('audit.view') and not user.is_super_admin:
        return jsonify({'error': 'You do not have permission'}), 403
    q = AuditLog.query
    action = request.args.get('action')
    entity = request.args.get('entity')
    user_id = request.args.get('user_id', type=int)
    if action:
        q = q.filter_by(action=action)
    if entity:
        q = q.filter_by(entity=entity)
    if user_id:
        q = q.filter_by(user_id=user_id)
    p = paginate(q.order_by(AuditLog.created_at.desc()))
    return paginate_response([a.to_dict() for a in p.items], p)


@bp.get('/actions')
@require_permission('audit.view')
def list_actions():
    actions = [r[0] for r in AuditLog.query.with_entities(AuditLog.action).distinct().order_by(AuditLog.action).all()]
    return jsonify({'actions': actions})