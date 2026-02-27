"""
#26 – Location data point identified
Verify that the location field is present in the User model, is stored
correctly, defaults to 'Charlotte', and is returned in API responses.
"""
import pytest
from app.models import User


class TestLocationDataPoint:
    """Location data is captured, defaulted, and exposed correctly."""

    def test_default_location_is_charlotte(self, app, db):
        """A user created without an explicit location defaults to 'Charlotte'."""
        user = User(
            email='loc@test.com',
            full_name='Loc Test',
            user_type='patient',
        )
        user.set_password('password123')
        db.session.add(user)
        db.session.commit()
        assert user.location == 'Charlotte'

    def test_custom_location_persisted(self, app, db):
        """A user created with a custom location stores it correctly."""
        user = User(
            email='loc2@test.com',
            full_name='Loc Test 2',
            user_type='patient',
            location='Raleigh',
        )
        user.set_password('password123')
        db.session.add(user)
        db.session.commit()

        fetched = User.query.get(user.id)
        assert fetched.location == 'Raleigh'

    def test_signup_stores_location(self, client):
        """POST /api/auth/signup with location persists it."""
        resp = client.post('/api/auth/signup', json={
            'email': 'loc3@test.com',
            'password': 'password123',
            'full_name': 'Loc Test 3',
            'user_type': 'patient',
            'location': 'Asheville',
        })
        assert resp.status_code == 201
        assert resp.get_json()['user']['location'] == 'Asheville'

    def test_signup_default_location(self, client):
        """POST /api/auth/signup without location defaults to Charlotte."""
        resp = client.post('/api/auth/signup', json={
            'email': 'loc4@test.com',
            'password': 'password123',
            'full_name': 'Loc Test 4',
            'user_type': 'patient',
        })
        assert resp.status_code == 201
        assert resp.get_json()['user']['location'] == 'Charlotte'

    def test_location_in_to_dict(self, patient):
        """User.to_dict() includes location."""
        d = patient.to_dict()
        assert 'location' in d
        assert isinstance(d['location'], str)

    def test_location_in_me_endpoint(self, client, auth_header):
        """GET /api/auth/me returns location."""
        resp = client.get('/api/auth/me', headers=auth_header)
        assert resp.status_code == 200
        assert 'location' in resp.get_json()
