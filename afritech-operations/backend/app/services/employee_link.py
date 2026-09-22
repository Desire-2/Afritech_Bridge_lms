"""Create or link employee records for user accounts.

Shared by the users API route, the admin CLI and the backfill command so the
linking rules stay in one place.
"""
import re

from ..extensions import db
from ..models import Employee, Instructor


def names_from_email(email):
    """Derive (first_name, last_name) from an email local part as a fallback."""
    local = (email or '').split('@')[0]
    parts = [p.capitalize() for p in re.split(r'[._\-+]+', local) if p]
    if not parts:
        return 'Staff', 'Member'
    if len(parts) == 1:
        return parts[0], 'Staff'
    return parts[0], ' '.join(parts[1:])


def ensure_employee_for_user(user, *, first_name=None, last_name=None, phone=None,
                             position=None, branch_id=None, department_id=None, roles=None):
    """Return the employee for ``user``, linking an existing record or creating one.

    - If the user already has an employee, it is returned unchanged.
    - If an unlinked employee exists with the same email, it is linked (no duplicate).
    - Otherwise a new employee record is created and linked to the user.

    The user must already be flushed (have an id). Caller commits.
    """
    if user.employee:
        return user.employee

    email = (user.email or '').strip().lower()

    employee = Employee.query.filter_by(email=email).filter(Employee.user_id.is_(None)).first()
    if employee:
        employee.user_id = user.id
        db.session.flush()
        _ensure_instructor(employee, roles)
        return employee

    from ..routes.employees import make_employee_number
    first_name = (first_name or '').strip()
    last_name = (last_name or '').strip()
    if not first_name or not last_name:
        derived_first, derived_last = names_from_email(email)
        first_name = first_name or derived_first
        last_name = last_name or derived_last

    employee = Employee(
        employee_number=make_employee_number(),
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone=(phone or '').strip() or None,
        position=(position or '').strip() or None,
        branch_id=branch_id or None,
        department_id=department_id or None,
        user_id=user.id,
    )
    db.session.add(employee)
    db.session.flush()
    _ensure_instructor(employee, roles)
    return employee


def _ensure_instructor(employee, roles):
    if roles and 'instructor' in roles and not Instructor.query.filter_by(employee_id=employee.id).first():
        db.session.add(Instructor(employee_id=employee.id, is_active=True))
        db.session.flush()
