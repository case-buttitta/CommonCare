from flask import Blueprint, jsonify, request
from app import db
from app.models import (User, Appointment, BiomarkerReading, Conversation,
                        Message, MessageReaction, MessageRequest)
from app.auth import token_required
from datetime import datetime
from sqlalchemy import or_, and_

messaging = Blueprint('messaging', __name__)


# ── Conversations ────────────────────────────────────────────────────────────

@messaging.route('/api/conversations', methods=['GET'])
@token_required
def list_conversations(current_user):
    """List all conversations for the current user."""
    if current_user.user_type == 'patient':
        convos = Conversation.query.filter_by(patient_id=current_user.id)\
            .order_by(Conversation.updated_at.desc()).all()
    else:
        convos = Conversation.query.filter_by(staff_id=current_user.id)\
            .order_by(Conversation.updated_at.desc()).all()

    return jsonify([c.to_dict(current_user_id=current_user.id) for c in convos])


@messaging.route('/api/conversations', methods=['POST'])
@token_required
def create_conversation(current_user):
    """Create or get existing conversation. Enforces patient-staff only."""
    data = request.get_json()
    other_user_id = data.get('user_id')

    if not other_user_id:
        return jsonify({'error': 'user_id is required'}), 400

    other_user = User.query.get(other_user_id)
    if not other_user:
        return jsonify({'error': 'User not found'}), 404

    # Enforce no patient-to-patient conversations
    if current_user.user_type == 'patient' and other_user.user_type == 'patient':
        return jsonify({'error': 'Patient-to-patient messaging is not allowed'}), 403

    # Determine patient and staff
    if current_user.user_type == 'patient':
        patient_id = current_user.id
        staff_id = other_user.id
    elif other_user.user_type == 'patient':
        patient_id = other_user.id
        staff_id = current_user.id
    else:
        # staff-to-staff: use lower id as "patient_id" for uniqueness
        patient_id = min(current_user.id, other_user.id)
        staff_id = max(current_user.id, other_user.id)

    # Check if conversation already exists
    existing = Conversation.query.filter_by(patient_id=patient_id, staff_id=staff_id).first()
    if existing:
        return jsonify(existing.to_dict(current_user_id=current_user.id))

    # Check if they have appointment history together
    has_relationship = Appointment.query.filter(
        or_(
            and_(Appointment.patient_id == current_user.id, Appointment.doctor_id == other_user.id),
            and_(Appointment.patient_id == other_user.id, Appointment.doctor_id == current_user.id),
        )
    ).first() is not None

    if not has_relationship:
        # Check for accepted message request
        accepted_request = MessageRequest.query.filter(
            or_(
                and_(MessageRequest.from_user_id == current_user.id,
                     MessageRequest.to_user_id == other_user.id,
                     MessageRequest.status == 'accepted'),
                and_(MessageRequest.from_user_id == other_user.id,
                     MessageRequest.to_user_id == current_user.id,
                     MessageRequest.status == 'accepted'),
            )
        ).first()

        if not accepted_request:
            return jsonify({'error': 'No relationship exists. Send a message request first.'}), 403

    convo = Conversation(patient_id=patient_id, staff_id=staff_id)
    db.session.add(convo)
    db.session.commit()

    return jsonify(convo.to_dict(current_user_id=current_user.id)), 201


# ── Messages ─────────────────────────────────────────────────────────────────

@messaging.route('/api/conversations/<int:convo_id>/messages', methods=['GET'])
@token_required
def get_messages(current_user, convo_id):
    """Get all messages in a conversation."""
    convo = Conversation.query.get_or_404(convo_id)

    # Access control
    if current_user.id not in (convo.patient_id, convo.staff_id):
        return jsonify({'error': 'Access denied'}), 403

    # Mark messages as read
    Message.query.filter_by(conversation_id=convo_id, is_read=False)\
        .filter(Message.sender_id != current_user.id)\
        .update({'is_read': True})
    db.session.commit()

    messages = Message.query.filter_by(conversation_id=convo_id)\
        .order_by(Message.created_at.asc()).all()

    return jsonify([m.to_dict() for m in messages])


@messaging.route('/api/conversations/<int:convo_id>/messages', methods=['POST'])
@token_required
def send_message(current_user, convo_id):
    """Send a message in a conversation."""
    convo = Conversation.query.get_or_404(convo_id)

    if current_user.id not in (convo.patient_id, convo.staff_id):
        return jsonify({'error': 'Access denied'}), 403

    data = request.get_json()
    content = data.get('content', '').strip()
    message_type = data.get('message_type', 'text')
    image_url = data.get('image_url')
    reference_type = data.get('reference_type')
    reference_id = data.get('reference_id')

    if not content and not image_url:
        return jsonify({'error': 'Message content or image is required'}), 400

    msg = Message(
        conversation_id=convo_id,
        sender_id=current_user.id,
        content=content or '',
        message_type=message_type,
        image_url=image_url,
        reference_type=reference_type,
        reference_id=reference_id,
    )
    db.session.add(msg)
    convo.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify(msg.to_dict()), 201


# ── Reactions ────────────────────────────────────────────────────────────────

@messaging.route('/api/messages/<int:message_id>/reactions', methods=['POST'])
@token_required
def toggle_reaction(current_user, message_id):
    """Add or remove a reaction on a message."""
    msg = Message.query.get_or_404(message_id)
    convo = Conversation.query.get(msg.conversation_id)

    if current_user.id not in (convo.patient_id, convo.staff_id):
        return jsonify({'error': 'Access denied'}), 403

    data = request.get_json()
    emoji = data.get('emoji')
    if not emoji:
        return jsonify({'error': 'emoji is required'}), 400

    existing = MessageReaction.query.filter_by(
        message_id=message_id, user_id=current_user.id, emoji=emoji
    ).first()

    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({'removed': True, 'emoji': emoji})
    else:
        reaction = MessageReaction(
            message_id=message_id,
            user_id=current_user.id,
            emoji=emoji,
        )
        db.session.add(reaction)
        db.session.commit()
        return jsonify(reaction.to_dict()), 201


# ── Message Requests ─────────────────────────────────────────────────────────

@messaging.route('/api/message-requests', methods=['GET'])
@token_required
def list_message_requests(current_user):
    """List incoming and outgoing message requests."""
    incoming = MessageRequest.query.filter_by(
        to_user_id=current_user.id, status='pending'
    ).all()
    outgoing = MessageRequest.query.filter_by(
        from_user_id=current_user.id
    ).order_by(MessageRequest.created_at.desc()).all()

    return jsonify({
        'incoming': [r.to_dict() for r in incoming],
        'outgoing': [r.to_dict() for r in outgoing],
    })


@messaging.route('/api/message-requests', methods=['POST'])
@token_required
def send_message_request(current_user):
    """Send a message request to someone you have no relationship with."""
    data = request.get_json()
    to_user_id = data.get('to_user_id')
    msg_text = data.get('message', '')

    if not to_user_id:
        return jsonify({'error': 'to_user_id is required'}), 400

    to_user = User.query.get(to_user_id)
    if not to_user:
        return jsonify({'error': 'User not found'}), 404

    # Prevent patient-to-patient
    if current_user.user_type == 'patient' and to_user.user_type == 'patient':
        return jsonify({'error': 'Patient-to-patient messaging is not allowed'}), 403

    # Check if request already exists
    existing = MessageRequest.query.filter(
        or_(
            and_(MessageRequest.from_user_id == current_user.id,
                 MessageRequest.to_user_id == to_user_id,
                 MessageRequest.status == 'pending'),
            and_(MessageRequest.from_user_id == to_user_id,
                 MessageRequest.to_user_id == current_user.id,
                 MessageRequest.status == 'pending'),
        )
    ).first()

    if existing:
        return jsonify({'error': 'A pending request already exists'}), 409

    req = MessageRequest(
        from_user_id=current_user.id,
        to_user_id=to_user_id,
        message=msg_text,
    )
    db.session.add(req)
    db.session.commit()

    return jsonify(req.to_dict()), 201


@messaging.route('/api/message-requests/<int:request_id>', methods=['PUT'])
@token_required
def respond_to_request(current_user, request_id):
    """Accept or reject a message request."""
    msg_req = MessageRequest.query.get_or_404(request_id)

    if msg_req.to_user_id != current_user.id:
        return jsonify({'error': 'Access denied'}), 403

    data = request.get_json()
    action = data.get('action')

    if action not in ('accepted', 'rejected'):
        return jsonify({'error': 'action must be accepted or rejected'}), 400

    msg_req.status = action
    db.session.commit()

    # If accepted, auto-create conversation
    if action == 'accepted':
        from_user = User.query.get(msg_req.from_user_id)

        if current_user.user_type == 'patient' or (from_user.user_type == 'patient'):
            patient_id = current_user.id if current_user.user_type == 'patient' else from_user.id
            staff_id = current_user.id if current_user.user_type == 'staff' else from_user.id
        else:
            patient_id = min(current_user.id, from_user.id)
            staff_id = max(current_user.id, from_user.id)

        existing_convo = Conversation.query.filter_by(
            patient_id=patient_id, staff_id=staff_id
        ).first()

        if not existing_convo:
            convo = Conversation(patient_id=patient_id, staff_id=staff_id)
            db.session.add(convo)
            db.session.commit()

    return jsonify(msg_req.to_dict())


# ── Contacts (users with relationship) ───────────────────────────────────────

@messaging.route('/api/messaging/contacts', methods=['GET'])
@token_required
def get_contacts(current_user):
    """Get users the current user can message (appointment history)."""
    if current_user.user_type == 'patient':
        # Get staff from appointment history
        appts = Appointment.query.filter_by(patient_id=current_user.id).all()
        contact_ids = list(set(a.doctor_id for a in appts))
        contacts = User.query.filter(User.id.in_(contact_ids)).all() if contact_ids else []
    else:
        # Get patients from appointment history
        appts = Appointment.query.filter_by(doctor_id=current_user.id).all()
        contact_ids = list(set(a.patient_id for a in appts))
        contacts = User.query.filter(User.id.in_(contact_ids)).all() if contact_ids else []

    return jsonify([u.to_dict() for u in contacts])


# ── User Search ──────────────────────────────────────────────────────────────

@messaging.route('/api/messaging/search-users', methods=['GET'])
@token_required
def search_users(current_user):
    """Search users by name for message request. Excludes self and same-type patients."""
    query = request.args.get('q', '').strip()
    if len(query) < 2:
        return jsonify([]), 200

    users = User.query.filter(
        User.full_name.ilike(f'%{query}%'),
        User.id != current_user.id,
    ).limit(20).all()

    # Filter out patient-to-patient
    if current_user.user_type == 'patient':
        users = [u for u in users if u.user_type != 'patient']

    return jsonify([u.to_dict() for u in users])


# ── Reference Lookups ────────────────────────────────────────────────────────

@messaging.route('/api/messaging/references', methods=['GET'])
@token_required
def get_references(current_user):
    """Get referenceable appointments with nested biomarkers for a conversation.
    Returns a grouped structure: each appointment has its biomarker readings attached.
    """
    convo_id = request.args.get('conversation_id', type=int)
    search = request.args.get('q', '').strip()

    if not convo_id:
        return jsonify({'error': 'conversation_id is required'}), 400

    convo = Conversation.query.get_or_404(convo_id)
    if current_user.id not in (convo.patient_id, convo.staff_id):
        return jsonify({'error': 'Access denied'}), 403

    patient_id = convo.patient_id

    appts = Appointment.query.filter_by(patient_id=patient_id)\
        .order_by(Appointment.appointment_date.desc()).limit(20).all()

    results = []
    for a in appts:
        doctor_name = a.doctor.full_name if a.doctor else 'Unknown'
        date_str = a.appointment_date.strftime('%b %d, %Y')
        appt_label = f"Appointment on {date_str} with {doctor_name}"

        # Build biomarker readings for this appointment
        biomarkers = []
        for r in a.biomarker_readings:
            bm_label = f"{r.biomarker_type.replace('_', ' ').title()}: {r.value} {r.unit}"
            if search and search.lower() not in bm_label.lower() and search.lower() not in appt_label.lower():
                continue
            biomarkers.append({
                'type': 'biomarker',
                'id': r.id,
                'label': bm_label,
                'full_label': f"{bm_label} ({date_str})",
                'biomarker_type': r.biomarker_type,
                'value': r.value,
                'unit': r.unit,
                'appointment_id': a.id,
            })

        # Filter by search
        if search and search.lower() not in appt_label.lower() and not biomarkers:
            continue

        results.append({
            'type': 'appointment',
            'id': a.id,
            'label': appt_label,
            'date': date_str,
            'doctor_name': doctor_name,
            'status': a.status,
            'reason': a.reason or '',
            'notes': a.notes or '',
            'biomarkers': biomarkers,
        })

    return jsonify(results)


@messaging.route('/api/messaging/reference-detail', methods=['GET'])
@token_required
def get_reference_detail(current_user):
    """Fetch full details for a clicked reference (appointment or biomarker)."""
    ref_type = request.args.get('type', '')
    ref_id = request.args.get('id', type=int)

    if not ref_type or not ref_id:
        return jsonify({'error': 'type and id are required'}), 400

    if ref_type == 'appointment':
        appt = Appointment.query.get_or_404(ref_id)
        # Access: user must be patient or doctor on this appointment
        if current_user.id not in (appt.patient_id, appt.doctor_id):
            # Also allow if user is in a conversation with the patient
            has_access = Conversation.query.filter(
                ((Conversation.patient_id == appt.patient_id) &
                 ((Conversation.staff_id == current_user.id) | (Conversation.patient_id == current_user.id)))
            ).first() is not None
            if not has_access:
                return jsonify({'error': 'Access denied'}), 403

        biomarkers = []
        for r in appt.biomarker_readings:
            biomarkers.append({
                'id': r.id,
                'biomarker_type': r.biomarker_type,
                'display_name': r.biomarker_type.replace('_', ' ').title(),
                'value': r.value,
                'unit': r.unit,
            })

        return jsonify({
            'type': 'appointment',
            'id': appt.id,
            'date': appt.appointment_date.strftime('%b %d, %Y'),
            'doctor_name': appt.doctor.full_name if appt.doctor else 'Unknown',
            'patient_name': appt.patient.full_name if appt.patient else 'Unknown',
            'status': appt.status,
            'reason': appt.reason or '',
            'notes': appt.notes or '',
            'treatments': appt.treatments or '',
            'biomarkers': biomarkers,
        })

    elif ref_type == 'biomarker':
        reading = BiomarkerReading.query.get_or_404(ref_id)
        appt = Appointment.query.get(reading.appointment_id)
        if not appt:
            return jsonify({'error': 'Appointment not found for biomarker'}), 404

        if current_user.id not in (appt.patient_id, appt.doctor_id):
            has_access = Conversation.query.filter(
                ((Conversation.patient_id == appt.patient_id) &
                 ((Conversation.staff_id == current_user.id) | (Conversation.patient_id == current_user.id)))
            ).first() is not None
            if not has_access:
                return jsonify({'error': 'Access denied'}), 403

        # Get all readings of same type for this patient for history/trend
        history = db.session.query(BiomarkerReading)\
            .join(Appointment, BiomarkerReading.appointment_id == Appointment.id)\
            .filter(
                Appointment.patient_id == appt.patient_id,
                BiomarkerReading.biomarker_type == reading.biomarker_type,
            ).order_by(Appointment.appointment_date.asc()).all()

        history_data = []
        for h in history:
            h_appt = Appointment.query.get(h.appointment_id)
            history_data.append({
                'id': h.id,
                'value': h.value,
                'unit': h.unit,
                'date': h_appt.appointment_date.strftime('%b %d, %Y') if h_appt else '',
                'doctor_name': h_appt.doctor.full_name if h_appt and h_appt.doctor else 'Unknown',
                'is_current': h.id == reading.id,
            })

        return jsonify({
            'type': 'biomarker',
            'id': reading.id,
            'biomarker_type': reading.biomarker_type,
            'display_name': reading.biomarker_type.replace('_', ' ').title(),
            'value': reading.value,
            'unit': reading.unit,
            'appointment_id': appt.id,
            'appointment_date': appt.appointment_date.strftime('%b %d, %Y'),
            'doctor_name': appt.doctor.full_name if appt.doctor else 'Unknown',
            'patient_name': appt.patient.full_name if appt.patient else 'Unknown',
            'history': history_data,
        })

    return jsonify({'error': 'Invalid reference type'}), 400


# ── Image Upload (base64) ───────────────────────────────────────────────────

@messaging.route('/api/messaging/upload-image', methods=['POST'])
@token_required
def upload_image(current_user):
    """Accept a base64 image and return a URL-like reference.
    In production this would go to S3/cloud storage.
    For now we store base64 as-is and return an identifier."""
    data = request.get_json()
    image_data = data.get('image')

    if not image_data:
        return jsonify({'error': 'image is required'}), 400

    # For dev: just store and return the base64 string back
    # In production: upload to cloud storage and return URL
    return jsonify({'image_url': image_data})


# ── Unread Count ─────────────────────────────────────────────────────────────

@messaging.route('/api/messaging/unread-count', methods=['GET'])
@token_required
def get_unread_count(current_user):
    """Get total unread message count across all conversations."""
    if current_user.user_type == 'patient':
        convo_ids = [c.id for c in Conversation.query.filter_by(patient_id=current_user.id).all()]
    else:
        convo_ids = [c.id for c in Conversation.query.filter_by(staff_id=current_user.id).all()]

    if not convo_ids:
        return jsonify({'unread_count': 0})

    count = Message.query.filter(
        Message.conversation_id.in_(convo_ids),
        Message.sender_id != current_user.id,
        Message.is_read == False,
    ).count()

    # Also count pending message requests
    pending_requests = MessageRequest.query.filter_by(
        to_user_id=current_user.id, status='pending'
    ).count()

    return jsonify({'unread_count': count, 'pending_requests': pending_requests})
