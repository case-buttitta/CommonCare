"""
#22 – Manager account type identified
Verify that the 'staff' user_type functions as the manager/medical-professional
role and that role-based access control is enforced.
"""
import pytest


class TestManagerAccountType:
    """Staff (manager) role identification and privilege checks."""

    def test_signup_as_staff(self, client):
        """A user can register with user_type='staff'."""
        resp = client.post('/api/auth/signup', json={
            'email': 'manager@test.com',
            'password': 'password123',
            'full_name': 'Manager User',
            'user_type': 'staff',
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['user']['user_type'] == 'staff'

    def test_signup_as_patient(self, client):
        """A user can register with user_type='patient'."""
        resp = client.post('/api/auth/signup', json={
            'email': 'pat@test.com',
            'password': 'password123',
            'full_name': 'Patient User',
            'user_type': 'patient',
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['user']['user_type'] == 'patient'

    def test_signup_invalid_user_type_rejected(self, client):
        """user_type must be 'patient' or 'staff'; anything else is rejected."""
        resp = client.post('/api/auth/signup', json={
            'email': 'bad@test.com',
            'password': 'password123',
            'full_name': 'Bad Type',
            'user_type': 'admin',
        })
        assert resp.status_code == 400

    def test_staff_can_access_patients_endpoint(self, client, staff_auth_header, patient):
        resp = client.get('/api/patients', headers=staff_auth_header)
        assert resp.status_code == 200

    def test_patient_cannot_access_patients_endpoint(self, client, auth_header):
        resp = client.get('/api/patients', headers=auth_header)
        assert resp.status_code == 403

    def test_staff_can_update_appointment(self, client, db, patient, staff, staff_auth_header):
        """Staff can update appointment status and notes."""
        from app.models import Appointment
        from datetime import datetime

        appt = Appointment(
            patient_id=patient.id,
            doctor_id=staff.id,
            appointment_date=datetime.utcnow(),
            status='pending',
        )
        db.session.add(appt)
        db.session.commit()

        resp = client.put(f'/api/appointments/{appt.id}',
                          headers=staff_auth_header,
                          json={'status': 'completed', 'notes': 'All good'})
        assert resp.status_code == 200
        assert resp.get_json()['status'] == 'completed'

    def test_patient_cannot_update_appointment(self, client, db, patient, staff, auth_header):
        """Patient must NOT be able to update appointments."""
        from app.models import Appointment
        from datetime import datetime

        appt = Appointment(
            patient_id=patient.id,
            doctor_id=staff.id,
            appointment_date=datetime.utcnow(),
            status='pending',
        )
        db.session.add(appt)
        db.session.commit()

        resp = client.put(f'/api/appointments/{appt.id}',
                          headers=auth_header,
                          json={'status': 'completed'})
        assert resp.status_code == 403

    def test_me_endpoint_returns_user_type(self, client, staff_auth_header):
        """GET /api/auth/me must include the user_type field."""
        resp = client.get('/api/auth/me', headers=staff_auth_header)
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'user_type' in data
        assert data['user_type'] == 'staff'
