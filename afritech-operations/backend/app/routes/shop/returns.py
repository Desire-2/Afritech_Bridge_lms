"""Customer returns and exchanges.

Approving a return does three things in one transaction: puts the units back
(or into the damaged pool when they cannot be sold), books the refund against
the original sale, and — for an exchange — raises a linked replacement sale so
the price difference is settled exactly once.
"""
from datetime import datetime, timezone
from decimal import Decimal

from flask import Blueprint, request, jsonify
from sqlalchemy import func, update

from ...extensions import db
from ...models import (
    ShopReturn, ShopReturnItem, ShopSale, ShopSaleItem, ShopPayment,
    ShopSerializedItem, PaymentMethod,
)
from ...auth.auth import require_permission, require_any_permission, current_user
from ...services.audit import audit
from ...services.shop_inventory import (
    ShopStockError, post_movement, add_defective, ensure_product,
)
from ...services.shop_series import next_number
from ..helpers import json_error, parse_json, paginate, paginate_response
from .common import (
    payload_for, stock_error, current_user_id, notify_shop,
    scoped_branch_id, evaluate_discount,
)
from .sales import (
    _build_lines, _price_lines, _money, _apply_payments, _resolve_customer,
    _open_shift_id, _assign_serials, _register_warranty, _available_serials,
    _effective_discount_percent,
)

bp = Blueprint('shop_returns', __name__, url_prefix='/api/shop')

RESTOCK_CONDITIONS = ('good',)
DEFECTIVE_CONDITIONS = ('damaged', 'under_inspection', 'incomplete')


# ── listing ──────────────────────────────────────────────────────────────────

@bp.get('/returns')
@require_any_permission('shop.returns.view', 'shop.sales.view')
def list_returns():
    q = ShopReturn.query
    branch_id = scoped_branch_id()
    if branch_id is not None:
        q = q.filter(ShopReturn.branch_id == branch_id)
    if request.args.get('status'):
        q = q.filter_by(status=request.args.get('status'))
    if request.args.get('return_type'):
        q = q.filter_by(return_type=request.args.get('return_type'))
    if request.args.get('sale_id', type=int):
        q = q.filter_by(sale_id=request.args.get('sale_id', type=int))
    p = paginate(q.order_by(ShopReturn.id.desc()))
    user = current_user()
    return paginate_response([r.to_dict(user=user) for r in p.items], p)


@bp.get('/returns/<int:row_id>')
@require_any_permission('shop.returns.view', 'shop.sales.view')
def get_return(row_id):
    row = ShopReturn.query.get(row_id)
    if not row:
        return json_error('Return not found', 404)
    return jsonify({'return': payload_for(row, include_items=True)})


# ── request ──────────────────────────────────────────────────────────────────

def _returnable_items(sale, entries):
    items = []
    for entry in entries:
        sale_item = (ShopSaleItem.query.get(entry.get('sale_item_id'))
                     if entry.get('sale_item_id') else None)
        if sale_item is not None and sale_item.sale_id != sale.id:
            # The id came from the client: it must belong to *this* sale, or a
            # return could drain another customer's line and restock their
            # units against this one.
            raise ShopStockError('That item was not part of this sale', 400,
                                 'item_not_on_sale')
        if sale_item is None and entry.get('product_id'):
            sale_item = next(
                (i for i in sale.items
                 if i.product_id == int(entry['product_id'])
                 and (entry.get('variant_id') is None
                      or i.variant_id == int(entry['variant_id']))), None)
        if sale_item is None:
            raise ShopStockError('That item was not part of this sale', 400,
                                 'item_not_on_sale')
        quantity = int(entry.get('quantity') or 1)
        if quantity <= 0:
            raise ShopStockError('Return quantity must be positive', 400,
                                 'invalid_quantity')
        if quantity > sale_item.returnable_quantity:
            raise ShopStockError(
                f'Only {sale_item.returnable_quantity} unit(s) of '
                f'{sale_item.product.name if sale_item.product else "the item"} '
                f'can still be returned', 409, 'quantity_not_returnable')
        condition = entry.get('condition') or 'good'
        item = ShopReturnItem(
            sale_item_id=sale_item.id, product_id=sale_item.product_id,
            variant_id=sale_item.variant_id, quantity=quantity,
            unit_price=sale_item.unit_price, unit_cost=sale_item.unit_cost,
            tax_amount=_money(sale_item.tax_amount or 0)
            * quantity / max(int(sale_item.quantity), 1),
            condition=condition,
            restock=bool(entry.get('restock', condition in RESTOCK_CONDITIONS)),
            serial_id=entry.get('serial_id'), note=entry.get('note'),
        )
        items.append((item, sale_item))
    return items


@bp.post('/returns')
@require_any_permission('shop.returns.create', 'shop.returns.approve')
def create_return():
    data = parse_json()
    sale = ShopSale.query.get(data.get('sale_id'))
    if not sale:
        return json_error('Sale not found', 404)
    if sale.status in ('held', 'cancelled'):
        return json_error('A held or cancelled sale cannot be returned', 409)
    entries = data.get('items') or []
    if not entries:
        return json_error('At least one item is required', 400)
    return_type = data.get('return_type') or 'refund'
    if return_type not in ('refund', 'exchange', 'repair', 'store_credit',
                           'replacement'):
        return json_error('Invalid return type', 400)
    reason = data.get('reason')
    if not reason:
        return json_error('A reason is required', 400)

    try:
        pairs = _returnable_items(sale, entries)
    except ShopStockError as e:
        return stock_error(e)

    row = ShopReturn(
        return_number=next_number('return'), sale_id=sale.id,
        branch_id=sale.branch_id, customer_id=sale.customer_id,
        shift_id=sale.shift_id, return_type=return_type, status='requested',
        reason=reason, notes=data.get('notes'),
        restock_fee=_money(data.get('restock_fee') or 0),
        requested_by=current_user_id(),
    )
    db.session.add(row)
    db.session.flush()
    for item, _ in pairs:
        item.return_id = row.id
        db.session.add(item)
    row.subtotal_returned = _money(sum(
        item.unit_price * item.quantity for item, _ in pairs))
    row.tax_returned = _money(sum(item.tax_amount for item, _ in pairs))
    # The customer paid subtotal + tax; the refund has to give both back or a
    # taxed sale can never reach the `refunded` state.
    row.refund_amount = _money(max(row.subtotal_returned + row.tax_returned
                                   - (row.restock_fee or 0), 0))
    db.session.commit()
    audit('shop_return_requested', 'shop_return', row.id,
          new_value=payload_for(row, include_items=True))
    notify_shop('shop.returns.approve', 'shop_return_approval',
                f'Return {row.return_number} against {sale.sale_number} awaits '
                f'approval.', related_type='shop_return', related_id=row.id,
                rule='shop-return-approval')
    return jsonify({'return': payload_for(row, include_items=True)}), 201


# ── approval ─────────────────────────────────────────────────────────────────

@bp.post('/returns/<int:row_id>/approve')
@require_any_permission('shop.returns.approve', 'shop.sales.refund')
def approve_return(row_id):
    row = ShopReturn.query.get(row_id)
    if not row:
        return json_error('Return not found', 404)
    if row.status not in ('requested', 'received'):
        return json_error(f'A {row.status} return cannot be approved', 409,
                          'return_already_processed')
    data = parse_json()
    decision = data.get('decision', 'approved')
    if decision == 'rejected':
        rejected = db.session.execute(
            update(ShopReturn)
            .where(ShopReturn.id == row.id)
            .where(ShopReturn.status.in_(['requested', 'received']))
            .values(status='rejected',
                    rejected_reason=data.get('note')
                    or data.get('rejected_reason'))).rowcount
        if rejected == 0:
            return json_error('That return has already been processed', 409,
                              'return_already_processed')
        db.session.expire(row)
        db.session.commit()
        audit('shop_return_rejected', 'shop_return', row.id,
              previous_value={'status': 'requested'},
              new_value=payload_for(row, include_items=True))
        return jsonify({'return': payload_for(row, include_items=True)})

    if decision != 'approved':
        return json_error('Decision must be approved or rejected', 400)

    # One approval per return: the conditional claim is what stops two tills
    # approving the same request at once and restocking/refunding twice.
    claimed = db.session.execute(
        update(ShopReturn)
        .where(ShopReturn.id == row.id)
        .where(ShopReturn.status.in_(['requested', 'received']))
        .values(status='approved')).rowcount
    if claimed == 0:
        return json_error('That return has already been processed', 409,
                          'return_already_processed')
    row.status = 'approved'

    sale = row.sale
    try:
        restocked = _restock_return(row)
        refund = _money(row.refund_amount or 0)

        exchange_payload = data.get('exchange')
        exchange_sale = None
        if row.return_type == 'exchange' and exchange_payload:
            exchange_sale = _create_exchange_sale(row, sale, exchange_payload)
            difference = _money(exchange_sale.total_amount or 0)
            if difference >= refund:
                row.exchange_credit = _money(difference - refund)
                row.refund_amount = _money(0)
                refund = _money(0)
            else:
                row.exchange_credit = _money(0)
                row.refund_amount = _money(refund - difference)
                refund = row.refund_amount

        if refund > 0:
            _book_refund(row, sale, refund, data)
        elif row.return_type != 'exchange':
            row.refund_amount = _money(0)

        row.status = 'completed'
        row.completed_at = datetime.now(timezone.utc)
        row.approved_by = current_user_id()
        row.approved_at = datetime.now(timezone.utc)
        if exchange_sale is not None:
            row.exchange_sale_id = exchange_sale.id
        db.session.commit()
    except ShopStockError as e:
        db.session.rollback()
        return stock_error(e)

    audit('shop_return_approved', 'shop_return', row.id,
          previous_value={'status': 'requested'},
          new_value=payload_for(row, include_items=True))
    notify_shop('shop.sales.view', 'shop_return_completed',
                f'Return {row.return_number} completed '
                f'({float(row.refund_amount or 0):,.0f} refunded).',
                related_type='shop_return', related_id=row.id)
    payload = {'return': payload_for(row, include_items=True)}
    if row.exchange_sale_id:
        payload['exchange_sale'] = payload_for(row.exchange_sale, include_items=True)
    return jsonify(payload)


@bp.post('/returns/<int:row_id>/receive')
@require_any_permission('shop.returns.create', 'shop.returns.approve')
def receive_return(row_id):
    """Mark that the physical items have been taken back at the counter."""
    row = ShopReturn.query.get(row_id)
    if not row:
        return json_error('Return not found', 404)
    if row.status != 'requested':
        return json_error(f'A {row.status} return cannot be received', 409,
                          'return_already_processed')
    # Claim before writing: a till that raced an approval must not write
    # `received` on top of `completed`, because `received` is one of the
    # statuses `approve_return` accepts — the return would fall back into the
    # approval window and its units could be restocked and refunded twice.
    claimed = db.session.execute(
        update(ShopReturn)
        .where(ShopReturn.id == row.id)
        .where(ShopReturn.status == 'requested')
        .values(status='received')).rowcount
    if claimed == 0:
        return json_error('That return has already been processed', 409,
                          'return_already_processed')
    db.session.expire(row)
    db.session.commit()
    audit('shop_return_received', 'shop_return', row.id,
          previous_value={'status': 'requested'}, new_value=payload_for(row))
    return jsonify({'return': payload_for(row, include_items=True)})


def _claim_returned_quantity(sale_item, quantity):
    """Add ``quantity`` to the line's returned count with a DB-level guard.

    The read-modify-write this replaces lost updates under concurrency: two
    approvals could both see ``returnable_quantity`` and both restock. The
    ``WHERE remaining >= quantity`` predicate makes the database the referee.
    """
    stmt = (update(ShopSaleItem)
            .where(ShopSaleItem.id == sale_item.id)
            .where(ShopSaleItem.quantity
                   - func.coalesce(ShopSaleItem.returned_quantity, 0)
                   >= quantity)
            .values(returned_quantity=func.coalesce(ShopSaleItem.returned_quantity, 0)
                    + quantity))
    if db.session.execute(stmt).rowcount == 0:
        raise ShopStockError('Those units were already returned', 409,
                             'quantity_not_returnable')
    db.session.expire(sale_item)


def _release_serials(sale_item, quantity, restockable):
    """Free up to ``quantity`` serials still claimed by this sale line.

    A POS return often carries no per-serial id — the attendant returns "one
    unit of the phone". Leaving those serials in ``sold`` would keep the units
    unsellable forever and break the exchange that immediately follows.
    """
    if quantity <= 0:
        return
    claimed = (ShopSerializedItem.query
               .filter_by(sale_item_id=sale_item.id)
               .order_by(ShopSerializedItem.id)
               .limit(quantity)
               .all())
    for serial in claimed:
        serial.status = 'in_stock' if restockable else 'under_inspection'
        serial.sale_item_id = None
        serial.sold_at = None


def _restock_return(row):
    """Put each returned unit back into the right pool."""
    for item in row.items:
        condition = item.condition or 'good'
        restockable = bool(item.restock) and condition in RESTOCK_CONDITIONS
        _claim_returned_quantity(item.sale_item, item.quantity)
        if restockable:
            post_movement(product_id=item.product_id, branch_id=row.branch_id,
                          variant_id=item.variant_id,
                          movement_type='customer_return',
                          quantity=item.quantity,
                          unit_cost=float(item.unit_cost or 0),
                          reference_type='return', reference_id=row.id,
                          note=f'{row.return_number} restocked',
                          user_id=current_user_id())
        else:
            add_defective(item.product_id, row.branch_id, item.quantity,
                          variant_id=item.variant_id,
                          reference_type='return', reference_id=row.id,
                          movement_type='customer_return',
                          note=f'{row.return_number} to damaged stock '
                               f'({condition})',
                          user_id=current_user_id())
        released = 0
        if item.serial_id:
            serial = ShopSerializedItem.query.get(item.serial_id)
            if serial is not None:
                serial.status = 'in_stock' if restockable \
                    else 'under_inspection'
                serial.sale_item_id = None
                serial.sold_at = None
                released = 1
        _release_serials(item.sale_item, item.quantity - released, restockable)
    return True


def _book_refund(row, sale, refund, data):
    """Record the refund payment and update the sale's refunded totals."""
    method_id = data.get('refund_method_id')
    method = PaymentMethod.query.get(method_id) if method_id else None
    if method is None:
        method = (PaymentMethod.query
                  .filter(PaymentMethod.code == 'cash', PaymentMethod.is_active.is_(True))
                  .first()
                  or PaymentMethod.query.filter_by(is_active=True).first())
    if method is None:
        raise ShopStockError('No payment method is configured for refunds', 400,
                             'no_payment_method')
    sale.payments.append(ShopPayment(
        payment_method_id=method.id, amount=-_money(refund),
        reference=f'Refund {row.return_number}', status='refunded',
        paid_at=datetime.now(timezone.utc), created_by=current_user_id(),
    ))
    sale.amount_refunded = _money(sale.amount_refunded) + _money(refund)
    refunded_total = _money(sale.amount_refunded)
    sale.status = ('refunded' if refunded_total >= _money(sale.total_amount) - Decimal('0.01')
                   else 'partially_refunded')
    row.refund_amount = _money(refund)


def _create_exchange_sale(row, original, payload):
    """Replacement sale for an exchange, linked back to the original."""
    lines = _build_lines(payload.get('items') or [])
    # An exchange is still a sale: it goes through the same discount ceiling
    # as the POS, otherwise a discount could be smuggled in through a return.
    discount_percent = _money(payload.get('discount_percent') or 0)
    discount_amount = _money(payload.get('discount_amount') or 0)
    percent_ok, approver = evaluate_discount(
        current_user(),
        _effective_discount_percent(lines, discount_percent, discount_amount),
        discount_amount, payload.get('discount_reason'))
    if not percent_ok:
        raise ShopStockError(approver, 403, 'discount_not_allowed')
    totals = _price_lines(lines, cart_fixed=discount_amount,
                          cart_percent=discount_percent)
    sale = ShopSale(
        sale_number=next_number('sale'), branch_id=row.branch_id,
        customer_id=row.customer_id,
        shift_id=_open_shift_id(row.branch_id, payload.get('shift_id')),
        status='completed', sale_type='exchange',
        subtotal=totals['subtotal'], discount_amount=totals['discount_amount'],
        tax_amount=totals['tax_amount'], total_amount=totals['total_amount'],
        discount_reason=payload.get('discount_reason'),
        discount_approved_by=approver,
        exchange_sale_id=original.id,
        notes=f'Exchange against {original.sale_number}',
        created_by=current_user_id(),
    )
    db.session.add(sale)
    db.session.flush()

    for line in lines:
        product, variant = line['product'], line['variant']
        ensure_product(product, variant)
        serials = _available_serials(product, row.branch_id, variant,
                                     line['quantity'], line['serials'])
        warranty_months = (line['warranty_months']
                           if line['warranty_months'] is not None
                           else (product.warranty_months or 0))
        item = ShopSaleItem(
            sale_id=sale.id, product_id=product.id,
            variant_id=variant.id if variant else None,
            sku_at_sale=variant.sku if variant is not None else product.sku,
            product_name_at_sale=(f'{product.name} — {variant.name}'
                                  if variant is not None else product.name),
            barcode_at_sale=((variant.barcode if variant is not None
                              else None) or product.barcode),
            quantity=line['quantity'], unit_price=line['unit_price'],
            unit_cost=line['unit_cost'],
            discount_amount=line['discount_amount'],
            discount_percent=line['discount_percent'],
            tax_rate=line['tax_rate'], tax_amount=line['tax_amount'],
            line_total=line['line_total'],
            warranty_months=int(warranty_months or 0),
            warranty_terms=product.warranty_terms, note=line['note'],
        )
        sale.items.append(item)
        db.session.flush()
        post_movement(product_id=product.id, branch_id=row.branch_id,
                      variant_id=variant.id if variant else None,
                      movement_type='sale', quantity=-line['quantity'],
                      reference_type='sale', reference_id=sale.id,
                      note=f'Exchange {sale.sale_number}',
                      user_id=current_user_id())
        _assign_serials(item, serials, row.branch_id, False)
        if int(warranty_months or 0) > 0:
            _register_warranty(sale, item, product, original.customer, serials,
                               int(warranty_months))

    trade_in = _money(row.refund_amount or 0)
    total = _money(sale.total_amount)
    payments = payload.get('payments') or []
    if payments:
        _apply_payments(sale, payments, payload)
    elif total <= trade_in:
        # Covered by the value of the returned goods — nothing more to pay.
        sale.amount_paid = total
        sale.change_given = Decimal('0')
        sale.amount_due = Decimal('0')
    else:
        raise ShopStockError(
            f'Payment of {float(total - trade_in):g} is required for the '
            f'exchange', 400, 'payment_required')
    return sale


# ── fast refund from the sale screen ─────────────────────────────────────────

@bp.post('/sales/<int:sale_id>/refund')
@require_permission('shop.sales.refund')
def refund_sale(sale_id):
    """One-step refund of everything still returnable on a sale."""
    sale = ShopSale.query.get(sale_id)
    if not sale:
        return json_error('Sale not found', 404)
    if sale.status in ('held', 'cancelled'):
        return json_error('This sale cannot be refunded', 409)
    data = parse_json()
    entries = []
    for item in sale.items:
        if item.returnable_quantity > 0:
            entries.append({
                'sale_item_id': item.id, 'quantity': item.returnable_quantity,
                'condition': data.get('condition') or 'good',
            })
    if not entries:
        return json_error('There is nothing left to refund on this sale', 409)
    try:
        pairs = _returnable_items(sale, entries)
    except ShopStockError as e:
        return stock_error(e)

    row = ShopReturn(
        return_number=next_number('return'), sale_id=sale.id,
        branch_id=sale.branch_id, customer_id=sale.customer_id,
        shift_id=sale.shift_id, return_type='refund', status='requested',
        reason=data.get('reason') or 'refund requested at POS',
        notes=data.get('notes'), restock_fee=_money(data.get('restock_fee') or 0),
        requested_by=current_user_id(),
    )
    db.session.add(row)
    db.session.flush()
    for item, _ in pairs:
        item.return_id = row.id
        db.session.add(item)
    row.subtotal_returned = _money(sum(
        item.unit_price * item.quantity for item, _ in pairs))
    row.tax_returned = _money(sum(item.tax_amount for item, _ in pairs))
    row.refund_amount = _money(max(row.subtotal_returned + row.tax_returned
                                   - (row.restock_fee or 0), 0))

    try:
        _restock_return(row)
        _book_refund(row, sale, row.refund_amount, data)
        row.status = 'completed'
        row.completed_at = datetime.now(timezone.utc)
        row.approved_by = current_user_id()
        row.approved_at = datetime.now(timezone.utc)
        db.session.commit()
    except ShopStockError as e:
        db.session.rollback()
        return stock_error(e)

    audit('shop_sale_refunded', 'shop_return', row.id,
          new_value=payload_for(row, include_items=True))
    return jsonify({'return': payload_for(row, include_items=True),
                    'sale': payload_for(sale, include_items=True)}), 201
