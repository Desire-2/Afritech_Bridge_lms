"""Weekly migrations must travel with the application, not only with seeding.

`flask seed-permissions-roles` is a development convenience, not the production
upgrade path. These tests exercise the insert-only permission seeding in
``f7c9a4d2e8b1`` and the Sunday–Saturday repair in ``c2f8a7d41b90`` against
throwaway SQLite schemas that resemble an older installation.
"""
import importlib.util
import pathlib
from datetime import date

import pytest
import sqlalchemy as sa

from app.auth.permissions import (
    ACCOUNTANT_WEEKLY_PERMISSIONS, AGENT_WEEKLY_PERMISSIONS,
    MANAGER_WEEKLY_PERMISSIONS, WEEKLY_FINANCIAL_PERMISSIONS,
)
from app.extensions import db

MIGRATIONS_DIR = pathlib.Path(__file__).resolve().parents[1] / 'migrations' / 'versions'


def _load_migration(revision):
    path = next(MIGRATIONS_DIR.glob(f'{revision}_*.py'))
    spec = importlib.util.spec_from_file_location(f'weekly_migration_{revision}', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture()
def migration():
    return _load_migration('f7c9a4d2e8b1')


@pytest.fixture()
def sunday_migration():
    return _load_migration('c2f8a7d41b90')


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


@pytest.fixture()
def legacy_sunday_engine(tmp_path):
    eng = sa.create_engine(f'sqlite:///{tmp_path}/weekly_sunday.db')
    with eng.begin() as conn:
        conn.execute(sa.text(
            'CREATE TABLE settings (id INTEGER PRIMARY KEY, key VARCHAR(128), value TEXT, '
            'value_type VARCHAR(16), "group" VARCHAR(64), created_at DATETIME, updated_at DATETIME)'))
        conn.execute(sa.text(
            'CREATE TABLE weekly_reports (id INTEGER PRIMARY KEY, employee_id INTEGER, '
            'week_start DATE, week_end DATE, due_at DATETIME, timezone_name VARCHAR(64), '
            'period_label VARCHAR(128), status VARCHAR(32), calculation TEXT, snapshot TEXT)'))
        conn.execute(sa.text(
            'CREATE TABLE audit_logs (id INTEGER PRIMARY KEY, user_id INTEGER, '
            'action VARCHAR(64), entity VARCHAR(64), entity_id VARCHAR(64), '
            'previous_value TEXT, new_value TEXT, reason TEXT, created_at DATETIME)'))
        for key, value in (
            ('weekly_reporting.week_start_weekday', '5'),
            ('weekly_reporting.week_end_weekday', '4'),
            ('weekly_reporting.submission_weekday', '5'),
        ):
            conn.execute(sa.text(
                'INSERT INTO settings (key, value, value_type, "group") '
                'VALUES (:key, :value, :kind, :group)'),
                {'key': key, 'value': value, 'kind': 'string', 'group': 'weekly_reporting'})
        # Saturday starts under the old policy. Only editable rows may move.
        legacy = date(2031, 1, 11)
        prior = date(2031, 1, 4)
        rows = (
            (1, legacy, legacy.replace(day=17), 'draft', None, None),
            (2, legacy, legacy.replace(day=17), 'ready_for_submission', None, None),
            (3, prior, date(2031, 1, 10), 'submitted', '{"paid":true}', '{"paid":true}'),
            (4, prior, date(2031, 1, 10), 'approved', '{"approved":true}', '{"approved":true}'),
            (5, date(2031, 1, 12), date(2031, 1, 18), 'draft', None, None),
        )
        for report_id, start, end, status, calculation, snapshot in rows:
            conn.execute(sa.text(
                'INSERT INTO weekly_reports (id, employee_id, week_start, week_end, due_at, '
                'timezone_name, period_label, status, calculation, snapshot) '
                'VALUES (:id, 9, :start, :end, :due, :tz, :label, :status, :calc, :snap)'),
                {'id': report_id, 'start': start.isoformat(), 'end': end.isoformat(),
                 'due': '2031-01-11 15:00:00', 'tz': 'Africa/Kigali',
                 'label': f'{start.isoformat()} – {end.isoformat()}', 'status': status,
                 'calc': calculation, 'snap': snapshot})
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


class TestSundayWeekMigration:
    def test_revision_chain_is_linear(self, migration, sunday_migration):
        assert sunday_migration.down_revision == migration.revision == 'f7c9a4d2e8b1'
        assert sunday_migration.revision == 'c2f8a7d41b90'

    def test_settings_and_draft_only_period_repair(self, legacy_sunday_engine,
                                                   sunday_migration):
        with legacy_sunday_engine.begin() as conn:
            sunday_migration._set_settings(conn, {
                'week_start_weekday': 6,
                'week_end_weekday': 5,
                'submission_weekday': 6,
            })
            sunday_migration._repair_draft_weeks(conn)

        with legacy_sunday_engine.connect() as conn:
            settings = {row.key: row.value for row in conn.execute(sa.text(
                'SELECT key, value FROM settings'))}
            assert settings['weekly_reporting.week_start_weekday'] == '6'
            assert settings['weekly_reporting.week_end_weekday'] == '5'
            assert settings['weekly_reporting.submission_weekday'] == '6'

            rows = {row.id: dict(row._mapping) for row in conn.execute(sa.text(
                'SELECT id, week_start, week_end, due_at, period_label, status, '
                'calculation, snapshot FROM weekly_reports'))}
            for report_id in (1, 2):
                row = rows[report_id]
                assert row['week_start'] == '2031-01-12'
                assert row['week_end'] == '2031-01-18'
                assert row['due_at'] == '2031-01-19 15:00:00.000000'
                assert row['period_label'] == '2031-01-12 – 2031-01-18'
                assert row['calculation'] is None and row['snapshot'] is None
            for report_id in (3, 4):
                row = rows[report_id]
                assert row['week_start'] == '2031-01-04'
                assert row['week_end'] == '2031-01-10'
                assert row['calculation'] and row['snapshot']
            # An already-correct draft keeps its period, but its stale deadline
            # is still brought forward to the Sunday after the close.
            assert rows[5]['week_start'] == '2031-01-12'
            assert rows[5]['week_end'] == '2031-01-18'
            assert rows[5]['due_at'] == '2031-01-19 15:00:00.000000'

            audit = conn.execute(sa.text(
                'SELECT entity_id, action FROM audit_logs ORDER BY entity_id')).mappings().all()
            period_ids = [row['entity_id'] for row in audit
                          if row['action'] == 'weekly_report_period_corrected']
            deadline_ids = [row['entity_id'] for row in audit
                            if row['action'] == 'weekly_report_deadline_corrected']
            assert period_ids == ['1', '2']
            assert deadline_ids == ['5']
