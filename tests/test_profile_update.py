"""Tests for PUT /api/auth/profile."""
import json


class TestProfileUpdate:
    def test_update_full_name(self, client, patient, auth_header):
        res = client.put('/api/auth/profile',
                         data=json.dumps({'full_name': 'Jane Doe'}),
                         content_type='application/json',
                         headers=auth_header)
        assert res.status_code == 200
        assert res.get_json()['full_name'] == 'Jane Doe'

    def test_update_location(self, client, patient, auth_header):
        res = client.put('/api/auth/profile',
                         data=json.dumps({'location': 'Raleigh'}),
                         content_type='application/json',
                         headers=auth_header)
        assert res.status_code == 200
        assert res.get_json()['location'] == 'Raleigh'

    def test_update_address(self, client, patient, auth_header):
        res = client.put('/api/auth/profile',
                         data=json.dumps({'address': '99 Oak Lane'}),
                         content_type='application/json',
                         headers=auth_header)
        assert res.status_code == 200
        assert res.get_json()['address'] == '99 Oak Lane'

    def test_blank_full_name_not_applied(self, client, patient, auth_header):
        original = patient.full_name
        res = client.put('/api/auth/profile',
                         data=json.dumps({'full_name': '   '}),
                         content_type='application/json',
                         headers=auth_header)
        assert res.status_code == 200
        assert res.get_json()['full_name'] == original

    def test_blank_location_not_applied(self, client, patient, auth_header):
        original = patient.location
        res = client.put('/api/auth/profile',
                         data=json.dumps({'location': ''}),
                         content_type='application/json',
                         headers=auth_header)
        assert res.status_code == 200
        assert res.get_json()['location'] == original

    def test_email_is_not_changed(self, client, patient, auth_header):
        original_email = patient.email
        res = client.put('/api/auth/profile',
                         data=json.dumps({'email': 'hacker@evil.com'}),
                         content_type='application/json',
                         headers=auth_header)
        assert res.status_code == 200
        assert res.get_json()['email'] == original_email

    def test_user_type_is_not_changed(self, client, patient, auth_header):
        res = client.put('/api/auth/profile',
                         data=json.dumps({'user_type': 'staff'}),
                         content_type='application/json',
                         headers=auth_header)
        assert res.status_code == 200
        assert res.get_json()['user_type'] == 'patient'

    def test_no_data_returns_400(self, client, auth_header):
        res = client.put('/api/auth/profile',
                         content_type='application/json',
                         headers=auth_header)
        assert res.status_code == 400

    def test_requires_authentication(self, client):
        res = client.put('/api/auth/profile',
                         data=json.dumps({'full_name': 'X'}),
                         content_type='application/json')
        assert res.status_code == 401

    def test_staff_can_update_own_profile(self, client, staff, staff_auth_header):
        res = client.put('/api/auth/profile',
                         data=json.dumps({'full_name': 'Dr. Updated'}),
                         content_type='application/json',
                         headers=staff_auth_header)
        assert res.status_code == 200
        assert res.get_json()['full_name'] == 'Dr. Updated'

    def test_partial_update_preserves_other_fields(self, client, patient, auth_header):
        original_location = patient.location
        client.put('/api/auth/profile',
                   data=json.dumps({'full_name': 'Only Name Changed'}),
                   content_type='application/json',
                   headers=auth_header)
        res = client.get('/api/auth/me', headers=auth_header)
        data = res.get_json()
        assert data['full_name'] == 'Only Name Changed'
        assert data['location'] == original_location

    def test_response_includes_all_user_fields(self, client, patient, auth_header):
        res = client.put('/api/auth/profile',
                         data=json.dumps({'full_name': 'Complete'}),
                         content_type='application/json',
                         headers=auth_header)
        data = res.get_json()
        for field in ('id', 'email', 'full_name', 'location', 'user_type'):
            assert field in data
