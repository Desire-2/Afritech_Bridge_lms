"""``ATB……`` product SKU allocation.

Every product the Electronics Shop creates is stamped with an internal
inventory code — ``ATB000001``, ``ATB000002`` … — that is completely separate
from the barcode the till scans: the barcode is what the manufacturer printed
on the box, the SKU is AfriTech Bridge's own row identifier.

Allocation reuses the same atomic counter the document numbers use (see
:mod:`app.services.shop_series`): a single
``UPDATE shop_series SET last_number = last_number + 1`` guarded by the row's
unique key. The database serialises those updates, so two staff members
scanning two different barcodes at the same instant receive two different
numbers and never the same one twice. No timestamps, no random component, no
guessing.

The counter is stored under a fixed key (``sku-atb``) rather than the dated
keys the receipts use, because a SKU must keep climbing for the life of the
catalogue instead of resetting every midnight.

Two properties are deliberately traded away:

* **Gapless numbering.** A scan that reserves a SKU and is then abandoned
  leaves a hole. Uniqueness matters more than an unbroken run.
* **Cheap concurrency.** The counter row is held for the rest of the
  transaction, so product creation is serialised. That is the price of never
  minting the same SKU twice, and product creation is not a hot loop.
"""
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError

from ..extensions import db
from ..models import ShopProduct, ShopProductVariant, ShopSeries, ShopSkuReservation

SKU_PREFIX = 'ATB'
"""Every generated SKU starts with this. Nothing else may."""

SKU_WIDTH = 6
"""Digits after the prefix: ``ATB`` + 6 → ``ATB000001`` … ``ATB999999``."""

SERIES_KEY = 'sku-atb'
"""The counter's row key. Deliberately *not* dated — see the module docstring."""

MAX_ATTEMPTS = 8
"""Claims to burn while hopping over SKUs somebody reserved by hand."""


class ShopSkuError(Exception):
    """Raised when no SKU could be allocated."""


def format_sku(number) -> str:
    """``247`` → ``ATB000247``. The one place the format is decided."""
    return f'{SKU_PREFIX}{int(number):0{SKU_WIDTH}d}'


def is_generated_sku(value) -> bool:
    """True when ``value`` looks like an ``ATB000247``-style generated SKU."""
    if not isinstance(value, str):
        return False
    if not value.startswith(SKU_PREFIX):
        return False
    digits = value[len(SKU_PREFIX):]
    return len(digits) == SKU_WIDTH and digits.isdigit()


def sku_taken(sku: str) -> bool:
    """Does any product **or variant** already own ``sku``?

    Variants share the namespace: their unique index is global, and the
    default variant SKU is ``{parent}-{n}``, which lands in the same space.
    """
    if ShopProduct.query.filter_by(sku=sku).first() is not None:
        return True
    return ShopProductVariant.query.filter_by(sku=sku).first() is not None


def _claim() -> str:
    """Atomically take the next number and turn it into an unused SKU."""
    for _ in range(MAX_ATTEMPTS):
        result = db.session.execute(
            ShopSeries.__table__.update()
            .where(ShopSeries.key == SERIES_KEY)
            .values(last_number=ShopSeries.last_number + 1))
        if result.rowcount:
            # populate_existing is load-bearing: the UPDATE above bypassed the
            # ORM, so without it the identity map hands back the row exactly as
            # it looked before the increment and every hop re-reads the same
            # number, spinning until MAX_ATTEMPTS reports a stuck counter.
            row = db.session.execute(
                db.select(ShopSeries).where(ShopSeries.key == SERIES_KEY)
                .execution_options(populate_existing=True)
            ).scalar_one()
            sku = format_sku(row.last_number)
            # A hand-written ATB… value can sit ahead of the counter (legacy
            # imports, a SKU pasted from an old system). Hop over it rather
            # than let the insert fail on the unique index later.
            if not sku_taken(sku):
                return sku
            continue

        # First call on this database: open the counter.
        try:
            with db.session.begin_nested():
                db.session.add(ShopSeries(key=SERIES_KEY, last_number=1))
                db.session.flush()
        except IntegrityError:
            continue  # somebody else opened it between the UPDATE and here
        sku = format_sku(1)
        if not sku_taken(sku):
            return sku

    raise ShopSkuError(
        'Could not allocate a product SKU — the catalogue has exhausted the '
        f'{SKU_PREFIX}{SKU_WIDTH}-digit range or the counter is stuck.')


def generate_product_sku() -> str:
    """Mint the next unused ``ATB…`` SKU."""
    return _claim()


def reserve_sku(barcode: str | None = None, user_id=None):
    """Mint an SKU, pinned to ``barcode`` when there is one.

    Returns ``(sku, already_reserved)``. Re-scanning the same unknown barcode
    returns the SKU it was given the first time, which is what makes a retried
    lookup request safe: the retry cannot spend a second number.
    """
    if barcode:
        existing = ShopSkuReservation.query.filter_by(barcode=barcode).first()
        if existing is not None:
            return existing.sku, True

    sku = _claim()

    if barcode:
        try:
            with db.session.begin_nested():
                db.session.add(ShopSkuReservation(
                    barcode=barcode, sku=sku, created_by=user_id,
                    created_at=datetime.now(timezone.utc)))
                db.session.flush()
        except IntegrityError:
            # Lost the race for this barcode: hand back the winner's SKU.
            existing = ShopSkuReservation.query.filter_by(barcode=barcode).first()
            if existing is not None:
                return existing.sku, True
            raise
    return sku, False


def consume_reservation(sku: str, barcode: str | None = None) -> int:
    """Drop the reservation(s) a completed product creation has spent.

    Matched on both keys so a form that swapped in a different SKU still
    clears the barcode's hold. Returns the number of rows removed.
    """
    filters = [ShopSkuReservation.sku == sku]
    if barcode:
        filters.append(ShopSkuReservation.barcode == barcode)
    deleted = ShopSkuReservation.query.filter(
        db.or_(*filters)).delete(synchronize_session=False)
    return int(deleted or 0)
