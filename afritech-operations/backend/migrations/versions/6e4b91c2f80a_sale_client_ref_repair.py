"""shop sales: add the idempotency column production never received

Revision ID: 6e4b91c2f80a
Revises: 3f9c2d7a81b4
Create Date: 2026-10-21

``ShopSale.client_ref`` — the browser's idempotency key, unique per branch so
a retried POS request replays the sale it already booked instead of ringing a
second one — shipped in the model with the shop module, and ``c7f3a9d21b45``
created the column on every database it built.

A database that already existed when that revision landed (the one behind the
hosted service was created earlier by ``db.create_all()``) never rebuilt its
tables, so it still runs without the column. SQLAlchemy selects every mapped
column and Postgres answers ``UndefinedColumn``, which takes out every shop
query that reads a sale — ``/api/shop/dashboard`` included — for every user.

The revision repairs that drift the way ``413cd5253040`` repairs its own:
existence checks first, so a database that already matches the model (a
development one, rebuilt by ``flask seed-dev``) sails through unchanged.

The uniqueness is written as the UniqueConstraint the model declares — not as
an index doing the same job, which the migration audit reads as drift. SQLite
cannot ``ALTER`` a constraint into an existing table, so there the table is
rebuilt the way Alembic's batch mode does it; Postgres takes the plain
``ALTER TABLE ... ADD CONSTRAINT``.
"""
from alembic import op
import sqlalchemy as sa

revision = '6e4b91c2f80a'
down_revision = '3f9c2d7a81b4'
branch = None

UQ_NAME = 'uq_shop_sales_branch_client_ref'
UQ_COLUMNS = ('branch_id', 'client_ref')


def _inspector():
    return sa.inspect(op.get_bind())


def _has_column(inspector, table, column):
    return any(col['name'] == column
               for col in inspector.get_columns(table))


def _has_unique(inspector, table, name):
    """Named uniqueness, whether a build shipped it as constraint or index."""
    if name in {index['name'] for index in inspector.get_indexes(table)}:
        return True
    return name in {constraint['name'] for constraint
                    in inspector.get_unique_constraints(table)}


def _offline():
    """True while Alembic is only printing SQL (``flask db upgrade --sql``).

    Offline mode hands us a MockConnection, which answers neither
    ``sa.inspect`` nor ``get_columns`` — so the existence tests are skipped
    and the DDL is emitted unconditionally, the way ``3f9c2d7a81b4`` does it.
    """
    return bool(getattr(op.get_context(), 'as_sql', False))


def _create_unique():
    """Uniqueness the way the model declares it, on either dialect."""
    if op.get_bind().dialect.name == 'sqlite':
        # Offline SQLite cannot rebuild a table either, so a dry run prints
        # the equivalent unique index — the enforcement is identical.
        if _offline():
            op.create_index(UQ_NAME, 'shop_sales', UQ_COLUMNS, unique=True)
        else:
            with op.batch_alter_table('shop_sales') as batch_op:
                batch_op.create_unique_constraint(UQ_NAME, list(UQ_COLUMNS))
    else:
        op.create_unique_constraint(UQ_NAME, 'shop_sales', UQ_COLUMNS)


def upgrade():
    if _offline():
        op.add_column('shop_sales',
                      sa.Column('client_ref', sa.String(64), nullable=True))
        _create_unique()
        return

    inspector = _inspector()
    if not _has_column(inspector, 'shop_sales', 'client_ref'):
        op.add_column('shop_sales',
                      sa.Column('client_ref', sa.String(64), nullable=True))
    if not _has_unique(inspector, 'shop_sales', UQ_NAME):
        # NULL idempotency keys stay free to repeat: most sales never carry
        # one, and Postgres only collides non-NULL keys inside the constraint.
        _create_unique()


def _drop_unique():
    if op.get_bind().dialect.name == 'sqlite':
        with op.batch_alter_table('shop_sales') as batch_op:
            batch_op.drop_constraint(UQ_NAME, type_='unique')
    else:
        op.drop_constraint(UQ_NAME, 'shop_sales', type_='unique')


def downgrade():
    if _offline():
        op.drop_index(UQ_NAME, table_name='shop_sales')
        op.drop_column('shop_sales', 'client_ref')
        return

    inspector = _inspector()
    indexes = {index['name'] for index in inspector.get_indexes('shop_sales')}
    constraints = {constraint['name'] for constraint
                   in inspector.get_unique_constraints('shop_sales')}
    has_column = _has_column(inspector, 'shop_sales', 'client_ref')

    if UQ_NAME in indexes:
        # An index form left by an earlier run of this revision: it drops
        # cleanly on every dialect, no rebuild needed.
        op.drop_index(UQ_NAME, table_name='shop_sales', if_exists=True)
        if has_column:
            op.drop_column('shop_sales', 'client_ref')
        return

    if op.get_bind().dialect.name == 'sqlite':
        # SQLite refuses ``DROP COLUMN`` for a column a UNIQUE constraint
        # names, so the constraint and the column go in one rebuild.
        with op.batch_alter_table('shop_sales') as batch_op:
            if UQ_NAME in constraints:
                batch_op.drop_constraint(UQ_NAME, type_='unique')
            if has_column:
                batch_op.drop_column('client_ref')
        return

    if UQ_NAME in constraints:
        op.drop_constraint(UQ_NAME, 'shop_sales', type_='unique')
    if has_column:
        op.drop_column('shop_sales', 'client_ref')
