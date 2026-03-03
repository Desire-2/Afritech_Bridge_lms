"""
Formula Analyzer - Deep analysis of Excel formulas.

Detects: function usage, advanced functions (XLOOKUP, LAMBDA, LET, etc.),
reference types (absolute/relative), error handling, formula complexity.
"""

import re
import logging
from typing import Dict, Any, List, Set, Tuple
from collections import Counter

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────
# Comprehensive Excel Function Knowledge Base
# 500+ functions across 16 categories — from beginner to expert level
# ──────────────────────────────────────────────────────────────────────

FUNCTION_CATEGORIES = {
    # ── Basic Math & Arithmetic (Foundation) ──────────────────────
    'basic_math': {
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

    # ── Statistical Analysis (Intermediate → Advanced) ────────────
    'statistical': {
        'MEDIAN', 'MODE', 'MODE.SNGL', 'MODE.MULT',
        'STDEV', 'STDEV.S', 'STDEV.P', 'STDEVPA',
        'VAR', 'VAR.S', 'VAR.P', 'VARPA',
        'CORREL', 'COVARIANCE.P', 'COVARIANCE.S',
        'PERCENTILE', 'PERCENTILE.INC', 'PERCENTILE.EXC',
        'PERCENTRANK.INC', 'PERCENTRANK.EXC',
        'QUARTILE', 'QUARTILE.INC', 'QUARTILE.EXC',
        'LARGE', 'SMALL', 'RANK', 'RANK.AVG', 'RANK.EQ',
        'FREQUENCY', 'AVERAGEIF', 'AVERAGEIFS',
        'FORECAST', 'FORECAST.LINEAR', 'FORECAST.ETS',
        'TREND', 'GROWTH', 'LINEST', 'LOGEST',
        'SLOPE', 'INTERCEPT', 'RSQ', 'STEYX',
        'CONFIDENCE', 'CONFIDENCE.NORM', 'CONFIDENCE.T',
        'GEOMEAN', 'HARMEAN', 'TRIMMEAN',
        'DEVSQ', 'AVEDEV', 'SKEW', 'KURT',
        'NORM.DIST', 'NORM.INV', 'NORM.S.DIST', 'NORM.S.INV',
        'T.DIST', 'T.INV', 'T.DIST.2T', 'T.INV.2T', 'T.TEST',
        'F.DIST', 'F.INV', 'F.TEST',
        'CHISQ.DIST', 'CHISQ.INV', 'CHISQ.TEST',
        'Z.TEST', 'BETA.DIST', 'BETA.INV',
        'GAMMA.DIST', 'GAMMA.INV', 'GAMMALN',
        'WEIBULL.DIST', 'EXPON.DIST', 'LOGNORM.DIST', 'LOGNORM.INV',
        'POISSON.DIST', 'BINOM.DIST', 'BINOM.INV',
        'NEGBINOM.DIST', 'HYPGEOM.DIST',
        'PROB', 'PERMUT', 'PERMUTATIONA',
    },

    # ── Logical Functions (Foundation → Intermediate) ─────────────
    'logical': {
        'IF', 'IFS', 'AND', 'OR', 'NOT', 'XOR',
        'IFERROR', 'IFNA', 'SWITCH', 'CHOOSE',
        'TRUE', 'FALSE',
    },

    # ── Lookup & Reference (Intermediate → Expert) ────────────────
    'lookup_reference': {
        'VLOOKUP', 'HLOOKUP', 'XLOOKUP', 'INDEX', 'MATCH',
        'OFFSET', 'INDIRECT', 'ROW', 'COLUMN', 'ROWS', 'COLUMNS',
        'LOOKUP', 'ADDRESS', 'XMATCH',
        'CHOOSECOLS', 'CHOOSEROWS', 'TAKE', 'DROP',
        'HYPERLINK', 'FORMULATEXT', 'GETPIVOTDATA',
        'AREAS', 'TRANSPOSE',
    },

    # ── Text & String Manipulation ────────────────────────────────
    'text': {
        'CONCATENATE', 'CONCAT', 'TEXTJOIN', 'LEFT', 'RIGHT', 'MID',
        'LEN', 'FIND', 'SEARCH', 'SUBSTITUTE', 'REPLACE', 'TRIM',
        'CLEAN', 'UPPER', 'LOWER', 'PROPER', 'TEXT', 'VALUE',
        'REPT', 'EXACT', 'CHAR', 'CODE', 'NUMBERVALUE',
        'FIXED', 'DOLLAR', 'UNICHAR', 'UNICODE',
        'TEXTBEFORE', 'TEXTAFTER', 'TEXTSPLIT',
        'VALUETOTEXT', 'ARRAYTOTEXT',
    },

    # ── Date & Time ───────────────────────────────────────────────
    'date_time': {
        'DATE', 'TODAY', 'NOW', 'YEAR', 'MONTH', 'DAY', 'HOUR',
        'MINUTE', 'SECOND', 'DATEDIF', 'EDATE', 'EOMONTH',
        'WEEKDAY', 'WEEKNUM', 'ISOWEEKNUM',
        'WORKDAY', 'WORKDAY.INTL', 'NETWORKDAYS', 'NETWORKDAYS.INTL',
        'DATEVALUE', 'TIMEVALUE', 'TIME',
        'YEARFRAC', 'DAYS', 'DAYS360',
    },

    # ── Conditional Aggregation (Intermediate) ────────────────────
    'conditional_aggregation': {
        'SUMIF', 'SUMIFS', 'COUNTIF', 'COUNTIFS',
        'AVERAGEIF', 'AVERAGEIFS', 'MAXIFS', 'MINIFS',
        'SUMPRODUCT',
    },

    # ── Dynamic Array Functions (Advanced → Expert) ───────────────
    'dynamic_array': {
        'FILTER', 'SORT', 'SORTBY', 'UNIQUE', 'SEQUENCE',
        'RANDARRAY', 'LET', 'LAMBDA', 'MAP', 'REDUCE',
        'SCAN', 'MAKEARRAY', 'BYROW', 'BYCOL',
        'HSTACK', 'VSTACK', 'WRAPCOLS', 'WRAPROWS',
        'TOCOL', 'TOROW', 'TEXTSPLIT', 'TEXTBEFORE', 'TEXTAFTER',
        'CHOOSECOLS', 'CHOOSEROWS', 'TAKE', 'DROP',
        'EXPAND', 'GROUPBY', 'PIVOTBY',
    },

    # ── Error Handling & IS-Functions ─────────────────────────────
    'error_handling': {
        'IFERROR', 'IFNA', 'ISERROR', 'ISNA', 'ISERR',
        'ISBLANK', 'ISNUMBER', 'ISTEXT', 'ISLOGICAL',
        'ISNONTEXT', 'ISREF', 'ISFORMULA', 'ISEVEN', 'ISODD',
        'ERROR.TYPE', 'TYPE',
    },

    # ── Financial Functions (Advanced → Expert) ───────────────────
    'financial': {
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
        'FVSCHEDULE', 'PDURATION', 'RRI',
        'AMORLINC', 'AMORDEGRC',
    },

    # ── Information Functions ─────────────────────────────────────
    'information': {
        'CELL', 'INFO', 'ISBLANK', 'ISERROR', 'ISLOGICAL',
        'ISNA', 'ISNONTEXT', 'ISNUMBER', 'ISREF', 'ISTEXT',
        'N', 'NA', 'TYPE', 'FORMULATEXT', 'SHEET', 'SHEETS',
        'ISFORMULA',
    },

    # ── Database Functions (Intermediate → Advanced) ──────────────
    'database': {
        'DSUM', 'DAVERAGE', 'DCOUNT', 'DCOUNTA',
        'DMAX', 'DMIN', 'DGET', 'DVAR', 'DVARP',
        'DSTDEV', 'DSTDEVP', 'DPRODUCT',
    },

    # ── Engineering Functions (Expert) ────────────────────────────
    'engineering': {
        'BIN2DEC', 'BIN2HEX', 'BIN2OCT',
        'DEC2BIN', 'DEC2HEX', 'DEC2OCT',
        'HEX2BIN', 'HEX2DEC', 'HEX2OCT',
        'OCT2BIN', 'OCT2DEC', 'OCT2HEX',
        'COMPLEX', 'IMAGINARY', 'IMREAL',
        'IMSUM', 'IMSUB', 'IMPRODUCT', 'IMDIV',
        'IMABS', 'IMARGUMENT', 'IMCONJUGATE',
        'IMPOWER', 'IMSQRT',
        'CONVERT', 'DELTA', 'GESTEP',
        'ERF', 'ERFC',
        'BITAND', 'BITOR', 'BITXOR', 'BITLSHIFT', 'BITRSHIFT',
    },

    # ── Web Functions (Advanced) ──────────────────────────────────
    'web': {
        'ENCODEURL', 'FILTERXML', 'WEBSERVICE',
    },

    # ── Cube Functions (Expert — Power Pivot / OLAP) ──────────────
    'cube': {
        'CUBEMEMBER', 'CUBEVALUE', 'CUBESET',
        'CUBESETCOUNT', 'CUBERANKEDMEMBER',
        'CUBEMEMBERPROPERTY', 'CUBEKPIMEMBER',
    },
}

# Functions considered "advanced" for scoring purposes
# These indicate skill beyond basic spreadsheet use
ADVANCED_FUNCTIONS = (
    FUNCTION_CATEGORIES['lookup_reference'] |
    FUNCTION_CATEGORIES['dynamic_array'] |
    FUNCTION_CATEGORIES['conditional_aggregation'] |
    FUNCTION_CATEGORIES['financial'] |
    FUNCTION_CATEGORIES['database'] |
    FUNCTION_CATEGORIES['engineering'] |
    FUNCTION_CATEGORIES['cube'] |
    FUNCTION_CATEGORIES['web'] |
    {'IFS', 'SWITCH', 'LAMBDA', 'LET', 'MAP', 'REDUCE', 'SCAN',
     'BYROW', 'BYCOL', 'MAKEARRAY', 'HSTACK', 'VSTACK',
     'FORECAST.ETS', 'LINEST', 'LOGEST', 'TREND', 'GROWTH'}
)

# Expert-tier functions — the highest level of Excel mastery
EXPERT_FUNCTIONS = {
    'LAMBDA', 'LET', 'MAP', 'REDUCE', 'SCAN',
    'BYROW', 'BYCOL', 'MAKEARRAY',
    'HSTACK', 'VSTACK', 'WRAPCOLS', 'WRAPROWS',
    'TOCOL', 'TOROW', 'EXPAND', 'GROUPBY', 'PIVOTBY',
    'XNPV', 'XIRR', 'MIRR', 'DURATION', 'MDURATION',
    'CUBEMEMBER', 'CUBEVALUE', 'CUBESET',
    'LINEST', 'LOGEST', 'FORECAST.ETS',
}

# Regex to extract function names from formulas
_FUNC_RE = re.compile(r'([A-Z][A-Z0-9_.]+)\s*\(', re.IGNORECASE)

# Absolute reference patterns
_ABS_COL_RE = re.compile(r'\$[A-Z]+\d+')
_ABS_ROW_RE = re.compile(r'[A-Z]+\$\d+')
_ABS_BOTH_RE = re.compile(r'\$[A-Z]+\$\d+')
_RELATIVE_RE = re.compile(r'(?<!\$)[A-Z]+(?<!\$)\d+')


class FormulaAnalyzer:
    """Analyzes formulas extracted from Excel workbook analysis."""

    def __init__(self, analysis_data: Dict[str, Any]):
        """
        Args:
            analysis_data: Output from ExcelAnalyzer.analyze()
        """
        self.analysis_data = analysis_data
        self.all_formulas: List[Dict[str, Any]] = []
        self._collect_formulas()

    def _collect_formulas(self):
        """Gather all formulas from all sheets."""
        for sheet in self.analysis_data.get('sheets', []):
            for f in sheet.get('formulas', []):
                self.all_formulas.append(f)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def analyze(self) -> Dict[str, Any]:
        """Run comprehensive formula analysis."""
        if not self.all_formulas:
            return {
                'formula_count': 0,
                'functions_used': [],
                'function_categories': {},
                'advanced_functions_used': [],
                'reference_analysis': {},
                'error_handling_used': False,
                'complexity_score': 0,
                'issues': [],
                'summary': 'No formulas found in the workbook.',
            }

        functions_used = self._extract_all_functions()
        categories = self._categorize_functions(functions_used)
        advanced = self._find_advanced_functions(functions_used)
        expert = self._find_expert_functions(functions_used)
        refs = self._analyze_references()
        errors = self._check_error_handling()
        complexity = self._compute_complexity(functions_used, categories, advanced, refs)
        issues = self._find_issues()

        return {
            'formula_count': len(self.all_formulas),
            'functions_used': sorted(functions_used.keys()),
            'function_frequency': dict(functions_used.most_common(30)),
            'function_categories': categories,
            'category_count': len(categories),
            'advanced_functions_used': sorted(advanced),
            'advanced_function_count': len(advanced),
            'expert_functions_used': sorted(expert),
            'expert_function_count': len(expert),
            'reference_analysis': refs,
            'error_handling': errors,
            'complexity_score': complexity,
            'issues': issues,
            'formulas_sample': self.all_formulas[:20],
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _extract_all_functions(self) -> Counter:
        """Extract and count all function names from formulas."""
        counter: Counter = Counter()
        for f in self.all_formulas:
            formula_text = f.get('formula', '')
            matches = _FUNC_RE.findall(formula_text)
            for m in matches:
                counter[m.upper()] += 1
        return counter

    def _categorize_functions(self, func_counts: Counter) -> Dict[str, List[str]]:
        """Map used functions to their categories."""
        result: Dict[str, List[str]] = {}
        for cat, funcs in FUNCTION_CATEGORIES.items():
            used = [fn for fn in func_counts if fn in funcs]
            if used:
                result[cat] = sorted(used)
        return result

    def _find_advanced_functions(self, func_counts: Counter) -> Set[str]:
        """Identify advanced functions that were used."""
        return {fn for fn in func_counts if fn in ADVANCED_FUNCTIONS}

    def _find_expert_functions(self, func_counts: Counter) -> Set[str]:
        """Identify expert-tier functions that were used."""
        return {fn for fn in func_counts if fn in EXPERT_FUNCTIONS}

    def _analyze_references(self) -> Dict[str, Any]:
        """Analyze absolute vs relative references."""
        absolute_count = 0
        relative_count = 0
        mixed_count = 0

        for f in self.all_formulas:
            text = f.get('formula', '')
            abs_both = len(_ABS_BOTH_RE.findall(text))
            abs_col = len(_ABS_COL_RE.findall(text)) - abs_both
            abs_row = len(_ABS_ROW_RE.findall(text)) - abs_both
            absolute_count += abs_both
            mixed_count += abs_col + abs_row

            # Approximate relative (not preceded by $)
            all_refs = len(re.findall(r'[A-Z]+\d+', text))
            relative_count += max(0, all_refs - abs_both - abs_col - abs_row)

        total = absolute_count + relative_count + mixed_count or 1
        return {
            'absolute_references': absolute_count,
            'relative_references': relative_count,
            'mixed_references': mixed_count,
            'absolute_pct': round(absolute_count / total * 100, 1),
            'uses_absolute_references': absolute_count > 0,
            'uses_mixed_references': mixed_count > 0,
        }

    def _check_error_handling(self) -> Dict[str, Any]:
        """Check if formulas use error handling functions."""
        error_funcs = FUNCTION_CATEGORIES['error_handling']
        used = set()
        for f in self.all_formulas:
            text = f.get('formula', '').upper()
            for fn in error_funcs:
                if fn in text:
                    used.add(fn)

        # Also check for existing cell errors in the workbook
        cell_errors = []
        for sheet in self.analysis_data.get('sheets', []):
            cell_errors.extend(sheet.get('cell_errors', []))

        return {
            'error_handling_functions_used': sorted(used),
            'has_error_handling': len(used) > 0,
            'unhandled_errors': cell_errors,
            'unhandled_error_count': len(cell_errors),
        }

    def _compute_complexity(self, func_counts, categories, advanced, refs) -> int:
        """
        Compute a formula complexity score 0-100.
        
        Factors:
        - Number of unique functions (up to 20pts)
        - Category diversity (up to 20pts)
        - Advanced function usage (up to 25pts)
        - Reference sophistication (up to 15pts)
        - Formula nesting depth (up to 20pts)
        """
        score = 0

        # Unique functions (0-20)
        unique_count = len(func_counts)
        score += min(20, unique_count * 2)

        # Category diversity (0-20)
        score += min(20, len(categories) * 3)

        # Advanced functions (0-25)
        score += min(25, len(advanced) * 5)

        # Reference sophistication (0-15)
        if refs.get('uses_absolute_references'):
            score += 8
        if refs.get('uses_mixed_references'):
            score += 7

        # Nesting depth approximation (0-20)
        max_nesting = 0
        for f in self.all_formulas:
            text = f.get('formula', '')
            depth = self._estimate_nesting(text)
            max_nesting = max(max_nesting, depth)
        score += min(20, max_nesting * 4)

        return min(100, score)

    def _estimate_nesting(self, formula: str) -> int:
        """Estimate nesting depth by counting nested parentheses."""
        max_depth = 0
        depth = 0
        for ch in formula:
            if ch == '(':
                depth += 1
                max_depth = max(max_depth, depth)
            elif ch == ')':
                depth -= 1
        return max_depth

    def _find_issues(self) -> List[Dict[str, str]]:
        """Detect common formula issues."""
        issues = []

        # Check for hard-coded numbers in formulas (magic numbers)
        magic_number_count = 0
        for f in self.all_formulas:
            text = f.get('formula', '')
            # Numbers not part of cell refs or function names
            nums = re.findall(r'(?<![A-Z$])(\d{2,})(?!\d*[A-Z])', text)
            if nums:
                magic_number_count += 1

        if magic_number_count > 5:
            issues.append({
                'type': 'magic_numbers',
                'description': f'{magic_number_count} formulas contain hard-coded numbers. Consider using named ranges or cell references.',
            })

        # Check for unhandled errors
        for sheet in self.analysis_data.get('sheets', []):
            for err in sheet.get('cell_errors', []):
                issues.append({
                    'type': 'cell_error',
                    'description': f"Cell {err['cell']} in sheet '{err['sheet']}' has error: {err['error']}",
                })

        # Check for very long formulas (possible inefficiency)
        for f in self.all_formulas:
            if len(f.get('formula', '')) > 500:
                issues.append({
                    'type': 'complex_formula',
                    'description': f"Cell {f['cell']} in sheet '{f['sheet']}' has a very long formula ({len(f['formula'])} chars). Consider breaking into helper columns.",
                })

        return issues


def check_required_formulas(
    formula_analysis: Dict[str, Any],
    required_functions: List[str]
) -> Dict[str, Any]:
    """
    Check if specific required functions are present.

    Args:
        formula_analysis: Output of FormulaAnalyzer.analyze()
        required_functions: List of function names required (e.g. ['VLOOKUP', 'SUMIFS']).

    Returns:
        Dict with found/missing functions and compliance percentage.
    """
    used = set(formula_analysis.get('functions_used', []))
    required = set(fn.upper() for fn in required_functions)
    found = required & used
    missing = required - used

    total = len(required) or 1
    return {
        'required_functions': sorted(required),
        'found': sorted(found),
        'missing': sorted(missing),
        'compliance_pct': round(len(found) / total * 100, 1),
    }
