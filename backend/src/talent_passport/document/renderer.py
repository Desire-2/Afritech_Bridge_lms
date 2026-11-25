"""Backend PDF renderer entry point.

The renderer performs two deterministic passes: the first counts pages, the
second prints accurate ``Page X / Y`` footers. No browser, CSS engine or client
library participates in this process.
"""

from __future__ import annotations

from io import BytesIO

from PyPDF2 import PdfReader
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from .assets import prepare_fonts
from .cover import draw_cover
from .pagination import FlowEngine
from .primitives import draw_page_footer
from .sections import build_content_blocks
from .spec import DocumentSpec
from . import tokens as t


def _render(spec: DocumentSpec, total_pages: int) -> bytes:
    prepare_fonts()
    output = BytesIO()
    pdf = canvas.Canvas(
        output,
        pagesize=A4,
        pageCompression=1,
        invariant=1,
    )
    pdf.setTitle(t.DOCUMENT_TITLE)
    pdf.setAuthor(t.DOCUMENT_AUTHOR)
    pdf.setSubject(t.DOCUMENT_SUBJECT)
    pdf.setCreator(t.DOCUMENT_CREATOR)
    pdf.setKeywords(", ".join(t.DOCUMENT_KEYWORDS.split(",")))

    draw_cover(pdf, spec, total_pages)
    draw_page_footer(pdf, spec, 1, total_pages)
    pdf.showPage()

    flow = FlowEngine(pdf, spec, total_pages)
    for block in build_content_blocks(spec):
        flow.place(block)
    flow.finish()

    pdf.save()
    return output.getvalue()


def render_document(spec: DocumentSpec) -> bytes:
    """Render a validated spec into A4 PDF bytes."""
    first_pass = _render(spec, 0)
    try:
        page_count = len(PdfReader(BytesIO(first_pass)).pages)
    except Exception:  # pragma: no cover - malformed output is caught by validation
        page_count = 1
    return _render(spec, max(page_count, 1))
