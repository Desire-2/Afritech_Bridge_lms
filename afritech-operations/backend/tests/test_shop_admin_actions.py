"""Admin control surface: catalogue soft-deletes, supplier retirement,
draft-PO removal and the price-history viewer.

These are the management actions the shop owner asked for on top of the
original create-only catalogue: take a product out of sale without erasing
its history, retire a supplier once the orders are closed, throw away a
draft PO that was never submitted, and audit who changed a price and why.
"""
import pytest

from app.extensions import db
from app.models import (
    ShopProduct, ShopProductVariant, ShopProductCategory, ShopBrand,
    ShopAttribute, ShopProductPriceHistory, ShopPurchaseOrder, ShopSupplier,
)

from .test_shop import _branch, _create_product, _shop_user, _tag


@pytest.fixture(autouse=True)
def _brands_never_leak():
    """Delete brands this module creates when each test finishes.

    Other suites assert global catalogue invariants over the shared test
    database ("every brand carries a full product basket"), so a one-off
    brand created here would fail them long after this file passed.
    """
    from sqlalchemy import func
    marker = db.session.query(func.max(ShopBrand.id)).scalar() or 0
    yield
    leaked = [b.id for b in ShopBrand.query.filter(ShopBrand.id > marker).all()]
    if leaked:
        product_ids = [p.id for p in ShopProduct.query.filter(
            ShopProduct.brand_id.in_(leaked)).all()]
        if product_ids:
            ShopProductPriceHistory.query.filter(
                ShopProductPriceHistory.product_id.in_(product_ids)
            ).delete(synchronize_session=False)
            ShopProductVariant.query.filter(
                ShopProductVariant.product_id.in_(product_ids)
            ).delete(synchronize_session=False)
            ShopProduct.query.filter(
                ShopProduct.id.in_(product_ids)).delete(synchronize_session=False)
        ShopBrand.query.filter(ShopBrand.id.in_(leaked)).delete(
            synchronize_session=False)
        db.session.commit()


def _hdr_for(client, admin_hdr, role):
    hdr, _email = _shop_user(client, admin_hdr, role)
    return hdr


# ── catalogue ────────────────────────────────────────────────────────────────

class TestCatalogueDeletes:
    def test_category_soft_delete_deactivates_and_reports_usage(
            self, client, admin_hdr):
        tag = _tag()
        r = client.post('/api/shop/categories', headers=admin_hdr,
                        json={'name': f'Cat {tag}', 'code': f'CAT-{tag}'})
        assert r.status_code == 201, r.get_data(as_text=True)
        category = r.get_json()['category']

        r = client.post('/api/shop/products', headers=admin_hdr, json={
            'name': f'Filed under {tag}', 'category_id': category['id'],
        })
        assert r.status_code == 201, r.get_data(as_text=True)

        r = client.delete(f"/api/shop/categories/{category['id']}",
                          headers=admin_hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        body = r.get_json()
        assert body['category']['is_active'] is False
        assert body['affected_products'] == 1

        # The row survives, still attached to the product that uses it.
        row = ShopProductCategory.query.get(category['id'])
        assert row is not None and row.is_active is False

        r = client.get('/api/shop/categories', headers=admin_hdr)
        listed = {c['id']: c for c in r.get_json()['items']}
        assert listed[category['id']]['is_active'] is False

    def test_brand_soft_delete_keeps_product_fk(self, client, admin_hdr):
        tag = _tag()
        r = client.post('/api/shop/brands', headers=admin_hdr,
                        json={'name': f'Brand {tag}', 'code': f'BR-{tag}'})
        assert r.status_code == 201, r.get_data(as_text=True)
        brand = r.get_json()['brand']

        # Brand codes are editable after creation, like categories.
        r = client.patch(f"/api/shop/brands/{brand['id']}", headers=admin_hdr,
                         json={'code': f'BR2-{tag}'})
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['brand']['code'] == f'BR2-{tag}'

        r = client.post('/api/shop/products', headers=admin_hdr, json={
            'name': f'Branded {tag}', 'brand_id': brand['id'],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        product_id = r.get_json()['product']['id']

        r = client.delete(f"/api/shop/brands/{brand['id']}", headers=admin_hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['brand']['is_active'] is False
        assert r.get_json()['affected_products'] == 1
        assert ShopProduct.query.get(product_id).brand_id == brand['id']

    def test_attribute_patch_and_soft_delete(self, client, admin_hdr):
        tag = _tag()
        r = client.post('/api/shop/attributes', headers=admin_hdr,
                        json={'name': f'Storage {tag}', 'code': f'STG-{tag}'})
        assert r.status_code == 201, r.get_data(as_text=True)
        attribute = r.get_json()['attribute']

        r = client.patch(f"/api/shop/attributes/{attribute['id']}",
                         headers=admin_hdr,
                         json={'name': f'Storage revised {tag}',
                               'code': f'STG2-{tag}'})
        assert r.status_code == 200, r.get_data(as_text=True)
        updated = r.get_json()['attribute']
        assert updated['name'].startswith('Storage revised')
        assert updated['code'] == f'STG2-{tag}'

        r = client.delete(f"/api/shop/attributes/{attribute['id']}",
                          headers=admin_hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['attribute']['is_active'] is False
        assert r.get_json()['used_values'] == 0
        assert ShopAttribute.query.get(attribute['id']).is_active is False

    def test_attribute_patch_rejects_duplicate_code(self, client, admin_hdr):
        tag = _tag()
        r = client.post('/api/shop/attributes', headers=admin_hdr,
                        json={'name': f'A {tag}', 'code': f'A-{tag}'})
        first = r.get_json()['attribute']
        r = client.post('/api/shop/attributes', headers=admin_hdr,
                        json={'name': f'B {tag}', 'code': f'B-{tag}'})
        second = r.get_json()['attribute']

        r = client.patch(f"/api/shop/attributes/{second['id']}",
                         headers=admin_hdr, json={'code': f'A-{tag}'})
        assert r.status_code == 409, r.get_data(as_text=True)
        assert first['code'] != second['code']

    def test_product_delete_archives_and_blocks_double_archive(
            self, client, admin_hdr):
        product, _variant = _create_product(client, admin_hdr, stock=0)

        r = client.delete(f"/api/shop/products/{product['id']}",
                          headers=admin_hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['archived'] is True
        assert r.get_json()['product']['status'] == 'archived'
        assert ShopProduct.query.get(product['id']).status == 'archived'

        r = client.delete(f"/api/shop/products/{product['id']}",
                          headers=admin_hdr)
        assert r.status_code == 409, r.get_data(as_text=True)
        assert r.get_json()['code'] == 'already_archived'

        # Restore is still available through the status endpoint.
        r = client.post(f"/api/shop/products/{product['id']}/status",
                        headers=admin_hdr, json={'status': 'active'})
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['product']['status'] == 'active'

    def test_delete_product_404_for_unknown(self, client, admin_hdr):
        r = client.delete('/api/shop/products/999999', headers=admin_hdr)
        assert r.status_code == 404

    def test_attendant_cannot_delete_products_or_taxonomy(
            self, client, admin_hdr):
        product, _variant = _create_product(client, admin_hdr, stock=0)
        r = client.post('/api/shop/brands', headers=admin_hdr,
                        json={'name': 'Guarded', 'code': 'GRD-1'})
        brand = r.get_json()['brand']
        hdr = _hdr_for(client, admin_hdr, 'shop_attendant')

        assert client.delete(f"/api/shop/products/{product['id']}",
                             headers=hdr).status_code == 403
        assert client.delete(f"/api/shop/brands/{brand['id']}",
                             headers=hdr).status_code == 403


# ── price history ────────────────────────────────────────────────────────────

class TestPriceHistoryViewer:
    def test_price_change_appears_in_history_with_reason(
            self, client, admin_hdr):
        product, _variant = _create_product(client, admin_hdr, stock=0)
        r = client.patch(f"/api/shop/products/{product['id']}",
                         headers=admin_hdr,
                         json={'purchase_cost': 12500, 'selling_price': 20000,
                               'reason': 'new supplier quote'})
        assert r.status_code == 200, r.get_data(as_text=True)

        r = client.get(
            f"/api/shop/products/{product['id']}/price-history",
            headers=admin_hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        body = r.get_json()
        assert body['total'] >= 2
        fields = [h['field'] for h in body['items']]
        assert 'purchase_cost' in fields and 'selling_price' in fields
        newest = body['items'][0]
        assert newest['reason'] == 'new supplier quote'
        # Newest first.
        assert body['items'][0]['id'] > body['items'][-1]['id']

    def test_price_history_is_money_scoped(self, client, admin_hdr):
        product, _variant = _create_product(client, admin_hdr, stock=0)
        shop_hdr = _hdr_for(client, admin_hdr, 'shop_manager')
        r = client.get(
            f"/api/shop/products/{product['id']}/price-history",
            headers=shop_hdr)
        assert r.status_code == 200, r.get_data(as_text=True)

        attendant = _hdr_for(client, admin_hdr, 'shop_attendant')
        r = client.get(
            f"/api/shop/products/{product['id']}/price-history",
            headers=attendant)
        assert r.status_code == 403, r.get_data(as_text=True)

    def test_price_history_404_unknown_product(self, client, admin_hdr):
        r = client.get('/api/shop/products/999999/price-history',
                       headers=admin_hdr)
        assert r.status_code == 404


# ── purchasing ───────────────────────────────────────────────────────────────

class TestPurchasingAdmin:
    def _supplier(self, client, hdr, tag):
        r = client.post('/api/shop/suppliers', headers=hdr, json={
            'company_name': f'Supplier {tag}', 'phone': '+250788000000',
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        return r.get_json()['supplier']

    def _draft_po(self, client, hdr, supplier_id, tag, quantity=5):
        product, _variant = _create_product(client, hdr, stock=0)
        r = client.post('/api/shop/purchases', headers=hdr, json={
            'supplier_id': supplier_id, 'branch_id': _branch('HQ'),
            'items': [{'product_id': product['id'], 'quantity': quantity}],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        return r.get_json()['purchase_order']

    def test_supplier_delete_blocked_by_open_po_then_allowed(
            self, client, admin_hdr):
        tag = _tag()
        hdr = _hdr_for(client, admin_hdr, 'shop_manager')
        supplier = self._supplier(client, hdr, tag)
        po = self._draft_po(client, hdr, supplier['id'], tag)

        r = client.delete(f"/api/shop/suppliers/{supplier['id']}", headers=hdr)
        assert r.status_code == 409, r.get_data(as_text=True)
        assert r.get_json()['code'] == 'open_purchase_orders'
        assert ShopSupplier.query.get(supplier['id']).is_active is True

        r = client.delete(f"/api/shop/purchases/{po['id']}", headers=hdr)
        assert r.status_code == 200, r.get_data(as_text=True)

        r = client.delete(f"/api/shop/suppliers/{supplier['id']}", headers=hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['supplier']['is_active'] is False

    def test_draft_purchase_order_hard_delete(self, client, admin_hdr):
        tag = _tag()
        hdr = _hdr_for(client, admin_hdr, 'shop_manager')
        supplier = self._supplier(client, hdr, tag)
        po = self._draft_po(client, hdr, supplier['id'], tag)
        po_id = po['id']

        r = client.delete(f'/api/shop/purchases/{po_id}', headers=hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['deleted'] is True
        assert r.get_json()['po_number'] == po['po_number']
        assert ShopPurchaseOrder.query.get(po_id) is None

        r = client.get(f'/api/shop/purchases/{po_id}', headers=hdr)
        assert r.status_code == 404

    def test_submitted_purchase_order_cannot_be_deleted(
            self, client, admin_hdr):
        tag = _tag()
        hdr = _hdr_for(client, admin_hdr, 'shop_manager')
        supplier = self._supplier(client, hdr, tag)
        po = self._draft_po(client, hdr, supplier['id'], tag)

        r = client.post(f"/api/shop/purchases/{po['id']}/submit", headers=hdr)
        assert r.status_code == 200, r.get_data(as_text=True)

        r = client.delete(f"/api/shop/purchases/{po['id']}", headers=hdr)
        assert r.status_code == 409, r.get_data(as_text=True)
        assert r.get_json()['code'] == 'not_draft'
        assert ShopPurchaseOrder.query.get(po['id']).status == 'pending_approval'

        # The documented escape hatch still works.
        r = client.post(f"/api/shop/purchases/{po['id']}/cancel", headers=hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        assert ShopPurchaseOrder.query.get(po['id']).status == 'cancelled'

    def test_attendant_cannot_delete_suppliers_or_pos(
            self, client, admin_hdr):
        tag = _tag()
        mgr = _hdr_for(client, admin_hdr, 'shop_manager')
        supplier = self._supplier(client, mgr, tag)
        po = self._draft_po(client, mgr, supplier['id'], tag)
        attendant = _hdr_for(client, admin_hdr, 'shop_attendant')

        assert client.delete(f"/api/shop/suppliers/{supplier['id']}",
                             headers=attendant).status_code == 403
        assert client.delete(f"/api/shop/purchases/{po['id']}",
                             headers=attendant).status_code == 403
