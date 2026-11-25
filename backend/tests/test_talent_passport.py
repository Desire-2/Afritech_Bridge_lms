"""Talent Passport: evidence integrity, privacy, API, and hook isolation tests.

Every fixture below creates an ordinary LMS record (user, enrolment, course,
submission, grade, certificate). The Passport is exercised only as a consumer
of those records; no passport-specific fake grade or credential is created.

Only immutable ids are kept in the fixture dict. Flask-SQLAlchemy removes the
session at request teardown, so storing ORM instances across client calls would
make them detached.
"""

from __future__ import annotations

import importlib.util
import uuid
from datetime import timedelta
from pathlib import Path

import pytest
from flask_jwt_extended import create_access_token

from src.utils.time_utils import now_local


def _role(db, Role, name):
    role = Role.query.filter_by(name=name).first()
    if role is None:
        role = Role(name=name)
        db.session.add(role)
        db.session.flush()
    return role


def _user(db, User, Role, role_name, tag, **extra):
    values = dict(
        username=f"tp_{role_name}_{tag}",
        email=f"tp_{role_name}_{tag}@afritech.test",
        password_hash="test-hash",
        first_name="Talent",
        last_name=role_name.title(),
        role_id=_role(db, Role, role_name).id,
    )
    values.update(extra)
    user = User(**values)
    db.session.add(user)
    db.session.flush()
    return user


@pytest.fixture()
def env(app):
    from src.models.aage_models import EvaluationResult, GradingReview
    from src.models.course_models import (
        Assignment, AssignmentSubmission, Course, Enrollment, Project,
        ProjectSubmission,
    )
    from src.models.grading_models import GradingHistory
    from src.models.user_models import Role, User, db

    db.create_all()
    tag = uuid.uuid4().hex[:8]
    instructor = _user(db, User, Role, "instructor", tag)
    admin = _user(db, User, Role, "admin", tag)
    student = _user(db, User, Role, "student", tag)
    other_student = _user(db, User, Role, "student", f"other{tag}")

    course = Course(
        title=f"Excel Analytics Bootcamp {tag}",
        description="Spreadsheet analysis and reporting",
        instructor_id=instructor.id,
        is_published=True,
    )
    db.session.add(course)
    db.session.flush()

    enrollment = Enrollment(
        student_id=student.id,
        course_id=course.id,
        status="active",
        enrollment_date=now_local() - timedelta(days=30),
    )
    db.session.add(enrollment)
    db.session.flush()

    assignment = Assignment(
        title=f"Sales dashboard {tag}",
        description="Build a dashboard from real spreadsheet data",
        course_id=course.id,
        instructor_id=instructor.id,
        points_possible=100,
    )
    db.session.add(assignment)
    db.session.flush()

    project = Project(
        title=f"Capstone analysis {tag}",
        description="Analyse a business dataset",
        course_id=course.id,
        module_ids="[]",
        due_date=now_local() + timedelta(days=14),
        points_possible=100,
    )
    db.session.add(project)
    db.session.commit()

    return {
        "tag": tag,
        "db": db,
        "student_id": student.id,
        "instructor_id": instructor.id,
        "admin_id": admin.id,
        "other_student_id": other_student.id,
        "course_id": course.id,
        "enrollment_id": enrollment.id,
        "assignment_id": assignment.id,
        "project_id": project.id,
        "EvaluationResult": EvaluationResult,
        "GradingReview": GradingReview,
        "GradingHistory": GradingHistory,
        "AssignmentSubmission": AssignmentSubmission,
        "ProjectSubmission": ProjectSubmission,
    }


def _sync(env, student_id=None):
    from src.talent_passport.evidence import sync_student

    counts = sync_student(student_id or env["student_id"])
    env["db"].session.commit()
    return counts


def _passport(env):
    from src.talent_passport.models import TalentPassport

    return TalentPassport.query.filter_by(student_id=env["student_id"]).first()


def _mapping(env, *, skill_key, source_type, source_id, min_score=70,
             proficiency_label=None, required_verification=False):
    from src.talent_passport.models import CourseSkillMapping, SkillDefinition

    skill = SkillDefinition.query.filter_by(key=skill_key).first()
    assert skill is not None, skill_key
    row = CourseSkillMapping(
        course_id=env["course_id"],
        skill_definition_id=skill.id,
        source_type=source_type,
        source_id=source_id,
        min_score=min_score,
        proficiency_label=proficiency_label,
        required_verification=required_verification,
        competency_criteria="Authorized rubric criterion",
    )
    env["db"].session.add(row)
    env["db"].session.commit()
    return row


def _student_skill(env, skill_key):
    from src.talent_passport.models import SkillDefinition, StudentSkill

    passport = _passport(env)
    definition = SkillDefinition.query.filter_by(key=skill_key).first()
    assert passport is not None and definition is not None
    return StudentSkill.query.filter_by(
        passport_id=passport.id, skill_definition_id=definition.id
    ).first()


def _header_id(user_id):
    return {"Authorization": f"Bearer {create_access_token(identity=str(user_id))}"}


def _certificate(env, *, certificate_number=None, is_active=True):
    from src.models.student_models import Certificate

    row = Certificate(
        student_id=env["student_id"],
        course_id=env["course_id"],
        enrollment_id=env["enrollment_id"],
        certificate_number=certificate_number or f"TP-{env['tag']}-000001",
        overall_score=88,
        verification_hash="test-hash",
        issued_at=now_local() - timedelta(days=1),
        is_active=is_active,
    )
    env["db"].session.add(row)
    env["db"].session.commit()
    return row.id


# ---------------------------------------------------------------------------
# Evidence engine
# ---------------------------------------------------------------------------
def test_enrollment_sync_creates_learning_evidence_without_proficiency(env):
    from src.talent_passport.models import SkillEvidence, StudentSkill

    _sync(env)
    passport = _passport(env)
    assert passport is not None
    assert passport.is_published is False
    assert passport.public_slug and len(passport.public_slug) >= 24

    skills = StudentSkill.query.filter_by(passport_id=passport.id).all()
    assert skills
    assert all(row.status == "LEARNING" for row in skills)
    assert all(row.proficiency_level is None for row in skills)
    assert SkillEvidence.query.filter_by(student_id=env["student_id"]).count() >= len(skills)


def test_approved_classic_grade_becomes_demonstrated_with_mapped_proficiency(env):
    from src.talent_passport.models import SkillEvidence

    _sync(env)
    submission = env["AssignmentSubmission"](
        assignment_id=env["assignment_id"],
        student_id=env["student_id"],
        content="Completed dashboard",
        submitted_at=now_local() - timedelta(days=2),
        grade=85,
        graded_at=now_local() - timedelta(days=1),
        graded_by=env["instructor_id"],
    )
    env["db"].session.add(submission)
    env["db"].session.flush()
    env["db"].session.add(env["GradingHistory"](
        submission_id=submission.id,
        submission_type="assignment",
        instructor_id=env["instructor_id"],
        action="created",
        new_grade=85,
    ))
    env["db"].session.commit()
    _mapping(env, skill_key="python", source_type="assignment",
             source_id=env["assignment_id"], proficiency_label="Proficient")

    _sync(env)
    skill = _student_skill(env, "python")
    assert skill is not None
    assert skill.status == "DEMONSTRATED"
    assert skill.proficiency_level == "Proficient"
    evidence = SkillEvidence.query.filter_by(
        student_skill_id=skill.id, source_type="assignment_submission",
        source_id=submission.id,
    ).one()
    assert evidence.score == 85
    assert evidence.grading_state == "approved"
    assert evidence.verification_status == "APPROVED"


def test_provisional_grade_never_proves_capability(env):
    from src.talent_passport.models import SkillEvidence

    _sync(env)
    submission = env["AssignmentSubmission"](
        assignment_id=env["assignment_id"],
        student_id=env["student_id"],
        content="AI-graded draft",
        submitted_at=now_local() - timedelta(days=2),
        grade=95,
        graded_at=now_local() - timedelta(days=1),
        graded_by=None,  # no staff grader and no GradingHistory row
    )
    env["db"].session.add(submission)
    env["db"].session.commit()
    _mapping(env, skill_key="python", source_type="assignment",
             source_id=env["assignment_id"], proficiency_label="Proficient")

    _sync(env)
    skill = _student_skill(env, "python")
    assert skill is not None
    assert skill.status == "EVIDENCE_SUBMITTED"
    assert skill.proficiency_level is None
    evidence = SkillEvidence.query.filter_by(
        student_skill_id=skill.id, source_type="assignment_submission", source_id=submission.id
    ).one()
    assert evidence.score is None
    assert evidence.grading_state == "provisional"


def test_aage_result_requires_official_publication_and_approved_review(env):
    from src.talent_passport.models import SkillEvidence

    _sync(env)
    submission = env["AssignmentSubmission"](
        assignment_id=env["assignment_id"],
        student_id=env["student_id"],
        content="AAGE submission",
        submitted_at=now_local() - timedelta(days=2),
    )
    env["db"].session.add(submission)
    env["db"].session.flush()
    result = env["EvaluationResult"](
        submission_type="assignment",
        submission_id=submission.id,
        assessment_kind="assignment",
        assessment_id=env["assignment_id"],
        course_id=env["course_id"],
        student_id=env["student_id"],
        final_score=92,
        requires_review=True,
        status="draft",
        is_official=False,
    )
    env["db"].session.add(result)
    env["db"].session.commit()
    _mapping(env, skill_key="python", source_type="assignment",
             source_id=env["assignment_id"], min_score=70, proficiency_label="Advanced")

    _sync(env)
    skill = _student_skill(env, "python")
    assert skill is not None
    assert skill.status == "EVIDENCE_SUBMITTED"
    assert skill.proficiency_level is None

    result.status = "published"
    result.is_official = True
    result.published_at = now_local()
    env["db"].session.commit()
    _sync(env)
    # Review is still pending, so the score remains inadmissible.
    skill = _student_skill(env, "python")
    assert skill.status == "EVIDENCE_SUBMITTED"
    assert skill.proficiency_level is None

    env["db"].session.add(env["GradingReview"](
        result_id=result.id, status="approved", final_score=92,
        resolved_at=now_local(),
    ))
    env["db"].session.commit()
    _sync(env)
    skill = _student_skill(env, "python")
    assert skill.status == "DEMONSTRATED"
    assert skill.proficiency_level == "Advanced"
    evidence = SkillEvidence.query.filter_by(
        student_skill_id=skill.id, source_type="assignment_submission", source_id=submission.id
    ).one()
    assert evidence.score == 92


def test_corrected_grade_updates_existing_evidence_without_duplicate(env):
    from src.talent_passport.models import SkillEvidence

    _sync(env)
    submission = env["AssignmentSubmission"](
        assignment_id=env["assignment_id"],
        student_id=env["student_id"],
        content="Initial submission",
        submitted_at=now_local() - timedelta(days=2),
        grade=88,
        graded_at=now_local() - timedelta(days=1),
        graded_by=env["instructor_id"],
    )
    env["db"].session.add(submission)
    env["db"].session.flush()
    env["db"].session.add(env["GradingHistory"](
        submission_id=submission.id, submission_type="assignment",
        instructor_id=env["instructor_id"], action="created", new_grade=88,
    ))
    env["db"].session.commit()
    _mapping(env, skill_key="python", source_type="assignment",
             source_id=env["assignment_id"], proficiency_label="Proficient")

    _sync(env)
    skill = _student_skill(env, "python")
    first = SkillEvidence.query.filter_by(
        student_skill_id=skill.id, source_type="assignment_submission", source_id=submission.id
    ).one()

    submission.grade = 55
    submission.graded_at = now_local()
    env["db"].session.add(env["GradingHistory"](
        submission_id=submission.id, submission_type="assignment",
        instructor_id=env["instructor_id"], action="updated",
        previous_grade=88, new_grade=55,
    ))
    env["db"].session.commit()
    _sync(env)

    rows = SkillEvidence.query.filter_by(
        student_skill_id=skill.id, source_type="assignment_submission", source_id=submission.id
    ).all()
    assert len(rows) == 1
    assert rows[0].id == first.id
    assert rows[0].score == 55
    assert rows[0].grading_state == "updated"
    assert _student_skill(env, "python").status == "EVIDENCE_SUBMITTED"
    assert _student_skill(env, "python").proficiency_level is None


def test_team_project_grade_is_capped_until_individual_verification(env, client):
    from src.talent_passport.models import SkillEvidence

    _sync(env)
    submission = env["ProjectSubmission"](
        project_id=env["project_id"],
        student_id=env["student_id"],
        team_members=f'[{env["student_id"]}, {env["other_student_id"]}]',
        text_content="Team submission",
        submitted_at=now_local() - timedelta(days=2),
        grade=96,
        graded_at=now_local() - timedelta(days=1),
        graded_by=env["instructor_id"],
    )
    env["db"].session.add(submission)
    env["db"].session.flush()
    env["db"].session.add(env["GradingHistory"](
        submission_id=submission.id, submission_type="project",
        instructor_id=env["instructor_id"], action="created", new_grade=96,
    ))
    env["db"].session.commit()
    _mapping(env, skill_key="data_analysis", source_type="project",
             source_id=env["project_id"], min_score=70, proficiency_label="Advanced")

    _sync(env)
    skill = _student_skill(env, "data_analysis")
    assert skill is not None
    assert skill.status == "EVIDENCE_SUBMITTED"
    evidence = SkillEvidence.query.filter_by(
        student_skill_id=skill.id, source_type="project_submission", source_id=submission.id
    ).one()
    assert evidence.score is None
    assert evidence.grading_state == "awaiting_review"
    assert evidence.extra["team_submission"] is True

    response = client.post(
        f"/api/v1/admin/talent/evidence/{evidence.id}/verify",
        headers=_header_id(env["admin_id"]),
    )
    assert response.status_code == 200, response.get_data(as_text=True)
    assert response.get_json()["verification_status"] == "VERIFIED"
    assert _student_skill(env, "data_analysis").status == "VERIFIED"


def test_certificate_revocation_replaces_verified_evidence(env):
    from src.talent_passport.models import SkillEvidence

    _sync(env)
    certificate_id = _certificate(env)
    _sync(env)

    certificate_skill = None
    for row in SkillEvidence.query.filter_by(
        student_id=env["student_id"], source_type="certificate"
    ).all():
        if row.verification_status == "VERIFIED":
            certificate_skill = row.student_skill
            break
    assert certificate_skill is not None

    from src.models.student_models import Certificate

    certificate = Certificate.query.get(certificate_id)
    certificate.is_active = False
    env["db"].session.commit()
    _sync(env)

    replacements = SkillEvidence.query.filter_by(
        student_skill_id=certificate_skill.id,
        source_type="certificate",
        source_id=certificate_id,
    ).all()
    assert len(replacements) == 1
    assert replacements[0].verification_status == "REJECTED"
    assert replacements[0].score is None
    assert certificate_skill.status == "LEARNING"


def test_handle_event_is_idempotent(env):
    from src.talent_passport.evidence import handle_event
    from src.talent_passport.models import ProcessedPassportEvent

    first = handle_event("assignment.submitted", env["student_id"],
                         "assignment_submission", env["assignment_id"])
    second = handle_event("assignment.submitted", env["student_id"],
                          "assignment_submission", env["assignment_id"])
    env["db"].session.commit()

    assert first["duplicate"] is False
    assert second["duplicate"] is True
    assert ProcessedPassportEvent.query.get(first["event_key"]) is not None


def test_notify_hook_syncs_real_lms_change_and_is_idempotent(env):
    from src.talent_passport import hooks
    from src.talent_passport.models import ProcessedPassportEvent

    _sync(env)
    submission = env["AssignmentSubmission"](
        assignment_id=env["assignment_id"],
        student_id=env["student_id"],
        content="Submitted after passport creation",
        submitted_at=now_local(),
    )
    env["db"].session.add(submission)
    env["db"].session.commit()
    before = ProcessedPassportEvent.query.count()

    payload = dict(
        event_type="assignment.submitted",
        student_id=env["student_id"],
        source_type="assignment_submission",
        source_id=submission.id,
        course_id=env["course_id"],
    )
    first = hooks.notify_talent_passport(**payload)
    env["db"].session.commit()
    second = hooks.notify_talent_passport(**payload)
    env["db"].session.commit()

    assert first is not None and first["duplicate"] is False
    assert second is not None and second["duplicate"] is True
    assert ProcessedPassportEvent.query.count() == before + 1
    assert _passport(env).last_synced_at is not None


def test_canonical_write_paths_are_wired_to_passport_hooks():
    root = Path(__file__).resolve().parents[1]
    expected = {
        "src/routes/grading_routes.py": ("assignment.graded", "project.graded"),
        "src/routes/file_upload_routes.py": ("assignment.submitted", "assignment.resubmitted", "project.submitted"),
        "src/routes/student_routes.py": ("assignment.submitted", "project.submitted", "quiz.submitted"),
        "src/routes/quiz_progress_routes.py": ("quiz.submitted",),
        "src/services/certificate_service.py": ("certificate.issued", "certificate.updated"),
        "src/services/achievement_service.py": ("achievement.awarded",),
        "src/services/enrollment_progress_service.py": ("enrollment.progress", "course.completed"),
        "src/services/aage/persistence.py": ("aage.published",),
        "src/services/excel_grading/auto_grader.py": ("excel.graded", "excel.reviewed"),
        "src/routes/excel_grading_routes.py": ("excel.reviewed",),
    }
    for relative_path, event_types in expected.items():
        source = (root / relative_path).read_text(encoding="utf-8")
        assert "notify_talent_passport(" in source, relative_path
        for event_type in event_types:
            assert f'"{event_type}"' in source, (relative_path, event_type)


# ---------------------------------------------------------------------------
# API privacy and admin controls
# ---------------------------------------------------------------------------
def test_private_by_default_publication_toggles_and_slug_revocation(env, client):
    from src.talent_passport.models import TalentPassport

    _sync(env)
    passport = _passport(env)
    initial_slug = passport.public_slug
    headers = _header_id(env["student_id"])

    response = client.get(f"/api/v1/talent/public/{initial_slug}")
    assert response.status_code == 404

    response = client.put(
        "/api/v1/student/talent-passport/profile",
        headers=headers,
        json={
            "headline": "Data analyst",
            "country": "RW",
            "city": "Kigali",
            "career_interests": ["analytics", "visualisation"],
            "portfolio_url": "https://example.com/portfolio",
        },
    )
    assert response.status_code == 200, response.get_data(as_text=True)

    response = client.put(
        "/api/v1/student/talent-passport/visibility",
        headers=headers,
        json={"skills": True, "show_email": True},
    )
    assert response.status_code == 200, response.get_data(as_text=True)
    assert response.get_json()["is_published"] is False

    response = client.post("/api/v1/student/talent-passport/publish", headers=headers)
    assert response.status_code == 200, response.get_data(as_text=True)
    old_slug = initial_slug
    assert response.get_json()["public_slug"] == old_slug

    public = client.get(f"/api/v1/talent/public/{old_slug}")
    assert public.status_code == 200, public.get_data(as_text=True)
    payload = public.get_json()
    assert payload["sections"]["skills"] is True
    assert payload["sections"]["certificates"] is False
    assert payload["profile"] == {}  # professional_profile hidden
    assert payload["certificates"] == []
    assert "email" not in payload

    pdf = client.get(f"/api/v1/talent/public/{old_slug}/pdf")
    assert pdf.status_code == 200, pdf.get_data(as_text=True)
    assert pdf.data.startswith(b"%PDF")

    response = client.post("/api/v1/student/talent-passport/unpublish", headers=headers)
    assert response.status_code == 200, response.get_data(as_text=True)
    assert client.get(f"/api/v1/talent/public/{old_slug}").status_code == 404
    refreshed = TalentPassport.query.filter_by(student_id=env["student_id"]).first()
    assert refreshed.public_slug != old_slug


def test_student_cannot_read_another_students_passport(env, client):
    from src.talent_passport.services import get_passport, update_profile

    _sync(env)
    own = get_passport(env["student_id"])
    other = get_passport(env["other_student_id"])
    update_profile(own, {"headline": "Own passport"})
    update_profile(other, {"headline": "Other students passport"})
    env["db"].session.commit()

    response = client.get(
        f"/api/v1/student/talent-passport/profile?student_id={env['other_student_id']}",
        headers=_header_id(env["student_id"]),
    )
    assert response.status_code == 200, response.get_data(as_text=True)
    # A forged student_id must not switch the caller to another passport.
    assert response.get_json()["profile"]["headline"] == "Own passport"


def test_admin_verification_requires_privileged_actor_and_forbids_self(env, client):
    from src.talent_passport.models import (
        SkillDefinition, SkillEvidence, StudentSkill, TalentPassport,
    )

    _sync(env)
    passport = _passport(env)
    definition = SkillDefinition.query.filter_by(key="python").first()
    definition_id = definition.id
    skill = StudentSkill(passport_id=passport.id, student_id=env["student_id"],
                         skill_definition_id=definition_id, status="EVIDENCE_SUBMITTED")
    env["db"].session.add(skill)
    env["db"].session.flush()
    evidence = SkillEvidence(
        student_skill_id=skill.id,
        student_id=env["student_id"],
        source_type="assignment_submission",
        source_id=999001,
        verification_status="PENDING",
    )
    env["db"].session.add(evidence)
    env["db"].session.commit()
    evidence_id = evidence.id

    denied = client.post(
        f"/api/v1/admin/talent/evidence/{evidence_id}/verify",
        headers=_header_id(env["student_id"]),
    )
    assert denied.status_code == 403

    # Even an administrator may not verify evidence belonging to themselves.
    admin_passport = TalentPassport(student_id=env["admin_id"])
    env["db"].session.add(admin_passport)
    env["db"].session.flush()
    own_skill = StudentSkill(passport_id=admin_passport.id, student_id=env["admin_id"],
                             skill_definition_id=definition_id, status="LEARNING")
    env["db"].session.add(own_skill)
    env["db"].session.flush()
    own_evidence = SkillEvidence(
        student_skill_id=own_skill.id,
        student_id=env["admin_id"],
        source_type="assignment_submission",
        source_id=999002,
        verification_status="PENDING",
    )
    env["db"].session.add(own_evidence)
    env["db"].session.commit()
    own_evidence_id = own_evidence.id

    self_denied = client.post(
        f"/api/v1/admin/talent/evidence/{own_evidence_id}/verify",
        headers=_header_id(env["admin_id"]),
    )
    assert self_denied.status_code == 403


def test_instructor_can_map_own_course_but_not_another_course(env, client):
    from src.models.course_models import Course
    from src.talent_passport.models import SkillDefinition

    skill = SkillDefinition.query.filter_by(key="python").first()
    skill_id = skill.id
    response = client.post(
        "/api/v1/admin/talent/mappings",
        headers=_header_id(env["instructor_id"]),
        json={
            "course_id": env["course_id"],
            "skill_definition_id": skill_id,
            "source_type": "assignment",
            "source_id": 12345,
            "min_score": 75,
            "proficiency_label": "Proficient",
        },
    )
    assert response.status_code == 201, response.get_data(as_text=True)

    other_course = Course(
        title=f"Someone else's course {env['tag']}",
        description="Not taught by this instructor",
        instructor_id=env["admin_id"],
        is_published=True,
    )
    env["db"].session.add(other_course)
    env["db"].session.commit()
    denied = client.post(
        "/api/v1/admin/talent/mappings",
        headers=_header_id(env["instructor_id"]),
        json={
            "course_id": other_course.id,
            "skill_definition_id": skill_id,
            "source_type": "assignment",
            "source_id": 12346,
        },
    )
    assert denied.status_code == 403


def test_export_pdf_is_owner_only_and_returns_pdf(env, client):
    _sync(env)
    response = client.post(
        "/api/v1/student/talent-passport/export/pdf",
        headers=_header_id(env["student_id"]),
        json={},
    )
    assert response.status_code == 200, response.get_data(as_text=True)
    assert response.data.startswith(b"%PDF")
    assert "application/pdf" in response.content_type


def test_hook_failure_is_isolated_from_lms_write(env, monkeypatch):
    from src.talent_passport import hooks

    def _boom(*args, **kwargs):
        raise RuntimeError("passport failed")

    monkeypatch.setattr(hooks, "handle_event", _boom)
    before = env["AssignmentSubmission"].query.count()
    result = hooks.notify_talent_passport(
        "grade.updated", env["student_id"], "assignment_submission", env["assignment_id"]
    )
    after = env["AssignmentSubmission"].query.count()
    assert result is None
    # The hook neither rolled back nor created an LMS submission.
    assert after == before


# ---------------------------------------------------------------------------
# Migration sanity
# ---------------------------------------------------------------------------
def test_course_deletion_removes_talent_passport_mappings(env):
    from src.models.course_models import Course
    from src.talent_passport.models import CourseSkillMapping

    _sync(env)
    _mapping(env, skill_key="python", source_type="assignment",
             source_id=env["assignment_id"])
    course_id = env["course_id"]
    assert CourseSkillMapping.query.filter_by(course_id=course_id).count() >= 1

    db = env["db"]
    db.session.delete(Course.query.get(course_id))
    db.session.commit()

    assert CourseSkillMapping.query.filter_by(course_id=course_id).count() == 0


def test_user_deletion_removes_passport_records(env):
    from src.models.user_models import User
    from src.talent_passport.models import (
        SkillEvidence, StudentSkill, TalentPassport,
    )

    _sync(env)
    passport = _passport(env)
    assert passport is not None
    student_id = env["student_id"]

    from src.models.course_models import Enrollment

    db = env["db"]
    # The LMS models have their own ownership rows; remove them the same way
    # the existing approval fixture does before deleting the user.
    for row in Enrollment.query.filter_by(student_id=student_id).all():
        db.session.delete(row)
    for row in env["AssignmentSubmission"].query.filter_by(student_id=student_id).all():
        db.session.delete(row)
    db.session.flush()
    db.session.delete(User.query.get(student_id))
    db.session.commit()

    assert TalentPassport.query.filter_by(student_id=student_id).first() is None
    assert StudentSkill.query.filter_by(student_id=student_id).count() == 0
    assert SkillEvidence.query.filter_by(student_id=student_id).count() == 0


def test_migration_is_additive_and_guarded():
    root = Path(__file__).resolve().parents[1]
    path = root / "migrations" / "versions" / "f7a2b9c3d4e5_add_talent_passport.py"
    assert path.exists()
    source = path.read_text(encoding="utf-8")
    assert "down_revision = 'a7a8e1c3f5b2'" in source
    assert "def _index(" in source
    assert "op.create_index(" in source  # used only inside the guard
    spec = importlib.util.spec_from_file_location("tp_migration_probe", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert module.revision == "f7a2b9c3d4e5"
    assert module.down_revision == "a7a8e1c3f5b2"
    assert "talent_passports" in module.TABLES
