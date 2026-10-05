"""electronics shop module: shop tables, shop permissions and shop roles

Revision ID: c7f3a9d21b45
Revises: b41d9e73c2f8
Create Date: 2026-10-03 00:00:00.000000

The electronics shop is a self-contained retail module inside the operations
app.  A production installation reaches it through ``flask db upgrade``, which
never runs ``flask seed-dev``, so everything the module needs has to arrive
here:

* every ``shop_*`` table (catalogue, inventory ledger, purchasing, sales,
  returns, warranty, shifts and closings) — created from the SQLAlchemy
  metadata so the schema cannot drift from the models;
* the shop permission codes, the three shop roles (``shop_manager``,
  ``shop_attendant``, ``storekeeper``) and their role → permission links,
  including the links the roles ``manager`` and ``accountant`` gained.

Permission seeding is insert-only and idempotent: an installation that already
ran a newer seed (or ``flask seed-dev``) is left exactly as it is.  The
catalogue is imported from ``app.auth.permissions`` rather than copied, so this
migration cannot drift from the code.

Downgrade drops the shop tables and removes only what this revision added:
the shop permission codes, the shop roles (when no user still holds one) and
the links pointing at them.
"""

from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


revision = 'c7f3a9d21b45'
down_revision = 'b41d9e73c2f8'
branch_labels = None
depends_on = None


# Permission codes introduced with this module.  Only these rows are ever
# removed by downgrade().
def _shop_permission_codes():
    from app.auth.permissions import SHOP_PERMISSIONS
    return tuple(code for code, _, _ in SHOP_PERMISSIONS)


SHOP_ROLE_CODES = ('shop_manager', 'shop_attendant', 'storekeeper')

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


def _catalogue():
    from app.auth.permissions import PERMISSIONS, ROLE_PERMISSIONS, SYSTEM_ROLES
    return PERMISSIONS, ROLE_PERMISSIONS, SYSTEM_ROLES


def _shop_tables():
    """Every table owned by the shop module, in metadata order."""
    from app.extensions import db
    from app import models  # noqa: F401  (populates db.metadata)
    return [table for name, table in db.metadata.tables.items()
            if name.startswith('shop_')]


def _create_shop_tables(bind):
    from app.extensions import db
    db.metadata.create_all(bind, tables=_shop_tables(), checkfirst=True)


def _drop_shop_tables(bind):
    from app.extensions import db
    db.metadata.drop_all(bind, tables=_shop_tables(), checkfirst=True)


def _seed_permissions(bind, now):
    """Insert the shop permission codes that are still missing."""
    permissions, role_permissions, system_roles = _catalogue()
    wanted = [row for row in permissions
              if row[0] in set(_shop_permission_codes())]
    existing = {code for code, in bind.execute(
        sa.select(_permissions.c.code))}
    missing = [
        dict(code=code, name=name, description=description,
             created_at=now, updated_at=now)
        for code, name, description in wanted if code not in existing
    ]
    if missing:
        bind.execute(_permissions.insert(), missing)
    return {code: pk for code, pk in bind.execute(
        sa.select(_permissions.c.code, _permissions.c.id))}


def _seed_roles(bind, now):
    permissions, role_permissions, system_roles = _catalogue()
    missing = [
        dict(code=code, name=name, description=f'{name} role',
             is_active=True, is_system=True, created_at=now, updated_at=now)
        for code, name in system_roles.items() if code in SHOP_ROLE_CODES
        and bind.execute(
            sa.select(sa.func.count()).select_from(_roles)
            .where(_roles.c.code == code)).scalar() == 0
    ]
    if missing:
        bind.execute(_roles.insert(), missing)
    return {code: pk for code, pk in bind.execute(
        sa.select(_roles.c.code, _roles.c.id))}


def _seed_role_permissions(bind, role_ids, permission_ids):
    """Give every role its shop links — including super admin and the roles
    that already existed before this module shipped."""
    permissions, role_permissions, system_roles = _catalogue()
    shop_codes = set(_shop_permission_codes())
    existing = {
        (role_id, permission_id)
        for role_id, permission_id in bind.execute(
            sa.select(_role_permissions.c.role_id, _role_permissions.c.permission_id))
    }
    rows = []
    for code, role_id in role_ids.items():
        if code == 'super_admin':
            wanted = {permission_ids[c] for c in shop_codes
                      if c in permission_ids}
        elif code in system_roles:
            codes = role_permissions.get(code) or []
            wanted = {permission_ids[c] for c in dict.fromkeys(codes)
                      if c in permission_ids and c in shop_codes}
        else:
            continue
        rows.extend(
            dict(role_id=role_id, permission_id=permission_id)
            for permission_id in sorted(wanted)
            if (role_id, permission_id) not in existing)
    if rows:
        bind.execute(_role_permissions.insert(), rows)


def _upgrade(bind):
    _create_shop_tables(bind)
    now = datetime.now(timezone.utc)
    permission_ids = _seed_permissions(bind, now)
    role_ids = _seed_roles(bind, now)
    _seed_role_permissions(bind, role_ids, permission_ids)


def _downgrade(bind):
    shop_codes = set(_shop_permission_codes())

    # Links first: they point at rows both sides are about to lose.
    permission_ids = [pk for pk, in bind.execute(
        sa.select(_permissions.c.id).where(_permissions.c.code.in_(shop_codes)))]
    if permission_ids:
        bind.execute(_role_permissions.delete().where(
            _role_permissions.c.permission_id.in_(permission_ids)))
        bind.execute(_permissions.delete().where(
            _permissions.c.id.in_(permission_ids)))

    # A role a user still holds must not be yanked out from under them.
    inspector = sa.inspect(bind)
    user_roles = ('user_roles' if 'user_roles' in inspector.get_table_names()
                  else None)
    for code in SHOP_ROLE_CODES:
        role_id = bind.execute(
            sa.select(_roles.c.id).where(_roles.c.code == code)).scalar()
        if role_id is None:
            continue
        in_use = False
        if user_roles:
            in_use = bool(bind.execute(
                sa.text(f'SELECT COUNT(*) FROM "{user_roles}" WHERE role_id = :id'),
                {'id': role_id}).scalar())
        if not in_use:
            bind.execute(_role_permissions.delete().where(
                _role_permissions.c.role_id == role_id))
            bind.execute(_roles.delete().where(_roles.c.id == role_id))

    _drop_shop_tables(bind)


def upgrade():
    _upgrade(op.get_bind())


def downgrade():
    _downgrade(op.get_bind())
