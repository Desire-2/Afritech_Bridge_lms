"""Audience resolution for internal communications.

Announcements and memos address an audience (``all`` / ``department`` /
``branch`` / ``custom``) which has to be turned into concrete employee ids both
when publishing (who gets notified) and when chasing acknowledgements.

This lives in ``services`` rather than ``routes`` because the automation engine
needs the same resolution; putting it here keeps the layering one-directional
(routes → services) instead of making services import a blueprint module.
"""

import json

from ..models import Employee


def load_recipient_ids(value):
    """Read a JSON-list column into a list of ints. Tolerant of bad data."""
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        return []
    if not isinstance(parsed, list):
        return []
    out = []
    for item in parsed:
        try:
            out.append(int(item))
        except (TypeError, ValueError):
            continue
    return list(dict.fromkeys(out))


def dump_recipient_ids(values):
    return json.dumps(list(values or []))


def recipient_employee_ids(audience, department_id=None, branch_id=None, recipient_ids=None):
    """Resolve an announcement/memo audience into concrete employee ids.

    Returns ``None`` for ``audience == 'all'`` so callers can skip the filter
    entirely instead of materialising the whole company.
    """
    if audience == 'department' and department_id:
        return {e.id for e in Employee.query.filter_by(department_id=department_id).all()}
    if audience == 'branch' and branch_id:
        return {e.id for e in Employee.query.filter_by(branch_id=branch_id).all()}
    if audience == 'custom':
        return set(load_recipient_ids(recipient_ids))
    return None


def expected_recipients(audience, department_id=None, branch_id=None, recipient_ids=None,
                        exclude_ids=None):
    """Like :func:`recipient_employee_ids`, minus a set of employee ids.

    Used to keep Service Agents out of a broadcast raised by a coordinator who
    cannot see them in the first place.
    """
    ids = recipient_employee_ids(audience, department_id, branch_id, recipient_ids)
    if ids is None or not exclude_ids:
        return ids
    return ids - set(exclude_ids)