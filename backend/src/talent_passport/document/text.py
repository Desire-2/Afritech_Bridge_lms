"""Text normalization, font registration and measured wrapping.

All measurement uses the same embedded fonts that draw the final PDF, so a
line break chosen during pagination is the line break printed on the page.
"""

from __future__ import annotations

import re
from typing import Iterable, List, Optional

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from . import tokens as t

_FONTS_REGISTERED = False

FONT_FILES = {
    t.FONT_SANS: "DejaVuSans.ttf",
    t.FONT_SANS_BOLD: "DejaVuSans-Bold.ttf",
    t.FONT_SANS_ITALIC: "DejaVuSans-Oblique.ttf",
    t.FONT_SERIF: "DejaVuSerif.ttf",
    t.FONT_SERIF_BOLD: "DejaVuSerif-Bold.ttf",
}


def register_fonts(font_directory) -> None:
    """Register the five vendored TTF faces exactly once.

    The files are copied into the backend asset tree rather than read from a
    host font path, making the rendered document independent of the machine on
    which the service runs.
    """
    global _FONTS_REGISTERED
    if _FONTS_REGISTERED:
        return
    existing = set(pdfmetrics.getRegisteredFontNames())
    for name, filename in FONT_FILES.items():
        if name not in existing:
            pdfmetrics.registerFont(TTFont(name, str(font_directory / filename)))
    _FONTS_REGISTERED = True


def clean(value) -> str:
    """Return printable text with stable whitespace; never raises."""
    if value is None:
        return ""
    text = str(value)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = "".join(ch for ch in text if ch == "\n" or ch == "\t" or ord(ch) >= 32)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    return text.strip()


def one_line(value) -> str:
    return clean(value).replace("\n", " — ")


def width(text: str, font: str, size: float) -> float:
    return pdfmetrics.stringWidth(text, font, size)


def truncate(text: str, font: str, size: float, max_width: float) -> str:
    value = one_line(text)
    if width(value, font, size) <= max_width:
        return value
    ellipsis = "…"
    low, high = 0, len(value)
    while low < high:
        mid = (low + high + 1) // 2
        candidate = value[:mid].rstrip() + ellipsis
        if width(candidate, font, size) <= max_width:
            low = mid
        else:
            high = mid - 1
    return value[:low].rstrip() + ellipsis


def wrap(value, font: str, size: float, max_width: float) -> List[str]:
    """Wrap normalized text without changing fonts or shrinking type."""
    text = clean(value)
    if not text:
        return []
    lines: List[str] = []
    for paragraph in text.split("\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            lines.append("")
            continue
        current = ""
        for word in paragraph.split(" "):
            if not word:
                continue
            candidate = word if not current else f"{current} {word}"
            if width(candidate, font, size) <= max_width:
                current = candidate
                continue
            if current:
                lines.append(current)
                current = ""
            if width(word, font, size) <= max_width:
                current = word
                continue
            # Long unbroken token (URL or identifier): split by characters.
            piece = ""
            for char in word:
                if width(piece + char, font, size) > max_width and piece:
                    lines.append(piece)
                    piece = char
                else:
                    piece += char
            current = piece
        if current:
            lines.append(current)
    return lines


def style(name: str):
    """Return ``(font, size, leading, tracking)`` from the token table."""
    return t.TYPE[name]


def style_for(name: str, bold: bool = False):
    font, size, leading, tracking = style(name)
    if bold and font == t.FONT_SANS:
        font = t.FONT_SANS_BOLD
    elif bold and font == t.FONT_SERIF:
        font = t.FONT_SERIF_BOLD
    return font, size, leading, tracking


def format_date(value) -> str:
    """Turn an ISO date or datetime into a compact printed date."""
    text = one_line(value)
    if not text:
        return "—"
    text = text.replace("T", " ")
    text = text.split("+")[0].split("Z")[0].strip()
    parts = text.split("-")
    if len(parts) < 3:
        return text
    year, month, day = parts[0], parts[1], parts[2][:2]
    months = {
        "01": "JAN", "02": "FEB", "03": "MAR", "04": "APR", "05": "MAY", "06": "JUN",
        "07": "JUL", "08": "AUG", "09": "SEP", "10": "OCT", "11": "NOV", "12": "DEC",
    }
    if not day.isdigit() or month not in months:
        return text
    return f"{int(day):02d} {months[month]} {year}"


def bullet_items(values: Iterable) -> List[str]:
    return [one_line(item) for item in values or [] if one_line(item)]
