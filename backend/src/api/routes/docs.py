"""Interactive API documentation.

* ``GET /api/v2/openapi.json`` — the OpenAPI 3.1 document.
* ``GET /api/v2/docs``         — Swagger UI (CDN assets, no build step).
* ``GET /api/v2/redoc``        — ReDoc (CDN assets).

Aliases registered by :func:`register_docs_aliases` on the application:

* ``GET /api/openapi.json``, ``GET /api/docs``, ``GET /api/redoc``.
"""

from __future__ import annotations

from flask import Blueprint, Response, jsonify

from .. import api_bp
from ..openapi_spec import build_spec

_SWAGGER_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>AfriTech Bridge LMS — Integration API (v2)</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>body{margin:0;padding:0;background:#fafafa}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: "openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        tryItOutEnabled: true,
        persistAuthorization: true,
        displayRequestDuration: true,
      });
    };
  </script>
</body>
</html>
"""

_REDOC_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>AfriTech Bridge LMS — Integration API (v2)</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</head>
<body>
  <redoc spec-url="openapi.json"></redoc>
</body>
</html>
"""


def _html_page(html: str) -> Response:
    return Response(html, mimetype="text/html")


def _serve_spec():
    return jsonify(build_spec())


@api_bp.route("/openapi.json", methods=["GET"])
def openapi_json():
    """OpenAPI 3.1 contract for the integration API (public)."""
    return _serve_spec()


@api_bp.route("/docs", methods=["GET"])
def swagger_ui():
    """Swagger UI for the integration API (public)."""
    return _html_page(_SWAGGER_HTML)


@api_bp.route("/redoc", methods=["GET"])
def redoc():
    """ReDoc reference documentation (public)."""
    return _html_page(_REDOC_HTML)


def register_docs_aliases(flask_app) -> None:
    """Mount the docs under stable ``/api/...`` paths on the application.

    Registered from ``main.py`` so the legacy ``/api/v1`` routes are untouched
    while ``/api/docs`` works for operators regardless of the API version.
    """
    if flask_app is None:
        raise ValueError("flask_app is required")

    alias_bp = Blueprint("api_docs_alias", __name__)

    @alias_bp.route("/api/openapi.json", methods=["GET"])
    def alias_openapi_json():
        return _serve_spec()

    @alias_bp.route("/api/docs", methods=["GET"])
    def alias_swagger_ui():
        return _html_page(_SWAGGER_HTML)

    @alias_bp.route("/api/redoc", methods=["GET"])
    def alias_redoc():
        return _html_page(_REDOC_HTML)

    flask_app.register_blueprint(alias_bp)
