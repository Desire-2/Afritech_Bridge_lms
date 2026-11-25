"""Fixed design tokens for the official Talent Passport PDF.

Values are backend constants. Nothing in an HTTP request can change geometry,
type, colors, assets or the sequence of sections.
"""

from __future__ import annotations

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm

# ---------------------------------------------------------------------------
# Page geometry (A4 portrait, all drawing in points)
# ---------------------------------------------------------------------------
PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN_X = 18 * mm
HEADER_HEIGHT = 15 * mm
FOOTER_HEIGHT = 16 * mm
CONTENT_TOP = PAGE_HEIGHT - HEADER_HEIGHT - 7 * mm
CONTENT_BOTTOM = FOOTER_HEIGHT + 7 * mm
CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN_X
CONTENT_HEIGHT = CONTENT_TOP - CONTENT_BOTTOM

# ---------------------------------------------------------------------------
# Official palette
# ---------------------------------------------------------------------------
NAVY = colors.HexColor("#0B1C3A")
TEAL = colors.HexColor("#3ECFB2")
ORANGE = colors.HexColor("#F07C2E")
WARM_WHITE = colors.HexColor("#F8F8F5")
PAPER = colors.HexColor("#F0F1ED")
DARK_TEXT = colors.HexColor("#17212F")
MUTED_GREY = colors.HexColor("#6D7884")
LIGHT_LINE = colors.HexColor("#DDE3E5")
WHITE = colors.white

# Alpha variants used only for soft vector fills.
TEAL_WASH = colors.Color(0.243, 0.812, 0.698, alpha=0.13)
ORANGE_WASH = colors.Color(0.941, 0.486, 0.180, alpha=0.12)
NAVY_WASH = colors.Color(0.043, 0.110, 0.227, alpha=0.07)

# ---------------------------------------------------------------------------
# Typography. Font names are registered by assets.register_fonts().
# ---------------------------------------------------------------------------
FONT_SANS = "PassportSans"
FONT_SANS_BOLD = "PassportSansBold"
FONT_SANS_ITALIC = "PassportSansItalic"
FONT_SERIF = "PassportSerif"
FONT_SERIF_BOLD = "PassportSerifBold"

TYPE = {
    "cover_eyebrow": (FONT_SANS_BOLD, 8.5, 11, 1.6),
    "cover_title": (FONT_SERIF_BOLD, 34, 38, 0),
    "cover_subtitle": (FONT_SANS, 12.5, 17, 0),
    "cover_name": (FONT_SERIF, 26, 31, 0),
    "cover_meta": (FONT_SANS, 9.5, 14, 0),
    "section_index": (FONT_SANS_BOLD, 8, 10, 0),
    "section_title": (FONT_SERIF_BOLD, 16, 19, 0),
    "section_subtitle": (FONT_SANS, 8.5, 12, 0),
    "label": (FONT_SANS_BOLD, 7.5, 10, 0.8),
    "body": (FONT_SANS, 9.2, 13.2, 0),
    "body_bold": (FONT_SANS_BOLD, 9.2, 13.2, 0),
    "small": (FONT_SANS, 7.8, 10.8, 0),
    "small_bold": (FONT_SANS_BOLD, 7.8, 10.8, 0),
    "stat_number": (FONT_SERIF_BOLD, 20, 22, 0),
    "footer": (FONT_SANS, 7, 9, 0),
}

# ---------------------------------------------------------------------------
# Spacing and component sizes
# ---------------------------------------------------------------------------
GAP_SMALL = 2.2 * mm
GAP_MEDIUM = 4.2 * mm
GAP_LARGE = 7 * mm
PANEL_PADDING = 4.5 * mm
SECTION_GAP = 6 * mm
CARD_RADIUS = 2.5 * mm
LINE_WIDTH = 0.6

# ---------------------------------------------------------------------------
# Template identity
# ---------------------------------------------------------------------------
TEMPLATE_VERSION = "1.0.0"
DOCUMENT_TITLE = "Professional Talent Passport"
DOCUMENT_AUTHOR = "AfriTech Bridge LMS"
DOCUMENT_CREATOR = "AfriTech Bridge Talent Passport Document Service"
DOCUMENT_SUBJECT = "Backend-generated professional learner credential portfolio"
DOCUMENT_KEYWORDS = "Talent Passport,AfriTech Bridge,verification,A4"

EDITION_LABELS = {
    "professional_share": "PROFESSIONAL SHARE EDITION",
    "personal_record": "PERSONAL RECORD EDITION",
}

STATUS_LABELS = {
    "current": "CURRENT RECORD",
    "superseded": "SUPERSEDED RECORD",
    "revoked": "REVOKED RECORD",
}
