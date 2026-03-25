from flask import Flask, request, make_response
from flask_sqlalchemy import SQLAlchemy
from config import Config

db = SQLAlchemy()

ALLOWED_ORIGINS = [
    "https://case-buttitta.github.io",
    "http://localhost:5173",
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

    with app.app_context():
        try:
            db.create_all()
            _seed_if_needed()
            _seed_normal_ranges()
        except Exception as e:
            print(f"Warning: db init failed: {e}")

    return app


def _seed_if_needed():
    """Seed test data if the database is empty."""
    from app.models import (User, Appointment, BiomarkerReading, MedicalHistory)
    from datetime import datetime, timedelta

    if User.query.filter_by(email="patient@test.com").first():
        print("✓ Database already seeded, skipping.")
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
        full_name="Dr. Sarah Johnson",
        address="456 Medical Center Dr, Charlotte, NC",
        location="Charlotte",
        user_type="staff"
    )
    doctor.set_password("password123")
    db.session.add(doctor)

    db.session.flush()

    for c in [
        {"condition": "Hypertension", "diagnosis_date": "2023-01-15",
         "status": "Managed", "notes": "Monitor blood pressure regularly."},
        {"condition": "Seasonal Allergies", "diagnosis_date": "Childhood",
         "status": "Active", "notes": "Prescribed frequent antihistamines."},
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
    for appt_data in [
        {"date": now - timedelta(days=90), "reason": "Routine checkup",
         "notes": "Patient appears healthy. Blood pressure slightly elevated.",
         "systolic": 135, "diastolic": 88},
        {"date": now - timedelta(days=60), "reason": "Follow-up visit",
         "notes": "Blood pressure improving with lifestyle changes.",
         "systolic": 128, "diastolic": 84},
        {"date": now - timedelta(days=30), "reason": "Monthly checkup",
         "notes": "Good progress. Blood pressure within normal range.",
         "systolic": 122, "diastolic": 80},
    ]:
        appt = Appointment(
            doctor=doctor,
            appointment_date=appt_data["date"],
            status="completed",
            reason=appt_data["reason"],
            notes=appt_data["notes"]
        )
        patient.patient_appointments.append(appt)
        doctor.doctor_appointments.append(appt)
        db.session.flush()

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

    db.session.commit()
    print("✓ Seed data created: patient@test.com / doctor@test.com (password123)")


def _seed_normal_ranges():
    """Seed default normal ranges if none exist yet."""
    from app.models import NormalRange

    if NormalRange.query.first():
        return

    defaults = [
        ("blood_pressure_systolic",  90,   130,  "mmHg"),
        ("blood_pressure_diastolic", 60,   85,   "mmHg"),
        ("heart_rate",               60,   100,  "bpm"),
        ("respiratory_rate",         12,   20,   "breaths/min"),
        ("oxygen_saturation",        95,   100,  "%"),
        ("temperature",              97.0, 99.0, "°F"),
        ("blood_glucose",            70,   100,  "mg/dL"),
        ("cholesterol_total",        0,    200,  "mg/dL"),
        ("cholesterol_ldl",          0,    100,  "mg/dL"),
        ("cholesterol_hdl",          40,   60,   "mg/dL"),
        ("triglycerides",            0,    150,  "mg/dL"),
        ("weight",                   50,   120,  "kg"),
        ("height",                   150,  200,  "cm"),
        ("bmi",                      18.5, 24.9, "kg/m²"),
    ]

    for biomarker_type, min_value, max_value, unit in defaults:
        db.session.add(NormalRange(
            biomarker_type=biomarker_type,
            min_value=min_value,
            max_value=max_value,
            unit=unit
        ))

    db.session.commit()
    print("✓ Default normal ranges seeded.")
