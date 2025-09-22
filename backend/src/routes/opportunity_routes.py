# Opportunity Connection API Routes for Afritec Bridge LMS

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..models.user_models import db, User, Role # For role checking
from ..models.opportunity_models import Opportunity
from .course_routes import role_required # Re-use the role_required decorator

opportunity_bp = Blueprint("opportunity_bp", __name__, url_prefix="/api/v1/opportunities")

@opportunity_bp.route("", methods=["POST"])
@role_required(["admin", "instructor"]) # Or a new role like "partner" or "recruiter"
def create_opportunity():
    data = request.get_json()
    current_user_id = get_jwt_identity()

    try:
        new_opportunity = Opportunity(
            title=data["title"],
            description=data["description"],
            type=data["type"],
            location=data.get("location"),
            company_name=data.get("company_name"),
            application_link=data["application_link"],
            application_deadline=data.get("application_deadline"), # Should be ISO format string
            posted_by_id=current_user_id,
            is_active=data.get("is_active", True)
        )
        db.session.add(new_opportunity)
        db.session.commit()
        return jsonify(new_opportunity.to_dict()), 201
    except KeyError as e:
        return jsonify({"message": f"Missing field: {e}"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not create opportunity", "error": str(e)}), 500

@opportunity_bp.route("", methods=["GET"])
def get_opportunities():
    # Add pagination and filtering later
    opportunities = Opportunity.query.filter_by(is_active=True).order_by(Opportunity.created_at.desc()).all()
    return jsonify([opp.to_dict() for opp in opportunities]), 200

@opportunity_bp.route("/all", methods=["GET"])
@role_required(["admin", "instructor"])
def get_all_opportunities_admin(): # Endpoint for admins/staff to see all opportunities (active/inactive)
    opportunities = Opportunity.query.order_by(Opportunity.created_at.desc()).all()
    return jsonify([opp.to_dict() for opp in opportunities]), 200

@opportunity_bp.route("/<int:opportunity_id>", methods=["GET"])
def get_opportunity(opportunity_id):
    opportunity = Opportunity.query.get_or_404(opportunity_id)
    if not opportunity.is_active:
        # Check if user is admin or original poster to allow viewing inactive
        try:
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            if not user or (user.role.name not in ["admin", "instructor"] or (opportunity.posted_by_id != user.id)):
                return jsonify({"message": "Opportunity not found or not active"}), 404
        except Exception: # Catches if no JWT provided (anonymous user)
             return jsonify({"message": "Opportunity not found or not active"}), 404
    return jsonify(opportunity.to_dict()), 200

@opportunity_bp.route("/<int:opportunity_id>", methods=["PUT"])
@role_required(["admin", "instructor"])
def update_opportunity(opportunity_id):
    opportunity = Opportunity.query.get_or_404(opportunity_id)
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    if user.role.name != "admin" and opportunity.posted_by_id != current_user_id:
        return jsonify({"message": "You are not authorized to update this opportunity"}), 403

    data = request.get_json()
    try:
        opportunity.title = data.get("title", opportunity.title)
        opportunity.description = data.get("description", opportunity.description)
        opportunity.type = data.get("type", opportunity.type)
        opportunity.location = data.get("location", opportunity.location)
        opportunity.company_name = data.get("company_name", opportunity.company_name)
        opportunity.application_link = data.get("application_link", opportunity.application_link)
        opportunity.application_deadline = data.get("application_deadline", opportunity.application_deadline)
        opportunity.is_active = data.get("is_active", opportunity.is_active)
        db.session.commit()
        return jsonify(opportunity.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not update opportunity", "error": str(e)}), 500

@opportunity_bp.route("/<int:opportunity_id>", methods=["DELETE"])
@role_required(["admin", "instructor"])
def delete_opportunity(opportunity_id):
    opportunity = Opportunity.query.get_or_404(opportunity_id)
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    if user.role.name != "admin" and opportunity.posted_by_id != current_user_id:
        return jsonify({"message": "You are not authorized to delete this opportunity"}), 403

    try:
        db.session.delete(opportunity)
        db.session.commit()
        return jsonify({"message": "Opportunity deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Could not delete opportunity", "error": str(e)}), 500

@opportunity_bp.route("/<int:opportunity_id>/activate", methods=["POST"])
@role_required(["admin", "instructor"])
def activate_opportunity(opportunity_id):
    opportunity = Opportunity.query.get_or_404(opportunity_id)
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if user.role.name != "admin" and opportunity.posted_by_id != current_user_id:
        return jsonify({"message": "Not authorized"}), 403
    opportunity.is_active = True
    db.session.commit()
    return jsonify({"message": "Opportunity activated", "opportunity": opportunity.to_dict()}), 200

@opportunity_bp.route("/<int:opportunity_id>/deactivate", methods=["POST"])
@role_required(["admin", "instructor"])
def deactivate_opportunity(opportunity_id):
    opportunity = Opportunity.query.get_or_404(opportunity_id)
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if user.role.name != "admin" and opportunity.posted_by_id != current_user_id:
        return jsonify({"message": "Not authorized"}), 403
    opportunity.is_active = False
    db.session.commit()
    return jsonify({"message": "Opportunity deactivated", "opportunity": opportunity.to_dict()}), 200

