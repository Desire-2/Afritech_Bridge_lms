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
from src.models.aage_models import CriterionScore, EvaluationResult
from src.models.course_models import (
    Assignment, AssignmentSubmission, Course, Enrollment, Lesson, Module,
    Project, ProjectSubmission,
)
from src.models.student_models import LessonCompletion
from src.models.user_models import Role, User, db
from src.routes.student_routes import _build_assignment_submission_status
from src.services.aage import persistence as aage_persistence
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

RUBRIC_GRADE_DATA = dict(
    GRADE_DATA,
    criteria=[
        {
            "name": "Evidence and citations",
            "awarded": 2.0,
            "maximum": 10.0,
            "feedback": "Key claims have no supporting sources.",
        },
        {
            "name": "Analysis depth",
            "awarded": 8.0,
            "maximum": 10.0,
            "feedback": "Good structure, but conclusions are not justified.",
        },
    ],
)


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

        module = Module(title=f"Module {tag}", course_id=course.id, order=1)
        db.session.add(module)
        db.session.flush()
        lesson = Lesson(
            title=f"Lesson {tag}", content_type="text", content_data="body",
            module_id=module.id, order=1,
        )
        db.session.add(lesson)
        db.session.flush()
        db.session.add(LessonCompletion(student_id=student.id, lesson_id=lesson.id))

        assignment = Assignment(
            title="Fail me", description="below passing", course_id=course.id,
            instructor_id=instructor.id, assignment_type="both",
            module_id=module.id, lesson_id=lesson.id,
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
            "instructor_id": instructor.id,
            "student_id": student.id,
            "teammate_id": teammate.id,
            "course_id": course.id,
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


def _call_apply(app, env, *, total_score=45.0, grade_data=None, **kwargs):
    payload = dict(grade_data or GRADE_DATA, total_score=total_score)
    return _apply_grade_to_submission(
        app, env["submission_id"], "assignment", env["student_id"],
        total_score, 100.0, payload, **kwargs,
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


def test_rubric_criteria_drive_failing_feedback_and_reason(app, env):
    with app.app_context():
        assert _call_apply(app, env, total_score=45.0, grade_data=RUBRIC_GRADE_DATA) is True
        assert _auto_request_modification_if_needed(
            app, env["submission_id"], "assignment", env["student_id"],
            45.0, 100.0, RUBRIC_GRADE_DATA,
        ) is True

        assignment = db.session.get(Assignment, env["assignment_id"])
        submission = db.session.get(AssignmentSubmission, env["submission_id"])
        reason = assignment.modification_request_reason

        assert "Evidence and citations" in reason
        assert "2/10" in reason
        assert "Key claims have no supporting sources." in reason
        assert "Submission does not meet the requirements" not in reason
        assert "Rubric breakdown" in submission.feedback
        assert "Evidence and citations" in submission.feedback


def test_aage_write_through_publishes_criterion_feedback(app, env):
    with app.app_context():
        result = EvaluationResult(
            submission_type="assignment",
            submission_id=env["submission_id"],
            assessment_kind="assignment",
            assessment_id=env["assignment_id"],
            course_id=env["course_id"],
            student_id=env["student_id"],
            total_awarded=4.0,
            total_possible=20.0,
            final_score=45.0,
            grade_letter="F",
            confidence=1.0,
            requires_review=False,
            status="draft",
            feedback="Your analysis lacks evidence citations.",
            strengths=["Clear structure"],
            improvements=["No citations for the key claims"],
        )
        db.session.add(result)
        db.session.flush()
        db.session.add_all([
            CriterionScore(
                result_id=result.id,
                criterion_key="evidence_citations",
                name="Evidence and citations",
                awarded=2.0,
                maximum=10.0,
                weight=0.5,
                weighted_score=0.1,
                feedback="Key claims have no supporting sources.",
                order_index=0,
            ),
            CriterionScore(
                result_id=result.id,
                criterion_key="analysis_depth",
                name="Analysis depth",
                awarded=8.0,
                maximum=10.0,
                weight=0.5,
                weighted_score=0.4,
                feedback="Conclusions are not justified by the evidence.",
                order_index=1,
            ),
        ])
        db.session.commit()

        assert aage_persistence.write_through_grade(
            result,
            actor_id=env["instructor_id"],
            publication_mode="manual",
        ) is True

        submission = db.session.get(AssignmentSubmission, env["submission_id"])
        assignment = db.session.get(Assignment, env["assignment_id"])
        assert submission.grade == 45.0
        assert "Evidence and citations: 2/10" in submission.feedback
        assert "Key claims have no supporting sources." in submission.feedback
        assert "Evidence and citations" in assignment.modification_request_reason
        assert "2/10" in assignment.modification_request_reason

        # Keep the shared test database clean for the rest of the suite.
        db.session.delete(result)
        db.session.commit()


def test_manual_revision_preserves_feedback_and_replaces_generic_reason(app, env, client):
    original_feedback = "Evidence and citations: 2/10 — add sources for each claim."
    with app.app_context():
        row = db.session.get(AssignmentSubmission, env["submission_id"])
        row.grade = 45.0
        row.feedback = original_feedback
        db.session.commit()

    token = create_access_token(identity=str(env["instructor_id"]))
    response = client.post(
        f"/api/v1/modification/assignments/{env['assignment_id']}/request-modification",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "student_id": env["student_id"],
            "reason": "Submission does not meet the requirements",
        },
    )
    assert response.status_code == 200, response.get_json()

    with app.app_context():
        assignment = db.session.get(Assignment, env["assignment_id"])
        row = db.session.get(AssignmentSubmission, env["submission_id"])
        assert assignment.modification_requested is True
        assert "Evidence and citations" in assignment.modification_request_reason
        assert "Submission does not meet the requirements" not in (
            assignment.modification_request_reason
        )
        assert row.feedback == original_feedback
        assert row.grade == 45.0


def test_assignment_revision_state_is_per_student(app, env):
    """A cohort-wide legacy flag must not give another student a revision."""
    with app.app_context():
        assignment = db.session.get(Assignment, env["assignment_id"])
        own_completion = LessonCompletion.query.filter_by(
            student_id=env["student_id"], lesson_id=assignment.lesson_id,
        ).first()
        own_completion.assignment_needs_resubmission = True
        own_completion.modification_request_reason = "Only the first student failed"

        other_completion = LessonCompletion.query.filter_by(
            student_id=env["teammate_id"], lesson_id=assignment.lesson_id,
        ).first()
        if other_completion is None:
            other_completion = LessonCompletion(
                student_id=env["teammate_id"], lesson_id=assignment.lesson_id,
            )
            db.session.add(other_completion)
        other_completion.assignment_needs_resubmission = False
        other_completion.modification_request_reason = None

        # Legacy parent state is still set for the whole assignment.
        assignment.modification_requested = True
        assignment.modification_request_reason = "Only the first student failed"
        assignment.can_resubmit = True

        other_submission = AssignmentSubmission(
            assignment_id=assignment.id, student_id=env["teammate_id"],
            content="other work", submitted_at=now_local(), grade=90.0,
            feedback="Good work", graded_at=now_local(),
        )
        db.session.add(other_submission)
        db.session.commit()

        own = db.session.get(AssignmentSubmission, env["submission_id"])
        own_status = _build_assignment_submission_status(assignment, own)
        assert own_status["status"] == "needs_revision"
        assert own_status["modification_request_reason"] == "Only the first student failed"

        other_status = _build_assignment_submission_status(assignment, other_submission)
        assert other_status["status"] == "graded"
        assert other_status["modification_requested"] is False
        assert other_status["modification_request_reason"] is None
        assert other_status["can_resubmit"] is False
        assert other_status["grade"] == 90.0
