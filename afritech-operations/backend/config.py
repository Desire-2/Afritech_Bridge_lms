import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv


def _env_file() -> Path:
    """Resolve the project `.env` (…/afritech-operations/.env).

    OS-level environment variables (Docker, Heroku, CI) always win:
    `load_dotenv` only fills in values that are not already set.
    """
    here = Path(__file__).resolve().parent  # backend/
    root = here.parent                      # project root
    for candidate in (root / '.env', Path.cwd() / '.env'):
        if candidate.is_file():
            return candidate
    return root / '.env'


load_dotenv(_env_file())

# Project root (…/afritech-operations) — used for uploads and SQLite defaults.
basedir = Path(__file__).resolve().parent.parent

# The literal fallback below. Anything still on it in production would hand
# session/JWT forgery to whoever reads the source, so ProductionConfig refuses
# to start (see `ProductionConfig._require_real_secret`).
DEV_SECRET_KEY = 'dev-secret-key-change-in-production'
DEV_JWT_SECRET = 'change-me-too'

# Placeholder keys shipped in .env.example / docker-compose. They are long
# enough to satisfy the HS256 length rule but are public knowledge, so they
# only earn a warning — never a silent pass.
PLACEHOLDER_SECRETS = frozenset({
    DEV_SECRET_KEY,
    DEV_JWT_SECRET,
    'change-me-in-production',
    'change-me-in-production-please-use-a-long-random-key',
    'change-me-in-production-use-a-long-random-key',
    'change-me-too-please-generate-a-long-random-key-here',
    'change-me-too-use-a-long-random-key-here',
})


def normalize_database_url(url):
    """Accept the `postgres://` scheme Heroku/Render/Railway still emit.

    SQLAlchemy ≥ 1.4 dropped it (2.0 raises outright), so a `DATABASE_URL`
    copied from a platform dashboard would otherwise crash the production
    process before it serves a single request.
    """
    if url and url.startswith('postgres://'):
        return 'postgresql://' + url[len('postgres://'):]
    return url


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', DEV_SECRET_KEY)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET', SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.environ.get('JWT_ACCESS_HOURS', '12')))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.environ.get('JWT_REFRESH_DAYS', '14')))
    # Small tolerance for clock skew between the minting and the validating
    # process (and hosts whose clock steps backwards): a token issued a
    # moment ago must not fail `iat`/`nbf` validation.
    JWT_DECODE_LEEWAY = timedelta(seconds=int(os.environ.get('JWT_LEEWAY_SECONDS', '5')))
    # The API is stateless (Bearer JWTs), but any cookie Flask does set must
    # not travel in clear or ride along cross-site.
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    REMEMBER_COOKIE_HTTPONLY = True
    UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', str(16 * 1024 * 1024)))
    RATE_LIMIT_DEFAULT = os.environ.get('RATE_LIMIT_DEFAULT', '200 per hour;1000 per day')
    RATE_LIMIT_AUTH = os.environ.get('RATE_LIMIT_AUTH', '10 per minute')
    # Rate-limit storage backend URI. `memory://` is single-process only;
    # production should use Redis (see ProductionConfig / docker-compose).
    RATELIMIT_STORAGE_URI = os.environ.get('RATELIMIT_STORAGE_URI', 'memory://')
    BUSINESS_NAME = os.environ.get('BUSINESS_NAME', 'AfriTech Bridge Operations')
    CURRENCY = os.environ.get('CURRENCY', 'RWF')
    TIMEZONE = os.environ.get('TIMEZONE', 'Africa/Kigali')
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*')
    DEFAULT_COMMISSION_RATE = float(os.environ.get('DEFAULT_COMMISSION_RATE', '0.20'))
    PASSWORD_RESET_TOKEN_MINUTES = int(os.environ.get('PASSWORD_RESET_TOKEN_MINUTES', '30'))

    # LMS integration
    LMS_API_URL = os.environ.get('LMS_API_URL', '')
    LMS_API_KEY = os.environ.get('LMS_API_KEY', '')
    LMS_API_TIMEOUT = int(os.environ.get('LMS_API_TIMEOUT', '10'))

    # Frontend URL used to build links inside notification emails.
    # The ops frontend runs on 3001 (3000 is the LMS), and on a deployed
    # instance this must be the public URL — otherwise every email links to
    # localhost and recipients land on their own machine.
    FRONTEND_URL = (os.environ.get('FRONTEND_URL') or 'http://localhost:3001').rstrip('/')

    # Scheduled alerts (`services/automation.py`). The scheduler thread runs
    # every AUTOMATION_INTERVAL_MINUTES; 0 (or AUTOMATION_ENABLED=false)
    # disables it, and it never starts under TESTING.
    AUTOMATION_ENABLED = os.environ.get('AUTOMATION_ENABLED', 'true').lower() in ('1', 'true', 'yes', 'on')
    AUTOMATION_INTERVAL_MINUTES = int(os.environ.get('AUTOMATION_INTERVAL_MINUTES', '15'))

    # Email notifications — Brevo transactional API (same contract as the LMS).
    # BREVO_API_KEY + BREVO_SENDER_EMAIL select the API transport; when they are
    # absent delivery falls back to the MAIL_* SMTP settings below, and when
    # neither is set email delivery is disabled (notifications are in-app only).
    BREVO_API_KEY = os.environ.get('BREVO_API_KEY', '')
    BREVO_SENDER_EMAIL = os.environ.get('BREVO_SENDER_EMAIL', '')
    BREVO_SENDER_NAME = os.environ.get('BREVO_SENDER_NAME', '')

    # Email notifications (SMTP fallback).
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', '587'))
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'True').lower() in ('true', 'yes', '1')
    MAIL_USE_SSL = os.environ.get('MAIL_USE_SSL', 'False').lower() in ('true', 'yes', '1')
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', 'noreply@afritecbridge.online')
    MAIL_SENDER_NAME = os.environ.get('MAIL_SENDER_NAME', 'AfriTech Bridge')

    @staticmethod
    def init_app(app):
        os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
        Config._warn_weak_secret_key(app)
        Config._warn_weak_jwt_secret(app)
        Config._warn_local_frontend_url(app)

    @staticmethod
    def _warn_weak_secret_key(app):
        """Say out loud when the signing key is short or publicly known.

        HS256 and itsdangerous both want >= 32 bytes of key material; a short
        or placeholder key makes token forgery a matter of reading the repo.
        """
        if app.config.get('TESTING'):
            return
        key = app.config.get('SECRET_KEY') or ''
        if len(key) >= 32 and key not in PLACEHOLDER_SECRETS:
            return
        reason = ('is a published placeholder' if key in PLACEHOLDER_SECRETS
                  else f'is only {len(key)} bytes (>= 32 required)')
        app.logger.warning(
            'SECRET_KEY %s. Set SECRET_KEY in .env — e.g. python -c '
            '"import secrets; print(secrets.token_hex(32))" — and restart.',
            reason,
        )

    @staticmethod
    def _warn_local_frontend_url(app):
        """Email links are built from FRONTEND_URL; localhost is only a dev value."""
        if app.config.get('TESTING'):
            return
        url = app.config.get('FRONTEND_URL') or ''
        if 'localhost' in url or '127.0.0.1' in url:
            app.logger.warning(
                'FRONTEND_URL is %s — notification emails will link to that '
                'host. Set FRONTEND_URL to your public frontend URL in .env '
                'and restart.', url,
            )

    @staticmethod
    def _warn_weak_jwt_secret(app):
        """PyJWT only whispers about a short HMAC key; make it actionable.

        HS256 wants at least 32 bytes of key material — `change-me-too` (the
        historical default) is 13 and logs InsecureKeyLengthWarning on every
        request.
        """
        if app.config.get('TESTING'):
            return
        key = app.config.get('JWT_SECRET_KEY') or ''
        if len(key) >= 32 and key not in PLACEHOLDER_SECRETS:
            return
        if key in PLACEHOLDER_SECRETS:
            reason = 'is a published placeholder'
        else:
            reason = f'is only {len(key)} bytes (>= 32 required for HS256)'
        app.logger.warning(
            'JWT_SECRET %s. Set JWT_SECRET in .env — e.g. python -c "import secrets; '
            'print(secrets.token_hex(32))" — and restart.',
            reason,
        )


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = normalize_database_url(
        os.environ.get('DATABASE_URL', 'sqlite:///' + os.path.join(basedir, 'dev.db')))


class TestingConfig(Config):
    TESTING = True
    AUTOMATION_ENABLED = False
    SQLALCHEMY_DATABASE_URI = normalize_database_url(
        os.environ.get('TEST_DATABASE_URL', 'sqlite:///' + os.path.join(basedir, 'test.db')))
    RATE_LIMIT_DEFAULT = '1000000 per hour'
    RATE_LIMIT_AUTH = '100000 per minute'
    # Credentials come from the developer's `.env`; a test run must never be
    # able to put a real message on the wire or call the live LMS. The email
    # tests monkeypatch these back on where they need a transport.
    BREVO_API_KEY = ''
    BREVO_SENDER_EMAIL = ''
    MAIL_USERNAME = None
    MAIL_PASSWORD = None
    LMS_API_KEY = ''


class ProductionConfig(Config):
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = normalize_database_url(
        os.environ.get('DATABASE_URL', 'postgresql://localhost/afritech_operations'))
    RATE_LIMIT_DEFAULT = os.environ.get('RATE_LIMIT_DEFAULT', '200 per hour;1000 per day')
    # Multi-process production needs a shared rate-limit store (Redis).
    # Set RATELIMIT_STORAGE_URI env var to redis://localhost:6379/0 when Redis is available.
    RATELIMIT_STORAGE_URI = os.environ.get('RATELIMIT_STORAGE_URI', 'memory://')
    # The API authenticates with Bearer JWTs, so no cookie carries a session —
    # but anything Flask does set (remember-me, flashes) must be TLS-only.
    SESSION_COOKIE_SECURE = True
    REMEMBER_COOKIE_SECURE = True
    PREFERRED_URL_SCHEME = 'https'

    @staticmethod
    def _require_real_secret(app):
        """Refuse to boot production on a missing/short/checked-in key.

        Anything else lets a reader of this repository mint valid JWTs for
        every user. Long-but-published placeholders (the .env.example values)
        only warn — see `Config._warn_weak_secret_key`.
        """
        for name in ('SECRET_KEY', 'JWT_SECRET_KEY'):
            key = app.config.get(name) or ''
            if not key or key == DEV_SECRET_KEY or len(key) < 32:
                raise RuntimeError(
                    f'{name} is not usable in production (got '
                    f'{"empty" if not key else f"{len(key)} bytes"}). '
                    'Set SECRET_KEY and JWT_SECRET in .env — e.g. python -c '
                    '"import secrets; print(secrets.token_hex(32))" — and '
                    'restart. Refusing to start with a forgeable signing key.'
                )
            if key in PLACEHOLDER_SECRETS:
                raise RuntimeError(
                    f'{name} is a published placeholder shipped in this '
                    'repository, so anyone can forge valid JWTs with it. '
                    'Generate a real key — python -c "import secrets; '
                    'print(secrets.token_hex(32))" — put it in .env, and '
                    'restart. Refusing to start.'
                )

    @staticmethod
    def _warn_wildcard_cors(app):
        """`*` + credentials is both rejected by browsers and an open door."""
        origins = app.config.get('CORS_ORIGINS') or ''
        if origins.strip() == '*':
            app.logger.warning(
                'CORS_ORIGINS is "*" in production. Set it to the exact '
                'frontend origin(s), e.g. https://your-domain.example.')

    @staticmethod
    def init_app(app):
        ProductionConfig._require_real_secret(app)
        Config.init_app(app)
        ProductionConfig._warn_wildcard_cors(app)
        import logging
        from logging.handlers import RotatingFileHandler
        logger = logging.getLogger('werkzeug')
        file_handler = RotatingFileHandler(os.path.join(basedir, 'operations.log'), maxBytes=2_000_000, backupCount=5)
        file_handler.setLevel(logging.INFO)
        app.logger.addHandler(file_handler)
        app.logger.setLevel(logging.INFO)


config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig,
}