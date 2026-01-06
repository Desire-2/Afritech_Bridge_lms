from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import threading
import uuid
import logging
from sqlalchemy import or_, func, and_
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
from ..utils.email_utils import send_email, send_email_with_bcc, send_emails_batch
from ..utils.email_templates import (
    application_received_email,
    application_approved_email,
    application_rejected_email,
    application_waitlisted_email,
    application_status_pending_email,
    application_status_withdrawn_email,
    custom_application_email
)
import pandas as pd
import io
import json
import logging
import threading
import uuid
import os
from flask import current_app

logger = logging.getLogger(__name__)

# In-memory task tracking (use Redis in production)
bulk_action_tasks = {}
custom_email_tasks = {}
custom_email_tasks = {}

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


# � Advanced Application Search with Analytics
@application_bp.route("/advanced-search", methods=["POST"])
@jwt_required()
def advanced_application_search():
    """
    Advanced search with complex queries and analytics.
    Supports saved searches, query building, and result analytics.
    """
    data = request.get_json() or {}
    
    # Complex query builder
    search_config = {
        "text_search": data.get("text_search", ""),
        "filters": data.get("filters", {}),
        "score_ranges": data.get("score_ranges", {}),
        "date_ranges": data.get("date_ranges", {}),
        "sort_config": data.get("sort_config", {"field": "final_rank_score", "order": "desc"}),
        "pagination": data.get("pagination", {"page": 1, "per_page": 50}),
        "include_analytics": data.get("include_analytics", False),
        "save_search": data.get("save_search", False),
        "search_name": data.get("search_name", "")
    }
