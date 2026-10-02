"""Brevo transactional API transport and SMTP fallback.

Mirrors the LMS contract: `BREVO_API_KEY` + `BREVO_SENDER_EMAIL` select the
Brevo HTTP API, otherwise delivery falls back to `MAIL_*` SMTP, and with
neither set email is disabled (notifications stay in-app). Nothing is sent
over the network - the transport calls are monkeypatched.
"""
import pytest
from unittest.mock import MagicMock

from app.models import User
from app.services import email as email_service
from app.services import notifications as ns


class FakeResponse:
    def __init__(self, status_code=200, text='ok'):
        self.status_code = status_code
        self.text = text


@pytest.fixture
def brevo(monkeypatch, app):
    """Enable the Brevo transport and capture outgoing API calls."""
    calls = []

    def fake_post(url, json=None, headers=None, timeout=None):
        calls.append({'url': url, 'json': json, 'headers': headers})
        return FakeResponse()

    monkeypatch.setattr(email_service, 'BREVO_RETRY_DELAY', 0)
    monkeypatch.setattr(email_service.requests, 'post', fake_post)
    monkeypatch.setitem(app.config, 'BREVO_API_KEY', 'xkeysib-test-key')
    monkeypatch.setitem(app.config, 'BREVO_SENDER_EMAIL', 'noreply@example.com')
    monkeypatch.setitem(app.config, 'BREVO_SENDER_NAME', 'AfriTech Bridge')
    monkeypatch.setitem(app.config, 'MAIL_USERNAME', None)
    monkeypatch.setitem(app.config, 'MAIL_PASSWORD', None)
    return calls


def _clear_all(monkeypatch, app):
    monkeypatch.setitem(app.config, 'BREVO_API_KEY', '')
    monkeypatch.setitem(app.config, 'BREVO_SENDER_EMAIL', '')
    monkeypatch.setitem(app.config, 'MAIL_USERNAME', None)
    monkeypatch.setitem(app.config, 'MAIL_PASSWORD', None)


class TestTransportSelection:
    def test_configured_when_only_brevo_is_set(self, brevo):
        assert email_service.email_configured() is True
        settings = email_service.email_settings()
        assert settings['brevo_api_key'] == 'xkeysib-test-key'
        assert settings['brevo_sender_email'] == 'noreply@example.com'
        assert email_service.brevo_configured(settings) is True

    def test_configured_when_only_smtp_is_set(self, monkeypatch, app):
        _clear_all(monkeypatch, app)
        monkeypatch.setitem(app.config, 'MAIL_USERNAME', 'smtp@example.com')
        monkeypatch.setitem(app.config, 'MAIL_PASSWORD', 'secret')
        assert email_service.email_configured() is True
        assert email_service.brevo_configured() is False

    def test_disabled_when_no_transport(self, monkeypatch, app):
        _clear_all(monkeypatch, app)
        assert email_service.email_configured() is False
        assert email_service.send_email('a@example.com', 'Subject', '<p>hi</p>') is False

    def test_brevo_selected_when_both_are_set(self, brevo, monkeypatch, app):
        monkeypatch.setitem(app.config, 'MAIL_USERNAME', 'smtp@example.com')
        monkeypatch.setitem(app.config, 'MAIL_PASSWORD', 'secret')
        assert email_service.brevo_configured() is True


class TestBrevoDelivery:
    def test_send_email_posts_to_brevo_api(self, brevo):
        assert email_service.send_email('to@example.com', 'Subject', '<p>hi</p>', text='hi') is True
        sent = email_service.flush_emails()
        assert sent == 1
        assert len(brevo) == 1
        call = brevo[0]
        assert call['url'] == email_service.BREVO_ENDPOINT
        assert call['headers']['api-key'] == 'xkeysib-test-key'
        assert call['json']['sender'] == {'email': 'noreply@example.com', 'name': 'AfriTech Bridge'}
        assert call['json']['to'] == [{'email': 'to@example.com'}]
        assert call['json']['subject'] == 'Subject'
        assert call['json']['htmlContent'] == '<p>hi</p>'
        assert call['json']['textContent'] == 'hi'

    def test_api_error_is_retried_then_fails(self, monkeypatch, app, brevo):
        attempts = []

        def failing_post(url, json=None, headers=None, timeout=None):
            attempts.append(url)
            return FakeResponse(status_code=500, text='server error')

        monkeypatch.setattr(email_service.requests, 'post', failing_post)
        assert email_service.send_email('to@example.com', 'Subject', '<p>hi</p>') is True
        assert email_service.flush_emails() == 0
        assert len(attempts) == email_service.BREVO_RETRIES

    def test_network_error_returns_false(self, monkeypatch, app, brevo):
        def boom(url, json=None, headers=None, timeout=None):
            raise email_service.requests.RequestException('connection refused')

        monkeypatch.setattr(email_service.requests, 'post', boom)
        assert email_service.send_email_now('to@example.com', 'Subject', '<p>hi</p>') is False

    def test_notification_email_uses_brevo(self, brevo):
        user = User.query.filter_by(email='agent@afritech.dev').first()
        user.email_notifications = True
        assert ns.email_for_recipient(user, 'announcement', 'New announcement posted', 'info') is True
        assert email_service.flush_emails() == 1
        assert brevo[0]['json']['subject'].startswith('[AfriTech Bridge] ')


class TestSmtpFallback:
    def test_send_email_uses_smtp_when_brevo_absent(self, monkeypatch, app):
        _clear_all(monkeypatch, app)
        monkeypatch.setitem(app.config, 'MAIL_USERNAME', 'smtp@example.com')
        monkeypatch.setitem(app.config, 'MAIL_PASSWORD', 'secret')
        server = MagicMock()
        monkeypatch.setattr(email_service.smtplib, 'SMTP', lambda *a, **k: server)

        assert email_service.send_email('to@example.com', 'Subject', '<p>hi</p>') is True
        assert email_service.flush_emails() == 1
        server.login.assert_called_once_with('smtp@example.com', 'secret')
        server.sendmail.assert_called_once()
        server.quit.assert_called_once()
