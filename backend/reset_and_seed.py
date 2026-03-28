"""
Complete database reset and reseed script.
Drops ALL tables and recreates them with rich, realistic seed data.
"""
import sys
import os
os.environ['PYTHONUTF8'] = '1'
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from app import create_app, db
from app.models import (User, Appointment, BiomarkerReading, MedicalHistory,
                        Conversation, Message, MessageReaction, MessageRequest,
                        NormalRange)
from datetime import datetime, timedelta
import random

app = create_app()


def reset_db():
    """Drop all tables and recreate them."""
    print("[!] Dropping ALL tables...")
    db.drop_all()
    print("[OK] All tables dropped.")
    print("     Creating tables...")
    db.create_all()
    print("[OK] All tables created.")


def seed_normal_ranges():
    """Seed comprehensive normal ranges for all biomarker types."""
    defaults = [
        ("blood_pressure_systolic",   90,   120,  "mmHg"),
        ("blood_pressure_diastolic",  60,   80,   "mmHg"),
        ("heart_rate",                60,   100,  "bpm"),
        ("cholesterol_total",        125,   200,  "mg/dL"),
        ("blood_sugar",               70,   100,  "mg/dL"),
        ("vitamin_d",                 30,   100,  "ng/mL"),
        ("bmi",                       18.5, 24.9, "kg/m²"),
        ("hba1c",                     4.0,  5.6,  "%"),
        ("kidney_function_egfr",      90,   120,  "mL/min"),
        ("liver_enzymes_alt",         7,    56,   "U/L"),
        ("calcium",                   8.5,  10.5, "mg/dL"),
        ("hemoglobin",               12.0,  17.5, "g/dL"),
        ("oxygen_saturation",         95,   100,  "%"),
        ("temperature",               97.0, 99.0, "°F"),
        ("respiratory_rate",          12,   20,   "breaths/min"),
        ("triglycerides",             0,    150,  "mg/dL"),
        ("cholesterol_ldl",           0,    100,  "mg/dL"),
        ("cholesterol_hdl",           40,   60,   "mg/dL"),
        ("weight",                    50,   120,  "kg"),
        ("height",                    150,  200,  "cm"),
    ]
    for biomarker_type, min_val, max_val, unit in defaults:
        db.session.add(NormalRange(
            biomarker_type=biomarker_type,
            min_value=min_val,
            max_value=max_val,
            unit=unit
        ))
    db.session.flush()
    print("[OK] Normal ranges seeded.")


def seed_data():
    """Seed comprehensive test data."""

    # ── Users ─────────────────────────────────────────────────────────────
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
        full_name="Dr. Emily Carter",
        address="456 Medical Center Dr, Charlotte, NC",
        location="Charlotte",
        user_type="staff"
    )
    doctor.set_password("password123")
    db.session.add(doctor)

    doctor2 = User(
        email="doctor2@test.com",
        full_name="Dr. Rajesh Kumar",
        address="789 Health Pkwy, Charlotte, NC",
        location="Charlotte",
        user_type="staff"
    )
    doctor2.set_password("password123")
    db.session.add(doctor2)

    db.session.flush()

    # ── Medical History ───────────────────────────────────────────────────
    conditions = [
        {
            "condition": "Hypertension",
            "diagnosis_date": "2023-01-15",
            "status": "Managed",
            "notes": "Monitor blood pressure regularly. Current medications helping."
        },
        {
            "condition": "Seasonal Allergies",
            "diagnosis_date": "Childhood",
            "status": "Active",
            "notes": "Prescribed frequent antihistamines."
        },
        {
            "condition": "High Cholesterol",
            "diagnosis_date": "2024-06-10",
            "status": "Active",
            "notes": "Diet: Low fat, high fiber. Recheck in 2 months."
        },
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

    # ── Historical Appointments with full biomarker panels ────────────────
    now = datetime.utcnow()

    # Appointment data: 6 historical appointments over 10 months
    appointments_data = [
        {
            "date": now - timedelta(days=300),
            "doctor": doctor,
            "reason": "Annual Physical",
            "notes": "Full panel. Patient BP elevated. Cholesterol high. Recommend lifestyle changes.",
            "treatments": "Lifestyle modifications: 30 min exercise 5x/week. Low-sodium diet. Follow up in 2 months.",
            "biomarkers": {
                "blood_pressure_systolic": 148,
                "blood_pressure_diastolic": 92,
                "heart_rate": 78,
                "cholesterol_total": 245,
                "blood_sugar": 105,
                "vitamin_d": 15,
                "bmi": 29.1,
                "hba1c": 5.9,
                "kidney_function_egfr": 98,
                "liver_enzymes_alt": 32,
                "calcium": 9.2,
                "hemoglobin": 14.1,
            }
        },
        {
            "date": now - timedelta(days=240),
            "doctor": doctor,
            "reason": "Follow-up: Blood Pressure",
            "notes": "BP improved slightly with lifestyle changes. Adding low-dose medication.",
            "treatments": "Started Lisinopril 10mg daily. Continue exercise routine. Recheck in 6 weeks.",
            "biomarkers": {
                "blood_pressure_systolic": 140,
                "blood_pressure_diastolic": 88,
                "heart_rate": 74,
                "cholesterol_total": 235,
                "blood_sugar": 98,
                "vitamin_d": 16,
                "bmi": 28.8,
                "hba1c": 5.8,
            }
        },
        {
            "date": now - timedelta(days=180),
            "doctor": doctor2,
            "reason": "Quarterly Checkup",
            "notes": "Good progress on BP. Cholesterol still elevated. Started statin discussion.",
            "treatments": "Continue current medications. Added Vitamin D 2000 IU daily. Diet counseling scheduled.",
            "biomarkers": {
                "blood_pressure_systolic": 135,
                "blood_pressure_diastolic": 84,
                "heart_rate": 72,
                "cholesterol_total": 228,
                "blood_sugar": 95,
                "vitamin_d": 18,
                "bmi": 28.4,
                "hba1c": 5.7,
                "kidney_function_egfr": 96,
                "liver_enzymes_alt": 35,
                "calcium": 9.1,
                "hemoglobin": 13.8,
            }
        },
        {
            "date": now - timedelta(days=120),
            "doctor": doctor,
            "reason": "Follow-up: Medication Review",
            "notes": "BP well controlled on medication. Cholesterol improving. Continue Vitamin D.",
            "treatments": "Continue Lisinopril 10mg. Added Atorvastatin 20mg daily. Repeat labs in 3 months.",
            "biomarkers": {
                "blood_pressure_systolic": 128,
                "blood_pressure_diastolic": 82,
                "heart_rate": 70,
                "cholesterol_total": 220,
                "blood_sugar": 92,
                "vitamin_d": 22,
                "bmi": 28.0,
                "hba1c": 5.6,
            }
        },
        {
            "date": now - timedelta(days=60),
            "doctor": doctor,
            "reason": "Routine Follow-up",
            "notes": "Excellent progress. BP stable. Cholesterol trending down. Vitamin D improving.",
            "treatments": "Continue all medications. Maintain exercise 5x/week. Diet: low fat, high fiber.",
            "biomarkers": {
                "blood_pressure_systolic": 125,
                "blood_pressure_diastolic": 78,
                "heart_rate": 72,
                "cholesterol_total": 210,
                "blood_sugar": 88,
                "vitamin_d": 26,
                "bmi": 27.5,
                "hba1c": 5.5,
                "kidney_function_egfr": 95,
                "liver_enzymes_alt": 38,
                "calcium": 9.3,
                "hemoglobin": 14.0,
            }
        },
        {
            "date": now - timedelta(days=14),
            "doctor": doctor,
            "reason": "Monthly Checkup",
            "notes": "Patient doing well. BP in target range. Cholesterol borderline. Continue current plan.",
            "treatments": "Continue Lisinopril 10mg and Atorvastatin 20mg. Vitamin D 2000 IU daily. Recheck in 3 months. Consider reducing BP med if trend continues.",
            "biomarkers": {
                "blood_pressure_systolic": 122,
                "blood_pressure_diastolic": 76,
                "heart_rate": 68,
                "cholesterol_total": 205,
                "blood_sugar": 90,
                "vitamin_d": 28,
                "bmi": 27.2,
                "hba1c": 5.4,
                "kidney_function_egfr": 97,
                "liver_enzymes_alt": 40,
                "calcium": 9.1,
                "hemoglobin": 13.9,
            }
        },
    ]

    # Biomarker unit mapping
    unit_map = {
        "blood_pressure_systolic": "mmHg",
        "blood_pressure_diastolic": "mmHg",
        "heart_rate": "bpm",
        "cholesterol_total": "mg/dL",
        "blood_sugar": "mg/dL",
        "vitamin_d": "ng/mL",
        "bmi": "kg/m²",
        "hba1c": "%",
        "kidney_function_egfr": "mL/min",
        "liver_enzymes_alt": "U/L",
        "calcium": "mg/dL",
        "hemoglobin": "g/dL",
    }

    created_appts = []
    for appt_data in appointments_data:
        appt = Appointment(
            patient_id=patient.id,
            doctor_id=appt_data["doctor"].id,
            appointment_date=appt_data["date"],
            status="completed",
            reason=appt_data["reason"],
            notes=appt_data["notes"],
            treatments=appt_data["treatments"],
        )
        db.session.add(appt)
        db.session.flush()

        for bm_type, value in appt_data["biomarkers"].items():
            db.session.add(BiomarkerReading(
                appointment_id=appt.id,
                biomarker_type=bm_type,
                value=value,
                unit=unit_map.get(bm_type, ""),
                created_at=appt_data["date"],
            ))

        created_appts.append(appt)

    # ── Upcoming Appointment ──────────────────────────────────────────────
    upcoming = Appointment(
        patient_id=patient.id,
        doctor_id=doctor.id,
        appointment_date=now + timedelta(days=14),
        status="pending",
        reason="3-Month Follow-up",
    )
    db.session.add(upcoming)

    # ── Conversation with seeded messages ──────────────────────────────────
    convo = Conversation(
        patient_id=patient.id,
        staff_id=doctor.id,
        created_at=now - timedelta(days=10),
        updated_at=now - timedelta(hours=2),
    )
    db.session.add(convo)
    db.session.flush()

    # Seed a few realistic messages
    messages_data = [
        {
            "sender": doctor,
            "content": "Hi John, your recent lab results look great. Your blood pressure is now in the normal range!",
            "time": now - timedelta(days=10, hours=3),
        },
        {
            "sender": patient,
            "content": "That's wonderful news, Dr. Carter! The exercise routine has really helped.",
            "time": now - timedelta(days=10, hours=2),
        },
        {
            "sender": doctor,
            "content": "Keep it up! I'd like to continue monitoring your cholesterol. It's still borderline but trending in the right direction.",
            "time": now - timedelta(days=10, hours=1),
        },
        {
            "sender": patient,
            "content": "Should I continue the same vitamin D dosage? I've been taking 2000 IU daily.",
            "time": now - timedelta(days=5, hours=6),
        },
        {
            "sender": doctor,
            "content": "Yes, continue with 2000 IU daily. Your levels are improving but still below optimal. We'll recheck at your next appointment.",
            "time": now - timedelta(days=5, hours=4),
        },
    ]

    for msg_data in messages_data:
        msg = Message(
            conversation_id=convo.id,
            sender_id=msg_data["sender"].id,
            content=msg_data["content"],
            message_type="text",
            is_read=True,
            created_at=msg_data["time"],
        )
        db.session.add(msg)

    db.session.commit()
    print("[OK] Seed data created successfully!")
    print(f"   Patient: patient@test.com / password123")
    print(f"   Doctor:  doctor@test.com / password123")
    print(f"   Doctor2: doctor2@test.com / password123")
    print(f"   Total appointments: {len(created_appts)} completed + 1 pending")
    print(f"   Messages seeded: {len(messages_data)}")


if __name__ == '__main__':
    with app.app_context():
        reset_db()
        seed_normal_ranges()
        seed_data()
        print("\n[OK] Database fully reset and reseeded!")
