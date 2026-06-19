"""
🔗 Payment Verification Routes – Afritech Bridge LMS
Public endpoint for verifying payment authenticity via QR code on payment slips.
"""

import hashlib
import logging
from datetime import datetime
from flask import Blueprint, jsonify
from ..models.course_models import Enrollment, Course
from ..models.course_application import CourseApplication
from ..models.user_models import User
from ..services.waitlist_service import WaitlistService

logger = logging.getLogger(__name__)

payment_verify_bp = Blueprint("payment_verify", __name__, url_prefix="/api/v1/payments")


def _build_verification_response(record, source, verification_hash):
    """Shared helper to build verification response from an Enrollment or CourseApplication."""
    if source == 'enrollment':
        enrollment = record
        student = User.query.get(enrollment.student_id)
        course = Course.query.get(enrollment.course_id)
        if not student or not course:
            return None
        student_name = f"{student.first_name} {student.last_name}".strip() or student.username
        payment_info = WaitlistService.get_enrollment_cohort_payment_info(enrollment)
        effective_amount = enrollment.amount_paid or payment_info.get('cohort_effective_price', 0)
        effective_currency = enrollment.payment_currency or payment_info.get('cohort_currency', 'USD')
        payment_status = enrollment.payment_status or "completed"
        payment_verified = enrollment.payment_verified
        payment_verified_at = enrollment.payment_verified_at
        cohort_label = enrollment.cohort_label or (enrollment.application_window.cohort_label if enrollment.application_window else None)
        record_id_for_receipt = enrollment.id
    else:
        # Application-level payment
        app = record
        course = Course.query.get(app.course_id)
        if not course:
            return None
        student_name = app.full_name or "Student"
        # Resolve effective amount from the application's cohort window
        effective_amount = app.amount_paid or 0
        effective_currency = app.payment_currency or course.currency or 'USD'
        if app.application_window_id:
            from ..models.course_models import ApplicationWindow
            window = ApplicationWindow.query.get(app.application_window_id)
            if window:
                effective_amount = window.get_effective_price() or effective_amount
                effective_currency = window.get_effective_currency() or effective_currency
        payment_status = app.payment_status or "completed"
        payment_verified = payment_status in ("completed", "confirmed")
        payment_verified_at = app.reviewed_at or app.updated_at
        cohort_label = app.cohort_label
        record_id_for_receipt = app.id

    # Extract scholarship info
    scholarship_info = None
    scholarship_type = None
    scholarship_percentage = None
    original_price = None

    app_window = None
    if source == 'enrollment':
        app_window = enrollment.application_window
        if not app_window:
            app_window = getattr(enrollment, 'application_window', None)
    else:
        if app.application_window_id:
            from ..models.course_models import ApplicationWindow
            app_window = ApplicationWindow.query.get(app.application_window_id)

    if app_window:
        scholarship_type = getattr(app_window, 'scholarship_type', None)
        scholarship_percentage = getattr(app_window, 'scholarship_percentage', None)
        original_price = float(getattr(app_window, 'price', 0) or (getattr(app_window.course, 'price', 0) if getattr(app_window, 'course', None) else 0))

    if scholarship_type:
        scholarship_info = {
            'scholarship_type': scholarship_type,
            'scholarship_percentage': float(scholarship_percentage) if scholarship_percentage else None,
            'original_price': float(original_price) if original_price else None,
            'effective_amount': float(effective_amount) if effective_amount else 0,
            'currency': effective_currency,
        }

    verified_on = payment_verified_at
    receipt_date = verified_on.strftime('%Y%m%d') if verified_on else '000000'

    return {
        'verified': True,
        'verification_hash': verification_hash,
        'student_name': student_name,
        'course_title': course.title,
        'cohort_label': cohort_label,
        'amount_paid': float(effective_amount) if effective_amount else 0,
        'currency': effective_currency,
        'payment_status': payment_status,
        'payment_verified': bool(payment_verified),
        'payment_verified_at': verified_on.isoformat() if verified_on else None,
        'enrollment_id': record.id if source == 'enrollment' else None,
        'application_id': record.id if source == 'application' else None,
        'receipt_number': f"RCP-{receipt_date}-{record_id_for_receipt}",
        'source': source,
        'scholarship_info': scholarship_info,
    }


@payment_verify_bp.route("/verify/<verification_hash>", methods=["GET"])
def verify_payment_by_hash(verification_hash):
    """
    🔍 Public endpoint: Verify payment authenticity using the verification hash
    from the QR code on a payment slip.

    Searches both Enrollment and CourseApplication records so that both
    enrollment-level and application-level payment slips can be verified.

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

        # 1) Try Enrollment first (most common — post-enrollment)
        enrollment = Enrollment.query.filter_by(
            payment_verification_hash=verification_hash
        ).first()

        if enrollment:
            data = _build_verification_response(enrollment, 'enrollment', verification_hash)
            if data:
                return jsonify({"success": True, "data": data}), 200

        # 2) Try CourseApplication (pre-enrollment — when payment is confirmed before enrollment)
        app = CourseApplication.query.filter_by(
            payment_verification_hash=verification_hash
        ).first()

        if app:
            data = _build_verification_response(app, 'application', verification_hash)
            if data:
                return jsonify({"success": True, "data": data}), 200

        # 3) Not found in either table
        return jsonify({
            "success": False,
            "error": "Payment record not found. The verification link may be invalid or expired."
        }), 404

    except Exception as e:
        logger.error(f"Error verifying payment hash {verification_hash}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Verification failed. Please try again later."
        }), 500
