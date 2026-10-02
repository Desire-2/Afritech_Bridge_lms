"""Regression tests for the administrative coordination API.

Covers the crash-prone input paths (bad dates / bad ids / NOT NULL columns) and
the Service-Agent coordination boundary that the meetings, activities and task
workflow endpoints depend on.
"""
import itertools
from datetime import date, datetime, timedelta, timezone

import pytest

from app.extensions import db
from app.models import (
    Activity, AdminRequest, Employee, Meeting, Task, TaskComment,
)

TODAY = date.today()

# Child rows first, so deletes never depend on FK enforcement.
_LEAK_TABLES = (
    'TaskComment', 'ActionItem', 'AgendaItem', 'MeetingMinute', 'MeetingParticipant',
    'ActivityChecklistItem', 'ActivityParticipant', 'Task', 'Meeting', 'Activity',
    'Notification', 'AuditLog',
    'SessionRecord', 'NotificationPreference', 'PasswordResetToken',
    'Employee', 'User',
)


@pytest.fixture(autouse=True)
def _no_leaked_rows():
    """Keep created rows from escaping into later tests.

    Route handlers commit, which ends conftest's savepoint-based isolation, so
    anything this module creates would otherwise outlive the test and skew tests
    that assert on the seeded baseline (e.g. payroll's active-employee count).
    """
    from app import models as m
    before = {n: {row.id for row in getattr(m, n).query.all()} for n in _LEAK_TABLES}
    yield
    for n in _LEAK_TABLES:
        cls = getattr(m, n)
        for row in cls.query.filter(cls.id.notin_(before[n] or {0})).all():
            db.session.delete(row)
    db.session.commit()


@pytest.fixture()
def instructor():
    return Employee.query.filter_by(position='Instructor').first()


@pytest.fixture()
def agent():
    return Employee.query.filter_by(position='Service Agent').first()


def _activity(client, hdr, **kw):
    payload = {'title': 'Quarterly admin review', 'activity_date': TODAY.isoformat()}
    payload.update(kw)
    r = client.post('/api/activities', headers=hdr, json=payload)
    assert r.status_code == 201, r.get_data(as_text=True)
    return r.get_json()['activity']


def _meeting(client, hdr, **kw):
    payload = {'title': 'Admin sync', 'meeting_date': TODAY.isoformat()}
    payload.update(kw)
    r = client.post('/api/meetings', headers=hdr, json=payload)
    assert r.status_code == 201, r.get_data(as_text=True)
    return r.get_json()['meeting']


# ── routing ──────────────────────────────────────────────────────────────────


class TestBlueprintRegistration:
    def test_meetings_list_is_reachable(self, client, admin_hdr):
        assert client.get('/api/meetings', headers=admin_hdr).status_code == 200

    def test_activities_list_is_reachable(self, client, admin_hdr):
        assert client.get('/api/activities', headers=admin_hdr).status_code == 200


# ── activity input validation ────────────────────────────────────────────────


class TestActivityInputValidation:
    def test_position_zero_is_accepted(self, client, admin_hdr):
        activity = _activity(client, admin_hdr)
        r = client.put(f"/api/activities/{activity['id']}",
                       headers=admin_hdr, json={'position': 0})
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['activity']['position'] == 0

    def test_bad_activity_date_is_a_400(self, client, admin_hdr):
        r = client.post('/api/activities', headers=admin_hdr,
                        json={'title': 'x', 'activity_date': 'not-a-date'})
        assert r.status_code == 400

    def test_bad_start_filter_is_a_400(self, client, admin_hdr):
        r = client.get('/api/activities?start=not-a-date', headers=admin_hdr)
        assert r.status_code == 400

    def test_bad_participant_id_is_a_400(self, client, admin_hdr, instructor):
        activity = _activity(client, admin_hdr)
        r = client.post(f"/api/activities/{activity['id']}/participants",
                        headers=admin_hdr, json={'employee_ids': ['abc']})
        assert r.status_code == 400

    def test_unknown_participant_id_is_a_400(self, client, admin_hdr):
        activity = _activity(client, admin_hdr)
        r = client.post(f"/api/activities/{activity['id']}/participants",
                        headers=admin_hdr, json={'employee_ids': [999999]})
        assert r.status_code == 400

    def test_invalid_category_is_rejected(self, client, admin_hdr):
        r = client.post('/api/activities', headers=admin_hdr,
                        json={'title': 'x', 'activity_date': TODAY.isoformat(),
                              'category': 'Nope'})
        assert r.status_code == 400


# ── meeting input validation ─────────────────────────────────────────────────


class TestMeetingInputValidation:
    def test_bad_meeting_date_is_a_400(self, client, admin_hdr):
        r = client.post('/api/meetings', headers=admin_hdr,
                        json={'title': 'x', 'meeting_date': 'not-a-date'})
        assert r.status_code == 400

    def test_bad_start_filter_is_a_400(self, client, admin_hdr):
        assert client.get('/api/meetings?start=nope', headers=admin_hdr).status_code == 400

    def test_bad_participant_id_is_a_400(self, client, admin_hdr):
        meeting = _meeting(client, admin_hdr)
        r = client.post(f"/api/meetings/{meeting['id']}/participants",
                        headers=admin_hdr, json={'employee_ids': ['abc']})
        assert r.status_code == 400

    def test_duplicate_participants_are_added_once(self, client, admin_hdr, instructor):
        meeting = _meeting(client, admin_hdr)
        r = client.post(f"/api/meetings/{meeting['id']}/participants",
                        headers=admin_hdr,
                        json={'employee_ids': [instructor.id, instructor.id]})
        assert r.status_code == 200, r.get_data(as_text=True)
        participants = r.get_json()['meeting']['participants']
        assert len([p for p in participants if p['employee_id'] == instructor.id]) == 1

    def test_removing_an_unknown_participant_is_404(self, client, admin_hdr, instructor):
        meeting = _meeting(client, admin_hdr)
        r = client.delete(
            f"/api/meetings/{meeting['id']}/participants/{instructor.id}",
            headers=admin_hdr)
        assert r.status_code == 404


class TestMeetingActionItems:
    def test_action_item_requires_a_responsible(self, client, admin_hdr):
        meeting = _meeting(client, admin_hdr)
        r = client.post(f"/api/meetings/{meeting['id']}/action-items",
                        headers=admin_hdr, json={'title': 'do it'})
        assert r.status_code == 400

    def test_action_item_null_responsible_does_not_crash(self, client, admin_hdr, instructor):
        meeting = _meeting(client, admin_hdr)
        r = client.post(f"/api/meetings/{meeting['id']}/action-items",
                        headers=admin_hdr,
                        json={'title': 'do it', 'responsible_id': instructor.id,
                              'create_task': False})
        assert r.status_code == 201, r.get_data(as_text=True)
        item_id = r.get_json()['action_item']['id']

        r = client.put(f'/api/meetings/action-items/{item_id}', headers=admin_hdr,
                       json={'responsible_id': None})
        assert r.status_code == 200, r.get_data(as_text=True)

    def test_action_item_deadline_is_parsed_safely(self, client, admin_hdr, instructor):
        meeting = _meeting(client, admin_hdr)
        r = client.post(f"/api/meetings/{meeting['id']}/action-items",
                        headers=admin_hdr,
                        json={'title': 'do it', 'responsible_id': instructor.id,
                              'deadline': 'soon', 'create_task': False})
        assert r.status_code == 400


# ── task workflow ────────────────────────────────────────────────────────────


def _task(client, hdr, assigned_to, **kw):
    payload = {'title': 'Reconcile register', 'assigned_to': assigned_to}
    payload.update(kw)
    r = client.post('/api/tasks', headers=hdr, json=payload)
    assert r.status_code == 201, r.get_data(as_text=True)
    return r.get_json()['task']


class TestTaskWorkflow:
    def test_status_filter_rejects_unknown_status(self, client, admin_hdr):
        assert client.get('/api/tasks?status=nope', headers=admin_hdr).status_code == 400

    def test_full_verification_flow(self, client, admin_hdr, instructor):
        task = _task(client, admin_hdr, instructor.id)
        tid = task['id']

        r = client.put(f'/api/tasks/{tid}', headers=admin_hdr, json={'status': 'in_progress'})
        assert r.status_code == 200
        r = client.put(f'/api/tasks/{tid}', headers=admin_hdr, json={'status': 'submitted'})
        assert r.status_code == 200
        assert r.get_json()['task']['submitted_date'] is not None

        r = client.put(f'/api/tasks/{tid}', headers=admin_hdr, json={'status': 'verified'})
        assert r.status_code == 200
        done = r.get_json()['task']
        assert done['completed_date'] is not None

    def test_rejected_task_reopens_and_clears_stamps(self, client, admin_hdr, instructor):
        task = _task(client, admin_hdr, instructor.id)
        tid = task['id']
        client.put(f'/api/tasks/{tid}', headers=admin_hdr, json={'status': 'in_progress'})
        client.put(f'/api/tasks/{tid}', headers=admin_hdr, json={'status': 'submitted'})
        r = client.put(f'/api/tasks/{tid}', headers=admin_hdr, json={'status': 'rejected'})
        assert r.status_code == 200

        r = client.put(f'/api/tasks/{tid}', headers=admin_hdr, json={'status': 'in_progress'})
        reopened = r.get_json()['task']
        assert reopened['submitted_date'] is None
        assert reopened['completed_date'] is None

    def test_coordinator_can_reopen_a_verified_task(self, client, admin_hdr, instructor):
        task = _task(client, admin_hdr, instructor.id)
        tid = task['id']
        client.put(f'/api/tasks/{tid}', headers=admin_hdr, json={'status': 'in_progress'})
        client.put(f'/api/tasks/{tid}', headers=admin_hdr, json={'status': 'submitted'})
        client.put(f'/api/tasks/{tid}', headers=admin_hdr, json={'status': 'verified'})

        r = client.put(f'/api/tasks/{tid}', headers=admin_hdr, json={'status': 'todo'})
        assert r.status_code == 200, r.get_data(as_text=True)
        reopened = r.get_json()['task']
        assert reopened['submitted_date'] is None
        assert reopened['completed_date'] is None

    def test_assignee_alone_cannot_verify_or_reopen(self, client, admin_hdr, instructor):
        """The assignee may only walk their own task forward, never verify it."""
        task = _task(client, admin_hdr, instructor.id)
        tid = task['id']
        hdr = {'Authorization': 'Bearer ' + _login(client, instructor.user.email)}

        r = client.put(f'/api/tasks/{tid}', headers=hdr, json={'status': 'verified'})
        assert r.status_code == 409

        r = client.put(f'/api/tasks/{tid}', headers=hdr, json={'status': 'in_progress'})
        assert r.status_code == 200
        r = client.put(f'/api/tasks/{tid}', headers=hdr, json={'status': 'todo'})
        assert r.status_code == 409

    def test_assignee_cannot_edit_task_details(self, client, admin_hdr, instructor):
        task = _task(client, admin_hdr, instructor.id)
        hdr = {'Authorization': 'Bearer ' + _login(client, instructor.user.email)}
        r = client.put(f"/api/tasks/{task['id']}", headers=hdr, json={'priority': 'urgent'})
        assert r.status_code == 403

    def test_bad_due_date_is_a_400(self, client, admin_hdr, instructor):
        r = client.post('/api/tasks', headers=admin_hdr,
                        json={'title': 'x', 'assigned_to': instructor.id,
                              'due_date': 'whenever'})
        assert r.status_code == 400

    def test_bad_assignee_is_a_400(self, client, admin_hdr):
        r = client.post('/api/tasks', headers=admin_hdr,
                        json={'title': 'x', 'assigned_to': 'abc'})
        assert r.status_code == 400

    def test_overdue_flag_ignores_submitted(self, client, admin_hdr, instructor):
        overdue = _task(client, admin_hdr, instructor.id,
                        due_date=(TODAY - timedelta(days=3)).isoformat())
        assert overdue['is_overdue'] is True
        assert overdue['is_open'] is True

        r = client.put(f"/api/tasks/{overdue['id']}", headers=admin_hdr,
                       json={'status': 'in_progress'})
        assert r.get_json()['task']['is_open'] is True
        r = client.put(f"/api/tasks/{overdue['id']}", headers=admin_hdr,
                       json={'status': 'submitted'})
        # 'submitted' is still open, so it stays overdue until it is verified
        assert r.get_json()['task']['is_overdue'] is True
        r = client.put(f"/api/tasks/{overdue['id']}", headers=admin_hdr,
                       json={'status': 'verified'})
        assert r.get_json()['task']['is_overdue'] is False

    def test_overdue_filter_returns_open_tasks(self, client, admin_hdr, instructor):
        _task(client, admin_hdr, instructor.id,
              due_date=(TODAY - timedelta(days=1)).isoformat())
        r = client.get('/api/tasks?overdue=true', headers=admin_hdr)
        assert r.status_code == 200
        assert all(t['is_overdue'] for t in r.get_json()['items'])


class TestTaskComments:
    def test_comment_lifecycle(self, client, admin_hdr, instructor):
        task = _task(client, admin_hdr, instructor.id)
        tid = task['id']

        r = client.post(f'/api/tasks/{tid}/comments', headers=admin_hdr,
                        json={'body': 'starting now'})
        assert r.status_code == 201, r.get_data(as_text=True)
        cid = r.get_json()['comment']['id']

        r = client.get(f'/api/tasks/{tid}/comments', headers=admin_hdr)
        assert r.status_code == 200
        assert len(r.get_json()['comments']) == 1

        r = client.delete(f'/api/tasks/comments/{cid}', headers=admin_hdr)
        assert r.status_code == 200
        assert client.get(f'/api/tasks/{tid}/comments',
                          headers=admin_hdr).get_json()['comments'] == []

    def test_empty_comment_is_rejected(self, client, admin_hdr, instructor):
        task = _task(client, admin_hdr, instructor.id)
        r = client.post(f"/api/tasks/{task['id']}/comments",
                        headers=admin_hdr, json={'body': '   '})
        assert r.status_code == 400


# ── authorization boundaries ─────────────────────────────────────────────────


class TestServiceAgentBoundary:
    def test_super_admin_may_assign_to_a_service_agent(self, client, admin_hdr, agent):
        r = client.post('/api/tasks', headers=admin_hdr,
                        json={'title': 'x', 'assigned_to': agent.id})
        assert r.status_code == 201, r.get_data(as_text=True)

    def test_service_operation_manager_may_reach_agents(self, client, manager_hdr, agent):
        """The boundary is permission-based, so a manager keeps full reach."""
        r = client.post('/api/tasks', headers=manager_hdr,
                        json={'title': 'x', 'assigned_to': agent.id})
        assert r.status_code == 201, r.get_data(as_text=True)

    def test_secretary_cannot_assign_to_a_service_agent(self, client, admin_hdr, agent):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.post('/api/tasks', headers=hdr,
                        json={'title': 'x', 'assigned_to': agent.id})
        assert r.status_code == 403
        assert 'Service Agent' in r.get_json()['error']

    def test_secretary_cannot_invite_a_service_agent_to_a_meeting(self, client, admin_hdr, agent):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.post('/api/meetings', headers=hdr,
                        json={'title': 'x', 'meeting_date': TODAY.isoformat(),
                              'participant_ids': [agent.id]})
        assert r.status_code == 403

    def test_secretary_cannot_see_agent_tasks(self, client, admin_hdr, agent, instructor):
        theirs = _task(client, admin_hdr, agent.id, title='Agent task')
        hdr = secretary_hdr(client, admin_hdr)
        ids = {t['id'] for t in client.get('/api/tasks', headers=hdr).get_json()['items']}
        assert theirs['id'] not in ids

        r = client.get(f"/api/tasks/{theirs['id']}", headers=hdr)
        assert r.status_code == 403

    def test_agent_only_sees_own_tasks(self, client, admin_hdr, instructor, agent):
        mine = _task(client, admin_hdr, instructor.id, title='Instructor task')
        theirs = _task(client, admin_hdr, agent.id, title='Agent task')

        hdr = _agent_hdr(client, agent)
        ids = {t['id'] for t in client.get('/api/tasks', headers=hdr).get_json()['items']}
        assert mine['id'] not in ids
        assert theirs['id'] in ids

    def test_agent_cannot_read_another_employees_task(self, client, admin_hdr, instructor, agent):
        task = _task(client, admin_hdr, instructor.id)
        r = client.get(f"/api/tasks/{task['id']}", headers=_agent_hdr(client, agent))
        assert r.status_code == 403


def _login(client, email):
    from tests.conftest import login
    return login(client, email)


def _agent_hdr(client, agent):
    return {'Authorization': f'Bearer {_login(client, agent.user.email)}'}


_seq = itertools.count(1)


def secretary_hdr(client, admin_hdr):
    """Create a Company Secretary account and return its auth header.

    A fresh email per call is required: route handlers commit, which escapes the
    savepoint conftest uses for isolation, so created users outlive the test.
    """
    email = f'secretary{next(_seq)}@afritech.dev'
    r = client.post('/api/users', headers=admin_hdr, json={
        'email': email,
        'password': 'Password123!',
        'roles': ['company_secretary'],
    })
    assert r.status_code == 201, r.get_data(as_text=True)
    return {'Authorization': f'Bearer {_login(client, email)}'}


# ── admin request freshness ──────────────────────────────────────────────────


class TestAdminRequestFreshness:
    """`is_stale` compares a stored timestamp against an aware `now`."""

    def test_is_stale_does_not_raise(self, instructor):
        request = AdminRequest(title='Reconcile', requested_by=instructor.id)
        db.session.add(request)
        db.session.commit()
        assert request.is_stale is False

    def test_is_stale_true_when_left_open_for_days(self, instructor):
        request = AdminRequest(title='Reconcile', requested_by=instructor.id)
        db.session.add(request)
        db.session.flush()
        request.created_at = datetime.now(timezone.utc) - timedelta(days=5)
        db.session.commit()
        assert request.is_stale is True

    def test_is_stale_false_for_a_closed_request(self, instructor):
        request = AdminRequest(title='Reconcile', requested_by=instructor.id,
                               status='closed')
        db.session.add(request)
        db.session.flush()
        request.created_at = datetime.now(timezone.utc) - timedelta(days=5)
        db.session.commit()
        assert request.is_stale is False


# ── role payload hardening ───────────────────────────────────────────────────


class TestRolePayloadHardening:
    def test_duplicate_roles_do_not_break_user_create(self, client, admin_hdr):
        r = client.post('/api/users', headers=admin_hdr, json={
            'email': 'dupe.roles@afritech.dev',
            'password': 'Password123!',
            'roles': ['manager', 'manager', 'accountant', 'accountant'],
            'create_employee': False,
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        assert sorted(r.get_json()['user']['role_codes']) == ['accountant', 'manager']

    def test_duplicate_roles_do_not_break_employee_create(self, client, admin_hdr):
        r = client.post('/api/employees', headers=admin_hdr, json={
            'first_name': 'Dup', 'last_name': 'Roles',
            'email': 'dup.employee@afritech.dev', 'password': 'Password123!',
            'roles': ['service_agent', 'service_agent'],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        employee = Employee.query.filter_by(
            email='dup.employee@afritech.dev').first()
        assert employee is not None
        assert [r.code for r in employee.user.roles] == ['service_agent']

    def test_non_list_roles_is_rejected(self, client, admin_hdr):
        r = client.post('/api/employees', headers=admin_hdr, json={
            'first_name': 'Bad', 'last_name': 'Roles',
            'email': 'bad.roles@afritech.dev', 'password': 'Password123!',
            'roles': 'manager',
        })
        assert r.status_code == 400

    def test_bad_employment_date_is_a_400(self, client, admin_hdr):
        r = client.post('/api/employees', headers=admin_hdr, json={
            'first_name': 'Bad', 'last_name': 'Date',
            'employment_date': 'yesterday',
        })
        assert r.status_code == 400

    def test_bad_branch_id_is_a_400(self, client, admin_hdr):
        r = client.post('/api/employees', headers=admin_hdr, json={
            'first_name': 'Bad', 'last_name': 'Branch', 'branch_id': 'head-office',
        })
        assert r.status_code == 400


# ── task / meeting linkage ───────────────────────────────────────────────────


class TestMeetingTaskLinkage:
    def test_action_item_creates_a_linked_task(self, client, admin_hdr, instructor):
        meeting = _meeting(client, admin_hdr)
        r = client.post(f"/api/meetings/{meeting['id']}/action-items",
                        headers=admin_hdr,
                        json={'title': 'Draft the memo', 'responsible_id': instructor.id,
                              'due_date': TODAY.isoformat()})
        assert r.status_code == 201, r.get_data(as_text=True)
        item = r.get_json()['action_item']
        assert item['task_id']

        task = Task.query.get(item['task_id'])
        assert task.assigned_to == instructor.id
        assert task.meeting_id == meeting['id']

    def test_done_action_item_verifies_its_task(self, client, admin_hdr, instructor):
        meeting = _meeting(client, admin_hdr)
        r = client.post(f"/api/meetings/{meeting['id']}/action-items",
                        headers=admin_hdr,
                        json={'title': 'Draft the memo', 'responsible_id': instructor.id})
        item = r.get_json()['action_item']

        r = client.put(f"/api/meetings/action-items/{item['id']}",
                       headers=admin_hdr, json={'status': 'done'})
        assert r.status_code == 200, r.get_data(as_text=True)
        assert Task.query.get(item['task_id']).status == 'verified'

    def test_agenda_item_converts_to_task_once(self, client, admin_hdr, instructor):
        meeting = _meeting(client, admin_hdr)
        r = client.post(f"/api/meetings/{meeting['id']}/agenda",
                        headers=admin_hdr, json={'title': 'Review budget',
                                                  'presenter_id': instructor.id})
        assert r.status_code == 201, r.get_data(as_text=True)
        item_id = r.get_json()['agenda_item']['id']

        r = client.post(f'/api/meetings/agenda/{item_id}/task', headers=admin_hdr,
                        json={})
        assert r.status_code == 201, r.get_data(as_text=True)
        assert Task.query.get(r.get_json()['task']['id']).assigned_to == instructor.id

        r = client.post(f'/api/meetings/agenda/{item_id}/task', headers=admin_hdr, json={})
        assert r.status_code == 409


class TestSecretaryDataBoundaries:
    """Company Secretary data boundaries.

    The Secretary coordinates the whole company but must never see pay data or
    reach a Service Agent. Both leaked at some point: operational
    ``employees.manage`` was mistaken for pay-data authority, and the employee
    directory ignored the Service Agent boundary entirely.
    """

    def test_employee_directory_hides_service_agents(self, client, admin_hdr, agent, instructor):
        hdr = secretary_hdr(client, admin_hdr)
        ids = {e['id'] for e in client.get('/api/employees?per_page=500', headers=hdr).get_json()['items']}
        assert agent.id not in ids
        assert instructor.id in ids

    def test_search_cannot_surface_a_service_agent(self, client, admin_hdr, agent):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.get(f'/api/employees?search={agent.last_name}', headers=hdr)
        assert r.status_code == 200
        assert agent.id not in {e['id'] for e in r.get_json()['items']}

    def test_employee_payload_redacts_financial_fields(self, client, admin_hdr, instructor):
        hdr = secretary_hdr(client, admin_hdr)
        emp = client.get(f'/api/employees/{instructor.id}', headers=hdr).get_json()['employee']
        for field in ('base_salary', 'hourly_rate', 'default_commission_rate',
                      'national_id', 'employment_date', 'emergency_contact'):
            assert field not in emp, f'{field} leaked to the Company Secretary'

    def test_salary_type_is_treated_as_pay_data(self, client, admin_hdr, instructor):
        """salary_type is pay data: a monthly rate and a daily one are not alike.

        It was absent from PRIVATE_FIELDS, so the Secretary's directory
        advertised whether staff are salaried or hourly even with no
        financial permission.
        """
        hdr = secretary_hdr(client, admin_hdr)
        raw = client.get(f'/api/employees/{instructor.id}', headers=hdr).get_data(as_text=True)
        assert 'salary_type' not in raw

        # Someone who does hold a financial permission still sees it.
        assert 'salary_type' in client.get(
            f'/api/employees/{instructor.id}', headers=admin_hdr).get_data(as_text=True)

    def test_acknowledgement_roster_hides_service_agents(self, client, admin_hdr, agent):
        """A company-wide notice must not expose agent names to the Secretary.

        The agent cannot acknowledge through the API (it holds no
        announcements permission), so the row is written directly — the point
        is what the Secretary sees when one exists.
        """
        from app.models import AnnouncementAck
        from datetime import datetime, timezone
        hdr = secretary_hdr(client, admin_hdr)
        r = client.post('/api/announcements', headers=hdr, json={
            'title': 'Everyone ack', 'message': 'ack',
            'requires_ack': True, 'publish_date': TODAY.isoformat(),
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        ann_id = r.get_json()['announcement']['id']

        db.session.add(AnnouncementAck(
            announcement_id=ann_id, employee_id=agent.id, user_id=agent.user_id,
            acknowledged_at=datetime.now(timezone.utc)))
        db.session.commit()

        roster = client.get(f'/api/announcements/{ann_id}/acknowledgements', headers=hdr)
        assert roster.status_code == 200, roster.get_data(as_text=True)
        body = roster.get_json()
        raw = roster.get_data(as_text=True)
        assert agent.full_name not in raw, 'agent name leaked into the ack roster'
        assert all(a['employee_id'] != agent.id for a in body['acknowledged'])
        # The row exists, it is simply not rendered for this viewer.
        assert AnnouncementAck.query.filter_by(
            announcement_id=ann_id, employee_id=agent.id).count() == 1

    def test_cannot_open_a_service_agent_profile(self, client, admin_hdr, agent):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.get(f'/api/employees/{agent.id}', headers=hdr)
        assert r.status_code == 403
        assert 'Service Agent' in r.get_json()['error']

    def test_cannot_edit_a_service_agent(self, client, admin_hdr, agent):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.put(f'/api/employees/{agent.id}', headers=hdr, json={'first_name': 'Nope'})
        assert r.status_code == 403
        assert agent.first_name != 'Nope'

    def test_cannot_write_salary_fields(self, client, admin_hdr, instructor):
        hdr = secretary_hdr(client, admin_hdr)
        before = instructor.base_salary
        r = client.put(f'/api/employees/{instructor.id}', headers=hdr,
                       json={'first_name': 'Renamed', 'base_salary': 999999,
                             'hourly_rate': 500, 'default_commission_rate': 0.9,
                             'salary_type': 'monthly'})
        assert r.status_code == 200, r.get_data(as_text=True)
        assert instructor.base_salary == before
        assert float(instructor.hourly_rate or 0) != 500
        # Operational fields still apply: the block is on pay data only.
        assert instructor.first_name == 'Renamed'

    def test_pay_data_write_is_dropped_on_create(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.post('/api/employees', headers=hdr, json={
            'first_name': 'No', 'last_name': 'Salary',
            'email': f'nosalary{next(_seq)}@afritech.dev',
            'base_salary': 123456, 'hourly_rate': 77,
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        created = r.get_json()['employee']
        assert 'base_salary' not in created
        assert 'hourly_rate' not in created
        # The supplied pay data is dropped, leaving only the column default.
        stored = Employee.query.get(created['id'])
        assert float(stored.base_salary or 0) == 0
        assert float(stored.hourly_rate or 0) == 0

    def test_manager_still_sees_pay_data(self, client, manager_hdr, instructor):
        """Guard against over-redaction: pay permission must keep working."""
        emp = client.get(f'/api/employees/{instructor.id}', headers=manager_hdr).get_json()['employee']
        assert 'base_salary' in emp
        assert 'national_id' in emp

    def test_manager_still_writes_pay_data(self, client, manager_hdr, instructor):
        before = instructor.base_salary
        r = client.put(f'/api/employees/{instructor.id}', headers=manager_hdr,
                       json={'base_salary': 424242})
        assert r.status_code == 200, r.get_data(as_text=True)
        assert float(instructor.base_salary) == 424242.0
        instructor.base_salary = before

    def test_attendance_overview_excludes_service_agents(self, client, admin_hdr, agent):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.get('/api/attendance/overview', headers=hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        assert agent.id not in {row['employee_id'] for row in r.get_json()['items']}

    def test_attendance_employee_filter_cannot_reach_a_service_agent(self, client, admin_hdr, agent):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.get(f'/api/attendance?employee_id={agent.id}', headers=hdr)
        assert r.status_code == 403
        assert 'Service Agent' in r.get_json()['error']

    def test_attendance_rows_redact_overtime(self, client, admin_hdr, instructor):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.get(f'/api/attendance?employee_id={instructor.id}', headers=hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        for row in r.get_json()['items']:
            assert 'overtime_hours' not in row

    def test_bad_attendance_date_is_a_400_not_a_500(self, client, admin_hdr, instructor):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.get('/api/attendance?start=not-a-date', headers=hdr)
        assert r.status_code == 400

    def test_cannot_remove_a_service_agent_from_a_meeting(self, client, admin_hdr, agent):
        meeting = _meeting(client, admin_hdr, participant_ids=[agent.id])
        hdr = secretary_hdr(client, admin_hdr)
        r = client.delete(f"/api/meetings/{meeting['id']}/participants/{agent.id}", headers=hdr)
        assert r.status_code == 403
        assert 'Service Agent' in r.get_json()['error']

    # ── forbidden service / finance surface ────────────────────────────────────

    FORBIDDEN_ENDPOINTS = (
        '/api/closings', '/api/payroll/periods', '/api/expenses',
        '/api/reports/summary', '/api/dashboard', '/api/commissions/rules',
        '/api/reports/revenue', '/api/reports/payroll',
    )

    @pytest.mark.parametrize('path', FORBIDDEN_ENDPOINTS)
    def test_service_and_finance_endpoints_are_closed(self, client, admin_hdr, path):
        """The Secretary must not reach the books.

        One test per endpoint on purpose: a single loop over a list collapses
        into one assertion failure that hides which surface regressed.

        Service-centre *reads* are deliberately absent from this list — the
        Secretary monitors transaction status. They are covered by
        ``TestSecretaryServiceOperations``, which asserts the money is gone.
        """
        hdr = secretary_hdr(client, admin_hdr)
        assert client.get(path, headers=hdr).status_code == 403, path
        assert client.post(path, headers=hdr, json={}).status_code in (403, 405), path

    def test_payroll_and_expense_details_are_not_readable(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        for path in ('/api/payroll/summary', '/api/expenses?per_page=1'):
            r = client.get(path, headers=hdr)
            assert r.status_code in (403, 404), path


class TestSecretaryServiceOperations:
    """The Secretary reads service-centre *state*, never its money.

    §28/§74 of the specification: monitor transactions, clients and pending
    services so follow-up can happen — while customer payment, service cost,
    gross profit, commission and company profit never reach the client.
    """

    MONEY_KEYS = (
        'official_cost', 'customer_price', 'commission_rate_used', 'commission_source',
        'gross_profit', 'commission_amount', 'company_profit',
        'payment_method_id', 'is_cash', 'payments', 'amount',
    )

    def _first_transaction_id(self, client, admin_hdr):
        r = client.get('/api/transactions?per_page=1', headers=admin_hdr)
        assert r.status_code == 200
        items = r.get_json()['items']
        assert items, 'seed data must contain at least one transaction'
        return items[0]['id']

    def test_transactions_are_readable(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.get('/api/transactions?per_page=5', headers=hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['total'] > 0

    def test_transaction_list_carries_no_money(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.get('/api/transactions?per_page=50', headers=hdr)
        assert r.status_code == 200
        for item in r.get_json()['items']:
            for key in self.MONEY_KEYS:
                assert key not in item, f'{key} leaked into the Secretary payload'
        raw = r.get_data(as_text=True)
        for key in self.MONEY_KEYS:
            assert f'"{key}"' not in raw, f'{key} present in the raw response'

    def test_transaction_detail_hides_payments_and_money(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        txn_id = self._first_transaction_id(client, admin_hdr)
        r = client.get(f'/api/transactions/{txn_id}', headers=hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        txn = r.get_json()['transaction']
        for key in self.MONEY_KEYS:
            assert key not in txn, f'{key} leaked into the detail payload'
        # the operational projection the Secretary does need
        for key in ('transaction_number', 'status', 'service_name', 'client_name',
                    'employee_name', 'transaction_date'):
            assert key in txn

    def test_transaction_detail_keeps_the_status_of_the_day_closing(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        txn_id = self._first_transaction_id(client, admin_hdr)
        txn = client.get(f'/api/transactions/{txn_id}', headers=hdr).get_json()['transaction']
        # a status string, never the closing amounts
        assert txn.get('closing_status') in (None, 'submitted', 'approved',
                                             'rejected', 'correction_requested')
        assert 'actual_cash' not in txn and 'customer_payments' not in txn

    def test_secretary_cannot_create_a_transaction(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.post('/api/transactions', headers=hdr, json={})
        assert r.status_code == 403

    def test_secretary_cannot_change_a_transaction_status(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        txn_id = self._first_transaction_id(client, admin_hdr)
        r = client.post(f'/api/transactions/{txn_id}/status', headers=hdr,
                        json={'status': 'processing'})
        assert r.status_code == 403

    def test_secretary_cannot_edit_a_transaction(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        txn_id = self._first_transaction_id(client, admin_hdr)
        r = client.put(f'/api/transactions/{txn_id}', headers=hdr,
                       json={'customer_price': 1})
        assert r.status_code == 403

    def test_services_are_readable_but_unpriced(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.get('/api/services?per_page=50', headers=hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        items = r.get_json()['items']
        assert items, 'seed data must contain services'
        for svc in items:
            for key in ('official_cost', 'customer_price', 'commission_rate'):
                assert key not in svc, f'{key} leaked into the Secretary payload'
            assert 'name' in svc and 'code' in svc
        assert 'commission_rate' not in r.get_data(as_text=True)

    def test_service_detail_is_unpriced_too(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        svc_id = client.get('/api/services?per_page=1', headers=admin_hdr).get_json()['items'][0]['id']
        r = client.get(f'/api/services/{svc_id}', headers=hdr)
        assert r.status_code == 200
        svc = r.get_json()['service']
        assert 'official_cost' not in svc and 'customer_price' not in svc

    def test_clients_are_readable(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.get('/api/clients?per_page=5', headers=hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['total'] > 0

    def test_client_writes_are_closed(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        assert client.post('/api/clients', headers=hdr,
                           json={'first_name': 'No', 'last_name': 'Way'}).status_code == 403

    def test_service_agent_records_stay_reachable_only_as_a_name(self, client, admin_hdr, agent):
        """Read-only service access must not reopen the Service Agent door."""
        hdr = secretary_hdr(client, admin_hdr)
        # the personnel record itself is still off-limits…
        assert client.get(f'/api/employees/{agent.id}', headers=hdr).status_code == 403
        # …but the directory still excludes them
        ids = {e['id'] for e in client.get('/api/employees?per_page=500', headers=hdr).get_json()['items']}
        assert agent.id not in ids

    def test_service_operations_report_is_operational_only(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.get('/api/reports/administrative/service-operations', headers=hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        body = r.get_json()
        assert body['total'] >= 0
        assert set(body['by_status']) <= {
            'created', 'processing', 'completed', 'failed', 'cancelled', 'refunded'}
        raw = r.get_data(as_text=True)
        for key in ('customer_price', 'official_cost', 'gross_profit',
                    'commission_amount', 'company_profit', 'revenue'):
            assert f'"{key}"' not in raw, f'{key} leaked into the operational report'

    def test_manager_still_sees_transaction_money(self, client, manager_hdr):
        """Guard against over-redaction: financial roles keep their numbers."""
        r = client.get('/api/transactions?per_page=1', headers=manager_hdr)
        assert r.status_code == 200
        item = r.get_json()['items'][0]
        assert 'customer_price' in item and 'commission_amount' in item

    def test_service_agent_still_sees_their_own_money(self, client, agent_hdr):
        r = client.get('/api/transactions?per_page=5', headers=agent_hdr)
        assert r.status_code == 200
        items = r.get_json()['items']
        assert items, 'the seeded agent owns transactions'
        for item in items:
            assert 'customer_price' in item, 'the agent lost sight of their own earnings'

    def test_service_agent_still_sees_service_prices(self, client, agent_hdr):
        r = client.get('/api/services?per_page=1', headers=agent_hdr)
        assert r.status_code == 200
        assert 'customer_price' in r.get_json()['items'][0]


    # ── employee sub-resources (profile tabs) ────────────────────────────

    @staticmethod
    def _non_agent_employee():
        """A non-Service-Agent employee who actually has attendance rows."""
        from app.models import Attendance
        emp = (Employee.query.join(Attendance, Attendance.employee_id == Employee.id)
               .filter(Employee.position != 'Service Agent')
               .order_by(Employee.id).first())
        if emp is None:
            emp = Employee.query.filter(Employee.position != 'Service Agent').first()
        assert emp is not None, 'seed data must contain a non-Service-Agent employee'
        return emp

    def test_employee_transactions_tab_is_money_free(self, client, admin_hdr):
        """The profile's Transactions tab is a status view, not a ledger."""
        hdr = secretary_hdr(client, admin_hdr)
        emp = self._non_agent_employee()
        r = client.get(f'/api/employees/{emp.id}/transactions?per_page=5', headers=hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        raw = r.get_data(as_text=True)
        for key in ('official_cost', 'customer_price', 'commission_amount',
                    'gross_profit', 'company_profit', 'is_cash', 'payments'):
            assert f'"{key}"' not in raw, f'{key} leaked into the employee transactions tab'
        for item in r.get_json()['items']:
            for key in ('transaction_number', 'status', 'service_name', 'client_name'):
                assert key in item

    def test_service_agent_transactions_tab_stays_closed(self, client, admin_hdr, agent):
        """Operational read does not reopen the Service Agent personnel record."""
        hdr = secretary_hdr(client, admin_hdr)
        r = client.get(f'/api/employees/{agent.id}/transactions', headers=hdr)
        assert r.status_code == 403

    def test_employee_attendance_shows_hours_but_not_overtime(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        emp = self._non_agent_employee()
        r = client.get(f'/api/employees/{emp.id}/attendance?per_page=5', headers=hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        items = r.get_json()['items']
        assert items, 'the chosen employee must have attendance rows'
        assert '"overtime_hours"' not in r.get_data(as_text=True), (
            'overtime feeds payroll and must never reach the Secretary')
        for item in items:
            for key in ('attendance_date', 'clock_in', 'clock_out', 'total_hours', 'status'):
                assert key in item

    def test_service_agent_attendance_tab_stays_closed(self, client, admin_hdr, agent):
        hdr = secretary_hdr(client, admin_hdr)
        assert client.get(f'/api/employees/{agent.id}/attendance',
                          headers=hdr).status_code == 403

    def test_employee_earnings_tab_is_forbidden(self, client, admin_hdr, instructor):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.get(f'/api/employees/{instructor.id}/earnings', headers=hdr)
        assert r.status_code == 403

    def test_manager_still_sees_overtime_on_the_same_tab(self, client, manager_hdr):
        """Guard against over-redaction on the shared attendance sub-resource."""
        emp = self._non_agent_employee()
        r = client.get(f'/api/employees/{emp.id}/attendance?per_page=1', headers=manager_hdr)
        assert r.status_code == 200
        items = r.get_json()['items']
        assert items, 'the chosen employee must have attendance rows'
        assert 'overtime_hours' in items[0]


class TestSecretaryCommunication:
    """Announcements, memos and documents — publish, target, acknowledge."""

    def test_announcement_lifecycle(self, client, admin_hdr, instructor):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.post('/api/announcements', headers=hdr, json={
            'title': 'Staff briefing', 'message': 'Friday at 09:00.',
            'category': 'staff_announcement', 'priority': 'high', 'requires_ack': True,
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        ann_id = r.get_json()['announcement']['id']

        assert client.get('/api/announcements', headers=hdr).get_json()['total'] >= 1
        assert client.get(f'/api/announcements/{ann_id}', headers=hdr).status_code == 200

        updated = client.put(f'/api/announcements/{ann_id}', headers=hdr,
                             json={'title': 'Staff briefing (moved)'})
        assert updated.status_code == 200
        assert updated.get_json()['announcement']['title'] == 'Staff briefing (moved)'

        assert client.delete(f'/api/announcements/{ann_id}', headers=hdr).status_code == 200
        assert client.get(f'/api/announcements/{ann_id}', headers=hdr).status_code == 404

    def test_announcement_acknowledgement_is_recorded_once(self, client, admin_hdr):
        """Acknowledging twice must conflict, not silently duplicate the row."""
        hdr = secretary_hdr(client, admin_hdr)
        r = client.post('/api/announcements', headers=hdr,
                        json={'title': 'Ack me', 'message': 'x', 'requires_ack': True})
        ann_id = r.get_json()['announcement']['id']

        pending = client.get('/api/announcements/pending-acknowledgement', headers=hdr)
        assert pending.status_code == 200
        assert ann_id in {a['id'] for a in pending.get_json()['items']}

        first = client.post(f'/api/announcements/{ann_id}/acknowledge', headers=hdr, json={})
        assert first.status_code == 201, first.get_data(as_text=True)

        second = client.post(f'/api/announcements/{ann_id}/acknowledge', headers=hdr, json={})
        assert second.status_code == 409

        assert ann_id not in {a['id'] for a in client.get(
            '/api/announcements/pending-acknowledgement', headers=hdr).get_json()['items']}
        detail = client.get(f'/api/announcements/{ann_id}', headers=hdr).get_json()['announcement']
        assert detail['acknowledged_by_me'] is True
        assert detail['requires_my_ack'] is False

    def test_announcement_custom_audience_rejects_service_agents(self, client, admin_hdr, agent):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.post('/api/announcements', headers=hdr, json={
            'title': 'Agent briefing', 'message': 'x',
            'audience': 'custom', 'recipient_ids': [agent.id],
        })
        assert r.status_code == 403
        assert 'outside your scope' in r.get_json()['error']

    def test_announcement_rejects_bad_audience_and_category(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        bad_audience = client.post('/api/announcements', headers=hdr, json={
            'title': 'x', 'message': 'y', 'audience': 'nobody'})
        assert bad_audience.status_code == 400
        bad_category = client.post('/api/announcements', headers=hdr, json={
            'title': 'x', 'message': 'y', 'category': 'nonsense'})
        assert bad_category.status_code == 400

    def test_announcement_requires_title_and_message(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.post('/api/announcements', headers=hdr, json={'title': 'only title'})
        assert r.status_code == 400
        assert 'message' in r.get_json()['error']

    def test_acknowledgements_can_be_tracked(self, client, admin_hdr, instructor):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.post('/api/announcements', headers=hdr, json={
            'title': 'Read this', 'message': 'ack please', 'requires_ack': True,
            'audience': 'department', 'department_id': instructor.department_id,
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        ann_id = r.get_json()['announcement']['id']

        stats = client.get(f'/api/announcements/{ann_id}/acknowledgements', headers=hdr)
        assert stats.status_code == 200
        body = stats.get_json()
        assert body['all_acknowledged'] is False
        assert any(o['employee_id'] == instructor.id for o in body['outstanding'])

    def test_memo_lifecycle(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.post('/api/memos', headers=hdr, json={
            'title': 'Office notice', 'message': 'Do the thing.', 'category': 'office_notice',
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        memo_id = r.get_json()['memo']['id']
        assert client.get('/api/memos', headers=hdr).get_json()['total'] >= 1
        assert client.get(f'/api/memos/{memo_id}', headers=hdr).status_code == 200
        assert client.delete(f'/api/memos/{memo_id}', headers=hdr).status_code == 200

    def test_memo_publish_is_not_repeatable(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.post('/api/memos', headers=hdr, json={
            'title': 'Draft memo', 'message': 'Not ready yet.', 'publish': False})
        assert r.status_code == 201, r.get_data(as_text=True)
        memo_id = r.get_json()['memo']['id']
        assert r.get_json()['memo']['published_at'] is None

        # A draft stays out of the default list …
        listed = client.get('/api/memos', headers=hdr).get_json()['items']
        assert memo_id not in {m['id'] for m in listed}
        # … but is retrievable on purpose, and by its author directly.
        assert memo_id in {m['id'] for m in
                           client.get('/api/memos?published_only=false', headers=hdr).get_json()['items']}
        assert client.get(f'/api/memos/{memo_id}', headers=hdr).status_code == 200

        published = client.post(f'/api/memos/{memo_id}/publish', headers=hdr, json={})
        assert published.status_code == 200
        assert published.get_json()['memo']['published_at'] is not None
        assert memo_id in {m['id'] for m in client.get('/api/memos', headers=hdr).get_json()['items']}

    def test_document_upload_download_delete(self, client, admin_hdr):
        import io
        hdr = secretary_hdr(client, admin_hdr)
        r = client.post('/api/documents', headers=hdr, data={
            'title': 'Staff handbook', 'category': 'administrative',
            'file': (io.BytesIO(b'%PDF-1.4 handbook'), 'handbook.pdf'),
        }, content_type='multipart/form-data')
        assert r.status_code == 201, r.get_data(as_text=True)
        doc = r.get_json()['document']
        assert doc['extension'] == 'pdf'
        assert doc['size_bytes'] > 0

        download = client.get(f"/api/documents/{doc['id']}/download", headers=hdr)
        assert download.status_code == 200
        assert download.data == b'%PDF-1.4 handbook'

        assert client.delete(f"/api/documents/{doc['id']}", headers=hdr).status_code == 200
        assert client.get(f"/api/documents/{doc['id']}", headers=hdr).status_code == 404

    def test_document_rejects_a_disallowed_extension(self, client, admin_hdr):
        import io
        hdr = secretary_hdr(client, admin_hdr)
        r = client.post('/api/documents', headers=hdr, data={
            'file': (io.BytesIO(b'#!/bin/sh'), 'payload.exe'),
        }, content_type='multipart/form-data')
        assert r.status_code == 400
        assert 'Unsupported file type' in r.get_json()['error']

    def test_document_upload_needs_a_file(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.post('/api/documents', headers=hdr, data={'title': 'Empty'},
                        content_type='multipart/form-data')
        assert r.status_code == 400


class TestSecretaryCoordinationQueue:
    """Requests, follow-ups and escalations — the Secretary's actual workload."""

    def test_request_intake_and_resolution(self, client, admin_hdr, instructor):
        hdr = _agent_hdr(client, instructor)
        r = client.post('/api/requests', headers=hdr, json={
            'title': 'Need a projector', 'description': 'For the Thursday session.',
            'type': 'equipment', 'priority': 'high',
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        request_id = r.get_json()['request']['id']

        sec = secretary_hdr(client, admin_hdr)
        assigned = client.put(f'/api/requests/{request_id}', headers=sec,
                              json={'assigned_to': instructor.id})
        assert assigned.status_code == 200, assigned.get_data(as_text=True)
        assert assigned.get_json()['request']['status'] == 'forwarded'

        closed = client.post(f'/api/requests/{request_id}/resolve', headers=sec, json={
            'status': 'approved', 'resolution': 'Booked for Thursday.'})
        assert closed.status_code == 200
        body = closed.get_json()['request']
        assert body['status'] == 'approved'
        assert body['reviewed_at'] is not None

    def test_request_requester_cannot_approve_their_own(self, client, admin_hdr, instructor):
        hdr = _agent_hdr(client, instructor)
        request_id = client.post('/api/requests', headers=hdr, json={
            'title': 'Self approve please'}).get_json()['request']['id']
        r = client.put(f'/api/requests/{request_id}', headers=hdr, json={'status': 'approved'})
        assert r.status_code == 403

    def test_approval_requires_a_resolution_note(self, client, admin_hdr, instructor):
        hdr = _agent_hdr(client, instructor)
        request_id = client.post('/api/requests', headers=hdr, json={
            'title': 'No note'}).get_json()['request']['id']
        sec = secretary_hdr(client, admin_hdr)
        r = client.post(f'/api/requests/{request_id}/resolve', headers=sec,
                        json={'status': 'approved'})
        assert r.status_code == 400
        assert 'resolution note' in r.get_json()['error']

    def test_request_cannot_be_submitted_for_somebody_else(self, client, admin_hdr, instructor, agent):
        hdr = _agent_hdr(client, instructor)
        r = client.post('/api/requests', headers=hdr, json={
            'title': 'Not mine', 'requested_by': agent.id})
        assert r.status_code == 403

    def test_request_rejects_an_unknown_status(self, client, admin_hdr, instructor):
        hdr = _agent_hdr(client, instructor)
        request_id = client.post('/api/requests', headers=hdr, json={
            'title': 'Bad status'}).get_json()['request']['id']
        sec = secretary_hdr(client, admin_hdr)
        assert client.put(f'/api/requests/{request_id}', headers=sec,
                          json={'status': 'teleported'}).status_code == 400
        assert client.get('/api/requests?status=teleported', headers=sec).status_code == 400

    def test_followup_lifecycle_and_overdue(self, client, admin_hdr, instructor):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.post('/api/follow-ups', headers=hdr, json={
            'employee_id': instructor.id, 'subject': 'Confirm the syllabus',
            'notes': 'Called once.', 'priority': 'high',
            'next_follow_up': (TODAY - timedelta(days=3)).isoformat(),
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        followup_id = r.get_json()['follow_up']['id']
        assert client.get('/api/follow-ups/overdue', headers=hdr).get_json()['total'] >= 1

        progress = client.post(f'/api/follow-ups/{followup_id}/progress', headers=hdr,
                               json={'last_action': 'Left a message',
                                     'next_follow_up': TODAY.isoformat()})
        assert progress.status_code == 200
        body = progress.get_json()['follow_up']
        assert body['last_action'] == 'Left a message'
        assert body['is_overdue'] is False

    def test_followup_cannot_target_a_service_agent(self, client, admin_hdr, agent):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.post('/api/follow-ups', headers=hdr, json={
            'employee_id': agent.id, 'subject': 'Chase the agent'})
        assert r.status_code == 403
        assert 'Service Agent' in r.get_json()['error']

    def test_followup_progress_requires_an_action(self, client, admin_hdr, instructor):
        hdr = secretary_hdr(client, admin_hdr)
        followup_id = client.post('/api/follow-ups', headers=hdr, json={
            'employee_id': instructor.id, 'subject': 'x'}).get_json()['follow_up']['id']
        r = client.post(f'/api/follow-ups/{followup_id}/progress', headers=hdr, json={})
        assert r.status_code == 400

    def test_escalation_lifecycle(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.post('/api/escalations', headers=hdr, json={
            'subject': 'Blocked on finance', 'issue': 'Cannot pay the supplier invoice.',
            'reason': 'No approval for two weeks.', 'priority': 'urgent',
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        esc_id = r.get_json()['escalation']['id']

        assert client.get('/api/escalations', headers=hdr).get_json()['total'] >= 1
        # Resolving without a note is refused.
        assert client.post(f'/api/escalations/{esc_id}/resolve', headers=hdr,
                           json={'resolution': '  '}).status_code == 400

        resolved = client.post(f'/api/escalations/{esc_id}/resolve', headers=hdr,
                               json={'resolution': 'Approved by the MD.'})
        assert resolved.status_code == 200
        assert resolved.get_json()['escalation']['status'] == 'resolved'
        # Twice is a conflict, not a silent overwrite.
        assert client.post(f'/api/escalations/{esc_id}/resolve', headers=hdr,
                           json={'resolution': 'Again'}).status_code == 409

    def test_escalation_rejects_an_unknown_escalate_to(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.post('/api/escalations', headers=hdr, json={
            'subject': 'x', 'issue': 'y', 'escalate_to': 'the_moon'})
        assert r.status_code == 400


class TestSecretaryCalendarAndDashboard:
    def test_calendar_aggregates_dated_items(self, client, admin_hdr, instructor):
        hdr = secretary_hdr(client, admin_hdr)
        client.post('/api/activities', headers=hdr, json={
            'title': 'Company briefing', 'activity_date': TODAY.isoformat()})
        r = client.get(f'/api/calendar?start={TODAY.isoformat()}', headers=hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        body = r.get_json()
        assert body['total'] >= 1
        assert any(e['type'] == 'activity' for e in body['events'])
        assert body['days'][0]['date'] == TODAY.isoformat()

    def test_calendar_hides_service_agent_tasks(self, client, admin_hdr, agent):
        theirs = _task(client, admin_hdr, agent.id, title='Agent deadline',
                       due_date=TODAY.isoformat())
        hdr = secretary_hdr(client, admin_hdr)
        r = client.get(f'/api/calendar?start={TODAY.isoformat()}&types=tasks', headers=hdr)
        assert r.status_code == 200
        assert theirs['id'] not in {e['id'] for e in r.get_json()['events']}

    def test_calendar_validates_its_inputs(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        assert client.get('/api/calendar?start=nonsense', headers=hdr).status_code == 400
        assert client.get('/api/calendar?types=spaceships', headers=hdr).status_code == 400
        r = client.get(f'/api/calendar?start={TODAY.isoformat()}'
                       f'&end={(TODAY - timedelta(days=1)).isoformat()}', headers=hdr)
        assert r.status_code == 400
        wide = client.get(f'/api/calendar?start={TODAY.isoformat()}', headers=hdr)
        assert wide.status_code == 200

    def test_calendar_upcoming_window(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        assert client.get('/api/calendar/upcoming?days=7', headers=hdr).status_code == 200
        assert client.get('/api/calendar/upcoming?days=0', headers=hdr).status_code == 400
        assert client.get('/api/calendar/upcoming?days=999', headers=hdr).status_code == 400

    def test_secretary_dashboard_is_operational_only(self, client, admin_hdr, instructor):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.get('/api/dashboard/secretary', headers=hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        body = r.get_json()
        for key in ('meetings_today', 'tasks_open', 'requests_open', 'followups_open',
                    'attendance_month', 'announcements_pending_my_ack'):
            assert key in body, key
        # Nothing resembling the books may appear anywhere in the payload.
        raw = r.get_data(as_text=True).lower()
        for forbidden in ('salary', 'commission', 'revenue', 'profit', 'payroll',
                          'expense', 'customer_price', 'company_profit', 'base_salary'):
            assert forbidden not in raw, f'{forbidden} present in the Secretary dashboard'

    def test_secretary_dashboard_is_closed_to_service_agents(self, client, admin_hdr, agent):
        hdr = _agent_hdr(client, agent)
        r = client.get('/api/dashboard/secretary', headers=hdr)
        assert r.status_code in (403, 404)

    def test_secretary_dashboard_is_closed_to_the_finance_dashboard(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        assert client.get('/api/dashboard', headers=hdr).status_code == 403

    def test_calendar_branch_and_department_filters_are_conjunctive(self, client, admin_hdr):
        """Passing both filters means "in this branch AND in this department".

        An ``or`` here returned the whole branch plus the whole department, so
        the result set was silently far larger than what was asked for.
        """
        from app.models import Branch, Department
        hdr = secretary_hdr(client, admin_hdr)

        branch = Branch.query.first()
        depts = Department.query.order_by(Department.id).all()
        assert branch and len(depts) >= 2, 'seed must provide a branch and two departments'
        mine_dept, other_dept = depts[0], depts[1]

        in_branch = client.post('/api/meetings', headers=hdr, json={
            'title': 'Branch only', 'meeting_date': TODAY.isoformat(),
            'branch_id': branch.id, 'department_id': mine_dept.id,
        })
        assert in_branch.status_code == 201, in_branch.get_data(as_text=True)
        theirs = client.post('/api/meetings', headers=hdr, json={
            'title': 'Other department', 'meeting_date': TODAY.isoformat(),
            'branch_id': branch.id, 'department_id': other_dept.id,
        })
        assert theirs.status_code == 201, theirs.get_data(as_text=True)

        both = client.get(f'/api/calendar?start={TODAY.isoformat()}&types=meetings'
                          f'&branch_id={branch.id}&department_id={other_dept.id}', headers=hdr)
        assert both.status_code == 200
        titles = {e['title'] for e in both.get_json()['events']}
        assert 'Other department' in titles
        assert 'Branch only' not in titles, 'branch-only event leaked past the department filter'

        # Filtering on the branch alone still returns both.
        by_branch = client.get(f'/api/calendar?start={TODAY.isoformat()}&types=meetings'
                               f'&branch_id={branch.id}', headers=hdr)
        assert 'Branch only' in {e['title'] for e in by_branch.get_json()['events']}

    def test_calendar_omits_announcements_aimed_elsewhere(self, client, admin_hdr, agent, instructor):
        """A notice targeted at one person must not appear on another's calendar.

        The announcement is published by a super admin because that is the
        only role allowed to target a Service Agent — the Secretary is
        correctly refused, which is itself part of the boundary.
        """
        hdr = secretary_hdr(client, admin_hdr)
        targeted = client.post('/api/announcements', headers=admin_hdr, json={
            'title': 'Agent only notice', 'message': 'internal',
            'audience': 'custom', 'recipient_ids': [agent.id],
            'publish_date': TODAY.isoformat(),
        })
        assert targeted.status_code == 201, targeted.get_data(as_text=True)
        mine = targeted.get_json()['announcement']['id']

        # The Secretary cannot even aim a notice at an agent.
        assert client.post('/api/announcements', headers=hdr, json={
            'title': 'Sneaky', 'message': 'x',
            'audience': 'custom', 'recipient_ids': [agent.id],
        }).status_code == 403

        cal = client.get(f'/api/calendar?start={TODAY.isoformat()}&types=announcements', headers=hdr)
        assert mine not in {e['id'] for e in cal.get_json()['events']}

        # A company-wide notice is everyone's business and must still appear.
        r2 = client.post('/api/announcements', headers=hdr, json={
            'title': 'Company wide notice', 'message': 'everyone',
            'publish_date': TODAY.isoformat(),
        })
        assert r2.status_code == 201
        theirs = r2.get_json()['announcement']['id']
        cal2 = client.get(f'/api/calendar?start={TODAY.isoformat()}&types=announcements', headers=hdr)
        assert theirs in {e['id'] for e in cal2.get_json()['events']}

    def test_employee_scoped_calendar_events_expose_their_org(self, client, admin_hdr, instructor):
        """A branch filter must be able to match a task, not only a meeting."""
        hdr = secretary_hdr(client, admin_hdr)
        if not instructor.branch_id:
            pytest.skip('seed instructor has no branch')
        _task(client, admin_hdr, instructor.id, title='Scoped task',
              due_date=TODAY.isoformat())
        r = client.get(f'/api/calendar?start={TODAY.isoformat()}&types=tasks'
                       f'&branch_id={instructor.branch_id}', headers=hdr)
        assert r.status_code == 200
        events = [e for e in r.get_json()['events'] if e['type'] == 'task']
        assert any(e['title'] == 'Scoped task' for e in events), \
            'employee-scoped tasks are filtered out of a branch view'


class TestSecretaryLeaveAndReports:
    def test_leave_intake_and_decision(self, client, admin_hdr, instructor):
        hdr = _agent_hdr(client, instructor)
        r = client.post('/api/leave', headers=hdr, json={
            'leave_type': 'annual',
            'start_date': (TODAY + timedelta(days=10)).isoformat(),
            'end_date': (TODAY + timedelta(days=12)).isoformat(),
            'reason': 'Family visit',
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        leave_id = r.get_json()['leave_request']['id']
        assert r.get_json()['leave_request']['status'] == 'pending'

        sec = secretary_hdr(client, admin_hdr)
        queue = client.get('/api/leave/pending', headers=sec).get_json()
        assert leave_id in {lv['id'] for lv in queue['items']}

        rejected = client.post(f'/api/leave/{leave_id}/decision', headers=sec,
                               json={'decision': 'rejected'})
        assert rejected.status_code == 400, 'rejecting needs a note'

        decided = client.post(f'/api/leave/{leave_id}/decision', headers=sec,
                              json={'decision': 'approved', 'note': 'Cover arranged.'})
        assert decided.status_code == 200
        assert decided.get_json()['leave_request']['status'] == 'approved'
        # A decided request is final.
        assert client.post(f'/api/leave/{leave_id}/decision', headers=sec,
                           json={'decision': 'rejected', 'note': 'x'}).status_code == 409

    def test_leave_validates_dates(self, client, admin_hdr, instructor):
        hdr = _agent_hdr(client, instructor)
        backwards = client.post('/api/leave', headers=hdr, json={
            'leave_type': 'annual',
            'start_date': (TODAY + timedelta(days=5)).isoformat(),
            'end_date': (TODAY + timedelta(days=2)).isoformat()})
        assert backwards.status_code == 400

        past = client.post('/api/leave', headers=hdr, json={
            'leave_type': 'annual',
            'start_date': (TODAY - timedelta(days=10)).isoformat(),
            'end_date': (TODAY - timedelta(days=5)).isoformat()})
        assert past.status_code == 400

    def test_leave_allows_a_single_day(self, client, admin_hdr, instructor):
        """start == end is a one-day leave, not a malformed range."""
        hdr = _agent_hdr(client, instructor)
        same_day = client.post('/api/leave', headers=hdr, json={
            'leave_type': 'annual',
            'start_date': TODAY.isoformat(), 'end_date': TODAY.isoformat()})
        assert same_day.status_code == 201
        row = same_day.get_json()['leave_request']
        assert row['start_date'] == row['end_date'] == TODAY.isoformat()

    def test_editing_a_decided_leave_keeps_the_approver(self, client, admin_hdr, instructor):
        """A decided request is frozen for everyone, approver included.

        Payroll reads the approved row, so a manager amending the dates or
        reason afterwards would rewrite the record the books were built from.
        Two defects are covered: the update used to wipe ``approved_by`` on any
        body without a ``status`` field, and it used to let a manager through.
        """
        hdr = _agent_hdr(client, instructor)
        sec = secretary_hdr(client, admin_hdr)
        leave_id = client.post('/api/leave', headers=hdr, json={
            'leave_type': 'sick',
            'start_date': (TODAY + timedelta(days=3)).isoformat(),
            'end_date': (TODAY + timedelta(days=4)).isoformat()}).get_json()['leave_request']['id']

        approved = client.post(f'/api/leave/{leave_id}/decision', headers=sec,
                               json={'decision': 'approved'})
        assert approved.status_code == 200, approved.get_data(as_text=True)
        decided = approved.get_json()['leave_request']
        assert decided['approved_by'] is not None
        assert decided['approved_at'] is not None

        # Even a manager cannot amend it: every field is refused.
        for payload in ({'reason': 'corrected after approval'},
                        {'note': 'quiet note'},
                        {'end_date': (TODAY + timedelta(days=9)).isoformat()},
                        {'leave_type': 'annual'},
                        {'status': 'rejected'}):
            r = client.put(f'/api/leave/{leave_id}', headers=sec, json=payload)
            assert r.status_code == 409, f'{payload} was accepted on a decided row'

        # Nor can the owner, and nor can it be decided a second time.
        assert client.put(f'/api/leave/{leave_id}', headers=hdr,
                          json={'reason': 'nope'}).status_code == 409
        assert client.post(f'/api/leave/{leave_id}/decision', headers=sec,
                           json={'decision': 'rejected', 'note': 'undo'}).status_code == 409

        # The row is byte-for-byte what was approved.
        after = client.get(f'/api/leave/{leave_id}', headers=sec).get_json()['leave_request']
        assert after == decided

    def test_decisions_are_only_reachable_through_the_decision_endpoint(
            self, client, admin_hdr, instructor):
        """A plain update must not be able to approve or reject.

        ``PUT {'status': 'rejected'}`` used to bypass /decision entirely,
        skipping the rule that a rejection carries a note — and leaving a row
        decided through a path that never checks anything else about it.
        """
        hdr = _agent_hdr(client, instructor)
        sec = secretary_hdr(client, admin_hdr)

        def _new_leave():
            return client.post('/api/leave', headers=hdr, json={
                'leave_type': 'sick',
                'start_date': (TODAY + timedelta(days=4)).isoformat(),
                'end_date': (TODAY + timedelta(days=5)).isoformat()}).get_json()['leave_request']['id']

        rejected = _new_leave()
        assert client.put(f'/api/leave/{rejected}', headers=sec,
                          json={'status': 'rejected'}).status_code == 409
        # Still undecided, so /decision can take it.
        assert client.get(f'/api/leave/{rejected}', headers=sec).get_json()[
            'leave_request']['status'] == 'pending'

        approved = _new_leave()
        assert client.put(f'/api/leave/{approved}', headers=sec,
                          json={'status': 'approved'}).status_code == 409
        assert client.get(f'/api/leave/{approved}', headers=sec).get_json()[
            'leave_request']['status'] == 'pending'

        # /decision still works, and still enforces the note on rejection.
        assert client.post(f'/api/leave/{rejected}/decision', headers=sec,
                           json={'decision': 'rejected'}).status_code == 400
        assert client.post(f'/api/leave/{rejected}/decision', headers=sec,
                           json={'decision': 'rejected', 'note': 'no cover'}).status_code == 200
        assert client.post(f'/api/leave/{approved}/decision', headers=sec,
                           json={'decision': 'approved'}).status_code == 200

    def test_review_workflow_still_moves_through_a_plain_update(self, client, admin_hdr, instructor):
        """The workflow statuses that are not decisions remain editable."""
        hdr = _agent_hdr(client, instructor)
        sec = secretary_hdr(client, admin_hdr)
        leave_id = client.post('/api/leave', headers=hdr, json={
            'leave_type': 'annual',
            'start_date': (TODAY + timedelta(days=6)).isoformat(),
            'end_date': (TODAY + timedelta(days=7)).isoformat()}).get_json()['leave_request']['id']

        for status in ('in_review', 'forwarded'):
            r = client.put(f'/api/leave/{leave_id}', headers=sec, json={'status': status})
            assert r.status_code == 200, r.get_data(as_text=True)
            assert r.get_json()['leave_request']['status'] == status

        # And the owner can still withdraw back to pending.
        assert client.put(f'/api/leave/{leave_id}', headers=hdr,
                          json={'status': 'pending'}).status_code == 200

    def test_rejected_leave_is_frozen_too(self, client, admin_hdr, instructor):
        hdr = _agent_hdr(client, instructor)
        sec = secretary_hdr(client, admin_hdr)
        leave_id = client.post('/api/leave', headers=hdr, json={
            'leave_type': 'unpaid',
            'start_date': (TODAY + timedelta(days=2)).isoformat(),
            'end_date': (TODAY + timedelta(days=3)).isoformat()}).get_json()['leave_request']['id']

        rejected = client.post(f'/api/leave/{leave_id}/decision', headers=sec,
                               json={'decision': 'rejected', 'note': 'no cover'})
        assert rejected.status_code == 200, rejected.get_data(as_text=True)
        decided = rejected.get_json()['leave_request']

        assert client.put(f'/api/leave/{leave_id}', headers=sec,
                          json={'note': 'actually fine'}).status_code == 409
        assert client.get(f'/api/leave/{leave_id}', headers=sec).get_json()['leave_request'] == decided

    def test_leave_rejects_an_unknown_type(self, client, admin_hdr, instructor):
        hdr = _agent_hdr(client, instructor)
        r = client.post('/api/leave', headers=hdr, json={
            'leave_type': 'sabbatical',
            'start_date': (TODAY + timedelta(days=3)).isoformat(),
            'end_date': (TODAY + timedelta(days=4)).isoformat()})
        assert r.status_code == 400

    def test_staff_cannot_approve_their_own_leave(self, client, admin_hdr, instructor):
        hdr = _agent_hdr(client, instructor)
        leave_id = client.post('/api/leave', headers=hdr, json={
            'leave_type': 'sick',
            'start_date': (TODAY + timedelta(days=1)).isoformat(),
            'end_date': (TODAY + timedelta(days=2)).isoformat()}).get_json()['leave_request']['id']
        assert client.post(f'/api/leave/{leave_id}/decision', headers=hdr,
                           json={'decision': 'approved'}).status_code == 403
        assert client.put(f'/api/leave/{leave_id}', headers=hdr,
                          json={'status': 'approved'}).status_code == 403

    def test_secretary_leave_queue_hides_service_agents(self, client, admin_hdr, agent):
        agent_hdr = _agent_hdr(client, agent)
        leave_id = client.post('/api/leave', headers=agent_hdr, json={
            'leave_type': 'annual',
            'start_date': (TODAY + timedelta(days=20)).isoformat(),
            'end_date': (TODAY + timedelta(days=21)).isoformat(),
        }).get_json()['leave_request']['id']
        sec = secretary_hdr(client, admin_hdr)
        assert client.get(f'/api/leave/{leave_id}', headers=sec).status_code == 404

    @pytest.mark.parametrize('report', (
        '', '/meetings', '/task-throughput', '/attendance-summary',
        '/request-ageing', '/department-branch',
    ))
    def test_operational_reports_are_readable(self, client, admin_hdr, report):
        hdr = secretary_hdr(client, admin_hdr)
        r = client.get(f'/api/reports/administrative{report}', headers=hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        # An operational report must not smuggle out a financial figure.
        body = r.get_data(as_text=True).lower()
        for forbidden in ('salary', 'commission', 'revenue', 'profit', 'payroll',
                          'expense', 'customer_price', 'base_salary', 'hourly_rate'):
            assert forbidden not in body, f'{forbidden} present in {report or "overview"}'

    def test_finance_reports_stay_closed(self, client, admin_hdr):
        hdr = secretary_hdr(client, admin_hdr)
        for path in ('/api/reports/summary', '/api/reports/revenue',
                     '/api/reports/by-service', '/api/reports/expenses',
                     '/api/reports/payroll', '/api/reports/attendance'):
            assert client.get(path, headers=hdr).status_code == 403, path

    def test_operational_reports_are_closed_to_service_agents(self, client, admin_hdr, agent):
        hdr = _agent_hdr(client, agent)
        assert client.get('/api/reports/administrative', headers=hdr).status_code == 403


class TestSecretaryAutomationRules:
    """The five coordination rules must run, notify and stay operational."""

    def test_run_all_executes_every_rule(self, client, admin_hdr):
        from app.services import automation
        results = dict(automation.run_all(TODAY))
        for rule in ('task_due_tomorrow_alert', 'upcoming_meeting_reminder',
                     'pending_acknowledgement_reminder', 'stale_request_reminder',
                     'task_awaiting_verification_alert'):
            assert rule in results, f'{rule} is not wired into run_all'
            assert not str(results[rule]).startswith('error'), f'{rule} raised'

    def test_task_due_tomorrow_notifies_the_assignee(self, client, admin_hdr, instructor):
        from app.services import automation
        from app.models import Notification
        task = _task(client, admin_hdr, instructor.id,
                     due_date=(TODAY + timedelta(days=1)).isoformat())
        automation.task_due_tomorrow_alert(TODAY)
        messages = [n.message for n in Notification.query.filter_by(
            related_type='task', related_id=task['id']).all()]
        assert any('due tomorrow' in m for m in messages)

    def test_upcoming_meeting_reminder_fires(self, client, admin_hdr, instructor):
        from app.services import automation
        from app.models import Notification
        meeting = _meeting(client, admin_hdr, participant_ids=[instructor.id],
                           meeting_date=(TODAY + timedelta(days=1)).isoformat())
        automation.upcoming_meeting_reminder(TODAY)
        assert Notification.query.filter_by(
            related_type='meeting', related_id=meeting['id']).count() >= 1

    def test_stale_request_reminder_fires(self, client, admin_hdr, instructor):
        from app.services import automation
        from app.models import AdminRequest, Notification
        hdr = _agent_hdr(client, instructor)
        request_id = client.post('/api/requests', headers=hdr, json={
            'title': 'Forgotten request'}).get_json()['request']['id']
        row = AdminRequest.query.get(request_id)
        # Backdate past the two-day staleness threshold.
        from datetime import timedelta as _td
        row.created_at = row.created_at - _td(days=5)
        db.session.commit()

        automation.stale_request_reminder(TODAY)
        assert Notification.query.filter_by(
            related_type='admin_request', related_id=request_id, type='request_stale').count() >= 1

    def test_awaiting_verification_reminder_fires(self, client, admin_hdr, instructor):
        from app.services import automation
        from app.models import Notification
        task = _task(client, admin_hdr, instructor.id)
        client.put(f"/api/tasks/{task['id']}", headers=admin_hdr, json={'status': 'in_progress'})
        client.put(f"/api/tasks/{task['id']}", headers=admin_hdr, json={'status': 'submitted'})
        automation.task_awaiting_verification_alert(TODAY)
        assert Notification.query.filter_by(
            related_type='task', related_id=task['id'],
            type='task_awaiting_verification').count() >= 1

    def test_automation_recipients_are_coordinators(self, client, admin_hdr):
        """Service agents must never be on the coordination notification list."""
        from app.services.automation import _coordinators
        emails = {u.email for u in _coordinators()}
        assert emails, 'no coordinators resolved'
        assert not any('@' in e and e.startswith('agent') for e in emails)

    def test_automation_never_mentions_a_service_agent_to_a_coordinator(
            self, client, admin_hdr, agent):
        """Reminders fan out to every coordinator — but only within scope.

        A task belonging to a Service Agent used to be announced to the
        Company Secretary, leaking the agent's existence and title through the
        notification feed even though every list endpoint hid them.
        """
        from app.services import automation
        from app.models import Notification
        task = _task(client, admin_hdr, agent.id, title='Agent secret deadline',
                     due_date=(TODAY + timedelta(days=1)).isoformat())
        automation.task_due_tomorrow_alert(TODAY)

        leaked = [n for n in Notification.query.filter_by(
            related_type='task', related_id=task['id'], type='task_due_tomorrow').all()
            if agent.full_name in (n.message or '')]
        # Whoever got it must legitimately run the service centre.
        for n in leaked:
            assert n.recipient.has_permission('services.view') or n.recipient.is_super_admin, \
                f'{n.recipient.email} cannot see Service Agents but was told about one'

    def test_meeting_reminder_skips_out_of_scope_participants(self, client, admin_hdr, agent):
        from app.services import automation
        from app.models import Notification
        meeting = _meeting(client, admin_hdr, participant_ids=[agent.id],
                           title='Agent briefing',
                           meeting_date=(TODAY + timedelta(days=1)).isoformat())
        automation.upcoming_meeting_reminder(TODAY)
        rows = Notification.query.filter_by(
            related_type='meeting', related_id=meeting['id'],
            type='meeting_reminder').all()
        for n in rows:
            assert n.recipient.has_permission('services.view') or n.recipient.is_super_admin, \
                f'{n.recipient.email} cannot see Service Agents but got a meeting reminder'

    def test_pending_acknowledgement_counts_outstanding(self, client, admin_hdr, instructor):
        """The chase counts what is *missing*, not what was already acked.

        The old code read ``len(acknowledgements)`` — a fully-acknowledged
        notice reported N outstanding, and a silent one reported none.
        """
        from app.services import automation
        from app.models import Notification
        hdr = secretary_hdr(client, admin_hdr)
        r = client.post('/api/announcements', headers=hdr, json={
            'title': 'Ack chase', 'message': 'ack me',
            'audience': 'custom', 'recipient_ids': [instructor.id],
            'requires_ack': True, 'publish_date': TODAY.isoformat(),
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        ann_id = r.get_json()['announcement']['id']

        automation.pending_acknowledgement_reminder(TODAY)
        pending = Notification.query.filter_by(
            related_type='announcement', related_id=ann_id,
            type='acknowledgement_pending').count()
        assert pending >= 1, 'an unacknowledged notice produced no chase'

        acked = client.post(f'/api/announcements/{ann_id}/acknowledge',
                            headers=_agent_hdr(client, instructor))
        assert acked.status_code == 201, acked.get_data(as_text=True)
        automation.pending_acknowledgement_reminder(TODAY)
        after = Notification.query.filter_by(
            related_type='announcement', related_id=ann_id,
            type='acknowledgement_pending').count()
        assert after == pending, 'a fully acknowledged notice was still reported outstanding'