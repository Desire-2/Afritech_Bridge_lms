"""Announcements must list for every role, and the visibility rules must hold.

Regression: ``service_agent`` was the only system role without
``announcements.view``, so its users got a 403 from ``GET /api/announcements``
(no menu entry either) while every other role listed fine. The "show closed"
toggle was also broken — the frontend omitted ``active_only``, and the backend
treats a missing value as ``'true'``.
"""
from datetime import date, timedelta

import pytest

from app.extensions import db
from app.models import Announcement, AnnouncementAck, User
from app.auth.permissions import ROLE_PERMISSIONS, SYSTEM_ROLES

TODAY = date.today()

ROLE_ACCOUNTS = [
    ('super_admin', 'admin@afritech.dev'),
    ('manager', 'manager@afritech.dev'),
    ('service_agent', 'agent@afritech.dev'),
    ('instructor', 'instructor@afritech.dev'),
    ('accountant', 'accountant@afritech.dev'),
    ('company_secretary', 'secretary@afritech.dev'),
]


@pytest.fixture(autouse=True)
def _no_leaked_announcements():
    """Announcement routes commit, which escapes conftest's savepoint."""
    before = {row.id for row in Announcement.query.all()}
    before_acks = {row.id for row in AnnouncementAck.query.all()}
    yield
    for ack in AnnouncementAck.query.all():
        if ack.id not in before_acks:
            db.session.delete(ack)
    for ann in Announcement.query.all():
        if ann.id not in before:
            db.session.delete(ann)
    db.session.commit()


def _login(client, email):
    r = client.post('/api/auth/login', json={'email': email, 'password': 'Password123!'})
    assert r.status_code == 200, r.get_data(as_text=True)
    return {'Authorization': f'Bearer {r.get_json()["access_token"]}'}


def _publish(client, hdr, **overrides):
    payload = {
        'title': 'Visibility check', 'message': 'Everyone should read this.',
        'audience': 'all', 'publish_date': TODAY.isoformat(),
    }
    payload.update(overrides)
    r = client.post('/api/announcements', headers=hdr, json=payload)
    assert r.status_code == 201, r.get_data(as_text=True)
    return r.get_json()['announcement']


class TestEveryRoleCanList:
    @pytest.mark.parametrize('role,email', ROLE_ACCOUNTS)
    def test_list_returns_200_for_every_system_role(self, client, role, email):
        hdr = _login(client, email)
        r = client.get('/api/announcements', headers=hdr)
        assert r.status_code == 200, (
            f'{role} cannot list announcements: {r.get_data(as_text=True)}')
        assert 'items' in r.get_json()

    @pytest.mark.parametrize('role,email', ROLE_ACCOUNTS)
    def test_company_wide_announcement_reaches_every_role(self, client, role, email):
        _publish(client, _login(client, 'admin@afritech.dev'),
                 title=f'For {role}')
        hdr = _login(client, email)
        titles = [i['title'] for i in client.get(
            '/api/announcements', headers=hdr).get_json()['items']]
        assert f'For {role}' in titles, f'{role} did not see a company-wide notice'

    def test_service_agent_can_read_pending_acknowledgements(self, client):
        """The same permission guards the ack queue the bell links to."""
        hdr = _login(client, 'agent@afritech.dev')
        r = client.get('/api/announcements/pending-acknowledgement', headers=hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        assert 'items' in r.get_json()

    def test_catalogue_grants_announcements_view_to_every_role(self):
        """A new role without announcements.view would silently 403 again."""
        for code in SYSTEM_ROLES:
            if code == 'super_admin':
                continue
            codes = ROLE_PERMISSIONS.get(code, [])
            assert 'announcements.view' in codes, (
                f'role {code} is missing announcements.view')


class TestActiveOnlyToggle:
    def test_default_view_hides_scheduled_and_expired(self, client):
        hdr = _login(client, 'admin@afritech.dev')
        _publish(client, hdr, title='Live')
        _publish(client, hdr, title='Scheduled',
                 publish_date=(TODAY + timedelta(days=3)).isoformat())
        _publish(client, hdr, title='Expired',
                 publish_date=(TODAY - timedelta(days=5)).isoformat(),
                 expiry_date=(TODAY - timedelta(days=1)).isoformat())

        items = client.get('/api/announcements', headers=hdr).get_json()['items']
        titles = [i['title'] for i in items]
        assert 'Live' in titles
        assert 'Scheduled' not in titles, 'a future notice leaked into the live list'
        assert 'Expired' not in titles, 'a closed notice leaked into the live list'

    def test_active_only_false_shows_the_closed_and_scheduled_ones(self, client):
        """The frontend's "show closed" toggle sends exactly this."""
        hdr = _login(client, 'admin@afritech.dev')
        _publish(client, hdr, title='Scheduled',
                 publish_date=(TODAY + timedelta(days=3)).isoformat())
        _publish(client, hdr, title='Expired',
                 publish_date=(TODAY - timedelta(days=5)).isoformat(),
                 expiry_date=(TODAY - timedelta(days=1)).isoformat())

        r = client.get('/api/announcements?active_only=false', headers=hdr)
        assert r.status_code == 200
        titles = [i['title'] for i in r.get_json()['items']]
        assert 'Scheduled' in titles and 'Expired' in titles

    def test_zero_is_the_same_as_false(self, client):
        hdr = _login(client, 'admin@afritech.dev')
        _publish(client, hdr, title='Expired',
                 publish_date=(TODAY - timedelta(days=5)).isoformat(),
                 expiry_date=(TODAY - timedelta(days=1)).isoformat())
        titles = [i['title'] for i in client.get(
            '/api/announcements?active_only=0', headers=hdr).get_json()['items']]
        assert 'Expired' in titles


class TestAudienceScoping:
    def test_custom_audience_only_reaches_its_recipients(self, client):
        from app.models import Employee
        admin = _login(client, 'admin@afritech.dev')
        agent = Employee.query.filter_by(email='agent@afritech.dev').first()
        _publish(client, admin, title='Only for the agent', audience='custom',
                 recipient_ids=[agent.id])

        instructor_titles = [i['title'] for i in client.get(
            '/api/announcements', headers=_login(client, 'instructor@afritech.dev')
        ).get_json()['items']]
        assert 'Only for the agent' not in instructor_titles

        agent_titles = [i['title'] for i in client.get(
            '/api/announcements', headers=_login(client, 'agent@afritech.dev')
        ).get_json()['items']]
        assert 'Only for the agent' in agent_titles

    def test_other_department_post_is_not_listed(self, client):
        from app.models import Department, Employee
        admin = _login(client, 'admin@afritech.dev')
        instructor = Employee.query.filter_by(email='instructor@afritech.dev').first()
        other = Department.query.filter(
            Department.id != instructor.department_id).order_by(Department.id).first()
        assert other is not None, 'seed data has no second department'
        _publish(client, admin, title='Dept only', audience='department',
                 department_id=other.id)

        titles = [i['title'] for i in client.get(
            '/api/announcements', headers=_login(client, 'instructor@afritech.dev')
        ).get_json()['items']]
        assert 'Dept only' not in titles
