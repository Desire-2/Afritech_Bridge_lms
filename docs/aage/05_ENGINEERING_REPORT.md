# AAGE — final engineering report

Date: 2026-11-19; updated 2026-11-22 for Excel/AAGE consolidation
Scope: `backend/` (Flask + SQLAlchemy) and `frontend/` (Next.js App Router)

This report states what was delivered, how it was verified, and what remains
explicitly out of scope. It is written to be auditable: every “done” claim maps
to a file and a test, and every limitation is named rather than hidden.

---

## 1. Summary

The Adaptive AI Assessment & Grading Engine (AAGE) is implemented as a modular
extension of the existing LMS:

- **Backend:** new service package `backend/src/services/aage/` (modules A–O),
  14 additive tables, an HTTP API at `/api/v1/aage`, a persistent job worker,
  instructor review, learning/calibration, analytics and audit logging.
- **Frontend:** typed client `frontend/src/services/aage.service.ts`, instructor
  page `/instructor/assessment-intelligence`, student page
  `/student/results/[submissionId]`, and six AAGE components.
- **Preserved:** manual grading, rubrics, grading history, progression, the
  70% certificate rule, notifications and the existing auth / role model. Excel
  is now a native AAGE specialist evaluator: analyzers are evidence sources,
  AAGE owns scoring/publication, and no second grading engine is active. No
  microservice, no duplicate cumulative-grade calculation, and no execution of
  student code, formulas or macros anywhere in Flask or the worker.
- **Evidence:** the final consolidation suite has **50 passed**; the sequential
  full backend run has **568 passed / 1 skipped / 13 failed**, where all 13 are
  pre-existing payment-slip OCR environment failures from missing `pytesseract`.
  Frontend contract tests are **77 passed** locally and **224 passed** in the
  staged full-suite run (see §7).

---

## 2. Milestone status

| # | Milestone | Status | Primary evidence |
|---|---|---|---|
| 1 | Repository audit + plan | **Done** | `docs/aage/00_REPOSITORY_AUDIT_AND_PLAN.md` |
| 2 | DB extensions, rubric intelligence, validated schemas | **Done** | `src/models/aage_models.py`, migration `a7a8e1c3f5b2`, `rubric_intelligence.py`, `validation.py`, `schemas.py` |
| 3 | Orchestrator + deterministic scoring + jobs | **Done** | `orchestrator.py`, `scoring.py`, `evidence.py`, `confidence.py`, `jobs.py` |
| 4 | Specialist evaluators | **Done** | `evaluators/{frontend,backend,data_science,spreadsheet,documents}.py`, `registry.py` |
| 5 | Excel integration + instructor review | **Done** | native `spreadsheet` evaluator reuses analyzers as evidence; AAGE `scoring.py` / `persistence.py` / `review.py` own the grade; compatibility endpoints + UI |
| 6 | Adaptive learning + calibration | **Done** | `learning.py`, calibration models/endpoints, Learning tab |
| 7 | Instructor dashboard + student results | **Done** | `assessment-intelligence/page.tsx`, `student/results/[submissionId]/page.tsx`, `components/aage/*` |
| 8 | Security, regression tests, docs | **Done for AAGE scope** | 55 backend + 33 frontend tests, 5 AAGE docs, full-suite regression run |

“Done” means the code path exists, is permission-checked, is exercised by an
offline test, and fails closed. It does not mean every desirable production
hardening (see §8) is present.

---

## 3. Delivered components (A–O)

| Module | File(s) | Responsibility |
|---|---|---|
| A — Assessment integration | `assessment_intelligence.py`, `persistence.py` | Load assignment/project, ownership, canonical submission/grade access |
| B — Discovery/classification | `assessment_intelligence.py`, `disciplines.py` | Extract requirements, technologies, discipline, unverifiable demands |
| C — Rubric intelligence | `rubric_intelligence.py` | AI draft generation, validation, weight normalisation, approval, immutable `RubricVersion`, forking on edit |
| D — Artifact processing | `artifacts.py` | Safe ZIP/text handling: traversal, symlinks, nested archives, ZIP bombs, binary/language manifest |
| E — Orchestrator | `orchestrator.py` | Evaluator selection, dispatch, timeouts, merge, conflict resolution, evidence attribution, confidence |
| F/G/H/I + documents — Evaluators | `evaluators/*.py` | Static analysis + schema-validated LLM proposals; deterministic caps; spreadsheet is a native AAGE evaluator that reuses Excel analyzers only for evidence |
| J — Evidence verification | `evidence.py` | Category/status normalisation, trust summarisation, caps |
| K — Deterministic scoring | `scoring.py` | Pure functions; weights must total 100; non-finite values rejected; unverified caps |
| L — Confidence/QA | `confidence.py` | Evidence-based bands, review requirement, policy gates; independent of awarded marks |
| M — Instructor review | `review.py` | Mark correction with reason, deterministic rescore, approve/reject, correction→learning example |
| N — Learning/calibration | `learning.py` | Approved examples, deterministic benchmark comparison, explicit version approve/rollback |
| O — Analytics | `analytics.py` | Persisted-row dashboard metrics/evaluator quality |
| API | `src/routes/aage_routes.py` | `/api/v1/aage`, JWT/role/ownership, envelope, pagination, audit, URL-level error handling |
| Jobs | `jobs.py`, `main.py` | Durable rows, optimistic claim, idempotent enqueue, retries, hard timeout, startup recovery, guarded worker |
| Database | `aage_models.py`, migration | 14 new tables + additive nullable columns; runtime self-heal via `ensure_aage_schema()` |

---

## 4. Security and trust boundaries

- **Prompt separation:** trusted system/rubric vs assessment data vs student
  content vs expected AI output are delimited; student-controlled markers are
  JSON-encoded and neutralised (`llm.py`).
- **No code execution:** submitted source is read as text. Execution adapters
  are deliberate stubs; nothing is run in Flask, a worker or an evaluator.
- **Schema-first AI:** every model payload is validated (`validation.py`) before
  use. Rubric generation **fails closed** — invalid AI JSON raises
  `rubric_invalid`; it never becomes a fallback rubric.
- **Evidence honesty:** a model cannot claim `verified` without evidence;
  failed deterministic checks set `unverified` and cap the mark; spreadsheet
  criteria are only `verified` when every mapped requirement is satisfied.
- **Grade math:** only `scoring.py` computes marks. `NaN`/`inf` are rejected at
  validation, evaluator conversion, confidence and scoring boundaries.
- **Rubric immutability:** an approved or already-used rubric is never rewritten;
  editing forks a new draft with `parent_rubric_id`. Versions are snapshots.
- **Authorization:** students read only their own published results; instructors
  are scoped to courses they own; admins bypass ownership but are audited.
- **Audit:** rubric, job, review, calibration and policy mutations append to
  `grading_audit_logs` with before/after and correlation id.
- **Uploads/artifacts:** ZIP limits and checks run before content is trusted;
  no path from the archive can escape the extraction root.

---

## 5. API surface

Base: `/api/v1/aage` (JWT; roles as above). Full request/response details are in
`02_API_REFERENCE.md`. Implemented groups:

- assessment analyze / rubric generate / get / edit / approve / versions
- grading start / jobs list+get+retry+cancel / results list+get+evidence+publish
- student published-result read
- reviews pending / detail / criterion correction / correction / approve / reject
- learning insights / examples / calibration start+get / version approve+rollback
- course-scoped instructor analytics
- admin evaluators list+patch / policies get+put / analytics

The app registers **744** URL rules, of which **35** are AAGE rules (verified by
importing `main` and iterating `app.url_map`).

List endpoints return `{success, data, meta}` with `page`, `per_page`, `total`,
`pages`. Errors use `{success:false, error:{code,message,details}}`.

---

## 6. Frontend

- `src/services/aage.service.ts`: typed axios client using the shared JWT client;
  defensive envelope unwrapping, structured `AageError`, `meta` pagination,
  pure URL builders for queues/results/student result.
- `src/components/aage/`: `StatsCards`, `RubricBuilder`, `GradingQueue`,
  `ReviewWorkspace`, `LearningDashboard`, `shared`.
- `/instructor/assessment-intelligence`: tabbed instructor workspace with role
  fallback; covers rubric lifecycle, queue, review, learning/calibration and
  admin controls.
- `/student/results/[submissionId]`: published-only view with a field whitelist
  and explicit “under review” / “not found” states.
- `InstructorSidebar.tsx`: one “Grading” entry; `GradingSubNavigation.tsx`
  exposes `Submissions`, `AI Grading` and `Assessment Intelligence` tabs.

The UI degrades gracefully if a newer endpoint is unavailable (legacy
submission list / “under review”), but all list and student endpoints now exist
on the backend.

---

## 7. Verification

Environment: WSL Ubuntu 22.04, backend `venv` (Python 3.10), Node 22.

| Check | Result |
|---|---|
| `pytest tests/test_aage_api.py tests/test_aage_pipeline.py tests/test_aage_registry.py tests/test_aage_security.py tests/test_aage_migration.py tests/test_aage_rubric.py tests/test_aage_reliability.py` | **76 passed** (after seven new schema-drift regressions, before auto-approval work) |
| Post-delivery HTML-submission regressions `pytest tests/test_submission_html_download.py` | **4 passed** |
| `pytest tests/test_aage_auto_approval.py` | **15 passed** (Excel-style approval gates, derived confidence, job-path publication) |
| Combined post-delivery check (API + pipeline + registry + reliability + E2E + auto-approval + detail + HTML) | **80 passed** |
| Combined AAGE run (focused + learning + all E2E) | **88 passed** before auto-approval work; superseded by the 80-test combined check above |
| E2E required scenarios `pytest tests/test_aage_e2e_scenarios.py` | **7 passed** |
| Existing LMS regression (scoring/certificate/progression) | **67 passed** |
| `node:test` on `frontend/tests/aage-service.test.ts` + `aage-contracts.test.ts` | **55 passed** (after the new policy-field expectations) |
| Focused frontend grading contracts (`aage-service`, `unified-grading`, `grading-navigation`, `aage-contracts`, `file-upload-rules`, `grading-fixes`) | **77 passed, 0 failed** |
| Full frontend suite in a staged Windows workspace (`npx --yes tsx --test tests/*.test.ts`) | **224 passed, 0 failed** |
| Live deterministic-provider regrade of submission 11 | `published`, `publication_mode=auto_approved`, `is_official=1`, `requires_review=0`, confidence 77.94, `published_at` set |
| Focused Excel/AAGE consolidation suite | **50 passed** (`test_excel_aage_integration.py`, `test_grading_stability.py`, `test_unified_ai_grading.py`, `test_learning_memory_e2e.py`, `test_aage_api.py`) |
| Full backend suite `pytest tests -q`, run alone | **568 passed, 1 skipped, 13 failed**. All 13 failures are pre-existing payment-slip OCR tests that need the missing `pytesseract` module; no AAGE/grading/upload test failed. A `422` seen only when two pytest suites ran concurrently passes in isolation and did not recur in the sequential run. |
| App import / route map | 35 AAGE rules under `/api/v1/aage` |
| Frontend `tsc --noEmit -p tsconfig.json` | 162 pre-existing errors in generated/unrelated files; **0** in AAGE files |
| `alembic heads` | one head: `a7a8e1c3f5b2` |
| `git diff --check` | clean |

The AAGE test suites are offline: an autouse provider stub validates the same
schema without a live model call, so results are deterministic and fast.

Earlier baseline differences: the old audit reported 6 pre-existing failures;
the current tree runs 492 passing with one order-dependent failure. This is
recorded rather than presented as “all green”.

---

## 8. Defects found and fixed during implementation

1. Callable schema defaults stored the class instead of calling it.
2. Dry-run evaluations (`persist=False`) reported `ok=False`.
3. Pipeline tests made live provider calls and reused a UNIQUE course title.
4. Prompt markers in plain-string student content were not escaped.
5. Rubric generation silently accepted schema-invalid AI output (fail-open).
6. Rubric/profile ids were conflated when loading learning examples.
7. Evaluator hints hid disagreements from conflict detection.
8. Evidence/status could be attributed to a different evaluator than the score.
9. Rubric edits mutated approved/graded rows instead of forking a draft.
10. Registry computed recommendations/hints/fallbacks but never used them.
11. Evaluator disabling was inert; selection now reads a durable setting.
12. Job timeouts were ignored; they are now hard deadlines and terminal.
13. Auto-publish semantics were inconsistent; the strict `auto` path still
    requires its policy flag, threshold and all gates, while an explicit
    instructor approval is sufficient. A separate default-on Excel-style
    `auto_approved` path now publishes evidenced results after a successful job.
14. Non-finite numbers could reach scoring/confidence; they are rejected or
    clamped to safe defaults at every boundary.
15. Failed deterministic checks did not cap marks; they now set `unverified`
    and cap conservatively.
16. Excel criteria were marked `verified` whenever any category score existed;
    they are now `verified` only when all mapped requirements are satisfied.
17. The AAGE worker was never started; `main.py` now starts it once, recovers
    stale jobs, and refuses to start under pytest/CLI/reloader.
18. `from src.models import GradingJob` could raise `AttributeError`; exports
    are now consistent.
19. Analytics initialised model classes instead of SQLAlchemy queries, so every
    dashboard call returned 500; all collections now start from `.query`.
20. The instructor dashboard called an admin-only analytics route; it now uses
    `/analytics`, which requires and verifies a course for instructors.
21. Frontend payload assumptions did not match the API: rubric reads wrap the
    rubric in `{rubric, has_rubric}`, review reads wrap it in
    `{review, result, evidence}`. Both are now normalised, with typed errors for
    a missing rubric.
22. Learning insights return an aggregate summary, not an array; the client now
    maps it into insight cards instead of permanently rendering “No insights”.
23. Analytics counters were returned in nested objects while the UI read flat
    fields; the client now flattens them without inventing zeroes.
24. Admin evaluator rows omitted the aggregate quality metrics already stored
    on version rows; the active (or newest) version's metrics are now exposed.
25. Cancellation after orchestration could still publish: CAS transitions and a
    recheck immediately before the irreversible write.
26. Retry duplicated results: retries now supersede active results and preserve
    audit rows.
27. Stale-lock recovery was time-only and unbounded: bounded lease/marker
    recovery with per-attempt progress.
28. `budget_exhausted` was reported for unrelated failures: real error codes now
    reach outcomes, audit and retry classification.
29. Conflict outcomes omitted the winning evaluator and marks: added
    `selected_evaluator` / `selected_marks`.
30. Auto-publication could bypass hard gates: `publication_mode="auto"` is the
    authoritative gate-checked path; manual mode requires explicit approval.
31. Policy updates could report success without persisting: updates now fail
    closed with verification and best-effort audit.
32. Learning examples omitted candidate scores and per-evaluator reliability:
    both are now persisted/derived from real records only.
33. Frontend policy units, history screens, calibration runs, role gating and
    student-safe errors were incomplete: all corrected with contract tests.
34. Cost fields existed but were never populated: an honest correlation-scoped
    accumulator records real call/character counts with null token/cost values.
35. A live database created before the cost column existed made
    `/api/v1/aage/analytics` return `500` (`no such column:
    evaluation_runs.cost`). Both the runtime self-heal and the guarded Alembic
    migration now repair that additive drift.
36. A live `rubrics` table built by an older `Rubric` model (`name` /
    `created_by` / `max_score` / `assignment_type`) made every AAGE assessment
    rubric endpoint return `500` (`no such column: rubrics.title`). The runtime
    self-heal and the guarded migration now add the current model's base
    columns (`title`, `instructor_id`, `course_id`, `is_template`,
    `total_points`) and backfill them from the legacy names. Two regressions
    cover both paths; all six previously failing endpoints now return `200`.
37. With reads repaired, AI rubric generation still returned `500`
    (`NOT NULL constraint failed: rubrics.name`) because the legacy table's
    unmapped `name` / `is_active` columns were required but never populated.
    `Rubric` now maps them with safe defaults (`name=''`, `is_active=True`),
    with a reverse backfill for model-created DBs; INSERTs succeed on both
    schemas. A full model↔DB diff also exposed missing mapped columns in four
    tables; `ensure_aage_schema()` now ends with a guarded additive reconciliation
    sweep, so no existing mapped table can still trigger `no such column` 500s.
 38. Ordinary assignment/project submissions were never enqueued into AAGE, and
    the student result panel always called the legacy Excel endpoint — a `404`
    on every non-Excel course. Every submission now enqueues AAGE; the student
    status endpoint reports `engine: "aage"` plus a `specialist` hint. The old
    suppress/fallback logic was removed because there is no second engine.
    Publication remains policy/review-gated.
 39. Instructor submission-detail endpoints returned `500`
     (`name '_attach_rubric_dict' is not defined`) whenever `include_rubric=true`
     was passed for an assessment with a linked rubric. The helper is now defined
     next to the route guards, loads the rubric on demand, and degrades to no
     rubric data if the row is missing so a broken optional expansion cannot
     hide the whole submission.
 40. A submitted `contact_form.html` was present in `AssignmentSubmission.file_url`
     but AAGE reported `STUDENT_SUBMISSION.files` as empty and scored 0. The
     shared downloader's auth-wall guard rejected every `text/html` response,
     including genuine HTML coursework. The guard now skips only when the file
     metadata declares an HTML filename/content type, so login pages are still
     rejected. `ArtifactManifest.prompt_view()` also lists `declared_files` even
     when bytes are unavailable. Re-running the live submission produced a
     `ready` artifact (5464 bytes), an `HTML`-language manifest, and criterion
     rationales citing the actual file (78.33/100, pending review).
 41. AAGE stayed in `pending_review` by default while Excel grading self-approved
     and published the same kind of evidenced work. A dedicated default-on
     `auto_approved` path now mirrors Excel's 70% confidence gate, promotes file
     citations already written in rationales into validated evidence, and ignores
     only `unverified_criteria` / `review_required` meta-signals. Provisional
     rubrics, failed deterministic checks, evaluator conflicts, `UNVERIFIED`
     evidence and genuinely low publishability confidence still block. The
     stricter opt-in `auto_publish` path and manual instructor approval are
     unchanged, and all three modes reuse the same canonical write-through.
  42. Re-grades could briefly lower a student's score: degraded/offline-stub
     results were auto-published, forced re-runs had no unchanged-content guard,
     and a newer draft could hide an older official result. The approval gate
     now blocks fallback/degraded runs, publication skips automatic replacement
     for identical artifact checksums, result selection prefers the latest
     official row, and the canonical AAGE write-through retains an
     existing higher grade unless an instructor explicitly approves a change.
     Student result endpoints hide preliminary (unreviewed) results, and the UI
     separates viewing the current AI result from an explicit confirmed re-run.
     Regression coverage: `backend/tests/test_grading_stability.py`.
 43. Excel submissions could be analysed without ever publishing, while the
     submission hook suppressed AAGE as soon as the Excel thread started. That
     two-engine hand-off is superseded. Every `assignment`/`project` submission
     now enqueues AAGE; the native `spreadsheet` evaluator derives marks and
     evidence from retained workbook bytes without calling
     `ExcelGradingService.grade_submission()`, `_run_pipeline()`,
     `GradingEngine.grade()` or `finalize_excel_grade()`. AAGE's
     `compute_breakdown()` and `persistence.write_through_grade()` are the only
     score/publication paths. Unreviewed results stay `pending_review` and hide
     provisional scores from students; lower automatic regrades and degraded
     results cannot replace a published grade. Legacy Excel endpoints are now
     compatibility views/shims and historical rows remain readable.
     Regressions: `backend/tests/test_excel_aage_integration.py`,
     `test_unified_ai_grading.py`, `test_grading_stability.py`.

---

## 9. Known limitations (honest)

1. **Cooperative timeouts.** A hard deadline bounds provider calls and marks the
   job `timed_out`, but a non-cooperative trusted callable can hold its daemon
   thread until it returns. Untrusted student code is never executed.
2. **Single-thread worker per process.** Multiple app processes each run one
   loop and rely on the optimistic `queued → running` claim to prevent double
   execution. There is no Celery/Redis by design.
3. **In-process durability.** Jobs are DB rows and survive restarts, but a crash
   mid-run leaves a locked row that startup recovery re-queues after the stale
   window; very long provider stalls can delay that recovery.
4. **Evaluator filter pagination.** `evaluator` filters on job/result lists are
   applied in Python after loading rows, so they are O(n) at high volume; other
   filters are SQL-side.
5. **No frontend component/E2E tests.** Service logic is tested with `node:test`;
   React components were validated by type-check and manual inspection only.
6. **Full `tsc` is blocked by pre-existing errors** in generated/unrelated
   files; AAGE files themselves have zero type errors.
7. **Fresh Alembic upgrade is fixed for the AAGE scope.** The migration was
   rewritten as idempotent/guarded and a narrow zero-table bootstrap creates the
   model-authoritative schema and stamps the head. Verified on SQLite: 114 tables,
   AAGE tables present, `alembic_version = a7a8e1c3f5b2`. No live PostgreSQL
   migration was executed in this environment.
8. **Calibration never auto-activates.** A version becomes active only through
   explicit approve; this is intentional.
9. **Evaluation quality is bounded by the model and rubric.** The engine
   validates shape, enforces evidence rules and computes marks deterministically,
   but it does not prove semantic correctness of a model’s rationale. Low
   confidence, conflicts and missing evidence force instructor review.
10. **Spreadsheet analysis is static.** Formula strings, macros, queries and
   pivots are inspected, never executed or refreshed; calculated values that
   require Excel are not claimed as verified. The legacy Excel classes remain
   in the tree for historical compatibility but are unreachable from new
   grading paths. Browser interaction tests were not added (no React Testing
   Library), so UI validation is contract/static only.

---

## 10. Pre-existing legacy findings (not modified)

These were found while auditing the surrounding grading system. They are **out
of AAGE scope** and deliberately left unchanged so this work stays incremental:

- Excel grading routes are instructor/admin-only but not course-ownership scoped.
- Grading history lacks ownership checks.
- Rubric creation trusts a supplied `course_id` without an ownership check.
- Upload accepts a client-supplied `studentId` (identity binding risk).
- Bulk/quick grading propagate less state than manual grading and can synthesize
  lesson-completion inputs.
- Scoring thresholds are duplicated across routes/models/services despite
  `src/config/scoring.py`.
- The general API audit doc (`docs/api/audit-report.md`) is stale.

Recommend fixing these as separate, reviewable changes; none are required for
the AAGE paths, which apply their own ownership checks and canonical write-through.

---

## 11. Operational notes

- Enable/disable the worker with `AAGE_WORKER_ENABLED=true|false`.
- Tune `AAGE_WORKER_POLL_SECONDS` (0.25–60) and
  `AAGE_WORKER_RECOVERY_TIMEOUT_SECONDS`; model calls are bounded by
  `AAGE_LLM_CALL_TIMEOUT_SECONDS` (default 60 s).
- Rubric approval, publication, calibration activation and policy changes are
  audited; policy changes apply to new runs only.
- Recommended smoke test: create assessment → analyze → generate/edit/approve
  rubric → submit → enqueue → review → publish → confirm module/course/certificate
  behaviour is unchanged.

---

## 12. Final status

All original AAGE phases 1–9 and the Excel consolidation phases 1–12 in
`AAGE_EXCEL_INTEGRATION_TRACKER.md` are complete within scope and covered by
offline tests. The remaining items are named production-hardening and
pre-existing platform issues, not missing features. No commit or push was made;
the work is entirely in the working tree for review.
