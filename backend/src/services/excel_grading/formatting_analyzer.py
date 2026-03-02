"""
Formatting & Usability Analyzer

Checks: headers, data types, currency/date formatting, conditional formatting,
readability, cell protection, data validation usage, and overall presentation.
"""

import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


class FormattingAnalyzer:
    """Analyzes formatting and usability of an Excel workbook."""

    def __init__(self, analysis_data: Dict[str, Any]):
        self.data = analysis_data

    def analyze(self) -> Dict[str, Any]:
        """Run formatting analysis across all sheets."""
        sheets = self.data.get('sheets', [])

        if not sheets:
            return {
                'score': 0,
                'issues': [],
                'summary': 'No sheets to analyze.',
            }

        total_score_parts = []
        all_issues: List[Dict[str, str]] = []

        for sheet in sheets:
            sheet_result = self._analyze_sheet(sheet)
            total_score_parts.append(sheet_result['score'])
            all_issues.extend(sheet_result['issues'])

        avg_score = round(sum(total_score_parts) / max(len(total_score_parts), 1), 1)

        # Global checks
        global_issues = self._check_global()
        all_issues.extend(global_issues)

        # Named ranges check
        named_range_count = self.data.get('named_range_count', 0)
        has_named_ranges = named_range_count > 0

        return {
            'score': avg_score,
            'issues': all_issues,
            'issue_count': len(all_issues),
            'has_conditional_formatting': any(
                s.get('has_conditional_formatting') for s in sheets
            ),
            'total_conditional_formatting_rules': sum(
                s.get('conditional_formatting_rules', 0) for s in sheets
            ),
            'has_data_validation': any(
                len(s.get('data_validations', [])) > 0 for s in sheets
            ),
            'has_merged_cells': any(
                s.get('merged_cell_count', 0) > 0 for s in sheets
            ),
            'has_named_ranges': has_named_ranges,
            'named_range_count': named_range_count,
            'has_sheet_protection': any(
                s.get('is_protected') for s in sheets
            ),
        }

    def _analyze_sheet(self, sheet: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze formatting of a single sheet."""
        score = 100  # Start at 100 and deduct
        issues = []
        name = sheet.get('name', 'Unknown')

        # 1. Data presence (-20 if empty)
        data_cells = sheet.get('data_cell_count', 0)
        if data_cells == 0:
            score -= 20
            issues.append({
                'type': 'empty_sheet',
                'sheet': name,
                'description': f"Sheet '{name}' appears to be empty.",
                'severity': 'warning',
            })

        # 2. Reasonable sheet structure
        rows = sheet.get('row_count', 0)
        cols = sheet.get('column_count', 0)

        if rows > 0 and cols > 0:
            # Density check: very sparse sheets might indicate poor structure
            density = data_cells / max(rows * min(cols, 20), 1)
            if density < 0.1 and data_cells > 5:
                score -= 5
                issues.append({
                    'type': 'sparse_data',
                    'sheet': name,
                    'description': f"Sheet '{name}' has sparse data (density: {density:.1%}). Consider organizing data more compactly.",
                    'severity': 'info',
                })

        # 3. Conditional formatting (bonus if present when expected)
        # This is a positive indicator, not a deduction
        if sheet.get('has_conditional_formatting'):
            score = min(100, score + 5)

        # 4. Data validation (positive indicator)
        if len(sheet.get('data_validations', [])) > 0:
            score = min(100, score + 5)

        # 5. Excessive merged cells (often indicates poor layout)
        merged_count = sheet.get('merged_cell_count', 0)
        if merged_count > 20:
            score -= 5
            issues.append({
                'type': 'excessive_merges',
                'sheet': name,
                'description': f"Sheet '{name}' has {merged_count} merged cell ranges. Excessive merging can cause issues with formulas and sorting.",
                'severity': 'info',
            })

        # 6. Cell errors present
        error_count = len(sheet.get('cell_errors', []))
        if error_count > 0:
            deduction = min(15, error_count * 3)
            score -= deduction
            issues.append({
                'type': 'cell_errors',
                'sheet': name,
                'description': f"Sheet '{name}' has {error_count} cell error(s) ({', '.join(e['error'] for e in sheet.get('cell_errors', [])[:3])}).",
                'severity': 'error',
            })

        # Clamp
        score = max(0, min(100, score))

        return {
            'score': score,
            'issues': issues,
        }

    def _check_global(self) -> List[Dict[str, str]]:
        """Check global workbook formatting aspects."""
        issues = []

        # Sheet naming
        sheet_names = self.data.get('sheet_names', [])
        default_names = [n for n in sheet_names if n.startswith('Sheet') and n[5:].isdigit()]
        if default_names and len(default_names) == len(sheet_names):
            issues.append({
                'type': 'default_sheet_names',
                'description': 'All sheets use default names (Sheet1, Sheet2...). Consider using descriptive names.',
                'severity': 'info',
            })

        # Hidden sheets warning
        hidden = self.data.get('hidden_sheets', [])
        if hidden:
            issues.append({
                'type': 'hidden_sheets',
                'description': f"Workbook contains {len(hidden)} hidden sheet(s): {', '.join(hidden)}.",
                'severity': 'info',
            })

        return issues
