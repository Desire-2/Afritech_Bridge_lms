"""Administrative requests: intake, triage, assignment, resolution.

Any employee may submit a request against their own record. Coordination roles
hold ``requests.manage`` to see the whole queue, assign it and close it out.
"""

from datetime import datetime, timezone

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import AdminRequest, Employee, REQUEST_TYPES, REQUEST_STATUSES
from ..auth.auth import require_permission, require_any_permission, current_user, current_employee
from ..auth.scope import exclude_service_agents, employee_scope_error, scope_error_status
from ..services.audit import audit
from ..services.notifications import notify_employee
from .helpers import (
    json_error, parse_json, required, paginate, paginate_response,
    parse_date, parse_id,
)

bp = Blueprint('requests', __name__, url_prefix='/api/requests')

PRIORITIES = ('low', 'medium', 'high', 'urgent')
OPEN_STATUSES = ('submitted', 'in_review', 'more_info', 'forwarded')


def _manage(user):
    return user.has_permission('requests.manage')


def _scope_query(q, user):
    """Coordinators see the company queue; everyone else sees only their own."""
    if _manage(user):
        return exclude_service_agents(q, user, AdminRequest.requested_by)
    emp = current_employee()
    if emp:
        return q.filter(db.or_(
            AdminRequest.requested_by == emp.id,
            AdminRequest.assigned_to == emp.id,
        ))
    return q.filter(db.text('1 = 0'))


def _get_scoped(request_id, user):
    q = _scope_query(AdminRequest.query.filter_by(id=request_id), user)
    row = q.first()
    if not row:
        return None, json_error('Request not found', 404)
    return row, None


@bp.get('')
@require_any_permission('requests.view', 'requests.manage')
def list_requests():
    user = current_user()
    q = _scope_query(AdminRequest.query, user)
    status = request.args.get('status')
    if status:
        if status not in REQUEST_STATUSES:
            return json_error(f'Invalid status (expected one of {", ".join(REQUEST_STATUSES)})', 400)
        q = q.filter_by(status=status)
    else:
        q = q.filter(AdminRequest.status.in_(OPEN_STATUSES))
    rtype = request.args.get('type')
    if rtype:
        if rtype not in REQUEST_TYPES:
            return json_error(f'Invalid type (expected one of {", ".join(REQUEST_TYPES)})', 400)
        q = q.filter_by(type=rtype)
    priority = request.args.get('priority')
    if priority:
        if priority not in PRIORITIES:
            return json_error(f'Invalid priority (expected one of {", ".join(PRIORITIES)})', 400)
        q = q.filter_by(priority=priority)
    mine = request.args.get('mine')
    emp = current_employee()
    if mine and mine.lower() in ('1', 'true'):
        if not emp:
            return json_error('No employee profile linked to your account', 400)
        q = q.filter(AdminRequest.requested_by == emp.id)
    assigned = request.args.get('assigned_to')
    if assigned:
        assigned_id, err = parse_id(assigned, 'assigned_to')
        if err:
            return err
        q = q.filter_by(assigned_to=assigned_id)
    search = request.args.get('search')
    if search:
        like = f'%{search}%'
        q = q.filter(db.or_(AdminRequest.title.ilike(like), AdminRequest.description.ilike(like)))
    p = paginate(q.order_by(AdminRequest.priority.desc(), AdminRequest.created_at.desc()))
    return paginate_response([r.to_dict() for r in p.items], p)


@bp.get('/stale')
@require_permission('requests.manage')
def stale_requests():
    """Requests that have sat unresolved for more than two days."""
    rows = _scope_query(AdminRequest.query, current_user()).filter(
        AdminRequest.status.in_(OPEN_STATUSES)).order_by(AdminRequest.created_at.asc()).all()
    items = [r.to_dict() for r in rows if r.is_stale]
    return jsonify({'items': items, 'total': len(items)})


@bp.post('')
@require_any_permission('requests.view', 'requests.manage')
def create_request():
    data = parse_json()
    missing = required(data, 'title')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    user = current_user()
    emp = current_employee()
    if not emp:
        return json_error('No employee profile linked to your account', 400)

    requested_by, err = parse_id(data.get('requested_by') or emp.id, 'requested_by')
    if err:
        return err
    if requested_by != emp.id and not _manage(user):
        return json_error('You can only submit requests for yourself', 403)

    rtype = data.get('type') or 'administrative'
    if rtype not in REQUEST_TYPES:
        return json_error(f'Invalid type (expected one of {", ".join(REQUEST_TYPES)})', 400)
    priority = data.get('priority') or 'medium'
    if priority not in PRIORITIES:
        return json_error(f'Invalid priority (expected one of {", ".join(PRIORITIES)})', 400)

    start_date, err = parse_date(data.get('start_date'), 'start_date')
    if err:
        return err
    end_date, err = parse_date(data.get('end_date'), 'end_date')
    if err:
        return err
    due_date, err = parse_date(data.get('due_date'), 'due_date')
    if err:
        return err
    if start_date and end_date and end_date < start_date:
        return json_error('end_date cannot be before start_date', 400)

    row = AdminRequest(
        type=rtype, title=data['title'].strip(), description=data.get('description'),
        requested_by=requested_by, department_id=emp.department_id, status='submitted',
        priority=priority, start_date=start_date, end_date=end_date, due_date=due_date,
    )
    db.session.add(row)
    db.session.commit()
    audit('admin_request_created', 'admin_request', row.id, new_value=row.to_dict())
    return jsonify({'message': 'Request submitted', 'request': row.to_dict()}), 201


@bp.get('/<int:request_id>')
@require_any_permission('requests.view', 'requests.manage')
def get_request(request_id):
    row, err = _get_scoped(request_id, current_user())
    if err:
        return err
    return jsonify({'request': row.to_dict()})


@bp.put('/<int:request_id>')
@require_any_permission('requests.view', 'requests.manage')
def update_request(request_id):
    row, err = _get_scoped(request_id, current_user())
    if err:
        return err
    data = parse_json()
    user = current_user()
    emp = current_employee()
    is_requester = emp and row.requested_by == emp.id
    # Closing a request is a coordinator decision; the requester may only
    # withdraw it back to submitted.
    if 'status' in data and not _manage(user):
        if not is_requester or data['status'] != 'submitted':
            return json_error('You do not have permission to change this request', 403)
        if row.status in ('approved', 'rejected', 'closed'):
            return json_error(f'Request is already {row.status}', 409)

    prev = row.to_dict()
    for field in ('title', 'description', 'type', 'priority', 'status', 'resolution'):
        if field not in data:
            continue
        value = data[field]
        if field == 'type' and value not in REQUEST_TYPES:
            return json_error(f'Invalid type (expected one of {", ".join(REQUEST_TYPES)})', 400)
        if field == 'priority' and value not in PRIORITIES:
            return json_error(f'Invalid priority (expected one of {", ".join(PRIORITIES)})', 400)
        if field == 'status' and value not in REQUEST_STATUSES:
            return json_error(f'Invalid status (expected one of {", ".join(REQUEST_STATUSES)})', 400)
        setattr(row, field, value)

    if 'assigned_to' in data:
        if not _manage(user):
            return json_error('Only a coordinator can assign a request', 403)
        assigned_to, err = parse_id(data['assigned_to'], 'assigned_to')
        if err:
            return err
        if assigned_to:
            scope_err = employee_scope_error(user, assigned_to)
            if scope_err:
                return json_error(scope_err, scope_error_status(scope_err))
            row.assigned_to = assigned_to
            row.status = 'forwarded' if row.status == 'submitted' else row.status
            assignee = Employee.query.get(assigned_to)
            if assignee:
                notify_employee(assignee, 'admin_request', f'Reassigned to you: {row.title}',
                                related_type='admin_request', related_id=row.id)
        else:
            row.assigned_to = None

    for field in ('start_date', 'end_date', 'due_date'):
        if field in data:
            parsed, err = parse_date(data[field], field)
            if err:
                return err
            setattr(row, field, parsed)
    if row.start_date and row.end_date and row.end_date < row.start_date:
        return json_error('end_date cannot be before start_date', 400)

    if row.status in ('approved', 'rejected', 'closed'):
        row.reviewed_by = user.id
        row.reviewed_at = datetime.now(timezone.utc)

    db.session.commit()
    audit('admin_request_updated', 'admin_request', row.id, prev, row.to_dict())
    return jsonify({'message': 'Request updated', 'request': row.to_dict()})


@bp.post('/<int:request_id>/resolve')
@require_permission('requests.manage')
def resolve_request(request_id):
    row, err = _get_scoped(request_id, current_user())
    if err:
        return err
    data = parse_json()
    status = data.get('status') or 'closed'
    if status not in ('approved', 'rejected', 'closed'):
        return json_error('status must be approved, rejected or closed', 400)
    if status in ('approved', 'closed') and not (data.get('resolution') or '').strip():
        return json_error('A resolution note is required to approve or close a request', 400)
    prev = row.to_dict()
    row.status = status
    row.resolution = data.get('resolution')
    row.reviewed_by = current_user().id
    row.reviewed_at = datetime.now(timezone.utc)
    db.session.commit()
    requester = Employee.query.get(row.requested_by)
    if requester:
        notify_employee(requester, 'admin_request', f'Request {status}: {row.title}',
                        related_type='admin_request', related_id=row.id)
    audit('admin_request_resolved', 'admin_request', row.id, prev, row.to_dict())
    return jsonify({'message': f'Request {status}', 'request': row.to_dict()})