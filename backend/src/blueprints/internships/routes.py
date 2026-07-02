# Internship Application API Routes

from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from marshmallow import ValidationError
from sqlalchemy import and_, or_
from datetime import datetime
import logging
import os

from src.models.user_models import db, User
from src.models.internship_models import (
    InternshipTrack,
    InternshipCohort,
    InternshipApplication,
    ApplicationStatusLog,
    ApplicationStatusEnum,
    ApplicantTypeEnum,
    InternshipTask,
    InternshipTaskAssignment,
    InternshipTaskTypeEnum,
    InternshipPriorityEnum,
    AssignmentStatusEnum,
    InternshipOfferLetter,
)
from .schemas import (
    InternshipTrackSchema,
    InternshipCohortSchema,
    InternshipApplicationSchema,
    ApplicationSubmissionSchema,
    ApplicationStatusUpdateSchema,
    AssignCohortSchema,
    ApplicationFiltersSchema,
)
from .utils import (
    validate_phone_number,
    sanitize_text,
    save_cv_file,
    get_next_available_reference_code,
    is_valid_status_transition,
    paginate_query,
    error_response,
    success_response,
    role_required,
    get_accepting_cohorts,
)
from src.services.internship_mailer import InternshipMailer
from src.services.internship_offer_service import InternshipOfferService

logger = logging.getLogger(__name__)

# Create blueprint
internships_bp = Blueprint('internships', __name__, url_prefix='/api/v1/internships')

# Initialize mailer
mailer = InternshipMailer()


# ============= PUBLIC ROUTES =============

@internships_bp.route('/tracks', methods=['GET'])
def get_tracks():
    """
    Get all active internship tracks with open cohort count.
    Query params:
    - include_cohorts: bool (default: False) - include cohorts in response
    """
    try:
        include_cohorts = request.args.get('include_cohorts', 'false').lower() == 'true'
        
        tracks = InternshipTrack.query.filter_by(is_active=True).all()
        schema = InternshipTrackSchema()
        
        data = []
        for track in tracks:
            track_data = schema.dump(track)
            open_cohorts = get_accepting_cohorts(track.id)
            track_data['open_cohorts_count'] = len(open_cohorts)
            
            if include_cohorts:
                track_data['cohorts'] = [c.to_dict() for c in open_cohorts]
            
            data.append(track_data)
        
        return success_response('Tracks retrieved successfully', data)
    except Exception as e:
        logger.error(f"Error fetching tracks: {str(e)}")
        return error_response('Failed to fetch tracks', status_code=500)


@internships_bp.route('/tracks/<slug>', methods=['GET'])
def get_track_detail(slug):
    """Get detailed information about a specific track with cohorts"""
    try:
        track = InternshipTrack.query.filter_by(slug=slug, is_active=True).first()
        
        if not track:
            return error_response('Track not found', status_code=404)
        
        track_data = track.to_dict(include_cohorts=False)
        
        # Get accepting cohorts for this track
        cohorts = get_accepting_cohorts(track.id)
        track_data['cohorts'] = [c.to_dict() for c in cohorts]
        
        return success_response('Track details retrieved', track_data)
    except Exception as e:
        logger.error(f"Error fetching track detail: {str(e)}")
        return error_response('Failed to fetch track', status_code=500)


@internships_bp.route('/cohorts', methods=['GET'])
def get_cohorts():
    """
    Get all open cohorts.
    Query params:
    - track: str (optional) - filter by track slug
    - page: int (default: 1)
    - per_page: int (default: 20)
    """
    try:
        track_slug = request.args.get('track')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # Validate pagination
        if page < 1 or per_page < 1 or per_page > 100:
            return error_response('Invalid pagination parameters', status_code=400)
        
        # Build query
        query = InternshipCohort.query.filter_by(is_accepting=True)
        
        if track_slug:
            track = InternshipTrack.query.filter_by(slug=track_slug, is_active=True).first()
            if not track:
                return error_response('Track not found', status_code=404)
            query = query.filter_by(track_id=track.id)
        
        # Filter by end_date > now
        now = datetime.utcnow()
        query = query.filter(InternshipCohort.end_date > now)
        
        # Paginate
        result = paginate_query(query, page, per_page)
        
        result['data'] = [c.to_dict() for c in result['data']]
        
        return success_response('Cohorts retrieved successfully', result)
    except Exception as e:
        logger.error(f"Error fetching cohorts: {str(e)}")
        return error_response('Failed to fetch cohorts', status_code=500)


@internships_bp.route('/apply', methods=['POST'])
def submit_application():
    """
    Submit internship application with CV upload.
    Multipart form data with file upload.
    """
    try:
        # ----------------------------------------------------------------
        # 1. Parse request data (multipart form with optional JSON fallback)
        # ----------------------------------------------------------------
        form_data = {}
        cv_file = None

        if request.files and 'cv' in request.files:
            cv_file = request.files['cv']

        if request.form:
            form_data = request.form.to_dict()
        elif request.is_json:
            # JSON fallback for programmatic clients
            json_data = request.get_json(silent=True) or {}
            form_data = {k: v for k, v in json_data.items() if not isinstance(v, (dict, list))}
            logger.info("Received /apply request as JSON instead of multipart form")

        # ----------------------------------------------------------------
        # 2. Validate CV file
        # ----------------------------------------------------------------
        if not cv_file or cv_file.filename == '':
            return error_response(
                'CV file is required',
                {'cv': ['A CV/resume file (PDF, DOC, or DOCX) is required']},
                status_code=400
            )

        # ----------------------------------------------------------------
        # 3. Validate form data schema
        # ----------------------------------------------------------------
        schema = ApplicationSubmissionSchema()
        try:
            validated_data = schema.load(form_data)
        except ValidationError as e:
            logger.error(f"Schema validation failed for /apply | errors: {e.messages} | fields: {list(form_data.keys())}")
            return error_response('Validation failed', e.messages, status_code=400)

        # ----------------------------------------------------------------
        # 4. Validate phone number
        # ----------------------------------------------------------------
        if not validate_phone_number(validated_data['phone']):
            return error_response(
                'Invalid phone number format',
                {
                    'phone': [
                        'Enter a valid phone number (e.g. +250788123456 or 0788123456)'
                    ]
                },
                status_code=400
            )

        # ----------------------------------------------------------------
        # 5. Check email uniqueness (recent submissions only)
        # ----------------------------------------------------------------
        existing = InternshipApplication.query.filter_by(
            email=validated_data['email'],
            status=ApplicationStatusEnum.PENDING
        ).first()

        if existing and (datetime.utcnow() - existing.created_at).days < 30:
            return error_response(
                'You have already submitted an application. Use your reference code to check status.',
                {'email': ['An application from this email is already pending review']},
                status_code=409
            )

        # ----------------------------------------------------------------
        # 6. Validate track (accepts UUID, slug, or numeric index)
        # ----------------------------------------------------------------
        track_id_value = validated_data['track_id']
        track = InternshipTrack.query.get(track_id_value)
        if not track or not track.is_active:
            # Fallback: try resolving by slug
            track = InternshipTrack.query.filter_by(
                slug=track_id_value, is_active=True
            ).first()

        if not track and track_id_value is not None:
            # Fallback: try resolving numeric index (1-based) to active tracks
            try:
                idx = int(track_id_value)
                if idx >= 1:
                    active_tracks = InternshipTrack.query.filter_by(
                        is_active=True
                    ).order_by(InternshipTrack.created_at.asc()).all()
                    if 1 <= idx <= len(active_tracks):
                        track = active_tracks[idx - 1]
            except (ValueError, TypeError):
                pass

        if not track:
            logger.error(f"Track not found for track_id={validated_data['track_id']}")
            return error_response(
                'Invalid track selected',
                {'track_id': ['The selected internship track does not exist']},
                status_code=400
            )
        if not track.is_active:
            return error_response(
                'Track is no longer accepting applications',
                {'track_id': ['This track is currently inactive']},
                status_code=400
            )

        # Use the resolved track UUID going forward (in case slug was provided)
        validated_data['track_id'] = track.id

        # ----------------------------------------------------------------
        # 7. Validate cohort (if provided)
        # ----------------------------------------------------------------
        cohort = None
        if validated_data.get('cohort_id'):
            cohort = InternshipCohort.query.get(validated_data['cohort_id'])
            if not cohort:
                return error_response(
                    'Invalid cohort',
                    {'cohort_id': ['The selected cohort does not exist']},
                    status_code=400
                )
            if not cohort.is_accepting:
                return error_response(
                    'Cohort is not accepting applications',
                    {'cohort_id': ['This cohort is not currently accepting applications']},
                    status_code=400
                )
            if cohort.is_full():
                return error_response(
                    'Cohort is full',
                    {'cohort_id': ['This cohort has reached its capacity']},
                    status_code=400
                )

        # ----------------------------------------------------------------
        # 8. Save CV file
        # ----------------------------------------------------------------
        try:
            cv_path, cv_original_name = save_cv_file(cv_file, cv_file.filename)
        except ValueError as e:
            return error_response(str(e), {'cv': [str(e)]}, status_code=400)
        except Exception as e:
            logger.error(f"Error saving CV file: {str(e)}")
            return error_response('Failed to save CV file. Please try again.', status_code=500)

        # ----------------------------------------------------------------
        # 9. Generate reference code & create application
        # ----------------------------------------------------------------
        try:
            reference_code = get_next_available_reference_code()

            application = InternshipApplication(
                reference_code=reference_code,
                applicant_type=ApplicantTypeEnum(validated_data['applicant_type']),
                full_name=sanitize_text(validated_data['full_name']),
                email=validated_data['email'].lower(),
                phone=validated_data['phone'].strip(),
                national_id=validated_data.get('national_id'),
                track_id=validated_data['track_id'],
                cohort_id=validated_data.get('cohort_id'),
                motivation_letter=sanitize_text(validated_data['motivation_letter']),
                portfolio_url=validated_data.get('portfolio_url'),
                github_url=validated_data.get('github_url'),
                linkedin_url=validated_data.get('linkedin_url'),
                cv_file_path=cv_path,
                cv_original_name=cv_original_name,
                status=ApplicationStatusEnum.PENDING,
            )

            db.session.add(application)
            db.session.commit()

            # Send confirmation emails (non-blocking — errors are logged, not returned)
            try:
                mailer.send_application_confirmation(application)
            except Exception as mail_err:
                logger.error(f"Failed to send confirmation email: {mail_err}")

            try:
                mailer.send_admin_new_application_alert(application)
            except Exception as mail_err:
                logger.error(f"Failed to send admin alert email: {mail_err}")

            logger.info(f"Application created: ref={reference_code} track={validated_data['track_id']} email={validated_data['email']}")

            return success_response(
                'Application submitted successfully',
                {
                    'reference_code': reference_code,
                    'message': f'Application submitted. Use reference code {reference_code} to check status.',
                },
                status_code=201
            )

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating application record: {str(e)}", exc_info=True)
            # Check for unique constraint violations
            error_str = str(e).lower()
            if 'unique' in error_str or 'duplicate' in error_str:
                return error_response('A duplicate application was detected. Please try again.', status_code=409)
            return error_response('Failed to submit application. Please try again.', status_code=500)

    except Exception as e:
        logger.error(f"Unexpected error in submit_application: {str(e)}", exc_info=True)
        return error_response('An unexpected error occurred. Please try again.', status_code=500)


@internships_bp.route('/apply/status', methods=['GET'])
def check_application_status():
    """
    Public application status check by reference code and email.
    Query params:
    - ref: str (required) - reference code
    - email: str (required) - application email
    """
    try:
        ref = request.args.get('ref')
        email = request.args.get('email')
        
        if not ref or not email:
            return error_response('Reference code and email are required', status_code=400)
        
        application = InternshipApplication.query.filter_by(
            reference_code=ref,
            email=email.lower()
        ).first()
        
        if not application:
            return error_response('Application not found', status_code=404)
        
        # Map status to human-readable review stage
        review_stage_map = {
            'pending': 'Application Received',
            'reviewing': 'Under Review',
            'shortlisted': 'Shortlisted',
            'interview_scheduled': 'Interview Scheduled',
            'accepted': 'Accepted',
            'rejected': 'Rejected',
        }
        
        status_data = {
            'status': application.status.value if application.status else 'pending',
            'submittedAt': application.created_at.isoformat(),
            'review_stage': review_stage_map.get(application.status.value if application.status else 'pending', 'Application Received'),
            'full_name': application.full_name,
            'email': application.email,
            'reference_code': application.reference_code,
            'track_name': application.track.name if application.track else None,
            'updated_at': application.updated_at.isoformat(),
        }
        
        return success_response('Application status retrieved', status_data)
    except Exception as e:
        logger.error(f"Error checking status: {str(e)}")
        return error_response('Failed to check status', status_code=500)


# ============= AUTHENTICATED ROUTES =============

@internships_bp.route('/my-applications', methods=['GET'])
@jwt_required()
def get_my_applications():
    """Get current user's internship applications"""
    try:
        user_id = int(get_jwt_identity())
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        if page < 1 or per_page < 1 or per_page > 100:
            return error_response('Invalid pagination parameters', status_code=400)
        
        query = InternshipApplication.query.filter_by(user_id=user_id).order_by(
            InternshipApplication.created_at.desc()
        )
        
        result = paginate_query(query, page, per_page)
        result['data'] = [a.to_dict() for a in result['data']]
        
        return success_response('My applications retrieved', result)
    except Exception as e:
        logger.error(f"Error fetching my applications: {str(e)}")
        return error_response('Failed to fetch applications', status_code=500)


@internships_bp.route('/my-applications/<app_id>', methods=['GET'])
@jwt_required()
def get_my_application(app_id):
    """Get specific user application"""
    try:
        user_id = int(get_jwt_identity())
        
        application = InternshipApplication.query.filter_by(
            id=app_id,
            user_id=user_id
        ).first()
        
        if not application:
            return error_response('Application not found', status_code=404)
        
        return success_response('Application retrieved', application.to_dict(include_logs=True))
    except Exception as e:
        logger.error(f"Error fetching application: {str(e)}")
        return error_response('Failed to fetch application', status_code=500)


# ============= ADMIN ROUTES =============

@internships_bp.route('/admin/applications', methods=['GET'])
@role_required(['admin', 'staff'])
def get_admin_applications():
    """
    Get all applications with advanced filtering.
    Query params:
    - status: str
    - track_id: str
    - cohort_id: str
    - search: str (search in name/email)
    - start_date: ISO datetime
    - end_date: ISO datetime
    - page: int
    - per_page: int
    - sort_by: str (created_at, updated_at, name, status)
    - sort_order: str (asc, desc)
    """
    try:
        # Parse query params
        params = {
            'status': request.args.get('status'),
            'track_id': request.args.get('track_id'),
            'cohort_id': request.args.get('cohort_id'),
            'search': request.args.get('search'),
            'applicant_type': request.args.get('applicant_type'),
            'start_date': request.args.get('start_date'),
            'end_date': request.args.get('end_date'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 20, type=int),
            'sort_by': request.args.get('sort_by', 'created_at'),
            'sort_order': request.args.get('sort_order', 'desc'),
        }
        
        # Validate pagination
        if params['page'] < 1 or params['per_page'] < 1 or params['per_page'] > 100:
            return error_response('Invalid pagination parameters', status_code=400)
        
        # Build query
        query = InternshipApplication.query
        
        # Filter by status
        if params['status']:
            try:
                status_enum = ApplicationStatusEnum(params['status'])
                query = query.filter_by(status=status_enum)
            except ValueError:
                return error_response('Invalid status value', status_code=400)
        
        # Filter by track
        if params['track_id']:
            query = query.filter_by(track_id=params['track_id'])
        
        # Filter by cohort
        if params['cohort_id']:
            query = query.filter_by(cohort_id=params['cohort_id'])
        
        # Search by name or email
        if params['search']:
            search_term = f"%{params['search']}%"
            query = query.filter(or_(
                InternshipApplication.full_name.ilike(search_term),
                InternshipApplication.email.ilike(search_term),
                InternshipApplication.reference_code.ilike(search_term),
            ))

        # Filter by applicant type
        if params['applicant_type']:
            try:
                atype = ApplicantTypeEnum(params['applicant_type'])
                query = query.filter_by(applicant_type=atype)
            except ValueError:
                return error_response('Invalid applicant_type value', status_code=400)
        
        # Filter by date range
        if params['start_date']:
            try:
                start_dt = datetime.fromisoformat(params['start_date'])
                query = query.filter(InternshipApplication.created_at >= start_dt)
            except ValueError:
                return error_response('Invalid start_date format', status_code=400)
        
        if params['end_date']:
            try:
                end_dt = datetime.fromisoformat(params['end_date'])
                query = query.filter(InternshipApplication.created_at <= end_dt)
            except ValueError:
                return error_response('Invalid end_date format', status_code=400)
        
        # Sort
        sort_column = {
            'created_at': InternshipApplication.created_at,
            'updated_at': InternshipApplication.updated_at,
            'name': InternshipApplication.full_name,
            'status': InternshipApplication.status,
        }.get(params['sort_by'], InternshipApplication.created_at)
        
        if params['sort_order'].lower() == 'asc':
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())
        
        # Paginate
        result = paginate_query(query, params['page'], params['per_page'])
        result['data'] = [a.to_dict() for a in result['data']]
        
        return success_response('Applications retrieved', result)
    except Exception as e:
        logger.error(f"Error fetching admin applications: {str(e)}")
        return error_response('Failed to fetch applications', status_code=500)


@internships_bp.route('/admin/applications/<app_id>', methods=['GET'])
@role_required(['admin', 'staff'])
def get_admin_application_detail(app_id):
    """Get full application details with status logs"""
    try:
        application = InternshipApplication.query.get(app_id)
        
        if not application:
            return error_response('Application not found', status_code=404)
        
        return success_response('Application retrieved', application.to_dict(include_logs=True))
    except Exception as e:
        logger.error(f"Error fetching application detail: {str(e)}")
        return error_response('Failed to fetch application', status_code=500)


@internships_bp.route('/admin/applications/<app_id>/status', methods=['PATCH'])
@role_required(['admin', 'staff'])
def update_application_status(app_id):
    """
    Update application status with validation and logging.
    Body:
    - status: str (required)
    - note: str (optional)
    - interview_date: ISO datetime (optional)
    """
    try:
        user_id = int(get_jwt_identity())
        
        application = InternshipApplication.query.get(app_id)
        if not application:
            return error_response('Application not found', status_code=404)
        
        # Validate request body
        schema = ApplicationStatusUpdateSchema()
        try:
            data = schema.load(request.get_json() or {})
        except ValidationError as e:
            return error_response('Validation failed', e.messages, status_code=400)
        
        new_status = ApplicationStatusEnum(data['status'])
        old_status = application.status
        
        # Validate transition
        if not is_valid_status_transition(old_status, new_status):
            return error_response(
                f'Invalid status transition from {old_status.value} to {new_status.value}',
                status_code=400
            )
        
        # Update application
        application.status = new_status
        application.reviewer_id = user_id
        application.reviewed_at = datetime.utcnow()
        application.reviewer_notes = data.get('note')
        
        if data.get('interview_date'):
            application.interview_date = data['interview_date']
        
        # Save interview meeting link and platform
        if data.get('interview_meeting_link'):
            application.interview_meeting_link = data['interview_meeting_link']
        if data.get('interview_meeting_platform'):
            application.interview_meeting_platform = data['interview_meeting_platform']
        
        # Create status log
        status_log = ApplicationStatusLog(
            application_id=app_id,
            changed_by_id=user_id,
            old_status=old_status,
            new_status=new_status,
            note=data.get('note'),
        )
        
        db.session.add(status_log)
        db.session.commit()
        
        # Send email notifications
        user = User.query.get(user_id)
        changed_by_name = f"{user.first_name} {user.last_name}" if user else 'Admin'
        
        # Notify applicant about status change
        if new_status == ApplicationStatusEnum.INTERVIEW_SCHEDULED:
            mailer.send_interview_scheduled(application, data.get('note'))
        else:
            mailer.send_status_update(application, old_status, new_status, data.get('note'))
        
        # Notify admin when application is accepted (for onboarding prep)
        if new_status == ApplicationStatusEnum.ACCEPTED:
            try:
                mailer.send_admin_application_accepted_alert(application, changed_by_name=changed_by_name)
            except Exception as admin_mail_err:
                logger.warning(f"Failed to send admin accepted alert: {admin_mail_err}")
        
        # Notify admins when interview details (date/platform/link) are set or changed
        has_interview_details = any(k in data for k in ('interview_date', 'interview_meeting_link', 'interview_meeting_platform'))
        if has_interview_details:
            try:
                interview_date_obj = data.get('interview_date')
                if interview_date_obj:
                    try:
                        formatted_date = interview_date_obj.strftime('%d %B %Y at %I:%M %p')
                    except (ValueError, TypeError):
                        formatted_date = str(interview_date_obj)
                else:
                    formatted_date = None

                mailer.send_admin_interview_details_updated(
                    application,
                    updated_by_name=changed_by_name,
                    interview_date=formatted_date,
                    meeting_platform=data.get('interview_meeting_platform'),
                    meeting_link=data.get('interview_meeting_link'),
                )
            except Exception as int_mail_err:
                logger.warning(f"Failed to send admin interview details alert: {int_mail_err}")
        
        return success_response('Status updated successfully', application.to_dict())
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating status: {str(e)}")
        return error_response('Failed to update status', status_code=500)


@internships_bp.route('/admin/applications/<app_id>/assign-cohort', methods=['PATCH'])
@role_required(['admin', 'staff'])
def assign_cohort(app_id):
    """
    Assign cohort to accepted application.
    Body:
    - cohort_id: str (required)
    """
    try:
        application = InternshipApplication.query.get(app_id)
        if not application:
            return error_response('Application not found', status_code=404)
        
        # Only allow for accepted applications
        if application.status != ApplicationStatusEnum.ACCEPTED:
            return error_response('Can only assign cohort to accepted applications', status_code=400)
        
        # Validate request body
        schema = AssignCohortSchema()
        try:
            data = schema.load(request.get_json() or {})
        except ValidationError as e:
            return error_response('Validation failed', e.messages, status_code=400)
        
        # Validate cohort
        cohort = InternshipCohort.query.get(data['cohort_id'])
        if not cohort:
            return error_response('Cohort not found', status_code=404)
        
        if cohort.is_full():
            return error_response('Cohort is at capacity', status_code=400)
        
        # Assign cohort
        application.cohort_id = data['cohort_id']
        db.session.commit()
        
        # Send email notification about cohort assignment
        try:
            user = User.query.get(int(get_jwt_identity()))
            cohort_name = cohort.cohort_name or cohort.cohort_code
            mailer.send_cohort_assigned(
                application,
                cohort_name=cohort_name,
                assigned_by_name=f"{user.first_name} {user.last_name}" if user else 'Admin'
            )
        except Exception as mail_err:
            logger.warning(f"Failed to send cohort assignment email: {mail_err}")
        
        return success_response('Cohort assigned successfully', application.to_dict())
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error assigning cohort: {str(e)}")
        return error_response('Failed to assign cohort', status_code=500)


@internships_bp.route('/admin/applications/export', methods=['GET'])
@role_required(['admin', 'staff'])
def export_applications_csv():
    """Export applications data as CSV with current filters."""
    try:
        import csv
        import io

        status_filter = request.args.get('status')
        track_id = request.args.get('track_id')
        cohort_id = request.args.get('cohort_id')
        search = request.args.get('search')
        applicant_type = request.args.get('applicant_type')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        query = InternshipApplication.query.order_by(InternshipApplication.created_at.desc())

        if status_filter:
            try:
                query = query.filter_by(status=ApplicationStatusEnum(status_filter))
            except ValueError:
                pass
        if track_id:
            query = query.filter_by(track_id=track_id)
        if cohort_id:
            query = query.filter_by(cohort_id=cohort_id)
        if applicant_type:
            try:
                query = query.filter_by(applicant_type=ApplicantTypeEnum(applicant_type))
            except ValueError:
                pass
        if search:
            search_term = f"%{search}%"
            query = query.filter(or_(
                InternshipApplication.full_name.ilike(search_term),
                InternshipApplication.email.ilike(search_term),
                InternshipApplication.reference_code.ilike(search_term),
            ))
        if start_date:
            try:
                query = query.filter(InternshipApplication.created_at >= datetime.fromisoformat(start_date))
            except ValueError:
                pass
        if end_date:
            try:
                query = query.filter(InternshipApplication.created_at <= datetime.fromisoformat(end_date))
            except ValueError:
                pass

        applications = query.all()

        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([
            'Reference Code', 'Full Name', 'Email', 'Phone', 'Applicant Type',
            'Track', 'Cohort', 'Status', 'Motivation Letter',
            'Portfolio URL', 'GitHub URL', 'LinkedIn URL',
            'Reviewer', 'Reviewer Notes', 'Interview Date', 'Interview Notes',
            'Applied Date', 'Last Updated'
        ])

        for app in applications:
            writer.writerow([
                app.reference_code,
                app.full_name,
                app.email,
                app.phone,
                app.applicant_type.value if app.applicant_type else '',
                app.track.name if app.track else '',
                app.cohort.cohort_code if app.cohort else '',
                app.status.value if app.status else '',
                app.motivation_letter[:200] if app.motivation_letter else '',
                app.portfolio_url or '',
                app.github_url or '',
                app.linkedin_url or '',
                f"{app.reviewer.first_name} {app.reviewer.last_name}" if app.reviewer else '',
                app.reviewer_notes or '',
                app.interview_date.strftime('%Y-%m-%d %H:%M') if app.interview_date else '',
                app.interview_notes or '',
                app.created_at.strftime('%Y-%m-%d') if app.created_at else '',
                app.updated_at.strftime('%Y-%m-%d') if app.updated_at else '',
            ])

        output.seek(0)
        csv_content = output.getvalue()
        output.close()

        response = current_app.response_class(
            csv_content,
            mimetype='text/csv',
            headers={'Content-Disposition': 'attachment;filename=applications_export.csv'}
        )
        return response

    except Exception as e:
        logger.error(f"Error exporting applications: {str(e)}")
        return error_response('Failed to export applications', status_code=500)


@internships_bp.route('/admin/applications/<app_id>/interview-notes', methods=['PUT'])
@role_required(['admin', 'staff'])
def update_interview_notes(app_id):
    """Update interview notes for an application.
    Notifies other admins via email so they stay in the loop.
    """
    try:
        user_id = int(get_jwt_identity())
        application = InternshipApplication.query.get(app_id)
        if not application:
            return error_response('Application not found', status_code=404)

        data = request.get_json() or {}
        interview_notes = data.get('interview_notes')

        application.interview_notes = interview_notes
        db.session.commit()

        # Notify other admins that interview notes were updated
        try:
            user = User.query.get(user_id)
            updated_by_name = f"{user.first_name} {user.last_name}" if user else 'Admin'
            mailer.send_admin_interview_notes_updated(application, updated_by_name=updated_by_name)
        except Exception as mail_err:
            logger.warning(f"Failed to send admin interview notes alert: {mail_err}")

        return success_response('Interview notes updated', {'interview_notes': interview_notes})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating interview notes: {str(e)}")
        return error_response('Failed to update interview notes', status_code=500)


@internships_bp.route('/admin/applications/<app_id>/send-email', methods=['POST'])
@role_required(['admin', 'staff'])
def send_applicant_email(app_id):
    """Send an email to an applicant directly from the admin panel."""
    try:
        application = InternshipApplication.query.get(app_id)
        if not application:
            return error_response('Application not found', status_code=404)

        data = request.get_json() or {}
        subject = data.get('subject', 'Message from AfriTech Bridge')
        message = data.get('message', '')

        if not message:
            return error_response('Message body is required', status_code=400)

        # Use the existing mailer to send a custom email
        try:
            mailer.send_custom_email(application, subject, message)
        except Exception as mail_err:
            logger.error(f"Failed to send email to {application.email}: {mail_err}")
            return error_response('Failed to send email. Please try again.', status_code=500)

        return success_response('Email sent successfully', {
            'to': application.email,
            'subject': subject,
        })
    except Exception as e:
        logger.error(f"Error sending email: {str(e)}")
        return error_response('Failed to send email', status_code=500)


@internships_bp.route('/admin/applications/<app_id>/cv', methods=['GET'])
def download_cv(app_id):
    """
    Download CV file for application.
    
    Auth (supports both):
      - Authorization: Bearer <token> header (from axios)
      - ?token=<jwt> query param (for direct URLs / external viewers)
    
    Query params:
      - inline=1  — serve inline for iframe/embed preview (default: force download)
      - token     — JWT for query-param auth
    """
    try:
        # ---- Auth: support header OR query-param token ----
        auth_token = request.args.get('token')
        if auth_token:
            # Query-param authentication (for direct links / Google/MS Office viewers)
            try:
                from flask_jwt_extended import decode_token
                decoded = decode_token(auth_token)
                user_id = decoded['sub']
            except Exception:
                return jsonify({'message': 'Invalid or expired token'}), 401
            user = User.query.get(user_id)
            if not user or not user.role or user.role.name not in ['admin', 'staff']:
                return jsonify({'message': 'Access denied. Required roles: admin, staff'}), 403
        else:
            # Standard header-based auth (from axios interceptor)
            try:
                user_id = int(get_jwt_identity())
            except Exception:
                return jsonify({'message': 'Authentication required'}), 401
            user = User.query.get(user_id)
            if not user or not user.role or user.role.name not in ['admin', 'staff']:
                return jsonify({'message': 'Access denied. Required roles: admin, staff'}), 403
        
        # ---- Find application ----
        application = InternshipApplication.query.get(app_id)
        if not application:
            return error_response('Application not found', status_code=404)
        
        cv_path = application.cv_file_path
        if not cv_path:
            logger.error(f"CV file path is empty for application {app_id}")
            return error_response('CV file not found', status_code=404)

        # Resolve relative paths against the backend root directory
        # so the file is found regardless of the app's working directory.
        if not os.path.isabs(cv_path):
            backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            cv_path = os.path.join(backend_dir, cv_path)

        if not os.path.exists(cv_path):
            logger.error(f"CV file not found at {cv_path}")
            return error_response('CV file not found', status_code=404)
        
        # ---- Determine MIME type ----
        ext = application.cv_original_name.rsplit('.', 1)[-1].lower() if '.' in application.cv_original_name else ''
        mime_map = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }
        mime_type = mime_map.get(ext, 'application/octet-stream')
        
        # ?inline=1 serves the file inline (for iframe / external viewer) instead of forcing download
        inline = request.args.get('inline', '0') == '1'
        
        return send_file(
            cv_path,
            as_attachment=not inline,
            download_name=application.cv_original_name,
            mimetype=mime_type,
        )
    except Exception as e:
        logger.error(f"Error downloading CV: {str(e)}")
        return error_response('Failed to download CV', status_code=500)


@internships_bp.route('/admin/cohorts', methods=['GET'])
@role_required(['admin', 'staff'])
def get_admin_cohorts():
    """Get all cohorts (admin view)"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        track_id = request.args.get('track_id')
        
        if page < 1 or per_page < 1 or per_page > 100:
            return error_response('Invalid pagination parameters', status_code=400)
        
        query = InternshipCohort.query
        
        if track_id:
            query = query.filter_by(track_id=track_id)
        
        query = query.order_by(InternshipCohort.start_date.desc())
        
        result = paginate_query(query, page, per_page)
        result['data'] = [c.to_dict() for c in result['data']]
        
        return success_response('Cohorts retrieved', result)
    except Exception as e:
        logger.error(f"Error fetching cohorts: {str(e)}")
        return error_response('Failed to fetch cohorts', status_code=500)


@internships_bp.route('/admin/cohorts', methods=['POST'])
@role_required(['admin', 'staff'])
def create_cohort():
    """Create new internship cohort"""
    try:
        schema = InternshipCohortSchema()
        try:
            data = schema.load(request.get_json() or {})
        except ValidationError as e:
            return error_response('Validation failed', e.messages, status_code=400)
        
        # Validate track exists
        track = InternshipTrack.query.get(data['track_id'])
        if not track:
            return error_response('Track not found', status_code=404)
        
        cohort = InternshipCohort(
            track_id=data['track_id'],
            cohort_name=data['cohort_name'],
            cohort_code=data['cohort_code'],
            start_date=data['start_date'],
            end_date=data['end_date'],
            capacity=data.get('capacity'),
            description=data.get('description'),
        )
        
        db.session.add(cohort)
        db.session.commit()
        
        return success_response('Cohort created successfully', cohort.to_dict(), status_code=201)
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating cohort: {str(e)}")
        return error_response('Failed to create cohort', status_code=500)


@internships_bp.route('/admin/cohorts/<cohort_id>', methods=['PATCH'])
@role_required(['admin', 'staff'])
def update_cohort(cohort_id):
    """Update internship cohort"""
    try:
        cohort = InternshipCohort.query.get(cohort_id)
        if not cohort:
            return error_response('Cohort not found', status_code=404)
        
        data = request.get_json() or {}
        
        # Update allowed fields
        if 'cohort_name' in data:
            cohort.cohort_name = data['cohort_name']
        if 'capacity' in data:
            cohort.capacity = data['capacity']
        if 'is_accepting' in data:
            cohort.is_accepting = data['is_accepting']
        if 'description' in data:
            cohort.description = data['description']
        if 'end_date' in data:
            cohort.end_date = datetime.fromisoformat(data['end_date'])
        
        db.session.commit()
        
        return success_response('Cohort updated successfully', cohort.to_dict())
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating cohort: {str(e)}")
        return error_response('Failed to update cohort', status_code=500)


@internships_bp.route('/admin/cohorts/<cohort_id>', methods=['DELETE'])
@role_required(['admin', 'staff'])
def delete_cohort(cohort_id):
    """Delete internship cohort"""
    try:
        cohort = InternshipCohort.query.get(cohort_id)
        if not cohort:
            return error_response('Cohort not found', status_code=404)
        
        # Check if cohort has accepted applications
        accepted_count = cohort.applications.filter_by(status=ApplicationStatusEnum.ACCEPTED).count()
        if accepted_count > 0:
            return error_response('Cannot delete cohort with accepted applications', status_code=400)
        
        db.session.delete(cohort)
        db.session.commit()
        
        return success_response('Cohort deleted successfully')
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting cohort: {str(e)}")
        return error_response('Failed to delete cohort', status_code=500)


@internships_bp.route('/admin/tracks', methods=['GET'])
@role_required(['admin', 'staff'])
def get_admin_tracks():
    """Get all tracks (admin view - includes inactive)"""
    try:
        tracks = InternshipTrack.query.order_by(InternshipTrack.created_at.asc()).all()
        schema = InternshipTrackSchema()
        data = []
        for track in tracks:
            track_data = schema.dump(track)
            open_cohorts = get_accepting_cohorts(track.id)
            track_data['open_cohorts_count'] = len(open_cohorts)
            data.append(track_data)
        return success_response('Tracks retrieved', data)
    except Exception as e:
        logger.error(f"Error fetching admin tracks: {str(e)}")
        return error_response('Failed to fetch tracks', status_code=500)


@internships_bp.route('/admin/tracks', methods=['POST'])
@role_required(['admin', 'staff'])
def create_track():
    """Create new internship track"""
    try:
        schema = InternshipTrackSchema()
        try:
            data = schema.load(request.get_json() or {})
        except ValidationError as e:
            return error_response('Validation failed', e.messages, status_code=400)
        
        # Check for duplicate slug
        existing = InternshipTrack.query.filter_by(slug=data['slug']).first()
        if existing:
            return error_response('A track with this slug already exists', status_code=409)
        
        track = InternshipTrack(
            name=data['name'],
            slug=data['slug'],
            description=data.get('description'),
            icon_key=data.get('icon_key'),
        )
        
        db.session.add(track)
        db.session.commit()
        
        logger.info(f"Track created: {track.name} (slug={track.slug})")
        return success_response('Track created successfully', track.to_dict(), status_code=201)
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating track: {str(e)}")
        return error_response('Failed to create track', status_code=500)


@internships_bp.route('/admin/tracks/<track_id>', methods=['PATCH'])
@role_required(['admin', 'staff'])
def update_track(track_id):
    """Update internship track"""
    try:
        track = InternshipTrack.query.get(track_id)
        if not track:
            return error_response('Track not found', status_code=404)
        
        data = request.get_json() or {}
        
        # Update allowed fields
        if 'name' in data:
            track.name = data['name']
        if 'description' in data:
            track.description = data.get('description')
        if 'icon_key' in data:
            track.icon_key = data.get('icon_key')
        if 'is_active' in data:
            track.is_active = data['is_active']
        if 'slug' in data:
            # Check for duplicate slug
            existing = InternshipTrack.query.filter_by(slug=data['slug']).filter(InternshipTrack.id != track_id).first()
            if existing:
                return error_response('A track with this slug already exists', status_code=409)
            track.slug = data['slug']
        
        db.session.commit()
        
        logger.info(f"Track updated: {track.name} (active={track.is_active})")
        return success_response('Track updated successfully', track.to_dict())
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating track: {str(e)}")
        return error_response('Failed to update track', status_code=500)


@internships_bp.route('/admin/tracks/<track_id>', methods=['DELETE'])
@role_required(['admin', 'staff'])
def delete_track(track_id):
    """Delete internship track"""
    try:
        track = InternshipTrack.query.get(track_id)
        if not track:
            return error_response('Track not found', status_code=404)
        
        # Check if track has accepted applications
        accepted_count = InternshipApplication.query.filter_by(
            track_id=track_id,
            status=ApplicationStatusEnum.ACCEPTED
        ).count()
        if accepted_count > 0:
            return error_response('Cannot delete track with accepted applications. Deactivate it instead.', status_code=400)
        
        db.session.delete(track)
        db.session.commit()
        
        logger.info(f"Track deleted: {track.name}")
        return success_response('Track deleted successfully')
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting track: {str(e)}")
        return error_response('Failed to delete track', status_code=500)


@internships_bp.route('/admin/applications/batch/status', methods=['POST'])
@role_required(['admin', 'staff'])
def batch_update_status():
    """
    Batch update status for multiple applications.
    Body:
    - application_ids: list of strings (required)
    - status: str (required)
    - note: str (optional)
    """
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}

        application_ids = data.get('application_ids', [])
        new_status_str = data.get('status')
        note = data.get('note')

        if not application_ids or not isinstance(application_ids, list):
            return error_response('application_ids must be a non-empty list', status_code=400)

        if len(application_ids) > 100:
            return error_response('Maximum 100 applications per batch', status_code=400)

        if not new_status_str:
            return error_response('status is required', status_code=400)

        try:
            new_status = ApplicationStatusEnum(new_status_str)
        except ValueError:
            return error_response(f'Invalid status: {new_status_str}', status_code=400)

        results = {'updated': [], 'skipped': [], 'errors': []}

        for app_id in application_ids:
            try:
                application = InternshipApplication.query.get(app_id)
                if not application:
                    results['errors'].append({'id': app_id, 'reason': 'Application not found'})
                    continue

                old_status = application.status

                # Validate transition
                if not is_valid_status_transition(old_status, new_status):
                    results['skipped'].append({
                        'id': app_id,
                        'name': application.full_name,
                        'reason': f'Cannot transition from {old_status.value} to {new_status.value}'
                    })
                    continue

                # Update application
                application.status = new_status
                application.reviewer_id = user_id
                application.reviewed_at = datetime.utcnow()
                application.reviewer_notes = note

                # Create status log
                status_log = ApplicationStatusLog(
                    application_id=app_id,
                    changed_by_id=user_id,
                    old_status=old_status,
                    new_status=new_status,
                    note=note,
                )
                db.session.add(status_log)
                db.session.flush()

                results['updated'].append({
                    'id': app_id,
                    'name': application.full_name,
                    'old_status': old_status.value,
                    'new_status': new_status.value,
                })

                # Send email notification (use enhanced interview template if applicable)
                try:
                    if new_status == ApplicationStatusEnum.INTERVIEW_SCHEDULED:
                        mailer.send_interview_scheduled(application, note)
                    else:
                        mailer.send_status_update(application, old_status, new_status, note)
                except Exception as mail_err:
                    logger.warning(f"Failed to send status email for {app_id}: {mail_err}")

                # Notify admin when application is accepted (for onboarding prep)
                if new_status == ApplicationStatusEnum.ACCEPTED:
                    try:
                        admin_user = User.query.get(user_id)
                        changed_by_name = f"{admin_user.first_name} {admin_user.last_name}" if admin_user else 'Admin'
                        mailer.send_admin_application_accepted_alert(application, changed_by_name=changed_by_name)
                    except Exception as admin_mail_err:
                        logger.warning(f"Failed to send admin accepted alert for {app_id}: {admin_mail_err}")

            except Exception as e:
                results['errors'].append({'id': app_id, 'reason': str(e)})
                logger.error(f"Error processing batch update for {app_id}: {str(e)}")

        db.session.commit()

        logger.info(f"Batch status update: {len(results['updated'])} updated, {len(results['skipped'])} skipped, {len(results['errors'])} errors")

        return success_response('Batch status update completed', results)
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in batch status update: {str(e)}")
        return error_response('Failed to process batch update', status_code=500)


@internships_bp.route('/admin/applications/batch/assign-cohort', methods=['POST'])
@role_required(['admin', 'staff'])
def batch_assign_cohort():
    """
    Batch assign cohort for multiple accepted applications.
    Body:
    - application_ids: list of strings (required)
    - cohort_id: str (required)
    """
    try:
        data = request.get_json() or {}

        application_ids = data.get('application_ids', [])
        cohort_id = data.get('cohort_id')

        if not application_ids or not isinstance(application_ids, list):
            return error_response('application_ids must be a non-empty list', status_code=400)

        if len(application_ids) > 100:
            return error_response('Maximum 100 applications per batch', status_code=400)

        if not cohort_id:
            return error_response('cohort_id is required', status_code=400)

        # Validate cohort
        cohort = InternshipCohort.query.get(cohort_id)
        if not cohort:
            return error_response('Cohort not found', status_code=404)

        if cohort.is_full():
            return error_response('Cohort is at capacity', status_code=400)

        results = {'updated': [], 'skipped': [], 'errors': []}
        spots_remaining = cohort.capacity - cohort.get_accepted_count() if cohort.capacity else None
        assigned_applications = []

        for app_id in application_ids:
            try:
                application = InternshipApplication.query.get(app_id)
                if not application:
                    results['errors'].append({'id': app_id, 'reason': 'Application not found'})
                    continue

                if application.status != ApplicationStatusEnum.ACCEPTED:
                    results['skipped'].append({
                        'id': app_id,
                        'name': application.full_name,
                        'reason': 'Application is not in accepted status'
                    })
                    continue

                # Check capacity
                if spots_remaining is not None and spots_remaining <= 0:
                    results['skipped'].append({
                        'id': app_id,
                        'name': application.full_name,
                        'reason': 'Cohort has reached capacity'
                    })
                    continue

                application.cohort_id = cohort_id
                if spots_remaining is not None:
                    spots_remaining -= 1

                results['updated'].append({
                    'id': app_id,
                    'name': application.full_name,
                    'cohort_code': cohort.cohort_code,
                })
                assigned_applications.append(application)

            except Exception as e:
                results['errors'].append({'id': app_id, 'reason': str(e)})
                logger.error(f"Error processing batch assign for {app_id}: {str(e)}")

        db.session.commit()

        # Send cohort assignment emails to all assigned applicants
        if assigned_applications:
            try:
                current_user_id = int(get_jwt_identity())
                admin_user = User.query.get(current_user_id)
                assigned_by_name = f"{admin_user.first_name} {admin_user.last_name}" if admin_user else 'Admin'
                cohort_name = cohort.cohort_name or cohort.cohort_code
                for app in assigned_applications:
                    try:
                        mailer.send_cohort_assigned(
                            app,
                            cohort_name=cohort_name,
                            assigned_by_name=assigned_by_name
                        )
                    except Exception as mail_err:
                        logger.warning(f"Failed to send cohort assignment email for {app.id}: {mail_err}")
            except Exception as mail_err:
                logger.warning(f"Failed to send batch cohort assignment emails: {mail_err}")

        logger.info(f"Batch cohort assign: {len(results['updated'])} assigned, {len(results['skipped'])} skipped, {len(results['errors'])} errors")

        return success_response('Batch cohort assignment completed', results)
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in batch cohort assign: {str(e)}")
        return error_response('Failed to process batch assignment', status_code=500)


@internships_bp.route('/admin/applications/batch/offer', methods=['POST'])
@role_required(['admin', 'staff'])
def batch_generate_offers():
    """
    Batch generate offer letters for multiple accepted applications.
    Body:
    - application_ids: list of strings (required)
    """
    try:
        admin_user_id = int(get_jwt_identity())
        admin_user = User.query.get(admin_user_id)
        if not admin_user:
            return error_response('Admin user not found', status_code=401)

        data = request.get_json() or {}
        application_ids = data.get('application_ids', [])

        if not application_ids or not isinstance(application_ids, list):
            return error_response('application_ids must be a non-empty list', status_code=400)

        if len(application_ids) > 100:
            return error_response('Maximum 100 applications per batch', status_code=400)

        offer_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            'uploads',
            'offer_letters'
        )

        results = {'sent': [], 'skipped': [], 'errors': []}

        for app_id in application_ids:
            try:
                application = InternshipApplication.query.get(app_id)
                if not application:
                    results['errors'].append({'id': app_id, 'reason': 'Application not found'})
                    continue

                if application.status != ApplicationStatusEnum.ACCEPTED:
                    results['skipped'].append({
                        'id': app_id,
                        'name': application.full_name,
                        'reason': 'Application not in accepted status'
                    })
                    continue

                # Check if offer already exists
                existing_offer = InternshipOfferLetter.query.filter_by(application_id=app_id).first()
                if existing_offer:
                    results['skipped'].append({
                        'id': app_id,
                        'name': application.full_name,
                        'reason': 'Offer already sent'
                    })
                    continue

                # Generate offer
                success, message, offer, password = InternshipOfferService.create_offer(
                    application, admin_user, offer_dir
                )

                if not success:
                    results['errors'].append({'id': app_id, 'name': application.full_name, 'reason': message})
                    continue

                # Send email
                try:
                    is_existing_user = password is None
                    mailer.send_offer_letter(application, offer, password=password, is_existing_user=is_existing_user)
                except Exception as mail_err:
                    logger.warning(f"Failed to send offer email for {app_id}: {mail_err}")

                results['sent'].append({
                    'id': app_id,
                    'name': application.full_name,
                    'offer_number': offer.offer_number,
                    'username': offer.generated_username,
                })

            except Exception as e:
                results['errors'].append({'id': app_id, 'reason': str(e)})
                logger.error(f"Error processing batch offer for {app_id}: {str(e)}")

        db.session.commit()

        logger.info(f"Batch offer generation: {len(results['sent'])} sent, {len(results['skipped'])} skipped, {len(results['errors'])} errors")

        return success_response('Batch offer generation completed', results)
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in batch offer generation: {str(e)}")
        return error_response('Failed to process batch offers', status_code=500)


@internships_bp.route('/admin/stats', methods=['GET'])
@role_required(['admin', 'staff'])
def get_admin_stats():
    """Get internship statistics"""
    try:
        # Total applications by status
        status_stats = {}
        for status in ApplicationStatusEnum:
            count = InternshipApplication.query.filter_by(status=status).count()
            status_stats[status.value] = count
        
        # Total applications by track
        track_stats = {}
        for track in InternshipTrack.query.all():
            count = InternshipApplication.query.filter_by(track_id=track.id).count()
            track_stats[track.name] = count
        
        # Conversion rates
        total_apps = InternshipApplication.query.count()
        shortlisted = InternshipApplication.query.filter_by(status=ApplicationStatusEnum.SHORTLISTED).count()
        accepted = InternshipApplication.query.filter_by(status=ApplicationStatusEnum.ACCEPTED).count()
        rejected = InternshipApplication.query.filter_by(status=ApplicationStatusEnum.REJECTED).count()
        
        conversion_rates = {
            'shortlist_rate': (shortlisted / total_apps * 100) if total_apps > 0 else 0,
            'acceptance_rate': (accepted / total_apps * 100) if total_apps > 0 else 0,
            'rejection_rate': (rejected / total_apps * 100) if total_apps > 0 else 0,
        }
        
        stats = {
            'total_applications': total_apps,
            'by_status': status_stats,
            'by_track': track_stats,
            'conversion_rates': conversion_rates,
            'cohort_count': InternshipCohort.query.count(),
            'track_count': InternshipTrack.query.filter_by(is_active=True).count(),
        }
        
        return success_response('Statistics retrieved', stats)
    except Exception as e:
        logger.error(f"Error fetching stats: {str(e)}")
        return error_response('Failed to fetch statistics', status_code=500)


# ============= ADMIN INTERN MANAGEMENT =============

@internships_bp.route('/admin/interns', methods=['GET'])
@role_required(['admin', 'staff'])
def get_admin_interns():
    """
    Get all accepted interns across all cohorts with task progress.
    Admin-only view with richer filtering than instructor view.
    Query params:
    - cohort_id: str (optional)
    - track_id: str (optional)
    - search: str (optional)
    - status: str (optional) - filter by offer letter status (sent, accepted, declined, revoked)
    - page: int (default: 1)
    - per_page: int (default: 50)
    - sort_by: str (default: full_name)
    - sort_order: str (default: asc)
    """
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        cohort_id = request.args.get('cohort_id')
        track_id = request.args.get('track_id')
        search = request.args.get('search')
        offer_status = request.args.get('offer_status')
        sort_by = request.args.get('sort_by', 'full_name')
        sort_order = request.args.get('sort_order', 'asc').lower()

        if page < 1 or per_page < 1 or per_page > 100:
            return error_response('Invalid pagination parameters', status_code=400)

        # Base query: only accepted applications
        query = InternshipApplication.query.filter_by(
            status=ApplicationStatusEnum.ACCEPTED
        )

        if cohort_id:
            query = query.filter_by(cohort_id=cohort_id)

        if track_id:
            query = query.filter_by(track_id=track_id)

        if search:
            search_term = f"%{search}%"
            query = query.filter(db.or_(
                InternshipApplication.full_name.ilike(search_term),
                InternshipApplication.email.ilike(search_term),
                InternshipApplication.reference_code.ilike(search_term),
            ))

        if offer_status:
            # Filter by offer letter status via join
            query = query.join(
                InternshipOfferLetter,
                InternshipApplication.id == InternshipOfferLetter.application_id,
                isouter=True
            ).filter(InternshipOfferLetter.status == offer_status)

        # Sorting
        sort_col = {
            'full_name': InternshipApplication.full_name,
            'email': InternshipApplication.email,
            'created_at': InternshipApplication.created_at,
            'updated_at': InternshipApplication.updated_at,
            'reference_code': InternshipApplication.reference_code,
        }.get(sort_by, InternshipApplication.full_name)

        query = query.order_by(sort_col.asc() if sort_order == 'asc' else sort_col.desc())

        # Paginate
        result = paginate_query(query, page, per_page)

        # Enrich with task stats and offer info
        interns_data = []
        for intern in result['data']:
            intern_dict = intern.to_dict(include_logs=False)

            # Task progress stats
            total_assigned = InternshipTaskAssignment.query.filter_by(intern_id=intern.id).count()
            completed = InternshipTaskAssignment.query.filter_by(intern_id=intern.id, status='approved').count()
            submitted = InternshipTaskAssignment.query.filter_by(intern_id=intern.id, status='submitted').count()
            in_progress = InternshipTaskAssignment.query.filter_by(intern_id=intern.id, status='in_progress').count()
            pending = InternshipTaskAssignment.query.filter_by(intern_id=intern.id, status='pending').count()
            avg_score_query = db.session.query(db.func.avg(InternshipTaskAssignment.score)).filter(
                InternshipTaskAssignment.intern_id == intern.id,
                InternshipTaskAssignment.score.isnot(None)
            ).scalar()

            intern_dict['task_stats'] = {
                'total_assigned': total_assigned,
                'completed': completed,
                'submitted': submitted,
                'in_progress': in_progress,
                'pending': pending,
                'progress_pct': round((completed / total_assigned * 100)) if total_assigned > 0 else 0,
                'avg_score': round(float(avg_score_query), 1) if avg_score_query else None,
            }

            # Offer letter info
            offer = InternshipOfferLetter.query.filter_by(application_id=intern.id).first()
            intern_dict['offer'] = {
                'id': offer.id,
                'offer_number': offer.offer_number,
                'status': offer.status,
                'sent_at': offer.sent_at.isoformat() if offer.sent_at else None,
                'social_shares': offer.social_shares,
            } if offer else None

            interns_data.append(intern_dict)

        result['data'] = interns_data

        # Compute summary stats
        total_accepted = InternshipApplication.query.filter_by(
            status=ApplicationStatusEnum.ACCEPTED
        ).count()
        with_cohort = InternshipApplication.query.filter_by(
            status=ApplicationStatusEnum.ACCEPTED
        ).filter(InternshipApplication.cohort_id.isnot(None)).count()

        result['summary'] = {
            'total_accepted': total_accepted,
            'with_cohort': with_cohort,
            'unassigned': total_accepted - with_cohort,
            'with_offers': InternshipOfferLetter.query.count(),
            'offers_accepted': InternshipOfferLetter.query.filter_by(status='accepted').count(),
        }

        return success_response('Interns retrieved', result)
    except Exception as e:
        logger.error(f"Error fetching admin interns: {str(e)}")
        return error_response('Failed to fetch interns', status_code=500)


@internships_bp.route('/admin/interns/export', methods=['GET'])
@role_required(['admin', 'staff'])
def export_admin_interns_csv():
    """Export interns data as CSV for reporting."""
    try:
        import csv
        import io

        cohort_id = request.args.get('cohort_id')
        track_id = request.args.get('track_id')

        query = InternshipApplication.query.filter_by(
            status=ApplicationStatusEnum.ACCEPTED
        ).order_by(InternshipApplication.full_name.asc())

        if cohort_id:
            query = query.filter_by(cohort_id=cohort_id)
        if track_id:
            query = query.filter_by(track_id=track_id)

        interns = query.all()

        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([
            'Reference Code', 'Full Name', 'Email', 'Phone',
            'Track', 'Cohort', 'Status', 'Offer Number', 'Offer Status',
            'Total Tasks', 'Completed', 'Progress %', 'Avg Score',
            'Applied Date', 'Last Updated'
        ])

        for intern in interns:
            offer = InternshipOfferLetter.query.filter_by(application_id=intern.id).first()

            total_assigned = InternshipTaskAssignment.query.filter_by(intern_id=intern.id).count()
            completed = InternshipTaskAssignment.query.filter_by(intern_id=intern.id, status='approved').count()
            avg_score_query = db.session.query(db.func.avg(InternshipTaskAssignment.score)).filter(
                InternshipTaskAssignment.intern_id == intern.id,
                InternshipTaskAssignment.score.isnot(None)
            ).scalar()

            writer.writerow([
                intern.reference_code,
                intern.full_name,
                intern.email,
                intern.phone,
                intern.track.name if intern.track else '',
                intern.cohort.cohort_code if intern.cohort else '',
                intern.status.value if intern.status else '',
                offer.offer_number if offer else '',
                offer.status if offer else '',
                total_assigned,
                completed,
                round((completed / total_assigned * 100)) if total_assigned > 0 else 0,
                round(float(avg_score_query), 1) if avg_score_query else '',
                intern.created_at.strftime('%Y-%m-%d') if intern.created_at else '',
                intern.updated_at.strftime('%Y-%m-%d') if intern.updated_at else '',
            ])

        output.seek(0)
        csv_content = output.getvalue()
        output.close()

        response = current_app.response_class(
            csv_content,
            mimetype='text/csv',
            headers={'Content-Disposition': 'attachment;filename=interns_export.csv'}
        )
        return response

    except Exception as e:
        logger.error(f"Error exporting interns: {str(e)}")
        return error_response('Failed to export interns', status_code=500)


# ============= INSTRUCTOR ROUTES (Task Management & Progress Tracking) =============

@internships_bp.route('/instructor/cohorts', methods=['GET'])
@role_required(['admin', 'staff', 'instructor'])
def get_instructor_cohorts():
    """Get all cohorts with intern counts (instructor view)"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        track_id = request.args.get('track_id')
        
        query = InternshipCohort.query
        if track_id:
            query = query.filter_by(track_id=track_id)
        
        query = query.order_by(InternshipCohort.start_date.desc())
        result = paginate_query(query, page, per_page)
        
        cohorts_data = []
        for c in result['data']:
            cd = c.to_dict()
            # Count accepted interns in this cohort
            intern_count = InternshipApplication.query.filter_by(
                cohort_id=c.id,
                status=ApplicationStatusEnum.ACCEPTED
            ).count()
            # Count tasks for this cohort
            task_count = InternshipTask.query.filter_by(cohort_id=c.id, is_active=True).count()
            cd['intern_count'] = intern_count
            cd['task_count'] = task_count
            cohorts_data.append(cd)
        
        result['data'] = cohorts_data
        return success_response('Instructor cohorts retrieved', result)
    except Exception as e:
        logger.error(f"Error fetching instructor cohorts: {str(e)}")
        return error_response('Failed to fetch cohorts', status_code=500)


@internships_bp.route('/instructor/cohorts/<cohort_id>/interns', methods=['GET'])
@role_required(['admin', 'staff', 'instructor'])
def get_cohort_interns(cohort_id):
    """Get accepted interns in a cohort with task progress"""
    try:
        cohort = InternshipCohort.query.get(cohort_id)
        if not cohort:
            return error_response('Cohort not found', status_code=404)
        
        interns = InternshipApplication.query.filter_by(
            cohort_id=cohort_id,
            status=ApplicationStatusEnum.ACCEPTED
        ).all()
        
        interns_data = []
        for intern in interns:
            intern_dict = intern.to_dict()
            # Get task progress for this intern
            total_assigned = InternshipTaskAssignment.query.filter_by(intern_id=intern.id).count()
            completed = InternshipTaskAssignment.query.filter_by(intern_id=intern.id, status='approved').count()
            submitted = InternshipTaskAssignment.query.filter_by(intern_id=intern.id, status='submitted').count()
            pending = InternshipTaskAssignment.query.filter_by(intern_id=intern.id, status='pending').count()
            
            intern_dict['task_stats'] = {
                'total_assigned': total_assigned,
                'completed': completed,
                'submitted': submitted,
                'pending': pending,
                'progress_pct': round((completed / total_assigned * 100)) if total_assigned > 0 else 0,
            }
            interns_data.append(intern_dict)
        
        return success_response('Cohort interns retrieved', interns_data)
    except Exception as e:
        logger.error(f"Error fetching cohort interns: {str(e)}")
        return error_response('Failed to fetch interns', status_code=500)


@internships_bp.route('/instructor/tasks', methods=['GET'])
@role_required(['admin', 'staff', 'instructor'])
def get_instructor_tasks():
    """Get tasks with optional filters"""
    try:
        cohort_id = request.args.get('cohort_id')
        task_type = request.args.get('task_type')
        priority = request.args.get('priority')
        status_filter = request.args.get('status')  # active/completed/cancelled
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        
        query = InternshipTask.query
        
        if cohort_id:
            query = query.filter_by(cohort_id=cohort_id)
        if task_type:
            query = query.filter_by(task_type=task_type)
        if priority:
            query = query.filter_by(priority=priority)
        if status_filter == 'active':
            query = query.filter_by(is_active=True)
        elif status_filter == 'completed':
            query = query.filter(InternshipTask.due_date < datetime.utcnow())
        
        query = query.order_by(InternshipTask.created_at.desc())
        result = paginate_query(query, page, per_page)
        result['data'] = [t.to_dict() for t in result['data']]
        
        return success_response('Tasks retrieved', result)
    except Exception as e:
        logger.error(f"Error fetching tasks: {str(e)}")
        return error_response('Failed to fetch tasks', status_code=500)


@internships_bp.route('/instructor/tasks/<task_id>', methods=['GET'])
@role_required(['admin', 'staff', 'instructor'])
def get_task_detail(task_id):
    """Get task detail with all intern assignments"""
    try:
        task = InternshipTask.query.get(task_id)
        if not task:
            return error_response('Task not found', status_code=404)
        
        task_data = task.to_dict()
        # Include all assignments with intern info
        assignments = task.assignments.order_by(InternshipTaskAssignment.created_at.desc()).all()
        task_data['assignments'] = [a.to_dict() for a in assignments]
        
        return success_response('Task detail retrieved', task_data)
    except Exception as e:
        logger.error(f"Error fetching task detail: {str(e)}")
        return error_response('Failed to fetch task', status_code=500)


@internships_bp.route('/instructor/tasks', methods=['POST'])
@role_required(['admin', 'staff', 'instructor'])
def create_task():
    """Create a new task and optionally assign to interns"""
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        
        if not data.get('title'):
            return error_response('Task title is required', status_code=400)
        
        task = InternshipTask(
            cohort_id=data.get('cohort_id'),
            assigned_by_id=user_id,
            title=data['title'],
            description=data.get('description'),
            task_type=data.get('task_type', 'other'),
            priority=data.get('priority', 'medium'),
            due_date=datetime.fromisoformat(data['due_date']) if data.get('due_date') else None,
            max_score=data.get('max_score', 100),
        )
        db.session.add(task)
        db.session.flush()
        
        # Assign to specific interns if provided
        intern_ids = data.get('intern_ids', [])
        assign_to_all = data.get('assign_to_all', False)
        
        if assign_to_all and task.cohort_id:
            # Assign to all accepted interns in the cohort
            interns = InternshipApplication.query.filter_by(
                cohort_id=task.cohort_id,
                status=ApplicationStatusEnum.ACCEPTED
            ).all()
            intern_ids = [i.id for i in interns]
        
        # Track assigned interns for email notifications
        assigned_interns = []
        
        for intern_id in intern_ids:
            assignment = InternshipTaskAssignment(
                task_id=task.id,
                intern_id=intern_id,
                status='pending',
            )
            db.session.add(assignment)
            # Fetch intern info for email
            intern = InternshipApplication.query.get(intern_id)
            if intern:
                assigned_interns.append(intern)
        
        db.session.commit()
        logger.info(f"Task created: {task.title} ({task.id}) with {len(intern_ids)} assignments")
        
        # Send email notifications to assigned interns
        try:
            user = User.query.get(user_id)
            assigned_by_name = f"{user.first_name} {user.last_name}" if user else 'Instructor'
            for intern in assigned_interns:
                mailer.send_task_assigned(
                    intern,
                    task_title=task.title,
                    task_description=task.description,
                    due_date=task.due_date,
                    priority=task.priority.value if task.priority else 'medium',
                    assigned_by_name=assigned_by_name,
                    cohort_name=task.cohort.cohort_name if task.cohort else None,
                )
        except Exception as mail_err:
            logger.warning(f"Failed to send task assignment emails: {mail_err}")
        
        return success_response('Task created successfully', task.to_dict(), status_code=201)
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating task: {str(e)}")
        return error_response('Failed to create task', status_code=500)


@internships_bp.route('/instructor/tasks/<task_id>', methods=['PATCH'])
@role_required(['admin', 'staff', 'instructor'])
def update_task(task_id):
    """Update task details"""
    try:
        from src.models.internship_models import InternshipTask
        task = InternshipTask.query.get(task_id)
        if not task:
            return error_response('Task not found', status_code=404)
        
        data = request.get_json() or {}
        
        if 'title' in data:
            task.title = data['title']
        if 'description' in data:
            task.description = data.get('description')
        if 'task_type' in data:
            task.task_type = data['task_type']
        if 'priority' in data:
            task.priority = data['priority']
        if 'due_date' in data:
            task.due_date = datetime.fromisoformat(data['due_date']) if data.get('due_date') else None
        if 'max_score' in data:
            task.max_score = data['max_score']
        if 'is_active' in data:
            task.is_active = data['is_active']
        
        db.session.commit()
        return success_response('Task updated successfully', task.to_dict())
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating task: {str(e)}")
        return error_response('Failed to update task', status_code=500)


@internships_bp.route('/instructor/tasks/<task_id>', methods=['DELETE'])
@role_required(['admin', 'staff', 'instructor'])
def delete_task(task_id):
    """Delete a task"""
    try:
        from src.models.internship_models import InternshipTask
        task = InternshipTask.query.get(task_id)
        if not task:
            return error_response('Task not found', status_code=404)
        
        db.session.delete(task)
        db.session.commit()
        return success_response('Task deleted successfully')
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting task: {str(e)}")
        return error_response('Failed to delete task', status_code=500)


@internships_bp.route('/instructor/tasks/<task_id>/assign', methods=['POST'])
@role_required(['admin', 'staff', 'instructor'])
def assign_task_to_interns(task_id):
    """Assign existing task to additional interns"""
    try:
        task = InternshipTask.query.get(task_id)
        if not task:
            return error_response('Task not found', status_code=404)
        
        data = request.get_json() or {}
        intern_ids = data.get('intern_ids', [])
        assign_to_all = data.get('assign_to_all', False)
        
        if assign_to_all and task.cohort_id:
            interns = InternshipApplication.query.filter_by(
                cohort_id=task.cohort_id,
                status=ApplicationStatusEnum.ACCEPTED
            ).all()
            intern_ids = [i.id for i in interns]
        
        count = 0
        assigned_interns = []
        for intern_id in intern_ids:
            # Check if already assigned
            existing = InternshipTaskAssignment.query.filter_by(
                task_id=task_id, intern_id=intern_id
            ).first()
            if not existing:
                assignment = InternshipTaskAssignment(
                    task_id=task_id,
                    intern_id=intern_id,
                    status='pending',
                )
                db.session.add(assignment)
                count += 1
                intern = InternshipApplication.query.get(intern_id)
                if intern:
                    assigned_interns.append(intern)
        
        db.session.commit()
        
        # Send email notifications to newly assigned interns
        if count > 0:
            try:
                task = InternshipTask.query.get(task_id)
                user = User.query.get(int(get_jwt_identity()))
                assigned_by_name = f"{user.first_name} {user.last_name}" if user else 'Instructor'
                for intern in assigned_interns:
                    mailer.send_task_assigned(
                        intern,
                        task_title=task.title if task else 'New Task',
                        task_description=task.description if task else None,
                        due_date=task.due_date if task else None,
                        priority=task.priority.value if task and task.priority else 'medium',
                        assigned_by_name=assigned_by_name,
                        cohort_name=task.cohort.cohort_name if task and task.cohort else None,
                    )
            except Exception as mail_err:
                logger.warning(f"Failed to send task assignment emails: {mail_err}")
        
        return success_response(f'Task assigned to {count} new intern(s)', {'assigned_count': count})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error assigning task: {str(e)}")
        return error_response('Failed to assign task', status_code=500)


@internships_bp.route('/instructor/assignments/<assignment_id>/grade', methods=['PATCH'])
@role_required(['admin', 'staff', 'instructor'])
def grade_assignment(assignment_id):
    """Grade an intern's task submission"""
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        
        assignment = InternshipTaskAssignment.query.get(assignment_id)
        if not assignment:
            return error_response('Assignment not found', status_code=404)
        
        if 'status' in data:
            assignment.status = data['status']
        if 'score' in data:
            assignment.score = data['score']
        if 'feedback' in data:
            assignment.feedback = data['feedback']
        
        if data.get('status') in ('approved', 'rejected'):
            assignment.graded_by_id = user_id
            assignment.graded_at = datetime.utcnow()
        
        db.session.commit()
        
        # Send email notification to intern about grading
        if data.get('status') in ('approved', 'rejected'):
            try:
                intern = InternshipApplication.query.get(assignment.intern_id)
                user = User.query.get(user_id)
                graded_by_name = f"{user.first_name} {user.last_name}" if user else 'Instructor'
                if intern:
                    mailer.send_task_graded(
                        intern,
                        task_title=assignment.task.title if assignment.task else 'Task',
                        status=assignment.status.value if hasattr(assignment.status, 'value') else assignment.status,
                        score=assignment.score,
                        feedback=assignment.feedback,
                        graded_by_name=graded_by_name,
                    )
            except Exception as mail_err:
                logger.warning(f"Failed to send task grading email: {mail_err}")
        
        return success_response('Assignment graded successfully', assignment.to_dict())
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error grading assignment: {str(e)}")
        return error_response('Failed to grade assignment', status_code=500)


@internships_bp.route('/instructor/interns/<intern_id>/tasks', methods=['GET'])
@role_required(['admin', 'staff', 'instructor'])
def get_intern_tasks(intern_id):
    """Get all tasks assigned to a specific intern"""
    try:
        assignments = InternshipTaskAssignment.query.filter_by(intern_id=intern_id).order_by(
            InternshipTaskAssignment.created_at.desc()
        ).all()
        
        return success_response('Intern tasks retrieved', [a.to_dict() for a in assignments])
    except Exception as e:
        logger.error(f"Error fetching intern tasks: {str(e)}")
        return error_response('Failed to fetch intern tasks', status_code=500)


@internships_bp.route('/instructor/stats', methods=['GET'])
@role_required(['admin', 'staff', 'instructor'])
def get_instructor_stats():
    """Get instructor-level internship dashboard statistics"""
    try:
        # Active interns count (accepted applications with cohort)
        total_interns = InternshipApplication.query.filter_by(
            status=ApplicationStatusEnum.ACCEPTED
        ).count()
        
        # Interns without cohort yet
        unassigned_interns = InternshipApplication.query.filter_by(
            status=ApplicationStatusEnum.ACCEPTED,
            cohort_id=None
        ).count()
        
        # Cohort stats
        active_cohorts = InternshipCohort.query.filter(
            InternshipCohort.start_date <= datetime.utcnow(),
            InternshipCohort.end_date >= datetime.utcnow()
        ).count()
        total_cohorts = InternshipCohort.query.count()
        
        # Task stats
        total_tasks = InternshipTask.query.count()
        active_tasks = InternshipTask.query.filter_by(is_active=True).count()
        
        # Pending review (submitted but not graded)
        pending_review = InternshipTaskAssignment.query.filter_by(
            status='submitted'
        ).count()
        
        # Overdue tasks (past due, not submitted/approved)
        overdue = InternshipTaskAssignment.query.filter(
            InternshipTaskAssignment.status.in_(['pending', 'in_progress']),
            InternshipTask.due_date < datetime.utcnow()
        ).join(InternshipTask).count()
        
        # Task type distribution
        type_stats = {}
        for ttype in ['document', 'presentation', 'code', 'research', 'assignment', 'project', 'report', 'quiz', 'other']:
            count = InternshipTask.query.filter_by(task_type=ttype).count()
            if count > 0:
                type_stats[ttype] = count

        stats = {
            'total_interns': total_interns,
            'unassigned_interns': unassigned_interns,
            'active_cohorts': active_cohorts,
            'total_cohorts': total_cohorts,
            'total_tasks': total_tasks,
            'active_tasks': active_tasks,
            'pending_review': pending_review,
            'overdue_tasks': overdue,
            'task_types': type_stats,
        }

        return success_response('Instructor stats retrieved', stats)
    except Exception as e:
        logger.error(f"Error fetching instructor stats: {str(e)}")
        return error_response('Failed to fetch instructor stats', status_code=500)


# ============= OFFER LETTER ROUTES =============

@internships_bp.route('/admin/applications/<app_id>/offer/regenerate', methods=['POST'])
@role_required(['admin', 'staff'])
def regenerate_offer_letter(app_id):
    """
    Regenerate an offer letter for an application that already has one.
    Revokes the old offer, generates a new one with a fresh offer number,
    new PDF, new credentials, and sends the email.
    """
    try:
        user_id = int(get_jwt_identity())
        admin_user = User.query.get(user_id)
        if not admin_user:
            return error_response('Admin user not found', status_code=401)

        application = InternshipApplication.query.get(app_id)
        if not application:
            return error_response('Application not found', status_code=404)

        if application.status != ApplicationStatusEnum.ACCEPTED:
            return error_response('Can only regenerate offer for accepted applications', status_code=400)

        offer_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            'uploads',
            'offer_letters'
        )

        success, message, new_offer, password = InternshipOfferService.regenerate_offer(
            application, admin_user, offer_dir
        )

        if not success:
            return error_response(message, status_code=400)

        # Send the new offer email
        is_existing_user = password is None
        try:
            mailer.send_offer_letter(application, new_offer, password=password, is_existing_user=is_existing_user)
        except Exception as mail_err:
            logger.error(f"Failed to send regenerated offer email: {mail_err}")

        offer_data = new_offer.to_dict()

        return success_response(
            message,
            {
                'offer': offer_data,
                'username': new_offer.generated_username,
                'message': message,
                'is_existing_user': is_existing_user,
            },
            status_code=201
        )

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error regenerating offer letter: {str(e)}", exc_info=True)
        return error_response('Failed to regenerate offer letter', status_code=500)


@internships_bp.route('/admin/applications/<app_id>/offer/resend', methods=['POST'])
@role_required(['admin', 'staff'])
def resend_offer_email(app_id):
    """
    Resend the offer letter email for an application that already has an offer.
    Useful when the applicant didn't receive the email or needs it re-sent.
    """
    try:
        application = InternshipApplication.query.get(app_id)
        if not application:
            return error_response('Application not found', status_code=404)

        if application.status != ApplicationStatusEnum.ACCEPTED:
            return error_response('Can only resend offer for accepted applications', status_code=400)

        offer = InternshipOfferLetter.query.filter_by(application_id=app_id).first()
        if not offer:
            return error_response('No offer letter found for this application. Generate one first.', status_code=404)

        # Determine if this applicant already had an account before the offer
        intern_user = User.query.filter_by(email=application.email).first()
        is_existing_user = intern_user is not None

        # Resend the offer email (password=None since it's already been sent)
        try:
            mailer.send_offer_letter(application, offer, password=None, is_existing_user=is_existing_user)
        except Exception as mail_err:
            logger.error(f"Failed to resend offer email for {app_id}: {mail_err}")
            return error_response('Failed to resend email. Please try again.', status_code=500)

        logger.info(f"Offer email resent for application {app_id} (offer={offer.offer_number})")

        return success_response('Offer email resent successfully', {
            'offer_number': offer.offer_number,
            'sent_to': application.email,
        })

    except Exception as e:
        logger.error(f"Error resending offer email: {str(e)}")
        return error_response('Failed to resend offer email', status_code=500)


@internships_bp.route('/admin/applications/<app_id>/offer', methods=['POST'])
@role_required(['admin', 'staff'])
def generate_offer_letter(app_id):
    """
    Generate an offer letter for an accepted application.
    Creates a user account, generates a tamper-proof PDF,
    and sends the offer via email.
    """
    try:
        user_id = int(get_jwt_identity())
        admin_user = User.query.get(user_id)
        if not admin_user:
            return error_response('Admin user not found', status_code=401)

        application = InternshipApplication.query.get(app_id)
        if not application:
            return error_response('Application not found', status_code=404)

        if application.status != ApplicationStatusEnum.ACCEPTED:
            return error_response(
                'Can only generate offer letters for accepted applications',
                status_code=400
            )

        # Offer directory
        offer_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            'uploads',
            'offer_letters'
        )

        success, message, offer, password = InternshipOfferService.create_offer(
            application, admin_user, offer_dir
        )

        if not success:
            return error_response(message, status_code=400 if offer else 500)

        # Send offer email with the generated clear-text password
        is_existing_user = password is None
        try:
            mailer.send_offer_letter(application, offer, password=password, is_existing_user=is_existing_user)
        except Exception as mail_err:
            logger.error(f"Failed to send offer email: {mail_err}")
            # Don't fail the request — the offer was still generated

        offer_data = offer.to_dict()

        return success_response(
            'Offer letter generated and sent successfully',
            {
                'offer': offer_data,
                'username': offer.generated_username,
                'message': message,
                'is_existing_user': is_existing_user,
            },
            status_code=201
        )

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error generating offer letter: {str(e)}", exc_info=True)
        return error_response('Failed to generate offer letter', status_code=500)


@internships_bp.route('/admin/applications/<app_id>/offer', methods=['GET'])
@role_required(['admin', 'staff'])
def get_offer_letter(app_id):
    """Get the offer letter details for an application."""
    try:
        application = InternshipApplication.query.get(app_id)
        if not application:
            return error_response('Application not found', status_code=404)

        offer = InternshipOfferLetter.query.filter_by(application_id=app_id).first()
        if not offer:
            return error_response('No offer letter found for this application', status_code=404)

        # Verify tamper-proof status
        is_authentic, verify_message = InternshipOfferService.verify_offer_pdf(offer)

        offer_data = offer.to_dict()
        offer_data['is_authentic'] = is_authentic
        offer_data['verification_message'] = verify_message
        offer_data.pop('generated_password_hash', None)

        # Determine if the applicant already had an account before this offer
        intern_user = User.query.filter_by(email=application.email).first()
        offer_data['is_existing_user'] = intern_user is not None

        return success_response('Offer letter retrieved', offer_data)

    except Exception as e:
        logger.error(f"Error fetching offer letter: {str(e)}")
        return error_response('Failed to fetch offer letter', status_code=500)


@internships_bp.route('/admin/offers/<offer_id>/download', methods=['GET'])
def download_offer_pdf(offer_id):
    """
    Download the offer letter PDF.

    Auth (supports both):
      - Authorization: Bearer <token> header (from axios)
      - ?token=<jwt> query param (for direct URLs / external viewers)
    """
    try:
        # ---- Auth: support header OR query-param token ----
        auth_token = request.args.get('token')
        if auth_token:
            # Query-param authentication (for direct links)
            try:
                from flask_jwt_extended import decode_token
                decoded = decode_token(auth_token)
                user_id = decoded['sub']
            except Exception:
                return jsonify({'message': 'Invalid or expired token'}), 401
            user = User.query.get(user_id)
            if not user or not user.role or user.role.name not in ['admin', 'staff']:
                return jsonify({'message': 'Access denied. Required roles: admin, staff'}), 403
        else:
            # Standard header-based auth (from axios interceptor)
            try:
                user_id = int(get_jwt_identity())
            except Exception:
                return jsonify({'message': 'Authentication required'}), 401
            user = User.query.get(user_id)
            if not user or not user.role or user.role.name not in ['admin', 'staff']:
                return jsonify({'message': 'Access denied. Required roles: admin, staff'}), 403

        offer = InternshipOfferLetter.query.get(offer_id)
        if not offer:
            return error_response('Offer not found', status_code=404)

        if not offer.pdf_path or not os.path.exists(offer.pdf_path):
            return error_response('Offer PDF file not found', status_code=404)

        application = offer.application
        filename = f"Offer_Letter_{application.reference_code}.pdf"

        return send_file(
            offer.pdf_path,
            as_attachment=True,
            download_name=filename,
            mimetype='application/pdf',
        )

    except Exception as e:
        logger.error(f"Error downloading offer PDF: {str(e)}")
        return error_response('Failed to download offer', status_code=500)


@internships_bp.route('/admin/offers/<offer_id>/verify', methods=['GET'])
@role_required(['admin', 'staff'])
def verify_offer_integrity(offer_id):
    """Verify the integrity of an offer letter PDF (tamper-proof check)."""
    try:
        offer = InternshipOfferLetter.query.get(offer_id)
        if not offer:
            return error_response('Offer not found', status_code=404)

        is_authentic, message = InternshipOfferService.verify_offer_pdf(offer)

        return success_response('Verification result', {
            'is_authentic': is_authentic,
            'message': message,
            'offer_number': offer.offer_number,
            'pdf_hash': offer.pdf_hash,
            'pdf_exists': bool(offer.pdf_path and os.path.exists(offer.pdf_path)),
        })

    except Exception as e:
        logger.error(f"Error verifying offer: {str(e)}")
        return error_response('Failed to verify offer', status_code=500)


@internships_bp.route('/admin/offers/<offer_id>/share', methods=['POST'])
@role_required(['admin', 'staff'])
def share_offer_social(offer_id):
    """
    Generate social media share content for an offer letter.
    Body (optional):
    - platform: str (linkedin, twitter, facebook, whatsapp)
    """
    try:
        offer = InternshipOfferLetter.query.get(offer_id)
        if not offer:
            return error_response('Offer not found', status_code=404)

        data = request.get_json() or {}
        platform = data.get('platform', 'generic')

        share_texts = InternshipOfferService.generate_social_share_text(offer, offer.application)
        share_url = InternshipOfferService.get_share_url(offer)

        # Increment share counter
        offer.social_shares = (offer.social_shares or 0) + 1
        if platform != 'generic':
            db.session.commit()

        return success_response('Share content generated', {
            'platform': platform,
            'text': share_texts.get(platform, share_texts['generic']),
            'share_url': share_url,
            'total_shares': offer.social_shares,
            'platforms': list(share_texts.keys()),
        })

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error generating share content: {str(e)}")
        return error_response('Failed to generate share content', status_code=500)


@internships_bp.route('/offers/verify/<verification_hash>', methods=['GET'])
def public_verify_offer(verification_hash):
    """Public endpoint to verify an offer letter's authenticity."""
    try:
        offer = InternshipOfferLetter.query.filter_by(
            verification_hash=verification_hash
        ).first()

        if not offer:
            return error_response('Offer not found', status_code=404)

        is_authentic, message = InternshipOfferService.verify_offer_pdf(offer)
        application = offer.application

        # Only return public-safe information
        return success_response('Offer verification result', {
            'offer_number': offer.offer_number,
            'is_authentic': is_authentic,
            'message': message,
            'status': offer.status,
            'candidate_name': application.full_name,
            'track_name': application.track.name if application.track else None,
            'issued_date': offer.sent_at.isoformat() if offer.sent_at else None,
        })

    except Exception as e:
        logger.error(f"Error in public verification: {str(e)}")
        return error_response('Failed to verify offer', status_code=500)

# ============= INTERN-FACING ROUTES (JWT-authenticated, self-serve) =============
# All endpoints under /intern/ require a valid JWT and 'intern' role

def _get_intern_application():
    """
    Helper: get the InternshipApplication linked to the current JWT user.
    Returns (application, None) on success, (None, error_response) on failure.
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return None, error_response('User not found', status_code=401)

    # Find the application linked to this user (only ACCEPTED ones - they're interns)
    application = InternshipApplication.query.filter_by(
        user_id=user_id,
        status=ApplicationStatusEnum.ACCEPTED
    ).first()

    if not application:
        return None, error_response(
            'No active internship found. You must be accepted into an internship to access this portal.',
            status_code=404
        )

    return application, None


# --- Dashboard ---

@internships_bp.route('/intern/dashboard', methods=['GET'])
@jwt_required()
def get_intern_dashboard():
    """
    Get intern dashboard overview:
    - Personal info, track, cohort
    - Task summary (total, pending, submitted, approved, avg score)
    - Offer letter status
    - Upcoming deadlines
    """
    try:
        application, err = _get_intern_application()
        if err:
            return err

        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)

        # Task statistics
        total_assigned = InternshipTaskAssignment.query.filter_by(intern_id=application.id).count()
        completed = InternshipTaskAssignment.query.filter_by(intern_id=application.id, status='approved').count()
        submitted = InternshipTaskAssignment.query.filter_by(intern_id=application.id, status='submitted').count()
        in_progress = InternshipTaskAssignment.query.filter_by(intern_id=application.id, status='in_progress').count()
        pending = InternshipTaskAssignment.query.filter_by(intern_id=application.id, status='pending').count()

        avg_score = db.session.query(db.func.avg(InternshipTaskAssignment.score)).filter(
            InternshipTaskAssignment.intern_id == application.id,
            InternshipTaskAssignment.score.isnot(None)
        ).scalar()

        # Upcoming deadlines (pending/in_progress tasks sorted by due_date)
        upcoming_assignments = InternshipTaskAssignment.query.filter(
            InternshipTaskAssignment.intern_id == application.id,
            InternshipTaskAssignment.status.in_(['pending', 'in_progress']),
            InternshipTask.due_date >= datetime.utcnow()
        ).join(InternshipTask).order_by(InternshipTask.due_date.asc()).limit(5).all()

        upcoming_tasks = []
        for asgn in upcoming_assignments:
            task = asgn.task
            upcoming_tasks.append({
                'assignment_id': asgn.id,
                'task_id': task.id,
                'title': task.title,
                'task_type': task.task_type.value if hasattr(task.task_type, 'value') else task.task_type,
                'priority': task.priority.value if hasattr(task.priority, 'value') else task.priority,
                'due_date': task.due_date.isoformat() if task.due_date else None,
                'status': asgn.status.value if hasattr(asgn.status, 'value') else asgn.status,
            })

        # Offer letter status
        offer = InternshipOfferLetter.query.filter_by(application_id=application.id).first()

        dashboard_data = {
            'intern': {
                'full_name': application.full_name,
                'email': application.email,
                'phone': application.phone,
                'reference_code': application.reference_code,
                'username': user.username if user else None,
            },
            'program': {
                'track': application.track.name if application.track else None,
                'cohort': application.cohort.cohort_name if application.cohort else None,
                'cohort_start': application.cohort.start_date.isoformat() if application.cohort and application.cohort.start_date else None,
                'cohort_end': application.cohort.end_date.isoformat() if application.cohort and application.cohort.end_date else None,
                'status': application.status.value if application.status else None,
            },
            'tasks': {
                'total_assigned': total_assigned,
                'completed': completed,
                'submitted': submitted,
                'in_progress': in_progress,
                'pending': pending,
                'progress_pct': round((completed / total_assigned * 100)) if total_assigned > 0 else 0,
                'avg_score': round(float(avg_score), 1) if avg_score else None,
            },
            'upcoming_deadlines': upcoming_tasks,
            'offer': {
                'id': offer.id,
                'offer_number': offer.offer_number,
                'status': offer.status,
                'sent_at': offer.sent_at.isoformat() if offer.sent_at else None,
            } if offer else None,
        }

        return success_response('Dashboard data retrieved', dashboard_data)

    except Exception as e:
        logger.error(f"Error fetching intern dashboard: {str(e)}")
        return error_response('Failed to fetch dashboard data', status_code=500)


# --- Profile ---

@internships_bp.route('/intern/profile', methods=['GET'])
@jwt_required()
def get_intern_profile():
    """Get the intern's full profile including application info and linked user details."""
    try:
        application, err = _get_intern_application()
        if err:
            return err

        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)

        profile_data = {
            'id': application.id,
            'reference_code': application.reference_code,
            'full_name': application.full_name,
            'email': application.email,
            'phone': application.phone,
            'national_id': application.national_id,
            'applicant_type': application.applicant_type.value if application.applicant_type else None,
            'track_name': application.track.name if application.track else None,
            'cohort_name': application.cohort.cohort_name if application.cohort else None,
            'portfolio_url': application.portfolio_url,
            'github_url': application.github_url,
            'linkedin_url': application.linkedin_url,
            'status': application.status.value if application.status else None,
            'created_at': application.created_at.isoformat() if application.created_at else None,
            'interview_date': application.interview_date.isoformat() if application.interview_date else None,
            # User account info
            'username': user.username if user else None,
            'first_name': user.first_name if user else None,
            'last_name': user.last_name if user else None,
            'must_change_password': user.must_change_password if user else True,
        }

        return success_response('Profile retrieved', profile_data)

    except Exception as e:
        logger.error(f"Error fetching intern profile: {str(e)}")
        return error_response('Failed to fetch profile', status_code=500)


@internships_bp.route('/intern/profile', methods=['PUT'])
@jwt_required()
def update_intern_profile():
    """Update the intern's profile (phone, portfolio, GitHub, LinkedIn URLs)."""
    try:
        application, err = _get_intern_application()
        if err:
            return err

        user_id = int(get_jwt_identity())
        data = request.get_json() or {}

        # Update allowed fields on the application
        if 'phone' in data:
            if not validate_phone_number(data['phone']):
                return error_response('Invalid phone number format', status_code=400)
            application.phone = data['phone'].strip()
        if 'portfolio_url' in data:
            application.portfolio_url = data['portfolio_url'] or None
        if 'github_url' in data:
            application.github_url = data['github_url'] or None
        if 'linkedin_url' in data:
            application.linkedin_url = data['linkedin_url'] or None

        # Update user account name fields if provided
        user = User.query.get(user_id)
        if user:
            if 'first_name' in data:
                user.first_name = data['first_name']
            if 'last_name' in data:
                user.last_name = data['last_name']

        db.session.commit()

        return success_response('Profile updated successfully')

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating intern profile: {str(e)}")
        return error_response('Failed to update profile', status_code=500)


# --- Cohort ---

@internships_bp.route('/intern/cohort', methods=['GET'])
@jwt_required()
def get_intern_cohort():
    """Get the intern's cohort details including fellow interns and track info."""
    try:
        application, err = _get_intern_application()
        if err:
            return err

        cohort = application.cohort
        if not cohort:
            return error_response('No cohort assigned yet', status_code=404)

        track = cohort.track

        # Fellow interns in the same cohort
        fellow_interns = InternshipApplication.query.filter(
            InternshipApplication.cohort_id == cohort.id,
            InternshipApplication.status == ApplicationStatusEnum.ACCEPTED,
            InternshipApplication.id != application.id
        ).all()

        cohort_data = {
            'cohort': cohort.to_dict(),
            'track': track.to_dict() if track else None,
            'fellow_interns': [
                {
                    'id': i.id,
                    'full_name': i.full_name,
                    'email': i.email,
                    'reference_code': i.reference_code,
                }
                for i in fellow_interns
            ],
            'total_interns': len(fellow_interns) + 1,
        }

        return success_response('Cohort data retrieved', cohort_data)

    except Exception as e:
        logger.error(f"Error fetching intern cohort: {str(e)}")
        return error_response('Failed to fetch cohort', status_code=500)


# --- Offer Letter ---

@internships_bp.route('/intern/offer', methods=['GET'])
@jwt_required()
def get_intern_offer():
    """Get the intern's offer letter details."""
    try:
        application, err = _get_intern_application()
        if err:
            return err

        offer = InternshipOfferLetter.query.filter_by(application_id=application.id).first()
        if not offer:
            return error_response('No offer letter found', status_code=404)

        offer_data = offer.to_dict()
        # Remove sensitive fields
        offer_data.pop('generated_password_hash', None)
        offer_data.pop('verification_hash', None)
        offer_data.pop('share_token', None)
        # Add public verification URL
        frontend_url = current_app.config.get('FRONTEND_URL', 'https://study.afritechbridge.online')
        offer_data['verification_url'] = f'{frontend_url}/verify-offer/{offer.verification_hash}'
        offer_data['share_url'] = InternshipOfferService.get_share_url(offer)
        offer_data['is_authentic'] = True
        if offer.pdf_path:
            is_auth, msg = InternshipOfferService.verify_offer_pdf(offer)
            offer_data['is_authentic'] = is_auth
            offer_data['verification_message'] = msg

        return success_response('Offer letter retrieved', offer_data)

    except Exception as e:
        logger.error(f"Error fetching intern offer: {str(e)}")
        return error_response('Failed to fetch offer letter', status_code=500)


# --- Tasks ---

@internships_bp.route('/intern/tasks', methods=['GET'])
@jwt_required()
def get_intern_tasks_list():
    """
    Get all tasks assigned to the intern with optional filtering.
    Query params:
    - status: str (pending, in_progress, submitted, approved, rejected)
    - task_type: str
    - sort_by: str (due_date, priority, created_at)
    - sort_order: str (asc, desc)
    """
    try:
        application, err = _get_intern_application()
        if err:
            return err

        status_filter = request.args.get('status')
        task_type = request.args.get('task_type')
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc')

        query = InternshipTaskAssignment.query.filter_by(
            intern_id=application.id
        ).join(InternshipTask)

        if status_filter:
            query = query.filter(InternshipTaskAssignment.status == status_filter)
        if task_type:
            query = query.filter(InternshipTask.task_type == task_type)

        sort_map = {
            'due_date': InternshipTask.due_date,
            'priority': InternshipTask.priority,
            'created_at': InternshipTask.created_at,
            'title': InternshipTask.title,
        }
        sort_col = sort_map.get(sort_by, InternshipTask.created_at)
        if sort_order == 'asc':
            query = query.order_by(sort_col.asc())
        else:
            query = query.order_by(sort_col.desc())

        assignments = query.all()

        tasks_data = []
        for asgn in assignments:
            task = asgn.task
            tasks_data.append({
                'assignment_id': asgn.id,
                'task_id': task.id,
                'title': task.title,
                'description': task.description,
                'task_type': task.task_type.value if hasattr(task.task_type, 'value') else task.task_type,
                'priority': task.priority.value if hasattr(task.priority, 'value') else task.priority,
                'max_score': task.max_score,
                'due_date': task.due_date.isoformat() if task.due_date else None,
                'status': asgn.status.value if hasattr(asgn.status, 'value') else asgn.status,
                'score': asgn.score,
                'feedback': asgn.feedback,
                'submission_text': asgn.submission_text,
                'submission_file_path': asgn.submission_file_path,
                'submitted_at': asgn.submitted_at.isoformat() if asgn.submitted_at else None,
                'graded_at': asgn.graded_at.isoformat() if asgn.graded_at else None,
                'created_at': task.created_at.isoformat() if task.created_at else None,
            })

        return success_response('Tasks retrieved', tasks_data)

    except Exception as e:
        logger.error(f"Error fetching intern tasks: {str(e)}")
        return error_response('Failed to fetch tasks', status_code=500)


@internships_bp.route('/intern/tasks/<assignment_id>', methods=['GET'])
@jwt_required()
def get_intern_task_detail(assignment_id):
    """Get a single task assignment detail with full task info."""
    try:
        application, err = _get_intern_application()
        if err:
            return err

        asgn = InternshipTaskAssignment.query.filter_by(
            id=assignment_id,
            intern_id=application.id
        ).first()

        if not asgn:
            return error_response('Task assignment not found', status_code=404)

        task = asgn.task
        task_data = {
            'assignment_id': asgn.id,
            'task_id': task.id,
            'title': task.title,
            'description': task.description,
            'task_type': task.task_type.value if hasattr(task.task_type, 'value') else task.task_type,
            'priority': task.priority.value if hasattr(task.priority, 'value') else task.priority,
            'max_score': task.max_score,
            'due_date': task.due_date.isoformat() if task.due_date else None,
            'status': asgn.status.value if hasattr(asgn.status, 'value') else asgn.status,
            'score': asgn.score,
            'feedback': asgn.feedback,
            'submission_text': asgn.submission_text,
            'submission_file_path': asgn.submission_file_path,
            'submitted_at': asgn.submitted_at.isoformat() if asgn.submitted_at else None,
            'graded_at': asgn.graded_at.isoformat() if asgn.graded_at else None,
            'created_at': task.created_at.isoformat() if task.created_at else None,
            'updated_at': task.updated_at.isoformat() if task.updated_at else None,
            'cohort_name': task.cohort.cohort_name if task.cohort else None,
            'track_name': application.track.name if application.track else None,
        }

        return success_response('Task detail retrieved', task_data)

    except Exception as e:
        logger.error(f"Error fetching intern task detail: {str(e)}")
        return error_response('Failed to fetch task', status_code=500)


@internships_bp.route('/intern/tasks/<assignment_id>/submit', methods=['POST'])
@jwt_required()
def submit_intern_task(assignment_id):
    """
    Submit work for an assigned task.
    Accepts:
    - submission_text: str (optional)
    - submission_file: file upload (optional)
    At least one of submission_text or submission_file is required.
    """
    try:
        application, err = _get_intern_application()
        if err:
            return err

        asgn = InternshipTaskAssignment.query.filter_by(
            id=assignment_id,
            intern_id=application.id
        ).first()

        if not asgn:
            return error_response('Task assignment not found', status_code=404)

        if asgn.status in ('approved', 'rejected'):
            return error_response(
                f"Cannot submit. This task has already been {asgn.status}.",
                status_code=400
            )

        submission_text = None
        submission_file_path = None

        if request.is_json:
            data = request.get_json() or {}
            submission_text = data.get('submission_text')
        else:
            submission_text = request.form.get('submission_text')

        if request.files and 'submission_file' in request.files:
            file = request.files['submission_file']
            if file and file.filename:
                upload_dir = os.path.join(
                    current_app.root_path,
                    '..',
                    'uploads',
                    'intern_submissions',
                    application.id
                )
                os.makedirs(upload_dir, exist_ok=True)
                filename = secure_filename(f"{assignment_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{file.filename}")
                file_path = os.path.join(upload_dir, filename)
                file.save(file_path)
                submission_file_path = file_path

        if not submission_text and not submission_file_path:
            return error_response(
                'Please provide your submission text or upload a file.',
                status_code=400
            )

        if submission_text:
            asgn.submission_text = submission_text
        if submission_file_path:
            asgn.submission_file_path = submission_file_path
        asgn.status = 'submitted'
        asgn.submitted_at = datetime.utcnow()

        db.session.commit()

        try:
            task = asgn.task
            logger.info(f"Intern {application.full_name} submitted task '{task.title}' (assignment={assignment_id})")
        except Exception as notify_err:
            logger.warning(f"Failed to notify about submission: {notify_err}")

        return success_response('Task submitted successfully', {
            'assignment_id': asgn.id,
            'status': 'submitted',
            'submitted_at': asgn.submitted_at.isoformat() if asgn.submitted_at else None,
        })

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error submitting intern task: {str(e)}")
        return error_response('Failed to submit task', status_code=500)


# --- Grades ---

@internships_bp.route('/intern/grades', methods=['GET'])
@jwt_required()
def get_intern_grades():
    """
    Get all grades and feedback for the intern's submitted/approved tasks.
    Includes overall statistics.
    """
    try:
        application, err = _get_intern_application()
        if err:
            return err

        graded_assignments = InternshipTaskAssignment.query.filter_by(
            intern_id=application.id
        ).filter(
            InternshipTaskAssignment.status.in_(['approved', 'rejected'])
        ).join(InternshipTask).order_by(InternshipTaskAssignment.graded_at.desc()).all()

        graded_data = []
        total_score = 0
        max_total = 0
        for asgn in graded_assignments:
            task = asgn.task
            graded_data.append({
                'assignment_id': asgn.id,
                'task_title': task.title,
                'task_type': task.task_type.value if hasattr(task.task_type, 'value') else task.task_type,
                'status': asgn.status.value if hasattr(asgn.status, 'value') else asgn.status,
                'score': asgn.score,
                'max_score': task.max_score,
                'feedback': asgn.feedback,
                'submitted_at': asgn.submitted_at.isoformat() if asgn.submitted_at else None,
                'graded_at': asgn.graded_at.isoformat() if asgn.graded_at else None,
            })
            if asgn.score is not None:
                total_score += asgn.score
                max_total += task.max_score or 100

        pending_assignments = InternshipTaskAssignment.query.filter_by(
            intern_id=application.id,
            status='submitted'
        ).join(InternshipTask).order_by(InternshipTaskAssignment.submitted_at.desc()).all()

        pending_data = []
        for asgn in pending_assignments:
            task = asgn.task
            pending_data.append({
                'assignment_id': asgn.id,
                'task_title': task.title,
                'task_type': task.task_type.value if hasattr(task.task_type, 'value') else task.task_type,
                'submitted_at': asgn.submitted_at.isoformat() if asgn.submitted_at else None,
            })

        total_graded = len(graded_assignments)
        approved_count = sum(1 for a in graded_assignments if a.status == 'approved')

        grades_data = {
            'summary': {
                'total_graded': total_graded,
                'approved': approved_count,
                'rejected': total_graded - approved_count,
                'pending_review': len(pending_assignments),
                'overall_score_pct': round((total_score / max_total * 100)) if max_total > 0 else None,
                'total_score': total_score,
                'max_total': max_total,
            },
            'graded': graded_data,
            'pending_review': pending_data,
        }

        return success_response('Grades retrieved', grades_data)

    except Exception as e:
        logger.error(f"Error fetching intern grades: {str(e)}")
        return error_response('Failed to fetch grades', status_code=500)


# --- Change Password ---

@internships_bp.route('/intern/change-password', methods=['PUT'])
@jwt_required()
def change_intern_password():
    """Change the intern's account password."""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)

        if not user:
            return error_response('User not found', status_code=401)

        data = request.get_json() or {}
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        confirm_password = data.get('confirm_password')

        if not current_password or not new_password or not confirm_password:
            return error_response(
                'current_password, new_password, and confirm_password are all required',
                status_code=400
            )

        if new_password != confirm_password:
            return error_response('New password and confirm password do not match', status_code=400)

        if len(new_password) < 8:
            return error_response('New password must be at least 8 characters long', status_code=400)

        if not user.check_password(current_password):
            return error_response('Current password is incorrect', status_code=401)

        user.set_password(new_password)
        user.must_change_password = False
        db.session.commit()

        logger.info(f"Password changed for intern user {user_id}")

        return success_response('Password changed successfully')

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error changing intern password: {str(e)}")
        return error_response('Failed to change password', status_code=500)
