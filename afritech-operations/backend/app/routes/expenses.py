import os
from datetime import date, datetime, timezone

from flask import Blueprint, request, jsonify, current_app

from ..extensions import db
from ..models import Expense
from ..auth.auth import require_permission, require_any_permission, current_user, current_employee
from ..services.audit import audit
from ..services.notifications import notify_by_roles, notify
from .helpers import json_error, parse_json, paginate, paginate_response

bp = Blueprint('expenses', __name__, url_prefix='/api/expenses')

ALLOWED_UPLOAD_EXT = {'png', 'jpg', 'jpeg', 'pdf', 'webp'}


def save_receipt(file):
    if not file or file.filename == '':
        return None
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED_UPLOAD_EXT:
        raise ValueError('Unsupported file type')
    folder = os.path.join(current_app.config['UPLOAD_FOLDER'], 'expenses')
    os.makedirs(folder, exist_ok=True)
    fname = f"exp{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{file.filename.replace(' ', '_')}"
    path = os.path.join(folder, fname)
    file.save(path)
    return f'/uploads/{os.path.basename(folder)}/{fname}'


@bp.get('')
@require_any_permission('expenses.view', 'expenses.create')
def list_expenses():
    user = current_user()
    q = Expense.query
    if not user.has_permission('expenses.view'):
        emp = current_employee()
        if emp and emp.user_id:
            q = q.filter_by(submitted_by=user.id)
        else:
            q = q.filter(db.text('1 = 0'))
    status = request.args.get('status')
    category = request.args.get('category')
    start = request.args.get('start')
    end = request.args.get('end')
    if status:
        q = q.filter_by(status=status)
    if category:
        q = q.filter_by(category=category)
    if start:
        q = q.filter(Expense.expense_date >= date.fromisoformat(start))
    if end:
        q = q.filter(Expense.expense_date <= date.fromisoformat(end))
    p = paginate(q.order_by(Expense.created_at.desc()))
    return paginate_response([e.to_dict() for e in p.items], p)


@bp.post('')
@require_permission('expenses.create')
def create_expense():
    data = parse_json() or request.form.to_dict()
    if 'receipt' in request.files:
        data.pop('receipt', None)
    from .helpers import required
    missing = required(data, 'amount', 'category', 'description')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    try:
        amount = float(data['amount'])
        if amount < 0:
            raise ValueError
    except Exception:
        return json_error('Invalid amount')
    exp = Expense(
        amount=amount,
        category=data['category'],
        description=data['description'],
        expense_date=date.fromisoformat(data['expense_date']) if data.get('expense_date') else date.today(),
        payment_method_id=data.get('payment_method_id') or None,
        submitted_by=current_user().id,
        status='pending',
        branch_id=data.get('branch_id'),
        notes=data.get('notes'),
    )
    if 'receipt' in request.files:
        try:
            exp.receipt_path = save_receipt(request.files['receipt'])
        except ValueError as e:
            return json_error(str(e))
    db.session.add(exp)
    db.session.commit()
    audit('expense_created', 'expense', exp.id, new_value=exp.to_dict())
    notify_by_roles(['manager', 'super_admin', 'accountant'], 'expense_approval',
                    f'Expense awaiting approval: {exp.category} {exp.amount:,.0f} RWF.',
                    severity='warning', related_type='expense', related_id=exp.id, rule='expense-approval')
    return jsonify({'message': 'Expense submitted', 'expense': exp.to_dict()}), 201


@bp.get('/<int:expense_id>')
@require_any_permission('expenses.view', 'expenses.approve', 'expenses.create')
def get_expense(expense_id):
    exp = Expense.query.get(expense_id)
    if not exp:
        return json_error('Expense not found', 404)
    user = current_user()
    if not user.has_permission('expenses.view') and exp.submitted_by != user.id:
        return json_error('You do not have permission to view this expense', 403)
    return jsonify({'expense': exp.to_dict()})


@bp.post('/<int:expense_id>/approve')
@require_permission('expenses.approve')
def approve_expense(expense_id):
    data = parse_json()
    exp = Expense.query.get(expense_id)
    if not exp:
        return json_error('Expense not found', 404)
    if exp.status not in ('pending', 'rejected'):
        return json_error('Expense already processed', 400)
    decision = data.get('decision', 'approved')
    if decision not in ('approved', 'rejected', 'paid'):
        return json_error('Decision must be approved, rejected or paid')
    prev = exp.to_dict()
    exp.status = decision
    exp.approved_by = current_user().id
    exp.approved_at = datetime.now(timezone.utc)
    if data.get('notes'):
        exp.notes = (exp.notes or '') + f' [{decision}] {data["notes"]}'
    db.session.commit()
    audit(f'expense_{decision}', 'expense', exp.id, prev, exp.to_dict())
    return jsonify({'message': f'Expense {decision}', 'expense': exp.to_dict()})