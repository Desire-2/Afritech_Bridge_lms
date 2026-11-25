"""Backend-owned professional Talent Passport document renderer.

This package is deliberately isolated from HTTP concerns. It receives a
normalized :class:`~talent_passport.document.spec.DocumentSpec` and returns
PDF bytes. All layout, typography, branding, pagination and verification data
are decided here; callers never supply HTML, CSS or coordinates.
"""

from .renderer import render_document
from .spec import DocumentSpec, canonical_spec_hash
from .validation import validate_pdf

__all__ = ["DocumentSpec", "canonical_spec_hash", "render_document", "validate_pdf"]
