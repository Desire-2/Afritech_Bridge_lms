"""
Enhanced file handling routes for instructor file review system
"""

from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
import json
import zipfile
import tempfile
import logging
from datetime import datetime
from io import BytesIO
import mimetypes

from ..models.user_models import db, User
from ..models.course_models import AssignmentSubmission, ProjectSubmission, Course
from ..models.file_models import FileComment, FileAnalysis
from ..utils.google_drive_service import GoogleDriveService

logger = logging.getLogger(__name__)

enhanced_file_bp = Blueprint("enhanced_file_bp", __name__, url_prefix="/api/v1/files")

def instructor_required(f):
    from functools import wraps
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user or not user.role or user.role.name not in ['instructor', 'admin']:
            return jsonify({"message": "Instructor access required"}), 403
        return f(*args, **kwargs)
    return decorated_function


@enhanced_file_bp.route("/comments", methods=["POST"])
@instructor_required
def add_file_comment():
    """Add a comment to a specific file in a submission"""
    try:
        data = request.get_json()
        file_id = data.get('file_id')
        comment_text = data.get('comment_text', '').strip()
        submission_id = data.get('submission_id')
        project_submission_id = data.get('project_submission_id')
        is_private = data.get('is_private', False)
        
        if not file_id or not comment_text:
            return jsonify({"message": "File ID and comment text are required"}), 400
        
        current_user_id = int(get_jwt_identity())
        
        # Verify instructor has access to this submission
        if submission_id:
            submission = AssignmentSubmission.query.get(submission_id)
            if not submission or submission.assignment.course.instructor_id != current_user_id:
                return jsonify({"message": "Access denied"}), 403
        elif project_submission_id:
            submission = ProjectSubmission.query.get(project_submission_id)
            if not submission or submission.project.course.instructor_id != current_user_id:
                return jsonify({"message": "Access denied"}), 403
        else:
            return jsonify({"message": "Either submission_id or project_submission_id is required"}), 400
        
        # Create comment
        comment = FileComment(
            file_id=file_id,
            submission_id=submission_id,
            project_submission_id=project_submission_id,
            instructor_id=current_user_id,
            comment_text=comment_text,
            is_private=is_private
        )
        
        db.session.add(comment)
        db.session.commit()
        
        return jsonify({
            "message": "Comment added successfully",
            "comment": comment.to_dict()
        }), 201
        
    except Exception as e:
        logger.error(f"Error adding file comment: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({"message": "Failed to add comment", "error": str(e)}), 500


@enhanced_file_bp.route("/comments/<int:comment_id>", methods=["PUT"])
@instructor_required
def update_file_comment(comment_id):
    """Update an existing file comment"""
    try:
        comment = FileComment.query.get(comment_id)
        if not comment:
            return jsonify({"message": "Comment not found"}), 404
        
        current_user_id = int(get_jwt_identity())
        if comment.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        data = request.get_json()
        comment_text = data.get('comment_text', '').strip()
        
        if not comment_text:
            return jsonify({"message": "Comment text is required"}), 400
        
        comment.comment_text = comment_text
        comment.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            "message": "Comment updated successfully",
            "comment": comment.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error updating file comment: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({"message": "Failed to update comment", "error": str(e)}), 500


@enhanced_file_bp.route("/comments/<int:comment_id>", methods=["DELETE"])
@instructor_required
def delete_file_comment(comment_id):
    """Delete a file comment"""
    try:
        comment = FileComment.query.get(comment_id)
        if not comment:
            return jsonify({"message": "Comment not found"}), 404
        
        current_user_id = int(get_jwt_identity())
        if comment.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        db.session.delete(comment)
        db.session.commit()
        
        return jsonify({"message": "Comment deleted successfully"}), 200
        
    except Exception as e:
        logger.error(f"Error deleting file comment: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({"message": "Failed to delete comment", "error": str(e)}), 500


@enhanced_file_bp.route("/submission/<int:submission_id>/comments", methods=["GET"])
@instructor_required
def get_submission_file_comments(submission_id):
    """Get all file comments for a submission"""
    try:
        current_user_id = int(get_jwt_identity())
        
        # Check if it's assignment or project submission
        submission = AssignmentSubmission.query.get(submission_id)
        if submission:
            if submission.assignment.course.instructor_id != current_user_id:
                return jsonify({"message": "Access denied"}), 403
            comments = FileComment.query.filter_by(submission_id=submission_id).all()
        else:
            submission = ProjectSubmission.query.get(submission_id)
            if not submission or submission.project.course.instructor_id != current_user_id:
                return jsonify({"message": "Access denied"}), 403
            comments = FileComment.query.filter_by(project_submission_id=submission_id).all()
        
        return jsonify({
            "comments": [comment.to_dict() for comment in comments]
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching file comments: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to fetch comments", "error": str(e)}), 500


@enhanced_file_bp.route("/download/<int:submission_id>", methods=["GET"])
@instructor_required
def download_submission_files(submission_id):
    """Download all files from a submission as ZIP"""
    try:
        current_user_id = int(get_jwt_identity())
        
        # Get submission and verify access
        submission = AssignmentSubmission.query.get(submission_id)
        if not submission:
            submission = ProjectSubmission.query.get(submission_id)
        
        if not submission:
            return jsonify({"message": "Submission not found"}), 404
        
        # Check instructor access
        course = submission.assignment.course if hasattr(submission, 'assignment') else submission.project.course
        if course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        # Parse files from submission
        files_data = []
        if submission.file_url:
            try:
                files_data = json.loads(submission.file_url) if submission.file_url else []
                if not isinstance(files_data, list):
                    files_data = []
            except (json.JSONDecodeError, TypeError):
                files_data = []
        
        if not files_data:
            return jsonify({"message": "No files to download"}), 404
        
        # Create ZIP file in memory
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            drive_service = GoogleDriveService()
            
            for file_info in files_data:
                try:
                    filename = file_info.get('filename', 'unknown_file')
                    file_url = file_info.get('url', '')
                    
                    if not file_url:
                        continue
                    
                    # Download file content
                    if 'drive.google.com' in file_url:
                        # Handle Google Drive files
                        file_id = drive_service.extract_file_id_from_url(file_url)
                        if file_id:
                            content = drive_service.download_file(file_id)
                            if content:
                                zip_file.writestr(filename, content)
                    else:
                        # Handle direct file URLs (if any)
                        # This would require additional implementation for direct URL downloads
                        pass
                        
                except Exception as file_error:
                    logger.warning(f"Failed to add file {filename} to ZIP: {str(file_error)}")
                    continue
        
        zip_buffer.seek(0)
        
        # Generate filename
        student_name = f"{submission.student.first_name}_{submission.student.last_name}"
        assignment_title = submission.assignment.title if hasattr(submission, 'assignment') else submission.project.title
        filename = f"{student_name}_{assignment_title}_files.zip"
        filename = secure_filename(filename)
        
        return send_file(
            zip_buffer,
            as_attachment=True,
            download_name=filename,
            mimetype='application/zip'
        )
        
    except Exception as e:
        logger.error(f"Error downloading submission files: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to download files", "error": str(e)}), 500


@enhanced_file_bp.route("/download/single", methods=["POST"])
@instructor_required
def download_single_file():
    """Download a single file by URL (proxy for Google Drive or other sources)"""
    try:
        data = request.get_json()
        file_url = data.get('file_url')
        filename = data.get('filename', 'download')
        
        if not file_url:
            return jsonify({"message": "File URL is required"}), 400
        
        # Handle Google Drive URLs
        if 'drive.google.com' in file_url:
            # Extract file ID from Google Drive URL
            import re
            file_id_match = re.search(r'/d/([a-zA-Z0-9-_]+)', file_url)
            if file_id_match:
                file_id = file_id_match.group(1)
                
                # Use Google Drive service to download
                drive_service = GoogleDriveService()
                try:
                    content = drive_service.download_file(file_id)
                    
                    # Create a BytesIO object from content
                    file_buffer = BytesIO(content)
                    
                    # Determine MIME type
                    mime_type, _ = mimetypes.guess_type(filename)
                    if not mime_type:
                        mime_type = 'application/octet-stream'
                    
                    return send_file(
                        file_buffer,
                        as_attachment=True,
                        download_name=filename,
                        mimetype=mime_type
                    )
                    
                except Exception as drive_error:
                    logger.error(f"Error downloading from Google Drive: {str(drive_error)}")
                    return jsonify({
                        "message": "Failed to download from Google Drive",
                        "error": str(drive_error)
                    }), 500
            else:
                return jsonify({"message": "Invalid Google Drive URL"}), 400
        else:
            # Handle direct URLs (this would need additional implementation for security)
            return jsonify({"message": "Direct URL downloads not yet supported"}), 501
            
    except Exception as e:
        logger.error(f"Error downloading single file: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to download file", "error": str(e)}), 500


@enhanced_file_bp.route("/analyze/<int:submission_id>", methods=["POST"])
@instructor_required
def analyze_submission_files(submission_id):
    """Analyze files in a submission for metadata and quality checks"""
    try:
        current_user_id = int(get_jwt_identity())
        
        # Get submission and verify access
        submission = AssignmentSubmission.query.get(submission_id)
        if not submission:
            submission = ProjectSubmission.query.get(submission_id)
        
        if not submission:
            return jsonify({"message": "Submission not found"}), 404
        
        # Check instructor access
        course = submission.assignment.course if hasattr(submission, 'assignment') else submission.project.course
        if course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        # Parse files from submission
        files_data = []
        if submission.file_url:
            try:
                files_data = json.loads(submission.file_url) if submission.file_url else []
                if not isinstance(files_data, list):
                    files_data = []
            except (json.JSONDecodeError, TypeError):
                files_data = []
        
        analyses = []
        drive_service = GoogleDriveService()
        
        for file_info in files_data:
            try:
                filename = file_info.get('filename', 'unknown_file')
                file_size = file_info.get('size', 0)
                file_id = file_info.get('id', filename)
                
                # Check if analysis already exists
                existing_analysis = FileAnalysis.query.filter_by(file_id=file_id).first()
                if existing_analysis:
                    analyses.append(existing_analysis.to_dict())
                    continue
                
                # Determine file category and viewability
                file_extension = filename.split('.')[-1].lower() if '.' in filename else ''
                file_category = 'other'
                is_viewable = False
                
                # Categorize file
                if file_extension in ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt']:
                    file_category = 'document'
                    is_viewable = file_extension in ['pdf', 'txt']
                elif file_extension in ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg']:
                    file_category = 'image'
                    is_viewable = True
                elif file_extension in ['mp4', 'avi', 'mov', 'wmv', 'flv']:
                    file_category = 'video'
                    is_viewable = True
                elif file_extension in ['js', 'py', 'html', 'css', 'cpp', 'java']:
                    file_category = 'code'
                    is_viewable = True
                
                # Create analysis record
                analysis = FileAnalysis(
                    file_id=file_id,
                    filename=filename,
                    file_size=file_size,
                    mime_type=mimetypes.guess_type(filename)[0],
                    file_category=file_category,
                    is_viewable=is_viewable,
                    analyzed_at=datetime.utcnow()
                )
                
                db.session.add(analysis)
                analyses.append(analysis.to_dict())
                
            except Exception as file_error:
                logger.warning(f"Failed to analyze file {filename}: {str(file_error)}")
                continue
        
        db.session.commit()
        
        return jsonify({
            "message": "File analysis completed",
            "analyses": analyses
        }), 200
        
    except Exception as e:
        logger.error(f"Error analyzing submission files: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({"message": "Failed to analyze files", "error": str(e)}), 500


@enhanced_file_bp.route("/analyze-zip", methods=["POST"])
@instructor_required
def analyze_zip_file():
    """Analyze contents of a ZIP file"""
    try:
        data = request.get_json()
        file_url = data.get('file_url')
        filename = data.get('filename', 'archive.zip')
        
        if not file_url:
            return jsonify({"message": "File URL is required"}), 400
        
        # Download the file first
        if 'drive.google.com' in file_url:
            import re
            file_id_match = re.search(r'/d/([a-zA-Z0-9-_]+)', file_url)
            if file_id_match:
                file_id = file_id_match.group(1)
                drive_service = GoogleDriveService()
                file_content = drive_service.download_file(file_id)
            else:
                return jsonify({"message": "Invalid Google Drive URL"}), 400
        else:
            # For other URLs, we'd need to implement direct download
            return jsonify({"message": "Only Google Drive URLs supported currently"}), 501
        
        # Analyze ZIP contents
        file_list = []
        total_files = 0
        total_size = 0
        
        try:
            with zipfile.ZipFile(BytesIO(file_content), 'r') as zip_ref:
                for info in zip_ref.infolist():
                    if not info.is_dir():
                        file_entry = {
                            'filename': info.filename,
                            'size': info.file_size,
                            'compressed_size': info.compress_size,
                            'modified': info.date_time,
                            'crc': info.CRC,
                            'is_encrypted': info.flag_bits & 0x1 != 0
                        }
                        file_list.append(file_entry)
                        total_files += 1
                        total_size += info.file_size
                
        except zipfile.BadZipFile:
            return jsonify({"message": "Invalid or corrupted ZIP file"}), 400
        except zipfile.LargeZipFile:
            return jsonify({"message": "ZIP file is too large to process"}), 400
        
        return jsonify({
            "message": "ZIP analysis completed",
            "archive_info": {
                "filename": filename,
                "total_files": total_files,
                "total_size": total_size,
                "files": file_list
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error analyzing ZIP file: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to analyze ZIP file", "error": str(e)}), 500


@enhanced_file_bp.route("/extract-zip", methods=["POST"])
@instructor_required 
def extract_zip_contents():
    """Extract specific files from a ZIP archive"""
    try:
        data = request.get_json()
        file_url = data.get('file_url')
        extract_files = data.get('files', [])  # List of filenames to extract
        
        if not file_url:
            return jsonify({"message": "File URL is required"}), 400
        
        # Download the ZIP file
        if 'drive.google.com' in file_url:
            import re
            file_id_match = re.search(r'/d/([a-zA-Z0-9-_]+)', file_url)
            if file_id_match:
                file_id = file_id_match.group(1)
                drive_service = GoogleDriveService()
                file_content = drive_service.download_file(file_id)
            else:
                return jsonify({"message": "Invalid Google Drive URL"}), 400
        else:
            return jsonify({"message": "Only Google Drive URLs supported currently"}), 501
        
        extracted_files = []
        
        try:
            with zipfile.ZipFile(BytesIO(file_content), 'r') as zip_ref:
                for filename in extract_files:
                    try:
                        file_data = zip_ref.read(filename)
                        
                        # Create a temporary file-like object
                        file_buffer = BytesIO(file_data)
                        
                        # Determine MIME type
                        mime_type, _ = mimetypes.guess_type(filename)
                        if not mime_type:
                            mime_type = 'application/octet-stream'
                        
                        extracted_files.append({
                            'filename': filename,
                            'size': len(file_data),
                            'mime_type': mime_type,
                            'data': file_data.hex()  # Convert to hex for JSON transmission
                        })
                        
                    except KeyError:
                        logger.warning(f"File {filename} not found in ZIP archive")
                        continue
                        
        except zipfile.BadZipFile:
            return jsonify({"message": "Invalid or corrupted ZIP file"}), 400
        
        return jsonify({
            "message": f"Extracted {len(extracted_files)} files",
            "files": extracted_files
        }), 200
        
    except Exception as e:
        logger.error(f"Error extracting ZIP contents: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to extract ZIP contents", "error": str(e)}), 500


@enhanced_file_bp.route("/preview/<path:file_path>", methods=["GET"])
@instructor_required
def preview_file(file_path):
    """Generate preview for a file (thumbnails, text content, etc.)"""
    try:
        # This is a placeholder for file preview generation
        # Could integrate with services like ImageMagick, FFmpeg, etc.
        return jsonify({
            "message": "File preview generation not yet implemented",
            "file_path": file_path
        }), 501
        
    except Exception as e:
        logger.error(f"Error generating file preview: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to generate preview", "error": str(e)}), 500