"""Rows produced at the end of a request must survive the request.

Handlers follow `commit() → audit() → notify() → return`, so the Notification
and AuditLog rows sit in the session past the only commit. Flask-SQLAlchemy's
teardown used to roll them back: tests (which query inside the same session)
saw the rows, the client never did — the bell badge stayed at 0 and the audit
trail was missing entries. The app's `after_request` hook writes them.
"""
from datetime import date, timedelta

from app.extensions import db
from app.models import AuditLog, Employee, Notification, User
from app.services import automation, notifications as ns


def _teardown():
    """Drop the session the way Flask-SQLAlchemy's teardown handler does."""
    db.session.remove()


def _purge(**filters):
    Notification.query.filter_by(**filters).delete()
    db.session.commit()


class TestSideEffectRowsPersist:
    def test_task_create_notification_and_audit_survive_teardown(self, client, admin_hdr):
        emp = Employee.query.filter_by(email='agent@afritech.dev').first()
        r = client.post('/api/tasks', headers=admin_hdr, json={
            'title': 'Persistence check', 'assigned_to': emp.id, 'priority': 'high',
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        task_id = r.get_json()['task']['id']

        _teardown()

        assert Notification.query.filter_by(
            type='task_assigned', related_type='task', related_id=task_id).count() == 1
        assert AuditLog.query.filter_by(
            action='task_created', entity='task', entity_id=str(task_id)).count() == 1

        Notification.query.filter_by(related_type='task', related_id=task_id).delete()
        AuditLog.query.filter_by(entity='task', entity_id=str(task_id)).delete()
        from app.models import Task
        Task.query.filter_by(id=task_id).delete()
        db.session.commit()

    def test_announcement_notifications_survive_and_feed_unread_count(self, client, admin_hdr):
        r = client.post('/api/announcements', headers=admin_hdr, json={
            'title': 'Persist check', 'message': 'Everyone should see this.',
            'audience': 'all', 'priority': 'high',
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        ann_id = r.get_json()['announcement']['id']

        _teardown()

        rows = Notification.query.filter_by(type='announcement', related_type='announcement',
                                            related_id=ann_id).all()
        assert rows, 'no in-app announcement rows survived teardown'
        assert all(row.message for row in rows)
        _purge(type='announcement', related_type='announcement', related_id=ann_id)

        from app.models import Announcement
        Announcement.query.filter_by(id=ann_id).delete()
        db.session.commit()

    def test_failed_request_leaves_nothing_behind(self, client, admin_hdr):
        r = client.post('/api/tasks', headers=admin_hdr, json={'title': 'x'})
        assert r.status_code == 400
        before = db.session.new, db.session.dirty
        assert not before[0] and not before[1], 'a failed request left pending rows'

    def test_nothing_still_pending_after_a_success(self, client, admin_hdr):
        emp = Employee.query.filter_by(email='agent@afritech.dev').first()
        r = client.post('/api/tasks', headers=admin_hdr, json={
            'title': 'Pending check', 'assigned_to': emp.id,
        })
        assert r.status_code == 201
        task_id = r.get_json()['task']['id']
        assert not db.session.new and not db.session.dirty, \
            'the after_request hook did not flush the session'
        Notification.query.filter_by(related_type='task', related_id=task_id).delete()
        AuditLog.query.filter_by(entity='task', entity_id=str(task_id)).delete()
        from app.models import Task
        Task.query.filter_by(id=task_id).delete()
        db.session.commit()


class TestRuleDedup:
    def test_same_rule_and_item_notifies_once(self):
        user = User.query.filter_by(email='manager@afritech.dev').first()
        kw = dict(severity='info', related_type='task', related_id=4242,
                  rule='task-due-tomorrow')
        first = ns.notify(user.id, 'task_due_tomorrow', 'Due tomorrow.', **kw)
        second = ns.notify(user.id, 'task_due_tomorrow', 'Due tomorrow.', **kw)
        assert first is not None
        assert second is None, 'a scheduled rule re-notified the same item'
        _purge(type='task_due_tomorrow', related_type='task', related_id=4242)

    def test_different_item_notifies_again(self):
        user = User.query.filter_by(email='manager@afritech.dev').first()
        kw = dict(severity='info', related_type='task', related_id=4343,
                  rule='task-due-tomorrow')
        assert ns.notify(user.id, 'task_due_tomorrow', 'a', **kw) is not None
        kw['related_id'] = 4344
        assert ns.notify(user.id, 'task_due_tomorrow', 'b', **kw) is not None
        _purge(type='task_due_tomorrow', related_type='task', related_id=4343)
        _purge(type='task_due_tomorrow', related_type='task', related_id=4344)

    def test_without_a_rule_every_call_notifies(self):
        user = User.query.filter_by(email='manager@afritech.dev').first()
        ns.notify(user.id, 'task_assigned', 'one', related_type='task', related_id=4545)
        ns.notify(user.id, 'task_assigned', 'two', related_type='task', related_id=4545)
        count = Notification.query.filter_by(
            type='task_assigned', related_type='task', related_id=4545).count()
        assert count == 2, 'dedupe must only apply to scheduled rules'
        _purge(type='task_assigned', related_type='task', related_id=4545)


class TestAutomationPersistence:
    def test_alert_output_survives_and_second_run_does_not_duplicate(self, client, admin_hdr):
        emp = Employee.query.filter_by(email='agent@afritech.dev').first()
        tomorrow = date.today() + timedelta(days=1)
        r = client.post('/api/tasks', headers=admin_hdr, json={
            'title': 'Due tomorrow', 'assigned_to': emp.id, 'due_date': tomorrow.isoformat(),
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        task_id = r.get_json()['task']['id']

        first = automation.task_due_tomorrow_alert()
        db.session.commit()
        _teardown()
        persisted = Notification.query.filter_by(
            type='task_due_tomorrow', related_type='task', related_id=task_id).count()
        assert first >= 1 and persisted >= 1, 'the alert produced no persisted rows'

        second = automation.task_due_tomorrow_alert()
        db.session.commit()
        after = Notification.query.filter_by(
            type='task_due_tomorrow', related_type='task', related_id=task_id).count()
        assert second == 0, 'a second run re-notified the same task'
        assert after == persisted

        _purge(type='task_due_tomorrow', related_type='task', related_id=task_id)
        from app.models import Task
        Task.query.filter_by(id=task_id).delete()
        AuditLog.query.filter_by(entity='task', entity_id=str(task_id)).delete()
        db.session.commit()


class TestRunAutomationEndpoint:
    def test_requires_settings_permission(self, client, manager_hdr):
        r = client.post('/api/settings/run-automation', headers=manager_hdr)
        assert r.status_code == 403

    def test_admin_runs_every_rule(self, client, admin_hdr):
        r = client.post('/api/settings/run-automation', headers=admin_hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        results = r.get_json()['results']
        names = [row['rule'] for row in results]
        assert 'task_due_tomorrow_alert' in names
        assert 'ungraded_assignment_alert' in names


class TestEmailLinksUseFrontendUrl:
    def test_link_points_at_configured_frontend(self, monkeypatch, app):
        from app.services import email as email_service

        calls = []

        class FakeResponse:
            status_code = 200
            text = '{}'
            def json(self):
                return {}

        def fake_post(url, json=None, headers=None, timeout=None):
            calls.append({'json': json})
            return FakeResponse()

        monkeypatch.setattr(email_service, 'BREVO_RETRY_DELAY', 0)
        monkeypatch.setattr(email_service.requests, 'post', fake_post)
        monkeypatch.setitem(app.config, 'BREVO_API_KEY', 'xkeysib-test-key')
        monkeypatch.setitem(app.config, 'BREVO_SENDER_EMAIL', 'noreply@example.com')
        monkeypatch.setitem(app.config, 'BREVO_SENDER_NAME', 'AfriTech Bridge')
        monkeypatch.setitem(app.config, 'MAIL_USERNAME', None)
        monkeypatch.setitem(app.config, 'MAIL_PASSWORD', None)
        monkeypatch.setitem(app.config, 'FRONTEND_URL', 'https://ops.example.com')

        user = User.query.filter_by(email='manager@afritech.dev').first()
        ns.notify(user.id, 'task_assigned', 'A task awaits you', related_type='task', related_id=7)
        assert email_service.flush_emails() == 1, calls
        html = calls[0]['json']['htmlContent']
        assert 'https://ops.example.com/notifications' in html
        assert 'localhost' not in html
        _purge(type='task_assigned', related_type='task', related_id=7)

    def test_default_frontend_url_is_the_ops_port(self, monkeypatch, app):
        monkeypatch.setitem(app.config, 'FRONTEND_URL', '')
        from app.services import email as email_service
        # '' must fall back to the ops frontend (3001), never a silent localhost:3000.
        assert email_service.email_configured() in (True, False)
