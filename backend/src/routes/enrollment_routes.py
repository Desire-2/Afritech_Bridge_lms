# Enrollment Routes - Course enrollment and application API endpoints
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps

from ..models.user_models import User
from ..services.enrollment_service import EnrollmentService
from ..services.dashboard_service import DashboardService

# Helper decorator for student access
def student_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = int(get_jwt_identity())
        print(f"DEBUG: student_required - user_id = {current_user_id}")
        user = User.query.get(current_user_id)
        print(f"DEBUG: student_required - user = {user.email if user else 'None'}")
        if user:
            print(f"DEBUG: student_required - role = {user.role.name if user.role else 'None'}")
        if not user or not user.role or user.role.name != 'student':
            print(f"DEBUG: student_required - ACCESS DENIED")
            return jsonify({"message": "Student access required"}), 403
        print(f"DEBUG: student_required - ACCESS GRANTED")
        return f(*args, **kwargs)
    return decorated_function

enrollment_bp = Blueprint("student_enrollment", __name__, url_prefix="/api/v1/student/enrollment")

@enrollment_bp.route("/test-simple", methods=["GET"])
@jwt_required()
def test_simple():
    """Simple test endpoint"""
    return jsonify({"success": True, "message": "Test endpoint working"}), 200

@enrollment_bp.route("/browse-courses", methods=["GET"])
@jwt_required()
def browse_courses():
    """Browse available courses with enrollment status"""
    print("DEBUG: browse_courses route hit!")
    try:
        student_id = int(get_jwt_identity())
        print(f"DEBUG: student_id = {student_id}")
        
        # Get filters from query parameters
        filters = {}
        if request.args.get('enrollment_type'):
            filters['enrollment_type'] = request.args.get('enrollment_type')
        if request.args.get('difficulty_level'):
            filters['difficulty_level'] = request.args.get('difficulty_level')
        if request.args.get('search_term'):
            filters['search_term'] = request.args.get('search_term')
        
        print(f"DEBUG: filters = {filters}")
        
        # Get course data
        print("DEBUG: Calling EnrollmentService.browse_courses...")
        courses = EnrollmentService.browse_courses(student_id, filters)
        print(f"DEBUG: Got {len(courses)} courses")
        
        print("DEBUG: Calling DashboardService.get_browse_courses_data...")
        browse_data = DashboardService.get_browse_courses_data(student_id, filters)
        print(f"DEBUG: Got browse_data")
        
        return jsonify({
            "success": True,
            "data": {
                "courses": courses,
                "browse_data": browse_data
            }
        }), 200
        
    except Exception as e:
        print(f"Browse courses error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": "Failed to load courses"
        }), 500

@enrollment_bp.route("/apply", methods=["POST"])
@student_required
def apply_for_course():
    """Apply for course enrollment"""
    try:
        student_id = int(get_jwt_identity())
        data = request.get_json()
        
        if not data or 'course_id' not in data:
            return jsonify({
                "success": False,
                "error": "Course ID is required"
            }), 400
        
        course_id = data['course_id']
        application_data = {
            'type': data.get('type'),
            'motivation_letter': data.get('motivation_letter'),
        }
        
        success, message, app_data = EnrollmentService.apply_for_course(
            student_id, course_id, application_data
        )
        
        if success:
            return jsonify({
                "success": True,
                "message": message,
                "data": app_data
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": message,
                "data": app_data
            }), 400
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to submit application"
        }), 500

@enrollment_bp.route("/enroll", methods=["POST"])
@jwt_required()
def enroll_directly():
    """Direct enrollment for free courses"""
    try:
        print("DEBUG: Starting enrollment process...")
        student_id = int(get_jwt_identity())
        print(f"DEBUG: Student ID: {student_id}")
        
        data = request.get_json()
        print(f"DEBUG: Request data: {data}")
        
        if not data or 'course_id' not in data:
            print("DEBUG: Missing course_id in request")
            return jsonify({
                "success": False,
                "error": "Course ID is required"
            }), 400
        
        course_id = data['course_id']
        print(f"DEBUG: Course ID: {course_id}")
        
        print("DEBUG: Calling EnrollmentService.enroll_directly...")
        success, message, enrollment_data = EnrollmentService.enroll_directly(
            student_id, course_id
        )
        print(f"DEBUG: Enrollment result - Success: {success}, Message: {message}")
        
        if success:
            return jsonify({
                "success": True,
                "message": message,
                "data": enrollment_data
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": message,
                "data": enrollment_data
            }), 400
        
    except Exception as e:
        print(f"DEBUG: Exception in enrollment: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": "Failed to enroll in course"
        }), 500

@enrollment_bp.route("/payment", methods=["POST"])
@student_required
def process_payment():
    """Process payment for paid course enrollment"""
    try:
        data = request.get_json()
        
        if not data or 'application_id' not in data:
            return jsonify({
                "success": False,
                "error": "Application ID is required"
            }), 400
        
        application_id = data['application_id']
        payment_data = {
            'payment_method': data.get('payment_method'),
            'amount': data.get('amount'),
            'currency': data.get('currency', 'USD'),
            'reference': data.get('reference'),
            'phone_number': data.get('phone_number') or data.get('msisdn'),
            'payer_name': data.get('payer_name'),
            'test_success': data.get('test_success', True)  # For testing
        }
        
        success, message, enrollment_data = EnrollmentService.process_payment(
            application_id, payment_data
        )
        
        if success:
            return jsonify({
                "success": True,
                "message": message,
                "data": enrollment_data
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": message
            }), 400
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to process payment"
        }), 500

@enrollment_bp.route("/my-applications", methods=["GET"])
@student_required
def get_my_applications():
    """Get student's enrollment applications"""
    try:
        student_id = int(get_jwt_identity())
        
        from ..models.student_models import CourseEnrollmentApplication
        applications = CourseEnrollmentApplication.query.filter_by(
            student_id=student_id
        ).order_by(CourseEnrollmentApplication.applied_at.desc()).all()
        
        return jsonify({
            "success": True,
            "data": {
                "applications": [app.to_dict() for app in applications]
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load applications"
        }), 500

@enrollment_bp.route("/my-enrollments", methods=["GET"])
@student_required
def get_my_enrollments():
    """Get student's current enrollments"""
    try:
        student_id = int(get_jwt_identity())
        enrollments = EnrollmentService.get_student_enrollments(student_id)
        
        return jsonify({
            "success": True,
            "data": {
                "enrollments": enrollments
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load enrollments"
        }), 500

@enrollment_bp.route("/course/<int:course_id>/status", methods=["GET"])
@student_required
def get_enrollment_status(course_id):
    """Get enrollment status for a specific course"""
    try:
        student_id = int(get_jwt_identity())
        
        from ..models.course_models import Enrollment
        from ..models.student_models import CourseEnrollmentApplication
        
        # Check enrollment
        enrollment = Enrollment.query.filter_by(
            user_id=student_id, course_id=course_id
        ).first()
        
        if enrollment:
            return jsonify({
                "success": True,
                "data": {
                    "status": "enrolled",
                    "enrollment": enrollment.to_dict()
                }
            }), 200
        
        # Check application
        application = CourseEnrollmentApplication.query.filter_by(
            student_id=student_id, course_id=course_id
        ).first()
        
        if application:
            return jsonify({
                "success": True,
                "data": {
                    "status": "applied",
                    "application": application.to_dict()
                }
            }), 200
        
        # Not enrolled or applied
        return jsonify({
            "success": True,
            "data": {
                "status": "available"
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to get enrollment status"
        }), 500

@enrollment_bp.route("/course-categories", methods=["GET"])
@student_required
def get_course_categories():
    """Get course categories for browsing"""
    try:
        browse_data = DashboardService.get_browse_courses_data(
            int(get_jwt_identity())
        )
        
        return jsonify({
            "success": True,
            "data": {
                "categories": browse_data.get("course_categories", [])
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load categories"
        }), 500

@enrollment_bp.route("/recommendations", methods=["GET"])
@student_required
def get_course_recommendations():
    """Get personalized course recommendations"""
    try:
        student_id = int(get_jwt_identity())
        browse_data = DashboardService.get_browse_courses_data(student_id)
        
        return jsonify({
            "success": True,
            "data": {
                "recommended_courses": browse_data.get("recommended_courses", [])
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load recommendations"
        }), 500

@enrollment_bp.route("/application/<int:application_id>/cancel", methods=["POST"])
@student_required
def cancel_application(application_id):
    """Cancel a pending application"""
    try:
        student_id = int(get_jwt_identity())
        
        from ..models.student_models import CourseEnrollmentApplication
        from ..models.user_models import db
        
        application = CourseEnrollmentApplication.query.filter_by(
            id=application_id, student_id=student_id
        ).first()
        
        if not application:
            return jsonify({
                "success": False,
                "error": "Application not found"
            }), 404
        
        if application.status not in ['pending', 'pending_payment']:
            return jsonify({
                "success": False,
                "error": "Cannot cancel application in current status"
            }), 400
        
        # Update status to cancelled
        application.status = 'cancelled'
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Application cancelled successfully"
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to cancel application"
        }), 500