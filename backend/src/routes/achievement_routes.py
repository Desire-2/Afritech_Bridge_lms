# Achievement Routes - API endpoints for gamification features
# Handles achievements, streaks, leaderboards, quests, and points

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
from marshmallow import Schema, fields, ValidationError
import logging
from sqlalchemy import desc
from sqlalchemy.exc import SQLAlchemyError

from ..models.user_models import User, db
from ..models.achievement_models import (
    Achievement, UserAchievement, LearningStreak, Milestone, UserMilestone,
    Leaderboard, StudentPoints, QuestChallenge, UserQuestProgress
)
from ..services.achievement_service import AchievementService

# Set up logging
logger = logging.getLogger(__name__)

# Validation schemas
class TriggerAchievementSchema(Schema):
    event_type = fields.String(required=True, validate=lambda x: len(x.strip()) > 0)
    event_data = fields.Dict(missing={})

class ShowcaseAchievementSchema(Schema):
    showcase = fields.Boolean(missing=True)

class QuestStartSchema(Schema):
    pass  # No additional fields required

# Helper decorator for student access
def student_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        try:
            current_user_id = int(get_jwt_identity())
            user = User.query.get(current_user_id)
            
            if not user or not user.role:
                logger.warning(f"User {current_user_id} not found or has no role")
                return jsonify({"message": "Authentication required"}), 401
            
            # Allow both students and instructors to access achievement features
            if user.role.name not in ['student', 'instructor']:
                logger.warning(f"User {current_user_id} has role {user.role.name}, access denied")
                return jsonify({"message": "Student or Instructor access required"}), 403
                
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Error in student_required decorator: {str(e)}")
            return jsonify({"message": "Authentication error"}), 401
    return decorated_function

achievement_bp = Blueprint("achievements", __name__, url_prefix="/api/v1/achievements")

# ==================== Achievement Endpoints ====================

@achievement_bp.route("/", methods=["GET"])
@student_required
def get_all_achievements():
    """Get all available achievements with pagination (hide secret ones not yet earned)"""
    try:
        user_id = int(get_jwt_identity())
        
        # Get pagination parameters
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)  # Max 100 per page
        category = request.args.get('category', type=str)
        
        logger.info(f"Getting achievements for user {user_id}, page {page}")
        
        # Build query
        query = Achievement.query.filter_by(is_active=True)
        
        if category:
            query = query.filter(Achievement.category == category)
        
        # Paginate
        pagination = query.paginate(
            page=page, 
            per_page=per_page, 
            error_out=False
        )
        
        achievements = pagination.items
        
        # Get user's earned achievements
        earned_ids = [ua.achievement_id for ua in UserAchievement.query.filter_by(user_id=user_id).all()]
        
        result = []
        for achievement in achievements:
            if achievement.is_available():
                # Show full details if earned, hide if secret and not earned
                hide_secret = achievement.is_hidden and achievement.id not in earned_ids
                result.append(achievement.to_dict(hide_secret=hide_secret))
        
        # Group by category for current page
        by_category = {}
        for ach in result:
            category = ach['category']
            if category not in by_category:
                by_category[category] = []
            by_category[category].append(ach)
        
        return jsonify({
            'success': True,
            'achievements': result,
            'by_category': by_category,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev
            },
            'total': len(result)
        }), 200
        
    except SQLAlchemyError as e:
        logger.error(f"Database error getting achievements: {str(e)}")
        return jsonify({'success': False, 'error': 'Database error occurred'}), 500
    except Exception as e:
        logger.error(f"Error getting achievements: {str(e)}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@achievement_bp.route("/earned", methods=["GET"])
@student_required
def get_earned_achievements():
    """Get achievements earned by current user with pagination"""
    try:
        user_id = int(get_jwt_identity())
        
        # Get pagination parameters
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        
        logger.info(f"Getting earned achievements for user {user_id}")
        
        # Paginate user achievements
        pagination = UserAchievement.query.filter_by(
            user_id=user_id
        ).order_by(desc(UserAchievement.earned_at)).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        user_achievements = pagination.items
        
        return jsonify({
            'success': True,
            'achievements': [ua.to_dict() for ua in user_achievements],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev
            },
            'total': len(user_achievements)
        }), 200
        
    except SQLAlchemyError as e:
        logger.error(f"Database error getting earned achievements: {str(e)}")
        return jsonify({'success': False, 'error': 'Database error occurred'}), 500
    except Exception as e:
        logger.error(f"Error getting earned achievements: {str(e)}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@achievement_bp.route("/summary", methods=["GET"])
@student_required
def get_achievements_summary():
    """Get comprehensive achievement summary"""
    try:
        user_id = int(get_jwt_identity())
        summary = AchievementService.get_user_achievements_summary(user_id)
        
        return jsonify({
            'success': True,
            'data': summary
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@achievement_bp.route("/<int:achievement_id>/showcase", methods=["POST"])
@student_required
def showcase_achievement(achievement_id):
    """Add or remove achievement from showcase with input validation"""
    try:
        user_id = int(get_jwt_identity())
        
        # Validate input
        try:
            data = request.get_json() or {}
            schema = ShowcaseAchievementSchema()
            validated_data = schema.load(data)
        except ValidationError as err:
            return jsonify({'success': False, 'error': 'Invalid input', 'details': err.messages}), 400
        
        logger.info(f"Updating showcase for achievement {achievement_id}, user {user_id}")
        
        user_achievement = UserAchievement.query.filter_by(
            user_id=user_id,
            achievement_id=achievement_id
        ).first()
        
        if not user_achievement:
            return jsonify({'success': False, 'error': 'Achievement not earned'}), 404
        
        showcase = validated_data.get('showcase', True)
        
        try:
            user_achievement.is_showcased = showcase
            
            if showcase:
                # Get max showcase order
                max_order = db.session.query(
                    db.func.max(UserAchievement.showcase_order)
                ).filter_by(user_id=user_id, is_showcased=True).scalar() or 0
                user_achievement.showcase_order = max_order + 1
            else:
                user_achievement.showcase_order = 0
            
            db.session.commit()
            
            logger.info(f"Successfully updated showcase for achievement {achievement_id}")
            
            return jsonify({
                'success': True,
                'message': 'Showcase updated successfully',
                'achievement': user_achievement.to_dict()
            }), 200
            
        except SQLAlchemyError as e:
            db.session.rollback()
            logger.error(f"Database error updating showcase: {str(e)}")
            return jsonify({'success': False, 'error': 'Database error occurred'}), 500
        
    except Exception as e:
        logger.error(f"Error updating showcase for achievement {achievement_id}: {str(e)}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@achievement_bp.route("/<int:achievement_id>/share", methods=["POST"])
@student_required
def share_achievement(achievement_id):
    """Track achievement share with platform analytics"""
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        platform = data.get('platform', 'general')
        
        logger.info(f"Share request: user_id={user_id}, achievement_id={achievement_id}")
        
        # Check if the achievement exists first
        achievement = Achievement.query.get(achievement_id)
        if not achievement:
            logger.warning(f"Achievement {achievement_id} does not exist")
            return jsonify({'success': False, 'error': 'Achievement not found'}), 404
            
        user_achievement = UserAchievement.query.filter_by(
            user_id=user_id,
            achievement_id=achievement_id
        ).first()
        
        if not user_achievement:
            # Additional debugging - check what achievements this user has
            all_user_achievements = UserAchievement.query.filter_by(user_id=user_id).all()
            logger.warning(f"User {user_id} has achievements: {[ua.achievement_id for ua in all_user_achievements]} but requested {achievement_id}")
            return jsonify({
                'success': False, 
                'error': 'You can only share achievements you have earned',
                'user_achievements': [ua.achievement_id for ua in all_user_achievements]  # Debug info
            }), 404
        
        # Increment share count
        user_achievement.shared_count += 1
        
        # Log platform analytics
        logger.info(f"User {user_id} shared achievement {achievement_id} ({achievement.title}) via {platform}")
        
        db.session.commit()
        
        # Generate dynamic share text based on achievement
        share_text = user_achievement.achievement.share_text or f"🏆 I just earned '{user_achievement.achievement.title}'! {user_achievement.achievement.description}"
        
        return jsonify({
            'success': True,
            'share_text': share_text,
            'shared_count': user_achievement.shared_count,
            'platform': platform,
            'achievement_url': f"/achievements/{achievement_id}"
        }), 200
        
        # Increment share count
        user_achievement.shared_count += 1
        
        # Log platform analytics (could be extended for detailed tracking)
        logger.info(f"User {user_id} shared achievement {achievement_id} via {platform}")
        
        db.session.commit()
        
        # Generate dynamic share text based on achievement
        share_text = user_achievement.achievement.share_text or f"🏆 I just earned '{user_achievement.achievement.title}'! {user_achievement.achievement.description}"
        
        return jsonify({
            'success': True,
            'share_text': share_text,
            'shared_count': user_achievement.shared_count,
            'platform': platform,
            'achievement_url': f"/achievements/{achievement_id}"
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error sharing achievement {achievement_id}: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to track share'}), 500

# Debug endpoint to help troubleshoot user authentication
@achievement_bp.route("/debug/user-info", methods=["GET"])
@student_required
def debug_user_info():
    """Debug endpoint to verify user authentication and achievements"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        user_achievements = UserAchievement.query.filter_by(user_id=user_id).all()
        achievement_ids = [ua.achievement_id for ua in user_achievements]
        
        return jsonify({
            'user_id': user_id,
            'username': user.username,
            'email': user.email,
            'role': user.role.name if user.role else None,
            'achievements': achievement_ids,
            'total_achievements': len(achievement_ids)
        }), 200
        
    except Exception as e:
        logger.error(f"Error in debug user info: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ==================== Streak Endpoints ====================

@achievement_bp.route("/streak", methods=["GET"])
@student_required
def get_streak():
    """Get user's learning streak"""
    try:
        user_id = int(get_jwt_identity())
        
        streak = LearningStreak.query.filter_by(user_id=user_id).first()
        
        if not streak:
            streak = LearningStreak(user_id=user_id)
            db.session.add(streak)
            db.session.commit()
        
        return jsonify({
            'success': True,
            'streak': streak.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@achievement_bp.route("/streak/update", methods=["POST"])
@student_required
def update_streak():
    """Update user's streak (called after lesson completion)"""
    try:
        user_id = int(get_jwt_identity())
        
        current_streak, new_milestones = AchievementService.update_learning_streak(user_id)
        
        # Check for streak achievements
        newly_awarded = AchievementService.check_and_award_achievements(
            user_id,
            'streak_update',
            {'current_streak': current_streak, 'new_milestones': new_milestones}
        )
        
        return jsonify({
            'success': True,
            'current_streak': current_streak,
            'new_milestones': new_milestones,
            'new_achievements': [ua.to_dict() for ua in newly_awarded]
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== Points & Leveling Endpoints ====================

@achievement_bp.route("/points", methods=["GET"])
@student_required
def get_points():
    """Get user's points and level"""
    try:
        user_id = int(get_jwt_identity())
        
        points = StudentPoints.query.filter_by(user_id=user_id).first()
        
        if not points:
            points = StudentPoints(user_id=user_id)
            db.session.add(points)
            db.session.commit()
        
        return jsonify({
            'success': True,
            'points': points.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@achievement_bp.route("/points/history", methods=["GET"])
@student_required
def get_points_history():
    """Get points earning history"""
    try:
        user_id = int(get_jwt_identity())
        
        points = StudentPoints.query.filter_by(user_id=user_id).first()
        
        if not points:
            return jsonify({
                'success': True,
                'history': [],
                'breakdown': {}
            }), 200
        
        breakdown = {
            'lesson_points': points.lesson_points,
            'quiz_points': points.quiz_points,
            'assignment_points': points.assignment_points,
            'streak_points': points.streak_points,
            'achievement_points': points.achievement_points,
            'social_points': points.social_points,
            'bonus_points': points.bonus_points
        }
        
        return jsonify({
            'success': True,
            'breakdown': breakdown,
            'total': points.total_points
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== Milestone Endpoints ====================

@achievement_bp.route("/milestones", methods=["GET"])
@student_required
def get_milestones():
    """Get all available milestones"""
    try:
        user_id = int(get_jwt_identity())
        
        # Get all active milestones
        milestones = Milestone.query.filter_by(is_active=True).all()
        
        # Get user's reached milestones
        reached_ids = [um.milestone_id for um in UserMilestone.query.filter_by(user_id=user_id).all()]
        
        result = []
        for milestone in milestones:
            milestone_data = milestone.to_dict()
            milestone_data['reached'] = milestone.id in reached_ids
            result.append(milestone_data)
        
        return jsonify({
            'success': True,
            'milestones': result,
            'total_reached': len(reached_ids)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@achievement_bp.route("/milestones/reached", methods=["GET"])
@student_required
def get_reached_milestones():
    """Get milestones reached by user"""
    try:
        user_id = int(get_jwt_identity())
        
        user_milestones = UserMilestone.query.filter_by(user_id=user_id).all()
        
        return jsonify({
            'success': True,
            'milestones': [um.to_dict() for um in user_milestones],
            'total': len(user_milestones)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== Leaderboard Endpoints ====================

@achievement_bp.route("/leaderboards", methods=["GET"])
@student_required
def get_leaderboards():
    """Get all available leaderboards"""
    try:
        leaderboards = Leaderboard.query.filter_by(is_active=True).all()
        
        return jsonify({
            'success': True,
            'leaderboards': [lb.to_dict() for lb in leaderboards]
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Convenience routes for common leaderboard types
@achievement_bp.route("/leaderboards/points", methods=["GET"])
@student_required
def get_points_leaderboard():
    """Get points leaderboard (convenience route for total_points_alltime)"""
    try:
        limit = request.args.get('limit', 100, type=int)
        
        # Debug: Check if leaderboard exists
        from ..models.achievement_models import Leaderboard
        leaderboard = Leaderboard.query.filter_by(name='total_points_alltime', is_active=True).first()
        if not leaderboard:
            logger.warning("Leaderboard 'total_points_alltime' not found")
            return jsonify({'success': False, 'error': "Leaderboard 'total_points_alltime' not found. Please run the achievement migration."}), 404
        
        leaderboard_data = AchievementService.get_leaderboard('total_points_alltime', limit)
        
        if 'error' in leaderboard_data:
            logger.error(f"Leaderboard service error: {leaderboard_data['error']}")
            return jsonify({'success': False, 'error': leaderboard_data['error']}), 404
        
        # Get current user's rank
        user_id = int(get_jwt_identity())
        user_rank = next(
            (r for r in leaderboard_data['rankings'] if r['user_id'] == user_id),
            None
        )
        
        logger.info(f"Returning points leaderboard with {len(leaderboard_data['rankings'])} rankings")
        
        return jsonify({
            'success': True,
            'leaderboard': leaderboard_data['leaderboard'],
            'rankings': leaderboard_data['rankings'],
            'user_rank': user_rank,
            'total_participants': leaderboard_data['total_participants']
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting points leaderboard: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': f'Internal server error: {str(e)}'}), 500

@achievement_bp.route("/leaderboards/streaks", methods=["GET"])
@student_required
def get_streaks_leaderboard():
    """Get streaks leaderboard (convenience route for streak_masters)"""
    try:
        limit = request.args.get('limit', 100, type=int)
        
        leaderboard_data = AchievementService.get_leaderboard('streak_masters', limit)
        
        if 'error' in leaderboard_data:
            return jsonify({'success': False, 'error': leaderboard_data['error']}), 404
        
        # Get current user's rank
        user_id = int(get_jwt_identity())
        user_rank = next(
            (r for r in leaderboard_data['rankings'] if r['user_id'] == user_id),
            None
        )
        
        return jsonify({
            'success': True,
            'leaderboard': leaderboard_data['leaderboard'],
            'rankings': leaderboard_data['rankings'],
            'user_rank': user_rank,
            'total_participants': leaderboard_data['total_participants']
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting streaks leaderboard: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@achievement_bp.route("/leaderboards/weekly", methods=["GET"])
@student_required
def get_weekly_leaderboard():
    """Get weekly leaderboard (convenience route for weekly_champions)"""
    try:
        limit = request.args.get('limit', 100, type=int)
        
        leaderboard_data = AchievementService.get_leaderboard('weekly_champions', limit)
        
        if 'error' in leaderboard_data:
            return jsonify({'success': False, 'error': leaderboard_data['error']}), 404
        
        # Get current user's rank
        user_id = int(get_jwt_identity())
        user_rank = next(
            (r for r in leaderboard_data['rankings'] if r['user_id'] == user_id),
            None
        )
        
        return jsonify({
            'success': True,
            'leaderboard': leaderboard_data['leaderboard'],
            'rankings': leaderboard_data['rankings'],
            'user_rank': user_rank,
            'total_participants': leaderboard_data['total_participants']
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting weekly leaderboard: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@achievement_bp.route("/leaderboards/<string:leaderboard_name>", methods=["GET"])
@student_required
def get_leaderboard(leaderboard_name):
    """Get specific leaderboard rankings"""
    try:
        limit = request.args.get('limit', 100, type=int)
        
        logger.info(f"Getting leaderboard '{leaderboard_name}' with limit {limit}")
        
        leaderboard_data = AchievementService.get_leaderboard(leaderboard_name, limit)
        
        if 'error' in leaderboard_data:
            logger.warning(f"Leaderboard '{leaderboard_name}' not found: {leaderboard_data['error']}")
            return jsonify({'success': False, 'error': leaderboard_data['error']}), 404
        
        # Get current user's rank
        user_id = int(get_jwt_identity())
        user_rank = next(
            (r for r in leaderboard_data['rankings'] if r['user_id'] == user_id),
            None
        )
        
        logger.info(f"Returning leaderboard '{leaderboard_name}' with {len(leaderboard_data['rankings'])} rankings")
        
        return jsonify({
            'success': True,
            'leaderboard': leaderboard_data['leaderboard'],
            'rankings': leaderboard_data['rankings'],
            'user_rank': user_rank,
            'total_participants': leaderboard_data['total_participants']
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting leaderboard '{leaderboard_name}': {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': f'Internal server error: {str(e)}'}), 500

@achievement_bp.route("/leaderboards/<string:leaderboard_name>/position", methods=["GET"])
@student_required
def get_user_leaderboard_position(leaderboard_name):
    """Get current user's position on leaderboard"""
    try:
        user_id = int(get_jwt_identity())
        
        leaderboard_data = AchievementService.get_leaderboard(leaderboard_name, 1000)
        
        if 'error' in leaderboard_data:
            return jsonify({'success': False, 'error': leaderboard_data['error']}), 404
        
        user_rank = next(
            (r for r in leaderboard_data['rankings'] if r['user_id'] == user_id),
            None
        )
        
        if not user_rank:
            return jsonify({
                'success': True,
                'rank': None,
                'message': 'Not yet ranked'
            }), 200
        
        # Get nearby rankings (3 above, 3 below)
        rank_index = user_rank['rank'] - 1
        nearby_start = max(0, rank_index - 3)
        nearby_end = min(len(leaderboard_data['rankings']), rank_index + 4)
        nearby_rankings = leaderboard_data['rankings'][nearby_start:nearby_end]
        
        return jsonify({
            'success': True,
            'rank': user_rank,
            'nearby_rankings': nearby_rankings,
            'total_participants': leaderboard_data['total_participants']
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== Quest/Challenge Endpoints ====================

@achievement_bp.route("/quests", methods=["GET"])
@student_required
def get_quests():
    """Get available quests and challenges"""
    try:
        user_id = int(get_jwt_identity())
        
        quests = AchievementService.get_available_quests(user_id)
        
        # Separate by status
        active_quests = [q for q in quests if q.get('user_progress') and q['user_progress']['status'] == 'in_progress']
        available_quests = [q for q in quests if not q.get('user_progress')]
        completed_quests = [q for q in quests if q.get('user_progress') and q['user_progress']['status'] == 'completed']
        
        return jsonify({
            'success': True,
            'active': active_quests,
            'available': available_quests,
            'completed': completed_quests,
            'total': len(quests)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@achievement_bp.route("/quests/<int:quest_id>/start", methods=["POST"])
@student_required
def start_quest(quest_id):
    """Start a quest"""
    try:
        user_id = int(get_jwt_identity())
        
        success, message = AchievementService.start_quest(user_id, quest_id)
        
        if not success:
            return jsonify({'success': False, 'error': message}), 400
        
        return jsonify({
            'success': True,
            'message': message
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@achievement_bp.route("/quests/<int:quest_id>/progress", methods=["GET"])
@student_required
def get_quest_progress(quest_id):
    """Get progress on a specific quest"""
    try:
        user_id = int(get_jwt_identity())
        
        progress = UserQuestProgress.query.filter_by(
            user_id=user_id,
            quest_id=quest_id
        ).first()
        
        if not progress:
            return jsonify({'success': False, 'error': 'Quest not started'}), 404
        
        return jsonify({
            'success': True,
            'progress': progress.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== Statistics & Analytics ====================

@achievement_bp.route("/stats", methods=["GET"])
@student_required
def get_achievement_stats():
    """Get comprehensive achievement statistics"""
    try:
        user_id = int(get_jwt_identity())
        
        # Get all data
        points = StudentPoints.query.filter_by(user_id=user_id).first()
        streak = LearningStreak.query.filter_by(user_id=user_id).first()
        achievements_count = UserAchievement.query.filter_by(user_id=user_id).count()
        milestones_count = UserMilestone.query.filter_by(user_id=user_id).count()
        
        # Get recent activity
        recent_achievements = UserAchievement.query.filter_by(
            user_id=user_id
        ).order_by(UserAchievement.earned_at.desc()).limit(5).all()
        
        recent_milestones = UserMilestone.query.filter_by(
            user_id=user_id
        ).order_by(UserMilestone.reached_at.desc()).limit(5).all()
        
        return jsonify({
            'success': True,
            'stats': {
                'points': points.to_dict() if points else {},
                'streak': streak.to_dict() if streak else {},
                'achievements_earned': achievements_count,
                'milestones_reached': milestones_count,
                'recent_achievements': [ua.to_dict() for ua in recent_achievements],
                'recent_milestones': [um.to_dict() for um in recent_milestones]
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== Event Triggers (Internal) ====================

@achievement_bp.route("/trigger", methods=["POST"])
@student_required
def trigger_achievement_check():
    """Trigger achievement check for an event with input validation"""
    try:
        user_id = int(get_jwt_identity())
        
        # Validate input
        try:
            data = request.get_json()
            if not data:
                return jsonify({'success': False, 'error': 'No input data provided'}), 400
                
            schema = TriggerAchievementSchema()
            validated_data = schema.load(data)
        except ValidationError as err:
            return jsonify({'success': False, 'error': 'Invalid input', 'details': err.messages}), 400
        
        event_type = validated_data['event_type']
        event_data = validated_data['event_data']
        
        logger.info(f"Triggering achievement check for user {user_id}, event: {event_type}")
        
        # Check achievements
        newly_awarded = AchievementService.check_and_award_achievements(
            user_id,
            event_type,
            event_data
        )
        
        # Check milestones
        milestone_type = event_data.get('milestone_type')
        new_milestones = []
        if milestone_type:
            new_milestones = AchievementService.check_milestones(
                user_id,
                milestone_type,
                event_data
            )
        
        logger.info(f"Achievement check complete: {len(newly_awarded)} new achievements, {len(new_milestones)} new milestones")
        
        return jsonify({
            'success': True,
            'new_achievements': [ua.to_dict() for ua in newly_awarded],
            'new_milestones': [um.to_dict() for um in new_milestones],
            'message': f'Awarded {len(newly_awarded)} achievements and {len(new_milestones)} milestones'
        }), 200
        
    except Exception as e:
        logger.error(f"Error triggering achievement check: {str(e)}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500
