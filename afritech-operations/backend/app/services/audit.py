import json
from flask import request, g
from ..extensions import db
from ..models import AuditLog


def audit(action, entity, entity_id=None, previous_value=None, new_value=None, user=None):
    current = user or getattr(g, 'current_user', None)
    log = AuditLog(
        user_id=current.id if current else None,
        user_email=current.email if current else 'system',
        action=action,
        entity=entity,
        entity_id=str(entity_id) if entity_id is not None else None,
        previous_value=_serialize(previous_value),
        new_value=_serialize(new_value),
        ip_address=request.headers.get('X-Forwarded-For', request.remote_addr or '') if request else None,
        user_agent=request.headers.get('User-Agent', '')[:255] if request else None,
    )
    db.session.add(log)
    return log


def _serialize(value):
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        try:
            return json.dumps(value, default=str)
        except Exception:
            return str(value)
    return str(value)