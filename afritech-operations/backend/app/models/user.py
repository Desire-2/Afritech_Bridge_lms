from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from ..extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class User(TimestampMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_super_admin = db.Column(db.Boolean, default=False, nullable=False)
    must_change_password = db.Column(db.Boolean, default=False, nullable=False)
    last_login_at = db.Column(db.DateTime(timezone=True))
    # Master switch for email notification delivery.
    email_notifications = db.Column(db.Boolean, default=True, nullable=False)

    roles = db.relationship('Role', secondary='user_roles', backref=db.backref('users', lazy='dynamic'))
    employee = db.relationship('Employee', backref='user', uselist=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @property
    def permissions(self):
        perms = set()
        if self.is_super_admin:
            return {'*'}
        for role in self.roles:
            if role.is_active:
                for permission in role.permissions:
                    perms.add(permission.code)
        return perms

    def has_permission(self, perm):
        perms = self.permissions
        return '*' in perms or perm in perms

    @property
    def role_codes(self):
        if self.is_super_admin:
            return ['super_admin']
        return [r.code for r in self.roles if r.is_active]

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'is_active': self.is_active,
            'is_super_admin': self.is_super_admin,
            'must_change_password': self.must_change_password,
            'last_login_at': self.last_login_at.isoformat() if self.last_login_at else None,
            'role_codes': self.role_codes,
            'permissions': sorted(self.permissions),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'employee_id': self.employee.id if self.employee else None,
            'employee_name': self.employee.full_name if self.employee else None,
        }


class Role(TimestampMixin, db.Model):
    __tablename__ = 'roles'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(64), unique=True, nullable=False, index=True)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_system = db.Column(db.Boolean, default=False, nullable=False)

    permissions = db.relationship('Permission', secondary='role_permissions', backref='roles')

    def to_dict(self):
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'description': self.description,
            'is_active': self.is_active,
            'is_system': self.is_system,
            'permissions': sorted([p.code for p in self.permissions]),
        }


user_roles = db.Table(
    'user_roles',
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('role_id', db.Integer, db.ForeignKey('roles.id'), primary_key=True),
)


class Permission(TimestampMixin, db.Model):
    __tablename__ = 'permissions'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(128), unique=True, nullable=False, index=True)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.String(255))

    def to_dict(self):
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'description': self.description,
        }


role_permissions = db.Table(
    'role_permissions',
    db.Column('role_id', db.Integer, db.ForeignKey('roles.id'), primary_key=True),
    db.Column('permission_id', db.Integer, db.ForeignKey('permissions.id'), primary_key=True),
)

class PasswordResetToken(db.Model):
    __tablename__ = 'password_reset_tokens'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token_hash = db.Column(db.String(255), nullable=False, index=True)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    used_at = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

class SessionRecord(db.Model):
    __tablename__ = 'session_records'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    jti = db.Column(db.String(128), unique=True, nullable=False, index=True)
    user_agent = db.Column(db.String(255))
    ip_address = db.Column(db.String(64))
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    revoked_at = db.Column(db.DateTime(timezone=True))
    user = db.relationship('User', backref='sessions')