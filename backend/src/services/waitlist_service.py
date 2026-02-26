"""
Waitlist Migration Service – Afritec Bridge LMS

Handles:
 - Migration of waitlisted applications to the next available cohort
 - Payment requirement checks for migrated students
 - Access control based on payment verification
 - Bulk and individual waitlist operations
"""

import logging
from datetime import datetime, timezone
from typing import List, Dict, Tuple, Optional

from ..models.user_models import db, User
from ..models.course_models import Course, ApplicationWindow, Enrollment
from ..models.course_application import CourseApplication

logger = logging.getLogger(__name__)


class WaitlistService:
    """Service for managing waitlist-to-next-cohort migrations and payment verification."""

    # ─────────────────────────────────────────────────────────
    # COHORT DISCOVERY
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def get_next_cohort(course_id: int, current_window_id: Optional[int] = None) -> Optional[ApplicationWindow]:
        """
        Find the next available (open or upcoming) cohort for a course.
        If current_window_id is provided, find the next cohort after that one.
        """
        now = datetime.now(timezone.utc)

        query = ApplicationWindow.query.filter_by(course_id=course_id)

        if current_window_id:
            current = ApplicationWindow.query.get(current_window_id)
            if current and current.opens_at:
                # Find windows that open after the current one
                query = query.filter(
                    db.or_(
                        ApplicationWindow.opens_at > current.opens_at,
                        db.and_(
                            ApplicationWindow.opens_at == current.opens_at,
                            ApplicationWindow.id > current_window_id
                        )
                    )
                )
            else:
                query = query.filter(ApplicationWindow.id != current_window_id)

        # Get windows that are open or upcoming
        windows = query.order_by(ApplicationWindow.opens_at.asc().nullslast()).all()

        for window in windows:
            status = window.compute_status(now)
            if status in ('open', 'upcoming'):
                # Check capacity
                if window.max_students:
                    current_count = window.get_enrollment_count()
                    if current_count >= window.max_students:
                        continue  # Full, skip to next
                return window

        return None

    @staticmethod
    def get_waitlisted_applications(
        course_id: int,
        window_id: Optional[int] = None
    ) -> List[CourseApplication]:
        """Get all waitlisted applications for a course, optionally filtered by window."""
        query = CourseApplication.query.filter_by(
            course_id=course_id,
            status='waitlisted'
        ).filter(
            CourseApplication.is_draft == False  # noqa: E712
        )

        if window_id:
            query = query.filter_by(application_window_id=window_id)

        return query.order_by(
            CourseApplication.final_rank_score.desc(),
            CourseApplication.created_at.asc()
        ).all()

    # ─────────────────────────────────────────────────────────
    # SINGLE MIGRATION
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def migrate_application_to_cohort(
        application_id: int,
        target_window_id: int,
        admin_id: int,
        notes: Optional[str] = None
    ) -> Tuple[bool, str, Dict]:
        """
        Migrate a single waitlisted application to a target cohort.
        
        Returns: (success, message, data)
        """
        application = CourseApplication.query.get(application_id)
        if not application:
            return False, "Application not found", {}

        if application.status != 'waitlisted':
            return False, f"Application is not waitlisted (current status: {application.status})", {}

        target_window = ApplicationWindow.query.get(target_window_id)
        if not target_window:
            return False, "Target cohort not found", {}

        if target_window.course_id != application.course_id:
            return False, "Target cohort belongs to a different course", {}

        # Check capacity
        if target_window.max_students:
            current_count = target_window.get_enrollment_count()
            waitlisted_migrating = CourseApplication.query.filter_by(
                migrated_to_window_id=target_window_id,
                status='pending'
            ).count()
            if (current_count + waitlisted_migrating) >= target_window.max_students:
                return False, "Target cohort is at capacity", {}

        try:
            # Track original cohort
            original_window_id = application.application_window_id

            # Update application
            application.original_window_id = original_window_id
            application.migrated_to_window_id = target_window_id
            application.application_window_id = target_window_id
            application.migrated_at = datetime.utcnow()
            application.migration_notes = notes
            application.status = 'pending'  # Reset to pending for new cohort review

            # Update cohort snapshot
            application.cohort_label = target_window.cohort_label
            application.cohort_start_date = target_window.cohort_start
            application.cohort_end_date = target_window.cohort_end

            # Add admin note
            timestamp = datetime.utcnow().isoformat()
            migration_note = f"[{timestamp}] Migrated from cohort {original_window_id} to {target_window_id}"
            if notes:
                migration_note += f": {notes}"
            application.admin_notes = f"{application.admin_notes or ''}\n{migration_note}".strip()

            db.session.commit()

            logger.info(
                f"Application {application_id} migrated from window {original_window_id} "
                f"to window {target_window_id} by admin {admin_id}"
            )

            return True, "Application migrated successfully", {
                "application_id": application.id,
                "original_window_id": original_window_id,
                "target_window_id": target_window_id,
                "new_status": application.status,
                "cohort_label": target_window.cohort_label,
                "requires_payment": _cohort_requires_payment(target_window),
            }

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error migrating application {application_id}: {str(e)}")
            return False, f"Migration failed: {str(e)}", {}

    # ─────────────────────────────────────────────────────────
    # BULK MIGRATION
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def bulk_migrate_waitlist_to_next_cohort(
        course_id: int,
        source_window_id: Optional[int],
        target_window_id: Optional[int],
        admin_id: int,
        max_count: Optional[int] = None,
        notes: Optional[str] = None
    ) -> Tuple[bool, str, Dict]:
        """
        Migrate all (or up to max_count) waitlisted applications from one cohort
        to the next available cohort.
        
        If target_window_id is None, automatically finds the next open/upcoming cohort.
        
        Returns: (success, message, data)
        """
        # Find target cohort
        if target_window_id:
            target_window = ApplicationWindow.query.get(target_window_id)
            if not target_window:
                return False, "Target cohort not found", {}
        else:
            target_window = WaitlistService.get_next_cohort(course_id, source_window_id)
            if not target_window:
                return False, "No next cohort available for migration", {}

        # Get waitlisted applications
        applications = WaitlistService.get_waitlisted_applications(course_id, source_window_id)

        if not applications:
            return True, "No waitlisted applications to migrate", {"migrated": 0, "total": 0}

        if max_count:
            applications = applications[:max_count]

        # Check capacity
        available_spots = None
        if target_window.max_students:
            current_count = target_window.get_enrollment_count()
            available_spots = target_window.max_students - current_count
            if available_spots <= 0:
                return False, "Target cohort is at full capacity", {"capacity": target_window.max_students}
            applications = applications[:available_spots]

        migrated = []
        failed = []
        requires_payment = _cohort_requires_payment(target_window)

        for app in applications:
            success, msg, data = WaitlistService.migrate_application_to_cohort(
                application_id=app.id,
                target_window_id=target_window.id,
                admin_id=admin_id,
                notes=notes
            )
            if success:
                migrated.append(data)
            else:
                failed.append({"application_id": app.id, "error": msg})

        return True, f"Migrated {len(migrated)} of {len(applications)} applications", {
            "migrated_count": len(migrated),
            "failed_count": len(failed),
            "total_waitlisted": len(applications),
            "target_window_id": target_window.id,
            "target_cohort_label": target_window.cohort_label,
            "requires_payment": requires_payment,
            "migrated": migrated,
            "failed": failed,
        }

    # ─────────────────────────────────────────────────────────
    # PAYMENT VERIFICATION
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def check_enrollment_payment_status(enrollment_id: int) -> Dict:
        """
        Check the payment status for an enrollment.
        Returns a dict with payment details and access status.
        """
        enrollment = Enrollment.query.get(enrollment_id)
        if not enrollment:
            return {"error": "Enrollment not found"}

        course = enrollment.course
        window = enrollment.application_window

        # Resolve window for legacy enrollments
        if window is None and course:
            window = ApplicationWindow.query.filter_by(
                course_id=course.id
            ).order_by(ApplicationWindow.id.desc()).first()

        # Determine if payment is required for this enrollment
        requires_payment = False
        if window:
            requires_payment = _cohort_requires_payment(window)
        elif course:
            requires_payment = course.enrollment_type == 'paid'

        # For free cohorts or verified payments, access is granted
        if not requires_payment:
            return {
                "enrollment_id": enrollment.id,
                "requires_payment": False,
                "payment_status": "not_required",
                "payment_verified": True,
                "access_allowed": True,
            }

        return {
            "enrollment_id": enrollment.id,
            "requires_payment": True,
            "payment_status": enrollment.payment_status or "pending",
            "payment_verified": enrollment.payment_verified,
            "access_allowed": enrollment.payment_verified or enrollment.status == 'active' and enrollment.payment_status in ('completed', 'waived'),
            "migrated_from_window_id": enrollment.migrated_from_window_id,
        }

    @staticmethod
    def verify_enrollment_payment(
        enrollment_id: int,
        admin_id: int,
        payment_status: str = 'completed',
        notes: Optional[str] = None
    ) -> Tuple[bool, str, Dict]:
        """
        Admin action to verify/update payment status for an enrollment.
        
        payment_status: 'completed', 'waived', 'pending', 'failed'
        """
        enrollment = Enrollment.query.get(enrollment_id)
        if not enrollment:
            return False, "Enrollment not found", {}

        try:
            enrollment.payment_status = payment_status
            enrollment.payment_verified = payment_status in ('completed', 'waived')
            
            if enrollment.payment_verified:
                enrollment.payment_verified_at = datetime.utcnow()
                enrollment.payment_verified_by = admin_id
                # Activate enrollment if it was pending payment
                if enrollment.status == 'pending_payment':
                    enrollment.status = 'active'

            db.session.commit()

            logger.info(
                f"Enrollment {enrollment_id} payment status updated to '{payment_status}' "
                f"(verified={enrollment.payment_verified}) by admin {admin_id}"
            )

            return True, f"Payment status updated to {payment_status}", {
                "enrollment_id": enrollment.id,
                "payment_status": enrollment.payment_status,
                "payment_verified": enrollment.payment_verified,
                "enrollment_status": enrollment.status,
            }

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error verifying payment for enrollment {enrollment_id}: {str(e)}")
            return False, f"Failed to update payment: {str(e)}", {}

    # ─────────────────────────────────────────────────────────
    # ACCESS CONTROL
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def is_enrollment_access_allowed(enrollment: Enrollment) -> Tuple[bool, str]:
        """
        Check if a student should be allowed to access course content
        based on enrollment status and payment verification.
        
        Returns: (allowed, reason)
        """
        # Terminated or suspended enrollments never have access
        if enrollment.status in ('terminated', 'suspended'):
            return False, f"Enrollment is {enrollment.status}"

        # Check if the cohort requires payment
        window = enrollment.application_window
        course = enrollment.course

        # Resolve window for legacy enrollments (don't lazy-patch here,
        # get_enrollment_cohort_payment_info will handle that)
        if window is None and course:
            window = ApplicationWindow.query.filter_by(
                course_id=course.id
            ).order_by(ApplicationWindow.id.desc()).first()

        requires_payment = False
        if window:
            requires_payment = _cohort_requires_payment(window)
        elif course:
            requires_payment = course.enrollment_type == 'paid'

        if not requires_payment:
            # Free cohort — always allow active enrollments
            if enrollment.status in ('active', 'completed'):
                return True, "Free enrollment - access granted"
            return False, f"Enrollment status: {enrollment.status}"

        # Paid cohort — require payment verification
        if enrollment.payment_verified:
            if enrollment.status in ('active', 'completed'):
                return True, "Payment verified - access granted"
            return False, f"Enrollment status: {enrollment.status}"

        if enrollment.payment_status in ('completed', 'waived'):
            # Payment completed but not yet verified by admin — still allow
            return True, "Payment completed (pending admin verification)"

        # Payment not completed + not verified = BLOCK ACCESS
        return False, "Payment required - access blocked until payment is verified"

    @staticmethod
    def _resolve_enrollment_window(enrollment: Enrollment) -> Optional[ApplicationWindow]:
        """
        Try to find the correct ApplicationWindow for an enrollment that has
        no ``application_window_id`` set (legacy data).

        Resolution order:
        1. Via linked application (application_id → CourseApplication.application_window_id)
        2. Via matching application by student_id + course_id
        3. Via enrollment.cohort_label → matching window for the same course
        4. Fallback: latest window for the course

        When a window is resolved, the enrollment is **lazily updated** so
        subsequent lookups are instant.
        """
        window: Optional[ApplicationWindow] = None
        course_id = enrollment.course_id

        # 1) Via linked application
        if enrollment.application_id:
            try:
                app = CourseApplication.query.get(enrollment.application_id)
                if app and app.application_window_id:
                    window = ApplicationWindow.query.get(app.application_window_id)
            except Exception:
                pass

        # 2) Via matching application by student + course
        if not window:
            try:
                app = CourseApplication.query.filter_by(
                    course_id=course_id,
                    status='approved'
                ).filter(
                    db.or_(
                        CourseApplication.student_id == enrollment.student_id,
                        CourseApplication.email == (
                            User.query.get(enrollment.student_id).email
                            if enrollment.student_id else None
                        )
                    )
                ).order_by(CourseApplication.created_at.desc()).first()
                if app and app.application_window_id:
                    window = ApplicationWindow.query.get(app.application_window_id)
            except Exception:
                pass

        # 3) Via cohort_label on the enrollment itself
        if not window and enrollment.cohort_label:
            window = ApplicationWindow.query.filter_by(
                course_id=course_id,
                cohort_label=enrollment.cohort_label
            ).first()

        # 4) Fallback: latest window for the course
        if not window:
            window = ApplicationWindow.query.filter_by(
                course_id=course_id
            ).order_by(ApplicationWindow.id.desc()).first()

        # Lazy-patch the enrollment so future lookups are instant
        if window:
            try:
                enrollment.application_window_id = window.id
                if not enrollment.cohort_label and window.cohort_label:
                    enrollment.cohort_label = window.cohort_label
                if not enrollment.cohort_start_date and window.cohort_start:
                    enrollment.cohort_start_date = window.cohort_start
                if not enrollment.cohort_end_date and window.cohort_end:
                    enrollment.cohort_end_date = window.cohort_end
                db.session.commit()
                logger.info(
                    f"Lazy-linked enrollment {enrollment.id} → window {window.id} "
                    f"({window.cohort_label})"
                )
            except Exception as e:
                logger.warning(f"Could not lazy-patch enrollment {enrollment.id}: {e}")
                db.session.rollback()

        return window

    @staticmethod
    def get_enrollment_cohort_payment_info(enrollment: Enrollment) -> Dict:
        """
        Build cohort-level payment details for an enrollment.
        Returns a dict with cohort enrollment type, scholarship info, pricing,
        and access status.  This is the SINGLE source of truth for frontend
        payment display — it always reads from the cohort (ApplicationWindow),
        never from the course, so full-scholarship / partial-scholarship /
        full-tuition are all correctly represented.

        If the enrollment has no application_window_id set (legacy data), the
        method will attempt to resolve the correct window automatically.
        """
        window = enrollment.application_window
        course = enrollment.course

        # ── Resolve window for legacy enrollments ──
        if window is None and course:
            window = WaitlistService._resolve_enrollment_window(enrollment)

        # Determine access
        access_allowed, access_reason = WaitlistService.is_enrollment_access_allowed(enrollment)
        requires_payment = False
        if window:
            requires_payment = _cohort_requires_payment(window)
        elif course:
            requires_payment = course.enrollment_type == 'paid'

        info: Dict = {
            # Identity
            'enrollment_status': enrollment.status,
            'cohort_label': enrollment.cohort_label or (window.cohort_label if window else None),
            'application_window_id': enrollment.application_window_id,
            # Payment booleans
            'payment_status': enrollment.payment_status,
            'payment_verified': enrollment.payment_verified,
            'payment_required': requires_payment and not enrollment.payment_verified
                                and enrollment.payment_status not in ('completed', 'waived'),
            'access_allowed': access_allowed,
            'access_reason': access_reason,
        }

        if window:
            ps = window.get_payment_summary()
            info.update({
                'cohort_enrollment_type': window.get_effective_enrollment_type(),
                'cohort_scholarship_type': window.scholarship_type,       # 'full', 'partial', or None
                'cohort_scholarship_percentage': window.scholarship_percentage,
                'cohort_effective_price': window.get_effective_price(),
                'cohort_currency': window.get_effective_currency(),
                'cohort_payment_mode': ps.get('payment_mode', 'full'),
                'cohort_amount_due': ps.get('amount_due_now'),
                'cohort_original_price': ps.get('original_price'),
                'cohort_remaining_balance': ps.get('remaining_balance', 0),
                'cohort_installment_enabled': ps.get('installment_enabled', False),
                'cohort_installment_count': ps.get('installment_count'),
            })
        else:
            # Fallback — no cohort AND no windows exist for course, read from course
            info.update({
                'cohort_enrollment_type': course.enrollment_type if course else 'free',
                'cohort_scholarship_type': None,
                'cohort_scholarship_percentage': None,
                'cohort_effective_price': course.price if course and course.enrollment_type == 'paid' else 0,
                'cohort_currency': course.currency if course else 'USD',
                'cohort_payment_mode': 'full',
                'cohort_amount_due': course.price if course and course.enrollment_type == 'paid' else 0,
                'cohort_original_price': course.price if course else None,
                'cohort_remaining_balance': 0,
                'cohort_installment_enabled': False,
                'cohort_installment_count': None,
            })

        return info

    @staticmethod
    def set_enrollment_pending_payment(
        enrollment_id: int,
    ) -> Tuple[bool, str]:
        """
        Mark an enrollment as pending payment. 
        Used when a student is approved in a paid cohort but hasn't paid yet.
        """
        enrollment = Enrollment.query.get(enrollment_id)
        if not enrollment:
            return False, "Enrollment not found"

        enrollment.status = 'pending_payment'
        enrollment.payment_status = 'pending'
        enrollment.payment_verified = False
        db.session.commit()

        return True, "Enrollment set to pending_payment"

    # ─────────────────────────────────────────────────────────
    # APPROVE WITH PAYMENT CHECK
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def should_require_payment_on_approval(application: CourseApplication) -> bool:
        """
        Determine if payment should be required when approving an application.
        Checks the target cohort's enrollment type.
        """
        window = None
        if application.application_window_id:
            window = ApplicationWindow.query.get(application.application_window_id)

        if window:
            return _cohort_requires_payment(window)

        course = Course.query.get(application.course_id)
        if course:
            return course.enrollment_type == 'paid'

        return False

    @staticmethod
    def get_waitlist_migration_summary(course_id: int) -> Dict:
        """
        Get a summary of waitlist migration status for a course.
        Shows: waitlisted count per cohort, next available cohort, payment requirement.
        """
        course = Course.query.get(course_id)
        if not course:
            return {"error": "Course not found"}

        windows = ApplicationWindow.query.filter_by(
            course_id=course_id
        ).order_by(ApplicationWindow.opens_at.asc().nullslast()).all()

        now = datetime.now(timezone.utc)
        cohort_summary = []

        for window in windows:
            status = window.compute_status(now)
            waitlisted_count = CourseApplication.query.filter_by(
                course_id=course_id,
                application_window_id=window.id,
                status='waitlisted'
            ).filter(CourseApplication.is_draft == False).count()  # noqa: E712

            migrated_in_count = CourseApplication.query.filter_by(
                migrated_to_window_id=window.id
            ).count()

            enrollment_count = window.get_enrollment_count()
            requires_payment = _cohort_requires_payment(window)

            cohort_summary.append({
                "window_id": window.id,
                "cohort_label": window.cohort_label,
                "status": status,
                "waitlisted_count": waitlisted_count,
                "migrated_in_count": migrated_in_count,
                "enrollment_count": enrollment_count,
                "max_students": window.max_students,
                "available_spots": (window.max_students - enrollment_count) if window.max_students else None,
                "requires_payment": requires_payment,
                "effective_enrollment_type": window.get_effective_enrollment_type(),
                "effective_price": window.get_effective_price(),
                "effective_currency": window.get_effective_currency(),
            })

        # Find next available cohort
        next_cohort = WaitlistService.get_next_cohort(course_id)

        return {
            "course_id": course_id,
            "course_title": course.title,
            "cohorts": cohort_summary,
            "next_available_cohort": {
                "window_id": next_cohort.id,
                "cohort_label": next_cohort.cohort_label,
                "requires_payment": _cohort_requires_payment(next_cohort),
            } if next_cohort else None,
            "total_waitlisted": sum(c["waitlisted_count"] for c in cohort_summary),
        }


# ─────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────

def _cohort_requires_payment(window: ApplicationWindow) -> bool:
    """Check if a cohort (ApplicationWindow) requires payment."""
    etype = window.get_effective_enrollment_type()
    if etype == 'paid':
        return True
    if etype == 'scholarship' and window.scholarship_type == 'partial':
        return True
    return False
