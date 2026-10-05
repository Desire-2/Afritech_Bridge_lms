"""Electronics shop module: catalogue, stock ledger, POS, returns, purchasing,
reports and the role boundaries that keep Shop data out of the other modules."""
import uuid

from app.extensions import db
from app.models import (
    Branch, PaymentMethod, Role, ShopProduct, ShopProductVariant,
    ShopInventoryBalance, ShopStockMovement, ShopProductPriceHistory,
)


def _login(client, email):
    r = client.post('/api/auth/login',
                    json={'email': email, 'password': 'Password123!'})
    assert r.status_code == 200, r.get_data(as_text=True)
    return r.get_json()['access_token']


def _hdr(token):
    return {'Authorization': f'Bearer {token}'}


def _tag():
    return uuid.uuid4().hex[:8].upper()


def _branch(code):
    row = Branch.query.filter_by(code=code).first()
    assert row is not None, f'branch {code} missing'
    return row.id


def _cash_method():
    row = PaymentMethod.query.filter_by(code='cash').first() \
        or PaymentMethod.query.filter_by(is_active=True).first()
    return row.id


def _shop_user(client, admin_hdr, role_code, email=None):
    """A real user holding ``role_code``, pinned to the Head Office branch."""
    email = email or f'{role_code}.{_tag().lower()}@shop.test'
    r = client.post('/api/users', headers=admin_hdr, json={
        'email': email, 'password': 'Password123!', 'roles': [role_code],
        'first_name': 'Shop', 'last_name': role_code.replace('_', ' ').title(),
        'branch_id': _branch('HQ'), 'must_change_password': False,
    })
    assert r.status_code == 201, r.get_data(as_text=True)
    return _hdr(_login(client, email)), email


def _create_product(client, hdr, *, cost=10000, price=18000, stock=10,
                    reorder=5, branch=None, serialized=False):
    """Product + one variant + opening stock; returns (product, variant)."""
    tag = _tag()
    # No SKU: the API mints one (ATB000001…) and derives the variant's from
    # it, which is how the Add Product form works now.
    body = {
        'name': f'Test item {tag}',
        'barcode': f'998{tag}', 'purchase_cost': cost, 'selling_price': price,
        'min_selling_price': round(price * 0.8, 2), 'reorder_level': reorder,
        'is_serialized': serialized,
        'variants': [{'name': 'Standard',
                      'barcode': f'999{tag}', 'purchase_cost': cost,
                      'selling_price': price}],
    }
    r = client.post('/api/shop/products', headers=hdr, json=body)
    assert r.status_code == 201, r.get_data(as_text=True)
    product = r.get_json()['product']

    r = client.get(f"/api/shop/products/{product['id']}", headers=hdr)
    assert r.status_code == 200, r.get_data(as_text=True)
    variant = r.get_json()['product']['variants'][0]

    if stock:
        r = client.post('/api/shop/inventory/adjustments', headers=hdr, json={
            'reason': 'found', 'direction': 'in',
            'branch_id': branch or _branch('HQ'),
            'items': [{'product_id': product['id'], 'variant_id': variant['id'],
                       'quantity': stock}],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
    return product, variant


def _balance(product_id, variant_id, branch_id):
    row = ShopInventoryBalance.query.filter_by(
        product_id=product_id, variant_id=variant_id,
        branch_id=branch_id).first()
    return int(row.quantity) if row else 0


def _sale(client, hdr, product, variant, quantity=1, discount_percent=0,
          branch=None, unit_price=None):
    unit_price = unit_price if unit_price is not None else product['selling_price']
    total = round(unit_price * quantity * (1 - discount_percent / 100), 2)
    r = client.post('/api/shop/sales', headers=hdr, json={
        'branch_id': branch or _branch('HQ'),
        'items': [{'product_id': product['id'], 'variant_id': variant['id'],
                   'quantity': quantity, 'discount_percent': discount_percent,
                   'tax_rate': 0, 'unit_price': unit_price}],
        'payments': [{'amount': total, 'payment_method_id': _cash_method()}],
    })
    return r


class TestCatalogue:
    def test_product_with_variant_and_opening_stock(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=7)

        assert product['variant_count'] == 1
        assert _balance(product['id'], variant['id'], _branch('HQ')) == 7
        assert product['sku'].startswith('ATB')

    def test_duplicate_sku_is_rejected(self, client, admin_hdr):
        product, _ = _create_product(client, admin_hdr, stock=0)
        r = client.post('/api/shop/products', headers=admin_hdr, json={
            'sku': product['sku'], 'name': 'Duplicate',
        })
        assert r.status_code == 409
        body = r.get_json()
        assert 'already exists' in body['error']
        assert body['code'] == 'duplicate_sku'
        assert body['existing']['id'] == product['id']

    def test_attendant_cannot_create_products(self, client, admin_hdr):
        attendant, _ = _shop_user(client, admin_hdr, 'shop_attendant')
        r = client.post('/api/shop/products', headers=attendant, json={
            'sku': f'NOPE-{_tag()}', 'name': 'Not allowed',
        })
        assert r.status_code == 403

    def test_seeded_catalogue_is_visible(self, client, admin_hdr):
        r = client.get('/api/shop/products', headers=admin_hdr)
        assert r.status_code == 200
        skus = [row['sku'] for row in r.get_json()['items']]
        assert 'PHN-SPARK-20' in skus, 'the dev seed should ship a catalogue'


class TestStockLedger:
    def test_overselling_is_refused_with_a_machine_code(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=3)
        r = client.post('/api/shop/inventory/adjustments', headers=admin_hdr,
                        json={
                            'reason': 'loss', 'direction': 'out',
                            'branch_id': _branch('HQ'),
                            'items': [{'product_id': product['id'],
                                       'variant_id': variant['id'],
                                       'quantity': 5}],
                        })
        assert r.status_code == 409
        body = r.get_json()
        assert body['code'] == 'insufficient_stock'
        assert _balance(product['id'], variant['id'], _branch('HQ')) == 3

    def test_sale_writes_a_ledger_row(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=6)
        r = _sale(client, admin_hdr, product, variant, quantity=2)
        assert r.status_code == 201, r.get_data(as_text=True)

        rows = ShopStockMovement.query.filter_by(
            product_id=product['id'], movement_type='sale').all()
        assert len(rows) == 1
        assert int(rows[0].quantity) == -2
        assert _balance(product['id'], variant['id'], _branch('HQ')) == 4

    def test_attendant_cannot_adjust_stock(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=4)
        attendant, _ = _shop_user(client, admin_hdr, 'shop_attendant')
        r = client.post('/api/shop/inventory/adjustments', headers=attendant,
                        json={
                            'reason': 'loss', 'direction': 'out',
                            'branch_id': _branch('HQ'),
                            'items': [{'product_id': product['id'],
                                       'variant_id': variant['id'],
                                       'quantity': 1}],
                        })
        assert r.status_code == 403
        assert _balance(product['id'], variant['id'], _branch('HQ')) == 4


class TestPos:
    def test_sale_records_payment_and_unique_number(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=8)
        first = _sale(client, admin_hdr, product, variant, quantity=2)
        second = _sale(client, admin_hdr, product, variant, quantity=1)
        assert first.status_code == 201 and second.status_code == 201

        a, b = first.get_json()['sale'], second.get_json()['sale']
        assert a['sale_number'] != b['sale_number']
        assert a['sale_number'].startswith('SAL-')
        assert a['amount_paid'] == a['total_amount']
        assert a['amount_due'] == 0
        assert _balance(product['id'], variant['id'], _branch('HQ')) == 5

    def test_attendant_discount_ceiling(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=5)
        attendant, _ = _shop_user(client, admin_hdr, 'shop_attendant')

        r = _sale(client, attendant, product, variant, quantity=1,
                  discount_percent=30)
        assert r.status_code == 403
        assert r.get_json()['code'] == 'discount_not_allowed'

        r = _sale(client, attendant, product, variant, quantity=1,
                  discount_percent=10)
        assert r.status_code == 201, r.get_data(as_text=True)
        sale = r.get_json()['sale']
        assert round(float(sale['discount_amount']), 2) == round(
            product['selling_price'] * 0.10, 2)

    def test_cannot_sell_more_than_is_on_hand(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=2)
        r = _sale(client, admin_hdr, product, variant, quantity=5)
        assert r.status_code == 409
        assert r.get_json()['code'] == 'insufficient_stock'

    def test_receipt_is_available_after_the_sale(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=4)
        sale = _sale(client, admin_hdr, product, variant, quantity=1)
        sale_id = sale.get_json()['sale']['id']
        r = client.get(f'/api/shop/sales/{sale_id}/receipt', headers=admin_hdr)
        assert r.status_code == 200
        assert 'receipt' in r.get_json()


class TestReturns:
    def test_approve_refunds_and_restocks(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=6)
        sale = _sale(client, admin_hdr, product, variant, quantity=3)
        payload = sale.get_json()['sale']
        item_id = payload['items'][0]['id']

        r = client.post('/api/shop/returns', headers=admin_hdr, json={
            'sale_id': payload['id'], 'return_type': 'refund',
            'reason': 'Box damaged on collection',
            'items': [{'sale_item_id': item_id, 'quantity': 1,
                       'condition': 'good', 'restock': True}],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        row = r.get_json()['return']

        r = client.post(f"/api/shop/returns/{row['id']}/approve",
                        headers=admin_hdr, json={'decision': 'approved'})
        assert r.status_code == 200, r.get_data(as_text=True)
        done = r.get_json()['return']
        assert done['status'] == 'completed'
        assert float(done['refund_amount']) > 0

        # the unit is back on the shelf and the sale shows the refund
        assert _balance(product['id'], variant['id'], _branch('HQ')) == 4
        refreshed = client.get(f"/api/shop/sales/{payload['id']}",
                               headers=admin_hdr).get_json()['sale']
        assert float(refreshed['amount_refunded']) > 0
        assert refreshed['status'] in ('partially_refunded', 'refunded')
        assert refreshed['items'][0]['returned_quantity'] == 1

    def test_cannot_return_more_than_was_sold(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=5)
        sale = _sale(client, admin_hdr, product, variant, quantity=1)
        payload = sale.get_json()['sale']
        r = client.post('/api/shop/returns', headers=admin_hdr, json={
            'sale_id': payload['id'], 'return_type': 'refund',
            'reason': 'changed my mind',
            'items': [{'sale_item_id': payload['items'][0]['id'],
                       'quantity': 4}],
        })
        assert r.status_code == 409
        assert r.get_json()['code'] == 'quantity_not_returnable'


class TestPurchasing:
    def test_purchase_order_cycle_restocks_and_recosts(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=2,
                                           cost=10000, price=18000)
        supplier = client.post('/api/shop/suppliers', headers=admin_hdr, json={
            'company_name': f'Supplier {_tag()}', 'phone': '+250788000000',
        })
        assert supplier.status_code == 201, supplier.get_data(as_text=True)
        supplier_id = supplier.get_json()['supplier']['id']

        r = client.post('/api/shop/purchases', headers=admin_hdr, json={
            'supplier_id': supplier_id, 'branch_id': _branch('HQ'),
            'items': [{'product_id': product['id'], 'variant_id': variant['id'],
                       'quantity': 10, 'unit_cost': 9000}],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        po = r.get_json()['purchase_order']

        for action in ('submit', 'approve'):
            r = client.post(f"/api/shop/purchases/{po['id']}/{action}",
                            headers=admin_hdr, json={})
            assert r.status_code == 200, r.get_data(as_text=True)

        r = client.post(f"/api/shop/purchases/{po['id']}/receive",
                        headers=admin_hdr, json={
                            'items': [{'product_id': product['id'],
                                       'variant_id': variant['id'],
                                       'quantity': 10, 'unit_cost': 9000}],
                            'supplier_invoice': 'INV-TEST',
                        })
        assert r.status_code == 201, r.get_data(as_text=True)

        assert _balance(product['id'], variant['id'], _branch('HQ')) == 12
        # receiving at a new unit cost recosts the variant and records history
        refreshed_variant = ShopProductVariant.query.get(variant['id'])
        assert float(refreshed_variant.purchase_cost) == 9000
        assert ShopProductPriceHistory.query.filter_by(
            product_id=product['id']).count() >= 1

    def test_cannot_receive_an_unapproved_order(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=1)
        supplier = client.post('/api/shop/suppliers', headers=admin_hdr, json={
            'company_name': f'Supplier {_tag()}'})
        supplier_id = supplier.get_json()['supplier']['id']
        r = client.post('/api/shop/purchases', headers=admin_hdr, json={
            'supplier_id': supplier_id, 'branch_id': _branch('HQ'),
            'items': [{'product_id': product['id'], 'variant_id': variant['id'],
                       'quantity': 5, 'unit_cost': 8000}],
        })
        po = r.get_json()['purchase_order']
        r = client.post(f"/api/shop/purchases/{po['id']}/receive",
                        headers=admin_hdr, json={
                            'items': [{'product_id': product['id'],
                                       'variant_id': variant['id'],
                                       'quantity': 5}]})
        assert r.status_code == 409


class TestTransfersAndCounts:
    def test_transfer_moves_units_between_branches(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=5)
        hq, other = _branch('HQ'), _branch('KGL')

        r = client.post('/api/shop/inventory/transfers', headers=admin_hdr,
                        json={'from_branch_id': hq, 'to_branch_id': other,
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

        assert _balance(product['id'], variant['id'], hq) == 3
        assert _balance(product['id'], variant['id'], other) == 2

    def test_count_approval_applies_the_variance(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=6)
        r = client.post('/api/shop/inventory/counts', headers=admin_hdr,
                        json={'branch_id': _branch('HQ'),
                              'product_ids': [product['id']]})
        assert r.status_code == 201, r.get_data(as_text=True)
        count_id = r.get_json()['count']['id']

        r = client.post(f'/api/shop/inventory/counts/{count_id}/submit',
                        headers=admin_hdr,
                        json={'counted': {str(product['id']): 8}})
        assert r.status_code == 200, r.get_data(as_text=True)
        r = client.post(f'/api/shop/inventory/counts/{count_id}/approve',
                        headers=admin_hdr, json={})
        assert r.status_code == 200, r.get_data(as_text=True)

        assert _balance(product['id'], variant['id'], _branch('HQ')) == 8


class TestAccessControl:
    def test_other_modules_cannot_reach_the_shop(self, client, admin_hdr):
        for email in ('agent@afritech.dev', 'secretary@afritech.dev',
                      'instructor@afritech.dev'):
            token = _login(client, email)
            r = client.get('/api/shop/dashboard', headers=_hdr(token))
            assert r.status_code == 403, f'{email} reached the shop workspace'
            r = client.get('/api/shop/products', headers=_hdr(token))
            assert r.status_code == 403

    def test_attendant_gets_operational_but_not_money(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=4)
        sale = _sale(client, admin_hdr, product, variant, quantity=1)
        sale_id = sale.get_json()['sale']['id']

        attendant, _ = _shop_user(client, admin_hdr, 'shop_attendant')
        r = client.get(f'/api/shop/sales/{sale_id}', headers=attendant)
        assert r.status_code == 200, r.get_data(as_text=True)
        payload = r.get_json()['sale']
        assert payload['total_amount'], 'the POS total must stay visible'
        assert 'amount_paid' not in payload, 'revenue is not the till operator\'s'
        assert 'cost_of_goods' not in payload

        r = client.get('/api/shop/reports/profitability', headers=attendant)
        assert r.status_code == 403
        r = client.get('/api/shop/inventory/balances', headers=attendant)
        assert r.status_code == 200

    def test_payment_methods_are_reachable_from_the_till(self, client, admin_hdr):
        # The POS needs tender options but shop roles hold no services.view.
        attendant, _ = _shop_user(client, admin_hdr, 'shop_attendant')
        r = client.get('/api/shop/payment-methods', headers=attendant)
        assert r.status_code == 200, r.get_data(as_text=True)
        codes = {m['code'] for m in r.get_json()['payment_methods']}
        assert 'cash' in codes

        token = _login(client, 'agent@afritech.dev')
        r = client.get('/api/shop/payment-methods', headers=_hdr(token))
        assert r.status_code == 403, 'shop config stays inside the shop module'

    def test_shop_roles_hold_only_their_own_permissions(self, client):
        attendant = Role.query.filter_by(code='shop_attendant').first()
        codes = {p.code for p in attendant.permissions}
        assert 'shop.sales.create' in codes
        assert 'shop.purchases.approve' not in codes
        assert 'shop.financial_reports.view' not in codes

        keeper = Role.query.filter_by(code='storekeeper').first()
        keeper_codes = {p.code for p in keeper.permissions}
        assert 'shop.inventory.transfer' in keeper_codes
        assert 'shop.sales.create' not in keeper_codes
        assert 'shop.purchases.approve' not in keeper_codes

        for code in ('service_agent', 'company_secretary', 'instructor'):
            role = Role.query.filter_by(code=code).first()
            leaked = {p.code for p in role.permissions if p.code.startswith('shop.')}
            assert leaked == set(), f'{code} must not hold shop permissions'


class TestReportsAndSettings:
    def test_dashboard_and_sales_report(self, client, admin_hdr):
        r = client.get('/api/shop/dashboard', headers=admin_hdr)
        assert r.status_code == 200
        body = r.get_json()
        for key in ('today', 'month', 'stock', 'pending'):
            assert key in body
        assert body['month']['transactions'] >= 1, 'the seed ships a fortnight of sales'

        r = client.get('/api/shop/reports/sales?group_by=day', headers=admin_hdr)
        assert r.status_code == 200
        assert r.get_json()['rows'], 'seeded sales should group into rows'

    def test_settings_validation_and_update(self, client, admin_hdr):
        r = client.get('/api/shop/settings', headers=admin_hdr)
        assert r.status_code == 200
        assert r.get_json()['costing_method'] in ('wac', 'fifo')

        r = client.put('/api/shop/settings', headers=admin_hdr, json={
            'shop.inventory.costing_method': 'something_else'})
        assert r.status_code == 400

        r = client.put('/api/shop/settings', headers=admin_hdr, json={
            'shop.inventory.costing_method': 'fifo'})
        assert r.status_code == 200
        assert r.get_json()['costing_method'] == 'fifo'

        r = client.put('/api/shop/settings', headers=admin_hdr, json={
            'shop.inventory.costing_method': 'wac'})
        assert r.status_code == 200

    def test_numbering_preview_returns_the_next_document(self, client, admin_hdr):
        r = client.get('/api/shop/settings/numbering-preview?kind=sale',
                       headers=admin_hdr)
        assert r.status_code == 200
        assert r.get_json()['next'].startswith('SAL-')

    def test_activities_are_reachable_and_scoped(self, client, admin_hdr):
        r = client.get('/api/shop/activities', headers=admin_hdr)
        assert r.status_code == 200
        rows = r.get_json()['items']
        assert rows, 'the seed and this suite both write shop audit rows'
        assert all(row['entity'].startswith('shop') for row in rows), rows
