# Assessment Change Hooks - keep lesson/module/enrollment scores in sync when
# assessments change.
#
# Instructors frequently publish a quiz or assignment AFTER students have
# already started (or finished) a lesson. Without a rescore, the lesson keeps
# the score it had when it was computed, so grades stay stale and students can
# report 100% while a newly published assessment is still outstanding.

from typing import Iterable, Optional

from flask import current_app


def rescore_lesson(lesson_id: Optional[int]) -> None:
    """Resync stored scores for every student with progress in one lesson."""
    if not lesson_id:
        return
    try:
        from .lesson_completion_service import LessonCompletionService
        LessonCompletionService.recalculate_lesson_for_all_students(lesson_id)
    except Exception as e:
        current_app.logger.error(f"Lesson rescore hook failed for lesson {lesson_id}: {str(e)}")


def rescore_lessons(lesson_ids: Iterable[Optional[int]]) -> None:
    """Resync stored scores for each affected lesson (skips blanks)."""
    seen = set()
    for lesson_id in lesson_ids or []:
        if not lesson_id or lesson_id in seen:
            continue
        seen.add(lesson_id)
        rescore_lesson(lesson_id)
