"""AfriTech Bridge Electronics Shop — catalogue models.

The shop is a standalone retail business unit. It shares the company's users,
employees, branches, payment methods, notifications, audit log and expenses,
but never the service centre's transaction tables: a shop sale is not an
Irembo/service transaction.

Rules enforced across the whole shop module:

* Inventory is owned by the stock-movement ledger; the balance row is only a
  cached running total written in the same transaction as its movement.
* Historical rows snapshot prices, costs and discounts — later catalogue edits
  never rewrite them.
* Money-bearing payloads redact themselves unless the caller passes a user
  holding the right shop permission (see ``app/auth/shop_scope.py``).
"""
from datetime import datetime, timezone

from ..extensions import db
from .user import TimestampMixin


def _utc_now():
    return datetime.now(timezone.utc)

# ── enumerations ──────────────────────────────────────────────────────────────

SHOP_PRODUCT_STATUSES = ('active', 'inactive', 'discontinued', 'archived')

SHOP_MOVEMENT_TYPES = (
    'opening_balance', 'purchase', 'sale', 'customer_return', 'supplier_return',
    'transfer_in', 'transfer_out', 'damage', 'loss', 'adjustment', 'stock_count',
    'correction', 'sale_reversal',
)

SHOP_PURCHASE_STATUSES = (
    'draft', 'pending_approval', 'approved', 'partially_received', 'received',
    'cancelled', 'closed',
)

SHOP_TRANSFER_STATUSES = ('requested', 'approved', 'dispatched', 'received', 'rejected', 'cancelled')

SHOP_COUNT_STATUSES = ('draft', 'submitted', 'approved', 'rejected')

SHOP_ADJUSTMENT_STATUSES = ('pending', 'approved', 'rejected', 'applied')

SHOP_SALE_STATUSES = ('held', 'completed', 'cancelled', 'refunded', 'partially_refunded')

SHOP_RETURN_STATUSES = ('requested', 'approved', 'received', 'rejected', 'completed')

SHOP_RETURN_TYPES = ('refund', 'exchange', 'repair', 'store_credit', 'replacement')

SHOP_WARRANTY_CASE_STATUSES = (
    'open', 'under_inspection', 'approved', 'repairing', 'replacement_pending',
    'resolved', 'rejected', 'closed',
)

SHOP_SERIAL_STATUSES = (
    'in_stock', 'sold', 'returned', 'damaged', 'lost', 'under_inspection',
    'returned_to_supplier', 'written_off',
)

SHOP_CONDITIONS = ('good', 'damaged', 'under_inspection', 'wrong_product', 'incomplete')

SHOP_SUPPLIER_RETURN_STATUSES = ('draft', 'sent', 'completed', 'cancelled')

SHOP_ALERT_TYPES = ('low_stock', 'out_of_stock', 'overdue_po', 'slow_moving', 'dead_stock')

SHOP_SHIFT_STATUSES = ('open', 'closed')

SHOP_CLOSING_STATUSES = ('submitted', 'approved', 'rejected', 'correction_requested')

SHOP_UNKNOWN_BARCODE_STATUSES = ('open', 'ignored', 'registered')

SHOP_UNKNOWN_BARCODE_CONTEXTS = ('pos', 'receiving', 'count', 'lookup')


class ShopSeries(db.Model):
    """Per-day sequence counter behind every shop document number."""
    __tablename__ = 'shop_series'

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(64), unique=True, nullable=False, index=True)
    last_number = db.Column(db.Integer, nullable=False, default=0)


# ── catalogue ─────────────────────────────────────────────────────────────────

class ShopProductCategory(TimestampMixin, db.Model):
    __tablename__ = 'shop_product_categories'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False, index=True)
    code = db.Column(db.String(64), unique=True, nullable=False, index=True)
    parent_id = db.Column(db.Integer, db.ForeignKey('shop_product_categories.id'))
    description = db.Column(db.String(500))
    sort_order = db.Column(db.Integer, default=0, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    parent = db.relationship('ShopProductCategory', remote_side=[id], backref='children')
    products = db.relationship('ShopProduct', backref='category')

    def to_dict(self, include_children=False):
        data = {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'parent_id': self.parent_id,
            'parent': self.parent.name if self.parent else None,
            'description': self.description,
            'sort_order': self.sort_order,
            'is_active': self.is_active,
            'product_count': len(self.products),
        }
        if include_children:
            data['children'] = [c.to_dict() for c in
                                sorted(self.children, key=lambda x: (x.sort_order, x.name))]
        return data


class ShopBrand(TimestampMixin, db.Model):
    __tablename__ = 'shop_brands'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False, index=True)
    code = db.Column(db.String(64), unique=True, nullable=False, index=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    products = db.relationship('ShopProduct', backref='brand')

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'code': self.code,
            'is_active': self.is_active, 'product_count': len(self.products),
        }


class ShopAttribute(TimestampMixin, db.Model):
    """Configurable attribute (Colour, Model, Capacity, Connector Type…)."""
    __tablename__ = 'shop_attributes'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False, index=True)
    code = db.Column(db.String(64), unique=True, nullable=False, index=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    values = db.relationship('ShopProductAttributeValue', backref='attribute',
                             cascade='all, delete-orphan')

    def to_dict(self):
        return {'id': self.id, 'name': self.name, 'code': self.code,
                'is_active': self.is_active}


class ShopSupplier(TimestampMixin, db.Model):
    __tablename__ = 'shop_suppliers'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(32), unique=True, nullable=False, index=True)
    company_name = db.Column(db.String(160), nullable=False, index=True)
    contact_person = db.Column(db.String(128))
    phone = db.Column(db.String(32), index=True)
    email = db.Column(db.String(128))
    address = db.Column(db.String(255))
    tax_number = db.Column(db.String(64))
    payment_terms = db.Column(db.String(128))
    notes = db.Column(db.String(500))
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    products = db.relationship('ShopProduct', backref='supplier')
    purchase_orders = db.relationship('ShopPurchaseOrder', backref='supplier')

    @property
    def outstanding_orders(self):
        return [po for po in self.purchase_orders
                if po.status in ('draft', 'pending_approval', 'approved', 'partially_received')]

    @property
    def total_purchased(self):
        return sum(float(po.total_amount or 0) for po in self.purchase_orders
                   if po.status in ('partially_received', 'received', 'closed'))

    def to_dict(self, with_stats=False):
        data = {
            'id': self.id, 'code': self.code, 'company_name': self.company_name,
            'contact_person': self.contact_person, 'phone': self.phone, 'email': self.email,
            'address': self.address, 'tax_number': self.tax_number,
            'payment_terms': self.payment_terms, 'notes': self.notes,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if with_stats:
            data['outstanding_orders'] = len(self.outstanding_orders)
            data['total_purchased'] = round(self.total_purchased, 2)
            data['product_count'] = len(self.products)
        return data


class ShopProduct(TimestampMixin, db.Model):
    __tablename__ = 'shop_products'

    id = db.Column(db.Integer, primary_key=True)
    sku = db.Column(db.String(64), unique=True, nullable=False, index=True)
    barcode = db.Column(db.String(64), unique=True, index=True)
    barcode_format = db.Column(db.String(32))
    barcode_type = db.Column(db.String(16), default='external', nullable=False)
    name = db.Column(db.String(160), nullable=False, index=True)
    description = db.Column(db.Text)
    category_id = db.Column(db.Integer, db.ForeignKey('shop_product_categories.id'), index=True)
    brand_id = db.Column(db.Integer, db.ForeignKey('shop_brands.id'), index=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey('shop_suppliers.id'))
    unit = db.Column(db.String(32), default='pcs', nullable=False)

    purchase_cost = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    selling_price = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    min_selling_price = db.Column(db.Numeric(16, 4))

    min_stock_level = db.Column(db.Integer, default=0, nullable=False)
    reorder_level = db.Column(db.Integer, default=0, nullable=False)
    reorder_quantity = db.Column(db.Integer, default=0, nullable=False)

    status = db.Column(db.String(32), default='active', nullable=False, index=True)
    is_serialized = db.Column(db.Boolean, default=False, nullable=False)
    is_bundle = db.Column(db.Boolean, default=False, nullable=False)

    warranty_months = db.Column(db.Integer, default=0, nullable=False)
    warranty_provider = db.Column(db.String(128))
    warranty_terms = db.Column(db.String(500))

    image_path = db.Column(db.String(255))
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    variants = db.relationship('ShopProductVariant', backref='product',
                               cascade='all, delete-orphan',
                               order_by='ShopProductVariant.sort_order')
    attribute_values = db.relationship('ShopProductAttributeValue', backref='product',
                                       cascade='all, delete-orphan')
    bundle_items = db.relationship('ShopBundleItem',
                                   foreign_keys='ShopBundleItem.bundle_product_id',
                                   backref='bundle_product', cascade='all, delete-orphan')
    price_history = db.relationship('ShopProductPriceHistory', backref='product',
                                    cascade='all, delete-orphan',
                                    order_by='ShopProductPriceHistory.id.desc()')

    @property
    def is_active(self):
        return self.status == 'active'

    @property
    def has_variants(self):
        return bool(self.variants)

    def to_dict(self, user=None, stock=None):
        from ..auth.shop_scope import can_view_shop_costs
        payload = {
            'id': self.id, 'sku': self.sku, 'barcode': self.barcode,
            'barcode_format': self.barcode_format,
            'barcode_type': self.barcode_type, 'name': self.name,
            'description': self.description,
            'category_id': self.category_id,
            'category': self.category.name if self.category else None,
            'category_code': self.category.code if self.category else None,
            'brand_id': self.brand_id, 'brand': self.brand.name if self.brand else None,
            'supplier_id': self.supplier_id,
            'supplier': self.supplier.company_name if self.supplier else None,
            'unit': self.unit,
            'selling_price': float(self.selling_price or 0),
            'min_stock_level': self.min_stock_level,
            'reorder_level': self.reorder_level,
            'reorder_quantity': self.reorder_quantity,
            'status': self.status, 'is_active': self.is_active,
            'is_serialized': self.is_serialized, 'is_bundle': self.is_bundle,
            'warranty_months': self.warranty_months,
            'warranty_provider': self.warranty_provider,
            'warranty_terms': self.warranty_terms,
            'image_path': self.image_path,
            'variant_count': len(self.variants),
            'has_variants': self.has_variants,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if user is None or can_view_shop_costs(user):
            payload['purchase_cost'] = float(self.purchase_cost or 0)
            payload['min_selling_price'] = (float(self.min_selling_price)
                                            if self.min_selling_price is not None else None)
            payload['attributes'] = [
                {'attribute_id': av.attribute_id,
                 'attribute': av.attribute.name if av.attribute else None,
                 'value': av.value}
                for av in self.attribute_values
            ]
            payload['bundle_items'] = [b.to_dict() for b in self.bundle_items]
        if stock is not None:
            payload.update(stock)
        return payload


class ShopProductVariant(TimestampMixin, db.Model):
    """Structured variant (model / colour / wattage) with its own identity.

    Variants carry an independent SKU, barcode, stock, cost and price — never
    free text hanging off the parent product.
    """
    __tablename__ = 'shop_product_variants'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'), nullable=False, index=True)
    sku = db.Column(db.String(64), unique=True, nullable=False, index=True)
    barcode = db.Column(db.String(64), unique=True, index=True)
    barcode_format = db.Column(db.String(32))
    barcode_type = db.Column(db.String(16), default='external', nullable=False)
    name = db.Column(db.String(160), nullable=False)
    attributes = db.Column(db.JSON, default=dict)
    purchase_cost = db.Column(db.Numeric(16, 4))
    selling_price = db.Column(db.Numeric(16, 4))
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    sort_order = db.Column(db.Integer, default=0, nullable=False)
    image_path = db.Column(db.String(255))

    @property
    def effective_price(self):
        if self.selling_price is not None:
            return float(self.selling_price)
        return float(self.product.selling_price or 0) if self.product else 0.0

    @property
    def effective_cost(self):
        if self.purchase_cost is not None:
            return float(self.purchase_cost)
        return float(self.product.purchase_cost or 0) if self.product else 0.0

    def to_dict(self, user=None):
        from ..auth.shop_scope import can_view_shop_costs
        payload = {
            'id': self.id, 'product_id': self.product_id,
            'product': self.product.name if self.product else None,
            'sku': self.sku, 'barcode': self.barcode,
            'barcode_format': self.barcode_format,
            'barcode_type': self.barcode_type, 'name': self.name,
            'attributes': self.attributes or {},
            'selling_price': self.effective_price,
            'is_active': self.is_active, 'sort_order': self.sort_order,
            'image_path': self.image_path,
            'is_serialized': self.product.is_serialized if self.product else False,
        }
        if user is None or can_view_shop_costs(user):
            payload['purchase_cost'] = self.effective_cost
        return payload


class ShopProductAttributeValue(TimestampMixin, db.Model):
    __tablename__ = 'shop_product_attribute_values'
    __table_args__ = (
        db.UniqueConstraint('product_id', 'attribute_id', 'value',
                            name='uq_shop_product_attr_value'),
    )

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'), nullable=False, index=True)
    attribute_id = db.Column(db.Integer, db.ForeignKey('shop_attributes.id'), nullable=False, index=True)
    value = db.Column(db.String(160), nullable=False)


class ShopProductPriceHistory(db.Model):
    """Append-only price / cost change log — never rewritten."""
    __tablename__ = 'shop_product_price_history'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'), nullable=False, index=True)
    variant_id = db.Column(db.Integer, db.ForeignKey('shop_product_variants.id'))
    field = db.Column(db.String(32), nullable=False)
    old_value = db.Column(db.String(64))
    new_value = db.Column(db.String(64))
    reason = db.Column(db.String(255))
    changed_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False,
                           index=True, default=_utc_now)

    changer = db.relationship('User', foreign_keys=[changed_by])

    def to_dict(self):
        return {
            'id': self.id, 'product_id': self.product_id, 'variant_id': self.variant_id,
            'field': self.field, 'old_value': self.old_value, 'new_value': self.new_value,
            'reason': self.reason, 'changed_by': self.changed_by,
            'changed_by_name': (self.changer.employee.full_name
                                if self.changer and self.changer.employee
                                else self.changer.email if self.changer else None),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class ShopBundleItem(db.Model):
    """Component line of a bundle product; stock drops for every component."""
    __tablename__ = 'shop_bundle_items'

    id = db.Column(db.Integer, primary_key=True)
    bundle_product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'),
                                  nullable=False, index=True)
    component_product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'),
                                     nullable=False, index=True)
    component_variant_id = db.Column(db.Integer, db.ForeignKey('shop_product_variants.id'))
    quantity = db.Column(db.Integer, nullable=False, default=1)

    component = db.relationship('ShopProduct', foreign_keys=[component_product_id],
                                backref='used_in_bundles')
    component_variant = db.relationship('ShopProductVariant')

    def to_dict(self):
        return {
            'id': self.id, 'bundle_product_id': self.bundle_product_id,
            'component_product_id': self.component_product_id,
            'component': self.component.name if self.component else None,
            'component_sku': self.component.sku if self.component else None,
            'component_variant_id': self.component_variant_id,
            'component_variant': self.component_variant.name if self.component_variant else None,
            'quantity': self.quantity,
        }


class ShopUnknownBarcode(TimestampMixin, db.Model):
    """A barcode scanned at a till/receiving/count station but not yet in the
    catalogue.

    One row per (barcode, context, branch): the first scan opens it, every
    later scan bumps ``times_scanned`` and ``last_seen_at`` so the catalogue
    team can see which unknown codes keep coming back. The third scan warns
    the holders of ``shop.products.create`` once (``notified``).
    """
    __tablename__ = 'shop_unknown_barcodes'
    __table_args__ = (
        db.UniqueConstraint('barcode', 'context', 'branch_id',
                            name='uq_shop_unknown_barcode_ctx'),
        db.Index('ix_shop_unknown_barcode_status_last', 'status', 'last_seen_at'),
    )

    id = db.Column(db.Integer, primary_key=True)
    barcode = db.Column(db.String(64), nullable=False, index=True)
    barcode_format = db.Column(db.String(32))
    context = db.Column(db.String(24), nullable=False)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'),
                          nullable=False, index=True)
    first_seen_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    times_scanned = db.Column(db.Integer, default=1, nullable=False)
    first_seen_at = db.Column(db.DateTime(timezone=True), default=_utc_now,
                              nullable=False)
    last_seen_at = db.Column(db.DateTime(timezone=True), default=_utc_now,
                             nullable=False)
    status = db.Column(db.String(16), default='open', nullable=False, index=True)
    resolved_product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'))
    notified = db.Column(db.Boolean, default=False, nullable=False)

    branch = db.relationship('Branch')
    seer = db.relationship('User', foreign_keys=[first_seen_by])
    resolved_product = db.relationship('ShopProduct',
                                       foreign_keys=[resolved_product_id])

    def to_dict(self):
        return {
            'id': self.id,
            'barcode': self.barcode,
            'barcode_format': self.barcode_format,
            'context': self.context,
            'branch_id': self.branch_id,
            'branch': self.branch.name if self.branch else None,
            'branch_code': self.branch.code if self.branch else None,
            'first_seen_by': self.first_seen_by,
            'first_seen_by_name': (self.seer.employee.full_name
                                   if self.seer and self.seer.employee
                                   else self.seer.email if self.seer else None),
            'times_scanned': int(self.times_scanned or 0),
            'first_seen_at': self.first_seen_at.isoformat() if self.first_seen_at else None,
            'last_seen_at': self.last_seen_at.isoformat() if self.last_seen_at else None,
            'status': self.status,
            'resolved_product_id': self.resolved_product_id,
            'resolved_product': self.resolved_product.name if self.resolved_product else None,
            'resolved_product_sku': self.resolved_product.sku if self.resolved_product else None,
            'notified': bool(self.notified),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
