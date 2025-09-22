# admin_routes.py

from flask import Blueprint, request, jsonify
from functools import wraps
from .. import db # Assuming db is initialized in src/__init__.py or main.py
from ..models.user_models import User, Role # Assuming UserRoleEnum is part of user_models or defined here
from ..models.course_models import Course # Assuming Course model is defined
from ..models.opportunity_models import Opportunity # Assuming Opportunity model is defined

# If UserRoleEnum is not directly in user_models.py, define or import it
# For this example, let's assume it's defined in user_models.py or accessible
# from ..models.user_models import UserRoleEnum # This might cause circular import if Role refers to UserRoleEnum

# A simple way to define roles if not using a complex Enum structure from the model directly for checks
class AppRoles:
    ADMIN = "admin" # This should match the string stored in Role.name or User.role.name
    INSTRUCTOR = "instructor"
    STUDENT = "student"

admin_bp = Blueprint("admin_api", __name__, url_prefix="/api/admin")

# --- Authorization Decorator ---
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # This is a placeholder for actual authentication and current_user retrieval
        # In a real app, you would get current_user from Flask-Login or a JWT token
        # For now, let's assume a header "X-User-Id" is sent and we fetch the user by that ID.
        user_id = request.headers.get("X-User-Id")
        if not user_id:
            return jsonify({"error": "Authentication required"}), 401
        
        current_user = User.query.get(user_id)
        if not current_user:
            return jsonify({"error": "User not found"}), 401
        
        # Check if the user has the 'admin' role
        # This assumes User model has a `role` relationship pointing to the Role model
        # and Role model has a `name` attribute (e.g., "admin")
        if not current_user.role or current_user.role.name.lower() != AppRoles.ADMIN:
            return jsonify({"error": "Admin privileges required"}), 403
        
        return f(*args, **kwargs)
    return decorated_function

# --- User Management API Routes ---
@admin_bp.route("/users", methods=["GET"])
@admin_required
def list_users():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 10, type=int)
    role_filter = request.args.get("role")

    query = User.query
    if role_filter:
        # Assuming role_filter is the name of the role, e.g., "student"
        role_obj = Role.query.filter_by(name=role_filter).first()
        if role_obj:
            query = query.filter_by(role_id=role_obj.id)
        else:
            return jsonify({"error": f"Role \'{role_filter}\' not found"}), 400
            
    users_pagination = query.order_by(User.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    users = users_pagination.items
    return jsonify({
        "users": [user.to_dict() for user in users],
        "total_pages": users_pagination.pages,
        "current_page": users_pagination.page,
        "total_users": users_pagination.total
    }), 200

@admin_bp.route("/users", methods=["POST"])
@admin_required
def create_user_admin():
    data = request.get_json()
    if not data or not data.get("username") or not data.get("email") or not data.get("password") or not data.get("role_name"):
        return jsonify({"error": "Missing required fields (username, email, password, role_name)"}), 400

    if User.query.filter_by(username=data["username"]).first():
        return jsonify({"error": "Username already exists"}), 409
    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Email already exists"}), 409

    role = Role.query.filter_by(name=data["role_name"]).first()
    if not role:
        return jsonify({"error": f"Role \'{data['role_name']}\' not found. Valid roles might be 'admin', 'instructor', 'student'."}), 400

    new_user = User(
        username=data["username"],
        email=data["email"],
        first_name=data.get("first_name"),
        last_name=data.get("last_name"),
        role_id=role.id
    )
    new_user.set_password(data["password"])
    
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "User created successfully", "user": new_user.to_dict()}), 201

@admin_bp.route("/users/<int:user_id>", methods=["GET"])
@admin_required
def get_user_admin(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict()), 200

@admin_bp.route("/users/<int:user_id>", methods=["PUT"])
@admin_required
def update_user_admin(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    if "username" in data and data["username"] != user.username:
        if User.query.filter_by(username=data["username"]).first():
            return jsonify({"error": "Username already exists"}), 409
        user.username = data["username"]
    
    if "email" in data and data["email"] != user.email:
        if User.query.filter_by(email=data["email"]).first():
            return jsonify({"error": "Email already exists"}), 409
        user.email = data["email"]

    if "first_name" in data:
        user.first_name = data["first_name"]
    if "last_name" in data:
        user.last_name = data["last_name"]
    if "bio" in data:
        user.bio = data["bio"]
    if "profile_picture_url" in data:
        user.profile_picture_url = data["profile_picture_url"]

    if "role_name" in data:
        role = Role.query.filter_by(name=data["role_name"]).first()
        if not role:
            return jsonify({"error": f"Role \'{data['role_name']}\' not found"}), 400
        user.role_id = role.id

    if "password" in data and data["password"]:
        user.set_password(data["password"])
        
    user.updated_at = db.func.now()
    db.session.commit()
    return jsonify({"message": "User updated successfully", "user": user.to_dict()}), 200

@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@admin_required
def delete_user_admin(user_id):
    user = User.query.get_or_404(user_id)
    # Consider soft delete: user.is_active = False or similar
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "User deleted successfully"}), 200

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

# --- Analytics and Site Settings (Placeholders) ---
@admin_bp.route("/analytics/users", methods=["GET"])
@admin_required
def get_user_analytics():
    # Placeholder: Implement logic to gather user statistics
    total_users = User.query.count()
    # ... more stats
    return jsonify({"total_users": total_users, "message": "User analytics placeholder"}), 200

@admin_bp.route("/analytics/courses", methods=["GET"])
@admin_required
def get_course_analytics():
    # Placeholder: Implement logic to gather course statistics
    total_courses = Course.query.count()
    # ... more stats
    return jsonify({"total_courses": total_courses, "message": "Course analytics placeholder"}), 200

@admin_bp.route("/site_settings", methods=["GET"])
@admin_required
def get_site_settings():
    # Placeholder: Implement logic to retrieve site settings (e.g., from a config file or DB table)
    return jsonify({"site_name": "Afritec Bridge LMS", "message": "Site settings placeholder"}), 200

@admin_bp.route("/site_settings", methods=["PUT"])
@admin_required
def update_site_settings():
    data = request.get_json()
    # Placeholder: Implement logic to update site settings
    return jsonify({"message": "Site settings updated (placeholder)", "updated_settings": data}), 200

# Remember to register this blueprint in your main Flask app (e.g., in src/main.py or src/__init__.py)
# from .routes.admin_routes import admin_bp
# app.register_blueprint(admin_bp)

