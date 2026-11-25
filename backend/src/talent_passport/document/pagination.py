"""Content-aware A4 pagination.

The engine places measured blocks into a fixed content frame. It never reduces
font sizes, scales pages or converts content to an image. Oversized atomic
cards move to the next page; long text blocks require at least two lines before
a break so orphaned single lines are avoided.
"""

from __future__ import annotations

from . import tokens as t
from .blocks import Block
from .primitives import draw_page_footer, draw_page_header
from .spec import DocumentSpec


class FlowEngine:
    def __init__(self, canvas, spec: DocumentSpec, total_pages: int):
        self.canvas = canvas
        self.spec = spec
        self.total_pages = total_pages
        self.page_no = 2  # page 1 is the signature cover
        self.top = t.CONTENT_TOP
        self._start_page()

    def _start_page(self) -> None:
        draw_page_header(self.canvas, self.spec, self.page_no, self.total_pages)
        self.top = t.CONTENT_TOP

    def finish(self) -> None:
        draw_page_footer(self.canvas, self.spec, self.page_no, self.total_pages)
        self.canvas.showPage()

    def new_page(self) -> None:
        draw_page_footer(self.canvas, self.spec, self.page_no, self.total_pages)
        self.canvas.showPage()
        self.page_no += 1
        self._start_page()

    def place(self, block: Block) -> None:
        height = block.measure(t.CONTENT_WIDTH)
        min_height = float(getattr(block, "min_height", 0) or 0)

        if self.top - height < t.CONTENT_BOTTOM:
            self.new_page()
            height = block.measure(t.CONTENT_WIDTH)
        elif min_height and self.top - min_height < t.CONTENT_BOTTOM:
            self.new_page()
            height = block.measure(t.CONTENT_WIDTH)

        # ``self.top`` is maintained in ReportLab's bottom-based coordinates,
        # while every Block.draw() implementation expects a top-based ``top``.
        # Convert here so blocks flow from the top of the content frame down and
        # section headings print above their content.
        block.draw(self.canvas, t.MARGIN_X, t.PAGE_HEIGHT - self.top, t.CONTENT_WIDTH)
        self.top -= height + t.GAP_SMALL
