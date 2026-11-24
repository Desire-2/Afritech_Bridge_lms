"""Weekly Service Agent financial reports and money-submission records.

These tables are additive. Existing ServiceTransaction, Payment, DailyClosing
and Expense rows remain the source of truth; the report stores only the policy
snapshot, the agent's declarations, reviewer verification and the locked
calculation used for exports.
"""
from ..extensions import db
from .user import TimestampMixin, utcnow


WEEKLY_REPORT_STATUSES = [
    'draft',
    'ready_for_submission',
    'submitted',
    'under_financial_review',
    'returned_for_correction',
    'approved',
    'rejected',
    'late',
]

# Backend-enforced state machine. Any transition not listed here is rejected.
WEEKLY_REPORT_TRANSITIONS = {
    'draft': ['ready_for_submission', 'late'],
    'ready_for_submission': ['submitted', 'late'],
    'late': ['ready_for_submission', 'submitted', 'returned_for_correction', 'rejected'],
    'submitted': ['under_financial_review', 'returned_for_correction'],
    'under_financial_review': ['approved', 'rejected', 'returned_for_correction'],
    'returned_for_correction': ['ready_for_submission', 'late'],
    'approved': [],
    'rejected': [],
}

MOMO_PROVIDERS = ['momo', 'bank_transfer', 'cash_deposit']
MOMO_VERIFICATION_STATUSES = ['pending', 'verified', 'rejected']
# Who funded the service amount the agent says she submitted for the week.
# This is an agent declaration, not evidence: the reviewer still verifies the
# underlying MoMo/bank transfer rows before any amount clears the report.
WEEKLY_SUBMISSION_SOURCES = ['agent_phone', 'company', 'someone_else']
# A personal payment of an official service cost has its own verification
# lifecycle. It is never a customer Payment and never a remittance MoMo row.
COST_PAYMENT_VERIFICATION_STATUSES = ['pending', 'verified', 'rejected']
SHORTAGE_REASON_CATEGORIES = [
    'cash_count_error', 'unrecorded_collection', 'unapproved_expense',
    'provider_payment_timing', 'bank_delay', 'documentation_error', 'other',
]
ADJUSTMENT_KINDS = [
    'authorized_receipt', 'provider_payment', 'collection_expense',
    'authorized_refund', 'other_outflow', 'commission_retained',
    'outstanding_correction', 'outstanding_waiver',
]


class WeeklyReport(TimestampMixin, db.Model):
    __tablename__ = 'weekly_reports'
    __table_args__ = (
        db.UniqueConstraint('employee_id', 'week_start', name='uq_weekly_report_agent_period'),
        db.Index('ix_weekly_report_status_week', 'status', 'week_start'),
        db.Index('ix_weekly_report_branch_week', 'branch_id', 'week_start'),
    )

    id = db.Column(db.Integer, primary_key=True)
    report_number = db.Column(db.String(64), unique=True, nullable=False, index=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    week_start = db.Column(db.Date, nullable=False)
    week_end = db.Column(db.Date, nullable=False)
    due_at = db.Column(db.DateTime(timezone=True), nullable=False)
    timezone_name = db.Column(db.String(64), nullable=False, default='Africa/Kigali')
    period_label = db.Column(db.String(128))

    status = db.Column(db.String(32), nullable=False, default='draft', index=True)
    is_late = db.Column(db.Boolean, nullable=False, default=False)
    current_version = db.Column(db.Integer, nullable=False, default=1)

    generated_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    submitted_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    submitted_at = db.Column(db.DateTime(timezone=True))
    reviewer_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    reviewed_at = db.Column(db.DateTime(timezone=True))
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    approved_at = db.Column(db.DateTime(timezone=True))
    rejected_at = db.Column(db.DateTime(timezone=True))

    # Backend-authoritative amounts. Draft reports are recomputed from source
    # records; once submitted, these values and `snapshot` are immutable.
    opening_outstanding = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    eligible_collections = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    service_costs = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    authorized_receipts = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    verified_provider_payments = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    approved_collection_expenses = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    authorized_refunds = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    other_outflows = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    commission_retained = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    expected_remittance = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    agent_reported_submitted = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    verified_submitted = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    # Agent's own declaration of the weekly amount sent and who funded it.
    # Kept separate from the verified totals so a claim cannot clear a report.
    declared_submitted_amount = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    submission_funding_source = db.Column(
        db.String(32), nullable=False, default='agent_phone')
    shortage_amount = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    surplus_amount = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    commission_earned = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    closing_outstanding = db.Column(db.Numeric(16, 2), nullable=False, default=0)

    # Agent declarations (user-authored text is never translated or rewritten).
    shortage_reason_category = db.Column(db.String(64))
    shortage_explanation = db.Column(db.Text)
    shortage_evidence_path = db.Column(db.String(500))
    shortage_evidence_name = db.Column(db.String(255))
    expected_resolution_date = db.Column(db.Date)
    override_reason = db.Column(db.Text)
    override_authorized_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    override_authorized_at = db.Column(db.DateTime(timezone=True))

    # Reviewer/governance fields.
    correction_note = db.Column(db.Text)
    reviewer_note = db.Column(db.Text)
    rejection_reason = db.Column(db.Text)
    missing_closing_override_reason = db.Column(db.Text)
    missing_closing_override_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    missing_closing_override_at = db.Column(db.DateTime(timezone=True))

    # JSON strings keep the exact calculation/statement used at submission.
    snapshot = db.Column(db.Text)
    calculation = db.Column(db.Text)

    employee = db.relationship('Employee', foreign_keys=[employee_id])
    branch = db.relationship('Branch')
    generator = db.relationship('User', foreign_keys=[generated_by])
    submitter = db.relationship('User', foreign_keys=[submitted_by])
    reviewer = db.relationship('User', foreign_keys=[reviewer_id])
    approver = db.relationship('User', foreign_keys=[approved_by])
    override_authorizer = db.relationship('User', foreign_keys=[override_authorized_by])
    missing_closing_authorizer = db.relationship('User', foreign_keys=[missing_closing_override_by])
    momo_submissions = db.relationship('MoMoSubmission', backref='report', cascade='all, delete-orphan')
    cost_payment_claims = db.relationship(
        'OfficialCostPayment', backref='report', cascade='all, delete-orphan')
    adjustments = db.relationship('WeeklyReportAdjustment', backref='report', cascade='all, delete-orphan')
    expense_links = db.relationship('WeeklyReportExpense', backref='report', cascade='all, delete-orphan')

    def to_dict(self):
        def f(value):
            return float(value or 0)

        return {
            'id': self.id,
            'report_number': self.report_number,
            'employee_id': self.employee_id,
            'employee_name': self.employee.full_name if self.employee else None,
            'branch_id': self.branch_id,
            'branch_name': self.branch.name if self.branch else None,
            'week_start': self.week_start.isoformat() if self.week_start else None,
            'week_end': self.week_end.isoformat() if self.week_end else None,
            'due_at': self.due_at.isoformat() if self.due_at else None,
            'timezone': self.timezone_name,
            'period_label': self.period_label,
            'status': self.status,
            'is_late': bool(self.is_late),
            'current_version': self.current_version,
            'generated_by': self.generated_by,
            'submitted_by': self.submitted_by,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'reviewer_id': self.reviewer_id,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'approved_by': self.approved_by,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'rejected_at': self.rejected_at.isoformat() if self.rejected_at else None,
            'opening_outstanding': f(self.opening_outstanding),
            'eligible_collections': f(self.eligible_collections),
            'service_costs': f(self.service_costs),
            'authorized_receipts': f(self.authorized_receipts),
            'verified_provider_payments': f(self.verified_provider_payments),
            'approved_collection_expenses': f(self.approved_collection_expenses),
            'authorized_refunds': f(self.authorized_refunds),
            'other_outflows': f(self.other_outflows),
            'commission_retained': f(self.commission_retained),
            'expected_remittance': f(self.expected_remittance),
            'agent_reported_submitted': f(self.agent_reported_submitted),
            'verified_submitted': f(self.verified_submitted),
            'declared_submitted_amount': f(self.declared_submitted_amount),
            'submission_funding_source': self.submission_funding_source,
            'shortage_amount': f(self.shortage_amount),
            'surplus_amount': f(self.surplus_amount),
            'commission_earned': f(self.commission_earned),
            'closing_outstanding': f(self.closing_outstanding),
            'shortage_reason_category': self.shortage_reason_category,
            'shortage_explanation': self.shortage_explanation,
            'shortage_evidence_path': self.shortage_evidence_path,
            'shortage_evidence_name': self.shortage_evidence_name,
            'expected_resolution_date': self.expected_resolution_date.isoformat() if self.expected_resolution_date else None,
            'has_override': bool(self.override_reason),
            'override_reason': self.override_reason,
            'override_authorized_by': self.override_authorized_by,
            'override_authorized_at': self.override_authorized_at.isoformat() if self.override_authorized_at else None,
            'correction_note': self.correction_note,
            'reviewer_note': self.reviewer_note,
            'rejection_reason': self.rejection_reason,
            'has_missing_closing_override': bool(self.missing_closing_override_reason),
            'missing_closing_override_reason': self.missing_closing_override_reason,
            'missing_closing_override_by': self.missing_closing_override_by,
            'missing_closing_override_at': self.missing_closing_override_at.isoformat() if self.missing_closing_override_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class MoMoSubmission(TimestampMixin, db.Model):
    __tablename__ = 'weekly_momo_submissions'
    __table_args__ = (
        db.Index('ix_weekly_momo_report_status', 'report_id', 'verification_status'),
    )

    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, db.ForeignKey('weekly_reports.id', ondelete='CASCADE'), nullable=False, index=True)
    provider = db.Column(db.String(32), nullable=False, default='momo')
    reference = db.Column(db.String(128), nullable=False, unique=True, index=True)
    amount = db.Column(db.Numeric(16, 2), nullable=False)
    submitted_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    sender_phone = db.Column(db.String(32))
    recipient_phone = db.Column(db.String(32))
    confirmation_code = db.Column(db.String(128))
    notes = db.Column(db.Text)
    evidence_path = db.Column(db.String(500))
    evidence_name = db.Column(db.String(255))
    content_type = db.Column(db.String(128))
    size_bytes = db.Column(db.Integer)
    verification_status = db.Column(db.String(32), nullable=False, default='pending', index=True)
    verified_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    verified_at = db.Column(db.DateTime(timezone=True))
    verification_note = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    verifier = db.relationship('User', foreign_keys=[verified_by])

    @staticmethod
    def mask_phone(value):
        if not value:
            return None
        raw = str(value)
        # Never expose more than the last three digits. Long international
        # numbers keep a short country/operator prefix so reviewers can still
        # recognise the provider; short local numbers hide everything else.
        if len(raw) <= 3:
            return '***'
        if len(raw) <= 10:
            return '*' * (len(raw) - 3) + raw[-3:]
        return raw[:4] + '*' * max(0, len(raw) - 7) + raw[-3:]

    def to_dict(self):
        return {
            'id': self.id,
            'report_id': self.report_id,
            'provider': self.provider,
            'reference': self.reference,
            'amount': float(self.amount or 0),
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'sender_phone': self.mask_phone(self.sender_phone),
            'recipient_phone': self.mask_phone(self.recipient_phone),
            'confirmation_code': self.confirmation_code,
            'notes': self.notes,
            'evidence_path': self.evidence_path,
            'evidence_name': self.evidence_name,
            'content_type': self.content_type,
            'size_bytes': self.size_bytes,
            'verification_status': self.verification_status,
            'verified_by': self.verified_by,
            'verified_at': self.verified_at.isoformat() if self.verified_at else None,
            'verification_note': self.verification_note,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class OfficialCostPayment(TimestampMixin, db.Model):
    """A claim that an official service cost was paid from agent's own funds.

    This is additive: customer ``Payment`` rows remain the source of all money
    collected from customers, and ``MoMoSubmission`` rows remain remittances to
    the company. Only a *verified* row here reduces expected remittance, and a
    ``personal_payment`` answer of ``False`` never qualifies.
    """

    __tablename__ = 'weekly_official_cost_payments'
    __table_args__ = (
        db.UniqueConstraint('reference_key', name='uq_weekly_cost_payment_reference'),
        db.UniqueConstraint('report_id', 'transaction_id', name='uq_weekly_cost_payment_transaction'),
        db.Index('ix_weekly_cost_payment_report_status', 'report_id', 'verification_status'),
        db.Index('ix_weekly_cost_payment_employee', 'employee_id', 'paid_at'),
    )

    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, db.ForeignKey('weekly_reports.id', ondelete='CASCADE'),
                          nullable=False, index=True)
    transaction_id = db.Column(db.Integer, db.ForeignKey('service_transactions.id'),
                               nullable=False, index=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'),
                            nullable=False, index=True)
    reference_key = db.Column(db.String(180), nullable=False)

    # Source facts captured at claim time. ``customer_payment_status`` is the
    # customer's payment status, never the status of this personal payment.
    official_cost = db.Column(db.Numeric(16, 2), nullable=False)
    customer_payment_status = db.Column(db.String(32), nullable=False)
    personal_payment = db.Column(db.Boolean, nullable=False, default=False)
    amount = db.Column(db.Numeric(16, 2), nullable=False)
    is_partial = db.Column(db.Boolean, nullable=False, default=False)
    provider = db.Column(db.String(32), nullable=False)
    reference = db.Column(db.String(128), nullable=False, index=True)
    paid_at = db.Column(db.DateTime(timezone=True), nullable=False)
    sender_phone = db.Column(db.String(32))

    evidence_path = db.Column(db.String(500))
    evidence_name = db.Column(db.String(255))
    content_type = db.Column(db.String(128))
    size_bytes = db.Column(db.Integer)
    notes = db.Column(db.Text)

    verification_status = db.Column(db.String(32), nullable=False,
                                    default='pending', index=True)
    verified_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    verified_at = db.Column(db.DateTime(timezone=True))
    verification_note = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    transaction = db.relationship('ServiceTransaction')
    employee = db.relationship('Employee')
    verifier = db.relationship('User', foreign_keys=[verified_by])
    creator = db.relationship('User', foreign_keys=[created_by])

    def to_dict(self, include_sensitive=True):
        payload = {
            'id': self.id,
            'report_id': self.report_id,
            'transaction_id': self.transaction_id,
            'transaction_number': self.transaction.transaction_number if self.transaction else None,
            'employee_id': self.employee_id,
            'official_cost': float(self.official_cost or 0),
            'customer_payment_status': self.customer_payment_status,
            'personal_payment': bool(self.personal_payment),
            'amount': float(self.amount or 0),
            'is_partial': bool(self.is_partial),
            'provider': self.provider,
            'reference': self.reference,
            'paid_at': self.paid_at.isoformat() if self.paid_at else None,
            'evidence_path': self.evidence_path,
            'evidence_name': self.evidence_name,
            'content_type': self.content_type,
            'size_bytes': self.size_bytes,
            'notes': self.notes,
            'verification_status': self.verification_status,
            'verified_by': self.verified_by,
            'verified_at': self.verified_at.isoformat() if self.verified_at else None,
            'verification_note': self.verification_note,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_sensitive:
            payload['sender_phone'] = MoMoSubmission.mask_phone(self.sender_phone)
        return payload


class WeeklyReportAdjustment(TimestampMixin, db.Model):
    __tablename__ = 'weekly_report_adjustments'

    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, db.ForeignKey('weekly_reports.id', ondelete='CASCADE'), nullable=False, index=True)
    kind = db.Column(db.String(48), nullable=False)
    label = db.Column(db.String(128))
    original_amount = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    adjusted_amount = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    reason = db.Column(db.Text, nullable=False)
    actor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    actor = db.relationship('User')

    def to_dict(self):
        return {
            'id': self.id,
            'report_id': self.report_id,
            'kind': self.kind,
            'label': self.label,
            'original_amount': float(self.original_amount or 0),
            'adjusted_amount': float(self.adjusted_amount or 0),
            'reason': self.reason,
            'actor_id': self.actor_id,
            'actor_email': self.actor.email if self.actor else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class WeeklyReportExpense(TimestampMixin, db.Model):
    """Links an expense to exactly one weekly report (anti-double-deduction)."""

    __tablename__ = 'weekly_report_expenses'
    __table_args__ = (
        db.UniqueConstraint('report_id', 'expense_id', name='uq_weekly_report_expense'),
        db.UniqueConstraint('expense_id', name='uq_weekly_expense_once'),
    )

    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, db.ForeignKey('weekly_reports.id', ondelete='CASCADE'), nullable=False)
    expense_id = db.Column(db.Integer, db.ForeignKey('expenses.id'), nullable=False)
    amount = db.Column(db.Numeric(16, 2), nullable=False)
    status = db.Column(db.String(32), nullable=False, default='approved')

    def to_dict(self):
        return {
            'id': self.id,
            'report_id': self.report_id,
            'expense_id': self.expense_id,
            'amount': float(self.amount or 0),
            'status': self.status,
        }


class OutstandingAllocation(TimestampMixin, db.Model):
    """Immutable carry-forward / waiver / correction history."""

    __tablename__ = 'weekly_outstanding_allocations'
    __table_args__ = (
        db.UniqueConstraint('reference_key', name='uq_weekly_outstanding_reference'),
        db.Index('ix_weekly_outstanding_employee', 'employee_id', 'created_at'),
    )

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False, index=True)
    report_id = db.Column(db.Integer, db.ForeignKey('weekly_reports.id', ondelete='CASCADE'), nullable=False)
    source_report_id = db.Column(db.Integer, db.ForeignKey('weekly_reports.id'))
    reference_key = db.Column(db.String(128), nullable=False)
    kind = db.Column(db.String(32), nullable=False)
    amount = db.Column(db.Numeric(16, 2), nullable=False)
    reason = db.Column(db.Text)
    actor_id = db.Column(db.Integer, db.ForeignKey('users.id'))

    actor = db.relationship('User')
    report = db.relationship(
        'WeeklyReport',
        foreign_keys=[report_id],
        backref=db.backref('allocations', cascade='all, delete-orphan'),
    )
    source_report = db.relationship('WeeklyReport', foreign_keys=[source_report_id])

    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'report_id': self.report_id,
            'source_report_id': self.source_report_id,
            'kind': self.kind,
            'amount': float(self.amount or 0),
            'reason': self.reason,
            'actor_id': self.actor_id,
            'actor_email': self.actor.email if self.actor else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
