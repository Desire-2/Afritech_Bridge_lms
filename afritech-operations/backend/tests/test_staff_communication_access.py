"""Every system role holds the whole staff-communication read family.

Regression: ``service_agent`` was missing ``announcements.view`` (403 from
``GET /api/announcements``, no menu entry) plus ``memos.view``,
``documents.view``, ``meetings.view``, ``calendar.view`` and ``requests.view``,
and ``accountant`` was missing ``meetings.view`` and ``leave.view`` — so whole
corners of the shared company workspace were closed off to those roles while
everyone else read them fine.

Three layers are guarded: the ROLE_PERMISSIONS catalogue, the roles actually
seeded into the database, and the real HTTP answer of each list endpoint for
each role.
"""

import pytest

from app.models import Role
from app.auth.permissions import (
    ROLE_PERMISSIONS,
    STAFF_COMMUNICATION_PERMISSIONS as FAMILY,
    SYSTEM_ROLES,
)
from tests.conftest import auth_header, login

ROLE_ACCOUNTS = [
    ('super_admin', 'admin@afritech.dev'),
    ('manager', 'manager@afritech.dev'),
    ('service_agent', 'agent@afritech.dev'),
    ('instructor', 'instructor@afritech.dev'),
    ('accountant', 'accountant@afritech.dev'),
    ('company_secretary', 'secretary@afritech.dev'),
]

# permission code -> (read-only list endpoint, payload key holding the rows)
LIST_ENDPOINTS = {
    'announcements.view': ('/api/announcements', 'items'),
    'memos.view': ('/api/memos', 'items'),
    'documents.view': ('/api/documents', 'items'),
    'meetings.view': ('/api/meetings', 'items'),
    'calendar.view': ('/api/calendar', 'days'),
    'requests.view': ('/api/requests', 'items'),
    'leave.view': ('/api/leave', 'items'),
}


class TestCatalogueInvariant:
    def test_every_role_holds_the_whole_family(self):
        assert set(LIST_ENDPOINTS) == set(FAMILY), 'LIST_ENDPOINTS drifted from the family'
        for code in SYSTEM_ROLES:
            role = Role.query.filter_by(code=code).first()
            assert role is not None, f'seeded database is missing role {code}'
            held = {p.code for p in role.permissions}
            missing = sorted(set(FAMILY) - held)
            assert not missing, f'{code} is missing {missing}'

    def test_role_permission_lists_hold_the_family(self):
        """The catalogue itself, before seeding — super_admin gets every code."""
        for code in SYSTEM_ROLES:
            if code == 'super_admin':
                continue
            missing = sorted(set(FAMILY) - set(ROLE_PERMISSIONS.get(code, [])))
            assert not missing, f'ROLE_PERMISSIONS[{code!r}] is missing {missing}'

    def test_family_is_read_only(self):
        """Participation rights never carry a write suffix."""
        assert all(code.endswith('.view') for code in FAMILY)

    def test_read_access_does_not_smuggle_manage(self):
        """Landing a ``.manage`` right for the same feature is a privilege bug."""
        family_stems = {code.split('.')[0] for code in FAMILY}
        for code, _email in ROLE_ACCOUNTS:
            if code in ('super_admin', 'manager', 'company_secretary'):
                # Administrative roles own the family by design.
                continue
            held = {p.code for p in Role.query.filter_by(code=code).first().permissions}
            leaked = sorted(
                c for c in held
                if c.split('.')[0] in family_stems and not c.endswith('.view'))
            assert not leaked, f'{code} can administer what it should only read: {leaked}'


@pytest.mark.parametrize('role,email', ROLE_ACCOUNTS)
def test_role_can_list_every_communication_endpoint(client, role, email):
    hdr = auth_header(login(client, email))
    for perm, (path, key) in LIST_ENDPOINTS.items():
        r = client.get(path, headers=hdr)
        assert r.status_code == 200, (
            f'{role} cannot read {path} ({perm}): '
            f'{r.status_code} {r.get_data(as_text=True)}')
        assert key in r.get_json(), f'{path} did not return a "{key}" payload'
