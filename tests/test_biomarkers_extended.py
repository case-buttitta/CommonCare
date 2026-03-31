"""Extended biomarker tests: access control, data integrity, and edge cases."""
import json
from datetime import datetime, timedelta

import pytest
from app.models import Appointment, BiomarkerReading


def _make_completed_appt(db, patient, staff, days_ago, readings):
    appt = Appointment(
        patient_id=patient.id,
        doctor_id=staff.id,
        appointment_date=datetime.utcnow() - timedelta(days=days_ago),
        status='completed',
    )
    db.session.add(appt)
    db.session.flush()
    for r in readings:
        db.session.add(BiomarkerReading(
            appointment_id=appt.id,
            biomarker_type=r['type'],
            value=r['value'],
            unit=r.get('unit', 'units'),
        ))
    db.session.commit()
    return appt


class TestBiomarkerAccess:
    def test_requires_authentication(self, client, patient):
        res = client.get(f'/api/patients/{patient.id}/biomarkers')
        assert res.status_code == 401

    def test_patient_can_access_own_biomarkers(self, client, patient, auth_header):
        res = client.get(f'/api/patients/{patient.id}/biomarkers', headers=auth_header)
        assert res.status_code == 200

    def test_patient_blocked_from_other_patient_biomarkers(
            self, client, create_user, auth_header):
        other = create_user(email='other2@test.com', user_type='patient')
        res = client.get(f'/api/patients/{other.id}/biomarkers', headers=auth_header)
        assert res.status_code == 403

    def test_staff_can_access_any_patient_biomarkers(
            self, client, patient, staff_auth_header):
        res = client.get(f'/api/patients/{patient.id}/biomarkers', headers=staff_auth_header)
        assert res.status_code == 200


class TestBiomarkerDataIntegrity:
    def test_only_completed_appointments_count(self, client, db, patient, staff, auth_header):
        """Readings from pending appointments must NOT appear in biomarker data."""
        pending = Appointment(
            patient_id=patient.id,
            doctor_id=staff.id,
            appointment_date=datetime.utcnow(),
            status='pending',
        )
        db.session.add(pending)
        db.session.flush()
        db.session.add(BiomarkerReading(
            appointment_id=pending.id,
            biomarker_type='heart_rate',
            value=999,
            unit='bpm',
        ))
        db.session.commit()

        res = client.get(f'/api/patients/{patient.id}/biomarkers', headers=auth_header)
        data = res.get_json()
        assert 'heart_rate' not in data['latest']

    def test_response_has_expected_keys(self, client, patient, auth_header):
        res = client.get(f'/api/patients/{patient.id}/biomarkers', headers=auth_header)
        data = res.get_json()
        assert 'latest' in data
        assert 'previous' in data
        assert 'history' in data

    def test_latest_is_most_recent_reading(self, client, db, patient, staff, auth_header):
        _make_completed_appt(db, patient, staff, 60, [{'type': 'heart_rate', 'value': 65}])
        _make_completed_appt(db, patient, staff, 1,  [{'type': 'heart_rate', 'value': 80}])

        data = client.get(
            f'/api/patients/{patient.id}/biomarkers', headers=auth_header
        ).get_json()
        assert data['latest']['heart_rate']['value'] == 80

    def test_previous_is_second_most_recent(self, client, db, patient, staff, auth_header):
        _make_completed_appt(db, patient, staff, 60, [{'type': 'heart_rate', 'value': 65}])
        _make_completed_appt(db, patient, staff, 1,  [{'type': 'heart_rate', 'value': 80}])

        data = client.get(
            f'/api/patients/{patient.id}/biomarkers', headers=auth_header
        ).get_json()
        assert data['previous']['heart_rate']['value'] == 65

    def test_previous_is_none_with_single_reading(self, client, db, patient, staff, auth_header):
        _make_completed_appt(db, patient, staff, 1, [{'type': 'heart_rate', 'value': 72}])

        data = client.get(
            f'/api/patients/{patient.id}/biomarkers', headers=auth_header
        ).get_json()
        assert data['previous'].get('heart_rate') is None

    def test_multiple_types_tracked_independently(self, client, db, patient, staff, auth_header):
        _make_completed_appt(db, patient, staff, 1, [
            {'type': 'heart_rate', 'value': 72, 'unit': 'bpm'},
            {'type': 'blood_pressure_systolic', 'value': 120, 'unit': 'mmHg'},
            {'type': 'blood_sugar', 'value': 95, 'unit': 'mg/dL'},
        ])

        data = client.get(
            f'/api/patients/{patient.id}/biomarkers', headers=auth_header
        ).get_json()
        assert 'heart_rate' in data['latest']
        assert 'blood_pressure_systolic' in data['latest']
        assert 'blood_sugar' in data['latest']

    def test_history_ordered_ascending_by_date(self, client, db, patient, staff, auth_header):
        for days, val in [(90, 110), (60, 115), (30, 118), (1, 120)]:
            _make_completed_appt(db, patient, staff, days,
                                 [{'type': 'blood_pressure_systolic', 'value': val}])

        data = client.get(
            f'/api/patients/{patient.id}/biomarkers', headers=auth_header
        ).get_json()
        values = [r['value'] for r in data['history']['blood_pressure_systolic']]
        assert values == sorted(values)

    def test_history_includes_appointment_and_doctor_info(
            self, client, db, patient, staff, auth_header):
        appt = _make_completed_appt(
            db, patient, staff, 1, [{'type': 'heart_rate', 'value': 72, 'unit': 'bpm'}])

        data = client.get(
            f'/api/patients/{patient.id}/biomarkers', headers=auth_header
        ).get_json()
        record = data['history']['heart_rate'][0]
        assert record['appointment_id'] == appt.id
        assert record['doctor_name'] == staff.full_name


class TestBiomarkerReadingModel:
    def test_reading_stored_with_correct_unit(self, db, patient, staff):
        appt = Appointment(
            patient_id=patient.id, doctor_id=staff.id,
            appointment_date=datetime.utcnow(), status='completed',
        )
        db.session.add(appt)
        db.session.flush()
        reading = BiomarkerReading(
            appointment_id=appt.id,
            biomarker_type='temperature',
            value=98.6,
            unit='°F',
        )
        db.session.add(reading)
        db.session.commit()

        fetched = BiomarkerReading.query.get(reading.id)
        assert fetched.value == 98.6
        assert fetched.unit == '°F'

    def test_readings_cleared_on_appointment_resubmit(
            self, client, db, patient, staff, staff_auth_header):
        """Resubmitting an appointment replaces all previous readings."""
        appt = Appointment(
            patient_id=patient.id, doctor_id=staff.id,
            appointment_date=datetime.utcnow(), status='pending',
        )
        db.session.add(appt)
        db.session.commit()

        client.put(f'/api/appointments/{appt.id}',
                   headers=staff_auth_header,
                   json={'biomarker_readings': [
                       {'biomarker_type': 'heart_rate', 'value': 60, 'unit': 'bpm'},
                       {'biomarker_type': 'temperature', 'value': 97.0, 'unit': 'F'},
                   ]})

        client.put(f'/api/appointments/{appt.id}',
                   headers=staff_auth_header,
                   json={'biomarker_readings': [
                       {'biomarker_type': 'heart_rate', 'value': 75, 'unit': 'bpm'},
                   ]})

        count = BiomarkerReading.query.filter_by(appointment_id=appt.id).count()
        assert count == 1
        reading = BiomarkerReading.query.filter_by(appointment_id=appt.id).first()
        assert reading.value == 75
