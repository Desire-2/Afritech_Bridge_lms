"""Correction flow: request modification -> agent edits transactions -> re-run closing.

Covers the full workflow: submit -> correction_requested -> edit transaction ->
re-submit with recalculated totals -> approve (locks further edits).
"""
from datetime import date, timedelta

from app.extensions import db
from app.models import ServiceTransaction


# Use future dates so no dev-seed transactions overlap the test data.
CLOSING_DATE = (date.today() + timedelta(days=5)).isoformat()
ANOTHER_DATE = (date.today() + timedelta(days=6)).isoformat()


def _token(client, email):
    r = client.post('/api/auth/login', json={'email': email, 'password': 'Password123!'})
    return r.get_json()['access_token']


def _hdr(token):
    return {'Authorization': f'Bearer {token}'}


def _make_cash_transaction(client, token, date_str, price=2000):
    """Create one cash transaction for the agent on the given date."""
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
    return r.get_json()['transaction']


class TestCorrectionFlow:
    def test_full_correction_re_run_flow(self, client):
        agent = _token(client, 'agent@afritech.dev')
        manager = _token(client, 'manager@afritech.dev')

        txn = _make_cash_transaction(client, agent, CLOSING_DATE, price=2000)

        # agent submits the closing
        r = client.post('/api/closings/submit', headers=_hdr(agent),
                        json={'closing_date': CLOSING_DATE, 'actual_cash': 2000})
        assert r.status_code == 201, r.get_data(as_text=True)
        closing = r.get_json()['closing']
        assert closing['status'] == 'submitted'
        assert closing['expected_cash'] == 2000
        assert closing['expected_cash'] == closing['actual_cash']
        assert closing['reconciliation_class'] == 'exact'

        # manager requests modification
        r = client.post(f"/api/closings/{closing['id']}/review", headers=_hdr(manager),
                        json={'decision': 'correction_requested', 'note': 'Price is wrong'})
        assert r.status_code == 200
        assert r.get_json()['closing']['status'] == 'correction_requested'
        assert r.get_json()['closing']['is_locked'] is False

        # agent edits the transaction while correction is requested
        r = client.put(f"/api/transactions/{txn['id']}", headers=_hdr(agent),
                       json={'customer_price': 2500})
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['transaction']['customer_price'] == 2500

        # agent re-runs the closing -> totals recalc to the new price
        r = client.post('/api/closings/submit', headers=_hdr(agent),
                        json={'closing_date': CLOSING_DATE, 'actual_cash': 2500})
        assert r.status_code == 201, r.get_data(as_text=True)
        closing = r.get_json()['closing']
        assert closing['status'] == 'submitted'
        assert closing['expected_cash'] == 2500
        assert closing['is_locked'] is False

        # manager approves -> locked
        r = client.post(f"/api/closings/{closing['id']}/review", headers=_hdr(manager),
                        json={'decision': 'approved', 'note': 'ok'})
        assert r.status_code == 200
        assert r.get_json()['closing']['status'] == 'approved'
        assert r.get_json()['closing']['is_locked'] is True

        # edits are now blocked by the approved closing
        r = client.put(f"/api/transactions/{txn['id']}", headers=_hdr(agent),
                       json={'customer_price': 3000})
        assert r.status_code == 400
        assert 'closing' in r.get_json()['error']

    def test_edit_blocked_while_closing_submitted(self, client):
        agent = _token(client, 'agent@afritech.dev')
        txn = _make_cash_transaction(client, agent, ANOTHER_DATE, price=1500)
        r = client.post('/api/closings/submit', headers=_hdr(agent),
                        json={'closing_date': ANOTHER_DATE, 'actual_cash': 1500})
        assert r.status_code == 201

        # pending-review closing blocks transaction edits
        r = client.put(f"/api/transactions/{txn['id']}", headers=_hdr(agent),
                       json={'customer_price': 2000})
        assert r.status_code == 400
        assert 'closing' in r.get_json()['error']

    def test_can_edit_without_any_closing(self, client):
        agent = _token(client, 'agent@afritech.dev')
        txn = _make_cash_transaction(client, agent, (date.today() + timedelta(days=7)).isoformat(), price=1200)
        r = client.put(f"/api/transactions/{txn['id']}", headers=_hdr(agent),
                       json={'reference': 'edited-ref', 'notes': 'fixed after review'})
        assert r.status_code == 200, r.get_data(as_text=True)
        updated = r.get_json()['transaction']
        assert updated['reference'] == 'edited-ref'
        assert updated['notes'] == 'fixed after review'
        # untouched amounts stay stable
        assert updated['customer_price'] == 1200

    def test_non_owner_without_permission_cannot_edit(self, client):
        accountant = _token(client, 'accountant@afritech.dev')
        txn = ServiceTransaction.query.filter(ServiceTransaction.status == 'completed').first()
        r = client.put(f"/api/transactions/{txn.id}", headers=_hdr(accountant),
                       json={'customer_price': 9999})
        assert r.status_code == 403

    def test_move_txn_updates_payment_paid_at(self, client):
        agent = _token(client, 'agent@afritech.dev')
        old_date = (date.today() + timedelta(days=55)).isoformat()
        new_date = (date.today() + timedelta(days=56)).isoformat()
        txn = _make_cash_transaction(client, agent, old_date, price=2000)

        r = client.get(f"/api/transactions/{txn['id']}", headers=_hdr(agent))
        paid_at = r.get_json()['transaction']['payments'][0]['paid_at']
        assert paid_at[:10] != new_date  # payment timestamp pre-dates the move

        r = client.put(f"/api/transactions/{txn['id']}", headers=_hdr(agent),
                       json={'transaction_date': new_date})
        assert r.status_code == 200, r.get_data(as_text=True)

        r = client.get(f"/api/transactions/{txn['id']}", headers=_hdr(agent))
        paid_at = r.get_json()['transaction']['payments'][0]['paid_at']
        assert paid_at[:10] == new_date

    def test_edit_recalculates_commission(self, client):
        agent = _token(client, 'agent@afritech.dev')
        txn = _make_cash_transaction(client, agent, (date.today() + timedelta(days=8)).isoformat(), price=2000)
        before = client.get(f"/api/transactions/{txn['id']}", headers=_hdr(agent)).get_json()['transaction']
        assert before['gross_profit'] == 1000

        r = client.put(f"/api/transactions/{txn['id']}", headers=_hdr(agent),
                       json={'official_cost': 500})
        assert r.status_code == 200, r.get_data(as_text=True)
        after = r.get_json()['transaction']
        assert after['official_cost'] == 500
        assert after['gross_profit'] == 1500
        assert after['commission_amount'] == round(1500 * after['commission_rate_used'], 2)

    def test_move_txn_blocked_when_target_date_closing_submitted(self, client):
        agent = _token(client, 'agent@afritech.dev')
        free_date = (date.today() + timedelta(days=50)).isoformat()
        target_date = (date.today() + timedelta(days=51)).isoformat()
        txn = _make_cash_transaction(client, agent, free_date, price=1500)

        # a submitted closing exists on the target date
        r = client.post('/api/closings/submit', headers=_hdr(agent),
                        json={'closing_date': target_date, 'actual_cash': 0})
        assert r.status_code == 201, r.get_data(as_text=True)

        # moving the transaction into that date must be blocked
        r = client.put(f"/api/transactions/{txn['id']}", headers=_hdr(agent),
                       json={'transaction_date': target_date})
        assert r.status_code == 400, r.get_data(as_text=True)
        assert 'locks transactions' in r.get_json()['error']

    def test_move_txn_out_of_correction_recomputes_closing(self, client):
        agent = _token(client, 'agent@afritech.dev')
        move_date = (date.today() + timedelta(days=52)).isoformat()
        closing_date = (date.today() + timedelta(days=53)).isoformat()
        free_date = (date.today() + timedelta(days=54)).isoformat()
        txn2 = _make_cash_transaction(client, agent, closing_date, price=1000)
        txn1 = _make_cash_transaction(client, agent, closing_date, price=2000)

        r = client.post('/api/closings/submit', headers=_hdr(agent),
                        json={'closing_date': closing_date, 'actual_cash': 3000})
        assert r.status_code == 201, r.get_data(as_text=True)
        closing_id = r.get_json()['closing']['id']
        assert r.get_json()['closing']['transaction_count'] == 2

        manager = _token(client, 'manager@afritech.dev')
        r = client.post(f'/api/closings/{closing_id}/review', headers=_hdr(manager),
                        json={'decision': 'correction_requested', 'note': 'move one out'})
        assert r.status_code == 200
        assert r.get_json()['closing']['is_locked'] is False

        # move txn2 to a free date; the old closing snapshot must drop it
        r = client.put(f"/api/transactions/{txn2['id']}", headers=_hdr(agent),
                       json={'transaction_date': free_date})
        assert r.status_code == 200, r.get_data(as_text=True)

        closing = client.get(f'/api/closings/{closing_id}', headers=_hdr(agent)).get_json()['closing']
        assert closing['transaction_count'] == 1
        assert closing['expected_cash'] == 2000