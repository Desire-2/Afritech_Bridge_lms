"""Excel-style auto-approval for AAGE.

The legacy Excel grader self-approves at confidence >= 0.7 when no manual
review, critical failure or unverified evidence was recorded. AAGE's default
publication track must behave the same way while still blocking real failures.
"""

from types import SimpleNamespace

import pytest

from src.models.aage_models import EvaluationResult, GradingJob, GradingReview
from src.models.user_models import db
from src.services.aage import auto_approval, jobs, orchestrator, persistence, policies
from src.services.aage.artifacts import ArtifactManifest, ExtractedFile
from src.services.aage.constants import (
    AUTO_APPROVE_NOTE, CONFIDENCE_AUTO_APPROVE_MIN, DEFAULT_CONFIDENCE_POLICY,
)
from src.services.aage.evaluators.base import BaseEvaluator
from src.services.aage.evidence import EvidenceValidator

from test_aage_api import _auth, env  # noqa: F401 - pytest fixtures/helpers


DEFAULT_POLICY = dict(DEFAULT_CONFIDENCE_POLICY)


def _result(**overrides):
    values = {
        "confidence": 80.0,
        "rubric_snapshot": {"status": "approved"},
        "review_reason": "",
        "confidence_factors": {},
        "limitations": [],
        "run_id": None,
        "ai_provider": None,
        "evaluator_versions": None,
        "criteria": SimpleNamespace(all=lambda: []),
        "evidence": SimpleNamespace(all=lambda: []),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def _outcome(result, **overrides):
    values = {
        "ok": True,
        "budget_exhausted": False,
        "result_id": result.id,
        "final_score": result.final_score,
        "confidence": result.confidence,
        "requires_review": True,
        "selected_evaluators": ["backend"],
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_defaults_follow_excel_threshold():
    assert CONFIDENCE_AUTO_APPROVE_MIN == 70.0
    assert DEFAULT_CONFIDENCE_POLICY["auto_approve_enabled"] is True
    assert DEFAULT_CONFIDENCE_POLICY["auto_approve_min"] == 70.0
    policy = policies.confidence_policy()
    assert policy["auto_approve_enabled"] is True
    assert policy["auto_approve_min"] == 70.0


def test_evidenced_result_auto_approves_despite_unverified_status():
    """CODE_SUPPORTED evidence is publishable, like the Excel grader's ratio."""
    evidence = SimpleNamespace(all=lambda: [SimpleNamespace(category="CODE_SUPPORTED")])
    approved, blockers = auto_approval.should_auto_approve(
        _result(evidence=evidence), DEFAULT_POLICY)
    assert approved is True
    assert blockers == []


def test_low_confidence_is_blocked():
    approved, blockers = auto_approval.should_auto_approve(
        _result(confidence=69.99), DEFAULT_POLICY)
    assert approved is False
    assert any(b.startswith("low_confidence") for b in blockers)


def test_unverified_driven_meta_confidence_does_not_block_publication():
    """A low AAGE score caused only by unverified criteria is not a real failure."""
    result = _result(
        confidence=43.84,
        confidence_factors={
            "factors": {
                "rubric_clarity": 1.0,
                "evidence_completeness": 0.0,
                "evidence_quality": 0.0,
                "verification_availability": 0.175,
                "evaluator_agreement": 0.75,
                "evaluator_reliability": 0.72,
                "submission_quality": 0.75,
                "calibration_history": 0.6,
            },
            "reasons": [
                "7 criterion/criteria have no supporting evidence",
                "no evidence records were produced",
                "7 criterion/criteria are unverified",
                "evaluator has no benchmark history yet",
                "missing deliverables: url",
                "no calibration data for this evaluator yet",
                "hard gate: unverified_criteria",
            ],
            "hard_gate_failures": ["unverified_criteria", "review_required"],
        },
        evidence=SimpleNamespace(
            all=lambda: [SimpleNamespace(category="CODE_SUPPORTED")]),
    )
    assert auto_approval.approval_confidence(result) >= 70.0
    approved, blockers = auto_approval.should_auto_approve(result, DEFAULT_POLICY)
    assert approved is True
    assert blockers == []


def test_poor_process_confidence_is_still_blocked():
    result = _result(
        confidence=43.84,
        confidence_factors={
            "factors": {
                "rubric_clarity": 0.4,
                "evidence_completeness": 0.0,
                "evidence_quality": 0.0,
                "verification_availability": 0.1,
                "evaluator_agreement": 0.5,
                "evaluator_reliability": 0.4,
                "submission_quality": 0.5,
                "calibration_history": 0.6,
            },
            "reasons": [
                "7 criterion/criteria are unverified",
                "no calibration data for this evaluator yet",
            ],
            "hard_gate_failures": ["unverified_criteria"],
        },
    )
    assert auto_approval.approval_confidence(result) < 70.0
    approved, blockers = auto_approval.should_auto_approve(result, DEFAULT_POLICY)
    assert approved is False
    assert any(b.startswith("low_confidence") for b in blockers)


@pytest.mark.parametrize("result_kwargs, blocker", [
    ({"rubric_snapshot": {"status": "draft"}}, "provisional_rubric"),
    ({"confidence_factors": {
        "hard_gate_failures": ["failed_deterministic_gate"]}},
     "failed_deterministic_gate"),
    ({"review_reason": "evaluator disagreement recorded"}, "unresolved_conflicts"),
    ({"evidence": SimpleNamespace(
        all=lambda: [SimpleNamespace(category="UNVERIFIED")])}, "unverified_evidence"),
])
def test_real_failures_block_auto_approval(result_kwargs, blocker):
    approved, blockers = auto_approval.should_auto_approve(
        _result(**result_kwargs), DEFAULT_POLICY)
    assert approved is False
    assert blocker in blockers


def _spreadsheet_evidence(*, substantive=True):
    rows = [SimpleNamespace(category="UNVERIFIED",
                            reference="report.xlsx")]
    if substantive:
        rows.append(SimpleNamespace(category="CODE_SUPPORTED",
                                    reference="report.xlsx"))
    return SimpleNamespace(all=lambda: rows)


def test_deterministic_spreadsheet_result_publishes_with_provisional_rubric():
    """Static-analysis results must reach students even without an approved rubric."""
    result = _result(
        confidence=48.06,
        rubric_snapshot={"status": "provisional"},
        evaluator_versions='[{"name": "spreadsheet", "version": "2.0.0"}]',
        review_reason=(
            "no approved rubric; a provisional rubric was used; "
            "3 criterion/criteria have no supporting evidence; "
            "6 criterion/criteria are unverified; "
            "missing deliverables: written_report, spreadsheet; "
            "mandatory review: rubric is not instructor-approved; "
            "hard gate: provisional_rubric; hard gate: unverified_criteria; "
            "hard gate: unverified_evidence"
        ),
        limitations=[
            "provisional rubric — no approved rubric governs this grade",
            "missing declared deliverables: written_report, spreadsheet",
        ],
        confidence_factors={
            "hard_gate_failures": ["provisional_rubric", "unverified_criteria",
                                   "unverified_evidence"],
        },
        evidence=_spreadsheet_evidence(),
    )
    approved, blockers = auto_approval.should_auto_approve(result, DEFAULT_POLICY)
    assert approved is True
    assert blockers == []


def test_deterministic_spreadsheet_result_needs_real_artifact_evidence():
    result = _result(
        confidence=48.06,
        rubric_snapshot={"status": "provisional"},
        evaluator_versions=[{"name": "spreadsheet", "version": "2.0.0"}],
        evidence=_spreadsheet_evidence(substantive=False),
    )
    approved, blockers = auto_approval.should_auto_approve(result, DEFAULT_POLICY)
    assert approved is False
    assert "no_publishable_evidence" in blockers


def test_degraded_deterministic_result_is_still_blocked():
    result = _result(
        confidence=80.0,
        evaluator_versions=[{"name": "spreadsheet", "version": "2.0.0"}],
        review_reason="degraded analysis: workbook could not be read",
        evidence=_spreadsheet_evidence(),
    )
    approved, blockers = auto_approval.should_auto_approve(result, DEFAULT_POLICY)
    assert approved is False
    assert "degraded_evaluation" in blockers


def test_disabled_policy_blocks_auto_approval():
    policy = dict(DEFAULT_POLICY, auto_approve_enabled=False)
    approved, blockers = auto_approval.should_auto_approve(_result(), policy)
    assert approved is False
    assert "auto_approve_disabled" in blockers


def test_rationale_file_citation_becomes_validated_evidence():
    manifest = ArtifactManifest(source_files=[
        ExtractedFile(path="contact_form.html", name="contact_form.html",
                      data=b"<form></form>", language="HTML"),
    ])
    ctx = SimpleNamespace(files=manifest.source_files, manifest=manifest)
    validator = EvidenceValidator(manifest_paths=["contact_form.html"])
    evidence = BaseEvaluator._evidence_from_rationale(
        "The file contact_form.html uses a labelled form.", "CODE_SUPPORTED",
        validator=validator, ctx=ctx, criterion_key="html_semantics")
    assert evidence and evidence[0]["reference"] == "contact_form.html"
    assert evidence[0]["category"] == "CODE_SUPPORTED"
    assert evidence[0]["detail"]["derived_from_rationale"] is True


def test_rationale_citation_cannot_invent_a_path():
    manifest = ArtifactManifest(source_files=[
        ExtractedFile(path="real.html", name="real.html", data=b"x", language="HTML"),
    ])
    ctx = SimpleNamespace(files=manifest.source_files, manifest=manifest)
    validator = EvidenceValidator(manifest_paths=["real.html"])
    assert BaseEvaluator._evidence_from_rationale(
        "See imaginary.html for proof.", "CODE_SUPPORTED", validator=validator,
        ctx=ctx, criterion_key="c1") == []


def test_admin_policy_api_accepts_excel_approval_fields(app, client, env):
    admin = _auth(app, env["admin"])
    response = client.put(
        "/api/v1/aage/admin/policies",
        json={"auto_approve_enabled": False, "auto_approve_min": 72},
        headers=admin,
    )
    assert response.status_code == 200, response.get_data(as_text=True)
    data = response.get_json()["data"]
    assert data["auto_approve_enabled"] is False
    assert data["auto_approve_min"] == 72.0
    assert AUTO_APPROVE_NOTE
    # Restore the default so this policy write cannot affect later tests.
    restored = client.put(
        "/api/v1/aage/admin/policies",
        json={"auto_approve_enabled": True, "auto_approve_min": 70},
        headers=admin,
    )
    assert restored.status_code == 200, restored.get_data(as_text=True)


def _patch_default_policy(monkeypatch):
    """Keep the global settings row from leaking between policy tests."""
    monkeypatch.setattr(policies, "confidence_policy",
                        lambda: dict(DEFAULT_POLICY))
    monkeypatch.setattr(auto_approval, "confidence_policy",
                        lambda: dict(DEFAULT_POLICY))


def test_run_job_auto_approves_and_publishes(app, env, monkeypatch):
    """The default job path self-approves an evidenced result after success."""
    with app.app_context():
        _patch_default_policy(monkeypatch)
        result = EvaluationResult.query.get(env["result"].id)
        review = GradingReview.query.get(env["review"].id)
        job = GradingJob(
            submission_type="assignment", submission_id=env["submission"].id,
            assessment_kind="assignment", assessment_id=env["assignment"].id,
            course_id=env["course"].id, student_id=env["student"].id,
            status="queued", requested_by=env["instructor"].id,
        )
        db.session.add(job)
        db.session.commit()

        writes = []
        monkeypatch.setattr(
            orchestrator, "evaluate_submission",
            lambda *args, **kwargs: _outcome(result))
        monkeypatch.setattr(
            persistence, "write_through_grade",
            lambda row, **kwargs: writes.append((row.id, kwargs)) or True)

        finished = jobs.run_job(job)
        assert finished["status"] == "succeeded"
        assert len(writes) == 1
        assert writes[0][1]["publication_mode"] == "auto_approved"
        assert writes[0][1]["reason"] == AUTO_APPROVE_NOTE
        db.session.refresh(job)
        assert job.progress["stage"] == "published"
        assert job.progress["publication_mode"] == "auto_approved"
        assert job.progress["confidence"] == result.confidence
        assert job.progress["requires_review"] == bool(result.requires_review)
        db.session.refresh(review)
        assert review.status == "approved"


def test_run_job_auto_approves_deterministic_spreadsheet_result(
        app, env, monkeypatch):
    """A native spreadsheet result is published without instructor review."""
    with app.app_context():
        _patch_default_policy(monkeypatch)
        result = EvaluationResult.query.get(env["result"].id)
        result.confidence = 48.06
        result.rubric_snapshot = dict(result.rubric_snapshot or {},
                                      status="provisional")
        result.evaluator_versions = [
            {"name": "spreadsheet", "version": "2.0.0"}]
        result.ai_provider = None
        result.review_reason = (
            "no approved rubric; a provisional rubric was used; "
            "hard gate: provisional_rubric; hard gate: unverified_evidence"
        )
        db.session.commit()
        job = GradingJob(
            submission_type="assignment", submission_id=env["submission"].id,
            assessment_kind="assignment", assessment_id=env["assignment"].id,
            course_id=env["course"].id, student_id=env["student"].id,
            status="queued", requested_by=env["instructor"].id,
        )
        db.session.add(job)
        db.session.commit()

        writes = []
        monkeypatch.setattr(
            orchestrator, "evaluate_submission",
            lambda *args, **kwargs: _outcome(result))
        monkeypatch.setattr(
            persistence, "write_through_grade",
            lambda row, **kwargs: writes.append((row.id, kwargs)) or True)

        finished = jobs.run_job(job)
        assert finished["status"] == "succeeded"
        assert len(writes) == 1
        assert writes[0][1]["publication_mode"] == "auto_approved"
        db.session.refresh(job)
        assert job.progress["stage"] == "published"


def test_run_job_keeps_low_confidence_result_in_review(app, env, monkeypatch):
    with app.app_context():
        _patch_default_policy(monkeypatch)
        result = EvaluationResult.query.get(env["result"].id)
        result.confidence = 50.0
        review = GradingReview.query.get(env["review"].id)
        db.session.commit()
        job = GradingJob(
            submission_type="assignment", submission_id=env["submission"].id,
            assessment_kind="assignment", assessment_id=env["assignment"].id,
            course_id=env["course"].id, student_id=env["student"].id,
            status="queued", requested_by=env["instructor"].id,
        )
        db.session.add(job)
        db.session.commit()

        writes = []
        monkeypatch.setattr(
            orchestrator, "evaluate_submission",
            lambda *args, **kwargs: _outcome(result))
        monkeypatch.setattr(
            persistence, "write_through_grade",
            lambda row, **kwargs: writes.append((row.id, kwargs)) or True)

        finished = jobs.run_job(job)
        assert finished["status"] == "succeeded"
        assert writes == []
        db.session.refresh(review)
        assert review.status == "pending"
