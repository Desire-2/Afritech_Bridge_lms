"""JWT error handlers."""

from datetime import datetime, timezone

from flask import jsonify

from ..models import SessionRecord
from ..extensions import db


def set_jwt_handlers(app):
    @app.errorhandler(401)
    def unauthorized(e):
        return jsonify({'error': 'Authentication required'}), 401

    @app.errorhandler(403)
    def forbidden(e):
        return jsonify({'error': 'You do not have permission to perform this action'}), 403

    @app.errorhandler(422)
    def unprocessable(e):
        return jsonify({'error': 'Invalid request data', 'messages': getattr(e, 'messages', None)}), 422


def revoke_session(jti):
    if not jti:
        return None
    row = SessionRecord.query.filter_by(jti=jti).first()
    if row and not row.revoked_at:
        row.revoked_at = datetime.now(timezone.utc)
        db.session.commit()
    return row