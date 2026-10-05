"""Shop alert rules — scheduled checks over the electronics shop.

Registered with the existing automation engine (``services.automation.run_all``)
so shop alerts appear in the same place, with the same 24-hour de-duplication
and the same "persist what notify() queued" contract.

Every rule only reads shop tables and only notifies holders of a shop
permission: no service-centre role ever learns that a product is low, that a
purchase order is waiting or that a till is short.
"""
from datetime import datetime, timedelta, timezone

from ..extensions import db
from ..models import (
    ShopInventoryBalance, ShopProduct, ShopPurchaseOrder, ShopReturn,
    ShopDailyClosing, ShopStockAlert, ShopStockTransfer, ShopWarrantyCase,
)
from .notifications import notify_users_with_permission

RULE_LOW_STOCK = 'shop-low-stock'
RULE_PURCHASE_APPROVAL = 'shop-purchase-approval'
RULE_RETURN_APPROVAL = 'shop-return-approval'
RULE_CLOSING_APPROVAL = 'shop-closing-approval'
RULE_TRANSFER = 'shop-transfer'
RULE_WARRANTY_OVERDUE = 'shop-warranty-overdue'
RULE_DEAD_STOCK = 'shop-dead-stock'

DEFAULT_DEAD_STOCK_DAYS = 90


def _now():
    return datetime.now(timezone.utc)


def _setting_float(key, default):
    from ..models import Setting
    row = Setting.query.filter_by(key=key).first()
    if row and row.value:
        try:
            return float(row.value)
        except Exception:
            return default
    return default


def _alert_threshold(product):
    """Units at/below which the product should be reordered at this branch."""
    for level in (product.reorder_level, product.min_stock_level):
        if level and int(level) > 0:
            return int(level)
    return None


def _open_alert(key, alert_type, message, quantity, product_id=None,
                variant_id=None, branch_id=None):
    """Create or reopen the alert row. Returns True when it *newly* opened."""
    row = ShopStockAlert.query.filter_by(alert_key=key).first()
    if row:
        reopened = row.resolved_at is not None
        row.alert_type = alert_type
        row.message = message
        row.quantity = quantity
        row.resolved_at = None
        return reopened
    db.session.add(ShopStockAlert(
        alert_key=key,
        alert_type=alert_type,
        product_id=product_id,
        variant_id=variant_id,
        branch_id=branch_id,
        message=message,
        quantity=quantity,
        created_at=_now(),
    ))
    return True


def _close_alert(key):
    row = ShopStockAlert.query.filter_by(alert_key=key).first()
    if row and row.resolved_at is None:
        row.resolved_at = _now()
        return True
    return False


def shop_stock_alert(scope_date=None):
    """Low / out-of-stock balances, with recovery closing the alert again."""
    balances = (ShopInventoryBalance.query
                .join(ShopProduct, ShopProduct.id == ShopInventoryBalance.product_id)
                .filter(ShopProduct.status == 'active')
                .all())
    opened = 0
    for b in balances:
        threshold = _alert_threshold(b.product)
        if threshold is None:
            continue
        available = max(int(b.quantity) - int(b.reserved_quantity), 0)
        key = f'stock:{b.product_id}:{b.variant_id or 0}:{b.branch_id}'
        name = b.product.name
        if available > threshold:
            _close_alert(key)
            continue
        if available <= 0:
            alert_type = 'out_of_stock'
            message = f'{name} is out of stock at {b.branch.name}.'
        else:
            alert_type = 'low_stock'
            message = (f'{name} is down to {available} unit(s) at '
                       f'{b.branch.name} (reorder level {threshold}).')
        if _open_alert(key, alert_type, message, available,
                       product_id=b.product_id, variant_id=b.variant_id,
                       branch_id=b.branch_id):
            opened += 1
            notify_users_with_permission(
                'shop.purchases.create', 'shop_' + alert_type, message,
                related_type='shop_product', related_id=b.product_id,
                rule=RULE_LOW_STOCK)
    return opened


def shop_purchase_approval_alert(scope_date=None):
    orders = ShopPurchaseOrder.query.filter_by(status='pending_approval').all()
    count = 0
    for po in orders:
        message = (f'Purchase order {po.po_number} from '
                   f'{po.supplier.company_name} awaits approval.')
        sent = notify_users_with_permission(
                'shop.purchases.approve', 'shop_purchase_approval', message,
                related_type='shop_purchase_order', related_id=po.id,
                rule=RULE_PURCHASE_APPROVAL)
        if sent:
            count += 1
    return count


def shop_return_approval_alert(scope_date=None):
    returns = ShopReturn.query.filter_by(status='requested').all()
    count = 0
    for r in returns:
        message = (f'Return {r.return_number} against sale '
                   f'{r.sale.sale_number if r.sale else r.sale_id} awaits approval.')
        sent = notify_users_with_permission(
                'shop.returns.approve', 'shop_return_approval', message,
                related_type='shop_return', related_id=r.id,
                rule=RULE_RETURN_APPROVAL)
        if sent:
            count += 1
    return count


def shop_closing_approval_alert(scope_date=None):
    closings = ShopDailyClosing.query.filter_by(status='submitted').all()
    count = 0
    for c in closings:
        message = (f'Shop cash closing {c.closing_number} for '
                   f'{c.branch.name} ({c.business_date}) awaits approval.')
        sent = notify_users_with_permission(
                'shop.cash_closing.approve', 'shop_closing_approval', message,
                related_type='shop_closing', related_id=c.id,
                rule=RULE_CLOSING_APPROVAL)
        if sent:
            count += 1
    return count


def shop_transfer_alert(scope_date=None):
    transfers = ShopStockTransfer.query.filter(
        ShopStockTransfer.status.in_(['requested', 'dispatched'])).all()
    count = 0
    for t in transfers:
        if t.status == 'requested':
            message = (f'Transfer {t.transfer_number} to {t.to_branch.name} '
                       f'is waiting to be dispatched.')
        else:
            message = (f'Transfer {t.transfer_number} has arrived at '
                       f'{t.to_branch.name} and awaits receipt.')
        sent = notify_users_with_permission(
                'shop.inventory.transfer', 'shop_transfer_ready', message,
                related_type='shop_stock_transfer', related_id=t.id,
                rule=RULE_TRANSFER)
        if sent:
            count += 1
    return count


def shop_warranty_overdue_alert(scope_date=None):
    cases = ShopWarrantyCase.query.filter(
        ShopWarrantyCase.status.notin_(['resolved', 'closed', 'rejected']),
        ShopWarrantyCase.due_at.isnot(None),
    ).all()
    count = 0
    for case in cases:
        if not case.is_overdue:
            continue
        message = (f'Warranty case {case.case_number} is overdue '
                   f'(due {case.due_at.date()}).')
        sent = notify_users_with_permission(
                'shop.warranty.manage', 'shop_warranty_overdue', message,
                related_type='shop_warranty_case', related_id=case.id,
                rule=RULE_WARRANTY_OVERDUE)
        if sent:
            count += 1
    return count


def shop_dead_stock_alert(scope_date=None):
    """Products sitting untouched for longer than the configured window."""
    days = int(_setting_float('shop.alerts.dead_stock_days',
                              DEFAULT_DEAD_STOCK_DAYS))
    cutoff = _now() - timedelta(days=days)
    balances = (ShopInventoryBalance.query
                .filter(ShopInventoryBalance.quantity > 0)
                .join(ShopProduct, ShopProduct.id == ShopInventoryBalance.product_id)
                .filter(ShopProduct.status == 'active')
                .all())
    count = 0
    for b in balances:
        moved_at = b.last_movement_at
        if moved_at is None:
            moved_at = b.updated_at
        if not moved_at:
            continue
        if moved_at.tzinfo is None:
            moved_at = moved_at.replace(tzinfo=timezone.utc)
        if moved_at > cutoff:
            continue
        days_idle = ( _now() - moved_at).days
        message = (f'{b.product.name} has not moved at {b.branch.name} for '
                   f'{days_idle} days ({int(b.quantity)} in stock).')
        sent = notify_users_with_permission(
                'shop.reports.view', 'shop_dead_stock', message,
                related_type='shop_product', related_id=b.product_id,
                rule=RULE_DEAD_STOCK)
        if sent:
            count += 1
    return count


TRIGGERS = [
    shop_stock_alert,
    shop_purchase_approval_alert,
    shop_return_approval_alert,
    shop_closing_approval_alert,
    shop_transfer_alert,
    shop_warranty_overdue_alert,
    shop_dead_stock_alert,
]
