"""AfriTech Bridge Electronics Shop — purchasing, sales, warranty and shifts.

Purchasing and selling are separate payment domains from the service centre: a
shop sale lives on ``ShopSale``/``ShopPayment``, never on
``ServiceTransaction``/``Payment``. Historical rows snapshot unit cost, price,
discount and warranty terms so later catalogue or setting changes never
rewrite a receipt.
"""
from datetime import datetime, timezone

from ..extensions import db
from .shop import (
    SHOP_PURCHASE_STATUSES, SHOP_SALE_STATUSES, SHOP_RETURN_STATUSES,
    SHOP_RETURN_TYPES, SHOP_WARRANTY_CASE_STATUSES, SHOP_CONDITIONS,
    SHOP_SUPPLIER_RETURN_STATUSES, SHOP_SHIFT_STATUSES, SHOP_CLOSING_STATUSES,
)
from .user import TimestampMixin


def _utc_now():
    return datetime.now(timezone.utc)


class ShopPurchaseOrder(TimestampMixin, db.Model):
    __tablename__ = 'shop_purchase_orders'

    id = db.Column(db.Integer, primary_key=True)
    po_number = db.Column(db.String(32), unique=True, nullable=False, index=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey('shop_suppliers.id'), nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False, index=True)
    status = db.Column(db.String(32), default='draft', nullable=False, index=True)

    expected_date = db.Column(db.DateTime(timezone=True))
    approved_at = db.Column(db.DateTime(timezone=True))
    cancelled_at = db.Column(db.DateTime(timezone=True))
    closed_at = db.Column(db.DateTime(timezone=True))

    subtotal = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    discount_amount = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    tax_amount = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    shipping_amount = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    total_amount = db.Column(db.Numeric(16, 4), default=0, nullable=False)

    notes = db.Column(db.String(500))
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    cancelled_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    branch = db.relationship('Branch')
    items = db.relationship('ShopPurchaseOrderItem', backref='purchase_order',
                            cascade='all, delete-orphan', order_by='ShopPurchaseOrderItem.id')
    receipts = db.relationship('ShopGoodsReceipt', backref='purchase_order')
    creator = db.relationship('User', foreign_keys=[created_by])
    approver = db.relationship('User', foreign_keys=[approved_by])

    @property
    def received_quantity(self):
        return sum(int(ri.quantity_received or 0) for r in self.receipts
                   for ri in r.items if r.status != 'cancelled')

    @property
    def ordered_quantity(self):
        return sum(int(i.quantity_ordered) for i in self.items)

    def compute_totals(self):
        self.subtotal = sum(
            (i.quantity_ordered * (i.unit_cost or 0)) for i in self.items)
        self.total_amount = (float(self.subtotal or 0) - float(self.discount_amount or 0)
                             + float(self.tax_amount or 0) + float(self.shipping_amount or 0))
        return self.total_amount

    def to_dict(self, user=None, include_items=False):
        from ..auth.shop_scope import can_view_shop_costs
        payload = {
            'id': self.id, 'po_number': self.po_number,
            'supplier_id': self.supplier_id,
            'supplier': self.supplier.company_name if self.supplier else None,
            'branch_id': self.branch_id,
            'branch': self.branch.name if self.branch else None,
            'status': self.status,
            'expected_date': self.expected_date.isoformat() if self.expected_date else None,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'cancelled_at': self.cancelled_at.isoformat() if self.cancelled_at else None,
            'closed_at': self.closed_at.isoformat() if self.closed_at else None,
            'notes': self.notes,
            'created_by': self.created_by,
            'created_by_name': (self.creator.employee.full_name
                                if self.creator and self.creator.employee
                                else self.creator.email if self.creator else None),
            'approved_by': self.approved_by,
            'ordered_quantity': self.ordered_quantity,
            'received_quantity': self.received_quantity,
            'line_count': len(self.items),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if user is None or can_view_shop_costs(user):
            payload.update({
                'subtotal': float(self.subtotal or 0),
                'discount_amount': float(self.discount_amount or 0),
                'tax_amount': float(self.tax_amount or 0),
                'shipping_amount': float(self.shipping_amount or 0),
                'total_amount': float(self.total_amount or 0),
            })
        if include_items:
            payload['items'] = [i.to_dict(user=user) for i in self.items]
        return payload


class ShopPurchaseOrderItem(db.Model):
    __tablename__ = 'shop_purchase_order_items'

    id = db.Column(db.Integer, primary_key=True)
    purchase_order_id = db.Column(db.Integer, db.ForeignKey('shop_purchase_orders.id'),
                                  nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('shop_product_variants.id'))
    quantity_ordered = db.Column(db.Integer, nullable=False, default=1)
    quantity_received = db.Column(db.Integer, nullable=False, default=0)
    unit_cost = db.Column(db.Numeric(16, 4), nullable=False, default=0)
    discount_amount = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    tax_rate = db.Column(db.Numeric(6, 3), default=0, nullable=False)
    note = db.Column(db.String(255))

    product = db.relationship('ShopProduct')
    variant = db.relationship('ShopProductVariant')

    @property
    def line_total(self):
        base = int(self.quantity_ordered) * float(self.unit_cost or 0)
        after_discount = base - float(self.discount_amount or 0)
        return after_discount * (1 + float(self.tax_rate or 0) / 100)

    @property
    def outstanding_quantity(self):
        return max(int(self.quantity_ordered) - int(self.quantity_received), 0)

    def to_dict(self, user=None):
        from ..auth.shop_scope import can_view_shop_costs
        payload = {
            'id': self.id, 'purchase_order_id': self.purchase_order_id,
            'product_id': self.product_id,
            'product': self.product.name if self.product else None,
            'sku': (self.variant.sku if self.variant
                    else self.product.sku if self.product else None),
            'variant_id': self.variant_id,
            'variant': self.variant.name if self.variant else None,
            'quantity_ordered': int(self.quantity_ordered),
            'quantity_received': int(self.quantity_received),
            'outstanding_quantity': self.outstanding_quantity,
            'note': self.note,
        }
        if user is None or can_view_shop_costs(user):
            payload['unit_cost'] = float(self.unit_cost or 0)
            payload['discount_amount'] = float(self.discount_amount or 0)
            payload['tax_rate'] = float(self.tax_rate or 0)
            payload['line_total'] = round(self.line_total, 2)
        return payload


class ShopGoodsReceipt(TimestampMixin, db.Model):
    """Receiving of ordered stock; writes the purchase movements and layers."""
    __tablename__ = 'shop_goods_receipts'

    id = db.Column(db.Integer, primary_key=True)
    receipt_number = db.Column(db.String(32), unique=True, nullable=False, index=True)
    purchase_order_id = db.Column(db.Integer, db.ForeignKey('shop_purchase_orders.id'),
                                  nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False, index=True)
    status = db.Column(db.String(32), default='draft', nullable=False, index=True)

    supplier_invoice = db.Column(db.String(64))
    received_at = db.Column(db.DateTime(timezone=True), default=_utc_now)
    notes = db.Column(db.String(500))
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    branch = db.relationship('Branch')
    items = db.relationship('ShopGoodsReceiptItem', backref='goods_receipt',
                            cascade='all, delete-orphan', order_by='ShopGoodsReceiptItem.id')
    creator = db.relationship('User', foreign_keys=[created_by])

    @property
    def total_cost(self):
        return sum(float(i.line_cost or 0) for i in self.items)

    def to_dict(self, user=None, include_items=False):
        from ..auth.shop_scope import can_view_shop_costs
        payload = {
            'id': self.id, 'receipt_number': self.receipt_number,
            'purchase_order_id': self.purchase_order_id,
            'po_number': self.purchase_order.po_number if self.purchase_order else None,
            'branch_id': self.branch_id,
            'branch': self.branch.name if self.branch else None,
            'status': self.status, 'supplier_invoice': self.supplier_invoice,
            'received_at': self.received_at.isoformat() if self.received_at else None,
            'notes': self.notes, 'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if user is None or can_view_shop_costs(user):
            payload['total_cost'] = round(self.total_cost, 2)
        if include_items:
            payload['items'] = [i.to_dict(user=user) for i in self.items]
        return payload


class ShopGoodsReceiptItem(db.Model):
    __tablename__ = 'shop_goods_receipt_items'

    id = db.Column(db.Integer, primary_key=True)
    goods_receipt_id = db.Column(db.Integer, db.ForeignKey('shop_goods_receipts.id'),
                                 nullable=False, index=True)
    purchase_order_item_id = db.Column(db.Integer, db.ForeignKey('shop_purchase_order_items.id'))
    product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('shop_product_variants.id'))
    quantity_received = db.Column(db.Integer, nullable=False, default=0)
    quantity_accepted = db.Column(db.Integer, nullable=False, default=0)
    quantity_rejected = db.Column(db.Integer, nullable=False, default=0)
    unit_cost = db.Column(db.Numeric(16, 4), nullable=False, default=0)
    note = db.Column(db.String(255))

    product = db.relationship('ShopProduct')
    variant = db.relationship('ShopProductVariant')

    @property
    def line_cost(self):
        return int(self.quantity_accepted) * float(self.unit_cost or 0)

    def to_dict(self, user=None):
        from ..auth.shop_scope import can_view_shop_costs
        payload = {
            'id': self.id, 'goods_receipt_id': self.goods_receipt_id,
            'purchase_order_item_id': self.purchase_order_item_id,
            'product_id': self.product_id,
            'product': self.product.name if self.product else None,
            'sku': (self.variant.sku if self.variant
                    else self.product.sku if self.product else None),
            'variant_id': self.variant_id,
            'variant': self.variant.name if self.variant else None,
            'quantity_received': int(self.quantity_received),
            'quantity_accepted': int(self.quantity_accepted),
            'quantity_rejected': int(self.quantity_rejected),
            'note': self.note,
        }
        if user is None or can_view_shop_costs(user):
            payload['unit_cost'] = float(self.unit_cost or 0)
            payload['line_cost'] = round(self.line_cost, 2)
        return payload


class ShopSupplierReturn(TimestampMixin, db.Model):
    """Return of defective or wrong stock back to the supplier."""
    __tablename__ = 'shop_supplier_returns'

    id = db.Column(db.Integer, primary_key=True)
    return_number = db.Column(db.String(32), unique=True, nullable=False, index=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey('shop_suppliers.id'), nullable=False)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False)
    purchase_order_id = db.Column(db.Integer, db.ForeignKey('shop_purchase_orders.id'))
    status = db.Column(db.String(32), default='draft', nullable=False, index=True)
    reason = db.Column(db.String(64), nullable=False)
    notes = db.Column(db.String(500))
    credit_amount = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    supplier = db.relationship('ShopSupplier')
    branch = db.relationship('Branch')
    purchase_order = db.relationship('ShopPurchaseOrder')
    items = db.relationship('ShopSupplierReturnItem', backref='supplier_return',
                            cascade='all, delete-orphan', order_by='ShopSupplierReturnItem.id')
    creator = db.relationship('User', foreign_keys=[created_by])

    def to_dict(self, user=None, include_items=False):
        from ..auth.shop_scope import can_view_shop_costs
        payload = {
            'id': self.id, 'return_number': self.return_number,
            'supplier_id': self.supplier_id,
            'supplier': self.supplier.company_name if self.supplier else None,
            'branch_id': self.branch_id,
            'branch': self.branch.name if self.branch else None,
            'purchase_order_id': self.purchase_order_id,
            'status': self.status, 'reason': self.reason, 'notes': self.notes,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if user is None or can_view_shop_costs(user):
            payload['credit_amount'] = float(self.credit_amount or 0)
        if include_items:
            payload['items'] = [i.to_dict(user=user) for i in self.items]
        return payload


class ShopSupplierReturnItem(db.Model):
    __tablename__ = 'shop_supplier_return_items'

    id = db.Column(db.Integer, primary_key=True)
    supplier_return_id = db.Column(db.Integer, db.ForeignKey('shop_supplier_returns.id'),
                                   nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('shop_product_variants.id'))
    quantity = db.Column(db.Integer, nullable=False, default=1)
    unit_cost = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    condition = db.Column(db.String(32), default='good', nullable=False)
    note = db.Column(db.String(255))

    product = db.relationship('ShopProduct')
    variant = db.relationship('ShopProductVariant')

    def to_dict(self, user=None):
        from ..auth.shop_scope import can_view_shop_costs
        payload = {
            'id': self.id, 'supplier_return_id': self.supplier_return_id,
            'product_id': self.product_id,
            'product': self.product.name if self.product else None,
            'sku': (self.variant.sku if self.variant
                    else self.product.sku if self.product else None),
            'variant_id': self.variant_id,
            'variant': self.variant.name if self.variant else None,
            'quantity': int(self.quantity), 'condition': self.condition, 'note': self.note,
        }
        if user is None or can_view_shop_costs(user):
            payload['unit_cost'] = float(self.unit_cost or 0)
        return payload


class ShopCustomer(TimestampMixin, db.Model):
    __tablename__ = 'shop_customers'

    id = db.Column(db.Integer, primary_key=True)
    customer_number = db.Column(db.String(32), unique=True, index=True)
    full_name = db.Column(db.String(160), nullable=False, index=True)
    phone = db.Column(db.String(32), index=True)
    email = db.Column(db.String(128))
    address = db.Column(db.String(255))
    national_id = db.Column(db.String(64))
    customer_type = db.Column(db.String(32), default='individual', nullable=False)
    tax_number = db.Column(db.String(64))
    credit_limit = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    loyalty_points = db.Column(db.Integer, default=0, nullable=False)
    notes = db.Column(db.String(500))
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    creator = db.relationship('User', foreign_keys=[created_by])
    sales = db.relationship('ShopSale', backref='customer')

    @property
    def total_purchases(self):
        return sum(float(s.net_total or 0) for s in self.sales
                   if s.status in ('completed', 'partially_refunded', 'refunded'))

    @property
    def last_purchase_at(self):
        dates = [s.created_at for s in self.sales if s.created_at]
        return max(dates) if dates else None

    def to_dict(self, user=None):
        from ..auth.shop_scope import can_view_shop_financials
        payload = {
            'id': self.id, 'customer_number': self.customer_number,
            'full_name': self.full_name, 'phone': self.phone, 'email': self.email,
            'address': self.address, 'national_id': self.national_id,
            'customer_type': self.customer_type, 'tax_number': self.tax_number,
            'loyalty_points': int(self.loyalty_points or 0),
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if user is None or can_view_shop_financials(user):
            payload['credit_limit'] = float(self.credit_limit or 0)
            payload['total_purchases'] = round(self.total_purchases, 2)
            payload['last_purchase_at'] = (self.last_purchase_at.isoformat()
                                           if self.last_purchase_at else None)
        return payload


class ShopSale(TimestampMixin, db.Model):
    """A POS transaction. Never shared with the service centre's tables."""
    __tablename__ = 'shop_sales'
    # Every report scans a date window, optionally pinned to a branch:
    # `ix_shop_sales_created_at` serves the company-wide range, the composite
    # serves `branch_id = ? AND created_at BETWEEN …` (the daily closing and
    # every scoped dashboard) without a second lookup.
    __table_args__ = (
        db.Index('ix_shop_sales_created_at', 'created_at'),
        db.Index('ix_shop_sales_branch_created_at', 'branch_id', 'created_at'),
        # Idempotency is per branch: a till retries a basket under a key it
        # generated, so two branches may legitimately produce the same string
        # while one branch must never save it twice.
        db.UniqueConstraint('branch_id', 'client_ref',
                            name='uq_shop_sales_branch_client_ref'),
    )

    id = db.Column(db.Integer, primary_key=True)
    sale_number = db.Column(db.String(32), unique=True, nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False, index=True)
    client_ref = db.Column(db.String(64))
    customer_id = db.Column(db.Integer, db.ForeignKey('shop_customers.id'), index=True)
    shift_id = db.Column(db.Integer, db.ForeignKey('shop_shifts.id'), index=True)
    promotion_id = db.Column(db.Integer, db.ForeignKey('shop_promotions.id'), index=True)

    status = db.Column(db.String(32), default='completed', nullable=False, index=True)
    sale_type = db.Column(db.String(32), default='pos', nullable=False)

    subtotal = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    discount_amount = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    tax_amount = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    total_amount = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    amount_paid = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    amount_due = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    change_given = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    amount_refunded = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    loyalty_points_earned = db.Column(db.Integer, default=0, nullable=False)
    loyalty_points_redeemed = db.Column(db.Integer, default=0, nullable=False)

    discount_reason = db.Column(db.String(255))
    discount_approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    notes = db.Column(db.String(500))
    receipt_sent_to = db.Column(db.String(128))
    cancelled_at = db.Column(db.DateTime(timezone=True))
    cancelled_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    exchange_sale_id = db.Column(db.Integer, db.ForeignKey('shop_sales.id'))
    exchange_credit = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    branch = db.relationship('Branch', backref='sales')
    shift = db.relationship('ShopShift', backref='sales')
    promotion = db.relationship('ShopPromotion')
    items = db.relationship('ShopSaleItem', backref='sale',
                            cascade='all, delete-orphan', order_by='ShopSaleItem.id')
    payments = db.relationship('ShopPayment', backref='sale',
                               cascade='all, delete-orphan', order_by='ShopPayment.id')
    sale_returns = db.relationship('ShopReturn', backref='sale',
                                   foreign_keys='ShopReturn.sale_id',
                                   order_by='ShopReturn.id')
    discount_approver = db.relationship('User', foreign_keys=[discount_approved_by])
    canceller = db.relationship('User', foreign_keys=[cancelled_by])
    creator = db.relationship('User', foreign_keys=[created_by])
    exchange_of = db.relationship('ShopSale', remote_side=[id],
                                  backref='exchanges')

    @property
    def net_total(self):
        return float(self.total_amount or 0) - float(self.amount_refunded or 0)

    @property
    def payment_status(self):
        paid = float(self.amount_paid or 0) - float(self.amount_refunded or 0)
        total = float(self.total_amount or 0)
        if paid >= total - 0.005:
            return 'paid'
        if paid > 0:
            return 'partially_paid'
        return 'unpaid'

    @property
    def has_warranty(self):
        return any((i.warranty_months or 0) > 0 for i in self.items)

    def to_dict(self, user=None, include_items=False):
        from ..auth.shop_scope import can_view_shop_costs, can_view_shop_financials
        payload = {
            'id': self.id, 'sale_number': self.sale_number,
            'branch_id': self.branch_id,
            'branch': self.branch.name if self.branch else None,
            'branch_code': self.branch.code if self.branch else None,
            'customer_id': self.customer_id,
            'customer': self.customer.full_name if self.customer else None,
            'customer_phone': self.customer.phone if self.customer else None,
            'shift_id': self.shift_id,
            'promotion_id': self.promotion_id,
            'status': self.status, 'sale_type': self.sale_type,
            'client_ref': self.client_ref,
            'payment_status': self.payment_status,
            'item_count': sum(int(i.quantity) for i in self.items),
            'line_count': len(self.items),
            'total_amount': float(self.total_amount or 0),
            'discount_amount': float(self.discount_amount or 0),
            'discount_reason': self.discount_reason,
            'has_warranty': self.has_warranty,
            'receipt_sent_to': self.receipt_sent_to,
            'notes': self.notes,
            'exchange_sale_id': self.exchange_sale_id,
            'cancelled_at': self.cancelled_at.isoformat() if self.cancelled_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'created_by': self.created_by,
        }
        if user is None or can_view_shop_financials(user):
            payload.update({
                'subtotal': float(self.subtotal or 0),
                'tax_amount': float(self.tax_amount or 0),
                'amount_paid': float(self.amount_paid or 0),
                'amount_due': float(self.amount_due or 0),
                'change_given': float(self.change_given or 0),
                'amount_refunded': float(self.amount_refunded or 0),
                'net_total': self.net_total,
                'loyalty_points_earned': int(self.loyalty_points_earned or 0),
                'loyalty_points_redeemed': int(self.loyalty_points_redeemed or 0),
                'exchange_credit': float(self.exchange_credit or 0),
            })
        if include_items:
            payload['items'] = [i.to_dict(user=user) for i in self.items]
            payload['payments'] = [p.to_dict(user=user) for p in self.payments]
        if user is None or can_view_shop_costs(user):
            payload['cost_of_goods'] = round(sum(i.line_cost for i in self.items), 2)
        return payload


class ShopSaleItem(db.Model):
    __tablename__ = 'shop_sale_items'

    id = db.Column(db.Integer, primary_key=True)
    sale_id = db.Column(db.Integer, db.ForeignKey('shop_sales.id'), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'), nullable=False, index=True)
    variant_id = db.Column(db.Integer, db.ForeignKey('shop_product_variants.id'))

    barcode_at_sale = db.Column(db.String(64))
    sku_at_sale = db.Column(db.String(64))
    product_name_at_sale = db.Column(db.String(200))

    quantity = db.Column(db.Integer, nullable=False, default=1)
    unit_price = db.Column(db.Numeric(16, 4), nullable=False, default=0)
    unit_cost = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    discount_amount = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    discount_percent = db.Column(db.Numeric(6, 3), default=0, nullable=False)
    tax_rate = db.Column(db.Numeric(6, 3), default=0, nullable=False)
    tax_amount = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    line_total = db.Column(db.Numeric(16, 4), default=0, nullable=False)

    warranty_months = db.Column(db.Integer, default=0, nullable=False)
    warranty_terms = db.Column(db.String(500))
    serial_ids = db.Column(db.JSON, default=list)
    returned_quantity = db.Column(db.Integer, default=0, nullable=False)
    note = db.Column(db.String(255))

    product = db.relationship('ShopProduct')
    variant = db.relationship('ShopProductVariant')
    serials = db.relationship('ShopSerializedItem', backref='sale_item',
                              foreign_keys='ShopSerializedItem.sale_item_id')

    @property
    def line_cost(self):
        return float(self.unit_cost or 0) * int(self.quantity)

    @property
    def net_total(self):
        return float(self.line_total or 0)

    @property
    def returnable_quantity(self):
        return int(self.quantity) - int(self.returned_quantity or 0)

    @property
    def margin(self):
        return self.net_total - self.line_cost

    def to_dict(self, user=None):
        from ..auth.shop_scope import can_view_shop_costs, can_view_shop_financials
        payload = {
            'id': self.id, 'sale_id': self.sale_id,
            'product_id': self.product_id,
            'product': self.product.name if self.product else None,
            'sku': (self.variant.sku if self.variant
                    else self.product.sku if self.product else None),
            'barcode': (self.variant.barcode if self.variant
                        else self.product.barcode if self.product else None),
            'barcode_at_sale': self.barcode_at_sale,
            'sku_at_sale': self.sku_at_sale,
            'product_name_at_sale': self.product_name_at_sale,
            'variant_id': self.variant_id,
            'variant': self.variant.name if self.variant else None,
            'image_path': (self.product.image_path if self.product else None),
            'quantity': int(self.quantity),
            'unit_price': float(self.unit_price or 0),
            'warranty_months': int(self.warranty_months or 0),
            'warranty_terms': self.warranty_terms,
            'returned_quantity': int(self.returned_quantity or 0),
            'returnable_quantity': self.returnable_quantity,
            'serials': [s.serial_number for s in self.serials],
            'note': self.note,
        }
        if user is None or can_view_shop_financials(user):
            payload['discount_amount'] = float(self.discount_amount or 0)
            payload['discount_percent'] = float(self.discount_percent or 0)
            payload['tax_rate'] = float(self.tax_rate or 0)
            payload['tax_amount'] = float(self.tax_amount or 0)
            payload['line_total'] = float(self.line_total or 0)
        if user is None or can_view_shop_costs(user):
            payload['unit_cost'] = float(self.unit_cost or 0)
            payload['line_cost'] = round(self.line_cost, 2)
            payload['margin'] = round(self.margin, 2)
        return payload


class ShopPayment(db.Model):
    """A payment tender attached to a shop sale."""
    __tablename__ = 'shop_payments'

    id = db.Column(db.Integer, primary_key=True)
    sale_id = db.Column(db.Integer, db.ForeignKey('shop_sales.id'), nullable=False, index=True)
    payment_method_id = db.Column(db.Integer, db.ForeignKey('payment_methods.id'), nullable=False)
    amount = db.Column(db.Numeric(16, 4), nullable=False)
    reference = db.Column(db.String(128))
    status = db.Column(db.String(32), default='completed', nullable=False)
    paid_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_utc_now)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_utc_now)

    method = db.relationship('PaymentMethod')
    creator = db.relationship('User', foreign_keys=[created_by])

    # ``payment_methods`` only carries name/code/is_active, so the tender kind
    # is derived from the code. Anything not recognised is treated as a
    # transfer-style payment; 'credit' style codes mean money is still owed.
    CREDIT_CODES = ('credit', 'postpaid', 'account')

    @property
    def kind(self):
        code = (self.method.code or '').lower() if self.method else ''
        if code == 'cash':
            return 'cash'
        if code in self.CREDIT_CODES:
            return 'credit'
        if code == 'momo':
            return 'mobile'
        if code == 'card':
            return 'card'
        if code in ('bank', 'cheque', 'online'):
            return code
        return 'other'

    @property
    def is_credit(self):
        return self.kind == 'credit'

    @property
    def is_cash(self):
        return self.kind == 'cash'

    def to_dict(self, user=None):
        from ..auth.shop_scope import can_view_shop_financials
        payload = {
            'id': self.id, 'sale_id': self.sale_id,
            'payment_method_id': self.payment_method_id,
            'method': self.method.name if self.method else None,
            'method_code': getattr(self.method, 'code', None),
            'method_type': self.kind,
            'reference': self.reference, 'status': self.status,
            'is_credit': self.is_credit,
            'is_cash': self.is_cash,
            'paid_at': self.paid_at.isoformat() if self.paid_at else None,
        }
        if user is None or can_view_shop_financials(user):
            payload['amount'] = float(self.amount or 0)
        return payload


class ShopReturn(TimestampMixin, db.Model):
    """Customer return or exchange against an original sale."""
    __tablename__ = 'shop_returns'

    id = db.Column(db.Integer, primary_key=True)
    return_number = db.Column(db.String(32), unique=True, nullable=False, index=True)
    sale_id = db.Column(db.Integer, db.ForeignKey('shop_sales.id'), nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('shop_customers.id'))
    shift_id = db.Column(db.Integer, db.ForeignKey('shop_shifts.id'))

    return_type = db.Column(db.String(32), default='refund', nullable=False)
    status = db.Column(db.String(32), default='requested', nullable=False, index=True)
    reason = db.Column(db.String(64), nullable=False)
    notes = db.Column(db.String(500))

    subtotal_returned = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    tax_returned = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    refund_amount = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    restock_fee = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    exchange_sale_id = db.Column(db.Integer, db.ForeignKey('shop_sales.id'))

    requested_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    approved_at = db.Column(db.DateTime(timezone=True))
    completed_at = db.Column(db.DateTime(timezone=True))
    rejected_reason = db.Column(db.String(255))

    branch = db.relationship('Branch')
    customer = db.relationship('ShopCustomer')
    shift = db.relationship('ShopShift')
    items = db.relationship('ShopReturnItem', backref='sale_return',
                            cascade='all, delete-orphan', order_by='ShopReturnItem.id')
    requester = db.relationship('User', foreign_keys=[requested_by])
    approver = db.relationship('User', foreign_keys=[approved_by])
    exchange_sale = db.relationship('ShopSale', foreign_keys=[exchange_sale_id],
                                    backref='exchange_from_returns')

    @property
    def requires_approval(self):
        return self.status == 'requested'

    @property
    def line_count(self):
        return sum(int(i.quantity) for i in self.items)

    def to_dict(self, user=None, include_items=False):
        from ..auth.shop_scope import can_view_shop_financials
        payload = {
            'id': self.id, 'return_number': self.return_number,
            'sale_id': self.sale_id,
            'sale_number': self.sale.sale_number if self.sale else None,
            'branch_id': self.branch_id,
            'branch': self.branch.name if self.branch else None,
            'customer_id': self.customer_id,
            'customer': self.customer.full_name if self.customer else None,
            'shift_id': self.shift_id,
            'return_type': self.return_type, 'status': self.status,
            'reason': self.reason, 'notes': self.notes,
            'exchange_sale_id': self.exchange_sale_id,
            'rejected_reason': self.rejected_reason,
            'requested_by': self.requested_by,
            'requested_by_name': (self.requester.employee.full_name
                                  if self.requester and self.requester.employee
                                  else self.requester.email if self.requester else None),
            'approved_by': self.approved_by,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'line_count': self.line_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if user is None or can_view_shop_financials(user):
            payload.update({
                'subtotal_returned': float(self.subtotal_returned or 0),
                'tax_returned': float(self.tax_returned or 0),
                'refund_amount': float(self.refund_amount or 0),
                'restock_fee': float(self.restock_fee or 0),
            })
        if include_items:
            payload['items'] = [i.to_dict(user=user) for i in self.items]
        return payload


class ShopReturnItem(db.Model):
    __tablename__ = 'shop_return_items'

    id = db.Column(db.Integer, primary_key=True)
    return_id = db.Column(db.Integer, db.ForeignKey('shop_returns.id'),
                          nullable=False, index=True)
    sale_item_id = db.Column(db.Integer, db.ForeignKey('shop_sale_items.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('shop_product_variants.id'))

    quantity = db.Column(db.Integer, nullable=False, default=1)
    unit_price = db.Column(db.Numeric(16, 4), nullable=False, default=0)
    unit_cost = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    tax_amount = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    condition = db.Column(db.String(32), default='good', nullable=False)
    restock = db.Column(db.Boolean, default=True, nullable=False)
    serial_id = db.Column(db.Integer, db.ForeignKey('shop_serialized_items.id'))
    note = db.Column(db.String(255))

    sale_item = db.relationship('ShopSaleItem')
    product = db.relationship('ShopProduct')
    variant = db.relationship('ShopProductVariant')
    serial = db.relationship('ShopSerializedItem')

    @property
    def line_total(self):
        return int(self.quantity) * float(self.unit_price or 0)

    @property
    def line_cost(self):
        return int(self.quantity) * float(self.unit_cost or 0)

    @property
    def can_restock(self):
        return self.restock and self.condition in ('good', 'under_inspection')

    def to_dict(self, user=None):
        from ..auth.shop_scope import can_view_shop_costs, can_view_shop_financials
        payload = {
            'id': self.id, 'return_id': self.return_id,
            'sale_item_id': self.sale_item_id,
            'product_id': self.product_id,
            'product': self.product.name if self.product else None,
            'sku': (self.variant.sku if self.variant
                    else self.product.sku if self.product else None),
            'variant_id': self.variant_id,
            'variant': self.variant.name if self.variant else None,
            'quantity': int(self.quantity),
            'condition': self.condition,
            'restock': self.restock,
            'can_restock': self.can_restock,
            'serial_id': self.serial_id,
            'serial_number': self.serial.serial_number if self.serial else None,
            'note': self.note,
        }
        if user is None or can_view_shop_financials(user):
            payload['unit_price'] = float(self.unit_price or 0)
            payload['tax_amount'] = float(self.tax_amount or 0)
            payload['line_total'] = round(self.line_total, 2)
        if user is None or can_view_shop_costs(user):
            payload['unit_cost'] = float(self.unit_cost or 0)
        return payload


class ShopWarrantyRegistration(TimestampMixin, db.Model):
    """Warranty activated for a sold item, optionally linked to the customer."""
    __tablename__ = 'shop_warranty_registrations'

    id = db.Column(db.Integer, primary_key=True)
    warranty_number = db.Column(db.String(32), unique=True, nullable=False, index=True)
    sale_item_id = db.Column(db.Integer, db.ForeignKey('shop_sale_items.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'), nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey('shop_customers.id'))
    serial_id = db.Column(db.Integer, db.ForeignKey('shop_serialized_items.id'))

    warranty_months = db.Column(db.Integer, nullable=False, default=0)
    provider = db.Column(db.String(128))
    terms = db.Column(db.String(500))
    start_date = db.Column(db.DateTime(timezone=True), nullable=False, default=_utc_now)
    end_date = db.Column(db.DateTime(timezone=True), nullable=False)
    status = db.Column(db.String(32), default='active', nullable=False, index=True)
    notes = db.Column(db.String(500))

    sale_item = db.relationship('ShopSaleItem', backref='warranty_registrations')
    product = db.relationship('ShopProduct')
    customer = db.relationship('ShopCustomer')
    serial = db.relationship('ShopSerializedItem')
    cases = db.relationship('ShopWarrantyCase', backref='registration',
                            cascade='all, delete-orphan')

    @property
    def is_expired(self):
        if not self.end_date:
            return False
        end = self.end_date
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        return end < _utc_now()

    @property
    def days_remaining(self):
        if not self.end_date or self.is_expired:
            return 0
        end = self.end_date
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        return (end - _utc_now()).days

    @property
    def sale(self):
        return self.sale_item.sale if self.sale_item else None

    @property
    def sale_number(self):
        return self.sale.sale_number if self.sale else None

    def to_dict(self, user=None, include_cases=False):
        payload = {
            'id': self.id, 'warranty_number': self.warranty_number,
            'sale_item_id': self.sale_item_id,
            'sale_id': self.sale.id if self.sale else None,
            'sale_number': self.sale_number,
            'product_id': self.product_id,
            'product': self.product.name if self.product else None,
            'sku': self.product.sku if self.product else None,
            'customer_id': self.customer_id,
            'customer': self.customer.full_name if self.customer else None,
            'customer_phone': self.customer.phone if self.customer else None,
            'serial_id': self.serial_id,
            'serial_number': self.serial.serial_number if self.serial else None,
            'warranty_months': int(self.warranty_months or 0),
            'provider': self.provider, 'terms': self.terms,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'status': self.status,
            'is_expired': self.is_expired,
            'days_remaining': self.days_remaining,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_cases:
            payload['cases'] = [c.to_dict() for c in self.cases]
        return payload


class ShopWarrantyCase(TimestampMixin, db.Model):
    __tablename__ = 'shop_warranty_cases'

    id = db.Column(db.Integer, primary_key=True)
    case_number = db.Column(db.String(32), unique=True, nullable=False, index=True)
    registration_id = db.Column(db.Integer, db.ForeignKey('shop_warranty_registrations.id'),
                                nullable=False, index=True)
    status = db.Column(db.String(32), default='open', nullable=False, index=True)
    issue_description = db.Column(db.Text, nullable=False)
    inspection_notes = db.Column(db.Text)
    resolution_notes = db.Column(db.Text)
    diagnosis = db.Column(db.String(500))
    parts_used = db.Column(db.String(500))
    repair_cost = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    replacement_product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'))
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id'))
    received_at = db.Column(db.DateTime(timezone=True), default=_utc_now)
    due_at = db.Column(db.DateTime(timezone=True))
    resolved_at = db.Column(db.DateTime(timezone=True))
    closed_at = db.Column(db.DateTime(timezone=True))
    rejected_reason = db.Column(db.String(255))

    replacement_product = db.relationship('ShopProduct')
    assignee = db.relationship('User', foreign_keys=[assigned_to])

    @property
    def is_overdue(self):
        if not self.due_at or self.resolved_at or self.closed_at:
            return False
        due = self.due_at
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        return due < _utc_now()

    def to_dict(self, user=None):
        from ..auth.shop_scope import can_view_shop_costs
        payload = {
            'id': self.id, 'case_number': self.case_number,
            'registration_id': self.registration_id,
            'warranty_number': (self.registration.warranty_number
                                if self.registration else None),
            'product': (self.registration.product.name
                        if self.registration and self.registration.product else None),
            'customer': (self.registration.customer.full_name
                         if self.registration and self.registration.customer else None),
            'serial_number': (self.registration.serial.serial_number
                              if self.registration and self.registration.serial else None),
            'status': self.status,
            'issue_description': self.issue_description,
            'inspection_notes': self.inspection_notes,
            'resolution_notes': self.resolution_notes,
            'diagnosis': self.diagnosis,
            'parts_used': self.parts_used,
            'assigned_to': self.assigned_to,
            'assigned_to_name': (self.assignee.employee.full_name
                                 if self.assignee and self.assignee.employee
                                 else self.assignee.email if self.assignee else None),
            'received_at': self.received_at.isoformat() if self.received_at else None,
            'due_at': self.due_at.isoformat() if self.due_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'closed_at': self.closed_at.isoformat() if self.closed_at else None,
            'is_overdue': self.is_overdue,
            'rejected_reason': self.rejected_reason,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if user is None or can_view_shop_costs(user):
            payload['repair_cost'] = float(self.repair_cost or 0)
        return payload


class ShopPromotion(TimestampMixin, db.Model):
    __tablename__ = 'shop_promotions'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(160), nullable=False, index=True)
    code = db.Column(db.String(64), unique=True, index=True)
    promotion_type = db.Column(db.String(32), default='percentage', nullable=False)
    value = db.Column(db.Numeric(16, 4), nullable=False, default=0)
    min_purchase_amount = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    max_discount_amount = db.Column(db.Numeric(16, 4))
    starts_at = db.Column(db.DateTime(timezone=True), nullable=False)
    ends_at = db.Column(db.DateTime(timezone=True), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False, index=True)
    usage_limit = db.Column(db.Integer)
    used_count = db.Column(db.Integer, default=0, nullable=False)
    branches = db.Column(db.JSON, default=list)
    notes = db.Column(db.String(500))

    items = db.relationship('ShopPromotionItem', backref='promotion',
                            cascade='all, delete-orphan')

    @property
    def is_running(self):
        now = _utc_now()
        start = self.starts_at
        end = self.ends_at
        if start and start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if end and end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        return bool(self.is_active and start and end and start <= now <= end)

    @property
    def is_exhausted(self):
        return bool(self.usage_limit and self.used_count >= self.usage_limit)

    def to_dict(self, user=None, include_items=False):
        payload = {
            'id': self.id, 'name': self.name, 'code': self.code,
            'promotion_type': self.promotion_type,
            'value': float(self.value or 0),
            'min_purchase_amount': float(self.min_purchase_amount or 0),
            'max_discount_amount': (float(self.max_discount_amount)
                                    if self.max_discount_amount is not None else None),
            'starts_at': self.starts_at.isoformat() if self.starts_at else None,
            'ends_at': self.ends_at.isoformat() if self.ends_at else None,
            'is_active': self.is_active,
            'is_running': self.is_running,
            'usage_limit': self.usage_limit,
            'used_count': int(self.used_count or 0),
            'is_exhausted': self.is_exhausted,
            'branches': self.branches or [],
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_items:
            payload['items'] = [i.to_dict() for i in self.items]
        return payload


class ShopPromotionItem(db.Model):
    __tablename__ = 'shop_promotion_items'

    id = db.Column(db.Integer, primary_key=True)
    promotion_id = db.Column(db.Integer, db.ForeignKey('shop_promotions.id'),
                             nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('shop_product_variants.id'))
    category_id = db.Column(db.Integer, db.ForeignKey('shop_product_categories.id'))
    min_quantity = db.Column(db.Integer, default=1, nullable=False)

    product = db.relationship('ShopProduct')
    variant = db.relationship('ShopProductVariant')
    category = db.relationship('ShopProductCategory')

    def to_dict(self):
        return {
            'id': self.id, 'promotion_id': self.promotion_id,
            'product_id': self.product_id,
            'product': self.product.name if self.product else None,
            'variant_id': self.variant_id,
            'variant': self.variant.name if self.variant else None,
            'category_id': self.category_id,
            'category': self.category.name if self.category else None,
            'min_quantity': int(self.min_quantity or 1),
        }


class ShopShift(TimestampMixin, db.Model):
    """POS till session: opening float, sales, closings."""
    __tablename__ = 'shop_shifts'

    id = db.Column(db.Integer, primary_key=True)
    shift_number = db.Column(db.String(32), unique=True, nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False, index=True)
    opened_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    closed_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    status = db.Column(db.String(32), default='open', nullable=False, index=True)

    opening_float = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    expected_cash = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    counted_cash = db.Column(db.Numeric(16, 4))
    cash_difference = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    total_sales = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    total_refunds = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    notes = db.Column(db.String(500))
    opened_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_utc_now)
    closed_at = db.Column(db.DateTime(timezone=True))

    branch = db.relationship('Branch')
    opener = db.relationship('User', foreign_keys=[opened_by])
    closer = db.relationship('User', foreign_keys=[closed_by])
    closings = db.relationship('ShopDailyClosing', backref='shift',
                               cascade='all, delete-orphan')

    @property
    def duration_minutes(self):
        if not self.opened_at or not self.closed_at:
            return None
        opened = self.opened_at
        closed = self.closed_at
        if opened.tzinfo is None:
            opened = opened.replace(tzinfo=timezone.utc)
        if closed.tzinfo is None:
            closed = closed.replace(tzinfo=timezone.utc)
        return int((closed - opened).total_seconds() // 60)

    def to_dict(self, user=None):
        from ..auth.shop_scope import can_view_shop_financials
        payload = {
            'id': self.id, 'shift_number': self.shift_number,
            'branch_id': self.branch_id,
            'branch': self.branch.name if self.branch else None,
            'status': self.status,
            'opened_by': self.opened_by,
            'opened_by_name': (self.opener.employee.full_name
                               if self.opener and self.opener.employee
                               else self.opener.email if self.opener else None),
            'closed_by': self.closed_by,
            'closed_by_name': (self.closer.employee.full_name
                               if self.closer and self.closer.employee
                               else self.closer.email if self.closer else None),
            'opened_at': self.opened_at.isoformat() if self.opened_at else None,
            'closed_at': self.closed_at.isoformat() if self.closed_at else None,
            'duration_minutes': self.duration_minutes,
            'sale_count': len(self.sales),
            'notes': self.notes,
        }
        if user is None or can_view_shop_financials(user):
            payload.update({
                'opening_float': float(self.opening_float or 0),
                'expected_cash': float(self.expected_cash or 0),
                'counted_cash': (float(self.counted_cash)
                                 if self.counted_cash is not None else None),
                'cash_difference': float(self.cash_difference or 0),
                'total_sales': float(self.total_sales or 0),
                'total_refunds': float(self.total_refunds or 0),
            })
        return payload


class ShopDailyClosing(TimestampMixin, db.Model):
    """End-of-day reconciliation per branch, reviewed by a manager/accountant."""
    __tablename__ = 'shop_daily_closings'
    __table_args__ = (
        db.UniqueConstraint('branch_id', 'business_date', name='uq_shop_closing_branch_date'),
    )

    id = db.Column(db.Integer, primary_key=True)
    closing_number = db.Column(db.String(32), unique=True, nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False, index=True)
    shift_id = db.Column(db.Integer, db.ForeignKey('shop_shifts.id'))
    business_date = db.Column(db.Date, nullable=False, index=True)
    status = db.Column(db.String(32), default='submitted', nullable=False, index=True)

    gross_sales = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    discounts = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    taxes = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    refunds = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    net_sales = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    expected_cash = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    counted_cash = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    cash_difference = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    payment_breakdown = db.Column(db.JSON, default=dict)
    notes = db.Column(db.String(500))
    submitted_at = db.Column(db.DateTime(timezone=True), default=_utc_now)
    reviewed_at = db.Column(db.DateTime(timezone=True))

    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    reviewed_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    branch = db.relationship('Branch')
    creator = db.relationship('User', foreign_keys=[created_by])
    reviewer = db.relationship('User', foreign_keys=[reviewed_by])

    def to_dict(self, user=None):
        from ..auth.shop_scope import can_view_shop_financials
        payload = {
            'id': self.id, 'closing_number': self.closing_number,
            'branch_id': self.branch_id,
            'branch': self.branch.name if self.branch else None,
            'shift_id': self.shift_id,
            'business_date': self.business_date.isoformat() if self.business_date else None,
            'status': self.status,
            'notes': self.notes,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'created_by': self.created_by,
            'reviewed_by': self.reviewed_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if user is None or can_view_shop_financials(user):
            payload.update({
                'gross_sales': float(self.gross_sales or 0),
                'discounts': float(self.discounts or 0),
                'taxes': float(self.taxes or 0),
                'refunds': float(self.refunds or 0),
                'net_sales': float(self.net_sales or 0),
                'expected_cash': float(self.expected_cash or 0),
                'counted_cash': float(self.counted_cash or 0),
                'cash_difference': float(self.cash_difference or 0),
                'payment_breakdown': self.payment_breakdown or {},
            })
        return payload
