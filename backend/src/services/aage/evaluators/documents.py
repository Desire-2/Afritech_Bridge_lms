"""Written-Document Evaluator (Service H).

Grades theory answers, reports, essays and other written deliverables, and
acts as the evaluator of last resort for disciplines no specialist claims
(``theory``, ``general``, ``devops``).

Design rules:

* **length is never quality** — word count is reported, never scored;
* **multiple valid answers** — a theory criterion is judged against the
  rubric and the brief, not against one canonical wording;
* **structure is provable, insight is not** — headings, sections, citations
  and file presence are deterministic (``VERIFIED``); argument quality is
  model judgement (``CONTENT_SUPPORTED``) and can never be upgraded above
  what ``CONTEXT.analysis`` supports;
* infrastructure submissions (Dockerfile, CI workflows, Terraform) get a small
  deterministic devops section so ``devops`` discipline work is not graded as
  an essay.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Sequence

from .base import BaseEvaluator, EvaluationContext, EvaluatorOutput

DOC_EXT = (".md", ".txt", ".rst", ".pdf", ".doc", ".docx", ".rtf", ".odt")

#: extensions that mean "this is a program, not an essay"
_CODE_EXTENSIONS = (
    ".py", ".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".html", ".htm",
    ".css", ".scss", ".sass", ".less", ".java", ".kt", ".swift", ".c", ".cc",
    ".cpp", ".cxx", ".h", ".cs", ".go", ".rs", ".php", ".rb", ".r", ".scala",
    ".sh", ".bash", ".ps1", ".dart", ".m", ".sql", ".ipynb", ".lua", ".pl",
)

#: prose deliverables that count as a written submission
_PROSE_EXTENSIONS = (
    ".md", ".txt", ".rst", ".pdf", ".doc", ".docx", ".rtf", ".odt",
)

DEVOPS_FILES = (
    "dockerfile", "docker-compose.yml", "docker-compose.yaml",
    ".gitlab-ci.yml", "jenkinsfile", "vagrantfile", "makefile",
)
DEVOPS_DIR_HINTS = ("/.github/workflows/", "/terraform/", "/k8s/", "/helm/",
                    "/ansible/", "/pulumi/")


class DocumentEvaluator(BaseEvaluator):
    name = "documents"
    version = "1.0.0"
    kind = "hybrid"
    supported_disciplines = ("theory", "general", "devops")
    supported_extensions = DOC_EXT
    description = ("Written reports, theory answers and infrastructure "
                   "write-ups; deterministic structure/citation checks plus "
                   "evidence-grounded model review.")

    # ------------------------------------------------------------------

    def is_compatible(self, ctx: EvaluationContext) -> bool:
        if ctx.classification.discipline in self.supported_disciplines:
            return True
        # Only claim a submission with no source code of its own — a
        # README.md must not pull a React/Flask app into the document
        # evaluator.  Decide by file extension, not by declared language,
        # so config files like requirements.txt never count as prose.
        if not ctx.files and not (ctx.manifest.text_content or "").strip():
            return False
        if any(f.path.lower().endswith(_CODE_EXTENSIONS) and not f.is_doc
               for f in ctx.files):
            return False
        prose = [f for f in ctx.files
                 if f.path.lower().endswith(_PROSE_EXTENSIONS)]
        return bool(prose) or bool((ctx.manifest.text_content or "").strip())

    # ------------------------------------------------------------------

    def analyze(self, ctx: EvaluationContext) -> Dict[str, Any]:
        checks: Dict[str, Dict[str, Any]] = {}

        def record(key: str, passed: bool, summary: str,
                   evidence: List[Dict[str, Any]]) -> None:
            checks[key] = {
                "passed": bool(passed),
                "summary": summary,
                "evidence": evidence,
                "supports": "VERIFIED" if passed else "CONTENT_SUPPORTED",
            }

        body = self._body(ctx)
        words = len(body.split())
        doc_files = list(ctx.manifest.doc_files)

        record("submission_present", bool(body),
               f"{words} word(s) across "
               f"{len(doc_files) or 1} written artefact(s)",
               [{"path": p, "summary": "written artefact submitted",
                 "category": "VERIFIED", "source": "artifact_manifest",
                 "locator": "", "detail": {}}
                for p in (doc_files or ["written response"])[:5]])

        headings = re.findall(r"(?m)^\s{0,3}(#{1,6})\s+\S|"
                              r"(?m)^\s*(?:\d+(?:\.\d+)*)[.)]\s+\S|"
                              r"(?m)^\s*(?:[A-Z][A-Za-z ]{2,40})\s*$", body)
        has_sections = len(headings) >= 2
        record("structure", has_sections,
               f"{len(headings)} section/heading marker(s) detected",
               [{"path": "written response", "summary": "section structure found",
                 "category": "VERIFIED", "source": "static_analysis",
                 "locator": "", "detail": {"count": len(headings)}}]
               if has_sections else [])

        title = bool(re.search(r"(?m)^\s*#\s+\S", body) or
                     (doc_files and doc_files[0].lower().endswith(
                         (".pdf", ".docx", ".doc"))))
        record("title", title,
               "document title present" if title else "no document title detected",
               [{"path": "written response", "summary": "title present",
                 "category": "VERIFIED", "source": "static_analysis",
                 "locator": "", "detail": {}}] if title else [])

        citations = self._citation_signals(body)
        record("citations", bool(citations["signals"]),
               (f"{len(citations['signals'])} citation/reference signal(s)"
                if citations["signals"] else "no citations/references detected"),
               [{"path": "written response", "summary": s,
                 "category": "CODE_SUPPORTED", "source": "static_analysis",
                 "locator": "", "detail": {}} for s in citations["signals"][:6]])

        figures = re.findall(r"(?i)\b(?:figure|fig\.|table|chart|diagram|image)\s*"
                             r"(\d+|[ivx]+)", body)
        record("figures", bool(figures) or not self._brief_expects_figures(ctx),
               (f"{len(figures)} figure/table reference(s)" if figures else
                "no figures referenced (not expected by the brief)"),
               [{"path": "written response", "summary": f"figure/table {n} referenced",
                 "category": "CONTENT_SUPPORTED", "source": "static_analysis",
                 "locator": "", "detail": {}}
                for n in list(dict.fromkeys(figures))[:6]])

        required = self._requirement_terms(ctx.descriptor.description)
        haystack = body.lower()
        found = [t for t in required if t.lower() in haystack]
        missing = [t for t in required if t.lower() not in haystack]
        record("requirements", not required or len(found) >= max(
            1, int(len(required) * 0.5)),
               f"{len(found)}/{len(required)} brief keywords covered",
               [{"path": "written response",
                 "summary": f"brief keyword '{t}' covered",
                 "category": "CONTENT_SUPPORTED", "source": "static_analysis",
                 "locator": "", "detail": {}}
                for t in found[:8]])

        echo = self._prompt_echo(body, ctx.descriptor.description or "")
        record("not_prompt_echo", not echo,
               "answer does not restate the brief" if not echo
               else f"{echo} characters of the brief copied verbatim",
               [{"path": "written response", "summary": "verbatim brief overlap",
                 "category": "CONTENT_SUPPORTED", "source": "static_analysis",
                 "locator": "", "detail": {"chars": echo}}] if echo else [])

        devops = self._devops_signals(ctx)
        if devops["applicable"]:
            record("infrastructure", bool(devops["files"]),
                   (f"infra artefacts: {devops['files']}" if devops["files"]
                    else "no Dockerfile/CI/IaC artefacts found"),
                   [{"path": p, "summary": "infrastructure artefact present",
                     "category": "VERIFIED", "source": "artifact_manifest",
                     "locator": "", "detail": {}}
                    for p in devops["files"][:6]])

        passed = sum(1 for c in checks.values() if c["passed"])
        return {
            "evaluator": self.name,
            "version": self.version,
            "checks": checks,
            "passed": passed,
            "total": len(checks),
            "word_count": words,
            "doc_files": doc_files,
            "requirement_terms_found": found,
            "requirement_terms_missing": missing,
            "citation_signals": citations["signals"][:8],
            "prompt_echo_chars": echo,
            "devops": devops,
            "multiple_valid_answers": True,
            "limitation": "argument quality is model judgement; structure and "
                          "file facts are deterministic",
        }

    def evaluate(self, ctx: EvaluationContext,
                 criteria: Sequence[Dict[str, Any]]) -> EvaluatorOutput:
        analysis = self.analyze(ctx)
        extra = (
            "- Multiple answers can be correct; judge the response against the "
            "rubric and the brief, not against one preferred wording.\n"
            "- Word count and length are NOT evidence of quality; never reward "
            "an answer for being long.\n"
            "- Only mark a criterion 'verified' when a check in CONTEXT."
            "analysis with supports == 'VERIFIED' confirms it.\n"
            "- If CONTEXT.analysis.prompt_echo_chars > 0, cap any criterion "
            "that rewards original explanation at partial marks and say so.\n"
            "- Cite the written response or a real file from the manifest as "
            "evidence; never invent page or section numbers."
        )
        raw, call = self.run_llm(ctx, criteria, extra_instructions=extra)
        output = self.build_output(
            criteria=criteria, raw=raw, ctx=ctx, analysis=analysis,
            fallback_rationale=(
                "Automated written-document evaluation unavailable; structural "
                "findings are recorded but no marks were awarded without "
                "model review."),
            llm_call=call,
        )
        if analysis.get("prompt_echo_chars", 0) > 40:
            output.warnings.append(
                f"answer copies {analysis['prompt_echo_chars']} characters of "
                "the brief verbatim")
            # Deterministic cap for criteria that reward original reasoning.
            # A model instruction alone is not enforcement.
            for ev in output.criteria:
                text = f"{ev.criterion_key} {ev.rationale}".lower()
                if any(token in text for token in (
                        "explain", "analysis", "original", "discussion",
                        "critical", "argument", "reason")):
                    cap = ev.max_marks * 0.6
                    if ev.marks > cap:
                        ev.marks = round(cap, 4)
                        ev.verification_status = "partial"
                        ev.evidence_category = "UNVERIFIED"
                        ev.limitations = (
                            (ev.limitations + " capped: answer echoes the brief "
                             "verbatim").strip())[:600]
        if analysis.get("word_count", 0) < 50 and ctx.manifest.text_content:
            output.warnings.append(
                f"very short answer ({analysis['word_count']} words)")
        if analysis.get("devops", {}).get("applicable") and not \
                analysis["devops"].get("files"):
            output.warnings.append(
                "infrastructure assessment with no Dockerfile/CI artefacts")
        return output

    # -- helpers --------------------------------------------------------------

    @staticmethod
    def _body(ctx: EvaluationContext) -> str:
        parts: List[str] = []
        if (ctx.manifest.text_content or "").strip():
            parts.append(ctx.manifest.text_content)
        for f in ctx.files:
            if f.is_doc or f.path.lower().endswith(DOC_EXT):
                parts.append(f.text)
        return "\n\n".join(parts)

    @staticmethod
    def _citation_signals(body: str) -> Dict[str, List[str]]:
        signals: List[str] = []
        if re.search(r"(?i)\b(?:references|bibliography|works cited|sources)\b",
                     body):
            signals.append("references section")
        if re.search(r"https?://\S+", body):
            signals.append("hyperlink")
        if re.search(r"\[\d{1,3}\]", body) or re.search(r"\(\w+(?: et al\.?)?,? "
                                                        r"\d{4}\)", body):
            signals.append("in-text citation")
        if re.search(r"(?i)\baccording to\b|\bcites?\b|\bquotes?\b", body):
            signals.append("attribution phrase")
        return {"signals": signals}

    @staticmethod
    def _brief_expects_figures(ctx: EvaluationContext) -> bool:
        text = (ctx.descriptor.description or "").lower()
        return bool(re.search(r"\b(figure|chart|diagram|graph|table|screenshot)\b",
                              text))

    @staticmethod
    def _requirement_terms(description: str) -> List[str]:
        if not description:
            return []
        text = description.lower()
        terms: List[str] = []
        for match in re.finditer(r"must\s+([a-z0-9 \-_]{3,60})", text):
            terms.append(match.group(1).strip())
        for match in re.finditer(r"(?i)\b(compare and contrast|discuss|explain|"
                                 r"evaluate|analyse|analyze|propose|recommend)\b",
                                 text):
            terms.append(match.group(0).lower())
        for match in re.finditer(r"\b(ethics|security|privacy|performance|"
                                 r"scalability|accessibility|cost|deployment|"
                                 r"maintenance|testing)\b", text):
            terms.append(match.group(0))
        seen, unique = set(), []
        for t in terms:
            t = t.strip()
            if t and t not in seen:
                seen.add(t)
                unique.append(t)
        return unique[:12]

    @staticmethod
    def _prompt_echo(body: str, description: str) -> int:
        """Longest verbatim run shared with the brief (bounded, cheap)."""
        if not body or not description:
            return 0
        desc = re.sub(r"\s+", " ", description.lower()).strip()
        ans = re.sub(r"\s+", " ", body.lower()).strip()
        if not desc or not ans:
            return 0
        best = 0
        # Sliding windows of the answer, longest first (bounded).
        for size in (200, 120, 80, 50):
            if size > len(ans) or size > len(desc):
                continue
            for start in range(0, min(len(ans) - size + 1, 40), size // 2):
                chunk = ans[start:start + size]
                if chunk in desc:
                    best = max(best, size)
                    break
            if best:
                break
        return best

    @staticmethod
    def _devops_signals(ctx: EvaluationContext) -> Dict[str, Any]:
        names = [f.path.lower().replace("\\", "/") for f in ctx.files]
        applicable = ctx.classification.discipline == "devops"
        if not applicable:
            applicable = any(
                any(n.endswith(d) for d in DEVOPS_FILES) or
                any(h in n for h in DEVOPS_DIR_HINTS) for n in names)
        files = sorted({
            f.path for f in ctx.files
            if any(f.path.lower().replace("\\", "/").endswith(d)
                   for d in DEVOPS_FILES)
            or any(h in f.path.lower().replace("\\", "/")
                   for h in DEVOPS_DIR_HINTS)
            or f.path.lower().endswith((".tf", ".tfvars", ".hcl", ".sh",
                                        ".yaml", ".yml"))
        })
        return {"applicable": applicable, "files": files[:12]}


from .registry import register_evaluator

register_evaluator(DocumentEvaluator())
