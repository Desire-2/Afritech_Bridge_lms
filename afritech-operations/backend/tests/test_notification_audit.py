"""Notification architecture audit — security, idempotency, delivery, badge.

Regression suite for the central gates in `services.notifications`:

* authorization runs *before* preferences (and before any address is read);
* a Company Secretary never receives restricted financial, payroll, shop or
  Service-Agent events, no matter which module raises them;
* an identical event fired twice inside the window produces one row;
* email failures never fail the business action that triggered the alert;
* the unread badge and the history list only count rows the user may see.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.extensions import db
from app.models import Employee, Notification, Role, Task, User
from app.services import notifications as ns
from app.services import scheduler


def _login(client, email, password='Password123!'):
    r = client.post('/api/auth/login', json={'email': email, 'password': password})
    assert r.status_code == 200, r.get_data(as_text=True)
    return {'Authorization': f"Bearer {r.get_json()['access_token']}"}


def _secretary(email='secretary-audit@afritech.dev'):
    user = User.query.filter_by(email=email).first()
    if user is None:
        user = User(email=email)
        user.set_password('Password123!')
        user.roles.append(Role.query.filter_by(code='company_secretary').first())
        db.session.add(user)
        db.session.flush()
    return user


def _by_email(email):
    return User.query.filter_by(email=email).first()


def _employee(email):
    return Employee.query.filter_by(email=email).first()


def _purge(**filters):
    Notification.query.filter_by(**filters).delete()
    db.session.commit()


# ── 1. restricted events never reach a Company Secretary ─────────────────────


class TestSecretaryRestrictedEvents:
    def test_financial_types_are_blocked_at_the_notify_boundary(self, client):
        secretary = _secretary()
        manager = _by_email('manager@afritech.dev')
        blocked = list(ns.TYPE_PERMISSIONS) + ['shop_sale', 'shop_low_stock',
                                               'shop_closing_approval']
        for ntype in blocked:
            assert ns.notify(secretary, ntype, 'figures 1,000 RWF') is None, \
                f'{ntype} reached a Company Secretary'
        assert Notification.query.filter_by(recipient_id=secretary.id).count() == 0

        # control: the same events still reach a financial reader
        delivered = [t for t in ns.TYPE_PERMISSIONS
                     if ns.notify(manager, t, 'figures 1,000 RWF') is not None]
        assert set(delivered) == set(ns.TYPE_PERMISSIONS)

    def test_shop_events_are_blocked_for_non_shop_roles(self, client):
        secretary = _secretary()
        shop_manager = _by_email('shop_manager@afritech.dev') or _by_email('admin@afritech.dev')
        assert ns.notify(secretary, 'shop_sale', 'Sale 50,000 RWF at till 1') is None
        if shop_manager and shop_manager.has_permission('shop.sales.view'):
            assert ns.notify(shop_manager, 'shop_sale',
                             'Sale 50,000 RWF at till 1') is not None

    def test_unknown_money_event_is_blocked_for_a_secretary(self, client):
        secretary = _secretary()
        accountant = _by_email('accountant@afritech.dev')
        for ntype, message in (
            ('commission_payout', 'Commission of 50,000 RWF paid to an agent'),
            ('service_revenue_alert', 'Revenue is down 12% this week'),
            ('profit_distribution', 'Profit share: 300 USD released'),
            ('salary_revision', 'Your salary band changed'),
        ):
            assert ns.notify(secretary, ntype, message) is None, \
                f'{ntype} leaked through the content guard'
        # a benign unknown event still goes through
        assert ns.notify(secretary, 'custom_ping', 'standup moved to 10:00') is not None
        # a financial reader still receives the financial one
        assert ns.notify(accountant, 'commission_payout',
                         'Commission of 50,000 RWF paid to an agent') is not None

    def test_preferences_cannot_buy_access(self, client):
        """Muting/unmuting is evaluated after authorization, never instead."""
        secretary = _secretary()
        ns.set_preferences(secretary, {
            'email_notifications': True,
            'preferences': [{'type': 'payroll_paid', 'email_enabled': True,
                             'in_app_enabled': True}],
        })
        db.session.flush()
        assert ns.notify(secretary, 'payroll_paid',
                         'Your salary for Oct has been paid: 400,000 RWF.',
                         related_type='payroll_period', related_id=4242) is None
        assert Notification.query.filter_by(
            recipient_id=secretary.id, type='payroll_paid').count() == 0

    def test_secretary_still_receives_coordination_events(self, client):
        secretary = _secretary()
        assert ns.notify(secretary, 'announcement', 'Fire drill at 15:00',
                         related_type='announcement', related_id=7) is not None
        assert ns.notify(secretary, 'admin_request', 'Reassigned to you: Visa letter',
                         related_type='admin_request', related_id=None) is not None


# ── 2. Service-Agent boundary inside the notification layer ──────────────────


class TestServiceAgentBoundary:
    def _task(self, employee_id, title, status='submitted'):
        creator = _by_email('manager@afritech.dev')
        task = Task(title=title, assigned_to=employee_id, status=status,
                    created_by=creator.id if creator else None)
        db.session.add(task)
        db.session.flush()
        return task

    def test_secretary_never_hears_about_a_service_agent_task(self, client):
        secretary = _secretary()
        agent = _employee('agent@afritech.dev')
        manager = _by_email('manager@afritech.dev')
        task = self._task(agent.id, 'Agent secret job')

        payload = f'Task submitted for verification: {task.title}'
        assert ns.notify(secretary, 'task_submitted', payload,
                         related_type='task', related_id=task.id) is None
        # the agent themselves and a service-capable manager still hear it
        assert ns.notify(agent.user, 'task_submitted', payload,
                         related_type='task', related_id=task.id) is not None
        assert ns.notify(manager, 'task_submitted', payload,
                         related_type='task', related_id=task.id) is not None

    def test_secretary_still_hears_about_non_agent_tasks(self, client):
        secretary = _secretary()
        instructor = _employee('instructor@afritech.dev')
        task = self._task(instructor.id, 'Grade cohort 12')
        assert ns.notify(secretary, 'task_submitted',
                         f'Task submitted for verification: {task.title}',
                         related_type='task', related_id=task.id) is not None


# ── 3. idempotency ───────────────────────────────────────────────────────────


class TestIdempotency:
    def test_identical_event_is_delivered_once(self, client):
        manager = _by_email('manager@afritech.dev')
        kwargs = dict(related_type='task', related_id=987654)
        first = ns.notify(manager, 'task_assigned', 'Same payload', **kwargs)
        second = ns.notify(manager, 'task_assigned', 'Same payload', **kwargs)
        assert first is not None
        assert second is None, 'duplicate event produced a second notification'
        assert Notification.query.filter_by(
            recipient_id=manager.id, type='task_assigned',
            related_id=987654).count() == 1

    def test_same_event_after_the_window_notifies_again(self, client):
        manager = _by_email('manager@afritech.dev')
        kwargs = dict(related_type='task', related_id=987655)
        first = ns.notify(manager, 'task_assigned', 'Same payload', **kwargs)
        assert first is not None
        first.created_at = (datetime.now(timezone.utc)
                            - timedelta(seconds=ns.EVENT_DEDUP_WINDOW_SECONDS + 5))
        db.session.flush()
        assert ns.notify(manager, 'task_assigned', 'Same payload', **kwargs) is not None

    def test_distinct_payload_is_not_treated_as_a_duplicate(self, client):
        manager = _by_email('manager@afritech.dev')
        kwargs = dict(related_type='task', related_id=987656)
        assert ns.notify(manager, 'task_assigned', 'first pass', **kwargs) is not None
        assert ns.notify(manager, 'task_assigned', 'second pass', **kwargs) is not None

    def test_rule_window_still_applies(self, client):
        manager = _by_email('manager@afritech.dev')
        kwargs = dict(related_type='task', related_id=987657, rule='overdue-task')
        assert ns.notify(manager, 'task_overdue', 'Overdue', **kwargs) is not None
        assert ns.notify(manager, 'task_overdue', 'Overdue', **kwargs) is None


# ── 4. order of operations: authorization → preferences → delivery ───────────


class TestPreferenceOrder:
    def test_authorization_runs_before_preferences(self, client, monkeypatch):
        secretary = _secretary()
        manager = _by_email('manager@afritech.dev')
        calls = []
        original = ns.get_notification_preference

        def spy(user_id, notification_type):
            calls.append((user_id, notification_type))
            return original(user_id, notification_type)

        monkeypatch.setattr(ns, 'get_notification_preference', spy)

        assert ns.notify(secretary, 'cash_shortage',
                         'Cash shortage detected: 12,000 RWF') is None
        assert calls == [], 'preferences were consulted for an unauthorized recipient'

        assert ns.notify(manager, 'cash_shortage',
                         'Cash shortage detected: 12,000 RWF') is not None
        assert calls, 'an authorized recipient must be evaluated against preferences'

    def test_preferences_only_gate_channels(self, client, monkeypatch):
        manager = _by_email('manager@afritech.dev')
        records = []
        monkeypatch.setattr(ns.email_service, 'email_configured', lambda: True)
        monkeypatch.setattr(ns.email_service, 'send_email',
                            lambda to, subject, html, text=None: records.append(to) or True)
        ns.set_preferences(manager, {'preferences': [
            {'type': 'expense_approval', 'in_app_enabled': False, 'email_enabled': True},
        ]})
        db.session.flush()
        try:
            row = ns.notify(manager, 'expense_approval', 'Expense awaiting approval: 900 RWF')
            assert row is None, 'in-app channel muted by preference'
            assert records, 'email channel still open — preferences act per channel'
        finally:
            ns.set_preferences(manager, {'preferences': [
                {'type': 'expense_approval', 'in_app_enabled': None, 'email_enabled': None},
            ]})
            db.session.flush()

    def test_mandatory_types_ignore_a_muted_in_app_preference(self, client):
        manager = _by_email('manager@afritech.dev')
        ns.set_preferences(manager, {'preferences': [
            {'type': 'cash_shortage', 'in_app_enabled': False},
        ]})
        db.session.flush()
        try:
            row = ns.notify(manager, 'cash_shortage', 'Cash shortage detected: 900 RWF')
            assert row is not None, 'a mandatory alert may not be muted'
        finally:
            ns.set_preferences(manager, {'preferences': [
                {'type': 'cash_shortage', 'in_app_enabled': None},
            ]})
            db.session.flush()


# ── 5. delivery failures stay non-fatal ──────────────────────────────────────


class TestEmailFailureIsNonFatal:
    def test_notify_survives_a_raising_transport(self, client, monkeypatch):
        manager = _by_email('manager@afritech.dev')
        monkeypatch.setattr(ns.email_service, 'email_configured', lambda: True)

        def boom(*args, **kwargs):
            raise RuntimeError('smtp down')

        monkeypatch.setattr(ns.email_service, 'send_email', boom)
        row = ns.notify(manager, 'task_assigned', 'A task awaits you',
                        related_type='task', related_id=555001)
        assert row is not None, 'an email failure dropped the notification'
        assert Notification.query.filter_by(
            recipient_id=manager.id, type='task_assigned',
            related_id=555001).count() == 1

    def test_business_action_succeeds_when_email_raises(self, client, admin_hdr, monkeypatch):
        monkeypatch.setattr(ns.email_service, 'email_configured', lambda: True)

        def boom(*args, **kwargs):
            raise RuntimeError('smtp down')

        monkeypatch.setattr(ns.email_service, 'send_email', boom)
        emp = _employee('instructor@afritech.dev')
        r = client.post('/api/tasks', headers=admin_hdr, json={
            'title': 'Email failure must not fail this', 'assigned_to': emp.id,
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        task_id = r.get_json()['task']['id']
        assert Notification.query.filter_by(
            type='task_assigned', related_type='task', related_id=task_id).count() == 1

        Notification.query.filter_by(related_type='task', related_id=task_id).delete()
        from app.models import AuditLog
        AuditLog.query.filter_by(entity='task', entity_id=str(task_id)).delete()
        Task.query.filter_by(id=task_id).delete()
        db.session.commit()


# ── 6. lists and the unread badge are permission-filtered ────────────────────


class TestBadgeVisibility:
    def _rows(self, secretary):
        db.session.add(Notification(
            recipient_id=secretary.id, type='cash_shortage', severity='critical',
            message='Cash shortage detected: 12,000 RWF',
            related_type='daily_closing', related_id=1))
        db.session.add(Notification(
            recipient_id=secretary.id, type='payroll_paid', severity='info',
            message='Salary paid: 400,000 RWF', related_type='payroll_period', related_id=1))
        db.session.add(Notification(
            recipient_id=secretary.id, type='announcement', severity='info',
            message='Fire drill at 15:00', related_type='announcement', related_id=1))
        db.session.flush()

    def test_unread_count_excludes_hidden_rows(self, client):
        secretary = _secretary()
        self._rows(secretary)
        hdr = _login(client, 'secretary-audit@afritech.dev')
        r = client.get('/api/notifications/unread-count', headers=hdr)
        assert r.status_code == 200
        assert r.get_json()['unread'] == 1, 'the badge counted a restricted row'

    def test_history_list_excludes_hidden_rows(self, client):
        secretary = _secretary()
        self._rows(secretary)
        hdr = _login(client, 'secretary-audit@afritech.dev')
        r = client.get('/api/notifications', headers=hdr)
        assert r.status_code == 200
        items = r.get_json()['items']
        types = {n['type'] for n in items}
        assert types == {'announcement'}, types

    def test_marking_hidden_row_read_is_not_possible(self, client):
        secretary = _secretary()
        self._rows(secretary)
        hidden = Notification.query.filter_by(
            recipient_id=secretary.id, type='cash_shortage').first()
        hdr = _login(client, 'secretary-audit@afritech.dev')
        r = client.post(f'/api/notifications/{hidden.id}/read', headers=hdr)
        assert r.status_code == 404

    def test_history_is_paginated_with_a_hard_cap(self, client):
        secretary = _secretary()
        for i in range(3):
            db.session.add(Notification(
                recipient_id=secretary.id, type='announcement', severity='info',
                message=f'note {i}', related_type='announcement', related_id=100 + i))
        db.session.flush()
        hdr = _login(client, 'secretary-audit@afritech.dev')
        r = client.get('/api/notifications?page=1&per_page=100000', headers=hdr)
        assert r.status_code == 200
        body = r.get_json()
        from app.routes.notifications import MAX_PER_PAGE
        assert body['per_page'] <= MAX_PER_PAGE, 'per_page cap not enforced'
        assert len(body['items']) <= MAX_PER_PAGE


# ── 7. the de-duplication watermark must not depend on the channel ───────────


class TestWatermarkSurvivesAMutedChannel:
    """A recipient who reads by e-mail only must not be mailed every run.

    The rule de-duplication looks for a Notification row. When the in-app
    channel was muted `notify()` used to skip the row entirely, so the next
    scheduler run found nothing and re-sent the same e-mail — every
    AUTOMATION_INTERVAL_MINUTES, forever.
    """

    def test_muted_in_app_rule_still_writes_its_watermark(self, client, monkeypatch):
        manager = _by_email('manager@afritech.dev')
        records = []
        monkeypatch.setattr(ns.email_service, 'email_configured', lambda: True)
        monkeypatch.setattr(ns.email_service, 'send_email',
                            lambda to, subject, html, text=None: records.append(to) or True)
        ns.set_preferences(manager, {'preferences': [
            {'type': 'meeting_reminder', 'in_app_enabled': False, 'email_enabled': True},
        ]})
        db.session.flush()
        kw = dict(related_type='meeting', related_id=987901, rule='meeting-reminder')
        try:
            assert ns.notify(manager, 'meeting_reminder',
                             'Meeting tomorrow at 10:00', **kw) is None
            assert Notification.query.filter_by(
                recipient_id=manager.id, type='meeting_reminder',
                related_id=987901).count() == 1, 'no watermark was written'
            assert ns.notify(manager, 'meeting_reminder',
                             'Meeting tomorrow at 10:00', **kw) is None
            assert len(records) == 1, 'a muted rule re-sent its e-mail on the next run'
        finally:
            ns.set_preferences(manager, {'preferences': [
                {'type': 'meeting_reminder', 'in_app_enabled': None, 'email_enabled': None},
            ]})
            Notification.query.filter_by(recipient_id=manager.id, type='meeting_reminder',
                                         related_id=987901).delete()
            db.session.commit()

    def test_muted_type_is_hidden_from_list_and_badge(self, client):
        secretary = _secretary()
        hdr = _login(client, 'secretary-audit@afritech.dev')
        ns.set_preferences(secretary, {'preferences': [
            {'type': 'announcement', 'in_app_enabled': False},
        ]})
        db.session.flush()
        try:
            before = client.get('/api/notifications/unread-count',
                                headers=hdr).get_json()['unread']
            assert ns.notify(secretary, 'announcement',
                             'Muted channel stays out of the badge',
                             related_type='announcement',
                             related_id=555001) is None
            assert Notification.query.filter_by(
                recipient_id=secretary.id, related_id=555001).count() == 1
            after = client.get('/api/notifications/unread-count',
                               headers=hdr).get_json()['unread']
            assert after == before, 'the badge counted an in-app-muted row'
            items = client.get('/api/notifications?per_page=100',
                               headers=hdr).get_json()['items']
            assert all(n['related_id'] != 555001 for n in items), \
                'the history list rendered an in-app-muted row'
        finally:
            ns.set_preferences(secretary, {'preferences': [
                {'type': 'announcement', 'in_app_enabled': None},
            ]})
            Notification.query.filter_by(recipient_id=secretary.id,
                                         related_id=555001).delete()
            # The API calls above committed these rows, so the cleanup has to
            # commit too — a teardown rollback would resurrect them.
            db.session.commit()

    def test_run_all_commits_watermarks_when_every_notify_returns_none(
            self, client, monkeypatch):
        """`run_all()` must persist rows it was not told about.

        The commit gate used to look at the *rule counters*. A muted recipient
        makes `notify()` return None while still queueing the watermark, the
        counter stays 0, the commit was skipped and the row was rolled back —
        which is exactly the state that makes the next run re-send the e-mail.
        """
        from app.services import automation, shop_alerts

        manager = _by_email('manager@afritech.dev')
        instructor = _employee('instructor@afritech.dev')
        marker = 'watermark-only delivery'
        created = []

        # A submitted task guarantees `task_awaiting_verification_alert` calls
        # `notify()` whatever else happens to be in the seeded data.
        probe = Task(title='Watermark probe', assigned_to=instructor.id,
                     status='submitted', created_by=manager.id if manager else None)
        db.session.add(probe)
        db.session.flush()

        def watermark_only(*args, **kwargs):
            row = Notification(
                recipient_id=manager.id, type='task_assigned', severity='info',
                message=marker, related_type='task', related_id=999001)
            db.session.add(row)
            created.append(row)
            return None

        monkeypatch.setattr(automation, 'notify', watermark_only)
        # Shop rules call the fan-out helper directly; silence it too so the
        # run really is "every notify() returned nothing".
        monkeypatch.setattr(shop_alerts, 'notify_users_with_permission',
                            lambda *a, **k: [])
        try:
            automation.run_all()
            assert created, 'no rule called notify() — the test proves nothing'
            db.session.remove()  # drop the session the way teardown does
            kept = Notification.query.filter_by(message=marker).count()
            assert kept >= 1, 'run_all() rolled back its own watermark rows'
        finally:
            Notification.query.filter_by(message=marker).delete()
            Task.query.filter_by(title='Watermark probe').delete()
            db.session.commit()


# ── 8. the e-mail path runs the same gate as the in-app path ─────────────────


class TestEmailDispatchAuthorization:
    def test_direct_email_dispatch_enforces_the_full_gate(self, client, monkeypatch):
        """`email_for_recipient()` is public — it may not skip `can_receive()`."""
        secretary = _secretary()
        agent = _employee('agent@afritech.dev')
        manager = _by_email('manager@afritech.dev')
        task = Task(title='Agent-only job', assigned_to=agent.id, status='submitted',
                    created_by=manager.id if manager else None)
        db.session.add(task)
        db.session.flush()

        records = []
        monkeypatch.setattr(ns.email_service, 'email_configured', lambda: True)
        monkeypatch.setattr(ns.email_service, 'send_email',
                            lambda to, subject, html, text=None: records.append(to) or True)
        payload = f'Task submitted for verification: {task.title}'

        assert ns.email_for_recipient(
            secretary, 'task_submitted', payload, 'info',
            related_type='task', related_id=task.id) is False
        assert records == [], 'a direct call mailed a recipient that fails can_receive()'
        # control: the gate still lets a legitimate recipient through
        assert ns.email_for_recipient(
            manager, 'task_submitted', payload, 'info',
            related_type='task', related_id=task.id) is True
        assert records == [manager.email]
