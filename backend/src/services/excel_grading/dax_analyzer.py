"""Best-effort deterministic DAX measure evidence extractor.

Excel's Data Model is stored in binary/XML parts that vary by Office version.
This analyzer reports only tokens actually found in the OOXML package; it
never infers a measure merely because a PivotTable exists.
"""

import logging
import re
import zipfile
from io import BytesIO
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

DAX_FUNCTIONS = (
    "SUMX", "CALCULATE", "FILTER", "ALL", "DIVIDE", "SUM", "AVERAGE",
    "COUNTROWS", "DISTINCTCOUNT", "AVERAGEX", "COUNTX", "RELATED", "VALUES",
)


class DAXAnalyzer:
    def __init__(self, file_bytes: bytes, analysis_data: Dict[str, Any]):
        self.file_bytes = file_bytes
        self.analysis_data = analysis_data

    def analyze(self) -> Dict[str, Any]:
        if self.analysis_data.get("file_type") not in ("xlsx", "xlsm"):
            return {"has_dax": False, "measure_count": 0, "functions_used": [], "measures": []}

        fragments: List[str] = []
        try:
            with zipfile.ZipFile(BytesIO(self.file_bytes), "r") as archive:
                total_size = sum(info.file_size for info in archive.infolist())
                if total_size > 200 * 1024 * 1024:
                    return {"has_dax": False, "measure_count": 0, "functions_used": [], "measures": [], "error": "decompressed_size_limit"}
                for name in archive.namelist():
                    lowered = name.lower()
                    if any(token in lowered for token in ("model", "pivotcache", "customxml", "connections")) and name.endswith((".xml", ".bin")):
                        try:
                            fragments.append(archive.read(name).decode("utf-8", errors="ignore"))
                        except Exception:
                            continue
        except Exception as exc:
            logger.debug("DAX package analysis failed: %s", exc)
            return {"has_dax": False, "measure_count": 0, "functions_used": [], "measures": [], "error": str(exc)}

        content = "\n".join(fragments)
        functions = sorted({fn for fn in DAX_FUNCTIONS if re.search(r"\b" + re.escape(fn) + r"\s*\(", content, re.I)})
        measure_names = list(dict.fromkeys(re.findall(r"(?:measure|name=)[\"']([^\"']+)[\"']", content, re.I)))
        has_dax = bool(functions or measure_names or re.search(r"\bDAX\b|<measure", content, re.I))
        return {
            "has_dax": has_dax,
            "measure_count": len(measure_names),
            "functions_used": functions,
            "measures": [{"name": name} for name in measure_names[:100]],
            "evidence": [f"DAX function {fn} detected in model package" for fn in functions],
        }

