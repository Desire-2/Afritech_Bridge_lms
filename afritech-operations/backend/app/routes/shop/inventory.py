"""Shop inventory endpoints: balances, ledger, counts, adjustments, transfers.

Stock never changes here directly — every change goes through
``services.shop_inventory`` so a ledger row and the cached balance stay in the
same transaction. Failures surface as 409 with a machine-readable ``code`` so
the POS can tell "someone else sold the last unit" apart from a validation
error.
"""
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify
from sqlalchemy import update

from ...extensions import db
from ...models import (
    ShopInventoryBalance, ShopStockMovement, ShopProduct, ShopProductVariant,
    ShopStockCount, ShopStockCountItem, ShopStockAdjustment,
    ShopStockAdjustmentItem, ShopStockTransfer, ShopStockTransferItem,
    ShopSerializedItem, ShopStockAlert, Branch,
)
from ...auth.auth import require_permission, require_any_permission, current_user
from ...auth.shop_scope import can_view_shop_costs, can_view_all_shop_branches
from ...services.audit import audit
from ...services.shop_inventory import (
    ShopStockError, post_movement, reserve, release_reservation, damage,
    restore_damaged, get_balance, product_stock, stock_value,
)
from ...services.shop_series import next_number
from ..helpers import json_error, parse_json, paginate, paginate_response, required
from .common import (
    payload_for, resolve_branch, scoped_branch_id, user_branch_id,
    stock_error, current_user_id, notify_shop, request_branch_id_from_body,
)

bp = Blueprint('shop_inventory', __name__, url_prefix='/api/shop/inventory')


def _branch_filter(query, model=None):
    branch_id = scoped_branch_id()
    if branch_id is None:
        return query
    target = model or ShopInventoryBalance
    return query.filter(target.branch_id == branch_id)


def _claim_status(model, row_id, allowed, **values):
    """Move a document to a new status in one guarded statement.

    The pre-check in each endpoint only protects the request that reads it;
    two tills clicking "receive" at the same moment both pass that check. The
    ``WHERE status IN (...)`` predicate makes the second one lose with a 409
    instead of posting the same stock movement twice.
    """
    stmt = (update(model)
            .where(model.id == row_id)
            .where(model.status.in_(list(allowed)))
            .values(**values))
    return db.session.execute(stmt).rowcount


# ── balances ─────────────────────────────────────────────────────────────────

@bp.get('/balances')
@require_permission('shop.inventory.view')
def list_balances():
    q = ShopInventoryBalance.query
    branch_id = scoped_branch_id()
    if branch_id is not None:
        q = q.filter(ShopInventoryBalance.branch_id == branch_id)
    elif request.args.get('branch_id', type=int):
        q = q.filter(ShopInventoryBalance.branch_id == request.args.get('branch_id', type=int))
    if request.args.get('product_id', type=int):
        q = q.filter_by(product_id=request.args.get('product_id', type=int))
    if request.args.get('variant_id', type=int):
        q = q.filter_by(variant_id=request.args.get('variant_id', type=int))
    if request.args.get('branch_id', type=int) is None and request.args.get('all_branches') != 'true':
        pass
    search = request.args.get('q', '').strip()
    if search:
        q = q.join(ShopProduct, ShopProduct.id == ShopInventoryBalance.product_id).filter(
            db.or_(ShopProduct.name.ilike(f'%{search}%'),
                   ShopProduct.sku.ilike(f'%{search}%')))
    if request.args.get('low_stock') == 'true':
        q = q.join(ShopProduct, ShopProduct.id == ShopInventoryBalance.product_id).filter(
            ShopInventoryBalance.quantity <= ShopProduct.reorder_level,
            ShopProduct.reorder_level > 0)
    if request.args.get('in_stock') == 'true':
        q = q.filter(ShopInventoryBalance.quantity > 0)
    order = request.args.get('order', 'product')
    ordering = {'product': ShopInventoryBalance.product_id,
                'quantity': ShopInventoryBalance.quantity.asc(),
                'updated': ShopInventoryBalance.updated_at.desc()}.get(
                    order, ShopInventoryBalance.product_id)
    p = paginate(q.order_by(ordering))
    user = current_user()
    return paginate_response([b.to_dict(user=user) for b in p.items], p)


@bp.get('/summary')
@require_permission('shop.inventory.view')
def inventory_summary():
    user = current_user()
    branch_id = scoped_branch_id()
    q = ShopInventoryBalance.query
    if branch_id is not None:
        q = q.filter(ShopInventoryBalance.branch_id == branch_id)
    rows = q.all()
    on_hand = sum(int(r.quantity) for r in rows)
    available = sum(max(int(r.quantity) - int(r.reserved_quantity), 0) for r in rows)
    data = {
        'lines': len(rows),
        'on_hand': on_hand,
        'reserved': sum(int(r.reserved_quantity) for r in rows),
        'damaged': sum(int(r.damaged_quantity) for r in rows),
        'available': available,
        'out_of_stock': len([r for r in rows if int(r.quantity) <= 0]),
        'low_stock': len([r for r in rows
                          if 0 < int(r.quantity) <= _reorder_level(r)]),
    }
    if can_view_shop_costs(user):
        data['stock_value'] = round(stock_value(branch_id), 2)
    return jsonify({'summary': data})


def _reorder_level(balance):
    product = balance.product
    if product is None:
        return 0
    return int(product.reorder_level or 0)


@bp.get('/movements')
@require_permission('shop.inventory.view')
def list_movements():
    q = ShopStockMovement.query
    branch_id = scoped_branch_id()
    if branch_id is not None:
        q = q.filter(ShopStockMovement.branch_id == branch_id)
    elif request.args.get('branch_id', type=int):
        q = q.filter(ShopStockMovement.branch_id == request.args.get('branch_id', type=int))
    if request.args.get('product_id', type=int):
        q = q.filter_by(product_id=request.args.get('product_id', type=int))
    movement_type = request.args.get('movement_type')
    if movement_type:
        q = q.filter_by(movement_type=movement_type)
    if request.args.get('start'):
        q = q.filter(ShopStockMovement.created_at >=
                     datetime.fromisoformat(request.args.get('start')))
    if request.args.get('end'):
        q = q.filter(ShopStockMovement.created_at <=
                     datetime.fromisoformat(request.args.get('end')))
    p = paginate(q.order_by(ShopStockMovement.id.desc()))
    user = current_user()
    return paginate_response([m.to_dict(user=user) for m in p.items], p)


@bp.get('/stock/<int:product_id>')
@require_permission('shop.inventory.view')
def product_balances(product_id):
    product = ShopProduct.query.get(product_id)
    if not product:
        return json_error('Product not found', 404)
    branch_id = request.args.get('branch_id', type=int)
    data = product_stock(product_id, branch_id)
    data['product'] = payload_for(product)
    return jsonify({'stock': data})


# ── adjustments ──────────────────────────────────────────────────────────────

@bp.get('/adjustments')
@require_permission('shop.inventory.view')
def list_adjustments():
    q = ShopStockAdjustment.query
    branch_id = scoped_branch_id()
    if branch_id is not None:
        q = q.filter(ShopStockAdjustment.branch_id == branch_id)
    if request.args.get('status'):
        q = q.filter_by(status=request.args.get('status'))
    p = paginate(q.order_by(ShopStockAdjustment.id.desc()))
    user = current_user()
    return paginate_response([a.to_dict(user=user) for a in p.items], p)


@bp.post('/adjustments')
@require_permission('shop.inventory.adjust')
def create_adjustment():
    data = parse_json()
    items = data.get('items') or []
    if not items:
        return json_error('At least one item is required', 400)
    reason = data.get('reason')
    if reason not in ('damage', 'loss', 'correction', 'shrinkage', 'found',
                      'return_to_supplier', 'other'):
        return json_error('A valid reason is required', 400)
    try:
        branch = resolve_branch(request_branch_id_from_body(data))
    except ShopStockError as e:
        return stock_error(e)

    movement_type = data.get('movement_type') or (
        'damage' if reason == 'damage' else
        'loss' if reason == 'loss' else 'adjustment')
    direction = data.get('direction', 'out')

    adjustment = ShopStockAdjustment(
        adjustment_number=next_number('adjustment'),
        branch_id=branch.id, movement_type=movement_type, reason=reason,
        notes=data.get('notes'), status='applied',
        created_by=current_user_id(),
    )
    db.session.add(adjustment)
    db.session.flush()

    try:
        for entry in items:
            product, variant = _resolve_item(entry)
            quantity = int(entry.get('quantity') or 0)
            if quantity == 0:
                raise ShopStockError('Quantity must not be zero', 400,
                                     'invalid_quantity')
            signed = -abs(quantity) if direction == 'out' else abs(quantity)
            adjustment.items.append(ShopStockAdjustmentItem(
                product_id=product.id, variant_id=variant.id if variant else None,
                quantity=abs(quantity), note=entry.get('note')))
            if movement_type == 'damage' and direction == 'out':
                damage(product.id, branch.id, abs(quantity),
                       variant_id=variant.id if variant else None,
                       reference_type='adjustment', reference_id=adjustment.id,
                       movement_type='damage', note=entry.get('note'),
                       user_id=current_user_id())
            elif movement_type == 'damage' and direction == 'in':
                restore_damaged(product.id, branch.id, abs(quantity),
                                variant_id=variant.id if variant else None,
                                reference_type='adjustment',
                                reference_id=adjustment.id,
                                movement_type='correction',
                                note=entry.get('note'),
                                user_id=current_user_id())
            else:
                post_movement(product_id=product.id, branch_id=branch.id,
                              variant_id=variant.id if variant else None,
                              movement_type=movement_type, quantity=signed,
                              reference_type='adjustment',
                              reference_id=adjustment.id,
                              note=entry.get('note'), user_id=current_user_id())
        adjustment.applied_at = datetime.now(timezone.utc)
        db.session.commit()
    except ShopStockError as e:
        db.session.rollback()
        return stock_error(e)

    audit('shop_adjustment_applied', 'shop_adjustment', adjustment.id,
          new_value=payload_for(adjustment))
    return jsonify({'adjustment': payload_for(adjustment, include_items=True)}), 201


def _resolve_item(entry):
    product_id = entry.get('product_id')
    variant_id = entry.get('variant_id')
    if not product_id and entry.get('sku'):
        product = ShopProduct.query.filter_by(sku=entry['sku']).first()
        if product is None:
            product = ShopProduct.query.filter_by(barcode=entry['sku']).first()
        if product is None:
            raise ShopStockError(f"No product for SKU {entry['sku']}", 404,
                                 'product_not_found')
    else:
        product = ShopProduct.query.get(product_id) if product_id else None
    if product is None:
        raise ShopStockError('Product not found', 404, 'product_not_found')
    variant = ShopProductVariant.query.get(variant_id) if variant_id else None
    return product, variant


@bp.get('/adjustments/<int:row_id>')
@require_permission('shop.inventory.view')
def get_adjustment(row_id):
    row = ShopStockAdjustment.query.get(row_id)
    if not row:
        return json_error('Adjustment not found', 404)
    return jsonify({'adjustment': payload_for(row, include_items=True)})


# ── stock counts ─────────────────────────────────────────────────────────────

@bp.get('/counts')
@require_permission('shop.inventory.view')
def list_counts():
    q = ShopStockCount.query
    branch_id = scoped_branch_id()
    if branch_id is not None:
        q = q.filter(ShopStockCount.branch_id == branch_id)
    if request.args.get('status'):
        q = q.filter_by(status=request.args.get('status'))
    p = paginate(q.order_by(ShopStockCount.id.desc()))
    user = current_user()
    return paginate_response([c.to_dict(user=user) for c in p.items], p)


@bp.get('/counts/<int:row_id>')
@require_permission('shop.inventory.view')
def get_count(row_id):
    row = ShopStockCount.query.get(row_id)
    if not row:
        return json_error('Count not found', 404)
    return jsonify({'count': payload_for(row, include_items=True)})


@bp.post('/counts')
@require_permission('shop.inventory.count')
def create_count():
    data = parse_json()
    try:
        branch = resolve_branch(request_branch_id_from_body(data))
    except ShopStockError as e:
        return stock_error(e)
    row = ShopStockCount(
        count_number=next_number('count'), branch_id=branch.id,
        count_type=data.get('count_type') or 'cycle',
        notes=data.get('notes'), created_by=current_user_id(),
        counted_at=datetime.now(timezone.utc),
    )
    db.session.add(row)
    db.session.flush()

    product_ids = data.get('product_ids') or []
    balances = ShopInventoryBalance.query.filter_by(branch_id=branch.id)
    if product_ids:
        balances = balances.filter(
            ShopInventoryBalance.product_id.in_([int(x) for x in product_ids]))
    for balance in balances.all():
        row.items.append(ShopStockCountItem(
            product_id=balance.product_id, variant_id=balance.variant_id,
            expected_quantity=int(balance.quantity),
            system_quantity=int(balance.quantity)))
    db.session.commit()
    audit('shop_count_started', 'shop_stock_count', row.id,
          new_value=payload_for(row))
    return jsonify({'count': payload_for(row, include_items=True)}), 201


@bp.post('/counts/<int:row_id>/submit')
@require_permission('shop.inventory.count')
def submit_count(row_id):
    row = ShopStockCount.query.get(row_id)
    if not row:
        return json_error('Count not found', 404)
    if row.status not in ('draft', 'submitted'):
        return json_error(f'A {row.status} count cannot be edited', 409)
    data = parse_json()
    counted = data.get('counted') or {}
    # Accept a list of {id|product_id, counted_quantity} or a {product_id: n} map.
    if isinstance(counted, list):
        for entry in counted:
            item = next((i for i in row.items
                         if i.id == entry.get('id')
                         or (entry.get('product_id') and
                             i.product_id == int(entry['product_id'])
                             and i.variant_id == entry.get('variant_id'))), None)
            if item and entry.get('counted_quantity') is not None:
                item.counted_quantity = int(entry['counted_quantity'])
                if entry.get('note'):
                    item.note = entry['note']
    elif isinstance(counted, dict):
        for key, value in counted.items():
            item = next((i for i in row.items if i.product_id == int(key)), None)
            if item is not None and value is not None:
                item.counted_quantity = int(value)
    uncounted = [i for i in row.items if i.counted_quantity is None]
    if uncounted and not data.get('allow_partial'):
        return json_error(
            f'{len(uncounted)} line(s) still need a counted quantity '
            f'(or resend with allow_partial=true)', 400)
    row.status = 'submitted'
    row.notes = data.get('notes') or row.notes
    db.session.commit()
    audit('shop_count_submitted', 'shop_stock_count', row.id,
          new_value=payload_for(row, include_items=True))
    return jsonify({'count': payload_for(row, include_items=True)})


@bp.post('/counts/<int:row_id>/approve')
@require_permission('shop.inventory.adjust')
def approve_count(row_id):
    row = ShopStockCount.query.get(row_id)
    if not row:
        return json_error('Count not found', 404)
    if row.status != 'submitted':
        return json_error('Only a submitted count can be approved', 409,
                          'count_already_processed')
    data = parse_json()
    if _claim_status(ShopStockCount, row.id, ('submitted',),
                     status='approved') == 0:
        return json_error('That count was already approved or rejected', 409,
                          'count_already_processed')
    row.status = 'approved'
    row.approved_at = datetime.now(timezone.utc)
    row.approved_by = current_user_id()
    try:
        for item in row.items:
            if item.counted_quantity is None:
                continue
            variance = int(item.counted_quantity) - int(item.system_quantity)
            if variance == 0:
                continue
            post_movement(product_id=item.product_id, branch_id=row.branch_id,
                          variant_id=item.variant_id,
                          movement_type='stock_count', quantity=variance,
                          reference_type='stock_count', reference_id=row.id,
                          note=f'Count {row.count_number} variance',
                          user_id=current_user_id())
    except ShopStockError as e:
        db.session.rollback()
        return stock_error(e)
    db.session.commit()
    audit('shop_count_approved', 'shop_stock_count', row.id,
          previous_value={'status': 'submitted'}, new_value=payload_for(row))
    notify_shop('shop.inventory.view', 'shop_goods_received',
                f'Stock count {row.count_number} approved for {row.branch.name}.',
                related_type='shop_stock_count', related_id=row.id)
    return jsonify({'count': payload_for(row, include_items=True)})


@bp.post('/counts/<int:row_id>/reject')
@require_permission('shop.inventory.adjust')
def reject_count(row_id):
    row = ShopStockCount.query.get(row_id)
    if not row:
        return json_error('Count not found', 404)
    if row.status != 'submitted':
        return json_error('Only a submitted count can be rejected', 409,
                          'count_already_processed')
    if _claim_status(ShopStockCount, row.id, ('submitted',),
                     status='rejected') == 0:
        return json_error('That count was already approved or rejected', 409,
                          'count_already_processed')
    row.status = 'rejected'
    db.session.commit()
    audit('shop_count_rejected', 'shop_stock_count', row.id,
          previous_value={'status': 'submitted'}, new_value=payload_for(row))
    return jsonify({'count': payload_for(row)})


# ── transfers ────────────────────────────────────────────────────────────────

@bp.get('/transfers')
@require_permission('shop.inventory.view')
def list_transfers():
    q = ShopStockTransfer.query
    branch_id = scoped_branch_id()
    if branch_id is not None and not can_view_all_shop_branches(current_user()):
        q = q.filter(db.or_(ShopStockTransfer.from_branch_id == branch_id,
                            ShopStockTransfer.to_branch_id == branch_id))
    elif request.args.get('branch_id', type=int):
        bid = request.args.get('branch_id', type=int)
        q = q.filter(db.or_(ShopStockTransfer.from_branch_id == bid,
                            ShopStockTransfer.to_branch_id == bid))
    if request.args.get('status'):
        q = q.filter_by(status=request.args.get('status'))
    p = paginate(q.order_by(ShopStockTransfer.id.desc()))
    user = current_user()
    return paginate_response([t.to_dict(user=user) for t in p.items], p)


@bp.get('/transfers/<int:row_id>')
@require_permission('shop.inventory.view')
def get_transfer(row_id):
    row = ShopStockTransfer.query.get(row_id)
    if not row:
        return json_error('Transfer not found', 404)
    return jsonify({'transfer': payload_for(row, include_items=True)})


@bp.post('/transfers')
@require_permission('shop.inventory.transfer')
def create_transfer():
    data = parse_json()
    items = data.get('items') or []
    if not items:
        return json_error('At least one item is required', 400)
    from_branch_id = data.get('from_branch_id') or user_branch_id()
    to_branch_id = data.get('to_branch_id')
    if not from_branch_id or not to_branch_id:
        return json_error('from_branch_id and to_branch_id are required', 400)
    if int(from_branch_id) == int(to_branch_id):
        return json_error('Source and destination branches must differ', 400)
    from_branch = Branch.query.get(from_branch_id)
    to_branch = Branch.query.get(to_branch_id)
    if not from_branch or not to_branch:
        return json_error('Branch not found', 404)

    row = ShopStockTransfer(
        transfer_number=next_number('transfer'),
        from_branch_id=from_branch.id, to_branch_id=to_branch.id,
        reason=data.get('reason'), notes=data.get('notes'),
        expected_at=_parse_dt(data.get('expected_at')),
        requested_by=current_user_id(),
    )
    db.session.add(row)
    db.session.flush()
    for entry in items:
        product, variant = _resolve_item(entry)
        quantity = int(entry.get('quantity') or entry.get('quantity_requested') or 0)
        if quantity <= 0:
            raise ShopStockError('Transfer quantity must be positive', 400,
                                 'invalid_quantity')
        row.items.append(ShopStockTransferItem(
            product_id=product.id, variant_id=variant.id if variant else None,
            quantity_requested=quantity, note=entry.get('note')))
    db.session.commit()
    audit('shop_transfer_created', 'shop_stock_transfer', row.id,
          new_value=payload_for(row))
    notify_shop('shop.inventory.transfer', 'shop_transfer_ready',
                f'Transfer {row.transfer_number} to {to_branch.name} is waiting '
                f'to be dispatched.',
                related_type='shop_stock_transfer', related_id=row.id,
                rule='shop-transfer')
    return jsonify({'transfer': payload_for(row, include_items=True)}), 201


@bp.post('/transfers/<int:row_id>/dispatch')
@require_permission('shop.inventory.transfer')
def dispatch_transfer(row_id):
    row = ShopStockTransfer.query.get(row_id)
    if not row:
        return json_error('Transfer not found', 404)
    if row.status not in ('requested', 'approved'):
        return json_error(f'A {row.status} transfer cannot be dispatched', 409,
                          'transfer_already_dispatched')
    data = parse_json()
    if _claim_status(ShopStockTransfer, row.id, ('requested', 'approved'),
                     status='dispatched') == 0:
        return json_error('That transfer was already dispatched', 409,
                          'transfer_already_dispatched')
    row.status = 'dispatched'
    row.dispatched_at = datetime.now(timezone.utc)
    row.dispatched_by = current_user_id()
    try:
        for item in row.items:
            quantity = int((data.get('quantities') or {}).get(str(item.id))
                           or item.quantity_requested)
            if quantity <= 0:
                continue
            post_movement(product_id=item.product_id, branch_id=row.from_branch_id,
                          variant_id=item.variant_id,
                          movement_type='transfer_out', quantity=-quantity,
                          reference_type='stock_transfer', reference_id=row.id,
                          note=f'Transfer {row.transfer_number}',
                          user_id=current_user_id())
            item.quantity_dispatched = quantity
    except ShopStockError as e:
        db.session.rollback()
        return stock_error(e)
    db.session.commit()
    audit('shop_transfer_dispatched', 'shop_stock_transfer', row.id,
          previous_value={'status': 'requested'}, new_value=payload_for(row))
    notify_shop('shop.inventory.transfer', 'shop_transfer_ready',
                f'Transfer {row.transfer_number} has left '
                f'{row.from_branch.name} and is on its way to '
                f'{row.to_branch.name}.',
                related_type='shop_stock_transfer', related_id=row.id,
                rule='shop-transfer')
    return jsonify({'transfer': payload_for(row, include_items=True)})


@bp.post('/transfers/<int:row_id>/receive')
@require_permission('shop.inventory.transfer')
def receive_transfer(row_id):
    row = ShopStockTransfer.query.get(row_id)
    if not row:
        return json_error('Transfer not found', 404)
    if row.status != 'dispatched':
        return json_error(f'A {row.status} transfer cannot be received', 409,
                          'transfer_already_received')
    data = parse_json()
    # Claim first: receiving twice used to post `transfer_in` twice, which is
    # stock conjured at the destination out of nothing.
    if _claim_status(ShopStockTransfer, row.id, ('dispatched',),
                     status='received') == 0:
        return json_error('That transfer has already been received', 409,
                          'transfer_already_received')
    row.status = 'received'
    row.received_at = datetime.now(timezone.utc)
    row.received_by = current_user_id()
    try:
        for item in row.items:
            dispatched = int(item.quantity_dispatched or 0)
            quantity = int((data.get('quantities') or {}).get(str(item.id))
                           or dispatched)
            if quantity <= 0:
                item.quantity_received = 0
                continue
            if quantity > dispatched:
                raise ShopStockError(
                    f'{quantity} unit(s) received but only {dispatched} left '
                    f'{row.from_branch.name}', 409,
                    'received_exceeds_dispatched')
            post_movement(product_id=item.product_id, branch_id=row.to_branch_id,
                          variant_id=item.variant_id,
                          movement_type='transfer_in', quantity=quantity,
                          reference_type='stock_transfer', reference_id=row.id,
                          note=f'Transfer {row.transfer_number}',
                          user_id=current_user_id())
            item.quantity_received = quantity
    except ShopStockError as e:
        db.session.rollback()
        return stock_error(e)
    db.session.commit()
    audit('shop_transfer_received', 'shop_stock_transfer', row.id,
          previous_value={'status': 'dispatched'}, new_value=payload_for(row))
    notify_shop('shop.inventory.view', 'shop_goods_received',
                f'Transfer {row.transfer_number} received at {row.to_branch.name}.',
                related_type='shop_stock_transfer', related_id=row.id,
                rule='shop-transfer')
    return jsonify({'transfer': payload_for(row, include_items=True)})


@bp.post('/transfers/<int:row_id>/cancel')
@require_permission('shop.inventory.transfer')
def cancel_transfer(row_id):
    row = ShopStockTransfer.query.get(row_id)
    if not row:
        return json_error('Transfer not found', 404)
    if row.status in ('received', 'cancelled'):
        return json_error('A received transfer cannot be cancelled', 409,
                          'transfer_cannot_be_cancelled')
    was_dispatched = row.status == 'dispatched'
    if _claim_status(ShopStockTransfer, row.id,
                     ('requested', 'approved', 'dispatched'),
                     status='cancelled') == 0:
        return json_error('That transfer has already been cancelled', 409,
                          'transfer_already_cancelled')
    row.status = 'cancelled'
    try:
        if was_dispatched:
            # The units already left the source branch. Cancelling without
            # putting them back would leave the stock in limbo — neither
            # branch holds it and the ledger no longer balances.
            for item in row.items:
                quantity = int(item.quantity_dispatched or 0)
                if quantity <= 0:
                    continue
                post_movement(product_id=item.product_id,
                              branch_id=row.from_branch_id,
                              variant_id=item.variant_id,
                              movement_type='transfer_in', quantity=quantity,
                              reference_type='stock_transfer',
                              reference_id=row.id,
                              note=f'Transfer {row.transfer_number} cancelled',
                              user_id=current_user_id())
    except ShopStockError as e:
        db.session.rollback()
        return stock_error(e)
    db.session.commit()
    audit('shop_transfer_cancelled', 'shop_stock_transfer', row.id,
          new_value=payload_for(row))
    return jsonify({'transfer': payload_for(row)})


# ── serialized items ─────────────────────────────────────────────────────────

@bp.get('/serials')
@require_permission('shop.inventory.view')
def list_serials():
    q = ShopSerializedItem.query
    branch_id = scoped_branch_id()
    if branch_id is not None:
        q = q.filter(ShopSerializedItem.branch_id == branch_id)
    elif request.args.get('branch_id', type=int):
        q = q.filter_by(branch_id=request.args.get('branch_id', type=int))
    if request.args.get('product_id', type=int):
        q = q.filter_by(product_id=request.args.get('product_id', type=int))
    if request.args.get('status'):
        q = q.filter_by(status=request.args.get('status'))
    search = request.args.get('q', '').strip()
    if search:
        q = q.filter(ShopSerializedItem.serial_number.ilike(f'%{search}%'))
    p = paginate(q.order_by(ShopSerializedItem.id.desc()))
    user = current_user()
    return paginate_response([s.to_dict(user=user) for s in p.items], p)


@bp.post('/serials')
@require_permission('shop.inventory.adjust')
def register_serial():
    data = parse_json()
    missing = required(data, 'serial_number', 'product_id')
    if missing:
        return json_error(f'{", ".join(missing)} is required', 400)
    try:
        branch = resolve_branch(request_branch_id_from_body(data))
    except ShopStockError as e:
        return stock_error(e)
    product = ShopProduct.query.get(data['product_id'])
    if not product:
        return json_error('Product not found', 404)
    if not product.is_serialized:
        return json_error('That product is not tracked by serial number', 400)
    serial_number = str(data['serial_number']).strip()
    if ShopSerializedItem.query.filter_by(serial_number=serial_number).first():
        return json_error('That serial number is already registered', 409)
    variant = (ShopProductVariant.query.get(data['variant_id'])
               if data.get('variant_id') else None)
    row = ShopSerializedItem(
        serial_number=serial_number, product_id=product.id,
        variant_id=variant.id if variant else None, branch_id=branch.id,
        status=data.get('status') or 'in_stock',
        condition=data.get('condition') or 'good',
        purchase_cost=data.get('purchase_cost') or 0,
        selling_price=data.get('selling_price') or product.selling_price,
        note=data.get('note'), received_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(row)
    db.session.flush()
    if data.get('add_to_stock'):
        try:
            post_movement(product_id=product.id, branch_id=branch.id,
                          variant_id=row.variant_id,
                          movement_type='opening_balance', quantity=1,
                          unit_cost=float(data.get('purchase_cost') or 0),
                          reference_type='serialized_item', reference_id=row.id,
                          note=f'Serial {serial_number}',
                          user_id=current_user_id())
        except ShopStockError as e:
            db.session.rollback()
            return stock_error(e)
    db.session.commit()
    audit('shop_serial_registered', 'shop_serialized_item', row.id,
          new_value=payload_for(row))
    return jsonify({'serial': payload_for(row)}), 201


@bp.patch('/serials/<int:row_id>')
@require_permission('shop.inventory.adjust')
def update_serial(row_id):
    row = ShopSerializedItem.query.get(row_id)
    if not row:
        return json_error('Serial not found', 404)
    data = parse_json()
    previous = payload_for(row)
    for field in ('status', 'condition', 'note'):
        if field in data:
            setattr(row, field, data.get(field))
    row.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    audit('shop_serial_updated', 'shop_serialized_item', row.id,
          previous_value=previous, new_value=payload_for(row))
    return jsonify({'serial': payload_for(row)})


# ── alerts ───────────────────────────────────────────────────────────────────

@bp.get('/alerts')
@require_permission('shop.inventory.view')
def list_alerts():
    q = ShopStockAlert.query
    if request.args.get('open') != 'false':
        q = q.filter(ShopStockAlert.resolved_at.is_(None))
    if request.args.get('alert_type'):
        q = q.filter_by(alert_type=request.args.get('alert_type'))
    p = paginate(q.order_by(ShopStockAlert.created_at.desc()))
    return paginate_response([a.to_dict() for a in p.items], p)


@bp.post('/alerts/<int:row_id>/resolve')
@require_permission('shop.inventory.view')
def resolve_alert(row_id):
    row = ShopStockAlert.query.get(row_id)
    if not row:
        return json_error('Alert not found', 404)
    row.resolved_at = datetime.now(timezone.utc)
    db.session.commit()
    audit('shop_alert_resolved', 'shop_stock_alert', row.id,
          new_value=row.to_dict())
    return jsonify({'alert': row.to_dict()})


def _parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None
