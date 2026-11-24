"""weekly financial reports and money submissions

Revision ID: f7c9a4d2e8b1
Revises: a1c9d47e52f6
Create Date: 2026-11-24 00:00:00.000000

"""
from datetime import datetime

from alembic import op
import sqlalchemy as sa


revision = 'f7c9a4d2e8b1'
down_revision = 'a1c9d47e52f6'
branch_labels = None
depends_on = None


# The weekly permission family must reach databases that already ran the older
# role-seeding migration. Never granted to company_secretary.
WEEKLY_PERMISSIONS = (
    ('weekly_reports.view', 'View Weekly Financial Report',
     'View own or assigned weekly financial reports'),
    ('weekly_reports.submit', 'Submit Weekly Financial Report',
     'Submit a Service Agent weekly financial report and MoMo evidence'),
    ('weekly_reports.review', 'Review Weekly Financial Report',
     'Verify transfers and review weekly financial reports'),
    ('weekly_reports.adjust', 'Adjust Weekly Financial Report',
     'Record audited financial adjustments and overrides'),
    ('weekly_reports.export', 'Export Weekly Financial Report',
     'Download the verified weekly PDF/Excel statement'),
    ('weekly_reports.manage', 'Manage Weekly Financial Reports',
     'Generate reports and configure the weekly reporting policy'),
)

ROLE_GRANTS = {
    'super_admin': [code for code, _, _ in WEEKLY_PERMISSIONS],
    'manager': [
        'weekly_reports.view', 'weekly_reports.review', 'weekly_reports.adjust',
        'weekly_reports.export', 'weekly_reports.manage',
    ],
    'service_agent': ['weekly_reports.view', 'weekly_reports.submit', 'weekly_reports.export'],
    'accountant': [
        'weekly_reports.view', 'weekly_reports.review', 'weekly_reports.adjust',
        'weekly_reports.export',
    ],
}

_permissions = sa.table(
    'permissions',
    sa.column('id', sa.Integer),
    sa.column('code', sa.String),
    sa.column('name', sa.String),
    sa.column('description', sa.String),
    sa.column('created_at', sa.DateTime),
    sa.column('updated_at', sa.DateTime),
)
_roles = sa.table('roles', sa.column('id', sa.Integer), sa.column('code', sa.String))
_role_permissions = sa.table(
    'role_permissions',
    sa.column('role_id', sa.Integer),
    sa.column('permission_id', sa.Integer),
)


def _seed_weekly_permissions(bind):
    """Insert-only permission catalogue/role links; safe on every environment."""
    now = datetime.utcnow()
    existing = {row[0] for row in bind.execute(sa.select(_permissions.c.code))}
    missing = [
        dict(code=code, name=name, description=description, created_at=now, updated_at=now)
        for code, name, description in WEEKLY_PERMISSIONS if code not in existing
    ]
    if missing:
        bind.execute(_permissions.insert(), missing)

    permission_ids = {
        code: pk for code, pk in bind.execute(
            sa.select(_permissions.c.code, _permissions.c.id))
    }
    role_ids = {
        code: pk for code, pk in bind.execute(sa.select(_roles.c.code, _roles.c.id))
    }
    existing_links = {
        tuple(row) for row in bind.execute(
            sa.select(_role_permissions.c.role_id, _role_permissions.c.permission_id))
    }
    links = [
        dict(role_id=role_ids[role], permission_id=permission_ids[code])
        for role, codes in ROLE_GRANTS.items() if role in role_ids
        for code in codes if code in permission_ids
        and (role_ids[role], permission_ids[code]) not in existing_links
    ]
    if links:
        bind.execute(_role_permissions.insert(), links)


def _remove_weekly_permissions(bind):
    codes = [code for code, _, _ in WEEKLY_PERMISSIONS]
    permission_ids = [
        row[0] for row in bind.execute(
            sa.select(_permissions.c.id).where(_permissions.c.code.in_(codes)))
    ]
    if not permission_ids:
        return
    bind.execute(
        _role_permissions.delete().where(
            _role_permissions.c.permission_id.in_(permission_ids)))
    bind.execute(_permissions.delete().where(_permissions.c.id.in_(permission_ids)))


def upgrade():
    op.create_table(
        'weekly_reports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('report_number', sa.String(length=64), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('branch_id', sa.Integer(), nullable=True),
        sa.Column('week_start', sa.Date(), nullable=False),
        sa.Column('week_end', sa.Date(), nullable=False),
        sa.Column('due_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('timezone_name', sa.String(length=64), nullable=False),
        sa.Column('period_label', sa.String(length=128), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('is_late', sa.Boolean(), nullable=False),
        sa.Column('current_version', sa.Integer(), nullable=False),
        sa.Column('generated_by', sa.Integer(), nullable=True),
        sa.Column('submitted_by', sa.Integer(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reviewer_id', sa.Integer(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approved_by', sa.Integer(), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rejected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('opening_outstanding', sa.Numeric(16, 2), nullable=False),
        sa.Column('eligible_collections', sa.Numeric(16, 2), nullable=False),
        sa.Column('service_costs', sa.Numeric(16, 2), nullable=False),
        sa.Column('authorized_receipts', sa.Numeric(16, 2), nullable=False),
        sa.Column('verified_provider_payments', sa.Numeric(16, 2), nullable=False),
        sa.Column('approved_collection_expenses', sa.Numeric(16, 2), nullable=False),
        sa.Column('authorized_refunds', sa.Numeric(16, 2), nullable=False),
        sa.Column('other_outflows', sa.Numeric(16, 2), nullable=False),
        sa.Column('commission_retained', sa.Numeric(16, 2), nullable=False),
        sa.Column('expected_remittance', sa.Numeric(16, 2), nullable=False),
        sa.Column('agent_reported_submitted', sa.Numeric(16, 2), nullable=False),
        sa.Column('verified_submitted', sa.Numeric(16, 2), nullable=False),
        sa.Column('shortage_amount', sa.Numeric(16, 2), nullable=False),
        sa.Column('surplus_amount', sa.Numeric(16, 2), nullable=False),
        sa.Column('commission_earned', sa.Numeric(16, 2), nullable=False),
        sa.Column('closing_outstanding', sa.Numeric(16, 2), nullable=False),
        sa.Column('shortage_reason_category', sa.String(length=64), nullable=True),
        sa.Column('shortage_explanation', sa.Text(), nullable=True),
        sa.Column('shortage_evidence_path', sa.String(length=500), nullable=True),
        sa.Column('shortage_evidence_name', sa.String(length=255), nullable=True),
        sa.Column('expected_resolution_date', sa.Date(), nullable=True),
        sa.Column('override_reason', sa.Text(), nullable=True),
        sa.Column('override_authorized_by', sa.Integer(), nullable=True),
        sa.Column('override_authorized_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('correction_note', sa.Text(), nullable=True),
        sa.Column('reviewer_note', sa.Text(), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('missing_closing_override_reason', sa.Text(), nullable=True),
        sa.Column('missing_closing_override_by', sa.Integer(), nullable=True),
        sa.Column('missing_closing_override_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('snapshot', sa.Text(), nullable=True),
        sa.Column('calculation', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id']),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id']),
        sa.ForeignKeyConstraint(['generated_by'], ['users.id']),
        sa.ForeignKeyConstraint(['submitted_by'], ['users.id']),
        sa.ForeignKeyConstraint(['reviewer_id'], ['users.id']),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id']),
        sa.ForeignKeyConstraint(['override_authorized_by'], ['users.id']),
        sa.ForeignKeyConstraint(['missing_closing_override_by'], ['users.id']),
        sa.UniqueConstraint('employee_id', 'week_start', name='uq_weekly_report_agent_period'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_weekly_reports_report_number', 'weekly_reports', ['report_number'], unique=True)
    op.create_index('ix_weekly_reports_employee_id', 'weekly_reports', ['employee_id'])
    op.create_index('ix_weekly_reports_status', 'weekly_reports', ['status'])
    op.create_index('ix_weekly_report_status_week', 'weekly_reports', ['status', 'week_start'])
    op.create_index('ix_weekly_report_branch_week', 'weekly_reports', ['branch_id', 'week_start'])

    op.create_table(
        'weekly_momo_submissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('report_id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(length=32), nullable=False),
        sa.Column('reference', sa.String(length=128), nullable=False),
        sa.Column('amount', sa.Numeric(16, 2), nullable=False),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('sender_phone', sa.String(length=32), nullable=True),
        sa.Column('recipient_phone', sa.String(length=32), nullable=True),
        sa.Column('confirmation_code', sa.String(length=128), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('evidence_path', sa.String(length=500), nullable=True),
        sa.Column('evidence_name', sa.String(length=255), nullable=True),
        sa.Column('content_type', sa.String(length=128), nullable=True),
        sa.Column('size_bytes', sa.Integer(), nullable=True),
        sa.Column('verification_status', sa.String(length=32), nullable=False),
        sa.Column('verified_by', sa.Integer(), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('verification_note', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['report_id'], ['weekly_reports.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['verified_by'], ['users.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.UniqueConstraint('reference'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_weekly_momo_submissions_report_id', 'weekly_momo_submissions', ['report_id'])
    op.create_index('ix_weekly_momo_submissions_reference', 'weekly_momo_submissions', ['reference'], unique=True)
    op.create_index('ix_weekly_momo_submissions_verification_status', 'weekly_momo_submissions', ['verification_status'])
    op.create_index('ix_weekly_momo_report_status', 'weekly_momo_submissions', ['report_id', 'verification_status'])

    op.create_table(
        'weekly_report_adjustments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('report_id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(length=48), nullable=False),
        sa.Column('label', sa.String(length=128), nullable=True),
        sa.Column('original_amount', sa.Numeric(16, 2), nullable=False),
        sa.Column('adjusted_amount', sa.Numeric(16, 2), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('actor_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['report_id'], ['weekly_reports.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_weekly_report_adjustments_report_id', 'weekly_report_adjustments', ['report_id'])

    op.create_table(
        'weekly_report_expenses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('report_id', sa.Integer(), nullable=False),
        sa.Column('expense_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(16, 2), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['report_id'], ['weekly_reports.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['expense_id'], ['expenses.id']),
        sa.UniqueConstraint('report_id', 'expense_id', name='uq_weekly_report_expense'),
        sa.UniqueConstraint('expense_id', name='uq_weekly_expense_once'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'weekly_outstanding_allocations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('report_id', sa.Integer(), nullable=False),
        sa.Column('source_report_id', sa.Integer(), nullable=True),
        sa.Column('reference_key', sa.String(length=128), nullable=False),
        sa.Column('kind', sa.String(length=32), nullable=False),
        sa.Column('amount', sa.Numeric(16, 2), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('actor_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id']),
        sa.ForeignKeyConstraint(['report_id'], ['weekly_reports.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['source_report_id'], ['weekly_reports.id']),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id']),
        sa.UniqueConstraint('reference_key', name='uq_weekly_outstanding_reference'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_weekly_outstanding_allocations_employee_id', 'weekly_outstanding_allocations', ['employee_id'])
    op.create_index('ix_weekly_outstanding_employee', 'weekly_outstanding_allocations', ['employee_id', 'created_at'])

    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('reason', sa.Text(), nullable=True))

    _seed_weekly_permissions(op.get_bind())


def downgrade():
    _remove_weekly_permissions(op.get_bind())
    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        batch_op.drop_column('reason')
    op.drop_index('ix_weekly_outstanding_employee', table_name='weekly_outstanding_allocations')
    op.drop_index('ix_weekly_outstanding_allocations_employee_id', table_name='weekly_outstanding_allocations')
    op.drop_table('weekly_outstanding_allocations')
    op.drop_table('weekly_report_expenses')
    op.drop_index('ix_weekly_report_adjustments_report_id', table_name='weekly_report_adjustments')
    op.drop_table('weekly_report_adjustments')
    op.drop_index('ix_weekly_momo_report_status', table_name='weekly_momo_submissions')
    op.drop_index('ix_weekly_momo_submissions_verification_status', table_name='weekly_momo_submissions')
    op.drop_index('ix_weekly_momo_submissions_reference', table_name='weekly_momo_submissions')
    op.drop_index('ix_weekly_momo_submissions_report_id', table_name='weekly_momo_submissions')
    op.drop_table('weekly_momo_submissions')
    op.drop_index('ix_weekly_report_branch_week', table_name='weekly_reports')
    op.drop_index('ix_weekly_report_status_week', table_name='weekly_reports')
    op.drop_index('ix_weekly_reports_status', table_name='weekly_reports')
    op.drop_index('ix_weekly_reports_employee_id', table_name='weekly_reports')
    op.drop_index('ix_weekly_reports_report_number', table_name='weekly_reports')
    op.drop_table('weekly_reports')
