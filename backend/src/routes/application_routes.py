from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import threading
import uuid
import logging
from sqlalchemy import or_, func, and_, case
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
    
    try:
        # Build base query
        query = CourseApplication.query
        
        # Apply text search with enhanced matching
        if search_config["text_search"]:
            text = search_config["text_search"].strip()
            
            if text:
                # Create multiple search patterns for better matching
                exact_pattern = f"%{text}%"
                words = text.split()
                
                # Build search conditions
                search_conditions = []
                
                # Exact phrase matching in all fields
                exact_conditions = [
                    CourseApplication.full_name.ilike(exact_pattern),
                    CourseApplication.email.ilike(exact_pattern),
                    CourseApplication.phone.ilike(exact_pattern),
                    CourseApplication.motivation.ilike(exact_pattern),
                    CourseApplication.field_of_study.ilike(exact_pattern),
                    CourseApplication.learning_outcomes.ilike(exact_pattern),
                    CourseApplication.career_impact.ilike(exact_pattern),
                    CourseApplication.country.ilike(exact_pattern),
                    CourseApplication.city.ilike(exact_pattern),
                    CourseApplication.referral_source.ilike(exact_pattern)
                ]
                search_conditions.extend(exact_conditions)
                
                # Individual word matching for better results
                if len(words) > 1:
                    for word in words:
                        if len(word) > 2:  # Skip short words
                            word_pattern = f"%{word}%"
                            word_conditions = [
                                CourseApplication.full_name.ilike(word_pattern),
                                CourseApplication.email.ilike(word_pattern),
                                CourseApplication.motivation.ilike(word_pattern),
                                CourseApplication.field_of_study.ilike(word_pattern),
                                CourseApplication.country.ilike(word_pattern),
                                CourseApplication.city.ilike(word_pattern)
                            ]
                            search_conditions.extend(word_conditions)
                
                query = query.filter(or_(*search_conditions))
        
        # Apply filters
        filters = search_config.get("filters", {})
        for field, value in filters.items():
            if value and hasattr(CourseApplication, field):
                column = getattr(CourseApplication, field)
                if isinstance(value, str):
                    query = query.filter(column.ilike(f"%{value}%"))
                else:
                    query = query.filter(column == value)
        
        # Apply score ranges
        score_ranges = search_config.get("score_ranges", {})
        for score_field, range_config in score_ranges.items():
            if hasattr(CourseApplication, score_field):
                column = getattr(CourseApplication, score_field)
                if "min" in range_config:
                    query = query.filter(column >= range_config["min"])
                if "max" in range_config:
                    query = query.filter(column <= range_config["max"])
        
        # Apply date ranges
        date_ranges = search_config.get("date_ranges", {})
        for date_field, range_config in date_ranges.items():
            if hasattr(CourseApplication, date_field):
                column = getattr(CourseApplication, date_field)
                if "from" in range_config:
                    from_date = datetime.strptime(range_config["from"], "%Y-%m-%d")
                    query = query.filter(column >= from_date)
                if "to" in range_config:
                    to_date = datetime.strptime(range_config["to"], "%Y-%m-%d")
                    to_date = to_date.replace(hour=23, minute=59, second=59)
                    query = query.filter(column <= to_date)
        
        # Apply sorting
        sort_config = search_config.get("sort_config", {})
        sort_field = sort_config.get("field", "final_rank_score")
        sort_order = sort_config.get("order", "desc")
        
        if hasattr(CourseApplication, sort_field):
            column = getattr(CourseApplication, sort_field)
            if sort_order == "asc":
                query = query.order_by(column.asc())
            else:
                query = query.order_by(column.desc())
        
        # Pagination
        page_config = search_config.get("pagination", {})
        page = page_config.get("page", 1)
        per_page = page_config.get("per_page", 50)
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Convert results
        applications_data = []
        for app in pagination.items:
            try:
                applications_data.append(app.to_dict(include_sensitive=True))
            except Exception as e:
                logger.warning(f"Error converting application {app.id} to dict: {e}")
                applications_data.append({
                    "id": app.id,
                    "full_name": app.full_name,
                    "email": app.email,
                    "status": app.status,
                    "error": "Data validation error"
                })
        
        result = {
            "applications": applications_data,
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": page,
            "per_page": per_page,
            "search_config": search_config
        }
        
        # Add analytics if requested
        if search_config.get("include_analytics"):
            # Calculate search analytics
            total_count = query.count()
            result["analytics"] = {
                "total_found": total_count,
                "search_performance": {
                    "query_complexity": len([k for k, v in search_config.items() if v]),
                    "filters_applied": len(filters),
                    "score_filters": len(score_ranges),
                    "date_filters": len(date_ranges)
                }
            }
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Advanced search error: {str(e)}")
        return jsonify({
            "error": "Advanced search failed",
            "details": str(e)
        }), 500


# 🔍 Basic Application Listing with Enhanced Search
@application_bp.route("", methods=["GET"])
@jwt_required()
def list_applications():
    """
    List and filter applications with enhanced search capabilities.
    
    Query params:
    - Basic filters: course_id, status
    - Text search: search (searches name, email, phone, motivation, field_of_study)
    - Advanced filters: country, city, education_level, current_status, excel_skill_level, referral_source
    - Date filters: date_from, date_to (YYYY-MM-DD format)
    - Score filters: min_score, max_score, score_type (application_score, final_rank_score, etc.)
    - Sorting: sort_by, order
    - Pagination: page, per_page
    """
    # Basic parameters
    course_id = request.args.get("course_id", type=int)
    status = request.args.get("status")
    sort_by = request.args.get("sort_by", "final_rank_score")
    order = request.args.get("order", "desc")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    
    # Enhanced search parameters
    search_term = request.args.get("search", "").strip()
    country = request.args.get("country")
    city = request.args.get("city")
    education_level = request.args.get("education_level")
    current_status = request.args.get("current_status")
    excel_skill_level = request.args.get("excel_skill_level")
    referral_source = request.args.get("referral_source")
    
    # Date range filters
    date_from = request.args.get("date_from")  # YYYY-MM-DD
    date_to = request.args.get("date_to")      # YYYY-MM-DD
    
    # Score range filters
    min_score = request.args.get("min_score", type=float)
    max_score = request.args.get("max_score", type=float)
    score_type = request.args.get("score_type", "final_rank_score")  # which score field to filter
    
    query = CourseApplication.query
    
    # Apply basic filters
    if course_id:
        query = query.filter_by(course_id=course_id)
    
    if status:
        query = query.filter_by(status=status)
    
    # Apply enhanced text search across multiple fields with exact match priority
    if search_term:
        text = search_term.strip()
        
        if text:
            # Create search patterns with different priorities
            exact_match_conditions = [
                CourseApplication.full_name.ilike(text),  # Exact match
                CourseApplication.email.ilike(text)       # Exact email match
            ]
            
            starts_with_conditions = [
                CourseApplication.full_name.ilike(f"{text}%"),  # Starts with
                CourseApplication.email.ilike(f"{text}%")       # Email starts with
            ]
            
            word_boundary_conditions = [
                CourseApplication.full_name.ilike(f"% {text} %"),  # Word boundaries
                CourseApplication.full_name.ilike(f"{text} %"),    # Starts with word
                CourseApplication.full_name.ilike(f"% {text}")     # Ends with word
            ]
            
            partial_match_conditions = [
                CourseApplication.full_name.ilike(f"%{text}%"),
                CourseApplication.email.ilike(f"%{text}%"),
                CourseApplication.phone.ilike(f"%{text}%"),
                CourseApplication.motivation.ilike(f"%{text}%"),
                CourseApplication.field_of_study.ilike(f"%{text}%"),
                CourseApplication.learning_outcomes.ilike(f"%{text}%"),
                CourseApplication.career_impact.ilike(f"%{text}%"),
                CourseApplication.country.ilike(f"%{text}%"),
                CourseApplication.city.ilike(f"%{text}%"),
                CourseApplication.referral_source.ilike(f"%{text}%")
            ]
            
            # Combine all conditions with OR
            all_conditions = exact_match_conditions + starts_with_conditions + word_boundary_conditions + partial_match_conditions
            
            # Individual word matching for multi-word searches
            words = text.split()
            if len(words) > 1:
                for word in words:
                    if len(word) > 2:  # Skip short words
                        word_pattern = f"%{word}%"
                        word_conditions = [
                            CourseApplication.full_name.ilike(word_pattern),
                            CourseApplication.email.ilike(word_pattern),
                            CourseApplication.motivation.ilike(word_pattern),
                            CourseApplication.field_of_study.ilike(word_pattern),
                            CourseApplication.country.ilike(word_pattern),
                            CourseApplication.city.ilike(word_pattern)
                        ]
                        all_conditions.extend(word_conditions)
            
            query = query.filter(or_(*all_conditions))
            
            # Add custom ordering to prioritize exact matches
            # Using CASE WHEN to create a relevance score
            relevance_score = case(
                {
                    CourseApplication.full_name.ilike(text): 1000,  # Exact name match - highest priority
                    CourseApplication.email.ilike(text): 900,       # Exact email match
                    CourseApplication.full_name.ilike(f"{text}%"): 800,  # Name starts with
                    CourseApplication.email.ilike(f"{text}%"): 700,      # Email starts with
                    CourseApplication.full_name.ilike(f"% {text} %"): 600, # Word boundary
                },
                else_=0
            )
            
            # Apply this relevance ordering before other sorting
            query = query.order_by(relevance_score.desc())
    
    # Apply advanced filters
    if country:
        query = query.filter(CourseApplication.country.ilike(f"%{country}%"))
    
    if city:
        query = query.filter(CourseApplication.city.ilike(f"%{city}%"))
    
    if education_level:
        query = query.filter_by(education_level=education_level)
    
    if current_status:
        query = query.filter_by(current_status=current_status)
    
    if excel_skill_level:
        query = query.filter_by(excel_skill_level=excel_skill_level)
    
    if referral_source:
        query = query.filter(CourseApplication.referral_source.ilike(f"%{referral_source}%"))
    
    # Apply date range filters with improved validation
    if date_from:
        try:
            from_date = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.filter(CourseApplication.created_at >= from_date)
        except ValueError as ve:
            logger.warning(f"Invalid date_from format received: {date_from}")
            return jsonify({
                "error": "Invalid date_from format. Use YYYY-MM-DD",
                "details": f"Received: '{date_from}', Expected format: YYYY-MM-DD",
                "example": "2024-01-15"
            }), 400
    
    if date_to:
        try:
            to_date = datetime.strptime(date_to, "%Y-%m-%d")
            # Include the entire day
            to_date = to_date.replace(hour=23, minute=59, second=59)
            query = query.filter(CourseApplication.created_at <= to_date)
        except ValueError as ve:
            logger.warning(f"Invalid date_to format received: {date_to}")
            return jsonify({
                "error": "Invalid date_to format. Use YYYY-MM-DD",
                "details": f"Received: '{date_to}', Expected format: YYYY-MM-DD",
                "example": "2024-01-15"
            }), 400
            
    # Validate date range logic
    if date_from and date_to:
        try:
            from_date = datetime.strptime(date_from, "%Y-%m-%d")
            to_date = datetime.strptime(date_to, "%Y-%m-%d")
            if from_date > to_date:
                return jsonify({
                    "error": "Invalid date range: date_from cannot be after date_to",
                    "date_from": date_from,
                    "date_to": date_to
                }), 400
        except ValueError:
            # Already handled above
            pass
    
    # Apply score range filters
    if min_score is not None or max_score is not None:
        valid_score_fields = [
            "application_score", "final_rank_score", "readiness_score", 
            "commitment_score", "risk_score"
        ]
        
        if score_type not in valid_score_fields:
            return jsonify({
                "error": f"Invalid score_type. Must be one of: {valid_score_fields}"
            }), 400
        
        score_column = getattr(CourseApplication, score_type)
        
        if min_score is not None:
            query = query.filter(score_column >= min_score)
        
        if max_score is not None:
            query = query.filter(score_column <= max_score)
    
    # Map frontend field names to backend column names
    sort_field_map = {
        'submission_date': 'created_at',
        'submittedAt': 'created_at',
    }
    sort_by = sort_field_map.get(sort_by, sort_by)
    
    # Apply sorting with fallback to final_rank_score
    # Note: If search_term was provided, relevance ordering is already applied
    if not search_term or sort_by != "final_rank_score":  # Allow custom sorting even with search
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
            except (LookupError, AttributeError, ValueError) as e:
                # Log the error and create a safe representation
                logger.warning(f"Error converting application {app.id} to dict: {e}")
                
                # Create a safe dict with basic fields, handling potential enum issues
                safe_app_data = {
                    "id": app.id,
                    "course_id": app.course_id,
                    "full_name": getattr(app, 'full_name', 'N/A'),
                    "email": getattr(app, 'email', 'N/A'),
                    "phone": getattr(app, 'phone', 'N/A'),
                    "created_at": app.created_at.isoformat() if app.created_at else None,
                    "updated_at": app.updated_at.isoformat() if app.updated_at else None,
                    "admin_notes": getattr(app, 'admin_notes', ''),
                    "data_error": f"Enum conversion error: {str(e)}"
                }
                
                # Safely handle status field
                try:
                    safe_app_data["status"] = app.status
                except (LookupError, AttributeError):
                    safe_app_data["status"] = "unknown"
                    
                # Safely handle enum fields
                enum_fields = ['education_level', 'current_status', 'excel_skill_level']
                for field in enum_fields:
                    try:
                        safe_app_data[field] = getattr(app, field, None)
                    except (LookupError, AttributeError):
                        safe_app_data[field] = "unknown"
                        
                # Safely handle score fields
                score_fields = ['application_score', 'final_rank_score', 'readiness_score', 'commitment_score', 'risk_score']
                for field in score_fields:
                    try:
                        safe_app_data[field] = getattr(app, field, None)
                    except (AttributeError, TypeError):
                        safe_app_data[field] = None
                        
                applications_data.append(safe_app_data)
        
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


# 🔍 Test search functionality with debug information
@application_bp.route("/search-debug", methods=["POST"])
@jwt_required()
def debug_search():
    """
    Debug search functionality - returns search details and results
    """
    data = request.get_json() or {}
    search_term = data.get("search", "").strip()
    
    if not search_term:
        return jsonify({"error": "Search term is required"}), 400
    
    debug_info = {
        "search_term": search_term,
        "search_patterns": [],
        "fields_searched": [
            "full_name", "email", "phone", "motivation", 
            "field_of_study", "learning_outcomes", "career_impact",
            "country", "city", "referral_source"
        ],
        "word_breakdown": search_term.split(),
        "query_details": []
    }
    
    # Build query with debug tracking
    query = CourseApplication.query
    
    if search_term:
        exact_pattern = f"%{search_term}%"
        debug_info["search_patterns"].append({"type": "exact", "pattern": exact_pattern})
        
        words = search_term.split()
        search_conditions = []
        
        # Exact phrase matching
        exact_conditions = [
            CourseApplication.full_name.ilike(exact_pattern),
            CourseApplication.email.ilike(exact_pattern),
            CourseApplication.phone.ilike(exact_pattern),
            CourseApplication.motivation.ilike(exact_pattern),
            CourseApplication.field_of_study.ilike(exact_pattern),
            CourseApplication.learning_outcomes.ilike(exact_pattern),
            CourseApplication.career_impact.ilike(exact_pattern),
            CourseApplication.country.ilike(exact_pattern),
            CourseApplication.city.ilike(exact_pattern),
            CourseApplication.referral_source.ilike(exact_pattern)
        ]
        search_conditions.extend(exact_conditions)
        debug_info["query_details"].append(f"Added {len(exact_conditions)} exact match conditions")
        
        # Individual word matching
        if len(words) > 1:
            for word in words:
                if len(word) > 2:
                    word_pattern = f"%{word}%"
                    debug_info["search_patterns"].append({"type": "word", "word": word, "pattern": word_pattern})
                    word_conditions = [
                        CourseApplication.full_name.ilike(word_pattern),
                        CourseApplication.email.ilike(word_pattern),
                        CourseApplication.motivation.ilike(word_pattern),
                        CourseApplication.field_of_study.ilike(word_pattern),
                        CourseApplication.country.ilike(word_pattern),
                        CourseApplication.city.ilike(word_pattern)
                    ]
                    search_conditions.extend(word_conditions)
                    debug_info["query_details"].append(f"Added {len(word_conditions)} conditions for word: '{word}'")
        
        query = query.filter(or_(*search_conditions))
        debug_info["total_conditions"] = len(search_conditions)
    
    # Execute query
    try:
        applications = query.limit(10).all()  # Limit for debug
        debug_info["results_count"] = len(applications)
        debug_info["total_applications"] = CourseApplication.query.count()
        
        # Return matched fields for each result
        results = []
        for app in applications:
            matched_fields = []
            app_dict = app.to_dict(include_sensitive=True)
            
            # Check which fields matched
            for field in debug_info["fields_searched"]:
                if hasattr(app, field):
                    field_value = str(getattr(app, field) or "")
                    if search_term.lower() in field_value.lower():
                        matched_fields.append({
                            "field": field,
                            "value": field_value[:100] + "..." if len(field_value) > 100 else field_value,
                            "match_type": "exact"
                        })
                    else:
                        # Check word matches
                        for word in search_term.split():
                            if len(word) > 2 and word.lower() in field_value.lower():
                                matched_fields.append({
                                    "field": field,
                                    "value": field_value[:100] + "..." if len(field_value) > 100 else field_value,
                                    "match_type": "word",
                                    "matched_word": word
                                })
                                break
            
            results.append({
                "id": app.id,
                "full_name": app.full_name,
                "email": app.email,
                "matched_fields": matched_fields
            })
        
        debug_info["sample_results"] = results
        
        return jsonify({
            "debug": debug_info,
            "message": "Search debug completed successfully"
        }), 200
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "debug": debug_info
        }), 500


# � Enhanced Search Statistics
@application_bp.route("/search-stats", methods=["GET"])
@jwt_required()
def get_search_statistics():
    """
    Get statistics for enhanced search functionality.
    Provides filter options and counts for the search UI.
    """
    course_id = request.args.get("course_id", type=int)
    
    try:
        # Base query
        base_query = CourseApplication.query
        if course_id:
            base_query = base_query.filter_by(course_id=course_id)
        
        # Get unique values for filter dropdowns
        countries = db.session.query(CourseApplication.country).distinct().filter(
            CourseApplication.country.isnot(None)
        )
        if course_id:
            countries = countries.filter_by(course_id=course_id)
        countries = [c[0] for c in countries.all() if c[0]]
        
        cities = db.session.query(CourseApplication.city).distinct().filter(
            CourseApplication.city.isnot(None)
        )
        if course_id:
            cities = cities.filter_by(course_id=course_id)
        cities = [c[0] for c in cities.all() if c[0]]
        
        # Get enum values for dropdowns
        education_levels = ["high_school", "diploma", "bachelors", "masters", "phd", "other"]
        current_statuses = ["student", "employed", "self_employed", "unemployed", "freelancer", "other"]
        excel_skill_levels = ["never_used", "beginner", "intermediate", "advanced", "expert"]
        application_statuses = ["pending", "approved", "rejected", "waitlisted"]
        
        # Get referral sources
        referral_sources = db.session.query(CourseApplication.referral_source).distinct().filter(
            CourseApplication.referral_source.isnot(None)
        )
        if course_id:
            referral_sources = referral_sources.filter_by(course_id=course_id)
        referral_sources = [r[0] for r in referral_sources.all() if r[0]]
        
        # Get status counts
        status_counts = {}
        for status in application_statuses:
            count_query = base_query.filter_by(status=status)
            status_counts[status] = count_query.count()
        
        # Get score ranges
        score_stats = {}
        score_fields = ["application_score", "final_rank_score", "readiness_score", "commitment_score", "risk_score"]
        
        for field in score_fields:
            column = getattr(CourseApplication, field)
            result = db.session.query(
                func.min(column).label('min'),
                func.max(column).label('max'),
                func.avg(column).label('avg')
            ).filter(
                column.isnot(None)
            )
            
            if course_id:
                result = result.filter_by(course_id=course_id)
                
            stats = result.first()
            score_stats[field] = {
                "min": float(stats.min) if stats.min is not None else 0,
                "max": float(stats.max) if stats.max is not None else 100,
                "avg": float(stats.avg) if stats.avg is not None else 50
            }
        
        # Get date range
        date_range = db.session.query(
            func.min(CourseApplication.created_at).label('earliest'),
            func.max(CourseApplication.created_at).label('latest')
        )
        if course_id:
            date_range = date_range.filter_by(course_id=course_id)
        
        date_stats = date_range.first()
        
        return jsonify({
            "filter_options": {
                "countries": sorted(countries),
                "cities": sorted(cities),
                "education_levels": education_levels,
                "current_statuses": current_statuses,
                "excel_skill_levels": excel_skill_levels,
                "referral_sources": sorted(referral_sources)
            },
            "status_counts": status_counts,
            "score_statistics": score_stats,
            "date_range": {
                "earliest": date_stats.earliest.isoformat() if date_stats.earliest else None,
                "latest": date_stats.latest.isoformat() if date_stats.latest else None
            },
            "total_applications": base_query.count()
        })
        
    except Exception as e:
        logger.error(f"Error getting search statistics: {e}")
        return jsonify({"error": "Failed to get search statistics"}), 500

# �🔄 Change application status
@application_bp.route("/<int:app_id>/status", methods=["PUT"])
@jwt_required()
def change_application_status(app_id):
    """
    Change application status directly (admin quick action).
    Useful for moving applications between statuses without full approve/reject flow.
    Sends email notification for every status change.
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if not current_user or current_user.role.name not in ["admin", "instructor"]:
        return jsonify({"error": "Unauthorized"}), 403
    
    application = CourseApplication.query.get_or_404(app_id)
    data = request.get_json() or {}
    new_status = data.get("status", "").lower()
    reason = data.get("reason", "")
    send_notification = data.get("send_email", True)  # Default to True
    
    valid_statuses = ["pending", "approved", "rejected", "waitlisted", "withdrawn"]
    if not new_status or new_status not in valid_statuses:
        return jsonify({"error": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"}), 400
    
    try:
        from ..models.course_models import Course
        
        old_status = application.status
        
        # Skip if status is unchanged
        if old_status == new_status:
            return jsonify({
                "success": True,
                "message": "Status unchanged",
                "data": {
                    "id": application.id,
                    "old_status": old_status,
                    "new_status": new_status
                }
            }), 200
        
        course = Course.query.get(application.course_id)
        
        application.status = new_status
        application.reviewed_at = datetime.utcnow()
        application.approved_by = current_user_id
        
        if reason:
            if new_status == "rejected":
                application.rejection_reason = reason
            else:
                application.admin_notes = f"{application.admin_notes or ''}\n[{datetime.utcnow().isoformat()}] Status changed to {new_status}: {reason}".strip()
        
        db.session.commit()
        logger.info(f"Application {app_id} status changed from {old_status} to {new_status} by user {current_user_id}")
        
        # Send email notification for status change
        email_sent = False
        if send_notification:
            try:
                email_content = None
                email_subject = None
                
                if new_status == "approved":
                    # For approved status, send approval email
                    # Note: This doesn't create enrollment - use approve endpoint for full workflow
                    email_content = application_approved_email(
                        application=application,
                        course=course,
                        username=None,  # No credentials for direct status change
                        temp_password=None,
                        custom_message=reason or "Your application has been approved!"
                    )
                    email_subject = f"🎉 Application Approved - {course.title}"
                    
                elif new_status == "rejected":
                    email_content = application_rejected_email(
                        application=application,
                        course_title=course.title,
                        reason=reason or "Unfortunately, we cannot approve your application at this time."
                    )
                    email_subject = f"Application Update - {course.title}"
                    
                elif new_status == "waitlisted":
                    email_content = application_waitlisted_email(
                        application=application,
                        course_title=course.title,
                        position=None
                    )
                    email_subject = f"Application Waitlisted - {course.title}"
                    
                elif new_status == "pending":
                    # Send professional status change notification for pending
                    email_content = application_status_pending_email(
                        application=application,
                        course_title=course.title,
                        reason=reason
                    )
                    email_subject = f"⏳ Application Under Review - {course.title}"
                    
                elif new_status == "withdrawn":
                    # Send professional withdrawal confirmation
                    email_content = application_status_withdrawn_email(
                        application=application,
                        course_title=course.title,
                        reason=reason
                    )
                    email_subject = f"Application Withdrawn - {course.title}"
                
                # Send the email
                if email_content and email_subject:
                    email_sent = send_email(
                        to=application.email,
                        subject=email_subject,
                        template=email_content
                    )
                    if email_sent:
                        logger.info(f"✅ Status change email sent to {application.email} (status: {new_status})")
                    else:
                        logger.warning(f"⚠️ Failed to send status change email to {application.email}")
                        
            except Exception as email_error:
                logger.error(f"❌ Error sending status change email: {str(email_error)}")
        
        return jsonify({
            "success": True,
            "message": f"Application status changed from {old_status} to {new_status}",
            "email_sent": email_sent,
            "data": {
                "id": application.id,
                "old_status": old_status,
                "new_status": new_status
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error changing application status: {str(e)}")
        return jsonify({"error": "Failed to change status", "details": str(e)}), 500


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
    
    if application.status not in ["pending", "rejected", "withdrawn"]:
        return jsonify({
            "error": f"Cannot approve application with status: {application.status}",
            "details": "Only pending, rejected, or withdrawn applications can be approved"
        }), 400
    
    data = request.get_json() or {}
    send_welcome_email = data.get("send_email", True)
    custom_message = data.get("custom_message", "")
    force_reapproval = data.get("force_reapproval", True)  # Allow re-approval by default
    
    try:
        # Validate course exists
        from ..models.course_models import Course
        course = Course.query.get(application.course_id)
        if not course:
            return jsonify({"error": "Course not found"}), 404
        
        # Check if user already exists with this email
        existing_user = User.query.filter_by(email=application.email).first()
        existing_enrollment = None  # Track if enrollment already exists
        
        if existing_user:
            # User exists - check enrollment
            existing_enrollment = Enrollment.query.filter_by(
                student_id=existing_user.id,
                course_id=application.course_id
            ).first()
            
            if existing_enrollment:
                # Enrollment exists - handle re-approval
                if not force_reapproval:
                    return jsonify({
                        "error": "User is already enrolled in this course",
                        "user_id": existing_user.id,
                        "enrollment_id": existing_enrollment.id,
                        "details": "Use force_reapproval=true to re-activate enrollment"
                    }), 409
                
                # Re-activate existing enrollment
                logger.info(f"Re-approving application {app_id} - reactivating existing enrollment {existing_enrollment.id}")
                enrollment = existing_enrollment
            else:
                # Create new enrollment for existing user
                enrollment = Enrollment(
                    student_id=existing_user.id,
                    course_id=application.course_id
                )
                db.session.add(enrollment)
            
            # For existing user, generate password reset token instead of password
            username = existing_user.username
            temp_password = None  # No password for existing users
            reset_token = existing_user.generate_reset_token()
            logger.info(f"Generated password reset token for existing user {username}")
            
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
        
        # Initialize progress tracking for course modules (skip if already exists)
        from ..models.student_models import ModuleProgress
        modules = course.modules.filter_by(is_published=True).all()
        for module in modules:
            # Check if module progress already exists
            existing_progress = ModuleProgress.query.filter_by(
                student_id=user.id,
                module_id=module.id,
                enrollment_id=enrollment.id
            ).first()
            
            if not existing_progress:
                module_progress = ModuleProgress(
                    student_id=user.id,
                    module_id=module.id,
                    enrollment_id=enrollment.id
                )
                db.session.add(module_progress)
            else:
                logger.info(f"Module progress already exists for user {user.id}, module {module.id}")
        
        db.session.commit()
        
        # Send welcome email with course details
        email_sent = False
        if send_welcome_email:
            try:
                logger.info(f"📧 Preparing welcome email for {application.email}")
                logger.info(f"   New account: {new_account}, Username: {username}")
                
                # Generate reset link for existing users
                reset_link = None
                if not new_account and temp_password is None:
                    reset_link = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/auth/reset-password?token={reset_token}&email={application.email}"
                
                # Send professional welcome email
                email_html = application_approved_email(
                    application=application,
                    course=course,
                    username=username,
                    temp_password=temp_password,
                    custom_message=custom_message,
                    is_new_account=new_account,
                    password_reset_link=reset_link
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
        
        # Determine if this is a re-approval
        is_reapproval = existing_user is not None and existing_enrollment is not None
        
        return jsonify({
            "success": True,
            "message": "Application re-approved successfully" if is_reapproval else "Application approved and student enrolled successfully",
            "data": {
                "user_id": user.id,
                "username": username,
                "enrollment_id": enrollment.id,
                "course_id": course.id,
                "course_title": course.title,
                "new_account": new_account,
                "is_reapproval": is_reapproval,
                "email_sent": email_sent,
                "credentials_sent": email_sent and send_welcome_email and new_account,
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
            "application_score": float(round(avg_scores.avg_app_score or 0, 2)),
            "readiness_score": float(round(avg_scores.avg_readiness or 0, 2)),
            "commitment_score": float(round(avg_scores.avg_commitment or 0, 2)),
            "risk_score": float(round(avg_scores.avg_risk or 0, 2)),
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

# ✅ Check Bulk Action Task Status
@application_bp.route("/bulk-action/<task_id>/status", methods=["GET"])
@jwt_required()
def get_bulk_action_status(task_id):
    """
    Check the status of a bulk action task.
    
    Returns:
    {
        "task_id": "uuid",
        "status": "pending" | "processing" | "completed" | "failed",
        "progress": {"processed": 5, "total": 10},
        "results": {...},  // Available when completed
        "error": "..."  // Available when failed
    }
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if not current_user or current_user.role.name not in ["admin", "instructor"]:
        return jsonify({"error": "Unauthorized"}), 403
    
    task = bulk_action_tasks.get(task_id)
    
    if not task:
        return jsonify({"error": "Task not found"}), 404
    
    # Check if task belongs to current user
    if task.get("user_id") != current_user_id:
        return jsonify({"error": "Unauthorized access to task"}), 403
    
    response = {
        "task_id": task_id,
        "status": task.get("status", "unknown"),
        "progress": task.get("progress", {"processed": 0, "total": 0}),
        "started_at": task.get("started_at"),
        "completed_at": task.get("completed_at"),
        "action": task.get("action")
    }
    
    if task.get("status") == "completed":
        response["results"] = task.get("results", {})
        response["summary"] = task.get("summary", {})
    
    if task.get("status") == "failed":
        response["error"] = task.get("error")
    
    return jsonify(response), 200

# ✅ Bulk Actions (Admin/Instructor) - Background Processing
@application_bp.route("/bulk-action", methods=["POST"])
@jwt_required()
def bulk_action():
    """
    Perform bulk actions on multiple applications in the background.
    Returns immediately with a task ID that can be polled for status.
    
    Actions supported:
    - approve: Create accounts and enroll students
    - reject: Reject applications with reason
    - waitlist: Move applications to waitlist
    
    Request body:
    {
        "action": "approve" | "reject" | "waitlist",
        "application_ids": [1, 2, 3],
        "rejection_reason": "Optional for reject action",
        "custom_message": "Optional custom message for emails",
        "send_emails": true
    }
    
    Response (Immediate):
    {
        "task_id": "uuid",
        "message": "Bulk action started in background",
        "status_url": "/api/v1/applications/bulk-action/{task_id}/status",
        "total_applications": 10,
        "estimated_time": "2-5 minutes"
    }
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if not current_user or current_user.role.name not in ["admin", "instructor"]:
        return jsonify({"error": "Unauthorized. Admin or instructor access required."}), 403
    
    data = request.get_json() or {}
    action = data.get("action", "").lower()
    application_ids = data.get("application_ids", [])
    rejection_reason = data.get("rejection_reason", "")
    custom_message = data.get("custom_message", "")
    send_emails = data.get("send_emails", True)
    
    # Validation
    if not action or action not in ["approve", "reject", "waitlist"]:
        return jsonify({
            "error": "Invalid action. Must be 'approve', 'reject', or 'waitlist'"
        }), 400
    
    if not application_ids or not isinstance(application_ids, list) or len(application_ids) == 0:
        return jsonify({
            "error": "application_ids must be a non-empty array"
        }), 400
    
    # Limit batch size for safety
    if len(application_ids) > 100:
        return jsonify({
            "error": f"Too many applications. Maximum 100 per batch, received {len(application_ids)}"
        }), 400
    
    if action == "reject" and not rejection_reason.strip():
        return jsonify({
            "error": "rejection_reason is required for reject action"
        }), 400
    
    # Generate unique task ID
    task_id = str(uuid.uuid4())
    
    # Initialize task tracking
    bulk_action_tasks[task_id] = {
        "task_id": task_id,
        "user_id": current_user_id,
        "action": action,
        "status": "pending",
        "progress": {
            "processed": 0,
            "total": len(application_ids)
        },
        "started_at": datetime.utcnow().isoformat(),
        "results": None,
        "error": None
    }
    
    logger.info(f"🚀 Starting background bulk {action} task {task_id} for {len(application_ids)} applications by user {current_user_id}")
    
    # Start background processing
    app = current_app._get_current_object()
    thread = threading.Thread(
        target=_process_bulk_action_background,
        args=(
            app,
            task_id,
            action,
            application_ids,
            rejection_reason,
            custom_message,
            current_user_id,
            send_emails
        )
    )
    thread.daemon = True
    thread.start()
    
    # Calculate estimated time (roughly 2-5 seconds per application)
    estimated_seconds = len(application_ids) * 3
    estimated_time = f"{estimated_seconds // 60} minutes" if estimated_seconds > 60 else f"{estimated_seconds} seconds"
    
    # Return immediately with task info
    return jsonify({
        "task_id": task_id,
        "message": f"Bulk {action} started in background",
        "status": "processing",
        "status_url": f"/api/v1/applications/bulk-action/{task_id}/status",
        "total_applications": len(application_ids),
        "estimated_time": estimated_time,
        "poll_interval_seconds": 2
    }), 202  # 202 Accepted - request accepted for processing


def _process_bulk_action_background(app, task_id, action, application_ids, rejection_reason, custom_message, admin_id, send_emails):
    """
    Background worker function to process bulk actions.
    Runs in a separate thread to avoid blocking the main request.
    """
    with app.app_context():
        try:
            # Update task status
            bulk_action_tasks[task_id]["status"] = "processing"
            
            results = {
                "success": [],
                "failed": []
            }
            
            logger.info(f"📊 Processing bulk {action} task {task_id}")
            
            # Fetch all applications at once
            applications_map = {}
            try:
                applications = CourseApplication.query.filter(
                    CourseApplication.id.in_(application_ids)
                ).all()
                applications_map = {app.id: app for app in applications}
            except Exception as e:
                logger.error(f"Error fetching applications: {str(e)}")
                bulk_action_tasks[task_id].update({
                    "status": "failed",
                    "error": f"Failed to fetch applications: {str(e)}",
                    "completed_at": datetime.utcnow().isoformat()
                })
                return
            
            # Process each application
            processed_count = 0
            for app_id in application_ids:
                try:
                    application = applications_map.get(app_id)
                    
                    if not application:
                        results["failed"].append({
                            "id": app_id,
                            "error": "Application not found"
                        })
                        processed_count += 1
                        bulk_action_tasks[task_id]["progress"]["processed"] = processed_count
                        continue
                    
                    # Check if application can be processed
                    if action == "approve" and application.status not in ["pending", "rejected", "withdrawn"]:
                        results["failed"].append({
                            "id": app_id,
                            "error": f"Cannot approve application with status: {application.status}"
                        })
                        processed_count += 1
                        bulk_action_tasks[task_id]["progress"]["processed"] = processed_count
                        continue
                    elif action in ["reject", "waitlist"] and application.status != "pending":
                        results["failed"].append({
                            "id": app_id,
                            "error": f"Application already {application.status}"
                        })
                        processed_count += 1
                        bulk_action_tasks[task_id]["progress"]["processed"] = processed_count
                        continue
                    
                    # Perform action with individual transaction
                    db.session.begin_nested()
                    try:
                        if action == "approve":
                            success, error_msg = _bulk_approve_application(
                                application, 
                                custom_message,
                                admin_id,
                                send_emails
                            )
                            if success:
                                db.session.commit()
                                results["success"].append({
                                    "id": app_id,
                                    "status": "approved",
                                    "email": application.email
                                })
                            else:
                                db.session.rollback()
                                results["failed"].append({
                                    "id": app_id,
                                    "error": error_msg
                                })
                        
                        elif action == "reject":
                            success, error_msg = _bulk_reject_application(
                                application,
                                rejection_reason,
                                admin_id,
                                send_emails
                            )
                            if success:
                                db.session.commit()
                                results["success"].append({
                                    "id": app_id,
                                    "status": "rejected",
                                    "email": application.email
                                })
                            else:
                                db.session.rollback()
                                results["failed"].append({
                                    "id": app_id,
                                    "error": error_msg
                                })
                        
                        elif action == "waitlist":
                            success, error_msg = _bulk_waitlist_application(
                                application,
                                custom_message,
                                admin_id,
                                send_emails
                            )
                            if success:
                                db.session.commit()
                                results["success"].append({
                                    "id": app_id,
                                    "status": "waitlisted",
                                    "email": application.email
                                })
                            else:
                                db.session.rollback()
                                results["failed"].append({
                                    "id": app_id,
                                    "error": error_msg
                                })
                    except Exception as action_error:
                        db.session.rollback()
                        logger.error(f"Transaction error for application {app_id}: {str(action_error)}")
                        results["failed"].append({
                            "id": app_id,
                            "error": f"Transaction failed: {str(action_error)}"
                        })
                    
                    # Update progress
                    processed_count += 1
                    bulk_action_tasks[task_id]["progress"]["processed"] = processed_count
                
                except Exception as e:
                    logger.error(f"Error processing application {app_id}: {str(e)}")
                    results["failed"].append({
                        "id": app_id,
                        "error": f"Internal error: {str(e)}"
                    })
                    processed_count += 1
                    bulk_action_tasks[task_id]["progress"]["processed"] = processed_count
            
            # Mark task as completed
            total_processed = len(application_ids)
            successful = len(results["success"])
            failed = len(results["failed"])
            
            bulk_action_tasks[task_id].update({
                "status": "completed",
                "results": results,
                "summary": {
                    "total_processed": total_processed,
                    "successful": successful,
                    "failed": failed,
                    "action": action
                },
                "completed_at": datetime.utcnow().isoformat()
            })
            
            logger.info(f"✅ Bulk {action} task {task_id} completed: {successful} successful, {failed} failed")
            
        except Exception as e:
            logger.error(f"❌ Fatal error in bulk action task {task_id}: {str(e)}")
            bulk_action_tasks[task_id].update({
                "status": "failed",
                "error": f"Fatal error: {str(e)}",
                "completed_at": datetime.utcnow().isoformat()
            })


def _bulk_approve_application(application, custom_message, admin_id, send_emails=True):
    """
    Helper function to approve a single application in bulk operation.
    Returns (success: bool, error_message: str)
    """
    try:
        from ..models.course_models import Course
        from ..models.student_models import ModuleProgress
        
        # Validate course exists
        course = Course.query.get(application.course_id)
        if not course:
            return False, "Course not found"
        
        # Check if user already exists
        existing_user = User.query.filter_by(email=application.email).first()
        existing_enrollment = None
        
        if existing_user:
            # Check for duplicate enrollment
            existing_enrollment = Enrollment.query.filter_by(
                student_id=existing_user.id,
                course_id=application.course_id
            ).first()
            
            if existing_enrollment:
                # Re-approval case - reactivate existing enrollment
                logger.info(f"Re-approving application {application.id} - reactivating existing enrollment {existing_enrollment.id}")
                enrollment = existing_enrollment
            else:
                # Create enrollment for existing user
                enrollment = Enrollment(
                    student_id=existing_user.id,
                    course_id=application.course_id
                )
                db.session.add(enrollment)
            
            # Generate password reset token for existing user
            temp_password = None  # No password for existing users
            reset_token = existing_user.generate_reset_token()
            logger.info(f"Generated password reset token for existing user {existing_user.username}")
            
            user = existing_user
            new_account = False
        else:
            # Create new user
            username = generate_username(
                application.first_name or application.full_name.split()[0],
                application.last_name or " ".join(application.full_name.split()[1:])
            )
            temp_password = generate_temp_password()
            
            student_role = Role.query.filter_by(name="student").first()
            if not student_role:
                return False, "Student role not found in system"
            
            user = User(
                username=username,
                email=application.email,
                first_name=application.first_name or application.full_name.split()[0],
                last_name=application.last_name or " ".join(application.full_name.split()[1:]),
                role_id=student_role.id,
                must_change_password=True
            )
            user.set_password(temp_password)
            db.session.add(user)
            db.session.flush()
            
            # Create enrollment
            enrollment = Enrollment(
                student_id=user.id,
                course_id=application.course_id
            )
            db.session.add(enrollment)
            new_account = True
        
        # Update application status
        application.status = "approved"
        application.approved_by = admin_id
        application.reviewed_at = datetime.utcnow()
        
        db.session.flush()
        
        # Initialize progress tracking for course modules (check for existing)
        modules = course.modules.filter_by(is_published=True).all()
        for module in modules:
            # Check if module progress already exists
            existing_progress = ModuleProgress.query.filter_by(
                student_id=user.id,
                module_id=module.id,
                enrollment_id=enrollment.id
            ).first()
            
            if not existing_progress:
                module_progress = ModuleProgress(
                    student_id=user.id,
                    module_id=module.id,
                    enrollment_id=enrollment.id
                )
                db.session.add(module_progress)
        
        # Send email notification (non-blocking)
        if send_emails:
            try:
                # Generate reset link for existing users
                reset_link = None
                if not new_account and temp_password is None:
                    reset_link = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/auth/reset-password?token={reset_token}&email={application.email}"
                
                # Send professional welcome email matching single approval
                email_content = application_approved_email(
                    application=application,
                    course=course,
                    username=user.username,
                    temp_password=temp_password,
                    custom_message=custom_message,
                    is_new_account=new_account,
                    password_reset_link=reset_link
                )
                
                send_email(
                    to=application.email,
                    subject=f"🎉 Congratulations! Welcome to {course.title}",
                    template=email_content
                )
                logger.info(f"✅ Welcome email sent to {application.email}")
            except Exception as email_error:
                logger.warning(f"Failed to send approval email for app {application.id}: {str(email_error)}")
        
        return True, None
        
    except Exception as e:
        logger.error(f"Error in bulk approve: {str(e)}")
        return False, str(e)


def _bulk_reject_application(application, rejection_reason, admin_id, send_emails=True):
    """
    Helper function to reject a single application in bulk operation.
    Returns (success: bool, error_message: str)
    """
    try:
        from ..models.course_models import Course
        
        course = Course.query.get(application.course_id)
        if not course:
            return False, "Course not found"
        
        # Update application status
        application.status = "rejected"
        application.rejection_reason = rejection_reason
        application.reviewed_at = datetime.utcnow()
        application.approved_by = admin_id  # Track who rejected it
        
        # Send rejection email (non-blocking)
        if send_emails:
            try:
                email_content = application_rejected_email(
                    application=application,
                    course_title=course.title,
                    reason=rejection_reason
                )
                
                send_email(
                    to=application.email,
                    subject=f"Application Update - {course.title}",
                    template=email_content
                )
                logger.info(f"✅ Rejection email sent to {application.email}")
            except Exception as email_error:
                logger.warning(f"Failed to send rejection email for app {application.id}: {str(email_error)}")
        
        return True, None
        
    except Exception as e:
        logger.error(f"Error in bulk reject: {str(e)}")
        return False, str(e)


def _bulk_waitlist_application(application, custom_message, admin_id, send_emails=True):
    """
    Helper function to waitlist a single application in bulk operation.
    Returns (success: bool, error_message: str)
    """
    try:
        from ..models.course_models import Course
        
        course = Course.query.get(application.course_id)
        if not course:
            return False, "Course not found"
        
        # Update application status
        application.status = "waitlisted"
        application.reviewed_at = datetime.utcnow()
        application.approved_by = admin_id  # Track who waitlisted it
        
        # Send waitlist email (non-blocking)
        if send_emails:
            try:
                email_content = application_waitlisted_email(
                    application=application,
                    course_title=course.title,
                    position=None  # Position can be calculated if needed
                )
                
                send_email(
                    to=application.email,
                    subject=f"Application Waitlisted - {course.title}",
                    template=email_content
                )
                logger.info(f"✅ Waitlist email sent to {application.email}")
            except Exception as email_error:
                logger.warning(f"Failed to send waitlist email for app {application.id}: {str(email_error)}")
        
        return True, None
        
    except Exception as e:
        logger.error(f"Error in bulk waitlist: {str(e)}")
        return False, str(e)


# ✅ Custom Email to Applicants (Admin Only) - Background Processing
@application_bp.route("/send-custom-email", methods=["POST"])
@jwt_required()
def send_custom_email():
    """
    Start a custom email sending task in the background.
    Returns immediately with a task ID that can be polled for status.
    
    Request body:
    {
        "subject": "Email subject",
        "message": "Email message body",
        "course_id": 1,  // Optional: filter by specific course
        "status_filter": "pending",  // Optional: filter by status
        "include_all": true  // If true, send to all applicants
    }
    
    Response (Immediate):
    {
        "task_id": "uuid",
        "message": "Custom email task started in background",
        "status_url": "/api/v1/applications/custom-email/{task_id}/status",
        "total_applications": 25,
        "estimated_time": "1-3 minutes"
    }
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if not current_user or current_user.role.name != "admin":
        return jsonify({"error": "Unauthorized. Admin access required."}), 403
    
    data = request.get_json() or {}
    subject = data.get("subject", "").strip()
    message = data.get("message", "").strip()
    course_id = data.get("course_id")
    status_filter = data.get("status_filter")
    include_all = data.get("include_all", False)
    
    if not subject or not message:
        return jsonify({"error": "Subject and message are required"}), 400
    
    try:
        # Build query for applications (same as before)
        query = CourseApplication.query
        
        if not include_all:
            if course_id:
                query = query.filter(CourseApplication.course_id == course_id)
            if status_filter:
                query = query.filter(CourseApplication.status == status_filter)
        
        applications = query.all()
        
        if not applications:
            return jsonify({"error": "No applications found matching the criteria"}), 404
        
        # Generate unique task ID
        task_id = str(uuid.uuid4())
        
        # Initialize task tracking
        custom_email_tasks[task_id] = {
            "status": "started",
            "progress": {"processed": 0, "total": len(applications)},
            "results": {
                "sent_count": 0,
                "failed_count": 0,
                "total_applications": len(applications),
                "failed_emails": []
            },
            "started_at": datetime.utcnow().isoformat(),
            "admin_id": current_user_id
        }
        
        # Start background task with proper Flask app context
        application_ids = [app.id for app in applications]
        
        try:
            # Pass the current Flask app context to background thread
            from flask import current_app
            thread = threading.Thread(
                target=process_custom_email_task,
                args=(task_id, application_ids, subject, message, current_user_id, current_app._get_current_object())
            )
            thread.daemon = True
            thread.start()
            logger.info(f"🚀 Started background thread for task {task_id}")
        except Exception as thread_error:
            logger.error(f"❌ Failed to start background thread: {str(thread_error)}")
            custom_email_tasks[task_id]["status"] = "failed"
            custom_email_tasks[task_id]["error"] = f"Failed to start background thread: {str(thread_error)}"
            return jsonify({"error": f"Failed to start background thread: {str(thread_error)}"}), 500
        
        # Return immediate response
        return jsonify({
            "task_id": task_id,
            "message": "Custom email task started in background",
            "status_url": f"/api/v1/applications/custom-email/{task_id}/status",
            "total_applications": len(applications),
            "estimated_time": "1-3 minutes"
        }), 202  # 202 Accepted
        
    except Exception as e:
        logger.error(f"Error starting custom email task: {str(e)}")
        return jsonify({"error": f"Failed to start custom email task: {str(e)}"}), 500


# ✅ Custom Email Task Status (Admin Only)
@application_bp.route("/custom-email/<task_id>/status", methods=["GET"])
@jwt_required()
def get_custom_email_task_status(task_id):
    """
    Get the status of a custom email background task
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if not current_user or current_user.role.name not in ["admin"]:
        return jsonify({"error": "Unauthorized"}), 403
    
    task = custom_email_tasks.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    
    # Add debug logging
    logger.info(f"🔍 Task {task_id} status check: {task.get('status')}, progress: {task.get('progress')}")
    
    response = {
        "task_id": task_id,
        "status": task["status"],
        "progress": task["progress"]
    }
    
    if task.get("status") == "completed":
        response["results"] = task.get("results", {})
        logger.info(f"📋 Task {task_id} completed with results: {task.get('results', {})}")
    
    if task.get("status") == "failed":
        response["error"] = task.get("error")
    
    return jsonify(response), 200


# 🐛 Debug endpoint to see all tasks (Admin Only - for debugging)
@application_bp.route("/custom-email/debug/all-tasks", methods=["GET"])
@jwt_required()
def debug_all_custom_email_tasks():
    """
    Debug endpoint to see all active custom email tasks
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if not current_user or current_user.role.name not in ["admin"]:
        return jsonify({"error": "Unauthorized"}), 403
    
    return jsonify({
        "total_tasks": len(custom_email_tasks),
        "tasks": custom_email_tasks
    }), 200


def process_custom_email_task(task_id, application_ids, subject, message, admin_id, app_instance):
    """
    Process custom email sending in background with proper Flask context
    """
    import time
    from flask import current_app
    
    logger.info(f"🎯 BACKGROUND THREAD STARTED: Task {task_id} with {len(application_ids)} applications")
    
    # Initialize counters
    sent_count = 0
    failed_count = 0
    failed_emails = []
    
    try:
        # Get the Flask app from the main module
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        from main import app as flask_app
        
        # Create proper Flask application context
        with flask_app.app_context():
            logger.info(f"🌐 Flask context created successfully for task {task_id}")
            
            # Update task status to processing
            custom_email_tasks[task_id]["status"] = "processing"
            logger.info(f"📝 Task {task_id} status updated to 'processing'")
            
            # Import models inside the Flask context
            from ..models.course_application import CourseApplication
            from ..models.user_models import db
            
            try:
                # Re-query applications with fresh database session
                applications = CourseApplication.query.filter(
                    CourseApplication.id.in_(application_ids)
                ).all()
                
                logger.info(f"📄 Retrieved {len(applications)} applications from database for task {task_id}")
                
                if not applications:
                    raise Exception("No applications found in database")
                
                # Split applications: first 10 get individual emails, rest get BCC
                direct_applications = applications[:10]
                bcc_applications = applications[10:]
                
                logger.info(f"📧 Processing emails: {len(direct_applications)} individual, {len(bcc_applications)} BCC")
                
                # Process individual emails first
                direct_emails_data = []
                for i, app in enumerate(direct_applications):
                    try:
                        recipient_name = app.full_name or "Applicant"
                        email_content = custom_application_email(
                            recipient_name=recipient_name,
                            subject=subject,
                            message=message
                        )
                        
                        direct_emails_data.append({
                            'email': app.email,
                            'template': email_content,
                            'recipient_name': recipient_name,
                            'application_id': app.id
                        })
                        
                        # Update progress incrementally
                        processed = i + 1
                        custom_email_tasks[task_id]["progress"]["processed"] = processed
                        logger.info(f"📈 Progress: {processed}/{len(applications)} for task {task_id}")
                        
                        # Small delay to prevent overwhelming
                        time.sleep(0.1)
                        
                    except Exception as prep_error:
                        logger.error(f"❌ Error preparing email for {app.email}: {str(prep_error)}")
                        failed_emails.append({
                            "email": app.email,
                            "recipient_name": app.full_name or "Applicant",
                            "error": f"Email preparation failed: {str(prep_error)}",
                            "application_id": app.id
                        })
                        failed_count += 1
                
                # Send individual emails using batch function with enhanced error handling
                if direct_emails_data:
                    try:
                        successful_emails, failed_email_details = send_emails_batch(
                            direct_emails_data, subject, retries=3
                        )
                        
                        sent_count += len(successful_emails)
                        failed_count += len(failed_email_details)
                        failed_emails.extend(failed_email_details)
                        
                        logger.info(f"📧 Individual emails: {len(successful_emails)} sent, {len(failed_email_details)} failed")
                        
                    except Exception as batch_error:
                        logger.error(f"❌ Batch email error: {str(batch_error)}")
                        # Mark all direct emails as failed
                        for email_data in direct_emails_data:
                            failed_emails.append({
                                "email": email_data['email'],
                                "recipient_name": email_data['recipient_name'],
                                "error": f"Batch sending failed: {str(batch_error)}",
                                "application_id": email_data['application_id']
                            })
                        failed_count += len(direct_emails_data)
                
                # Update progress after individual emails
                custom_email_tasks[task_id]["progress"]["processed"] = len(direct_applications)
                
                # Process BCC emails if any
                if bcc_applications:
                    try:
                        bcc_emails = [app.email for app in bcc_applications]
                        logger.info(f"📧 Sending BCC email to {len(bcc_emails)} recipients")
                        
                        # Use a generic name for BCC email
                        email_content = custom_application_email(
                            recipient_name="Applicant",
                            subject=subject,
                            message=message
                        )
                        
                        # Use first BCC email as primary recipient for better delivery
                        primary_recipient = bcc_emails[0]
                        remaining_bcc = bcc_emails[1:] if len(bcc_emails) > 1 else []
                        
                        success = send_email_with_bcc(
                            to=[primary_recipient],
                            bcc=remaining_bcc,
                            subject=subject,
                            template=email_content
                        )
                        
                        if success:
                            sent_count += len(bcc_applications)
                            logger.info(f"✅ BCC custom email sent to {len(bcc_applications)} recipients")
                        else:
                            failed_count += len(bcc_applications)
                            for app in bcc_applications:
                                failed_emails.append({
                                    "email": app.email,
                                    "recipient_name": app.full_name or "Applicant",
                                    "error": "BCC email delivery failed",
                                    "application_id": app.id
                                })
                            logger.error(f"❌ Failed to send BCC custom email")
                            
                    except Exception as bcc_error:
                        logger.error(f"❌ BCC email error: {str(bcc_error)}")
                        failed_count += len(bcc_applications)
                        for app in bcc_applications:
                            failed_emails.append({
                                "email": app.email,
                                "recipient_name": app.full_name or "Applicant",
                                "error": f"BCC email failed: {str(bcc_error)}",
                                "application_id": app.id
                            })
                
                # Update final progress
                custom_email_tasks[task_id]["progress"]["processed"] = len(applications)
                
                # Mark task as completed
                custom_email_tasks[task_id]["status"] = "completed"
                custom_email_tasks[task_id]["results"] = {
                    "sent_count": sent_count,
                    "failed_count": failed_count,
                    "total_applications": len(applications),
                    "failed_emails": failed_emails
                }
                custom_email_tasks[task_id]["completed_at"] = datetime.utcnow().isoformat()
                
                logger.info(f"✅ Custom email task {task_id} completed: {sent_count} sent, {failed_count} failed")
                logger.info(f"💾 Task results stored: {len(failed_emails)} failed emails recorded")
                
            except Exception as db_error:
                logger.error(f"❌ Database error in task {task_id}: {str(db_error)}")
                custom_email_tasks[task_id]["status"] = "failed"
                custom_email_tasks[task_id]["error"] = f"Database error: {str(db_error)}"
                custom_email_tasks[task_id]["completed_at"] = datetime.utcnow().isoformat()
                
    except Exception as context_error:
        logger.error(f"❌ Flask context error for task {task_id}: {str(context_error)}")
        custom_email_tasks[task_id]["status"] = "failed"
        custom_email_tasks[task_id]["error"] = f"Flask context error: {str(context_error)}"
        custom_email_tasks[task_id]["completed_at"] = datetime.utcnow().isoformat()
    """
    Process custom email sending in background
    """
    from ..models.course_application import CourseApplication
    
    logger.info(f"🎯 BACKGROUND THREAD STARTED: Task {task_id} with {len(application_ids)} applications")
    
    # Create Flask application context using the passed app instance
    try:
        with app_instance.app_context():
            logger.info(f"🌐 Flask context created successfully for task {task_id}")
            
            logger.info(f"🎯 Starting custom email task {task_id} for {len(application_ids)} applications")
            
            # Update task status
            custom_email_tasks[task_id]["status"] = "processing"
            logger.info(f"📝 Task {task_id} status updated to 'processing'")
            
            # Re-query applications in the new context
            applications = CourseApplication.query.filter(CourseApplication.id.in_(application_ids)).all()
            logger.info(f"🔄 Re-queried {len(applications)} applications for task {task_id}")
            
            sent_count = 0
            failed_count = 0
            failed_emails = []
            
            # Split applications: first 10 get individual emails, rest get BCC
            direct_applications = applications[:10]
            bcc_applications = applications[10:]
            
            # Process individual emails first
            direct_emails_data = []
            for i, app in enumerate(direct_applications):
                recipient_name = app.full_name or "Applicant"
                email_content = custom_application_email(
                    recipient_name=recipient_name,
                    subject=subject,
                    message=message
                )
                direct_emails_data.append({
                    'email': app.email,
                    'template': email_content,
                    'recipient_name': recipient_name,
                    'application_id': app.id
                })
            
            logger.info(f"📧 Processing {len(direct_emails_data)} direct emails for task {task_id}")
            
            # Send individual emails using batch function
            successful_emails, failed_email_details = send_emails_batch(
                direct_emails_data, subject, retries=3
            )
            
            sent_count = len(successful_emails)
            failed_count = len(failed_email_details)
            failed_emails = failed_email_details
            
            # Update progress after direct emails
            custom_email_tasks[task_id]["progress"]["processed"] = len(direct_applications)
            logger.info(f"📈 Updated progress for task {task_id}: {len(direct_applications)}/{len(applications)} processed")
            
            # Process BCC emails if any
            if bcc_applications:
                try:
                    bcc_emails = [app.email for app in bcc_applications]
                    
                    # Use a generic name for BCC email
                    email_content = custom_application_email(
                        recipient_name="Applicant",
                        subject=subject,
                        message=message
                    )
                    
                    # Use first BCC email as primary recipient
                    primary_recipient = bcc_emails[0]
                    remaining_bcc = bcc_emails[1:] if len(bcc_emails) > 1 else []
                    
                    success = send_email_with_bcc(
                        to=[primary_recipient],
                        bcc=remaining_bcc,
                        subject=subject,
                        template=email_content
                    )
                    
                    if success:
                        sent_count += len(bcc_applications)
                        logger.info(f"✅ BCC custom email sent to {len(bcc_applications)} recipients")
                    else:
                        failed_count += len(bcc_applications)
                        for app in bcc_applications:
                            failed_emails.append({
                                "email": app.email,
                                "recipient_name": app.full_name or "Applicant",
                                "error": "BCC email failed",
                                "application_id": app.id
                            })
                        logger.error(f"❌ Failed to send BCC custom email")
                        
                except Exception as email_error:
                    failed_count += len(bcc_applications)
                    for app in bcc_applications:
                        failed_emails.append({
                            "email": app.email,
                            "recipient_name": app.full_name or "Applicant",
                            "error": str(email_error),
                            "application_id": app.id
                        })
                    logger.error(f"❌ Error sending BCC custom email: {str(email_error)}")
            
            # Update final progress
            custom_email_tasks[task_id]["progress"]["processed"] = len(applications)
            logger.info(f"📊 Final progress update for task {task_id}: {len(applications)}/{len(applications)} processed")
            
            # Mark task as completed
            custom_email_tasks[task_id]["status"] = "completed"
            custom_email_tasks[task_id]["results"] = {
                "sent_count": sent_count,
                "failed_count": failed_count,
                "total_applications": len(applications),
                "failed_emails": failed_emails
            }
            custom_email_tasks[task_id]["completed_at"] = datetime.utcnow().isoformat()
            
            logger.info(f"✅ Custom email task {task_id} completed: {sent_count} sent, {failed_count} failed")
            logger.info(f"💾 Task results stored: {len(failed_emails)} failed emails recorded")
            
    except Exception as e:
        logger.error(f"❌ Custom email task {task_id} failed: {str(e)}")
        custom_email_tasks[task_id]["status"] = "failed"
        custom_email_tasks[task_id]["error"] = str(e)
        custom_email_tasks[task_id]["completed_at"] = datetime.utcnow().isoformat()


# ✅ Retry Failed Custom Emails (Admin Only)
@application_bp.route("/retry-failed-emails", methods=["POST"])
@jwt_required()
def retry_failed_emails():
    """
    Retry sending emails to previously failed recipients
    
    Request body:
    {
        "failed_emails": [
            {
                "email": "user@example.com",
                "recipient_name": "John Doe",
                "application_id": 123
            }
        ],
        "subject": "Email subject",
        "message": "Email message body"
    }
    
    Response:
    {
        "success": true,
        "message": "Retry completed",
        "sent_count": 10,
        "failed_count": 2,
        "total_retried": 12,
        "still_failed": [...],
        "newly_successful": [...]
    }
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if not current_user or current_user.role.name != "admin":
        return jsonify({"error": "Unauthorized. Admin access required."}), 403
    
    data = request.get_json() or {}
    failed_emails_data = data.get("failed_emails", [])
    subject = data.get("subject", "").strip()
    message = data.get("message", "").strip()
    
    if not failed_emails_data or not subject or not message:
        return jsonify({"error": "Failed emails list, subject, and message are required"}), 400
    
    try:
        # Prepare email data for retry
        retry_emails_data = []
        for failed_email in failed_emails_data:
            email = failed_email.get("email")
            recipient_name = failed_email.get("recipient_name", "Applicant")
            
            if not email:
                continue
                
            email_content = custom_application_email(
                recipient_name=recipient_name,
                subject=subject,
                message=message
            )
            
            retry_emails_data.append({
                'email': email,
                'template': email_content,
                'recipient_name': recipient_name,
                'application_id': failed_email.get('application_id')
            })
        
        if not retry_emails_data:
            return jsonify({"error": "No valid email addresses to retry"}), 400
        
        # Generate unique task ID for retry
        task_id = str(uuid.uuid4())
        
        # Initialize retry task tracking
        custom_email_tasks[task_id] = {
            "status": "started",
            "progress": {"processed": 0, "total": len(retry_emails_data)},
            "results": {
                "sent_count": 0,
                "failed_count": 0,
                "total_retried": len(retry_emails_data),
                "newly_successful": [],
                "still_failed": []
            },
            "started_at": datetime.utcnow().isoformat(),
            "admin_id": current_user_id,
            "task_type": "retry_emails"
        }
        
        # Start background retry task
        try:
            thread = threading.Thread(
                target=process_retry_email_task,
                args=(task_id, retry_emails_data, subject, current_user_id, current_app._get_current_object())
            )
            thread.daemon = True
            thread.start()
            logger.info(f"🚀 Started retry email thread for task {task_id}")
        except Exception as thread_error:
            logger.error(f"❌ Failed to start retry thread: {str(thread_error)}")
            custom_email_tasks[task_id]["status"] = "failed"
            custom_email_tasks[task_id]["error"] = f"Failed to start background thread: {str(thread_error)}"
            return jsonify({"error": f"Failed to start background thread: {str(thread_error)}"}), 500
        
        # Return immediate response
        return jsonify({
            "task_id": task_id,
            "message": "Email retry task started in background",
            "status_url": f"/api/v1/applications/custom-email/{task_id}/status",
            "total_emails": len(retry_emails_data),
            "estimated_time": "30-60 seconds"
        }), 202  # 202 Accepted
        
    except Exception as e:
        logger.error(f"Error retrying failed emails: {str(e)}")
        return jsonify({"error": f"Failed to retry emails: {str(e)}"}), 500


def process_retry_email_task(task_id, retry_emails_data, subject, admin_id, app_instance):
    """
    Process email retry in background
    """
    from ..models.user_models import db
    
    logger.info(f"🔄 RETRY THREAD STARTED: Task {task_id} with {len(retry_emails_data)} emails")
    
    # Create Flask application context
    try:
        with app_instance.app_context():
            logger.info(f"🌐 Flask context created for retry task {task_id}")
            
            # Update task status
            custom_email_tasks[task_id]["status"] = "processing"
            logger.info(f"📝 Retry task {task_id} status updated to 'processing'")
            
            # Retry sending emails with enhanced retry logic
            successful_emails, still_failed = send_emails_batch(
                retry_emails_data, subject, retries=5  # More retries for failed emails
            )
            
            # Update task progress
            custom_email_tasks[task_id]["progress"]["processed"] = len(retry_emails_data)
            
            # Mark task as completed
            custom_email_tasks[task_id]["status"] = "completed"
            custom_email_tasks[task_id]["results"] = {
                "sent_count": len(successful_emails),
                "failed_count": len(still_failed),
                "total_retried": len(retry_emails_data),
                "newly_successful": successful_emails,
                "still_failed": still_failed
            }
            custom_email_tasks[task_id]["completed_at"] = datetime.utcnow().isoformat()
            
            logger.info(f"✅ Retry task {task_id} completed: {len(successful_emails)} successful, {len(still_failed)} still failed")
            
    except Exception as e:
        logger.error(f"❌ Retry task {task_id} failed: {str(e)}")
        custom_email_tasks[task_id]["status"] = "failed"
        custom_email_tasks[task_id]["error"] = str(e)
        custom_email_tasks[task_id]["completed_at"] = datetime.utcnow().isoformat()


# 🧪 Test search functionality (for debugging)
@application_bp.route("/test-search", methods=["POST"])
@jwt_required()
def test_search():
    """
    Test endpoint to debug search functionality and see what results are returned.
    """
    data = request.get_json() or {}
    search_term = data.get("search", "").strip()
    
    if not search_term:
        return jsonify({
            "error": "search term is required",
            "search_term": search_term,
            "status": "no_search_term"
        }), 400
    
    try:
        # Get all applications first
        all_count = CourseApplication.query.count()
        
        # Test different search patterns
        exact_matches = CourseApplication.query.filter(
            or_(
                CourseApplication.full_name.ilike(search_term),
                CourseApplication.email.ilike(search_term)
            )
        ).all()
        
        starts_with_matches = CourseApplication.query.filter(
            or_(
                CourseApplication.full_name.ilike(f"{search_term}%"),
                CourseApplication.email.ilike(f"{search_term}%")
            )
        ).all()
        
        partial_matches = CourseApplication.query.filter(
            or_(
                CourseApplication.full_name.ilike(f"%{search_term}%"),
                CourseApplication.email.ilike(f"%{search_term}%")
            )
        ).all()
        
        # Get sample data from each category
        def get_match_info(apps, limit=5):
            return [{
                "id": app.id,
                "full_name": app.full_name,
                "email": app.email,
                "match_score": "exact" if app in exact_matches else 
                             "starts_with" if app in starts_with_matches else "partial"
            } for app in apps[:limit]]
        
        return jsonify({
            "search_term": search_term,
            "total_applications": all_count,
            "search_results": {
                "exact_matches": {
                    "count": len(exact_matches),
                    "samples": get_match_info(exact_matches)
                },
                "starts_with_matches": {
                    "count": len(starts_with_matches),
                    "samples": get_match_info(starts_with_matches)
                },
                "partial_matches": {
                    "count": len(partial_matches),
                    "samples": get_match_info(partial_matches)
                }
            },
            "debug_info": {
                "patterns_tested": {
                    "exact": search_term,
                    "starts_with": f"{search_term}%",
                    "partial": f"%{search_term}%"
                }
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "error": "Search test failed",
            "details": str(e),
            "search_term": search_term
        }), 500