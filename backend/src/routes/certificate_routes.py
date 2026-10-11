# Certificate Routes - Student certificate and badge API endpoints
import re
import threading
import time
from collections import deque
from functools import wraps

from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..models.user_models import User
from ..services.certificate_service import CertificateService

# Helper decorator for student access
def student_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        if not user or not user.role or user.role.name != 'student':
            return jsonify({"message": "Student access required"}), 403
        return f(*args, **kwargs)
    return decorated_function

certificate_bp = Blueprint("student_certificate", __name__, url_prefix="/api/v1/student/certificate")

# Certificate numbers follow ABC-YYYY-NNNNNN. Validating the shape before the
# query keeps invalid probes off the database.
_CERTIFICATE_NUMBER_RE = re.compile(r'^ABC-\d{4}-\d{6}$')


class _SlidingWindowRateLimiter:
    """Minimal in-process sliding-window limiter for public endpoints.

    Used only where no shared rate-limiting infrastructure exists; bounds
    certificate-number enumeration on the public verify/QR routes.
    """

    def __init__(self):
        self._hits = {}
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window_seconds: int) -> bool:
        now = time.monotonic()
        with self._lock:
            hits = self._hits.setdefault(key, deque())
            cutoff = now - window_seconds
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= limit:
                return False
            hits.append(now)
            return True


_verify_rate_limiter = _SlidingWindowRateLimiter()


def _client_ip():
    return request.remote_addr or 'unknown'


def _rate_limited():
    key = f"cert-verify:{_client_ip()}"
    # Generous for legitimate users (scanning a few certificates) while
    # bounding automated enumeration of the 6-digit number space.
    if not _verify_rate_limiter.check(key, limit=60, window_seconds=60):
        return jsonify({
            "success": False,
            "error": "Too many verification requests. Please try again shortly."
        }), 429
    return None


def _eligibility_public_payload(eligibility: dict) -> dict:
    """Strip internal-only fields from an eligibility payload."""
    payload = dict(eligibility)
    payload.pop('enrollment', None)
    payload.pop('reason', None)
    return payload


def _safe_certificate_filename(certificate, extension: str) -> str:
    title = certificate.course.title if certificate.course else None
    safe_title = re.sub(r'[^a-zA-Z0-9\s-]', '', title or 'Course').strip().replace(' ', '_')
    return f"{safe_title or 'Course'}_Certificate.{extension}"


@certificate_bp.route("/eligibility/<int:course_id>", methods=["GET"])
@student_required
def check_certificate_eligibility(course_id):
    """Check if student is eligible for course certificate.

    Canonical envelope:
        { success, data: { eligible, reason, error_code, summary,
          next_steps, requirements: <flat eligibility payload> } }
    """
    try:
        student_id = int(get_jwt_identity())
        eligibility = CertificateService.evaluate_eligibility(student_id, course_id)
        requirements = _eligibility_public_payload(eligibility)

        return jsonify({
            "success": True,
            "data": {
                "eligible": eligibility["eligible"],
                "reason": eligibility["reason"],
                "error_code": eligibility["error_code"],
                "summary": eligibility["summary"],
                "next_steps": eligibility["next_steps"],
                "requirements": requirements,
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Eligibility check route error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to check certificate eligibility",
            "error_code": "SERVER_ERROR"
        }), 500

@certificate_bp.route("/generate/<int:course_id>", methods=["POST"])
@student_required
def generate_certificate(course_id):
    """Generate course completion certificate (canonical service).

    Returns ``created: true`` when a new certificate was issued and
    ``created: false`` when an existing certificate was returned.
    """
    try:
        student_id = int(get_jwt_identity())
        success, message, payload = CertificateService.generate_certificate(
            student_id, course_id
        )

        if success:
            return jsonify({
                "success": True,
                "message": message,
                "created": payload.get("created", False),
                "data": payload
            }), 200
        else:
            response = {
                "success": False,
                "error": message,
                "message": message,
            }
            if isinstance(payload, dict) and payload.get('error_code'):
                response["error_code"] = payload['error_code']
                if 'eligible' in payload:
                    response["requirements"] = _eligibility_public_payload(payload)
                    response["summary"] = payload.get('summary')
                    response["next_steps"] = payload.get('next_steps')
            status = 404 if payload.get('error_code') == 'NOT_ENROLLED' else 400
            return jsonify(response), status

    except Exception as e:
        current_app.logger.error(f"Certificate generation route error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to generate certificate",
            "error_code": "SERVER_ERROR"
        }), 500

@certificate_bp.route("/verify/<certificate_number>", methods=["GET"])
def verify_certificate_by_number(certificate_number):
    """Verify certificate authenticity by certificate number (public GET endpoint for QR codes).

    Returns only the public verification payload — never internal ids or the
    verification hash.
    """
    limited = _rate_limited()
    if limited is not None:
        return limited

    if not _CERTIFICATE_NUMBER_RE.match(certificate_number or ''):
        # Malformed numbers never hit the database.
        return jsonify({
            "success": False,
            "error": "Certificate not found"
        }), 404

    try:
        valid, message, cert_data = CertificateService.verify_certificate(
            certificate_number
        )

        if valid:
            return jsonify({
                "success": True,
                "message": message,
                "data": cert_data
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": message
            }), 404 if "not found" in message.lower() else 400

    except Exception as e:
        current_app.logger.error(f"Certificate verify route error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to verify certificate"
        }), 500

@certificate_bp.route("/verify", methods=["POST"])
def verify_certificate():
    """Verify certificate authenticity (public endpoint)"""
    limited = _rate_limited()
    if limited is not None:
        return limited

    try:
        data = request.get_json()

        if not data or 'certificate_number' not in data:
            return jsonify({
                "success": False,
                "error": "Certificate number is required"
            }), 400

        certificate_number = data['certificate_number']

        if not _CERTIFICATE_NUMBER_RE.match(str(certificate_number)):
            return jsonify({
                "success": False,
                "error": "Certificate not found"
            }), 404

        # verification_hash is accepted for internal callers but never
        # required for public verification and never echoed back.
        verification_hash = data.get('verification_hash')

        valid, message, cert_data = CertificateService.verify_certificate(
            certificate_number, verification_hash
        )

        if valid:
            return jsonify({
                "success": True,
                "message": message,
                "data": cert_data
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": message
            }), 404 if "not found" in message.lower() else 400

    except Exception as e:
        current_app.logger.error(f"Certificate verify POST route error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to verify certificate"
        }), 500

@certificate_bp.route("/verify-qr/<certificate_number>", methods=["GET"])
def verify_qr_image(certificate_number):
    """Public QR PNG encoding the canonical verification URL.

    Generated with the same qrcode library used for the PDF so on-screen
    certificates are genuinely scannable.
    """
    limited = _rate_limited()
    if limited is not None:
        return limited

    if not _CERTIFICATE_NUMBER_RE.match(certificate_number or ''):
        return jsonify({
            "success": False,
            "error": "Certificate not found"
        }), 404

    try:
        from ..models.student_models import Certificate
        certificate = Certificate.query.filter_by(
            certificate_number=certificate_number, is_active=True
        ).first()
        if not certificate:
            return jsonify({
                "success": False,
                "error": "Certificate not found"
            }), 404

        import qrcode
        from io import BytesIO

        verification_url = CertificateService.get_verification_url(certificate_number)
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=2,
        )
        qr.add_data(verification_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#0f172a", back_color="white")

        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)

        return send_file(
            buffer,
            mimetype='image/png',
            as_attachment=False,
            download_name=f"verify_{certificate_number}.png"
        )

    except Exception as e:
        current_app.logger.error(f"QR generation error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to generate verification QR code"
        }), 500

@certificate_bp.route("/my-certificates", methods=["GET"])
@student_required
def get_my_certificates():
    """Get all certificates for the student, including locked ones for incomplete courses"""
    try:
        student_id = int(get_jwt_identity())
        certificates = CertificateService.get_student_certificates(student_id, include_completion=True)

        return jsonify({
            "success": True,
            "data": {
                "certificates": certificates,
                "total_count": len(certificates)
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"my-certificates route error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to load certificates"
        }), 500

@certificate_bp.route("/my-badges", methods=["GET"])
@student_required
def get_my_badges():
    """Get all badges earned by the student"""
    try:
        student_id = int(get_jwt_identity())
        badges = CertificateService.get_student_badges(student_id)

        # Group badges by category
        badges_by_category = {}
        for badge in badges:
            category = badge['badge']['category']
            if category not in badges_by_category:
                badges_by_category[category] = []
            badges_by_category[category].append(badge)

        return jsonify({
            "success": True,
            "data": {
                "badges": badges,
                "badges_by_category": badges_by_category,
                "total_count": len(badges)
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"my-badges route error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to load badges"
        }), 500

@certificate_bp.route("/available-badges", methods=["GET"])
@student_required
def get_available_badges():
    """Get all available skill badges"""
    try:
        available_badges = CertificateService.get_available_badges()

        # Group by category and difficulty
        badges_by_category = {}
        badges_by_difficulty = {}

        for badge in available_badges:
            category = badge['category']
            difficulty = badge['difficulty_level']

            if category not in badges_by_category:
                badges_by_category[category] = []
            badges_by_category[category].append(badge)

            if difficulty not in badges_by_difficulty:
                badges_by_difficulty[difficulty] = []
            badges_by_difficulty[difficulty].append(badge)

        return jsonify({
            "success": True,
            "data": {
                "available_badges": available_badges,
                "badges_by_category": badges_by_category,
                "badges_by_difficulty": badges_by_difficulty
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"available-badges route error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to load available badges"
        }), 500

@certificate_bp.route("/transcript", methods=["GET"])
@student_required
def get_transcript():
    """Get comprehensive student transcript"""
    try:
        student_id = int(get_jwt_identity())
        transcript = CertificateService.generate_transcript(student_id)

        if "error" in transcript:
            return jsonify({"error": transcript["error"]}), 400

        return jsonify({
            "success": True,
            "data": transcript
        }), 200

    except Exception as e:
        current_app.logger.error(f"transcript route error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to generate transcript"
        }), 500

@certificate_bp.route("/download/<int:certificate_id>", methods=["GET"])
@student_required
def download_certificate(certificate_id):
    """Download certificate as PDF file"""
    try:
        student_id = int(get_jwt_identity())

        from ..models.student_models import Certificate
        import traceback

        certificate = Certificate.query.filter_by(
            id=certificate_id, student_id=student_id, is_active=True
        ).first()

        if not certificate:
            current_app.logger.error(f"Certificate not found: ID={certificate_id}, Student={student_id}")
            return jsonify({
                "success": False,
                "error": "Certificate not found"
            }), 404

        # Check if certificate is unlocked (course completed)
        if certificate.enrollment and not (certificate.enrollment.completed_at or certificate.enrollment.status == 'completed'):
            current_app.logger.warning(f"Attempted download of locked certificate: ID={certificate_id}")
            return jsonify({
                "success": False,
                "error": "Certificate is locked. Complete the course to download."
            }), 403

        pdf_buffer = CertificateService.generate_certificate_pdf(certificate)

        if not pdf_buffer:
            current_app.logger.error(f"PDF generation returned None for certificate ID={certificate_id}")
            return jsonify({
                "success": False,
                "error": "Failed to generate PDF. Please try again or contact support."
            }), 500

        filename = _safe_certificate_filename(certificate, 'pdf')

        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )

    except Exception as e:
        current_app.logger.error(f"Certificate download error: {str(e)}")
        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            "success": False,
            "error": "Failed to generate the certificate PDF"
        }), 500

@certificate_bp.route("/download-image/<int:certificate_id>", methods=["GET"])
@student_required
def download_certificate_image(certificate_id):
    """Download certificate as PNG image file"""
    try:
        student_id = int(get_jwt_identity())

        from ..models.student_models import Certificate
        import traceback

        certificate = Certificate.query.filter_by(
            id=certificate_id, student_id=student_id, is_active=True
        ).first()

        if not certificate:
            current_app.logger.error(f"Certificate not found: ID={certificate_id}, Student={student_id}")
            return jsonify({
                "success": False,
                "error": "Certificate not found"
            }), 404

        # Check if certificate is unlocked (course completed)
        if certificate.enrollment and not (certificate.enrollment.completed_at or certificate.enrollment.status == 'completed'):
            current_app.logger.warning(f"Attempted download of locked certificate: ID={certificate_id}")
            return jsonify({
                "success": False,
                "error": "Certificate is locked. Complete the course to download."
            }), 403

        img_buffer = CertificateService.generate_certificate_image(certificate)

        if not img_buffer:
            current_app.logger.error(f"PNG generation returned None for certificate ID={certificate_id}")
            return jsonify({
                "success": False,
                "error": "Failed to generate image. Please try PDF download instead."
            }), 500

        filename = _safe_certificate_filename(certificate, 'png')

        return send_file(
            img_buffer,
            mimetype='image/png',
            as_attachment=True,
            download_name=filename
        )

    except Exception as e:
        current_app.logger.error(f"Certificate image download error: {str(e)}")
        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            "success": False,
            "error": "Failed to generate the certificate image"
        }), 500

@certificate_bp.route("/badge-progress", methods=["GET"])
@student_required
def get_badge_progress():
    """Get progress towards earning badges (real, data-driven)."""
    try:
        student_id = int(get_jwt_identity())
        progress = CertificateService.get_badge_progress(student_id)

        return jsonify({
            "success": True,
            "data": progress
        }), 200

    except Exception as e:
        current_app.logger.error(f"badge-progress route error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to load badge progress"
        }), 500

@certificate_bp.route("/achievements-summary", methods=["GET"])
@student_required
def get_achievements_summary():
    """Get summary of all achievements (real, data-driven)."""
    try:
        student_id = int(get_jwt_identity())
        summary = CertificateService.get_achievements_summary(student_id)

        return jsonify({
            "success": True,
            "data": summary
        }), 200

    except Exception as e:
        current_app.logger.error(f"achievements-summary route error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to load achievements summary"
        }), 500
