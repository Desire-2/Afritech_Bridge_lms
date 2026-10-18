"""Module-unlock feedback tests: failed lessons must always be NAMED.

Regression coverage for two gaps:
- `_generate_unlock_recommendations` filtered requirement messages by a
  keyword allow-list, so lessons blocked by e.g. the video-90% rule or the
  reading-start message produced NO `Lesson '<title>'` line — the student
  only saw "Complete N lesson(s)" with no way to tell which.
- `_check_lesson_requirements` did not report whether a failed lesson was
  already marked completed, so the UI could not distinguish "completed but
  re-check failed" from "never completed".
"""

from datetime import datetime
from types import SimpleNamespace

from src.models.course_models import Course, Lesson, Module
from src.models.student_models import LessonCompletion
from src.models.user_models import Role, User, db
from src.services.enhanced_module_unlock_service import EnhancedModuleUnlockService

VIDEO_MSG = "Watch at least 90% of the lesson video content"


# ── pure: recommendation naming ────────────────────────────────────────

def test_every_failed_lesson_is_named_in_recommendations():
    lesson_requirements = {
        "all_lessons_passed": False,
        "failed_lessons": [
            {"id": 11, "title": "Video Recap", "requirements": [VIDEO_MSG]},
            {"id": 12, "title": "Reading Deep Dive", "requirements": ["lesson_must_be_started"]},
            {"id": 13, "title": "Brand New Rule", "requirements": ["Some entirely new rule text"]},
            {"id": 14, "title": "Empty Requirements", "requirements": []},
        ],
    }
    scoring = {"total_score": 62.5, "breakdown": {}}
    previous_module = SimpleNamespace(title="Foundations", order=1)

    recs = EnhancedModuleUnlockService._generate_unlock_recommendations(
        {"all_completed": True, "failed_modules": []},
        lesson_requirements,
        scoring,
        previous_module,
    )

    # Top-3 cap applies, but within it no lesson may be silently dropped.
    named = [r for r in recs if r.startswith("Lesson '")]
    assert len(named) == 3  # cap is [:3]
    assert any("Lesson 'Video Recap'" in r and "video" in r for r in recs)
    assert any("Lesson 'Reading Deep Dive'" in r for r in recs)
    assert any("Lesson 'Brand New Rule'" in r for r in recs)


def test_video_and_reading_messages_summarize_to_short_labels():
    assert EnhancedModuleUnlockService._summarize_lesson_requirements(
        [VIDEO_MSG]
    ) == ["watch 90%+ of the video"]
    reading_msg = (
        "Complete reading (need 90% reading progress and 60% engagement, "
        "currently 40.0% reading and 30.0% engagement, or score 55.0% >= 80%)"
    )
    assert EnhancedModuleUnlockService._summarize_lesson_requirements(
        [reading_msg]
    ) == ["finish reading & engagement"]


def test_summarize_requirements_never_returns_empty():
    assert EnhancedModuleUnlockService._summarize_lesson_requirements(None) == [
        "complete lesson requirements"
    ]
    assert EnhancedModuleUnlockService._summarize_lesson_requirements([]) == [
        "complete lesson requirements"
    ]


# ── db: failed_lessons completed flag ──────────────────────────────────

def _make_module_with_lessons(suffix):
    instructor_role = Role.query.filter_by(name="instructor").first()
    if instructor_role is None:
        instructor_role = Role(name="instructor")
        db.session.add(instructor_role)
        db.session.flush()
    student_role = Role.query.filter_by(name="student").first()
    if student_role is None:
        student_role = Role(name="student")
        db.session.add(student_role)
        db.session.flush()

    instructor = User(
        username=f"unlockfb_inst_{suffix}",
        email=f"unlockfb_inst_{suffix}@example.test",
        role_id=instructor_role.id,
    )
    instructor.set_password("InstructorPassword123!")
    db.session.add(instructor)
    db.session.flush()

    student = User(
        username=f"unlockfb_student_{suffix}",
        email=f"unlockfb_student_{suffix}@example.test",
        role_id=student_role.id,
    )
    student.set_password("StudentPassword123!")
    db.session.add(student)
    db.session.flush()

    course = Course(
        title=f"Unlock Feedback {suffix}",
        description="Module unlock feedback tests.",
        instructor_id=instructor.id,
        is_published=True,
        enrollment_type="free",
    )
    db.session.add(course)
    db.session.flush()

    module = Module(
        title=f"Module 1 {suffix}",
        description="module",
        course_id=course.id,
        order=1,
        is_published=True,
    )
    db.session.add(module)
    db.session.flush()

    video_lesson = Lesson(
        title=f"Video Lesson {suffix}",
        content_type="video",
        content_data="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        module_id=module.id,
        order=1,
        is_published=True,
    )
    untouched_lesson = Lesson(
        title=f"Untouched Lesson {suffix}",
        content_type="text",
        content_data="<p>content</p>",
        module_id=module.id,
        order=2,
        is_published=True,
    )
    db.session.add(video_lesson)
    db.session.add(untouched_lesson)
    db.session.flush()
    return student, module, video_lesson, untouched_lesson


def test_failed_lessons_report_completed_flag(app):
    student, module, video_lesson, untouched_lesson = _make_module_with_lessons("flag")

    # Marked completed BEFORE the video rule existed: everything except the
    # video watch requirement is satisfied.
    completion = LessonCompletion(
        student_id=student.id,
        lesson_id=video_lesson.id,
        completed=True,
        completed_at=datetime.utcnow(),
        reading_progress=100.0,
        engagement_score=95.0,
        video_progress=45.0,
    )
    db.session.add(completion)
    db.session.commit()

    result = EnhancedModuleUnlockService._check_lesson_requirements(
        student.id, module.id
    )

    assert result["all_lessons_passed"] is False
    failed = {item["id"]: item for item in result["failed_lessons"]}

    video_entry = failed[video_lesson.id]
    assert video_entry["status"] == "requirements_not_met"
    assert video_entry["completed"] is True
    assert any("Watch at least 90%" in req for req in video_entry["requirements"])

    untouched_entry = failed[untouched_lesson.id]
    assert untouched_entry["status"] == "not_started"
    assert untouched_entry["completed"] is False

    # This blocker must surface in recommendations under the student's nose.
    recs = EnhancedModuleUnlockService._generate_unlock_recommendations(
        {"all_completed": True, "failed_modules": []},
        result,
        {"total_score": 0.0, "breakdown": {}},
        SimpleNamespace(title="First", order=1),
    )
    assert any(f"Lesson '{video_lesson.title}'" in r for r in recs)
    assert any(f"Lesson '{untouched_lesson.title}'" in r for r in recs)
