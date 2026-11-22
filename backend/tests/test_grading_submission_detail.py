"""Regression coverage for instructor submission-detail rubric expansion."""

import hashlib
import uuid
from datetime import timedelta

import pytest
from flask_jwt_extended import create_access_token

from src.models.course_models import (
    Assignment,
    AssignmentSubmission,
    Course,
    Project,
    ProjectSubmission,
)
from src.models.grading_models import Rubric, RubricCriterion
from src.models.user_models import Role, User, db
from src.utils.time_utils import now_local


@pytest.fixture()
def env(app):
    with app.app_context():
        db.create_all()
        tag = uuid.uuid4().hex[:8]

        def user(role_name):
            role = Role.query.filter_by(name=role_name).first()
            if role is None:
                role = Role(name=role_name)
                db.session.add(role)
                db.session.flush()
            person = User(
                username=f"grading_detail_{role_name}_{tag}",
                email=f"grading_detail_{role_name}_{tag}@afritech.test",
                password_hash=hashlib.sha256(b"x").hexdigest(),
                first_name="Test",
                last_name=role_name.title(),
                role_id=role.id,
            )
            db.session.add(person)
            db.session.flush()
            return person

        instructor = user("instructor")
        student = user("student")
        course = Course(
            title=f"Grading Detail Course {tag}",
            description="submission detail regression",
            instructor_id=instructor.id,
            is_published=True,
        )
        db.session.add(course)
        db.session.flush()

        rubric = Rubric(
            title="Detailed rubric",
            description="Criterion shown on the grading screen",
            instructor_id=instructor.id,
            course_id=course.id,
            total_points=100,
            status="approved",
        )
        db.session.add(rubric)
        db.session.flush()
        db.session.add(RubricCriterion(
            rubric_id=rubric.id,
            name="Correctness",
            description="The solution works",
            max_points=100,
            order_index=0,
            weight=100,
        ))

        assignment = Assignment(
            title="Detailed Assignment",
            description="Submit your solution",
            assignment_type="both",
            instructor_id=instructor.id,
            course_id=course.id,
            points_possible=100,
            rubric_id=rubric.id,
        )
        db.session.add(assignment)
        db.session.flush()
        submission = AssignmentSubmission(
            assignment_id=assignment.id,
            student_id=student.id,
            content="My solution",
        )
        db.session.add(submission)
        db.session.flush()

        project = Project(
            title="Detailed Project",
            description="Build a project",
            course_id=course.id,
            module_ids="[]",
            due_date=now_local() + timedelta(days=7),
            points_possible=100,
            rubric_id=rubric.id,
        )
        db.session.add(project)
        db.session.flush()
        project_submission = ProjectSubmission(
            project_id=project.id,
            student_id=student.id,
            text_content="My project",
            submitted_at=now_local(),
        )
        db.session.add(project_submission)
        db.session.commit()
        return {
            "instructor_id": instructor.id,
            "assignment_submission_id": submission.id,
            "project_submission_id": project_submission.id,
            "rubric_id": rubric.id,
        }


def _headers(app, env):
    with app.app_context():
        user = User.query.get(env["instructor_id"])
        token = create_access_token(identity=str(user.id))
    return {"Authorization": f"Bearer {token}"}


def test_assignment_detail_includes_linked_rubric(app, client, env):
    response = client.get(
        f"/api/v1/grading/assignments/submissions/{env['assignment_submission_id']}",
        query_string={"include_rubric": "true"},
        headers=_headers(app, env),
    )
    assert response.status_code == 200
    body = response.get_json()
    rubric = body["assignment"]["rubric"]
    assert rubric["id"] == env["rubric_id"]
    assert rubric["title"] == "Detailed rubric"
    assert rubric["total_points"] == 100
    assert rubric["criteria"][0]["name"] == "Correctness"


def test_assignment_detail_omits_rubric_when_not_requested(app, client, env):
    response = client.get(
        f"/api/v1/grading/assignments/submissions/{env['assignment_submission_id']}",
        headers=_headers(app, env),
    )
    assert response.status_code == 200
    assert "rubric" not in response.get_json()["assignment"]


def test_project_detail_includes_linked_rubric(app, client, env):
    response = client.get(
        f"/api/v1/grading/projects/submissions/{env['project_submission_id']}",
        query_string={"include_rubric": "true"},
        headers=_headers(app, env),
    )
    assert response.status_code == 200
    assert response.get_json()["project"]["rubric"]["id"] == env["rubric_id"]


def test_missing_linked_rubric_does_not_fail_submission_detail(app, client, env, monkeypatch):
    class MissingRubricQuery:
        @staticmethod
        def get(_rubric_id):
            return None

    monkeypatch.setattr(Rubric, "query", MissingRubricQuery)
    response = client.get(
        f"/api/v1/grading/assignments/submissions/{env['assignment_submission_id']}",
        query_string={"include_rubric": "true"},
        headers=_headers(app, env),
    )
    assert response.status_code == 200
    assert "rubric" not in response.get_json()["assignment"]
