"""Transaction list date-range filtering tests."""
from datetime import date, timedelta

from app.models import ServiceTransaction

from .test_correction_flow import _token, _hdr


class TestTransactionDateFilter:
    def test_list_returns_only_selected_date_range(self, client):
        agent = _token(client, 'agent@afritech.dev')
        manager = _token(client, 'manager@afritech.dev')

        d_in1 = (date.today() + timedelta(days=70)).isoformat()
        d_in2 = (date.today() + timedelta(days=71)).isoformat()
        d_out = (date.today() + timedelta(days=72)).isoformat()

        t1 = _make_txn(client, agent, d_in1)
        t2 = _make_txn(client, agent, d_in1)
        t3 = _make_txn(client, agent, d_in2)
        t4 = _make_txn(client, agent, d_out)

        r = client.get(f'/api/transactions?start={d_in1}&end={d_in2}', headers=_hdr(manager))
        assert r.status_code == 200
        body = r.get_json()
        ids = {t['id'] for t in body['items']}
        assert {t1, t2, t3} <= ids
        assert t4 not in ids
        assert body['total'] == len(ids)

        # range is inclusive on both ends
        r2 = client.get(f'/api/transactions?start={d_in1}&end={d_in1}', headers=_hdr(manager))
        ids2 = {t['id'] for t in r2.get_json()['items']}
        assert t1 in ids2 and t2 in ids2
        assert t3 not in ids2 and t4 not in ids2


def _make_txn(client, token, date_str, price=1000):
    pm = next(p for p in client.get('/api/services/payment-methods', headers=_hdr(token)).get_json()['payment_methods']
              if p['code'] == 'cash')
    svc = client.get('/api/services?per_page=5', headers=_hdr(token)).get_json()['items'][0]
    cli = client.get('/api/clients?per_page=5', headers=_hdr(token)).get_json()['items'][0]
    r = client.post('/api/transactions', headers=_hdr(token), json={
        'service_id': svc['id'],
        'client_id': cli['id'],
        'payment_method_id': pm['id'],
        'customer_price': price,
        'official_cost': price / 2,
        'transaction_date': date_str,
    })
    assert r.status_code == 201, r.get_data(as_text=True)
    return r.get_json()['transaction']['id']