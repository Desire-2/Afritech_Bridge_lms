"""
🔗 Payment Verification Routes – Afritech Bridge LMS
Public endpoint for verifying payment authenticity via QR code on payment slips.
"""

import logging
from flask import Blueprint, jsonify
from ..models.course_models import Enrollment, Course
from ..models.course_application import CourseApplication
from ..models.user_models import User
from ..services.waitlist_service import WaitlistService

logger = logging.getLogger(__name__)

payment_verify_bp = Blueprint("payment_verify", __name__, url_prefix="/api/v1/payments")


@payment_verify_bp.route("/verify/<verification_hash>", methods=["GET"])
def verify_payment_by_hash(verification_hash):
    """
    🔍 Public endpoint: Verify payment authenticity using the verification hash
    from the QR code on a payment slip.

    Returns payment details if the hash is valid, or an error if not found.
    This endpoint is intentionally public (no auth required) so anyone with
    the QR code can verify the payment.
    """
    try:
        if not verification_hash or len(verification_hash) < 8:
            return jsonify({
                "success": False,
                "error": "Invalid verification hash"
            }), 400

        # Find enrollment by verification hash
        enrollment = Enrollment.query.filter_by(
            payment_verification_hash=verification_hash
        ).first()

        if not enrollment:
            return jsonify({
                "success": False,
                "error": "Payment record not found. The verification link may be invalid."
            }), 404

        # Get related data
        student = User.query.get(enrollment.student_id)
        course = Course.query.get(enrollment.course_id)

        if not student or not course:
            return jsonify({
                "success": False,
                "error": "Associated records not found"
            }), 404

        # Get cohort payment info
        payment_info = WaitlistService.get_enrollment_cohort_payment_info(enrollment)

        student_name = f"{student.first_name} {student.last_name}".strip() or student.username

        return jsonify({
            "success": True,
            "data": {
                "verified": True,
                "verification_hash": verification_hash,
                "student_name": student_name,
                "course_title": course.title,
                "cohort_label": enrollment.cohort_label or (enrollment.application_window.cohort_label if enrollment.application_window else None),
                "amount_paid": enrollment.amount_paid or payment_info.get('cohort_effective_price', 0),
                "currency": enrollment.payment_currency or payment_info.get('cohort_currency', 'USD'),
                "payment_status": enrollment.payment_status or "completed",
                "payment_verified": enrollment.payment_verified,
                "payment_verified_at": enrollment.payment_verified_at.isoformat() if enrollment.payment_verified_at else None,
                "enrollment_id": enrollment.id,
                "receipt_number": f"RCP-{enrollment.payment_verified_at.strftime('%Y%m%d') if enrollment.payment_verified_at else '000000'}-{enrollment.id}",
            }
        }), 200

    except Exception as e:
        logger.error(f"Error verifying payment hash {verification_hash}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Verification failed. Please try again later."
        }), 500
