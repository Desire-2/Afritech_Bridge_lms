"""AAGE-only coverage for spreadsheet grading and legacy compatibility.

Excel is a native specialist evaluator inside AAGE. These tests prove that the
specialist inspects retained workbook bytes with the existing deterministic
analyzers, that AAGE owns scoring/publication/progression, and that the old
Excel endpoints are read/review shims that never start a second engine.
"""

import hashlib
import json
import uuid
from io import BytesIO
from types import SimpleNamespace

import pytest
from flask_jwt_extended import create_access_token

from src.models.aage_models import (
    CriterionScore,
    EvaluationResult,
    GradingJob,
    GradingReview,
    LearningExample,
)
from src.models.course_models import (
    Assignment,
    AssignmentSubmission,
    Course,
    Enrollment,
)
from src.models.excel_grading_models import ExcelGradingResult
from src.models.user_models import Role, User, db
from src.routes import aage_routes, excel_grading_routes, student_routes
from src.services.aage import persistence, submission_dispatch
from src.services.aage.assessment_intelligence import AssessmentDescriptor
from src.services.aage.artifacts import ArtifactManifest, ExtractedFile
from src.services.aage.disciplines import Classification
from src.services.aage.evaluators.base import EvaluationContext
from src.services.aage.evaluators.spreadsheet import SpreadsheetEvaluator
from src.services.excel_grading import auto_grader
from src.services.excel_grading.excel_grading_service import ExcelGradingService
from src.services.excel_grading.excel_file_detection import (
    course_is_excel,
    has_excel_files,
)
from src.utils.time_utils import now_local


ASSIGNMENT_6_INSTRUCTIONS = """
1. Use HLOOKUP to find September revenue in E1.
2. Use SUMIF for North revenue in E2.
3. Use COUNTIF to count transactions above 4000 in E3.
4. Use AVERAGEIF for Software average in E4.
5. Use wildcard COUNTIF for products ending in top in E5.
"""

FORMULAS = [
    '=HLOOKUP(A1,A2:E5,2,FALSE)',
    '=SUMIF(A:A,"North",B:B)',
    '=COUNTIF(B:B,">4000")',
    '=AVERAGEIF(A:A,"Software",B:B)',
    '=COUNTIF(B:B,"*top")',
]


def _role(name):
    role = Role.query.filter_by(name=name).first()
    if role is None:
        role = Role(name=name)
        db.session.add(role)
        db.session.flush()
    return role


def _user(role_name, tag):
    user = User(
        username=f"excel_aage_{role_name}_{tag}",
        email=f"excel_aage_{role_name}_{tag}@afritech.test",
        password_hash=hashlib.sha256(b"x").hexdigest(),
        role_id=_role(role_name).id,
    )
    db.session.add(user)
    db.session.flush()
    return user


@pytest.fixture()
def env(app):
    with app.app_context():
        db.create_all()
        tag = uuid.uuid4().hex[:8]
        instructor = _user("instructor", tag)
        student = _user("student", tag)
        course = Course(
            title=f"MS Excel Integration {tag}",
            description="spreadsheet grading",
            instructor_id=instructor.id,
            is_published=True,
        )
        db.session.add(course)
        db.session.flush()
        assignment = Assignment(
            title=f"Workbook {tag}",
            description="submit a workbook",
            instructions=ASSIGNMENT_6_INSTRUCTIONS,
            course_id=course.id,
            instructor_id=instructor.id,
            points_possible=100.0,
            is_published=True,
        )
        db.session.add(assignment)
        db.session.flush()
        submission = AssignmentSubmission(
            assignment_id=assignment.id,
            student_id=student.id,
            content="answer",
            file_url=json.dumps([
                {"filename": "sales.xlsx", "url": "memory://sales.xlsx"},
            ]),
        )
        db.session.add(submission)
        db.session.flush()
        enrollment = Enrollment(
            student_id=student.id,
            course_id=course.id,
            status="active",
        )
        db.session.add(enrollment)
        db.session.commit()
        data = {
            "instructor": instructor, "student": student, "course": course,
            "assignment": assignment, "submission": submission,
            "enrollment": enrollment,
        }
        for key, value in data.items():
            db.session.refresh(value)
        return data


def _auth(app, user):
    with app.app_context():
        token = create_access_token(identity=str(user.id))
    return {"Authorization": f"Bearer {token}"}


def _workbook_bytes(formula_count=5):
    from openpyxl import Workbook
    from openpyxl.chart import BarChart, Reference

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Sales"
    sheet.append(["Region", "Revenue", "Product"])
    for row in range(2, 8):
        sheet.append(["North" if row % 2 else "South", row * 1000, "Software"])
    for cell, formula in zip(("E1", "E2", "E3", "E4", "E5"), FORMULAS):
        sheet[cell] = formula
    if formula_count < 5:
        for cell in ("E1", "E2", "E3", "E4", "E5")[formula_count:]:
            sheet[cell] = None
    chart = BarChart()
    chart.add_data(Reference(sheet, min_col=2, min_row=1, max_row=7),
                   titles_from_data=True)
    sheet.add_chart(chart, "G1")
    stream = BytesIO()
    workbook.save(stream)
    return stream.getvalue()


def _criteria():
    return [
        {"criterion_key": "formulas", "key": "formulas",
         "name": "Formula accuracy", "max_marks": 60, "weight": 60,
         "is_required": True, "order_index": 0},
        {"criterion_key": "structure", "key": "structure",
         "name": "Workbook structure", "max_marks": 40, "weight": 40,
         "is_required": True, "order_index": 1},
    ]


def _context(*, instructions=ASSIGNMENT_6_INSTRUCTIONS, data=None,
             criteria=None, text_content=""):
    descriptor = AssessmentDescriptor(
        kind="assignment", id=6, title="Applying Essential Arithmetic Skills",
        description="Workbook assessment", instructions=instructions,
        course_id=1, course_title="MS Excel", points_possible=100.0,
    )
    manifest = ArtifactManifest(
        submission_type="assignment", submission_id=909,
        files=[{"file_name": "sales.xlsx", "path": "sales.xlsx"}],
        binary_files=[ExtractedFile(
            path="sales.xlsx", name="sales.xlsx",
            data=data if data is not None else _workbook_bytes(),
            category="binary")],
        text_content=text_content,
    )
    return EvaluationContext(
        descriptor=descriptor,
        rubric={"criteria": criteria if criteria is not None else _criteria()},
        manifest=manifest,
        classification=Classification(discipline="spreadsheet", confidence=0.9),
    )


def _forbid_legacy(monkeypatch, calls):
    def legacy_grade(*args, **kwargs):
        calls.append("ExcelGradingService.grade_submission")
        raise AssertionError("legacy Excel grading must not be called")

    def legacy_publish(*args, **kwargs):
        calls.append("finalize_excel_grade")
        raise AssertionError("legacy Excel publication must not be called")

    monkeypatch.setattr(ExcelGradingService, "grade_submission", legacy_grade)
    monkeypatch.setattr(auto_grader, "finalize_excel_grade", legacy_publish)


def _fake_job(job_id, submission_type="assignment", submission_id=909):
    return SimpleNamespace(
        id=job_id,
        status="queued",
        to_dict=lambda: {
            "id": job_id, "status": "queued",
            "submission_type": submission_type,
            "submission_id": submission_id,
        },
    )


def _make_aage_result(env, *, score=20.0, official=False, status="pending_review"):
    result = EvaluationResult(
        submission_type="assignment", submission_id=env["submission"].id,
        assessment_kind="assignment", assessment_id=env["assignment"].id,
        course_id=env["course"].id, student_id=env["student"].id,
        total_awarded=score, total_possible=100.0, final_score=score,
        grade_letter="F", points_awarded=score, confidence=90.0,
        requires_review=not official, status=status,
        is_official=official,
        published_at=now_local() if official else None,
        feedback="Automated assessment",
    )
    db.session.add(result)
    db.session.flush()
    db.session.add(CriterionScore(
        result_id=result.id, criterion_key="formulas", name="Formula accuracy",
        awarded=score, maximum=100.0, weight=100.0, weighted_score=score,
        verification_status="partial", evaluator_name="spreadsheet",
        evaluator_version="2.0.0", order_index=0,
    ))
    db.session.commit()
    return result


# ---------------------------------------------------------------------------
# Detection + native specialist evaluator
# ---------------------------------------------------------------------------

def test_shared_detection_accepts_every_supported_file_shape():
    course = SimpleNamespace(title="Data Analytics with Excel", description="")
    assert course_is_excel(course) is True
    assert course_is_excel(SimpleNamespace(title="World History", description="")) is False

    payload = json.dumps([
        {"name": "analysis.XLSX", "url": "memory://analysis.XLSX"},
        {"file_name": "notes.docx", "url": "memory://notes.docx"},
    ])
    assert has_excel_files(payload) is True
    assert has_excel_files("https://cdn.test/sheet.xlsm?signature=abc") is True
    assert has_excel_files("https://cdn.test/notes.pdf") is False
    assert has_excel_files(None) is False


def test_native_spreadsheet_evaluator_uses_retained_bytes_and_real_evidence(monkeypatch):
    legacy_calls = []
    _forbid_legacy(monkeypatch, legacy_calls)
    evaluator = SpreadsheetEvaluator()
    ctx = _context()

    assert evaluator.is_compatible(ctx) is True
    output = evaluator.evaluate(ctx, _criteria())

    assert evaluator.name == "spreadsheet"
    assert evaluator.version == "2.0.0"
    assert legacy_calls == []
    assert {"workbook", "formulas"}.issubset(set(output.analysis["analyzers"]))
    assert output.analysis["spec"]["requirement_count"] >= 5
    assert output.analysis["workbook"]["name"] == "sales.xlsx"
    assert "statically" in output.analysis["limitation"]

    marks = {row.criterion_key: row for row in output.criteria}
    assert marks["formulas"].marks > 0
    assert all(row.marks <= row.max_marks for row in output.criteria)
    assert marks["formulas"].evaluator_name == "spreadsheet"
    assert marks["formulas"].evaluator_version == "2.0.0"

    evidence = [item for row in output.criteria for item in row.evidence]
    assert evidence, "deterministic observations must produce evidence"
    assert {item["reference"] for item in evidence} <= {
        "sales.xlsx", "written response",
    }
    assert not any(str(item["reference"]).startswith("excel_category:")
                   for item in evidence)


def test_native_evaluator_degrades_closed_workbook_without_legacy_fallback(monkeypatch):
    legacy_calls = []
    _forbid_legacy(monkeypatch, legacy_calls)
    output = SpreadsheetEvaluator().evaluate(
        _context(data=b"this is not a workbook"), _criteria())

    assert legacy_calls == []
    assert any("workbook" in warning.lower() for warning in output.warnings)
    assert output.analysis["workbook"]["error"]
    assert all(row.marks == 0 for row in output.criteria)
    assert all(row.evidence_category == "UNVERIFIED" for row in output.criteria)
    assert "statically" in output.analysis["limitation"]


def test_native_evaluator_gives_actionable_feedback_for_partial_workbook(monkeypatch):
    legacy_calls = []
    _forbid_legacy(monkeypatch, legacy_calls)
    output = SpreadsheetEvaluator().evaluate(
        _context(data=_workbook_bytes(formula_count=1)), _criteria())

    formula_criterion = next(row for row in output.criteria
                             if row.criterion_key == "formulas")
    assert 0 < formula_criterion.marks < formula_criterion.max_marks
    assert formula_criterion.feedback or output.improvements
    assert any(item["reference"] == "sales.xlsx"
               for item in formula_criterion.evidence)


def test_manual_review_requirement_stays_unverified(monkeypatch):
    legacy_calls = []
    _forbid_legacy(monkeypatch, legacy_calls)
    criteria = [{
        "criterion_key": "documentation", "key": "documentation",
        "name": "Written explanation", "max_marks": 40, "weight": 100,
        "is_required": True, "order_index": 0,
    }]
    output = SpreadsheetEvaluator().evaluate(_context(
        instructions="Explain why the Data Model is better than VLOOKUP merging.",
        criteria=criteria,
    ), criteria)

    criterion = output.criteria[0]
    assert criterion.marks == 0
    assert criterion.evidence_category == "UNVERIFIED"
    assert any("instructor review" in warning.lower() for warning in output.warnings)


# ---------------------------------------------------------------------------
# HTTP dispatch: one engine for every assignment/project submission
# ---------------------------------------------------------------------------

def test_unified_start_enqueues_aage_for_spreadsheet_submission(
        app, client, env, monkeypatch):
    queued = []
    monkeypatch.setattr(aage_routes, "uses_excel_grader", lambda *a, **k: True)
    monkeypatch.setattr(aage_routes.jobs, "active_job", lambda *a, **k: None)
    monkeypatch.setattr(
        aage_routes.jobs, "enqueue_grade_job",
        lambda **kwargs: (queued.append(kwargs)
                          or _fake_job(201, "assignment", env["submission"].id)),
    )
    monkeypatch.setattr(
        ExcelGradingService, "grade_submission",
        lambda *a, **k: pytest.fail("Excel engine must not be selected"),
    )

    response = client.post(
        "/api/v1/aage/grading/unified/start",
        json={"submission_type": "assignment",
              "submission_id": env["submission"].id},
        headers=_auth(app, env["instructor"]),
    )
    assert response.status_code == 201
    body = response.get_json()["data"]
    assert body["engine"] == "aage"
    assert body["specialist"] == "spreadsheet"
    assert body["job"]["id"] == 201
    assert queued[0]["submission_id"] == env["submission"].id
    assert queued[0]["course_id"] == env["course"].id


def test_direct_grading_start_accepts_spreadsheet_submission(app, client, env,
                                                             monkeypatch):
    queued = []
    monkeypatch.setattr(aage_routes.jobs, "active_job", lambda *a, **k: None)
    monkeypatch.setattr(
        aage_routes.jobs, "enqueue_grade_job",
        lambda **kwargs: (queued.append(kwargs)
                          or _fake_job(202, "assignment", env["submission"].id)),
    )

    response = client.post(
        "/api/v1/aage/grading/start",
        json={"submission_type": "assignment",
              "submission_id": env["submission"].id},
        headers=_auth(app, env["instructor"]),
    )
    assert response.status_code == 201
    assert response.get_json()["data"]["id"] == 202
    assert queued[0]["submission_id"] == env["submission"].id


def test_legacy_submit_enqueues_aage_for_spreadsheet(app, client, env,
                                                     monkeypatch):
    queued = []
    monkeypatch.setattr(
        student_routes, "enqueue_for_submission",
        lambda **kwargs: (queued.append(kwargs)
                          or _fake_job(303, "assignment", 0)),
    )
    with app.app_context():
        submission = AssignmentSubmission.query.get(env["submission"].id)
        db.session.delete(submission)
        db.session.commit()

    response = client.post(
        f"/api/v1/student/assignments/{env['assignment'].id}/submit",
        json={"content": "answer",
              "file_url": json.dumps([
                  {"filename": "report.xlsx", "url": "memory://report.xlsx"},
              ])},
        headers=_auth(app, env["student"]),
    )
    assert response.status_code == 201
    assert queued[0]["submission_type"] == "assignment"
    assert queued[0]["student_id"] == env["student"].id


def test_student_auto_status_hides_preliminary_aage_result(app, client, env):
    with app.app_context():
        result_id = _make_aage_result(env, score=20.0).id

    url = (f"/api/v1/excel-grading/auto-grade-status/{env['submission'].id}"
           "?submission_type=assignment")
    headers = _auth(app, env["student"])
    pending = client.get(url, headers=headers)
    assert pending.status_code == 200
    body = pending.get_json()
    assert body["status"] == "pending_review"
    assert body["result_id"] is None
    assert body["percentage"] is None
    assert body["grade_letter"] is None

    with app.app_context():
        stored = EvaluationResult.query.get(result_id)
        stored.is_official = True
        stored.status = "published"
        stored.requires_review = False
        db.session.commit()

    finalised = client.get(url, headers=headers)
    assert finalised.get_json()["status"] == "completed"
    assert finalised.get_json()["percentage"] == 20.0


# ---------------------------------------------------------------------------
# Legacy endpoint compatibility shims
# ---------------------------------------------------------------------------

def test_legacy_grade_endpoint_enqueues_aage_only(app, client, env, monkeypatch):
    queued = []
    monkeypatch.setattr(excel_grading_routes.aage_jobs,
                        "active_job", lambda *a, **k: None)
    monkeypatch.setattr(
        excel_grading_routes.aage_jobs, "enqueue_grade_job",
        lambda **kwargs: (queued.append(kwargs)
                          or _fake_job(404, "assignment", env["submission"].id)),
    )

    response = client.post(
        f"/api/v1/excel-grading/grade/{env['submission'].id}",
        json={"submission_type": "assignment"},
        headers=_auth(app, env["instructor"]),
    )
    assert response.status_code == 201
    body = response.get_json()
    assert body["engine"] == "aage"
    assert body["publication"] == {"status": "pending", "engine": "aage"}
    assert queued[0]["submission_id"] == env["submission"].id
    with app.app_context():
        # Other tests in this module create legacy rows in the shared test DB.
        # The endpoint must not create one for *this* submission.
        assert ExcelGradingResult.query.filter_by(
            assignment_submission_id=env["submission"].id
        ).count() == 0


def test_legacy_result_endpoint_prefers_canonical_aage(app, client, env):
    with app.app_context():
        _make_aage_result(env, score=64.0)

    response = client.get(
        f"/api/v1/excel-grading/results/submission/{env['submission'].id}"
        "?submission_type=assignment",
        headers=_auth(app, env["instructor"]),
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["source"] == "aage"
    assert body["engine"] == "aage"
    assert body["total_score"] == 64.0
    assert body["rubric_breakdown"]["formulas"]["score"] == 64.0


def _legacy_result(env):
    return ExcelGradingResult(
        submission_type="assignment",
        assignment_submission_id=env["submission"].id,
        student_id=env["student"].id,
        course_id=env["course"].id,
        total_score=40,
        max_score=100,
        grade_letter="F",
        status="completed",
        confidence="low",
        overall_confidence=0.4,
        manual_review_required=True,
        instructor_reviewed=False,
        graded_at=now_local(),
        file_name="sales.xlsx",
        rubric_version="1.0.0",
        analysis_data={
            "requirement_results": [
                {"requirement_id": "req_001", "requirement": "HLOOKUP in E1",
                 "status": "PARTIAL", "score": 20, "max_score": 50,
                 "evidence": ["Formula found in a different cell"]},
                {"requirement_id": "req_002", "requirement": "SUMIF in E2",
                 "status": "PARTIAL", "score": 20, "max_score": 50,
                 "evidence": ["Function present"]},
            ],
        },
    )


def test_legacy_review_delegates_to_aage_review_and_learning(app, client, env,
                                                            monkeypatch):
    published = []
    monkeypatch.setattr(
        persistence, "write_through_grade",
        lambda result, **kwargs: (published.append(result.id) or True),
    )
    with app.app_context():
        legacy = _legacy_result(env)
        db.session.add(legacy)
        db.session.commit()
        legacy_id = legacy.id

    response = client.post(
        f"/api/v1/excel-grading/review/{legacy_id}",
        json={"action": "override", "adjusted_score": 80,
              "instructor_notes": "Both methods are present and labelled."},
        headers=_auth(app, env["instructor"]),
    )
    assert response.status_code == 200, response.get_data(as_text=True)
    body = response.get_json()
    assert body["engine"] == "aage"
    assert body["published"] is True
    assert body["learning_example"]["status"] == "candidate"
    assert published

    with app.app_context():
        aage_result = EvaluationResult.query.get(body["aage_result_id"])
        assert aage_result is not None
        assert aage_result.final_score == 80.0
        assert aage_result.status == "approved"
        assert GradingReview.query.get(body["review_id"]).result_id == aage_result.id
        example = LearningExample.query.get(body["learning_example"]["id"])
        assert example.instructor_scores
        assert example.original_scores
        assert example.score_delta > 0
        stored_legacy = ExcelGradingResult.query.get(legacy_id)
        assert stored_legacy.instructor_reviewed is True
        assert stored_legacy.total_score == 80


def test_auto_dispatch_ignores_legacy_excel_trigger_flag(env):
    before = GradingJob.query.count()
    job = submission_dispatch.enqueue_for_submission(
        submission_type="assignment",
        submission_id=env["submission"].id,
        student_id=env["student"].id,
        excel_grading_triggered=True,
    )
    assert job is not None
    assert job.submission_type == "assignment"
    assert job.submission_id == env["submission"].id
    assert GradingJob.query.count() == before + 1
