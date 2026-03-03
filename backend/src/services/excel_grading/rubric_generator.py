"""
Intelligent Rubric Generator

Deeply parses assignment instructions to automatically build a task-specific
rubric when no instructor rubric is provided.  Understands:

  - Multi-part assignments (Part 1, Part 2, …)
  - Numbered tasks / questions
  - Expected Excel features (PivotTables, Data Model, Calculated Items, …)
  - Theoretical / written reflection questions
  - Relative complexity weighting

The generated rubric feeds directly into ``GradingEngine._build_rubric()``.
"""

import re
import logging
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────
# Concept vocabulary — maps keywords in instructions to concepts the
# grading engine can verify.  Each entry:
#   keyword  →  (concept_id, category, base_weight, description)
# ──────────────────────────────────────────────────────────────────────

_CONCEPT_VOCABULARY: List[Tuple[str, str, str, float, str]] = [
    # keyword,             concept_id,             category,       weight, human label
    # ─── PivotTable family ────────────────────────────────────────────
    ('pivot table',        'pivot_table',          'PivotTables',  3.0,  'PivotTable creation'),
    ('pivottable',         'pivot_table',          'PivotTables',  3.0,  'PivotTable creation'),
    ('pivot chart',        'pivot_chart',          'Charts',       2.0,  'PivotChart creation'),
    ('pivotchart',         'pivot_chart',          'Charts',       2.0,  'PivotChart creation'),
    ('calculated item',    'calc_item',            'PivotTables',  4.0,  'Calculated Item implementation'),
    ('calculated field',   'calc_field',           'PivotTables',  3.5,  'Calculated Field creation'),
    ('slicer',             'slicer',               'PivotTables',  2.0,  'Slicer / timeline usage'),
    ('timeline',           'slicer',               'PivotTables',  2.0,  'Timeline usage'),
    ('data model',         'data_model',           'PivotTables',  4.0,  'Data Model / relationships'),
    ('relationship',       'relationship',         'PivotTables',  3.5,  'Table relationship definition'),
    ('one-to-many',        'relationship',         'PivotTables',  3.0,  'One-to-Many relationship'),
    ('many-to-one',        'relationship',         'PivotTables',  3.0,  'Many-to-One relationship'),
    ('fact table',         'data_model',           'PivotTables',  2.5,  'Fact table identification'),
    ('lookup table',       'data_model',           'PivotTables',  2.5,  'Lookup table identification'),
    ('dimension table',    'data_model',           'PivotTables',  2.5,  'Dimension table identification'),
    ('report layout',      'report_layout',        'PivotTables',  2.0,  'Report layout design'),

    # ─── Formula / function family ────────────────────────────────────
    ('vlookup',            'vlookup',              'Formulas',     3.0,  'VLOOKUP function'),
    ('xlookup',            'xlookup',              'Formulas',     3.0,  'XLOOKUP function'),
    ('hlookup',            'hlookup',              'Formulas',     2.5,  'HLOOKUP function'),
    ('index',              'index_match',          'Formulas',     3.0,  'INDEX function'),
    ('match',              'index_match',          'Formulas',     3.0,  'MATCH function'),
    ('sumif',              'sumif',                'Formulas',     2.5,  'SUMIF/SUMIFS function'),
    ('sumifs',             'sumif',                'Formulas',     2.5,  'SUMIFS function'),
    ('countif',            'countif',              'Formulas',     2.5,  'COUNTIF/COUNTIFS function'),
    ('countifs',           'countif',              'Formulas',     2.5,  'COUNTIFS function'),
    ('averageif',          'averageif',            'Formulas',     2.5,  'AVERAGEIF/AVERAGEIFS'),
    ('iferror',            'iferror',              'Formulas',     2.0,  'IFERROR error handling'),
    ('if function',        'if_func',              'Formulas',     2.0,  'IF function'),
    ('nested if',          'nested_if',            'Formulas',     3.0,  'Nested IF formulas'),
    ('conditional formula','cond_formula',         'Formulas',     2.5,  'Conditional formulas'),
    ('array formula',      'array_formula',        'Formulas',     3.5,  'Array formula usage'),
    ('dynamic array',      'dynamic_array',        'Formulas',     3.5,  'Dynamic array function'),
    ('lambda',             'lambda',               'Formulas',     4.0,  'LAMBDA function'),
    ('let function',       'let',                  'Formulas',     3.5,  'LET function'),
    ('variance',           'variance_calc',        'Formulas',     3.0,  'Variance calculation'),

    # ─── Chart family ─────────────────────────────────────────────────
    ('chart',              'chart',                'Charts',       2.0,  'Chart creation'),
    ('graph',              'chart',                'Charts',       2.0,  'Graph creation'),
    ('dashboard',          'dashboard',            'Charts',       3.5,  'Dashboard design'),
    ('visualization',      'visualization',        'Charts',       2.5,  'Data visualization'),
    ('sparkline',          'sparkline',            'Charts',       2.0,  'Sparkline usage'),
    ('combo chart',        'combo_chart',          'Charts',       3.0,  'Combo chart'),

    # ─── VBA / macro family ───────────────────────────────────────────
    ('vba',                'vba_code',             'VBA',          4.0,  'VBA programming'),
    ('macro',              'macro',                'VBA',          3.0,  'Macro recording/editing'),
    ('userform',           'userform',             'VBA',          4.0,  'UserForm creation'),
    ('automate',           'automation',           'VBA',          3.0,  'Task automation'),

    # ─── Power Query family ───────────────────────────────────────────
    ('power query',        'power_query',          'PowerQuery_M', 4.0,  'Power Query usage'),
    ('get & transform',    'power_query',          'PowerQuery_M', 3.5,  'Get & Transform'),
    ('m language',         'm_language',           'PowerQuery_M', 4.0,  'M language'),
    ('query editor',       'query_editor',         'PowerQuery_M', 3.0,  'Query Editor steps'),
    ('merge queries',      'merge_query',          'PowerQuery_M', 3.5,  'Merge queries'),
    ('append queries',     'append_query',         'PowerQuery_M', 3.0,  'Append queries'),
    ('etl',                'etl',                  'PowerQuery_M', 3.0,  'ETL process'),

    # ─── Formatting family ────────────────────────────────────────────
    ('conditional format', 'cond_format',          'Formatting',   2.5,  'Conditional formatting'),
    ('data validation',    'data_validation',      'Formatting',   2.5,  'Data validation rules'),
    ('named range',        'named_range',          'Formatting',   2.0,  'Named ranges'),
    ('table style',        'table_style',          'Formatting',   1.5,  'Table styling'),
    ('cell formatting',    'cell_format',          'Formatting',   1.0,  'Cell formatting'),
    ('number format',      'number_format',        'Formatting',   1.5,  'Number formatting'),
    ('data bars',          'data_bars',            'Formatting',   2.0,  'Data bars'),
    ('color scale',        'color_scale',          'Formatting',   2.0,  'Color scales'),
    ('icon set',           'icon_set',             'Formatting',   2.0,  'Icon sets'),

    # ─── Theory / reflection ──────────────────────────────────────────
    ('explain',            'theoretical',          'Completeness', 2.0,  'Theoretical explanation'),
    ('justify',            'theoretical',          'Completeness', 2.0,  'Justification'),
    ('reflection',         'theoretical',          'Completeness', 2.0,  'Theoretical reflection'),
    ('describe the process', 'process_desc',       'Completeness', 1.5,  'Process description'),
    ('outline the steps',  'process_desc',         'Completeness', 1.5,  'Step-by-step outline'),
    ('compare',            'comparison',           'Completeness', 2.0,  'Comparison analysis'),
    ('benefit',            'benefit_analysis',     'Completeness', 1.5,  'Benefit analysis'),
]


class RubricGenerator:
    """
    Generates a structured rubric from assignment instructions.

    The generated rubric has the same format as ``instructor_rubric``
    accepted by ``GradingEngine``, so it plugs in transparently.
    """

    def __init__(self, max_points: float = 100.0):
        self.max_points = max_points

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate(
        self,
        assignment_title: str,
        assignment_description: str,
        assignment_instructions: str,
        module_title: str = '',
        module_description: str = '',
        module_objectives: str = '',
        points_possible: float = 100.0,
    ) -> Dict[str, Any]:
        """
        Generate a rubric from assignment text.

        Returns a dict with:
          - criteria: list of {name, description, max_points, expected_elements}
          - total_points: float
          - parts: list of detected assignment parts
          - scope: {scope_formulas, scope_pivots, …}  flags
          - generation_method: 'instruction_analysis'
        """
        self.max_points = points_possible or 100.0

        # Combine all text sources
        all_text = '\n'.join(filter(None, [
            assignment_title or '',
            assignment_description or '',
            assignment_instructions or '',
            module_title or '',
            module_description or '',
            module_objectives or '',
        ]))

        if not all_text.strip():
            return self._empty_rubric()

        # Step 1: Detect structural parts (Part 1, Part 2, …)
        parts = self._detect_parts(assignment_instructions or assignment_description or '')

        # Step 2: Detect numbered tasks within each part (or globally)
        tasks = self._detect_tasks(assignment_instructions or assignment_description or '')

        # Step 3: Concept extraction from instructions
        concepts = self._extract_concepts(all_text)

        # Step 4: Build criteria from parts + tasks + concepts
        criteria = self._build_criteria(parts, tasks, concepts)

        # Step 5: Assign weights / max points
        criteria = self._assign_weights(criteria, self.max_points)

        # Step 6: Derive scope flags from criteria categories
        scope = self._derive_scope(criteria)

        # Step 7: Build the rubric dict (compatible with GradingEngine)
        total_pts = sum(c['max_points'] for c in criteria)
        rubric = {
            'criteria': criteria,
            'total_points': round(total_pts, 1),
            'parts': parts,
            'scope': scope,
            'generation_method': 'instruction_analysis',
            'task_count': len(tasks),
            'concept_count': len(concepts),
        }

        logger.info(
            f"Generated rubric for '{assignment_title}': "
            f"{len(criteria)} criteria, {len(parts)} parts, "
            f"{len(tasks)} tasks, {round(total_pts, 1)} total pts"
        )

        return rubric

    # ------------------------------------------------------------------
    # Step 1: Detect parts
    # ------------------------------------------------------------------

    def _detect_parts(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect multi-part structure like:
          Part 1: Calculated Item Implementation (Variance Analysis)
          Part 2: Data Model and Relationship Setup
          Part 3: Report Construction and Analysis
        """
        parts = []

        # Pattern: "Part N:" or "Part N —" or "Section N:" etc.
        part_pattern = re.compile(
            r'(?:^|\n)\s*(?:Part|Section|Phase)\s+(\d+)\s*[:\-—–]\s*(.+?)(?=\n|$)',
            re.IGNORECASE | re.MULTILINE,
        )

        for match in part_pattern.finditer(text):
            part_num = int(match.group(1))
            part_title = match.group(2).strip()
            part_start = match.end()

            parts.append({
                'number': part_num,
                'title': part_title,
                'start_pos': match.start(),
                'end_pos': part_start,
            })

        # Set each part's text range
        for i, part in enumerate(parts):
            if i + 1 < len(parts):
                part['text'] = text[part['end_pos']:parts[i + 1]['start_pos']]
            else:
                part['text'] = text[part['end_pos']:]

        return parts

    # ------------------------------------------------------------------
    # Step 2: Detect numbered tasks
    # ------------------------------------------------------------------

    def _detect_tasks(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect numbered tasks/questions like:
          1. Define the goal: Calculate the 'Variance' ...
          2. Explain the critical distinction: ...
          8. Theoretical Reflection: Based on ...
        """
        tasks = []

        # Pattern: "N." or "N)" at start of line, followed by task text
        task_pattern = re.compile(
            r'(?:^|\n)\s*(\d+)\s*[.)]\s*(.+?)(?=\n\s*\d+\s*[.)]|\n\s*(?:Part|Section)\s+\d|\Z)',
            re.IGNORECASE | re.DOTALL,
        )

        for match in task_pattern.finditer(text):
            task_num = int(match.group(1))
            task_text = match.group(2).strip()
            # Clean up multi-line continuations
            task_text = re.sub(r'\s+', ' ', task_text)

            # Determine task type
            task_type = self._classify_task(task_text)

            # Extract expected elements from the task text
            expected = self._extract_expected_elements(task_text)

            tasks.append({
                'number': task_num,
                'text': task_text[:300],  # truncate for storage
                'type': task_type,
                'expected_elements': expected,
                'complexity': self._estimate_complexity(task_text),
            })

        return tasks

    # ------------------------------------------------------------------
    # Step 3: Extract concepts
    # ------------------------------------------------------------------

    def _extract_concepts(self, text: str) -> List[Dict[str, Any]]:
        """Extract Excel concepts mentioned in the text using vocabulary."""
        text_lower = text.lower()
        found_concepts: Dict[str, Dict[str, Any]] = {}

        for keyword, concept_id, category, weight, label in _CONCEPT_VOCABULARY:
            if keyword in text_lower:
                if concept_id not in found_concepts:
                    found_concepts[concept_id] = {
                        'id': concept_id,
                        'category': category,
                        'weight': weight,
                        'label': label,
                        'keywords_matched': [keyword],
                    }
                else:
                    # Already found — add keyword but don't duplicate
                    if keyword not in found_concepts[concept_id]['keywords_matched']:
                        found_concepts[concept_id]['keywords_matched'].append(keyword)
                    # Boost weight slightly for multiple keyword matches
                    found_concepts[concept_id]['weight'] = min(
                        found_concepts[concept_id]['weight'] + 0.5,
                        6.0,
                    )

        return list(found_concepts.values())

    # ------------------------------------------------------------------
    # Step 4: Build criteria
    # ------------------------------------------------------------------

    def _build_criteria(
        self,
        parts: List[Dict],
        tasks: List[Dict],
        concepts: List[Dict],
    ) -> List[Dict[str, Any]]:
        """
        Build rubric criteria by merging parts, tasks, and concepts.

        Strategy:
          - If parts are detected, create one criterion per part.
          - Sub-tasks within parts add expected elements and increase weight.
          - Concepts not covered by tasks are added as additional criteria.
          - Always add Formatting and Completeness criteria.
        """
        criteria = []

        if parts:
            # ── Part-based criteria ────────────────────────────
            for part in parts:
                part_text = (part.get('text', '') + ' ' + part.get('title', '')).lower()
                part_concepts = [
                    c for c in concepts
                    if any(kw in part_text for kw in c.get('keywords_matched', []))
                ]

                # Find tasks that belong to this part
                part_tasks = self._tasks_for_part(tasks, part, parts)

                # Determine primary category from concepts
                category = self._primary_category(part_concepts) or 'Completeness'

                expected = []
                for t in part_tasks:
                    expected.extend(t.get('expected_elements', []))
                for c in part_concepts:
                    expected.append(c['label'])
                expected = list(dict.fromkeys(expected))  # dedupe, preserve order

                complexity = sum(t.get('complexity', 1.0) for t in part_tasks) + \
                             sum(c.get('weight', 1.0) for c in part_concepts)

                criteria.append({
                    'name': f"Part {part['number']}: {part['title'][:60]}",
                    'description': part.get('title', ''),
                    'category': category,
                    'expected_elements': expected,
                    'task_count': len(part_tasks),
                    'concept_count': len(part_concepts),
                    'raw_weight': complexity,
                    'max_points': 0,  # assigned in step 5
                })
        elif tasks:
            # ── Task-based criteria (no parts detected) ────────
            for task in tasks:
                task_concepts = [
                    c for c in concepts
                    if any(kw in task['text'].lower() for kw in c.get('keywords_matched', []))
                ]
                category = self._primary_category(task_concepts) or self._category_from_task_type(task['type'])

                criteria.append({
                    'name': f"Task {task['number']}: {task['text'][:50]}",
                    'description': task['text'][:200],
                    'category': category,
                    'expected_elements': task.get('expected_elements', []),
                    'task_count': 1,
                    'concept_count': len(task_concepts),
                    'raw_weight': task.get('complexity', 1.0) + sum(c.get('weight', 1.0) for c in task_concepts),
                    'max_points': 0,
                })
        else:
            # ── Concept-based criteria (no structure) ──────────
            by_category: Dict[str, List[Dict]] = {}
            for c in concepts:
                by_category.setdefault(c['category'], []).append(c)

            for category, cat_concepts in by_category.items():
                criteria.append({
                    'name': category.replace('_', ' '),
                    'description': ', '.join(c['label'] for c in cat_concepts),
                    'category': category,
                    'expected_elements': [c['label'] for c in cat_concepts],
                    'task_count': 0,
                    'concept_count': len(cat_concepts),
                    'raw_weight': sum(c['weight'] for c in cat_concepts),
                    'max_points': 0,
                })

        # ── Always add Formatting criterion if not present ─────
        has_formatting = any(c['category'] == 'Formatting' for c in criteria)
        if not has_formatting:
            criteria.append({
                'name': 'Formatting & Presentation',
                'description': 'Professional formatting, layout, and readability.',
                'category': 'Formatting',
                'expected_elements': ['Clear layout', 'Proper formatting', 'Professional presentation'],
                'task_count': 0,
                'concept_count': 0,
                'raw_weight': 2.0,
                'max_points': 0,
            })

        # ── Always add Completeness criterion ──────────────────
        criteria.append({
            'name': 'Overall Completeness',
            'description': 'All required parts and tasks attempted; file structure.',
            'category': 'Completeness',
            'expected_elements': ['All parts attempted', 'File structure correct'],
            'task_count': 0,
            'concept_count': 0,
            'raw_weight': 2.0,
            'max_points': 0,
        })

        return criteria

    # ------------------------------------------------------------------
    # Step 5: Assign weights
    # ------------------------------------------------------------------

    def _assign_weights(self, criteria: List[Dict], total_pts: float) -> List[Dict]:
        """Distribute total_pts across criteria proportional to raw_weight."""
        total_weight = sum(c.get('raw_weight', 1.0) for c in criteria)
        if total_weight == 0:
            total_weight = len(criteria) or 1

        for criterion in criteria:
            raw = criterion.get('raw_weight', 1.0)
            pts = round((raw / total_weight) * total_pts, 1)
            # Minimum 2 points per criterion
            criterion['max_points'] = max(2.0, pts)

        # Normalize so sum == total_pts exactly
        actual_total = sum(c['max_points'] for c in criteria)
        if actual_total > 0 and abs(actual_total - total_pts) > 0.5:
            factor = total_pts / actual_total
            for c in criteria:
                c['max_points'] = round(c['max_points'] * factor, 1)

        return criteria

    # ------------------------------------------------------------------
    # Step 6: Derive scope flags
    # ------------------------------------------------------------------

    def _derive_scope(self, criteria: List[Dict]) -> Dict[str, bool]:
        """Derive scope_* flags from the categories present in criteria."""
        categories = {c['category'] for c in criteria if c.get('max_points', 0) > 0}

        return {
            'scope_formulas':    'Formulas' in categories or True,  # always on
            'scope_pivots':      'PivotTables' in categories,
            'scope_charts':      'Charts' in categories,
            'scope_vba':         'VBA' in categories,
            'scope_power_query': 'PowerQuery_M' in categories,
            'scope_formatting':  'Formatting' in categories or True,  # always on
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _classify_task(self, task_text: str) -> str:
        """Classify a task into a type category."""
        text = task_text.lower()

        if any(kw in text for kw in ['explain', 'justify', 'describe', 'reflection', 'compare', 'benefit']):
            return 'theoretical'
        if any(kw in text for kw in ['create', 'build', 'design', 'construct', 'implement']):
            return 'practical_build'
        if any(kw in text for kw in ['define', 'specify', 'identify', 'outline']):
            return 'definition'
        if any(kw in text for kw in ['calculate', 'compute', 'formula', 'function']):
            return 'calculation'
        if any(kw in text for kw in ['format', 'style', 'layout']):
            return 'formatting'
        return 'general'

    def _extract_expected_elements(self, task_text: str) -> List[str]:
        """Extract specific expected elements from task text."""
        elements = []
        text = task_text.lower()

        # Look for quoted terms (column names, labels, etc.)
        quoted = re.findall(r"['\"]([^'\"]+)['\"]", task_text)
        for q in quoted:
            if len(q) < 60:
                elements.append(q)

        # Look for specific formulas or expressions
        formula_match = re.findall(r'=\s*[A-Za-z]+\([^)]*\)', task_text)
        elements.extend(formula_match[:5])

        # Look for "named X" patterns
        named_pattern = re.findall(r'named?\s+["\']?(\w[\w\s]+\w)["\']?', text)
        for n in named_pattern:
            if len(n) < 40:
                elements.append(f"Named: {n.strip()}")

        return elements[:10]  # cap at 10

    def _estimate_complexity(self, task_text: str) -> float:
        """Estimate task complexity on a 1.0 – 5.0 scale."""
        text = task_text.lower()
        score = 1.0

        # Length suggests more work
        if len(text) > 200:
            score += 0.5
        if len(text) > 400:
            score += 0.5

        # Multiple sub-steps
        step_count = len(re.findall(r'\d+[.)]\s', text))
        score += min(step_count * 0.3, 1.5)

        # Advanced concepts
        advanced = ['data model', 'calculated item', 'calculated field',
                     'relationship', 'vba', 'power query', 'lambda', 'dynamic array']
        for kw in advanced:
            if kw in text:
                score += 0.5

        # Theoretical questions are generally lighter in grading weight
        if any(kw in text for kw in ['explain', 'justify', 'reflection']):
            score = max(score - 0.3, 1.0)

        return min(score, 5.0)

    def _tasks_for_part(
        self,
        tasks: List[Dict],
        part: Dict,
        all_parts: List[Dict],
    ) -> List[Dict]:
        """Find tasks that belong to a specific part by number sequencing."""
        part_num = part['number']
        part_idx = next((i for i, p in enumerate(all_parts) if p['number'] == part_num), -1)

        if part_idx < 0:
            return []

        # Find the task number range for this part
        # The first task after the part header, up to the next part
        part_text = part.get('text', '')
        task_nums_in_text = [int(m) for m in re.findall(r'(?:^|\s)(\d+)\s*[.)]', part_text)]

        if task_nums_in_text:
            return [t for t in tasks if t['number'] in task_nums_in_text]

        # Fallback: split tasks evenly across parts
        if not all_parts:
            return tasks

        tasks_per_part = max(1, len(tasks) // len(all_parts))
        start = part_idx * tasks_per_part
        end = start + tasks_per_part if part_idx < len(all_parts) - 1 else len(tasks)
        return tasks[start:end]

    def _primary_category(self, concepts: List[Dict]) -> Optional[str]:
        """Get the dominant category from a list of concepts."""
        if not concepts:
            return None

        category_weights: Dict[str, float] = {}
        for c in concepts:
            cat = c['category']
            category_weights[cat] = category_weights.get(cat, 0) + c.get('weight', 1.0)

        return max(category_weights, key=category_weights.get)

    def _category_from_task_type(self, task_type: str) -> str:
        """Map task type to rubric category."""
        mapping = {
            'theoretical': 'Completeness',
            'practical_build': 'PivotTables',
            'definition': 'Completeness',
            'calculation': 'Formulas',
            'formatting': 'Formatting',
        }
        return mapping.get(task_type, 'Completeness')

    def _empty_rubric(self) -> Dict[str, Any]:
        """Return a minimal rubric when no instructions are available."""
        return {
            'criteria': [
                {'name': 'Formulas', 'description': 'Formula usage', 'category': 'Formulas', 'max_points': 30, 'expected_elements': []},
                {'name': 'Formatting', 'description': 'Formatting quality', 'category': 'Formatting', 'max_points': 20, 'expected_elements': []},
                {'name': 'Completeness', 'description': 'Overall completeness', 'category': 'Completeness', 'max_points': 50, 'expected_elements': []},
            ],
            'total_points': 100.0,
            'parts': [],
            'scope': {
                'scope_formulas': True,
                'scope_pivots': False,
                'scope_charts': False,
                'scope_vba': False,
                'scope_power_query': False,
                'scope_formatting': True,
            },
            'generation_method': 'fallback_empty',
            'task_count': 0,
            'concept_count': 0,
        }
