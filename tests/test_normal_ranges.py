"""
#23 - Normal Ranges CRUD
Verify that normal ranges can be created, updated, retrieved, and deleted.
Also verify the upsert logic in creative_normal_range.
"""
import pytest
from app.models import NormalRange

class TestNormalRanges:
    def test_get_normal_ranges(self, client, auth_header, db):
        nr = NormalRange(biomarker_type='test_bio', min_value=10, max_value=20, unit='mg')
        db.session.add(nr)
        db.session.commit()

        resp = client.get('/api/normal-ranges', headers=auth_header)
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) >= 1
        assert any(r['biomarker_type'] == 'test_bio' for r in data)

    def test_staff_can_create_normal_range(self, client, staff_auth_header):
        resp = client.post('/api/normal-ranges', headers=staff_auth_header, json={
            'biomarker_type': 'new_bio',
            'min_value': 50,
            'max_value': 100,
            'unit': 'units'
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['biomarker_type'] == 'new_bio'
        assert data['min_value'] == 50

    def test_staff_create_upsert_logic(self, client, staff_auth_header, db):
        # Create initial
        client.post('/api/normal-ranges', headers=staff_auth_header, json={
            'biomarker_type': 'upsert_bio',
            'min_value': 10,
            'max_value': 20,
            'unit': 'mg'
        })
        
        # Second call with same type should update
        resp = client.post('/api/normal-ranges', headers=staff_auth_header, json={
            'biomarker_type': 'upsert_bio',
            'min_value': 15,
            'max_value': 25,
            'unit': 'mg'
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['min_value'] == 15
        assert data['max_value'] == 25
        
        # Verify only one exists
        count = NormalRange.query.filter_by(biomarker_type='upsert_bio').count()
        assert count == 1

    def test_patient_cannot_create_normal_range(self, client, auth_header):
        resp = client.post('/api/normal-ranges', headers=auth_header, json={
            'biomarker_type': 'no_access',
            'min_value': 1, 'max_value': 2, 'unit': 'u'
        })
        assert resp.status_code == 403

    def test_staff_can_update_normal_range(self, client, staff_auth_header, db):
        nr = NormalRange(biomarker_type='update_me', min_value=10, max_value=20, unit='mg')
        db.session.add(nr)
        db.session.commit()

        resp = client.put(f'/api/normal-ranges/{nr.id}', headers=staff_auth_header, json={
            'min_value': 12,
            'max_value': 22
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['min_value'] == 12
        assert data['max_value'] == 22

    def test_staff_can_delete_normal_range(self, client, staff_auth_header, db):
        nr = NormalRange(biomarker_type='delete_me', min_value=10, max_value=20, unit='mg')
        db.session.add(nr)
        db.session.commit()
        nr_id = nr.id

        resp = client.delete(f'/api/normal-ranges/{nr_id}', headers=staff_auth_header)
        assert resp.status_code == 200
        assert NormalRange.query.get(nr_id) is None
