# API Reference

Base URL: `http://localhost:5000/api` (proxied from the frontend at `:3001`).

## Conventions

- **Auth:** `Authorization: Bearer <jwt>` for every endpoint except `auth/login`.
  `is_super_admin` users have all permissions (`*`).
- **Errors:** `{"error": "message"}` with matching HTTP status (400/401/403/404/409/429/500).
- **Pagination:** list responses are `{items, total, page, per_page, pages, has_next, has_prev}`.
  Supported query params: `page`, `per_page` (max 100).
- **Dates:** ISO `YYYY-MM-DD`; datetimes ISO-8601 with tz.
- **Money:** decimal amounts as strings in payloads, numbers in some summaries —
  always parse via `Decimal`/`float`.

---

## Auth · `/auth`

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | body `{email, password}` → `{access_token, refresh_token, user}` |
| GET | `/auth/me` | current user incl. `role_codes`, `permissions`, `employee_id`, `employee_name` |
| POST | `/auth/refresh` | exchange refresh token |
| POST | `/auth/logout` | revoke active session |
| POST | `/auth/change-password` | `{current_password, new_password}` |
| POST | `/auth/request-password-reset` | `{email}` (rate-limited) |
| POST | `/auth/reset-password` | `{token, email, new_password}` |
| GET | `/auth/sessions` · POST | `/auth/sessions/{id}/revoke` |

## Users · Admin

| Method | Path |
|---|---|
| GET/POST | `/users` · GET/PUT/DELETE` /users/{id}` |
| GET | `/users/roles` / `/users/permissions` · POST `/users/roles` · PUT `/users/roles/{id}` |
| GET | `/audit?action=&user_id=&start=&end=&page=` · `GET /audit/actions` |
| GET | `/settings` / `/settings/business` · PUT `/settings` |
| GET/PUT | `/settings/notification-rules` · `/settings/payment-methods` · `/settings/performance-metrics` |
| GET/PUT | `/integrations/lms/config` · GET `/integrations/lms/health-check` |
| POST | `/integrations/lms/sync-courses` · GET `/integrations/lms/mapping` |
| GET | `/notifications?unread=1` · GET `/notifications/unread-count` |
| POST | `/notifications/{id}/read` · `/notifications/read-all` |

## Lookups

| Method | Path | Notes |
|---|---|---|
| GET | `/meta` | business + currency + commission defaults |
| GET | `/services/categories/list` | static categories |
| GET | `/services/payment-methods` | static payment methods |
| GET | `/employees/branches` · `/employees/departments` | + POST |

## Core business

### Services
- `GET /api/services?active=&search=&category_id=&page=` (note: `active=true`)
- `POST /api/services` · `GET/PUT /api/services/{id}` · POST `…/{id}/deactivate|reactivate`
- `POST  /api/services/categories` · `POST /api/services/payment-methods`

### Clients
- `GET /api/clients?search=&phone=&page=` · `POST /api/clients`
- `GET/PUT /api/clients/{id}`

### Transactions
- `GET /api/transactions?status=&service_id=&employee_id=&payment_method_id=&start=&end=&search=&page=`
- `POST /api/transactions` — `{service_id, client_id, payment_method_id, customer_price?, official_cost?}`
  (amounts optional; snapshot rules apply)
- `GET /api/transactions/{id}` · `PUT /api/transactions/{id}` `{service_id?, client_id?, payment_method_id?, customer_price?, official_cost?, transaction_date?, reference?, notes?}`
- `POST /api/transactions/{id}/status` `{status: completed|cancelled|…}`

### Employees
- `GET /api/employees?search=&branch_id=&department_id=&status=&position=`
- `POST /api/employees` · `GET/PUT /api/employees/{id}`
- `GET /api/employees/{id}/{transactions|attendance|tasks|earnings|performance}`

## Daily closing

- `GET /api/closings/today` — authoritative calendar date/timezone in the
  business zone (`Africa/Kigali`), used by the screen instead of the browser clock.
- `GET /api/closings/totals?date=&employee_id=` — preview **that date's** records
  for an agent (self only) or approver (explicit employee required). Responds with
  `date`, `employee_id`, `employee_name`, `timezone` and the `totals` object, so a
  stale reply for another date/employee can be discarded by the client. Omitted
  `date` defaults to the server's business date.
- `POST /api/closings/submit` — `{closing_date, actual_cash, notes, employee_id?}`
  (re-submit allowed when `status=correction_requested|rejected`; resets status to `submitted`).
  Derived amounts are always recalculated from `closing_date`'s records; agents
  are forced to their own employee, and approvers must name an employee.
- `GET /api/closings?status=&start=&end=&employee_id=`
- `GET /api/closings/{id}` · `POST /api/closings/{id}/review` — `{decision, note}`
  decision: `approved` (locks) | `rejected` | `correction_requested`
- Super-admin override: a locked/approved closing can be changed by an
  `is_super_admin` user only, with a non-empty `note`. Valid decisions then are
  `submitted`, `rejected` or `correction_requested`; the lock is released and the
  change is audited as `closing_admin_status_override`. Managers still get 400.

## Finance

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/expenses` · `GET /expenses/{id}` · `POST /expenses/{id}/approve` | |
| GET/POST | `/commissions/rules` · PUT `/commissions/rules/{id}` | scope `employee/service/default` |
| GET | `/commissions/effective?service_id=&employee_id=` | resolved rate + source |
| GET | `/commissions/default` | app default |
| GET/POST | `/payroll/periods` · GET `/payroll/periods/{id}` | detail incl. `items` |
| POST | `/payroll/periods/{id}/recalculate` · `/…/status` | status machine |
| PUT | `/payroll/items/{id}` | bonus/deduction/advance/adjustment → net recompute |
| GET | `/reports/cash-reconciliation` | |

## Weekly service-agent financial report

All endpoints are under `/api/weekly-reports` and use the restricted
`weekly_reports.*` permission family (Company Secretary has none). See
[WEEKLY_FINANCIAL_REPORTING.md](./WEEKLY_FINANCIAL_REPORTING.md) for the full
workflow, calculation formula, policy settings and bilingual export details.

- `GET /policy` · `GET /weeks`
- `POST /agent-summary` (Service Agent only; one self-scoped request that
  prepares/reuses her draft and returns the authoritative `summary`, `policy`,
  `constants`, `employee` and `weeks`; accepts `week_start` or a self-owned
  `report_id`)
- `GET /queue` (reviewers) · `GET /` · `POST /generate`
  (admin/manager for in-scope agents; Service Agent for herself only)
- `GET/PATCH /{id}` · `POST /{id}/submit`
  (agent declaration includes `declared_submitted_amount` and
  `submission_funding_source`: `agent_phone` | `company` | `someone_else`;
  a lower/zero amount needs `shortage_reason_category` plus
  `shortage_explanation`, and a higher amount needs `surplus_explanation`)
- `GET /{id}/transactions` · `GET /{id}/daily-closings` · `GET /{id}/expenses`
- `GET/POST/DELETE /{id}/official-cost-payments[/…]`
  (`payment_source`: `personal` | `company` | `someone_else` | `not_paid`; only
  a verified `personal` claim reduces expected remittance)
- `POST/DELETE /{id}/momo[/…]` · `GET /{id}/evidence`
- `POST /{id}/override` · `POST /{id}/missing-closings/override`
- `POST /{id}/review` · `POST /{id}/adjustments` · `GET /{id}/audit`
- `GET /{id}/export?format=pdf|xlsx&lang=en|rw`

## Attendance & tasks

- `POST /api/attendance/record` · `POST /api/attendance/clock-in` · `POST /api/attendance/clock-out`
- `GET /api/attendance?employee_id=&start=&end=&status=` (no single `date` filter)
- `POST /api/attendance/schedules` · `GET /api/attendance/schedules`
- `GET/POST /api/tasks?assigned_to=&status=&priority=&overdue=` · `PUT /api/tasks/{id}`
  (non-managers see their own)

## Learning / Instructors

- `GET/POST /api/instructors` · `GET /api/instructors/{id}`
- `POST /api/instructors/{id}/assign-cohorts`
- `GET /api/instructors/courses/list` · `POST /api/instructors/courses`
- `GET /api/instructors/cohorts/list` · `POST /api/instructors/cohorts`
- `GET/POST /api/instructors/cohorts/{id}/learners` · `POST …/{id}/attendance`
- `GET/POST /api/instructors/teaching-activities[/list]`
- `GET /api/instructors/weekly-plans/list?instructor_id=&week_start=&status=`
- `POST /api/instructors/weekly-plans` — `{week_start, week_end, title, note, activities:[…]}`
- `PUT /api/instructors/weekly-plans/{id}` · `PUT …/{id}/activities/{activity_id}` `{status}`
- `GET/POST /api/instructors/assignments[/list]` · `POST …/{assignment_id}/grade`
- `POST /api/instructors/{id}/performance/calculate` — `{period_start, period_end}`

`WeeklyPlan` payload includes `activities_details`, `completed_count`,
`progress_percent`; activity statuses are `planned|done|cancelled|missed`.

## Reports

All accept `start=` + `end=`:

- `GET /reports/summary · /by-service · /by-employee · /expenses · /attendance`
- `GET /reports/payroll` — `periods` is an **array** of `{name,status,total_net}`;
  `items` carry `period` / `period_status`
- `GET /reports/instructor-performance`
- Exports: `GET /reports/export/csv?report=…` · `GET /reports/export/excel?report=…`
  · `GET /reports/export/transactions-pdf` (PDF needs `pdfkit`, `weasyprint`,
  or falls back to built-in reportlab)

## Dashboard & health

- `GET /api/dashboard` · `GET /api/dashboard/me`
- `GET /api/health` → `{status: "ok"}` (no auth)