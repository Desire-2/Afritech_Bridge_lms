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
        schema = InternshipTrackSchema(many=True)
        
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
        # 6. Validate track
        # ----------------------------------------------------------------
        track = InternshipTrack.query.get(validated_data['track_id'])
        if not track:
            logger.error(f"Track not found for id={validated_data['track_id']}")
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
