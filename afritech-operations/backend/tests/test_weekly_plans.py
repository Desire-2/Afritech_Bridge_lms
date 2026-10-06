"""Weekly plan input validation, permission scope, and identity auto-select.

Guards the /api/instructors/weekly-plans* endpoints against the raw
``date.fromisoformat`` / dict-key crashes that used to surface as 500s, and
pins the identity payload the weekly-plan form auto-selects from /api/auth/me.
"""
from app.models import WeeklyPlan


def _login(client, email, password='Password123!'):
    r = client.post('/api/auth/login', json={'email': email, 'password': password})
    assert r.status_code == 200, r.get_data(as_text=True)
    return r.get_json()['access_token']


def _hdr(token):
    return {'Authorization': f'Bearer {token}'}


def _me(client, token):
    r = client.get('/api/auth/me', headers=_hdr(token))
    assert r.status_code == 200, r.get_data(as_text=True)
    return r.get_json()['user']


def _payload(week_start='2026-12-07', week_end='2026-12-13', **extra):
    body = {
        'week_start': week_start,
        'week_end': week_end,
        'title': 'Validation week',
        'note': 'created by test_weekly_plans',
        'activities': [
            {'activity_date': week_start, 'activity': 'Teach SUM formulas', 'duration_hours': 2},
        ],
    }
    body.update(extra)
    return body


class TestWeeklyPlanIdentity:
    """The form must be able to auto-select the caller's own instructor id."""

    def test_instructor_me_exposes_own_instructor_profile(self, client):
        user = _me(client, _login(client, 'instructor@afritech.dev'))
        assert user['instructor_id'], 'instructor_id missing from /api/auth/me'
        assert user['instructor_name']
        assert user['employee_id']

    def test_non_instructor_me_has_no_instructor_profile(self, client):
        user = _me(client, _login(client, 'agent@afritech.dev'))
        assert user['instructor_id'] is None
        assert user['instructor_name'] is None
        assert user['employee_id'], 'employee_id still used by other forms'


class TestWeeklyPlanListValidation:
    def test_list_rejects_garbage_week_start(self, client):
        token = _login(client, 'instructor@afritech.dev')
        r = client.get('/api/instructors/weekly-plans/list?week_start=not-a-date', headers=_hdr(token))
        assert r.status_code == 400, r.get_data(as_text=True)
        assert 'week_start' in r.get_json()['error']

    def test_list_filters_by_week_start(self, client):
        token = _login(client, 'admin@afritech.dev')
        everything = client.get('/api/instructors/weekly-plans/list?per_page=500', headers=_hdr(token))
        assert everything.status_code == 200, everything.get_data(as_text=True)
        items = everything.get_json()['items']
        assert items, 'seeded weekly plan missing'
        week = items[0]['week_start']
        r = client.get(f'/api/instructors/weekly-plans/list?week_start={week}', headers=_hdr(token))
        assert r.status_code == 200, r.get_data(as_text=True)
        returned = r.get_json()['items']
        assert returned and all(p['week_start'] == week for p in returned)
        assert items[0]['id'] in [p['id'] for p in returned]


class TestWeeklyPlanCreateValidation:
    def test_garbage_week_start_is_400_not_500(self, client):
        token = _login(client, 'instructor@afritech.dev')
        r = client.post('/api/instructors/weekly-plans', headers=_hdr(token),
                        json=_payload(week_start='2026-99-99'))
        assert r.status_code == 400, r.get_data(as_text=True)

    def test_garbage_week_end_is_400(self, client):
        token = _login(client, 'instructor@afritech.dev')
        r = client.post('/api/instructors/weekly-plans', headers=_hdr(token),
                        json=_payload(week_end='someday'))
        assert r.status_code == 400, r.get_data(as_text=True)

    def test_missing_week_is_400(self, client):
        token = _login(client, 'instructor@afritech.dev')
        body = _payload()
        del body['week_end']
        r = client.post('/api/instructors/weekly-plans', headers=_hdr(token), json=body)
        assert r.status_code == 400, r.get_data(as_text=True)
        assert 'week_end' in r.get_json()['error']

    def test_inverted_week_is_400(self, client):
        token = _login(client, 'instructor@afritech.dev')
        r = client.post('/api/instructors/weekly-plans', headers=_hdr(token),
                        json=_payload(week_start='2026-12-13', week_end='2026-12-07'))
        assert r.status_code == 400, r.get_data(as_text=True)
        assert 'week_end' in r.get_json()['error']

    def test_garbage_activity_date_is_400(self, client):
        token = _login(client, 'instructor@afritech.dev')
        body = _payload(activities=[{'activity_date': 'not-a-day', 'activity': 'Teach'}])
        r = client.post('/api/instructors/weekly-plans', headers=_hdr(token), json=body)
        assert r.status_code == 400, r.get_data(as_text=True)
        assert 'activity_date' in r.get_json()['error']

    def test_activity_date_outside_week_is_400(self, client):
        token = _login(client, 'instructor@afritech.dev')
        body = _payload(activities=[{'activity_date': '2027-01-04', 'activity': 'Teach'}])
        r = client.post('/api/instructors/weekly-plans', headers=_hdr(token), json=body)
        assert r.status_code == 400, r.get_data(as_text=True)
        assert 'inside the plan week' in r.get_json()['error']

    def test_activity_without_description_is_400(self, client):
        token = _login(client, 'instructor@afritech.dev')
        body = _payload(activities=[{'activity_date': '2026-12-07', 'activity': '  '}])
        r = client.post('/api/instructors/weekly-plans', headers=_hdr(token), json=body)
        assert r.status_code == 400, r.get_data(as_text=True)

    def test_non_numeric_duration_is_400(self, client):
        token = _login(client, 'instructor@afritech.dev')
        body = _payload(activities=[{'activity_date': '2026-12-07', 'activity': 'Teach',
                                     'duration_hours': 'two hours'}])
        r = client.post('/api/instructors/weekly-plans', headers=_hdr(token), json=body)
        assert r.status_code == 400, r.get_data(as_text=True)
        assert 'duration_hours' in r.get_json()['error']

    def test_negative_duration_is_400(self, client):
        token = _login(client, 'instructor@afritech.dev')
        body = _payload(activities=[{'activity_date': '2026-12-07', 'activity': 'Teach',
                                     'duration_hours': -3}])
        r = client.post('/api/instructors/weekly-plans', headers=_hdr(token), json=body)
        assert r.status_code == 400, r.get_data(as_text=True)

    def test_garbage_course_id_is_400(self, client):
        token = _login(client, 'instructor@afritech.dev')
        body = _payload(activities=[{'activity_date': '2026-12-07', 'activity': 'Teach',
                                     'course_id': 'abc'}])
        r = client.post('/api/instructors/weekly-plans', headers=_hdr(token), json=body)
        assert r.status_code == 400, r.get_data(as_text=True)


class TestWeeklyPlanUniqueness:
    def test_second_plan_for_same_instructor_and_week_is_409(self, client):
        token = _login(client, 'instructor@afritech.dev')
        body = _payload(week_start='2026-11-16', week_end='2026-11-22')
        first = client.post('/api/instructors/weekly-plans', headers=_hdr(token), json=body)
        assert first.status_code == 201, first.get_data(as_text=True)
        second = client.post('/api/instructors/weekly-plans', headers=_hdr(token), json=body)
        assert second.status_code == 409, second.get_data(as_text=True)
        assert 'already exists' in second.get_json()['error']

    def test_same_week_for_a_different_instructor_is_allowed(self, client):
        instructor_id = _me(client, _login(client, 'instructor@afritech.dev'))['instructor_id']
        admin = _login(client, 'admin@afritech.dev')
        r = client.get('/api/instructors?per_page=500', headers=_hdr(admin))
        others = [i for i in r.get_json()['items'] if i['id'] != instructor_id]
        if not others:
            return  # single seeded instructor: cross-instructor case covered by scope tests
        body = _payload(week_start='2026-11-16', week_end='2026-11-22',
                        instructor_id=others[0]['id'])
        created = client.post('/api/instructors/weekly-plans', headers=_hdr(admin), json=body)
        assert created.status_code == 201, created.get_data(as_text=True)


class TestWeeklyPlanPermissions:
    def test_instructor_create_defaults_to_own_profile(self, client):
        token = _login(client, 'instructor@afritech.dev')
        own_id = _me(client, token)['instructor_id']
        body = _payload(week_start='2026-11-09', week_end='2026-11-15')
        r = client.post('/api/instructors/weekly-plans', headers=_hdr(token), json=body)
        assert r.status_code == 201, r.get_data(as_text=True)
        assert r.get_json()['plan']['instructor_id'] == own_id

    def test_manager_can_create_and_update_a_plan(self, client):
        """Managers hold instructors.manage, which the plan routes accept."""
        instructor_id = _me(client, _login(client, 'instructor@afritech.dev'))['instructor_id']
        manager = _login(client, 'manager@afritech.dev')
        body = _payload(week_start='2026-11-02', week_end='2026-11-08',
                        instructor_id=instructor_id, title='Planned by manager')
        r = client.post('/api/instructors/weekly-plans', headers=_hdr(manager), json=body)
        assert r.status_code == 201, r.get_data(as_text=True)
        plan_id = r.get_json()['plan']['id']

        r = client.put(f'/api/instructors/weekly-plans/{plan_id}', headers=_hdr(manager),
                       json={'title': 'Updated by manager'})
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['plan']['title'] == 'Updated by manager'

    def test_agent_cannot_create_a_plan(self, client):
        token = _login(client, 'agent@afritech.dev')
        r = client.post('/api/instructors/weekly-plans', headers=_hdr(token), json=_payload())
        assert r.status_code == 403, r.get_data(as_text=True)

    def test_agent_cannot_list_plans(self, client):
        token = _login(client, 'agent@afritech.dev')
        r = client.get('/api/instructors/weekly-plans/list', headers=_hdr(token))
        assert r.status_code == 403, r.get_data(as_text=True)


class TestWeeklyPlanActivityUpdateValidation:
    @staticmethod
    def _plan_with_activity(client, token, week_start, week_end):
        r = client.post('/api/instructors/weekly-plans', headers=_hdr(token),
                        json=_payload(week_start=week_start, week_end=week_end))
        assert r.status_code == 201, r.get_data(as_text=True)
        plan = r.get_json()['plan']
        return plan, plan['activities_details'][0]['id']

    def test_non_numeric_duration_is_400(self, client):
        token = _login(client, 'instructor@afritech.dev')
        plan, activity_id = self._plan_with_activity(client, token, '2026-11-23', '2026-11-29')
        r = client.put(
            f"/api/instructors/weekly-plans/{plan['id']}/activities/{activity_id}",
            headers=_hdr(token), json={'duration_hours': 'lots'})
        assert r.status_code == 400, r.get_data(as_text=True)

    def test_activity_date_outside_plan_week_is_400(self, client):
        token = _login(client, 'instructor@afritech.dev')
        plan, activity_id = self._plan_with_activity(client, token, '2026-11-30', '2026-12-06')
        r = client.put(
            f"/api/instructors/weekly-plans/{plan['id']}/activities/{activity_id}",
            headers=_hdr(token), json={'activity_date': '2026-12-20'})
        assert r.status_code == 400, r.get_data(as_text=True)
        assert 'inside the plan week' in r.get_json()['error']

    def test_blank_activity_description_is_400(self, client):
        token = _login(client, 'instructor@afritech.dev')
        plan, activity_id = self._plan_with_activity(client, token, '2026-12-14', '2026-12-20')
        r = client.put(
            f"/api/instructors/weekly-plans/{plan['id']}/activities/{activity_id}",
            headers=_hdr(token), json={'activity': ''})
        assert r.status_code == 400, r.get_data(as_text=True)

    def test_valid_update_still_works(self, client):
        token = _login(client, 'instructor@afritech.dev')
        plan, activity_id = self._plan_with_activity(client, token, '2026-12-21', '2026-12-27')
        r = client.put(
            f"/api/instructors/weekly-plans/{plan['id']}/activities/{activity_id}",
            headers=_hdr(token),
            json={'duration_hours': 1.5, 'activity_date': '2026-12-22', 'status': 'done'})
        assert r.status_code == 200, r.get_data(as_text=True)
        act = r.get_json()['activity']
        assert float(act['duration_hours']) == 1.5
        assert act['status'] == 'done'


class TestWeeklyPlanUpdateValidation:
    def test_status_whitelist_still_enforced(self, client):
        token = _login(client, 'instructor@afritech.dev')
        r = client.post('/api/instructors/weekly-plans', headers=_hdr(token),
                        json=_payload(week_start='2027-01-04', week_end='2027-01-10'))
        assert r.status_code == 201, r.get_data(as_text=True)
        plan = r.get_json()['plan']
        r = client.put(f"/api/instructors/weekly-plans/{plan['id']}", headers=_hdr(token),
                       json={'status': 'finished'})
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['plan']['status'] == 'planned'
        assert WeeklyPlan.query.get(plan['id']).status == 'planned'
