"""Weekly permission family must travel with the schema migration.

`flask seed-permissions-roles` is a development convenience, not the production
upgrade path. This module exercises the insert-only permission seeding in
``f7c9a4d2e8b1`` against a throwaway SQLite schema, exactly the shape an older
installation has before the migration runs.
"""
import importlib.util
import pathlib

import pytest
import sqlalchemy as sa

from app.auth.permissions import (
    ACCOUNTANT_WEEKLY_PERMISSIONS, AGENT_WEEKLY_PERMISSIONS,
    MANAGER_WEEKLY_PERMISSIONS, WEEKLY_FINANCIAL_PERMISSIONS,
)
from app.extensions import db

MIGRATIONS_DIR = pathlib.Path(__file__).resolve().parents[1] / 'migrations' / 'versions'


@pytest.fixture()
def migration():
    path = next(MIGRATIONS_DIR.glob('f7c9a4d2e8b1_*.py'))
    spec = importlib.util.spec_from_file_location(
        'weekly_financial_reports', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture()
def engine(tmp_path):
    eng = sa.create_engine(f'sqlite:///{tmp_path}/weekly_permissions.db')
    db.metadata.create_all(eng)
    with eng.begin() as conn:
        for code, name in (
            ('super_admin', 'Super Admin'), ('manager', 'Manager'),
            ('service_agent', 'Service Agent'), ('accountant', 'Accountant'),
            ('company_secretary', 'Company Secretary'),
        ):
            conn.execute(sa.text(
                'INSERT INTO roles (code, name, is_active, is_system, created_at, updated_at) '
                'VALUES (:code, :name, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'),
                {'code': code, 'name': name})
        # An unrelated pre-existing permission must survive both directions.
        conn.execute(sa.text(
            'INSERT INTO permissions (code, name, created_at, updated_at) '
            "VALUES ('users.view', 'View Users', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"))
    yield eng
    eng.dispose()


def _seed(engine, migration):
    with engine.begin() as conn:
        migration._seed_weekly_permissions(conn)


def _remove(engine, migration):
    with engine.begin() as conn:
        migration._remove_weekly_permissions(conn)


def _codes(engine):
    with engine.connect() as conn:
        return {row[0] for row in conn.execute(sa.text('SELECT code FROM permissions'))}


def _links(engine, role_code):
    with engine.connect() as conn:
        return {row[0] for row in conn.execute(sa.text(
            'SELECT p.code FROM role_permissions rp '
            'JOIN roles r ON r.id = rp.role_id '
            'JOIN permissions p ON p.id = rp.permission_id '
            'WHERE r.code = :code'), {'code': role_code})}


def _count(engine, table):
    with engine.connect() as conn:
        return conn.execute(sa.text(f'SELECT COUNT(*) FROM "{table}"')).scalar()


class TestWeeklyPermissionMigration:
    def test_catalogue_matches_application_source_of_truth(self, migration):
        assert {code for code, _, _ in migration.WEEKLY_PERMISSIONS} == \
            set(WEEKLY_FINANCIAL_PERMISSIONS)
        assert set(migration.ROLE_GRANTS['super_admin']) == set(WEEKLY_FINANCIAL_PERMISSIONS)
        assert set(migration.ROLE_GRANTS['manager']) == set(MANAGER_WEEKLY_PERMISSIONS)
        assert set(migration.ROLE_GRANTS['service_agent']) == set(AGENT_WEEKLY_PERMISSIONS)
        assert set(migration.ROLE_GRANTS['accountant']) == set(ACCOUNTANT_WEEKLY_PERMISSIONS)
        assert 'company_secretary' not in migration.ROLE_GRANTS

    def test_grants_reach_existing_installations(self, engine, migration):
        _seed(engine, migration)
        weekly = set(WEEKLY_FINANCIAL_PERMISSIONS)

        assert weekly <= _codes(engine)
        assert _links(engine, 'super_admin') == weekly
        assert _links(engine, 'manager') == set(MANAGER_WEEKLY_PERMISSIONS)
        assert _links(engine, 'service_agent') == set(AGENT_WEEKLY_PERMISSIONS)
        assert _links(engine, 'accountant') == set(ACCOUNTANT_WEEKLY_PERMISSIONS)
        assert not (_links(engine, 'company_secretary') & weekly)
        assert 'users.view' in _codes(engine)

    def test_seeding_is_idempotent(self, engine, migration):
        _seed(engine, migration)
        before = {name: _count(engine, name) for name in ('permissions', 'role_permissions')}

        _seed(engine, migration)

        assert before == {name: _count(engine, name)
                          for name in ('permissions', 'role_permissions')}

    def test_downgrade_removes_only_the_weekly_family(self, engine, migration):
        _seed(engine, migration)
        _remove(engine, migration)

        assert not (_codes(engine) & set(WEEKLY_FINANCIAL_PERMISSIONS))
        assert 'users.view' in _codes(engine)
        assert all(not (_links(engine, role) & set(WEEKLY_FINANCIAL_PERMISSIONS))
                   for role in ('super_admin', 'manager', 'service_agent', 'accountant'))
