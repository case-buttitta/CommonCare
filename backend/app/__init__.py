from flask import Flask, request, make_response
from flask_sqlalchemy import SQLAlchemy
from config import Config

db = SQLAlchemy()

ALLOWED_ORIGINS = [
    "https://case-buttitta.github.io",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5001",
]


def _add_cors(response, origin):
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)

    @app.before_request
    def handle_preflight():
        if request.method == "OPTIONS":
            origin = request.headers.get("Origin", "")
            if origin in ALLOWED_ORIGINS:
                resp = make_response("", 204)
                return _add_cors(resp, origin)

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            _add_cors(response, origin)
        return response

    from flask_smorest import Api
    api = Api(app)

    from app.routes import main
    app.register_blueprint(main)

    from app.messaging_routes import messaging
    app.register_blueprint(messaging)
    
    from app.api_history import blp as history_blp
    api.register_blueprint(history_blp)

    # Initialize APScheduler
    from apscheduler.schedulers.background import BackgroundScheduler
    from app.tasks import send_appointment_reminders
    
    scheduler = BackgroundScheduler()
    # Check for reminders every minute
    scheduler.add_job(func=send_appointment_reminders, args=[app], trigger="interval", minutes=1)
    scheduler.start()

    with app.app_context():
        try:
            db.create_all()
            if not app.testing:
                _seed_if_needed()
                _seed_normal_ranges()
        except Exception as e:
            print(f"Warning: db init failed: {e}")

    return app


def _seed_if_needed():
    """Seed test data if the database is empty."""
    from app.models import (User, Appointment, BiomarkerReading, MedicalHistory,
                            Conversation, Message)
    from datetime import datetime, timedelta

    from sqlalchemy.exc import IntegrityError
    
    try:
        if User.query.filter_by(email="patient@test.com").first():
            print("✓ Database already seeded, skipping.")
            return
    except Exception:
        db.session.rollback()
        return

    print("Seeding database...")

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

    for c in [
        {"condition": "Hypertension", "diagnosis_date": "2023-01-15",
         "status": "Managed", "notes": "Monitor blood pressure regularly."},
        {"condition": "Seasonal Allergies", "diagnosis_date": "Childhood",
         "status": "Active", "notes": "Prescribed frequent antihistamines."},
        {"condition": "High Cholesterol", "diagnosis_date": "2024-06-10",
         "status": "Active", "notes": "Diet: Low fat, high fiber. Recheck in 2 months."},
    ]:
        patient.medical_history.append(
            MedicalHistory(
                condition=c["condition"],
                diagnosis_date=c["diagnosis_date"],
                status=c["status"],
                notes=c["notes"]
            )
        )

    now = datetime.utcnow()
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

    appointments_data = [
        {"date": now - timedelta(days=300), "doctor": doctor,
         "reason": "Annual Physical",
         "notes": "Full panel. BP elevated. Cholesterol high.",
         "treatments": "Lifestyle modifications: 30 min exercise 5x/week. Low-sodium diet.",
         "biomarkers": {"blood_pressure_systolic": 148, "blood_pressure_diastolic": 92,
                        "heart_rate": 78, "cholesterol_total": 245, "blood_sugar": 105,
                        "vitamin_d": 15, "bmi": 29.1, "hba1c": 5.9,
                        "kidney_function_egfr": 98, "liver_enzymes_alt": 32,
                        "calcium": 9.2, "hemoglobin": 14.1}},
        {"date": now - timedelta(days=240), "doctor": doctor,
         "reason": "Follow-up: Blood Pressure",
         "notes": "BP improved slightly. Adding low-dose medication.",
         "treatments": "Started Lisinopril 10mg daily. Continue exercise.",
         "biomarkers": {"blood_pressure_systolic": 140, "blood_pressure_diastolic": 88,
                        "heart_rate": 74, "cholesterol_total": 235, "blood_sugar": 98,
                        "vitamin_d": 16, "bmi": 28.8, "hba1c": 5.8}},
        {"date": now - timedelta(days=180), "doctor": doctor2,
         "reason": "Quarterly Checkup",
         "notes": "Good progress on BP. Cholesterol still elevated.",
         "treatments": "Continue medications. Added Vitamin D 2000 IU daily.",
         "biomarkers": {"blood_pressure_systolic": 135, "blood_pressure_diastolic": 84,
                        "heart_rate": 72, "cholesterol_total": 228, "blood_sugar": 95,
                        "vitamin_d": 18, "bmi": 28.4, "hba1c": 5.7,
                        "kidney_function_egfr": 96, "liver_enzymes_alt": 35,
                        "calcium": 9.1, "hemoglobin": 13.8}},
        {"date": now - timedelta(days=120), "doctor": doctor,
         "reason": "Follow-up: Medication Review",
         "notes": "BP well controlled. Cholesterol improving.",
         "treatments": "Continue Lisinopril 10mg. Added Atorvastatin 20mg daily.",
         "biomarkers": {"blood_pressure_systolic": 128, "blood_pressure_diastolic": 82,
                        "heart_rate": 70, "cholesterol_total": 220, "blood_sugar": 92,
                        "vitamin_d": 22, "bmi": 28.0, "hba1c": 5.6}},
        {"date": now - timedelta(days=60), "doctor": doctor,
         "reason": "Routine Follow-up",
         "notes": "Excellent progress. BP stable. Cholesterol trending down.",
         "treatments": "Continue all medications. Maintain exercise 5x/week.",
         "biomarkers": {"blood_pressure_systolic": 125, "blood_pressure_diastolic": 78,
                        "heart_rate": 72, "cholesterol_total": 210, "blood_sugar": 88,
                        "vitamin_d": 26, "bmi": 27.5, "hba1c": 5.5,
                        "kidney_function_egfr": 95, "liver_enzymes_alt": 38,
                        "calcium": 9.3, "hemoglobin": 14.0}},
        {"date": now - timedelta(days=14), "doctor": doctor,
         "reason": "Monthly Checkup",
         "notes": "Patient doing well. BP in target range.",
         "treatments": "Continue Lisinopril 10mg and Atorvastatin 20mg. Vitamin D 2000 IU daily.",
         "biomarkers": {"blood_pressure_systolic": 122, "blood_pressure_diastolic": 76,
                        "heart_rate": 68, "cholesterol_total": 205, "blood_sugar": 90,
                        "vitamin_d": 28, "bmi": 27.2, "hba1c": 5.4,
                        "kidney_function_egfr": 97, "liver_enzymes_alt": 40,
                        "calcium": 9.1, "hemoglobin": 13.9}},
    ]

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

    # Upcoming appointment
    db.session.add(Appointment(
        patient_id=patient.id,
        doctor_id=doctor.id,
        appointment_date=now + timedelta(days=14),
        status="pending",
        reason="3-Month Follow-up",
    ))

    # Conversation
    convo = Conversation(
        patient_id=patient.id,
        staff_id=doctor.id,
        created_at=now - timedelta(days=10),
        updated_at=now - timedelta(hours=2),
    )
    db.session.add(convo)
    db.session.flush()

    for msg_data in [
        {"sender": doctor, "content": "Hi John, your recent lab results look great. Your blood pressure is now in the normal range!",
         "time": now - timedelta(days=10, hours=3)},
        {"sender": patient, "content": "That's wonderful news, Dr. Carter! The exercise routine has really helped.",
         "time": now - timedelta(days=10, hours=2)},
        {"sender": doctor, "content": "Keep it up! I'd like to continue monitoring your cholesterol.",
         "time": now - timedelta(days=10, hours=1)},
    ]:
        db.session.add(Message(
            conversation_id=convo.id,
            sender_id=msg_data["sender"].id,
            content=msg_data["content"],
            message_type="text",
            is_read=True,
            created_at=msg_data["time"],
        ))

    try:
        db.session.commit()
        print("✓ Seed data created: patient@test.com / doctor@test.com / doctor2@test.com (password123)")
    except IntegrityError:
        db.session.rollback()
        print("✓ Concurrent seed detected. Rolled back gracefully.")


def _seed_normal_ranges():
    """Seed default normal ranges if none exist yet."""
    from app.models import NormalRange

    from sqlalchemy.exc import IntegrityError

    try:
        if NormalRange.query.first():
            return
    except Exception:
        db.session.rollback()
        return

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

    for biomarker_type, min_value, max_value, unit in defaults:
        db.session.add(NormalRange(
            biomarker_type=biomarker_type,
            min_value=min_value,
            max_value=max_value,
            unit=unit
        ))

    try:
        db.session.commit()
        print("✓ Default normal ranges seeded.")
    except IntegrityError:
        db.session.rollback()
        print("✓ Concurrent normal ranges seed detected. Rolled back gracefully.")

