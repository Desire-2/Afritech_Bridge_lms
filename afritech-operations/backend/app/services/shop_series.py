"""Shop document numbering (POS-20261003-0007 style).

Sequences are stored in ``shop_series`` and advanced with an atomic
``UPDATE … SET last_number = last_number + 1`` so two tills numbering the same
day never receive the same number. The pattern works identically on SQLite and
PostgreSQL (no ``SELECT … FOR UPDATE`` needed) and is safe to retry after a
rolled-back request: the number is simply skipped, never duplicated.
"""
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError

from ..extensions import db
from ..models import ShopSeries


class ShopNumberingError(Exception):
    """Raised when a document number cannot be allocated."""


PREFIXES = {
    'sale': 'SAL',
    'held_sale': 'HLD',
    'return': 'RTN',
    'purchase_order': 'PO',
    'goods_receipt': 'GRN',
    'transfer': 'TRF',
    'count': 'CNT',
    'adjustment': 'ADJ',
    'warranty': 'WAR',
    'warranty_case': 'WRC',
    'customer': 'CUS',
    'supplier_return': 'SRN',
    'closing': 'CLS',
    'shift': 'SHF',
    'po_return': 'PRN',
}


def next_number(kind, when=None):
    """Allocate the next number for ``kind`` (see :data:`PREFIXES`).

    Returns e.g. ``SAL-20261003-0007``. The counter resets every calendar day
    so numbers stay short and readable on a receipt.
    """
    if when is None:
        when = datetime.now(timezone.utc)
    prefix = PREFIXES.get(kind, str(kind)[:3].upper())
    day = when.strftime('%Y%m%d')
    key = f'{prefix}-{day}'

    for _ in range(3):
        result = db.session.execute(
            ShopSeries.__table__.update()
            .where(ShopSeries.key == key)
            .values(last_number=ShopSeries.last_number + 1))
        if result.rowcount:
            row = db.session.execute(
                db.select(ShopSeries).where(ShopSeries.key == key)).scalar_one()
            return f'{key}-{int(row.last_number):04d}'
        # First use of today's key: create it inside a SAVEPOINT so a losing
        # race only undoes this insert, never the caller's pending work.
        try:
            with db.session.begin_nested():
                db.session.add(ShopSeries(key=key, last_number=1))
                db.session.flush()
        except IntegrityError:
            continue
        return f'{key}-0001'
    raise ShopNumberingError(f'Could not allocate a {kind} number')


def preview(kind, when=None):
    """The number the next document of ``kind`` would receive."""
    if when is None:
        when = datetime.now(timezone.utc)
    prefix = PREFIXES.get(kind, str(kind)[:3].upper())
    key = f'{prefix}-{when.strftime("%Y%m%d")}'
    row = ShopSeries.query.filter_by(key=key).first()
    return f'{key}-{int((row.last_number if row else 0) + 1):04d}'
