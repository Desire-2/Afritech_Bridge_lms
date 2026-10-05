"""Shop dashboards and reports.

Every figure is computed from the live ledger. Money columns are only emitted
when the caller's permissions allow them — operational reports stay useful for
attendants who may not see costs or totals.
"""
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from flask import Blueprint, request, jsonify

from ...extensions import db
from ...models import (
    ShopSale, ShopSaleItem, ShopPayment, ShopReturn, ShopProduct,
    ShopInventoryBalance, ShopStockMovement, ShopPurchaseOrder, ShopSupplier,
    ShopDailyClosing, AuditLog, Setting,
)
from ...auth.auth import require_permission, require_any_permission, current_user
from ...auth.shop_scope import can_view_shop_costs, can_view_shop_financials
from ..helpers import json_error, paginate, paginate_response, parse_date
from .common import scoped_branch_id

bp = Blueprint('shop_reports', __name__, url_prefix='/api/shop')

MONEY_TOKENS = ('amount', 'price', 'cost', 'total', 'value', 'revenue',
                'profit', 'margin', 'paid', 'due', 'refund', 'discount',
                'tax', 'balance', 'float', 'cash')


def _is_money_key(key):
    lowered = key.lower()
    if lowered.endswith(('_at', '_id', '_by', '_number', '_count', '_rate',
                         '_points', '_months')):
        return False
    return any(token in lowered for token in MONEY_TOKENS)


def _scrub(value):
    """Drop money fields from a payload the caller is not allowed to see."""
    if isinstance(value, dict):
        return {k: None if _is_money_key(k) else _scrub(v)
                for k, v in value.items()}
    if isinstance(value, list):
        return [_scrub(v) for v in value]
    return value


def _money(value):
    return float(Decimal(str(value or 0)).quantize(Decimal('0.01')))


def _aware(value):
    """SQLite hands back naive timestamps; compare them in UTC."""
    if value is None:
        return None
    if isinstance(value, datetime) and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _range(default_days=30):
    today = datetime.now(timezone.utc).date()
    start, err = parse_date(request.args.get('from'), 'from')
    if err:
        return None, err, None, None
    end, err = parse_date(request.args.get('to'), 'to')
    if err:
        return None, err, None, None
    end = end or today
    start = start or (end - timedelta(days=default_days))
    start_dt = datetime.combine(start, datetime.min.time()).replace(
        tzinfo=timezone.utc)
    end_dt = datetime.combine(end, datetime.min.time()).replace(
        tzinfo=timezone.utc) + timedelta(days=1)
    return start, None, start_dt, end_dt


def _sales_query(start_dt, end_dt, include_branch=True):
    q = ShopSale.query.filter(ShopSale.created_at >= start_dt,
                              ShopSale.created_at < end_dt,
                              ShopSale.status.notin_(['held', 'cancelled']))
    branch_id = scoped_branch_id()
    if include_branch and branch_id is not None:
        q = q.filter(ShopSale.branch_id == branch_id)
    elif request.args.get('branch_id', type=int):
        q = q.filter(ShopSale.branch_id == request.args.get('branch_id', type=int))
    return q


def _empty_bucket():
    return {'transactions': 0, 'items_sold': 0, 'gross': 0.0, 'discounts': 0.0,
            'taxes': 0.0, 'refunds': 0.0, 'net': 0.0}


# ── dashboard ────────────────────────────────────────────────────────────────

@bp.get('/dashboard')
@require_any_permission('shop.view')
def dashboard():
    user = current_user()
    show_money = can_view_shop_financials(user)
    now = datetime.now(timezone.utc)
    today_start = datetime.combine(now.date(), datetime.min.time()).replace(
        tzinfo=timezone.utc)
    month_start = today_start.replace(day=1)

    def _sales_stats(since):
        rows = _sales_query(since, now + timedelta(days=1)).all()
        count = len(rows)
        gross = sum(_money(sale.total_amount) for sale in rows)
        refunds = sum(_money(sale.amount_refunded) for sale in rows)
        items = sum(int(item.quantity or 0) for sale in rows
                    for item in sale.items)
        stats = {'transactions': count, 'items_sold': items}
        if show_money:
            stats.update({'gross': round(gross, 2),
                          'refunds': round(refunds, 2),
                          'net': round(gross - refunds, 2)})
        return stats

    today = _sales_stats(today_start)
    month = _sales_stats(month_start)

    # Top products over the trailing week.
    week_start = today_start - timedelta(days=7)
    totals = defaultdict(lambda: {'units': 0, 'revenue': 0.0})
    for item in (ShopSaleItem.query
                 .join(ShopSale)
                 .filter(ShopSale.created_at >= week_start,
                         ShopSale.status.notin_(['held', 'cancelled'])).all()):
        branch_id = item.sale.branch_id if item.sale else None
        if scoped_branch_id() is not None and branch_id != scoped_branch_id():
            continue
        name = item.product.name if item.product else f'Item {item.product_id}'
        if item.variant:
            name = f'{name} · {item.variant.name}'
        bucket = totals[name]
        bucket['units'] += int(item.quantity or 0)
        if show_money:
            bucket['revenue'] += _money(item.line_total)
    top_products = sorted(
        ({'name': name, 'units': v['units'],
          **({'revenue': round(v['revenue'], 2)} if show_money else {})}
         for name, v in totals.items()),
        key=lambda row: row['units'], reverse=True)[:8]

    # Stock health.
    balances = ShopInventoryBalance.query.all()
    if scoped_branch_id() is not None:
        balances = [b for b in balances if b.branch_id == scoped_branch_id()]
    low = out_of_stock = 0
    for balance in balances:
        available = int(balance.quantity or 0) - int(balance.reserved_quantity or 0)
        reorder = balance.product.reorder_level if balance.product else None
        if available <= 0:
            out_of_stock += 1
        elif reorder is not None and available <= int(reorder):
            low += 1

    pending = {
        'purchase_orders': (ShopPurchaseOrder.query
                            .filter_by(status='submitted')
                            .filter(_branch_filter(ShopPurchaseOrder)).count()),
        'returns': ShopReturn.query.filter_by(status='requested').count(),
        'closings': ShopDailyClosing.query.filter_by(status='submitted').count(),
        'transfers': 0,
    }

    recent = []
    for sale in _sales_query(today_start, now + timedelta(days=1)).order_by(
            ShopSale.id.desc()).limit(5).all():
        payload = sale.to_dict(user=user, include_items=False)
        recent.append(_scrub(payload) if not show_money else payload)

    payload = {'today': today, 'month': month, 'top_products': top_products,
               'stock': {'low': low, 'out_of_stock': out_of_stock},
               'pending': pending, 'recent_sales': recent}
    return jsonify(payload)


def _branch_filter(model):
    branch_id = scoped_branch_id()
    if branch_id is None:
        return db.true()
    return model.branch_id == branch_id


# ── sales report ─────────────────────────────────────────────────────────────

@bp.get('/reports/sales')
@require_permission('shop.reports.view')
def sales_report():
    start, err, start_dt, end_dt = _range()
    if err:
        return err
    group_by = request.args.get('group_by', 'day')
    if group_by not in ('day', 'branch', 'product', 'payment_method', 'category'):
        return json_error('group_by must be day, branch, product, '
                          'payment_method or category', 400)
    show_money = can_view_shop_financials(current_user())
    sales = _sales_query(start_dt, end_dt).all()

    buckets = defaultdict(_empty_bucket)

    def _bucket_for(sale, item=None):
        if group_by == 'day':
            return buckets[sale.created_at.date().isoformat()]
        if group_by == 'branch':
            return buckets[sale.branch.name if sale.branch else 'Unknown']
        if group_by == 'product':
            if item is None:
                return None
            label = item.product.name if item.product else f'Item {item.product_id}'
            if item.variant:
                label = f'{label} · {item.variant.name}'
            return buckets[label]
        if group_by == 'category':
            if item is None:
                return None
            category = item.product.category if item.product else None
            return buckets[category.name if category else 'Uncategorised']
        return None

    for sale in sales:
        if group_by == 'payment_method':
            for payment in sale.payments:
                label = (payment.method.code or 'other') if payment.method \
                    else 'other'
                bucket = buckets[label]
                bucket['transactions'] += 1
                bucket['gross'] += _money(payment.amount)
            continue
        bucket = _bucket_for(sale)
        if bucket is None:
            continue
        bucket['transactions'] += 1
        bucket['gross'] += _money(sale.total_amount)
        bucket['discounts'] += _money(sale.discount_amount)
        bucket['taxes'] += _money(sale.tax_amount)
        bucket['refunds'] += _money(sale.amount_refunded)
        if group_by == 'day' or group_by == 'branch':
            bucket['items_sold'] += sum(int(i.quantity or 0) for i in sale.items)
        if group_by in ('product', 'category'):
            for item in sale.items:
                sub = _bucket_for(sale, item)
                sub['items_sold'] += int(item.quantity or 0)
                sub['gross'] += _money(item.line_total)
                # Per-line refunds only: the sale-level refund already covers
                # every other line and would be counted twice.
                sub['refunds'] += _money(item.unit_price) * int(
                    item.returned_quantity or 0)

    money_keys = ('gross', 'discounts', 'taxes', 'refunds', 'net')
    rows = []
    for label in sorted(buckets):
        bucket = buckets[label]
        bucket['net'] = round(bucket['gross'] - bucket['refunds'], 2)
        for key in money_keys:
            bucket[key] = round(bucket[key], 2)
            if not show_money:
                bucket[key] = None
        rows.append({'label': label, **bucket})

    totals = _empty_bucket()
    for bucket in buckets.values():
        for key in totals:
            totals[key] += bucket[key]
    totals = {k: (round(v, 2) if isinstance(v, float) else v)
              for k, v in totals.items()}
    if not show_money:
        for key in money_keys:
            totals[key] = None
    return jsonify({'from': start.isoformat(), 'group_by': group_by,
                    'rows': rows, 'totals': totals,
                    'money': show_money})


# ── profitability ────────────────────────────────────────────────────────────

@bp.get('/reports/profitability')
@require_permission('shop.financial_reports.view')
def profitability_report():
    start, err, start_dt, end_dt = _range()
    if err:
        return err
    items = (ShopSaleItem.query.join(ShopSale)
             .filter(ShopSale.created_at >= start_dt,
                     ShopSale.created_at < end_dt,
                     ShopSale.status.notin_(['held', 'cancelled'])).all())
    buckets = defaultdict(lambda: {'units_sold': 0, 'revenue': 0.0,
                                   'cogs': 0.0, 'discounts': 0.0,
                                   'taxes': 0.0, 'refunds': 0.0})
    for item in items:
        sale = item.sale
        if sale is None:
            continue
        if scoped_branch_id() is not None and sale.branch_id != scoped_branch_id():
            continue
        label = item.product.name if item.product else f'Item {item.product_id}'
        if item.variant:
            label = f'{label} · {item.variant.name}'
        bucket = buckets[label]
        bucket['units_sold'] += int(item.quantity or 0)
        bucket['revenue'] += _money(item.line_total)
        bucket['cogs'] += _money(item.unit_cost) * int(item.quantity or 0)
        bucket['discounts'] += _money(item.discount_amount)
        bucket['taxes'] += _money(item.tax_amount)
        bucket['refunds'] += (_money(item.unit_price) * item.returned_quantity
                              if item.returned_quantity else 0)

    rows = []
    for label in sorted(buckets):
        bucket = buckets[label]
        profit = bucket['revenue'] - bucket['cogs'] - bucket['refunds']
        margin = (profit / bucket['revenue'] * 100) if bucket['revenue'] else 0
        rows.append({'label': label, **{k: round(v, 2) for k, v in bucket.items()},
                     'gross_profit': round(profit, 2),
                     'margin_percent': round(margin, 2)})
    rows.sort(key=lambda row: row['gross_profit'], reverse=True)

    totals = {'units_sold': sum(r['units_sold'] for r in rows),
              'revenue': round(sum(r['revenue'] for r in rows), 2),
              'cogs': round(sum(r['cogs'] for r in rows), 2),
              'refunds': round(sum(r['refunds'] for r in rows), 2)}
    totals['gross_profit'] = round(totals['revenue'] - totals['cogs']
                                   - totals['refunds'], 2)
    totals['margin_percent'] = round(
        totals['gross_profit'] / totals['revenue'] * 100, 2) \
        if totals['revenue'] else 0.0
    return jsonify({'from': start.isoformat(), 'rows': rows, 'totals': totals,
                    'money': True, 'costs': can_view_shop_costs(current_user())})


# ── stock / valuation ────────────────────────────────────────────────────────

@bp.get('/reports/stock')
@require_permission('shop.reports.view')
def stock_report():
    user = current_user()
    show_cost = can_view_shop_costs(user)
    q = ShopInventoryBalance.query.join(ShopProduct)
    if scoped_branch_id() is not None:
        q = q.filter(ShopInventoryBalance.branch_id == scoped_branch_id())
    if request.args.get('branch_id', type=int):
        q = q.filter(ShopInventoryBalance.branch_id == request.args.get('branch_id', type=int))
    balances = q.order_by(ShopProduct.name).all()

    rows = []
    valuation = 0.0
    for balance in balances:
        product = balance.product
        if product is None:
            continue
        quantity = int(balance.quantity or 0)
        reserved = int(balance.reserved_quantity or 0)
        damaged = int(balance.damaged_quantity or 0)
        available = quantity - reserved
        value = (quantity * float(balance.average_cost or 0)) if show_cost else 0.0
        if show_cost:
            valuation += value
        rows.append({
            'product': product.name,
            'variant': balance.variant.name if balance.variant else None,
            'sku': balance.variant.sku if balance.variant else product.sku,
            'branch': balance.branch.name if balance.branch else None,
            'quantity': quantity, 'reserved': reserved,
            'damaged': damaged, 'available': available,
            'reorder_level': product.reorder_level,
            'average_cost': round(float(balance.average_cost or 0), 2)
            if show_cost else None,
            'value': round(value, 2) if show_cost else None,
            'low': available <= int(product.reorder_level or 0),
            'last_movement_at': balance.last_movement_at.isoformat()
            if balance.last_movement_at else None,
        })
    return jsonify({'rows': rows, 'money': show_cost,
                    'valuation': round(valuation, 2) if show_cost else None,
                    'total_skus': len(rows)})


# ── slow moving ──────────────────────────────────────────────────────────────

@bp.get('/reports/slow-moving')
@require_permission('shop.reports.view')
def slow_moving_report():
    row = Setting.query.filter_by(key='shop.alerts.dead_stock_days').first()
    try:
        days = int(row.value) if row else 90
    except (TypeError, ValueError):
        days = 90
    threshold = datetime.now(timezone.utc) - timedelta(days=days)
    show_cost = can_view_shop_costs(current_user())

    q = ShopInventoryBalance.query.join(ShopProduct)
    if scoped_branch_id() is not None:
        q = q.filter(ShopInventoryBalance.branch_id == scoped_branch_id())
    rows = []
    for balance in q.all():
        product = balance.product
        if product is None or int(balance.quantity or 0) <= 0:
            continue
        last_sale = (ShopSaleItem.query
                     .join(ShopSale)
                     .filter(ShopSaleItem.product_id == product.id,
                             ShopSale.created_at < threshold,
                             ShopSale.status.notin_(['held', 'cancelled']))
                     .order_by(ShopSale.created_at.desc()).first())
        last_sale_at = None
        if last_sale and last_sale.sale:
            last_sale_at = last_sale.sale.created_at
        else:
            # Never sold: fall back to when the stock first landed.
            last_sale_at = balance.last_movement_at
        last_sale_at = _aware(last_sale_at)
        if last_sale_at is not None and last_sale_at > threshold:
            continue
        rows.append({
            'product': product.name,
            'branch': balance.branch.name if balance.branch else None,
            'quantity': int(balance.quantity or 0),
            'value': round(int(balance.quantity or 0)
                           * float(balance.average_cost or 0), 2)
            if show_cost else None,
            'last_activity': last_sale_at.isoformat() if last_sale_at else None,
            'days_idle': (datetime.now(timezone.utc) - last_sale_at).days
            if last_sale_at else None,
        })
    rows.sort(key=lambda row: (row['days_idle'] is None, -(row['days_idle'] or 0)))
    return jsonify({'rows': rows, 'days': days, 'money': show_cost})


# ── purchases ────────────────────────────────────────────────────────────────

@bp.get('/reports/purchases')
@require_any_permission('shop.reports.view', 'shop.purchases.view')
def purchases_report():
    start, err, start_dt, end_dt = _range()
    if err:
        return err
    show_cost = can_view_shop_costs(current_user())
    q = ShopPurchaseOrder.query.filter(
        ShopPurchaseOrder.created_at >= start_dt,
        ShopPurchaseOrder.created_at < end_dt)
    if scoped_branch_id() is not None:
        q = q.filter(ShopPurchaseOrder.branch_id == scoped_branch_id())
    orders = q.all()

    by_supplier = defaultdict(lambda: {'orders': 0, 'total': 0.0,
                                       'received': 0.0})
    by_status = defaultdict(int)
    for order in orders:
        by_status[order.status] += 1
        label = order.supplier.company_name if order.supplier else 'Unknown supplier'
        bucket = by_supplier[label]
        bucket['orders'] += 1
        bucket['total'] += _money(order.total_amount)
        if order.status == 'received':
            bucket['received'] += _money(order.total_amount)

    suppliers = [{'supplier': name,
                  **({k: round(v, 2) for k, v in values.items()}
                     if show_cost else {'orders': values['orders']})}
                 for name, values in sorted(by_supplier.items())]
    return jsonify({'from': start.isoformat(), 'orders': len(orders),
                    'by_status': dict(by_status), 'by_supplier': suppliers,
                    'money': show_cost,
                    'total': round(sum(_money(o.total_amount) for o in orders), 2)
                    if show_cost else None})


# ── tax ──────────────────────────────────────────────────────────────────────

@bp.get('/reports/tax')
@require_permission('shop.financial_reports.view')
def tax_report():
    start, err, start_dt, end_dt = _range()
    if err:
        return err
    items = (ShopSaleItem.query.join(ShopSale)
             .filter(ShopSale.created_at >= start_dt,
                     ShopSale.created_at < end_dt,
                     ShopSale.status.notin_(['held', 'cancelled'])).all())
    by_rate = defaultdict(lambda: {'taxable': 0.0, 'tax': 0.0, 'units': 0})
    for item in items:
        if item.sale and scoped_branch_id() is not None \
                and item.sale.branch_id != scoped_branch_id():
            continue
        rate = float(item.tax_rate or 0)
        bucket = by_rate[f'{rate:g}%']
        bucket['taxable'] += _money(item.line_total) - _money(item.tax_amount)
        bucket['tax'] += _money(item.tax_amount)
        bucket['units'] += int(item.quantity or 0)
    rows = [{'rate': rate, **{k: round(v, 2) if isinstance(v, float) else v
                              for k, v in values.items()}}
            for rate, values in sorted(by_rate.items())]
    return jsonify({'from': start.isoformat(), 'rows': rows, 'money': True,
                    'total_tax': round(sum(r['tax'] for r in rows), 2)})


# ── activity feed ────────────────────────────────────────────────────────────

@bp.get('/activities')
@require_permission('shop.activities.view')
def shop_activities():
    q = AuditLog.query.filter(db.or_(
        AuditLog.action.like('shop\\_%'),
        AuditLog.entity.like('shop%')))
    if request.args.get('entity'):
        q = q.filter_by(entity=request.args.get('entity'))
    if request.args.get('action'):
        q = q.filter_by(action=request.args.get('action'))
    p = paginate(q.order_by(AuditLog.id.desc()))
    show_money = can_view_shop_financials(current_user())
    items = []
    for log in p.items:
        new_value = _decode(log.new_value)
        previous_value = _decode(log.previous_value)
        items.append({
            'id': log.id, 'action': log.action, 'entity': log.entity,
            'entity_id': log.entity_id, 'user': log.user_email,
            'created_at': log.created_at.isoformat() if log.created_at else None,
            'new_value': new_value if show_money else _scrub(new_value),
            'previous_value': previous_value if show_money else _scrub(previous_value),
        })
    return paginate_response(items, p)


def _decode(raw):
    if not raw:
        return None
    import json
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return raw
