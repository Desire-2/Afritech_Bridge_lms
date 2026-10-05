"""Warranty registrations and after-sales cases."""
from datetime import datetime, timezone, timedelta

from flask import Blueprint, request, jsonify

from ...extensions import db
from ...models import (
    ShopWarrantyRegistration, ShopWarrantyCase, ShopProduct, ShopCustomer,
    ShopSerializedItem, ShopSaleItem, ShopSale,
)
from ...auth.auth import require_permission, require_any_permission, current_user
from ...services.audit import audit
from ...services.shop_series import next_number
from ..helpers import json_error, parse_json, paginate, paginate_response, required
from .common import payload_for, scoped_branch_id, current_user_id, notify_shop

bp = Blueprint('shop_warranty', __name__, url_prefix='/api/shop')

CASE_TRANSITIONS = {
    'open': ('under_inspection', 'approved', 'rejected'),
    'under_inspection': ('approved', 'rejected'),
    'approved': ('repairing', 'replacement_pending', 'resolved', 'rejected'),
    'repairing': ('resolved', 'replacement_pending', 'rejected'),
    'replacement_pending': ('resolved',),
    'resolved': ('closed',),
    'rejected': ('closed',),
}


# ── registrations ────────────────────────────────────────────────────────────

@bp.get('/warranties')
@require_any_permission('shop.warranty.view', 'shop.warranty.manage')
def list_warranties():
    q = ShopWarrantyRegistration.query
    if request.args.get('product_id', type=int):
        q = q.filter_by(product_id=request.args.get('product_id', type=int))
    if request.args.get('customer_id', type=int):
        q = q.filter_by(customer_id=request.args.get('customer_id', type=int))
    if request.args.get('status'):
        q = q.filter_by(status=request.args.get('status'))
    elif request.args.get('include_expired') != 'true':
        q = q.filter_by(status='active')
    search = request.args.get('q', '').strip()
    if search:
        q = q.join(ShopProduct).join(ShopCustomer, isouter=True).filter(
            db.or_(ShopWarrantyRegistration.warranty_number.ilike(f'%{search}%'),
                   ShopProduct.name.ilike(f'%{search}%'),
                   ShopCustomer.full_name.ilike(f'%{search}%')))
    p = paginate(q.order_by(ShopWarrantyRegistration.id.desc()))
    user = current_user()
    return paginate_response([w.to_dict(user=user) for w in p.items], p)


@bp.get('/warranties/<int:row_id>')
@require_any_permission('shop.warranty.view', 'shop.warranty.manage')
def get_warranty(row_id):
    row = ShopWarrantyRegistration.query.get(row_id)
    if not row:
        return json_error('Warranty not found', 404)
    return jsonify({'warranty': payload_for(row, include_cases=True)})


@bp.post('/warranties')
@require_permission('shop.warranty.manage')
def create_warranty():
    data = parse_json()
    product = ShopProduct.query.get(data.get('product_id')) if data.get(
        'product_id') else None
    if product is None:
        return json_error('A product is required', 400)
    months = int(data.get('warranty_months') or product.warranty_months or 0)
    if months <= 0:
        return json_error('Warranty must be at least one month', 400)
    start = _parse_dt(data.get('start_date')) or datetime.now(timezone.utc)
    end = _parse_dt(data.get('end_date')) or (start + timedelta(days=months * 30))
    serial = (ShopSerializedItem.query.get(data['serial_id'])
              if data.get('serial_id') else None)
    customer = ShopCustomer.query.get(data['customer_id']) if data.get(
        'customer_id') else None
    sale_item = ShopSaleItem.query.get(data['sale_item_id']) if data.get(
        'sale_item_id') else None
    if sale_item is None and data.get('sale_id'):
        sale = ShopSale.query.get(data['sale_id'])
        sale_item = next((i for i in sale.items if i.product_id == product.id),
                         None) if sale else None
    if sale_item is None:
        return json_error('A sale item is required to register a warranty', 400)
    if ShopWarrantyRegistration.query.filter_by(sale_item_id=sale_item.id,
                                                serial_id=serial.id if serial else None).first():
        return json_error('That item already has a warranty registered', 409)

    row = ShopWarrantyRegistration(
        warranty_number=next_number('warranty'), sale_item_id=sale_item.id,
        product_id=product.id, customer_id=customer.id if customer else None,
        serial_id=serial.id if serial else None, warranty_months=months,
        provider=data.get('provider') or product.warranty_provider,
        terms=data.get('terms') or product.warranty_terms,
        start_date=start, end_date=end, notes=data.get('notes'),
    )
    db.session.add(row)
    db.session.commit()
    audit('shop_warranty_registered', 'shop_warranty_registration', row.id,
          new_value=payload_for(row))
    return jsonify({'warranty': payload_for(row)}), 201


# ── cases ────────────────────────────────────────────────────────────────────

@bp.get('/warranty-cases')
@require_any_permission('shop.warranty.view', 'shop.warranty.manage')
def list_cases():
    q = ShopWarrantyCase.query
    if request.args.get('status'):
        q = q.filter_by(status=request.args.get('status'))
    else:
        q = q.filter(ShopWarrantyCase.status.notin_(['closed']))
    if request.args.get('overdue') == 'true':
        q = q.filter(ShopWarrantyCase.due_at.isnot(None))
    search = request.args.get('q', '').strip()
    if search:
        q = q.join(ShopWarrantyRegistration).join(
            ShopProduct).join(ShopCustomer, isouter=True).filter(
            db.or_(ShopWarrantyCase.case_number.ilike(f'%{search}%'),
                   ShopProduct.name.ilike(f'%{search}%'),
                   ShopCustomer.full_name.ilike(f'%{search}%')))
    p = paginate(q.order_by(ShopWarrantyCase.id.desc()))
    user = current_user()
    return paginate_response([c.to_dict(user=user) for c in p.items], p)


@bp.get('/warranty-cases/<int:row_id>')
@require_any_permission('shop.warranty.view', 'shop.warranty.manage')
def get_case(row_id):
    row = ShopWarrantyCase.query.get(row_id)
    if not row:
        return json_error('Warranty case not found', 404)
    return jsonify({'case': payload_for(row)})


@bp.post('/warranty-cases')
@require_permission('shop.warranty.manage')
def create_case():
    data = parse_json()
    missing = required(data, 'registration_id', 'issue_description')
    if missing:
        return json_error(f'{", ".join(missing)} is required', 400)
    registration = ShopWarrantyRegistration.query.get(data['registration_id'])
    if not registration:
        return json_error('Warranty registration not found', 404)
    if registration.is_expired:
        return json_error('That warranty has expired', 409, 'warranty_expired')
    due_days = int(data.get('due_days') or 7)
    row = ShopWarrantyCase(
        case_number=next_number('warranty_case'),
        registration_id=registration.id, status='open',
        issue_description=data['issue_description'],
        diagnosis=data.get('diagnosis'),
        assigned_to=data.get('assigned_to') or current_user_id(),
        received_at=datetime.now(timezone.utc),
        due_at=datetime.now(timezone.utc) + timedelta(days=due_days),
    )
    db.session.add(row)
    db.session.commit()
    audit('shop_warranty_case_opened', 'shop_warranty_case', row.id,
          new_value=payload_for(row))
    notify_shop('shop.warranty.manage', 'shop_warranty_case',
                f'Warranty case {row.case_number} opened for '
                f'{registration.product.name if registration.product else "an item"}.',
                related_type='shop_warranty_case', related_id=row.id)
    return jsonify({'case': payload_for(row)}), 201


@bp.patch('/warranty-cases/<int:row_id>')
@require_permission('shop.warranty.manage')
def update_case(row_id):
    row = ShopWarrantyCase.query.get(row_id)
    if not row:
        return json_error('Warranty case not found', 404)
    data = parse_json()
    previous = payload_for(row)
    new_status = data.get('status')
    if new_status and new_status != row.status:
        allowed = CASE_TRANSITIONS.get(row.status, ())
        if new_status not in allowed:
            return json_error(
                f'A {row.status} case cannot move to {new_status} '
                f'(allowed: {", ".join(allowed) or "none"})', 409)
        row.status = new_status
        now = datetime.now(timezone.utc)
        if new_status in ('resolved', 'rejected'):
            row.resolved_at = now
        if new_status == 'closed':
            row.closed_at = now
        if new_status == 'rejected' and data.get('note'):
            row.rejected_reason = data['note']
    for field in ('issue_description', 'inspection_notes', 'resolution_notes',
                  'diagnosis', 'parts_used'):
        if field in data:
            setattr(row, field, data.get(field))
    if 'repair_cost' in data:
        row.repair_cost = data.get('repair_cost') or 0
    if 'assigned_to' in data:
        row.assigned_to = data.get('assigned_to')
    if 'due_at' in data:
        parsed = _parse_dt(data.get('due_at'))
        if parsed:
            row.due_at = parsed
    db.session.commit()
    audit('shop_warranty_case_updated', 'shop_warranty_case', row.id,
          previous_value=previous, new_value=payload_for(row))
    if new_status:
        notify_shop('shop.warranty.view', 'shop_warranty_case',
                    f'Warranty case {row.case_number} is now {new_status}.',
                    related_type='shop_warranty_case', related_id=row.id)
    return jsonify({'case': payload_for(row)})


def _parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None
