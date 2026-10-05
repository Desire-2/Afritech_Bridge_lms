"""barcode support: symbology columns, sale snapshots, unknown-scan queue

Revision ID: 413cd5253040
Revises: c7f3a9d21b45
Create Date: 2026-10-04

"""
from alembic import op
import sqlalchemy as sa

revision = '413cd5253040'
down_revision = 'c7f3a9d21b45'
branch = None


def _inspector():
    return sa.inspect(op.get_bind())


def _has_column(inspector, table, column):
    return any(col['name'] == column
               for col in inspector.get_columns(table))


def _ensure_index(inspector, table, name, columns, unique=False):
    existing = {index['name'] for index in inspector.get_indexes(table)}
    if name not in existing:
        op.create_index(name, table, columns, unique=unique)


def _ensure_unique_constraint(inspector, table, name, columns):
    existing = {constraint['name']
                for constraint in inspector.get_unique_constraints(table)}
    if name not in existing:
        op.create_unique_constraint(name, table, columns)


def upgrade():
    inspector = _inspector()

    for table in ('shop_products', 'shop_product_variants'):
        if not _has_column(inspector, table, 'barcode_format'):
            op.add_column(table, sa.Column('barcode_format', sa.String(32),
                                           nullable=True))
        if not _has_column(inspector, table, 'barcode_type'):
            op.add_column(table, sa.Column('barcode_type', sa.String(16),
                                           server_default='external',
                                           nullable=False))

    for column, length in (('barcode_at_sale', 64), ('sku_at_sale', 64),
                           ('product_name_at_sale', 200)):
        if not _has_column(inspector, 'shop_sale_items', column):
            op.add_column('shop_sale_items',
                          sa.Column(column, sa.String(length), nullable=True))

    if not inspector.has_table('shop_unknown_barcodes'):
        op.create_table(
            'shop_unknown_barcodes',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('barcode', sa.String(64), nullable=False),
            sa.Column('barcode_format', sa.String(32), nullable=True),
            sa.Column('context', sa.String(24), nullable=False),
            sa.Column('branch_id', sa.Integer(),
                      sa.ForeignKey('branches.id'), nullable=False),
            sa.Column('first_seen_by', sa.Integer(),
                      sa.ForeignKey('users.id'), nullable=True),
            sa.Column('times_scanned', sa.Integer(), nullable=False,
                      server_default='1'),
            sa.Column('first_seen_at', sa.DateTime(timezone=True),
                      nullable=False),
            sa.Column('last_seen_at', sa.DateTime(timezone=True),
                      nullable=False),
            sa.Column('status', sa.String(16), nullable=False,
                      server_default='open'),
            sa.Column('resolved_product_id', sa.Integer(),
                      sa.ForeignKey('shop_products.id'), nullable=True),
            sa.Column('notified', sa.Boolean(), nullable=False,
                      server_default=sa.false()),
            sa.Column('created_at', sa.DateTime(timezone=True),
                      nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True),
                      nullable=False),
            sa.UniqueConstraint('barcode', 'context', 'branch_id',
                                name='uq_shop_unknown_barcode_ctx'),
            sa.Index('ix_shop_unknown_barcode_status_last', 'status',
                     'last_seen_at'),
        )
        op.create_index('ix_shop_unknown_barcodes_barcode',
                        'shop_unknown_barcodes', ['barcode'])
        op.create_index('ix_shop_unknown_barcodes_branch_id',
                        'shop_unknown_barcodes', ['branch_id'])
        op.create_index('ix_shop_unknown_barcodes_status',
                        'shop_unknown_barcodes', ['status'])

    # The catalogue tables were created by ``create_all`` in c7f3a9d21b45,
    # so these already exist there — guard anyway for databases that predate
    # the barcode columns.
    _ensure_index(inspector, 'shop_products', 'ix_shop_products_barcode',
                  ['barcode'], unique=True)
    _ensure_index(inspector, 'shop_product_variants',
                  'ix_shop_product_variants_barcode', ['barcode'],
                  unique=True)
    _ensure_index(inspector, 'shop_products', 'ix_shop_products_sku',
                  ['sku'], unique=True)
    _ensure_index(inspector, 'shop_product_variants',
                  'ix_shop_product_variants_sku', ['sku'], unique=True)
    _ensure_index(inspector, 'shop_serialized_items',
                  'ix_shop_serialized_items_serial_number',
                  ['serial_number'])
    _ensure_unique_constraint(inspector, 'shop_inventory_balances',
                              'uq_shop_balance_product_variant_branch',
                              ['product_id', 'variant_id', 'branch_id'])

    _backfill_barcodes()


def _backfill_barcodes():
    """Label every pre-existing barcode with its symbology and origin."""
    from app.services.barcode import GTIN_FORMATS, detect_format

    bind = op.get_bind()
    for name in ('shop_products', 'shop_product_variants'):
        table = sa.table(
            name, sa.column('id'), sa.column('barcode'),
            sa.column('barcode_format'), sa.column('barcode_type'))
        rows = bind.execute(
            sa.select(table.c.id, table.c.barcode)
            .where(table.c.barcode.isnot(None))
            .where(table.c.barcode_format.is_(None))).fetchall()
        for row_id, barcode in rows:
            fmt = detect_format(barcode)
            bind.execute(
                sa.update(table).where(table.c.id == row_id)
                .values(barcode_format=fmt,
                        barcode_type='external' if fmt in GTIN_FORMATS
                        else 'internal'))


def downgrade():
    inspector = _inspector()

    if inspector.has_table('shop_unknown_barcodes'):
        op.drop_table('shop_unknown_barcodes')

    for table, columns in (
            ('shop_products', ('barcode_format', 'barcode_type')),
            ('shop_product_variants', ('barcode_format', 'barcode_type')),
            ('shop_sale_items', ('barcode_at_sale', 'sku_at_sale',
                                 'product_name_at_sale'))):
        for column in columns:
            if _has_column(inspector, table, column):
                op.drop_column(table, column)

    # The catalogue barcode/sku indexes and the balance constraint pre-date
    # this revision (c7f3a9d21b45 created them), so they are left in place.
