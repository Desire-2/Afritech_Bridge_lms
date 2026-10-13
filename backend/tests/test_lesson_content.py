"""Lesson content contract tests.

Covers the write-side validator (frontend/src/lib/lesson-content.ts is the
shared contract) and the backend's mirror of the coverage-index rule:

C-1  validate_lesson_content accepts markdown text, URLs and mixed JSON
C-2  validate_lesson_content rejects empty/unknown types and non-JSON mixed
C-3  validate_lesson_content rejects mixed JSON of the wrong shape
C-4  _mixed_video_section_indices keeps legacy flat indices unchanged
C-5  canonical section objects produce the same coverage indices as legacy
C-6  a section title contributes exactly one phantom heading slot
C-7  PUT/POST reject invalid mixed content with 400 and do not persist it
"""

import json
import uuid

import pytest
from flask_jwt_extended import create_access_token

from src.models.course_models import Course, Module, Lesson
from src.models.user_models import User, Role, db
from src.routes.student_routes import _mixed_video_section_indices
from src.utils.lesson_content import validate_lesson_content


# ── C-1 / C-2 / C-3: write-side validation ─────────────────────────────────

def test_accepts_markdown_text_lesson():
    ok, err = validate_lesson_content("text", "# Title\n\n## Section\n\nBody")
    assert ok is True
    assert err is None


def test_accepts_video_and_pdf_urls():
    assert validate_lesson_content("video", "https://example.com/a.mp4") == (True, None)
    assert validate_lesson_content("pdf", "https://drive.google.com/file/d/x") == (True, None)


def test_accepts_legacy_flat_mixed_json():
    payload = json.dumps([
        {"type": "heading", "content": "Intro"},
        {"type": "text", "content": "body"},
        {"type": "video", "url": "https://example.com/a.mp4"},
    ])
    assert validate_lesson_content("mixed", payload) == (True, None)


def test_accepts_canonical_section_json():
    payload = json.dumps([
        {
            "id": "sec_a",
            "type": "section",
            "title": "Intro",
            "blocks": [
                {"type": "text", "content": "body"},
                {"type": "video", "url": "https://example.com/a.mp4"},
            ],
        }
    ])
    assert validate_lesson_content("mixed", payload) == (True, None)


def test_accepts_object_wrapped_sections():
    payload = json.dumps({"sections": [{"title": "A", "blocks": [{"type": "text", "content": "x"}]}]})
    assert validate_lesson_content("mixed", payload) == (True, None)


def test_rejects_empty_content_data():
    ok, err = validate_lesson_content("mixed", "   ")
    assert ok is False
    assert "content_data" in err


def test_rejects_unknown_content_type():
    ok, err = validate_lesson_content("slides", "whatever")
    assert ok is False
    assert "content_type" in err


def test_rejects_markdown_saved_as_mixed():
    ok, err = validate_lesson_content("mixed", "## Just markdown\n\nNot JSON")
    assert ok is False
    assert "JSON" in err


def test_rejects_mixed_json_of_wrong_shape():
    for payload in ('"a string"', "123", "true", '{"foo": 1}', "null"):
        ok, err = validate_lesson_content("mixed", payload)
        assert ok is False, payload
        assert err


# ── C-4 / C-5 / C-6: coverage-index mirror ─────────────────────────────────

LEGACY_FLAT = json.dumps([
    {"type": "text", "content": "intro"},
    {"type": "video", "url": "https://example.com/a.mp4"},
    {"type": "text", "content": "middle"},
    {"type": "video", "url": "https://example.com/b.mp4"},
])

# The same lesson (no legacy heading blocks) stored canonically: titles are
# empty, so no phantom slots appear and the indices stay 1 and 3.
CANONICAL_UNTITLED = json.dumps([
    {
        "id": "sec_intro",
        "type": "section",
        "title": "",
        "blocks": [
            {"type": "text", "content": "intro"},
            {"type": "video", "url": "https://example.com/a.mp4"},
        ],
    },
    {
        "id": "sec_mid",
        "type": "section",
        "title": "",
        "blocks": [
            {"type": "text", "content": "middle"},
            {"type": "video", "url": "https://example.com/b.mp4"},
        ],
    },
])

# A legacy lesson that WAS authored with heading blocks, plus its canonical
# equivalent: each heading becomes a section title, each contributing exactly
# one phantom slot where the heading used to sit.
LEGACY_WITH_HEADINGS = json.dumps([
    {"type": "heading", "content": "Introduction"},
    {"type": "text", "content": "intro"},
    {"type": "video", "url": "https://example.com/a.mp4"},
    {"type": "heading", "content": "Middle"},
    {"type": "text", "content": "middle"},
    {"type": "video", "url": "https://example.com/b.mp4"},
])

CANONICAL_WITH_TITLES = json.dumps([
    {
        "id": "sec_intro",
        "type": "section",
        "title": "Introduction",
        "blocks": [
            {"type": "text", "content": "intro"},
            {"type": "video", "url": "https://example.com/a.mp4"},
        ],
    },
    {
        "id": "sec_mid",
        "type": "section",
        "title": "Middle",
        "blocks": [
            {"type": "text", "content": "middle"},
            {"type": "video", "url": "https://example.com/b.mp4"},
        ],
    },
])


def test_legacy_flat_indices_are_positions():
    assert _mixed_video_section_indices(LEGACY_FLAT) == [1, 3]


def test_canonical_untitled_indices_match_legacy():
    assert _mixed_video_section_indices(CANONICAL_UNTITLED) == [1, 3]


def test_canonical_titled_indices_match_legacy_headings():
    assert _mixed_video_section_indices(LEGACY_WITH_HEADINGS) == [2, 5]
    assert _mixed_video_section_indices(CANONICAL_WITH_TITLES) == [2, 5]


def test_untitled_section_contributes_no_phantom_slot():
    payload = json.dumps([
        {"id": "a", "type": "section", "title": "", "blocks": [{"type": "video", "url": "https://x/v.mp4"}]},
    ])
    assert _mixed_video_section_indices(payload) == [0]


def test_title_contributes_exactly_one_slot():
    payload = json.dumps([
        {"id": "a", "type": "section", "title": "T", "blocks": [{"type": "video", "url": "https://x/v.mp4"}]},
        {"id": "b", "type": "section", "title": "U", "blocks": [{"type": "video", "url": "https://x/w.mp4"}]},
    ])
    assert _mixed_video_section_indices(payload) == [1, 3]


def test_unparseable_payload_returns_none():
    assert _mixed_video_section_indices("not json") is None
    assert _mixed_video_section_indices("") is None
    assert _mixed_video_section_indices('{"sections": []}') is None


# ── C-7: routes enforce the contract ───────────────────────────────────────

@pytest.fixture()
def env(app):
    with app.app_context():
        db.create_all()
        suffix = uuid.uuid4().hex[:10]

        role = Role.query.filter_by(name="instructor").first()
        if role is None:
            role = Role(name="instructor")
            db.session.add(role)
            db.session.flush()

        instructor = User(
            username=f"lc_inst_{suffix}",
            email=f"lc_inst_{suffix}@example.test",
            role_id=role.id,
        )
        instructor.set_password("Password123!")
        db.session.add(instructor)
        db.session.flush()

        course = Course(
            title=f"LC Course {suffix}",
            description="lesson content contract",
            instructor_id=instructor.id,
            is_published=False,
            enrollment_type="free",
        )
        db.session.add(course)
        db.session.flush()

        module = Module(
            title=f"LC Module {suffix}",
            description="m",
            course_id=course.id,
            order=1,
            is_published=False,
        )
        db.session.add(module)
        db.session.flush()

        lesson = Lesson(
            title=f"LC Lesson {suffix}",
            content_type="mixed",
            content_data=LEGACY_FLAT,
            module_id=module.id,
            order=1,
            is_published=False,
        )
        db.session.add(lesson)
        db.session.commit()

        ids = {
            "instructor_id": instructor.id,
            "course_id": course.id,
            "module_id": module.id,
            "lesson_id": lesson.id,
        }

    yield {"app": app, **ids}

    with app.app_context():
        db.session.rollback()
        try:
            Lesson.query.filter(Lesson.id == ids["lesson_id"]).delete(synchronize_session=False)
            Module.query.filter(Module.id == ids["module_id"]).delete(synchronize_session=False)
            Course.query.filter(Course.id == ids["course_id"]).delete(synchronize_session=False)
            User.query.filter(User.id == ids["instructor_id"]).delete(synchronize_session=False)
            db.session.commit()
        except Exception:
            db.session.rollback()


def _headers(user_id, app):
    with app.app_context():
        token = create_access_token(identity=str(user_id))
    return {"Authorization": f"Bearer {token}"}


def _url(env, lesson_id=None):
    base = (
        f"/api/v1/instructor/courses/{env['course_id']}"
        f"/modules/{env['module_id']}/lessons"
    )
    return f"{base}/{lesson_id}" if lesson_id else base


def test_put_rejects_invalid_mixed_content(env, client):
    url = _url(env, env["lesson_id"])
    before = LEGACY_FLAT

    response = client.put(
        url,
        json={"content_data": "## markdown pretending to be mixed"},
        headers=_headers(env["instructor_id"], env["app"]),
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "INVALID_LESSON_CONTENT"

    with env["app"].app_context():
        stored = Lesson.query.get(env["lesson_id"])
        assert stored.content_data == before


def test_put_accepts_canonical_sections(env, client):
    url = _url(env, env["lesson_id"])
    canonical = [
        {
            "id": "sec_intro",
            "type": "section",
            "title": "Introduction",
            "blocks": [
                {"type": "text", "content": "intro"},
                {"type": "video", "url": "https://example.com/a.mp4"},
            ],
        }
    ]

    response = client.put(
        url,
        json={"content_data": json.dumps(canonical)},
        headers=_headers(env["instructor_id"], env["app"]),
    )

    assert response.status_code == 200
    with env["app"].app_context():
        stored = Lesson.query.get(env["lesson_id"])
        assert json.loads(stored.content_data)[0]["id"] == "sec_intro"
        # Coverage indices survive the format change.
        # Title slot + text slot put the video at coverage index 2.
        assert _mixed_video_section_indices(stored.content_data) == [2]


def test_post_rejects_invalid_mixed_content(env, client):
    url = _url(env)
    response = client.post(
        url,
        json={
            "title": "Bad Lesson",
            "content_type": "mixed",
            "content_data": json.dumps({"nope": True}),
        },
        headers=_headers(env["instructor_id"], env["app"]),
    )
    assert response.status_code == 400
    assert response.get_json()["error"] == "INVALID_LESSON_CONTENT"


def test_put_rejects_changing_type_to_mixed_with_markdown(env, client):
    url = _url(env, env["lesson_id"])
    response = client.put(
        url,
        json={"content_type": "mixed", "content_data": "# A text lesson"},
        headers=_headers(env["instructor_id"], env["app"]),
    )
    assert response.status_code == 400
    assert response.get_json()["error"] == "INVALID_LESSON_CONTENT"
