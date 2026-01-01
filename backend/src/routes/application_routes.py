from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from ..models.course_application import CourseApplication
from ..models.user_models import db, User, Role
from ..models.course_models import Enrollment
from ..utils.application_scoring import (
    calculate_risk,
    calculate_application_score,
    calculate_final_rank,
    calculate_readiness_score,
    calculate_commitment_score,
    evaluate_application,
)
from ..utils.user_utils import generate_username, generate_temp_password
from ..utils.email_utils import send_email
from ..utils.email_templates import (
    application_received_email,
    application_approved_email,
    application_rejected_email,
    application_waitlisted_email
)
import pandas as pd
import io
import json
import logging

logger = logging.getLogger(__name__)

application_bp = Blueprint(
    "application_bp", __name__, url_prefix="/api/v1/applications"
)


@application_bp.route("/check-duplicate", methods=["GET"])
def check_duplicate_application():
    """
    Check if a user has already applied for a specific course.
    Query params: course_id (required), email (required)
    Returns: {exists: bool, application: {...} if exists}
    """
    course_id = request.args.get("course_id")
    email = request.args.get("email")
    
    if not course_id or not email:
        return jsonify({"error": "course_id and email are required"}), 400
    
    try:
        # Check for existing application
        existing = CourseApplication.query.filter_by(
            course_id=int(course_id),
            email=email.lower().strip()
        ).first()
        
        if existing:
            return jsonify({
                "exists": True,
                "application": {
                    "id": existing.id,
                    "status": existing.status,
                    "submitted_at": existing.created_at.isoformat() if existing.created_at else None,
                    "application_score": existing.application_score,
                    "readiness_score": existing.readiness_score,
                    "commitment_score": existing.commitment_score,
                    "final_rank": existing.final_rank_score
                }
            }), 200
        else:
            return jsonify({"exists": False}), 200
            
    except ValueError:
        return jsonify({"error": "Invalid course_id"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def parse_json_field(value):
    """Helper to parse JSON fields that might be strings or lists"""
    if value is None:
        return None
    if isinstance(value, list):
        return json.dumps(value)
    if isinstance(value, str):
        try:
            # Validate it's proper JSON
            json.loads(value)
            return value
        except:
            return None
    return None


# ✅ Submit application (PUBLIC)
@application_bp.route("", methods=["POST"])
def apply_for_course():
    """
    Submit a new course application.
    Accepts comprehensive form data matching the 6-section application form.
    """
    data = request.get_json() or {}
    
    # Validate required fields
    required_fields = ["course_id", "full_name", "email", "phone", "motivation"]
    missing_fields = [field for field in required_fields if not data.get(field)]
    
    if missing_fields:
        return jsonify({
            "error": "Missing required fields",
            "missing": missing_fields
        }), 400
    
    # Check for duplicate applications (only check count to avoid loading invalid enum data)
    try:
        existing_count = CourseApplication.query.filter_by(
            course_id=data.get("course_id"),
            email=data.get("email").lower()
        ).count()
        
        if existing_count > 0:
            # Get the ID without loading the full object
            existing_id = db.session.execute(
                db.select(CourseApplication.id, CourseApplication.status).filter_by(
                    course_id=data.get("course_id"),
                    email=data.get("email").lower()
                )
            ).first()
            
            return jsonify({
                "error": "You have already applied for this course",
                "application_id": existing_id[0] if existing_id else None,
                "status": existing_id[1] if existing_id else "unknown"
            }), 409
    except Exception as e:
        # If duplicate check fails, log and continue (better to allow duplicate than block legitimate application)
        print(f"Duplicate check error: {e}")
    
    # Validate and set default for excel_skill_level if empty
    excel_skill_level = data.get("excel_skill_level", "never_used")
    if not excel_skill_level or excel_skill_level.strip() == "":
        excel_skill_level = "never_used"
    
    # Validate enum values before creating object
    valid_excel_levels = ["never_used", "beginner", "intermediate", "advanced", "expert"]
    if excel_skill_level not in valid_excel_levels:
        excel_skill_level = "never_used"
    
    # Validate other enum fields to prevent empty strings
    gender = data.get("gender")
    if gender and not gender.strip():
        gender = None
    
    age_range = data.get("age_range")
    if age_range and not age_range.strip():
        age_range = None
    
    education_level = data.get("education_level")
    if education_level and not education_level.strip():
        education_level = None
    
    current_status = data.get("current_status")
    if current_status and not current_status.strip():
        current_status = None
    
    internet_access_type = data.get("internet_access_type")
    if internet_access_type and not internet_access_type.strip():
        internet_access_type = None
    
    preferred_learning_mode = data.get("preferred_learning_mode")
    if preferred_learning_mode and not preferred_learning_mode.strip():
        preferred_learning_mode = None
    
    # Create application with all fields
    application = CourseApplication(
        course_id=data.get("course_id"),
        
        # Section 1: Applicant Information
        full_name=data.get("full_name").strip(),
        email=data.get("email").lower().strip(),
        phone=data.get("phone").strip(),
        whatsapp_number=data.get("whatsapp_number", data.get("phone")).strip(),
        gender=gender,
        age_range=age_range,
        country=data.get("country"),
        city=data.get("city"),
        
        # Section 2: Education & Background
        education_level=education_level,
        current_status=current_status,
        field_of_study=data.get("field_of_study"),
        
        # Section 3: Excel & Computer Skills
        has_used_excel=data.get("has_used_excel", False),
        excel_skill_level=excel_skill_level,
        excel_tasks_done=parse_json_field(data.get("excel_tasks_done")),
        
        # Section 4: Learning Goals
        motivation=data.get("motivation"),
        learning_outcomes=data.get("learning_outcomes"),
        career_impact=data.get("career_impact"),
        
        # Section 5: Access & Availability
        has_computer=data.get("has_computer", False),
        has_internet=data.get("has_computer", False),  # Assume internet if has computer
        internet_access_type=internet_access_type,
        preferred_learning_mode=preferred_learning_mode,
        available_time=parse_json_field(data.get("available_time")),
        
        # Section 6: Commitment & Agreement
        committed_to_complete=data.get("committed_to_complete", False),
        agrees_to_assessments=data.get("agrees_to_assessments", False),
        referral_source=data.get("referral_source"),
        
        # Legacy compatibility fields
        online_learning_experience=data.get("online_learning_experience", False),
        available_for_live_sessions=data.get("preferred_learning_mode") in ["live_sessions", "hybrid"],
    )
    
    # Split full name for backward compatibility
    application.split_name()
    
    # Map excel_skill_level to legacy digital_skill_level
    if application.excel_skill_level in ["beginner", "intermediate", "advanced"]:
        application.digital_skill_level = application.excel_skill_level
    elif application.excel_skill_level == "expert":
        application.digital_skill_level = "advanced"
    elif application.excel_skill_level == "never_used":
        application.digital_skill_level = "beginner"
    
    # Calculate all scores
    evaluate_application(application)
    
    try:
        db.session.add(application)
        db.session.commit()
        
        # Send confirmation email with professional template
        try:
            from ..models.course_models import Course
            course = Course.query.get(application.course_id)
            course_title = course.title if course else "our course"
            
            logger.info(f"📧 Preparing confirmation email for application #{application.id}")
            email_html = application_received_email(application, course_title)
            
            email_sent = send_email(
                to=application.email,
                subject=f"✅ Application Received - {course_title}",
                template=email_html
            )
            
            if email_sent:
                logger.info(f"✅ Confirmation email sent successfully to {application.email}")
            else:
                logger.warning(f"⚠️ Confirmation email failed to send to {application.email}")
        except Exception as email_error:
            logger.error(f"❌ Error sending confirmation email: {str(email_error)}")
            # Continue - don't fail application submission due to email error
        
        return jsonify({
            "message": "Application submitted successfully",
            "application_id": application.id,
            "status": "pending",
            "scores": {
                "application_score": application.application_score,
                "readiness_score": application.readiness_score,
                "commitment_score": application.commitment_score,
                "risk_score": application.risk_score,
                "final_rank": application.final_rank_score
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Failed to submit application",
            "details": str(e)
        }), 500


# 📋 List applications (Admin/Instructor)
@application_bp.route("", methods=["GET"])
@jwt_required()
def list_applications():
    """
    List and filter applications for a course.
    Query params: course_id, status, sort_by, order
    """
    course_id = request.args.get("course_id", type=int)
    status = request.args.get("status")
    sort_by = request.args.get("sort_by", "final_rank_score")
    order = request.args.get("order", "desc")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    
    query = CourseApplication.query
    
    if course_id:
        query = query.filter_by(course_id=course_id)
    
    if status:
        query = query.filter_by(status=status)
    
    # Map frontend field names to backend column names
    sort_field_map = {
        'submission_date': 'created_at',
        'submittedAt': 'created_at',
    }
    sort_by = sort_field_map.get(sort_by, sort_by)
    
    # Apply sorting with fallback to final_rank_score
    try:
        sort_column = getattr(CourseApplication, sort_by, CourseApplication.final_rank_score)
    except AttributeError:
        sort_column = CourseApplication.final_rank_score
        
    if order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())
    
    # Paginate
    try:
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Safely convert applications to dict, handling enum errors
        applications_data = []
        for app in pagination.items:
            try:
                applications_data.append(app.to_dict(include_sensitive=True))
            except LookupError as e:
                # Log the error and skip this application or return partial data
                logger.warning(f"Error converting application {app.id} to dict: {e}")
                # Try to create a basic dict with safe fields
                applications_data.append({
                    "id": app.id,
                    "course_id": app.course_id,
                    "full_name": app.full_name,
                    "email": app.email,
                    "status": app.status,
                    "created_at": app.created_at.isoformat() if app.created_at else None,
                    "error": "Data validation error - please review this application"
                })
        
        return jsonify({
            "applications": applications_data,
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": page,
            "per_page": per_page
        }), 200
    except Exception as e:
        logger.error(f"Error listing applications: {str(e)}")
        return jsonify({"error": str(e)}), 500


# 🔍 Get single application details
@application_bp.route("/<int:app_id>", methods=["GET"])
@jwt_required()
def get_application(app_id):
    """Get detailed information about a specific application"""
    application = CourseApplication.query.get_or_404(app_id)
    return jsonify(application.to_dict(include_sensitive=True)), 200


# ✅ Approve application
@application_bp.route("/<int:app_id>/approve", methods=["POST"])
@jwt_required()
def approve_application(app_id):
    """
    Approve an application and create user account + enrollment.
    Enhanced with:
    - Duplicate user/enrollment checking
    - Initial progress tracking setup
    - Rich welcome email with course details
    - Comprehensive error handling
    - Enrollment statistics
    """
    application = CourseApplication.query.get_or_404(app_id)
    
    if application.status != "pending":
        return jsonify({
            "error": f"Application is already {application.status}"
        }), 400
    
    data = request.get_json() or {}
    send_welcome_email = data.get("send_email", True)
    custom_message = data.get("custom_message", "")
    
    try:
        # Validate course exists
        from ..models.course_models import Course
        course = Course.query.get(application.course_id)
        if not course:
            return jsonify({"error": "Course not found"}), 404
        
        # Check if user already exists with this email
        existing_user = User.query.filter_by(email=application.email).first()
        
        if existing_user:
            # User exists - just create enrollment
            existing_enrollment = Enrollment.query.filter_by(
                student_id=existing_user.id,
                course_id=application.course_id
            ).first()
            
            if existing_enrollment:
                return jsonify({
                    "error": "User is already enrolled in this course",
                    "user_id": existing_user.id,
                    "enrollment_id": existing_enrollment.id
                }), 409
            
            # Create new enrollment for existing user
            enrollment = Enrollment(
                student_id=existing_user.id,
                course_id=application.course_id
            )
            db.session.add(enrollment)
            
            username = existing_user.username
            temp_password = None  # No new password for existing users
            user = existing_user
            new_account = False
        else:
            # Create new user account
            username = generate_username(
                application.first_name or application.full_name.split()[0],
                application.last_name or " ".join(application.full_name.split()[1:])
            )
            temp_password = generate_temp_password()
            
            # Get student role
            student_role = Role.query.filter_by(name="student").first()
            if not student_role:
                return jsonify({"error": "Student role not found in system"}), 500
            
            user = User(
                username=username,
                email=application.email,
                first_name=application.first_name or application.full_name.split()[0],
                last_name=application.last_name or " ".join(application.full_name.split()[1:]),
                role_id=student_role.id,
                must_change_password=True,  # Force password change on first login
            )
            user.set_password(temp_password)
            db.session.add(user)
            db.session.flush()
            
            # Create enrollment for new user
            enrollment = Enrollment(
                student_id=user.id,
                course_id=application.course_id
            )
            db.session.add(enrollment)
            new_account = True
        
        # Update application status
        application.status = "approved"
        application.approved_by = get_jwt_identity()
        application.reviewed_at = datetime.utcnow()
        
        db.session.flush()
        
        # Initialize progress tracking for course modules
        from ..models.student_models import ModuleProgress
        modules = course.modules.filter_by(is_published=True).all()
        for module in modules:
            module_progress = ModuleProgress(
                student_id=user.id,
                module_id=module.id,
                enrollment_id=enrollment.id
            )
            db.session.add(module_progress)
        
        db.session.commit()
        
        # Send welcome email with course details
        email_sent = False
        if send_welcome_email:
            try:
                logger.info(f"📧 Preparing welcome email for {application.email}")
                logger.info(f"   New account: {new_account}, Username: {username}")
                
                # Send professional welcome email
                email_html = application_approved_email(
                    application=application,
                    course=course,
                    username=username,
                    temp_password=temp_password if new_account else None,
                    custom_message=custom_message
                )
                
                email_sent = send_email(
                    to=application.email,
                    subject=f"🎉 Congratulations! Welcome to {course.title}",
                    template=email_html
                )
                
                if email_sent:
                    logger.info(f"✅ Welcome email sent successfully to {application.email}")
                else:
                    logger.warning(f"⚠️ Welcome email failed to send to {application.email}")
            except Exception as email_error:
                logger.error(f"❌ Error sending welcome email: {str(email_error)}")
                # Don't fail the approval if email fails
        
        # Get enrollment statistics
        total_enrollments = Enrollment.query.filter_by(course_id=course.id).count()
        
        return jsonify({
            "success": True,
            "message": "Application approved and student enrolled successfully",
            "data": {
                "user_id": user.id,
                "username": username,
                "enrollment_id": enrollment.id,
                "course_id": course.id,
                "course_title": course.title,
                "new_account": new_account,
                "email_sent": email_sent,
                "credentials_sent": email_sent and send_welcome_email,
                "modules_initialized": len(modules),
                "total_course_enrollments": total_enrollments,
                "enrollment_date": enrollment.enrollment_date.isoformat()
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error approving application: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": "Failed to approve application",
            "details": str(e)
        }), 500


# ❌ Reject application
@application_bp.route("/<int:app_id>/reject", methods=["POST"])
@jwt_required()
def reject_application(app_id):
    """
    Reject an application with optional reason.
    Optionally send notification email.
    """
    application = CourseApplication.query.get_or_404(app_id)
    data = request.get_json() or {}
    
    if application.status == "approved":
        return jsonify({
            "error": "Cannot reject an already approved application"
        }), 400
    
    application.status = "rejected"
    application.approved_by = get_jwt_identity()
    application.reviewed_at = datetime.utcnow()
    application.rejection_reason = data.get("reason")
    application.admin_notes = data.get("admin_notes")
    
    db.session.commit()
    
    # Send rejection email if requested
    email_sent = False
    if data.get("send_email", True):  # Default to True for better UX
        try:
            from ..models.course_models import Course
            course = Course.query.get(application.course_id)
            course_title = course.title if course else "our course"
            
            logger.info(f"📧 Preparing rejection email for {application.email}")
            email_html = application_rejected_email(
                application=application,
                course_title=course_title,
                reason=application.rejection_reason,
                reapply_info=True
            )
            
            email_sent = send_email(
                to=application.email,
                subject=f"Application Status Update - {course_title}",
                template=email_html
            )
            
            if email_sent:
                logger.info(f"✅ Rejection email sent successfully to {application.email}")
            else:
                logger.warning(f"⚠️ Rejection email failed to send to {application.email}")
        except Exception as email_error:
            logger.error(f"❌ Error sending rejection email: {str(email_error)}")
    
    return jsonify({
        "message": "Application rejected",
        "application_id": application.id,
        "email_sent": email_sent
    }), 200


# ⏸️ Waitlist application
@application_bp.route("/<int:app_id>/waitlist", methods=["POST"])
@jwt_required()
def waitlist_application(app_id):
    """Move application to waitlist with optional email notification"""
    application = CourseApplication.query.get_or_404(app_id)
    data = request.get_json() or {}
    
    application.status = "waitlisted"
    application.admin_notes = data.get("admin_notes")
    application.reviewed_at = datetime.utcnow()
    
    db.session.commit()
    
    # Send waitlist email if requested
    email_sent = False
    if data.get("send_email", True):  # Default to True
        try:
            from ..models.course_models import Course
            course = Course.query.get(application.course_id)
            course_title = course.title if course else "our course"
            
            # Calculate waitlist position if provided
            position = data.get("position")
            estimated_wait = data.get("estimated_wait", "2-4 weeks")
            
            logger.info(f"📧 Preparing waitlist email for {application.email}")
            email_html = application_waitlisted_email(
                application=application,
                course_title=course_title,
                position=position,
                estimated_wait=estimated_wait
            )
            
            email_sent = send_email(
                to=application.email,
                subject=f"⏳ Application Waitlisted - {course_title}",
                template=email_html
            )
            
            if email_sent:
                logger.info(f"✅ Waitlist email sent successfully to {application.email}")
            else:
                logger.warning(f"⚠️ Waitlist email failed to send to {application.email}")
        except Exception as email_error:
            logger.error(f"❌ Error sending waitlist email: {str(email_error)}")
    
    return jsonify({
        "message": "Application moved to waitlist",
        "application_id": application.id,
        "email_sent": email_sent
    }), 200


# 📝 Update application notes
@application_bp.route("/<int:app_id>/notes", methods=["PUT"])
@jwt_required()
def update_application_notes(app_id):
    """Update admin notes for an application"""
    application = CourseApplication.query.get_or_404(app_id)
    data = request.get_json() or {}
    
    application.admin_notes = data.get("admin_notes")
    application.updated_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        "message": "Notes updated successfully"
    }), 200


# 🔄 Recalculate scores
@application_bp.route("/<int:app_id>/recalculate", methods=["POST"])
@jwt_required()
def recalculate_scores(app_id):
    """Recalculate all scores for an application"""
    application = CourseApplication.query.get_or_404(app_id)
    
    scores = evaluate_application(application)
    db.session.commit()
    
    return jsonify({
        "message": "Scores recalculated",
        "scores": scores
    }), 200


# 📊 Get application statistics
@application_bp.route("/statistics", methods=["GET"])
@jwt_required()
def get_statistics():
    """Get statistics for applications"""
    course_id = request.args.get("course_id", type=int)
    
    query = CourseApplication.query
    if course_id:
        query = query.filter_by(course_id=course_id)
    
    total = query.count()
    pending = query.filter_by(status="pending").count()
    approved = query.filter_by(status="approved").count()
    rejected = query.filter_by(status="rejected").count()
    waitlisted = query.filter_by(status="waitlisted").count()
    high_risk = query.filter_by(is_high_risk=True).count()
    
    # Average scores
    from sqlalchemy import func
    avg_scores = db.session.query(
        func.avg(CourseApplication.application_score).label('avg_app_score'),
        func.avg(CourseApplication.readiness_score).label('avg_readiness'),
        func.avg(CourseApplication.commitment_score).label('avg_commitment'),
        func.avg(CourseApplication.risk_score).label('avg_risk'),
    ).filter(CourseApplication.course_id == course_id if course_id else True).first()
    
    return jsonify({
        "total_applications": total,
        "status_breakdown": {
            "pending": pending,
            "approved": approved,
            "rejected": rejected,
            "waitlisted": waitlisted
        },
        "high_risk_count": high_risk,
        "average_scores": {
            "application_score": round(avg_scores.avg_app_score or 0, 2),
            "readiness_score": round(avg_scores.avg_readiness or 0, 2),
            "commitment_score": round(avg_scores.avg_commitment or 0, 2),
            "risk_score": round(avg_scores.avg_risk or 0, 2),
        }
    }), 200


# 🧾 Export applications to Excel
@application_bp.route("/export", methods=["GET"])
@jwt_required()
def export_applications():
    """Export applications to Excel file with comprehensive data"""
    course_id = request.args.get("course_id", type=int)
    status = request.args.get("status")
    
    query = CourseApplication.query
    if course_id:
        query = query.filter_by(course_id=course_id)
    if status:
        query = query.filter_by(status=status)
    
    apps = query.order_by(CourseApplication.final_rank_score.desc()).all()
    
    data = []
    for a in apps:
        data.append({
            "ID": a.id,
            "Full Name": a.full_name,
            "Email": a.email,
            "Phone": a.phone,
            "Country": a.country,
            "City": a.city,
            "Age Range": a.age_range,
            "Gender": a.gender,
            "Education": a.education_level,
            "Current Status": a.current_status,
            "Field of Study": a.field_of_study,
            "Excel Skill": a.excel_skill_level,
            "Has Computer": a.has_computer,
            "Internet Type": a.internet_access_type,
            "Learning Mode": a.preferred_learning_mode,
            "Committed": a.committed_to_complete,
            "Agrees to Assessments": a.agrees_to_assessments,
            "Risk Score": a.risk_score,
            "High Risk": a.is_high_risk,
            "Application Score": a.application_score,
            "Readiness Score": a.readiness_score,
            "Commitment Score": a.commitment_score,
            "Final Rank": a.final_rank_score,
            "Status": a.status,
            "Referral Source": a.referral_source,
            "Applied At": a.created_at.strftime('%Y-%m-%d %H:%M') if a.created_at else "",
        })
    
    df = pd.DataFrame(data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Applications', index=False)
        
        # Add statistics sheet
        stats_data = {
            "Metric": ["Total", "Pending", "Approved", "Rejected", "Waitlisted", "High Risk"],
            "Count": [
                len(apps),
                len([a for a in apps if a.status == "pending"]),
                len([a for a in apps if a.status == "approved"]),
                len([a for a in apps if a.status == "rejected"]),
                len([a for a in apps if a.status == "waitlisted"]),
                len([a for a in apps if a.is_high_risk]),
            ]
        }
        stats_df = pd.DataFrame(stats_data)
        stats_df.to_excel(writer, sheet_name='Statistics', index=False)
    
    output.seek(0)
    
    filename = f"applications_course_{course_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return send_file(
        output,
        download_name=filename,
        as_attachment=True,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )


# ✅ Get user application statistics
@application_bp.route("/user-stats/<email>", methods=["GET"])
@jwt_required()
def get_user_application_stats(email):
    """
    Get application statistics for a specific user by email.
    Shows all applications, their status, and prevents duplicate applications.
    """
    try:
        # Get all applications for this email
        applications = CourseApplication.query.filter_by(email=email.lower()).all()
        
        if not applications:
            return jsonify({
                "email": email,
                "total_applications": 0,
                "applications": [],
                "course_ids_applied": []
            }), 200
        
        # Get course details for each application
        from ..models.course_models import Course
        
        applications_data = []
        course_ids_applied = []
        
        for app in applications:
            course = Course.query.get(app.course_id)
            course_ids_applied.append(app.course_id)
            
            applications_data.append({
                "id": app.id,
                "course_id": app.course_id,
                "course_title": course.title if course else "Unknown Course",
                "status": app.status,
                "created_at": app.created_at.isoformat(),
                "reviewed_at": app.reviewed_at.isoformat() if app.reviewed_at else None,
                "final_rank_score": app.final_rank_score,
                "can_reapply": app.status in ["rejected", "withdrawn"]
            })
        
        stats = {
            "total": len(applications),
            "pending": len([a for a in applications if a.status == "pending"]),
            "approved": len([a for a in applications if a.status == "approved"]),
            "rejected": len([a for a in applications if a.status == "rejected"]),
            "waitlisted": len([a for a in applications if a.status == "waitlisted"]),
            "withdrawn": len([a for a in applications if a.status == "withdrawn"])
        }
        
        return jsonify({
            "email": email,
            "total_applications": len(applications),
            "statistics": stats,
            "applications": applications_data,
            "course_ids_applied": course_ids_applied
        }), 200
        
    except Exception as e:
        print(f"Error fetching user stats: {str(e)}")
        return jsonify({"error": str(e)}), 500
