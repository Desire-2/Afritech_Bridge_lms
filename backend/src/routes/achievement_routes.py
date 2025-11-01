# Achievement Routes - API endpoints for gamification features
# Handles achievements, streaks, leaderboards, quests, and points

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps

from ..models.user_models import User, db
from ..models.achievement_models import (
    Achievement, UserAchievement, LearningStreak, Milestone, UserMilestone,
    Leaderboard, StudentPoints, QuestChallenge, UserQuestProgress
)
from ..services.achievement_service import AchievementService

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

achievement_bp = Blueprint("achievements", __name__, url_prefix="/api/v1/achievements")

# ==================== Achievement Endpoints ====================

@achievement_bp.route("/", methods=["GET"])
@student_required
def get_all_achievements():
    """Get all available achievements (hide secret ones not yet earned)"""
    try:
        user_id = int(get_jwt_identity())
        
        # Get all active achievements
        achievements = Achievement.query.filter_by(is_active=True).all()
        
        # Get user's earned achievements
        earned_ids = [ua.achievement_id for ua in UserAchievement.query.filter_by(user_id=user_id).all()]
        
        result = []
        for achievement in achievements:
            if achievement.is_available():
                # Show full details if earned, hide if secret and not earned
                hide_secret = achievement.is_hidden and achievement.id not in earned_ids
                result.append(achievement.to_dict(hide_secret=hide_secret))
        
        # Group by category
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
            'total': len(result)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@achievement_bp.route("/earned", methods=["GET"])
@student_required
def get_earned_achievements():
    """Get achievements earned by current user"""
    try:
        user_id = int(get_jwt_identity())
        
        user_achievements = UserAchievement.query.filter_by(user_id=user_id).all()
        
        return jsonify({
            'success': True,
            'achievements': [ua.to_dict() for ua in user_achievements],
            'total': len(user_achievements)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

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
    """Add or remove achievement from showcase"""
    try:
        user_id = int(get_jwt_identity())
        
        user_achievement = UserAchievement.query.filter_by(
            user_id=user_id,
            achievement_id=achievement_id
        ).first()
        
        if not user_achievement:
            return jsonify({'success': False, 'error': 'Achievement not earned'}), 404
        
        data = request.get_json() or {}
        showcase = data.get('showcase', True)
        
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
        
        return jsonify({
            'success': True,
            'message': 'Showcase updated',
            'achievement': user_achievement.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@achievement_bp.route("/<int:achievement_id>/share", methods=["POST"])
@student_required
def share_achievement(achievement_id):
    """Track achievement share"""
    try:
        user_id = int(get_jwt_identity())
        
        user_achievement = UserAchievement.query.filter_by(
            user_id=user_id,
            achievement_id=achievement_id
        ).first()
        
        if not user_achievement:
            return jsonify({'success': False, 'error': 'Achievement not earned'}), 404
        
        user_achievement.shared_count += 1
        db.session.commit()
        
        return jsonify({
            'success': True,
            'share_text': user_achievement.achievement.share_text,
            'shared_count': user_achievement.shared_count
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

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

@achievement_bp.route("/leaderboards/<string:leaderboard_name>", methods=["GET"])
@student_required
def get_leaderboard(leaderboard_name):
    """Get specific leaderboard rankings"""
    try:
        limit = request.args.get('limit', 100, type=int)
        
        leaderboard_data = AchievementService.get_leaderboard(leaderboard_name, limit)
        
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
        return jsonify({'success': False, 'error': str(e)}), 500

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
    """Trigger achievement check for an event (used internally)"""
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json()
        
        event_type = data.get('event_type')
        event_data = data.get('event_data', {})
        
        if not event_type:
            return jsonify({'success': False, 'error': 'event_type required'}), 400
        
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
        
        return jsonify({
            'success': True,
            'new_achievements': [ua.to_dict() for ua in newly_awarded],
            'new_milestones': [um.to_dict() for um in new_milestones]
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
