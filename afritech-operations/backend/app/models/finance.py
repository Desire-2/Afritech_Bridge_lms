from datetime import datetime, date
from ..extensions import db
from .user import TimestampMixin, utcnow

TRANSACTION_STATUSES = ['created', 'processing', 'completed', 'cancelled', 'failed', 'refunded']


class TransactionSeries(db.Model):
    __tablename__ = 'transaction_series'

    id = db.Column(db.Integer, primary_key=True)
    series_date = db.Column(db.Date, unique=True, nullable=False, index=True)
    number_series = db.Column(db.Integer, default=1, nullable=False)


def generate_transaction_number(db_session):
    today = date.today()
    prefix = 'TXN'
    date_part = today.strftime('%Y%m%d')
    row = TransactionSeries.query.filter_by(series_date=today).first()
    if not row:
        row = TransactionSeries(series_date=today, number_series=1)
        db_session.add(row)
        seq = 1
    else:
        row.number_series += 1
        seq = row.number_series
    return f'{prefix}-{date_part}-{seq:05d}'


class PaymentMethod(TimestampMixin, db.Model):
    __tablename__ = 'payment_methods'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), unique=True, nullable=False)
    code = db.Column(db.String(32), unique=True, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'is_active': self.is_active,
        }


class ServiceTransaction(TimestampMixin, db.Model):
    __tablename__ = 'service_transactions'

    id = db.Column(db.Integer, primary_key=True)
    transaction_number = db.Column(db.String(64), unique=True, nullable=False, index=True)
    transaction_date = db.Column(db.Date, default=date.today, nullable=False, index=True)
    status = db.Column(db.String(32), default='completed', nullable=False, index=True)

    service_id = db.Column(db.Integer, db.ForeignKey('services.id'), nullable=False)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    payment_method_id = db.Column(db.Integer, db.ForeignKey('payment_methods.id'))

    # values snapshot at transaction time (historical accuracy)
    service_name = db.Column(db.String(128), nullable=False)
    official_cost = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    customer_price = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    commission_rate_used = db.Column(db.Numeric(5, 4), nullable=False, default=0)
    commission_source = db.Column(db.String(32), nullable=False, default='default')  # default | employee | service
    gross_profit = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    commission_amount = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    company_profit = db.Column(db.Numeric(16, 2), nullable=False, default=0)

    reference = db.Column(db.String(255))
    notes = db.Column(db.String(500))
    is_cash = db.Column(db.Boolean, default=False, nullable=False)
    cancelled_at = db.Column(db.DateTime(timezone=True))
    cancelled_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    cancellation_reason = db.Column(db.String(255))

    employee = db.relationship('Employee', backref='transactions')
    payment_method = db.relationship('PaymentMethod')
    payments = db.relationship('Payment', backref='transaction', cascade='all, delete-orphan')

    def snapshot_employee_name(self):
        return f'{self.employee.first_name} {self.employee.last_name}'.strip() if self.employee else ''

    def to_dict(self):
        return {
            'id': self.id,
            'transaction_number': self.transaction_number,
            'transaction_date': self.transaction_date.isoformat() if self.transaction_date else None,
            'status': self.status,
            'service_id': self.service_id,
            'service_name': self.service_name,
            'client_id': self.client_id,
            'client_name': self.client.full_name if self.client else None,
            'client_number': self.client.client_number if self.client else None,
            'employee_id': self.employee_id,
            'employee_name': self.snapshot_employee_name(),
            'branch_id': self.branch_id,
            'payment_method_id': self.payment_method_id,
            'official_cost': float(self.official_cost),
            'customer_price': float(self.customer_price),
            'commission_rate_used': float(self.commission_rate_used),
            'commission_source': self.commission_source,
            'gross_profit': float(self.gross_profit),
            'commission_amount': float(self.commission_amount),
            'company_profit': float(self.company_profit),
            'reference': self.reference,
            'notes': self.notes,
            'is_cash': self.is_cash,
            'cancelled_at': self.cancelled_at.isoformat() if self.cancelled_at else None,
            'cancelled_by': self.cancelled_by,
            'cancellation_reason': self.cancellation_reason,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Payment(TimestampMixin, db.Model):
    __tablename__ = 'payments'

    id = db.Column(db.Integer, primary_key=True)
    transaction_id = db.Column(db.Integer, db.ForeignKey('service_transactions.id'), nullable=False, index=True)
    amount = db.Column(db.Numeric(16, 2), nullable=False)
    payment_method_id = db.Column(db.Integer, db.ForeignKey('payment_methods.id'), nullable=False)
    reference = db.Column(db.String(255))
    paid_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

    payment_method = db.relationship('PaymentMethod')

    def to_dict(self):
        return {
            'id': self.id,
            'transaction_id': self.transaction_id,
            'amount': float(self.amount),
            'payment_method': self.payment_method.name if self.payment_method else None,
            'payment_method_id': self.payment_method_id,
            'reference': self.reference,
            'paid_at': self.paid_at.isoformat() if self.paid_at else None,
        }


class CommissionRule(TimestampMixin, db.Model):
    __tablename__ = 'commission_rules'

    id = db.Column(db.Integer, primary_key=True)
    rate = db.Column(db.Numeric(5, 4), nullable=False)  # fraction e.g. 0.20
    # defines scope; the precedence is: service > employee > default
    scope = db.Column(db.String(16), nullable=False, default='default')  # default | service | employee
    service_id = db.Column(db.Integer, db.ForeignKey('services.id'))
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'))
    effective_from = db.Column(db.Date, nullable=False)
    effective_until = db.Column(db.Date)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    note = db.Column(db.String(255))

    service = db.relationship('Service')
    employee = db.relationship('Employee')

    def to_dict(self):
        return {
            'id': self.id,
            'rate': float(self.rate),
            'scope': self.scope,
            'service_id': self.service_id,
            'service_name': self.service.name if self.service else None,
            'employee_id': self.employee_id,
            'employee_name': self.employee.full_name if self.employee else None,
            'effective_from': self.effective_from.isoformat() if self.effective_from else None,
            'effective_until': self.effective_until.isoformat() if self.effective_until else None,
            'is_active': self.is_active,
        }


class DailyClosing(TimestampMixin, db.Model):
    __tablename__ = 'daily_closings'

    id = db.Column(db.Integer, primary_key=True)
    closing_date = db.Column(db.Date, nullable=False, index=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))

    transaction_count = db.Column(db.Integer, default=0, nullable=False)
    customer_payments = db.Column(db.Numeric(16, 2), default=0, nullable=False)
    cash_payments = db.Column(db.Numeric(16, 2), default=0, nullable=False)
    non_cash_payments = db.Column(db.Numeric(16, 2), default=0, nullable=False)
    service_costs = db.Column(db.Numeric(16, 2), default=0, nullable=False)
    gross_profit = db.Column(db.Numeric(16, 2), default=0, nullable=False)
    total_commission = db.Column(db.Numeric(16, 2), default=0, nullable=False)
    company_profit = db.Column(db.Numeric(16, 2), default=0, nullable=False)

    expected_cash = db.Column(db.Numeric(16, 2), default=0, nullable=False)
    actual_cash = db.Column(db.Numeric(16, 2), default=0, nullable=False)
    cash_difference = db.Column(db.Numeric(16, 2), default=0, nullable=False)
    reconciliation_class = db.Column(db.String(16), default='exact')  # exact | shortage | overage

    status = db.Column(db.String(16), default='submitted', nullable=False)  # submitted | approved | rejected | correction_requested
    notes = db.Column(db.String(500))
    submitted_at = db.Column(db.DateTime(timezone=True), default=utcnow)
    reviewed_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    reviewed_at = db.Column(db.DateTime(timezone=True))
    review_note = db.Column(db.String(500))
    is_locked = db.Column(db.Boolean, default=False, nullable=False)
    locked_at = db.Column(db.DateTime(timezone=True))

    employee = db.relationship('Employee', backref='daily_closings')
    reviewer = db.relationship('User', foreign_keys=[reviewed_by])

    @classmethod
    def reconciliation_class_for(cls, diff):
        if diff == 0:
            return 'exact'
        return 'shortage' if diff < 0 else 'overage'

    def to_dict(self):
        return {
            'id': self.id,
            'closing_date': self.closing_date.isoformat() if self.closing_date else None,
            'employee_id': self.employee_id,
            'employee_name': self.employee.full_name if self.employee else None,
            'branch_id': self.branch_id,
            'transaction_count': self.transaction_count,
            'customer_payments': float(self.customer_payments),
            'cash_payments': float(self.cash_payments),
            'non_cash_payments': float(self.non_cash_payments),
            'service_costs': float(self.service_costs),
            'gross_profit': float(self.gross_profit),
            'total_commission': float(self.total_commission),
            'company_profit': float(self.company_profit),
            'expected_cash': float(self.expected_cash),
            'actual_cash': float(self.actual_cash),
            'cash_difference': float(self.cash_difference),
            'reconciliation_class': self.reconciliation_class,
            'status': self.status,
            'notes': self.notes,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'reviewed_by': self.reviewed_by,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'review_note': self.review_note,
            'is_locked': self.is_locked,
        }


class Expense(TimestampMixin, db.Model):
    __tablename__ = 'expenses'

    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Numeric(16, 2), nullable=False)
    category = db.Column(db.String(64), nullable=False)  # internet | transport | supplies | equipment | rent | utilities | office | other
    description = db.Column(db.String(500), nullable=False)
    expense_date = db.Column(db.Date, default=date.today, nullable=False, index=True)
    payment_method_id = db.Column(db.Integer, db.ForeignKey('payment_methods.id'))
    submitted_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    approved_at = db.Column(db.DateTime(timezone=True))
    status = db.Column(db.String(16), default='pending', nullable=False)  # pending | approved | rejected | paid | cancelled
    receipt_path = db.Column(db.String(255))
    notes = db.Column(db.String(500))
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))

    submitter = db.relationship('User', foreign_keys=[submitted_by])
    approver = db.relationship('User', foreign_keys=[approved_by])
    payment_method = db.relationship('PaymentMethod')

    def to_dict(self):
        return {
            'id': self.id,
            'amount': float(self.amount),
            'category': self.category,
            'description': self.description,
            'expense_date': self.expense_date.isoformat() if self.expense_date else None,
            'payment_method_id': self.payment_method_id,
            'payment_method': self.payment_method.name if self.payment_method else None,
            'submitted_by': self.submitted_by,
            'submitted_by_name': self.submitter.employee.full_name if self.submitter and self.submitter.employee else self.submitter.email if self.submitter else None,
            'approved_by': self.approved_by,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'status': self.status,
            'receipt_path': self.receipt_path,
            'branch_id': self.branch_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }