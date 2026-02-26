# Course Management API Routes for Afritec Bridge LMS

from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

# Assuming db and models are correctly set up and accessible.
from ..models.user_models import db, User, Role # For role checking
from ..models.course_models import Course, Module, Lesson, Enrollment, Quiz, Question, Answer, Submission, Announcement, ApplicationWindow
from ..utils.email_notifications import send_announcement_notification

# Helper for role checking (decorator)
from functools import wraps
import logging
import json

logger = logging.getLogger(__name__)


def parse_iso_datetime(value, field_name):
    """Parse ISO datetime strings, accepting Z suffix, returning None for blanks."""
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except Exception as exc:  # pylint: disable=broad-except
        raise ValueError(f"Invalid datetime for {field_name}: {value}") from exc

def get_user_id():
    """Helper function to get user ID as integer from JWT"""
    try:
        user_id = get_jwt_identity()
        return int(user_id) if user_id is not None else None
    except (ValueError, TypeError) as e:
        logger.error(f"ERROR in get_user_id: {e}")
        return None

def role_required(roles):
    def decorator(f):
        @wraps(f)
        @jwt_required()
        def decorated_function(*args, **kwargs):
            current_user_id = get_user_id()
            user = User.query.get(current_user_id)
            if not user or not user.role or user.role.name not in roles:
                return jsonify({"message": "User does not have the required role(s)"}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

course_bp = Blueprint("course_bp", __name__, url_prefix=
"/api/v1/courses")


def _sync_application_windows(course, windows_data):
    """
    Sync ApplicationWindow rows for a course using UPSERT logic.
    - Existing windows (with id) are updated in place to preserve FK references.
    - New windows (without id or id=0) are created.
    - Windows not in the payload are deleted (soft removal).
    Each entry: { id?, cohort_label, opens_at, closes_at, cohort_start, cohort_end, status,
                  enrollment_type?, price?, currency?, scholarship_type?, scholarship_percentage?,
                  payment_mode?, partial_payment_amount?, partial_payment_percentage?,
                  payment_methods?, payment_deadline_days?, require_payment_before_application?,
                  installment_enabled?, installment_count?, installment_interval_days?,
                  max_students?, description? }
    """
    if windows_data is None:
        return
    if not isinstance(windows_data, list):
        return

    existing_windows = {w.id: w for w in ApplicationWindow.query.filter_by(course_id=course.id).all()}
    incoming_ids = set()

    for idx, win in enumerate(windows_data):
        if not isinstance(win, dict):
            continue
        try:
            win_id = win.get("id")
            # Try to match to existing window by numeric ID
            existing = None
            if win_id and isinstance(win_id, int) and win_id in existing_windows:
                existing = existing_windows[win_id]
                incoming_ids.add(win_id)
            elif win_id and str(win_id).isdigit() and int(win_id) in existing_windows:
                existing = existing_windows[int(win_id)]
                incoming_ids.add(int(win_id))

            # Parse dates
            opens_at = parse_iso_datetime(win.get("opens_at") or win.get("opensAt"), f"windows[{idx}].opens_at")
            closes_at = parse_iso_datetime(win.get("closes_at") or win.get("closesAt"), f"windows[{idx}].closes_at")
            cohort_start = parse_iso_datetime(win.get("cohort_start") or win.get("startDate") or win.get("start_date"), f"windows[{idx}].cohort_start")
            cohort_end = parse_iso_datetime(win.get("cohort_end") or win.get("endDate") or win.get("end_date"), f"windows[{idx}].cohort_end")

            # Parse payment override fields
            payment_methods_val = win.get("payment_methods")
            payment_methods_json = json.dumps(payment_methods_val) if payment_methods_val and isinstance(payment_methods_val, list) else None

            def _float_or_none(v):
                if v is None or v == '' or v == 'null':
                    return None
                try:
                    return float(v)
                except (TypeError, ValueError):
                    return None

            def _int_or_none(v):
                if v is None or v == '' or v == 'null':
                    return None
                try:
                    return int(v)
                except (TypeError, ValueError):
                    return None

            def _bool_or_none(v):
                if v is None:
                    return None
                return bool(v)

            label = win.get("cohort_label") or win.get("label") or f"Cohort {idx + 1}"
            status_override = win.get("status_override") or None
            enrollment_type = win.get("enrollment_type") or None
            scholarship_type = win.get("scholarship_type") or None
            scholarship_percentage = _float_or_none(win.get("scholarship_percentage"))
            price_val = _float_or_none(win.get("price"))
            currency_val = win.get("currency") or None
            payment_mode_val = win.get("payment_mode") or None
            pp_amount = _float_or_none(win.get("partial_payment_amount"))
            pp_pct = _float_or_none(win.get("partial_payment_percentage"))
            payment_deadline = _int_or_none(win.get("payment_deadline_days"))
            req_before = _bool_or_none(win.get("require_payment_before_application"))
            inst_enabled = _bool_or_none(win.get("installment_enabled"))
            inst_count = _int_or_none(win.get("installment_count"))
            inst_interval = _int_or_none(win.get("installment_interval_days"))
            max_students = _int_or_none(win.get("max_students"))
            description = win.get("description") or None

            if existing:
                # UPDATE existing window in place (preserves FK references)
                existing.cohort_label = label
                existing.description = description
                existing.opens_at = opens_at
                existing.closes_at = closes_at
                existing.cohort_start = cohort_start
                existing.cohort_end = cohort_end
                existing.status_override = status_override
                existing.max_students = max_students
                existing.enrollment_type = enrollment_type
                existing.price = price_val
                existing.currency = currency_val
                existing.scholarship_type = scholarship_type
                existing.scholarship_percentage = scholarship_percentage
                existing.payment_mode = payment_mode_val
                existing.partial_payment_amount = pp_amount
                existing.partial_payment_percentage = pp_pct
                existing.payment_methods = payment_methods_json
                existing.payment_deadline_days = payment_deadline
                existing.require_payment_before_application = req_before
                existing.installment_enabled = inst_enabled
                existing.installment_count = inst_count
                existing.installment_interval_days = inst_interval
            else:
                # CREATE new window
                new_win = ApplicationWindow(
                    course_id=course.id,
                    cohort_label=label,
                    description=description,
                    opens_at=opens_at,
                    closes_at=closes_at,
                    cohort_start=cohort_start,
                    cohort_end=cohort_end,
                    status_override=status_override,
                    max_students=max_students,
                    enrollment_type=enrollment_type,
                    price=price_val,
                    currency=currency_val,
                    scholarship_type=scholarship_type,
                    scholarship_percentage=scholarship_percentage,
                    payment_mode=payment_mode_val,
                    partial_payment_amount=pp_amount,
                    partial_payment_percentage=pp_pct,
                    payment_methods=payment_methods_json,
                    payment_deadline_days=payment_deadline,
                    require_payment_before_application=req_before,
                    installment_enabled=inst_enabled,
                    installment_count=inst_count,
                    installment_interval_days=inst_interval,
                )
                db.session.add(new_win)
        except ValueError as exc:
            logger.warning(f"Skipping invalid application window {idx}: {exc}")
            continue

    # Delete windows that were not included in the payload
    for win_id, win_obj in existing_windows.items():
        if win_id not in incoming_ids:
            # Check if there are enrollments referencing this window
            enrollment_count = win_obj.enrollments.filter(
                Enrollment.status.in_(['active', 'completed'])
            ).count()
            if enrollment_count == 0:
                db.session.delete(win_obj)
            else:
                logger.warning(f"Keeping window {win_id} (has {enrollment_count} active enrollments)")


# ── Cohort CRUD endpoints ──

@course_bp.route("/<int:course_id>/cohorts", methods=["GET"])
@role_required(["admin", "instructor"])
def list_cohorts(course_id):
    """List all cohorts (application windows) for a course with payment info and enrollment counts."""
    course = Course.query.get_or_404(course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "Not authorized"}), 403

    windows = ApplicationWindow.query.filter_by(course_id=course_id).order_by(ApplicationWindow.opens_at).all()
    return jsonify({
        "cohorts": [w.to_dict() for w in windows],
        "course_payment_defaults": {
            "enrollment_type": course.enrollment_type,
            "price": course.price,
            "currency": course.currency,
            "payment_mode": course.payment_mode,
        }
    }), 200


@course_bp.route("/<int:course_id>/cohorts/<int:cohort_id>", methods=["GET"])
@role_required(["admin", "instructor"])
def get_cohort(course_id, cohort_id):
    """Get a single cohort with full payment details."""
    course = Course.query.get_or_404(course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "Not authorized"}), 403

    window = ApplicationWindow.query.filter_by(id=cohort_id, course_id=course_id).first_or_404()
    return jsonify(window.to_dict()), 200


@course_bp.route("/<int:course_id>/cohorts/<int:cohort_id>", methods=["PUT"])
@role_required(["admin", "instructor"])
def update_cohort(course_id, cohort_id):
    """Update a single cohort's settings including payment overrides."""
    course = Course.query.get_or_404(course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "Not authorized"}), 403

    window = ApplicationWindow.query.filter_by(id=cohort_id, course_id=course_id).first_or_404()
    data = request.get_json()

    try:
        # Date fields
        if "cohort_label" in data:
            window.cohort_label = data.get("cohort_label") or window.cohort_label
        if "description" in data:
            window.description = data.get("description")
        if "opens_at" in data:
            window.opens_at = parse_iso_datetime(data.get("opens_at"), "opens_at")
        if "closes_at" in data:
            window.closes_at = parse_iso_datetime(data.get("closes_at"), "closes_at")
        if "cohort_start" in data:
            window.cohort_start = parse_iso_datetime(data.get("cohort_start"), "cohort_start")
        if "cohort_end" in data:
            window.cohort_end = parse_iso_datetime(data.get("cohort_end"), "cohort_end")
        if "status_override" in data:
            window.status_override = data.get("status_override") or None
        if "max_students" in data:
            val = data.get("max_students")
            window.max_students = int(val) if val is not None else None

        # Payment override fields
        if "enrollment_type" in data:
            et = data.get("enrollment_type")
            if et and et not in ["free", "paid", "scholarship"]:
                return jsonify({"message": "Invalid enrollment_type. Use free, paid, or scholarship."}), 400
            window.enrollment_type = et or None
        if "price" in data:
            val = data.get("price")
            window.price = float(val) if val is not None else None
        if "currency" in data:
            window.currency = data.get("currency") or None
        if "scholarship_type" in data:
            st = data.get("scholarship_type")
            if st and st not in ["full", "partial"]:
                return jsonify({"message": "Invalid scholarship_type. Use full or partial."}), 400
            window.scholarship_type = st or None
        if "scholarship_percentage" in data:
            val = data.get("scholarship_percentage")
            if val is not None:
                val = float(val)
                if val < 0 or val > 100:
                    return jsonify({"message": "scholarship_percentage must be between 0 and 100"}), 400
            window.scholarship_percentage = val
        if "payment_mode" in data:
            pm = data.get("payment_mode")
            if pm and pm not in ["full", "partial"]:
                return jsonify({"message": "Invalid payment_mode"}), 400
            window.payment_mode = pm or None
        if "partial_payment_amount" in data:
            val = data.get("partial_payment_amount")
            window.partial_payment_amount = float(val) if val is not None else None
        if "partial_payment_percentage" in data:
            val = data.get("partial_payment_percentage")
            window.partial_payment_percentage = float(val) if val is not None else None
        if "payment_methods" in data:
            methods = data.get("payment_methods")
            window.payment_methods = json.dumps(methods) if methods and isinstance(methods, list) else None
        if "payment_deadline_days" in data:
            val = data.get("payment_deadline_days")
            window.payment_deadline_days = int(val) if val is not None else None
        if "require_payment_before_application" in data:
            val = data.get("require_payment_before_application")
            window.require_payment_before_application = bool(val) if val is not None else None
        if "installment_enabled" in data:
            val = data.get("installment_enabled")
            window.installment_enabled = bool(val) if val is not None else None
        if "installment_count" in data:
            val = data.get("installment_count")
            window.installment_count = int(val) if val is not None else None
        if "installment_interval_days" in data:
            val = data.get("installment_interval_days")
            window.installment_interval_days = int(val) if val is not None else None

        db.session.commit()
        return jsonify(window.to_dict()), 200
    except ValueError as exc:
        db.session.rollback()
        return jsonify({"message": str(exc)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not update cohort", "error": str(e)}), 500
module_bp = Blueprint("module_bp", __name__, url_prefix="/api/v1/modules")
lesson_bp = Blueprint("lesson_bp", __name__, url_prefix="/api/v1/lessons")
enrollment_bp = Blueprint("enrollment_bp", __name__, url_prefix="/api/v1/enrollments")
quiz_bp = Blueprint("quiz_bp", __name__, url_prefix="/api/v1/quizzes")
submission_bp = Blueprint("submission_bp", __name__, url_prefix="/api/v1/submissions")
announcement_bp = Blueprint("announcement_bp", __name__, url_prefix="/api/v1/announcements")

# --- Course Routes ---
@course_bp.route("", methods=["POST"])
@role_required(["admin", "instructor"])
def create_course():
    try:
        data = request.get_json()
        logger.info(f"[CREATE_COURSE] Received data: {data}")
        
        current_user_id = get_user_id()  # Ensure integer
        logger.info(f"[CREATE_COURSE] Current user ID: {current_user_id}")
        
        user = User.query.get(current_user_id)
        if not user:
            logger.error(f"[CREATE_COURSE] User not found for ID: {current_user_id}")
            return jsonify({"message": "User not found"}), 404
        
        logger.info(f"[CREATE_COURSE] User role: {user.role.name}")

        # Ensure instructor_id is the current user if they are an instructor, or allow admin to set it
        instructor_id_to_set = current_user_id
        if user.role.name == "admin" and data.get("instructor_id"):
            if User.query.get(int(data.get("instructor_id"))):  # Ensure integer
                instructor_id_to_set = int(data.get("instructor_id"))
            else:
                logger.error(f"[CREATE_COURSE] Specified instructor_id not found: {data.get('instructor_id')}")
                return jsonify({"message": "Specified instructor_id not found"}), 400

        logger.info(f"[CREATE_COURSE] Creating course with instructor_id: {instructor_id_to_set}")
        
        # Validate required fields
        if not data.get("title"):
            logger.error("[CREATE_COURSE] Missing required field: title")
            return jsonify({"message": "Missing required field: title"}), 400
        if not data.get("description"):
            logger.error("[CREATE_COURSE] Missing required field: description")
            return jsonify({"message": "Missing required field: description"}), 400
        
        # Check for duplicate title
        existing_course = Course.query.filter_by(title=data["title"]).first()
        if existing_course:
            logger.error(f"[CREATE_COURSE] Course with title '{data['title']}' already exists")
            return jsonify({
                "message": "A course with this title already exists. Please choose a different title.",
                "existing_course_id": existing_course.id
            }), 409  # 409 Conflict

        enrollment_type = data.get("enrollment_type", "free")
        price = data.get("price")
        currency = data.get("currency", "USD")

        if enrollment_type == "paid":
            try:
                if price is None or float(price) <= 0:
                    return jsonify({"message": "Paid courses must have a price greater than 0"}), 400
            except (TypeError, ValueError):
                return jsonify({"message": "Price must be a valid number"}), 400
        
        # Application/cohort settings
        try:
            application_start_date = parse_iso_datetime(data.get("application_start_date"), "application_start_date")
            application_end_date = parse_iso_datetime(data.get("application_end_date"), "application_end_date")
            cohort_start_date = parse_iso_datetime(data.get("cohort_start_date"), "cohort_start_date")
            cohort_end_date = parse_iso_datetime(data.get("cohort_end_date"), "cohort_end_date")
        except ValueError as exc:
            return jsonify({"message": str(exc)}), 400

        if application_start_date and application_end_date and application_end_date < application_start_date:
            return jsonify({"message": "application_end_date must be after application_start_date"}), 400

        if cohort_start_date and cohort_end_date and cohort_end_date < cohort_start_date:
            return jsonify({"message": "cohort_end_date must be after cohort_start_date"}), 400

        if application_end_date and cohort_start_date and cohort_start_date < application_end_date:
            logger.warning("Cohort starts before application window closes; adjusting allowed but logged")

        new_course = Course(
            title=data["title"],
            description=data["description"],
            learning_objectives=data.get("learning_objectives"),
            target_audience=data.get("target_audience"),
            estimated_duration=data.get("estimated_duration"),
            instructor_id=instructor_id_to_set,
            is_published=data.get("is_published", False),
            enrollment_type=enrollment_type,
            price=price,
            currency=currency,
            # Enhanced payment settings
            payment_mode=data.get("payment_mode", "full"),
            partial_payment_amount=data.get("partial_payment_amount"),
            partial_payment_percentage=data.get("partial_payment_percentage"),
            payment_methods=json.dumps(data["payment_methods"]) if data.get("payment_methods") else None,
            payment_deadline_days=data.get("payment_deadline_days"),
            require_payment_before_application=data.get("require_payment_before_application", False),
            paypal_enabled=data.get("paypal_enabled", True),
            mobile_money_enabled=data.get("mobile_money_enabled", True),
            bank_transfer_enabled=data.get("bank_transfer_enabled", False),
            kpay_enabled=data.get("kpay_enabled", True),
            flutterwave_enabled=data.get("flutterwave_enabled", False),
            bank_transfer_details=data.get("bank_transfer_details"),
            installment_enabled=data.get("installment_enabled", False),
            installment_count=data.get("installment_count"),
            installment_interval_days=data.get("installment_interval_days"),
            # Application/cohort settings
            application_start_date=application_start_date,
            application_end_date=application_end_date,
            cohort_start_date=cohort_start_date,
            cohort_end_date=cohort_end_date,
            cohort_label=data.get("cohort_label"),
            application_timezone=data.get("application_timezone") or "UTC"
        )
        logger.info(f"[CREATE_COURSE] Course object created: {new_course.title}")
        
        db.session.add(new_course)
        logger.info("[CREATE_COURSE] Course added to session")
        
        db.session.flush()  # Get new_course.id before adding windows

        # Persist application_windows if provided
        _sync_application_windows(new_course, data.get("application_windows"))

        db.session.commit()
        logger.info(f"[CREATE_COURSE] Course committed with ID: {new_course.id}")
        
        return jsonify(new_course.to_dict()), 201
        
    except KeyError as e:
        logger.error(f"[CREATE_COURSE] KeyError - Missing field: {e}")
        return jsonify({"message": f"Missing field: {e}"}), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"[CREATE_COURSE] Exception occurred: {str(e)}")
        logger.error(f"[CREATE_COURSE] Exception type: {type(e).__name__}")
        import traceback
        logger.error(f"[CREATE_COURSE] Traceback: {traceback.format_exc()}")
        
        # Handle specific database errors
        error_message = str(e)
        if "duplicate key value violates unique constraint" in error_message.lower():
            if "courses_title_key" in error_message:
                return jsonify({
                    "message": "A course with this title already exists. Please choose a different title."
                }), 409
        
        return jsonify({"message": "Could not create course", "error": str(e)}), 500

@course_bp.route("", methods=["GET"])
def get_courses():
    # Add pagination and filtering later
    courses = Course.query.filter_by(is_published=True).all()
    return jsonify([course.to_dict() for course in courses]), 200

@course_bp.route("/all", methods=["GET"])
@role_required(["admin", "instructor"])
def get_all_courses_admin(): # Endpoint for admins/instructors to see all courses (published/unpublished)
    courses = Course.query.all()
    return jsonify([course.to_dict() for course in courses]), 200

@course_bp.route("/<int:course_id>", methods=["GET"])
def get_course(course_id):
    course = Course.query.get_or_404(course_id)
    is_instructor_or_admin = False
    
    try:
        current_user_id = get_user_id()
        user = User.query.get(current_user_id)
        if user and (user.role.name == "admin" or (user.role.name == "instructor" and course.instructor_id == user.id)):
            is_instructor_or_admin = True
    except Exception:
        pass  # Anonymous user or no JWT
    
    if not course.is_published and not is_instructor_or_admin:
        return jsonify({"message": "Course not found or not published"}), 404

    # For students, filter modules based on release settings; instructors see all
    return jsonify(course.to_dict(include_modules=True, for_student=not is_instructor_or_admin)), 200

@course_bp.route("/<int:course_id>", methods=["PUT"])
@role_required(["admin", "instructor"])
def update_course(course_id):
    course = Course.query.get_or_404(course_id)
    current_user_id = get_user_id()  # Ensure integer comparison
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to update this course"}), 403

    data = request.get_json()
    try:
        course.title = data.get("title", course.title)
        course.description = data.get("description", course.description)
        course.learning_objectives = data.get("learning_objectives", course.learning_objectives)
        course.target_audience = data.get("target_audience", course.target_audience)
        course.estimated_duration = data.get("estimated_duration", course.estimated_duration)
        course.is_published = data.get("is_published", course.is_published)

        # Payment & Enrollment settings
        if "enrollment_type" in data:
            enrollment_type = data.get("enrollment_type")
            if enrollment_type not in ["free", "paid", "scholarship"]:
                return jsonify({"message": "Invalid enrollment_type. Use free, paid, or scholarship."}), 400
            course.enrollment_type = enrollment_type

        if "price" in data:
            try:
                course.price = float(data["price"]) if data["price"] is not None else None
            except (TypeError, ValueError):
                return jsonify({"message": "Price must be a valid number"}), 400

        if "currency" in data:
            course.currency = data.get("currency") or course.currency

        # Enhanced payment settings
        if "payment_mode" in data:
            pm = data.get("payment_mode")
            if pm not in ["full", "partial", None]:
                return jsonify({"message": "Invalid payment_mode. Use 'full' or 'partial'."}), 400
            course.payment_mode = pm or "full"

        if "partial_payment_amount" in data:
            val = data.get("partial_payment_amount")
            course.partial_payment_amount = float(val) if val is not None else None

        if "partial_payment_percentage" in data:
            val = data.get("partial_payment_percentage")
            if val is not None:
                val = float(val)
                if val < 0 or val > 100:
                    return jsonify({"message": "partial_payment_percentage must be between 0 and 100"}), 400
            course.partial_payment_percentage = val

        if "payment_methods" in data:
            methods = data.get("payment_methods")
            course.payment_methods = json.dumps(methods) if methods and isinstance(methods, list) else None

        if "payment_deadline_days" in data:
            val = data.get("payment_deadline_days")
            course.payment_deadline_days = int(val) if val is not None else None

        if "require_payment_before_application" in data:
            course.require_payment_before_application = bool(data.get("require_payment_before_application"))

        if "paypal_enabled" in data:
            course.paypal_enabled = bool(data.get("paypal_enabled"))

        if "mobile_money_enabled" in data:
            course.mobile_money_enabled = bool(data.get("mobile_money_enabled"))

        if "bank_transfer_enabled" in data:
            course.bank_transfer_enabled = bool(data.get("bank_transfer_enabled"))

        if "kpay_enabled" in data:
            course.kpay_enabled = bool(data.get("kpay_enabled"))

        if "flutterwave_enabled" in data:
            course.flutterwave_enabled = bool(data.get("flutterwave_enabled"))

        if "bank_transfer_details" in data:
            course.bank_transfer_details = data.get("bank_transfer_details")

        if "installment_enabled" in data:
            course.installment_enabled = bool(data.get("installment_enabled"))

        if "installment_count" in data:
            val = data.get("installment_count")
            course.installment_count = int(val) if val is not None else None

        if "installment_interval_days" in data:
            val = data.get("installment_interval_days")
            course.installment_interval_days = int(val) if val is not None else None

        # Application/Cohort window settings
        try:
            if "application_start_date" in data:
                course.application_start_date = parse_iso_datetime(data.get("application_start_date"), "application_start_date")
            if "application_end_date" in data:
                course.application_end_date = parse_iso_datetime(data.get("application_end_date"), "application_end_date")
            if "cohort_start_date" in data:
                course.cohort_start_date = parse_iso_datetime(data.get("cohort_start_date"), "cohort_start_date")
            if "cohort_end_date" in data:
                course.cohort_end_date = parse_iso_datetime(data.get("cohort_end_date"), "cohort_end_date")
        except ValueError as exc:
            return jsonify({"message": str(exc)}), 400

        if "cohort_label" in data:
            course.cohort_label = data.get("cohort_label") or None
        if "application_timezone" in data and data.get("application_timezone"):
            course.application_timezone = data.get("application_timezone")

        if course.application_start_date and course.application_end_date and course.application_end_date < course.application_start_date:
            return jsonify({"message": "application_end_date must be after application_start_date"}), 400

        if course.cohort_start_date and course.cohort_end_date and course.cohort_end_date < course.cohort_start_date:
            return jsonify({"message": "cohort_end_date must be after cohort_start_date"}), 400

        if course.application_end_date and course.cohort_start_date and course.cohort_start_date < course.application_end_date:
            logger.warning("Cohort starts before application window closes; persisted as requested")

        if course.enrollment_type == "paid":
            if course.price is None or course.price <= 0:
                return jsonify({"message": "Paid courses must have a price greater than 0"}), 400
        
        # Module release settings
        if "start_date" in data:
            if data["start_date"]:
                course.start_date = datetime.fromisoformat(data["start_date"].replace('Z', '+00:00'))
            else:
                course.start_date = None
        
        if "module_release_count" in data:
            course.module_release_count = data["module_release_count"]
        
        if "module_release_interval" in data:
            course.module_release_interval = data["module_release_interval"]
        
        if "module_release_interval_days" in data:
            course.module_release_interval_days = data["module_release_interval_days"]
        
        # Admin can change instructor, instructor cannot
        if user.role.name == "admin" and "instructor_id" in data:
            if User.query.get(data["instructor_id"]):
                course.instructor_id = data["instructor_id"]
            else:
                 return jsonify({"message": "Specified instructor_id not found"}), 400

        # Persist application_windows if provided
        if "application_windows" in data:
            _sync_application_windows(course, data.get("application_windows"))

        db.session.commit()
        return jsonify(course.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not update course", "error": str(e)}), 500

@course_bp.route("/<int:course_id>", methods=["DELETE"])
@role_required(["admin", "instructor"])
def delete_course(course_id):
    course = Course.query.get_or_404(course_id)
    current_user_id = get_user_id()
    
    if current_user_id is None:
        logger.error("Could not extract user ID from JWT token")
        return jsonify({"message": "Authentication error"}), 401
    
    user = User.query.get(current_user_id)

    # Log for debugging
    logger.info(f"Delete course check: course.instructor_id={course.instructor_id} (type: {type(course.instructor_id)}), current_user_id={current_user_id} (type: {type(current_user_id)})")
    
    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        logger.warning(f"User {current_user_id} attempted to delete course {course_id} owned by instructor {course.instructor_id}")
        return jsonify({
            "message": "Forbidden. You do not have permission to perform this action.",
            "error_type": "authorization_error",
            "details": {
                "course_id": course_id,
                "required_instructor_id": course.instructor_id,
                "your_user_id": current_user_id
            }
        }), 403

    try:
        db.session.delete(course)
        db.session.commit()
        logger.info(f"Course {course_id} deleted successfully by user {current_user_id}")
        return jsonify({"message": "Course deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting course {course_id}: {str(e)}", exc_info=True)
        return jsonify({"message": "Could not delete course", "error": str(e)}), 500

@course_bp.route("/<int:course_id>/publish", methods=["POST", "PATCH"])
@role_required(["admin", "instructor"])
def publish_course(course_id):
    course = Course.query.get_or_404(course_id)
    current_user_id = get_user_id()  # Ensure integer comparison
    user = User.query.get(current_user_id)
    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "Not authorized"}), 403
    course.is_published = True
    db.session.commit()
    return jsonify({"message": "Course published", "course": course.to_dict()}), 200

@course_bp.route("/<int:course_id>/unpublish", methods=["POST", "PATCH"])
@role_required(["admin", "instructor"])
def unpublish_course(course_id):
    course = Course.query.get_or_404(course_id)
    current_user_id = get_user_id()  # Ensure integer comparison
    user = User.query.get(current_user_id)
    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "Not authorized"}), 403
    course.is_published = False
    db.session.commit()
    return jsonify({"message": "Course unpublished", "course": course.to_dict()}), 200

@course_bp.route("/<int:course_id>/module-release-status", methods=["GET"])
@role_required(["admin", "instructor"])
def get_module_release_status(course_id):
    """Get the module release status for instructor dashboard."""
    course = Course.query.get_or_404(course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to view this course"}), 403

    all_modules = list(course.modules.order_by(Module.order).all())
    released_modules = course.get_released_modules()
    released_module_ids = [m.id for m in released_modules]
    
    modules_status = []
    for module in all_modules:
        is_auto_released = module.id in released_module_ids and not module.is_released
        modules_status.append({
            'id': module.id,
            'title': module.title,
            'order': module.order,
            'is_released': module.id in released_module_ids,
            'is_manually_released': module.is_released,
            'is_auto_released': is_auto_released,
            'released_at': module.released_at.isoformat() if module.released_at else None,
            'lesson_count': module.lessons.count()
        })
    
    return jsonify({
        'course_id': course_id,
        'start_date': course.start_date.isoformat() if course.start_date else None,
        'module_release_count': course.module_release_count,
        'module_release_interval': course.module_release_interval,
        'module_release_interval_days': course.module_release_interval_days,
        'total_modules': len(all_modules),
        'released_modules_count': len(released_modules),
        'modules': modules_status
    }), 200

@course_bp.route("/<int:course_id>/module-release-settings", methods=["PUT", "PATCH"])
@role_required(["admin", "instructor"])
def update_module_release_settings(course_id):
    """Update module release settings for a course."""
    from datetime import datetime
    
    course = Course.query.get_or_404(course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to update this course"}), 403

    data = request.get_json()
    try:
        if "start_date" in data:
            if data["start_date"]:
                course.start_date = datetime.fromisoformat(data["start_date"].replace('Z', '+00:00'))
            else:
                course.start_date = None
        
        if "module_release_count" in data:
            course.module_release_count = data["module_release_count"]
        
        if "module_release_interval" in data:
            course.module_release_interval = data["module_release_interval"]
        
        if "module_release_interval_days" in data:
            course.module_release_interval_days = data["module_release_interval_days"]

        db.session.commit()
        logger.info(f"Module release settings updated for course {course_id} by user {current_user_id}")
        return jsonify({
            "message": "Module release settings updated",
            "course": course.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not update settings", "error": str(e)}), 500

@course_bp.route("/<int:course_id>/instructor-details", methods=["GET"])
@role_required(["admin", "instructor"])
def get_course_instructor_details(course_id):
    course = Course.query.get_or_404(course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to view details for this course"}), 403

    # Get enrolled students with progress
    enrollments = Enrollment.query.filter_by(course_id=course_id).all()
    enrolled_students = []
    for enrollment in enrollments:
        student_data = {
            'id': enrollment.student.id,
            'name': f"{enrollment.student.first_name} {enrollment.student.last_name}",
            'username': enrollment.student.username,
            'progress': enrollment.progress * 100,  # Convert to percentage
            'enrollment_date': enrollment.enrollment_date.isoformat(),
            'completed_at': enrollment.completed_at.isoformat() if enrollment.completed_at else None
        }
        enrolled_students.append(student_data)

    # Get course data with modules and announcements
    course_data = course.to_dict(include_modules=True, include_announcements=True)
    course_data['enrolled_students'] = enrolled_students
    course_data['enrollment_count'] = len(enrolled_students)

    return jsonify(course_data), 200

# --- Module Routes (nested under courses for creation) ---
@course_bp.route("/<int:course_id>/modules", methods=["POST"])
@role_required(["admin", "instructor"])
def create_module_for_course(course_id):
    course = Course.query.get_or_404(course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to add modules to this course"}), 403

    data = request.get_json()
    try:
        new_module = Module(
            title=data["title"],
            description=data.get("description"),
            course_id=course_id,
            order=data.get("order", 0)
        )
        db.session.add(new_module)
        db.session.commit()
        return jsonify(new_module.to_dict()), 201
    except KeyError as e:
        return jsonify({"message": f"Missing field: {e}"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not create module", "error": str(e)}), 500

@course_bp.route("/<int:course_id>/modules", methods=["GET"])
# Publicly accessible if course is published, or if user is admin/instructor
def get_modules_for_course(course_id):
    course = Course.query.get_or_404(course_id)
    is_instructor_or_admin = False
    
    try:
        current_user_id = get_user_id()
        user = User.query.get(current_user_id)
        if user and (user.role.name == "admin" or (user.role.name == "instructor" and course.instructor_id == user.id)):
            is_instructor_or_admin = True
    except Exception:
        pass  # Anonymous user or no JWT
    
    if not course.is_published and not is_instructor_or_admin:
        return jsonify({"message": "Course not found or not published"}), 404

    # For students, return only released modules; for instructors, return all
    if is_instructor_or_admin:
        modules = Module.query.filter_by(course_id=course_id).order_by(Module.order).all()
    else:
        modules = course.get_released_modules()
    
    result = [module.to_dict() for module in modules]
    
    # Add metadata for students about total vs released modules
    if not is_instructor_or_admin:
        all_modules = Module.query.filter_by(course_id=course_id).all()
        return jsonify({
            "modules": result,
            "total_module_count": len(all_modules),
            "released_module_count": len(modules)
        }), 200
    
    return jsonify(result), 200

@module_bp.route("/<int:module_id>", methods=["GET"])
# Similar visibility logic as get_modules_for_course based on parent course
def get_module(module_id):
    module = Module.query.get_or_404(module_id)
    course = Course.query.get_or_404(module.course_id)
    is_instructor_or_admin = False
    
    try:
        current_user_id = get_user_id()
        user = User.query.get(current_user_id)
        if user and (user.role.name == "admin" or (user.role.name == "instructor" and course.instructor_id == user.id)):
            is_instructor_or_admin = True
    except Exception:
        pass  # Anonymous user or no JWT
    
    if not course.is_published and not is_instructor_or_admin:
        return jsonify({"message": "Module not found or part of an unpublished course"}), 404
    
    # For students, check if this module is released
    if not is_instructor_or_admin:
        released_modules = course.get_released_modules()
        released_module_ids = [m.id for m in released_modules]
        if module.id not in released_module_ids:
            return jsonify({"message": "This module is not available yet"}), 403
    
    return jsonify(module.to_dict(include_lessons=True)), 200

@module_bp.route("/<int:module_id>/release", methods=["POST", "PATCH"])
@role_required(["admin", "instructor"])
def release_module(module_id):
    """Manually release a module, making it available to students."""
    from datetime import datetime
    
    module = Module.query.get_or_404(module_id)
    course = Course.query.get_or_404(module.course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to release this module"}), 403

    try:
        module.is_released = True
        module.released_at = datetime.utcnow()
        db.session.commit()
        logger.info(f"Module {module_id} manually released by user {current_user_id}")
        return jsonify({
            "message": "Module released successfully",
            "module": module.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not release module", "error": str(e)}), 500

@module_bp.route("/<int:module_id>/unrelease", methods=["POST", "PATCH"])
@role_required(["admin", "instructor"])
def unrelease_module(module_id):
    """Revoke manual release of a module."""
    module = Module.query.get_or_404(module_id)
    course = Course.query.get_or_404(module.course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to modify this module"}), 403

    try:
        module.is_released = False
        module.released_at = None
        db.session.commit()
        logger.info(f"Module {module_id} release revoked by user {current_user_id}")
        return jsonify({
            "message": "Module release revoked",
            "module": module.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not unrelease module", "error": str(e)}), 500

@module_bp.route("/<int:module_id>", methods=["PUT"])
@role_required(["admin", "instructor"])
def update_module(module_id):
    module = Module.query.get_or_404(module_id)
    course = Course.query.get_or_404(module.course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to update this module"}), 403

    data = request.get_json()
    try:
        module.title = data.get("title", module.title)
        module.description = data.get("description", module.description)
        module.order = data.get("order", module.order)
        db.session.commit()
        return jsonify(module.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not update module", "error": str(e)}), 500

@module_bp.route("/<int:module_id>", methods=["DELETE"])
@role_required(["admin", "instructor"])
def delete_module(module_id):
    module = Module.query.get_or_404(module_id)
    course = Course.query.get_or_404(module.course_id)
    current_user_id = get_user_id()
    
    if current_user_id is None:
        logger.error("Could not extract user ID from JWT token")
        return jsonify({"message": "Authentication error"}), 401
    
    user = User.query.get(current_user_id)

    # Log for debugging
    logger.info(f"Delete module check: course.instructor_id={course.instructor_id} (type: {type(course.instructor_id)}), current_user_id={current_user_id} (type: {type(current_user_id)})")
    
    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        logger.warning(f"User {current_user_id} attempted to delete module {module_id} from course {course.id} owned by instructor {course.instructor_id}")
        return jsonify({
            "message": "Forbidden. You do not have permission to perform this action.",
            "error_type": "authorization_error",
            "details": {
                "module_id": module_id,
                "course_id": course.id,
                "required_instructor_id": course.instructor_id,
                "your_user_id": current_user_id
            }
        }), 403

    try:
        db.session.delete(module)
        db.session.commit()
        logger.info(f"Module {module_id} deleted successfully by user {current_user_id}")
        return jsonify({"message": "Module deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting module {module_id}: {str(e)}", exc_info=True)
        return jsonify({"message": "Could not delete module", "error": str(e)}), 500

# --- Lesson Routes (nested under modules for creation) ---
@module_bp.route("/<int:module_id>/lessons", methods=["POST"])
@role_required(["admin", "instructor"])
def create_lesson_for_module(module_id):
    module = Module.query.get_or_404(module_id)
    course = Course.query.get_or_404(module.course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to add lessons to this module"}), 403

    data = request.get_json()
    try:
        new_lesson = Lesson(
            title=data["title"],
            content_type=data["content_type"],
            content_data=data["content_data"],
            module_id=module_id,
            order=data.get("order", 0)
        )
        db.session.add(new_lesson)
        db.session.commit()
        return jsonify(new_lesson.to_dict()), 201
    except KeyError as e:
        return jsonify({"message": f"Missing field: {e}"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not create lesson", "error": str(e)}), 500

@module_bp.route("/<int:module_id>/lessons", methods=["GET"])
# Similar visibility logic as get_module based on parent course
def get_lessons_for_module(module_id):
    module = Module.query.get_or_404(module_id)
    course = Course.query.get_or_404(module.course_id)
    if not course.is_published:
        try:
            current_user_id = get_user_id()
            user = User.query.get(current_user_id)
            if not user or (user.role.name not in ["admin", "instructor"] or (user.role.name == "instructor" and course.instructor_id != user.id)):
                return jsonify({"message": "Module not found or part of an unpublished course"}), 404
        except Exception:
             return jsonify({"message": "Module not found or part of an unpublished course"}), 404

    lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
    return jsonify([lesson.to_dict() for lesson in lessons]), 200

@lesson_bp.route("/<int:lesson_id>", methods=["GET"])
# Similar visibility logic
def get_lesson(lesson_id):
    lesson = Lesson.query.get_or_404(lesson_id)
    module = Module.query.get_or_404(lesson.module_id)
    course = Course.query.get_or_404(module.course_id)
    if not course.is_published:
        try:
            current_user_id = get_user_id()
            user = User.query.get(current_user_id)
            if not user or (user.role.name not in ["admin", "instructor"] or (user.role.name == "instructor" and course.instructor_id != user.id)):
                return jsonify({"message": "Lesson not found or part of an unpublished course"}), 404
        except Exception:
             return jsonify({"message": "Lesson not found or part of an unpublished course"}), 404
    return jsonify(lesson.to_dict()), 200

@lesson_bp.route("/<int:lesson_id>", methods=["PUT"])
@role_required(["admin", "instructor"])
def update_lesson(lesson_id):
    lesson = Lesson.query.get_or_404(lesson_id)
    module = Module.query.get_or_404(lesson.module_id)
    course = Course.query.get_or_404(module.course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to update this lesson"}), 403

    data = request.get_json()
    try:
        lesson.title = data.get("title", lesson.title)
        lesson.content_type = data.get("content_type", lesson.content_type)
        lesson.content_data = data.get("content_data", lesson.content_data)
        lesson.order = data.get("order", lesson.order)
        db.session.commit()
        return jsonify(lesson.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not update lesson", "error": str(e)}), 500

# --- Announcement Routes ---
@course_bp.route("/<int:course_id>/announcements", methods=["POST"])
@role_required(["admin", "instructor"])
def create_announcement_for_course(course_id):
    course = Course.query.get_or_404(course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to create announcements for this course"}), 403

    data = request.get_json()
    try:
        new_announcement = Announcement(
            course_id=course_id,
            instructor_id=current_user_id,
            title=data["title"],
            content=data["content"]
        )
        db.session.add(new_announcement)
        db.session.commit()
        
        # Send email notification to all enrolled students
        email_results = {"sent": 0, "failed": 0, "total": 0}
        try:
            enrollments = Enrollment.query.filter_by(course_id=course_id).all()
            students = [User.query.get(enrollment.student_id) for enrollment in enrollments]
            students = [s for s in students if s and s.email]  # Filter out None and no email
            
            if students:
                logger.info(f"📧 Preparing announcement notification for {len(students)} students")
                logger.info(f"   Course: {course.title}")
                logger.info(f"   Title: {new_announcement.title}")
                
                email_results = send_announcement_notification(
                    announcement=new_announcement,
                    course=course,
                    students=students
                )
                
                logger.info(f"✅ Announcement emails: {email_results['sent']} sent, {email_results['failed']} failed out of {email_results['total']} students")
                
                if email_results['failed'] > 0:
                    logger.warning(f"⚠️ {email_results['failed']} announcement emails failed to send")
            else:
                logger.info(f"🔕 No students with email addresses found for course {course_id}")
        except Exception as email_error:
            logger.error(f"❌ Error sending announcement notifications: {str(email_error)}")
            # Don't fail the request if emails fail
        
        return jsonify(new_announcement.to_dict()), 201
    except KeyError as e:
        return jsonify({"message": f"Missing field: {e}"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not create announcement", "error": str(e)}), 500

@course_bp.route("/<int:course_id>/announcements", methods=["GET"])
def get_announcements_for_course(course_id):
    course = Course.query.get_or_404(course_id)
    if not course.is_published:
        try:
            current_user_id = get_user_id()
            user = User.query.get(current_user_id)
            if not user or (user.role.name not in ["admin", "instructor"] or (user.role.name == "instructor" and course.instructor_id != user.id)):
                return jsonify({"message": "Course not found or not published"}), 404
        except Exception:
             return jsonify({"message": "Course not found or not published"}), 404

    announcements = Announcement.query.filter_by(course_id=course_id).order_by(Announcement.created_at.desc()).all()
    return jsonify([ann.to_dict() for ann in announcements]), 200

@announcement_bp.route("/<int:announcement_id>", methods=["PUT"])
@role_required(["admin", "instructor"])
def update_announcement(announcement_id):
    announcement = Announcement.query.get_or_404(announcement_id)
    course = Course.query.get_or_404(announcement.course_id)
    current_user_id = get_user_id()
    user = User.query.get(current_user_id)

    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        return jsonify({"message": "You are not authorized to update this announcement"}), 403

    data = request.get_json()
    try:
        announcement.title = data.get("title", announcement.title)
        announcement.content = data.get("content", announcement.content)
        db.session.commit()
        return jsonify(announcement.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not update announcement", "error": str(e)}), 500

@announcement_bp.route("/<int:announcement_id>", methods=["DELETE"])
@role_required(["admin", "instructor"])
def delete_announcement(announcement_id):
    announcement = Announcement.query.get_or_404(announcement_id)
    course = Course.query.get_or_404(announcement.course_id)
    current_user_id = get_user_id()
    
    if current_user_id is None:
        logger.error("Could not extract user ID from JWT token")
        return jsonify({"message": "Authentication error"}), 401
    
    user = User.query.get(current_user_id)

    # Log for debugging
    logger.info(f"Delete announcement check: course.instructor_id={course.instructor_id} (type: {type(course.instructor_id)}), current_user_id={current_user_id} (type: {type(current_user_id)})")
    
    if user.role.name == "instructor" and course.instructor_id != current_user_id:
        logger.warning(f"User {current_user_id} attempted to delete announcement {announcement_id} from course {course.id} owned by instructor {course.instructor_id}")
        return jsonify({
            "message": "Forbidden. You do not have permission to perform this action.",
            "error_type": "authorization_error",
            "details": {
                "announcement_id": announcement_id,
                "course_id": course.id,
                "required_instructor_id": course.instructor_id,
                "your_user_id": current_user_id
            }
        }), 403

    try:
        db.session.delete(announcement)
        db.session.commit()
        logger.info(f"Announcement {announcement_id} deleted successfully by user {current_user_id}")
        return jsonify({"message": "Announcement deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting announcement {announcement_id}: {str(e)}", exc_info=True)
        return jsonify({"message": "Could not delete announcement", "error": str(e)}), 500


# --- ENROLLMENT ROUTES (Enhanced) ---

@enrollment_bp.route("", methods=["GET"])
@jwt_required()
def get_my_enrollments():
    """
    Get all enrollments for the current user with detailed course and progress information.
    """
    current_user_id = get_user_id()
    if not current_user_id:
        return jsonify({"error": "Authentication error"}), 401
    
    try:
        enrollments = Enrollment.query.filter_by(student_id=current_user_id).all()
        
        result = []
        for enrollment in enrollments:
            course = enrollment.course
            
            # Get module count and completion
            total_modules = course.modules.count()
            from ..models.student_models import ModuleProgress
            completed_modules = ModuleProgress.query.filter_by(
                student_id=current_user_id,
                enrollment_id=enrollment.id
            ).filter(ModuleProgress.progress >= 1.0).count()
            
            # Get overall course score
            course_score = enrollment.calculate_course_score()
            
            result.append({
                "id": enrollment.id,
                "course": {
                    "id": course.id,
                    "title": course.title,
                    "description": course.description,
                    "instructor_name": f"{course.instructor.first_name} {course.instructor.last_name}",
                    "is_published": course.is_published
                },
                "enrollment_date": enrollment.enrollment_date.isoformat(),
                "progress": enrollment.progress,
                "course_score": round(course_score, 2),
                "total_modules": total_modules,
                "completed_modules": completed_modules,
                "completed_at": enrollment.completed_at.isoformat() if enrollment.completed_at else None,
                "is_completed": enrollment.completed_at is not None
            })
        
        return jsonify({
            "success": True,
            "enrollments": result,
            "total": len(result)
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching enrollments: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to fetch enrollments", "details": str(e)}), 500


@enrollment_bp.route("/check/<int:course_id>", methods=["GET"])
@jwt_required()
def check_enrollment(course_id):
    """
    Check if current user is enrolled in a specific course.
    """
    current_user_id = get_user_id()
    if not current_user_id:
        return jsonify({"error": "Authentication error"}), 401
    
    enrollment = Enrollment.query.filter_by(
        student_id=current_user_id,
        course_id=course_id
    ).first()
    
    if enrollment:
        return jsonify({
            "enrolled": True,
            "enrollment_id": enrollment.id,
            "enrollment_date": enrollment.enrollment_date.isoformat(),
            "progress": enrollment.progress,
            "course_score": round(enrollment.calculate_course_score(), 2)
        }), 200
    else:
        return jsonify({
            "enrolled": False
        }), 200


@enrollment_bp.route("/statistics", methods=["GET"])
@jwt_required()
def get_enrollment_statistics():
    """
    Get enrollment statistics for the current user.
    """
    current_user_id = get_user_id()
    if not current_user_id:
        return jsonify({"error": "Authentication error"}), 401
    
    try:
        total_enrollments = Enrollment.query.filter_by(student_id=current_user_id).count()
        completed_enrollments = Enrollment.query.filter_by(
            student_id=current_user_id
        ).filter(Enrollment.completed_at.isnot(None)).count()
        
        in_progress = total_enrollments - completed_enrollments
        
        # Calculate average score across all enrollments
        enrollments = Enrollment.query.filter_by(student_id=current_user_id).all()
        total_score = sum(enrollment.calculate_course_score() for enrollment in enrollments)
        average_score = (total_score / total_enrollments) if total_enrollments > 0 else 0
        
        return jsonify({
            "success": True,
            "statistics": {
                "total_enrollments": total_enrollments,
                "completed_courses": completed_enrollments,
                "in_progress": in_progress,
                "average_score": round(average_score, 2),
                "completion_rate": round((completed_enrollments / total_enrollments * 100), 1) if total_enrollments > 0 else 0
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error calculating statistics: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to calculate statistics"}), 500


@enrollment_bp.route("/<int:enrollment_id>", methods=["GET"])
@jwt_required()
def get_enrollment_detail(enrollment_id):
    """
    Get detailed information about a specific enrollment.
    """
    current_user_id = get_user_id()
    if not current_user_id:
        return jsonify({"error": "Authentication error"}), 401
    
    enrollment = Enrollment.query.get_or_404(enrollment_id)
    
    # Verify ownership
    if enrollment.student_id != current_user_id:
        user = User.query.get(current_user_id)
        if not user or user.role.name not in ["admin", "instructor"]:
            return jsonify({"error": "Unauthorized access"}), 403
    
    course = enrollment.course
    from ..models.student_models import ModuleProgress
    
    # Get module progress details
    module_progress_list = []
    for module in course.modules.order_by(Module.order).all():
        progress = ModuleProgress.query.filter_by(
            student_id=enrollment.student_id,
            module_id=module.id,
            enrollment_id=enrollment.id
        ).first()
        
        module_progress_list.append({
            "module_id": module.id,
            "module_title": module.title,
            "module_order": module.order,
            "progress": progress.progress if progress else 0.0,
            "module_score": round(progress.calculate_module_score(), 2) if progress else 0.0,
            "completed": progress.progress >= 1.0 if progress else False
        })
    
    return jsonify({
        "success": True,
        "enrollment": {
            "id": enrollment.id,
            "course_id": course.id,
            "course_title": course.title,
            "enrollment_date": enrollment.enrollment_date.isoformat(),
            "progress": enrollment.progress,
            "course_score": round(enrollment.calculate_course_score(), 2),
            "completed_at": enrollment.completed_at.isoformat() if enrollment.completed_at else None,
            "modules": module_progress_list
        }
    }), 200