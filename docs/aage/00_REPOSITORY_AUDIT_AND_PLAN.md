# AAGE — Repository audit and implementation plan (as found)

Date: 2026-11-19. This document records the state of the repository **before** the
current round of AAGE work. It is the Milestone 1 deliverable required by the
engineering brief. Status figures deliberately distinguish code that existed on
disk from claims made in earlier documentation.

> **Post-implementation note:** the gaps listed in §4 were subsequently closed.
> A second, deeper audit on 2026-11-19 found the implementation gaps recorded in
> §8. Those findings are being closed phase by phase in `06_PHASE_REPORTS.md`;
> see `05_ENGINEERING_REPORT.md` for test evidence and `01_ARCHITECTURE.md` for
> the component map.

---

## 1. Repository structure discovered

| Area | Finding |
|---|---|
| Backend | Flask 2.3.3 / Flask-SQLAlchemy / Flask-JWT-Extended monolith. `backend/main.py` is the module-level app (no factory); 42+ `/api/v1` blueprints plus a newer `/api/v2` integration API in `src/api/`. |
| Frontend | Next.js 16 App Router, React 19, TypeScript, Tailwind 3, shadcn/ui, JWT in `localStorage`, axios clients in `src/lib/api-client.ts` and `src/services/api/base.service.ts`. |
| Other apps | `afritech-operations/` (separate Next.js app) and `intern-portal/` (Vite). Neither owns LMS grading and both are left untouched. |
| Database | SQLite in development, PostgreSQL in production; Alembic revisions plus `db.create_all()`-based bootstrapping and column self-heal in `main.py`. The AAGE revision has multiple parents and is the single head reported by `alembic heads` (the earlier “six divergent heads” wording was inaccurate), but a fresh `flask db upgrade` on SQLite still fails in a **pre-existing** initial migration that reflects a missing `announcements` table; runtime bootstrap is what supports deployments today. |
| Tests | pytest in `backend/tests/` (`conftest.py` points `DATABASE_URL` at a throwaway SQLite file). Frontend uses `node:test` via `tsx`, not Jest/Vitest. |
| Docs/tracking | Existing `docs/api/audit-report.md` (general API audit, 2026-10-18) and `docs/api/implementation-plan.md` (integration API plan). |

## 2. Existing grading functionality (preserved, not replaced)

1. **Manual grading** — `src/routes/grading_routes.py`: assignment/project submission lists, per-submission grading, team grade propagation, bulk/quick grading, modification requests, feedback templates, grading history. Scores are written to `AssignmentSubmission.grade` / `ProjectSubmission.grade`.
2. **Excel AI grading** — `src/services/excel_grading/` (deterministic formula/pivot/chart/VBA/Power Query/DAX analyzers, rubric scoring, assignment intelligence, learning/calibration, background `auto_grader`), routes `excel_grading_bp` under `/api/v1/excel-grading`, models `ExcelGradingResult`. Its analyzers are preserved, but final consolidation made AAGE the only active grading engine: the native `spreadsheet` evaluator uses these analyzers as evidence sources, and the old routes/classes survive only as read/review compatibility shims.
3. **Rubrics** — `Rubric` + `RubricCriterion` in `src/models/grading_models.py`, already referenced by `Assignment.rubric_id` and `Project.rubric_id`; existing UI `EditRubricModal.tsx`, `RubricGradingPanel.tsx`.
4. **AI provider** — `src/services/ai/ai_providers.py` exposes `ai_provider_manager.make_ai_request(...)` with Gemini/OpenRouter/NVIDIA fallback, rate limiting and per-thread overrides. Existing agents are content-authoring agents, not graders. `src/utils/ai_grading_helper.py` is dead code.
5. **Background work** — no Celery/Redis. `threading.Thread`, DB-backed `BackgroundTask`, APScheduler services. File artifacts use Google Drive plus local uploads.
6. **Progression/certificates** — `CourseProgressService.evaluate` with `CERTIFICATE_PASSING_SCORE = 70`, `Enrollment.calculate_course_score`, `LessonCompletionService`, `CertificateService`. These remain the single source of truth; AAGE writes only through the canonical grade path after approval.
7. **Frontend grading UI** — `/instructor/grading*`, `/instructor/ai-grading-dashboard`, `/student/assignments/[id]`, `/student/projects/[id]`, `(learn)/learn/[id]/components/AssignmentPanel.tsx`, `components/grading/*`. Role guards live in `src/components/guards/` and `AuthContext`.

## 3. Partial AAGE work already present (uncommitted at audit time)

| Component | State on disk |
|---|---|
| `backend/src/models/aage_models.py` | 14 new tables (grading profiles, rubric versions, jobs, artifacts, runs, results, criterion scores, evidence, reviews, learning examples, evaluator versions, calibration runs/cases, audit logs) + `ensure_aage_schema()`. |
| `backend/src/models/grading_models.py` | Additive nullable columns on `rubrics` / `rubric_criteria` (status, version, weights, evidence requirements, approval metadata). Legacy rows remain readable. |
| `backend/src/services/aage/` | Core engine present: validation, schemas, disciplines, assessment intelligence, rubric intelligence, safe ZIP artifact analyzer, evidence verification, deterministic scoring, confidence, LLM wrapper, orchestrator, persistent jobs, persistence/write-through, policies, five evaluators (frontend/backend/data science/spreadsheet/documents) + registry. |
| `backend/migrations/versions/a7a8e1c3f5b2_add_aage_engine_tables.py` | New Alembic revision. |
| `backend/tests/test_aage_pipeline.py` | 13 tests covering criteria normalisation, merge/conflict resolution, orchestration and job state. Initially made **live provider calls** and had two real bugs (see §5). |
| `docs/aage/01_ARCHITECTURE.md` | Architecture narrative; **overstated completion** (claimed frontend, review, learning and analytics were implemented). |

There was **no AAGE HTTP API**, no AAGE frontend, and no `review.py`, `learning.py` or `analytics.py` service on disk.

## 4. Gaps relative to the brief

| Milestone | As-found status |
|---|---|
| 1 — Audit + plan | Documentation existed but was inaccurate; this file corrects it. |
| 2 — DB + rubric intelligence | Mostly implemented; migration execution not yet verified. |
| 3 — Orchestrator + deterministic scoring | Implemented; validator scoring-default bug fixed. |
| 4 — Specialist evaluators | Implemented as static-analysis + schema-validated LLM evaluators; execution adapters are explicit stubs (correct — no untrusted code execution). |
| 5 — Excel integration + instructor review | Spreadsheet evaluator present; **review service/API missing**. |
| 6 — Adaptive learning + calibration | Models present; **learning/calibration service missing**. |
| 7 — Instructor dashboard + student results | **Entirely missing**. |
| 8 — Security, regression tests, docs | Partial: pipeline tests existed; security/regression tests and most guides missing. |

## 5. Defects fixed before continuing

1. `validation.validate()` stored callable field defaults (`default=list`) as the `list` **class**, so a missing `evidence` field crashed `EvidenceValidator` with `TypeError: 'type' object is not iterable`. Callable defaults are now invoked.
2. `EvaluationOutcome.ok` required a persisted `result_id`, so every `persist=False` dry run reported failure. `ok` now reflects evaluation success only.
3. Pipeline tests used a fixed course title that violates `courses.title` uniqueness on the second test, and called a live AI provider (≈50 s, non-deterministic). Tests now use unique titles and an offline schema-validating provider stub.
4. Prompt-layer markers inside student-controlled content were not escaped when the content was a plain string. All layers are now JSON-encoded and student markers are neutralised.

## 6. Implementation plan (controlled milestones)

- **M1** Audit + plan → this document + corrected architecture doc.
- **M2** Verify migration/schema extension; keep additive-only changes and historical rubric versions.
- **M3–M4** Harden orchestrator, scoring, evidence and evaluator contracts with offline tests (in progress: done for scoring/evidence/security).
- **M5** Add instructor review service and versioned `/api/v1/aage` endpoints; preserve existing Excel grading and canonical grade write-back.
- **M6** Add controlled learning-example approval and deterministic calibration with explicit version approval/rollback.
- **M7** Add instructor Assessment Intelligence UI and a student published-results view using the existing design system and guards.
- **M8** Security/regression/performance verification and complete developer/instructor documentation.

**Non-negotiables:** no untrusted code execution; no competing cumulative-grade calculation; no silent rubric/prompt changes after grading; no duplicate submission or progress tables; no new microservice.

## 7. Verification approach

- `backend/venv/bin/python -m pytest tests/test_aage_pipeline.py tests/test_aage_security.py tests/test_aage_api.py -q`
- Regression: existing grading/Excel/progress/certificate test modules must remain green; baseline before AAGE work was 280 passed / 6 pre-existing failures in `test_internship.py` and `test_rate_limit_handler.py` (documented in `docs/api/audit-report.md`).
- Frontend: `node:test` via `tsx` for pure service/validation logic; TypeScript check where the existing config permits.
- Manual end-to-end: create assessment → generate/edit/approve rubric → submit → enqueue job → review → publish → confirm course progress/certificate behaviour is unchanged.

---

## 8. Second-round audit (2026-11-19, code-only)

Four independent read-only audits re-examined the backend, frontend, database and
QA/security posture after the first implementation pass. They confirmed the broad
architecture was present but found the following concrete gaps. This section is
the authoritative "as found" record for the current completion round; fixes are
tracked per phase in `06_PHASE_REPORTS.md`.

### 8.1 Database and migrations

- The AAGE migration had multiple parents, non-idempotent `create_table` calls,
  drifted index names, a missing course index and an incorrect server default.
- Runtime self-heal and advisory-lock DDL ran on different connections, so the
  lock did not actually cover schema changes; `TimeoutError` was not retried.
- A fresh `flask db upgrade` failed in pre-existing alter-only legacy revisions
  (`NoSuchTableError: announcements`, later `api_clients already exists`).
- `Rubric.profile_id` / `approved_by` FK declarations did not match the guarded
  plain-integer migration contract; grading models were not exported from
  `src.models`.

### 8.2 Backend engine

- Assessment integration is internal-only: no LTI/external grade passback, and
  only `AssignmentSubmission` / `ProjectSubmission` are loadable.
- Evaluator execution adapters (browser/API/notebook) are honest placeholders;
  static analysis is real, but there is no sandboxed student-code execution.
- In-flight cancellation could still succeed and publish; stale-lock recovery was
  time-only and could duplicate a long legitimate job; retry was not
  result-idempotent; `budget_exhausted` was unreachable as an error code.
- Conflict resolution reported `hint_owner_selected` even when the hint owner was
  filtered out and a different evaluator won.
- `require_all_gates` was ignored by auto-publish; `write_through_grade` had no
  independent verification/review check. Policy persistence failures were logged
  but returned as success.
- Learning corrections did not persist `candidate_scores`, so calibration usually
  reported `insufficient_data`; reliability was global instead of per evaluator;
  learning/calibration routes lacked course-ownership checks.
- Student result `recommended_resources` was hardcoded to `[]`.

### 8.3 Frontend

- `RubricCriterion` lacked `max_marks`; backend validation requires it.
- Policies UI used `require_instructor_review` / `confidence_threshold` on a 0–1
  scale while the backend uses `auto_publish_min`, `provisional_min`,
  `auto_publish_enabled` and `require_all_gates` on a 0–100 scale.
- `formatPercent` rendered a 0–1 correction rate as if it were already percent;
  analytics scales were inconsistent.
- Missing student submission history, instructor grading reports and calibration
  run history/detail; role gating and student error masking needed hardening.
- A typed `not_found` AageError existed but consumers still matched message text.
- No React component/E2E tests existed; only pure service tests were automated.

### 8.4 QA / security / tests

- The full-suite `422` failure was order-dependent and not reproduced in
  isolation. Static analysis points to JWT app/config divergence before the view
  executes, but no single polluter was proven without bisection.
- No coverage tool, SAST/dependency scanning, load test, multi-process worker
  test or browser E2E framework was configured. Do not report those as measured.
- Legacy (pre-AAGE) ownership gaps remain in Excel grading, grading history,
  rubric creation and upload routes; they are recorded as out-of-scope risks, not
  silently accepted as AAGE fixes.
- Calibration deliberately reports `insufficient_data`; no MAE/agreement/pass-fail
  metric may be invented when cases are missing.

### 8.5 Completion interpretation

The second audit changed the final gate: the phase reports must distinguish
"implemented", "verified by test", and "explicitly limited". Claims such as
"7/7 E2E" or "all green" are not acceptable without the corresponding executed
tests and recorded results.
