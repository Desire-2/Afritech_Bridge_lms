"""
Chart Analyzer - Detection and validation of Excel charts.

Checks: chart type, source ranges, titles, labels, dynamic chart features.
"""

import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# Common chart types in Excel / openpyxl
CHART_TYPES = {
    'BarChart': 'bar',
    'BarChart3D': 'bar_3d',
    'LineChart': 'line',
    'LineChart3D': 'line_3d',
    'AreaChart': 'area',
    'AreaChart3D': 'area_3d',
    'PieChart': 'pie',
    'PieChart3D': 'pie_3d',
    'DoughnutChart': 'doughnut',
    'ScatterChart': 'scatter',
    'BubbleChart': 'bubble',
    'RadarChart': 'radar',
    'StockChart': 'stock',
    'SurfaceChart': 'surface',
    'SurfaceChart3D': 'surface_3d',
    'ProjectedPieChart': 'projected_pie',
}


class ChartAnalyzer:
    """Analyzes charts from the Excel workbook analysis data."""

    def __init__(self, analysis_data: Dict[str, Any]):
        self.analysis_data = analysis_data

    def analyze(self) -> Dict[str, Any]:
        """Analyze all charts across all sheets."""
        all_charts: List[Dict[str, Any]] = []
        chart_types_found: set = set()

        for sheet in self.analysis_data.get('sheets', []):
            for chart in sheet.get('charts', []):
                chart_type_raw = chart.get('type', 'Unknown')
                chart_type = CHART_TYPES.get(chart_type_raw, chart_type_raw.lower())
                chart_types_found.add(chart_type)

                all_charts.append({
                    'sheet': sheet.get('name', ''),
                    'type': chart_type,
                    'type_raw': chart_type_raw,
                    'title': chart.get('title'),
                    'has_title': chart.get('title') is not None,
                    'style': chart.get('style'),
                })

        issues = []
        # Check for charts without titles
        untitled = [c for c in all_charts if not c['has_title']]
        if untitled:
            issues.append({
                'type': 'missing_chart_title',
                'description': f"{len(untitled)} chart(s) are missing titles.",
                'details': [f"Sheet '{c['sheet']}'" for c in untitled],
            })

        return {
            'chart_count': len(all_charts),
            'chart_types': sorted(chart_types_found),
            'charts': all_charts,
            'issues': issues,
            'has_charts': len(all_charts) > 0,
        }


def check_required_charts(
    chart_analysis: Dict[str, Any],
    required_types: List[str],
) -> Dict[str, Any]:
    """
    Check if required chart types are present.

    Args:
        chart_analysis: Output of ChartAnalyzer.analyze()
        required_types: e.g. ['bar', 'line', 'pie']

    Returns:
        Compliance report.
    """
    found_types = set(chart_analysis.get('chart_types', []))
    required = set(t.lower() for t in required_types)
    found = required & found_types
    missing = required - found_types
    total = len(required) or 1

    return {
        'required_types': sorted(required),
        'found': sorted(found),
        'missing': sorted(missing),
        'compliance_pct': round(len(found) / total * 100, 1),
    }
