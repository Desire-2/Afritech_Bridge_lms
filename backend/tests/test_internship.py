# Tests for Internship Application System

import pytest
import json
import os
import tempfile
from datetime import datetime, timedelta
from io import BytesIO

from src.models.user_models import db, User, Role
from src.models.internship_models import (
    InternshipTrack,
    InternshipCohort,
    InternshipApplication,
    ApplicationStatusLog,
    ApplicationStatusEnum,
    ApplicantTypeEnum,
)
from src.blueprints.internships.utils import (
    generate_reference_code,
    validate_phone_number,
    is_valid_status_transition,
    sanitize_text,
)


class TestInternshipModels:
    """Tests for internship data models"""
    
    def test_internship_track_creation(self, db_session):
        """Test creating an internship track"""
        track = InternshipTrack(
            name='Backend Development',
            slug='backend',
            icon_key='backend',
            description='Build server-side applications',
            is_active=True,
        )
        db_session.add(track)
        db_session.commit()
        
        assert track.id is not None
        assert track.name == 'Backend Development'
        assert track.slug == 'backend'
        assert track.is_active is True
    
    def test_internship_cohort_creation(self, db_session, track):
        """Test creating an internship cohort"""
        now = datetime.utcnow()
        cohort = InternshipCohort(
            track_id=track.id,
            cohort_name='Backend Q2 2026',
            cohort_code='BE-Q2-2026',
            start_date=now + timedelta(days=30),
            end_date=now + timedelta(days=120),
            capacity=20,
            is_accepting=True,
        )
        db_session.add(cohort)
        db_session.commit()
        
        assert cohort.id is not None
        assert cohort.cohort_code == 'BE-Q2-2026'
        assert cohort.capacity == 20
    
    def test_cohort_capacity_check(self, db_session, cohort):
        """Test cohort capacity checking"""
        assert cohort.get_accepted_count() == 0
        assert cohort.is_full() is False
    
    def test_application_creation(self, db_session, track, cohort):
        """Test creating an internship application"""
        app = InternshipApplication(
            reference_code='ATB-26-ABCD',
            applicant_type=ApplicantTypeEnum.GRADUATE,
            full_name='John Doe',
            email='john@example.com',
            phone='+250788123456',
            track_id=track.id,
            cohort_id=cohort.id,
            motivation_letter='I am very interested in this internship.',
            cv_file_path='uploads/internship_cvs/uuid/resume.pdf',
            cv_original_name='resume.pdf',
            status=ApplicationStatusEnum.PENDING,
        )
        db_session.add(app)
        db_session.commit()
        
        assert app.id is not None
        assert app.reference_code == 'ATB-26-ABCD'
        assert app.status == ApplicationStatusEnum.PENDING
    
    def test_status_log_creation(self, db_session, application):
        """Test creating a status log"""
        log = ApplicationStatusLog(
            application_id=application.id,
            changed_by_id=1,
            old_status=ApplicationStatusEnum.PENDING,
            new_status=ApplicationStatusEnum.REVIEWING,
            note='Under review',
        )
        db_session.add(log)
        db_session.commit()
        
        assert log.id is not None
        assert log.new_status == ApplicationStatusEnum.REVIEWING


class TestUtilityFunctions:
    """Tests for utility functions"""
    
    def test_reference_code_generation(self):
        """Test reference code generation format"""
        code = generate_reference_code()
        
        # Format: ATB-YY-XXXX
        assert code.startswith('ATB-')
        assert len(code) == 12
        parts = code.split('-')
        assert len(parts) == 3
        assert parts[1].isdigit()
        assert len(parts[1]) == 2
        assert len(parts[2]) == 4
    
    def test_phone_validation_e164(self):
        """Test E.164 phone format validation"""
        assert validate_phone_number('+250788123456') is True
        assert validate_phone_number('+1234567890') is True
        assert validate_phone_number('+33123456789') is True
    
    def test_phone_validation_local_rw(self):
        """Test local Rwanda phone format validation"""
        assert validate_phone_number('0788123456') is True
        assert validate_phone_number('788123456') is True
        assert validate_phone_number('0712345678') is True
    
    def test_phone_validation_invalid(self):
        """Test invalid phone numbers"""
        assert validate_phone_number('invalid') is False
        assert validate_phone_number('123') is False
        assert validate_phone_number('') is False
        assert validate_phone_number(None) is False
    
    def test_status_transition_valid(self):
        """Test valid status transitions"""
        assert is_valid_status_transition(
            ApplicationStatusEnum.PENDING,
            ApplicationStatusEnum.REVIEWING
        ) is True
        
        assert is_valid_status_transition(
            ApplicationStatusEnum.REVIEWING,
            ApplicationStatusEnum.SHORTLISTED
        ) is True
        
        assert is_valid_status_transition(
            ApplicationStatusEnum.SHORTLISTED,
            ApplicationStatusEnum.INTERVIEW_SCHEDULED
        ) is True
        
        assert is_valid_status_transition(
            ApplicationStatusEnum.INTERVIEW_SCHEDULED,
            ApplicationStatusEnum.ACCEPTED
        ) is True
    
    def test_status_transition_invalid(self):
        """Test invalid status transitions"""
        # Can't go backwards
        assert is_valid_status_transition(
            ApplicationStatusEnum.REVIEWING,
            ApplicationStatusEnum.PENDING
        ) is False
        
        # Terminal states have no transitions
        assert is_valid_status_transition(
            ApplicationStatusEnum.ACCEPTED,
            ApplicationStatusEnum.REJECTED
        ) is False
        
        assert is_valid_status_transition(
            ApplicationStatusEnum.REJECTED,
            ApplicationStatusEnum.ACCEPTED
        ) is False
    
    def test_text_sanitization(self):
        """Test text sanitization"""
        text = "  Hello   World  \n  Test  "
        sanitized = sanitize_text(text)
        
        assert sanitized == "Hello World Test"
    
    def test_text_truncation(self):
        """Test text truncation"""
        text = "This is a very long text that should be truncated"
        sanitized = sanitize_text(text, max_length=20)
        
        assert len(sanitized) <= 20


class TestAPIRoutes:
    """Tests for API endpoints"""
    
    def test_get_tracks(self, client):
        """Test GET /api/v1/internships/tracks"""
        response = client.get('/api/v1/internships/tracks')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'success' in data
        assert 'data' in data
        assert isinstance(data['data'], list)
    
    def test_check_status_not_found(self, client):
        """Test application status check with invalid reference code"""
        response = client.get('/api/v1/internships/apply/status?ref=ATB-00-XXXX&email=test@example.com')
        
        assert response.status_code == 404
        data = json.loads(response.data)
        assert data['success'] is False
    
    def test_check_status_missing_params(self, client):
        """Test status check without required parameters"""
        response = client.get('/api/v1/internships/apply/status')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['success'] is False
    
    def test_submit_application_missing_cv(self, client):
        """Test application submission without CV"""
        response = client.post('/api/v1/internships/apply', data={
            'full_name': 'John Doe',
            'email': 'john@example.com',
        })
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['success'] is False
    
    def test_submit_application_invalid_phone(self, client, track):
        """Test application submission with invalid phone"""
        cv_data = BytesIO(b'fake pdf content')
        
        response = client.post('/api/v1/internships/apply', data={
            'applicant_type': 'graduate',
            'full_name': 'John Doe',
            'email': 'john@example.com',
            'phone': 'invalid',
            'track_id': track.id,
            'motivation_letter': 'I am interested in this internship program.',
            'cv': (cv_data, 'resume.pdf'),
        })
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['success'] is False


class TestEmailNotifications:
    """Tests for email notifications"""
    
    def test_confirmation_email_template(self, application):
        """Test that confirmation email template renders without errors"""
        from src.services.internship_mailer import InternshipMailer
        
        mailer = InternshipMailer()
        template = mailer._get_confirmation_template()
        
        assert 'AfriTech Bridge Team' in template
        assert '{{ reference_code }}' in template
        assert '{{ full_name }}' in template
    
    def test_accepted_email_template(self):
        """Test that accepted email template renders without errors"""
        from src.services.internship_mailer import InternshipMailer
        
        mailer = InternshipMailer()
        template = mailer._get_accepted_template()
        
        assert 'Welcome' in template
        assert '{{ track_name }}' in template


# ============= FIXTURES =============

@pytest.fixture
def app():
    """Create and configure a test Flask app"""
    from main import app as flask_app
    
    flask_app.config['TESTING'] = True
    flask_app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    
    return flask_app


@pytest.fixture
def client(app):
    """Create a test client"""
    return app.test_client()


@pytest.fixture
def db_session(app):
    """Create a fresh database session for testing"""
    with app.app_context():
        db.create_all()
        yield db.session
        db.session.rollback()
        db.drop_all()


@pytest.fixture
def track(db_session):
    """Create a sample internship track"""
    track = InternshipTrack(
        name='Backend Development',
        slug='backend',
        icon_key='backend',
        description='Build server-side applications',
        is_active=True,
    )
    db_session.add(track)
    db_session.commit()
    return track


@pytest.fixture
def cohort(db_session, track):
    """Create a sample internship cohort"""
    now = datetime.utcnow()
    cohort = InternshipCohort(
        track_id=track.id,
        cohort_name='Backend Q2 2026',
        cohort_code='BE-Q2-2026',
        start_date=now + timedelta(days=30),
        end_date=now + timedelta(days=120),
        capacity=20,
        is_accepting=True,
    )
    db_session.add(cohort)
    db_session.commit()
    return cohort


@pytest.fixture
def application(db_session, track, cohort):
    """Create a sample internship application"""
    app = InternshipApplication(
        reference_code='ATB-26-TEST',
        applicant_type=ApplicantTypeEnum.GRADUATE,
        full_name='John Doe',
        email='john@example.com',
        phone='+250788123456',
        track_id=track.id,
        cohort_id=cohort.id,
        motivation_letter='I am very interested in this internship. This is a test application.',
        cv_file_path='uploads/internship_cvs/test-uuid/resume.pdf',
        cv_original_name='resume.pdf',
        status=ApplicationStatusEnum.PENDING,
    )
    db_session.add(app)
    db_session.commit()
    return app
