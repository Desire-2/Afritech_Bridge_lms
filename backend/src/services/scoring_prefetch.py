"""Request-scoped prefetch for lesson/module scoring queries.

The lesson and module scoring methods (LessonCompletion.calculate_lesson_score,
ModuleProgress.calculate_module_weighted_score, sync_scores_from_assessments)
each issue per-lesson queries for quizzes, assignments, attempts, and
submissions. When a whole course is scored (certificate eligibility,
transcript generation) that multiplies into hundreds of queries.

This module caches those exact lookups for the duration of one evaluation,
keyed by flask ``g`` (request scope) so concurrent requests never share
state. The scoring methods consult these accessors instead of querying
directly; with no active prefetch every accessor falls back to the original
query, so behaviour is unchanged outside bulk evaluation and the scoring
formulas stay single-sourced.
"""

from typing import Dict, List, Optional

_prefetch_active = False
_store: Dict = {}


def activate(student_id: int, course_ids: List[int]) -> None:
    """Load every assessment lookup needed to score a student's courses.

    Batched: ~7 queries total regardless of module/lesson count.
    """
    from ..models.course_models import (
        Assignment, AssignmentSubmission, Lesson, Module, Project, Quiz
    )
    from ..models.quiz_progress_models import QuizAttempt
    from ..models.student_models import LessonCompletion
    from ..models.user_models import db

    global _prefetch_active, _store
    _store = {
        'student_id': student_id,
        'quizzes_by_lesson': {},
        'assignments_by_lesson': {},
        'module_final_quizzes': {},
        'best_quiz_attempts': {},
        'assignment_submissions': {},
        'course_projects': {},
        'ungraded_assignment_ids': None,
        'lesson_completions': {},
        'project_best_pct': {},
    }

    course_ids = [cid for cid in course_ids if cid]
    if not course_ids:
        _prefetch_active = True
        return

    module_rows = (
        db.session.query(Module.id, Module.course_id)
        .filter(Module.course_id.in_(course_ids), Module.is_published == True)  # noqa: E712
        .all()
    )
    module_ids = [row[0] for row in module_rows]

    lesson_rows = []
    if module_ids:
        lesson_rows = (
            db.session.query(Lesson.id, Lesson.module_id)
            .filter(
                Lesson.module_id.in_(module_ids),
                Lesson.is_published == True,  # noqa: E712
            )
            .all()
        )
    lesson_ids = [row[0] for row in lesson_rows]

    if lesson_ids:
        for quiz in Quiz.query.filter(
            Quiz.lesson_id.in_(lesson_ids),
            Quiz.is_published == True,  # noqa: E712
        ).all():
            _store['quizzes_by_lesson'][quiz.lesson_id] = quiz

        for assignment in Assignment.query.filter(
            Assignment.lesson_id.in_(lesson_ids),
            Assignment.is_published == True,  # noqa: E712
        ).all():
            _store['assignments_by_lesson'][assignment.lesson_id] = assignment

    if module_ids:
        for quiz in Quiz.query.filter(
            Quiz.module_id.in_(module_ids),
            Quiz.lesson_id.is_(None),
            Quiz.is_published == True,  # noqa: E712
        ).all():
            _store['module_final_quizzes'][quiz.module_id] = quiz

    # Best quiz attempts per quiz (highest score first, matching
    # calculate_lesson_score's order_by(score_percentage.desc()).first()).
    _store['best_quiz_pct'] = {}      # violation-safe (sync semantics)
    _store['graded_assignment_pct'] = {}  # grade not None (sync semantics)
    if lesson_ids or module_ids:
        quiz_ids = set()
        for quiz in _store['quizzes_by_lesson'].values():
            quiz_ids.add(quiz.id)
        for quiz in _store['module_final_quizzes'].values():
            quiz_ids.add(quiz.id)
        if quiz_ids:
            attempts = (
                QuizAttempt.query
                .filter(
                    QuizAttempt.user_id == student_id,
                    QuizAttempt.quiz_id.in_(list(quiz_ids)),
                )
                .order_by(QuizAttempt.score_percentage.desc())
                .all()
            )
            for attempt in attempts:
                quiz_id = attempt.quiz_id
                if quiz_id not in _store['best_quiz_attempts']:
                    _store['best_quiz_attempts'][quiz_id] = attempt
                clean = (
                    attempt.security_violation is None
                    or attempt.security_violation is False
                )
                if clean and attempt.score_percentage is not None:
                    pct = min(100.0, float(attempt.score_percentage or 0.0))
                    if pct > _store['best_quiz_pct'].get(quiz_id, 0.0):
                        _store['best_quiz_pct'][quiz_id] = pct

    if lesson_ids:
        assignment_ids = [a.id for a in _store['assignments_by_lesson'].values()]
        if assignment_ids:
            submissions = (
                AssignmentSubmission.query
                .filter(
                    AssignmentSubmission.student_id == student_id,
                    AssignmentSubmission.assignment_id.in_(assignment_ids),
                )
                .all()
            )
            ungraded = set()
            for submission in submissions:
                # .first() semantics: keep the first row per assignment as the
                # default unordered query would return it.
                if submission.assignment_id not in _store['assignment_submissions']:
                    _store['assignment_submissions'][submission.assignment_id] = submission
                if submission.grade is None:
                    ungraded.add(submission.assignment_id)
                else:
                    assignment = next(
                        (a for a in _store['assignments_by_lesson'].values()
                         if a.id == submission.assignment_id),
                        None,
                    )
                    if assignment is not None:
                        points = assignment.points_possible or 100
                        if points > 0:
                            pct = min(100.0, (submission.grade / points) * 100)
                            if pct > _store['graded_assignment_pct'].get(
                                submission.assignment_id, 0.0
                            ):
                                _store['graded_assignment_pct'][
                                    submission.assignment_id
                                ] = pct
            _store['ungraded_assignment_ids'] = ungraded

    for course_id in course_ids:
        projects = Project.query.filter_by(
            course_id=course_id, is_published=True
        ).all()
        _store['course_projects'][course_id] = projects
        # Best graded percentage per project (sync_scores fast path)
        if projects:
            from ..models.course_models import ProjectSubmission
            submissions = (
                ProjectSubmission.query
                .filter(
                    ProjectSubmission.student_id == student_id,
                    ProjectSubmission.project_id.in_([p.id for p in projects]),
                    ProjectSubmission.grade.isnot(None),
                )
                .all()
            )
            bests = {}
            for sub in submissions:
                project = next((p for p in projects if p.id == sub.project_id), None)
                if project is None:
                    continue
                points = project.points_possible or 100
                if points > 0:
                    pct = min(100.0, (sub.grade / points) * 100)
                    bests[sub.project_id] = max(bests.get(sub.project_id, 0.0), pct)
            _store['project_best_pct'] = bests

    # Lesson completion rows for this student's lessons (module scoring)
    if lesson_ids:
        rows = (
            LessonCompletion.query
            .filter(
                LessonCompletion.student_id == student_id,
                LessonCompletion.lesson_id.in_(lesson_ids),
            )
            .all()
        )
        _store['lesson_completions'] = {row.lesson_id: row for row in rows}

    _prefetch_active = True


def deactivate() -> None:
    global _prefetch_active, _store
    _prefetch_active = False
    _store = {}


def is_active() -> bool:
    return _prefetch_active


def get_lesson_quiz(lesson_id):
    from ..models.course_models import Quiz
    if _prefetch_active:
        return _store['quizzes_by_lesson'].get(lesson_id)
    return Quiz.query.filter_by(lesson_id=lesson_id, is_published=True).first()


def get_lesson_assignment(lesson_id):
    from ..models.course_models import Assignment
    if _prefetch_active:
        return _store['assignments_by_lesson'].get(lesson_id)
    return Assignment.query.filter_by(lesson_id=lesson_id, is_published=True).first()


def get_module_final_quiz(module_id):
    from ..models.course_models import Quiz
    if _prefetch_active:
        return _store['module_final_quizzes'].get(module_id)
    return Quiz.query.filter(
        Quiz.module_id == module_id,
        Quiz.lesson_id.is_(None),
        Quiz.is_published == True,  # noqa: E712
    ).first()


def get_best_quiz_attempt(student_id: int, quiz_id: int):
    from ..models.quiz_progress_models import QuizAttempt
    if _prefetch_active and quiz_id in _store['best_quiz_attempts']:
        return _store['best_quiz_attempts'][quiz_id]
    return QuizAttempt.query.filter_by(
        user_id=student_id, quiz_id=quiz_id
    ).order_by(QuizAttempt.score_percentage.desc()).first()


def get_assignment_submission(student_id: int, assignment_id: int):
    from ..models.course_models import AssignmentSubmission
    if _prefetch_active and assignment_id in _store['assignment_submissions']:
        return _store['assignment_submissions'][assignment_id]
    return AssignmentSubmission.query.filter_by(
        student_id=student_id, assignment_id=assignment_id
    ).first()


def get_course_projects(course_id: int):
    from ..models.course_models import Project
    if _prefetch_active and course_id in _store['course_projects']:
        return _store['course_projects'][course_id]
    return Project.query.filter_by(course_id=course_id, is_published=True).all()


def has_published_quiz_for_lessons(lesson_ids) -> bool:
    from ..models.course_models import Quiz
    lesson_ids = list(lesson_ids)
    if not lesson_ids:
        return False
    if _prefetch_active:
        return any(lid in _store['quizzes_by_lesson'] for lid in lesson_ids)
    return Quiz.query.filter(
        Quiz.lesson_id.in_(lesson_ids),
        Quiz.is_published == True,  # noqa: E712
    ).first() is not None


def has_published_assignment_for_lessons(lesson_ids) -> bool:
    from ..models.course_models import Assignment
    lesson_ids = list(lesson_ids)
    if not lesson_ids:
        return False
    if _prefetch_active:
        return any(lid in _store['assignments_by_lesson'] for lid in lesson_ids)
    return Assignment.query.filter(
        Assignment.lesson_id.in_(lesson_ids),
        Assignment.is_published == True,  # noqa: E712
    ).first() is not None


def module_has_final_assessment(module_id) -> bool:
    return get_module_final_quiz(module_id) is not None


def get_best_quiz_pct(student_id: int, quiz_id: int) -> float:
    """Best non-violating score percentage for a quiz (sync semantics)."""
    if _prefetch_active:
        return _store.get('best_quiz_pct', {}).get(quiz_id, 0.0)
    from ..models.quiz_progress_models import QuizAttempt
    from sqlalchemy import or_
    best = 0.0
    rows = (
        QuizAttempt.query
        .filter(
            QuizAttempt.user_id == student_id,
            QuizAttempt.quiz_id == quiz_id,
            QuizAttempt.score_percentage.isnot(None),
            or_(QuizAttempt.security_violation == False,  # noqa: E712
                QuizAttempt.security_violation.is_(None)),
        )
        .all()
    )
    for row in rows:
        best = max(best, min(100.0, float(row.score_percentage or 0.0)))
    return best


def get_graded_assignment_pct(student_id: int, assignment_id: int) -> float:
    """Best graded percentage for one assignment (sync semantics)."""
    if _prefetch_active:
        return _store.get('graded_assignment_pct', {}).get(assignment_id, 0.0)
    from ..models.course_models import Assignment, AssignmentSubmission
    submission = (
        AssignmentSubmission.query
        .filter(
            AssignmentSubmission.student_id == student_id,
            AssignmentSubmission.assignment_id == assignment_id,
            AssignmentSubmission.grade.isnot(None),
        )
        .first()
    )
    if submission is None:
        return 0.0
    assignment = Assignment.query.get(assignment_id)
    points = (assignment.points_possible or 100) if assignment else 100
    if points <= 0:
        return 0.0
    return min(100.0, (submission.grade / points) * 100)


def get_ungraded_assignment_ids(student_id: int):
    """Set of assignment ids with a submitted-but-ungraded submission."""
    if _prefetch_active:
        return _store.get('ungraded_assignment_ids') or set()
    from ..models.course_models import AssignmentSubmission
    from ..models.user_models import db
    rows = (
        db.session.query(AssignmentSubmission.assignment_id)
        .filter(
            AssignmentSubmission.student_id == student_id,
            AssignmentSubmission.grade.is_(None),
        )
        .distinct()
        .all()
    )
    return {row[0] for row in rows}


def get_lesson_completion(student_id: int, lesson_id: int):
    from ..models.student_models import LessonCompletion
    if _prefetch_active and lesson_id in _store['lesson_completions']:
        return _store['lesson_completions'][lesson_id]
    return LessonCompletion.query.filter_by(
        student_id=student_id, lesson_id=lesson_id
    ).first()


def get_project_best_pct(project_id: int) -> float:
    """Best graded percentage for the student on one project (0 if none)."""
    if _prefetch_active:
        return _store.get('project_best_pct', {}).get(project_id, 0.0)
    from ..models.course_models import Project, ProjectSubmission
    project = Project.query.get(project_id)
    if project is None:
        return 0.0
    points = project.points_possible or 100
    if points <= 0:
        return 0.0
    best = 0.0
    subs = ProjectSubmission.query.filter(
        ProjectSubmission.project_id == project_id,
        ProjectSubmission.grade.isnot(None),
    ).all()
    for sub in subs:
        best = max(best, min(100.0, (sub.grade / points) * 100))
    return best


def project_gate_map(course_id: int) -> dict:
    """{project_id: gate_module_id} for every published project in the course.

    A project assigned to several modules only gates the LAST one of them (see
    ``Project.get_gate_module_id``), so the earlier modules it spans are never
    held back by it.
    """
    from ..models.course_models import Module

    projects = get_course_projects(course_id)
    if not projects:
        return {}
    modules = (
        Module.query.filter_by(course_id=course_id)
        .order_by(Module.order, Module.id)
        .all()
    )
    gates = {}
    for project in projects:
        gate = project.get_gate_module_id(modules)
        if gate is not None:
            gates[project.id] = gate
    return gates


def gating_project_ids(course_id: int, module_id: int) -> set:
    """Ids of the published projects that gate this module (their last one)."""
    if not module_id:
        return set()
    return {
        project_id
        for project_id, gate in project_gate_map(course_id).items()
        if gate == module_id
    }


def module_has_projects(course_id: int, module_id: int) -> bool:
    """True only when a project GATES this module — i.e. the module is the
    last module that project is assigned to.

    Earlier modules a project spans count as having no project, so a project
    assigned to modules 1-3 can only hold a student back in module 3.
    """
    return bool(gating_project_ids(course_id, module_id))
