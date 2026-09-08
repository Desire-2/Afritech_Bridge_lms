from ..extensions import db
from .user import TimestampMixin


class ServiceCategory(TimestampMixin, db.Model):
    __tablename__ = 'service_categories'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    code = db.Column(db.String(64), unique=True, nullable=False)
    description = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    services = db.relationship('Service', backref='category')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'description': self.description,
            'is_active': self.is_active,
        }


class Service(TimestampMixin, db.Model):
    __tablename__ = 'services'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    code = db.Column(db.String(64), unique=True, nullable=False, index=True)
    description = db.Column(db.String(500))
    official_cost = db.Column(db.Numeric(16, 2), nullable=False, default=0)  # Irembo/government cost paid upfront
    customer_price = db.Column(db.Numeric(16, 2), nullable=False, default=0)
    commission_rate = db.Column(db.Numeric(5, 4))  # service-specific commission override (fraction: 0.20)
    category_id = db.Column(db.Integer, db.ForeignKey('service_categories.id'))
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    transactions = db.relationship('ServiceTransaction', backref='service')

    def commission_rate_for(self):
        return float(self.commission_rate) if self.commission_rate is not None else None

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'description': self.description,
            'official_cost': float(self.official_cost),
            'customer_price': float(self.customer_price),
            'commission_rate': self.commission_rate_for(),
            'category_id': self.category_id,
            'category': self.category.name if self.category else None,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class Client(TimestampMixin, db.Model):
    __tablename__ = 'clients'

    id = db.Column(db.Integer, primary_key=True)
    client_number = db.Column(db.String(32), unique=True, nullable=False, index=True)
    first_name = db.Column(db.String(128), nullable=False)
    last_name = db.Column(db.String(128), nullable=False)
    phone = db.Column(db.String(32), index=True)
    reference_info = db.Column(db.String(500))
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    transactions = db.relationship('ServiceTransaction', backref='client')

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name}'.strip()

    def to_dict(self):
        return {
            'id': self.id,
            'client_number': self.client_number,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'full_name': self.full_name,
            'phone': self.phone,
            'reference_info': self.reference_info,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }