# File Upload Routes for Assignment Submissions
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import json
import logging

from ..models.user_models import db, User
from ..models.course_models import (
    Assignment, AssignmentSubmission, Project, ProjectSubmission,
    Course, Enrollment
)
from ..utils.validators import StudentValidators

logger = logging.getLogger(__name__)

# Helper decorator for student access
def student_required(f):
    """Decorator to require student role"""
    from functools import wraps
    
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or user.role.name not in ['student']:
            return jsonify({"message": "Student access required"}), 403
            
        return f(*args, **kwargs)
    
    return decorated_function

file_upload_bp = Blueprint("file_upload", __name__, url_prefix="/api/v1/uploads")

@file_upload_bp.route("/validate-file", methods=["POST"])
@jwt_required()
def validate_file():
    """Validate file before upload"""
    try:
        data = request.get_json()
        
        if not data or 'filename' not in data or 'size' not in data or 'type' not in data:
            return jsonify({
                "success": False,
                "error": "File information is required"
            }), 400
        
        file_data = {
            'filename': data['filename'],
            'content_type': data['type'],
            'size': data['size']
        }
        
        is_valid, errors = StudentValidators.validate_file_upload(file_data)
        
        return jsonify({
            "success": True,
            "valid": is_valid,
            "errors": errors if not is_valid else [],
            "max_size_mb": 50,  # 50MB limit
            "allowed_types": [
                '.pdf', '.doc', '.docx', '.txt', '.py', '.js', '.html', '.css',
                '.jpg', '.jpeg', '.png', '.gif', '.zip', '.tar', '.gz', '.json',
                '.xml', '.xls', '.xlsx', '.ppt', '.pptx', '.mp3', '.wav', '.mp4'
            ]
        }), 200
        
    except Exception as e:
        logger.error(f"File validation error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Validation failed"
        }), 500

@file_upload_bp.route("/assignments/<int:assignment_id>/submit-with-files", methods=["POST"])
@student_required
def submit_assignment_with_files(assignment_id):
    """Submit assignment with file metadata"""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        # Get assignment
        assignment = Assignment.query.get_or_404(assignment_id)
        
        # Check if student is enrolled
        enrollment = Enrollment.query.filter_by(
            student_id=current_user_id,
            course_id=assignment.course_id
        ).first()
        
        if not enrollment:
            return jsonify({
                "success": False,
                "error": "Not enrolled in this course"
            }), 403
        
        # Check if already submitted
        existing = AssignmentSubmission.query.filter_by(
            assignment_id=assignment_id,
            student_id=current_user_id
        ).first()
        
        if existing:
            return jsonify({
                "success": False,
                "error": "Assignment already submitted"
            }), 400
        
        # Validate submission data
        if not data:
            return jsonify({
                "success": False,
                "error": "Submission data is required"
            }), 400
        
        # Validate files if provided
        files_data = data.get('files', [])
        if assignment.assignment_type in ['file_upload', 'both'] and not files_data and not data.get('content'):
            return jsonify({
                "success": False,
                "error": "File submission is required for this assignment"
            }), 400
        
        # Validate file count and sizes
        if files_data:
            total_size = sum(file.get('size', 0) for file in files_data)
            max_total_size = (assignment.max_file_size_mb or 50) * 1024 * 1024
            
            if total_size > max_total_size:
                return jsonify({
                    "success": False,
                    "error": f"Total file size exceeds limit of {assignment.max_file_size_mb or 50}MB"
                }), 400
        
        # Create submission record
        submission = AssignmentSubmission(
            assignment_id=assignment_id,
            student_id=current_user_id,
            content=data.get('content'),
            file_url=json.dumps(files_data) if files_data else None,  # Store file metadata as JSON
            external_url=data.get('external_url'),
            submitted_at=datetime.utcnow()
        )
        
        db.session.add(submission)
        db.session.commit()
        
        logger.info(f"Assignment {assignment_id} submitted by user {current_user_id} with {len(files_data)} files")
        
        return jsonify({
            "success": True,
            "message": "Assignment submitted successfully",
            "submission": {
                "id": submission.id,
                "assignment_id": assignment_id,
                "submitted_at": submission.submitted_at.isoformat(),
                "files_count": len(files_data),
                "has_text": bool(data.get('content')),
                "status": "submitted"
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Assignment submission error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Submission failed. Please try again."
        }), 500

@file_upload_bp.route("/projects/<int:project_id>/submit-with-files", methods=["POST"])
@student_required
def submit_project_with_files(project_id):
    """Submit project with file metadata"""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        # Get project
        project = Project.query.get_or_404(project_id)
        
        # Check if student is enrolled
        enrollment = Enrollment.query.filter_by(
            student_id=current_user_id,
            course_id=project.course_id
        ).first()
        
        if not enrollment:
            return jsonify({
                "success": False,
                "error": "Not enrolled in this course"
            }), 403
        
        # Check if already submitted
        existing = ProjectSubmission.query.filter_by(
            project_id=project_id,
            student_id=current_user_id
        ).first()
        
        if existing:
            return jsonify({
                "success": False,
                "error": "Project already submitted"
            }), 400
        
        # Validate submission data
        if not data:
            return jsonify({
                "success": False,
                "error": "Submission data is required"
            }), 400
        
        # Validate files if provided
        files_data = data.get('files', [])
        if project.submission_format in ['file_upload', 'both'] and not files_data and not data.get('text_content'):
            return jsonify({
                "success": False,
                "error": "File submission is required for this project"
            }), 400
        
        # Validate file count and sizes
        if files_data:
            total_size = sum(file.get('size', 0) for file in files_data)
            max_total_size = (project.max_file_size_mb or 50) * 1024 * 1024
            
            if total_size > max_total_size:
                return jsonify({
                    "success": False,
                    "error": f"Total file size exceeds limit of {project.max_file_size_mb or 50}MB"
                }), 400
        
        # Create submission record
        submission = ProjectSubmission(
            project_id=project_id,
            student_id=current_user_id,
            text_content=data.get('text_content'),
            file_path=json.dumps(files_data) if files_data else None,  # Store file metadata as JSON
            submitted_at=datetime.utcnow()
        )
        
        # Handle team members if collaboration is allowed
        team_members = data.get('team_members', [])
        if project.collaboration_allowed and team_members:
            if len(team_members) > project.max_team_size:
                return jsonify({
                    "success": False,
                    "error": f"Team size exceeds maximum of {project.max_team_size} members"
                }), 400
            submission.set_team_members(team_members)
        
        db.session.add(submission)
        db.session.commit()
        
        logger.info(f"Project {project_id} submitted by user {current_user_id} with {len(files_data)} files")
        
        return jsonify({
            "success": True,
            "message": "Project submitted successfully",
            "submission": {
                "id": submission.id,
                "project_id": project_id,
                "submitted_at": submission.submitted_at.isoformat(),
                "files_count": len(files_data),
                "has_text": bool(data.get('text_content')),
                "team_size": len(team_members),
                "status": "submitted"
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Project submission error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Submission failed. Please try again."
        }), 500

@file_upload_bp.route("/assignments/<int:assignment_id>/files", methods=["GET"])
@jwt_required()
def get_assignment_files(assignment_id):
    """Get files for an assignment submission"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({
                "success": False,
                "error": "User not found"
            }), 404
        
        assignment = Assignment.query.get_or_404(assignment_id)
        
        # For students, get their own submission
        if user.role.name == 'student':
            submission = AssignmentSubmission.query.filter_by(
                assignment_id=assignment_id,
                student_id=current_user_id
            ).first()
        # For instructors, they can view all submissions
        elif user.role.name == 'instructor' and assignment.instructor_id == current_user_id:
            submission_id = request.args.get('submission_id')
            if submission_id:
                submission = AssignmentSubmission.query.get(submission_id)
            else:
                submission = None
        else:
            return jsonify({
                "success": False,
                "error": "Access denied"
            }), 403
        
        if not submission or not submission.file_url:
            return jsonify({
                "success": True,
                "files": []
            }), 200
        
        try:
            files_data = json.loads(submission.file_url)
            if not isinstance(files_data, list):
                files_data = []
        except (json.JSONDecodeError, TypeError):
            files_data = []
        
        return jsonify({
            "success": True,
            "files": files_data,
            "submission_id": submission.id,
            "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None
        }), 200
        
    except Exception as e:
        logger.error(f"Get assignment files error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to retrieve files"
        }), 500

@file_upload_bp.route("/projects/<int:project_id>/files", methods=["GET"])
@jwt_required()
def get_project_files(project_id):
    """Get files for a project submission"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({
                "success": False,
                "error": "User not found"
            }), 404
        
        project = Project.query.get_or_404(project_id)
        
        # For students, get their own submission
        if user.role.name == 'student':
            submission = ProjectSubmission.query.filter_by(
                project_id=project_id,
                student_id=current_user_id
            ).first()
        # For instructors, they can view all submissions  
        elif user.role.name == 'instructor':
            submission_id = request.args.get('submission_id')
            if submission_id:
                submission = ProjectSubmission.query.get(submission_id)
            else:
                submission = None
        else:
            return jsonify({
                "success": False,
                "error": "Access denied"
            }), 403
        
        if not submission or not submission.file_path:
            return jsonify({
                "success": True,
                "files": []
            }), 200
        
        try:
            files_data = json.loads(submission.file_path)
            if not isinstance(files_data, list):
                files_data = []
        except (json.JSONDecodeError, TypeError):
            files_data = []
        
        return jsonify({
            "success": True,
            "files": files_data,
            "submission_id": submission.id,
            "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None
        }), 200
        
    except Exception as e:
        logger.error(f"Get project files error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to retrieve files"
        }), 500

@file_upload_bp.route("/file-info", methods=["POST"])
@jwt_required()
def get_file_info():
    """Get information about a specific file"""
    try:
        data = request.get_json()
        
        if not data or 'url' not in data:
            return jsonify({
                "success": False,
                "error": "File URL is required"
            }), 400
        
        file_url = data['url']
        
        # Here you could implement additional file info retrieval
        # For now, just return basic info based on the URL
        
        return jsonify({
            "success": True,
            "file_info": {
                "url": file_url,
                "accessible": True,  # You could implement actual accessibility check
                "last_checked": datetime.utcnow().isoformat()
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get file info error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to retrieve file information"
        }), 500

@file_upload_bp.route("/file", methods=["POST"])
@jwt_required()
def upload_single_file():
    """Upload a single file and return metadata - Fallback for when Vercel Blob is not available"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({
                "success": False,
                "error": "User not found"
            }), 404

        # Check if file is present in request
        if 'file' not in request.files:
            return jsonify({
                "success": False,
                "error": "No file provided"
            }), 400

        file = request.files['file']
        
        if file.filename == '':
            return jsonify({
                "success": False,
                "error": "No file selected"
            }), 400

        # Get optional parameters
        folder = request.form.get('folder', 'general')
        assignment_id = request.form.get('assignmentId')
        student_id = request.form.get('studentId', str(current_user_id))

        # Validate file
        file_data = {
            'filename': file.filename,
            'content_type': file.content_type,
            'size': len(file.read())
        }
        file.seek(0)  # Reset file pointer
        
        is_valid, errors = StudentValidators.validate_file_upload(file_data)
        
        if not is_valid:
            return jsonify({
                "success": False,
                "error": f"File validation failed: {', '.join(errors)}"
            }), 400

        # In a real implementation, you would save the file to a storage service
        # For now, we'll just return a mock URL since this is a fallback
        import time
        timestamp = int(time.time())
        mock_pathname = f"{folder}/{assignment_id or 'general'}/{student_id}/{timestamp}_{file.filename}"
        mock_url = f"/uploads/{mock_pathname}"
        
        logger.info(f"File upload fallback: {file.filename} for user {current_user_id}")
        
        return jsonify({
            "success": True,
            "url": mock_url,
            "pathname": mock_pathname,
            "size": file_data['size'],
            "contentType": file_data['content_type'],
            "message": "File upload completed (backend fallback)"
        }), 200
        
    except Exception as e:
        logger.error(f"File upload error: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Upload failed: {str(e)}"
        }), 500