"""Regression coverage for the Coffee Shop workbook grading gaps.

The workbook contains the requested features, but earlier static grading logic
misread UI instructions as requirements, treated example cell references as
cell values, and mapped "Workbook structure" to the formatting bucket.  These
tests keep those false negatives from returning.
"""

import json
from pathlib import Path

import pytest

from src.services.aage.artifacts import ArtifactAnalyzer, ArtifactManifest, ExtractedFile
from src.services.aage.assessment_intelligence import AssessmentDescriptor
from src.services.aage.disciplines import Classification
from src.services.aage.evaluators.base import EvaluationContext
from src.services.aage.evaluators.spreadsheet import SpreadsheetEvaluator
from src.services.excel_grading.assignment_intelligence import AssignmentKnowledge

WORKBOOK = Path(__file__).resolve().parents[2] / "Excel_Coffee_Shop_Daily_Sales_Revised.xlsx"
pytestmark = pytest.mark.skipif(
    not WORKBOOK.exists(), reason="Coffee Shop reproduction workbook is not present")

INSTRUCTIONS = """
Follow these steps carefully to create your 'Excel Coffee Shop Daily Sales' workbook:

1. Set Up Your Worksheet & Initial Data Entry:
   * Open a new Excel workbook. Rename the first sheet tab to 'Daily Sales'.
   * In cell A1, type 'Excel Coffee Shop - Daily Sales Report'.
   * In row 3, starting from column A, enter the following headers: 'Date', 'Item', 'Quantity', 'Unit Price', 'Total Sales'.
   * Enter at least 10 rows of sample sales data. Use `Tab` to move right and `Enter` to move down efficiently. Experiment with `F2` to edit a cell.
   * Use `Ctrl + Home` to quickly return to A1, and `Ctrl + End` to see your last used cell. Navigate around your data using `Ctrl + Arrow Keys`.

2. Basic Formatting & Layout:
   * Merge and Center the title 'Excel Coffee Shop - Daily Sales Report' across columns A to E. Increase its font size and make it bold. Apply a background fill color of your choice.
   * Make the column headers (Row 3) bold and center-aligned. Apply a bottom border to these headers.
   * Adjust column widths using AutoFit (double-click between column headers) to ensure all content is visible.
   * Format the 'Date' column to a short date format (e.g., '1/1/2024').
   * Format the 'Unit Price' and 'Total Sales' columns to Currency format with 2 decimal places.
   * Apply a light fill color to alternating rows of your sales data to improve readability.

3. Calculations with Formulas & AutoFill:
   * In cell E4 (under 'Total Sales'), write a formula to calculate 'Quantity' * 'Unit Price' for the first sales item (e.g., `=C4*D4`).
   * Use the Fill Handle to copy this formula down for all your sales entries. Observe how the cell references automatically adjust.
   * In a new row below your data (e.g., A14), type 'Total Revenue:'. In the adjacent cell (e.g., E14), use the SUM function to calculate the total of all 'Total Sales'.
   * In the row below (e.g., A15), type 'Average Sale:'. In the adjacent cell (e.g., E15), use the AVERAGE function to find the average 'Total Sales'.
   * In the row below (e.g., A16), type 'Number of Items Sold:'. In the adjacent cell (e.g., E16), use the COUNT function on the 'Quantity' column to count how many individual items were sold.

4. Advanced Data Manipulation & Views:
   * Fill Handle for Sequential Data: In a new column (e.g., Column G), type 'Week 1' in G4. Use the Fill Handle to drag down and generate 'Week 2', 'Week 3', etc., for at least 5 weeks. In column H, type 'Mon' in H4, then drag to fill 'Tue', 'Wed', etc.
   * Insert/Delete Rows & Columns: Insert a new column between 'Item' and 'Quantity' (Column C). Title this new column 'Category'. Enter some sample categories (e.g., 'Beverage', 'Food').
   * Freeze Panes: Select the appropriate cell so that your header row (Row 3) and the 'Date' column (Column A) remain visible when you scroll.

5. Working with Multiple Sheets & Paste Special:
   * Copy Worksheet: Create a duplicate of your 'Daily Sales' sheet. Rename the new sheet to 'Sales Summary'.
   * Paste Special - Values: On the 'Sales Summary' sheet, copy the 'Total Sales' column (Column E). Paste it into a new column (e.g., Column G) using Paste Special > Values.
   * Paste Special - Transpose: Copy the headers from Row 3 (A3:E3). Paste them onto a new sheet (add a new sheet and rename it 'Transposed Headers') using Paste Special > Transpose.

6. Absolute References (Optional Challenge - Bonus Points):
   * On your 'Daily Sales' sheet, find an empty cell (e.g., G1) and type 'Tax Rate:'. In H1, enter '0.08' (for 8% tax). Format H1 as a Percentage.
   * Add a new column after 'Total Sales' called 'Sales with Tax'. In this column, write a formula that calculates 'Total Sales' * (1 + 'Tax Rate'). Ensure that the 'Tax Rate' reference remains fixed. This requires an Absolute Reference using the F4 key.
"""

CRITERIA = [
    {"criterion_key": "formulas", "key": "formulas", "name": "Formulas",
     "description": "Correct formulas for the required calculations.",
     "max_marks": 30, "weight": 30, "evaluator_hint": "spreadsheet"},
    {"criterion_key": "structure", "key": "structure", "name": "Workbook structure",
     "description": "Named sheets, sensible layout and traceable inputs/outputs.",
     "max_marks": 15, "weight": 15, "evaluator_hint": "spreadsheet"},
    {"criterion_key": "pivots", "key": "pivots", "name": "Pivot tables & summaries",
     "description": "Pivot tables/summaries answer the stated questions.",
     "max_marks": 15, "weight": 15, "evaluator_hint": "spreadsheet"},
    {"criterion_key": "visualisation", "key": "visualisation", "name": "Charts & formatting",
     "description": "Readable charts, consistent formatting and clear presentation.",
     "max_marks": 10, "weight": 10, "evaluator_hint": "spreadsheet"},
    {"criterion_key": "automation", "key": "automation", "name": "VBA / Power Query automation",
     "description": "Macros or queries where required, working as described.",
     "max_marks": 15, "weight": 15, "evaluator_hint": "spreadsheet"},
    {"criterion_key": "validation", "key": "validation", "name": "Data validation",
     "description": "Input validation and error handling in cells.",
     "max_marks": 5, "weight": 5, "evaluator_hint": "spreadsheet"},
    {"criterion_key": "documentation", "key": "documentation", "name": "Documentation",
     "description": "Documented steps and assumptions inside the workbook.",
     "max_marks": 10, "weight": 10, "evaluator_hint": "spreadsheet"},
]


def _spec():
    return AssignmentKnowledge().build({
        "assignment_id": 14,
        "title": "Excel Coffee Shop Data Manager: Your First Spreadsheet Project",
        "description": "",
        "instructions": INSTRUCTIONS,
        "course_id": 9,
        "points_possible": 100,
    })


def _context():
    return EvaluationContext(
        descriptor=AssessmentDescriptor(
            kind="assignment", id=14,
            title="Excel Coffee Shop Data Manager: Your First Spreadsheet Project",
            description="", instructions=INSTRUCTIONS,
            course_id=9, course_title="Excel", points_possible=100.0,
        ),
        rubric={"criteria": CRITERIA},
        manifest=ArtifactManifest(
            submission_type="assignment", submission_id=13,
            files=[{"file_name": WORKBOOK.name, "path": WORKBOOK.name}],
            binary_files=[ExtractedFile(
                path=WORKBOOK.name, name=WORKBOOK.name,
                data=WORKBOOK.read_bytes(), category="data")],
        ),
        classification=Classification(discipline="spreadsheet", confidence=0.95),
    )


def test_ui_actions_and_example_locations_are_not_scored_requirements():
    spec = _spec()
    value_requirements = [r for r in spec["requirements"]
                          if r["type"] == "VALUE_REQUIREMENT"]
    expected_values = [str(value).lower()
                       for req in value_requirements
                       for value in req["verification"].get("expected", {}).get("values", [])]

    assert not any("e.g." in value for value in expected_values)
    assert not any(value.strip("$").isalnum() and any(c.isdigit() for c in value)
                   and any(c.isalpha() for c in value) for value in expected_values)
    assert not any("1 + 'tax rate" in r["requirement"].lower()
                   for r in value_requirements)
    assert not any("tab` to move" in r["requirement"].lower()
                   for r in spec["requirements"])
    assert any(step["reason"].startswith("UI/navigation")
               for step in spec["non_verifiable_steps"])
    assert any(r["type"] == "SHEET_REQUIREMENT" and "Daily Sales" in
               r["verification"]["required_sheets"] for r in spec["requirements"])
    assert any(r["type"] == "SHEET_REQUIREMENT" and "Sales Summary" in
               r["verification"]["required_sheets"] for r in spec["requirements"])


def test_workbook_structure_criterion_does_not_route_to_formatting():
    bucket = SpreadsheetEvaluator._criterion_bucket({
        "criterion_key": "structure",
        "name": "Workbook structure",
        "description": "Named sheets, sensible layout and traceable inputs/outputs.",
    })
    assert bucket == "structure"


def test_workbook_deliverable_is_detected_from_workbook_bytes():
    manifest = ArtifactManifest(
        submission_type="assignment", submission_id=13,
        files=[{"file_name": WORKBOOK.name, "path": WORKBOOK.name}],
        binary_files=[ExtractedFile(path=WORKBOOK.name, name=WORKBOOK.name,
                                    data=b"PK", category="data")],
    )
    missing = ArtifactAnalyzer._missing_deliverables(
        manifest, ["written_report", "spreadsheet"])
    assert "spreadsheet" not in missing


def test_complete_coffee_shop_workbook_is_not_under_scored():
    output = SpreadsheetEvaluator().evaluate(_context(), CRITERIA)
    marks = {c.criterion_key: (c.marks, c.max_marks) for c in output.criteria}
    score = sum(mark for mark, _ in marks.values()) / sum(
        maximum for _, maximum in marks.values()) * 100

    assert score >= 95
    assert all(mark >= maximum * 0.95 for mark, maximum in marks.values())
    assert output.analysis["requirement_summary"]["critical_failures"] == []
    assert output.analysis["requirement_summary"]["manual_review_required"] is False
    assert output.analysis["criterion_mapping"]["structure"]
    assert "feature_structure" in output.analysis["criterion_mapping"]["structure"]
    assert "feature_automation" in output.analysis["criterion_mapping"]["automation"]
    assert "critical requirement not satisfied" not in " ".join(output.warnings)
    assert "e.g., E16" not in output.overall_feedback
    assert "Requested VBA construct was not confirmed" not in " ".join(
        c.feedback for c in output.criteria)
