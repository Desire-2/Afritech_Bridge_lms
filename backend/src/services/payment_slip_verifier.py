"""
Payment proof verification for screenshots and bank/MoMo slips.

Extracts text from an uploaded payment proof — OCR for images, the embedded
text layer for digital PDFs (with page rendering + OCR as fallback for
scanned PDFs), plain text for .txt/.csv — and verifies that the payment
receiver is AfriTech Bridge *and* that the payment is shown as completed.
Two independent gates must both pass:

1. Receiver gate: the text must prove AfriTech Bridge as the money's
   destination — by company name (after the receiver marker "to", as a
   standalone mention, or with OCR noise), by the MoMo pay code
   2138467, or by the bank account number 1002669565578.
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
import shutil
import threading
import unicodedata
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)

# Canonical receiver every accepted receipt must name.
CANONICAL_RECEIVER = "AfriTech Bridge"
_CANONICAL_KEY = "afritechbridge"

# Company account identifiers that prove the money is destined for AfriTech
# Bridge on their own (MoMo pay code / bank account number).  Extendable
# without a deploy via PAYMENT_MOMO_CODES / PAYMENT_BANK_RECEIVER_ACCOUNTS
# (comma-separated digits).
MOMO_RECEIVER_CODES = ("2138467",)
BANK_RECEIVER_ACCOUNTS = ("1002669565578",)

REJECTION_MESSAGE = (
    "We could not verify that this payment was made to AfriTech Bridge, so the "
    "payment proof was rejected and was not saved. Please upload a clear receipt "
    "or screenshot showing AfriTech Bridge as the payment receiver — accepted "
    "proofs show the name \"AFRITECH BRIDGE\" (for example after the word \"to\"), "
    "the MoMo pay code 2138467, or the bank account number 1002669565578. "
    "If you believe this is a mistake, please contact the administrator."
)

NOT_COMPLETED_MESSAGE = (
    "We could not confirm that this payment to AfriTech Bridge was completed — "
    "the receipt may show a pending, failed or not-yet-confirmed transaction. "
    "Please upload a receipt or screenshot that clearly shows the payment as "
    "completed or successful. "
    "If you believe this is a mistake, please contact the administrator."
)

OCR_UNAVAILABLE_MESSAGE = (
    "Automatic verification of payment proofs is temporarily unavailable, so "
    "your receipt was not saved. Please try again later. "
    "If this is urgent, please contact the administrator."
)

IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff", "gif", "heic", "heif"}
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

# Rendering/OCR budget.  Payment slips arrive as full-resolution phone
# photos (12-48 MP); decoding and OCR-ing them raw is what OOM-killed
# gunicorn workers in production ("Worker was sent SIGKILL").  Every raster
# handed to tesseract is therefore capped at _OCR_MAX_EDGE per side in 8-bit
# grayscale, PDFs render at _OCR_DPI, and only one tesseract process runs
# per worker process at a time (_OCR_LOCK bounds peak memory under threaded
# gunicorn).
_OCR_DPI = 150
_OCR_TIMEOUT_SECONDS = 30
_OCR_MAX_PDF_PAGES = 3
_OCR_MAX_EDGE = 2200
_OCR_LOCK = threading.Lock()
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


def _configured_account_numbers(defaults, env_var: str) -> tuple:
    """Company account numbers: baked-in defaults plus env-var extras."""
    extras = [
        item.strip()
        for item in os.getenv(env_var, "").split(",")
        if item.strip().isdigit()
    ]
    return tuple(dict.fromkeys(tuple(defaults) + tuple(extras)))


def _digits_prove_receiver(normalized: str, raw_text: str, numbers: tuple) -> bool:
    """
    True when one of `numbers` appears as a standalone number in the text.

    Guards against partial hits: 21384670 or 11002669565578 must never match
    2138467 / 1002669565578.  Checks both the normalized text (spaces kept)
    and whole digit groups of the raw text (tolerates "10 026 695 65578"
    style grouping only when groups are exactly the number).
    """
    raw_groups = re.findall(r"\d+", raw_text or "")
    for number in numbers:
        if re.search(rf"(?<!\d){re.escape(number)}(?!\d)", normalized):
            return True
        if number in raw_groups:
            return True
    return False


def find_receiver_in_text(text: str, expected_receiver_names=None):
    """
    Return the receiver name proven by `text`, or None.

    Proof of receiver, strongest first:
      1. "to <AfriTech Bridge>" — the receipt marker for the money's
         destination ("paid to AFRITECH BRIDGE", "To: AFRITECH-BRIDGE").
      2. "AfriTech Bridge" as adjacent words in any order, tolerating
         spacing/punctuation variants and OCR character noise.
      3. The MoMo pay code or bank account number (standalone digit run).
      4. Admin-configured receiver names by normalized containment.
    """
    normalized = _normalize(text)
    if not normalized:
        return None
    compact = normalized.replace(" ", "")
    tokens = normalized.split()

    # Receipts denote the receiver with "to <name>" — anchor on it first.
    if re.search(r"\bto\s+afri\s*tech\s*bridge\b", normalized):
        return CANONICAL_RECEIVER

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

    momo_codes = _configured_account_numbers(MOMO_RECEIVER_CODES, "PAYMENT_MOMO_CODES")
    bank_accounts = _configured_account_numbers(BANK_RECEIVER_ACCOUNTS, "PAYMENT_BANK_RECEIVER_ACCOUNTS")
    if _digits_prove_receiver(normalized, text, momo_codes + bank_accounts):
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


def _prepare_ocr_image(image):
    """
    Bound the memory a receipt may use before OCR sees it.

    JPEG drafts decode at a reduced DCT scale (up to 8x fewer pixels — the
    difference between a 100 MB spike and a few MB for phone photos), the
    raster is capped at _OCR_MAX_EDGE per side, everything runs as 8-bit
    grayscale (1/3 the tesseract working set of RGB), and tiny crops are
    only upscaled by a small, bounded factor.
    """
    from PIL import Image, ImageOps

    try:
        image.draft("RGB", (_OCR_MAX_EDGE, _OCR_MAX_EDGE))
    except Exception:
        pass

    if image.mode not in ("L", "RGB"):
        image = image.convert("RGB")
    image = ImageOps.exif_transpose(image)
    if max(image.size) > _OCR_MAX_EDGE or image.width * image.height > _MAX_IMAGE_PIXELS:
        image.thumbnail((_OCR_MAX_EDGE, _OCR_MAX_EDGE), Image.Resampling.LANCZOS)

    gray = ImageOps.grayscale(image)
    width, height = gray.size
    if min(width, height) < _MIN_OCR_DIMENSION and width * height < 1_200_000:
        scale = min(3, max(2, int(_MIN_OCR_DIMENSION / max(1, min(width, height))) + 1))
        resized = (width * scale, height * scale)
        if max(resized) <= 3600 and resized[0] * resized[1] <= 8_000_000:
            gray = gray.resize(resized, Image.Resampling.LANCZOS)
    return gray


def _tesseract_read(image) -> str:
    """Run tesseract once, serialized process-wide to bound peak memory."""
    import pytesseract

    with _OCR_LOCK:
        return pytesseract.image_to_string(
            image, lang="eng", config="--psm 6", timeout=_OCR_TIMEOUT_SECONDS
        )


def _ocr_image(image) -> str:
    prepared = _prepare_ocr_image(image)
    try:
        return _tesseract_read(prepared)
    finally:
        prepared.close()


def _ocr_best(image) -> str:
    """
    OCR an image, handling dark-mode screenshots (white text on dark
    background) where plain Tesseract degrades.

    OCR the polarity detected from the mean brightness first; if the receiver
    is not proven from that pass, retry with the opposite polarity and keep
    whichever pass proves the receiver (or, failing that, the longer text).
    Both passes share one bounded grayscale base image.
    """
    from PIL import ImageOps, ImageStat

    base = _prepare_ocr_image(image)
    inverted = None
    try:
        if ImageStat.Stat(base).mean[0] < 128:
            inverted = ImageOps.invert(base)
            primary, secondary = inverted, base
        else:
            primary, secondary = base, None

        text = _tesseract_read(primary)
        if find_receiver_in_text(text):
            return text

        if secondary is None:
            inverted = ImageOps.invert(base)
            secondary = inverted
        alternate = _tesseract_read(secondary)
        if find_receiver_in_text(alternate):
            return alternate
        return text if len(text.strip()) >= len(alternate.strip()) else alternate
    finally:
        base.close()
        if inverted is not None and inverted is not base:
            inverted.close()


_OCR_MISSING_ERROR = "ocr_engine_unavailable"


def _missing_ocr_engine_error():
    """
    Return an extraction error when OCR cannot run in this environment.

    Image receipts and scanned PDFs need the system tesseract binary; it is
    present on machines with apt (local dev, Docker) but not on Render's
    native runtime, which cannot install system packages.  Returning a
    sentinel lets verify_payment_slip explain the outage honestly instead of
    blaming the receipt.
    """
    if shutil.which("tesseract"):
        return None
    return _OCR_MISSING_ERROR


def _extract_image_text(file_bytes: bytes) -> str:
    from PIL import Image

    # Pillow then refuses decompression bombs (raising, not eating the whole
    # container RAM) beyond twice this budget; the error surfaces as a normal
    # extraction failure instead of an OOM-killed worker.
    Image.MAX_IMAGE_PIXELS = _MAX_IMAGE_PIXELS

    try:
        from pillow_heif import register_heif_opener

        register_heif_opener()
    except ImportError:
        pass

    with Image.open(io.BytesIO(file_bytes)) as img:
        return _ocr_best(img)


def _extract_pdf_text_layer(file_bytes: bytes) -> str:
    """Embedded text of a digital PDF; "" when absent/unreadable."""
    try:
        import PyPDF2

        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        parts = []
        for page in reader.pages[:_OCR_MAX_PDF_PAGES]:
            parts.append(page.extract_text() or "")
        return "\n".join(parts).strip()
    except Exception as exc:
        logger.warning(f"PDF text-layer extraction failed, falling back to OCR: {exc}")
        return ""


def _ocr_pdf_pages(file_bytes: bytes) -> str:
    """Render the first pages of a scanned PDF (needs poppler) and OCR them."""
    from pdf2image import convert_from_bytes

    pages = convert_from_bytes(
        file_bytes,
        dpi=_OCR_DPI,
        first_page=1,
        last_page=_OCR_MAX_PDF_PAGES,
        fmt="jpeg",
        timeout=_OCR_TIMEOUT_SECONDS,
    )
    texts = []
    try:
        for page in pages:
            texts.append(_ocr_best(page))
    finally:
        for page in pages:
            try:
                page.close()
            except Exception:
                pass
    return "\n".join(texts)


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
            engine_error = _missing_ocr_engine_error()
            if engine_error:
                return {"ok": False, "text": "", "engine": "ocr", "error": engine_error}
            return {"ok": True, "text": _extract_image_text(file_bytes), "engine": "ocr", "error": None}

        if ext in PDF_EXTENSIONS or content_type == "application/pdf":
            text = _extract_pdf_text_layer(file_bytes)
            if text:
                return {"ok": True, "text": text, "engine": "pdf-text-layer", "error": None}
            engine_error = _missing_ocr_engine_error()
            if engine_error:
                return {"ok": False, "text": "", "engine": "pdf-scanned-ocr", "error": engine_error}
            return {"ok": True, "text": _ocr_pdf_pages(file_bytes), "engine": "pdf-scanned-ocr", "error": None}

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
    transaction or no completion evidence at all,
    OCR_UNAVAILABLE_MESSAGE (reason ocr_engine_unavailable) when the server
    is missing its OCR engine — an outage, not a bad receipt.
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
        error = (extraction.get("error") or "")
        if error == _OCR_MISSING_ERROR or "poppler" in error.lower():
            logger.warning(
                f"Payment proof OCR engine unavailable (file={filename}, error={error})"
            )
            return {
                "verified": False,
                "reason": "ocr_engine_unavailable",
                "engine": extraction.get("engine"),
                "matched_receiver": None,
                "message": OCR_UNAVAILABLE_MESSAGE,
            }
        logger.warning(
            f"Payment proof could not be read (file={filename}, error={error})"
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
