"""Pytest fixtures for backend unit tests.

Uses the development config / SQLite DB so every session starts from a clean
seed_dev() state, giving each test a known baseline.  Tests that modify
data should NOT leak state to subsequent tests.
"""
import pytest
from app import create_app
from app.extensions import db as _db


@pytest.fixture(scope='session')
def app(request):
    _app = create_app('testing')
    with _app.app_context():
        from app.seeds import seed_dev
        seed_dev()
    return _app


@pytest.fixture(autouse=True)
def _push_context(app):
    with app.app_context():
        _db.session.begin_nested()
        yield
        _db.session.rollback()


@pytest.fixture()
def client(app):
    return app.test_client()


# ── auth helpers ──────────────────────────────────────────────────────────────


def login(client, email, password='Password123!'):
    r = client.post('/api/auth/login', json={'email': email, 'password': password})
    assert r.status_code == 200, r.get_data(as_text=True)
    return r.get_json()['access_token']


def auth_header(token):
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture()
def admin_token(client):
    return login(client, 'admin@afritech.dev')


@pytest.fixture()
def manager_token(client):
    return login(client, 'manager@afritech.dev')


@pytest.fixture()
def agent_token(client):
    return login(client, 'agent@afritech.dev')


@pytest.fixture()
def accountant_token(client):
    return login(client, 'accountant@afritech.dev')


@pytest.fixture()
def instructor_token(client):
    return login(client, 'instructor@afritech.dev')


@pytest.fixture()
def admin_hdr(admin_token):
    return auth_header(admin_token)


@pytest.fixture()
def manager_hdr(manager_token):
    return auth_header(manager_token)


@pytest.fixture()
def agent_hdr(agent_token):
    return auth_header(agent_token)


@pytest.fixture()
def accountant_hdr(accountant_token):
    return auth_header(accountant_token)


@pytest.fixture()
def instructor_hdr(instructor_token):
    return auth_header(instructor_token)
