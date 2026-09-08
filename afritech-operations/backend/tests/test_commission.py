"""Commission precedence & pricing snapshot tests.

Precedence: employee override > employee rule > service rate > service rule
> default rule > app default (20%).
"""
from datetime import date

from app.extensions import db
from app.models import (
    Employee, User, Service, ServiceCategory, ServiceTransaction,
    PaymentMethod, Client, CommissionRule,
)
from app.services.commission import CommissionEngine


def _agent_employee():
    return User.query.filter_by(email='agent@afritech.dev').first().employee


def _make_service(name='Custom Service', customer_price=2000, official_cost=800,
                  commission_rate=None):
    cat = ServiceCategory.query.filter_by(name='Digital Services').first()
    svc = Service(name=name, code=f'SVC-{name.replace(" ", "-")}', category_id=cat.id,
                  customer_price=customer_price, official_cost=official_cost,
                  commission_rate=commission_rate, is_active=True)
    db.session.add(svc)
    db.session.flush()
    return svc


def _make_txn(client, token, service_id, client_email='agent@afritech.dev', price=None):
    """Agent creates a transaction against a given service for their own client."""
    hdr = {'Authorization': f'Bearer {token}'}
    r = client.get('/api/clients', headers=hdr)
    client_id = r.get_json()['items'][0]['id']
    r = client.get('/api/services/payment-methods', headers=hdr)
    cash = [p for p in r.get_json()['payment_methods'] if p['code'] == 'cash'][0]
    payload = {'service_id': service_id, 'client_id': client_id, 'payment_method_id': cash['id']}
    if price is not None:
        payload['customer_price'] = price
    r = client.post('/api/transactions', headers=hdr, json=payload)
    assert r.status_code == 201, r.get_data(as_text=True)
    return r.get_json()['transaction']


class TestCurrentRate:
    def test_default_rate(self, app):
        engine = CommissionEngine(app)
        svc = _make_service()  # no service/employee/rule rates
        rate, source = engine.current_rate(service=svc, employee=None)
        assert float(rate) == 0.20
        assert source == 'default'

    def test_service_rate_beats_default(self, app):
        engine = CommissionEngine(app)
        svc = _make_service(commission_rate=0.30)
        rate, source = engine.current_rate(service=svc, employee=None)
        assert float(rate) == 0.30
        assert source == 'service'

    def test_employee_rate_beats_service(self, app):
        engine = CommissionEngine(app)
        svc = _make_service(commission_rate=0.30)
        emp = _agent_employee()
        emp.default_commission_rate = 0.15
        rate, source = engine.current_rate(service=svc, employee=emp)
        assert float(rate) == 0.15
        assert source == 'employee'

    def test_service_rule_beats_default_rule(self, app):
        svc = _make_service()  # no inline rate
        rule = CommissionRule(scope='service', service_id=svc.id,
                              rate=0.35, effective_from=date(2026, 1, 1), is_active=True)
        db.session.add(rule)
        db.session.flush()
        engine = CommissionEngine(app)
        rate, source = engine.current_rate(service=svc)
        assert float(rate) == 0.35
        assert source == 'service'

    def test_default_rule_beats_app_default(self, app):
        engine = CommissionEngine(app)
        svc = _make_service()
        rule = CommissionRule(scope='default', rate=0.25,
                              effective_from=date(2026, 1, 1), is_active=True)
        db.session.add(rule)
        db.session.flush()
        rate, source = engine.current_rate(service=svc)
        assert float(rate) == 0.25
        assert source == 'default'


class TestEffectiveEndpoint:
    def test_effective_endpoint_employee_precedence(self, client, admin_hdr, agent_hdr):
        svc = _make_service(commission_rate=0.30)
        emp = _agent_employee()
        emp.default_commission_rate = 0.15
        r = client.get(f'/api/commissions/effective?service_id={svc.id}&employee_id={emp.id}',
                       headers=admin_hdr)
        assert r.status_code == 200
        data = r.get_json()
        assert float(data['rate']) == 0.15
        assert data['source'] == 'employee'


class TestTransactionCommission:
    def test_transaction_uses_seeded_service_rate(self, client, agent_token):
        # Birth Certificate seeded at 20% -> 900-500=400, 20%=80
        r = client.get('/api/services', headers={'Authorization': f'Bearer {agent_token}'})
        birth = [s for s in r.get_json()['items'] if s['name'] == 'Birth Certificate'][0]
        txn = _make_txn(client, agent_token, birth['id'])
        assert float(txn['gross_profit']) == 400.0
        assert float(txn['commission_amount']) == 80.0
        assert float(txn['company_profit']) == 320.0
        assert txn['commission_rate_used'] == 0.2
        assert txn['commission_source'] == 'service'

    def test_price_history_snapshot(self, client, admin_hdr, agent_token):
        r = client.get('/api/services', headers={'Authorization': f'Bearer {agent_token}'})
        birth = [s for s in r.get_json()['items'] if s['name'] == 'Birth Certificate'][0]
        txn = _make_txn(client, agent_token, birth['id'])
        # admin raises the price afterwards
        r = client.put(f"/api/services/{birth['id']}", headers=admin_hdr,
                       json={'customer_price': 1500})
        assert r.status_code == 200
        # original transaction must still reflect the old price
        r = client.get(f"/api/transactions/{txn['id']}", headers=admin_hdr)
        stored = r.get_json()['transaction']
        assert float(stored['customer_price']) == 900.0
        assert float(stored['gross_profit']) == 400.0