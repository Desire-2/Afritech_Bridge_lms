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
        mastery_level: Optional[Dict[str, Any]] = None,
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

        # Mastery level context (from detect_mastery_level())
        self.mastery_level = mastery_level or {}
        self.level_id = self.mastery_level.get('level_id', 'intermediate')
        self.level_expectations = self.mastery_level.get('scoring_expectations', {})

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

        # Strengths & weaknesses analysis
        strengths, weaknesses = self._analyze_strengths_weaknesses(breakdown)

        return {
            'rubric_breakdown': breakdown,
            'total_score': round(total_score, 1),
            'max_score': max_score,
            'percentage': percentage,
            'grade': grade_letter,
            'confidence': confidence,
            'flagged_issues': flagged,
            'manual_review_required': manual_review,
            'strengths': strengths,
            'weaknesses': weaknesses,
            'mastery_level': {
                'level_id': self.level_id,
                'level_name': self.mastery_level.get('level_name', 'Intermediate'),
                'level_number': self.mastery_level.get('level_number', 2),
                'confidence': self.mastery_level.get('confidence', 'medium'),
            },
        }

    # ------------------------------------------------------------------
    # Strengths & weaknesses analysis
    # ------------------------------------------------------------------

    def _analyze_strengths_weaknesses(
        self, breakdown: Dict[str, Dict[str, Any]]
    ) -> Tuple[List[str], List[str]]:
        """Derive student strengths and weaknesses from rubric breakdown."""
        strengths: List[str] = []
        weaknesses: List[str] = []

        for criterion, result in breakdown.items():
            max_pts = result.get('max', 0)
            if max_pts == 0:
                continue
            score = result.get('score', 0)
            pct = score / max_pts * 100

            label = criterion.replace('_', ' ').replace('PowerQuery M', 'Power Query')

            if pct >= 85:
                strengths.append(f"Strong {label} skills ({score}/{max_pts})")
            elif pct >= 70:
                strengths.append(f"Good {label} foundation ({score}/{max_pts})")
            elif pct >= 40:
                weaknesses.append(f"{label} needs improvement ({score}/{max_pts})")
            else:
                weaknesses.append(f"{label} requires significant work ({score}/{max_pts})")

        # Add specific insights from analysis data
        formula_count = self.formulas.get('formula_count', 0)
        unique_funcs = len(self.formulas.get('unique_functions', []))
        if unique_funcs >= 10:
            strengths.append(f"Diverse formula vocabulary ({unique_funcs} unique functions)")
        elif formula_count > 0 and unique_funcs <= 2:
            weaknesses.append("Limited formula variety — try exploring more functions")

        if self.formulas.get('has_nested', False):
            strengths.append("Uses nested/complex formulas")

        if self.charts.get('chart_count', 0) >= 3:
            strengths.append(f"Multiple chart visualizations ({self.charts['chart_count']} charts)")

        if self.pivots.get('pivot_count', 0) >= 2:
            strengths.append("Multiple pivot tables for data analysis")

        if self.vba.get('has_vba') and self.vba.get('module_count', 0) >= 2:
            strengths.append("Multi-module VBA project")

        if self.formatting.get('conditional_formatting', {}).get('rule_count', 0) > 0:
            strengths.append("Uses conditional formatting for data visualization")

        return strengths[:6], weaknesses[:6]

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
        """Grade the Formulas criterion — level-aware scoring."""
        max_pts = self.rubric['Formulas']['max']
        if max_pts == 0:
            return {'score': 0, 'max': 0, 'comment': 'Formulas not in rubric.'}

        formula_count = self.formulas.get('formula_count', 0)
        complexity = self.formulas.get('complexity_score', 0)
        advanced = self.formulas.get('advanced_function_count', 0)
        expert = self.formulas.get('expert_function_count', 0)
        categories_used = self.formulas.get('category_count', len(self.formulas.get('function_categories', {})))
        error_handling = self.formulas.get('error_handling', {})
        issues = self.formulas.get('issues', [])

        score = 0
        comments = []

        if formula_count == 0:
            comments.append("No formulas found in the workbook.")
            return {'score': 0, 'max': max_pts, 'comment': ' '.join(comments)}

        # Get level-specific scoring parameters
        lvl = self.level_expectations.get('Formulas', {})
        min_formulas = lvl.get('min_formulas', 10)
        min_categories = lvl.get('min_categories', 3)
        min_advanced = lvl.get('min_advanced', 2)

        # Dynamic weights based on mastery level
        w_presence = lvl.get('presence_weight', 0.3)
        w_complexity = lvl.get('complexity_weight', 0.25)
        w_diversity = lvl.get('diversity_weight', 0.15)
        w_advanced = lvl.get('advanced_weight', 0.2)
        w_error = lvl.get('error_handling_weight', 0.1)

        # Base score from formula presence
        presence_pct = min(1.0, formula_count / max(min_formulas, 1))
        score += presence_pct * w_presence * max_pts

        # Complexity score
        score += (complexity / 100) * w_complexity * max_pts

        # Advanced functions
        if min_advanced > 0:
            advanced_pct = min(1.0, advanced / max(min_advanced, 1))
        else:
            # Foundation level: any advanced function is a bonus
            advanced_pct = min(1.0, advanced / 3) if advanced > 0 else 0
        score += advanced_pct * w_advanced * max_pts

        # Category diversity
        diversity_pct = min(1.0, categories_used / max(min_categories, 1))
        score += diversity_pct * w_diversity * max_pts

        # Error handling
        if error_handling.get('has_error_handling'):
            score += w_error * max_pts
            comments.append("Good use of error handling functions.")

        # Bonus for expert-tier functions (LAMBDA, LET, MAP, etc.)
        if expert > 0 and self.level_id in ('advanced', 'expert'):
            bonus = min(3, expert) * 0.5  # up to 1.5 bonus points
            score += bonus
            comments.append(f"Impressive use of {expert} expert-tier function(s): {', '.join(self.formulas.get('expert_functions_used', [])[:3])}.")

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
        """Grade the PivotTables criterion — level-aware scoring."""
        max_pts = self.rubric['PivotTables']['max']
        if max_pts == 0:
            return {'score': 0, 'max': 0, 'comment': 'PivotTables not in rubric.'}

        pivot_count = self.pivots.get('pivot_count', 0)
        has_slicers = self.pivots.get('has_slicers', False)
        has_calc_fields = self.pivots.get('has_calculated_fields', False)

        score = 0
        comments = []

        # Get level expectations
        lvl = self.level_expectations.get('PivotTables', {})
        pivot_expected = lvl.get('expected', True)
        min_pivots = lvl.get('min_pivots', 1)
        slicers_expected = lvl.get('slicers_expected', False)
        calc_fields_expected = lvl.get('calc_fields_expected', False)

        # Check if pivots were required
        req_pivots = self.requirements.get('require_pivots', False)
        if pivot_count == 0:
            if not req_pivots and not pivot_expected:
                return {'score': 0, 'max': max_pts, 'comment': 'PivotTables not present (not required for this assignment).'}
            elif req_pivots or pivot_expected:
                comments.append("No PivotTables found (expected for this assignment level).")
                return {'score': 0, 'max': max_pts, 'comment': ' '.join(comments)}
            else:
                return {'score': 0, 'max': max_pts, 'comment': 'PivotTables not present (not required for this assignment).'}

        # Pivot presence — scaled by level expectations
        if self.level_id == 'foundation':
            # Foundation: any pivot is great — bonus territory
            score += 0.8 * max_pts
            comments.append(f"Excellent! Found {pivot_count} PivotTable(s) — above expectations for this level.")
        elif self.level_id == 'intermediate':
            # Intermediate: basic pivot expected
            base_pct = min(1.0, pivot_count / max(min_pivots, 1))
            score += base_pct * 0.6 * max_pts
            comments.append(f"Found {pivot_count} PivotTable(s).")
            # Slicers and calc fields are bonus
            if has_slicers:
                score += 0.2 * max_pts
                comments.append("Slicers detected — excellent for this level!")
            if has_calc_fields:
                score += 0.2 * max_pts
                comments.append("Calculated fields present — above expectations!")
        else:
            # Advanced/Expert: expect sophistication
            base_pct = min(1.0, pivot_count / max(min_pivots, 1))
            score += base_pct * 0.4 * max_pts
            comments.append(f"Found {pivot_count} PivotTable(s).")

            if has_slicers:
                score += 0.2 * max_pts
                comments.append("Slicers detected.")
            elif slicers_expected:
                comments.append("Slicers expected at this level but not found.")

            if has_calc_fields:
                score += 0.2 * max_pts
                comments.append("Calculated fields present.")
            elif calc_fields_expected:
                comments.append("Calculated fields expected at this level but not found.")

            # Data field diversity
            pivots_data = self.pivots.get('pivots', [])
            total_data_fields = sum(p.get('data_field_count', 0) for p in pivots_data)
            if total_data_fields >= 3:
                score += 0.2 * max_pts
                comments.append(f"{total_data_fields} data field(s) — good analytical depth.")
            elif total_data_fields > 0:
                score += 0.1 * max_pts
                comments.append(f"{total_data_fields} data field(s) configured.")

        return {
            'score': round(min(max_pts, score), 1),
            'max': max_pts,
            'comment': ' '.join(comments),
        }

    def _grade_charts(self) -> Dict[str, Any]:
        """Grade the Charts criterion — level-aware scoring."""
        max_pts = self.rubric['Charts']['max']
        if max_pts == 0:
            return {'score': 0, 'max': 0, 'comment': 'Charts not in rubric.'}

        chart_count = self.charts.get('chart_count', 0)
        chart_types = self.charts.get('chart_types', [])
        issues = self.charts.get('issues', [])

        score = 0
        comments = []

        # Level expectations
        lvl = self.level_expectations.get('Charts', {})
        chart_expected = lvl.get('expected', True)
        min_charts = lvl.get('min_charts', 1)
        require_titles = lvl.get('require_titles', True)
        diversity_weight = lvl.get('diversity_weight', 0.25)

        req_charts = self.requirements.get('require_charts', False)
        if chart_count == 0:
            if not req_charts and not chart_expected:
                return {'score': 0, 'max': max_pts, 'comment': 'Charts not present (not required for this assignment).'}
            elif req_charts or chart_expected:
                return {'score': 0, 'max': max_pts, 'comment': 'No charts found (expected for this assignment level).'}
            return {'score': 0, 'max': max_pts, 'comment': 'Charts not present (not required for this assignment).'}

        # Presence — scaled by level
        presence_pct = min(1.0, chart_count / max(min_charts, 1))
        presence_weight = 0.5 - (diversity_weight - 0.25)  # balance with diversity
        score += presence_pct * max(0.3, presence_weight) * max_pts
        comments.append(f"Found {chart_count} chart(s) of type(s): {', '.join(chart_types)}.")

        # Type diversity — weighted by level
        if self.level_id == 'foundation':
            # Foundation: any chart type is fine
            diversity_pct = min(1.0, len(chart_types) / 2)
        elif self.level_id == 'intermediate':
            diversity_pct = min(1.0, len(chart_types) / 3)
        else:
            # Advanced/Expert: expect more chart type variety
            diversity_pct = min(1.0, len(chart_types) / 4)
            # Bonus for advanced chart types
            advanced_types = {'combo', 'waterfall', 'treemap', 'sunburst', 'histogram', 'box_whisker', 'funnel', 'map'}
            found_advanced = set(t.lower() for t in chart_types) & advanced_types
            if found_advanced:
                score += 0.1 * max_pts
                comments.append(f"Advanced chart type(s): {', '.join(found_advanced)}.")
        score += diversity_pct * diversity_weight * max_pts

        # Titles and labels
        untitled = sum(1 for i in issues if i.get('type') == 'missing_chart_title')
        title_weight = 1.0 - max(0.3, presence_weight) - diversity_weight
        title_weight = max(0.15, title_weight)  # at least 15%
        if untitled == 0:
            score += title_weight * max_pts
            if require_titles:
                comments.append("All charts have titles.")
        else:
            titled_pct = (chart_count - untitled) / max(chart_count, 1)
            score += titled_pct * title_weight * max_pts
            comments.append(f"{untitled} chart(s) missing titles.")
            if require_titles and self.level_id in ('advanced', 'expert'):
                comments.append("Chart titles are expected at this level.")

        return {
            'score': round(min(max_pts, score), 1),
            'max': max_pts,
            'comment': ' '.join(comments),
        }

    def _grade_power_query(self) -> Dict[str, Any]:
        """Grade the Power Query / M criterion — level-aware scoring."""
        max_pts = self.rubric['PowerQuery_M']['max']
        if max_pts == 0:
            return {'score': 0, 'max': 0, 'comment': 'Power Query not in rubric.'}

        has_pq = self.pq.get('has_power_query', False)
        query_count = self.pq.get('query_count', 0)
        all_trans = self.pq.get('all_transformations', [])
        total_steps = self.pq.get('total_steps', 0)

        score = 0
        comments = []

        # Level expectations
        lvl = self.level_expectations.get('PowerQuery_M', {})
        pq_expected = lvl.get('expected', False)
        min_queries = lvl.get('min_queries', 1)
        merge_expected = lvl.get('merge_expected', False)

        req_pq = self.requirements.get('require_power_query', False)
        if not has_pq:
            if req_pq or pq_expected:
                return {'score': 0, 'max': max_pts, 'comment': 'Power Query was expected but not found.'}
            return {'score': 0, 'max': max_pts, 'comment': 'Power Query not present (not required for this assignment).'}

        queries = self.pq.get('queries', [])
        has_merge = any(q.get('has_merge') for q in queries)
        has_group = any(q.get('has_group_by') for q in queries)

        if self.level_id == 'foundation':
            # Foundation: PQ is bonus territory — generous scoring
            score += 0.7 * max_pts
            comments.append(f"Excellent! Found {query_count} Power Query query(ies) — impressive for this level.")
            if all_trans:
                score += 0.3 * max_pts
                comments.append(f"Transformations: {', '.join(all_trans[:5])}.")
        elif self.level_id == 'intermediate':
            # Intermediate: basic PQ presence valued
            query_pct = min(1.0, query_count / max(min_queries, 1))
            score += query_pct * 0.4 * max_pts
            comments.append(f"Found {query_count} Power Query query(ies) with {total_steps} step(s).")

            trans_pct = min(1.0, len(all_trans) / 4)
            score += trans_pct * 0.3 * max_pts
            if all_trans:
                comments.append(f"Transformations: {', '.join(all_trans[:5])}.")

            # Merge/group are bonus
            if has_merge:
                score += 0.15 * max_pts
                comments.append("Merge operations detected — above expectations!")
            if has_group:
                score += 0.15 * max_pts
                comments.append("Group-by operations detected.")
        else:
            # Advanced/Expert: expect sophisticated ETL
            query_pct = min(1.0, query_count / max(min_queries, 1))
            score += query_pct * 0.25 * max_pts
            comments.append(f"Found {query_count} Power Query query(ies) with {total_steps} step(s).")

            # Transformation diversity
            trans_pct = min(1.0, len(all_trans) / 6)
            score += trans_pct * 0.25 * max_pts
            if all_trans:
                comments.append(f"Transformations: {', '.join(all_trans[:5])}.")

            # Complexity
            max_complexity = max(
                (q.get('complexity_score', 0) for q in queries), default=0
            )
            score += (max_complexity / 100) * 0.15 * max_pts

            # Advanced features
            if has_merge:
                score += 0.15 * max_pts
                comments.append("Merge (join) operations detected.")
            elif merge_expected:
                comments.append("Merge operations expected at this level but not found.")

            if has_group:
                score += 0.1 * max_pts
                comments.append("Group-by operations detected.")

            # Expert: custom functions, error handling in M
            if self.level_id == 'expert':
                has_custom = any(q.get('has_custom_function') for q in queries)
                has_error_handling = any(q.get('has_error_handling') for q in queries)
                if has_custom:
                    score += 0.05 * max_pts
                    comments.append("Custom M functions detected.")
                if has_error_handling:
                    score += 0.05 * max_pts
                    comments.append("Error handling in M code detected.")

        return {
            'score': round(min(max_pts, score), 1),
            'max': max_pts,
            'comment': ' '.join(comments),
        }

    def _grade_vba(self) -> Dict[str, Any]:
        """Grade the VBA criterion — level-aware scoring."""
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

        # Level expectations
        lvl = self.level_expectations.get('VBA', {})
        vba_expected = lvl.get('expected', False)
        min_modules = lvl.get('min_modules', 1)
        min_procedures = lvl.get('min_procedures', 2)
        error_handling_expected = lvl.get('error_handling_expected', False)

        req_vba = self.requirements.get('require_vba', False)
        if not has_vba:
            if req_vba or vba_expected:
                return {'score': 0, 'max': max_pts, 'comment': 'VBA macros were expected but not found.'}
            return {'score': 0, 'max': max_pts, 'comment': 'VBA not present (not required for this assignment).'}

        # Security check first - deduct heavily for dangerous code
        if security.get('risk_level') == 'high':
            comments.append("⚠️ HIGH SECURITY RISK: Potentially dangerous VBA code detected. Manual review required.")
            return {'score': 0, 'max': max_pts, 'comment': ' '.join(comments)}

        if self.level_id in ('foundation', 'intermediate'):
            # Foundation/Intermediate: VBA is bonus territory — generous scoring
            score += 0.5 * max_pts
            comments.append(f"Found {module_count} VBA module(s) with {total_procs} procedure(s), {total_lines} lines.")

            # Quality is bonus
            quality_score = quality.get('score', 0)
            score += (quality_score / 100) * 0.3 * max_pts

            # Automation is bonus
            if automation:
                score += 0.2 * max_pts
                comments.append(f"Automation: {', '.join(a['pattern'] for a in automation[:3])}.")

            if self.level_id == 'foundation':
                comments.append("Impressive VBA work for this level!")
        else:
            # Advanced/Expert: expect structured, quality code
            # Structure (25%)
            mod_pct = min(1.0, module_count / max(min_modules, 1))
            proc_pct = min(1.0, total_procs / max(min_procedures, 1))
            score += ((mod_pct + proc_pct) / 2) * 0.25 * max_pts
            comments.append(f"Found {module_count} VBA module(s) with {total_procs} procedure(s), {total_lines} lines.")

            # Code quality (25%)
            quality_score = quality.get('score', 0)
            score += (quality_score / 100) * 0.25 * max_pts
            if quality.get('practices_found'):
                comments.append(f"Quality practices: {', '.join(quality['practices_found'][:3])}.")

            # Automation patterns (20%)
            auto_pct = min(1.0, len(automation) / 4)
            score += auto_pct * 0.2 * max_pts
            if automation:
                comments.append(f"Automation: {', '.join(a['pattern'] for a in automation[:3])}.")

            # Modularity (15%)
            modularity = quality.get('modularity', {})
            if modularity.get('total_procedures', 0) >= 2:
                score += 0.075 * max_pts
            if modularity.get('module_count', 0) >= 2:
                score += 0.075 * max_pts

            # Error handling (15%)
            has_err_handling = quality.get('has_error_handling', False)
            if has_err_handling:
                score += 0.15 * max_pts
                comments.append("Error handling implemented.")
            elif error_handling_expected:
                comments.append("Error handling expected at this level but not found.")

        # Deductions (apply to all levels)
        if quality.get('naming_issues'):
            deduction = min(3, len(quality['naming_issues']))
            if self.level_id in ('foundation', 'intermediate'):
                deduction = min(1, deduction)  # lighter deductions for lower levels
            score -= deduction
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
        """Grade the Formatting criterion — level-aware scoring."""
        max_pts = self.rubric['Formatting']['max']
        if max_pts == 0:
            return {'score': 0, 'max': 0, 'comment': 'Formatting not in rubric.'}

        fmt_score = self.formatting.get('score', 0)
        has_cf = self.formatting.get('has_conditional_formatting', False)
        has_dv = self.formatting.get('has_data_validation', False)
        has_nr = self.formatting.get('has_named_ranges', False)
        issues = self.formatting.get('issues', [])

        score = 0
        comments = []

        # Level expectations
        lvl = self.level_expectations.get('Formatting', {})
        min_score = lvl.get('min_score', 30)
        cf_expected = lvl.get('cf_expected', False)
        dv_expected = lvl.get('dv_expected', False)

        if self.level_id == 'foundation':
            # Foundation: basic formatting is sufficient
            # Map base score generously
            base_pct = min(1.0, fmt_score / max(min_score, 1))
            score += base_pct * 0.7 * max_pts
            if has_cf:
                score += 0.15 * max_pts
                comments.append("Conditional formatting applied — excellent for this level!")
            if has_dv:
                score += 0.15 * max_pts
                comments.append("Data validation rules present — above expectations!")
            if has_nr:
                comments.append(f"{self.formatting.get('named_range_count', 0)} named range(s) defined.")
        elif self.level_id == 'intermediate':
            # Intermediate: expect decent formatting, CF/DV are valued
            base_pct = min(1.0, fmt_score / 60)
            score += base_pct * 0.5 * max_pts
            if has_cf:
                score += 0.2 * max_pts
                comments.append("Conditional formatting applied.")
            elif cf_expected:
                comments.append("Conditional formatting would enhance this work.")
            if has_dv:
                score += 0.2 * max_pts
                comments.append("Data validation rules present.")
            if has_nr:
                score += 0.1 * max_pts
                comments.append(f"{self.formatting.get('named_range_count', 0)} named range(s) defined.")
        else:
            # Advanced/Expert: expect professional formatting
            base_pct = min(1.0, fmt_score / 80)
            score += base_pct * 0.4 * max_pts

            if has_cf:
                score += 0.2 * max_pts
                comments.append("Conditional formatting applied.")
            elif cf_expected:
                comments.append("Conditional formatting expected at this level but not found.")

            if has_dv:
                score += 0.2 * max_pts
                comments.append("Data validation rules present.")
            elif dv_expected:
                comments.append("Data validation expected at this level but not found.")

            if has_nr:
                nr_count = self.formatting.get('named_range_count', 0)
                score += min(0.1, nr_count * 0.02) * max_pts
                comments.append(f"{nr_count} named range(s) defined.")

            # Expert: protection, page layout
            if self.level_id == 'expert':
                has_protection = self.formatting.get('has_protection', False)
                if has_protection:
                    score += 0.1 * max_pts
                    comments.append("Sheet/workbook protection configured.")

        # Deductions for errors (lighter at lower levels)
        error_issues = [i for i in issues if i.get('severity') == 'error']
        if error_issues:
            deduction_per = 1 if self.level_id in ('advanced', 'expert') else 0.5
            score -= min(3, len(error_issues) * deduction_per)
            comments.append(f"{len(error_issues)} formatting error(s) found.")

        if not comments:
            comments.append("Basic formatting present.")

        return {
            'score': round(max(0, min(max_pts, score)), 1),
            'max': max_pts,
            'comment': ' '.join(comments),
        }

    def _grade_completeness(self) -> Dict[str, Any]:
        """Grade overall completeness and compliance — level-aware."""
        max_pts = self.rubric['Completeness']['max']
        if max_pts == 0:
            return {'score': 0, 'max': 0, 'comment': 'Completeness not in rubric.'}

        score = 0
        comments = []

        # Sheet structure compliance (30%)
        req_sheets = self.requirements.get('required_sheets', [])
        actual_sheets = set(s.lower() for s in self.wb.get('sheet_names', []))
        sheet_count = self.wb.get('sheet_count', 0)

        if req_sheets:
            found = sum(1 for s in req_sheets if s.lower() in actual_sheets)
            total = len(req_sheets)
            sheet_pct = found / max(total, 1)
            score += sheet_pct * 0.3 * max_pts
            if found < total:
                missing = [s for s in req_sheets if s.lower() not in actual_sheets]
                comments.append(f"Missing required sheet(s): {', '.join(missing)}.")
            else:
                comments.append("All required sheets present.")
        else:
            # No specific sheet requirements – credit for having organized sheets
            if sheet_count >= 2:
                score += 0.3 * max_pts
                comments.append(f"Workbook organized with {sheet_count} sheet(s).")
            elif self.wb.get('total_data_cells', 0) > 0:
                score += 0.2 * max_pts

        # Data presence (20%)
        total_cells = self.wb.get('total_data_cells', 0)
        if total_cells > 50:
            score += 0.2 * max_pts
            comments.append(f"Workbook contains {total_cells} data cells across {sheet_count} sheet(s).")
        elif total_cells > 10:
            score += 0.15 * max_pts
            comments.append(f"Workbook contains {total_cells} data cells.")
        elif total_cells > 0:
            score += 0.05 * max_pts
            comments.append("Workbook has minimal data.")
        else:
            comments.append("Workbook appears to be empty.")

        # Formula presence (20%)
        formula_count = self.wb.get('total_formulas', 0)
        if formula_count > 10:
            score += 0.2 * max_pts
        elif formula_count > 0:
            score += 0.1 * max_pts

        # Feature coverage — does the submission cover the features in scope? (20%)
        scope_features_found = 0
        scope_features_expected = 0
        if self.requirements.get('scope_formulas'):
            scope_features_expected += 1
            if formula_count > 0:
                scope_features_found += 1
        if self.requirements.get('scope_pivots'):
            scope_features_expected += 1
            if self.pivots.get('pivot_count', 0) > 0:
                scope_features_found += 1
        if self.requirements.get('scope_charts'):
            scope_features_expected += 1
            if self.charts.get('chart_count', 0) > 0:
                scope_features_found += 1
        if self.requirements.get('scope_vba'):
            scope_features_expected += 1
            if self.vba.get('has_vba', False):
                scope_features_found += 1
        if self.requirements.get('scope_power_query'):
            scope_features_expected += 1
            if self.pq.get('has_power_query', False):
                scope_features_found += 1
        if scope_features_expected > 0:
            coverage_pct = scope_features_found / scope_features_expected
            score += coverage_pct * 0.2 * max_pts
            if coverage_pct < 1.0:
                comments.append(
                    f"Feature coverage: {scope_features_found}/{scope_features_expected} "
                    f"expected features present."
                )
            else:
                comments.append("All expected features implemented.")
        else:
            # No specific scope — give base credit
            score += 0.15 * max_pts

        # File type and structure (10%)
        req_types = self.requirements.get('required_file_types', [])
        if req_types and self.wb.get('file_type') not in req_types:
            comments.append(f"File type .{self.wb.get('file_type')} may not match requirements.")
        else:
            score += 0.05 * max_pts
        if sheet_count > 0:
            score += 0.05 * max_pts

        return {
            'score': round(max(0, min(max_pts, score)), 1),
            'max': max_pts,
            'comment': ' '.join(comments) if comments else 'Completeness evaluated.',
        }

    # ------------------------------------------------------------------
    # Confidence & anomaly detection
    # ------------------------------------------------------------------

    def _determine_confidence(self) -> str:
        """Determine grading confidence level — level-aware."""
        low_triggers = 0

        # VBA that couldn't be fully analyzed
        if self.vba.get('has_vba') and self.vba.get('module_count', 0) == 1:
            modules = self.vba.get('modules', [])
            if modules and modules[0].get('type') == 'binary':
                low_triggers += 1

        # Few formulas — only a concern at intermediate+ levels
        formula_count = self.formulas.get('formula_count', 0)
        if self.level_id in ('advanced', 'expert') and formula_count < 5:
            low_triggers += 1
        elif self.level_id == 'intermediate' and formula_count < 3:
            low_triggers += 1
        # Foundation students with even 1 formula are fine

        # File errors
        if self.wb.get('error'):
            low_triggers += 2

        # .xls or .csv with limited analysis
        if self.wb.get('file_type') in ('xls', 'csv'):
            low_triggers += 1

        # Very high or very low score relative to level expectations
        # (handled in the grade() method via manual_review flag)

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
