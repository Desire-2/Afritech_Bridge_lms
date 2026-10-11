"""Regression tests for mixed-content multi-video progress.

M-1  _sanitize_mixed_video_progress rejects garbage and clamps values
M-2  Per-index coverage merges monotonically (no regression)
M-3  video_completed stays False while only some videos reach 90%
M-4  video_completed derives True once EVERY video reaches 90%
M-5  video_watch_count increments once on the false->true transition
M-6  GET lesson progress returns the stored mixed_video_progress
M-7  Structured per-index entries are sanitized (progress/currentTime/completed)
"""

import json
import uuid

import pytest
from flask_jwt_extended import create_access_token

from src.models.course_models import Course, Module, Lesson, Enrollment
from src.models.student_models import LessonCompletion, ModuleProgress
from src.models.user_models import User, Role, db
from src.routes.student_routes import (
    VIDEO_WATCH_COMPLETE_THRESHOLD,
    _sanitize_mixed_video_progress,
    _mixed_video_section_indices,
    _mixed_video_coverage_at,
)

MIXED_CONTENT = json.dumps([
    {"type": "text", "content": "intro"},
    {"type": "video", "url": "https://www.youtube.com/watch?v=aaa"},
    {"type": "text", "content": "middle"},
    {"type": "video", "url": "https://www.youtube.com/watch?v=bbb"},
])


@pytest.fixture()
def env(app):
    """One mixed-content lesson (2 videos at indices 1 and 3) + student."""
    with app.app_context():
        db.create_all()
        suffix = uuid.uuid4().hex[:10]

        student_role = Role.query.filter_by(name="student").first()
        if student_role is None:
            student_role = Role(name="student")
            db.session.add(student_role)
            db.session.flush()

        instructor_role = Role.query.filter_by(name="instructor").first()
        if instructor_role is None:
            instructor_role = Role(name="instructor")
            db.session.add(instructor_role)
            db.session.flush()

        def make_user(prefix, role):
            u = User(
                username=f"{prefix}_{suffix}",
                email=f"{prefix}_{suffix}@example.test",
                role_id=role.id,
            )
            u.set_password("Password123!")
            db.session.add(u)
            db.session.flush()
            return u

        student = make_user("mix_student", student_role)
        instructor = make_user("mix_inst", instructor_role)

        course = Course(
            title=f"Mixed Pipeline {suffix}",
            description="mixed video progress tests",
            instructor_id=instructor.id,
            is_published=True,
            enrollment_type="free",
        )
        db.session.add(course)
        db.session.flush()

        module = Module(
            title=f"Module 1 {suffix}",
            description="m",
            course_id=course.id,
            order=1,
            is_published=True,
        )
        db.session.add(module)
        db.session.flush()

        lesson = Lesson(
            title=f"Mixed Lesson {suffix}",
            content_type="mixed",
            content_data=MIXED_CONTENT,
            module_id=module.id,
            order=1,
            is_published=True,
        )
        db.session.add(lesson)
        db.session.flush()

        enrollment = Enrollment(
            student_id=student.id,
            course_id=course.id,
            status="active",
            progress=0.0,
        )
        db.session.add(enrollment)
        db.session.commit()

        ids = {
            "student_id": student.id,
            "course_id": course.id,
            "module_id": module.id,
            "lesson_id": lesson.id,
        }

    yield {"app": app, **ids}

    with app.app_context():
        db.session.rollback()
        for model in (LessonCompletion, ModuleProgress, Enrollment):
            try:
                model.query.delete(synchronize_session=False)
            except Exception:
                pass
        try:
            Lesson.query.filter(Lesson.id == ids["lesson_id"]).delete(synchronize_session=False)
            Module.query.filter(Module.id == ids["module_id"]).delete(synchronize_session=False)
            Course.query.filter(Course.id == ids["course_id"]).delete(synchronize_session=False)
            User.query.filter(
                User.id.in_([ids["student_id"], ids["instructor_id"]])
            ).delete(synchronize_session=False)
            db.session.commit()
        except Exception:
            db.session.rollback()


def _headers(user_id, app):
    with app.app_context():
        token = create_access_token(identity=str(user_id))
    return {"Authorization": f"Bearer {token}"}


def _post_progress(env, payload):
    client = env["app"].test_client()
    return client.post(
        f"/api/v1/student/lessons/{env['lesson_id']}/progress",
        json=payload,
        headers=_headers(env["student_id"], env["app"]),
    )


def _completion(student_id, lesson_id):
    return LessonCompletion.query.filter_by(
        student_id=student_id, lesson_id=lesson_id
    ).first()


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------

def test_sanitize_rejects_garbage_and_clamps():
    assert _sanitize_mixed_video_progress(None) is None
    assert _sanitize_mixed_video_progress([1, 2]) is None
    assert _sanitize_mixed_video_progress({}) is None
    # Bad keys are skipped; good entries survive
    cleaned = _sanitize_mixed_video_progress({
        "1": 50,
        "abc": 80,
        "-3": 10,
        "2": float("nan"),
        "3": 150,          # clamped to 100
        "4": "not-a-number",
    })
    assert cleaned == {"1": 50.0, "3": 100.0}


def test_mixed_video_section_indices_parsed_from_content():
    assert _mixed_video_section_indices(MIXED_CONTENT) == [1, 3]
    assert _mixed_video_section_indices(None) is None
    assert _mixed_video_section_indices("not json") is None
    assert _mixed_video_section_indices('{"a": 1}') is None


def test_coverage_lookup_handles_number_and_dict_entries():
    progress = {
        "1": 95.0,
        "3": {"progress": 80.0, "currentTime": 12.5, "completed": False},
    }
    assert _mixed_video_coverage_at(progress, 1) == 95.0
    assert _mixed_video_coverage_at(progress, 3) == 80.0
    assert _mixed_video_coverage_at(progress, 9) == 0.0
    assert _mixed_video_coverage_at(None, 1) == 0.0


# ---------------------------------------------------------------------------
# API behaviour
# ---------------------------------------------------------------------------

def test_partial_completion_does_not_mark_video_completed(env):
    """One of two videos at 100% must NOT derive video_completed."""
    resp = _post_progress(env, {
        "mixed_video_progress": {"1": 100, "3": 40},
        "video_progress": 100,
        "reading_progress": 5.0,
    })
    assert resp.status_code == 200

    with env["app"].app_context():
        rec = _completion(env["student_id"], env["lesson_id"])
        assert rec is not None
        assert rec.video_completed is False
        stored = json.loads(rec.mixed_video_progress)
        assert stored["1"] == 100.0
        assert stored["3"] == 40.0


def test_all_videos_complete_derives_video_completed(env):
    """Every video section >= 90 derives video_completed True."""
    assert _post_progress(env, {
        "mixed_video_progress": {"1": 95, "3": 30},
    }).status_code == 200

    resp = _post_progress(env, {
        "mixed_video_progress": {"3": 92},
        "video_completed": False,  # client flag ignored
    })
    assert resp.status_code == 200

    with env["app"].app_context():
        rec = _completion(env["student_id"], env["lesson_id"])
        assert rec.video_completed is True
        assert rec.video_watch_count == 1
        stored = json.loads(rec.mixed_video_progress)
        assert stored["1"] == 95.0
        assert stored["3"] == 92.0


def test_mixed_progress_is_monotonic_per_index(env):
    assert _post_progress(env, {
        "mixed_video_progress": {"1": 95, "3": 70},
    }).status_code == 200
    # A later, lower report must never regress stored coverage.
    resp = _post_progress(env, {
        "mixed_video_progress": {"1": 10, "3": 200},
    })
    assert resp.status_code == 200

    with env["app"].app_context():
        rec = _completion(env["student_id"], env["lesson_id"])
        stored = json.loads(rec.mixed_video_progress)
        assert stored["1"] == 95.0   # 10 did not regress 95
        assert stored["3"] == 100.0  # 200 clamped to 100
        assert rec.video_completed is True  # both now >= 90
        assert rec.video_watch_count == 1


def test_watch_count_increments_only_once(env):
    for _ in range(3):
        assert _post_progress(env, {
            "mixed_video_progress": {"1": 100, "3": 100},
        }).status_code == 200

    with env["app"].app_context():
        rec = _completion(env["student_id"], env["lesson_id"])
        assert rec.video_watch_count == 1


def test_structured_entries_sanitized_and_restored(env):
    resp = _post_progress(env, {
        "mixed_video_progress": {
            "1": {"progress": 95.5, "currentTime": 42.0, "completed": True},
            "3": {"progress": "bad", "currentTime": -5},
        },
    })
    assert resp.status_code == 200

    with env["app"].app_context():
        rec = _completion(env["student_id"], env["lesson_id"])
        stored = json.loads(rec.mixed_video_progress)
        assert stored["1"]["progress"] == 95.5
        assert stored["1"]["currentTime"] == 42.0
        assert stored["1"]["completed"] is True
        assert "3" not in stored  # unusable entry dropped

    # GET returns the stored JSON for client-side resume.
    client = env["app"].test_client()
    get_resp = client.get(
        f"/api/v1/student/lessons/{env['lesson_id']}/progress",
        headers=_headers(env["student_id"], env["app"]),
    )
    assert get_resp.status_code == 200
    body = get_resp.get_json()
    raw = body["progress"]["mixed_video_progress"]
    parsed = json.loads(raw) if isinstance(raw, str) else raw
    assert parsed["1"]["progress"] == 95.5
