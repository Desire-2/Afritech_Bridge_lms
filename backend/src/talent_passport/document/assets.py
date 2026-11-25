"""Controlled backend assets: official logo, embedded fonts and QR codes.

Only repository-owned assets are accepted. The renderer never fetches a remote
URL and never accepts an image path from a request.
"""

from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import Optional

from reportlab.lib.utils import ImageReader

from . import tokens as t
from .text import register_fonts

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
FONT_DIRECTORY = _BACKEND_ROOT / "assets" / "fonts"
LOGO_PATH = _BACKEND_ROOT / "static" / "images" / "logo.jpg"

_logo_reader: Optional[ImageReader] = None


def prepare_fonts() -> None:
    register_fonts(FONT_DIRECTORY)


def logo_reader() -> ImageReader:
    """Load the official logo bytes. Fail closed if the asset is missing."""
    global _logo_reader
    if _logo_reader is None:
        if not LOGO_PATH.is_file():
            raise FileNotFoundError(f"Official logo asset is missing: {LOGO_PATH}")
        _logo_reader = ImageReader(str(LOGO_PATH))
    return _logo_reader


def logo_size() -> tuple[float, float]:
    width_px, height_px = logo_reader().getSize()
    if not width_px or not height_px:
        raise ValueError("Official logo asset has invalid dimensions")
    return float(width_px), float(height_px)


def draw_logo(canvas, x: float, top: float, max_width: float,
              max_height: float) -> tuple[float, float]:
    """Draw the unmodified logo, fitted without stretching or recoloring."""
    image = logo_reader()
    width_px, height_px = logo_size()
    scale = min(max_width / width_px, max_height / height_px)
    width = width_px * scale
    height = height_px * scale
    # ``top`` is measured from the page top, like every other drawing helper,
    # while canvas.drawImage() expects a bottom-based origin. Convert the
    # image's lower edge (top + height) with PAGE_HEIGHT so the logo sits in
    # its chip instead of being drawn off the bottom of the page.
    canvas.drawImage(
        image,
        x,
        t.PAGE_HEIGHT - (top + height),
        width=width,
        height=height,
        preserveAspectRatio=True,
        mask="auto",
    )
    return width, height


def qr_png(url: str, box_size: int = 10, border: int = 2) -> bytes:
    """Generate a high-error-correction QR PNG from a trusted absolute URL."""
    if not url or not str(url).startswith(("http://", "https://")):
        raise ValueError("A trusted absolute verification URL is required")
    try:
        import qrcode
        from qrcode.constants import ERROR_CORRECT_H
    except ImportError as exc:  # pragma: no cover - pinned dependency
        raise RuntimeError("QR dependency is unavailable") from exc
    code = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=box_size,
        border=border,
    )
    code.add_data(url)
    code.make(fit=True)
    image = code.make_image(fill_color="#17212F", back_color="white")
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def qr_reader(url: str) -> ImageReader:
    return ImageReader(BytesIO(qr_png(url)))
