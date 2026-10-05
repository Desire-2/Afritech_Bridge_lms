"""Till shifts and end-of-day cash closings.

The closing figures are always recomputed from the sales ledger rather than
taken from the client — the cashier only supplies what they physically counted.
"""
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from flask import Blueprint, request, jsonify
from sqlalchemy import update

from ...extensions import db
from ...models import ShopShift, ShopDailyClosing, ShopSale, ShopPayment, ShopReturn
from ...auth.auth import require_permission, require_any_permission, current_user
from ...services.audit import audit
from ...services.shop_series import next_number
from ..helpers import json_error, parse_json, paginate, paginate_response
from .common import (
    payload_for, scoped_branch_id, current_user_id, notify_shop,
)

bp = Blueprint('shop_shifts', __name__, url_prefix='/api/shop')


def _money(value):
    return Decimal(str(value or 0)).quantize(Decimal('0.01'))


def _day_window(business_date):
    start = datetime.combine(business_date, datetime.min.time())
    start = start.replace(tzinfo=timezone.utc)
    return start, start + timedelta(days=1)


def _shift_sales(shift):
    # Held baskets are parked, not sold, and a cancelled sale has already been
    # reversed — counting either one inflates the shift's totals and the
    # drawer expectation the cashier is judged against.
    return (ShopSale.query
            .filter(ShopSale.shift_id == shift.id,
                    ShopSale.status.notin_(['held', 'cancelled']))
            .all())


def _shift_figures(shift, sales):
    """Expected drawer contents: float + cash in − cash out."""
    cash_in = Decimal('0')
    cash_out = Decimal('0')
    for sale in sales:
        for payment in sale.payments:
            if payment.kind == 'cash':
                if payment.amount >= 0:
                    cash_in += _money(payment.amount)
                else:
                    cash_out += -_money(payment.amount)
    sales_total = _money(sum(_money(s.total_amount or 0) for s in sales))
    refunds = _money(sum(_money(s.amount_refunded or 0) for s in sales))
    return {
        'total_sales': sales_total,
        'total_refunds': refunds,
        'expected_cash': _money(shift.opening_float) + cash_in - cash_out,
    }


# ── shifts ───────────────────────────────────────────────────────────────────

@bp.get('/shifts')
@require_any_permission('shop.shifts.manage', 'shop.shifts.view')
def list_shifts():
    q = ShopShift.query
    if scoped_branch_id() is not None:
        q = q.filter(ShopShift.branch_id == scoped_branch_id())
    if request.args.get('status'):
        q = q.filter_by(status=request.args.get('status'))
    p = paginate(q.order_by(ShopShift.id.desc()))
    user = current_user()
    return paginate_response([s.to_dict(user=user) for s in p.items], p)


@bp.get('/shifts/<int:row_id>')
@require_any_permission('shop.shifts.manage', 'shop.shifts.view')
def get_shift(row_id):
    row = ShopShift.query.get(row_id)
    if not row:
        return json_error('Shift not found', 404)
    sales = _shift_sales(row)
    payload = payload_for(row)
    payload['sales_count'] = len(sales)
    payload['figures'] = {k: float(v) for k, v in _shift_figures(row, sales).items()}
    return jsonify({'shift': payload})


@bp.post('/shifts')
@require_permission('shop.shifts.manage')
def open_shift():
    data = parse_json()
    branch_id = scoped_branch_id()
    if branch_id is None:
        branch_id = data.get('branch_id')
    if not branch_id:
        return json_error('A branch is required', 400)
    open_shift_row = (ShopShift.query
                      .filter_by(branch_id=int(branch_id), status='open').first())
    if open_shift_row and open_shift_row.opened_by == current_user_id():
        return json_error(f'Shift {open_shift_row.shift_number} is already open',
                          409, 'shift_already_open')
    row = ShopShift(
        shift_number=next_number('shift'), branch_id=int(branch_id),
        opened_by=current_user_id(), opening_float=_money(data.get('opening_float')),
        notes=data.get('notes'), status='open',
    )
    db.session.add(row)
    db.session.commit()
    audit('shop_shift_opened', 'shop_shift', row.id,
          new_value=payload_for(row))
    return jsonify({'shift': payload_for(row)}), 201


@bp.post('/shifts/<int:row_id>/close')
@require_permission('shop.shifts.manage')
def close_shift(row_id):
    row = ShopShift.query.get(row_id)
    if not row:
        return json_error('Shift not found', 404)
    if row.status != 'open':
        return json_error(f'A {row.status} shift cannot be closed', 409,
                          'shift_already_closed')
    # Claim the transition: a second close must not overwrite the first one's
    # counted cash or re-snapshot figures computed after the drawer moved.
    if db.session.execute(
            update(ShopShift)
            .where(ShopShift.id == row.id, ShopShift.status == 'open')
            .values(status='closed')).rowcount == 0:
        return json_error('That shift has already been closed', 409,
                          'shift_already_closed')
    row.status = 'closed'
    data = parse_json()
    sales = _shift_sales(row)
    figures = _shift_figures(row, sales)
    counted = _money(data.get('counted_cash'))
    row.total_sales = figures['total_sales']
    row.total_refunds = figures['total_refunds']
    row.expected_cash = figures['expected_cash']
    row.counted_cash = counted
    row.cash_difference = counted - figures['expected_cash']
    row.status = 'closed'
    row.closed_by = current_user_id()
    row.closed_at = datetime.now(timezone.utc)
    if data.get('notes'):
        row.notes = data['notes']
    db.session.commit()
    audit('shop_shift_closed', 'shop_shift', row.id,
          previous_value={'status': 'open'},
          new_value={**payload_for(row),
                     'cash_difference': float(row.cash_difference or 0)})
    if row.cash_difference != 0:
        notify_shop('shop.cash_closing.view', 'cash_shortage',
                    f'Shift {row.shift_number} closed with a cash difference '
                    f'of {float(row.cash_difference):,.0f}.',
                    related_type='shop_shift', related_id=row.id)
    return jsonify({'shift': payload_for(row)})


# ── daily closings ───────────────────────────────────────────────────────────

def _closing_figures(branch_id, business_date, shift_id=None):
    start, end = _day_window(business_date)
    q = ShopSale.query.filter(ShopSale.branch_id == branch_id,
                              ShopSale.created_at >= start,
                              ShopSale.created_at < end,
                              ShopSale.status.notin_(['held', 'cancelled']))
    if shift_id:
        q = q.filter(ShopSale.shift_id == shift_id)
    sales = q.all()
    breakdown = {}
    gross = discounts = taxes = refunds = Decimal('0')
    cash = Decimal('0')
    for sale in sales:
        gross += _money(sale.total_amount or 0)
        discounts += _money(sale.discount_amount or 0)
        taxes += _money(sale.tax_amount or 0)
        refunds += _money(sale.amount_refunded or 0)
        for payment in sale.payments:
            if payment.amount is None:
                continue
            key = (payment.method.code or payment.method.name) \
                if payment.method else 'other'
            breakdown[key] = breakdown.get(key, 0) + float(payment.amount)
            if payment.kind == 'cash' and payment.amount >= 0:
                cash += _money(payment.amount)
    cash_refunds = Decimal('0')
    for row in ShopReturn.query.filter(ShopReturn.branch_id == branch_id,
                                       ShopReturn.status == 'completed',
                                       ShopReturn.completed_at >= start,
                                       ShopReturn.completed_at < end).all():
        cash_refunds += _money(row.refund_amount or 0)
    expected = cash - cash_refunds
    return {
        # `gross_sales` is what customers were charged, i.e. already net of
        # line and cart discounts (and including tax). Subtracting `discounts`
        # again on the next line used to take them off twice; refunds are the
        # only figure that actually reduces the day's takings.
        'gross_sales': gross,
        'discounts': discounts,
        'taxes': taxes,
        'refunds': refunds,
        'net_sales': _money(gross - refunds),
        'expected_cash': expected,
        'payment_breakdown': {k: round(v, 2) for k, v in breakdown.items()},
        'sales_count': len(sales),
    }


@bp.get('/closings')
@require_any_permission('shop.cash_closing.view', 'shop.shifts.manage')
def list_closings():
    q = ShopDailyClosing.query
    if scoped_branch_id() is not None:
        q = q.filter(ShopDailyClosing.branch_id == scoped_branch_id())
    if request.args.get('status'):
        q = q.filter_by(status=request.args.get('status'))
    p = paginate(q.order_by(ShopDailyClosing.id.desc()))
    user = current_user()
    return paginate_response([c.to_dict(user=user) for c in p.items], p)


@bp.get('/closings/<int:row_id>')
@require_any_permission('shop.cash_closing.view', 'shop.shifts.view')
def get_closing(row_id):
    row = ShopDailyClosing.query.get(row_id)
    if not row:
        return json_error('Closing not found', 404)
    return jsonify({'closing': payload_for(row)})


@bp.post('/closings')
@require_any_permission('shop.shifts.manage', 'shop.cash_closing.view')
def submit_closing():
    data = parse_json()
    business_date = data.get('business_date')
    if not business_date:
        business_date = datetime.now(timezone.utc).date().isoformat()
    try:
        parsed_date = datetime.strptime(str(business_date)[:10], '%Y-%m-%d').date()
    except ValueError:
        return json_error('business_date must be YYYY-MM-DD', 400)
    branch_id = scoped_branch_id() or data.get('branch_id')
    if not branch_id:
        return json_error('A branch is required', 400)
    branch_id = int(branch_id)
    shift_id = data.get('shift_id')
    figures = _closing_figures(branch_id, parsed_date, shift_id)
    counted = _money(data.get('counted_cash'))

    row = ShopDailyClosing.query.filter_by(branch_id=branch_id,
                                           business_date=parsed_date).first()
    previous = payload_for(row) if row else None
    if row is None:
        row = ShopDailyClosing(closing_number=next_number('closing'),
                               branch_id=branch_id, business_date=parsed_date,
                               created_by=current_user_id())
        db.session.add(row)
    elif row.status in ('approved',):
        return json_error('That day is already approved', 409,
                          'closing_already_approved')
    row.shift_id = shift_id or row.shift_id
    row.status = 'submitted'
    row.gross_sales = figures['gross_sales']
    row.discounts = figures['discounts']
    row.taxes = figures['taxes']
    row.refunds = figures['refunds']
    row.net_sales = figures['net_sales']
    row.expected_cash = figures['expected_cash']
    row.counted_cash = counted
    row.cash_difference = counted - figures['expected_cash']
    row.payment_breakdown = figures['payment_breakdown']
    row.submitted_at = datetime.now(timezone.utc)
    row.reviewed_at = None
    row.reviewed_by = None
    if data.get('notes'):
        row.notes = data['notes']
    db.session.commit()
    audit('shop_closing_submitted', 'shop_daily_closing', row.id,
          previous_value=previous, new_value=payload_for(row))
    notify_shop('shop.cash_closing.approve', 'shop_closing_approval',
                f'Closing {row.closing_number} for {parsed_date.isoformat()} '
                f'awaits review.', related_type='shop_daily_closing',
                related_id=row.id, rule='shop-closing-approval')
    return jsonify({'closing': payload_for(row)}), 201


@bp.post('/closings/<int:row_id>/approve')
@require_permission('shop.cash_closing.approve')
def approve_closing(row_id):
    row = ShopDailyClosing.query.get(row_id)
    if not row:
        return json_error('Closing not found', 404)
    if row.status == 'approved':
        return json_error('That closing is already approved', 409)
    row.status = 'approved'
    row.reviewed_by = current_user_id()
    row.reviewed_at = datetime.now(timezone.utc)
    db.session.commit()
    audit('shop_closing_approved', 'shop_daily_closing', row.id,
          previous_value={'status': 'submitted'}, new_value=payload_for(row))
    return jsonify({'closing': payload_for(row)})


@bp.post('/closings/<int:row_id>/reject')
@require_permission('shop.cash_closing.approve')
def reject_closing(row_id):
    row = ShopDailyClosing.query.get(row_id)
    if not row:
        return json_error('Closing not found', 404)
    data = parse_json()
    # An approved day is locked: rejecting it afterwards would silently
    # reopen a reviewed closing (and its figures) without an audit event.
    if row.status == 'approved':
        return json_error('An approved closing cannot be rejected', 409,
                          'closing_already_approved')
    reviewed_by = current_user_id()
    reviewed_at = datetime.now(timezone.utc)
    if db.session.execute(
            update(ShopDailyClosing)
            .where(ShopDailyClosing.id == row.id)
            .where(ShopDailyClosing.status != 'approved')
            .values(status='rejected', reviewed_by=reviewed_by,
                    reviewed_at=reviewed_at)).rowcount == 0:
        return json_error('An approved closing cannot be rejected', 409,
                          'closing_already_approved')
    row.status = 'rejected'
    row.reviewed_by = reviewed_by
    row.reviewed_at = reviewed_at
    if data.get('note'):
        row.notes = data['note']
    db.session.commit()
    audit('shop_closing_rejected', 'shop_daily_closing', row.id,
          previous_value={'status': 'submitted'}, new_value=payload_for(row))
    if row.created_by:
        from ...services.notifications import notify
        notify(row.created_by, 'closing_reviewed',
               f'Closing {row.closing_number} was returned: '
               f'{data.get("note") or "review needed"}.',
               related_type='shop_daily_closing', related_id=row.id)
    return jsonify({'closing': payload_for(row)})
