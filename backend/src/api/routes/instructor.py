"""Instructor-facing read models and grading (instructor JWT required)."""

from __future__ import annotations

from flask import request

from ...models.course_models import (Assignment, AssignmentSubmission, Course,
                                     Enrollment, Project, ProjectSubmission)
from .. import api_bp
from ..auth import current_user, require
from ..dispatch import dispatch
from ..errors import forbidden, not_found
from ..pagination import paginate_query
from ..responses import paginated
from ..serialization import isoify, serialize_enrollment, serialize_submission

INSTRUCTOR_ROLES = ["instructor", "admin"]


def _own_course_or_403(user, course: Course) -> Course:
    if course is None:
        raise not_found("Course not found.")
    is_admin = user.role and user.role.name == "admin"
    if course.instructor_id != user.id and not is_admin:
        raise forbidden("You do not teach this course.")
    return course


@api_bp.route("/instructor/courses", methods=["GET"])
@require(scopes=["courses:read"], roles=INSTRUCTOR_ROLES, user=True)
def instructor_courses():
    """Courses the authenticated instructor teaches (admins see all published)."""
    user = current_user()
    query = Course.query.filter_by(instructor_id=user.id)
    if user.role and user.role.name == "admin":
        query = Course.query.filter_by(is_published=True)
    items, pagination = paginate_query(
        query.order_by(Course.id.desc()), args=request.args)
    return paginated(
        [isoify({"id": c.id, "title": c.title, "is_published": c.is_published,
                 "enrollment_type": c.enrollment_type,
                 "enrollment_count": Enrollment.query.filter_by(course_id=c.id).count()})
         for c in items],
        pagination,
    )


@api_bp.route("/instructor/courses/<int:course_id>/students", methods=["GET"])
@require(scopes=["enrollments:read"], roles=INSTRUCTOR_ROLES, user=True)
def instructor_course_students(course_id: int):
    """Students enrolled in a course the instructor teaches."""
    user = current_user()
    course = _own_course_or_403(user, db_get_course(course_id))
    query = Enrollment.query.filter_by(course_id=course.id)
    status = (request.args.get("status") or "").strip()
    if status:
        query = query.filter_by(status=status)
    items, pagination = paginate_query(
        query.order_by(Enrollment.id.desc()), args=request.args)
    return paginated([serialize_enrollment(e) for e in items], pagination,
                     meta={"course_id": course.id})


def db_get_course(course_id: int) -> Course:
    from ...models.user_models import db
    return db.session.get(Course, course_id)


@api_bp.route("/instructor/submissions", methods=["GET"])
@require(scopes=["grades:read"], roles=INSTRUCTOR_ROLES, user=True)
def instructor_submissions():
    """Assignment/project submissions across the instructor's courses."""
    user = current_user()
    if user.role and user.role.name == "admin":
        course_ids = [row[0] for row in
                      Course.query.with_entities(Course.id).all()]
    else:
        course_ids = [row[0] for row in
                      Course.query.with_entities(Course.id)
                      .filter_by(instructor_id=user.id).all()]
    if not course_ids:
        return paginated([], {"page": 1, "per_page": 20, "total_items": 0,
                              "total_pages": 0})

    kind = (request.args.get("type") or "assignment").strip()
    graded = (request.args.get("graded") or "").strip().lower()
    rows = []

    if kind in ("assignment", "all"):
        query = (AssignmentSubmission.query
                 .join(Assignment, AssignmentSubmission.assignment_id == Assignment.id)
                 .filter(Assignment.course_id.in_(course_ids)))
        if graded in ("true", "1"):
            query = query.filter(AssignmentSubmission.grade.isnot(None))
        elif graded in ("false", "0"):
            query = query.filter(AssignmentSubmission.grade.is_(None))
        for sub in query.order_by(AssignmentSubmission.id.desc()).limit(500).all():
            item = serialize_submission(sub)
            item["type"] = "assignment"
            rows.append((sub.submitted_at, item))

    if kind in ("project", "all"):
        query = (ProjectSubmission.query
                 .join(Project, ProjectSubmission.project_id == Project.id)
                 .filter(Project.course_id.in_(course_ids)))
        if graded in ("true", "1"):
            query = query.filter(ProjectSubmission.grade.isnot(None))
        elif graded in ("false", "0"):
            query = query.filter(ProjectSubmission.grade.is_(None))
        for sub in query.order_by(ProjectSubmission.id.desc()).limit(500).all():
            item = serialize_submission(sub)
            item["type"] = "project"
            rows.append((sub.submitted_at, item))

    rows.sort(key=lambda r: (r[0] or 0), reverse=True)
    try:
        page = max(1, int(request.args.get("page", "1")))
        per_page = min(100, max(1, int(request.args.get("per_page", "20"))))
    except (TypeError, ValueError):
        page, per_page = 1, 20
    total = len(rows)
    total_pages = max(1, -(-total // per_page)) if total else 0
    window = rows[(page - 1) * per_page: page * per_page]
    return paginated([item for _ts, item in window], {
        "page": page, "per_page": per_page,
        "total_items": total, "total_pages": total_pages,
    })


@api_bp.route("/instructor/submissions/assignment/<int:submission_id>/grade",
              methods=["POST"])
@require(scopes=["grades:write"], roles=["instructor"], user=True)
def grade_assignment(submission_id: int):
    """Grade an assignment submission (legacy grading pipeline).

    Body: ``{"grade": <float>, "feedback": "<text>"}``.
    """
    return dispatch("grading_routes.grade_assignment_submission",
                    view_args={"submission_id": submission_id})


@api_bp.route("/instructor/submissions/project/<int:submission_id>/grade",
              methods=["POST"])
@require(scopes=["grades:write"], roles=["instructor"], user=True)
def grade_project(submission_id: int):
    """Grade a project submission (legacy grading pipeline)."""
    return dispatch("grading_routes.grade_project_submission",
                    view_args={"submission_id": submission_id})
