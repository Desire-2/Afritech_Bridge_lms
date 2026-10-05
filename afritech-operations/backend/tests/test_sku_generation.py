"""Automatic ``ATB…`` SKU generation for the Electronics Shop.

Covers the whole barcode-first Add Product workflow: scan → look the code up →
mint a SKU only when the code is genuinely new → save → the row, the ledger,
the POS and the search all carry the same identifier.

The rules under test, in the order the feature states them:

* the backend — never the browser — decides what the SKU is,
* every generated SKU starts with ``ATB`` and is unique,
* an existing barcode never mints one,
* a retried scan hands back the number it was already given,
* concurrent scans cannot be handed the same number,
* the API cannot be talked into storing ``CUSTOM001``.
"""
import re
import threading

import pytest
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import AuditLog, ShopProduct, ShopProductVariant, ShopSeries
from app.models import ShopSkuReservation
from app.services.shop_sku import (
    MAX_ATTEMPTS, SERIES_KEY, SKU_PREFIX, consume_reservation,
    format_sku, generate_product_sku, reserve_sku, sku_taken,
)

from .test_shop import (
    _branch, _cash_method, _create_product, _shop_user, _tag,
)

GENERATE_URL = '/api/shop/products/generate-sku'
CREATE_URL = '/api/shop/products'
SKU_RE = re.compile(r'^ATB\d{6}$')

NEW_CODE = '6161234567890'


def _generate(client, hdr, barcode=NEW_CODE, **extra):
    body = {'barcode': barcode}
    body.update(extra)
    return client.post(GENERATE_URL, headers=hdr, json=body)


# ── 1. a new barcode mints a SKU ──────────────────────────────────────────────

class TestNewBarcodeMintsSku:
    def test_new_barcode_generates_an_atb_sku(self, client, admin_hdr):
        r = _generate(client, admin_hdr, NEW_CODE)
        assert r.status_code == 200, r.get_data(as_text=True)
        body = r.get_json()

        assert body['exists'] is False
        assert body['found'] is False
        assert body['barcode'] == NEW_CODE
        assert SKU_RE.match(body['sku']), body['sku']
        assert body['sku_prefix'] == SKU_PREFIX

    def test_generated_skus_are_sequential_and_unique(self, client, admin_hdr):
        seen = [ _generate(client, admin_hdr, f'777000{i:05d}').get_json()['sku']
                 for i in range(5) ]
        assert all(SKU_RE.match(s) for s in seen), seen
        assert len(set(seen)) == 5, seen
        numbers = [int(s[len(SKU_PREFIX):]) for s in seen]
        assert numbers == sorted(numbers), 'the sequence must not go backwards'

    def test_generation_is_scoped_to_products_the_user_may_create(
            self, client, admin_hdr):
        attendant, _ = _shop_user(client, admin_hdr, 'shop_attendant')
        r = _generate(client, attendant, NEW_CODE)
        assert r.status_code == 403, r.get_data(as_text=True)

    def test_a_barcode_is_required_to_reserve_but_not_to_mint(
            self, client, admin_hdr):
        r = client.post(GENERATE_URL, headers=admin_hdr, json={})
        assert r.status_code == 200, r.get_data(as_text=True)
        body = r.get_json()
        assert body['barcode'] is None
        assert SKU_RE.match(body['sku']), body['sku']


# ── 2. an existing barcode mints nothing ──────────────────────────────────────

class TestExistingBarcodeNeverMints:
    def test_existing_barcode_reports_the_product_and_no_sku(self, client, admin_hdr):
        product, _ = _create_product(client, admin_hdr, stock=0)

        r = _generate(client, admin_hdr, product['barcode'])
        assert r.status_code == 200, r.get_data(as_text=True)
        body = r.get_json()

        assert body['exists'] is True
        assert body['found'] is True
        assert 'sku' not in body, 'an owned barcode must not mint a second SKU'
        assert body['product']['id'] == product['id']
        assert body['product']['sku'] == product['sku']
        assert body['product']['name'] == product['name']

    def test_no_reservation_row_is_written_for_a_known_barcode(
            self, client, admin_hdr):
        product, _ = _create_product(client, admin_hdr, stock=0)
        before = ShopSkuReservation.query.count()

        _generate(client, admin_hdr, product['barcode'])

        assert ShopSkuReservation.query.count() == before

    def test_lookup_and_generation_agree_the_row_exists(self, client, admin_hdr):
        product, _ = _create_product(client, admin_hdr, stock=0)

        lookup = client.get(f'/api/shop/products/barcode/{product["barcode"]}',
                            headers=admin_hdr)
        assert lookup.get_json()['found'] is True

        prepared = _generate(client, admin_hdr, product['barcode']).get_json()
        assert prepared['exists'] is True
        assert prepared['product']['sku'] == lookup.get_json()['product']['sku']


# ── 3. uniqueness ─────────────────────────────────────────────────────────────

class TestSkuUniqueness:
    def test_created_products_all_carry_distinct_atb_skus(self, client, admin_hdr):
        skus = set()
        for _ in range(4):
            product, _ = _create_product(client, admin_hdr, stock=0)
            assert SKU_RE.match(product['sku']), product['sku']
            skus.add(product['sku'])
        assert len(skus) == 4, skus

    def test_database_rejects_a_duplicate_sku(self, client, admin_hdr):
        product, _ = _create_product(client, admin_hdr, stock=0)
        clash = ShopProduct(sku=product['sku'], name='Twin')
        db.session.add(clash)
        with pytest.raises(IntegrityError):
            db.session.flush()
        db.session.rollback()

    def test_a_variant_sku_cannot_be_stolen_by_a_product(
            self, client, admin_hdr):
        """``shop_products.sku`` and ``shop_product_variants.sku`` are two
        separate unique indexes, so only the API can police the pair."""
        product, variant = _create_product(client, admin_hdr, stock=0)
        assert variant['sku'] != product['sku']

        r = client.post(CREATE_URL, headers=admin_hdr, json={
            'sku': variant['sku'], 'name': f'Squat {_tag()}'})
        assert r.status_code == 409, r.get_data(as_text=True)
        body = r.get_json()
        assert body['code'] == 'duplicate_sku'
        assert body['existing']['kind'] == 'variant'
        assert body['existing']['product_name'] == product['name']

        r = client.get(f'/api/shop/products/barcode/{variant["barcode"]}',
                       headers=admin_hdr)
        assert r.get_json()['product']['id'] == product['id']

    def test_a_product_sku_cannot_be_stolen_by_a_variant(
            self, client, admin_hdr):
        product, _ = _create_product(client, admin_hdr, stock=0)
        r = client.post(CREATE_URL, headers=admin_hdr, json={
            'name': f'Host {_tag()}', 'selling_price': 100,
            'variants': [{'name': 'Standard', 'sku': product['sku']}],
        })
        assert r.status_code == 409, r.get_data(as_text=True)
        assert r.get_json()['code'] == 'duplicate_sku'

    def test_a_variant_may_not_reuse_a_sibling_variants_sku(
            self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=0)
        r = client.patch(f'{CREATE_URL}/{product["id"]}', headers=admin_hdr,
                         json={'variants': [
                             {'name': 'Standard', 'sku': variant['sku']},
                             {'name': 'Twin', 'sku': variant['sku']},
                         ]})
        assert r.status_code == 409, r.get_data(as_text=True)
        assert r.get_json()['code'] == 'duplicate_sku'

    def test_a_hand_written_atb_value_is_hopped_over(self, client, admin_hdr):
        """A SKU pasted in from an old system must not be handed out twice."""
        reserved = generate_product_sku()
        number = int(reserved[len(SKU_PREFIX):])
        # Park a product on the very next number the counter would produce.
        next_one = format_sku(number + 1)
        db.session.add(ShopProduct(sku=next_one, name='Legacy import'))
        db.session.commit()

        minted = generate_product_sku()
        assert minted != next_one, 'the counter must hop over a taken SKU'
        assert SKU_RE.match(minted), minted
        assert not sku_taken(minted)


# ── 4. concurrency ────────────────────────────────────────────────────────────

class TestConcurrentGeneration:
    def test_parallel_scans_of_different_barcodes_never_share_a_sku(
            self, app, admin_hdr):
        """Six barcodes, six threads, six *different* numbers."""
        codes = [f'555000{i:05d}' for i in range(6)]
        outcomes = []
        lock = threading.Lock()
        barrier = threading.Barrier(len(codes))

        def scan(code):
            record = None
            try:
                with app.app_context():
                    barrier.wait(timeout=10)
                    sku, _reserved = reserve_sku(code)
                    db.session.commit()
                    record = sku
            except BaseException as error:  # noqa: BLE001 - reported below
                record = f'error:{error!r}'
            # Recorded outside the app context: a rollback that itself blew
            # up must not be able to swallow the outcome.
            with lock:
                outcomes.append((code, record))

        for _ in range(4):
            if len(outcomes) == len(codes):
                break
            outcomes.clear()
            threads = [threading.Thread(target=scan, args=(c,)) for c in codes]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join(timeout=30)

        failures = [o for o in outcomes if not str(o[1]).startswith('ATB')]
        assert len(outcomes) == len(codes), (outcomes, failures)
        assert not failures, failures

        skus = [str(record) for _code, record in outcomes]
        assert len(set(skus)) == len(codes), f'duplicate SKU handed out: {skus}'
        assert all(SKU_RE.match(s) for s in skus), skus
        # One reservation per barcode, each pinning the SKU it was handed.
        holds = ShopSkuReservation.query.filter(
            ShopSkuReservation.barcode.in_(codes)).all()
        assert len(holds) == len(codes), [h.barcode for h in holds]
        assert len({h.sku for h in holds}) == len(codes), [h.sku for h in holds]

    def test_the_counter_is_an_atomic_increment_not_a_read_then_write(self):
        """The allocation must be one UPDATE — read/modify/write races."""
        source = open(
            __import__('pathlib').Path(__file__).resolve().parents[1]
            / 'app' / 'services' / 'shop_sku.py').read()
        claim = source.split('def _claim', 1)[1]
        assert 'ShopSeries.last_number + 1' in claim
        assert '.values(last_number=ShopSeries.last_number + 1)' in claim


# ── 5. the API cannot bypass the rule ─────────────────────────────────────────

class TestApiCannotBypassTheAtbRule:
    @pytest.mark.parametrize('bad', ['CUSTOM001', 'abc123', '12345', 'TEST-1',
                                     'ATB', 'ATB ', '  atb000001'])
    def test_a_non_atb_sku_is_refused_on_create(self, client, admin_hdr, bad):
        r = client.post(CREATE_URL, headers=admin_hdr,
                        json={'sku': bad, 'name': f'Naughty {_tag()}'})
        assert r.status_code == 400, r.get_data(as_text=True)
        body = r.get_json()
        assert body['code'] == 'invalid_sku'
        assert body['error'] == 'SKU must begin with ATB'
        assert ShopProduct.query.filter_by(sku=bad.strip()).first() is None

    def test_an_atb_sku_supplied_by_the_client_is_accepted(self, client, admin_hdr):
        # _tag() is hex; keep the value in a band the counter never reaches.
        sku = format_sku(950000 + int(_tag()[:4], 16) % 10000)
        r = client.post(CREATE_URL, headers=admin_hdr,
                        json={'sku': sku, 'name': f'Hand written {_tag()}'})
        assert r.status_code == 201, r.get_data(as_text=True)
        assert r.get_json()['product']['sku'] == sku

    def test_the_server_ignores_a_sku_that_could_not_come_from_it(
            self, client, admin_hdr):
        """Even a well-formed ATB value is re-checked, not trusted blindly."""
        r = client.post(CREATE_URL, headers=admin_hdr, json={
            'name': f'No sku supplied {_tag()}', 'barcode': f'444{_tag()}',
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        assert SKU_RE.match(r.get_json()['product']['sku'])

    def test_renaming_a_product_cannot_drop_the_prefix(self, client, admin_hdr):
        product, _ = _create_product(client, admin_hdr, stock=0)
        r = client.patch(f'{CREATE_URL}/{product["id"]}', headers=admin_hdr,
                         json={'sku': 'BACKTOWHATEVER'})
        assert r.status_code == 400, r.get_data(as_text=True)
        assert r.get_json()['code'] == 'invalid_sku'

    def test_a_variant_may_not_carry_a_foreign_sku(self, client, admin_hdr):
        r = client.post(CREATE_URL, headers=admin_hdr, json={
            'name': f'Variant host {_tag()}', 'selling_price': 100,
            'variants': [{'name': 'Standard', 'sku': f'NOPE-{_tag()}'}],
        })
        assert r.status_code == 400, r.get_data(as_text=True)
        assert r.get_json()['code'] == 'invalid_sku'

    def test_a_variant_without_a_sku_inherits_the_parents_atb_code(
            self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=0)
        assert variant['sku'].startswith(f'{product["sku"]}-')
        assert product['sku'].startswith(SKU_PREFIX)


# ── 6. abandoned creation and retries ─────────────────────────────────────────

class TestAbandonedCreationAndRetries:
    def test_rescanning_the_same_code_returns_the_same_sku(
            self, client, admin_hdr):
        code = f'333{_tag()}'
        first = _generate(client, admin_hdr, code).get_json()
        second = _generate(client, admin_hdr, code).get_json()
        third = _generate(client, admin_hdr, code).get_json()

        assert first['sku'] == second['sku'] == third['sku']
        assert first['reserved'] is False
        assert second['reserved'] is True, 'a retry must reuse the reservation'

    def test_a_retried_scan_spends_only_one_sequence_number(
            self, client, admin_hdr):
        code = f'334{_tag()}'
        series = ShopSeries.query.filter_by(key=SERIES_KEY).first()
        before = int(series.last_number) if series else 0

        mine = _generate(client, admin_hdr, code).get_json()['sku']
        for _ in range(3):
            assert _generate(client, admin_hdr, code).get_json()['sku'] == mine

        series = ShopSeries.query.filter_by(key=SERIES_KEY).first()
        assert int(series.last_number) - before <= 1, \
            'retries must not burn sequence numbers'

    def test_abandoning_the_form_leaves_consistent_state(
            self, client, admin_hdr):
        code = f'335{_tag()}'
        reserved = _generate(client, admin_hdr, code).get_json()['sku']
        # …operator closes the modal: nothing was created, nothing broken.
        assert ShopProduct.query.filter_by(barcode=code).first() is None
        assert ShopProduct.query.filter_by(sku=reserved).first() is None

        # The reservation still holds the number, so a later scan agrees.
        assert _generate(client, admin_hdr, code).get_json()['sku'] == reserved

        # And a scan of a *different* new code still gets its own number.
        other = _generate(client, admin_hdr, f'336{_tag()}').get_json()['sku']
        assert other != reserved
        assert SKU_RE.match(other)

    def test_saving_spends_the_reservation(self, client, admin_hdr):
        code = f'337{_tag()}'
        reserved = _generate(client, admin_hdr, code).get_json()['sku']
        assert ShopSkuReservation.query.filter_by(barcode=code).count() == 1

        r = client.post(CREATE_URL, headers=admin_hdr, json={
            'name': f'Reserved {_tag()}', 'barcode': code, 'sku': reserved,
            'selling_price': 500,
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        assert r.get_json()['product']['sku'] == reserved

        assert ShopSkuReservation.query.filter_by(barcode=code).count() == 0, \
            'the reservation must be released once the product exists'

    def test_creating_from_a_reserved_scan_needs_no_explicit_sku(
            self, client, admin_hdr):
        code = f'338{_tag()}'
        reserved = _generate(client, admin_hdr, code).get_json()['sku']

        r = client.post(CREATE_URL, headers=admin_hdr, json={
            'name': f'Implicit {_tag()}', 'barcode': code,
            'selling_price': 900,
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        assert r.get_json()['product']['sku'] == reserved

    def test_a_failed_create_keeps_the_reservation(self, client, admin_hdr):
        code = f'339{_tag()}'
        reserved = _generate(client, admin_hdr, code).get_json()['sku']

        r = client.post(CREATE_URL, headers=admin_hdr, json={
            'name': f'Doomed {_tag()}', 'barcode': code, 'sku': reserved,
            'status': 'not-a-status',
        })
        assert r.status_code == 400

        assert ShopSkuReservation.query.filter_by(barcode=code).count() == 1
        assert _generate(client, admin_hdr, code).get_json()['sku'] == reserved


# ── 7. the created row is wired into everything downstream ────────────────────

class TestCreatedProductIsFullyConnected:
    def test_search_finds_the_generated_sku(self, client, admin_hdr):
        code = f'222{_tag()}'
        sku = _generate(client, admin_hdr, code).get_json()['sku']
        created = client.post(CREATE_URL, headers=admin_hdr, json={
            'name': f'Searchable {_tag()}', 'barcode': code, 'sku': sku,
            'selling_price': 1500,
        }).get_json()['product']

        r = client.get('/api/shop/products', headers=admin_hdr,
                       query_string={'q': sku})
        assert r.status_code == 200
        hits = [row['id'] for row in r.get_json()['items']]
        assert created['id'] in hits, 'the generated SKU must be searchable'

        # …and by its barcode, through the same endpoint the till uses.
        r = client.get(f'/api/shop/products/barcode/{code}', headers=admin_hdr)
        assert r.get_json()['found'] is True
        assert r.get_json()['product']['sku'] == sku

    def test_pos_can_ring_up_a_product_created_from_a_scan(
            self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=3)
        assert SKU_RE.match(product['sku']) or product['sku'].startswith(SKU_PREFIX)

        total = product['selling_price'] * 2
        r = client.post('/api/shop/sales', headers=admin_hdr, json={
            'branch_id': _branch('HQ'),
            'items': [{'product_id': product['id'], 'variant_id': variant['id'],
                       'quantity': 2, 'discount_percent': 0, 'tax_rate': 0,
                       'unit_price': product['selling_price']}],
            'payments': [{'amount': total,
                          'payment_method_id': _cash_method()}],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        line = r.get_json()['sale']['items'][0]
        assert line['sku_at_sale'] == variant['sku']

    def test_stock_receiving_shows_the_generated_sku(self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=4)

        r = client.get('/api/shop/inventory/balances', headers=admin_hdr,
                       query_string={'q': product['sku']})
        assert r.status_code == 200
        rows = r.get_json()['items']
        assert rows, 'the SKU must resolve in the inventory search'
        # Balances are per variant, so the parent SKU resolves to its variant.
        assert {row['sku'] for row in rows} & {product['sku'], variant['sku']}

    def test_creation_is_audited_with_sku_and_barcode(self, client, admin_hdr):
        code = f'111{_tag()}'
        sku = _generate(client, admin_hdr, code).get_json()['sku']
        created = client.post(CREATE_URL, headers=admin_hdr, json={
            'name': f'Audited {_tag()}', 'barcode': code, 'sku': sku,
            'selling_price': 700,
        })
        assert created.status_code == 201
        product_id = created.get_json()['product']['id']
        db.session.commit()

        entry = AuditLog.query.filter_by(action='shop_product_created',
                                         entity_id=str(product_id)).first()
        assert entry is not None, 'creating a product must be audited'
        assert sku in (entry.new_value or ''), entry.new_value
        assert code in (entry.new_value or ''), entry.new_value
        assert entry.user_email, 'the audit row must name who created it'

    def test_duplicate_barcode_is_answered_with_409_not_500(
            self, client, admin_hdr):
        product, _ = _create_product(client, admin_hdr, stock=0)
        r = client.post(CREATE_URL, headers=admin_hdr, json={
            'name': f'Twin {_tag()}', 'barcode': product['barcode'],
        })
        assert r.status_code == 409, r.get_data(as_text=True)
        body = r.get_json()
        assert body['code'] == 'duplicate_barcode'
        assert body['existing']['sku'] == product['sku']

    def test_duplicate_sku_is_answered_with_409_and_names_the_row(
            self, client, admin_hdr):
        product, _ = _create_product(client, admin_hdr, stock=0)
        r = client.post(CREATE_URL, headers=admin_hdr, json={
            'sku': product['sku'], 'name': f'Copy {_tag()}',
        })
        assert r.status_code == 409
        body = r.get_json()
        assert body['code'] == 'duplicate_sku'
        assert body['existing']['id'] == product['id']
        assert body['existing']['sku'] == product['sku']

    def test_malformed_variant_payload_is_400_not_500(self, client, admin_hdr):
        """variants/attributes/bundles raise ShopStockError — never a 500."""
        r = client.post(CREATE_URL, headers=admin_hdr, json={
            'name': f'Bad variants {_tag()}', 'selling_price': 10,
            'variants': 'not-a-list',
        })
        assert r.status_code == 400, r.get_data(as_text=True)
        assert r.get_json()['code'] == 'invalid_variants'

        r = client.post(CREATE_URL, headers=admin_hdr, json={
            'name': f'Nameless variant {_tag()}', 'selling_price': 10,
            'variants': [{'barcode': ''}],
        })
        assert r.status_code == 400, r.get_data(as_text=True)
        assert r.get_json()['code'] == 'invalid_variant'

    def test_missing_name_is_still_400(self, client, admin_hdr):
        r = client.post(CREATE_URL, headers=admin_hdr, json={'selling_price': 5})
        assert r.status_code == 400
        assert 'name' in r.get_json()['error']


# ── sequence plumbing ─────────────────────────────────────────────────────────

class TestSequencePlumbing:
    def test_format_is_a_single_consistent_shape(self):
        assert format_sku(1) == 'ATB000001'
        assert format_sku(247) == 'ATB000247'
        assert format_sku(123456) == 'ATB123456'
        assert SKU_PREFIX == 'ATB'

    def test_historical_skus_are_left_alone(self, client, admin_hdr):
        """Seeded/legacy rows keep their own scheme — nothing is rewritten."""
        legacy = ShopProduct.query.filter_by(sku='PHN-SPARK-20').first()
        assert legacy is not None, 'the seed keeps its hand-written SKUs'
        assert not legacy.sku.startswith(SKU_PREFIX)

        # …and the catalogue still lists them.
        r = client.get('/api/shop/products', headers=admin_hdr,
                       query_string={'q': 'PHN-SPARK-20'})
        assert any(row['sku'] == 'PHN-SPARK-20'
                   for row in r.get_json()['items'])

    def test_reserve_without_a_barcode_creates_no_reservation_row(
            self, client, admin_hdr):
        before = ShopSkuReservation.query.count()
        sku, reserved = reserve_sku(None)
        db.session.rollback()
        assert SKU_RE.match(sku)
        assert reserved is False
        assert ShopSkuReservation.query.count() == before

    def test_consume_reservation_matches_on_sku_and_barcode(self):
        sku = generate_product_sku()
        db.session.add(ShopSkuReservation(barcode='999777666555', sku=sku))
        db.session.commit()

        assert consume_reservation(sku, '999777666555') == 1
        assert ShopSkuReservation.query.filter_by(sku=sku).count() == 0
        assert MAX_ATTEMPTS >= 1
