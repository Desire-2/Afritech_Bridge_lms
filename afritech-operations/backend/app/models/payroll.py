from datetime import date
from ..extensions import db
from .user import TimestampMixin


class PayrollPeriod(TimestampMixin, db.Model):
    __tablename__ = 'payroll_periods'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), nullable=False)  # e.g. September 2026
    period_start = db.Column(db.Date, nullable=False)
    period_end = db.Column(db.Date, nullable=False)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    status = db.Column(db.String(16), default='draft', nullable=False)  # draft | reviewed | approved | paid

    items = db.relationship('PayrollItem', backref='period', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'period_start': self.period_start.isoformat(),
            'period_end': self.period_end.isoformat(),
            'branch_id': self.branch_id,
            'status': self.status,
            'total_gross': sum((i.base_salary or 0) for i in self.items),
            'total_commission_items': sum((i.commission or 0) for i in self.items),
            'item_count': len(self.items),
        }


class PayrollItem(TimestampMixin, db.Model):
    __tablename__ = 'payroll_items'

    id = db.Column(db.Integer, primary_key=True)
    payroll_period_id = db.Column(db.Integer, db.ForeignKey('payroll_periods.id'), nullable=False, index=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False, index=True)

    base_salary = db.Column(db.Numeric(16, 2), default=0)
    commission = db.Column(db.Numeric(16, 2), default=0)  # commission from completed transactions
    bonus = db.Column(db.Numeric(16, 2), default=0)
    deduction = db.Column(db.Numeric(16, 2), default=0)
    advance = db.Column(db.Numeric(16, 2), default=0)
    adjustment = db.Column(db.Numeric(16, 2), default=0)
    net_salary = db.Column(db.Numeric(16, 2), default=0)

    note = db.Column(db.String(500))

    employee = db.relationship('Employee')
    payroll_transactions = db.relationship('PayrollTransactionSource', backref='payroll_item', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'payroll_period_id': self.payroll_period_id,
            'employee_id': self.employee_id,
            'employee_name': self.employee.full_name if self.employee else None,
            'base_salary': float(self.base_salary or 0),
            'commission': float(self.commission or 0),
            'bonus': float(self.bonus or 0),
            'deduction': float(self.deduction or 0),
            'advance': float(self.advance or 0),
            'adjustment': float(self.adjustment or 0),
            'net_salary': float(self.net_salary or 0),
            'note': self.note,
        }


class PayrollTransactionSource(db.Model):
    __tablename__ = 'payroll_transaction_sources'

    id = db.Column(db.Integer, primary_key=True)
    payroll_item_id = db.Column(db.Integer, db.ForeignKey('payroll_items.id'), nullable=False)
    transaction_id = db.Column(db.Integer, db.ForeignKey('service_transactions.id'), nullable=False)
    commission_amount = db.Column(db.Numeric(16, 2), nullable=False)

    transaction = db.relationship('ServiceTransaction')


class LeaveRequest(TimestampMixin, db.Model):
    __tablename__ = 'leave_requests'

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    leave_type = db.Column(db.String(32), nullable=False)  # annual | sick | unpaid | other
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    reason = db.Column(db.String(500))
    status = db.Column(db.String(16), default='pending')  # pending | approved | rejected
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    approved_at = db.Column(db.DateTime(timezone=True))

    employee = db.relationship('Employee', backref='leaves')

    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'leave_type': self.leave_type,
            'start_date': self.start_date.isoformat(),
            'end_date': self.end_date.isoformat(),
            'reason': self.reason,
            'status': self.status,
        }