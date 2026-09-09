# AfriTech Bridge Operations

Standalone business-management platform for the AfriTech Bridge service hubs:
clients, services, transactions, commissions, daily closings, expenses, payroll,
attendance, tasks, instructor weekly planning & performance scoring, reports,
audit log, notifications, and an optional AfriTech LMS integration.

Built to run completely independently, with a clean API surface so a future
LMS can consume and sync data.

---

## Stack

| Layer     | Tech |
|-----------|------|
| Backend   | Python 3.10 · Flask 2.3 · SQLAlchemy 2 · Flask-JWT-Extended · Flask-Migrate · pytest |
| Frontend  | Next.js 14 (App Router) · TypeScript · React 18 · Bootstrap 5 |
| Database  | SQLite (dev) · PostgreSQL (prod) |
| Exporters | CSV / XLSX (openpyxl+pandas) / PDF (reportlab fallback) |

Directory layout:

```
afritech-operations/
├── backend/
│   ├── app/
│   │   ├── models/         # SQLAlchemy models
│   │   ├── routes/         # Flask blueprints (/api/*)
│   │   ├── services/       # commission, performance, audit, notifications…
│   │   ├── auth/           # JWT, permissions & role seed
│   │   └── seeds.py        # `flask seed-dev` demo data
│   ├── migrations/         # Alembic (initial schema revision included)
│   ├── tests/              # pytest unit tests (30 checks)
│   ├── test_smoke.py       # 20-step end-to-end smoke suite
│   └── requirements.txt
├── frontend/               # Next.js app (port 3001)
├── docker/docker-compose.yml
├── docs/                   # architecture & API reference
├── Procfile                # Heroku-ish entrypoint
└── .env.example
```

---

## Quick start

### Backend

```bash
cd backend
python -m venv venv && . venv/bin/activate
pip install -r requirements.txt

cp ../.env.example ../.env   # tweak as needed
rm -f ../dev.db
FLASK_APP=app.py FLASK_CONFIG=development flask seed-dev   # creates dev.db + demo data

python app.py                # API on http://localhost:5000
```

> The dev SQLite file (`dev.db`) lives in the **project root** (see
> `DATABASE_URL` in `.env.example`) so backend and docker builds share a path.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env        # NEXT_PUBLIC_API_URL (defaults to http://localhost:5000)
npm run dev                  # http://localhost:3001  (proxies /api → :5000)
```

### Seed accounts (all passwords `Password123!`)

| Email                  | Role         |
|------------------------|--------------|
| `admin@afritech.dev`   | super_admin  |
| `manager@afritech.dev` | manager      |
| `accountant@afritech.dev` | accountant |
| `agent@afritech.dev`   | service agent |
| `instructor@afritech.dev` | instructor |

---

## Environment configuration (secrets in `.env`)

Configuration and secrets are loaded from `.env` files, so nothing secret is
hard-coded. Both files are gitignored.

| File                     | Loader                                                                  |
|--------------------------|-------------------------------------------------------------------------|
| `afritech-operations/.env`  | Backend (`backend/config.py` → `python-dotenv`), copied from `.env.example` |
| `frontend/.env`             | Next.js (native, at build/run time), copied from `frontend/.env.example`    |

- **Backend** loads `.env` from the project root at import time. Real
  OS-level variables (Docker, Heroku, CI) always take precedence over the file.
  Key settings: `SECRET_KEY`, `JWT_SECRET`, `DATABASE_URL`, `CORS_ORIGINS`,
  `LMS_API_KEY`.
- **Frontend** only exposes `NEXT_PUBLIC_*` values to the browser/clients.
  `NEXT_PUBLIC_API_URL` drives the dev/prod rewrites for `/api` and `/uploads`.
  In Docker builds, pass it as a build arg (compose reads it from `.env`).

```bash
# first-time setup — never commit the real .env files
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Secrets reference for the stack: `docker/docker-compose.yml` interpolates
`SECRET_KEY`, `JWT_SECRET`, `LMS_API_URL`, `LMS_API_KEY`, `BUSINESS_NAME`,
`CURRENCY`, `DEFAULT_COMMISSION_RATE`, and `NEXT_PUBLIC_API_URL` from the
project `.env`. The compose stack also ships a `redis` service backing the
rate limiter (production defaults to `redis://localhost:6379/0` unless
`RATELIMIT_STORAGE_URI` is overridden; dev/test use `memory://`).

## Tests

```bash
cd backend && . venv/bin/activate

python -m pytest tests/ -q      # unit tests (auth, permissions, commission,
                                # closings, payroll, performance)
python test_smoke.py            # 20-step end-to-end via Flask test client
```

---

## Commission model

Commission is **% of gross profit** (`customer price − service cost`), resolved
by precedence:

1. **Employee override** — `Employee.default_commission_rate`
2. **Employee rule** — active `CommissionRule` (scope `employee`)
3. **Service rate** — `Service.commission_rate`
4. **Service rule** — active `CommissionRule` (scope `service`)
5. **Default rule** — active `CommissionRule` (scope `default`)
6. **App default** — `DEFAULT_COMMISSION_RATE` (0.20)

`Company profit = gross profit − commission`. Transactions snapshot their
amounts at creation time, so later price changes never rewrite history.

---

## API

Prefix: `/api` — authenticate with `Authorization: Bearer <jwt>`.

- `POST /auth/login` · `GET /auth/me`
- Users: `GET/POST/PUT /users…`, `GET /users/roles`, `GET /users/permissions`
- Lookups: `/meta/…`, `/services/categories/list`, `/services/payment-methods`
- Core: `/services`, `/clients`, `/transactions`, `/employees`
- Daily closing: `/closings/totals`, `/closings/submit`, `/closings/{id}/review`
- Finance: `/expenses`, `/commissions/rules`, `/commissions/effective`,
  `/payroll/periods`, `/payroll/items/{id}`, `/cash-reconciliation`
- Ops: `/attendance`, `/tasks`, `/notifications`
- Learning: `/instructors`, `…/courses/list`, `/cohorts/list`,
  `/instructors/weekly-plans`, `…/performance/calculate`
- Reports: `/reports/summary|by-service|by-employee|expenses|attendance|payroll|instructor-performance`,
  `/reports/export/csv|excel|transactions-pdf`
- Admin: `/admin` scope, `/audit`, `/settings/*`, `/integrations/lms/*`
- Health: `/health`

Paginated responses use `{items, total, page, per_page, pages, has_next, has_prev}`;
errors are `{error: string}`. See [`docs/API.md`](docs/API.md).

---

## Deployment

### Docker Compose (backend + postgres + frontend)

```bash
cp .env.example .env
docker compose -f docker/docker-compose.yml up --build
# backend :5000 · frontend :3001 · postgres :5432
```

First deploy: initialize schema inside the backend container with
`flask db upgrade` (initial migration included) or run `flask seed-dev` for demo data.

### Heroku-style (Procfile)

```bash
heroku create your-app
heroku config:set DATABASE_URL=$(heroku config:get DATABASE_URL) SECRET_KEY=… CORS_ORIGINS=https://…
git push heroku main
```

### Manual production

```bash
cd backend && . venv/bin/activate
export FLASK_CONFIG=production DATABASE_URL=postgresql://…
flask db upgrade
gunicorn --bind 0.0.0.0:5000 wsgi:app
```

---

## Environment variables

See [`.env.example`](.env.example) for the full list: `FLASK_CONFIG`,
`SECRET_KEY`, `JWT_SECRET`, `DATABASE_URL`, `BUSINESS_NAME`, `CURRENCY`,
`DEFAULT_COMMISSION_RATE`, rate-limit knobs, `CORS_ORIGINS`,
`LMS_API_URL`, `LMS_API_KEY`.

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — domain model, modules, flows
- [`docs/API.md`](docs/API.md) — endpoint reference