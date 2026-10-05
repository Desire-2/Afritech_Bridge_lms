#!/usr/bin/env python3
"""Production-safe schema migration runner for AfriTech Operations.

Why this exists
---------------
Plain `flask db upgrade` is not safe to point at production in this codebase:

* ``config.py`` runs ``load_dotenv()`` on ``afritech-operations/.env``, so
  ``DATABASE_URL`` silently becomes the target — a local ``./run.sh`` migrates
  the live database without anyone noticing.
* When ``DATABASE_URL`` is unset, ``DevelopmentConfig`` falls back to
  ``instance/dev.db``. A misconfigured deploy therefore migrates the *wrong*
  database instead of failing loudly.
* Alembic takes no cross-process lock, while the Dockerfile and Procfile run
  ``flask db upgrade`` on every process start — three gunicorn workers race
  the same DDL.

This runner resolves ``DATABASE_URL`` (OS environment wins over ``.env``),
prints the redacted target, refuses to guess, serialises concurrent starts
with a Postgres advisory lock, optionally snapshots with ``pg_dump``, and
verifies the schema really landed on head afterwards.

The upgrade itself still runs through ``flask db upgrade``, so it keeps the
single transaction that Alembic opens in ``migrations/env.py``: on PostgreSQL
(DDL is transactional) a failure mid-run rolls the whole batch back rather
than leaving a half-migrated schema.

Usage
-----
    python scripts/migrate.py --status    # read-only: current vs head
    python scripts/migrate.py --dry-run   # read-only: print pending SQL
    python scripts/migrate.py --backup    # pg_dump snapshot, then migrate
    python scripts/migrate.py --yes       # migrate unattended (containers)
    python scripts/migrate.py             # migrate, ask first

Exit codes: ``0`` success or already at head, ``1`` migration/verification
failure, ``2`` refused on safety grounds (nothing was changed).
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

from sqlalchemy import create_engine

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Same key in every process, so all workers in a fleet derive one lock.
LOCK_KEY = 0x4146_5442  # 'AFTB'

EXIT_OK = 0
EXIT_FAILED = 1
EXIT_REFUSED = 2


class RefusedError(RuntimeError):
    """A safety check failed; nothing was written to the database."""


class MigrationError(RuntimeError):
    """The migration (or its verification) failed."""


# ── target resolution ─────────────────────────────────────────────────────────


def resolve_database_url(allow_sqlite: bool = False):
    """Return the SQLAlchemy URL for this run, or raise ``RefusedError``.

    Importing ``config`` triggers ``load_dotenv()``, which fills ``.env`` values
    that the OS environment has not already set — so containers keep their
    injected ``DATABASE_URL`` and local runs pick up ``.env``.
    """
    from sqlalchemy.engine import make_url

    import config  # noqa: F401  (side effect: load_dotenv)

    raw = os.environ.get('DATABASE_URL', '').strip()
    if not raw:
        raise RefusedError(
            'DATABASE_URL is not set. Define it in afritech-operations/.env or '
            'export it — refusing to guess a target database.'
        )

    try:
        url = make_url(raw)
    except Exception as exc:  # sqlalchemy raises ArgumentError
        raise RefusedError(f'DATABASE_URL is not a valid database URL: {exc}') from None

    backend = url.get_backend_name()
    is_sqlite = backend.startswith('sqlite')
    if is_sqlite and not allow_sqlite:
        raise RefusedError(
            'DATABASE_URL points at SQLite. That is the local development '
            'fallback, not a production target; pass --allow-sqlite if you '
            'really mean to migrate it.'
        )
    if not url.database:
        raise RefusedError('DATABASE_URL names no database — refusing an unnamed target.')
    # SQLite URLs are file paths and legitimately have no host.
    if not is_sqlite and not url.host:
        raise RefusedError('DATABASE_URL has no host — refusing an unnamed target.')
    return url


def redact(url) -> str:
    """Render the URL with the password masked, safe to log."""
    return url.render_as_string(hide_password=True)


# ── alembic introspection ─────────────────────────────────────────────────────


def alembic_scripts():
    from alembic.config import Config as AlembicConfig
    from alembic.script import ScriptDirectory

    ini = BACKEND_DIR / 'migrations' / 'alembic.ini'
    cfg = AlembicConfig(str(ini))
    location = (BACKEND_DIR / 'migrations').as_posix().replace('%', '%%')
    cfg.set_main_option('script_location', location)
    return ScriptDirectory.from_config(cfg)


def current_version(engine) -> str | None:
    from sqlalchemy import inspect, text

    if not inspect(engine).has_table('alembic_version'):
        return None
    with engine.connect() as conn:
        return conn.execute(text('select version_num from alembic_version')).scalar()


def pending_revisions(script, current: str | None):
    """Return ``(head, [revision ids not yet applied])``."""
    head = script.get_current_head()
    if current == head:
        return head, []
    lower = current or 'base'
    return head, [r.revision for r in script.iterate_revisions(head, lower, inclusive=False)]


# ── advisory lock ─────────────────────────────────────────────────────────────


def acquire_lock(engine, timeout: int):
    """Hold a session-level Postgres advisory lock, or ``None`` when not needed."""
    from sqlalchemy import text

    conn = engine.connect().execution_options(isolation_level='AUTOCOMMIT')
    deadline = time.monotonic() + timeout
    announced = False
    while True:
        got = conn.execute(
            text('select pg_try_advisory_lock(:key)'), {'key': LOCK_KEY}
        ).scalar()
        if got:
            return conn
        if not announced:
            print('  waiting for the migration lock held by another process...')
            announced = True
        if time.monotonic() >= deadline:
            conn.close()
            raise MigrationError(
                f'gave up waiting for the migration lock after {timeout}s'
            )
        time.sleep(1)


def release_lock(conn) -> None:
    from sqlalchemy import text

    if conn is None:
        return
    try:
        conn.execute(text('select pg_advisory_unlock(:key)'), {'key': LOCK_KEY})
    finally:
        conn.close()


# ── backup ────────────────────────────────────────────────────────────────────


def pg_dump_schema(url, dest: Path) -> None:
    """Write a schema-only dump of the target before we change it."""
    if shutil.which('pg_dump') is None:
        raise MigrationError('--backup needs the pg_dump client on PATH')
    if not url.get_backend_name().startswith('postgres'):
        raise MigrationError('--backup only supports PostgreSQL targets')

    dest.parent.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    env['PGPASSWORD'] = url.password or ''
    for key, value in url.query.items():
        env['PG' + key.upper()] = str(value)

    cmd = [
        'pg_dump', '--no-owner', '--no-privileges', '--schema-only',
        '-h', url.host or '', '-p', str(url.port or 5432),
        '-U', url.username or '', '-d', url.database, '-f', str(dest),
    ]
    proc = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if proc.returncode != 0:
        dest.unlink(missing_ok=True)
        raise MigrationError(f'pg_dump failed: {proc.stderr.strip()[:400]}')


# ── the upgrade itself ────────────────────────────────────────────────────────


def run_flask_db(extra: list[str]) -> int:
    env = dict(os.environ)
    env.setdefault('FLASK_APP', 'app.py')
    # Our own banner is block-buffered when stdout is a pipe, so without this
    # the child's SQL prints *above* the header that is supposed to introduce it.
    sys.stdout.flush()
    return subprocess.run(
        [sys.executable, '-m', 'flask', 'db', 'upgrade', *extra],
        cwd=BACKEND_DIR, env=env,
    ).returncode


def confirm() -> None:
    """Ask before writing; refuse instead of guessing when nobody can answer."""
    if not sys.stdin.isatty():
        raise RefusedError(
            'stdin is not a terminal, so there is nobody to confirm with; '
            'pass --yes to migrate unattended.'
        )
    answer = input('\nApply these migrations? [y/N] ').strip().lower()
    if answer not in ('y', 'yes'):
        print('aborted — no changes were applied.')
        raise SystemExit(EXIT_OK)


def fmt(pending: list[str]) -> str:
    """Revisions in the order they will be applied (oldest first)."""
    return ', '.join(reversed(pending))


# ── entry point ───────────────────────────────────────────────────────────────


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog='migrate.py', description=__doc__.splitlines()[0],
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='Exit codes: 0 success, 1 failure, 2 refused on safety grounds.',
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--status', action='store_true',
                      help='report current revision vs head; write nothing')
    mode.add_argument('--dry-run', action='store_true',
                      help='print the SQL that would run; write nothing')
    parser.add_argument('--yes', action='store_true',
                        help='do not ask for confirmation (CI, containers)')
    parser.add_argument('--backup', action='store_true',
                        help='pg_dump a schema snapshot before migrating')
    parser.add_argument('--backup-dir', default=str(BACKEND_DIR / 'backups'),
                        help='where --backup writes its dump')
    parser.add_argument('--allow-sqlite', action='store_true',
                        help='permit an SQLite target (local testing only)')
    parser.add_argument('--no-lock', action='store_true',
                        help='skip the Postgres advisory lock')
    parser.add_argument('--lock-timeout', type=int, default=300, metavar='SECONDS',
                        help='how long to wait for the lock (default: 300)')
    parser.add_argument('--revision', default='head',
                        help='target revision passed to `flask db upgrade`')
    return parser


def run(opts: argparse.Namespace) -> int:
    url = resolve_database_url(allow_sqlite=opts.allow_sqlite)
    target = redact(url)

    engine = create_engine(url)
    script = alembic_scripts()
    current = current_version(engine)
    head, pending = pending_revisions(script, current)

    if opts.status:
        print(f'target   : {target}')
        print(f'current  : {current or "(empty database — no alembic_version table)"}')
        print(f'head     : {head}')
        print(f'pending  : {len(pending)}' + (f'  {fmt(pending)}' if pending else ''))
        return EXIT_OK if current == head else EXIT_FAILED

    print(f'target   : {target}')
    print(f'current  : {current or "(empty database)"}')
    print(f'head     : {head}')

    if opts.dry_run:
        if not pending:
            print('pending  : 0 (already at head) — nothing to run')
            return EXIT_OK
        print(f'pending  : {len(pending)}  {fmt(pending)}')
        print('\n--- SQL that would be executed (read-only) ---')
        # Replay only the pending range. Starting from the base revision would
        # re-emit every migration ever written, and a few of the older ones
        # (8db0b7b9269d calls sa.inspect) cannot run against Alembic's offline
        # MockConnection — so a dry run would die on migrations that are long
        # since applied, hiding the SQL that actually matters.
        spec = f'{current}:{opts.revision}' if current else opts.revision
        return EXIT_OK if run_flask_db(['--sql', spec]) == 0 else EXIT_FAILED

    if not pending:
        print('pending  : 0 — schema is already at head, nothing to do.')
        return EXIT_OK

    print(f'pending  : {len(pending)}  {fmt(pending)}')
    if opts.backup:
        print('backup   : taking a schema-only pg_dump first')

    if not opts.yes:
        confirm()

    lock_conn = None
    try:
        if not opts.no_lock and url.get_backend_name().startswith('postgres'):
            print('  acquiring migration lock...')
            lock_conn = acquire_lock(engine, opts.lock_timeout)

            # Someone may have migrated while we waited for the lock.
            current = current_version(engine)
            head, pending = pending_revisions(script, current)
            if not pending:
                print('  already migrated by another process — nothing to do.')
                return EXIT_OK

        if opts.backup:
            stamp = time.strftime('%Y%m%d-%H%M%S')
            dest = Path(opts.backup_dir) / f'schema-{stamp}.sql'
            print(f'  writing {dest} ...')
            pg_dump_schema(url, dest)

        print('  running `flask db upgrade`...')
        if run_flask_db([opts.revision]) != 0:
            raise MigrationError('`flask db upgrade` exited non-zero')

        landed = current_version(engine)
        if landed != head:
            raise MigrationError(
                f'verification failed: expected {head}, database reports {landed}. '
                'The schema may be partially applied — inspect `flask db current`.'
            )
        print(f'success  : schema is at {landed}')
        return EXIT_OK
    finally:
        release_lock(lock_conn)


def main(argv: list[str] | None = None) -> int:
    try:
        return run(build_parser().parse_args(argv))
    except RefusedError as exc:
        sys.stdout.flush()
        print(f'\nmigrate: REFUSED — {exc}', file=sys.stderr)
        return EXIT_REFUSED
    except MigrationError as exc:
        sys.stdout.flush()
        print(f'\nmigrate: FAILED — {exc}', file=sys.stderr)
        return EXIT_FAILED


if __name__ == '__main__':
    raise SystemExit(main())
