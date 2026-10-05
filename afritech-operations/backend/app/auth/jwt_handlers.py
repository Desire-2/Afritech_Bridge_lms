"""JWT error handlers."""

from datetime import datetime, timezone

from flask import jsonify

from ..models import SessionRecord
from ..extensions import db, jwt


def set_jwt_handlers(app):
    # flask-jwt-extended's built-in handlers answer with a ``msg`` key and,
    # for a token used on the wrong endpoint (e.g. an access token posted to
    # ``/api/auth/refresh``), with 422. Both are wrong for this API: every
    # authentication failure is a 401 and every error body is ``{'error': ...}``.
    @jwt.invalid_token_loader
    def invalid_token(reason):
        return jsonify({'error': reason or 'Invalid token'}), 401

    @jwt.unauthorized_loader
    def unauthorized_token(reason):
        return jsonify({'error': reason or 'Authentication required'}), 401

    @jwt.expired_token_loader
    def expired_token(_header, _payload):
        return jsonify({'error': 'Token has expired'}), 401

    @jwt.revoked_token_loader
    def revoked_token(_header, _payload):
        return jsonify({'error': 'Token has been revoked'}), 401

    @jwt.needs_fresh_token_loader
    def needs_fresh_token(_header, _payload):
        return jsonify({'error': 'Fresh token required'}), 401

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
