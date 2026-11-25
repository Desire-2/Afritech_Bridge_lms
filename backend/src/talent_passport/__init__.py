"""Talent Passport feature module inside the AfriTech Bridge LMS."""

from .routes import talent_passport_bp

__all__ = ["talent_passport_bp"]


def init_app(app):
    """Register the feature blueprint on an existing Flask application."""
    app.register_blueprint(talent_passport_bp)
