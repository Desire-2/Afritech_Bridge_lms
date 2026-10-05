"""POS sales: creating, holding, completing, cancelling and paying.

A sale is a single transaction: lines, discounts, payments and stock movements
are all written (or all rolled back) together. Held sales reserve their stock
so a basket parked on the counter cannot be sold out from under it, and
completing a held sale converts that reservation into the ledger movement in
one guarded statement.
"""
from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_HALF_UP

from flask import Blueprint, request, jsonify
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError

from ...extensions import db
from ...models import (
    ShopSale, ShopSaleItem, ShopPayment, ShopCustomer, ShopProduct,
    ShopProductVariant, ShopSerializedItem, ShopPromotion, ShopWarrantyRegistration,
    ShopShift, PaymentMethod, Setting,
)
from ...auth.auth import require_permission, require_any_permission, current_user
from ...auth.shop_scope import can_view_all_shop_branches, shop_discount_limit
from ...services.audit import audit
from ...services.notifications import notify_users_with_permission
from ...services.shop_inventory import (
    ShopStockError, post_movement, reserve, release_reservation,
    settle_reservation, ensure_product, product_stock,
)
from ...services.shop_series import next_number
from ...services.barcode import ShopBarcodeError, normalize_barcode
from ..helpers import json_error, parse_json, paginate, paginate_response, required
from .common import (
    payload_for, resolve_branch, scoped_branch_id, user_branch_id,
    stock_error, current_user_id, resolve_item, evaluate_discount,
    request_branch_id_from_body, notify_shop,
)

bp = Blueprint('shop_sales', __name__, url_prefix='/api/shop')

MONEY = Decimal('0.01')


def _money(value):
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def _default_price(product, variant):
    if variant is not None and variant.selling_price is not None:
        return _money(variant.selling_price)
    return _money(product.selling_price)


def _default_cost(product, variant):
    if variant is not None and variant.purchase_cost is not None:
        return _money(variant.purchase_cost)
    return _money(product.purchase_cost)


def _effective_discount_percent(lines, cart_percent, cart_fixed=Decimal('0')):
    """User-entered discount (line + cart) as a percent of the basket's gross.

    The ceiling in ``evaluate_discount`` is about the operator's discretion, so
    line-level discounts count towards it too — otherwise an attendant could
    hand out 100% line by line while the cart sits at 0%. A fixed cart amount
    counts for the same reason: 0% + 100,000 off is still 100,000 off, and the
    approval rule must see it as the share of the basket it really is.
    Promotions are excluded: they are the shop's own offer, priced separately
    by ``_price_lines``.
    """
    cart_percent = _money(cart_percent)
    cart_fixed = _money(cart_fixed)
    gross = sum(line['unit_price'] * line['quantity'] for line in lines)
    if gross <= 0:
        return min(Decimal('100'), cart_percent)
    entered = _money(cart_fixed)
    for line in lines:
        base = line['unit_price'] * line['quantity']
        entered += _money(base * line['discount_percent'] / 100)
        entered += _money(line['discount_amount'])
    return min(Decimal('100'),
               _money(cart_percent + entered * 100 / gross))


def _setting(key, default=None):
    row = Setting.query.filter_by(key=key).first()
    return row.value if row and row.value not in (None, '') else default


# ── basket building ──────────────────────────────────────────────────────────

def _check_scanned_barcode(entry, product, variant):
    """Revalidate a scanned barcode against the line the client claims.

    The client resolved the code itself; the server only accepts it when it
    really belongs to this product (the variant's own code preferred).
    """
    raw = entry.get('barcode')
    if raw in (None, ''):
        return
    try:
        code = normalize_barcode(raw)
    except ShopBarcodeError as error:
        raise ShopStockError(error.message, error.status, error.code) from error
    if not code:
        return
    allowed = {(variant.barcode or None) if variant is not None else None,
               product.barcode or None}
    allowed.discard(None)
    if code not in allowed:
        raise ShopBarcodeError('Barcode does not match the selected product',
                               400, 'barcode_mismatch')


def _build_lines(payload_items):
    """Merge the raw basket into priced, validated sale lines."""
    if not isinstance(payload_items, list) or not payload_items:
        raise ShopStockError('A sale needs at least one line', 400, 'empty_basket')
    merged = {}
    for entry in payload_items:
        product, variant = resolve_item(entry)
        ensure_product(product, variant)
        _check_scanned_barcode(entry, product, variant)
        quantity = int(entry.get('quantity') or 1)
        if quantity <= 0:
            raise ShopStockError('Quantity must be positive', 400,
                                 'invalid_quantity')
        unit_price = entry.get('unit_price')
        unit_price = _money(unit_price) if unit_price is not None \
            else _default_price(product, variant)
        # Signs are the whole ball game here: a negative price pays the
        # customer, a negative tax_rate subtracts tax from the total and a
        # negative discount raises it — none of them belong in a sale line.
        if unit_price < 0:
            raise ShopStockError('Unit price cannot be negative', 400,
                                 'invalid_price')
        minimum = product.min_selling_price
        if minimum is not None and unit_price < _money(minimum):
            raise ShopStockError(
                f'Selling price for {product.name} is below the minimum '
                f'of {float(minimum):g}', 400, 'below_minimum_price')
        discount_percent = _money(entry.get('discount_percent') or 0)
        discount_amount = _money(entry.get('discount_amount') or 0)
        tax_rate = _money(entry.get('tax_rate') or 0)
        if discount_percent < 0 or discount_amount < 0:
            raise ShopStockError('Discounts cannot be negative', 400,
                                 'invalid_discount')
        if tax_rate < 0:
            raise ShopStockError('Tax rate cannot be negative', 400,
                                 'invalid_tax_rate')
        warranty_months = entry.get('warranty_months')
        # The whole pricing identity belongs to the key: two scans of the same
        # product with different discounts are two different lines, and folding
        # the second into the first would silently reprice it.
        key = (product.id, variant.id if variant else None, str(unit_price),
               str(discount_percent), str(discount_amount), str(tax_rate),
               str(warranty_months))
        line = merged.get(key)
        if line is None:
            line = {
                'product': product, 'variant': variant, 'quantity': 0,
                'unit_price': unit_price,
                'unit_cost': _default_cost(product, variant),
                'discount_percent': discount_percent,
                'discount_amount': discount_amount,
                'tax_rate': tax_rate,
                # Serials are collected by the extend below — seeding the list
                # from the entry as well put every requested serial in twice
                # and the duplicate check rejected the whole basket.
                'serials': [],
                'warranty_months': warranty_months,
                'note': entry.get('note'),
            }
            merged[key] = line
        line['quantity'] += quantity
        if entry.get('serials'):
            line['serials'].extend(entry['serials'])
    return list(merged.values())


def _price_lines(lines, cart_fixed=Decimal('0'), cart_percent=Decimal('0'),
                 cart_promotion=Decimal('0')):
    """Price a basket: line discounts first, then the cart-level discounts,
    spread across the lines in proportion to what each line still owes."""
    for line in lines:
        base = line['unit_price'] * line['quantity']
        line['_base'] = base
        line_discount = _money(base * line['discount_percent'] / 100)
        line_discount += _money(line['discount_amount'])
        line['discount_amount'] = min(line_discount, base)

    gross = sum(line['_base'] for line in lines)
    remaining = _money(gross - sum(line['discount_amount'] for line in lines))
    percent_discount = _money(remaining * cart_percent / 100)
    extra = _money(percent_discount + cart_fixed + cart_promotion)

    applied = Decimal('0')
    for index, line in enumerate(lines):
        net_base = _money(line['_base'] - line['discount_amount'])
        if remaining <= 0 or extra <= 0:
            portion = Decimal('0')
        elif index == len(lines) - 1:
            # The last line absorbs the rounding remainder.
            portion = min(_money(extra - applied), net_base)
        else:
            portion = min(_money(extra * (net_base / remaining)), net_base)
        line['discount_amount'] = _money(line['discount_amount'] + portion)
        applied += portion

    for line in lines:
        net = _money(line['_base'] - line['discount_amount'])
        line['tax_amount'] = _money(net * line['tax_rate'] / 100)
        line['line_total'] = _money(net + line['tax_amount'])
        del line['_base']

    return {
        'subtotal': _money(gross),
        'discount_amount': _money(sum(l['discount_amount'] for l in lines)),
        'tax_amount': _money(sum(l['tax_amount'] for l in lines)),
        'total_amount': _money(sum(l['line_total'] for l in lines)),
    }


def _promotion_discount(promotion, lines):
    """Cart-level discount a promotion grants over the eligible lines."""
    if promotion is None:
        return _money(0), None
    eligible = []
    item_rules = {i.product_id for i in promotion.items
                  if i.product_id and not i.category_id}
    category_rules = {i.category_id for i in promotion.items if i.category_id}
    if not promotion.items:
        eligible = list(lines)
    else:
        for line in lines:
            product = line['product']
            if product.id in item_rules or (product.category_id
                                            and product.category_id in category_rules):
                eligible.append(line)
    base = sum(l['unit_price'] * l['quantity'] for l in eligible)
    if promotion.min_purchase_amount and base < _money(promotion.min_purchase_amount):
        return _money(0), None
    if promotion.promotion_type == 'fixed':
        amount = _money(min(promotion.value, base))
    else:
        amount = _money(base * float(promotion.value or 0) / 100)
    if promotion.max_discount_amount is not None:
        amount = min(amount, _money(promotion.max_discount_amount))
    return amount, eligible


def _resolve_promotion(code, lines, branch_id):
    if not code:
        return _money(0), None
    promotion = ShopPromotion.query.filter(
        db.or_(ShopPromotion.code == str(code).strip(),
               ShopPromotion.name == str(code).strip())).first()
    if promotion is None:
        raise ShopStockError('Promotion not found', 404, 'promotion_not_found')
    if not promotion.is_running:
        raise ShopStockError('That promotion is not active right now', 409,
                             'promotion_inactive')
    if promotion.is_exhausted:
        raise ShopStockError('That promotion has been fully used', 409,
                             'promotion_exhausted')
    if promotion.branches and branch_id not in (promotion.branches or []):
        raise ShopStockError('That promotion does not apply at this branch', 409,
                             'promotion_branch')
    amount, eligible = _promotion_discount(promotion, lines)
    if amount <= 0:
        raise ShopStockError('The promotion does not apply to this basket', 409,
                             'promotion_inapplicable')
    return amount, promotion


def _available_serials(product, branch_id, variant, needed, requested):
    """Serial numbers to attach to a line, auto-assigned when not supplied.

    Requested serials are validated here and *claimed* later in
    :func:`_assign_serials` with a conditional UPDATE, so two tills cannot walk
    out with the same unit: one of them gets a 409 and must rescan.
    """
    if not product.is_serialized:
        if requested:
            raise ShopStockError(
                f'{product.name} is not tracked by serial number', 400,
                'serials_not_serialized')
        return []
    numbers = [str(s).strip() for s in (requested or []) if str(s).strip()]
    if len(numbers) != len(set(numbers)):
        raise ShopStockError('The same serial number was entered twice', 400,
                             'duplicate_serial')
    for number in numbers:
        row = ShopSerializedItem.query.filter_by(
            serial_number=number, product_id=product.id).first()
        if row is None:
            raise ShopStockError(
                f'Serial {number} is not a unit of {product.name}', 409,
                'serial_unavailable')
        if variant is not None and row.variant_id != variant.id:
            raise ShopStockError(
                f'Serial {number} belongs to a different variant', 409,
                'serial_unavailable')
        if row.branch_id != branch_id:
            branch_name = row.branch.name if row.branch else 'another branch'
            raise ShopStockError(
                f'Serial {number} is held at {branch_name}, not this branch',
                409, 'serial_unavailable')
        if row.status != 'in_stock' or row.sale_item_id is not None:
            raise ShopStockError(
                f'Serial {number} is no longer available', 409,
                'serial_unavailable')
    if len(numbers) < needed:
        held = set(numbers)
        rows = (ShopSerializedItem.query
                .filter_by(product_id=product.id, branch_id=branch_id,
                           status='in_stock')
                .filter(ShopSerializedItem.sale_item_id.is_(None))
                .order_by(ShopSerializedItem.id)
                .limit(needed * 3).all())
        for row in rows:
            if len(numbers) >= needed:
                break
            if row.serial_number not in held and (
                    variant is None or row.variant_id == variant.id):
                held.add(row.serial_number)
                numbers.append(row.serial_number)
    if len(numbers) < needed:
        raise ShopStockError(
            f'{product.name}: {needed - len(numbers)} more serial number(s) '
            f'needed to complete this sale', 409, 'serials_unavailable')
    return numbers[:needed]


# ── creation ─────────────────────────────────────────────────────────────────

def _client_ref(data):
    """Idempotency key supplied by the POS client, if any.

    A till that loses the network mid-save retries with the same key instead
    of ringing the basket up twice; the second call returns the sale that
    already exists (200 + ``duplicate``) rather than a second ledger movement.
    """
    raw = data.get('client_ref') or request.headers.get('Idempotency-Key') or ''
    return str(raw).strip()[:64] or None


def _existing_sale_for_ref(branch_id, client_ref):
    if not client_ref:
        return None
    return ShopSale.query.filter_by(branch_id=branch_id,
                                    client_ref=client_ref).first()


@bp.post('/sales')
@require_permission('shop.sales.create')
def create_sale():
    data = parse_json()
    user = current_user()
    client_ref = None
    branch = None
    try:
        branch = resolve_branch(request_branch_id_from_body(data))
        client_ref = _client_ref(data)
        replay = _existing_sale_for_ref(branch.id, client_ref)
        if replay is not None:
            return jsonify({'sale': payload_for(replay, include_items=True),
                            'duplicate': True}), 200
        lines = _build_lines(data.get('items'))
        discount_percent = _money(data.get('discount_percent') or 0)
        discount_amount = _money(data.get('discount_amount') or 0)
        if discount_percent < 0 or discount_amount < 0:
            raise ShopStockError('Discounts cannot be negative', 400,
                                 'invalid_discount')
        promotion_amount, promotion = _resolve_promotion(
            data.get('promotion_code'), lines, branch.id)

        percent_ok, approver = evaluate_discount(
            user, _effective_discount_percent(lines, discount_percent,
                                              discount_amount),
            discount_amount, data.get('discount_reason'))
        if not percent_ok:
            raise ShopStockError(approver, 403, 'discount_not_allowed')

        totals = _price_lines(lines,
                              cart_fixed=discount_amount,
                              cart_percent=discount_percent,
                              cart_promotion=promotion_amount)
        for line in lines:
            line['unit_cost'] = line.get('unit_cost') or _default_cost(
                line['product'], line['variant'])

        customer = _resolve_customer(data)
        hold = bool(data.get('hold'))
        sale = ShopSale(
            sale_number=next_number('held_sale' if hold else 'sale'),
            branch_id=branch.id,
            customer_id=customer.id if customer else None,
            shift_id=_open_shift_id(branch.id, data.get('shift_id')),
            promotion_id=promotion.id if promotion else None,
            status='held' if hold else 'completed',
            sale_type=data.get('sale_type') or 'pos',
            client_ref=client_ref,
            subtotal=totals['subtotal'], discount_amount=totals['discount_amount'],
            tax_amount=totals['tax_amount'], total_amount=totals['total_amount'],
            discount_reason=data.get('discount_reason'),
            discount_approved_by=approver,
            notes=data.get('notes'), receipt_sent_to=data.get('receipt_sent_to'),
            created_by=current_user_id(),
        )
        db.session.add(sale)
        db.session.flush()

        for line in lines:
            product, variant = line['product'], line['variant']
            serials = _available_serials(product, branch.id, variant,
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
                warranty_terms=product.warranty_terms,
                note=line['note'],
            )
            sale.items.append(item)
            db.session.flush()

            if hold:
                reserve(product.id, branch.id, line['quantity'],
                        variant_id=variant.id if variant else None)
            else:
                post_movement(product_id=product.id, branch_id=branch.id,
                              variant_id=variant.id if variant else None,
                              movement_type='sale', quantity=-line['quantity'],
                              reference_type='sale', reference_id=sale.id,
                              note=f'Sale {sale.sale_number}',
                              user_id=current_user_id())
            _assign_serials(item, serials, branch.id, hold)
            if int(warranty_months or 0) > 0:
                _register_warranty(sale, item, product, customer, serials,
                                   int(warranty_months))

        if not hold:
            _apply_payments(sale, data.get('payments') or [], data)
            _award_loyalty(sale, customer, data)

        if promotion:
            promotion.used_count = int(promotion.used_count or 0) + 1

        db.session.commit()
    except ShopStockError as e:
        db.session.rollback()
        return stock_error(e)
    except IntegrityError:
        # Another request saved the same client_ref first: replay it instead of
        # charging the customer twice for one basket.
        db.session.rollback()
        replay = _existing_sale_for_ref(branch.id, client_ref)
        if replay is not None:
            return jsonify({'sale': payload_for(replay, include_items=True),
                            'duplicate': True}), 200
        return json_error('The sale could not be saved, please retry', 409,
                          'sale_conflict')

    audit('shop_sale_created', 'shop_sale', sale.id,
          new_value=payload_for(sale, include_items=True))
    if sale.amount_due and float(sale.amount_due) > 0:
        notify_shop('shop.sales.view_all', 'shop_sale',
                    f'Sale {sale.sale_number} at {branch.name} still has '
                    f'{float(sale.amount_due):,.0f} due.',
                    related_type='shop_sale', related_id=sale.id)
    return jsonify({'sale': payload_for(sale, include_items=True)}), 201


def _resolve_customer(data):
    if data.get('customer_id'):
        customer = ShopCustomer.query.get(data['customer_id'])
        if customer is None:
            raise ShopStockError('Customer not found', 404, 'customer_not_found')
        return customer
    inline = data.get('customer')
    if isinstance(inline, dict) and inline.get('full_name'):
        from ...models import ShopCustomer as _C
        customer = _C(
            full_name=inline['full_name'], phone=inline.get('phone'),
            email=inline.get('email'), address=inline.get('address'),
            customer_type=inline.get('customer_type') or 'individual',
            created_by=current_user_id(),
        )
        db.session.add(customer)
        db.session.flush()
        return customer
    return None


def _open_shift_id(branch_id, requested=None):
    if requested:
        shift = ShopShift.query.get(requested)
        if shift and shift.branch_id == branch_id and shift.status == 'open':
            return shift.id
        raise ShopStockError('That till session is not open', 409, 'shift_closed')
    shift = (ShopShift.query.filter_by(branch_id=branch_id, status='open')
             .order_by(ShopShift.id.desc()).first())
    return shift.id if shift else None


def _assign_serials(item, serial_numbers, branch_id, hold):
    """Claim each serial for this sale line with a conditional UPDATE.

    The ``WHERE status = 'in_stock' AND sale_item_id IS NULL`` guard is the
    whole point: a serial can only be handed over once, even when two tills
    ring the same unit up at the same moment. Losing the race raises 409 and
    rolls the sale back instead of quietly selling a unit twice.
    """
    if not serial_numbers:
        return
    now = datetime.now(timezone.utc)
    ids = []
    for number in serial_numbers:
        row = ShopSerializedItem.query.filter_by(
            serial_number=number, product_id=item.product_id,
            branch_id=branch_id).first()
        if row is None:
            raise ShopStockError(
                f'Serial {number} disappeared before it could be claimed', 409,
                'serial_unavailable')
        stmt = (update(ShopSerializedItem)
                .where(ShopSerializedItem.id == row.id)
                .where(ShopSerializedItem.status == 'in_stock')
                .where(ShopSerializedItem.sale_item_id.is_(None))
                .values(sale_item_id=item.id))
        if not hold:
            stmt = stmt.values(status='sold', sold_at=now)
        if db.session.execute(stmt).rowcount == 0:
            raise ShopStockError(
                f'Serial {number} was just taken by another sale', 409,
                'serial_unavailable')
        ids.append(row.id)
    item.serial_ids = ids


def _register_warranty(sale, item, product, customer, serials, months):
    end = datetime.now(timezone.utc) + timedelta(days=months * 30)
    targets = serials or [None]
    for serial_number in targets:
        serial = (ShopSerializedItem.query
                  .filter_by(serial_number=serial_number).first()
                  if serial_number else None)
        registration = ShopWarrantyRegistration(
            warranty_number=next_number('warranty'),
            sale_item_id=item.id, product_id=product.id,
            customer_id=customer.id if customer else None,
            serial_id=serial.id if serial else None,
            warranty_months=months, provider=product.warranty_provider,
            terms=product.warranty_terms,
            start_date=datetime.now(timezone.utc), end_date=end,
        )
        db.session.add(registration)


def _apply_payments(sale, payments, data):
    total = _money(sale.total_amount)
    paid = Decimal('0')
    for entry in payments:
        method_id = entry.get('payment_method_id') or entry.get('method_id')
        method = PaymentMethod.query.get(method_id) if method_id else None
        if method is None:
            method = PaymentMethod.query.filter_by(is_active=True).first()
        if method is None:
            raise ShopStockError('No payment method is configured', 400,
                                 'no_payment_method')
        amount = _money(entry.get('amount'))
        if amount <= 0:
            raise ShopStockError('Payment amount must be positive', 400,
                                 'invalid_amount')
        paid += amount
        sale.payments.append(ShopPayment(
            payment_method_id=method.id, amount=amount,
            reference=entry.get('reference'), status='completed',
            paid_at=datetime.now(timezone.utc),
            created_by=current_user_id(),
        ))
    if not payments:
        if total <= 0:
            sale.amount_paid = Decimal('0')
            sale.change_given = Decimal('0')
            sale.amount_due = Decimal('0')
            return sale
        raise ShopStockError('At least one payment is required', 400,
                             'payment_required')
    change = _money(max(paid - total, 0))
    sale.amount_paid = paid
    sale.change_given = change
    sale.amount_due = _money(max(total - (paid - change), 0))
    return sale


def _award_loyalty(sale, customer, data):
    if customer is None:
        return
    rate = float(_setting('shop.loyalty.earn_rate', '1') or 0)
    if rate <= 0:
        return
    earned = int((float(sale.total_amount or 0) / 1000) * rate)
    redeem = int(data.get('redeem_points') or 0)
    if redeem > 0:
        redeem = min(redeem, int(customer.loyalty_points or 0))
        customer.loyalty_points = int(customer.loyalty_points or 0) - redeem
    sale.loyalty_points_earned = earned
    sale.loyalty_points_redeemed = redeem
    customer.loyalty_points = int(customer.loyalty_points or 0) + earned


# ── listing / detail ─────────────────────────────────────────────────────────

def _sales_query():
    q = ShopSale.query
    branch_id = scoped_branch_id()
    if branch_id is not None:
        q = q.filter(ShopSale.branch_id == branch_id)
    elif request.args.get('branch_id', type=int):
        q = q.filter(ShopSale.branch_id == request.args.get('branch_id', type=int))
    if request.args.get('status'):
        q = q.filter_by(status=request.args.get('status'))
    else:
        q = q.filter(ShopSale.status != 'held')
    if request.args.get('customer_id', type=int):
        q = q.filter_by(customer_id=request.args.get('customer_id', type=int))
    if request.args.get('shift_id', type=int):
        q = q.filter_by(shift_id=request.args.get('shift_id', type=int))
    search = request.args.get('q', '').strip()
    if search:
        q = q.join(ShopCustomer, ShopCustomer.id == ShopSale.customer_id,
                   isouter=True).filter(
            db.or_(ShopSale.sale_number.ilike(f'%{search}%'),
                   ShopCustomer.full_name.ilike(f'%{search}%'),
                   ShopCustomer.phone.ilike(f'%{search}%')))
    if request.args.get('start'):
        q = q.filter(ShopSale.created_at >=
                     datetime.fromisoformat(request.args.get('start')))
    if request.args.get('end'):
        q = q.filter(ShopSale.created_at <=
                     datetime.fromisoformat(request.args.get('end')))
    return q


@bp.get('/sales')
@require_any_permission('shop.sales.view', 'shop.sales.view_all')
def list_sales():
    p = paginate(_sales_query().order_by(ShopSale.id.desc()))
    user = current_user()
    return paginate_response([s.to_dict(user=user) for s in p.items], p)


@bp.get('/sales/<int:sale_id>')
@require_any_permission('shop.sales.view', 'shop.sales.view_all')
def get_sale(sale_id):
    sale = ShopSale.query.get(sale_id)
    if not sale:
        return json_error('Sale not found', 404)
    branch_id = scoped_branch_id()
    if branch_id is not None and sale.branch_id != branch_id:
        return json_error('Sale not found at your branch', 404)
    return jsonify({'sale': payload_for(sale, include_items=True)})


@bp.get('/sales/<int:sale_id>/receipt')
@require_any_permission('shop.sales.view', 'shop.sales.create')
def sale_receipt(sale_id):
    sale = ShopSale.query.get(sale_id)
    if not sale:
        return json_error('Sale not found', 404)
    user = current_user()
    from ...models import Setting as _Setting
    business = _Setting.query.filter_by(key='business.name').first()
    currency = _Setting.query.filter_by(key='business.currency').first()
    return jsonify({
        'receipt': {
            'business_name': business.value if business else 'AfriTech Bridge',
            'currency': currency.value if currency else 'RWF',
            'sale': payload_for(sale, include_items=True),
            'items': [i.to_dict(user=user) for i in sale.items],
            'payments': [p.to_dict(user=user) for p in sale.payments],
            'customer': payload_for(sale.customer) if sale.customer else None,
            'printed_at': datetime.now(timezone.utc).isoformat(),
        }
    })


# ── held sales ───────────────────────────────────────────────────────────────

@bp.post('/sales/<int:sale_id>/complete')
@require_permission('shop.sales.create')
def complete_held_sale(sale_id):
    sale = ShopSale.query.get(sale_id)
    if not sale:
        return json_error('Sale not found', 404)
    if sale.status != 'held':
        return json_error('Only a held sale can be completed', 409)
    data = parse_json()
    try:
        # Claim the transition first: of two tills completing the same held
        # basket, exactly one may convert the reservation into a sale movement.
        claimed = db.session.execute(
            update(ShopSale)
            .where(ShopSale.id == sale.id, ShopSale.status == 'held')
            .values(status='completed')).rowcount
        if claimed == 0:
            raise ShopStockError(
                'This sale changed in another session — refresh and try again',
                409, 'sale_conflict')
        sale.status = 'completed'
        sale.sale_number = next_number('sale')
        for item in sale.items:
            settle_reservation(item.product_id, sale.branch_id, item.quantity,
                               movement_type='sale',
                               variant_id=item.variant_id,
                               reference_type='sale', reference_id=sale.id,
                               note=f'Sale {sale.sale_number}',
                               user_id=current_user_id())
            for serial in item.serials:
                serial.status = 'sold'
                serial.sold_at = datetime.now(timezone.utc)
        _apply_payments(sale, data.get('payments') or [], data)
        customer = sale.customer
        _award_loyalty(sale, customer, data)
        db.session.commit()
    except ShopStockError as e:
        db.session.rollback()
        return stock_error(e)
    audit('shop_sale_completed', 'shop_sale', sale.id,
          previous_value={'status': 'held'}, new_value=payload_for(sale))
    return jsonify({'sale': payload_for(sale, include_items=True)})


@bp.post('/sales/<int:sale_id>/cancel')
@require_permission('shop.sales.cancel')
def cancel_sale(sale_id):
    sale = ShopSale.query.get(sale_id)
    if not sale:
        return json_error('Sale not found', 404)
    if sale.status in ('cancelled', 'refunded'):
        return json_error('This sale is already closed', 409)
    if sale.status != 'held' and float(sale.amount_paid or 0) > 0:
        # Money moved, and a partial refund may already have put stock back:
        # cancelling on top of that would credit the shelf twice.
        return json_error('A paid sale must be reversed through a return/refund',
                          409, 'paid_sale')
    data = parse_json()
    previous_status = sale.status
    try:
        # Claim the transition before touching stock, so two concurrent
        # cancels cannot both post the reversal movement.
        now = datetime.now(timezone.utc)
        notes = (sale.notes + ' | ' if sale.notes else '') + (
            data.get('reason') or 'cancelled at POS')
        claimed = db.session.execute(
            update(ShopSale)
            .where(ShopSale.id == sale.id, ShopSale.status == previous_status)
            .values(status='cancelled', cancelled_at=now,
                    cancelled_by=current_user_id(), notes=notes)).rowcount
        if claimed == 0:
            raise ShopStockError(
                'This sale changed in another session — refresh and try again',
                409, 'sale_conflict')
        sale.status = 'cancelled'
        sale.cancelled_at = now
        sale.cancelled_by = current_user_id()
        sale.notes = notes
        for item in sale.items:
            if previous_status == 'held':
                release_reservation(item.product_id, sale.branch_id,
                                    item.quantity, variant_id=item.variant_id)
            else:
                post_movement(product_id=item.product_id,
                              branch_id=sale.branch_id,
                              variant_id=item.variant_id,
                              movement_type='sale_reversal',
                              quantity=item.quantity,
                              unit_cost=float(item.unit_cost or 0),
                              reference_type='sale', reference_id=sale.id,
                              note=f'Sale {sale.sale_number} cancelled',
                              user_id=current_user_id())
            for serial in item.serials:
                serial.status = 'in_stock'
                serial.sold_at = None
                serial.sale_item_id = None
        db.session.commit()
    except ShopStockError as e:
        db.session.rollback()
        return stock_error(e)
    audit('shop_sale_cancelled', 'shop_sale', sale.id,
          previous_value={'status': previous_status},
          new_value=payload_for(sale, include_items=True))
    return jsonify({'sale': payload_for(sale, include_items=True)})


@bp.post('/sales/<int:sale_id>/payments')
@require_any_permission('shop.sales.create', 'shop.sales.refund')
def add_payment(sale_id):
    """Take an extra payment against a sale that still has an amount due."""
    sale = ShopSale.query.get(sale_id)
    if not sale:
        return json_error('Sale not found', 404)
    if sale.status not in ('completed', 'partially_refunded'):
        return json_error('Payments can only be taken on a completed sale', 409)
    if float(sale.amount_due or 0) <= 0:
        return json_error('This sale is fully paid', 409)
    data = parse_json()
    entries = data.get('payments') or [{
        'payment_method_id': data.get('payment_method_id'),
        'amount': data.get('amount'), 'reference': data.get('reference'),
    }]
    due_before = _money(sale.amount_due)
    added = Decimal('0')
    try:
        for entry in entries:
            method_id = entry.get('payment_method_id') or entry.get('method_id')
            method = PaymentMethod.query.get(method_id) if method_id else None
            if method is None:
                method = PaymentMethod.query.filter_by(is_active=True).first()
            if method is None:
                raise ShopStockError('No payment method is configured', 400,
                                     'no_payment_method')
            amount = _money(entry.get('amount'))
            if amount <= 0:
                raise ShopStockError('Payment amount must be positive', 400,
                                     'invalid_amount')
            if amount > due_before:
                raise ShopStockError(
                    f'Payment exceeds the outstanding amount of '
                    f'{float(due_before):g}', 400, 'overpayment')
            sale.payments.append(ShopPayment(
                payment_method_id=method.id, amount=amount,
                reference=entry.get('reference'), status='completed',
                paid_at=datetime.now(timezone.utc),
                created_by=current_user_id(),
            ))
            added += amount
            due_before -= amount
        sale.amount_paid = _money(sale.amount_paid) + added
        sale.amount_due = _money(due_before)
        db.session.commit()
    except ShopStockError as e:
        db.session.rollback()
        return stock_error(e)
    audit('shop_payment_received', 'shop_sale', sale.id,
          new_value=payload_for(sale, include_items=True))
    return jsonify({'sale': payload_for(sale, include_items=True)})
