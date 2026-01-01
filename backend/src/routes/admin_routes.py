# admin_routes.py

from flask import Blueprint, request, jsonify
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
    """Perform bulk actions on multiple users"""
    try:
        data = request.get_json()
        user_ids = data.get("user_ids", [])
        action = data.get("action")  # activate, deactivate, delete, change_role
        
        if not user_ids or not action:
            return jsonify({"error": "Missing user_ids or action"}), 400
        
        affected_count = 0
        
        if action == "activate":
            User.query.filter(User.id.in_(user_ids)).update(
                {User.is_active: True}, 
                synchronize_session=False
            )
            affected_count = len(user_ids)
            
        elif action == "deactivate":
            User.query.filter(User.id.in_(user_ids)).update(
                {User.is_active: False}, 
                synchronize_session=False
            )
            affected_count = len(user_ids)
            
        elif action == "delete":
            # Prevent self-deletion in bulk operations
            current_user_id = get_jwt_identity()
            if current_user_id in user_ids:
                return jsonify({"error": "Cannot delete your own account"}), 400
            
            # Handle cascading deletes for each user
            deleted_count = 0
            errors = []
            
            for user_id in user_ids:
                try:
                    user = User.query.get(user_id)
                    if not user:
                        errors.append(f"User {user_id} not found")
                        continue
                    
                    user_role = user.role.name
                    
                    # Delete related records based on role (in dependency order)
                    if user_role == "student":
                        ModuleProgress.query.filter_by(student_id=user_id).delete()
                        LessonCompletion.query.filter_by(student_id=user_id).delete()
                        UserProgress.query.filter_by(user_id=user_id).delete()  # Uses user_id
                        LearningAnalytics.query.filter_by(student_id=user_id).delete()
                        Submission.query.filter_by(student_id=user_id).delete()
                        StudentNote.query.filter_by(student_id=user_id).delete()
                        StudentBookmark.query.filter_by(student_id=user_id).delete()
                        Certificate.query.filter_by(student_id=user_id).delete()
                        Enrollment.query.filter_by(student_id=user_id).delete()
                        
                        try:
                            from ..models.quiz_progress_models import QuizAttempt
                            QuizAttempt.query.filter_by(user_id=user_id).delete()  # Uses user_id
                        except ImportError:
                            pass
                            
                        try:
                            from ..models.achievement_models import UserAchievement, LearningStreak
                            UserAchievement.query.filter_by(user_id=user_id).delete()
                            LearningStreak.query.filter_by(user_id=user_id).delete()
                        except ImportError:
                            pass
                            
                    elif user_role == "instructor":
                        course_count = Course.query.filter_by(instructor_id=user_id).count()
                        if course_count > 0:
                            errors.append(f"User {user_id} ({user.username}) has {course_count} courses")
                            continue
                    
                    db.session.delete(user)
                    deleted_count += 1
                    
                except Exception as e:
                    errors.append(f"User {user_id}: {str(e)}")
            
            affected_count = deleted_count
            
            if errors:
                logger.warning(f"Bulk delete completed with errors: {errors}")
                if deleted_count == 0:
                    db.session.rollback()
                    return jsonify({
                        "error": "Bulk delete failed",
                        "details": errors
                    }), 400
            
        elif action == "change_role":
            new_role_name = data.get("role_name")
            if not new_role_name:
                return jsonify({"error": "Missing role_name for change_role action"}), 400
            
            role = Role.query.filter_by(name=new_role_name).first()
            if not role:
                return jsonify({"error": f"Role '{new_role_name}' not found"}), 400
            
            User.query.filter(User.id.in_(user_ids)).update(
                {User.role_id: role.id}, 
                synchronize_session=False
            )
            affected_count = len(user_ids)
        else:
            return jsonify({"error": "Invalid action"}), 400
        
        db.session.commit()
        
        return jsonify({
            "message": f"Bulk action '{action}' completed successfully",
            "affected_users": affected_count
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in bulk action: {str(e)}")
        return jsonify({"error": "Bulk action failed"}), 500

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

