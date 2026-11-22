"""Frontend Development Evaluator (Service F).

Static source inspection + supplied test evidence.  The evaluator deliberately
separates

* **presence/structure** signals it can prove from the source (HTML semantics,
  viewport meta, media queries, alt text, …) → ``CODE_SUPPORTED``/`VERIFIED`,
* **behaviour** claims it *cannot* prove without running the page → never
  reported as ``VERIFIED``.

An extensible hook (:class:`BrowserTestAdapter`) is defined so Playwright /
isolated browser execution can be plugged in later without changing this
class's contract or the orchestrator.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Sequence

from .base import BaseEvaluator, CriterionEvaluation, EvaluationContext, EvaluatorOutput
from .registry import register_evaluator

HTML_EXT = (".html", ".htm")
FRONTEND_EXT = (".html", ".htm", ".css", ".scss", ".sass", ".less",
                ".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte")


class BrowserTestAdapter:
    """Placeholder for future isolated browser execution.

    Deliberately unimplemented: the engine must not claim runtime behaviour it
    cannot observe.  When a Playwright runner is introduced it will implement
    ``run(ctx) -> {"cases": [{name, passed, evidence}]}`` and the evaluator will
    promote matching criteria from CODE_SUPPORTED to VERIFIED.
    """

    available = False

    def run(self, ctx: EvaluationContext) -> Dict[str, Any]:  # pragma: no cover
        return {"cases": [], "error": "browser execution not configured"}


class FrontendEvaluator(BaseEvaluator):
    name = "frontend"
    version = "1.0.0"
    kind = "hybrid"
    supported_disciplines = ("frontend", "fullstack", "mobile")
    supported_extensions = FRONTEND_EXT
    description = ("Static HTML/CSS/JS/React analysis with evidence-grounded "
                   "criterion scoring.")

    # ------------------------------------------------------------------

    _UI_MARKERS = (
        "<html", "<!doctype html", "<div", "<section", "<nav", "<form",
        "document.queryselector", "reactdom", "createelement(", "usestate(",
        "createapp(", "vuerouter", "tailwind", "bootstrap", "display: flex",
        "display:flex", "@media", "classname=", "render(",
    )

    def is_compatible(self, ctx: EvaluationContext) -> bool:
        """Claim browser-facing work, not every script in the submission."""
        if ctx.classification.discipline in self.supported_disciplines:
            return True
        for f in ctx.files:
            if not f.path.lower().endswith(self.supported_extensions):
                continue
            head = f.text[:8000].lower()
            if any(marker in head for marker in self._UI_MARKERS):
                return True
        return False

    # ------------------------------------------------------------------
    # Static analysis
    # ------------------------------------------------------------------

    def analyze(self, ctx: EvaluationContext) -> Dict[str, Any]:
        checks: Dict[str, Dict[str, Any]] = {}

        def record(key: str, passed: bool, summary: str, evidence: List[Dict[str, Any]],
                   behaviour: bool = False) -> None:
            checks[key] = {
                "passed": bool(passed),
                "summary": summary,
                "evidence": evidence,
                # behaviour checks are never "verified" by static inspection
                "supports": "UNVERIFIED" if behaviour and not passed
                            else ("CODE_SUPPORTED" if not passed else
                                  ("UNVERIFIED" if behaviour else "VERIFIED")),
            }

        html_files = [f for f in ctx.files if f.path.lower().endswith(HTML_EXT)]
        css_files = [f for f in ctx.files
                     if f.path.lower().endswith((".css", ".scss", ".sass", ".less"))]
        js_files = [f for f in ctx.files
                     if f.path.lower().endswith((".js", ".jsx", ".ts", ".tsx"))]

        # ---- HTML semantics -------------------------------------------
        html_text = "\n".join(f.text for f in html_files)[:400000]
        doctype = bool(re.search(r"<!doctype\s+html", html_text, re.I))
        record("doctype", doctype,
               "HTML5 doctype declared" if doctype else "no <!DOCTYPE html> found",
               self.evidence_from_hits(
                   self.grep(ctx, r"<!doctype\s+html", re.I),
                   "doctype declaration"))

        lang = bool(re.search(r"<html[^>]+lang\s*=", html_text, re.I))
        lang_evidence = self.evidence_from_hits(
            self.grep(ctx, r"<html[^>]+lang\s*=\s*[\"'][a-zA-Z-]+", re.I),
            "html lang attribute")
        record("lang", lang,
               "document language declared" if lang else "missing <html lang=…>",
               lang_evidence)

        viewport = bool(re.search(r"name\s*=\s*[\"']viewport", html_text, re.I))
        record("viewport", viewport,
               "responsive viewport meta present" if viewport
               else "no viewport meta — page is not responsive by declaration",
               self.evidence_from_hits(
                   self.grep(ctx, r"name\s*=\s*[\"']viewport[\"']", re.I),
                   "viewport meta", category="VERIFIED"))

        headings = [int(m) for m in re.findall(r"<h([1-6])\b", html_text, re.I)]
        h1_ok = headings.count(1) == 1
        skips = _heading_skips(headings)
        record("headings", h1_ok and not skips,
               f"{headings.count(1)} h1, hierarchy issues: {skips or 'none'}",
               self.evidence_from_hits(
                   self.grep(ctx, r"<h[1-6]\b", re.I), "heading tags"),
               behaviour=False)

        landmarks = [tag for tag in ("header", "nav", "main", "footer")
                     if re.search(rf"<{tag}\b", html_text, re.I)]
        record("landmarks", len(landmarks) >= 2,
               f"semantic landmarks present: {', '.join(landmarks) or 'none'}",
               [dict(path=f.path, summary=f"semantic <{t}> used", category="CODE_SUPPORTED",
                     source="static_analysis", locator="", detail={})
                for f in html_files[:1] for t in landmarks[:4]])

        images = re.findall(r"<img\b[^>]*>", html_text, re.I)
        missing_alt = [i for i in images if not re.search(r"\balt\s*=", i, re.I)]
        record("alt_text", bool(images) and not missing_alt,
               f"{len(images)} images, {len(missing_alt)} without alt",
               self.evidence_from_hits(
                   self.grep(ctx, r"<img\b(?![^>]*\balt\s*=)[^>]*>", re.I),
                   "image without alt", category="CODE_SUPPORTED")[:3])

        labels = len(re.findall(r"<label\b", html_text, re.I))
        inputs = len(re.findall(r"<input\b(?![^>]*type\s*=\s*[\"']hidden)", html_text, re.I))
        record("form_labels", inputs == 0 or labels >= inputs * 0.6,
               f"{inputs} inputs, {labels} labels",
               self.evidence_from_hits(self.grep(ctx, r"<label\b", re.I),
                                       "form label", category="CODE_SUPPORTED")[:3])

        # ---- CSS / responsive ------------------------------------------
        media_queries = self.grep(ctx, r"@media[^{]*")
        record("responsive_css", bool(media_queries),
               f"{len(media_queries)} @media rule(s) found" if media_queries
               else "no @media queries found — responsive layout unproven",
               self.evidence_from_hits(media_queries, "@media query",
                                       category="CODE_SUPPORTED"))
        layout = self.grep(ctx, r"\b(display\s*:\s*(flex|grid)|grid-template|flex-wrap)\b", re.I)
        record("modern_layout", bool(layout),
               "flex/grid layout used" if layout else "no flex/grid detected",
               self.evidence_from_hits(layout, "layout rule",
                                       category="CODE_SUPPORTED")[:3])

        # ---- JS functionality ------------------------------------------
        events = self.grep(ctx, r"addEventListener|onclick\s*=|\.on\(\s*[\"']click")
        dom = self.grep(ctx, r"querySelector|getElementById|document\.(body|getElement)")
        record("dom_interaction", bool(events or dom),
               f"{len(events)} event bindings, {len(dom)} DOM lookups",
               self.evidence_from_hits((events + dom)[:5], "DOM/event usage")[:3],
               behaviour=True)

        errors = self.grep(ctx, r"\btry\s*:|\bcatch\s*\(|\.catch\(")
        record("error_handling", bool(errors),
               "explicit error handling present" if errors
               else "no try/catch or promise error handling found",
               self.evidence_from_hits(errors, "error handling", category="CODE_SUPPORTED")[:3])

        # ---- framework / architecture ----------------------------------
        framework = [fw for fw in ("React", "Next.js", "Vue", "Svelte")
                     if fw.lower() in " ".join(ctx.manifest.frameworks).lower()]
        components = self.grep(ctx, r"^\s*export\s+(default\s+)?(function|const|class)\s+[A-Z]",
                               re.M) if framework else []
        record("components", bool(components) if framework else True,
               f"{len(components)} component-like exports" if framework
               else "no component framework detected",
               self.evidence_from_hits(components, "component export")[:5])

        # ---- quality / docs / tests -------------------------------------
        long_files = [f.path for f in js_files if len(f.text) > 400_000]
        record("file_size", not long_files,
               "source files within readable size" if not long_files
               else f"very large files: {long_files[:3]}",
               [], behaviour=False)

        console_leftovers = self.grep(ctx, r"console\.(log|debug|warn)\(")
        record("clean_console", len(console_leftovers) <= 3,
               f"{len(console_leftovers)} console.* call(s)",
               self.evidence_from_hits(console_leftovers, "console call",
                                       category="CODE_SUPPORTED")[:3])

        record("documentation", bool(ctx.manifest.doc_files),
               f"documentation files: {ctx.manifest.doc_files or 'none'}",
               [{"path": p, "summary": "documentation file present",
                 "category": "VERIFIED", "source": "artifact_manifest",
                 "locator": "", "detail": {}} for p in ctx.manifest.doc_files[:3]])
        record("tests", bool(ctx.manifest.test_files),
               f"test files: {len(ctx.manifest.test_files)}",
               [{"path": p, "summary": "test file present",
                 "category": "VERIFIED", "source": "artifact_manifest",
                 "locator": "", "detail": {}} for p in ctx.manifest.test_files[:3]])

        # ---- requirement keywords from the brief ------------------------
        required_terms = _requirement_terms(ctx.descriptor.description)
        found_terms = []
        missing_terms = []
        haystack = (html_text + "\n" + "\n".join(f.text for f in js_files +
                                                  css_files)).lower()
        for term in required_terms:
            (found_terms if term.lower() in haystack else missing_terms).append(term)
        record("requirements", not required_terms or len(found_terms) >= max(
            1, int(len(required_terms) * 0.6)),
               f"{len(found_terms)}/{len(required_terms)} requirement keywords located",
               [{"path": t, "summary": f"requirement keyword '{t}' found in source",
                 "category": "CODE_SUPPORTED", "source": "static_analysis",
                 "locator": "", "detail": {}} for t in found_terms[:8]],
               behaviour=True)

        passed = sum(1 for c in checks.values() if c["passed"])
        return {
            "evaluator": self.name,
            "version": self.version,
            "checks": checks,
            "passed": passed,
            "total": len(checks),
            "html_files": [f.path for f in html_files],
            "css_files": [f.path for f in css_files],
            "js_files": [f.path for f in js_files],
            "frameworks": ctx.manifest.frameworks,
            "behaviour_limitation":
                "static inspection cannot prove runtime behaviour; no browser "
                "test adapter is configured for this run",
        }

    # ------------------------------------------------------------------

    def evaluate(self, ctx: EvaluationContext,
                 criteria: Sequence[Dict[str, Any]]) -> EvaluatorOutput:
        analysis = self.analyze(ctx)
        extra = (
            "- Only mark a behaviour requirement as 'verified' if CONTEXT.analysis."
            "checks contains a check whose supports == 'VERIFIED'.\n"
            "- Presence of a function, class or file name is CODE_SUPPORTED at best; "
            "it never proves the feature works.\n"
            "- When the analysis reports a failing check that maps to a criterion, "
            "lower the marks and cite that check in the rationale."
        )
        raw, call = self.run_llm(ctx, criteria, extra_instructions=extra)
        output = self.build_output(
            criteria=criteria, raw=raw, ctx=ctx, analysis=analysis,
            fallback_rationale=(
                "Automated frontend evaluation unavailable; deterministic checks "
                "are recorded but marks were not awarded without model review."),
            llm_call=call,
        )
        # Deterministic checks may only *lower* evidence quality, never raise
        # a criterion's category above what the analysis supports.
        self._align_evidence_with_checks(output, analysis)
        if not ctx.manifest.test_files:
            output.warnings.append("no test files supplied — behaviour remains unverified")
        return output

    @staticmethod
    def _align_evidence_with_checks(output: EvaluatorOutput, analysis: Dict[str, Any]) -> None:
        checks = analysis.get("checks") or {}
        failing = [k for k, v in checks.items() if not v.get("passed")]
        if not failing:
            return
        for evaluation in output.criteria:
            lowered = (evaluation.rationale + " " + evaluation.feedback).lower()
            normalised = lowered.replace("_", " ").replace("-", " ")
            for key in failing:
                if key.replace("_", " ") in normalised:
                    evaluation.verification_status = "unverified"
                    evaluation.evidence_category = "UNVERIFIED"
                    if evaluation.max_marks > 0:
                        evaluation.marks = round(
                            min(evaluation.marks, evaluation.max_marks * 0.5), 4)
                    evaluation.limitations = (
                        (evaluation.limitations + " deterministic check "
                         f"'{key}' did not pass; marks capped until reviewed"
                         ).strip())[:600]


def _heading_skips(levels: Sequence[int]) -> List[str]:
    issues: List[str] = []
    previous = 0
    for level in levels:
        if previous and level > previous + 1:
            issues.append(f"h{previous}→h{level}")
        previous = level
    return issues


def _requirement_terms(description: str) -> List[str]:
    """Requirement keywords pulled from the brief (deterministic, bounded)."""
    if not description:
        return []
    text = description.lower()
    terms: List[str] = []
    for match in re.finditer(r"must\s+([a-z0-9 \-_]{3,60})", text):
        terms.append(match.group(1).strip())
    for match in re.finditer(r"should\s+include\s+([a-z0-9 \-_]{3,60})", text):
        terms.append(match.group(1).strip())
    for match in re.finditer(r"\b(responsive|navbar|footer|form|validation|api|"
                             r"authentication|dark mode|animation|carousel|"
                             r"dropdown|modal|carousel|grid|accessibility)\b", text):
        terms.append(match.group(0))
    seen, unique = set(), []
    for t in terms:
        t = t.strip()
        if t and t not in seen:
            seen.add(t)
            unique.append(t)
    return unique[:12]


register_evaluator(FrontendEvaluator())
