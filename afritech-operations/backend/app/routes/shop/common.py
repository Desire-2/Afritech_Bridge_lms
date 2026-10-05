"""Shared plumbing for the electronics shop blueprints.

Everything that is cross-cutting — branch scoping, redacted serialisation,
money-aware audit entries, notification fan-out and stock-error mapping —
lives here so the resource blueprints stay about their own domain.
"""
from flask import jsonify, request, g

from ...extensions import db
from ...models import Branch, Employee, ShopProduct, ShopProductVariant
from ...auth.auth import current_user, current_employee
from ...auth.shop_scope import (
    can_view_all_shop_branches, shop_discount_limit, can_approve_shop_discount,
)
from ...services.audit import audit
from ...services.notifications import notify_users_with_permission
from ...services.shop_inventory import ShopStockError


# ── branch scoping ───────────────────────────────────────────────────────────

def user_branch_id():
    """The branch of the logged-in user's employee profile, if any."""
    emp = current_employee()
    return emp.branch_id if emp else None


def requested_branch_id():
    """``branch_id`` from the query string (raw, may be None/invalid)."""
    raw = request.args.get('branch_id')
    if not raw:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def scoped_branch_id():
    """Which branch this request may read.

    Returns an int when the user is pinned to a branch or asked for one, or
    ``None`` meaning "every branch they are allowed to see".
    """
    if not can_view_all_shop_branches(current_user()) and not current_user().is_super_admin:
        return user_branch_id()
    return requested_branch_id()


def apply_branch_filter(query, model, branch_id=None, argument_supplied=None):
    """Restrict a query to the caller's branch unless they hold view_all."""
    if branch_id is None:
        return query
    return query.filter(model.branch_id == branch_id)


def resolve_branch(branch_id=None, required=True):
    """Load a branch the caller is allowed to act on."""
    branch_id = branch_id or requested_branch_id() or user_branch_id()
    if branch_id is None:
        if required:
            raise ShopStockError('A branch is required for this action', 400,
                                 'branch_required')
        return None
    branch = Branch.query.get(branch_id)
    if branch is None:
        raise ShopStockError('Branch not found', 404, 'branch_not_found')
    if not can_view_all_shop_branches(current_user()) and not current_user().is_super_admin:
        if branch.id != user_branch_id():
            raise ShopStockError('You do not have access to this branch', 403,
                                 'branch_forbidden')
    return branch


# ── serialisation / audit / notifications ────────────────────────────────────

def payload_for(obj, **kwargs):
    """``to_dict`` of a shop model, always bound to the calling user so money
    columns appear only when the caller's permissions allow them."""
    if obj is None:
        return None
    return obj.to_dict(user=current_user(), **kwargs)


def shop_audit(action, entity, entity_id, previous_value=None, new_value=None):
    return audit(action, entity, entity_id=entity_id,
                 previous_value=previous_value, new_value=new_value)


def notify_shop(permission, notification_type, message, related_type=None,
                related_id=None, rule=None, severity=None):
    """Fan out to every active user holding ``permission``."""
    return notify_users_with_permission(
        permission, notification_type, message, severity=severity,
        related_type=related_type, related_id=related_id, rule=rule)


def stock_error(error):
    """Map a :class:`ShopStockError` onto its HTTP response.

    The session is rolled back first: handlers return this response rather
    than letting the exception bubble, so the write side has to be undone here
    or the request would end with half-applied stock changes.
    """
    db.session.rollback()
    return jsonify({'error': error.message, 'code': error.code}), error.status


# ── product / variant resolution ─────────────────────────────────────────────

def resolve_variant(data):
    """Find the product and optional variant from an item payload.

    Accepts ``product_id``/``variant_id`` or a ``sku``/``barcode`` — the POS
    scanner posts a barcode string, the catalogue UI posts ids.
    """
    product = None
    variant = None
    if data.get('product_id'):
        product = ShopProduct.query.get(data['product_id'])
    elif data.get('sku'):
        product = ShopProduct.query.filter_by(sku=str(data['sku']).strip()).first()
        if product is None:
            product = ShopProduct.query.filter_by(
                barcode=str(data['sku']).strip()).first()
    elif data.get('barcode'):
        product = ShopProduct.query.filter_by(
            barcode=str(data['barcode']).strip()).first()
        if product is None:
            variant = ShopProductVariant.query.filter_by(
                barcode=str(data['barcode']).strip()).first()
            if variant is not None:
                product = variant.product
    if product is None:
        raise ShopStockError('Product not found', 404, 'product_not_found')
    if variant is None and data.get('variant_id'):
        variant = ShopProductVariant.query.get(data['variant_id'])
        if variant is None or variant.product_id != product.id:
            raise ShopStockError('Variant not found', 404, 'variant_not_found')
    return product, variant


def line_identity(product, variant):
    """Stable key used to merge duplicate lines in one POS basket."""
    return (product.id, variant.id if variant else None)


def resolve_item(entry):
    """Resolve ``{product_id | sku, variant_id}`` into ``(product, variant)``.

    Raises :class:`ShopStockError` (404/400) so callers can answer with the
    stock-error response instead of a 500.
    """
    if not isinstance(entry, dict):
        raise ShopStockError('Each line must be an object', 400, 'invalid_line')
    product = None
    variant = None
    variant_id = entry.get('variant_id')
    if variant_id:
        variant = ShopProductVariant.query.get(int(variant_id))
        if variant is not None:
            product = variant.product
    if product is None and entry.get('product_id'):
        product = ShopProduct.query.get(int(entry['product_id']))
    if product is None and entry.get('sku'):
        code = str(entry['sku']).strip()
        product = ShopProduct.query.filter(
            db.or_(ShopProduct.sku == code, ShopProduct.barcode == code)).first()
        if product is None:
            variant = ShopProductVariant.query.filter(
                db.or_(ShopProductVariant.sku == code,
                       ShopProductVariant.barcode == code)).first()
            if variant is not None:
                product = variant.product
    if product is None:
        raise ShopStockError('Product not found', 404, 'product_not_found')
    if variant is None and variant_id:
        raise ShopStockError('Variant not found', 404, 'variant_not_found')
    return product, variant


# ── discounts ────────────────────────────────────────────────────────────────

def evaluate_discount(user, discount_percent, discount_amount=None,
                      reason=None):
    """Validate a discount against the caller's configured ceiling.

    Returns ``(True, approver_id)`` when allowed, ``(False, message)`` when it
    must be rejected. Nothing about the limit is hard-coded: the ceiling comes
    from ``shop_scope.shop_discount_limit`` which reads the
    ``shop.discount.thresholds`` setting.
    """
    percent = float(discount_percent or 0)
    if percent <= 0:
        return True, None
    if percent > 100:
        return False, 'Discount cannot exceed 100%'
    limit = shop_discount_limit(user)
    if percent <= limit + 0.0001:
        # Within the personal allowance — but a holder of the approval
        # permission still records themselves as approver for the audit trail.
        return True, (user.id if can_approve_shop_discount(user) else None)
    if can_approve_shop_discount(user):
        return True, user.id
    return False, (f'Discount of {percent:g}% exceeds your limit of '
                   f'{limit:g}% and needs approval')


# ── request plumbing ─────────────────────────────────────────────────────────

def request_branch_id_from_body(data):
    raw = (data or {}).get('branch_id')
    if raw in (None, ''):
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def page_args():
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int) or 50, 500)
    return page, per_page


def current_user_id():
    user = current_user()
    return user.id if user else None
