"""Assignment-aware assessment intelligence for Excel submissions.

This module is deliberately deterministic.  It turns the current assignment
record into an assessment contract and evaluates that contract against facts
returned by the existing workbook analyzers.  An LLM can be added around the
parser later, but it must not be the source of workbook evidence.

The public objects are JSON-shaped dictionaries on purpose: they can be
cached in ``GeneratedRubric`` and persisted in grading results without adding
a second serialization layer.
"""

from __future__ import annotations

import hashlib
import logging
import re
from copy import deepcopy
from functools import lru_cache
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

logger = logging.getLogger(__name__)

ASSESSMENT_ENGINE_VERSION = "2.0.0"
KNOWLEDGE_SCHEMA_VERSION = "1.0"

REQUIREMENT_TYPES = {
    "FORMULA_REQUIREMENT",
    "FUNCTION_REQUIREMENT",
    "CELL_REQUIREMENT",
    "VALUE_REQUIREMENT",
    "SHEET_REQUIREMENT",
    "STRUCTURE_REQUIREMENT",
    "FORMAT_REQUIREMENT",
    "DATA_VALIDATION_REQUIREMENT",
    "CHART_REQUIREMENT",
    "PIVOT_REQUIREMENT",
    "POWER_QUERY_REQUIREMENT",
    "DAX_REQUIREMENT",
    "VBA_REQUIREMENT",
    "CODE_STRUCTURE_REQUIREMENT",
    "BUSINESS_LOGIC_REQUIREMENT",
    "WORKBOOK_BEHAVIOR_REQUIREMENT",
    "DELIVERABLE_REQUIREMENT",
    "THEORY_REQUIREMENT",
    "REFLECTION_REQUIREMENT",
    "DOCUMENTATION_REQUIREMENT",
}

STATUS_NOT_APPLICABLE = "NOT_APPLICABLE"
STATUS_NOT_FOUND = "NOT_FOUND"
STATUS_FAILED = "FAILED"
STATUS_PARTIAL = "PARTIAL"
STATUS_SATISFIED = "SATISFIED"
STATUS_EXCEEDED = "EXCEEDED"
STATUS_MANUAL_REVIEW = "MANUAL_REVIEW"

_FUNCTIONS = (
    "AVERAGEIFS", "AVERAGEIF", "COUNTIFS", "COUNTIF", "SUMIFS", "SUMIF",
    "XLOOKUP", "HLOOKUP", "VLOOKUP", "INDEX", "MATCH", "XMATCH",
    "IFERROR", "IFNA", "NORM.INV", "NORM.DIST", "PERCENTILE.INC",
    "PERCENTILE", "SUMPRODUCT", "SEQUENCE", "FILTER", "SORT", "UNIQUE",
    "NPV", "IRR", "XNPV", "XIRR", "PMT", "LARGE", "SMALL", "T.TEST",
    "CALCULATE", "SUMX", "DIVIDE", "ALL", "DISTINCTCOUNT", "FILTER",
    "RAND", "RANDARRAY", "OFFSET", "INDIRECT", "TRIM", "CONCATENATE",
    "CONCAT", "LEFT", "RIGHT", "MID", "DATE", "SUM", "AVERAGE", "COUNT",
    "MIN", "MAX", "IF", "IFS", "AND", "OR", "NOT", "SWITCH",
)
_DAX_FUNCTIONS = {"SUM", "SUMX", "CALCULATE", "FILTER", "ALL", "DIVIDE", "DISTINCTCOUNT", "AVERAGEX", "COUNTX", "RELATED", "VALUES"}
_FUNCTION_RE = re.compile(r"(?<![A-Z0-9_.])(" + "|".join(map(re.escape, _FUNCTIONS)) + r")(?![A-Z0-9_])", re.I)
_CELL_RE = re.compile(r"(?<![A-Z0-9_])\$?([A-Z]{1,3})\$?(\d{1,7})(?![A-Z0-9_])", re.I)
_QUOTED_RE = re.compile(r"[\"']([^\"']{1,80})[\"']")

_FEATURE_RULES: Sequence[Tuple[str, str, str, str]] = (
    ("power query", "POWER_QUERY_REQUIREMENT", "PowerQuery_M", "Power Query"),
    ("m language", "POWER_QUERY_REQUIREMENT", "PowerQuery_M", "M language"),
    ("m code", "POWER_QUERY_REQUIREMENT", "PowerQuery_M", "M code"),
    ("dax", "DAX_REQUIREMENT", "DAX", "DAX"),
    ("pivot table", "PIVOT_REQUIREMENT", "PivotTables", "PivotTable"),
    ("pivottable", "PIVOT_REQUIREMENT", "PivotTables", "PivotTable"),
    ("data validation", "DATA_VALIDATION_REQUIREMENT", "Formatting", "Data Validation"),
    ("vba", "VBA_REQUIREMENT", "VBA", "VBA implementation"),
    ("drop-down", "DATA_VALIDATION_REQUIREMENT", "Formatting", "Drop-down list"),
    ("dropdown", "DATA_VALIDATION_REQUIREMENT", "Formatting", "Drop-down list"),
    ("doughnut chart", "CHART_REQUIREMENT", "Charts", "Doughnut chart"),
    ("pie chart", "CHART_REQUIREMENT", "Charts", "Pie chart"),
    ("chart", "CHART_REQUIREMENT", "Charts", "Chart"),
    ("activex", "WORKBOOK_BEHAVIOR_REQUIREMENT", "VBA", "ActiveX control"),
    ("button", "WORKBOOK_BEHAVIOR_REQUIREMENT", "VBA", "Button control"),
    ("input form", "CODE_STRUCTURE_REQUIREMENT", "VBA", "Input form"),
    ("userform", "CODE_STRUCTURE_REQUIREMENT", "VBA", "UserForm"),
    ("class module", "CODE_STRUCTURE_REQUIREMENT", "VBA", "Class Module"),
    ("dictionary", "VBA_REQUIREMENT", "VBA", "Dictionary"),
    ("file system object", "VBA_REQUIREMENT", "VBA", "FileSystemObject"),
    ("option explicit", "CODE_STRUCTURE_REQUIREMENT", "VBA", "Option Explicit"),
    ("workbook_open", "WORKBOOK_BEHAVIOR_REQUIREMENT", "VBA", "Workbook_Open event"),
    ("worksheet_change", "WORKBOOK_BEHAVIOR_REQUIREMENT", "VBA", "Worksheet_Change event"),
    ("workbook events", "WORKBOOK_BEHAVIOR_REQUIREMENT", "VBA", "Workbook events"),
    ("for...next", "CODE_STRUCTURE_REQUIREMENT", "VBA", "For...Next loop"),
    ("for next", "CODE_STRUCTURE_REQUIREMENT", "VBA", "For...Next loop"),
    ("if…then…elseif", "BUSINESS_LOGIC_REQUIREMENT", "VBA", "If...Then...ElseIf logic"),
    ("if...then...elseif", "BUSINESS_LOGIC_REQUIREMENT", "VBA", "If...Then...ElseIf logic"),
    ("if...then", "BUSINESS_LOGIC_REQUIREMENT", "VBA", "If...Then logic"),
    ("msgbox", "WORKBOOK_BEHAVIOR_REQUIREMENT", "VBA", "MsgBox"),
    ("screenupdating", "WORKBOOK_BEHAVIOR_REQUIREMENT", "VBA", "ScreenUpdating"),
    ("error handling", "CODE_STRUCTURE_REQUIREMENT", "VBA", "Error handling"),
    ("on error", "CODE_STRUCTURE_REQUIREMENT", "VBA", "On Error handling"),
    ("typed variables", "CODE_STRUCTURE_REQUIREMENT", "VBA", "Typed variables"),
    (" as long", "CODE_STRUCTURE_REQUIREMENT", "VBA", "Typed Long declarations"),
    ("commandbutton", "WORKBOOK_BEHAVIOR_REQUIREMENT", "VBA", "CommandButton event"),
    ("event procedure", "WORKBOOK_BEHAVIOR_REQUIREMENT", "VBA", "Event procedure"),
    ("linked text box", "WORKBOOK_BEHAVIOR_REQUIREMENT", "Charts", "Linked text box"),
    ("hidden calculations", "STRUCTURE_REQUIREMENT", "Completeness", "Hidden calculation sheet"),
    ("tab color", "FORMAT_REQUIREMENT", "Formatting", "Worksheet tab color"),
    ("fill handle", "WORKBOOK_BEHAVIOR_REQUIREMENT", "Completeness", "Fill Handle"),
    ("flash fill", "WORKBOOK_BEHAVIOR_REQUIREMENT", "Completeness", "Flash Fill"),
    ("keyboard shortcut", "WORKBOOK_BEHAVIOR_REQUIREMENT", "Completeness", "Keyboard shortcut"),
    ("undo/redo", "WORKBOOK_BEHAVIOR_REQUIREMENT", "Completeness", "Undo/Redo"),
    ("undo and redo", "WORKBOOK_BEHAVIOR_REQUIREMENT", "Completeness", "Undo/Redo"),
    ("input message", "DATA_VALIDATION_REQUIREMENT", "Formatting", "Data Validation input message"),
    ("error alert", "DATA_VALIDATION_REQUIREMENT", "Formatting", "Data Validation error alert"),
    ("whole number", "DATA_VALIDATION_REQUIREMENT", "Formatting", "Whole-number validation"),
    ("text length", "DATA_VALIDATION_REQUIREMENT", "Formatting", "Text-length validation"),
    ("acceptable product categories", "DATA_VALIDATION_REQUIREMENT", "Formatting", "Category validation source"),
    ("custom column", "POWER_QUERY_REQUIREMENT", "PowerQuery_M", "Power Query custom column"),
    ("conditional logic", "POWER_QUERY_REQUIREMENT", "PowerQuery_M", "Power Query conditional logic"),
    ("query parameter", "POWER_QUERY_REQUIREMENT", "PowerQuery_M", "Power Query parameter"),
    ("parameters", "POWER_QUERY_REQUIREMENT", "PowerQuery_M", "Power Query parameters"),
    ("try…otherwise", "POWER_QUERY_REQUIREMENT", "PowerQuery_M", "try...otherwise"),
    ("try...otherwise", "POWER_QUERY_REQUIREMENT", "PowerQuery_M", "try...otherwise"),
    ("record.fieldordefault", "POWER_QUERY_REQUIREMENT", "PowerQuery_M", "Record.FieldOrDefault"),
    ("cvar", "FORMULA_REQUIREMENT", "Formulas", "CVaR"),
    ("value at risk", "FORMULA_REQUIREMENT", "Formulas", "VaR"),
    ("var", "FORMULA_REQUIREMENT", "Formulas", "VaR"),
    ("iterations", "FORMULA_REQUIREMENT", "Formulas", "Simulation iterations"),
    ("named range", "STRUCTURE_REQUIREMENT", "Formatting", "Named range"),
    ("named table", "STRUCTURE_REQUIREMENT", "Formatting", "Named table"),
    ("sensitivity table", "FORMULA_REQUIREMENT", "Formulas", "Sensitivity table"),
    ("monte carlo", "FORMULA_REQUIREMENT", "Formulas", "Monte Carlo simulation"),
    ("data model", "STRUCTURE_REQUIREMENT", "PivotTables", "Data Model"),
    ("solver", "WORKBOOK_BEHAVIOR_REQUIREMENT", "Completeness", "Solver"),
)

_VERBS = re.compile(
    r"\b(create|build|calculate|use|apply|insert|rename|format|configure|explain|"
    r"analy[sz]e|interpret|demonstrate|implement|design|compare|submit|add|set up|"
    r"develop|write|generate|load|extract|apply|run|define|declare|write)\b",
    re.I,
)
_STRICT_MARKERS = re.compile(r"\b(must|required|required method|exactly|strictly|use|using|with|via)\b", re.I)
_PREFERRED_MARKERS = re.compile(r"\b(preferred|preferably|ideally|recommended)\b", re.I)
_THEORY_MARKERS = re.compile(r"\b(explain|justify|describe|reflection|discuss|compare|why|interpret|outline)\b", re.I)
_DELIVERABLE_MARKERS = re.compile(r"\b(submit|upload|share|report|written|deliverable|file|link)\b", re.I)


def _clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _normalise_function(value: str) -> str:
    return value.upper().replace(" ", "")


def _hash_payload(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _split_instruction_units(text: str) -> List[str]:
    """Split instructions without losing bullet/numbered task boundaries."""
    units: List[str] = []
    for raw in re.split(r"\n+|(?<=[.!?])\s+(?=[A-Z0-9\"'])", text or ""):
        value = _clean(re.sub(r"^\s*(?:[-*•]|\d+[.)]|[A-Z][.)])\s*", "", raw))
        if len(value) >= 8:
            units.append(value)
    return units


def _extract_cells(text: str) -> List[str]:
    return list(dict.fromkeys([f"{m.group(1).upper()}{m.group(2)}" for m in _CELL_RE.finditer(text or "")]))


def _extract_functions(text: str) -> List[str]:
    found: List[str] = []
    raw = text or ""
    ambiguous = {"SUM", "AVERAGE", "COUNT", "MIN", "MAX", "IF", "AND", "OR", "NOT"}
    for match in _FUNCTION_RE.finditer(raw):
        token = _normalise_function(match.group(1))
        after = raw[match.end():]
        before = raw[max(0, match.start() - 16):match.start()]
        # Ordinary prose contains words such as "count", "if", and "and".
        # Treat ambiguous short names as functions only when written in the
        # conventional uppercase form or followed by an opening parenthesis.
        # Other names that are also English verbs (notably Calculate) are
        # accepted in lowercase only when introduced as a method.
        introduced_as_method = bool(re.search(r"\b(use|using|via|function|with)\s*$", before, re.I))
        if not re.match(r"\s*\(", after) and match.group(1) != match.group(1).upper() and not introduced_as_method:
            continue
        found.append(token)
    return list(dict.fromkeys(found))


def _extract_sheets(text: str) -> List[str]:
    names: List[str] = []
    patterns = (
        r"(?:sheet|worksheet|tab)\s+(?:named?|called?|titled?)?\s*[\"']([^\"']+)[\"']",
        r"(?:rename\s+(?:Sheet\d+|sheet\s*\d*)\s+to|sheet\s+named)\s*[\"']?([A-Za-z0-9_][A-Za-z0-9 _-]{1,50})[\"']?",
        r"[\"']([^\"']+)[\"']\s*!",
    )
    for pattern in patterns:
        for match in re.finditer(pattern, text or "", re.I):
            name = _clean(match.group(1)).rstrip(".,;:")
            if name and name.lower() not in {n.lower() for n in names}:
                names.append(name)
    return names


def _extract_constraints(text: str) -> List[str]:
    """Extract small, auditable semantic constraints from a task sentence."""
    constraints = list(_QUOTED_RE.findall(text or ""))
    constraints.extend(re.findall(r"(?:>=|<=|>|<)\s*\$?\d+(?:\.\d+)?", text or ""))
    for match in re.finditer(r"\b(?:for|category|ending in|equal to|named)\s+(?:the\s+)?([A-Za-z][A-Za-z0-9_-]{1,30})", text or "", re.I):
        candidate = match.group(1)
        if candidate.lower() not in {"the", "transactions", "products", "revenue", "average", "total"}:
            constraints.append(candidate)
    normalised = []
    for value in constraints:
        cleaned = _clean(value)
        if cleaned:
            normalised.append(re.sub(r"[\s$]", "", cleaned))
    return list(dict.fromkeys(normalised))[:8]


def _has_any(text: str, values: Iterable[str]) -> bool:
    lowered = (text or "").lower()
    return any(value.lower() in lowered for value in values)


def _infer_method_constraint(text: str) -> str:
    if _PREFERRED_MARKERS.search(text or ""):
        return "preferred"
    if _STRICT_MARKERS.search(text or ""):
        return "strict"
    return "flexible"


def _infer_criticality(text: str, requirement_type: str) -> str:
    lowered = (text or "").lower()
    if _has_any(lowered, ("must", "required", "critical", "learning objective", "option explicit", "error handling")):
        return "critical"
    if requirement_type in {"FUNCTION_REQUIREMENT", "FORMULA_REQUIREMENT", "VBA_REQUIREMENT", "CODE_STRUCTURE_REQUIREMENT", "BUSINESS_LOGIC_REQUIREMENT", "DAX_REQUIREMENT", "POWER_QUERY_REQUIREMENT"}:
        return "major"
    if requirement_type in {"FORMAT_REQUIREMENT", "DELIVERABLE_REQUIREMENT"}:
        return "minor"
    return "normal"


def _category_for_type(requirement_type: str) -> str:
    return {
        "FORMULA_REQUIREMENT": "Formulas",
        "FUNCTION_REQUIREMENT": "Formulas",
        "CELL_REQUIREMENT": "Completeness",
        "VALUE_REQUIREMENT": "Completeness",
        "SHEET_REQUIREMENT": "Completeness",
        "STRUCTURE_REQUIREMENT": "Completeness",
        "FORMAT_REQUIREMENT": "Formatting",
        "DATA_VALIDATION_REQUIREMENT": "Formatting",
        "CHART_REQUIREMENT": "Charts",
        "PIVOT_REQUIREMENT": "PivotTables",
        "POWER_QUERY_REQUIREMENT": "PowerQuery_M",
        "DAX_REQUIREMENT": "DAX",
        "VBA_REQUIREMENT": "VBA",
        "CODE_STRUCTURE_REQUIREMENT": "VBA",
        "BUSINESS_LOGIC_REQUIREMENT": "VBA",
        "WORKBOOK_BEHAVIOR_REQUIREMENT": "VBA",
        "DELIVERABLE_REQUIREMENT": "Deliverables",
        "THEORY_REQUIREMENT": "Theory",
        "REFLECTION_REQUIREMENT": "Theory",
        "DOCUMENTATION_REQUIREMENT": "Documentation",
    }.get(requirement_type, "Completeness")


def _evidence_type_for(requirement_type: str) -> str:
    if requirement_type in {"FORMULA_REQUIREMENT", "FUNCTION_REQUIREMENT", "CELL_REQUIREMENT", "VALUE_REQUIREMENT"}:
        return "formula" if requirement_type != "VALUE_REQUIREMENT" else "cell_value"
    if requirement_type == "SHEET_REQUIREMENT":
        return "worksheet"
    if requirement_type in {"VBA_REQUIREMENT", "CODE_STRUCTURE_REQUIREMENT", "BUSINESS_LOGIC_REQUIREMENT", "WORKBOOK_BEHAVIOR_REQUIREMENT"}:
        return "vba_code"
    if requirement_type == "POWER_QUERY_REQUIREMENT":
        return "m_code"
    if requirement_type == "DAX_REQUIREMENT":
        return "dax_measure"
    if requirement_type == "CHART_REQUIREMENT":
        return "chart"
    if requirement_type == "PIVOT_REQUIREMENT":
        return "pivot"
    if requirement_type in {"THEORY_REQUIREMENT", "REFLECTION_REQUIREMENT", "DOCUMENTATION_REQUIREMENT", "DELIVERABLE_REQUIREMENT"}:
        return "written_evidence"
    return "workbook_structure"


def _partial_credit_for(requirement_type: str) -> Dict[str, float]:
    if requirement_type in {"FORMULA_REQUIREMENT", "FUNCTION_REQUIREMENT"}:
        return {"method": 0.35, "location": 0.2, "references": 0.2, "result": 0.15, "syntax": 0.1}
    if requirement_type in {"VBA_REQUIREMENT", "CODE_STRUCTURE_REQUIREMENT", "BUSINESS_LOGIC_REQUIREMENT"}:
        return {"presence": 0.3, "structure": 0.25, "behavior": 0.3, "safety": 0.15}
    if requirement_type == "CHART_REQUIREMENT":
        return {"type": 0.5, "location": 0.15, "configuration": 0.35}
    if requirement_type in {"THEORY_REQUIREMENT", "REFLECTION_REQUIREMENT", "DELIVERABLE_REQUIREMENT", "DOCUMENTATION_REQUIREMENT"}:
        return {"written_review": 1.0}
    return {"presence": 0.7, "configuration": 0.3}


class AssignmentInstructionParser:
    """Parse database assignment text into a reusable assessment contract."""

    def parse(self, context: Dict[str, Any], report_text: str = "") -> Dict[str, Any]:
        title = _clean(context.get("title"))
        description = _clean(context.get("description"))
        # Keep line breaks in instructions: numbered/bulleted lines are task
        # boundaries and are lost if the text is normalised too early.
        instructions = str(context.get("instructions") or "").strip()
        # Assignment instructions are authoritative.  Description supplements
        # them only when the instructions are empty or too short.
        primary_text = instructions if len(instructions) >= 12 else description
        report_fallback_used = False
        if len(primary_text) < 12 and report_text:
            report_section = self._report_section(report_text, context.get("assignment_id"), title)
            if report_section:
                primary_text = report_section
                report_fallback_used = True
        units = _split_instruction_units(primary_text)
        requirements: List[Dict[str, Any]] = []
        seen: set = set()

        def add_requirement(
            text: str,
            requirement_type: str,
            *,
            function: Optional[str] = None,
            cells: Optional[List[str]] = None,
            sheets: Optional[List[str]] = None,
            expected: Optional[Any] = None,
            evidence_type: Optional[str] = None,
            category: Optional[str] = None,
            method_constraint: Optional[str] = None,
            manual: bool = False,
        ) -> None:
            text = _clean(text)
            if not text or requirement_type not in REQUIREMENT_TYPES:
                return
            function = _normalise_function(function) if function else None
            key = (requirement_type, function, tuple(cells or []), tuple(sheets or []), text.lower())
            if key in seen:
                return
            seen.add(key)
            req_id = f"req_{len(requirements) + 1:03d}"
            target_cells = [{"sheet": (sheets[0] if sheets else None), "cell": c} for c in (cells or [])]
            requirement = {
                "id": req_id,
                "requirement": text,
                "source_text": text,
                "type": requirement_type,
                "category": category or _category_for_type(requirement_type),
                "evidence_source": evidence_type or _evidence_type_for(requirement_type),
                "expected_behavior": text,
                "verification": {
                    "type": evidence_type or _evidence_type_for(requirement_type),
                    "expected_functions": [function] if function else [],
                    "target_cells": target_cells,
                    "required_sheets": sheets or [],
                    "expected": expected,
                },
                "method_constraint": method_constraint or _infer_method_constraint(text),
                "criticality": _infer_criticality(text, requirement_type),
                "partial_credit": _partial_credit_for(requirement_type),
                "failure_conditions": ["Required evidence was not found or cannot be verified automatically."],
                "depends_on": [],
                "manual_review": manual,
            }
            requirements.append(requirement)

        for unit in units:
            functions = _extract_functions(unit)
            cells = _extract_cells(unit)
            sheets = _extract_sheets(unit)
            formula_literals = re.findall(r"=\s*[A-Za-z0-9_$:+*/(). <>\-]{2,80}", unit)
            parenthetical_values: List[str] = []
            for group in re.findall(r"\(([^()]{3,240})\)", unit):
                if any(marker in unit.lower() for marker in ("header", "record", "employee", "column", "category")):
                    parenthetical_values.extend(re.split(r"\s*[;,]\s*|\s+/\s+", group))
            is_theory = bool(_THEORY_MARKERS.search(unit))
            is_deliverable = bool(_DELIVERABLE_MARKERS.search(unit))
            matched_feature = False

            # Explicit function mentions are always separate measurable
            # requirements. This prevents method-specific work from becoming
            # one generic "formulas" criterion.
            contextual_text = " ".join(str(context.get(key) or "") for key in ("title", "description", "instructions")).lower()
            for function in functions:
                function_text = f"Use {function} as specified: {unit}"
                function_type = "DAX_REQUIREMENT" if function in _DAX_FUNCTIONS and (
                    "dax" in contextual_text or "measure" in unit.lower() or "power pivot" in contextual_text
                ) else "FUNCTION_REQUIREMENT"
                add_requirement(
                    function_text,
                    function_type,
                    function=function,
                    cells=cells,
                    sheets=sheets,
                    expected={"function": function, "target_cells": cells, "constraints": _extract_constraints(unit)},
                    category="DAX" if function_type == "DAX_REQUIREMENT" else None,
                    method_constraint=_infer_method_constraint(unit),
                )

            if formula_literals and not functions:
                for formula in formula_literals[:3]:
                    add_requirement(
                        f"Use the required formula {formula.strip()}: {unit}",
                        "FORMULA_REQUIREMENT",
                        cells=cells,
                        sheets=sheets,
                        expected={"formula": formula.strip(), "target_cells": cells},
                        method_constraint=_infer_method_constraint(unit),
                    )

            if parenthetical_values:
                values = [value.strip() for value in parenthetical_values if value.strip()]
                add_requirement(
                    f"Required values/labels: {', '.join(values)}",
                    "VALUE_REQUIREMENT",
                    cells=cells,
                    sheets=sheets,
                    expected={"values": values},
                )

            # Explicit sheet/cell/value contracts.
            if sheets:
                for sheet in sheets:
                    add_requirement(f"Use worksheet '{sheet}': {unit}", "SHEET_REQUIREMENT", sheets=[sheet])
            if cells and not functions:
                add_requirement(unit, "CELL_REQUIREMENT", cells=cells, sheets=sheets, expected={"target_cells": cells})

            # Features are only emitted when the assignment actually names
            # them.  Feature evidence is then delegated to the right analyzer.
            feature_scan = unit.lower().replace("…", "...").replace("–", "-")
            feature_scan = re.sub(r"data[\s-]+validation", "data validation", feature_scan)
            for keyword, req_type, category, label in _FEATURE_RULES:
                if keyword == "if...then" and "elseif" in feature_scan:
                    continue
                if keyword == "chart" and ("doughnut chart" in feature_scan or "pie chart" in feature_scan):
                    continue
                keyword_match = (
                    re.search(r"(?<![A-Za-z0-9_])" + re.escape(keyword.strip()) + r"(?![A-Za-z0-9_])", feature_scan, re.I)
                    if keyword.strip() in {"var", "cvar"}
                    else keyword in feature_scan
                )
                if keyword_match:
                    matched_feature = True
                    feature_text = f"{label} requirement: {unit}"
                    add_requirement(
                        feature_text,
                        req_type,
                        cells=cells,
                        sheets=sheets,
                        expected={"feature": label},
                        category=category,
                        method_constraint=_infer_method_constraint(unit),
                        manual=False,
                    )

            if is_theory:
                add_requirement(
                    unit,
                    "REFLECTION_REQUIREMENT" if "reflection" in unit.lower() else "THEORY_REQUIREMENT",
                    expected={"concepts": self._extract_concepts(unit)},
                    manual=True,
                )
            validation_terms = ("between", "text length", "input message", "error alert", "drop-down", "dropdown", "characters")
            if any(term in unit.lower() for term in validation_terms) and not any(
                r.get("type") == "DATA_VALIDATION_REQUIREMENT" and unit.lower() in r.get("source_text", "").lower() for r in requirements
            ):
                add_requirement(
                    unit,
                    "DATA_VALIDATION_REQUIREMENT",
                    expected={"rule": unit},
                )
            if any(term in unit.lower() for term in ("high commission", "standard commission", "needs review", "green", "blue", "red")):
                if not any(
                    r.get("type") == "BUSINESS_LOGIC_REQUIREMENT" and unit.lower() in r.get("source_text", "").lower()
                    for r in requirements
                ):
                    add_requirement(
                        unit,
                        "BUSINESS_LOGIC_REQUIREMENT",
                        expected={"logic": unit},
                    )
            elif is_deliverable and not functions and not sheets and not cells:
                add_requirement(unit, "DELIVERABLE_REQUIREMENT", expected={"deliverable": unit}, manual=True)

            # Business-logic statements with thresholds/labels need their own
            # contract even when there is no named Excel function.
            if (">=" in unit or "<=" in unit or "otherwise" in unit.lower()) and not functions:
                add_requirement(unit, "BUSINESS_LOGIC_REQUIREMENT", expected={"logic": unit})

            # Generic practical task: preserve an instruction when it names a
            # concrete object but no vocabulary rule matched it.
            if not functions and not sheets and not cells and not is_theory and not is_deliverable and not matched_feature:
                if _VERBS.search(unit) and len(unit.split()) >= 4:
                    add_requirement(unit, "STRUCTURE_REQUIREMENT", expected={"task": unit})

        if not requirements:
            add_requirement(
                "Assignment instructions are insufficient for deterministic workbook grading.",
                "DOCUMENTATION_REQUIREMENT",
                expected={"reason": "No measurable workbook requirement was extracted."},
                manual=True,
            )

        # Some workbook contracts are expressed as standalone quoted sheet
        # names or values.  Keep named sheets unique and useful to consumers.
        required_sheets: List[str] = []
        for req in requirements:
            required_sheets.extend(req["verification"].get("required_sheets", []))
        required_sheets = list(dict.fromkeys(required_sheets))

        # Dependencies: explicit data-model / relationship requirements should
        # precede pivots and reports, but remain data-driven rather than ID-based.
        prior_by_signal: Dict[str, str] = {}
        for req in requirements:
            text_lower = req["requirement"].lower()
            if "data model" in text_lower or "relationship" in text_lower:
                prior_by_signal.setdefault("model", req["id"])
            if "pivot" in text_lower or "variance report" in text_lower:
                if prior_by_signal.get("model"):
                    req["depends_on"].append(prior_by_signal["model"])
            if "event" in text_lower and prior_by_signal.get("vba"):
                req["depends_on"].append(prior_by_signal["vba"])
            if req["category"] == "VBA" and not prior_by_signal.get("vba"):
                prior_by_signal["vba"] = req["id"]

        complexity = self._complexity(requirements, primary_text)
        level = self._difficulty(complexity)
        for req in requirements:
            req["weight_hint"] = self._weight_hint(req)
        rubric = self._build_rubric(requirements, float(context.get("points_possible") or 100))
        assignment_id = context.get("assignment_id")
        source_payload = "|".join([
            str(assignment_id or ""), title, description, instructions, primary_text,
            str(context.get("module_id") or ""), str(context.get("course_id") or ""),
            str(context.get("course_title") or ""),
        ])
        source_hash = _hash_payload(source_payload)

        return {
            "schema_version": KNOWLEDGE_SCHEMA_VERSION,
            "engine_version": ASSESSMENT_ENGINE_VERSION,
            "assignment_id": assignment_id,
            "title": title,
            "description": description,
            "instructions": instructions,
            "knowledge_text": primary_text,
            "source_priority": "REPORT_COURSE_DOCUMENTATION" if report_fallback_used else "CURRENT_DATABASE_ASSIGNMENT",
            "source_hash": source_hash,
            "identity": {
                "assignment_id": assignment_id,
                "title": title,
                "course_id": context.get("course_id"),
                "course_title": context.get("course_title", ""),
                "module_id": context.get("module_id"),
                "module_title": context.get("module_title", ""),
                "mastery_level": level["level"],
            },
            "requirements": requirements,
            "required_sheets": required_sheets,
            "required_functions": list(dict.fromkeys(r["verification"]["expected_functions"][0] for r in requirements if r["verification"].get("expected_functions"))),
            "difficulty": level,
            "complexity": complexity,
            "scope": self._scope(requirements),
            "rubric": rubric,
            "report_fallback_used": report_fallback_used,
            "report_available": bool(report_text),
            "_task_parts": len(re.findall(r"\b(?:part|section|exercise)\s*(?:\d+|[A-Z])", primary_text, re.I)) or 1,
            "_task_steps": len(units),
            "_task_theory_count": sum(1 for r in requirements if r["type"] in {"THEORY_REQUIREMENT", "REFLECTION_REQUIREMENT"}),
            "_assignment_title": title,
            "_assignment_instructions": primary_text,
            "_module_title": context.get("module_title", ""),
            "_module_order": context.get("module_order"),
        }

    @staticmethod
    def _report_section(report_text: str, assignment_id: Any, title: str) -> str:
        """Extract a report section only for an otherwise underspecified row."""
        if not report_text:
            return ""
        headings = list(re.finditer(r"^###\s+📝\s+Assignment\s+(\d+)\s+—\s+(.+)$", report_text, re.I | re.M))
        selected = None
        for index, heading in enumerate(headings):
            same_id = assignment_id is not None and heading.group(1) == str(assignment_id)
            same_title = title and heading.group(2).strip().lower() in title.lower()
            if same_id or same_title:
                end = headings[index + 1].start() if index + 1 < len(headings) else len(report_text)
                selected = report_text[heading.start():end]
                break
        return selected or ""

    @staticmethod
    def _extract_concepts(text: str) -> List[str]:
        concepts = []
        for token in re.findall(r"\b[A-Z][A-Za-z0-9_.-]{2,}\b", text or ""):
            if token.lower() not in {"The", "Use", "Explain", "Why"}:
                concepts.append(token)
        return list(dict.fromkeys(concepts))[:12]

    @staticmethod
    def _weight_hint(req: Dict[str, Any]) -> float:
        base = {"critical": 5.0, "major": 3.5, "normal": 2.0, "minor": 1.0}.get(req.get("criticality"), 2.0)
        if req.get("type") in {"THEORY_REQUIREMENT", "REFLECTION_REQUIREMENT"}:
            base += 1.0
        if req.get("verification", {}).get("target_cells"):
            base += 0.5
        if req.get("verification", {}).get("expected_functions"):
            base += 1.0
        return base

    @staticmethod
    def _complexity(requirements: List[Dict[str, Any]], text: str) -> Dict[str, Any]:
        feature_types = {r["type"] for r in requirements}
        signals = {
            "requirements": min(1.0, len(requirements) / 20),
            "dependencies": min(1.0, sum(bool(r.get("depends_on")) for r in requirements) / 5),
            "vba": 0.9 if any(r["category"] == "VBA" for r in requirements) else 0.0,
            "power_query": 0.9 if any(r["category"] == "PowerQuery_M" for r in requirements) else 0.0,
            "dax": 0.9 if any(r["category"] == "DAX" for r in requirements) else 0.0,
            "financial_statistics": 0.85 if (
                _has_any(text, ("monte carlo", "npv", "irr", "sensitivity", "solver"))
                or bool(re.search(r"\b(?:var|cvar)\b", text, re.I))
            ) else 0.0,
            "theory": min(1.0, sum(r["type"] in {"THEORY_REQUIREMENT", "REFLECTION_REQUIREMENT"} for r in requirements) / 5),
            "feature_diversity": min(1.0, len(feature_types) / 8),
        }
        signal_weights = {
            "requirements": 20, "dependencies": 12, "vba": 18,
            "power_query": 14, "dax": 14, "financial_statistics": 16,
            "theory": 3, "feature_diversity": 3,
        }
        score = round(sum(signals[name] * signal_weights[name] for name in signal_weights), 1)
        return {"score": score, "signals": signals, "requirement_count": len(requirements), "dependency_count": sum(bool(r.get("depends_on")) for r in requirements)}

    @staticmethod
    def _difficulty(complexity: Dict[str, Any]) -> Dict[str, Any]:
        score = complexity["score"]
        level = "Foundation" if score < 20 else "Intermediate" if score < 35 else "Advanced" if score < 68 else "Expert"
        signals = complexity["signals"]
        # Some domains carry intrinsic assessment complexity even when the
        # assignment is written concisely.  These are still explainable
        # signals, not module-order or assignment-ID overrides.
        if signals.get("financial_statistics", 0) >= 0.8 or (
            signals.get("dax", 0) >= 0.8 and complexity.get("requirement_count", 0) >= 4
        ):
            level = "Advanced" if level in {"Foundation", "Intermediate"} else level
        if signals.get("vba", 0) >= 0.8 and complexity.get("requirement_count", 0) >= 12:
            level = "Expert"
        confidence = round(min(0.99, 0.55 + min(0.4, complexity["requirement_count"] / 50)), 2)
        return {"level": level, "confidence": confidence, "signals": complexity["signals"]}

    @staticmethod
    def _scope(requirements: List[Dict[str, Any]]) -> Dict[str, bool]:
        categories = {r["category"] for r in requirements}
        return {
            "scope_formulas": "Formulas" in categories,
            "scope_pivots": "PivotTables" in categories,
            "scope_charts": "Charts" in categories,
            "scope_power_query": "PowerQuery_M" in categories,
            "scope_dax": "DAX" in categories,
            "scope_vba": "VBA" in categories,
            "scope_formatting": "Formatting" in categories,
        }

    @staticmethod
    def _build_rubric(requirements: List[Dict[str, Any]], points: float) -> Dict[str, Any]:
        if not requirements:
            requirements = [{
                "id": "req_001", "requirement": "Assignment evidence requires instructor review.",
                "source_text": "", "type": "DOCUMENTATION_REQUIREMENT", "category": "Documentation",
                "evidence_source": "written_evidence", "expected_behavior": "Review assignment instructions.",
                "verification": {"type": "written_evidence", "expected_functions": [], "target_cells": [], "required_sheets": [], "expected": None},
                "method_constraint": "flexible", "criticality": "critical", "partial_credit": {"written_review": 1.0},
                "failure_conditions": ["No assignment instructions were available."], "depends_on": [], "manual_review": True,
                "weight_hint": 1.0,
            }]
        total_hint = sum(float(r.get("weight_hint", 1)) for r in requirements) or 1
        criteria = []
        allocated = 0.0
        for index, req in enumerate(requirements):
            if index == len(requirements) - 1:
                max_points = round(points - allocated, 1)
            else:
                max_points = round(points * float(req.get("weight_hint", 1)) / total_hint, 1)
                allocated += max_points
            max_points = max(0.1, max_points)
            criterion = deepcopy(req)
            criterion.update({
                "name": req["requirement"][:100],
                "description": req["requirement"],
                "max_points": max_points,
            })
            criteria.append(criterion)
        return {
            "rubric_type": "assignment_specific",
            "version": ASSESSMENT_ENGINE_VERSION,
            "total_points": points,
            "criteria": criteria,
            "requirement_count": len(criteria),
            "requirement_level": True,
            "approved": False,
            "rubric_metadata": {
                "requirement_count": len(criteria),
                "theory_tasks": sum(r["type"] in {"THEORY_REQUIREMENT", "REFLECTION_REQUIREMENT"} for r in criteria),
                "manual_review_tasks": sum(bool(r.get("manual_review")) for r in criteria),
                "critical_requirements": [r["id"] for r in criteria if r.get("criticality") == "critical"],
            },
        }

    def to_requirements(self, spec: Dict[str, Any]) -> Dict[str, Any]:
        """Convert a knowledge model to legacy scope fields plus the spec."""
        result = dict(spec.get("scope", {}))
        result.update({
            "required_functions": spec.get("required_functions", []),
            "required_sheets": spec.get("required_sheets", []),
            "requirements": spec.get("requirements", []),
            "assessment_spec": spec,
            "_assignment_title": spec.get("title", ""),
            "_assignment_instructions": spec.get("knowledge_text", spec.get("instructions", "")),
            "_module_title": spec.get("identity", {}).get("module_title", ""),
            "_module_order": spec.get("_module_order"),
            "_task_parts": spec.get("_task_parts", 1),
            "_task_steps": spec.get("_task_steps", 0),
            "_task_theory_count": spec.get("_task_theory_count", 0),
            "assignment_aware": True,
        })
        # Preserve existing booleans used by the legacy engine.
        result["require_pivots"] = result.get("scope_pivots", False)
        result["require_charts"] = result.get("scope_charts", False)
        result["require_vba"] = result.get("scope_vba", False)
        result["require_power_query"] = result.get("scope_power_query", False)
        return result


class AssignmentKnowledge(AssignmentInstructionParser):
    """Named facade for callers that want the assignment knowledge model."""

    def build(self, context: Dict[str, Any], report_text: str = "") -> Dict[str, Any]:
        return self.parse(context, report_text=report_text)


_REPORT_TEXT_CACHE: Dict[str, str] = {}


def build_assignment_knowledge(context: Dict[str, Any], report_text: str = "") -> Dict[str, Any]:
    """Build a cached spec from current assignment context.

    The report text is stored under a short hash so the ``lru_cache`` key
    never carries the full document; a changed report produces a new hash
    and therefore a fresh parse.
    """
    report_hash = ""
    if report_text:
        report_hash = _hash_payload(report_text)[:32]
        if len(_REPORT_TEXT_CACHE) > 16:
            _REPORT_TEXT_CACHE.clear()
        _REPORT_TEXT_CACHE[report_hash] = report_text
    payload = "|".join(str(context.get(k, "")) for k in (
        "assignment_id", "title", "description", "instructions", "course_id", "course_title", "module_id", "module_title", "module_order", "points_possible"
    ))
    return deepcopy(_build_cached_knowledge(payload, tuple(sorted((str(k), str(v)) for k, v in context.items())), report_hash))


@lru_cache(maxsize=256)
def _build_cached_knowledge(payload: str, context_items: Tuple[Tuple[str, str], ...], report_hash: str = "") -> Dict[str, Any]:
    context = {key: value for key, value in context_items}
    return AssignmentInstructionParser().parse(context, report_text=_REPORT_TEXT_CACHE.get(report_hash, ""))


class RequirementEvaluator:
    """Evaluate requirement contracts using deterministic analyzer evidence."""

    def evaluate(self, spec: Dict[str, Any], analyses: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        requirements = spec.get("requirements", [])
        results: List[Dict[str, Any]] = []
        by_id: Dict[str, Dict[str, Any]] = {}
        for req in requirements:
            result = self._evaluate_requirement(req, analyses, by_id)
            by_id[req["id"]] = result
            results.append(result)

        max_score = round(sum(float(r.get("max_points", 0)) for r in spec.get("rubric", {}).get("criteria", [])), 1)
        total_score = round(sum(float(r.get("score", 0)) for r in results), 1)
        counts = {status: sum(r["status"] == status for r in results) for status in (
            STATUS_NOT_APPLICABLE, STATUS_NOT_FOUND, STATUS_FAILED, STATUS_PARTIAL,
            STATUS_SATISFIED, STATUS_EXCEEDED, STATUS_MANUAL_REVIEW,
        )}
        confidences = [float(r.get("confidence", 0)) for r in results]
        overall_confidence = round(sum(confidences) / max(len(confidences), 1), 2)
        critical_failures = [r["requirement_id"] for r in results if r["criticality"] == "critical" and r["status"] in {STATUS_FAILED, STATUS_NOT_FOUND, STATUS_MANUAL_REVIEW}]
        manual_review = bool(critical_failures or counts[STATUS_MANUAL_REVIEW] or overall_confidence < 0.7)
        return {
            "requirements": results,
            "requirement_results": results,
            "evidence_graph": [self._evidence_graph(r) for r in results],
            "total_score": total_score,
            "max_score": max_score or 100.0,
            "percentage": round(total_score / max(max_score, 1) * 100, 1),
            "overall_confidence": overall_confidence,
            "requirement_confidence": [{"requirement_id": r["requirement_id"], "confidence": r["confidence"]} for r in results],
            "status_counts": counts,
            "critical_failures": critical_failures,
            "manual_review_required": manual_review,
            "analyzers_used": sorted({
                {
                    "formula": "FormulaAnalyzer", "cell_value": "ExcelAnalyzer",
                    "worksheet": "ExcelAnalyzer", "workbook_structure": "ExcelAnalyzer",
                    "chart": "ChartAnalyzer", "pivot": "PivotAnalyzer",
                    "vba_code": "VBAAnalyzer", "m_code": "PowerQueryAnalyzer",
                    "dax_measure": "DAXAnalyzer", "written_evidence": "InstructorReview",
                }.get(r["evidence_source"], r["evidence_source"])
                for r in results
            }),
        }

    def _evaluate_requirement(self, req: Dict[str, Any], analyses: Dict[str, Dict[str, Any]], prior: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        max_points = self._max_points(req, analyses.get("spec", {}))
        req_type = req.get("type", "STRUCTURE_REQUIREMENT")
        base = {
            "requirement_id": req["id"],
            "requirement": req.get("requirement", ""),
            "type": req_type,
            "category": req.get("category", "Completeness"),
            "evidence_source": req.get("evidence_source", req.get("verification", {}).get("type", "workbook_structure")),
            "max_score": max_points,
            "score": 0.0,
            "status": STATUS_NOT_FOUND,
            "confidence": 0.2,
            "criticality": req.get("criticality", "normal"),
            "method_constraint": req.get("method_constraint", "flexible"),
            "evidence": [],
            "missing": [],
            "fix": self._fix_for(req),
            "depends_on": req.get("depends_on", []),
            "verification": req.get("verification", {}),
        }
        if req_type in {"THEORY_REQUIREMENT", "REFLECTION_REQUIREMENT", "DELIVERABLE_REQUIREMENT", "DOCUMENTATION_REQUIREMENT"} or req.get("manual_review"):
            base.update({
                "status": STATUS_MANUAL_REVIEW,
                "confidence": 0.2,
                "evidence": ["No deterministic workbook evidence can establish this written/deliverable requirement."],
                "missing": ["Written evidence must be reviewed by an instructor; workbook analyzers cannot verify this task."],
                "suggested_assessment": "Pending instructor review. Do not award full credit automatically.",
            })
            return base

        dependency_results = [prior.get(dep) for dep in req.get("depends_on", []) if prior.get(dep)]
        if any(d["status"] in {STATUS_FAILED, STATUS_NOT_FOUND} for d in dependency_results):
            base["missing"].append("A prerequisite requirement failed, so this dependent result is capped at partial credit.")

        ratio, evidence, missing, confidence = self._measure(req, analyses)
        if ratio >= 0.99:
            status = STATUS_SATISFIED
        elif ratio >= 0.45:
            status = STATUS_PARTIAL
        elif ratio > 0:
            status = STATUS_FAILED
        else:
            status = STATUS_NOT_FOUND
        if dependency_results and any(d["status"] in {STATUS_FAILED, STATUS_NOT_FOUND} for d in dependency_results):
            ratio = min(ratio, 0.6)
            status = STATUS_PARTIAL if ratio > 0 else STATUS_FAILED
            confidence = min(confidence, 0.65)
        if not evidence:
            evidence = ["No matching evidence was observed in the selected deterministic analyzer output."]
        base.update({
            "status": status,
            "score": round(max_points * min(1.0, max(0.0, ratio)), 1),
            "confidence": round(confidence, 2),
            "evidence": evidence,
            "missing": list(dict.fromkeys(base["missing"] + missing)),
        })
        return base

    @staticmethod
    def _max_points(req: Dict[str, Any], spec: Dict[str, Any]) -> float:
        for criterion in spec.get("rubric", {}).get("criteria", []):
            if criterion.get("id") == req.get("id"):
                return float(criterion.get("max_points", 0))
        return 0.0

    @staticmethod
    def _formula_entries(analyses: Dict[str, Any]) -> List[Dict[str, Any]]:
        entries: List[Dict[str, Any]] = []
        wb = analyses.get("workbook", {})
        for sheet in wb.get("sheets", []):
            entries.extend(sheet.get("formulas", []))
        return entries

    def _measure(self, req: Dict[str, Any], analyses: Dict[str, Dict[str, Any]]) -> Tuple[float, List[str], List[str], float]:
        req_type = req.get("type")
        verification = req.get("verification", {})
        expected_functions = [f.upper() for f in verification.get("expected_functions", [])]
        formulas = self._formula_entries(analyses)
        evidence: List[str] = []
        missing: List[str] = []

        if req_type == "VALUE_REQUIREMENT":
            expected_values = [str(value).strip().lower() for value in verification.get("expected", {}).get("values", [])]
            observed_values = [
                str(item.get("value", "")).strip().lower()
                for sheet in analyses.get("workbook", {}).get("sheets", [])
                for item in sheet.get("values", [])
            ]
            found_values = [
                value for value in expected_values
                if any(self._value_matches(value, observed) for observed in observed_values)
            ]
            evidence = [f"Required value/label found in workbook: {value}" for value in found_values]
            missing = [f"Required value/label not found: {value}" for value in expected_values if value not in found_values]
            return len(found_values) / max(len(expected_values), 1), evidence, missing, 0.9 if not missing else 0.7

        if req_type in {"FORMULA_REQUIREMENT", "FUNCTION_REQUIREMENT", "CELL_REQUIREMENT"}:
            expected_feature = str(verification.get("expected", {}).get("feature", "")).lower()
            if expected_feature == "simulation iterations":
                match = re.search(r"(\d[\d,]*)\s+iterations", req.get("requirement", ""), re.I)
                minimum = int(match.group(1).replace(",", "")) if match else 1
                max_rows = max((int(sheet.get("row_count", 0) or 0) for sheet in analyses.get("workbook", {}).get("sheets", [])), default=0)
                if max_rows >= minimum:
                    evidence.append(f"Workbook contains at least {minimum} rows for the requested simulation iterations ({max_rows} observed).")
                    return 1.0, evidence, [], 0.72
                missing.append(f"At least {minimum} simulation iterations were required; only {max_rows} workbook rows were observed.")
                return 0.0, evidence, missing, 0.8
            target_specs = verification.get("target_cells", [])
            target_cells = [item.get("cell", "").upper() for item in target_specs]
            target_entries = [
                f for f in formulas
                if any(
                    f.get("cell", "").upper() == item.get("cell", "").upper()
                    and (not item.get("sheet") or f.get("sheet", "").lower() == item.get("sheet", "").lower())
                    for item in target_specs
                )
            ]
            function_entries = []
            for formula in formulas:
                found = set(_extract_functions(formula.get("formula", "")))
                if expected_functions and set(expected_functions).intersection(found):
                    function_entries.append((formula, found))
            if target_cells:
                if target_entries:
                    evidence.append("Formula found at required location(s): " + ", ".join(target_cells))
                else:
                    missing.append("No formula was found in required cell(s): " + ", ".join(target_cells))
            if expected_functions:
                exact_target = [entry for entry in target_entries if set(expected_functions).intersection(_extract_functions(entry.get("formula", "")))]
                if exact_target:
                    constraints = [str(value).lower() for value in verification.get("expected", {}).get("constraints", [])]
                    constraint_failures: List[str] = []
                    for entry in exact_target:
                        evidence.append(f"{', '.join(expected_functions)} detected in {entry.get('sheet', '')}!{entry.get('cell', '')}: {entry.get('formula', '')}")
                        formula_lower = entry.get("formula", "").lower()
                        constraint_failures.extend(value for value in constraints if value not in formula_lower)
                    if constraint_failures:
                        missing.append("Expected formula constraint(s) not confirmed: " + ", ".join(dict.fromkeys(constraint_failures)))
                        ratio = 0.75
                    else:
                        ratio = 1.0
                elif function_entries:
                    if req.get("method_constraint") == "flexible":
                        evidence.append(f"Equivalent formula method detected outside the requested location: {function_entries[0][0].get('sheet', '')}!{function_entries[0][0].get('cell', '')}.")
                        ratio = 0.75 if not target_cells else 0.55
                    else:
                        evidence.append(f"Required function {', '.join(expected_functions)} detected, but not at the required location.")
                        ratio = 0.55 if target_cells else 0.8
                elif target_entries:
                    alt = target_entries[0].get("formula", "")
                    evidence.append(f"A formula exists at the target, but it does not use the required method: {alt}")
                    ratio = 0.3 if req.get("method_constraint") == "strict" else 0.6
                else:
                    missing.append("Required function/formula evidence was not detected.")
                    ratio = 0.0
            else:
                ratio = 1.0 if target_entries else 0.0
            confidence = 0.94 if evidence else 0.35
            return ratio, evidence, missing, confidence

        if req_type == "SHEET_REQUIREMENT":
            actual = [s.lower() for s in analyses.get("workbook", {}).get("sheet_names", [])]
            expected = [s for s in verification.get("required_sheets", [])]
            found = [s for s in expected if s.lower() in actual]
            if found:
                evidence.append("Required worksheet present: " + ", ".join(found))
            missing = [f"Required worksheet missing: {s}" for s in expected if s.lower() not in actual]
            return (len(found) / max(len(expected), 1), evidence, missing, 0.98 if not missing else 0.85)

        if req_type in {"CHART_REQUIREMENT", "PIVOT_REQUIREMENT"}:
            source = analyses.get("charts", {}) if req_type == "CHART_REQUIREMENT" else analyses.get("pivots", {})
            text = req.get("requirement", "").lower()
            if req_type == "CHART_REQUIREMENT":
                types = [str(v).lower() for v in source.get("chart_types", [])]
                chart_records = source.get("charts", [])
                expected_feature = str(verification.get("expected", {}).get("feature", "")).lower()
                wanted = "doughnut" if "doughnut" in expected_feature else "pie" if "pie" in expected_feature else ("doughnut" if "doughnut" in text else "pie" if "pie" in text else None)
                found = bool(types) and (wanted is None or any(wanted in value for value in types))
                if found:
                    evidence.append(f"Chart evidence found: {', '.join(types)}.")
                else:
                    missing.append("Required chart type/configuration was not detected.")
                ratio = 1.0 if found else 0.0
                if found and "secondary axis" in text:
                    if any(c.get("secondary_axis") for c in chart_records):
                        evidence.append("Secondary-axis metadata was detected.")
                    else:
                        missing.append("Secondary-axis configuration was not verifiable from workbook metadata.")
                        ratio = 0.55
                if found and "270" in text:
                    if any(str(c.get("rotation")) == "270" for c in chart_records):
                        evidence.append("270° chart rotation was detected.")
                    else:
                        missing.append("Required 270° rotation was not verifiable from workbook metadata.")
                        ratio = min(ratio, 0.55)
                return (ratio, evidence, missing, 0.78 if ratio == 1 else 0.55)
            found = source.get("pivot_count", 0) > 0
            if found:
                evidence.append(f"{source.get('pivot_count')} PivotTable evidence found.")
            else:
                missing.append("No PivotTable evidence was found.")
            return (1.0 if found else 0.0, evidence, missing, 0.85 if found else 0.5)

        if req_type in {"VBA_REQUIREMENT", "CODE_STRUCTURE_REQUIREMENT", "BUSINESS_LOGIC_REQUIREMENT", "WORKBOOK_BEHAVIOR_REQUIREMENT"}:
            source = analyses.get("vba", {})
            workbook = analyses.get("workbook", {})
            if not source.get("has_vba"):
                if "activex" in req.get("requirement", "").lower() and workbook.get("has_activex"):
                    return 1.0, ["ActiveX control package evidence was detected in the workbook."], [], 0.82
                return 0.0, [], ["The assignment requires VBA evidence, but no VBA project was detected."], 0.85
            text = req.get("requirement", "").lower()
            code_quality = source.get("code_quality", {})
            structure = source.get("structure", {})
            joined = " ".join(code_quality.get("practices_found", [])).lower()
            patterns = " ".join(str(a.get("pattern", "")) for a in source.get("automation_patterns", [])).lower()
            module_text = " ".join(str(m) for m in source.get("modules", [])).lower()
            signals = []
            if "option explicit" in text and "option explicit" in joined:
                signals.append("Option Explicit was detected by the VBA analyzer.")
            if "for" in text and "loop" in text and ("loop" in joined or "loop" in patterns):
                signals.append("Loop structure was detected by the VBA analyzer.")
            if "error" in text and ("error handling" in joined or "on error" in module_text):
                signals.append("VBA error handling was detected.")
            if "class module" in text and structure.get("has_class_modules"):
                signals.append("Class Module evidence was detected.")
            if "userform" in text and structure.get("has_userforms"):
                signals.append("UserForm evidence was detected.")
            if "workbook" in text and "event" in text and structure.get("has_workbook_events"):
                signals.append("Workbook event module evidence was detected.")
            if "worksheet" in text and "event" in text and structure.get("has_sheet_events"):
                signals.append("Worksheet event module evidence was detected.")
            if "dictionary" in text and "dictionary" in module_text:
                signals.append("Dictionary evidence was detected in extracted VBA metadata.")
            if "file system" in text and "file system" in patterns:
                signals.append("File-system automation evidence was detected.")
            if "msgbox" in text and "user interaction" in joined:
                signals.append("MsgBox evidence was detected.")
            if "screenupdating" in text and "performance" in patterns:
                signals.append("ScreenUpdating/performance evidence was detected.")
            if "activex" in text and workbook.get("has_activex"):
                signals.append("ActiveX control package evidence was detected in the workbook.")
            if req_type == "BUSINESS_LOGIC_REQUIREMENT":
                logic_terms = [term for term in ("high commission", "standard commission", "needs review", "green", "blue", "red") if term in text]
                found_logic = [term for term in logic_terms if term in module_text]
                if found_logic:
                    signals.append("Business-logic label evidence detected: " + ", ".join(found_logic))
                if logic_terms and len(found_logic) < len(logic_terms):
                    missing_logic = [term for term in logic_terms if term not in found_logic]
                    return len(found_logic) / len(logic_terms), signals, ["Business-logic evidence missing: " + ", ".join(missing_logic)], 0.68
            if not signals and source.get("module_count", 0):
                signals.append(f"VBA project detected with {source.get('module_count', 0)} module(s), but the requested construct was not confirmed.")
            ratio = 1.0 if signals and not signals[0].endswith("not confirmed.") else 0.35
            return ratio, signals, ([] if ratio == 1 else ["Requested VBA construct was not confirmed by extracted analyzer evidence."]), 0.72 if ratio < 1 else 0.82

        if req_type == "POWER_QUERY_REQUIREMENT":
            source = analyses.get("power_query", {})
            if not source.get("has_power_query"):
                return 0.0, [], ["No Power Query/M evidence was detected."], 0.85
            text = req.get("requirement", "").lower()
            transformations = " ".join(source.get("all_transformations", [])).lower()
            query_records = source.get("queries", [])
            queries = " ".join(str(q.get("m_code_preview", "")) for q in query_records).lower()
            tokens = [token for token in ("try", "otherwise", "record.fieldordefault", "parameter", "custom column", "merge", "group", "filter", "sequence") if token in text]
            structured_tokens = set()
            if any(q.get("has_error_handling") for q in query_records):
                structured_tokens.update({"try", "otherwise"})
            if any(q.get("has_parameters") for q in query_records):
                structured_tokens.add("parameter")
            if any(q.get("has_record_field_or_default") for q in query_records):
                structured_tokens.add("record.fieldordefault")
            found = [token for token in tokens if token in transformations or token in queries or token in structured_tokens]
            ratio = 1.0 if not tokens or len(found) == len(tokens) else len(found) / max(len(tokens), 1)
            evidence.append(f"Power Query evidence found in {source.get('query_count', 0)} query(ies).")
            if found:
                evidence.append("Detected requested M concepts: " + ", ".join(found))
            missing = ["Requested M concept not found: " + token for token in tokens if token not in found]
            return ratio, evidence, missing, 0.7 if missing else 0.88

        if req_type == "DAX_REQUIREMENT":
            source = analyses.get("dax", {})
            expected = [str(value).upper() for value in verification.get("expected_functions", [])]
            found_functions = {str(value).upper() for value in source.get("functions_used", [])}
            found = [value for value in expected if value in found_functions]
            if found:
                evidence.extend(source.get("evidence", []))
                evidence.append("DAX measure/model evidence was extracted from the workbook package.")
            else:
                missing.append("DAX measure evidence for the requested function was not extracted.")
            ratio = len(found) / max(len(expected), 1) if expected else (1.0 if source.get("has_dax") else 0.0)
            return ratio, evidence, missing, 0.76 if ratio else 0.35

        if req_type in {"FORMAT_REQUIREMENT", "DATA_VALIDATION_REQUIREMENT", "STRUCTURE_REQUIREMENT"}:
            wb = analyses.get("workbook", {})
            fmt = analyses.get("formatting", {})
            text = req.get("requirement", "").lower()
            if req_type == "DATA_VALIDATION_REQUIREMENT" or "validation" in text or "drop-down" in text:
                found = bool(fmt.get("has_data_validation")) or any(s.get("data_validations") for s in wb.get("sheets", []))
                if found:
                    evidence.append("Data Validation evidence found in workbook structure.")
                else:
                    missing.append("Data Validation rule evidence was not found.")
                ratio = 1.0 if found else 0.0
                validations = [dv for sheet in wb.get("sheets", []) for dv in sheet.get("data_validations", [])]
                if found and "8 characters" in text:
                    exact = any(
                        "text" in str(dv.get("type", "")).lower()
                        and "8" in str(dv.get("formula1", ""))
                        for dv in validations
                    )
                    if exact:
                        evidence.append("Text-length validation with the required value 8 was detected.")
                    else:
                        missing.append("The required text-length limit of 8 was not verifiable.")
                        ratio = 0.6
                if found and "between" in text and "1" in text and "100" in text:
                    exact = any(
                        "whole" in str(dv.get("type", "")).lower()
                        and "1" in str(dv.get("formula1", ""))
                        and "100" in str(dv.get("formula2", ""))
                        for dv in validations
                    )
                    if exact:
                        evidence.append("Whole-number validation between 1 and 100 was detected.")
                    else:
                        missing.append("The required whole-number range 1–100 was not verifiable.")
                        ratio = min(ratio, 0.6)
                return (ratio, evidence, missing, 0.9 if ratio == 1 else 0.65)
            if "named range" in text:
                found = bool(fmt.get("has_named_ranges")) or wb.get("named_range_count", 0) > 0
                if found:
                    evidence.append(f"Named range evidence found ({wb.get('named_range_count', 0)} range(s)).")
                else:
                    missing.append("Named range evidence was not found.")
                return (1.0 if found else 0.0, evidence, missing, 0.9 if found else 0.6)
            if "tab color" in text:
                colored = [sheet.get("name", "") for sheet in wb.get("sheets", []) if sheet.get("tab_color")]
                if colored:
                    evidence.append("Worksheet tab color evidence found on: " + ", ".join(colored))
                else:
                    missing.append("Required worksheet tab color was not detected.")
                return (1.0 if colored else 0.0, evidence, missing, 0.88 if colored else 0.65)
            if "hidden calculation" in text:
                hidden = wb.get("hidden_sheets", [])
                found = bool(hidden)
                if found:
                    evidence.append("Hidden worksheet evidence found: " + ", ".join(hidden))
                else:
                    missing.append("No hidden calculation worksheet was detected.")
                return (1.0 if found else 0.0, evidence, missing, 0.86 if found else 0.7)
            if wb.get("total_data_cells", 0) > 0:
                evidence.append(f"Workbook structure contains {wb.get('total_data_cells', 0)} data cell(s).")
                return 0.8, evidence, [], 0.65
            return 0.0, [], ["No workbook structure evidence was found."], 0.7

        return 0.0, [], ["This requirement type has no deterministic analyzer mapping yet."], 0.25

    @staticmethod
    def _value_matches(expected: str, observed: str) -> bool:
        if expected == observed:
            return True
        compact_expected = re.sub(r"[$,\s]", "", expected)
        compact_observed = re.sub(r"[$,\s]", "", observed)
        if compact_expected == compact_observed:
            return True
        # OpenPyXL exposes Excel dates as Python datetime strings while
        # assignment instructions commonly use M/D/YYYY.
        date_match = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", expected)
        if date_match:
            month, day, year = date_match.groups()
            return f"{year}-{int(month):02d}-{int(day):02d}" in observed
        return False

    @staticmethod
    def _fix_for(req: Dict[str, Any]) -> str:
        verification = req.get("verification", {})
        cells = [item.get("cell") for item in verification.get("target_cells", []) if item.get("cell")]
        functions = verification.get("expected_functions", [])
        if functions and cells:
            return f"Update {', '.join(cells)} so it uses {', '.join(functions)} as required by the assignment."
        if functions:
            return f"Add evidence of the required {', '.join(functions)} method."
        return f"Complete this assignment requirement: {req.get('requirement', '')[:180]}"

    @staticmethod
    def _evidence_graph(result: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "requirement_id": result["requirement_id"],
            "expected_evidence": result.get("verification", {}),
            "observed_evidence": result.get("evidence", []),
            "verification": result["status"],
            "score": result["score"],
            "confidence": result["confidence"],
        }


def build_evidence_feedback(assignment_title: str, evaluation: Dict[str, Any]) -> str:
    """Generate feedback from observed evidence only."""
    lines = [f"Assignment: {assignment_title}", "", "Requirement-level assessment:"]
    for result in evaluation.get("requirement_results", []):
        lines.append(f"- {result['requirement_id']} — {result['status']} ({result['score']}/{result['max_score']}): {result['requirement']}")
        for evidence in result.get("evidence", [])[:2]:
            lines.append(f"  Evidence: {evidence}")
        for missing in result.get("missing", [])[:2]:
            lines.append(f"  Missing/uncertain: {missing}")
        if result.get("status") in {STATUS_FAILED, STATUS_NOT_FOUND, STATUS_PARTIAL}:
            lines.append(f"  Fix: {result.get('fix', '')}")
    if evaluation.get("manual_review_required"):
        lines.extend(["", "Auto-grade status: Pending instructor review.", "Some requirements are written, ambiguous, dependent on unextracted evidence, or below the confidence threshold."])
    else:
        lines.extend(["", "Auto-grade status: Eligible for automatic processing; no critical evidence anomalies were detected."])
    lines.append(f"Overall confidence: {evaluation.get('overall_confidence', 0):.2f}")
    return "\n".join(lines)
