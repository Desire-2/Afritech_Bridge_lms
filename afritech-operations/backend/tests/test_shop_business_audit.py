"""Business-logic audit of the electronics shop: regression tests.

Every test here pins a defect found during the audit — returns that could
cross a sale line or be approved twice, transfers that could receive twice or
strand stock in limbo, closings that double-subtracted discounts, POS inputs
that accepted negative money, and the two hard guarantees the shop leans on:
a unit can only be sold once and a sale line keeps the price it was sold at.

The "second till clicks the button" cases are reproduced deterministically:
``_stale_claim`` moves the row in the database behind the in-session instance
and then rewinds that instance to the status it held — exactly the snapshot a
racing request read a moment earlier.
"""
import threading
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select, update
from sqlalchemy.orm.attributes import set_committed_value

from app.extensions import db
from app.models import (
    ShopDailyClosing, ShopProductPriceHistory, ShopReturn, ShopSale,
    ShopSaleItem, ShopSerializedItem, ShopShift, ShopStockMovement,
    ShopStockTransfer,
)
from app.services.shop_inventory import ShopStockError, post_movement

from .test_shop import (
    _balance, _branch, _cash_method, _create_product, _sale, _shop_user, _tag,
)


def _pos_sale(client, hdr, product, variant, *, quantity=1,
              unit_price=None, tax_rate=0, discount_percent=0,
              discount_amount=0, serials=None, branch=None, payments=True,
              client_ref=None, hold=False, pay_amount=None):
    """POST a basket straight to the POS, with full control of every field.

    ``unit_price=None`` omits the field so the server prices the line from the
    catalogue — that is how a test proves a price change reaches the till.
    ``pay_amount`` covers that case, where the caller knows the new price but
    the local ``product`` dict still holds the old one.
    """
    omitted_price = unit_price is None
    unit_price = product['selling_price'] if omitted_price else unit_price
    line = {'product_id': product['id'], 'variant_id': variant['id'],
            'quantity': quantity, 'unit_price': unit_price,
            'tax_rate': tax_rate, 'discount_percent': discount_percent,
            'discount_amount': discount_amount}
    if serials:
        line['serials'] = serials
    if omitted_price:
        del line['unit_price']
    body = {'branch_id': branch or _branch('HQ'), 'items': [line], 'hold': hold}
    if client_ref:
        body['client_ref'] = client_ref
    if payments and not hold:
        if pay_amount is None:
            net = unit_price * quantity * (1 - discount_percent / 100) \
                - discount_amount
            pay_amount = round(net * (1 + tax_rate / 100), 2)
        body['payments'] = [{'amount': pay_amount,
                             'payment_method_id': _cash_method()}]
    return client.post('/api/shop/sales', headers=hdr, json=body)


def _stale_claim(model, row_id, stale_status, **values):
    """Put ``values`` on ``row_id`` the way a racing till would have seen them.

    The UPDATE is *committed*: a 409 response makes ``persist_side_effects``
    roll the session back (app/__init__.py), which would otherwise erase a
    merely-pending change the moment the losing request returns. The instance
    is then rewound with ``set_committed_value`` — not a plain assignment,
    which would mark it dirty and have the next flush write the stale status
    straight back.
    """
    db.session.execute(
        update(model).where(model.id == row_id).values(**values)
        .execution_options(synchronize_session=False))
    db.session.commit()
    row = model.query.get(row_id)
    set_committed_value(row, 'status', stale_status)
    return row


@pytest.fixture(autouse=True)
def _clock_skew_leeway(app):
    """Keep a token issued this second usable for the next few.

    The API decodes JWTs with ``JWT_DECODE_LEEWAY = 0`` and stamps ``nbf``
    with ``iat``, so a backward step of the wall clock — which this host takes
    roughly every 30s, ~0.75s at a time — makes a token minted a moment ago
    "not yet valid" and every following request 401s. The audit is not about
    clock discipline: the product finding (give ``JWT_DECODE_LEEWAY`` a few
    seconds) is written up in the handoff instead.
    """
    previous = app.config.get('JWT_DECODE_LEEWAY', 0)
    app.config['JWT_DECODE_LEEWAY'] = 5
    yield
    app.config['JWT_DECODE_LEEWAY'] = previous


class TestReturnsIntegrity:
    def test_return_cannot_reference_a_line_from_another_sale(
            self, client, admin_hdr):
        first, variant_a = _create_product(client, admin_hdr, stock=4)
        second, variant_b = _create_product(client, admin_hdr, stock=4)
        sale_a = _sale(client, admin_hdr, first, variant_a, quantity=2)
        sale_b = _sale(client, admin_hdr, second, variant_b, quantity=1)
        line_a = sale_a.get_json()['sale']['items'][0]['id']
        sale_b_id = sale_b.get_json()['sale']['id']

        r = client.post('/api/shop/returns', headers=admin_hdr, json={
            'sale_id': sale_b_id, 'return_type': 'refund',
            'reason': 'wrong sale line',
            'items': [{'sale_item_id': line_a, 'quantity': 1}],
        })
        assert r.status_code == 400, r.get_data(as_text=True)
        assert r.get_json()['code'] == 'item_not_on_sale'
        assert _balance(second['id'], variant_b['id'], _branch('HQ')) == 3

    def test_a_return_can_only_be_approved_once(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=6)
        hq = _branch('HQ')
        sale = _sale(client, admin_hdr, product, variant, quantity=2)
        payload = sale.get_json()['sale']
        r = client.post('/api/shop/returns', headers=admin_hdr, json={
            'sale_id': payload['id'], 'return_type': 'refund',
            'reason': 'customer changed their mind',
            'items': [{'sale_item_id': payload['items'][0]['id'],
                       'quantity': 2}],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        return_id = r.get_json()['return']['id']

        first = client.post(f'/api/shop/returns/{return_id}/approve',
                            headers=admin_hdr, json={'decision': 'approved'})
        assert first.status_code == 200, first.get_data(as_text=True)
        assert _balance(product['id'], variant['id'], hq) == 6

        again = client.post(f'/api/shop/returns/{return_id}/approve',
                            headers=admin_hdr, json={'decision': 'approved'})
        assert again.status_code == 409
        assert _balance(product['id'], variant['id'], hq) == 6
        refreshed = client.get(f'/api/shop/sales/{payload["id"]}',
                               headers=admin_hdr).get_json()['sale']
        assert float(refreshed['amount_refunded']) > 0
        assert refreshed['status'] in ('partially_refunded', 'refunded')

        # The race the pre-check cannot see: a second till that read the
        # return while it was still `requested`, by which time the first till
        # has already claimed it. Load the instance for its pre-claim
        # snapshot, then move the row underneath it.
        second_sale = _sale(client, admin_hdr, product, variant, quantity=1)
        second_payload = second_sale.get_json()['sale']
        r = client.post('/api/shop/returns', headers=admin_hdr, json={
            'sale_id': second_payload['id'], 'return_type': 'refund',
            'reason': 'dead on arrival',
            'items': [{'sale_item_id': second_payload['items'][0]['id'],
                       'quantity': 1}],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        racing_id = r.get_json()['return']['id']
        _stale_claim(ShopReturn, racing_id, 'requested', status='approved')

        racing = client.post(f'/api/shop/returns/{racing_id}/approve',
                             headers=admin_hdr, json={'decision': 'approved'})
        assert racing.status_code == 409, racing.get_data(as_text=True)
        assert racing.get_json()['code'] == 'return_already_processed'
        # Nothing was restocked and nothing was refunded a second time.
        assert _balance(product['id'], variant['id'], hq) == 5
        claimed_status = db.session.execute(
            select(ShopReturn.status).where(ShopReturn.id == racing_id)
        ).scalar()
        assert claimed_status == 'approved', 'the claim stopped it mid-flight'
        assert float(client.get(f'/api/shop/sales/{second_payload["id"]}',
                                headers=admin_hdr)
                     .get_json()['sale']['amount_refunded']) == 0

    def test_receiving_cannot_undo_a_completed_return(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=4)
        hq = _branch('HQ')
        sale = _sale(client, admin_hdr, product, variant, quantity=2)
        payload = sale.get_json()['sale']
        r = client.post('/api/shop/returns', headers=admin_hdr, json={
            'sale_id': payload['id'], 'return_type': 'refund',
            'reason': 'dead on arrival',
            'items': [{'sale_item_id': payload['items'][0]['id'],
                       'quantity': 2}],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        return_id = r.get_json()['return']['id']

        r = client.post(f'/api/shop/returns/{return_id}/approve',
                        headers=admin_hdr, json={'decision': 'approved'})
        assert r.status_code == 200, r.get_data(as_text=True)
        assert _balance(product['id'], variant['id'], hq) == 4

        # A counter that still shows `requested`: writing `received` over
        # `completed` would put the return back inside the set of statuses
        # `approve` accepts, and the units would be restocked a second time.
        _stale_claim(ShopReturn, return_id, 'requested', status='completed')
        r = client.post(f'/api/shop/returns/{return_id}/receive',
                        headers=admin_hdr, json={})
        assert r.status_code == 409, r.get_data(as_text=True)
        assert r.get_json()['code'] == 'return_already_processed'
        assert db.session.execute(
            select(ShopReturn.status).where(ShopReturn.id == return_id)
        ).scalar() == 'completed'
        assert _balance(product['id'], variant['id'], hq) == 4

        again = client.post(f'/api/shop/returns/{return_id}/approve',
                            headers=admin_hdr, json={'decision': 'approved'})
        assert again.status_code == 409, again.get_data(as_text=True)
        assert again.get_json()['code'] == 'return_already_processed'
        assert _balance(product['id'], variant['id'], hq) == 4
        assert float(client.get(f'/api/shop/sales/{payload["id"]}',
                                headers=admin_hdr)
                     .get_json()['sale']['amount_refunded']) > 0

    def test_full_refund_of_a_taxed_sale_reaches_refunded(
            self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=6,
                                           price=18000)
        sale = _pos_sale(client, admin_hdr, product, variant, quantity=2,
                         tax_rate=15)
        assert sale.status_code == 201, sale.get_data(as_text=True)
        payload = sale.get_json()['sale']
        total = float(payload['total_amount'])
        assert total == round(2 * 18000 * 1.15, 2)

        r = client.post(f'/api/shop/sales/{payload["id"]}/refund',
                        headers=admin_hdr, json={'reason': 'dead on arrival'})
        assert r.status_code == 201, r.get_data(as_text=True)
        body = r.get_json()
        # Tax came back with the goods: the refund matches what was paid, so
        # the sale can actually reach the `refunded` state.
        assert round(float(body['return']['refund_amount']), 2) == total
        assert float(body['return']['tax_returned']) > 0
        assert body['sale']['status'] == 'refunded'
        assert _balance(product['id'], variant['id'], _branch('HQ')) == 6

    def test_exchange_restocks_once_and_links_the_replacement(
            self, client, admin_hdr):
        outgoing, out_variant = _create_product(client, admin_hdr, stock=5,
                                                price=18000)
        incoming, in_variant = _create_product(client, admin_hdr, stock=5,
                                               price=12000)
        hq = _branch('HQ')
        sale = _pos_sale(client, admin_hdr, outgoing, out_variant, quantity=1)
        assert sale.status_code == 201, sale.get_data(as_text=True)
        payload = sale.get_json()['sale']

        r = client.post('/api/shop/returns', headers=admin_hdr, json={
            'sale_id': payload['id'], 'return_type': 'exchange',
            'reason': 'swapping for the cheaper model',
            'items': [{'sale_item_id': payload['items'][0]['id'],
                       'quantity': 1, 'condition': 'good'}],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        return_id = r.get_json()['return']['id']

        r = client.post(f'/api/shop/returns/{return_id}/approve',
                        headers=admin_hdr, json={
                            'decision': 'approved',
                            'exchange': {'items': [{
                                'product_id': incoming['id'],
                                'variant_id': in_variant['id'],
                                'quantity': 1, 'unit_price': 12000,
                                'tax_rate': 0, 'discount_percent': 0,
                                'discount_amount': 0}]},
                        })
        assert r.status_code == 200, r.get_data(as_text=True)
        body = r.get_json()
        assert body['exchange_sale']['sale_type'] == 'exchange'
        # One unit back on the shelf, one unit out for the replacement:
        # nothing is created or destroyed by the swap.
        assert _balance(outgoing['id'], out_variant['id'], hq) == 5
        assert _balance(incoming['id'], in_variant['id'], hq) == 4
        assert round(float(body['return']['refund_amount']), 2) == 6000.0

    def test_exchange_honours_the_discount_ceiling(self, client, admin_hdr):
        role_code = f'clerk_{_tag().lower()}'
        r = client.post('/api/users/roles', headers=admin_hdr, json={
            'code': role_code, 'name': 'Return clerk (audit)',
            'permissions': ['shop.view', 'shop.products.view',
                            'shop.inventory.view', 'shop.sales.view',
                            'shop.returns.view', 'shop.returns.create',
                            'shop.returns.approve'],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        clerk, _ = _shop_user(client, admin_hdr, role_code)

        outgoing, out_variant = _create_product(client, admin_hdr, stock=4,
                                                price=18000)
        incoming, in_variant = _create_product(client, admin_hdr, stock=4,
                                               price=12000)
        sale = _pos_sale(client, admin_hdr, outgoing, out_variant, quantity=1)
        payload = sale.get_json()['sale']
        r = client.post('/api/shop/returns', headers=clerk, json={
            'sale_id': payload['id'], 'return_type': 'exchange',
            'reason': 'swap',
            'items': [{'sale_item_id': payload['items'][0]['id'],
                       'quantity': 1, 'condition': 'good'}],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        return_id = r.get_json()['return']['id']

        r = client.post(f'/api/shop/returns/{return_id}/approve',
                        headers=clerk, json={
                            'decision': 'approved',
                            'exchange': {'discount_percent': 30,
                                         'items': [{
                                             'product_id': incoming['id'],
                                             'variant_id': in_variant['id'],
                                             'quantity': 1,
                                             'unit_price': 12000,
                                             'tax_rate': 0}]},
                        })
        assert r.status_code == 403, r.get_data(as_text=True)
        assert r.get_json()['code'] == 'discount_not_allowed'
        # The whole approval rolled back: nothing was restocked or sold.
        assert _balance(outgoing['id'], out_variant['id'],
                        _branch('HQ')) == 3

    def test_returning_a_serialized_unit_makes_it_sellable_again(
            self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=0,
                                           serialized=True)
        serial = f'SN-{_tag()}'
        r = client.post('/api/shop/inventory/serials', headers=admin_hdr, json={
            'serial_number': serial, 'product_id': product['id'],
            'variant_id': variant['id'], 'branch_id': _branch('HQ'),
            'add_to_stock': True, 'purchase_cost': 10000,
        })
        assert r.status_code == 201, r.get_data(as_text=True)

        sale = _pos_sale(client, admin_hdr, product, variant, quantity=1,
                         serials=[serial])
        assert sale.status_code == 201, sale.get_data(as_text=True)
        payload = sale.get_json()['sale']
        assert ShopSerializedItem.query.filter_by(
            serial_number=serial).first().status == 'sold'

        r = client.post(f'/api/shop/sales/{payload["id"]}/refund',
                        headers=admin_hdr, json={'reason': 'returned'})
        assert r.status_code == 201, r.get_data(as_text=True)
        freed = ShopSerializedItem.query.filter_by(serial_number=serial).first()
        assert freed.status == 'in_stock'
        assert freed.sale_item_id is None
        assert freed.sold_at is None

        # The unit can walk out of the shop a second time.
        again = _pos_sale(client, admin_hdr, product, variant, quantity=1,
                          serials=[serial])
        assert again.status_code == 201, again.get_data(as_text=True)


class TestTransfersAndCounts:
    def test_transfer_cannot_be_received_twice(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=5)
        hq, kgl = _branch('HQ'), _branch('KGL')
        r = client.post('/api/shop/inventory/transfers', headers=admin_hdr,
                        json={'from_branch_id': hq, 'to_branch_id': kgl,
                              'items': [{'product_id': product['id'],
                                         'variant_id': variant['id'],
                                         'quantity': 2}]})
        assert r.status_code == 201, r.get_data(as_text=True)
        transfer_id = r.get_json()['transfer']['id']

        for action in ('dispatch', 'receive'):
            r = client.post(
                f'/api/shop/inventory/transfers/{transfer_id}/{action}',
                headers=admin_hdr, json={})
            assert r.status_code == 200, r.get_data(as_text=True)
        assert _balance(product['id'], variant['id'], kgl) == 2

        again = client.post(
            f'/api/shop/inventory/transfers/{transfer_id}/receive',
            headers=admin_hdr, json={})
        assert again.status_code == 409, again.get_data(as_text=True)
        assert _balance(product['id'], variant['id'], kgl) == 2

        # …and the same for a request that read the transfer while it still
        # looked dispatched.
        second, variant2 = _create_product(client, admin_hdr, stock=3)
        r = client.post('/api/shop/inventory/transfers', headers=admin_hdr,
                        json={'from_branch_id': hq, 'to_branch_id': kgl,
                              'items': [{'product_id': second['id'],
                                         'variant_id': variant2['id'],
                                         'quantity': 1}]})
        race_id = r.get_json()['transfer']['id']
        client.post(f'/api/shop/inventory/transfers/{race_id}/dispatch',
                    headers=admin_hdr, json={})
        _stale_claim(ShopStockTransfer, race_id, 'dispatched',
                     status='received')
        racing = client.post(
            f'/api/shop/inventory/transfers/{race_id}/receive',
            headers=admin_hdr, json={})
        assert racing.status_code == 409, racing.get_data(as_text=True)
        assert racing.get_json()['code'] == 'transfer_already_received'
        assert _balance(second['id'], variant2['id'], kgl) == 0

    def test_receiving_more_than_left_the_branch_is_refused(
            self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=5)
        hq, kgl = _branch('HQ'), _branch('KGL')
        r = client.post('/api/shop/inventory/transfers', headers=admin_hdr,
                        json={'from_branch_id': hq, 'to_branch_id': kgl,
                              'items': [{'product_id': product['id'],
                                         'variant_id': variant['id'],
                                         'quantity': 2}]})
        assert r.status_code == 201, r.get_data(as_text=True)
        transfer_id = r.get_json()['transfer']['id']
        item_id = r.get_json()['transfer']['items'][0]['id']
        r = client.post(f'/api/shop/inventory/transfers/{transfer_id}/dispatch',
                        headers=admin_hdr, json={})
        assert r.status_code == 200, r.get_data(as_text=True)
        r = client.post(
            f'/api/shop/inventory/transfers/{transfer_id}/receive',
            headers=admin_hdr, json={'quantities': {str(item_id): 5}})
        assert r.status_code == 409, r.get_data(as_text=True)
        assert r.get_json()['code'] == 'received_exceeds_dispatched'
        assert _balance(product['id'], variant['id'], kgl) == 0

    def test_cancelling_a_dispatched_transfer_puts_the_units_back(
            self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=5)
        hq, kgl = _branch('HQ'), _branch('KGL')
        r = client.post('/api/shop/inventory/transfers', headers=admin_hdr,
                        json={'from_branch_id': hq, 'to_branch_id': kgl,
                              'items': [{'product_id': product['id'],
                                         'variant_id': variant['id'],
                                         'quantity': 2}]})
        transfer_id = r.get_json()['transfer']['id']
        r = client.post(
            f'/api/shop/inventory/transfers/{transfer_id}/dispatch',
            headers=admin_hdr, json={})
        assert r.status_code == 200, r.get_data(as_text=True)
        assert _balance(product['id'], variant['id'], hq) == 3

        r = client.post(
            f'/api/shop/inventory/transfers/{transfer_id}/cancel',
            headers=admin_hdr, json={})
        assert r.status_code == 200, r.get_data(as_text=True)
        # The units were already in transit: cancelling has to bring them home
        # or they vanish from both branches.
        assert _balance(product['id'], variant['id'], hq) == 5
        assert _balance(product['id'], variant['id'], kgl) == 0
        reversal = ShopStockMovement.query.filter_by(
            product_id=product['id'], movement_type='transfer_in',
            branch_id=hq, reference_type='stock_transfer',
            reference_id=transfer_id).all()
        assert len(reversal) == 1
        assert int(reversal[0].quantity) == 2

    def test_a_count_cannot_be_applied_twice(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=6)
        hq = _branch('HQ')
        r = client.post('/api/shop/inventory/counts', headers=admin_hdr,
                        json={'branch_id': hq,
                              'product_ids': [product['id']]})
        count_id = r.get_json()['count']['id']
        r = client.post(f'/api/shop/inventory/counts/{count_id}/submit',
                        headers=admin_hdr,
                        json={'counted': {str(product['id']): 8}})
        assert r.status_code == 200, r.get_data(as_text=True)
        r = client.post(f'/api/shop/inventory/counts/{count_id}/approve',
                        headers=admin_hdr, json={})
        assert r.status_code == 200, r.get_data(as_text=True)
        assert _balance(product['id'], variant['id'], hq) == 8

        again = client.post(f'/api/shop/inventory/counts/{count_id}/approve',
                            headers=admin_hdr, json={})
        assert again.status_code == 409
        assert _balance(product['id'], variant['id'], hq) == 8


class TestPurchasing:
    def test_purchase_order_does_not_add_stock(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=2)
        hq = _branch('HQ')
        supplier = client.post('/api/shop/suppliers', headers=admin_hdr,
                               json={'company_name': f'PO Audit {_tag()}'})
        supplier_id = supplier.get_json()['supplier']['id']

        r = client.post('/api/shop/purchases', headers=admin_hdr, json={
            'supplier_id': supplier_id, 'branch_id': hq,
            'items': [{'product_id': product['id'], 'variant_id': variant['id'],
                       'quantity': 10, 'unit_cost': 9000}],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        po_id = r.get_json()['purchase_order']['id']
        assert _balance(product['id'], variant['id'], hq) == 2

        for action in ('submit', 'approve'):
            r = client.post(f'/api/shop/purchases/{po_id}/{action}',
                            headers=admin_hdr, json={})
            assert r.status_code == 200, r.get_data(as_text=True)
            assert _balance(product['id'], variant['id'], hq) == 2, \
                'stock must only grow when goods are physically received'

        r = client.post(f'/api/shop/purchases/{po_id}/receive',
                        headers=admin_hdr, json={
                            'items': [{'product_id': product['id'],
                                       'variant_id': variant['id'],
                                       'quantity': 10, 'unit_cost': 9000}]})
        assert r.status_code == 201, r.get_data(as_text=True)
        assert _balance(product['id'], variant['id'], hq) == 12

    def test_supplier_return_cannot_be_completed_twice(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=3)
        hq = _branch('HQ')
        supplier = client.post('/api/shop/suppliers', headers=admin_hdr,
                               json={'company_name': f'Ret Audit {_tag()}'})
        supplier_id = supplier.get_json()['supplier']['id']

        r = client.post('/api/shop/supplier-returns', headers=admin_hdr, json={
            'supplier_id': supplier_id, 'branch_id': hq,
            'items': [{'product_id': product['id'], 'variant_id': variant['id'],
                       'quantity': 1}],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        row_id = r.get_json()['supplier_return']['id']

        first = client.post(f'/api/shop/supplier-returns/{row_id}/complete',
                            headers=admin_hdr, json={})
        assert first.status_code == 200, first.get_data(as_text=True)
        assert _balance(product['id'], variant['id'], hq) == 2

        again = client.post(f'/api/shop/supplier-returns/{row_id}/complete',
                            headers=admin_hdr, json={})
        assert again.status_code == 409, again.get_data(as_text=True)
        assert again.get_json()['code'] == 'supplier_return_completed'
        assert _balance(product['id'], variant['id'], hq) == 2


class TestPosPricing:
    def test_negative_price_tax_and_discount_are_refused(self, client,
                                                         admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=3)
        hq = _branch('HQ')

        r = _pos_sale(client, admin_hdr, product, variant, unit_price=-100)
        assert r.status_code == 400, r.get_data(as_text=True)
        assert r.get_json()['code'] == 'invalid_price'

        r = _pos_sale(client, admin_hdr, product, variant, tax_rate=-15)
        assert r.status_code == 400, r.get_data(as_text=True)
        assert r.get_json()['code'] == 'invalid_tax_rate'

        r = client.post('/api/shop/sales', headers=admin_hdr, json={
            'branch_id': hq,
            'items': [{'product_id': product['id'],
                       'variant_id': variant['id'], 'quantity': 1,
                       'unit_price': product['selling_price'],
                       'tax_rate': 0}],
            'payments': [{'amount': product['selling_price'],
                          'payment_method_id': _cash_method()}],
            'discount_percent': -50,
        })
        assert r.status_code == 400, r.get_data(as_text=True)
        assert r.get_json()['code'] == 'invalid_discount'
        assert _balance(product['id'], variant['id'], hq) == 3

    def test_the_same_client_ref_records_one_sale(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=4)
        hq = _branch('HQ')
        body = {
            'branch_id': hq, 'client_ref': f'ref-{_tag()}',
            'items': [{'product_id': product['id'],
                       'variant_id': variant['id'], 'quantity': 2,
                       'unit_price': product['selling_price'], 'tax_rate': 0}],
            'payments': [{'amount': round(2 * product['selling_price'], 2),
                          'payment_method_id': _cash_method()}],
        }
        first = client.post('/api/shop/sales', headers=admin_hdr, json=body)
        assert first.status_code == 201, first.get_data(as_text=True)
        second = client.post('/api/shop/sales', headers=admin_hdr, json=body)
        assert second.status_code == 200, second.get_data(as_text=True)
        assert second.get_json()['duplicate'] is True
        assert second.get_json()['sale']['id'] == first.get_json()['sale']['id']
        assert _balance(product['id'], variant['id'], hq) == 2
        assert ShopSale.query.filter_by(branch_id=hq,
                                        client_ref=body['client_ref']).count() \
            == 1

    def test_held_basket_reserves_stock_and_cancelling_frees_it(
            self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=2)
        hq = _branch('HQ')

        held = _pos_sale(client, admin_hdr, product, variant, quantity=2,
                         hold=True)
        assert held.status_code == 201, held.get_data(as_text=True)
        held_id = held.get_json()['sale']['id']
        stock = client.get(f'/api/shop/inventory/stock/{product["id"]}',
                           headers=admin_hdr,
                           query_string={'branch_id': hq}).get_json()['stock']
        assert stock['on_hand'] == 2
        assert stock['reserved'] == 2
        assert stock['available'] == 0

        blocked = _pos_sale(client, admin_hdr, product, variant, quantity=1)
        assert blocked.status_code == 409, blocked.get_data(as_text=True)
        assert blocked.get_json()['code'] == 'insufficient_stock'

        r = client.post(f'/api/shop/sales/{held_id}/cancel',
                        headers=admin_hdr, json={'reason': 'walked away'})
        assert r.status_code == 200, r.get_data(as_text=True)
        stock = client.get(f'/api/shop/inventory/stock/{product["id"]}',
                           headers=admin_hdr,
                           query_string={'branch_id': hq}).get_json()['stock']
        assert stock['available'] == 2

        sold = _pos_sale(client, admin_hdr, product, variant, quantity=1)
        assert sold.status_code == 201, sold.get_data(as_text=True)


class TestShiftAndClosingFigures:
    def _open_shift(self, client, admin_hdr, branch_id):
        row = (ShopShift.query
               .filter_by(branch_id=branch_id, status='open')
               .order_by(ShopShift.id.desc()).first())
        if row is not None:
            return row.id
        r = client.post('/api/shop/shifts', headers=admin_hdr,
                        json={'branch_id': branch_id, 'opening_float': 0})
        assert r.status_code == 201, r.get_data(as_text=True)
        return r.get_json()['shift']['id']

    def test_shift_figures_ignore_held_and_cancelled_sales(
            self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=6)
        hq = _branch('HQ')
        shift_id = self._open_shift(client, admin_hdr, hq)
        before = client.get(f'/api/shop/shifts/{shift_id}',
                            headers=admin_hdr).get_json()['shift']['figures']

        sold = _pos_sale(client, admin_hdr, product, variant, quantity=1)
        assert sold.status_code == 201, sold.get_data(as_text=True)
        held = _pos_sale(client, admin_hdr, product, variant, quantity=2,
                         hold=True)
        assert held.status_code == 201, held.get_data(as_text=True)
        cancelled = client.post(f'/api/shop/sales/{held.get_json()["sale"]["id"]}/cancel',
                                headers=admin_hdr,
                                json={'reason': 'audit'})
        assert cancelled.status_code == 200, cancelled.get_data(as_text=True)

        after = client.get(f'/api/shop/shifts/{shift_id}',
                           headers=admin_hdr).get_json()['shift']['figures']
        # Only the sale that actually rang up counts towards the drawer.
        assert round(float(after['total_sales'])
                     - float(before['total_sales']), 2) \
            == round(float(sold.get_json()['sale']['total_amount']), 2)
        assert shift_id  # figures were read for a real, open shift

    def test_closing_net_sales_does_not_take_the_discount_off_twice(
            self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=4)
        hq = _branch('HQ')
        sale = _pos_sale(client, admin_hdr, product, variant, quantity=2,
                         discount_percent=10)
        assert sale.status_code == 201, sale.get_data(as_text=True)

        r = client.post('/api/shop/closings', headers=admin_hdr, json={
            'business_date': datetime.now(timezone.utc).date().isoformat(),
            'branch_id': hq, 'counted_cash': 0,
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        body = r.get_json()['closing']
        gross = float(body['gross_sales'])
        assert float(body['discounts']) > 0, 'this sale discounted the basket'
        assert round(float(body['net_sales']), 2) == round(
            gross - float(body['refunds']), 2)
        assert round(gross, 2) >= round(float(
            sale.get_json()['sale']['total_amount']), 2)

    def test_an_approved_closing_cannot_be_rejected(self, client, admin_hdr):
        hq = _branch('HQ')
        business_date = (datetime.now(timezone.utc).date()
                         + timedelta(days=5)).isoformat()
        stale = ShopDailyClosing.query.filter_by(
            branch_id=hq, business_date=business_date).first()
        if stale is not None:
            db.session.delete(stale)
            db.session.commit()

        r = client.post('/api/shop/closings', headers=admin_hdr, json={
            'business_date': business_date, 'branch_id': hq,
            'counted_cash': 0,
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        closing_id = r.get_json()['closing']['id']

        r = client.post(f'/api/shop/closings/{closing_id}/approve',
                        headers=admin_hdr, json={})
        assert r.status_code == 200, r.get_data(as_text=True)

        r = client.post(f'/api/shop/closings/{closing_id}/reject',
                        headers=admin_hdr, json={'note': 'changed my mind'})
        assert r.status_code == 409, r.get_data(as_text=True)
        assert r.get_json()['code'] == 'closing_already_approved'
        assert ShopDailyClosing.query.get(closing_id).status == 'approved'


class TestSnapshotsAndConcurrency:
    def test_sale_line_keeps_its_price_after_a_catalogue_change(
            self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=4,
                                           cost=10000, price=18000)
        sale = _sale(client, admin_hdr, product, variant, quantity=2)
        assert sale.status_code == 201, sale.get_data(as_text=True)
        payload = sale.get_json()['sale']
        line = payload['items'][0]

        r = client.patch(f'/api/shop/variants/{variant["id"]}',
                         headers=admin_hdr, json={
                             'selling_price': 25000, 'purchase_cost': 14000,
                             'reason': 'supplier price rise',
                         })
        assert r.status_code == 200, r.get_data(as_text=True)

        # Priced by the catalogue this time: the field is omitted entirely so
        # the server has to pick up the new 25000.
        sold_again = _pos_sale(client, admin_hdr, product, variant, quantity=1,
                               unit_price=None, pay_amount=25000)
        assert sold_again.status_code == 201, sold_again.get_data(as_text=True)

        historical = ShopSaleItem.query.get(line['id'])
        assert float(historical.unit_price) == 18000
        assert float(historical.unit_cost) == 10000
        assert float(historical.line_total) == 36000
        refreshed = client.get(f'/api/shop/sales/{payload["id"]}',
                               headers=admin_hdr).get_json()['sale']
        assert round(float(refreshed['items'][0]['unit_price']), 2) == 18000
        assert round(float(sold_again.get_json()['sale']['items'][0]
                           ['unit_price']), 2) == 25000
        assert ShopProductPriceHistory.query.filter_by(
            product_id=product['id']).count() >= 1

    def test_a_serial_cannot_walk_out_twice(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=0,
                                           serialized=True)
        serial = f'SN-{_tag()}'
        r = client.post('/api/shop/inventory/serials', headers=admin_hdr, json={
            'serial_number': serial, 'product_id': product['id'],
            'variant_id': variant['id'], 'branch_id': _branch('HQ'),
            'add_to_stock': True, 'purchase_cost': 10000,
        })
        assert r.status_code == 201, r.get_data(as_text=True)

        first = _pos_sale(client, admin_hdr, product, variant, quantity=1,
                          serials=[serial])
        assert first.status_code == 201, first.get_data(as_text=True)
        second = _pos_sale(client, admin_hdr, product, variant, quantity=1,
                           serials=[serial])
        assert second.status_code == 409, second.get_data(as_text=True)
        assert second.get_json()['code'] == 'serial_unavailable'
        assert _balance(product['id'], variant['id'], _branch('HQ')) == 0

    def test_two_tills_racing_for_the_last_unit_sell_it_once(
            self, client, admin_hdr, app):
        product, variant = _create_product(client, admin_hdr, stock=1)
        hq = _branch('HQ')
        results = []

        def sell(barrier):
            try:
                with app.app_context():
                    barrier.wait(timeout=10)
                    try:
                        post_movement(product_id=product['id'], branch_id=hq,
                                      variant_id=variant['id'],
                                      movement_type='sale', quantity=-1)
                        db.session.commit()
                        results.append('sold')
                    except ShopStockError as error:
                        db.session.rollback()
                        results.append(error.code)
            except Exception as error:  # pragma: no cover - diagnostics
                results.append(f'unexpected:{error}')

        # SQLite may report a lock clash instead of a clean shortfall; retry
        # until one till wins so the assertion is about overselling, not about
        # which error the loser happened to see first.
        for _ in range(5):
            if results.count('sold') >= 1:
                break
            barrier = threading.Barrier(2)
            threads = [threading.Thread(target=sell, args=(barrier,))
                       for _ in range(2)]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join(timeout=30)

        assert results.count('sold') == 1, results
        assert set(results) <= {'sold', 'insufficient_stock',
                                'inventory_locked'}, results
        assert _balance(product['id'], variant['id'], hq) == 0
        sold = ShopStockMovement.query.filter_by(product_id=product['id'],
                                                 movement_type='sale').count()
        assert sold == 1, 'the last unit must be sold exactly once'
