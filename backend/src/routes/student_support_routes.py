from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
from ..models.user_models import User
from ..utils.email_utils import send_email
from marshmallow import Schema, fields, ValidationError, validate
import logging

# Create blueprint
support_bp = Blueprint('support', __name__)

# Student required decorator
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

# Email configuration
SUPPORT_EMAIL = 'afritech.bridge@yahoo.com'

# Validation schema
class SupportTicketSchema(Schema):
    subject = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    category = fields.Str(required=True, validate=validate.OneOf([
        'technical', 'course', 'account', 'payment', 'certificate', 'assignment', 'other'
    ]))
    message = fields.Str(required=True, validate=validate.Length(min=10, max=2000))
    priority = fields.Str(validate=validate.OneOf(['low', 'medium', 'high', 'urgent']))
    user_email = fields.Email(allow_none=True)
    user_name = fields.Str(allow_none=True)

@support_bp.route("/ticket", methods=["POST"])
@student_required
def submit_support_ticket():
    """Submit a support ticket"""
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404

        # Get and validate form data
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No data provided"}), 400

        try:
            schema = SupportTicketSchema()
            validated_data = schema.load(data)
            # Set default priority if not provided
            if 'priority' not in validated_data or not validated_data['priority']:
                validated_data['priority'] = 'medium'
        except ValidationError as err:
            return jsonify({
                "success": False, 
                "message": "Validation failed", 
                "errors": err.messages
            }), 400

        # Prepare email content
        user_name = validated_data.get('user_name') or f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username
        user_email = user.email
        
        # Create ticket ID (simple timestamp-based)
        import time
        ticket_id = f"TICKET-{int(time.time())}"
        
        # Email subject for support team
        email_subject = f"[{ticket_id}] {validated_data['category'].title()}: {validated_data['subject']}"
        
        # Email body for support team
        email_body = f"""
New Support Ticket Submitted

Ticket ID: {ticket_id}
Category: {validated_data['category'].title()}
Priority: {validated_data['priority'].title()}

Student Information:
- Name: {user_name}
- Email: {user_email}
- User ID: {user.id}

Subject: {validated_data['subject']}

Message:
{validated_data['message']}

---
This ticket was submitted through the Afritech Bridge LMS student portal.
        """.strip()

        # Send email to support team
        try:
            send_email(
                to=SUPPORT_EMAIL,
                subject=email_subject,
                body=email_body
            )
        except Exception as email_error:
            logging.error(f"Failed to send support email: {str(email_error)}")
            return jsonify({
                "success": False, 
                "message": "Failed to send support ticket. Please try again later."
            }), 500

        # Send confirmation email to user
        try:
            confirmation_subject = f"Support Ticket Received - {ticket_id}"
            confirmation_body = f"""
Dear {user_name},

Thank you for contacting Afritech Bridge support. We have received your ticket and will respond within 24-48 hours.

Ticket Details:
- Ticket ID: {ticket_id}
- Subject: {validated_data['subject']}
- Category: {validated_data['category'].title()}
- Priority: {validated_data['priority'].title()}

If you have additional information to add to this ticket, please reply to this email with the ticket ID in the subject line.

Best regards,
Afritech Bridge Support Team
afritech.bridge@yahoo.com
            """.strip()
            
            send_email(
                to=user_email,
                subject=confirmation_subject,
                body=confirmation_body
            )
        except Exception as confirmation_error:
            # Log but don't fail the request if confirmation email fails
            logging.warning(f"Failed to send confirmation email: {str(confirmation_error)}")

        return jsonify({
            "success": True,
            "message": "Support ticket submitted successfully",
            "data": {
                "ticket_id": ticket_id,
                "status": "submitted"
            }
        }), 200

    except Exception as e:
        logging.error(f"Error submitting support ticket: {str(e)}")
        return jsonify({
            "success": False,
            "message": "An error occurred while submitting your ticket. Please try again later."
        }), 500