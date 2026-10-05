"""AfriTech Bridge Electronics Shop — inventory models.

``ShopStockMovement`` is the immutable source of truth for every unit that
enters or leaves a branch. ``ShopInventoryBalance`` is only a cached running
total, updated in the same transaction as the movement it summarises, and it is
guarded by a conditional UPDATE so concurrent sales cannot oversell.

Quantity semantics (identical everywhere):

* ``quantity``          sellable units physically on the shelf.
* ``reserved_quantity`` units held for an in-flight sale; a subset of
  ``quantity`` and never more than it. Reserved units raise no ledger row.
* ``damaged_quantity``  physically present but not sellable, so it is *not*
  part of ``quantity``; a damage movement moves units from ``quantity`` to
  ``damaged_quantity``.
* ``available_quantity`` = ``quantity - reserved_quantity``.
"""
from datetime import datetime, timezone

from ..extensions import db


def _utc_now():
    return datetime.now(timezone.utc)
from .shop import (
    SHOP_TRANSFER_STATUSES, SHOP_COUNT_STATUSES, SHOP_ADJUSTMENT_STATUSES,
    SHOP_SERIAL_STATUSES, SHOP_CONDITIONS, SHOP_ALERT_TYPES,
)
from .user import TimestampMixin


class ShopInventoryBalance(TimestampMixin, db.Model):
    """Cached per product/variant/branch stock total."""
    __tablename__ = 'shop_inventory_balances'
    __table_args__ = (
        db.UniqueConstraint('product_id', 'variant_id', 'branch_id',
                            name='uq_shop_balance_product_variant_branch'),
    )

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'),
                           nullable=False, index=True)
    variant_id = db.Column(db.Integer, db.ForeignKey('shop_product_variants.id'), index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False, index=True)

    quantity = db.Column(db.Integer, nullable=False, default=0)
    reserved_quantity = db.Column(db.Integer, nullable=False, default=0)
    damaged_quantity = db.Column(db.Integer, nullable=False, default=0)

    average_cost = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    last_cost = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    last_movement_at = db.Column(db.DateTime(timezone=True))

    product = db.relationship('ShopProduct', backref=db.backref('balances', cascade='all, delete-orphan'))
    variant = db.relationship('ShopProductVariant', backref='balances')
    branch = db.relationship('Branch')

    @property
    def available_quantity(self):
        return max(int(self.quantity) - int(self.reserved_quantity), 0)

    @property
    def physical_quantity(self):
        return int(self.quantity) + int(self.damaged_quantity)

    @property
    def is_in_stock(self):
        return self.available_quantity > 0

    @property
    def stock_value(self):
        return float(self.average_cost or 0) * int(self.quantity)

    def to_dict(self, user=None):
        from ..auth.shop_scope import can_view_shop_costs
        payload = {
            'id': self.id,
            'product_id': self.product_id,
            'product': self.product.name if self.product else None,
            'sku': (self.variant.sku if self.variant
                    else self.product.sku if self.product else None),
            'variant_id': self.variant_id,
            'variant': self.variant.name if self.variant else None,
            'branch_id': self.branch_id,
            'branch': self.branch.name if self.branch else None,
            'branch_code': self.branch.code if self.branch else None,
            'quantity': int(self.quantity),
            'reserved_quantity': int(self.reserved_quantity),
            'damaged_quantity': int(self.damaged_quantity),
            'available_quantity': self.available_quantity,
            'physical_quantity': self.physical_quantity,
            'is_in_stock': self.is_in_stock,
            'unit': self.product.unit if self.product else 'pcs',
            'min_stock_level': (self.variant.product.min_stock_level if self.variant
                                else self.product.min_stock_level if self.product else 0),
            'reorder_level': (self.variant.product.reorder_level if self.variant
                              else self.product.reorder_level if self.product else 0),
            'last_movement_at': (self.last_movement_at.isoformat()
                                 if self.last_movement_at else None),
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if user is None or can_view_shop_costs(user):
            payload['average_cost'] = float(self.average_cost or 0)
            payload['last_cost'] = float(self.last_cost or 0)
            payload['stock_value'] = round(self.stock_value, 2)
        return payload


class ShopInventoryLayer(db.Model):
    """FIFO receipt layer, consumed by the FIFO costing method."""
    __tablename__ = 'shop_inventory_layers'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'), nullable=False, index=True)
    variant_id = db.Column(db.Integer, db.ForeignKey('shop_product_variants.id'), index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False, index=True)
    goods_receipt_item_id = db.Column(db.Integer, db.ForeignKey('shop_goods_receipt_items.id'))

    quantity_received = db.Column(db.Integer, nullable=False, default=0)
    quantity_remaining = db.Column(db.Integer, nullable=False, default=0)
    unit_cost = db.Column(db.Numeric(16, 4), nullable=False, default=0)
    received_at = db.Column(db.DateTime(timezone=True), nullable=False, index=True)

    product = db.relationship('ShopProduct')
    variant = db.relationship('ShopProductVariant')
    branch = db.relationship('Branch')

    @property
    def is_depleted(self):
        return int(self.quantity_remaining) <= 0

    def to_dict(self, user=None):
        from ..auth.shop_scope import can_view_shop_costs
        payload = {
            'id': self.id, 'product_id': self.product_id, 'variant_id': self.variant_id,
            'branch_id': self.branch_id, 'branch': self.branch.name if self.branch else None,
            'quantity_received': int(self.quantity_received),
            'quantity_remaining': int(self.quantity_remaining),
            'received_at': self.received_at.isoformat() if self.received_at else None,
        }
        if user is None or can_view_shop_costs(user):
            payload['unit_cost'] = float(self.unit_cost or 0)
        return payload


class ShopStockMovement(db.Model):
    """Immutable inventory ledger entry. Rows are never updated or deleted."""
    __tablename__ = 'shop_stock_movements'

    id = db.Column(db.Integer, primary_key=True)
    reference_type = db.Column(db.String(32), nullable=False, index=True)
    reference_id = db.Column(db.Integer, index=True)
    movement_type = db.Column(db.String(32), nullable=False, index=True)

    product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'), nullable=False, index=True)
    variant_id = db.Column(db.Integer, db.ForeignKey('shop_product_variants.id'), index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False, index=True)

    quantity = db.Column(db.Integer, nullable=False)
    unit_cost = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    total_cost = db.Column(db.Numeric(16, 4), default=0, nullable=False)

    balance_after = db.Column(db.Integer, nullable=False, default=0)
    note = db.Column(db.String(500))
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False,
                           index=True, default=_utc_now)

    product = db.relationship('ShopProduct')
    variant = db.relationship('ShopProductVariant')
    branch = db.relationship('Branch')
    creator = db.relationship('User', foreign_keys=[created_by])

    def to_dict(self, user=None):
        from ..auth.shop_scope import can_view_shop_costs
        payload = {
            'id': self.id,
            'reference_type': self.reference_type,
            'reference_id': self.reference_id,
            'movement_type': self.movement_type,
            'product_id': self.product_id,
            'product': self.product.name if self.product else None,
            'sku': (self.variant.sku if self.variant
                    else self.product.sku if self.product else None),
            'variant_id': self.variant_id,
            'variant': self.variant.name if self.variant else None,
            'branch_id': self.branch_id,
            'branch': self.branch.name if self.branch else None,
            'quantity': int(self.quantity),
            'balance_after': int(self.balance_after),
            'note': self.note,
            'created_by': self.created_by,
            'created_by_name': (self.creator.employee.full_name
                                if self.creator and self.creator.employee
                                else self.creator.email if self.creator else None),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if user is None or can_view_shop_costs(user):
            payload['unit_cost'] = float(self.unit_cost or 0)
            payload['total_cost'] = float(self.total_cost or 0)
        return payload


class ShopSerializedItem(db.Model):
    """One tracked unit of a serialized product (IMEI / serial / tag)."""
    __tablename__ = 'shop_serialized_items'
    __table_args__ = (
        db.UniqueConstraint('serial_number', 'product_id', 'variant_id',
                            name='uq_shop_serial_number_identity'),
    )

    id = db.Column(db.Integer, primary_key=True)
    serial_number = db.Column(db.String(96), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'), nullable=False, index=True)
    variant_id = db.Column(db.Integer, db.ForeignKey('shop_product_variants.id'))
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False, index=True)

    status = db.Column(db.String(32), default='in_stock', nullable=False, index=True)
    condition = db.Column(db.String(32), default='good', nullable=False)

    purchase_cost = db.Column(db.Numeric(16, 4), default=0, nullable=False)
    selling_price = db.Column(db.Numeric(16, 4), default=0, nullable=False)

    supplier_id = db.Column(db.Integer, db.ForeignKey('shop_suppliers.id'))
    purchase_order_id = db.Column(db.Integer, db.ForeignKey('shop_purchase_orders.id'))
    goods_receipt_id = db.Column(db.Integer, db.ForeignKey('shop_goods_receipts.id'))
    sale_item_id = db.Column(db.Integer, db.ForeignKey('shop_sale_items.id'))
    received_at = db.Column(db.DateTime(timezone=True))
    sold_at = db.Column(db.DateTime(timezone=True))
    note = db.Column(db.String(500))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False,
                           index=True, default=_utc_now)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False,
                           onupdate=db.func.now(), default=_utc_now)

    product = db.relationship('ShopProduct')
    variant = db.relationship('ShopProductVariant')
    branch = db.relationship('Branch')
    supplier = db.relationship('ShopSupplier')

    def to_dict(self, user=None):
        from ..auth.shop_scope import can_view_shop_costs
        payload = {
            'id': self.id, 'serial_number': self.serial_number,
            'product_id': self.product_id,
            'product': self.product.name if self.product else None,
            'sku': (self.variant.sku if self.variant
                    else self.product.sku if self.product else None),
            'variant_id': self.variant_id,
            'variant': self.variant.name if self.variant else None,
            'branch_id': self.branch_id,
            'branch': self.branch.name if self.branch else None,
            'status': self.status, 'condition': self.condition,
            'supplier_id': self.supplier_id,
            'purchase_order_id': self.purchase_order_id,
            'goods_receipt_id': self.goods_receipt_id,
            'sale_item_id': self.sale_item_id,
            'received_at': self.received_at.isoformat() if self.received_at else None,
            'sold_at': self.sold_at.isoformat() if self.sold_at else None,
            'note': self.note,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if user is None or can_view_shop_costs(user):
            payload['purchase_cost'] = float(self.purchase_cost or 0)
            payload['selling_price'] = float(self.selling_price or 0)
        return payload


class ShopStockTransfer(TimestampMixin, db.Model):
    """Branch-to-branch movement of stock."""
    __tablename__ = 'shop_stock_transfers'

    id = db.Column(db.Integer, primary_key=True)
    transfer_number = db.Column(db.String(32), unique=True, nullable=False, index=True)
    from_branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False)
    to_branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False)
    status = db.Column(db.String(32), default='requested', nullable=False, index=True)

    reason = db.Column(db.String(255))
    notes = db.Column(db.String(500))
    expected_at = db.Column(db.DateTime(timezone=True))
    dispatched_at = db.Column(db.DateTime(timezone=True))
    received_at = db.Column(db.DateTime(timezone=True))

    requested_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    dispatched_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    received_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    from_branch = db.relationship('Branch', foreign_keys=[from_branch_id], backref='transfers_out')
    to_branch = db.relationship('Branch', foreign_keys=[to_branch_id], backref='transfers_in')
    items = db.relationship('ShopStockTransferItem', backref='transfer',
                            cascade='all, delete-orphan', order_by='ShopStockTransferItem.id')
    requester = db.relationship('User', foreign_keys=[requested_by])
    approver = db.relationship('User', foreign_keys=[approved_by])

    @property
    def item_count(self):
        return sum(int(i.quantity_requested) for i in self.items)

    def to_dict(self, user=None, include_items=False):
        payload = {
            'id': self.id, 'transfer_number': self.transfer_number,
            'from_branch_id': self.from_branch_id,
            'from_branch': self.from_branch.name if self.from_branch else None,
            'to_branch_id': self.to_branch_id,
            'to_branch': self.to_branch.name if self.to_branch else None,
            'status': self.status, 'reason': self.reason, 'notes': self.notes,
            'expected_at': self.expected_at.isoformat() if self.expected_at else None,
            'dispatched_at': self.dispatched_at.isoformat() if self.dispatched_at else None,
            'received_at': self.received_at.isoformat() if self.received_at else None,
            'requested_by': self.requested_by,
            'requested_by_name': (self.requester.employee.full_name
                                  if self.requester and self.requester.employee
                                  else self.requester.email if self.requester else None),
            'item_count': self.item_count,
            'items_total': len(self.items),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_items:
            payload['items'] = [i.to_dict(user=user) for i in self.items]
        return payload


class ShopStockTransferItem(db.Model):
    __tablename__ = 'shop_stock_transfer_items'

    id = db.Column(db.Integer, primary_key=True)
    transfer_id = db.Column(db.Integer, db.ForeignKey('shop_stock_transfers.id'),
                            nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('shop_product_variants.id'))
    quantity_requested = db.Column(db.Integer, nullable=False, default=0)
    quantity_dispatched = db.Column(db.Integer, nullable=False, default=0)
    quantity_received = db.Column(db.Integer, nullable=False, default=0)
    note = db.Column(db.String(255))

    product = db.relationship('ShopProduct')
    variant = db.relationship('ShopProductVariant')

    @property
    def shortfall(self):
        return int(self.quantity_dispatched) - int(self.quantity_received)

    def to_dict(self, user=None):
        from ..auth.shop_scope import can_view_shop_costs
        payload = {
            'id': self.id, 'transfer_id': self.transfer_id,
            'product_id': self.product_id,
            'product': self.product.name if self.product else None,
            'sku': (self.variant.sku if self.variant
                    else self.product.sku if self.product else None),
            'variant_id': self.variant_id,
            'variant': self.variant.name if self.variant else None,
            'quantity_requested': int(self.quantity_requested),
            'quantity_dispatched': int(self.quantity_dispatched),
            'quantity_received': int(self.quantity_received),
            'shortfall': self.shortfall,
            'note': self.note,
        }
        if user is None or can_view_shop_costs(user):
            payload['unit_cost'] = float(self.product.purchase_cost or 0) if self.product else 0.0
        return payload


class ShopStockCount(TimestampMixin, db.Model):
    """Physical stock count session (cycle or full count)."""
    __tablename__ = 'shop_stock_counts'

    id = db.Column(db.Integer, primary_key=True)
    count_number = db.Column(db.String(32), unique=True, nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False, index=True)
    status = db.Column(db.String(32), default='draft', nullable=False, index=True)
    count_type = db.Column(db.String(32), default='cycle', nullable=False)

    notes = db.Column(db.String(500))
    counted_at = db.Column(db.DateTime(timezone=True))
    approved_at = db.Column(db.DateTime(timezone=True))

    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    branch = db.relationship('Branch')
    items = db.relationship('ShopStockCountItem', backref='count',
                            cascade='all, delete-orphan', order_by='ShopStockCountItem.id')
    creator = db.relationship('User', foreign_keys=[created_by])
    approver = db.relationship('User', foreign_keys=[approved_by])

    @property
    def totals(self):
        counted = sum(int(i.counted_quantity or 0) for i in self.items)
        expected = sum(int(i.expected_quantity or 0) for i in self.items)
        return {
            'lines': len(self.items),
            'counted': counted,
            'expected': expected,
            'variance': counted - expected,
            'variance_lines': len([i for i in self.items if i.has_variance]),
        }

    def to_dict(self, user=None, include_items=False):
        payload = {
            'id': self.id, 'count_number': self.count_number,
            'branch_id': self.branch_id,
            'branch': self.branch.name if self.branch else None,
            'status': self.status, 'count_type': self.count_type, 'notes': self.notes,
            'counted_at': self.counted_at.isoformat() if self.counted_at else None,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'created_by': self.created_by,
            'created_by_name': (self.creator.employee.full_name
                                if self.creator and self.creator.employee
                                else self.creator.email if self.creator else None),
            'totals': self.totals,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_items:
            payload['items'] = [i.to_dict(user=user) for i in self.items]
        return payload


class ShopStockCountItem(db.Model):
    __tablename__ = 'shop_stock_count_items'

    id = db.Column(db.Integer, primary_key=True)
    count_id = db.Column(db.Integer, db.ForeignKey('shop_stock_counts.id'),
                         nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('shop_product_variants.id'))
    expected_quantity = db.Column(db.Integer, nullable=False, default=0)
    counted_quantity = db.Column(db.Integer)
    system_quantity = db.Column(db.Integer, nullable=False, default=0)
    note = db.Column(db.String(255))

    product = db.relationship('ShopProduct')
    variant = db.relationship('ShopProductVariant')

    @property
    def variance(self):
        if self.counted_quantity is None:
            return None
        return int(self.counted_quantity) - int(self.system_quantity)

    @property
    def has_variance(self):
        variance = self.variance
        return variance is not None and variance != 0

    @property
    def counted_value(self):
        if self.counted_quantity is None or self.product is None:
            return 0.0
        return float(self.product.purchase_cost or 0) * int(self.counted_quantity)

    @property
    def variance_value(self):
        if self.variance is None or self.product is None:
            return 0.0
        return float(self.product.purchase_cost or 0) * int(self.variance)

    def to_dict(self, user=None):
        from ..auth.shop_scope import can_view_shop_costs
        payload = {
            'id': self.id, 'count_id': self.count_id,
            'product_id': self.product_id,
            'product': self.product.name if self.product else None,
            'sku': (self.variant.sku if self.variant
                    else self.product.sku if self.product else None),
            'variant_id': self.variant_id,
            'variant': self.variant.name if self.variant else None,
            'expected_quantity': int(self.expected_quantity),
            'system_quantity': int(self.system_quantity),
            'counted_quantity': (int(self.counted_quantity)
                                 if self.counted_quantity is not None else None),
            'variance': self.variance,
            'has_variance': self.has_variance,
            'note': self.note,
        }
        if user is None or can_view_shop_costs(user):
            payload['counted_value'] = round(self.counted_value, 2)
            payload['variance_value'] = round(self.variance_value, 2)
        return payload


class ShopStockAdjustment(TimestampMixin, db.Model):
    """Manual adjustment (damage / loss / correction) with approval."""
    __tablename__ = 'shop_stock_adjustments'

    id = db.Column(db.Integer, primary_key=True)
    adjustment_number = db.Column(db.String(32), unique=True, nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False, index=True)
    movement_type = db.Column(db.String(32), nullable=False, default='adjustment')
    reason = db.Column(db.String(64), nullable=False)
    notes = db.Column(db.String(500))
    status = db.Column(db.String(32), default='pending', nullable=False, index=True)

    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    reviewed_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    applied_at = db.Column(db.DateTime(timezone=True))

    branch = db.relationship('Branch')
    items = db.relationship('ShopStockAdjustmentItem', backref='adjustment',
                            cascade='all, delete-orphan', order_by='ShopStockAdjustmentItem.id')
    creator = db.relationship('User', foreign_keys=[created_by])
    reviewer = db.relationship('User', foreign_keys=[reviewed_by])

    def to_dict(self, user=None, include_items=False):
        payload = {
            'id': self.id, 'adjustment_number': self.adjustment_number,
            'branch_id': self.branch_id,
            'branch': self.branch.name if self.branch else None,
            'movement_type': self.movement_type, 'reason': self.reason,
            'notes': self.notes, 'status': self.status,
            'created_by': self.created_by,
            'created_by_name': (self.creator.employee.full_name
                                if self.creator and self.creator.employee
                                else self.creator.email if self.creator else None),
            'reviewed_by': self.reviewed_by,
            'applied_at': self.applied_at.isoformat() if self.applied_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_items:
            payload['items'] = [i.to_dict(user=user) for i in self.items]
        return payload


class ShopStockAdjustmentItem(db.Model):
    __tablename__ = 'shop_stock_adjustment_items'

    id = db.Column(db.Integer, primary_key=True)
    adjustment_id = db.Column(db.Integer, db.ForeignKey('shop_stock_adjustments.id'),
                              nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('shop_product_variants.id'))
    quantity = db.Column(db.Integer, nullable=False, default=0)
    note = db.Column(db.String(255))

    product = db.relationship('ShopProduct')
    variant = db.relationship('ShopProductVariant')

    @property
    def unit_cost(self):
        if self.product is None:
            return 0.0
        if self.variant is not None and self.variant.purchase_cost is not None:
            return float(self.variant.purchase_cost)
        return float(self.product.purchase_cost or 0)

    @property
    def value(self):
        return self.unit_cost * int(self.quantity)

    def to_dict(self, user=None):
        from ..auth.shop_scope import can_view_shop_costs
        payload = {
            'id': self.id, 'adjustment_id': self.adjustment_id,
            'product_id': self.product_id,
            'product': self.product.name if self.product else None,
            'sku': (self.variant.sku if self.variant
                    else self.product.sku if self.product else None),
            'variant_id': self.variant_id,
            'variant': self.variant.name if self.variant else None,
            'quantity': int(self.quantity), 'note': self.note,
        }
        if user is None or can_view_shop_costs(user):
            payload['unit_cost'] = round(self.unit_cost, 4)
            payload['value'] = round(self.value, 2)
        return payload


class ShopStockAlert(db.Model):
    """Persisted low-stock / overdue / dead-stock alert, de-duplicated by key."""
    __tablename__ = 'shop_stock_alerts'
    __table_args__ = (
        db.UniqueConstraint('alert_key', name='uq_shop_stock_alert_key'),
    )

    id = db.Column(db.Integer, primary_key=True)
    alert_key = db.Column(db.String(160), nullable=False, index=True)
    alert_type = db.Column(db.String(32), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey('shop_products.id'), index=True)
    variant_id = db.Column(db.Integer, db.ForeignKey('shop_product_variants.id'))
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), index=True)
    message = db.Column(db.String(500), nullable=False)
    quantity = db.Column(db.Integer)
    resolved_at = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False,
                           index=True, default=_utc_now)

    product = db.relationship('ShopProduct')
    variant = db.relationship('ShopProductVariant')
    branch = db.relationship('Branch')

    @property
    def is_open(self):
        return self.resolved_at is None

    def to_dict(self):
        return {
            'id': self.id, 'alert_key': self.alert_key,
            'alert_type': self.alert_type,
            'product_id': self.product_id,
            'product': self.product.name if self.product else None,
            'sku': (self.variant.sku if self.variant
                    else self.product.sku if self.product else None),
            'variant_id': self.variant_id,
            'branch_id': self.branch_id,
            'branch': self.branch.name if self.branch else None,
            'message': self.message,
            'quantity': self.quantity,
            'is_open': self.is_open,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
