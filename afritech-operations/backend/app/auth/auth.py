from functools import wraps
from datetime import datetime, timezone

from flask import g, jsonify, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt

from ..models import User, SessionRecord
from ..utils.datetime_utils import as_utc


def session_id_of(jwt_data=None):
    """Session key a token belongs to.

    Tokens minted since the session binding carry an explicit ``sid`` claim so
    that one session row covers every access token issued for that login *and*
    the refresh token paired with it — logging out therefore ends the whole
    login, refresh included. Tokens issued before that change fall back to
    their own ``jti``, which is what the session row was keyed by back then.
    """
    data = jwt_data if jwt_data is not None else get_jwt()
    return data.get('sid') or data.get('jti')


def load_current_user():
    try:
        verified = verify_jwt_in_request()
    except Exception:
        g.current_user = None
        return
    if verified is None:
        # Exempt request (e.g. CORS preflight OPTIONS, which flask-jwt-extended
        # never verifies): treat as anonymous instead of calling get_jwt(),
        # which would raise RuntimeError and 500 the preflight.
        g.current_user = None
        return
    jwt_data = verified[1]
    user_id = jwt_data.get('sub')
    jti = session_id_of(jwt_data)
    if not user_id:
        g.current_user = None
        return
    user = User.query.get(int(user_id))
    if not user or not user.is_active:
        g.current_user = None
        return
    if jti:
        session = SessionRecord.query.filter_by(jti=jti, user_id=user.id).first()
        now = datetime.now(timezone.utc)
        if (not session or session.revoked_at
                or (session.expires_at and as_utc(session.expires_at) < now)):
            g.current_user = None
            return
    g.current_user = user


def is_authenticated():
    load_current_user()
    return getattr(g, 'current_user', None) is not None


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        load_current_user()
        if not getattr(g, 'current_user', None):
            return jsonify({'error': 'Authentication required'}), 401
        return fn(*args, **kwargs)
    return wrapper


def require_permission(permission):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            load_current_user()
            user = getattr(g, 'current_user', None)
            if not user:
                return jsonify({'error': 'Authentication required'}), 401
            if not user.has_permission(permission):
                return jsonify({'error': 'You do not have permission to perform this action'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def require_any_permission(*permissions):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            load_current_user()
            user = getattr(g, 'current_user', None)
            if not user:
                return jsonify({'error': 'Authentication required'}), 401
            if not any(user.has_permission(p) for p in permissions):
                return jsonify({'error': 'You do not have permission to perform this action'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def require_role(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            load_current_user()
            user = getattr(g, 'current_user', None)
            if not user:
                return jsonify({'error': 'Authentication required'}), 401
            if not user.is_super_admin and not set(roles).intersection(user.role_codes):
                return jsonify({'error': 'You do not have permission to perform this action'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def current_user():
    load_current_user()
    return getattr(g, 'current_user', None)


def current_employee():
    user = current_user()
    if user and user.employee:
        return user.employee
    return None