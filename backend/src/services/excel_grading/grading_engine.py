"""
Intelligent Grading Engine

Computes scores per rubric criterion based on analysis data.
Supports: partial credit, bonus points, cheating detection.
Respects instructor rubric weights when provided.
"""

import logging
import hashlib
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Base rubric weights (used as a starting template).
# The GradingEngine dynamically zeroes out categories that are NOT in
# scope for the current assignment and redistributes weights.
BASE_RUBRIC_WEIGHTS = {
    'Formulas':      {'base_weight': 25},
    'PivotTables':   {'base_weight': 15},
    'Charts':        {'base_weight': 10},
    'PowerQuery_M':  {'base_weight': 15},
    'VBA':           {'base_weight': 15},
    'Formatting':    {'base_weight': 10},
    'Completeness':  {'base_weight': 10},
}

# Mapping from scope flag name → rubric category
_SCOPE_TO_CATEGORY = {
    'scope_formulas':    'Formulas',
    'scope_pivots':      'PivotTables',
    'scope_charts':      'Charts',
    'scope_power_query': 'PowerQuery_M',
    'scope_vba':         'VBA',
    'scope_formatting':  'Formatting',
    # Completeness is always in scope
}

# Keep a fully-weighted fallback for backward compatibility
DEFAULT_RUBRIC = {
    'Formulas':      {'max': 25, 'weight': 0.25},
    'PivotTables':   {'max': 15, 'weight': 0.15},
    'Charts':        {'max': 10, 'weight': 0.10},
    'PowerQuery_M':  {'max': 15, 'weight': 0.15},
    'VBA':           {'max': 15, 'weight': 0.15},
    'Formatting':    {'max': 10, 'weight': 0.10},
    'Completeness':  {'max': 10, 'weight': 0.10},
}

# Grade letter mapping
GRADE_MAP = [
    (90, 'A'),
    (80, 'B'),
    (70, 'C'),
    (60, 'D'),
    (0, 'F'),
]


def compute_grade_letter(percentage: float) -> str:
    """Convert percentage score to letter grade."""
    for threshold, letter in GRADE_MAP:
        if percentage >= threshold:
            return letter
    return 'F'


class GradingEngine:
    """
    Computes scores for each rubric criterion from analysis results.
    
    Inputs:
      - workbook analysis (from ExcelAnalyzer)
      - formula analysis (from FormulaAnalyzer)
      - chart analysis (from ChartAnalyzer)
      - pivot analysis (from PivotAnalyzer)
      - vba analysis (from VBAAnalyzer)
      - power query analysis (from PowerQueryAnalyzer)
      - formatting analysis (from FormattingAnalyzer)
      - assignment requirements (parsed from description)
      - instructor rubric (optional, from Rubric model)
    """

    def __init__(
        self,
        workbook_analysis: Dict[str, Any],
        formula_analysis: Dict[str, Any],
        chart_analysis: Dict[str, Any],
        pivot_analysis: Dict[str, Any],
        vba_analysis: Dict[str, Any],
        pq_analysis: Dict[str, Any],
        formatting_analysis: Dict[str, Any],
        requirements: Optional[Dict[str, Any]] = None,
        instructor_rubric: Optional[Dict[str, Any]] = None,
    ):
        self.wb = workbook_analysis
        self.formulas = formula_analysis
        self.charts = chart_analysis
        self.pivots = pivot_analysis
        self.vba = vba_analysis
        self.pq = pq_analysis
        self.formatting = formatting_analysis
        self.requirements = requirements or {}
        self.instructor_rubric = instructor_rubric

        # Use instructor rubric weights if available, otherwise defaults
        self.rubric = self._build_rubric()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def grade(self) -> Dict[str, Any]:
        """
        Compute full grading result.
        
        Returns dict with:
          - rubric_breakdown: per-criterion scores & comments
          - total_score, max_score, grade_letter
          - confidence level
          - flagged_issues
          - manual_review_required
        """
        breakdown = {}

        breakdown['Formulas'] = self._grade_formulas()
        breakdown['PivotTables'] = self._grade_pivots()
        breakdown['Charts'] = self._grade_charts()
        breakdown['PowerQuery_M'] = self._grade_power_query()
        breakdown['VBA'] = self._grade_vba()
        breakdown['Formatting'] = self._grade_formatting()
        breakdown['Completeness'] = self._grade_completeness()

        # Calculate total
        total_score = sum(b['score'] for b in breakdown.values())
        max_score = sum(b['max'] for b in breakdown.values())
        percentage = round(total_score / max(max_score, 1) * 100, 1)
        grade_letter = compute_grade_letter(percentage)

        # Determine confidence
        confidence = self._determine_confidence()

        # Cheating / anomaly detection
        flagged = self._detect_anomalies()

        # Whether manual review is needed
        manual_review = (
            confidence == 'low' or
            len(flagged) > 0 or
            self.vba.get('security', {}).get('risk_level') == 'high' or
            percentage < 30 or percentage > 95
        )

        return {
            'rubric_breakdown': breakdown,
            'total_score': round(total_score, 1),
            'max_score': max_score,
            'percentage': percentage,
            'grade': grade_letter,
            'confidence': confidence,
            'flagged_issues': flagged,
            'manual_review_required': manual_review,
        }

    # ------------------------------------------------------------------
    # Rubric building
    # ------------------------------------------------------------------

    def _build_rubric(self) -> Dict[str, Dict]:
        """
        Build rubric from instructor rubric, or dynamically from assignment
        scope flags in ``self.requirements``.

        When no instructor rubric is provided, the scope flags
        (``scope_formulas``, ``scope_pivots``, …) determine which categories
        get points.  Out-of-scope categories receive ``max: 0, weight: 0``
        so they never inflate or deflate the total.
        """
        # ── 1) Instructor rubric takes priority ──────────────────────
        if self.instructor_rubric and self.instructor_rubric.get('criteria'):
            return self._build_rubric_from_instructor()

        # ── 2) Build dynamic rubric from scope flags ─────────────────
        # Determine which categories are in scope
        in_scope: Dict[str, float] = {}
        for flag, category in _SCOPE_TO_CATEGORY.items():
            if self.requirements.get(flag, False):
                in_scope[category] = BASE_RUBRIC_WEIGHTS[category]['base_weight']

        # Completeness is always in scope
        in_scope['Completeness'] = BASE_RUBRIC_WEIGHTS['Completeness']['base_weight']

        # Formulas always in scope for Excel assignments (safety net)
        in_scope.setdefault('Formulas', BASE_RUBRIC_WEIGHTS['Formulas']['base_weight'])
        # Formatting always in scope (basic formatting matters)
        in_scope.setdefault('Formatting', BASE_RUBRIC_WEIGHTS['Formatting']['base_weight'])

        # If somehow nothing specific is in scope, fall back to full rubric
        if len(in_scope) <= 3:  # only the always-on categories
            # Check if ANY scope flag was set at all — if not, use full rubric
            any_scope_set = any(
                self.requirements.get(flag) is not None
                for flag in _SCOPE_TO_CATEGORY
            )
            if not any_scope_set:
                return dict(DEFAULT_RUBRIC)

        # Redistribute weights proportionally so they sum to 1.0 / 100 pts
        total_base = sum(in_scope.values())
        rubric: Dict[str, Dict] = {}
        for category in BASE_RUBRIC_WEIGHTS:
            if category in in_scope:
                weight = in_scope[category] / max(total_base, 1)
                max_pts = round(in_scope[category] * (100 / max(total_base, 1)), 1)
                rubric[category] = {'max': max_pts, 'weight': round(weight, 4)}
            else:
                rubric[category] = {'max': 0, 'weight': 0}

        weight_summary = ', '.join(
            f'{k}: {v["weight"]}' for k, v in rubric.items() if v['weight'] > 0
        )
        logger.info(
            f"Dynamic rubric — in-scope: {list(in_scope.keys())}, "
            f"weights: {{{weight_summary}}}"
        )
        return rubric

    def _build_rubric_from_instructor(self) -> Dict[str, Dict]:
        """Build rubric from instructor-defined criteria."""
        rubric = {}
        criteria = self.instructor_rubric['criteria']
        total_pts = self.instructor_rubric.get('total_points', 100)

        # Try to map instructor criteria to our categories
        category_keywords = {
            'Formulas': ['formula', 'function', 'calculation', 'excel function'],
            'PivotTables': ['pivot', 'pivottable', 'data model'],
            'Charts': ['chart', 'graph', 'visualization', 'visual'],
            'PowerQuery_M': ['power query', 'query', 'm language', 'etl', 'transform'],
            'VBA': ['vba', 'macro', 'code', 'programming', 'automation'],
            'Formatting': ['format', 'presentation', 'layout', 'design', 'usability'],
            'Completeness': ['complete', 'requirement', 'structure', 'overall'],
        }

        for criterion in criteria:
            crit_name = criterion.get('name', '').lower()
            crit_desc = criterion.get('description', '').lower()
            crit_max = criterion.get('max_points', 0)
            combined = f"{crit_name} {crit_desc}"

            matched = False
            for cat, keywords in category_keywords.items():
                if any(kw in combined for kw in keywords):
                    if cat not in rubric:
                        rubric[cat] = {'max': crit_max, 'weight': crit_max / max(total_pts, 1)}
                    else:
                        rubric[cat]['max'] += crit_max
                        rubric[cat]['weight'] = rubric[cat]['max'] / max(total_pts, 1)
                    matched = True
                    break

            if not matched:
                # Assign unmatched criteria to Completeness
                if 'Completeness' not in rubric:
                    rubric['Completeness'] = {'max': crit_max, 'weight': crit_max / max(total_pts, 1)}
                else:
                    rubric['Completeness']['max'] += crit_max
                    rubric['Completeness']['weight'] = rubric['Completeness']['max'] / max(total_pts, 1)

        # Fill in missing categories with 0
        for cat in DEFAULT_RUBRIC:
            if cat not in rubric:
                rubric[cat] = {'max': 0, 'weight': 0}

        return rubric

    # ------------------------------------------------------------------
    # Per-criterion grading
    # ------------------------------------------------------------------

    def _grade_formulas(self) -> Dict[str, Any]:
        """Grade the Formulas criterion."""
        max_pts = self.rubric['Formulas']['max']
        if max_pts == 0:
            return {'score': 0, 'max': 0, 'comment': 'Formulas not in rubric.'}

        formula_count = self.formulas.get('formula_count', 0)
        complexity = self.formulas.get('complexity_score', 0)
        advanced = self.formulas.get('advanced_function_count', 0)
        categories_used = len(self.formulas.get('function_categories', {}))
        error_handling = self.formulas.get('error_handling', {})
        issues = self.formulas.get('issues', [])

        score = 0
        comments = []

        if formula_count == 0:
            comments.append("No formulas found in the workbook.")
            return {'score': 0, 'max': max_pts, 'comment': ' '.join(comments)}

        # Base score from formula presence (0-30% of max)
        presence_pct = min(1.0, formula_count / 10)
        score += presence_pct * 0.3 * max_pts

        # Complexity score (0-30% of max)
        score += (complexity / 100) * 0.3 * max_pts

        # Advanced functions (0-20% of max)
        advanced_pct = min(1.0, advanced / 5)
        score += advanced_pct * 0.2 * max_pts

        # Category diversity (0-10% of max)
        diversity_pct = min(1.0, categories_used / 4)
        score += diversity_pct * 0.1 * max_pts

        # Error handling (0-10% of max)
        if error_handling.get('has_error_handling'):
            score += 0.1 * max_pts
            comments.append("Good use of error handling functions.")

        # Deductions for issues
        for issue in issues:
            if issue.get('type') == 'cell_error':
                score -= 1
            elif issue.get('type') == 'magic_numbers':
                score -= 2

        score = max(0, min(max_pts, round(score, 1)))

        # Build comment
        comments.insert(0, f"Found {formula_count} formulas across {categories_used} function categories.")
        if advanced > 0:
            comments.append(f"Used {advanced} advanced function(s): {', '.join(self.formulas.get('advanced_functions_used', [])[:5])}.")
        if self.formulas.get('error_handling', {}).get('unhandled_error_count', 0) > 0:
            comments.append(f"Warning: {self.formulas['error_handling']['unhandled_error_count']} unhandled cell error(s) detected.")

        # Check required formulas from requirements
        req_funcs = self.requirements.get('required_functions', [])
        if req_funcs:
            from .formula_analyzer import check_required_formulas
            compliance = check_required_formulas(self.formulas, req_funcs)
            if compliance['missing']:
                comments.append(f"Missing required function(s): {', '.join(compliance['missing'])}.")
                score *= compliance['compliance_pct'] / 100

        return {
            'score': round(max(0, min(max_pts, score)), 1),
            'max': max_pts,
            'comment': ' '.join(comments),
        }

    def _grade_pivots(self) -> Dict[str, Any]:
        """Grade the PivotTables criterion."""
        max_pts = self.rubric['PivotTables']['max']
        if max_pts == 0:
            return {'score': 0, 'max': 0, 'comment': 'PivotTables not in rubric.'}

        pivot_count = self.pivots.get('pivot_count', 0)
        has_slicers = self.pivots.get('has_slicers', False)
        has_calc_fields = self.pivots.get('has_calculated_fields', False)

        score = 0
        comments = []

        # Check if pivots were required
        req_pivots = self.requirements.get('require_pivots', False)
        if pivot_count == 0:
            if not req_pivots:
                # Not required and not present — category should have 0 weight
                # (handled by dynamic rubric), but be safe:
                return {'score': 0, 'max': max_pts, 'comment': 'PivotTables not present (not required for this assignment).'}
            else:
                comments.append("No PivotTables found (required by assignment).")
                return {'score': 0, 'max': max_pts, 'comment': ' '.join(comments)}

        # Base presence (60% of max)
        score += 0.6 * max_pts
        comments.append(f"Found {pivot_count} PivotTable(s).")

        # Slicers (20% of max)
        if has_slicers:
            score += 0.2 * max_pts
            comments.append("Slicers detected.")

        # Calculated fields (20% of max)
        if has_calc_fields:
            score += 0.2 * max_pts
            comments.append("Calculated fields present.")

        # Data fields analysis
        pivots_data = self.pivots.get('pivots', [])
        total_data_fields = sum(p.get('data_field_count', 0) for p in pivots_data)
        if total_data_fields > 0:
            comments.append(f"{total_data_fields} data field(s) configured.")

        return {
            'score': round(min(max_pts, score), 1),
            'max': max_pts,
            'comment': ' '.join(comments),
        }

    def _grade_charts(self) -> Dict[str, Any]:
        """Grade the Charts criterion."""
        max_pts = self.rubric['Charts']['max']
        if max_pts == 0:
            return {'score': 0, 'max': 0, 'comment': 'Charts not in rubric.'}

        chart_count = self.charts.get('chart_count', 0)
        chart_types = self.charts.get('chart_types', [])
        issues = self.charts.get('issues', [])

        score = 0
        comments = []

        req_charts = self.requirements.get('require_charts', False)
        if chart_count == 0:
            if not req_charts:
                return {'score': 0, 'max': max_pts, 'comment': 'Charts not present (not required for this assignment).'}
            else:
                comments.append("No charts found (required by assignment).")
                return {'score': 0, 'max': max_pts, 'comment': ' '.join(comments)}

        # Presence (50% of max)
        score += 0.5 * max_pts
        comments.append(f"Found {chart_count} chart(s) of type(s): {', '.join(chart_types)}.")

        # Type diversity (25% of max)
        diversity_pct = min(1.0, len(chart_types) / 3)
        score += diversity_pct * 0.25 * max_pts

        # Titles and labels (25% of max)
        untitled = sum(1 for i in issues if i.get('type') == 'missing_chart_title')
        if untitled == 0:
            score += 0.25 * max_pts
            comments.append("All charts have titles.")
        else:
            # Partial credit
            titled_pct = (chart_count - untitled) / max(chart_count, 1)
            score += titled_pct * 0.25 * max_pts
            comments.append(f"{untitled} chart(s) missing titles.")

        return {
            'score': round(min(max_pts, score), 1),
            'max': max_pts,
            'comment': ' '.join(comments),
        }

    def _grade_power_query(self) -> Dict[str, Any]:
        """Grade the Power Query / M criterion."""
        max_pts = self.rubric['PowerQuery_M']['max']
        if max_pts == 0:
            return {'score': 0, 'max': 0, 'comment': 'Power Query not in rubric.'}

        has_pq = self.pq.get('has_power_query', False)
        query_count = self.pq.get('query_count', 0)
        all_trans = self.pq.get('all_transformations', [])
        total_steps = self.pq.get('total_steps', 0)

        score = 0
        comments = []

        req_pq = self.requirements.get('require_power_query', False)
        if not has_pq:
            if req_pq:
                comments.append("Power Query was required but not found.")
                return {'score': 0, 'max': max_pts, 'comment': ' '.join(comments)}
            return {'score': 0, 'max': max_pts, 'comment': 'Power Query not present (not required for this assignment).'}

        # Presence (30% of max)
        score += 0.3 * max_pts
        comments.append(f"Found {query_count} Power Query query(ies) with {total_steps} step(s).")

        # Transformation diversity (30% of max)
        trans_pct = min(1.0, len(all_trans) / 5)
        score += trans_pct * 0.3 * max_pts
        if all_trans:
            comments.append(f"Transformations: {', '.join(all_trans[:5])}.")

        # Complexity (20% of max)
        max_complexity = max(
            (q.get('complexity_score', 0) for q in self.pq.get('queries', [])),
            default=0
        )
        score += (max_complexity / 100) * 0.2 * max_pts

        # Advanced features: merge, group by (20% of max)
        queries = self.pq.get('queries', [])
        has_merge = any(q.get('has_merge') for q in queries)
        has_group = any(q.get('has_group_by') for q in queries)
        advanced_bonus = (0.1 * max_pts if has_merge else 0) + (0.1 * max_pts if has_group else 0)
        score += advanced_bonus

        if has_merge:
            comments.append("Merge (join) operations detected.")
        if has_group:
            comments.append("Group-by operations detected.")

        return {
            'score': round(min(max_pts, score), 1),
            'max': max_pts,
            'comment': ' '.join(comments),
        }

    def _grade_vba(self) -> Dict[str, Any]:
        """Grade the VBA criterion."""
        max_pts = self.rubric['VBA']['max']
        if max_pts == 0:
            return {'score': 0, 'max': 0, 'comment': 'VBA not in rubric.'}

        has_vba = self.vba.get('has_vba', False)
        module_count = self.vba.get('module_count', 0)
        total_procs = self.vba.get('total_procedures', 0)
        total_lines = self.vba.get('total_lines', 0)
        security = self.vba.get('security', {})
        quality = self.vba.get('code_quality', {})
        automation = self.vba.get('automation_patterns', [])

        score = 0
        comments = []

        req_vba = self.requirements.get('require_vba', False)
        if not has_vba:
            if req_vba:
                comments.append("VBA macros were required but not found.")
                return {'score': 0, 'max': max_pts, 'comment': ' '.join(comments)}
            return {'score': 0, 'max': max_pts, 'comment': 'VBA not present (not required for this assignment).'}

        # Security check first - deduct heavily for dangerous code
        if security.get('risk_level') == 'high':
            comments.append("⚠️ HIGH SECURITY RISK: Potentially dangerous VBA code detected. Manual review required.")
            return {
                'score': 0,
                'max': max_pts,
                'comment': ' '.join(comments),
            }

        # Presence & structure (30% of max)
        score += 0.3 * max_pts
        comments.append(f"Found {module_count} VBA module(s) with {total_procs} procedure(s), {total_lines} lines.")

        # Code quality (30% of max)
        quality_score = quality.get('score', 0)
        score += (quality_score / 100) * 0.3 * max_pts
        if quality.get('practices_found'):
            comments.append(f"Quality practices: {', '.join(quality['practices_found'][:3])}.")

        # Automation patterns (20% of max)
        auto_pct = min(1.0, len(automation) / 4)
        score += auto_pct * 0.2 * max_pts
        if automation:
            comments.append(f"Automation: {', '.join(a['pattern'] for a in automation[:3])}.")

        # Modularity (20% of max)
        modularity = quality.get('modularity', {})
        if modularity.get('total_procedures', 0) >= 2:
            score += 0.1 * max_pts
        if modularity.get('module_count', 0) >= 2:
            score += 0.1 * max_pts

        # Deductions
        if quality.get('naming_issues'):
            score -= min(3, len(quality['naming_issues']))
            comments.append(f"{len(quality['naming_issues'])} naming convention issue(s).")

        if security.get('risk_level') == 'medium':
            score -= 3
            comments.append("⚠️ Some security concerns in VBA code.")

        return {
            'score': round(max(0, min(max_pts, score)), 1),
            'max': max_pts,
            'comment': ' '.join(comments),
        }

    def _grade_formatting(self) -> Dict[str, Any]:
        """Grade the Formatting criterion."""
        max_pts = self.rubric['Formatting']['max']
        if max_pts == 0:
            return {'score': 0, 'max': 0, 'comment': 'Formatting not in rubric.'}

        fmt_score = self.formatting.get('score', 0)
        has_cf = self.formatting.get('has_conditional_formatting', False)
        has_dv = self.formatting.get('has_data_validation', False)
        has_nr = self.formatting.get('has_named_ranges', False)
        issues = self.formatting.get('issues', [])

        # Map formatting score (0-100) to points
        score = (fmt_score / 100) * max_pts
        comments = []

        if has_cf:
            comments.append("Conditional formatting applied.")
        if has_dv:
            comments.append("Data validation rules present.")
        if has_nr:
            comments.append(f"{self.formatting.get('named_range_count', 0)} named range(s) defined.")

        error_issues = [i for i in issues if i.get('severity') == 'error']
        if error_issues:
            comments.append(f"{len(error_issues)} formatting error(s) found.")

        if not comments:
            comments.append("Basic formatting present.")

        return {
            'score': round(max(0, min(max_pts, score)), 1),
            'max': max_pts,
            'comment': ' '.join(comments),
        }

    def _grade_completeness(self) -> Dict[str, Any]:
        """Grade overall completeness and compliance with requirements."""
        max_pts = self.rubric['Completeness']['max']
        if max_pts == 0:
            return {'score': 0, 'max': 0, 'comment': 'Completeness not in rubric.'}

        score = 0
        comments = []

        # Sheet structure compliance
        req_sheets = self.requirements.get('required_sheets', [])
        actual_sheets = set(s.lower() for s in self.wb.get('sheet_names', []))

        if req_sheets:
            found = sum(1 for s in req_sheets if s.lower() in actual_sheets)
            total = len(req_sheets)
            sheet_pct = found / max(total, 1)
            score += sheet_pct * 0.4 * max_pts
            if found < total:
                missing = [s for s in req_sheets if s.lower() not in actual_sheets]
                comments.append(f"Missing required sheet(s): {', '.join(missing)}.")
            else:
                comments.append("All required sheets present.")
        else:
            # No specific sheet requirements – give base credit for having data
            if self.wb.get('total_data_cells', 0) > 0:
                score += 0.4 * max_pts

        # Data presence
        if self.wb.get('total_data_cells', 0) > 10:
            score += 0.2 * max_pts
            comments.append(f"Workbook contains {self.wb.get('total_data_cells', 0)} data cells across {self.wb.get('sheet_count', 0)} sheet(s).")
        elif self.wb.get('total_data_cells', 0) > 0:
            score += 0.1 * max_pts
            comments.append("Workbook has minimal data.")
        else:
            comments.append("Workbook appears to be empty.")

        # Formula presence (when required)
        if self.wb.get('total_formulas', 0) > 0:
            score += 0.2 * max_pts

        # File type compliance
        req_types = self.requirements.get('required_file_types', [])
        if req_types and self.wb.get('file_type') not in req_types:
            comments.append(f"File type .{self.wb.get('file_type')} may not match requirements.")
            score -= 2
        else:
            score += 0.1 * max_pts

        # Submission not empty
        if self.wb.get('sheet_count', 0) > 0:
            score += 0.1 * max_pts

        return {
            'score': round(max(0, min(max_pts, score)), 1),
            'max': max_pts,
            'comment': ' '.join(comments) if comments else 'Completeness evaluated.',
        }

    # ------------------------------------------------------------------
    # Confidence & anomaly detection
    # ------------------------------------------------------------------

    def _determine_confidence(self) -> str:
        """Determine grading confidence level."""
        # Low confidence triggers
        low_triggers = 0

        # VBA that couldn't be fully analyzed
        if self.vba.get('has_vba') and self.vba.get('module_count', 0) == 1:
            modules = self.vba.get('modules', [])
            if modules and modules[0].get('type') == 'binary':
                low_triggers += 1

        # Very few formulas in what should be an Excel assignment
        if self.formulas.get('formula_count', 0) < 3:
            low_triggers += 1

        # File errors
        if self.wb.get('error'):
            low_triggers += 2

        # .xls or .csv with limited analysis
        if self.wb.get('file_type') in ('xls', 'csv'):
            low_triggers += 1

        if low_triggers >= 3:
            return 'low'
        elif low_triggers >= 1:
            return 'medium'
        return 'high'

    def _detect_anomalies(self) -> List[Dict[str, str]]:
        """Detect cheating, copy-paste, and suspicious patterns."""
        flagged = []

        # 1. Empty submission
        if self.wb.get('total_data_cells', 0) == 0:
            flagged.append({
                'type': 'empty_submission',
                'description': 'Workbook appears to be empty or has no data.',
            })

        # 2. VBA security issues
        security = self.vba.get('security', {})
        if security.get('risk_level') in ('high', 'medium'):
            for issue in security.get('issues', []):
                flagged.append({
                    'type': 'vba_security',
                    'description': f"VBA security concern: {issue['pattern']} in module(s): {', '.join(issue.get('modules', []))}",
                })

        # 3. Template detection (suspiciously perfect default structure)
        sheet_names = self.wb.get('sheet_names', [])
        if len(sheet_names) == 3 and all(s.startswith('Sheet') for s in sheet_names):
            if self.wb.get('total_formulas', 0) > 50:
                flagged.append({
                    'type': 'possible_template',
                    'description': 'Workbook uses default sheet names but has many formulas – possible template copy.',
                })

        # 4. Hidden sheets with data (possible cheating)
        hidden = self.wb.get('hidden_sheets', [])
        if hidden:
            flagged.append({
                'type': 'hidden_sheets',
                'description': f"Hidden sheet(s) detected: {', '.join(hidden)}. Verify content is appropriate.",
            })

        return flagged
