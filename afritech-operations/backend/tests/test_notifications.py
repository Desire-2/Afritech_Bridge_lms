"""Notification tests: preference API, in-app creation, and email dispatch gating.

Email delivery is gated on (a) SMTP being configured, (b) the user's master
email_notifications switch, and (c) the per-type NotificationPreference rows.
These tests monkeypatch the email transport so nothing is actually sent.
"""
import pytest

from app.extensions import db
from app.models import Notification, NotificationPreference, User
from app.services import notifications as ns


def _prefs(client, header):
    r = client.get('/api/notifications/preferences', headers=header)
    assert r.status_code == 200
    return r.get_json()


class TestNotificationPreferencesApi:
    def test_get_preferences_returns_defaults(self, client, agent_hdr):
        data = _prefs(client, agent_hdr)
        assert data['email_notifications'] is True
        types = {p['type'] for p in data['preferences']}
        assert '*' in types
        assert 'closing_approval' in types
        assert 'cash_shortage' in types
        assert all(p['email_enabled'] for p in data['preferences'])
        # each type row is labelled for the UI
        closing = next(p for p in data['preferences'] if p['type'] == 'closing_approval')
        assert closing['label']

    def test_put_master_email_toggle(self, client, agent_hdr):
        r = client.put('/api/notifications/preferences', headers=agent_hdr,
                       json={'email_notifications': False})
        assert r.status_code == 200
        assert r.get_json()['email_notifications'] is False
        # restore default so later tests in the same session are deterministic
        row = User.query.filter_by(email='agent@afritech.dev').first()
        row.email_notifications = True
        db.session.commit()

    def test_put_per_type_override(self, client, agent_hdr):
        r = client.put('/api/notifications/preferences', headers=agent_hdr, json={
            'preferences': [{'type': 'cash_shortage', 'email_enabled': False, 'in_app_enabled': True}],
        })
        assert r.status_code == 200
        data = r.get_json()
        row = next(p for p in data['preferences'] if p['type'] == 'cash_shortage')
        assert row['email_enabled'] is False
        assert row['in_app_enabled'] is True
        # unrelated types keep the default
        assert all(p['email_enabled'] for p in data['preferences'] if p['type'] != 'cash_shortage')

    def test_put_remove_override_returns_to_default(self, client, agent_hdr):
        client.put('/api/notifications/preferences', headers=agent_hdr, json={
            'preferences': [{'type': 'expense_approval', 'email_enabled': False, 'in_app_enabled': True}],
        })
        r = client.put('/api/notifications/preferences', headers=agent_hdr, json={
            'preferences': [{'type': 'expense_approval', 'email_enabled': None, 'in_app_enabled': None}],
        })
        data = r.get_json()
        row = next(p for p in data['preferences'] if p['type'] == 'expense_approval')
        assert row['email_enabled'] is True  # fell back to the '*' default


class TestNotifyInApp:
    def test_notify_creates_in_app_row(self, client, manager_token, manager_hdr):
        user = User.query.filter_by(email='manager@afritech.dev').first()
        n = ns.notify(user.id, 'closing_approval', 'A closing awaits approval', related_id=42)
        assert n is not None
        assert n.recipient_id == user.id
        assert n.type == 'closing_approval'
        assert n.severity == 'warning'  # default severity mapped from type
        db.session.add(n)
        db.session.commit()
        # visible through the API
        r = client.get('/api/notifications?unread_only=true', headers=manager_hdr)
        assert r.status_code == 200
        items = r.get_json()['items']
        assert items[0]['type'] == 'closing_approval'
        assert items[0]['message'] == 'A closing awaits approval'

    def test_notify_unknown_type_defaults_to_info(self, client, manager_hdr):
        user = User.query.filter_by(email='manager@afritech.dev').first()
        n = ns.notify(user.id, 'some_custom_type', 'uh oh')
        assert n.severity == 'info'

    def test_notify_skips_missing_user(self, client):
        assert ns.notify(999999, 'task_assigned', 'nobody') is None

    def test_in_app_disabled_type_suppresses_row(self, client, agent_hdr):
        agent = User.query.filter_by(email='agent@afritech.dev').first()
        ns.set_preferences(agent, {'preferences': [{'type': 'task_assigned', 'in_app_enabled': False}]})
        db.session.commit()
        n = ns.notify(agent.id, 'task_assigned', 'you have a new task')
        assert n is None
        # restore
        ns.set_preferences(agent, {'preferences': [{'type': 'task_assigned', 'in_app_enabled': True}]})
        db.session.commit()


class TestNotifyEmailDispatch:
    def _enable_email(self, monkeypatch):
        records = []
        monkeypatch.setattr(ns.email_service, 'email_configured', lambda: True)
        monkeypatch.setattr(ns.email_service, 'send_email',
                            lambda to, subject, html, text=None, action_url=None: records.append((to, subject)) or True)
        return records

    def test_email_queued_when_enabled(self, client, monkeypatch):
        records = self._enable_email(monkeypatch)
        manager = User.query.filter_by(email='manager@afritech.dev').first()
        ns.notify(manager.id, 'closing_approval', 'closing pending')
        assert len(records) == 1
        assert records[0][0] == 'manager@afritech.dev'
        assert 'closing' in records[0][1].lower()

    def test_email_suppressed_by_master_toggle(self, client, monkeypatch):
        records = self._enable_email(monkeypatch)
        agent = User.query.filter_by(email='agent@afritech.dev').first()
        ns.set_preferences(agent, {'email_notifications': False})
        db.session.commit()
        try:
            ns.notify(agent.id, 'task_assigned', 'new task')
            assert records == []
        finally:
            agent.email_notifications = True
            db.session.commit()

    def test_email_suppressed_by_per_type_preference(self, client, monkeypatch):
        records = self._enable_email(monkeypatch)
        accountant = User.query.filter_by(email='accountant@afritech.dev').first()
        ns.set_preferences(accountant, {'preferences': [{'type': 'expense_approval', 'email_enabled': False}]})
        db.session.commit()
        try:
            ns.notify(accountant.id, 'expense_approval', 'expense pending')
            assert records == []
            # other types still email
            ns.notify(accountant.id, 'cash_shortage', 'shortage!')
            assert len(records) == 1
            assert records[0][0] == 'accountant@afritech.dev'
        finally:
            agent = User.query.filter_by(email='accountant@afritech.dev').first()
            row = (NotificationPreference.query
                   .filter_by(user_id=agent.id, type='expense_approval').first())
            if row:
                db.session.delete(row)
            db.session.commit()

    def test_no_email_when_smtp_unconfigured(self, client, monkeypatch):
        monkeypatch.setattr(ns.email_service, 'email_configured', lambda: False)
        sent = []
        monkeypatch.setattr(ns.email_service, 'send_email',
                            lambda to, subject, html, text=None, action_url=None: sent.append(1) or True)
        manager = User.query.filter_by(email='manager@afritech.dev').first()
        ns.notify(manager.id, 'closing_approval', 'closing pending')
        assert sent == []