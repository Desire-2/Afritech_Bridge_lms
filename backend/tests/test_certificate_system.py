"""Certificate system tests: canonical 70% eligibility, generation,
idempotency, uniqueness, verification privacy, and QR encoding.

Uses the same isolated-scenario pattern as test_progress_completion:
fixture yields OUTSIDE any open app context with plain ids.
"""

import json
import uuid

import pytest

from src.models.course_models import Course, Module, Lesson, Enrollment
from src.models.student_models import Certificate, LessonCompletion, ModuleProgress
from src.models.user_models import User, Role, db
from src.services.certificate_service import (
    CertificateService,
    CERTIFICATE_PASSING_THRESHOLD,
)


@pytest.fixture()
def scenario(app):
    """One published module with two lessons; student enrolled."""
    with app.app_context():
        db.create_all()
        suffix = uuid.uuid4().hex[:10]

        student_role = Role.query.filter_by(name="student").first() or Role(name="student")
        if student_role.id is None:
            db.session.add(student_role)
            db.session.flush()
        instructor_role = Role.query.filter_by(name="instructor").first() or Role(name="instructor")
        if instructor_role.id is None:
            db.session.add(instructor_role)
            db.session.flush()

        instructor = User(
            username=f"cert_inst_{suffix}",
            email=f"cert_inst_{suffix}@example.test",
            role_id=instructor_role.id,
        )
        instructor.set_password("InstructorPassword123!")
        db.session.add(instructor)
        db.session.flush()

        student = User(
            username=f"cert_student_{suffix}",
            email=f"cert_student_{suffix}@example.test",
            role_id=student_role.id,
        )
        student.set_password("StudentPassword123!")
        db.session.add(student)
        db.session.flush()

        course = Course(
            title=f"Certificate Course {suffix}",
            description="Certificate system tests.",
            instructor_id=instructor.id,
            is_published=True,
            enrollment_type="free",
        )
        db.session.add(course)
        db.session.flush()

        module = Module(
            title=f"Module {suffix}",
            description="module",
            course_id=course.id,
            order=1,
            is_published=True,
        )
        db.session.add(module)
        db.session.flush()

        lessons = []
        for order in (1, 2):
            lesson = Lesson(
                title=f"Lesson {order} {suffix}",
                content_type="text",
                content_data="<p>content</p>",
                module_id=module.id,
                order=order,
                is_published=True,
            )
            db.session.add(lesson)
            lessons.append(lesson)
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
            "enrollment_id": enrollment.id,
            "module_id": module.id,
            "lesson_ids": [l.id for l in lessons],
            "instructor_id": instructor.id,
        }
        yield ids

        db.session.rollback()
        db.session.remove()
        with app.app_context():
            try:
                LessonCompletion.query.delete(synchronize_session=False)
                ModuleProgress.query.delete(synchronize_session=False)
                Enrollment.query.delete(synchronize_session=False)
                Module.query.delete(synchronize_session=False)
                Lesson.query.delete(synchronize_session=False)
                Certificate.query.delete(synchronize_session=False)
                User.query.filter(User.id.in_([ids["student_id"], ids["instructor_id"]])).delete(
                    synchronize_session=False
                )
                Course.query.filter(Course.id == ids["course_id"]).delete(
                    synchronize_session=False
                )
                db.session.commit()
            except Exception:
                db.session.rollback()


def _complete_all_content_and_score(student_id, enrollment_id, lesson_ids, module_id,
                                    target_score):
    """Finish every lesson and drive the module score to ``target_score``.

    Lessons without assessments score Reading 50% + Engagement 50%, so
    setting both components to the target produces that overall score via
    the authoritative calculate_course_score() chain.
    """
    for lid in lesson_ids:
        completion = LessonCompletion.query.filter_by(
            student_id=student_id, lesson_id=lid
        ).first()
        if completion is None:
            completion = LessonCompletion(student_id=student_id, lesson_id=lid)
            db.session.add(completion)
        completion.completed = True
        completion.completed_at = None
        completion.reading_progress = float(target_score)
        completion.engagement_score = float(target_score)

    progress = ModuleProgress.query.filter_by(
        student_id=student_id, module_id=module_id, enrollment_id=enrollment_id
    ).first()
    if progress is None:
        progress = ModuleProgress(
            student_id=student_id, module_id=module_id, enrollment_id=enrollment_id
        )
        db.session.add(progress)
    progress.status = "completed"
    progress.cumulative_score = float(target_score)
    db.session.commit()


def _force_course_score(monkeypatch, score):
    """Pin Enrollment.calculate_course_score to a fixed value.

    The lesson-level scoring formula (reading/engagement penalties etc.) is
    covered by test_progress_completion; certificate tests isolate the
    certificate rule itself.
    """
    from src.models.course_models import Enrollment

    def _fixed(self, _score=score):
        return float(_score)

    monkeypatch.setattr(Enrollment, "calculate_course_score", _fixed)


# ── Eligibility thresholds ──────────────────────────────────────────────

def test_threshold_constant_is_70():
    assert CERTIFICATE_PASSING_THRESHOLD == 70.0


def test_score_69_is_ineligible(scenario, monkeypatch):
    _complete_all_content_and_score(
        scenario["student_id"], scenario["enrollment_id"],
        scenario["lesson_ids"], scenario["module_id"], 69.0,
    )
    _force_course_score(monkeypatch, 69.0)
    eligibility = CertificateService.evaluate_eligibility(
        scenario["student_id"], scenario["course_id"]
    )
    assert eligibility["eligible"] is False
    assert eligibility["error_code"] == "INSUFFICIENT_SCORE"
    assert eligibility["current_score"] == pytest.approx(69.0)
    assert eligibility["required_score"] == 70.0
    assert "overall_score" in eligibility["missing_requirements"]
    assert eligibility["next_steps"]


def test_score_6999_is_ineligible(scenario, monkeypatch):
    _complete_all_content_and_score(
        scenario["student_id"], scenario["enrollment_id"],
        scenario["lesson_ids"], scenario["module_id"], 69.99,
    )
    _force_course_score(monkeypatch, 69.99)
    eligibility = CertificateService.evaluate_eligibility(
        scenario["student_id"], scenario["course_id"]
    )
    # Decision uses the raw score (69.99 < 70); display rounds to 1 decimal.
    assert eligibility["eligible"] is False
    assert eligibility["error_code"] == "INSUFFICIENT_SCORE"
    assert "overall_score" in eligibility["missing_requirements"]


def test_score_exactly_70_is_eligible(scenario, monkeypatch):
    _complete_all_content_and_score(
        scenario["student_id"], scenario["enrollment_id"],
        scenario["lesson_ids"], scenario["module_id"], 70.0,
    )
    _force_course_score(monkeypatch, 70.0)
    eligibility = CertificateService.evaluate_eligibility(
        scenario["student_id"], scenario["course_id"]
    )
    assert eligibility["eligible"] is True
    assert eligibility["current_score"] >= eligibility["required_score"]
    assert eligibility["all_modules_completed"] is True
    assert eligibility["error_code"] is None


def test_score_above_70_is_eligible(scenario, monkeypatch):
    _complete_all_content_and_score(
        scenario["student_id"], scenario["enrollment_id"],
        scenario["lesson_ids"], scenario["module_id"], 85.5,
    )
    _force_course_score(monkeypatch, 85.5)
    eligibility = CertificateService.evaluate_eligibility(
        scenario["student_id"], scenario["course_id"]
    )
    assert eligibility["eligible"] is True


def test_passing_score_does_not_bypass_incomplete_modules(scenario):
    """High score but unfinished lessons → still ineligible."""
    # Score set, but lessons not completed and module not completed.
    progress = ModuleProgress(
        student_id=scenario["student_id"],
        module_id=scenario["module_id"],
        enrollment_id=scenario["enrollment_id"],
        status="in_progress",
        cumulative_score=95.0,
    )
    db.session.add(progress)
    db.session.commit()

    eligibility = CertificateService.evaluate_eligibility(
        scenario["student_id"], scenario["course_id"]
    )
    assert eligibility["eligible"] is False
    assert "all_modules_completed" in eligibility["missing_requirements"]
    assert eligibility["all_modules_completed"] is False


def test_unstarted_course_has_no_fabricated_score(scenario):
    eligibility = CertificateService.evaluate_eligibility(
        scenario["student_id"], scenario["course_id"]
    )
    assert eligibility["eligible"] is False
    assert eligibility["current_score"] == 0.0
    assert eligibility["completed_modules"] == 0


def test_module_breakdown_shape_is_consistent(scenario):
    _complete_all_content_and_score(
        scenario["student_id"], scenario["enrollment_id"],
        scenario["lesson_ids"], scenario["module_id"], 65.0,
    )
    eligibility = CertificateService.evaluate_eligibility(
        scenario["student_id"], scenario["course_id"]
    )
    breakdown = eligibility["module_breakdown"]
    assert len(breakdown) == 1
    entry = breakdown[0]
    assert set(entry) >= {"module_id", "module_name", "status", "score",
                          "attempts", "is_passing"}
    assert isinstance(entry["is_passing"], bool)
    assert isinstance(eligibility["failed_modules"], int)


# ── Generation ──────────────────────────────────────────────────────────

def test_ineligible_student_cannot_generate(scenario):
    success, message, payload = CertificateService.generate_certificate(
        scenario["student_id"], scenario["course_id"]
    )
    assert success is False
    assert payload["eligible"] is False
    assert Certificate.query.filter_by(student_id=scenario["student_id"]).count() == 0


def test_eligible_student_generates_certificate(scenario, monkeypatch):
    _complete_all_content_and_score(
        scenario["student_id"], scenario["enrollment_id"],
        scenario["lesson_ids"], scenario["module_id"], 75.0,
    )
    _force_course_score(monkeypatch, 75.0)
    success, message, payload = CertificateService.generate_certificate(
        scenario["student_id"], scenario["course_id"]
    )
    assert success is True
    assert payload["created"] is True
    assert "verification_hash" not in payload
    assert "enrollment_id" not in payload
    cert = Certificate.query.filter_by(student_id=scenario["student_id"]).first()
    assert cert is not None
    assert cert.overall_score == pytest.approx(75.0)
    assert cert.verification_hash


def test_repeat_generation_returns_existing_certificate(scenario, monkeypatch):
    _complete_all_content_and_score(
        scenario["student_id"], scenario["enrollment_id"],
        scenario["lesson_ids"], scenario["module_id"], 80.0,
    )
    _force_course_score(monkeypatch, 80.0)
    first = CertificateService.generate_certificate(
        scenario["student_id"], scenario["course_id"]
    )
    second = CertificateService.generate_certificate(
        scenario["student_id"], scenario["course_id"]
    )
    assert first[0] is True and first[2]["created"] is True
    assert second[0] is True and second[2]["created"] is False
    assert second[2]["certificate_number"] == first[2]["certificate_number"]
    assert Certificate.query.filter_by(student_id=scenario["student_id"]).count() == 1


def test_database_blocks_duplicate_certificates(scenario, monkeypatch):
    """Uniqueness is enforced by the schema, not just service logic."""
    engine_unique = any(
        constraint.name == "uq_certificates_student_course"
        for constraint in Certificate.__table__.constraints
    )
    assert engine_unique, "Certificate model must declare the uniqueness constraint"

    from sqlalchemy.exc import IntegrityError

    _complete_all_content_and_score(
        scenario["student_id"], scenario["enrollment_id"],
        scenario["lesson_ids"], scenario["module_id"], 72.0,
    )
    _force_course_score(monkeypatch, 72.0)
    success, _, _ = CertificateService.generate_certificate(
        scenario["student_id"], scenario["course_id"]
    )
    assert success is True

    duplicate = Certificate(
        student_id=scenario["student_id"],
        course_id=scenario["course_id"],
        enrollment_id=scenario["enrollment_id"],
        overall_score=99.0,
        certificate_number="ABC-2026-999991",
        verification_hash="x",
    )
    db.session.add(duplicate)
    with pytest.raises(IntegrityError):
        db.session.flush()
    db.session.rollback()


def test_certificate_number_collision_retries(scenario, monkeypatch):
    """A colliding random number is retried, not surfaced as a failure."""
    _complete_all_content_and_score(
        scenario["student_id"], scenario["enrollment_id"],
        scenario["lesson_ids"], scenario["module_id"], 77.0,
    )
    _force_course_score(monkeypatch, 77.0)

    # Pre-existing certificate occupies one number; force the first
    # generate attempt onto that number, then allow the retry to succeed.
    taken_number = "ABC-2026-111111"
    other_student = User(
        username=f"cert_other_{uuid.uuid4().hex[:8]}",
        email=f"cert_other_{uuid.uuid4().hex[:8]}@example.test",
        role_id=User.query.get(scenario["student_id"]).role_id,
    )
    other_student.set_password("OtherPassword123!")
    db.session.add(other_student)
    db.session.flush()
    other_course = Course(
        title=f"Other Course {uuid.uuid4().hex[:6]}",
        description="other",
        instructor_id=Course.query.get(scenario["course_id"]).instructor_id,
        is_published=True,
        enrollment_type="free",
    )
    db.session.add(other_course)
    db.session.flush()
    other_enrollment = Enrollment(
        student_id=other_student.id, course_id=other_course.id, status="completed"
    )
    db.session.add(other_enrollment)
    db.session.flush()
    db.session.add(Certificate(
        student_id=other_student.id,
        course_id=other_course.id,
        enrollment_id=other_enrollment.id,
        overall_score=90.0,
        certificate_number=taken_number,
        verification_hash="existing",
    ))
    db.session.commit()

    calls = {"n": 0}
    original = Certificate.generate_certificate_number

    def collision_then_unique(self):
        calls["n"] += 1
        if calls["n"] == 1:
            self.certificate_number = taken_number
            if not self.issued_at:
                from src.utils.time_utils import now_local
                self.issued_at = now_local()
            self.recompute_verification_hash()
        else:
            original(self)

    monkeypatch.setattr(Certificate, "generate_certificate_number", collision_then_unique)

    success, message, payload = CertificateService.generate_certificate(
        scenario["student_id"], scenario["course_id"]
    )
    assert success is True
    assert payload["created"] is True
    assert payload["certificate_number"] != taken_number
    assert calls["n"] >= 2


def test_verification_hash_tracks_issued_at(scenario):
    cert = Certificate(
        student_id=scenario["student_id"],
        course_id=scenario["course_id"],
        enrollment_id=scenario["enrollment_id"],
        overall_score=70.0,
    )
    cert.generate_certificate_number()
    first_hash = cert.verification_hash
    assert cert.issued_at is not None

    from src.utils.time_utils import now_local
    cert.issued_at = now_local()
    cert.recompute_verification_hash()
    assert cert.verification_hash != first_hash


# ── Verification privacy & security ─────────────────────────────────────

def _issue(scenario, monkeypatch=None, score=88.0):
    _complete_all_content_and_score(
        scenario["student_id"], scenario["enrollment_id"],
        scenario["lesson_ids"], scenario["module_id"], score,
    )
    if monkeypatch is not None:
        _force_course_score(monkeypatch, score)
    success, message, payload = CertificateService.generate_certificate(
        scenario["student_id"], scenario["course_id"]
    )
    assert success
    return Certificate.query.filter_by(
        student_id=scenario["student_id"], course_id=scenario["course_id"]
    ).first()


def test_public_verification_hides_secrets(scenario, monkeypatch):
    cert = _issue(scenario, monkeypatch)
    valid, message, data = CertificateService.verify_certificate(
        cert.certificate_number
    )
    assert valid is True
    assert "verification_hash" not in data
    assert "student_id" not in data
    assert "enrollment_id" not in data
    assert "id" not in data
    assert data["certificate_number"] == cert.certificate_number
    assert data["status"] == "valid"


def test_student_dict_hides_verification_hash(scenario, monkeypatch):
    cert = _issue(scenario, monkeypatch)
    student_payload = cert.to_student_dict()
    assert "verification_hash" not in student_payload
    assert student_payload["course_id"] == scenario["course_id"]


def test_invalid_certificate_number(scenario):
    valid, message, data = CertificateService.verify_certificate("ABC-2026-000000")
    assert valid is False
    assert message == "Certificate not found"


def test_revoked_certificate_fails_verification(scenario, monkeypatch):
    cert = _issue(scenario, monkeypatch)
    cert.is_active = False
    db.session.commit()
    valid, message, data = CertificateService.verify_certificate(
        cert.certificate_number
    )
    assert valid is False
    assert "revoked" in message.lower()


def test_expired_certificate_fails_verification(scenario, monkeypatch):
    from src.utils.time_utils import now_local
    from datetime import timedelta

    cert = _issue(scenario, monkeypatch)
    cert.expires_at = now_local() - timedelta(days=1)
    db.session.commit()
    valid, message, data = CertificateService.verify_certificate(
        cert.certificate_number
    )
    assert valid is False
    assert "expired" in message.lower()


# ── HTTP routes ─────────────────────────────────────────────────────────

def test_verify_route_rejects_malformed_numbers(client, app, scenario):
    response = client.get("/api/v1/student/certificate/verify/NOT-A-CERT")
    assert response.status_code == 404
    body = response.get_json()
    assert body["success"] is False
    assert "hash" not in json.dumps(body).lower()


def test_verify_route_public_valid(scenario, client, app, monkeypatch):
    cert = _issue(scenario, monkeypatch)
    response = client.get(
        f"/api/v1/student/certificate/verify/{cert.certificate_number}"
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["success"] is True
    assert "verification_hash" not in json.dumps(body)
    assert "enrollment_id" not in json.dumps(body)


def test_qr_endpoint_returns_png(scenario, client, app, monkeypatch):
    cert = _issue(scenario, monkeypatch)
    response = client.get(
        f"/api/v1/student/certificate/verify-qr/{cert.certificate_number}"
    )
    assert response.status_code == 200
    assert response.mimetype == "image/png"
    # PNG magic bytes
    assert response.data[:8] == b"\x89PNG\r\n\x1a\n"


def test_qr_endpoint_404_for_unknown(client, app):
    response = client.get(
        "/api/v1/student/certificate/verify-qr/ABC-2026-424242"
    )
    assert response.status_code == 404


def test_student_cannot_download_other_students_certificate(scenario, client, app, monkeypatch):
    cert = _issue(scenario, monkeypatch)

    other_role = Role.query.filter_by(name="student").first()
    other = User(
        username=f"cert_thief_{uuid.uuid4().hex[:8]}",
        email=f"cert_thief_{uuid.uuid4().hex[:8]}@example.test",
        role_id=other_role.id,
    )
    other.set_password("ThiefPassword123!")
    db.session.add(other)
    db.session.commit()
    other_id = other.id

    from flask_jwt_extended import create_access_token
    with app.app_context():
        token = create_access_token(identity=str(other_id))
    response = client.get(
        f"/api/v1/student/certificate/download/{cert.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404


def test_eligibility_route_canonical_envelope(scenario, client, app, monkeypatch):
    _complete_all_content_and_score(
        scenario["student_id"], scenario["enrollment_id"],
        scenario["lesson_ids"], scenario["module_id"], 69.5,
    )
    _force_course_score(monkeypatch, 69.5)
    from flask_jwt_extended import create_access_token
    with app.app_context():
        token = create_access_token(identity=str(scenario["student_id"]))
    response = client.get(
        f"/api/v1/student/certificate/eligibility/{scenario['course_id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["eligible"] is False
    assert data["error_code"] == "INSUFFICIENT_SCORE"
    assert data["requirements"]["required_score"] == 70.0
    assert data["requirements"]["passing_score"] == 70.0
    assert isinstance(data["requirements"]["failed_modules"], int)
    assert isinstance(data["requirements"]["module_breakdown"], list)
    assert data["next_steps"]


def test_generation_route_uses_canonical_service(scenario, client, app, monkeypatch):
    _complete_all_content_and_score(
        scenario["student_id"], scenario["enrollment_id"],
        scenario["lesson_ids"], scenario["module_id"], 73.0,
    )
    _force_course_score(monkeypatch, 73.0)
    from flask_jwt_extended import create_access_token
    with app.app_context():
        token = create_access_token(identity=str(scenario["student_id"]))

    response = client.post(
        "/api/v1/student/certificates/generate",
        json={"course_id": scenario["course_id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["success"] is True
    assert body["created"] is True
    assert "verification_hash" not in json.dumps(body)

    # Second call returns the existing certificate.
    response2 = client.post(
        "/api/v1/student/certificates/generate",
        json={"course_id": scenario["course_id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response2.status_code == 200
    assert response2.get_json()["created"] is False
    assert Certificate.query.filter_by(
        student_id=scenario["student_id"], course_id=scenario["course_id"]
    ).count() == 1


def test_generation_route_ineligible_contract(scenario, client, app):
    from flask_jwt_extended import create_access_token
    with app.app_context():
        token = create_access_token(identity=str(scenario["student_id"]))
    response = client.post(
        "/api/v1/student/certificates/generate",
        json={"course_id": scenario["course_id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
    body = response.get_json()
    assert body["success"] is False
    assert body["error_code"] in {"INCOMPLETE_MODULES", "INSUFFICIENT_SCORE",
                                  "REQUIREMENTS_NOT_MET"}
    assert body["requirements"]["eligible"] is False
    assert body["summary"]


# ── Badge progress / achievements ───────────────────────────────────────

def test_badge_progress_reports_honestly(scenario):
    from src.models.student_models import SkillBadge

    badge = SkillBadge(
        name="Mystery Badge",
        description="No progress model",
        criteria="{}",
        category="technical",
        difficulty_level="beginner",
    )
    db.session.add(badge)
    db.session.commit()

    progress = CertificateService.get_badge_progress(scenario["student_id"])
    entry = next(p for p in progress["badge_progress"] if p["badge"]["id"] == badge.id)
    assert entry["computable"] is False
    assert entry["progress_percentage"] is None


def test_achievements_summary_uses_real_data(scenario):
    summary = CertificateService.get_achievements_summary(scenario["student_id"])
    assert summary["summary"]["total_certificates"] == 0
    assert summary["summary"]["total_points"] == 0
    assert summary["summary"]["achievement_level"] == "New Learner"
    # No fabricated course names in milestones.
    assert "Python Advanced" not in json.dumps(summary)


def test_course_completion_badge_progress_is_computable(scenario):
    from src.models.student_models import SkillBadge

    course = Course.query.get(scenario["course_id"])
    badge = SkillBadge(
        name=f"{course.title} Completion",
        description="Course completion badge",
        criteria=json.dumps({"type": "course_completion"}),
        category="project",
        difficulty_level="beginner",
    )
    db.session.add(badge)
    db.session.commit()

    progress = CertificateService.get_badge_progress(scenario["student_id"])
    entry = next(p for p in progress["badge_progress"] if p["badge"]["id"] == badge.id)
    assert entry["computable"] is True
    assert entry["progress_percentage"] == 0
    assert entry["next_step"]
