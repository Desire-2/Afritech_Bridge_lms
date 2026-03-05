"""
Notification Service for Afritec Bridge LMS

Centralised helper that creates in-app notifications for every event type.
All route handlers should call these helpers instead of building Notification
objects directly — this keeps the logic DRY and the notification catalogue
consistent.
"""

from datetime import datetime, timedelta
import logging

from ..models.user_models import db, User
from ..models.notification_models import (
    Notification,
    NotificationPreference,
    NotificationType,
    NotificationPriority,
    NOTIFICATION_CATEGORIES,
)

logger = logging.getLogger(__name__)


# ── Internal helpers ─────────────────────────────────────────────

def _category_for_type(notification_type: str) -> str:
    """Return the category key for a given notification type."""
    for cat, types in NOTIFICATION_CATEGORIES.items():
        if notification_type in types:
            return cat
    return 'system'


def _user_wants_notification(user_id: int, category: str) -> bool:
    """Check if a user has this notification category enabled."""
    pref = NotificationPreference.query.filter_by(user_id=user_id).first()
    if pref is None:
        return True  # no prefs yet → everything enabled
    if not pref.in_app_enabled:
        return False
    return pref.is_category_enabled(category)


def _create_notification(
    user_id: int,
    notification_type: str,
    title: str,
    message: str,
    priority: str = NotificationPriority.NORMAL,
    action_url: str = None,
    actor_id: int = None,
    course_id: int = None,
    module_id: int = None,
    lesson_id: int = None,
    assignment_id: int = None,
    project_id: int = None,
    quiz_id: int = None,
    submission_id: int = None,
    forum_id: int = None,
    post_id: int = None,
    announcement_id: int = None,
    achievement_id: int = None,
    task_id: str = None,
    task_type: str = None,
    metadata: dict = None,
    expires_days: int = 90,
) -> Notification | None:
    """Low-level factory — callers should prefer the domain-specific helpers below."""
    category = _category_for_type(notification_type)

    # Respect user preferences
    if not _user_wants_notification(user_id, category):
        return None

    n = Notification(
        user_id=user_id,
        notification_type=notification_type,
        category=category,
        priority=priority,
        title=title,
        message=message,
        action_url=action_url,
        actor_id=actor_id,
        course_id=course_id,
        module_id=module_id,
        lesson_id=lesson_id,
        assignment_id=assignment_id,
        project_id=project_id,
        quiz_id=quiz_id,
        submission_id=submission_id,
        forum_id=forum_id,
        post_id=post_id,
        announcement_id=announcement_id,
        achievement_id=achievement_id,
        task_id=task_id,
        task_type=task_type,
        expires_at=datetime.utcnow() + timedelta(days=expires_days) if expires_days else None,
    )
    if metadata:
        n.meta = metadata

    db.session.add(n)
    return n


def _bulk_commit():
    """Commit the current session — callers that need atomicity should
    handle their own commits instead."""
    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        logger.error(f"Failed to commit notifications: {exc}")


# ══════════════════════════════════════════════════════════════════
#  ANNOUNCEMENT NOTIFICATIONS
# ══════════════════════════════════════════════════════════════════

def notify_announcement_new(
    announcement,
    course,
    student_ids: list[int],
    actor_id: int = None,
):
    """Create in-app notifications for all enrolled students when a new
    announcement is published."""
    count = 0
    for sid in student_ids:
        n = _create_notification(
            user_id=sid,
            notification_type=NotificationType.ANNOUNCEMENT_NEW,
            title=f"New Announcement: {announcement.title}",
            message=f"{course.title} — {announcement.content[:150]}{'…' if len(announcement.content) > 150 else ''}",
            priority=NotificationPriority.HIGH,
            action_url=f"/student/announcements",
            actor_id=actor_id or announcement.instructor_id,
            course_id=course.id,
            announcement_id=announcement.id,
            metadata={
                'course_title': course.title,
                'announcement_title': announcement.title,
            },
        )
        if n:
            count += 1
    _bulk_commit()
    logger.info(f"📢 Created {count} in-app notifications for announcement '{announcement.title}'")
    return count


def notify_announcement_updated(announcement, course, student_ids: list[int], actor_id: int = None):
    """Notify students that an announcement was edited."""
    count = 0
    for sid in student_ids:
        n = _create_notification(
            user_id=sid,
            notification_type=NotificationType.ANNOUNCEMENT_UPDATED,
            title=f"Announcement Updated: {announcement.title}",
            message=f"{course.title} — An announcement has been updated. Tap to view.",
            action_url=f"/student/announcements",
            actor_id=actor_id or announcement.instructor_id,
            course_id=course.id,
            announcement_id=announcement.id,
        )
        if n:
            count += 1
    _bulk_commit()
    return count


# ══════════════════════════════════════════════════════════════════
#  GRADING NOTIFICATIONS
# ══════════════════════════════════════════════════════════════════

def notify_assignment_graded(
    submission,
    assignment,
    student_id: int,
    grade: float,
    feedback: str = '',
    actor_id: int = None,
    course_id: int = None,
):
    """Notify a student that their assignment has been graded."""
    points_possible = assignment.points_possible or 100
    percentage = round((grade / points_possible) * 100, 1)
    course_title = assignment.course.title if assignment.course else 'Unknown Course'

    n = _create_notification(
        user_id=student_id,
        notification_type=NotificationType.GRADE_ASSIGNMENT,
        title=f"Assignment Graded: {assignment.title}",
        message=f"You scored {grade}/{points_possible} ({percentage}%) on \"{assignment.title}\" in {course_title}.",
        priority=NotificationPriority.HIGH,
        action_url=f"/student/assessments",
        actor_id=actor_id,
        course_id=course_id or (assignment.course_id if hasattr(assignment, 'course_id') else None),
        assignment_id=assignment.id,
        submission_id=submission.id if submission else None,
        metadata={
            'grade': grade,
            'points_possible': points_possible,
            'percentage': percentage,
            'feedback_preview': (feedback[:200] + '…') if feedback and len(feedback) > 200 else feedback,
            'course_title': course_title,
        },
    )
    _bulk_commit()
    return n


def notify_project_graded(
    submission,
    project,
    student_id: int,
    grade: float,
    feedback: str = '',
    actor_id: int = None,
    course_id: int = None,
):
    """Notify a student that their project has been graded."""
    points_possible = project.points_possible or 100
    percentage = round((grade / points_possible) * 100, 1)
    course_title = project.course.title if project.course else 'Unknown Course'

    n = _create_notification(
        user_id=student_id,
        notification_type=NotificationType.GRADE_PROJECT,
        title=f"Project Graded: {project.title}",
        message=f"You scored {grade}/{points_possible} ({percentage}%) on \"{project.title}\" in {course_title}.",
        priority=NotificationPriority.HIGH,
        action_url=f"/student/assessments",
        actor_id=actor_id,
        course_id=course_id or (project.course_id if hasattr(project, 'course_id') else None),
        project_id=project.id,
        submission_id=submission.id if submission else None,
        metadata={
            'grade': grade,
            'points_possible': points_possible,
            'percentage': percentage,
            'feedback_preview': (feedback[:200] + '…') if feedback and len(feedback) > 200 else feedback,
            'course_title': course_title,
        },
    )
    _bulk_commit()
    return n


def notify_quiz_graded(
    student_id: int,
    quiz,
    score: float,
    total_points: float,
    course_id: int = None,
):
    """Notify a student that their quiz has been auto-graded."""
    percentage = round((score / total_points) * 100, 1) if total_points else 0
    course_title = quiz.course.title if hasattr(quiz, 'course') and quiz.course else 'Unknown Course'

    n = _create_notification(
        user_id=student_id,
        notification_type=NotificationType.GRADE_QUIZ,
        title=f"Quiz Results: {quiz.title}",
        message=f"You scored {score}/{total_points} ({percentage}%) on \"{quiz.title}\" in {course_title}.",
        priority=NotificationPriority.NORMAL,
        action_url=f"/student/assessments",
        course_id=course_id or (quiz.course_id if hasattr(quiz, 'course_id') else None),
        quiz_id=quiz.id,
        metadata={
            'score': score,
            'total_points': total_points,
            'percentage': percentage,
            'course_title': course_title,
        },
    )
    _bulk_commit()
    return n


def notify_modification_requested(
    student_id: int,
    assignment_or_project,
    reason: str,
    actor_id: int = None,
    course_id: int = None,
    is_project: bool = False,
):
    """Notify student that a modification (resubmission) was requested."""
    item_type = "Project" if is_project else "Assignment"
    title_text = assignment_or_project.title

    n = _create_notification(
        user_id=student_id,
        notification_type=NotificationType.GRADE_MODIFICATION_REQUESTED,
        title=f"Resubmission Requested: {title_text}",
        message=f"Your instructor has requested a resubmission for {item_type.lower()} \"{title_text}\". Reason: {reason[:200]}",
        priority=NotificationPriority.URGENT,
        action_url=f"/student/modifications",
        actor_id=actor_id,
        course_id=course_id,
        assignment_id=assignment_or_project.id if not is_project else None,
        project_id=assignment_or_project.id if is_project else None,
        metadata={'reason': reason, 'item_type': item_type},
    )
    _bulk_commit()
    return n


def notify_resubmission_received(
    instructor_id: int,
    student,
    assignment_or_project,
    course_id: int = None,
    is_project: bool = False,
):
    """Notify the instructor that a student resubmitted work."""
    item_type = "project" if is_project else "assignment"
    student_name = f"{student.first_name} {student.last_name}"

    n = _create_notification(
        user_id=instructor_id,
        notification_type=NotificationType.GRADE_RESUBMISSION_RECEIVED,
        title=f"Resubmission: {assignment_or_project.title}",
        message=f"{student_name} resubmitted their {item_type} \"{assignment_or_project.title}\". Tap to review.",
        priority=NotificationPriority.HIGH,
        action_url=f"/instructor/grading",
        actor_id=student.id,
        course_id=course_id,
        assignment_id=assignment_or_project.id if not is_project else None,
        project_id=assignment_or_project.id if is_project else None,
    )
    _bulk_commit()
    return n


def notify_full_credit(
    student_id: int,
    module,
    course,
    actor_id: int = None,
    reason: str = None,
):
    """Notify student they received full credit for a module."""
    n = _create_notification(
        user_id=student_id,
        notification_type=NotificationType.GRADE_FULL_CREDIT,
        title=f"Full Credit Awarded: {module.title}",
        message=f"You've been awarded full credit for module \"{module.title}\" in {course.title}." +
                (f" Reason: {reason}" if reason else ""),
        priority=NotificationPriority.HIGH,
        action_url=f"/student/courses/{course.id}",
        actor_id=actor_id,
        course_id=course.id,
        module_id=module.id,
    )
    _bulk_commit()
    return n


# ══════════════════════════════════════════════════════════════════
#  FORUM NOTIFICATIONS
# ══════════════════════════════════════════════════════════════════

def notify_forum_reply(
    recipient_id: int,
    author,
    post,
    parent_post,
    forum_id: int = None,
):
    """Notify the original poster that someone replied."""
    author_name = f"{author.first_name} {author.last_name}" if author else "Someone"

    n = _create_notification(
        user_id=recipient_id,
        notification_type=NotificationType.FORUM_NEW_REPLY,
        title=f"New Reply to Your Post",
        message=f"{author_name} replied to \"{parent_post.title}\": {post.content[:120]}{'…' if len(post.content) > 120 else ''}",
        action_url=f"/student/forums",
        actor_id=author.id if author else None,
        forum_id=forum_id,
        post_id=post.id,
        metadata={
            'parent_post_id': parent_post.id,
            'parent_title': parent_post.title,
        },
    )
    _bulk_commit()
    return n


def notify_forum_post_liked(
    recipient_id: int,
    liker,
    post,
):
    """Notify a post author that their post was liked."""
    liker_name = f"{liker.first_name} {liker.last_name}" if liker else "Someone"

    n = _create_notification(
        user_id=recipient_id,
        notification_type=NotificationType.FORUM_POST_LIKED,
        title="Your Post Was Liked",
        message=f"{liker_name} liked your post \"{post.title}\".",
        priority=NotificationPriority.LOW,
        action_url=f"/student/forums",
        actor_id=liker.id if liker else None,
        post_id=post.id,
        forum_id=post.forum_id,
    )
    _bulk_commit()
    return n


def notify_forum_new_thread(
    subscriber_ids: list[int],
    author,
    post,
    forum,
):
    """Notify forum subscribers about a new thread."""
    author_name = f"{author.first_name} {author.last_name}" if author else "Someone"
    count = 0
    for sid in subscriber_ids:
        if sid == (author.id if author else None):
            continue  # Don't notify the author themselves
        n = _create_notification(
            user_id=sid,
            notification_type=NotificationType.FORUM_NEW_THREAD,
            title=f"New Discussion: {post.title}",
            message=f"{author_name} started a new discussion in \"{forum.title}\": {post.content[:120]}{'…' if len(post.content) > 120 else ''}",
            action_url=f"/student/forums",
            actor_id=author.id if author else None,
            forum_id=forum.id,
            post_id=post.id,
        )
        if n:
            count += 1
    _bulk_commit()
    return count


def notify_forum_post_flagged(
    moderator_ids: list[int],
    flagger,
    post,
    reason: str = '',
):
    """Notify moderators/instructors when a post is flagged."""
    flagger_name = f"{flagger.first_name} {flagger.last_name}" if flagger else "A user"
    count = 0
    for mid in moderator_ids:
        n = _create_notification(
            user_id=mid,
            notification_type=NotificationType.FORUM_POST_FLAGGED,
            title=f"Post Flagged for Review",
            message=f"{flagger_name} flagged a post: \"{post.title}\". Reason: {reason[:150] if reason else 'No reason given'}",
            priority=NotificationPriority.HIGH,
            action_url=f"/instructor/forums",
            actor_id=flagger.id if flagger else None,
            post_id=post.id,
            forum_id=post.forum_id,
        )
        if n:
            count += 1
    _bulk_commit()
    return count


# ══════════════════════════════════════════════════════════════════
#  ENROLLMENT NOTIFICATIONS
# ══════════════════════════════════════════════════════════════════

def notify_enrollment_confirmed(
    student_id: int,
    course,
    actor_id: int = None,
):
    """Notify student that enrollment was confirmed."""
    n = _create_notification(
        user_id=student_id,
        notification_type=NotificationType.ENROLLMENT_CONFIRMED,
        title=f"Enrollment Confirmed: {course.title}",
        message=f"You are now enrolled in \"{course.title}\". Start learning today!",
        priority=NotificationPriority.HIGH,
        action_url=f"/student/courses/{course.id}",
        actor_id=actor_id,
        course_id=course.id,
    )
    _bulk_commit()
    return n


def notify_application_status(
    student_id: int,
    course,
    status: str,
    notes: str = '',
):
    """Notify student about application approval/rejection."""
    is_approved = status.lower() in ('approved', 'enrolled')
    n = _create_notification(
        user_id=student_id,
        notification_type=NotificationType.ENROLLMENT_APPLICATION_STATUS,
        title=f"Application {'Approved' if is_approved else 'Update'}: {course.title}",
        message=f"Your application for \"{course.title}\" has been {status}." +
                (f" Notes: {notes[:200]}" if notes else ""),
        priority=NotificationPriority.HIGH,
        action_url=f"/student/courses",
        course_id=course.id,
        metadata={'status': status, 'notes': notes},
    )
    _bulk_commit()
    return n


# ══════════════════════════════════════════════════════════════════
#  ACHIEVEMENT NOTIFICATIONS
# ══════════════════════════════════════════════════════════════════

def notify_achievement_unlocked(
    student_id: int,
    achievement,
):
    """Notify student about a new achievement."""
    n = _create_notification(
        user_id=student_id,
        notification_type=NotificationType.ACHIEVEMENT_UNLOCKED,
        title=f"Achievement Unlocked: {achievement.title}",
        message=f"Congratulations! You earned the \"{achievement.title}\" achievement. {achievement.description or ''}",
        priority=NotificationPriority.NORMAL,
        action_url="/student/achievements",
        achievement_id=achievement.id,
        metadata={
            'tier': getattr(achievement, 'tier', None),
            'icon': getattr(achievement, 'icon', None),
        },
    )
    _bulk_commit()
    return n


def notify_badge_earned(student_id: int, badge):
    """Notify student about a new badge."""
    n = _create_notification(
        user_id=student_id,
        notification_type=NotificationType.BADGE_EARNED,
        title=f"Badge Earned: {badge.name}",
        message=f"You earned the \"{badge.name}\" badge! {badge.description or ''}",
        priority=NotificationPriority.NORMAL,
        action_url="/student/achievements",
        metadata={'badge_name': badge.name},
    )
    _bulk_commit()
    return n


# ══════════════════════════════════════════════════════════════════
#  COURSE / MODULE NOTIFICATIONS
# ══════════════════════════════════════════════════════════════════

def notify_module_released(
    student_ids: list[int],
    module,
    course,
    actor_id: int = None,
):
    """Notify enrolled students that a new module is available."""
    count = 0
    for sid in student_ids:
        n = _create_notification(
            user_id=sid,
            notification_type=NotificationType.MODULE_RELEASED,
            title=f"New Module Available: {module.title}",
            message=f"Module \"{module.title}\" is now available in {course.title}. Start learning!",
            action_url=f"/student/courses/{course.id}",
            actor_id=actor_id,
            course_id=course.id,
            module_id=module.id,
        )
        if n:
            count += 1
    _bulk_commit()
    return count


def notify_forum_created(
    student_ids: list[int],
    forum_title: str,
    course_title: str,
    forum_id: int = None,
    course_id: int = None,
    actor_id: int = None,
):
    """Notify enrolled students when a new course forum is created."""
    count = 0
    for sid in student_ids:
        n = _create_notification(
            user_id=sid,
            notification_type=NotificationType.FORUM_NEW_THREAD,
            title=f"New Forum: {forum_title}",
            message=f'A new discussion forum "{forum_title}" has been created in {course_title}.',
            action_url="/student/forums",
            actor_id=actor_id,
            forum_id=forum_id,
            course_id=course_id,
        )
        if n:
            count += 1
    _bulk_commit()
    logger.info(f"📢 Created {count} in-app notifications for new forum '{forum_title}'")
    return count


# ══════════════════════════════════════════════════════════════════
#  SYSTEM / AI NOTIFICATIONS
# ══════════════════════════════════════════════════════════════════

def notify_system(user_id: int, title: str, message: str, action_url: str = None):
    """Generic system notification."""
    n = _create_notification(
        user_id=user_id,
        notification_type=NotificationType.SYSTEM,
        title=title,
        message=message,
        action_url=action_url,
    )
    _bulk_commit()
    return n


def notify_ai_task_completed(
    user_id: int,
    task_id: str,
    task_type: str,
    title: str,
    message: str,
    course_id: int = None,
    module_id: int = None,
    lesson_id: int = None,
    metadata: dict = None,
):
    """Notify about a completed AI background task."""
    n = _create_notification(
        user_id=user_id,
        notification_type=NotificationType.AI_TASK_COMPLETED,
        title=title,
        message=message,
        action_url=f"/instructor/courses/{course_id}/edit" if course_id else None,
        task_id=task_id,
        task_type=task_type,
        course_id=course_id,
        module_id=module_id,
        lesson_id=lesson_id,
        metadata=metadata,
    )
    _bulk_commit()
    return n


# ══════════════════════════════════════════════════════════════════
#  CLEANUP UTILITY
# ══════════════════════════════════════════════════════════════════

def cleanup_expired_notifications():
    """Delete notifications past their expiry date. Call from a scheduler."""
    try:
        count = Notification.query.filter(
            Notification.expires_at.isnot(None),
            Notification.expires_at < datetime.utcnow(),
        ).delete()
        db.session.commit()
        logger.info(f"🗑️ Cleaned up {count} expired notifications")
        return count
    except Exception as exc:
        db.session.rollback()
        logger.error(f"Error cleaning up notifications: {exc}")
        return 0
