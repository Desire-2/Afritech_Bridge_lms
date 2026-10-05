"""In-process scheduler for the automation engine.

`services.automation` implements every alerting rule, but nothing ever called
it — no cron, no CLI, no route — so scheduled notifications (task due
tomorrow, meeting reminders, stale requests, …) never reached the bell badge.
A single daemon thread now runs `run_all()` on an interval, inside the server
process: it needs no frontend, no browser and no external cron.

Guardrails:
  * disabled under TESTING and when ``AUTOMATION_ENABLED`` is false
  * skipped **only** in the Werkzeug reloader's parent process (the file
    watcher) — the serving child starts it. Skipping whenever `app.debug` was
    set and ``WERKZEUG_RUN_MAIN`` was absent used to disable the scheduler for
    `flask run --no-reload`, which is exactly how this app is served, so every
    reminder silently stopped;
  * `AUTOMATION_INTERVAL_MINUTES=0` turns it off entirely
  * the first run happens ``FIRST_RUN_DELAY_SECONDS`` after boot instead of a
    whole interval later, so a restarted dev server still delivers its pending
    reminders
Repeated runs are safe: alert rules pass a ``rule`` name and `notify()` skips
a duplicate for the same item inside ``NOTIFY_RULE_DEDUP_HOURS``, and the
de-duplication lives in the database, so it survives restarts.
"""
import os
import sys
import threading
import time

_lock = threading.Lock()
_started = False

# First run after boot. Without it the loop sleeps a whole interval before it
# does anything, so a dev server that is restarted (or a fresh deploy) shows no
# reminder at all for AUTOMATION_INTERVAL_MINUTES — the alerts looked dead.
# Re-runs are harmless: `notify()` de-duplicates against the database.
FIRST_RUN_DELAY_SECONDS = 30


def in_reloader_parent(app):
    """True only inside Werkzeug's reloader *parent* (the file watcher).

    Serving processes come in three shapes:
      * reloader child        → ``WERKZEUG_RUN_MAIN == 'true'`` → run here;
      * reloader parent       → debug on, watching files        → skip;
      * single process        → gunicorn, ``flask run --no-reload`,
                                ``python app.py`` without debug → run here.
    """
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        return False
    if not app.debug:
        return False
    argv = sys.argv or []
    if '--no-reload' in argv or '--no-debug' in argv:
        return False
    if not argv:
        return False
    program = os.path.basename(argv[0]).lower()
    # `flask run` / `python -m flask run` and `python app.py` both boot a
    # reloader parent when debug is on; anything else (gunicorn, wsgi, …)
    # serves from this process.
    return program.startswith('flask') or program.endswith('.py')


def run_automation_once(app):
    """Run every alert rule once and persist whatever it produced."""
    from ..extensions import db
    from .automation import run_all

    with app.app_context():
        try:
            results = run_all()
            db.session.commit()
            app.logger.info(
                'automation: %s',
                ', '.join(f'{name}={value}' for name, value in results),
            )
            return results
        except Exception:
            db.session.rollback()
            app.logger.exception('automation run failed')
            return None


def start_automation_scheduler(app):
    """Start the background runner. Returns True when a thread was started."""
    global _started

    if app.config.get('TESTING'):
        return False
    if not app.config.get('AUTOMATION_ENABLED', True):
        return False
    if in_reloader_parent(app):
        return False
    minutes = int(app.config.get('AUTOMATION_INTERVAL_MINUTES', 15) or 0)
    if minutes <= 0:
        return False

    with _lock:
        if _started:
            return False
        _started = True

        def loop():
            # One early run so a freshly started server actually delivers its
            # pending reminders, then the configured cadence.
            time.sleep(FIRST_RUN_DELAY_SECONDS)
            run_automation_once(app)
            while True:
                time.sleep(minutes * 60)
                run_automation_once(app)

        threading.Thread(target=loop, daemon=True, name='automation-scheduler').start()
        app.logger.info('automation scheduler started (every %d min)', minutes)
        return True
