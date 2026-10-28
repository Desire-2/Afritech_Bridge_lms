"""Tests for payment slip/screenshot verification (OCR + receiver check).

Uploads whose extracted text does not prove AfriTech Bridge as the payment
receiver must be rejected with the contact-the-administrator message and
must not touch the application record.
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
    REJECTION_MESSAGE,
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


def make_receipt_png(text: str) -> bytes:
    img = Image.new("RGB", (900, 420), "white")
    draw = ImageDraw.Draw(img)
    draw.text((40, 40), text, fill="black", font=_RECEIPT_FONT)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


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


def test_verification_rejects_wrong_receiver_image():
    png = make_receipt_png("Receipt\nReceiver: JOHN DOE STORE")
    verdict = verify_payment_slip(png, "receipt.png", "image/png")
    assert verdict["verified"] is False
    assert verdict["reason"] == "receiver_not_proven"
    assert "contact the administrator" in verdict["message"]


def test_verification_accepts_afritech_receiver_image():
    png = make_receipt_png("Receipt\nReceiver: AFRITECH BRIDGE")
    verdict = verify_payment_slip(png, "receipt.png", "image/png")
    assert verdict["verified"] is True
    assert verdict["matched_receiver"] == "AfriTech Bridge"


def test_verification_disabled_escape_hatch(monkeypatch):
    monkeypatch.setenv("PAYMENT_SLIP_VERIFICATION", "false")
    verdict = verify_payment_slip(b"garbage", "slip.bin", "application/octet-stream")
    assert verdict["verified"] is True
    assert verdict["reason"] == "verification_disabled"


def test_rejection_message_tells_user_to_contact_administrator():
    assert "contact the administrator" in REJECTION_MESSAGE
    assert "AfriTech Bridge" in REJECTION_MESSAGE


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
    png = make_receipt_png("Receipt\nReceiver: AFRITECH BRIDGE")
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
    png = make_receipt_png("Receipt\nReceiver: AFRITECH BRIDGE")
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
