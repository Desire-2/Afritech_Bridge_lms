"""User ↔ role ↔ permission system regression tests.

Covers: super-admin flag vs role-row dual source of truth, inactive-role
preservation, role payload validation, system-role protection, self-lockout
guards, role listing permissions, and super-admin notification targeting.
"""
from app.extensions import db
from app.models import User, Role, Notification


def _login(client, email, password='Password123!'):
    r = client.post('/api/auth/login', json={'email': email, 'password': password})
    assert r.status_code == 200, r.get_data(as_text=True)
    return {'Authorization': f"Bearer {r.get_json()['access_token']}"}


class TestSuperAdminSourceOfTruth:
    def test_super_admin_role_codes_is_actual_roles_not_flag(self, client, admin_hdr):
        admin = User.query.filter_by(email='admin@afritech.dev').first()
        assert admin.is_super_admin
        # No synthetic 'super_admin' code — the flag is separate from role rows.
        assert 'super_admin' not in admin.role_codes
        # Flag still grants wildcard permissions.
        assert '*' in admin.permissions
        assert admin.has_permission('users.manage')

    def test_edit_roundtrip_does_not_assign_super_admin_role_row(self, client, admin_hdr):
        me = client.get('/api/auth/me', headers=admin_hdr).get_json()['user']
        r = client.put(f"/api/users/{me['id']}", headers=admin_hdr, json={
            'is_active': True,
            'is_super_admin': True,
            'roles': me['role_codes'],
        })
        assert r.status_code == 200, r.get_data(as_text=True)
        user = r.get_json()['user']
        assert user['is_super_admin'] is True
        assert 'super_admin' not in user['role_codes']
        dbu = User.query.get(me['id'])
        assert all(role.code != 'super_admin' for role in dbu.roles)

    def test_super_admin_role_code_in_payload_maps_to_flag(self, client, admin_hdr):
        r = client.post('/api/users', headers=admin_hdr, json={
            'email': 'flag.only@afritech.dev',
            'password': 'Password123!',
            'roles': ['super_admin'],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        user = r.get_json()['user']
        assert user['is_super_admin'] is True
        assert 'super_admin' not in user['role_codes']
        dbu = User.query.filter_by(email='flag.only@afritech.dev').first()
        assert all(role.code != 'super_admin' for role in dbu.roles)
        assert '*' in dbu.permissions

    def test_demoting_super_admin_revokes_access_and_purges_role_row(self, client, admin_hdr):
        r = client.post('/api/users', headers=admin_hdr, json={
            'email': 'temp.demote@afritech.dev',
            'password': 'Password123!',
            'is_super_admin': True,
            'roles': [],
        })
        assert r.status_code == 201
        uid = r.get_json()['user']['id']
        # Simulate a legacy super_admin role row alongside the flag.
        dbu = User.query.get(uid)
        sa_role = Role.query.filter_by(code='super_admin').first()
        dbu.roles.append(sa_role)
        db.session.commit()

        r = client.put(f'/api/users/{uid}', headers=admin_hdr, json={
            'is_active': True,
            'is_super_admin': False,
            'roles': ['service_agent'],
        })
        assert r.status_code == 200, r.get_data(as_text=True)
        user = r.get_json()['user']
        assert user['is_super_admin'] is False
        assert user['role_codes'] == ['service_agent']
        db.session.refresh(dbu)
        assert all(role.code != 'super_admin' for role in dbu.roles)
        assert '*' not in dbu.permissions
        assert not dbu.has_permission('users.manage')

    def test_legacy_super_admin_role_row_still_grants_wildcard(self, client, admin_hdr):
        r = client.post('/api/users', headers=admin_hdr, json={
            'email': 'legacy.sa@afritech.dev',
            'password': 'Password123!',
            'roles': ['service_agent'],
        })
        assert r.status_code == 201
        uid = r.get_json()['user']['id']
        dbu = User.query.get(uid)
        dbu.roles.append(Role.query.filter_by(code='super_admin').first())
        db.session.flush()
        assert dbu.is_super_admin is False
        # Defensive: an assigned super_admin role row still means wildcard.
        assert '*' in dbu.permissions
        assert dbu.has_permission('users.manage')


class TestRolePayloadValidation:
    def test_create_user_unknown_role_rejected(self, client, admin_hdr):
        r = client.post('/api/users', headers=admin_hdr, json={
            'email': 'bad.role@afritech.dev',
            'password': 'Password123!',
            'roles': ['service_agent', 'not_a_real_role'],
        })
        assert r.status_code == 400
        assert 'Unknown role' in r.get_json()['error']

    def test_update_user_unknown_role_rejected(self, client, admin_hdr):
        r = client.post('/api/users', headers=admin_hdr, json={
            'email': 'bad.update@afritech.dev',
            'password': 'Password123!',
            'roles': ['service_agent'],
        })
        uid = r.get_json()['user']['id']
        r = client.put(f'/api/users/{uid}', headers=admin_hdr, json={
            'roles': ['ghost_role'],
        })
        assert r.status_code == 400
        assert 'Unknown role' in r.get_json()['error']

    def test_update_user_non_list_roles_rejected(self, client, admin_hdr):
        r = client.post('/api/users', headers=admin_hdr, json={
            'email': 'str.roles@afritech.dev',
            'password': 'Password123!',
            'roles': ['service_agent'],
        })
        uid = r.get_json()['user']['id']
        r = client.put(f'/api/users/{uid}', headers=admin_hdr, json={
            'roles': 'manager',
        })
        assert r.status_code == 400
        assert 'list' in r.get_json()['error']

    def test_inactive_roles_preserved_on_update(self, client, admin_hdr):
        r = client.post('/api/users/roles', headers=admin_hdr, json={
            'code': 'temp_role',
            'name': 'Temp Role',
            'permissions': [],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        role = Role.query.filter_by(code='temp_role').first()

        r = client.post('/api/users', headers=admin_hdr, json={
            'email': 'inactive.role@afritech.dev',
            'password': 'Password123!',
            'roles': ['temp_role'],
        })
        assert r.status_code == 201
        uid = r.get_json()['user']['id']

        # Deactivate the role — it disappears from role_codes / role listing.
        role.is_active = False
        db.session.commit()
        r = client.put(f'/api/users/roles/{role.id}', headers=admin_hdr,
                       json={'is_active': False})
        assert r.status_code == 200
        r = client.get('/api/users/roles', headers=admin_hdr)
        assert 'temp_role' not in [x['code'] for x in r.get_json()['roles']]

        # Saving the user with a now-empty roles payload must NOT drop the
        # inactive assignment (it would be permanently unrecoverable).
        r = client.put(f'/api/users/{uid}', headers=admin_hdr, json={
            'is_active': True,
            'is_super_admin': False,
            'roles': [],
        })
        assert r.status_code == 200, r.get_data(as_text=True)
        dbu = User.query.get(uid)
        assert 'temp_role' in [x.code for x in dbu.roles]


class TestRoleListingAccess:
    def test_manager_with_employees_manage_can_list_roles(self, client, manager_hdr):
        r = client.get('/api/users/roles', headers=manager_hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        codes = [x['code'] for x in r.get_json()['roles']]
        assert 'service_agent' in codes

    def test_agent_cannot_list_roles(self, client, agent_hdr):
        assert client.get('/api/users/roles', headers=agent_hdr).status_code == 403

    def test_admin_can_list_roles(self, client, admin_hdr):
        r = client.get('/api/users/roles', headers=admin_hdr)
        assert r.status_code == 200


class TestEmployeeRoleAssignment:
    def test_employee_create_with_empty_roles_defaults_to_service_agent(self, client, admin_hdr):
        r = client.post('/api/employees', headers=admin_hdr, json={
            'first_name': 'Empty',
            'last_name': 'Roles',
            'email': 'empty.roles@afritech.dev',
            'password': 'Password123!',
            'roles': [],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        u = User.query.filter_by(email='empty.roles@afritech.dev').first()
        assert u is not None
        assert 'service_agent' in [x.code for x in u.roles]

    def test_employee_create_unknown_role_rejected(self, client, admin_hdr):
        r = client.post('/api/employees', headers=admin_hdr, json={
            'first_name': 'Bad',
            'last_name': 'Role',
            'email': 'bad.emp.role@afritech.dev',
            'password': 'Password123!',
            'roles': ['nope_role'],
        })
        assert r.status_code == 400
        assert 'Unknown role' in r.get_json()['error']
        assert User.query.filter_by(email='bad.emp.role@afritech.dev').first() is None


class TestSystemRoleProtection:
    def _role_admin_hdr(self, client, admin_hdr):
        # Idempotent: earlier tests in this session may have committed the
        # same role/user (API commits persist across the session).
        r = client.post('/api/users/roles', headers=admin_hdr, json={
            'code': 'role_admin',
            'name': 'Role Admin',
            'permissions': ['roles.manage'],
        })
        assert r.status_code in (201, 400), r.get_data(as_text=True)
        if r.status_code == 400:
            assert 'already exists' in r.get_json()['error']
        r = client.post('/api/users', headers=admin_hdr, json={
            'email': 'role.admin@afritech.dev',
            'password': 'Password123!',
            'roles': ['role_admin'],
        })
        assert r.status_code in (201, 400), r.get_data(as_text=True)
        if r.status_code == 400:
            assert 'already exists' in r.get_json()['error']
        return _login(client, 'role.admin@afritech.dev')

    def test_non_super_admin_cannot_modify_system_role(self, client, admin_hdr):
        hdr = self._role_admin_hdr(client, admin_hdr)
        roles = client.get('/api/users/roles', headers=hdr).get_json()['roles']
        manager_role = next(r for r in roles if r['code'] == 'manager')
        assert manager_role['is_system'] is True
        r = client.put(f"/api/users/roles/{manager_role['id']}", headers=hdr,
                       json={'permissions': []})
        assert r.status_code == 403
        assert 'system roles' in r.get_json()['error']

    def test_super_admin_can_modify_system_role(self, client, admin_hdr):
        roles = client.get('/api/users/roles', headers=admin_hdr).get_json()['roles']
        manager_role = next(r for r in roles if r['code'] == 'manager')
        r = client.put(f"/api/users/roles/{manager_role['id']}", headers=admin_hdr,
                       json={'description': 'People managers'})
        assert r.status_code == 200

    def test_non_super_admin_can_modify_custom_role(self, client, admin_hdr):
        hdr = self._role_admin_hdr(client, admin_hdr)
        r = client.post('/api/users/roles', headers=admin_hdr, json={
            'code': 'custom_x',
            'name': 'Custom X',
            'permissions': [],
        })
        role_id = r.get_json()['role']['id']
        r = client.put(f'/api/users/roles/{role_id}', headers=hdr,
                       json={'name': 'Custom X Renamed'})
        assert r.status_code == 200

    def test_create_role_normalizes_code(self, client, admin_hdr):
        r = client.post('/api/users/roles', headers=admin_hdr, json={
            'code': '  Mixed_Case ',
            'name': 'Mixed',
            'permissions': [],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        assert r.get_json()['role']['code'] == 'mixed_case'

    def test_create_role_unknown_permission_rejected(self, client, admin_hdr):
        r = client.post('/api/users/roles', headers=admin_hdr, json={
            'code': 'perm.bad',
            'name': 'Bad Perms',
            'permissions': ['not.a.real.permission'],
        })
        assert r.status_code == 400
        assert 'Unknown permission' in r.get_json()['error']

    def test_update_role_unknown_permission_rejected(self, client, admin_hdr):
        r = client.post('/api/users/roles', headers=admin_hdr, json={
            'code': 'perm.upd',
            'name': 'Upd',
            'permissions': [],
        })
        role_id = r.get_json()['role']['id']
        r = client.put(f'/api/users/roles/{role_id}', headers=admin_hdr,
                       json={'permissions': ['bogus.perm']})
        assert r.status_code == 400
        assert 'Unknown permission' in r.get_json()['error']


class TestSelfLockoutGuards:
    def test_cannot_deactivate_own_account(self, client, admin_hdr):
        me = client.get('/api/auth/me', headers=admin_hdr).get_json()['user']
        r = client.delete(f"/api/users/{me['id']}", headers=admin_hdr)
        assert r.status_code == 400
        assert 'your own account' in r.get_json()['error']

    def test_cannot_remove_own_super_admin_via_update(self, client, admin_hdr):
        me = client.get('/api/auth/me', headers=admin_hdr).get_json()['user']
        r = client.put(f"/api/users/{me['id']}", headers=admin_hdr, json={
            'is_super_admin': False,
        })
        assert r.status_code == 400
        assert 'super admin' in r.get_json()['error']
        dbu = User.query.get(me['id'])
        assert dbu.is_super_admin is True

    def test_cannot_deactivate_own_account_via_update(self, client, admin_hdr):
        me = client.get('/api/auth/me', headers=admin_hdr).get_json()['user']
        r = client.put(f"/api/users/{me['id']}", headers=admin_hdr, json={
            'is_active': False,
        })
        assert r.status_code == 400
        assert 'your own account' in r.get_json()['error']
        dbu = User.query.get(me['id'])
        assert dbu.is_active is True


class TestSuperAdminTargeting:
    def test_notify_by_roles_targets_super_admin_flag(self, client, admin_hdr):
        from app.services.notifications import notify_by_roles
        admin = User.query.filter_by(email='admin@afritech.dev').first()
        # Seeded admin has no super_admin role row — flag only.
        admin.roles = [r for r in admin.roles if r.code != 'super_admin']
        db.session.flush()

        sent = notify_by_roles(['super_admin'], 'test_event', 'super admin ping')
        recipients = [n.recipient_id for n in sent if n is not None]
        assert admin.id in recipients

        # A non-assigned role must not hit the flag-only super admin.
        sent2 = notify_by_roles(['accountant'], 'test_event2', 'accountant ping')
        recipients2 = [n.recipient_id for n in sent2 if n is not None]
        assert admin.id not in recipients2

    def test_managers_includes_super_admin_flag(self, client, admin_hdr):
        from app.services.automation import _managers
        admin = User.query.filter_by(email='admin@afritech.dev').first()
        admins = _managers()
        assert admin in admins

    def test_require_role_passes_for_super_admin_flag(self, client, admin_hdr, monkeypatch):
        import app.auth.auth as auth_mod
        from flask import g
        # Skip JWT loading — we inject the user directly.
        monkeypatch.setattr(auth_mod, 'load_current_user', lambda: None)
        admin = User.query.filter_by(email='admin@afritech.dev').first()
        g.current_user = admin

        @auth_mod.require_role('some_unrelated_role')
        def _protected():
            return 'ok', 200

        resp, status = _protected()
        assert status == 200


class TestCLIUnknownRoles:
    def test_create_user_unknown_role_fails(self, app, client, admin_hdr):
        runner = app.test_cli_runner()
        result = runner.invoke(args=[
            'create-user',
            '--email', 'cli.bad@afritech.dev',
            '--password', 'Password123!',
            '--role', 'bogus_role',
        ])
        assert result.exit_code != 0
        assert 'Unknown role' in result.output
        assert User.query.filter_by(email='cli.bad@afritech.dev').first() is None

    def test_assign_role_unknown_role_fails(self, app, client, admin_hdr):
        runner = app.test_cli_runner()
        result = runner.invoke(args=[
            'assign-role',
            '--email', 'admin@afritech.dev',
            '--role', 'nope_role',
        ])
        assert result.exit_code != 0
        assert 'Unknown role' in result.output

    def test_create_user_super_admin_role_code_sets_flag(self, app, client, admin_hdr):
        runner = app.test_cli_runner()
        result = runner.invoke(args=[
            'create-user',
            '--email', 'cli.flag@afritech.dev',
            '--password', 'Password123!',
            '--role', 'super_admin',
        ])
        assert result.exit_code == 0, result.output
        dbu = User.query.filter_by(email='cli.flag@afritech.dev').first()
        assert dbu is not None
        assert dbu.is_super_admin is True
        assert 'super_admin' not in [x.code for x in dbu.roles]


class TestSeedDropGuard:
    """seed_dev must never drop_all a non-SQLite (e.g. production) database."""

    def test_sqlite_allowed(self):
        from sqlalchemy.engine import make_url
        from app.seeds import assert_safe_to_drop
        assert_safe_to_drop(make_url('sqlite:////tmp/whatever.db'))

    def test_postgres_refused(self, monkeypatch):
        import pytest
        from sqlalchemy.engine import make_url
        from app.seeds import assert_safe_to_drop, UnsafeSeedError
        monkeypatch.delenv('SEED_ALLOW_DROP_REMOTE', raising=False)
        with pytest.raises(UnsafeSeedError) as exc:
            assert_safe_to_drop(make_url('postgresql://user:pass@host:5432/db'))
        assert 'non-SQLite' in str(exc.value)

    def test_remote_explicit_override_allowed(self, monkeypatch):
        from sqlalchemy.engine import make_url
        from app.seeds import assert_safe_to_drop
        monkeypatch.setenv('SEED_ALLOW_DROP_REMOTE', '1')
        assert_safe_to_drop(make_url('postgresql://user:pass@host:5432/db'))

    def test_seed_dev_refuses_before_drop_all(self, monkeypatch):
        import pytest
        import app.seeds as seeds_mod
        from app.seeds import UnsafeSeedError

        calls = []

        def _guard(url=None):
            calls.append('guard')
            raise UnsafeSeedError('blocked')

        monkeypatch.setattr(seeds_mod, 'assert_safe_to_drop', _guard)
        monkeypatch.setattr(seeds_mod.db, 'drop_all', lambda: calls.append('drop'))

        with pytest.raises(UnsafeSeedError):
            seeds_mod.seed_dev()
        assert calls == ['guard'], 'drop_all must not run when the guard fails'
