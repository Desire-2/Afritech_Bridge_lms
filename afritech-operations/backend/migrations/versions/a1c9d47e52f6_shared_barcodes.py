"""shared barcodes: one code across rebranded products

A GS1 code identifies a *design* as its registering company defined it — in
the real world the same EAN-13 is printed on units that ship in several
brands' boxes (phone covers are the classic case).  The catalogue therefore
stops pretending a barcode owns exactly one row: the unique indexes on
``shop_products.barcode`` / ``shop_product_variants.barcode`` become plain
lookups, and SKU reservations become unique per ``(barcode, creator)`` so two
staff can prepare two different products from the same scanned code without
inheriting each other's SKU.

Ambiguity is handled at scan time (the API answers multi-match lookups with a
candidate list) rather than at storage time.

Revision ID: a1c9d47e52f6
Revises: 6e4b91c2f80a
Create Date: 2026-10-22

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1c9d47e52f6'
down_revision = '6e4b91c2f80a'
branch = None

BARCODE_INDEXES = (
    ('shop_products', 'ix_shop_products_barcode'),
    ('shop_product_variants', 'ix_shop_product_variants_barcode'),
    ('shop_sku_reservations', 'ix_shop_sku_reservations_barcode'),
)
RESERVATION_UNIQUENESS = 'uq_shop_sku_reservations_barcode_creator'


def _inspector():
    return sa.inspect(op.get_bind())


def _offline():
    """True while Alembic is only printing SQL (``flask db upgrade --sql``).

    Offline mode hands us a MockConnection that answers neither
    ``get_indexes`` nor ``get_unique_constraints``, so the DDL is emitted
    unconditionally — prints are what a dry run is for.
    """
    return bool(getattr(op.get_context(), 'as_sql', False))


def _index_of(table, name):
    if _offline():
        return {'name': name, 'unique': True}
    for index in _inspector().get_indexes(table):
        if index['name'] == name:
            return index
    return None


def _unique_constraint_of(table, name):
    if _offline():
        return None
    for constraint in _inspector().get_unique_constraints(table):
        if constraint['name'] == name:
            return constraint
    return None


def _relax_to_plain_index(table, name, columns):
    """Uniqueness on ``name`` becomes a plain index (creating it if absent)."""
    if _unique_constraint_of(table, name) is not None:
        op.drop_constraint(name, table, type_='unique')
    index = _index_of(table, name)
    if index is None:
        op.create_index(name, table, columns, unique=False)
    elif index.get('unique'):
        op.drop_index(name, table_name=table)
        op.create_index(name, table, columns, unique=False)


def _restore_unique_index(table, name, columns):
    index = _index_of(table, name)
    if index is not None:
        op.drop_index(name, table_name=table)
    op.create_index(name, table, columns, unique=True)


def upgrade():
    for table, name in BARCODE_INDEXES:
        _relax_to_plain_index(table, name, ['barcode'])

    existing = ({RESERVATION_UNIQUENESS} if _offline() else
                {index['name'] for index in
                 _inspector().get_indexes('shop_sku_reservations')})
    if RESERVATION_UNIQUENESS not in existing:
        op.create_index(RESERVATION_UNIQUENESS, 'shop_sku_reservations',
                        ['barcode', 'created_by'], unique=True)


def downgrade():
    op.drop_index(RESERVATION_UNIQUENESS, table_name='shop_sku_reservations')
    # Re-imposing one-row-per-barcode fails while shared codes exist —
    # re-barcode or archive the extras first.
    for table, name in BARCODE_INDEXES:
        _restore_unique_index(table, name, ['barcode'])
