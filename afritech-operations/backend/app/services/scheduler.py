"""In-process scheduler for the automation engine.

`services.automation` implements every alerting rule, but nothing ever called
it — no cron, no CLI, no route — so scheduled notifications (task due
tomorrow, meeting reminders, stale requests, …) never reached the bell badge.
A single daemon thread now runs `run_all()` on an interval.

Guardrails:
  * disabled under TESTING and when ``AUTOMATION_ENABLED`` is false
  * skipped in the Werkzeug reloader's parent process (only the worker runs it)
  * `AUTOMATION_INTERVAL_MINUTES=0` turns it off entirely
Repeated runs are safe: alert rules pass a ``rule`` name and `notify()` skips
a duplicate for the same item inside ``NOTIFY_RULE_DEDUP_HOURS``.
"""
import os
import threading
import time

_lock = threading.Lock()
_started = False


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
    # dev reloader: the parent process only watches files.
    if app.debug and os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        return False
    minutes = int(app.config.get('AUTOMATION_INTERVAL_MINUTES', 15) or 0)
    if minutes <= 0:
        return False

    with _lock:
        if _started:
            return False
        _started = True

        def loop():
            while True:
                time.sleep(minutes * 60)
                run_automation_once(app)

        threading.Thread(target=loop, daemon=True, name='automation-scheduler').start()
        app.logger.info('automation scheduler started (every %d min)', minutes)
        return True
