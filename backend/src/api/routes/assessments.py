"""Assessments and submissions for the authenticated learner.

Quiz answering, assignment/project submission and the submission history all
reuse the legacy student flows (attempt limits, enrollment gates, scoring).
"""

from __future__ import annotations

from flask import request

from ...models.course_models import (Assignment, AssignmentSubmission,
                                     Enrollment, Project, ProjectSubmission,
                                     Quiz, Submission)
from .. import api_bp
from ..auth import current_user, require
from ..dispatch import dispatch
from ..errors import forbidden
from ..responses import ok, paginated
from ..serialization import isoify, serialize_submission

SUBMISSION_KINDS = {"quiz", "assignment", "project"}


def _enrolled(user, course_id: int) -> Enrollment:
    enrollment = Enrollment.get_canonical(user.id, course_id)
    if enrollment is None:
        raise forbidden("You are not enrolled in this course.")
    return enrollment


def _quiz_summary(quiz: Quiz) -> dict:
    return isoify({
        "id": quiz.id,
        "type": "quiz",
        "title": quiz.title,
        "description": quiz.description,
        "course_id": quiz.course_id,
        "module_id": quiz.module_id,
        "lesson_id": quiz.lesson_id,
        "time_limit_minutes": quiz.time_limit,
        "max_attempts": quiz.max_attempts,
        "passing_score": quiz.passing_score,
        "due_date": quiz.due_date,
        "points_possible": quiz.points_possible,
    })


def _assignment_summary(assignment: Assignment) -> dict:
    return isoify({
        "id": assignment.id,
        "type": "assignment",
        "title": assignment.title,
        "description": assignment.description,
        "instructions": assignment.instructions,
        "course_id": assignment.course_id,
        "assignment_type": assignment.assignment_type,
        "due_date": assignment.due_date,
        "points_possible": assignment.points_possible,
        "passing_score": assignment.passing_score,
    })


def _project_summary(project: Project) -> dict:
    return isoify({
        "id": project.id,
        "type": "project",
        "title": project.title,
        "description": project.description,
        "objectives": project.objectives,
        "course_id": project.course_id,
        "due_date": project.due_date,
        "points_possible": project.points_possible,
        "passing_score": project.passing_score,
        "submission_format": project.submission_format,
        "collaboration_allowed": project.collaboration_allowed,
        "max_team_size": project.max_team_size,
    })


@api_bp.route("/me/courses/<int:course_id>/assessments", methods=["GET"])
@require(scopes=["assessments:read"], user=True)
def list_course_assessments(course_id: int):
    """Quizzes, assignments and projects for an enrolled course."""
    user = current_user()
    _enrolled(user, course_id)

    quizzes = [_quiz_summary(q) for q in Quiz.query.filter_by(
        course_id=course_id, is_published=True).order_by(Quiz.id).all()]
    assignments = [_assignment_summary(a) for a in Assignment.query.filter_by(
        course_id=course_id, is_published=True).order_by(Assignment.id).all()]
    projects = [_project_summary(p) for p in Project.query.filter_by(
        course_id=course_id, is_published=True).order_by(Project.id).all()]

    return ok({
        "course_id": course_id,
        "quizzes": quizzes,
        "assignments": assignments,
        "projects": projects,
        "total": len(quizzes) + len(assignments) + len(projects),
    })


@api_bp.route("/me/quizzes/<int:quiz_id>", methods=["GET"])
@require(scopes=["assessments:read"], user=True)
def get_quiz(quiz_id: int):
    """Quiz with its questions (student view, answers hidden)."""
    return dispatch("student_routes.get_quiz", view_args={"quiz_id": quiz_id})


@api_bp.route("/me/quizzes/<int:quiz_id>/submissions", methods=["POST"])
@require(scopes=["assessments:write"], user=True)
def submit_quiz(quiz_id: int):
    """Submit quiz answers. Body: ``{"answers": {"<question_id>": <answer>}}``."""
    return dispatch("student_routes.submit_quiz", view_args={"quiz_id": quiz_id})


@api_bp.route("/me/assignments/<int:assignment_id>/submissions", methods=["POST"])
@require(scopes=["submissions:write"], user=True)
def submit_assignment(assignment_id: int):
    """Submit an assignment. Body: ``content`` / ``file_url`` / ``external_url``."""
    return dispatch("student_routes.submit_assignment",
                    view_args={"assignment_id": assignment_id})


@api_bp.route("/me/projects/<int:project_id>/submissions", methods=["POST"])
@require(scopes=["submissions:write"], user=True)
def submit_project(project_id: int):
    """Submit a project. Body: ``text_content`` / ``file_url``."""
    return dispatch("student_routes.submit_project",
                    view_args={"project_id": project_id})


@api_bp.route("/me/submissions", methods=["GET"])
@require(scopes=["submissions:read"], user=True)
def list_my_submissions():
    """Unified history of the learner's quiz/assignment/project submissions."""
    user = current_user()
    kind = (request.args.get("type") or "").strip()
    if kind and kind not in SUBMISSION_KINDS:
        from ..errors import ApiError
        raise ApiError(
            "VALIDATION_ERROR", "Invalid type filter.", 400,
            details=[{"field": "type",
                      "issue": f"must be one of: {', '.join(sorted(SUBMISSION_KINDS))}"}],
        )

    graded = (request.args.get("graded") or "").strip().lower()

    rows = []
    if kind in ("", "quiz"):
        query = Submission.query.filter_by(student_id=user.id)
        if graded in ("true", "1"):
            query = query.filter(Submission.grade.isnot(None))
        elif graded in ("false", "0"):
            query = query.filter(Submission.grade.is_(None))
        for sub in query.order_by(Submission.id.desc()).limit(500).all():
            rows.append(("quiz", sub.id, sub.submitted_at, serialize_submission(sub)))
    if kind in ("", "assignment"):
        query = AssignmentSubmission.query.filter_by(student_id=user.id)
        if graded in ("true", "1"):
            query = query.filter(AssignmentSubmission.grade.isnot(None))
        elif graded in ("false", "0"):
            query = query.filter(AssignmentSubmission.grade.is_(None))
        for sub in query.order_by(AssignmentSubmission.id.desc()).limit(500).all():
            rows.append(("assignment", sub.id, sub.submitted_at, serialize_submission(sub)))
    if kind in ("", "project"):
        query = ProjectSubmission.query.filter_by(student_id=user.id)
        if graded in ("true", "1"):
            query = query.filter(ProjectSubmission.grade.isnot(None))
        elif graded in ("false", "0"):
            query = query.filter(ProjectSubmission.grade.is_(None))
        for sub in query.order_by(ProjectSubmission.id.desc()).limit(500).all():
            rows.append(("project", sub.id, sub.submitted_at, serialize_submission(sub)))

    rows.sort(key=lambda r: (r[2] or 0), reverse=True)

    try:
        page = max(1, int(request.args.get("page", "1")))
        per_page = min(100, max(1, int(request.args.get("per_page", "20"))))
    except (TypeError, ValueError):
        page, per_page = 1, 20

    total = len(rows)
    total_pages = max(1, -(-total // per_page)) if total else 0
    window = rows[(page - 1) * per_page: page * per_page]
    items = []
    for kind_name, _sid, _ts, payload in window:
        payload = dict(payload or {})
        payload["type"] = kind_name
        items.append(payload)

    return paginated(items, {
        "page": page, "per_page": per_page,
        "total_items": total, "total_pages": total_pages,
    })
