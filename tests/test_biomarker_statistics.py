"""
#23 – Be able to input normal information or average information of a statistic
Verify that biomarker readings (statistics) can be created, retrieved with
history, and that the API returns previous/latest values useful for computing
averages and trends.
"""
import pytest
from app.models import Appointment, BiomarkerReading
from datetime import datetime, timedelta


class TestBiomarkerStatistics:
    """Biomarker data input and statistical retrieval."""

    def _create_completed_appointment(self, db, patient, staff, days_ago, readings):
        """Helper: create a completed appointment with biomarker readings."""
        appt = Appointment(
            patient_id=patient.id,
            doctor_id=staff.id,
            appointment_date=datetime.utcnow() - timedelta(days=days_ago),
            status='completed',
        )
        db.session.add(appt)
        db.session.flush()
        for r in readings:
            br = BiomarkerReading(
                appointment_id=appt.id,
                biomarker_type=r['type'],
                value=r['value'],
                unit=r.get('unit', 'mmHg'),
            )
            db.session.add(br)
        db.session.commit()
        return appt

    def test_staff_can_submit_biomarker_readings(self, client, db, patient, staff, staff_auth_header):
        """Staff can add biomarker readings via PUT /api/appointments/<id>."""
        appt = Appointment(
            patient_id=patient.id,
            doctor_id=staff.id,
            appointment_date=datetime.utcnow(),
            status='pending',
        )
        db.session.add(appt)
        db.session.commit()

        resp = client.put(
            f'/api/appointments/{appt.id}',
            headers=staff_auth_header,
            json={
                'status': 'completed',
                'biomarker_readings': [
                    {'biomarker_type': 'blood_pressure_systolic', 'value': 120, 'unit': 'mmHg'},
                    {'biomarker_type': 'blood_pressure_diastolic', 'value': 80, 'unit': 'mmHg'},
                ],
            },
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['status'] == 'completed'
        assert len(data['biomarker_readings']) == 2
        
    def test_staff_can_record_treatments(self, client, db, patient, staff, staff_auth_header):
        """Staff can add recommended treatments to an appointment."""
        appt = Appointment(patient_id=patient.id, doctor_id=staff.id, appointment_date=datetime.utcnow())
        db.session.add(appt)
        db.session.commit()

        resp = client.put(f'/api/appointments/{appt.id}', headers=staff_auth_header, json={
            'status': 'completed',
            'treatments': 'Increased water intake, daily 30m walks'
        })
        assert resp.status_code == 200
        assert resp.get_json()['treatments'] == 'Increased water intake, daily 30m walks'

    def test_biomarkers_endpoint_returns_latest(self, client, db, patient, staff, auth_header):
        """GET /api/patients/<id>/biomarkers returns latest readings."""
        self._create_completed_appointment(db, patient, staff, 30, [
            {'type': 'blood_pressure_systolic', 'value': 130},
        ])
        self._create_completed_appointment(db, patient, staff, 1, [
            {'type': 'blood_pressure_systolic', 'value': 120},
        ])

        resp = client.get(f'/api/patients/{patient.id}/biomarkers', headers=auth_header)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['latest']['blood_pressure_systolic']['value'] == 120

    def test_biomarkers_endpoint_returns_previous(self, client, db, patient, staff, auth_header):
        """Previous reading is the second-to-last for trend computation."""
        self._create_completed_appointment(db, patient, staff, 30, [
            {'type': 'blood_pressure_systolic', 'value': 130},
        ])
        self._create_completed_appointment(db, patient, staff, 1, [
            {'type': 'blood_pressure_systolic', 'value': 120},
        ])

        resp = client.get(f'/api/patients/{patient.id}/biomarkers', headers=auth_header)
        data = resp.get_json()
        assert data['previous']['blood_pressure_systolic']['value'] == 130

    def test_biomarkers_history_contains_all_readings(self, client, db, patient, staff, auth_header):
        """History array has every reading for the biomarker type."""
        for days, val in [(90, 140), (60, 135), (30, 128), (1, 120)]:
            self._create_completed_appointment(db, patient, staff, days, [
                {'type': 'blood_pressure_systolic', 'value': val},
            ])

        resp = client.get(f'/api/patients/{patient.id}/biomarkers', headers=auth_header)
        data = resp.get_json()
        history = data['history']['blood_pressure_systolic']
        assert len(history) == 4
        values = [h['value'] for h in history]
        assert values == [140, 135, 128, 120]  # ascending date order

    def test_no_biomarkers_returns_empty(self, client, db, patient, staff, auth_header):
        """A patient with no completed appointments has empty biomarker data."""
        resp = client.get(f'/api/patients/{patient.id}/biomarkers', headers=auth_header)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['latest'] == {}
        assert data['history'] == {}

    def test_patient_cannot_view_other_patient_biomarkers(self, client, db, create_user, staff, auth_header):
        """Patient cannot access another patient's biomarker data."""
        other = create_user(email='other@test.com', user_type='patient')
        resp = client.get(f'/api/patients/{other.id}/biomarkers', headers=auth_header)
        assert resp.status_code == 403

    def test_staff_can_view_any_patient_biomarkers(self, client, db, patient, staff, staff_auth_header):
        """Staff can view biomarkers for any patient."""
        resp = client.get(f'/api/patients/{patient.id}/biomarkers', headers=staff_auth_header)
        assert resp.status_code == 200
