"""Barcode scanning: symbology detection, catalogue writes, the unknown-scan
queue, POS snapshots, scanner settings and the permission edges around them."""
import pytest

from app.models import AuditLog, Notification, ShopUnknownBarcode, User
from app.services.barcode import (
    ShopBarcodeError, detect_format, normalize_barcode, validate_barcode,
)

from .test_shop import (
    _branch, _cash_method, _create_product, _shop_user, _tag,
)


def _scan_url(code, branch=None, context=None):
    url = f'/api/shop/products/barcode/{code}'
    params = []
    if branch is not None:
        params.append(f'branch_id={branch}')
    if context:
        params.append(f'context={context}')
    return url + ('?' + '&'.join(params) if params else '')


def _sale_payload(product, variant, barcode=None, quantity=1):
    entry = {'product_id': product['id'], 'variant_id': variant['id'],
             'quantity': quantity, 'tax_rate': 0,
             'unit_price': product['selling_price']}
    if barcode is not None:
        entry['barcode'] = barcode
    total = round(product['selling_price'] * quantity, 2)
    return {
        'branch_id': _branch('HQ'),
        'items': [entry],
        'payments': [{'amount': total,
                      'payment_method_id': _cash_method()}],
    }


class TestBarcodeService:
    def test_normalize_preserves_leading_zeros_and_drops_scanner_noise(self):
        assert normalize_barcode('  00012345678905\r\n') == '00012345678905'
        assert normalize_barcode('\t00012345678905') == '00012345678905'
        assert normalize_barcode('') is None
        assert normalize_barcode('   ') is None
        assert normalize_barcode(12345) == '12345'
        with pytest.raises(ShopBarcodeError):
            normalize_barcode('x' * 65)
        with pytest.raises(ShopBarcodeError):
            normalize_barcode('bad\x00code')

    def test_validate_rejects_empty_and_mismatched_formats(self):
        with pytest.raises(ShopBarcodeError):
            validate_barcode('')
        with pytest.raises(ShopBarcodeError):
            validate_barcode('123', 'EAN_13')
        with pytest.raises(ShopBarcodeError):
            validate_barcode('4006381333930', 'EAN_13')
        assert validate_barcode('4006381333931', 'EAN_13') == '4006381333931'
        assert validate_barcode('AB-000001', 'CODE_128') == 'AB-000001'

    def test_detect_format_real_world_vectors(self):
        cases = {
            '4006381333931': 'EAN_13',
            '5901234123457': 'EAN_13',
            '00012345678905': 'EAN_13',
            '036000291452': 'UPC_A',
            '96385074': 'EAN_8',
            '425261': 'UPC_E',
            '4006381333930': 'UNKNOWN',
            'AB-000001': 'UNKNOWN',
            'PICK-2026': 'UNKNOWN',
        }
        for value, expected in cases.items():
            assert detect_format(value) == expected, value


class TestProductBarcodeWrites:
    def test_create_normalizes_and_derives_identity(self, client, admin_hdr):
        r = client.post('/api/shop/products', headers=admin_hdr, json={
            'sku': f'BC-{_tag()}', 'name': 'Barcode vector product',
            'barcode': ' 00012345678905\n',
            'purchase_cost': 3000, 'selling_price': 5000,
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        product = r.get_json()['product']
        assert product['barcode'] == '00012345678905'
        assert product['barcode_format'] == 'EAN_13'
        assert product['barcode_type'] == 'external'

    def test_internal_code_stores_unknown_and_internal(self, client, admin_hdr):
        r = client.post('/api/shop/products', headers=admin_hdr, json={
            'sku': f'BC-{_tag()}', 'name': 'Internally coded product',
            'barcode': 'AB-000001',
            'purchase_cost': 1000, 'selling_price': 2000,
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        product = r.get_json()['product']
        assert product['barcode'] == 'AB-000001'
        assert product['barcode_format'] == 'UNKNOWN'
        assert product['barcode_type'] == 'internal'

    def test_duplicate_barcode_names_the_existing_row(self, client, admin_hdr):
        product, _ = _create_product(client, admin_hdr, stock=0)
        r = client.post('/api/shop/products', headers=admin_hdr, json={
            'sku': f'BC-{_tag()}', 'name': 'Copycat product',
            'barcode': product['barcode'],
        })
        assert r.status_code == 409
        body = r.get_json()
        assert body['code'] == 'duplicate_barcode'
        assert body['error'] == 'This barcode is already assigned to another product.'
        assert body['existing']['sku'] == product['sku']
        assert body['existing']['name'] == product['name']

    def test_variant_barcode_may_not_shadow_a_product(self, client, admin_hdr):
        product, _ = _create_product(client, admin_hdr, stock=0)
        r = client.post('/api/shop/products', headers=admin_hdr, json={
            'sku': f'BC-{_tag()}', 'name': 'Cross-table copycat',
            'selling_price': 1500,
            'variants': [{'name': 'Only', 'sku': f'BCV-{_tag()}',
                          'barcode': product['barcode']}],
        })
        assert r.status_code == 409
        body = r.get_json()
        assert body['code'] == 'duplicate_barcode'
        assert body['existing']['kind'] == 'product'

    def test_update_can_reassign_and_clear(self, client, admin_hdr):
        product, _ = _create_product(client, admin_hdr, stock=0)
        fresh = f'UP-{_tag()}'
        r = client.patch(f"/api/shop/products/{product['id']}",
                         headers=admin_hdr, json={'barcode': fresh})
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['product']['barcode'] == fresh

        r = client.patch(f"/api/shop/products/{product['id']}",
                         headers=admin_hdr, json={'barcode': ''})
        assert r.status_code == 200
        assert r.get_json()['product']['barcode'] is None


class TestBarcodeLookup:
    def test_attendant_lookup_redacts_costs_and_reports_stock(
            self, client, admin_hdr):
        product, _ = _create_product(client, admin_hdr, stock=7)
        attendant, _ = _shop_user(client, admin_hdr, 'shop_attendant')
        hq = _branch('HQ')

        r = client.get(_scan_url(product['barcode']), headers=attendant)
        assert r.status_code == 200, r.get_data(as_text=True)
        body = r.get_json()
        assert body['found'] is True
        assert body['match'] == 'barcode'
        assert body['barcode'] == product['barcode']
        assert body['barcode_format'] == 'UNKNOWN'
        assert body['product']['selling_price'] == product['selling_price']
        assert 'purchase_cost' not in body['product']
        assert body['available_stock'] == 7

        r = client.get(_scan_url(product['barcode'], branch=hq),
                       headers=attendant)
        body = r.get_json()
        assert body['branch_id'] == hq
        assert body['available_stock'] == 7
        assert 'branches' not in body

    def test_sku_match_reports_match_sku(self, client, admin_hdr):
        product, _ = _create_product(client, admin_hdr, stock=2)
        r = client.get(_scan_url(product['sku']), headers=admin_hdr)
        assert r.status_code == 200
        body = r.get_json()
        assert body['found'] is True
        assert body['match'] == 'sku'

    def test_unknown_scan_is_queued_and_warned_on_the_third_hit(
            self, client, admin_hdr):
        keeper, _ = _shop_user(client, admin_hdr, 'storekeeper')
        manager, manager_email = _shop_user(client, admin_hdr, 'shop_manager')
        manager_id = User.query.filter_by(email=manager_email).first().id
        code = f'UNK{_tag()}'
        hq = _branch('HQ')

        for expected in (1, 2):
            r = client.get(_scan_url(code, branch=hq, context='pos'),
                           headers=keeper)
            assert r.status_code == 200, r.get_data(as_text=True)
            body = r.get_json()
            assert body['found'] is False
            assert body['barcode'] == code
            assert body['barcode_format'] == 'UNKNOWN'
            assert body['message'] == (
                'No product with this barcode exists in the current inventory.')
            row = ShopUnknownBarcode.query.filter_by(barcode=code).one()
            assert int(row.times_scanned) == expected
            assert row.notified is False

        r = client.get(_scan_url(code, branch=hq, context='pos'),
                       headers=keeper)
        assert r.status_code == 200
        row = ShopUnknownBarcode.query.filter_by(barcode=code).one()
        assert int(row.times_scanned) == 3
        assert row.notified is True
        notes = Notification.query.filter_by(type='shop_unknown_barcode',
                                             recipient_id=manager_id).all()
        assert notes, 'the catalogue team must be warned on the third scan'
        assert any(code in note.message for note in notes)
        assert all(note.severity == 'warning' for note in notes)

        client.get(_scan_url(code, branch=hq, context='pos'), headers=keeper)
        notes_after = Notification.query.filter_by(
            type='shop_unknown_barcode', recipient_id=manager_id).count()
        assert notes_after == len(notes), 'the warning fires exactly once'

    def test_invalid_context_is_rejected(self, client, admin_hdr):
        r = client.get(_scan_url('ANYCODE', context='warehouse'),
                       headers=admin_hdr)
        assert r.status_code == 400
        assert r.get_json()['code'] == 'invalid_context'


class TestUnknownBarcodeQueue:
    def test_list_patch_and_register(self, client, admin_hdr):
        keeper, _ = _shop_user(client, admin_hdr, 'storekeeper')
        attendant, _ = _shop_user(client, admin_hdr, 'shop_attendant')
        code = f'Q{_tag()}'
        hq = _branch('HQ')
        client.get(_scan_url(code, branch=hq, context='count'), headers=keeper)
        row = ShopUnknownBarcode.query.filter_by(barcode=code).one()

        r = client.get('/api/shop/unknown-barcodes', headers=admin_hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        body = r.get_json()
        assert code in [item['barcode'] for item in body['items']]
        assert 'total' in body and 'page' in body

        r = client.patch(f'/api/shop/unknown-barcodes/{row.id}',
                         headers=attendant, json={'status': 'ignored'})
        assert r.status_code == 403

        r = client.patch(f'/api/shop/unknown-barcodes/{row.id}',
                         headers=admin_hdr, json={'status': 'ignored'})
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['unknown_barcode']['status'] == 'ignored'
        assert AuditLog.query.filter_by(
            action='shop_unknown_barcode_status_changed',
            entity='shop_unknown_barcode', entity_id=str(row.id)).count() >= 1

        r = client.get('/api/shop/unknown-barcodes?status=ignored',
                       headers=admin_hdr)
        assert code in [item['barcode'] for item in r.get_json()['items']]
        r = client.get('/api/shop/unknown-barcodes', headers=admin_hdr)
        assert code not in [item['barcode'] for item in r.get_json()['items']]

        r = client.patch(f'/api/shop/unknown-barcodes/{row.id}',
                         headers=admin_hdr, json={'status': 'registered'})
        assert r.status_code == 400
        assert r.get_json()['code'] == 'resolved_product_required'

        product, _ = _create_product(client, admin_hdr, stock=0)
        r = client.patch(f'/api/shop/unknown-barcodes/{row.id}',
                         headers=admin_hdr,
                         json={'status': 'registered',
                               'product_id': product['id']})
        assert r.status_code == 200, r.get_data(as_text=True)
        registered = r.get_json()['unknown_barcode']
        assert registered['status'] == 'registered'
        assert registered['resolved_product_id'] == product['id']
        assert registered['resolved_product_sku'] == product['sku']
        assert AuditLog.query.filter_by(
            action='shop_unknown_barcode_registered',
            entity='shop_unknown_barcode', entity_id=str(row.id)).count() >= 1

    def test_queue_filters_by_context_and_query(self, client, admin_hdr):
        keeper, _ = _shop_user(client, admin_hdr, 'storekeeper')
        code = f'SRCH{_tag()}'
        hq = _branch('HQ')
        client.get(_scan_url(code, branch=hq, context='receiving'),
                   headers=keeper)

        r = client.get('/api/shop/unknown-barcodes?context=receiving&q=%s'
                       % code, headers=admin_hdr)
        assert r.status_code == 200
        assert code in [item['barcode'] for item in r.get_json()['items']]

        r = client.get('/api/shop/unknown-barcodes?context=pos',
                       headers=admin_hdr)
        assert code not in [item['barcode'] for item in r.get_json()['items']]

        r = client.get('/api/shop/unknown-barcodes?status=nope',
                       headers=admin_hdr)
        assert r.status_code == 400


class TestAssignBarcodeEndpoint:
    def test_permissions_duplicates_and_clearing(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=0)
        attendant, _ = _shop_user(client, admin_hdr, 'shop_attendant')
        keeper, _ = _shop_user(client, admin_hdr, 'storekeeper')

        r = client.post(f"/api/shop/products/{product['id']}/barcode",
                        headers=attendant, json={'barcode': f'A-{_tag()}'})
        assert r.status_code == 403

        r = client.post(f"/api/shop/products/{product['id']}/barcode",
                        headers=keeper, json={'barcode': ''})
        assert r.status_code == 200
        assert r.get_json()['product']['barcode'] is None

        fresh = f'SK-{_tag()}'
        r = client.post(f"/api/shop/products/{product['id']}/barcode",
                        headers=keeper, json={'barcode': fresh})
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['product']['barcode'] == fresh
        assert AuditLog.query.filter_by(
            action='shop_barcode_registered', entity='shop_product',
            entity_id=str(product['id'])).count() >= 1

        variant_code = f'VK-{_tag()}'
        r = client.post(f"/api/shop/products/{product['id']}/barcode",
                        headers=keeper,
                        json={'barcode': variant_code,
                              'variant_id': variant['id']})
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['variant']['barcode'] == variant_code

        other, _ = _create_product(client, admin_hdr, stock=0)
        r = client.post(f"/api/shop/products/{product['id']}/barcode",
                        headers=keeper, json={'barcode': other['barcode']})
        assert r.status_code == 409
        body = r.get_json()
        assert body['code'] == 'duplicate_barcode'
        assert body['existing']['sku'] == other['sku']

        r = client.post(f"/api/shop/products/{product['id']}/barcode",
                        headers=keeper, json={})
        assert r.status_code == 400
        assert r.get_json()['code'] == 'barcode_required'

        r = client.post(f"/api/shop/products/{product['id']}/barcode",
                        headers=keeper, json={'barcode': ''})
        assert r.status_code == 200
        assert r.get_json()['product']['barcode'] is None
        assert AuditLog.query.filter_by(
            action='shop_barcode_changed', entity='shop_product',
            entity_id=str(product['id'])).count() >= 1

    def test_reassignment_writes_a_change_audit_row(self, client, admin_hdr):
        product, _ = _create_product(client, admin_hdr, stock=0)
        moved = f'MV-{_tag()}'
        r = client.post(f"/api/shop/products/{product['id']}/barcode",
                        headers=admin_hdr, json={'barcode': moved})
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['product']['barcode'] == moved
        assert AuditLog.query.filter_by(
            action='shop_barcode_changed', entity='shop_product',
            entity_id=str(product['id'])).count() >= 1


class TestPosBarcodeSnapshots:
    def test_sale_line_carries_the_snapshot_columns(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=5)
        r = client.post('/api/shop/sales', headers=admin_hdr,
                        json=_sale_payload(product, variant,
                                           barcode=product['barcode']))
        assert r.status_code == 201, r.get_data(as_text=True)
        item = r.get_json()['sale']['items'][0]
        assert item['barcode_at_sale'] == variant['barcode']
        assert item['sku_at_sale'] == variant['sku']
        assert item['product_name_at_sale'] == (
            f"{product['name']} — {variant['name']}")

    def test_barcode_of_another_product_is_rejected(self, client, admin_hdr):
        first, first_variant = _create_product(client, admin_hdr, stock=5)
        second, _ = _create_product(client, admin_hdr, stock=5)
        r = client.post('/api/shop/sales', headers=admin_hdr,
                        json=_sale_payload(first, first_variant,
                                           barcode=second['barcode']))
        assert r.status_code == 400
        body = r.get_json()
        assert body['code'] == 'barcode_mismatch'
        assert body['error'] == 'Barcode does not match the selected product'


class TestOutOfStockLookup:
    def test_zero_stock_is_found_but_cannot_be_sold(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=1)
        hq = _branch('HQ')
        r = client.post('/api/shop/inventory/adjustments', headers=admin_hdr,
                        json={
                            'reason': 'loss', 'direction': 'out',
                            'branch_id': hq,
                            'items': [{'product_id': product['id'],
                                       'variant_id': variant['id'],
                                       'quantity': 1}],
                        })
        assert r.status_code == 201, r.get_data(as_text=True)

        r = client.get(_scan_url(product['barcode'], branch=hq),
                       headers=admin_hdr)
        assert r.status_code == 200
        body = r.get_json()
        assert body['found'] is True
        assert body['available_stock'] == 0

        r = client.post('/api/shop/sales', headers=admin_hdr,
                        json=_sale_payload(product, variant, quantity=1))
        assert r.status_code == 409
        assert r.get_json()['code'] == 'insufficient_stock'


class TestScannerSettings:
    def test_scanner_profile_round_trip(self, client, admin_hdr):
        r = client.get('/api/shop/settings', headers=admin_hdr)
        assert r.status_code == 200
        scanner = r.get_json()['scanner']
        assert scanner['preferred_input'] == 'hardware'
        assert scanner['auto_add'] is True
        assert scanner['scan_timeout_ms'] == 800

        r = client.patch('/api/shop/settings', headers=admin_hdr, json={
            'shop.scanner': {'preferred_input': 'camera', 'sound': False}})
        assert r.status_code == 200, r.get_data(as_text=True)
        scanner = r.get_json()['scanner']
        assert scanner['preferred_input'] == 'camera'
        assert scanner['sound'] is False
        assert scanner['auto_add'] is True, 'stored values merge over defaults'

        r = client.patch('/api/shop/settings', headers=admin_hdr, json={
            'shop.scanner': {'preferred_input': 'projector'}})
        assert r.status_code == 400
        assert r.get_json()['code'] == 'invalid_setting_value'

        r = client.patch('/api/shop/settings', headers=admin_hdr, json={
            'shop.scanner': {'scan_timeout_ms': 50}})
        assert r.status_code == 400

        r = client.patch('/api/shop/settings', headers=admin_hdr, json={
            'shop.scanner': {'auto_add': 'yes'}})
        assert r.status_code == 400

        attendant, _ = _shop_user(client, admin_hdr, 'shop_attendant')
        r = client.patch('/api/shop/settings', headers=attendant, json={
            'shop.scanner': {'sound': True}})
        assert r.status_code == 403

        r = client.get('/api/shop/settings', headers=attendant)
        assert r.status_code == 200
        assert 'scanner' in r.get_json()


class TestPermissionSweep:
    def test_roles_without_shop_view_cannot_scan(self, client, admin_hdr):
        product, _ = _create_product(client, admin_hdr, stock=0)
        for role in ('company_secretary', 'service_agent'):
            hdr, _ = _shop_user(client, admin_hdr, role)
            r = client.get(_scan_url(product['barcode']), headers=hdr)
            assert r.status_code == 403, role

    def test_attendant_cannot_edit_products_but_can_scan(
            self, client, admin_hdr):
        product, _ = _create_product(client, admin_hdr, stock=3)
        attendant, _ = _shop_user(client, admin_hdr, 'shop_attendant')
        r = client.get(_scan_url(product['barcode']), headers=attendant)
        assert r.status_code == 200
        r = client.patch(f"/api/shop/products/{product['id']}",
                         headers=attendant, json={'barcode': f'X-{_tag()}'})
        assert r.status_code == 403
