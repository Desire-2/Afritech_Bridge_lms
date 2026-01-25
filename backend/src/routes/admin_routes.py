# admin_routes.py

from flask import Blueprint, request, jsonify, make_response
from functools import wraps
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, or_, and_, desc
from datetime import datetime, timedelta
from ..models.user_models import db, User, Role
from ..models.course_models import Course, Enrollment, Quiz, Submission
from ..models.opportunity_models import Opportunity
from ..models.student_models import (
    LessonCompletion, UserProgress, ModuleProgress, StudentNote,
    StudentBookmark, Certificate, LearningAnalytics
)
import logging
import csv
import json
from io import StringIO

logger = logging.getLogger(__name__)

# A simple way to define roles if not using a complex Enum structure from the model directly for checks
class AppRoles:
    ADMIN = "admin" # This should match the string stored in Role.name or User.role.name
    INSTRUCTOR = "instructor"
    STUDENT = "student"

admin_bp = Blueprint("admin_api", __name__, url_prefix="/api/v1/admin")

# --- Authorization Decorator ---
def admin_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        try:
            current_user_id = get_jwt_identity()
            current_user = User.query.get(current_user_id)
            
            if not current_user:
                return jsonify({"error": "User not found"}), 401
            
            # Check if the user has the 'admin' role
            if not current_user.role or current_user.role.name.lower() != AppRoles.ADMIN:
                return jsonify({"error": "Admin privileges required"}), 403
            
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Admin authorization error: {str(e)}")
            return jsonify({"error": "Authorization failed"}), 401
            
    return decorated_function

# --- User Management API Routes ---
@admin_bp.route("/users", methods=["GET"])
@admin_required
def list_users():
    """List all users with advanced filtering, searching, and pagination"""
    try:
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)
        role_filter = request.args.get("role")
        search_query = request.args.get("search", "").strip()
        status_filter = request.args.get("status")  # active, inactive
        sort_by = request.args.get("sort_by", "created_at")
        sort_order = request.args.get("sort_order", "desc")
        date_from = request.args.get("date_from")
        date_to = request.args.get("date_to")

        # Base query
        query = User.query.join(Role)

        # Apply role filter
        if role_filter:
            query = query.filter(Role.name == role_filter)
        
        # Apply search (username, email, first_name, last_name)
        if search_query:
            search_pattern = f"%{search_query}%"
            query = query.filter(
                or_(
                    User.username.ilike(search_pattern),
                    User.email.ilike(search_pattern),
                    User.first_name.ilike(search_pattern),
                    User.last_name.ilike(search_pattern)
                )
            )
        
        # Apply status filter (assuming User has is_active field)
        if status_filter:
            if status_filter == "active":
                query = query.filter(User.is_active == True)
            elif status_filter == "inactive":
                query = query.filter(User.is_active == False)
        
        # Apply date range filter
        if date_from:
            try:
                date_from_obj = datetime.fromisoformat(date_from)
                query = query.filter(User.created_at >= date_from_obj)
            except ValueError:
                pass
        
        if date_to:
            try:
                date_to_obj = datetime.fromisoformat(date_to)
                query = query.filter(User.created_at <= date_to_obj)
            except ValueError:
                pass

        # Apply sorting
        if sort_by == "username":
            order_column = User.username
        elif sort_by == "email":
            order_column = User.email
        elif sort_by == "role":
            order_column = Role.name
        elif sort_by == "created_at":
            order_column = User.created_at
        else:
            order_column = User.created_at
        
        if sort_order == "asc":
            query = query.order_by(order_column.asc())
        else:
            query = query.order_by(order_column.desc())
            
        # Paginate results
        users_pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        users = users_pagination.items
        
        # Get role statistics
        role_stats = db.session.query(
            Role.name,
            func.count(User.id).label('count')
        ).join(User).group_by(Role.name).all()
        
        return jsonify({
            "users": [user.to_dict() for user in users],
            "pagination": {
                "current_page": users_pagination.page,
                "per_page": users_pagination.per_page,
                "total_pages": users_pagination.pages,
                "total_items": users_pagination.total,
                "has_next": users_pagination.has_next,
                "has_prev": users_pagination.has_prev
            },
            "role_statistics": {role: count for role, count in role_stats},
            "filters_applied": {
                "role": role_filter,
                "search": search_query,
                "status": status_filter,
                "date_from": date_from,
                "date_to": date_to
            }
        }), 200
    except Exception as e:
        logger.error(f"Error listing users: {str(e)}")
        return jsonify({"error": "Failed to retrieve users"}), 500

@admin_bp.route("/users/stats", methods=["GET"])
@admin_required
def get_user_stats():
    """Get comprehensive user statistics"""
    try:
        # Total users
        total_users = User.query.count()
        
        # Users by role
        users_by_role = db.session.query(
            Role.name,
            func.count(User.id)
        ).join(User).group_by(Role.name).all()
        
        # Active vs inactive users (if is_active field exists)
        active_users = User.query.filter_by(is_active=True).count() if hasattr(User, 'is_active') else total_users
        
        # New users in last 30 days
        thirty_days_ago = datetime.now() - timedelta(days=30)
        new_users_30d = User.query.filter(User.created_at >= thirty_days_ago).count()
        
        # New users in last 7 days
        seven_days_ago = datetime.now() - timedelta(days=7)
        new_users_7d = User.query.filter(User.created_at >= seven_days_ago).count()
        
        # User growth by month (last 6 months)
        six_months_ago = datetime.now() - timedelta(days=180)
        # Use PostgreSQL-compatible date formatting
        from sqlalchemy.sql import text
        if 'postgresql' in str(db.engine.url):
            # PostgreSQL: use to_char function
            user_growth = db.session.query(
                func.to_char(User.created_at, 'YYYY-MM').label('month'),
                func.count(User.id).label('count')
            ).filter(User.created_at >= six_months_ago).group_by(func.to_char(User.created_at, 'YYYY-MM')).order_by(func.to_char(User.created_at, 'YYYY-MM')).all()
        else:
            # SQLite: use strftime function
            user_growth = db.session.query(
                func.strftime('%Y-%m', User.created_at).label('month'),
                func.count(User.id).label('count')
            ).filter(User.created_at >= six_months_ago).group_by('month').order_by('month').all()
        
        return jsonify({
            "total_users": total_users,
            "active_users": active_users,
            "inactive_users": total_users - active_users,
            "users_by_role": dict(users_by_role),
            "new_users_30d": new_users_30d,
            "new_users_7d": new_users_7d,
            "user_growth": [{"month": month, "count": count} for month, count in user_growth]
        }), 200
    except Exception as e:
        logger.error(f"Error getting user stats: {str(e)}")
        return jsonify({"error": "Failed to retrieve user statistics"}), 500

@admin_bp.route("/users/bulk-action", methods=["POST"])
@admin_required
def bulk_user_action():
    """Perform bulk actions on multiple users with detailed error reporting"""
    try:
        # Import models at function level to ensure scope availability
        from ..models.course_models import AssignmentSubmission
        
        data = request.get_json()
        user_ids = data.get("user_ids", [])
        action = data.get("action")  # activate, deactivate, delete, change_role
        
        # Validation
        if not user_ids:
            return jsonify({"error": "No user IDs provided"}), 400
            
        if not action:
            return jsonify({"error": "No action specified"}), 400
        
        if not isinstance(user_ids, list):
            return jsonify({"error": "user_ids must be an array"}), 400
        
        # Limit bulk operations for safety
        MAX_BULK_USERS = 100
        if len(user_ids) > MAX_BULK_USERS:
            return jsonify({
                "error": f"Cannot process more than {MAX_BULK_USERS} users at once"
            }), 400
        
        # Get current user to prevent self-actions
        current_user_id = get_jwt_identity()
        
        affected_count = 0
        errors = []
        warnings = []
        
        if action == "activate":
            # Check which users exist and are inactive
            users_to_activate = User.query.filter(
                User.id.in_(user_ids),
                User.is_active == False
            ).all()
            
            for user in users_to_activate:
                user.is_active = True
                affected_count += 1
            
            already_active = len(user_ids) - affected_count
            if already_active > 0:
                warnings.append(f"{already_active} user(s) were already active")
            
        elif action == "deactivate":
            # Prevent self-deactivation
            if current_user_id in user_ids:
                return jsonify({"error": "Cannot deactivate your own account"}), 400
            
            # Check which users exist and are active
            users_to_deactivate = User.query.filter(
                User.id.in_(user_ids),
                User.is_active == True
            ).all()
            
            for user in users_to_deactivate:
                user.is_active = False
                affected_count += 1
            
            already_inactive = len(user_ids) - affected_count
            if already_inactive > 0:
                warnings.append(f"{already_inactive} user(s) were already inactive")
            
        elif action == "delete":
            # Prevent self-deletion
            if current_user_id in user_ids:
                return jsonify({"error": "Cannot delete your own account"}), 400
            
            # Handle cascading deletes for each user
            deleted_count = 0
            skipped_count = 0
            
            for user_id in user_ids:
                try:
                    user = User.query.get(user_id)
                    if not user:
                        errors.append(f"User {user_id} not found")
                        continue
                    
                    user_role = user.role.name if user.role else "unknown"
                    
                    # Check if instructor has courses
                    if user_role == "instructor":
                        course_count = Course.query.filter_by(instructor_id=user_id).count()
                        if course_count > 0:
                            errors.append(f"Cannot delete {user.username} - has {course_count} course(s)")
                            skipped_count += 1
                            continue
                    
                    # Delete related records based on role (in dependency order)
                    if user_role == "student":
                        ModuleProgress.query.filter_by(student_id=user_id).delete()
                        LessonCompletion.query.filter_by(student_id=user_id).delete()
                        UserProgress.query.filter_by(user_id=user_id).delete()
                        LearningAnalytics.query.filter_by(student_id=user_id).delete()
                        Submission.query.filter_by(student_id=user_id).delete()
                        StudentNote.query.filter_by(student_id=user_id).delete()
                        StudentBookmark.query.filter_by(student_id=user_id).delete()
                        Certificate.query.filter_by(student_id=user_id).delete()
                        Enrollment.query.filter_by(student_id=user_id).delete()
                        
                        try:
                            from ..models.quiz_progress_models import QuizAttempt
                            QuizAttempt.query.filter_by(user_id=user_id).delete()
                        except ImportError:
                            pass
                            
                        try:
                            from ..models.achievement_models import UserAchievement, LearningStreak
                            UserAchievement.query.filter_by(user_id=user_id).delete()
                            LearningStreak.query.filter_by(user_id=user_id).delete()
                        except ImportError:
                            pass
                    
                    db.session.delete(user)
                    deleted_count += 1
                    
                except Exception as e:
                    errors.append(f"Error deleting user {user_id}: {str(e)}")
                    skipped_count += 1
            
            affected_count = deleted_count
            
            if skipped_count > 0:
                warnings.append(f"{skipped_count} user(s) could not be deleted")
            
            if deleted_count == 0 and errors:
                db.session.rollback()
                return jsonify({
                    "error": "Bulk delete failed - no users were deleted",
                    "details": errors
                }), 400
            
        elif action == "change_role":
            new_role_name = data.get("role_name")
            if not new_role_name:
                return jsonify({"error": "Missing role_name for change_role action"}), 400
            
            role = Role.query.filter_by(name=new_role_name).first()
            if not role:
                available_roles = [r.name for r in Role.query.all()]
                return jsonify({
                    "error": f"Role '{new_role_name}' not found",
                    "available_roles": available_roles
                }), 400
            
            # Prevent changing own role if admin
            current_user = User.query.get(current_user_id)
            if current_user_id in user_ids and current_user.role.name == "admin":
                return jsonify({"error": "Cannot change your own admin role"}), 400
            
            # Clean up orphaned assignment submissions BEFORE making role changes
            # (AssignmentSubmission already imported at function start)
            
            # Use no_autoflush to prevent premature flushing during queries
            with db.session.no_autoflush:
                # First, check and clean up any orphaned submissions
                orphaned_submissions = AssignmentSubmission.query.filter(
                    AssignmentSubmission.student_id.is_(None)
                ).all()
                
                if orphaned_submissions:
                    logger.warning(f"Found {len(orphaned_submissions)} orphaned assignment submissions - removing them")
                    for submission in orphaned_submissions:
                        db.session.delete(submission)
                    warnings.append(f"Cleaned up {len(orphaned_submissions)} orphaned assignment submissions")
            
            # Update roles
            users_to_update = User.query.filter(User.id.in_(user_ids)).all()
            for user in users_to_update:
                if user.role_id != role.id:
                    user.role_id = role.id
                    affected_count += 1
            
            already_role = len(user_ids) - affected_count
            if already_role > 0:
                warnings.append(f"{already_role} user(s) already had this role")
        else:
            return jsonify({
                "error": "Invalid action",
                "valid_actions": ["activate", "deactivate", "delete", "change_role"]
            }), 400
        
        # Commit all changes in a single transaction
        try:
            # Use no_autoflush to prevent SQLAlchemy from auto-flushing during queries
            with db.session.no_autoflush:
                # Final safety check: clean up any orphaned assignment submissions that might have been created
                final_orphaned = AssignmentSubmission.query.filter(
                    AssignmentSubmission.student_id.is_(None)
                ).all()
                
                if final_orphaned:
                    logger.warning(f"Final cleanup: removing {len(final_orphaned)} orphaned assignment submissions")
                    for submission in final_orphaned:
                        db.session.delete(submission)
            
            # Now commit all changes
            db.session.commit()
        except Exception as commit_error:
            db.session.rollback()
            logger.error(f"Error committing bulk action: {str(commit_error)}")
            
            # If there's still a constraint violation, try a direct SQL cleanup
            if "not-null constraint" in str(commit_error) and "assignment_submissions" in str(commit_error):
                logger.warning("Attempting direct SQL cleanup of orphaned assignment submissions")
                try:
                    from sqlalchemy import text
                    # Force delete any problematic records
                    result = db.session.execute(text("DELETE FROM assignment_submissions WHERE student_id IS NULL"))
                    if result.rowcount > 0:
                        logger.info(f"Cleaned up {result.rowcount} orphaned assignment submissions")
                    db.session.commit()
                    
                    # Retry the original operation
                    return jsonify({
                        "error": "Database constraint resolved, please retry the operation",
                        "details": f"Cleaned up {result.rowcount} orphaned assignment submissions"
                    }), 409  # Conflict - client should retry
                except Exception as cleanup_error:
                    logger.error(f"Failed to cleanup orphaned records: {cleanup_error}")
            
            return jsonify({
                "error": "Database operation failed during commit",
                "details": str(commit_error)
            }), 500
        
        response_data = {
            "message": f"Bulk action '{action}' completed successfully",
            "affected_users": affected_count,
            "total_requested": len(user_ids)
        }
        
        if errors:
            response_data["errors"] = errors
        if warnings:
            response_data["warnings"] = warnings
        
        return jsonify(response_data), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in bulk action: {str(e)}", exc_info=True)
        return jsonify({
            "error": "Bulk action failed due to server error",
            "details": str(e)
        }), 500

@admin_bp.route("/users/export", methods=["GET"])
@admin_required
def export_users():
    """Export users data to CSV or JSON format"""
    try:
        export_format = request.args.get("format", "csv")
        role_filter = request.args.get("role")
        search_query = request.args.get("search", "").strip()
        status_filter = request.args.get("status")
        
        # Build query with filters
        query = User.query.join(Role)
        
        if role_filter:
            query = query.filter(Role.name == role_filter)
        
        if search_query:
            search_pattern = f"%{search_query}%"
            query = query.filter(
                or_(
                    User.username.ilike(search_pattern),
                    User.email.ilike(search_pattern),
                    User.first_name.ilike(search_pattern),
                    User.last_name.ilike(search_pattern)
                )
            )
        
        if status_filter:
            if status_filter == "active":
                query = query.filter(User.is_active == True)
            elif status_filter == "inactive":
                query = query.filter(User.is_active == False)
        
        users = query.all()
        
        if export_format == "csv":
            # Create CSV
            output = StringIO()
            writer = csv.writer(output)
            
            # Write header
            writer.writerow([
                'ID', 'Username', 'Email', 'First Name', 'Last Name', 
                'Role', 'Status', 'Created At', 'Last Login'
            ])
            
            # Write data
            for user in users:
                writer.writerow([
                    user.id,
                    user.username,
                    user.email,
                    user.first_name or '',
                    user.last_name or '',
                    user.role.name if user.role else '',
                    'Active' if user.is_active else 'Inactive',
                    user.created_at.strftime('%Y-%m-%d %H:%M:%S') if user.created_at else '',
                    user.last_login.strftime('%Y-%m-%d %H:%M:%S') if hasattr(user, 'last_login') and user.last_login else 'Never'
                ])
            
            response = make_response(output.getvalue())
            response.headers['Content-Type'] = 'text/csv'
            response.headers['Content-Disposition'] = f'attachment; filename=users_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            return response
            
        elif export_format == "json":
            # Create JSON
            users_data = []
            for user in users:
                users_data.append({
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'role': user.role.name if user.role else None,
                    'is_active': user.is_active,
                    'created_at': user.created_at.isoformat() if user.created_at else None,
                    'last_login': user.last_login.isoformat() if hasattr(user, 'last_login') and user.last_login else None
                })
            
            response = make_response(json.dumps(users_data, indent=2))
            response.headers['Content-Type'] = 'application/json'
            response.headers['Content-Disposition'] = f'attachment; filename=users_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            return response
        else:
            return jsonify({"error": "Invalid format. Use 'csv' or 'json'"}), 400
            
    except Exception as e:
        logger.error(f"Error exporting users: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to export users"}), 500

@admin_bp.route("/users", methods=["POST"])
@admin_required
def create_user_admin():
    """Create a new user with validation and duplicate checking"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ["username", "email", "password", "role_name"]
        missing_fields = [field for field in required_fields if not data.get(field)]
        if missing_fields:
            return jsonify({
                "error": f"Missing required fields: {', '.join(missing_fields)}"
            }), 400

        # Check for duplicates
        if User.query.filter_by(username=data["username"]).first():
            return jsonify({"error": "Username already exists"}), 409
        if User.query.filter_by(email=data["email"]).first():
            return jsonify({"error": "Email already exists"}), 409

        # Validate role
        role = Role.query.filter_by(name=data["role_name"]).first()
        if not role:
            available_roles = [r.name for r in Role.query.all()]
            return jsonify({
                "error": f"Role '{data['role_name']}' not found", 
                "available_roles": available_roles
            }), 400

        # Create new user
        new_user = User(
            username=data["username"],
            email=data["email"],
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", ""),
            bio=data.get("bio", ""),
            phone_number=data.get("phone_number"),
            role_id=role.id,
            is_active=data.get("is_active", True)
        )
        new_user.set_password(data["password"])
        
        db.session.add(new_user)
        db.session.commit()
        
        logger.info(f"New user created: {new_user.username} (ID: {new_user.id})")
        
        return jsonify({
            "message": "User created successfully", 
            "user": new_user.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating user: {str(e)}")
        return jsonify({"error": "Failed to create user"}), 500

@admin_bp.route("/users/<int:user_id>", methods=["GET"])
@admin_required
def get_user_admin(user_id):
    """Get detailed user information including statistics"""
    try:
        user = User.query.get_or_404(user_id)
        user_dict = user.to_dict()
        
        # Add additional statistics
        if user.role.name == "student":
            # Student-specific stats
            enrollments = Enrollment.query.filter_by(student_id=user_id).count()
            completed_lessons = LessonCompletion.query.filter_by(student_id=user_id).count()
            submissions = Submission.query.filter_by(student_id=user_id).count()
            
            user_dict["statistics"] = {
                "enrollments": enrollments,
                "completed_lessons": completed_lessons,
                "quiz_submissions": submissions
            }
        elif user.role.name == "instructor":
            # Instructor-specific stats
            courses_taught = Course.query.filter_by(instructor_id=user_id).count()
            total_students = db.session.query(func.count(Enrollment.id)).join(
                Course, Course.id == Enrollment.course_id
            ).filter(Course.instructor_id == user_id).scalar()
            
            user_dict["statistics"] = {
                "courses_taught": courses_taught,
                "total_students": total_students or 0
            }
        
        return jsonify(user_dict), 200
    except Exception as e:
        logger.error(f"Error getting user {user_id}: {str(e)}")
        return jsonify({"error": "Failed to retrieve user"}), 500

@admin_bp.route("/users/<int:user_id>", methods=["PUT"])
@admin_required
def update_user_admin(user_id):
    """Update user information with comprehensive validation"""
    try:
        user = User.query.get_or_404(user_id)
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Update username with duplicate check
        if "username" in data and data["username"] != user.username:
            if User.query.filter_by(username=data["username"]).first():
                return jsonify({"error": "Username already exists"}), 409
            user.username = data["username"]
        
        # Update email with duplicate check
        if "email" in data and data["email"] != user.email:
            if User.query.filter_by(email=data["email"]).first():
                return jsonify({"error": "Email already exists"}), 409
            user.email = data["email"]

        # Update basic fields
        updatable_fields = ["first_name", "last_name", "bio", "profile_picture_url", "phone_number", "is_active"]
        for field in updatable_fields:
            if field in data:
                setattr(user, field, data[field])

        # Update role with validation
        if "role_name" in data:
            role = Role.query.filter_by(name=data["role_name"]).first()
            if not role:
                available_roles = [r.name for r in Role.query.all()]
                return jsonify({
                    "error": f"Role '{data['role_name']}' not found",
                    "available_roles": available_roles
                }), 400
            user.role_id = role.id

        # Update password if provided
        if "password" in data and data["password"]:
            user.set_password(data["password"])
            
        user.updated_at = func.now()
        db.session.commit()
        
        logger.info(f"User updated: {user.username} (ID: {user.id})")
        
        return jsonify({
            "message": "User updated successfully", 
            "user": user.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating user {user_id}: {str(e)}")
        return jsonify({"error": "Failed to update user"}), 500

@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@admin_required
def delete_user_admin(user_id):
    """Delete a user with proper cascade handling"""
    try:
        user = User.query.get_or_404(user_id)
        
        # Prevent self-deletion
        current_user_id = get_jwt_identity()
        if user_id == current_user_id:
            return jsonify({"error": "Cannot delete your own account"}), 400
        
        username = user.username
        user_role = user.role.name
        
        # Delete related records based on user role to prevent constraint violations
        if user_role == "student":
            # Delete student-specific data (in dependency order)
            # 1. Delete progress and completion records first
            ModuleProgress.query.filter_by(student_id=user_id).delete()
            LessonCompletion.query.filter_by(student_id=user_id).delete()
            UserProgress.query.filter_by(user_id=user_id).delete()  # Uses user_id
            LearningAnalytics.query.filter_by(student_id=user_id).delete()
            
            # 2. Delete submissions and assessments
            Submission.query.filter_by(student_id=user_id).delete()
            
            # 3. Delete student content
            StudentNote.query.filter_by(student_id=user_id).delete()
            StudentBookmark.query.filter_by(student_id=user_id).delete()
            Certificate.query.filter_by(student_id=user_id).delete()
            
            # 4. Delete enrollments last (other tables may reference it)
            Enrollment.query.filter_by(student_id=user_id).delete()
            
            # 5. Delete quiz attempts if model exists
            try:
                from ..models.quiz_progress_models import QuizAttempt
                QuizAttempt.query.filter_by(user_id=user_id).delete()  # Uses user_id
            except ImportError:
                pass
                
            # 6. Delete achievement/gamification data if models exist
            try:
                from ..models.achievement_models import UserAchievement, LearningStreak
                UserAchievement.query.filter_by(user_id=user_id).delete()
                LearningStreak.query.filter_by(user_id=user_id).delete()
            except ImportError:
                pass
                
        elif user_role == "instructor":
            # For instructors, we need to handle courses they created
            # Option 1: Prevent deletion if they have courses
            course_count = Course.query.filter_by(instructor_id=user_id).count()
            if course_count > 0:
                return jsonify({
                    "error": f"Cannot delete instructor with {course_count} active course(s). Please reassign or delete courses first."
                }), 400
        
        # Delete the user
        db.session.delete(user)
        db.session.commit()
        
        logger.info(f"User deleted: {username} (ID: {user_id}, Role: {user_role})")
        
        return jsonify({
            "message": f"User '{username}' and all related data deleted successfully"
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting user {user_id}: {str(e)}")
        return jsonify({
            "error": "Failed to delete user",
            "details": str(e)
        }), 500

@admin_bp.route("/users/<int:user_id>/activity", methods=["GET"])
@admin_required
def get_user_activity(user_id):
    """Get detailed activity history for a user"""
    try:
        user = User.query.get_or_404(user_id)
        
        activity = {
            "user_id": user_id,
            "username": user.username,
            "role": user.role.name,
            "activities": []
        }
        
        if user.role.name == "student":
            # Recent enrollments
            enrollments = Enrollment.query.filter_by(student_id=user_id).order_by(
                Enrollment.enrollment_date.desc()
            ).limit(10).all()
            
            for enrollment in enrollments:
                activity["activities"].append({
                    "type": "enrollment",
                    "course_title": enrollment.course.title,
                    "date": enrollment.enrollment_date.isoformat(),
                    "status": enrollment.status if hasattr(enrollment, 'status') else 'active'
                })
            
            # Recent quiz submissions
            submissions = Submission.query.filter_by(student_id=user_id).order_by(
                Submission.submission_date.desc()
            ).limit(10).all()
            
            for submission in submissions:
                activity["activities"].append({
                    "type": "quiz_submission",
                    "quiz_title": submission.quiz.title if submission.quiz else "Unknown Quiz",
                    "score": submission.score,
                    "date": submission.submission_date.isoformat()
                })
        
        elif user.role.name == "instructor":
            # Recent courses created
            courses = Course.query.filter_by(instructor_id=user_id).order_by(
                Course.created_at.desc()
            ).limit(10).all()
            
            for course in courses:
                activity["activities"].append({
                    "type": "course_created",
                    "course_title": course.title,
                    "date": course.created_at.isoformat(),
                    "published": course.is_published if hasattr(course, 'is_published') else True
                })
        
        # Sort activities by date
        activity["activities"].sort(key=lambda x: x["date"], reverse=True)
        
        return jsonify(activity), 200
    except Exception as e:
        logger.error(f"Error getting activity for user {user_id}: {str(e)}")
        return jsonify({"error": "Failed to retrieve user activity"}), 500

# --- Course Management API Routes (Admin-Specific) ---
@admin_bp.route("/courses", methods=["GET"])
@admin_required
def list_courses_admin():
    # This might reuse/extend existing course listing if it has enough filters
    # For now, a simple list for admin
    courses = Course.query.all()
    return jsonify([course.to_dict() for course in courses]), 200 # Assuming Course model has to_dict()

@admin_bp.route("/courses", methods=["POST"])
@admin_required
def create_course_admin():
    data = request.get_json()
    # Add comprehensive validation for course creation fields
    if not data or not data.get("title") or not data.get("instructor_id"):
        return jsonify({"error": "Missing required fields (title, instructor_id)"}), 400
    
    instructor = User.query.get(data["instructor_id"])
    if not instructor or instructor.role.name.lower() != AppRoles.INSTRUCTOR:
        return jsonify({"error": "Invalid instructor ID or user is not an instructor"}), 400

    new_course = Course(
        title=data["title"],
        description=data.get("description", ""),
        instructor_id=data["instructor_id"],
        category_id=data.get("category_id"), # Assuming Category model and relationship
        # ... other fields like price, level, etc.
    )
    db.session.add(new_course)
    db.session.commit()
    return jsonify({"message": "Course created successfully", "course": new_course.to_dict()}), 201

@admin_bp.route("/courses/<int:course_id>", methods=["PUT"])
@admin_required
def update_course_admin(course_id):
    course = Course.query.get_or_404(course_id)
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Update course fields
    if "title" in data: course.title = data["title"]
    if "description" in data: course.description = data["description"]
    if "instructor_id" in data:
        instructor = User.query.get(data["instructor_id"])
        if not instructor or instructor.role.name.lower() != AppRoles.INSTRUCTOR:
            return jsonify({"error": "Invalid instructor ID or user is not an instructor"}), 400
        course.instructor_id = data["instructor_id"]
    if "category_id" in data: course.category_id = data["category_id"]
    # ... update other fields
    
    course.updated_at = db.func.now()
    db.session.commit()
    return jsonify({"message": "Course updated successfully", "course": course.to_dict()}), 200

@admin_bp.route("/courses/<int:course_id>", methods=["DELETE"])
@admin_required
def delete_course_admin(course_id):
    course = Course.query.get_or_404(course_id)
    # Consider implications: enrollments, content, etc. Maybe soft delete or archive.
    db.session.delete(course)
    db.session.commit()
    return jsonify({"message": "Course deleted successfully"}), 200

# --- Opportunity Management API Routes (Admin-Specific) ---
@admin_bp.route("/opportunities", methods=["GET"])
@admin_required
def list_opportunities_admin():
    opportunities = Opportunity.query.all()
    return jsonify([opp.to_dict() for opp in opportunities]), 200 # Assuming Opportunity model has to_dict()

@admin_bp.route("/opportunities", methods=["POST"])
@admin_required
def create_opportunity_admin():
    data = request.get_json()
    if not data or not data.get("title") or not data.get("description"):
        return jsonify({"error": "Missing required fields (title, description)"}), 400
    
    new_opportunity = Opportunity(
        title=data["title"],
        description=data["description"],
        company_name=data.get("company_name"),
        location=data.get("location"),
        opportunity_type=data.get("opportunity_type"), # e.g., internship, job, scholarship
        application_deadline=data.get("application_deadline"),
        application_link=data.get("application_link")
        # ... other fields
    )
    db.session.add(new_opportunity)
    db.session.commit()
    return jsonify({"message": "Opportunity created successfully", "opportunity": new_opportunity.to_dict()}), 201

@admin_bp.route("/opportunities/<int:opportunity_id>", methods=["PUT"])
@admin_required
def update_opportunity_admin(opportunity_id):
    opportunity = Opportunity.query.get_or_404(opportunity_id)
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Update opportunity fields
    for key, value in data.items():
        if hasattr(opportunity, key):
            setattr(opportunity, key, value)
            
    opportunity.updated_at = db.func.now() # Assuming Opportunity model has updated_at
    db.session.commit()
    return jsonify({"message": "Opportunity updated successfully", "opportunity": opportunity.to_dict()}), 200

@admin_bp.route("/opportunities/<int:opportunity_id>", methods=["DELETE"])
@admin_required
def delete_opportunity_admin(opportunity_id):
    opportunity = Opportunity.query.get_or_404(opportunity_id)
    db.session.delete(opportunity)
    db.session.commit()
    return jsonify({"message": "Opportunity deleted successfully"}), 200

# --- System Statistics and Dashboard ---
@admin_bp.route("/stats", methods=["GET"])
@admin_required
def get_system_stats():
    """Get comprehensive system statistics for admin dashboard"""
    try:
        # User statistics
        total_users = User.query.count()
        active_users = User.query.filter_by(is_active=True).count() if hasattr(User, 'is_active') else total_users
        
        # Role breakdown
        users_by_role = db.session.query(
            Role.name,
            func.count(User.id)
        ).join(User).group_by(Role.name).all()
        
        # Course statistics
        total_courses = Course.query.count()
        published_courses = Course.query.filter_by(is_published=True).count() if hasattr(Course, 'is_published') else total_courses
        
        # Enrollment statistics
        total_enrollments = Enrollment.query.count()
        
        # Opportunity statistics
        total_opportunities = Opportunity.query.count()
        
        # Quiz statistics
        active_quizzes = Quiz.query.filter_by(is_published=True).count() if hasattr(Quiz, 'is_published') else Quiz.query.count()
        
        # Recent activity (last 10 activities)
        recent_activity = []
        
        # Get recent user registrations
        recent_users = User.query.order_by(User.created_at.desc()).limit(5).all()
        for user in recent_users:
            recent_activity.append({
                "type": "user_registration",
                "description": f"New user registered: {user.username}",
                "timestamp": user.created_at.isoformat(),
                "user": user.username,
                "role": user.role.name
            })
        
        # Get recent enrollments
        recent_enrollments = Enrollment.query.order_by(Enrollment.enrollment_date.desc()).limit(5).all()
        for enrollment in recent_enrollments:
            recent_activity.append({
                "type": "enrollment",
                "description": f"{enrollment.student.username} enrolled in {enrollment.course.title}",
                "timestamp": enrollment.enrollment_date.isoformat(),
                "user": enrollment.student.username,
                "course": enrollment.course.title
            })
        
        # Sort by timestamp
        recent_activity.sort(key=lambda x: x["timestamp"], reverse=True)
        recent_activity = recent_activity[:10]
        
        return jsonify({
            "total_users": total_users,
            "active_users": active_users,
            "users_by_role": dict(users_by_role),
            "total_courses": total_courses,
            "published_courses": published_courses,
            "total_enrollments": total_enrollments,
            "total_opportunities": total_opportunities,
            "active_quizzes": active_quizzes,
            "recent_activity": recent_activity
        }), 200
    except Exception as e:
        logger.error(f"Error getting system stats: {str(e)}")
        return jsonify({"error": "Failed to retrieve system statistics"}), 500

@admin_bp.route("/roles", methods=["GET"])
@admin_required
def get_roles():
    """Get all available roles"""
    try:
        roles = Role.query.all()
        return jsonify({
            "roles": [{"id": role.id, "name": role.name} for role in roles]
        }), 200
    except Exception as e:
        logger.error(f"Error getting roles: {str(e)}")
        return jsonify({"error": "Failed to retrieve roles"}), 500

# --- User Inactivity and Auto-Deletion Management ---

@admin_bp.route("/users/inactive", methods=["GET"])
@admin_required
def get_inactive_users():
    """Get users who are inactive for potential auto-deletion"""
    try:
        from ..services.inactivity_service import InactivityService
        
        # Get query parameters
        threshold_days = request.args.get('threshold_days', 14, type=int)
        role_filter = request.args.get('role')
        
        # Get inactive users
        inactive_users = InactivityService.get_inactive_users(threshold_days=threshold_days)
        
        # Filter by role if specified
        if role_filter:
            inactive_users = [u for u in inactive_users if u['role'] == role_filter]
        
        # Group by role for better organization
        users_by_role = {}
        for user in inactive_users:
            role = user['role']
            if role not in users_by_role:
                users_by_role[role] = []
            users_by_role[role].append(user)
        
        return jsonify({
            "success": True,
            "inactive_users": inactive_users,
            "users_by_role": users_by_role,
            "threshold_days": threshold_days,
            "total_count": len(inactive_users)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting inactive users: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to fetch inactive users",
            "error": str(e)
        }), 500

@admin_bp.route("/users/inactivity-analysis", methods=["GET"])
@admin_required
def get_inactivity_analysis():
    """Get comprehensive analysis of user inactivity across the platform"""
    try:
        from ..services.inactivity_service import InactivityService
        
        # Get inactive users for different thresholds
        seven_day_inactive = InactivityService.get_inactive_users(threshold_days=7)
        fourteen_day_inactive = InactivityService.get_inactive_users(threshold_days=14)
        thirty_day_inactive = InactivityService.get_inactive_users(threshold_days=30)
        
        # Get total users by role
        total_users = User.query.filter_by(is_active=True).count()
        users_by_role = db.session.query(
            Role.name, func.count(User.id)
        ).join(User).filter(User.is_active == True).group_by(Role.name).all()
        users_by_role = dict(users_by_role)
        
        # Calculate inactivity rates
        inactivity_rates = {
            "7_days": {
                "count": len(seven_day_inactive),
                "rate": (len(seven_day_inactive) / total_users * 100) if total_users > 0 else 0
            },
            "14_days": {
                "count": len(fourteen_day_inactive),
                "rate": (len(fourteen_day_inactive) / total_users * 100) if total_users > 0 else 0
            },
            "30_days": {
                "count": len(thirty_day_inactive),
                "rate": (len(thirty_day_inactive) / total_users * 100) if total_users > 0 else 0
            }
        }
        
        # Group by role for 14-day threshold (deletion candidates)
        deletion_candidates_by_role = {}
        for user in fourteen_day_inactive:
            role = user['role']
            if role not in deletion_candidates_by_role:
                deletion_candidates_by_role[role] = {
                    'count': 0,
                    'users': []
                }
            deletion_candidates_by_role[role]['count'] += 1
            deletion_candidates_by_role[role]['users'].append(user)
        
        # Generate recommendations
        recommendations = []
        if len(fourteen_day_inactive) > 0:
            recommendations.append({
                'type': 'warning',
                'title': 'Users Ready for Auto-Deletion',
                'message': f'{len(fourteen_day_inactive)} users have been inactive for 14+ days',
                'action': 'Review and approve for auto-deletion'
            })
        
        if len(seven_day_inactive) > len(fourteen_day_inactive):
            approaching_deletion = len(seven_day_inactive) - len(fourteen_day_inactive)
            recommendations.append({
                'type': 'info',
                'title': 'Users Approaching Deletion Threshold',
                'message': f'{approaching_deletion} users will be eligible for deletion in 7 days',
                'action': 'Consider sending reactivation reminders'
            })
        
        if inactivity_rates["14_days"]["rate"] > 20:
            recommendations.append({
                'type': 'urgent',
                'title': 'High Platform Inactivity',
                'message': 'More than 20% of users are inactive for 14+ days',
                'action': 'Review user engagement strategies and platform usability'
            })
        
        analysis = {
            "total_active_users": total_users,
            "users_by_role": users_by_role,
            "inactivity_rates": inactivity_rates,
            "deletion_candidates": deletion_candidates_by_role,
            "recommendations": recommendations,
            "last_updated": datetime.utcnow().isoformat()
        }
        
        return jsonify({
            "success": True,
            "analysis": analysis
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating inactivity analysis: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to generate inactivity analysis",
            "error": str(e)
        }), 500

@admin_bp.route("/users/<int:user_id>/auto-delete", methods=["POST"])
@admin_required
def auto_delete_user(user_id):
    """Auto-delete an inactive user"""
    try:
        current_user_id = int(get_jwt_identity())
        
        from ..services.inactivity_service import InactivityService
        
        # Auto-delete user
        result = InactivityService.auto_delete_inactive_user(
            user_id=user_id,
            admin_id=current_user_id
        )
        
        if result['success']:
            return jsonify({
                "success": True,
                "message": result['message'],
                "user_info": result['user_info']
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": result['message']
            }), 400
            
    except Exception as e:
        logger.error(f"Error auto-deleting user {user_id}: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to auto-delete user",
            "error": str(e)
        }), 500

@admin_bp.route("/users/bulk-auto-delete", methods=["POST"])
@admin_required
def bulk_auto_delete_users():
    """Auto-delete multiple inactive users"""
    try:
        current_user_id = int(get_jwt_identity())
        
        data = request.get_json() or {}
        user_ids = data.get('user_ids', [])
        
        if not user_ids:
            return jsonify({
                "success": False,
                "message": "No user IDs provided"
            }), 400
        
        from ..services.inactivity_service import InactivityService
        
        results = {
            "successful": [],
            "failed": [],
            "total_requested": len(user_ids)
        }
        
        for user_id in user_ids:
            result = InactivityService.auto_delete_inactive_user(
                user_id=user_id,
                admin_id=current_user_id
            )
            
            if result['success']:
                results["successful"].append({
                    "user_id": user_id,
                    "user_info": result['user_info']
                })
            else:
                results["failed"].append({
                    "user_id": user_id,
                    "error": result['message']
                })
        
        return jsonify({
            "success": True,
            "message": f"Processed {len(user_ids)} users for auto-deletion",
            "results": results
        }), 200
        
    except Exception as e:
        logger.error(f"Error bulk auto-deleting users: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to bulk auto-delete users",
            "error": str(e)
        }), 500

@admin_bp.route("/system/cleanup-inactive", methods=["POST"])
@admin_required
def run_system_cleanup():
    """Run automated cleanup of inactive users and students"""
    try:
        current_user_id = int(get_jwt_identity())
        
        data = request.get_json() or {}
        dry_run = data.get('dry_run', False)  # If true, only simulate cleanup
        user_threshold_days = data.get('user_threshold_days', 14)
        student_threshold_days = data.get('student_threshold_days', 7)
        
        from ..services.inactivity_service import InactivityService
        
        # Get cleanup candidates
        inactive_users = InactivityService.get_inactive_users(threshold_days=user_threshold_days)
        
        # Filter out admin accounts for safety
        inactive_users = [u for u in inactive_users if u['role'] != 'admin']
        
        # Get inactive students across all instructors
        inactive_students = InactivityService.get_inactive_students(
            threshold_days=student_threshold_days
        )
        
        cleanup_summary = {
            "dry_run": dry_run,
            "user_threshold_days": user_threshold_days,
            "student_threshold_days": student_threshold_days,
            "users_for_deletion": len(inactive_users),
            "students_for_termination": len(inactive_students),
            "executed_at": datetime.utcnow().isoformat()
        }
        
        if dry_run:
            cleanup_summary["note"] = "This was a dry run - no actual changes were made"
            cleanup_summary["inactive_users_preview"] = inactive_users[:5]  # Show first 5
            cleanup_summary["inactive_students_preview"] = inactive_students[:5]  # Show first 5
        else:
            # Execute actual cleanup
            deletion_results = {
                "successful": 0,
                "failed": 0,
                "errors": []
            }
            
            termination_results = {
                "successful": 0,
                "failed": 0,
                "errors": []
            }
            
            # Delete inactive users
            for user in inactive_users:
                result = InactivityService.auto_delete_inactive_user(
                    user_id=user['user_id'],
                    admin_id=current_user_id
                )
                
                if result['success']:
                    deletion_results["successful"] += 1
                else:
                    deletion_results["failed"] += 1
                    deletion_results["errors"].append({
                        "user_id": user['user_id'],
                        "error": result['message']
                    })
            
            # Note: Student termination would typically be done per instructor
            # For system-wide cleanup, we'll just log the candidates
            cleanup_summary["deletion_results"] = deletion_results
            cleanup_summary["student_termination_note"] = f"Found {len(inactive_students)} inactive students - termination should be done by individual instructors"
        
        return jsonify({
            "success": True,
            "message": "System cleanup completed successfully" if not dry_run else "System cleanup simulation completed",
            "cleanup_summary": cleanup_summary
        }), 200
        
    except Exception as e:
        logger.error(f"Error running system cleanup: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to run system cleanup",
            "error": str(e)
        }), 500

@admin_bp.route("/system/background-tasks", methods=["GET"])
@admin_required
def get_background_task_status():
    """Get status of background tasks and scheduler"""
    try:
        from ..services.scheduler_service import get_scheduler
        
        scheduler = get_scheduler()
        
        return jsonify({
            "success": True,
            "scheduler_running": scheduler.running,
            "available_tasks": [
                "daily_cleanup",
                "weekly_cleanup", 
                "send_warnings",
                "update_stats"
            ],
            "schedule_info": {
                "daily_cleanup": "Daily at 2:00 AM",
                "weekly_cleanup": "Sundays at 3:00 AM",
                "send_warnings": "Every 3 days at 10:00 AM",
                "update_stats": "Every 6 hours"
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting background task status: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to get background task status",
            "error": str(e)
        }), 500

@admin_bp.route("/system/run-task", methods=["POST"])
@admin_required
def run_background_task():
    """Manually run a background task"""
    try:
        data = request.get_json() or {}
        task_name = data.get('task_name')
        
        if not task_name:
            return jsonify({
                "success": False,
                "message": "Task name is required"
            }), 400
        
        from ..services.scheduler_service import get_scheduler
        
        scheduler = get_scheduler()
        success = scheduler.run_task_now(task_name)
        
        if success:
            return jsonify({
                "success": True,
                "message": f"Task '{task_name}' executed successfully"
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": f"Failed to execute task '{task_name}'"
            }), 400
            
    except Exception as e:
        logger.error(f"Error running background task: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to run background task",
            "error": str(e)
        }), 500

