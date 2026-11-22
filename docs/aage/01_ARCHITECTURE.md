# Adaptive AI Assessment & Grading Engine (AAGE)

**Status:** implemented incrementally inside the existing AfriTech Bridge LMS.
See `00_REPOSITORY_AUDIT_AND_PLAN.md` for the as-found audit and
`05_ENGINEERING_REPORT.md` for the final implemented/partial/future status.
**Scope:** `backend/` (Flask + SQLAlchemy) and `frontend/` (Next.js App Router).

---

## 1. Repository audit (what exists today)

### 1.1 Backend

| Area | Finding |
|---|---|
| Framework | Flask 2.3.3, SQLAlchemy 2.0.36, Flask-Migrate 4.1.0, Flask-JWT-Extended 4.5.3 |
| Entry point | `backend/main.py` (imports every model, registers 42 v1 blueprints, mounts `/api/v2`) |
| Legacy API | `/api/v1/*` — `src/routes/` (46 files), inconsistent response envelopes, per-file auth decorators |
| Modern API | `/api/v2/*` — `src/api/` (`responses.ok/paginated`, `errors.ApiError`, `pagination`, `auth`) |
| Models | `src/models/` (18 modules). Grading-relevant: `course_models.Assignment/AssignmentSubmission/Project/ProjectSubmission`, `grading_models.Rubric/RubricCriterion/FeedbackTemplate/GradingHistory`, `excel_grading_models.ExcelGradingResult`, `student_models.ModuleProgress/LessonCompletion` |
| AI providers | `src/services/ai/ai_providers.py` → `AIProviderManager` singleton `ai_provider_manager`, entry point `make_ai_request(prompt, temperature, max_tokens)` returning `(text, provider)` with provider fallback chain (Gemini / OpenRouter / NVIDIA), rate limiting, per-thread overrides |
| AI content gen | `src/services/ai/agents/*` — course/lesson/quiz/assignment authoring (not grading) |
| **Existing grading** | `src/services/excel_grading/` (17 modules, ~480 KB): deterministic analyzers (formula, pivot, chart, VBA, Power Query, DAX, formatting) + `grading_engine.py` rubric scoring + `assignment_intelligence.py` requirement evaluation + `rubric_generator.py` + `learning_engine.py` calibration + `auto_grader.py` background write-back |
| Background work | **No Celery/Redis.** Three mechanisms: in-process `threading.Thread`, DB-backed `BackgroundTask` model (`src/services/background_service.py`), APScheduler (`src/services/scheduler_service.py`) |
| File storage | Google Drive (`src/utils/google_drive_service.py`) for submission artifacts; local `uploads/` for payment slips/CVs |
| Scoring truth | `src/config/scoring.py` — `CERTIFICATE_PASSING_SCORE = 70`, `ASSIGNMENT_PASSING_SCORE = 60`, lesson/module weights in `student_models.py` |
| Grade path | `submission.grade` → `percentage` → `ModuleProgress.{assignment,project}_score` (best-score) → `calculate_cumulative_score()` → `LessonCompletion.calculate_lesson_score()` → `Enrollment.calculate_course_score()` → `CourseProgressService.evaluate()` (70% rule) → `CertificateService` |
| Tests | pytest 7.4.3, `backend/tests/` (34 files), `conftest.py` points `DATABASE_URL` at throwaway sqlite before importing `main` |
| Migrations | The Alembic graph now reports **one head** (`a7a8e1c3f5b2`, which has multiple parents); the earlier “six divergent heads” description was inaccurate. Production still relies on `db.create_all()` + `_auto_migrate_missing_columns()` + out-of-band sync scripts (a fresh SQLite `db upgrade` hits a pre-existing failure in the initial migration) |

### 1.2 Frontend

| Area | Finding |
|---|---|
| Stack | Next.js 16 App Router, React 19, TypeScript (strict but `ignoreBuildErrors: true`), Tailwind 3.4, shadcn/ui (new-york/slate), recharts, sonner |
| Data layer | `src/lib/api-client.ts` + `src/services/api/base.service.ts` (axios), class-based `*.service.ts`, `useAsync`/`useMutation` hooks, no react-query |
| Auth | JWT in `localStorage`, client-side guards in `src/components/guards/`, `AuthContext` |
| Instructor grading UI | `/instructor/grading`, `/instructor/grading/assignment/[id]`, `/instructor/grading/project/[id]`, `/instructor/ai-grading-dashboard`; components `RubricGradingPanel`, `ExcelAIGradingButton`, `ExcelGradingResultPanel`, `QuickGradingModal` |
| Rubric UI | `components/instructor/course-creation/EditRubricModal.tsx`, `AssessmentManagement.tsx` |
| Student results | `(learn)/learn/[id]/components/AssignmentPanel.tsx` + `ProjectPanel.tsx`, `components/grading/StudentExcelGradingResult.tsx` |
| Nav | hardcoded `navSections` arrays in `InstructorSidebar.tsx` / `StudentSidebar.tsx` |
| AAGE UI | `/instructor/assessment-intelligence` (tabbed rubric builder, grading queue, review workspace, learning/calibration, admin) and `/student/results/[submissionId]` (published-only); components in `src/components/aage/` |
| Tests | node:test via `tsx`, AAGE service tests in `frontend/tests/aage-service.test.ts`, no component/E2E tests |

### 1.3 Existing grading functionality found (and preserved)

1. **Manual instructor grading** — `src/routes/grading_routes.py` (`/api/v1/grading/...`), assignment + project, team grade propagation, gate-module rule, auto modification requests.
2. **Excel AI grading** — originally a full deterministic pipeline with its own models, routes (`/api/v1/excel-grading`), background auto-grader and write-back. After consolidation its analyzers remain as static evidence sources inside the native AAGE `spreadsheet` evaluator; AAGE's `scoring.py` and `persistence.py` are now the only score and publication path.
3. **Rubrics** — `Rubric` + `RubricCriterion` tables already linked from `Assignment.rubric_id` / `Project.rubric_id`.
4. **Progression/certificates** — untouched; AAGE writes through the same `submission.grade` path.

**There was no generic (non-Excel) automatic grader.** `src/utils/ai_grading_helper.py` is dead code (only reference is commented out).

---

## 2. What AAGE adds

```
                     ┌──────────────────────────────────────────┐
                     │  A  Assessment Integration Service       │
                     │  B  Discovery & Classification Service   │
                     └───────────────┬──────────────────────────┘
                                     │ creates/updates
                     ┌───────────────▼──────────────────────────┐
                     │  C  Dynamic Rubric Intelligence          │
                     │     (generate → draft → instructor       │
                     │      approve → RubricVersion snapshot)   │
                     └───────────────┬──────────────────────────┘
                                     │ approved rubric
   submission ──► ┌──────────────────▼──────────────────────────┐
                  │  D  Submission Processing & Artifact        │
                  │     Analyzer (safe ZIP, manifest, langs)    │
                  └──────────────────┬──────────────────────────┘
                                     │ EvaluationContext
                  ┌──────────────────▼──────────────────────────┐
                  │  E  Central Evaluation Orchestrator         │
                  │     select evaluators → dispatch → collect  │
                  │     timeouts / retries / conflicts          │
                  └───────┬──────────────┬─────────────┬────────┘
                          │              │             │
              ┌───────────▼──┐  ┌────────▼──────┐ ┌────▼────────────┐
              │ F Frontend   │  │ G Backend     │ │ H Data Science  │
              │ I Spreadsheet│  │ documents…    │ │ (bounded,       │
              │ (wraps excel)│  │               │ │  registry)      │
              └───────┬──────┘  └──────┬────────┘ └────┬────────────┘
                      └────────────────┼───────────────┘
                                       ▼
        ┌──────────────┐  ┌────────────────────┐  ┌──────────────────┐
        │ J Evidence   │► │ K Deterministic    │► │ L Confidence &   │
        │ Verification │  │ Grade Calculation  │  │ Quality Assurance│
        └──────────────┘  └────────────────────┘  └────────┬─────────┘
                                                           ▼
        ┌──────────────┐  ┌────────────────────┐  ┌──────────────────┐
        │ M Instructor │  │ N Adaptive Learning│  │ O Analytics &    │
        │ Review       │  │ & Calibration      │  │ Reporting        │
        └──────────────┘  └────────────────────┘  └──────────────────┘
```

### Package layout

```
backend/src/services/aage/
├── __init__.py              public exports
├── validation.py            dependency-free declarative schema validator (never trust raw model JSON)
├── schemas.py               AI output + rubric + evaluation schemas
├── disciplines.py           discipline/technology lexicon (B)
├── assessment_intelligence.py  A + B
├── rubric_intelligence.py   C
├── artifacts.py             D (safe ZIP extraction, manifest, language detection)
├── evidence.py              J
├── scoring.py               K  (pure functions, no LLM)
├── confidence.py            L
├── evaluators/
│   ├── base.py              Evaluator protocol + EvaluationContext + registry
│   ├── registry.py          discovery/selection — new evaluators register here only
│   ├── frontend.py          F
│   ├── backend.py           G
│   ├── data_science.py      H
│   ├── spreadsheet.py       I  (native specialist; excel_grading analyzers are static evidence sources)
│   └── documents.py         written/text submissions (non-technical disciplines)
├── orchestrator.py          E
├── jobs.py                  persistent async job runner (idempotent, bounded retries)
├── review.py                M
├── learning.py              N
├── analytics.py             O
└── persistence.py           write-through to existing LMS grade/progress services
```

### Key architectural rules enforced in code

* One orchestrator; evaluators **never** publish grades (they only return `EvaluatorOutput`).
* Every AI response passes `validation.validate()` against an explicit schema before use.
* Prompt layers are separated: trusted system prompt / assessment data / student content / AI output are delimited and student content is escaped (§15 injection protection).
* `scoring.py` is plain Python: `awarded = (criterion_marks / criterion_max) * criterion_weight`, weights must total 100.
* Unverified criteria can never silently receive full marks (cap applied by `scoring.py`).
* Confidence is computed from evidence/quality factors only — never from the score value.
* No submitted code is executed anywhere in Flask or the background worker.

---

## 3. Data model

New tables live in `src/models/aage_models.py`; `Rubric` / `RubricCriterion` gain **additive nullable** columns (existing rows and columns untouched).

| Table | Purpose |
|---|---|
| `rubrics` (+cols) | status/approval, discipline, assessment link, source, evaluator recommendations, unverifiable requirements |
| `rubric_criteria` (+cols) | `weight` (Σ=100), `is_required`, `evidence_requirements`, `evaluator_instructions`, stable `criterion_key` |
| `rubric_versions` | immutable snapshot per approved revision (history preserved) |
| `grading_profiles` | reusable approved rubric profiles (auto-approval path) |
| `grading_jobs` | persistent job state, correlation id, retries, locks, cost/latency |
| `submission_artifacts` | per-file manifest: checksum, language, category, extracted metadata |
| `evaluation_runs` | one orchestrator execution (rubric version, evaluator versions, timings) |
| `evaluation_results` | authoritative outcome, status workflow, confidence, review flags |
| `criterion_scores` | per-criterion awarded/max/weight/rationale/evidence status |
| `evaluation_evidence` | evidence rows (category VERIFIED/CODE_SUPPORTED/CONTENT_SUPPORTED/UNVERIFIED) |
| `grading_reviews` | instructor review workflow |
| `learning_examples` | instructor-approved correction examples (candidate → approved) |
| `evaluator_versions` | versioned evaluator configs with benchmark metrics, rollback |
| `calibration_runs` / `calibration_cases` | benchmark comparisons (MAE, agreement, false pass/fail) |
| `grading_audit_logs` | who changed what, with before/after and correlation id |

---

## 4. Milestones

| # | Deliverable | Current status |
|---|---|---|
| 1 | Repository audit + architecture plan | Done: `00_REPOSITORY_AUDIT_AND_PLAN.md`, corrected architecture doc |
| 2 | Database extensions, rubric intelligence, grading schemas | Done: `aage_models.py`, migration, `rubric_intelligence.py`, `schemas.py`; approved/used rubric edits fork a new draft |
| 3 | Orchestrator + evidence-based deterministic scoring | Done: `orchestrator.py`, `jobs.py`, `evidence.py`, `scoring.py`, `confidence.py`; offline tests |
| 4 | Frontend / backend / data-science evaluators | Done (static analysis + validated LLM); execution adapters remain deliberate stubs |
| 5 | Excel integration + instructor review workflow | Done: native `spreadsheet` evaluator reuses Excel analyzers as evidence; AAGE `review.py` + compatibility shims + UI |
| 6 | Adaptive learning, benchmarks, calibration | Done: `learning.py` with approved examples, deterministic calibration, explicit version approve/rollback |
| 7 | Instructor dashboard + student feedback UI | Done: one Grading sidebar entry with Submissions / AI Grading / Assessment Intelligence tabs + student published-results page |
| 8 | Security, regression tests, docs | Done for AAGE scope: 55 backend tests, 33 frontend service tests, 5 docs; pre-existing suite regression-checked |

---

## 5. Extension points (adding a capability without touching the core)

* **New evaluator** — subclass `BaseEvaluator` in `src/services/aage/evaluators/<name>.py`, call
  `register_evaluator(YourEvaluator())` in that module's import, add the module to
  `evaluators/__init__.py`. The orchestrator discovers it via `registry.all()`; no orchestrator edit.
* **New discipline** — add a keyword entry in `disciplines.py`.
* **New evidence source** — add an `EvidenceCollector` in `evidence.py`.
* **New AI provider** — reuse `ai_provider_manager.make_ai_request`; AAGE only depends on that call.
