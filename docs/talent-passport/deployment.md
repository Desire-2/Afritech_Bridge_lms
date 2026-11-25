# Deployment and rollback

## Backend registration

Talent Passport is registered inside the existing Flask application:

- `backend/main.py` imports the new models and `talent_passport_bp` and calls
  `app.register_blueprint(talent_passport_bp)`;
- `backend/src/models/__init__.py` imports the new models so boot-time
  `db.create_all(checkfirst=True)` can provision them on development databases;
- no new Flask app, WSGI entry point, auth provider, or database is introduced.

The API is mounted under the existing `/api/v1` namespace. The existing `/api/v2`
integration API is unchanged.

## Migration

Revision: `f7a2b9c3d4e5`
Down revision: `a7a8e1c3f5b2`
File: `backend/migrations/versions/f7a2b9c3d4e5_add_talent_passport.py`

The revision is purely additive. It creates only Talent Passport tables and
indexes. Every `CREATE TABLE` and `CREATE INDEX` is guarded, so the revision can
be re-run after a partial failure or against a database already bootstrapped by
`create_all`. The downgrade drops only the Talent Passport tables.

Apply:

```bash
cd backend
python3 -m flask db upgrade head
```

Roll back:

```bash
cd backend
python3 -m flask db downgrade a7a8e1c3f5b2
```

A committed verification script exercises `upgrade head` from the previous head,
`downgrade a7a8e1c3f5b2`, and two consecutive `upgrade head` calls on an
isolated SQLite database:

```bash
cd backend
python3 scripts/verify_talent_passport_migration.py
```

The exact invocation and observed results are recorded in
`final-engineering-report.md`.

## Frontend

The frontend routes are inside the existing Next.js app:

- `/student/talent-passport` and its nested pages use the existing student
  layout/guard and `axiosInstance`;
- `/talent/[publicSlug]` uses a JWT-free axios instance and renders only
  backend-filtered public fields;
- navigation and the profile entry point are added to the shared sidebar and
  profile page.

No separate frontend deployment target or auth flow was introduced.

## Configuration

The module uses existing configuration sources:

- JWT roles and access rules come from the existing LMS auth layer;
- certificate/progress thresholds come from `src/config/scoring.py` through the
  canonical services — the Passport does not define its own 70% rule;
- frontend API base URL uses the existing `NEXT_PUBLIC_API_URL` convention.

## Operational notes

- Passport evidence writes are failure-isolated: a Passport hook error must not
  fail the originating LMS write. The safe fallback is a targeted or full
  `sync_student` backfill.
- Publication is private by default. Unpublishing revokes the public slug and
  rotates it, so old links cannot be revived by republishing the same URL.
- No live production deployment or browser check was performed; those remain
  release-time gates. The production build was verified with Node 20 on `PATH`
  (see `final-engineering-report.md`, F.7).
