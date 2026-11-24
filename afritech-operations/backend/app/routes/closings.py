from datetime import datetime, timezone
from decimal import Decimal

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import DailyClosing, ServiceTransaction, Employee, Notification
from ..auth.auth import require_permission, require_any_permission, current_user, current_employee
from ..services.audit import audit
from ..services.notifications import notify
from ..services.automation import cash_shortage_alert
from ..services.weekly_policy import get_policy, local_date
from .helpers import json_error, parse_date, parse_id, parse_json, paginate, paginate_response

bp = Blueprint('closings', __name__, url_prefix='/api/closings')


def business_today():
    """Calendar day in the configured business timezone, never the host's."""
    return local_date(datetime.now(timezone.utc), get_policy())


def resolve_closing_employee(user, own_employee, requested_id):
    """Resolve whose closing is being previewed/submitted.

    Agents are always scoped to their own employee row. Approvers may target
    another employee, but an explicit id must name a real row: silently falling
    back to the approver's own profile (often absent) is what produced empty
    totals for a selected date and null-employee closing rows.
    """
    if not user.has_permission('closings.approve'):
        if requested_id is not None and (not own_employee or requested_id != own_employee.id):
            return None, json_error('You cannot load or submit a closing for another employee', 403)
        if not own_employee:
            return None, json_error('No employee profile linked', 400)
        return own_employee, None

    if requested_id is not None:
        employee = db.session.get(Employee, requested_id)
        if not employee:
            return None, json_error('Employee not found', 404)
        return employee, None
    if own_employee:
        return own_employee, None
    return None, json_error('Select an employee', 400)


def triage_daily_totals(employee_id, closing_date):
    txns = ServiceTransaction.query.filter_by(
        employee_id=employee_id, transaction_date=closing_date
    ).filter(ServiceTransaction.status == 'completed').all()

    total_payments = sum(Decimal(str(t.customer_price)) for t in txns)
    cash_total = sum(Decimal(str(t.customer_price)) for t in txns if t.is_cash)
    non_cash = total_payments - cash_total
    costs = sum(Decimal(str(t.official_cost)) for t in txns)
    gross = sum(Decimal(str(t.gross_profit)) for t in txns)
    commission = sum(Decimal(str(t.commission_amount)) for t in txns)
    company = sum(Decimal(str(t.company_profit)) for t in txns)

    return {
        'transaction_count': len(txns),
        'customer_payments': total_payments,
        'cash_payments': cash_total,
        'non_cash_payments': non_cash,
        'service_costs': costs,
        'gross_profit': gross,
        'total_commission': commission,
        'company_profit': company,
        'expected_cash': cash_total,
    }


def recompute_daily_closing(closing):
    """Refresh a closing's stored totals from live transactions (keeps its
    submitted cash figure and status; only derived amounts are recalculated).

    Used when an underlying transaction is edited after the closing was
    returned for correction, so the closing never shows stale/duplicated counts.
    """
    totals = triage_daily_totals(closing.employee_id, closing.closing_date)
    closing.transaction_count = totals['transaction_count']
    closing.customer_payments = totals['customer_payments']
    closing.cash_payments = totals['cash_payments']
    closing.non_cash_payments = totals['non_cash_payments']
    closing.service_costs = totals['service_costs']
    closing.gross_profit = totals['gross_profit']
    closing.total_commission = totals['total_commission']
    closing.company_profit = totals['company_profit']
    closing.expected_cash = totals['expected_cash']
    closing.cash_difference = closing.actual_cash - totals['expected_cash']
    closing.reconciliation_class = DailyClosing.reconciliation_class_for(closing.cash_difference)


def parse_closing_date(raw, field='date', default_to_today=True):
    """User-supplied closing date -> (date|None, error_response|None).

    Absent input falls back to today (the documented default); an explicitly
    empty or malformed value is a 400 instead of a ValueError-turned-500.
    """
    if raw is None:
        return (business_today() if default_to_today else None), None
    parsed, err = parse_date(raw, field)
    if err:
        return None, err
    if parsed is None:
        return None, json_error(f'{field} is required (expected YYYY-MM-DD)', 400)
    return parsed, None


@bp.get('/today')
@require_any_permission('closings.view', 'closings.submit')
def closing_today():
    """Authoritative business date for the closing screen.

    The browser must not derive today from its own timezone; a UTC browser late
    in the evening would otherwise open a closing for the previous Kigali day.
    """
    return jsonify({'date': business_today().isoformat(),
                    'timezone': get_policy()['timezone']})


@bp.get('/totals')
@require_any_permission('closings.view', 'closings.submit')
def closing_totals():
    """Preview daily totals for an agent/date (no persist)."""
    data = request.args
    own_employee = current_employee()
    user = current_user()
    requested_id, err = parse_id(data.get('employee_id'), 'employee_id')
    if err:
        return err
    employee, err = resolve_closing_employee(user, own_employee, requested_id)
    if err:
        return err
    closing_date, err = parse_closing_date(data.get('date'), 'date')
    if err:
        return err
    totals = triage_daily_totals(employee.id, closing_date)
    # Money stays a string (exact decimal text over the wire); the count is
    # a plain integer so consumers never have to coerce it. The response echoes
    # the employee and date so the screen can reject a stale/other-day reply.
    wire = {k: (v if k == 'transaction_count' else str(v))
            for k, v in totals.items()}
    return jsonify({'totals': wire,
                    'employee_id': employee.id,
                    'employee_name': employee.full_name,
                    'date': closing_date.isoformat(),
                    'timezone': get_policy()['timezone']})


@bp.post('/submit')
@require_any_permission('closings.submit', 'closings.approve')
def submit_closing():
    data = parse_json()
    own_employee = current_employee()
    user = current_user()
    closing_date, err = parse_closing_date(data.get('closing_date'), 'closing_date')
    if err:
        return err

    # Managers may submit on behalf; agents are always scoped to themselves.
    requested_id, err = parse_id(data.get('employee_id'), 'employee_id')
    if err:
        return err
    target_employee, err = resolve_closing_employee(user, own_employee, requested_id)
    if err:
        return err

    branch_id, err = parse_id(data.get('branch_id'), 'branch_id')
    if err:
        return err
    notes = data.get('notes')
    if notes is not None:
        notes = str(notes)
        if len(notes) > 500:
            return json_error('notes must be 500 characters or fewer', 400)

    existing = DailyClosing.query.filter_by(
        employee_id=target_employee.id, closing_date=closing_date).first()
    if existing and existing.status in ('submitted', 'approved'):
        return json_error('A closing for this date already exists', 409)

    totals = triage_daily_totals(target_employee.id, closing_date)
    actual_cash = data.get('actual_cash')
    if actual_cash is None and not user.has_permission('closings.approve'):
        return json_error('actual_cash is required for agents', 400)
    if actual_cash is not None:
        try:
            actual_cash = Decimal(str(actual_cash))
        except (ArithmeticError, ValueError, TypeError):
            return json_error('actual_cash must be a number', 400)
        if not actual_cash.is_finite():
            return json_error('actual_cash must be a number', 400)
        if actual_cash < 0:
            return json_error('actual_cash cannot be negative', 400)
    else:
        actual_cash = totals['expected_cash']

    if existing:
        closing = existing
    else:
        closing = DailyClosing()
        db.session.add(closing)
    closing.closing_date = closing_date
    closing.employee_id = target_employee.id
    # A manager submitting for an agent must stamp the agent's branch, not the
    # manager's own branch (which is often absent).
    closing.branch_id = branch_id or target_employee.branch_id
    closing.transaction_count = totals['transaction_count']
    closing.customer_payments = totals['customer_payments']
    closing.cash_payments = totals['cash_payments']
    closing.non_cash_payments = totals['non_cash_payments']
    closing.service_costs = totals['service_costs']
    closing.gross_profit = totals['gross_profit']
    closing.total_commission = totals['total_commission']
    closing.company_profit = totals['company_profit']
    closing.expected_cash = totals['expected_cash']
    closing.actual_cash = actual_cash
    closing.cash_difference = actual_cash - totals['expected_cash']
    closing.reconciliation_class = DailyClosing.reconciliation_class_for(closing.cash_difference)
    closing.status = 'submitted'
    closing.notes = notes
    closing.submitted_at = datetime.now(timezone.utc)
    closing.reviewed_by = None
    closing.reviewed_at = None
    closing.review_note = None
    closing.is_locked = False
    closing.locked_at = None

    db.session.commit()

    audit('closing_submitted', 'daily_closing', closing.id, new_value=closing.to_dict())

    # manager notification
    if closing.reconciliation_class == 'shortage':
        cash_shortage_alert(closing_date)
    else:
        from ..services.notifications import notify_by_roles
        notify_by_roles(
            ['manager', 'super_admin'], 'closing_approval',
            f'Daily closing awaiting approval: {closing.employee.full_name} ({closing_date}).',
            severity='warning', related_type='daily_closing', related_id=closing.id, rule='closing-approval'
        )

    return jsonify({'message': 'Daily closing submitted', 'closing': closing.to_dict()}), 201


@bp.get('')
@require_any_permission('closings.view', 'closings.approve')
def list_closings():
    user = current_user()
    q = DailyClosing.query
    if not user.has_permission('closings.approve'):
        emp = current_employee()
        if emp:
            q = q.filter_by(employee_id=emp.id)
        else:
            q = q.filter(db.text('1 = 0'))
    status = request.args.get('status')
    start, err = parse_date(request.args.get('start'), 'start')
    if err:
        return err
    end, err = parse_date(request.args.get('end'), 'end')
    if err:
        return err
    employee_id, err = parse_id(request.args.get('employee_id'), 'employee_id')
    if err:
        return err
    if status:
        q = q.filter_by(status=status)
    if start:
        q = q.filter(DailyClosing.closing_date >= start)
    if end:
        q = q.filter(DailyClosing.closing_date <= end)
    if employee_id:
        q = q.filter_by(employee_id=employee_id)
    p = paginate(q.order_by(DailyClosing.closing_date.desc()))
    return paginate_response([c.to_dict() for c in p.items], p)


@bp.get('/<int:closing_id>')
@require_any_permission('closings.view', 'closings.approve')
def get_closing(closing_id):
    closing = DailyClosing.query.get(closing_id)
    if not closing:
        return json_error('Closing not found', 404)
    user = current_user()
    if not user.has_permission('closings.approve'):
        emp = current_employee()
        if not emp or emp.id != closing.employee_id:
            return json_error('You do not have permission to view this closing', 403)
    return jsonify({'closing': closing.to_dict()})


@bp.post('/<int:closing_id>/review')
@require_permission('closings.approve')
def review_closing(closing_id):
    data = parse_json()
    closing = DailyClosing.query.get(closing_id)
    if not closing:
        return json_error('Closing not found', 404)

    user = current_user()
    # Only a super admin may reopen an approval that was entered by mistake.
    # Managers keep the normal approve/reject powers but never break a lock.
    was_locked = bool(closing.is_locked)
    admin_override = was_locked and bool(getattr(user, 'is_super_admin', False))
    if was_locked and not admin_override:
        return json_error('This closing is locked and cannot be modified', 400)

    decision = data.get('decision')
    valid = ('approved', 'rejected', 'correction_requested')
    if was_locked:
        if decision == 'approved':
            return json_error('This closing is already approved; choose a different status to reopen it', 400)
        valid = ('submitted', 'rejected', 'correction_requested')
    if decision not in valid:
        return json_error(f'Decision must be one of: {", ".join(valid)}')

    note = data.get('note')
    if note is not None:
        note = str(note)
        if len(note) > 500:
            return json_error('note must be 500 characters or fewer', 400)
    if admin_override and (not note or not note.strip()):
        return json_error('A reason is required to change an approved closing', 400)

    previous_status = closing.status
    previous_locked_at = closing.locked_at
    closing.status = decision
    closing.reviewed_by = user.id
    closing.reviewed_at = datetime.now(timezone.utc)
    closing.review_note = note
    if decision == 'approved':
        closing.is_locked = True
        closing.locked_at = datetime.now(timezone.utc)
    else:
        # Reopening (or rejecting) releases the lock so the agent can correct
        # the underlying day and re-submit. Approving again re-locks it.
        closing.is_locked = False
        closing.locked_at = None

    db.session.commit()
    audit('closing_admin_status_override' if admin_override else f'closing_{decision}',
          'daily_closing', closing.id,
          previous_value={'status': previous_status, 'is_locked': was_locked,
                          'locked_at': previous_locked_at},
          new_value=closing.to_dict(), reason=note if admin_override else None)

    agent = Employee.query.get(closing.employee_id)
    if agent and agent.user_id:
        suffix = ' by an administrator.' if admin_override else '.'
        notify(agent.user_id, 'closing_reviewed',
               f'Your daily closing for {closing.closing_date} was {decision}{suffix}',
               severity='info', related_type='daily_closing', related_id=closing.id)
        if closing.reconciliation_class == 'shortage':
            # Route through the central gate (authorization, dedupe, e-mail)
            # instead of a raw row insert that bypasses it.
            notify(agent.user_id, 'cash_shortage',
                   f'Your closing had a cash shortage of {abs(float(closing.cash_difference)):,.0f} RWF.',
                   severity='critical', related_type='daily_closing',
                   related_id=closing.id, rule='cash-shortage')
    return jsonify({'message': f'Closing {decision}', 'closing': closing.to_dict()})