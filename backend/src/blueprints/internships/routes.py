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
            application.interview_date = datetime.fromisoformat(data['interview_date'])
        
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
        
        # Send email notification
        user = User.query.get(user_id)
        mailer.send_status_update(application, old_status, new_status, data.get('note'))
        
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
        
        return success_response('Cohort assigned successfully', application.to_dict())
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error assigning cohort: {str(e)}")
        return error_response('Failed to assign cohort', status_code=500)


@internships_bp.route('/admin/applications/<app_id>/cv', methods=['GET'])
@role_required(['admin', 'staff'])
def download_cv(app_id):
    """Download CV file for application"""
    try:
        application = InternshipApplication.query.get(app_id)
        if not application:
            return error_response('Application not found', status_code=404)
        
        cv_path = application.cv_file_path
        
        if not os.path.exists(cv_path):
            logger.error(f"CV file not found: {cv_path}")
            return error_response('CV file not found', status_code=404)
        
        return send_file(
            cv_path,
            as_attachment=True,
            download_name=application.cv_original_name
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

                # Send email notification
                try:
                    mailer.send_status_update(application, old_status, new_status, note)
                except Exception as mail_err:
                    logger.warning(f"Failed to send status email for {app_id}: {mail_err}")

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

            except Exception as e:
                results['errors'].append({'id': app_id, 'reason': str(e)})
                logger.error(f"Error processing batch assign for {app_id}: {str(e)}")

        db.session.commit()

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
                    mailer.send_offer_letter(application, offer, password=password)
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
        
        for intern_id in intern_ids:
            assignment = InternshipTaskAssignment(
                task_id=task.id,
                intern_id=intern_id,
                status='pending',
            )
            db.session.add(assignment)
        
        db.session.commit()
        logger.info(f"Task created: {task.title} ({task.id}) with {len(intern_ids)} assignments")
        
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
        
        db.session.commit()
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
        try:
            mailer.send_offer_letter(application, offer, password=password)
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

        return success_response('Offer letter retrieved', offer_data)

    except Exception as e:
        logger.error(f"Error fetching offer letter: {str(e)}")
        return error_response('Failed to fetch offer letter', status_code=500)


@internships_bp.route('/admin/offers/<offer_id>/download', methods=['GET'])
@role_required(['admin', 'staff'])
def download_offer_pdf(offer_id):
    """Download the offer letter PDF."""
    try:
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
