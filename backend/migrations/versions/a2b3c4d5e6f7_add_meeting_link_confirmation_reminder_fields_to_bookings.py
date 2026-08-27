"""Add meeting link, confirmation, decline, and reminder fields to bookings

Revision ID: a2b3c4d5e6f7
Revises: b1c2d3e4f5a6
Create Date: 2026-08-27 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'a2b3c4d5e6f7'
down_revision = 'b1c2d3e4f5a6'
branch_labels = None
depends_on = None


def _missing_columns(conn, table, columns):
    """Return the subset of columns that do not yet exist on the given table."""
    existing = {c['name'] for c in inspect(conn).get_columns(table)}
    return [c for c in columns if c.name not in existing]


def upgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    if 'bookings' not in {t for t in inspector.get_table_names()}:
        return

    add = _missing_columns(conn, 'bookings', [
        sa.Column('confirmed_at', sa.DateTime(), nullable=True),
        sa.Column('confirmed_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('declined_at', sa.DateTime(), nullable=True),
        sa.Column('declined_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('meeting_url', sa.String(length=500), nullable=True),
        sa.Column('meeting_provider', sa.String(length=50), nullable=True),
        sa.Column('reminder_24h_sent', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('reminder_1h_sent', sa.Boolean(), nullable=False, server_default='0'),
    ])
    if add:
        with op.batch_alter_table('bookings', schema=None) as batch_op:
            for col in add:
                batch_op.add_column(col)


def downgrade():
    with op.batch_alter_table('bookings', schema=None) as batch_op:
        batch_op.drop_column('reminder_1h_sent')
        batch_op.drop_column('reminder_24h_sent')
        batch_op.drop_column('meeting_provider')
        batch_op.drop_column('meeting_url')
        batch_op.drop_column('declined_by')
        batch_op.drop_column('declined_at')
        batch_op.drop_column('confirmed_by')
        batch_op.drop_column('confirmed_at')
