"""Sunday–Saturday week and verified personal official-cost payments.

Revision ID: c2f8a7d41b90
Revises: f7c9a4d2e8b1
Create Date: 2026-11-24 12:00:00.000000

The reporting window is fixed to Sunday 00:00 through Saturday 23:59:59.999
in Africa/Kigali. Draft/non-submitted reports created under the old Saturday
start are moved to the correct Sunday and queued for recalculation. Approved
and already submitted reports keep their frozen periods and snapshots.
"""
import json
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from alembic import op
import sqlalchemy as sa


revision = 'c2f8a7d41b90'
down_revision = 'f7c9a4d2e8b1'
branch_labels = None
depends_on = None

_EDITABLE_STATUSES = ('draft', 'ready_for_submission', 'late', 'returned_for_correction')

_settings = sa.table(
    'settings',
    sa.column('id', sa.Integer),
    sa.column('key', sa.String(128)),
    sa.column('value', sa.Text),
    sa.column('value_type', sa.String(16)),
    sa.column('group', sa.String(64)),
    sa.column('created_at', sa.DateTime),
    sa.column('updated_at', sa.DateTime),
)
_reports = sa.table(
    'weekly_reports',
    sa.column('id', sa.Integer),
    sa.column('employee_id', sa.Integer),
    sa.column('week_start', sa.Date),
    sa.column('week_end', sa.Date),
    sa.column('due_at', sa.DateTime),
    sa.column('timezone_name', sa.String(64)),
    sa.column('period_label', sa.String(128)),
    sa.column('status', sa.String(32)),
    sa.column('calculation', sa.Text),
    sa.column('snapshot', sa.Text),
)
_audit = sa.table(
    'audit_logs',
    sa.column('id', sa.Integer),
    sa.column('user_id', sa.Integer),
    sa.column('action', sa.String(64)),
    sa.column('entity', sa.String(64)),
    sa.column('entity_id', sa.String(64)),
    sa.column('previous_value', sa.Text),
    sa.column('new_value', sa.Text),
    sa.column('reason', sa.Text),
    sa.column('created_at', sa.DateTime),
)


def _set_settings(bind, values):
    now = datetime.utcnow()
    keys = [f'weekly_reporting.{key}' for key in values]
    existing = {
        row.key: row.id for row in bind.execute(
            sa.select(_settings.c.key, _settings.c.id).where(_settings.c.key.in_(keys)))
    }
    for key, value in values.items():
        table_key = f'weekly_reporting.{key}'
        if table_key in existing:
            bind.execute(
                _settings.update().where(_settings.c.id == existing[table_key])
                .values(value=str(value), updated_at=now))
        else:
            bind.execute(_settings.insert().values(
                key=table_key, value=str(value), value_type='string',
                group='weekly_reporting', created_at=now, updated_at=now))


def _corrected_sunday(value):
    """Map a legacy Saturday start to the Sunday that keeps the same work week.

    Saturday–Friday runs become Sunday–Saturday runs beginning the next day;
    any other legacy start falls back to its containing Sunday.
    """
    if value.weekday() == 5:
        return value + timedelta(days=1)
    return value - timedelta(days=(value.weekday() - 6) % 7)


def _due_at(sunday, tz_name):
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo('Africa/Kigali')
    # Deadline is the Sunday immediately after the Saturday 23:59:59.999 close.
    return datetime.combine(sunday + timedelta(days=7), time(hour=17), tzinfo=tz).astimezone(
        timezone.utc).replace(tzinfo=None)


def _naive_utc(value):
    """Normalize a possibly timezone-aware DB datetime to naive UTC."""
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _repair_draft_weeks(bind):
    """Correct only non-submitted periods; never touch locked/approved rows.

    A draft may already carry the correct Sunday–Saturday dates but still hold
    a deadline inherited from the old Saturday–Friday policy, so the due date
    is checked independently. Only a period change clears a cached calculation.
    """
    rows = bind.execute(
        sa.select(_reports).where(_reports.c.status.in_(_EDITABLE_STATUSES))
    ).mappings().all()
    now = datetime.utcnow()
    for row in rows:
        old_start = row['week_start']
        period_ok = (old_start.weekday() == 6 and
                     row['week_end'] == old_start + timedelta(days=6))
        sunday = old_start if period_ok else _corrected_sunday(old_start)
        saturday = sunday + timedelta(days=6)
        correct_due = _due_at(sunday, row['timezone_name'])
        old_due = _naive_utc(row['due_at'])
        due_ok = old_due == correct_due
        if period_ok and due_ok:
            continue

        previous = {}
        new_value = {}
        values = {
            'due_at': correct_due,
            'period_label': f'{sunday.isoformat()} – {saturday.isoformat()}',
        }
        if not period_ok:
            previous.update({
                'week_start': old_start.isoformat(),
                'week_end': row['week_end'].isoformat() if row['week_end'] else None,
            })
            new_value.update({
                'week_start': sunday.isoformat(),
                'week_end': saturday.isoformat(),
            })
            values.update(week_start=sunday, week_end=saturday,
                          calculation=None, snapshot=None)
        if not due_ok:
            previous['due_at'] = old_due.isoformat(sep=' ') if old_due else None
            new_value['due_at'] = correct_due.isoformat(sep=' ')
        bind.execute(_reports.update().where(_reports.c.id == row['id']).values(**values))
        bind.execute(_audit.insert().values(
            user_id=None,
            action=('weekly_report_period_corrected' if not period_ok
                    else 'weekly_report_deadline_corrected'),
            entity='weekly_report',
            entity_id=str(row['id']),
            previous_value=json.dumps(previous),
            new_value=json.dumps(new_value),
            reason='Corrected to the Sunday–Saturday Africa/Kigali reporting window; recalculation required.',
            created_at=now,
        ))


def upgrade():
    op.create_table(
        'weekly_official_cost_payments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('report_id', sa.Integer(), nullable=False),
        sa.Column('transaction_id', sa.Integer(), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('reference_key', sa.String(length=180), nullable=False),
        sa.Column('official_cost', sa.Numeric(16, 2), nullable=False),
        sa.Column('customer_payment_status', sa.String(length=32), nullable=False),
        sa.Column('personal_payment', sa.Boolean(), nullable=False),
        sa.Column('amount', sa.Numeric(16, 2), nullable=False),
        sa.Column('is_partial', sa.Boolean(), nullable=False),
        sa.Column('provider', sa.String(length=32), nullable=False),
        sa.Column('reference', sa.String(length=128), nullable=False),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('sender_phone', sa.String(length=32), nullable=True),
        sa.Column('evidence_path', sa.String(length=500), nullable=True),
        sa.Column('evidence_name', sa.String(length=255), nullable=True),
        sa.Column('content_type', sa.String(length=128), nullable=True),
        sa.Column('size_bytes', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('verification_status', sa.String(length=32), nullable=False),
        sa.Column('verified_by', sa.Integer(), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('verification_note', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['report_id'], ['weekly_reports.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['transaction_id'], ['service_transactions.id']),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id']),
        sa.ForeignKeyConstraint(['verified_by'], ['users.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.UniqueConstraint('reference_key', name='uq_weekly_cost_payment_reference'),
        sa.UniqueConstraint('report_id', 'transaction_id', name='uq_weekly_cost_payment_transaction'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_weekly_official_cost_payments_report_id',
                    'weekly_official_cost_payments', ['report_id'])
    op.create_index('ix_weekly_official_cost_payments_transaction_id',
                    'weekly_official_cost_payments', ['transaction_id'])
    op.create_index('ix_weekly_official_cost_payments_employee_id',
                    'weekly_official_cost_payments', ['employee_id'])
    op.create_index('ix_weekly_official_cost_payments_reference',
                    'weekly_official_cost_payments', ['reference'])
    op.create_index('ix_weekly_official_cost_payments_verification_status',
                    'weekly_official_cost_payments', ['verification_status'])
    op.create_index('ix_weekly_cost_payment_report_status', 'weekly_official_cost_payments',
                    ['report_id', 'verification_status'])
    op.create_index('ix_weekly_cost_payment_employee', 'weekly_official_cost_payments',
                    ['employee_id', 'paid_at'])

    bind = op.get_bind()
    _set_settings(bind, {
        'week_start_weekday': 6,
        'week_end_weekday': 5,
        'submission_weekday': 6,
    })
    _repair_draft_weeks(bind)


def downgrade():
    op.drop_index('ix_weekly_cost_payment_employee', table_name='weekly_official_cost_payments')
    op.drop_index('ix_weekly_cost_payment_report_status', table_name='weekly_official_cost_payments')
    op.drop_index('ix_weekly_official_cost_payments_verification_status',
                  table_name='weekly_official_cost_payments')
    op.drop_index('ix_weekly_official_cost_payments_reference', table_name='weekly_official_cost_payments')
    op.drop_index('ix_weekly_official_cost_payments_employee_id', table_name='weekly_official_cost_payments')
    op.drop_index('ix_weekly_official_cost_payments_transaction_id', table_name='weekly_official_cost_payments')
    op.drop_index('ix_weekly_official_cost_payments_report_id', table_name='weekly_official_cost_payments')
    op.drop_table('weekly_official_cost_payments')
    # Period corrections are intentionally not reversed: the legal week did
    # not move back, and reversing dates could corrupt an approved snapshot.
