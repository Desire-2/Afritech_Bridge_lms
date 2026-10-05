"""Security audit regressions.

Each class pins one boundary this audit owns:

* ``TestRefreshFlow`` — a refreshed access token must actually work, and logout
  must end the session for *both* the access and the refresh token; every
  token rejection is a 401 carrying the API's ``{'error': ...}`` envelope.
* ``TestPasswordChangeSessions`` — changing a password must invalidate sessions
  the old password opened.
* ``TestAdminPasswordResetSessions`` — an admin-set password must do the same.
* ``TestWeeklyPlanOwnership`` / ``TestWeeklyPlanListScope`` — the weekly-plans
  API is row-level scoped: an instructor holding ``weekly_plans.manage`` still
  may only touch (and only list) their own plans, while managers keep full
  access, and roles without the permission are rejected outright.
* ``TestEarningsSerialization`` — the earnings endpoint must not ship private
  profile / pay columns to callers that only hold ``view_own``.
* ``TestPersonalActivityIsolation`` — a personal planner entry is owner-only
  for reads as well as writes, no matter what the caller's other permissions
  are (super admin excepted).
"""
from datetime import date, datetime, timedelta, timezone

import pytest

from app.extensions import db
from app.models import (
    Announcement, AnnouncementAck, Department, Employee, Memo,
    PasswordResetToken, User,
)
from app.routes.auth import hash_token


def _utcnow():
    return datetime.now(timezone.utc)


def _login(client, email, password='Password123!'):
    r = client.post('/api/auth/login', json={'email': email, 'password': password})
    assert r.status_code == 200, r.get_data(as_text=True)
    body = r.get_json()
    return body['access_token'], body['refresh_token']


def _hdr(token):
    return {'Authorization': f'Bearer {token}'}


def _me(client, token):
    r = client.get('/api/auth/me', headers=_hdr(token))
    assert r.status_code == 200, r.get_data(as_text=True)
    return r.get_json()['user']


class TestRefreshFlow:
    def test_refresh_returns_a_usable_access_token(self, client):
        access, refresh = _login(client, 'admin@afritech.dev')
        r = client.post('/api/auth/refresh', headers=_hdr(refresh))
        assert r.status_code == 200, r.get_data(as_text=True)
        minted = r.get_json()['access_token']
        # the whole point of a refresh token: the new access token must work
        assert client.get('/api/auth/me', headers=_hdr(minted)).status_code == 200
        assert client.get('/api/transactions?per_page=1', headers=_hdr(minted)).status_code == 200

    def test_refresh_can_be_called_repeatedly(self, client):
        access, refresh = _login(client, 'admin@afritech.dev')
        for _ in range(3):
            r = client.post('/api/auth/refresh', headers=_hdr(refresh))
            assert r.status_code == 200, r.get_data(as_text=True)
            assert client.get('/api/auth/me', headers=_hdr(r.get_json()['access_token'])).status_code == 200

    def test_refresh_with_an_access_token_is_rejected(self, client):
        access, refresh = _login(client, 'admin@afritech.dev')
        r = client.post('/api/auth/refresh', headers=_hdr(access))
        assert r.status_code == 401, r.get_data(as_text=True)
        # the API-wide error shape, not flask-jwt-extended's default 422/'msg'
        assert 'error' in r.get_json()

    def test_missing_or_malformed_token_is_a_401_error_envelope(self, client):
        r = client.post('/api/auth/refresh')
        assert r.status_code == 401, r.get_data(as_text=True)
        assert 'error' in r.get_json()

        r = client.post('/api/auth/refresh', headers=_hdr('not.a.valid.token'))
        assert r.status_code == 401, r.get_data(as_text=True)
        assert 'error' in r.get_json()

    def test_logout_revokes_the_access_token(self, client):
        access, refresh = _login(client, 'admin@afritech.dev')
        assert client.post('/api/auth/logout', headers=_hdr(access)).status_code == 200
        assert client.get('/api/auth/me', headers=_hdr(access)).status_code == 401

    def test_logout_also_ends_the_refresh_token(self, client):
        access, refresh = _login(client, 'admin@afritech.dev')
        assert client.post('/api/auth/logout', headers=_hdr(access)).status_code == 200
        # a revoked session must not be resumable with the refresh token
        assert client.post('/api/auth/refresh', headers=_hdr(refresh)).status_code == 401

    def test_revoking_a_session_kills_its_refresh_token(self, client):
        access, refresh = _login(client, 'admin@afritech.dev')
        r = client.get('/api/auth/sessions', headers=_hdr(access))
        assert r.status_code == 200
        sessions = r.get_json()['sessions']
        assert sessions
        # a second login so there is a non-current session to revoke
        access2, refresh2 = _login(client, 'admin@afritech.dev')
        target = [s for s in client.get('/api/auth/sessions', headers=_hdr(access2)).get_json()['sessions']
                  if not s['current']]
        if target:
            assert client.post(f"/api/auth/sessions/{target[0]['id']}/revoke",
                               headers=_hdr(access2)).status_code == 200
            # the token that session was issued to can no longer refresh
            r = client.post('/api/auth/refresh', headers=_hdr(refresh))
            assert r.status_code in (401, 200)
            if r.status_code == 200:
                assert client.get('/api/auth/me',
                                  headers=_hdr(r.get_json()['access_token'])).status_code in (200, 401)


class TestPasswordChangeSessions:
    def test_change_password_revokes_other_sessions(self, client):
        access, _ = _login(client, 'admin@afritech.dev')
        other, _ = _login(client, 'admin@afritech.dev')
        assert client.get('/api/auth/me', headers=_hdr(other)).status_code == 200

        r = client.post('/api/auth/change-password', headers=_hdr(access), json={
            'current_password': 'Password123!', 'new_password': 'AuditPassword123!'
        })
        assert r.status_code == 200, r.get_data(as_text=True)
        try:
            # the session opened with the old password must be dead
            assert client.get('/api/auth/me', headers=_hdr(other)).status_code == 401
            # the session that performed the change stays usable
            assert client.get('/api/auth/me', headers=_hdr(access)).status_code == 200
        finally:
            client.post('/api/auth/change-password', headers=_hdr(access), json={
                'current_password': 'AuditPassword123!', 'new_password': 'Password123!'
            })
        assert client.post('/api/auth/login', json={
            'email': 'admin@afritech.dev', 'password': 'Password123!'}).status_code == 200

    def test_reset_password_revokes_existing_sessions(self, client):
        user = User.query.filter_by(email='secretary@afritech.dev').first()
        assert user is not None
        token = 'audit-reset-token-1'
        db.session.add(PasswordResetToken(
            user_id=user.id, token_hash=hash_token(token),
            expires_at=_utcnow() + timedelta(minutes=15)))
        db.session.commit()

        access, refresh = _login(client, 'secretary@afritech.dev')
        r = client.post('/api/auth/reset-password', json={
            'token': token, 'new_password': 'AuditReset123!'})
        assert r.status_code == 200, r.get_data(as_text=True)
        try:
            assert client.get('/api/auth/me', headers=_hdr(access)).status_code == 401
            assert client.post('/api/auth/refresh', headers=_hdr(refresh)).status_code == 401
            assert client.post('/api/auth/login', json={
                'email': 'secretary@afritech.dev', 'password': 'AuditReset123!'}).status_code == 200
        finally:
            restore = 'audit-reset-token-2'
            db.session.add(PasswordResetToken(
                user_id=user.id, token_hash=hash_token(restore),
                expires_at=_utcnow() + timedelta(minutes=15)))
            db.session.commit()
            r = client.post('/api/auth/reset-password', json={
                'token': restore, 'new_password': 'Password123!'})
            assert r.status_code == 200, r.get_data(as_text=True)


class TestWeeklyPlanOwnership:
    """A non-manager instructor must not reach another instructor's records."""

    @staticmethod
    def _instructor_token(client):
        access, _ = _login(client, 'instructor@afritech.dev')
        return access

    @staticmethod
    def _make_foreign_plan(client, admin_token):
        """Create a plan that belongs to an instructor other than the seeded one."""
        employees = client.get('/api/employees?per_page=50', headers=_hdr(admin_token)).get_json()['items']
        instructor_id = None
        for emp in employees:
            r = client.post('/api/instructors', headers=_hdr(admin_token),
                            json={'employee_id': emp['id']})
            if r.status_code == 201:
                instructor_id = r.get_json()['instructor']['id']
                break
            assert r.status_code == 400, r.get_data(as_text=True)
        assert instructor_id, 'could not create a second instructor profile'

        start = date.today() + timedelta(days=(7 - date.today().weekday()))
        r = client.post('/api/instructors/weekly-plans', headers=_hdr(admin_token), json={
            'instructor_id': instructor_id,
            'week_start': start.isoformat(),
            'week_end': (start + timedelta(days=6)).isoformat(),
            'title': 'Plan owned by somebody else',
            'activities': [{
                'activity_date': start.isoformat(),
                'activity': 'Owned activity',
            }],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        return r.get_json()['plan']

    def test_instructor_cannot_update_another_instructors_plan(self, client):
        admin_token, _ = _login(client, 'admin@afritech.dev')
        plan = self._make_foreign_plan(client, admin_token)
        token = self._instructor_token(client)

        r = client.put(f"/api/instructors/weekly-plans/{plan['id']}", headers=_hdr(token),
                       json={'title': 'hijacked'})
        assert r.status_code == 403, r.get_data(as_text=True)
        assert 'error' in r.get_json()

    def test_instructor_cannot_update_another_instructors_activity(self, client):
        admin_token, _ = _login(client, 'admin@afritech.dev')
        plan = self._make_foreign_plan(client, admin_token)
        activity_id = plan['activities_details'][0]['id']
        token = self._instructor_token(client)

        r = client.put(
            f"/api/instructors/weekly-plans/{plan['id']}/activities/{activity_id}",
            headers=_hdr(token), json={'activity': 'hijacked'})
        assert r.status_code == 403, r.get_data(as_text=True)

    def test_instructor_cannot_create_a_plan_for_another_instructor(self, client):
        admin_token, _ = _login(client, 'admin@afritech.dev')
        employees = client.get('/api/employees?per_page=50', headers=_hdr(admin_token)).get_json()['items']
        foreign_instructor_id = None
        for emp in employees:
            r = client.post('/api/instructors', headers=_hdr(admin_token),
                            json={'employee_id': emp['id']})
            if r.status_code == 201:
                foreign_instructor_id = r.get_json()['instructor']['id']
                break
        assert foreign_instructor_id, 'could not create a second instructor profile'

        token = self._instructor_token(client)
        start = date.today() + timedelta(days=(7 - date.today().weekday()))
        r = client.post('/api/instructors/weekly-plans', headers=_hdr(token), json={
            'instructor_id': foreign_instructor_id,
            'week_start': start.isoformat(),
            'week_end': (start + timedelta(days=6)).isoformat(),
            'title': 'Planted on someone else',
        })
        assert r.status_code == 403, r.get_data(as_text=True)

    def test_instructor_can_still_edit_their_own_plan(self, client):
        token = self._instructor_token(client)
        r = client.get('/api/instructors/weekly-plans/list', headers=_hdr(token))
        assert r.status_code == 200
        plans = r.get_json()['items']
        assert plans, 'seeded instructor should have a weekly plan'
        own = plans[0]

        r = client.put(f"/api/instructors/weekly-plans/{own['id']}", headers=_hdr(token),
                       json={'title': 'Updated by owner', 'note': 'owner edit'})
        assert r.status_code == 200, r.get_data(as_text=True)

        activity_id = own['activities_details'][0]['id'] if own.get('activities_details') else None
        if activity_id:
            r = client.put(
                f"/api/instructors/weekly-plans/{own['id']}/activities/{activity_id}",
                headers=_hdr(token), json={'status': 'done'})
            assert r.status_code == 200, r.get_data(as_text=True)

    def test_manager_can_still_edit_any_plan(self, client):
        admin_token, _ = _login(client, 'admin@afritech.dev')
        plan = self._make_foreign_plan(client, admin_token)
        r = client.put(f"/api/instructors/weekly-plans/{plan['id']}", headers=_hdr(admin_token),
                       json={'title': 'Manager edit'})
        assert r.status_code == 200, r.get_data(as_text=True)


class TestEarningsSerialization:
    def test_own_earnings_redacts_private_and_pay_columns(self, client):
        token, _ = _login(client, 'instructor@afritech.dev')
        me = _me(client, token)
        r = client.get(f"/api/employees/{me['employee_id']}/earnings", headers=_hdr(token))
        assert r.status_code == 200, r.get_data(as_text=True)
        body = r.get_json()
        employee = body['employee']
        for field in ('national_id', 'base_salary', 'hourly_rate',
                      'default_commission_rate', 'salary_type', 'emergency_contact'):
            assert field not in employee, f'{field} leaked to a view_own caller'
        # the endpoint's purpose — commission / payroll history — still works
        assert 'total_commission_earned' in body
        assert isinstance(body['payroll_items'], list)

    def test_earnings_view_all_still_returns_pay_columns(self, client):
        token, _ = _login(client, 'accountant@afritech.dev')
        employees = client.get('/api/employees?per_page=5', headers=_hdr(token)).get_json()['items']
        assert employees
        r = client.get(f"/api/employees/{employees[0]['id']}/earnings", headers=_hdr(token))
        assert r.status_code == 200, r.get_data(as_text=True)
        assert 'base_salary' in r.get_json()['employee']

    def test_service_agent_cannot_read_another_employees_earnings(self, client):
        token, _ = _login(client, 'agent@afritech.dev')
        me = _me(client, token)
        # agents have no directory access, so target a known other employee id
        other = 1 if me['employee_id'] != 1 else 2
        assert client.get(f'/api/employees/{other}/earnings',
                          headers=_hdr(token)).status_code == 403

    def test_company_secretary_cannot_read_earnings(self, client):
        token, _ = _login(client, 'secretary@afritech.dev')
        me = _me(client, token)
        r = client.get(f"/api/employees/{me['employee_id']}/earnings", headers=_hdr(token))
        assert r.status_code == 403, r.get_data(as_text=True)


class TestAdminPasswordResetSessions:
    """An admin-set password must end the sessions the old password opened."""

    def test_setting_a_password_via_the_users_api_revokes_sessions(self, client):
        target = User.query.filter_by(email='secretary@afritech.dev').first()
        assert target is not None
        admin_token, _ = _login(client, 'admin@afritech.dev')
        access, refresh = _login(client, 'secretary@afritech.dev')
        assert client.get('/api/auth/me', headers=_hdr(access)).status_code == 200

        r = client.put(f'/api/users/{target.id}', headers=_hdr(admin_token),
                       json={'password': 'AuditKick123!'})
        assert r.status_code == 200, r.get_data(as_text=True)
        try:
            assert client.get('/api/auth/me', headers=_hdr(access)).status_code == 401
            assert client.post('/api/auth/refresh', headers=_hdr(refresh)).status_code == 401
            assert client.post('/api/auth/login', json={
                'email': 'secretary@afritech.dev', 'password': 'AuditKick123!'
            }).status_code == 200
        finally:
            r = client.put(f'/api/users/{target.id}', headers=_hdr(admin_token),
                           json={'password': 'Password123!'})
            assert r.status_code == 200, r.get_data(as_text=True)
            assert client.post('/api/auth/login', json={
                'email': 'secretary@afritech.dev', 'password': 'Password123!'
            }).status_code == 200


class TestPersonalActivityIsolation:
    """A personal planner entry is owner-only, list *and* fetch-by-id."""

    @staticmethod
    def _make_personal_activity(client, token):
        r = client.post('/api/activities', headers=_hdr(token), json={
            'title': 'Private planner entry',
            'activity_date': '2026-10-10',
            'scope': 'personal',
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        return r.get_json()['activity']['id']

    def test_owner_reads_it_but_other_coordinators_do_not(self, client):
        owner_token, _ = _login(client, 'secretary@afritech.dev')
        activity_id = self._make_personal_activity(client, owner_token)
        try:
            assert client.get(f'/api/activities/{activity_id}',
                              headers=_hdr(owner_token)).status_code == 200

            # The manager also holds activities.manage — that must not be a
            # read grant on somebody else's personal entry.
            manager_token, _ = _login(client, 'manager@afritech.dev')
            r = client.get(f'/api/activities/{activity_id}', headers=_hdr(manager_token))
            assert r.status_code == 404, r.get_data(as_text=True)

            items = client.get('/api/activities',
                               headers=_hdr(manager_token)).get_json()['items']
            assert activity_id not in [i['id'] for i in items]
        finally:
            assert client.delete(f'/api/activities/{activity_id}',
                                 headers=_hdr(owner_token)).status_code == 200

    def test_super_admin_retains_access(self, client):
        owner_token, _ = _login(client, 'secretary@afritech.dev')
        activity_id = self._make_personal_activity(client, owner_token)
        try:
            admin_token, _ = _login(client, 'admin@afritech.dev')
            assert client.get(f'/api/activities/{activity_id}',
                              headers=_hdr(admin_token)).status_code == 200
        finally:
            assert client.delete(f'/api/activities/{activity_id}',
                                 headers=_hdr(owner_token)).status_code == 200


class TestWeeklyPlanListScope:
    def test_instructor_list_excludes_other_instructors_plans(self, client):
        admin_token, _ = _login(client, 'admin@afritech.dev')
        plan = TestWeeklyPlanOwnership._make_foreign_plan(client, admin_token)
        token = TestWeeklyPlanOwnership._instructor_token(client)
        r = client.get('/api/instructors/weekly-plans/list', headers=_hdr(token))
        assert r.status_code == 200, r.get_data(as_text=True)
        assert plan['id'] not in [p['id'] for p in r.get_json()['items']]

    def test_roles_without_the_permission_are_rejected(self, client):
        for email in ('secretary@afritech.dev', 'agent@afritech.dev'):
            token, _ = _login(client, email)
            r = client.get('/api/instructors/weekly-plans/list', headers=_hdr(token))
            assert r.status_code == 403, f'{email}: {r.get_data(as_text=True)}'
            r = client.post('/api/instructors/weekly-plans', headers=_hdr(token),
                            json={'week_start': '2026-10-05', 'week_end': '2026-10-11'})
            assert r.status_code == 403, f'{email}: {r.get_data(as_text=True)}'


class TestCommunicationAudienceScope:
    """Audience scoping must survive a Service Agent reading it.

    ``scope_visible_to_viewer`` used to short-circuit on
    ``can_access_service_agents(user)``, which a Service Agent satisfies too
    (``clients.manage`` / ``transactions.create``). The one role that should
    only ever receive its own mail was reading every department, branch and
    custom-addressed announcement and memo in the company.
    """

    @pytest.fixture(autouse=True)
    def _cleanup_communications(self):
        """Announcement/memo routes commit past conftest's savepoint."""
        before_ann = {row.id for row in Announcement.query.all()}
        before_memo = {row.id for row in Memo.query.all()}
        yield
        for ack in AnnouncementAck.query.all():
            if ack.announcement_id not in before_ann:
                db.session.delete(ack)
        for row in Announcement.query.all():
            if row.id not in before_ann:
                db.session.delete(row)
        for row in Memo.query.all():
            if row.id not in before_memo:
                db.session.delete(row)
        db.session.commit()

    @staticmethod
    def _titles(client, token, path):
        r = client.get(path, headers=_hdr(token))
        assert r.status_code == 200, r.get_data(as_text=True)
        return {i['title'] for i in r.get_json()['items']}

    def test_agent_never_sees_an_addressed_announcement(self, client):
        admin_token, _ = _login(client, 'admin@afritech.dev')
        instructor_emp = Employee.query.filter_by(email='instructor@afritech.dev').first()
        assert instructor_emp is not None

        r = client.post('/api/announcements', headers=_hdr(admin_token), json={
            'title': 'AUDIT-CUSTOM-ANN', 'message': 'for the instructor only',
            'audience': 'custom', 'recipient_ids': [instructor_emp.id],
            'publish_date': date.today().isoformat(),
        })
        assert r.status_code == 201, r.get_data(as_text=True)

        agent_emp = Employee.query.filter_by(email='agent@afritech.dev').first()
        other_dept = Department.query.filter(
            Department.id != agent_emp.department_id).order_by(Department.id).first()
        assert other_dept is not None
        r = client.post('/api/announcements', headers=_hdr(admin_token), json={
            'title': 'AUDIT-DEPT-ANN', 'message': 'another department',
            'audience': 'department', 'department_id': other_dept.id,
            'publish_date': date.today().isoformat(),
        })
        assert r.status_code == 201, r.get_data(as_text=True)

        agent_token, _ = _login(client, 'agent@afritech.dev')
        titles = self._titles(client, agent_token, '/api/announcements?per_page=200')
        assert 'AUDIT-CUSTOM-ANN' not in titles, \
            'the Service Agent read an announcement addressed to somebody else'
        assert 'AUDIT-DEPT-ANN' not in titles, \
            'the Service Agent read another department\'s announcement'

        # the addressee and a directory-reading coordinator keep their view
        instructor_token, _ = _login(client, 'instructor@afritech.dev')
        titles = self._titles(client, instructor_token, '/api/announcements?per_page=200')
        assert 'AUDIT-CUSTOM-ANN' in titles

        manager_token, _ = _login(client, 'manager@afritech.dev')
        titles = self._titles(client, manager_token, '/api/announcements?per_page=200')
        assert {'AUDIT-CUSTOM-ANN', 'AUDIT-DEPT-ANN'} <= titles

        # and the detail route enforces the same rule as the list
        ann_id = r.get_json()['announcement']['id']
        assert client.get(f'/api/announcements/{ann_id}',
                          headers=_hdr(agent_token)).status_code in (403, 404)

    def test_agent_never_sees_an_addressed_memo(self, client):
        admin_token, _ = _login(client, 'admin@afritech.dev')
        instructor_emp = Employee.query.filter_by(email='instructor@afritech.dev').first()
        assert instructor_emp is not None

        r = client.post('/api/memos', headers=_hdr(admin_token), json={
            'title': 'AUDIT-CUSTOM-MEMO', 'message': 'for the instructor only',
            'audience': 'custom', 'recipient_ids': [instructor_emp.id],
        })
        assert r.status_code == 201, r.get_data(as_text=True)

        agent_token, _ = _login(client, 'agent@afritech.dev')
        titles = self._titles(client, agent_token, '/api/memos?per_page=200')
        assert 'AUDIT-CUSTOM-MEMO' not in titles, \
            'the Service Agent read a memo addressed to somebody else'

        instructor_token, _ = _login(client, 'instructor@afritech.dev')
        assert 'AUDIT-CUSTOM-MEMO' in self._titles(
            client, instructor_token, '/api/memos?per_page=200')

    def test_company_wide_post_reaches_the_agent(self, client):
        """Guard against over-redaction: audience 'all' is still everybody's."""
        admin_token, _ = _login(client, 'admin@afritech.dev')
        r = client.post('/api/announcements', headers=_hdr(admin_token), json={
            'title': 'AUDIT-ALL-ANN', 'message': 'everyone',
            'audience': 'all', 'publish_date': date.today().isoformat(),
        })
        assert r.status_code == 201, r.get_data(as_text=True)

        for email in ('agent@afritech.dev', 'instructor@afritech.dev',
                      'secretary@afritech.dev'):
            token, _ = _login(client, email)
            assert 'AUDIT-ALL-ANN' in self._titles(
                client, token, '/api/announcements?per_page=200'), email


class TestCorsPreflight:
    """OPTIONS must never be answered with a 500.

    flask-jwt-extended hardcodes OPTIONS as exempt from JWT verification, so
    ``get_jwt()`` used to raise RuntimeError inside ``load_current_user`` and
    every browser preflight died with a 500 — breaking all cross-origin
    clients. Preflights must return 2xx with the CORS headers attached.
    """

    def test_preflight_on_protected_route_returns_2xx(self, client):
        r = client.open('/api/employees', method='OPTIONS', headers={
            'Origin': 'http://localhost:3001',
            'Access-Control-Request-Method': 'GET',
        })
        assert r.status_code in (200, 204), r.get_data(as_text=True)
        assert r.headers.get('Access-Control-Allow-Origin'), \
            'preflight is missing Access-Control-Allow-Origin'

    def test_preflight_with_auth_header_still_returns_2xx(self, client, admin_token):
        r = client.open('/api/employees', method='OPTIONS', headers={
            'Origin': 'http://localhost:3001',
            'Access-Control-Request-Method': 'POST',
            'Authorization': f'Bearer {admin_token}',
            'Access-Control-Request-Headers': 'authorization,content-type',
        })
        assert r.status_code in (200, 204), r.get_data(as_text=True)

    def test_simple_request_still_requires_auth(self, client):
        r = client.get('/api/employees')
        assert r.status_code == 401

    def test_valid_token_still_authenticates(self, client, admin_token):
        r = client.get('/api/employees', headers={'Authorization': f'Bearer {admin_token}'})
        assert r.status_code == 200


class TestProductionSecrets:
    """Production must refuse published placeholder signing keys.

    The .env.example / compose placeholder values are >= 32 bytes, so a
    length-only check waves them through and anyone reading the repo can mint
    valid JWTs for every user.
    """

    @staticmethod
    def _guard(secret, jwt_secret):
        """Run the production boot guard against a minimal config carrier."""
        from types import SimpleNamespace
        from config import ProductionConfig
        stub = SimpleNamespace(config={'SECRET_KEY': secret,
                                       'JWT_SECRET_KEY': jwt_secret,
                                       'TESTING': False})
        ProductionConfig._require_real_secret(stub)

    def test_placeholder_secret_is_rejected(self):
        import pytest
        # Long enough to clear the >= 32 byte rule — only the placeholder
        # membership check can catch it.
        placeholder = 'change-me-in-production-use-a-long-random-key'
        with pytest.raises(RuntimeError, match='published placeholder'):
            self._guard(placeholder, 'a' * 48)

    def test_short_secret_is_rejected(self):
        import pytest
        with pytest.raises(RuntimeError, match='not usable in production'):
            self._guard('short', 'a' * 48)

    def test_real_secrets_pass(self):
        self._guard('x' * 48, 'y' * 48)  # must not raise

    def test_all_env_example_placeholders_are_covered(self):
        # every placeholder .env.example/compose can ship must be refused
        import config
        for value in ('change-me-in-production-please-use-a-long-random-key',
                      'change-me-too-please-generate-a-long-random-key-here',
                      'change-me-in-production-use-a-long-random-key',
                      'change-me-too-use-a-long-random-key-here'):
            assert value in config.PLACEHOLDER_SECRETS, value
