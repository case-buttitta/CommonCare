"""
#31 – Get user credentials or redirect to login if not authenticated
Verify that protected endpoints reject unauthenticated requests, return
proper errors for invalid tokens, and return user data for valid tokens.
"""
import pytest
import jwt
from datetime import datetime, timedelta


class TestAuthenticationRequired:
    """Unauthenticated requests are rejected with 401."""

    PROTECTED_ENDPOINTS = [
        ('GET', '/api/auth/me'),
        ('DELETE', '/api/auth/account'),
        ('GET', '/api/staff'),
        ('GET', '/api/patients'),
        ('GET', '/api/appointments'),
        ('POST', '/api/appointments'),
    ]

    @pytest.mark.parametrize('method,url', PROTECTED_ENDPOINTS)
    def test_no_token_returns_401(self, client, method, url):
        resp = getattr(client, method.lower())(url)
        assert resp.status_code == 401
        assert 'error' in resp.get_json()

    @pytest.mark.parametrize('method,url', PROTECTED_ENDPOINTS)
    def test_invalid_token_returns_401(self, client, method, url):
        headers = {'Authorization': 'Bearer totally.invalid.token'}
        resp = getattr(client, method.lower())(url, headers=headers)
        assert resp.status_code == 401

    def test_expired_token_returns_401(self, app, client, patient):
        """A JWT with an expiry in the past must be rejected."""
        payload = {
            'user_id': patient.id,
            'exp': datetime.utcnow() - timedelta(seconds=1),
            'iat': datetime.utcnow() - timedelta(hours=1),
        }
        expired_token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
        headers = {'Authorization': f'Bearer {expired_token}'}
        resp = client.get('/api/auth/me', headers=headers)
        assert resp.status_code == 401


class TestGetCredentials:
    """GET /api/auth/me returns current user data when authenticated."""

    def test_returns_user_data(self, client, auth_header, patient):
        resp = client.get('/api/auth/me', headers=auth_header)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['id'] == patient.id
        assert data['email'] == patient.email
        assert data['full_name'] == patient.full_name
        assert data['user_type'] == 'patient'

    def test_returns_staff_data(self, client, staff_auth_header, staff):
        resp = client.get('/api/auth/me', headers=staff_auth_header)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['user_type'] == 'staff'

    def test_deleted_user_token_returns_401(self, client, db, create_user, app):
        """Token for a user that has been deleted should return 401."""
        from app.auth import generate_token
        user = create_user(email='temp@test.com')
        token = generate_token(user.id)
        db.session.delete(user)
        db.session.commit()

        headers = {'Authorization': f'Bearer {token}'}
        resp = client.get('/api/auth/me', headers=headers)
        assert resp.status_code == 401


class TestLoginFlow:
    """Login returns token + user data; bad credentials are rejected."""

    def test_successful_login(self, client, patient):
        resp = client.post('/api/auth/login', json={
            'email': 'patient@test.com',
            'password': 'password123',
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'token' in data
        assert data['user']['id'] == patient.id

    def test_wrong_password(self, client, patient):
        resp = client.post('/api/auth/login', json={
            'email': 'patient@test.com',
            'password': 'wrongpass',
        })
        assert resp.status_code == 401

    def test_nonexistent_email(self, client):
        resp = client.post('/api/auth/login', json={
            'email': 'nobody@test.com',
            'password': 'password123',
        })
        assert resp.status_code == 401

    def test_missing_fields(self, client):
        resp = client.post('/api/auth/login', json={'email': 'x@test.com'})
        assert resp.status_code == 400

class TestAccountManagement:
    """Account signup, profile modification, and deletion."""

    def test_signup_flow(self, client, db):
        """POST /api/auth/signup creates a user and returns a token."""
        resp = client.post('/api/auth/signup', json={
            'email': 'new@test.com',
            'password': 'password123',
            'full_name': 'New User',
            'user_type': 'patient'
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert 'token' in data
        assert data['user']['email'] == 'new@test.com'
        assert data['user']['user_type'] == 'patient'

    def test_signup_fails_duplicate_email(self, client, patient):
        """Signup with an email already in database should fail."""
        resp = client.post('/api/auth/signup', json={
            'email': 'patient@test.com',
            'password': 'password123',
            'full_name': 'Duplicate',
            'user_type': 'patient'
        })
        assert resp.status_code == 400
        assert 'already registered' in resp.get_json()['error'].lower()

    def test_profile_modification(self, client, auth_header, patient):
        """PUT /api/auth/profile updates user details."""
        resp = client.put('/api/auth/profile', headers=auth_header, json={
            'full_name': 'John Updated',
            'address': '456 New St',
            'location': 'Raleigh'
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['full_name'] == 'John Updated'
        assert data['address'] == '456 New St'
        assert data['location'] == 'Raleigh'

    def test_delete_account(self, client, auth_header, db, patient):
        """DELETE /api/auth/account removes the user."""
        resp = client.delete('/api/auth/account', headers=auth_header)
        assert resp.status_code == 200
        from app.models import User
        assert User.query.get(patient.id) is None
