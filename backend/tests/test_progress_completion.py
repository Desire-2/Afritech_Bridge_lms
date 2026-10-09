"""Regression tests for course progress / completion correctness.

Covers the two reported bugs:
  1. Students who finished only the currently RELEASED modules were reported
     as 100% complete (and issued certificates) while most of the course was
     still locked.
  2. Assessments published AFTER a student started (or finished) a lesson
     never updated the stored lesson/module scores.

Also covers the follow-on issues found while fixing them:
  - stale `enrollment.progress` / `completed_at` never being re-derived
  - draft (unpublished) modules inflating or blocking progress
  - certificate eligibility trusting a stale completion flag
  - `calculate_course_score()` averaging only scored modules
"""

import uuid

import pytest

from src.models.course_models import Course, Module, Lesson, Quiz, Enrollment
from src.models.quiz_progress_models import QuizAttempt, QuizAttemptStatus
from src.models.student_models import LessonCompletion, ModuleProgress
from src.models.user_models import User, Role, db
from src.services.enrollment_progress_service import EnrollmentProgressService
from src.services.lesson_completion_service import LessonCompletionService
from src.services.certificate_service import CertificateService


@pytest.fixture()
def scenario(app):
    """Isolated course: 2 published modules + 1 draft, 2 lessons each."""
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
            username=f"prog_inst_{suffix}",
            email=f"prog_inst_{suffix}@example.test",
            role_id=instructor_role.id,
        )
        instructor.set_password("InstructorPassword123!")
        db.session.add(instructor)
        db.session.flush()

        student = User(
            username=f"prog_student_{suffix}",
            email=f"prog_student_{suffix}@example.test",
            role_id=student_role.id,
        )
        student.set_password("StudentPassword123!")
        db.session.add(student)
        db.session.flush()

        course = Course(
            title=f"Progress Regression {suffix}",
            description="Course used by progress regression tests.",
            instructor_id=instructor.id,
            is_published=True,
            enrollment_type="free",
            # Drip-release only the first module: released != published.
            module_release_count=1,
        )
        db.session.add(course)
        db.session.flush()

        def make_module(order, is_published):
            module = Module(
                title=f"Module {order} {suffix}",
                description="module",
                course_id=course.id,
                order=order,
                is_published=is_published,
            )
            db.session.add(module)
            db.session.flush()
            return module

        def make_lesson(module, order):
            lesson = Lesson(
                title=f"Lesson {order} {suffix}",
                content_type="text",
                content_data="<p>content</p>",
                module_id=module.id,
                order=order,
                is_published=True,
            )
            db.session.add(lesson)
            db.session.flush()
            return lesson

        module_one = make_module(1, True)
        module_two = make_module(2, True)
        draft_module = make_module(3, False)

        lessons = {
            module_one.id: [make_lesson(module_one, 1), make_lesson(module_one, 2)],
            module_two.id: [make_lesson(module_two, 1), make_lesson(module_two, 2)],
            draft_module.id: [make_lesson(draft_module, 1)],
        }

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
            "module_one": module_one,
            "module_two": module_two,
            "draft_module": draft_module,
            "lessons": lessons,
        }

        db.session.rollback()
        for model in (QuizAttempt, Quiz, LessonCompletion, ModuleProgress, Enrollment, Module, Lesson):
            try:
                model.query.delete(synchronize_session=False)
            except Exception:
                pass
        User.query.filter(User.id.in_([student.id, instructor.id])).delete(synchronize_session=False)
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


def _mark_module_complete(student_id, module, enrollment):
    progress = ModuleProgress.query.filter_by(
        student_id=student_id, module_id=module.id, enrollment_id=enrollment.id
    ).first()
    if progress is None:
        progress = ModuleProgress(
            student_id=student_id,
            module_id=module.id,
            enrollment_id=enrollment.id,
        )
        db.session.add(progress)
    progress.status = "completed"
    db.session.commit()
    return progress


def test_progress_counts_use_published_modules_not_released(scenario):
    """Only 1 of 2 published modules is released - finishing it is NOT 100%."""
    student = scenario["student"]
    enrollment = scenario["enrollment"]

    released = scenario["course"].get_released_modules()
    assert [m.id for m in released] == [scenario["module_one"].id]

    for lesson in scenario["lessons"][scenario["module_one"].id]:
        _complete_lesson(student.id, lesson)
    _mark_module_complete(student.id, scenario["module_one"], enrollment)

    counts = EnrollmentProgressService.get_progress_counts(
        student.id, scenario["course"].id, enrollment
    )

    assert counts["total_modules"] == 2          # draft module excluded
    assert counts["completed_modules"] == 1
    assert counts["total_lessons"] == 4
    assert counts["completed_lessons"] == 2
    assert counts["progress"] == pytest.approx(0.5)
    assert counts["is_complete"] is False


def test_unpublished_module_never_blocks_completion(scenario):
    """A draft module must not keep a finished course from completing."""
    student = scenario["student"]
    enrollment = scenario["enrollment"]

    for module in (scenario["module_one"], scenario["module_two"]):
        for lesson in scenario["lessons"][module.id]:
            _complete_lesson(student.id, lesson)
        _mark_module_complete(student.id, module, enrollment)

    counts = EnrollmentProgressService.get_progress_counts(
        student.id, scenario["course"].id, enrollment
    )
    assert counts["progress"] == pytest.approx(1.0)
    assert counts["is_complete"] is True

    EnrollmentProgressService.sync_enrollment(enrollment, commit=True)
    assert enrollment.status == "completed"
    assert enrollment.progress == pytest.approx(1.0)
    assert enrollment.completed_at is not None


def test_sync_enrollment_reopens_stale_completion(scenario):
    """A stale 100% / completed flag is corrected when content is incomplete."""
    student = scenario["student"]
    enrollment = scenario["enrollment"]

    # Simulate the legacy bug: marked complete although most content is locked.
    enrollment.progress = 1.0
    enrollment.status = "completed"
    from src.utils.time_utils import now_local
    enrollment.completed_at = now_local()
    db.session.commit()

    for lesson in scenario["lessons"][scenario["module_one"].id]:
        _complete_lesson(student.id, lesson)
    _mark_module_complete(student.id, scenario["module_one"], enrollment)

    EnrollmentProgressService.sync_enrollment(enrollment, commit=True)

    assert enrollment.status == "active"
    assert enrollment.completed_at is None
    assert enrollment.progress == pytest.approx(0.5)


def test_publishing_quiz_after_start_refreshes_lesson_score(scenario):
    """A quiz published later must rescore students who already finished."""
    student = scenario["student"]
    lesson = scenario["lessons"][scenario["module_one"].id][0]

    completion = _complete_lesson(student.id, lesson, reading=100.0, engagement=100.0)
    # No assessments yet -> reading/engagement only.
    assert completion.calculate_lesson_score() == pytest.approx(100.0)

    quiz = Quiz(
        title="Late quiz",
        course_id=scenario["course"].id,
        module_id=scenario["module_one"].id,
        lesson_id=lesson.id,
        is_published=True,
        passing_score=70,
    )
    db.session.add(quiz)
    db.session.flush()

    attempt = QuizAttempt(
        user_id=student.id,
        quiz_id=quiz.id,
        attempt_number=1,
        score=40.0,
        score_percentage=40.0,
        status=QuizAttemptStatus.AUTO_GRADED,
    )
    db.session.add(attempt)
    db.session.commit()

    LessonCompletionService.recalculate_lesson_for_all_students(lesson.id)

    db.session.refresh(completion)
    breakdown = completion.get_score_breakdown()
    assert breakdown["has_quiz"] is True
    # Failed quiz caps the lesson at 65% instead of leaving a stale 100%.
    assert completion.lesson_score == pytest.approx(65.0, abs=0.5)
    assert completion.quiz_component_score == 0.0


def test_certificate_eligibility_ignores_stale_completion_flag(scenario):
    """A stale completed_at must not make a student certificate-eligible."""
    student = scenario["student"]
    enrollment = scenario["enrollment"]

    enrollment.progress = 1.0
    enrollment.status = "completed"
    from src.utils.time_utils import now_local
    enrollment.completed_at = now_local()
    db.session.commit()

    eligible, reason, requirements = CertificateService.check_certificate_eligibility(
        student.id, scenario["course"].id
    )
    assert eligible is False
    assert requirements.get("completed") is not True


def test_calculate_course_score_counts_unattempted_modules_as_zero(scenario):
    """One fully scored module out of two must not average to 100%."""
    student = scenario["student"]
    enrollment = scenario["enrollment"]

    # Module one fully done with perfect lesson scores; module two untouched.
    for lesson in scenario["lessons"][scenario["module_one"].id]:
        _complete_lesson(student.id, lesson, reading=100.0, engagement=100.0)
    _mark_module_complete(student.id, scenario["module_one"], enrollment)

    # Old behaviour: 100 (only scored modules averaged). New: 50 of 2 published.
    assert enrollment.calculate_course_score() == pytest.approx(50.0)
