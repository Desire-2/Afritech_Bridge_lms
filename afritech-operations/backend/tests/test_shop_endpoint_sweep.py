"""Every shop read endpoint must answer every shop role.

A 500 here means the payload builder crashed — usually because a money column
was nulled for a caller who may not see costs and the totals loop then tried
to add ``None``.  401/403/404 are legitimate answers; 5xx never is.
"""
import pytest

from .test_shop import _shop_user, _create_product, _sale

READ_ENDPOINTS = (
    '/api/shop/dashboard',
    '/api/shop/products',
    '/api/shop/categories',
    '/api/shop/brands',
    '/api/shop/attributes',
    '/api/shop/suppliers',
    '/api/shop/customers',
    '/api/shop/payment-methods',
    '/api/shop/promotions',
    '/api/shop/settings',
    '/api/shop/activities',
    '/api/shop/summary',
    '/api/shop/alerts',
    '/api/shop/unknown-barcodes',
    '/api/shop/supplier-returns',
    '/api/shop/inventory/balances',
    '/api/shop/inventory/movements',
    '/api/shop/inventory/alerts',
    '/api/shop/inventory/counts',
    '/api/shop/inventory/adjustments',
    '/api/shop/inventory/transfers',
    '/api/shop/purchases',
    '/api/shop/sales',
    '/api/shop/returns',
    '/api/shop/warranties',
    '/api/shop/warranty-cases',
    '/api/shop/shifts',
    '/api/shop/closings',
    '/api/shop/reports/sales?group_by=category',
    '/api/shop/reports/sales?group_by=product',
    '/api/shop/reports/stock',
    '/api/shop/reports/slow-moving',
    '/api/shop/reports/purchases',
)

REPORT_ENDPOINTS = (
    '/api/shop/reports/sales?group_by=day',
    '/api/shop/reports/profitability',
    '/api/shop/reports/tax',
)


@pytest.mark.parametrize('path', READ_ENDPOINTS)
def test_read_endpoints_never_crash_for_storekeeper(client, admin_hdr, path):
    """The storekeeper sees shop reports but holds no financial permission."""
    keeper, _ = _shop_user(client, admin_hdr, 'storekeeper')
    r = client.get(path, headers=keeper)
    assert r.status_code < 500, f'{path} answered {r.status_code}: ' \
                                f'{r.get_data(as_text=True)[:300]}'


@pytest.mark.parametrize('path', READ_ENDPOINTS)
def test_read_endpoints_never_crash_for_attendant(client, admin_hdr, path):
    attendant, _ = _shop_user(client, admin_hdr, 'shop_attendant')
    r = client.get(path, headers=attendant)
    assert r.status_code < 500, f'{path} answered {r.status_code}: ' \
                                f'{r.get_data(as_text=True)[:300]}'


@pytest.mark.parametrize('path', REPORT_ENDPOINTS)
def test_reports_serve_operational_rows_without_money(client, admin_hdr, path):
    """A caller without financial access gets rows, never a 500."""
    product, variant = _create_product(client, admin_hdr, stock=4)
    _sale(client, admin_hdr, product, variant, quantity=1)

    keeper, _ = _shop_user(client, admin_hdr, 'storekeeper')
    r = client.get(path, headers=keeper)
    if 'profitability' in path or 'tax' in path:
        # Financial reports stay permission-gated for this role.
        assert r.status_code in (200, 403), f'{path} answered ' \
                                            f'{r.status_code}'
        if r.status_code == 403:
            return
    else:
        assert r.status_code == 200, f'{path} answered {r.status_code}: ' \
                                     f'{r.get_data(as_text=True)[:300]}'
    body = r.get_json()
    assert body['rows'], 'the period still has sales to report on'
    if 'money' in body and not body['money']:
        money_keys = [k for k in ('gross', 'net', 'revenue', 'total_tax')
                      if body['rows'][0].get(k) is not None]
        assert not money_keys, f'money leaked without permission: {money_keys}'

    admin = client.get(path, headers=admin_hdr)
    assert admin.status_code == 200
    assert admin.get_json()['rows'], 'the same rows exist for an admin'


def test_money_stays_hidden_from_the_storekeeper(client, admin_hdr):
    product, variant = _create_product(client, admin_hdr, stock=4)
    _sale(client, admin_hdr, product, variant, quantity=1)

    keeper, _ = _shop_user(client, admin_hdr, 'storekeeper')
    r = client.get('/api/shop/reports/sales?group_by=day', headers=keeper)
    assert r.status_code == 200, r.get_data(as_text=True)
    body = r.get_json()
    assert body['money'] is False
    assert body['totals']['transactions'] >= 1
    assert body['totals']['gross'] is None, 'revenue stays hidden'

    r = client.get('/api/shop/reports/profitability', headers=keeper)
    assert r.status_code in (200, 403), r.get_data(as_text=True)
