"""Achievement mirroring for Talent Passport.

The Passport has no separate badge engine. It mirrors records already awarded
by the LMS: gamification achievements in ``user_achievements`` and explicitly
verified skill badges in ``student_skill_badges``. Unverified AI/provisional
results are not copied into the Passport.
"""

from __future__ import annotations

from typing import Dict

from ..models.achievement_models import UserAchievement
from ..models.student_models import StudentSkillBadge
from ..models.user_models import db
from ..utils.time_utils import now_local
from .models import PassportAchievementRecord, TalentPassport


def _upsert(passport: TalentPassport, student_id: int, *, key: str, title: str,
            description: str | None, icon: str | None, source_type: str,
            source_id: int, earned_at) -> str:
    record = PassportAchievementRecord.query.filter_by(
        passport_id=passport.id, achievement_key=key
    ).first()
    if record is None:
        db.session.add(PassportAchievementRecord(
            passport_id=passport.id,
            student_id=student_id,
            achievement_key=key,
            title=title,
            description=description,
            icon=icon,
            source_type=source_type,
            source_id=source_id,
            earned_at=earned_at or now_local(),
        ))
        return "created"
    record.title = title
    record.description = description
    record.icon = icon
    record.earned_at = earned_at or record.earned_at
    return "updated"


def sync_achievement_records(passport: TalentPassport, student_id: int) -> Dict[str, int]:
    """Mirror existing LMS achievement records without inventing new ones."""
    counts = {"created": 0, "updated": 0}

    for row in UserAchievement.query.filter_by(user_id=student_id).all():
        achievement = row.achievement
        if achievement is None:
            continue
        result = _upsert(
            passport,
            student_id,
            key=f"lms_achievement_{achievement.id}",
            title=achievement.title or achievement.name,
            description=achievement.description,
            icon=achievement.icon,
            source_type="achievement",
            source_id=achievement.id,
            earned_at=row.earned_at,
        )
        counts[result] += 1

    for row in StudentSkillBadge.query.filter_by(student_id=student_id, verified=True).all():
        badge = row.badge
        if badge is None:
            continue
        result = _upsert(
            passport,
            student_id,
            key=f"lms_skill_badge_{row.id}",
            title=badge.name,
            description=badge.description,
            icon=None,
            source_type="skill_badge",
            source_id=row.id,
            earned_at=row.earned_at,
        )
        counts[result] += 1

    return counts
