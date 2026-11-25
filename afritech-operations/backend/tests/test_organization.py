"""Tests for branch and department management (organization API)."""
import pytest

from app.extensions import db
from app import models as m
from tests.conftest import auth_header


SINGULAR = {'branches': 'branch', 'departments': 'department'}


@pytest.fixture(autouse=True)
def _no_leaked_org_rows():
    """Route handlers commit, so remove rows this module creates after each test."""
    names = ('Branch', 'Department', 'AuditLog')
    before = {n: {row.id for row in getattr(m, n).query.all()} for n in names}
    yield
    for n in names:
        cls = getattr(m, n)
        for row in cls.query.filter(cls.id.notin_(before[n] or {0})).all():
            db.session.delete(row)
    db.session.commit()


def _create(client, hdr, kind, **kwargs):
    payload = {'name': 'Rwanda Branch', 'code': 'rw'}
    payload.update(kwargs)
    r = client.post(f'/api/organization/{kind}', headers=hdr, json=payload)
    assert r.status_code == 201, r.get_data(as_text=True)
    return r.get_json()[SINGULAR[kind]]


def test_branch_full_lifecycle(client, admin_token):
    hdr = auth_header(admin_token)
    branch = _create(client, hdr, 'branches', city='Kigali', phone='+250 700 000 000')

    assert branch['code'] == 'RW'
    assert branch['is_active'] is True

    listed = client.get('/api/organization/branches?search=rwanda', headers=hdr).get_json()
    assert listed['total'] == 1
    assert listed['items'][0]['id'] == branch['id']

    patched = client.patch(f"/api/organization/branches/{branch['id']}", headers=hdr,
                           json={'city': 'Musanze', 'name': 'Northern Branch'})
    assert patched.status_code == 200, patched.get_data(as_text=True)
    assert patched.get_json()['branch']['city'] == 'Musanze'

    detail = client.get(f"/api/organization/branches/{branch['id']}", headers=hdr).get_json()
    assert detail['branch']['name'] == 'Northern Branch'
    assert detail['branch']['employee_count'] == 0
    assert detail['branch']['recent_employees'] == []

    archived = client.delete(f"/api/organization/branches/{branch['id']}", headers=hdr)
    assert archived.status_code == 200
    assert archived.get_json()['branch']['is_active'] is False

    active = client.get('/api/organization/branches?is_active=active', headers=hdr).get_json()
    assert all(b['id'] != branch['id'] for b in active['items'])
    inactive = client.get('/api/organization/branches?is_active=inactive', headers=hdr).get_json()
    assert any(b['id'] == branch['id'] for b in inactive['items'])

    restored = client.post(f"/api/organization/branches/{branch['id']}/restore", headers=hdr)
    assert restored.status_code == 200
    assert restored.get_json()['branch']['is_active'] is True


def test_department_full_lifecycle(client, manager_token):
    hdr = auth_header(manager_token)
    dept = _create(client, hdr, 'departments', description='Client services', code='cx')

    assert dept['code'] == 'CX'
    assert dept['description'] == 'Client services'

    patched = client.patch(f"/api/organization/departments/{dept['id']}", headers=hdr,
                           json={'description': 'Customer experience', 'code': 'cx'})
    assert patched.status_code == 200, patched.get_data(as_text=True)
    assert patched.get_json()['department']['description'] == 'Customer experience'

    archived = client.delete(f"/api/organization/departments/{dept['id']}", headers=hdr)
    assert archived.status_code == 200
    restored = client.post(f"/api/organization/departments/{dept['id']}/restore", headers=hdr)
    assert restored.get_json()['department']['is_active'] is True


def test_validation_and_duplicate_codes(client, admin_token):
    hdr = auth_header(admin_token)
    _create(client, hdr, 'branches', code='HQX')

    duplicate = client.post('/api/organization/branches', headers=hdr,
                            json={'name': 'Duplicate', 'code': 'hqx'})
    assert duplicate.status_code == 400
    assert 'already exists' in duplicate.get_json()['error']

    missing = client.post('/api/organization/departments', headers=hdr,
                          json={'name': 'No code'})
    assert missing.status_code == 400

    bad_filter = client.get('/api/organization/branches?is_active=maybe', headers=hdr)
    assert bad_filter.status_code == 400

    not_found = client.patch('/api/organization/branches/999999', headers=hdr,
                             json={'name': 'Ghost'})
    assert not_found.status_code == 404


def test_permissions_and_summary(client, admin_token, agent_token):
    agent_hdr = auth_header(agent_token)
    assert client.get('/api/organization/branches', headers=agent_hdr).status_code == 403
    assert client.post('/api/organization/departments', headers=agent_hdr,
                       json={'name': 'Nope', 'code': 'NOP'}).status_code == 403

    summary = client.get('/api/organization/summary', headers=auth_header(admin_token))
    assert summary.status_code == 200
    body = summary.get_json()
    for key in ('branches', 'active_branches', 'departments', 'active_departments',
                'employees', 'unassigned_employees'):
        assert key in body


def test_legacy_pickers_hide_archived_rows(client, admin_token):
    hdr = auth_header(admin_token)
    hidden = _create(client, hdr, 'branches', name='Hidden Branch', code='HID',
                     is_active=False)

    branches = client.get('/api/employees/branches', headers=hdr).get_json()['branches']
    assert all(b['id'] != hidden['id'] for b in branches)

    departments = client.get('/api/employees/departments', headers=hdr).get_json()['departments']
    assert all(d['is_active'] for d in departments)
