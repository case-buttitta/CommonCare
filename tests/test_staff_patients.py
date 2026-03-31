"""
Tests for staff and patient listing endpoints.
  GET /api/staff   – any authenticated user can see staff
  GET /api/patients – staff-only
"""
import pytest
from app.models import User


class TestStaffListing:
    """GET /api/staff"""

    def test_requires_authentication(self, client):
        res = client.get('/api/staff')
        assert res.status_code == 401

    def test_patient_can_list_staff(self, client, patient, staff, auth_header):
        res = client.get('/api/staff', headers=auth_header)
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data, list)
        assert any(u['id'] == staff.id for u in data)

    def test_staff_can_list_staff(self, client, staff, staff_auth_header):
        res = client.get('/api/staff', headers=staff_auth_header)
        assert res.status_code == 200

    def test_response_excludes_patients(self, client, patient, staff, auth_header):
        """Staff list must not contain patient accounts."""
        res = client.get('/api/staff', headers=auth_header)
        data = res.get_json()
        ids = [u['id'] for u in data]
        assert patient.id not in ids

    def test_response_contains_expected_fields(self, client, staff, auth_header):
        res = client.get('/api/staff', headers=auth_header)
        data = res.get_json()
        assert len(data) >= 1
        member = data[0]
        for field in ('id', 'full_name', 'email'):
            assert field in member

    def test_multiple_staff_all_returned(self, client, db, create_user, auth_header):
        s1 = create_user(email='doc1@test.com', user_type='staff', full_name='Dr One')
        s2 = create_user(email='doc2@test.com', user_type='staff', full_name='Dr Two')
        res = client.get('/api/staff', headers=auth_header)
        data = res.get_json()
        ids = [u['id'] for u in data]
        assert s1.id in ids
        assert s2.id in ids

    def test_passwords_not_exposed(self, client, staff, auth_header):
        res = client.get('/api/staff', headers=auth_header)
        for member in res.get_json():
            assert 'password' not in member
            assert 'password_hash' not in member


class TestPatientListing:
    """GET /api/patients – staff-only endpoint."""

    def test_requires_authentication(self, client):
        res = client.get('/api/patients')
        assert res.status_code == 401

    def test_patient_cannot_list_patients(self, client, patient, auth_header):
        """Patients must be blocked from seeing the full patient list."""
        res = client.get('/api/patients', headers=auth_header)
        assert res.status_code == 403

    def test_staff_can_list_patients(self, client, patient, staff, staff_auth_header):
        res = client.get('/api/patients', headers=staff_auth_header)
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data, list)
        assert any(u['id'] == patient.id for u in data)

    def test_response_excludes_staff_accounts(self, client, patient, staff, staff_auth_header):
        """Patient list must not include staff members."""
        res = client.get('/api/patients', headers=staff_auth_header)
        data = res.get_json()
        ids = [u['id'] for u in data]
        assert staff.id not in ids

    def test_response_contains_expected_fields(self, client, patient, staff_auth_header):
        res = client.get('/api/patients', headers=staff_auth_header)
        data = res.get_json()
        assert len(data) >= 1
        p = data[0]
        for field in ('id', 'full_name', 'email'):
            assert field in p

    def test_multiple_patients_all_returned(self, client, db, create_user, staff_auth_header):
        p1 = create_user(email='pat1@test.com', user_type='patient', full_name='Patient One')
        p2 = create_user(email='pat2@test.com', user_type='patient', full_name='Patient Two')
        res = client.get('/api/patients', headers=staff_auth_header)
        data = res.get_json()
        ids = [u['id'] for u in data]
        assert p1.id in ids
        assert p2.id in ids

    def test_passwords_not_exposed(self, client, patient, staff_auth_header):
        res = client.get('/api/patients', headers=staff_auth_header)
        for p in res.get_json():
            assert 'password' not in p
            assert 'password_hash' not in p

    def test_search_by_name(self, client, db, create_user, staff_auth_header):
        """If search/filter param is supported, it narrows results."""
        create_user(email='alice@test.com', user_type='patient', full_name='Alice Smith')
        create_user(email='bob@test.com', user_type='patient', full_name='Bob Jones')
        res = client.get('/api/patients?search=Alice', headers=staff_auth_header)
        # Either search is supported (should only return Alice) or returns all –
        # either is acceptable; what must NOT happen is a 4xx/5xx error.
        assert res.status_code == 200
