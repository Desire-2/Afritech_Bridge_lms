"""Discipline / technology classification for assessments (Service B).

Purely deterministic: keyword + extension lexicons.  Classification is used to

* pick a rubric template when generating a rubric,
* select specialist evaluators,
* group analytics.

Adding a technology means adding an entry here — no orchestrator change.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence

# ---------------------------------------------------------------------------
# Lexicons
# ---------------------------------------------------------------------------

#: ordered: earlier entries win when several match
DISCIPLINE_KEYWORDS: Dict[str, Sequence[str]] = {
    "frontend": (
        "frontend", "front-end", "front end", "html", "css", "scss", "sass",
        "responsive", "ui design", "user interface", "tailwind", "bootstrap",
        "landing page", "web page", "webpage", "DOM", "javascript", "typescript",
    ),
    "backend": (
        "backend", "back-end", "back end", "rest api", "restful", "api design",
        "server", "endpoint", "authentication", "authorization", "flask", "fastapi",
        "django", "express", "node.js", "nodejs", "microservice", "middleware",
        "jwt", "oauth", "crud", "routes", "controllers",
    ),
    "fullstack": (
        "full-stack", "fullstack", "full stack", "end-to-end", "end to end",
        "mern", "mean", "django + react", "react + flask",
    ),
    "data_science": (
        "data science", "data analysis", "dataanalysis", "exploratory", "eda",
        "pandas", "numpy", "jupyter", "notebook", "dataset", "visualization",
        "visualisation", "matplotlib", "seaborn", "plotly", "statistics",
        "regression", "classification model", "machine learning", "machinelearning",
        "train test split", "feature engineering", "model evaluation", "scikit",
        "sklearn", "cleaning data", "data cleaning", "outliers", "correlation",
    ),
    "python": (
        "python", "python programming", "object-oriented", "oop", "functions",
        "loops", "recursion", "algorithms", "classes", "decorators", "generators",
    ),
    "sql": (
        "sql", "postgresql", "mysql", "sqlite", "database design", "normalization",
        "normalisation", "joins", "indexes", "query optimization", "schema design",
        "foreign key", "relational database", "stored procedure", "cte",
    ),
    "spreadsheet": (
        "excel", "ms excel", "microsoft excel", "spreadsheet", "workbook",
        "pivot table", "pivot tables", "vba", "macro", "power query", "m language",
        "xlookup", "vlookup", "index match", "conditional formatting",
        "data validation", "dashboard", "google sheets",
    ),
    "mobile": (
        "android", "ios", "react native", "flutter", "swift", "kotlin", "mobile app",
    ),
    "devops": (
        "docker", "kubernetes", "ci/cd", "github actions", "deployment",
        "infrastructure", "terraform", "cloud", "aws", "azure", "gcp",
    ),
    "theory": (
        "explain", "essay", "report", "write about", "compare and contrast",
        "discuss", "reflection", "presentation", "documentation", "concept",
        "principles", "ethics", "project proposal", "research",
    ),
}

DISCIPLINE_FALLBACK = "general"

#: file extension → technology hint
EXTENSION_TECH: Dict[str, str] = {
    ".html": "HTML", ".htm": "HTML",
    ".css": "CSS", ".scss": "SCSS", ".sass": "Sass", ".less": "Less",
    ".js": "JavaScript", ".jsx": "React", ".ts": "TypeScript", ".tsx": "React",
    ".vue": "Vue", ".svelte": "Svelte", ".astro": "Astro",
    ".py": "Python", ".ipynb": "Jupyter", ".pyx": "Cython",
    ".sql": "SQL", ".psql": "SQL",
    ".java": "Java", ".kt": "Kotlin", ".swift": "Swift",
    ".cs": "C#", ".cpp": "C++", ".c": "C", ".go": "Go", ".rs": "Rust",
    ".php": "PHP", ".rb": "Ruby",
    ".js.map": "JavaScript", ".json": "JSON", ".yaml": "YAML", ".yml": "YAML",
    ".toml": "TOML", ".ini": "INI", ".env": "Environment config",
    ".md": "Markdown", ".txt": "Text", ".csv": "CSV",
    ".xlsx": "Excel", ".xlsm": "Excel", ".xls": "Excel",
    ".db": "SQLite", ".sqlite": "SQLite",
    ".sh": "Shell", ".bash": "Shell",
    ".r": "R", ".m": "MATLAB",
}

#: marker → framework (checked against file names & content)
FRAMEWORK_MARKERS: Dict[str, Sequence[str]] = {
    "React": ("from 'react'", 'from "react"', "react-dom", "createRoot"),
    "Next.js": ("next/link", "next/router", "next/image", "app/router", "pages/_app"),
    "Vue": ("createApp(", "vue-router"),
    "Flask": ("from flask import", "Flask(__name__)", "app.route("),
    "FastAPI": ("from fastapi import", "FastAPI("),
    "Django": ("from django import", "django.db", "urls.py"),
    "Express": ("require('express')", 'require("express")', "from 'express'"),
    "Node.js": ("require('http')", "package.json", "process.env"),
    "Pandas": ("import pandas", "pd.read_", "DataFrame("),
    "NumPy": ("import numpy", "np.array"),
    "Scikit-learn": ("sklearn", "train_test_split"),
    "Matplotlib": ("import matplotlib", "plt."),
    "Seaborn": ("import seaborn", "sns."),
    "SQLAlchemy": ("sqlalchemy", "db.Model"),
    "Tailwind": ("tailwind.config", "@tailwindcss"),
}

ENTRY_POINT_FILES = (
    "index.html", "app.py", "main.py", "manage.py", "server.py", "wsgi.py",
    "asgi.py", "package.json", "next.config.js", "next.config.mjs",
    "vite.config.js", "vite.config.ts", "webpack.config.js", "requirements.txt",
    "dockerfile", "docker-compose.yml", "readme.md", "readme.txt",
)

DOC_FILES = ("readme.md", "readme.txt", "readme", "docs", "documentation.md")
TEST_FILE_HINTS = ("test", "spec", "tests", "pytest", "unittest", "cypress", "playwright")

DELIVERABLE_PATTERNS: Dict[str, Sequence[str]] = {
    "source_files": ("source code", "code files", "submit your code", ".py", ".js",
                     ".html", ".css", ".java"),
    "zip_archive": ("zip", "archive", "compressed", "single file submission"),
    "written_report": ("report", "document", "write-up", "write up", "pdf",
                       "word document", "documentation"),
    "spreadsheet": ("workbook", "spreadsheet", "excel file", ".xlsx", ".csv"),
    "notebook": ("jupyter", "notebook", ".ipynb"),
    "url": ("deploy", "hosted", "live url", "netlify", "vercel", "github pages",
            "link to", "url"),
    "screenshot": ("screenshot", "screen shot", "capture", "image of"),
    "database_dump": (".sql", "dump", "seed data"),
}

EVALUATION_METHOD_HINTS: Dict[str, Sequence[str]] = {
    "static_source_analysis": ("code", "source", "implementation", "function"),
    "requirement_checklist": ("must include", "should include", "requirement",
                              "deliverable", "checklist"),
    "structural_analysis": ("structure", "organization", "layout", "semantics"),
    "rubric_criteria": ("rubric", "criteria", "criterion", "marks", "points"),
    "test_evidence": ("test", "tests", "unit test", "screenshot of tests"),
    "document_review": ("report", "explain", "justification", "documentation"),
    "spreadsheet_analysis": ("formula", "pivot", "macro", "vba", "workbook"),
}


@dataclass
class Classification:
    discipline: str
    discipline_scores: Dict[str, float] = field(default_factory=dict)
    technologies: List[str] = field(default_factory=list)
    frameworks: List[str] = field(default_factory=list)
    deliverables: List[str] = field(default_factory=list)
    evaluation_methods: List[str] = field(default_factory=list)
    learning_objectives: List[str] = field(default_factory=list)
    confidence: float = 0.0
    signals: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "discipline": self.discipline,
            "discipline_scores": self.discipline_scores,
            "technologies": self.technologies,
            "frameworks": self.frameworks,
            "deliverables": self.deliverables,
            "evaluation_methods": self.evaluation_methods,
            "learning_objectives": self.learning_objectives,
            "confidence": round(self.confidence, 3),
            "signals": self.signals,
        }


def _normalise(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def classify_text(*parts: Optional[str]) -> Classification:
    """Classify from free text (title, description, instructions, course)."""
    blob = _normalise(" \n ".join(p for p in parts if p))
    scores: Dict[str, float] = {d: 0.0 for d in DISCIPLINE_KEYWORDS}
    signals: List[str] = []

    for discipline, keywords in DISCIPLINE_KEYWORDS.items():
        for kw in keywords:
            k = kw.lower()
            if k in blob:
                # whole-word-ish match weight; longer keywords are stronger signals
                weight = 1.0 + min(len(k), 30) / 30.0
                # exact token hits for short keywords need word boundaries
                if len(k) <= 6:
                    if re.search(rf"(?<![a-z0-9]){re.escape(k)}(?![a-z0-9])", blob):
                        scores[discipline] += weight
                        signals.append(f"{discipline}:{k}")
                else:
                    scores[discipline] += weight
                    signals.append(f"{discipline}:{k}")

    if not any(scores.values()):
        return Classification(discipline=DISCIPLINE_FALLBACK, confidence=0.0, signals=signals)

    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    top_discipline, top_score = ranked[0]
    second = ranked[1][1] if len(ranked) > 1 else 0.0

    # fullstack wins when both frontend and backend clearly match
    if {top_discipline, ranked[0][0]} and "fullstack" in scores and scores.get("fullstack", 0) == 0:
        if scores.get("frontend", 0) > 0 and scores.get("backend", 0) > 0:
            scores["fullstack"] = min(scores.get("frontend", 0), scores.get("backend", 0)) * 0.9
            ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
            top_discipline, top_score = ranked[0]

    total = sum(scores.values()) or 1.0
    dominance = (top_score - second) / total
    confidence = min(1.0, 0.35 + dominance * 2.0 + min(top_score, 8) / 16.0)

    return Classification(
        discipline=top_discipline,
        discipline_scores={k: round(v, 3) for k, v in scores.items() if v > 0},
        confidence=round(confidence, 3),
        signals=signals[:40],
    )


def detect_technologies(text: str, file_names: Sequence[str] = ()) -> List[str]:
    """Technology names mentioned in text or implied by submitted file names."""
    blob = _normalise(text)
    found: List[str] = []
    for name in list(EXTENSION_TECH.values()) + list(FRAMEWORK_MARKERS.keys()):
        if name.lower() in blob and name not in found:
            found.append(name)
    for fn in file_names:
        dot = fn.lower().rsplit(".", 1)
        if len(dot) == 2:
            tech = EXTENSION_TECH.get("." + dot[1])
            if tech and tech not in found:
                found.append(tech)
    return found


def detect_frameworks(text: str, file_contents: Sequence[str] = ()) -> List[str]:
    """Frameworks detected from markers in the description or in file content."""
    blob = _normalise(text)
    joined = _normalise(" \n ".join(file_contents))
    found: List[str] = []
    for framework, markers in FRAMEWORK_MARKERS.items():
        for marker in markers:
            m = marker.lower()
            if (m in blob or m in joined) and framework not in found:
                found.append(framework)
                break
    return found


def detect_deliverables(text: str) -> List[str]:
    blob = _normalise(text)
    return [name for name, pats in DELIVERABLE_PATTERNS.items()
            if any(p in blob for p in pats)]


def detect_evaluation_methods(text: str) -> List[str]:
    blob = _normalise(text)
    return [name for name, pats in EVALUATION_METHOD_HINTS.items()
            if any(p in blob for p in pats)]


def extract_learning_objectives(text: str, limit: int = 10) -> List[str]:
    """Best-effort extraction of objectives from sentences.

    Uses bullet/numbered lines first (how instructors usually write
    objectives), then falls back to sentences containing modal verbs.
    """
    if not text:
        return []
    objectives: List[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if re.match(r"^(?:[-*•]|\d+[.)])\s+", line):
            item = re.sub(r"^(?:[-*•]|\d+[.)])\s+", "", line).strip()
            if 15 <= len(item) <= 300:
                objectives.append(item)
        if len(objectives) >= limit:
            return objectives[:limit]

    if not objectives:
        for sentence in re.split(r"(?<=[.!?])\s+", text):
            s = sentence.strip()
            if not (15 <= len(s) <= 300):
                continue
            if re.search(r"\b(you will|should be able to|must be able to|by the end|"
                         r"objective|learn to|demonstrate|build|create|implement|"
                         r"design|analyze|analyse)\b", s, re.I):
                objectives.append(s)
            if len(objectives) >= limit:
                break
    return objectives[:limit]


def classify_assessment(
    title: str,
    description: str = "",
    instructions: str = "",
    course_title: str = "",
    course_description: str = "",
    file_names: Sequence[str] = (),
    file_contents: Sequence[str] = (),
) -> Classification:
    """Full Service-B classification for one assessment."""
    text = " \n ".join(x for x in (title, description, instructions,
                                   course_title, course_description) if x)
    result = classify_text(title, description, instructions,
                           course_title, course_description)
    result.technologies = detect_technologies(text, file_names)
    result.frameworks = detect_frameworks(text, file_contents)
    result.deliverables = detect_deliverables(text)
    result.evaluation_methods = detect_evaluation_methods(text)
    result.learning_objectives = extract_learning_objectives(
        "\n".join(x for x in (description, instructions) if x))

    # Discipline boost from detected frameworks / extensions
    for fw in result.frameworks:
        if fw in ("React", "Next.js", "Vue", "Svelte", "Tailwind"):
            _boost(result, "frontend", 1.5)
        elif fw in ("Flask", "FastAPI", "Django", "Express", "Node.js", "SQLAlchemy"):
            _boost(result, "backend", 1.5)
        elif fw in ("Pandas", "NumPy", "Scikit-learn", "Matplotlib", "Seaborn"):
            _boost(result, "data_science", 1.5)
    for tech in result.technologies:
        if tech in ("Excel", "CSV") and "spreadsheet" not in result.discipline_scores:
            _boost(result, "spreadsheet", 1.0)
        elif tech == "SQL":
            _boost(result, "sql", 1.2)
        elif tech == "Jupyter":
            _boost(result, "data_science", 1.5)

    ranked = sorted(result.discipline_scores.items(), key=lambda kv: kv[1], reverse=True)
    if ranked:
        result.discipline = ranked[0][0]
        total = sum(result.discipline_scores.values()) or 1.0
        top = ranked[0][1]
        second = ranked[1][1] if len(ranked) > 1 else 0.0
        result.confidence = round(min(1.0, 0.35 + ((top - second) / total) * 2.0
                                      + min(top, 8) / 16.0), 3)
    return result


def _boost(result: Classification, discipline: str, amount: float) -> None:
    result.discipline_scores[discipline] = result.discipline_scores.get(discipline, 0.0) + amount
    if discipline not in result.signals:
        result.signals.append(f"boost:{discipline}")
