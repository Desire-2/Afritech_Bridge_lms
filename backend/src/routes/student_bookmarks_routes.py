# Student Bookmarks Routes - Course bookmarking functionality
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps

from ..models.user_models import User, db
from ..models.student_models import StudentBookmark
from ..models.course_models import Course

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

bookmarks_bp = Blueprint("student_bookmarks", __name__, url_prefix="/api/v1/student/bookmarks")

@bookmarks_bp.route("/", methods=["GET"])
@student_required
def get_student_bookmarks():
    """Get all bookmarks by the student"""
    current_user_id = int(get_jwt_identity())
    bookmarks = StudentBookmark.query.filter_by(student_id=current_user_id).all()
    
    result = []
    for bookmark in bookmarks:
        bookmark_data = bookmark.to_dict()
        if bookmark.course:
            bookmark_data['course'] = bookmark.course.to_dict()
        result.append(bookmark_data)
    
    return jsonify(result), 200

@bookmarks_bp.route("/", methods=["POST"])
@student_required
def create_bookmark():
    """Bookmark a course"""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    course_id = data.get('course_id')
    
    if not course_id:
        return jsonify({"message": "Course ID is required"}), 400
    
    course = Course.query.get(course_id)
    if not course:
        return jsonify({"message": "Course not found"}), 404
    
    # Check if already bookmarked
    existing_bookmark = StudentBookmark.query.filter_by(
        student_id=current_user_id, 
        course_id=course_id
    ).first()
    
    if existing_bookmark:
        return jsonify({"message": "Course already bookmarked"}), 400
    
    bookmark = StudentBookmark(
        student_id=current_user_id,
        course_id=course_id
    )
    
    db.session.add(bookmark)
    db.session.commit()
    
    return jsonify(bookmark.to_dict()), 201

@bookmarks_bp.route("/<int:course_id>", methods=["DELETE"])
@student_required
def remove_bookmark(course_id):
    """Remove a course bookmark"""
    current_user_id = int(get_jwt_identity())
    bookmark = StudentBookmark.query.filter_by(
        student_id=current_user_id, 
        course_id=course_id
    ).first()
    
    if not bookmark:
        return jsonify({"message": "Bookmark not found"}), 404
    
    db.session.delete(bookmark)
    db.session.commit()
    
    return jsonify({"message": "Bookmark removed successfully"}), 200