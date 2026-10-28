"""
Payment proof verification for screenshots and bank/MoMo slips.

Extracts text from an uploaded payment proof — OCR for images, the embedded
text layer for digital PDFs (with page rendering + OCR as fallback for
scanned PDFs), plain text for .txt/.csv — and verifies that the payment
receiver is AfriTech Bridge *and* that the payment is shown as completed.
Two independent gates must both pass:

1. Receiver gate: the text must name AfriTech Bridge (or an admin-configured
   receiver) as the money's destination, tolerating OCR noise, spacing and
   dark-mode screenshots.
2. Completion gate: the text must show the transfer as completed/paid/
   successful.  Receipts that only mention the receiver — pending, failed,
   declined or not-yet-confirmed "you are about to send ..." screens — are
   rejected before they are stored, with a message that directs the
   applicant to contact the administrator if they believe it is a mistake.
"""

import io
import logging
import os
import re
import unicodedata
from difflib import SequenceMatcher

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

NOT_COMPLETED_MESSAGE = (
    "We could not confirm that this payment to AfriTech Bridge was completed — "
    "the receipt may show a pending, failed or not-yet-confirmed transaction. "
    "Please upload a receipt or screenshot that clearly shows the payment as "
    "completed or successful. "
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

# Evidence that the money actually left the sender's account (checked on the
# accent/punctuation-stripped, lowercased form produced by _normalize()).
_COMPLETION_PATTERNS = (
    r"\bpaid\b",
    r"\bcompleted\b",
    r"\bsuccessfully\b",
    r"\bsuccessful\b",
    r"\bsuccess\b",
    r"\bconfirmed\b",
    r"\bcredited\b",
    r"\btransferred\b",
)

# Evidence that the transaction did NOT go through — including initiation
# screens ("you are about to send ...", "enter your PIN") where the money
# has not yet left the account.
_INCOMPLETE_PATTERNS = (
    r"\bfailed\b",
    r"\bdeclined?\b",
    r"\bcancelled\b",
    r"\bcanceled\b",
    r"\breversed\b",
    r"\breversal\b",
    r"\brefunded\b",
    r"\bunsuccessful\b",
    r"\bnot successful\b",
    r"\bnot paid\b",
    r"\bpending\b",
    r"\bawaiting\b",
    r"\byou are about to\b",
    r"\bare you sure\b",
    r"\bconfirm transfer\b",
    r"\bconfirm sending\b",
    r"\benter (your )?(pin|password|passcode|otp)\b",
    r"\btry again\b",
)

# Accept a compacted token window as a garbled "afritechbridge" when it is
# close enough (OCR frequently turns i/l/1 and similar glyphs into each
# other, e.g. "AFRITECH BR1DGE").
_FUZZY_RECEIVER_MIN_RATIO = 0.85
_FUZZY_RECEIVER_MAX_LENGTH_DIFF = 3

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
    "afri tech bridge ltd"), in either order, and tolerates OCR character
    noise ("AFRITECH BR1DGE").  Additional admin-configured receiver names
    are accepted by normalized containment.
    """
    normalized = _normalize(text)
    if not normalized:
        return None
    compact = normalized.replace(" ", "")
    tokens = normalized.split()

    for i in range(len(tokens)):
        for width in (1, 2, 3, 4):
            if i + width > len(tokens):
                break
            window = "".join(tokens[i : i + width])
            if window == _CANONICAL_KEY or (width == 2 and window == "bridgeafritech"):
                return CANONICAL_RECEIVER
            if (
                abs(len(window) - len(_CANONICAL_KEY)) <= _FUZZY_RECEIVER_MAX_LENGTH_DIFF
                and SequenceMatcher(None, window, _CANONICAL_KEY).ratio()
                >= _FUZZY_RECEIVER_MIN_RATIO
            ):
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


def classify_payment_completion(text: str) -> str:
    """
    Classify transaction status from receipt text.

    Returns "completed", "not_completed" or "unknown".  Incomplete evidence
    wins over completion evidence so that receipts containing both (e.g. a
    failed-then-retried SMS) are never verified.
    """
    normalized = _normalize(text)
    if not normalized:
        return "unknown"
    for pattern in _INCOMPLETE_PATTERNS:
        if re.search(pattern, normalized):
            return "not_completed"
    for pattern in _COMPLETION_PATTERNS:
        if re.search(pattern, normalized):
            return "completed"
    return "unknown"


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


def _ocr_best(image) -> str:
    """
    OCR an image, handling dark-mode screenshots (white text on dark
    background) where plain Tesseract degrades.

    OCR the polarity detected from the mean brightness first; if the receiver
    is not proven from that pass, retry with the opposite polarity and keep
    whichever pass proves the receiver (or, failing that, the longer text).
    """
    from PIL import ImageOps, ImageStat

    if image.mode not in ("L", "RGB"):
        image = image.convert("RGB")
    image = ImageOps.exif_transpose(image)

    mean_brightness = ImageStat.Stat(ImageOps.grayscale(image)).mean[0]
    if mean_brightness < 128:
        primary, secondary = ImageOps.invert(image), image
    else:
        primary, secondary = image, ImageOps.invert(image)

    text = _ocr_image(primary)
    if find_receiver_in_text(text):
        return text
    alternate = _ocr_image(secondary)
    if find_receiver_in_text(alternate):
        return alternate
    return text if len(text.strip()) >= len(alternate.strip()) else alternate


def _extract_image_text(file_bytes: bytes) -> str:
    from PIL import Image

    with Image.open(io.BytesIO(file_bytes)) as img:
        return _ocr_best(img)


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
    return "\n".join(_ocr_best(page) for page in pages)


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
    Verify that a payment proof shows AfriTech Bridge as the receiver and the
    transaction as completed.

    Returns {"verified": bool, "reason": str, "engine": str|None,
             "matched_receiver": str|None, "message": str|None}.
    Unverified uploads carry a rejection message so the route can surface the
    "contact the administrator" guidance directly to the applicant:
    REJECTION_MESSAGE when the receiver (or the text itself) is not proven,
    NOT_COMPLETED_MESSAGE when the receipt shows a pending/failed/unconfirmed
    transaction or no completion evidence at all.
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
    if not matched:
        return {
            "verified": False,
            "reason": "receiver_not_proven",
            "engine": extraction.get("engine"),
            "matched_receiver": None,
            "message": REJECTION_MESSAGE,
        }

    completion = classify_payment_completion(extraction["text"])
    if completion == "completed":
        return {
            "verified": True,
            "reason": "payment_verified",
            "engine": extraction.get("engine"),
            "matched_receiver": matched,
            "message": None,
        }

    return {
        "verified": False,
        "reason": (
            "payment_not_completed" if completion == "not_completed"
            else "completion_not_proven"
        ),
        "engine": extraction.get("engine"),
        "matched_receiver": None,
        "message": NOT_COMPLETED_MESSAGE,
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
