"""Signature cover page for the professional Talent Passport PDF."""

from __future__ import annotations

from reportlab.lib.units import mm

from . import tokens as t
from .assets import draw_logo, qr_reader
from .primitives import (
    draw_centered_text,
    draw_link_text,
    draw_right_text,
    draw_text,
    draw_bridge_motif,
    line,
    rect,
)
from .text import format_date, one_line, truncate, wrap


def _profile_value(profile, key, default=""):
    return one_line(profile.get(key)) or default


def draw_cover(canvas, spec, total_pages: int) -> None:
    """Draw page 1. The caller draws the shared footer and advances the page."""
    rect(canvas, 0, 0, t.PAGE_WIDTH, t.PAGE_HEIGHT, fill=t.WARM_WHITE)
    hero_height = 108 * mm
    rect(canvas, 0, 0, t.PAGE_WIDTH, hero_height, fill=t.NAVY)
    rect(canvas, 0, hero_height - 1.0 * mm, t.PAGE_WIDTH, 1.0 * mm, fill=t.TEAL)
    rect(canvas, t.MARGIN_X, 0, 1.6 * mm, hero_height, fill=t.ORANGE)

    # Official logo, embedded as the original bytes and fitted without stretch.
    # A larger, tightly-fitted mark makes the brand legible at print size; the
    # teal baseline ties the chip into the hero's accent rule without redrawing
    # or recolouring the asset itself.
    chip_x = t.MARGIN_X + 6 * mm
    logo_box = 20 * mm
    chip_pad = 3 * mm
    chip_top = 9 * mm
    chip_height = logo_box + 4 * mm
    chip_width = logo_box + 2 * chip_pad
    rect(canvas, chip_x - chip_pad, chip_top, chip_width, chip_height,
         fill=t.WARM_WHITE, radius=1.8 * mm)
    draw_logo(canvas, chip_x, chip_top + 2 * mm, logo_box, logo_box)
    rect(canvas, chip_x - chip_pad, chip_top + chip_height,
         chip_width, 0.7 * mm, fill=t.TEAL)

    _, eyebrow_size, _, tracking = t.TYPE["cover_eyebrow"]
    draw_text(canvas, "AFRITECH BRIDGE  /  TALENT PASSPORT", chip_x, 39 * mm,
              t.FONT_SANS_BOLD, eyebrow_size, t.TEAL)

    title_font, title_size, _, _ = t.TYPE["cover_title"]
    draw_text(canvas, "PROFESSIONAL", chip_x, 49 * mm, title_font, title_size, t.WARM_WHITE)
    draw_text(canvas, "TALENT PASSPORT", chip_x, 65 * mm, title_font, title_size, t.WARM_WHITE)
    draw_text(canvas, "Bridge to opportunity", chip_x, 87 * mm,
              t.FONT_SERIF, 16, t.ORANGE)

    draw_bridge_motif(canvas, t.PAGE_WIDTH - t.MARGIN_X - 83 * mm, 44 * mm,
                      80 * mm, 44 * mm, dark=True)

    # Identity block.
    profile = spec.profile or {}
    name = _profile_value(profile, "name", "Learner profile")
    headline = _profile_value(profile, "headline")
    name_font, name_size, _, _ = t.TYPE["cover_name"]
    name_text = truncate(name, name_font, name_size, t.CONTENT_WIDTH - 60 * mm)
    draw_text(canvas, name_text, t.MARGIN_X, 120 * mm, name_font, name_size, t.NAVY)
    if headline:
        _, subtitle_size, _, _ = t.TYPE["cover_subtitle"]
        headline_text = truncate(headline, t.FONT_SANS, subtitle_size, t.CONTENT_WIDTH - 60 * mm)
        draw_text(canvas, headline_text, t.MARGIN_X, 136 * mm,
                  t.FONT_SANS, subtitle_size, t.MUTED_GREY)

    location = ", ".join(part for part in (_profile_value(profile, "city"),
                                           _profile_value(profile, "country")) if part)
    completeness = ""
    if spec.completeness is not None:
        completeness = f"  ·  {spec.completeness}% profile completeness"
    draw_text(canvas, f"{location}{completeness}", t.MARGIN_X, 148 * mm,
              t.FONT_SANS, 9.2, t.DARK_TEXT)

    line(canvas, t.MARGIN_X, 160 * mm, t.PAGE_WIDTH - t.MARGIN_X, 160 * mm,
         color=t.LIGHT_LINE, line_width=0.8)

    # Document control and authorised issuer area.
    label_font, label_size, _, _ = t.TYPE["label"]
    body_font, body_size, body_leading, _ = t.TYPE["small"]
    left_x = t.MARGIN_X
    right_x = t.PAGE_WIDTH - t.MARGIN_X - 62 * mm
    draw_text(canvas, "DOCUMENT CONTROL", left_x, 168 * mm,
              t.FONT_SANS_BOLD, label_size, t.ORANGE)
    control_rows = [
        f"Reference  {spec.document_ref}",
        f"Generated  {format_date(spec.generated_at)}",
        f"Template  v{spec.template_version}",
        f"Edition  {spec.edition_label}",
        f"Status  {spec.status_label}",
    ]
    cursor = 176 * mm
    for row in control_rows:
        draw_text(canvas, row, left_x, cursor, body_font, body_size, t.DARK_TEXT)
        cursor += body_leading + 1.2 * mm

    draw_text(canvas, "AUTHORISED ISSUER", right_x, 168 * mm,
              t.FONT_SANS_BOLD, label_size, t.ORANGE)
    draw_text(canvas, "AfriTech Bridge LMS", right_x, 177 * mm,
              t.FONT_SANS, body_size, t.DARK_TEXT)
    line(canvas, right_x, 194 * mm, right_x + 58 * mm, 194 * mm,
         color=t.NAVY, line_width=0.8)
    draw_text(canvas, "Official document services", right_x, 197 * mm,
              body_font, body_size, t.MUTED_GREY)

    # Compact verification code on the cover; the full panel is the last section.
    qr_size = 26 * mm
    qr_x = t.PAGE_WIDTH - t.MARGIN_X - qr_size
    qr_top = 214 * mm
    canvas.drawImage(qr_reader(spec.verification_url), qr_x,
                     t.PAGE_HEIGHT - (qr_top + qr_size),
                     width=qr_size, height=qr_size, mask="auto")
    draw_right_text(canvas, "SCAN TO VERIFY", qr_x + qr_size, qr_top - 4 * mm,
                    t.FONT_SANS_BOLD, label_size, t.NAVY)
    draw_link_text(canvas, "Open verification", qr_x, qr_top + qr_size + 4 * mm,
                   body_font, body_size, spec.verification_url, t.TEAL)

    if spec.public_url:
        public_text = truncate(spec.public_url, body_font, body_size, 90 * mm)
        draw_text(canvas, f"Public passport: {public_text}", t.MARGIN_X,
                  228 * mm, body_font, body_size, t.MUTED_GREY)
