# Internship Offer Letter Service
# Generates tamper-proof PDF offer letters, auto-creates user accounts,
# and provides social sharing capabilities.

import logging
import hashlib
import os
import secrets
import string
import json
import uuid
from io import BytesIO
from datetime import datetime
from typing import Tuple, Optional, Dict, Any
import math

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

from src.models.user_models import db, User, Role
from src.models.internship_models import (
    InternshipApplication,
    InternshipOfferLetter,
    ApplicationStatusEnum,
)

logger = logging.getLogger(__name__)


class InternshipOfferService:
    """Service for generating, verifying, and managing internship offer letters."""

    OFFER_PREFIX = "OFR"
    SHARE_TOKEN_BYTES = 32
    PASSWORD_LENGTH = 12

    @staticmethod
    def _generate_offer_number() -> str:
        """Generate a unique offer number: OFR-2026-0001"""
        year = datetime.utcnow().year
        # Count existing offers this year for sequential numbering
        count = InternshipOfferLetter.query.filter(
            InternshipOfferLetter.offer_number.like(f"{InternshipOfferService.OFFER_PREFIX}-{year}-%")
        ).count()
        return f"{InternshipOfferService.OFFER_PREFIX}-{year}-{count + 1:04d}"

    @staticmethod
    def _generate_share_token() -> str:
        """Generate a unique share token for social media sharing."""
        return secrets.token_urlsafe(InternshipOfferService.SHARE_TOKEN_BYTES)

    @staticmethod
    def _generate_username(full_name: str) -> str:
        """Generate a username from full name (e.g., 'John Doe' -> 'john.doe.OFR')"""
        base = full_name.lower().replace(" ", ".").replace("'", "").replace("-", ".")
        # Remove non-alphanumeric except dots
        base = "".join(c for c in base if c.isalnum() or c == ".")
        # Truncate long names
        base = base[:30]
        # Add a short unique suffix
        suffix = secrets.token_hex(3)
        return f"{base}.{suffix}"

    @staticmethod
    def _generate_password() -> str:
        """Generate a secure random password."""
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        return "".join(secrets.choice(alphabet) for _ in range(InternshipOfferService.PASSWORD_LENGTH))

    @staticmethod
    def _compute_pdf_hash(pdf_buffer: BytesIO) -> str:
        """Compute SHA-256 hash of PDF content for tamper-proofing."""
        pdf_buffer.seek(0)
        return hashlib.sha256(pdf_buffer.getvalue()).hexdigest()

    @staticmethod
    def generate_offer_pdf(application: InternshipApplication, offer: InternshipOfferLetter) -> Optional[BytesIO]:
        """
        Generate a beautiful, professional offer letter PDF with tamper-proof SHA-256 hash.

        Args:
            application: The InternshipApplication this offer is for
            offer: The InternshipOfferLetter record

        Returns:
            BytesIO buffer containing the PDF, or None on failure
        """
        try:
            buffer = BytesIO()
            pdf_canvas = canvas.Canvas(buffer, pagesize=A4)
            width, height = A4

            # ── Brand Colors ──
            navy = colors.HexColor("#0f172a")
            brand_blue = colors.HexColor("#1e3a8a")
            teal = colors.HexColor("#14b8a6")
            light_teal = colors.HexColor("#5eead4")
            orange = colors.HexColor("#f97316")
            light_orange = colors.HexColor("#fb923c")
            white = colors.white
            light_gray = colors.HexColor("#94a3b8")
            slate = colors.HexColor("#cbd5e1")

            # ── Full-page navy background ──
            pdf_canvas.setFillColor(navy)
            pdf_canvas.rect(0, 0, width, height, fill=1, stroke=0)

            # ── Decorative gradient circles ──
            pdf_canvas.setFillColorRGB(0.12, 0.23, 0.54, alpha=0.25)
            pdf_canvas.circle(width * 0.12, height * 0.88, 55 * mm, fill=1, stroke=0)
            pdf_canvas.setFillColorRGB(0.08, 0.72, 0.65, alpha=0.12)
            pdf_canvas.circle(width * 0.88, height * 0.15, 48 * mm, fill=1, stroke=0)

            # ── Outer border (teal) ──
            pdf_canvas.setStrokeColor(teal)
            pdf_canvas.setLineWidth(2.5)
            pdf_canvas.roundRect(10 * mm, 10 * mm, width - 20 * mm, height - 20 * mm, 6 * mm, fill=0, stroke=1)

            # ── Inner border (orange) ──
            pdf_canvas.setStrokeColor(orange)
            pdf_canvas.setLineWidth(1.2)
            pdf_canvas.roundRect(13 * mm, 13 * mm, width - 26 * mm, height - 26 * mm, 4 * mm, fill=0, stroke=1)

            # ── Corner tech nodes ──
            def draw_corner_node(cx, cy, color):
                pdf_canvas.setFillColor(color)
                pdf_canvas.circle(cx, cy, 2.5 * mm, fill=1, stroke=0)
                pdf_canvas.setStrokeColor(color)
                pdf_canvas.setLineWidth(1.5)
                pdf_canvas.circle(cx, cy, 3.5 * mm, fill=0, stroke=1)

            draw_corner_node(16 * mm, height - 16 * mm, teal)
            draw_corner_node(width - 16 * mm, height - 16 * mm, orange)
            draw_corner_node(16 * mm, 16 * mm, teal)
            draw_corner_node(width - 16 * mm, 16 * mm, orange)

            # ── Company Header ──
            # Logo area (left)
            logo_center_x = 38 * mm
            logo_center_y = height - 32 * mm

            # Draw logo image with circular clip + decorative rings
            logo_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                "static", "images", "logo.jpg"
            )
            if os.path.exists(logo_path):
                # Circular clip – crop logo to a circle
                pdf_canvas.saveState()
                p = pdf_canvas.beginPath()
                p.circle(logo_center_x, logo_center_y, 11 * mm)
                pdf_canvas.clipPath(p, stroke=0)
                pdf_canvas.drawImage(
                    logo_path,
                    logo_center_x - 12 * mm,
                    logo_center_y - 12 * mm,
                    width=24 * mm,
                    height=24 * mm,
                    preserveAspectRatio=True,
                    mask="auto",
                )
                pdf_canvas.restoreState()

                # Inner decorative ring (teal, right at clip edge)
                pdf_canvas.setStrokeColor(teal)
                pdf_canvas.setLineWidth(2.5)
                pdf_canvas.circle(logo_center_x, logo_center_y, 11.5 * mm, fill=0, stroke=1)

                # Outer decorative ring (orange)
                pdf_canvas.setStrokeColor(orange)
                pdf_canvas.setLineWidth(1.2)
                pdf_canvas.circle(logo_center_x, logo_center_y, 13.5 * mm, fill=0, stroke=1)

                # Small accent dots on the outer ring (at 45° angles)
                pdf_canvas.setFillColor(teal)
                for angle_deg in [45, 135, 225, 315]:
                    rad = math.radians(angle_deg)
                    dx = 13.5 * mm * math.cos(rad)
                    dy = 13.5 * mm * math.sin(rad)
                    pdf_canvas.circle(
                        logo_center_x + dx,
                        logo_center_y + dy,
                        0.6 * mm,
                        fill=1,
                        stroke=0,
                    )
            else:
                # Fallback: concentric placeholder circles
                pdf_canvas.setStrokeColor(teal)
                pdf_canvas.setLineWidth(2)
                pdf_canvas.circle(logo_center_x, logo_center_y, 12 * mm, fill=0, stroke=1)
                pdf_canvas.setStrokeColor(orange)
                pdf_canvas.setLineWidth(1)
                pdf_canvas.circle(logo_center_x, logo_center_y, 10 * mm, fill=0, stroke=1)

            # Company name below logo
            pdf_canvas.setFont("Helvetica-Bold", 11)
            pdf_canvas.setFillColor(teal)
            pdf_canvas.drawCentredString(logo_center_x, logo_center_y - 17 * mm, "✦ AFRITECH BRIDGE ✦")
            pdf_canvas.setFont("Helvetica", 7)
            pdf_canvas.setFillColor(light_teal)
            pdf_canvas.drawCentredString(logo_center_x, logo_center_y - 20.5 * mm, "Empowering Africa Through Technology")

            # Title (right-aligned)
            pdf_canvas.setFont("Helvetica-Bold", 10)
            pdf_canvas.setFillColor(teal)
            pdf_canvas.drawRightString(width - 20 * mm, height - 28 * mm, "INTERNSHIP OFFER LETTER")
            pdf_canvas.setFont("Helvetica", 7.5)
            pdf_canvas.setFillColor(slate)
            pdf_canvas.drawRightString(width - 20 * mm, height - 32 * mm, f"Reference: {application.reference_code}")
            pdf_canvas.drawRightString(width - 20 * mm, height - 36 * mm, f"Offer No: {offer.offer_number}")

            # ── Divider ──
            divider_y = height - 50 * mm
            pdf_canvas.setStrokeColor(teal)
            pdf_canvas.setLineWidth(1)
            pdf_canvas.line(20 * mm, divider_y, width - 50 * mm, divider_y)
            pdf_canvas.setStrokeColor(orange)
            pdf_canvas.line(width - 48 * mm, divider_y, width - 20 * mm, divider_y)
            # Divider dots
            for i in range(3):
                x = width / 2 - 4 * mm + i * 4 * mm
                pdf_canvas.setFillColor(orange if i == 1 else teal)
                pdf_canvas.circle(x, divider_y, 1.2 * mm, fill=1, stroke=0)

            # ── Subject Line ──
            pdf_canvas.setFont("Helvetica-Bold", 16)
            pdf_canvas.setFillColor(white)
            pdf_canvas.drawCentredString(width / 2, height - 59 * mm, "OFFER OF INTERNSHIP")
            pdf_canvas.setFont("Helvetica", 10)
            pdf_canvas.setFillColor(light_gray)
            pdf_canvas.drawCentredString(width / 2, height - 65 * mm, f"for the {application.track.name} Program")

            # ── Candidate Name ──
            pdf_canvas.setFont("Helvetica-Bold", 24)
            pdf_canvas.setFillColor(white)
            pdf_canvas.drawCentredString(width / 2, height - 79 * mm, application.full_name)

            # Name underline
            pdf_canvas.setStrokeColor(teal)
            pdf_canvas.setLineWidth(1.5)
            pdf_canvas.line(width / 2 - 60 * mm, height - 82 * mm, width / 2, height - 82 * mm)
            pdf_canvas.setStrokeColor(orange)
            pdf_canvas.line(width / 2, height - 82 * mm, width / 2 + 60 * mm, height - 82 * mm)

            # ── Offer Body ──
            body_start_y = height - 95 * mm
            line_height = 6 * mm

            pdf_canvas.setFont("Helvetica", 10)
            pdf_canvas.setFillColor(slate)

            body_text = (
                f"Dear {application.full_name.split()[0]},",
                "",
                "We are delighted to offer you a position in our internship program at",
                "AfriTech Bridge. After careful review of your application and interview",
                "performance, we were impressed by your skills, passion, and potential.",
            )

            for i, line in enumerate(body_text):
                pdf_canvas.drawCentredString(width / 2, body_start_y - i * line_height, line)

            # ── Offer Details Box ──
            details_y = body_start_y - len(body_text) * line_height - 30 * mm
            box_height = 32 * mm
            box_width = 140 * mm

            pdf_canvas.setFillColorRGB(0.12, 0.23, 0.54, alpha=0.35)
            pdf_canvas.roundRect(
                width / 2 - box_width / 2, details_y, box_width, box_height, 4 * mm, fill=1, stroke=0
            )
            pdf_canvas.setStrokeColor(teal)
            pdf_canvas.setLineWidth(1.5)
            pdf_canvas.roundRect(
                width / 2 - box_width / 2, details_y, box_width, box_height, 4 * mm, fill=0, stroke=1
            )

            pdf_canvas.setFont("Helvetica-Bold", 8)
            pdf_canvas.setFillColor(teal)
            pdf_canvas.drawCentredString(width / 2, details_y + box_height - 5 * mm, "─── OFFER DETAILS ───")

            detail_items = [
                ("Program Track", application.track.name if application.track else "—"),
                ("Program Type", "Full-Time Internship"),
                ("Duration", "As per cohort schedule"),
                ("Location", "Remote / Hybrid"),
                ("Start Date", application.cohort.start_date.strftime("%d %B %Y") if application.cohort else "TBD"),
            ]

            col1_x = width / 2 - 55 * mm
            col2_x = width / 2 + 10 * mm
            detail_y_start = details_y + box_height - 10 * mm

            pdf_canvas.setFont("Helvetica-Bold", 8.5)
            pdf_canvas.setFillColor(light_gray)
            for i, (label, value) in enumerate(detail_items[:3]):
                y = detail_y_start - i * 5.5 * mm
                pdf_canvas.drawString(col1_x, y, label)
            pdf_canvas.setFont("Helvetica", 8.5)
            pdf_canvas.setFillColor(white)
            for i, (label, value) in enumerate(detail_items[:3]):
                y = detail_y_start - i * 5.5 * mm
                pdf_canvas.drawString(col2_x, y, value)

            pdf_canvas.setFont("Helvetica-Bold", 8.5)
            pdf_canvas.setFillColor(light_gray)
            for i, (label, value) in enumerate(detail_items[3:]):
                y = detail_y_start - (i + 3) * 5.5 * mm
                pdf_canvas.drawString(col1_x, y, label)
            pdf_canvas.setFont("Helvetica", 8.5)
            pdf_canvas.setFillColor(white)
            for i, (label, value) in enumerate(detail_items[3:]):
                y = detail_y_start - (i + 3) * 5.5 * mm
                pdf_canvas.drawString(col2_x, y, value)

            # ── Login Credentials Box ──
            creds_y = details_y - 28 * mm
            creds_box_height = 22 * mm

            pdf_canvas.setFillColorRGB(0.08, 0.72, 0.65, alpha=0.08)
            pdf_canvas.roundRect(
                width / 2 - box_width / 2, creds_y, box_width, creds_box_height, 4 * mm, fill=1, stroke=0
            )
            pdf_canvas.setStrokeColor(orange)
            pdf_canvas.setLineWidth(1)
            pdf_canvas.roundRect(
                width / 2 - box_width / 2, creds_y, box_width, creds_box_height, 4 * mm, fill=0, stroke=1
            )

            pdf_canvas.setFont("Helvetica-Bold", 8)
            pdf_canvas.setFillColor(orange)
            pdf_canvas.drawCentredString(width / 2, creds_y + creds_box_height - 5 * mm, "─── YOUR LOGIN CREDENTIALS ───")

            pdf_canvas.setFont("Helvetica-Bold", 9)
            pdf_canvas.setFillColor(light_teal)
            pdf_canvas.drawString(col1_x, creds_y + creds_box_height - 11 * mm, "Username:")
            pdf_canvas.setFont("Courier-Bold", 9)
            pdf_canvas.setFillColor(white)
            pdf_canvas.drawString(col2_x, creds_y + creds_box_height - 11 * mm, offer.generated_username)

            pdf_canvas.setFont("Helvetica-Bold", 9)
            pdf_canvas.setFillColor(light_teal)
            pdf_canvas.drawString(col1_x, creds_y + creds_box_height - 17 * mm, "Password:")
            pdf_canvas.setFont("Courier-Bold", 9)
            pdf_canvas.setFillColor(white)
            # Mask password with dots for security in PDF
            pdf_canvas.drawString(col2_x, creds_y + creds_box_height - 17 * mm, "● ● ● ● ● ● ● ● ● ● ● ●")

            # ── Closing ──
            closing_y = creds_y - 6 * mm
            pdf_canvas.setFont("Helvetica", 10)
            pdf_canvas.setFillColor(slate)
            closing_lines = (
                "We look forward to having you on board! Log in using the credentials above",
                "within 7 days to access your tasks, track progress, and connect with your mentor.",
            )
            for i, line in enumerate(closing_lines):
                pdf_canvas.drawCentredString(width / 2, closing_y - i * line_height, line)

            # ── Signature Section ──
            sig_y = 48 * mm
            sig_box_h = 22 * mm
            sig_box_w = 80 * mm

            pdf_canvas.setFillColorRGB(0.12, 0.23, 0.54, alpha=0.3)
            pdf_canvas.roundRect(
                width / 2 - sig_box_w / 2, sig_y, sig_box_w, sig_box_h, 4 * mm, fill=1, stroke=0
            )
            pdf_canvas.setStrokeColor(teal)
            pdf_canvas.setLineWidth(1.5)
            pdf_canvas.roundRect(
                width / 2 - sig_box_w / 2, sig_y, sig_box_w, sig_box_h, 4 * mm, fill=0, stroke=1
            )

            pdf_canvas.setFont("Helvetica-Bold", 7)
            pdf_canvas.setFillColor(teal)
            pdf_canvas.drawCentredString(width / 2, sig_y + sig_box_h - 3.5 * mm, "────────── AUTHORIZED SIGNATURE ──────────")

            # Signature line
            sig_line_y = sig_y + sig_box_h - 10 * mm
            pdf_canvas.setStrokeColor(teal)
            pdf_canvas.setLineWidth(1.2)
            pdf_canvas.line(width / 2 - 28 * mm, sig_line_y, width / 2 - 2 * mm, sig_line_y)
            pdf_canvas.setStrokeColor(orange)
            pdf_canvas.line(width / 2 + 2 * mm, sig_line_y, width / 2 + 28 * mm, sig_line_y)

            # Try to load signature image
            signature_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                "static", "images", "sign.jpg"
            )
            if os.path.exists(signature_path):
                try:
                    # Draw light background so signature is visible on dark navy
                    sig_img_x = width / 2 - 12 * mm
                    sig_img_y = sig_line_y + 1 * mm
                    sig_img_w = 24 * mm
                    sig_img_h = 6 * mm
                    pdf_canvas.setFillColor(colors.HexColor('#f8fafc'))
                    pdf_canvas.roundRect(
                        sig_img_x - 0.5 * mm, sig_img_y - 0.5 * mm,
                        sig_img_w + 1 * mm, sig_img_h + 1 * mm,
                        1.5 * mm, fill=1, stroke=0
                    )
                    pdf_canvas.drawImage(
                        signature_path,
                        sig_img_x, sig_img_y,
                        width=sig_img_w, height=sig_img_h,
                        preserveAspectRatio=True,
                        mask="auto",
                    )
                except Exception:
                    pass

            pdf_canvas.setFont("Helvetica-Bold", 10)
            pdf_canvas.setFillColor(white)
            pdf_canvas.drawCentredString(width / 2, sig_y + 7 * mm, "Desire Bikorimana")
            pdf_canvas.setFont("Helvetica-Bold", 7)
            pdf_canvas.setFillColor(orange)
            pdf_canvas.drawCentredString(width / 2, sig_y + 4 * mm, "Founder & Chief Executive Officer")
            pdf_canvas.setFont("Helvetica", 6.5)
            pdf_canvas.setFillColor(light_gray)
            pdf_canvas.drawCentredString(width / 2, sig_y + 1.5 * mm, "AfriTech Bridge")

            # ── QR Code for Verification ──
            import qrcode
            qr_size = 24 * mm
            qr_x = width - 46 * mm
            qr_y = sig_y + sig_box_h + 4 * mm

            verification_url = (
                f"https://study.afritechbridge.online/verify-offer/{offer.verification_hash}"
            )
            qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=1)
            qr.add_data(verification_url)
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color="#0f172a", back_color="white")

            qr_buffer = BytesIO()
            qr_img.save(qr_buffer, format="PNG")
            qr_buffer.seek(0)

            pdf_canvas.setFillColor(white)
            pdf_canvas.roundRect(qr_x, qr_y, qr_size, qr_size, 3 * mm, fill=1, stroke=0)
            pdf_canvas.drawImage(
                ImageReader(qr_buffer),
                qr_x + 1.5 * mm, qr_y + 1.5 * mm,
                width=qr_size - 3 * mm, height=qr_size - 3 * mm,
                preserveAspectRatio=True, mask="auto",
            )
            pdf_canvas.setStrokeColor(teal)
            pdf_canvas.setLineWidth(1.5)
            pdf_canvas.roundRect(qr_x, qr_y, qr_size, qr_size, 3 * mm, fill=0, stroke=1)

            pdf_canvas.setFont("Helvetica-Bold", 6)
            pdf_canvas.setFillColor(teal)
            pdf_canvas.drawCentredString(qr_x + qr_size / 2, qr_y - 4 * mm, "SCAN TO VERIFY")
            pdf_canvas.setFont("Helvetica", 5.5)
            pdf_canvas.setFillColor(light_gray)
            pdf_canvas.drawCentredString(qr_x + qr_size / 2, qr_y - 7 * mm, "study.afritechbridge.online/verify-offer")

            # ── Footer ──
            pdf_canvas.setFont("Helvetica", 7)
            pdf_canvas.setFillColor(slate)
            pdf_canvas.drawCentredString(
                width / 2, 18 * mm,
                "Empowering the next generation of African tech leaders"
            )
            pdf_canvas.setFont("Helvetica-Bold", 6)
            pdf_canvas.setFillColor(teal)
            pdf_canvas.drawCentredString(
                width / 2, 14 * mm,
                f"© 2026 AfriTech Bridge  |  Offer No: {offer.offer_number}  |  Issued: {datetime.utcnow().strftime('%d %B %Y')}"
            )

            # ── Finalize ──
            pdf_canvas.showPage()
            pdf_canvas.save()
            buffer.seek(0)

            logger.info(f"Offer letter PDF generated: {offer.offer_number} ({buffer.getbuffer().nbytes} bytes)")
            return buffer

        except Exception as e:
            logger.error(f"Offer PDF generation error: {str(e)}", exc_info=True)
            return None

    @staticmethod
    def create_offer(application: InternshipApplication, admin_user: User, offer_dir: str) -> Tuple[bool, str, Optional[InternshipOfferLetter], Optional[str]]:
        """
        Create an offer letter for an accepted application:
        1. Generate offer number and share token
        2. Create user account with random credentials
        3. Generate PDF with tamper-proof hash
        4. Save PDF to disk

        Args:
            application: The accepted InternshipApplication
            admin_user: The admin User who is issuing the offer
            offer_dir: Directory path to save PDF files (e.g. 'uploads/offer_letters/')

        Returns:
            Tuple of (success, message, offer_letter_record)
        """
        try:
            # ── Validate application status ──
            if application.status != ApplicationStatusEnum.ACCEPTED:
                return False, "Application must be in 'accepted' status to receive an offer", None, None

            # Check if offer already exists
            existing = InternshipOfferLetter.query.filter_by(application_id=application.id).first()
            if existing:
                return False, "An offer letter has already been issued for this application", existing, None

            # ── Create or find existing user account ──
            # Check if a user already exists with this email
            intern_user = User.query.filter_by(email=application.email).first()

            if intern_user:
                # User already exists — link them and skip account creation
                logger.info(
                    f"User already exists for email {application.email} (id={intern_user.id}) — linking existing account"
                )
                username = intern_user.username
                password = None  # Don't regenerate password for existing users
            else:
                # Create new user account
                username = InternshipOfferService._generate_username(application.full_name)
                password = InternshipOfferService._generate_password()

                # Check for username uniqueness
                existing_user = User.query.filter_by(username=username).first()
                if existing_user:
                    username = f"{username}.{secrets.token_hex(2)}"

                # Look up intern role by name instead of hardcoding ID
                intern_role = Role.query.filter_by(name='intern').first()
                intern_role_id = intern_role.id if intern_role else Role.query.filter_by(name='student').first().id or 4

                intern_user = User(
                    username=username,
                    email=application.email,
                    first_name=application.full_name.split()[0] if application.full_name.split() else application.full_name,
                    last_name=" ".join(application.full_name.split()[1:]) if len(application.full_name.split()) > 1 else "",
                    role_id=intern_role_id,
                    is_active=True,
                    must_change_password=True,  # Force password change on first login
                )
                intern_user.set_password(password)
                db.session.add(intern_user)
                db.session.flush()

            # Link the application to the user (existing or newly created)
            application.user_id = intern_user.id
            db.session.flush()

            # ── Create offer record ──
            offer_number = InternshipOfferService._generate_offer_number()
            share_token = InternshipOfferService._generate_share_token()
            verification_hash = hashlib.sha256(
                f"{offer_number}:{application.id}:{application.reference_code}:{secrets.token_hex(8)}".encode()
            ).hexdigest()

            offer = InternshipOfferLetter(
                application_id=application.id,
                offer_number=offer_number,
                generated_username=username,
                generated_password_hash=intern_user.password_hash,
                verification_hash=verification_hash,
                share_token=share_token,
                status="sent",
                created_by_id=admin_user.id,
            )
            db.session.add(offer)
            db.session.flush()

            # ── Generate PDF ──
            pdf_buffer = InternshipOfferService.generate_offer_pdf(application, offer)
            if not pdf_buffer:
                db.session.rollback()
                return False, "Failed to generate offer letter PDF", None

            # ── Compute tamper-proof hash ──
            pdf_hash = InternshipOfferService._compute_pdf_hash(pdf_buffer)
            offer.pdf_hash = pdf_hash

            # ── Save PDF to disk ──
            os.makedirs(offer_dir, exist_ok=True)
            pdf_filename = f"{offer.offer_number}_{application.reference_code}.pdf"
            pdf_path = os.path.join(offer_dir, pdf_filename)
            with open(pdf_path, "wb") as f:
                f.write(pdf_buffer.getvalue())

            offer.pdf_path = pdf_path
            db.session.commit()

            logger.info(
                f"Offer letter created: {offer.offer_number} for {application.full_name} "
                f"(user={username}, pdf_hash={pdf_hash[:16]}...)"
            )

            logger.info(
                f"Offer letter created: {offer.offer_number} for {application.full_name} "
                f"(user={username}, pdf_hash={pdf_hash[:16]}...)"
            )

            return True, "Offer letter generated successfully", offer, password

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating offer letter: {str(e)}", exc_info=True)
            return False, f"Failed to create offer letter: {str(e)}", None, None

    @staticmethod
    def verify_offer_pdf(offer: InternshipOfferLetter) -> Tuple[bool, str]:
        """
        Verify the integrity of an offer PDF by comparing its SHA-256 hash.

        Args:
            offer: The InternshipOfferLetter record

        Returns:
            Tuple of (is_authentic, message)
        """
        if not offer.pdf_path or not os.path.exists(offer.pdf_path):
            return False, "Offer letter PDF not found on server"

        if not offer.pdf_hash:
            return False, "No reference hash available for verification"

        try:
            with open(offer.pdf_path, "rb") as f:
                content = f.read()
            computed_hash = hashlib.sha256(content).hexdigest()

            if computed_hash == offer.pdf_hash:
                return True, "Offer letter is authentic and has not been tampered with"
            else:
                return False, "WARNING: Offer letter has been modified since issuance"
        except Exception as e:
            logger.error(f"Error verifying offer PDF: {str(e)}")
            return False, f"Verification error: {str(e)}"

    @staticmethod
    def regenerate_offer(application: InternshipApplication, admin_user: User, offer_dir: str) -> Tuple[bool, str, Optional[InternshipOfferLetter], Optional[str]]:
        """
        Regenerate an offer letter for an application that already has one.
        Revokes the old offer, creates a new one with a fresh offer number,
        a new PDF, and new credentials (new user account created).

        Args:
            application: The accepted InternshipApplication
            admin_user: The admin User who is regenerating
            offer_dir: Directory path to save PDF files

        Returns:
            Tuple of (success, message, new_offer_record, password)
        """
        try:
            if application.status != ApplicationStatusEnum.ACCEPTED:
                return False, "Application must be in 'accepted' status to receive an offer", None, None

            # Find and revoke the existing offer
            old_offer = InternshipOfferLetter.query.filter_by(application_id=application.id).first()
            if not old_offer:
                return False, "No existing offer to regenerate. Generate one first.", None, None

            # Revoke the old offer for audit trail
            old_offer.status = "revoked"
            db.session.flush()
            logger.info(f"Revoked old offer {old_offer.offer_number} for application {application.id}")

            # ── Create or find existing user account ──
            # Check if a user already exists with this email (e.g. from the previous offer)
            intern_user = User.query.filter_by(email=application.email).first()

            if intern_user:
                # User already exists — preserve their existing credentials
                logger.info(
                    f"User already exists for email {application.email} (id={intern_user.id}) — using existing credentials"
                )
                username = intern_user.username
                password = None  # Don't regenerate password for existing users
            else:
                # Create new user account
                username = InternshipOfferService._generate_username(application.full_name)
                password = InternshipOfferService._generate_password()

                existing_user = User.query.filter_by(username=username).first()
                if existing_user:
                    username = f"{username}.{secrets.token_hex(2)}"

                # Look up intern role by name instead of hardcoding ID
                intern_role = Role.query.filter_by(name='intern').first()
                intern_role_id = intern_role.id if intern_role else Role.query.filter_by(name='student').first().id or 4

                intern_user = User(
                    username=username,
                    email=application.email,
                    first_name=application.full_name.split()[0] if application.full_name.split() else application.full_name,
                    last_name=" ".join(application.full_name.split()[1:]) if len(application.full_name.split()) > 1 else "",
                    role_id=intern_role_id,
                    is_active=True,
                    must_change_password=True,
                )
                intern_user.set_password(password)
                db.session.add(intern_user)

            db.session.flush()

            # Link application to the user
            application.user_id = intern_user.id
            db.session.flush()

            # ── Update the existing offer record in-place with new values ──
            # (application_id has a UNIQUE constraint, so we must reuse the same row)
            new_offer_number = InternshipOfferService._generate_offer_number()
            share_token = InternshipOfferService._generate_share_token()
            verification_hash = hashlib.sha256(
                f"{new_offer_number}:{application.id}:{application.reference_code}:{secrets.token_hex(8)}".encode()
            ).hexdigest()

            # Update the old (revoked) offer record with fresh values
            old_offer.offer_number = new_offer_number
            old_offer.generated_username = username
            old_offer.generated_password_hash = intern_user.password_hash
            old_offer.verification_hash = verification_hash
            old_offer.share_token = share_token
            old_offer.status = "sent"
            old_offer.created_by_id = admin_user.id
            old_offer.sent_at = datetime.utcnow()
            old_offer.accepted_at = None
            old_offer.accepted_by_user_id = None
            old_offer.social_shares = 0
            old_offer.pdf_hash = None
            old_offer.pdf_path = None
            db.session.flush()

            # ── Generate new PDF ──
            pdf_buffer = InternshipOfferService.generate_offer_pdf(application, old_offer)
            if not pdf_buffer:
                db.session.rollback()
                return False, "Failed to generate new offer letter PDF", None, None

            pdf_hash = InternshipOfferService._compute_pdf_hash(pdf_buffer)
            old_offer.pdf_hash = pdf_hash

            os.makedirs(offer_dir, exist_ok=True)
            pdf_filename = f"{new_offer_number}_{application.reference_code}.pdf"
            pdf_path = os.path.join(offer_dir, pdf_filename)
            with open(pdf_path, "wb") as f:
                f.write(pdf_buffer.getvalue())

            old_offer.pdf_path = pdf_path
            db.session.commit()

            logger.info(
                f"Offer regenerated: {new_offer_number} replaces revoked offer for "
                f"{application.full_name}"
            )

            return True, f"Offer regenerated: new offer {new_offer_number} issued", old_offer, password

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error regenerating offer letter: {str(e)}", exc_info=True)
            return False, f"Failed to regenerate offer letter: {str(e)}", None, None

    @staticmethod
    def get_share_url(offer: InternshipOfferLetter) -> str:
        """Get the social media share URL for an offer letter."""
        from flask import current_app
        frontend_url = current_app.config.get("FRONTEND_URL", "https://study.afritechbridge.online")
        return f"{frontend_url}/share-offer/{offer.share_token}"

    @staticmethod
    def generate_social_share_text(offer: InternshipOfferLetter, application: InternshipApplication) -> Dict[str, str]:
        """Generate text for sharing on different social media platforms."""
        base_text = (
            f"🎉 Thrilled to share that {application.full_name} has received an "
            f"internship offer from AfriTech Bridge for the {application.track.name} program! "
            f"#AfriTechBridge #Internship #TechInAfrica"
        )

        share_url = InternshipOfferService.get_share_url(offer)

        return {
            "linkedin": base_text,
            "twitter": f"🎉 {application.full_name} got an internship offer at AfriTech Bridge! {share_url} #TechInAfrica",
            "facebook": base_text,
            "whatsapp": f"🎉 *{application.full_name}* received an internship offer from *AfriTech Bridge*! 🚀\\n\\n{share_url}",
            "generic": f"{base_text}\\n\\n{share_url}",
        }
