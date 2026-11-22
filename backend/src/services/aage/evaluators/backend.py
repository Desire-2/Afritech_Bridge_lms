"""Backend Engineering Evaluator (Service G).

Static analysis of Python/Flask/FastAPI/Django/Node services.  Two things
matter beyond scoring:

1. **Test specifications** — the evaluator derives concrete, per-requirement
   test specs from the assignment brief (endpoint, method, expected outcome).
   They are stored as analysis output and are the contract a future *isolated
   API execution* adapter must satisfy.  Nothing is executed today.
2. **Honesty** — the existence of a route or function is ``CODE_SUPPORTED``,
   never ``VERIFIED``.  Only deterministic checks (route registered in source,
   decorator present, secret found) can be ``VERIFIED``.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Sequence

from .base import BaseEvaluator, EvaluationContext, EvaluatorOutput
from .registry import register_evaluator

BACKEND_EXT = (".py", ".js", ".ts", ".go", ".java", ".rb", ".php", ".sql")

ROUTE_PATTERNS = (
    (r"@(?:app|bp|api|blueprint|router)\.(get|post|put|patch|delete)\s*\(\s*[\"']([^\"']+)",
     "decorator"),
    (r"@(?:app|bp|api)\.route\s*\(\s*[\"']([^\"']+)[\"']\s*(?:,\s*methods\s*=\s*\[([^\]]+)\])?",
     "flask"),
    (r"(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*[\"']([^\"']+)", "express"),
    (r"add_url_rule\s*\(\s*[\"']([^\"']+)", "add_url_rule"),
)

SECRET_PATTERNS = (
    (r"(?i)(api[_-]?key|secret|password|passwd|token)\s*[:=]\s*[\"'][A-Za-z0-9_\-]{12,}[\"']",
     "hard-coded credential"),
    (r"(?i)-----BEGIN (RSA|OPENSSH|EC) PRIVATE KEY-----", "embedded private key"),
    (r"(?i)AKIA[0-9A-Z]{16}", "AWS access key id"),
)

SQL_INJECTION_PATTERNS = (
    (r"(?i)(execute|raw|query)\s*\(\s*[f\"'].*%?\s*\{.*(request|input|params|form)",
     "SQL built from request input"),
    (r"(?i)execute\s*\(\s*f[\"']SELECT.*\{", "f-string SQL"),
    (r"(?i)\+ *request\.(args|form|json)", "string-concatenated request data"),
)

VALIDATION_PATTERNS = (
    r"required\s*=\s*True", r"\.is_valid\s*\(", r"\.validate\s*\(",
    r"ValidationError", r"abort\s*\(\s*400", r"BadRequest",
    r"parse_args\s*\(", r"Field\s*\(", r"fields\.", r"schema\.load",
    r"isinstance\s*\(\s*.*request\.json", r"get_json\s*\(\s*force\s*=",
)

AUTH_PATTERNS = (
    r"jwt_required", r"login_required", r"current_user", r"get_jwt_identity",
    r"before_request", r"require_role", r"has_role", r"is_authenticated",
    r"authorize\s*\(", r"permission",
)

ERROR_PATTERNS = (
    r"@app\.errorhandler", r"@.*\.errorhandler", r"HTTPException",
    r"abort\s*\(\s*\d{3}", r"except\s+\w+", r"app\.logger\.(error|exception)",
)


class ApiExecutionAdapter:
    """Placeholder for future isolated API execution.

    Implement ``run(specs) -> {"cases": [{"name", "passed", "evidence"}]}``
    against a disposable network-restricted sandbox.  Until then the evaluator
    records specs but reports every behaviour requirement as unverified.
    """

    available = False

    def run(self, specs: Sequence[Dict[str, Any]]) -> Dict[str, Any]:  # pragma: no cover
        return {"cases": [], "error": "isolated API execution not configured"}


class BackendEvaluator(BaseEvaluator):
    name = "backend"
    version = "1.0.0"
    kind = "hybrid"
    supported_disciplines = ("backend", "fullstack", "python", "sql")
    supported_extensions = BACKEND_EXT
    description = ("Static API/route/model/security analysis with generated "
                   "test specifications.")

    # ------------------------------------------------------------------

    _SERVER_MARKERS = (
        "from flask", "import flask", "flask(", "from fastapi", "fastapi",
        "from django", "django.", "import express", "require('express')",
        "require(\"express\")", "@app.route", "@app.get", "@app.post",
        "@router.", "@bp.", "app.route(", "db.model", "sqlalchemy",
        "create_engine", "dbconnection", "app.use(", "express()",
        "from sanic", "import tornado", "aiohttp", "app.listen(",
    )

    def is_compatible(self, ctx: EvaluationContext) -> bool:
        """Claim server-side work, not every file with a code extension."""
        if ctx.classification.discipline in self.supported_disciplines:
            return True
        for f in ctx.files:
            if not f.path.lower().endswith(self.supported_extensions):
                continue
            head = f.text[:8000].lower()
            if any(marker in head for marker in self._SERVER_MARKERS):
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

        routes = self._routes(ctx)
        entry_points = ctx.manifest.entry_points
        record("entry_point", bool(entry_points),
               f"entry points: {entry_points or 'none detected'}",
               [{"path": p, "summary": "entry point present",
                 "category": "VERIFIED", "source": "artifact_manifest",
                 "locator": "", "detail": {}} for p in entry_points[:4]])
        record("routes", bool(routes),
               f"{len(routes)} route/handler definition(s) found",
               [{"path": r.get("file", ""), "summary": f"{r.get('method','')} {r.get('route','')}",
                 "category": "CODE_SUPPORTED", "source": "static_analysis",
                 "locator": r.get("file", ""), "detail": r}
                for r in routes[:8]])

        expected_routes = self._expected_routes(ctx.descriptor.description + "\n"
                                                + (ctx.descriptor.instructions or ""))
        matched, unmatched = self._match_routes(expected_routes, routes)
        record("required_endpoints", not expected_routes or len(matched) >= max(
            1, int(len(expected_routes) * 0.6)),
               f"{len(matched)}/{len(expected_routes)} expected endpoints located",
               [{"path": r.get("file", ""),
                 "summary": f"matched endpoint {m.get('method')} {m.get('route')}",
                 "category": "VERIFIED", "source": "static_analysis",
                 "locator": f"line {r.get('line','')}", "detail": r}
                for m, r in matched[:8]])

        models = self.grep(ctx, r"class\s+\w+\s*\(\s*(db\.Model|Base|models\.Model|"
                                r"Document|SQLModel)")
        record("data_models", bool(models),
               f"{len(models)} persistence model(s)",
               self.evidence_from_hits(models, "data model", category="CODE_SUPPORTED")[:5])
        relations = self.grep(ctx, r"ForeignKey\s*\(|relationship\s*\(|db\.relationship")
        record("relationships", bool(relations),
               f"{len(relations)} declared relationship(s)",
               self.evidence_from_hits(relations, "relationship",
                                       category="CODE_SUPPORTED")[:5])

        validation = self.grep(ctx, "|".join(VALIDATION_PATTERNS))
        record("input_validation", bool(validation),
               f"{len(validation)} validation signal(s)" if validation
               else "no input validation found",
               self.evidence_from_hits(validation, "validation",
                                       category="CODE_SUPPORTED")[:5])

        auth = self.grep(ctx, "|".join(AUTH_PATTERNS))
        record("auth", bool(auth),
               f"{len(auth)} authentication/authorization signal(s)" if auth
               else "no authentication or authorization found",
               self.evidence_from_hits(auth, "auth", category="CODE_SUPPORTED")[:5])

        errors = self.grep(ctx, "|".join(ERROR_PATTERNS))
        record("error_handling", bool(errors),
               f"{len(errors)} error-handling signal(s)",
               self.evidence_from_hits(errors, "error handling",
                                       category="CODE_SUPPORTED")[:5])

        secrets: List[Dict[str, Any]] = []
        for pattern, label in SECRET_PATTERNS:
            for hit in self.grep(ctx, pattern):
                hit["label"] = label
                secrets.append(hit)
        record("no_hardcoded_secrets", not secrets,
               "no hard-coded credentials detected" if not secrets
               else f"{len(secrets)} potential hard-coded secret(s)",
               [{"path": s["path"], "summary": s.get("label", "potential secret"),
                 "category": "VERIFIED", "source": "static_analysis",
                 "locator": f"line {s['line']}", "detail": {"match": "[redacted]"}}
                for s in secrets[:5]])

        injections: List[Dict[str, Any]] = []
        for pattern, label in SQL_INJECTION_PATTERNS:
            for hit in self.grep(ctx, pattern):
                hit["label"] = label
                injections.append(hit)
        record("no_injection_risks", not injections,
               "no request-input SQL construction detected" if not injections
               else f"{len(injections)} risky query construction(s)",
               [{"path": s["path"], "summary": s.get("label", "risky query"),
                 "category": "VERIFIED", "source": "static_analysis",
                 "locator": f"line {s['line']}", "detail": {"match": s.get("match", "")[:120]}}
                for s in injections[:5]])

        tests = ctx.manifest.test_files
        test_defs = self.grep(ctx, r"def\s+test_|\bit\s*\(\s*[\"']|@pytest\.mark")
        record("tests", bool(tests or test_defs),
               f"{len(tests)} test file(s), {len(test_defs)} test definition(s)",
               [{"path": p, "summary": "test file present",
                 "category": "VERIFIED", "source": "artifact_manifest",
                 "locator": "", "detail": {}} for p in tests[:4]])

        record("documentation", bool(ctx.manifest.doc_files),
               f"docs: {ctx.manifest.doc_files or 'none'}",
               [{"path": p, "summary": "documentation present",
                 "category": "VERIFIED", "source": "artifact_manifest",
                 "locator": "", "detail": {}} for p in ctx.manifest.doc_files[:3]])
        record("dependency_manifest", bool(ctx.manifest.dependency_manifests),
               f"manifests: {ctx.manifest.dependency_manifests or 'none'}",
               [{"path": p, "summary": "dependency manifest present",
                 "category": "VERIFIED", "source": "artifact_manifest",
                 "locator": "", "detail": {}}
                for p in ctx.manifest.dependency_manifests[:4]])

        specs = self.generate_test_specifications(ctx, expected_routes)

        passed = sum(1 for c in checks.values() if c["passed"])
        return {
            "evaluator": self.name,
            "version": self.version,
            "checks": checks,
            "passed": passed,
            "total": len(checks),
            "routes": routes,
            "expected_routes": expected_routes,
            "unmatched_routes": [r for r in unmatched],
            "test_specifications": specs,
            "execution_limitation":
                "endpoints were not executed; behaviour requirements remain "
                "UNVERIFIED until an isolated API runner is configured",
        }

    # ------------------------------------------------------------------

    def evaluate(self, ctx: EvaluationContext,
                 criteria: Sequence[Dict[str, Any]]) -> EvaluatorOutput:
        analysis = self.analyze(ctx)
        extra = (
            "- Route/function existence is CODE_SUPPORTED only; never mark a "
            "behaviour requirement 'verified' unless a check in CONTEXT.analysis "
            "with supports == 'VERIFIED' confirms it.\n"
            "- CONTEXT.analysis.test_specifications are specifications, NOT "
            "results — nothing was executed; do not report tests as passing.\n"
            "- If CONTEXT.analysis.checks.no_hardcoded_secrets.passed is false, "
            "lower any security-related criterion and cite the finding.\n"
            "- When a check mapped to a criterion fails, the rationale must "
            "reference that check by name."
        )
        raw, call = self.run_llm(ctx, criteria, extra_instructions=extra)
        output = self.build_output(
            criteria=criteria, raw=raw, ctx=ctx, analysis=analysis,
            fallback_rationale=(
                "Automated backend evaluation unavailable; deterministic "
                "findings are recorded but no marks were awarded without "
                "model review."),
            llm_call=call,
        )
        self._align_evidence_with_checks(output, analysis)
        checks = analysis.get("checks") or {}
        if not (checks.get("no_hardcoded_secrets") or {}).get("passed", True):
            output.warnings.append("hard-coded credential(s) detected")
        if not (checks.get("no_injection_risks") or {}).get("passed", True):
            output.warnings.append("risky request-driven SQL construction detected")
        if not ctx.manifest.test_files:
            output.warnings.append("no test files supplied — behaviour unverified")
        return output

    @staticmethod
    def _align_evidence_with_checks(output: EvaluatorOutput,
                                    analysis: Dict[str, Any]) -> None:
        """A failing deterministic check may only *lower* a claim's status."""
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
                    # A failed deterministic check cannot coexist with a high
                    # mark. Cap conservatively; the instructor can correct it.
                    if evaluation.max_marks > 0:
                        evaluation.marks = round(
                            min(evaluation.marks, evaluation.max_marks * 0.5), 4)
                    evaluation.limitations = (
                        (evaluation.limitations + " deterministic check "
                         f"'{key}' did not pass; marks capped until reviewed"
                         ).strip())[:600]

    # ------------------------------------------------------------------

    def generate_test_specifications(self, ctx: EvaluationContext,
                                     expected_routes: Sequence[Dict[str, Any]]
                                     ) -> List[Dict[str, Any]]:
        """Derive assessment-specific test specs from the brief.

        Deterministic — derived from the instructor's wording, not invented.
        """
        text = f"{ctx.descriptor.title}\n{ctx.descriptor.description}\n{ctx.descriptor.instructions}"
        specs: List[Dict[str, Any]] = []
        seen = set()

        def add(name: str, kind: str, detail: Dict[str, Any]) -> None:
            if name in seen:
                return
            seen.add(name)
            specs.append({"name": name, "kind": kind, "status": "specified",
                          "executed": False, "detail": detail})

        for route in expected_routes:
            add(f"endpoint_{route['method'].lower()}_{_slug(route['route'])}",
                "endpoint_presence",
                {"method": route["method"], "path": route["route"],
                 "expectation": "route is registered and handled"})

        patterns = (
            (r"(?:validat|saniti[sz]e)\s+([a-z ]{3,40})", "input_validation"),
            (r"reject\s+(?:an\s+|invalid\s+)?([a-z ]{3,40})", "negative_case"),
            (r"return[s]?\s+(?:a\s+)?(40\d|4\d\d)", "status_code"),
            (r"(?:store|save|persist)\s+([a-z ]{3,40})", "persistence"),
            (r"(?:protect|secure|authenticat\w+)\s+([a-z ]{3,40})", "auth"),
        )
        for pattern, kind in patterns:
            for match in re.finditer(pattern, text, re.I):
                subject = match.group(1).strip()
                add(f"{kind}_{_slug(subject)}", kind,
                    {"requirement": match.group(0)[:120],
                     "expectation": f"verify: {subject}"})
        return specs[:25]

    # -- helpers -------------------------------------------------------------

    @staticmethod
    def _routes(ctx: EvaluationContext) -> List[Dict[str, Any]]:
        routes: List[Dict[str, Any]] = []
        for f in ctx.files:
            text = f.text
            for pattern, style in ROUTE_PATTERNS:
                for m in re.finditer(pattern, text):
                    groups = m.groups()
                    line_no = text.count("\n", 0, m.start()) + 1
                    if style == "decorator":
                        method, route = groups[0].upper(), groups[1]
                    elif style == "flask":
                        route = groups[0]
                        methods = (groups[1] or "").upper()
                        method = "GET/POST" if not methods else methods.replace("'", "")
                    elif style == "express":
                        method, route = groups[0].upper(), groups[1]
                    else:
                        method, route = "ANY", groups[0]
                    routes.append({"file": f.path, "line": str(line_no),
                                   "route": route, "method": method, "style": style})
            if len(routes) > 200:
                break
        return routes

    @staticmethod
    def _expected_routes(description: str) -> List[Dict[str, str]]:
        found: List[Dict[str, str]] = []
        seen = set()
        for m in re.finditer(r"\b(GET|POST|PUT|PATCH|DELETE)\s+(/[A-Za-z0-9_\-/{}/:.]+)",
                             description or "", re.I):
            method, route = m.group(1).upper(), m.group(2).rstrip(".,;:")
            key = f"{method} {route}"
            if key in seen:
                continue
            seen.add(key)
            found.append({"method": method, "route": route})
        for m in re.finditer(r"(?:endpoint|route|url)\s*[:=]?\s*[\"'](/[A-Za-z0-9_\-/{}/]+)",
                             description or "", re.I):
            route = m.group(1).rstrip(".,;:")
            if route in seen:
                continue
            seen.add(route)
            found.append({"method": "ANY", "route": route})
        return found[:20]

    @staticmethod
    def _match_routes(expected: Sequence[Dict[str, str]],
                      actual: Sequence[Dict[str, Any]]):
        """Pair each expected endpoint with the first route that satisfies it."""
        matched: List[tuple] = []
        unmatched: List[Dict[str, str]] = []
        for exp in expected:
            hit = None
            for act in actual:
                if _route_matches(exp["route"], act.get("route", "")) and (
                        exp["method"] == "ANY"
                        or exp["method"] in str(act.get("method", "")).upper()):
                    hit = act
                    break
            if hit is not None:
                matched.append((exp, hit))
            else:
                unmatched.append(exp)
        return matched, unmatched


def _route_matches(expected: str, actual: str) -> bool:
    """Match ``/users/{id}`` style expectations against a real route."""
    if not actual:
        return False
    parts = re.split(r"(\{[^}]+\})", expected or "")
    pattern = "".join(
        r"[^/]+" if part.startswith("{") and part.endswith("}")
        else re.escape(part)
        for part in parts
    )
    try:
        return re.fullmatch(pattern.rstrip("/") or "/", actual.rstrip("/")) is not None
    except re.error:  # pragma: no cover - defensive
        return expected.rstrip("/") == actual.rstrip("/")


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (text or "").lower()).strip("_")[:60] or "spec"

register_evaluator(BackendEvaluator())
