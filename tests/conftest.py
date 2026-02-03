import pytest
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))

from app import create_app, db
from app.models import User


class TestConfig:
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.environ.get('TEST_DATABASE_URL', 'postgresql+psycopg://postgres:postgres@localhost:5432/commoncare')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = 'test-secret-key'


@pytest.fixture(scope='function')
def app():
    app = create_app(TestConfig)
    with app.app_context():
        yield app


@pytest.fixture(scope='function')
def client(app):
    return app.test_client()


@pytest.fixture(scope='function')
def db_session(app):
    with app.app_context():
        yield db


@pytest.fixture
def sample_user_data():
    return {
        'username': 'test_user_pytest',
        'email': 'test_pytest@example.com',
        'role': 'patient'
    }


@pytest.fixture
def api_base_url():
    return os.environ.get('API_BASE_URL', 'http://localhost:5000')


@pytest.fixture
def ui_base_url():
    return os.environ.get('UI_BASE_URL', 'http://localhost:8080')


@pytest.fixture
def db_sql_path():
    return os.environ.get('DB_SQL_PATH', os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'db', 'init.sql'))
