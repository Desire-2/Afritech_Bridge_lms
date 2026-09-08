# AfriTech Bridge Operations — Architecture

## Overview

A self-contained Flask API + Next.js SPA for operating AfriTech service hubs.
Designed to run independently of the AfriTech LMS; an optional integration
adapter (`/api/integrations/lms/*`) can sync courses, cohorts, and learners.

```
┌────────────────┐  /api/* + /uploads/* (Next rewrites)   ┌─────────────────┐
│ Next.js (3001) │───────────────────────────────────────▶│ Flask API (5000)│
└────────────────┘                                        └───────┬─────────┘
                                                                  │ SQLAlchemy
                                                      ┌───────────▼──────────┐
                                                      │ SQLite  /  PostgreSQL│
                                                      └──────────────────────┘
```

## Backend modules

- `app/models/` — SQLAlchemy models grouped by domain:
  - `user.py` — `User`, `Role`, `Permission`, `SessionRecord`, `PasswordResetToken`
  - `employee.py` — `Employee`, `Branch`, `Department` (commission override on employee)
  - `service.py` — `Service`, `ServiceCategory`, `PaymentMethod`, `CommissionRule`
  - `finance.py` — `ServiceTransaction`, `Payment`, `Expense`, `DailyClosing`
  - `payroll.py` — `PayrollPeriod`, `PayrollItem`, `PayrollTransactionSource`
  - `attendance.py` — `Attendance`, `ShiftSchedule`
  - `instruct.py` — `Instructor`, `Course`, `Cohort`, `Learner`, `Enrollment`,
    `WeeklyPlan`, `WeeklyPlanActivity`, `TeachingActivity`, `Assignment`,
    `AssignmentSubmission`, `PerformanceScore`
  - `system.py` — `AuditLog`, `Notification`, `NotificationRead`, `Setting`, `LMSIntegration`
- `app/routes/` — one blueprint per resource; every handler is permission-gated
  (`require_permission` / `require_any_permission`) and returns the shared
  `{item | items/total/page/per_page/pages/has_next/has_prev}` or `{error}` shapes.
- `app/services/`
  - `commission.py` — precedence engine + monetary rounding (`ROUND_HALF_UP`)
  - `performance.py` — instructor scoring; `ensure_metrics` seeds metric weights
  - `audit.py` — activity log writer
  - `notifications.py` — per-user + per-role notifications on key events
  - `automation.py` — scheduled watermarks (expense/period reminders etc.)
  - `integrations.py` — LMS sync client (courses/cohorts/mapping)
- `app/auth/`
  - `auth.py` — `current_user`, `current_employee`, permission decorators
  - `permissions.py` — permission catalogue + role→permission seed definitions
  - `jwt_handlers.py` — token refresh/blacklisting, user status enforcement
- `app/seeds.py` — `flask seed-dev` demo data (users, services, 100+ transactions,
  closing history, attendance, weekly plans, teaching activities, instructors).

## Key flows

### Commission & transaction lifecycle
1. Agent picks service + client + payment method (`POST /api/transactions`).
2. Engine resolves the rate via precedence (employee > rule > service > default).
3. The transaction stores **snapshot** amounts: `gross_profit`, `commission_amount`,
   `commission_rate_used`, `commission_source`, `company_profit`.
4. Later price/rate edits never rewrite past transactions (price-history tests).

### Daily closing
1. `GET /api/closings/totals` previews an employee’s day from that day’s transactions.
2. `POST /api/closings/submit` creates/closes it; reconciliation class from
   `cash_difference` (shortage/overtun/balanced); notifies managers on shortage.
3. `POST /api/closings/{id}/review` (approve/reject) locks the record.

### Payroll
1. `POST /api/payroll/periods` builds a `PayrollItem` per active employee
   (`net = base + commission + bonus/deduction/adjustment`).
2. `PayrollTransactionSource` rows link items to the underlying transactions.
3. Status machine: `draft → reviewed → approved → paid` (permission-guarded).

### Instructor performance
- `POST /api/instructors/{id}/performance/calculate` computes 6 weighted
  components (teaching delivery, weekly planning, learner progress, assignments,
  attendance, reporting); weights configurable via `/api/settings/performance-metrics`.

## Frontend

- `app/(app)/` route group behind an auth guard; `lib/auth.tsx` gates by JWT +
  role/permission (`can`, `hasRole`, `isSuperAdmin`).
- `lib/api.ts` central API client incl. `fmtMoney` / `fmtDate`; `lib/use-fetch.ts`
  gives pages debounced fetch + `todayIso`.
- `components/` — `ui.tsx` (PageHeader, Loading, ErrorAlert, StatCard, Badge,
  Pagination, Modal, ConfirmDialog) and `form.tsx` (DateRange, Field, inputs).
- Nav (`components/Sidebar.tsx`) is filtered by permissions.

## Tests & verification

- `backend/tests/` — pytest suite (auth, permissions, commission precedence &
  snapshots, closings, payroll, performance), seeded fresh each session.
- `backend/test_smoke.py` — 20-step end-to-end scenario.
- Recommended run: `pytest tests/ -q` then `python test_smoke.py`.