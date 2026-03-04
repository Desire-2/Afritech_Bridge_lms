"""
Expert Feedback Generator

Produces professional, educational feedback referencing specific cells,
sheets, formulas, VBA modules, and Power Query queries.

Uses AI (OpenRouter/Gemini) for enhanced natural-language feedback when
available; falls back to template-based generation.

Level-aware: adjusts tone, expectations, and suggestions based on the
detected mastery level (foundation → expert).
"""

import logging
import json
from typing import Dict, Any, List, Optional

from .excel_mastery_levels import LEVEL_FEEDBACK_TEMPLATES

logger = logging.getLogger(__name__)


class FeedbackGenerator:
    """
    Generates structured, actionable feedback from grading results.
    
    Output tone: Professional, instructor-like, educational, clear.
    Adapts language and suggestions to the student's mastery level.
    """

    def __init__(
        self,
        grading_result: Dict[str, Any],
        workbook_analysis: Dict[str, Any],
        formula_analysis: Dict[str, Any],
        chart_analysis: Dict[str, Any],
        pivot_analysis: Dict[str, Any],
        vba_analysis: Dict[str, Any],
        pq_analysis: Dict[str, Any],
        formatting_analysis: Dict[str, Any],
        assignment_title: str = '',
        student_name: str = '',
        module_title: str = '',
        assignment_instructions: str = '',
        mastery_level: Optional[Dict[str, Any]] = None,
    ):
        self.result = grading_result
        self.wb = workbook_analysis
        self.formulas = formula_analysis
        self.charts = chart_analysis
        self.pivots = pivot_analysis
        self.vba = vba_analysis
        self.pq = pq_analysis
        self.formatting = formatting_analysis
        self.title = assignment_title
        self.student = student_name
        self.module_title = module_title
        self.assignment_instructions = assignment_instructions

        # Level-aware context
        self.mastery_level = mastery_level or {}
        self.level_id = self.mastery_level.get('level_id', 'intermediate')
        self.level_templates = LEVEL_FEEDBACK_TEMPLATES.get(self.level_id, LEVEL_FEEDBACK_TEMPLATES.get('intermediate', {}))

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate(self) -> str:
        """Generate comprehensive feedback text."""
        sections = []

        # Opening
        sections.append(self._opening())

        # Strengths & weaknesses summary (from grading engine)
        summary = self._strengths_weaknesses_summary()
        if summary:
            sections.append(summary)

        # Per-criterion feedback
        breakdown = self.result.get('rubric_breakdown', {})
        for criterion, data in breakdown.items():
            if data.get('max', 0) > 0:
                section = self._criterion_feedback(criterion, data)
                if section:
                    sections.append(section)

        # Specific cell/formula references
        detail = self._detailed_references()
        if detail:
            sections.append(detail)

        # Flagged issues
        flagged = self.result.get('flagged_issues', [])
        if flagged:
            sections.append(self._flagged_section(flagged))

        # Closing
        sections.append(self._closing())

        return '\n\n'.join(s for s in sections if s)

    def generate_ai_enhanced(self, ai_service=None) -> str:
        """
        Generate AI-enhanced feedback using OpenRouter or Gemini.
        Falls back to template-based generation if AI is unavailable.
        """
        base_feedback = self.generate()

        if ai_service is None:
            return base_feedback

        try:
            prompt = self._build_ai_prompt(base_feedback)
            response = ai_service.generate_text(prompt, max_tokens=2000)
            if response and len(response) > 100:
                return response
        except Exception as e:
            logger.warning(f"AI feedback enhancement failed: {e}")

        return base_feedback

    # ------------------------------------------------------------------
    # Section builders
    # ------------------------------------------------------------------

    def _opening(self) -> str:
        """Build the opening section — level-aware tone."""
        pct = self.result.get('percentage', 0)
        grade = self.result.get('grade', '')
        total = self.result.get('total_score', 0)
        max_score = self.result.get('max_score', 100)

        greeting = f"Dear {self.student}," if self.student else "Dear Student,"

        # Level-specific opening message
        if pct >= 80:
            level_text = self.level_templates.get('opening_excellent', 'Excellent work!')
        elif pct >= 60:
            level_text = self.level_templates.get('opening_good', 'Good effort!')
        else:
            level_text = self.level_templates.get('opening_needs_work', 'Your work needs improvement.')

        module_note = f" (Module: {self.module_title})" if self.module_title else ''

        # Level badge
        level_name = self.mastery_level.get('level_name', 'Intermediate')
        level_badge = f"📊 **Assessment Level: {level_name}**\n\n" if self.mastery_level else ''

        return (
            f"{greeting}\n\n"
            f"Thank you for submitting your assignment"
            f"{f' \"{self.title}\"' if self.title else ''}"
            f"{module_note}.\n\n"
            f"{level_badge}"
            f"**Overall Score: {total}/{max_score} ({pct}%) — Grade: {grade}**\n\n"
            f"{level_text} "
            f"Please review the detailed feedback below for each evaluation area."
        )

    def _strengths_weaknesses_summary(self) -> str:
        """Build a quick summary of strengths and areas to improve."""
        strengths = self.result.get('strengths', [])
        weaknesses = self.result.get('weaknesses', [])

        if not strengths and not weaknesses:
            return ""

        lines = ["### 📌 Quick Summary"]
        if strengths:
            lines.append("**Strengths:**")
            for s in strengths:
                lines.append(f"  ✅ {s}")
        if weaknesses:
            lines.append("**Areas to Improve:**")
            for w in weaknesses:
                lines.append(f"  🔧 {w}")
        return '\n'.join(lines)

    def _criterion_feedback(self, name: str, data: Dict[str, Any]) -> str:
        """Build feedback for a single criterion."""
        score = data.get('score', 0)
        max_pts = data.get('max', 0)
        comment = data.get('comment', '')
        pct = round(score / max(max_pts, 1) * 100)

        # Icon based on performance
        icon = "✅" if pct >= 80 else "⚠️" if pct >= 50 else "❌"

        header = f"### {icon} {name.replace('_', ' ')} — {score}/{max_pts}"

        output = [header]
        if comment:
            output.append(comment)

        # Add specific improvement suggestions
        suggestion = self._improvement_suggestion(name, pct, data)
        if suggestion:
            output.append(f"**Suggestion:** {suggestion}")

        return '\n'.join(output)

    def _improvement_suggestion(self, criterion: str, pct: int, data: Dict) -> str:
        """Generate improvement suggestion based on criterion performance and mastery level."""
        if pct >= 90:
            return ""

        # Try level-specific suggestions from templates first
        level_suggestions = self.level_templates.get('criterion_suggestions', {}).get(criterion, {})
        if level_suggestions:
            for threshold in sorted(level_suggestions.keys()):
                if pct <= threshold + 30:
                    return level_suggestions[threshold]

        # Fallback: generic suggestions (not level-specific)
        fallback = {
            'Formulas': {
                0: "Start by adding basic formulas (SUM, AVERAGE, COUNT). Then try lookup functions like VLOOKUP or INDEX/MATCH.",
                30: "You have some formulas but need more variety. Try using SUMIFS/COUNTIFS for conditional calculations, and IFERROR for error handling.",
                60: "Good formula foundation. To improve, use advanced functions like XLOOKUP, LET, or LAMBDA. Add error handling with IFERROR/IFNA.",
            },
            'PivotTables': {
                0: "Create at least one PivotTable to summarize your data. Select your data range → Insert → PivotTable.",
                30: "Your PivotTable is basic. Add calculated fields, use grouping, and consider adding slicers for interactivity.",
                60: "Good PivotTable usage. Consider adding slicers, calculated fields, or multiple data aggregations for full marks.",
            },
            'Charts': {
                0: "Add charts to visualize your data. Choose chart types that best represent your data (bar for comparisons, line for trends, pie for proportions).",
                30: "Add titles and labels to all charts. Ensure source data ranges are correct and chart types match the data story.",
                60: "Good charts. Ensure all have proper titles, axis labels, and consider using dynamic chart sources.",
            },
            'PowerQuery_M': {
                0: "Use Power Query (Data → Get Data) to import and transform your data. Learn basic transformations: filter, sort, change types.",
                30: "Your Power Query needs more transformations. Try merging queries, grouping data, and using custom columns.",
                60: "Good query structure. Add merge operations, group-by aggregations, and ensure proper data type handling.",
            },
            'VBA': {
                0: "Create VBA macros to automate tasks: Alt+F11 → Insert Module. Start with simple Sub procedures that manipulate cells.",
                30: "Your VBA code needs improvement. Add error handling (On Error), use typed variable declarations (Dim x As Integer), and add comments.",
                60: "Decent VBA code. Improve by using Option Explicit, proper naming conventions, error handling, and modular procedures.",
            },
            'Formatting': {
                0: "Apply basic formatting: headers, number formats (currency/dates), and conditional formatting to highlight key data.",
                30: "Improve formatting: use consistent number formats, add data validation for input cells, and apply conditional formatting rules.",
                60: "Good formatting foundation. Add named ranges, data validation, and more conditional formatting for a polished result.",
            },
            'Completeness': {
                0: "Your submission appears incomplete. Ensure all required sheets and data are present.",
                30: "Several requirements are missing. Review the assignment instructions and ensure all requested deliverables are included.",
                60: "Nearly complete. Check for any missing sheets or specific requirements from the assignment brief.",
            },
        }

        crit_suggestions = fallback.get(criterion, {})
        for threshold in sorted(crit_suggestions.keys()):
            if pct <= threshold + 30:
                return crit_suggestions[threshold]

        return ""

    def _detailed_references(self) -> str:
        """Add specific cell/formula references."""
        details = []

        # Formula issues
        formula_issues = self.formulas.get('issues', [])
        error_handling = self.formulas.get('error_handling', {})

        if error_handling.get('unhandled_errors'):
            details.append("**Cell Errors Detected:**")
            for err in error_handling['unhandled_errors'][:5]:
                details.append(f"  - Cell `{err['cell']}` in sheet \"{err['sheet']}\": `{err['error']}`")

        # Sample formulas for reference
        sample_formulas = self.formulas.get('formulas_sample', [])
        if sample_formulas:
            details.append("\n**Sample Formulas Reviewed:**")
            for f in sample_formulas[:5]:
                details.append(f"  - `{f['cell']}` ({f['sheet']}): `{f['formula'][:80]}`")

        # VBA module references
        if self.vba.get('has_vba') and self.vba.get('modules'):
            details.append("\n**VBA Modules Analyzed:**")
            for m in self.vba['modules'][:5]:
                details.append(
                    f"  - Module \"{m['name']}\" ({m['type']}): "
                    f"{m.get('procedure_count', 0)} procedure(s), "
                    f"{m.get('line_count', 0)} lines"
                )

        # Power Query references
        if self.pq.get('has_power_query') and self.pq.get('queries'):
            details.append("\n**Power Queries Analyzed:**")
            for q in self.pq['queries'][:5]:
                details.append(
                    f"  - Query \"{q['name']}\": "
                    f"{q.get('step_count', 0)} steps, "
                    f"Transformations: {', '.join(q.get('transformations', [])[:3]) or 'N/A'}"
                )

        if details:
            return "### 📋 Detailed References\n" + '\n'.join(details)
        return ""

    def _flagged_section(self, flagged: List[Dict[str, str]]) -> str:
        """Build flagged issues section."""
        lines = ["### ⚠️ Flagged Issues"]
        for f in flagged:
            lines.append(f"- **{f['type'].replace('_', ' ').title()}**: {f['description']}")
        return '\n'.join(lines)

    def _closing(self) -> str:
        """Build closing section."""
        confidence = self.result.get('confidence', 'medium')
        manual = self.result.get('manual_review_required', True)

        closing = []
        closing.append("---")

        if manual:
            closing.append(
                "*This grade was generated by AI analysis and requires instructor review "
                "before being finalized. The instructor may adjust the score based on "
                "additional criteria not captured by automated analysis.*"
            )
        else:
            closing.append(
                "*This grade was generated by AI analysis. If you believe there is an error, "
                "please contact your instructor for a manual review.*"
            )

        closing.append(f"\n*Analysis confidence: {confidence}*")
        closing.append("\nKeep up the learning and practice! Each assignment builds on the last.")

        return '\n'.join(closing)

    # ------------------------------------------------------------------
    # AI enhancement prompt
    # ------------------------------------------------------------------

    def _build_ai_prompt(self, base_feedback: str) -> str:
        """Build prompt for AI-enhanced feedback generation."""
        level_name = self.mastery_level.get('level_name', 'Intermediate')
        return f"""You are a senior MS Excel instructor providing feedback on a student's assignment.

The student is at the **{level_name}** level. Tailor your language, expectations, 
and suggestions to this skill level. Be encouraging for beginners, technically precise 
for advanced students.

Based on the following automated analysis and grading, rewrite the feedback to be more natural,
educational, and instructor-like. Keep all specific references (cells, formulas, modules, queries).
Maintain a professional, encouraging tone. Be specific about what's good and what needs improvement.

Assignment: {self.title}
Level: {level_name}
Score: {self.result.get('total_score')}/{self.result.get('max_score')} ({self.result.get('percentage')}%)

Automated Feedback:
{base_feedback}

Rewrite this feedback as a polished instructor letter. Keep the same structure but make it more
natural and educational. Include all cell references, formula examples, and technical details.
Do not change the scores or grade. Respond only with the feedback text."""
