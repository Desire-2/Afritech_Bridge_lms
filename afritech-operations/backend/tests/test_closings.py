"""Daily closing flow: totals preview, submit, approve/lock, tamper resistance."""
from datetime import date, datetime, timedelta, timezone


def _agent_token(client):
    r = client.post('/api/auth/login', json={'email': 'agent@afritech.dev', 'password': 'Password123!'})
    return r.get_json()['access_token']


def _manager_token(client):
    r = client.post('/api/auth/login', json={'email': 'manager@afritech.dev', 'password': 'Password123!'})
    return r.get_json()['access_token']


def _hdr(token):
    return {'Authorization': f'Bearer {token}'}


def _make_transaction(client, token, date_str, price):
    """Create a completed cash transaction on an explicit calendar date."""
    pm = next(p for p in client.get('/api/services/payment-methods',
                                    headers=_hdr(token)).get_json()['payment_methods']
              if p['code'] == 'cash')
    service = client.get('/api/services?per_page=5', headers=_hdr(token)).get_json()['items'][0]
    client_row = client.get('/api/clients?per_page=5', headers=_hdr(token)).get_json()['items'][0]
    r = client.post('/api/transactions', headers=_hdr(token), json={
        'service_id': service['id'],
        'client_id': client_row['id'],
        'payment_method_id': pm['id'],
        'customer_price': price,
        'official_cost': price / 2,
        'transaction_date': date_str,
    })
    assert r.status_code == 201, r.get_data(as_text=True)
    return r.get_json()['transaction']


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


class TestSelectedDateTotals:
    """The preview and the submitted closing must both use the selected date,
    the selected employee and the server's business calendar."""

    def test_today_endpoint_uses_business_timezone(self, client):
        from app.services.weekly_policy import local_date

        r = client.get('/api/closings/today', headers=_hdr(_agent_token(client)))
        assert r.status_code == 200
        body = r.get_json()
        assert body['date'] == local_date(datetime.now(timezone.utc)).isoformat()
        assert body['timezone'] == 'Africa/Kigali'

    def test_totals_and_submit_use_selected_previous_date(self, client):
        agent = _agent_token(client)
        me = client.get('/api/auth/me', headers=_hdr(agent)).get_json()['user']
        employee_id = me['employee_id']
        # Outside the seeded 30-day window, so each selected date is unique.
        first_day = (date.today() - timedelta(days=45)).isoformat()
        second_day = (date.today() - timedelta(days=44)).isoformat()
        _make_transaction(client, agent, first_day, 1500)
        _make_transaction(client, agent, second_day, 2750)

        r = client.get(f'/api/closings/totals?date={first_day}&employee_id={employee_id}',
                       headers=_hdr(agent))
        assert r.status_code == 200, r.get_data(as_text=True)
        body = r.get_json()
        assert body['date'] == first_day
        assert body['employee_id'] == employee_id
        assert body['totals']['transaction_count'] == 1
        assert body['totals']['customer_payments'] == '1500.00'
        assert body['totals']['expected_cash'] == '1500.00'

        r = client.get(f'/api/closings/totals?date={second_day}&employee_id={employee_id}',
                       headers=_hdr(agent))
        assert r.status_code == 200
        assert r.get_json()['totals']['customer_payments'] == '2750.00'

        r = client.post('/api/closings/submit', headers=_hdr(agent),
                        json={'closing_date': first_day, 'actual_cash': 1500})
        assert r.status_code == 201, r.get_data(as_text=True)
        closing = r.get_json()['closing']
        assert closing['closing_date'] == first_day
        assert closing['transaction_count'] == 1
        assert closing['expected_cash'] == 1500
        assert closing['cash_difference'] == 0

    def test_manager_can_target_an_agent_but_must_name_an_employee(self, client):
        agent = _agent_token(client)
        manager = _manager_token(client)
        employee_id = client.get('/api/auth/me', headers=_hdr(agent)).get_json()['user']['employee_id']
        selected_day = (date.today() - timedelta(days=43)).isoformat()
        _make_transaction(client, agent, selected_day, 3200)

        r = client.get(f'/api/closings/totals?date={selected_day}&employee_id={employee_id}',
                       headers=_hdr(manager))
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['employee_id'] == employee_id
        assert r.get_json()['totals']['expected_cash'] == '3200.00'

        r = client.get('/api/closings/totals?employee_id=999999', headers=_hdr(manager))
        assert r.status_code == 404

        # An approver without an employee profile must be told to choose one
        # instead of creating a closing with a null employee.
        from app.extensions import db
        from app.models import Role, User

        approver = User(email='approver-no-emp@test.dev')
        approver.set_password('Password123!')
        approver.is_active = True
        approver.roles.append(Role.query.filter_by(code='manager').first())
        db.session.add(approver)
        db.session.flush()
        login = client.post('/api/auth/login',
                            json={'email': approver.email, 'password': 'Password123!'})
        assert login.status_code == 200, login.get_data(as_text=True)
        r = client.post('/api/closings/submit',
                        headers=_hdr(login.get_json()['access_token']),
                        json={'closing_date': selected_day, 'actual_cash': 3200})
        assert r.status_code == 400
        assert 'employee' in r.get_json()['error'].lower()

    def test_agent_cannot_use_another_employee(self, client):
        agent = _agent_token(client)
        r = client.get('/api/closings/totals?employee_id=999999', headers=_hdr(agent))
        assert r.status_code == 403


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
