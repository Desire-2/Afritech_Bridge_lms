"""Daily closing flow: totals preview, submit, approve/lock, tamper resistance."""
from datetime import date, datetime, timezone


def _agent_token(client):
    r = client.post('/api/auth/login', json={'email': 'agent@afritech.dev', 'password': 'Password123!'})
    return r.get_json()['access_token']


def _manager_token(client):
    r = client.post('/api/auth/login', json={'email': 'manager@afritech.dev', 'password': 'Password123!'})
    return r.get_json()['access_token']


def _hdr(token):
    return {'Authorization': f'Bearer {token}'}


CLOSING_DATE = '2026-09-08'  # a date with no seeded closing


class TestClosingTotals:
    def test_totals_requires_approver_or_agent(self, client):
        token = _agent_token(client)
        r = client.get('/api/closings/totals', headers=_hdr(token))
        assert r.status_code == 200
        assert 'totals' in r.get_json()
        assert r.get_json()['employee_id'] is not None

    def test_admin_totals_without_employee_id_falls_back_to_own(self, client):
        r = client.post('/api/auth/login', json={'email': 'admin@afritech.dev', 'password': 'Password123!'})
        admin = _hdr(r.get_json()['access_token'])
        me = client.get('/api/auth/me', headers=admin).get_json()['user']
        r = client.get('/api/closings/totals', headers=admin)
        assert r.status_code == 200
        assert r.get_json()['employee_id'] == me['employee_id']


class TestClosingFlow:
    def test_submit_then_approve_locks(self, client):
        agent = _agent_token(client)
        manager = _manager_token(client)

        # agent previews and submits for a fresh date
        r = client.post('/api/closings/submit', headers=_hdr(agent),
                        json={'closing_date': CLOSING_DATE, 'actual_cash': 5000})
        assert r.status_code == 201, r.get_data(as_text=True)
        closing = r.get_json()['closing']
        assert closing['status'] == 'submitted'
        assert closing['is_locked'] is False

        # double submit rejected
        r = client.post('/api/closings/submit', headers=_hdr(agent),
                        json={'closing_date': CLOSING_DATE, 'actual_cash': 5000})
        assert r.status_code == 409

        # manager approves -> locked
        r = client.post(f"/api/closings/{closing['id']}/review", headers=_hdr(manager),
                        json={'decision': 'approved', 'note': 'ok'})
        assert r.status_code == 200, r.get_data(as_text=True)
        approved = r.get_json()['closing']
        assert approved['status'] == 'approved'
        assert approved['is_locked'] is True

        # re-approve rejected (already locked)
        r = client.post(f"/api/closings/{closing['id']}/review", headers=_hdr(manager),
                        json={'decision': 'approved'})
        assert r.status_code == 400

    def test_agent_requires_actual_cash(self, client):
        agent = _agent_token(client)
        r = client.post('/api/closings/submit', headers=_hdr(agent),
                        json={'closing_date': '2026-09-09'})
        assert r.status_code == 400

class TestClosingDateValidation:
    """Bad date input must be a 400, never a ValueError-turned-500, and the
    history list must be filterable to a single closing date."""

    def test_totals_rejects_invalid_date(self, client):
        token = _agent_token(client)
        for bad in ('garbage', '2026-9-1', '06-10-2026'):
            r = client.get(f'/api/closings/totals?date={bad}', headers=_hdr(token))
            assert r.status_code == 400, (bad, r.get_data(as_text=True))
            assert 'YYYY-MM-DD' in r.get_json()['error']

    def test_totals_empty_date_is_400_not_500(self, client):
        token = _agent_token(client)
        r = client.get('/api/closings/totals?date=', headers=_hdr(token))
        assert r.status_code == 400, r.get_data(as_text=True)

    def test_totals_missing_date_defaults_to_today(self, client):
        token = _agent_token(client)
        from datetime import date as _date
        r = client.get('/api/closings/totals', headers=_hdr(token))
        assert r.status_code == 200
        assert r.get_json()['date'] == _date.today().isoformat()

    def test_totals_rejects_non_numeric_employee_id(self, client):
        token = _manager_token(client)
        r = client.get('/api/closings/totals?employee_id=abc', headers=_hdr(token))
        assert r.status_code == 400

    def test_submit_rejects_invalid_closing_date(self, client):
        agent = _agent_token(client)
        for bad in ('garbage', ''):
            r = client.post('/api/closings/submit', headers=_hdr(agent),
                            json={'closing_date': bad, 'actual_cash': 100})
            assert r.status_code == 400, (bad, r.get_data(as_text=True))

    def test_submit_rejects_non_numeric_actual_cash(self, client):
        agent = _agent_token(client)
        r = client.post('/api/closings/submit', headers=_hdr(agent),
                        json={'closing_date': '2026-09-22', 'actual_cash': 'abc'})
        assert r.status_code == 400, r.get_data(as_text=True)
        assert 'number' in r.get_json()['error']

    def test_submit_rejects_negative_actual_cash(self, client):
        agent = _agent_token(client)
        r = client.post('/api/closings/submit', headers=_hdr(agent),
                        json={'closing_date': '2026-09-23', 'actual_cash': -5})
        assert r.status_code == 400

    def test_submit_rejects_non_numeric_employee_id(self, client):
        agent = _agent_token(client)
        r = client.post('/api/closings/submit', headers=_hdr(agent),
                        json={'closing_date': '2026-09-24', 'actual_cash': 100,
                              'employee_id': 'abc'})
        assert r.status_code == 400

    def test_list_rejects_invalid_range(self, client):
        manager = _manager_token(client)
        for qs in ('start=garbage', 'end=garbage', 'employee_id=abc'):
            r = client.get(f'/api/closings?{qs}', headers=_hdr(manager))
            assert r.status_code == 400, (qs, r.get_data(as_text=True))

    def test_list_filters_to_selected_date(self, client):
        agent = _agent_token(client)
        manager = _manager_token(client)
        day = '2026-09-25'
        r = client.post('/api/closings/submit', headers=_hdr(agent),
                        json={'closing_date': day, 'actual_cash': 2500})
        assert r.status_code == 201, r.get_data(as_text=True)

        r = client.get(f'/api/closings?start={day}&end={day}', headers=_hdr(manager))
        assert r.status_code == 200
        items = r.get_json()['items']
        assert [c['closing_date'] for c in items] == [day]

        r = client.get('/api/closings?start=2026-09-26&end=2026-09-30',
                       headers=_hdr(manager))
        assert r.status_code == 200
        assert day not in [c['closing_date'] for c in r.get_json()['items']]
