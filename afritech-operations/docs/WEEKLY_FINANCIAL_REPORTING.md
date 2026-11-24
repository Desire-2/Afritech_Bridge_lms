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

`triage_daily_totals()` from `app/routes/closings.py` is reused for daily
transaction/collection/cost arithmetic so the weekly report and daily-closing
screen cannot diverge.

Transactions are eligible only when their status is in
`weekly_reporting.eligible_transaction_statuses` (default `completed`), not in
the ineligible list (`cancelled`, `failed`, `refunded`, `reversed`, `unpaid`,
`pending_payment`), and have a real payment (`paid` or `partially_paid`).

## 2. Week, deadline and late policy

All date logic is centralised in `app/services/weekly_policy.py`; no route or
service computes a week boundary inline.

Default settings (overridable through the `settings` table with the
`weekly_reporting.` prefix):

| Setting | Default | Meaning |
| --- | --- | --- |
| `week_start_weekday` | `5` (Saturday) | Reporting week start |
| `week_end_weekday` | `4` (Friday) | Reporting week end |
| `submission_weekday` | `5` | Deadline day after week end |
| `deadline_time` | `17:00` | Local deadline time |
| `timezone` | `Africa/Kigali` | Business timezone; falls back to global `timezone` setting |
| `late_policy` | `allow_flagged` | `allow_flagged` or `block` |
| `allow_override` | `true` | Whether shortage/missing-closing overrides are accepted |
| `deduct_verified_service_costs` | `true` | Fully paid service costs reduce remittance |
| `commission_retained` | `false` | Commission reduces cash due only when explicitly configured |
| `collection_funded_payment_methods` | `cash` | Expense payment methods that reduce remittance |
| `eligible_transaction_statuses` | `completed` | Transaction statuses that count |
| `ineligible_transaction_statuses` | see above | Hard exclusions |
| `shortage_requires_evidence` | `true` | Evidence mandatory for explained shortages |
| `statement_items` | `21` | Number of statement lines in exports |

The deadline is stored as an aware UTC `due_at` on each report while the report
keeps its business `timezone_name`. Historical weeks are available through
`GET /api/weekly-reports/weeks` (current, previous and 11 older weeks by default).

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
- Service costs are shown with payment status. They are deducted as verified
  provider payments only when fully paid and `deduct_verified_service_costs`
  is enabled; an audited `provider_payment` adjustment can add others.
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
overlay (`calculation`). Reviewer verification and adjustments are reapplied to
the snapshot base exactly once, so source-table edits after submission cannot
silently rewrite a locked report. An adjustment's `original_amount →
adjusted_amount` is treated as a **delta**, never as a second absolute amount
added on top of a source total. `GET /{id}` and both export formats are
read-only: they derive the response from the snapshot plus current overlays
without writing the recalculated values back to the database.

## 4. Daily closings, expenses and shortage declarations

`GET /api/weekly-reports/{id}/daily-closings` returns one row per calendar day in
the week with transaction count, collections, service costs, expected/actual
cash, difference, status, date and comments. A missing closing has
`closing_id: null`, `status: "missing"` and `null` cash values — it is **not**
represented as a zero-value closing. A reviewer with `weekly_reports.adjust` may
acknowledge missing closings with a recorded reason.

A shortage submission must include a category, a detailed explanation, evidence
and an expected resolution date. An unexplained shortage is accepted only with
an authorised override reason and `weekly_reports.adjust` permission. Evidence
must be PDF/PNG/JPG/JPEG/WEBP and at most 10 MB; it is stored under
`/uploads/weekly_reports/{report_id}/` only after the rest of the declaration
passes validation, so a rejected submission cannot leave an orphan file. A
client-supplied MoMo `submitted_at` must fall inside the reported week or before
its stored deadline; short phone numbers are masked down to the last three
digits (or completely when three digits or fewer) in every serialized response.

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
- `request_correction` — returns the report with a mandatory reason.
- `approve` — computes the final carry-forward and approval audit.
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

- Service Agents see only their own reports; every detail/update/submit/MoMo
  route rechecks ownership server-side.
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
| GET | `""` | Permission/branch/agent-scoped list |
| POST | `/generate` | Idempotent manual generation (admin/manager) |
| GET | `/{id}` | Report, calculation, submissions, adjustments, allocations, transitions |
| PATCH | `/{id}` | Save editable declaration fields |
| POST | `/{id}/submit` | Submit/resubmit (JSON or multipart with evidence) |
| GET | `/{id}/transactions` | Filtered, paginated underlying transactions |
| GET | `/{id}/daily-closings` | Per-day rows, missing list, override |
| GET | `/{id}/expenses` | Eligible expense rows |
| POST | `/{id}/momo` | Add transfer with optional evidence |
| DELETE | `/{id}/momo/{submission_id}` | Remove transfer while editable |
| GET | `/{id}/evidence` | Download shortage evidence (audited) |
| POST | `/{id}/override` | Authorise unexplained shortage |
| POST | `/{id}/missing-closings/override` | Acknowledge missing closings |
| POST | `/{id}/review` | Verify/reject/return/approve/reject |
| POST | `/{id}/adjustments` | Audited adjustment + allocation |
| GET | `/{id}/audit` | Report and MoMo audit history |
| GET | `/{id}/export?format=pdf\|xlsx&lang=en\|rw` | Bilingual export |

## 8. Exports

`app/services/weekly_exports.py` renders the 21 statement items from the same
locked `calculation` used on screen:

1. Reporting period and agent identity
2. Opening outstanding balance brought forward
3. Eligible transaction count
4. Customer collections from eligible transactions
5. Official service costs and payment status
6. Authorized receipts during the week
7. Verified service/provider payments
8. Approved collection-funded expenses
9. Authorized refunds
10. Other approved cash outflows
11. Commission retained (only if configured)
12. Expected remittance / expected submission
13. Agent-reported MoMo/bank submissions
14. Reviewer-verified money submissions
15. Shortage amount
16. Surplus amount
17. Shortage reason, evidence and resolution date
18. Commission earned (20% of gross profit, shown separately)
19. Daily closing coverage and missing-closing overrides
20. Outstanding balance carried forward with allocation history
21. Workflow state, approvals, adjustments and audit trail

`lang=en|rw` translates report headers, statement labels, statuses and table
headings. User-authored text is copied verbatim and never translated.

## 9. Notifications and scheduler

Weekly notification types are registered in `app/services/notifications.py`
with severity, UI label and permission gate: generated, due, late, submitted,
submission acknowledgement, returned, approved, rejected, shortage, MoMo
verified and override requested. Where a user locale is not stored, messages
are sent in both English and Kinyarwanda (`weekly_i18n.bilingual()`).

`app/services/automation.py` adds three rules:

- `weekly_report_generation_alert` — idempotently creates one report per service
  agent on the configured submission day.
- `weekly_report_due_alert` — reminds agents before the deadline.
- `weekly_report_late_alert` — transitions overdue drafts to `late` through the
  audited workflow and notifies the agent and reviewers.

Manual generation uses the same service, so scheduler and admin actions are
identical and duplicate-safe.

## 10. Internationalisation

`app/services/weekly_i18n.py` is the structured label catalogue for English and
Kinyarwanda. The frontend uses matching keys in `frontend/lib/weekly-i18n.tsx`
with a persistent `[ EN ] [ RW ]` switcher. Switching language only changes
system labels; form data and user-entered text remain untouched.

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

No existing table or row is dropped or rewritten during upgrade.

## 12. Verification

Recommended checks:

```bash
cd backend
python3 -m pytest -q tests/test_weekly_reports.py \
  tests/test_weekly_permissions_migration.py tests/test_roles_permissions.py \
  tests/test_notifications.py tests/test_closings.py
python3 -m pytest -q tests
python3 -m compileall -q app migrations/versions/f7c9a4d2e8b1_weekly_financial_reports.py
cd ../frontend && npm run build
```

The focused weekly test module covers generation idempotency, calculation
sources, daily closings, expense de-duplication, MoMo verification, workflow and
auditing, RBAC/Company Secretary denial, notifications, bilingual exports and
the review fixes (PDF escaping, savepoint-safe generation, branch-scoped
reviewer alerts, locked-report overrides, evidence orphan prevention, deleted
transfer overlays, read-only GETs, delta adjustments, MoMo date validation and
all 21 bilingual rows in both PDF and XLSX exports).
`tests/test_weekly_permissions_migration.py` proves an existing installation
gains the restricted permission family on upgrade and loses only that family on
downgrade.
