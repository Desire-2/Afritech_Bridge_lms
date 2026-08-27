"""Add buffer_minutes column to users table

Revision ID: d3e4f5a6b7c8
Revises: a2b3c4d5e6f7
Create Date: 2026-08-27 12:00:00.000000

Adds the instructor booking buffer period (time between sessions) to the users table.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'd3e4f5a6b7c8'
down_revision = 'a2b3c4d5e6f7'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    if 'users' not in {t for t in inspector.get_table_names()}:
        return
    existing = {c['name'] for c in inspector.get_columns('users')}
    if 'buffer_minutes' not in existing:
        with op.batch_alter_table('users', schema=None) as batch_op:
            batch_op.add_column(sa.Column('buffer_minutes', sa.Integer(), nullable=False, server_default=sa.text('0')))

    op.execute("UPDATE users SET buffer_minutes = 0 WHERE buffer_minutes IS NULL")


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('buffer_minutes')
