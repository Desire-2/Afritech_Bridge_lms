"""Shop catalogue: categories, brands, attributes, products, variants, prices.

Catalogue writes never touch stock — stock only ever moves through the
inventory engine when goods are received, sold, transferred or adjusted. Price
and cost edits append a :class:`ShopProductPriceHistory` row so a receipt
printed last month still shows what was charged then.
"""
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify

from ...extensions import db
from ...models import (
    ShopProductCategory, ShopBrand, ShopAttribute, ShopProduct,
    ShopProductVariant, ShopProductAttributeValue, ShopProductPriceHistory,
    ShopBundleItem, SHOP_PRODUCT_STATUSES, Branch, ShopInventoryBalance,
)
from ...auth.auth import require_permission, require_any_permission, current_user
from ...auth.shop_scope import can_view_shop_costs
from ...services.audit import audit
from ..helpers import json_error, parse_json, paginate, paginate_response, required
from .common import (
    payload_for, resolve_variant, request_branch_id_from_body, stock_error,
    current_user_id, notify_shop, user_branch_id,
)
from ...services.shop_inventory import ShopStockError, product_stock, ensure_product
from ...services.barcode import (
    ShopBarcodeError, UNKNOWN_CONTEXTS, barcode_conflict, barcode_identity,
    detect_format, normalize_barcode, record_unknown_scan, register_barcode,
    resolve as resolve_barcode, validate_barcode,
)

bp = Blueprint('shop_catalog', __name__, url_prefix='/api/shop')


# ── categories ───────────────────────────────────────────────────────────────

@bp.get('/categories')
@require_any_permission('shop.products.view', 'shop.view')
def list_categories():
    rows = ShopProductCategory.query.order_by(
        ShopProductCategory.sort_order, ShopProductCategory.name).all()
    return jsonify({'items': [c.to_dict(include_children=True) for c in rows]})


@bp.post('/categories')
@require_permission('shop.products.create')
def create_category():
    data = parse_json()
    missing = required(data, 'name', 'code')
    if missing:
        return json_error(f'{", ".join(missing)} is required', 400)
    if ShopProductCategory.query.filter_by(code=data['code']).first():
        return json_error('A category with that code already exists', 409)
    row = ShopProductCategory(
        name=data['name'], code=data['code'],
        parent_id=data.get('parent_id'), description=data.get('description'),
        sort_order=int(data.get('sort_order') or 0),
        is_active=bool(data.get('is_active', True)),
    )
    db.session.add(row)
    db.session.commit()
    audit('shop_category_created', 'shop_category', row.id, new_value=row.to_dict())
    return jsonify({'category': row.to_dict(include_children=True)}), 201


@bp.patch('/categories/<int:row_id>')
@require_permission('shop.products.edit')
def update_category(row_id):
    row = ShopProductCategory.query.get(row_id)
    if not row:
        return json_error('Category not found', 404)
    data = parse_json()
    previous = row.to_dict()
    if data.get('name'):
        row.name = data['name']
    if data.get('code') and data['code'] != row.code:
        if ShopProductCategory.query.filter(
                ShopProductCategory.code == data['code'],
                ShopProductCategory.id != row.id).first():
            return json_error('A category with that code already exists', 409)
        row.code = data['code']
    if 'parent_id' in data:
        row.parent_id = data.get('parent_id')
    if 'description' in data:
        row.description = data.get('description')
    if 'sort_order' in data:
        row.sort_order = int(data.get('sort_order') or 0)
    if 'is_active' in data:
        row.is_active = bool(data['is_active'])
    db.session.commit()
    audit('shop_category_updated', 'shop_category', row.id,
          previous_value=previous, new_value=row.to_dict())
    return jsonify({'category': row.to_dict(include_children=True)})


# ── brands ───────────────────────────────────────────────────────────────────

@bp.get('/brands')
@require_any_permission('shop.products.view', 'shop.view')
def list_brands():
    rows = ShopBrand.query.order_by(ShopBrand.name).all()
    return jsonify({'items': [b.to_dict() for b in rows]})


@bp.post('/brands')
@require_permission('shop.products.create')
def create_brand():
    data = parse_json()
    missing = required(data, 'name', 'code')
    if missing:
        return json_error(f'{", ".join(missing)} is required', 400)
    if ShopBrand.query.filter_by(code=data['code']).first():
        return json_error('A brand with that code already exists', 409)
    row = ShopBrand(name=data['name'], code=data['code'],
                    is_active=bool(data.get('is_active', True)))
    db.session.add(row)
    db.session.commit()
    audit('shop_brand_created', 'shop_brand', row.id, new_value=row.to_dict())
    return jsonify({'brand': row.to_dict()}), 201


@bp.patch('/brands/<int:row_id>')
@require_permission('shop.products.edit')
def update_brand(row_id):
    row = ShopBrand.query.get(row_id)
    if not row:
        return json_error('Brand not found', 404)
    data = parse_json()
    previous = row.to_dict()
    if data.get('name'):
        row.name = data['name']
    if 'is_active' in data:
        row.is_active = bool(data['is_active'])
    db.session.commit()
    audit('shop_brand_updated', 'shop_brand', row.id,
          previous_value=previous, new_value=row.to_dict())
    return jsonify({'brand': row.to_dict()})


# ── attributes ───────────────────────────────────────────────────────────────

@bp.get('/attributes')
@require_any_permission('shop.products.view', 'shop.view')
def list_attributes():
    rows = ShopAttribute.query.order_by(ShopAttribute.name).all()
    return jsonify({'items': [a.to_dict() for a in rows]})


@bp.post('/attributes')
@require_permission('shop.products.create')
def create_attribute():
    data = parse_json()
    missing = required(data, 'name', 'code')
    if missing:
        return json_error(f'{", ".join(missing)} is required', 400)
    if ShopAttribute.query.filter_by(code=data['code']).first():
        return json_error('An attribute with that code already exists', 409)
    row = ShopAttribute(name=data['name'], code=data['code'],
                        is_active=bool(data.get('is_active', True)))
    db.session.add(row)
    db.session.commit()
    audit('shop_attribute_created', 'shop_attribute', row.id, new_value=row.to_dict())
    return jsonify({'attribute': row.to_dict()}), 201


def _attribute_for(key):
    """Resolve an attribute by id, code or name — creating it when needed."""
    key = str(key).strip()
    if key.isdigit():
        row = ShopAttribute.query.get(int(key))
        if row:
            return row
    row = ShopAttribute.query.filter(
        (ShopAttribute.code == key) | (ShopAttribute.name == key)).first()
    if row:
        return row
    slug = ''.join(ch if ch.isalnum() else '_' for ch in key.lower()).strip('_')
    if ShopAttribute.query.filter_by(code=slug).first():
        slug = f'{slug}_{datetime.now(timezone.utc).strftime("%H%M%S%f")}'
    row = ShopAttribute(name=key, code=slug[:64])
    db.session.add(row)
    db.session.flush()
    return row


# ── products ─────────────────────────────────────────────────────────────────

def _apply_product_attributes(product, entries):
    """Replace the product's attribute values from a payload.

    Accepts a list of ``{attribute_id|attribute_code|name, value}`` or a plain
    ``{code: value}`` mapping.
    """
    if entries is None:
        return
    pairs = []
    if isinstance(entries, dict):
        items = [{'attribute_code': k, 'value': v} for k, v in entries.items()]
    elif isinstance(entries, list):
        items = entries
    else:
        raise ShopStockError('attributes must be a list or object', 400,
                             'invalid_attributes')
    for item in items:
        if not isinstance(item, dict):
            continue
        value = item.get('value')
        if value in (None, ''):
            continue
        key = (item.get('attribute_id') or item.get('attribute_code')
               or item.get('code') or item.get('name'))
        if key in (None, ''):
            continue
        attribute = _attribute_for(key)
        pairs.append((attribute.id, str(value)[:160]))
    product.attribute_values.clear()
    db.session.flush()
    for attribute_id, value in pairs:
        product.attribute_values.append(
            ShopProductAttributeValue(attribute_id=attribute_id, value=value))


def _apply_variants(product, entries):
    """Reconcile the product's variants against the payload.

    Entries are matched by SKU: existing rows are updated, new ones are
    created, and variants left out of the payload are retired
    (``is_active=False``) instead of deleted — a retired variant may still
    carry years of sales history and stock movements.
    """
    if entries is None:
        return
    if not isinstance(entries, list):
        raise ShopStockError('variants must be a list', 400, 'invalid_variants')
    seen = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            continue
        name = (entry.get('name') or '').strip()
        if not name:
            raise ShopStockError(f'Variant {index + 1} needs a name', 400,
                                 'invalid_variant')
        sku = (entry.get('sku') or f'{product.sku}-{index + 1}').strip()
        clash = ShopProductVariant.query.filter(
            ShopProductVariant.sku == sku,
            ShopProductVariant.product_id != product.id).first()
        if clash or sku in seen:
            raise ShopStockError(f'Variant SKU {sku} is already in use', 409,
                                 'duplicate_sku')
        seen.add(sku)
        variant = ShopProductVariant.query.filter_by(
            product_id=product.id, sku=sku).first()
        if variant is None:
            variant = ShopProductVariant(product_id=product.id, sku=sku)
            db.session.add(variant)
        variant.name = name
        variant.attributes = entry.get('attributes') or variant.attributes or {}
        if 'selling_price' in entry:
            variant.selling_price = entry.get('selling_price')
        if 'purchase_cost' in entry:
            variant.purchase_cost = entry.get('purchase_cost')
        if {'barcode', 'barcode_format', 'barcode_type'} & set(entry):
            _apply_barcode_payload(variant, entry, is_product=False)
        variant.is_active = bool(entry.get('is_active', True))
        variant.sort_order = int(entry.get('sort_order') or index)
        if 'image_path' in entry:
            variant.image_path = entry.get('image_path')
    for existing in product.variants:
        if existing.sku not in seen:
            existing.is_active = False


def _apply_bundle(product, entries):
    if entries is None:
        return
    if not isinstance(entries, list):
        raise ShopStockError('bundle_items must be a list', 400, 'invalid_bundle')
    product.bundle_items.clear()
    db.session.flush()
    for entry in entries:
        component, _ = resolve_variant({
            'product_id': entry.get('component_product_id') or entry.get('product_id'),
            'sku': entry.get('component_sku') or entry.get('sku'),
            'variant_id': entry.get('component_variant_id'),
        })
        if component.id == product.id:
            raise ShopStockError('A bundle cannot contain itself', 400,
                                 'invalid_bundle')
        quantity = int(entry.get('quantity') or 1)
        if quantity <= 0:
            raise ShopStockError('Bundle quantity must be positive', 400,
                                 'invalid_bundle')
        product.bundle_items.append(
            ShopBundleItem(component_product_id=component.id,
                           component_variant_id=entry.get('component_variant_id'),
                           quantity=quantity))


def _record_price_history(product, field, old, new, reason, variant_id=None):
    if old is None and new is None:
        return
    if old is not None and new is not None and str(old) == str(new):
        return
    db.session.add(ShopProductPriceHistory(
        product_id=product.id, variant_id=variant_id, field=field,
        old_value=None if old is None else str(old),
        new_value=None if new is None else str(new),
        reason=reason, changed_by=current_user_id(),
        created_at=datetime.now(timezone.utc),
    ))


# ── barcodes ─────────────────────────────────────────────────────────────────

def _normalize_incoming_barcode(value, fmt=None):
    """Normalize a barcode from a payload; ``None``/``''`` means "clear"."""
    if value in (None, ''):
        return None
    return validate_barcode(value, fmt)


def _barcode_from_payload(data):
    """``(barcode, barcode_format, barcode_type)`` for a create body."""
    normalized = _normalize_incoming_barcode(data.get('barcode'),
                                             data.get('barcode_format'))
    if normalized is None:
        return None, None, data.get('barcode_type') or 'external'
    fmt, btype = barcode_identity(normalized, data.get('barcode_format'),
                                  data.get('barcode_type'))
    return normalized, fmt, btype


def _barcode_error(error):
    """Answer for a rejected barcode, undoing partial writes first."""
    db.session.rollback()
    payload = {'error': error.message, 'code': error.code}
    if error.existing:
        payload['existing'] = error.existing
    return jsonify(payload), error.status


def _apply_barcode_payload(row, data, *, is_product):
    """Validate the barcode fields of a payload and write them onto a product
    or variant.

    Raises :class:`ShopBarcodeError` — including the 409 that names the row
    already owning the code — so callers answer with :func:`_barcode_error`.
    """
    if 'barcode' in data:
        barcode = _normalize_incoming_barcode(data.get('barcode'),
                                              data.get('barcode_format'))
    else:
        barcode = row.barcode
    fmt = data['barcode_format'] if 'barcode_format' in data else None
    btype = data['barcode_type'] if 'barcode_type' in data else None
    if barcode:
        if fmt:
            barcode = validate_barcode(barcode, fmt)
        conflict = barcode_conflict(
            barcode,
            exclude_product_id=row.id if is_product else None,
            exclude_variant_id=None if is_product else row.id)
        if conflict is not None:
            raise ShopBarcodeError(
                'This barcode is already assigned to another product.', 409,
                'duplicate_barcode', existing=conflict)
        if fmt is None and row.barcode == barcode:
            fmt = row.barcode_format
        fmt, btype = barcode_identity(barcode, fmt, btype)
    else:
        fmt, btype = None, btype or 'external'
    row.barcode = barcode
    row.barcode_format = fmt
    row.barcode_type = btype


@bp.get('/products')
@require_any_permission('shop.products.view', 'shop.view')
def list_products():
    q = ShopProduct.query
    search = request.args.get('q', '').strip()
    if search:
        like = f'%{search}%'
        q = q.filter(db.or_(ShopProduct.name.ilike(like),
                            ShopProduct.sku.ilike(like),
                            ShopProduct.barcode.ilike(like)))
    if request.args.get('category_id', type=int):
        q = q.filter_by(category_id=request.args.get('category_id', type=int))
    if request.args.get('brand_id', type=int):
        q = q.filter_by(brand_id=request.args.get('brand_id', type=int))
    if request.args.get('supplier_id', type=int):
        q = q.filter_by(supplier_id=request.args.get('supplier_id', type=int))
    status = request.args.get('status')
    if status:
        q = q.filter_by(status=status)
    else:
        q = q.filter(ShopProduct.status != 'archived')
    if request.args.get('serialized') == 'true':
        q = q.filter(ShopProduct.is_serialized.is_(True))
    if request.args.get('bundle') == 'true':
        q = q.filter(ShopProduct.is_bundle.is_(True))
    if request.args.get('low_stock') == 'true':
        q = q.filter(ShopProduct.min_stock_level > 0)
    order = request.args.get('order', 'name')
    ordering = {'name': ShopProduct.name,
                'created': ShopProduct.created_at.desc(),
                'price': ShopProduct.selling_price.desc()}.get(order, ShopProduct.name)
    p = paginate(q.order_by(ordering))
    branch_id = request.args.get('branch_id', type=int)
    items = []
    for product in p.items:
        # Always attach stock: branch_id narrows it, None aggregates every
        # branch — the POS needs a usable "available" figure either way.
        items.append(payload_for(product, stock=product_stock(product.id, branch_id)))
    return paginate_response(items, p)


@bp.get('/products/lookup')
@require_any_permission('shop.products.view', 'shop.sales.create', 'shop.view')
def lookup_product():
    """Resolve a scanned barcode or typed SKU for the POS.

    Same contract as ``/products/barcode`` (``code`` alias for ``value``) so
    both entry points record unknown scans and share one code path.
    """
    value = request.args.get('code') or request.args.get('value')
    if not value:
        return json_error('code is required', 400)
    return _lookup_barcode(value)


@bp.get('/products/barcode/<path:value>')
@require_any_permission('shop.products.view', 'shop.sales.create', 'shop.view')
def lookup_barcode(value):
    """Resolve a scanned barcode for POS, receiving and stock counts."""
    return _lookup_barcode(value)


@bp.get('/products/barcode')
@require_any_permission('shop.products.view', 'shop.sales.create', 'shop.view')
def lookup_barcode_query():
    """Same lookup for callers that cannot put the value in the path."""
    value = request.args.get('value') or request.args.get('code')
    if not value:
        return json_error('value is required', 400)
    return _lookup_barcode(value)


def _lookup_barcode(value):
    try:
        code = normalize_barcode(value)
    except ShopBarcodeError as error:
        return _barcode_error(error)
    if not code:
        return json_error('value is required', 400)
    context = request.args.get('context')
    if context and context not in UNKNOWN_CONTEXTS:
        return json_error(
            f'context must be one of {", ".join(UNKNOWN_CONTEXTS)}', 400,
            'invalid_context')
    branch_id = request.args.get('branch_id', type=int)
    if branch_id is None:
        # Availability is branch-specific: default to the caller's own branch
        # so a till never sells stock it does not physically hold.
        branch_id = user_branch_id()
    scanned_format = detect_format(code)
    product, variant, matched_by = resolve_barcode(code)
    if product is None:
        _record_unknown_scan(code, context, branch_id)
        return jsonify({
            'found': False,
            'barcode': code,
            'barcode_format': scanned_format,
            'message': 'No product with this barcode exists in the current inventory.',
        })
    stock = _scan_stock(product, variant, branch_id)
    response = {
        'found': True,
        'match': matched_by,
        'barcode': code,
        'barcode_format': scanned_format,
        'product': payload_for(product, stock=stock),
        'variant': payload_for(variant) if variant is not None else None,
        'available_stock': stock['available'],
        'branch_id': branch_id,
    }
    figures = _scan_branch_figures(product, variant, branch_id)
    if figures:
        response['branches'] = figures
    return jsonify(response)


def _scan_stock(product, variant, branch_id):
    """On-hand/available figures for the scanned item at ``branch_id``."""
    if variant is None:
        data = product_stock(product.id, branch_id)
        return {key: data[key]
                for key in ('on_hand', 'reserved', 'damaged', 'available')}
    query = ShopInventoryBalance.query.filter_by(product_id=product.id,
                                                 variant_id=variant.id)
    if branch_id is not None:
        query = query.filter_by(branch_id=branch_id)
    rows = query.all()
    return {
        'on_hand': sum(int(row.quantity) for row in rows),
        'reserved': sum(int(row.reserved_quantity) for row in rows),
        'damaged': sum(int(row.damaged_quantity) for row in rows),
        'available': sum(max(int(row.quantity) - int(row.reserved_quantity), 0)
                         for row in rows),
    }


def _scan_branch_figures(product, variant, branch_id):
    """Availability at the other branches — inventory readers only."""
    user = current_user()
    if user is None or not user.has_permission('shop.inventory.view'):
        return None
    query = ShopInventoryBalance.query.filter_by(product_id=product.id)
    if variant is not None:
        query = query.filter_by(variant_id=variant.id)
    figures = []
    for row in query.all():
        available = max(int(row.quantity) - int(row.reserved_quantity), 0)
        if available <= 0 or row.branch_id == branch_id:
            continue
        figures.append({'branch_id': row.branch_id,
                        'name': row.branch.name if row.branch else None,
                        'available': available})
    return figures or None


def _record_unknown_scan(code, context, branch_id):
    """Queue an unresolved scan — cataloguers are told after the third hit."""
    if not context:
        return None
    user = current_user()
    if user is None:
        return None
    permissions = user.permissions
    allowed = ('*' in permissions or 'shop.sales.create' in permissions
               or any(permission.startswith('shop.inventory.')
                      for permission in permissions))
    if not allowed:
        return None
    if branch_id is None:
        branch_id = user_branch_id()
    if branch_id is None or Branch.query.get(branch_id) is None:
        return None
    return record_unknown_scan(code, context=context, branch_id=branch_id,
                               user_id=user.id)


@bp.post('/products/<int:product_id>/barcode')
@require_permission('shop.products.edit')
def assign_product_barcode(product_id):
    """Register, reassign or clear a barcode on a product or one variant."""
    product = ShopProduct.query.get(product_id)
    if not product:
        return json_error('Product not found', 404)
    data = parse_json()
    if 'barcode' not in data:
        return json_error('barcode is required', 400, 'barcode_required')
    variant = None
    if data.get('variant_id') not in (None, ''):
        try:
            variant_id = int(data['variant_id'])
        except (TypeError, ValueError):
            return json_error('Invalid variant_id', 400, 'invalid_variant')
        variant = ShopProductVariant.query.get(variant_id)
        if variant is None or variant.product_id != product.id:
            return json_error('Variant not found', 404, 'variant_not_found')
    target = variant if variant is not None else product
    if not data.get('barcode'):
        previous = {'barcode': target.barcode,
                    'barcode_format': target.barcode_format,
                    'barcode_type': target.barcode_type}
        target.barcode = None
        target.barcode_format = None
        target.barcode_type = 'external'
        db.session.commit()
        if previous['barcode']:
            audit('shop_barcode_changed',
                  'shop_product_variant' if variant is not None else 'shop_product',
                  target.id, previous_value=previous,
                  new_value={'barcode': None, 'barcode_format': None,
                             'barcode_type': 'external'})
        return jsonify(_barcode_assignment_payload(product, variant))
    try:
        register_barcode(current_user(), product=product, value=data['barcode'],
                         fmt=data.get('barcode_format'),
                         btype=data.get('barcode_type'), variant=variant)
        db.session.commit()
    except ShopBarcodeError as error:
        return _barcode_error(error)
    return jsonify(_barcode_assignment_payload(product, variant))


def _barcode_assignment_payload(product, variant):
    payload = {'product': payload_for(product)}
    if variant is not None:
        payload['variant'] = payload_for(variant)
    return payload


@bp.get('/products/<int:product_id>')
@require_any_permission('shop.products.view', 'shop.view')
def get_product(product_id):
    product = ShopProduct.query.get(product_id)
    if not product:
        return json_error('Product not found', 404)
    data = payload_for(product, stock=product_stock(product.id))
    user = current_user()
    if user.has_permission('shop.products.view'):
        data['variants'] = [payload_for(v) for v in product.variants]
        data['price_history'] = [h.to_dict() for h in product.price_history[:20]] \
            if user.has_permission('shop.pricing.view') else []
    return jsonify({'product': data})


@bp.post('/products')
@require_permission('shop.products.create')
def create_product():
    data = parse_json()
    missing = required(data, 'sku', 'name')
    if missing:
        return json_error(f'{", ".join(missing)} is required', 400)
    sku = str(data['sku']).strip()
    if ShopProduct.query.filter_by(sku=sku).first():
        return json_error(f'Product SKU {sku} already exists', 409)
    status = data.get('status', 'active')
    if status not in SHOP_PRODUCT_STATUSES:
        return json_error('Invalid product status', 400)

    product = ShopProduct(
        sku=sku, name=data['name'],
        description=data.get('description'),
        category_id=data.get('category_id'), brand_id=data.get('brand_id'),
        supplier_id=data.get('supplier_id'),
        unit=data.get('unit') or 'pcs',
        purchase_cost=data.get('purchase_cost') or 0,
        selling_price=data.get('selling_price') or 0,
        min_selling_price=data.get('min_selling_price'),
        min_stock_level=int(data.get('min_stock_level') or 0),
        reorder_level=int(data.get('reorder_level') or 0),
        reorder_quantity=int(data.get('reorder_quantity') or 0),
        status=status,
        is_serialized=bool(data.get('is_serialized', False)),
        is_bundle=bool(data.get('is_bundle', False)),
        warranty_months=int(data.get('warranty_months') or 0),
        warranty_provider=data.get('warranty_provider'),
        warranty_terms=data.get('warranty_terms'),
        image_path=data.get('image_path') or data.get('image_url'),
        created_by=current_user_id(),
    )
    try:
        _apply_barcode_payload(product, data, is_product=True)
    except ShopBarcodeError as error:
        return _barcode_error(error)
    db.session.add(product)
    db.session.flush()
    _apply_product_attributes(product, data.get('attributes'))
    try:
        _apply_variants(product, data.get('variants'))
        _apply_bundle(product, data.get('bundle_items'))
    except ShopBarcodeError as error:
        return _barcode_error(error)
    db.session.commit()
    audit('shop_product_created', 'shop_product', product.id,
          new_value=payload_for(product))
    return jsonify({'product': payload_for(product, stock=product_stock(product.id))}), 201


@bp.patch('/products/<int:product_id>')
@require_permission('shop.products.edit')
def update_product(product_id):
    product = ShopProduct.query.get(product_id)
    if not product:
        return json_error('Product not found', 404)
    data = parse_json()
    previous = payload_for(product)
    reason = data.get('reason') or data.get('price_reason')

    if data.get('sku') and data['sku'] != product.sku:
        if ShopProduct.query.filter(ShopProduct.sku == data['sku'],
                                    ShopProduct.id != product.id).first():
            return json_error('Product SKU already exists', 409)
        product.sku = str(data['sku']).strip()
    if {'barcode', 'barcode_format', 'barcode_type'} & set(data):
        try:
            _apply_barcode_payload(product, data, is_product=True)
        except ShopBarcodeError as error:
            return _barcode_error(error)
    for field in ('name', 'description', 'category_id', 'brand_id', 'supplier_id',
                  'unit', 'warranty_provider', 'warranty_terms'):
        if field in data:
            setattr(product, field, data.get(field))
    for field in ('min_stock_level', 'reorder_level', 'reorder_quantity',
                  'warranty_months'):
        if field in data:
            setattr(product, field, int(data.get(field) or 0))
    if 'min_selling_price' in data:
        product.min_selling_price = data.get('min_selling_price')
    if 'is_serialized' in data:
        product.is_serialized = bool(data['is_serialized'])
    if 'image_path' in data or 'image_url' in data:
        product.image_path = data.get('image_path') or data.get('image_url')
    if 'status' in data:
        if data['status'] not in SHOP_PRODUCT_STATUSES:
            return json_error('Invalid product status', 400)
        product.status = data['status']

    if 'selling_price' in data:
        new_price = data.get('selling_price') or 0
        if product.min_selling_price is not None and \
                float(new_price) < float(product.min_selling_price):
            return json_error(
                'Selling price is below the configured minimum selling price', 400)
        _record_price_history(product, 'selling_price', product.selling_price,
                              new_price, reason)
        product.selling_price = new_price
    if 'purchase_cost' in data:
        new_cost = data.get('purchase_cost') or 0
        _record_price_history(product, 'purchase_cost', product.purchase_cost,
                              new_cost, reason)
        product.purchase_cost = new_cost

    _apply_product_attributes(product, data.get('attributes'))
    _apply_variants(product, data.get('variants'))
    _apply_bundle(product, data.get('bundle_items'))
    db.session.commit()
    audit('shop_product_updated', 'shop_product', product.id,
          previous_value=previous, new_value=payload_for(product))
    return jsonify({'product': payload_for(product, stock=product_stock(product.id))})


@bp.post('/products/<int:product_id>/status')
@require_permission('shop.products.archive')
def set_product_status(product_id):
    product = ShopProduct.query.get(product_id)
    if not product:
        return json_error('Product not found', 404)
    data = parse_json()
    status = data.get('status')
    if status not in SHOP_PRODUCT_STATUSES:
        return json_error('Invalid product status', 400)
    previous = product.status
    product.status = status
    db.session.commit()
    audit('shop_product_status', 'shop_product', product.id,
          previous_value={'status': previous}, new_value={'status': status})
    return jsonify({'product': payload_for(product)})


# ── variants ─────────────────────────────────────────────────────────────────

@bp.patch('/variants/<int:variant_id>')
@require_permission('shop.products.edit')
def update_variant(variant_id):
    variant = ShopProductVariant.query.get(variant_id)
    if not variant:
        return json_error('Variant not found', 404)
    data = parse_json()
    previous = payload_for(variant)
    if data.get('name'):
        variant.name = data['name']
    if 'attributes' in data:
        variant.attributes = data.get('attributes') or {}
    if {'barcode', 'barcode_format', 'barcode_type'} & set(data):
        try:
            _apply_barcode_payload(variant, data, is_product=False)
        except ShopBarcodeError as error:
            return _barcode_error(error)
    if 'is_active' in data:
        variant.is_active = bool(data['is_active'])
    if 'selling_price' in data:
        _record_price_history(variant.product, 'variant_selling_price',
                              variant.selling_price, data.get('selling_price'),
                              data.get('reason'), variant_id=variant.id)
        variant.selling_price = data.get('selling_price')
    if 'purchase_cost' in data:
        _record_price_history(variant.product, 'variant_purchase_cost',
                              variant.purchase_cost, data.get('purchase_cost'),
                              data.get('reason'), variant_id=variant.id)
        variant.purchase_cost = data.get('purchase_cost')
    db.session.commit()
    audit('shop_variant_updated', 'shop_variant', variant.id,
          previous_value=previous, new_value=payload_for(variant))
    return jsonify({'variant': payload_for(variant)})
