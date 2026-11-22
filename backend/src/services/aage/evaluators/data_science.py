"""Data Science Evaluator (Service H).

Covers Python / pandas / NumPy / SQL / Jupyter work: data understanding,
cleaning, EDA, visualisation, statistics, modelling and reproducibility.

Two domain rules are enforced structurally rather than by prompt hope:

* **multiple valid approaches** — criteria are scored against the *rubric*, not
  against one golden solution; analysis reports what was found, not what "the
  right answer" is;
* **accuracy ≠ mastery** — when a performance metric appears but no evaluation
  methodology (held-out split / cross-validation / leakage control) is present,
  the modelling criterion is flagged ``metric_without_methodology`` and the
  evaluator is instructed to cap it below full marks.

A :class:`NotebookExecutionAdapter` hook is reserved for future isolated
Jupyter execution.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Sequence

from .base import BaseEvaluator, EvaluationContext, EvaluatorOutput

DS_EXT = (".ipynb", ".py", ".sql", ".r")


class NotebookExecutionAdapter:
    """Future isolated notebook execution (never runs inside Flask)."""

    available = False

    def run(self, ctx: EvaluationContext) -> Dict[str, Any]:  # pragma: no cover
        return {"cells": [], "error": "notebook execution not configured"}


LOADERS = r"read_csv|read_excel|read_parquet|read_json|read_sql|read_table|load_iris|load_dataset|fetch_"
MISSING = r"\.isna\s*\(|\.isnull\s*\(|\.fillna\s*\(|\.dropna\s*\(|interpolate\s*\(|Notna"
DUPES = r"\.duplicated\s*\(|\.drop_duplicates\s*\("
TRANSFORM = (r"\.astype\s*\(|\.merge\s*\(|\.groupby\s*\(|\.pivot\b|\.melt\s*\(|"
             r"\.apply\s*\(|pd\.to_datetime|str\.(lower|strip|replace)|cut\s*\(|qcut\s*\(")
VISUAL = r"\b(plt\.|sns\.|plotly|px\.|\.plot\s*\(|\.hist\s*\(|\.boxplot\s*\(|seaborn)"
STATS = r"\.describe\s*\(|\.corr\s*\(|\.mean\s*\(|\.median\s*\(|\.std\s*\(|scipy|ttest|anova|corrcoef"
SPLIT = r"train_test_split|cross_val_score|KFold|StratifiedKFold|\.sample\s*\(|holdout"
METRICS = (r"accuracy_score|f1_score|precision_score|recall_score|r2_score|mean_squared_error|"
           r"rmse|classification_report|confusion_matrix|roc_auc|mean_absolute_error|score\s*\(")
LEAK_PATTERNS = (
    (r"\.fit_transform\s*\([^)]*\)[\s\S]{0,400}?train_test_split", "preprocessing before split"),
    (r"train_test_split[\s\S]{0,400}?\.fit\s*\(", "possible target-informed fitting"),
    (r"(?i)target|y_test[\s\S]{0,200}?\.fit\s*\(\s*x\b", "fitting on full feature set"),
)
REPRO = r"random_state\s*=|np\.random\.seed|random\.seed|set_seed|manual_seed"


class DataScienceEvaluator(BaseEvaluator):
    name = "data_science"
    version = "1.0.0"
    kind = "hybrid"
    supported_disciplines = ("data_science",)
    supported_extensions = DS_EXT
    description = ("pandas/notebook analysis: cleaning, EDA, statistics, "
                   "visualisation, modelling and reproducibility.")

    # ------------------------------------------------------------------

    _DS_MARKERS = (
        "import pandas", "import numpy", "from sklearn", "import sklearn",
        "import matplotlib", "import seaborn", "import plotly",
        "pd.read_", "sns.", "plt.", "train_test_split",
    )

    def is_compatible(self, ctx: EvaluationContext) -> bool:
        """Claim notebooks and data-analysis code, not every Python file."""
        if ctx.classification.discipline in self.supported_disciplines:
            return True
        if any(f.path.lower().endswith(".ipynb") for f in ctx.files):
            return True
        for f in ctx.files:
            if not f.path.lower().endswith((".py", ".r", ".sql")):
                continue
            head = f.text[:8000].lower()
            if any(marker in head for marker in self._DS_MARKERS):
                return True
        return False

    # ------------------------------------------------------------------

    def analyze(self, ctx: EvaluationContext) -> Dict[str, Any]:
        checks: Dict[str, Dict[str, Any]] = {}

        def record(key: str, passed: bool, summary: str,
                   evidence: List[Dict[str, Any]]) -> None:
            checks[key] = {
                "passed": bool(passed),
                "summary": summary,
                "evidence": evidence,
                "supports": "VERIFIED" if passed else "CODE_SUPPORTED",
            }

        notebooks = [f.path for f in ctx.files if f.path.endswith(".ipynb")]
        record("notebook", bool(notebooks) or bool(ctx.files),
               f"notebooks: {notebooks or 'none (script submission)'}",
               [{"path": p, "summary": "notebook submitted",
                 "category": "VERIFIED", "source": "artifact_manifest",
                 "locator": "", "detail": {}} for p in notebooks[:3]])

        loaders = self.grep(ctx, LOADERS)
        record("data_loading", bool(loaders),
               f"{len(loaders)} data-loading call(s)" if loaders
               else "no data loading detected",
               self.evidence_from_hits(loaders, "data load", category="CODE_SUPPORTED")[:5])

        missing = self.grep(ctx, MISSING)
        record("missing_values", bool(missing),
               f"{len(missing)} missing-value handling call(s)" if missing
               else "no missing-value handling detected",
               self.evidence_from_hits(missing, "missing-value handling",
                                       category="CODE_SUPPORTED")[:5])

        dupes = self.grep(ctx, DUPES)
        record("duplicates", bool(dupes),
               f"{len(dupes)} duplicate-handling call(s)" if dupes
               else "no duplicate handling detected",
               self.evidence_from_hits(dupes, "duplicate handling",
                                       category="CODE_SUPPORTED")[:5])

        transforms = self.grep(ctx, TRANSFORM)
        record("transformations", bool(transforms),
               f"{len(transforms)} transformation call(s)",
               self.evidence_from_hits(transforms, "transformation",
                                       category="CODE_SUPPORTED")[:5])

        visuals = self.grep(ctx, VISUAL)
        labelled = self.grep(ctx, r"\.(xlabel|ylabel|title|legend|suptitle)\s*\(")
        record("visualisation", bool(visuals),
               f"{len(visuals)} plot call(s), {len(labelled)} label(s)",
               self.evidence_from_hits(visuals + labelled, "plot usage",
                                       category="CODE_SUPPORTED")[:5])

        stats = self.grep(ctx, STATS)
        record("statistics", bool(stats),
               f"{len(stats)} statistical call(s)",
               self.evidence_from_hits(stats, "statistical analysis",
                                       category="CODE_SUPPORTED")[:5])

        splits = self.grep(ctx, SPLIT)
        metrics = self.grep(ctx, METRICS)
        record("evaluation_methodology", bool(splits) or not metrics,
               (f"{len(splits)} split/cross-validation signal(s), "
                f"{len(metrics)} metric call(s)") if metrics
               else "no performance metrics claimed",
               self.evidence_from_hits(splits + metrics, "evaluation",
                                       category="CODE_SUPPORTED")[:6])

        leakage: List[Dict[str, Any]] = []
        for pattern, label in LEAK_PATTERNS:
            for hit in self.grep(ctx, pattern, re.S):
                hit["label"] = label
                leakage.append(hit)
        record("no_data_leakage", not leakage,
               "no leakage pattern detected" if not leakage
               else f"{len(leakage)} potential leakage pattern(s)",
               [{"path": s["path"], "summary": s.get("label", "leakage risk"),
                 "category": "VERIFIED", "source": "static_analysis",
                 "locator": f"line {s['line']}", "detail": {"match": s.get("match", "")[:120]}}
                for s in leakage[:5]])

        repro = self.grep(ctx, REPRO)
        record("reproducibility", bool(repro) or not splits,
               f"{len(repro)} reproducibility signal(s)",
               self.evidence_from_hits(repro, "seed / reproducibility",
                                       category="CODE_SUPPORTED")[:4])

        record("documentation", bool(ctx.manifest.doc_files),
               f"docs: {ctx.manifest.doc_files or 'none'}",
               [{"path": p, "summary": "documentation present",
                 "category": "VERIFIED", "source": "artifact_manifest",
                 "locator": "", "detail": {}} for p in ctx.manifest.doc_files[:3]])

        metric_without_methodology = bool(metrics) and not bool(splits)
        if metric_without_methodology:
            checks["evaluation_methodology"]["summary"] = (
                "performance metric(s) present without a train/test split or "
                "cross-validation signal — the number cannot be trusted")
            checks["evaluation_methodology"]["passed"] = False
            checks["evaluation_methodology"]["supports"] = "CODE_SUPPORTED"

        interpretations = self.grep(
            ctx, r"(?i)(we conclude|the model (performs|achieves)|results? show|"
                 r"compared to|outperforms|best model|feature importance)")
        record("interpretation", bool(interpretations),
               f"{len(interpretations)} interpretive statement(s)",
               self.evidence_from_hits(interpretations, "interpretation",
                                       category="CONTENT_SUPPORTED")[:5])

        passed = sum(1 for c in checks.values() if c["passed"])
        return {
            "evaluator": self.name,
            "version": self.version,
            "checks": checks,
            "passed": passed,
            "total": len(checks),
            "metric_without_methodology": metric_without_methodology,
            "leakage_flags": [s.get("label") for s in leakage],
            "multiple_valid_approaches": True,
            "execution_limitation":
                "notebook was not executed; computed values were not reproduced",
        }

    # ------------------------------------------------------------------

    def evaluate(self, ctx: EvaluationContext,
                 criteria: Sequence[Dict[str, Any]]) -> EvaluatorOutput:
        analysis = self.analyze(ctx)
        extra = (
            "- Several analytical approaches can be correct; judge whether the "
            "approach suits the question, not whether it matches a single answer.\n"
            "- If CONTEXT.analysis.metric_without_methodology is true, do NOT award "
            "full marks on any modelling/evaluation criterion: the reported metric "
            "has no held-out validation behind it.\n"
            "- Never treat a high accuracy value alone as evidence of quality.\n"
            "- 'verified' is only allowed for checks whose supports == 'VERIFIED'.\n"
            "- Notebook outputs were not re-executed; treat printed results as "
            "student claims (CONTENT_SUPPORTED) unless a deterministic check confirms them."
        )
        raw, call = self.run_llm(ctx, criteria, extra_instructions=extra)
        output = self.build_output(
            criteria=criteria, raw=raw, ctx=ctx, analysis=analysis,
            fallback_rationale=(
                "Automated data-science evaluation unavailable; deterministic "
                "signals recorded but no marks awarded without review."),
            llm_call=call,
        )
        if analysis.get("metric_without_methodology"):
            for ev in output.criteria:
                key = ev.criterion_key.lower()
                if any(word in key for word in ("model", "evaluat", "metric", "results")):
                    cap = ev.max_marks * 0.75
                    if ev.marks > cap:
                        ev.marks = round(cap, 4)
                        ev.limitations = (
                            (ev.limitations + " capped: performance metric reported "
                             "without train/test or cross-validation evidence").strip())[:600]
                        ev.verification_status = "partial"
            output.warnings.append(
                "metric reported without evaluation methodology — modelling "
                "criteria capped at 75%")
        if analysis.get("leakage_flags"):
            output.warnings.append("possible data leakage: "
                                   + ", ".join(analysis["leakage_flags"][:3]))
        return output


from .registry import register_evaluator

register_evaluator(DataScienceEvaluator())
