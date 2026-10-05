"""Shop data boundaries: which money a given user may read.

Kept deliberately free of model imports so ``Shop*.to_dict()`` can import it
from anywhere without risking a circular import. Only permission codes live
here — never role names — so a custom role behaves correctly too.

Two tiers of money exist in the shop:

``can_view_shop_costs``   unit cost, margin, stock value, purchase pricing.
                          The ledger and profit side of the business.
``can_view_shop_financials``  revenue, totals, refunds, closings, credit
                          limits. Required *in addition* to costs for full
                          financial reports.

A user with neither tier still gets a perfectly usable operational payload:
quantities, statuses, serials, dates and customer contact details, with the
money columns simply absent from the JSON.
"""

SHOP_COST_PERMISSIONS = (
    'shop.pricing.view',
    'shop.pricing.manage',
    'shop.purchases.create',
    'shop.purchases.approve',
    'shop.purchases.receive',
    'shop.financial_reports.view',
)

SHOP_FINANCIAL_PERMISSIONS = (
    'shop.financial_reports.view',
    'shop.cash_closing.view',
    'shop.cash_closing.approve',
    'shop.sales.view_all',
    'shop.sales.refund',
)

# Discount ceilings by role code, expressed as a percentage of the line total.
# Nothing is hard-coded into a route: the whole map can be replaced at runtime
# with the ``shop.discount.thresholds`` setting (JSON object).
DEFAULT_DISCOUNT_THRESHOLDS = {
    'shop_manager': 25.0,
    'shop_attendant': 10.0,
    'storekeeper': 0.0,
    'manager': 25.0,
    'accountant': 0.0,
    'default': 0.0,
}


def _granted(user, codes):
    if user is None:
        return False
    if getattr(user, 'is_super_admin', False):
        return True
    return any(user.has_permission(c) for c in codes)


def can_view_shop(user):
    """True when the shop workspace may be opened at all."""
    if user is None:
        return False
    if getattr(user, 'is_super_admin', False):
        return True
    return user.has_permission('shop.view')


def can_view_shop_costs(user):
    """Unlock unit cost, margin, stock value and purchase pricing columns."""
    return _granted(user, SHOP_COST_PERMISSIONS)


def can_view_shop_financials(user):
    """Unlock revenue, totals, refunds, credit limits and cash closings."""
    if user is None:
        return False
    if getattr(user, 'is_super_admin', False):
        return True
    return _granted(user, SHOP_FINANCIAL_PERMISSIONS + ('shop.pricing.view',))


def can_view_shop_reports(user):
    """Any shop report, operational or financial."""
    if user is None:
        return False
    if getattr(user, 'is_super_admin', False):
        return True
    return user.has_permission('shop.reports.view') or user.has_permission(
        'shop.financial_reports.view')


def can_view_shop_activities(user):
    """The redacted shop activity trail (safe for oversight roles)."""
    if user is None:
        return False
    if getattr(user, 'is_super_admin', False):
        return True
    return user.has_permission('shop.activities.view')


def can_view_all_shop_branches(user):
    """Cross-branch sales and stock visibility."""
    if user is None:
        return False
    if getattr(user, 'is_super_admin', False):
        return True
    return user.has_permission('shop.sales.view_all')


def can_approve_shop_discount(user):
    return _granted(user, ('shop.discounts.approve',))


def _thresholds():
    """Configured discount ceilings, merged over the defaults."""
    thresholds = dict(DEFAULT_DISCOUNT_THRESHOLDS)
    try:
        from ..models import Setting
        row = Setting.query.filter_by(key='shop.discount.thresholds').first()
        if row and row.value:
            import json
            loaded = json.loads(row.value)
            if isinstance(loaded, dict):
                thresholds.update(loaded)
    except Exception:
        pass
    return thresholds


def shop_discount_limit(user):
    """Maximum discount percent this user may apply without approval.

    Super admins and holders of ``shop.discounts.approve`` are unrestricted;
    everyone else is limited to the ceiling of their highest-privileged shop
    role. A role that is absent from the configuration falls back to the
    ``default`` entry — which is 0, so an unknown role never silently gains a
    discount.
    """
    if user is None:
        return 0.0
    if getattr(user, 'is_super_admin', False) or user.has_permission(
            'shop.discounts.approve'):
        return 100.0
    thresholds = _thresholds()
    limit = float(thresholds.get('default', 0.0))
    for code in getattr(user, 'role_codes', []) or []:
        if code in thresholds:
            limit = max(limit, float(thresholds[code]))
    return limit
