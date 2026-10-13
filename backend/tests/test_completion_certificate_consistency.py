"""Completion vs certificate consistency regression tests.

The reported bug: surfaces said "the course has been completed" while the
certificate surfaces said the course was NOT completed (or the score was 0).

Root causes covered here:

1. Content counts (unscoped ModuleProgress) and certificate eligibility /
   overall score (enrollment-scoped ModuleProgress) read DIFFERENT rows when
   progress rows were attached to an older/duplicate enrollment — completion
   said yes, eligibility and score said no.
2. The certificate gallery locked cards with a blanket "Complete the course"
   message even when the course WAS complete and the real gap was the score
   or the final assessment.
3. Cached enrollment.progress / completed_at (dashboards) lagged behind
   live content, claiming completion the certificate surfaces denied.
"""

import uuid

import pytest

from src.models.course_models import Course, Module, Lesson, Enrollment
from src.models.quiz_progress_models import QuizAttempt
from src.models.student_models import (
    Certificate,
    LessonCompletion,
    ModuleProgress,
)
from src.models.user_models import User, Role, db
from src.services.certificate_service import CertificateService
from src.services.course_progress_service import CourseProgressService
from src.services.enrollment_progress_service import EnrollmentProgressService


@pytest.fixture()
def scenario(app):
    """Isolated course: 2 published modules, 1 lesson each, 1 enrolment."""
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

        instructor = User(
            username=f"cc_inst_{suffix}",
            email=f"cc_inst_{suffix}@example.test",
            role_id=instructor_role.id,
        )
        instructor.set_password("InstructorPassword123!")
        db.session.add(instructor)
        db.session.flush()

        student = User(
            username=f"cc_student_{suffix}",
            email=f"cc_student_{suffix}@example.test",
            role_id=student_role.id,
        )
        student.set_password("StudentPassword123!")
        db.session.add(student)
        db.session.flush()

        course = Course(
            title=f"Completion Consistency {suffix}",
            description="Course used by completion/certificate consistency tests.",
            instructor_id=instructor.id,
            is_published=True,
            enrollment_type="free",
        )
        db.session.add(course)
        db.session.flush()

        modules, lessons = [], []
        for order in (1, 2):
            module = Module(
                title=f"Module {order} {suffix}",
                description="module",
                course_id=course.id,
                order=order,
                is_published=True,
            )
            db.session.add(module)
            db.session.flush()
            modules.append(module)

            lesson = Lesson(
                title=f"Lesson {order} {suffix}",
                content_type="text",
                content_data="<p>content</p>",
                module_id=module.id,
                order=1,
                is_published=True,
            )
            db.session.add(lesson)
            db.session.flush()
            lessons.append(lesson)

        enrollment = Enrollment(
            student_id=student.id,
            course_id=course.id,
            status="active",
            progress=0.0,
        )
        db.session.add(enrollment)
        db.session.commit()

        yield {
            "student": student,
            "instructor": instructor,
            "course": course,
            "enrollment": enrollment,
            "modules": modules,
            "lessons": lessons,
        }

        db.session.rollback()
        for model in (QuizAttempt, LessonCompletion, ModuleProgress, Certificate,
                      Enrollment, Module, Lesson):
            try:
                model.query.delete(synchronize_session=False)
            except Exception:
                pass
        User.query.filter(User.id.in_([student.id, instructor.id])).delete(
            synchronize_session=False
        )
        Course.query.filter(Course.id == course.id).delete(synchronize_session=False)
        db.session.commit()


def _complete_lesson(student_id, lesson, reading=100.0, engagement=100.0):
    completion = LessonCompletion.query.filter_by(
        student_id=student_id, lesson_id=lesson.id
    ).first()
    if completion is None:
        completion = LessonCompletion(student_id=student_id, lesson_id=lesson.id)
        db.session.add(completion)
    completion.completed = True
    completion.completed_at = None
    completion.reading_progress = reading
    completion.engagement_score = engagement
    db.session.commit()
    return completion


def _mark_module(student_id, module, enrollment_id, status="completed"):
    progress = ModuleProgress.query.filter_by(
        student_id=student_id, module_id=module.id, enrollment_id=enrollment_id
    ).first()
    if progress is None:
        progress = ModuleProgress(
            student_id=student_id,
            module_id=module.id,
            enrollment_id=enrollment_id,
        )
        db.session.add(progress)
    progress.status = status
    db.session.commit()
    return progress


def _finish_course(student, modules, lessons, enrollment_id, reading=100.0):
    """Complete every lesson + mark every module completed on one enrolment."""
    for module, lesson in zip(modules, lessons):
        _complete_lesson(student.id, lesson, reading=reading, engagement=reading)
        _mark_module(student.id, module, enrollment_id)
    db.session.commit()


def test_progress_surfaces_agree_with_orphaned_legacy_module_rows(scenario):
    """Counts, eligibility and score must read the SAME canonical rows.

    Regression: legacy ModuleProgress rows attached to an enrolment that no
    longer exists (pre-unique-constraint data, deduped enrolments). The
    unscoped counts saw the completed rows and reported "complete", but
    certificate eligibility and calculate_course_score — which only looked
    at rows of the current enrolment — reported incomplete and a 0.0 score.
    """
    student = scenario["student"]
    course = scenario["course"]
    enrollment = scenario["enrollment"]

    # Lessons completed for real; module rows written against a phantom
    # enrolment id left behind by an enrolment dedup migration.
    ghost_enrollment_id = 987654
    for module, lesson in zip(scenario["modules"], scenario["lessons"]):
        _complete_lesson(student.id, lesson)
        db.session.add(ModuleProgress(
            student_id=student.id,
            module_id=module.id,
            enrollment_id=ghost_enrollment_id,
            status="completed",
        ))
    db.session.commit()

    canonical = Enrollment.get_canonical(student.id, course.id)
    assert canonical.id == enrollment.id

    counts = EnrollmentProgressService.get_progress_counts(
        student.id, course.id, canonical
    )
    state = CourseProgressService.evaluate(
        student.id, course.id, enrollment=canonical, course=course
    )
    score = float(canonical.calculate_course_score())

    # All three surfaces agree — content is complete and the score is real.
    assert counts["is_complete"] is True
    assert state["course_completed"] is True
    assert state["all_modules_completed"] is True
    assert "all_modules_completed" not in state["missing_requirements"]
    assert "all_lessons_completed" not in state["missing_requirements"]
    assert state["overall_score"] == pytest.approx(score)
    assert score == pytest.approx(100.0)


def test_gallery_states_the_real_reason_when_score_is_the_gap(scenario):
    """Content complete + low score = locked for SCORE, not "course incomplete".

    Regression: the gallery always said "Complete the course to unlock your
    certificate" even when the course was complete and only the score (or the
    final assessment) was missing.
    """
    student = scenario["student"]
    course = scenario["course"]
    enrollment = scenario["enrollment"]

    # Finish everything, but with zero reading/engagement so the module
    # scores (and the overall course score) stay far below the 70 threshold.
    _finish_course(
        student, scenario["modules"], scenario["lessons"], enrollment.id,
        reading=0.0,
    )

    certificate = Certificate(
        student_id=student.id,
        course_id=course.id,
        enrollment_id=enrollment.id,
        overall_score=0,
        grade="",
        is_active=True,
    )
    certificate.generate_certificate_number()
    db.session.add(certificate)
    db.session.commit()

    certificates = CertificateService.get_student_certificates(student.id)
    assert len(certificates) == 1
    entry = certificates[0]

    # The course IS complete — that claim and the lock must coexist honestly.
    assert entry["course_completed"] is True
    assert entry["completion_status"] == "completed"
    assert entry["is_locked"] is True
    assert entry["certificate_eligible"] is False
    assert "overall_score" in entry["missing_requirements"]
    assert entry["lock_summary"]
    assert "complete the course" not in entry["lock_summary"].lower()

    # An issued certificate (score > 0, e.g. admin force) is never locked.
    certificate.overall_score = 85.0
    db.session.commit()
    entry = CertificateService.get_student_certificates(student.id)[0]
    assert entry["is_locked"] is False


def test_gallery_unlocks_and_gate_allows_when_eligible(scenario):
    """A fully-earned course is unlocked, eligible, and downloadable."""
    from src.routes.certificate_routes import _certificate_download_gate

    student = scenario["student"]
    course = scenario["course"]
    enrollment = scenario["enrollment"]

    _finish_course(
        student, scenario["modules"], scenario["lessons"], enrollment.id,
        reading=100.0,
    )

    certificate = Certificate(
        student_id=student.id,
        course_id=course.id,
        enrollment_id=enrollment.id,
        overall_score=0,
        grade="",
        is_active=True,
    )
    certificate.generate_certificate_number()
    db.session.add(certificate)
    db.session.commit()

    entry = CertificateService.get_student_certificates(student.id)[0]
    assert entry["course_completed"] is True
    assert entry["certificate_eligible"] is True
    assert entry["is_locked"] is False
    assert entry["missing_requirements"] == []

    allowed, error = _certificate_download_gate(certificate)
    assert allowed is True
    assert error == ""
    # The gate refreshes the enrolment-time score of 0 so the printed
    # certificate and the gallery carry the real score.
    assert certificate.overall_score == pytest.approx(100.0)


def test_live_completion_ignores_a_stale_cached_completed_flag(scenario):
    """Dashboards must not claim completion the certificate surfaces deny."""
    student = scenario["student"]
    enrollment = scenario["enrollment"]

    # Stale cache: marked complete while only one module exists as content.
    from src.utils.time_utils import now_local
    enrollment.progress = 1.0
    enrollment.status = "completed"
    enrollment.completed_at = now_local()
    db.session.commit()

    module_one, module_two = scenario["modules"]
    _complete_lesson(student.id, scenario["lessons"][0])
    _mark_module(student.id, module_one, enrollment.id)

    live = EnrollmentProgressService.live_completion(enrollment)
    assert live["is_complete"] is False
    assert live["progress"] == pytest.approx(0.5)
