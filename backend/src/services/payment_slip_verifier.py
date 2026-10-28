"""
Payment proof verification for screenshots and bank/MoMo slips.

Extracts text from an uploaded payment proof — OCR for images, the embedded
text layer for digital PDFs (with page rendering + OCR as fallback for
scanned PDFs), plain text for .txt/.csv — and verifies that the payment
receiver is AfriTech Bridge.  Uploads that cannot be proven to be paid to
AfriTech Bridge are rejected before they are stored, with a message that
directs the applicant to contact the administrator if they believe it is a
mistake.
"""

import io
import logging
import os
import re
import unicodedata

logger = logging.getLogger(__name__)

# Canonical receiver every accepted receipt must name.
CANONICAL_RECEIVER = "AfriTech Bridge"
_CANONICAL_KEY = "afritechbridge"

REJECTION_MESSAGE = (
    "We could not verify that this payment was made to AfriTech Bridge, so the "
    "payment proof was rejected and was not saved. Please upload a clear receipt "
    "or screenshot that shows AfriTech Bridge as the payment receiver. "
    "If you believe this is a mistake, please contact the administrator."
)

IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff", "gif"}
PDF_EXTENSIONS = {"pdf"}
TEXT_EXTENSIONS = {"txt", "csv"}

# Mobile-network / wallet names that must never count as a receiver identity
# when they appear as a configured recipient (they name the network, not us).
_GENERIC_RECEIVER_NAMES = {
    "mtn momo", "momo", "mtn cash", "mtn", "airtel money", "airtel",
    "mpesa", "m pesa", "orange money", "spenn", "tigo cash",
}

_OCR_DPI = 200
_OCR_TIMEOUT_SECONDS = 30
_OCR_MAX_PDF_PAGES = 3
_MAX_IMAGE_PIXELS = 40_000_000
_MIN_OCR_DIMENSION = 500


def _file_extension(filename: str) -> str:
    if not filename or "." not in filename:
        return ""
    return filename.rsplit(".", 1)[-1].lower()


def _normalize(text: str) -> str:
    """Lowercase, strip accents/punctuation, collapse whitespace."""
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", str(text))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def find_receiver_in_text(text: str, expected_receiver_names=None):
    """
    Return the receiver name proven by `text`, or None.

    The canonical match looks for "AfriTech Bridge" as adjacent words
    (tolerating spacing/punctuation variants such as "AFRITECH-BRIDGE" or
    "afri tech bridge ltd"), in either order.  Additional admin-configured
    receiver names are accepted by normalized containment.
    """
    normalized = _normalize(text)
    if not normalized:
        return None
    compact = normalized.replace(" ", "")
    tokens = normalized.split()

    for i in range(len(tokens)):
        for width in (1, 2, 3):
            if i + width > len(tokens):
                break
            window = "".join(tokens[i : i + width])
            if window == _CANONICAL_KEY:
                return CANONICAL_RECEIVER
            if width == 2 and window == "bridgeafritech":
                return CANONICAL_RECEIVER

    for name in expected_receiver_names or []:
        if not name:
            continue
        norm_name = _normalize(name)
        if len(norm_name.replace(" ", "")) < 4 or norm_name in _GENERIC_RECEIVER_NAMES:
            continue
        if norm_name.replace(" ", "") in compact:
            return str(name).strip()

    return None


def _ocr_image(image) -> str:
    import pytesseract
    from PIL import ImageOps

    if image.mode not in ("L", "RGB"):
        image = image.convert("RGB")
    image = ImageOps.exif_transpose(image)

    width, height = image.size
    if width * height > _MAX_IMAGE_PIXELS:
        image.thumbnail((4000, 4000))
    if min(image.size) < _MIN_OCR_DIMENSION:
        scale = max(2, int(_MIN_OCR_DIMENSION / max(1, min(image.size))) + 1)
        image = image.resize((image.width * scale, image.height * scale))

    return pytesseract.image_to_string(
        image, lang="eng", config="--psm 6", timeout=_OCR_TIMEOUT_SECONDS
    )


def _extract_image_text(file_bytes: bytes) -> str:
    from PIL import Image

    with Image.open(io.BytesIO(file_bytes)) as img:
        return _ocr_image(img)


def _extract_pdf_text(file_bytes: bytes) -> str:
    # Prefer the embedded text layer (digital receipts / gateway PDFs).
    try:
        import PyPDF2

        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        parts = []
        for page in reader.pages[:_OCR_MAX_PDF_PAGES]:
            parts.append(page.extract_text() or "")
        joined = "\n".join(parts).strip()
        if joined:
            return joined
    except Exception as exc:
        logger.warning(f"PDF text-layer extraction failed, falling back to OCR: {exc}")

    # Scanned PDF: render the first pages and OCR them.
    from pdf2image import convert_from_bytes

    pages = convert_from_bytes(
        file_bytes,
        dpi=_OCR_DPI,
        first_page=1,
        last_page=_OCR_MAX_PDF_PAGES,
        timeout=_OCR_TIMEOUT_SECONDS,
    )
    return "\n".join(_ocr_image(page) for page in pages)


def extract_text(file_bytes: bytes, filename: str = "", content_type: str = "") -> dict:
    """
    Extract readable text from a payment proof of any supported format.

    Returns {"ok": bool, "text": str, "engine": str|None, "error": str|None}.
    """
    if not file_bytes:
        return {"ok": False, "text": "", "engine": None, "error": "empty_file"}

    ext = _file_extension(filename)
    content_type = (content_type or "").lower()

    try:
        if ext in TEXT_EXTENSIONS or content_type.startswith("text/"):
            encoding = "utf-8"
            try:
                text = file_bytes.decode(encoding)
            except UnicodeDecodeError:
                encoding = "latin-1"
                text = file_bytes.decode(encoding, errors="replace")
            return {"ok": True, "text": text, "engine": f"text:{encoding}", "error": None}

        if ext in IMAGE_EXTENSIONS or content_type.startswith("image/"):
            return {"ok": True, "text": _extract_image_text(file_bytes), "engine": "ocr", "error": None}

        if ext in PDF_EXTENSIONS or content_type == "application/pdf":
            engine = "pdf-text-layer"
            text = _extract_pdf_text(file_bytes)
            if not text.strip():
                engine = "pdf-scanned-ocr"
            return {"ok": True, "text": text, "engine": engine, "error": None}

        return {
            "ok": False,
            "text": "",
            "engine": None,
            "error": f"unsupported_file_type: {ext or content_type or 'unknown'}",
        }
    except Exception as exc:
        logger.warning(f"Payment proof text extraction failed ({filename}): {exc}")
        return {"ok": False, "text": "", "engine": None, "error": str(exc)}


def verify_payment_slip(file_bytes: bytes, filename: str = "", content_type: str = "",
                        expected_receiver_names=None) -> dict:
    """
    Verify that a payment proof shows AfriTech Bridge as the receiver.

    Returns {"verified": bool, "reason": str, "engine": str|None,
             "matched_receiver": str|None, "message": str|None}.
    Unverified uploads carry REJECTION_MESSAGE so the route can surface the
    "contact the administrator" guidance directly to the applicant.
    Disabled with PAYMENT_SLIP_VERIFICATION=false (ops escape hatch).
    """
    if os.getenv("PAYMENT_SLIP_VERIFICATION", "true").strip().lower() in ("0", "false", "off", "no", "disabled"):
        return {
            "verified": True,
            "reason": "verification_disabled",
            "engine": None,
            "matched_receiver": None,
            "message": None,
        }

    extraction = extract_text(file_bytes, filename=filename, content_type=content_type)
    if not extraction["ok"]:
        logger.warning(
            f"Payment proof could not be read (file={filename}, error={extraction.get('error')})"
        )
        return {
            "verified": False,
            "reason": "text_extraction_failed",
            "engine": extraction.get("engine"),
            "matched_receiver": None,
            "message": REJECTION_MESSAGE,
        }

    if not extraction["text"].strip():
        return {
            "verified": False,
            "reason": "no_text_found",
            "engine": extraction.get("engine"),
            "matched_receiver": None,
            "message": REJECTION_MESSAGE,
        }

    matched = find_receiver_in_text(extraction["text"], expected_receiver_names)
    if matched:
        return {
            "verified": True,
            "reason": "receiver_matched",
            "engine": extraction.get("engine"),
            "matched_receiver": matched,
            "message": None,
        }

    return {
        "verified": False,
        "reason": "receiver_not_proven",
        "engine": extraction.get("engine"),
        "matched_receiver": None,
        "message": REJECTION_MESSAGE,
    }


def receiver_names_for_course(course) -> list:
    """Canonical receiver plus the course's configured recipient name."""
    names = [CANONICAL_RECEIVER]
    configured = (getattr(course, "momo_recipient_name", None) or "").strip() if course else ""
    if configured:
        norm = _normalize(configured)
        if len(norm.replace(" ", "")) >= 4 and norm not in _GENERIC_RECEIVER_NAMES:
            names.append(configured)
    return names
