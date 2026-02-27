"""
#19 – Get patient medical history data on user side for a condition from the db
      and display formatted as graph to the user
#20 – Be able to do CRUD operations on patient data as a medical professional
      user to the db

These two stories share the same backend routes so they are tested together.
"""
import pytest
from app.models import MedicalHistory


class TestGetMedicalHistory:
    """#19 – Retrieving medical history data for a patient."""

    def test_patient_can_get_own_history(self, client, db, patient, staff, auth_header):
        """Patient retrieves their own medical history."""
        record = MedicalHistory(
            patient_id=patient.id,
            condition='Hypertension',
            diagnosis_date='2023-01-15',
            status='Managed',
            notes='Monitor BP',
        )
        db.session.add(record)
        db.session.commit()

        resp = client.get(f'/api/patients/{patient.id}/history', headers=auth_header)
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 1
        assert data[0]['condition'] == 'Hypertension'
        assert data[0]['status'] == 'Managed'

    def test_staff_can_get_patient_history(self, client, db, patient, staff, staff_auth_header):
        """Staff retrieves any patient's medical history."""
        record = MedicalHistory(
            patient_id=patient.id,
            condition='Diabetes',
            diagnosis_date='2022-05-10',
            status='Active',
        )
        db.session.add(record)
        db.session.commit()

        resp = client.get(f'/api/patients/{patient.id}/history', headers=staff_auth_header)
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 1

    def test_patient_cannot_get_other_patient_history(self, client, db, create_user, auth_header):
        """Patient must NOT see another patient's history."""
        other = create_user(email='other@test.com', user_type='patient')
        resp = client.get(f'/api/patients/{other.id}/history', headers=auth_header)
        assert resp.status_code == 403

    def test_history_for_nonexistent_patient_returns_404(self, client, staff_auth_header):
        resp = client.get('/api/patients/9999/history', headers=staff_auth_header)
        assert resp.status_code == 404

    def test_history_ordered_descending(self, client, db, patient, staff, auth_header):
        """Records are returned newest-first."""
        r1 = MedicalHistory(patient_id=patient.id, condition='Cond A')
        r2 = MedicalHistory(patient_id=patient.id, condition='Cond B')
        db.session.add(r1)
        db.session.flush()
        db.session.add(r2)
        db.session.commit()

        resp = client.get(f'/api/patients/{patient.id}/history', headers=auth_header)
        data = resp.get_json()
        assert data[0]['condition'] == 'Cond B'


class TestCrudMedicalHistory:
    """#20 – Staff CRUD on patient medical data."""

    # ── CREATE ──────────────────────────────────────────────────────────────

    def test_staff_can_create_history_record(self, client, db, patient, staff, staff_auth_header):
        resp = client.post(
            f'/api/patients/{patient.id}/history',
            headers=staff_auth_header,
            json={
                'condition': 'Asthma',
                'diagnosis_date': '2024-03-01',
                'status': 'Active',
                'notes': 'Mild',
            },
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['condition'] == 'Asthma'
        assert data['patient_id'] == patient.id

    def test_patient_cannot_create_history_record(self, client, patient, auth_header):
        resp = client.post(
            f'/api/patients/{patient.id}/history',
            headers=auth_header,
            json={'condition': 'Sneaky'},
        )
        assert resp.status_code == 403

    def test_create_without_condition_fails(self, client, patient, staff_auth_header):
        resp = client.post(
            f'/api/patients/{patient.id}/history',
            headers=staff_auth_header,
            json={'notes': 'no condition field'},
        )
        assert resp.status_code == 400

    # ── READ (covered in TestGetMedicalHistory) ─────────────────────────────

    # ── UPDATE ──────────────────────────────────────────────────────────────

    def test_staff_can_update_history_record(self, client, db, patient, staff, staff_auth_header):
        record = MedicalHistory(patient_id=patient.id, condition='Old Cond')
        db.session.add(record)
        db.session.commit()

        resp = client.put(
            f'/api/history/{record.id}',
            headers=staff_auth_header,
            json={'condition': 'Updated Cond', 'status': 'Resolved'},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['condition'] == 'Updated Cond'
        assert data['status'] == 'Resolved'

    def test_patient_cannot_update_history_record(self, client, db, patient, auth_header):
        record = MedicalHistory(patient_id=patient.id, condition='Cond')
        db.session.add(record)
        db.session.commit()

        resp = client.put(
            f'/api/history/{record.id}',
            headers=auth_header,
            json={'condition': 'Hacked'},
        )
        assert resp.status_code == 403

    # ── DELETE ──────────────────────────────────────────────────────────────

    def test_staff_can_delete_history_record(self, client, db, patient, staff, staff_auth_header):
        record = MedicalHistory(patient_id=patient.id, condition='To Delete')
        db.session.add(record)
        db.session.commit()
        rid = record.id

        resp = client.delete(f'/api/history/{rid}', headers=staff_auth_header)
        assert resp.status_code == 200
        assert MedicalHistory.query.get(rid) is None

    def test_patient_cannot_delete_history_record(self, client, db, patient, auth_header):
        record = MedicalHistory(patient_id=patient.id, condition='Protected')
        db.session.add(record)
        db.session.commit()

        resp = client.delete(f'/api/history/{record.id}', headers=auth_header)
        assert resp.status_code == 403

    def test_delete_nonexistent_record_returns_404(self, client, staff_auth_header):
        resp = client.delete('/api/history/9999', headers=staff_auth_header)
        assert resp.status_code == 404
