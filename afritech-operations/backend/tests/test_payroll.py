"""Payroll period lifecycle tests."""
from datetime import date


def _hdr(token):
    return {'Authorization': f'Bearer {token}'}


def _login(client, email, password='Password123!'):
    r = client.post('/api/auth/login', json={'email': email, 'password': password})
    assert r.status_code == 200, r.get_data(as_text=True)
    return r.get_json()['access_token']


class TestPayrollPeriod:
    def test_create_period_generates_items(self, client):
        admin = _login(client, 'admin@afritech.dev')
        r = client.post('/api/payroll/periods', headers=_hdr(admin), json={
            'name': 'Unit Test Nov 2026',
            'period_start': '2026-11-01', 'period_end': '2026-11-30'
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        period = r.get_json()['period']
        assert period['item_count'] == 6  # 6 active employees in seed
        assert period['item_count'] > 0
        assert float(period['total_gross']) >= float(period['total_commission_items'])

        # items expose per-employee commission + net
        r = client.get(f"/api/payroll/periods/{period['id']}", headers=_hdr(admin))
        detail = r.get_json()['period']
        assert len(detail['items']) == period['item_count']
        for item in detail['items']:
            assert 'employee_id' in item
            assert 'commission' in item
            assert float(item['net_salary']) == float(item['base_salary']) + float(item['commission'])

    def test_overlapping_period_rejected(self, client):
        admin = _login(client, 'admin@afritech.dev')
        r = client.post('/api/payroll/periods', headers=_hdr(admin), json={
            'name': 'Overlap Test', 'period_start': '2026-11-10', 'period_end': '2026-11-20'
        })
        assert r.status_code == 400
        assert 'verlaps' in r.get_json()['error']

    def test_status_flow_and_permission(self, client):
        admin = _login(client, 'admin@afritech.dev')
        manager = _login(client, 'manager@afritech.dev')
        agent = _login(client, 'agent@afritech.dev')
        r = client.post('/api/payroll/periods', headers=_hdr(admin), json={
            'name': 'Unit Test Dec 2026',
            'period_start': '2026-12-01', 'period_end': '2026-12-31'
        })
        period_id = r.get_json()['period']['id']

        # agent cannot change status
        r = client.post(f'/api/payroll/periods/{period_id}/status', headers=_hdr(agent),
                        json={'status': 'reviewed'})
        assert r.status_code == 403

        # manager can review
        r = client.post(f'/api/payroll/periods/{period_id}/status', headers=_hdr(manager),
                        json={'status': 'reviewed'})
        assert r.status_code == 200
        assert r.get_json()['period']['status'] == 'reviewed'

        # draft cannot be skipped backwards
        r = client.post(f'/api/payroll/periods/{period_id}/status', headers=_hdr(admin),
                        json={'status': 'paid'})
        assert r.status_code == 400