from app import create_app, db
from app.models import User, Appointment, BiomarkerReading, MedicalHistory
from datetime import datetime, timedelta

app = create_app()


def seed_data():
    """Seed default test data: patient, doctor, 3 historical appointments with BP readings."""
    # Only seed if test patient doesn't exist
    if User.query.filter_by(email='patient@test.com').first():
        return

    # Create default patient
    patient = User(
        email='patient@test.com',
        full_name='John Smith',
        address='123 Main Street, Charlotte, NC',
        location='Charlotte',
        user_type='patient'
    )
    patient.set_password('password123')
    db.session.add(patient)

    # Create default doctor
    doctor = User(
        email='doctor@test.com',
        full_name='Dr. Sarah Johnson',
        address='456 Medical Center Dr, Charlotte, NC',
        location='Charlotte',
        user_type='staff'
    )
    doctor.set_password('password123')
    db.session.add(doctor)

    # Create Medical History for patient
    conditions = [
        {
            'condition': 'Hypertension',
            'diagnosis_date': '2023-01-15',
            'status': 'Managed',
            'notes': 'Monitor blood pressure regularly.'
        },
        {
            'condition': 'Seasonal Allergies',
            'diagnosis_date': 'Childhood',
            'status': 'Active',
            'notes': 'Prescribed frequent antihistamines.'
        }
    ]

    for c in conditions:
        history = MedicalHistory(
            patient_id=patient.id,
            condition=c['condition'],
            diagnosis_date=c['diagnosis_date'],
            status=c['status'],
            notes=c['notes']
        )
        db.session.add(history)

    db.session.flush()  # Get IDs assigned

    # Create 3 historical appointments with blood pressure readings
    now = datetime.utcnow()
    appointments_data = [
        {
            'date': now - timedelta(days=90),
            'reason': 'Routine checkup',
            'notes': 'Patient appears healthy. Blood pressure slightly elevated.',
            'systolic': 135,
            'diastolic': 88,
        },
        {
            'date': now - timedelta(days=60),
            'reason': 'Follow-up visit',
            'notes': 'Blood pressure improving with lifestyle changes.',
            'systolic': 128,
            'diastolic': 84,
        },
        {
            'date': now - timedelta(days=30),
            'reason': 'Monthly checkup',
            'notes': 'Good progress. Blood pressure within normal range.',
            'systolic': 122,
            'diastolic': 80,
        },
    ]

    for appt_data in appointments_data:
        appt = Appointment(
            patient_id=patient.id,
            doctor_id=doctor.id,
            appointment_date=appt_data['date'],
            status='completed',
            reason=appt_data['reason'],
            notes=appt_data['notes']
        )
        db.session.add(appt)
        db.session.flush()

        # Add blood pressure readings
        systolic = BiomarkerReading(
            appointment_id=appt.id,
            biomarker_type='blood_pressure_systolic',
            value=appt_data['systolic'],
            unit='mmHg'
        )
        diastolic = BiomarkerReading(
            appointment_id=appt.id,
            biomarker_type='blood_pressure_diastolic',
            value=appt_data['diastolic'],
            unit='mmHg'
        )
        db.session.add(systolic)
        db.session.add(diastolic)

    db.session.commit()
    print("✓ Seed data created: patient@test.com / doctor@test.com (password123)")


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        seed_data()
    app.run(debug=True, host='0.0.0.0', port=5000)
