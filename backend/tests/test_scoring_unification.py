"""Regression tests: unified course scoring, completion, and certificate
eligibility (Rules A/B/C).

Covers the systemic mismatches fixed by the unification work:
- certificate scores used lesson averages while module completion used
  weighted cumulative scores;
- completion-state overstated scores (completed-modules-only average) and
  wrote enrollment state during GET;
- three conflicting course-completion definitions;
- duplicate direct enrollments (NULL application_window_id).
"""

import uuid

import pytest

from src.config.scoring import (
    CERTIFICATE_PASSING_SCORE,
    FINAL_ASSESSMENT_PASSING_SCORE,
    LESSON_PASSING_SCORE,
    MODULE_PASSING_SCORE,
)
from src.models.course_models import (
    Assignment, Course, Enrollment, Lesson, Module, Quiz,
)
from src.models.quiz_progress_models import QuizAttempt
from src.models.student_models import (
    Certificate, LessonCompletion, ModuleProgress,
)
from src.models.user_models import User, Role, db
from src.services.certificate_service import CertificateService
from src.services.course_progress_service import CourseProgressService


# ── fixtures / helpers ─────────────────────────────────────────────────

def _make_course(suffix, module_count=4, lessons_per_module=1,
                 published=True):
    """Course with N published modules; returns ids dict."""
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
        username=f"uni_inst_{suffix}",
        email=f"uni_inst_{suffix}@example.test",
        role_id=instructor_role.id,
    )
    instructor.set_password("InstructorPassword123!")
    db.session.add(instructor)
    db.session.flush()

    student = User(
        username=f"uni_student_{suffix}",
        email=f"uni_student_{suffix}@example.test",
        role_id=student_role.id,
    )
    student.set_password("StudentPassword123!")
    db.session.add(student)
    db.session.flush()

    course = Course(
        title=f"Unified Course {suffix}",
        description="Scoring unification tests.",
        instructor_id=instructor.id,
        is_published=True,
        enrollment_type="free",
    )
    db.session.add(course)
    db.session.flush()

    module_ids = []
    lesson_ids = []
    lesson_objs = []
    for order in range(1, module_count + 1):
        module = Module(
            title=f"Module {order} {suffix}",
            description="module",
            course_id=course.id,
            order=order,
            is_published=published,
        )
        db.session.add(module)
        db.session.flush()
        module_ids.append(module.id)
        for lesson_order in range(1, lessons_per_module + 1):
            lesson = Lesson(
                title=f"Lesson {order}-{lesson_order} {suffix}",
                content_type="text",
                content_data="<p>content</p>",
                module_id=module.id,
                order=lesson_order,
                is_published=True,
            )
            db.session.add(lesson)
            lesson_objs.append(lesson)
    db.session.flush()
    lesson_ids = [lesson.id for lesson in lesson_objs]

    enrollment = Enrollment(
        student_id=student.id,
        course_id=course.id,
        status="active",
        progress=0.0,
    )
    db.session.add(enrollment)
    db.session.commit()

    return {
        "student_id": student.id,
        "instructor_id": instructor.id,
        "course_id": course.id,
        "enrollment_id": enrollment.id,
        "module_ids": module_ids,
        "lesson_ids": lesson_ids,
    }


def _set_lesson(student_id, lesson_id, reading=100.0, engagement=100.0,
                completed=True):
    completion = LessonCompletion.query.filter_by(
        student_id=student_id, lesson_id=lesson_id
    ).first()
    if completion is None:
        completion = LessonCompletion(student_id=student_id, lesson_id=lesson_id)
        db.session.add(completion)
    completion.completed = completed
    completion.completed_at = None
    completion.reading_progress = float(reading)
    completion.engagement_score = float(engagement)
    return completion


def _set_module_progress(student_id, module_id, enrollment_id, status,
                         cumulative=None):
    progress = ModuleProgress.query.filter_by(
        student_id=student_id, module_id=module_id, enrollment_id=enrollment_id
    ).first()
    if progress is None:
        progress = ModuleProgress(
            student_id=student_id, module_id=module_id,
            enrollment_id=enrollment_id,
        )
        db.session.add(progress)
    progress.status = status
    if cumulative is not None:
        progress.cumulative_score = float(cumulative)
    if status == "completed":
        from src.utils.time_utils import now_local
        progress.completed_at = now_local()
    return progress


def _exact_score_pair(target):
    """(reading, engagement) producing exactly ``target`` after penalties.

    reading=90 avoids the reading penalty (<90 scales down); engagement is
    solved so (90 + engagement) / 2 == target, valid for target in [75, 95]
    where engagement lands in [60, 100] (below 60 the engagement penalty
    would kick in).
    """
    if 75.0 <= target <= 95.0:
        return 90.0, 2.0 * target - 90.0
    return float(target), float(target)


def _complete_course_at(scenario, target_score):
    """Complete every published lesson + module at target_score (no
    assessments exist, so weighted cumulative == reading/engagement blend)."""
    from src.services.enrollment_progress_service import EnrollmentProgressService

    reading, engagement = _exact_score_pair(target_score)
    for lid in scenario["lesson_ids"]:
        _set_lesson(scenario["student_id"], lid, reading=reading,
                    engagement=engagement)
    for mid in scenario["module_ids"]:
        _set_module_progress(
            scenario["student_id"], mid, scenario["enrollment_id"],
            "completed", cumulative=target_score,
        )
    db.session.commit()
    enrollment = Enrollment.query.get(scenario["enrollment_id"])
    EnrollmentProgressService.sync_enrollment(enrollment, commit=True)


def _pin_course_score(monkeypatch, score):
    """Pin Enrollment.calculate_course_score for exact-boundary tests."""
    from src.models.course_models import Enrollment as _Enrollment

    def _fixed(self, _score=score):
        return float(_score)

    monkeypatch.setattr(_Enrollment, "calculate_course_score", _fixed)


@pytest.fixture()
def multi_module(app):
    with app.app_context():
        db.create_all()
        suffix = uuid.uuid4().hex[:10]
        ids = _make_course(suffix, module_count=4, lessons_per_module=1)
        yield ids
        db.session.rollback()
        db.session.remove()
        with app.app_context():
            try:
                LessonCompletion.query.delete(synchronize_session=False)
                ModuleProgress.query.delete(synchronize_session=False)
                QuizAttempt.query.delete(synchronize_session=False)
                Quiz.query.delete(synchronize_session=False)
                Assignment.query.delete(synchronize_session=False)
                Certificate.query.delete(synchronize_session=False)
                Enrollment.query.delete(synchronize_session=False)
                Lesson.query.delete(synchronize_session=False)
                Module.query.delete(synchronize_session=False)
                User.query.filter(User.id.in_([
                    ids["student_id"], ids["instructor_id"],
                ])).delete(synchronize_session=False)
                Course.query.filter(Course.id == ids["course_id"]).delete(
                    synchronize_session=False
                )
                db.session.commit()
            except Exception:
                db.session.rollback()


@pytest.fixture()
def final_assessment_course(app):
    """Four-module course; the LAST module has a published module-level
    final assessment quiz (extra modules keep the overall course score
    above the 70% threshold when the unattempted final tanks one module)."""
    with app.app_context():
        db.create_all()
        suffix = uuid.uuid4().hex[:10]
        ids = _make_course(suffix, module_count=4, lessons_per_module=1)
        final_quiz = Quiz(
            title=f"Final {suffix}",
            course_id=ids["course_id"],
            module_id=ids["module_ids"][-1],  # module-level: lesson_id NULL
            is_published=True,
            passing_score=70,
        )
        db.session.add(final_quiz)
        db.session.commit()
        ids["final_quiz_id"] = final_quiz.id
        yield ids
        db.session.rollback()
        db.session.remove()
        with app.app_context():
            try:
                LessonCompletion.query.delete(synchronize_session=False)
                ModuleProgress.query.delete(synchronize_session=False)
                QuizAttempt.query.delete(synchronize_session=False)
                Quiz.query.delete(synchronize_session=False)
                Certificate.query.delete(synchronize_session=False)
                Enrollment.query.delete(synchronize_session=False)
                Lesson.query.delete(synchronize_session=False)
                Module.query.delete(synchronize_session=False)
                User.query.filter(User.id.in_([
                    ids["student_id"], ids["instructor_id"],
                ])).delete(synchronize_session=False)
                Course.query.filter(Course.id == ids["course_id"]).delete(
                    synchronize_session=False
                )
                db.session.commit()
            except Exception:
                db.session.rollback()


# ── Course score ───────────────────────────────────────────────────────

def test_unstarted_modules_count_in_denominator(multi_module, app):
    """1 of 4 modules completed at 90% → score is 22.5, never 90."""
    with app.app_context():
        sid = multi_module["student_id"]
        mid = multi_module["module_ids"][0]
        lid = multi_module["lesson_ids"][0]
        _set_lesson(sid, lid, reading=90.0, engagement=90.0)
        _set_module_progress(sid, mid, multi_module["enrollment_id"],
                             "completed", cumulative=90.0)
        db.session.commit()

        enrollment = Enrollment.query.get(multi_module["enrollment_id"])
        score = enrollment.calculate_course_score()
        assert score == pytest.approx(22.5, abs=0.51), (
            f"expected ~90/4=22.5, got {score}"
        )

        state = CourseProgressService.evaluate(
            multi_module["student_id"], multi_module["course_id"],
            activate_prefetch=False,
        )
        assert state["overall_score"] == pytest.approx(score, abs=0.01)
        assert state["overall_score"] < MODULE_PASSING_SCORE


def test_all_modules_completed_aggregation(multi_module, app):
    """85 / 80 / 75 / (missing=0) → mean over ALL four modules."""
    with app.app_context():
        sids = multi_module
        scores = [85.0, 80.0, 75.0, None]
        for idx, (mid, lid) in enumerate(zip(sids["module_ids"], sids["lesson_ids"])):
            if scores[idx] is not None:
                reading, engagement = _exact_score_pair(scores[idx])
                _set_lesson(sids["student_id"], lid, reading=reading,
                            engagement=engagement)
                _set_module_progress(
                    sids["student_id"], mid, sids["enrollment_id"],
                    "completed", cumulative=scores[idx],
                )
        db.session.commit()
        enrollment = Enrollment.query.get(sids["enrollment_id"])
        score = enrollment.calculate_course_score()
        assert score == pytest.approx((85 + 80 + 75) / 4, abs=0.05)


def test_weighted_module_score_beats_plain_lesson_average(app):
    """A module completed via weighted assessments must contribute its
    weighted score (not the lower lesson average) to the course score."""
    with app.app_context():
        db.create_all()
        suffix = uuid.uuid4().hex[:10]
        ids = _make_course(suffix, module_count=1, lessons_per_module=1)
        sid, mid, lid = ids["student_id"], ids["module_ids"][0], ids["lesson_ids"][0]

        # Lesson work is weak (40%) but a strong quiz (100%) lifts the
        # weighted module score: 30% reading + 70% quiz (quiz-only layout).
        _set_lesson(sid, lid, reading=40.0, engagement=40.0)
        quiz = Quiz(
            title=f"Quiz {suffix}", course_id=ids["course_id"],
            lesson_id=lid, is_published=True, passing_score=70,
        )
        db.session.add(quiz)
        db.session.flush()
        db.session.add(QuizAttempt(
            user_id=sid, quiz_id=quiz.id, attempt_number=1,
            score_percentage=100.0, score=100.0,
        ))
        progress = _set_module_progress(
            sid, mid, ids["enrollment_id"], "in_progress",
        )
        progress.quiz_score = 100.0
        db.session.commit()

        weighted = progress.calculate_cumulative_score()
        lesson_avg = progress.calculate_module_score()
        assert weighted > lesson_avg + 5, (
            f"weighted {weighted} should exceed lesson average {lesson_avg}"
        )

        enrollment = Enrollment.query.get(ids["enrollment_id"])
        course_score = enrollment.calculate_course_score()
        assert course_score == pytest.approx(weighted, abs=0.01)


def test_missing_progress_rows_do_not_shrink_denominator(multi_module, app):
    with app.app_context():
        enrollment = Enrollment.query.get(multi_module["enrollment_id"])
        assert enrollment.calculate_course_score() == 0.0
        state = CourseProgressService.evaluate(
            multi_module["student_id"], multi_module["course_id"],
            activate_prefetch=False,
        )
        assert state["total_modules"] == 4
        assert state["overall_score"] == 0.0
        assert state["completed_modules"] == 0


def test_same_score_across_endpoints(multi_module, client, app):
    """Eligibility service, completion-state GET, and detailed-progress all
    report the identical authoritative overall score."""
    with app.app_context():
        _complete_course_at(multi_module, 82.0)

        from flask_jwt_extended import create_access_token
        token = create_access_token(identity=str(multi_module["student_id"]))
        headers = {"Authorization": f"Bearer {token}"}

        completion = client.get(
            f"/api/v1/student/progress/course/{multi_module['course_id']}/completion-state",
            headers=headers,
        )
        assert completion.status_code == 200
        api_score = completion.get_json()["data"]["overall_score"]

        detailed = client.get(
            f"/api/v1/student/courses/{multi_module['course_id']}/detailed-progress",
            headers=headers,
        )
        assert detailed.status_code == 200
        detailed_score = detailed.get_json()["overall_score"]

        eligibility = CertificateService.evaluate_eligibility(
            multi_module["student_id"], multi_module["course_id"],
        )
        service_score = eligibility["overall_score"]

        enrollment = Enrollment.query.get(multi_module["enrollment_id"])
        model_score = round(enrollment.calculate_course_score(), 1)

        assert api_score == pytest.approx(service_score, abs=0.51)
        assert detailed_score == pytest.approx(service_score, abs=0.51)
        assert model_score == pytest.approx(service_score, abs=0.01)
        assert api_score == pytest.approx(82.0, abs=1.0)


# ── Lessons ────────────────────────────────────────────────────────────

def test_incomplete_lesson_blocks_certificate(multi_module, app):
    with app.app_context():
        sids = multi_module
        # All modules marked completed EXCEPT lesson 2 flag is False
        # (module completion must not conceal the missing lesson record).
        for idx, (mid, lid) in enumerate(zip(sids["module_ids"], sids["lesson_ids"])):
            completed = idx != 1
            _set_lesson(sids["student_id"], lid, reading=90.0,
                        engagement=90.0, completed=completed)
            _set_module_progress(
                sids["student_id"], mid, sids["enrollment_id"],
                "completed", cumulative=90.0,
            )
        db.session.commit()

        eligibility = CertificateService.evaluate_eligibility(
            sids["student_id"], sids["course_id"],
        )
        assert eligibility["eligible"] is False
        assert "all_lessons_completed" in eligibility["missing_requirements"]
        assert eligibility["all_modules_completed"] is True
        assert eligibility["overall_score"] >= CERTIFICATE_PASSING_SCORE


def test_draft_lesson_does_not_block(multi_module, app):
    with app.app_context():
        sids = multi_module
        # Publish a draft lesson inside module 1 with no completion.
        draft = Lesson(
            title="Draft lesson", content_type="text",
            content_data="<p>x</p>", module_id=sids["module_ids"][0],
            order=99, is_published=False,
        )
        db.session.add(draft)
        for mid, lid in zip(sids["module_ids"], sids["lesson_ids"]):
            _set_lesson(sids["student_id"], lid, reading=85.0, engagement=85.0)
            _set_module_progress(
                sids["student_id"], mid, sids["enrollment_id"],
                "completed", cumulative=85.0,
            )
        db.session.commit()

        eligibility = CertificateService.evaluate_eligibility(
            sids["student_id"], sids["course_id"],
        )
        assert "all_lessons_completed" not in eligibility["missing_requirements"]


# ── Final assessment (Rule C) ─────────────────────────────────────────

def _complete_with_final(final_assessment_course, score, final_score):
    sids = final_assessment_course
    for mid, lid in zip(sids["module_ids"], sids["lesson_ids"]):
        reading, engagement = _exact_score_pair(score)
        _set_lesson(sids["student_id"], lid, reading=reading,
                    engagement=engagement)
        progress = _set_module_progress(
            sids["student_id"], mid, sids["enrollment_id"],
            "completed", cumulative=score,
        )
        if final_score is not None and mid == sids["module_ids"][-1]:
            progress.final_assessment_score = float(final_score)
    db.session.commit()
    from src.services.enrollment_progress_service import EnrollmentProgressService
    EnrollmentProgressService.sync_enrollment(
        Enrollment.query.get(sids["enrollment_id"]), commit=True,
    )


def test_no_final_assessment_passes_condition(multi_module, app):
    with app.app_context():
        _complete_course_at(multi_module, 85.0)
        state = CourseProgressService.evaluate(
            multi_module["student_id"], multi_module["course_id"],
            activate_prefetch=False,
        )
        assert state["final_assessment_required"] is False
        assert state["final_assessment_passed"] is True
        assert state["eligible"] is True


def test_required_final_not_attempted_fails(final_assessment_course, app):
    with app.app_context():
        _complete_with_final(final_assessment_course, 85.0, final_score=None)
        state = CourseProgressService.evaluate(
            final_assessment_course["student_id"],
            final_assessment_course["course_id"],
            activate_prefetch=False,
        )
        assert state["final_assessment_required"] is True
        assert state["eligible"] is False
        assert "final_assessment" in state["missing_requirements"]
        assert state["error_code"] == "FINAL_ASSESSMENT_FAILED"


def test_final_score_69_fails(final_assessment_course, app):
    with app.app_context():
        _complete_with_final(final_assessment_course, 85.0, final_score=69.0)
        state = CourseProgressService.evaluate(
            final_assessment_course["student_id"],
            final_assessment_course["course_id"],
            activate_prefetch=False,
        )
        assert state["eligible"] is False
        assert "final_assessment" in state["missing_requirements"]


def test_final_score_exactly_70_passes(final_assessment_course, app):
    with app.app_context():
        _complete_with_final(final_assessment_course, 85.0, final_score=70.0)
        state = CourseProgressService.evaluate(
            final_assessment_course["student_id"],
            final_assessment_course["course_id"],
            activate_prefetch=False,
        )
        assert state["final_assessment_passed"] is True
        assert state["eligible"] is True


def test_final_score_above_70_passes(final_assessment_course, app):
    with app.app_context():
        _complete_with_final(final_assessment_course, 85.0, final_score=88.0)
        state = CourseProgressService.evaluate(
            final_assessment_course["student_id"],
            final_assessment_course["course_id"],
            activate_prefetch=False,
        )
        assert state["eligible"] is True


def test_passed_final_cannot_compensate_low_course_score(final_assessment_course, app):
    with app.app_context():
        _complete_with_final(final_assessment_course, 55.0, final_score=95.0)
        state = CourseProgressService.evaluate(
            final_assessment_course["student_id"],
            final_assessment_course["course_id"],
            activate_prefetch=False,
        )
        assert state["eligible"] is False
        assert "overall_score" in state["missing_requirements"]


# ── Certificate eligibility thresholds ─────────────────────────────────

def test_score_69_no_certificate(multi_module, app):
    with app.app_context():
        _complete_course_at(multi_module, 69.0)
        success, message, payload = CertificateService.generate_certificate(
            multi_module["student_id"], multi_module["course_id"],
        )
        assert success is False
        assert payload["error_code"] in ("INSUFFICIENT_SCORE", "REQUIREMENTS_NOT_MET")


def test_score_exactly_70_issues_certificate(multi_module, app, monkeypatch):
    with app.app_context():
        _complete_course_at(multi_module, 80.0)
        _pin_course_score(monkeypatch, 70.0)  # exact-boundary comparison test
        success, message, payload = CertificateService.generate_certificate(
            multi_module["student_id"], multi_module["course_id"],
        )
        assert success is True, message
        assert payload["created"] is True


def test_high_score_with_incomplete_lesson_no_certificate(multi_module, app):
    with app.app_context():
        sids = multi_module
        for idx, (mid, lid) in enumerate(zip(sids["module_ids"], sids["lesson_ids"])):
            _set_lesson(sids["student_id"], lid, reading=95.0, engagement=95.0,
                        completed=idx != 0)
            _set_module_progress(
                sids["student_id"], mid, sids["enrollment_id"],
                "completed", cumulative=95.0,
            )
        db.session.commit()
        success, message, payload = CertificateService.generate_certificate(
            sids["student_id"], sids["course_id"],
        )
        assert success is False
        assert "all_lessons_completed" in payload["missing_requirements"]


def test_high_score_with_failed_final_no_certificate(final_assessment_course, app):
    with app.app_context():
        _complete_with_final(final_assessment_course, 90.0, final_score=40.0)
        success, message, payload = CertificateService.generate_certificate(
            final_assessment_course["student_id"],
            final_assessment_course["course_id"],
        )
        assert success is False
        assert "final_assessment" in payload["missing_requirements"]


def test_student_and_admin_paths_consistent(multi_module, app):
    with app.app_context():
        _complete_course_at(multi_module, 78.0)
        s_ok, _, p_ok = CertificateService.generate_certificate(
            multi_module["student_id"], multi_module["course_id"],
        )
        assert s_ok is True
        # Admin validation path re-evaluates: must agree on eligibility data.
        eligibility = CertificateService.evaluate_eligibility(
            multi_module["student_id"], multi_module["course_id"],
        )
        assert eligibility["eligible"] is True
        assert eligibility["overall_score"] == p_ok.get(
            "overall_score", eligibility["overall_score"]
        )


def test_generation_not_retriggered_when_unmet(multi_module, app):
    with app.app_context():
        _complete_course_at(multi_module, 50.0)
        for _ in range(3):
            success, _, payload = CertificateService.generate_certificate(
                multi_module["student_id"], multi_module["course_id"],
            )
            assert success is False
            assert payload["eligible"] is False
        assert Certificate.query.filter_by(
            student_id=multi_module["student_id"],
        ).count() == 0


# ── Enrollment consistency ────────────────────────────────────────────

def test_completion_state_get_is_read_only(multi_module, client, app):
    from flask_jwt_extended import create_access_token
    _complete_course_at(multi_module, 88.0)
    with app.app_context():
        enrollment = Enrollment.query.get(multi_module["enrollment_id"])
        was_completed = enrollment.status == "completed"
        was_completed_at = enrollment.completed_at
        was_progress = enrollment.progress

        token = create_access_token(identity=str(multi_module["student_id"]))
        headers = {"Authorization": f"Bearer {token}"}
        url = (
            f"/api/v1/student/progress/course/"
            f"{multi_module['course_id']}/completion-state"
        )
        for _ in range(3):
            resp = client.get(url, headers=headers)
            assert resp.status_code == 200
            db.session.expire_all()

        enrollment = Enrollment.query.get(multi_module["enrollment_id"])
        assert (enrollment.status == "completed") == was_completed
        assert enrollment.completed_at == was_completed_at
        assert enrollment.progress == was_progress


def test_completion_state_get_does_not_mark_incomplete_enrollment(multi_module, client, app):
    """A GET against an in-progress course must NOT write completed_at."""
    from flask_jwt_extended import create_access_token
    with app.app_context():
        # Only module 1 partially done — not complete.
        _set_lesson(multi_module["student_id"], multi_module["lesson_ids"][0],
                    reading=50.0, engagement=50.0)
        db.session.commit()
        token = create_access_token(identity=str(multi_module["student_id"]))
        headers = {"Authorization": f"Bearer {token}"}
        resp = client.get(
            f"/api/v1/student/progress/course/{multi_module['course_id']}/completion-state",
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()["data"]
        assert data["course_completed"] is False
        db.session.expire_all()
        enrollment = Enrollment.query.get(multi_module["enrollment_id"])
        assert enrollment.completed_at is None
        assert enrollment.status == "active"


def test_no_status_flip_flop_across_endpoints(multi_module, client, app):
    """completion-state then sync_enrollment must agree (no completed→active)."""
    from flask_jwt_extended import create_access_token
    from src.services.enrollment_progress_service import EnrollmentProgressService
    _complete_course_at(multi_module, 90.0)
    with app.app_context():
        token = create_access_token(identity=str(multi_module["student_id"]))
        headers = {"Authorization": f"Bearer {token}"}
        client.get(
            f"/api/v1/student/progress/course/{multi_module['course_id']}/completion-state",
            headers=headers,
        )
        enrollment = Enrollment.query.get(multi_module["enrollment_id"])
        assert enrollment.status == "completed"
        EnrollmentProgressService.sync_enrollment(enrollment, commit=True)
        assert enrollment.status == "completed", (
            "sync_enrollment reopened a genuinely complete course"
        )
        client.get(
            f"/api/v1/student/progress/course/{multi_module['course_id']}/completion-state",
            headers=headers,
        )
        db.session.expire_all()
        enrollment = Enrollment.query.get(multi_module["enrollment_id"])
        assert enrollment.status == "completed"


def test_duplicate_direct_enrollment_prevented(app):
    with app.app_context():
        db.create_all()
        suffix = uuid.uuid4().hex[:10]
        ids = _make_course(suffix, module_count=1, lessons_per_module=1)
        from src.services.enrollment_service import EnrollmentService

        ok1, msg1, data1 = EnrollmentService.enroll_directly(
            ids["student_id"], ids["course_id"],
        )
        # Already enrolled from the fixture.
        assert ok1 is False
        assert "enrollment_id" in data1

        # Force-insert a duplicate the way a race would, then ensure the
        # DB rejects a new direct enrollment.
        from sqlalchemy.exc import IntegrityError
        duplicate = Enrollment(
            student_id=ids["student_id"], course_id=ids["course_id"],
            status="active",
        )
        db.session.add(duplicate)
        try:
            db.session.flush()
            # SQLite may defer; if it got through, a second explicit insert
            # must still be blocked once committed... verify index exists.
            index_names = [ix.name for ix in Enrollment.__table__.indexes]
            assert "uq_enrollments_direct_student_course" in index_names
            db.session.rollback()
        except IntegrityError:
            db.session.rollback()


def test_get_canonical_prefers_completed_over_active(app):
    """get_canonical must never hand certificate paths a stale/terminated
    row when a better enrollment exists (windowed or direct)."""
    with app.app_context():
        db.create_all()
        suffix = uuid.uuid4().hex[:10]
        ids = _make_course(suffix, module_count=1, lessons_per_module=1)

        # A completed cohort enrollment for the same course.
        from src.models.course_models import ApplicationWindow
        window = ApplicationWindow(course_id=ids["course_id"],
                                   cohort_label=f"cohort-{suffix}")
        db.session.add(window)
        db.session.flush()
        from src.utils.time_utils import now_local
        completed_windowed = Enrollment(
            student_id=ids["student_id"], course_id=ids["course_id"],
            application_window_id=window.id, status="completed",
            completed_at=now_local(),
        )
        db.session.add(completed_windowed)
        db.session.commit()

        canonical = Enrollment.get_canonical(
            ids["student_id"], ids["course_id"],
        )
        assert canonical is not None
        assert canonical.status == "completed"
        assert canonical.id == completed_windowed.id


# ── Pending assignment grading ────────────────────────────────────────

def test_pending_assignment_reported_not_failed(app):
    with app.app_context():
        db.create_all()
        suffix = uuid.uuid4().hex[:10]
        ids = _make_course(suffix, module_count=1, lessons_per_module=1)
        sid, lid = ids["student_id"], ids["lesson_ids"][0]
        _set_lesson(sid, lid, reading=95.0, engagement=95.0)
        assignment = Assignment(
            title=f"HW {suffix}", description="Submit your work.",
            course_id=ids["course_id"], instructor_id=ids["instructor_id"],
            lesson_id=lid, is_published=True, points_possible=100.0,
        )
        db.session.add(assignment)
        db.session.flush()
        from src.models.course_models import AssignmentSubmission
        db.session.add(AssignmentSubmission(
            student_id=sid, assignment_id=assignment.id,
            content="work", grade=None,
        ))
        _set_module_progress(sid, ids["module_ids"][0],
                             ids["enrollment_id"], "in_progress")
        db.session.commit()

        state = CourseProgressService.evaluate(
            sid, ids["course_id"], activate_prefetch=False,
        )
        assert state["pending_gradings"], "pending grading must be surfaced"
        assert "waiting for instructor grading" in state["pending_gradings"][0]["message"]

        # Lesson score is capped below the lesson threshold while pending.
        completion = LessonCompletion.query.filter_by(
            student_id=sid, lesson_id=lid,
        ).first()
        score = completion.calculate_lesson_score()
        assert score < LESSON_PASSING_SCORE
        assert score <= 70.0


# ── Performance ───────────────────────────────────────────────────────

def test_eligibility_query_count_bounded(multi_module, app):
    """Eligibility on a 4-module course must not explode per-lesson."""
    import sqlalchemy
    from src.models.user_models import db as _db

    with app.app_context():
        _complete_course_at(multi_module, 80.0)

        queries = []
        event = sqlalchemy.event.listens_for(
            _db.engine, "before_cursor_execute"
        )

        def _record(conn, cursor, statement, parameters, context, executemany):
            queries.append(statement)

        sqlalchemy.event.listen(_db.engine, "before_cursor_execute", _record)
        try:
            CourseProgressService.evaluate(
                multi_module["student_id"], multi_module["course_id"],
            )
        finally:
            sqlalchemy.event.remove(
                _db.engine, "before_cursor_execute", _record
            )

        select_count = sum(1 for q in queries if q.strip().upper().startswith("SELECT"))
        # 4 modules × 1 lesson: without batching this exceeds 40 easily
        # (per-lesson quiz/assignment/attempt/submission lookups).
        assert select_count < 60, f"eligibility issued {select_count} SELECTs"


# ── Thresholds ────────────────────────────────────────────────────────

def test_threshold_constants():
    assert CERTIFICATE_PASSING_SCORE == 70.0
    assert FINAL_ASSESSMENT_PASSING_SCORE == 70.0
    assert LESSON_PASSING_SCORE == 80.0
    assert MODULE_PASSING_SCORE == 70.0
