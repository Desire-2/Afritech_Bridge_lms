"""
Waitlist Management Routes – Afritec Bridge LMS

Admin endpoints for:
 - Viewing waitlist migration summary
 - Migrating individual or bulk waitlisted applications to next cohort
 - Verifying/updating enrollment payment status
 - Checking student access status
"""

import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

from ..models.user_models import db, User
from ..models.course_models import Course, ApplicationWindow, Enrollment
from ..models.course_application import CourseApplication
from ..services.waitlist_service import WaitlistService
from ..utils.brevo_email_service import brevo_service

logger = logging.getLogger(__name__)

waitlist_bp = Blueprint("waitlist_bp", __name__, url_prefix="/api/v1/admin/waitlist")


def _require_admin_or_instructor():
    """Helper to verify admin or instructor role."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user or user.role.name not in ('admin', 'instructor'):
        return None, user_id
    return user, user_id


# ─────────────────────────────────────────────────────────
# MIGRATION SUMMARY
# ─────────────────────────────────────────────────────────

@waitlist_bp.route("/summary/<int:course_id>", methods=["GET"])
@jwt_required()
def get_migration_summary(course_id):
    """
    Get waitlist migration summary for a course.
    Shows: waitlisted count per cohort, next available cohort, payment requirements.
    """
    user, user_id = _require_admin_or_instructor()
    if not user:
        return jsonify({"error": "Admin or instructor access required"}), 403

    summary = WaitlistService.get_waitlist_migration_summary(course_id)
    if "error" in summary:
        return jsonify(summary), 404

    return jsonify({"success": True, "data": summary}), 200


# ─────────────────────────────────────────────────────────
# SINGLE MIGRATION
# ─────────────────────────────────────────────────────────

@waitlist_bp.route("/migrate/<int:application_id>", methods=["POST"])
@jwt_required()
def migrate_single_application(application_id):
    """
    Migrate a single waitlisted application to a target cohort.
    
    Body JSON:
      - target_window_id (required): ID of the target cohort
      - notes (optional): Admin migration notes
      - send_email (optional): Whether to send notification email (default: true)
    """
    user, user_id = _require_admin_or_instructor()
    if not user:
        return jsonify({"error": "Admin or instructor access required"}), 403

    data = request.get_json() or {}
    target_window_id = data.get("target_window_id")
    notes = data.get("notes")
    send_email = data.get("send_email", True)

    if not target_window_id:
        return jsonify({"error": "target_window_id is required"}), 400

    success, message, result = WaitlistService.migrate_application_to_cohort(
        application_id=application_id,
        target_window_id=target_window_id,
        admin_id=user_id,
        notes=notes
    )

    if not success:
        return jsonify({"error": message}), 400

    # Send migration notification email
    email_sent = False
    if send_email:
        try:
            application = CourseApplication.query.get(application_id)
            target_window = ApplicationWindow.query.get(target_window_id)
            course = Course.query.get(application.course_id)

            if application and target_window and course:
                requires_payment = result.get("requires_payment", False)
                email_html = _build_migration_email(
                    application=application,
                    course=course,
                    target_window=target_window,
                    requires_payment=requires_payment
                )
                email_sent = brevo_service.send_email(
                    to_emails=[application.email],
                    subject=f"📋 Application Update - {course.title} (New Cohort)",
                    html_content=email_html
                )
                if email_sent:
                    logger.info(f"✅ Migration email sent to {application.email}")
        except Exception as e:
            logger.error(f"❌ Error sending migration email: {str(e)}")

    result["email_sent"] = email_sent

    return jsonify({"success": True, "message": message, "data": result}), 200


# ─────────────────────────────────────────────────────────
# BULK MIGRATION
# ─────────────────────────────────────────────────────────

@waitlist_bp.route("/migrate-bulk", methods=["POST"])
@jwt_required()
def bulk_migrate_waitlist():
    """
    Migrate all waitlisted applications from one cohort to the next.
    
    Body JSON:
      - course_id (required): Course ID
      - source_window_id (optional): Source cohort window ID (filter)
      - target_window_id (optional): Target cohort window ID (auto-detect if omitted)
      - max_count (optional): Max number of applications to migrate
      - notes (optional): Admin migration notes
      - send_emails (optional): Send notification emails (default: true)
    """
    user, user_id = _require_admin_or_instructor()
    if not user:
        return jsonify({"error": "Admin or instructor access required"}), 403

    data = request.get_json() or {}
    course_id = data.get("course_id")
    if not course_id:
        return jsonify({"error": "course_id is required"}), 400

    success, message, result = WaitlistService.bulk_migrate_waitlist_to_next_cohort(
        course_id=course_id,
        source_window_id=data.get("source_window_id"),
        target_window_id=data.get("target_window_id"),
        admin_id=user_id,
        max_count=data.get("max_count"),
        notes=data.get("notes")
    )

    if not success:
        return jsonify({"error": message, "data": result}), 400

    # Send batch notification emails
    if data.get("send_emails", True) and result.get("migrated"):
        _send_bulk_migration_emails(result, course_id)

    return jsonify({"success": True, "message": message, "data": result}), 200


# ─────────────────────────────────────────────────────────
# AUTO-DETECT NEXT COHORT
# ─────────────────────────────────────────────────────────

@waitlist_bp.route("/next-cohort/<int:course_id>", methods=["GET"])
@jwt_required()
def get_next_cohort_for_course(course_id):
    """Get the next available cohort for migration."""
    user, user_id = _require_admin_or_instructor()
    if not user:
        return jsonify({"error": "Admin or instructor access required"}), 403

    current_window_id = request.args.get("current_window_id", type=int)
    next_cohort = WaitlistService.get_next_cohort(course_id, current_window_id)

    if not next_cohort:
        return jsonify({
            "success": True,
            "data": None,
            "message": "No upcoming cohort found"
        }), 200

    from ..services.waitlist_service import _cohort_requires_payment

    return jsonify({
        "success": True,
        "data": {
            "window_id": next_cohort.id,
            "cohort_label": next_cohort.cohort_label,
            "status": next_cohort.compute_status(),
            "opens_at": next_cohort.opens_at.isoformat() if next_cohort.opens_at else None,
            "cohort_start": next_cohort.cohort_start.isoformat() if next_cohort.cohort_start else None,
            "max_students": next_cohort.max_students,
            "enrollment_count": next_cohort.get_enrollment_count(),
            "requires_payment": _cohort_requires_payment(next_cohort),
            "effective_enrollment_type": next_cohort.get_effective_enrollment_type(),
            "effective_price": next_cohort.get_effective_price(),
            "effective_currency": next_cohort.get_effective_currency(),
        }
    }), 200


# ─────────────────────────────────────────────────────────
# PAYMENT VERIFICATION
# ─────────────────────────────────────────────────────────

@waitlist_bp.route("/enrollment/<int:enrollment_id>/payment", methods=["GET"])
@jwt_required()
def get_enrollment_payment_status(enrollment_id):
    """Check payment status for an enrollment."""
    user, user_id = _require_admin_or_instructor()
    if not user:
        return jsonify({"error": "Admin or instructor access required"}), 403

    result = WaitlistService.check_enrollment_payment_status(enrollment_id)
    if "error" in result:
        return jsonify(result), 404

    return jsonify({"success": True, "data": result}), 200


@waitlist_bp.route("/enrollment/<int:enrollment_id>/verify-payment", methods=["POST"])
@jwt_required()
def verify_enrollment_payment(enrollment_id):
    """
    Admin action: Verify or update payment status for an enrollment.
    
    Body JSON:
      - payment_status (required): 'completed', 'waived', 'pending', 'failed'
      - notes (optional): Admin notes
    """
    user, user_id = _require_admin_or_instructor()
    if not user:
        return jsonify({"error": "Admin or instructor access required"}), 403

    data = request.get_json() or {}
    payment_status = data.get("payment_status")
    if not payment_status or payment_status not in ('completed', 'waived', 'pending', 'failed'):
        return jsonify({"error": "payment_status must be one of: completed, waived, pending, failed"}), 400

    success, message, result = WaitlistService.verify_enrollment_payment(
        enrollment_id=enrollment_id,
        admin_id=user_id,
        payment_status=payment_status,
        notes=data.get("notes")
    )

    if not success:
        return jsonify({"error": message}), 400

    return jsonify({"success": True, "message": message, "data": result}), 200


@waitlist_bp.route("/enrollments/unpaid", methods=["GET"])
@jwt_required()
def list_unpaid_enrollments():
    """
    List all enrollments that require payment but haven't been verified.
    Useful for admins to see who needs to pay.
    
    Query params:
      - course_id (optional): Filter by course
      - window_id (optional): Filter by cohort window
    """
    user, user_id = _require_admin_or_instructor()
    if not user:
        return jsonify({"error": "Admin or instructor access required"}), 403

    course_id = request.args.get("course_id", type=int)
    window_id = request.args.get("window_id", type=int)

    query = Enrollment.query.filter(
        Enrollment.payment_verified == False,  # noqa: E712
        Enrollment.status.in_(['active', 'pending_payment'])
    )

    if course_id:
        query = query.filter_by(course_id=course_id)
    if window_id:
        query = query.filter_by(application_window_id=window_id)

    enrollments = query.all()

    # Filter to only include enrollments in paid cohorts
    unpaid = []
    from ..services.waitlist_service import _cohort_requires_payment

    for enrollment in enrollments:
        window = enrollment.application_window
        course = enrollment.course

        requires_payment = False
        if window:
            requires_payment = _cohort_requires_payment(window)
        elif course:
            requires_payment = course.enrollment_type == 'paid'

        if requires_payment:
            student = enrollment.student
            # Build cohort-level payment info
            cohort_payment = {}
            if window:
                cohort_payment = {
                    "cohort_enrollment_type": window.get_effective_enrollment_type(),
                    "cohort_scholarship_type": window.scholarship_type,
                    "cohort_scholarship_percentage": window.scholarship_percentage,
                    "cohort_effective_price": window.get_effective_price(),
                    "cohort_currency": window.get_effective_currency(),
                }
            elif course:
                cohort_payment = {
                    "cohort_enrollment_type": course.enrollment_type,
                    "cohort_scholarship_type": None,
                    "cohort_scholarship_percentage": None,
                    "cohort_effective_price": course.price,
                    "cohort_currency": course.currency or 'USD',
                }
            unpaid.append({
                "enrollment_id": enrollment.id,
                "student_id": enrollment.student_id,
                "student_name": f"{student.first_name or ''} {student.last_name or ''}".strip() or student.username if student else "Unknown",
                "student_email": student.email if student else None,
                "course_id": enrollment.course_id,
                "course_title": course.title if course else None,
                "cohort_label": enrollment.cohort_label,
                "application_window_id": enrollment.application_window_id,
                "enrollment_date": enrollment.enrollment_date.isoformat(),
                "status": enrollment.status,
                "payment_status": enrollment.payment_status,
                "payment_verified": enrollment.payment_verified,
                "migrated_from_window_id": enrollment.migrated_from_window_id,
                **cohort_payment,
            })

    return jsonify({
        "success": True,
        "data": unpaid,
        "count": len(unpaid)
    }), 200


# ─────────────────────────────────────────────────────────
# STUDENT SELF-CHECK
# ─────────────────────────────────────────────────────────

@waitlist_bp.route("/my-payment-status", methods=["GET"])
@jwt_required()
def my_payment_status():
    """
    Student-facing endpoint to check their payment/access status for all enrollments.
    """
    student_id = int(get_jwt_identity())
    enrollments = Enrollment.query.filter_by(student_id=student_id).all()

    result = []
    from ..services.waitlist_service import WaitlistService

    for enrollment in enrollments:
        access_allowed, access_reason = WaitlistService.is_enrollment_access_allowed(enrollment)
        payment_info = WaitlistService.check_enrollment_payment_status(enrollment.id)

        result.append({
            "enrollment_id": enrollment.id,
            "course_id": enrollment.course_id,
            "course_title": enrollment.course.title if enrollment.course else None,
            "cohort_label": enrollment.cohort_label,
            "enrollment_status": enrollment.status,
            "access_allowed": access_allowed,
            "access_reason": access_reason,
            "payment_status": payment_info.get("payment_status"),
            "payment_verified": payment_info.get("payment_verified"),
            "requires_payment": payment_info.get("requires_payment"),
        })

    return jsonify({"success": True, "data": result}), 200


# ─────────────────────────────────────────────────────────
# EMAIL HELPERS
# ─────────────────────────────────────────────────────────

def _build_migration_email(application, course, target_window, requires_payment=False):
    """Build HTML email for migration notification."""
    payment_notice = ""
    if requires_payment:
        price = target_window.get_effective_price()
        currency = target_window.get_effective_currency()
        payment_notice = f"""
        <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <h3 style="color: #856404; margin-top: 0;">⚠️ Payment Required</h3>
            <p style="color: #856404;">
                This cohort requires a payment of <strong>{currency} {price:.2f}</strong> to access course content.
                Your enrollment will remain on hold until payment is confirmed.
            </p>
            <p style="color: #856404;">
                Please complete your payment as soon as possible to secure your spot and gain access to the learning materials.
            </p>
        </div>
        """
    else:
        payment_notice = """
        <div style="background-color: #d4edda; border: 1px solid #28a745; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #155724;">
                ✅ <strong>No payment required</strong> — this cohort is free! You'll receive access once your application is approved.
            </p>
        </div>
        """

    cohort_info = f"""
    <div style="background-color: #e8f4fd; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <h3 style="margin-top: 0;">New Cohort Details</h3>
        <p><strong>Cohort:</strong> {target_window.cohort_label or 'New Cohort'}</p>
        {"<p><strong>Starts:</strong> " + target_window.cohort_start.strftime('%B %d, %Y') + "</p>" if target_window.cohort_start else ""}
        {"<p><strong>Application closes:</strong> " + target_window.closes_at.strftime('%B %d, %Y') + "</p>" if target_window.closes_at else ""}
    </div>
    """

    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0;">Application Update</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">Your application has been moved to a new cohort</p>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 12px 12px;">
            <p>Hello <strong>{application.full_name}</strong>,</p>
            
            <p>
                We're reaching out about your application for <strong>{course.title}</strong>.
                You were previously on a waitlist, and we're pleased to inform you that your 
                application has been transferred to a new cohort!
            </p>
            
            {cohort_info}
            {payment_notice}
            
            <p>Your application is now under review for this new cohort. 
            We'll notify you once a decision is made.</p>
            
            <p style="margin-top: 24px;">
                Best regards,<br>
                <strong>Afritec Bridge LMS Team</strong>
            </p>
        </div>
    </div>
    """


def _send_bulk_migration_emails(result, course_id):
    """Send notification emails for bulk migration."""
    try:
        course = Course.query.get(course_id)
        target_window_id = result.get("target_window_id")
        target_window = ApplicationWindow.query.get(target_window_id) if target_window_id else None

        if not course or not target_window:
            return

        for migrated_app in result.get("migrated", []):
            app_id = migrated_app.get("application_id")
            application = CourseApplication.query.get(app_id)
            if not application:
                continue

            try:
                email_html = _build_migration_email(
                    application=application,
                    course=course,
                    target_window=target_window,
                    requires_payment=migrated_app.get("requires_payment", False)
                )
                brevo_service.send_email(
                    to_emails=[application.email],
                    subject=f"📋 Application Update - {course.title} (New Cohort)",
                    html_content=email_html
                )
            except Exception as e:
                logger.error(f"Failed to send migration email to {application.email}: {str(e)}")

    except Exception as e:
        logger.error(f"Error in bulk migration emails: {str(e)}")
