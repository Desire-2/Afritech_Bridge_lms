from datetime import datetime, timezone, date

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import (
    Service, Client, Employee, PaymentMethod, ServiceTransaction, Payment,
    generate_transaction_number,
)
from ..auth.auth import require_permission, require_any_permission, current_user, current_employee
from ..services.commission import resolve_commission
from ..services.audit import audit
from ..services.notifications import notify
from .helpers import json_error, parse_json, paginate, paginate_response

bp = Blueprint('transactions', __name__, url_prefix='/api/transactions')


@bp.get('')
@require_any_permission('transactions.view', 'transactions.view_all', 'transactions.create')
def list_transactions():
    user = current_user()
    q = ServiceTransaction.query
    if not user.has_permission('transactions.view_all'):
        emp = current_employee()
        if emp:
            q = q.filter_by(employee_id=emp.id)
        else:
            q = q.filter(db.text('1 = 0'))

    status = request.args.get('status')
    service_id = request.args.get('service_id', type=int)
    employee_id = request.args.get('employee_id', type=int)
    payment_method = request.args.get('payment_method', type=int)
    start = request.args.get('start')
    end = request.args.get('end')
    search = request.args.get('search')

    if status:
        q = q.filter_by(status=status)
    if service_id:
        q = q.filter_by(service_id=service_id)
    if employee_id:
        q = q.filter_by(employee_id=employee_id)
    if payment_method:
        q = q.filter_by(payment_method_id=payment_method)
    if start:
        q = q.filter(ServiceTransaction.transaction_date >= date.fromisoformat(start))
    if end:
        q = q.filter(ServiceTransaction.transaction_date <= date.fromisoformat(end))
    if search:
        like = f'%{search}%'
        q = q.filter(db.or_(
            ServiceTransaction.transaction_number.ilike(like),
            ServiceTransaction.reference.ilike(like),
            ServiceTransaction.service_name.ilike(like),
        ))
    p = paginate(q.order_by(ServiceTransaction.created_at.desc()))
    return paginate_response([t.to_dict() for t in p.items], p)


@bp.post('')
@require_permission('transactions.create')
def create_transaction():
    data = parse_json()
    from .helpers import required
    emp = current_employee()
    if not emp:
        return json_error('No employee profile linked to your account. Contact the administrator.', 400)
    if emp.status != 'active':
        return json_error('Your employee account is not active', 403)

    missing = required(data, 'service_id', 'client_id', 'payment_method_id')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')

    svc = Service.query.get(data['service_id'])
    if not svc:
        return json_error('Service not found', 404)
    if not svc.is_active:
        return json_error('Service is inactive')

    client = Client.query.get(data['client_id'])
    if not client:
        return json_error('Client not found', 404)

    pm = PaymentMethod.query.get(data['payment_method_id'])
    if not pm or not pm.is_active:
        return json_error('Invalid payment method', 400)

    customer_price = data.get('customer_price') if data.get('customer_price') is not None else float(svc.customer_price)
    official_cost = data.get('official_cost') if data.get('official_cost') is not None else float(svc.official_cost)
    try:
        customer_price = float(customer_price)
        official_cost = float(official_cost)
    except Exception:
        return json_error('Invalid price values', 400)
    if customer_price < 0 or official_cost < 0:
        return json_error('Prices cannot be negative', 400)

    calc = resolve_commission(svc, emp, official_cost=official_cost, customer_price=customer_price)

    # Generate unique transaction number (manual series update to avoid races in SQLite dev)
    txn = ServiceTransaction()
    txn.transaction_number = generate_transaction_number(db.session)
    txn.transaction_date = date.fromisoformat(data['transaction_date']) if data.get('transaction_date') else date.today()
    txn.status = data.get('status', 'completed')
    if txn.status not in ['created', 'processing', 'completed']:
        return json_error('New transactions can only be created, processing or completed', 400)
    txn.service_id = svc.id
    txn.service_name = svc.name
    txn.client_id = client.id
    txn.employee_id = emp.id
    txn.branch_id = emp.branch_id
    txn.payment_method_id = pm.id
    txn.official_cost = official_cost
    txn.customer_price = customer_price
    txn.commission_rate_used = calc['rate']
    txn.commission_source = calc['rate_source']
    txn.gross_profit = calc['gross_profit']
    txn.commission_amount = calc['commission_amount']
    txn.company_profit = calc['company_profit']
    txn.reference = data.get('reference')
    txn.notes = data.get('notes')
    txn.is_cash = pm.code in ('cash', 'CASH')

    db.session.add(txn)
    db.session.flush()

    db.session.add(Payment(
        transaction_id=txn.id,
        amount=customer_price,
        payment_method_id=pm.id,
        reference=data.get('reference'),
        paid_at=datetime.now(timezone.utc),
    ))
    db.session.commit()

    audit('transaction_created', 'transaction', txn.id, new_value=txn.to_dict())
    return jsonify({'message': 'Transaction recorded', 'transaction': txn.to_dict()}), 201


@bp.get('/<int:transaction_id>')
@require_any_permission('transactions.view', 'transactions.view_all')
def get_transaction(transaction_id):
    user = current_user()
    txn = ServiceTransaction.query.get(transaction_id)
    if not txn:
        return json_error('Transaction not found', 404)
    if not user.has_permission('transactions.view_all'):
        emp = current_employee()
        if not emp or emp.id != txn.employee_id:
            return json_error('You do not have permission to view this transaction', 403)
    payload = txn.to_dict()
    payload['payments'] = [p.to_dict() for p in txn.payments]
    return jsonify({'transaction': payload})


@bp.post('/<int:transaction_id>/status')
@require_any_permission('transactions.cancel', 'transactions.approve', 'transactions.view')
def update_transaction_status(transaction_id):
    """Change status. Completed transactions are never deleted; they are cancelled/refunded."""
    data = parse_json()
    user = current_user()
    txn = ServiceTransaction.query.get(transaction_id)
    if not txn:
        return json_error('Transaction not found', 404)
    new_status = data.get('status')
    if new_status not in ['processing', 'completed', 'cancelled', 'failed', 'refunded']:
        return json_error('Invalid status')
    if txn.status == new_status:
        return json_error('Transaction already has that status')

    owner_or_manager = user.has_permission('transactions.cancel') or (
        user.employee and txn.employee_id == user.employee.id
    )
    if not owner_or_manager:
        return json_error('You do not have permission to change this transaction', 403)

    if new_status in ('cancelled', 'refunded'):
        if not user.has_permission('transactions.cancel'):
            return json_error('You do not have permission to cancel/refund transactions', 403)
        txn.cancelled_reason = data.get('reason', 'User requested')
        txn.cancelled_by = user.id
        txn.cancelled_at = datetime.now(timezone.utc)
        if new_status == 'refunded':
            if not txn.is_cash:
                pass
            # reverse the commission effect: set amounts to zero but keep the snapshot for audit
    prev = txn.to_dict()
    txn.status = new_status
    db.session.commit()
    audit(f'transaction_{new_status}', 'transaction', txn.id, prev, txn.to_dict())
    return jsonify({'message': f'Transaction {new_status}', 'transaction': txn.to_dict()})