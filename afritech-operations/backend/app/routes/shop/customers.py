"""Shop customer directory: contact details, purchase history, loyalty."""
from flask import Blueprint, request, jsonify

from ...extensions import db
from ...models import ShopCustomer, ShopSale
from ...auth.auth import require_permission, require_any_permission, current_user
from ...services.audit import audit
from ..helpers import json_error, parse_json, paginate, paginate_response, required
from .common import payload_for, scoped_branch_id

bp = Blueprint('shop_customers', __name__, url_prefix='/api/shop/customers')


@bp.get('')
@require_any_permission('shop.customers.view', 'shop.sales.view')
def list_customers():
    q = ShopCustomer.query
    search = request.args.get('q', '').strip()
    if search:
        like = f'%{search}%'
        q = q.filter(db.or_(ShopCustomer.full_name.ilike(like),
                            ShopCustomer.phone.ilike(like),
                            ShopCustomer.email.ilike(like),
                            ShopCustomer.customer_number.ilike(like)))
    if request.args.get('customer_type'):
        q = q.filter_by(customer_type=request.args.get('customer_type'))
    p = paginate(q.order_by(ShopCustomer.full_name))
    user = current_user()
    return paginate_response([c.to_dict(user=user) for c in p.items], p)


@bp.get('/<int:row_id>')
@require_any_permission('shop.customers.view', 'shop.sales.view')
def get_customer(row_id):
    row = ShopCustomer.query.get(row_id)
    if not row:
        return json_error('Customer not found', 404)
    user = current_user()
    data = row.to_dict(user=user)
    sales = (ShopSale.query
             .filter(ShopSale.customer_id == row.id,
                     ShopSale.status.notin_(['held', 'cancelled']))
             .order_by(ShopSale.id.desc()).limit(10).all())
    data['recent_sales'] = [s.to_dict(user=user) for s in sales]
    return jsonify({'customer': data})


@bp.post('')
@require_permission('shop.customers.manage')
def create_customer():
    data = parse_json()
    missing = required(data, 'full_name')
    if missing:
        return json_error('full_name is required', 400)
    if data.get('phone') and ShopCustomer.query.filter_by(
            phone=data['phone']).first():
        return json_error('A customer with that phone already exists', 409)
    row = ShopCustomer(
        full_name=data['full_name'], phone=data.get('phone'),
        email=data.get('email'), address=data.get('address'),
        national_id=data.get('national_id'),
        customer_type=data.get('customer_type') or 'individual',
        tax_number=data.get('tax_number'),
        credit_limit=data.get('credit_limit') or 0,
        notes=data.get('notes'), created_by=current_user().id,
    )
    db.session.add(row)
    db.session.flush()
    row.customer_number = f'CUS-{row.id:05d}'
    db.session.commit()
    audit('shop_customer_created', 'shop_customer', row.id,
          new_value=payload_for(row))
    return jsonify({'customer': payload_for(row)}), 201


@bp.patch('/<int:row_id>')
@require_permission('shop.customers.manage')
def update_customer(row_id):
    row = ShopCustomer.query.get(row_id)
    if not row:
        return json_error('Customer not found', 404)
    data = parse_json()
    previous = payload_for(row)
    for field in ('full_name', 'phone', 'email', 'address', 'national_id',
                  'customer_type', 'tax_number', 'notes'):
        if field in data:
            setattr(row, field, data.get(field))
    if 'credit_limit' in data:
        row.credit_limit = data.get('credit_limit') or 0
    db.session.commit()
    audit('shop_customer_updated', 'shop_customer', row.id,
          previous_value=previous, new_value=payload_for(row))
    return jsonify({'customer': payload_for(row)})
