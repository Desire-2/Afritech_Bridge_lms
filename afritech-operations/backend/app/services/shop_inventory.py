"""Shop inventory engine — the only writer of stock inside the shop module.

Every route that changes stock goes through this module. It owns three
invariants:

1. ``ShopStockMovement`` is append-only: each call inserts exactly one ledger
   row and never touches an existing one.
2. ``ShopInventoryBalance.quantity`` is updated with a conditional ``UPDATE``
   (``WHERE quantity >= :n`` for decrements) so two concurrent sales can never
   drive stock negative. A failed guard raises :class:`ShopStockError` with
   HTTP 409, which routes surface as "stock changed, please retry".
3. Reservations never touch the ledger — they only move units between the
   sellable pool (``quantity``) and the held pool (``reserved_quantity``).

Costing is configurable per installation through the
``shop.inventory.costing_method`` setting (``wac`` default, ``fifo``
alternative).
"""
from datetime import datetime, timezone

from sqlalchemy import func, update
from sqlalchemy.exc import OperationalError

from ..extensions import db
from ..models import (
    ShopInventoryBalance, ShopInventoryLayer, ShopStockMovement, ShopProduct,
    ShopProductVariant, Setting, SHOP_MOVEMENT_TYPES,
)

# Movement types that increase sellable stock.
IN_MOVEMENTS = {
    'opening_balance', 'purchase', 'customer_return', 'transfer_in',
    'sale_reversal', 'correction', 'stock_count', 'adjustment',
}
# Movement types that decrease sellable stock.
OUT_MOVEMENTS = {
    'sale', 'supplier_return', 'transfer_out', 'damage', 'loss',
    'correction', 'stock_count', 'adjustment',
}
# Out-flows that must not eat units another basket is holding: the reservation
# is a promise to the customer at that till. Stock *corrections* are left out
# on purpose — a physical count reports reality and has to be recordable even
# when a hold exists (the reservation then fails at completion, loudly).
RESERVED_GUARDED_OUT_MOVEMENTS = {
    'sale', 'supplier_return', 'transfer_out', 'damage', 'loss',
}
# Receipts whose cost feeds the weighted average.
COSTING_IN_MOVEMENTS = {
    'opening_balance', 'purchase', 'customer_return', 'transfer_in',
    'sale_reversal', 'correction', 'adjustment', 'stock_count',
}

DEFAULT_COSTING_METHOD = 'wac'


class ShopStockError(Exception):
    """Stock could not be changed. ``status`` is the HTTP code to return."""

    def __init__(self, message, status=409, code='stock_error'):
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code

    @property
    def payload(self):
        return {'error': self.message, 'code': self.code}


def _utc_now():
    return datetime.now(timezone.utc)


def costing_method():
    row = Setting.query.filter_by(key='shop.inventory.costing_method').first()
    value = (row.value or '').strip().lower() if row and row.value else ''
    return 'fifo' if value == 'fifo' else DEFAULT_COSTING_METHOD


# ── balances ─────────────────────────────────────────────────────────────────

def get_balance(product_id, branch_id, variant_id=None, create=True):
    balance = ShopInventoryBalance.query.filter_by(
        product_id=product_id, variant_id=variant_id, branch_id=branch_id).first()
    if balance is None and create:
        balance = ShopInventoryBalance(
            product_id=product_id, variant_id=variant_id, branch_id=branch_id)
        db.session.add(balance)
        db.session.flush()
    return balance


def available_quantity(product_id, branch_id, variant_id=None):
    balance = ShopInventoryBalance.query.filter_by(
        product_id=product_id, variant_id=variant_id, branch_id=branch_id).first()
    if balance is None:
        return 0
    return max(int(balance.quantity) - int(balance.reserved_quantity), 0)


def product_stock(product_id, branch_id=None):
    """Every balance row for a product, optionally narrowed to one branch."""
    query = ShopInventoryBalance.query.filter_by(product_id=product_id)
    if branch_id is not None:
        query = query.filter_by(branch_id=branch_id)
    rows = query.all()
    return {
        'on_hand': sum(int(r.quantity) for r in rows),
        'reserved': sum(int(r.reserved_quantity) for r in rows),
        'damaged': sum(int(r.damaged_quantity) for r in rows),
        'available': sum(max(int(r.quantity) - int(r.reserved_quantity), 0)
                         for r in rows),
        'branches': [r.to_dict() for r in rows],
    }


def stock_value(branch_id=None):
    """Total stock at cost. Callers must hold a shop cost permission."""
    query = db.session.query(
        func.coalesce(func.sum(ShopInventoryBalance.quantity
                               * ShopInventoryBalance.average_cost), 0))
    if branch_id is not None:
        query = query.filter(ShopInventoryBalance.branch_id == branch_id)
    return float(query.scalar() or 0)


# ── ledger posting ───────────────────────────────────────────────────────────

def _guard_balance(balance, quantity, respect_reservation=False):
    """Conditional UPDATE; returns False when the guard rejected the change.

    ``respect_reservation`` additionally refuses a decrement that would dip
    into ``reserved_quantity`` — stock that is physically on the shelf but
    promised to a held basket elsewhere in the shop.
    """
    now = _utc_now()
    stmt = update(ShopInventoryBalance).where(
        ShopInventoryBalance.id == balance.id)
    if quantity < 0:
        needed = abs(int(quantity))
        stmt = stmt.where(ShopInventoryBalance.quantity >= needed)
        if respect_reservation:
            stmt = stmt.where(
                ShopInventoryBalance.quantity - ShopInventoryBalance.reserved_quantity
                >= needed)
    result = db.session.execute(stmt.values(
        quantity=ShopInventoryBalance.quantity + int(quantity),
        last_movement_at=now,
        updated_at=now,
    ))
    return result.rowcount > 0


def _guard_reservation(balance, delta, need_available=False):
    """Atomic reservation change; False when it would oversell or underflow."""
    now = _utc_now()
    stmt = update(ShopInventoryBalance).where(
        ShopInventoryBalance.id == balance.id)
    if need_available:
        stmt = stmt.where(
            ShopInventoryBalance.quantity - ShopInventoryBalance.reserved_quantity
            >= int(delta))
    else:
        stmt = stmt.where(ShopInventoryBalance.reserved_quantity >= abs(int(delta)))
    result = db.session.execute(stmt.values(
        reserved_quantity=ShopInventoryBalance.reserved_quantity + int(delta),
        updated_at=now,
    ))
    return result.rowcount > 0


def _fifo_receipt(balance, quantity, unit_cost, timestamp):
    layer = ShopInventoryLayer(
        product_id=balance.product_id,
        variant_id=balance.variant_id,
        branch_id=balance.branch_id,
        quantity_received=int(quantity),
        quantity_remaining=int(quantity),
        unit_cost=unit_cost or 0,
        received_at=timestamp,
    )
    db.session.add(layer)
    return float(unit_cost or 0)


def _fifo_consume(balance, quantity):
    """Consume oldest layers; returns (total_cost, unit_cost)."""
    layers = (ShopInventoryLayer.query
              .filter_by(product_id=balance.product_id,
                         variant_id=balance.variant_id,
                         branch_id=balance.branch_id)
              .filter(ShopInventoryLayer.quantity_remaining > 0)
              .order_by(ShopInventoryLayer.received_at, ShopInventoryLayer.id)
              .all())
    remaining = int(quantity)
    total = 0.0
    for layer in layers:
        if remaining <= 0:
            break
        take = min(remaining, int(layer.quantity_remaining))
        total += take * float(layer.unit_cost or 0)
        layer.quantity_remaining = int(layer.quantity_remaining) - take
        remaining -= take
    if remaining > 0:
        # Stock exists (the guard passed) but no layer does — fall back to the
        # running average so the receipt never books a zero cost.
        average = float(balance.average_cost or 0)
        total += remaining * average
    unit_cost = total / int(quantity) if quantity else 0.0
    return total, unit_cost


def post_movement(*, product_id, branch_id, movement_type, quantity,
                  variant_id=None, reference_type='manual', reference_id=None,
                  unit_cost=None, note=None, user_id=None, timestamp=None):
    """Apply a signed stock change and append its ledger row.

    ``quantity`` is signed: positive grows sellable stock, negative shrinks it.
    Returns the :class:`ShopStockMovement`. Raises :class:`ShopStockError`
    when the guard rejects the change (insufficient stock / concurrent sale)
    or when the database reports a lock conflict.
    """
    if movement_type not in SHOP_MOVEMENT_TYPES:
        raise ShopStockError(f'Unknown movement type {movement_type}', 400,
                             'invalid_movement')
    quantity = int(quantity)
    if quantity == 0:
        raise ShopStockError('Quantity must not be zero', 400,
                             'invalid_quantity')
    if timestamp is None:
        timestamp = _utc_now()

    method = costing_method()
    balance = get_balance(product_id, branch_id, variant_id=variant_id,
                          create=quantity > 0)
    if balance is None:
        raise ShopStockError('No stock record for that item at this branch',
                             409, 'no_stock_record')

    if quantity < 0 and movement_type in OUT_MOVEMENTS and method == 'fifo':
        # Cost has to be measured before the balance moves.
        total_cost, resolved_cost = _fifo_consume(balance, abs(quantity))
    else:
        total_cost, resolved_cost = None, None

    try:
        if quantity < 0:
            if not _guard_balance(
                    balance, quantity,
                    respect_reservation=movement_type
                    in RESERVED_GUARDED_OUT_MOVEMENTS):
                raise ShopStockError(
                    'Not enough sellable stock for this branch (units may be '
                    'held for another sale)', 409, 'insufficient_stock')
        else:
            _guard_balance(balance, quantity)
    except OperationalError:
        db.session.rollback()
        raise ShopStockError('Inventory is busy, please retry', 409,
                             'inventory_locked')

    # Re-read before costing: the guard's UPDATE changed quantity underneath us.
    db.session.flush()
    db.session.refresh(balance)

    if method == 'fifo':
        if quantity > 0 and movement_type in COSTING_IN_MOVEMENTS:
            _fifo_receipt(balance, quantity, unit_cost, timestamp)
            resolved_cost = float(unit_cost or 0)
            total_cost = resolved_cost * abs(quantity)
        elif quantity < 0 and resolved_cost is None:
            total_cost, resolved_cost = _fifo_consume(balance, abs(quantity))
    else:
        if quantity > 0 and movement_type in COSTING_IN_MOVEMENTS:
            cost = float(unit_cost or balance.average_cost or 0)
            old_qty = int(balance.quantity) - int(quantity)
            if old_qty > 0 and cost:
                new_average = ((old_qty * float(balance.average_cost or 0))
                               + int(quantity) * cost) / (old_qty + int(quantity))
            elif cost:
                new_average = cost
            else:
                new_average = float(balance.average_cost or 0)
            balance.average_cost = round(new_average, 4)
            if movement_type in ('purchase', 'opening_balance'):
                balance.last_cost = round(cost, 4)
        if quantity < 0 and resolved_cost is None:
            resolved_cost = float(balance.average_cost or 0)
            total_cost = resolved_cost * abs(quantity)

    if resolved_cost is None:
        resolved_cost = float(unit_cost or 0)
    if total_cost is None:
        total_cost = resolved_cost * abs(quantity)

    db.session.flush()
    db.session.refresh(balance)

    movement = ShopStockMovement(
        reference_type=reference_type,
        reference_id=reference_id,
        movement_type=movement_type,
        product_id=product_id,
        variant_id=variant_id,
        branch_id=branch_id,
        quantity=int(quantity),
        unit_cost=round(float(resolved_cost or 0), 4),
        total_cost=round(float(total_cost or 0), 4),
        balance_after=int(balance.quantity),
        note=note,
        created_by=user_id,
        created_at=timestamp,
    )
    db.session.add(movement)
    db.session.flush()
    return movement


# ── reservations ─────────────────────────────────────────────────────────────

def reserve(product_id, branch_id, quantity, variant_id=None):
    """Hold units for an in-flight sale. Raises ShopStockError on shortfall."""
    quantity = int(quantity)
    if quantity <= 0:
        raise ShopStockError('Quantity must be positive', 400, 'invalid_quantity')
    balance = get_balance(product_id, branch_id, variant_id=variant_id,
                          create=False)
    if balance is None:
        raise ShopStockError('Insufficient stock for this branch', 409,
                             'insufficient_stock')
    try:
        if not _guard_reservation(balance, quantity, need_available=True):
            raise ShopStockError('Insufficient available stock', 409,
                                 'insufficient_stock')
    except OperationalError:
        db.session.rollback()
        raise ShopStockError('Inventory is busy, please retry', 409,
                             'inventory_locked')
    db.session.flush()
    db.session.refresh(balance)
    return balance


def release_reservation(product_id, branch_id, quantity, variant_id=None):
    """Return held units to the sellable pool (sale cancelled / held released)."""
    quantity = int(quantity)
    if quantity <= 0:
        return None
    balance = get_balance(product_id, branch_id, variant_id=variant_id,
                          create=False)
    if balance is None:
        return None
    _guard_reservation(balance, -quantity, need_available=False)
    db.session.flush()
    db.session.refresh(balance)
    return balance


def settle_reservation(product_id, branch_id, quantity, movement_type='sale',
                       **movement_kwargs):
    """Convert held units into a sale movement in one guarded statement.

    Used at sale completion: reserved units are consumed and the ledger row is
    written with the balance the customer actually took.
    """
    quantity = int(quantity)
    balance = get_balance(product_id, branch_id,
                          variant_id=movement_kwargs.get('variant_id'),
                          create=False)
    if balance is None:
        raise ShopStockError('Insufficient stock for this branch', 409,
                             'insufficient_stock')
    now = _utc_now()
    stmt = (update(ShopInventoryBalance)
            .where(ShopInventoryBalance.id == balance.id)
            .where(ShopInventoryBalance.quantity >= abs(quantity))
            .where(ShopInventoryBalance.reserved_quantity >= abs(quantity))
            .values(
                quantity=ShopInventoryBalance.quantity - abs(quantity),
                reserved_quantity=ShopInventoryBalance.reserved_quantity
                - abs(quantity),
                last_movement_at=now,
                updated_at=now,
            ))
    try:
        result = db.session.execute(stmt)
    except OperationalError:
        db.session.rollback()
        raise ShopStockError('Inventory is busy, please retry', 409,
                             'inventory_locked')
    if result.rowcount == 0:
        raise ShopStockError(
            'Held stock is no longer available (another sale may have taken it)',
            409, 'reservation_conflict')
    db.session.flush()
    db.session.refresh(balance)

    method = costing_method()
    if method == 'fifo':
        total_cost, resolved_cost = _fifo_consume(balance, abs(quantity))
    else:
        resolved_cost = float(balance.average_cost or 0)
        total_cost = resolved_cost * abs(quantity)

    movement = ShopStockMovement(
        reference_type=movement_kwargs.get('reference_type', 'sale'),
        reference_id=movement_kwargs.get('reference_id'),
        movement_type=movement_type,
        product_id=product_id,
        variant_id=movement_kwargs.get('variant_id'),
        branch_id=branch_id,
        quantity=-abs(quantity),
        unit_cost=round(resolved_cost, 4),
        total_cost=round(total_cost, 4),
        balance_after=int(balance.quantity),
        note=movement_kwargs.get('note'),
        created_by=movement_kwargs.get('user_id'),
        created_at=now,
    )
    db.session.add(movement)
    db.session.flush()
    return movement


def damage(product_id, branch_id, quantity, **movement_kwargs):
    """Move units from sellable stock into the damaged pool.

    The ledger records the sellable change (negative); ``damaged_quantity``
    grows by the same amount, so physical stock is preserved.
    """
    quantity = int(quantity)
    if quantity <= 0:
        raise ShopStockError('Quantity must be positive', 400, 'invalid_quantity')
    balance = get_balance(product_id, branch_id,
                          variant_id=movement_kwargs.get('variant_id'),
                          create=False)
    if balance is None:
        raise ShopStockError('No stock record for that item at this branch',
                             409, 'no_stock_record')
    now = _utc_now()
    stmt = (update(ShopInventoryBalance)
            .where(ShopInventoryBalance.id == balance.id)
            .where(ShopInventoryBalance.quantity >= quantity)
            .where(ShopInventoryBalance.quantity
                   - ShopInventoryBalance.reserved_quantity >= quantity)
            .values(
                quantity=ShopInventoryBalance.quantity - quantity,
                damaged_quantity=ShopInventoryBalance.damaged_quantity + quantity,
                last_movement_at=now,
                updated_at=now,
            ))
    try:
        result = db.session.execute(stmt)
    except OperationalError:
        db.session.rollback()
        raise ShopStockError('Inventory is busy, please retry', 409,
                             'inventory_locked')
    if result.rowcount == 0:
        raise ShopStockError(
            'Insufficient sellable stock to write off (units may be held for '
            'another sale)', 409, 'insufficient_stock')
    db.session.flush()
    db.session.refresh(balance)

    resolved_cost = float(balance.average_cost or 0)
    movement = ShopStockMovement(
        reference_type=movement_kwargs.get('reference_type', 'adjustment'),
        reference_id=movement_kwargs.get('reference_id'),
        movement_type=movement_kwargs.get('movement_type', 'damage'),
        product_id=product_id,
        variant_id=movement_kwargs.get('variant_id'),
        branch_id=branch_id,
        quantity=-quantity,
        unit_cost=round(resolved_cost, 4),
        total_cost=round(resolved_cost * quantity, 4),
        balance_after=int(balance.quantity),
        note=movement_kwargs.get('note'),
        created_by=movement_kwargs.get('user_id'),
        created_at=now,
    )
    db.session.add(movement)
    db.session.flush()
    return movement


def add_defective(product_id, branch_id, quantity, **movement_kwargs):
    """Accept a returned unit that cannot be sold again.

    The unit physically comes back, so ``damaged_quantity`` grows; sellable
    stock does not move, which is why the ledger row carries a zero quantity —
    a physical change with no change to what the till can sell.
    """
    quantity = int(quantity)
    if quantity <= 0:
        raise ShopStockError('Quantity must be positive', 400, 'invalid_quantity')
    balance = get_balance(product_id, branch_id,
                          variant_id=movement_kwargs.get('variant_id'),
                          create=False)
    if balance is None:
        # Nothing on hand here yet: the unit still has to be accounted for.
        balance = get_balance(product_id, branch_id,
                              variant_id=movement_kwargs.get('variant_id'),
                              create=True)
    now = _utc_now()
    stmt = (update(ShopInventoryBalance)
            .where(ShopInventoryBalance.id == balance.id)
            .values(damaged_quantity=ShopInventoryBalance.damaged_quantity
                    + quantity,
                    last_movement_at=now, updated_at=now))
    result = db.session.execute(stmt)
    if result.rowcount == 0:
        raise ShopStockError('Could not record the returned unit', 409,
                             'stock_error')
    db.session.flush()
    db.session.refresh(balance)
    resolved_cost = float(balance.average_cost or 0)
    movement = ShopStockMovement(
        reference_type=movement_kwargs.get('reference_type', 'return'),
        reference_id=movement_kwargs.get('reference_id'),
        movement_type=movement_kwargs.get('movement_type', 'customer_return'),
        product_id=product_id,
        variant_id=movement_kwargs.get('variant_id'),
        branch_id=branch_id,
        quantity=0,
        unit_cost=round(resolved_cost, 4),
        total_cost=0,
        balance_after=int(balance.quantity),
        note=(movement_kwargs.get('note') or 'Returned to damaged stock'),
        created_by=movement_kwargs.get('user_id'),
        created_at=now,
    )
    db.session.add(movement)
    db.session.flush()
    return movement


def restore_damaged(product_id, branch_id, quantity, **movement_kwargs):
    """Bring units back from the damaged pool into sellable stock."""
    quantity = int(quantity)
    if quantity <= 0:
        raise ShopStockError('Quantity must be positive', 400, 'invalid_quantity')
    balance = get_balance(product_id, branch_id,
                          variant_id=movement_kwargs.get('variant_id'),
                          create=False)
    if balance is None:
        raise ShopStockError('No stock record for that item at this branch',
                             409, 'no_stock_record')
    now = _utc_now()
    stmt = (update(ShopInventoryBalance)
            .where(ShopInventoryBalance.id == balance.id)
            .where(ShopInventoryBalance.damaged_quantity >= quantity)
            .values(
                quantity=ShopInventoryBalance.quantity + quantity,
                damaged_quantity=ShopInventoryBalance.damaged_quantity - quantity,
                last_movement_at=now,
                updated_at=now,
            ))
    result = db.session.execute(stmt)
    if result.rowcount == 0:
        raise ShopStockError('Not enough damaged stock to restore', 409,
                             'insufficient_stock')
    db.session.flush()
    db.session.refresh(balance)

    resolved_cost = float(balance.average_cost or 0)
    movement = ShopStockMovement(
        reference_type=movement_kwargs.get('reference_type', 'adjustment'),
        reference_id=movement_kwargs.get('reference_id'),
        movement_type=movement_kwargs.get('movement_type', 'correction'),
        product_id=product_id,
        variant_id=movement_kwargs.get('variant_id'),
        branch_id=branch_id,
        quantity=quantity,
        unit_cost=round(resolved_cost, 4),
        total_cost=round(resolved_cost * quantity, 4),
        balance_after=int(balance.quantity),
        note=movement_kwargs.get('note'),
        created_by=movement_kwargs.get('user_id'),
        created_at=now,
    )
    db.session.add(movement)
    db.session.flush()
    return movement


def ensure_product(product, variant=None):
    """Validate that a product/variant pair may be traded."""
    if product is None:
        raise ShopStockError('Product not found', 404, 'product_not_found')
    if product.status == 'archived':
        raise ShopStockError('This product is archived', 409, 'product_archived')
    if variant is not None and not variant.is_active:
        raise ShopStockError('This variant is inactive', 409, 'variant_inactive')
    return product
