from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from ..models import CommissionRule, Service, Employee, Setting, User


class CommissionError(Exception):
    pass


def _dec(value):
    return Decimal(str(value or 0))


def _as_decimal(value):
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


class CommissionEngine:
    """
    Commission determination rules (precedence, highest priority first):

    1. Employee-specific override:
       - Employee.default_commission_rate  (if set on the employee profile)
       - OR an active CommissionRule with scope='employee' matching this employee.

    2. Service-specific rate:
       - Service.commission_rate  (if set on the service)
       - OR an active CommissionRule with scope='service' matching this service.

    3. Default configured rate:
       - An active CommissionRule with scope='default'
       - OR the app-level DEFAULT_COMMISSION_RATE.

    Default value is 20% of GROSS PROFIT — never of the customer payment.

        Gross Profit        = Customer Price - Service Cost
        Employee Commission = Gross Profit * Commission Rate
        Company Profit      = Gross Profit - Employee Commission
    """

    def __init__(self, app=None):
        self.default_rate = Decimal('0.20')
        if app:
            self.default_rate = Decimal(str(getattr(app.config, 'DEFAULT_COMMISSION_RATE', 0.20)))

    def current_rate(self, service=None, employee=None, on_date=None, service_active_rule=None, employee_active_rule=None):
        on_date = on_date or date.today()

        if employee_active_rule is None and employee is not None:
            employee_active_rule = self._active_rule('employee', employee_id=employee.id, on_date=on_date)
        if service_active_rule is None and service is not None:
            service_active_rule = self._active_rule('service', service_id=service.id, on_date=on_date)

        if employee is not None and getattr(employee, 'default_commission_rate', None) is not None:
            return _as_decimal(employee.default_commission_rate), 'employee'

        if employee_active_rule:
            return _as_decimal(employee_active_rule.rate), 'employee'

        if service is not None and getattr(service, 'commission_rate', None) is not None:
            return _as_decimal(service.commission_rate), 'service'

        if service_active_rule:
            return _as_decimal(service_active_rule.rate), 'service'

        default_rule = self._active_rule('default', on_date=on_date)
        if default_rule:
            return _as_decimal(default_rule.rate), 'default'

        return self.default_rate.quantize(Decimal('0.0001')), 'default'

    @staticmethod
    def _active_rule(scope, service_id=None, employee_id=None, on_date=None):
        q = CommissionRule.query.filter_by(scope=scope, is_active=True)
        if service_id is not None:
            q = q.filter_by(service_id=service_id)
        if employee_id is not None:
            q = q.filter_by(employee_id=employee_id)
        rules = q.filter(
            CommissionRule.effective_from <= on_date
        ).filter(
            (CommissionRule.effective_until.is_(None)) | (CommissionRule.effective_until >= on_date)
        ).order_by(CommissionRule.updated_at.desc()).all()
        return rules[0] if rules else None

    @staticmethod
    def calculate(official_cost, customer_price, commission_rate):
        official = _dec(official_cost)
        customer = _dec(customer_price)
        rate = _dec(commission_rate)

        gross_profit = _as_decimal(customer - official)
        commission_amount = _as_decimal(gross_profit * rate)
        company_profit = _as_decimal(gross_profit - commission_amount)
        return {
            'official_cost': gross_profit if False else _dec(official_cost),
            'gross_profit': gross_profit,
            'commission_amount': commission_amount,
            'company_profit': company_profit,
        }


def resolve_commission(service, employee, on_date=None, official_cost=None, customer_price=None):
    """
    Resolve the effective commission rate and calculate the financial breakdown
    for a transaction using the values snapshot at transaction time.
    """
    engine = CommissionEngine()
    rate, source = engine.current_rate(service=service, employee=employee, on_date=on_date)

    official = official_cost if official_cost is not None else service.official_cost
    customer = customer_price if customer_price is not None else service.customer_price

    result = engine.calculate(official, customer, rate)
    result['rate'] = rate
    result['rate_source'] = source
    return result


def default_rate():
    from flask import current_app
    engine = CommissionEngine(app=current_app)
    rate, source = engine.current_rate()
    return rate, source