"""Static OOXML/OPC feature coverage for the native spreadsheet evaluator.

These tests build a small workbook, rewrite its OPC package as data, and verify
that real package markers become namespaced evidence.  Nothing is executed:
no macro, query, pivot cache, external target or embedded object is opened.
"""

from __future__ import annotations

from io import BytesIO
from typing import Dict
import xml.etree.ElementTree as ET
import zipfile

from openpyxl import Workbook

from src.services.aage.artifacts import ArtifactAnalyzer, ArtifactManifest, ExtractedFile
from src.services.aage.assessment_intelligence import AssessmentDescriptor
from src.services.aage.disciplines import Classification
from src.services.aage.evaluators.base import EvaluationContext
from src.services.aage.evaluators.spreadsheet import SpreadsheetEvaluator
from src.services.excel_grading.assignment_intelligence import (
    AssignmentKnowledge,
    RequirementEvaluator,
    STATUS_MANUAL_REVIEW,
    STATUS_NOT_FOUND,
    STATUS_SATISFIED,
)
from src.services.excel_grading.excel_analyzer import ExcelAnalyzer
from src.services.excel_grading.ooxml_feature_analyzer import (
    OOXMLFeatureAnalyzer,
    unsupported_ooxml_features,
)

MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_DOC = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
REL_PKG = "http://schemas.openxmlformats.org/package/2006/relationships"

ET.register_namespace("", MAIN)
ET.register_namespace("r", REL_DOC)
ET.register_namespace("", REL_PKG)

FEATURE_INSTRUCTIONS = (
    "Insert a slicer, a timeline and a sparkline. "
    "Add an external link, a data connection and a query table. "
    "Add a threaded comment, a comment and a hyperlink. "
    "Apply sheet protection, a print area and conditional formatting. "
    "Add a form control, an embedded object, a sort state and a table style. "
    "Add a scenario and a dynamic array formula. Use a data model."
)


def _q(name: str) -> str:
    return f"{{{MAIN}}}{name}"


def _base_workbook() -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Data"
    sheet["A1"] = "Region"
    sheet["A2"] = "North"
    sheet["B1"] = "Sales"
    sheet["B2"] = 10
    sheet["B3"] = "=SUM(B2:B2)"
    sheet["C1"] = "=UNIQUE(A2:A3)"
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def _extra_parts() -> Dict[str, bytes]:
    return {
        "customXml/item1.xml": (
            '<DataMashup xmlns="http://schemas.microsoft.com/DataMashup">'
            "let Sales = CALCULATE(SUM(Sales[Amount])) in Sales"
            "</DataMashup>"
        ).encode("utf-8"),
        "xl/model/item.data": b"static-model-marker",
        "xl/connections.xml": (
            f'<connections xmlns="{MAIN}"><connection name="SalesConnection" type="5"/>'
            "</connections>"
        ).encode("utf-8"),
        "xl/queryTables/queryTable1.xml": (
            f'<queryTable xmlns="{MAIN}" name="SalesQuery"/>'
        ).encode("utf-8"),
        "xl/externalLinks/externalLink1.xml": (
            f'<externalLink xmlns="{MAIN}"/>'
        ).encode("utf-8"),
        "xl/pivotTables/pivotTable1.xml": (
            f'<pivotTableDefinition xmlns="{MAIN}" name="SalesPivot"/>'
        ).encode("utf-8"),
        "xl/pivotCache/pivotCacheDefinition1.xml": (
            f'<pivotCacheDefinition xmlns="{MAIN}"/>'
        ).encode("utf-8"),
        "xl/charts/chart1.xml": (
            '<chartSpace xmlns="http://schemas.openxmlformats.org/drawingml/2006/chart"/>'
        ).encode("utf-8"),
        "xl/slicers/slicer1.xml": (
            '<slicer xmlns="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" '
            'name="Slicer_Region"/>'
        ).encode("utf-8"),
        "xl/slicerCaches/slicerCache1.xml": (
            '<slicerCache xmlns="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"/>'
        ).encode("utf-8"),
        "xl/timelineCaches/timelineCache1.xml": (
            '<timelineCache xmlns="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"/>'
        ).encode("utf-8"),
        "xl/comments/comment1.xml": (
            f'<comments xmlns="{MAIN}"/>'
        ).encode("utf-8"),
        "xl/threadedComments/threadedComment1.xml": (
            '<threadedComments xmlns="http://schemas.microsoft.com/office/spreadsheetml/2015/10/main"/>'
        ).encode("utf-8"),
        "xl/persons/person.xml": (
            '<person xmlns="http://schemas.microsoft.com/office/spreadsheetml/2017/person"/>'
        ).encode("utf-8"),
        "xl/activeX/control1.bin": b"static-activex-marker",
        "xl/ctrlProps/ctrlProp1.xml": (
            '<controlPr xmlns="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" '
            'objectType="CheckBox"/>'
        ).encode("utf-8"),
        "xl/embeddings/Microsoft_Excel_Worksheet1.bin": b"static-embedded-marker",
        "xl/tables/table1.xml": (
            f'<table xmlns="{MAIN}" id="1" name="SalesTable" displayName="SalesTable" ref="A1:B3">'
            f'<tableStyleInfo name="TableStyleMedium2" showRowStripes="1"/>'
            "</table>"
        ).encode("utf-8"),
    }


def _feature_workbook() -> bytes:
    output = BytesIO()
    with zipfile.ZipFile(BytesIO(_base_workbook()), "r") as source:
        entries = [(info, source.read(info.filename)) for info in source.infolist()]

    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as target:
        for info, payload in entries:
            if info.filename == "xl/workbook.xml":
                payload = _with_defined_names(payload)
            elif info.filename == "xl/worksheets/sheet1.xml":
                payload = _with_sheet_features(payload)
            target.writestr(info.filename, payload)
        target.writestr(
            "xl/worksheets/_rels/sheet1.xml.rels",
            (
                f'<Relationships xmlns="{REL_PKG}">'
                '<Relationship Id="rId1" '
                'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" '
                'Target="https://example.invalid/documentation" TargetMode="External"/>'
                "</Relationships>"
            ).encode("utf-8"),
        )
        for name, payload in _extra_parts().items():
            target.writestr(name, payload)
    return output.getvalue()


def _with_defined_names(payload: bytes) -> bytes:
    root = ET.fromstring(payload)
    for existing in root.findall(_q("definedNames")):
        root.remove(existing)
    names = ET.SubElement(root, _q("definedNames"))
    ET.SubElement(names, _q("definedName"), {"name": "SalesRange"}).text = "Data!$A$1:$B$3"
    ET.SubElement(
        names, _q("definedName"), {"name": "_xlnm.Print_Area", "localSheetId": "0"}
    ).text = "'Data'!$A$1:$B$3"
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def _with_sheet_features(payload: bytes) -> bytes:
    root = ET.fromstring(payload)

    auto_filter = ET.Element(_q("autoFilter"), {"ref": "A1:B3"})
    protection = ET.Element(_q("sheetProtection"), {"password": "ABCD"})
    scenarios = ET.SubElement(root, _q("scenarios"))
    ET.SubElement(scenarios, _q("scenario"), {"name": "BestCase"})
    conditional = ET.SubElement(root, _q("conditionalFormatting"), {"sqref": "B2:B3"})
    rule = ET.SubElement(
        conditional, _q("cfRule"),
        {"type": "cellIs", "operator": "greaterThan", "priority": "1"},
    )
    ET.SubElement(rule, _q("formula")).text = "0"
    validations = ET.SubElement(root, _q("dataValidations"), {"count": "1"})
    validation = ET.SubElement(
        validations, _q("dataValidation"),
        {"type": "list", "sqref": "A2", "showDropDown": "1"},
    )
    ET.SubElement(validation, _q("formula1")).text = '"North,South"'
    hyperlinks = ET.SubElement(root, _q("hyperlinks"))
    ET.SubElement(
        hyperlinks, _q("hyperlink"),
        {f"{{{REL_DOC}}}id": "rId1", "ref": "A1", "display": "Documentation"},
    )
    ET.SubElement(root, _q("printOptions"), {"horizontalCentered": "1"})

    # Excel keeps extension-only features in extLst.  The URI, not the child
    # prefix, is the stable marker used by the static analyzer.
    ext_list = ET.SubElement(root, _q("extLst"))
    for uri in (
        "05C60535-1F16-4FD2-B633-F4F36F0B64E0",
        "A8765BA9-456A-4DAB-B4F3-ACF838C121DE",
        "7E03D99C-DC04-49D9-9315-930204A7B6E9",
        "FC87AEE6-9EDD-4A0A-B7FB-166176984837",
    ):
        ext = ET.SubElement(ext_list, _q("ext"), {"uri": uri})
        ET.SubElement(ext, _q("sparklineGroup")).set("displayEmptyCellsAs", "gap")
    # Schema order is not material to this static parser, but keep protection
    # and autoFilter near the worksheet data for readable fixtures.
    sheet_data = root.find(_q("sheetData"))
    if sheet_data is not None:
        index = list(root).index(sheet_data) + 1
        root.insert(index, protection)
    root.insert(list(root).index(scenarios) - 1 if scenarios in root else 0, auto_filter)
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def _analyses(data: bytes, instructions: str = FEATURE_INSTRUCTIONS) -> dict:
    spec = AssignmentKnowledge().build({
        "assignment_id": 900,
        "title": "OOXML feature workbook",
        "description": "",
        "instructions": instructions,
        "points_possible": 100,
    })
    return {"spec": spec, "workbook": ExcelAnalyzer(data, "features.xlsx").analyze()}


def test_ooxml_markers_are_reported_as_namespaced_static_evidence():
    analysis = ExcelAnalyzer(_feature_workbook(), "features.xlsx").analyze()

    assert not analysis.get("error")
    ooxml = analysis["ooxml_features"]
    assert ooxml["scan"]["status"] == "scanned"
    assert ooxml["scan"]["part_count"] > 10

    expected = {
        "defined_names", "slicers", "timelines", "sparklines", "pivot_tables",
        "charts", "external_links", "connections", "query_tables", "power_query",
        "data_model", "dax", "comments", "threaded_comments", "hyperlinks",
        "protection", "print_setup", "form_controls", "activex_controls",
        "embedded_objects", "conditional_formatting", "data_validation_fields",
        "sort_filter", "table_styles", "scenarios", "document_metadata",
        "formula_features",
    }
    for key in expected:
        record = ooxml["features"][key]
        assert record["status"] in {"PRESENT", "CONFIGURED"}, (key, record)
        assert record["count"] >= 1, key
        assert record["evidence"], key
        assert "not" in record["limitation"].lower() or "not " in record["limitation"].lower(), key

    assert analysis["has_activex"] is True
    assert analysis["activex_count"] >= 1
    assert analysis["form_control_count"] >= 1


def test_requested_features_score_from_real_package_evidence():
    data = _feature_workbook()
    analyses = _analyses(data)

    result = RequirementEvaluator().evaluate(analyses["spec"], analyses)
    feature_results = [
        row for row in result["requirement_results"]
        if row["type"] == "OOXML_FEATURE_REQUIREMENT"
    ]
    assert len(feature_results) >= 12
    assert all(row["status"] == STATUS_SATISFIED for row in feature_results), [
        (row["requirement"], row["status"], row["missing"]) for row in feature_results
        if row["status"] != STATUS_SATISFIED
    ]
    assert all(not row["missing"] for row in feature_results)
    assert result["manual_review_required"] is False or not result["critical_failures"]


def test_absent_and_unverifiable_features_are_not_confused():
    plain = _base_workbook()
    plain_analyses = _analyses(plain, "Insert a slicer.")
    plain_features = plain_analyses["workbook"]["ooxml_features"]["features"]
    assert plain_features["slicers"]["status"] == "ABSENT"

    absent_result = RequirementEvaluator().evaluate(
        plain_analyses["spec"], plain_analyses)
    absent = next(
        row for row in absent_result["requirement_results"]
        if row["type"] == "OOXML_FEATURE_REQUIREMENT"
    )
    assert absent["status"] == STATUS_NOT_FOUND
    assert "not found" in " ".join(absent["missing"]).lower()

    spec = plain_analyses["spec"]
    bad_analyses = {
        "spec": spec,
        "workbook": {
            "error": "not a workbook",
            "sheets": [],
            "ooxml_features": unsupported_ooxml_features("xlsx"),
        },
    }
    unverifiable = RequirementEvaluator().evaluate(spec, bad_analyses)
    row = next(
        item for item in unverifiable["requirement_results"]
        if item["type"] == "OOXML_FEATURE_REQUIREMENT"
    )
    assert row["status"] == STATUS_MANUAL_REVIEW
    assert "could not decide" in " ".join(row["evidence"]).lower()

    direct = OOXMLFeatureAnalyzer(b"not a zip", "broken.xlsx", "xlsx").analyze()
    assert direct["scan"]["status"] == "skipped"
    assert all(
        item["status"] == "UNVERIFIABLE" for item in direct["features"].values())


def test_ooxml_observations_reach_generic_rubric_criteria():
    data = _feature_workbook()
    criteria = [
        {"criterion_key": "pivots", "name": "Slicers and PivotTables",
         "description": "Interactive summaries.", "max_marks": 25},
        {"criterion_key": "validation", "name": "Conditional formatting and validation",
         "description": "Input checks.", "max_marks": 25},
        {"criterion_key": "automation", "name": "Data connections and Power Query",
         "description": "Static automation metadata.", "max_marks": 25},
        {"criterion_key": "structure", "name": "Workbook structure",
         "description": "Defined names and workbook aids.", "max_marks": 25},
    ]
    context = EvaluationContext(
        descriptor=AssessmentDescriptor(
            kind="assignment", id=900, title="OOXML feature workbook",
            description="", instructions=FEATURE_INSTRUCTIONS,
            points_possible=100.0,
        ),
        rubric={"criteria": criteria},
        manifest=ArtifactManifest(
            submission_type="assignment", submission_id=900,
            files=[{"file_name": "features.xlsx", "path": "features.xlsx"}],
            binary_files=[ExtractedFile(
                path="features.xlsx", name="features.xlsx",
                data=data, category="data")],
        ),
        classification=Classification(discipline="spreadsheet", confidence=0.95),
    )

    output = SpreadsheetEvaluator().evaluate(context, criteria)
    mapping = output.analysis["criterion_mapping"]
    assert "feature_ooxml_slicers" in mapping["pivots"]
    assert "feature_ooxml_conditional_formatting" in mapping["validation"]
    assert "feature_ooxml_connections" in mapping["automation"]
    assert "feature_ooxml_defined_names" in mapping["structure"]
    assert all(criterion.marks > 0 for criterion in output.criteria)

    missing = ArtifactAnalyzer._missing_deliverables(
        context.manifest, ["spreadsheet"])
    assert missing == []
