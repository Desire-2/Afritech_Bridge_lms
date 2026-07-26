"""
Excel Mastery Levels — Skill-level classification and grading expectations.

Defines four mastery tiers:

  1. **Foundation** (Beginner) — Basic spreadsheet skills
  2. **Intermediate** — Competent spreadsheet user
  3. **Advanced** — Power user
  4. **Expert** — Professional/developer level

Each level defines expected functions, features, scoring expectations, and
feedback templates.

NEW: Deep content analysis — detect level from actual assignment instructions
by analyzing task complexity, concept density, and deliverables.
"""

import re
import logging
from typing import Dict, Any, Optional, Tuple, List, Set

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────
# Mastery Level Definitions
# ──────────────────────────────────────────────────────────────────────

MASTERY_LEVELS = {
    'foundation': {
        'level': 1,
        'name': 'Foundation',
        'label': 'Beginner / Foundation',
        'description': 'Basic spreadsheet skills and fundamental Excel features.',

        # Keywords in module/assignment titles that suggest this level
        'title_keywords': [
            'introduction', 'intro to', 'basics', 'basic',
            'beginner', 'getting started', 'fundamentals',
            'foundation', 'first steps', 'module 1', 'week 1',
            'data entry', 'spreadsheet basics',
        ],

        'expected_functions': {
            'SUM', 'AVERAGE', 'COUNT', 'COUNTA', 'MIN', 'MAX',
            'IF', 'ROUND', 'ABS', 'INT',
            'CONCATENATE', 'LEFT', 'RIGHT', 'MID', 'LEN', 'TRIM',
            'UPPER', 'LOWER', 'PROPER',
            'TODAY', 'NOW', 'DATE', 'YEAR', 'MONTH', 'DAY',
        },

        'expected_features': {
            'basic_formulas', 'basic_formatting', 'sorting',
            'filtering', 'simple_charts',
        },

        'scoring_expectations': {
            'Formulas': {
                'min_formulas': 3, 'min_categories': 1, 'min_advanced': 0,
                'complexity_weight': 0.1, 'presence_weight': 0.5,
                'diversity_weight': 0.2, 'advanced_weight': 0.0,
                'error_handling_weight': 0.1,
            },
            'PivotTables': {'expected': False, 'bonus_if_present': True},
            'Charts': {'min_charts': 1, 'require_titles': False, 'diversity_weight': 0.1},
            'PowerQuery_M': {'expected': False, 'bonus_if_present': True},
            'VBA': {'expected': False, 'bonus_if_present': True},
            'Formatting': {'min_score': 20, 'cf_expected': False, 'dv_expected': False},
        },
    },

    'intermediate': {
        'level': 2,
        'name': 'Intermediate',
        'label': 'Intermediate',
        'description': 'Competent spreadsheet user with multi-function proficiency.',

        'title_keywords': [
            'intermediate', 'module 2', 'module 3', 'week 2', 'week 3',
            'data analysis', 'lookup', 'lookups', 'pivot',
            'conditional', 'working with data', 'formulas and functions',
            'functions', 'data management',
        ],

        'expected_functions': {
            'SUM', 'AVERAGE', 'COUNT', 'COUNTA', 'MIN', 'MAX',
            'IF', 'AND', 'OR', 'NOT', 'IFERROR',
            'VLOOKUP', 'HLOOKUP',
            'SUMIF', 'SUMIFS', 'COUNTIF', 'COUNTIFS',
            'AVERAGEIF', 'AVERAGEIFS',
            'CONCATENATE', 'TEXTJOIN', 'LEFT', 'RIGHT', 'MID',
            'TEXT', 'VALUE', 'TRIM',
            'DATE', 'TODAY', 'YEAR', 'MONTH', 'DAY',
            'EDATE', 'EOMONTH', 'DATEDIF',
            'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'SUBTOTAL',
        },

        'expected_features': {
            'conditional_formulas', 'lookup_functions', 'basic_pivots',
            'conditional_formatting', 'data_validation', 'named_ranges',
            'proper_charts_with_labels', 'sorting_filtering',
        },

        'scoring_expectations': {
            'Formulas': {
                'min_formulas': 8, 'min_categories': 3, 'min_advanced': 1,
                'complexity_weight': 0.2, 'presence_weight': 0.3,
                'diversity_weight': 0.2, 'advanced_weight': 0.15,
                'error_handling_weight': 0.15,
            },
            'PivotTables': {'expected': True, 'min_pivots': 1, 'slicers_expected': False, 'calc_fields_expected': False},
            'Charts': {'min_charts': 1, 'require_titles': True, 'diversity_weight': 0.2},
            'PowerQuery_M': {'expected': False, 'bonus_if_present': True},
            'VBA': {'expected': False, 'bonus_if_present': True},
            'Formatting': {'min_score': 40, 'cf_expected': True, 'dv_expected': True},
        },
    },

    'advanced': {
        'level': 3,
        'name': 'Advanced',
        'label': 'Advanced',
        'description': 'Power user with data modelling and analysis proficiency.',

        'title_keywords': [
            'advanced', 'module 4', 'module 5', 'week 4', 'week 5',
            'power query', 'data model', 'data modelling', 'data modeling',
            'dynamic array', 'complex', 'analysis', 'analytics',
            'dashboard', 'what-if', 'solver', 'scenario',
            'professional', 'power user',
        ],

        'expected_functions': {
            'INDEX', 'MATCH', 'XLOOKUP', 'XMATCH',
            'SUMIFS', 'COUNTIFS', 'AVERAGEIFS', 'MAXIFS', 'MINIFS',
            'SUMPRODUCT',
            'FILTER', 'SORT', 'SORTBY', 'UNIQUE', 'SEQUENCE',
            'IF', 'IFS', 'IFERROR', 'IFNA', 'SWITCH', 'CHOOSE',
            'TEXT', 'TEXTJOIN',
            'INDIRECT', 'OFFSET', 'ADDRESS',
            'LARGE', 'SMALL', 'RANK',
            'PERCENTILE', 'QUARTILE', 'MEDIAN',
        },

        'expected_features': {
            'advanced_lookups', 'dynamic_arrays', 'power_query',
            'data_model', 'complex_pivots', 'calculated_fields',
            'slicers', 'combo_charts', 'dashboards',
            'advanced_conditional_formatting', 'what_if_analysis',
        },

        'scoring_expectations': {
            'Formulas': {
                'min_formulas': 15, 'min_categories': 4, 'min_advanced': 3,
                'complexity_weight': 0.3, 'presence_weight': 0.2,
                'diversity_weight': 0.15, 'advanced_weight': 0.25,
                'error_handling_weight': 0.1,
            },
            'PivotTables': {'expected': True, 'min_pivots': 1, 'slicers_expected': True, 'calc_fields_expected': True},
            'Charts': {'min_charts': 2, 'require_titles': True, 'diversity_weight': 0.25},
            'PowerQuery_M': {'expected': True, 'min_queries': 1, 'merge_expected': True},
            'VBA': {'expected': False, 'bonus_if_present': True},
            'Formatting': {'min_score': 60, 'cf_expected': True, 'dv_expected': True},
        },
    },

    'expert': {
        'level': 4,
        'name': 'Expert',
        'label': 'Expert / Professional',
        'description': 'Professional-level Excel developer with automation and modelling expertise.',

        'title_keywords': [
            'expert', 'mastery', 'professional', 'module 6', 'module 7',
            'module 8', 'week 6', 'week 7', 'week 8',
            'vba', 'macro', 'automation', 'programming',
            'power pivot', 'dax', 'financial model',
            'lambda', 'capstone', 'final project',
        ],

        'expected_functions': {
            'INDEX', 'MATCH', 'XLOOKUP', 'XMATCH',
            'FILTER', 'SORT', 'SORTBY', 'UNIQUE', 'SEQUENCE',
            'LET', 'LAMBDA', 'MAP', 'REDUCE', 'SCAN',
            'BYROW', 'BYCOL', 'MAKEARRAY',
            'HSTACK', 'VSTACK', 'WRAPCOLS', 'WRAPROWS',
            'TOCOL', 'TOROW', 'TEXTSPLIT',
            'SUMPRODUCT', 'INDIRECT', 'OFFSET',
            'PMT', 'FV', 'PV', 'NPV', 'IRR', 'XNPV', 'XIRR',
            'IFERROR', 'IFNA',
        },

        'expected_features': {
            'vba_programming', 'lambda_functions', 'dynamic_arrays',
            'power_query_advanced', 'power_pivot', 'dax',
            'financial_modelling', 'automation', 'userforms',
            'custom_functions', 'data_modelling', 'advanced_charts',
        },

        'scoring_expectations': {
            'Formulas': {
                'min_formulas': 20, 'min_categories': 5, 'min_advanced': 5,
                'complexity_weight': 0.3, 'presence_weight': 0.15,
                'diversity_weight': 0.1, 'advanced_weight': 0.3,
                'error_handling_weight': 0.15,
            },
            'PivotTables': {'expected': True, 'min_pivots': 2, 'slicers_expected': True, 'calc_fields_expected': True},
            'Charts': {'min_charts': 2, 'require_titles': True, 'diversity_weight': 0.3},
            'PowerQuery_M': {'expected': True, 'min_queries': 2, 'merge_expected': True},
            'VBA': {'expected': True, 'min_modules': 1, 'min_procedures': 2, 'error_handling_expected': True, 'modularity_expected': True},
            'Formatting': {'min_score': 70, 'cf_expected': True, 'dv_expected': True},
        },
    },
}


# ──────────────────────────────────────────────────────────────────────
# NEW: Deep Content Analysis for Mastery Level Detection
# ──────────────────────────────────────────────────────────────────────

def analyze_assignment_complexity(
    assignment_title: str = '',
    assignment_description: str = '',
    assignment_instructions: str = '',
) -> Dict[str, Any]:
    """
    Deeply analyze assignment content to determine its actual cognitive complexity.
    
    Analyzes:
      - Number of structured parts (Part 1, Part 2, etc.)
      - Number of numbered tasks/steps
      - Types of concepts mentioned (lookups, pivots, VBA, etc.)
      - Presence of theoretical/reflection questions
      - Deliverable complexity
      - Instruction verbosity and detail level
    
    Returns:
        Dict with complexity scores per category and overall level estimate.
    """
    text = f"{assignment_title} {assignment_description} {assignment_instructions}"
    text_lower = text.lower()
    
    # Part counter — how many major sections?
    part_pattern = re.compile(r'(?:part|section|exercise|task)\s*(#?\d+|[ivxlcdm]+)\.?', re.IGNORECASE)
    parts_found = part_pattern.findall(text_lower)
    part_count = max(len(parts_found), 1)
    
    # Step counter — how many numbered steps?
    step_pattern = re.compile(r'(?:^|\n)\s*(\d+)\.\s+', re.MULTILINE)
    steps_found = step_pattern.findall(text)
    step_count = len(steps_found)
    
    # Word count — complexity signal
    word_count = len(text.split())
    
    # ── Concept detection ───────────────────────────────────────────
    concepts_detected = {
        'vlookup': bool(re.search(r'vlookup', text_lower)),
        'hlookup': bool(re.search(r'hlookup', text_lower)),
        'xlookup': bool(re.search(r'xlookup', text_lower)),
        'index_match': bool(re.search(r'index.*match|match.*index', text_lower)),
        'pivot_table': bool(re.search(r'pivot\s*table|pivottable', text_lower)),
        'pivot_chart': bool(re.search(r'pivot\s*chart|pivotchart', text_lower)),
        'calculated_item': bool(re.search(r'calculated\s*item', text_lower)),
        'calculated_field': bool(re.search(r'calculated\s*field', text_lower)),
        'slicer': bool(re.search(r'slicer|timeline', text_lower)),
        'data_model': bool(re.search(r'data\s*model|relationship', text_lower)),
        'power_query': bool(re.search(r'power\s*query|get\s*&\s*transform|m\s*language', text_lower)),
        'merge_query': bool(re.search(r'merge|append\s+query|combine\s+query', text_lower)),
        'vba': bool(re.search(r'\bvba\b|macro|visual\s*basic|userform|module', text_lower)),
        'event_handling': bool(re.search(r'event\s*handl|\bworkbook_open\b|\bworksheet_change\b', text_lower)),
        'dynamic_array': bool(re.search(r'dynamic\s*array|filter\s*function|sort\s*function|unique\s*function|sequence\s*function', text_lower)),
        'lambda': bool(re.search(r'\blambda\b', text_lower)),
        'dax': bool(re.search(r'\bdax\b|measure', text_lower)),
        'power_pivot': bool(re.search(r'power\s*pivot|data\s*model', text_lower)),
        'financial': bool(re.search(r'npv|irr|pmt|financial\s*model|amorti', text_lower)),
        'statistical': bool(re.search(r'regression|correlation|hypothesis|anova|t-test|monte\s*carlo', text_lower)),
        'monte_carlo': bool(re.search(r'monte\s*carlo|simulation', text_lower)),
        'dashboard': bool(re.search(r'dashboard|kpi', text_lower)),
        'data_validation': bool(re.search(r'data\s*validation|dropdown|validation\s*rule', text_lower)),
        'conditional_formatting': bool(re.search(r'conditional\s*format', text_lower)),
        'class_module': bool(re.search(r'class\s*module|custom\s*object|oop|object.orient', text_lower)),
        'error_handling': bool(re.search(r'error\s*handl|on\s*error|try\.*catch|err\.number', text_lower)),
        'userform': bool(re.search(r'userform|user\s*form|dialog\s*box|form\s*control', text_lower)),
        'solver': bool(re.search(r'solver|optimization|optimization', text_lower)),
        'what_if': bool(re.search(r'what.if|scenario\s*manager|goal\s*seek|data\s*table', text_lower)),
        'power_bi': bool(re.search(r'power\s*bi|powerbi|power\s*bi\s*service', text_lower)),
        'gateway': bool(re.search(r'data\s*gateway|on.premise\s*gateway', text_lower)),
        'query_folding': bool(re.search(r'query\s*folding|native\s*query', text_lower)),
        'named_range': bool(re.search(r'named\s*range|name\s*manager', text_lower)),
        'protection': bool(re.search(r'sheet\s*protect|workbook\s*protect|password', text_lower)),
        'collection': bool(re.search(r'dictionary|collection|array\s*list', text_lower)),
        'vba_class': bool(re.search(r'class\s*module|property\s*get|property\s*let', text_lower)),
        'vba_events': bool(re.search(r'workbook_open|workbook_beforesave|worksheet_change|worksheet_selectionchange', text_lower)),
    }
    
    # ── Complexity score calculation ────────────────────────────────
    # Weight each concept by its cognitive level
    concept_level_weights = {
        'vlookup': 2, 'hlookup': 2, 'xlookup': 3, 'index_match': 3,
        'pivot_table': 2, 'pivot_chart': 2.5, 'calculated_item': 3, 'calculated_field': 3,
        'slicer': 2.5, 'data_model': 3.5, 'power_query': 3, 'merge_query': 3.5,
        'vba': 4, 'event_handling': 4, 'dynamic_array': 3, 'lambda': 4,
        'dax': 4, 'power_pivot': 3.5, 'financial': 3.5,
        'statistical': 3.5, 'monte_carlo': 4,
        'dashboard': 3, 'data_validation': 2, 'conditional_formatting': 2,
        'class_module': 4, 'error_handling': 3, 'userform': 3.5,
        'solver': 3.5, 'what_if': 3, 'power_bi': 3.5,
        'gateway': 3.5, 'query_folding': 3.5, 'named_range': 2,
        'protection': 2.5, 'collection': 4, 'vba_class': 4, 'vba_events': 4,
    }
    
    # Count active concepts and compute weighted complexity
    active_concepts = {k: v for k, v in concepts_detected.items() if v}
    concept_count = len(active_concepts)
    
    weighted_complexity = sum(
        concept_level_weights.get(k, 2) for k in active_concepts.keys()
    )
    
    # Average concept complexity
    avg_concept_complexity = weighted_complexity / max(concept_count, 1)
    
    # ── Mastery level from content analysis ───────────────────────
    if avg_concept_complexity >= 3.8:
        content_level = 'expert'
    elif avg_concept_complexity >= 3.0:
        content_level = 'advanced'
    elif avg_concept_complexity >= 2.0:
        content_level = 'intermediate'
    else:
        content_level = 'foundation'
    
    # Additional signals to shift level
    if concept_count >= 10:
        # Many different concepts → higher level
        content_level = _bump_level(content_level, 1)
    if word_count > 1500 and avg_concept_complexity > 2.5:
        # Long instructions with moderate complexity → advanced
        content_level = _bump_level(content_level, 1)
    
    return {
        'content_level': content_level,
        'concept_count': concept_count,
        'weighted_complexity': round(weighted_complexity, 1),
        'avg_concept_complexity': round(avg_concept_complexity, 2),
        'part_count': part_count,
        'step_count': step_count,
        'word_count': word_count,
        'concepts_detected': active_concepts,
        'concept_names': list(active_concepts.keys()),
    }


def _bump_level(current: str, steps: int = 1) -> str:
    """Move up N levels from current."""
    levels = ['foundation', 'intermediate', 'advanced', 'expert']
    try:
        idx = levels.index(current)
        return levels[min(len(levels) - 1, idx + steps)]
    except ValueError:
        return current


# ──────────────────────────────────────────────────────────────────────
# Level Detection (Enhanced)
# ──────────────────────────────────────────────────────────────────────

def detect_mastery_level(
    module_title: str = '',
    module_description: str = '',
    module_objectives: str = '',
    assignment_title: str = '',
    assignment_instructions: str = '',
    module_order: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Detect the mastery level from module/assignment metadata.
    
    Uses a three-signal approach:
      1. **Title keyword matching** (primary signal)
      2. **Content complexity analysis** (new — deep task analysis)
      3. **Module order** (tertiary fallback)
    
    Returns:
        Dict with level_id, level_name, level_number, confidence,
        scoring_expectations, matched_keywords, and content_analysis.
    """
    all_text = ' '.join(filter(None, [
        module_title, module_description, module_objectives,
        assignment_title, assignment_instructions,
    ])).lower()

    scores: Dict[str, float] = {}
    matched: Dict[str, List[str]] = {}

    for level_id, level_def in MASTERY_LEVELS.items():
        score = 0.0
        keywords_matched = []

        for kw in level_def['title_keywords']:
            if kw in (module_title or '').lower():
                score += 3.0
                keywords_matched.append(f"title:{kw}")
            elif kw in (assignment_title or '').lower():
                score += 2.5
                keywords_matched.append(f"assign:{kw}")
            elif kw in all_text:
                score += 1.0
                keywords_matched.append(kw)

        for feature in level_def.get('expected_features', set()):
            feature_readable = feature.replace('_', ' ')
            if feature_readable in all_text:
                score += 1.5
                keywords_matched.append(f"feature:{feature_readable}")

        for func in level_def.get('expected_functions', set()):
            if func.lower() in all_text:
                score += 0.5
                keywords_matched.append(f"func:{func}")

        scores[level_id] = score
        matched[level_id] = keywords_matched

    # ── Content analysis (new) ────────────────────────────────────
    content_analysis = analyze_assignment_complexity(
        assignment_title=assignment_title,
        assignment_description='',
        assignment_instructions=assignment_instructions,
    )
    content_level = content_analysis['content_level']
    
    # Boost score for the content-detected level
    scores[content_level] = scores.get(content_level, 0) + 5.0
    matched.setdefault(content_level, []).append(
        f"content_analysis:{content_level} ({content_analysis['avg_concept_complexity']})"
    )

    best_level = max(scores, key=scores.get)
    best_score = scores[best_level]

    # Fallback to module order if no strong signal
    if best_score < 1.0 and module_order is not None:
        if module_order <= 2:
            best_level = 'foundation'
        elif module_order <= 4:
            best_level = 'intermediate'
        elif module_order <= 6:
            best_level = 'advanced'
        else:
            best_level = 'expert'
        confidence = 'low'
    elif best_score < 5.0:
        confidence = 'low'
    elif best_score < 10.0:
        confidence = 'medium'
    else:
        confidence = 'high'

    level_def = MASTERY_LEVELS.get(best_level, MASTERY_LEVELS['intermediate'])

    return {
        'level_id': best_level,
        'level_name': level_def['name'],
        'level_number': level_def['level'],
        'label': level_def['label'],
        'description': level_def['description'],
        'confidence': confidence,
        'match_score': round(best_score, 1),
        'matched_keywords': matched.get(best_level, []),
        'scoring_expectations': level_def['scoring_expectations'],
        'expected_functions': level_def['expected_functions'],
        'expected_features': level_def['expected_features'],
        'all_scores': {k: round(v, 1) for k, v in scores.items()},
        'content_analysis': content_analysis,
    }


# ──────────────────────────────────────────────────────────────────────
# Helper functions (unchanged)
# ──────────────────────────────────────────────────────────────────────

def get_level_expectations(level_id: str) -> Dict[str, Any]:
    return MASTERY_LEVELS.get(level_id, MASTERY_LEVELS['intermediate'])


def get_formula_scoring_params(level_id: str) -> Dict[str, Any]:
    level = MASTERY_LEVELS.get(level_id, MASTERY_LEVELS['intermediate'])
    return level['scoring_expectations'].get('Formulas', {})


def get_pivot_expectations(level_id: str) -> Dict[str, Any]:
    level = MASTERY_LEVELS.get(level_id, MASTERY_LEVELS['intermediate'])
    return level['scoring_expectations'].get('PivotTables', {})


def get_chart_expectations(level_id: str) -> Dict[str, Any]:
    level = MASTERY_LEVELS.get(level_id, MASTERY_LEVELS['intermediate'])
    return level['scoring_expectations'].get('Charts', {})


def get_pq_expectations(level_id: str) -> Dict[str, Any]:
    level = MASTERY_LEVELS.get(level_id, MASTERY_LEVELS['intermediate'])
    return level['scoring_expectations'].get('PowerQuery_M', {})


def get_vba_expectations(level_id: str) -> Dict[str, Any]:
    level = MASTERY_LEVELS.get(level_id, MASTERY_LEVELS['intermediate'])
    return level['scoring_expectations'].get('VBA', {})


def get_formatting_expectations(level_id: str) -> Dict[str, Any]:
    level = MASTERY_LEVELS.get(level_id, MASTERY_LEVELS['intermediate'])
    return level['scoring_expectations'].get('Formatting', {})


# ──────────────────────────────────────────────────────────────────────
# Knowledge Base (unchanged from original)
# ──────────────────────────────────────────────────────────────────────

EXCEL_FUNCTION_TAXONOMY = {
    'basic_math': {
        'level': 'foundation',
        'functions': {
            'SUM', 'AVERAGE', 'COUNT', 'COUNTA', 'COUNTBLANK',
            'MIN', 'MAX', 'ROUND', 'ROUNDUP', 'ROUNDDOWN',
            'ABS', 'POWER', 'SQRT', 'MOD', 'INT', 'CEILING', 'FLOOR',
            'RAND', 'RANDBETWEEN', 'PRODUCT', 'SUBTOTAL',
            'CEILING.MATH', 'FLOOR.MATH', 'MROUND',
            'TRUNC', 'SIGN', 'QUOTIENT', 'GCD', 'LCM',
            'AGGREGATE', 'COMBIN', 'COMBINA', 'FACT', 'FACTDOUBLE',
            'MULTINOMIAL', 'PI', 'DEGREES', 'RADIANS',
            'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN', 'ATAN2',
            'LOG', 'LOG10', 'LN', 'EXP',
        },
    },
    'statistical': {
        'level': 'intermediate',
        'functions': {
            'MEDIAN', 'MODE', 'MODE.SNGL', 'MODE.MULT',
            'STDEV', 'STDEV.S', 'STDEV.P', 'STDEVPA',
            'VAR', 'VAR.S', 'VAR.P', 'VARPA',
            'CORREL', 'COVARIANCE.P', 'COVARIANCE.S',
            'PERCENTILE', 'PERCENTILE.INC', 'PERCENTILE.EXC',
            'PERCENTRANK.INC', 'PERCENTRANK.EXC',
            'QUARTILE', 'QUARTILE.INC', 'QUARTILE.EXC',
            'LARGE', 'SMALL', 'RANK', 'RANK.AVG', 'RANK.EQ',
            'FREQUENCY', 'FORECAST', 'FORECAST.LINEAR', 'FORECAST.ETS',
            'FORECAST.ETS.CONFINT', 'FORECAST.ETS.SEASONALITY',
            'TREND', 'GROWTH', 'LINEST', 'LOGEST',
            'SLOPE', 'INTERCEPT', 'RSQ', 'STEYX',
            'CONFIDENCE', 'CONFIDENCE.NORM', 'CONFIDENCE.T',
            'AVERAGEIF', 'AVERAGEIFS',
            'GEOMEAN', 'HARMEAN', 'TRIMMEAN',
            'DEVSQ', 'AVEDEV', 'SKEW', 'KURT',
            'NORM.DIST', 'NORM.INV', 'NORM.S.DIST', 'NORM.S.INV',
            'T.DIST', 'T.INV', 'T.DIST.2T', 'T.INV.2T', 'T.TEST',
            'F.DIST', 'F.INV', 'F.DIST.RT', 'F.INV.RT', 'F.TEST',
            'CHISQ.DIST', 'CHISQ.INV', 'CHISQ.DIST.RT', 'CHISQ.INV.RT', 'CHISQ.TEST',
            'Z.TEST', 'ZTEST',
            'BETA.DIST', 'BETA.INV',
            'GAMMA.DIST', 'GAMMA.INV', 'GAMMALN', 'GAMMALN.PRECISE',
            'WEIBULL.DIST', 'EXPON.DIST', 'LOGNORM.DIST', 'LOGNORM.INV',
            'POISSON.DIST', 'BINOM.DIST', 'BINOM.INV', 'NEGBINOM.DIST', 'HYPGEOM.DIST',
            'PROB', 'PERMUT', 'PERMUTATIONA',
        },
    },
    'logical': {
        'level': 'foundation',
        'functions': {
            'IF', 'IFS', 'AND', 'OR', 'NOT', 'XOR',
            'IFERROR', 'IFNA', 'SWITCH', 'CHOOSE',
            'TRUE', 'FALSE',
        },
    },
    'lookup_reference': {
        'level': 'intermediate',
        'functions': {
            'VLOOKUP', 'HLOOKUP', 'XLOOKUP', 'INDEX', 'MATCH',
            'OFFSET', 'INDIRECT', 'ROW', 'COLUMN', 'ROWS', 'COLUMNS',
            'LOOKUP', 'ADDRESS', 'XMATCH',
            'CHOOSECOLS', 'CHOOSEROWS', 'TAKE', 'DROP',
            'HYPERLINK', 'FORMULATEXT', 'GETPIVOTDATA',
            'AREAS', 'TRANSPOSE',
        },
    },
    'text': {
        'level': 'foundation',
        'functions': {
            'CONCATENATE', 'CONCAT', 'TEXTJOIN', 'LEFT', 'RIGHT', 'MID',
            'LEN', 'FIND', 'SEARCH', 'SUBSTITUTE', 'REPLACE',
            'TRIM', 'CLEAN', 'UPPER', 'LOWER', 'PROPER',
            'TEXT', 'VALUE', 'REPT', 'EXACT', 'CHAR', 'CODE',
            'NUMBERVALUE', 'FIXED', 'DOLLAR', 'BAHTTEXT',
            'UNICHAR', 'UNICODE', 'ASC', 'JIS', 'PHONETIC',
            'TEXTBEFORE', 'TEXTAFTER', 'TEXTSPLIT',
            'VALUETOTEXT', 'ARRAYTOTEXT',
        },
    },
    'date_time': {
        'level': 'foundation',
        'functions': {
            'DATE', 'TODAY', 'NOW', 'YEAR', 'MONTH', 'DAY',
            'HOUR', 'MINUTE', 'SECOND', 'DATEDIF',
            'EDATE', 'EOMONTH', 'WEEKDAY', 'WEEKNUM', 'ISOWEEKNUM',
            'WORKDAY', 'WORKDAY.INTL', 'NETWORKDAYS', 'NETWORKDAYS.INTL',
            'DATEVALUE', 'TIMEVALUE', 'TIME',
            'YEARFRAC', 'DAYS', 'DAYS360',
        },
    },
    'conditional_aggregation': {
        'level': 'intermediate',
        'functions': {
            'SUMIF', 'SUMIFS', 'COUNTIF', 'COUNTIFS',
            'AVERAGEIF', 'AVERAGEIFS', 'MAXIFS', 'MINIFS',
            'SUMPRODUCT',
        },
    },
    'dynamic_array': {
        'level': 'advanced',
        'functions': {
            'FILTER', 'SORT', 'SORTBY', 'UNIQUE', 'SEQUENCE',
            'RANDARRAY', 'LET', 'LAMBDA', 'MAP', 'REDUCE',
            'SCAN', 'MAKEARRAY', 'BYROW', 'BYCOL',
            'HSTACK', 'VSTACK', 'WRAPCOLS', 'WRAPROWS',
            'TOCOL', 'TOROW', 'TEXTSPLIT', 'TEXTBEFORE', 'TEXTAFTER',
            'CHOOSEROWS', 'CHOOSECOLS', 'TAKE', 'DROP',
            'EXPAND', 'GROUPBY', 'PIVOTBY',
        },
    },
    'error_handling': {
        'level': 'foundation',
        'functions': {
            'IFERROR', 'IFNA', 'ISERROR', 'ISNA', 'ISERR',
            'ISBLANK', 'ISNUMBER', 'ISTEXT', 'ISLOGICAL',
            'ISNONTEXT', 'ISREF', 'ISFORMULA', 'ISEVEN', 'ISODD',
            'ERROR.TYPE', 'TYPE', 'N', 'NA',
        },
    },
    'information': {
        'level': 'intermediate',
        'functions': {'CELL', 'INFO', 'SHEET', 'SHEETS', 'TYPE', 'FORMULATEXT', 'ISFORMULA'},
    },
    'financial': {
        'level': 'advanced',
        'functions': {
            'PMT', 'IPMT', 'PPMT', 'FV', 'PV', 'NPV', 'IRR',
            'RATE', 'NPER', 'SLN', 'DB', 'DDB', 'VDB',
            'XNPV', 'XIRR', 'MIRR',
            'EFFECT', 'NOMINAL', 'CUMPRINC', 'CUMIPMT',
            'DOLLARDE', 'DOLLARFR',
            'DISC', 'INTRATE', 'PRICEDISC', 'PRICEMAT',
            'RECEIVED', 'YIELD', 'YIELDDISC', 'YIELDMAT',
            'PRICE', 'ACCRINT', 'ACCRINTM',
            'DURATION', 'MDURATION',
            'COUPDAYBS', 'COUPDAYS', 'COUPDAYSNC', 'COUPNCD', 'COUPNUM', 'COUPPCD',
            'TBILLEQ', 'TBILLPRICE', 'TBILLYIELD',
            'ODDFPRICE', 'ODDFYIELD', 'ODDLPRICE', 'ODDLYIELD',
            'AMORLINC', 'AMORDEGRC',
            'FVSCHEDULE', 'PDURATION', 'RRI',
        },
    },
    'database': {
        'level': 'intermediate',
        'functions': {
            'DSUM', 'DAVERAGE', 'DCOUNT', 'DCOUNTA',
            'DMAX', 'DMIN', 'DGET', 'DVAR', 'DVARP',
            'DSTDEV', 'DSTDEVP', 'DPRODUCT',
        },
    },
    'engineering': {
        'level': 'expert',
        'functions': {
            'BIN2DEC', 'BIN2HEX', 'BIN2OCT',
            'DEC2BIN', 'DEC2HEX', 'DEC2OCT',
            'HEX2BIN', 'HEX2DEC', 'HEX2OCT',
            'OCT2BIN', 'OCT2DEC', 'OCT2HEX',
            'COMPLEX', 'IMAGINARY', 'IMREAL',
            'IMSUM', 'IMSUB', 'IMPRODUCT', 'IMDIV',
            'IMABS', 'IMARGUMENT', 'IMCONJUGATE',
            'IMPOWER', 'IMSQRT', 'IMEXP', 'IMLN', 'IMLOG2', 'IMLOG10',
            'IMSIN', 'IMCOS', 'IMTAN',
            'CONVERT', 'DELTA', 'GESTEP',
            'ERF', 'ERF.PRECISE', 'ERFC', 'ERFC.PRECISE',
            'BESSELI', 'BESSELJ', 'BESSELK', 'BESSELY',
            'BITAND', 'BITOR', 'BITXOR', 'BITLSHIFT', 'BITRSHIFT',
        },
    },
    'web': {
        'level': 'advanced',
        'functions': {'ENCODEURL', 'FILTERXML', 'WEBSERVICE'},
    },
    'cube': {
        'level': 'expert',
        'functions': {
            'CUBEMEMBER', 'CUBEVALUE', 'CUBESET',
            'CUBESETCOUNT', 'CUBERANKEDMEMBER',
            'CUBEMEMBERPROPERTY', 'CUBEKPIMEMBER',
        },
    },
}


EXCEL_CONCEPTS_BY_LEVEL = {
    'foundation': [
        'Cell references (A1, B2)', 'Relative vs absolute references ($A$1)',
        'Basic formulas (SUM, AVERAGE, COUNT, MIN, MAX)',
        'IF function for conditional logic',
        'Text functions (CONCATENATE, LEFT, RIGHT, MID)',
        'Date functions (TODAY, NOW, DATE)',
        'Number formatting (currency, percentage, dates)',
        'Cell formatting (bold, colour, borders, alignment)',
        'Sorting data (A-Z, Z-A, custom sort)', 'Filtering data (AutoFilter)',
        'Simple bar, line, and pie charts', 'Printing and page layout basics',
        'Freeze panes and split windows', 'Fill handle and AutoFill series',
        'Find & Replace', 'Tables (Format as Table, Ctrl+T)',
        'Basic data entry and editing', 'Paste Special (values, formulas, formats)',
        'Workbook and worksheet management',
    ],
    'intermediate': [
        'VLOOKUP and HLOOKUP functions', 'Nested IF statements',
        'SUMIF/SUMIFS/COUNTIF/COUNTIFS', 'AVERAGEIF/AVERAGEIFS',
        'IFERROR error handling', 'Named ranges and Name Manager',
        'Data validation (dropdown lists, input rules)',
        'Conditional formatting (rules, data bars, colour scales, icon sets)',
        'Basic PivotTables (row/column/value fields)',
        'PivotTable grouping (dates, numbers)',
        'Sorting and filtering PivotTables', 'Basic PivotCharts',
        'SUMPRODUCT for multi-criteria calculations', 'Text-to-Columns',
        'Remove Duplicates', 'Flash Fill',
        'Subtotals and outlining', 'Multiple worksheets (3D references)',
        'Goal Seek', 'Data tables (one-variable, two-variable)',
        'Protection (sheet, workbook, cells)', 'Custom number formats',
        'Sparklines (line, column, win/loss)', 'Comments and Notes',
        'Hyperlinks within and between workbooks', 'Database functions (DSUM, DGET, DCOUNT)',
    ],
    'advanced': [
        'INDEX/MATCH combination', 'XLOOKUP and XMATCH',
        'Dynamic array functions (FILTER, SORT, UNIQUE, SEQUENCE)',
        'Array formulas (Ctrl+Shift+Enter legacy)',
        'Power Query (Get & Transform)',
        'Power Query transformations (merge, append, group by, unpivot)',
        'M language basics in Power Query',
        'Data Model (relationships between tables)',
        'PivotTables from Data Model', 'Calculated fields in PivotTables',
        'Calculated items in PivotTables', 'Slicers and timelines',
        'GETPIVOTDATA function', 'Dashboard design',
        'Combo charts and secondary axes',
        'Advanced conditional formatting (formulas)',
        'What-If Analysis (Scenario Manager)', 'Solver for optimisation problems',
        'INDIRECT and dynamic references', 'OFFSET for dynamic ranges',
        'SUMPRODUCT advanced patterns', 'Structured references (Table[@Column])',
        'TEXTJOIN, CONCAT', 'Advanced chart formatting (trendlines, error bars)',
        'External data connections', 'Consolidation across workbooks',
        'Form controls (buttons, checkboxes, dropdowns)',
    ],
    'expert': [
        'VBA programming (Sub, Function, variables, loops)',
        'VBA error handling (On Error)', 'VBA UserForms design',
        'VBA working with ranges, worksheets, workbooks',
        'VBA events (Workbook_Open, Worksheet_Change)',
        'VBA class modules and OOP', 'LAMBDA function and custom functions',
        'LET for intermediate variables', 'MAP, REDUCE, SCAN for array manipulation',
        'BYROW, BYCOL for row/column operations', 'MAKEARRAY for custom array generation',
        'Power Pivot and DAX basics',
        'DAX measures (CALCULATE, SUMX, RELATED)',
        'DAX time intelligence (SAMEPERIODLASTYEAR, DATEADD)',
        'Advanced M language (custom functions, error handling)',
        'Financial modelling (NPV, IRR, PMT, amortisation)',
        'Sensitivity analysis and scenario modelling',
        'Statistical analysis (regression, hypothesis testing)',
        'Engineering functions', 'Cube functions for OLAP',
        'Custom number format codes',
        'Advanced array manipulation (HSTACK, VSTACK, TOCOL, TOROW)',
        'Regular expressions via VBA', 'Add-in development',
        'Performance optimisation (volatile functions, calculation modes)',
        'Collaboration (co-authoring, version history)',
    ],
}


# ──────────────────────────────────────────────────────────────────────
# Level-Aware Feedback Templates (unchanged from original)
# ──────────────────────────────────────────────────────────────────────

LEVEL_FEEDBACK_TEMPLATES = {
    'foundation': {
        'opening_excellent': (
            "Excellent work! You've demonstrated a strong grasp of fundamental Excel skills. "
            "Your understanding of basic formulas, data entry, and formatting is impressive."
        ),
        'opening_good': (
            "Good effort on this assignment! You're building a solid foundation in Excel. "
            "Keep practising and you'll master these basics in no time."
        ),
        'opening_needs_work': (
            "Thank you for your submission. There are some areas where your Excel fundamentals "
            "need strengthening. Don't worry — everyone starts here, and with practice you'll improve quickly."
        ),
        'criterion_suggestions': {
            'Formulas': {
                0: "Start with basic formulas: type =SUM(A1:A10) to add numbers, =AVERAGE(B1:B5) for averages, and =COUNT(C1:C20) to count entries. These are the building blocks of all Excel work.",
                30: "Good start with formulas! Next, try using =IF(A1>50, \\\"Pass\\\", \\\"Fail\\\") for conditional logic, and =ROUND(B1, 2) for rounding. Practice referencing cells instead of typing numbers directly.",
                60: "Nice formula work! To reach the next level, try =CONCATENATE() or =TEXTJOIN() for combining text, and learn the difference between relative (A1) and absolute ($A$1) references.",
            },
            'Charts': {
                0: "Try creating your first chart: select your data, go to Insert → Chart, and choose a bar or column chart. Charts help visualise your data and are essential for presentations.",
                30: "You have a chart — great start! Make sure to add a descriptive title and axis labels. Try different chart types to see which best tells your data's story.",
                60: "Good chart usage! Experiment with formatting options: change colours, add data labels, and try a line chart for trends or a pie chart for proportions.",
            },
            'Formatting': {
                0: "Apply basic formatting to make your spreadsheet professional: bold your headers, use number formats for currency ($) and dates, and add borders to your data table.",
                30: "Your formatting is developing. Try adjusting column widths, adding colour to headers, merging cells for titles, and using consistent number formats throughout.",
                60: "Good formatting foundation! To improve, explore Format as Table (Ctrl+T), custom number formats, and use alignment/wrapping to make data easier to read.",
            },
        },
    },
    'intermediate': {
        'opening_excellent': (
            "Outstanding work! Your competency with intermediate Excel features is impressive. "
            "You've shown strong skills with lookup functions, data analysis, and PivotTables."
        ),
        'opening_good': (
            "Good work on this intermediate-level assignment! Your skills with formulas and "
            "data analysis are developing well. Continue strengthening the areas noted below."
        ),
        'opening_needs_work': (
            "Thank you for your submission. At the intermediate level, we expect stronger "
            "use of lookup functions, conditional formulas, and PivotTables. "
            "Review the feedback below and focus on the highlighted areas."
        ),
        'criterion_suggestions': {
            'Formulas': {
                0: "At this level, you should be using VLOOKUP or INDEX/MATCH for data lookups, SUMIFS/COUNTIFS for conditional calculations, and IFERROR for error handling. These are essential intermediate skills.",
                30: "You have some formulas, but at the intermediate level we need to see VLOOKUP (or XLOOKUP), nested IF functions, and conditional aggregation (SUMIFS, COUNTIFS, AVERAGEIFS) with multiple criteria.",
                60: "Good formula variety! To improve, try combining INDEX/MATCH instead of VLOOKUP for two-way lookups, use SUMPRODUCT for complex multi-criteria calculations, and add IFERROR around all lookup formulas.",
            },
            'PivotTables': {
                0: "PivotTables are a key intermediate skill. Select your data and go to Insert → PivotTable. Drag fields to Rows, Columns, and Values areas. Group dates by month/quarter.",
                30: "Your PivotTable is basic. Try adding Value Field Settings to change from Count to Sum/Average, group date fields, and add multiple value fields for comparison analysis.",
                60: "Good PivotTable usage! Consider grouping date fields, changing number formats in the PivotTable, adding report filters, and creating a PivotChart from your PivotTable.",
            },
            'Formatting': {
                0: "At the intermediate level, you should use Conditional Formatting (Home → Conditional Formatting) to highlight important data, and Data Validation for dropdown lists and input restrictions.",
                30: "Add conditional formatting rules to highlight: top/bottom values, values above/below average, or use formulas-based rules. Create data validation dropdowns for user-friendly input.",
                60: "Good formatting! Enhance with named ranges (Formulas → Name Manager), icon sets for visual indicators, and custom conditional formatting rules using formulas.",
            },
        },
    },
    'advanced': {
        'opening_excellent': (
            "Exceptional work! Your mastery of advanced Excel features is evident. "
            "The use of dynamic arrays, Power Query, and sophisticated data analysis shows "
            "real proficiency."
        ),
        'opening_good': (
            "Solid advanced-level work! Your data modelling and analysis skills are developing "
            "well. Focus on the areas below to refine your expertise."
        ),
        'opening_needs_work': (
            "At the advanced level, we expect proficiency with INDEX/MATCH or XLOOKUP, "
            "dynamic arrays, Power Query transformations, and complex PivotTables with "
            "calculated fields. Review the detailed feedback below."
        ),
        'criterion_suggestions': {
            'Formulas': {
                0: "Advanced work requires INDEX/MATCH or XLOOKUP for flexible lookups, dynamic array functions (FILTER, SORT, UNIQUE), and SUMPRODUCT for multi-criteria analysis. Start incorporating these.",
                30: "You need more advanced formulas. Use XLOOKUP with match_mode and search_mode parameters, dynamic arrays (=FILTER(A:A, B:B=\\\"criteria\\\")), and LET() to simplify complex calculations.",
                60: "Good advanced formula usage! Consider using INDIRECT for dynamic references, OFFSET for dynamic named ranges, and combining FILTER with SORT for powerful data extraction.",
            },
            'PivotTables': {
                0: "Advanced PivotTables should include: calculated fields (PivotTable Analyze → Fields, Items & Sets), slicers for interactive filtering, and data from the Data Model.",
                30: "Your PivotTable needs calculated fields for custom metrics, slicers for user interactivity, and proper field grouping. Consider building the PivotTable from the Data Model for multi-table analysis.",
                60: "Strong PivotTable skills! To reach full marks, add calculated items for variance analysis, connect slicers to multiple PivotTables, and use GETPIVOTDATA for formula-based PivotTable references.",
            },
            'PowerQuery_M': {
                0: "Power Query is essential at the advanced level. Go to Data → Get Data to import and transform data. Learn merge (join) queries, group-by aggregations, and unpivot transformations.",
                30: "Your Power Query needs more transformations. Add merge queries (like SQL JOINs), group-by operations for aggregation, and custom columns with M expressions.",
                60: "Good Power Query work! Improve with error handling in M code, custom functions, conditional columns, and proper data type handling for robust ETL pipelines.",
            },
        },
    },
    'expert': {
        'opening_excellent': (
            "Outstanding professional-level work! Your mastery of VBA, advanced formulas, "
            "and data modelling demonstrates expert-level Excel proficiency. "
            "This is the quality expected of an Excel professional."
        ),
        'opening_good': (
            "Good expert-level submission! You're developing strong professional Excel skills. "
            "Refine the areas noted below to achieve full mastery."
        ),
        'opening_needs_work': (
            "At the expert level, we expect VBA programming with error handling, "
            "LAMBDA/LET functions, advanced Power Query, and sophisticated data modelling. "
            "Your current submission needs significant improvement in these areas."
        ),
        'criterion_suggestions': {
            'Formulas': {
                0: "Expert-level formulas should include LAMBDA for custom reusable functions, LET for clean intermediate calculations, and MAP/REDUCE/SCAN for array manipulation. Master these for professional Excel work.",
                30: "Intermediate formulas detected — at the expert level, use LAMBDA to create custom functions, LET to break complex formulas into readable steps, and BYROW/BYCOL for row-wise/column-wise operations.",
                60: "Good advanced formula usage! To achieve expert level, create LAMBDA-based custom functions, use MAP/REDUCE for array transformations, and combine HSTACK/VSTACK for dynamic data restructuring.",
            },
            'VBA': {
                0: "Expert-level VBA is expected: create at least one Sub or Function procedure with proper error handling (On Error GoTo), typed variables (Dim x As Long), and comments explaining the logic.",
                30: "Your VBA code needs improvement. Add Option Explicit at the top, use proper error handling (On Error GoTo ErrHandler), type all variables, and break complex logic into separate procedures.",
                60: "Good VBA implementation! To improve: add a UserForm for user interaction, use class modules for object-oriented design, implement proper logging, and follow naming conventions (prefixes like str, int, rng).",
            },
            'PowerQuery_M': {
                0: "Expert Power Query work requires advanced M language: custom functions, error handling with try/otherwise, dynamic parameters, and complex transformation chains.",
                30: "Your Power Query needs advanced features: custom M functions (let fn = (x) => ...), error handling with try/otherwise, and dynamic query parameters.",
                60: "Good Power Query work! For expert level, create reusable custom M functions, implement buffering for performance, use List.Generate for complex iterations, and add comprehensive error handling.",
            },
        },
    },
}
