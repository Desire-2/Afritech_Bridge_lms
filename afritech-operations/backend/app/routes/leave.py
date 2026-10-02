"""Leave coordination.

Any employee may request leave and see their own. Roles holding
``leave.manage`` (the Company Secretary) see the company queue, excluding
Service Agents, and move a request through
``pending -> in_review -> forwarded -> approved | rejected``.

Leave sits next to payroll, so nothing here may expose pay: the response
carries dates, type and status only. For the same reason a request stops being
editable the moment it is approved or rejected — the approved row is what
payroll reads, so it is frozen rather than amended after the fact. Approving and
rejecting happen only in ``POST /<id>/decision``, which is also where the rules
that come with a decision (a note on rejection, and the subsequent freeze) are
enforced.
"""

from datetime import date, datetime, timezone

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import Employee, LeaveRequest
from ..auth.auth import require_permission, require_any_permission, current_user, current_employee
from ..auth.scope import exclude_service_agents
from ..services.audit import audit
from ..services.notifications import notify_employee
from .helpers import (
    json_error, parse_json, required, paginate, paginate_response,
    parse_date, parse_id,
)

bp = Blueprint('leave', __name__, url_prefix='/api/leave')

LEAVE_TYPES = ('annual', 'sick', 'unpaid', 'other')
STATUSES = ('pending', 'in_review', 'forwarded', 'approved', 'rejected')
# Statuses reachable only through ``POST /<id>/decision``, never through a
# plain update — they carry decision rules and freeze the row.
DECISION_STATUSES = ('approved', 'rejected')


def _manage(user):
    return user.has_permission('leave.manage')


def _scope_query(q, user):
    if _manage(user):
        return exclude_service_agents(q, user, LeaveRequest.employee_id)
    emp = current_employee()
    if emp:
        return q.filter_by(employee_id=emp.id)
    return q.filter(db.text('1 = 0'))


def _get_scoped(leave_id, user):
    row = _scope_query(LeaveRequest.query.filter_by(id=leave_id), user).first()
    if not row:
        return None, json_error('Leave request not found', 404)
    return row, None


@bp.get('')
@require_any_permission('leave.view', 'leave.manage')
def list_leave_requests():
    user = current_user()
    q = _scope_query(LeaveRequest.query, user)
    status = request.args.get('status')
    if status:
        if status not in STATUSES:
            return json_error(f'Invalid status (expected one of {", ".join(STATUSES)})', 400)
        q = q.filter_by(status=status)
    leave_type = request.args.get('type')
    if leave_type:
        if leave_type not in LEAVE_TYPES:
            return json_error(f'Invalid type (expected one of {", ".join(LEAVE_TYPES)})', 400)
        q = q.filter_by(leave_type=leave_type)
    employee_id, err = parse_id(request.args.get('employee_id'), 'employee_id')
    if err:
        return err
    if employee_id:
        q = q.filter_by(employee_id=employee_id)
    start, err = parse_date(request.args.get('start'), 'start')
    if err:
        return err
    if start:
        q = q.filter(LeaveRequest.end_date >= start)
    end, err = parse_date(request.args.get('end'), 'end')
    if err:
        return err
    if end:
        q = q.filter(LeaveRequest.start_date <= end)
    p = paginate(q.order_by(LeaveRequest.start_date.desc()))
    return paginate_response([lv.to_dict() for lv in p.items], p)


@bp.get('/pending')
@require_permission('leave.manage')
def pending_leave_requests():
    rows = _scope_query(LeaveRequest.query, current_user()).filter(
        LeaveRequest.status.in_(('pending', 'in_review', 'forwarded'))
    ).order_by(LeaveRequest.start_date.asc()).all()
    items = [lv.to_dict() for lv in rows]
    return jsonify({'items': items, 'total': len(items)})


@bp.post('')
@require_any_permission('leave.view', 'leave.manage')
def create_leave_request():
    data = parse_json()
    missing = required(data, 'leave_type', 'start_date', 'end_date')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    user = current_user()
    emp = current_employee()
    if not emp:
        return json_error('No employee profile linked to your account', 400)

    employee_id, err = parse_id(data.get('employee_id') or emp.id, 'employee_id')
    if err:
        return err
    if employee_id != emp.id and not _manage(user):
        return json_error('You can only request leave for yourself', 403)

    leave_type = data['leave_type']
    if leave_type not in LEAVE_TYPES:
        return json_error(f'Invalid leave_type (expected one of {", ".join(LEAVE_TYPES)})', 400)
    start_date, err = parse_date(data['start_date'], 'start_date')
    if err:
        return err
    end_date, err = parse_date(data['end_date'], 'end_date')
    if err:
        return err
    if end_date < start_date:
        return json_error('end_date cannot be before start_date', 400)
    if end_date < date.today():
        return json_error('Leave cannot end in the past', 400)

    row = LeaveRequest(
        employee_id=employee_id, leave_type=leave_type, start_date=start_date,
        end_date=end_date, reason=data.get('reason'),
        status='pending' if employee_id == emp.id else 'forwarded',
        note=data.get('note') if _manage(user) else None,
    )
    db.session.add(row)
    db.session.commit()
    audit('leave_requested', 'leave_request', row.id, new_value=row.to_dict())
    return jsonify({'message': 'Leave requested', 'leave_request': row.to_dict()}), 201


@bp.get('/<int:leave_id>')
@require_any_permission('leave.view', 'leave.manage')
def get_leave_request(leave_id):
    row, err = _get_scoped(leave_id, current_user())
    if err:
        return err
    return jsonify({'leave_request': row.to_dict()})


@bp.put('/<int:leave_id>')
@require_any_permission('leave.view', 'leave.manage')
def update_leave_request(leave_id):
    row, err = _get_scoped(leave_id, current_user())
    if err:
        return err
    data = parse_json()
    user = current_user()
    emp = current_employee()
    is_owner = emp and row.employee_id == emp.id

    # A decided request is frozen for good, whoever asks. Payroll reads the
    # approved row, so letting a manager quietly amend the dates or reason
    # after the fact would rewrite the record the books were built from. The
    # only way past a decision is to cancel and file a fresh request.
    if row.status in ('approved', 'rejected'):
        return json_error(f'Leave request is already {row.status}', 409)

    if 'status' in data:
        if data['status'] not in STATUSES:
            return json_error(f'Invalid status (expected one of {", ".join(STATUSES)})', 400)
        if not _manage(user):
            # The owner may withdraw, nobody else moves the state.
            if not is_owner or data['status'] != 'pending':
                return json_error('You do not have permission to change this leave request', 403)
        elif data['status'] in DECISION_STATUSES:
            # Approving and rejecting are decisions, not edits. Only
            # /decision may take a row there, because only it enforces the
            # rules that come with a decision — a note is mandatory on
            # rejection, and the row is frozen afterwards. Accepting
            # {'status': 'rejected'} here would let that rule be skipped.
            return json_error(
                f'Use POST /api/leave/{leave_id}/decision to approve or reject leave', 409)

    prev = row.to_dict()
    if _manage(user):
        for field in ('leave_type', 'reason', 'note'):
            if field in data:
                if field == 'leave_type' and data[field] not in LEAVE_TYPES:
                    return json_error(f'Invalid leave_type (expected one of {", ".join(LEAVE_TYPES)})', 400)
                setattr(row, field, data[field])
    elif is_owner:
        if 'reason' in data:
            row.reason = data['reason']

    for field in ('start_date', 'end_date'):
        if field in data and (_manage(user) or is_owner):
            parsed, err = parse_date(data[field], field)
            if err:
                return err
            setattr(row, field, parsed)
    # A single-day request (start == end) is legitimate, so only a reversed
    # range is an error.
    if row.end_date < row.start_date:
        return json_error('end_date cannot be before start_date', 400)

    if 'status' in data:
        # Decision statuses were refused above, so this only ever moves a row
        # through the review workflow; approved_by stays None.
        row.status = data['status']
    else:
        row.approved_by = None
        row.approved_at = None

    db.session.commit()
    if prev['status'] != row.status:
        owner = Employee.query.get(row.employee_id)
        if owner:
            notify_employee(owner, 'leave_request', f'Leave request {row.status}',
                            related_type='leave_request', related_id=row.id)
    audit('leave_request_updated', 'leave_request', row.id, prev, row.to_dict())
    return jsonify({'message': 'Leave request updated', 'leave_request': row.to_dict()})


@bp.post('/<int:leave_id>/decision')
@require_permission('leave.manage')
def decide_leave_request(leave_id):
    row, err = _get_scoped(leave_id, current_user())
    if err:
        return err
    data = parse_json()
    decision = data.get('decision')
    if decision not in ('approved', 'rejected'):
        return json_error('decision must be approved or rejected', 400)
    if row.status in ('approved', 'rejected'):
        return json_error(f'Leave request is already {row.status}', 409)
    if decision == 'rejected' and not (data.get('note') or '').strip():
        return json_error('A note is required when rejecting leave', 400)
    prev = row.to_dict()
    row.status = decision
    row.note = data.get('note')
    row.approved_by = current_user().id
    row.approved_at = datetime.now(timezone.utc)
    db.session.commit()
    owner = Employee.query.get(row.employee_id)
    if owner:
        notify_employee(owner, 'leave_request', f'Leave request {decision}',
                        related_type='leave_request', related_id=row.id)
    audit('leave_request_decided', 'leave_request', row.id, prev, row.to_dict())
    return jsonify({'message': f'Leave {decision}', 'leave_request': row.to_dict()})