"""Persist guided own-funds cost answers.

Revision ID: c4d7e1a9b263
Revises: b7e3c9a1d452
Create Date: 2026-11-25 12:30:00.000000

Additive only. Historical claims keep ``auto_personal=False`` so frozen
snapshots and already-approved reports do not change meaning retroactively.
"""
from alembic import op
import sqlalchemy as sa


revision = 'c4d7e1a9b263'
down_revision = 'b7e3c9a1d452'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'weekly_official_cost_payments',
        sa.Column('auto_personal', sa.Boolean(), nullable=False,
                  server_default=sa.false()),
    )


def downgrade():
    op.drop_column('weekly_official_cost_payments', 'auto_personal')
