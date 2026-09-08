from datetime import date, datetime, timezone
from ..extensions import db
from .user import TimestampMixin, utcnow


class PerformanceMetric(TimestampMixin, db.Model):
    __tablename__ = 'performance_metrics'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(64), unique=True, nullable=False)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.String(255))
    default_weight = db.Column(db.Numeric(5, 2), nullable=False)  # percentage 0-100
    weight = db.Column(db.Numeric(5, 2))  # configured override
    minimum_score = db.Column(db.Numeric(5, 2), default=0)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    def current_weight(self):
        return float(self.weight if self.weight is not None else self.default_weight)

    def to_dict(self):
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'description': self.description,
            'default_weight': float(self.default_weight),
            'weight': float(self.weight) if self.weight is not None else None,
            'current_weight': self.current_weight(),
            'is_active': self.is_active,
        }


class PerformanceScore(TimestampMixin, db.Model):
    __tablename__ = 'performance_scores'

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False, index=True)
    instructor_id = db.Column(db.Integer, db.ForeignKey('instructors.id'))
    period_start = db.Column(db.Date, nullable=False)
    period_end = db.Column(db.Date, nullable=False)

    scores = db.relationship('PerformanceScoreComponent', backref='performance_score', cascade='all, delete-orphan')

    overall_score = db.Column(db.Numeric(5, 2), default=0)
    rating = db.Column(db.String(16), default='pending')  # poor | fair | good | excellent

    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'employee_name': self.employee.full_name if self.employee else None,
            'instructor_id': self.instructor_id,
            'period_start': self.period_start.isoformat(),
            'period_end': self.period_end.isoformat(),
            'components': [c.to_dict() for c in self.scores],
            'overall_score': float(self.overall_score or 0),
            'rating': self.rating,
        }


class PerformanceScoreComponent(db.Model):
    __tablename__ = 'performance_score_components'

    id = db.Column(db.Integer, primary_key=True)
    performance_score_id = db.Column(db.Integer, db.ForeignKey('performance_scores.id'), nullable=False)
    metric_id = db.Column(db.Integer, db.ForeignKey('performance_metrics.id'), nullable=False)
    score = db.Column(db.Numeric(5, 2), nullable=False)  # 0-100
    weight = db.Column(db.Numeric(5, 2), nullable=False)
    weighted_score = db.Column(db.Numeric(5, 2), nullable=False)
    explanation = db.Column(db.String(500))

    metric = db.relationship('PerformanceMetric')

    def to_dict(self):
        return {
            'id': self.id,
            'metric_id': self.metric_id,
            'code': self.metric.code if self.metric else None,
            'name': self.metric.name if self.metric else None,
            'score': float(self.score or 0),
            'weight': float(self.weight or 0),
            'weighted_score': float(self.weighted_score or 0),
            'explanation': self.explanation,
        }


class Notification(TimestampMixin, db.Model):
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(64), nullable=False, index=True)
    severity = db.Column(db.String(16), default='info', nullable=False)  # info | warning | critical
    message = db.Column(db.String(500), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    related_type = db.Column(db.String(64))
    related_id = db.Column(db.Integer)
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    read_at = db.Column(db.DateTime(timezone=True))
    created_by_rule = db.Column(db.String(64))

    recipient = db.relationship('User', backref='notifications')

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'severity': self.severity,
            'message': self.message,
            'recipient_id': self.recipient_id,
            'related_type': self.related_type,
            'related_id': self.related_id,
            'is_read': self.is_read,
            'read_at': self.read_at.isoformat() if self.read_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class AuditLog(db.Model):
    __tablename__ = 'audit_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    user_email = db.Column(db.String(255))
    action = db.Column(db.String(64), nullable=False, index=True)
    entity = db.Column(db.String(64), nullable=False, index=True)
    entity_id = db.Column(db.String(64))
    previous_value = db.Column(db.Text)
    new_value = db.Column(db.Text)
    ip_address = db.Column(db.String(64))
    user_agent = db.Column(db.String(255))
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

    user = db.relationship('User', backref='audit_logs')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_email': self.user_email,
            'action': self.action,
            'entity': self.entity,
            'entity_id': self.entity_id,
            'previous_value': self.previous_value,
            'new_value': self.new_value,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Setting(TimestampMixin, db.Model):
    __tablename__ = 'settings'

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(128), unique=True, nullable=False)
    value = db.Column(db.Text)
    value_type = db.Column(db.String(16), default='string')  # string | int | float | boolean | json
    group = db.Column(db.String(64), default='general')

    def to_dict(self):
        return {
            'id': self.id,
            'key': self.key,
            'value': self.value,
            'value_type': self.value_type,
            'group': self.group,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class LMSIntegration(TimestampMixin, db.Model):
    __tablename__ = 'lms_integrations'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    base_url = db.Column(db.String(255), nullable=False)
    api_key_encrypted = db.Column(db.String(255))
    status = db.Column(db.String(16), default='disabled')  # enabled | disabled | error
    last_sync_at = db.Column(db.DateTime(timezone=True))
    last_sync_status = db.Column(db.String(32))
    config = db.Column(db.Text)  # JSON extra config

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'base_url': self.base_url,
            'status': self.status,
            'last_sync_at': self.last_sync_at.isoformat() if self.last_sync_at else None,
            'last_sync_status': self.last_sync_status,
        }