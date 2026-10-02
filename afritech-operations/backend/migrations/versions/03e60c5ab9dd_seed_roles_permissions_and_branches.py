"""seed system roles, permission catalogue and default branches (production)

Revision ID: 03e60c5ab9dd
Revises: 8db0b7b9269d
Create Date: 2026-10-02 00:00:00.000000

Production is bootstrapped with ``flask db upgrade`` (see README → Deployment)
and never with ``flask seed-dev``, which refuses to touch a non-SQLite
database.  Everything that belongs to the product rather than to the demo data
must therefore arrive through a migration:

* the permission catalogue (including the codes the Company Secretary needs);
* every system role, including the new ``company_secretary`` role;
* the role → permission links for those roles, so an installation upgraded from
  an older release gains the new permissions instead of silently missing them;
* the first branches, when the installation has none yet.

Upgrade is insert-only and idempotent: rows are added only when absent, so a
database that already ran ``flask seed-permissions-roles`` (or
``flask seed-dev``) is left exactly as it is.  Nothing is ever deleted here.

Downgrade removes only what this revision introduced: the Company Secretary
role, the permission codes added together with it, the links pointing at them,
and the seeded branches that no row references any more.

The catalogue is imported from ``app.auth.permissions`` rather than copied, so
the migration cannot drift from the code that defines it.
"""

from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '03e60c5ab9dd'
down_revision = '8db0b7b9269d'
branch_labels = None
depends_on = None


# Permission codes introduced together with the Company Secretary role.  Used
# only by downgrade(): they did not exist before this revision, so they are the
# only permission rows this revision is allowed to remove.
NEW_PERMISSION_CODES = (
    'transactions.operational',
    'attendance.overview',
    'leave.view', 'leave.manage',
    'tasks.assign', 'tasks.verify',
    'reports.operational',
    'meetings.view', 'meetings.manage',
    'activities.view', 'activities.manage',
    'calendar.view', 'calendar.manage',
    'announcements.view', 'announcements.manage',
    'memos.view', 'memos.manage',
    'documents.view', 'documents.manage',
    'requests.view', 'requests.manage',
    'followups.view', 'followups.manage',
    'escalations.view', 'escalations.manage',
)

SECRETARY_ROLE_CODE = 'company_secretary'

# (name, code, city) — the same three branches the development seed creates, so
# a fresh production install and a fresh dev install start from one shape.
BRANCH_SEEDS = (
    ('Head Office', 'HQ', 'Kigali'),
    ('Musanze Branch', 'MSZ', 'Musanze'),
    ('Kigali Branch', 'KGL', 'Kigali'),
)

_permissions = sa.table(
    'permissions',
    sa.column('id', sa.Integer),
    sa.column('code', sa.String),
    sa.column('name', sa.String),
    sa.column('description', sa.String),
    sa.column('created_at', sa.DateTime),
    sa.column('updated_at', sa.DateTime),
)

_roles = sa.table(
    'roles',
    sa.column('id', sa.Integer),
    sa.column('code', sa.String),
    sa.column('name', sa.String),
    sa.column('description', sa.String),
    sa.column('is_active', sa.Boolean),
    sa.column('is_system', sa.Boolean),
    sa.column('created_at', sa.DateTime),
    sa.column('updated_at', sa.DateTime),
)

_role_permissions = sa.table(
    'role_permissions',
    sa.column('role_id', sa.Integer),
    sa.column('permission_id', sa.Integer),
)

_branches = sa.table(
    'branches',
    sa.column('id', sa.Integer),
    sa.column('name', sa.String),
    sa.column('code', sa.String),
    sa.column('city', sa.String),
    sa.column('is_active', sa.Boolean),
    sa.column('created_at', sa.DateTime),
    sa.column('updated_at', sa.DateTime),
)


def _catalogue():
    """Single source of truth for permissions, roles and their links."""
    from app.auth.permissions import PERMISSIONS, ROLE_PERMISSIONS, SYSTEM_ROLES
    return PERMISSIONS, ROLE_PERMISSIONS, SYSTEM_ROLES


def _seed_permissions(bind, permissions, now):
    existing = {row[0] for row in bind.execute(sa.select(_permissions.c.code))}
    missing = [
        dict(code=code, name=name, description=description,
             created_at=now, updated_at=now)
        for code, name, description in permissions if code not in existing
    ]
    if missing:
        bind.execute(_permissions.insert(), missing)
    return {
        code: pk
        for code, pk in bind.execute(sa.select(_permissions.c.code, _permissions.c.id))
    }


def _seed_roles(bind, system_roles, now):
    missing = [
        dict(code=code, name=name, description=f'{name} role',
             is_active=True, is_system=True, created_at=now, updated_at=now)
        for code, name in system_roles.items()
        if bind.execute(
            sa.select(sa.func.count()).select_from(_roles).where(_roles.c.code == code)
        ).scalar() == 0
    ]
    if missing:
        bind.execute(_roles.insert(), missing)
    # A system role is never allowed to ship deactivated.
    bind.execute(
        _roles.update()
        .where(_roles.c.code.in_(list(system_roles)))
        .values(is_active=True, is_system=True)
    )
    return {
        code: pk
        for code, pk in bind.execute(sa.select(_roles.c.code, _roles.c.id))
    }


def _seed_role_permissions(bind, role_ids, permission_ids, role_permissions,
                           system_roles):
    existing = {
        (role_id, permission_id)
        for role_id, permission_id in bind.execute(
            sa.select(_role_permissions.c.role_id, _role_permissions.c.permission_id)
        )
    }
    rows = []
    for code, role_id in role_ids.items():
        if code == 'super_admin':
            wanted = set(permission_ids.values())
        elif code in system_roles:
            codes = role_permissions.get(code) or []
            wanted = {permission_ids[c] for c in dict.fromkeys(codes)
                      if c in permission_ids}
        else:
            continue
        rows.extend(
            dict(role_id=role_id, permission_id=permission_id)
            for permission_id in sorted(wanted)
            if (role_id, permission_id) not in existing
        )
    if rows:
        bind.execute(_role_permissions.insert(), rows)


def _seed_branches(bind, now):
    """Give a brand-new installation its first branches.

    Only when the table is empty: an installation that already picked its own
    branches must not gain a Head Office it never asked for.
    """
    if bind.execute(sa.select(sa.func.count()).select_from(_branches)).scalar():
        return
    bind.execute(_branches.insert(), [
        dict(name=name, code=code, city=city, is_active=True,
             created_at=now, updated_at=now)
        for name, code, city in BRANCH_SEEDS
    ])


def _delete_unreferenced_seeded_branches(bind):
    inspector = sa.inspect(bind)
    referencing = [
        table
        for table in inspector.get_table_names()
        if table != 'branches'
        and any(col['name'] == 'branch_id' for col in inspector.get_columns(table))
    ]
    seeded_codes = [code for _, code, _ in BRANCH_SEEDS]
    for (branch_id,) in bind.execute(
        sa.select(_branches.c.id).where(_branches.c.code.in_(seeded_codes))
    ):
        used = any(
            bind.execute(
                sa.text(f'SELECT COUNT(*) FROM "{table}" WHERE branch_id = :branch_id'),
                {'branch_id': branch_id},
            ).scalar()
            for table in referencing
        )
        if not used:
            bind.execute(_branches.delete().where(_branches.c.id == branch_id))


def _upgrade(bind):
    permissions, role_permissions, system_roles = _catalogue()
    now = datetime.now(timezone.utc)

    permission_ids = _seed_permissions(bind, permissions, now)
    role_ids = _seed_roles(bind, system_roles, now)
    _seed_role_permissions(bind, role_ids, permission_ids, role_permissions,
                           system_roles)
    _seed_branches(bind, now)


def _downgrade(bind):
    secretary_id = bind.execute(
        sa.select(_roles.c.id).where(_roles.c.code == SECRETARY_ROLE_CODE)
    ).scalar()
    if secretary_id is not None:
        bind.execute(_role_permissions.delete().where(
            _role_permissions.c.role_id == secretary_id))
        bind.execute(_roles.delete().where(_roles.c.id == secretary_id))

    permission_ids = [
        pk for pk, in bind.execute(
            sa.select(_permissions.c.id).where(
                _permissions.c.code.in_(NEW_PERMISSION_CODES))
        )
    ]
    if permission_ids:
        bind.execute(_role_permissions.delete().where(
            _role_permissions.c.permission_id.in_(permission_ids)))
        bind.execute(_permissions.delete().where(
            _permissions.c.id.in_(permission_ids)))

    _delete_unreferenced_seeded_branches(bind)


def upgrade():
    _upgrade(op.get_bind())


def downgrade():
    _downgrade(op.get_bind())
