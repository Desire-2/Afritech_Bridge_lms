"""Composed editorial blocks for the Talent Passport PDF.

Every block measures itself with the embedded fonts before it is placed. The
pagination engine moves whole atomic cards and heading groups to the next page;
it never shrinks type or scales content to make it fit.
"""

from __future__ import annotations

from typing import Iterable, List, Optional, Sequence, Tuple

from reportlab.lib.units import mm

from . import tokens as t
from .assets import draw_logo, qr_reader
from .primitives import (
    draw_centered_text,
    draw_link_text,
    draw_lines,
    draw_right_text,
    draw_text,
    line,
    rect,
    tint,
)
from .text import clean, format_date, one_line, style, truncate, width, wrap


class Block:
    keep_with_next = False
    min_height = 0.0

    def measure(self, available_width: float) -> float:
        raise NotImplementedError

    def draw(self, canvas, x: float, top: float, width: float) -> None:
        raise NotImplementedError


class Spacer(Block):
    def __init__(self, height: float):
        self.height = height

    def measure(self, available_width: float) -> float:
        return self.height

    def draw(self, canvas, x: float, top: float, width: float) -> None:
        return


class Group(Block):
    """Atomic sequence; used for heading + first paragraph/card."""

    def __init__(self, children: Sequence[Block], gap: float = t.GAP_SMALL,
                 keep_with_next: bool = False):
        self.children = list(children)
        self.gap = gap
        self.keep_with_next = keep_with_next

    def measure(self, available_width: float) -> float:
        if not self.children:
            return 0.0
        return sum(child.measure(available_width) for child in self.children) + self.gap * (len(self.children) - 1)

    def draw(self, canvas, x: float, top: float, width: float) -> None:
        cursor = top
        for child in self.children:
            height = child.measure(width)
            child.draw(canvas, x, cursor, width)
            cursor += height + self.gap


class Text(Block):
    def __init__(self, value, style_name: str = "body", color=None,
                 max_lines: Optional[int] = None, bold: bool = False):
        font, size, leading, _ = style(style_name)
        if bold:
            font = t.FONT_SANS_BOLD if font == t.FONT_SANS else t.FONT_SERIF_BOLD
        self.font = font
        self.value = value
        self.size = size
        self.leading = leading
        self.color = color
        self.max_lines = max_lines

    def _lines(self, available_width: float) -> List[str]:
        lines = wrap(self.value, self.font, self.size, available_width)
        if self.max_lines and len(lines) > self.max_lines:
            lines = lines[: self.max_lines]
            last = truncate(" ".join(lines), self.font, self.size, available_width)
            lines = lines[: -1] + [last]
        return lines

    def measure(self, available_width: float) -> float:
        lines = self._lines(available_width)
        if not lines:
            return self.leading
        return len(lines) * self.leading

    def draw(self, canvas, x: float, top: float, width: float) -> None:
        draw_lines(canvas, self._lines(width), x, top, self.font, self.size,
                   self.leading, self.color)

    @property
    def min_height(self) -> float:  # type: ignore[override]
        return self.leading * 2


class SectionHeading(Block):
    keep_with_next = True

    def __init__(self, index: str, title: str, subtitle: Optional[str] = None):
        self.index = one_line(index)
        self.title = one_line(title)
        self.subtitle = one_line(subtitle)

    def measure(self, available_width: float) -> float:
        base = 10.5 * mm
        if self.subtitle:
            _, size, leading, _ = style("section_subtitle")
            base += len(wrap(self.subtitle, t.FONT_SANS, size, available_width - 11 * mm)) * leading
        return base

    def draw(self, canvas, x: float, top: float, width: float) -> None:
        rect(canvas, x, top, 7.2 * mm, 7.2 * mm, fill=t.NAVY, radius=0.8 * mm)
        draw_centered_text(canvas, self.index, x + 3.6 * mm, top + 1.6 * mm,
                           t.FONT_SANS_BOLD, 8, t.WARM_WHITE)
        _, title_size, _, _ = style("section_title")
        draw_text(canvas, self.title, x + 10 * mm, top + 0.2 * mm,
                  t.FONT_SERIF_BOLD, title_size, t.NAVY)
        cursor = top + 8.6 * mm
        if self.subtitle:
            font, size, leading, _ = style("section_subtitle")
            for line_text in wrap(self.subtitle, font, size, width - 11 * mm):
                draw_text(canvas, line_text, x + 10 * mm, cursor, font, size, t.MUTED_GREY)
                cursor += leading
        line(canvas, x + 10 * mm, cursor + 0.6 * mm, x + width, cursor + 0.6 * mm,
             color=t.TEAL, line_width=1.0)


class Panel(Block):
    def __init__(self, children: Sequence[Block], fill=None, stroke=None,
                 padding: float = t.PANEL_PADDING, gap: float = t.GAP_SMALL,
                 radius: float = t.CARD_RADIUS):
        self.children = list(children)
        self.fill = fill or t.WARM_WHITE
        self.stroke = stroke or t.LIGHT_LINE
        self.padding = padding
        self.gap = gap
        self.radius = radius

    def measure(self, available_width: float) -> float:
        inner = available_width - 2 * self.padding
        if not self.children:
            return 2 * self.padding
        return 2 * self.padding + sum(child.measure(inner) for child in self.children) + self.gap * (len(self.children) - 1)

    def draw(self, canvas, x: float, top: float, width: float) -> None:
        height = self.measure(width)
        rect(canvas, x, top, width, height, fill=self.fill, stroke=self.stroke,
             radius=self.radius)
        inner = width - 2 * self.padding
        cursor = top + self.padding
        for child in self.children:
            child_height = child.measure(inner)
            child.draw(canvas, x + self.padding, cursor, inner)
            cursor += child_height + self.gap


class KeyValueRows(Block):
    def __init__(self, rows: Sequence[Tuple[str, object]], label_width: float = 30 * mm):
        self.rows = [(one_line(label), value) for label, value in rows]
        self.label_width = label_width

    def _value_lines(self, value, value_width: float) -> List[str]:
        font, size, _, _ = style("body")
        lines = wrap(value, font, size, value_width)
        return lines or ["—"]

    def measure(self, available_width: float) -> float:
        _, _, leading, _ = style("body")
        value_width = available_width - self.label_width
        total = 0.0
        for _, value in self.rows:
            total += max(leading, len(self._value_lines(value, value_width)) * leading) + 2.0 * mm
        return total

    def draw(self, canvas, x: float, top: float, width: float) -> None:
        value_width = width - self.label_width
        _, size, leading, _ = style("body")
        cursor = top
        for index, (label, value) in enumerate(self.rows):
            draw_text(canvas, label.upper(), x, cursor, t.FONT_SANS_BOLD, 7.4, t.MUTED_GREY)
            lines = self._value_lines(value, value_width)
            draw_lines(canvas, lines, x + self.label_width, cursor,
                       t.FONT_SANS, size, leading, t.DARK_TEXT)
            row_height = max(leading, len(lines) * leading)
            cursor += row_height + 2.0 * mm
            if index < len(self.rows) - 1:
                line(canvas, x, cursor - 1.0 * mm, x + width, cursor - 1.0 * mm,
                     color=t.LIGHT_LINE, line_width=0.4)


class ChipRow(Block):
    def __init__(self, values: Iterable, color=None):
        self.values = [one_line(value) for value in values or [] if one_line(value)]
        self.color = color or t.TEAL

    def _rows(self, available_width: float) -> List[List[Tuple[str, float]]]:
        font, size, _, _ = style("small_bold")
        rows: List[List[Tuple[str, float]]] = []
        current: List[Tuple[str, float]] = []
        used = 0.0
        for value in self.values:
            chip_width = min(width(value, font, size) + 5.2 * mm, available_width)
            if current and used + chip_width + 1.8 * mm > available_width:
                rows.append(current)
                current, used = [], 0.0
            current.append((value, chip_width))
            used += chip_width + (1.8 * mm if current else 0)
        if current:
            rows.append(current)
        return rows

    def measure(self, available_width: float) -> float:
        rows = self._rows(available_width)
        if not rows:
            return 0.0
        return len(rows) * 6.6 * mm + (len(rows) - 1) * 1.8 * mm

    def draw(self, canvas, x: float, top: float, width: float) -> None:
        font, size, _, _ = style("small_bold")
        cursor = top
        for row in self._rows(width):
            chip_x = x
            for value, chip_width in row:
                rect(canvas, chip_x, cursor, chip_width, 6.6 * mm,
                     fill=tint("#3ECFB2", 0.12), stroke=self.color,
                     line_width=0.5, radius=3.3 * mm)
                label = truncate(value, font, size, chip_width - 4.6 * mm)
                draw_centered_text(canvas, label, chip_x + chip_width / 2,
                                   cursor + 1.4 * mm, font, size, t.NAVY)
                chip_x += chip_width + 1.8 * mm
            cursor += 6.6 * mm + 1.8 * mm


class StatStrip(Block):
    def __init__(self, stats: Sequence[Tuple[str, str]]):
        self.stats = [(str(number), one_line(label)) for number, label in stats]

    def measure(self, available_width: float) -> float:
        return 15 * mm

    def draw(self, canvas, x: float, top: float, width: float) -> None:
        if not self.stats:
            return
        column = width / len(self.stats)
        for index, (number, label) in enumerate(self.stats):
            cx = x + index * column
            if index:
                line(canvas, cx, top + 2 * mm, cx, top + 13 * mm,
                     color=t.LIGHT_LINE, line_width=0.5)
            _, number_size, _, _ = style("stat_number")
            draw_text(canvas, truncate(number, t.FONT_SERIF_BOLD, number_size, column - 4 * mm),
                      cx + 2 * mm, top, t.FONT_SERIF_BOLD, number_size, t.ORANGE)
            font, size, _, _ = style("small")
            draw_text(canvas, truncate(label.upper(), font, size, column - 4 * mm),
                      cx + 2 * mm, top + 9 * mm, font, size, t.MUTED_GREY)


class TimelineRow(Block):
    keep_with_next = False

    def __init__(self, item):
        self.kind = one_line(item.get("kind")).replace("_", " ")
        self.title = one_line(item.get("title")) or "Learning record"
        self.description = one_line(item.get("description"))
        self.date = format_date(item.get("date"))

    def measure(self, available_width: float) -> float:
        title_font, title_size, title_leading, _ = style("body_bold")
        desc_font, desc_size, desc_leading, _ = style("small")
        text_width = available_width - 31 * mm
        title_lines = wrap(self.title, t.FONT_SANS_BOLD, title_size, text_width)
        desc_lines = wrap(self.description, desc_font, desc_size, text_width)
        return max(title_leading * max(len(title_lines), 1) + desc_leading * len(desc_lines),
                   8 * mm) + 2.6 * mm

    def draw(self, canvas, x: float, top: float, width: float) -> None:
        line(canvas, x + 2.1 * mm, top, x + 2.1 * mm, top + self.measure(width),
             color=t.LIGHT_LINE, line_width=0.8)
        canvas.setFillColor(t.TEAL)
        canvas.circle(x + 2.1 * mm, t.PAGE_HEIGHT - (top + 1.6 * mm), 1.7, stroke=0, fill=1)
        font, size, _, _ = style("small_bold")
        draw_text(canvas, self.date, x + 7 * mm, top, font, size, t.ORANGE)
        draw_text(canvas, self.kind.upper(), x + 7 * mm, top + 4 * mm, font, size - 0.5, t.MUTED_GREY)
        title_font, title_size, title_leading, _ = style("body_bold")
        desc_font, desc_size, desc_leading, _ = style("small")
        text_width = width - 31 * mm
        cursor = top
        for line_text in wrap(self.title, t.FONT_SANS_BOLD, title_size, text_width):
            draw_text(canvas, line_text, x + 31 * mm, cursor, t.FONT_SANS_BOLD,
                      title_size, t.DARK_TEXT)
            cursor += title_leading
        for line_text in wrap(self.description, desc_font, desc_size, text_width):
            draw_text(canvas, line_text, x + 31 * mm, cursor, desc_font, desc_size, t.MUTED_GREY)
            cursor += desc_leading


class LinkText(Block):
    def __init__(self, text: str, url: str, style_name: str = "small"):
        self.text = one_line(text)
        self.url = one_line(url)
        self.style_name = style_name

    def measure(self, available_width: float) -> float:
        font, size, leading, _ = style(self.style_name)
        lines = wrap(self.text, font, size, available_width)
        return leading * max(len(lines), 1)

    def draw(self, canvas, x: float, top: float, width: float) -> None:
        font, size, leading, _ = style(self.style_name)
        text = truncate(self.text, font, size, width)
        draw_link_text(canvas, text, x, top, font, size, self.url, t.TEAL)


class ProjectCard(Block):
    keep_with_next = False

    def __init__(self, item):
        self.title = one_line(item.get("title")) or "Portfolio project"
        self.description = one_line(item.get("description"))
        self.technologies = item.get("technologies") or []
        self.url = one_line(item.get("external_url"))

    def measure(self, available_width: float) -> float:
        children = [Text(self.title, "body_bold"), Text(self.description, "small")]
        if self.technologies:
            children.append(ChipRow(self.technologies))
        if self.url:
            children.append(LinkText("View project", self.url))
        return Panel(children, fill=t.PAPER).measure(available_width)

    def draw(self, canvas, x: float, top: float, width: float) -> None:
        children = [Text(self.title, "body_bold"), Text(self.description, "small")]
        if self.technologies:
            children.append(ChipRow(self.technologies))
        if self.url:
            children.append(LinkText("View project", self.url))
        Panel(children, fill=t.PAPER).draw(canvas, x, top, width)


class CredentialCard(Block):
    keep_with_next = False

    def __init__(self, item):
        course = item.get("course") if isinstance(item.get("course"), dict) else {}
        self.title = one_line(item.get("title") or course.get("title")) or "Course certificate"
        self.number = one_line(item.get("certificate_number"))
        self.status = one_line(item.get("status")).upper()
        self.issued = format_date(item.get("issued_at"))
        self.url = one_line(item.get("verification_url"))

    def measure(self, available_width: float) -> float:
        children = [Text(self.title, "body_bold"),
                    Text(f"{self.number}  ·  Issued {self.issued}  ·  {self.status}", "small")]
        if self.url:
            children.append(LinkText("Verify certificate", self.url))
        return Panel(children, fill=t.WARM_WHITE).measure(available_width)

    def draw(self, canvas, x: float, top: float, width: float) -> None:
        children = [Text(self.title, "body_bold"),
                    Text(f"{self.number}  ·  Issued {self.issued}  ·  {self.status}", "small")]
        if self.url:
            children.append(LinkText("Verify certificate", self.url))
        Panel(children, fill=t.WARM_WHITE).draw(canvas, x, top, width)


class AchievementRow(Block):
    keep_with_next = False

    def __init__(self, item):
        self.title = one_line(item.get("title")) or "Achievement"
        self.description = one_line(item.get("description"))
        self.date = format_date(item.get("earned_at"))

    def measure(self, available_width: float) -> float:
        font, size, leading, _ = style("body_bold")
        return max(leading + 4.0 * mm, 9 * mm)

    def draw(self, canvas, x: float, top: float, width: float) -> None:
        rect(canvas, x, top, width, self.measure(width), fill=t.WARM_WHITE,
             stroke=t.LIGHT_LINE, radius=t.CARD_RADIUS)
        rect(canvas, x, top, 1.5 * mm, self.measure(width), fill=t.ORANGE)
        font, size, _, _ = style("body_bold")
        draw_text(canvas, truncate(self.title, t.FONT_SANS_BOLD, size, width - 45 * mm),
                  x + 4 * mm, top + 2 * mm, t.FONT_SANS_BOLD, size, t.DARK_TEXT)
        small_font, small_size, _, _ = style("small")
        draw_right_text(canvas, self.date, x + width - 4 * mm, top + 2.4 * mm,
                        small_font, small_size, t.MUTED_GREY)
        if self.description:
            draw_text(canvas, truncate(self.description, small_font, small_size, width - 8 * mm),
                      x + 4 * mm, top + 6 * mm, small_font, small_size, t.MUTED_GREY)


class QRPanel(Block):
    keep_with_next = True

    def __init__(self, verification_url: str, document_ref: str, generated_at: str,
                 template_version: str, status_label: str):
        self.url = verification_url
        self.document_ref = document_ref
        self.generated_at = generated_at
        self.template_version = template_version
        self.status_label = status_label

    def measure(self, available_width: float) -> float:
        return 38 * mm

    def draw(self, canvas, x: float, top: float, width: float) -> None:
        rect(canvas, x, top, width, self.measure(width), fill=t.PAPER,
             stroke=t.TEAL, line_width=1.0, radius=t.CARD_RADIUS)
        qr_size = 30 * mm
        canvas.drawImage(qr_reader(self.url), x + 4 * mm,
                         t.PAGE_HEIGHT - (top + qr_size + 4 * mm),
                         width=qr_size, height=qr_size, mask="auto")
        text_x = x + qr_size + 10 * mm
        text_width = width - qr_size - 14 * mm
        font, size, leading, _ = style("label")
        draw_text(canvas, "DOCUMENT VERIFICATION", text_x, top + 5 * mm,
                  t.FONT_SANS_BOLD, size, t.ORANGE)
        small_font, small_size, small_leading, _ = style("small")
        rows = [
            f"Reference  {self.document_ref}",
            f"Generated  {format_date(self.generated_at)}",
            f"Template  v{self.template_version}",
            f"Status  {self.status_label}",
        ]
        cursor = top + 10 * mm
        for row in rows:
            draw_text(canvas, truncate(row, small_font, small_size, text_width),
                      text_x, cursor, small_font, small_size, t.DARK_TEXT)
            cursor += small_leading + 1.2 * mm
        draw_link_text(canvas, "Scan or open verification link", text_x, cursor + 1 * mm,
                       small_font, small_size, self.url, t.TEAL)


class LogoMark(Block):
    """Official issuer mark used as a closing brand signature."""

    def measure(self, available_width: float) -> float:
        return 20 * mm

    def draw(self, canvas, x: float, top: float, width: float) -> None:
        mark = 18 * mm
        draw_logo(canvas, x, top, mark, mark)
        font, size, leading, _ = style("label")
        draw_text(canvas, "OFFICIAL DOCUMENT", x + mark + 4 * mm,
                  top + 5 * mm, t.FONT_SANS_BOLD, size, t.NAVY)
        draw_text(canvas, "AfriTech Bridge", x + mark + 4 * mm,
                  top + 9 * mm, t.FONT_SERIF, size + 3, t.DARK_TEXT)
        draw_text(canvas, "Bridge to opportunity", x + mark + 4 * mm,
                  top + 13 * mm, t.FONT_SANS_ITALIC, size, t.ORANGE)


class Disclaimer(Block):
    def __init__(self, text: str):
        self.text = one_line(text)

    def measure(self, available_width: float) -> float:
        font, size, leading, _ = style("small")
        return len(wrap(self.text, font, size, available_width)) * leading

    def draw(self, canvas, x: float, top: float, width: float) -> None:
        font, size, leading, _ = style("small")
        line(canvas, x, top, x + width, top, color=t.LIGHT_LINE, line_width=0.5)
        draw_lines(canvas, wrap(self.text, font, size, width), x, top + 2.5 * mm,
                   font, size, leading, t.MUTED_GREY)
