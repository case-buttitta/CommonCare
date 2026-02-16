from app import create_app, db
from app.models import User, Appointment, BiomarkerReading, MedicalHistory
from datetime import datetime, timedelta

app = create_app()

def seed_data():
    """Seed default test data: patient, doctor, medical history, appointments, and biomarker readings."""
    
    # Skip seeding if patient already exists
    if User.query.filter_by(email="patient@test.com").first():
        return

    # -----------------------------
    # Create patient and doctor
    # -----------------------------
    patient = User(
        email="patient@test.com",
        full_name="John Smith",
        address="123 Main Street, Charlotte, NC",
        location="Charlotte",
        user_type="patient"
    )
    patient.set_password("password123")
    db.session.add(patient)

    doctor = User(
        email="doctor@test.com",
        full_name="Dr. Sarah Johnson",
        address="456 Medical Center Dr, Charlotte, NC",
        location="Charlotte",
        user_type="staff"
    )
    doctor.set_password("password123")
    db.session.add(doctor)

    db.session.flush()  # Assigns IDs for patient and doctor

    # -----------------------------
    # Add medical history using relationship
    # -----------------------------
    conditions = [
        {
            "condition": "Hypertension",
            "diagnosis_date": "2023-01-15",
            "status": "Managed",
            "notes": "Monitor blood pressure regularly."
        },
        {
            "condition": "Seasonal Allergies",
            "diagnosis_date": "Childhood",
            "status": "Active",
            "notes": "Prescribed frequent antihistamines."
        }
    ]

    for c in conditions:
        patient.medical_history.append(
            MedicalHistory(
                condition=c["condition"],
                diagnosis_date=c["diagnosis_date"],
                status=c["status"],
                notes=c["notes"]
            )
        )

    # -----------------------------
    # Add historical appointments with biomarker readings
    # -----------------------------
    now = datetime.utcnow()
    appointments_data = [
        {
            "date": now - timedelta(days=90),
            "reason": "Routine checkup",
            "notes": "Patient appears healthy. Blood pressure slightly elevated.",
            "systolic": 135,
            "diastolic": 88
        },
        {
            "date": now - timedelta(days=60),
            "reason": "Follow-up visit",
            "notes": "Blood pressure improving with lifestyle changes.",
            "systolic": 128,
            "diastolic": 84
        },
        {
            "date": now - timedelta(days=30),
            "reason": "Monthly checkup",
            "notes": "Good progress. Blood pressure within normal range.",
            "systolic": 122,
            "diastolic": 80
        }
    ]

    for appt_data in appointments_data:
        # Create appointment linked to patient and doctor
        appt = Appointment(
            doctor=doctor,
            appointment_date=appt_data["date"],
            status="completed",
            reason=appt_data["reason"],
            notes=appt_data["notes"]
        )
        patient.appointments_as_patient.append(appt)
        doctor.appointments_as_doctor.append(appt)

        db.session.flush()  # ensures appt.id exists for child biomarker readings

        # Add biomarker readings linked to this appointment
        appt.biomarker_readings.append(
            BiomarkerReading(
                biomarker_type="blood_pressure_systolic",
                value=appt_data["systolic"],
                unit="mmHg"
            )
        )
        appt.biomarker_readings.append(
            BiomarkerReading(
                biomarker_type="blood_pressure_diastolic",
                value=appt_data["diastolic"],
                unit="mmHg"
            )
        )

    # -----------------------------
    # Commit everything in one go
    # -----------------------------
    db.session.commit()
    print("✓ Seed data created: patient@test.com / doctor@test.com (password123)")

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        seed_data()
    app.run(debug=True, host='0.0.0.0', port=5000)
