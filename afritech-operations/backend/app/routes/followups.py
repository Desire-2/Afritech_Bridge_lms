"""Follow-ups: what the office promised an employee, and whether it happened.

A follow-up tracks one employee against an optional task, with the last action
taken and the next date a check is due. Overdue follow-ups are surfaced
separately so the Secretary can work the list.
"""

from datetime import date, datetime, timezone

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import FollowUp, Employee, FOLLOWUP_STATUSES, Task
from ..auth.auth import require_permission, require_any_permission, current_user, current_employee
from ..auth.scope import employee_scope_error, exclude_service_agents, scope_error_status
from ..services.audit import audit
from ..services.notifications import notify_employee
from .helpers import (
    json_error, parse_json, required, paginate, paginate_response,
    parse_date, parse_id,
)

bp = Blueprint('followups', __name__, url_prefix='/api/follow-ups')

PRIORITIES = ('low', 'medium', 'high', 'urgent')


def _scope_query(q, user):
    if user.has_permission('followups.manage'):
        return exclude_service_agents(q, user, FollowUp.employee_id)
    emp = current_employee()
    if emp:
        return q.filter_by(employee_id=emp.id)
    return q.filter(db.text('1 = 0'))


def _get_scoped(followup_id, user):
    row = _scope_query(FollowUp.query.filter_by(id=followup_id), user).first()
    if not row:
        return None, json_error('Follow-up not found', 404)
    return row, None


@bp.get('')
@require_any_permission('followups.view', 'followups.manage')
def list_followups():
    user = current_user()
    q = _scope_query(FollowUp.query, user)
    status = request.args.get('status')
    if status:
        if status not in FOLLOWUP_STATUSES:
            return json_error(f'Invalid status (expected one of {", ".join(FOLLOWUP_STATUSES)})', 400)
        q = q.filter_by(status=status)
    else:
        q = q.filter(FollowUp.status.notin_(('done', 'cancelled')))
    priority = request.args.get('priority')
    if priority:
        if priority not in PRIORITIES:
            return json_error(f'Invalid priority (expected one of {", ".join(PRIORITIES)})', 400)
        q = q.filter_by(priority=priority)
    employee_id, err = parse_id(request.args.get('employee_id'), 'employee_id')
    if err:
        return err
    if employee_id:
        scope_err = employee_scope_error(user, employee_id)
        if scope_err:
            return json_error(scope_err, scope_error_status(scope_err))
        q = q.filter_by(employee_id=employee_id)
    search = request.args.get('search')
    if search:
        like = f'%{search}%'
        q = q.filter(db.or_(FollowUp.subject.ilike(like), FollowUp.notes.ilike(like)))
    p = paginate(q.order_by(FollowUp.next_follow_up.is_(None),
                            FollowUp.next_follow_up.asc(), FollowUp.created_at.desc()))
    items = [f.to_dict() for f in p.items]
    if request.args.get('overdue_only', '').lower() in ('1', 'true'):
        items = [i for i in items if i['is_overdue']]
    return paginate_response(items, p)


@bp.get('/overdue')
@require_any_permission('followups.view', 'followups.manage')
def overdue_followups():
    user = current_user()
    rows = _scope_query(FollowUp.query, user).filter(
        FollowUp.status.in_(('open', 'waiting')),
        FollowUp.next_follow_up.isnot(None),
        FollowUp.next_follow_up < date.today(),
    ).order_by(FollowUp.next_follow_up.asc()).all()
    items = [f.to_dict() for f in rows]
    return jsonify({'items': items, 'total': len(items)})


@bp.post('')
@require_permission('followups.manage')
def create_followup():
    data = parse_json()
    missing = required(data, 'employee_id', 'subject')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    user = current_user()
    employee_id, err = parse_id(data['employee_id'], 'employee_id')
    if err:
        return err
    scope_err = employee_scope_error(user, employee_id)
    if scope_err:
        return json_error(scope_err, scope_error_status(scope_err))

    task_id, err = parse_id(data.get('task_id'), 'task_id')
    if err:
        return err
    if task_id and not Task.query.get(task_id):
        return json_error('Task not found', 404)

    priority = data.get('priority') or 'medium'
    if priority not in PRIORITIES:
        return json_error(f'Invalid priority (expected one of {", ".join(PRIORITIES)})', 400)
    next_follow_up, err = parse_date(data.get('next_follow_up'), 'next_follow_up')
    if err:
        return err
    deadline, err = parse_date(data.get('deadline'), 'deadline')
    if err:
        return err

    row = FollowUp(
        employee_id=employee_id, task_id=task_id, subject=data['subject'].strip(),
        notes=data.get('notes'), next_follow_up=next_follow_up, deadline=deadline,
        status=data.get('status') or 'open', priority=priority,
        last_action=data.get('last_action'), created_by=user.id,
    )
    db.session.add(row)
    db.session.commit()
    audit('followup_created', 'followup', row.id, new_value=row.to_dict())
    return jsonify({'message': 'Follow-up created', 'follow_up': row.to_dict()}), 201


@bp.get('/<int:followup_id>')
@require_any_permission('followups.view', 'followups.manage')
def get_followup(followup_id):
    row, err = _get_scoped(followup_id, current_user())
    if err:
        return err
    return jsonify({'follow_up': row.to_dict()})


@bp.put('/<int:followup_id>')
@require_permission('followups.manage')
def update_followup(followup_id):
    row, err = _get_scoped(followup_id, current_user())
    if err:
        return err
    data = parse_json()
    prev = row.to_dict()
    for field in ('subject', 'notes', 'last_action'):
        if field in data:
            setattr(row, field, data[field])
    if 'status' in data:
        if data['status'] not in FOLLOWUP_STATUSES:
            return json_error(f'Invalid status (expected one of {", ".join(FOLLOWUP_STATUSES)})', 400)
        row.status = data['status']
    if 'priority' in data:
        if data['priority'] not in PRIORITIES:
            return json_error(f'Invalid priority (expected one of {", ".join(PRIORITIES)})', 400)
        row.priority = data['priority']
    for field in ('next_follow_up', 'deadline'):
        if field in data:
            parsed, err = parse_date(data[field], field)
            if err:
                return err
            setattr(row, field, parsed)
    if 'task_id' in data:
        task_id, err = parse_id(data['task_id'], 'task_id')
        if err:
            return err
        if task_id and not Task.query.get(task_id):
            return json_error('Task not found', 404)
        row.task_id = task_id
    # Any edit is progress, so stamp the clock.
    row.last_update = datetime.now(timezone.utc)

    db.session.commit()
    audit('followup_updated', 'followup', row.id, prev, row.to_dict())
    return jsonify({'message': 'Follow-up updated', 'follow_up': row.to_dict()})


@bp.post('/<int:followup_id>/progress')
@require_permission('followups.manage')
def record_progress(followup_id):
    """Log what was actually done and when to check back."""
    row, err = _get_scoped(followup_id, current_user())
    if err:
        return err
    data = parse_json()
    missing = required(data, 'last_action')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    next_follow_up, err = parse_date(data.get('next_follow_up'), 'next_follow_up')
    if err:
        return err
    prev = row.to_dict()
    row.last_action = data['last_action'].strip()
    row.last_update = datetime.now(timezone.utc)
    if next_follow_up:
        row.next_follow_up = next_follow_up
    if data.get('status'):
        if data['status'] not in FOLLOWUP_STATUSES:
            return json_error(f'Invalid status (expected one of {", ".join(FOLLOWUP_STATUSES)})', 400)
        row.status = data['status']
    db.session.commit()
    if row.status not in ('done', 'cancelled'):
        emp = Employee.query.get(row.employee_id)
        if emp:
            notify_employee(emp, 'followup', f'Update on your follow-up: {row.subject}',
                            related_type='followup', related_id=row.id)
    audit('followup_progress_recorded', 'followup', row.id, prev, row.to_dict())
    return jsonify({'message': 'Progress recorded', 'follow_up': row.to_dict()})