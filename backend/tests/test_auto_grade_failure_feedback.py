"""A failing auto-grade must still publish its grade and feedback.

Before this fix the student-facing payload replaced ``feedback`` with the
revision reason, the dashboards hid the grade whenever the status was
``needs_revision``, and a project teammate's row received the revision request
without the grade/feedback that caused it.
"""

import uuid

import pytest
from flask_jwt_extended import create_access_token

from src.utils.time_utils import now_local
from src.models.course_models import (
    Assignment, AssignmentSubmission, Course, Enrollment, Project, ProjectSubmission,
)
from src.models.user_models import Role, User, db
from src.routes.student_routes import _build_assignment_submission_status
from src.services.excel_grading.auto_grader import (
    _apply_grade_to_submission,
    _auto_request_modification_if_needed,
)


GRADE_DATA = {
    "overall_feedback": "Your analysis lacks evidence citations.",
    "total_score": 45.0,
    "max_score": 100.0,
    "grade_letter": "F",
    "strengths": ["Clear structure"],
    "weaknesses": ["No citations for the key claims"],
    "analysis_data": {
        "strengths": ["Clear structure"],
        "weaknesses": ["No citations for the key claims"],
    },
}


@pytest.fixture()
def env(app):
    with app.app_context():
        db.create_all()
        tag = uuid.uuid4().hex[:10]

        def role(name):
            row = Role.query.filter_by(name=name).first()
            if row is None:
                row = Role(name=name)
                db.session.add(row)
                db.session.flush()
            return row

        student_role = role("student")
        instructor = User(
            username=f"ag_i_{tag}", email=f"ag_i_{tag}@example.test",
            role_id=role("instructor").id,
        )
        student = User(
            username=f"ag_s_{tag}", email=f"ag_s_{tag}@example.test",
            role_id=student_role.id,
        )
        teammate = User(
            username=f"ag_t_{tag}", email=f"ag_t_{tag}@example.test",
            role_id=student_role.id,
        )
        for user in (instructor, student, teammate):
            user.set_password("Password123!")
        db.session.add_all([instructor, student, teammate])
        db.session.flush()

        course = Course(
            title=f"Auto grade {tag}", description="test",
            instructor_id=instructor.id,
        )
        db.session.add(course)
        db.session.flush()
        db.session.add(Enrollment(
            student_id=student.id, course_id=course.id, status="active"
        ))

        assignment = Assignment(
            title="Fail me", description="below passing", course_id=course.id,
            instructor_id=instructor.id, assignment_type="both",
            points_possible=100, passing_score=60, max_resubmissions=3,
            is_published=True,
        )
        project = Project(
            title="Team fail", description="below passing", course_id=course.id,
            module_ids="[]", due_date=now_local(), points_possible=100,
            passing_score=60, max_resubmissions=3, is_published=True,
        )
        db.session.add_all([assignment, project])
        db.session.flush()

        submission = AssignmentSubmission(
            assignment_id=assignment.id, student_id=student.id,
            content="my work", submitted_at=now_local(),
        )
        primary = ProjectSubmission(
            project_id=project.id, student_id=student.id,
            text_content="team work", submitted_at=now_local(),
        )
        other = ProjectSubmission(
            project_id=project.id, student_id=teammate.id,
            text_content="team work", submitted_at=now_local(),
        )
        primary.set_team_members([teammate.id])
        other.set_team_members([student.id])
        db.session.add_all([submission, primary, other])
        db.session.commit()

        ids = {
            "student_id": student.id,
            "teammate_id": teammate.id,
            "assignment_id": assignment.id,
            "submission_id": submission.id,
            "project_id": project.id,
            "primary_id": primary.id,
            "other_id": other.id,
        }
        db.session.commit()
        yield ids

    with app.app_context():
        AssignmentSubmission.query.filter_by(assignment_id=ids["assignment_id"]).delete()
        ProjectSubmission.query.filter_by(project_id=ids["project_id"]).delete()
        db.session.commit()


def _call_apply(app, env, *, total_score=45.0, **kwargs):
    return _apply_grade_to_submission(
        app, env["submission_id"], "assignment", env["student_id"],
        total_score, 100.0, dict(GRADE_DATA, total_score=total_score), **kwargs,
    )


def test_lower_regrade_keeps_grade_but_records_ai_feedback(app, env):
    with app.app_context():
        row = db.session.get(AssignmentSubmission, env["submission_id"])
        row.grade = 80.0
        db.session.commit()

        assert _call_apply(app, env, keep_feedback_on_lower=True) is True
        db.session.refresh(row)
        assert row.grade == 80.0
        assert GRADE_DATA["overall_feedback"] in row.feedback

        # Legacy callers still refuse to touch a retained higher grade.
        row.feedback = None
        db.session.commit()
        assert _call_apply(app, env) is False
        db.session.refresh(row)
        assert row.feedback is None


def test_failing_assignment_keeps_grade_feedback_and_separate_reason(app, env, client):
    with app.app_context():
        assert _call_apply(app, env) is True
        assert _auto_request_modification_if_needed(
            app, env["submission_id"], "assignment", env["student_id"],
            45.0, 100.0, GRADE_DATA,
        ) is True

        assignment = db.session.get(Assignment, env["assignment_id"])
        submission = db.session.get(AssignmentSubmission, env["submission_id"])
        assert assignment.modification_requested is True
        assert submission.grade == 45.0
        assert GRADE_DATA["overall_feedback"] in submission.feedback
        assert "below the passing threshold" in submission.feedback

        status = _build_assignment_submission_status(assignment, submission)
        assert status["status"] == "needs_revision"
        assert status["grade"] == 45.0
        assert status["feedback"] == submission.feedback
        assert "below the passing score" in status["modification_request_reason"]
        assert status["modification_request_reason"] != status["feedback"]

        payload = submission.to_dict()
        assert payload["grade"] == 45.0
        assert payload["modification_requested"] is True
        assert payload["modification_request_reason"] == assignment.modification_request_reason

    token = create_access_token(identity=str(env["student_id"]))
    response = client.get(
        f"/api/v1/student/assignments/{env['assignment_id']}/details",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.get_json()
    status = response.get_json()["submission_status"]
    assert status["status"] == "needs_revision"
    assert status["grade"] == 45.0
    assert GRADE_DATA["overall_feedback"] in status["feedback"]
    assert "below the passing score" in status["modification_request_reason"]


def test_failing_project_gives_every_teammate_the_grade_and_feedback(app, env):
    with app.app_context():
        applied = _apply_grade_to_submission(
            app, env["primary_id"], "project", env["student_id"],
            45.0, 100.0, GRADE_DATA,
        )
        assert applied is True
        assert _auto_request_modification_if_needed(
            app, env["primary_id"], "project", env["student_id"],
            45.0, 100.0, GRADE_DATA,
        ) is True

        primary = db.session.get(ProjectSubmission, env["primary_id"])
        teammate = db.session.get(ProjectSubmission, env["other_id"])
        for row in (primary, teammate):
            assert row.modification_requested is True
            assert row.grade == 45.0
            assert GRADE_DATA["overall_feedback"] in row.feedback
            assert "below the passing threshold" in row.feedback
            assert "below the passing score" in row.modification_request_reason
            assert row.feedback != row.modification_request_reason
