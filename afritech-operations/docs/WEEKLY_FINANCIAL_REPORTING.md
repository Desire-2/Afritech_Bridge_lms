# Weekly Service Agent Financial Report & Money Submission System

This document describes the weekly reconciliation workflow that lives inside the
existing Operations app. It is **not** a separate application or a duplicate
dashboard: the Service Agent workspace, Manager/Accountant review queue and PDF/
Excel exports all read the same backend-authoritative weekly report.

## 1. Scope and source of truth

The report never invents financial data. Every amount is recomputed from the
existing operational records:

| Source | Used for |
| --- | --- |
| `ServiceTransaction` + `Payment` | eligible collections, service costs, payment status, commission snapshot |
| `DailyClosing` | per-day declared cash, status, comments, missing-closing detection |
| `Expense` | approved/paid, collection-funded expenses only |
| `CommissionRule` snapshots on transactions | commission earned (displayed separately) |
| prior approved `WeeklyReport` | opening outstanding / carry-forward |
| `WeeklyReportAdjustment` | authorised receipts, provider payments, refunds, outflows, retained commission, outstanding corrections/waivers |
| `MoMoSubmission` | agent-reported and reviewer-verified money transfers |
| `OfficialCostPayment` | claims that an official cost was personally paid by the agent from her own MoMo/phone |

`triage_daily_totals()` from `app/routes/closings.py` is reused for daily
transaction/collection/cost arithmetic so the weekly report and daily-closing
screen cannot diverge.

Transactions are eligible only when their status is in
`weekly_reporting.eligible_transaction_statuses` (default `completed`), not in
the ineligible list (`cancelled`, `failed`, `refunded`, `reversed`, `unpaid`,
`pending_payment`), and have a real payment (`paid` or `partially_paid`).

## 2. Week, deadline and late policy

All date logic is centralised in `app/services/weekly_policy.py`; no route or
service computes a week boundary inline. The legal period is fixed to
**Sunday 00:00:00 through Saturday 23:59:59.999 in `Africa/Kigali`**. The
`week_start_weekday`, `week_end_weekday` and `submission_weekday` settings are
read for backwards compatibility but forced by the service to `6` (Sunday),
`5` (Saturday) and `6` (Sunday after the close), so a stale settings row cannot
move the period back to the old Saturday–Friday rule.

| Setting | Effective value | Meaning |
| --- | --- | --- |
| `week_start_weekday` | `6` (Sunday) | Fixed reporting week start |
| `week_end_weekday` | `5` (Saturday) | Fixed reporting week end |
| `submission_weekday` | `6` (Sunday) | Fixed submission/generation day after the close |
| `deadline_time` | `17:00` | Local deadline time on the Sunday after the week closes |
| `timezone` | `Africa/Kigali` | Business timezone; falls back to global `timezone` setting |
| `late_policy` | `allow_flagged` | `allow_flagged` or `block` |
| `allow_override` | `true` | Whether shortage/missing-closing overrides are accepted |
| `deduct_verified_service_costs` | `true` | Verified agent-funded service costs reduce remittance |
| `commission_retained` | `false` | Commission reduces cash due only when explicitly configured |
| `collection_funded_payment_methods` | `cash` | Expense payment methods that reduce remittance |
| `eligible_transaction_statuses` | `completed` | Transaction statuses that count |
| `ineligible_transaction_statuses` | see above | Hard exclusions |
| `shortage_requires_evidence` | `true` | Legacy policy flag kept for compatibility; the guided task accepts an explained shortage without evidence and treats evidence as optional |
| `statement_items` | `21` | Number of statement lines in exports |

`require_week_start()` still rejects a stored report whose `week_start` is not a
Sunday. Report *generation* accepts any reference date through
`normalize_week_start()`: Monday–Friday resolves to the Sunday beginning that
week, and a legacy Saturday start moves to the following Sunday so the same
working days stay in scope. Generated rows always store Sunday/Saturday
boundaries. `week_window()` and `in_week()` are the only boundary helpers used
by services and schedulers. The deadline is stored as an aware UTC `due_at` on each report
while the report keeps its business `timezone_name`. A scheduler run on Sunday
creates and reminds for the **completed** Sunday–Saturday week, not the week that
has just begun. Historical weeks are available through
`GET /api/weekly-reports/weeks` (current, previous and 11 older weeks by default).
Service Agents land directly in the guided task: `POST /agent-summary` accepts
`weekly_reports.submit`, ignores any supplied `employee_id`, idempotently
prepares the caller's draft through the same normalisation as `POST /generate`,
and returns everything the page needs in one response. `POST /generate` still
accepts `weekly_reports.submit` for compatibility and also forces the target
employee to the caller's own row.

## 3. Reconciliation formula

Implemented in `WeeklyReportService.build_calculation()` and mirrored for locked
reports by `apply_overlays()`:

```
expected remittance
  = opening outstanding brought forward
  + eligible customer collections
  + authorised receipts
  - verified service/provider payments
  - approved collection-funded expenses
  - authorised refunds
  - other approved cash outflows
  - commission retained (only when configured)
```

Important rules:

- `commission_earned` is always calculated as the existing 20% × gross profit
  rule and displayed separately. It is **not** cash due unless
  `commission_retained` is explicitly enabled.
- Official service costs are always shown in full. A cost reduces remittance
  when either (a) a dedicated `OfficialCostPayment` claim says the agent paid
  it from her own MoMo/phone **and** a reviewer marks that manual claim
  `verified`, or (b) the guided "I paid using my own money" answer records an
  `auto_personal` claim for the full cost. An `auto_personal` claim is deducted
  immediately while it remains `pending`, and approval of the weekly report is
  its final confirmation. Customer payment status is never evidence of this:
  `paid`, `partially_paid` and unpaid costs all contribute zero without a
  qualifying personal claim. Company-paid, other-source and rejected claims
  contribute zero. Manual partial payments deduct only the verified amount;
  guided own-funds answers always use the full official cost. Land Document
  transactions are an automatic exception: their Service label marks them as
  AfriTech Bridge-funded, their payer is confirmed as `company` without agent
  input, and no personal claim can deduct them.
  An audited `provider_payment` adjustment remains a separate, explicit way to
  record other provider payments.
- Only `approved`/`paid` expenses whose payment method is collection-funded are
  deducted. Each expense is linked once through `WeeklyReportExpense`; the
  unique constraint `uq_weekly_expense_once` prevents double deduction in
  another report.
- `agent_reported_submitted` is the sum of all MoMo/bank/deposit submissions.
  `verified_submitted` counts only transfers a reviewer marked `verified`.
- `shortage = max(0, expected - verified_submitted)`;
  `surplus = max(0, verified_submitted - expected)`.
- `closing_outstanding = max(0, expected - verified_submitted + net waiver /
  correction allocations)`. The opening balance is already inside `expected`,
  so it is never added twice.

The frozen submission stores both the full payload (`snapshot`) and the active
overlay (`calculation`). Source collection/cost facts stay frozen; reviewer
verification, rejection notes, MoMo verification, official-cost claims and
adjustments are reapplied to the snapshot base exactly once. The separate
`pre_personal_cost_expected` component preserves the source base so a cost claim
verified after submission can change the expected remittance without rewriting
the frozen source rows or silently re-approving the report. An adjustment's
`original_amount → adjusted_amount` is treated as a **delta**, never as a second
absolute amount added on top of a source total. `GET /{id}` and both export
formats are read-only: they derive the response from the snapshot plus current
overlays without writing the recalculated values back to the database.

## 4. Daily closings, expenses and shortage declarations

`GET /api/weekly-reports/{id}/daily-closings` returns one row per calendar day in
the week with transaction count, collections, service costs, expected/actual
cash, difference, status, date and comments. A missing closing has
`closing_id: null`, `status: "missing"` and `null` cash values — it is **not**
represented as a zero-value closing. A reviewer with `weekly_reports.adjust` may
acknowledge missing closings with a recorded reason.

The guided task compares the agent's declared amount with the authoritative
expected amount immediately. An exact match needs no explanation. A lower
amount (including zero) needs one of the six plain-language reasons
(`customer_not_paid`, `service_issue`, `payment_problem`, `money_unavailable`,
`incorrect_record`, `other`) and a brief `shortage_explanation`; a higher amount
needs `surplus_explanation`. Evidence and an expected resolution date may still
be attached, but no longer block an honest, explained shortage. The older
accounting categories remain valid for historical reports and exports. An
unexplained shortage is accepted only with an authorised override reason and
`weekly_reports.adjust` permission. Evidence must be PDF/PNG/JPG/JPEG/WEBP and
at most 10 MB; it is stored under `/uploads/weekly_reports/{report_id}/` only
after the rest of the declaration passes validation, so a rejected submission
cannot leave an orphan file. A client-supplied MoMo `submitted_at` must fall
inside the reported week or before its stored deadline; short phone numbers are
masked down to the last three digits (or completely when three digits or fewer)
in every serialized response.

### 4.1 Official cost personal-payment claims

An `OfficialCostPayment` is a separate claim record; it is never written into a
customer `Payment` row and never into a report-level `MoMoSubmission`. The
Service Agent submits one claim per in-week service transaction through
`POST /{id}/official-cost-payments` while the report is editable. Each claim
captures:

- the source customer payment status (informational only), official cost and
  transaction link;
- `payment_source` — `personal` (I paid using my own money), `company`
  (AfriTech Bridge paid), `someone_else` or `not_paid`. This is additive: the
  legacy `personal_payment` boolean is still derived from it and controls
  deduction; a non-personal answer stores zero deductible amount and no
  evidence;
- when yes: the amount personally paid (`0 < amount ≤ official_cost`),
  `is_partial`, provider (`momo`, `bank_transfer`, `cash_deposit`), reference,
  payment date/time within the Sunday–Saturday window, sender phone, evidence
  file and notes;
- when the source is not personal: a zero-amount audit record with no evidence
  requirement and no possible deduction. For a Land Document transaction the
  `company` source is filled in automatically and cannot be changed to a
  personal claim;
- reviewer `pending`/`verified`/`rejected` status, verifier, timestamp and note.

Evidence is mandatory for a personal claim and is validated for type/size by the
existing upload helper. The raw sender phone is never serialized: responses
contain only a masked value. A unique `(report_id, transaction_id)` constraint
prevents two claims for one cost, and a unique
`provider:reference:sender` `reference_key` prevents the same transfer being
reused. Claims can be deleted only while editable; the evidence download route
is audited and respects report ownership/branch scope.

After submission, a reviewer uses `POST /{id}/review` with
`verify_cost_payment` or `reject_cost_payment`. A rejection needs a reason, and
a negative personal-payment answer cannot be verified for deduction. Both
decisions write audit rows and notify the agent; submission notifies reviewers.

### 4.2 Service Agent submission card

Service Agents do not have `weekly_reports.manage`. Their `/finance/weekly-reports`
page is a single guided task with three stacked sections and no report queue:

1. **Your week at a glance** — `POST /agent-summary` has already prepared the
   draft and returns the authoritative expected amount, period, deadline and
   status. `[View details]` opens an optional modal that explains the collections,
   opening balance, official costs and verified/pending credits. It never
   recalculates money in the browser.
2. **Confirm official cost payers** — each in-week cost that still needs an
   answer is listed with its known source preselected. The agent chooses
   `personal`, `company`, `someone_else` or `not_paid`. Choosing `personal`
   immediately records an `auto_personal` claim for the full official cost:
   the amount, date, reference and sender phone are taken from the transaction
   and the employee profile, so no extra fields or evidence are requested. The
   full cost is deducted from the expected amount straight away and is labelled
   "Applied — confirmed at approval"; approving the weekly report changes the
   claim to `verified`. Manual personal claims still deduct only after a
   reviewer verifies them, and their pending claims deduct nothing. Transactions
   whose Service is a **Land Document** (including "Land Document Apply") are confirmed
   automatically as `company`: AfriTech Bridge pays that official cost, so the
   row is omitted from this work list, no evidence is requested and no amount is
   deducted. Their total still appears in the company-paid summary chip. The
   same rule is enforced on every calculation, overlay and export, even if an
   older verified personal claim exists on the transaction.
3. **Declare and submit** — the agent enters an RWF amount, sees the immediate
   match/short/surplus hint, answers the conditional question, optionally adds
   one or more transfers, reviews the short summary and submits. The declared
   amount, the evidence-backed `agent_reported_submitted` total and the
   reviewer-verified `verified_submitted` total are displayed separately.

`declared_submitted_amount` and `submission_funding_source` are editable through
`PATCH /{id}` and accepted by `POST /{id}/submit`; they are frozen with the
snapshot once the report is submitted. They are a declaration only: selecting
`agent_phone` never clears a shortage by itself, and unverified MoMo rows never
replace `verified_submitted`. Reviewers, Managers and Accountants keep the full
nine-tab `ReportDashboard` and the `/finance/weekly-reports/review` route.

## 5. Workflow and state machine

States: `draft`, `ready_for_submission`, `submitted`,
`under_financial_review`, `returned_for_correction`, `approved`, `rejected`,
`late`.

Backend-enforced transitions are declared in `WEEKLY_REPORT_TRANSITIONS`. Every
transition writes an `AuditLog` row with actor, previous/new value, reason,
timestamp, IP and user agent. Submission locks the source snapshot, increments
`current_version`, and links the expenses used. A returned report can be edited
and resubmitted, creating another audited version.

Review actions (`POST /api/weekly-reports/{id}/review`):

- `verify_momo` / `reject_momo` — moves `submitted` to `under_financial_review`,
  records verifier, note and timestamp; only verified transfers count as money
  submitted.
- `verify_cost_payment` / `reject_cost_payment` — records verifier, note and
  timestamp for a manual official-cost claim. Verified manual claims reduce
  expected remittance; rejection requires a reason and removes any credit.
  Guided `auto_personal` claims are already credited and can be rejected here,
  but do not need early verification.
- `request_correction` — returns the report with a mandatory reason.
- `approve` — confirms pending guided `auto_personal` claims, computes the final
  carry-forward and writes the approval audit. Their amount is unchanged
  because it was already deducted when the agent answered.
- `reject` — requires a reason.

Adjustments (`POST /api/weekly-reports/{id}/adjustments`) always store kind,
label, original amount, adjusted amount, reason, actor and timestamp.
`outstanding_correction` / `outstanding_waiver` also create immutable
`OutstandingAllocation` rows with unique reference keys, so a balance cannot be
carried twice.

## 6. Permissions and Company Secretary isolation

New restricted permission family (never granted to `company_secretary`):

| Permission | Service Agent | Manager | Accountant | Super Admin |
| --- | ---: | ---: | ---: | ---: |
| `weekly_reports.view` | ✓ | ✓ | ✓ | ✓ |
| `weekly_reports.submit` | ✓ | — | — | ✓ |
| `weekly_reports.review` | — | ✓ | ✓ | ✓ |
| `weekly_reports.adjust` | — | ✓ | ✓ | ✓ |
| `weekly_reports.export` | ✓ | ✓ | ✓ | ✓ |
| `weekly_reports.manage` | — | ✓ | — | ✓ |

- Service Agents see only their own reports; every detail/update/submit/MoMo/
  official-cost route rechecks ownership server-side. Only the report owner may
  add or delete a cost claim; reviewers may read claims and evidence and decide
  verification.
- Managers are branch-scoped on lists, queue, detail, generation, overrides and
  reviewer notifications; a Manager in another branch is not told about the
  report (including its shortage amount). Accountants and Super Admins are
  system-wide.
- Accountants have review/adjust/export access but no manage permission.
- Super Admin is system-wide.
- Company Secretary gets `403` on navigation, direct URLs, APIs, exports,
  search and audit endpoints, and receives no weekly notification: all weekly
  notification types are gated by `TYPE_PERMISSIONS`, and `weekly_report` is an
  agent-scoped related type.
- Override endpoints refuse locked reports with `409`; a correction must be
  requested before an override can be recorded.

## 7. API surface

Base path: `/api/weekly-reports`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/policy` | Effective policy, statuses, categories, providers, languages, current week |
| GET | `/weeks` | Available current/previous/historical weeks with counts |
| GET | `/queue` | Manager/Accountant review queue |
| GET | `""` | Permission/branch/agent-scoped list (reviewer workspace only) |
| POST | `/agent-summary` | Service Agent's one-call guided landing: self-scoped draft + `summary`/`policy`/`constants`/`weeks` |
| POST | `/generate` | Idempotent generation: admin/manager for any in-scope agent; Service Agent for herself only |
| GET | `/{id}` | Report, calculation, submissions, adjustments, allocations, transitions |
| PATCH | `/{id}` | Save editable declaration fields, including weekly submitted amount and funding source |
| POST | `/{id}/submit` | Submit/resubmit (JSON or multipart with evidence and submission declaration) |
| GET | `/{id}/transactions` | Filtered, paginated underlying transactions |
| GET | `/{id}/daily-closings` | Per-day rows, missing list, override |
| GET | `/{id}/expenses` | Eligible expense rows |
| GET | `/{id}/official-cost-payments` | Claim list with verified total |
| POST | `/{id}/official-cost-payments` | Record an official-cost payer (`payment_source`); personal source additionally requires amount, reference, sender phone and evidence |
| DELETE | `/{id}/official-cost-payments/{claim_id}` | Remove a claim while editable |
| GET | `/{id}/official-cost-payments/{claim_id}/evidence` | Download claim evidence (audited) |
| POST | `/{id}/momo` | Add transfer with optional evidence |
| DELETE | `/{id}/momo/{submission_id}` | Remove transfer while editable |
| GET | `/{id}/evidence` | Download shortage evidence (audited) |
| POST | `/{id}/override` | Authorise unexplained shortage |
| POST | `/{id}/missing-closings/override` | Acknowledge missing closings |
| POST | `/{id}/review` | Verify/reject/return/approve/reject |
| POST | `/{id}/adjustments` | Audited adjustment + allocation |
| GET | `/{id}/audit` | Report, MoMo, official-cost claim and adjustment audit history |
| GET | `/{id}/export?format=pdf\|xlsx&lang=en\|rw` | Bilingual export |

Validation errors are additive to the standard `{error, code}` response:
`field` names the exact input (`declared_submitted_amount`, `reference`,
`submission_funding_source`, …) and `details.transaction_id` identifies a cost
row. The guided agent flow uses these to render an inline message, scroll to the
control and move focus there, with a focusable summary as a fallback when the
named control is not currently mounted. No error payload changes persisted
report data or workflow state.

## 8. Exports

`app/services/weekly_exports.py` renders the 21 statement items from the same
locked `calculation` used on screen:

1. Reporting period and agent identity
2. Opening outstanding balance brought forward
3. Eligible transaction count
4. Customer collections from eligible transactions
5. Official service costs with customer payment status, cost payer source and personal-cost claim status
6. Authorized receipts during the week
7. Verified agent-funded service/provider payments (verified personal claims only)
8. Approved collection-funded expenses
9. Authorized refunds
10. Other approved cash outflows
11. Commission retained (only if configured)
12. Expected remittance / expected submission
13. Agent-reported MoMo/bank submissions with declared weekly amount and funding source
14. Reviewer-verified money submissions
15. Shortage amount
16. Surplus amount
17. Shortage reason, evidence and resolution date
18. Commission earned (20% of gross profit, shown separately)
19. Daily closing coverage and missing-closing overrides
20. Outstanding balance carried forward with allocation history
21. Workflow state, approvals, adjustments and audit trail

Both PDF and XLSX also include an official-cost detail table with the source
customer status, personal-payment answer, verified amount, provider, reference,
payment date/time, evidence name and reviewer note. Land Document rows show
"AfriTech Bridge paid (automatic)" and a zero deductible amount regardless of
any legacy claim. Only the verified deductible amount is treated as money;
user-authored text is XML/PDF escaped.

`lang=en|rw` translates report headers, statement labels, statuses and table
headings. User-authored text is copied verbatim and never translated.

## 9. Notifications and scheduler

Weekly notification types are registered in `app/services/notifications.py`
with severity, UI label and permission gate: generated, due, late, submitted,
submission acknowledgement, returned, approved, rejected, shortage, MoMo
verified, cost-payment submitted, cost-payment verified and override requested.
The two cost-payment events are permission-gated like every other weekly event,
so Company Secretary never receives claim amounts or references. Where a user
locale is not stored, messages are sent in both English and Kinyarwanda
(`weekly_i18n.bilingual()`).

`app/services/automation.py` adds three rules:

- `weekly_report_generation_alert` — idempotently creates one report per service
  agent on the Sunday submission day for the **completed** Sunday–Saturday week.
- `weekly_report_due_alert` — reminds agents for that same completed week before
  the Sunday 17:00 deadline.
- `weekly_report_late_alert` — transitions overdue drafts to `late` through the
  audited workflow and notifies the agent and reviewers.

Manual generation uses the same service, so scheduler and admin actions are
identical and duplicate-safe.

## 10. Internationalisation

`app/services/weekly_i18n.py` is the structured label catalogue for English and
Kinyarwanda. The frontend uses matching keys in `frontend/lib/weekly-i18n.tsx`
with a persistent `[ EN ] [ RW ]` switcher. Switching language only changes
system labels; form data and user-entered text remain untouched.

The Service Agent dashboard links directly to the latest weekly report. The
`?report=<id>&tab=shortage` deep link is mapped to section 3 of the guided task;
`POST /agent-summary` accepts that id only when it belongs to the caller and
returns the week boundaries from the backend. The browser never derives a
reporting week or recalculates a money figure. The `[ EN ] [ RW ]` switcher uses
an external store, so unsaved form values and selected `File` objects survive a
language change. All six agent reasons, the comparison hints, validation errors,
notifications, success screen and exports are available in both languages.

## 11. Persistence and migration

Migration `f7c9a4d2e8b1` (`down_revision = a1c9d47e52f6`) is additive:

- creates `weekly_reports`, `weekly_momo_submissions`,
  `weekly_report_adjustments`, `weekly_report_expenses`,
  `weekly_outstanding_allocations`;
- adds unique constraints for one report per agent/week, unique MoMo reference,
  one expense deduction per week and unique allocation reference keys;
- adds indexes for status/week, branch/week, MoMo status and employee allocation
  history;
- adds nullable `audit_logs.reason`;
- insert-only seeds the six `weekly_reports.*` permission rows and the role links
  for Service Agent, Manager, Accountant and Super Admin. `company_secretary`
  is deliberately absent; re-running the seed is a no-op, and downgrade removes
  only this weekly family and its links.

Migration `c2f8a7d41b90` (`down_revision = f7c9a4d2e8b1`) adds the
`weekly_official_cost_payments` table and its unique/reference indexes, forces
the Sunday–Saturday settings, and repairs **only editable** periods: a legacy
Saturday start moves to the following Sunday so the same working days stay in
scope, its deadline moves to Sunday 17:00, and its cached calculation is cleared
for recalculation. Already-submitted and approved reports keep their frozen
periods, calculations and snapshots. Every repair writes an audit row. Downgrade
drops only the claim table and its indexes.

Migration `a9d4e7f16c20` (`down_revision = c2f8a7d41b90`) adds the
`weekly_reports.declared_submitted_amount` and `submission_funding_source`
columns with defaults (`0` and `agent_phone`). It is additive: existing reports
keep their submission snapshots and verified totals, and downgrade drops only
these two columns.

Migration `b7e3c9a1d452` (`down_revision = a9d4e7f16c20`) adds
`weekly_official_cost_payments.payment_source` with a `not_paid` default and an
index. Verified legacy personal claims are labelled `personal` so their
deduction is preserved; all older non-personal answers become `not_paid` because
the former boolean could not distinguish company, another payer and unpaid.
Existing snapshots are untouched, and downgrade drops only this column and its
index.

Migration `c4d7e1a9b263` (`down_revision = b7e3c9a1d452`) adds
`weekly_official_cost_payments.auto_personal` with a `false` default. It is
additive: historical claims stay `false`, so approved reports and frozen
snapshots do not change meaning retroactively. Downgrade drops only this
column. Deployment must apply `c2f8a7d41b90`, `a9d4e7f16c20`, `b7e3c9a1d452`
and `c4d7e1a9b263` in order.

No existing table or row is dropped during upgrade; historical snapshots are
never silently rewritten.

## 12. Verification

Recommended checks:

```bash
cd backend
venv/bin/python -m pytest -q tests/test_weekly_reports.py \
  tests/test_weekly_permissions_migration.py
venv/bin/python -m pytest -q tests
venv/bin/python -m compileall -q app \
  migrations/versions/f7c9a4d2e8b1_weekly_financial_reports.py \
  migrations/versions/c2f8a7d41b90_sunday_week_and_personal_cost_payments.py \
  migrations/versions/a9d4e7f16c20_weekly_submission_declaration.py \
  migrations/versions/b7e3c9a1d452_official_cost_payment_sources.py \
  migrations/versions/c4d7e1a9b263_persist_guided_own_funds_answers.py
FLASK_CONFIG=development DATABASE_URL=sqlite:////tmp/weekly_migration_check.db \
  venv/bin/flask --app app db upgrade
FLASK_CONFIG=development DATABASE_URL=sqlite:////tmp/weekly_migration_check.db \
  venv/bin/flask --app app db downgrade f7c9a4d2e8b1
FLASK_CONFIG=development DATABASE_URL=sqlite:////tmp/weekly_migration_check.db \
  venv/bin/flask --app app db upgrade c2f8a7d41b90
FLASK_CONFIG=development DATABASE_URL=sqlite:////tmp/weekly_migration_check.db \
  venv/bin/flask --app app db upgrade a9d4e7f16c20
FLASK_CONFIG=development DATABASE_URL=sqlite:////tmp/weekly_migration_check.db \
  venv/bin/flask --app app db upgrade b7e3c9a1d452
FLASK_CONFIG=development DATABASE_URL=sqlite:////tmp/weekly_migration_check.db \
  venv/bin/flask --app app db upgrade c4d7e1a9b263
cd ../frontend && npm run build && npx tsc --noEmit
```

The focused weekly test module covers generation idempotency, calculation
sources, daily closings, expense de-duplication, MoMo verification, workflow and
auditing, RBAC/Company Secretary denial, notifications, bilingual exports and
the review fixes (PDF escaping, savepoint-safe generation, branch-scoped
reviewer alerts, locked-report overrides, evidence orphan prevention, deleted
transfer overlays, read-only GETs, delta adjustments, MoMo date validation and
all 21 bilingual rows in both PDF and XLSX exports). It also proves the
Sunday–Saturday boundaries/deadline helper, the scheduler's completed-week
selection, that manual verified own-funds claims (including partial amounts)
reduce remittance while guided auto claims deduct the full cost immediately and
are confirmed on approval, duplicate and evidence validation, bilingual export of the
claim/reference/provider/date/evidence/reviewer fields with masked phone
numbers, a Land Document cost being confirmed as company-paid automatically
with no deduction in calculations, summaries, locked overlays or exports, a
continuous generate → claim → submit → verify cost → verify MoMo
→ approve → export flow that preserves the approved snapshot and audit trail, and
a guided own-funds flow that deducts before submission and confirms on approval
without changing the expected amount. It also proves the Service Agent can
generate only her own report, that the weekly
submitted-amount/funding-source declaration saves, validates, submits and freezes
with the snapshot, and that these declaration fields never replace verified
transfer totals. The guided-flow tests prove the one-call `/agent-summary`
contract and its self-scope, plain-language cost sources with no deduction for
company/other/unpaid answers, verified personal credits reducing expected
amount while manual pending credits stay visible and auto own-funds credits are
applied immediately, exact/less/zero/more declarations,
required vs optional explanations, frozen submitted amounts and cost answers,
Company Secretary/Accountant denial, and bilingual reasons and errors.
`tests/test_weekly_permissions_migration.py` proves an existing installation
gains the restricted permission family, repairs only draft/deadline periods and
preserves submitted/approved snapshots on upgrade, and loses only the weekly
permission family and claim table on downgrade. It also proves the new cost
source revision follows the declaration revision, maps legacy verified personal
claims to `personal` and downgrades cleanly.
