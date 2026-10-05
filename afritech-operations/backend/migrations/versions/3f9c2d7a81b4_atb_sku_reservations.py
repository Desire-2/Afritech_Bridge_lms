"""atb sku reservations: pin a generated SKU to the barcode it was minted for

Revision ID: 3f9c2d7a81b4
Revises: effee61c40c4
Create Date: 2026-10-05

The Electronics Shop now mints every product SKU on the backend (``ATB000001``)
the moment an unknown barcode is scanned, so the operator sees the code before
filling in the rest of the form. That reservation has to survive a browser
retry, otherwise a timed-out scan would burn a second SKU — so it gets its own
table, keyed (uniquely) on the barcode and on the SKU.

The table is built straight from the model metadata exactly the way
``c7f3a9d21b45`` built the rest of the shop, so the schema and
``ShopSkuReservation`` cannot drift apart.
"""
from alembic import op
import sqlalchemy as sa

revision = '3f9c2d7a81b4'
down_revision = 'effee61c40c4'
branch = None


def _reservation_table():
    from app.extensions import db
    from app import models  # noqa: F401  (registers every table on db.metadata)
    return db.metadata.tables['shop_sku_reservations']


def _offline():
    """True while Alembic is only printing SQL (``flask db upgrade --sql``).

    Offline mode hands us a ``MockConnection``, which answers neither
    ``sa.inspect`` nor ``checkfirst`` — so the existence test has to be
    skipped and the DDL emitted unconditionally, or ``migrate.py --dry-run``
    dies before it can print anything.
    """
    return bool(getattr(op.get_context(), 'as_sql', False))


def upgrade():
    bind = op.get_bind()
    if not _offline() and 'shop_sku_reservations' in sa.inspect(bind).get_table_names():
        return
    table = _reservation_table()
    table.metadata.create_all(bind, tables=[table], checkfirst=not _offline())


def downgrade():
    bind = op.get_bind()
    if not _offline() and 'shop_sku_reservations' not in sa.inspect(bind).get_table_names():
        return
    op.drop_table('shop_sku_reservations')
