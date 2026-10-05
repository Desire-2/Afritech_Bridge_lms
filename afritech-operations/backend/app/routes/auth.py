from datetime import datetime, timezone, timedelta
import secrets

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, create_refresh_token, get_jwt_identity, jwt_required

from ..extensions import db, limiter
from ..models import User, Role, PasswordResetToken, SessionRecord
from ..auth.auth import require_auth, current_user, session_id_of
from ..auth.jwt_handlers import revoke_session
from ..services.audit import audit
from ..services.notifications import notify
from ..utils.datetime_utils import as_utc
from .helpers import json_error, parse_json

bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def hash_token(token):
    import hashlib
    return hashlib.sha256(token.encode()).hexdigest()


def record_session(user, session_id):
    """Open a session row for one login.

    ``session_id`` is the value carried in the tokens' ``sid`` claim: the
    access token(s) issued now and the refresh token paired with them all
    resolve to this single row, so revoking it ends the whole login. The row
    outlives any single access token — it is retired when the refresh window
    closes.
    """
    now = datetime.now(timezone.utc)
    expiry = now + max(current_app.config['JWT_ACCESS_TOKEN_EXPIRES'],
                       current_app.config['JWT_REFRESH_TOKEN_EXPIRES'])
    s = SessionRecord(
        user_id=user.id,
        jti=session_id,
        user_agent=request.headers.get('User-Agent', '')[:255],
        ip_address=request.headers.get('X-Forwarded-For', request.remote_addr or ''),
        expires_at=expiry,
    )
    db.session.add(s)


def _revoke_other_sessions(user_id, keep_session_id):
    """Retire every live session except ``keep_session_id``."""
    now = datetime.now(timezone.utc)
    (SessionRecord.query
     .filter(SessionRecord.user_id == user_id,
             SessionRecord.revoked_at.is_(None),
             SessionRecord.jti != keep_session_id)
     .update({'revoked_at': now}, synchronize_session=False))


def revoke_all_sessions(user_id):
    now = datetime.now(timezone.utc)
    (SessionRecord.query
     .filter(SessionRecord.user_id == user_id, SessionRecord.revoked_at.is_(None))
     .update({'revoked_at': now}, synchronize_session=False))


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

    # One session id per login, shared by the access and the refresh token.
    session_id = secrets.token_urlsafe(16)
    access = create_access_token(identity=str(user.id),
                                 additional_claims={'type': 'access', 'sid': session_id})
    refresh = create_refresh_token(identity=str(user.id),
                                   additional_claims={'type': 'refresh', 'sid': session_id})

    record_session(user, session_id)
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
    # The refresh token only works while its session is live: logging out,
    # revoking the session elsewhere or changing the password all retire it.
    session = SessionRecord.query.filter_by(jti=session_id_of(), user_id=user.id).first()
    now = datetime.now(timezone.utc)
    if not session or session.revoked_at or (session.expires_at and as_utc(session.expires_at) < now):
        return json_error('Session expired. Please log in again.', 401)
    new_access = create_access_token(identity=str(user.id),
                                     additional_claims={'type': 'access', 'sid': session.jti})
    db.session.commit()
    return jsonify({'access_token': new_access})


@bp.post('/logout')
@jwt_required()
def logout():
    revoke_session(session_id_of())
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
    if not user:
        return json_error('Authentication required', 401)
    old = data.get('current_password', '')
    new = data.get('new_password', '')
    if not user.check_password(old):
        return json_error('Current password is incorrect', 400)
    if len(new) < 8:
        return json_error('New password must be at least 8 characters', 400)
    user.set_password(new)
    user.must_change_password = False
    # Every session the old password opened is retired; the session that
    # performed the change stays live so this device is not logged out.
    _revoke_other_sessions(user.id, session_id_of())
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
        now = datetime.now(timezone.utc)
        # Only the newest link may work: an older (still unexpired) link must
        # not survive a re-request, otherwise a leaked link stays usable for
        # the whole token lifetime no matter how many times the user retries.
        (PasswordResetToken.query
         .filter(PasswordResetToken.user_id == user.id,
                 PasswordResetToken.used_at.is_(None))
         .update({'used_at': now}, synchronize_session=False))
        token = secrets.token_urlsafe(32)
        row = PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=now + timedelta(minutes=_app.config['PASSWORD_RESET_TOKEN_MINUTES']),
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
    if as_utc(row.expires_at) < datetime.now(timezone.utc):
        return json_error('Token expired. Request a new one.', 400)
    user = User.query.get(row.user_id)
    if not user:
        return json_error('User not found', 400)
    user.set_password(new_password)
    row.used_at = datetime.now(timezone.utc)
    # Any other link still outstanding is burned with it, and a reset means
    # the password was (or may have been) compromised: retire every session
    # the account currently has open.
    (PasswordResetToken.query
     .filter(PasswordResetToken.user_id == user.id,
             PasswordResetToken.used_at.is_(None))
     .update({'used_at': row.used_at}, synchronize_session=False))
    revoke_all_sessions(user.id)
    db.session.commit()
    audit('password_reset', 'user', user.id)
    return jsonify({'message': 'Password has been reset. You can now log in.'})


@bp.get('/sessions')
@jwt_required()
def my_sessions():
    user = current_user()
    # A valid JWT with no matching (live) session — already logged out elsewhere,
    # session expired, or the account was deactivated — must read as 401, not 500.
    if not user:
        return json_error('Authentication required', 401)
    sessions = SessionRecord.query.filter_by(user_id=user.id, revoked_at=None).order_by(SessionRecord.created_at.desc()).all()
    live_session_id = session_id_of()
    return jsonify({'sessions': [
        {
            'id': s.id,
            'created_at': s.created_at.isoformat(),
            'expires_at': s.expires_at.isoformat(),
            'ip_address': s.ip_address,
            'user_agent': s.user_agent,
            'current': s.jti == live_session_id,
        } for s in sessions
    ]})


@bp.post('/sessions/<int:session_id>/revoke')
@jwt_required()
def revoke_session_endpoint(session_id):
    user = current_user()
    if not user:
        return json_error('Authentication required', 401)
    viewable = SessionRecord.query.filter_by(id=session_id, user_id=user.id).first()
    if not viewable:
        return json_error('Session not found', 404)
    if viewable.jti == session_id_of():
        return json_error('Cannot revoke the current session this way; use logout', 400)
    revoke_session(viewable.jti)
    return jsonify({'message': 'Session revoked'})