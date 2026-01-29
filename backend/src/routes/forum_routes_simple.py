"""Simplified Forum routes for community discussions"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.student_models import StudentForum, ForumPost
from src.models.course_models import Course, Enrollment
from src.models.user_models import User, Role, db
from datetime import datetime
from sqlalchemy import func, desc, or_, and_
from functools import wraps

# Role-based decorators
def role_required(*allowed_roles):
    def decorator(f):
        @wraps(f)
        @jwt_required()
        def decorated_function(*args, **kwargs):
            current_user_id = int(get_jwt_identity())
            user = User.query.get(current_user_id)
            if not user or not user.role or user.role.name not in allowed_roles:
                return jsonify({"message": f"Access denied. Required roles: {', '.join(allowed_roles)}"}), 403
            return f(current_user=user, *args, **kwargs)
        return decorated_function
    return decorator

def student_required(f):
    return role_required('student')(f)

def instructor_required(f):
    return role_required('instructor')(f)

def admin_required(f):
    return role_required('admin')(f)

def instructor_or_admin_required(f):
    return role_required('instructor', 'admin')(f)

def any_authenticated_user(f):
    return role_required('student', 'instructor', 'admin')(f)

forum_bp = Blueprint("forum_bp", __name__, url_prefix="/api/v1/forums")

# === Forum Management Routes ===

@forum_bp.route("/", methods=["GET"])
@any_authenticated_user
def get_all_forums(current_user):
    """Get all active forums"""
    try:
        # Get user's enrolled courses
        enrolled_course_ids = []
        if current_user.role.name == 'student':
            enrolled_course_ids = db.session.query(Enrollment.course_id).filter_by(
                student_id=current_user.id
            ).all()
            enrolled_course_ids = [c[0] for c in enrolled_course_ids]

        # Get all forums
        query = StudentForum.query.filter(StudentForum.is_active == True)
        
        # Apply role-based filtering
        if current_user.role.name == 'student':
            # Students see forums from their enrolled courses
            if enrolled_course_ids:
                query = query.filter(StudentForum.course_id.in_(enrolled_course_ids))
            else:
                query = query.filter(StudentForum.course_id == None)  # No courses, no forums
        
        forums = query.order_by(StudentForum.created_at.desc()).all()
        
        # Convert forums to dict format
        forums_data = [forum.to_dict() for forum in forums]
        
        return jsonify({
            'success': True,
            'general': forums_data,  # For compatibility with frontend
            'courses': [],
            'categories': {}
        })
        
    except Exception as e:
        print(f"Error fetching forums: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@forum_bp.route("/my-posts", methods=["GET"])
@any_authenticated_user
def get_user_posts(current_user):
    """Get current user's forum posts"""
    try:
        posts = ForumPost.query.filter_by(
            author_id=current_user.id,
            is_active=True
        ).order_by(ForumPost.created_at.desc()).all()
        
        posts_data = [post.to_dict() for post in posts]
        
        return jsonify({
            'success': True,
            'posts': posts_data
        })
        
    except Exception as e:
        print(f"Error fetching user posts: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@forum_bp.route("/notifications", methods=["GET"])
@any_authenticated_user
def get_notifications(current_user):
    """Get user notifications (basic implementation)"""
    try:
        # For now, return empty notifications since we don't have a notifications table
        return jsonify({
            'success': True,
            'notifications': []
        })
        
    except Exception as e:
        print(f"Error fetching notifications: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@forum_bp.route("/", methods=["POST"])
@instructor_or_admin_required
def create_forum(current_user):
    """Create a new forum (Admin/Instructor only)"""
    try:
        data = request.get_json()
        
        title = data.get('title', '').strip()
        description = data.get('description', '').strip()
        course_id = data.get('course_id')
        
        if not title:
            return jsonify({
                'success': False,
                'error': 'Title is required'
            }), 400
        
        # Validate course if specified
        if course_id:
            course = Course.query.get(course_id)
            if not course:
                return jsonify({
                    'success': False,
                    'error': 'Course not found'
                }), 404
        
        # Create new forum
        new_forum = StudentForum(
            title=title,
            description=description,
            course_id=course_id,
            created_by=current_user.id
        )
        
        db.session.add(new_forum)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': new_forum.to_dict(),
            'message': 'Forum created successfully'
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creating forum: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to create forum'
        }), 500

@forum_bp.route("/<int:forum_id>", methods=["GET"])
@any_authenticated_user
def get_forum(current_user, forum_id):
    """Get a specific forum with its posts"""
    try:
        forum = StudentForum.query.get(forum_id)
        if not forum or not forum.is_active:
            return jsonify({
                'success': False,
                'error': 'Forum not found'
            }), 404
        
        # Check access permissions for students
        if current_user.role.name == 'student' and forum.course_id:
            enrollment = Enrollment.query.filter_by(
                student_id=current_user.id,
                course_id=forum.course_id
            ).first()
            if not enrollment:
                return jsonify({
                    'success': False,
                    'error': 'Access denied'
                }), 403
        
        # Get forum posts (threads only, not replies)
        posts = ForumPost.query.filter_by(
            forum_id=forum_id,
            parent_post_id=None,
            is_active=True
        ).order_by(ForumPost.created_at.desc()).all()
        
        forum_data = forum.to_dict()
        posts_data = [post.to_dict() for post in posts]
        
        return jsonify({
            'success': True,
            'forum': forum_data,
            'posts': posts_data
        })
        
    except Exception as e:
        print(f"Error fetching forum: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch forum'
        }), 500

@forum_bp.route("/<int:forum_id>/posts", methods=["POST"])
@any_authenticated_user
def create_post(current_user, forum_id):
    """Create a new post in a forum"""
    try:
        forum = StudentForum.query.get(forum_id)
        if not forum or not forum.is_active:
            return jsonify({
                'success': False,
                'error': 'Forum not found'
            }), 404
        
        # Check access permissions for students
        if current_user.role.name == 'student' and forum.course_id:
            enrollment = Enrollment.query.filter_by(
                student_id=current_user.id,
                course_id=forum.course_id
            ).first()
            if not enrollment:
                return jsonify({
                    'success': False,
                    'error': 'Access denied'
                }), 403
        
        data = request.get_json()
        title = data.get('title', '').strip()
        content = data.get('content', '').strip()
        parent_post_id = data.get('parent_post_id')
        
        if not title or not content:
            return jsonify({
                'success': False,
                'error': 'Title and content are required'
            }), 400
        
        # Validate parent post if this is a reply
        if parent_post_id:
            parent_post = ForumPost.query.get(parent_post_id)
            if not parent_post or parent_post.forum_id != forum_id:
                return jsonify({
                    'success': False,
                    'error': 'Invalid parent post'
                }), 400
        
        # Create new post
        new_post = ForumPost(
            forum_id=forum_id,
            author_id=current_user.id,
            title=title,
            content=content,
            parent_post_id=parent_post_id
        )
        
        db.session.add(new_post)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': new_post.to_dict(),
            'message': 'Post created successfully'
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creating post: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to create post'
        }), 500

@forum_bp.route("/posts/<int:post_id>", methods=["GET"])
@any_authenticated_user
def get_post(current_user, post_id):
    """Get a specific post with its replies"""
    try:
        post = ForumPost.query.get(post_id)
        if not post or not post.is_active:
            return jsonify({
                'success': False,
                'error': 'Post not found'
            }), 404
        
        # Check forum access
        forum = post.forum
        if current_user.role.name == 'student' and forum.course_id:
            enrollment = Enrollment.query.filter_by(
                student_id=current_user.id,
                course_id=forum.course_id
            ).first()
            if not enrollment:
                return jsonify({
                    'success': False,
                    'error': 'Access denied'
                }), 403
        
        # Get replies
        replies = ForumPost.query.filter_by(
            parent_post_id=post_id,
            is_active=True
        ).order_by(ForumPost.created_at.asc()).all()
        
        post_data = post.to_dict()
        replies_data = [reply.to_dict() for reply in replies]
        
        return jsonify({
            'success': True,
            'post': post_data,
            'replies': replies_data
        })
        
    except Exception as e:
        print(f"Error fetching post: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch post'
        }), 500
