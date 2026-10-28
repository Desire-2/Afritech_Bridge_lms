"""Tests for payment slip/screenshot verification (OCR + receiver + completion).

Uploads whose extracted text does not prove AfriTech Bridge as the payment
receiver, or that do not show the transaction as completed, must be rejected
with a contact-the-administrator message and must not touch the application
record.
"""

import io
import uuid

import pytest
from flask_jwt_extended import create_access_token
from PIL import Image, ImageDraw, ImageFont

from src.models.course_application import CourseApplication
from src.models.course_models import Course
from src.models.user_models import User, Role, db
from src.services.payment_slip_verifier import (
    NOT_COMPLETED_MESSAGE,
    OCR_UNAVAILABLE_MESSAGE,
    REJECTION_MESSAGE,
    classify_payment_completion,
    extract_text,
    find_receiver_in_text,
    verify_payment_slip,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_RECEIPT_FONT = ImageFont.truetype(
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 34
)


def _render_receipt_png(text: str, background, foreground) -> bytes:
    import textwrap

    lines = []
    for paragraph in text.split("\n"):
        lines.extend(textwrap.wrap(paragraph, width=40) or [""])
    width = 900
    height = 60 + len(lines) * 50 + 30
    img = Image.new("RGB", (width, height), background)
    draw = ImageDraw.Draw(img)
    y = 40
    for line in lines:
        draw.text((40, y), line, fill=foreground, font=_RECEIPT_FONT)
        y += 50
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def make_receipt_png(text: str) -> bytes:
    return _render_receipt_png(text, "white", "black")


def make_dark_receipt_png(text: str) -> bytes:
    """Dark-mode screenshot: white text on near-black background."""
    return _render_receipt_png(text, (18, 24, 38), (240, 244, 248))


def make_pdf_with_text(text: str) -> bytes:
    content = f"BT /F1 24 Tf 72 700 Td ({text}) Tj ET".encode("latin-1")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref_pos = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode() + b"0000000000 65535 f \n"
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_pos}\n%%EOF"
    ).encode()
    return bytes(out)


# ---------------------------------------------------------------------------
# Receiver matching (unit)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("text", [
    "Receiver: AFRITECH BRIDGE",
    "paid to afritech bridge ltd",
    "To: AfriTechBridge",
    "To: AFRITECH-BRIDGE",
    "beneficiary: afri tech bridge",
    "Bridge AfriTech received 50 USD",
    "TRANSACTION TO AFRITECH BRIDGE COMPLETED",
    "Your payment of 10,000 RWF to AFRITECH BR1DGE 2138467 was completed",
    "AFRITECH BRIDGE 2138467",
])
def test_canonical_receiver_variants_match(text):
    assert find_receiver_in_text(text) == "AfriTech Bridge"


@pytest.mark.parametrize("text", [
    "Payment to JOHN DOE STORE",
    "Receiver: MTN MoMo",
    "Paid to Example Vendor Ltd",
    "afritech sent the money",
    "",
])
def test_non_receiver_text_never_matches(text):
    assert find_receiver_in_text(text) is None


def test_custom_receiver_name_matches_by_containment():
    assert find_receiver_in_text(
        "Receiver: Kigali Payments Ltd", ["Kigali Payments Ltd"]
    ) == "Kigali Payments Ltd"


def test_generic_custom_names_are_ignored():
    # "MTN MoMo" names the network, not the receiver — never accepted.
    assert find_receiver_in_text("Receiver: MTN MoMo", ["MTN MoMo"]) is None


# ---------------------------------------------------------------------------
# Receiver proof: "to" marker + company account numbers
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("text", [
    "Payment completed to AFRITECH BRIDGE",
    "Transfer To:\nAFRITECH BRIDGE",
    "You have paid 10,000 RWF to afri tech bridge",
    "Credit to AFRITECH-BRIDGE",
])
def test_to_anchored_receiver_pattern(text):
    assert find_receiver_in_text(text) == "AfriTech Bridge"


@pytest.mark.parametrize("text", [
    "Y'ello. Your payment of 10,000 RWF to 2138467 was completed at 2026-10-28",
    "MoMo Pay Code 2138467 — payment completed",
])
def test_momo_pay_code_proves_receiver(text):
    assert find_receiver_in_text(text) == "AfriTech Bridge"


@pytest.mark.parametrize("text", [
    "Beneficiary account: 1002669565578 — payment completed",
    "Transfer to account 1002669565578 completed",
])
def test_bank_account_proves_receiver(text):
    assert find_receiver_in_text(text) == "AfriTech Bridge"


@pytest.mark.parametrize("text", [
    "Available balance: 21384670 RWF",
    "account 11002669565578",
    "Transaction ID 1213846799",
])
def test_partial_digit_runs_never_prove_receiver(text):
    assert find_receiver_in_text(text) is None


def test_momo_codes_extensible_via_env(monkeypatch):
    monkeypatch.setenv("PAYMENT_MOMO_CODES", "999888777")
    assert find_receiver_in_text("payment of 5000 RWF to 999888777") == "AfriTech Bridge"


# ---------------------------------------------------------------------------
# Text extraction across formats (unit)
# ---------------------------------------------------------------------------

def test_extract_text_from_txt():
    result = extract_text(b"Receiver: AfriTech Bridge", "note.txt", "text/plain")
    assert result["ok"] is True
    assert "AfriTech Bridge" in result["text"]
    assert result["engine"].startswith("text:")


def test_extract_text_from_png_via_ocr():
    png = make_receipt_png("Receipt\nReceiver: AFRITECH BRIDGE\nAmount: 50 USD")
    result = extract_text(png, "receipt.png", "image/png")
    assert result["ok"] is True
    assert result["engine"] == "ocr"
    assert find_receiver_in_text(result["text"]) == "AfriTech Bridge"


def test_extract_text_from_pdf_text_layer():
    pdf = make_pdf_with_text("Receipt: paid to AfriTech Bridge")
    result = extract_text(pdf, "receipt.pdf", "application/pdf")
    assert result["ok"] is True
    assert result["engine"] == "pdf-text-layer"


def test_unsupported_format_fails_extraction():
    result = extract_text(b"MZ\x90\x00", "slip.exe", "application/octet-stream")
    assert result["ok"] is False


# ---------------------------------------------------------------------------
# Completion classification (unit)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("text", [
    # Real MTN MoMo SMS as seen in production screenshots.
    "Y'ello. You have paid 10,000 RWF to AFRITECH BRIDGE, 2138467. "
    "Fee 0 RWF. Transaction ID 28678300433.",
    # Real payment-completed SMS.
    "Your payment of 10.000 RWF to AFRITECH BRIDGE 2138467 was completed at "
    "2026-08-03 12:07:57. Balance: 13,225 RWF. Fee 0 RWF.",
    "Payment successful",
    "Transfer confirmed",
    "Amount credited to beneficiary",
])
def test_completion_classified_as_completed(text):
    assert classify_payment_completion(text) == "completed"


@pytest.mark.parametrize("text", [
    "Payment of 50 USD to AFRITECH BRIDGE is pending confirmation",
    "Your payment to AFRITECH BRIDGE failed. Please try again.",
    "Transaction declined",
    "You are about to send 10,000 RWF to AFRITECH BRIDGE.",
    "Enter your PIN to confirm sending 10,000 RWF to AFRITECH BRIDGE",
    "Payment was reversed",
])
def test_completion_classified_as_not_completed(text):
    assert classify_payment_completion(text) == "not_completed"


@pytest.mark.parametrize("text", [
    "AFRITECH BRIDGE 2138467\nAvailable balance: 5,000 RWF",
    "Receipt\nReceiver: AFRITECH BRIDGE",
    "",
])
def test_completion_classified_as_unknown(text):
    assert classify_payment_completion(text) == "unknown"


# ---------------------------------------------------------------------------
# Full verification (unit)
# ---------------------------------------------------------------------------

def test_verification_rejects_wrong_receiver_image():
    png = make_receipt_png("Receipt\nReceiver: JOHN DOE STORE")
    verdict = verify_payment_slip(png, "receipt.png", "image/png")
    assert verdict["verified"] is False
    assert verdict["reason"] == "receiver_not_proven"
    assert "contact the administrator" in verdict["message"]


def test_verification_accepts_afritech_receiver_image():
    png = make_receipt_png(
        "Receipt\nYou have paid 50 USD to AFRITECH BRIDGE\nTransaction ID 123456"
    )
    verdict = verify_payment_slip(png, "receipt.png", "image/png")
    assert verdict["verified"] is True
    assert verdict["reason"] == "payment_verified"
    assert verdict["matched_receiver"] == "AfriTech Bridge"


def test_verification_accepts_completed_momo_sms():
    png = make_receipt_png(
        "Your payment of 10,000 RWF to AFRITECH BRIDGE 2138467 was completed "
        "at 2026-08-03 12:07:57. Fee 0 RWF."
    )
    verdict = verify_payment_slip(png, "receipt.png", "image/png")
    assert verdict["verified"] is True
    assert verdict["matched_receiver"] == "AfriTech Bridge"


def test_verification_accepts_dark_mode_screenshot():
    png = make_dark_receipt_png(
        "Y'ello. You have paid 10,000 RWF to AFRITECH BRIDGE, 2138467. "
        "Fee 0 RWF. Transaction ID 28678300433."
    )
    verdict = verify_payment_slip(png, "screenshot.png", "image/png")
    assert verdict["verified"] is True
    assert verdict["matched_receiver"] == "AfriTech Bridge"


def test_verification_rejects_pending_payment():
    png = make_receipt_png(
        "Payment of 10,000 RWF to AFRITECH BRIDGE is pending confirmation"
    )
    verdict = verify_payment_slip(png, "receipt.png", "image/png")
    assert verdict["verified"] is False
    assert verdict["reason"] == "payment_not_completed"
    assert "contact the administrator" in verdict["message"]


def test_verification_rejects_failed_payment():
    png = make_receipt_png(
        "Your payment to AFRITECH BRIDGE failed. Please try again."
    )
    verdict = verify_payment_slip(png, "receipt.png", "image/png")
    assert verdict["verified"] is False
    assert verdict["reason"] == "payment_not_completed"
    assert verdict["message"] == NOT_COMPLETED_MESSAGE


def test_verification_rejects_not_yet_confirmed_transfer_screen():
    png = make_receipt_png(
        "You are about to send 10,000 RWF to AFRITECH BRIDGE. "
        "Enter your PIN to confirm."
    )
    verdict = verify_payment_slip(png, "screenshot.png", "image/png")
    assert verdict["verified"] is False
    assert verdict["reason"] == "payment_not_completed"


def test_verification_rejects_receiver_without_completion_evidence():
    png = make_receipt_png(
        "AFRITECH BRIDGE 2138467\nAvailable balance: 5,000 RWF"
    )
    verdict = verify_payment_slip(png, "screenshot.png", "image/png")
    assert verdict["verified"] is False
    assert verdict["reason"] == "completion_not_proven"
    assert verdict["message"] == NOT_COMPLETED_MESSAGE


def test_verification_accepts_momo_code_only_receipt():
    proof = (
        "Y'ello. Your payment of 10,000 RWF to 2138467 was completed "
        "at 2026-10-28 12:07:57. Fee 0 RWF."
    )
    verdict = verify_payment_slip(proof.encode(), "sms.txt", "text/plain")
    assert verdict["verified"] is True
    assert verdict["matched_receiver"] == "AfriTech Bridge"


def test_verification_accepts_bank_account_receipt():
    proof = (
        "Bank transfer receipt\nBeneficiary account: 1002669565578\n"
        "Payment of 500,000 RWF was completed"
    )
    verdict = verify_payment_slip(proof.encode(), "slip.txt", "text/plain")
    assert verdict["verified"] is True
    assert verdict["matched_receiver"] == "AfriTech Bridge"


def test_verification_rejects_pending_payment_with_momo_code():
    proof = "Payment to 2138467 is pending confirmation"
    verdict = verify_payment_slip(proof.encode(), "sms.txt", "text/plain")
    assert verdict["verified"] is False
    assert verdict["reason"] == "payment_not_completed"


def test_verification_accepts_heic_receipt():
    pytest.importorskip("pillow_heif")
    import pillow_heif

    pillow_heif.register_heif_opener()
    img = Image.new("RGB", (900, 300), "white")
    draw = ImageDraw.Draw(img)
    draw.text(
        (40, 40),
        "Receipt\nYou have paid 50 USD to AFRITECH BRIDGE\nTransaction ID 123456",
        fill="black",
        font=_RECEIPT_FONT,
    )
    buf = io.BytesIO()
    img.save(buf, format="HEIF")
    verdict = verify_payment_slip(buf.getvalue(), "receipt.heic", "image/heic")
    assert verdict["verified"] is True
    assert verdict["matched_receiver"] == "AfriTech Bridge"


def test_ocr_engine_unavailable_gets_honest_message(monkeypatch):
    import src.services.payment_slip_verifier as verifier

    monkeypatch.setattr(verifier.shutil, "which", lambda *a, **k: None)
    png = make_receipt_png("Receipt\nYou have paid 50 USD to AFRITECH BRIDGE")
    verdict = verify_payment_slip(png, "receipt.png", "image/png")
    assert verdict["verified"] is False
    assert verdict["reason"] == "ocr_engine_unavailable"
    assert verdict["message"] == OCR_UNAVAILABLE_MESSAGE
    assert "temporarily unavailable" in verdict["message"]
    assert "contact the administrator" in verdict["message"]


def test_text_and_pdf_layer_proofs_work_without_ocr_engine(monkeypatch):
    import src.services.payment_slip_verifier as verifier

    monkeypatch.setattr(verifier.shutil, "which", lambda *a, **k: None)
    text_proof = "You have paid 50 USD to AFRITECH BRIDGE"
    assert verify_payment_slip(
        text_proof.encode(), "proof.txt", "text/plain"
    )["verified"] is True
    pdf = make_pdf_with_text("paid to AfriTech Bridge completed")
    assert verify_payment_slip(pdf, "slip.pdf", "application/pdf")["verified"] is True


# ---------------------------------------------------------------------------
# Memory-bounded OCR (production "Worker was sent SIGKILL" regression guards)
# ---------------------------------------------------------------------------

def test_prepare_ocr_image_caps_raster_and_uses_grayscale():
    from src.services.payment_slip_verifier import _OCR_MAX_EDGE, _prepare_ocr_image

    big = Image.new("RGB", (3600, 4800), color=(240, 240, 240))
    prepared = _prepare_ocr_image(big)
    try:
        assert prepared.mode == "L"
        assert max(prepared.size) <= _OCR_MAX_EDGE
    finally:
        prepared.close()
        big.close()


def test_ocr_best_hands_bounded_grayscale_to_tesseract(monkeypatch):
    import pytesseract
    from src.services.payment_slip_verifier import _OCR_MAX_EDGE, _ocr_best

    seen = []

    def fake_image_to_string(image, **kwargs):
        seen.append((image.mode, max(image.size)))
        return "Receipt paid to AFRITECH BRIDGE"

    monkeypatch.setattr(pytesseract, "image_to_string", fake_image_to_string)
    huge = Image.new("RGB", (3000, 4000), color=(255, 255, 255))
    try:
        assert _ocr_best(huge) == "Receipt paid to AFRITECH BRIDGE"
    finally:
        huge.close()
    assert seen, "tesseract was never invoked"
    mode, longest_edge = seen[0]
    assert mode == "L"
    assert longest_edge <= _OCR_MAX_EDGE


def test_ocr_best_retries_flipped_polarity_for_dark_screenshots(monkeypatch):
    import pytesseract
    from src.services.payment_slip_verifier import _ocr_best

    calls = []

    def fake_image_to_string(image, **kwargs):
        calls.append(image)
        return "AFRITECH BRIDGE paid" if len(calls) == 2 else "balance 5000 RWF"

    monkeypatch.setattr(pytesseract, "image_to_string", fake_image_to_string)
    dark = Image.new("RGB", (200, 400), color=(10, 10, 10))
    try:
        text = _ocr_best(dark)
    finally:
        dark.close()
    assert text == "AFRITECH BRIDGE paid"
    assert len(calls) == 2


def test_verification_disabled_escape_hatch(monkeypatch):
    monkeypatch.setenv("PAYMENT_SLIP_VERIFICATION", "false")
    verdict = verify_payment_slip(b"garbage", "slip.bin", "application/octet-stream")
    assert verdict["verified"] is True
    assert verdict["reason"] == "verification_disabled"


def test_rejection_message_tells_user_to_contact_administrator():
    assert "contact the administrator" in REJECTION_MESSAGE
    assert "AfriTech Bridge" in REJECTION_MESSAGE
    assert "contact the administrator" in NOT_COMPLETED_MESSAGE
    assert "AfriTech Bridge" in NOT_COMPLETED_MESSAGE
    assert "contact the administrator" in OCR_UNAVAILABLE_MESSAGE
    # The rejection message must state every accepted proof so applicants
    # know what to look for on their receipt.
    assert "2138467" in REJECTION_MESSAGE
    assert "1002669565578" in REJECTION_MESSAGE
    assert "AFRITECH BRIDGE" in REJECTION_MESSAGE


# ---------------------------------------------------------------------------
# Route integration
# ---------------------------------------------------------------------------

@pytest.fixture()
def env(app):
    with app.app_context():
        db.create_all()
        suffix = uuid.uuid4().hex[:10]

        student_role = Role.query.filter_by(name="student").first()
        if student_role is None:
            student_role = Role(name="student")
            db.session.add(student_role)
        db.session.flush()

        user = User(
            username=f"slip_student_{suffix}",
            email=f"slip_student_{suffix}@example.test",
            role_id=student_role.id,
        )
        user.set_password("Password123!")
        db.session.add(user)
        db.session.flush()

        course = Course(
            title=f"Slip Verify {suffix}",
            description="payment slip verification tests",
            instructor_id=user.id,
            is_published=True,
            enrollment_type="paid",
            price=100.0,
            currency="USD",
        )
        db.session.add(course)
        db.session.flush()

        application = CourseApplication(
            course_id=course.id,
            full_name="Slip Tester",
            email=user.email,
            phone="+25000000000",
            motivation="I want to learn.",
            status="pending",
        )
        db.session.add(application)
        db.session.flush()
        db.session.commit()

        created = {
            "user_id": user.id,
            "course_id": course.id,
            "application_id": application.id,
            "email": user.email,
        }
        yield created

        CourseApplication.query.filter_by(course_id=created["course_id"]).delete()
        Course.query.filter(Course.id == created["course_id"]).delete()
        User.query.filter(User.id == created["user_id"]).delete()
        db.session.commit()


def _slip_post(client, application_id, png, filename="receipt.png", email=None):
    url = f"/api/v1/applications/{application_id}/upload-payment-slip"
    if email:
        url += f"?email={email}"
    return client.post(
        url,
        data={"file": (io.BytesIO(png), filename)},
        content_type="multipart/form-data",
    )


def _screenshot_post(client, application_id, token, png, filename="receipt.png"):
    return client.post(
        f"/api/v1/applications/{application_id}/upload-payment-screenshot",
        data={"screenshot": (io.BytesIO(png), filename)},
        content_type="multipart/form-data",
        headers={"Authorization": f"Bearer {token}"},
    )


def test_slip_upload_rejects_wrong_receiver(client, env):
    png = make_receipt_png("Receipt\nReceiver: JOHN DOE STORE")
    resp = _slip_post(client, env["application_id"], png, email=env["email"])

    assert resp.status_code == 422
    data = resp.get_json()
    assert data["verification"]["verified"] is False
    assert "contact the administrator" in data["error"]

    row = CourseApplication.query.get(env["application_id"])
    assert row.payment_slip_url is None
    assert row.payment_status is None


def test_slip_upload_accepts_afritech_receiver(client, env):
    png = make_receipt_png(
        "Receipt\nYou have paid 50 USD to AFRITECH BRIDGE\nTransaction ID 123456"
    )
    resp = _slip_post(client, env["application_id"], png, email=env["email"])

    assert resp.status_code == 200
    row = CourseApplication.query.get(env["application_id"])
    assert row.payment_slip_url is not None
    assert row.payment_slip_filename == "receipt.png"


def test_screenshot_upload_rejects_wrong_receiver(client, env):
    token = create_access_token(identity=str(env["user_id"]))
    png = make_receipt_png("Receipt\nReceiver: SOME OTHER SHOP")
    resp = _screenshot_post(client, env["application_id"], token, png)

    assert resp.status_code == 422
    data = resp.get_json()
    assert data["success"] is False
    assert "contact the administrator" in data["error"]

    row = CourseApplication.query.get(env["application_id"])
    assert row.payment_slip_url is None
    assert row.payment_status is None


def test_screenshot_upload_accepts_afritech_receiver(client, env):
    token = create_access_token(identity=str(env["user_id"]))
    png = make_receipt_png(
        "Receipt\nYou have paid 50 USD to AFRITECH BRIDGE\nTransaction ID 123456"
    )
    resp = _screenshot_post(client, env["application_id"], token, png)

    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True
    assert data["payment_status"] == "pending_verification"

    # Clean up the file written by the endpoint
    row = CourseApplication.query.get(env["application_id"])
    if row.payment_slip_url and row.payment_slip_url.startswith("/uploads/"):
        import glob
        import os
        base = os.path.join(client.application.root_path, "..", "uploads", "payment_screenshots")
        for path in glob.glob(os.path.join(base, f"{env['application_id']}_*")):
            os.remove(path)
