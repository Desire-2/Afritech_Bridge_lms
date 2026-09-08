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