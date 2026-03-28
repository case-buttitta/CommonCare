"""
#21 – Patient-staff account relationship
Verify that patient and staff accounts can be created, linked via appointments,
and that the relationship is correctly represented in the data model.
"""
import pytest
from app.models import User, Appointment
from datetime import datetime


class TestPatientStaffRelationship:
    """Verify the patient ↔ staff relationship through appointments."""

    def test_patient_and_staff_user_types_exist(self, patient, staff):
        assert patient.user_type == 'patient'
        assert staff.user_type == 'staff'

    def test_staff_listed_via_api(self, client, auth_header, staff):
        """Patients can retrieve the list of staff members."""
        resp = client.get('/api/staff', headers=auth_header)
        assert resp.status_code == 200
        data = resp.get_json()
        assert any(s['id'] == staff.id for s in data)

    def test_patients_listed_for_staff(self, client, staff_auth_header, patient):
        """Staff can retrieve the list of patients."""
        resp = client.get('/api/patients', headers=staff_auth_header)
        assert resp.status_code == 200
        data = resp.get_json()
        assert any(p['id'] == patient.id for p in data)

    def test_patient_cannot_list_patients(self, client, auth_header):
        """Patients should NOT be able to list other patients."""
        resp = client.get('/api/patients', headers=auth_header)
        assert resp.status_code == 403

    def test_appointment_links_patient_to_staff(self, app, db, patient, staff):
        """An appointment correctly references both patient and staff."""
        appt = Appointment(
            patient_id=patient.id,
            doctor_id=staff.id,
            appointment_date=datetime.utcnow(),
            status='pending',
            reason='Checkup',
        )
        db.session.add(appt)
        db.session.commit()

        assert appt.patient.id == patient.id
        assert appt.doctor.id == staff.id
        assert appt.patient.user_type == 'patient'
        assert appt.doctor.user_type == 'staff'

    def test_patient_sees_own_appointments_only(self, client, db, patient, staff, auth_header):
        """Patient's GET /api/appointments returns only their own."""
        appt = Appointment(
            patient_id=patient.id,
            doctor_id=staff.id,
            appointment_date=datetime.utcnow(),
            status='pending',
        )
        db.session.add(appt)
        db.session.commit()

        resp = client.get('/api/appointments', headers=auth_header)
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 1
        assert data[0]['patient_id'] == patient.id

    def test_staff_sees_all_appointments(self, client, db, patient, staff, staff_auth_header):
        """Staff's GET /api/appointments returns all appointments."""
        appt = Appointment(
            patient_id=patient.id,
            doctor_id=staff.id,
            appointment_date=datetime.utcnow(),
            status='pending',
        )
        db.session.add(appt)
        db.session.commit()

        resp = client.get('/api/appointments', headers=staff_auth_header)
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) >= 1

    def test_cascade_delete_patient_removes_appointments(self, app, db, patient, staff):
        """Deleting a patient cascades to their appointments."""
        appt = Appointment(
            patient_id=patient.id,
            doctor_id=staff.id,
            appointment_date=datetime.utcnow(),
            status='pending',
        )
        db.session.add(appt)
        db.session.commit()
        appt_id = appt.id

        db.session.delete(patient)
        db.session.commit()

        assert Appointment.query.get(appt_id) is None

    def test_patient_can_book_appointment(self, client, auth_header, staff):
        """POST /api/appointments allows patient to book a slot."""
        resp = client.post('/api/appointments', headers=auth_header, json={
            'doctor_id': staff.id,
            'appointment_date': '2025-12-01T10:00:00',
            'reason': 'Routine checkup'
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['doctor_id'] == staff.id
        assert data['reason'] == 'Routine checkup'
        assert data['status'] == 'pending'
