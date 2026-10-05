"""Shop purchasing: suppliers, purchase orders, goods receipts, supplier returns.

Receiving is the only place stock grows from outside the shop, and it is also
where cost enters the system: the receipt's accepted quantity and unit cost
feed the weighted average (or the FIFO layer) inside the inventory engine.
"""
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify
from sqlalchemy import update

from ...extensions import db
from ...models import (
    ShopSupplier, ShopPurchaseOrder, ShopPurchaseOrderItem, ShopGoodsReceipt,
    ShopGoodsReceiptItem, ShopSupplierReturn, ShopSupplierReturnItem,
    ShopProduct, ShopProductVariant, ShopSerializedItem, ShopProductPriceHistory,
)
from ...auth.auth import require_permission, require_any_permission, current_user
from ...auth.shop_scope import can_view_shop_costs
from ...services.audit import audit
from ...services.shop_inventory import ShopStockError, post_movement
from ...services.shop_series import next_number
from ..helpers import json_error, parse_json, paginate, paginate_response, required
from .common import (
    payload_for, resolve_branch, scoped_branch_id, stock_error,
    current_user_id, notify_shop, resolve_item as _resolve_item_shim,
)

bp = Blueprint('shop_purchasing', __name__, url_prefix='/api/shop')


# ── suppliers ────────────────────────────────────────────────────────────────

@bp.get('/suppliers')
@require_permission('shop.suppliers.view')
def list_suppliers():
    q = ShopSupplier.query
    if request.args.get('active') == 'true':
        q = q.filter_by(is_active=True)
    search = request.args.get('q', '').strip()
    if search:
        q = q.filter(db.or_(ShopSupplier.company_name.ilike(f'%{search}%'),
                            ShopSupplier.code.ilike(f'%{search}%'),
                            ShopSupplier.phone.ilike(f'%{search}%')))
    p = paginate(q.order_by(ShopSupplier.company_name))
    user = current_user()
    return paginate_response([s.to_dict(with_stats=True) for s in p.items], p)


@bp.get('/suppliers/<int:row_id>')
@require_permission('shop.suppliers.view')
def get_supplier(row_id):
    row = ShopSupplier.query.get(row_id)
    if not row:
        return json_error('Supplier not found', 404)
    return jsonify({'supplier': row.to_dict(with_stats=True)})


@bp.post('/suppliers')
@require_permission('shop.suppliers.create')
def create_supplier():
    data = parse_json()
    missing = required(data, 'company_name')
    if missing:
        return json_error('company_name is required', 400)
    code = (data.get('code') or '').strip() or _next_supplier_code()
    if ShopSupplier.query.filter_by(code=code).first():
        return json_error(f'Supplier code {code} already exists', 409)
    row = ShopSupplier(
        code=code, company_name=data['company_name'],
        contact_person=data.get('contact_person'), phone=data.get('phone'),
        email=data.get('email'), address=data.get('address'),
        tax_number=data.get('tax_number'), payment_terms=data.get('payment_terms'),
        notes=data.get('notes'), is_active=bool(data.get('is_active', True)),
    )
    db.session.add(row)
    db.session.commit()
    audit('shop_supplier_created', 'shop_supplier', row.id,
          new_value=row.to_dict(with_stats=True))
    return jsonify({'supplier': row.to_dict(with_stats=True)}), 201


@bp.patch('/suppliers/<int:row_id>')
@require_permission('shop.suppliers.create')
def update_supplier(row_id):
    row = ShopSupplier.query.get(row_id)
    if not row:
        return json_error('Supplier not found', 404)
    data = parse_json()
    previous = row.to_dict()
    for field in ('company_name', 'contact_person', 'phone', 'email', 'address',
                  'tax_number', 'payment_terms', 'notes'):
        if field in data:
            setattr(row, field, data.get(field))
    if 'is_active' in data:
        row.is_active = bool(data['is_active'])
    db.session.commit()
    audit('shop_supplier_updated', 'shop_supplier', row.id,
          previous_value=previous, new_value=row.to_dict(with_stats=True))
    return jsonify({'supplier': row.to_dict(with_stats=True)})


def _next_supplier_code():
    last = ShopSupplier.query.order_by(ShopSupplier.id.desc()).first()
    number = (int(last.code.split('-')[-1]) + 1) if last and last.code.split(
        '-')[-1].isdigit() else 1
    return f'SUP-{number:03d}'


# ── purchase orders ──────────────────────────────────────────────────────────

def _po_items(po, payload_items):
    if not isinstance(payload_items, list) or not payload_items:
        raise ShopStockError('A purchase order needs at least one line', 400,
                             'empty_po')
    po.items.clear()
    db.session.flush()
    for entry in payload_items:
        product, variant = _resolve_item_shim(entry)
        quantity = int(entry.get('quantity') or entry.get('quantity_ordered') or 0)
        if quantity <= 0:
            raise ShopStockError('Quantity must be positive', 400,
                                 'invalid_quantity')
        unit_cost = entry.get('unit_cost')
        if unit_cost is None:
            unit_cost = (variant.purchase_cost if variant is not None
                         else product.purchase_cost)
        po.items.append(ShopPurchaseOrderItem(
            product_id=product.id, variant_id=variant.id if variant else None,
            quantity_ordered=quantity, unit_cost=unit_cost or 0,
            discount_amount=entry.get('discount_amount') or 0,
            tax_rate=entry.get('tax_rate') or 0, note=entry.get('note')))
    po.compute_totals()


@bp.get('/purchases')
@require_permission('shop.purchases.view')
def list_purchases():
    q = ShopPurchaseOrder.query
    branch_id = scoped_branch_id()
    if branch_id is not None and not current_user().has_permission(
            'shop.purchases.approve'):
        q = q.filter_by(branch_id=branch_id)
    elif request.args.get('branch_id', type=int):
        q = q.filter_by(branch_id=request.args.get('branch_id', type=int))
    if request.args.get('supplier_id', type=int):
        q = q.filter_by(supplier_id=request.args.get('supplier_id', type=int))
    if request.args.get('status'):
        q = q.filter_by(status=request.args.get('status'))
    search = request.args.get('q', '').strip()
    if search:
        q = q.join(ShopSupplier).filter(
            db.or_(ShopPurchaseOrder.po_number.ilike(f'%{search}%'),
                   ShopSupplier.company_name.ilike(f'%{search}%')))
    p = paginate(q.order_by(ShopPurchaseOrder.id.desc()))
    user = current_user()
    return paginate_response([o.to_dict(user=user) for o in p.items], p)


@bp.get('/purchases/<int:row_id>')
@require_permission('shop.purchases.view')
def get_purchase(row_id):
    row = ShopPurchaseOrder.query.get(row_id)
    if not row:
        return json_error('Purchase order not found', 404)
    user = current_user()
    data = row.to_dict(user=user, include_items=True)
    data['receipts'] = [r.to_dict(user=user, include_items=True)
                        for r in row.receipts]
    return jsonify({'purchase_order': data})


@bp.post('/purchases')
@require_permission('shop.purchases.create')
def create_purchase():
    data = parse_json()
    supplier_id = data.get('supplier_id')
    supplier = ShopSupplier.query.get(supplier_id) if supplier_id else None
    if supplier is None:
        return json_error('A supplier is required', 400)
    try:
        branch = resolve_branch(data.get('branch_id'))
    except ShopStockError as e:
        return stock_error(e)
    po = ShopPurchaseOrder(
        po_number=next_number('purchase_order'), supplier_id=supplier.id,
        branch_id=branch.id, status='draft',
        expected_date=_parse_dt(data.get('expected_date')),
        discount_amount=data.get('discount_amount') or 0,
        tax_amount=data.get('tax_amount') or 0,
        shipping_amount=data.get('shipping_amount') or 0,
        notes=data.get('notes'), created_by=current_user_id(),
    )
    db.session.add(po)
    db.session.flush()
    try:
        _po_items(po, data.get('items'))
    except ShopStockError as e:
        db.session.rollback()
        return stock_error(e)
    db.session.commit()
    audit('shop_purchase_created', 'shop_purchase_order', po.id,
          new_value=payload_for(po))
    return jsonify({'purchase_order': payload_for(po, include_items=True)}), 201


@bp.patch('/purchases/<int:row_id>')
@require_permission('shop.purchases.create')
def update_purchase(row_id):
    po = ShopPurchaseOrder.query.get(row_id)
    if not po:
        return json_error('Purchase order not found', 404)
    if po.status not in ('draft', 'pending_approval'):
        return json_error(f'A {po.status} purchase order cannot be edited', 409)
    data = parse_json()
    previous = payload_for(po, include_items=True)
    if 'expected_date' in data:
        po.expected_date = _parse_dt(data.get('expected_date'))
    for field in ('discount_amount', 'tax_amount', 'shipping_amount'):
        if field in data:
            setattr(po, field, data.get(field) or 0)
    if 'notes' in data:
        po.notes = data.get('notes')
    if data.get('items') is not None:
        try:
            _po_items(po, data.get('items'))
        except ShopStockError as e:
            db.session.rollback()
            return stock_error(e)
    else:
        po.compute_totals()
    if po.status == 'draft' and data.get('submit'):
        po.status = 'pending_approval'
    db.session.commit()
    audit('shop_purchase_updated', 'shop_purchase_order', po.id,
          previous_value=previous, new_value=payload_for(po, include_items=True))
    return jsonify({'purchase_order': payload_for(po, include_items=True)})


@bp.post('/purchases/<int:row_id>/submit')
@require_permission('shop.purchases.create')
def submit_purchase(row_id):
    po = ShopPurchaseOrder.query.get(row_id)
    if not po:
        return json_error('Purchase order not found', 404)
    if po.status != 'draft':
        return json_error('Only a draft purchase order can be submitted', 409)
    if not po.items:
        return json_error('A purchase order needs at least one line', 400)
    po.status = 'pending_approval'
    db.session.commit()
    audit('shop_purchase_submitted', 'shop_purchase_order', po.id,
          previous_value={'status': 'draft'}, new_value=payload_for(po))
    notify_shop('shop.purchases.approve', 'shop_purchase_approval',
                f'Purchase order {po.po_number} from {po.supplier.company_name} '
                f'awaits approval.',
                related_type='shop_purchase_order', related_id=po.id,
                rule='shop-purchase-approval')
    return jsonify({'purchase_order': payload_for(po, include_items=True)})


@bp.post('/purchases/<int:row_id>/approve')
@require_permission('shop.purchases.approve')
def approve_purchase(row_id):
    po = ShopPurchaseOrder.query.get(row_id)
    if not po:
        return json_error('Purchase order not found', 404)
    if po.status not in ('draft', 'pending_approval'):
        return json_error(f'A {po.status} purchase order cannot be approved', 409)
    data = parse_json()
    previous = po.status
    po.status = 'approved'
    po.approved_at = datetime.now(timezone.utc)
    po.approved_by = current_user_id()
    db.session.commit()
    audit('shop_purchase_approved', 'shop_purchase_order', po.id,
          previous_value={'status': previous}, new_value=payload_for(po))
    notify_shop('shop.inventory.receive', 'shop_goods_received',
                f'Purchase order {po.po_number} approved and ready to receive.',
                related_type='shop_purchase_order', related_id=po.id)
    return jsonify({'purchase_order': payload_for(po, include_items=True)})


@bp.post('/purchases/<int:row_id>/cancel')
@require_permission('shop.purchases.approve')
def cancel_purchase(row_id):
    po = ShopPurchaseOrder.query.get(row_id)
    if not po:
        return json_error('Purchase order not found', 404)
    if po.status in ('received', 'cancelled', 'closed'):
        return json_error('A received purchase order cannot be cancelled', 409)
    if po.received_quantity:
        return json_error('Goods have already been received against this order',
                          409)
    po.status = 'cancelled'
    po.cancelled_at = datetime.now(timezone.utc)
    po.cancelled_by = current_user_id()
    db.session.commit()
    audit('shop_purchase_cancelled', 'shop_purchase_order', po.id,
          new_value=payload_for(po))
    return jsonify({'purchase_order': payload_for(po)})


# ── goods receipts ───────────────────────────────────────────────────────────

@bp.post('/purchases/<int:row_id>/receive')
@require_permission('shop.purchases.receive')
def receive_purchase(row_id):
    po = ShopPurchaseOrder.query.get(row_id)
    if not po:
        return json_error('Purchase order not found', 404)
    if po.status not in ('approved', 'partially_received'):
        return json_error('Only an approved purchase order can be received', 409)
    data = parse_json()
    entries = data.get('items') or []
    if not entries:
        return json_error('At least one received line is required', 400)

    receipt = ShopGoodsReceipt(
        receipt_number=next_number('goods_receipt'),
        purchase_order_id=po.id, branch_id=po.branch_id, status='draft',
        supplier_invoice=data.get('supplier_invoice'),
        received_at=datetime.now(timezone.utc),
        notes=data.get('notes'), created_by=current_user_id(),
    )
    db.session.add(receipt)
    db.session.flush()

    try:
        for entry in entries:
            line = _po_line(po, entry)
            accepted = int(entry.get('quantity_accepted')
                           if entry.get('quantity_accepted') is not None
                           else entry.get('quantity') or 0)
            rejected = int(entry.get('quantity_rejected') or 0)
            if accepted < 0 or rejected < 0 or (accepted + rejected) == 0:
                raise ShopStockError('Received quantity must be positive', 400,
                                     'invalid_quantity')
            unit_cost = entry.get('unit_cost')
            if unit_cost is None:
                unit_cost = line.unit_cost if line else 0
            item = ShopGoodsReceiptItem(
                goods_receipt_id=receipt.id,
                purchase_order_item_id=line.id if line else None,
                product_id=(line.product_id if line
                            else _resolve_item_shim(entry)[0].id),
                variant_id=line.variant_id if line else entry.get('variant_id'),
                quantity_received=accepted + rejected,
                quantity_accepted=accepted, quantity_rejected=rejected,
                unit_cost=unit_cost, note=entry.get('note'))
            db.session.add(item)
            if line:
                line.quantity_received = int(line.quantity_received or 0) + accepted
                if item.variant_id is None and line.unit_cost is not None:
                    line.unit_cost = unit_cost
            if accepted:
                post_movement(product_id=item.product_id, branch_id=po.branch_id,
                              variant_id=item.variant_id,
                              movement_type='purchase', quantity=accepted,
                              unit_cost=float(unit_cost or 0),
                              reference_type='goods_receipt',
                              reference_id=receipt.id,
                              note=f'{po.po_number} receipt',
                              user_id=current_user_id())
                _apply_serials(entry, item)
                _update_last_cost(item, unit_cost, receipt.receipt_number)

        receipt.status = 'received'
        received_total = sum(int(i.quantity_received or 0) for i in po.items)
        ordered_total = sum(int(i.quantity_ordered or 0) for i in po.items)
        po.status = 'received' if received_total >= ordered_total else 'partially_received'
        if po.status == 'received':
            po.closed_at = datetime.now(timezone.utc)
        db.session.commit()
    except ShopStockError as e:
        db.session.rollback()
        return stock_error(e)

    audit('shop_goods_received', 'shop_goods_receipt', receipt.id,
          new_value=payload_for(receipt, include_items=True))
    notify_shop('shop.purchases.view', 'shop_goods_received',
                f'{receipt.receipt_number} received into {po.branch.name} for '
                f'{po.po_number} ({receipt.total_cost:,.0f} cost).',
                related_type='shop_goods_receipt', related_id=receipt.id)
    return jsonify({'goods_receipt': payload_for(receipt, include_items=True),
                    'purchase_order': payload_for(po)}), 201


def _po_line(po, entry):
    if entry.get('item_id'):
        return next((i for i in po.items if i.id == int(entry['item_id'])), None)
    product, variant = _resolve_item_shim(entry)
    return next((i for i in po.items
                 if i.product_id == product.id
                 and i.variant_id == (variant.id if variant else None)), None)


def _apply_serials(entry, item):
    serials = entry.get('serial_numbers') or entry.get('serials') or []
    if not serials:
        return
    product = ShopProduct.query.get(item.product_id)
    if product is None or not product.is_serialized:
        return
    for number in serials[:item.quantity_accepted]:
        number = str(number).strip()
        if not number:
            continue
        if ShopSerializedItem.query.filter_by(serial_number=number).first():
            continue
        db.session.add(ShopSerializedItem(
            serial_number=number, product_id=item.product_id,
            variant_id=item.variant_id, branch_id=item.goods_receipt.branch_id,
            status='in_stock', condition='good',
            purchase_cost=item.unit_cost,
            selling_price=(product.selling_price or 0),
            supplier_id=item.goods_receipt.purchase_order.supplier_id,
            purchase_order_id=item.goods_receipt.purchase_order_id,
            goods_receipt_id=item.goods_receipt_id,
            received_at=datetime.now(timezone.utc),
            created_at=datetime.now(timezone.utc),
        ))


def _update_last_cost(item, unit_cost, reason):
    """Keep the catalogue's reference cost in step with what was paid."""
    if not unit_cost:
        return
    product = ShopProduct.query.get(item.product_id)
    if product is None:
        return
    if item.variant_id:
        variant = ShopProductVariant.query.get(item.variant_id)
        if variant is not None and float(variant.purchase_cost or 0) != float(unit_cost):
            db.session.add(ShopProductPriceHistory(
                product_id=product.id, variant_id=variant.id,
                field='purchase_cost',
                old_value=str(variant.purchase_cost or 0),
                new_value=str(unit_cost), reason=reason,
                changed_by=current_user_id(),
                created_at=datetime.now(timezone.utc)))
            variant.purchase_cost = unit_cost
        return
    if float(product.purchase_cost or 0) != float(unit_cost):
        db.session.add(ShopProductPriceHistory(
            product_id=product.id, field='purchase_cost',
            old_value=str(product.purchase_cost or 0),
            new_value=str(unit_cost), reason=reason,
            changed_by=current_user_id(),
            created_at=datetime.now(timezone.utc)))
        product.purchase_cost = unit_cost


# ── supplier returns ─────────────────────────────────────────────────────────

@bp.get('/supplier-returns')
@require_permission('shop.purchases.view')
def list_supplier_returns():
    q = ShopSupplierReturn.query
    branch_id = scoped_branch_id()
    if branch_id is not None:
        q = q.filter_by(branch_id=branch_id)
    if request.args.get('status'):
        q = q.filter_by(status=request.args.get('status'))
    p = paginate(q.order_by(ShopSupplierReturn.id.desc()))
    user = current_user()
    return paginate_response([r.to_dict(user=user) for r in p.items], p)


@bp.post('/supplier-returns')
@require_permission('shop.inventory.adjust')
def create_supplier_return():
    data = parse_json()
    entries = data.get('items') or []
    if not entries:
        return json_error('At least one item is required', 400)
    supplier = ShopSupplier.query.get(data.get('supplier_id')) if data.get(
        'supplier_id') else None
    if supplier is None:
        return json_error('A supplier is required', 400)
    try:
        branch = resolve_branch(data.get('branch_id'))
    except ShopStockError as e:
        return stock_error(e)
    row = ShopSupplierReturn(
        return_number=next_number('supplier_return'), supplier_id=supplier.id,
        branch_id=branch.id, purchase_order_id=data.get('purchase_order_id'),
        reason=data.get('reason') or 'defective', notes=data.get('notes'),
        created_by=current_user_id(),
    )
    db.session.add(row)
    db.session.flush()
    total = 0.0
    try:
        for entry in entries:
            product, variant = _resolve_item_shim(entry)
            quantity = int(entry.get('quantity') or 0)
            if quantity <= 0:
                raise ShopStockError('Quantity must be positive', 400,
                                     'invalid_quantity')
            unit_cost = entry.get('unit_cost')
            if unit_cost is None:
                unit_cost = (variant.purchase_cost if variant is not None
                             else product.purchase_cost)
            row.items.append(ShopSupplierReturnItem(
                product_id=product.id, variant_id=variant.id if variant else None,
                quantity=quantity, unit_cost=unit_cost or 0,
                condition=entry.get('condition') or 'defective',
                note=entry.get('note')))
            total += quantity * float(unit_cost or 0)
        row.credit_amount = total
        if data.get('complete'):
            _complete_supplier_return(row)
        db.session.commit()
    except ShopStockError as e:
        db.session.rollback()
        return stock_error(e)
    audit('shop_supplier_return_created', 'shop_supplier_return', row.id,
          new_value=payload_for(row, include_items=True))
    return jsonify({'supplier_return': payload_for(row, include_items=True)}), 201


@bp.post('/supplier-returns/<int:row_id>/complete')
@require_permission('shop.inventory.adjust')
def complete_supplier_return(row_id):
    row = ShopSupplierReturn.query.get(row_id)
    if not row:
        return json_error('Supplier return not found', 404)
    if row.status in ('completed', 'cancelled'):
        return json_error(f'A {row.status} return cannot be completed', 409,
                          'supplier_return_completed')
    # Guarded claim: completing twice posted `supplier_return` twice and took
    # the same units out of stock (and out of the cost ledger) again.
    if db.session.execute(
            update(ShopSupplierReturn)
            .where(ShopSupplierReturn.id == row.id)
            .where(ShopSupplierReturn.status.notin_(['completed', 'cancelled']))
            .values(status='completed')).rowcount == 0:
        return json_error('That supplier return was already completed', 409,
                          'supplier_return_completed')
    row.status = 'completed'
    try:
        _complete_supplier_return(row)
        db.session.commit()
    except ShopStockError as e:
        db.session.rollback()
        return stock_error(e)
    audit('shop_supplier_return_completed', 'shop_supplier_return', row.id,
          previous_value={'status': 'draft'}, new_value=payload_for(row))
    return jsonify({'supplier_return': payload_for(row, include_items=True)})


def _complete_supplier_return(row):
    for item in row.items:
        post_movement(product_id=item.product_id, branch_id=row.branch_id,
                      variant_id=item.variant_id,
                      movement_type='supplier_return', quantity=-item.quantity,
                      unit_cost=float(item.unit_cost or 0),
                      reference_type='supplier_return', reference_id=row.id,
                      note=f'{row.return_number} to {row.supplier.company_name}',
                      user_id=current_user_id())
    row.status = 'completed'


def _parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None
