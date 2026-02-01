# File Upload Routes for Assignment Submissions
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from io import BytesIO
import json
import logging
import os

from ..models.user_models import db, User
from ..models.course_models import (
    Assignment, AssignmentSubmission, Project, ProjectSubmission,
    Course, Enrollment
)
from ..models.student_models import LessonCompletion
from ..utils.validators import StudentValidators
from ..utils.google_drive_service import google_drive_service

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

@file_upload_bp.route("/assignments/<int:assignment_id>/resubmit-with-files", methods=["POST"])
@student_required
def resubmit_assignment_with_files(assignment_id):
    """Resubmit assignment with file metadata (for modification requests)"""
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
        
        # Get existing submission
        existing = AssignmentSubmission.query.filter_by(
            assignment_id=assignment_id,
            student_id=current_user_id
        ).first()
        
        if not existing:
            return jsonify({
                "success": False,
                "error": "No previous submission found to resubmit"
            }), 400
        
        # Check if modification was requested
        if not assignment.modification_requested:
            return jsonify({
                "success": False,
                "error": "No modification request found for this assignment"
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
        
        # Update existing submission
        existing.content = data.get('content')
        existing.file_url = json.dumps(files_data) if files_data else None
        existing.external_url = data.get('external_url')
        existing.submitted_at = datetime.utcnow()
        existing.grade = None  # Reset grade since this is a resubmission
        existing.feedback = None  # Reset feedback
        existing.graded_at = None
        existing.graded_by = None
        
        # Clear modification request status
        assignment.modification_requested = False
        assignment.modification_request_reason = None
        assignment.modification_requested_at = None
        assignment.modification_requested_by = None
        
        # Update lesson completion if exists
        if assignment.lesson_id:
            lesson_completion = LessonCompletion.query.filter_by(
                student_id=current_user_id,
                lesson_id=assignment.lesson_id
            ).first()
            
            if lesson_completion:
                lesson_completion.assignment_needs_resubmission = False
                lesson_completion.is_resubmission = True
                lesson_completion.completed_at = datetime.utcnow()
        
        db.session.commit()
        
        logger.info(f"Assignment {assignment_id} resubmitted by user {current_user_id} with {len(files_data)} files")
        
        return jsonify({
            "success": True,
            "message": "Assignment resubmitted successfully",
            "submission": {
                "id": existing.id,
                "assignment_id": assignment_id,
                "submitted_at": existing.submitted_at.isoformat(),
                "files_count": len(files_data),
                "has_text": bool(data.get('content')),
                "status": "resubmitted"
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Assignment resubmission error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Resubmission failed. Please try again."
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
                
            # If using Google Drive, enrich file data with current info
            storage_provider = os.getenv('FILE_STORAGE_PROVIDER', 'google_drive').lower()
            if storage_provider == 'google_drive' and google_drive_service.is_configured:
                enriched_files = []
                for file_data in files_data:
                    # Check if this looks like a Google Drive file
                    if 'file_id' in file_data:
                        # Get current file info from Google Drive
                        current_info = google_drive_service.get_file_info(file_data['file_id'])
                        if current_info:
                            # Merge stored data with current Google Drive data
                            enriched_file = {**file_data, **current_info}
                            enriched_files.append(enriched_file)
                        else:
                            # File not found in Google Drive, mark as missing
                            enriched_file = {**file_data, 'status': 'missing', 'error': 'File not found in Google Drive'}
                            enriched_files.append(enriched_file)
                    else:
                        # Legacy file format, keep as is
                        enriched_files.append(file_data)
                files_data = enriched_files
                
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
    """Upload a single file to Google Drive"""
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

        # Read file data for validation
        file_content = file.read()
        file.seek(0)  # Reset file pointer
        
        # Validate file
        file_data = {
            'filename': file.filename,
            'content_type': file.content_type,
            'size': len(file_content)
        }
        
        is_valid, errors = StudentValidators.validate_file_upload(file_data)
        
        if not is_valid:
            return jsonify({
                "success": False,
                "error": f"File validation failed: {', '.join(errors)}"
            }), 400

        # Check file storage provider
        storage_provider = os.getenv('FILE_STORAGE_PROVIDER', 'google_drive').lower()
        
        if storage_provider == 'google_drive' and google_drive_service.is_configured:
            try:
                # Upload to Google Drive
                file_data_io = BytesIO(file_content)
                
                result = google_drive_service.upload_file(
                    file_data=file_data_io,
                    filename=file.filename,
                    mime_type=file.content_type,
                    assignment_id=int(assignment_id) if assignment_id else 0,
                    student_id=int(student_id),
                    metadata={
                        'folder': folder,
                        'uploaded_by': current_user_id,
                        'upload_type': 'single_file'
                    }
                )
                
                logger.info(f"File uploaded to Google Drive: {file.filename} for user {current_user_id}")
                
                return jsonify({
                    "success": True,
                    "url": result['view_link'],  # Use view link as primary URL
                    "download_url": result['download_link'],
                    "file_id": result['file_id'],
                    "pathname": f"{folder}/{assignment_id or 'general'}/{student_id}/{result['filename']}",
                    "size": result['size'],
                    "contentType": result['mime_type'],
                    "uploadedAt": result['uploaded_at'],
                    "message": "File uploaded successfully to Google Drive",
                    "storage": "google_drive"
                }), 200
                
            except Exception as drive_error:
                logger.error(f"Google Drive upload failed: {str(drive_error)}")
                # Continue to fallback
        elif storage_provider == 'google_drive' and not google_drive_service.is_configured:
            logger.warning("Google Drive requested but not configured, using fallback")
        
        # Fallback to mock response (for development/testing)
        import time
        timestamp = int(time.time())
        mock_pathname = f"{folder}/{assignment_id or 'general'}/{student_id}/{timestamp}_{file.filename}"
        mock_url = f"/uploads/{mock_pathname}"
        
        logger.warning(f"Using fallback storage for: {file.filename} (user {current_user_id})")
        
        return jsonify({
            "success": True,
            "url": mock_url,
            "pathname": mock_pathname,
            "size": file_data['size'],
            "contentType": file_data['content_type'],
            "uploadedAt": datetime.utcnow().isoformat(),
            "message": "File upload completed (fallback storage)",
            "storage": "fallback"
        }), 200
        
    except Exception as e:
        logger.error(f"File upload error: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Upload failed: {str(e)}"
        }), 500


@file_upload_bp.route("/google-drive/files/<file_id>", methods=["GET"])
@jwt_required()
def get_google_drive_file_info(file_id):
    """Get information about a Google Drive file"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({
                "success": False,
                "error": "User not found"
            }), 404
        
        if not google_drive_service.is_configured:
            return jsonify({
                "success": False,
                "error": "Google Drive service is not configured"
            }), 503
        
        # Get file info from Google Drive
        file_info = google_drive_service.get_file_info(file_id)
        
        if not file_info:
            return jsonify({
                "success": False,
                "error": "File not found"
            }), 404
        
        return jsonify({
            "success": True,
            "file": file_info
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting Google Drive file info: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to get file information"
        }), 500


@file_upload_bp.route("/google-drive/files/<file_id>", methods=["DELETE"])
@jwt_required()
def delete_google_drive_file(file_id):
    """Delete a Google Drive file"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({
                "success": False,
                "error": "User not found"
            }), 404
        
        if not google_drive_service.is_configured:
            return jsonify({
                "success": False,
                "error": "Google Drive service is not configured"
            }), 503
        
        # Get file info first to verify ownership/access
        file_info = google_drive_service.get_file_info(file_id)
        
        if not file_info:
            return jsonify({
                "success": False,
                "error": "File not found"
            }), 404
        
        # Check if user has permission to delete (basic check)
        metadata = file_info.get('metadata', {})
        uploaded_by = metadata.get('uploaded_by')
        
        # Allow deletion if user uploaded the file or is admin/instructor
        if (uploaded_by != str(current_user_id) and 
            user.role.name not in ['admin', 'instructor']):
            return jsonify({
                "success": False,
                "error": "Permission denied"
            }), 403
        
        # Delete file from Google Drive
        success = google_drive_service.delete_file(file_id)
        
        if success:
            logger.info(f"Deleted Google Drive file {file_id} by user {current_user_id}")
            return jsonify({
                "success": True,
                "message": "File deleted successfully"
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Failed to delete file"
            }), 500
        
    except Exception as e:
        logger.error(f"Error deleting Google Drive file: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to delete file"
        }), 500


@file_upload_bp.route("/google-drive/test", methods=["GET"])
@jwt_required()
def test_google_drive_connection():
    """Test Google Drive API connection"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or user.role.name not in ['admin', 'instructor']:
            return jsonify({
                "success": False,
                "error": "Admin or instructor access required"
            }), 403
        
        if not google_drive_service.is_configured:
            return jsonify({
                "success": False,
                "error": "Google Drive service is not configured",
                "storage_provider": os.getenv('FILE_STORAGE_PROVIDER', 'google_drive'),
                "message": "Please configure GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_DRIVE_ROOT_FOLDER_ID in environment variables"
            }), 503
        
        # Test connection
        is_connected = google_drive_service.test_connection()
        
        if is_connected:
            return jsonify({
                "success": True,
                "message": "Google Drive connection successful",
                "storage_provider": os.getenv('FILE_STORAGE_PROVIDER', 'google_drive')
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Google Drive connection failed"
            }), 500
        
    except Exception as e:
        logger.error(f"Error testing Google Drive connection: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Connection test failed: {str(e)}"
        }), 500