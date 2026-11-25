"""Store who funded each official service cost in plain language.

Revision ID: b7e3c9a1d452
Revises: a9d4e7f16c20
Create Date: 2026-11-25 09:00:00.000000

Additive only. Existing personal claims keep their deductible status; an old
negative ``personal_payment`` answer is labelled ``not_paid`` because the
system never recorded which non-personal answer was chosen.
"""
from alembic import op
import sqlalchemy as sa


revision = 'b7e3c9a1d452'
down_revision = 'a9d4e7f16c20'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'weekly_official_cost_payments',
        sa.Column('payment_source', sa.String(32), nullable=False,
                  server_default='not_paid'),
    )
    op.execute(
        "UPDATE weekly_official_cost_payments "
        "SET payment_source = 'personal' WHERE personal_payment = 1"
    )
    # Match SQLAlchemy's model-generated name so the schema audit sees no drift.
    op.create_index(
        'ix_weekly_official_cost_payments_payment_source',
        'weekly_official_cost_payments',
        ['payment_source'],
        unique=False,
    )


def downgrade():
    op.drop_index('ix_weekly_official_cost_payments_payment_source',
                  table_name='weekly_official_cost_payments')
    op.drop_column('weekly_official_cost_payments', 'payment_source')
