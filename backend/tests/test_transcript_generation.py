"""Reproduce transcript generation end-to-end (service, route, full data)."""

import hashlib
import uuid

import pytest


def _make_student(tag=None):
    from src.models.user_models import db, User, Role

    tag = tag or uuid.uuid4().hex[:8]
    role = Role.query.filter_by(name="student").first()
    if role is None:
        role = Role(name="student")
        db.session.add(role)
        db.session.flush()

    student = User(
        username=f"tr_student_{tag}",
        email=f"tr_student_{tag}@afritech.test",
        password_hash=hashlib.sha256(b"x").hexdigest(),
        role_id=role.id,
        first_name="Trina",
        last_name="Student",
    )
    db.session.add(student)
    db.session.commit()
    db.session.refresh(student)
    return student


def test_service_generate_transcript_direct(app):
    from src.services.certificate_service import CertificateService

    with app.app_context():
        student = _make_student()
        transcript = CertificateService.generate_transcript(student.id)
        print("TRANSCRIPT KEYS:", sorted(transcript.keys()))
        assert "error" not in transcript, transcript.get("error")
        assert transcript["student_info"]["name"] == "Trina Student"

        transcript2 = CertificateService.generate_transcript(student.id)
        assert "error" not in transcript2, transcript2.get("error")


def test_route_transcript_endpoint(app, client):
    from flask_jwt_extended import create_access_token

    with app.app_context():
        student = _make_student()
        token = create_access_token(identity=str(student.id))

    resp = client.get(
        "/api/v1/student/certificate/transcript",
        headers={"Authorization": f"Bearer {token}"},
    )
    print("STATUS:", resp.status_code)
    print("BODY:", resp.get_json())
    assert resp.status_code == 200, resp.get_json()
    body = resp.get_json()
    assert body["success"] is True
    assert body["data"]["student_info"]["name"] == "Trina Student"


def test_transcript_with_full_data(app):
    """Enrollment + module progress + certificate + badge path."""
    from src.models.user_models import db, User, Role
    from src.models.course_models import Course, Module
    from src.models.student_models import (
        Certificate,
        Enrollment,
        ModuleProgress,
        SkillBadge,
        StudentSkillBadge,
    )
    from src.services.certificate_service import CertificateService

    with app.app_context():
        student = _make_student()

        instr_role = Role.query.filter_by(name="instructor").first()
        if instr_role is None:
            instr_role = Role(name="instructor")
            db.session.add(instr_role)
            db.session.flush()
        instructor = User(
            username=f"tr_instr_{uuid.uuid4().hex[:8]}",
            email=f"tr_instr_{uuid.uuid4().hex[:8]}@afritech.test",
            password_hash=hashlib.sha256(b"x").hexdigest(),
            role_id=instr_role.id,
        )
        db.session.add(instructor)
        db.session.flush()

        course = Course(
            title=f"Transcript Course {uuid.uuid4().hex[:6]}",
            description="desc",
            instructor_id=instructor.id,
            is_published=True,
            enrollment_type="free",
            learning_objectives="Python\nData analysis",
        )
        db.session.add(course)
        db.session.flush()

        enrollment = Enrollment(student_id=student.id, course_id=course.id)
        db.session.add(enrollment)
        db.session.flush()

        module = Module(
            course_id=course.id,
            title="M1",
            order=0,
            is_published=True,
            learning_objectives="Write functions",
        )
        db.session.add(module)
        db.session.flush()

        db.session.add(
            ModuleProgress(
                student_id=student.id,
                module_id=module.id,
                enrollment_id=enrollment.id,
            )
        )

        cert = Certificate(
            student_id=student.id,
            course_id=course.id,
            enrollment_id=enrollment.id,
            certificate_number=f"ABC-2026-{uuid.uuid4().hex[:6].upper()}",
            overall_score=88.0,
            verification_hash="deadbeef",
        )
        db.session.add(cert)

        badge = SkillBadge(
            name=f"Badge {uuid.uuid4().hex[:6]}",
            description="Test badge",
            criteria="{}",
            category="technical",
            difficulty_level="beginner",
        )
        db.session.add(badge)
        db.session.flush()
        db.session.add(StudentSkillBadge(student_id=student.id, badge_id=badge.id))
        db.session.commit()

        transcript = CertificateService.generate_transcript(student.id)
        assert "error" not in transcript, transcript.get("error")
        print("COURSE HISTORY LEN:", len(transcript["course_history"]))
        assert len(transcript["course_history"]) == 1
        assert transcript["summary"]["total_certificates"] == 1
        assert transcript["summary"]["total_badges"] == 1
        modules = transcript["course_history"][0]["modules"]
        print("MODULES:", [m.get("module_info", {}).get("title") for m in modules])
        assert len(modules) == 1
        # Client payload must not leak the internal verification hash
        assert "verification_hash" not in transcript["certificates"][0]


def test_transcript_route_with_full_data(app, client):
    from flask_jwt_extended import create_access_token
    from src.models.user_models import db, User, Role
    from src.models.course_models import Course
    from src.models.student_models import Certificate, Enrollment

    with app.app_context():
        student = _make_student()
        instr_role = Role.query.filter_by(name="instructor").first()
        if instr_role is None:
            instr_role = Role(name="instructor")
            db.session.add(instr_role)
            db.session.flush()
        instructor = User(
            username=f"tr_instr_{uuid.uuid4().hex[:8]}",
            email=f"tr_instr_{uuid.uuid4().hex[:8]}@afritech.test",
            password_hash=hashlib.sha256(b"x").hexdigest(),
            role_id=instr_role.id,
        )
        db.session.add(instructor)
        db.session.flush()
        course = Course(
            title=f"Transcript Route Course {uuid.uuid4().hex[:6]}",
            description="desc",
            instructor_id=instructor.id,
            is_published=True,
            enrollment_type="free",
        )
        db.session.add(course)
        db.session.flush()
        enrollment = Enrollment(student_id=student.id, course_id=course.id)
        db.session.add(enrollment)
        db.session.flush()
        db.session.add(
            Certificate(
                student_id=student.id,
                course_id=course.id,
                enrollment_id=enrollment.id,
                certificate_number=f"ABC-2026-{uuid.uuid4().hex[:6].upper()}",
                overall_score=91.0,
                verification_hash="cafe",
            )
        )
        db.session.commit()
        token = create_access_token(identity=str(student.id))

    resp = client.get(
        "/api/v1/student/certificate/transcript",
        headers={"Authorization": f"Bearer {token}"},
    )
    print("FULL STATUS:", resp.status_code)
    body = resp.get_json()
    if resp.status_code != 200:
        print("FULL BODY:", body)
    assert resp.status_code == 200, body
    assert body["data"]["summary"]["total_certificates"] == 1
    assert len(body["data"]["course_history"]) == 1


def test_transcript_skips_orphaned_enrollments(app):
    """A deleted course must not break the entire transcript."""
    from src.models.user_models import db
    from src.models.course_models import Course
    from src.models.student_models import Enrollment
    from src.services.certificate_service import CertificateService

    with app.app_context():
        student = _make_student()
        # Raw insert path: create enrollment, then delete the course row so the
        # enrollment is orphaned.
        from src.models.user_models import User, Role
        import hashlib

        instr_role = Role.query.filter_by(name="instructor").first()
        if instr_role is None:
            instr_role = Role(name="instructor")
            db.session.add(instr_role)
            db.session.flush()
        instructor = User(
            username=f"tr_orph_{uuid.uuid4().hex[:8]}",
            email=f"tr_orph_{uuid.uuid4().hex[:8]}@afritech.test",
            password_hash=hashlib.sha256(b"x").hexdigest(),
            role_id=instr_role.id,
        )
        db.session.add(instructor)
        db.session.flush()
        course = Course(
            title=f"Orphan Course {uuid.uuid4().hex[:6]}",
            description="to be deleted",
            instructor_id=instructor.id,
            is_published=True,
            enrollment_type="free",
        )
        db.session.add(course)
        db.session.flush()
        db.session.add(Enrollment(student_id=student.id, course_id=course.id))
        db.session.commit()

        db.session.delete(course)
        db.session.commit()

        transcript = CertificateService.generate_transcript(student.id)
        assert "error" not in transcript, transcript.get("error")
        assert transcript["course_history"] == []
