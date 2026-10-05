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

class TestCommissionSnapshotIntegrity:
    """Historical commission must survive edits but die with refunds."""

    def _create(self, client, token, price=10000, cost=4000, date_str=None):
        from datetime import date as _date
        pm = next(p for p in client.get('/api/services/payment-methods',
                                        headers=_hdr(token)).get_json()['payment_methods']
                  if p['code'] == 'cash')
        svc = client.get('/api/services?per_page=5', headers=_hdr(token)).get_json()['items'][0]
        cli = client.get('/api/clients?per_page=5', headers=_hdr(token)).get_json()['items'][0]
        r = client.post('/api/transactions', headers=_hdr(token), json={
            'service_id': svc['id'],
            'client_id': cli['id'],
            'payment_method_id': pm['id'],
            'customer_price': price,
            'official_cost': cost,
            'transaction_date': date_str or _date.today().isoformat(),
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        return r.get_json()['transaction']['id']

    def _get(self, client, token, txn_id):
        return client.get(f'/api/transactions/{txn_id}',
                          headers=_hdr(token)).get_json()['transaction']

    def test_price_edit_keeps_snapshotted_rate(self, client):
        """Changing historical money must not re-rate against today's card."""
        from datetime import date as _date, timedelta as _td
        agent = _token(client, 'agent@afritech.dev')
        manager = _token(client, 'manager@afritech.dev')
        # Edits are only allowed on a date whose closing is correction_requested.
        # +60 days: test_correction_flow owns today+5/+6 and other near dates
        # for this same agent, and a closing exists once per employee/day.
        edit_date = (_date.today() + _td(days=60)).isoformat()
        txn_id = self._create(client, agent, date_str=edit_date)
        r = client.post('/api/closings/submit', headers=_hdr(agent),
                        json={'closing_date': edit_date, 'actual_cash': 0})
        assert r.status_code == 201, r.get_data(as_text=True)
        closing_id = r.get_json()['closing']['id']
        r = client.post(f'/api/closings/{closing_id}/review', headers=_hdr(manager),
                        json={'decision': 'correction_requested', 'note': 'fix'})
        assert r.status_code == 200, r.get_data(as_text=True)
        before = self._get(client, manager, txn_id)
        rate_before = before['commission_rate_used']

        # try a different service so today's rate resolution would differ if used
        r = client.put(f'/api/transactions/{txn_id}', headers=_hdr(manager), json={
            'customer_price': 20000,
            'official_cost': 8000,
        })
        assert r.status_code == 200, r.get_data(as_text=True)
        after = self._get(client, manager, txn_id)

        assert float(after['commission_rate_used']) == float(rate_before), \
            'price edit re-rated the commission against the current rate card'
        # amounts moved with the new money, still consistent with the old rate
        gross = 20000 - 8000
        assert float(after['gross_profit']) == gross
        assert float(after['commission_amount']) == gross * float(rate_before)

    def test_refund_nullifies_commission_but_keeps_snapshot(self, client):
        agent = _token(client, 'agent@afritech.dev')
        manager = _token(client, 'manager@afritech.dev')
        txn_id = self._create(client, agent)
        before = self._get(client, manager, txn_id)
        assert float(before['commission_amount']) > 0

        r = client.post(f'/api/transactions/{txn_id}/status', headers=_hdr(manager),
                        json={'status': 'refunded', 'reason': 'test refund'})
        assert r.status_code == 200, r.get_data(as_text=True)
        after = self._get(client, manager, txn_id)

        assert after['status'] == 'refunded'
        assert float(after['commission_amount']) == 0, \
            'payroll would pay commission on refunded revenue'
        assert float(after['company_profit']) == 0
        # audit snapshot survives
        assert float(after['gross_profit']) == float(before['gross_profit'])
        assert float(after['commission_rate_used']) == float(before['commission_rate_used'])

    def test_cancel_then_complete_restores_commission(self, client):
        agent = _token(client, 'agent@afritech.dev')
        manager = _token(client, 'manager@afritech.dev')
        txn_id = self._create(client, agent)
        before = self._get(client, manager, txn_id)

        r = client.post(f'/api/transactions/{txn_id}/status', headers=_hdr(manager),
                        json={'status': 'cancelled', 'reason': 'mistake'})
        assert r.status_code == 200
        cancelled = self._get(client, manager, txn_id)
        assert float(cancelled['commission_amount']) == 0

        r2 = client.post(f'/api/transactions/{txn_id}/status', headers=_hdr(manager),
                         json={'status': 'completed'})
        assert r2.status_code == 200, r2.get_data(as_text=True)
        restored = self._get(client, manager, txn_id)
        assert float(restored['commission_amount']) == float(before['commission_amount'])
        assert float(restored['commission_rate_used']) == float(before['commission_rate_used'])
