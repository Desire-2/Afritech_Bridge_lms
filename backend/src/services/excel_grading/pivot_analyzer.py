"""
Pivot Table Analyzer - Detection and analysis of PivotTables.

Analyses pivot caches from the OOXML package (xl/pivotTables/, xl/pivotCache/).
openpyxl has limited pivot support, so we also parse the raw XML.
"""

import logging
import re
import zipfile
from io import BytesIO
from typing import Dict, Any, List
from xml.etree import ElementTree as ET

logger = logging.getLogger(__name__)

NS = {
    'sp': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
}


class PivotAnalyzer:
    """Analyzes PivotTable presence and configuration in .xlsx/.xlsm files."""

    def __init__(self, file_bytes: bytes, analysis_data: Dict[str, Any]):
        self.file_bytes = file_bytes
        self.analysis_data = analysis_data
        self.ext = analysis_data.get('file_type', '')

    def analyze(self) -> Dict[str, Any]:
        """Detect and analyze pivot tables."""
        if self.ext not in ('xlsx', 'xlsm'):
            return {
                'pivot_count': 0,
                'pivots': [],
                'has_pivots': False,
                'note': f'.{self.ext} files do not support pivot detection.',
            }

        try:
            pivots = self._parse_from_zip()
        except Exception as e:
            logger.warning(f"Pivot XML parsing failed: {e}")
            pivots = []

        # Merge with openpyxl-detected pivots
        openpyxl_count = self.analysis_data.get('pivot_cache_count', 0)
        sheet_pivots = []
        for sheet in self.analysis_data.get('sheets', []):
            sheet_pivots.extend(sheet.get('pivot_tables', []))

        combined = pivots if pivots else sheet_pivots
        total = max(len(combined), openpyxl_count)

        has_slicers = self._detect_slicers()
        has_calculated_fields = any(p.get('calculated_fields') for p in combined)

        return {
            'pivot_count': total,
            'pivots': combined,
            'has_pivots': total > 0,
            'has_slicers': has_slicers,
            'has_calculated_fields': has_calculated_fields,
        }

    def _parse_from_zip(self) -> List[Dict[str, Any]]:
        """Parse pivot table XML from the .xlsx zip archive."""
        buf = BytesIO(self.file_bytes)
        pivots = []

        with zipfile.ZipFile(buf, 'r') as zf:
            pivot_files = [n for n in zf.namelist()
                           if n.startswith('xl/pivotTables/') and n.endswith('.xml')]

            for pf in pivot_files:
                try:
                    with zf.open(pf) as f:
                        tree = ET.parse(f)
                        root = tree.getroot()

                    name = root.attrib.get('name', pf)
                    data_on_rows = root.attrib.get('dataOnRows', 'false')

                    # Extract pivot fields
                    fields = []
                    calculated_fields = []
                    for pfield in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}pivotField'):
                        axis = pfield.attrib.get('axis', '')
                        field_name = pfield.attrib.get('name', '')
                        fields.append({
                            'name': field_name,
                            'axis': axis,  # axisRow, axisCol, axisPage, axisValues
                        })

                    # Check for calculated fields
                    for cf in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}calculatedItem'):
                        calculated_fields.append({
                            'formula': cf.attrib.get('formula', ''),
                        })

                    # Row and column fields
                    row_fields = []
                    for rf in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}rowField'):
                        row_fields.append(rf.attrib.get('x', ''))

                    col_fields = []
                    for cf_elem in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}colField'):
                        col_fields.append(cf_elem.attrib.get('x', ''))

                    # Data fields
                    data_fields = []
                    for df in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}dataField'):
                        data_fields.append({
                            'name': df.attrib.get('name', ''),
                            'subtotal': df.attrib.get('subtotal', 'sum'),
                            'field_index': df.attrib.get('fld', ''),
                        })

                    pivots.append({
                        'name': name,
                        'source_file': pf,
                        'field_count': len(fields),
                        'row_field_count': len(row_fields),
                        'column_field_count': len(col_fields),
                        'data_field_count': len(data_fields),
                        'data_fields': data_fields,
                        'calculated_fields': calculated_fields,
                        'has_calculated_fields': len(calculated_fields) > 0,
                    })
                except Exception as e:
                    logger.debug(f"Error parsing pivot {pf}: {e}")

        return pivots

    def _detect_slicers(self) -> bool:
        """Detect presence of slicers in the workbook."""
        try:
            buf = BytesIO(self.file_bytes)
            with zipfile.ZipFile(buf, 'r') as zf:
                slicer_files = [n for n in zf.namelist()
                                if 'slicer' in n.lower()]
                return len(slicer_files) > 0
        except Exception:
            return False


def check_required_pivots(
    pivot_analysis: Dict[str, Any],
    require_pivot: bool = True,
    require_slicers: bool = False,
    require_calculated_fields: bool = False,
    min_pivots: int = 1,
) -> Dict[str, Any]:
    """
    Check pivot table requirements compliance.

    Returns:
        Compliance report with found/missing features.
    """
    issues = []
    met = 0
    total = 0

    if require_pivot:
        total += 1
        if pivot_analysis.get('pivot_count', 0) >= min_pivots:
            met += 1
        else:
            issues.append(f"Expected at least {min_pivots} PivotTable(s), found {pivot_analysis.get('pivot_count', 0)}.")

    if require_slicers:
        total += 1
        if pivot_analysis.get('has_slicers'):
            met += 1
        else:
            issues.append("Slicers were required but not found.")

    if require_calculated_fields:
        total += 1
        if pivot_analysis.get('has_calculated_fields'):
            met += 1
        else:
            issues.append("Calculated fields in PivotTable were required but not found.")

    compliance = round(met / max(total, 1) * 100, 1)

    return {
        'compliance_pct': compliance,
        'issues': issues,
        'met_requirements': met,
        'total_requirements': total,
    }
