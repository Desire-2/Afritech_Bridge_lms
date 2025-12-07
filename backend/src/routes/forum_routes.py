"""Forum routes for community discussions"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.student_models import StudentForum, ForumPost
from src.models.course_models import Course, Enrollment
from src.models.user_models import User, db
from datetime import datetime
from sqlalchemy import func, desc
from functools import wraps

# Define student_required decorator locally
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

forum_bp = Blueprint("forum_bp", __name__, url_prefix="/api/v1/forums")

# --- Forum Routes ---

@forum_bp.route("/", methods=["GET"])
@jwt_required()
def get_all_forums():
    """Get all active forums grouped by course"""
    try:
        user_id = int(get_jwt_identity())
        
        # Get user's enrolled courses
        enrolled_course_ids = db.session.query(Enrollment.course_id).filter_by(
            student_id=user_id
        ).all()
        enrolled_course_ids = [c[0] for c in enrolled_course_ids]
        
        # Get all forums for enrolled courses and general forums
        forums = StudentForum.query.filter(
            StudentForum.is_active == True
        ).order_by(StudentForum.created_at.desc()).all()
        
        # Group forums by category
        general_forums = []
        course_forums = []
        
        for forum in forums:
            forum_dict = forum.to_dict()
            
            # Add statistics
            post_count = ForumPost.query.filter_by(
                forum_id=forum.id,
                is_active=True
            ).count()
            
            thread_count = ForumPost.query.filter_by(
                forum_id=forum.id,
                parent_post_id=None,
                is_active=True
            ).count()
            
            forum_dict['post_count'] = post_count
            forum_dict['thread_count'] = thread_count
            
            # Get last post info
            last_post = ForumPost.query.filter_by(
                forum_id=forum.id,
                is_active=True
            ).order_by(ForumPost.created_at.desc()).first()
            
            if last_post:
                forum_dict['last_post'] = {
                    'id': last_post.id,
                    'title': last_post.title,
                    'author_name': last_post.author_name,
                    'author_id': last_post.author_id,
                    'created_at': last_post.created_at.isoformat()
                }
            
            # Check if user is enrolled
            forum_dict['is_enrolled'] = forum.course_id in enrolled_course_ids if forum.course_id else True
            
            if forum.course_id:
                course_forums.append(forum_dict)
            else:
                general_forums.append(forum_dict)
        
        return jsonify({
            'success': True,
            'data': {
                'general_forums': general_forums,
                'course_forums': course_forums,
                'total_forums': len(forums)
            }
        }), 200
        
    except Exception as e:
        print(f"Error fetching forums: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch forums'
        }), 500


@forum_bp.route("/<int:forum_id>", methods=["GET"])
@jwt_required()
def get_forum_details(forum_id):
    """Get detailed information about a specific forum"""
    try:
        forum = StudentForum.query.get(forum_id)
        
        if not forum or not forum.is_active:
            return jsonify({
                'success': False,
                'error': 'Forum not found'
            }), 404
        
        forum_dict = forum.to_dict()
        
        # Get threads (top-level posts)
        threads = ForumPost.query.filter_by(
            forum_id=forum_id,
            parent_post_id=None,
            is_active=True
        ).order_by(ForumPost.created_at.desc()).all()
        
        threads_list = []
        for thread in threads:
            thread_dict = thread.to_dict()
            
            # Get reply count
            reply_count = ForumPost.query.filter_by(
                parent_post_id=thread.id,
                is_active=True
            ).count()
            thread_dict['reply_count'] = reply_count
            
            # Get last reply
            last_reply = ForumPost.query.filter_by(
                parent_post_id=thread.id,
                is_active=True
            ).order_by(ForumPost.created_at.desc()).first()
            
            if last_reply:
                thread_dict['last_reply'] = {
                    'author_name': last_reply.author_name,
                    'created_at': last_reply.created_at.isoformat()
                }
            
            threads_list.append(thread_dict)
        
        forum_dict['threads'] = threads_list
        
        return jsonify({
            'success': True,
            'data': forum_dict
        }), 200
        
    except Exception as e:
        print(f"Error fetching forum details: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch forum details'
        }), 500


@forum_bp.route("/<int:forum_id>/threads", methods=["POST"])
@student_required
def create_thread(forum_id):
    """Create a new thread in a forum"""
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json()
        
        title = data.get('title', '').strip()
        content = data.get('content', '').strip()
        
        if not title or not content:
            return jsonify({
                'success': False,
                'error': 'Title and content are required'
            }), 400
        
        # Check if forum exists
        forum = StudentForum.query.get(forum_id)
        if not forum or not forum.is_active:
            return jsonify({
                'success': False,
                'error': 'Forum not found'
            }), 404
        
        # Check if user is enrolled in course (if course-specific forum)
        if forum.course_id:
            enrollment = Enrollment.query.filter_by(
                student_id=user_id,
                course_id=forum.course_id
            ).first()
            
            if not enrollment:
                return jsonify({
                    'success': False,
                    'error': 'You must be enrolled in this course to post'
                }), 403
        
        # Create new thread
        new_thread = ForumPost(
            forum_id=forum_id,
            author_id=user_id,
            title=title,
            content=content
        )
        
        db.session.add(new_thread)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Thread created successfully',
            'data': new_thread.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creating thread: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to create thread'
        }), 500


@forum_bp.route("/threads/<int:thread_id>", methods=["GET"])
@jwt_required()
def get_thread_details(thread_id):
    """Get thread details with all replies"""
    try:
        thread = ForumPost.query.get(thread_id)
        
        if not thread or not thread.is_active or thread.parent_post_id is not None:
            return jsonify({
                'success': False,
                'error': 'Thread not found'
            }), 404
        
        thread_dict = thread.to_dict()
        
        # Get all replies
        replies = ForumPost.query.filter_by(
            parent_post_id=thread_id,
            is_active=True
        ).order_by(ForumPost.created_at.asc()).all()
        
        thread_dict['replies'] = [reply.to_dict() for reply in replies]
        
        return jsonify({
            'success': True,
            'data': thread_dict
        }), 200
        
    except Exception as e:
        print(f"Error fetching thread: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch thread'
        }), 500


@forum_bp.route("/threads/<int:thread_id>/replies", methods=["POST"])
@student_required
def create_reply(thread_id):
    """Reply to a thread"""
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json()
        
        content = data.get('content', '').strip()
        
        if not content:
            return jsonify({
                'success': False,
                'error': 'Content is required'
            }), 400
        
        # Check if thread exists
        thread = ForumPost.query.get(thread_id)
        if not thread or not thread.is_active:
            return jsonify({
                'success': False,
                'error': 'Thread not found'
            }), 404
        
        # Check if user is enrolled (if course-specific forum)
        forum = thread.forum
        if forum.course_id:
            enrollment = Enrollment.query.filter_by(
                student_id=user_id,
                course_id=forum.course_id
            ).first()
            
            if not enrollment:
                return jsonify({
                    'success': False,
                    'error': 'You must be enrolled in this course to reply'
                }), 403
        
        # Create reply
        reply = ForumPost(
            forum_id=thread.forum_id,
            author_id=user_id,
            title=f"Re: {thread.title}",
            content=content,
            parent_post_id=thread_id
        )
        
        db.session.add(reply)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Reply posted successfully',
            'data': reply.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creating reply: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to create reply'
        }), 500


@forum_bp.route("/search", methods=["GET"])
@jwt_required()
def search_forums():
    """Search forums and threads"""
    try:
        query = request.args.get('q', '').strip()
        
        if not query:
            return jsonify({
                'success': False,
                'error': 'Search query is required'
            }), 400
        
        # Search forums
        forums = StudentForum.query.filter(
            StudentForum.is_active == True,
            db.or_(
                StudentForum.title.ilike(f'%{query}%'),
                StudentForum.description.ilike(f'%{query}%')
            )
        ).all()
        
        # Search threads
        threads = ForumPost.query.filter(
            ForumPost.is_active == True,
            ForumPost.parent_post_id == None,
            db.or_(
                ForumPost.title.ilike(f'%{query}%'),
                ForumPost.content.ilike(f'%{query}%')
            )
        ).all()
        
        return jsonify({
            'success': True,
            'data': {
                'forums': [f.to_dict() for f in forums],
                'threads': [t.to_dict() for t in threads]
            }
        }), 200
        
    except Exception as e:
        print(f"Error searching forums: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to search forums'
        }), 500


@forum_bp.route("/my-posts", methods=["GET"])
@student_required
def get_my_posts():
    """Get current user's forum posts and threads"""
    try:
        user_id = int(get_jwt_identity())
        
        posts = ForumPost.query.filter_by(
            author_id=user_id,
            is_active=True
        ).order_by(ForumPost.created_at.desc()).all()
        
        threads = [p for p in posts if p.parent_post_id is None]
        replies = [p for p in posts if p.parent_post_id is not None]
        
        return jsonify({
            'success': True,
            'data': {
                'threads': [t.to_dict() for t in threads],
                'replies': [r.to_dict() for r in replies],
                'total_posts': len(posts)
            }
        }), 200
        
    except Exception as e:
        print(f"Error fetching user posts: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch posts'
        }), 500
