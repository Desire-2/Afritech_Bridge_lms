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


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET', SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.environ.get('JWT_ACCESS_HOURS', '12')))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.environ.get('JWT_REFRESH_DAYS', '14')))
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
        Config._warn_weak_jwt_secret(app)
        Config._warn_local_frontend_url(app)

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
        if len(key) < 32:
            app.logger.warning(
                'JWT_SECRET is only %d bytes (>= 32 required for HS256). '
                'Set JWT_SECRET in .env — e.g. python -c "import secrets; '
                'print(secrets.token_hex(32))" — and restart.',
                len(key),
            )


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///' + os.path.join(basedir, 'dev.db'))


class TestingConfig(Config):
    TESTING = True
    AUTOMATION_ENABLED = False
    SQLALCHEMY_DATABASE_URI = os.environ.get('TEST_DATABASE_URL', 'sqlite:///' + os.path.join(basedir, 'test.db'))
    RATE_LIMIT_DEFAULT = '1000000 per hour'
    RATE_LIMIT_AUTH = '100000 per minute'


class ProductionConfig(Config):
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'postgresql://localhost/afritech_operations')
    RATE_LIMIT_DEFAULT = os.environ.get('RATE_LIMIT_DEFAULT', '200 per hour;1000 per day')
    # Multi-process production needs a shared rate-limit store (Redis).
    # Set RATELIMIT_STORAGE_URI env var to redis://localhost:6379/0 when Redis is available.
    RATELIMIT_STORAGE_URI = os.environ.get('RATELIMIT_STORAGE_URI', 'memory://')

    @staticmethod
    def init_app(app):
        Config.init_app(app)
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