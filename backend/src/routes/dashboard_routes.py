# Dashboard Routes - Student dashboard API endpoints
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps

from ..models.user_models import User
from ..services.dashboard_service import DashboardService

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

dashboard_bp = Blueprint("student_dashboard", __name__, url_prefix="/api/v1/student/dashboard")

@dashboard_bp.route("/", methods=["GET"])
@student_required
def get_student_dashboard():
    """Get comprehensive dashboard data for student"""
    try:
        student_id = int(get_jwt_identity())
        dashboard_data = DashboardService.get_comprehensive_dashboard(student_id)
        
        if "error" in dashboard_data:
            return jsonify({"error": dashboard_data["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": dashboard_data
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load dashboard"
        }), 500

@dashboard_bp.route("/overview", methods=["GET"])
@student_required
def get_dashboard_overview():
    """Get overview section of dashboard"""
    try:
        student_id = int(get_jwt_identity())
        dashboard_data = DashboardService.get_comprehensive_dashboard(student_id)
        
        if "error" in dashboard_data:
            return jsonify({"error": dashboard_data["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": {
                "overview": dashboard_data["overview"],
                "recent_activity": dashboard_data["recent_activity"],
                "upcoming_tasks": dashboard_data["upcoming_tasks"]
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load overview"
        }), 500

@dashboard_bp.route("/learning-summary", methods=["GET"])
@student_required
def get_learning_summary():
    """Get learning summary for dashboard"""
    try:
        student_id = int(get_jwt_identity())
        dashboard_data = DashboardService.get_comprehensive_dashboard(student_id)
        
        if "error" in dashboard_data:
            return jsonify({"error": dashboard_data["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": {
                "my_learning": dashboard_data["my_learning"],
                "performance_insights": dashboard_data["performance_insights"],
                "learning_recommendations": dashboard_data["learning_recommendations"]
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load learning summary"
        }), 500

@dashboard_bp.route("/achievements", methods=["GET"])
@student_required
def get_achievements_summary():
    """Get achievements summary for dashboard"""
    try:
        student_id = int(get_jwt_identity())
        dashboard_data = DashboardService.get_comprehensive_dashboard(student_id)
        
        if "error" in dashboard_data:
            return jsonify({"error": dashboard_data["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": {
                "achievements": dashboard_data["achievements"],
                "my_progress": dashboard_data["my_progress"]
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load achievements"
        }), 500

@dashboard_bp.route("/quick-stats", methods=["GET"])
@student_required
def get_quick_stats():
    """Get quick statistics for dashboard widgets"""
    try:
        student_id = int(get_jwt_identity())
        dashboard_data = DashboardService.get_comprehensive_dashboard(student_id)
        
        if "error" in dashboard_data:
            return jsonify({"error": dashboard_data["error"]}), 400
        
        return jsonify({
            "success": True,
            "data": {
                "overview": dashboard_data["overview"],
                "my_progress": dashboard_data["my_progress"]
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to load quick stats"
        }), 500