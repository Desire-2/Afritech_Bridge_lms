from datetime import datetime, timezone, timedelta
import secrets

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, create_refresh_token, get_jwt, get_jwt_identity, jwt_required, decode_token

from ..extensions import db, limiter
from ..models import User, Role, PasswordResetToken, SessionRecord
from ..auth.auth import require_auth, current_user
from ..auth.jwt_handlers import revoke_session
from ..services.audit import audit
from ..services.notifications import notify
from .helpers import json_error, parse_json

bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def hash_token(token):
    import hashlib
    return hashlib.sha256(token.encode()).hexdigest()


def record_session(user, jti):
    expiry = datetime.now(timezone.utc) + current_app.config['JWT_ACCESS_TOKEN_EXPIRES']
    from ..models import SessionRecord
    s = SessionRecord(
        user_id=user.id,
        jti=jti,
        user_agent=request.headers.get('User-Agent', '')[:255],
        ip_address=request.headers.get('X-Forwarded-For', request.remote_addr or ''),
        expires_at=expiry,
    )
    db.session.add(s)


@bp.post('/login')
@limiter.limit(lambda: current_app.config['RATE_LIMIT_AUTH'])
def login():
    data = parse_json()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    if not email or not password:
        return json_error('Email and password are required')

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return json_error('Invalid email or password', 401)

    if user.is_active is False:
        return json_error('Account is disabled. Contact the administrator.', 403)

    access = create_access_token(identity=str(user.id), additional_claims={'type': 'access'})
    refresh = create_refresh_token(identity=str(user.id), additional_claims={'type': 'refresh'})
    jti = decode_token(access)['jti']

    record_session(user, jti)
    user.last_login_at = datetime.now(timezone.utc)

    audit('login', 'user', user.id, new_value={'email': user.email}, user=user)
    db.session.commit()

    return jsonify({
        'access_token': access,
        'refresh_token': refresh,
        'token_type': 'bearer',
        'user': user.to_dict(),
    })


@bp.post('/refresh')
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user or not user.is_active:
        return json_error('Invalid token', 401)
    new_access = create_access_token(identity=str(user.id), additional_claims={'type': 'access'})
    jti = get_jwt()['jti']
    record_session(user, jti)
    db.session.commit()
    return jsonify({'access_token': new_access})


@bp.post('/logout')
@jwt_required()
def logout():
    jti = get_jwt().get('jti')
    revoke_session(jti)
    audit('logout', 'user', get_jwt_identity())
    return jsonify({'message': 'Logged out'})


@bp.get('/me')
@require_auth
def me():
    user = current_user()
    return jsonify({'user': user.to_dict()})


@bp.post('/change-password')
@jwt_required()
def change_password():
    data = parse_json()
    user = current_user()
    old = data.get('current_password', '')
    new = data.get('new_password', '')
    if not user.check_password(old):
        return json_error('Current password is incorrect', 400)
    if len(new) < 8:
        return json_error('New password must be at least 8 characters', 400)
    user.set_password(new)
    user.must_change_password = False
    db.session.commit()
    audit('change_password', 'user', user.id)
    return jsonify({'message': 'Password changed'})


@bp.post('/request-password-reset')
@limiter.limit(lambda: current_app.config['RATE_LIMIT_AUTH'])
def request_password_reset():
    data = parse_json()
    email = (data.get('email') or '').strip().lower()
    user = User.query.filter_by(email=email).first()
    if user:
        from flask import current_app as _app
        token = secrets.token_urlsafe(32)
        row = PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=_app.config['PASSWORD_RESET_TOKEN_MINUTES']),
        )
        db.session.add(row)
        db.session.commit()
        # In production this would be emailed. Development: return a debug token when configured.
        return jsonify({'message': 'If that email exists, a reset link has been sent.'})
    return jsonify({'message': 'If that email exists, a reset link has been sent.'})


@bp.post('/reset-password')
@limiter.limit(lambda: current_app.config['RATE_LIMIT_AUTH'])
def reset_password():
    data = parse_json()
    token = data.get('token', '')
    new_password = data.get('new_password', '')
    if len(new_password) < 8:
        return json_error('Password must be at least 8 characters', 400)
    row = PasswordResetToken.query.filter_by(token_hash=hash_token(token)).first()
    if not row or row.used_at:
        return json_error('Invalid or expired reset token', 400)
    if row.expires_at < datetime.now(timezone.utc):
        return json_error('Token expired. Request a new one.', 400)
    user = User.query.get(row.user_id)
    if not user:
        return json_error('User not found', 400)
    user.set_password(new_password)
    row.used_at = datetime.now(timezone.utc)
    db.session.commit()
    audit('password_reset', 'user', user.id)
    return jsonify({'message': 'Password has been reset. You can now log in.'})


@bp.get('/sessions')
@jwt_required()
def my_sessions():
    user = current_user()
    sessions = SessionRecord.query.filter_by(user_id=user.id, revoked_at=None).order_by(SessionRecord.created_at.desc()).all()
    return jsonify({'sessions': [
        {
            'id': s.id,
            'created_at': s.created_at.isoformat(),
            'expires_at': s.expires_at.isoformat(),
            'ip_address': s.ip_address,
            'user_agent': s.user_agent,
            'current': s.jti == get_jwt().get('jti'),
        } for s in sessions
    ]})


@bp.post('/sessions/<int:session_id>/revoke')
@jwt_required()
def revoke_session_endpoint(session_id):
    user = current_user()
    viewable = SessionRecord.query.filter_by(id=session_id, user_id=user.id).first()
    if not viewable:
        return json_error('Session not found', 404)
    if viewable.jti == get_jwt().get('jti'):
        return json_error('Cannot revoke the current session this way; use logout', 400)
    revoke_session(viewable.jti)
    return jsonify({'message': 'Session revoked'})