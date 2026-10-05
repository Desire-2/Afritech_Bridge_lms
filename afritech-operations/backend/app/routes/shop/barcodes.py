"""The unknown-barcode queue: codes a scanner saw but the catalogue lacks.

Every miss on ``GET /products/barcode/<value>`` (with a ``context``) lands
here so catalogue holders can see what the shop floor keeps scanning before
it is registered.
"""
from flask import Blueprint, jsonify, request

from ...extensions import db
from ...models import (
    ShopProduct, ShopUnknownBarcode, SHOP_UNKNOWN_BARCODE_CONTEXTS,
    SHOP_UNKNOWN_BARCODE_STATUSES,
)
from ...auth.auth import require_permission, require_any_permission
from ...services.audit import audit
from ..helpers import json_error, paginate, paginate_response, parse_json
from ...services.barcode import normalize_barcode, ShopBarcodeError

bp = Blueprint('shop_unknown_barcodes', __name__, url_prefix='/api/shop')


@bp.get('/unknown-barcodes')
@require_any_permission('shop.products.view', 'shop.settings.manage')
def list_unknown_barcodes():
    """The queue as the shop floor left it, newest scan first.

    ``status`` defaults to ``open`` so the actionable rows are what a
    catalogue holder sees; pass ``status=all`` to see every row.
    """
    status = request.args.get('status', 'open')
    query = ShopUnknownBarcode.query
    if status and status != 'all':
        if status not in SHOP_UNKNOWN_BARCODE_STATUSES:
            return json_error(
                f'status must be one of {", ".join(SHOP_UNKNOWN_BARCODE_STATUSES)}',
                400, 'invalid_status')
        query = query.filter_by(status=status)
    context = request.args.get('context')
    if context:
        if context not in SHOP_UNKNOWN_BARCODE_CONTEXTS:
            return json_error(
                f'context must be one of {", ".join(SHOP_UNKNOWN_BARCODE_CONTEXTS)}',
                400, 'invalid_context')
        query = query.filter_by(context=context)
    branch_id = request.args.get('branch_id', type=int)
    if branch_id:
        query = query.filter_by(branch_id=branch_id)
    term = request.args.get('q') or request.args.get('barcode')
    if term:
        try:
            code = normalize_barcode(term)
        except ShopBarcodeError as error:
            return json_error(error.message, error.status, error.code)
        if code:
            query = query.filter(ShopUnknownBarcode.barcode.ilike(
                f'%{code}%'))
    query = query.order_by(ShopUnknownBarcode.last_seen_at.desc(),
                           ShopUnknownBarcode.id.desc())
    page = paginate(query)
    return paginate_response([row.to_dict() for row in page.items], page)


@bp.patch('/unknown-barcodes/<int:row_id>')
@require_permission('shop.products.edit')
def update_unknown_barcode(row_id):
    """Move a queued scan between open → ignored/registered.

    ``registered`` needs the product the code now belongs to, so the queue
    shows where the scan ended up.
    """
    row = ShopUnknownBarcode.query.get(row_id)
    if row is None:
        return json_error('Unknown barcode not found', 404)
    data = parse_json()
    status = data.get('status', row.status)
    if status not in SHOP_UNKNOWN_BARCODE_STATUSES:
        return json_error(
            f'status must be one of {", ".join(SHOP_UNKNOWN_BARCODE_STATUSES)}',
            400, 'invalid_status')
    raw_product = data.get('product_id', data.get('resolved_product_id'))
    if raw_product in (None, ''):
        product_id = None
    else:
        try:
            product_id = int(raw_product)
        except (TypeError, ValueError):
            return json_error('Invalid product_id', 400, 'invalid_product')
        product = ShopProduct.query.get(product_id)
        if product is None:
            return json_error('Product not found', 404, 'product_not_found')
    if status == 'registered' and product_id is None:
        return json_error('A registered barcode needs product_id', 400,
                          'resolved_product_required')
    previous = {'status': row.status,
                'resolved_product_id': row.resolved_product_id}
    row.status = status
    row.resolved_product_id = product_id
    if status != previous['status'] or \
            product_id != previous['resolved_product_id']:
        audit('shop_unknown_barcode_registered' if status == 'registered'
              else 'shop_unknown_barcode_status_changed',
              'shop_unknown_barcode', row.id,
              previous_value=previous,
              new_value={'status': row.status,
                         'resolved_product_id': row.resolved_product_id})
    db.session.commit()
    return jsonify({'unknown_barcode': row.to_dict()})
