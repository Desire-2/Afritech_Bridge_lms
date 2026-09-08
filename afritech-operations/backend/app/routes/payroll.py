from datetime import date
from decimal import Decimal

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import (
    PayrollPeriod, PayrollItem, PayrollTransactionSource, ServiceTransaction,
    Employee, Employee as E,
)
from ..auth.auth import require_permission, current_user
from ..services.audit import audit
from ..services.notifications import notify
from .helpers import json_error, parse_json, paginate, paginate_response

bp = Blueprint('payroll', __name__, url_prefix='/api/payroll')


def calculate_commission_for_employee(employee_id, start, end):
    txns = ServiceTransaction.query.filter(
        ServiceTransaction.employee_id == employee_id,
        ServiceTransaction.transaction_date >= start,
        ServiceTransaction.transaction_date <= end,
        ServiceTransaction.status == 'completed',
    ).all()
    return sum(Decimal(str(t.commission_amount)) for t in txns), txns


@bp.get('/periods')
@require_permission('payroll.view')
def list_periods():
    q = PayrollPeriod.query
    status = request.args.get('status')
    if status:
        q = q.filter_by(status=status)
    p = paginate(q.order_by(PayrollPeriod.period_start.desc()))
    items = []
    for per in p.items:
        d = per.to_dict()
        d['total_net'] = float(sum((i.net_salary or 0) for i in per.items))
        items.append(d)
    return paginate_response(items, p)


@bp.post('/periods')
@require_permission('payroll.manage')
def create_period():
    data = parse_json()
    from .helpers import required
    missing = required(data, 'name', 'period_start', 'period_end')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    start = date.fromisoformat(data['period_start'])
    end = date.fromisoformat(data['period_end'])
    clash = PayrollPeriod.query.filter(
        PayrollPeriod.period_start <= end, PayrollPeriod.period_end >= start
    ).first()
    if clash:
        return json_error(f'Overlaps existing payroll period "{clash.name}"')
    period = PayrollPeriod(name=data['name'], period_start=start, period_end=end,
                           branch_id=data.get('branch_id'), status='draft')
    db.session.add(period)
    db.session.flush()

    # generate items from employee records
    employees = Employee.query.filter_by(status='active').all()
    if data.get('include_employees', True):
        for emp in employees:
            commission, txns = calculate_commission_for_employee(emp.id, start, end)
            item = PayrollItem(
                payroll_period_id=period.id,
                employee_id=emp.id,
                base_salary=emp.base_salary or 0,
                commission=commission,
                bonus=0, deduction=0, advance=0, adjustment=0,
                net_salary=(emp.base_salary or 0) + commission,
            )
            db.session.add(item)
            db.session.flush()
            for t in txns:
                db.session.add(PayrollTransactionSource(
                    payroll_item_id=item.id, transaction_id=t.id, commission_amount=t.commission_amount,
                ))
    db.session.commit()
    audit('payroll_period_created', 'payroll_period', period.id, new_value=data)
    return jsonify({'message': 'Payroll period created', 'period': period.to_dict()}), 201


@bp.get('/periods/<int:period_id>')
@require_permission('payroll.view')
def get_period(period_id):
    period = PayrollPeriod.query.get(period_id)
    if not period:
        return json_error('Payroll period not found', 404)
    d = period.to_dict()
    d['total_net'] = float(sum((i.net_salary or 0) for i in period.items))
    d['items'] = [i.to_dict() for i in period.items]
    return jsonify({'period': d})


@bp.post('/periods/<int:period_id>/recalculate')
@require_permission('payroll.manage')
def recalculate_period(period_id):
    period = PayrollPeriod.query.get(period_id)
    if not period:
        return json_error('Payroll period not found', 404)
    if period.status != 'draft':
        return json_error('Only draft periods can be recalculated', 400)
    for item in period.items:
        commission, txns = calculate_commission_for_employee(item.employee_id, period.period_start, period.period_end)
        item.commission = commission
        item.base_salary = item.employee.base_salary or 0
        item.net_salary = (item.base_salary or 0) + commission + (item.bonus or 0) - (item.deduction or 0) - (item.advance or 0) + (item.adjustment or 0)
        PayrollTransactionSource.query.filter_by(payroll_item_id=item.id).delete()
        db.session.flush()
        for t in txns:
            db.session.add(PayrollTransactionSource(
                payroll_item_id=item.id, transaction_id=t.id, commission_amount=t.commission_amount,
            ))
    db.session.commit()
    audit('payroll_recalculated', 'payroll_period', period.id)
    return get_period(period_id)


@bp.put('/items/<int:item_id>')
@require_permission('payroll.manage')
def update_item(item_id):
    data = parse_json()
    item = PayrollItem.query.get(item_id)
    if not item:
        return json_error('Item not found', 404)
    if item.period.status != 'draft':
        return json_error('Only draft periods can be edited', 400)
    prev = item.to_dict()
    for field in ['bonus', 'deduction', 'advance', 'adjustment', 'note']:
        if field in data:
            setattr(item, field, data[field])
    item.net_salary = (item.base_salary or 0) + (item.commission or 0) + (item.bonus or 0) - (item.deduction or 0) - (item.advance or 0) + (item.adjustment or 0)
    db.session.commit()
    audit('payroll_item_updated', 'payroll_item', item.id, prev, item.to_dict())
    return jsonify({'message': 'Payroll item updated', 'item': item.to_dict()})


@bp.post('/periods/<int:period_id>/status')
@require_permission('payroll.approve')
def update_period_status(period_id):
    data = parse_json()
    period = PayrollPeriod.query.get(period_id)
    if not period:
        return json_error('Period not found', 404)
    new_status = data.get('status')
    if new_status not in ('draft', 'reviewed', 'approved', 'paid'):
        return json_error('Invalid status')
    allowed = {'draft': ['reviewed'], 'reviewed': ['approved'], 'approved': ['paid']}
    prev = period.to_dict()
    if new_status == 'paid' and not current_user().has_permission('payroll.mark_paid'):
        return json_error('You do not have permission to mark payroll as paid', 403)
    if period.status in allowed and new_status in allowed[period.status]:
        period.status = new_status
    elif new_status == period.status:
        return json_error('Payroll already has that status')
    else:
        return json_error(f'Cannot move payroll from {period.status} to {new_status}')
    db.session.commit()
    audit(f'payroll_{new_status}', 'payroll_period', period.id, prev, period.to_dict())
    if new_status == 'paid':
        for item in period.items:
            if item.employee.user_id:
                notify(item.employee.user_id, 'payroll_paid',
                       f'Your salary for {period.name} has been paid: {float(item.net_salary or 0):,.0f} RWF.',
                       severity='info', related_type='payroll_period', related_id=period.id)
    return jsonify({'message': f'Payroll {new_status}', 'period': period.to_dict()})