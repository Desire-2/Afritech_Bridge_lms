"""Employee scope and data-access boundaries.

Two orthogonal boundaries are enforced here, server-side:

1. **Service Agent boundary** — roles that do not administer the service-centre
   operation (Company Secretary, Instructor, any custom administrative role)
   must never read, search, assign to, or otherwise reach Service Agent
   records. This is decided by *permission*, not by role name, so the rule
   keeps working for custom roles.
2. **Financial boundary** — employee salary / commission / payroll values are
   only serialized for users that hold an explicit financial permission.

Everything here is intentionally query-level (``notin_`` filters) and
row-level (``…_error()`` checks) so the restriction survives direct API calls
and manually typed URLs, not just hidden menu entries.
"""

from ..extensions import db
from ..models import Employee, Role, User, user_roles

SERVICE_AGENT_ROLE = 'service_agent'
SERVICE_AGENT_POSITION = 'service agent'

# Permissions that only exist inside the service-centre operation *and* imply
# authority over it. Holding any of them means the user administers — not just
# observes — the service-centre operation, so Service Agent records open up.
#
# Read-only codes (``services.view``, ``clients.view``, ``transactions.view``,
# ``transactions.operational``) are deliberately absent: the Company Secretary
# reads transaction status operationally and must still never reach a Service
# Agent's personnel record, salary or commission.
SERVICE_OPERATION_PERMISSIONS = (
    'services.manage',
    'clients.manage',
    'transactions.view_all', 'transactions.create', 'transactions.edit',
    'transactions.approve', 'transactions.cancel',
    'closings.view', 'closings.submit', 'closings.approve',
)

# Permissions that unlock *raw pay columns* (base salary, hourly rate,
# commission rate, national ID) on an employee profile.
#
# Deliberately narrow: `reports.view` / `expenses.view` grant access to the
# finance *domain*, which is not the same thing as a licence to read every
# employee's salary out of a directory listing. Keeping this list tight means a
# new role that can file an expense report does not silently inherit payroll.
EMPLOYEE_FINANCIAL_PERMISSIONS = (
    'employees.earnings.view_all',
    'payroll.view', 'payroll.manage', 'payroll.approve', 'payroll.mark_paid',
)

# Permissions that unlock financial values *somewhere* in the finance domain.
FINANCIAL_VIEW_PERMISSIONS = EMPLOYEE_FINANCIAL_PERMISSIONS + (
    'expenses.view', 'expenses.approve',
    'reports.view', 'reports.export',
)


# ── service-agent boundary ───────────────────────────────────────────────────

# Errors that mean "the payload itself is wrong" (400) rather than
# "you are not allowed to touch this row" (403).
_INVALID_SCOPE_ERRORS = ('Employee is required', 'Invalid employee id', 'Employee not found')


def scope_error_status(message):
    """HTTP status for an error returned by the ``*_scope_error`` helpers."""
    return 400 if message in _INVALID_SCOPE_ERRORS else 403


def can_access_service_agents(user):
    """True when the user may see / act on Service Agent records."""
    if user is None:
        return False
    if user.is_super_admin:
        return True
    return any(user.has_permission(p) for p in SERVICE_OPERATION_PERMISSIONS)


def in_restricted_employee_scope(user):
    """True when employee-facing endpoints must exclude Service Agents."""
    return not can_access_service_agents(user)


def is_service_agent_employee(emp):
    """Row-level Service Agent test (works for users *and* user-less staff)."""
    if emp is None:
        return False
    if (emp.position or '').strip().lower() == SERVICE_AGENT_POSITION:
        return True
    if emp.user_id:
        try:
            if SERVICE_AGENT_ROLE in emp.user.role_codes:
                return True
        except Exception:  # pragma: no cover - defensive
            return False
    return False


def service_agent_employee_ids():
    """Ids of every Service Agent employee, for query-level exclusion."""
    role_users = (
        db.session.query(user_roles.c.user_id)
        .join(Role, Role.id == user_roles.c.role_id)
        .filter(Role.code == SERVICE_AGENT_ROLE)
        .scalar_subquery()
    )
    rows = (
        db.session.query(Employee.id)
        .outerjoin(User, Employee.user_id == User.id)
        .filter(db.or_(
            db.func.lower(db.func.coalesce(Employee.position, '')) == SERVICE_AGENT_POSITION,
            User.id.in_(role_users),
        ))
        .all()
    )
    return {row[0] for row in rows}


def exclude_service_agents(query, user, column=None):
    """Drop Service Agent rows from a query unless the user may see them.

    ``column`` defaults to ``employees.id``, so it works for Employee,
    Attendance.employee_id, Task.assigned_to, … queries alike.
    """
    if can_access_service_agents(user):
        return query
    ids = service_agent_employee_ids()
    if not ids:
        return query
    if column is None:
        column = Employee.id
    return query.filter(column.notin_(ids))


def employee_scope_error(user, employee_id):
    """Return an error message when ``employee_id`` is out of scope, else None.

    Used to reject task assignment, meeting invitations, activity participants
    and similar writes that target a Service Agent.
    """
    if employee_id is None or employee_id == '':
        return 'Employee is required'
    try:
        employee_id = int(employee_id)
    except (TypeError, ValueError):
        return 'Invalid employee id'
    emp = Employee.query.get(employee_id)
    if emp is None:
        return 'Employee not found'
    if is_service_agent_employee(emp) and not can_access_service_agents(user):
        return 'Service Agent employees are outside your coordination scope'
    return None


def employee_ids_scope_error(user, employee_ids):
    """Validate a list of employee ids. Returns an error message or None."""
    for employee_id in employee_ids or []:
        err = employee_scope_error(user, employee_id)
        if err:
            return err
    return None


def employee_in_scope(user, emp):
    return employee_scope_error(user, getattr(emp, 'id', None)) is None


# ── financial boundary ───────────────────────────────────────────────────────


def can_view_employee_financials(user):
    """True when ``user`` may see pay columns on *any* employee profile.

    This is the gate for serializing ``base_salary`` / ``hourly_rate`` /
    ``default_commission_rate`` / ``national_id``. Unlike
    :func:`can_view_financials` it has **no own-record carve-out**: holding
    ``employees.earnings.view_own`` lets you read your own commission on the
    earnings endpoint, not your salary inside the company directory.
    """
    if user is None:
        return False
    if user.is_super_admin:
        return True
    return any(user.has_permission(p) for p in EMPLOYEE_FINANCIAL_PERMISSIONS)


def can_view_financials(user, employee=None):
    """True when ``user`` may see financial values for ``employee``.

    Used by pay-sensitive endpoints (earnings, payroll items, attendance
    overtime). ``employees.earnings.view_own`` deliberately does **not** count
    here unless ``employee`` is the caller's own record, handled below.
    """
    if user is None:
        return False
    if user.is_super_admin:
        return True
    if any(user.has_permission(p) for p in FINANCIAL_VIEW_PERMISSIONS):
        return True
    # Own-record carve-out: `employees.earnings.view_own` reads your own figures,
    # and it must be tested *after* the global list so a role that can see every
    # employee's pay (e.g. `employees.earnings.view_all`) does not lose sight of
    # its own row.
    if employee is not None and user.employee is not None and user.employee.id == employee.id:
        return user.has_permission('employees.earnings.view_own')
    return False


def has_any_permission(user, permissions):
    if user is None:
        return False
    if user.is_super_admin:
        return True
    return any(user.has_permission(p) for p in permissions)


# ── service-centre financial redaction ───────────────────────────────────────
#
# Reading service work and reading the money on it are two different rights.
# A viewer that holds ``transactions.operational`` (the Company Secretary)
# receives the same rows as everybody else — number, date, client, service,
# assignee, status — with every monetary field stripped from the payload
# *before* it is serialised, so nothing financial ever crosses the wire.

# Fields of ``ServiceTransaction.to_dict()`` that carry money or payment data.
TRANSACTION_FINANCIAL_FIELDS = (
    'official_cost', 'customer_price', 'commission_rate_used', 'commission_source',
    'gross_profit', 'commission_amount', 'company_profit',
    'payment_method_id', 'is_cash', 'payments',
)

# Fields of ``Service.to_dict()`` that carry cost, price or commission rate.
SERVICE_FINANCIAL_FIELDS = ('official_cost', 'customer_price', 'commission_rate')

# Permission to create a transaction implies pricing the work being sold.
_SERVICE_PRICING_PERMISSIONS = ('services.manage', 'transactions.create')

# Write authority over a transaction implies reading the numbers it carries:
# you cannot record or correct a price you are not allowed to see.
_TRANSACTION_WRITE_PERMISSIONS = (
    'transactions.create', 'transactions.edit', 'transactions.approve', 'transactions.cancel',
)


def transaction_read_scope(user):
    """How much of the transaction table ``user`` may read.

    ``'all'``         — every row, with money (manager, accountant, super admin)
    ``'operational'`` — every row, status only (Company Secretary)
    ``'own'``         — rows assigned to the caller, with money (service agent)
    """
    if user is None:
        return 'own'
    if user.is_super_admin:
        return 'all'
    if user.has_permission('transactions.view_all'):
        return 'all'
    if user.has_permission('transactions.operational'):
        return 'operational'
    return 'own'


def can_view_transaction_amounts(user, employee_id=None):
    """True when ``user`` may see the money on a service transaction.

    ``employee_id`` is the transaction's owner: a Service Agent always reads
    the value of their own work, but a status-only reader never does — not
    even if a row happens to be assigned to them.
    """
    if user is None:
        return False
    if user.is_super_admin or user.has_permission('transactions.view_all'):
        return True
    if any(user.has_permission(p) for p in _TRANSACTION_WRITE_PERMISSIONS):
        return True
    if user.has_permission('transactions.operational') and not user.has_permission('transactions.view'):
        return False
    if employee_id is not None and user.employee is not None and user.employee.id == employee_id:
        return True
    return any(user.has_permission(p) for p in FINANCIAL_VIEW_PERMISSIONS)


def can_view_service_prices(user):
    """True when ``user`` may see a service's cost, price or commission rate."""
    if user is None:
        return False
    if user.is_super_admin:
        return True
    if any(user.has_permission(p) for p in _SERVICE_PRICING_PERMISSIONS):
        return True
    return any(user.has_permission(p) for p in FINANCIAL_VIEW_PERMISSIONS)


def redact_transaction(payload, user):
    """Strip every financial field from a serialized transaction, in place.

    Returns the same dict so call sites can write
    ``redact_transaction(t.to_dict(), user)``.
    """
    if payload is None:
        return payload
    if can_view_transaction_amounts(user, payload.get('employee_id')):
        return payload
    for field in TRANSACTION_FINANCIAL_FIELDS:
        payload.pop(field, None)
    return payload


def redact_service(payload, user):
    """Strip cost / price / commission rate from a serialized service."""
    if payload is None:
        return payload
    if can_view_service_prices(user):
        return payload
    for field in SERVICE_FINANCIAL_FIELDS:
        payload.pop(field, None)
    return payload
