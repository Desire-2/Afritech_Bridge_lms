"""Low-level vector/text primitives using top-based coordinates.

All helpers accept ``top`` measured from the top of the A4 page. Converting to
ReportLab's bottom-based coordinates happens in one place to avoid accidental
vertical drift between components.
"""

from __future__ import annotations

from typing import Iterable, List, Tuple

from reportlab.lib.colors import Color
from reportlab.lib.units import mm

from . import tokens as t
from .assets import draw_logo
from .text import clean, style, width


def page_y(top: float) -> float:
    return t.PAGE_HEIGHT - top


def rect(canvas, x: float, top: float, w: float, h: float,
         fill=None, stroke=None, line_width: float = t.LINE_WIDTH,
         radius: float = 0) -> None:
    y = page_y(top + h)
    if radius:
        path = canvas.beginPath()
        path.roundRect(x, y, w, h, radius)
        canvas.drawPath(path, fill=bool(fill), stroke=bool(stroke))
    else:
        if fill is not None:
            canvas.setFillColor(fill)
        if stroke is not None:
            canvas.setStrokeColor(stroke)
            canvas.setLineWidth(line_width)
        canvas.rect(x, y, w, h, fill=fill is not None, stroke=stroke is not None)


def line(canvas, x1: float, y1_top: float, x2: float, y2_top: float,
         color=None, line_width: float = t.LINE_WIDTH) -> None:
    canvas.setStrokeColor(color or t.LIGHT_LINE)
    canvas.setLineWidth(line_width)
    canvas.line(x1, page_y(y1_top), x2, page_y(y2_top))


def draw_text(canvas, text: str, x: float, top: float, font: str, size: float,
              color=None) -> float:
    value = clean(text)
    if not value:
        return 0.0
    canvas.setFillColor(color or t.DARK_TEXT)
    canvas.setFont(font, size)
    canvas.drawString(x, page_y(top) - size, value)
    return width(value, font, size)


def draw_right_text(canvas, text: str, right_x: float, top: float, font: str,
                    size: float, color=None) -> float:
    value = clean(text)
    if not value:
        return 0.0
    canvas.setFillColor(color or t.DARK_TEXT)
    canvas.setFont(font, size)
    canvas.drawRightString(right_x, page_y(top) - size, value)
    return width(value, font, size)


def draw_centered_text(canvas, text: str, center_x: float, top: float,
                       font: str, size: float, color=None) -> float:
    value = clean(text)
    if not value:
        return 0.0
    canvas.setFillColor(color or t.DARK_TEXT)
    canvas.setFont(font, size)
    canvas.drawCentredString(center_x, page_y(top) - size, value)
    return width(value, font, size)


def draw_lines(canvas, lines: Iterable[str], x: float, top: float,
               font: str, size: float, leading: float, color=None) -> float:
    cursor = top
    count = 0
    for value in lines:
        draw_text(canvas, value, x, cursor, font, size, color)
        cursor += leading
        count += 1
    return cursor - top if count else 0.0


def draw_link_text(canvas, text: str, x: float, top: float, font: str,
                   size: float, url: str, color=None) -> float:
    """Draw selectable-looking link text and register a real PDF link."""
    value = clean(text)
    if not value:
        return 0.0
    text_width = draw_text(canvas, value, x, top, font, size, color or t.TEAL)
    baseline = page_y(top) - size
    canvas.linkURL(url, (x, baseline - 2, x + text_width, baseline + size + 2),
                   relative=0, thickness=0)
    line(canvas, x, top + size + 1.5, x + text_width, top + size + 1.5,
         color=t.TEAL, line_width=0.45)
    return text_width


def draw_bridge_motif(canvas, x: float, top: float, w: float, h: float,
                      dark: bool = False) -> None:
    """Vector 'bridge to opportunity'线缆 motif; no raster artwork."""
    deck_y = top + h * 0.64
    cable_color = t.TEAL if dark else t.NAVY
    accent_color = t.ORANGE

    line(canvas, x, deck_y, x + w, deck_y, color=cable_color, line_width=1.3)
    line(canvas, x + w * 0.08, deck_y, x + w * 0.08, top + h * 0.08,
         color=cable_color, line_width=1.0)
    line(canvas, x + w * 0.92, deck_y, x + w * 0.92, top + h * 0.08,
         color=cable_color, line_width=1.0)

    pylon_top = top + h * 0.08
    canvas.setStrokeColor(cable_color)
    canvas.setLineWidth(0.75)
    # Left fan.
    for end_x, end_y in (
        (x + w * 0.30, deck_y),
        (x + w * 0.50, deck_y),
        (x + w * 0.70, deck_y),
    ):
        canvas.line(x + w * 0.08, pylon_top, end_x, page_y(end_y))
    # Right fan.
    for end_x, end_y in (
        (x + w * 0.50, deck_y),
        (x + w * 0.30, deck_y),
        (x + w * 0.10, deck_y),
    ):
        canvas.line(x + w * 0.92, pylon_top, end_x, page_y(end_y))

    canvas.setFillColor(accent_color)
    canvas.circle(x + w * 0.50, page_y(deck_y), 2.1, stroke=0, fill=1)


def draw_page_background(canvas, cover: bool = False) -> None:
    rect(canvas, 0, 0, t.PAGE_WIDTH, t.PAGE_HEIGHT, fill=t.WARM_WHITE)


def draw_page_header(canvas, spec, page_no: int, total_pages: int) -> None:
    draw_page_background(canvas)
    rect(canvas, 0, 0, t.PAGE_WIDTH, t.HEADER_HEIGHT, fill=t.NAVY)
    rect(canvas, 0, t.HEADER_HEIGHT - 0.8, t.PAGE_WIDTH, 0.8, fill=t.TEAL)

    chip_top = 2.5 * mm
    chip_width = 23 * mm
    chip_height = 10.4 * mm
    rect(canvas, t.MARGIN_X, chip_top, chip_width, chip_height,
         fill=t.WARM_WHITE, radius=1.1 * mm)
    draw_logo(canvas, t.MARGIN_X + 1.4 * mm, chip_top + 1.2 * mm,
              8 * mm, 8 * mm)

    font, size, _, _ = style("label")
    draw_text(canvas, "TALENT PASSPORT", t.MARGIN_X + chip_width + 3 * mm,
              5.8 * mm, t.FONT_SANS_BOLD, size + 0.7, t.WARM_WHITE)
    draw_right_text(canvas, spec.edition_label, t.PAGE_WIDTH - t.MARGIN_X,
                    5.8 * mm, font, size, t.TEAL)


def draw_page_footer(canvas, spec, page_no: int, total_pages: int) -> None:
    top = t.PAGE_HEIGHT - t.FOOTER_HEIGHT
    rect(canvas, 0, top, t.PAGE_WIDTH, t.FOOTER_HEIGHT, fill=t.PAPER)
    line(canvas, 0, top, t.PAGE_WIDTH, top, color=t.LIGHT_LINE, line_width=0.5)
    font, size, _, _ = style("footer")
    footer_text_top = top + 5.2 * mm
    draw_text(canvas, "BRIDGE TO OPPORTUNITY", t.MARGIN_X, footer_text_top,
              t.FONT_SANS_BOLD, size, t.NAVY)
    draw_centered_text(canvas, spec.document_ref, t.PAGE_WIDTH / 2, footer_text_top,
                       font, size, t.MUTED_GREY)
    suffix = f" / {total_pages}" if total_pages else ""
    draw_right_text(canvas, f"PAGE {page_no}{suffix}", t.PAGE_WIDTH - t.MARGIN_X,
                    footer_text_top, t.FONT_SANS_BOLD, size, t.NAVY)


def tint(hex_color: str, alpha: float) -> Color:
    value = hex_color.lstrip("#")
    return Color(
        int(value[0:2], 16) / 255,
        int(value[2:4], 16) / 255,
        int(value[4:6], 16) / 255,
        alpha=alpha,
    )
