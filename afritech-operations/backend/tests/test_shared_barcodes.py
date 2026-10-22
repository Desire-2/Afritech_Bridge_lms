"""Shared barcodes: one printed code across several rebranded rows.

A GS1 code identifies a *design* as its registering company defined it — in
the real world the same EAN-13 is printed on units that ship in different
brands' boxes (phone covers are the classic case). Storage therefore no
longer enforces one-row-per-barcode; these tests pin the contract that
replaced it:

* creation / patch / assignment / SKU minting refuse a taken code until the
  caller says ``allow_shared_barcode``, and then name *every* owner;
* scans never guess — an ambiguous lookup answers with candidates and lets
  the station choose;
* SKU reservations stay per-operator, so two staff preparing two products
  for one shared code never inherit each other's number.
"""
from app.models import ShopSkuReservation, ShopUnknownBarcode
from app.services.shop_sku import (
    consume_reservation, generate_product_sku, reserve_sku,
)

from .test_shop import _branch, _cash_method, _create_product, _tag


def _sale_payload(product, quantity=1, variant=None):
    entry = {'product_id': product['id'], 'quantity': quantity,
             'tax_rate': 0, 'unit_price': product['selling_price']}
    if variant is not None:
        entry['variant_id'] = variant['id']
    total = round(product['selling_price'] * quantity, 2)
    return {
        'branch_id': _branch('HQ'),
        'items': [entry],
        'payments': [{'amount': total,
                      'payment_method_id': _cash_method()}],
    }


def _create_twin(client, hdr, barcode, *, price=2000):
    """A second product deliberately carrying ``barcode``."""
    r = client.post('/api/shop/products', headers=hdr, json={
        'name': f'Other brand {_tag()}', 'barcode': barcode,
        'selling_price': price, 'allow_shared_barcode': True,
    })
    assert r.status_code == 201, r.get_data(as_text=True)
    return r.get_json()['product']


# ── creation ──────────────────────────────────────────────────────────────────

class TestSharedBarcodeCreation:
    def test_confirmation_is_required_and_names_every_owner(
            self, client, admin_hdr):
        first, _ = _create_product(client, admin_hdr, stock=0)

        r = client.post('/api/shop/products', headers=admin_hdr, json={
            'name': 'Rebranded twin', 'barcode': first['barcode'],
        })
        assert r.status_code == 409
        body = r.get_json()
        assert body['code'] == 'duplicate_barcode'
        assert body['error'] == 'This barcode is already assigned to another product.'
        assert body['existing']['sku'] == first['sku']
        assert [c['id'] for c in body['candidates']] == [first['id']]

    def test_allow_shared_barcode_stores_both_rows(self, client, admin_hdr):
        first, _ = _create_product(client, admin_hdr, stock=0)
        twin = _create_twin(client, admin_hdr, first['barcode'])
        assert twin['barcode'] == first['barcode']
        assert twin['sku'] != first['sku'], 'each row keeps its own ATB SKU'

        r = client.get(f'/api/shop/products/barcode/{first["barcode"]}',
                       headers=admin_hdr)
        body = r.get_json()
        assert body['found'] is True
        assert body['ambiguous'] is True
        assert 'product' not in body, 'an ambiguous scan must not pick a row'
        assert len(body['candidates']) == 2
        assert {c['product']['id'] for c in body['candidates']} \
            == {first['id'], twin['id']}

    def test_a_single_owner_keeps_the_flat_shape(self, client, admin_hdr):
        first, _ = _create_product(client, admin_hdr, stock=0)

        r = client.get(f'/api/shop/products/barcode/{first["barcode"]}',
                       headers=admin_hdr)
        body = r.get_json()
        assert body['found'] is True
        assert body['ambiguous'] is False
        assert body['product']['id'] == first['id']
        assert body['available_stock'] == 0

    def test_an_ambiguous_scan_is_not_an_unknown_one(self, client, admin_hdr):
        first, _ = _create_product(client, admin_hdr, stock=0)
        _create_twin(client, admin_hdr, first['barcode'])
        code = first['barcode']

        r = client.get(f'/api/shop/products/barcode/{code}?context=pos',
                       headers=admin_hdr)
        assert r.get_json()['ambiguous'] is True
        assert ShopUnknownBarcode.query.filter_by(barcode=code).count() == 0

    def test_shadowing_its_own_parent_is_refused_even_when_asked(
            self, client, admin_hdr):
        code = f'SHADOW-{_tag()}'
        r = client.post('/api/shop/products', headers=admin_hdr, json={
            'name': f'Shadow {_tag()}', 'barcode': code,
            'allow_shared_barcode': True,
            'variants': [{'name': 'Only', 'barcode': code}],
        })
        assert r.status_code == 409, r.get_data(as_text=True)
        body = r.get_json()
        assert body['code'] == 'duplicate_barcode'
        assert body['existing']['kind'] == 'product'
        assert body['existing']['product_id'] is not None
        # Rolled back whole: no half-created row keeps the code.
        lookup = client.get(f'/api/shop/products/barcode/{code}',
                            headers=admin_hdr)
        assert lookup.get_json()['found'] is False

    def test_a_variant_of_another_product_may_share_when_asked(
            self, client, admin_hdr):
        first, _ = _create_product(client, admin_hdr, stock=0)

        r = client.post('/api/shop/products', headers=admin_hdr, json={
            'name': f'Shared variant {_tag()}', 'selling_price': 900,
            'allow_shared_barcode': True,
            'variants': [{'name': 'Same design',
                          'barcode': first['barcode']}],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        created = r.get_json()['product']
        r = client.get(f"/api/shop/products/{created['id']}",
                       headers=admin_hdr)
        variant = r.get_json()['product']['variants'][0]
        assert variant['barcode'] == first['barcode']


# ── patch & assign ────────────────────────────────────────────────────────────

class TestSharedBarcodePatchAndAssign:
    def test_patch_refuses_then_takes_the_code_with_confirmation(
            self, client, admin_hdr):
        first, _ = _create_product(client, admin_hdr, stock=0)
        other, _ = _create_product(client, admin_hdr, stock=0)

        r = client.patch(f"/api/shop/products/{other['id']}",
                         headers=admin_hdr,
                         json={'barcode': first['barcode']})
        assert r.status_code == 409
        body = r.get_json()
        assert body['code'] == 'duplicate_barcode'
        assert [c['id'] for c in body['candidates']] == [first['id']]

        r = client.patch(f"/api/shop/products/{other['id']}",
                         headers=admin_hdr,
                         json={'barcode': first['barcode'],
                               'allow_shared_barcode': True})
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['product']['barcode'] == first['barcode']

    def test_assign_endpoint_lists_candidates_then_shares(
            self, client, admin_hdr):
        first, _ = _create_product(client, admin_hdr, stock=0)
        other, _ = _create_product(client, admin_hdr, stock=0)

        r = client.post(f"/api/shop/products/{other['id']}/barcode",
                        headers=admin_hdr,
                        json={'barcode': first['barcode']})
        assert r.status_code == 409
        body = r.get_json()
        assert body['code'] == 'duplicate_barcode'
        assert body['existing']['sku'] == first['sku']
        assert len(body['candidates']) == 1

        r = client.post(f"/api/shop/products/{other['id']}/barcode",
                        headers=admin_hdr,
                        json={'barcode': first['barcode'],
                              'allow_shared_barcode': True})
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['product']['barcode'] == first['barcode']


# ── SKU minting ───────────────────────────────────────────────────────────────

class TestSharedBarcodeSkuMinting:
    def test_generate_sku_reports_owners_then_mints_when_asked(
            self, client, admin_hdr):
        first, _ = _create_product(client, admin_hdr, stock=0)
        twin = _create_twin(client, admin_hdr, first['barcode'])

        r = client.post('/api/shop/products/generate-sku',
                        headers=admin_hdr,
                        json={'barcode': first['barcode']})
        body = r.get_json()
        assert r.status_code == 200
        assert body['exists'] is True
        assert 'sku' not in body, 'a held barcode must not mint by default'
        assert {c['product']['id'] for c in body['candidates']} \
            == {first['id'], twin['id']}
        assert body['message'] == 'This barcode already belongs to 2 products.'

        r = client.post('/api/shop/products/generate-sku',
                        headers=admin_hdr,
                        json={'barcode': first['barcode'],
                              'allow_shared_barcode': True})
        body = r.get_json()
        assert r.status_code == 200
        assert body['sku'].startswith('ATB')
        assert body['exists'] is True
        assert body['shared'] is True
        first_sku = body['sku']

        again = client.post('/api/shop/products/generate-sku',
                            headers=admin_hdr,
                            json={'barcode': first['barcode'],
                                  'allow_shared_barcode': True})
        assert again.get_json()['sku'] == first_sku
        assert again.get_json()['reserved'] is True

    def test_two_operators_mint_different_skus_for_one_code(self):
        code = f'TWOOP-{_tag()}'
        mine, mine_reserved = reserve_sku(code, user_id=11)
        theirs, theirs_reserved = reserve_sku(code, user_id=22)
        assert not mine_reserved and not theirs_reserved
        assert mine != theirs, 'a colleague must not inherit your pending SKU'
        assert reserve_sku(code, user_id=11) == (mine, True)

    def test_consume_never_clears_a_colleagues_hold(self):
        code = f'CONSUME-{_tag()}'
        mine, _ = reserve_sku(code, user_id=11)
        theirs, _ = reserve_sku(code, user_id=22)

        swapped = generate_product_sku()
        assert consume_reservation(swapped, code, user_id=11) == 1
        assert ShopSkuReservation.query.filter_by(sku=mine).count() == 0
        assert ShopSkuReservation.query.filter_by(sku=theirs).count() == 1


# ── selling ───────────────────────────────────────────────────────────────────

class TestSharedBarcodeSales:
    def test_a_sale_rings_up_the_candidate_it_names(self, client, admin_hdr):
        first, _ = _create_product(client, admin_hdr, stock=0)
        twin = _create_twin(client, admin_hdr, first['barcode'], price=2500)

        r = client.post('/api/shop/inventory/adjustments', headers=admin_hdr,
                        json={'reason': 'found', 'direction': 'in',
                              'branch_id': _branch('HQ'),
                              'items': [{'product_id': twin['id'],
                                         'quantity': 5}]})
        assert r.status_code == 201, r.get_data(as_text=True)

        scan = client.get(f'/api/shop/products/barcode/{first["barcode"]}',
                          headers=admin_hdr).get_json()
        stocks = {c['product']['id']: c['available_stock']
                  for c in scan['candidates']}
        assert stocks == {first['id']: 0, twin['id']: 5}

        r = client.post('/api/shop/sales', headers=admin_hdr,
                        json=_sale_payload(twin, quantity=1))
        assert r.status_code == 201, r.get_data(as_text=True)

    def test_an_id_less_sale_line_with_a_shared_code_is_ambiguous(
            self, client, admin_hdr):
        first, _ = _create_product(client, admin_hdr, stock=0)
        _create_twin(client, admin_hdr, first['barcode'])
        payload = _sale_payload(first, quantity=1)
        payload['items'] = [{'sku': first['barcode'], 'quantity': 1,
                             'tax_rate': 0, 'unit_price': 100}]

        r = client.post('/api/shop/sales', headers=admin_hdr, json=payload)
        assert r.status_code == 409, r.get_data(as_text=True)
        assert r.get_json()['code'] == 'ambiguous_barcode'
