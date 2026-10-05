"""Shared helpers for the internal-communication and coordination routes.

Announcements, memos, documents, requests, follow-ups and escalations all need
the same two things: which records is this viewer allowed to see, and which
employee ids is it allowed to point at. Keeping that logic here means a new
endpoint cannot accidentally re-introduce a bypass.

Audience→employee-id resolution itself lives in ``services.audience`` so the
automation engine can reuse it without importing a blueprint module.
"""

from ..extensions import db
from ..models import Employee
from ..auth.scope import (
    can_access_service_agents, exclude_service_agents,
    in_restricted_employee_scope, service_agent_employee_ids,
)
from ..services.audience import (
    load_recipient_ids, dump_recipient_ids, recipient_employee_ids,
    expected_recipients,
)

__all__ = [
    'load_recipient_ids', 'dump_recipient_ids', 'recipient_employee_ids',
    'expected_recipients', 'audience_ids_in_scope', 'scope_visible_to_viewer',
    'visible_employee_ids', 'can_target_employee',
]


def audience_ids_in_scope(user, audience, department_id=None, branch_id=None, recipient_ids=None):
    """Resolve an audience to employee ids *the viewer is allowed to see*.

    A department or branch broadcast legitimately reaches everyone in it,
    including Service Agents — but a coordinator who cannot see those agents
    must not be shown their names in an acknowledgement roster, or able to
    count them as outstanding. This is the filter that enforces that.
    """
    exclude = service_agent_employee_ids() if in_restricted_employee_scope(user) else None
    return expected_recipients(
        audience, department_id, branch_id, recipient_ids, exclude_ids=exclude)


def scope_visible_to_viewer(query, user, model):
    """Restrict an audience-scoped communication query to what the viewer may read.

    Rules:
      * ``audience == 'all'``       -> everyone with the view permission.
      * ``department`` / ``branch`` -> only when it matches the viewer's own
        department/branch.
      * ``custom``                  -> only when the viewer is a recipient.
      * A coordinator who reads the whole employee directory sees everything;
        everyone else (Service Agents, Instructors, the shop floor) is held to
        the rules above.

    ``department``/``branch``/``all`` are filtered in SQL. ``custom`` cannot be:
    recipients live in a JSON text column, where a SQL ``LIKE '%1%'`` would also
    match employee 13. Those rows are matched exactly in Python instead, which is
    safe because custom-audience posts are few.

    The full-view shortcut needs *both* halves of the coordinator test.
    ``can_access_service_agents`` alone is not enough: it is also satisfied by a
    Service Agent (they hold ``clients.manage`` / ``transactions.create``), which
    handed every department, branch and custom-addressed notice in the company
    to the one role that is only supposed to receive its own. Directory access
    — ``employees.view`` — is what marks somebody as coordinating rather than
    being coordinated, and no Service Agent role holds it.
    """
    if can_access_service_agents(user) and user is not None and user.has_permission('employees.view'):
        return query

    emp = user.employee if user is not None else None
    if emp is None:
        # No employee profile, so no department/branch/custom membership.
        return query.filter(model.audience == 'all')

    broad = query.filter(db.or_(
        model.audience == 'all',
        db.and_(model.audience == 'department', model.department_id == emp.department_id),
        db.and_(model.audience == 'branch', model.branch_id == emp.branch_id),
    ))
    custom_rows = query.filter(model.audience == 'custom').all()
    custom_ids = {o.id for o in custom_rows if emp.id in load_recipient_ids(o.recipient_ids)}
    visible_ids = {o.id for o in broad.all()} | custom_ids
    return query.filter(model.id.in_(visible_ids or {0}))


def visible_employee_ids(user):
    """Every employee the viewer may assign work to (Service Agents excluded)."""
    return {e.id for e in exclude_service_agents(Employee.query, user, Employee.id).all()}


def can_target_employee(user, employee_id):
    """True when ``employee_id`` is a legitimate target for this viewer."""
    if employee_id is None:
        return False
    try:
        employee_id = int(employee_id)
    except (TypeError, ValueError):
        return False
    return employee_id in visible_employee_ids(user)