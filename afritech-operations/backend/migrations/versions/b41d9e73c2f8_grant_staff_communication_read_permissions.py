"""grant the staff-communication read family to Service Agents and Accountants

Revision ID: b41d9e73c2f8
Revises: 03e60c5ab9dd
Create Date: 2026-10-02 21:00:00.000000

``service_agent`` was the only system role missing ``announcements.view`` (403
from ``GET /api/announcements`` and no menu entry) and it also lacked
``memos.view``, ``documents.view``, ``meetings.view``, ``calendar.view`` and
``requests.view``; ``accountant`` lacked ``meetings.view`` and ``leave.view``.
Every system role is supposed to hold ``STAFF_COMMUNICATION_PERMISSIONS`` —
the read paths shared by the whole company.

Insert-only and idempotent: a database that already has a link (for example one
seeded by ``flask seed-dev`` from the updated ROLE_PERMISSIONS catalogue) is
left untouched.  Downgrade removes exactly the links this revision adds and
nothing else.
"""

from alembic import op


revision = 'b41d9e73c2f8'
down_revision = '03e60c5ab9dd'
branch_labels = None
depends_on = None


# (role code, permission code) pairs this revision introduces. The catalogue in
# app/auth/permissions.py is the source of truth and tests keep it complete;
# this table only states what production must gain, so downgrade stays exact.
DELTA = [
    ('service_agent', 'announcements.view'),
    ('service_agent', 'memos.view'),
    ('service_agent', 'documents.view'),
    ('service_agent', 'meetings.view'),
    ('service_agent', 'calendar.view'),
    ('service_agent', 'requests.view'),
    ('accountant', 'meetings.view'),
    ('accountant', 'leave.view'),
]


def upgrade():
    for role_code, perm_code in DELTA:
        op.execute(f"""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            JOIN permissions p ON p.code = '{perm_code}'
            WHERE r.code = '{role_code}'
              AND NOT EXISTS (
                  SELECT 1 FROM role_permissions rp
                  WHERE rp.role_id = r.id AND rp.permission_id = p.id
              )
        """)


def downgrade():
    for role_code, perm_code in DELTA:
        op.execute(f"""
            DELETE FROM role_permissions
            WHERE role_id = (SELECT id FROM roles WHERE code = '{role_code}')
              AND permission_id = (SELECT id FROM permissions WHERE code = '{perm_code}')
        """)
