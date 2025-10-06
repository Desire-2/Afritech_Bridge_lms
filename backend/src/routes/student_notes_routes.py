# Student Notes Routes - Note-taking functionality for students
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps

from ..models.user_models import User, db
from ..models.student_models import StudentNote

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

notes_bp = Blueprint("student_notes", __name__, url_prefix="/api/v1/student/notes")

@notes_bp.route("/", methods=["GET"])
@student_required
def get_student_notes():
    """Get all notes by the student"""
    current_user_id = int(get_jwt_identity())
    lesson_id = request.args.get('lesson_id', type=int)
    
    query = StudentNote.query.filter_by(student_id=current_user_id)
    
    if lesson_id:
        query = query.filter_by(lesson_id=lesson_id)
    
    notes = query.order_by(StudentNote.updated_at.desc()).all()
    return jsonify([note.to_dict() for note in notes]), 200

@notes_bp.route("/", methods=["POST"])
@student_required
def create_student_note():
    """Create a new note"""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    note = StudentNote(
        student_id=current_user_id,
        lesson_id=data.get('lesson_id'),
        content=data.get('content'),
        title=data.get('title', 'Untitled Note')
    )
    
    db.session.add(note)
    db.session.commit()
    
    return jsonify(note.to_dict()), 201

@notes_bp.route("/<int:note_id>", methods=["PUT"])
@student_required
def update_student_note(note_id):
    """Update an existing note"""
    current_user_id = int(get_jwt_identity())
    note = StudentNote.query.filter_by(id=note_id, student_id=current_user_id).first()
    
    if not note:
        return jsonify({"message": "Note not found"}), 404
    
    data = request.get_json()
    note.content = data.get('content', note.content)
    note.title = data.get('title', note.title)
    
    db.session.commit()
    
    return jsonify(note.to_dict()), 200

@notes_bp.route("/<int:note_id>", methods=["DELETE"])
@student_required
def delete_student_note(note_id):
    """Delete a note"""
    current_user_id = int(get_jwt_identity())
    note = StudentNote.query.filter_by(id=note_id, student_id=current_user_id).first()
    
    if not note:
        return jsonify({"message": "Note not found"}), 404
    
    db.session.delete(note)
    db.session.commit()
    
    return jsonify({"message": "Note deleted successfully"}), 200