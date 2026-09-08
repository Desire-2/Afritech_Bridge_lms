from datetime import date
from ..extensions import db
from .user import TimestampMixin, utcnow


class Branch(TimestampMixin, db.Model):
    __tablename__ = 'branches'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    code = db.Column(db.String(32), unique=True, nullable=False)
    city = db.Column(db.String(128))
    address = db.Column(db.String(255))
    phone = db.Column(db.String(32))
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    employees = db.relationship('Employee', backref='branch')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'city': self.city,
            'address': self.address,
            'phone': self.phone,
            'is_active': self.is_active,
        }


class Department(TimestampMixin, db.Model):
    __tablename__ = 'departments'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    code = db.Column(db.String(32), unique=True, nullable=False)
    description = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    employees = db.relationship('Employee', backref='department')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'description': self.description,
            'is_active': self.is_active,
        }


class Employee(TimestampMixin, db.Model):
    __tablename__ = 'employees'

    id = db.Column(db.Integer, primary_key=True)
    employee_number = db.Column(db.String(32), unique=True, nullable=False, index=True)
    first_name = db.Column(db.String(128), nullable=False)
    last_name = db.Column(db.String(128), nullable=False)
    phone = db.Column(db.String(32), index=True)
    email = db.Column(db.String(255), index=True)
    national_id = db.Column(db.String(64), index=True)
    position = db.Column(db.String(128))
    employment_date = db.Column(db.Date, default=date.today)
    status = db.Column(db.String(32), default='active', nullable=False)  # active | inactive | suspended | terminated
    salary_type = db.Column(db.String(32), default='fixed', nullable=False)  # fixed | commission | hourly | contract
    base_salary = db.Column(db.Numeric(16, 2), default=0)
    hourly_rate = db.Column(db.Numeric(16, 2), default=0)
    default_commission_rate = db.Column(db.Numeric(5, 4))  # employee-specific override; NULL = use rule/service/default
    emergency_contact = db.Column(db.String(255))
    gender = db.Column(db.String(16))

    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    department_id = db.Column(db.Integer, db.ForeignKey('departments.id'))

    instructor = db.relationship('Instructor', backref='employee', uselist=False)
    performance_scores = db.relationship('PerformanceScore', backref='employee')

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name}'.strip()

    def to_dict(self):
        return {
            'id': self.id,
            'employee_number': self.employee_number,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'full_name': self.full_name,
            'phone': self.phone,
            'email': self.email,
            'national_id': self.national_id,
            'position': self.position,
            'employment_date': self.employment_date.isoformat() if self.employment_date else None,
            'status': self.status,
            'salary_type': self.salary_type,
            'base_salary': float(self.base_salary or 0),
            'hourly_rate': float(self.hourly_rate or 0),
            'default_commission_rate': float(self.default_commission_rate) if self.default_commission_rate is not None else None,
            'emergency_contact': self.emergency_contact,
            'gender': self.gender,
            'user_id': self.user_id,
            'branch_id': self.branch_id,
            'department_id': self.department_id,
            'branch': self.branch.name if self.branch else None,
            'department': self.department.name if self.department else None,
            'is_instructor': self.instructor is not None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Qualification(db.Model):
    __tablename__ = 'qualifications'
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    institution = db.Column(db.String(255))
    year = db.Column(db.String(16))
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)