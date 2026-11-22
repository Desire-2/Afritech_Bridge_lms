"""Unit tests for AAGE rubric criterion validation and aliases."""

from src.services.aage.rubric_intelligence import (
    normalise_criteria,
    validate_criteria,
)
from src.services.aage.schemas import rubric_weights_total


def test_normalise_criteria_accepts_orm_mark_aliases():
    criteria, warnings = normalise_criteria([
        {
            "criterion_key": "api_design",
            "name": "API design",
            "weight": 40,
            "max_points": 25,
        },
        {
            "key": "tests",
            "name": "Tests",
            "weight": 60,
            "maximum": 15,
        },
    ])

    assert warnings == []
    assert criteria[0]["key"] == "api_design"
    assert criteria[0]["criterion_key"] == "api_design"
    assert criteria[0]["max_marks"] == 25
    assert criteria[0]["max_points"] == 25
    assert criteria[1]["max_marks"] == 15
    assert rubric_weights_total(criteria) == 100.0


def test_validate_criteria_accepts_aliases_without_changing_marks():
    criteria, _ = normalise_criteria([
        {"key": "a", "name": "A", "weight": 50, "max_points": 20},
        {"key": "b", "name": "B", "weight": 50, "max_score": 30},
    ])
    assert validate_criteria(criteria) == []
    assert sum(c["max_marks"] for c in criteria) == 50


def test_validate_criteria_rejects_non_finite_numbers():
    criteria = [
        {"key": "a", "name": "A", "weight": 50, "max_marks": float("nan")},
        {"key": "b", "name": "B", "weight": float("inf"), "max_marks": 10},
    ]
    problems = validate_criteria(criteria)
    assert any("non-finite mark" in problem for problem in problems)
    assert any("non-finite weight" in problem for problem in problems)
    assert rubric_weights_total(criteria) == 50.0
