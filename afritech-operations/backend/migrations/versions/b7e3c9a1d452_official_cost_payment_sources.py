"""Store who funded each official service cost in plain language.

Revision ID: b7e3c9a1d452
Revises: a9d4e7f16c20
Create Date: 2026-11-25 09:00:00.000000

Additive only. Existing personal claims keep their deductible status; an old
negative ``personal_payment`` answer is labelled ``not_paid`` because the
system never recorded which non-personal answer was chosen. Only existing rows
are backfilled; no seed or reference rows are created.
"""
from alembic import op
import sqlalchemy as sa


revision = 'b7e3c9a1d452'
down_revision = 'a9d4e7f16c20'
branch_labels = None
depends_on = None

_COST_PAYMENTS = sa.table(
    'weekly_official_cost_payments',
    sa.column('personal_payment', sa.Boolean()),
    sa.column('payment_source', sa.String(32)),
)


def _backfill_personal_payment_source():
    """Build a boolean-safe UPDATE for both SQLite and PostgreSQL.

    A raw ``= 1`` literal works on SQLite but PostgreSQL rejects comparing a
    BOOLEAN column with an INTEGER. SQLAlchemy emits ``IS true``/``IS 1`` per
    dialect, so the same migration travels to both databases.
    """
    return (
        _COST_PAYMENTS.update()
        .where(_COST_PAYMENTS.c.personal_payment.is_(True))
        .values(payment_source='personal')
    )


def upgrade():
    op.add_column(
        'weekly_official_cost_payments',
        sa.Column('payment_source', sa.String(32), nullable=False,
                  server_default='not_paid'),
    )
    op.execute(_backfill_personal_payment_source())
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
