"""Forum routes for community discussions"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.student_models import StudentForum, ForumPost, ForumSubscription, ForumPostLike
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
        if hasattr(current_user, 'role') and current_user.role and current_user.role.name == 'student':
            enrolled_courses = db.session.query(Enrollment.course_id).filter_by(
                student_id=current_user.id,
                status='active'
            ).all()
            enrolled_course_ids = [c[0] for c in enrolled_courses]

        # Get general forums (no course_id)
        general_forums_query = StudentForum.query.filter(
            StudentForum.is_active == True,
            StudentForum.course_id == None
        )
        general_forums = general_forums_query.order_by(StudentForum.created_at.desc()).all()
        
        # Get course forums
        course_forums = []
        if enrolled_course_ids:
            course_forums_query = StudentForum.query.filter(
                StudentForum.is_active == True,
                StudentForum.course_id.in_(enrolled_course_ids)
            )
            course_forums = course_forums_query.order_by(StudentForum.created_at.desc()).all()
        
        # Convert forums to dict format
        general_forums_data = []
        for forum in general_forums:
            forum_dict = {
                'id': forum.id,
                'title': forum.title,
                'description': forum.description,
                'course_id': forum.course_id,
                'course_title': None,
                'created_by': forum.created_by,
                'created_at': forum.created_at.isoformat() if forum.created_at else None,
                'updated_at': forum.updated_at.isoformat() if forum.updated_at else None,
                'is_active': forum.is_active,
                'thread_count': 0,
                'post_count': 0,
                'is_public': True,
                'can_post': True,
                'can_moderate': current_user.role.name in ['admin', 'instructor'] if current_user.role else False
            }
            
            # Count posts for this forum
            post_count = ForumPost.query.filter_by(forum_id=forum.id, is_active=True).count()
            forum_dict['post_count'] = post_count
            forum_dict['thread_count'] = post_count  # Using post count as thread count for now
            
            general_forums_data.append(forum_dict)
        
        course_forums_data = []
        for forum in course_forums:
            # Get course title if available
            course_title = None
            if forum.course_id:
                from src.models.course_models import Course
                course = Course.query.get(forum.course_id)
                course_title = course.title if course else None
            
            forum_dict = {
                'id': forum.id,
                'title': forum.title,
                'description': forum.description,
                'course_id': forum.course_id,
                'course_title': course_title,
                'created_by': forum.created_by,
                'created_at': forum.created_at.isoformat() if forum.created_at else None,
                'updated_at': forum.updated_at.isoformat() if forum.updated_at else None,
                'is_active': forum.is_active,
                'thread_count': 0,
                'post_count': 0,
                'is_public': True,
                'can_post': True,
                'can_moderate': current_user.role.name in ['admin', 'instructor'] if current_user.role else False
            }
            
            # Count posts for this forum
            post_count = ForumPost.query.filter_by(forum_id=forum.id, is_active=True).count()
            forum_dict['post_count'] = post_count
            forum_dict['thread_count'] = post_count
            
            course_forums_data.append(forum_dict)
        
        return jsonify({
            'success': True,
            'data': {
                'general_forums': general_forums_data,
                'course_forums': course_forums_data,
                'categories': {},
                'total_forums': len(general_forums_data) + len(course_forums_data),
                'user_role': current_user.role.name if current_user.role else 'student'
            }
        })
        
    except Exception as e:
        print(f"Error in get_all_forums: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

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
            'data': {
                'notifications': [],
                'unread_count': 0
            }
        })
        
    except Exception as e:
        print(f"Error fetching notifications: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

# Helper functions and additional routes would go here

@forum_bp.route("/", methods=["POST"])
@instructor_or_admin_required
def create_forum(current_user):
    """Create a new forum (Admin/Instructor only)"""
    try:
        data = request.get_json()
        
        title = data.get('title', '').strip()
        description = data.get('description', '').strip()
        category = data.get('category', '').strip()
        course_id = data.get('course_id')
        is_pinned = data.get('is_pinned', False)
        allow_anonymous = data.get('allow_anonymous', False)
        moderated = data.get('moderated', False)
        
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
            
            # Check if instructor has access to this course
            if current_user.role.name == 'instructor':
                # Instructor should be assigned to this course
                # Add course instructor relationship check here if model exists
                pass
        
        # Create new forum
        new_forum = StudentForum(
            title=title,
            description=description,
            category=category,
            course_id=course_id,
            created_by=current_user.id,
            is_pinned=is_pinned and current_user.role.name == 'admin',  # Only admins can pin
            allow_anonymous=allow_anonymous,
            moderated=moderated
        )
        
        db.session.add(new_forum)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Forum created successfully',
            'data': new_forum.to_dict()
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
def get_forum_details(current_user, forum_id):
    """Get detailed information about a specific forum"""
    try:
        forum = StudentForum.query.get(forum_id)
        
        if not forum or not forum.is_active:
            return jsonify({
                'success': False,
                'error': 'Forum not found'
            }), 404
        
        # Check access permissions
        if forum.course_id and current_user.role.name == 'student':
            enrollment = Enrollment.query.filter_by(
                student_id=current_user.id,
                course_id=forum.course_id
            ).first()
            
            if not enrollment:
                return jsonify({
                    'success': False,
                    'error': 'You must be enrolled in this course to access this forum'
                }), 403
        
        # Increment view count
        forum.view_count = (forum.view_count or 0) + 1
        db.session.commit()
        
        forum_dict = forum.to_dict()
        
        # Get threads (top-level posts) with enhanced info
        threads_query = ForumPost.query.filter_by(
            forum_id=forum_id,
            parent_post_id=None,
            is_active=True
        )
        
        # Only show approved posts unless user can moderate
        if current_user.role.name not in ['admin', 'instructor']:
            threads_query = threads_query.filter_by(is_approved=True)
        
        threads = threads_query.order_by(
            ForumPost.is_pinned.desc(),
            ForumPost.created_at.desc()
        ).all()
        
        threads_list = []
        for thread in threads:
            thread_dict = thread.to_dict()
            
            # Get reply count (approved only for non-moderators)
            reply_query = ForumPost.query.filter_by(
                parent_post_id=thread.id,
                is_active=True
            )
            if current_user.role.name not in ['admin', 'instructor']:
                reply_query = reply_query.filter_by(is_approved=True)
            
            reply_count = reply_query.count()
            thread_dict['reply_count'] = reply_count
            
            # Get last reply
            last_reply = reply_query.order_by(ForumPost.created_at.desc()).first()
            
            if last_reply:
                thread_dict['last_reply'] = {
                    'author_name': last_reply.author_name,
                    'created_at': last_reply.created_at.isoformat()
                }
            
            # Check if current user has liked/disliked
            user_like = ForumPostLike.query.filter_by(
                post_id=thread.id,
                user_id=current_user.id
            ).first()
            
            thread_dict['user_reaction'] = {
                'liked': user_like.is_like if user_like else None,
                'can_edit': thread.author_id == current_user.id or current_user.role.name in ['admin', 'instructor'],
                'can_delete': thread.author_id == current_user.id or current_user.role.name == 'admin'
            }
            
            threads_list.append(thread_dict)
        
        forum_dict['threads'] = threads_list
        forum_dict['can_post'] = not forum.is_locked
        forum_dict['can_moderate'] = current_user.role.name in ['admin', 'instructor']
        
        # Check if user is subscribed
        subscription = ForumSubscription.query.filter_by(
            user_id=current_user.id,
            forum_id=forum_id,
            subscription_type='forum',
            is_active=True
        ).first()
        forum_dict['is_subscribed'] = bool(subscription)
        
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


@forum_bp.route("/<int:forum_id>", methods=["PUT"])
@instructor_or_admin_required
def update_forum(current_user, forum_id):
    """Update forum details"""
    try:
        forum = StudentForum.query.get(forum_id)
        
        if not forum:
            return jsonify({
                'success': False,
                'error': 'Forum not found'
            }), 404
        
        # Check permissions
        if current_user.role.name == 'instructor' and forum.created_by != current_user.id:
            return jsonify({
                'success': False,
                'error': 'You can only edit forums you created'
            }), 403
        
        data = request.get_json()
        
        # Update allowed fields
        if 'title' in data:
            forum.title = data['title'].strip()
        if 'description' in data:
            forum.description = data['description'].strip()
        if 'category' in data:
            forum.category = data['category'].strip()
        if 'is_locked' in data:
            forum.is_locked = data['is_locked']
        if 'moderated' in data:
            forum.moderated = data['moderated']
        
        # Only admins can pin forums
        if 'is_pinned' in data and current_user.role.name == 'admin':
            forum.is_pinned = data['is_pinned']
        
        forum.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Forum updated successfully',
            'data': forum.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating forum: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to update forum'
        }), 500


@forum_bp.route("/<int:forum_id>", methods=["DELETE"])
@admin_required
def delete_forum(current_user, forum_id):
    """Delete forum (Admin only)"""
    try:
        forum = StudentForum.query.get(forum_id)
        
        if not forum:
            return jsonify({
                'success': False,
                'error': 'Forum not found'
            }), 404
        
        # Soft delete - set is_active to False
        forum.is_active = False
        forum.updated_at = datetime.utcnow()
        
        # Also soft delete all posts in this forum
        ForumPost.query.filter_by(forum_id=forum_id).update({'is_active': False})
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Forum deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting forum: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to delete forum'
        }), 500


# === Thread Management Routes ===

@forum_bp.route("/<int:forum_id>/threads", methods=["POST"])
@any_authenticated_user
def create_thread(current_user, forum_id):
    """Create a new thread in a forum"""
    try:
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
        
        if forum.is_locked:
            return jsonify({
                'success': False,
                'error': 'This forum is locked'
            }), 403
        
        # Check if user has access to post (for course forums)
        if forum.course_id and current_user.role.name == 'student':
            enrollment = Enrollment.query.filter_by(
                student_id=current_user.id,
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
            author_id=current_user.id,
            title=title,
            content=content,
            is_approved=not forum.moderated or current_user.role.name in ['admin', 'instructor']
        )
        
        db.session.add(new_thread)
        db.session.flush()  # Get the ID
        
        # Auto-subscribe author to thread
        subscription = ForumSubscription(
            user_id=current_user.id,
            thread_id=new_thread.id,
            subscription_type='thread'
        )
        db.session.add(subscription)
        
        # Update forum timestamp
        forum.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Thread created successfully' + 
                      (' (pending approval)' if forum.moderated and current_user.role.name == 'student' else ''),
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
@any_authenticated_user
def get_thread_details(current_user, thread_id):
    """Get thread details with all replies"""
    try:
        thread = ForumPost.query.get(thread_id)
        
        if not thread or not thread.is_active or thread.parent_post_id is not None:
            return jsonify({
                'success': False,
                'error': 'Thread not found'
            }), 404
        
        # Check access permissions
        if thread.forum.course_id and current_user.role.name == 'student':
            enrollment = Enrollment.query.filter_by(
                student_id=current_user.id,
                course_id=thread.forum.course_id
            ).first()
            
            if not enrollment:
                return jsonify({
                    'success': False,
                    'error': 'Access denied'
                }), 403
        
        # Check if post is approved or user can see unapproved posts
        if not thread.is_approved and current_user.role.name not in ['admin', 'instructor'] and thread.author_id != current_user.id:
            return jsonify({
                'success': False,
                'error': 'Thread not found'
            }), 404
        
        # Increment view count
        thread.view_count = (thread.view_count or 0) + 1
        db.session.commit()
        
        thread_dict = thread.to_dict()
        
        # Get all replies with enhanced info
        replies_query = ForumPost.query.filter_by(
            parent_post_id=thread_id,
            is_active=True
        )
        
        # Filter approved replies for non-moderators
        if current_user.role.name not in ['admin', 'instructor']:
            replies_query = replies_query.filter(
                or_(
                    ForumPost.is_approved == True,
                    ForumPost.author_id == current_user.id
                )
            )
        
        replies = replies_query.order_by(ForumPost.created_at.asc()).all()
        
        replies_list = []
        for reply in replies:
            reply_dict = reply.to_dict()
            
            # Check user reaction
            user_like = ForumPostLike.query.filter_by(
                post_id=reply.id,
                user_id=current_user.id
            ).first()
            
            reply_dict['user_reaction'] = {
                'liked': user_like.is_like if user_like else None,
                'can_edit': reply.author_id == current_user.id or current_user.role.name in ['admin', 'instructor'],
                'can_delete': reply.author_id == current_user.id or current_user.role.name == 'admin'
            }
            
            replies_list.append(reply_dict)
        
        thread_dict['replies'] = replies_list
        
        # Check user permissions and reactions for thread
        user_like = ForumPostLike.query.filter_by(
            post_id=thread_id,
            user_id=current_user.id
        ).first()
        
        thread_dict['user_reaction'] = {
            'liked': user_like.is_like if user_like else None,
            'can_edit': thread.author_id == current_user.id or current_user.role.name in ['admin', 'instructor'],
            'can_delete': thread.author_id == current_user.id or current_user.role.name == 'admin',
            'can_pin': current_user.role.name in ['admin', 'instructor'],
            'can_lock': current_user.role.name in ['admin', 'instructor']
        }
        
        # Check if user is subscribed to thread
        subscription = ForumSubscription.query.filter_by(
            user_id=current_user.id,
            thread_id=thread_id,
            subscription_type='thread',
            is_active=True
        ).first()
        thread_dict['is_subscribed'] = bool(subscription)
        
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
@any_authenticated_user
def create_reply(current_user, thread_id):
    """Reply to a thread"""
    try:
        data = request.get_json()
        
        content = data.get('content', '').strip()
        
        if not content:
            return jsonify({
                'success': False,
                'error': 'Content is required'
            }), 400
        
        # Check if thread exists
        thread = ForumPost.query.get(thread_id)
        if not thread or not thread.is_active or thread.parent_post_id is not None:
            return jsonify({
                'success': False,
                'error': 'Thread not found'
            }), 404
        
        if thread.is_locked:
            return jsonify({
                'success': False,
                'error': 'This thread is locked'
            }), 403
        
        # Check access permissions
        if thread.forum.course_id and current_user.role.name == 'student':
            enrollment = Enrollment.query.filter_by(
                student_id=current_user.id,
                course_id=thread.forum.course_id
            ).first()
            
            if not enrollment:
                return jsonify({
                    'success': False,
                    'error': 'You must be enrolled in this course to reply'
                }), 403
        
        # Create reply
        reply = ForumPost(
            forum_id=thread.forum_id,
            author_id=current_user.id,
            title=f"Re: {thread.title}",
            content=content,
            parent_post_id=thread_id,
            is_approved=not thread.forum.moderated or current_user.role.name in ['admin', 'instructor']
        )
        
        db.session.add(reply)
        db.session.flush()
        
        # Update thread and forum timestamps
        thread.updated_at = datetime.utcnow()
        thread.forum.updated_at = datetime.utcnow()
        
        # Create notifications for thread subscribers
        subscribers = ForumSubscription.query.filter_by(
            thread_id=thread_id,
            subscription_type='thread',
            is_active=True,
            notify_replies=True
        ).filter(ForumSubscription.user_id != current_user.id).all()
        
        for subscription in subscribers:
            notification = ForumNotification(
                user_id=subscription.user_id,
                forum_id=thread.forum_id,
                post_id=reply.id,
                notification_type='new_reply',
                title=f'New reply in "{thread.title}"',
                message=f'{current_user.first_name} {current_user.last_name} replied to a thread you\'re following.'
            )
            db.session.add(notification)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Reply posted successfully' + 
                      (' (pending approval)' if thread.forum.moderated and current_user.role.name == 'student' else ''),
            'data': reply.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creating reply: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to create reply'
        }), 500


# === Post Management Routes ===

@forum_bp.route("/posts/<int:post_id>", methods=["PUT"])
@any_authenticated_user
def edit_post(current_user, post_id):
    """Edit a forum post"""
    try:
        post = ForumPost.query.get(post_id)
        
        if not post or not post.is_active:
            return jsonify({
                'success': False,
                'error': 'Post not found'
            }), 404
        
        # Check permissions
        if post.author_id != current_user.id and current_user.role.name not in ['admin', 'instructor']:
            return jsonify({
                'success': False,
                'error': 'You can only edit your own posts'
            }), 403
        
        data = request.get_json()
        
        if 'content' in data:
            post.content = data['content'].strip()
            post.is_edited = True
            post.updated_at = datetime.utcnow()
        
        if 'title' in data and post.parent_post_id is None:  # Only threads can have title edited
            post.title = data['title'].strip()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Post updated successfully',
            'data': post.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error editing post: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to edit post'
        }), 500


@forum_bp.route("/posts/<int:post_id>", methods=["DELETE"])
@any_authenticated_user
def delete_post(current_user, post_id):
    """Delete a forum post"""
    try:
        post = ForumPost.query.get(post_id)
        
        if not post or not post.is_active:
            return jsonify({
                'success': False,
                'error': 'Post not found'
            }), 404
        
        # Check permissions
        if post.author_id != current_user.id and current_user.role.name != 'admin':
            return jsonify({
                'success': False,
                'error': 'You can only delete your own posts'
            }), 403
        
        # Soft delete
        post.is_active = False
        post.updated_at = datetime.utcnow()
        
        # If it's a thread, also soft delete all replies
        if post.parent_post_id is None:
            ForumPost.query.filter_by(parent_post_id=post_id).update({'is_active': False})
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Post deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting post: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to delete post'
        }), 500


@forum_bp.route("/posts/<int:post_id>/pin", methods=["POST"])
@instructor_or_admin_required
def pin_post(current_user, post_id):
    """Pin/unpin a post"""
    try:
        post = ForumPost.query.get(post_id)
        
        if not post or not post.is_active:
            return jsonify({
                'success': False,
                'error': 'Post not found'
            }), 404
        
        data = request.get_json()
        is_pinned = data.get('pinned', not post.is_pinned)
        
        post.is_pinned = is_pinned
        post.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Post {"pinned" if is_pinned else "unpinned"} successfully',
            'data': {'is_pinned': is_pinned}
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error pinning post: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to pin post'
        }), 500


@forum_bp.route("/posts/<int:post_id>/lock", methods=["POST"])
@instructor_or_admin_required
def lock_post(current_user, post_id):
    """Lock/unlock a post"""
    try:
        post = ForumPost.query.get(post_id)
        
        if not post or not post.is_active:
            return jsonify({
                'success': False,
                'error': 'Post not found'
            }), 404
        
        data = request.get_json()
        is_locked = data.get('locked', not post.is_locked)
        
        post.is_locked = is_locked
        post.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Post {"locked" if is_locked else "unlocked"} successfully',
            'data': {'is_locked': is_locked}
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error locking post: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to lock post'
        }), 500



# === Post Interaction Routes ===

@forum_bp.route("/posts/<int:post_id>/like", methods=["POST"])
@any_authenticated_user
def like_post(current_user, post_id):
    """Like or dislike a post"""
    try:
        post = ForumPost.query.get(post_id)
        
        if not post or not post.is_active:
            return jsonify({
                'success': False,
                'error': 'Post not found'
            }), 404
        
        data = request.get_json()
        is_like = data.get('is_like', True)  # True for like, False for dislike
        
        # Check if user already reacted
        existing_like = ForumPostLike.query.filter_by(
            post_id=post_id,
            user_id=current_user.id
        ).first()
        
        if existing_like:
            if existing_like.is_like == is_like:
                # Remove reaction if same as current
                db.session.delete(existing_like)
                # Update post counters
                if is_like:
                    post.like_count = max(0, (post.like_count or 0) - 1)
                else:
                    post.dislike_count = max(0, (post.dislike_count or 0) - 1)
                action = 'removed'
            else:
                # Change reaction
                if existing_like.is_like:
                    post.like_count = max(0, (post.like_count or 0) - 1)
                    post.dislike_count = (post.dislike_count or 0) + 1
                else:
                    post.dislike_count = max(0, (post.dislike_count or 0) - 1)
                    post.like_count = (post.like_count or 0) + 1
                existing_like.is_like = is_like
                action = 'changed'
        else:
            # New reaction
            new_like = ForumPostLike(
                post_id=post_id,
                user_id=current_user.id,
                is_like=is_like
            )
            db.session.add(new_like)
            
            if is_like:
                post.like_count = (post.like_count or 0) + 1
            else:
                post.dislike_count = (post.dislike_count or 0) + 1
            action = 'added'
        
        # Create notification for post author (if not self-like)
        if current_user.id != post.author_id and action != 'removed' and is_like:
            notification = ForumNotification(
                user_id=post.author_id,
                forum_id=post.forum_id,
                post_id=post_id,
                notification_type='post_liked',
                title=f'Your post was liked',
                message=f'{current_user.first_name} {current_user.last_name} liked your post "{post.title}".'
            )
            db.session.add(notification)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Reaction {action} successfully',
            'data': {
                'like_count': post.like_count or 0,
                'dislike_count': post.dislike_count or 0,
                'user_reaction': is_like if action != 'removed' else None
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error liking post: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to react to post'
        }), 500


@forum_bp.route("/posts/<int:post_id>/flag", methods=["POST"])
@any_authenticated_user
def flag_post(current_user, post_id):
    """Flag a post for moderation"""
    try:
        post = ForumPost.query.get(post_id)
        
        if not post or not post.is_active:
            return jsonify({
                'success': False,
                'error': 'Post not found'
            }), 404
        
        data = request.get_json()
        reason = data.get('reason', '').strip()
        
        if not reason:
            return jsonify({
                'success': False,
                'error': 'Flag reason is required'
            }), 400
        
        post.is_flagged = True
        post.flag_reason = reason
        post.updated_at = datetime.utcnow()
        
        # Create notification for moderators
        moderators = User.query.join(Role).filter(
            Role.name.in_(['admin', 'instructor'])
        ).all()
        
        for moderator in moderators:
            notification = ForumNotification(
                user_id=moderator.id,
                forum_id=post.forum_id,
                post_id=post_id,
                notification_type='post_flagged',
                title=f'Post flagged for review',
                message=f'A post in "{post.forum.title}" has been flagged: {reason}'
            )
            db.session.add(notification)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Post flagged successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error flagging post: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to flag post'
        }), 500


# === Subscription Routes ===

@forum_bp.route("/<int:forum_id>/subscribe", methods=["POST"])
@any_authenticated_user
def subscribe_to_forum(current_user, forum_id):
    """Subscribe to forum notifications"""
    try:
        forum = StudentForum.query.get(forum_id)
        
        if not forum or not forum.is_active:
            return jsonify({
                'success': False,
                'error': 'Forum not found'
            }), 404
        
        existing_subscription = ForumSubscription.query.filter_by(
            user_id=current_user.id,
            forum_id=forum_id,
            subscription_type='forum'
        ).first()
        
        if existing_subscription:
            existing_subscription.is_active = not existing_subscription.is_active
            action = 'subscribed' if existing_subscription.is_active else 'unsubscribed'
        else:
            new_subscription = ForumSubscription(
                user_id=current_user.id,
                forum_id=forum_id,
                subscription_type='forum'
            )
            db.session.add(new_subscription)
            action = 'subscribed'
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Successfully {action} to forum',
            'data': {'is_subscribed': action == 'subscribed'}
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error subscribing to forum: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to subscribe to forum'
        }), 500


@forum_bp.route("/threads/<int:thread_id>/subscribe", methods=["POST"])
@any_authenticated_user
def subscribe_to_thread(current_user, thread_id):
    """Subscribe to thread notifications"""
    try:
        thread = ForumPost.query.get(thread_id)
        
        if not thread or not thread.is_active or thread.parent_post_id is not None:
            return jsonify({
                'success': False,
                'error': 'Thread not found'
            }), 404
        
        existing_subscription = ForumSubscription.query.filter_by(
            user_id=current_user.id,
            thread_id=thread_id,
            subscription_type='thread'
        ).first()
        
        if existing_subscription:
            existing_subscription.is_active = not existing_subscription.is_active
            action = 'subscribed' if existing_subscription.is_active else 'unsubscribed'
        else:
            new_subscription = ForumSubscription(
                user_id=current_user.id,
                thread_id=thread_id,
                subscription_type='thread'
            )
            db.session.add(new_subscription)
            action = 'subscribed'
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Successfully {action} to thread',
            'data': {'is_subscribed': action == 'subscribed'}
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error subscribing to thread: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to subscribe to thread'
        }), 500


# === Search and Discovery Routes ===

@forum_bp.route("/search", methods=["GET"])
@any_authenticated_user
def search_forums(current_user):
    """Enhanced search forums and threads"""
    try:
        query = request.args.get('q', '').strip()
        category = request.args.get('category')
        forum_id = request.args.get('forum_id', type=int)
        sort_by = request.args.get('sort', 'relevance')  # relevance, date, popularity
        
        if not query:
            return jsonify({
                'success': False,
                'error': 'Search query is required'
            }), 400
        
        # Search forums
        forums_query = StudentForum.query.filter(
            StudentForum.is_active == True,
            or_(
                StudentForum.title.ilike(f'%{query}%'),
                StudentForum.description.ilike(f'%{query}%')
            )
        )
        
        if category:
            forums_query = forums_query.filter(StudentForum.category == category)
        
        if current_user.role.name == 'student':
            # Apply enrollment filtering for students
            enrolled_course_ids = db.session.query(Enrollment.course_id).filter_by(
                student_id=current_user.id
            ).all()
            enrolled_course_ids = [c[0] for c in enrolled_course_ids]
            
            forums_query = forums_query.filter(
                or_(
                    StudentForum.course_id == None,
                    StudentForum.course_id.in_(enrolled_course_ids)
                )
            )
        
        forums = forums_query.all()
        
        # Search threads
        threads_query = ForumPost.query.filter(
            ForumPost.is_active == True,
            ForumPost.is_approved == True,
            ForumPost.parent_post_id == None,
            or_(
                ForumPost.title.ilike(f'%{query}%'),
                ForumPost.content.ilike(f'%{query}%')
            )
        )
        
        if forum_id:
            threads_query = threads_query.filter(ForumPost.forum_id == forum_id)
        
        if sort_by == 'date':
            threads_query = threads_query.order_by(ForumPost.created_at.desc())
        elif sort_by == 'popularity':
            threads_query = threads_query.order_by(ForumPost.like_count.desc())
        
        threads = threads_query.all()
        
        return jsonify({
            'success': True,
            'data': {
                'forums': [f.to_dict() for f in forums],
                'threads': [t.to_dict() for t in threads],
                'total_results': len(forums) + len(threads)
            }
        }), 200
        
    except Exception as e:
        print(f"Error searching forums: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to search forums'
        }), 500


@forum_bp.route("/categories", methods=["GET"])
@any_authenticated_user
def get_forum_categories(current_user):
    """Get all forum categories"""
    try:
        categories = db.session.query(StudentForum.category).filter(
            StudentForum.category != None,
            StudentForum.is_active == True
        ).distinct().all()
        
        categories = [c[0] for c in categories if c[0]]
        
        return jsonify({
            'success': True,
            'data': {'categories': categories}
        }), 200
        
    except Exception as e:
        print(f"Error fetching categories: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch categories'
        }), 500


@forum_bp.route("/my-posts", methods=["GET"])
@any_authenticated_user
def get_my_posts(current_user):
    """Get current user's forum posts and threads"""
    try:
        posts = ForumPost.query.filter_by(
            author_id=current_user.id,
            is_active=True
        ).order_by(ForumPost.created_at.desc()).all()
        
        threads = []
        replies = []
        
        for post in posts:
            post_dict = post.to_dict()
            # Add forum information
            post_dict['forum_title'] = post.forum.title
            post_dict['forum_id'] = post.forum.id
            
            if post.parent_post_id is None:
                threads.append(post_dict)
            else:
                replies.append(post_dict)
        
        return jsonify({
            'success': True,
            'data': {
                'threads': threads,
                'replies': replies,
                'total_posts': len(posts)
            }
        }), 200
        
    except Exception as e:
        print(f"Error fetching user posts: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch posts'
        }), 500


@forum_bp.route("/notifications", methods=["GET"])
@any_authenticated_user
def get_forum_notifications(current_user):
    """Get user's forum notifications"""
    try:
        notifications = ForumNotification.query.filter_by(
            user_id=current_user.id
        ).order_by(ForumNotification.created_at.desc()).limit(50).all()
        
        return jsonify({
            'success': True,
            'data': {
                'notifications': [n.to_dict() for n in notifications],
                'unread_count': sum(1 for n in notifications if not n.is_read)
            }
        }), 200
        
    except Exception as e:
        print(f"Error fetching notifications: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch notifications'
        }), 500


@forum_bp.route("/notifications/<int:notification_id>/read", methods=["POST"])
@any_authenticated_user
def mark_notification_read(current_user, notification_id):
    """Mark notification as read"""
    try:
        notification = ForumNotification.query.filter_by(
            id=notification_id,
            user_id=current_user.id
        ).first()
        
        if not notification:
            return jsonify({
                'success': False,
                'error': 'Notification not found'
            }), 404
        
        notification.is_read = True
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Notification marked as read'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error marking notification as read: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to mark notification as read'
        }), 500


# === Moderation Routes ===

@forum_bp.route("/moderation/pending", methods=["GET"])
@instructor_or_admin_required
def get_pending_posts(current_user):
    """Get posts pending approval"""
    try:
        pending_posts = ForumPost.query.filter_by(
            is_active=True,
            is_approved=False
        ).order_by(ForumPost.created_at.desc()).all()
        
        posts_data = []
        for post in pending_posts:
            post_dict = post.to_dict()
            post_dict['forum_title'] = post.forum.title
            posts_data.append(post_dict)
        
        return jsonify({
            'success': True,
            'data': {
                'pending_posts': posts_data,
                'total_count': len(pending_posts)
            }
        }), 200
        
    except Exception as e:
        print(f"Error fetching pending posts: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch pending posts'
        }), 500


@forum_bp.route("/moderation/posts/<int:post_id>/approve", methods=["POST"])
@instructor_or_admin_required
def approve_post(current_user, post_id):
    """Approve or reject a post"""
    try:
        post = ForumPost.query.get(post_id)
        
        if not post:
            return jsonify({
                'success': False,
                'error': 'Post not found'
            }), 404
        
        data = request.get_json()
        approve = data.get('approve', True)
        
        if approve:
            post.is_approved = True
            post.moderated_by = current_user.id
            post.moderated_at = datetime.utcnow()
            message = 'Post approved successfully'
        else:
            post.is_active = False
            post.moderated_by = current_user.id
            post.moderated_at = datetime.utcnow()
            message = 'Post rejected successfully'
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': message
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error moderating post: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to moderate post'
        }), 500


@forum_bp.route("/moderation/flagged", methods=["GET"])
@instructor_or_admin_required
def get_flagged_posts(current_user):
    """Get flagged posts for moderation"""
    try:
        flagged_posts = ForumPost.query.filter_by(
            is_active=True,
            is_flagged=True
        ).order_by(ForumPost.updated_at.desc()).all()
        
        posts_data = []
        for post in flagged_posts:
            post_dict = post.to_dict()
            post_dict['forum_title'] = post.forum.title
            posts_data.append(post_dict)
        
        return jsonify({
            'success': True,
            'data': {
                'flagged_posts': posts_data,
                'total_count': len(flagged_posts)
            }
        }), 200
        
    except Exception as e:
        print(f"Error fetching flagged posts: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch flagged posts'
        }), 500
