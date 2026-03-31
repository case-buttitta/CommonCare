"""Extended appointment tests covering booking rules, retrieval access, and completion."""
import json
from datetime import datetime, timedelta


def future_date(days=7):
    return (datetime.utcnow() + timedelta(days=days)).isoformat()


def make_appointment(client, patient_header, doctor_id, days=7, reason='Checkup'):
    return client.post('/api/appointments',
                       data=json.dumps({'doctor_id': doctor_id,
                                        'appointment_date': future_date(days),
                                        'reason': reason}),
                       content_type='application/json',
                       headers=patient_header)


class TestAppointmentBooking:
    def test_staff_cannot_book_appointment(self, client, staff, staff_auth_header):
        res = client.post('/api/appointments',
                          data=json.dumps({'doctor_id': staff.id,
                                           'appointment_date': future_date()}),
                          content_type='application/json',
                          headers=staff_auth_header)
        assert res.status_code == 403

    def test_missing_doctor_id_returns_400(self, client, auth_header):
        res = client.post('/api/appointments',
                          data=json.dumps({'appointment_date': future_date()}),
                          content_type='application/json',
                          headers=auth_header)
        assert res.status_code == 400

    def test_missing_date_returns_400(self, client, staff, auth_header):
        res = client.post('/api/appointments',
                          data=json.dumps({'doctor_id': staff.id}),
                          content_type='application/json',
                          headers=auth_header)
        assert res.status_code == 400

    def test_invalid_date_format_returns_400(self, client, staff, auth_header):
        res = client.post('/api/appointments',
                          data=json.dumps({'doctor_id': staff.id,
                                           'appointment_date': 'not-a-date'}),
                          content_type='application/json',
                          headers=auth_header)
        assert res.status_code == 400

    def test_nonexistent_doctor_returns_400(self, client, auth_header):
        res = client.post('/api/appointments',
                          data=json.dumps({'doctor_id': 99999,
                                           'appointment_date': future_date()}),
                          content_type='application/json',
                          headers=auth_header)
        assert res.status_code == 400

    def test_booking_with_patient_as_doctor_returns_400(self, client, patient, auth_header):
        """Cannot book an appointment using another patient as the doctor."""
        res = client.post('/api/appointments',
                          data=json.dumps({'doctor_id': patient.id,
                                           'appointment_date': future_date()}),
                          content_type='application/json',
                          headers=auth_header)
        assert res.status_code == 400

    def test_appointment_created_as_pending(self, client, staff, auth_header):
        res = make_appointment(client, auth_header, staff.id)
        assert res.status_code == 201
        assert res.get_json()['status'] == 'pending'

    def test_patient_can_book_with_reason(self, client, staff, auth_header):
        res = make_appointment(client, auth_header, staff.id, reason='Annual physical')
        assert res.status_code == 201
        assert res.get_json()['reason'] == 'Annual physical'

    def test_booked_appointment_appears_in_list(self, client, staff, auth_header):
        make_appointment(client, auth_header, staff.id)
        res = client.get('/api/appointments', headers=auth_header)
        assert res.status_code == 200
        assert len(res.get_json()) >= 1

    def test_requires_authentication(self, client, staff):
        res = client.post('/api/appointments',
                          data=json.dumps({'doctor_id': staff.id,
                                           'appointment_date': future_date()}),
                          content_type='application/json')
        assert res.status_code == 401


class TestAppointmentRetrieval:
    def test_patient_can_get_own_appointment(self, client, patient, staff, auth_header):
        appt_id = make_appointment(client, auth_header, staff.id).get_json()['id']
        res = client.get(f'/api/appointments/{appt_id}', headers=auth_header)
        assert res.status_code == 200
        assert res.get_json()['id'] == appt_id

    def test_patient_cannot_get_other_patients_appointment(
            self, client, staff, auth_header, create_user, app):
        with app.app_context():
            other = create_user(email='other@test.com', user_type='patient')
        from app.auth import generate_token
        with app.app_context():
            from app.models import User
            u = User.query.filter_by(email='other@test.com').first()
            other_header = {'Authorization': f'Bearer {generate_token(u.id)}'}
        # book appointment as the other patient
        appt_id = make_appointment(client, other_header, staff.id).get_json()['id']
        # try to fetch it as original patient
        res = client.get(f'/api/appointments/{appt_id}', headers=auth_header)
        assert res.status_code == 403

    def test_staff_can_get_any_appointment(self, client, staff, auth_header, staff_auth_header):
        appt_id = make_appointment(client, auth_header, staff.id).get_json()['id']
        res = client.get(f'/api/appointments/{appt_id}', headers=staff_auth_header)
        assert res.status_code == 200

    def test_nonexistent_appointment_returns_404(self, client, auth_header):
        res = client.get('/api/appointments/99999', headers=auth_header)
        assert res.status_code == 404

    def test_staff_can_filter_appointments_by_patient_id(
            self, client, patient, staff, auth_header, staff_auth_header):
        make_appointment(client, auth_header, staff.id)
        res = client.get(f'/api/appointments?patient_id={patient.id}',
                         headers=staff_auth_header)
        assert res.status_code == 200
        for appt in res.get_json():
            assert appt['patient_id'] == patient.id

    def test_staff_sees_all_appointments_without_filter(
            self, client, staff, auth_header, staff_auth_header, create_user, app):
        make_appointment(client, auth_header, staff.id)
        res = client.get('/api/appointments', headers=staff_auth_header)
        assert res.status_code == 200
        assert isinstance(res.get_json(), list)


class TestAppointmentCompletion:
    def test_patient_cannot_update_appointment(self, client, staff, auth_header):
        appt_id = make_appointment(client, auth_header, staff.id).get_json()['id']
        res = client.put(f'/api/appointments/{appt_id}',
                         data=json.dumps({'status': 'completed'}),
                         content_type='application/json',
                         headers=auth_header)
        assert res.status_code == 403

    def test_staff_can_complete_appointment_with_notes(
            self, client, staff, auth_header, staff_auth_header):
        appt_id = make_appointment(client, auth_header, staff.id).get_json()['id']
        res = client.put(f'/api/appointments/{appt_id}',
                         data=json.dumps({'status': 'completed', 'notes': 'All clear'}),
                         content_type='application/json',
                         headers=staff_auth_header)
        assert res.status_code == 200
        data = res.get_json()
        assert data['status'] == 'completed'
        assert data['notes'] == 'All clear'

    def test_staff_can_add_treatments(self, client, staff, auth_header, staff_auth_header):
        appt_id = make_appointment(client, auth_header, staff.id).get_json()['id']
        res = client.put(f'/api/appointments/{appt_id}',
                         data=json.dumps({'treatments': 'Rest and fluids'}),
                         content_type='application/json',
                         headers=staff_auth_header)
        assert res.status_code == 200
        assert res.get_json()['treatments'] == 'Rest and fluids'

    def test_staff_can_submit_biomarker_readings(
            self, client, staff, auth_header, staff_auth_header):
        appt_id = make_appointment(client, auth_header, staff.id).get_json()['id']
        readings = [{'biomarker_type': 'heart_rate', 'value': 72, 'unit': 'bpm'}]
        res = client.put(f'/api/appointments/{appt_id}',
                         data=json.dumps({'status': 'completed',
                                          'biomarker_readings': readings}),
                         content_type='application/json',
                         headers=staff_auth_header)
        assert res.status_code == 200

    def test_biomarker_readings_replaced_on_resubmit(
            self, client, staff, auth_header, staff_auth_header):
        appt_id = make_appointment(client, auth_header, staff.id).get_json()['id']
        payload = lambda v: json.dumps({'status': 'completed', 'biomarker_readings': [
            {'biomarker_type': 'heart_rate', 'value': v, 'unit': 'bpm'}]})
        client.put(f'/api/appointments/{appt_id}',
                   data=payload(70), content_type='application/json',
                   headers=staff_auth_header)
        client.put(f'/api/appointments/{appt_id}',
                   data=payload(80), content_type='application/json',
                   headers=staff_auth_header)
        from app.models import BiomarkerReading
        with client.application.app_context():
            readings = BiomarkerReading.query.filter_by(appointment_id=appt_id).all()
        assert len(readings) == 1
        assert readings[0].value == 80

    def test_multiple_biomarker_types_in_one_appointment(
            self, client, staff, auth_header, staff_auth_header):
        appt_id = make_appointment(client, auth_header, staff.id).get_json()['id']
        readings = [
            {'biomarker_type': 'blood_pressure_systolic', 'value': 120, 'unit': 'mmHg'},
            {'biomarker_type': 'blood_pressure_diastolic', 'value': 80, 'unit': 'mmHg'},
            {'biomarker_type': 'heart_rate', 'value': 72, 'unit': 'bpm'},
        ]
        res = client.put(f'/api/appointments/{appt_id}',
                         data=json.dumps({'status': 'completed',
                                          'biomarker_readings': readings}),
                         content_type='application/json',
                         headers=staff_auth_header)
        assert res.status_code == 200
        from app.models import BiomarkerReading
        with client.application.app_context():
            count = BiomarkerReading.query.filter_by(appointment_id=appt_id).count()
        assert count == 3
