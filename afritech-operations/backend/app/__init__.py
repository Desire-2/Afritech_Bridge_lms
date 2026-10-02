from flask import Flask, g, jsonify
from flask_jwt_extended import get_jwt

from .extensions import db, migrate, jwt, cors, bcrypt, limiter
from .auth.auth import load_current_user


def _rate_limit_storage_uri(app):
    """Return a usable rate-limit storage URI, falling back to memory when the
    configured Redis is unreachable (so a Redis outage never takes down requests).
    """
    uri = app.config.get('RATELIMIT_STORAGE_URI') or 'memory://'
    if uri == 'memory://' or not uri.startswith('redis:'):
        return uri
    try:
        from redis import Redis
        Redis.from_url(uri).ping()
        return uri
    except Exception as exc:  # noqa: BLE001 - degrade gracefully on any failure
        app.logger.info(
            'Rate-limit storage %s unavailable (%s); falling back to in-memory storage',
            uri, exc,
        )
        return 'memory://'


def create_app(config_name='default'):
    from config import config

    app = Flask(__name__)
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)

    # Order matters: CORS must be registered before JWT error handlers
    cors.init_app(app, resources={r'/*': {'origins': app.config.get('CORS_ORIGINS', '*')}},
                  supports_credentials=True)
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    bcrypt.init_app(app)
    app.config['RATELIMIT_STORAGE_URI'] = _rate_limit_storage_uri(app)
    limiter.init_app(app)

    # JWT identity loader for load_user
    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        from .models import User
        user_id = jwt_data.get('sub')
        if not user_id:
            return None
        return User.query.get(int(user_id))

    from .auth.jwt_handlers import set_jwt_handlers
    set_jwt_handlers(app)

    from .auth.cli import register_cli
    register_cli(app)

    from .seeds import register_cli as register_seed_cli
    register_seed_cli(app)

    from .routes import register_routes
    register_routes(app)

    @app.before_request
    def auth_context():
        # Snapshot BEFORE any query runs: a load below (or any autoflush) would
        # flush a caller's pending edits and empty session.dirty, hiding them.
        g.pending_before = (set(db.session.new), set(db.session.dirty),
                            set(db.session.deleted))
        load_current_user()

    @app.after_request
    def persist_side_effects(response):
        """Commit whatever the handler left pending.

        Handlers follow `db.session.commit() → audit() → notify() → return`,
        so the audit entry and the Notification row (the one the bell badge
        counts) are added *after* the only commit — and `notify()`'s preference
        lookup already flushed them, so checking `session.new` afterwards finds
        nothing while the transaction is still uncommitted. Flask-SQLAlchemy's
        teardown then rolls it back silently: tests saw those rows (same
        session), the client never did.
        A successful response therefore commits; a failed one rolls back —
        unless the caller was already mid-transaction, which is left alone.
        """
        pre_new, pre_dirty, pre_deleted = getattr(g, 'pending_before', ((), (), ()))
        if pre_new or pre_dirty or pre_deleted:
            return response
        try:
            if response.status_code < 400:
                db.session.commit()
            else:
                db.session.rollback()
        except Exception:  # noqa: BLE001 - never fail the response over persistence
            db.session.rollback()
            app.logger.exception(
                'Could not persist session changes (status=%s)', response.status_code)
        return response

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Not found'}), 404

    @app.errorhandler(500)
    def server_error(e):
        db.session.rollback()
        return jsonify({'error': 'Internal server error'}), 500

    @app.errorhandler(429)
    def rate_limited(e):
        return jsonify({'error': 'Too many requests. Please try again later.'}), 429

    from .services.scheduler import start_automation_scheduler
    start_automation_scheduler(app)

    return app