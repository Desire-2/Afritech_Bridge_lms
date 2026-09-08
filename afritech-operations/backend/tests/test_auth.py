"""Auth & permission tests."""
from app.extensions import db
from app.models import User


class TestLogin:
    def test_login_success(self, client):
        r = client.post('/api/auth/login', json={'email': 'admin@afritech.dev', 'password': 'Password123!'})
        assert r.status_code == 200
        assert 'access_token' in r.get_json()

    def test_login_wrong_password(self, client):
        r = client.post('/api/auth/login', json={'email': 'admin@afritech.dev', 'password': 'wrong'})
        assert r.status_code == 401
        assert 'error' in r.get_json()

    def test_login_nonexistent_email(self, client):
        r = client.post('/api/auth/login', json={'email': 'nobody@example.com', 'password': 'Password123!'})
        assert r.status_code == 401

    def test_unauthenticated_access_blocked(self, client):
        assert client.get('/api/employees').status_code == 401
        assert client.get('/api/transactions').status_code == 401

    def test_me_returns_employee_fields(self, client, admin_hdr):
        r = client.get('/api/auth/me', headers=admin_hdr)
        assert r.status_code == 200
        user = r.get_json()['user']
        assert user['email'] == 'admin@afritech.dev'
        assert user['employee_id'] is not None
        assert user['employee_name'] is not None
        assert user['is_super_admin'] is True

    def test_me_employee_fields_when_unlinked(self, client):
        r = client.post('/api/auth/login', json={'email': 'agent@afritech.dev', 'password': 'Password123!'})
        token = r.get_json()['access_token']
        r = client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
        user = r.get_json()['user']
        assert 'employee_id' in user
        assert 'employee_name' in user


class TestPermissions:
    """Role / permission gating tests."""

    def test_agent_can_view_own_but_not_other_employee_transactions(self, client, agent_hdr):
        # agents have no employee directory access; must not see another employee's ledger
        assert client.get('/api/employees', headers=agent_hdr).status_code == 403
        r = client.get('/api/employees/1/transactions', headers=agent_hdr)
        assert r.status_code == 403

    def test_agent_can_view_own_service_catalog(self, client, agent_hdr):
        r = client.get('/api/services', headers=agent_hdr)
        assert r.status_code == 200
        assert len(r.get_json()['items']) >= 1

    def test_instructor_cannot_view_employee_directory(self, client):
        r = client.post('/api/auth/login', json={'email': 'instructor@afritech.dev', 'password': 'Password123!'})
        token = r.get_json()['access_token']
        r = client.get('/api/employees', headers={'Authorization': f'Bearer {token}'})
        assert r.status_code == 403

    def test_manager_can_view_employee_directory(self, client, manager_hdr):
        r = client.get('/api/employees', headers=manager_hdr)
        assert r.status_code == 200

    def test_agent_cannot_view_other_employee_salary(self, client, agent_hdr):
        # even if the record is reachable via a permitted endpoint, salary must be redacted
        me = client.get('/api/auth/me', headers=agent_hdr).get_json()['user']
        r = client.get(f"/api/employees/{me['employee_id']}", headers=agent_hdr)
        assert r.status_code == 200
        body = r.get_json()['employee']
        assert 'base_salary' not in body
        assert 'hourly_rate' not in body
        assert 'national_id' not in body

    def test_agent_cannot_read_other_employee_attendance(self, client, agent_hdr):
        me = client.get('/api/auth/me', headers=agent_hdr).get_json()['user']
        me_id = me['employee_id']
        other_id = 1 if me_id != 1 else 2
        assert client.get(f'/api/employees/{other_id}/attendance', headers=agent_hdr).status_code == 403
        assert client.get(f'/api/employees/{me_id}/attendance', headers=agent_hdr).status_code == 200

    def test_agent_attendance_record_self_only(self, client, agent_hdr):
        me = client.get('/api/auth/me', headers=agent_hdr).get_json()['user']
        other_id = 1 if me['employee_id'] != 1 else 2
        r = client.post('/api/attendance/record', headers=agent_hdr,
                        json={'employee_id': other_id, 'attendance_date': '2026-09-01'})
        assert r.status_code == 403

    def test_agent_cannot_submit_closing_for_other_employee(self, client, agent_hdr):
        me = client.get('/api/auth/me', headers=agent_hdr).get_json()['user']
        other_id = 1 if me['employee_id'] != 1 else 2
        r = client.post('/api/closings/submit', headers=agent_hdr,
                        json={'employee_id': other_id, 'closing_date': '2026-09-10', 'actual_cash': 100})
        assert r.status_code == 403

    def test_agent_cannot_view_all_expenses(self, client, agent_hdr):
        r = client.get('/api/expenses', headers=agent_hdr)
        assert r.status_code == 200
        me = client.get('/api/auth/me', headers=agent_hdr).get_json()['user']
        assert me['id'] is not None
        for exp in r.get_json()['items']:
            assert exp['submitted_by'] == me['id'], 'agent expense list not scoped to own'

    def test_instructor_weekly_plans_scoped_to_own(self, client):
        r = client.post('/api/auth/login', json={'email': 'instructor@afritech.dev', 'password': 'Password123!'})
        hdr = {'Authorization': f"Bearer {r.get_json()['access_token']}"}
        # instructor has no instructor directory; derive own id from the plan list
        r = client.get('/api/instructors/weekly-plans/list', headers=hdr)
        assert r.status_code == 200
        plans = r.get_json()['items']
        assert plans, 'seeded instructor should have weekly plans'
        own = plans[0]['instructor_id']
        for plan in plans:
            assert plan['instructor_id'] == own, 'plan not scoped to own instructor'
        assert client.get('/api/instructors', headers=hdr).status_code == 403

    def test_agent_has_no_employee_directory(self, client, agent_hdr):
        assert client.get('/api/employees', headers=agent_hdr).status_code == 403

    def test_accountant_can_view_expenses(self, client, accountant_hdr):
        r = client.get('/api/expenses', headers=accountant_hdr)
        assert r.status_code == 200

    def test_admin_can_access_audit_log(self, client, admin_hdr):
        r = client.get('/api/audit?per_page=5', headers=admin_hdr)
        assert r.status_code == 200
        assert 'items' in r.get_json()

    def test_instructor_dashboard_me(self, client, instructor_hdr):
        r = client.get('/api/dashboard/me', headers=instructor_hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        d = r.get_json()
        for key in ('teaching_activities_today', 'upcoming_activities', 'current_plan',
                    'plan_completion', 'pending_grading', 'assigned_cohorts', 'total_learners'):
            assert key in d, key
        ok = True
        for a in d.get('upcoming_activities') or []:
            if 'cohort_name' not in a:
                ok = False
        assert ok, 'teaching activity to_dict missing cohort_name'


class TestChangePassword:
    def test_change_password_flow(self, client, admin_hdr):
        r = client.post('/api/auth/change-password', headers=admin_hdr, json={
            'current_password': 'Password123!', 'new_password': 'NewPassword123!'
        })
        assert r.status_code == 200
        # verify new password works
        r = client.post('/api/auth/login', json={'email': 'admin@afritech.dev', 'password': 'NewPassword123!'})
        assert r.status_code == 200
        # restore original so other tests are not affected
        admin_token = r.get_json()['access_token']
        client.post('/api/auth/change-password', headers={'Authorization': f'Bearer {admin_token}'}, json={
            'current_password': 'NewPassword123!', 'new_password': 'Password123!'
        })

    def test_change_password_rejects_wrong_current(self, client, admin_hdr):
        r = client.post('/api/auth/change-password', headers=admin_hdr, json={
            'current_password': 'nope', 'new_password': 'Whatever123!'
        })
        assert r.status_code == 400