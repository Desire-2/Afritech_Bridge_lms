"""Learning progress: modules, lessons, completion and video progress.

Lesson completion and video-progress recording dispatch into the existing
legacy views so every gate (module release, enrollment access, scoring,
unlock logic) runs exactly as it does in the LMS UI.
"""

from __future__ import annotations

from ...models.course_models import Enrollment, Lesson
from ...models.user_models import db
from .. import api_bp
from ..auth import current_user, require
from ..dispatch import dispatch
from ..errors import forbidden, not_found
from ..responses import ok
from ..serialization import isoify, serialize_lesson


def _get_lesson(lesson_id: int, course_id: int) -> Lesson:
    lesson = db.session.get(Lesson, lesson_id)
    if lesson is None or lesson.module.course_id != course_id:
        raise not_found("Lesson not found in this course.")
    return lesson


def _require_enrollment(user, course_id: int) -> Enrollment:
    enrollment = Enrollment.get_canonical(user.id, course_id)
    if enrollment is None:
        raise forbidden("You are not enrolled in this course.")
    return enrollment


@api_bp.route("/me/courses/<int:course_id>/modules", methods=["GET"])
@require(scopes=["courses:read", "progress:read"], user=True)
def my_course_modules(course_id: int):
    """Cohort-aware module list with per-lesson progress (legacy logic)."""
    return dispatch("learning_routes.get_course_modules",
                    view_args={"course_id": course_id})


@api_bp.route("/me/courses/<int:course_id>/progress", methods=["GET"])
@require(scopes=["progress:read"], user=True)
def my_course_progress(course_id: int):
    """Detailed progress/score/eligibility for one enrollment."""
    return dispatch("learning_routes.get_course_progress",
                    view_args={"course_id": course_id})


@api_bp.route("/me/courses/<int:course_id>/lessons/<int:lesson_id>",
              methods=["GET"])
@require(scopes=["courses:read", "progress:read"], user=True)
def my_lesson(course_id: int, lesson_id: int):
    """Lesson content + current progress (enrollment and release gated)."""
    user = current_user()
    lesson = _get_lesson(lesson_id, course_id)
    enrollment = _require_enrollment(user, course_id)

    course = lesson.module.course
    cohort_id = enrollment.application_window_id
    released_ids = {m.id for m in course.get_released_modules(cohort_id=cohort_id)}
    is_staff = user.role and user.role.name in ("admin", "instructor")
    if lesson.module.id not in released_ids and not is_staff:
        raise forbidden("This module has not been released for your cohort yet.")

    payload = serialize_lesson(lesson)

    from ...models.student_models import LessonCompletion
    completion = LessonCompletion.query.filter_by(
        student_id=user.id, lesson_id=lesson.id).first()
    if completion is not None:
        payload["progress"] = isoify({
            "completed": bool(completion.completed),
            "reading_progress": completion.reading_progress or 0,
            "video_progress": completion.video_progress or 0,
            "last_updated": completion.updated_at,
        })
    else:
        payload["progress"] = {"completed": False, "reading_progress": 0,
                               "video_progress": 0, "last_updated": None}
    return ok(payload)


@api_bp.route("/me/lessons/<int:lesson_id>/complete", methods=["POST"])
@require(scopes=["progress:write"], user=True)
def complete_lesson(lesson_id: int):
    """Mark a lesson complete (all legacy gates apply)."""
    return dispatch("learning_routes.complete_lesson",
                    view_args={"lesson_id": lesson_id})


@api_bp.route("/me/lessons/<int:lesson_id>/video-progress", methods=["POST"])
@require(scopes=["progress:write"], user=True)
def update_video_progress(lesson_id: int):
    """Record video/reading progress for a lesson (legacy contract)."""
    return dispatch("student_routes.update_lesson_progress",
                    view_args={"lesson_id": lesson_id})
