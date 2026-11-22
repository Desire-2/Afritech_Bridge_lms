# AAGE Excel Integration Tracker

**Goal:** one unified grading system (AAGE) with multiple specialist evaluators. Excel is a **native AAGE specialist evaluator**, not an independent grading engine.

**Scope:** audit, preserve, consolidate, improve and verify Excel grading, grading decisions, feedback, resubmission, instructor review, adaptive learning, progression and certificates in the existing AfriTech Bridge LMS.

**Current state (2026-11-22):** implementation complete. Source code and executed tests are authoritative over earlier AAGE delivery documents. No commit was made; unrelated root-document deletions and mode changes were left untouched.

---

## Architecture contract

- AAGE is the **only** grading engine for `assignment` and `project`. Quizzes remain on the existing auto-grader.
- `SpreadsheetEvaluator` (`name="spreadsheet"`, `version="2.0.0"`) is registered in the AAGE evaluator registry. It uses existing workbook/formula/chart/pivot/VBA/Power Query/DAX/formatting analyzers as **deterministic evidence sources** only.
- Workbook bytes stay in `ArtifactManifest.binary_files`; they are never placed in prompts, never executed, and formulas/macros/queries are never refreshed.
- AAGE owns rubric selection, evidence validation, `scoring.compute_breakdown()`, confidence, review, learning and canonical grade publication through `persistence.write_through_grade()`.
- `uses_excel_grader()` is only a status/UI hint that the spreadsheet specialist is likely to be selected; it never selects an engine.
- Legacy Excel endpoints are compatibility views/shims onto AAGE. Historical `ExcelGradingResult` rows remain readable; no new grade is created by a second engine.
- One `Grading` sidebar entry with three in-page tabs: `Submissions`, `AI Grading`, `Assessment Intelligence`. There is no `/instructor/grading-dashboard` and no separate Excel dashboard.
- `UniversalAIGradingButton` is the only AI entry on grading detail pages. Historical spreadsheet results are rendered read-only inside it; AAGE review lives in the Assessment Intelligence tab.

---

## Final audit matrix

| Component | Final authoritative location | Status |
| --- | --- | --- |
| Workbook parsing | `excel_grading/excel_analyzer.py`, called by `aage/evaluators/spreadsheet.py` | Preserved as evidence source |
| Formula analysis | `formula_analyzer.py` + `RequirementEvaluator` | Preserved as evidence source; no independent score |
| VBA / Power Query / chart / pivot / formatting | Existing analyzers, invoked by the native specialist | Preserved as static evidence; never executed/refreshed |
| Rubrics | AAGE `Rubric` / `RubricVersion` / `rubric_intelligence.py` | Canonical; Excel rubric reads delegate |
| Scoring | `aage/scoring.py::compute_breakdown` | Canonical; no Excel total/grade/confidence copied |
| Pass/fail and progression | `aage/persistence.py` + existing LMS scoring/progress services | Canonical; no new thresholds |
| Feedback | AAGE orchestrator narrative + requirement evidence | Evidence-based and criterion-specific |
| Resubmission | Existing LMS resubmission + `_auto_request_modification_if_needed()` | Preserved through canonical write-through |
| Instructor review | `aage/review.py`, `aage/compatibility.py` | Canonical; original AI marks kept |
| Learning | `aage/learning.py` | Canonical; legacy Excel rows mapped as compatibility data |
| History | `EvaluationResult` / audit log; legacy `ExcelGradingResult` readable | One canonical store, historical rows preserved |
| Frontend | Existing grading pages, `GradingSubNavigation`, `UniversalAIGradingButton` | One workspace, three tabs, real API data |

## Final duplication register

| Capability | Resolution | Status |
| --- | --- | --- |
| Evaluation jobs | Every `assignment`/`project` enqueues AAGE; legacy Excel trigger flag ignored | Complete |
| Submission processing | Single dispatcher in `aage/submission_dispatch.py` | Complete |
| Score calculation | Excel analyzers produce marks/evidence; AAGE computes final score | Complete |
| Pass/fail decision | One canonical write-through using existing LMS thresholds | Complete |
| Evidence storage | Real artifact paths only; no synthetic `excel_category:*` references | Complete |
| Feedback generation | Shared AAGE narrative plus evidence-linked corrective detail | Complete |
| Instructor review | Legacy review delegates to AAGE review/correction/learning | Complete |
| Grade publication | `persistence.write_through_grade()` is the only publication path | Complete |
| Learning examples | Shared AAGE examples; no Excel-only learning store for new grades | Complete |
| Evaluator/version metadata | Carried in AAGE result/criteria/audit records | Complete |
| Navigation | One sidebar entry and three tabs | Complete |

The legacy `ExcelGradingService` / `GradingEngine` classes remain in the tree only for historical compatibility and analyzer reuse; no active route, submission hook, dispatcher or AAGE evaluator calls their scoring or publication methods.

---

## Workflows

### New or resubmitted assignment/project submission

1. Submission is saved through the existing Flask route.
2. `enqueue_for_submission()` always creates an AAGE `GradingJob`; `excel_grading_triggered=True` is ignored.
3. The orchestrator selects `spreadsheet` for workbook artifacts and other specialists for other artifact types.
4. The native specialist parses retained bytes with the existing analyzers, maps requirement observations to rubric criteria, returns bounded marks and real evidence, and never calls `ExcelGradingService.grade_submission()`, `_run_pipeline()`, `GradingEngine.grade()` or `finalize_excel_grade()`.
5. `compute_breakdown()` computes the official score; `write_through_grade()` publishes it when policy/gates allow.

### Pass / fail / progression

- Passed, evidenced AI grading may advance provisional progression without instructor approval under the existing publication policy; no new threshold was introduced.
- Failed grading produces specific requirement-level feedback with real evidence and creates a modification request through the existing helper. Resubmission clears the stale grade and starts a fresh AAGE job.
- Degraded/fallback results, unchanged-artifact regrades and lower automatic regrades cannot replace a published grade; explicit instructor approval can.

### Instructor correction

- Original AI score, criteria, feedback, evidence and versions remain unchanged in AAGE history.
- Corrections change criterion marks through `review.update_criterion_marks()`, recompute deterministically, require a reason/actor/time, and create an optional candidate learning example.
- Legacy whole-score overrides are distributed across frozen rubric marks through AAGE and mirrored to the historical Excel row for compatibility.

---

## Implementation phases

| Phase | Work | Acceptance outcome | Status |
| --- | --- | --- | --- |
| 1 | Audit existing Excel grading and progression | Complete system map | **Complete** |
| 2 | Identify duplicate functionality | Refactoring plan | **Complete** |
| 3 | Refactor Excel evaluator into a native AAGE specialist | Shared AAGE interface | **Complete** |
| 4 | Improve spreadsheet analysis | Analyzers preserved as evidence sources; namespaced static OOXML feature evidence with capability/limit reporting | **Complete** |
| 5 | Integrate shared rubrics and evidence | Unified evaluation, real artifact references only | **Complete** |
| 6 | Integrate score and pass/fail logic | One scorer, existing LMS thresholds | **Complete** |
| 7 | Improve feedback and resubmission | Evidence-based feedback and canonical modification requests | **Complete** |
| 8 | Integrate instructor review and learning | Shared review/correction/learning with preserved originals | **Complete** |
| 9 | Improve existing backend grading pages | Compatibility shims plus one AAGE dispatch path | **Complete** |
| 10 | Improve existing frontend grading pages | One Grading nav entry, three tabs, no fake data | **Complete** |
| 11 | Remove obsolete duplicate functionality | One active grading engine; legacy code unreachable from new grading paths | **Complete** |
| 12 | End-to-end and regression testing | Focused, full-backend, frontend and diff checks executed | **Complete** |

---

## Verification results (executed)

| Check | Command | Actual result |
| --- | --- | --- |
| Focused AAGE/Excel suite (after Excel knowledge fix) | `python3 -m pytest -q tests/test_aage_auto_approval.py tests/test_excel_aage_integration.py tests/test_aage_api.py tests/test_aage_pipeline.py tests/test_grading_stability.py tests/test_excel_static_knowledge_regression.py` | **81 passed** |
| Focused static OOXML suite | `python3 -m pytest -q tests/test_excel_static_knowledge_regression.py tests/test_assignment_intelligence.py tests/test_excel_aage_integration.py tests/test_aage_auto_approval.py tests/test_ooxml_static_features.py` | **64 passed** |
| Full backend suite, run alone (after static OOXML expansion) | `python3 -m pytest -q tests` | **580 passed, 13 failed, 1 skipped**. All 13 failures are pre-existing payment-slip OCR tests requiring the unavailable `pytesseract` module. |
| Native Excel/AAGE frontend contracts (after polling fix) | `npx --yes tsx --test tests/aage-service.test.ts tests/unified-grading.test.ts tests/grading-navigation.test.ts tests/aage-contracts.test.ts tests/file-upload-rules.test.ts tests/grading-fixes.test.ts` | **79 passed, 0 failed** (reconfirmed after the Excel knowledge fix) |
| Full frontend suite (after Excel knowledge fix) | `npx --yes tsx --test tests/*.test.ts` with Node 22 | **226 passed, 0 failed** |
| Syntax checks | `python3 -m py_compile` on changed AAGE/Excel modules | passed |
| Whitespace | `git diff --check` | clean |
| TypeScript | `npx --yes tsc --noEmit` with Node 22 | exits 2 on 157 pre-existing syntax errors confined to `EnhancedModificationDashboard.tsx` and `ai-agent/index-new.ts`; no touched grading file appeared in the errors |

Running pytest suites concurrently produced one order/environment-dependent `422` in a certificate/application test; each affected test passes in isolation and the sequential full run above has only the 13 OCR failures.

---

## Automatic student delivery fix

**Reported issue:** AI grading finished but no score or feedback reached students.

**Root cause:** Auto-approval treated spreadsheet-specific process signals
(`provisional rubric`, `hard gate: unverified_criteria`,
`hard gate: unverified_evidence`) as real failures. Native spreadsheet results
therefore stayed `pending_review` and were filtered out of the student-safe
result endpoint. A second issue was that the student page only loaded results
once, so a worker finishing after page load was never reflected.

**Fix (narrow):**
- `auto_approval.py` recognises deterministic specialists (`spreadsheet`) and
  ignores only those expected process signals when at least one non-UNVERIFIED
  artifact citation exists. Real failures still block publication: fallback or
  degraded providers, failed deterministic checks, evaluator conflicts, and
  absence of substantive artifact evidence.
- `StudentAageGradingResult.tsx` polls the published-result endpoint every 2s
  while a job is pending. Unofficial/draft rows remain hidden; only published
  results become visible.
- Added regressions for deterministic auto-approval, evidence requirement,
  degraded-result blocking, job publication mode, and the polling contract.

Re-checked the persisted rows against the live policy: results 11/13/14/15 now
have no blockers, while the genuinely degraded result 12 remains blocked with
`low_confidence`, `degraded_evaluation`, `failed_deterministic_gate` and
`unverified_evidence`. Existing `pending_review` rows created before this fix
can be re-graded; they will then follow the corrected auto-approval path. No
provisional score is exposed to students.

---

## Excel static-knowledge correction (2026-11-22)

**Reported issue:** `Excel_Coffee_Shop_Daily_Sales_Revised.xlsx` contained the
requested features but received `31.25%` / Grade F, with `Workbook structure`
and `Pivot tables & summaries` reported as 0%.

**Root causes:**
- The analyzer did not expose static style/format, freeze-pane, table,
  AutoFilter, width and styled-cell facts; real evidence was invisible to the
  rubric.
- The instruction parser scored markdown headings and UI/navigation hints as
  requirements, interpreted `e.g., E16` and `1 + 'Tax Rate'` as required cell
  values, and missed explicit sheet-rename instructions.
- `_criterion_bucket()` routed `structure` into the visualisation bucket.
- An incidental VBA archive (zero extractable modules) suppressed legitimate
  spreadsheet-automation evidence even though the brief did not request VBA.
- Submitted workbook bytes were not recognised as the declared `spreadsheet`
  deliverable.
- A tax value moved from the example `H1` to `J1` by an inserted column was
  scored as a partial miss instead of being matched to its label.

**Fix:** real static facts were added to `excel_analyzer.py`; procedural text,
example locations and markdown headings are filtered in
`assignment_intelligence.py`; sheet renames and shifted labelled values are
matched from evidence; `spreadsheet.py` maps structure before visualisation,
adds additive workbook-feature observations, and only treats VBA/Power Query
as required when the brief requires it; `artifacts.py` counts workbook bytes
as the spreadsheet deliverable. `backend/tests/test_excel_static_knowledge_regression.py`
locks in these behaviours with the supplied workbook and exact issue criteria.

**Verified reproduction:** 35/35 requirements satisfied, 0 partial, 0 failed,
0 critical failures, no manual review; all seven rubric criteria scored full
marks. Feedback now names real evidence instead of the old `e.g., E16`,
`totalsales`, and `Requested VBA construct was not confirmed` strings.

**Live correction:** assignment submission 13 was re-graded through AAGE
(result 19, 100/100). Because automatic publication must not silently change
an unchanged submission, the corrected result was published through the
existing explicit instructor-review path (`publication_mode=manual`, actor 3,
review 19, retained audit trail). The submission grade, lesson 66 completion
and module progression were updated, the old low-score modification request
was cleared, and the duplicate draft created by a concurrent worker was
superseded. Result 18 and all prior history remain readable.

---

## Static OOXML feature coverage expansion (2026-11-22)

Added `backend/src/services/excel_grading/ooxml_feature_analyzer.py` as a pure
OPC/XML inspector. It produces `workbook.ooxml_features` with a `scan` block and
27 namespaced feature records. Each record uses `PRESENT`, `CONFIGURED`,
`ABSENT` or `UNVERIFIABLE`, bounded evidence/part samples and a limitation
string. Legacy analyzer keys remain unchanged; `activex_count` and
`form_control_count` are now derived from the namespaced evidence.

| Feature group | Static evidence recorded | Not inferred / not executed |
| --- | --- | --- |
| Names and print setup | defined names, print titles/areas, page/header/footer metadata | name formulas, printed pages |
| Interactive analysis | slicers, timelines, sparklines, PivotTable/cache parts, saved sort/filter state | cache refresh, slicer/filter interaction, rendered sparklines |
| Charts and presentation | chart parts, table styles, conditional-format rule types | rendered charts, visual outcome of rules |
| Data connectivity | external-link parts, connections, query tables, DataMashup/Power Query markers | connection opening, query refresh, external target access |
| Data model / DAX | model/customData/item.data parts, readable DAX tokens or explicit UNVERIFIABLE | VertiPaq/SSAS internals, DAX evaluation |
| Collaboration and annotations | classic comments, threaded comments/persons, hyperlinks | comment rendering, link following |
| Workbook controls / protection | form controls, ActiveX parts, embedded objects, workbook/sheet/protected-range metadata | control instantiation, OLE payloads, passwords/permissions |
| Structure and metadata | scenarios, document properties, advanced formula metadata | Solver/Goal Seek results, formula recalculation |

`assignment_intelligence.py` now parses requested feature phrases into
`OOXML_FEATURE_REQUIREMENT` contracts and scores them only from the matching
static record. Unreadable packages become `MANUAL_REVIEW`, never a fabricated
pass or a definite fail. `spreadsheet.py` adds only `PRESENT`/`CONFIGURED`
records as additive generic-rubric observations, maps feature labels to formula,
pivot, validation, automation, visualisation, documentation or structure buckets,
and keeps assignment-specific failures authoritative.

Safety: OPC parts are read as bytes only; XML is parsed with `ElementTree` after
DOCTYPE rejection; reads are capped at 4 MB per part and 200 MB decompressed;
samples are bounded; no formula, macro, query, pivot cache, external link,
control or embedded object is opened or executed.

Regression coverage: `backend/tests/test_ooxml_static_features.py` builds a
synthetic workbook by rewriting OPC parts as data and verifies all 27 markers,
requested-feature scoring, absent-versus-unverifiable behaviour, and generic
criterion mapping. `test_excel_static_knowledge_regression.py` still confirms
the Coffee Shop workbook remains at full marks.

---

## Deployment and rollback

- Deploy the existing Flask app and worker together. The AAGE migration `a7a8e1c3f5b2` is additive/idempotent; no new service or database is introduced.
- Keep the existing `ExcelGradingResult` table for historical reads. New grading writes only AAGE rows plus the canonical submission grade.
- Rollback is a code deploy to the previous revision. No new schema must be dropped to stop AAGE; existing AAGE rows remain inert if the previous code path is restored. Restoring the old two-engine dispatcher would reintroduce duplicate grading and is **not** recommended.

## Limitations

- Formulas, macros, Power Query, pivots, controls and embedded objects are inspected as text/package markers; their results are never executed or refreshed.
- Some runtime outcomes are deliberately unverifiable from a static workbook: recalculated formula values, query refresh success, VBA behaviour, PivotTable cache freshness, interactive slicer/filter/control state, Goal Seek/Solver outcomes, printed rendering and visual fidelity. These are reported as limitations or `UNVERIFIABLE`, not guessed.
- Browser/E2E interaction tests are absent (no React Testing Library); validation is API/contract/static only.
- The legacy Excel engine code is retained but unreachable from new grading paths; deleting it entirely is a separate cleanup.

## Change log

- Created tracker before modifications; recorded Phase 1/2 audit and duplication plan.
- Replaced the delegated spreadsheet evaluator with a native AAGE evidence-source evaluator.
- Centralised scoring, grade letters and confidence helpers in `aage/scoring.py`.
- Made all submission triggers enqueue AAGE; removed engine fallback and ownership suppression.
- Converted legacy Excel endpoints to AAGE compatibility shims; preserved historical result reads and review mapping.
- Restored canonical resubmission, progression and learning hooks in the AAGE write-through path.
- Consolidated frontend navigation and AI entry points; fixed routing, pagination and result/evidence projection defects.
- Updated all phase statuses to complete and recorded executed verification results.
- Fixed automatic student score/feedback delivery: deterministic spreadsheet results with real artifact evidence now self-approve despite provisional rubric/UNVERIFIED absence evidence; student result page polls while grading is pending.
- Fixed Coffee Shop workbook false negatives with static workbook facts, parser/evaluator corrections, criterion mapping and workbook regression tests; re-graded submission 13 to 100/100 through the audited manual-review path.
- Expanded static Excel knowledge with a namespaced OOXML/OPC analyzer covering 27 feature families, conservative requirement scoring, generic rubric observations and absent/unverifiable regressions.
