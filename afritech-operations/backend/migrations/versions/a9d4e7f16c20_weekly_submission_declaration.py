"""Weekly agent submission declaration (amount and funding source).

Revision ID: a9d4e7f16c20
Revises: c2f8a7d41b90
Create Date: 2026-11-24 16:00:00.000000

Additive and backward compatible: existing reports receive a zero declaration
funded by the agent's own phone. The declaration is stored separately from the
reviewer-verified money submission totals, so it cannot clear a shortage.
"""
from alembic import op
import sqlalchemy as sa


revision = 'a9d4e7f16c20'
down_revision = 'c2f8a7d41b90'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'weekly_reports',
        sa.Column('declared_submitted_amount', sa.Numeric(16, 2),
                  nullable=False, server_default='0'),
    )
    op.add_column(
        'weekly_reports',
        sa.Column('submission_funding_source', sa.String(32),
                  nullable=False, server_default='agent_phone'),
    )


def downgrade():
    op.drop_column('weekly_reports', 'submission_funding_source')
    op.drop_column('weekly_reports', 'declared_submitted_amount')
