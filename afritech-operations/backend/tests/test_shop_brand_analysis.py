"""Per-brand product analysis: catalogue depth, stock on hand and sales.

The report exists so the shop can compare brands — which means every brand the
seed ships must be present with its own products, and money must stay behind
the same permission wall as the profitability report.
"""
from app.models import ShopBrand, ShopProduct

from .test_shop import _shop_user, _create_product, _sale

SEEDED_BRANDS = {
    'TEC', 'SAM', 'HPI', 'LEN', 'ANK', 'LOG', 'APL',
    'XIA', 'DEL', 'ASU', 'SNY', 'JBL', 'HUA', 'BOS',
    'GOO', 'INF', 'ITL', 'OPP', 'VVO', 'RML', 'MOT', 'NOK', 'ONP',
}


class TestSeededBrands:
    def test_every_brand_exists_with_products_of_its_own(self):
        brands = ShopBrand.query.all()
        codes = {b.code for b in brands}
        assert SEEDED_BRANDS <= codes, f'missing brands: {SEEDED_BRANDS - codes}'

        baskets = []
        for brand in brands:
            skus = sorted(p.sku for p in brand.products)
            assert len(skus) >= 2, \
                f'{brand.code} carries {len(skus)} product(s) — an analysis ' \
                f'row with one entry compares nothing'
            assert all(p.brand_id == brand.id for p in brand.products)
            baskets.append(tuple(skus))
        assert len(set(baskets)) == len(baskets), \
            'two brands ship the identical product basket'

    def test_seeded_barcodes_are_valid_retail_codes(self):
        from app.services.barcode import detect_format
        for product in ShopProduct.query.filter(ShopProduct.sku.like('%-%')).all():
            if product.barcode and product.barcode.isdigit() \
                    and len(product.barcode) == 13:
                assert detect_format(product.barcode) == 'EAN_13', \
                    f'{product.sku} ships a barcode that fails its check digit'


class TestBrandReport:
    def test_lists_every_brand_with_its_product_count(self, client, admin_hdr):
        r = client.get('/api/shop/reports/brands', headers=admin_hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        body = r.get_json()
        rows = {row['code']: row for row in body['rows']}

        for brand in ShopBrand.query.all():
            assert brand.code in rows, f'{brand.code} missing from the report'
            assert rows[brand.code]['products'] == len(brand.products)
            assert rows[brand.code]['units_sold'] >= 0

        assert body['totals']['brands'] == len(body['rows'])
        assert body['totals']['products'] == ShopProduct.query.count()

    def test_brands_have_distinct_product_analysis(self, client, admin_hdr):
        r = client.get('/api/shop/reports/brands', headers=admin_hdr)
        rows = {row['code']: row for row in r.get_json()['rows']}

        counts = [row['products'] for row in rows.values()]
        assert len(set(counts)) > 1, 'every brand analyses to the same depth'

        units = [row['units_sold'] for row in rows.values()]
        assert any(u > 0 for u in units), 'the seeded sales should reach brands'
        assert any(u == 0 for u in units), \
            'at least one brand should be unsold, otherwise nothing differs'

        margins = {row['code']: row['margin_percent'] for row in rows.values()}
        assert len(set(margins.values())) > 1, 'margins should not be identical'

    def test_a_product_without_a_brand_is_reported_as_unbranded(
            self, client, admin_hdr):
        _create_product(client, admin_hdr, stock=2)
        r = client.get('/api/shop/reports/brands', headers=admin_hdr)
        rows = {row['brand']: row for row in r.get_json()['rows']}
        assert 'Unbranded' in rows
        assert rows['Unbranded']['products'] >= 1

    def test_money_is_gated_the_way_the_other_reports_gate_it(
            self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=4)
        _sale(client, admin_hdr, product, variant, quantity=1)

        admin = client.get('/api/shop/reports/brands', headers=admin_hdr)
        assert admin.status_code == 200
        body = admin.get_json()
        assert body['money'] and body['costs']
        assert 'revenue' in body['rows'][0]
        share = sum(row.get('revenue_share', 0) for row in body['rows'])
        assert 99.0 <= share <= 101.0, 'revenue share must add up to ~100%'

        keeper, _ = _shop_user(client, admin_hdr, 'storekeeper')
        r = client.get('/api/shop/reports/brands', headers=keeper)
        assert r.status_code == 200, r.get_data(as_text=True)
        plain = r.get_json()
        # The storekeeper holds shop.purchases.create, so costs open up — but
        # never revenue, which stays behind shop.financial_reports.view.
        assert plain['money'] is False
        assert plain['costs'] is True
        assert plain['rows'], 'the operational analysis still renders'
        for row in plain['rows']:
            assert row['products'] >= 0
            assert row['units_on_hand'] >= 0
            for hidden in ('revenue', 'gross_profit', 'margin_percent',
                           'revenue_share'):
                assert hidden not in row, f'{hidden} leaked to a storekeeper'
        for key in ('revenue', 'gross_profit', 'margin_percent'):
            assert key not in plain['totals']

    def test_a_role_outside_the_shop_cannot_read_the_report(self, client):
        r = client.post('/api/auth/login', json={
            'email': 'agent@afritech.dev', 'password': 'Password123!'})
        token = r.get_json()['access_token']
        r = client.get('/api/shop/reports/brands',
                       headers={'Authorization': f'Bearer {token}'})
        assert r.status_code == 403


class TestReturnedGoodsAreNotDoubleCharged:
    """A restocked return hands the unit back, so only its revenue reverses.

    Refunds removed the income while the cost stayed in COGS, even though the
    goods were on the shelf again — the sale booked a loss for a unit the shop
    still owned and sank the brand's margin below zero.
    """
    def test_a_refunded_unit_back_on_the_shelf_is_not_a_loss(
            self, client, admin_hdr):
        product, variant = _create_product(client, admin_hdr, stock=6,
                                           cost=10000, price=18000)
        sale = _sale(client, admin_hdr, product, variant, quantity=2)
        payload = sale.get_json()['sale']

        paths = ('/api/shop/reports/profitability', '/api/shop/reports/brands')

        def snapshot(path):
            r = client.get(path, headers=admin_hdr)
            assert r.status_code == 200, r.get_data(as_text=True)
            return r.get_json()['totals']

        before = {path: snapshot(path) for path in paths}

        r = client.post('/api/shop/returns', headers=admin_hdr, json={
            'sale_id': payload['id'], 'return_type': 'refund',
            'reason': 'Box damaged on collection',
            'items': [{'sale_item_id': payload['items'][0]['id'],
                       'quantity': 1, 'condition': 'good', 'restock': True}],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        r = client.post(f"/api/shop/returns/{r.get_json()['return']['id']}"
                        f"/approve", headers=admin_hdr,
                        json={'decision': 'approved'})
        assert r.status_code == 200, r.get_data(as_text=True)

        after = {path: snapshot(path) for path in paths}
        for path in paths:
            was, now = before[path], after[path]
            # The refund reverses 18 000 RWF of income and the restocked unit
            # gives 10 000 RWF of cost back, so the net damage is 8 000 RWF —
            # not the full refund, and never a negative margin.
            assert round(now['revenue'] - was['revenue'], 2) == 0, path
            assert round(was['cogs'] - now['cogs'], 2) == 10000, path
            assert round(was['gross_profit'] - now['gross_profit'], 2) == 8000, path
            assert now['margin_percent'] > 0, path

        # The product's own row settles at 1 unit really sold: 18 000 −
        # 10 000 − 18 000 refunded = 8 000 gross profit.
        r = client.get('/api/shop/reports/profitability', headers=admin_hdr)
        rows = {row['label']: row for row in r.get_json()['rows']}
        label = next(key for key in rows if key.startswith(product['name']))
        row = rows[label]
        assert row['revenue'] == 36000
        assert row['cogs'] == 10000
        assert row['gross_profit'] == 8000
        assert row['margin_percent'] > 0
