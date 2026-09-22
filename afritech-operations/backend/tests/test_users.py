"""User creation → employee linkage tests.

A user created by the super admin (Admin → Users) must also appear as an
employee so the employee directory, profile, earnings and ownership checks work.
"""
from app.extensions import db
from app.models import Employee


class TestCreateUserCreatesEmployee:
    def test_create_user_creates_linked_employee(self, client, admin_hdr):
        r = client.post('/api/users', headers=admin_hdr, json={
            'email': 'grace.uwera@afritech.dev',
            'password': 'Password123!',
            'first_name': 'Grace',
            'last_name': 'Uwera',
            'position': 'Service Agent',
            'roles': ['service_agent'],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        user = r.get_json()['user']
        assert user['employee_id'] is not None
        assert user['employee_name'] == 'Grace Uwera'
        assert 'service_agent' in user['role_codes']

        # the user shows up in the employee directory, linked back to the user
        r = client.get('/api/employees?search=grace.uwera@afritech.dev', headers=admin_hdr)
        assert r.status_code == 200
        items = r.get_json()['items']
        assert len(items) == 1
        assert items[0]['user_id'] == user['id']
        assert items[0]['full_name'] == 'Grace Uwera'
        assert items[0]['position'] == 'Service Agent'
        assert items[0]['employee_number']

    def test_create_employee_false_skips_employee(self, client, admin_hdr):
        r = client.post('/api/users', headers=admin_hdr, json={
            'email': 'integration.bot@afritech.dev',
            'password': 'Password123!',
            'create_employee': False,
        })
        assert r.status_code == 201
        user = r.get_json()['user']
        assert user['employee_id'] is None

        r = client.get('/api/employees?search=integration.bot@afritech.dev', headers=admin_hdr)
        assert r.get_json()['items'] == []

    def test_names_derived_from_email_when_missing(self, client, admin_hdr):
        r = client.post('/api/users', headers=admin_hdr, json={
            'email': 'john.doe@afritech.dev',
            'password': 'Password123!',
            'roles': ['manager'],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        user = r.get_json()['user']
        assert user['employee_id'] is not None
        assert user['employee_name'] == 'John Doe'

    def test_links_existing_unlinked_employee(self, client, admin_hdr):
        # seeded employee beata@afritech.dev has no user account
        r = client.post('/api/users', headers=admin_hdr, json={
            'email': 'beata@afritech.dev',
            'password': 'Password123!',
            'roles': ['service_agent'],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        user = r.get_json()['user']
        assert user['employee_id'] is not None
        assert user['employee_name'] == 'Beata Mukamana'

        emp = Employee.query.filter_by(email='beata@afritech.dev').first()
        assert emp.user_id == user['id']
        # still a single employee record, not a duplicate
        assert Employee.query.filter_by(email='beata@afritech.dev').count() == 1

    def test_instructor_role_creates_instructor_record(self, client, admin_hdr):
        from app.models import Instructor
        r = client.post('/api/users', headers=admin_hdr, json={
            'email': 'new.instructor@afritech.dev',
            'password': 'Password123!',
            'first_name': 'Aline',
            'last_name': 'Instructors',
            'roles': ['instructor'],
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        user = r.get_json()['user']
        assert user['employee_id'] is not None
        assert Instructor.query.filter_by(employee_id=user['employee_id']).first() is not None

    def test_duplicate_email_still_rejected(self, client, admin_hdr):
        r = client.post('/api/users', headers=admin_hdr, json={
            'email': 'admin@afritech.dev',
            'password': 'Password123!',
        })
        assert r.status_code == 400

    def test_user_list_exposes_employee_fields(self, client, admin_hdr):
        r = client.post('/api/users', headers=admin_hdr, json={
            'email': 'list.check@afritech.dev',
            'password': 'Password123!',
            'first_name': 'List',
            'last_name': 'Check',
        })
        assert r.status_code == 201
        r = client.get('/api/users?email=list.check@afritech.dev', headers=admin_hdr)
        assert r.status_code == 200
        items = r.get_json()['items']
        assert len(items) == 1
        assert items[0]['employee_name'] == 'List Check'
        assert items[0]['employee_id'] is not None


class TestBackfillEmployees:
    def test_backfill_creates_employee_for_orphan_user(self, app, client, admin_hdr):
        from app.models import User
        orphan = User(email='orphan.user@afritech.dev')
        orphan.set_password('Password123!')
        db.session.add(orphan)
        db.session.commit()

        runner = app.test_cli_runner()
        result = runner.invoke(args=['backfill-employees'])
        assert result.exit_code == 0, result.output
        assert 'Created orphan.user@afritech.dev' in result.output

        db.session.refresh(orphan)
        assert orphan.employee is not None
        assert orphan.employee.email == 'orphan.user@afritech.dev'
        assert orphan.employee.user_id == orphan.id

    def test_backfill_is_idempotent_and_skips_linked_users(self, app, client, admin_hdr):
        runner = app.test_cli_runner()
        first = runner.invoke(args=['backfill-employees'])
        assert first.exit_code == 0, first.output
        second = runner.invoke(args=['backfill-employees'])
        assert second.exit_code == 0, second.output
        assert 'Created' not in second.output
        assert '0 created' in second.output
