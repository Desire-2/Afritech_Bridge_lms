"""Shop promotions (basket-level offers)."""
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify

from ...extensions import db
from ...models import ShopPromotion, ShopPromotionItem, ShopProduct, ShopProductCategory
from ...auth.auth import require_permission, require_any_permission, current_user
from ...services.audit import audit
from ..helpers import json_error, parse_json, paginate, paginate_response, required
from .common import payload_for, scoped_branch_id

bp = Blueprint('shop_promotions', __name__, url_prefix='/api/shop')

PROMOTION_TYPES = ('percentage', 'fixed', 'bogo')


def _parse_dt(value, field):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        raise ValueError(f'{field} must be an ISO date-time')


def _apply_items(promotion, items):
    promotion.items.clear()
    db.session.flush()
    for entry in items or []:
        if not entry.get('product_id') and not entry.get('category_id'):
            raise ValueError('Each promotion item needs a product or a category')
        promotion.items.append(ShopPromotionItem(
            product_id=entry.get('product_id'),
            variant_id=entry.get('variant_id'),
            category_id=entry.get('category_id'),
            min_quantity=int(entry.get('min_quantity') or 1),
        ))


@bp.get('/promotions')
@require_any_permission('shop.promotions.manage', 'shop.view')
def list_promotions():
    q = ShopPromotion.query
    branch_id = scoped_branch_id()
    if branch_id is not None:
        # ``branches`` is a JSON list of branch ids: empty means "all branches".
        ids = [m.id for m in q.all()
               if not m.branches or branch_id in m.branches]
        q = ShopPromotion.query.filter(ShopPromotion.id.in_(ids))
    if request.args.get('active') == 'true':
        q = q.filter_by(is_active=True)
    elif request.args.get('active') == 'false':
        q = q.filter_by(is_active=False)
    search = request.args.get('q', '').strip()
    if search:
        q = q.filter(db.or_(ShopPromotion.name.ilike(f'%{search}%'),
                            ShopPromotion.code.ilike(f'%{search}%')))
    p = paginate(q.order_by(ShopPromotion.id.desc()))
    user = current_user()
    return paginate_response([m.to_dict(user=user, include_items=True)
                              for m in p.items], p)


@bp.get('/promotions/<int:row_id>')
@require_any_permission('shop.promotions.manage', 'shop.view')
def get_promotion(row_id):
    row = ShopPromotion.query.get(row_id)
    if not row:
        return json_error('Promotion not found', 404)
    return jsonify({'promotion': payload_for(row, include_items=True)})


@bp.post('/promotions')
@require_permission('shop.promotions.manage')
def create_promotion():
    data = parse_json()
    missing = required(data, 'name', 'starts_at', 'ends_at')
    if missing:
        return json_error(f'{", ".join(missing)} is required', 400)
    try:
        starts_at = _parse_dt(data['starts_at'], 'starts_at')
        ends_at = _parse_dt(data['ends_at'], 'ends_at')
    except ValueError as exc:
        return json_error(str(exc), 400)
    if ends_at <= starts_at:
        return json_error('ends_at must be after starts_at', 400)
    promotion_type = data.get('promotion_type') or 'percentage'
    if promotion_type not in PROMOTION_TYPES:
        return json_error('Invalid promotion type', 400)
    if data.get('code') and ShopPromotion.query.filter_by(
            code=data['code']).first():
        return json_error('That promotion code already exists', 409)

    row = ShopPromotion(
        name=data['name'], code=data.get('code'), promotion_type=promotion_type,
        value=data.get('value') or 0,
        min_purchase_amount=data.get('min_purchase_amount') or 0,
        max_discount_amount=data.get('max_discount_amount'),
        starts_at=starts_at, ends_at=ends_at,
        is_active=bool(data.get('is_active', True)),
        usage_limit=data.get('usage_limit'),
        branches=data.get('branches') or [], notes=data.get('notes'),
    )
    try:
        _apply_items(row, data.get('items'))
    except ValueError as exc:
        return json_error(str(exc), 400)
    db.session.add(row)
    db.session.commit()
    audit('shop_promotion_created', 'shop_promotion', row.id,
          new_value=payload_for(row, include_items=True))
    return jsonify({'promotion': payload_for(row, include_items=True)}), 201


@bp.patch('/promotions/<int:row_id>')
@require_permission('shop.promotions.manage')
def update_promotion(row_id):
    row = ShopPromotion.query.get(row_id)
    if not row:
        return json_error('Promotion not found', 404)
    data = parse_json()
    previous = payload_for(row, include_items=True)
    for field in ('name', 'code', 'promotion_type', 'value',
                  'min_purchase_amount', 'max_discount_amount', 'usage_limit',
                  'branches', 'notes', 'is_active'):
        if field in data:
            setattr(row, field, data.get(field))
    for field in ('starts_at', 'ends_at'):
        if field in data:
            parsed = _parse_dt(data.get(field), field)
            if parsed is None:
                return json_error(f'{field} is required', 400)
            setattr(row, field, parsed)
    if row.ends_at and row.starts_at and row.ends_at <= row.starts_at:
        return json_error('ends_at must be after starts_at', 400)
    if 'items' in data:
        try:
            _apply_items(row, data.get('items'))
        except ValueError as exc:
            return json_error(str(exc), 400)
    db.session.commit()
    audit('shop_promotion_updated', 'shop_promotion', row.id,
          previous_value=previous, new_value=payload_for(row, include_items=True))
    return jsonify({'promotion': payload_for(row, include_items=True)})


@bp.delete('/promotions/<int:row_id>')
@require_permission('shop.promotions.manage')
def deactivate_promotion(row_id):
    """Promotions are switched off rather than deleted — sales reference them."""
    row = ShopPromotion.query.get(row_id)
    if not row:
        return json_error('Promotion not found', 404)
    previous = payload_for(row, include_items=True)
    row.is_active = False
    db.session.commit()
    audit('shop_promotion_deactivated', 'shop_promotion', row.id,
          previous_value=previous, new_value=payload_for(row, include_items=True))
    return jsonify({'promotion': payload_for(row, include_items=True)})
