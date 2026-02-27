import sys
import os
import pytest

# Ensure the backend package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app import create_app, db as _db
from app.models import User, Appointment, BiomarkerReading, MedicalHistory


class TestConfig:
    TESTING = True
    SECRET_KEY = 'test-secret-key'
    SQLALCHEMY_DATABASE_URI = 'sqlite://'  # in-memory
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    API_TITLE = "CommonCare API"
    API_VERSION = "v1"
    OPENAPI_VERSION = "3.0.3"


@pytest.fixture(scope='function')
def app():
    """Create a fresh app + database for every test."""
    application = create_app(TestConfig)
    with application.app_context():
        _db.create_all()
        yield application
        _db.session.remove()
        _db.drop_all()


@pytest.fixture()
def db(app):
    return _db


@pytest.fixture()
def client(app):
    return app.test_client()


# ── Helper factories ────────────────────────────────────────────────────────

@pytest.fixture()
def create_user(app, db):
    """Factory fixture that creates and returns a User."""
    def _create(email='user@test.com', password='password123',
                full_name='Test User', user_type='patient',
                address='123 Test St', location='Charlotte'):
        user = User(
            email=email,
            full_name=full_name,
            address=address,
            location=location,
            user_type=user_type,
        )
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        return user
    return _create


@pytest.fixture()
def patient(create_user):
    return create_user(
        email='patient@test.com',
        full_name='John Patient',
        user_type='patient',
    )


@pytest.fixture()
def staff(create_user):
    return create_user(
        email='staff@test.com',
        full_name='Dr. Staff',
        user_type='staff',
    )


@pytest.fixture()
def auth_header(app, patient):
    """Return an Authorization header dict for the default patient."""
    from app.auth import generate_token
    token = generate_token(patient.id)
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture()
def staff_auth_header(app, staff):
    """Return an Authorization header dict for the default staff user."""
    from app.auth import generate_token
    token = generate_token(staff.id)
    return {'Authorization': f'Bearer {token}'}


def _token_header(app, user):
    """Utility: build a Bearer header for any user."""
    from app.auth import generate_token
    with app.app_context():
        token = generate_token(user.id)
    return {'Authorization': f'Bearer {token}'}
