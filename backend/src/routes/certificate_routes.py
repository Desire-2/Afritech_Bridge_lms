# Certificate Routes - Student certificate and badge API endpoints
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps

from ..models.user_models import User
from ..services.certificate_service import CertificateService

# Helper decorator for student access
def student_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        if not user or not user.role or user.role.name != 'student':
            return jsonify({"message": "Student access required"}), 403
        return f(*args, **kwargs)
    return decorated_function

certificate_bp = Blueprint("student_certificate", __name__, url_prefix="/api/v1/student/certificate")

@certificate_bp.route("/eligibility/<int:course_id>", methods=["GET"])
@student_required
def check_certificate_eligibility(course_id):
    """Check if student is eligible for course certificate"""
    try:
        student_id = int(get_jwt_identity())
        eligible, reason, requirements = CertificateService.check_certificate_eligibility(
            student_id, course_id
        )
        
        return jsonify({
            "success": True,
            "data": {
                "eligible": eligible,
                "reason": reason,
                "requirements": requirements
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to check certificate eligibility"
        }), 500

@certificate_bp.route("/generate/<int:course_id>", methods=["POST"])
@student_required
def generate_certificate(course_id):
    """Generate course completion certificate"""
    try:
        student_id = int(get_jwt_identity())
        success, message, certificate_data = CertificateService.generate_certificate(
            student_id, course_id
        )
        
        if success:
            return jsonify({
                "success": True,
                "message": message,
                "data": certificate_data
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": message
            }), 400
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to generate certificate"
        }), 500

@certificate_bp.route("/verify", methods=["POST"])
def verify_certificate():
    """Verify certificate authenticity (public endpoint)"""
    try:
        data = request.get_json()
        
        if not data or 'certificate_number' not in data:
            return jsonify({
                "success": False,
                "error": "Certificate number is required"
            }), 400
        
        certificate_number = data['certificate_number']
        verification_hash = data.get('verification_hash')
        
        valid, message, cert_data = CertificateService.verify_certificate(
            certificate_number, verification_hash
        )
        
        if valid:
            return jsonify({
                "success": True,
                "message": message,
                "data": cert_data
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": message
            }), 400
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to verify certificate"
        }), 500

@certificate_bp.route("/my-certificates", methods=["GET"])
@student_required
def get_my_certificates():
    """Get all certificates for the student, including blurred ones for incomplete courses"""
    try:
        student_id = int(get_jwt_identity())
        # Pass include_completion=True to get completion percentage and locked status
        certificates = CertificateService.get_student_certificates(student_id, include_completion=True)
        
        return jsonify({
            "success": True,
            "certificates": certificates,
            "data": {
                "certificates": certificates,
                "total_count": len(certificates)
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load certificates"
        }), 500

@certificate_bp.route("/my-badges", methods=["GET"])
@student_required
def get_my_badges():
    """Get all badges earned by the student"""
    try:
        student_id = int(get_jwt_identity())
        badges = CertificateService.get_student_badges(student_id)
        
        # Group badges by category
        badges_by_category = {}
        for badge in badges:
            category = badge['badge']['category']
            if category not in badges_by_category:
                badges_by_category[category] = []
            badges_by_category[category].append(badge)
        
        return jsonify({
            "success": True,
            "data": {
                "badges": badges,
                "badges_by_category": badges_by_category,
                "total_count": len(badges)
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load badges"
        }), 500

@certificate_bp.route("/available-badges", methods=["GET"])
@student_required
def get_available_badges():
    """Get all available skill badges"""
    try:
        available_badges = CertificateService.get_available_badges()
        
        # Group by category and difficulty
        badges_by_category = {}
        badges_by_difficulty = {}
        
        for badge in available_badges:
            category = badge['category']
            difficulty = badge['difficulty_level']
            
            if category not in badges_by_category:
                badges_by_category[category] = []
            badges_by_category[category].append(badge)
            
            if difficulty not in badges_by_difficulty:
                badges_by_difficulty[difficulty] = []
            badges_by_difficulty[difficulty].append(badge)
        
        return jsonify({
            "success": True,
            "data": {
                "available_badges": available_badges,
                "badges_by_category": badges_by_category,
                "badges_by_difficulty": badges_by_difficulty
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load available badges"
        }), 500

@certificate_bp.route("/transcript", methods=["GET"])
@student_required
def get_transcript():
    """Get comprehensive student transcript"""
    try:
        student_id = int(get_jwt_identity())
        transcript = CertificateService.generate_transcript(student_id)
        
        if "error" in transcript:
            return jsonify({"error": transcript["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": transcript
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to generate transcript"
        }), 500

@certificate_bp.route("/download/<int:certificate_id>", methods=["GET"])
@student_required
def download_certificate(certificate_id):
    """Download certificate (would generate PDF in real implementation)"""
    try:
        student_id = int(get_jwt_identity())
        
        from ..models.student_models import Certificate
        
        certificate = Certificate.query.filter_by(
            id=certificate_id, student_id=student_id, is_active=True
        ).first()
        
        if not certificate:
            return jsonify({
                "success": False,
                "error": "Certificate not found"
            }), 404
        
        # In a real implementation, this would generate and return a PDF
        # For now, return certificate data with download instructions
        return jsonify({
            "success": True,
            "data": {
                "certificate": certificate.to_dict(),
                "download_url": f"/api/v1/student/certificate/pdf/{certificate.id}",
                "message": "Certificate data ready for PDF generation"
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to prepare certificate download"
        }), 500

@certificate_bp.route("/badge-progress", methods=["GET"])
@student_required
def get_badge_progress():
    """Get progress towards earning badges"""
    try:
        student_id = int(get_jwt_identity())
        
        # Get student's current badges
        earned_badges = CertificateService.get_student_badges(student_id)
        earned_badge_ids = [badge['badge_id'] for badge in earned_badges]
        
        # Get available badges not yet earned
        available_badges = CertificateService.get_available_badges()
        unearned_badges = [
            badge for badge in available_badges 
            if badge['id'] not in earned_badge_ids
        ]
        
        # Calculate progress for each unearned badge
        badge_progress = []
        for badge in unearned_badges:
            # This would calculate actual progress based on criteria
            # For now, return placeholder progress
            progress = {
                "badge": badge,
                "progress_percentage": 65,  # Placeholder
                "requirements_met": 2,
                "total_requirements": 3,
                "next_step": "Complete one more advanced assignment"
            }
            badge_progress.append(progress)
        
        return jsonify({
            "success": True,
            "data": {
                "badge_progress": badge_progress,
                "earned_count": len(earned_badges),
                "available_count": len(available_badges)
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load badge progress"
        }), 500

@certificate_bp.route("/achievements-summary", methods=["GET"])
@student_required
def get_achievements_summary():
    """Get summary of all achievements"""
    try:
        student_id = int(get_jwt_identity())
        
        certificates = CertificateService.get_student_certificates(student_id)
        badges = CertificateService.get_student_badges(student_id)
        
        # Calculate achievement points
        total_points = (len(certificates) * 100) + (len(badges) * 10)
        
        # Get recent achievements
        recent_certificates = certificates[:3]  # Last 3
        recent_badges = badges[:5]  # Last 5
        
        return jsonify({
            "success": True,
            "data": {
                "summary": {
                    "total_certificates": len(certificates),
                    "total_badges": len(badges),
                    "total_points": total_points,
                    "achievement_level": "Intermediate" if total_points >= 100 else "Beginner"
                },
                "recent_achievements": {
                    "certificates": recent_certificates,
                    "badges": recent_badges
                },
                "milestones": {
                    "next_certificate": "Complete Python Advanced course",
                    "next_badge": "Algorithm Master - solve 10 complex problems",
                    "next_level": 500 - total_points if total_points < 500 else 0
                }
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load achievements summary"
        }), 500