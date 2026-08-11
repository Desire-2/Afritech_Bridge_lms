"""Tests for the learning-loop closure and assessment parse caching.

Covers:
  - apply_calibration consuming requirement_patterns (spec 18-19)
  - analyzer reliability caps
  - score preservation (learning must never change scores)
  - manual-review escalation for critical uncertain requirements
  - build_assignment_knowledge parse cache (spec 47)
"""

import pytest

from src.services.excel_grading.learning_engine import LearningEngine
from src.services.excel_grading.assignment_intelligence import (
    build_assignment_knowledge,
    _build_cached_knowledge,
)


def _result(requirement=None):
    return {
        "total_score": 80.0,
        "max_score": 100.0,
        "percentage": 80.0,
        "grade": "B",
        "confidence": "medium",
        "overall_confidence": 0.72,
        "flagged_issues": [],
        "manual_review_required": False,
        "requirement_results": [requirement] if requirement else [],
    }


def _requirement(requirement_id="req_001", confidence=0.7, evidence_source="formula", criticality="critical"):
    return {
        "requirement_id": requirement_id,
        "requirement": "Use HLOOKUP in E1.",
        "type": "FUNCTION_REQUIREMENT",
        "evidence_source": evidence_source,
        "criticality": criticality,
        "confidence": confidence,
        "status": "SATISFIED",
        "score": 20.0,
        "max_score": 20.0,
        "evidence": [],
        "missing": [],
    }


def test_empty_insights_leave_result_unchanged():
    result = _result()
    returned = LearningEngine().apply_calibration(result, {})
    assert returned is result
    assert result["total_score"] == 80.0
    assert "learning_memory_applied" not in result


def test_consistently_satisfied_requirement_gets_confidence_boost_but_no_score_change():
    engine = LearningEngine()
    result = _result(_requirement())
    insights = {
        "requirement_patterns": {
            "req_001": {
                "samples": 10, "satisfied": 9, "partial": 1, "failed": 0,
                "manual_review": 0, "average_confidence": 0.9,
            }
        },
        "analyzer_reliability": {},
        "calibration_offset": 0.0,
        "sample_size": 10,
    }
    engine.apply_calibration(result, insights)

    req = result["requirement_results"][0]
    assert req["confidence"] == 0.93  # boosted above the 0.7 baseline
    assert any("consistently satisfied" in note for note in req["learning_memory"])
    assert any("Learning memory" in e for e in req["evidence"])
    # Scores must never be altered by learning.
    assert result["total_score"] == 80.0
    assert req["score"] == 20.0
    assert result["manual_review_required"] is False


def test_problematic_critical_requirement_triggers_manual_review():
    engine = LearningEngine()
    result = _result(_requirement())
    insights = {
        "requirement_patterns": {
            "req_001": {
                "samples": 8, "satisfied": 2, "partial": 4, "failed": 2,
                "manual_review": 0, "average_confidence": 0.45,
            }
        },
        "analyzer_reliability": {},
        "calibration_offset": 0.0,
        "sample_size": 8,
    }
    engine.apply_calibration(result, insights)

    req = result["requirement_results"][0]
    assert req["confidence"] <= 0.55
    assert result["manual_review_required"] is True
    issue_types = [i.get("type") for i in result["flagged_issues"]]
    assert "learning_memory_uncertain_requirement" in issue_types
    assert result["learning_memory_applied"]["manual_review_triggered"] == ["req_001"]


def test_low_analyzer_approval_rate_caps_confidence():
    engine = LearningEngine()
    result = _result(_requirement(confidence=0.9))
    insights = {
        "requirement_patterns": {},
        "analyzer_reliability": {
            "FormulaAnalyzer": {"reviewed": 5, "approved": 1, "overridden": 4, "approval_rate": 0.2},
        },
        "calibration_offset": 0.0,
        "sample_size": 5,
    }
    engine.apply_calibration(result, insights)

    req = result["requirement_results"][0]
    assert req["confidence"] <= 0.6
    assert any("low instructor approval rate" in note for note in req["learning_memory"])
    assert req["score"] == 20.0  # still no score change


def test_non_critical_problem_requirement_does_not_force_manual_review():
    engine = LearningEngine()
    result = _result(_requirement(criticality="minor"))
    insights = {
        "requirement_patterns": {
            "req_001": {
                "samples": 6, "satisfied": 1, "partial": 3, "failed": 2,
                "manual_review": 0, "average_confidence": 0.4,
            }
        },
        "analyzer_reliability": {},
        "calibration_offset": 0.0,
        "sample_size": 6,
    }
    engine.apply_calibration(result, insights)
    assert result["manual_review_required"] is False


def test_learning_memory_not_recorded_when_nothing_changes():
    """First-ever grade with no history must not gain learning_memory noise."""
    engine = LearningEngine()
    result = _result(_requirement())
    engine.apply_calibration(result, {})
    assert "learning_memory_applied" not in result
    assert result["requirement_results"][0]["confidence"] == 0.7
    assert result["total_score"] == 80.0


def test_legacy_confidence_hint_applies_without_requirement_results():
    """Legacy path (no requirement results) still honors the confidence hint."""
    engine = LearningEngine()
    result = _result()
    insights = {"confidence_hint": "low", "sample_size": 6}
    engine.apply_calibration(result, insights)
    assert result["confidence"] == "low"
    assert result["learning_memory_applied"]["confidence_hint"] == "low"


def test_learning_memory_applied_only_lists_adjusted_requirements():
    """Applied map contains only requirements whose confidence/notes changed."""
    engine = LearningEngine()
    result = _result(_requirement())
    insights = {
        "requirement_patterns": {
            "req_001": {
                "samples": 10, "satisfied": 9, "partial": 1, "failed": 0,
                "manual_review": 0, "average_confidence": 0.9,
            }
        },
        "analyzer_reliability": {},
        "calibration_offset": 0.0,
        "sample_size": 10,
    }
    engine.apply_calibration(result, insights)
    applied = result["learning_memory_applied"]
    assert "req_001" in applied
    assert applied["req_001"]["confidence_before"] == 0.7
    assert applied["req_001"]["confidence_after"] == 0.93
    assert applied["req_001"]["notes"]


def test_score_offset_still_applied_when_meaningful():
    engine = LearningEngine()
    result = _result()
    insights = {"calibration_offset": 4.0, "sample_size": 12}
    engine.apply_calibration(result, insights)
    assert result["total_score"] == 84.0
    assert result["calibration_applied"]["offset"] == 4.0


def test_build_assignment_knowledge_uses_parse_cache():
    context = {
        "assignment_id": 6,
        "title": "Aggregation Skills",
        "description": "",
        "instructions": "1. Use HLOOKUP in E1.\n2. Use SUMIF in E2.",
        "course_id": 1,
        "module_id": 1,
        "module_title": "Module 2",
        "points_possible": 100,
    }
    before = _build_cached_knowledge.cache_info()
    first = build_assignment_knowledge(context, report_text="# Report")
    second = build_assignment_knowledge(context, report_text="# Report")
    after = _build_cached_knowledge.cache_info()

    assert after.hits > before.hits
    assert first["source_hash"] == second["source_hash"]
    assert first["source_priority"] == "CURRENT_DATABASE_ASSIGNMENT"


def test_report_change_invalidates_parse_cache():
    context = {
        "assignment_id": 999,
        "title": "Underspecified",
        "description": "",
        "instructions": "short",  # under the 12-char threshold → report fallback
        "course_id": 1,
        "module_id": 1,
        "points_possible": 100,
    }
    a = build_assignment_knowledge(context, report_text="### 📝 Assignment 999 — Old\nDo X with SUMIF.")
    b = build_assignment_knowledge(context, report_text="### 📝 Assignment 999 — New\nDo X with XLOOKUP.")
    assert a["source_hash"] != b["source_hash"]
    assert a["source_priority"] == "REPORT_COURSE_DOCUMENTATION"
    assert b["source_priority"] == "REPORT_COURSE_DOCUMENTATION"
