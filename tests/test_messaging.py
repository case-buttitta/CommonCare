"""
#32 - Messaging System
Verify that patients and staff can message each other.
Requires a relationship (appointment or accepted request).
"""
import pytest
from app.models import User, Conversation, Message, MessageRequest, Appointment
from datetime import datetime

class TestMessaging:
    def test_create_conversation_unauthorized_if_no_relationship(self, client, db, create_user):
        """Patient cannot start a conversation with a staff member if they haven't had an appointment."""
        p = create_user(email='p_no_rel@test.com', user_type='patient')
        s = create_user(email='s_no_rel@test.com', user_type='staff')
        
        from app.auth import generate_token
        h = {'Authorization': f'Bearer {generate_token(p.id)}'}

        resp = client.post('/api/conversations', headers=h, json={'user_id': s.id})
        assert resp.status_code == 403
        assert 'send a message request first' in resp.get_json()['error'].lower()

    def test_create_conversation_success_after_appointment(self, client, db, patient, staff, auth_header):
        """Once an appointment exists, a conversation can be created."""
        appt = Appointment(patient_id=patient.id, doctor_id=staff.id, appointment_date=datetime.utcnow())
        db.session.add(appt)
        db.session.commit()

        resp = client.post('/api/conversations', headers=auth_header, json={'user_id': staff.id})
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['patient_id'] == patient.id
        assert data['staff_id'] == staff.id

    def test_send_and_get_messages(self, client, db, patient, staff, auth_header, staff_auth_header):
        """Send and retrieve messages in a conversation."""
        convo = Conversation(patient_id=patient.id, staff_id=staff.id)
        db.session.add(convo)
        db.session.commit()

        # Patient sends message
        resp = client.post(f'/api/conversations/{convo.id}/messages', headers=auth_header, json={
            'content': 'Hello Doctor!'
        })
        assert resp.status_code == 201

        # Staff gets messages
        resp = client.get(f'/api/conversations/{convo.id}/messages', headers=staff_auth_header)
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 1
        assert data[0]['content'] == 'Hello Doctor!'
        assert data[0]['sender_id'] == patient.id

    def test_message_request_flow(self, client, db, create_user):
        """Patient sends a message request, staff accepts, then conversation starts."""
        p = create_user(email='p_req@test.com', user_type='patient')
        s = create_user(email='s_req@test.com', user_type='staff')
        
        from app.auth import generate_token
        h_p = {'Authorization': f'Bearer {generate_token(p.id)}'}
        h_s = {'Authorization': f'Bearer {generate_token(s.id)}'}

        # Send Request
        resp = client.post('/api/message-requests', headers=h_p, json={
            'to_user_id': s.id,
            'message': 'Want to ask about labs.'
        })
        assert resp.status_code == 201
        request_id = resp.get_json()['id']

        # Staff views requests
        resp = client.get('/api/message-requests', headers=h_s)
        data = resp.get_json()
        assert len(data['incoming']) >= 1
        assert any(r['id'] == request_id for r in data['incoming'])

        # Staff accepts request
        resp = client.put(f'/api/message-requests/{request_id}', headers=h_s, json={
            'action': 'accepted'
        })
        assert resp.status_code == 200

        # Now conversation creation should succeed
        resp = client.post('/api/conversations', headers=h_p, json={'user_id': s.id})
        assert resp.status_code == 201 or resp.status_code == 200
