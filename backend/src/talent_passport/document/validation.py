"""Automated structural validation of generated PDF bytes."""

from __future__ import annotations

from io import BytesIO
from typing import Any, Dict, Optional

from PyPDF2 import PdfReader

from .spec import DocumentSpec
from .tokens import PAGE_HEIGHT, PAGE_WIDTH


def validate_pdf(data: bytes, spec: Optional[DocumentSpec] = None) -> Dict[str, Any]:
    """Fail closed when a generated PDF violates the fixed document contract."""
    if not data or not data.startswith(b"%PDF"):
        raise ValueError("Renderer did not produce a PDF")
    try:
        reader = PdfReader(BytesIO(data))
        pages = reader.pages
        page_count = len(pages)
        if page_count < 2:
            raise ValueError("A professional document requires a cover and content page")

        for index, page in enumerate(pages, start=1):
            box = page.mediabox
            width = float(box.width)
            height = float(box.height)
            if abs(width - PAGE_WIDTH) > 1 or abs(height - PAGE_HEIGHT) > 1:
                raise ValueError(
                    f"Page {index} is not A4 portrait ({width:.1f} x {height:.1f} pt)"
                )

        extracted = "\n".join((page.extract_text() or "") for page in pages)
        upper = extracted.upper()
        if "TALENT PASSPORT" not in upper:
            raise ValueError("Searchable text is missing the document title")
        if spec is not None and spec.document_ref.upper() not in upper:
            raise ValueError("Searchable text is missing the document reference")

        raw = data
        if b"/FontFile2" not in raw and b"/FontFile3" not in raw:
            raise ValueError("No embedded font program was found")
        if b"/URI" not in raw:
            raise ValueError("No hyperlink annotation was found")
        if b"/Subtype /Image" not in raw:
            raise ValueError("No embedded image was found (logo/QR)")

        link_count = 0
        for page in pages:
            for annotation in page.get("/Annots", []) or []:
                obj = annotation.get_object()
                action = obj.get("/A")
                if action and action.get_object().get("/URI"):
                    link_count += 1
        if link_count < 1:
            raise ValueError("No working hyperlink annotation was found")

        return {
            "pages": page_count,
            "page_size_pt": [round(PAGE_WIDTH, 2), round(PAGE_HEIGHT, 2)],
            "embedded_fonts": True,
            "hyperlinks": link_count,
            "embedded_images": raw.count(b"/Subtype /Image"),
            "text_characters": len(extracted),
        }
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError(f"PDF validation failed: {exc}") from exc
