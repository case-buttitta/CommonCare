"""
Extended messaging tests covering:
  - Emoji reactions on messages (POST /api/messages/<id>/reactions)
  - Messaging contacts list (GET /api/messaging/contacts)
  - User search for message requests (GET /api/messaging/search-users)
  - Unread count & pending requests (GET /api/messaging/unread-count)
  - Conversation access control (only participants allowed)
  - Cannot create patient-to-patient or staff-to-staff conversations
"""
import pytest
from datetime import datetime
from app.models import (
    Appointment, Conversation, Message, MessageRequest, MessageReaction
)
from app.auth import generate_token


# ── helpers ─────────────────────────────────────────────────────────────────

def header(user):
    return {'Authorization': f'Bearer {generate_token(user.id)}'}


def make_convo_with_appointment(db, patient, staff):
    """Create an appointment + conversation between patient and staff."""
    appt = Appointment(
        patient_id=patient.id,
        doctor_id=staff.id,
        appointment_date=datetime.utcnow(),
    )
    db.session.add(appt)
    db.session.flush()
    convo = Conversation(patient_id=patient.id, staff_id=staff.id)
    db.session.add(convo)
    db.session.commit()
    return convo


def send_message(db, convo, sender):
    msg = Message(
        conversation_id=convo.id,
        sender_id=sender.id,
        content='Hello',
    )
    db.session.add(msg)
    db.session.commit()
    return msg


# ── Reactions ────────────────────────────────────────────────────────────────

class TestMessageReactions:
    def test_user_can_add_reaction(self, client, db, patient, staff, auth_header):
        convo = make_convo_with_appointment(db, patient, staff)
        msg = send_message(db, convo, staff)

        res = client.post(
            f'/api/messages/{msg.id}/reactions',
            headers=auth_header,
            json={'emoji': '👍'},
        )
        assert res.status_code in (200, 201)
        data = res.get_json()
        assert data.get('emoji') == '👍' or 'reactions' in data

    def test_reaction_requires_authentication(self, client, db, patient, staff):
        convo = make_convo_with_appointment(db, patient, staff)
        msg = send_message(db, convo, staff)

        res = client.post(f'/api/messages/{msg.id}/reactions', json={'emoji': '❤️'})
        assert res.status_code == 401

    def test_toggle_removes_existing_reaction(self, client, db, patient, staff, auth_header):
        """Posting the same emoji twice should toggle (remove) it."""
        convo = make_convo_with_appointment(db, patient, staff)
        msg = send_message(db, convo, staff)

        client.post(f'/api/messages/{msg.id}/reactions', headers=auth_header, json={'emoji': '😂'})
        res = client.post(f'/api/messages/{msg.id}/reactions', headers=auth_header, json={'emoji': '😂'})
        assert res.status_code in (200, 201)
        # After toggle, reaction count for this user+emoji should be 0
        count = MessageReaction.query.filter_by(
            message_id=msg.id, user_id=patient.id, emoji='😂'
        ).count()
        assert count == 0

    def test_reaction_on_nonexistent_message_returns_404(self, client, auth_header):
        res = client.post('/api/messages/99999/reactions', headers=auth_header, json={'emoji': '👍'})
        assert res.status_code == 404

    def test_missing_emoji_returns_error(self, client, db, patient, staff, auth_header):
        convo = make_convo_with_appointment(db, patient, staff)
        msg = send_message(db, convo, staff)

        res = client.post(f'/api/messages/{msg.id}/reactions', headers=auth_header, json={})
        assert res.status_code in (400, 422)


# ── Contacts ─────────────────────────────────────────────────────────────────

class TestMessagingContacts:
    def test_requires_authentication(self, client):
        res = client.get('/api/messaging/contacts')
        assert res.status_code == 401

    def test_returns_list(self, client, patient, auth_header):
        res = client.get('/api/messaging/contacts', headers=auth_header)
        assert res.status_code == 200
        assert isinstance(res.get_json(), list)

    def test_staff_appears_after_appointment(self, client, db, patient, staff, auth_header):
        appt = Appointment(
            patient_id=patient.id,
            doctor_id=staff.id,
            appointment_date=datetime.utcnow(),
        )
        db.session.add(appt)
        db.session.commit()

        res = client.get('/api/messaging/contacts', headers=auth_header)
        data = res.get_json()
        ids = [u['id'] for u in data]
        assert staff.id in ids

    def test_no_appointment_no_contact(self, client, db, create_user, auth_header):
        stranger = create_user(email='stranger@test.com', user_type='staff')
        res = client.get('/api/messaging/contacts', headers=auth_header)
        data = res.get_json()
        ids = [u['id'] for u in data]
        assert stranger.id not in ids


# ── User search for message requests ─────────────────────────────────────────

class TestUserSearch:
    def test_requires_authentication(self, client):
        res = client.get('/api/messaging/search-users?q=doc')
        assert res.status_code == 401

    def test_returns_matching_users(self, client, db, create_user, auth_header):
        doc = create_user(email='findme@test.com', user_type='staff', full_name='Dr Findme')
        res = client.get('/api/messaging/search-users?q=Findme', headers=auth_header)
        assert res.status_code == 200
        data = res.get_json()
        ids = [u['id'] for u in data]
        assert doc.id in ids

    def test_does_not_return_self(self, client, patient, auth_header):
        """Search results must not include the requesting user themselves."""
        res = client.get(
            f'/api/messaging/search-users?q={patient.full_name}',
            headers=auth_header,
        )
        assert res.status_code == 200
        data = res.get_json()
        ids = [u['id'] for u in data]
        assert patient.id not in ids

    def test_empty_query_returns_200(self, client, auth_header):
        res = client.get('/api/messaging/search-users?q=', headers=auth_header)
        assert res.status_code == 200


# ── Unread count ──────────────────────────────────────────────────────────────

class TestUnreadCount:
    def test_requires_authentication(self, client):
        res = client.get('/api/messaging/unread-count')
        assert res.status_code == 401

    def test_returns_unread_and_pending_keys(self, client, patient, auth_header):
        res = client.get('/api/messaging/unread-count', headers=auth_header)
        assert res.status_code == 200
        data = res.get_json()
        assert 'unread_count' in data or 'unread' in data
        assert 'pending_requests' in data or 'pending' in data

    def test_unread_increments_on_new_message(
            self, client, db, patient, staff, auth_header, staff_auth_header):
        """Sending a message as staff should increment patient's unread count."""
        convo = make_convo_with_appointment(db, patient, staff)

        before = client.get('/api/messaging/unread-count', headers=auth_header).get_json()
        before_count = before.get('unread_count', before.get('unread', 0))

        # Staff sends message (not marked read by patient)
        client.post(
            f'/api/conversations/{convo.id}/messages',
            headers=staff_auth_header,
            json={'content': 'Hi patient!'},
        )

        after = client.get('/api/messaging/unread-count', headers=auth_header).get_json()
        after_count = after.get('unread_count', after.get('unread', 0))
        assert after_count > before_count

    def test_reading_messages_clears_unread(
            self, client, db, patient, staff, auth_header, staff_auth_header):
        """After GET /conversations/<id>/messages, unread count resets for that convo."""
        convo = make_convo_with_appointment(db, patient, staff)
        client.post(
            f'/api/conversations/{convo.id}/messages',
            headers=staff_auth_header,
            json={'content': 'Read me!'},
        )
        # Patient reads the messages
        client.get(f'/api/conversations/{convo.id}/messages', headers=auth_header)

        after = client.get('/api/messaging/unread-count', headers=auth_header).get_json()
        count = after.get('unread_count', after.get('unread', 0))
        assert count == 0


# ── Conversation access control ───────────────────────────────────────────────

class TestConversationAccess:
    def test_non_participant_cannot_read_messages(self, client, db, patient, staff, create_user):
        """A third user who is not part of the conversation gets 403."""
        convo = make_convo_with_appointment(db, patient, staff)
        third = create_user(email='third@test.com', user_type='patient')
        h = header(third)

        res = client.get(f'/api/conversations/{convo.id}/messages', headers=h)
        assert res.status_code in (403, 404)

    def test_non_participant_cannot_post_messages(self, client, db, patient, staff, create_user):
        convo = make_convo_with_appointment(db, patient, staff)
        third = create_user(email='intruder@test.com', user_type='staff')
        h = header(third)

        res = client.post(
            f'/api/conversations/{convo.id}/messages',
            headers=h,
            json={'content': 'Intruder!'},
        )
        assert res.status_code in (403, 404)

    def test_patient_can_send_and_read_own_conversation(
            self, client, db, patient, staff, auth_header):
        convo = make_convo_with_appointment(db, patient, staff)

        post_res = client.post(
            f'/api/conversations/{convo.id}/messages',
            headers=auth_header,
            json={'content': 'Hello!'},
        )
        assert post_res.status_code == 201

        get_res = client.get(f'/api/conversations/{convo.id}/messages', headers=auth_header)
        assert get_res.status_code == 200

    def test_patient_cannot_start_patient_to_patient_conversation(
            self, client, db, create_user, auth_header):
        other_patient = create_user(email='other_p@test.com', user_type='patient')
        res = client.post('/api/conversations', headers=auth_header, json={'user_id': other_patient.id})
        assert res.status_code in (400, 403)

    def test_staff_cannot_start_staff_to_staff_conversation(
            self, client, db, staff, staff_auth_header, create_user):
        other_staff = create_user(email='other_s@test.com', user_type='staff')
        res = client.post('/api/conversations', headers=staff_auth_header, json={'user_id': other_staff.id})
        assert res.status_code in (400, 403)

    def test_conversations_list_only_shows_own(
            self, client, db, patient, staff, auth_header, create_user):
        """Patient should only see their own conversations, not all conversations."""
        convo = make_convo_with_appointment(db, patient, staff)

        other_patient = create_user(email='other2@test.com', user_type='patient')
        other_convo = Conversation(patient_id=other_patient.id, staff_id=staff.id)
        db.session.add(other_convo)
        db.session.commit()

        res = client.get('/api/conversations', headers=auth_header)
        assert res.status_code == 200
        data = res.get_json()
        ids = [c['id'] for c in data]
        assert convo.id in ids
        assert other_convo.id not in ids
