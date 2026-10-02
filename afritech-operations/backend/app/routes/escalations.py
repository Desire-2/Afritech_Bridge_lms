"""Escalations: raising a blocked administrative matter up the chain.

An escalation records what went wrong, who it is going to and why, and closes
with a resolution. Service Agents are out of scope for coordinators, so an
escalation cannot be attached to their records.
"""

from datetime import datetime, timezone

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import Escalation, Employee, Role, User, ESCALATION_STATUSES
from ..auth.auth import require_permission, require_any_permission, current_user
from ..services.audit import audit
from ..services.notifications import notify
from .helpers import (
    json_error, parse_json, required, paginate, paginate_response, parse_id,
)

bp = Blueprint('escalations', __name__, url_prefix='/api/escalations')

PRIORITIES = ('low', 'medium', 'high', 'urgent')
ESCALATE_TO = ('manager', 'super_admin')
RELATED_TYPES = ('request', 'task', 'meeting', 'follow_up', 'announcement', 'memo', 'employee', 'other')


@bp.get('')
@require_any_permission('escalations.view', 'escalations.manage')
def list_escalations():
    user = current_user()
    q = Escalation.query
    if not user.has_permission('escalations.manage'):
        # Non-coordinators only see what they raised or were handed.
        q = q.filter(db.or_(
            Escalation.created_by == user.id,
            Escalation.assigned_to == user.id,
        ))
    status = request.args.get('status')
    if status:
        if status not in ESCALATION_STATUSES:
            return json_error(f'Invalid status (expected one of {", ".join(ESCALATION_STATUSES)})', 400)
        q = q.filter_by(status=status)
    else:
        q = q.filter(Escalation.status.in_(('created', 'assigned')))
    priority = request.args.get('priority')
    if priority:
        if priority not in PRIORITIES:
            return json_error(f'Invalid priority (expected one of {", ".join(PRIORITIES)})', 400)
        q = q.filter_by(priority=priority)
    related_type = request.args.get('related_type')
    if related_type:
        q = q.filter_by(related_type=related_type)
    search = request.args.get('search')
    if search:
        like = f'%{search}%'
        q = q.filter(db.or_(Escalation.subject.ilike(like), Escalation.issue.ilike(like)))
    p = paginate(q.order_by(Escalation.priority.desc(), Escalation.created_at.desc()))
    return paginate_response([e.to_dict() for e in p.items], p)


@bp.post('')
@require_any_permission('escalations.view', 'escalations.manage')
def create_escalation():
    data = parse_json()
    missing = required(data, 'subject', 'issue')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    escalate_to = data.get('escalate_to') or 'manager'
    if escalate_to not in ESCALATE_TO:
        return json_error(f'Invalid escalate_to (expected one of {", ".join(ESCALATE_TO)})', 400)
    priority = data.get('priority') or 'high'
    if priority not in PRIORITIES:
        return json_error(f'Invalid priority (expected one of {", ".join(PRIORITIES)})', 400)
    related_type = data.get('related_type')
    if related_type and related_type not in RELATED_TYPES:
        return json_error(f'Invalid related_type (expected one of {", ".join(RELATED_TYPES)})', 400)

    assigned_to, err = parse_id(data.get('assigned_to'), 'assigned_to')
    if err:
        return err
    if assigned_to and not User.query.get(assigned_to):
        return json_error('Assigned user not found', 404)
    related_id, err = parse_id(data.get('related_id'), 'related_id')
    if err:
        return err

    row = Escalation(
        subject=data['subject'].strip(), issue=data['issue'], reason=data.get('reason'),
        escalate_to=escalate_to, assigned_to=assigned_to, priority=priority,
        related_type=related_type, related_id=related_id, status='created',
        created_by=current_user().id,
    )
    db.session.add(row)
    db.session.commit()
    audit('escalation_created', 'escalation', row.id, new_value=row.to_dict())
    return jsonify({'message': 'Escalation raised', 'escalation': row.to_dict()}), 201


@bp.get('/<int:escalation_id>')
@require_any_permission('escalations.view', 'escalations.manage')
def get_escalation(escalation_id):
    row = Escalation.query.get(escalation_id)
    if not row:
        return json_error('Escalation not found', 404)
    user = current_user()
    if not user.has_permission('escalations.manage') \
            and row.created_by != user.id and row.assigned_to != user.id:
        return json_error('Escalation not found', 404)
    return jsonify({'escalation': row.to_dict()})


@bp.put('/<int:escalation_id>')
@require_permission('escalations.manage')
def update_escalation(escalation_id):
    row = Escalation.query.get(escalation_id)
    if not row:
        return json_error('Escalation not found', 404)
    data = parse_json()
    prev = row.to_dict()
    for field in ('subject', 'issue', 'reason'):
        if field in data:
            setattr(row, field, data[field])
    if 'escalate_to' in data:
        if data['escalate_to'] not in ESCALATE_TO:
            return json_error(f'Invalid escalate_to (expected one of {", ".join(ESCALATE_TO)})', 400)
        row.escalate_to = data['escalate_to']
    if 'priority' in data:
        if data['priority'] not in PRIORITIES:
            return json_error(f'Invalid priority (expected one of {", ".join(PRIORITIES)})', 400)
        row.priority = data['priority']
    if 'assigned_to' in data:
        assigned_to, err = parse_id(data['assigned_to'], 'assigned_to')
        if err:
            return err
        if assigned_to and not User.query.get(assigned_to):
            return json_error('Assigned user not found', 404)
        row.assigned_to = assigned_to
        if assigned_to and row.status == 'created':
            row.status = 'assigned'
            notify(assigned_to, 'escalation', f'Escalated to you: {row.subject}',
                   'high', 'escalation', row.id)
    if 'status' in data:
        if data['status'] not in ESCALATION_STATUSES:
            return json_error(f'Invalid status (expected one of {", ".join(ESCALATION_STATUSES)})', 400)
        if data['status'] == 'resolved' and not (data.get('resolution') or row.resolution or '').strip():
            return json_error('A resolution note is required to resolve an escalation', 400)
        row.status = data['status']
        if data['status'] == 'resolved':
            row.resolved_at = datetime.now(timezone.utc)
            if data.get('resolution') is not None:
                row.resolution = data['resolution']
        else:
            row.resolved_at = None
    if 'resolution' in data:
        row.resolution = data['resolution']

    db.session.commit()
    audit('escalation_updated', 'escalation', row.id, prev, row.to_dict())
    return jsonify({'message': 'Escalation updated', 'escalation': row.to_dict()})


@bp.post('/<int:escalation_id>/resolve')
@require_permission('escalations.manage')
def resolve_escalation(escalation_id):
    row = Escalation.query.get(escalation_id)
    if not row:
        return json_error('Escalation not found', 404)
    data = parse_json()
    resolution = (data.get('resolution') or '').strip()
    if not resolution:
        return json_error('A resolution note is required', 400)
    if row.status == 'resolved':
        return json_error('Escalation is already resolved', 409)
    prev = row.to_dict()
    row.resolution = resolution
    row.status = 'resolved'
    row.resolved_at = datetime.now(timezone.utc)
    db.session.commit()
    if row.created_by:
        notify(row.created_by, 'escalation', f'Escalation resolved: {row.subject}',
               'info', 'escalation', row.id)
    audit('escalation_resolved', 'escalation', row.id, prev, row.to_dict())
    return jsonify({'message': 'Escalation resolved', 'escalation': row.to_dict()})