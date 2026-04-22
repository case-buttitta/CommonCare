from flask import Blueprint, jsonify, request
from app import db
from app.models import User, Location, Appointment, BiomarkerReading, MedicalHistory
from app.auth import generate_token, token_required
from datetime import datetime

main = Blueprint('main', __name__)


@main.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'API is running'})


# ── Auth Routes ──────────────────────────────────────────────────────────────

@main.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()

    required_fields = ['email', 'password', 'full_name', 'user_type']
    for field in required_fields:
        if not data or not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    if data['user_type'] not in ['patient', 'staff', 'location_admin']:
        return jsonify({'error': 'user_type must be patient, staff, or location_admin'}), 400

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 400

    if len(data['password']) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    user = User(
        email=data['email'],
        full_name=data['full_name'],
        address=data.get('address', ''),
        location=data.get('location', 'Charlotte'),
        user_type=data['user_type']
    )
    user.set_password(data['password'])

    db.session.add(user)
    db.session.commit()

    token = generate_token(user.id)

    return jsonify({
        'message': 'Account created successfully',
        'token': token,
        'user': user.to_dict()
    }), 201


@main.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()

    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password are required'}), 400

    user = User.query.filter_by(email=data['email']).first()

    if not user or not user.check_password(data['password']):
        return jsonify({'error': 'Invalid email or password'}), 401

    token = generate_token(user.id)

    return jsonify({
        'message': 'Login successful',
        'token': token,
        'user': user.to_dict()
    })


@main.route('/api/auth/me', methods=['GET'])
@token_required
def get_current_user(current_user):
    return jsonify(current_user.to_dict())


@main.route('/api/auth/account', methods=['DELETE'])
@token_required
def delete_account(current_user):
    db.session.delete(current_user)
    db.session.commit()
    return jsonify({'message': 'Account deleted successfully'})


@main.route('/api/auth/profile', methods=['PUT'])
@token_required
def update_profile(current_user):
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    if 'full_name' in data and data['full_name'].strip():
        current_user.full_name = data['full_name'].strip()
    if 'address' in data:
        current_user.address = data['address'].strip()
    if 'location' in data and data['location'].strip():
        current_user.location = data['location'].strip()
    db.session.commit()
    return jsonify(current_user.to_dict())


# ── Staff Listing ────────────────────────────────────────────────────────────

@main.route('/api/staff', methods=['GET'])
@token_required
def list_staff(current_user):
    """List all staff members (for appointment booking dropdown)."""
    staff = User.query.filter_by(user_type='staff').all()
    return jsonify([s.to_dict() for s in staff])


# ── Patient Listing (staff only) ────────────────────────────────────────────

@main.route('/api/patients', methods=['GET'])
@token_required
def list_patients(current_user):
    """List patients. Staff only; scoped to their location when assigned."""
    if current_user.user_type != 'staff':
        return jsonify({'error': 'Staff access required'}), 403
    if current_user.location_id:
        patients = User.query.filter_by(user_type='patient', location_id=current_user.location_id).all()
    else:
        patients = User.query.filter_by(user_type='patient').all()
    return jsonify([p.to_dict() for p in patients])


# ── Appointments ─────────────────────────────────────────────────────────────

@main.route('/api/appointments', methods=['GET'])
@token_required
def list_appointments(current_user):
    """
    Patient: returns own appointments.
    Staff: returns all appointments (or filtered by patient_id query param).
    """
    if current_user.user_type == 'staff':
        patient_id = request.args.get('patient_id', type=int)
        if patient_id:
            appointments = Appointment.query.filter_by(patient_id=patient_id) \
                .order_by(Appointment.appointment_date.desc()).all()
        elif current_user.location_id:
            loc_patient_ids = db.session.query(User.id).filter_by(
                user_type='patient', location_id=current_user.location_id
            ).subquery()
            appointments = Appointment.query.filter(
                Appointment.patient_id.in_(loc_patient_ids)
            ).order_by(Appointment.appointment_date.desc()).all()
        else:
            appointments = Appointment.query \
                .order_by(Appointment.appointment_date.desc()).all()
    else:
        appointments = Appointment.query.filter_by(patient_id=current_user.id) \
            .order_by(Appointment.appointment_date.desc()).all()

    return jsonify([a.to_dict() for a in appointments])


@main.route('/api/appointments', methods=['POST'])
@token_required
def create_appointment(current_user):
    """Patient creates a new appointment."""
    if current_user.user_type != 'patient':
        return jsonify({'error': 'Only patients can book appointments'}), 403

    data = request.get_json()

    if not data or not data.get('doctor_id') or not data.get('appointment_date'):
        return jsonify({'error': 'doctor_id and appointment_date are required'}), 400

    # Verify doctor exists and is staff
    doctor = User.query.get(data['doctor_id'])
    if not doctor or doctor.user_type != 'staff':
        return jsonify({'error': 'Invalid doctor selected'}), 400

    try:
        appt_date = datetime.fromisoformat(data['appointment_date'])
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid date format'}), 400

    appointment = Appointment(
        patient_id=current_user.id,
        doctor_id=data['doctor_id'],
        appointment_date=appt_date,
        status='pending',
        reason=data.get('reason', '')
    )

    db.session.add(appointment)
    db.session.commit()

    return jsonify(appointment.to_dict()), 201


@main.route('/api/appointments/<int:appointment_id>', methods=['GET'])
@token_required
def get_appointment(current_user, appointment_id):
    """Get a single appointment with its biomarker readings."""
    appointment = Appointment.query.get_or_404(appointment_id)

    # Access control
    if current_user.user_type == 'patient' and appointment.patient_id != current_user.id:
        return jsonify({'error': 'Access denied'}), 403

    return jsonify(appointment.to_dict())


@main.route('/api/appointments/<int:appointment_id>', methods=['PUT'])
@token_required
def update_appointment(current_user, appointment_id):
    """Staff submits appointment results (biomarker readings, notes, status)."""
    if current_user.user_type != 'staff':
        return jsonify({'error': 'Staff access required'}), 403

    appointment = Appointment.query.get_or_404(appointment_id)
    data = request.get_json()

    # Update status and notes
    if 'status' in data:
        appointment.status = data['status']
    if 'notes' in data:
        appointment.notes = data['notes']
    if 'treatments' in data:
        appointment.treatments = data['treatments']

    # Handle biomarker readings
    if 'biomarker_readings' in data:
        # Clear existing readings for this appointment
        BiomarkerReading.query.filter_by(appointment_id=appointment.id).delete()

        for reading in data['biomarker_readings']:
            br = BiomarkerReading(
                appointment_id=appointment.id,
                biomarker_type=reading['biomarker_type'],
                value=reading['value'],
                unit=reading.get('unit', 'mmHg')
            )
            db.session.add(br)

    db.session.commit()
    return jsonify(appointment.to_dict())


# ── Biomarkers ───────────────────────────────────────────────────────────────

@main.route('/api/patients/<int:patient_id>/biomarkers', methods=['GET'])
@token_required
def get_patient_biomarkers(current_user, patient_id):
    """
    Get biomarker data for a patient.
    Returns latest readings + full history grouped by type.
    """
    # Access control
    if current_user.user_type == 'patient' and current_user.id != patient_id:
        return jsonify({'error': 'Access denied'}), 403

    # Get all completed appointments for this patient, ordered by date
    appointments = Appointment.query.filter_by(
        patient_id=patient_id,
        status='completed'
    ).order_by(Appointment.appointment_date.asc()).all()

    # Build history by biomarker type
    history = {}
    for appt in appointments:
        for reading in appt.biomarker_readings:
            if reading.biomarker_type not in history:
                history[reading.biomarker_type] = []
            history[reading.biomarker_type].append({
                'value': reading.value,
                'unit': reading.unit,
                'date': appt.appointment_date.isoformat(),
                'appointment_id': appt.id,
                'doctor_name': appt.doctor.full_name if appt.doctor else None,
            })

    # Latest readings (last entry per type)
    latest = {}
    for btype, readings in history.items():
        latest[btype] = readings[-1] if readings else None

    # Previous readings (second to last per type, for trend)
    previous = {}
    for btype, readings in history.items():
        previous[btype] = readings[-2] if len(readings) >= 2 else None


    return jsonify({
        'latest': latest,
        'previous': previous,
        'history': history,
    })


# ── Medical History ──────────────────────────────────────────────────────────

@main.route('/api/patients/<int:patient_id>/history', methods=['GET'])
@token_required
def get_medical_history(current_user, patient_id):
    """
    Get medical history for a patient.
    Accessible by: Patient (own history), Staff (any patient).
    """
    if current_user.user_type == 'patient' and current_user.id != patient_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Verify patient exists
    if not User.query.get(patient_id):
        return jsonify({'error': 'Patient not found'}), 404

    history = MedicalHistory.query.filter_by(patient_id=patient_id).order_by(MedicalHistory.created_at.desc()).all()
    return jsonify([h.to_dict() for h in history])


@main.route('/api/patients/<int:patient_id>/history', methods=['POST'])
@token_required
def add_medical_history(current_user, patient_id):
    """Add a medical history record. Staff only."""
    if current_user.user_type != 'staff':
        return jsonify({'error': 'Staff access required'}), 403

    data = request.get_json()
    if not data or not data.get('condition'):
        return jsonify({'error': 'Condition is required'}), 400

    record = MedicalHistory(
        patient_id=patient_id,
        condition=data['condition'],
        diagnosis_date=data.get('diagnosis_date', ''),
        status=data.get('status', 'Active'),
        notes=data.get('notes', '')
    )
    
    db.session.add(record)
    db.session.commit()
    return jsonify(record.to_dict()), 201


@main.route('/api/history/<int:record_id>', methods=['PUT'])
@token_required
def update_medical_history(current_user, record_id):
    """Update a medical history record. Staff only."""
    if current_user.user_type != 'staff':
        return jsonify({'error': 'Staff access required'}), 403

    record = MedicalHistory.query.get_or_404(record_id)
    data = request.get_json()

    if 'condition' in data:
        record.condition = data['condition']
    if 'diagnosis_date' in data:
        record.diagnosis_date = data['diagnosis_date']
    if 'status' in data:
        record.status = data['status']
    if 'notes' in data:
        record.notes = data['notes']

    db.session.commit()
    return jsonify(record.to_dict())


@main.route('/api/history/<int:record_id>', methods=['DELETE'])
@token_required
def delete_medical_history(current_user, record_id):
    """Delete a medical history record. Staff only."""
    if current_user.user_type != 'staff':
        return jsonify({'error': 'Staff access required'}), 403

    record = MedicalHistory.query.get_or_404(record_id)
    db.session.delete(record)
    db.session.commit()
    return jsonify({'message': 'Record deleted successfully'})

# ── Normal Ranges ─────────────────────────────────────────────────────────────

from app.models import NormalRange

@main.route('/api/normal-ranges', methods=['GET'])
@token_required
def get_normal_ranges(current_user):
    ranges = NormalRange.query.order_by(NormalRange.biomarker_type.asc()).all()
    return jsonify([r.to_dict() for r in ranges])


@main.route('/api/normal-ranges', methods=['POST'])
@token_required
def create_normal_range(current_user):
    if current_user.user_type != 'staff':
        return jsonify({'error': 'Staff access required'}), 403

    data = request.get_json()
    required = ['biomarker_type', 'min_value', 'max_value', 'unit']

    for field in required:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400

    # Check if a range for this biomarker already exists (Upsert logic)
    existing_range = NormalRange.query.filter_by(biomarker_type=data['biomarker_type']).first()
    
    if existing_range:
        existing_range.min_value = data['min_value']
        existing_range.max_value = data['max_value']
        existing_range.unit = data['unit']
        db.session.commit()
        return jsonify(existing_range.to_dict()), 200

    new_range = NormalRange(
        biomarker_type=data['biomarker_type'],
        min_value=data['min_value'],
        max_value=data['max_value'],
        unit=data['unit']
    )

    db.session.add(new_range)
    db.session.commit()
    return jsonify(new_range.to_dict()), 201


@main.route('/api/normal-ranges/<int:range_id>', methods=['PUT'])
@token_required
def update_normal_range(current_user, range_id):
    if current_user.user_type != 'staff':
        return jsonify({'error': 'Staff access required'}), 403

    r = NormalRange.query.get_or_404(range_id)
    data = request.get_json()

    if 'biomarker_type' in data:
        r.biomarker_type = data['biomarker_type']
    if 'min_value' in data:
        r.min_value = data['min_value']
    if 'max_value' in data:
        r.max_value = data['max_value']
    if 'unit' in data:
        r.unit = data['unit']

    db.session.commit()
    return jsonify(r.to_dict())


@main.route('/api/normal-ranges/<int:range_id>', methods=['DELETE'])
@token_required
def delete_normal_range(current_user, range_id):
    if current_user.user_type != 'staff':
        return jsonify({'error': 'Staff access required'}), 403

    r = NormalRange.query.get_or_404(range_id)
    db.session.delete(r)
    db.session.commit()
    return jsonify({'message': 'Normal range deleted'})


# ── Location Admin: Theme ────────────────────────────────────────────────────

@main.route('/api/themes', methods=['GET'])
@token_required
def get_theme(current_user):
    if not current_user.location_id:
        return jsonify({'theme': None})
    location = Location.query.get(current_user.location_id)
    if not location:
        return jsonify({'theme': None})
    return jsonify(location.to_dict())


@main.route('/api/themes', methods=['POST'])
@token_required
def save_theme(current_user):
    if current_user.user_type != 'location_admin':
        return jsonify({'error': 'Location admin access required'}), 403
    if not current_user.location_id:
        return jsonify({'error': 'No location assigned to this admin'}), 400

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    location = Location.query.get(current_user.location_id)
    if not location:
        return jsonify({'error': 'Location not found'}), 404

    if 'primary_color' in data:
        location.primary_color = data['primary_color']
    if 'secondary_color' in data:
        location.secondary_color = data['secondary_color']
    if 'header_color' in data:
        location.header_color = data['header_color']
    if 'background_color' in data:
        location.background_color = data['background_color']

    db.session.commit()
    return jsonify(location.to_dict())


# ── Location Admin: User Management ─────────────────────────────────────────

@main.route('/api/locations/my', methods=['GET'])
@token_required
def get_my_location(current_user):
    if current_user.user_type != 'location_admin':
        return jsonify({'error': 'Location admin access required'}), 403
    if not current_user.location_id:
        return jsonify({'error': 'No location assigned'}), 404
    location = Location.query.get(current_user.location_id)
    if not location:
        return jsonify({'error': 'Location not found'}), 404
    return jsonify(location.to_dict())


@main.route('/api/locations/<int:location_id>/users', methods=['GET'])
@token_required
def get_location_users(current_user, location_id):
    if current_user.user_type != 'location_admin':
        return jsonify({'error': 'Location admin access required'}), 403
    if current_user.location_id != location_id:
        return jsonify({'error': 'Access denied to this location'}), 403

    users = User.query.filter_by(location_id=location_id).all()
    return jsonify([u.to_dict() for u in users])


@main.route('/api/locations/<int:location_id>/users', methods=['POST'])
@token_required
def add_user_to_location(current_user, location_id):
    if current_user.user_type != 'location_admin':
        return jsonify({'error': 'Location admin access required'}), 403
    if current_user.location_id != location_id:
        return jsonify({'error': 'Access denied to this location'}), 403

    data = request.get_json()
    if not data or not data.get('email'):
        return jsonify({'error': 'email is required'}), 400

    user = User.query.filter_by(email=data['email']).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if user.user_type == 'location_admin':
        return jsonify({'error': 'Cannot add another location admin to a location'}), 400

    user.location_id = location_id
    db.session.commit()
    return jsonify(user.to_dict())


@main.route('/api/locations/<int:location_id>/users/<int:user_id>', methods=['DELETE'])
@token_required
def remove_user_from_location(current_user, location_id, user_id):
    if current_user.user_type != 'location_admin':
        return jsonify({'error': 'Location admin access required'}), 403
    if current_user.location_id != location_id:
        return jsonify({'error': 'Access denied to this location'}), 403

    user = User.query.get_or_404(user_id)
    if user.location_id != location_id:
        return jsonify({'error': 'User is not at this location'}), 400
    if user.id == current_user.id:
        return jsonify({'error': 'Cannot remove yourself from the location'}), 400

    user.location_id = None
    db.session.commit()
    return jsonify({'message': f'{user.full_name} removed from location'})



# User listing for patient dashboard
@main.route('/api/locations/public', methods=['GET'])
def get_locations_public():
    locations = Location.query.order_by(Location.id).all()
    result = []
    for loc in locations:
        users = User.query.filter_by(location_id=loc.id).order_by(User.user_type, User.email).all()
        loc_dict = loc.to_dict()
        loc_dict['users'] = [
            {'email': u.email, 'user_type': u.user_type, 'full_name': u.full_name}
            for u in users
        ]
        loc_dict['default_password'] = 'password123' if loc.name == 'Charlotte Medical Center' else 'password'
        result.append(loc_dict)
    return jsonify(result)

@main.route('/api/locations/<int:location_id>/staff', methods=['GET'])
@token_required
def get_location_staff(current_user, location_id):
    users = User.query.filter_by(
        location_id=location_id,
        user_type='staff'
    ).all()

    return jsonify([u.to_dict() for u in users])

@main.route('/api/locations/<int:location_id>/admin', methods=['GET'])
@token_required
def get_location_admin(current_user, location_id):
    if current_user.user_type != 'patient' and current_user.user_type != 'staff':
        return jsonify({'error': 'Access denied'}), 403

    location = Location.query.get_or_404(location_id)

    admin = User.query.filter_by(
        location_id=location.id,
        user_type='location_admin'
    ).first()

    if not admin:
        return jsonify(None)

    return jsonify(admin.to_dict())
