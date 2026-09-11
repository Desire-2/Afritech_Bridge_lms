from datetime import date, datetime, timezone
from decimal import Decimal

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import DailyClosing, ServiceTransaction, Employee, Notification
from ..auth.auth import require_permission, require_any_permission, current_user, current_employee
from ..services.audit import audit
from ..services.notifications import notify
from ..services.automation import cash_shortage_alert
from .helpers import json_error, parse_json, paginate, paginate_response

bp = Blueprint('closings', __name__, url_prefix='/api/closings')


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


@bp.get('/totals')
@require_any_permission('closings.view', 'closings.submit')
def closing_totals():
    """Preview daily totals for an agent/date (no persist)."""
    data = request.args
    emp = current_employee()
    user = current_user()
    employee_id = data.get('employee_id', type=int)
    if not user.has_permission('closings.approve'):
        employee_id = emp.id if emp else None
    elif not employee_id:
        employee_id = emp.id if emp else None
    closing_date = date.fromisoformat(data.get('date', date.today().isoformat()))
    if not employee_id:
        return json_error('No employee identified', 400)
    totals = triage_daily_totals(employee_id, closing_date)
    return jsonify({'totals': {k: str(v) for k, v in totals.items()},
                    'employee_id': employee_id, 'date': closing_date.isoformat()})


@bp.post('/submit')
@require_any_permission('closings.submit', 'closings.approve')
def submit_closing():
    data = parse_json()
    emp = current_employee()
    user = current_user()
    closing_date = date.fromisoformat(data.get('closing_date', date.today().isoformat()))

    # Managers may submit on behalf; agents only for themselves
    raw_eid = data.get('employee_id')
    target_employee_id = int(raw_eid) if raw_eid is not None else (emp.id if emp else None)
    if not user.has_permission('closings.approve') and target_employee_id != (emp.id if emp else None):
        return json_error('You cannot submit a closing for another employee', 403)
    if not emp and not user.has_permission('closings.approve'):
        return json_error('No employee profile linked', 400)

    existing = DailyClosing.query.filter_by(employee_id=target_employee_id, closing_date=closing_date).first()
    if existing and existing.status in ('submitted', 'approved'):
        return json_error('A closing for this date already exists', 409)

    totals = triage_daily_totals(target_employee_id, closing_date)
    actual_cash = data.get('actual_cash')
    if actual_cash is None and emp and not user.has_permission('closings.approve'):
        return json_error('actual_cash is required for agents', 400)
    actual_cash = Decimal(str(actual_cash)) if actual_cash is not None else totals['expected_cash']

    if existing:
        closing = existing
    else:
        closing = DailyClosing()
        db.session.add(closing)
    closing.closing_date = closing_date
    closing.employee_id = target_employee_id
    closing.branch_id = data.get('branch_id') or (emp.branch_id if emp else None)
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
    closing.notes = data.get('notes')
    closing.submitted_at = datetime.now(timezone.utc)
    closing.reviewed_by = None
    closing.reviewed_at = None
    closing.review_note = None
    closing.is_locked = False

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
    start = request.args.get('start')
    end = request.args.get('end')
    employee_id = request.args.get('employee_id', type=int)
    if status:
        q = q.filter_by(status=status)
    if start:
        q = q.filter(DailyClosing.closing_date >= date.fromisoformat(start))
    if end:
        q = q.filter(DailyClosing.closing_date <= date.fromisoformat(end))
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
    if closing.is_locked:
        return json_error('This closing is locked and cannot be modified', 400)
    decision = data.get('decision')
    if decision not in ('approved', 'rejected', 'correction_requested'):
        return json_error('Decision must be approved, rejected or correction_requested')

    closing.status = 'approved' if decision == 'approved' else decision
    closing.reviewed_by = current_user().id
    closing.reviewed_at = datetime.now(timezone.utc)
    closing.review_note = data.get('note')
    if closing.status == 'approved':
        closing.is_locked = True
        closing.locked_at = datetime.now(timezone.utc)

    db.session.commit()
    audit(f'closing_{decision}', 'daily_closing', closing.id,
          previous_value={'status': 'submitted'}, new_value=closing.to_dict())

    agent = Employee.query.get(closing.employee_id)
    if agent and agent.user_id:
        notify(agent.user_id, 'closing_reviewed',
               f'Your daily closing for {closing.closing_date} was {decision}.',
               severity='info', related_type='daily_closing', related_id=closing.id)
        if closing.reconciliation_class == 'shortage':
            db.session.add(Notification(
                recipient_id=agent.user_id, type='cash_shortage', severity='critical',
                message=f'Your closing had a cash shortage of {abs(float(closing.cash_difference)):,.0f} RWF.',
                related_type='daily_closing', related_id=closing.id, created_by_rule='cash-shortage')
            )
            db.session.commit()
    return jsonify({'message': f'Closing {decision}', 'closing': closing.to_dict()})