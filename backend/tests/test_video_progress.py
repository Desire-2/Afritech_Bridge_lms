"""Regression tests for video-progress persistence and engagement scoring.

Covers the video-engagement pipeline end to end at the API + model layer:

  V-1  A new video starts at zero without clobbering an existing position
  V-2  Watched coverage is persisted (monotonic max)
  V-3  Engagement score is lifted by the validated video-evidence floor
  V-4  Lesson score incorporates engagement via configured weights
  V-5  Duplicate/out-of-order updates never inflate engagement or coverage
  V-6  Client-submitted video_completed is IGNORED; derived from coverage>=90
  V-7  video_watch_count increments only on the false->true transition
  V-8  video_current_time is never overwritten back to zero (resume preserved)
  V-9  Invalid client scores (NaN, negative, >100) are rejected/clamped
  V-10 An unrelated student cannot modify another student's progress (403)
  V-11 Video progress is scoped to the correct lesson + enrollment
  V-12 Module score / progression use the authoritative lesson score
  V-13 A suspended enrollment cannot mutate progress (403)
"""

import uuid

import pytest
from flask_jwt_extended import create_access_token

from src.models.course_models import Course, Module, Lesson, Enrollment
from src.models.student_models import LessonCompletion, ModuleProgress
from src.models.user_models import User, Role, db
from src.routes.student_routes import (
    VIDEO_WATCH_COMPLETE_THRESHOLD,
    _engagement_floor_from_evidence,
    _coerce_float,
)


@pytest.fixture()
def env(app):
    """One free published course, one video lesson, one student + outsider.

    IMPORTANT: setup/teardown run in their own app contexts and the yield
    happens OUTSIDE any open context. Yielding inside an active context makes
    the test client request reuse that context's scoped session (and its
    identity map), which masks committed writes — e.g. a suspended enrollment
    still appearing active inside the request.
    """
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

        student = make_user("vid_student", student_role)
        outsider = make_user("vid_outsider", student_role)
        instructor = make_user("vid_inst", instructor_role)

        course = Course(
            title=f"Video Pipeline {suffix}",
            description="video progress tests",
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
            title=f"Video Lesson {suffix}",
            content_type="video",
            content_data='{"video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}',
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
            "outsider_id": outsider.id,
            "instructor_id": instructor.id,
            "course_id": course.id,
            "module_id": module.id,
            "lesson_id": lesson.id,
            "enrollment_id": enrollment.id,
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
                User.id.in_([ids["student_id"], ids["outsider_id"], ids["instructor_id"]])
            ).delete(synchronize_session=False)
            db.session.commit()
        except Exception:
            db.session.rollback()


def _headers(user_id, app):
    with app.app_context():
        token = create_access_token(identity=str(user_id))
    return {"Authorization": f"Bearer {token}"}


def _post_progress(env, payload, user_id=None):
    client = env["app"].test_client()
    return client.post(
        f"/api/v1/student/lessons/{env['lesson_id']}/progress",
        json=payload,
        headers=_headers(user_id or env["student_id"], env["app"]),
    )


def _completion(student_id, lesson_id):
    return LessonCompletion.query.filter_by(
        student_id=student_id, lesson_id=lesson_id
    ).first()


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------

def test_coerce_float_rejects_nan_and_infinity():
    assert _coerce_float(float("nan")) is None
    assert _coerce_float(float("inf")) is None
    assert _coerce_float("abc") is None
    assert _coerce_float(None) is None
    assert _coerce_float(150, lo=0, hi=100) == 100.0
    assert _coerce_float(-5, lo=0, hi=100) == 0.0
    assert _coerce_float("42.5") == 42.5


def test_engagement_floor_uses_documented_weights():
    # Full coverage, no scroll/time: floor = 0.40 * 100 = 40
    assert abs(_engagement_floor_from_evidence(100, 0, 0) - 40.0) < 0.01
    # Full coverage + full scroll + 600s time: 40 + 10 + 15 + 5 = 70
    assert abs(_engagement_floor_from_evidence(100, 100, 600) - 70.0) < 0.01
    # The helper computes from whatever evidence is given; the ROUTE only
    # applies the floor when validated video coverage > 0. With no video
    # evidence but scroll+time, the arithmetic floor is 10+15+5=30 — the
    # route never applies it in that case.
    assert abs(_engagement_floor_from_evidence(0, 100, 600) - 30.0) < 0.01
    # Clamped inputs
    assert _engagement_floor_from_evidence(500, -10, -1) == 40.0


# ---------------------------------------------------------------------------
# API persistence
# ---------------------------------------------------------------------------

def test_progress_created_and_coverage_persisted(env):
    resp = _post_progress(env, {
        "video_progress": 42.5,
        "video_current_time": 42.5,
        "video_duration": 100.0,
        "reading_progress": 10.0,
        "engagement_score": 20.0,
    })
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["progress"]["video_progress"] == 42.5
    assert body["progress"]["video_current_time"] == 42.5

    with env["app"].app_context():
        rec = _completion(env["student_id"], env["lesson_id"])
        assert rec is not None
        assert rec.video_progress == 42.5
        assert rec.video_completed is False


def test_coverage_is_monotonic_and_duplicates_do_not_inflate(env):
    _post_progress(env, {"video_progress": 60, "engagement_score": 30})
    # Older/smaller update (out-of-order network retry)
    resp = _post_progress(env, {"video_progress": 20, "engagement_score": 10})
    assert resp.status_code == 200
    with env["app"].app_context():
        rec = _completion(env["student_id"], env["lesson_id"])
        assert rec.video_progress == 60.0
        assert rec.engagement_score >= 30.0


def test_video_completed_derived_from_coverage_not_client_flag(env):
    # Client LIES about completion with only 30% coverage
    _post_progress(env, {
        "video_progress": 30,
        "video_completed": True,  # must be ignored
    })
    with env["app"].app_context():
        rec = _completion(env["student_id"], env["lesson_id"])
        assert rec.video_completed is False
        assert rec.video_watch_count == 0

    # Real coverage crosses the threshold -> derived True, count +1
    _post_progress(env, {
        "video_progress": VIDEO_WATCH_COMPLETE_THRESHOLD,
        "video_completed": False, # client flag still ignored
    })
    with env["app"].app_context():
        rec = _completion(env["student_id"], env["lesson_id"])
        assert rec.video_completed is True
        assert rec.video_watch_count == 1


def test_watch_count_increments_once_not_every_save(env):
    _post_progress(env, {"video_progress": 95})
    # Many duplicate saves after completion (the old bug incremented each time)
    for _ in range(5):
        _post_progress(env, {"video_progress": 95, "video_completed": True})
    with env["app"].app_context():
        rec = _completion(env["student_id"], env["lesson_id"])
        assert rec.video_watch_count == 1


def test_resume_position_never_clobbered_by_zero_report(env):
    _post_progress(env, {
        "video_progress": 50,
        "video_current_time": 500,
        "video_duration": 600,
    })
    # Mount-time zero report (the remount regression)
    _post_progress(env, {
        "video_progress": 0,
        "video_current_time": 0,
        "video_duration": 0,
    })
    with env["app"].app_context():
        rec = _completion(env["student_id"], env["lesson_id"])
        assert rec.video_current_time == 500.0
        assert rec.video_duration == 600.0
        assert rec.video_progress == 50.0


def test_invalid_scores_are_rejected_or_clamped(env):
    resp = _post_progress(env, {
        "video_progress": float("nan"),
        "engagement_score": 250,
        "reading_progress": -20,
        "time_spent": "not-a-number",
    })
    assert resp.status_code == 200
    with env["app"].app_context():
        rec = _completion(env["student_id"], env["lesson_id"])
        assert rec.video_progress == 0.0  # NaN rejected
        assert rec.engagement_score == 100.0  # clamped
        assert rec.reading_progress == 0.0  # negative clamped to 0, no increase
        assert (rec.time_spent or 0) == 0


def test_engagement_floor_lifts_score_from_video_evidence(env):
    # Watch 100% coverage but report a stale low engagement (e.g. saved
    # before the video progressed). The server floor must lift it.
    _post_progress(env, {
        "video_progress": 100,
        "video_current_time": 100,
        "video_duration": 100,
        "engagement_score": 5,  # stale client value
        "scroll_progress": 0,
        "time_spent": 0,
    })
    with env["app"].app_context():
        rec = _completion(env["student_id"], env["lesson_id"])
        assert rec.engagement_score >= 40.0, (
            "100% watched coverage must yield >=40 engagement (video weight 0.40)"
        )


def test_lesson_score_incorporates_engagement_via_weights(env):
    # No assessments on this lesson -> Reading 50% + Engagement 50%,
    # with the documented reading penalty below 90%.
    _post_progress(env, {
        "video_progress": 100,
        "reading_progress": 80,
        "scroll_progress": 100,
        "engagement_score": 60,
        "time_spent": 600,
    })
    with env["app"].app_context():
        rec = _completion(env["student_id"], env["lesson_id"])
        # Engagement is lifted by the floor: max(60, 40+10+15+5=70) = 70.
        assert rec.engagement_score == pytest.approx(70.0, abs=0.01)
        reading = rec.reading_progress  # 80
        engagement = rec.engagement_score  # 70
        reading_penalty = 0.5 + (reading / 90.0) * 0.5  # reading < 90
        expected = ((reading * 0.5) + (engagement * 0.5)) * reading_penalty
        assert rec.calculate_lesson_score() == pytest.approx(expected, abs=0.01)
        # The video percent (100) is NOT the lesson score — engagement is one
        # weighted component of the lesson score, not a pass-through.
        assert rec.calculate_lesson_score() != 100.0


def test_video_progress_scoped_to_correct_lesson(env):
    # Second lesson in the same module
    with env["app"].app_context():
        lesson2 = Lesson(
            title="Second video lesson",
            content_type="video",
            content_data="{}",
            module_id=env["module_id"],
            order=2,
            is_published=True,
        )
        db.session.add(lesson2)
        db.session.commit()
        lesson2_id = lesson2.id

    client = env["app"].test_client()
    resp = client.post(
        f"/api/v1/student/lessons/{lesson2_id}/progress",
        json={"video_progress": 75},
        headers=_headers(env["student_id"], env["app"]),
    )
    assert resp.status_code == 200

    with env["app"].app_context():
        rec1 = _completion(env["student_id"], env["lesson_id"])
        rec2 = _completion(env["student_id"], lesson2_id)
        assert rec1 is None, "progress for lesson 1 must not be affected"
        assert rec2 is not None and rec2.video_progress == 75.0


def test_unauthenticated_and_unrelated_students_cannot_mutate(env):
    client = env["app"].test_client()
    # No token
    resp = client.post(
        f"/api/v1/student/lessons/{env['lesson_id']}/progress",
        json={"video_progress": 50},
    )
    assert resp.status_code in (401, 403)

    # Authenticated but not enrolled -> 403
    resp = _post_progress(env, {"video_progress": 50}, user_id=env["outsider_id"])
    assert resp.status_code == 403


def test_suspended_enrollment_cannot_mutate_progress(env):
    with env["app"].app_context():
        updated = Enrollment.query.filter_by(
            student_id=env["student_id"], course_id=env["course_id"]
        ).update({"status": "suspended"}, synchronize_session=False)
        db.session.commit()
        assert updated >= 1
    resp = _post_progress(env, {"video_progress": 50})
    assert resp.status_code == 403, resp.get_json()
    body = resp.get_json()
    assert body.get("error_code") in ("enrollment_blocked", "cohort_not_started", "payment_required")


def test_get_progress_returns_restorable_snapshot(env):
    _post_progress(env, {
        "video_progress": 55,
        "video_current_time": 333,
        "video_duration": 600,
        "reading_progress": 40,
        "engagement_score": 35,
    })
    client = env["app"].test_client()
    resp = client.get(
        f"/api/v1/student/lessons/{env['lesson_id']}/progress",
        headers=_headers(env["student_id"], env["app"]),
    )
    assert resp.status_code == 200
    p = resp.get_json()["progress"]
    assert p["video_progress"] == 55.0
    assert p["video_current_time"] == 333.0
    assert p["video_duration"] == 600.0
    assert p["completed"] is False


def test_full_watch_marks_completed_and_lesson_score_uses_it(env):
    # Watch everything, strong reading -> lesson should reach the 80% gate
    # (reading 100 * 0.5 + engagement >= 60 * 0.5, penalties off).
    _post_progress(env, {
        "video_progress": 100,
        "video_current_time": 100,
        "video_duration": 100,
        "reading_progress": 100,
        "scroll_progress": 100,
        "engagement_score": 80,
        "time_spent": 900,
    })
    with env["app"].app_context():
        rec = _completion(env["student_id"], env["lesson_id"])
        assert rec.video_completed is True
        score = rec.calculate_lesson_score()
        assert score >= 80.0, f"expected >=80 with full engagement, got {score}"


def test_malformed_json_body_does_not_500(env):
    resp = _post_progress(env, {
        "video_progress": {"nested": "object"},
        "engagement_score": [1, 2, 3],
        "time_spent": {"a": 1},
    })
    assert resp.status_code == 200
    with env["app"].app_context():
        rec = _completion(env["student_id"], env["lesson_id"])
        assert rec.video_progress == 0.0
        assert rec.engagement_score == 0.0
