"""
Tests for the AfriTech Bridge LMS Booking System.

Tests cover:
- Model creation and serialization
- Availability engine slot generation
- Booking creation with double-booking prevention
- Cancellation and rescheduling
- Authorization checks
- Edge cases
"""

import pytest
from datetime import datetime, date, time, timedelta
from flask import Flask
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.fixture
def app():
    flask_app = Flask(__name__)
    flask_app.config['TESTING'] = True
    flask_app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    flask_app.config['JWT_SECRET_KEY'] = 'test-secret'
    flask_app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    from src.models.user_models import db
    from flask_jwt_extended import JWTManager
    # Force all model modules to register their tables on the metadata
    from src.models import (
        user_models, course_models, course_application, student_models,
        achievement_models, quiz_progress_models, opportunity_models,
        notification_models, system_settings_models, grading_models,
        internship_models, file_models, excel_grading_models, task_models,
        booking_models
    )
    db.init_app(flask_app)
    JWTManager(flask_app)
    return flask_app


@pytest.fixture
def db_session(app):
    with app.app_context():
        from src.models.user_models import db
        from src.models.booking_models import InstructorAvailability, AvailabilityException, Booking
        from src.models.notification_models import Notification
        from src.models.system_settings_models import SystemSetting
        from src.models.course_models import Course, Enrollment
        db.create_all()
        yield db.session
        db.session.remove()
        db.drop_all()


@pytest.fixture
def sample_roles(db_session):
    from src.models.user_models import Role
    student_role = Role(name='student')
    instructor_role = Role(name='instructor')
    admin_role = Role(name='admin')
    db_session.add_all([student_role, instructor_role, admin_role])
    db_session.commit()
    return {'student': student_role, 'instructor': instructor_role, 'admin': admin_role}


@pytest.fixture
def sample_users(db_session, sample_roles):
    from src.models.user_models import User, db
    student = User(
        username='teststudent',
        email='student@test.com',
        password_hash='hashed',
        first_name='Test',
        last_name='Student',
        role_id=sample_roles['student'].id,
        timezone='UTC',
    )
    instructor = User(
        username='testinstructor',
        email='instructor@test.com',
        password_hash='hashed',
        first_name='Test',
        last_name='Instructor',
        role_id=sample_roles['instructor'].id,
        timezone='UTC',
    )
    admin = User(
        username='testadmin',
        email='admin@test.com',
        password_hash='hashed',
        first_name='Test',
        last_name='Admin',
        role_id=sample_roles['admin'].id,
        timezone='UTC',
    )
    db.session.add_all([student, instructor, admin])
    db.session.commit()
    return {'student': student, 'instructor': instructor, 'admin': admin}


# ── Model Tests ─────────────────────────────────────────────────

class TestBookingModels:
    def test_instructor_availability_create(self, db_session, sample_users):
        from src.models.booking_models import InstructorAvailability
        avail = InstructorAvailability(
            instructor_id=sample_users['instructor'].id,
            day_of_week=0,  # Monday
            start_time=time(9, 0),
            end_time=time(17, 0),
            timezone='UTC',
            is_active=True,
        )
        db_session.add(avail)
        db_session.commit()
        assert avail.id is not None
        assert avail.day_of_week == 0
        assert avail.start_time == time(9, 0)

    def test_availability_exception_create(self, db_session, sample_users):
        from src.models.booking_models import AvailabilityException
        exc = AvailabilityException(
            instructor_id=sample_users['instructor'].id,
            date=date.today() + timedelta(days=7),
            is_blocked=True,
            reason='Holiday',
            timezone='UTC',
        )
        db_session.add(exc)
        db_session.commit()
        assert exc.id is not None
        assert exc.is_blocked is True

    def test_booking_create(self, db_session, sample_users):
        from src.models.booking_models import Booking, BookingStatus
        start = datetime.utcnow() + timedelta(days=3, hours=2)
        booking = Booking(
            student_id=sample_users['student'].id,
            instructor_id=sample_users['instructor'].id,
            start_datetime=start,
            end_datetime=start + timedelta(hours=1),
            timezone='UTC',
            status=BookingStatus.CONFIRMED,
            session_topic='Test Session',
        )
        db_session.add(booking)
        db_session.commit()
        assert booking.id is not None
        assert booking.status == BookingStatus.CONFIRMED

    def test_booking_to_dict(self, db_session, sample_users):
        from src.models.booking_models import Booking, BookingStatus
        start = datetime.utcnow() + timedelta(days=3, hours=2)
        booking = Booking(
            student_id=sample_users['student'].id,
            instructor_id=sample_users['instructor'].id,
            start_datetime=start,
            end_datetime=start + timedelta(hours=1),
            timezone='UTC',
            status=BookingStatus.CONFIRMED,
            session_topic='Test Session',
        )
        db_session.add(booking)
        db_session.commit()

        d = booking.to_dict()
        assert d['session_topic'] == 'Test Session'
        assert d['student_name'] == 'Test Student'
        assert d['instructor_name'] == 'Test Instructor'


# ── Availability Engine Tests ───────────────────────────────────

class TestAvailabilityEngine:
    def test_no_availability_returns_empty(self, db_session, sample_users):
        from src.services.availability_engine import get_instructor_availability_for_date
        result = get_instructor_availability_for_date(
            sample_users['instructor'].id,
            date.today() + timedelta(days=1),
        )
        assert result == []

    def test_recurring_availability_returns_windows(self, db_session, sample_users):
        from src.models.booking_models import InstructorAvailability
        from src.services.availability_engine import get_instructor_availability_for_date
        target = date.today() + timedelta(days=1)
        dow = target.weekday()

        avail = InstructorAvailability(
            instructor_id=sample_users['instructor'].id,
            day_of_week=dow,
            start_time=time(9, 0),
            end_time=time(17, 0),
            timezone='UTC',
            is_active=True,
        )
        db_session.add(avail)
        db_session.commit()

        windows = get_instructor_availability_for_date(
            sample_users['instructor'].id, target
        )
        assert len(windows) == 1
        assert windows[0] == (time(9, 0), time(17, 0))

    def test_blocked_date_returns_empty(self, db_session, sample_users):
        from src.models.booking_models import InstructorAvailability, AvailabilityException
        from src.services.availability_engine import get_instructor_availability_for_date
        target = date.today() + timedelta(days=5)
        dow = target.weekday()

        avail = InstructorAvailability(
            instructor_id=sample_users['instructor'].id,
            day_of_week=dow,
            start_time=time(9, 0),
            end_time=time(17, 0),
            timezone='UTC',
            is_active=True,
        )
        exc = AvailabilityException(
            instructor_id=sample_users['instructor'].id,
            date=target,
            is_blocked=True,
            timezone='UTC',
        )
        db_session.add_all([avail, exc])
        db_session.commit()

        windows = get_instructor_availability_for_date(
            sample_users['instructor'].id, target
        )
        assert windows == []

    def test_generate_slots(self, db_session, sample_users):
        from src.models.booking_models import InstructorAvailability
        from src.services.availability_engine import get_available_slots
        target = date.today() + timedelta(days=2)
        dow = target.weekday()

        avail = InstructorAvailability(
            instructor_id=sample_users['instructor'].id,
            day_of_week=dow,
            start_time=time(9, 0),
            end_time=time(12, 0),
            timezone='UTC',
            is_active=True,
        )
        db_session.add(avail)
        db_session.commit()

        slots = get_available_slots(
            sample_users['instructor'].id,
            target,
            slot_duration_minutes=60,
        )
        assert len(slots) == 3  # 09:00, 10:00, 11:00
        assert all(s['is_available'] for s in slots)

    def test_generate_slots_with_buffer(self, db_session, sample_users):
        from src.models.booking_models import InstructorAvailability
        from src.services.availability_engine import get_available_slots
        from src.models.user_models import User, db

        target = date.today() + timedelta(days=2)
        dow = target.weekday()

        avail = InstructorAvailability(
            instructor_id=sample_users['instructor'].id,
            day_of_week=dow,
            start_time=time(9, 0),
            end_time=time(12, 0),
            timezone='UTC',
            is_active=True,
        )
        db_session.add(avail)

        instructor = User.query.get(sample_users['instructor'].id)
        instructor.buffer_minutes = 30
        db_session.commit()

        slots = get_available_slots(
            sample_users['instructor'].id,
            target,
            slot_duration_minutes=60,
        )
        # 60-min session + 30-min buffer: 09:00-10:00, then next at 10:30-11:30
        start_times = [s['start_time'] for s in slots]
        assert start_times == ['09:00', '10:30']
        assert all(s['is_available'] for s in slots)

    def test_buffer_blocks_overlapping_booking(self, db_session, sample_users):
        from src.models.booking_models import InstructorAvailability, Booking, BookingStatus
        from src.services.booking_service import create_booking
        from src.models.user_models import User, db

        target = datetime.utcnow().replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=5)
        instructor = User.query.get(sample_users['instructor'].id)
        instructor.buffer_minutes = 30
        dow = target.date().weekday()
        avail = InstructorAvailability(
            instructor_id=sample_users['instructor'].id,
            day_of_week=dow,
            start_time=time(9, 0),
            end_time=time(17, 0),
            timezone='UTC',
            is_active=True,
        )
        db_session.add(avail)
        db_session.commit()

        # First booking at 09:00
        booking, error = create_booking(
            student_id=sample_users['student'].id,
            instructor_id=sample_users['instructor'].id,
            start_datetime=target,
            session_topic='First',
        )
        assert booking is not None

        # Trying to book at 10:00 (within the 09:00-10:00 session + 30-min buffer)
        # must fail because the second session would start during the buffer.
        second_start = target.replace(hour=10, minute=0)
        booking2, error2 = create_booking(
            student_id=sample_users['student'].id,
            instructor_id=sample_users['instructor'].id,
            start_datetime=second_start,
            session_topic='Second',
        )
        assert booking2 is None
        assert 'no longer available' in error2.lower()

        # Booking at 10:30 (after the buffer) must succeed.
        third_start = target.replace(hour=10, minute=30)
        booking3, error3 = create_booking(
            student_id=sample_users['student'].id,
            instructor_id=sample_users['instructor'].id,
            start_datetime=third_start,
            session_topic='Third',
        )
        assert booking3 is not None, error3

    def test_past_date_returns_empty(self, db_session, sample_users):
        from src.services.availability_engine import get_available_slots
        slots = get_available_slots(
            sample_users['instructor'].id,
            date.today() - timedelta(days=1),
        )
        assert slots == []


# ── Booking Service Tests ───────────────────────────────────────

class TestBookingService:
    def _setup_availability(self, db_session, instructor_id, target_date):
        from src.models.booking_models import InstructorAvailability
        dow = target_date.weekday()
        avail = InstructorAvailability(
            instructor_id=instructor_id,
            day_of_week=dow,
            start_time=time(9, 0),
            end_time=time(17, 0),
            timezone='UTC',
            is_active=True,
        )
        db_session.add(avail)
        db_session.commit()

    def test_create_booking_success(self, db_session, sample_users):
        from src.services.booking_service import create_booking
        target = datetime.utcnow().replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=5)
        self._setup_availability(db_session, sample_users['instructor'].id, target.date())

        booking, error = create_booking(
            student_id=sample_users['student'].id,
            instructor_id=sample_users['instructor'].id,
            start_datetime=target,
            session_topic='Test booking',
        )
        assert booking is not None
        assert error == ''
        assert booking.status == 'pending'

    def test_create_booking_no_availability(self, db_session, sample_users):
        from src.services.booking_service import create_booking
        target = datetime.utcnow().replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=5)

        booking, error = create_booking(
            student_id=sample_users['student'].id,
            instructor_id=sample_users['instructor'].id,
            start_datetime=target,
            session_topic='Test booking',
        )
        assert booking is None
        assert 'not available' in error.lower()

    def test_create_booking_inactive_instructor(self, db_session, sample_users):
        from src.services.booking_service import create_booking
        from src.models.user_models import User, db
        target = datetime.utcnow().replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=5)

        inactive = User(
            username='inactive', email='inactive@test.com',
            password_hash='h', first_name='I', last_name='N',
            role_id=sample_users['instructor'].role_id, is_active=False,
        )
        db.session.add(inactive)
        db.session.commit()

        booking, error = create_booking(
            student_id=sample_users['student'].id,
            instructor_id=inactive.id,
            start_datetime=target,
            session_topic='Test',
        )
        assert booking is None
        assert 'not found' in error.lower() or 'inactive' in error.lower()

    def test_create_booking_empty_topic(self, db_session, sample_users):
        from src.services.booking_service import create_booking
        target = datetime.utcnow().replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=5)
        self._setup_availability(db_session, sample_users['instructor'].id, target.date())

        booking, error = create_booking(
            student_id=sample_users['student'].id,
            instructor_id=sample_users['instructor'].id,
            start_datetime=target,
            session_topic='  ',
        )
        assert booking is None
        assert 'topic' in error.lower()

    def test_double_booking_prevention(self, db_session, sample_users):
        from src.services.booking_service import create_booking
        target = datetime.utcnow().replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=5)
        self._setup_availability(db_session, sample_users['instructor'].id, target.date())

        booking1, error1 = create_booking(
            student_id=sample_users['student'].id,
            instructor_id=sample_users['instructor'].id,
            start_datetime=target,
            session_topic='First booking',
        )
        assert booking1 is not None

        # Create second student
        from src.models.user_models import User, Role, db
        student2 = User(
            username='student2', email='s2@test.com',
            password_hash='h', first_name='S', last_name='T',
            role_id=sample_users['student'].role_id,
        )
        db.session.add(student2)
        db.session.commit()

        booking2, error2 = create_booking(
            student_id=student2.id,
            instructor_id=sample_users['instructor'].id,
            start_datetime=target,
            session_topic='Second booking',
        )
        assert booking2 is None
        assert 'no longer available' in error2.lower() or 'already booked' in error2.lower()

    def test_cancel_booking(self, db_session, sample_users):
        from src.services.booking_service import create_booking, cancel_booking
        from src.models.booking_models import Booking, BookingStatus
        target = datetime.utcnow().replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=5)
        self._setup_availability(db_session, sample_users['instructor'].id, target.date())

        booking, _ = create_booking(
            student_id=sample_users['student'].id,
            instructor_id=sample_users['instructor'].id,
            start_datetime=target,
            session_topic='To cancel',
        )

        success, error = cancel_booking(
            booking.id, sample_users['student'].id, 'Changed plans'
        )
        assert success is True

        db_session.refresh(booking)
        assert booking.status == BookingStatus.CANCELLED
        assert booking.cancellation_reason == 'Changed plans'

    def test_cancel_past_booking_fails(self, db_session, sample_users):
        from src.services.booking_service import create_booking, cancel_booking
        from src.models.booking_models import Booking
        past = datetime.utcnow().replace(hour=10, minute=0, second=0, microsecond=0) - timedelta(days=1)
        self._setup_availability(db_session, sample_users['instructor'].id, past.date())

        # Directly create a past booking (create_booking would reject it)
        booking = Booking(
            student_id=sample_users['student'].id,
            instructor_id=sample_users['instructor'].id,
            start_datetime=past,
            end_datetime=past + timedelta(hours=1),
            status='confirmed',
            session_topic='Past session',
        )
        db_session.add(booking)
        db_session.commit()

        success, error = cancel_booking(booking.id, sample_users['student'].id)
        assert success is False
        assert 'cancel' in error.lower()

    def test_complete_booking(self, db_session, sample_users):
        from src.services.booking_service import create_booking, complete_booking, confirm_booking
        from src.models.booking_models import BookingStatus
        target = datetime.utcnow().replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=5)
        self._setup_availability(db_session, sample_users['instructor'].id, target.date())

        booking, _ = create_booking(
            student_id=sample_users['student'].id,
            instructor_id=sample_users['instructor'].id,
            start_datetime=target,
            session_topic='To complete',
        )

        # Bookings start as pending; confirm before completing
        confirm_booking(booking.id, sample_users['instructor'].id)

        success, error = complete_booking(
            booking.id, sample_users['instructor'].id, 'Great session'
        )
        assert success is True


# ── Authorization Tests ─────────────────────────────────────────

class TestAuthorization:
    def test_student_cannot_manage_instructor_availability(self, app, sample_users):
        from src.routes.booking_routes import booking_bp
        app.register_blueprint(booking_bp)
        with app.test_client() as client:
            from flask_jwt_extended import create_access_token
            token = create_access_token(identity=str(sample_users['student'].id))
            resp = client.get(
                '/api/v1/instructor/my-availability',
                headers={'Authorization': f'Bearer {token}'},
            )
            assert resp.status_code == 403

    def test_instructor_cannot_book(self, app, sample_users):
        from src.routes.booking_routes import booking_bp
        app.register_blueprint(booking_bp)
        with app.test_client() as client:
            from flask_jwt_extended import create_access_token
            token = create_access_token(identity=str(sample_users['instructor'].id))
            resp = client.get(
                '/api/v1/student/booking-instructors',
                headers={'Authorization': f'Bearer {token}'},
            )
            assert resp.status_code == 403

    def test_admin_cannot_book(self, app, sample_users):
        from src.routes.booking_routes import booking_bp
        app.register_blueprint(booking_bp)
        with app.test_client() as client:
            from flask_jwt_extended import create_access_token
            token = create_access_token(identity=str(sample_users['admin'].id))
            resp = client.get(
                '/api/v1/student/booking-instructors',
                headers={'Authorization': f'Bearer {token}'},
            )
            assert resp.status_code == 403

    def test_unauthenticated_access_rejected(self, app):
        from src.routes.booking_routes import booking_bp
        from flask_jwt_extended import JWTManager
        JWTManager(app)
        app.register_blueprint(booking_bp)
        with app.test_client() as client:
            resp = client.get('/api/v1/student/booking-instructors')
            assert resp.status_code == 401

    def test_student_can_access_booking_endpoints(self, app, sample_users):
        from src.routes.booking_routes import booking_bp
        from flask_jwt_extended import JWTManager
        JWTManager(app)
        app.register_blueprint(booking_bp)
        with app.test_client() as client:
            from flask_jwt_extended import create_access_token
            token = create_access_token(identity=str(sample_users['student'].id))
            resp = client.get(
                '/api/v1/student/booking-instructors',
                headers={'Authorization': f'Bearer {token}'},
            )
            assert resp.status_code == 200

    def test_instructor_can_access_availability_endpoints(self, app, sample_users):
        from src.routes.booking_routes import booking_bp
        from flask_jwt_extended import JWTManager
        JWTManager(app)
        app.register_blueprint(booking_bp)
        with app.test_client() as client:
            from flask_jwt_extended import create_access_token
            token = create_access_token(identity=str(sample_users['instructor'].id))
            resp = client.get(
                '/api/v1/instructor/my-availability',
                headers={'Authorization': f'Bearer {token}'},
            )
            assert resp.status_code == 200

    def test_admin_can_access_booking_stats(self, app, sample_users):
        from src.routes.booking_routes import booking_bp
        app.register_blueprint(booking_bp)
        with app.test_client() as client:
            from flask_jwt_extended import create_access_token
            token = create_access_token(identity=str(sample_users['admin'].id))
            resp = client.get(
                '/api/v1/admin/bookings/stats',
                headers={'Authorization': f'Bearer {token}'},
            )
            assert resp.status_code == 200


# ── Edge Case Tests ─────────────────────────────────────────────

class TestEdgeCases:
    def test_availability_subtraction(self, db_session):
        from src.services.availability_engine import _subtract_windows
        windows = [(time(9, 0), time(17, 0))]
        result = _subtract_windows(windows, time(12, 0), time(13, 0))
        assert len(result) == 2
        assert result[0] == (time(9, 0), time(12, 0))
        assert result[1] == (time(13, 0), time(17, 0))

    def test_availability_subtraction_full_block(self, db_session):
        from src.services.availability_engine import _subtract_windows
        windows = [(time(9, 0), time(17, 0))]
        result = _subtract_windows(windows, time(9, 0), time(17, 0))
        assert result == []

    def test_times_overlap(self):
        from src.services.availability_engine import _times_overlap
        assert _times_overlap(time(9, 0), time(11, 0), time(10, 0), time(12, 0)) is True
        assert _times_overlap(time(9, 0), time(10, 0), time(10, 0), time(11, 0)) is False
        assert _times_overlap(time(9, 0), time(10, 0), time(8, 0), time(9, 0)) is False
        assert _times_overlap(time(9, 0), time(12, 0), time(10, 0), time(11, 0)) is True

    def test_duplicate_availability_exception(self, db_session, sample_users):
        from src.models.booking_models import AvailabilityException
        target = date.today() + timedelta(days=10)
        exc1 = AvailabilityException(
            instructor_id=sample_users['instructor'].id,
            date=target,
            is_blocked=True,
            start_time=time(9, 0),
            end_time=time(17, 0),
            timezone='UTC',
        )
        db_session.add(exc1)
        db_session.commit()

        exc2 = AvailabilityException(
            instructor_id=sample_users['instructor'].id,
            date=target,
            is_blocked=True,
            start_time=time(9, 0),
            end_time=time(17, 0),
            timezone='UTC',
        )
        db_session.add(exc2)
        with pytest.raises(Exception):
            db_session.commit()
