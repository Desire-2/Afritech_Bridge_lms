"""Regression tests for assignment-aware Excel assessment contracts."""

import json

import pytest

from src.services.excel_grading.assignment_intelligence import (
    AssignmentKnowledge,
    RequirementEvaluator,
    STATUS_MANUAL_REVIEW,
    STATUS_PARTIAL,
    STATUS_SATISFIED,
)


def _spec(instructions, assignment_id=1, title="Test assignment"):
    return AssignmentKnowledge().build({
        "assignment_id": assignment_id,
        "title": title,
        "description": "",
        "instructions": instructions,
        "course_id": 1,
        "module_id": 1,
        "module_title": "Test module",
        "points_possible": 100,
    })


def _formula_analysis(formulas):
    return {
        "spec": {},
        "workbook": {
            "sheet_names": ["Sheet1"],
            "sheets": [{"name": "Sheet1", "formulas": formulas}],
        },
        "formulas": {}, "charts": {}, "pivots": {}, "vba": {},
        "power_query": {}, "formatting": {},
    }


def test_assignment_6_generates_one_criterion_per_required_method_and_cell():
    spec = _spec(
        """1. Use HLOOKUP to find September revenue in E1.
        2. Use SUMIF for North revenue in E2.
        3. Use COUNTIF to count transactions above 4000 in E3.
        4. Use AVERAGEIF for Software average in E4.
        5. Use wildcard COUNTIF for products ending in top in E5.""",
        assignment_id=6,
        title="Applying Essential Arithmetic and Aggregation Skills",
    )
    requirements = spec["requirements"]

    assert len(requirements) == 5
    assert [r["verification"]["expected_functions"] for r in requirements] == [
        ["HLOOKUP"], ["SUMIF"], ["COUNTIF"], ["AVERAGEIF"], ["COUNTIF"]
    ]
    assert [r["verification"]["target_cells"] for r in requirements] == [
        [{"sheet": None, "cell": "E1"}],
        [{"sheet": None, "cell": "E2"}],
        [{"sheet": None, "cell": "E3"}],
        [{"sheet": None, "cell": "E4"}],
        [{"sheet": None, "cell": "E5"}],
    ]
    assert spec["rubric"]["requirement_level"] is True


def test_enterprise_vba_assignment_has_a_different_rubric_shape():
    spec = _spec(
        """Create a Class Module CItem. Use Scripting.Dictionary for storage.
        Add Workbook_Open and Worksheet_Change events. Use On Error GoTo routines.""",
        assignment_id=21,
        title="Dynamic Data Management with Advanced VBA Architecture and Events",
    )
    types = {r["type"] for r in spec["requirements"]}

    assert spec["scope"]["scope_vba"] is True
    assert "CODE_STRUCTURE_REQUIREMENT" in types
    assert "WORKBOOK_BEHAVIOR_REQUIREMENT" in types
    assert "VBA_REQUIREMENT" in types
    assert not any(r["verification"].get("expected_functions") == ["HLOOKUP"] for r in spec["requirements"])


def test_strict_method_in_wrong_cell_is_partial_with_traceable_evidence():
    spec = _spec("Use HLOOKUP in E1.", assignment_id=6)
    analysis = _formula_analysis([{
        "cell": "E7", "sheet": "Sheet1", "formula": "=HLOOKUP(A1,A2:E5,2,FALSE)"
    }])
    analysis["spec"] = spec
    result = RequirementEvaluator().evaluate(spec, analysis)["requirement_results"][0]

    assert result["status"] == STATUS_PARTIAL
    assert result["score"] < result["max_score"]
    assert result["evidence"]
    assert result["missing"]


def test_theory_task_never_receives_automatic_full_credit():
    spec = _spec("Explain why the Data Model is better than VLOOKUP merging.")
    analysis = _formula_analysis([])
    analysis["spec"] = spec
    result = RequirementEvaluator().evaluate(spec, analysis)["requirement_results"]

    theory_results = [item for item in result if item["type"] == "THEORY_REQUIREMENT"]
    assert theory_results
    assert theory_results[0]["status"] == STATUS_MANUAL_REVIEW
    assert theory_results[0]["score"] == 0


def test_all_evidence_is_present_for_a_complete_assignment_6_submission():
    spec = _spec(
        """1. Use HLOOKUP in E1.
        2. Use SUMIF in E2.
        3. Use COUNTIF in E3.
        4. Use AVERAGEIF in E4.
        5. Use COUNTIF in E5.""",
        assignment_id=6,
    )
    formulas = [
        {"cell": "E1", "sheet": "Sheet1", "formula": "=HLOOKUP(A1,A2:E5,2,FALSE)"},
        {"cell": "E2", "sheet": "Sheet1", "formula": "=SUMIF(A:A,\"North\",B:B)"},
        {"cell": "E3", "sheet": "Sheet1", "formula": "=COUNTIF(B:B,\">4000\")"},
        {"cell": "E4", "sheet": "Sheet1", "formula": "=AVERAGEIF(A:A,\"Software\",B:B)"},
        {"cell": "E5", "sheet": "Sheet1", "formula": "=COUNTIF(A:A,\"*top\")"},
    ]
    analysis = _formula_analysis(formulas)
    analysis["spec"] = spec
    evaluation = RequirementEvaluator().evaluate(spec, analysis)

    assert evaluation["percentage"] == 100
    assert all(r["status"] == STATUS_SATISFIED for r in evaluation["requirement_results"])
    assert all(r["evidence"] for r in evaluation["requirement_results"])
    assert evaluation["manual_review_required"] is False


@pytest.mark.parametrize(
    ("assignment_id", "instructions", "scope_key", "requirement_type", "marker"),
    [
        (2, "Rename the sheet to Roster Management and add a VBA button.", "scope_vba", "WORKBOOK_BEHAVIOR_REQUIREMENT", "Roster Management"),
        (3, "Create a data-validation list and a VBA input form.", "scope_formatting", "DATA_VALIDATION_REQUIREMENT", "Data Validation"),
        (5, "Use SUM, AVERAGE, COUNT and MAX to summarize the data.", "scope_formulas", "FUNCTION_REQUIREMENT", "SUM"),
        (6, "Use HLOOKUP, SUMIF and COUNTIF in the required answer cells.", "scope_formulas", "FUNCTION_REQUIREMENT", "HLOOKUP"),
        (7, "Build a Power Query transformation in M language.", "scope_power_query", "POWER_QUERY_REQUIREMENT", "Power Query"),
        (8, "Combine Power Query with a VBA refresh macro.", "scope_power_query", "POWER_QUERY_REQUIREMENT", "Power Query"),
        (9, "Create a PivotTable and explain the business insight.", "scope_pivots", "PIVOT_REQUIREMENT", "PivotTable"),
        (10, "Create a Power Query custom column and automate refresh with VBA.", "scope_vba", "VBA_REQUIREMENT", "VBA"),
        (11, "Create a doughnut chart and a pie chart from the source data.", "scope_charts", "CHART_REQUIREMENT", "Doughnut chart"),
        (12, "Use Power Query parameters and try...otherwise error handling.", "scope_power_query", "POWER_QUERY_REQUIREMENT", "parameters"),
        (13, "Create DAX measures in the Data Model and show them in a PivotTable.", "scope_dax", "DAX_REQUIREMENT", "DAX"),
        (14, "Use NPV and IRR and explain the investment decision.", "scope_formulas", "FUNCTION_REQUIREMENT", "NPV"),
        (15, "Write a VBA macro with Option Explicit and an If...Then condition.", "scope_vba", "CODE_STRUCTURE_REQUIREMENT", "Option Explicit"),
        (16, "Use data validation and explain the control design.", "scope_formatting", "DATA_VALIDATION_REQUIREMENT", "Data Validation"),
        (17, "Run a Monte Carlo simulation using NORM.INV and calculate VaR.", "scope_formulas", "FORMULA_REQUIREMENT", "Monte Carlo"),
        (18, "Create a PivotTable and discuss the Data Model choice.", "scope_pivots", "PIVOT_REQUIREMENT", "PivotTable"),
        (19, "Create a Class Module and implement typed VBA variables.", "scope_vba", "CODE_STRUCTURE_REQUIREMENT", "Class Module"),
        (20, "Calculate NPV and provide a written interpretation.", "scope_formulas", "FUNCTION_REQUIREMENT", "NPV"),
        (21, "Create a UserForm, a Class Module, Power Query, DAX and VBA events.", "scope_vba", "CODE_STRUCTURE_REQUIREMENT", "UserForm"),
    ],
)
def test_course1_assignment_contracts_remain_assignment_specific(
    assignment_id, instructions, scope_key, requirement_type, marker
):
    spec = _spec(instructions, assignment_id=assignment_id)

    assert spec["requirements"], f"assignment {assignment_id} produced no requirements"
    assert spec["scope"][scope_key] is True
    assert spec["rubric"]["requirement_level"] is True
    assert any(item["type"] == requirement_type for item in spec["requirements"])
    assert marker.lower() in json.dumps(spec["requirements"]).lower()
