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

    from app.ai_chat_routes import ai_chat
    app.register_blueprint(ai_chat)
    
    from app.api_history import blp as history_blp
    api.register_blueprint(history_blp)

    from app.api_users import blp as users_blp
    api.register_blueprint(users_blp)

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
                _seed_stress_test_if_needed()
        except Exception as e:
            print(f"Warning: db init failed: {e}")

    return app


def _seed_if_needed():
    """Seed test data if the database is empty."""
    from app.models import (User, Location, Appointment, BiomarkerReading, MedicalHistory,
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

    charlotte_location = Location(
        name="Charlotte Medical Center",
        address="456 Medical Center Dr, Charlotte, NC 28202",
    )
    db.session.add(charlotte_location)
    db.session.flush()

    patient = User(
        email="patient@test.com",
        full_name="John Smith",
        address="123 Main Street, Charlotte, NC",
        location="Charlotte",
        location_id=charlotte_location.id,
        user_type="patient"
    )
    patient.set_password("password123")
    db.session.add(patient)

    doctor = User(
        email="doctor@test.com",
        full_name="Dr. Emily Carter",
        address="456 Medical Center Dr, Charlotte, NC",
        location="Charlotte",
        location_id=charlotte_location.id,
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

    location_admin = User(
        email="admin@test.com",
        full_name="Location Admin",
        address="456 Medical Center Dr, Charlotte, NC",
        location="Charlotte",
        location_id=charlotte_location.id,
        user_type="location_admin"
    )
    location_admin.set_password("password123")
    db.session.add(location_admin)

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
        print("✓ Seed data created: patient@test.com / doctor@test.com / doctor2@test.com / admin@test.com (password123)")
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


def _seed_stress_test_if_needed():
    """Seed 4 additional stress-test locations if not already present."""
    from app.models import (User, Location, Appointment, BiomarkerReading, MedicalHistory)
    from datetime import datetime, timedelta
    from sqlalchemy.exc import IntegrityError

    try:
        if Location.query.filter_by(name="Piedmont Heart Institute").first():
            return
    except Exception:
        db.session.rollback()
        return

    print("Seeding stress test locations...")
    now = datetime.utcnow()

    SPECIALTY = {
        "cardiology": {
            "conditions": [
                ("Atrial Fibrillation", "Managed", "Rate-controlled with beta-blockers. INR monitored monthly."),
                ("Coronary Artery Disease", "Active", "Drug-eluting stent placed 2022. Dual antiplatelet therapy ongoing."),
                ("Hypertension", "Managed", "BP well-controlled on ACE inhibitor. Home monitoring log reviewed."),
                ("Hyperlipidemia", "Active", "On high-intensity statin. LDL trending toward goal."),
                ("Heart Failure (HFrEF)", "Managed", "EF 38%. On maximally tolerated GDMT. Volume stable."),
                ("Stable Angina Pectoris", "Active", "Nitrates PRN. Stress test scheduled."),
                ("Peripheral Artery Disease", "Active", "ABI 0.72. Supervised walking program initiated."),
                ("Moderate Aortic Stenosis", "Active", "Annual echo surveillance. No symptoms at this time."),
            ],
            "reasons": [
                "Annual Cardiac Evaluation", "Echocardiogram Review", "Medication Adjustment",
                "Palpitation Follow-up", "Post-Catheterization Follow-up",
                "Chest Pain Workup", "Stress Test Results Review", "Holter Monitor Review",
            ],
            "notes": [
                "Patient hemodynamically stable. No new symptoms since last visit.",
                "Reviewed labs. BP trending down on current regimen. Continue and reassess.",
                "EKG unchanged from baseline. Medication adherence confirmed. Good progress.",
            ],
            "treatments": [
                "Continue current antihypertensive and statin therapy. Repeat lipid panel in 3 months.",
                "Uptitrate beta-blocker dose. Low-sodium diet reinforced. Follow up in 6 weeks.",
                "Cardiology referral placed. Aspirin 81mg daily. Return for stress echo in 4 weeks.",
            ],
            "biomarkers": {
                "blood_pressure_systolic": [(148, 165), (138, 155), (125, 142)],
                "blood_pressure_diastolic": [(92, 102), (86, 96),  (78, 88)],
                "heart_rate":              [(82, 94),  (75, 88),   (68, 80)],
                "cholesterol_total":       [(248, 262), (228, 245), (205, 225)],
                "cholesterol_ldl":         [(158, 172), (138, 155), (118, 135)],
                "cholesterol_hdl":         [(34, 42),   (37, 45),   (40, 48)],
                "triglycerides":           [(208, 228), (188, 210), (162, 188)],
            },
        },
        "orthopedics": {
            "conditions": [
                ("Lumbar Disc Herniation L4-L5", "Active", "Conservative management. PT twice weekly."),
                ("Right Knee Osteoarthritis Grade III", "Managed", "Intra-articular injections every 3 months."),
                ("Partial Rotator Cuff Tear", "Active", "Post-operative rehab, week 8 of 12."),
                ("Cervical Spondylosis", "Managed", "Nerve block provided significant relief. Home stretching program."),
                ("Total Hip Replacement Recovery", "Resolved", "12-week post-op. Full weight bearing achieved."),
                ("Tibial Stress Fracture", "Resolved", "Cam boot discontinued. Return to activity protocol started."),
                ("Plantar Fasciitis", "Active", "Night splint and custom orthotics prescribed."),
                ("Shoulder Impingement Syndrome", "Active", "Corticosteroid injection administered. PT referral given."),
            ],
            "reasons": [
                "Post-Operative Follow-up", "Physical Therapy Evaluation", "X-Ray Review",
                "Pain Management Consultation", "Fracture Follow-up",
                "Joint Injection", "Pre-Surgical Consultation", "Cast Removal",
            ],
            "notes": [
                "Wound healing well. ROM improving with PT. Pain 4/10, down from 7/10.",
                "Repeat imaging reviewed. No hardware complications. Continue rehab protocol.",
                "Patient reports functional improvement. Gait normalized. Discharge from PT discussed.",
            ],
            "treatments": [
                "Continue physical therapy 2x/week. NSAIDs PRN. Avoid impact activity.",
                "Cortisone injection administered in office. Ice 20 min TID. Recheck in 4 weeks.",
                "Cleared for full activity. Home exercise program provided. Annual follow-up.",
            ],
            "biomarkers": {
                "calcium":    [(8.2, 9.0),  (8.5, 9.4),  (8.8, 9.8)],
                "vitamin_d":  [(12, 22),    (18, 30),     (24, 38)],
                "hemoglobin": [(11.2, 12.8), (11.8, 13.4), (12.4, 14.0)],
                "bmi":        [(28, 36),    (27, 34),     (26, 32)],
                "weight":     [(82, 104),   (80, 100),    (78, 96)],
            },
        },
        "womens_health": {
            "conditions": [
                ("Polycystic Ovary Syndrome", "Active", "Metformin 500mg BID. Cycle regulation improving."),
                ("Endometriosis Stage II", "Managed", "Hormonal IUD placed. Pelvic pain well-controlled."),
                ("Iron Deficiency Anemia", "Active", "Ferrous sulfate 325mg daily. Recheck hemoglobin in 6 weeks."),
                ("Hypothyroidism", "Managed", "Levothyroxine 75mcg. TSH within normal range."),
                ("Osteoporosis Lumbar Spine", "Active", "Alendronate weekly. Calcium + Vitamin D3 supplementation."),
                ("Prior Gestational Diabetes", "Resolved", "Annual fasting glucose monitoring recommended."),
                ("Uterine Fibroids", "Active", "Watchful waiting. No surgical indication at this time."),
                ("Perimenopause", "Active", "HRT initiated. Symptom diary maintained by patient."),
            ],
            "reasons": [
                "Annual Gynecological Exam", "Hormone Therapy Review", "PCOS Management Follow-up",
                "Pelvic Pain Evaluation", "Prenatal Consultation",
                "Colposcopy Follow-up", "Bone Density Review", "IUD Check",
            ],
            "notes": [
                "Cycle more regular on current regimen. No breakthrough bleeding reported.",
                "Bone density stable. Vitamin D levels improving. Continue supplementation.",
                "Hemoglobin improved from last draw. Energy levels better per patient report.",
            ],
            "treatments": [
                "Continue current hormonal therapy. Pelvic floor PT referral. Follow up in 3 months.",
                "Increase Vitamin D to 2000 IU daily. Repeat DEXA in 2 years. Low-impact exercise encouraged.",
                "Iron infusion discussed. Oral iron continued for now. Dietary iron sources reviewed.",
            ],
            "biomarkers": {
                "hemoglobin":  [(9.8, 11.4),  (10.5, 12.2), (11.2, 13.0)],
                "calcium":     [(8.3, 9.1),   (8.6, 9.4),   (8.9, 9.8)],
                "vitamin_d":   [(14, 22),     (20, 30),     (26, 38)],
                "blood_sugar": [(88, 132),    (84, 124),    (80, 116)],
                "hba1c":       [(5.8, 7.2),   (5.5, 6.8),  (5.2, 6.4)],
                "bmi":         [(22, 32),     (21.5, 31),   (21, 30)],
            },
        },
        "pediatrics": {
            "conditions": [
                ("Moderate Persistent Asthma", "Active", "Daily ICS/LABA. Rescue inhaler PRN. Peak flow diary kept."),
                ("Type 1 Diabetes Mellitus", "Managed", "Insulin pump. A1C 7.4%. CGM with alerts enabled."),
                ("ADHD Combined Type", "Active", "Methylphenidate 10mg QAM. Behavioral therapy biweekly."),
                ("Atopic Dermatitis", "Active", "Topical triamcinolone + emollient regimen. Trigger avoidance."),
                ("Peanut and Tree Nut Allergy", "Active", "Epinephrine auto-injector prescribed. Allergist referral placed."),
                ("Resolved Recurrent Otitis Media", "Resolved", "PE tubes placed. No further episodes in 12 months."),
                ("Growth Hormone Deficiency", "Managed", "GH injections 0.03 mg/kg/day. Growth velocity improving."),
                ("Sickle Cell Trait", "Active", "Carrier confirmed. Genetic counseling provided to family."),
            ],
            "reasons": [
                "Well Child Visit", "Asthma Follow-up", "Diabetes Management Review",
                "Developmental Screening", "Immunization Visit",
                "Sick Visit", "Growth Assessment", "Allergy Evaluation",
            ],
            "notes": [
                "Growth tracking along 40th percentile. Vaccinations up to date. No acute concerns.",
                "A1C improved. Pump settings adjusted. Parent education on hypoglycemia protocol reinforced.",
                "Asthma well-controlled on current regimen. School action plan updated.",
            ],
            "treatments": [
                "Continue current regimen. Flu vaccine administered. Return for annual well visit.",
                "Adjust basal insulin rate. Carb ratio reviewed. CGM alarms recalibrated.",
                "Step up ICS dose. Spacer technique demonstrated. Follow up in 4 weeks.",
            ],
            "biomarkers": {
                "blood_sugar":       [(165, 195), (138, 172), (112, 148)],
                "hemoglobin":        [(9.8, 11.2), (10.4, 12.0), (11.0, 12.8)],
                "heart_rate":        [(96, 108),  (88, 100),   (80, 92)],
                "oxygen_saturation": [(91, 95),   (93, 97),    (95, 99)],
                "height":            [(98, 118),  (104, 128),  (110, 138)],
                "weight":            [(18, 32),   (22, 40),    (26, 48)],
            },
        },
    }

    UNIT_MAP = {
        "blood_pressure_systolic": "mmHg", "blood_pressure_diastolic": "mmHg",
        "heart_rate": "bpm", "cholesterol_total": "mg/dL", "cholesterol_ldl": "mg/dL",
        "cholesterol_hdl": "mg/dL", "triglycerides": "mg/dL", "calcium": "mg/dL",
        "vitamin_d": "ng/mL", "hemoglobin": "g/dL", "bmi": "kg/m²", "weight": "kg",
        "blood_sugar": "mg/dL", "hba1c": "%", "height": "cm", "oxygen_saturation": "%",
    }

    LOCATIONS_CONFIG = [
        {
            "name": "Piedmont Heart Institute",
            "address": "2100 Coronary Circle, Charlotte, NC 28207",
            "domain": "piedmontheart", "specialty": "cardiology",
            "primary_color": "#8b2635", "secondary_color": "#b85c6e",
            "header_color": "#3b1a1a", "background_color": "#fdfaf9",
            "admin": ("Lisa", "Parks"),
            "staff": [
                ("Marcus", "Webb", "Dr."), ("Angela", "Torres", "Dr."),
                ("James", "Holloway", "Dr."), ("Priya", "Nair", "RN"), ("Kevin", "Moss", "Dr."),
            ],
            "patients": [
                [("Robert", "Hill"), ("Sandra", "Mills"), ("Thomas", "Byrd"), ("Patricia", "Cole"), ("Gerald", "Foster")],
                [("Nancy", "Bell"), ("Donald", "Shaw"), ("Carol", "Lane"), ("Bruce", "Hunt"), ("Donna", "Reid")],
                [("Kenneth", "Price"), ("Dorothy", "Stone"), ("Larry", "Wade"), ("Betty", "Ross"), ("Frank", "Dean")],
                [("Sharon", "Grant"), ("Gary", "Boyd"), ("Helen", "Black"), ("Raymond", "Fox"), ("Virginia", "Nash")],
                [("Carl", "Burns"), ("Judith", "Hayes"), ("Harold", "Ray"), ("Diane", "Ward"), ("Philip", "Cross")],
            ],
            "addresses": [
                "312 Uptown Ave", "847 Park Road", "519 Tryon St", "1023 Queens Rd", "76 Dilworth Blvd",
                "234 Providence Rd", "668 Colony Rd", "410 Morehead St", "891 Kenilworth Ave", "143 Sharon Ln",
                "505 Selwyn Ave", "729 Barclay Downs", "382 Runnymede Ln", "1104 Sardis Rd", "67 Foxcroft Blvd",
                "219 Wendover Rd", "934 Randolph Rd", "461 Hempstead Pl", "782 Carmel Rd", "338 Fairview Rd",
                "115 Idlewild Rd", "603 Sharon Amity", "274 McClintock Rd", "857 Ballantyne Commons", "492 Rea Rd",
            ],
        },
        {
            "name": "SouthPark Orthopedic",
            "address": "4401 Sharon Road, Charlotte, NC 28211",
            "domain": "southparkorthopedic", "specialty": "orthopedics",
            "primary_color": "#2c5282", "secondary_color": "#5a8ab5",
            "header_color": "#1c2b3a", "background_color": "#f6f8fb",
            "admin": ("Marcus", "Delaney"),
            "staff": [
                ("Susan", "Holt", "Dr."), ("Craig", "Patel", "Dr."),
                ("Grace", "Wu", "PT"), ("Aaron", "Flynn", "Dr."), ("Monica", "Reyes", "Dr."),
            ],
            "patients": [
                [("Andrew", "Stevens"), ("Jennifer", "Blake"), ("Michael", "Carr"), ("Laura", "Griffin"), ("Eric", "Vaughn")],
                [("Amy", "Hudson"), ("Brian", "Tucker"), ("Carolyn", "Knight"), ("Dennis", "Barker"), ("Emma", "Logan")],
                [("Fiona", "Murray"), ("George", "Marsh"), ("Hannah", "Burgess"), ("Ian", "Crawford"), ("Julie", "Powers")],
                [("Keith", "Chambers"), ("Lindsey", "Arnold"), ("Martin", "Brewer"), ("Natalie", "Osborn"), ("Owen", "Garrett")],
                [("Pamela", "Stanton"), ("Quinn", "Mercer"), ("Rachel", "Payne"), ("Scott", "Dalton"), ("Tina", "Rowe")],
            ],
            "addresses": [
                "88 SouthPark Mall Rd", "341 Carnegie Blvd", "702 Fairview Rd", "155 Morrison Blvd", "924 Barclay Downs Dr",
                "437 Phillips Place", "813 Roxborough Rd", "260 Gleneagles Rd", "591 Quail Hollow Rd", "178 Runnymede Ln",
                "642 Colony Rd", "319 Sherwood Forest Dr", "777 Highgate Dr", "204 Huntington Park Dr", "568 Ferncliff Rd",
                "831 Raleigh St", "123 Tyvola Rd", "487 Woodlawn Rd", "956 Park South Dr", "312 Archdale Dr",
                "675 Lansdowne Dr", "248 Carmel Rd", "819 Pineville Matthews Rd", "134 Ardrey Kell Rd", "503 Blakeney Heath Dr",
            ],
        },
        {
            "name": "Carolina Women's Health",
            "address": "1800 Randolph Road, Charlotte, NC 28207",
            "domain": "carolinawomenshealth", "specialty": "womens_health",
            "primary_color": "#5b3a8a", "secondary_color": "#9171bf",
            "header_color": "#2e1a47", "background_color": "#faf7ff",
            "admin": ("Janet", "Owens"),
            "staff": [
                ("Vanessa", "King", "Dr."), ("Rebecca", "Cheng", "Dr."),
                ("Tanya", "Brooks", "CNM"), ("Laura", "Simmons", "Dr."), ("Michelle", "Park", "Dr."),
            ],
            "patients": [
                [("Allison", "Hart"), ("Brittany", "Pearson"), ("Catherine", "Bloom"), ("Danielle", "Vance"), ("Emily", "Sutton")],
                [("Felicia", "Drake"), ("Gina", "Horton"), ("Harriet", "Dawson"), ("Ingrid", "Swann"), ("Jackie", "Dunn")],
                [("Katherine", "Yates"), ("Lindsay", "Garner"), ("Maya", "Hollins"), ("Nicole", "Frost"), ("Olivia", "Crane")],
                [("Penelope", "Bauer"), ("Quinn", "Archer"), ("Rachel", "Finney"), ("Samantha", "Lowe"), ("Tiffany", "Hess")],
                [("Ursula", "Manning"), ("Veronica", "Caine"), ("Whitney", "Doyle"), ("Xena", "Sloane"), ("Yvonne", "Baxter")],
            ],
            "addresses": [
                "109 Clement Ave", "342 Mockingbird Ln", "718 Kenmore Ave", "255 Dilworth Rd", "884 Harding Pl",
                "431 Romany Rd", "796 Westminster Pl", "163 Hermitage Rd", "547 Roswell Ave", "288 Ridgewood Ave",
                "612 Elgin Ave", "374 Selwyn Ave", "839 Lombardy Cir", "191 Lombardy Ln", "567 Granville Rd",
                "924 Lyndhurst Ave", "312 Tuckaseegee Rd", "648 Remount Rd", "183 Freedom Dr", "721 Rozzelles Ferry Rd",
                "456 Beatties Ford Rd", "889 Oakdale Rd", "234 Brookshire Fwy", "677 Regal Ln", "118 Newland Rd",
            ],
        },
        {
            "name": "Uptown Pediatrics",
            "address": "900 NW Trade Street, Charlotte, NC 28202",
            "domain": "uptownpediatrics", "specialty": "pediatrics",
            "primary_color": "#1a6b6b", "secondary_color": "#3da8a8",
            "header_color": "#0d3333", "background_color": "#f0fbfb",
            "admin": ("Daniel", "Cruz"),
            "staff": [
                ("Anthony", "White", "Dr."), ("Christina", "Lee", "Dr."),
                ("Brendan", "Walsh", "NP"), ("Stephanie", "Morris", "Dr."), ("Justin", "Palmer", "Dr."),
            ],
            "patients": [
                [("Aaron", "Jennings"), ("Bella", "Thornton"), ("Connor", "Hicks"), ("Daisy", "Watkins"), ("Ethan", "Sims")],
                [("Faith", "Norris"), ("Gabriel", "Howell"), ("Hannah", "Pierce"), ("Isaac", "Caldwell"), ("Jade", "Moreno")],
                [("Kaylee", "Bolton"), ("Lucas", "Haynes"), ("Mia", "Cantu"), ("Nathan", "Briggs"), ("Piper", "Steele")],
                [("Riley", "Dawson"), ("Sebastian", "Holt"), ("Trinity", "Avery"), ("Ulysses", "Chen"), ("Violet", "Marsh")],
                [("William", "Okafor"), ("Xander", "Petrov"), ("Yasmin", "Alves"), ("Zachary", "Nguyen"), ("Zoe", "Harper")],
            ],
            "addresses": [
                "204 N Tryon St", "517 W 5th St", "88 College St", "331 W 9th St", "762 N Davidson St",
                "419 E 36th St", "853 The Plaza", "174 Parkwood Ave", "638 Commonwealth Ave", "291 Hawthorne Ln",
                "744 Caswell Rd", "382 Pecan Ave", "619 Sylvania Ave", "157 Norwood Rd", "893 Eastway Dr",
                "326 Wendover Rd E", "741 Monroe Rd", "188 Rama Rd", "562 Wilkinson Blvd", "934 Mt Holly Huntersville Rd",
                "413 Toddville Rd", "877 Sam Newell Rd", "245 Lawyers Rd", "689 Harrisburg Rd", "132 Mallard Creek Rd",
            ],
        },
    ]

    for loc_cfg in LOCATIONS_CONFIG:
        spec = SPECIALTY[loc_cfg["specialty"]]
        domain = loc_cfg["domain"]

        location = Location(
            name=loc_cfg["name"],
            address=loc_cfg["address"],
            primary_color=loc_cfg["primary_color"],
            secondary_color=loc_cfg["secondary_color"],
            header_color=loc_cfg["header_color"],
            background_color=loc_cfg["background_color"],
        )
        db.session.add(location)
        db.session.flush()

        afirst, alast = loc_cfg["admin"]
        admin = User(
            email=f"{afirst.lower()}.{alast.lower()}@{domain}.com",
            full_name=f"{afirst} {alast}",
            address=loc_cfg["address"],
            location=loc_cfg["name"],
            location_id=location.id,
            user_type="location_admin",
        )
        admin.set_password("password")
        db.session.add(admin)

        addr_idx = 0
        for staff_idx, (sfirst, slast, stitle) in enumerate(loc_cfg["staff"]):
            staff_user = User(
                email=f"{sfirst.lower()}.{slast.lower()}@{domain}.com",
                full_name=f"{stitle} {sfirst} {slast}",
                address=loc_cfg["address"],
                location=loc_cfg["name"],
                location_id=location.id,
                user_type="staff",
            )
            staff_user.set_password("password")
            db.session.add(staff_user)
            db.session.flush()

            for pat_idx, (pfirst, plast) in enumerate(loc_cfg["patients"][staff_idx]):
                patient = User(
                    email=f"{pfirst.lower()}.{plast.lower()}@{domain}.com",
                    full_name=f"{pfirst} {plast}",
                    address=f"{loc_cfg['addresses'][addr_idx]}, Charlotte, NC",
                    location=loc_cfg["name"],
                    location_id=location.id,
                    user_type="patient",
                )
                patient.set_password("password")
                db.session.add(patient)
                db.session.flush()
                addr_idx += 1

                conds = spec["conditions"]
                for ci in range(2):
                    idx = (staff_idx * 5 + pat_idx + ci) % len(conds)
                    cname, cstatus, cnotes = conds[idx]
                    year = 2021 + (staff_idx + pat_idx + ci) % 3
                    month = 1 + (pat_idx * 3 + ci * 4) % 12
                    day = 1 + (staff_idx * 7 + pat_idx) % 27
                    db.session.add(MedicalHistory(
                        patient_id=patient.id,
                        condition=cname,
                        diagnosis_date=f"{year}-{month:02d}-{day:02d}",
                        status=cstatus,
                        notes=cnotes,
                    ))

                bm_keys = list(spec["biomarkers"].keys())
                for appt_num in range(3):
                    days_ago = 270 - appt_num * 90
                    appt_date = now - timedelta(days=days_ago + staff_idx + pat_idx)
                    reason_idx = (staff_idx * 5 + pat_idx + appt_num) % len(spec["reasons"])
                    appt = Appointment(
                        patient_id=patient.id,
                        doctor_id=staff_user.id,
                        appointment_date=appt_date,
                        status="completed",
                        reason=spec["reasons"][reason_idx],
                        notes=spec["notes"][appt_num % len(spec["notes"])],
                        treatments=spec["treatments"][appt_num % len(spec["treatments"])],
                    )
                    db.session.add(appt)
                    db.session.flush()

                    num_bm = 3 + (appt_num % 2)
                    for bm_key in bm_keys[:num_bm]:
                        ranges = spec["biomarkers"][bm_key]
                        lo, hi = ranges[min(appt_num, len(ranges) - 1)]
                        frac = (pat_idx * 0.18 + staff_idx * 0.09) % 1.0
                        raw = lo + frac * (hi - lo)
                        value = round(raw, 1) if (hi - lo) < 20 else round(raw)
                        db.session.add(BiomarkerReading(
                            appointment_id=appt.id,
                            biomarker_type=bm_key,
                            value=value,
                            unit=UNIT_MAP.get(bm_key, ""),
                            created_at=appt_date,
                        ))

                pending_offset = 7 + (staff_idx * 4 + pat_idx * 3) % 21
                pending_reason_idx = (staff_idx * 5 + pat_idx + 4) % len(spec["reasons"])
                db.session.add(Appointment(
                    patient_id=patient.id,
                    doctor_id=staff_user.id,
                    appointment_date=now + timedelta(days=pending_offset),
                    status="pending",
                    reason=spec["reasons"][pending_reason_idx],
                ))

    try:
        db.session.commit()
        print("✓ Stress test data seeded: 4 locations, 20 staff, 100 patients.")
    except IntegrityError:
        db.session.rollback()
        print("✓ Concurrent stress test seed detected. Rolled back gracefully.")

