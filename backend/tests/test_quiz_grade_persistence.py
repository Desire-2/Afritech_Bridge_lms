"""Regression tests for the 2026-10 progression audit fixes.

Covers the root-cause classes:
  C-1  module-level final quiz writes final_assessment_score (not quiz_score)
  H-1  has_passed_quiz reads quiz attempts by user_id
  H-3  draft (unpublished) lessons never influence scores or gates
  H-4  draft modules never gate unlock ordering
  H-7  retake invalidates ALL prior attempt records; old grades cannot resurrect
  M-2  can_proceed_to_next unpacks the (can_complete, reason, dict) contract
  M-9  completed modules are never downgraded to failed
  M-11 full-credit grants cover lesson-linked quizzes and use the 0-100 scale
  M-12 centralized unenrollment cleanup removes attempts and submissions
"""

import uuid

import pytest

from src.models.course_models import (
    Course, Module, Lesson, Quiz, Assignment, AssignmentSubmission,
    Enrollment, Project, ProjectSubmission,
)
from src.models.quiz_progress_models import QuizAttempt, QuizAttemptStatus
from src.models.student_models import LessonCompletion, ModuleProgress
from src.models.user_models import User, Role, db
from src.services.progression_service import ProgressionService
from src.services.enrollment_progress_service import EnrollmentProgressService
from src.utils.time_utils import now_local


@pytest.fixture()
def scenario(app):
    """Isolated course: 2 published modules + 1 draft, 2 published lessons each."""
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
            username=f"audit_inst_{suffix}",
            email=f"audit_inst_{suffix}@example.test",
            role_id=instructor_role.id,
        )
        instructor.set_password("InstructorPassword123!")
        db.session.add(instructor)
        db.session.flush()

        student = User(
            username=f"audit_student_{suffix}",
            email=f"audit_student_{suffix}@example.test",
            role_id=student_role.id,
        )
        student.set_password("StudentPassword123!")
        db.session.add(student)
        db.session.flush()

        course = Course(
            title=f"Audit Regression {suffix}",
            description="Course used by progression audit regression tests.",
            instructor_id=instructor.id,
            is_published=True,
            enrollment_type="free",
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

        def make_lesson(module, order, is_published=True):
            lesson = Lesson(
                title=f"Lesson {order} {suffix}",
                content_type="text",
                content_data="<p>content</p>",
                module_id=module.id,
                order=order,
                is_published=is_published,
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
        draft_lesson = make_lesson(module_one, 3, is_published=False)

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
            "draft_lesson": draft_lesson,
            "lessons": lessons,
        }

        db.session.rollback()
        for model in (
            QuizAttempt, AssignmentSubmission, ProjectSubmission, Quiz,
            Assignment, Project, LessonCompletion, ModuleProgress,
            Enrollment, Module, Lesson,
        ):
            try:
                model.query.delete(synchronize_session=False)
            except Exception:
                pass
        User.query.filter(User.id.in_([student.id, instructor.id])).delete(
            synchronize_session=False
        )
        Course.query.filter(Course.id == course.id).delete(synchronize_session=False)
        db.session.commit()


def _progress(student_id, module, enrollment):
    return ModuleProgress(
        student_id=student_id,
        module_id=module.id,
        enrollment_id=enrollment.id,
    )


def _make_quiz(module, lesson=None, passing=70, published=True):
    quiz = Quiz(
        title="quiz",
        course_id=module.course_id,
        module_id=module.id,
        lesson_id=lesson.id if lesson else None,
        is_published=published,
        passing_score=passing,
    )
    db.session.add(quiz)
    db.session.commit()
    return quiz


def _make_attempt(student, quiz, score, status=QuizAttemptStatus.AUTO_GRADED):
    attempt = QuizAttempt(
        user_id=student.id,
        quiz_id=quiz.id,
        attempt_number=1,
        score=score,
        score_percentage=score,
        status=status,
        start_time=now_local(),
        end_time=now_local(),
    )
    db.session.add(attempt)
    db.session.commit()
    return attempt


# ---------------------------------------------------------------------------
# C-1: module-level final assessment feeds final_assessment_score, not quiz_score
# ---------------------------------------------------------------------------
def test_final_quiz_attempt_feeds_final_assessment_bucket(scenario):
    student = scenario["student"]
    module = scenario["module_one"]

    final_quiz = _make_quiz(module, lesson=None)  # module_id set, lesson_id NULL
    _make_attempt(student, final_quiz, 85.0)

    progress = _progress(student.id, module, scenario["enrollment"])
    db.session.add(progress)
    db.session.flush()
    progress.sync_scores_from_assessments()
    db.session.commit()

    assert progress.final_assessment_score == pytest.approx(85.0)
    assert (progress.quiz_score or 0.0) == 0.0


def test_lesson_quiz_attempt_feeds_quiz_bucket(scenario):
    student = scenario["student"]
    module = scenario["module_one"]
    lesson = scenario["lessons"][module.id][0]

    lesson_quiz = _make_quiz(module, lesson=lesson)
    _make_attempt(student, lesson_quiz, 90.0)

    progress = _progress(student.id, module, scenario["enrollment"])
    db.session.add(progress)
    db.session.flush()
    progress.sync_scores_from_assessments()
    db.session.commit()

    assert progress.quiz_score == pytest.approx(90.0)
    assert (progress.final_assessment_score or 0.0) == 0.0


# ---------------------------------------------------------------------------
# H-1: quiz pass check reads by user_id (QuizAttempt has no student_id)
# ---------------------------------------------------------------------------
def test_has_passed_quiz_uses_user_id(scenario):
    student = scenario["student"]
    module = scenario["module_one"]
    lesson = scenario["lessons"][module.id][0]

    quiz = _make_quiz(module, lesson=lesson, passing=70)
    _make_attempt(student, quiz, 80.0)

    passed, score = ProgressionService.has_passed_quiz(student.id, quiz.id)
    assert passed is True
    assert score == pytest.approx(80.0)

    other = User(
        username=f"audit_other_{uuid.uuid4().hex[:8]}",
        email=f"audit_other_{uuid.uuid4().hex[:8]}@example.test",
        role_id=student.role_id,
    )
    other.set_password("OtherPassword123!")
    db.session.add(other)
    db.session.commit()
    other_passed, _ = ProgressionService.has_passed_quiz(other.id, quiz.id)
    assert other_passed is False


# ---------------------------------------------------------------------------
# H-3: draft lessons never influence module scores
# ---------------------------------------------------------------------------
def test_draft_lessons_excluded_from_module_score(scenario):
    student = scenario["student"]
    module = scenario["module_one"]
    published_lessons = scenario["lessons"][module.id]

    for lesson in published_lessons:
        completion = LessonCompletion(
            student_id=student.id, lesson_id=lesson.id, completed=True,
            reading_progress=100.0, engagement_score=100.0,
        )
        db.session.add(completion)
    # Perfect completion of the DRAFT lesson
    db.session.add(LessonCompletion(
        student_id=student.id, lesson_id=scenario["draft_lesson"].id,
        completed=True, reading_progress=0.0, engagement_score=0.0,
    ))
    db.session.commit()

    progress = _progress(student.id, module, scenario["enrollment"])
    db.session.add(progress)
    db.session.flush()

    # Draft lesson must be ignored; published lessons give a full score
    assert progress.calculate_module_score() == pytest.approx(100.0)


# ---------------------------------------------------------------------------
# H-4: draft modules never gate unlock ordering
# ---------------------------------------------------------------------------
def test_unlock_next_skips_draft_modules(scenario):
    student = scenario["student"]
    module_one = scenario["module_one"]
    module_two = scenario["module_two"]
    draft_module = scenario["draft_module"]
    enrollment = scenario["enrollment"]

    # Complete module one
    progress_one = ProgressionService._initialize_module_progress(
        student.id, module_one.id, enrollment.id
    )
    db.session.flush()
    progress_one.status = "completed"
    db.session.commit()

    ProgressionService._unlock_next_module(
        student_id=student.id,
        completed_module_id=module_one.id,
        enrollment_id=enrollment.id,
    )
    db.session.commit()

    progress_two = ModuleProgress.query.filter_by(
        student_id=student.id, module_id=module_two.id, enrollment_id=enrollment.id
    ).first()
    assert progress_two is not None
    assert progress_two.status == "unlocked"

    # The draft module (order 3) must NOT be the unlock target
    draft_progress = ModuleProgress.query.filter_by(
        student_id=student.id, module_id=draft_module.id, enrollment_id=enrollment.id
    ).first()
    assert draft_progress is None


# ---------------------------------------------------------------------------
# H-7: retake invalidates prior attempts; grades cannot resurrect
# ---------------------------------------------------------------------------
def test_retake_invalidates_all_module_attempts(scenario):
    student = scenario["student"]
    module = scenario["module_one"]
    lesson = scenario["lessons"][module.id][0]
    enrollment = scenario["enrollment"]

    lesson_quiz = _make_quiz(module, lesson=lesson)
    final_quiz = _make_quiz(module, lesson=None)
    lesson_attempt = _make_attempt(student, lesson_quiz, 50.0)
    final_attempt = _make_attempt(student, final_quiz, 40.0)
    # Capture ids while still bound — the retake deletes + commits,
    # detaching the ORM instances
    lesson_attempt_id = lesson_attempt.id
    final_attempt_id = final_attempt.id

    assignment = Assignment(
        title="hw",
        description="assignment",
        course_id=module.course_id,
        module_id=module.id,
        instructor_id=scenario["instructor"].id,
        is_published=True,
    )
    db.session.add(assignment)
    db.session.flush()
    submission = AssignmentSubmission(
        student_id=student.id,
        assignment_id=assignment.id,
        content="work",
        submitted_at=now_local(),
        grade=45.0,
        graded_at=now_local(),
        graded_by=scenario["instructor"].id,
    )
    db.session.add(submission)

    progress = ProgressionService._initialize_module_progress(
        student.id, module.id, enrollment.id
    )
    db.session.flush()
    progress.status = "failed"
    progress.attempts_count = 1
    progress.quiz_score = 50.0
    progress.final_assessment_score = 40.0
    progress.assignment_score = 45.0
    progress.cumulative_score = 45.0
    progress.completed_at = now_local()
    db.session.commit()

    ok, message = ProgressionService.attempt_module_retake(
        student.id, module.id, enrollment.id
    )
    assert ok is True, message
    db.session.commit()

    # All prior attempts and submissions for this module are gone
    assert QuizAttempt.query.filter_by(id=lesson_attempt_id).first() is None
    assert QuizAttempt.query.filter_by(id=final_attempt_id).first() is None
    assert AssignmentSubmission.query.filter_by(
        student_id=student.id, assignment_id=assignment.id
    ).first() is None

    db.session.refresh(progress)
    assert progress.status == "unlocked"
    assert progress.attempts_count == 2
    assert progress.completed_at is None
    assert (progress.quiz_score or 0.0) == 0.0
    assert (progress.final_assessment_score or 0.0) == 0.0
    assert (progress.assignment_score or 0.0) == 0.0

    # A re-sync after retake must NOT resurrect the pre-retake grades
    progress.sync_scores_from_assessments()
    assert (progress.quiz_score or 0.0) == 0.0
    assert (progress.final_assessment_score or 0.0) == 0.0
    assert (progress.assignment_score or 0.0) == 0.0


# ---------------------------------------------------------------------------
# M-2: can_proceed_to_next handles the real (can_complete, reason, dict) tuple
# ---------------------------------------------------------------------------
def test_can_proceed_to_next_does_not_crash_on_tuple_contract(scenario):
    student = scenario["student"]
    module = scenario["module_one"]
    enrollment = scenario["enrollment"]

    for lesson in scenario["lessons"][module.id]:
        db.session.add(LessonCompletion(
            student_id=student.id, lesson_id=lesson.id, completed=True,
            reading_progress=100.0, engagement_score=100.0,
            reading_component_score=100.0,
            engagement_component_score=100.0,
        ))
    db.session.commit()

    progress = ProgressionService._initialize_module_progress(
        student.id, module.id, enrollment.id
    )
    db.session.flush()
    progress.status = "completed"
    progress.cumulative_score = 95.0
    db.session.commit()

    result = progress.can_proceed_to_next()
    assert result is True


# ---------------------------------------------------------------------------
# M-9: a completed module is never downgraded to failed
# ---------------------------------------------------------------------------
def test_completed_module_not_downgraded_to_failed(scenario):
    student = scenario["student"]
    module = scenario["module_one"]
    enrollment = scenario["enrollment"]

    for lesson in scenario["lessons"][module.id]:
        db.session.add(LessonCompletion(
            student_id=student.id, lesson_id=lesson.id, completed=True,
            reading_progress=100.0, engagement_score=100.0,
            reading_component_score=100.0,
            engagement_component_score=100.0,
        ))

    # Published quiz with no attempt → quiz bucket scores 0, pulling the
    # weighted cumulative below 70 (reading 30 / quiz 70 weighting)
    _make_quiz(module, lesson=scenario["lessons"][module.id][0])
    db.session.commit()

    progress = ProgressionService._initialize_module_progress(
        student.id, module.id, enrollment.id
    )
    db.session.flush()
    progress.status = "completed"
    db.session.commit()

    passed, reason = ProgressionService.check_module_completion(
        student_id=student.id,
        module_id=module.id,
        enrollment_id=enrollment.id,
    )
    # Module cannot pass at a sub-70 score, but M-9 forbids downgrading
    # a completed module back to failed
    assert passed is False
    db.session.refresh(progress)
    assert progress.status == "completed"


# ---------------------------------------------------------------------------
# M-11: full credit covers lesson-linked quizzes; 0-100 scale preserved
# ---------------------------------------------------------------------------
def test_full_credit_covers_lesson_linked_quizzes(scenario):
    from src.services.full_credit_service import FullCreditService

    student = scenario["student"]
    module = scenario["module_one"]
    lesson = scenario["lessons"][module.id][0]
    enrollment = scenario["enrollment"]

    # Module-level final AND lesson-linked quiz
    _make_quiz(module, lesson=None)
    _make_quiz(module, lesson=lesson)

    assignment = Assignment(
        title="hw",
        description="assignment",
        course_id=module.course_id,
        instructor_id=scenario["instructor"].id,
        is_published=True,
    )
    db.session.add(assignment)
    db.session.flush()

    result = FullCreditService.give_module_full_credit(
        student_id=student.id,
        module_id=module.id,
        instructor_id=scenario["instructor"].id,
        enrollment_id=enrollment.id,
    )
    assert result["success"] is True, result
    assert result["details"]["quizzes_updated"] == 2  # final + lesson-linked

    progress = ModuleProgress.query.filter_by(
        student_id=student.id, module_id=module.id, enrollment_id=enrollment.id
    ).first()
    assert progress is not None
    # Scale check: course_contribution_score is on 0-100, not 0-10
    assert progress.course_contribution_score == pytest.approx(100.0)
    assert progress.status == "completed"


# ---------------------------------------------------------------------------
# M-12: centralized unenrollment cleanup removes attempts and submissions
# ---------------------------------------------------------------------------
def test_enrollment_cleanup_removes_attempts_and_submissions(scenario):
    student = scenario["student"]
    module = scenario["module_one"]
    lesson = scenario["lessons"][module.id][0]
    enrollment = scenario["enrollment"]

    quiz = _make_quiz(module, lesson=lesson)
    attempt = _make_attempt(student, quiz, 88.0)

    assignment = Assignment(
        title="hw",
        description="assignment",
        course_id=module.course_id,
        module_id=module.id,
        instructor_id=scenario["instructor"].id,
        is_published=True,
    )
    db.session.add(assignment)
    db.session.flush()
    submission = AssignmentSubmission(
        student_id=student.id,
        assignment_id=assignment.id,
        content="work",
        submitted_at=now_local(),
        grade=90.0,
    )
    db.session.add(submission)

    db.session.add(LessonCompletion(
        student_id=student.id, lesson_id=lesson.id, completed=True,
    ))
    progress = ProgressionService._initialize_module_progress(
        student.id, module.id, enrollment.id
    )
    db.session.commit()

    attempt_id = attempt.id
    submission_id = submission.id
    progress_id = progress.id

    deleted = EnrollmentProgressService.cleanup_enrollment_progress(
        student_id=student.id,
        course_id=enrollment.course_id,
        enrollment_id=enrollment.id,
    )
    db.session.commit()

    assert deleted["module_progress"] >= 1
    assert deleted["lesson_completions"] >= 1
    assert deleted["quiz_attempts"] == 1
    assert deleted["assignment_submissions"] == 1

    assert QuizAttempt.query.filter_by(id=attempt_id).first() is None
    assert AssignmentSubmission.query.filter_by(id=submission_id).first() is None
    assert ModuleProgress.query.filter_by(id=progress_id).first() is None
    assert LessonCompletion.query.filter_by(
        student_id=student.id, lesson_id=lesson.id
    ).first() is None
