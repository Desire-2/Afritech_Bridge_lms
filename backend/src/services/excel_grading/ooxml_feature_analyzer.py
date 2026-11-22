"""Static OOXML/OPC feature evidence for spreadsheet submissions.

This analyser inspects workbook package parts as data.  It never opens Excel,
executes a formula, refreshes a query or pivot cache, follows an external link,
runs a macro, renders a printed page, or interprets an embedded object.  Its
output is deliberately namespaced under ``ooxml_features`` so legacy analyzer
keys remain stable.

Every feature has one of four statuses:

* ``PRESENT`` -- a package part or marker was observed;
* ``CONFIGURED`` -- explicit configuration metadata was observed;
* ``ABSENT`` -- the package was scanned and no marker was found;
* ``UNVERIFIABLE`` -- the package could not be scanned or the feature lives in
  binary internals that cannot be judged safely without Excel.
"""

from __future__ import annotations

import re
import zipfile
from io import BytesIO
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
from xml.etree import ElementTree as ET

# Kept module-level so tests can exercise the degradation path without creating
# a 200 MB fixture.
MAX_DECOMPRESSED_BYTES = 200 * 1024 * 1024
MAX_PART_BYTES = 4 * 1024 * 1024
MAX_SAMPLES = 8
MAX_WARNINGS = 20

_NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
_NS_OFFICE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_NS_PACKAGE_REL = "http://schemas.openxmlformats.org/package/2006/relationships"

_EXT_URIS = {
    "sparklines": "05c60535-1f16-4fd2-b633-f4f36f0b64e0",
    "slicers": "a8765ba9-456a-4dab-b4f3-acf838c121de",
    "protected_ranges": "fc87aee6-9edd-4a0a-b7fb-166176984837",
    "timelines": "7e03d99c-dc04-49d9-9315-930204a7b6e9",
}

_DAX_TOKENS = (
    "CALCULATE", "SUMX", "AVERAGEX", "COUNTX", "DIVIDE",
    "DISTINCTCOUNT", "RELATED", "VALUES", "COUNTROWS",
)

_FEATURE_LIMITATIONS = {
    "defined_names": "Names and destinations were read from XML; formulas were not resolved.",
    "slicers": "Slicer parts were counted; interactive filtering was not exercised.",
    "timelines": "Timeline parts were counted; date filtering was not exercised.",
    "sparklines": "Sparkline geometry was counted; rendered charts were not inspected.",
    "pivot_tables": "Pivot definitions/caches were counted; caches were not refreshed.",
    "charts": "Chart parts were counted; rendered output was not inspected.",
    "external_links": "External-link parts were counted; targets were not followed or refreshed.",
    "connections": "Connection metadata was counted; connections were not opened.",
    "query_tables": "Query-table parts were counted; queries were not refreshed.",
    "power_query": "DataMashup parts were detected; M code was not executed or refreshed.",
    "data_model": "Data-model parts were detected; VertiPaq/SSAS internals were not loaded.",
    "dax": "DAX tokens were searched in package parts; expressions were not evaluated.",
    "comments": "Legacy comment parts were counted; notes were not rendered.",
    "threaded_comments": "Threaded-comment parts were counted; conversation state was not resolved.",
    "hyperlinks": "Hyperlink cells were counted; targets were not followed.",
    "protection": "Protection metadata was counted; passwords/permissions were not exercised.",
    "print_setup": "Print settings were read from metadata; pages were not rendered.",
    "form_controls": "Form-control metadata was counted; control behaviour was not exercised.",
    "activex_controls": "ActiveX package parts were counted; controls were not instantiated.",
    "embedded_objects": "Embedded object parts were counted; payloads were not opened or executed.",
    "conditional_formatting": "Conditional-format rules were counted; outcomes were not recalculated.",
    "data_validation_fields": "Data-validation rules were counted; UI behaviour was not exercised.",
    "sort_filter": "Saved filter/sort metadata was read; filters were not applied interactively.",
    "table_styles": "Table style names were read; visual rendering was not inspected.",
    "scenarios": "Scenario names were read; Solver/Goal Seek outcomes were not recomputed.",
    "document_metadata": "Document properties were counted; metadata authenticity was not verified.",
    "formula_features": "Formula syntax was inspected; results were not recalculated.",
}

FEATURE_KEYS = tuple(_FEATURE_LIMITATIONS)

_STATUS_RANK = {"ABSENT": 0, "PRESENT": 1, "CONFIGURED": 2, "UNVERIFIABLE": 3}


def unsupported_ooxml_features(ext: str, file_name: str = "") -> Dict[str, Any]:
    """Return the standard unverifiable evidence block for non-OOXML inputs."""
    return OOXMLFeatureAnalyzer(b"", file_name, ext).analyze()


def _empty_record(feature: str) -> Dict[str, Any]:
    return {
        "status": "ABSENT",
        "count": 0,
        "evidence": [],
        "parts": [],
        "limitation": _FEATURE_LIMITATIONS.get(feature, "Feature was not executed."),
    }


def _local_name(tag: Any) -> str:
    return str(tag or "").rsplit("}", 1)[-1]


def _meaningful_attributes(node: ET.Element) -> bool:
    """Ignore Excel's empty/default protection elements."""
    for value in node.attrib.values():
        text = str(value).strip().lower()
        if text and text not in {"0", "false", "none"}:
            return True
    return False


def _normalise_target(target: str) -> str:
    value = str(target or "").strip().lstrip("/")
    if not value:
        return ""
    if value.startswith("xl/"):
        return value
    if value.startswith("worksheets/"):
        return "xl/" + value
    return "xl/" + value


class OOXMLFeatureAnalyzer:
    """Collect bounded, deterministic evidence from an OPC workbook package."""

    def __init__(self, file_bytes: bytes, file_name: str, ext: str):
        self.file_bytes = file_bytes
        self.file_name = file_name
        self.ext = str(ext or "").lower()
        self.scan: Dict[str, Any] = {
            "status": "skipped",
            "reason": "",
            "part_count": 0,
            "decompressed_bytes": 0,
            "warnings": [],
        }

    def analyze(self) -> Dict[str, Any]:
        features = {key: _empty_record(key) for key in FEATURE_KEYS}
        if self.ext not in ("xlsx", "xlsm"):
            self._skip_all(features, f".{self.ext or 'unknown'} packages are not OOXML workbooks")
            return self._result(features)

        try:
            with zipfile.ZipFile(BytesIO(self.file_bytes), "r") as archive:
                infos = archive.infolist()
                total_size = sum(int(info.file_size or 0) for info in infos)
                self.scan.update({
                    "status": "scanned",
                    "part_count": len(infos),
                    "decompressed_bytes": total_size,
                })
                if total_size > MAX_DECOMPRESSED_BYTES:
                    self._skip_all(
                        features,
                        f"decompressed package size {total_size} exceeds the {MAX_DECOMPRESSED_BYTES} byte safety limit",
                    )
                    return self._result(features)
                self._inspect_archive(archive, features)
        except Exception as exc:  # noqa: BLE001 - untrusted workbook bytes
            self._skip_all(features, f"OOXML package could not be inspected: {str(exc)[:200]}")
        return self._result(features)

    def _result(self, features: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "schema_version": "1.0",
            "scan": self.scan,
            "features": features,
        }

    def _warn(self, message: str) -> None:
        warnings = self.scan.setdefault("warnings", [])
        if message not in warnings and len(warnings) < MAX_WARNINGS:
            warnings.append(message[:300])

    def _skip_all(self, features: Dict[str, Dict[str, Any]], reason: str) -> None:
        self.scan["status"] = "skipped"
        self.scan["reason"] = reason[:300]
        for record in features.values():
            record.update({
                "status": "UNVERIFIABLE",
                "count": 0,
                "evidence": [],
                "parts": [],
            })

    @staticmethod
    def _mark(features: Dict[str, Dict[str, Any]], feature: str, *,
              status: str, count: int = 0, evidence: Iterable[str] = (),
              parts: Iterable[str] = (), **extra: Any) -> None:
        record = features[feature]
        old_rank = _STATUS_RANK.get(str(record.get("status")), 0)
        new_rank = _STATUS_RANK.get(status, 0)
        if new_rank >= old_rank:
            record["status"] = status
        record["count"] = max(int(record.get("count") or 0), max(0, int(count)))
        for item in evidence:
            text = str(item).strip()
            if text and text not in record["evidence"] and len(record["evidence"]) < MAX_SAMPLES:
                record["evidence"].append(text[:300])
        for part in parts:
            text = str(part).strip()
            if text and text not in record["parts"] and len(record["parts"]) < MAX_SAMPLES:
                record["parts"].append(text[:300])
        for key, value in extra.items():
            if isinstance(value, (str, int, float, bool, list, dict, type(None))):
                record[key] = value

    def _read(self, archive: zipfile.ZipFile, name: str,
              limit: int = MAX_PART_BYTES) -> str:
        try:
            info = archive.getinfo(name)
        except KeyError:
            return ""
        if int(info.file_size or 0) > limit:
            self._warn(f"{name}: part exceeds {limit} byte read limit")
            return ""
        try:
            with archive.open(info) as handle:
                raw = handle.read(limit)
        except Exception as exc:  # noqa: BLE001 - one corrupt part must not kill analysis
            self._warn(f"{name}: unreadable ({str(exc)[:120]})")
            return ""
        if b"<!DOCTYPE" in raw[:4096].upper():
            self._warn(f"{name}: DOCTYPE declaration skipped")
            return ""
        return raw.decode("utf-8", errors="replace")

    @staticmethod
    def _parse(text: str) -> Optional[ET.Element]:
        if not text:
            return None
        try:
            return ET.fromstring(text)
        except ET.ParseError:
            return None

    def _inspect_archive(self, archive: zipfile.ZipFile,
                         features: Dict[str, Dict[str, Any]]) -> None:
        names = sorted(archive.namelist())
        lowered = {name: name.lower() for name in names}
        content_types = self._read(archive, "[Content_Types].xml")
        workbook_xml = self._read(archive, "xl/workbook.xml")
        workbook_root = self._parse(workbook_xml)
        relationships_xml = self._read(archive, "xl/_rels/workbook.xml.rels")
        relationships_root = self._parse(relationships_xml)

        self._inspect_workbook_xml(workbook_root, features)
        sheet_parts = self._sheet_parts(workbook_root, relationships_root, names)
        for sheet_name, part in sheet_parts:
            self._inspect_worksheet(
                self._read(archive, part), sheet_name, part, features)

        self._inspect_parts(
            archive, names, lowered, content_types, workbook_root, features)

    def _inspect_workbook_xml(self, root: Optional[ET.Element],
                              features: Dict[str, Dict[str, Any]]) -> None:
        if root is None:
            return
        main = f"{{{_NS_MAIN}}}"
        defined_names: List[str] = []
        print_names: List[str] = []
        for node in root.iter(main + "definedName"):
            name = str(node.get("name") or "").strip()
            if not name:
                continue
            if name.startswith(("_xlnm.Print_Titles", "_xlnm.Print_Area")):
                print_names.append(name)
            elif not name.startswith("_xlnm."):
                defined_names.append(name)
        if defined_names:
            self._mark(
                features, "defined_names", status="PRESENT", count=len(defined_names),
                evidence=["Defined names detected: " + ", ".join(defined_names[:MAX_SAMPLES])],
            )
        if print_names:
            self._mark(
                features, "print_setup", status="CONFIGURED", count=len(print_names),
                evidence=["Print-defined names detected: " + ", ".join(list(dict.fromkeys(print_names))[:MAX_SAMPLES])],
            )
        protections = [node for node in root.iter(main + "workbookProtection")
                       if _meaningful_attributes(node)]
        if protections:
            self._mark(
                features, "protection", status="CONFIGURED", count=len(protections),
                evidence=["Workbook protection metadata detected."],
            )

    @staticmethod
    def _sheet_parts(root: Optional[ET.Element],
                     rel_root: Optional[ET.Element],
                     names: Sequence[str]) -> List[Tuple[str, str]]:
        rel_map: Dict[str, str] = {}
        if rel_root is not None:
            for rel in rel_root.iter(f"{{{_NS_PACKAGE_REL}}}Relationship"):
                rel_id = str(rel.get("Id") or "")
                if rel_id:
                    rel_map[rel_id] = _normalise_target(str(rel.get("Target") or ""))
        results: List[Tuple[str, str]] = []
        if root is not None:
            for index, sheet in enumerate(root.iter(f"{{{_NS_MAIN}}}sheet"), start=1):
                name = str(sheet.get("name") or f"Sheet{index}")
                rid = str(sheet.get(f"{{{_NS_OFFICE_REL}}}id") or "")
                path = rel_map.get(rid) or f"xl/worksheets/sheet{index}.xml"
                if path in names:
                    results.append((name, path))
        if not results:
            results = [
                (f"Sheet{index}", name)
                for index, name in enumerate(
                    (n for n in names if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", n)),
                    start=1,
                )
            ]
        return results

    def _inspect_worksheet(self, text: str, sheet_name: str, part: str,
                           features: Dict[str, Dict[str, Any]]) -> None:
        if not text:
            return
        root = self._parse(text)
        if root is None:
            self._warn(f"{part}: worksheet XML could not be parsed")
            return
        main = f"{{{_NS_MAIN}}}"
        ext_uris = {
            str(node.get("uri") or "").lower()
            for node in root.iter() if _local_name(node.tag) == "ext"
        }

        def has_ext(key: str) -> bool:
            wanted = _EXT_URIS[key]
            return any(wanted in uri for uri in ext_uris)

        # Extension-list features that openpyxl does not expose directly.
        sparkline_groups = [
            node for node in root.iter()
            if _local_name(node.tag) == "sparklineGroup"
        ]
        sparkline_cells = [
            node for node in root.iter() if _local_name(node.tag) == "sparkline"
        ]
        if has_ext("sparklines") or sparkline_groups:
            self._mark(
                features, "sparklines", status="PRESENT",
                count=max(len(sparkline_groups), len(sparkline_cells)),
                evidence=[f"Sparkline group(s) detected on '{sheet_name}'."],
                parts=[part],
            )
        if has_ext("slicers"):
            self._mark(
                features, "slicers", status="PRESENT", count=1,
                evidence=[f"Slicer extension detected on '{sheet_name}'."], parts=[part],
            )
        if has_ext("timelines"):
            self._mark(
                features, "timelines", status="PRESENT", count=1,
                evidence=[f"Timeline extension detected on '{sheet_name}'."], parts=[part],
            )
        protected_ranges = list(root.iter(main + "protectedRange"))
        if has_ext("protected_ranges") or protected_ranges:
            self._mark(
                features, "protection", status="CONFIGURED",
                count=len(protected_ranges) or 1,
                evidence=[f"Protected-range metadata detected on '{sheet_name}'."],
                parts=[part],
            )
        protected_sheets = [node for node in root.iter(main + "sheetProtection")
                            if _meaningful_attributes(node)]
        if protected_sheets:
            self._mark(
                features, "protection", status="CONFIGURED", count=len(protected_sheets),
                evidence=[f"Sheet protection metadata detected on '{sheet_name}'."],
                parts=[part],
            )

        hyperlinks = [node.get("ref") for node in root.iter(main + "hyperlink")]
        if hyperlinks:
            refs = [str(value) for value in hyperlinks if value]
            self._mark(
                features, "hyperlinks", status="PRESENT", count=len(refs),
                evidence=[f"Hyperlink cells detected on '{sheet_name}': " + ", ".join(refs[:MAX_SAMPLES])],
                parts=[part],
            )

        cf_rules = list(root.iter(main + "cfRule"))
        if cf_rules:
            types: Dict[str, int] = {}
            for rule in cf_rules:
                key = str(rule.get("type") or "unspecified")
                types[key] = types.get(key, 0) + 1
            summary = ", ".join(f"{key}={value}" for key, value in sorted(types.items()))
            self._mark(
                features, "conditional_formatting", status="CONFIGURED", count=len(cf_rules),
                evidence=[f"Conditional-format rules on '{sheet_name}': {summary}"],
                parts=[part], rule_types=types,
            )

        validations = list(root.iter(main + "dataValidation"))
        if validations:
            types = {}
            for validation in validations:
                key = str(validation.get("type") or "custom")
                types[key] = types.get(key, 0) + 1
            self._mark(
                features, "data_validation_fields", status="CONFIGURED", count=len(validations),
                evidence=[f"Data-validation rules on '{sheet_name}': "
                          + ", ".join(f"{key}={value}" for key, value in sorted(types.items()))],
                parts=[part], validation_types=types,
            )

        filters = list(root.iter(main + "autoFilter"))
        sort_states = list(root.iter(main + "sortState"))
        filter_columns = list(root.iter(main + "filterColumn"))
        if filters or sort_states:
            refs = [str(node.get("ref") or "") for node in filters if node.get("ref")]
            evidence = [f"AutoFilter/saved sort metadata detected on '{sheet_name}'."]
            if refs:
                evidence.append("Filtered ranges: " + ", ".join(refs[:MAX_SAMPLES]))
            self._mark(
                features, "sort_filter", status="CONFIGURED",
                count=len(filters) + len(sort_states) + len(filter_columns),
                evidence=evidence, parts=[part],
                has_saved_sort=bool(sort_states),
            )

        scenarios = list(root.iter(main + "scenario"))
        if scenarios:
            names = [str(node.get("name") or "") for node in scenarios if node.get("name")]
            self._mark(
                features, "scenarios", status="PRESENT", count=len(scenarios),
                evidence=["Scenario(s) detected on '" + sheet_name + "': "
                          + ", ".join(names[:MAX_SAMPLES])],
                parts=[part],
            )

        controls = [
            node for node in root.iter()
            if _local_name(node.tag) in {"control", "controlPr", "formControlPr"}
        ]
        control_markers = [
            node for node in root.iter()
            if _local_name(node.tag) in {"objectType", "fmlaLink", "fmlaRange"}
            or any(attr in str(node.attrib) for attr in ("objectType", "fmlaLink", "fmlaRange"))
        ]
        if controls or control_markers:
            self._mark(
                features, "form_controls", status="PRESENT",
                count=len(controls) + len(control_markers),
                evidence=[f"Form-control metadata detected on '{sheet_name}'."], parts=[part],
            )
        ole_nodes = [
            node for node in root.iter()
            if _local_name(node.tag) in {"oleObject", "oleObj"}
        ]
        if ole_nodes:
            self._mark(
                features, "embedded_objects", status="PRESENT", count=len(ole_nodes),
                evidence=[f"Embedded object reference detected on '{sheet_name}'."], parts=[part],
            )

        print_nodes = [
            node for node in root.iter()
            if _local_name(node.tag) in {"printOptions", "pageSetup", "headerFooter", "oddHeader", "oddFooter"}
        ]
        if print_nodes:
            self._mark(
                features, "print_setup", status="CONFIGURED", count=len(print_nodes),
                evidence=[f"Print setup metadata detected on '{sheet_name}'."], parts=[part],
            )

        formulas = list(root.iter(main + "f"))
        if formulas:
            array_count = sum(1 for node in formulas if str(node.get("t") or "") == "array")
            shared_count = sum(1 for node in formulas if str(node.get("t") or "") == "shared")
            data_table_count = sum(1 for node in formulas if str(node.get("t") or "") == "dataTable")
            formula_text = "\n".join("".join(node.itertext()) for node in formulas)
            dynamic = sorted({
                name.upper() for name in re.findall(
                    r"(?:_xlfn\.)?(XLOOKUP|XMATCH|FILTER|SORT|SORTBY|UNIQUE|SEQUENCE|RANDARRAY|LAMBDA|LET|TEXTSPLIT|TEXTJOIN)\s*\(",
                    formula_text, re.I,
                )
            })
            external_refs = len(re.findall(r"\[\d+\]", formula_text))
            evidence: List[str] = []
            count = 0
            if dynamic:
                evidence.append("Dynamic/forward-compatible functions detected: " + ", ".join(dynamic[:MAX_SAMPLES]))
                count += len(dynamic)
            if array_count:
                evidence.append(f"Array formula metadata detected ({array_count}).")
                count += array_count
            if shared_count:
                evidence.append(f"Shared formula metadata detected ({shared_count}).")
                count += shared_count
            if data_table_count:
                evidence.append(f"Data-table formula metadata detected ({data_table_count}).")
                count += data_table_count
            if external_refs:
                evidence.append(f"Formula external-reference markers detected ({external_refs}).")
                count += external_refs
            if evidence:
                self._mark(
                    features, "formula_features", status="PRESENT", count=count or len(formulas),
                    evidence=evidence, parts=[part], dynamic_functions=dynamic,
                )

    def _inspect_parts(self, archive: zipfile.ZipFile, names: Sequence[str],
                       lowered: Dict[str, str], content_types: str,
                       workbook_root: Optional[ET.Element],
                       features: Dict[str, Dict[str, Any]]) -> None:
        slicers = [n for n in names if "slicer" in lowered[n] and n.endswith(".xml")]
        if slicers:
            self._mark(
                features, "slicers", status="PRESENT", count=len(slicers),
                evidence=["Slicer package part(s) detected."], parts=slicers,
            )
        elif "slicer" in content_types.lower():
            self._mark(
                features, "slicers", status="PRESENT", count=1,
                evidence=["Slicer content type was declared in [Content_Types].xml."],
            )
        timelines = [n for n in names if "timeline" in lowered[n] and n.endswith(".xml")]
        if timelines:
            self._mark(
                features, "timelines", status="PRESENT", count=len(timelines),
                evidence=["Timeline package part(s) detected."], parts=timelines,
            )

        pivot_parts = [n for n in names
                       if (lowered[n].startswith("xl/pivottables/")
                           or lowered[n].startswith("xl/pivotcache/"))
                       and n.endswith(".xml")]
        if pivot_parts:
            self._mark(
                features, "pivot_tables", status="PRESENT", count=len(pivot_parts),
                evidence=["PivotTable definition/cache part(s) detected."], parts=pivot_parts,
            )
        chart_parts = [n for n in names
                       if "xl/charts/" in lowered[n] and n.endswith(".xml")]
        if chart_parts:
            self._mark(
                features, "charts", status="PRESENT", count=len(chart_parts),
                evidence=["Chart part(s) detected."], parts=chart_parts,
            )

        external = [n for n in names
                    if lowered[n].startswith("xl/externallinks/") and n.endswith(".xml")]
        if external:
            self._mark(
                features, "external_links", status="PRESENT", count=len(external),
                evidence=["External-link package part(s) detected."], parts=external,
            )

        connection_parts = [n for n in names
                            if n.endswith("connections.xml") or n.endswith("connection.xml")]
        connection_names: List[str] = []
        for part in connection_parts:
            text = self._read(archive, part)
            root = self._parse(text)
            if root is not None:
                for node in root.iter(f"{{{_NS_MAIN}}}connection"):
                    name = str(node.get("name") or "").strip()
                    if name:
                        connection_names.append(name)
            if "connection" in text.lower():
                connection_names.append(part)
        if connection_parts or connection_names:
            evidence = ["Connection metadata part(s) detected."]
            if connection_names:
                evidence.append("Connections: " + ", ".join(list(dict.fromkeys(connection_names))[:MAX_SAMPLES]))
            self._mark(
                features, "connections", status="PRESENT",
                count=max(len(connection_parts), len(connection_names)),
                evidence=evidence, parts=connection_parts,
            )

        query_parts = [n for n in names
                       if (n.startswith("xl/queryTables/") or "querytable" in lowered[n])
                       and n.endswith(".xml")]
        if query_parts:
            self._mark(
                features, "query_tables", status="PRESENT", count=len(query_parts),
                evidence=["Query-table part(s) detected."], parts=query_parts,
            )

        mashup_parts: List[str] = []
        for part in names:
            if not (lowered[part].startswith("customxml/") and part.endswith(".xml")):
                continue
            text = self._read(archive, part)
            lowered_text = text.lower()
            if ("datamashup" in lowered_text or "schemas.microsoft.com/datamashup" in lowered_text
                    or "powerquery" in lowered_text):
                mashup_parts.append(part)
        if mashup_parts or "datamashup" in content_types.lower():
            self._mark(
                features, "power_query", status="PRESENT",
                count=max(len(mashup_parts), 1),
                evidence=["DataMashup/Power Query package marker detected."],
                parts=mashup_parts,
            )

        model_parts = [
            n for n in names
            if lowered[n].startswith("xl/model/") or lowered[n].startswith("xl/customdata/")
            or lowered[n].endswith("item.data") or "datamodel" in lowered[n]
        ]
        if model_parts:
            self._mark(
                features, "data_model", status="PRESENT", count=len(model_parts),
                evidence=["Data-model package part(s) detected."], parts=model_parts,
            )

        dax_candidates = [
            n for n in names
            if n in model_parts or (lowered[n].startswith("customxml/") and n.endswith(".xml"))
            or n in connection_parts
        ]
        dax_functions: List[str] = []
        dax_parts: List[str] = []
        for part in dax_candidates:
            text = self._read(archive, part)
            for token in re.findall(
                    r"\b(" + "|".join(_DAX_TOKENS) + r")\s*\(", text, re.I):
                upper = token.upper()
                if upper not in dax_functions:
                    dax_functions.append(upper)
                if part not in dax_parts:
                    dax_parts.append(part)
            if re.search(r"<measure\b", text, re.I) and "dax measure marker" not in dax_parts:
                dax_parts.append(part)
        if dax_functions or dax_parts:
            evidence = []
            if dax_functions:
                evidence.append("DAX token(s) detected: " + ", ".join(dax_functions[:MAX_SAMPLES]))
            if dax_parts:
                evidence.append("DAX/model part(s) inspected: " + ", ".join(dax_parts[:MAX_SAMPLES]))
            self._mark(
                features, "dax", status="CONFIGURED", count=len(dax_functions) or len(dax_parts),
                evidence=evidence, parts=dax_parts,
            )
        elif model_parts:
            self._mark(
                features, "dax", status="UNVERIFIABLE", count=0,
                evidence=["Data-model parts were detected but DAX expressions were not readable."],
                parts=model_parts[:MAX_SAMPLES],
            )

        comments = [n for n in names
                    if n.endswith(".xml") and "comment" in lowered[n]
                    and "threadedcomment" not in lowered[n]]
        if comments:
            self._mark(
                features, "comments", status="PRESENT", count=len(comments),
                evidence=["Legacy comment part(s) detected."], parts=comments,
            )
        threaded = [n for n in names
                    if n.endswith(".xml")
                    and ("threadedcomment" in lowered[n] or "/persons/" in lowered[n])]
        if threaded:
            self._mark(
                features, "threaded_comments", status="PRESENT", count=len(threaded),
                evidence=["Threaded-comment part(s) detected."], parts=threaded,
            )

        activex = [n for n in names if "/activex/" in lowered[n]]
        if activex:
            self._mark(
                features, "activex_controls", status="PRESENT", count=len(activex),
                evidence=["ActiveX package part(s) detected."], parts=activex,
            )
        ctrl_props = [n for n in names
                      if lowered[n].startswith("xl/ctrlprops/") and n.endswith(".xml")]
        drawing_parts = [n for n in names
                         if lowered[n].startswith("xl/drawings/") and n.endswith(".xml")]
        form_drawings: List[str] = []
        control_types: List[str] = []
        for part in drawing_parts:
            text = self._read(archive, part)
            if any(token in text for token in ("formControlPr", "fmlaLink", "fmlaRange", "objectType")):
                form_drawings.append(part)
            control_types.extend(re.findall(r'objectType="([^"]+)"', text, re.I))
        if ctrl_props or form_drawings:
            evidence = ["Form-control package part(s) detected."]
            if control_types:
                evidence.append("Control types: " + ", ".join(list(dict.fromkeys(control_types))[:MAX_SAMPLES]))
            self._mark(
                features, "form_controls", status="PRESENT",
                count=len(ctrl_props) + len(form_drawings),
                evidence=evidence, parts=(ctrl_props + form_drawings),
            )
        embeddings = [
            n for n in names
            if "/embeddings/" in lowered[n] or "/oleobjects/" in lowered[n]
        ]
        ole_drawings: List[str] = []
        for part in drawing_parts:
            text = self._read(archive, part)
            if "<oleobj" in text.lower() or "oleobject" in text.lower():
                ole_drawings.append(part)
        if embeddings or ole_drawings:
            self._mark(
                features, "embedded_objects", status="PRESENT",
                count=len(embeddings) + len(ole_drawings),
                evidence=["Embedded object package part(s) detected."],
                parts=(embeddings + ole_drawings),
            )

        tables = [n for n in names
                  if lowered[n].startswith("xl/tables/") and n.endswith(".xml")]
        table_styles: List[str] = []
        for part in tables:
            text = self._read(archive, part)
            root = self._parse(text)
            if root is None:
                continue
            for node in root.iter(f"{{{_NS_MAIN}}}tableStyleInfo"):
                style = str(node.get("name") or "").strip()
                if style:
                    table_styles.append(style)
        if table_styles:
            self._mark(
                features, "table_styles", status="CONFIGURED", count=len(table_styles),
                evidence=["Table style metadata detected: " + ", ".join(list(dict.fromkeys(table_styles))[:MAX_SAMPLES])],
                parts=tables,
            )
        elif tables:
            self._mark(
                features, "table_styles", status="PRESENT", count=len(tables),
                evidence=["Table package part(s) detected without style metadata."], parts=tables,
            )

        metadata_parts = [n for n in names
                          if lowered[n].startswith("docprops/") and n.endswith(".xml")]
        if metadata_parts:
            self._mark(
                features, "document_metadata", status="PRESENT", count=len(metadata_parts),
                evidence=["Document property part(s) detected."], parts=metadata_parts,
            )
