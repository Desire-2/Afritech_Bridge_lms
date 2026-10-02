"""The production seed migration must bootstrap a usable database.

`flask db upgrade` (README → Deployment) is the production path, and it never
runs `flask seed-dev` — which is refused on non-SQLite databases anyway. So the
permission catalogue, every system role (Company Secretary included), their
role/permission links and the first branches have to arrive through the
`03e60c5ab9dd` migration.

These tests run its upgrade/downgrade bodies against throwaway engines:
insert-only (re-running changes nothing), and in step with the catalogue in
`app.auth.permissions` so the migration cannot drift from the code.
"""
import importlib.util
import pathlib

import pytest
import sqlalchemy as sa

from app.extensions import db
from app.auth.permissions import (
    ADMINISTRATIVE_PERMISSIONS, OPERATIONAL_SERVICE_PERMISSIONS,
    PERMISSIONS, ROLE_PERMISSIONS, SYSTEM_ROLES,
)
from app.auth.permissions import seed_permissions_and_roles

MIGRATIONS_DIR = pathlib.Path(__file__).resolve().parents[1] / 'migrations' / 'versions'


def _load_migration():
    path = next(MIGRATIONS_DIR.glob('03e60c5ab9dd_*.py'))
    spec = importlib.util.spec_from_file_location(
        'seed_roles_permissions_and_branches', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture()
def migration():
    return _load_migration()


@pytest.fixture()
def engine(tmp_path):
    """An empty schema — what a first `flask db upgrade` starts from."""
    eng = sa.create_engine(f'sqlite:///{tmp_path}/seed.db')
    db.metadata.create_all(eng)
    yield eng
    eng.dispose()


def _upgrade(engine, migration):
    with engine.begin() as conn:
        migration._upgrade(conn)


def _downgrade(engine, migration):
    with engine.begin() as conn:
        migration._downgrade(conn)


def _table(engine, name, columns='*'):
    with engine.connect() as conn:
        return [tuple(r) for r in conn.execute(
            sa.text(f'SELECT {columns} FROM "{name}"'))]


def _count(engine, table):
    return len(_table(engine, table))


def _codes(engine, table='permissions'):
    return {r[0] for r in _table(engine, table, 'code')}


def _app_count(table):
    # No `with`: the session owns this connection and closes it at teardown.
    return db.session.connection().execute(
        sa.text(f'SELECT COUNT(*) FROM "{table}"')).scalar()


def _role_codes(engine):
    return {r[0] for r in _table(engine, 'roles', 'code')}


def _links(engine, role_code):
    with engine.connect() as conn:
        return {r[0] for r in conn.execute(sa.text(
            'SELECT p.code FROM role_permissions rp '
            'JOIN roles r ON r.id = rp.role_id '
            'JOIN permissions p ON p.id = rp.permission_id '
            'WHERE r.code = :code'), {'code': role_code})}


class TestUpgrade:
    def test_bootstraps_the_full_catalogue(self, engine, migration):
        _upgrade(engine, migration)

        assert _count(engine, 'permissions') == len(PERMISSIONS)
        assert _role_codes(engine) == set(SYSTEM_ROLES)
        assert _count(engine, 'branches') == 3

    def test_secretary_role_gets_its_permissions_and_no_money(self, engine, migration):
        _upgrade(engine, migration)

        links = _links(engine, 'company_secretary')
        expected = set(ADMINISTRATIVE_PERMISSIONS) | set(OPERATIONAL_SERVICE_PERMISSIONS)
        assert links == expected
        for financial in ('payroll.view', 'closings.view', 'expenses.view',
                          'reports.view', 'transactions.view',
                          'transactions.view_all'):
            assert financial not in links

    def test_existing_roles_gain_the_new_codes(self, engine, migration):
        _upgrade(engine, migration)

        assert {'leave.view', 'tasks.assign', 'attendance.overview',
                'announcements.view'} <= _links(engine, 'manager')
        assert 'leave.view' in _links(engine, 'service_agent')
        assert 'memos.view' in _links(engine, 'accountant')
        # Every pre-existing permission stays reachable from super admin.
        assert _links(engine, 'super_admin') == {c for c, _, _ in PERMISSIONS}

    def test_is_idempotent(self, engine, migration):
        _upgrade(engine, migration)
        first = {name: _count(engine, name)
                 for name in ('permissions', 'roles', 'role_permissions', 'branches')}

        _upgrade(engine, migration)

        second = {name: _count(engine, name)
                  for name in ('permissions', 'roles', 'role_permissions', 'branches')}
        assert first == second
        assert len(_codes(engine)) == _count(engine, 'permissions'), 'duplicate permission codes'

    def test_leaves_existing_branches_alone(self, engine, migration):
        with engine.begin() as conn:
            conn.execute(sa.text(
                'INSERT INTO branches (id, name, code, city, is_active, created_at, updated_at) '
                "VALUES (1, 'Kigali Central', 'KGC', 'Kigali', 1, '2026-01-01', '2026-01-01')"))

        _upgrade(engine, migration)

        assert [r[1] for r in _table(engine, 'branches', 'id, code')] == ['KGC']


class TestDowngrade:
    def test_removes_exactly_what_upgrade_added(self, engine, migration):
        # Stand in for an installation that predates the feature: one permission
        # row and one branch it chose itself.
        with engine.begin() as conn:
            conn.execute(sa.text(
                'INSERT INTO branches (id, name, code, city, is_active, created_at, updated_at) '
                "VALUES (1, 'Kigali Central', 'KGC', 'Kigali', 1, '2026-01-01', '2026-01-01')"))
            conn.execute(sa.text(
                'INSERT INTO permissions (code, name, created_at, updated_at) '
                "VALUES ('payroll.view', 'View Payroll', '2026-01-01', '2026-01-01')"))
        before_permissions = _codes(engine)
        _upgrade(engine, migration)
        assert _role_codes(engine) == set(SYSTEM_ROLES)
        assert _codes(engine) >= before_permissions

        _downgrade(engine, migration)

        catalogue = {c for c, _, _ in PERMISSIONS}
        assert 'company_secretary' not in _role_codes(engine)
        assert not _codes(engine) & set(migration.NEW_PERMISSION_CODES)
        # Everything that existed before this revision survives: the row the
        # installation had, plus the rest of the pre-feature catalogue.
        assert _codes(engine) == before_permissions | (
            catalogue - set(migration.NEW_PERMISSION_CODES))
        # The installation's own branch survives; only ours are candidates.
        assert [r[1] for r in _table(engine, 'branches', 'id, code')] == ['KGC']

    def test_seeded_branches_go_away_when_unreferenced(self, engine, migration):
        _upgrade(engine, migration)
        assert _count(engine, 'branches') == 3

        _downgrade(engine, migration)

        assert _count(engine, 'branches') == 0

    def test_keeps_branches_that_employees_use(self, engine, migration):
        _upgrade(engine, migration)
        with engine.begin() as conn:
            conn.execute(sa.text(
                'INSERT INTO employees (employee_number, first_name, last_name, branch_id, '
                "status, salary_type, created_at, updated_at) "
                "VALUES ('EMP-00001', 'Aline', 'Uwase', 1, 'active', 'fixed', "
                "'2026-01-01', '2026-01-01')"))

        _downgrade(engine, migration)

        # HQ is referenced by the employee and stays; the two unused ones go.
        assert [r[1] for r in _table(engine, 'branches', 'id, code')] == ['HQ'], \
            'a branch in use must not be deleted'


class TestCatalogueAgreement:
    def test_new_permission_codes_exist_in_the_catalogue(self, migration):
        codes = {c for c, _, _ in PERMISSIONS}
        assert set(migration.NEW_PERMISSION_CODES) <= codes

    def test_role_permission_keys_are_system_roles(self):
        assert set(ROLE_PERMISSIONS) <= set(SYSTEM_ROLES)
        assert 'company_secretary' in ROLE_PERMISSIONS

    def test_branch_seeds_match_the_development_seed(self, migration):
        from app.seeds import BRANCH_SEEDS
        assert [tuple(row) for row in migration.BRANCH_SEEDS] == BRANCH_SEEDS

    def test_is_a_no_op_on_a_database_the_app_already_seeded(self, migration):
        """`flask db upgrade` over a seed-dev database must change nothing."""
        seed_permissions_and_roles()

        def snapshot():
            return {
                'permissions': _app_count('permissions'),
                'roles': _app_count('roles'),
                'links': _app_count('role_permissions'),
                'branches': _app_count('branches'),
            }

        before = snapshot()
        # Same connection as the session, so no second SQLite connection fights
        # for the write lock — and the run is a no-op anyway.
        migration._upgrade(db.session.connection())
        assert snapshot() == before
        assert _app_count('branches') >= 1
